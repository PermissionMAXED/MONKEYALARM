package dev.aetherion.network;

import dev.aetherion.AetherionId;
import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;

public record AstralChargeSyncPayload(int charge) implements CustomPayload {
	public static final Id<AstralChargeSyncPayload> ID = new Id<>(AetherionId.of("astral_charge_sync"));
	public static final PacketCodec<RegistryByteBuf, AstralChargeSyncPayload> CODEC = PacketCodec.tuple(
			PacketCodecs.VAR_INT,
			AstralChargeSyncPayload::charge,
			AstralChargeSyncPayload::new
	).cast();

	@Override
	public Id<? extends CustomPayload> getId() {
		return ID;
	}
}
