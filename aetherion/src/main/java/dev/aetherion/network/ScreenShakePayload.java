package dev.aetherion.network;

import dev.aetherion.AetherionId;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;

public record ScreenShakePayload(float intensity, int durationTicks) implements CustomPayload {
	public static final Id<ScreenShakePayload> ID = new Id<>(AetherionId.of("screen_shake"));
	public static final PacketCodec<RegistryByteBuf, ScreenShakePayload> CODEC = PacketCodec.tuple(
			PacketCodecs.FLOAT,
			ScreenShakePayload::intensity,
			PacketCodecs.VAR_INT,
			ScreenShakePayload::durationTicks,
			ScreenShakePayload::new
	);

	@Override
	public Id<ScreenShakePayload> getId() {
		return ID;
	}
}
