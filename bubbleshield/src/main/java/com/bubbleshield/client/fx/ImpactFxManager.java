package com.bubbleshield.client.fx;

import com.bubbleshield.client.ClientShieldManager;
import com.bubbleshield.net.ShieldPayloads;

import net.minecraft.client.Minecraft;
import net.minecraft.core.GlobalPos;

/**
 * Client entry point of the impact-feedback pipeline: ingests
 * {@link ShieldPayloads.ImpactBatchS2C} batches (via {@link #handleImpactBatch},
 * called by {@code ClientNet}'s payload handler on the client main thread), fans
 * the entries into the {@link ImpactTracker} store (consumed by WP-Dyn's mesh
 * deformation and the contact flash) and reconciles server-confirmed CONTACT
 * presses into the {@link ContactFlash} predictor. Also owns the shared
 * end-of-client-tick sequence ({@link #endClientTick} — tracker pruning, flash
 * prediction, break-ghost sweep, in upstream's exact order) and the
 * disconnect/level-change reset ({@link #resetAll}); both are wired by
 * {@code BubbleShieldClient.GameEvents} (upstream used Fabric's
 * {@code ClientTickEvents.END_CLIENT_TICK} / {@code DISCONNECT} /
 * {@code AFTER_CLIENT_LEVEL_CHANGE}).
 *
 * <p>TODO(W7): {@code ProximityHum.tick} rides this tick hook and
 * {@code InteriorRenderer.clearCache} the reset, once those land.
 */
public final class ImpactFxManager {
	private ImpactFxManager() {
	}

	/**
	 * Ingests one visual-event batch. MUST run on the client thread (NeoForge's
	 * {@code playToClient} handlers already do).
	 */
	public static void handleImpactBatch(ShieldPayloads.ImpactBatchS2C payload) {
		GlobalPos pos = new GlobalPos(payload.dimension(), payload.pos());
		for (ShieldPayloads.ImpactEntry entry : payload.entries()) {
			int kind = entry.kind() & 0xFF;
			if (kind >= ShieldPayloads.ImpactEntry.KIND_COUNT) {
				// Forward compatibility: a newer server's unknown kinds are skipped.
				continue;
			}

			// A PASSAGE the ApertureTracker already predicted locally (same
			// shield, similar direction, within 10 ticks) is that
			// prediction's server echo: adding it too would superpose a
			// second ripple at ~2x amplitude.
			if ((kind == ShieldPayloads.ImpactEntry.KIND_PASSAGE_IN || kind == ShieldPayloads.ImpactEntry.KIND_PASSAGE_OUT)
					&& ApertureTracker.matchesLocalPassage(pos, entry.dir())) {
				continue;
			}

			ImpactTracker.addServerImpact(pos, entry.dir(), entry.strengthUnsigned() / 255.0F, kind);
			if (kind == ShieldPayloads.ImpactEntry.KIND_CONTACT) {
				ContactFlash.onServerContact(pos, entry.dir());
			}

			// WP-Evt break ghost: the break's sync (active=false, radius 0)
			// always lands BEFORE this batch, so the replica is armed here.
			if (kind == ShieldPayloads.ImpactEntry.KIND_BREAK) {
				ClientShieldManager.onBreakImpact(pos);
			}
		}
	}

	/** The shared end-of-client-tick sequence; runs on {@code ClientTickEvent.Post}. */
	public static void endClientTick(Minecraft mc) {
		ImpactTracker.endClientTick(mc);
		ApertureTracker.endClientTick(mc);
		ContactFlash.tick(mc);
		// TODO(W7): ProximityHum.tick(mc).
		// Sweeps removed projectors whose replica was retained for the break ghost.
		ClientShieldManager.endClientTick();
	}

	/** Full reset: disconnect or client level change (wired from {@code BubbleShieldClient}). */
	public static void resetAll() {
		ImpactTracker.clear();
		ApertureTracker.clear();
		ContactFlash.reset();
		// TODO(W6+): InteriorRenderer.clearCache() once the interior wave lands.
	}
}
