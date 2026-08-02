package com.bubbleshield.client.compat;

import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;

import com.bubbleshield.BubbleShield;

import net.neoforged.fml.ModList;

/**
 * W9 Iris soft-detection — pure reflection, NO compile-time, Gradle or
 * mods.toml dependency (see docs/COMPAT.md). When a shaderpack is active the
 * shaderpack owns both the shader pipeline and the post-processing chain, so
 * two things must yield:
 * <ul>
 *   <li>the membrane/beam render types stay on the vanilla
 *       {@code position_tex_color} fallback — {@code ShieldRenderTypes}
 *       consults {@link #shaderPackInUse()} and W6's custom per-effect
 *       pipelines may only ever be returned below that gate;</li>
 *   <li>the in-bubble screen post-effects (W8) must not run —
 *       {@link #postFxAllowed()} is the frozen contract the W8
 *       {@code ScreenEffectManager} port gates on. GUI layers (contact flash,
 *       shield HUD) are unaffected: they draw in the GUI pass, which Iris
 *       leaves alone.</li>
 * </ul>
 *
 * <p>Detection is two-staged and lazy (first render-path query, never during
 * mod construction): {@code ModList.isLoaded} for the {@code iris} /
 * {@code oculus} mod ids, then a reflective bind of
 * {@code net.irisshaders.iris.api.v0.IrisApi#isShaderPackInUse()} into a
 * {@link MethodHandle} (near-direct call cost; the probe runs per queried
 * shield per frame). Any failure — API class missing, signature drift, the
 * probe throwing — logs once and trips permanently to "no shaderpack", i.e.
 * a broken Iris build degrades to vanilla-fallback rendering rather than
 * crashing the render loop.
 *
 * <p>Client-only by construction: referenced exclusively from render/FX code
 * behind {@code Dist.CLIENT}, so this class never loads on a dedicated server.
 */
public final class IrisCompat {
	/** {@code iris} is the NeoForge 1.21.1 mod id; {@code oculus} covers the legacy (Lex)Forge port. */
	private static final String[] IRIS_MOD_IDS = {"iris", "oculus"};
	private static final String IRIS_API_CLASS = "net.irisshaders.iris.api.v0.IrisApi";

	/** Trips permanently on the first probe failure so a broken Iris cannot spam the log per frame. */
	private static volatile boolean tripped;

	private IrisCompat() {
	}

	/** True when Iris (or Oculus) is installed at all, shaderpack active or not. */
	public static boolean irisPresent() {
		return Probe.HANDLE != null;
	}

	/**
	 * True while Iris reports an active shaderpack. False when Iris is absent,
	 * when no pack is enabled, or when the probe ever failed ({@link #tripped}).
	 * Cheap enough for per-frame use (single bound {@link MethodHandle} invoke;
	 * Iris' implementation is an {@code Optional.isPresent()} field read).
	 */
	public static boolean shaderPackInUse() {
		MethodHandle probe = Probe.HANDLE;
		if (probe == null || tripped) {
			return false;
		}

		try {
			return (boolean) probe.invokeExact();
		} catch (Throwable t) {
			tripped = true;
			BubbleShield.LOGGER.warn("Iris shaderpack probe failed; treating shaderpacks as inactive from now on", t);
			return false;
		}
	}

	/**
	 * W8 contract: the screen post-effect chain may only run while this is true.
	 * A shaderpack owns the post pipeline — layering the per-effect post chains
	 * over it double-processes the frame and breaks packs that re-bind the main
	 * target, so post FX are disabled outright under an active shaderpack.
	 */
	public static boolean postFxAllowed() {
		return !shaderPackInUse();
	}

	/** Lazy holder: resolution runs on the first query, off the mod-construction path. */
	private static final class Probe {
		static final MethodHandle HANDLE = resolve();

		private Probe() {
		}

		private static MethodHandle resolve() {
			boolean present = false;
			for (String modId : IRIS_MOD_IDS) {
				present |= ModList.get().isLoaded(modId);
			}

			if (!present) {
				return null;
			}

			try {
				Class<?> api = Class.forName(IRIS_API_CLASS);
				Object instance = api.getMethod("getInstance").invoke(null);
				MethodHandle handle = MethodHandles.publicLookup()
						.findVirtual(api, "isShaderPackInUse", MethodType.methodType(boolean.class))
						.bindTo(instance);
				BubbleShield.LOGGER.info(
						"Iris detected: membrane/beam use the vanilla-shader fallback and post FX stay off while a shaderpack is active");
				return handle;
			} catch (Throwable t) {
				// API class/signature drift: degrade to "no shaderpack" instead of crashing.
				BubbleShield.LOGGER.warn("Iris is installed but the IrisApi probe could not be bound; assuming no shaderpack", t);
				return null;
			}
		}
	}
}
