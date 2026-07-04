import { PLAYER, ROLES } from '../client/core/constants.js';
import { DIFFICULTY_CONFIG } from './botConstants.js';

const HORIZONTAL_AXES = ['x', 'z'];

// Effective flee speed must stay strictly below the police sprint speed, or a
// fleeing bot becomes uncatchable in the open (catch-balance invariant).
const MAX_FLEE_SPEED = PLAYER.SPRINT_SPEED - 0.2;

/**
 * Headless AI bot for server-side simulation. No THREE dependencies.
 * Mirrors the client-side MonkeyAI logic but uses plain {x,y,z} objects.
 */
export class AIBot {
  /**
   * @param {object} opts
   * @param {string} opts.id
   * @param {string} opts.name
   * @param {{x:number,y:number,z:number}} opts.spawn
   * @param {{min:{x:number,y:number,z:number},max:{x:number,y:number,z:number}}[]} opts.colliders
   * @param {{min:{x:number,y:number,z:number},max:{x:number,y:number,z:number}}} opts.bounds
   * @param {number} opts.killY
   * @param {string} [opts.difficulty]
   */
  constructor({ id, name, spawn: { x, y, z }, colliders, bounds, killY, difficulty }) {
    this.id = id;
    this.name = name;
    this.role = ROLES.MONKEY;
    this.caught = false;
    this.score = 0;
    this.catches = 0;

    this._pos = { x, y, z };
    this._spawn = { x, y, z };
    // Ground reference: without full collider data the bot would free-fall
    // to killY, so its spawn height acts as the floor it walks on.
    this._groundY = y;
    this._vel = { x: 0, y: 0, z: 0 };
    this._yaw = Math.random() * Math.PI * 2;
    this._grounded = true;

    this._colliders = colliders || [];
    this._bounds = bounds || { min: { x: -80, y: -10, z: -80 }, max: { x: 80, y: 50, z: 80 } };
    this._killY = killY !== undefined ? killY : -15;

    this._phase = 'lobby';
    this._target = { x, y, z };
    this._retargetTimer = 0;
    this._hopTimer = 1.5 * Math.random();
    this._jukeTimer = 0.9 + Math.random() * 0.9;
    this._jukeRemaining = 0;
    this._jukeAngle = 0;
    this._jukeAngleMag = 1.1;

    this._memory = Array.from({ length: 8 }, () => ({ x, y, z }));
    this._memIdx = 0;
    this._memCount = 0;

    this._stuckTimer = 0;
    this._stuckRef = { x, y, z };

    this._animState = 'idle';
    this._reactionSkip = 0;

    this.setDifficulty(difficulty || 'medium');
  }

  /**
   * Apply difficulty parameters from botConstants.
   * @param {string} d 'easy' | 'medium' | 'hard'
   */
  setDifficulty(d) {
    const cfg = DIFFICULTY_CONFIG[d] || DIFFICULTY_CONFIG.medium;
    this._speedMult = cfg.speedMult;
    this._fleeRadius = cfg.fleeRadius;
    this._fleeRadiusSq = cfg.fleeRadiusSq;
    this._jukeIntervalMin = cfg.jukeIntervalMin;
    this._jukeIntervalMax = cfg.jukeIntervalMax;
    this._jukeDuration = cfg.jukeDuration;
    this._jukeAngleMag = cfg.jukeAngle;
    this._hopInterval = cfg.hopInterval;
    this._stuckMinDist = cfg.stuckMinDist;
    this._hideQuality = cfg.hideQuality;
    this._reactionSkipTicks = cfg.reactionSkipTicks || 0;
  }

  /** @param {string} p 'lobby' | 'hiding' | 'seeking' | 'caught' */
  setPhase(p) {
    this._phase = p;
  }

