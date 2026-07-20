#!/usr/bin/env python3
"""Generate the mechanical JSON resources for AETHERION's base content."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RESOURCES = ROOT / "src/main/resources"
ASSETS = RESOURCES / "assets/aetherion"
DATA = RESOURCES / "data"

BLOCKS = (
	"starshard_ore",
	"deepslate_starshard_ore",
	"aetherium_block",
	"fallen_star_core",
	"astral_altar",
	"astral_pedestal",
)
ITEMS = (
	"starshard",
	"aetherium_ingot",
	"rift_key",
	"astral_lens",
	"aetherium_sword",
	"aetherium_pickaxe",
	"aetherium_axe",
	"aetherium_shovel",
	"aetherium_hoe",
	"aetherium_helmet",
	"aetherium_chestplate",
	"aetherium_leggings",
	"aetherium_boots",
)
TOOLS = ("sword", "pickaxe", "axe", "shovel", "hoe")
ARMOR = ("helmet", "chestplate", "leggings", "boots")


def write_json(path: Path, value: object) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def block_element(start: list[int], end: list[int]) -> dict:
	return {
		"from": start,
		"to": end,
		"faces": {
			direction: {"texture": "#all"}
			for direction in ("down", "up", "north", "south", "west", "east")
		},
	}


def generate_models() -> None:
	for block in BLOCKS:
		write_json(
			ASSETS / f"blockstates/{block}.json",
			{"variants": {"": {"model": f"aetherion:block/{block}"}}},
		)

	for block in BLOCKS[:4]:
		write_json(
			ASSETS / f"models/block/{block}.json",
			{
				"parent": "minecraft:block/cube_all",
				"textures": {"all": f"aetherion:block/{block}"},
			},
		)

	write_json(
		ASSETS / "models/block/astral_altar.json",
		{
			"textures": {
				"all": "aetherion:block/astral_altar",
				"particle": "aetherion:block/astral_altar",
			},
			"elements": [
				block_element([0, 0, 0], [16, 4, 16]),
				block_element([2, 4, 2], [14, 12, 14]),
				block_element([0, 12, 0], [16, 16, 16]),
			],
		},
	)
	write_json(
		ASSETS / "models/block/astral_pedestal.json",
		{
			"textures": {
				"all": "aetherion:block/astral_pedestal",
				"particle": "aetherion:block/astral_pedestal",
			},
			"elements": [
				block_element([2, 0, 2], [14, 3, 14]),
				block_element([5, 3, 5], [11, 10, 11]),
				block_element([2, 10, 2], [14, 13, 14]),
			],
		},
	)

	for block in BLOCKS:
		write_json(ASSETS / f"models/item/{block}.json", {"parent": f"aetherion:block/{block}"})
		write_json(
			ASSETS / f"items/{block}.json",
			{"model": {"type": "minecraft:model", "model": f"aetherion:block/{block}"}},
		)

	for item in ITEMS:
		parent = "minecraft:item/handheld" if item.removeprefix("aetherium_") in TOOLS else "minecraft:item/generated"
		write_json(
			ASSETS / f"models/item/{item}.json",
			{
				"parent": parent,
				"textures": {"layer0": f"aetherion:item/{item}"},
			},
		)
		write_json(
			ASSETS / f"items/{item}.json",
			{"model": {"type": "minecraft:model", "model": f"aetherion:item/{item}"}},
		)

	write_json(
		ASSETS / "equipment/aetherium.json",
		{
			"layers": {
				"humanoid": [{"texture": "aetherion:aetherium"}],
				"humanoid_leggings": [{"texture": "aetherion:aetherium"}],
			}
		},
	)


def self_drop(block: str) -> dict:
	return {
		"type": "minecraft:block",
		"pools": [
			{
				"bonus_rolls": 0.0,
				"conditions": [{"condition": "minecraft:survives_explosion"}],
				"entries": [{"type": "minecraft:item", "name": f"aetherion:{block}"}],
				"rolls": 1.0,
			}
		],
		"random_sequence": f"aetherion:blocks/{block}",
	}


def ore_drop(block: str) -> dict:
	return {
		"type": "minecraft:block",
		"pools": [
			{
				"bonus_rolls": 0.0,
				"entries": [
					{
						"type": "minecraft:alternatives",
						"children": [
							{
								"type": "minecraft:item",
								"conditions": [
									{
										"condition": "minecraft:match_tool",
										"predicate": {
											"predicates": {
												"minecraft:enchantments": [
													{
														"enchantments": "minecraft:silk_touch",
														"levels": {"min": 1},
													}
												]
											}
										},
									}
								],
								"name": f"aetherion:{block}",
							},
							{
								"type": "minecraft:item",
								"functions": [
									{
										"enchantment": "minecraft:fortune",
										"formula": "minecraft:ore_drops",
										"function": "minecraft:apply_bonus",
									},
									{"function": "minecraft:explosion_decay"},
								],
								"name": "aetherion:starshard",
							},
						],
					}
				],
				"rolls": 1.0,
			}
		],
		"random_sequence": f"aetherion:blocks/{block}",
	}


def shaped(pattern: list[str], key: dict[str, str], result: str, count: int = 1, category: str = "equipment") -> dict:
	return {
		"type": "minecraft:crafting_shaped",
		"category": category,
		"key": key,
		"pattern": pattern,
		"result": {"count": count, "id": result},
	}


def generate_data() -> None:
	for block in BLOCKS:
		table = ore_drop(block) if block.endswith("starshard_ore") else self_drop(block)
		write_json(DATA / f"aetherion/loot_table/blocks/{block}.json", table)

	material_key = {"#": "minecraft:stick", "X": "aetherion:aetherium_ingot"}
	tool_patterns = {
		"sword": ["X", "X", "#"],
		"pickaxe": ["XXX", " # ", " # "],
		"axe": ["XX", "X#", " #"],
		"shovel": ["X", "#", "#"],
		"hoe": ["XX", " #", " #"],
	}
	for tool, pattern in tool_patterns.items():
		write_json(
			DATA / f"aetherion/recipe/aetherium_{tool}.json",
			shaped(pattern, material_key, f"aetherion:aetherium_{tool}"),
		)

	armor_patterns = {
		"helmet": ["XXX", "X X"],
		"chestplate": ["X X", "XXX", "XXX"],
		"leggings": ["XXX", "X X", "X X"],
		"boots": ["X X", "X X"],
	}
	for armor, pattern in armor_patterns.items():
		write_json(
			DATA / f"aetherion/recipe/aetherium_{armor}.json",
			shaped(
				pattern,
				{"X": "aetherion:aetherium_ingot"},
				f"aetherion:aetherium_{armor}",
			),
		)

	write_json(
		DATA / "aetherion/recipe/aetherium_block.json",
		shaped(
			["###", "###", "###"],
			{"#": "aetherion:aetherium_ingot"},
			"aetherion:aetherium_block",
			category="building",
		),
	)
	write_json(
		DATA / "aetherion/recipe/aetherium_ingot_from_block.json",
		{
			"type": "minecraft:crafting_shapeless",
			"category": "misc",
			"ingredients": ["aetherion:aetherium_block"],
			"result": {"count": 9, "id": "aetherion:aetherium_ingot"},
		},
	)
	for method, cooking_time in (("smelting", 200), ("blasting", 100)):
		write_json(
			DATA / f"aetherion/recipe/aetherium_ingot_from_{method}_starshard.json",
			{
				"type": f"minecraft:{method}",
				"category": "misc",
				"cookingtime": cooking_time,
				"experience": 1.0,
				"group": "aetherium_ingot",
				"ingredient": "aetherion:starshard",
				"result": {"id": "aetherion:aetherium_ingot"},
			},
		)
	write_json(
		DATA / "aetherion/recipe/astral_altar.json",
		shaped(
			["SAS", "GOG", "DDD"],
			{
				"S": "aetherion:starshard",
				"A": "minecraft:amethyst_block",
				"G": "minecraft:gold_ingot",
				"O": "minecraft:obsidian",
				"D": "minecraft:deepslate_tiles",
			},
			"aetherion:astral_altar",
			category="building",
		),
	)
	write_json(
		DATA / "aetherion/recipe/astral_pedestal.json",
		shaped(
			[" S ", "ABA", "DDD"],
			{
				"S": "aetherion:starshard",
				"A": "minecraft:amethyst_shard",
				"B": "minecraft:amethyst_block",
				"D": "minecraft:polished_deepslate",
			},
			"aetherion:astral_pedestal",
			category="building",
		),
	)

	write_json(
		DATA / "aetherion/tags/block/incorrect_for_aetherium_tool.json",
		{"values": []},
	)
	write_json(
		DATA / "aetherion/tags/item/aetherium_repair_materials.json",
		{"values": ["aetherion:aetherium_ingot"]},
	)
	write_json(
		DATA / "minecraft/tags/block/mineable/pickaxe.json",
		{"values": [f"aetherion:{block}" for block in BLOCKS]},
	)
	write_json(
		DATA / "minecraft/tags/block/needs_iron_tool.json",
		{
			"values": [
				"aetherion:starshard_ore",
				"aetherion:deepslate_starshard_ore",
				"aetherion:astral_altar",
				"aetherion:astral_pedestal",
			]
		},
	)
	write_json(
		DATA / "minecraft/tags/block/needs_diamond_tool.json",
		{"values": ["aetherion:aetherium_block", "aetherion:fallen_star_core"]},
	)
	write_json(
		DATA / "c/tags/item/ingots/aetherium.json",
		{"values": ["aetherion:aetherium_ingot"]},
	)
	write_json(
		DATA / "c/tags/item/gems/starshard.json",
		{"values": ["aetherion:starshard"]},
	)

	write_json(
		DATA / "aetherion/worldgen/configured_feature/starshard_ore.json",
		{
			"type": "minecraft:ore",
			"config": {
				"discard_chance_on_air_exposure": 0.15,
				"size": 7,
				"targets": [
					{
						"state": {"Name": "aetherion:starshard_ore"},
						"target": {
							"predicate_type": "minecraft:tag_match",
							"tag": "minecraft:stone_ore_replaceables",
						},
					},
					{
						"state": {"Name": "aetherion:deepslate_starshard_ore"},
						"target": {
							"predicate_type": "minecraft:tag_match",
							"tag": "minecraft:deepslate_ore_replaceables",
						},
					},
				],
			},
		},
	)
	write_json(
		DATA / "aetherion/worldgen/placed_feature/starshard_ore.json",
		{
			"feature": "aetherion:starshard_ore",
			"placement": [
				{"type": "minecraft:count", "count": 5},
				{"type": "minecraft:in_square"},
				{
					"type": "minecraft:height_range",
					"height": {
						"type": "minecraft:uniform",
						"max_inclusive": {"absolute": 48},
						"min_inclusive": {"absolute": -48},
					},
				},
				{"type": "minecraft:biome"},
			],
		},
	)


def generate_language() -> None:
	write_json(
		ASSETS / "lang/en_us.json",
		{
			"itemGroup.aetherion.aetherion": "Aetherion",
			"block.aetherion.starshard_ore": "Starshard Ore",
			"block.aetherion.deepslate_starshard_ore": "Deepslate Starshard Ore",
			"block.aetherion.aetherium_block": "Block of Aetherium",
			"block.aetherion.fallen_star_core": "Fallen Star Core",
			"block.aetherion.astral_altar": "Astral Altar",
			"block.aetherion.astral_pedestal": "Astral Pedestal",
			"item.aetherion.starshard": "Starshard",
			"item.aetherion.aetherium_ingot": "Aetherium Ingot",
			"item.aetherion.rift_key": "Rift Key",
			"item.aetherion.astral_lens": "Astral Lens",
			"item.aetherion.aetherium_sword": "Aetherium Sword",
			"item.aetherion.aetherium_pickaxe": "Aetherium Pickaxe",
			"item.aetherion.aetherium_axe": "Aetherium Axe",
			"item.aetherion.aetherium_shovel": "Aetherium Shovel",
			"item.aetherion.aetherium_hoe": "Aetherium Hoe",
			"item.aetherion.aetherium_helmet": "Aetherium Helmet",
			"item.aetherion.aetherium_chestplate": "Aetherium Chestplate",
			"item.aetherion.aetherium_leggings": "Aetherium Leggings",
			"item.aetherion.aetherium_boots": "Aetherium Boots",
			"tag.item.aetherion.aetherium_repair_materials": "Aetherium Repair Materials",
			"tag.item.c.ingots.aetherium": "Aetherium Ingots",
			"tag.item.c.gems.starshard": "Starshards",
		},
	)


def main() -> None:
	generate_models()
	generate_data()
	generate_language()
	print("Generated AETHERION models, item definitions, recipes, loot tables, tags, and worldgen.")


if __name__ == "__main__":
	main()
