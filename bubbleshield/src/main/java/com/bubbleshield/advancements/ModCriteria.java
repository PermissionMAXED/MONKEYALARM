package com.bubbleshield.advancements;

import java.util.UUID;

import com.bubbleshield.BubbleShield;

import net.minecraft.advancements.CriterionTrigger;
import net.minecraft.core.registries.Registries;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;

import net.neoforged.neoforge.registries.DeferredRegister;

import org.jetbrains.annotations.Nullable;

/**
 * The mod's advancement criterion triggers, registered through a
 * {@link DeferredRegister} over pre-built singletons so trigger call sites keep
 * the upstream {@code ModCriteria.X.trigger(...)} shape. Registration must run
 * before datapack advancements referencing these triggers are loaded.
 */
public final class ModCriteria {
	public static final DeferredRegister<CriterionTrigger<?>> TRIGGER_TYPES =
		DeferredRegister.create(Registries.TRIGGER_TYPE, BubbleShield.MOD_ID);

	public static final ShieldActivatedTrigger SHIELD_ACTIVATED = new ShieldActivatedTrigger();
	public static final ShieldBrokenTrigger SHIELD_BROKEN = new ShieldBrokenTrigger();
	public static final PlayerWhitelistedTrigger PLAYER_WHITELISTED = new PlayerWhitelistedTrigger();
	public static final ShieldNamedTrigger SHIELD_NAMED = new ShieldNamedTrigger();
	public static final ShieldRecoloredTrigger SHIELD_RECOLORED = new ShieldRecoloredTrigger();
	public static final ShieldsLinkedTrigger SHIELDS_LINKED = new ShieldsLinkedTrigger();
	public static final DamageAbsorbedTrigger DAMAGE_ABSORBED = new DamageAbsorbedTrigger();

	static {
		TRIGGER_TYPES.register("shield_activated", () -> SHIELD_ACTIVATED);
		TRIGGER_TYPES.register("shield_broken", () -> SHIELD_BROKEN);
		TRIGGER_TYPES.register("player_whitelisted", () -> PLAYER_WHITELISTED);
		TRIGGER_TYPES.register("shield_named", () -> SHIELD_NAMED);
		TRIGGER_TYPES.register("shield_recolored", () -> SHIELD_RECOLORED);
		TRIGGER_TYPES.register("shields_linked", () -> SHIELDS_LINKED);
		TRIGGER_TYPES.register("damage_absorbed", () -> DAMAGE_ABSORBED);
	}

	private ModCriteria() {
	}

	/** Fires {@link #SHIELD_BROKEN} for the shield's owner if they are online. */
	public static void fireShieldBroken(ServerLevel level, @Nullable UUID ownerUuid) {
		if (ownerUuid == null) {
			return;
		}

		ServerPlayer owner = level.getServer().getPlayerList().getPlayer(ownerUuid);
		if (owner != null) {
			SHIELD_BROKEN.trigger(owner);
		}
	}

	/** Fires {@link #SHIELDS_LINKED} for the linked shields' owner if they are online. */
	public static void fireShieldsLinked(ServerLevel level, @Nullable UUID ownerUuid) {
		if (ownerUuid == null) {
			return;
		}

		ServerPlayer owner = level.getServer().getPlayerList().getPlayer(ownerUuid);
		if (owner != null) {
			SHIELDS_LINKED.trigger(owner);
		}
	}

	/**
	 * Fires {@link #DAMAGE_ABSORBED} for the shield's owner if they are online,
	 * carrying the projector's lifetime absorbed total (C7 "unbroken"). Same
	 * owner-resolution rule as {@link #fireShieldBroken}: no owner or an offline
	 * owner resolves to nobody and awards nothing.
	 */
	public static void fireDamageAbsorbed(ServerLevel level, @Nullable UUID ownerUuid, float absorbedTotal) {
		if (ownerUuid == null) {
			return;
		}

		ServerPlayer owner = level.getServer().getPlayerList().getPlayer(ownerUuid);
		if (owner != null) {
			DAMAGE_ABSORBED.trigger(owner, absorbedTotal);
		}
	}
}
