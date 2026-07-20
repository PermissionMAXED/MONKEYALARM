package dev.aetherion;

import net.minecraft.util.Identifier;

public final class AetherionId {
	private AetherionId() {
	}

	public static Identifier of(String path) {
		return Identifier.of(Aetherion.MOD_ID, path);
	}
}
