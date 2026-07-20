package dev.aetherion.client.render;

public final class ScreenShakeManager {
	private static float intensity;
	private static int durationTicks;
	private static int ticksRemaining;

	private ScreenShakeManager() {
	}

	public static void start(float requestedIntensity, int requestedDurationTicks) {
		float clampedIntensity = Math.clamp(requestedIntensity, 0.0F, 12.0F);
		int clampedDuration = Math.clamp(requestedDurationTicks, 0, 20 * 30);
		if (clampedIntensity <= 0.0F || clampedDuration <= 0) {
			reset();
			return;
		}

		intensity = Math.max(intensity, clampedIntensity);
		durationTicks = Math.max(durationTicks, clampedDuration);
		ticksRemaining = Math.max(ticksRemaining, clampedDuration);
	}

	public static void tick() {
		if (ticksRemaining > 0) {
			ticksRemaining--;
		}
		if (ticksRemaining == 0) {
			reset();
		}
	}

	public static boolean isActive() {
		return ticksRemaining > 0 && durationTicks > 0 && intensity > 0.0F;
	}

	public static float yawOffset(float tickProgress) {
		return sample(tickProgress, 2.35F, 0.0F);
	}

	public static float pitchOffset(float tickProgress) {
		return sample(tickProgress, 2.9F, 1.7F) * 0.65F;
	}

	public static void reset() {
		intensity = 0.0F;
		durationTicks = 0;
		ticksRemaining = 0;
	}

	private static float sample(float tickProgress, float frequency, float phase) {
		if (!isActive()) {
			return 0.0F;
		}
		float elapsed = durationTicks - ticksRemaining + tickProgress;
		float falloff = Math.clamp((ticksRemaining - tickProgress) / durationTicks, 0.0F, 1.0F);
		return (float) Math.sin(elapsed * frequency + phase) * intensity * falloff;
	}
}
