import { PLAYER } from '../core/constants.js';
import { MonkeyAI } from './MonkeyAI.js';

const GOAL_JITTER = 2;         // metres of random offset around the goal
const GOAL_RETARGET_MIN = 1.5; // seconds between goal re-aims
const GOAL_RETARGET_MAX = 3;

/**
 * MonkeyAI variant for the Prison Escape mode. Adds two escape-only powers
 * on top of the base brain:
 * - setGoal(): steers the wander target towards a world point (item, gate
 *   or exit) instead of roaming randomly.
 * - setSpeedBoost(): temporary sprint-speed boost (banana pickup).
 * Fleeing is fully inherited — police within FLEE_RADIUS still overrides
 * the goal, exactly like the base class.
 */
export class EscapeMonkeyAI extends MonkeyAI {
  constructor(options) {
    super(options);
    /** @type {{ x: number, z: number } | null} */
    this._goal = null;
    this._boostRemaining = 0;
  }

  /**
   * Steers the AI towards a world-space point (goal +/- 2 m jitter, re-aimed
   * every 1.5–3 s). Pass null to resume normal wandering.
   * @param {{ x: number, z: number } | null} goalOrNull
   */
  setGoal(goalOrNull) {
    if (this._goal !== goalOrNull) this._retargetTimer = 0; // re-aim next tick
    this._goal = goalOrNull;
  }

  /**
   * Temporarily raises the sprint speed (banana pickup). Re-applying resets
   * the timer.
   * @param {number} speed boosted sprint speed
   * @param {number} durationSec seconds the boost lasts
   */
  setSpeedBoost(speed, durationSec) {
    this._sprintSpeed = speed;
    this._boostRemaining = durationSec;
  }

  _pickWanderTarget() {
    if (!this._goal) {
      super._pickWanderTarget();
      return;
    }
    this._rememberPosition();
    this._retargetTimer =
      GOAL_RETARGET_MIN + Math.random() * (GOAL_RETARGET_MAX - GOAL_RETARGET_MIN);
    this._target.set(
      this._goal.x + (Math.random() * 2 - 1) * GOAL_JITTER,
      this._position.y,
      this._goal.z + (Math.random() * 2 - 1) * GOAL_JITTER
    );
  }

  /**
   * @param {number} dt seconds
   * @param {import('three').Vector3[]} threats police feet positions
   */
  update(dt, threats) {
    if (this._boostRemaining > 0) {
      this._boostRemaining -= dt;
      if (this._boostRemaining <= 0) {
        this._boostRemaining = 0;
        this._sprintSpeed = PLAYER.MONKEY_SPRINT_SPEED;
      }
    }
    super.update(dt, threats);
  }
}
