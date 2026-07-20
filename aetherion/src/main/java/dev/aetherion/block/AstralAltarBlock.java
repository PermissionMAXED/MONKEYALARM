package dev.aetherion.block;

import com.mojang.serialization.MapCodec;
import dev.aetherion.altar.AltarRecipes;
import dev.aetherion.registry.ModBlocks;
import dev.aetherion.registry.ModParticles;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.block.Block;
import net.minecraft.block.BlockRenderType;
import net.minecraft.block.BlockState;
import net.minecraft.block.BlockWithEntity;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Hand;
import net.minecraft.util.hit.BlockHitResult;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;
import net.minecraft.world.World;

public final class AstralAltarBlock extends BlockWithEntity {
	public static final MapCodec<AstralAltarBlock> CODEC = createCodec(AstralAltarBlock::new);
	private static final List<Direction> PEDESTAL_DIRECTIONS = List.of(
			Direction.NORTH,
			Direction.EAST,
			Direction.SOUTH,
			Direction.WEST
	);
	private static final int PEDESTAL_DISTANCE = 2;

	public AstralAltarBlock(Settings settings) {
		super(settings);
	}

	@Override
	protected MapCodec<? extends AstralAltarBlock> getCodec() {
		return CODEC;
	}

	@Override
	public BlockEntity createBlockEntity(BlockPos pos, BlockState state) {
		return new AstralAltarBlockEntity(pos, state);
	}

	@Override
	protected BlockRenderType getRenderType(BlockState state) {
		return BlockRenderType.MODEL;
	}

	@Override
	protected ActionResult onUseWithItem(
			ItemStack stack,
			BlockState state,
			World world,
			BlockPos pos,
			PlayerEntity player,
			Hand hand,
			BlockHitResult hit
	) {
		return interact(world, pos, player, stack);
	}

	@Override
	protected ActionResult onUse(
			BlockState state,
			World world,
			BlockPos pos,
			PlayerEntity player,
			BlockHitResult hit
	) {
		return interact(world, pos, player, ItemStack.EMPTY);
	}

	private ActionResult interact(World world, BlockPos pos, PlayerEntity player, ItemStack heldStack) {
		if (world.isClient()) {
			return ActionResult.SUCCESS;
		}
		if (!(world.getBlockEntity(pos) instanceof AstralAltarBlockEntity altar)) {
			return ActionResult.PASS;
		}

		if (tryCraft((ServerWorld) world, pos)) {
			return ActionResult.SUCCESS_SERVER;
		}

		if (!altar.isEmpty()) {
			giveOrDrop(player, altar.takeCatalyst());
			return ActionResult.SUCCESS_SERVER;
		}

		if (!heldStack.isEmpty()) {
			ItemStack inserted = player.isInCreativeMode()
					? heldStack.copyWithCount(1)
					: heldStack.split(1);
			altar.setCatalyst(inserted);
			tryCraft((ServerWorld) world, pos);
			return ActionResult.SUCCESS_SERVER;
		}

		return ActionResult.PASS;
	}

	public static boolean tryCraft(ServerWorld world, BlockPos altarPos) {
		if (!(world.getBlockEntity(altarPos) instanceof AstralAltarBlockEntity altar)
				|| altar.isEmpty()) {
			return false;
		}

		List<AstralPedestalBlockEntity> pedestals = new ArrayList<>(PEDESTAL_DIRECTIONS.size());
		List<ItemStack> ingredients = new ArrayList<>(PEDESTAL_DIRECTIONS.size());
		for (Direction direction : PEDESTAL_DIRECTIONS) {
			BlockPos pedestalPos = altarPos.offset(direction, PEDESTAL_DISTANCE);
			if (!(world.getBlockEntity(pedestalPos) instanceof AstralPedestalBlockEntity pedestal)
					|| pedestal.isEmpty()) {
				return false;
			}
			pedestals.add(pedestal);
			ingredients.add(pedestal.getItem());
		}

		ItemStack result = AltarRecipes.findResult(ingredients, altar.getCatalyst()).orElse(ItemStack.EMPTY);
		if (result.isEmpty()) {
			return false;
		}

		altar.consumeCatalyst();
		pedestals.forEach(AstralPedestalBlockEntity::removeOne);

		ItemEntity output = new ItemEntity(
				world,
				altarPos.getX() + 0.5,
				altarPos.getY() + 1.35,
				altarPos.getZ() + 0.5,
				result
		);
		output.setToDefaultPickupDelay();
		world.spawnEntity(output);
		world.spawnParticles(
				ModParticles.STELLAR_BURST,
				altarPos.getX() + 0.5,
				altarPos.getY() + 1.1,
				altarPos.getZ() + 0.5,
				28,
				0.55,
				0.3,
				0.55,
				0.08
		);
		for (int layer = 0; layer < 7; layer++) {
			world.spawnParticles(
					ModParticles.STARLIGHT_MOTE,
					altarPos.getX() + 0.5,
					altarPos.getY() + 0.75 + layer * 0.28,
					altarPos.getZ() + 0.5,
					5,
					0.16,
					0.08,
					0.16,
					0.015
			);
		}
		world.playSound(
				null,
				altarPos,
				SoundEvents.BLOCK_ENCHANTMENT_TABLE_USE,
				SoundCategory.BLOCKS,
				1.0F,
				1.25F
		);
		world.playSound(
				null,
				altarPos,
				SoundEvents.BLOCK_AMETHYST_BLOCK_CHIME,
				SoundCategory.BLOCKS,
				1.2F,
				1.6F
		);
		return true;
	}

	public static void tryCraftNearPedestal(ServerWorld world, BlockPos pedestalPos) {
		for (Direction direction : PEDESTAL_DIRECTIONS) {
			BlockPos altarPos = pedestalPos.offset(direction, PEDESTAL_DISTANCE);
			if (world.getBlockState(altarPos).isOf(ModBlocks.ASTRAL_ALTAR)) {
				tryCraft(world, altarPos);
			}
		}
	}

	private static void giveOrDrop(PlayerEntity player, ItemStack stack) {
		if (!player.giveItemStack(stack)) {
			player.dropItem(stack, false);
		}
	}

	@Override
	protected void onStateReplaced(BlockState state, ServerWorld world, BlockPos pos, boolean moved) {
		if (!moved && world.getBlockEntity(pos) instanceof AstralAltarBlockEntity altar) {
			Block.dropStack(world, pos, altar.takeCatalyst());
		}
		super.onStateReplaced(state, world, pos, moved);
	}
}
