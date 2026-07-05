import * as THREE from 'three';
import { PLAYER, PHASES } from '../core/constants.js';
import { moveWithCollisions } from '../core/collision.js';

const FLEE_RADIUS = 9;
const FLEE_RADIUS_SQ = FLEE_RADIUS * FLEE_RADIUS;
const HOP_INTERVAL = 1.5;
const JUKE_INTERVAL_MIN = 0.9;  // seconds between sideways jukes while fleeing
const JUKE_INTERVAL_MAX = 1.8;
const JUKE_DURATION = 0.35;     // seconds a juke bends the flee direction
const JUKE_ANGLE = 1.1;         // radians the flee direction is bent during a juke
const ARRIVE_RADIUS = 1;
const STUCK_WINDOW = 1;      // seconds between stuck checks
const STUCK_MIN_DIST = 0.3;  // required displacement per window while moving
const MEMORY_SIZE = 8;
const RUN_SPEED_THRESHOLD = 0.5;

const DIMS = { radius: PLAYER.RADIUS, height: 1.1, stepHeight: PLAYER.STEP_HEIGHT };

// Scratch objects shared by all instances (updates run sequentially).
const _dir = new THREE.Vector3();

/**
 * Headless AI brain for a solo-mode monkey. Simulates movement with the
 * shared collision pass and exposes a plain-JSON snapshot each frame; an
 * engine-side RemotePlayer renders it. Creates no scene objects.
 */
export class MonkeyAI {
  /**
   * @param {{ id: string, name: string, spawn: THREE.Vector3,
   *           colliders: THREE.Box3[], bounds: THREE.Box3, killY: number }} options
   */
  constructor({ id, name, spawn, colliders, bounds, killY }) {
    this.id = id;
    this.name = name;
    this.caught = false;

    this._spawn = spawn.clone();
    this._colliders = colliders;
    this._bounds = bounds;
    this._killY = killY;
    this._phase = PHASES.LOBBY;

    this._position = spawn.clone();
    this._velocity = new THREE.Vector3();
    this._yaw = Math.random() * Math.PI * 2;
    this._grounded = false;

    // Instance speeds so subclasses (e.g. EscapeMonkeyAI) can boost them.
    this._walkSpeed = PLAYER.MONKEY_WALK_SPEED;
    this._sprintSpeed = PLAYER.MONKEY_SPRINT_SPEED;

    this._target = spawn.clone();
    this._retargetTimer = 0;
    this._hopTimer = HOP_INTERVAL * Math.random();
    this._jukeTimer = JUKE_INTERVAL_MIN + Math.random() * (JUKE_INTERVAL_MAX - JUKE_INTERVAL_MIN);
    this._jukeRemaining = 0;
    this._jukeAngle = 0;

    // Ring buffer of visited positions used for "return to a previous spot".
    this._memory = [];
    for (let i = 0; i < MEMORY_SIZE; i++) this._memory.push(new THREE.Vector3());
    this._memoryCount = 0;
    this._memoryIndex = 0;

    this._stuckTimer = 0;
    this._stuckRef = spawn.clone();

    this._animState = 'idle';
    this._snapshot = {
      position: { x: spawn.x, y: spawn.y, z: spawn.z },
      yaw: this._yaw,
      animState: 'idle'
    };
  }

  /** Freeze in place; the snapshot animState becomes 'caught'. */
  setCaught() {
    this.caught = true;
    this._animState = 'caught';
    this._velocity.set(0, 0, 0);
  }

  /**
   * Update the round phase. The AI only moves during 'hiding' and 'seeking'.
   * @param {string} phase a PHASES value
   */
  setPhase(phase) {
    this._phase = phase;
    if (!this._isActivePhase() && !this.caught) this._animState = 'idle';
  }

  _isActivePhase() {
    return this._phase === PHASES.HIDING || this._phase === PHASES.SEEKING;
  }

  _rememberPosition() {
    this._memory[this._memoryIndex].copy(this._position);
    this._memoryIndex = (this._memoryIndex + 1) % MEMORY_SIZE;
    if (this._memoryCount < MEMORY_SIZE) this._memoryCount++;
  }

  _pickWanderTarget() {
    this._rememberPosition();
    this._retargetTimer = 2 + Math.random() * 3;

    if (this._memoryCount > 1 && Math.random() < 0.35) {
      const pick = this._memory[Math.floor(Math.random() * this._memoryCount)];
      this._target.set(
        pick.x + (Math.random() * 2 - 1) * 3,
        this._position.y,
        pick.z + (Math.random() * 2 - 1) * 3
      );
    } else {
      const min = this._bounds.min;
      const max = this._bounds.max;
      this._target.set(
        min.x + Math.random() * (max.x - min.x),
        this._position.y,
        min.z + Math.random() * (max.z - min.z)
      );
    }
  }

