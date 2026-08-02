package com.bubbleshield.client;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.client.fx.ContactFlash;
import com.bubbleshield.client.fx.ImpactFxManager;
import com.bubbleshield.client.gui.BubbleShieldScreen;
import com.bubbleshield.client.hud.ShieldFlashElement;
import com.bubbleshield.client.hud.ShieldHudElement;
import com.bubbleshield.client.render.ShieldRenderer;
import com.bubbleshield.registry.ModMenus;

import net.minecraft.client.Minecraft;

import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.fml.event.lifecycle.FMLClientSetupEvent;
import net.neoforged.neoforge.client.event.ClientPlayerNetworkEvent;
import net.neoforged.neoforge.client.event.ClientTickEvent;
import net.neoforged.neoforge.client.event.RegisterGuiLayersEvent;
import net.neoforged.neoforge.client.event.RegisterMenuScreensEvent;
import net.neoforged.neoforge.client.event.RenderLevelStageEvent;
import net.neoforged.neoforge.event.level.LevelEvent;

/**
 * Client entrypoint (W7) — upstream's Fabric {@code ClientModInitializer} split
 * across NeoForge's mod-bus registration events:
 * <ul>
 *   <li>{@link RegisterMenuScreensEvent} binds {@link BubbleShieldScreen} to the
 *       projector menu (upstream: {@code MenuScreens.register});</li>
 *   <li>{@link RegisterGuiLayersEvent} registers the two HUD layers in upstream's
 *       {@code HudElementRegistry.addLast} order — status first, contact flash
 *       after (over) it;</li>
 *   <li>{@link FMLClientSetupEvent} loads the client config first, so
 *       {@code FlashIntensity} is live before any layer consults it.</li>
 * </ul>
 *
 * <p>The game-bus side ({@link GameEvents}) replaces Fabric's client lifecycle
 * hooks: END_CLIENT_TICK drives {@link ImpactFxManager#endClientTick}'s shared
 * sequence (impact/aperture tracker pruning, the {@link ContactFlash}
 * prediction, the {@link ClientShieldManager} ghost sweep — upstream's exact
 * order); disconnect and client-level unload (dimension change, respawn) reset
 * the replica and the fx stores — the server re-sends the new level's shields
 * on join/respawn/level-change (W3). W5 adds the membrane + beam renderer on
 * {@code RenderLevelStageEvent.AFTER_TRANSLUCENT_BLOCKS}
 * ({@link ShieldRenderer#render}).
 *
 * <p>TODO(W6): {@code InteriorRenderer}/{@code SceneCopy} bootstrap; TODO(W7):
 * {@code ScreenEffectManager} + {@code ProximityHum} registration land with
 * their waves.
 */
@EventBusSubscriber(modid = BubbleShield.MOD_ID, value = Dist.CLIENT)
public final class BubbleShieldClient {
	private BubbleShieldClient() {
	}

	@SubscribeEvent
	public static void onClientSetup(FMLClientSetupEvent event) {
		// Config first: FlashIntensity (and later the interior density) must be
		// live before any HUD layer or renderer consults them.
		BubbleShieldClientConfig.load();
	}

	@SubscribeEvent
	public static void onRegisterMenuScreens(RegisterMenuScreensEvent event) {
		event.register(ModMenus.BUBBLE_SHIELD.get(), BubbleShieldScreen::new);
	}

	@SubscribeEvent
	public static void onRegisterGuiLayers(RegisterGuiLayersEvent event) {
		event.registerAboveAll(BubbleShield.id("shield_status"), new ShieldHudElement());
		// The contact flash draws after (over) the status text, matching upstream's addLast order.
		event.registerAboveAll(BubbleShield.id("shield_flash"), new ShieldFlashElement());
	}

	/** Game-bus client events: tick wiring + replica lifecycle. */
	@EventBusSubscriber(modid = BubbleShield.MOD_ID, value = Dist.CLIENT)
	static final class GameEvents {
		private GameEvents() {
		}

		@SubscribeEvent
		public static void onClientTickPost(ClientTickEvent.Post event) {
			// Upstream order lives in ImpactFxManager.endClientTick: trackers first,
			// then the contact-flash prediction, then the replica ghost sweep.
			ImpactFxManager.endClientTick(Minecraft.getInstance());
		}

		@SubscribeEvent
		public static void onRenderLevelStage(RenderLevelStageEvent event) {
			// The renderer gates on AFTER_TRANSLUCENT_BLOCKS itself.
			ShieldRenderer.render(event);
		}

		@SubscribeEvent
		public static void onLoggingOut(ClientPlayerNetworkEvent.LoggingOut event) {
			ClientShieldManager.clear();
			ImpactFxManager.resetAll();
		}

		@SubscribeEvent
		public static void onLevelUnload(LevelEvent.Unload event) {
			// A new ClientLevel (dimension change, respawn) invalidates the replica;
			// the server re-sends the new level's shields (W3 resync hooks).
			if (event.getLevel().isClientSide()) {
				ClientShieldManager.clear();
				ImpactFxManager.resetAll();
			}
		}
	}
}
