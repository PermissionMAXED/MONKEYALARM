package dev.aetherion.client.render;

import dev.aetherion.AetherionId;
import dev.aetherion.client.render.model.AsterModel;
import dev.aetherion.client.render.state.AsterRenderState;
import dev.aetherion.entity.AsterEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.util.Identifier;

public final class AsterEntityRenderer
		extends MobEntityRenderer<AsterEntity, AsterRenderState, AsterModel> {
	private static final Identifier TEXTURE = AetherionId.of("textures/entity/aster.png");

	public AsterEntityRenderer(EntityRendererFactory.Context context) {
		super(context, new AsterModel(context.getPart(ModEntityModelLayers.ASTER)), 0.9F);
	}

	@Override
	public AsterRenderState createRenderState() {
		return new AsterRenderState();
	}

	@Override
	public void updateRenderState(AsterEntity entity, AsterRenderState state, float tickProgress) {
		super.updateRenderState(entity, state, tickProgress);
		state.phase = entity.getPhase();
	}

	@Override
	public Identifier getTexture(AsterRenderState state) {
		return TEXTURE;
	}
}
