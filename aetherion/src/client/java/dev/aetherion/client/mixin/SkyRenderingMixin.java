package dev.aetherion.client.mixin;

import dev.aetherion.worldgen.ModDimensions;
import net.minecraft.client.render.SkyRendering;
import net.minecraft.client.render.state.SkyRenderState;
import net.minecraft.client.world.ClientWorld;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(SkyRendering.class)
public abstract class SkyRenderingMixin {
	@Inject(method = "updateRenderState", at = @At("TAIL"))
	private void aetherion$applyExpanseSky(
			ClientWorld world,
			float tickProgress,
			Vec3d cameraPos,
			SkyRenderState state,
			CallbackInfo ci
	) {
		if (!world.getRegistryKey().equals(ModDimensions.THE_EXPANSE)) {
			return;
		}

		state.skyColor = 0x180D38;
		state.starBrightness = 1.0F;
		state.rainGradient = 1.0F;
		state.sunriseAndSunsetColor = 0xB3F5C542;
		state.shouldRenderSkyDark = false;
	}
}
