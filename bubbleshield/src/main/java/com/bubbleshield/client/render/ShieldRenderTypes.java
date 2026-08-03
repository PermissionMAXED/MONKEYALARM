package com.bubbleshield.client.render;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.client.compat.IrisCompat;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.VertexFormat;

import net.minecraft.client.renderer.GameRenderer;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.resources.ResourceLocation;

/**
 * Render type dispatch for the shield membrane and the projector beam. Since
 * W6 the primary pipelines are the custom {@link ShieldPipelines} programs
 * (per-effect {@code bubble/fx_NNN} surface shaders, per-style
 * {@code beam/beam_<name>} shaders); the W5 fallback types kept here — vanilla
 * {@code position_tex_color} over a plain white texture, so every
 * {@link SphereMesh}/{@link BeamMesh} vertex ({@code POSITION_TEX_COLOR} quads,
 * raw UVs in [0, 1], palette + alpha in the vertex color) renders VISIBLY with
 * no custom shader assets — remain the guaranteed-safe path whenever a custom
 * program is unavailable (Iris gate, failed compile, mid-reload window).
 *
 * <p>State choices mirror the frozen upstream pipeline contract as closely as
 * vanilla shards allow (and {@link ShieldPipelines} mirrors THESE shards for
 * its custom types): the membrane blends translucently, draws BOTH faces
 * (the bubble is seen from inside) and does not write depth (a huge dome
 * writing depth would clip particles/rain behind it); quads are sorted
 * back-to-front on upload. The beam blends ADDITIVELY
 * ({@code LIGHTNING_TRANSPARENCY}) and keeps default back-face culling — its
 * crossed planes are wound toward the camera, and back faces would only double
 * the overdraw.
 *
 * <p><b>W9 Iris gate:</b> both lookups consult {@link IrisCompat} first — while
 * a shaderpack is active, Iris owns the shader pipeline and modded
 * {@code ShaderInstance}s misrender (no gbuffer/shadow-pass variants), so the
 * vanilla-shader fallback types here are ALWAYS returned. The W6 custom
 * per-effect/beam pipelines are only ever consulted on the path below the
 * gate (see docs/COMPAT.md).
 *
 * <p>Extends {@link RenderType} purely to reach the protected
 * {@code RenderStateShard} shards; never instantiated.
 */
final class ShieldRenderTypes extends RenderType {
	/** 16x16 all-white; keeps the UV channel live for W6 while sampling to 1. */
	private static final ResourceLocation WHITE_TEXTURE = BubbleShield.id("textures/misc/white.png");

	private static final RenderType MEMBRANE = create(
			"bubbleshield_membrane",
			DefaultVertexFormat.POSITION_TEX_COLOR,
			VertexFormat.Mode.QUADS,
			786432,
			false,
			true,
			RenderType.CompositeState.builder()
					.setShaderState(new ShaderStateShard(GameRenderer::getPositionTexColorShader))
					.setTextureState(new TextureStateShard(WHITE_TEXTURE, false, false))
					.setTransparencyState(TRANSLUCENT_TRANSPARENCY)
					.setCullState(NO_CULL)
					.setDepthTestState(LEQUAL_DEPTH_TEST)
					.setWriteMaskState(COLOR_WRITE)
					.createCompositeState(false));

	private static final RenderType BEAM = create(
			"bubbleshield_beam",
			DefaultVertexFormat.POSITION_TEX_COLOR,
			VertexFormat.Mode.QUADS,
			8192,
			false,
			false,
			RenderType.CompositeState.builder()
					.setShaderState(new ShaderStateShard(GameRenderer::getPositionTexColorShader))
					.setTextureState(new TextureStateShard(WHITE_TEXTURE, false, false))
					.setTransparencyState(LIGHTNING_TRANSPARENCY)
					.setDepthTestState(LEQUAL_DEPTH_TEST)
					.setWriteMaskState(COLOR_WRITE)
					.createCompositeState(false));

	private ShieldRenderTypes(String name, VertexFormat format, VertexFormat.Mode mode, int bufferSize,
			boolean affectsCrumbling, boolean sortOnUpload, Runnable setupState, Runnable clearState) {
		super(name, format, mode, bufferSize, affectsCrumbling, sortOnUpload, setupState, clearState);
		throw new UnsupportedOperationException("Shard-access holder; never instantiate");
	}

	/**
	 * The membrane render type for the given effect id: the effect's dedicated
	 * {@link ShieldPipelines} surface program when available, else the shared
	 * W5 translucent white-texture fallback (the per-vertex palette still
	 * differentiates effects there).
	 */
	static RenderType renderType(int effectId) {
		// W9: an active shaderpack forces the vanilla-shader fallback membrane.
		if (IrisCompat.shaderPackInUse()) {
			return MEMBRANE;
		}

		// W6: per-effect surface pipeline dispatch, below the gate. Null while
		// the program is unavailable (lazy compile failed this reload cycle).
		RenderType custom = ShieldPipelines.renderType(effectId);
		return custom != null ? custom : MEMBRANE;
	}

	/**
	 * The beam render type for the given {@code BeamStyle.renderIndex()}: the
	 * style's dedicated {@link ShieldPipelines} beam program when available,
	 * else the shared W5 additive fallback (the CPU-side vertex profile still
	 * shapes the column there).
	 */
	static RenderType beamRenderType(int renderIndex) {
		// W9: an active shaderpack forces the vanilla-shader fallback beam.
		if (IrisCompat.shaderPackInUse()) {
			return BEAM;
		}

		// W6: beam_*.fsh pipeline dispatch, below the gate. Null while the
		// style's event-registered program is unavailable.
		RenderType custom = ShieldPipelines.beamRenderType(renderIndex);
		return custom != null ? custom : BEAM;
	}
}
