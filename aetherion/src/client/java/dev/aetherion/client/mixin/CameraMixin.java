package dev.aetherion.client.mixin;

import dev.aetherion.client.render.ScreenShakeManager;
import net.minecraft.client.render.Camera;
import net.minecraft.entity.Entity;
import net.minecraft.world.BlockView;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(Camera.class)
public abstract class CameraMixin {
	@Shadow
	protected abstract void setRotation(float yaw, float pitch);

	@Inject(method = "update", at = @At("TAIL"))
	private void aetherion$applyScreenShake(
			BlockView area,
			Entity focusedEntity,
			boolean thirdPerson,
			boolean inverseView,
			float tickProgress,
			CallbackInfo ci
	) {
		if (!ScreenShakeManager.isActive()) {
			return;
		}

		Camera camera = (Camera) (Object) this;
		setRotation(
				camera.getYaw() + ScreenShakeManager.yawOffset(tickProgress),
				camera.getPitch() + ScreenShakeManager.pitchOffset(tickProgress)
		);
	}
}
