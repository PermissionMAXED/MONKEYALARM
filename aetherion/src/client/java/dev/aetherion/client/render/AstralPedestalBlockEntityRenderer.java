package dev.aetherion.client.render;

import dev.aetherion.block.AstralPedestalBlockEntity;
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

public final class AstralPedestalBlockEntityRenderer implements BlockEntityRenderer<
		AstralPedestalBlockEntity,
		AstralPedestalBlockEntityRenderer.State
> {
	private final ItemModelManager itemModelManager;

	public AstralPedestalBlockEntityRenderer(BlockEntityRendererFactory.Context context) {
		itemModelManager = context.itemModelManager();
	}

	@Override
	public State createRenderState() {
		return new State();
	}

	@Override
	public void updateRenderState(
			AstralPedestalBlockEntity pedestal,
			State state,
			float tickProgress,
			Vec3d cameraPos,
			CrumblingOverlayCommand crumblingOverlay
	) {
		BlockEntityRenderer.super.updateRenderState(
				pedestal,
				state,
				tickProgress,
				cameraPos,
				crumblingOverlay
		);
		long time = pedestal.getWorld() == null ? 0L : pedestal.getWorld().getTime();
		state.age = time + tickProgress;
		itemModelManager.clearAndUpdate(
				state.item,
				pedestal.getItem(),
				ItemDisplayContext.FIXED,
				pedestal.getWorld(),
				null,
				(int) pedestal.getPos().asLong()
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
		matrices.translate(0.5F, 1.16F + bob, 0.5F);
		matrices.multiply(RotationAxis.POSITIVE_Y.rotationDegrees(state.age * 3.0F));
		matrices.scale(0.55F, 0.55F, 0.55F);
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
