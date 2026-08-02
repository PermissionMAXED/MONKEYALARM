package com.bubbleshield.registry;

import java.util.Comparator;

import net.minecraft.server.level.TicketType;
import net.minecraft.world.level.ChunkPos;

/**
 * Chunk ticket types owned by the mod. Upstream 26.2 registers a flag-based
 * {@code TicketType} in {@code BuiltInRegistries.TICKET_TYPE}; on 1.21.1 ticket
 * types are plain (unregistered) values created via {@link TicketType#create}.
 */
public final class ModTicketTypes {
	/**
	 * D5: keeps an ACTIVE projector's chunk loaded and ticking so the shield stays
	 * enforced when no player is near the projector (a diameter-200 bubble's far
	 * edge is ~100 blocks from its chunk). Added with radius 1 via
	 * {@code ServerChunkCache.addRegionTicket}, i.e. ticket level 32 =
	 * BLOCK_TICKING at the projector chunk — enough for the block-entity ticker
	 * (and thus all shield logic) to keep running.
	 *
	 * <p>Chosen approach: a finite 100-tick (~5 s) timeout, RE-ARMED every active
	 * server tick — the distance manager dedups on (type, chunk, level, key) and
	 * resets the countdown, so re-arming is cheap. Fix 7: the projector
	 * deliberately NEVER releases the ticket explicitly (not on deactivate, break
	 * or removal) — two projectors in one chunk SHARE one ticket and an explicit
	 * release from the one going down would strip the other's coverage. Expiry is
	 * timeout-only: once nothing re-arms it, the chunk stays loaded at most ~5 s
	 * longer. Deliberately NOT persistent: after a reload the first ticked
	 * activation re-arms it, and no stale saved ticket can pin chunks of a
	 * projector that is gone.
	 */
	public static final TicketType<ChunkPos> SHIELD_PROJECTOR =
		TicketType.create("bubbleshield:shield_projector", Comparator.comparingLong(ChunkPos::toLong), 100);

	private ModTicketTypes() {
	}

	public static void init() {
		// Forces the static creation above to run during mod construction.
	}
}
