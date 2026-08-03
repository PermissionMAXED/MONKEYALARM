package com.bubbleshield.client.render;

import java.io.IOException;

import org.slf4j.Logger;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.effect.EffectRegistry;
import com.bubbleshield.shield.BeamStyle;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.VertexFormat;
import com.mojang.logging.LogUtils;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.RenderType;
import net.minecraft.client.renderer.ShaderInstance;
import net.minecraft.resources.ResourceLocation;

import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.RegisterShadersEvent;

/**
 * W6 custom shader pipelines on NeoForge 1.21.1: one {@link ShaderInstance}
 * program ({@code bubbleshield:bubble/fx_NNN} — a shared
 * {@code bubble/surface.vsh} vertex program + the per-effect generated
 * {@code fx_NNN.fsh}) per entry in {@link EffectRegistry#ALL}, and one
 * hand-written {@code bubbleshield:beam/beam_<style>} program per rendered
 * {@link BeamStyle}. Upstream 26.2 registered all {@code COUNT} fragment
 * shaders as static {@code RenderPipeline}s precompiled on every resource
 * load; 1.21.1 has no pipeline registry, and eagerly building 840
 * {@code ShaderInstance}s inside {@link RegisterShadersEvent} would add
 * hundreds of GLSL compile+links to every resource (re)load for shaders that
 * are mostly never seen. So the split is:
 *
 * <ul>
 * <li><b>Beams (8): eager.</b> Registered through {@link RegisterShadersEvent},
 * so the vanilla shader loader owns their lifecycle (close + rebuild on every
 * reload) exactly like a vanilla core shader. A beam program that fails to
 * load logs once and leaves its slot {@code null} — {@link #beamRenderType}
 * then reports "unavailable" and {@link ShieldRenderTypes} keeps serving the
 * W5 additive white-texture fallback beam.</li>
 * <li><b>Bubble fx (840): lazy.</b> Compiled on the render thread the first
 * time an effect id is actually drawn ({@link #renderType}), then cached until
 * the next {@link RegisterShadersEvent} (fired inside every
 * {@code GameRenderer.reloadShaders}), where the cache is closed and cleared:
 * vanilla force-closes ALL cached vertex/fragment {@code Program}s at the
 * start of that reload, so surviving instances would reference dead GL
 * programs. A failed compile marks the id failed (no retry spam) until the
 * next reload and falls back to the W5 translucent white membrane.</li>
 * </ul>
 *
 * <p>All 848 programs share the single {@code bubbleshield:bubble/surface}
 * vertex program via the vanilla {@code Program} name cache (one GLSL vertex
 * compile per reload; {@code Program.close()} is idempotent, so the shared
 * program tolerates the multi-owner close that vanilla's own reload flow
 * already performs). Per-program JSONs declare {@code Sampler0} (fx only — the
 * beams sample nothing) plus the vanilla auto-filled uniform set
 * ({@code ModelViewMat}/{@code ProjMat}/{@code Fog*}/{@code GameTime}), which
 * {@code ShaderInstance.setDefaultUniforms} fills on every draw.
 *
 * <p>Render-state shards mirror the W5 fallback types exactly (see
 * {@link ShieldRenderTypes}): the membrane is translucent, no-cull,
 * depth-testing but never depth-writing, sorted on upload; the beam is
 * additive ({@code LIGHTNING_TRANSPARENCY}), back-face culling, unsorted. The
 * only differences are the custom shader and, for the membrane, the surface
 * atlas ({@link #SURFACE_ATLAS}, 8x4 grid of 32 seamless grayscale tiles;
 * R/G/B = coarse/mid/fine structure, A = emission mask) on {@code Sampler0}
 * instead of the white texture.
 *
 * <p>This class NEVER consults the W9 Iris gate — {@link ShieldRenderTypes}
 * does, and only calls in here below it (custom pipelines misrender under an
 * active shaderpack; see docs/COMPAT.md).
 *
 * <p>Extends {@link RenderType} purely to reach the protected
 * {@code RenderStateShard} shards; never instantiated.
 */
@EventBusSubscriber(modid = BubbleShield.MOD_ID, value = Dist.CLIENT)
public final class ShieldPipelines extends RenderType {
	private static final Logger LOGGER = LogUtils.getLogger();

