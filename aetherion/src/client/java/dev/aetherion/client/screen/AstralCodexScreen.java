package dev.aetherion.client.screen;

import dev.aetherion.AetherionId;
import dev.aetherion.client.mixin.ClientAdvancementManagerAccessor;
import java.util.ArrayList;
import java.util.List;
import net.minecraft.advancement.AdvancementEntry;
import net.minecraft.advancement.AdvancementProgress;
import net.minecraft.client.gl.RenderPipelines;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.widget.ButtonWidget;
import net.minecraft.client.network.ClientAdvancementManager;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;

public final class AstralCodexScreen extends Screen {
	private static final int PAGE_SIZE = 7;
	private static final int LIST_WIDTH = 142;
	private static final int ROW_HEIGHT = 20;
	private static final List<CodexEntry> ENTRIES = List.of(
			entry("starshard", "starshard"),
			entry("aetherium", "aetherium"),
			entry("astral_altar", "altar"),
			entry("rift_key", "rift_key"),
			entry("rift_gateway", "rift_key"),
			entry("the_expanse", "expanse"),
			entry("astral_charge", "root"),
			entry("starcaller_staff", "staff"),
			entry("phase_pearl", "pearl"),
			entry("starfall", "expanse"),
			entry("sundered_sigil", "sigil"),
			entry("aster", "aster"),
			entry("star_wisp", "aster"),
			entry("aetherium_armor", "armor_set")
	);

	private final List<ButtonWidget> entryButtons = new ArrayList<>();
	private ButtonWidget previousButton;
	private ButtonWidget nextButton;
	private int page;
	private int selectedEntry;

	public AstralCodexScreen() {
		super(Text.translatable("screen.aetherion.astral_codex.title"));
	}

	@Override
	protected void init() {
		entryButtons.clear();
		int left = 18;
		int top = 38;
		for (int slot = 0; slot < PAGE_SIZE; slot++) {
			int buttonSlot = slot;
			ButtonWidget button = ButtonWidget.builder(
					Text.empty(),
					ignored -> selectVisibleEntry(buttonSlot)
			).dimensions(left, top + slot * ROW_HEIGHT, LIST_WIDTH, 18).build();
			entryButtons.add(addDrawableChild(button));
		}

		int navigationY = top + PAGE_SIZE * ROW_HEIGHT + 2;
		previousButton = addDrawableChild(ButtonWidget.builder(
				Text.translatable("screen.aetherion.astral_codex.previous"),
				ignored -> {
					page--;
					selectedEntry = page * PAGE_SIZE;
					updateButtons();
				}
		).dimensions(left, navigationY, 69, 18).build());
		nextButton = addDrawableChild(ButtonWidget.builder(
				Text.translatable("screen.aetherion.astral_codex.next"),
				ignored -> {
					page++;
					selectedEntry = page * PAGE_SIZE;
					updateButtons();
				}
		).dimensions(left + 73, navigationY, 69, 18).build());
		updateButtons();
	}

	@Override
	public void render(DrawContext context, int mouseX, int mouseY, float deltaTicks) {
		super.render(context, mouseX, mouseY, deltaTicks);

		int contentLeft = 178;
		int panelTop = 32;
		int panelRight = width - 18;
		int panelBottom = height - 24;
		context.fill(
				RenderPipelines.GUI,
				contentLeft - 8,
				panelTop,
				panelRight,
				panelBottom,
				0xD0120D27
		);
		context.drawCenteredTextWithShadow(
				textRenderer,
				title,
				width / 2,
				13,
				0xFFF5C542
		);

		CodexEntry entry = ENTRIES.get(selectedEntry);
		boolean unlocked = isUnlocked(entry.advancement());
		Text entryTitle = unlocked
				? Text.translatable(entry.titleKey())
				: Text.translatable("screen.aetherion.astral_codex.locked");
		Text body = unlocked
				? Text.translatable(entry.bodyKey())
				: Text.translatable("screen.aetherion.astral_codex.locked");
		context.drawTextWithShadow(
				textRenderer,
				entryTitle,
				contentLeft,
				panelTop + 12,
				0xFF33E0FF
		);
		context.drawWrappedTextWithShadow(
				textRenderer,
				body,
				contentLeft,
				panelTop + 32,
				Math.max(40, panelRight - contentLeft - 10),
				0xFFE8E3F5
		);
	}

	@Override
	public boolean shouldPause() {
		return false;
	}

	private void selectVisibleEntry(int slot) {
		int index = page * PAGE_SIZE + slot;
		if (index < ENTRIES.size()) {
			selectedEntry = index;
			updateButtons();
		}
	}

	private void updateButtons() {
		int first = page * PAGE_SIZE;
		for (int slot = 0; slot < entryButtons.size(); slot++) {
			int index = first + slot;
			ButtonWidget button = entryButtons.get(slot);
			button.visible = index < ENTRIES.size();
			if (!button.visible) {
				continue;
			}

			CodexEntry entry = ENTRIES.get(index);
			button.setMessage(isUnlocked(entry.advancement())
					? Text.translatable(entry.titleKey())
					: Text.translatable("screen.aetherion.astral_codex.locked"));
			button.active = index != selectedEntry;
		}
		previousButton.active = page > 0;
		nextButton.active = (page + 1) * PAGE_SIZE < ENTRIES.size();
	}

	private boolean isUnlocked(Identifier advancementId) {
		if (client == null || client.getNetworkHandler() == null) {
			return false;
		}

		ClientAdvancementManager manager = client.getNetworkHandler().getAdvancementHandler();
		AdvancementEntry advancement = manager.get(advancementId);
		if (advancement == null) {
			return false;
		}
		AdvancementProgress progress = ((ClientAdvancementManagerAccessor) manager)
				.aetherion$getAdvancementProgresses()
				.get(advancement);
		return progress != null && progress.isDone();
	}

	private static CodexEntry entry(String key, String advancement) {
		return new CodexEntry(
				"codex.aetherion." + key + ".title",
				"codex.aetherion." + key + ".body",
				AetherionId.of(advancement)
		);
	}

	private record CodexEntry(String titleKey, String bodyKey, Identifier advancement) {
	}
}
