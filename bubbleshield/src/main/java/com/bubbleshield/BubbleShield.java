package com.bubbleshield;

import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Bubble Shield — NeoForge 1.21.1 port of the Fabric 26.2 mod.
 *
 * Wave W0: scaffold only. Registries, networking, shield logic, effects and
 * client rendering are ported in later waves (see UserFeedback.md).
 */
@Mod(BubbleShield.MOD_ID)
public final class BubbleShield {
    public static final String MOD_ID = "bubbleshield";
    public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

    public BubbleShield(IEventBus modEventBus, ModContainer modContainer) {
        LOGGER.info("Bubble Shield scaffold loaded (NeoForge 1.21.1). Port waves W1+ pending.");
    }
}
