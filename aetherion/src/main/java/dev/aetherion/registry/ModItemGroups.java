package dev.aetherion.registry;

import dev.aetherion.Aetherion;
import net.fabricmc.fabric.api.itemgroup.v1.FabricItemGroup;
import net.minecraft.item.ItemGroup;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

public final class ModItemGroups {
	public static final RegistryKey<ItemGroup> AETHERION_KEY = RegistryKey.of(
			RegistryKeys.ITEM_GROUP,
			Identifier.of(Aetherion.MOD_ID, "aetherion")
	);

	public static final ItemGroup AETHERION = Registry.register(
			Registries.ITEM_GROUP,
			AETHERION_KEY,
			FabricItemGroup.builder()
					.icon(() -> new ItemStack(ModItems.STARSHARD))
					.displayName(Text.translatable("itemGroup.aetherion.aetherion"))
					.entries((displayContext, entries) -> {
						entries.add(ModBlocks.STARSHARD_ORE);
						entries.add(ModBlocks.DEEPSLATE_STARSHARD_ORE);
						entries.add(ModBlocks.AETHERIUM_BLOCK);
						entries.add(ModBlocks.FALLEN_STAR_CORE);
						entries.add(ModBlocks.ASTRAL_ALTAR);
						entries.add(ModBlocks.ASTRAL_PEDESTAL);
						entries.add(ModBlocks.RIFT_GATEWAY);
						entries.add(ModItems.STARSHARD);
						entries.add(ModItems.AETHERIUM_INGOT);
						entries.add(ModItems.RIFT_KEY);
						entries.add(ModItems.ASTRAL_LENS);
						entries.add(ModItems.SENTINEL_HEART);
						entries.add(ModItems.SUNDERED_SIGIL);
						entries.add(ModItems.STARCALLER_STAFF);
						entries.add(ModItems.PHASE_PEARL);
						entries.add(ModItems.ASTRAL_CODEX);
						entries.add(ModItems.AETHERIUM_SWORD);
						entries.add(ModItems.AETHERIUM_PICKAXE);
						entries.add(ModItems.AETHERIUM_AXE);
						entries.add(ModItems.AETHERIUM_SHOVEL);
						entries.add(ModItems.AETHERIUM_HOE);
						entries.add(ModItems.AETHERIUM_HELMET);
						entries.add(ModItems.AETHERIUM_CHESTPLATE);
						entries.add(ModItems.AETHERIUM_LEGGINGS);
						entries.add(ModItems.AETHERIUM_BOOTS);
					})
					.build()
	);

	private ModItemGroups() {
	}

	public static void init() {
		Aetherion.LOGGER.debug("Registering AETHERION item groups");
	}
}
