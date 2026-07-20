#!/usr/bin/env python3
"""Generate deterministic W4 boss, minion, and item textures."""

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ITEM_DIR = ROOT / "src/main/resources/assets/aetherion/textures/item"
ENTITY_DIR = ROOT / "src/main/resources/assets/aetherion/textures/entity"
TRANSPARENT = (0, 0, 0, 0)
DARK = "#130D29"
MID = "#35245C"
PURPLE = "#7C3AED"
BLUE = "#238BFF"
CYAN = "#45F3FF"
GOLD = "#F7C948"
WHITE = "#FFF8CF"


def save(image: Image.Image, directory: Path, name: str) -> None:
	directory.mkdir(parents=True, exist_ok=True)
	image.save(directory / f"{name}.png")


def item_texture(name: str, painter) -> None:
	image = Image.new("RGBA", (16, 16), TRANSPARENT)
	painter(ImageDraw.Draw(image))
	save(image, ITEM_DIR, name)


def draw_heart(draw: ImageDraw.ImageDraw) -> None:
	draw.polygon(((8, 14), (2, 8), (2, 4), (4, 2), (7, 3), (8, 5), (9, 3), (12, 2), (14, 4), (14, 8)), fill=PURPLE)
	draw.polygon(((8, 12), (4, 7), (4, 4), (7, 5), (8, 7), (9, 5), (12, 4), (12, 7)), fill=CYAN)
	draw.line((8, 4, 8, 12), fill=GOLD)
	draw.point((5, 4), fill=WHITE)


def draw_sigil(draw: ImageDraw.ImageDraw) -> None:
	draw.ellipse((1, 1, 14, 14), fill=DARK, outline=GOLD, width=2)
	draw.polygon(((8, 2), (10, 6), (14, 8), (10, 10), (8, 14), (6, 10), (2, 8), (6, 6)), outline=CYAN)
	draw.ellipse((6, 6, 10, 10), fill=PURPLE, outline=WHITE)


def draw_staff(draw: ImageDraw.ImageDraw) -> None:
	draw.line((3, 15, 10, 5), fill="#5A3420", width=3)
	draw.line((4, 14, 11, 4), fill=GOLD)
	draw.ellipse((7, 0, 14, 7), fill=PURPLE, outline=CYAN)
	draw.polygon(((10, 0), (11, 3), (14, 4), (11, 5), (10, 8), (9, 5), (6, 4), (9, 3)), fill=WHITE)
	draw.point((10, 4), fill=BLUE)


def draw_pearl(draw: ImageDraw.ImageDraw) -> None:
	draw.ellipse((2, 2, 13, 13), fill=PURPLE, outline=CYAN, width=2)
	draw.arc((4, 4, 11, 11), 195, 340, fill=WHITE, width=2)
	draw.line((4, 11, 12, 3), fill=GOLD)
	draw.point((6, 5), fill=WHITE)


def aster_texture() -> Image.Image:
	image = Image.new("RGBA", (128, 128), DARK)
	draw = ImageDraw.Draw(image)
	for y in range(0, 128, 8):
		draw.rectangle((0, y, 127, y + 3), fill=MID if (y // 8) % 2 == 0 else PURPLE)
	for x in range(4, 128, 16):
		draw.line((x, 0, x, 127), fill=GOLD, width=2)
	for offset in range(0, 128, 32):
		draw.polygon(
			((offset + 8, 4), (offset + 12, 12), (offset + 20, 16), (offset + 12, 20), (offset + 8, 28), (offset + 4, 20), (offset, 16), (offset + 4, 12)),
			fill=CYAN,
			outline=WHITE,
		)
	draw.rectangle((0, 96, 127, 127), fill="#21163C")
	draw.line((0, 111, 127, 111), fill=BLUE, width=3)
	return image


def wisp_texture() -> Image.Image:
	image = Image.new("RGBA", (64, 32), DARK)
	draw = ImageDraw.Draw(image)
	draw.rectangle((0, 0, 63, 31), fill=MID)
	for x in range(0, 64, 8):
		draw.rectangle((x, 0, x + 3, 31), fill=PURPLE if (x // 8) % 2 else BLUE)
	draw.rectangle((0, 8, 63, 15), fill=CYAN)
	draw.line((0, 10, 63, 10), fill=WHITE, width=2)
	draw.rectangle((32, 16, 63, 31), fill=DARK)
	draw.line((32, 23, 63, 23), fill=GOLD, width=2)
	return image


def main() -> None:
	item_texture("sentinel_heart", draw_heart)
	item_texture("sundered_sigil", draw_sigil)
	item_texture("starcaller_staff", draw_staff)
	item_texture("phase_pearl", draw_pearl)
	save(aster_texture(), ENTITY_DIR, "aster")
	save(wisp_texture(), ENTITY_DIR, "star_wisp")
	print("Generated W4 Aster, Star Wisp, and item textures.")


if __name__ == "__main__":
	main()
