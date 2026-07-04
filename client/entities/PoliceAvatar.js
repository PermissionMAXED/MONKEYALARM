import * as THREE from 'three';

const COLORS = {
  torso: 0x1e3a8a,    // navy
  arms: 0x3b82f6,     // lighter blue
  trousers: 0x22262e, // dark
  boots: 0x101216,    // near-black
  skin: 0xf1c27d,
  cap: 0x172554,
  badge: 0xfacc15,
  baton: 0x2b2b2b
};

const RUN_FREQ = 10;         // rad/s for limb swing
const RUN_AMPLITUDE = 0.7;   // rad about x
const BREATH_FREQ = Math.PI * 2 * 1.5; // ~1.5 Hz
const BREATH_AMPLITUDE = 0.02;

/**
 * Cartoonish police officer avatar (~1.8 m tall) built from primitives.
 * Origin is at the feet (y = 0 at sole) and the model's front faces local -Z.
 * States: 'idle' (breathing bob), 'run' (limb swing), 'caught' (treated as idle).
 */
export class PoliceAvatar {
  constructor() {
    /** @type {THREE.Group} root group; add to scene, position = feet */
    this.group = new THREE.Group();

    this._geometries = [];
    this._materials = [];
    this._state = 'idle';
    this._t = Math.random() * 100; // desync animation between instances

    this._build();
  }

  _material(color) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.05 });
    this._materials.push(mat);
    return mat;
  }

  _mesh(geometry, material) {
    this._geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  _build() {
    const torsoMat = this._material(COLORS.torso);
    const armMat = this._material(COLORS.arms);
    const trouserMat = this._material(COLORS.trousers);
    const bootMat = this._material(COLORS.boots);
    const skinMat = this._material(COLORS.skin);
    const capMat = this._material(COLORS.cap);
    const badgeMat = this._material(COLORS.badge);
    const batonMat = this._material(COLORS.baton);

    // Upper body group (bobbed for breathing); legs stay attached to the root.
    this._body = new THREE.Group();
    this.group.add(this._body);

    const torso = this._mesh(new THREE.BoxGeometry(0.46, 0.62, 0.28), torsoMat);
    torso.position.y = 1.17;
    this._body.add(torso);

    const belt = this._mesh(new THREE.BoxGeometry(0.48, 0.07, 0.3), bootMat);
    belt.position.y = 0.88;
    this._body.add(belt);

    // Head + peaked cap (peak points toward local -Z = front).
    const head = new THREE.Group();
    head.position.y = 1.62;
    this._body.add(head);

    const skull = this._mesh(new THREE.SphereGeometry(0.165, 20, 16), skinMat);
    head.add(skull);

    const crown = this._mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.11, 20), capMat);
    crown.position.y = 0.13;
    head.add(crown);

    const peak = this._mesh(new THREE.BoxGeometry(0.26, 0.035, 0.16), capMat);
    peak.position.set(0, 0.085, -0.19);
    head.add(peak);

    const badge = this._mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), badgeMat);
    badge.rotation.x = Math.PI / 2;
    badge.position.set(0, 0.13, -0.175);
    head.add(badge);

    // Arms: pivots at the shoulders so rotation.x swings naturally.
    this._armL = this._buildArm(armMat, skinMat, -1);
    this._armR = this._buildArm(armMat, skinMat, 1);
    this._body.add(this._armL, this._armR);

    // Tiny baton in the right hand, angled down-forward.
    const baton = this._mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.38, 8), batonMat);
    baton.position.set(0, -0.58, -0.12);
    baton.rotation.x = -0.9;
    this._armR.add(baton);

    // Legs: pivots at the hips, direct children of the root group.
    this._legL = this._buildLeg(trouserMat, bootMat, -1);
    this._legR = this._buildLeg(trouserMat, bootMat, 1);
    this.group.add(this._legL, this._legR);
  }

  _buildArm(armMat, skinMat, side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.29, 1.42, 0);
    pivot.rotation.z = -side * 0.07; // slight outward tilt

    const sleeve = this._mesh(new THREE.BoxGeometry(0.13, 0.55, 0.13), armMat);
    sleeve.position.y = -0.27;
    pivot.add(sleeve);

    const hand = this._mesh(new THREE.SphereGeometry(0.06, 10, 8), skinMat);
    hand.position.y = -0.56;
    pivot.add(hand);

    return pivot;
  }

  _buildLeg(trouserMat, bootMat, side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12, 0.88, 0);

    const trouser = this._mesh(new THREE.BoxGeometry(0.17, 0.62, 0.17), trouserMat);
    trouser.position.y = -0.31;
    pivot.add(trouser);

    const boot = this._mesh(new THREE.BoxGeometry(0.19, 0.26, 0.28), bootMat);
    boot.position.set(0, -0.75, -0.04); // toe forward (-Z)
    pivot.add(boot);

    return pivot;
  }

  /**
   * Set the animation state. 'caught' is unreachable for police and is
   * treated as 'idle'.
   * @param {'idle'|'run'|'caught'} state
   */
  setAnimState(state) {
    this._state = state === 'run' ? 'run' : 'idle';
  }

  /**
   * Advance procedural animation.
   * @param {number} dt seconds since last frame
   */
  update(dt) {
    if (!(dt > 0)) return;
    this._t += dt;
    const k = 1 - Math.exp(-10 * dt);

    let swing = 0;
    let bob = 0;
    if (this._state === 'run') {
      swing = Math.sin(this._t * RUN_FREQ) * RUN_AMPLITUDE;
    } else {
      bob = Math.sin(this._t * BREATH_FREQ) * BREATH_AMPLITUDE;
    }

    // Arms and legs swing in opposite phase (left arm with right leg).
    this._armL.rotation.x += (swing - this._armL.rotation.x) * k;
    this._armR.rotation.x += (-swing - this._armR.rotation.x) * k;
    this._legL.rotation.x += (-swing - this._legL.rotation.x) * k;
    this._legR.rotation.x += (swing - this._legR.rotation.x) * k;
    this._body.position.y += (bob - this._body.position.y) * k;
  }

  /** Dispose all geometries and materials created by this avatar. */
  dispose() {
    for (const geometry of this._geometries) geometry.dispose();
    for (const material of this._materials) material.dispose();
    this._geometries.length = 0;
    this._materials.length = 0;
    this.group.clear();
  }
}
