package com.bubbleshield.net;

import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.advancements.ModCriteria;
import com.bubbleshield.block.BubbleShieldBlockEntity;
import com.bubbleshield.effect.EffectRegistry;
import com.bubbleshield.shield.BeamStyle;
import com.bubbleshield.shield.ShieldLogic;
import com.bubbleshield.shield.ShieldMode;
import com.bubbleshield.shield.ShieldShape;
import com.bubbleshield.shield.ShieldState;

import net.minecraft.core.BlockPos;
import net.minecraft.core.SectionPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.util.Mth;
import net.minecraft.util.StringUtil;
import net.minecraft.world.phys.Vec3;

import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.level.LevelEvent;
import net.neoforged.neoforge.event.server.ServerStoppedEvent;
import net.neoforged.neoforge.network.PacketDistributor;
import net.neoforged.neoforge.network.handling.IPayloadContext;

import org.jetbrains.annotations.Nullable;

/**
 * Server-side networking: validates C2S shield requests and replicates shield
 * state to clients.
 *
 * <p>W3 port notes: the C2S receivers are {@code IPayloadHandler} methods hooked
 * up by {@link ShieldPayloads#registerHandlers} (NeoForge runs play handlers on
 * the server thread by default, matching upstream Fabric's
 * {@code ServerPlayNetworking} threading, so the token buckets and the shield
 * registry stay server-thread-only). The Fabric lifecycle hooks map to NeoForge
 * game-bus events: JOIN&rarr;{@link PlayerEvent.PlayerLoggedInEvent},
 * DISCONNECT&rarr;{@link PlayerEvent.PlayerLoggedOutEvent},
 * AFTER_PLAYER_CHANGE_LEVEL&rarr;{@link PlayerEvent.PlayerChangedDimensionEvent}
 * (fired after the move, so the player's level IS the destination),
 * AFTER_RESPAWN&rarr;{@link PlayerEvent.PlayerRespawnEvent},
 * ServerLevelEvents.UNLOAD&rarr;{@link LevelEvent.Unload} and
 * SERVER_STOPPED&rarr;{@link ServerStoppedEvent}. S2C sends go through
 * {@link PacketDistributor} instead of {@code PlayerLookup} loops.
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

	/** Per-player C2S token buckets, keyed by player UUID. Only touched from the server thread. */
	private static final Map<UUID, TokenBucket> C2S_BUCKETS = new HashMap<>();

	/** Mutable token-bucket state: remaining tokens plus the tick they were last refilled at. */
	private static final class TokenBucket {
		int tokens = C2S_TOKENS_PER_SECOND;
		long lastRefillTick;
	}

	/**
	 * Takes one token from the sender's C2S bucket (refill 1/tick, capacity
	 * {@link #C2S_TOKENS_PER_SECOND}).
	 *
	 * @param kind payload name used in the drop log line.
	 * @return true when the packet is within budget; false means "drop it" (already
	 * logged). Public only so gametests can exercise the bucket directly.
	 */
	public static boolean tryConsumeC2S(ServerPlayer player, String kind) {
		long tick = player.serverLevel().getServer().getTickCount();
		TokenBucket bucket = C2S_BUCKETS.computeIfAbsent(player.getUUID(), uuid -> {
			TokenBucket fresh = new TokenBucket();
			fresh.lastRefillTick = tick;
			return fresh;
		});

		// Refill 1 token per elapsed tick, capped at the burst capacity. max(0, ...)
		// guards a tick counter regression (integrated-server restart reuses UUIDs).
		bucket.tokens = (int) Math.min(C2S_TOKENS_PER_SECOND, bucket.tokens + Math.max(0L, tick - bucket.lastRefillTick));
		bucket.lastRefillTick = tick;
		if (bucket.tokens <= 0) {
			BubbleShield.LOGGER.warn("Dropping {} from {}: shield C2S rate limit ({}/s) exceeded",
					kind, player.getGameProfile().getName(), C2S_TOKENS_PER_SECOND);
			return false;
		}

		bucket.tokens--;
		return true;
	}

	private ServerNet() {
	}

	/**
	 * Hooks the join/disconnect/level-change/respawn/unload/stop lifecycle onto the
	 * NeoForge game bus. Called once from the mod constructor; the C2S payload
	 * receivers are registered separately on the MOD bus by
	 * {@link ShieldPayloads#registerHandlers}.
	 */
	public static void register() {
		NeoForge.EVENT_BUS.addListener(ServerNet::onPlayerLoggedIn);
		NeoForge.EVENT_BUS.addListener(ServerNet::onPlayerLoggedOut);
		NeoForge.EVENT_BUS.addListener(ServerNet::onPlayerChangedDimension);
		NeoForge.EVENT_BUS.addListener(ServerNet::onPlayerRespawn);
		NeoForge.EVENT_BUS.addListener(ServerNet::onLevelUnload);
		NeoForge.EVENT_BUS.addListener(ServerNet::onServerStopped);
	}

	private static void onPlayerLoggedIn(PlayerEvent.PlayerLoggedInEvent event) {
		if (event.getEntity() instanceof ServerPlayer player) {
			backfillWhitelistUuid(player);
			syncLevelShields(player, player.serverLevel());
		}
	}

	/**
	 * Boss-bar membership hardening: shields normally diff their boss event members
	 * only when the projector chunk ticks, so a logged-out player's ServerPlayer ref
	 * would otherwise be held (and packets attempted) until the next projector tick.
	 * Sweep the player out of every loaded shield's boss event immediately.
	 */
	private static void onPlayerLoggedOut(PlayerEvent.PlayerLoggedOutEvent event) {
		if (event.getEntity() instanceof ServerPlayer player) {
			removeFromBossEvents(player);
			C2S_BUCKETS.remove(player.getUUID());
		}
	}

	/**
	 * The client clears its shield replica whenever it gets a new ClientLevel, so every
	 * server-side path that moves a player to a (new) level must re-send the snapshots.
	 * The same sweep applies: the origin level's shields would keep the teleported
	 * player on their boss bars until their projector chunk next ticks.
	 */
	private static void onPlayerChangedDimension(PlayerEvent.PlayerChangedDimensionEvent event) {
		if (event.getEntity() instanceof ServerPlayer player) {
			removeFromBossEvents(player);
			syncLevelShields(player, player.serverLevel());
		}
	}

	private static void onPlayerRespawn(PlayerEvent.PlayerRespawnEvent event) {
		if (event.getEntity() instanceof ServerPlayer player) {
			syncLevelShields(player, player.serverLevel());
		}
	}

	/**
	 * LOADED_SHIELDS holds ServerLevel keys; clear on unload/stop so integrated-server
	 * restarts do not leak levels or stale block entities.
	 */
	private static void onLevelUnload(LevelEvent.Unload event) {
		if (event.getLevel() instanceof ServerLevel level) {
			LOADED_SHIELDS.remove(level);
		}
	}

	private static void onServerStopped(ServerStoppedEvent event) {
		LOADED_SHIELDS.clear();
		C2S_BUCKETS.clear();
	}

	/** C2S receiver for {@link ShieldPayloads.SetSettingsC2S}; runs on the server thread. */
	public static void handleSetSettings(ShieldPayloads.SetSettingsC2S payload, IPayloadContext context) {
		if (!(context.player() instanceof ServerPlayer player) || !tryConsumeC2S(player, "SetSettingsC2S")) {
			return;
		}

		BubbleShieldBlockEntity shield = validatedShield(player, payload.pos());
		if (shield == null || !isOwner(player, shield)) {
			return;
		}

		int diameter = Mth.clamp(payload.diameter(), MIN_DIAMETER, MAX_DIAMETER);
		int effectId = Mth.clamp(payload.effectId(), MIN_EFFECT_ID, MAX_EFFECT_ID);
		int shapeOrdinal = Mth.clamp(payload.shapeOrdinal(), 0, ShieldShape.values().length - 1);
		int modeOrdinal = Mth.clamp(payload.modeOrdinal(), 0, ShieldMode.values().length - 1);
		int beamStyleOrdinal = Mth.clamp(payload.beamStyleOrdinal(), 0, BeamStyle.values().length - 1);
		shield.setSettings(diameter, effectId, shapeOrdinal, modeOrdinal, payload.cycleEnabled(), beamStyleOrdinal);
	}

	/** C2S receiver for {@link ShieldPayloads.WhitelistModifyC2S}; runs on the server thread. */
	public static void handleWhitelistModify(ShieldPayloads.WhitelistModifyC2S payload, IPayloadContext context) {
		if (!(context.player() instanceof ServerPlayer player) || !tryConsumeC2S(player, "WhitelistModifyC2S")) {
			return;
		}

		BubbleShieldBlockEntity shield = validatedShield(player, payload.pos());
		if (shield == null || !isOwner(player, shield)) {
			return;
		}

		String name = payload.name().trim();
		if (name.isEmpty() || !StringUtil.isValidPlayerName(name)) {
			return;
		}

		if (payload.add()) {
			if (shield.getShieldState().whitelistNames.size() >= MAX_WHITELIST_SIZE) {
				return;
			}

			shield.whitelistAdd(player.serverLevel().getServer(), name, player);
		} else {
			shield.whitelistRemove(player.serverLevel().getServer(), name);
		}
	}

	/** C2S receiver for {@link ShieldPayloads.SetNameC2S}; runs on the server thread. */
	public static void handleSetName(ShieldPayloads.SetNameC2S payload, IPayloadContext context) {
		if (!(context.player() instanceof ServerPlayer player) || !tryConsumeC2S(player, "SetNameC2S")) {
			return;
		}

		BubbleShieldBlockEntity shield = validatedShield(player, payload.pos());
		if (shield == null || !isOwner(player, shield)) {
			return;
		}

		// An empty (sanitized) name clears the custom name; the boss bar and HUD
		// then fall back to the effect name.
		String name = sanitizeShieldName(payload.name());
		shield.setCustomName(name);

		// Only setting an actual name is a christening; clearing it is not.
		if (!name.isEmpty()) {
			ModCriteria.SHIELD_NAMED.trigger(player);
		}
	}

	/** C2S receiver for {@link ShieldPayloads.SetColorC2S}; runs on the server thread. */
	public static void handleSetColor(ShieldPayloads.SetColorC2S payload, IPayloadContext context) {
		if (!(context.player() instanceof ServerPlayer player) || !tryConsumeC2S(player, "SetColorC2S")) {
			return;
		}

		BubbleShieldBlockEntity shield = validatedShield(player, payload.pos());
		if (shield == null || !isOwner(player, shield)) {
			return;
		}

		if (!isValidColorOverride(payload.argb())) {
			return;
		}

		shield.setColorOverride(payload.argb());

		// Only applying a real recolor counts; resetting to the authored palette does not.
		if (payload.argb() != ShieldState.NO_COLOR_OVERRIDE) {
			ModCriteria.SHIELD_RECOLORED.trigger(player);
		}
	}

	/** C2S receiver for {@link ShieldPayloads.SetActiveC2S}; runs on the server thread. */
	public static void handleSetActive(ShieldPayloads.SetActiveC2S payload, IPayloadContext context) {
		if (!(context.player() instanceof ServerPlayer player) || !tryConsumeC2S(player, "SetActiveC2S")) {
			return;
		}

		BubbleShieldBlockEntity shield = validatedShield(player, payload.pos());
		if (shield == null || !isOwner(player, shield)) {
			return;
		}

		if (payload.active()) {
			// Credit the requesting player with the shield_activated criterion on success.
			// A7: when the plain activation fails, offer the emergency revive — it
			// only fires when the failure was SOLELY the break cooldown (with >= 200
			// ticks remaining, once per window) and the owner has at least the
			// tier-scaled reviveFuelCost stored fuel-seconds to pay (fix 3).
			if (!shield.tryActivate(player)) {
				shield.tryEmergencyRevive(player);
			}
		} else {
			shield.setActive(false);
		}
	}

	/**
	 * Sends the given player a snapshot of every loaded shield in {@code level}. Inactive
	 * shields are included on purpose: their whitelist backs the owner GUI after a relog,
	 * and the renderer/screen effects already skip shields whose active flag is false.
	 */
	private static void syncLevelShields(ServerPlayer player, ServerLevel level) {
		Set<BubbleShieldBlockEntity> shields = LOADED_SHIELDS.get(level);
		if (shields == null) {
			return;
		}

		for (BubbleShieldBlockEntity shield : shields) {
			PacketDistributor.sendToPlayer(player, syncPayload(shield, level));
		}
	}

	/**
	 * Removes the player from every loaded shield's boss event, across all levels
	 * ({@code ServerBossEvent.removePlayer} is a no-op for non-members). A player
	 * still (or newly) inside a shield is re-added by the projector's next
	 * {@code updateBossBar} tick, so sweeping broadly is safe.
	 */
	private static void removeFromBossEvents(ServerPlayer player) {
		for (Set<BubbleShieldBlockEntity> shields : LOADED_SHIELDS.values()) {
			for (BubbleShieldBlockEntity shield : shields) {
				var bossEvent = shield.getBossEvent();
				if (bossEvent != null) {
					bossEvent.removePlayer(player);
				}
			}
		}
	}

	/**
	 * Resolves name-only whitelist entries for a joining player: any loaded shield whose
	 * whitelist contains the player's name (case-insensitively) but not their UUID gets
	 * the UUID backfilled, so the barrier and client edge-dissolve recognise them. The
	 * learned name-to-UUID association is stored so a later whitelist removal can revoke
	 * the UUID without any name-to-id cache (remote) lookup.
	 */
	private static void backfillWhitelistUuid(ServerPlayer player) {
		String name = player.getGameProfile().getName();
		UUID uuid = player.getUUID();
		for (Set<BubbleShieldBlockEntity> shields : LOADED_SHIELDS.values()) {
			for (BubbleShieldBlockEntity shield : shields) {
				ShieldState state = shield.getShieldState();
				if (!state.whitelistUuids.contains(uuid) && containsIgnoreCase(state.whitelistNames, name)) {
					state.whitelistUuids.add(uuid);
					state.rememberWhitelistUuid(name, uuid);
					shield.markUpdated();
				}
			}
		}
	}

	private static boolean containsIgnoreCase(Set<String> names, String name) {
		for (String existing : names) {
			if (existing.equalsIgnoreCase(name)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Broadcasts the current state of the given shield to every player in its level.
	 * Called from the block entity whenever the shield state changes.
	 */
	public static void syncShield(BubbleShieldBlockEntity shield) {
		if (!(shield.getLevel() instanceof ServerLevel level)) {
			return;
		}

		PacketDistributor.sendToPlayersInDimension(level, syncPayload(shield, level));
	}

	/**
	 * Sends one coalesced visual-event batch for the given shield to every player
	 * within {@code max(targetRadius, currentRadius) + }{@link #IMPACT_RECEIVE_MARGIN}
	 * of its center. Called by {@code BubbleShieldBlockEntity.flushImpacts} (at most
	 * once per shield per tick, OUTSIDE the sync diff gate). The range deliberately
	 * uses the LARGER of target and current radius: the batch flushes AFTER the hit
	 * (and after flushSync), so the post-hit currentRadius is already shrunken —
	 * and exactly 0 for a break, which would strand the BREAK omni-pulse on a
	 * 32-block ring while everyone who watched the full-size bubble sees nothing.
	 */
	public static void broadcastImpacts(BubbleShieldBlockEntity shield, List<ShieldPayloads.ImpactEntry> entries) {
		if (entries.isEmpty() || !(shield.getLevel() instanceof ServerLevel level)) {
			return;
		}

		ShieldPayloads.ImpactBatchS2C payload = new ShieldPayloads.ImpactBatchS2C(shield.getBlockPos(), level.dimension(), entries);
		Vec3 center = Vec3.atCenterOf(shield.getBlockPos());
		double range = Math.max(shield.getShieldState().targetRadius, shield.currentRadius()) + IMPACT_RECEIVE_MARGIN;
		for (ServerPlayer player : level.players()) {
			if (player.position().distanceTo(center) <= range) {
				PacketDistributor.sendToPlayer(player, payload);
			}
		}
	}

	/** Broadcasts to every player in the shield's level that the shield is gone. */
	public static void broadcastRemove(BubbleShieldBlockEntity shield) {
		if (!(shield.getLevel() instanceof ServerLevel level)) {
			return;
		}

		PacketDistributor.sendToPlayersInDimension(level, new ShieldPayloads.ShieldRemoveS2C(shield.getBlockPos(), level.dimension()));
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

	private static ShieldPayloads.ShieldSyncS2C syncPayload(BubbleShieldBlockEntity shield, ServerLevel level) {
		ShieldState state = shield.getShieldState();
		long cooldownTicks = Math.max(0L, state.cooldownUntil - level.getGameTime());
		float healthFrac = state.maxHealth > 0.0F ? state.health / state.maxHealth : 0.0F;
		return new ShieldPayloads.ShieldSyncS2C(
			shield.getBlockPos(),
			level.dimension(),
			new ShieldPayloads.ShieldVisual(
				state.active,
				state.effectId,
				state.targetRadius,
				ShieldLogic.currentRadius(state),
				healthFrac,
				state.maxHealth,
				shield.tier(),
				state.shape.ordinal(),
				state.colorOverride,
				state.beamStyle.ordinal()
			),
			List.copyOf(state.whitelistUuids),
			List.copyOf(state.whitelistNames),
			(int) (cooldownTicks / ShieldLogic.TICKS_PER_FUEL_SECOND),
			Optional.ofNullable(state.ownerUuid),
			state.customName
		);
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
	 * @return the shield block entity at {@code pos} if the chunk is already loaded and the
	 * player is close enough, otherwise null. Distance and load checks run BEFORE the
	 * block entity lookup so a client-supplied position can never force a chunk load.
	 * (1.21.1: 26.2's {@code Level.isLoaded} does not exist and {@code hasChunkAt} is
	 * vanilla-deprecated; {@code getChunkNow} returns the chunk only when it is fully
	 * loaded and never triggers a load — exactly the guarantee this gate needs.)
	 */
	private static @Nullable BubbleShieldBlockEntity validatedShield(ServerPlayer player, BlockPos pos) {
		if (player.position().distanceTo(Vec3.atCenterOf(pos)) > MAX_INTERACT_DISTANCE) {
			return null;
		}

		ServerLevel level = player.serverLevel();
		if (level.getChunkSource().getChunkNow(
				SectionPos.blockToSectionCoord(pos.getX()), SectionPos.blockToSectionCoord(pos.getZ())) == null) {
			return null;
		}

		if (!(level.getBlockEntity(pos) instanceof BubbleShieldBlockEntity shield)) {
			return null;
		}

		return shield;
	}

	/**
	 * Mutating requests are owner-only. A shield without a recorded owner (e.g. placed
	 * before this rule existed) is claimed by the first interacting player; afterwards
	 * only an exact UUID match is accepted. Public so every server-side mutation path
	 * (C2S payloads here, the /bubbleshield command) shares the exact same rule.
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
