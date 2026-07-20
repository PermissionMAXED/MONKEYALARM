package dev.aetherion.client;

import dev.aetherion.Aetherion;
import dev.aetherion.client.hud.AstralChargeHud;
import dev.aetherion.client.hud.AstralChargeState;
import dev.aetherion.client.particle.AetherionParticle;
import dev.aetherion.client.render.AsterEntityRenderer;
import dev.aetherion.client.render.AstralAltarBlockEntityRenderer;
import dev.aetherion.client.render.AstralPedestalBlockEntityRenderer;
import dev.aetherion.client.render.ExpanseDimensionEffects;
import dev.aetherion.client.render.ModEntityModelLayers;
import dev.aetherion.client.render.ScreenShakeManager;
import dev.aetherion.client.render.StarBoltEntityRenderer;
import dev.aetherion.client.render.StarWispEntityRenderer;
import dev.aetherion.client.render.model.AsterModel;
import dev.aetherion.client.render.model.StarWispModel;
import dev.aetherion.client.screen.AstralCodexScreen;
import dev.aetherion.network.AstralChargeSyncPayload;
import dev.aetherion.network.ScreenShakePayload;
import dev.aetherion.registry.ModBlockEntities;
import dev.aetherion.registry.ModEntities;
import dev.aetherion.registry.ModItems;
import dev.aetherion.registry.ModParticles;
import net.fabricmc.api.ClientModInitializer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.client.particle.v1.ParticleFactoryRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.BlockEntityRendererRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.EntityModelLayerRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.EntityRendererRegistry;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.ActionResult;

public final class AetherionClient implements ClientModInitializer {
	@Override
	public void onInitializeClient() {
		UseItemCallback.EVENT.register((player, world, hand) -> {
			if (!world.isClient() || !player.getStackInHand(hand).isOf(ModItems.ASTRAL_CODEX)) {
				return ActionResult.PASS;
			}

			MinecraftClient.getInstance().setScreen(new AstralCodexScreen());
			return ActionResult.SUCCESS;
		});
		BlockEntityRendererRegistry.register(
				ModBlockEntities.ASTRAL_ALTAR,
				AstralAltarBlockEntityRenderer::new
		);
		BlockEntityRendererRegistry.register(
				ModBlockEntities.ASTRAL_PEDESTAL,
				AstralPedestalBlockEntityRenderer::new
		);
		EntityModelLayerRegistry.registerModelLayer(
				ModEntityModelLayers.ASTER,
				AsterModel::getTexturedModelData
		);
		EntityModelLayerRegistry.registerModelLayer(
				ModEntityModelLayers.STAR_WISP,
				StarWispModel::getTexturedModelData
		);
		EntityRendererRegistry.register(ModEntities.ASTER, AsterEntityRenderer::new);
		EntityRendererRegistry.register(ModEntities.STAR_WISP, StarWispEntityRenderer::new);
		EntityRendererRegistry.register(ModEntities.STAR_BOLT, StarBoltEntityRenderer::new);
		ParticleFactoryRegistry.getInstance().register(
				ModParticles.STARLIGHT_MOTE,
				AetherionParticle.StarlightMoteFactory::new
		);
		ParticleFactoryRegistry.getInstance().register(
				ModParticles.RIFT_SPARK,
				AetherionParticle.RiftSparkFactory::new
		);
		ParticleFactoryRegistry.getInstance().register(
				ModParticles.STELLAR_BURST,
				AetherionParticle.StellarBurstFactory::new
		);
		ExpanseDimensionEffects.registerDimensionEffects();
		AstralChargeHud.register();
		ClientPlayNetworking.registerGlobalReceiver(
				AstralChargeSyncPayload.ID,
				(payload, context) -> AstralChargeState.setCharge(payload.charge())
		);
		ClientPlayNetworking.registerGlobalReceiver(
				ScreenShakePayload.ID,
				(payload, context) -> ScreenShakeManager.start(
						payload.intensity(),
						payload.durationTicks()
				)
		);
		ClientTickEvents.END_CLIENT_TICK.register(client -> ScreenShakeManager.tick());
		ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> {
			AstralChargeState.reset();
			ScreenShakeManager.reset();
		});
		Aetherion.LOGGER.info("AETHERION client initialized");
	}
}
