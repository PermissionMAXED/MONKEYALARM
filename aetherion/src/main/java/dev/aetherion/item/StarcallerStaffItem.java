package dev.aetherion.item;

import dev.aetherion.charge.AstralChargeManager;
import dev.aetherion.entity.StarBoltEntity;
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
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.RaycastContext;
import net.minecraft.world.World;

public final class StarcallerStaffItem extends Item {
	private static final int BOLT_CHARGE_COST = 8;
	private static final int STARFALL_CHARGE_COST = 35;

	public StarcallerStaffItem(Settings settings) {
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

		ServerPlayerEntity serverPlayer = (ServerPlayerEntity) player;
		ServerWorld serverWorld = (ServerWorld) world;
		if (player.isSneaking()) {
			return castStarfall(serverWorld, serverPlayer, stack);
		}
		return fireBolt(serverWorld, serverPlayer, stack);
	}

	private ActionResult fireBolt(
			ServerWorld world,
			ServerPlayerEntity player,
			ItemStack stack
	) {
		if (!AstralChargeManager.tryConsume(player, BOLT_CHARGE_COST)) {
			return ActionResult.FAIL;
		}

		Vec3d velocity = player.getRotationVec(1.0F).multiply(1.75);
		StarBoltEntity bolt = new StarBoltEntity(world, player, velocity, 9.0F);
		world.spawnEntity(bolt);
		world.playSound(
				null,
				player.getBlockPos(),
				SoundEvents.ENTITY_WITHER_SHOOT,
				SoundCategory.PLAYERS,
				0.65F,
				1.75F
		);
		player.getItemCooldownManager().set(stack, 8);
		return ActionResult.SUCCESS_SERVER;
	}

	private ActionResult castStarfall(
			ServerWorld world,
			ServerPlayerEntity player,
			ItemStack stack
	) {
		if (!AstralChargeManager.tryConsume(player, STARFALL_CHARGE_COST)) {
			return ActionResult.FAIL;
		}

		Vec3d eye = player.getEyePos();
		Vec3d end = eye.add(player.getRotationVec(1.0F).multiply(36.0));
		BlockHitResult hit = world.raycast(new RaycastContext(
				eye,
				end,
				RaycastContext.ShapeType.COLLIDER,
				RaycastContext.FluidHandling.NONE,
				player
		));
		Vec3d target = hit.getPos();
		for (int index = 0; index < 9; index++) {
			double angle = Math.PI * 2.0 * index / 9.0;
			double radius = index == 0 ? 0.0 : 2.5;
			Vec3d origin = target.add(Math.cos(angle) * radius, 13.0 + (index % 3), Math.sin(angle) * radius);
			Vec3d velocity = target.subtract(origin).normalize().multiply(1.45);
			StarBoltEntity bolt = new StarBoltEntity(
					world,
					origin.x,
					origin.y,
					origin.z,
					player,
					velocity,
					12.0F
			);
			world.spawnEntity(bolt);
		}

		world.spawnParticles(
				ParticleTypes.END_ROD,
				target.x,
				target.y + 0.2,
				target.z,
				45,
				2.0,
				0.25,
				2.0,
				0.04
		);
		world.playSound(
				null,
				player.getBlockPos(),
				SoundEvents.ITEM_TRIDENT_THUNDER.value(),
				SoundCategory.PLAYERS,
				0.9F,
				1.4F
		);
		player.getItemCooldownManager().set(stack, 50);
		return ActionResult.SUCCESS_SERVER;
	}
}