  /**
   * Advance the simulation by dt seconds.
   * Does nothing when caught or outside hiding/seeking phase.
   * @param {number} dt delta time in seconds
   * @param {{x:number,y:number,z:number}[]} [threats] array of threat positions
   */
  update(dt, threats) {
    if (this.caught || !(this._phase === 'hiding' || this._phase === 'seeking') || !(dt > 0)) return;

    const pos = this._pos;
    const vel = this._vel;
    let speed = 0;
    const dir = { x: 0, z: 0 };

    // Reaction skip for easier difficulties (delayed reaction frames)
    if (this._reactionSkipTicks > 0 && this._reactionSkip < this._reactionSkipTicks) {
      this._reactionSkip++;
    } else {
      this._reactionSkip = 0;

      // --- Threat detection ---
      let bestSq = Infinity;
      let threat = null;
      if (threats && threats.length > 0) {
        for (const t of threats) {
          const dx = t.x - pos.x;
          const dz = t.z - pos.z;
          const d = dx * dx + dz * dz;
          if (d < bestSq) {
            bestSq = d;
            threat = t;
          }
        }
      }

      const fleeing = threat && bestSq < this._fleeRadiusSq;

      if (fleeing && threat) {
        // --- Flee: run directly away from nearest threat ---
        dir.x = pos.x - threat.x;
        dir.z = pos.z - threat.z;
        const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
        if (len > 1e-8) {
          dir.x /= len;
          dir.z /= len;
        } else {
          // Threat on top of us: run in current facing direction
          dir.x = -Math.sin(this._yaw);
          dir.z = -Math.cos(this._yaw);
        }
        // Clamp: the flee speed must stay strictly below police sprint speed
        // even after the difficulty multiplier (hard = 1.2 would exceed it).
        speed = Math.min(PLAYER.MONKEY_SPRINT_SPEED * this._speedMult, MAX_FLEE_SPEED);

        // Sideways juke to make pursuit harder
        this._jukeTimer -= dt;
        if (this._jukeTimer <= 0 && this._jukeRemaining <= 0) {
          this._jukeRemaining = this._jukeDuration;
          this._jukeAngle = (Math.random() < 0.5 ? 1 : -1) * this._jukeAngleMag;
          this._jukeTimer = this._jukeIntervalMin + Math.random() * (this._jukeIntervalMax - this._jukeIntervalMin);
        }
        if (this._jukeRemaining > 0) {
          this._jukeRemaining -= dt;
          const cos = Math.cos(this._jukeAngle);
          const sin = Math.sin(this._jukeAngle);
          const dx = dir.x;
          dir.x = dx * cos + dir.z * sin;
          dir.z = dir.z * cos - dx * sin;
        }

        // Hop to clear obstacles
        this._hopTimer -= dt;
        if (this._hopTimer <= 0 && this._grounded) {
          vel.y = PLAYER.JUMP_SPEED * 0.8;
          this._hopTimer = this._hopInterval;
        }
      } else {
        // --- Wander: pick targets within the playable bounds ---
        this._retargetTimer -= dt;
        const dx = this._target.x - pos.x;
        const dz = this._target.z - pos.z;
        if (this._retargetTimer <= 0 || dx * dx + dz * dz < 1) {
          this._rememberPosition();
          this._retargetTimer = 2 + Math.random() * 3;
          if (this._memCount > 1 && Math.random() < this._hideQuality) {
            // Return to a previously visited spot (hiding behaviour)
            const p = this._memory[Math.floor(Math.random() * this._memCount)];
            this._target.x = p.x + (Math.random() * 2 - 1) * 3;
            this._target.z = p.z + (Math.random() * 2 - 1) * 3;
          } else {
            const b = this._bounds;
            this._target.x = b.min.x + Math.random() * (b.max.x - b.min.x);
            this._target.z = b.min.z + Math.random() * (b.max.z - b.min.z);
          }
        }
        dir.x = this._target.x - pos.x;
        dir.z = this._target.z - pos.z;
        const len = Math.sqrt(dir.x * dir.x + dir.z * dir.z);
        if (len > 1e-8) {
          dir.x /= len;
          dir.z /= len;
          speed = PLAYER.MONKEY_WALK_SPEED * this._speedMult;
        }
      }
    }

    // --- Physics (gravity + collision) ---
    vel.x = dir.x * speed;
    vel.z = dir.z * speed;
    vel.y -= PLAYER.GRAVITY * dt;

    const result = moveWithCollisions(pos, vel, dt, this._colliders, { radius: 0.35, height: 1.1, stepHeight: 0.45 });
    this._grounded = result.onGround;

    // Ground clamp: with no colliders loaded, the spawn height is the floor.
    // Keeps the bot at a catchable height instead of free-falling to killY.
    if (pos.y <= this._groundY) {
      pos.y = this._groundY;
      if (vel.y < 0) vel.y = 0;
      this._grounded = true;
    }

    if (speed > 0) {
      this._yaw = Math.atan2(-dir.x, -dir.z);
    }

    // --- Stuck detection (teleport away if wedged) ---
    this._stuckTimer += dt;
    if (this._stuckTimer >= 1) {
      this._stuckTimer = 0;
      const dx = pos.x - this._stuckRef.x;
      const dz = pos.z - this._stuckRef.z;
      if (speed > 0.1 && Math.sqrt(dx * dx + dz * dz) < this._stuckMinDist) {
        const h = Math.random() * Math.PI * 2;
        const r = 5 + Math.random() * 8;
        this._target.x = pos.x + Math.sin(h) * r;
        this._target.z = pos.z + Math.cos(h) * r;
        this._retargetTimer = 2 + Math.random() * 3;
        if (this._grounded) vel.y = PLAYER.JUMP_SPEED * 0.8;
      }
      this._stuckRef.x = pos.x;
      this._stuckRef.z = pos.z;
    }

    // --- Kill plane (reset to spawn if fallen off world) ---
    if (pos.y < this._killY) {
      pos.x = this._spawn.x;
      pos.y = this._spawn.y;
      pos.z = this._spawn.z;
      vel.x = 0;
      vel.y = 0;
      vel.z = 0;
      this._stuckRef.x = this._spawn.x;
      this._stuckRef.z = this._spawn.z;
    }

    const hSpeed = Math.hypot(vel.x, vel.z);
    this._animState = hSpeed > 0.5 ? 'run' : 'idle';
  }

