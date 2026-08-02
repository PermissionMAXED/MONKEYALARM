package com.bubbleshield.net;

import net.neoforged.neoforge.network.handling.IPayloadContext;

/**
 * Client-bound payload handlers, registered by {@link ShieldPayloads#registerHandlers}
 * via {@code PayloadRegistrar.playToClient} (NeoForge runs them on the client main
 * thread by default, matching upstream's {@code context.client().execute(...)} hop).
 *
 * <p>W3 stubs, deliberately Dist-safe: NeoForge requires a handler reference at
 * registration time on BOTH dists, so this class lives in common code and references
 * no client-only classes — a dedicated server can classload the
 * {@code ClientNet::handle*} method refs without hitting {@code net.minecraft.client}.
 * The handler BODIES only ever run on the client. TODO(W5): when the client wave
 * lands, forward each payload into {@code ClientShieldManager} (client source set /
 * {@code Dist.CLIENT}-guarded), keeping this class as the thin common-side seam.
 */
public final class ClientNet {
	private ClientNet() {
	}

	/**
	 * TODO(W5): upsert the client shield replica keyed by pos+dimension
	 * ({@code ClientShieldManager} sync path: snapshot fields, whitelist for the
	 * owner GUI, cooldown seconds for the HUD, edge-dissolve whitelist check).
	 */
	public static void handleShieldSync(ShieldPayloads.ShieldSyncS2C payload, IPayloadContext context) {
	}

	/**
	 * TODO(W5): drop (or break-retain, per upstream's grace window) the client
	 * shield replica at pos+dimension via {@code ClientShieldManager}.
	 */
	public static void handleShieldRemove(ShieldPayloads.ShieldRemoveS2C payload, IPayloadContext context) {
	}

	/**
	 * TODO(W5): feed the batch into the client impact FX ({@code ClientShieldManager}
	 * → {@code ImpactFxManager}: surface flashes, BREAK omni-pulse, passage ripples),
	 * skipping entries with {@code kind >= ImpactEntry.KIND_COUNT} for forward compat.
	 */
	public static void handleImpactBatch(ShieldPayloads.ImpactBatchS2C payload, IPayloadContext context) {
	}
}
