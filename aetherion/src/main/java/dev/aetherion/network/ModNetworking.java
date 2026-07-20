package dev.aetherion.network;

import dev.aetherion.Aetherion;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;

public final class ModNetworking {
	private ModNetworking() {
	}

	public static void init() {
		PayloadTypeRegistry.playS2C().register(ScreenShakePayload.ID, ScreenShakePayload.CODEC);
		PayloadTypeRegistry.playS2C().register(AstralChargeSyncPayload.ID, AstralChargeSyncPayload.CODEC);
		Aetherion.LOGGER.debug("Registered AETHERION networking payloads");
	}
}
