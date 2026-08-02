package com.bubbleshield.shield;

import java.util.List;
import java.util.UUID;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.phys.Vec3;

import org.jetbrains.annotations.Nullable;

/**
 * W1 port seam: the exact projector-block-entity surface {@link ShieldLogic} and
 * {@link ShieldLinking} consume. Upstream (Fabric 26.2) these methods live directly
 * on {@code BubbleShieldBlockEntity}; the W1 wave ports the pure shield/effect logic
 * before the block/registry wave, so the dependency is inverted through this
 * interface. The W2 {@code BubbleShieldBlockEntity} must implement it 1:1 — every
 * signature (and contract, see the upstream javadoc on each method) is copied
 * verbatim from the upstream block entity.
 */
public interface ShieldHost {
	/** The mutable shield state this projector owns. */
	ShieldState getShieldState();

	/** The projector's block position (block-entity accessor upstream). */
	BlockPos getBlockPos();

	/** The shield's current (health-shrunk, mode-capped) radius; see {@link ShieldLogic#currentRadius}. */
	float currentRadius();

	/** Whether a blast ward augment is socketed (explosive damage x0.4; see {@link ShieldLogic#blastWardedDamage}). */
	boolean hasBlastWard();

	/** The plating damage resistance in [0, 1): {@link ShieldLogic#PLATING_DR} while plating is socketed, else 0. */
	float platingDr();

	/**
	 * The resonance-linked shields including this one (same owner, active,
	 * overlapping — see {@link ShieldLinking#findLinked}), memoized per shield tick.
	 */
	List<? extends ShieldHost> linkedShields(ServerLevel level);

	/** B6: the latest threat-census count (see {@link ShieldLogic#countThreats}). */
	int threatCount();

	/** B6: stores the latest threat-census count. */
	void setThreatCount(int threats);

	/** WP-Evt: queues one visual-event batch entry (kind, outward unit direction, strength). */
	void queueImpact(int kind, Vec3 dirUnit, float strength);

	/** WP-Evt CONTACT rate limit: true at most once per contact window per player. */
	boolean tryContact(UUID uuid, long gameTime);

	/** WP-Evt PASSAGE edge detection: swaps the player's inside-flag, returning the previous one (null on first observation). */
	@Nullable Boolean swapWasInside(UUID uuid, boolean inside);

	/** S2 impact-sound rate limit: true for the first impact of a same-tick volley only. */
	boolean tryImpactSounds(long gameTime);

	/** S2: schedules the delayed antipode wave tail on the far side of the bubble. */
	void queueAntipodeWaveTail(Vec3 hitPos, double radius);

	/** WP-Evt: sweeps the transient visual-event state when the bubble ceases to exist. */
	void clearImpactState();

	/**
	 * Applies a linked-split partner share through this shield's OWN damage pipeline
	 * (ward/DR/last-stand, break cooldown, break sound and criteria).
	 */
	void applyShieldDamage(float amount, boolean explosive);
}
