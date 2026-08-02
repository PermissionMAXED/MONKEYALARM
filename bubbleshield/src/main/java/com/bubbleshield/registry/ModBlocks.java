package com.bubbleshield.registry;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.block.BubbleShieldBlock;

import net.minecraft.world.level.block.state.BlockBehaviour;

import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModBlocks {
	public static final DeferredRegister.Blocks BLOCKS = DeferredRegister.createBlocks(BubbleShield.MOD_ID);

	public static final DeferredBlock<BubbleShieldBlock> BUBBLE_SHIELD_PROJECTOR = BLOCKS.register(
		"bubble_shield_projector",
		() -> new BubbleShieldBlock(
			BlockBehaviour.Properties.of()
				.strength(3.5F)
				.requiresCorrectToolForDrops()
		)
	);

	private ModBlocks() {
	}
}
