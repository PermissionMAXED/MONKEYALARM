#!/usr/bin/env python3
"""Forensische .ipa-Verifikation (FB-6/CI) — ersetzt das Workflow-Heredoc.

WICHTIGSTE AENDERUNG gegenueber dem Heredoc: Erwartungen, die frueher hart
kodiert waren (Orientierungen, Bundle-Id, Min-iOS, Device-Family), werden aus
`GOOBY-GODOT/export_presets.cfg` ABGELEITET. Hintergrund: Der harte
Orientierungs-Set-Vergleich (alle 4 inkl. PortraitUpsideDown) hat nach dem
bewussten Preset-Wechsel in W6/FIX (`portrait_upside_down=false`) 8 CI-Runs in
Folge rot gemacht, obwohl die .ipa korrekt war. Ein abgeleiteter Check kann
nicht mehr veralten: Preset aendern == Erwartung aendert sich mit.

GROESSENWACHT (CI-36): Die .ipa-Groesse wird gegen tools/ci/ipa_baseline.json
verglichen. Wachstum ab +10 % gibt eine Warnung, ab +50 % wird der Lauf ROT —
das faengt versehentlich eingepackte Assets (unkomprimierte Audios, doppelte
Texturen) ab, bevor Sideload-Nutzer 100 MB mehr ziehen. Gewolltes Wachstum:
`size_bytes` in der Baseline auf den im Log gedruckten Byte-Wert setzen.
Der Report (Gesamt/Baseline/Delta + Anteil PCK/Mach-O/Assets.car) landet
zusaetzlich in GITHUB_STEP_SUMMARY, sofern die Variable gesetzt ist (im
ios-ipa-Job immer).

Aufruf: python3 tools/ci/verify_ipa.py [ipa-pfad] [projekt-dir]
Exit 0 = PASS (druckt ".ipa gebaut: X MB, Y Dateien im PCK"), Exit 1 = Fehler
(inklusive Groessenwacht-FAIL ab +50 %).
"""

from __future__ import annotations

import json
import os
import plistlib
import re
import struct
import sys
import zipfile
from pathlib import Path, PurePosixPath

# Groessenwacht-Schwellen (CI-36) — Policy gehoert in den Code, nur die
# Baseline-ZAHL ist Daten (tools/ci/ipa_baseline.json).
WARN_GROWTH_PERCENT = 10.0
FAIL_GROWTH_PERCENT = 50.0
BASELINE_PATH = Path(__file__).with_name("ipa_baseline.json")

ORIENTATION_KEYS = {
    "orientation/portrait": "UIInterfaceOrientationPortrait",
    "orientation/landscape_left": "UIInterfaceOrientationLandscapeLeft",
    "orientation/landscape_right": "UIInterfaceOrientationLandscapeRight",
    "orientation/portrait_upside_down": "UIInterfaceOrientationPortraitUpsideDown",
}
# Godot targeted_device_family -> Info.plist UIDeviceFamily.
DEVICE_FAMILY = {0: [1], 1: [2], 2: [1, 2]}


def ios_preset_options(preset_path: Path) -> dict[str, str]:
    """Liest die [preset.N.options] des Presets mit platform="iOS" (roh)."""
    options: dict[str, str] = {}
    section = ""
    preset_id = None
    for line in preset_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith(";"):
            continue
        if line.startswith("[") and line.endswith("]"):
            section = line[1:-1]
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip()
        if preset_id is None and key == "platform" and value == '"iOS"':
            preset_id = section  # z. B. "preset.0"
        if preset_id is not None and section == preset_id + ".options":
            options[key] = value
    if preset_id is None:
        raise SystemExit("FEHLER: kein iOS-Preset in export_presets.cfg")
    return options


def unquote(value: str) -> str:
    return value[1:-1] if value.startswith('"') and value.endswith('"') else value


def expected_orientations(options: dict[str, str]) -> set[str]:
    return {
        plist_key
        for preset_key, plist_key in ORIENTATION_KEYS.items()
        if options.get(preset_key, "false") == "true"
    }


