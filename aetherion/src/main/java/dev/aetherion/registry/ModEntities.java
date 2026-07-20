package dev.aetherion.registry;

import dev.aetherion.Aetherion;
import dev.aetherion.entity.AsterEntity;
import dev.aetherion.entity.StarBoltEntity;
import dev.aetherion.entity.StarWispEntity;
import net.fabricmc.fabric.api.object.builder.v1.entity.FabricDefaultAttributeRegistry;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnGroup;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;
import net.minecraft.registry.RegistryKey;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.util.Identifier;

public final class ModEntities {
	public static final EntityType<AsterEntity> ASTER = register(
			"aster",
			AsterEntity::new,
			SpawnGroup.MONSTER,
			1.45F,
			3.6F,
			10,
			3
	);
	public static final EntityType<StarWispEntity> STAR_WISP = register(
			"star_wisp",
			StarWispEntity::new,
			SpawnGroup.MONSTER,
			0.8F,
			0.8F,
			8,
			2
	);
	public static final EntityType<StarBoltEntity> STAR_BOLT = register(
			"star_bolt",
			StarBoltEntity::new,
			SpawnGroup.MISC,
			0.35F,
			0.35F,
			8,
			1
	);

	private ModEntities() {
	}

	private static <T extends Entity> EntityType<T> register(
			String name,
			EntityType.EntityFactory<T> factory,
			SpawnGroup spawnGroup,
			float width,
			float height,
			int trackingRange,
			int trackingInterval
	) {
		Identifier id = Identifier.of(Aetherion.MOD_ID, name);
		RegistryKey<EntityType<?>> key = RegistryKey.of(RegistryKeys.ENTITY_TYPE, id);
		EntityType<T> type = EntityType.Builder.create(factory, spawnGroup)
				.dimensions(width, height)
				.maxTrackingRange(trackingRange)
				.trackingTickInterval(trackingInterval)
				.build(key);
		return Registry.register(Registries.ENTITY_TYPE, key, type);
	}

	public static void init() {
		FabricDefaultAttributeRegistry.register(ASTER, AsterEntity.createAttributes());
		FabricDefaultAttributeRegistry.register(STAR_WISP, StarWispEntity.createAttributes());
		Aetherion.LOGGER.debug("Registering AETHERION entities");
	}
}
