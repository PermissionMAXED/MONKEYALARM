package dev.aetherion.worldgen;

import dev.aetherion.Aetherion;
import dev.aetherion.network.ScreenShakePayload;
import dev.aetherion.registry.ModBlocks;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.block.Blocks;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.Heightmap;
import net.minecraft.world.World;

public final class StarfallManager {
	private static final float NIGHTLY_STARFALL_CHANCE = 0.35F;
	private static final int NIGHT_START_TICK = 13000;
	private static final int NIGHT_END_TICK = 23000;
	private static final int FLIGHT_TICKS = 40;
	private static final int CRATER_RADIUS = 4;
	private static final double SCREEN_SHAKE_RADIUS = 64.0;
	private static final List<ActiveStarfall> ACTIVE_STARFALLS = new ArrayList<>();
	private static long lastCheckedNight = Long.MIN_VALUE;

	private StarfallManager() {
	}

	public static void init() {
		ServerTickEvents.END_WORLD_TICK.register(world -> {
			if (world.getRegistryKey() != World.OVERWORLD) {
				return;
			}
			tickActiveStarfalls(world);
			tryStartNightlyStarfall(world);
		});
		Aetherion.LOGGER.debug("Registered Overworld starfall manager");
	}

	public static boolean force(ServerWorld world, BlockPos near) {
		if (world.getRegistryKey() != World.OVERWORLD) {
			return false;
		}

		int topY = world.getTopY(
				Heightmap.Type.MOTION_BLOCKING_NO_LEAVES,
				near.getX(),
				near.getZ()
		);
		startStarfall(world, new BlockPos(near.getX(), topY - 1, near.getZ()));
		return true;
	}

	private static void tryStartNightlyStarfall(ServerWorld world) {
		long time = world.getTimeOfDay();
		int timeOfDay = (int)Math.floorMod(time, 24000L);
		long night = Math.floorDiv(time, 24000L);
		if (timeOfDay < NIGHT_START_TICK
				|| timeOfDay > NIGHT_END_TICK
				|| night == lastCheckedNight
				|| !ACTIVE_STARFALLS.isEmpty()) {
			return;
		}

		ServerPlayerEntity player = world.getRandomAlivePlayer();
		if (player == null || player.isSpectator()) {
			return;
		}
		lastCheckedNight = night;
		if (world.getRandom().nextFloat() >= NIGHTLY_STARFALL_CHANCE) {
			return;
		}

		double angle = world.getRandom().nextDouble() * Math.PI * 2.0;
		double distance = 24.0 + world.getRandom().nextDouble() * 32.0;
		int x = MathHelper.floor(player.getX() + Math.cos(angle) * distance);
		int z = MathHelper.floor(player.getZ() + Math.sin(angle) * distance);
		int topY = world.getTopY(Heightmap.Type.MOTION_BLOCKING_NO_LEAVES, x, z);
		startStarfall(world, new BlockPos(x, topY - 1, z));
	}

	private static void startStarfall(ServerWorld world, BlockPos impact) {
		Vec3d impactCenter = impact.toCenterPos();
		double approachX = 45.0 + world.getRandom().nextDouble() * 25.0;
		double approachZ = (world.getRandom().nextDouble() - 0.5) * 45.0;
		Vec3d start = impactCenter.add(approachX, 90.0, approachZ);
		ACTIVE_STARFALLS.add(new ActiveStarfall(start, impact));

		world.playSound(
				null,
				impact,
				SoundEvents.ENTITY_FIREWORK_ROCKET_LAUNCH,
				SoundCategory.AMBIENT,
				2.0F,
				0.55F
		);
		Aetherion.LOGGER.info("A fallen star is approaching {}", impact.toShortString());
	}

