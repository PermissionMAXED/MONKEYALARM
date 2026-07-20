package dev.aetherion.portal;

import dev.aetherion.Aetherion;
import dev.aetherion.block.RiftGatewayBlock;
import dev.aetherion.registry.ModBlocks;
import dev.aetherion.registry.ModItems;
import dev.aetherion.worldgen.ModDimensions;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.registry.RegistryKey;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.TeleportTarget;
import net.minecraft.world.World;
import net.minecraft.world.WorldProperties;

public final class RiftPortalManager {
	private static final int FRAME_WIDTH = 2;
	private static final int FRAME_HEIGHT = 3;
	private static final int EXPANSE_GATEWAY_Y = 96;
	private static final int PORTAL_COOLDOWN_TICKS = 100;
	private static final Map<UUID, ReturnPoint> RETURN_POINTS = new HashMap<>();

	private RiftPortalManager() {
	}

	public static void init() {
		UseBlockCallback.EVENT.register((player, world, hand, hitResult) -> {
			if (player.isSpectator()
					|| !player.getStackInHand(hand).isOf(ModItems.RIFT_KEY)
					|| !world.getBlockState(hitResult.getBlockPos()).isOf(ModBlocks.AETHERIUM_BLOCK)) {
				return ActionResult.PASS;
			}

			Frame frame = findFrame(world, hitResult.getBlockPos());
			if (frame == null) {
				return ActionResult.PASS;
			}
			if (world.isClient()) {
				return ActionResult.SUCCESS;
			}

			fillGateway(world, frame);
			world.playSound(
					null,
					frame.interiorBottomLeft(),
					SoundEvents.BLOCK_PORTAL_TRIGGER,
					SoundCategory.BLOCKS,
					1.0F,
					1.35F
			);
			return ActionResult.SUCCESS_SERVER;
		});
		Aetherion.LOGGER.debug("Registered Rift Key portal activation");
	}

	public static void teleport(
			ServerWorld sourceWorld,
			BlockPos gatewayPos,
			Direction.Axis axis,
			ServerPlayerEntity player
	) {
		MinecraftServer server = sourceWorld.getServer();
		BlockPos sourceBottom = findGatewayBottom(sourceWorld, gatewayPos, axis);
		ServerWorld targetWorld;
		Vec3d targetPosition;
		float targetYaw = player.getYaw();
		float targetPitch = player.getPitch();

		if (sourceWorld.getRegistryKey() == World.OVERWORLD) {
			targetWorld = server.getWorld(ModDimensions.THE_EXPANSE);
			if (targetWorld == null) {
				Aetherion.LOGGER.error("Cannot use Rift Gateway: aetherion:the_expanse is not loaded");
				return;
			}

			RETURN_POINTS.put(
					player.getUuid(),
					new ReturnPoint(
							sourceWorld.getRegistryKey(),
							getExitPosition(sourceBottom, axis),
							player.getYaw(),
							player.getPitch()
					)
			);
			BlockPos targetBottom = new BlockPos(
					sourceBottom.getX(),
					EXPANSE_GATEWAY_Y,
					sourceBottom.getZ()
			);
			buildLandingGateway(targetWorld, targetBottom, axis);
			targetPosition = getExitPosition(targetBottom, axis);
		} else if (sourceWorld.getRegistryKey() == ModDimensions.THE_EXPANSE) {
			ReturnPoint returnPoint = RETURN_POINTS.remove(player.getUuid());
			if (returnPoint != null) {
				targetWorld = server.getWorld(returnPoint.world());
				targetPosition = returnPoint.position();
				targetYaw = returnPoint.yaw();
				targetPitch = returnPoint.pitch();
			} else {
				targetWorld = server.getWorld(World.OVERWORLD);
				if (targetWorld == null) {
					return;
				}
				WorldProperties.SpawnPoint spawnPoint = targetWorld.getSpawnPoint();
				targetPosition = spawnPoint.getPos().toBottomCenterPos().add(0.0, 1.0, 0.0);
				targetYaw = spawnPoint.yaw();
				targetPitch = spawnPoint.pitch();
			}
		} else {
			return;
		}

		if (targetWorld == null) {
			return;
		}

		player.setPortalCooldown(PORTAL_COOLDOWN_TICKS);
		TeleportTarget target = new TeleportTarget(
				targetWorld,
				targetPosition,
				Vec3d.ZERO,
				targetYaw,
				targetPitch,
				Set.of(),
				TeleportTarget.SEND_TRAVEL_THROUGH_PORTAL_PACKET.then(TeleportTarget.ADD_PORTAL_CHUNK_TICKET)
		);
		ServerPlayerEntity teleported = player.teleportTo(target);
		if (teleported != null) {
			teleported.setPortalCooldown(PORTAL_COOLDOWN_TICKS);
		}
	}