	/**
	 * The generated surface texture atlas every bubble fragment shader samples via
	 * {@code Sampler0}: 4096x2048 RGBA, an 8x4 grid of 32 seamless 512px tiles.
	 * Per texel: R = coarse structural layer, G = mid-scale detail, B = fine grain,
	 * A = emission mask (glow, NOT transparency). All channels are neutral grayscale
	 * data — the shaders tint them with the live per-effect palette (recolor-safe).
	 * blur = true matches the atlas .mcmeta (the shaders tap it smoothly).
	 */
	private static final ResourceLocation SURFACE_ATLAS = BubbleShield.id("textures/effect/surface_atlas.png");

	/**
	 * The rendered beam styles, in {@link BeamStyle#RENDERED} order (STORM, PULSE,
	 * HELIX, PRISM, VOID, EMBER, RUNIC, FROST). A small fixed NAMED set — one
	 * hand-written shader per style under
	 * {@code assets/bubbleshield/shaders/core/beam/beam_<name>.fsh} — unlike the
	 * per-effect fx_* set, so their eager registration cost is negligible.
	 */
	private static final String[] BEAM_STYLE_NAMES = {"storm", "pulse", "helix", "prism", "void", "ember", "runic", "frost"};

	/** Lazily compiled per-effect programs; slots null until first drawn, cleared on reload. */
	private static final ShaderInstance[] FX_SHADERS = new ShaderInstance[EffectRegistry.COUNT];
	/** Ids whose lazy compile failed this reload cycle: logged once, no retry until reload. */
	private static final boolean[] FX_FAILED = new boolean[EffectRegistry.COUNT];
	/**
	 * Per-effect render types, created alongside the first successful compile and
	 * kept for the session (their {@code ShaderStateShard} supplier re-reads
	 * {@link #FX_SHADERS} on every draw, so reloads swap the program under a
	 * STABLE {@link RenderType} identity — buffer maps keyed on the type survive).
	 */
	private static final RenderType[] FX_TYPES = new RenderType[EffectRegistry.COUNT];

	/**
	 * Event-registered beam programs by {@code BeamStyle.renderIndex()}. The
	 * vanilla shader loader closes these on reload ({@code shutdownShaders});
	 * this class only nulls the slots when the next registration cycle starts.
	 */
	private static final ShaderInstance[] BEAM_SHADERS = new ShaderInstance[BEAM_STYLE_NAMES.length];
	private static final RenderType[] BEAM_TYPES = buildBeamTypes();

	private ShieldPipelines(String name, VertexFormat format, VertexFormat.Mode mode, int bufferSize,
			boolean affectsCrumbling, boolean sortOnUpload, Runnable setupState, Runnable clearState) {
		super(name, format, mode, bufferSize, affectsCrumbling, sortOnUpload, setupState, clearState);
		throw new UnsupportedOperationException("Shard-access holder; never instantiate");
	}

	/**
	 * Shader (re)load boundary, fired inside every {@code GameRenderer.reloadShaders}
	 * (first load and each F3+T): drops the lazy fx cache — vanilla already
	 * force-closed every cached vertex/fragment {@code Program} at the start of
	 * this reload, so the instances are dead either way and closing them here
	 * only releases their linked GL program objects — and registers the eight
	 * beam programs with the vanilla loader. Registration is per-style
	 * fail-soft: {@code ShaderInstance}'s constructor is where the GLSL
	 * compile+link happens, so a broken beam shader throws HERE, gets logged,
	 * and leaves its slot null (W5 fallback beam) instead of failing the whole
	 * resource reload.
	 */
	@SubscribeEvent
	static void onRegisterShaders(RegisterShadersEvent event) {
		for (int id = 0; id < FX_SHADERS.length; id++) {
			if (FX_SHADERS[id] != null) {
				FX_SHADERS[id].close();
				FX_SHADERS[id] = null;
			}
			FX_FAILED[id] = false;
		}

		for (int i = 0; i < BEAM_SHADERS.length; i++) {
			// Old instances are owned (and about to be closed) by the vanilla
			// loader; only the slot is cleared here so a failed re-registration
			// can never leave a stale pointer to a closed program.
			BEAM_SHADERS[i] = null;
			int index = i;
			String name = "beam_" + BEAM_STYLE_NAMES[i];
			try {
				event.registerShader(
						new ShaderInstance(event.getResourceProvider(), BubbleShield.id("beam/" + name),
								DefaultVertexFormat.POSITION_TEX_COLOR),
						shader -> BEAM_SHADERS[index] = shader);
			} catch (IOException | RuntimeException e) {
				LOGGER.warn("[bubbleshield] beam shader {} failed to load; its beam style falls back to the plain additive column", name, e);
			}
		}
	}

