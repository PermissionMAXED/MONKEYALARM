package dev.aetherion.entity;

import net.minecraft.entity.EntityType;
import net.minecraft.entity.ai.control.FlightMoveControl;
import net.minecraft.entity.ai.goal.ActiveTargetGoal;
import net.minecraft.entity.ai.goal.LookAtEntityGoal;
import net.minecraft.entity.ai.goal.RevengeGoal;
import net.minecraft.entity.ai.pathing.BirdNavigation;
import net.minecraft.entity.ai.pathing.EntityNavigation;
import net.minecraft.entity.attribute.DefaultAttributeContainer;
import net.minecraft.entity.attribute.EntityAttributes;
import net.minecraft.entity.mob.HostileEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.world.World;

public final class StarWispEntity extends HostileEntity {
	private static final int MAX_LIFETIME_TICKS = 20 * 45;
	private static final int ATTACK_COOLDOWN_TICKS = 20;

	private int attackCooldown;

	public StarWispEntity(EntityType<? extends StarWispEntity> type, World world) {
		super(type, world);
		moveControl = new FlightMoveControl(this, 20, true);
		setNoGravity(true);
		experiencePoints = 5;
	}

	public static DefaultAttributeContainer.Builder createAttributes() {
		return HostileEntity.createHostileAttributes()
				.add(EntityAttributes.MAX_HEALTH, 20.0)
				.add(EntityAttributes.ARMOR, 2.0)
				.add(EntityAttributes.ATTACK_DAMAGE, 5.0)
				.add(EntityAttributes.FOLLOW_RANGE, 32.0)
				.add(EntityAttributes.MOVEMENT_SPEED, 0.32)
				.add(EntityAttributes.FLYING_SPEED, 0.48);
	}

	@Override
	protected void initGoals() {
		targetSelector.add(1, new RevengeGoal(this));
		targetSelector.add(2, new ActiveTargetGoal<>(this, PlayerEntity.class, true));
		goalSelector.add(3, new LookAtEntityGoal(this, PlayerEntity.class, 24.0F));
	}

	@Override
	protected EntityNavigation createNavigation(World world) {
		return new BirdNavigation(this, world);
	}

	@Override
	protected void mobTick(ServerWorld world) {
		super.mobTick(world);
		if (attackCooldown > 0) {
			attackCooldown--;
		}

		if (age >= MAX_LIFETIME_TICKS) {
			discard();
			return;
		}

		PlayerEntity target = getTarget() instanceof PlayerEntity player ? player : null;
		if (target == null || !target.isAlive()) {
			return;
		}

		getMoveControl().moveTo(target.getX(), target.getEyeY(), target.getZ(), 1.15);
		if (squaredDistanceTo(target) <= 2.25 && attackCooldown == 0) {
			target.damage(world, getDamageSources().mobAttack(this), 5.0F);
			attackCooldown = ATTACK_COOLDOWN_TICKS;
		}
	}
}
