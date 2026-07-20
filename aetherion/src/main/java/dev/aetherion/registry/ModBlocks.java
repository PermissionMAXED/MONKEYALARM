package dev.aetherion.registry;

import dev.aetherion.Aetherion;
import dev.aetherion.block.AstralAltarBlock;
import dev.aetherion.block.AstralPedestalBlock;
import dev.aetherion.block.RiftGatewayBlock;
import java.util.function.Function;
import net.minecraft.block.AbstractBlock;
import net.minecraft.block.Block;
import net.minecraft.block.ExperienceDroppingBlock;
import net.minecraft.item.BlockItem;
import net.minecraft.item.Item;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.sound.BlockSoundGroup;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.intprovider.UniformIntProvider;

public final class ModBlocks {
	public static final Block STARSHARD_ORE = register(
			"starshard_ore",
			settings -> new ExperienceDroppingBlock(UniformIntProvider.create(3, 7), settings),
			AbstractBlock.Settings.create()
					.strength(3.0F, 3.0F)
					.requiresTool()
					.sounds(BlockSoundGroup.STONE)
					.luminance(state -> 4)
	);
	public static final Block DEEPSLATE_STARSHARD_ORE = register(
			"deepslate_starshard_ore",
			settings -> new ExperienceDroppingBlock(UniformIntProvider.create(4, 9), settings),
			AbstractBlock.Settings.create()
					.strength(4.5F, 3.0F)
					.requiresTool()
					.sounds(BlockSoundGroup.DEEPSLATE)
					.luminance(state -> 4)
	);
	public static final Block AETHERIUM_BLOCK = register(
			"aetherium_block",
			Block::new,
			AbstractBlock.Settings.create()
					.strength(5.0F, 8.0F)
					.requiresTool()
					.sounds(BlockSoundGroup.METAL)
	);
	public static final Block FALLEN_STAR_CORE = register(
			"fallen_star_core",
			Block::new,
			AbstractBlock.Settings.create()
					.strength(5.0F, 12.0F)
					.requiresTool()
					.sounds(BlockSoundGroup.AMETHYST_BLOCK)
					.luminance(state -> 12)
	);
	public static final AstralAltarBlock ASTRAL_ALTAR = register(
			"astral_altar",
			AstralAltarBlock::new,
			AbstractBlock.Settings.create()
					.strength(4.0F, 8.0F)
					.requiresTool()
					.sounds(BlockSoundGroup.AMETHYST_BLOCK)
					.luminance(state -> 7)
					.nonOpaque()
	);
	public static final AstralPedestalBlock ASTRAL_PEDESTAL = register(
			"astral_pedestal",
			AstralPedestalBlock::new,
			AbstractBlock.Settings.create()
					.strength(3.0F, 6.0F)
					.requiresTool()
					.sounds(BlockSoundGroup.DEEPSLATE_TILES)
					.luminance(state -> 3)
					.nonOpaque()
	);
	public static final RiftGatewayBlock RIFT_GATEWAY = register(
			"rift_gateway",
			RiftGatewayBlock::new,
			AbstractBlock.Settings.create()
					.strength(3.0F, 12.0F)
					.requiresTool()
					.sounds(BlockSoundGroup.AMETHYST_BLOCK)
					.luminance(state -> 11)
					.nonOpaque()
					.noCollision()
	);

	private ModBlocks() {
	}

	private static <T extends Block> T register(
			String name,
			Function<AbstractBlock.Settings, T> factory,
			AbstractBlock.Settings settings
	) {
		Identifier id = Identifier.of(Aetherion.MOD_ID, name);
		RegistryKey<Block> blockKey = RegistryKey.of(RegistryKeys.BLOCK, id);
		T block = factory.apply(settings.registryKey(blockKey));
		Registry.register(Registries.BLOCK, blockKey, block);

		RegistryKey<Item> itemKey = RegistryKey.of(RegistryKeys.ITEM, id);
		BlockItem blockItem = new BlockItem(
				block,
				new Item.Settings().registryKey(itemKey).useBlockPrefixedTranslationKey()
		);
		Registry.register(Registries.ITEM, itemKey, blockItem);
		return block;
	}

	public static void init() {
		Aetherion.LOGGER.debug("Registering AETHERION blocks");
	}
}
