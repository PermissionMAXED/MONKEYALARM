// Pooled particle effects. Exactly ONE THREE.Points mesh per effect type
// (catch burst, dust puff), each backed by fixed-capacity pre-allocated
// Float32Array buffers — spawning and updating never allocates, and the two
// meshes together add at most 2 draw calls.

import * as THREE from 'three';

const CAPACITY = 512;   // vertices per pooled Points mesh
const HIDDEN_Y = -9999;  // parking spot for dead particles

// Catch burst: celebratory banana-yellow/white spray at a caught monkey.
const CATCH_COUNT = 30;
const CATCH_LIFETIME = 0.9;
const CATCH_GRAVITY = 9.0;
const CATCH_POINT_SIZE = 0.16;
const CATCH_COLOR_BANANA = new THREE.Color(0xfbd75b);
const CATCH_COLOR_WHITE = new THREE.Color(0xffffff);

// Dust puff: soft grey ring expanding outward at ground level on landing.
const DUST_COUNT = 12;
const DUST_LIFETIME = 0.5;
const DUST_GRAVITY = 1.5;
const DUST_DRAG = 5.0;
const DUST_POINT_SIZE = 0.22;
const DUST_COLOR = new THREE.Color(0x8f8a80);

/**
 * Fixed-capacity ring-buffer particle pool rendered as a single THREE.Points.
 * Dead particles are parked at y = HIDDEN_Y with a black color (invisible
 * under additive blending).
 */
class ParticlePool {
  /**
   * @param {number} pointSize world-space point size (sizeAttenuation on)
   * @param {number} gravity downward acceleration in units/s²
   * @param {number} drag exponential velocity damping rate (0 = none)
   */
  constructor(pointSize, gravity, drag) {
    this._gravity = gravity;
    this._drag = drag;

    this._positions = new Float32Array(CAPACITY * 3);
    this._colors = new Float32Array(CAPACITY * 3);
    this._velocities = new Float32Array(CAPACITY * 3);
    this._baseColors = new Float32Array(CAPACITY * 3);
    this._ages = new Float32Array(CAPACITY);
    this._lifetimes = new Float32Array(CAPACITY); // 0 = dead slot
    this._cursor = 0;
    this._live = 0;

    for (let i = 0; i < CAPACITY; i++) this._positions[i * 3 + 1] = HIDDEN_Y;

    this._geometry = new THREE.BufferGeometry();
    this._posAttr = new THREE.BufferAttribute(this._positions, 3);
    this._colorAttr = new THREE.BufferAttribute(this._colors, 3);
    this._posAttr.setUsage(THREE.DynamicDrawUsage);
    this._colorAttr.setUsage(THREE.DynamicDrawUsage);
    this._geometry.setAttribute('position', this._posAttr);
    this._geometry.setAttribute('color', this._colorAttr);

    this._material = new THREE.PointsMaterial({
      size: pointSize,
      vertexColors: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true
    });

    /** @type {THREE.Points} the single mesh for this pool */
    this.points = new THREE.Points(this._geometry, this._material);
    this.points.frustumCulled = false;
  }

  /** Claims the next ring-buffer slot (overwriting the oldest if full). */
  emit(x, y, z, vx, vy, vz, r, g, b, lifetime) {
    const i = this._cursor;
    this._cursor = (i + 1) % CAPACITY;
    if (this._lifetimes[i] === 0) this._live++;
    const i3 = i * 3;
    this._positions[i3] = x;
    this._positions[i3 + 1] = y;
    this._positions[i3 + 2] = z;
    this._velocities[i3] = vx;
    this._velocities[i3 + 1] = vy;
    this._velocities[i3 + 2] = vz;
    this._baseColors[i3] = r;
    this._baseColors[i3 + 1] = g;
    this._baseColors[i3 + 2] = b;
    this._colors[i3] = r;
    this._colors[i3 + 1] = g;
    this._colors[i3 + 2] = b;
    this._ages[i] = 0;
    this._lifetimes[i] = lifetime;
  }

