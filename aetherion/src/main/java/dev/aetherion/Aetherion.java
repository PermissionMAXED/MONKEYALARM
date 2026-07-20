package dev.aetherion;

import dev.aetherion.altar.AltarRecipes;
import dev.aetherion.charge.AstralChargeManager;
import dev.aetherion.command.AetherionCommands;
import dev.aetherion.entity.AsterSummoningManager;
import dev.aetherion.item.AetheriumArmorSetBonus;
import dev.aetherion.network.ModNetworking;
import dev.aetherion.portal.RiftPortalManager;
import dev.aetherion.registry.ModBlockEntities;
import dev.aetherion.registry.ModBlocks;
import dev.aetherion.registry.ModEntities;
import dev.aetherion.registry.ModItemGroups;
import dev.aetherion.registry.ModItems;
import dev.aetherion.registry.ModParticles;
import dev.aetherion.registry.ModSounds;
import dev.aetherion.worldgen.OreGeneration;
import dev.aetherion.worldgen.StarfallManager;
import net.fabricmc.api.ModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class Aetherion implements ModInitializer {
	public static final String MOD_ID = "aetherion";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitialize() {
		ModBlocks.init();
		ModItems.init();
		ModBlockEntities.init();
		ModParticles.init();
		ModEntities.init();
		ModSounds.init();
		ModItemGroups.init();
		AltarRecipes.init();
		AetheriumArmorSetBonus.init();
		OreGeneration.init();
		ModNetworking.init();
		AetherionCommands.init();
		AstralChargeManager.init();
		AsterSummoningManager.init();
		RiftPortalManager.init();
		StarfallManager.init();

		LOGGER.info("AETHERION initialized");
	}
}
