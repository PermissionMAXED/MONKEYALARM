package dev.aetherion.client.hud;

import dev.aetherion.AetherionId;
import dev.aetherion.registry.ModItemTags;
import net.fabricmc.fabric.api.client.rendering.v1.hud.HudElementRegistry;
import net.fabricmc.fabric.api.client.rendering.v1.hud.VanillaHudElements;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.render.RenderTickCounter;
import net.minecraft.text.Text;

public final class AstralChargeHud {
	private static final int WIDTH = 82;
	private static final int HEIGHT = 5;

	private AstralChargeHud() {
	}

	public static void register() {
		HudElementRegistry.attachElementAfter(
				VanillaHudElements.INFO_BAR,
				AetherionId.of("astral_charge"),
				AstralChargeHud::render
		);
	}

	private static void render(DrawContext context, RenderTickCounter tickCounter) {
		MinecraftClient client = MinecraftClient.getInstance();
		if (client.player == null || !shouldShow(client)) {
			return;
		}

		int charge = AstralChargeState.getCharge();
		int x = (context.getScaledWindowWidth() - WIDTH) / 2;
		int y = context.getScaledWindowHeight() - 39;
		int fillWidth = Math.round((WIDTH - 2) * charge / 100.0F);

		context.fill(RenderPipelines.GUI, x, y, x + WIDTH, y + HEIGHT, 0xD0130D29);
		context.fill(RenderPipelines.GUI, x + 1, y + 1, x + WIDTH - 1, y + HEIGHT - 1, 0xFF2A1E4A);
		if (fillWidth > 0) {
			context.fill(
					RenderPipelines.GUI,
					x + 1,
					y + 1,
					x + 1 + fillWidth,
					y + HEIGHT - 1,
					0xFF33E0FF
			);
		}
		context.drawCenteredTextWithShadow(
				client.textRenderer,
				Text.translatable("hud.aetherion.astral_charge", charge),
				context.getScaledWindowWidth() / 2,
				y - 9,
				0xFFF5C542
		);
	}

	private static boolean shouldShow(MinecraftClient client) {
		return client.player.getMainHandStack().isIn(ModItemTags.SHOWS_CHARGE)
				|| client.player.getOffHandStack().isIn(ModItemTags.SHOWS_CHARGE);
	}
}
