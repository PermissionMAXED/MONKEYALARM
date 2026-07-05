// First-person player controller: pointer-lock mouse-look + manual WASD
// movement resolved against static world colliders.

import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { PLAYER, ROLES } from '../core/constants.js';
import { moveWithCollisions } from '../core/collision.js';
import { Input } from './Input.js';

const MAX_FALL_SPEED = -30;
const MOVING_SPEED_THRESHOLD = 0.1;

const CHARACTER_DIMS = {
  radius: PLAYER.RADIUS,
  height: PLAYER.HEIGHT,
  stepHeight: PLAYER.STEP_HEIGHT
};

// Scratch objects reused every frame (no per-frame allocation).
const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();

/**
 * First-person controller. PointerLockControls handles mouse-look and pointer
 * lock only; all translation is computed manually and resolved through
 * moveWithCollisions. The tracked position is the FEET position (x,z center,
 * y = bottom of the character box); the camera sits EYE_HEIGHT above it.
 */
export class PlayerController {
  /**
   * @param {THREE.PerspectiveCamera} camera camera to drive
   * @param {HTMLElement} domElement element used for pointer lock
   * @param {{onLock?: Function, onUnlock?: Function}} [callbacks] lock/unlock notifications
   */
  constructor(camera, domElement, { onLock, onUnlock } = {}) {
    this.camera = camera;
    this.controls = new PointerLockControls(camera, domElement);
    this.input = new Input(window);

    this._onLock = () => { if (onLock) onLock(); };
    this._onUnlock = () => { if (onUnlock) onUnlock(); };
    this.controls.addEventListener('lock', this._onLock);
    this.controls.addEventListener('unlock', this._onUnlock);

    this._walkSpeed = PLAYER.WALK_SPEED;
    this._sprintSpeed = PLAYER.SPRINT_SPEED;
    this._speedMult = 1;

    this._colliders = [];
    this._killY = -Infinity;
    this._hasWorld = false;

    this._position = new THREE.Vector3();
    this._velocity = new THREE.Vector3();
    this._respawnPoint = new THREE.Vector3();
    this._spawned = false;

    this._frozen = false;
    this._onGround = false;
    this._justJumped = false;
    this._justLanded = false;
  }

  /**
   * Applies the movement speeds for a role.
   * @param {'police'|'monkey'} role
   */
  setRole(role) {
    if (role === ROLES.MONKEY) {
      this._walkSpeed = PLAYER.MONKEY_WALK_SPEED;
      this._sprintSpeed = PLAYER.MONKEY_SPRINT_SPEED;
    } else {
      this._walkSpeed = PLAYER.WALK_SPEED;
      this._sprintSpeed = PLAYER.SPRINT_SPEED;
    }
    this._speedMult = 1;
  }

  /**
   * Scales both walk and sprint speed (e.g. the Escape coffee buff).
   * Reset to 1 by setRole().
   * @param {number} mult
   */
  setSpeedMultiplier(mult) {
    this._speedMult = mult;
  }

  /**
   * Sets the static world to collide against.
   * @param {{colliders: THREE.Box3[], killY: number}} world fall below killY → respawn
   */
  setWorld({ colliders, killY }) {
    this._colliders = colliders || [];
    this._killY = killY !== undefined ? killY : -Infinity;
    this._hasWorld = true;
  }

  /**
   * Places the player (FEET position), zeroes velocity and remembers the
   * point as the fall-respawn target.
   * @param {THREE.Vector3} vec3
   */
  spawnAt(vec3) {
    this._respawnPoint.copy(vec3);
    this._position.copy(vec3);
    this._velocity.set(0, 0, 0);
    this._onGround = false;
    this._justJumped = false;
    this._justLanded = false;
    this._spawned = true;
    this.camera.position.copy(this._position);
    this.camera.position.y += PLAYER.EYE_HEIGHT;
  }

  /**
   * While frozen: mouse-look stays active, movement input is ignored and
   * horizontal velocity is zeroed, but gravity still applies.
   * @param {boolean} frozen
   */
  setFrozen(frozen) {
    this._frozen = frozen;
  }

