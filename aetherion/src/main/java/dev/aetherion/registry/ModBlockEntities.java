package dev.aetherion.registry;

import dev.aetherion.Aetherion;
import dev.aetherion.AetherionId;
import dev.aetherion.block.AstralAltarBlockEntity;
import dev.aetherion.block.AstralPedestalBlockEntity;
import net.fabricmc.fabric.api.object.builder.v1.block.entity.FabricBlockEntityTypeBuilder;
import net.minecraft.block.entity.BlockEntityType;
import net.minecraft.registry.Registries;
import net.minecraft.registry.Registry;

public final class ModBlockEntities {
	public static final BlockEntityType<AstralAltarBlockEntity> ASTRAL_ALTAR = Registry.register(
			Registries.BLOCK_ENTITY_TYPE,
			AetherionId.of("astral_altar"),
			FabricBlockEntityTypeBuilder.create(
					AstralAltarBlockEntity::new,
					ModBlocks.ASTRAL_ALTAR
			).build()
	);
	public static final BlockEntityType<AstralPedestalBlockEntity> ASTRAL_PEDESTAL = Registry.register(
			Registries.BLOCK_ENTITY_TYPE,
			AetherionId.of("astral_pedestal"),
			FabricBlockEntityTypeBuilder.create(
					AstralPedestalBlockEntity::new,
					ModBlocks.ASTRAL_PEDESTAL
			).build()
	);

	private ModBlockEntities() {
	}

	public static void init() {
		Aetherion.LOGGER.debug("Registering AETHERION block entities");
	}
}
