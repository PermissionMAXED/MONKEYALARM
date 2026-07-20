package dev.aetherion.item;

import dev.aetherion.charge.AstralChargeManager;
import java.util.Set;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.particle.ParticleTypes;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.RaycastContext;
import net.minecraft.world.World;

public final class PhasePearlItem extends Item {
	private static final int CHARGE_COST = 20;
	private static final double BLINK_DISTANCE = 12.0;
	private static final double SAFETY_STEP = 0.5;

	public PhasePearlItem(Settings settings) {
		super(settings);
	}

	@Override
	public ActionResult use(World world, PlayerEntity player, Hand hand) {
		ItemStack stack = player.getStackInHand(hand);
		if (player.getItemCooldownManager().isCoolingDown(stack)) {
			return ActionResult.FAIL;
		}
		if (world.isClient()) {
			return ActionResult.SUCCESS;
		}

		ServerWorld serverWorld = (ServerWorld) world;
		ServerPlayerEntity serverPlayer = (ServerPlayerEntity) player;
		if (AstralChargeManager.get(serverPlayer) < CHARGE_COST) {
			AstralChargeManager.tryConsume(serverPlayer, CHARGE_COST);
			return ActionResult.FAIL;
		}

		Vec3d look = player.getRotationVec(1.0F).normalize();
		Vec3d eye = player.getEyePos();
		Vec3d intendedEye = eye.add(look.multiply(BLINK_DISTANCE));
		BlockHitResult hit = world.raycast(new RaycastContext(
				eye,
				intendedEye,
				RaycastContext.ShapeType.COLLIDER,
				RaycastContext.FluidHandling.NONE,
				player
		));
		Vec3d reachedEye = hit.getPos().subtract(look.multiply(0.45));
		Vec3d intendedFeet = reachedEye.subtract(0.0, player.getStandingEyeHeight(), 0.0);
		Vec3d safeFeet = findSafeDestination(serverWorld, player, intendedFeet, look);
		if (safeFeet == null) {
			return ActionResult.FAIL;
		}
		if (!AstralChargeManager.tryConsume(serverPlayer, CHARGE_COST)) {
			return ActionResult.FAIL;
		}

		Vec3d origin = new Vec3d(player.getX(), player.getY(), player.getZ());
		if (!player.teleport(
				serverWorld,
				safeFeet.x,
				safeFeet.y,
				safeFeet.z,
				Set.of(),
				player.getYaw(),
				player.getPitch(),
				false
		)) {
			AstralChargeManager.set(serverPlayer, AstralChargeManager.get(serverPlayer) + CHARGE_COST);
			return ActionResult.FAIL;
		}

		serverWorld.spawnParticles(
				ParticleTypes.REVERSE_PORTAL,
				origin.x,
				origin.y + 1.0,
				origin.z,
				35,
				0.45,
				0.8,
				0.45,
				0.08
		);
		serverWorld.spawnParticles(
				ParticleTypes.END_ROD,
				safeFeet.x,
				safeFeet.y + 1.0,
				safeFeet.z,
				30,
				0.45,
				0.8,
				0.45,
				0.05
		);
		serverWorld.playSound(
				null,
				player.getBlockPos(),
				SoundEvents.ENTITY_ENDERMAN_TELEPORT,
				SoundCategory.PLAYERS,
				0.8F,
				1.35F
		);
		player.getItemCooldownManager().set(stack, 80);
		return ActionResult.SUCCESS_SERVER;
	}

	private static Vec3d findSafeDestination(
			ServerWorld world,
			PlayerEntity player,
			Vec3d intendedFeet,
			Vec3d look
	) {
		Vec3d currentFeet = new Vec3d(player.getX(), player.getY(), player.getZ());
		Box currentBox = player.getBoundingBox();
		int steps = (int) Math.ceil(BLINK_DISTANCE / SAFETY_STEP);
		for (int step = 0; step <= steps; step++) {
			Vec3d candidate = intendedFeet.subtract(look.multiply(step * SAFETY_STEP));
			Box candidateBox = currentBox.offset(candidate.subtract(currentFeet));
			if (world.isSpaceEmpty(player, candidateBox)) {
				return candidate;
			}
		}
		return null;
	}
}
