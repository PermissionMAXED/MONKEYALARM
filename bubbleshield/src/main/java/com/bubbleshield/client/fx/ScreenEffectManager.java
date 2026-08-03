package com.bubbleshield.client.fx;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.client.ClientShieldManager;
import com.bubbleshield.client.compat.IrisCompat;
import com.bubbleshield.effect.EffectRegistry;

import com.mojang.blaze3d.systems.RenderSystem;

import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.PostChain;
import net.minecraft.resources.ResourceLocation;

/**
 * Applies the per-effect full-screen post chain ({@code bubbleshield:shaders/post/effect_NN.json})
 * while the local player stands inside an active shield, and clears it again on the way out.
 *
 * <p>Runs on the client tick end (wired in {@code BubbleShieldClient.GameEvents}) and only
 * touches the game renderer when the camera entity is the player itself, so it never fights
 * vanilla's entity post effects (creeper/spider/enderman spectator shaders driven by
 * {@code GameRenderer#checkEntityPostEffect}).
 *
 * <p>The effect is also only applied while the camera is FIRST-PERSON: on an F5 toggle
 * to third person vanilla clears the player-camera post effect
 * ({@code Minecraft#handleKeybinds} calls {@code checkEntityPostEffect(null)}), and
 * re-applying ours every tick would fight that clear. Back in first person the effect
 * is re-applied on the next tick.
 *
 * <p>{@code GameRenderer#currentEffect()} is the source of truth for what is applied:
 * static tracking alone goes stale when vanilla swaps the effect underneath us (e.g. a
 * spectator round trip calls {@code checkEntityPostEffect} which clears the slot), which
 * used to permanently disable the in-bubble effect upstream. The effect is (re-)applied
 * whenever the desired chain differs from the current one — but only when the slot is
 * empty or already holds a bubbleshield chain — and it is only cleared when the current
 * effect is ours, so a vanilla or other-mod post effect is never clobbered in either
 * direction. Ownership is decided by the chain name ({@link PostChain#getName()} is the
 * load ResourceLocation's toString(), so ours always start with {@code bubbleshield:}).
 *
 * <p>1.21.1 legacy deltas vs the upstream 26.2 manager:
 * <ul>
 *   <li>apply goes through the AT-opened {@code GameRenderer#loadEffect} (the modern
 *       public {@code setPostEffect} does not exist yet; upstream's Fabric source used a
 *       mixin invoker for the same reason), clear through the public
 *       {@code shutdownEffect};</li>
 *   <li>the legacy {@code PostPass} only auto-feeds the {@code Time} uniform, a sawtooth
 *       that wraps every SECOND and would visibly pop every slow shader animation.
 *       {@link #frame(Minecraft)} therefore pushes a {@code GameTime} uniform
 *       ({@link RenderSystem#getShaderGameTime()}: day fraction, wraps per 24000-tick
 *       day — the exact semantics of the modern global the upstream shaders read) into
 *       every pass of the active bubbleshield chain each frame, via the public
 *       {@code PostChain#setUniform} ({@code safeGetUniform} no-ops on the blit pass,
 *       which does not declare it).</li>
 * </ul>
 *
 * <p>W9 compat contract: the chain only runs while {@link IrisCompat#postFxAllowed()} —
 * an active shaderpack owns the post pipeline, so under one the manager acts as if the
 * player were outside every bubble (never applies, and clears its own leftover chain).
 */
public final class ScreenEffectManager {
	/** Every bubbleshield chain name starts with this; foreign effects never do. */
	private static final String OWN_PREFIX = BubbleShield.MOD_ID + ":";

	private ScreenEffectManager() {
	}

	/** End-of-client-tick: apply/refresh/clear the in-bubble chain (never a foreign one). */
	public static void tick(Minecraft mc) {
		if (mc.level == null || mc.player == null || mc.getCameraEntity() != mc.player) {
			// Never fight vanilla's camera-entity shaders (spectating a creeper/spider/enderman);
			// vanilla owns the post-effect slot until the camera returns to the player.
			return;
		}

		PostChain current = mc.gameRenderer.currentEffect();
		String currentName = current == null ? null : current.getName();
		boolean currentIsOurs = currentName != null && currentName.startsWith(OWN_PREFIX);
		// Shape-aware containment shared with the HUD element. Third person acts like
		// "not in a bubble": vanilla owns (and clears) the slot outside first person.
		// Same for an active Iris shaderpack (W9 contract): the pack owns the post
		// pipeline, so the manager never applies and sweeps its own leftover chain.
		ClientShieldManager.ClientShield shield = mc.options.getCameraType().isFirstPerson() && IrisCompat.postFxAllowed()
				? ClientShieldManager.findSurroundingShield(mc)
				: null;
		if (shield != null) {
			// Never clobber a foreign (vanilla or other-mod) post effect: only apply into
			// an empty slot or over our own effect.
			if (currentName == null || currentIsOurs) {
				ResourceLocation id = chainId(shield.effectId());
				if (!id.toString().equals(currentName)) {
					mc.gameRenderer.loadEffect(id);
				}
			}
		} else if (currentIsOurs) {
			// Only clear the slot when the applied effect is ours.
			mc.gameRenderer.shutdownEffect();
		}
	}

	/**
	 * Per-frame (RenderFrameEvent.Pre): feed the continuous animation clock to the active
	 * bubbleshield chain. Foreign chains are never touched — their programs do not declare
	 * GameTime, and this manager only owns its own effects.
	 */
	public static void frame(Minecraft mc) {
		PostChain current = mc.gameRenderer.currentEffect();
		if (current != null && current.getName().startsWith(OWN_PREFIX)) {
			current.setUniform("GameTime", RenderSystem.getShaderGameTime());
		}
	}

	/**
	 * Replica-invalidation hook (logout, level unload): drop the chain deterministically
	 * instead of waiting a tick — but, as everywhere, only when the slot holds ours.
	 */
	public static void reset(Minecraft mc) {
		PostChain current = mc.gameRenderer.currentEffect();
		if (current != null && current.getName().startsWith(OWN_PREFIX)) {
			mc.gameRenderer.shutdownEffect();
		}
	}

	/** The legacy chain RL: {@code bubbleshield:shaders/post/effect_NN.json}. */
	private static ResourceLocation chainId(int effectId) {
		return BubbleShield.id("shaders/post/" + EffectRegistry.get(effectId).screenEffectName() + ".json");
	}
}
