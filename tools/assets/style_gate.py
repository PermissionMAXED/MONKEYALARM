#!/usr/bin/env python3
"""Style-Gate für 3D-Modelle (W17 / Agent ASSETS-CC0).

Prüft alle GLB-/glTF-Modelle unter GOOBY-GODOT/assets gegen die
Kurations-Regeln des Projekts, BEVOR sie ins Spiel wandern:

  E1  Lizenz-Beleg: im Modell-Ordner (oder einem Eltern-Ordner innerhalb
      von assets/) liegt eine License*/LIZENZ*-Datei — ODER der Ordner ist
      in docs/ASSET-SOURCES.md ausdrücklich als »Eigenbau« geführt.
  E2  Referenzen: alle extern referenzierten Bilder (z. B.
      Textures/colormap.png) existieren neben dem Modell.
  E3  Low-Poly-Budget: ≤ 25 000 Dreiecke pro Modell.
  E4  Datei-Budget: ≤ 1,5 MB pro Modell (größtes Bestands-Modell: 644 KB).
  E5  Textur-Budget: eingebettete/referenzierte Bilder ≤ 2048 px Kante.

  W1  Aufrecht-Heuristik (User-Wunsch »alles richtig rotiert«): kippt eine
      Root-Node-Rotation die Y-Achse des Modells um mehr als ~45°, ist das
      Modell vermutlich auf der Seite exportiert → Warnung.
  W2  Boden-Heuristik: liegt die Unterkante deutlich unter dem Ursprung,
      versinkt das Modell beim Platzieren (für Decken-/Zentrums-Props wie
      Lampen oder Planeten ist das ok) → Warnung.

Aufruf (aus dem Repo-Root):
  python3 tools/assets/style_gate.py                 # ganzer Asset-Baum
  python3 tools/assets/style_gate.py PFAD [PFAD …]   # nur diese Dateien/Ordner
  python3 tools/assets/style_gate.py --strict        # Warnungen = Fehler

Exit-Code 0 = alles ok (Warnungen erlaubt), 1 = mindestens ein Fehler.
Reine Standardbibliothek, kein Godot/Blender nötig.
"""

from __future__ import annotations

import base64
import fnmatch
import json
import struct
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ASSETS = REPO / "GOOBY-GODOT" / "assets"
SOURCES_DOC = REPO / "docs" / "ASSET-SOURCES.md"

MAX_TRIS = 25_000
MAX_BYTES = 1_500_000
MAX_TEX = 2048
# Unterkante unterhalb von -35 % der Modellhöhe → W2-Warnung.
GROUND_SLACK = 0.35
# cos(45°): so weit darf eine Root-Rotation die Y-Achse kippen (W1).
UP_DOT_MIN = 0.7


def gltf_json_and_bin(path: Path) -> tuple[dict, bytes]:
    """JSON-Chunk (+ BIN-Chunk bei GLB) eines Modells lesen."""
    raw = path.read_bytes()
    if path.suffix.lower() == ".gltf":
        return json.loads(raw.decode("utf-8")), b""
    if raw[:4] != b"glTF":
        raise ValueError("kein GLB-Header")
    offset = 12
    doc: dict = {}
    binary = b""
    while offset + 8 <= len(raw):
        length, kind = struct.unpack_from("<II", raw, offset)
        chunk = raw[offset + 8 : offset + 8 + length]
        if kind == 0x4E4F534A:  # 'JSON'
            doc = json.loads(chunk.decode("utf-8"))
        elif kind == 0x004E4942:  # 'BIN'
            binary = chunk
        offset += 8 + length
    return doc, binary


def image_dims(blob: bytes) -> tuple[int, int] | None:
    """Breite/Höhe aus PNG- oder JPEG-Bytes (Header-Parse, kein Pillow)."""
    if blob[:8] == b"\x89PNG\r\n\x1a\n" and len(blob) >= 24:
        width, height = struct.unpack_from(">II", blob, 16)
        return width, height
    if blob[:2] == b"\xff\xd8":  # JPEG: SOF-Marker suchen
        i = 2
        while i + 9 < len(blob):
            if blob[i] != 0xFF:
                i += 1
                continue
            marker = blob[i + 1]
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                height, width = struct.unpack_from(">HH", blob, i + 5)
                return width, height
            size = struct.unpack_from(">H", blob, i + 2)[0]
            i += 2 + size
    return None


def triangle_count(doc: dict) -> int:
    tris = 0
    accessors = doc.get("accessors", [])
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if "indices" in prim:
                tris += accessors[prim["indices"]].get("count", 0) // 3
            elif "attributes" in prim and "POSITION" in prim["attributes"]:
                pos = accessors[prim["attributes"]["POSITION"]]
                tris += pos.get("count", 0) // 3
    return tris


def position_aabb(doc: dict) -> tuple[list[float], list[float]] | None:
    lo = [1e18] * 3
    hi = [-1e18] * 3
    accessors = doc.get("accessors", [])
    found = False
    for mesh in doc.get("meshes", []):
        for prim in mesh.get("primitives", []):
            idx = prim.get("attributes", {}).get("POSITION")
            if idx is None:
                continue
            acc = accessors[idx]
            if "min" not in acc or "max" not in acc:
                continue
            found = True
            for k in range(3):
                lo[k] = min(lo[k], acc["min"][k])
                hi[k] = max(hi[k], acc["max"][k])
    return (lo, hi) if found else None