  /** Integrates velocities/gravity/drag and fades colors. No allocation. */
  update(dt) {
    if (this._live === 0) return;
    const damp = this._drag > 0 ? Math.exp(-this._drag * dt) : 1;
    const gDt = this._gravity * dt;
    for (let i = 0; i < CAPACITY; i++) {
      const life = this._lifetimes[i];
      if (life === 0) continue;
      const i3 = i * 3;
      const age = this._ages[i] + dt;
      if (age >= life) {
        this._lifetimes[i] = 0;
        this._live--;
        this._positions[i3 + 1] = HIDDEN_Y;
        this._colors[i3] = 0;
        this._colors[i3 + 1] = 0;
        this._colors[i3 + 2] = 0;
        continue;
      }
      this._ages[i] = age;
      this._velocities[i3 + 1] -= gDt;
      if (damp !== 1) {
        this._velocities[i3] *= damp;
        this._velocities[i3 + 1] *= damp;
        this._velocities[i3 + 2] *= damp;
      }
      this._positions[i3] += this._velocities[i3] * dt;
      this._positions[i3 + 1] += this._velocities[i3 + 1] * dt;
      this._positions[i3 + 2] += this._velocities[i3 + 2] * dt;
      const fade = 1 - age / life;
      this._colors[i3] = this._baseColors[i3] * fade;
      this._colors[i3 + 1] = this._baseColors[i3 + 1] * fade;
      this._colors[i3 + 2] = this._baseColors[i3 + 2] * fade;
    }
    this._posAttr.needsUpdate = true;
    this._colorAttr.needsUpdate = true;
  }

  dispose() {
    this._geometry.dispose();
    this._material.dispose();
  }
}

/**
 * Owns every pooled particle effect. Construct once with the scene; the
 * container group is added to (and removed from) the scene automatically.
 */
export class EffectsManager {
  /**
   * @param {THREE.Scene} scene
   */
  constructor(scene) {
    this._scene = scene;

    /** @type {THREE.Group} container for all effect meshes */
    this.group = new THREE.Group();
    this._catch = new ParticlePool(CATCH_POINT_SIZE, CATCH_GRAVITY, 0);
    this._dust = new ParticlePool(DUST_POINT_SIZE, DUST_GRAVITY, DUST_DRAG);
    this.group.add(this._catch.points, this._dust.points);
    scene.add(this.group);
  }

  /**
   * Celebratory banana-yellow/white burst at a caught monkey.
   * @param {THREE.Vector3} position feet position (values are copied)
   */
  spawnCatchBurst(position) {
    for (let i = 0; i < CATCH_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const horizontal = 0.8 + Math.random() * 2.2;
      const color = Math.random() < 0.65 ? CATCH_COLOR_BANANA : CATCH_COLOR_WHITE;
      this._catch.emit(
        position.x + (Math.random() - 0.5) * 0.3,
        position.y + 0.4 + Math.random() * 0.6,
        position.z + (Math.random() - 0.5) * 0.3,
        Math.cos(angle) * horizontal,
        2.5 + Math.random() * 3.0,
        Math.sin(angle) * horizontal,
        color.r, color.g, color.b,
        CATCH_LIFETIME * (0.7 + Math.random() * 0.3)
      );
    }
  }

  /**
   * Soft grey dust ring expanding outward at ground level (landing).
   * @param {THREE.Vector3} position feet position (values are copied)
   */
  spawnDustPuff(position) {
    for (let i = 0; i < DUST_COUNT; i++) {
      const angle = (i / DUST_COUNT) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 1.2 + Math.random() * 1.4;
      this._dust.emit(
        position.x, position.y + 0.06, position.z,
        Math.cos(angle) * speed,
        0.3 + Math.random() * 0.4,
        Math.sin(angle) * speed,
        DUST_COLOR.r, DUST_COLOR.g, DUST_COLOR.b,
        DUST_LIFETIME * (0.7 + Math.random() * 0.3)
      );
    }
  }

  /**
   * Advances all live particles.
   * @param {number} dt seconds since last frame
   */
  update(dt) {
    if (!(dt > 0)) return;
    this._catch.update(dt);
    this._dust.update(dt);
  }

  /** Removes the container from the scene and frees GPU resources. */
  dispose() {
    this._scene.remove(this.group);
    this._catch.dispose();
    this._dust.dispose();
    this.group.clear();
  }
}
