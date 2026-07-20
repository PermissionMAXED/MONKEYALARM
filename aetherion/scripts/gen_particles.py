#!/usr/bin/env python3
"""Generate AETHERION's deterministic particle textures with Pillow."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PARTICLE_DIR = ROOT / "src/main/resources/assets/aetherion/textures/particle"

GOLD = "#F5C542"
CYAN = "#33E0FF"
VIOLET = "#8B5CF6"
WHITE = "#FFFFFF"
TRANSPARENT = (0, 0, 0, 0)


def canvas() -> Image.Image:
	return Image.new("RGBA", (16, 16), TRANSPARENT)


def save(image: Image.Image, name: str) -> None:
	PARTICLE_DIR.mkdir(parents=True, exist_ok=True)
	image.save(PARTICLE_DIR / f"{name}.png")


def starlight_mote() -> Image.Image:
	image = canvas()
	draw = ImageDraw.Draw(image)
	draw.rectangle((7, 3, 8, 12), fill=GOLD)
	draw.rectangle((3, 7, 12, 8), fill=GOLD)
	draw.rectangle((5, 5, 10, 10), fill=CYAN)
	draw.rectangle((7, 7, 8, 8), fill=WHITE)
	draw.point((4, 4), fill=VIOLET)
	draw.point((11, 11), fill=VIOLET)
	return image


def rift_spark() -> Image.Image:
	image = canvas()
	draw = ImageDraw.Draw(image)
	draw.line((3, 13, 7, 8, 6, 8, 12, 2), fill=VIOLET, width=2)
	draw.line((4, 13, 8, 8, 7, 8, 12, 3), fill=CYAN)
	draw.point((11, 2), fill=WHITE)
	draw.point((2, 14), fill=GOLD)
	return image


def stellar_burst() -> Image.Image:
	image = canvas()
	draw = ImageDraw.Draw(image)
	for line, color in (
			((7, 0, 8, 15), GOLD),
			((0, 7, 15, 8), GOLD),
			((2, 2, 13, 13), VIOLET),
			((13, 2, 2, 13), CYAN),
	):
		draw.line(line, fill=color, width=2)
	draw.ellipse((4, 4, 11, 11), fill=VIOLET, outline=CYAN)
	draw.rectangle((6, 6, 9, 9), fill=WHITE)
	return image


def main() -> None:
	save(starlight_mote(), "starlight_mote")
	save(rift_spark(), "rift_spark")
	save(stellar_burst(), "stellar_burst")
	print("Generated AETHERION particle textures.")


if __name__ == "__main__":
	main()