  _nearestThreatSq(threats) {
    let best = Infinity;
    let bestIndex = -1;
    for (let i = 0; i < threats.length; i++) {
      const dx = threats[i].x - this._position.x;
      const dz = threats[i].z - this._position.z;
      const d = dx * dx + dz * dz;
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    this._nearestIndex = bestIndex;
    return best;
  }

  /**
   * Advance the simulation by dt seconds. Does nothing when caught or when
   * the phase is not 'hiding'/'seeking'.
   * @param {number} dt seconds
   * @param {THREE.Vector3[]} threats police feet positions
   */
  update(dt, threats) {
    if (this.caught || !this._isActivePhase() || !(dt > 0)) return;

    const pos = this._position;
    const vel = this._velocity;

    // --- Choose desired horizontal direction and speed -------------------
    let speed = 0;
    _dir.set(0, 0, 0);

    const threatSq = threats && threats.length > 0 ? this._nearestThreatSq(threats) : Infinity;
    const fleeing = threatSq < FLEE_RADIUS_SQ;

    if (fleeing) {
      const threat = threats[this._nearestIndex];
      _dir.set(pos.x - threat.x, 0, pos.z - threat.z);
      if (_dir.lengthSq() < 1e-8) {
        // Threat exactly on top of us: run in the current facing direction.
        _dir.set(-Math.sin(this._yaw), 0, -Math.cos(this._yaw));
      }
      _dir.normalize();
      speed = this._sprintSpeed;

      // Occasionally juke sideways instead of fleeing in a straight line, so a
      // persistent pursuer can cut the corner and close the gap.
      this._jukeTimer -= dt;
      if (this._jukeTimer <= 0 && this._jukeRemaining <= 0) {
        this._jukeRemaining = JUKE_DURATION;
        this._jukeAngle = Math.random() < 0.5 ? JUKE_ANGLE : -JUKE_ANGLE;
        this._jukeTimer = JUKE_INTERVAL_MIN + Math.random() * (JUKE_INTERVAL_MAX - JUKE_INTERVAL_MIN);
      }
      if (this._jukeRemaining > 0) {
        this._jukeRemaining -= dt;
        const cos = Math.cos(this._jukeAngle);
        const sin = Math.sin(this._jukeAngle);
        const x = _dir.x;
        _dir.x = x * cos + _dir.z * sin;
        _dir.z = _dir.z * cos - x * sin;
      }

      this._hopTimer -= dt;
      if (this._hopTimer <= 0 && this._grounded) {
        vel.y = PLAYER.JUMP_SPEED * 0.8;
        this._hopTimer = HOP_INTERVAL;
      }
    } else {
      this._retargetTimer -= dt;
      const dx = this._target.x - pos.x;
      const dz = this._target.z - pos.z;
      const distSq = dx * dx + dz * dz;
      if (this._retargetTimer <= 0 || distSq < ARRIVE_RADIUS * ARRIVE_RADIUS) {
        this._pickWanderTarget();
      }
      _dir.set(this._target.x - pos.x, 0, this._target.z - pos.z);
      if (_dir.lengthSq() > 1e-8) {
        _dir.normalize();
        speed = this._walkSpeed;
      }
    }

    // --- Physics ----------------------------------------------------------
    vel.x = _dir.x * speed;
    vel.z = _dir.z * speed;
    vel.y -= PLAYER.GRAVITY * dt;

    const { onGround } = moveWithCollisions(pos, vel, dt, this._colliders, DIMS);
    this._grounded = onGround;

    if (speed > 0) {
      this._yaw = Math.atan2(-_dir.x, -_dir.z);
    }

    // --- Stuck detection ---------------------------------------------------
    this._stuckTimer += dt;
    if (this._stuckTimer >= STUCK_WINDOW) {
      this._stuckTimer = 0;
      const moved = pos.distanceTo(this._stuckRef);
      if (speed > 0.1 && moved < STUCK_MIN_DIST) {
        const heading = Math.random() * Math.PI * 2;
        const reach = 5 + Math.random() * 8;
        this._target.set(
          pos.x + Math.sin(heading) * reach,
          pos.y,
          pos.z + Math.cos(heading) * reach
        );
        this._retargetTimer = 2 + Math.random() * 3;
        if (this._grounded) vel.y = PLAYER.JUMP_SPEED * 0.8;
      }
      this._stuckRef.copy(pos);
    }

    // --- Kill plane ---------------------------------------------------------
    if (pos.y < this._killY) {
      pos.copy(this._spawn);
      vel.set(0, 0, 0);
      this._stuckRef.copy(pos);
    }

    const horizontalSpeed = Math.hypot(vel.x, vel.z);
    this._animState = horizontalSpeed > RUN_SPEED_THRESHOLD ? 'run' : 'idle';
  }

  /**
   * Latest render state as plain JSON numbers (reused object; copy if kept).
   * @returns {{ position: {x:number,y:number,z:number}, yaw: number,
   *             animState: 'idle'|'run'|'caught' }}
   */
  get snapshot() {
    const snap = this._snapshot;
    snap.position.x = this._position.x;
    snap.position.y = this._position.y;
    snap.position.z = this._position.z;
    snap.yaw = this._yaw;
    snap.animState = this.caught ? 'caught' : this._animState;
    return snap;
  }
}
