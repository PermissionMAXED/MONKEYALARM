package com.bubbleshield.net;

import com.bubbleshield.client.ClientShieldManager;
import com.bubbleshield.client.fx.ImpactFxManager;

import net.neoforged.fml.loading.FMLEnvironment;
import net.neoforged.neoforge.network.handling.IPayloadContext;

/**
 * Client-bound payload handlers, registered by {@link ShieldPayloads#registerHandlers}
 * via {@code PayloadRegistrar.playToClient} (NeoForge runs them on the client main
 * thread by default, matching upstream's {@code context.client().execute(...)} hop).
 *
 * <p>Deliberately Dist-safe (W3): NeoForge requires a handler reference at
 * registration time on BOTH dists, so this class lives in common code and the
 * {@code ClientNet::handle*} method refs classload on a dedicated server without
 * hitting {@code net.minecraft.client}. The handler BODIES only ever run on the
 * client; the {@code FMLEnvironment.dist} guard keeps even a misdelivered payload
 * from classloading client-only code on a server. W7 wired sync/remove into
 * {@link ClientShieldManager} (the replica behind the GUI screens and HUD layers);
 * W5 wired the impact batches into {@link ImpactFxManager} (the fx pipeline
 * behind the membrane deformation and the contact flash).
 */
public final class ClientNet {
	private ClientNet() {
	}

	/**
	 * Upserts the client shield replica keyed by pos+dimension
	 * ({@link ClientShieldManager#handleSync}: snapshot fields, whitelist for the
	 * owner GUI, cooldown seconds for the HUD, edge-dissolve whitelist check).
	 */
	public static void handleShieldSync(ShieldPayloads.ShieldSyncS2C payload, IPayloadContext context) {
		if (FMLEnvironment.dist.isClient()) {
			ClientShieldManager.handleSync(payload);
		}
	}

	/**
	 * Drops (or break-retains, per upstream's ghost grace window) the client
	 * shield replica at pos+dimension via {@link ClientShieldManager#handleRemove}.
	 */
	public static void handleShieldRemove(ShieldPayloads.ShieldRemoveS2C payload, IPayloadContext context) {
		if (FMLEnvironment.dist.isClient()) {
			ClientShieldManager.handleRemove(payload);
		}
	}

	/**
	 * Feeds the batch into the client impact FX via
	 * {@link ImpactFxManager#handleImpactBatch} (surface flashes, BREAK
	 * omni-pulse/ghost arming, passage ripples), which skips entries with
	 * {@code kind >= ImpactEntry.KIND_COUNT} for forward compat.
	 */
	public static void handleImpactBatch(ShieldPayloads.ImpactBatchS2C payload, IPayloadContext context) {
		if (FMLEnvironment.dist.isClient()) {
			ImpactFxManager.handleImpactBatch(payload);
		}
	}
}
