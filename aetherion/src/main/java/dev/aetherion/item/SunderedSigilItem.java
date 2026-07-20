package dev.aetherion.item;

import dev.aetherion.entity.AsterSummoningManager;
import dev.aetherion.registry.ModBlocks;
import net.minecraft.block.Block;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemUsageContext;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

public final class SunderedSigilItem extends Item {
	public SunderedSigilItem(Settings settings) {
		super(settings);
	}

	@Override
	public ActionResult useOnBlock(ItemUsageContext context) {
		World world = context.getWorld();
		BlockPos pos = context.getBlockPos();
		if (!world.getBlockState(pos).isOf(ModBlocks.FALLEN_STAR_CORE)) {
			return ActionResult.PASS;
		}
		if (world.isClient()) {
			return ActionResult.SUCCESS;
		}

		ServerWorld serverWorld = (ServerWorld) world;
		world.setBlockState(pos, Blocks.AIR.getDefaultState(), Block.NOTIFY_ALL);
		PlayerEntity player = context.getPlayer();
		if (player == null || !player.isInCreativeMode()) {
			context.getStack().decrement(1);
		}
		serverWorld.spawnParticles(
				ParticleTypes.REVERSE_PORTAL,
				pos.getX() + 0.5,
				pos.getY() + 0.5,
				pos.getZ() + 0.5,
				50,
				0.7,
				0.7,
				0.7,
				0.08
		);
		AsterSummoningManager.schedule(serverWorld, pos);
		return ActionResult.SUCCESS_SERVER;
	}
}
