package dev.aetherion.client.render;

import dev.aetherion.AetherionId;
import dev.aetherion.client.render.model.StarWispModel;
import dev.aetherion.client.render.state.StarWispRenderState;
import dev.aetherion.entity.StarWispEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.MobEntityRenderer;
import net.minecraft.util.Identifier;
import net.minecraft.util.math.BlockPos;

public final class StarWispEntityRenderer
		extends MobEntityRenderer<StarWispEntity, StarWispRenderState, StarWispModel> {
	private static final Identifier TEXTURE = AetherionId.of("textures/entity/star_wisp.png");

	public StarWispEntityRenderer(EntityRendererFactory.Context context) {
		super(context, new StarWispModel(context.getPart(ModEntityModelLayers.STAR_WISP)), 0.35F);
	}

	@Override
	public StarWispRenderState createRenderState() {
		return new StarWispRenderState();
	}

	@Override
	protected int getBlockLight(StarWispEntity entity, BlockPos pos) {
		return 15;
	}

	@Override
	public Identifier getTexture(StarWispRenderState state) {
		return TEXTURE;
	}
}
