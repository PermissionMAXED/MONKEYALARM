package dev.aetherion.entity;

import dev.aetherion.network.ScreenShakePayload;
import dev.aetherion.registry.ModEntities;
import java.util.List;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.SpawnReason;
import net.minecraft.entity.ai.goal.ActiveTargetGoal;
import net.minecraft.entity.ai.goal.LookAroundGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.entity.ai.goal.RevengeGoal;
import net.minecraft.entity.ai.goal.WanderAroundFarGoal;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.boss.BossBar;
import net.minecraft.entity.boss.ServerBossBar;
import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.data.DataTracker;
import net.minecraft.entity.data.TrackedData;
import net.minecraft.entity.data.TrackedDataHandlerRegistry;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class AsterEntity extends HostileEntity {
	public static final int PHASE_ONE = 1;
	public static final int PHASE_TWO = 2;
	public static final int PHASE_THREE = 3;

	private static final TrackedData<Integer> PHASE = DataTracker.registerData(
			AsterEntity.class,
			TrackedDataHandlerRegistry.INTEGER
	);
	private static final String PHASE_KEY = "phase";
	private static final String ABILITY_COOLDOWN_KEY = "ability_cooldown";
	private static final double SLAM_RADIUS = 6.0;
	private static final double SHAKE_RADIUS = 24.0;

	private final ServerBossBar bossBar = new ServerBossBar(
			getDisplayName(),
			BossBar.Color.YELLOW,
			BossBar.Style.PROGRESS
	);
	private int abilityCooldown = 30;

	public AsterEntity(EntityType<? extends AsterEntity> type, World world) {
		super(type, world);
		experiencePoints = 80;
		bossBar.setDarkenSky(true);
	}

	public static DefaultAttributeContainer.Builder createAttributes() {
		return HostileEntity.createHostileAttributes()
				.add(EntityAttributes.MAX_HEALTH, 300.0)
				.add(EntityAttributes.ARMOR, 12.0)
				.add(EntityAttributes.ARMOR_TOUGHNESS, 6.0)
				.add(EntityAttributes.ATTACK_DAMAGE, 13.0)
				.add(EntityAttributes.ATTACK_KNOCKBACK, 1.4)
				.add(EntityAttributes.KNOCKBACK_RESISTANCE, 0.85)
				.add(EntityAttributes.FOLLOW_RANGE, 48.0)
				.add(EntityAttributes.MOVEMENT_SPEED, 0.27);
	}

	@Override
	protected void initGoals() {
		goalSelector.add(2, new MeleeAttackGoal(this, 1.05, false));
		goalSelector.add(5, new WanderAroundFarGoal(this, 0.65));
		goalSelector.add(6, new LookAtEntityGoal(this, PlayerEntity.class, 16.0F));
		goalSelector.add(7, new LookAroundGoal(this));
		targetSelector.add(1, new RevengeGoal(this));
		targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));
	}

	@Override
	public boolean cannotDespawn() {
		return true;
	}

	@Override
	protected void initDataTracker(DataTracker.Builder builder) {
		super.initDataTracker(builder);
		builder.add(PHASE, PHASE_ONE);
	}

	public int getPhase() {
		return dataTracker.get(PHASE);
	}

	@Override
	protected void mobTick(ServerWorld world) {
		super.mobTick(world);
		updatePhase();
		bossBar.setPercent(MathHelper.clamp(getHealth() / getMaxHealth(), 0.0F, 1.0F));

		if (abilityCooldown > 0) {
			abilityCooldown--;
		}

		PlayerEntity target = getTarget() instanceof PlayerEntity player ? player : null;
		if (target == null || !target.isAlive() || abilityCooldown > 0) {
			return;
		}

		switch (getPhase()) {
			case PHASE_ONE -> {
				if (squaredDistanceTo(target) <= SLAM_RADIUS * SLAM_RADIUS) {
					performSlam(world);
					abilityCooldown = 70;
				}
			}
			case PHASE_TWO -> {
				fireStarBoltSalvo(world, target, 5, 1.15F, 9.0F);
				abilityCooldown = 52;
			}
			case PHASE_THREE -> {
				spawnStarWisps(world);
				fireStarBoltSalvo(world, target, 3, 1.3F, 10.0F);
				abilityCooldown = 110;
			}
			default -> abilityCooldown = 20;
		}
	}

	@Override
	public boolean damage(ServerWorld world, DamageSource source, float amount) {
		boolean damaged = super.damage(world, source, amount);
		if (damaged) {
			updatePhase();
			bossBar.setPercent(MathHelper.clamp(getHealth() / getMaxHealth(), 0.0F, 1.0F));
		}
		return damaged;
	}

	private void updatePhase() {
		float healthRatio = getHealth() / getMaxHealth();
		int nextPhase = healthRatio > (2.0F / 3.0F)
				? PHASE_ONE
				: healthRatio > (1.0F / 3.0F) ? PHASE_TWO : PHASE_THREE;
		if (nextPhase == getPhase()) {
			return;
		}

		dataTracker.set(PHASE, nextPhase);
		bossBar.setColor(switch (nextPhase) {
			case PHASE_TWO -> BossBar.Color.BLUE;
			case PHASE_THREE -> BossBar.Color.PURPLE;
			default -> BossBar.Color.YELLOW;
		});
		abilityCooldown = 20;
	}

	private void performSlam(ServerWorld world) {
		world.spawnParticles(
				ParticleTypes.ELECTRIC_SPARK,
				getX(),
				getY() + 0.2,
				getZ(),
				80,
				SLAM_RADIUS * 0.55,
				0.25,
				SLAM_RADIUS * 0.55,
				0.18
		);

		for (ServerPlayerEntity player : world.getPlayers(player ->
				player.isAlive() && squaredDistanceTo(player) <= SHAKE_RADIUS * SHAKE_RADIUS)) {
			double distance = Math.sqrt(squaredDistanceTo(player));
			if (distance <= SLAM_RADIUS) {
				player.damage(world, getDamageSources().mobAttack(this), 14.0F);
				player.takeKnockback(1.8, getX() - player.getX(), getZ() - player.getZ());
			}

			if (ServerPlayNetworking.canSend(player, ScreenShakePayload.ID)) {
				float intensity = (float) MathHelper.clamp(1.0 - distance / SHAKE_RADIUS, 0.15, 1.0);
				ServerPlayNetworking.send(
						player,
						new ScreenShakePayload(intensity, 18)
				);
			}
		}
	}

	private void fireStarBoltSalvo(
			ServerWorld world,
			PlayerEntity target,
			int count,
			float speed,
			float damage
	) {
		Vec3d origin = getEyePos();
		Vec3d direction = target.getEyePos().subtract(origin).normalize();
		for (int index = 0; index < count; index++) {
			double spread = (index - (count - 1) / 2.0) * 0.065;
			Vec3d velocity = direction.add(
					spread,
					random.nextGaussian() * 0.025,
					-spread
			).normalize().multiply(speed);
			StarBoltEntity bolt = new StarBoltEntity(
					world,
					origin.x,
					origin.y,
					origin.z,
					this,
					velocity,
					damage
			);
			world.spawnEntity(bolt);
		}
	}

	private void spawnStarWisps(ServerWorld world) {
		List<StarWispEntity> nearbyWisps = world.getEntitiesByType(
				ModEntities.STAR_WISP,
				getBoundingBox().expand(28.0),
				Entity::isAlive
		);
		int spawnCount = Math.min(3, Math.max(0, 8 - nearbyWisps.size()));
		for (int index = 0; index < spawnCount; index++) {
			StarWispEntity wisp = ModEntities.STAR_WISP.create(world, SpawnReason.MOB_SUMMONED);
			if (wisp == null) {
				continue;
			}

			double angle = (Math.PI * 2.0 * index / Math.max(1, spawnCount)) + random.nextDouble() * 0.5;
			wisp.refreshPositionAndAngles(
					getX() + Math.cos(angle) * 3.0,
					getY() + 2.0 + random.nextDouble() * 2.0,
					getZ() + Math.sin(angle) * 3.0,
					random.nextFloat() * 360.0F,
					0.0F
			);
			wisp.setTarget(getTarget());
			world.spawnEntity(wisp);
		}
	}

	@Override
	public void onStartedTrackingBy(ServerPlayerEntity player) {
		super.onStartedTrackingBy(player);
		bossBar.addPlayer(player);
	}

	@Override
	public void onStoppedTrackingBy(ServerPlayerEntity player) {
		super.onStoppedTrackingBy(player);
		bossBar.removePlayer(player);
	}

	@Override
	public void remove(RemovalReason reason) {
		super.remove(reason);
		bossBar.clearPlayers();
	}

	@Override
	public void setCustomName(net.minecraft.text.Text name) {
		super.setCustomName(name);
		bossBar.setName(getDisplayName());
	}

	@Override
	protected void writeCustomData(WriteView view) {
		super.writeCustomData(view);
		view.putInt(PHASE_KEY, getPhase());
		view.putInt(ABILITY_COOLDOWN_KEY, abilityCooldown);
	}

	@Override
	protected void readCustomData(ReadView view) {
		super.readCustomData(view);
		dataTracker.set(PHASE, MathHelper.clamp(view.getInt(PHASE_KEY, PHASE_ONE), PHASE_ONE, PHASE_THREE));
		abilityCooldown = Math.max(0, view.getInt(ABILITY_COOLDOWN_KEY, 20));
		bossBar.setColor(switch (getPhase()) {
			case PHASE_TWO -> BossBar.Color.BLUE;
			case PHASE_THREE -> BossBar.Color.PURPLE;
			default -> BossBar.Color.YELLOW;
		});
	}
}