def landscape_first(project: Path) -> bool:
    """project.godot handheld/orientation: 0/2/4 = Landscape(-Sensor)."""
    text = (project / "project.godot").read_text(encoding="utf-8")
    match = re.search(r"(?m)^window/handheld/orientation=(\d+)", text)
    return match is not None and int(match.group(1)) in (0, 2, 4)


def read_pck_directory(pck: bytes) -> dict[str, tuple[int, int, int]]:
    assert pck[:4] == b"GDPC", "GOOBY.pck hat keinen Godot-PCK-Header"
    file_base = struct.unpack_from("<Q", pck, 24)[0]
    offset = 96
    file_count = struct.unpack_from("<I", pck, offset)[0]
    offset += 4
    entries: dict[str, tuple[int, int, int]] = {}
    for _ in range(file_count):
        path_length = struct.unpack_from("<I", pck, offset)[0]
        offset += 4
        path = pck[offset : offset + path_length].rstrip(b"\0").decode()
        offset += path_length
        data_offset, data_size = struct.unpack_from("<QQ", pck, offset)
        offset += 16 + 16  # (offset,size) + MD5
        entry_flags = struct.unpack_from("<I", pck, offset)[0]
        offset += 4
        entries[path] = (file_base + data_offset, data_size, entry_flags)
    return entries


def verify_macho(executable: bytes) -> None:
    (magic, cpu_type, _sub, file_type, command_count, command_bytes, flags, _r) = (
        struct.unpack_from("<8I", executable)
    )
    assert magic == 0xFEEDFACF, "Executable ist kein 64-Bit-Mach-O"
    assert cpu_type == 0x0100000C, "Executable ist nicht arm64"
    assert file_type == 2, "Mach-O ist kein Executable"
    assert flags & 0x1, "Mach-O fehlt MH_NOUNDEFS"
    dylib_commands = {0xC, 0x80000018, 0x8000001F, 0x20, 0x80000023}
    non_system, has_signature = [], False
    offset = 32
    for _ in range(command_count):
        command, command_size = struct.unpack_from("<II", executable, offset)
        assert command_size >= 8
        if command in dylib_commands:
            name_offset = struct.unpack_from("<I", executable, offset + 8)[0]
            end = executable.find(b"\0", offset + name_offset, offset + command_size)
            dylib = executable[offset + name_offset : end].decode()
            if not dylib.startswith(("/System/Library/", "/usr/lib/")):
                non_system.append(dylib)
        if command == 0x1D:
            has_signature = True
        offset += command_size
    assert offset == 32 + command_bytes
    assert not non_system, non_system
    assert not has_signature, "Artefakt soll vor dem Sideload unsigniert sein"


def mb(size_bytes: float) -> str:
    return f"{size_bytes / (1024 * 1024):.1f} MB"


