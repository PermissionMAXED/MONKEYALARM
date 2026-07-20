package dev.aetherion.altar;

import dev.aetherion.Aetherion;
import dev.aetherion.registry.ModItems;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;

public final class AltarRecipes {
	private static final List<AltarRecipe> RECIPES = List.of(
			new AltarRecipe(
					List.of(ModItems.STARSHARD, ModItems.STARSHARD, ModItems.STARSHARD, ModItems.STARSHARD),
					Items.ENDER_PEARL,
					new ItemStack(ModItems.RIFT_KEY)
			),
			new AltarRecipe(
					List.of(ModItems.STARSHARD, ModItems.STARSHARD, ModItems.STARSHARD, ModItems.STARSHARD),
					Items.IRON_INGOT,
					new ItemStack(ModItems.AETHERIUM_INGOT, 2)
			),
			new AltarRecipe(
					List.of(ModItems.STARSHARD, ModItems.STARSHARD, ModItems.STARSHARD, ModItems.STARSHARD),
					Items.AMETHYST_SHARD,
					new ItemStack(ModItems.ASTRAL_LENS)
			)
	);

	private AltarRecipes() {
	}

	public static Optional<ItemStack> findResult(List<ItemStack> pedestalStacks, ItemStack catalyst) {
		return RECIPES.stream()
				.filter(recipe -> recipe.matches(pedestalStacks, catalyst))
				.findFirst()
				.map(recipe -> recipe.result().copy());
	}

	public static void init() {
		Aetherion.LOGGER.debug("Loaded {} astral altar recipes", RECIPES.size());
	}

	private record AltarRecipe(List<Item> ingredients, Item catalyst, ItemStack result) {
		private boolean matches(List<ItemStack> pedestalStacks, ItemStack catalystStack) {
			if (!catalystStack.isOf(catalyst) || pedestalStacks.size() != ingredients.size()) {
				return false;
			}

			Map<Item, Integer> required = countItems(ingredients);
			Map<Item, Integer> present = new HashMap<>();
			for (ItemStack stack : pedestalStacks) {
				if (stack.isEmpty()) {
					return false;
				}
				present.merge(stack.getItem(), 1, Integer::sum);
			}
			return required.equals(present);
		}

		private static Map<Item, Integer> countItems(List<Item> items) {
			Map<Item, Integer> counts = new HashMap<>();
			for (Item item : items) {
				counts.merge(item, 1, Integer::sum);
			}
			return counts;
		}
	}
}
