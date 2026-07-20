package dev.aetherion.registry;

import dev.aetherion.Aetherion;
import dev.aetherion.AetherionId;
import net.fabricmc.fabric.api.particle.v1.FabricParticleTypes;
import net.minecraft.particle.SimpleParticleType;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;

public final class ModParticles {
	public static final SimpleParticleType STARLIGHT_MOTE = register("starlight_mote");
	public static final SimpleParticleType RIFT_SPARK = register("rift_spark");
	public static final SimpleParticleType STELLAR_BURST = register("stellar_burst");

	private ModParticles() {
	}

	private static SimpleParticleType register(String path) {
		return Registry.register(
				Registries.PARTICLE_TYPE,
				AetherionId.of(path),
				FabricParticleTypes.simple()
		);
	}

	public static void init() {
		Aetherion.LOGGER.debug("Registering AETHERION particles");
	}
}
