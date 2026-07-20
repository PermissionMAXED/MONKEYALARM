package dev.aetherion.client.render;

import dev.aetherion.block.AstralAltarBlockEntity;
import net.minecraft.client.item.ItemModelManager;
import net.minecraft.client.render.OverlayTexture;
import net.minecraft.client.render.block.entity.BlockEntityRenderer;
import net.minecraft.client.render.block.entity.BlockEntityRendererFactory;
import net.minecraft.client.render.block.entity.state.BlockEntityRenderState;
import net.minecraft.client.render.command.ModelCommandRenderer.CrumblingOverlayCommand;
import net.minecraft.client.render.command.OrderedRenderCommandQueue;
import net.minecraft.client.render.item.ItemRenderState;
import net.minecraft.client.render.state.CameraRenderState;
import net.minecraft.client.util.math.MatrixStack;
import net.minecraft.item.ItemDisplayContext;
import net.minecraft.util.math.RotationAxis;
import net.minecraft.util.math.Vec3d;

public final class AstralAltarBlockEntityRenderer implements BlockEntityRenderer<
		AstralAltarBlockEntity,
		AstralAltarBlockEntityRenderer.State
> {
	private final ItemModelManager itemModelManager;

	public AstralAltarBlockEntityRenderer(BlockEntityRendererFactory.Context context) {
		itemModelManager = context.itemModelManager();
	}

	@Override
	public State createRenderState() {
		return new State();
	}

	@Override
	public void updateRenderState(
			AstralAltarBlockEntity altar,
			State state,
			float tickProgress,
			Vec3d cameraPos,
			CrumblingOverlayCommand crumblingOverlay
	) {
		BlockEntityRenderer.super.updateRenderState(
				altar,
				state,
				tickProgress,
				cameraPos,
				crumblingOverlay
		);
		long time = altar.getWorld() == null ? 0L : altar.getWorld().getTime();
		state.age = time + tickProgress;
		itemModelManager.clearAndUpdate(
				state.item,
				altar.getCatalyst(),
				ItemDisplayContext.FIXED,
				altar.getWorld(),
				null,
				(int) altar.getPos().asLong()
		);
	}

	@Override
	public void render(
			State state,
			MatrixStack matrices,
			OrderedRenderCommandQueue queue,
			CameraRenderState cameraState
	) {
		if (state.item.isEmpty()) {
			return;
		}

		matrices.push();
		float bob = (float) Math.sin(state.age / 10.0F) * 0.08F;
		matrices.translate(0.5F, 1.22F + bob, 0.5F);
		matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(state.age * 3.0F));
		matrices.scale(0.65F, 0.65F, 0.65F);
		state.item.render(
				matrices,
				queue,
				state.lightmapCoordinates,
				OverlayTexture.DEFAULT_UV,
				0
		);
		matrices.pop();
	}

	public static final class State extends BlockEntityRenderState {
		private final ItemRenderState item = new ItemRenderState();
		private float age;
	}
}
