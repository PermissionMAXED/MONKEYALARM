import * as THREE from 'three';
import { ROLES } from '../core/constants.js';
import { PoliceAvatar } from './PoliceAvatar.js';
import { MonkeyAvatar } from './MonkeyAvatar.js';

const LERP_RATE = 12;

/**
 * Visual wrapper for a non-local player (human or AI). Owns a role-matched
 * avatar and interpolates toward network/AI state.
 * Add `group` to the scene; `group.position` is the interpolated feet position.
 */
export class RemotePlayer {
  /**
   * @param {{ id: string, name: string, role: 'police'|'monkey' }} options
   */
  constructor({ id, name, role }) {
    this.id = id;
    this.name = name;
    this.role = role;

    /** @type {THREE.Group} scene root; position = interpolated feet position */
    this.group = new THREE.Group();

    // Avatar sits in its own container so yaw rotates the model but not sprites.
    this._container = new THREE.Group();
    this.group.add(this._container);

    this._avatar = null;
    this._caught = false;
    this._animState = 'idle';
    this._hasState = false;
    this._targetPos = new THREE.Vector3();
    this._targetYaw = 0;

    this._buildAvatar(role);
  }

  _buildAvatar(role) {
    if (this._avatar) {
      this._container.remove(this._avatar.group);
      this._avatar.dispose();
    }
    this.role = role;
    this._avatar = role === ROLES.POLICE ? new PoliceAvatar() : new MonkeyAvatar();
    this._container.add(this._avatar.group);
    this._avatar.setAnimState(this._caught ? 'caught' : this._animState);
  }

  /**
   * Swap this player's avatar for the other role (Infection recruitment).
   * The previous avatar's resources are disposed.
   * @param {'police'|'monkey'} role
   */
  setRole(role) {
    if (role === this.role) return;
    this._buildAvatar(role);
  }

  /**
   * Store a network/AI snapshot as the interpolation target. The first call
   * snaps directly (no lerp from origin).
   * @param {{ position: {x:number,y:number,z:number}, yaw: number, animState: string }} state
   */
  applyState({ position, yaw, animState }) {
    this._targetPos.set(position.x, position.y, position.z);
    this._targetYaw = yaw;
    if (animState) {
      this._animState = animState;
      if (!this._caught) this._avatar.setAnimState(animState);
    }
    if (!this._hasState) {
      this._hasState = true;
      this.group.position.copy(this._targetPos);
      this._container.rotation.y = yaw;
    }
  }

  /**
   * Toggle caught presentation: 'caught' anim state / grey-out on the avatar.
   * @param {boolean} caught
   */
  setCaught(caught) {
    if (caught === this._caught) return;
    this._caught = caught;
    this._avatar.setAnimState(caught ? 'caught' : this._animState);
  }

  /**
   * Interpolate toward the latest target state and advance avatar animation.
   * @param {number} dt seconds since last frame
   */
  update(dt) {
    if (!(dt > 0)) {
      return;
    }
    if (this._hasState) {
      const k = 1 - Math.exp(-LERP_RATE * dt);
      this.group.position.lerp(this._targetPos, k);

      const current = this._container.rotation.y;
      let delta = (this._targetYaw - current) % (Math.PI * 2);
      if (delta > Math.PI) delta -= Math.PI * 2;
      else if (delta < -Math.PI) delta += Math.PI * 2;
      this._container.rotation.y = current + delta * k;
    }
    this._avatar.update(dt);
  }

  /** @returns {THREE.Vector3} current interpolated feet position */
  get position() {
    return this.group.position;
  }

  /** Dispose the avatar resources, then detach all children. */
  dispose() {
    if (this._avatar) {
      this._container.remove(this._avatar.group);
      this._avatar.dispose();
      this._avatar = null;
    }
    this.group.clear();
  }
}
