package dev.aetherion.client.hud;

public final class AstralChargeState {
	private static int charge;

	private AstralChargeState() {
	}

	public static int getCharge() {
		return charge;
	}

	public static void setCharge(int value) {
		charge = Math.clamp(value, 0, 100);
	}

	public static void reset() {
		charge = 0;
	}
}
