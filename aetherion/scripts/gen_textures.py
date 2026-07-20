#!/usr/bin/env python3
"""Generate AETHERION's deterministic pixel-art textures with Pillow."""

from __future__ import annotations

import random
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
BLOCK_DIR = ROOT / "src/main/resources/assets/aetherion/textures/block"
ITEM_DIR = ROOT / "src/main/resources/assets/aetherion/textures/item"
HUMANOID_DIR = ROOT / "src/main/resources/assets/aetherion/textures/entity/equipment/humanoid"
LEGGINGS_DIR = ROOT / "src/main/resources/assets/aetherion/textures/entity/equipment/humanoid_leggings"

GOLD = "#F5C542"
CYAN = "#33E0FF"
VIOLET = "#8B5CF6"
DARK = "#171329"
STONE = "#696676"
DEEPSLATE = "#34323E"
TRANSPARENT = (0, 0, 0, 0)


def rgb(hex_color: str) -> tuple[int, int, int, int]:
	return (*ImageColor.getrgb(hex_color), 255)


# Import after defining rgb so the palette remains easy to audit above.
from PIL import ImageColor  # noqa: E402


def canvas(size: tuple[int, int] = (16, 16), color=TRANSPARENT) -> Image.Image:
	return Image.new("RGBA", size, color)


def save(image: Image.Image, directory: Path, name: str) -> None:
	directory.mkdir(parents=True, exist_ok=True)
	image.save(directory / f"{name}.png")


def noisy_stone(base: str, seed: int) -> Image.Image:
	rng = random.Random(seed)
	image = canvas(color=rgb(base))
	pixels = image.load()
	for y in range(16):
		for x in range(16):
			jitter = rng.choice((-13, -8, -4, 0, 0, 4, 8, 13))
			r, g, b, _ = pixels[x, y]
			pixels[x, y] = (
				max(0, min(255, r + jitter)),
				max(0, min(255, g + jitter)),
				max(0, min(255, b + jitter)),
				255,
			)
	return image


def ore_texture(base: str, seed: int) -> Image.Image:
	image = noisy_stone(base, seed)
	draw = ImageDraw.Draw(image)
	clusters = ((2, 3), (10, 2), (6, 8), (12, 11), (2, 13))
	for index, (x, y) in enumerate(clusters):
		color = (GOLD, CYAN, VIOLET)[index % 3]
		draw.point((x, y), fill=color)
		draw.point((x + 1, y), fill=color)
		draw.point((x, y + 1), fill=color)
		if index % 2 == 0:
			draw.point((x + 1, y - 1), fill="#FFF2A8")
	return image


def rune_block(name: str, base: str, symbol: str) -> None:
	image = noisy_stone(base, sum((index + 1) * ord(char) for index, char in enumerate(name)))
	draw = ImageDraw.Draw(image)
	draw.rectangle((0, 0, 15, 15), outline=VIOLET)
	draw.rectangle((2, 2, 13, 13), outline=GOLD)
	if symbol == "star":
		draw.line((8, 2, 8, 13), fill=CYAN, width=1)
		draw.line((2, 8, 13, 8), fill=CYAN, width=1)
		draw.line((4, 4, 12, 12), fill=VIOLET, width=1)
		draw.line((12, 4, 4, 12), fill=VIOLET, width=1)
	else:
		draw.ellipse((5, 5, 10, 10), outline=CYAN)
		draw.point((7, 7), fill=GOLD)
		draw.point((8, 8), fill=GOLD)
	save(image, BLOCK_DIR, name)


def generated_item(name: str, draw_fn) -> None:
	image = canvas()
	draw_fn(ImageDraw.Draw(image))
	save(image, ITEM_DIR, name)


def draw_gem(draw: ImageDraw.ImageDraw) -> None:
	draw.polygon(((7, 1), (12, 5), (10, 12), (6, 15), (2, 10), (3, 4)), fill=VIOLET)
	draw.polygon(((7, 2), (10, 5), (8, 12), (5, 10), (4, 5)), fill=CYAN)
	draw.line((4, 5, 10, 5), fill=GOLD)
	draw.point((6, 3), fill="#FFFFFF")


def draw_ingot(draw: ImageDraw.ImageDraw) -> None:
	draw.polygon(((3, 5), (11, 3), (14, 7), (12, 11), (4, 12), (1, 9)), fill=VIOLET)
	draw.polygon(((4, 5), (11, 4), (12, 7), (4, 9), (2, 8)), fill=CYAN)
	draw.line((4, 10, 12, 8), fill=GOLD, width=2)


def draw_key(draw: ImageDraw.ImageDraw) -> None:
	draw.ellipse((1, 1, 9, 9), fill=GOLD, outline=CYAN)
	draw.ellipse((4, 4, 7, 7), fill=TRANSPARENT)
	draw.line((8, 8, 14, 14), fill=VIOLET, width=3)
	draw.line((11, 12, 14, 9), fill=GOLD, width=2)


def draw_lens(draw: ImageDraw.ImageDraw) -> None:
	draw.ellipse((2, 1, 13, 12), fill=VIOLET, outline=GOLD, width=2)
	draw.ellipse((5, 4, 10, 9), fill=CYAN)
	draw.line((10, 11, 14, 15), fill=GOLD, width=2)
	draw.point((7, 5), fill="#FFFFFF")


