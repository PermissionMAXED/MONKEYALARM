package dev.aetherion.block;

import com.mojang.serialization.MapCodec;
import net.minecraft.block.Block;
import net.minecraft.block.BlockRenderType;
import net.minecraft.block.BlockState;
import net.minecraft.block.BlockWithEntity;
import net.minecraft.block.ShapeContext;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.shape.VoxelShape;
import net.minecraft.world.BlockView;
import net.minecraft.world.World;

public final class AstralPedestalBlock extends BlockWithEntity {
	public static final MapCodec<AstralPedestalBlock> CODEC = createCodec(AstralPedestalBlock::new);
	private static final VoxelShape SHAPE = Block.createCuboidShape(2.0, 0.0, 2.0, 14.0, 13.0, 14.0);

	public AstralPedestalBlock(Settings settings) {
		super(settings);
	}

	@Override
	protected MapCodec<? extends AstralPedestalBlock> getCodec() {
		return CODEC;
	}

	@Override
	public BlockEntity createBlockEntity(BlockPos pos, BlockState state) {
		return new AstralPedestalBlockEntity(pos, state);
	}

	@Override
	protected BlockRenderType getRenderType(BlockState state) {
		return BlockRenderType.MODEL;
	}

	@Override
	protected VoxelShape getOutlineShape(
			BlockState state,
			BlockView world,
			BlockPos pos,
			ShapeContext context
	) {
		return SHAPE;
	}

	@Override
	protected ActionResult onUseWithItem(
			ItemStack stack,
			BlockState state,
			World world,
			BlockPos pos,
			PlayerEntity player,
			Hand hand,
			BlockHitResult hit
	) {
		return interact(world, pos, player, stack);
	}

	@Override
	protected ActionResult onUse(
			BlockState state,
			World world,
			BlockPos pos,
			PlayerEntity player,
			BlockHitResult hit
	) {
		return interact(world, pos, player, ItemStack.EMPTY);
	}

	private ActionResult interact(World world, BlockPos pos, PlayerEntity player, ItemStack heldStack) {
		if (!(world.getBlockEntity(pos) instanceof AstralPedestalBlockEntity pedestal)) {
			return ActionResult.PASS;
		}
		if (world.isClient()) {
			return !pedestal.isEmpty() || !heldStack.isEmpty() ? ActionResult.SUCCESS : ActionResult.PASS;
		}

		if (!pedestal.isEmpty()) {
			giveOrDrop(player, pedestal.takeItem());
			return ActionResult.SUCCESS_SERVER;
		}
		if (heldStack.isEmpty()) {
			return ActionResult.PASS;
		}

		ItemStack inserted = player.isInCreativeMode()
				? heldStack.copyWithCount(1)
				: heldStack.split(1);
		pedestal.setItem(inserted);
		AstralAltarBlock.tryCraftNearPedestal((ServerWorld) world, pos);
		return ActionResult.SUCCESS_SERVER;
	}

	private static void giveOrDrop(PlayerEntity player, ItemStack stack) {
		if (!player.giveItemStack(stack)) {
			player.dropItem(stack, false);
		}
	}

	@Override
	protected void onStateReplaced(BlockState state, ServerWorld world, BlockPos pos, boolean moved) {
		if (!moved && world.getBlockEntity(pos) instanceof AstralPedestalBlockEntity pedestal) {
			Block.dropStack(world, pos, pedestal.takeItem());
		}
		super.onStateReplaced(state, world, pos, moved);
	}
}
