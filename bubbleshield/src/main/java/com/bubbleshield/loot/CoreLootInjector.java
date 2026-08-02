package com.bubbleshield.loot;

import com.bubbleshield.registry.ModItems;

import net.minecraft.world.level.storage.loot.BuiltInLootTables;
import net.minecraft.world.level.storage.loot.LootPool;
import net.minecraft.world.level.storage.loot.entries.EmptyLootItem;
import net.minecraft.world.level.storage.loot.entries.LootItem;
import net.minecraft.world.level.storage.loot.functions.SetItemCountFunction;
import net.minecraft.world.level.storage.loot.providers.number.ConstantValue;
import net.minecraft.world.level.storage.loot.providers.number.UniformGenerator;

import net.neoforged.neoforge.common.NeoForge;
import net.neoforged.neoforge.event.LootTableLoadEvent;

/**
 * Injects mod items into structure chest loot tables via extra weighted pools —
 * TWO per matching chest (the existing table content is untouched):
 * <ul>
 * <li>End City treasure + Ancient City: Resonant Core at 1-in-10 (weight 1 vs 9 empty).</li>
 * <li>End City treasure: Aegis Core at 1-in-20 (weight 1 vs 19 empty) — the tier-3
 * endgame core guards the End City's top-floor treasure room (C8).</li>
 * <li>Ancient City: Patch Kit x1-2 at 1-in-8 (weight 1 vs 7 empty) — field-repair
 * supplies in the deep dark (C8).</li>
 * </ul>
 *
 * <p>NeoForge port: Fabric's {@code LootTableEvents.MODIFY} becomes the game-bus
 * {@link LootTableLoadEvent} (fired per table on every datapack (re)load); pools are
 * appended to the built table via {@code LootTable.addPool} instead of the builder.
 */
public final class CoreLootInjector {
	private CoreLootInjector() {
	}

	public static void register() {
		NeoForge.EVENT_BUS.addListener((LootTableLoadEvent event) -> {
			boolean endCity = BuiltInLootTables.END_CITY_TREASURE.equals(event.getKey());
			boolean ancientCity = BuiltInLootTables.ANCIENT_CITY.equals(event.getKey());

			if (endCity || ancientCity) {
				event.getTable().addPool(LootPool.lootPool()
					.setRolls(ConstantValue.exactly(1.0F))
					.add(LootItem.lootTableItem(ModItems.RESONANT_CORE.get()).setWeight(1))
					.add(EmptyLootItem.emptyItem().setWeight(9))
					.build());
			}

			if (endCity) {
				event.getTable().addPool(LootPool.lootPool()
					.setRolls(ConstantValue.exactly(1.0F))
					.add(LootItem.lootTableItem(ModItems.AEGIS_CORE.get()).setWeight(1))
					.add(EmptyLootItem.emptyItem().setWeight(19))
					.build());
			}

			if (ancientCity) {
				event.getTable().addPool(LootPool.lootPool()
					.setRolls(ConstantValue.exactly(1.0F))
					.add(LootItem.lootTableItem(ModItems.PATCH_KIT.get()).setWeight(1)
						.apply(SetItemCountFunction.setCount(UniformGenerator.between(1.0F, 2.0F))))
					.add(EmptyLootItem.emptyItem().setWeight(7))
					.build());
			}
		});
	}
}