	/**
	 * The effect's dedicated membrane render type, compiling its program on
	 * first use (render thread — same thread every vanilla shader compiles on).
	 * Returns {@code null} while the program is unavailable (compile failed this
	 * reload cycle); {@link ShieldRenderTypes#renderType} then serves the W5
	 * white-texture fallback membrane. Ids are clamped like {@link EffectRegistry#get}.
	 */
	static RenderType renderType(int effectId) {
		int id = Math.clamp(effectId, 0, EffectRegistry.COUNT - 1);
		if (FX_FAILED[id]) {
			return null;
		}

		if (FX_SHADERS[id] == null) {
			try {
				FX_SHADERS[id] = new ShaderInstance(Minecraft.getInstance().getResourceManager(),
						BubbleShield.id(EffectRegistry.get(id).surfaceShaderId()),
						DefaultVertexFormat.POSITION_TEX_COLOR);
			} catch (IOException | RuntimeException e) {
				FX_FAILED[id] = true;
				LOGGER.warn("[bubbleshield] surface shader fx_{} failed to load; effect falls back to the W5 membrane", String.format("%03d", id), e);
				return null;
			}

			if (FX_TYPES[id] == null) {
				FX_TYPES[id] = buildFxType(id);
			}
		}

		return FX_TYPES[id];
	}

	/**
	 * The render type for a rendered beam style, by {@code BeamStyle.renderIndex()}
	 * (0 = STORM .. 7 = FROST), or {@code null} while its event-registered program
	 * is unavailable (load failed, or mid-reload before the loader delivers it) —
	 * {@link ShieldRenderTypes#beamRenderType} then serves the W5 fallback beam.
	 * Indices are clamped defensively so a stale/foreign synced ordinal can never
	 * index out of bounds.
	 */
	static RenderType beamRenderType(int styleIndex) {
		int index = Math.clamp(styleIndex, 0, BEAM_TYPES.length - 1);
		return BEAM_SHADERS[index] != null ? BEAM_TYPES[index] : null;
	}

	/**
	 * Membrane state mirrors the W5 fallback exactly (translucent, both faces,
	 * depth-test without depth-write, sorted on upload) with the per-effect
	 * program and the surface atlas on {@code Sampler0} swapped in.
	 */
	private static RenderType buildFxType(int id) {
		return create(
				String.format("bubbleshield_fx_%03d", id),
				DefaultVertexFormat.POSITION_TEX_COLOR,
				VertexFormat.Mode.QUADS,
				786432,
				false,
				true,
				RenderType.CompositeState.builder()
						.setShaderState(new ShaderStateShard(() -> FX_SHADERS[id]))
						.setTextureState(new TextureStateShard(SURFACE_ATLAS, true, false))
						.setTransparencyState(TRANSLUCENT_TRANSPARENCY)
						.setCullState(NO_CULL)
						.setDepthTestState(LEQUAL_DEPTH_TEST)
						.setWriteMaskState(COLOR_WRITE)
						.createCompositeState(false));
	}

	/**
	 * Beam state mirrors the W5 fallback beam (additive {@code LIGHTNING}
	 * blend, default back-face culling, depth-test without depth-write, no
	 * upload sort — additive output is order-independent against itself). No
	 * texture shard: the hand-written beam shaders sample nothing. Built
	 * eagerly — the shard supplier reads {@link #BEAM_SHADERS} at draw time, so
	 * these types are permanent while the programs come and go with reloads.
	 */
	private static RenderType[] buildBeamTypes() {
		RenderType[] types = new RenderType[BEAM_STYLE_NAMES.length];
		for (int i = 0; i < types.length; i++) {
			int index = i;
			types[i] = create(
					"bubbleshield_beam_" + BEAM_STYLE_NAMES[i],
					DefaultVertexFormat.POSITION_TEX_COLOR,
					VertexFormat.Mode.QUADS,
					8192,
					false,
					false,
					RenderType.CompositeState.builder()
							.setShaderState(new ShaderStateShard(() -> BEAM_SHADERS[index]))
							.setTransparencyState(LIGHTNING_TRANSPARENCY)
							.setDepthTestState(LEQUAL_DEPTH_TEST)
							.setWriteMaskState(COLOR_WRITE)
							.createCompositeState(false));
		}

		return types;
	}
}
