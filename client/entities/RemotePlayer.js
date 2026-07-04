import * as THREE from 'three';
import { ROLES } from '../core/constants.js';
import { PoliceAvatar } from './PoliceAvatar.js';
import { MonkeyAvatar } from './MonkeyAvatar.js';

const LERP_RATE = 12;

// Police "alarm beacon" floating above un-caught monkeys (seen through walls).
const BEACON_COLOR = 0xff4a3c;
const BEACON_HEIGHT = 2.2;        // meters above the feet
const BEACON_RENDER_ORDER = 999;  // draw after everything (depthTest off)
const BEACON_PULSE_FREQ = 3.2;    // rad/s for the pulse sine
const BEACON_SPIN_SPEED = 1.4;    // rad/s slow spin

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

    // Alarm beacon (lazily built on first setBeaconVisible(true)).
    this._beacon = null;
    this._beaconMaterials = [];
    this._beaconGeometries = [];
    this._beaconT = Math.random() * 100;

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

  /** Builds the beacon group: downward cone + pulsing ring, seen through walls. */
  _buildBeacon() {
    this._beacon = new THREE.Group();
    this._beacon.position.y = BEACON_HEIGHT;

    const coneGeom = new THREE.ConeGeometry(0.16, 0.34, 10);
    const coneMat = new THREE.MeshBasicMaterial({
      color: BEACON_COLOR,
      transparent: true,
      opacity: 0.9,
      depthTest: false
    });
    const cone = new THREE.Mesh(coneGeom, coneMat);
    cone.rotation.x = Math.PI; // point downward
    cone.renderOrder = BEACON_RENDER_ORDER;
    this._beacon.add(cone);

    const ringGeom = new THREE.TorusGeometry(0.3, 0.035, 8, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: BEACON_COLOR,
      transparent: true,
      opacity: 0.7,
      depthTest: false
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2; // lie flat
    ring.renderOrder = BEACON_RENDER_ORDER;
    this._beacon.add(ring);

    this._beaconGeometries.push(coneGeom, ringGeom);
    this._beaconMaterials.push(coneMat, ringMat);
    this.group.add(this._beacon);
  }

  /**
   * Show/hide the police alarm beacon. Built lazily on the first show so
   * monkeys and non-police viewers never pay for it.
   * @param {boolean} visible
   */
  setBeaconVisible(visible) {
    if (visible && !this._beacon) this._buildBeacon();
    if (this._beacon) this._beacon.visible = visible;
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

    if (this._beacon && this._beacon.visible) {
      this._beaconT += dt;
      const pulse = 0.5 + 0.5 * Math.sin(this._beaconT * BEACON_PULSE_FREQ);
      const scale = 0.85 + pulse * 0.3;
      this._beacon.scale.setScalar(scale);
      this._beacon.rotation.y += BEACON_SPIN_SPEED * dt;
      this._beaconMaterials[0].opacity = 0.6 + pulse * 0.4;
      this._beaconMaterials[1].opacity = 0.35 + pulse * 0.5;
    }
  }

  /** @returns {THREE.Vector3} current interpolated feet position */
  get position() {
    return this.group.position;
  }

  /** Dispose the avatar and beacon resources, then detach all children. */
  dispose() {
    if (this._avatar) {
      this._container.remove(this._avatar.group);
      this._avatar.dispose();
      this._avatar = null;
    }
    if (this._beacon) {
      this.group.remove(this._beacon);
      for (const geometry of this._beaconGeometries) geometry.dispose();
      for (const material of this._beaconMaterials) material.dispose();
      this._beaconGeometries.length = 0;
      this._beaconMaterials.length = 0;
      this._beacon = null;
    }
    this.group.clear();
  }
}
