package com.bubbleshield.client.gui;

import com.bubbleshield.client.ClientShieldManager;
import com.bubbleshield.net.ShieldPayloads;

import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.components.EditBox;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;

import net.neoforged.neoforge.network.PacketDistributor;

/**
 * Custom shield-name editor for a shield projector: type a name (max 32 characters)
 * and save it. An empty name clears the custom name, falling back to the effect name
 * on the boss bar and HUD. The current name comes from the client shield replica kept
 * in sync by {@code ShieldSyncS2C}; the server sanitizes and owner-gates the request.
 */
public class ShieldNameScreen extends Screen {
	private static final int MAX_NAME_LENGTH = 32;

	private final Screen parent;
	private final BlockPos pos;
	private EditBox nameField;

	public ShieldNameScreen(Screen parent, BlockPos pos) {
		super(Component.translatable("gui.bubbleshield.name.title"));
		this.parent = parent;
		this.pos = pos;
	}

	@Override
	protected void init() {
		int centerX = this.width / 2;

		this.nameField = new EditBox(this.font, centerX - 100, 40, 200, 20, Component.translatable("gui.bubbleshield.name.title"));
		this.nameField.setMaxLength(MAX_NAME_LENGTH);
		ClientShieldManager.ClientShield shield = ClientShieldManager.get(this.pos);
		if (shield != null) {
			this.nameField.setValue(shield.customName());
		}

		this.addRenderableWidget(this.nameField);

		this.addRenderableWidget(
			Button.builder(Component.translatable("gui.bubbleshield.name.save"), button -> this.sendName())
				.bounds(centerX - 100, 64, 200, 20)
				.build()
		);
		this.addRenderableWidget(
			Button.builder(Component.translatable("gui.bubbleshield.back"), button -> this.onClose())
				.bounds(centerX - 75, this.height - 28, 150, 20)
				.build()
		);
	}

	private void sendName() {
		// An empty value is sent on purpose: it clears the custom name server-side.
		PacketDistributor.sendToServer(new ShieldPayloads.SetNameC2S(this.pos, this.nameField.getValue().trim()));
	}

	@Override
	public void render(GuiGraphics guiGraphics, int mouseX, int mouseY, float partialTick) {
		super.render(guiGraphics, mouseX, mouseY, partialTick);
		guiGraphics.drawCenteredString(this.font, this.title, this.width / 2, 16, -1);
	}

	@Override
	public void onClose() {
		this.minecraft.setScreen(this.parent);
	}
}
