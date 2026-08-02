package com.bubbleshield.net;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.bubbleshield.block.BubbleShieldBlockEntity;
import com.bubbleshield.effect.EffectRegistry;
import com.bubbleshield.shield.ShieldState;

import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

/**
 * Server-side networking: validates C2S shield requests and replicates shield
 * state to clients.
 *
 * <p>W2 port state: the shield-tracking registry (used by resonance linking),
 * the shared validation helpers and the protocol constants are ported; every
 * actual packet flow (C2S receivers, S2C broadcasts, join/respawn/level-change
 * resyncs, boss-bar sweeps, rate limiting) is TODO(W3) — the S2C entry points
 * below are deliberate no-ops until the NeoForge payload wiring lands.
 */
public final class ServerNet {
	/** A request is only honoured when the sender stands within this distance of the projector. */
	public static final double MAX_INTERACT_DISTANCE = 8.0;
	public static final int MIN_DIAMETER = 8;
	public static final int MAX_DIAMETER = 200;
	public static final int MIN_EFFECT_ID = 0;
	public static final int MAX_EFFECT_ID = EffectRegistry.COUNT - 1;
	/**
	 * Hard cap on whitelist entries to keep payloads and NBT bounded. Delegates to
	 * {@link ShieldState#MAX_WHITELIST_SIZE} so the C2S add path and the NBT load
	 * path share the exact same cap (same pattern as MAX_SHIELD_NAME_LENGTH).
	 */
	public static final int MAX_WHITELIST_SIZE = ShieldState.MAX_WHITELIST_SIZE;
	/** Hard cap on the custom shield name, matching the SetNameC2S/ShieldSyncS2C codecs. */
	public static final int MAX_SHIELD_NAME_LENGTH = ShieldState.MAX_NAME_LENGTH;
	/**
	 * D7c: per-player token bucket for the CUSTOM C2S payloads (settings, whitelist,
	 * name, color, active): burst capacity and sustained rate of 20 packets per
	 * second (refilled 1 token per server tick). Vanilla container flows (menu
	 * open, slot clicks) are deliberately NOT rate-limited here.
	 */
	public static final int C2S_TOKENS_PER_SECOND = 20;

	/**
	 * WP-Evt: visual-event batches are only relevant to players who can SEE the
	 * bubble, so the receiver set is distance-filtered to
	 * {@code currentRadius + IMPACT_RECEIVE_MARGIN} of the center (unlike the
	 * level-wide sync broadcast, whose replica must exist before a player
	 * approaches). 32 blocks of margin comfortably covers the surface flash
	 * draw distance while keeping volley spam off far-away connections.
	 */
	public static final double IMPACT_RECEIVE_MARGIN = 32.0;

	/**
	 * Loaded shield projectors per level, used to sync existing shields to joining
	 * players and by the resonance-link resolution. Only touched from the server thread.
	 */
	private static final Map<ServerLevel, Set<BubbleShieldBlockEntity>> LOADED_SHIELDS = new IdentityHashMap<>();

	private ServerNet() {
	}

	/** TODO(W3): register C2S payload receivers + join/respawn/level-change/unload event hooks. */
	public static void register() {
	}

	/**
	 * Broadcasts the current state of the given shield to every player in its level.
	 * Called from the block entity whenever the shield state changes.
	 * TODO(W3): send ShieldSyncS2C to every player in the shield's level.
	 */
	public static void syncShield(BubbleShieldBlockEntity shield) {
	}

	/**
	 * Sends one coalesced visual-event batch for the given shield to every player
	 * within {@code max(targetRadius, currentRadius) + }{@link #IMPACT_RECEIVE_MARGIN}
	 * of its center. Called by {@code BubbleShieldBlockEntity.flushImpacts} (at most
	 * once per shield per tick, OUTSIDE the sync diff gate).
	 * TODO(W3): send ImpactBatchS2C to nearby players.
	 */
	public static void broadcastImpacts(BubbleShieldBlockEntity shield, List<ShieldPayloads.ImpactEntry> entries) {
	}

	/**
	 * Broadcasts to every player in the shield's level that the shield is gone.
	 * TODO(W3): send ShieldRemoveS2C to every player in the shield's level.
	 */
	public static void broadcastRemove(BubbleShieldBlockEntity shield) {
	}

	/** Registers a loaded shield block entity. Server thread only. */
	public static void trackShield(BubbleShieldBlockEntity shield) {
		if (shield.getLevel() instanceof ServerLevel level) {
			LOADED_SHIELDS.computeIfAbsent(level, l -> Collections.newSetFromMap(new IdentityHashMap<>())).add(shield);
		}
	}

	/**
	 * @return an immutable snapshot of the loaded shield projectors in {@code level}
	 * (empty when none are loaded). Server thread only; used by the resonance-link
	 * resolution so a shield can find same-owner overlapping partners.
	 */
	public static java.util.Collection<BubbleShieldBlockEntity> loadedShields(ServerLevel level) {
		Set<BubbleShieldBlockEntity> shields = LOADED_SHIELDS.get(level);
		return shields == null ? List.of() : List.copyOf(shields);
	}

	/** Unregisters a shield block entity that is being removed. Server thread only. */
	public static void untrackShield(BubbleShieldBlockEntity shield) {
		if (shield.getLevel() instanceof ServerLevel level) {
			Set<BubbleShieldBlockEntity> shields = LOADED_SHIELDS.get(level);
			if (shields != null) {
				shields.remove(shield);
				if (shields.isEmpty()) {
					LOADED_SHIELDS.remove(level);
				}
			}
		}
	}

	/**
	 * Sanitizes a requested custom shield name: control/formatting characters are
	 * stripped, surrounding whitespace is trimmed and the result is capped at
	 * {@link #MAX_SHIELD_NAME_LENGTH} characters. May return an empty string, which
	 * means "clear the custom name". Delegates to {@link ShieldState#sanitizeName}
	 * so the C2S request path and the NBT load path share the exact same rule.
	 */
	public static String sanitizeShieldName(String raw) {
		return ShieldState.sanitizeName(raw);
	}

	/**
	 * Pure validation for a requested shield color override: -1 means "reset to the
	 * effect's authored palette", every other accepted value must be a fully opaque
	 * ARGB color (alpha byte 0xFF). Translucent or alpha-less colors are rejected so
	 * a hostile client can never make the bubble surface/HUD invisible. Delegates to
	 * {@link ShieldState#isValidColorOverride} so the C2S request path and the NBT
	 * load path share the exact same rule.
	 */
	public static boolean isValidColorOverride(int argb) {
		return ShieldState.isValidColorOverride(argb);
	}

	/**
	 * Mutating requests are owner-only. A shield without a recorded owner (e.g. placed
	 * before this rule existed) is claimed by the first interacting player; afterwards
	 * only an exact UUID match is accepted. Public so every server-side mutation path
	 * (C2S payloads in W3, the /bubbleshield command) shares the exact same rule.
	 */
	public static boolean isOwner(ServerPlayer player, BubbleShieldBlockEntity shield) {
		UUID owner = shield.getShieldState().ownerUuid;
		if (owner == null) {
			shield.setOwner(player);
			return true;
		}

		return owner.equals(player.getUUID());
	}
}