def rotated_up_dot(rotation: list[float]) -> float:
    """Y-Komponente der um das Quaternion gedrehten Y-Achse (0,1,0)."""
    x, y, z, w = rotation
    # v' = q * (0,1,0) * q^-1, nur die Y-Komponente wird gebraucht.
    return 1.0 - 2.0 * (x * x + z * z)


def eigenbau_folders() -> list[str]:
    """In docs/ASSET-SOURCES.md als Eigenbau geführte Ordner (res-relativ)."""
    folders: list[str] = []
    if not SOURCES_DOC.exists():
        return folders
    for line in SOURCES_DOC.read_text(encoding="utf-8").splitlines():
        if "Eigenbau" not in line:
            continue
        for piece in line.split("`")[1::2]:
            piece = piece.strip().rstrip("/")
            if piece.startswith("assets/"):
                folders.append(piece)
    return folders


def has_license(folder: Path, eigenbau: list[str]) -> bool:
    rel = folder.relative_to(ASSETS.parent).as_posix()  # »assets/…«
    if any(rel == e or rel.startswith(e + "/") for e in eigenbau):
        return True
    node = folder
    while True:
        for name in node.iterdir():
            low = name.name.lower()
            if fnmatch.fnmatch(low, "license*") or fnmatch.fnmatch(low, "lizenz*"):
                return True
        if node == ASSETS:
            return False
        node = node.parent


def check_model(path: Path, eigenbau: list[str]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        doc, binary = gltf_json_and_bin(path)
    except Exception as exc:  # kaputte Datei = harter Fehler
        return [f"E0 nicht lesbar: {exc}"], []

    if not has_license(path.parent, eigenbau):
        errors.append(
            "E1 kein Lizenz-Beleg (License*/LIZENZ* im Ordner/Eltern-Ordner "
            "oder Eigenbau-Eintrag in docs/ASSET-SOURCES.md)"
        )

    views = doc.get("bufferViews", [])
    for image in doc.get("images", []):
        uri = image.get("uri", "")
        blob = b""
        if uri.startswith("data:"):
            blob = base64.b64decode(uri.split(",", 1)[1])
        elif uri:
            target = path.parent / uri
            if not target.exists():
                errors.append(f"E2 referenziertes Bild fehlt: {uri}")
                continue
            blob = target.read_bytes()
        elif "bufferView" in image and binary:
            view = views[image["bufferView"]]
            start = view.get("byteOffset", 0)
            blob = binary[start : start + view["byteLength"]]
        dims = image_dims(blob) if blob else None
        if dims and max(dims) > MAX_TEX:
            errors.append(f"E5 Textur {dims[0]}x{dims[1]} px > {MAX_TEX} px")

    tris = triangle_count(doc)
    if tris > MAX_TRIS:
        errors.append(f"E3 {tris} Dreiecke > Budget {MAX_TRIS}")

    size = path.stat().st_size
    if size > MAX_BYTES:
        errors.append(f"E4 {size / 1e6:.2f} MB > Budget {MAX_BYTES / 1e6:.1f} MB")

    scene = doc.get("scenes", [{}])[doc.get("scene", 0)]
    nodes = doc.get("nodes", [])
    for idx in scene.get("nodes", []):
        rotation = nodes[idx].get("rotation")
        if rotation and rotated_up_dot(rotation) < UP_DOT_MIN:
            warnings.append(
                f"W1 Root-Node »{nodes[idx].get('name', idx)}« ist >45° "
                "gekippt — liegt das Modell auf der Seite?"
            )

    box = position_aabb(doc)
    if box is not None:
        lo, hi = box
        height = hi[1] - lo[1]
        if height > 0.001 and lo[1] < -GROUND_SLACK * height:
            warnings.append(
                f"W2 Unterkante y={lo[1]:.2f} bei Höhe {height:.2f} — "
                "versinkt beim Platzieren (Decken-/Zentrums-Prop: ok)"
            )
    return errors, warnings


def collect(paths: list[str]) -> list[Path]:
    if not paths:
        paths = [str(ASSETS)]
    out: list[Path] = []
    for entry in paths:
        p = Path(entry)
        if not p.is_absolute():
            p = REPO / p
        if p.is_dir():
            out += sorted(p.rglob("*.glb")) + sorted(p.rglob("*.gltf"))
        elif p.suffix.lower() in (".glb", ".gltf"):
            out.append(p)
    return out


def main(argv: list[str]) -> int:
    strict = "--strict" in argv
    files = collect([a for a in argv if not a.startswith("--")])
    if not files:
        print("style_gate: keine Modelle gefunden")
        return 1
    eigenbau = eigenbau_folders()
    n_err = 0
    n_warn = 0
    for path in files:
        errors, warnings = check_model(path, eigenbau)
        rel = path.relative_to(REPO)
        for msg in errors:
            print(f"FEHLER  {rel}: {msg}")
        for msg in warnings:
            print(f"warnung {rel}: {msg}")
        n_err += len(errors)
        n_warn += len(warnings)
    verdict = "ROT" if n_err or (strict and n_warn) else "GRÜN"
    print(
        f"style_gate: {len(files)} Modelle geprüft — "
        f"{n_err} Fehler, {n_warn} Warnungen → {verdict}"
    )
    return 1 if verdict == "ROT" else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