	private static Frame findFrame(World world, BlockPos clickedPos) {
		for (Direction.Axis axis : new Direction.Axis[]{Direction.Axis.X, Direction.Axis.Z}) {
			Direction along = axis == Direction.Axis.X ? Direction.EAST : Direction.SOUTH;
			for (int frameX = -1; frameX <= FRAME_WIDTH; frameX++) {
				for (int frameY = -1; frameY <= FRAME_HEIGHT; frameY++) {
					BlockPos interiorBottomLeft = clickedPos
							.offset(along, -frameX)
							.down(frameY);
					Frame frame = new Frame(interiorBottomLeft, axis);
					if (isValidFrame(world, frame)) {
						return frame;
					}
				}
			}
		}
		return null;
	}

	private static boolean isValidFrame(World world, Frame frame) {
		Direction along = frame.along();
		BlockPos origin = frame.interiorBottomLeft();
		for (int x = -1; x <= FRAME_WIDTH; x++) {
			for (int y = -1; y <= FRAME_HEIGHT; y++) {
				BlockPos checkPos = origin.offset(along, x).up(y);
				boolean border = x == -1 || x == FRAME_WIDTH || y == -1 || y == FRAME_HEIGHT;
				BlockState state = world.getBlockState(checkPos);
				if (border) {
					if (!state.isOf(ModBlocks.AETHERIUM_BLOCK)) {
						return false;
					}
				} else if (!state.isReplaceable() && !state.isOf(ModBlocks.RIFT_GATEWAY)) {
					return false;
				}
			}
		}
		return true;
	}

	private static void fillGateway(World world, Frame frame) {
		BlockState gateway = ModBlocks.RIFT_GATEWAY
				.getDefaultState()
				.with(RiftGatewayBlock.AXIS, frame.axis());
		for (int x = 0; x < FRAME_WIDTH; x++) {
			for (int y = 0; y < FRAME_HEIGHT; y++) {
				world.setBlockState(
						frame.interiorBottomLeft().offset(frame.along(), x).up(y),
						gateway,
						Block.NOTIFY_ALL
				);
			}
		}
	}

	private static BlockPos findGatewayBottom(
			ServerWorld world,
			BlockPos gatewayPos,
			Direction.Axis axis
	) {
		BlockPos bottom = gatewayPos;
		while (isGateway(world, bottom.down(), axis)) {
			bottom = bottom.down();
		}
		Direction backwards = axis == Direction.Axis.X ? Direction.WEST : Direction.NORTH;
		while (isGateway(world, bottom.offset(backwards), axis)) {
			bottom = bottom.offset(backwards);
		}
		return bottom;
	}

	private static boolean isGateway(ServerWorld world, BlockPos pos, Direction.Axis axis) {
		BlockState state = world.getBlockState(pos);
		return state.isOf(ModBlocks.RIFT_GATEWAY)
				&& state.get(RiftGatewayBlock.AXIS) == axis;
	}

	private static Vec3d getExitPosition(BlockPos portalBottom, Direction.Axis axis) {
		Direction along = axis == Direction.Axis.X ? Direction.EAST : Direction.SOUTH;
		Direction normal = axis == Direction.Axis.X ? Direction.SOUTH : Direction.EAST;
		return portalBottom.toBottomCenterPos()
				.add(
						along.getOffsetX() * 0.5 + normal.getOffsetX() * 2.5,
						0.0,
						along.getOffsetZ() * 0.5 + normal.getOffsetZ() * 2.5
				);
	}

	private static void buildLandingGateway(
			ServerWorld world,
			BlockPos portalBottom,
			Direction.Axis axis
	) {
		for (int x = -4; x <= 4; x++) {
			for (int z = -4; z <= 4; z++) {
				world.setBlockState(portalBottom.add(x, -1, z), Blocks.END_STONE.getDefaultState(), Block.NOTIFY_ALL);
				for (int y = 0; y <= 4; y++) {
					BlockPos clearPos = portalBottom.add(x, y, z);
					BlockState existing = world.getBlockState(clearPos);
					if (!existing.hasBlockEntity() && !existing.isOf(Blocks.BEDROCK)) {
						world.setBlockState(clearPos, Blocks.AIR.getDefaultState(), Block.NOTIFY_ALL);
					}
				}
			}
		}

		Direction along = axis == Direction.Axis.X ? Direction.EAST : Direction.SOUTH;
		for (int x = -1; x <= FRAME_WIDTH; x++) {
			for (int y = -1; y <= FRAME_HEIGHT; y++) {
				boolean border = x == -1 || x == FRAME_WIDTH || y == -1 || y == FRAME_HEIGHT;
				if (border) {
					world.setBlockState(
							portalBottom.offset(along, x).up(y),
							ModBlocks.AETHERIUM_BLOCK.getDefaultState(),
							Block.NOTIFY_ALL
					);
				}
			}
		}
		fillGateway(world, new Frame(portalBottom, axis));
	}

	private record Frame(BlockPos interiorBottomLeft, Direction.Axis axis) {
		private Direction along() {
			return axis == Direction.Axis.X ? Direction.EAST : Direction.SOUTH;
		}
	}

	private record ReturnPoint(
			RegistryKey<World> world,
			Vec3d position,
			float yaw,
			float pitch
	) {
	}
}