def draw_codex(draw: ImageDraw.ImageDraw) -> None:
	draw.rounded_rectangle((2, 1, 13, 14), radius=2, fill=DARK, outline=GOLD)
	draw.line((4, 2, 4, 13), fill=VIOLET, width=2)
	draw.line((7, 5, 11, 5), fill=CYAN)
	draw.line((9, 3, 9, 7), fill=CYAN)
	draw.point((9, 5), fill="#FFFFFF")
	draw.line((7, 10, 11, 10), fill=VIOLET)
	draw.line((7, 12, 10, 12), fill=VIOLET)


def draw_tool(draw: ImageDraw.ImageDraw, kind: str) -> None:
	draw.line((3, 14, 11, 6), fill="#5C3A21", width=3)
	draw.line((4, 13, 11, 6), fill=GOLD)
	if kind == "sword":
		draw.polygon(((5, 11), (10, 1), (13, 0), (12, 4), (7, 12)), fill=CYAN)
		draw.line((7, 11, 11, 3), fill="#FFFFFF")
		draw.line((3, 10, 8, 15), fill=VIOLET, width=2)
	elif kind == "pickaxe":
		draw.polygon(((3, 3), (8, 1), (14, 3), (13, 5), (8, 3), (4, 6)), fill=CYAN)
		draw.line((4, 4, 12, 3), fill=GOLD)
	elif kind == "axe":
		draw.polygon(((7, 2), (13, 2), (14, 7), (10, 10), (7, 7)), fill=VIOLET)
		draw.line((9, 3, 13, 3), fill=CYAN, width=2)
	elif kind == "shovel":
		draw.polygon(((9, 1), (13, 2), (14, 6), (11, 9), (7, 5)), fill=CYAN)
		draw.line((10, 2, 12, 4), fill=GOLD)
	elif kind == "hoe":
		draw.polygon(((7, 2), (14, 2), (14, 5), (9, 6), (7, 5)), fill=VIOLET)
		draw.line((9, 3, 13, 3), fill=CYAN)


def draw_armor(draw: ImageDraw.ImageDraw, kind: str) -> None:
	if kind == "helmet":
		draw.polygon(((3, 4), (5, 1), (11, 1), (14, 5), (13, 12), (10, 12), (10, 8), (6, 8), (6, 12), (3, 11)), fill=VIOLET)
	elif kind == "chestplate":
		draw.polygon(((3, 2), (6, 1), (8, 4), (10, 1), (13, 2), (15, 8), (12, 10), (11, 15), (5, 15), (4, 10), (1, 8)), fill=VIOLET)
	elif kind == "leggings":
		draw.polygon(((3, 1), (13, 1), (12, 8), (10, 15), (7, 15), (7, 8), (6, 15), (3, 15), (4, 8)), fill=VIOLET)
	else:
		draw.polygon(((3, 4), (7, 4), (7, 12), (5, 15), (1, 15), (2, 10)), fill=VIOLET)
		draw.polygon(((9, 4), (13, 4), (14, 10), (15, 15), (11, 15), (9, 12)), fill=VIOLET)
	draw.line((4, 4, 12, 4), fill=CYAN, width=2)
	draw.line((5, 6, 10, 11), fill=GOLD)


def equipment_texture(leggings: bool) -> Image.Image:
	image = canvas((64, 32), rgb(VIOLET))
	draw = ImageDraw.Draw(image)
	for y in range(0, 32, 4):
		draw.line((0, y, 63, y), fill=CYAN if (y // 4) % 2 == 0 else DARK)
	for x in range(2, 64, 8):
		draw.line((x, 0, x, 31), fill=GOLD)
	if leggings:
		draw.rectangle((16, 16, 47, 31), outline=CYAN, width=2)
	else:
		draw.rectangle((0, 0, 31, 15), outline=GOLD, width=2)
	return image


def main() -> None:
	save(ore_texture(STONE, 11), BLOCK_DIR, "starshard_ore")
	save(ore_texture(DEEPSLATE, 29), BLOCK_DIR, "deepslate_starshard_ore")
	rune_block("aetherium_block", DARK, "ring")
	rune_block("fallen_star_core", DARK, "star")
	rune_block("astral_altar", DEEPSLATE, "star")
	rune_block("astral_pedestal", DEEPSLATE, "ring")
	rune_block("rift_gateway", DARK, "ring")

	generated_item("starshard", draw_gem)
	generated_item("aetherium_ingot", draw_ingot)
	generated_item("rift_key", draw_key)
	generated_item("astral_lens", draw_lens)
	generated_item("astral_codex", draw_codex)
	for tool in ("sword", "pickaxe", "axe", "shovel", "hoe"):
		generated_item(f"aetherium_{tool}", lambda draw, tool=tool: draw_tool(draw, tool))
	for armor in ("helmet", "chestplate", "leggings", "boots"):
		generated_item(f"aetherium_{armor}", lambda draw, armor=armor: draw_armor(draw, armor))

	save(equipment_texture(False), HUMANOID_DIR, "aetherium")
	save(equipment_texture(True), LEGGINGS_DIR, "aetherium")
	print("Generated AETHERION block, item, and equipment textures.")


if __name__ == "__main__":
	main()
