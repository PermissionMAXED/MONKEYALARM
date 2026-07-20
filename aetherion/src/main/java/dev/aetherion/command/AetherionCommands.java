package dev.aetherion.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import dev.aetherion.block.AstralAltarBlockEntity;
import dev.aetherion.block.AstralPedestalBlockEntity;
import dev.aetherion.block.RiftGatewayBlock;
import dev.aetherion.charge.AstralChargeManager;
import dev.aetherion.entity.AsterEntity;
import dev.aetherion.registry.ModBlocks;
import dev.aetherion.registry.ModEntities;
import dev.aetherion.registry.ModItems;
import dev.aetherion.registry.ModParticles;
import dev.aetherion.worldgen.StarfallManager;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.minecraft.block.Block;
import net.minecraft.block.BlockState;
import net.minecraft.entity.SpawnReason;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Direction;

public final class AetherionCommands {
	private AetherionCommands() {
	}

	public static void init() {
		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
				register(dispatcher)
		);
	}

	private static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		dispatcher.register(CommandManager.literal("aetherion")
				.requires(source -> source.hasPermissionLevel(2))
				.then(CommandManager.literal("showcase")
						.then(scene("particles"))
						.then(scene("altar"))
						.then(scene("starfall"))
						.then(scene("boss"))
						.then(scene("portal"))
						.then(scene("charge"))));
	}

	private static com.mojang.brigadier.builder.LiteralArgumentBuilder<ServerCommandSource> scene(
			String name
	) {
		return CommandManager.literal(name).executes(context -> showcase(context.getSource(), name));
	}

	private static int showcase(ServerCommandSource source, String scene) throws CommandSyntaxException {
		ServerPlayerEntity player = source.getPlayerOrThrow();
		ServerWorld world = source.getWorld();
		BlockPos origin = player.getBlockPos().offset(player.getHorizontalFacing(), 5);
		boolean success = switch (scene) {
			case "particles" -> showParticles(world, player);
			case "altar" -> showAltar(world, origin);
			case "starfall" -> StarfallManager.force(world, origin.offset(player.getHorizontalFacing(), 12));
			case "boss" -> showBoss(world, origin);
			case "portal" -> showPortal(world, origin, player.getHorizontalFacing());
			case "charge" -> showCharge(player);
			default -> false;
		};
		if (!success) {
			source.sendError(Text.translatable(
					"command.aetherion.showcase.failed",
					Text.translatable("command.aetherion.showcase.scene." + scene)
			));
			return 0;
		}

		source.sendFeedback(
				() -> Text.translatable(
						"command.aetherion.showcase.success",
						Text.translatable("command.aetherion.showcase.scene." + scene)
				),
				true
		);
		return 1;
	}

	private static boolean showParticles(ServerWorld world, ServerPlayerEntity player) {
		world.spawnParticles(
				ModParticles.STARLIGHT_MOTE,
				player.getX(),
				player.getY() + 1.5,
				player.getZ(),
				80,
				1.7,
				1.0,
				1.7,
				0.04
		);
		world.spawnParticles(
				ModParticles.RIFT_SPARK,
				player.getX(),
				player.getY() + 1.2,
				player.getZ(),
				60,
				1.2,
				0.8,
				1.2,
				0.03
		);
		world.spawnParticles(
				ModParticles.STELLAR_BURST,
				player.getX(),
				player.getY() + 2.0,
				player.getZ(),
				24,
				0.8,
				0.8,
				0.8,
				0.02
		);
		return true;
	}

	private static boolean showAltar(ServerWorld world, BlockPos origin) {
		world.setBlockState(origin, ModBlocks.ASTRAL_ALTAR.getDefaultState(), Block.NOTIFY_ALL);
		if (world.getBlockEntity(origin) instanceof AstralAltarBlockEntity altar) {
			altar.setCatalyst(ModItems.RIFT_KEY.getDefaultStack());
		}

		for (Direction direction : Direction.Type.HORIZONTAL) {
			BlockPos pedestalPos = origin.offset(direction, 2);
			world.setBlockState(
					pedestalPos,
					ModBlocks.ASTRAL_PEDESTAL.getDefaultState(),
					Block.NOTIFY_ALL
			);
			if (world.getBlockEntity(pedestalPos) instanceof AstralPedestalBlockEntity pedestal) {
				pedestal.setItem(ModItems.STARSHARD.getDefaultStack());
			}
		}
		return true;
	}

	private static boolean showBoss(ServerWorld world, BlockPos origin) {
		AsterEntity aster = ModEntities.ASTER.create(world, SpawnReason.COMMAND);
		if (aster == null) {
			return false;
		}

		aster.refreshPositionAndAngles(
				origin.getX() + 0.5,
				origin.getY(),
				origin.getZ() + 0.5,
				world.getRandom().nextFloat() * 360.0F,
				0.0F
		);
		aster.setPersistent();
		return world.spawnEntity(aster);
	}

	private static boolean showPortal(ServerWorld world, BlockPos origin, Direction facing) {
		Direction.Axis axis = facing.getAxis() == Direction.Axis.Z
				? Direction.Axis.X
				: Direction.Axis.Z;
		Direction along = axis == Direction.Axis.X ? Direction.EAST : Direction.SOUTH;
		BlockState gateway = ModBlocks.RIFT_GATEWAY
				.getDefaultState()
				.with(RiftGatewayBlock.AXIS, axis);

		for (int x = -1; x <= 2; x++) {
			for (int y = -1; y <= 3; y++) {
				BlockPos pos = origin.offset(along, x).up(y);
				boolean border = x == -1 || x == 2 || y == -1 || y == 3;
				world.setBlockState(
						pos,
						border ? ModBlocks.AETHERIUM_BLOCK.getDefaultState() : gateway,
						Block.NOTIFY_ALL
				);
			}
		}
		return true;
	}

	private static boolean showCharge(ServerPlayerEntity player) {
		AstralChargeManager.set(player, AstralChargeManager.MAX_CHARGE);
		return true;
	}
}
