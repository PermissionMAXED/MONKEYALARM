package dev.aetherion.registry;

import dev.aetherion.Aetherion;
import dev.aetherion.item.PhasePearlItem;
import dev.aetherion.item.StarcallerStaffItem;
import dev.aetherion.item.SunderedSigilItem;
import java.util.Map;
import java.util.function.Function;
import net.minecraft.block.Block;
import net.minecraft.item.Item;
import net.minecraft.item.ToolMaterial;
import net.minecraft.item.equipment.ArmorMaterial;
import net.minecraft.item.equipment.EquipmentAsset;
import net.minecraft.item.equipment.EquipmentAssetKeys;
import net.minecraft.item.equipment.EquipmentType;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.tag.TagKey;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Identifier;

public final class ModItems {
	public static final TagKey<Block> INCORRECT_FOR_AETHERIUM_TOOL = TagKey.of(
			RegistryKeys.BLOCK,
			Identifier.of(Aetherion.MOD_ID, "incorrect_for_aetherium_tool")
	);
	public static final TagKey<Item> AETHERIUM_REPAIR_MATERIALS = TagKey.of(
			RegistryKeys.ITEM,
			Identifier.of(Aetherion.MOD_ID, "aetherium_repair_materials")
	);
	public static final RegistryKey<EquipmentAsset> AETHERIUM_EQUIPMENT_ASSET = RegistryKey.of(
			EquipmentAssetKeys.REGISTRY_KEY,
			Identifier.of(Aetherion.MOD_ID, "aetherium")
	);

	public static final ToolMaterial AETHERIUM_TOOL_MATERIAL = new ToolMaterial(
			INCORRECT_FOR_AETHERIUM_TOOL,
			2031,
			9.5F,
			4.0F,
			18,
			AETHERIUM_REPAIR_MATERIALS
	);
	public static final ArmorMaterial AETHERIUM_ARMOR_MATERIAL = new ArmorMaterial(
			40,
			Map.of(
					EquipmentType.BOOTS, 3,
					EquipmentType.LEGGINGS, 6,
					EquipmentType.CHESTPLATE, 8,
					EquipmentType.HELMET, 3,
					EquipmentType.BODY, 11
			),
			18,
			SoundEvents.ITEM_ARMOR_EQUIP_NETHERITE,
			3.0F,
			0.1F,
			AETHERIUM_REPAIR_MATERIALS,
			AETHERIUM_EQUIPMENT_ASSET
	);

	public static final Item STARSHARD = register("starshard", Item::new, new Item.Settings());
	public static final Item AETHERIUM_INGOT = register("aetherium_ingot", Item::new, new Item.Settings().fireproof());
	public static final Item RIFT_KEY = register("rift_key", Item::new, new Item.Settings().maxCount(1).fireproof());
	public static final Item ASTRAL_LENS = register("astral_lens", Item::new, new Item.Settings().maxCount(16));
	public static final Item SENTINEL_HEART = register(
			"sentinel_heart",
			Item::new,
			new Item.Settings().maxCount(16).fireproof()
	);
	public static final SunderedSigilItem SUNDERED_SIGIL = register(
			"sundered_sigil",
			SunderedSigilItem::new,
			new Item.Settings().maxCount(1).fireproof()
	);
	public static final StarcallerStaffItem STARCALLER_STAFF = register(
			"starcaller_staff",
			StarcallerStaffItem::new,
			new Item.Settings().maxCount(1).fireproof()
	);
	public static final PhasePearlItem PHASE_PEARL = register(
			"phase_pearl",
			PhasePearlItem::new,
			new Item.Settings().maxCount(1)
	);
	public static final Item ASTRAL_CODEX = register(
			"astral_codex",
			Item::new,
			new Item.Settings().maxCount(1)
	);

	public static final Item AETHERIUM_SWORD = register(
			"aetherium_sword",
			Item::new,
			new Item.Settings().sword(AETHERIUM_TOOL_MATERIAL, 3.0F, -2.4F).fireproof()
	);
	public static final Item AETHERIUM_PICKAXE = register(
			"aetherium_pickaxe",
			Item::new,
			new Item.Settings().pickaxe(AETHERIUM_TOOL_MATERIAL, 1.0F, -2.8F).fireproof()
	);
	public static final Item AETHERIUM_AXE = register(
			"aetherium_axe",
			Item::new,
			new Item.Settings().axe(AETHERIUM_TOOL_MATERIAL, 5.0F, -3.0F).fireproof()
	);
	public static final Item AETHERIUM_SHOVEL = register(
			"aetherium_shovel",
			Item::new,
			new Item.Settings().shovel(AETHERIUM_TOOL_MATERIAL, 1.5F, -3.0F).fireproof()
	);
	public static final Item AETHERIUM_HOE = register(
			"aetherium_hoe",
			Item::new,
			new Item.Settings().hoe(AETHERIUM_TOOL_MATERIAL, -4.0F, 0.0F).fireproof()
	);

	public static final Item AETHERIUM_HELMET = register(
			"aetherium_helmet",
			Item::new,
			new Item.Settings().armor(AETHERIUM_ARMOR_MATERIAL, EquipmentType.HELMET).fireproof()
	);
	public static final Item AETHERIUM_CHESTPLATE = register(
			"aetherium_chestplate",
			Item::new,
			new Item.Settings().armor(AETHERIUM_ARMOR_MATERIAL, EquipmentType.CHESTPLATE).fireproof()
	);
	public static final Item AETHERIUM_LEGGINGS = register(
			"aetherium_leggings",
			Item::new,
			new Item.Settings().armor(AETHERIUM_ARMOR_MATERIAL, EquipmentType.LEGGINGS).fireproof()
	);
	public static final Item AETHERIUM_BOOTS = register(
			"aetherium_boots",
			Item::new,
			new Item.Settings().armor(AETHERIUM_ARMOR_MATERIAL, EquipmentType.BOOTS).fireproof()
	);

	private ModItems() {
	}

	private static <T extends Item> T register(
			String name,
			Function<Item.Settings, T> factory,
			Item.Settings settings
	) {
		Identifier id = Identifier.of(Aetherion.MOD_ID, name);
		RegistryKey<Item> key = RegistryKey.of(RegistryKeys.ITEM, id);
		T item = factory.apply(settings.registryKey(key));
		return Registry.register(Registries.ITEM, key, item);
	}

	public static void init() {
		Aetherion.LOGGER.debug("Registering AETHERION items");
	}
}
