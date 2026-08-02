package com.bubbleshield.registry;

import java.util.function.Supplier;

import com.bubbleshield.BubbleShield;
import com.bubbleshield.menu.BubbleShieldMenu;

import net.minecraft.core.registries.Registries;
import net.minecraft.world.inventory.MenuType;

import net.neoforged.neoforge.common.extensions.IMenuTypeExtension;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModMenus {
	public static final DeferredRegister<MenuType<?>> MENUS =
		DeferredRegister.create(Registries.MENU, BubbleShield.MOD_ID);

	/**
	 * Menu type that syncs the projector's BlockPos to the client when the menu opens
	 * (upstream: Fabric {@code ExtendedMenuType} with {@code BlockPos.STREAM_CODEC};
	 * here: NeoForge {@code IMenuTypeExtension} reading the pos the server wrote via
	 * {@code ServerPlayer.openMenu(provider, pos)}), so the client screen can address
	 * settings packets to the right block.
	 */
	public static final Supplier<MenuType<BubbleShieldMenu>> BUBBLE_SHIELD =
		MENUS.register("bubble_shield",
			() -> IMenuTypeExtension.create((containerId, inventory, buf) -> new BubbleShieldMenu(containerId, inventory, buf.readBlockPos())));

	private ModMenus() {
	}
}