def load_baseline(path: Path) -> tuple[int, str]:
    """Fail-closed: eine fehlende/kaputte Baseline ist ein Repo-Fehler."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        size = int(data["size_bytes"])
    except (OSError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(f"FEHLER: IPA-Baseline unlesbar ({path}): {error!r}")
    if size <= 0:
        raise SystemExit(f"FEHLER: IPA-Baseline size_bytes muss > 0 sein: {size}")
    return size, str(data.get("quelle", "unbekannt"))


def size_verdict(size_bytes: int, baseline_bytes: int) -> tuple[str, float]:
    """OK / WARN (ab +10 %) / FAIL (ab +50 %) gegen die Baseline."""
    delta_percent = (size_bytes - baseline_bytes) / baseline_bytes * 100.0
    if delta_percent >= FAIL_GROWTH_PERCENT:
        return "FAIL", delta_percent
    if delta_percent >= WARN_GROWTH_PERCENT:
        return "WARN", delta_percent
    return "OK", delta_percent


def main() -> int:
    ipa = Path(sys.argv[1] if len(sys.argv) > 1 else "build/ios/GOOBY-godot-unsigned.ipa")
    project = Path(sys.argv[2] if len(sys.argv) > 2 else "GOOBY-GODOT")
    options = ios_preset_options(project / "export_presets.cfg")
    bundle_id = unquote(options["application/bundle_identifier"])
    min_ios = unquote(options["application/min_ios_version"])
    families = DEVICE_FAMILY[int(options.get("application/targeted_device_family", "2"))]
    want_orientations = expected_orientations(options)
    assert want_orientations, "Preset erlaubt gar keine Orientierung?"

    with zipfile.ZipFile(ipa) as archive:
        assert archive.testzip() is None, "IPA-ZIP ist beschaedigt"
        names = archive.namelist()
        assert not [
            n for n in names if n.startswith("/") or ".." in PurePosixPath(n).parts
        ], "IPA enthaelt unsichere Pfade"
        apps = sorted(
            {
                n.split("/")[1]
                for n in names
                if n.startswith("Payload/")
                and len(n.split("/")) > 1
                and n.split("/")[1].endswith(".app")
            }
        )
        assert apps == ["GOOBY.app"], f"Unerwartete App-Bundles: {apps}"
        app = "Payload/GOOBY.app/"

        info = plistlib.loads(archive.read(app + "Info.plist"))
        assert info["CFBundleIdentifier"] == bundle_id, info["CFBundleIdentifier"]
        assert info["CFBundleExecutable"] == "GOOBY"
        assert sorted(info["UIDeviceFamily"]) == families, info["UIDeviceFamily"]
        assert info["MinimumOSVersion"] == min_ios, info["MinimumOSVersion"]
        assert info["ITSAppUsesNonExemptEncryption"] is False
        assert info["UIFileSharingEnabled"] is False
        assert info["UILaunchStoryboardName"] == "Launch Screen"
        assert "arm64" in info["UIRequiredDeviceCapabilities"]
        orientations = info["UISupportedInterfaceOrientations"]
        # ABGELEITET statt hart kodiert (s. Modul-Docstring).
        assert set(orientations) == want_orientations, (
            f"Plist-Orientierungen {sorted(orientations)} != "
            f"Preset-Orientierungen {sorted(want_orientations)}"
        )
        if landscape_first(project):
            landscape = [o for o in orientations if "Landscape" in o]
            assert orientations[: len(landscape)] == landscape, (
                f"Landscape muss zuerst stehen (Start-Orientierung): {orientations}"
            )

        verify_macho(archive.read(app + info["CFBundleExecutable"]))

        assert archive.read(app + "PkgInfo") == b"APPL????"
        assert any(n.startswith(app + "Launch Screen.storyboardc/") for n in names)
        assert app + "Assets.car" in names
        assets_car = archive.read(app + "Assets.car")
        assert b"AppIcon" in assets_car and b"Icon-1024.png" in assets_car
        assert app + "AppIcon60x60@2x.png" in names
        assert app + "AppIcon76x76@2x~ipad.png" in names
        assert not any("/_CodeSignature/" in n for n in names)
        assert not any(n.endswith("embedded.mobileprovision") for n in names)

        pck = archive.read(app + "GOOBY.pck")
        entries = read_pck_directory(pck)
        assert len(entries) > 1000, f"Verdaechtig kleines PCK: {len(entries)} Dateien"

        imported_assets, direct_json = [], []
        for root_name in ("assets", "content"):
            for source in (project / root_name).rglob("*"):
                if not source.is_file() or source.name.endswith(".import"):
                    continue
                relative = source.relative_to(project).as_posix()
                if Path(str(source) + ".import").is_file():
                    imported_assets.append(relative)
                elif source.suffix.lower() == ".json":
                    direct_json.append(relative)
        for source in imported_assets:
            import_path = source + ".import"
            assert import_path in entries, f"Asset-Metadaten fehlen: {source}"
            data_offset, data_size, _flags = entries[import_path]
            metadata = pck[data_offset : data_offset + data_size].decode(errors="replace")
            match = re.search(r'(?m)^path="res://([^"]+)"', metadata)
            assert match, f"Asset ohne Export-Remap: {source}"
            assert match.group(1) in entries, f"Asset-Daten fehlen: {source}"
        for source in direct_json:
            assert source in entries, f"JSON fehlt im PCK: {source}"

        # Groessenwacht-Anteile: komprimierte Groesse IM ZIP (= was der
        # Sideload-Download wirklich kostet), nicht die entpackte.
        compressed = {
            part: archive.getinfo(app + part).compress_size
            for part in ("GOOBY.pck", "GOOBY", "Assets.car")
        }

    size_bytes = ipa.stat().st_size
    baseline_bytes, baseline_quelle = load_baseline(BASELINE_PATH)
    verdict, delta_percent = size_verdict(size_bytes, baseline_bytes)
    rest_bytes = size_bytes - sum(compressed.values())

    summary = (
        f".ipa gebaut: {mb(size_bytes)}, {len(entries)} Dateien im PCK "
        f"({len(imported_assets)} Assets + {len(direct_json)} JSON verifiziert, "
        f"Orientierungen: {sorted(want_orientations)})"
    )
    print("IPA PASS:", summary)
    print(
        f"IPA GROESSE: {size_bytes} Bytes ({mb(size_bytes)}), "
        f"Baseline {baseline_bytes} Bytes ({mb(baseline_bytes)}), "
        f"Delta {delta_percent:+.1f} % -> {verdict}"
    )
    baseline_hinweis = (
        f"gewolltes Wachstum? size_bytes={size_bytes} in "
        f"tools/ci/ipa_baseline.json setzen"
    )
    if verdict == "WARN":
        print(
            f"::warning::.ipa {delta_percent:+.1f} % ueber Baseline "
            f"({mb(baseline_bytes)} -> {mb(size_bytes)}) — ab "
            f"+{FAIL_GROWTH_PERCENT:.0f} % wird der Job rot; {baseline_hinweis}"
        )
    elif verdict == "FAIL":
        print(
            f"::error::.ipa {delta_percent:+.1f} % ueber Baseline "
            f"({mb(baseline_bytes)} -> {mb(size_bytes)}), erlaubt sind "
            f"+{FAIL_GROWTH_PERCENT:.0f} %; {baseline_hinweis}"
        )

    schwellen = (
        f"Warnung ab +{WARN_GROWTH_PERCENT:.0f} %, "
        f"rot ab +{FAIL_GROWTH_PERCENT:.0f} %"
    )
    step_summary = os.environ.get("GITHUB_STEP_SUMMARY", "")
    if step_summary:
        with open(step_summary, "a", encoding="utf-8") as handle:
            handle.write(f"**{summary}**\n\n")
            handle.write("### .ipa-Groessenwacht (CI-36)\n\n")
            handle.write("| Messwert | Wert |\n| --- | --- |\n")
            handle.write(f"| .ipa gesamt | {mb(size_bytes)} ({size_bytes} Bytes) |\n")
            handle.write(f"| Baseline | {mb(baseline_bytes)} — {baseline_quelle} |\n")
            handle.write(
                f"| Delta | {delta_percent:+.1f} % — **{verdict}** ({schwellen}) |\n"
            )
            handle.write(f"| GOOBY.pck (komprimiert) | {mb(compressed['GOOBY.pck'])} |\n")
            handle.write(f"| GOOBY Mach-O (komprimiert) | {mb(compressed['GOOBY'])} |\n")
            handle.write(f"| Assets.car (komprimiert) | {mb(compressed['Assets.car'])} |\n")
            handle.write(
                f"| Rest (Storyboard, Icons, ZIP-Overhead) | {mb(rest_bytes)} |\n"
            )
            if verdict != "OK":
                handle.write(f"\n{verdict}: {baseline_hinweis}.\n")
    return 1 if verdict == "FAIL" else 0


if __name__ == "__main__":
    sys.exit(main())