  /** Record current position into the ring-buffer memory. */
  _rememberPosition() {
    const mem = this._memory[this._memIdx];
    mem.x = this._pos.x;
    mem.y = this._pos.y;
    mem.z = this._pos.z;
    this._memIdx = (this._memIdx + 1) % this._memory.length;
    if (this._memCount < this._memory.length) this._memCount++;
  }

  /**
   * Live authoritative state in the same shape human members store, so
   * Room.attemptCatch can distance-check bots exactly like humans.
   * @returns {{ position: {x:number,y:number,z:number}, yaw: number, animState: string }}
   */
  get lastState() {
    return this.snapshot;
  }

  /**
   * Snapshot for network serialisation (plain JSON numbers).
   * @returns {{ position: {x:number,y:number,z:number}, yaw: number, animState: string }}
   */
  get snapshot() {
    return {
      position: { x: this._pos.x, y: this._pos.y, z: this._pos.z },
      yaw: this._yaw,
      animState: this.caught ? 'caught' : this._animState
    };
  }
}

// ---------------------------------------------------------------------------
// Inline collision resolver (port of client/core/collision.js using plain
// objects – no THREE.Box3, no THREE.Vector3).
// ---------------------------------------------------------------------------

/**
 * Move a character AABB through static colliders, sliding along blocked axes.
 * MUTATES position and velocity in place.
 *
 * @param {{x:number,y:number,z:number}} position  feet-centre (mutated)
 * @param {{x:number,y:number,z:number}} velocity  units/sec (mutated)
 * @param {number} dt  seconds
 * @param {{min:{x:number,y:number,z:number},max:{x:number,y:number,z:number}}[]} colliders
 * @param {{radius:number, height:number, stepHeight?:number}} dims
 * @returns {{ onGround: boolean }}
 */
function moveWithCollisions(position, velocity, dt, colliders, dims) {
  const { radius, height, stepHeight = 0 } = dims;
  let onGround = false;

  // Reusable AABB box (scratch)
  const box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

  function refreshBox() {
    box.min.x = position.x - radius;
    box.min.y = position.y;
    box.min.z = position.z - radius;
    box.max.x = position.x + radius;
    box.max.y = position.y + height;
    box.max.z = position.z + radius;
  }

  function intersects(a, b) {
    return a.max.x > b.min.x && a.min.x < b.max.x &&
           a.max.y > b.min.y && a.min.y < b.max.y &&
           a.max.z > b.min.z && a.min.z < b.max.z;
  }

  // Horizontal axes: x then z (slide sequentially)
  for (const axis of HORIZONTAL_AXES) {
    const v = velocity[axis];
    const attempted = position[axis] + v * dt;
    position[axis] = attempted;
    refreshBox();

    let blocked = false;
    for (const col of colliders) {
      if (!intersects(box, col)) continue;
      blocked = true;
      if (v > 0) {
        position[axis] = col.min[axis] - radius - 1e-4;
      } else {
        position[axis] = col.max[axis] + radius + 1e-4;
      }
      velocity[axis] = 0;
      refreshBox();
    }

    // Auto-step up small vertical ledges when grounded
    if (blocked && stepHeight > 0 && velocity.y <= 0.01) {
      const resolved = position[axis];
      const baseY = position.y;
      position[axis] = attempted;
      position.y = baseY + stepHeight;
      refreshBox();

      let clear = true;
      for (const col of colliders) {
        if (intersects(box, col)) {
          clear = false;
          break;
        }
      }
      if (clear) {
        velocity[axis] = v;
      } else {
        position[axis] = resolved;
        position.y = baseY;
      }
    }
  }

  // Vertical axis
  const velY = velocity.y;
  position.y += velY * dt;
  refreshBox();
  for (const col of colliders) {
    if (!intersects(box, col)) continue;
    if (velY > 0) {
      position.y = col.min.y - height - 1e-4;
    } else {
      position.y = col.max.y + 1e-4;
      onGround = true;
    }
    velocity.y = 0;
    refreshBox();
  }

  return { onGround };
}
