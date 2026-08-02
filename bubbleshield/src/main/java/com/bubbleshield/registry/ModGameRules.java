package com.bubbleshield.registry;

import net.minecraft.world.level.GameRules;

/**
 * Custom server game rules. Upstream (Fabric 26.2) registers
 * {@code bubbleshield:strength} through the Fabric game-rule API with a built-in
 * 10..500 range; 1.21.1 game rule ids are plain camelCase strings and vanilla
 * integer rules carry no range, so the rule is {@code bubbleshieldStrength} and
 * readers clamp to [{@link #MIN_STRENGTH_PERCENT}, {@link #MAX_STRENGTH_PERCENT}]
 * (see {@code ShieldLogic.strengthPercent}).
 */
public final class ModGameRules {
	public static final int MIN_STRENGTH_PERCENT = 10;
	public static final int MAX_STRENGTH_PERCENT = 500;
	public static final int DEFAULT_STRENGTH_PERCENT = 100;

	/**
	 * Global shield strength percent (10..500, default 100): scales every shield's
	 * max health (see {@code ShieldLogic.maxHealthFor}). Set it with
	 * {@code /gamerule bubbleshieldStrength <percent>}.
	 */
	public static final GameRules.Key<GameRules.IntegerValue> STRENGTH = GameRules.register(
		"bubbleshieldStrength", GameRules.Category.MISC, GameRules.IntegerValue.create(DEFAULT_STRENGTH_PERCENT));

	private ModGameRules() {
	}

	public static void init() {
		// Forces the static registration above to run during mod construction.
	}
}
