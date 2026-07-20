package dev.aetherion.item;

import dev.aetherion.Aetherion;
import dev.aetherion.registry.ModItems;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.entity.effect.StatusEffectInstance;
import net.minecraft.entity.effect.StatusEffects;
import net.minecraft.server.network.ServerPlayerEntity;

public final class AetheriumArmorSetBonus {
	private static final int REFRESH_INTERVAL_TICKS = 20;
	private static final int EFFECT_DURATION_TICKS = 60;

	private AetheriumArmorSetBonus() {
	}

	public static void init() {
		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (server.getTicks() % REFRESH_INTERVAL_TICKS != 0) {
				return;
			}
			for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
				if (hasFullSet(player)) {
					applySetBonus(player);
				}
			}
		});
		Aetherion.LOGGER.debug("Registered Aetherium armor set bonus");
	}

	private static boolean hasFullSet(ServerPlayerEntity player) {
		return player.getEquippedStack(EquipmentSlot.HEAD).isOf(ModItems.AETHERIUM_HELMET)
				&& player.getEquippedStack(EquipmentSlot.CHEST).isOf(ModItems.AETHERIUM_CHESTPLATE)
				&& player.getEquippedStack(EquipmentSlot.LEGS).isOf(ModItems.AETHERIUM_LEGGINGS)
				&& player.getEquippedStack(EquipmentSlot.FEET).isOf(ModItems.AETHERIUM_BOOTS);
	}

	private static void applySetBonus(ServerPlayerEntity player) {
		player.addStatusEffect(new StatusEffectInstance(
				StatusEffects.SLOW_FALLING,
				EFFECT_DURATION_TICKS,
				0,
				true,
				false,
				true
		));
		player.addStatusEffect(new StatusEffectInstance(
				StatusEffects.NIGHT_VISION,
				EFFECT_DURATION_TICKS,
				0,
				true,
				false,
				true
		));
	}
}
