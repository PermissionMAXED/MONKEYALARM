package dev.aetherion.worldgen;

import dev.aetherion.AetherionId;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.world.World;
import net.minecraft.world.dimension.DimensionType;

public final class ModDimensions {
	public static final RegistryKey<World> THE_EXPANSE = RegistryKey.of(
			RegistryKeys.WORLD,
			AetherionId.of("the_expanse")
	);
	public static final RegistryKey<DimensionType> THE_EXPANSE_TYPE = RegistryKey.of(
			RegistryKeys.DIMENSION_TYPE,
			AetherionId.of("the_expanse")
	);

	private ModDimensions() {
	}
}
