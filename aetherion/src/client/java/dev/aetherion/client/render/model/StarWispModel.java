package dev.aetherion.client.render.model;

import dev.aetherion.client.render.state.StarWispRenderState;
import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.util.math.MathHelper;

public final class StarWispModel extends EntityModel<StarWispRenderState> {
	private final ModelPart orb;
	private final ModelPart ring;
	private final ModelPart upperTendril;
	private final ModelPart lowerTendril;

	public StarWispModel(ModelPart root) {
		super(root);
		orb = root.getChild("orb");
		ring = root.getChild("ring");
		upperTendril = root.getChild("upper_tendril");
		lowerTendril = root.getChild("lower_tendril");
	}

	public static TexturedModelData getTexturedModelData() {
		ModelData modelData = new ModelData();
		modelData.getRoot().addChild(
				"orb",
				ModelPartBuilder.create()
						.uv(0, 0)
						.cuboid(-4.0F, -4.0F, -4.0F, 8.0F, 8.0F, 8.0F, new Dilation(0.25F)),
				ModelTransform.origin(0.0F, 16.0F, 0.0F)
		);
		modelData.getRoot().addChild(
				"ring",
				ModelPartBuilder.create()
						.uv(0, 16)
						.cuboid(-7.0F, -0.75F, -0.75F, 14.0F, 1.5F, 1.5F)
						.uv(0, 19)
						.cuboid(-0.75F, -0.75F, -7.0F, 1.5F, 1.5F, 14.0F),
				ModelTransform.origin(0.0F, 16.0F, 0.0F)
		);
		modelData.getRoot().addChild(
				"upper_tendril",
				ModelPartBuilder.create()
						.uv(32, 0)
						.cuboid(-1.0F, -6.0F, -1.0F, 2.0F, 6.0F, 2.0F),
				ModelTransform.origin(0.0F, 12.0F, 0.0F)
		);
		modelData.getRoot().addChild(
				"lower_tendril",
				ModelPartBuilder.create()
						.uv(40, 0)
						.cuboid(-1.0F, 0.0F, -1.0F, 2.0F, 7.0F, 2.0F),
				ModelTransform.origin(0.0F, 20.0F, 0.0F)
		);
		return TexturedModelData.of(modelData, 64, 32);
	}

	@Override
	public void setAngles(StarWispRenderState state) {
		super.setAngles(state);
		orb.yaw = state.age * 0.12F;
		orb.pitch = MathHelper.sin(state.age * 0.08F) * 0.2F;
		ring.yaw = -state.age * 0.18F;
		ring.roll = MathHelper.PI / 4.0F + MathHelper.sin(state.age * 0.1F) * 0.22F;
		upperTendril.pitch = MathHelper.sin(state.age * 0.16F) * 0.3F;
		lowerTendril.pitch = -MathHelper.sin(state.age * 0.16F) * 0.3F;
	}
}
