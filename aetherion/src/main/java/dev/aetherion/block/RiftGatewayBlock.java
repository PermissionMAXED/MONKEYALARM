package dev.aetherion.block;

import com.mojang.serialization.MapCodec;
import dev.aetherion.portal.RiftPortalManager;
import dev.aetherion.registry.ModParticles;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.ShapeContext;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityCollisionHandler;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.state.StateManager;
import net.minecraft.state.property.EnumProperty;
import net.minecraft.state.property.Properties;
import net.minecraft.util.BlockRotation;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.random.Random;
import net.minecraft.util.shape.VoxelShape;
import net.minecraft.world.BlockView;
import net.minecraft.world.World;

public final class RiftGatewayBlock extends Block {
	public static final MapCodec<RiftGatewayBlock> CODEC = createCodec(RiftGatewayBlock::new);
	public static final EnumProperty<Direction.Axis> AXIS = Properties.HORIZONTAL_AXIS;
	private static final VoxelShape X_SHAPE = Block.createCuboidShape(0.0, 0.0, 6.0, 16.0, 16.0, 10.0);
	private static final VoxelShape Z_SHAPE = Block.createCuboidShape(6.0, 0.0, 0.0, 10.0, 16.0, 16.0);

	public RiftGatewayBlock(Settings settings) {
		super(settings);
		setDefaultState(getStateManager().getDefaultState().with(AXIS, Direction.Axis.X));
	}

	@Override
	protected MapCodec<? extends RiftGatewayBlock> getCodec() {
		return CODEC;
	}

	@Override
	protected void appendProperties(StateManager.Builder<Block, BlockState> builder) {
		builder.add(AXIS);
	}

	@Override
	protected VoxelShape getOutlineShape(
			BlockState state,
			BlockView world,
			BlockPos pos,
			ShapeContext context
	) {
		return state.get(AXIS) == Direction.Axis.X ? X_SHAPE : Z_SHAPE;
	}

	@Override
	protected void onEntityCollision(
			BlockState state,
			World world,
			BlockPos pos,
			Entity entity,
			EntityCollisionHandler handler
	) {
		if (world instanceof ServerWorld serverWorld
				&& entity instanceof ServerPlayerEntity player
				&& !player.hasPortalCooldown()) {
			RiftPortalManager.teleport(serverWorld, pos, state.get(AXIS), player);
		}
	}

	@Override
	public void randomDisplayTick(BlockState state, World world, BlockPos pos, Random random) {
		for (int i = 0; i < 3; i++) {
			double x = pos.getX() + random.nextDouble();
			double y = pos.getY() + random.nextDouble();
			double z = pos.getZ() + random.nextDouble();
			world.addParticleClient(
					ModParticles.RIFT_SPARK,
					x,
					y,
					z,
					(random.nextDouble() - 0.5) * 0.08,
					(random.nextDouble() - 0.5) * 0.08,
					(random.nextDouble() - 0.5) * 0.08
			);
		}
	}

	@Override
	protected BlockState rotate(BlockState state, BlockRotation rotation) {
		return switch (rotation) {
			case CLOCKWISE_90, COUNTERCLOCKWISE_90 -> state.with(
					AXIS,
					state.get(AXIS) == Direction.Axis.X ? Direction.Axis.Z : Direction.Axis.X
			);
			default -> state;
		};
	}
}