  /**
   * Advances the simulation by dt seconds. Safe no-op before
   * setWorld/spawnAt have been called.
   * @param {number} dt seconds
   */
  update(dt) {
    if (!this._hasWorld || !this._spawned) return;

    // Consume the jump edge every frame so presses made while frozen or
    // unlocked don't fire later as stale buffered jumps.
    const jumpPressed = this.input.consumePressed('Space');
    const movementActive = this.controls.isLocked && !this._frozen;

    if (movementActive) {
      const yaw = this.yaw;
      _forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
      _right.set(Math.cos(yaw), 0, -Math.sin(yaw));

      const forwardAmount =
        (this.input.isDown('KeyW') ? 1 : 0) - (this.input.isDown('KeyS') ? 1 : 0);
      const strafeAmount =
        (this.input.isDown('KeyD') ? 1 : 0) - (this.input.isDown('KeyA') ? 1 : 0);

      _move.set(0, 0, 0);
      _move.addScaledVector(_forward, forwardAmount);
      _move.addScaledVector(_right, strafeAmount);
      if (_move.lengthSq() > 0) _move.normalize();

      const speed =
        (this.input.isDown('ShiftLeft') ? this._sprintSpeed : this._walkSpeed) * this._speedMult;
      this._velocity.x = _move.x * speed;
      this._velocity.z = _move.z * speed;

      if (jumpPressed && this._onGround) {
        this._velocity.y = PLAYER.JUMP_SPEED;
        this._justJumped = true;
      }
    } else {
      this._velocity.x = 0;
      this._velocity.z = 0;
    }

    this._velocity.y = Math.max(this._velocity.y - PLAYER.GRAVITY * dt, MAX_FALL_SPEED);

    const { onGround } = moveWithCollisions(
      this._position, this._velocity, dt, this._colliders, CHARACTER_DIMS
    );
    if (onGround && !this._onGround) this._justLanded = true;
    this._onGround = onGround;

    if (this._position.y < this._killY) {
      this.spawnAt(this._respawnPoint);
    }

    this.camera.position.copy(this._position);
    this.camera.position.y += PLAYER.EYE_HEIGHT;
  }

  /** Requests pointer lock. */
  lock() {
    this.controls.lock();
  }

  /** Releases pointer lock. */
  unlock() {
    this.controls.unlock();
  }

  /** @returns {boolean} whether the pointer is currently locked */
  get isLocked() {
    return this.controls.isLocked;
  }

  /** @returns {THREE.Vector3} live FEET position reference — do not mutate */
  get position() {
    return this._position;
  }

  /** @returns {number} camera yaw in radians (0 faces −Z) */
  get yaw() {
    return _euler.setFromQuaternion(this.camera.quaternion, 'YXZ').y;
  }

  /** @returns {boolean} whether the last update ended on the ground */
  get onGround() {
    return this._onGround;
  }

  /** @returns {boolean} whether horizontal speed exceeds 0.1 units/sec */
  get isMoving() {
    return Math.hypot(this._velocity.x, this._velocity.z) > MOVING_SPEED_THRESHOLD;
  }

  /** @returns {boolean} whether Shift is held while moving */
  get isSprinting() {
    return this.input.isDown('ShiftLeft') && this.isMoving;
  }

  /** @returns {boolean} true once after a jump impulse fired; reading resets it */
  consumeJustJumped() {
    const fired = this._justJumped;
    this._justJumped = false;
    return fired;
  }

  /** @returns {boolean} true once after an airborne→ground transition; reading resets it */
  consumeJustLanded() {
    const fired = this._justLanded;
    this._justLanded = false;
    return fired;
  }

  /** Disposes controls and input listeners. */
  dispose() {
    this.controls.removeEventListener('lock', this._onLock);
    this.controls.removeEventListener('unlock', this._onUnlock);
    this.controls.dispose();
    this.input.dispose();
  }
}
