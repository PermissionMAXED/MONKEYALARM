package dev.aetherion.client.mixin;

import java.util.Map;
import net.minecraft.advancement.AdvancementEntry;
import net.minecraft.advancement.AdvancementProgress;
import net.minecraft.client.network.ClientAdvancementManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.gen.Accessor;

@Mixin(ClientAdvancementManager.class)
public interface ClientAdvancementManagerAccessor {
	@Accessor("advancementProgresses")
	Map<AdvancementEntry, AdvancementProgress> aetherion$getAdvancementProgresses();
}
