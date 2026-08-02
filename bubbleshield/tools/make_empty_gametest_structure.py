#!/usr/bin/env python3
"""Generates data/bubbleshield/structure/empty.nbt — the shared GameTest template.

The upstream Fabric tests ran on fabric-gametest's auto-generated empty structure
(plus `padding = 16`). Vanilla/NeoForge 1.21.1 has no auto-empty template and the
snbt `gameteststructures/` source only exists when running from an IDE
(SharedConstants.IS_RUNNING_IN_IDE), so the port ships a binary .nbt template on
the classpath (data/<ns>/structure/, loaded by StructureTemplateManager's
resource source in every environment, including runGameTestServer).

Layout: 9x18x9, a 9x9 polished-andesite floor at y=0, everything above is air.
The projector sits at relative (4, 2, 4) exactly like upstream; 18 blocks of
height keep the arrow drop tests (spawn at y=14.5) inside the structure's
force-loaded, entity-ticking chunk column.

Run from the repo root:  python3 tools/make_empty_gametest_structure.py
"""

import gzip
import io
import struct
from pathlib import Path

FLOOR_BLOCK = "minecraft:polished_andesite"
DATA_VERSION = 3955  # 1.21.1
OUT_DIR = Path(__file__).resolve().parent.parent / "src/main/resources/data/bubbleshield/structure"

# name -> (size_x, size_y, size_z); linking_arena mirrors upstream's 39x8x8
# two-projector arena (data/bubbleshield/gametest/structure/linking_arena.snbt).
TEMPLATES = {
    "empty": (9, 18, 9),
    "linking_arena": (39, 8, 8),
}

TAG_END, TAG_INT, TAG_STRING, TAG_LIST, TAG_COMPOUND = 0, 3, 8, 9, 10


def w_str(buf: io.BytesIO, s: str) -> None:
    raw = s.encode("utf-8")
    buf.write(struct.pack(">H", len(raw)))
    buf.write(raw)


def w_named(buf: io.BytesIO, tag_type: int, name: str) -> None:
    buf.write(struct.pack(">b", tag_type))
    w_str(buf, name)


def w_int(buf: io.BytesIO, value: int) -> None:
    buf.write(struct.pack(">i", value))


def write_template(name: str, size_x: int, size_y: int, size_z: int) -> None:
    buf = io.BytesIO()
    # root compound (unnamed)
    w_named(buf, TAG_COMPOUND, "")

    # size: List<Int>[x, y, z]
    w_named(buf, TAG_LIST, "size")
    buf.write(struct.pack(">bi", TAG_INT, 3))
    for v in (size_x, size_y, size_z):
        w_int(buf, v)

    # entities: empty list
    w_named(buf, TAG_LIST, "entities")
    buf.write(struct.pack(">bi", TAG_END, 0))

    # blocks: the floor layer only; unlisted positions stay air (the runner
    # clears the whole structure volume before placing the template).
    floor = [(x, 0, z) for x in range(size_x) for z in range(size_z)]
    w_named(buf, TAG_LIST, "blocks")
    buf.write(struct.pack(">bi", TAG_COMPOUND, len(floor)))
    for pos in floor:
        w_named(buf, TAG_LIST, "pos")
        buf.write(struct.pack(">bi", TAG_INT, 3))
        for v in pos:
            w_int(buf, v)
        w_named(buf, TAG_INT, "state")
        w_int(buf, 0)
        buf.write(struct.pack(">b", TAG_END))

    # palette
    w_named(buf, TAG_LIST, "palette")
    buf.write(struct.pack(">bi", TAG_COMPOUND, 1))
    w_named(buf, TAG_STRING, "Name")
    w_str(buf, FLOOR_BLOCK)
    buf.write(struct.pack(">b", TAG_END))

    w_named(buf, TAG_INT, "DataVersion")
    w_int(buf, DATA_VERSION)

    buf.write(struct.pack(">b", TAG_END))  # close root

    out = OUT_DIR / f"{name}.nbt"
    out.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(out, "wb") as f:
        f.write(buf.getvalue())
    print(f"wrote {out} ({out.stat().st_size} bytes gzip)")


def main() -> None:
    for name, (sx, sy, sz) in TEMPLATES.items():
        write_template(name, sx, sy, sz)


if __name__ == "__main__":
    main()
