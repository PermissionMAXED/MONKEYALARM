package com.bubbleshield.block;

import com.bubbleshield.registry.ModBlockEntities;
import com.bubbleshield.registry.ModItems;
import com.bubbleshield.shield.ShieldState;
import com.mojang.serialization.MapCodec;

import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.ItemInteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.BaseEntityBlock;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;

import org.jetbrains.annotations.Nullable;

public class BubbleShieldBlock extends BaseEntityBlock {
	public static final MapCodec<BubbleShieldBlock> CODEC = simpleCodec(BubbleShieldBlock::new);

	public BubbleShieldBlock(BlockBehaviour.Properties properties) {
		super(properties);
	}

	@Override
	protected MapCodec<? extends BaseEntityBlock> codec() {
		return CODEC;
	}

	/** 1.21.1: {@link BaseEntityBlock} defaults to INVISIBLE; the projector has a normal model. */
	@Override
	protected RenderShape getRenderShape(BlockState state) {
		return RenderShape.MODEL;
	}

	@Override
	public @Nullable BlockEntity newBlockEntity(BlockPos worldPosition, BlockState blockState) {
		return new BubbleShieldBlockEntity(worldPosition, blockState);
	}

	@Override
	public void setPlacedBy(Level level, BlockPos pos, BlockState state, @Nullable LivingEntity placer, ItemStack itemStack) {
		if (!level.isClientSide() && level.getBlockEntity(pos) instanceof BubbleShieldBlockEntity blockEntity) {
			// Seed the powered flag from the pre-existing signal WITHOUT acting, so the
			// next unrelated neighbor update is not misread as a rising edge.
			blockEntity.seedPowered(level.hasNeighborSignal(pos));
			if (placer instanceof Player player) {
				blockEntity.setOwner(player);
			}
		}
	}

	@Override
	protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hitResult) {
		if (player instanceof ServerPlayer serverPlayer && level.getBlockEntity(pos) instanceof BubbleShieldBlockEntity blockEntity) {
			// NeoForge extension: writes the BlockPos into the opening payload, read
			// back by ModMenus.BUBBLE_SHIELD's client factory (upstream: Fabric
			// ExtendedMenuProvider/ExtendedMenuType with BlockPos.STREAM_CODEC).
			serverPlayer.openMenu(blockEntity, pos);
		}

		return InteractionResult.SUCCESS;
	}

	/**
	 * C3 patch kit: a held patch kit takes precedence over the menu-open fallback —
	 * but ONLY when it actually takes effect (heal an active shield / shorten a break
	 * cooldown, owner/whitelisted only; see
	 * {@link BubbleShieldBlockEntity#applyPatchKit}). A no-op kit (full health,
	 * no cooldown, or an unauthorized user) returns {@code TRY_WITH_EMPTY_HAND} so
	 * the interaction falls through to {@link #useWithoutItem} and the menu opens
	 * exactly as it does for every other held item. Sneak-use keeps the vanilla
	 * convention: block interaction is skipped entirely while sneaking with an item,
	 * so a sneaking player places blocks/uses the item rather than patching.
	 */
	@Override
	protected ItemInteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player, InteractionHand hand, BlockHitResult hitResult) {
		if (stack.is(ModItems.PATCH_KIT)) {
			if (level.isClientSide()) {
				// Optimistic swing; the server below is authoritative (and falls back
				// to opening the menu itself when the kit turns out to be a no-op).
				return ItemInteractionResult.SUCCESS;
			}

			if (level.getBlockEntity(pos) instanceof BubbleShieldBlockEntity blockEntity && blockEntity.applyPatchKit(player, stack)) {
				return ItemInteractionResult.SUCCESS;
			}

			// 1.21.1 name for 26.2's TRY_WITH_EMPTY_HAND: fall through to useWithoutItem.
			return ItemInteractionResult.PASS_TO_DEFAULT_BLOCK_INTERACTION;
		}

		return super.useItemOn(stack, state, level, pos, player, hand, hitResult);
	}

	@Override
	public <T extends BlockEntity> @Nullable BlockEntityTicker<T> getTicker(Level level, BlockState blockState, BlockEntityType<T> type) {
		if (level.isClientSide()) {
			return null;
		}

		return createTickerHelper(type, ModBlockEntities.BUBBLE_SHIELD_PROJECTOR.get(), (lvl, pos, st, be) -> be.serverTick());
	}

	/**
	 * Redstone control: activation on a rising edge, deactivation on a falling edge.
	 * The block entity keeps the persisted powered flag and performs the edge detection,
	 * so GUI toggling in between stays independent of a steady redstone level.
	 */
	@Override
	protected void neighborChanged(BlockState state, Level level, BlockPos pos, Block block, BlockPos fromPos, boolean movedByPiston) {
		if (!level.isClientSide() && level.getBlockEntity(pos) instanceof BubbleShieldBlockEntity blockEntity) {
			blockEntity.setNeighborPowered(level.hasNeighborSignal(pos));
		}
	}

	/**
	 * Drops the device slot contents when the block is destroyed (the vanilla
	 * container-block pattern; upstream 26.2 does this in the block entity's
	 * {@code preRemoveSideEffects} hook, which 1.21.1 does not have).
	 */
	@Override
	protected void onRemove(BlockState state, Level level, BlockPos pos, BlockState newState, boolean movedByPiston) {
		if (!state.is(newState.getBlock()) && level.getBlockEntity(pos) instanceof BubbleShieldBlockEntity blockEntity) {
			blockEntity.dropDeviceContents(level, pos);
		}

		super.onRemove(state, level, pos, newState, movedByPiston);
	}

	@Override
	protected boolean hasAnalogOutputSignal(BlockState state) {
		return true;
	}

	/**
	 * Comparator output: while active, the shield's health fraction on a 1..15 scale;
	 * while inactive, the stored fuel (1 signal step per 200 fuel-seconds, capped at 15).
	 * B6: while the siege-alarm window is open (100 ticks after an alarm EVENT —
	 * a real projectile interception or the threat count's 0-to-positive edge,
	 * never direct {@code applyShieldDamage}), the output is overridden to
	 * full-scale 15 regardless of health/fuel, so a comparator line can drive a
	 * base-wide alert.
	 */
	@Override
	protected int getAnalogOutputSignal(BlockState state, Level level, BlockPos pos) {
		if (!(level.getBlockEntity(pos) instanceof BubbleShieldBlockEntity blockEntity)) {
			return 0;
		}

		ShieldState shield = blockEntity.getShieldState();
		if (shield.isAlarmed(level.getGameTime())) {
			return 15;
		}

		if (shield.active) {
			return Math.max(1, Math.round(15.0F * shield.health / shield.maxHealth));
		}

		return Math.min(15, shield.fuelSeconds / 200);
	}
}
