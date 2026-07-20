package dev.aetherion.worldgen;

import dev.aetherion.Aetherion;
import dev.aetherion.AetherionId;
import net.fabricmc.fabric.api.biome.v1.BiomeModifications;
import net.fabricmc.fabric.api.biome.v1.BiomeSelectors;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.world.gen.GenerationStep;
import net.minecraft.world.gen.feature.PlacedFeature;

public final class OreGeneration {
	public static final RegistryKey<PlacedFeature> STARSHARD_ORE_PLACED_KEY = RegistryKey.of(
			RegistryKeys.PLACED_FEATURE,
			AetherionId.of("starshard_ore")
	);

	private OreGeneration() {
	}

	public static void init() {
		BiomeModifications.addFeature(
				BiomeSelectors.foundInOverworld(),
				GenerationStep.Feature.UNDERGROUND_ORES,
				STARSHARD_ORE_PLACED_KEY
		);
		Aetherion.LOGGER.debug("Added Starshard ore generation to Overworld biomes");
	}
}
