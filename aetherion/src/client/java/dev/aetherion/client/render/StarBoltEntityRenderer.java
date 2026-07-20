package dev.aetherion.client.render;

import dev.aetherion.entity.StarBoltEntity;
import net.minecraft.client.render.entity.EntityRendererFactory;
import net.minecraft.client.render.entity.FlyingItemEntityRenderer;

public final class StarBoltEntityRenderer extends FlyingItemEntityRenderer<StarBoltEntity> {
	public StarBoltEntityRenderer(EntityRendererFactory.Context context) {
		super(context, 1.15F, true);
	}
}
