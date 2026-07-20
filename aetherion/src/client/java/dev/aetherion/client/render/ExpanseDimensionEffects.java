package dev.aetherion.client.render;

import dev.aetherion.AetherionId;
import dev.aetherion.client.mixin.DimensionEffectsAccessor;
import net.minecraft.client.render.DimensionEffects;
import net.minecraft.util.math.Vec3d;

public final class ExpanseDimensionEffects extends DimensionEffects {
	private static final ExpanseDimensionEffects INSTANCE = new ExpanseDimensionEffects();

	private ExpanseDimensionEffects() {
		super(SkyType.NORMAL, false, true);
	}

	public static void registerDimensionEffects() {
		DimensionEffectsAccessor.aetherion$getByIdentifier().put(
				AetherionId.of("the_expanse"),
				INSTANCE
		);
	}

	@Override
	public Vec3d adjustFogColor(Vec3d color, float sunHeight) {
		double daylight = 0.55 + 0.25 * sunHeight;
		return new Vec3d(
				0.08 + color.x * 0.18 * daylight,
				0.12 + color.y * 0.32 * daylight,
				0.24 + color.z * 0.58 * daylight
		);
	}

	@Override
	public boolean useThickFog(int camX, int camY) {
		return false;
	}
}
