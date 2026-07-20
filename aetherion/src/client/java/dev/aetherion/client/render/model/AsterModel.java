package dev.aetherion.client.render.model;

import dev.aetherion.client.render.state.AsterRenderState;
import net.minecraft.client.model.Dilation;
import net.minecraft.client.model.ModelData;
import net.minecraft.client.model.ModelPart;
import net.minecraft.client.model.ModelPartBuilder;
import net.minecraft.client.model.ModelTransform;
import net.minecraft.client.model.TexturedModelData;
import net.minecraft.client.render.entity.model.EntityModel;
import net.minecraft.util.math.MathHelper;

public final class AsterModel extends EntityModel<AsterRenderState> {
	private final ModelPart head;
	private final ModelPart body;
	private final ModelPart leftArm;
	private final ModelPart rightArm;
	private final ModelPart leftLeg;
	private final ModelPart rightLeg;
	private final ModelPart halo;
	private final ModelPart core;

	public AsterModel(ModelPart root) {
		super(root);
		head = root.getChild("head");
		body = root.getChild("body");
		leftArm = root.getChild("left_arm");
		rightArm = root.getChild("right_arm");
		leftLeg = root.getChild("left_leg");
		rightLeg = root.getChild("right_leg");
		halo = root.getChild("halo");
		core = root.getChild("core");
	}

	public static TexturedModelData getTexturedModelData() {
		ModelData modelData = new ModelData();

		ModelPartBuilder body = ModelPartBuilder.create()
				.uv(0, 32)
				.cuboid(-8.0F, -18.0F, -5.0F, 16.0F, 18.0F, 10.0F, new Dilation(0.2F));
		modelData.getRoot().addChild("body", body, ModelTransform.origin(0.0F, 4.0F, 0.0F));
		modelData.getRoot().addChild(
				"head",
				ModelPartBuilder.create()
						.uv(0, 0)
						.cuboid(-7.0F, -12.0F, -7.0F, 14.0F, 12.0F, 14.0F),
				ModelTransform.origin(0.0F, -14.0F, 0.0F)
		);
		modelData.getRoot().addChild(
				"left_arm",
				ModelPartBuilder.create()
						.uv(52, 32)
						.cuboid(-1.0F, -3.0F, -4.0F, 8.0F, 24.0F, 8.0F, new Dilation(0.15F)),
				ModelTransform.origin(9.0F, -11.0F, 0.0F)
		);
		modelData.getRoot().addChild(
				"right_arm",
				ModelPartBuilder.create()
						.uv(84, 32)
						.cuboid(-7.0F, -3.0F, -4.0F, 8.0F, 24.0F, 8.0F, new Dilation(0.15F)),
				ModelTransform.origin(-9.0F, -11.0F, 0.0F)
		);
		modelData.getRoot().addChild(
				"left_leg",
				ModelPartBuilder.create()
						.uv(0, 64)
						.cuboid(-3.5F, 0.0F, -4.0F, 7.0F, 20.0F, 8.0F),
				ModelTransform.origin(4.5F, 4.0F, 0.0F)
		);
		modelData.getRoot().addChild(
				"right_leg",
				ModelPartBuilder.create()
						.uv(30, 64)
						.cuboid(-3.5F, 0.0F, -4.0F, 7.0F, 20.0F, 8.0F),
				ModelTransform.origin(-4.5F, 4.0F, 0.0F)
		);
		ModelPartBuilder haloBuilder = ModelPartBuilder.create()
				.uv(64, 0)
				.cuboid(-11.0F, -1.0F, -1.0F, 22.0F, 2.0F, 2.0F)
				.uv(64, 4)
				.cuboid(-1.0F, -1.0F, -11.0F, 2.0F, 2.0F, 22.0F);
		modelData.getRoot().addChild("halo", haloBuilder, ModelTransform.origin(0.0F, -22.0F, 0.0F));
		modelData.getRoot().addChild(
				"core",
				ModelPartBuilder.create()
						.uv(64, 68)
						.cuboid(-3.0F, -3.0F, -1.0F, 6.0F, 6.0F, 2.0F, new Dilation(0.1F)),
				ModelTransform.origin(0.0F, -5.0F, -5.0F)
		);

		return TexturedModelData.of(modelData, 128, 128);
	}

	@Override
	public void setAngles(AsterRenderState state) {
		super.setAngles(state);
		head.yaw = state.relativeHeadYaw * (MathHelper.PI / 180.0F);
		head.pitch = state.pitch * (MathHelper.PI / 180.0F);

		float stride = state.limbSwingAnimationProgress;
		float amplitude = state.limbSwingAmplitude;
		rightLeg.pitch = MathHelper.cos(stride * 0.6662F) * 1.1F * amplitude;
		leftLeg.pitch = MathHelper.cos(stride * 0.6662F + MathHelper.PI) * 1.1F * amplitude;
		rightArm.pitch = MathHelper.cos(stride * 0.6662F + MathHelper.PI) * 0.75F * amplitude;
		leftArm.pitch = MathHelper.cos(stride * 0.6662F) * 0.75F * amplitude;

		halo.yaw = state.age * (0.025F + state.phase * 0.012F);
		halo.roll = MathHelper.sin(state.age * 0.06F) * 0.12F;
		float pulse = 1.0F + MathHelper.sin(state.age * 0.14F) * 0.05F * state.phase;
		core.xScale = pulse;
		core.yScale = pulse;
		core.zScale = pulse;
		body.roll = state.phase == 3 ? MathHelper.sin(state.age * 0.18F) * 0.025F : 0.0F;
	}
}
