package dev.aetherion.datagen;

import dev.aetherion.Aetherion;
import net.fabricmc.fabric.api.datagen.v1.DataGeneratorEntrypoint;
import net.fabricmc.fabric.api.datagen.v1.FabricDataGenerator;

public final class AetherionDataGenerator implements DataGeneratorEntrypoint {
	@Override
	public void onInitializeDataGenerator(FabricDataGenerator dataGenerator) {
		dataGenerator.createPack();
		Aetherion.LOGGER.info("AETHERION data generation initialized; base resources are maintained in src/main/resources");
	}
}
