package com.bubbleshield.registry;

import java.util.function.Supplier;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.block.BubbleShieldBlockEntity;

import net.minecraft.core.registries.Registries;
import net.minecraft.world.level.block.entity.BlockEntityType;

import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModBlockEntities {
	public static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITY_TYPES =
		DeferredRegister.create(Registries.BLOCK_ENTITY_TYPE, BubbleShield.MOD_ID);

	public static final Supplier<BlockEntityType<BubbleShieldBlockEntity>> BUBBLE_SHIELD_PROJECTOR =
		BLOCK_ENTITY_TYPES.register("bubble_shield_projector",
			() -> BlockEntityType.Builder.of(BubbleShieldBlockEntity::new, ModBlocks.BUBBLE_SHIELD_PROJECTOR.get()).build(null));

	private ModBlockEntities() {
	}
}
