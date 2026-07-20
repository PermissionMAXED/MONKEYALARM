package dev.aetherion.entity;

import dev.aetherion.Aetherion;
import dev.aetherion.registry.ModEntities;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.WeakHashMap;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.entity.SpawnReason;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.math.BlockPos;

public final class AsterSummoningManager {
	private static final int SUMMON_DELAY_TICKS = 40;
	private static final Map<ServerWorld, List<PendingSummon>> PENDING_BY_WORLD = new WeakHashMap<>();

	private AsterSummoningManager() {
	}

	public static void init() {
		ServerTickEvents.END_WORLD_TICK.register(AsterSummoningManager::tick);
		Aetherion.LOGGER.debug("Registered Aster summoning sequence manager");
	}

	public static void schedule(ServerWorld world, BlockPos corePos) {
		PENDING_BY_WORLD.computeIfAbsent(world, ignored -> new ArrayList<>())
				.add(new PendingSummon(corePos.toImmutable()));
		world.playSound(
				null,
				corePos,
				SoundEvents.ENTITY_EVOKER_PREPARE_SUMMON,
				SoundCategory.HOSTILE,
				1.4F,
				0.7F
		);
	}

	private static void tick(ServerWorld world) {
		List<PendingSummon> pendingSummons = PENDING_BY_WORLD.get(world);
		if (pendingSummons == null) {
			return;
		}

		Iterator<PendingSummon> iterator = pendingSummons.iterator();
		while (iterator.hasNext()) {
			PendingSummon summon = iterator.next();
			summon.ticks++;
			double progress = summon.ticks / (double) SUMMON_DELAY_TICKS;
			world.spawnParticles(
					ParticleTypes.END_ROD,
					summon.pos.getX() + 0.5,
					summon.pos.getY() + 0.35 + progress * 2.0,
					summon.pos.getZ() + 0.5,
					5,
					0.5 + progress,
					0.15,
					0.5 + progress,
					0.03
			);
			if (summon.ticks >= SUMMON_DELAY_TICKS) {
				spawnAster(world, summon.pos);
				iterator.remove();
			}
		}

		if (pendingSummons.isEmpty()) {
			PENDING_BY_WORLD.remove(world);
		}
	}

	private static void spawnAster(ServerWorld world, BlockPos corePos) {
		AsterEntity aster = ModEntities.ASTER.create(world, SpawnReason.MOB_SUMMONED);
		if (aster == null) {
			return;
		}

		aster.refreshPositionAndAngles(
				corePos.getX() + 0.5,
				corePos.getY(),
				corePos.getZ() + 0.5,
				world.getRandom().nextFloat() * 360.0F,
				0.0F
		);
		aster.setPersistent();
		if (world.spawnEntity(aster)) {
			world.spawnParticles(
					ParticleTypes.EXPLOSION_EMITTER,
					aster.getX(),
					aster.getBodyY(0.55),
					aster.getZ(),
					1,
					0.0,
					0.0,
					0.0,
					0.0
			);
			world.playSound(
					null,
					corePos,
					SoundEvents.ENTITY_WITHER_SPAWN,
					SoundCategory.HOSTILE,
					2.5F,
					1.35F
			);
		}
	}

	private static final class PendingSummon {
		private final BlockPos pos;
		private int ticks;

		private PendingSummon(BlockPos pos) {
			this.pos = pos;
		}
	}
}