	private static void tickActiveStarfalls(ServerWorld world) {
		Iterator<ActiveStarfall> iterator = ACTIVE_STARFALLS.iterator();
		while (iterator.hasNext()) {
			ActiveStarfall starfall = iterator.next();
			starfall.age++;
			double progress = Math.min(1.0, starfall.age / (double)FLIGHT_TICKS);
			Vec3d impactCenter = starfall.impact.toCenterPos();
			Vec3d position = starfall.start.lerp(impactCenter, progress);
			Vec3d previous = starfall.start.lerp(impactCenter, Math.max(0.0, progress - 0.08));
			Vec3d trail = previous.subtract(position);

			world.spawnParticles(
					ParticleTypes.END_ROD,
					position.x,
					position.y,
					position.z,
					10,
					0.18,
					0.18,
					0.18,
					0.02
			);
			world.spawnParticles(
					ParticleTypes.FLAME,
					position.x,
					position.y,
					position.z,
					0,
					trail.x,
					trail.y,
					trail.z,
					0.18
			);

			if (starfall.age >= FLIGHT_TICKS) {
				createImpact(world, starfall.impact);
				iterator.remove();
			}
		}
	}

	private static void createImpact(ServerWorld world, BlockPos impact) {
		for (int dx = -CRATER_RADIUS; dx <= CRATER_RADIUS; dx++) {
			for (int dz = -CRATER_RADIUS; dz <= CRATER_RADIUS; dz++) {
				double horizontalDistance = Math.sqrt(dx * dx + dz * dz);
				if (horizontalDistance > CRATER_RADIUS + 0.35) {
					continue;
				}

				int depth = Math.max(1, 4 - MathHelper.floor(horizontalDistance));
				for (int dy = 2; dy >= -depth; dy--) {
					BlockPos removePos = impact.add(dx, dy, dz);
					BlockState existing = world.getBlockState(removePos);
					if (!existing.hasBlockEntity() && !existing.isOf(Blocks.BEDROCK)) {
						world.setBlockState(removePos, Blocks.AIR.getDefaultState(), Block.NOTIFY_ALL);
					}
				}
				BlockPos craterFloor = impact.add(dx, -depth - 1, dz);
				BlockState floorState = world.getBlockState(craterFloor);
				if (!floorState.hasBlockEntity() && !floorState.isOf(Blocks.BEDROCK)) {
					world.setBlockState(craterFloor, Blocks.DEEPSLATE.getDefaultState(), Block.NOTIFY_ALL);
				}
			}
		}

		BlockPos corePos = impact.down(4);
		world.setBlockState(corePos, ModBlocks.FALLEN_STAR_CORE.getDefaultState(), Block.NOTIFY_ALL);
		world.spawnParticles(
				ParticleTypes.EXPLOSION_EMITTER,
				corePos.getX() + 0.5,
				corePos.getY() + 1.0,
				corePos.getZ() + 0.5,
				1,
				0.0,
				0.0,
				0.0,
				0.0
		);
		world.spawnParticles(
				ParticleTypes.END_ROD,
				corePos.getX() + 0.5,
				corePos.getY() + 1.0,
				corePos.getZ() + 0.5,
				80,
				2.5,
				1.5,
				2.5,
				0.08
		);
		world.playSound(
				null,
				corePos.getX() + 0.5,
				corePos.getY() + 0.5,
				corePos.getZ() + 0.5,
				SoundEvents.ENTITY_GENERIC_EXPLODE,
				SoundCategory.BLOCKS,
				3.0F,
				0.7F
		);

		Vec3d impactCenter = corePos.toCenterPos();
		double maxDistanceSquared = SCREEN_SHAKE_RADIUS * SCREEN_SHAKE_RADIUS;
		for (ServerPlayerEntity player : world.getPlayers()) {
			if (player.squaredDistanceTo(impactCenter) <= maxDistanceSquared
					&& ServerPlayNetworking.canSend(player, ScreenShakePayload.ID)) {
				ServerPlayNetworking.send(player, new ScreenShakePayload(0.8F, 32));
			}
		}
		Aetherion.LOGGER.info("Fallen star impacted at {}", corePos.toShortString());
	}

	private static final class ActiveStarfall {
		private final Vec3d start;
		private final BlockPos impact;
		private int age;

		private ActiveStarfall(Vec3d start, BlockPos impact) {
			this.start = start;
			this.impact = impact;
		}
	}
}
