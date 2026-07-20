package dev.aetherion.entity;

import dev.aetherion.registry.ModEntities;
import dev.aetherion.registry.ModItems;
import net.minecraft.entity.Entity;
import net.minecraft.entity.EntityType;
import net.minecraft.entity.FlyingItemEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.projectile.ExplosiveProjectileEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleEffect;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.storage.ReadView;
import net.minecraft.storage.WriteView;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.hit.EntityHitResult;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.World;

public final class StarBoltEntity extends ExplosiveProjectileEntity implements FlyingItemEntity {
	private static final String DAMAGE_KEY = "damage";
	private static final int MAX_LIFETIME_TICKS = 100;

	private float impactDamage = 8.0F;

	public StarBoltEntity(EntityType<? extends StarBoltEntity> type, World world) {
		super(type, world);
		accelerationPower = 0.0;
	}

	public StarBoltEntity(World world, LivingEntity owner, Vec3d velocity, float impactDamage) {
		this(ModEntities.STAR_BOLT, world);
		setOwner(owner);
		setPosition(owner.getX(), owner.getEyeY() - 0.15, owner.getZ());
		setVelocity(velocity);
		this.impactDamage = impactDamage;
	}

	public StarBoltEntity(World world, double x, double y, double z, Entity owner, Vec3d velocity, float impactDamage) {
		this(ModEntities.STAR_BOLT, world);
		setOwner(owner);
		setPosition(x, y, z);
		setVelocity(velocity);
		this.impactDamage = impactDamage;
	}

	@Override
	public void tick() {
		super.tick();
		if (!getEntityWorld().isClient() && age > MAX_LIFETIME_TICKS) {
			discard();
		}
	}

	@Override
	protected void onEntityHit(EntityHitResult hitResult) {
		super.onEntityHit(hitResult);
		if (getEntityWorld() instanceof ServerWorld serverWorld) {
			Entity owner = getOwner();
			Entity attacker = owner == null ? this : owner;
			hitResult.getEntity().damage(
					serverWorld,
					getDamageSources().indirectMagic(this, attacker),
					impactDamage
			);
			discard();
		}
	}

	@Override
	protected void onBlockHit(BlockHitResult blockHitResult) {
		super.onBlockHit(blockHitResult);
		if (!getEntityWorld().isClient()) {
			discard();
		}
	}

	@Override
	protected ParticleEffect getParticleType() {
		return ParticleTypes.END_ROD;
	}

	@Override
	protected float getDrag() {
		return 1.0F;
	}

	@Override
	public ItemStack getStack() {
		return ModItems.STARSHARD.getDefaultStack();
	}

	@Override
	protected void writeCustomData(WriteView view) {
		super.writeCustomData(view);
		view.putFloat(DAMAGE_KEY, impactDamage);
	}

	@Override
	protected void readCustomData(ReadView view) {
		super.readCustomData(view);
		impactDamage = view.getFloat(DAMAGE_KEY, 8.0F);
	}
}
