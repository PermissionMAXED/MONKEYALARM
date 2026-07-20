package dev.aetherion.registry;

import dev.aetherion.AetherionId;
import net.minecraft.item.Item;
import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.tag.TagKey;

public final class ModItemTags {
	public static final TagKey<Item> SHOWS_CHARGE = TagKey.of(
			RegistryKeys.ITEM,
			AetherionId.of("shows_charge")
	);

	private ModItemTags() {
	}
}
