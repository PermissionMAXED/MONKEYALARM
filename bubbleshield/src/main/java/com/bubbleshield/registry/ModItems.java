package com.bubbleshield.registry;

import java.util.List;

import com.bubbleshield.BubbleShield;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.CreativeModeTabs;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;

import net.neoforged.neoforge.event.BuildCreativeModeTabContentsEvent;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModItems {
	public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(BubbleShield.MOD_ID);

	/**
	 * An item whose hover tooltip carries one static translatable line —
	 * {@code <descriptionId>.tooltip} in gray — used by the upgrade cores and the
	 * flux capacitor to state their exact current numbers (HP base, regen/pulse,
	 * cooldown, DR) right on the item. The EN+DE lang parity gametest covers the
	 * {@code .tooltip} keys like every other key.
	 */
	private static final class TooltipItem extends Item {
		TooltipItem(Item.Properties properties) {
			super(properties);
		}

		@Override
		public void appendHoverText(ItemStack stack, Item.TooltipContext context, List<Component> tooltip, TooltipFlag flag) {
			tooltip.add(Component.translatable(this.getDescriptionId() + ".tooltip").withStyle(ChatFormatting.GRAY));
		}
	}

	public static final DeferredItem<BlockItem> BUBBLE_SHIELD_PROJECTOR =
		ITEMS.registerSimpleBlockItem(ModBlocks.BUBBLE_SHIELD_PROJECTOR);

	/** Tier-1 upgrade core: 400 base HP, 25% damage resistance, faster regen, 10-min break cooldown. */
	public static final DeferredItem<Item> RESONANT_CORE =
		ITEMS.register("resonant_core", () -> new TooltipItem(new Item.Properties().stacksTo(1)));

	/** Tier-2 upgrade core: 700 base HP, 40% damage resistance, faster regen, 6-min break cooldown. */
	public static final DeferredItem<Item> PRISMATIC_CORE =
		ITEMS.register("prismatic_core", () -> new TooltipItem(new Item.Properties().stacksTo(1)));

	/** Tier-3 upgrade core: 1200 base HP, 50% damage resistance, fastest regen, 3-min break cooldown. */
	public static final DeferredItem<Item> AEGIS_CORE =
		ITEMS.register("aegis_core", () -> new TooltipItem(new Item.Properties().stacksTo(1)));

	/**
	 * Slot-2 upgrade: while installed, the active shield's passive drain halves and
	 * tier regeneration pulses no longer burn the extra fuel-second.
	 */
	public static final DeferredItem<Item> FLUX_CAPACITOR =
		ITEMS.register("flux_capacitor", () -> new TooltipItem(new Item.Properties().stacksTo(1)));

	/**
	 * C3 repair consumable: right-click an ACTIVE owned/whitelisted projector to
	 * restore 150 shield HP (capped at max), or a broken (cooling-down) one to cut
	 * the remaining break cooldown by 20% of the tier's full cooldown.
	 */
	public static final DeferredItem<Item> PATCH_KIT =
		ITEMS.register("patch_kit", () -> new TooltipItem(new Item.Properties().stacksTo(16)));

	/**
	 * Augment-slot defense module: while socketed, every shield hit gains 30%
	 * plating damage resistance, stacking multiplicatively with the tier DR under
	 * the 70% combined cap. Mutually exclusive with the blast ward (one augment slot).
	 */
	public static final DeferredItem<Item> REINFORCED_PLATING =
		ITEMS.register("reinforced_plating", () -> new TooltipItem(new Item.Properties().stacksTo(1)));

	/**
	 * Augment-slot defense module: while socketed, intercepted EXPLOSIVE projectiles
	 * (fireballs, wither skulls, wind charges) deal 60% less shield damage, applied
	 * to the raw damage BEFORE the tier/plating DR pipeline. Mutually exclusive with
	 * the reinforced plating (one augment slot).
	 */
	public static final DeferredItem<Item> BLAST_WARD =
		ITEMS.register("blast_ward", () -> new TooltipItem(new Item.Properties().stacksTo(1)));

	private ModItems() {
	}

	/** Upstream 26.2 inserts every mod item into the vanilla FUNCTIONAL_BLOCKS tab. */
	public static void addToCreativeTabs(BuildCreativeModeTabContentsEvent event) {
		if (event.getTabKey() == CreativeModeTabs.FUNCTIONAL_BLOCKS) {
			event.accept(BUBBLE_SHIELD_PROJECTOR);
			event.accept(RESONANT_CORE);
			event.accept(PRISMATIC_CORE);
			event.accept(AEGIS_CORE);
			event.accept(FLUX_CAPACITOR);
			event.accept(PATCH_KIT);
			event.accept(REINFORCED_PLATING);
			event.accept(BLAST_WARD);
		}
	}
}
