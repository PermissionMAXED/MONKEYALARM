package com.bubbleshield;

import com.bubbleshield.advancements.ModCriteria;
import com.bubbleshield.effect.EffectRegistry;
import com.bubbleshield.effect.InsideEffectBehavior;
import com.bubbleshield.effect.behaviors.EffectBehaviors;
import com.bubbleshield.net.ServerNet;
import com.bubbleshield.net.ShieldPayloads;
import com.bubbleshield.registry.ModBlockEntities;
import com.bubbleshield.registry.ModBlocks;
import com.bubbleshield.registry.ModGameRules;
import com.bubbleshield.registry.ModItems;
import com.bubbleshield.registry.ModMenus;
import com.bubbleshield.registry.ModTicketTypes;

import net.minecraft.resources.ResourceLocation;

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Bubble Shield — NeoForge 1.21.1 port of the Fabric 26.2 mod.
 *
 * Wave W1: pure server-side logic — the shield package (state/logic/geometry/
 * linking/fuel), the 840-effect catalogue with its 120 inside behaviors, and the
 * advancement criteria. Wave W2: registries (blocks/items/block entities/menus/
 * creative tab/criteria/game rules/ticket types), block + block entity + menu,
 * and the datapack/assets. Wave W3: networking — payload registration via
 * RegisterPayloadHandlersEvent, ServerNet C2S receivers + S2C broadcasts
 * (PacketDistributor) and the join/respawn/dimension-change resync hooks;
 * commands, loot injection and the client are later waves (see UserFeedback.md).
 */
@Mod(BubbleShield.MOD_ID)
public final class BubbleShield {
	public static final String MOD_ID = "bubbleshield";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	public BubbleShield(IEventBus modEventBus, ModContainer modContainer) {
		ModBlocks.BLOCKS.register(modEventBus);
		ModItems.ITEMS.register(modEventBus);
		ModBlockEntities.BLOCK_ENTITY_TYPES.register(modEventBus);
		ModMenus.MENUS.register(modEventBus);
		ModCriteria.TRIGGER_TYPES.register(modEventBus);
		ModGameRules.init();
		ModTicketTypes.init();

		modEventBus.addListener(ModItems::addToCreativeTabs);

		// W1: the behavior registry + effect catalogue are plain statics, exactly
		// like upstream's ModInitializer body — register all 120 inside behaviors,
		// then let the catalogue self-validate (id uniqueness, 120 x 7 variant
		// cover, resolvable ambient sounds, screen/surface template coverage).
		EffectBehaviors.registerAll();
		EffectRegistry.validate();

		// W3: payload types + handlers on the MOD bus (RegisterPayloadHandlersEvent);
		// player/level/server lifecycle resync hooks on the game bus.
		modEventBus.addListener(ShieldPayloads::registerHandlers);
		ServerNet.register();

		// TODO(W5+): BubbleShieldCommand.register() + CoreLootInjector.
		LOGGER.info("Bubble Shield W1-W3: {} effects / {} behaviors, registries + block/menu + networking (NeoForge 1.21.1).",
				EffectRegistry.COUNT, InsideEffectBehavior.REGISTRY.size());
	}

	public static ResourceLocation id(String path) {
		return ResourceLocation.fromNamespaceAndPath(MOD_ID, path);
	}
}
