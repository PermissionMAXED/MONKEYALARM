package dev.aetherion.client.render;

import dev.aetherion.AetherionId;
import net.minecraft.client.render.entity.model.EntityModelLayer;

public final class ModEntityModelLayers {
	public static final EntityModelLayer ASTER = new EntityModelLayer(AetherionId.of("aster"), "main");
	public static final EntityModelLayer STAR_WISP = new EntityModelLayer(AetherionId.of("star_wisp"), "main");

	private ModEntityModelLayers() {
	}
}
