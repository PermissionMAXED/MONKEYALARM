package dev.aetherion.charge;

import dev.aetherion.Aetherion;
import dev.aetherion.network.AstralChargeSyncPayload;
import dev.aetherion.worldgen.ModDimensions;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayNetworking;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;

public final class AstralChargeManager {
	public static final int MIN_CHARGE = 0;
	public static final int MAX_CHARGE = 100;

	private static final int OVERWORLD_REGEN_PER_SECOND = 2;
	private static final int EXPANSE_REGEN_PER_SECOND = 6;
	private static final Map<UUID, Integer> CHARGE_BY_PLAYER = new HashMap<>();

	private AstralChargeManager() {
	}

	public static void init() {
		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (server.getTicks() % 20 != 0) {
				return;
			}

			for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
				int regen = isInRegisteredExpanse(player.getEntityWorld())
						? EXPANSE_REGEN_PER_SECOND
						: OVERWORLD_REGEN_PER_SECOND;
				set(player, get(player) + regen);
			}
		});
		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> sync(handler.player));
		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) ->
				CHARGE_BY_PLAYER.remove(handler.player.getUuid())
		);
		ServerLifecycleEvents.SERVER_STOPPED.register(server -> CHARGE_BY_PLAYER.clear());
		Aetherion.LOGGER.debug("Registered server-side Astral Charge management");
	}

	public static int get(ServerPlayerEntity player) {
		return CHARGE_BY_PLAYER.computeIfAbsent(player.getUuid(), uuid -> MAX_CHARGE);
	}

	public static boolean tryConsume(ServerPlayerEntity player, int amount) {
		if (amount <= 0) {
			return true;
		}

		int current = get(player);
		if (current < amount) {
			player.sendMessage(Text.translatable("message.aetherion.not_enough_charge", amount), true);
			sync(player);
			return false;
		}

		set(player, current - amount);
		return true;
	}

	public static void set(ServerPlayerEntity player, int charge) {
		int clamped = Math.max(MIN_CHARGE, Math.min(MAX_CHARGE, charge));
		Integer previous = CHARGE_BY_PLAYER.put(player.getUuid(), clamped);
		if (previous == null || previous != clamped) {
			sync(player);
		}
	}

	private static void sync(ServerPlayerEntity player) {
		if (ServerPlayNetworking.canSend(player, AstralChargeSyncPayload.ID)) {
			ServerPlayNetworking.send(player, new AstralChargeSyncPayload(get(player)));
		}
	}

	private static boolean isInRegisteredExpanse(ServerWorld world) {
		return world.getRegistryKey().equals(ModDimensions.THE_EXPANSE);
	}
}
