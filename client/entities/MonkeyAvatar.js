import * as THREE from 'three';

const COLORS = {
  fur: 0x8b5a2b,     // brown
  belly: 0xd8b98a,   // tan
  muzzle: 0xe3c69a,
  eye: 0x1a1a1a,
  innerEar: 0xc79b6d,
  tail: 0x7a4a21,
  banana: 0xfbd75b
};

const RUN_FREQ = 10;
const RUN_AMPLITUDE = 0.75;
const RUN_LEAN = 0.25;           // rad forward body lean while running
const TAIL_SWAY_FREQ = 1.8;
const TAIL_SWAY_AMPLITUDE = 0.35;
const CAUGHT_DIM = 0.4;          // grey-out multiplier for caught state

/**
 * Cartoonish monkey avatar (~1.1 m tall) built from primitives, with a curled
 * TubeGeometry tail. Origin is at the feet (y = 0 at sole) and the model's
 * front faces local -Z.
 * States: 'idle' (head look-arounds + tail sway), 'run' (4-limb scamper +
 * forward lean), 'caught' (slumped sit, materials dimmed grey-ish).
 */
export class MonkeyAvatar {
  constructor() {
    /** @type {THREE.Group} root group; add to scene, position = feet */
    this.group = new THREE.Group();

    this._geometries = [];
    this._materials = []; // { material, baseColor }
    this._state = 'idle';
    this._dimmed = false;
    this._t = Math.random() * 100;

    // Idle head look-around state.
    this._headYawTarget = 0;
    this._headTimer = 1 + Math.random() * 2;

    this._build();
  }

  _material(color) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0 });
    this._materials.push({ material: mat, baseColor: new THREE.Color(color) });
    return mat;
  }

  _mesh(geometry, material) {
    this._geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    return mesh;
  }

  _build() {
    const furMat = this._material(COLORS.fur);
    const bellyMat = this._material(COLORS.belly);
    const muzzleMat = this._material(COLORS.muzzle);
    const eyeMat = this._material(COLORS.eye);
    const innerEarMat = this._material(COLORS.innerEar);
    const tailMat = this._material(COLORS.tail);
    const bananaMat = this._material(COLORS.banana);

    // Everything hangs off _root so the caught "slump" can pose the whole body.
    this._root = new THREE.Group();
    this.group.add(this._root);

    const body = this._mesh(new THREE.CapsuleGeometry(0.19, 0.24, 6, 14), furMat);
    body.position.y = 0.52;
    this._root.add(body);

    const belly = this._mesh(new THREE.SphereGeometry(0.15, 14, 12), bellyMat);
    belly.scale.set(1, 1.25, 0.65);
    belly.position.set(0, 0.5, -0.11);
    this._root.add(belly);

    // Head group pivots at the neck for look-arounds.
    this._head = new THREE.Group();
    this._head.position.y = 0.87;
    this._root.add(this._head);

    const skull = this._mesh(new THREE.SphereGeometry(0.16, 18, 14), furMat);
    this._head.add(skull);

    const muzzle = this._mesh(new THREE.SphereGeometry(0.09, 12, 10), muzzleMat);
    muzzle.scale.set(1.15, 0.85, 0.8);
    muzzle.position.set(0, -0.045, -0.13);
    this._head.add(muzzle);

    const eyeGeom = new THREE.SphereGeometry(0.028, 8, 8);
    this._geometries.push(eyeGeom);
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(eyeGeom, eyeMat);
      eye.castShadow = true;
      eye.position.set(side * 0.065, 0.05, -0.14);
      this._head.add(eye);
    }

    // Big round ears with tan inner disc.
    for (const side of [-1, 1]) {
      const ear = this._mesh(new THREE.SphereGeometry(0.075, 12, 10), furMat);
      ear.scale.set(1, 1, 0.45);
      ear.position.set(side * 0.17, 0.05, 0);
      this._head.add(ear);

      const inner = this._mesh(new THREE.SphereGeometry(0.045, 10, 8), innerEarMat);
      inner.scale.set(1, 1, 0.3);
      inner.position.set(side * 0.185, 0.05, -0.025);
      this._head.add(inner);
    }

    // Limbs: pivots at shoulders/hips.
    this._armL = this._buildLimb(furMat, -1, 0.72, 0.34, 0.05);
    this._armR = this._buildLimb(furMat, 1, 0.72, 0.34, 0.05);
    this._legL = this._buildLimb(furMat, -1, 0.36, 0.36, 0.115);
    this._legR = this._buildLimb(furMat, 1, 0.36, 0.36, 0.115);
    this._root.add(this._armL, this._armR, this._legL, this._legR);

    // Banana in the right hand: a shallow torus arc reads as a banana.
    const banana = this._mesh(new THREE.TorusGeometry(0.075, 0.026, 8, 12, Math.PI * 0.9), bananaMat);
    banana.position.set(0.03, -0.32, -0.06);
    banana.rotation.set(0.4, 0.3, 1.4);
    this._armR.add(banana);

    // Long curled tail: tube along a CatmullRom curve, swayed at its root.
    this._tail = new THREE.Group();
    this._tail.position.set(0, 0.5, 0.16);
    this._root.add(this._tail);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.08, 0.2),
      new THREE.Vector3(0, 0.28, 0.32),
      new THREE.Vector3(0, 0.48, 0.24),
      new THREE.Vector3(0, 0.52, 0.06),
      new THREE.Vector3(0, 0.4, -0.02)
    ]);
    const tailMesh = this._mesh(new THREE.TubeGeometry(curve, 24, 0.032, 8, false), tailMat);
    this._tail.add(tailMesh);
  }

  _buildLimb(material, side, pivotY, length, offsetX) {
    const pivot = new THREE.Group();
    pivot.position.set(side * (0.19 + offsetX), pivotY, 0);

    const limb = this._mesh(new THREE.CapsuleGeometry(0.05, length - 0.1, 4, 10), material);
    limb.position.y = -length / 2;
    pivot.add(limb);

    return pivot;
  }

  _setDimmed(dimmed) {
    if (dimmed === this._dimmed) return;
    this._dimmed = dimmed;
    for (const entry of this._materials) {
      entry.material.color.copy(entry.baseColor);
      if (dimmed) entry.material.color.multiplyScalar(CAUGHT_DIM);
    }
  }

  /**
   * Set the animation state.
   * @param {'idle'|'run'|'caught'} state
   */
  setAnimState(state) {
    this._state = state;
    this._setDimmed(state === 'caught');
  }

  /**
   * Advance procedural animation.
   * @param {number} dt seconds since last frame
   */
  update(dt) {
    if (!(dt > 0)) return;
    this._t += dt;
    const k = 1 - Math.exp(-8 * dt);

    if (this._state === 'caught') {
      // Slumped sit: body tipped back, sunk down, arms hanging, tail limp.
      this._root.rotation.x += (0.55 - this._root.rotation.x) * k;
      this._root.position.y += (-0.22 - this._root.position.y) * k;
      this._armL.rotation.x += (0.25 - this._armL.rotation.x) * k;
      this._armR.rotation.x += (0.25 - this._armR.rotation.x) * k;
      this._legL.rotation.x += (-1.1 - this._legL.rotation.x) * k;
      this._legR.rotation.x += (-1.1 - this._legR.rotation.x) * k;
      this._head.rotation.x += (0.35 - this._head.rotation.x) * k;
      this._head.rotation.y += (0 - this._head.rotation.y) * k;
      this._tail.rotation.z += (0 - this._tail.rotation.z) * k;
      return;
    }

    // Tail always sways gently while alive.
    this._tail.rotation.z = Math.sin(this._t * TAIL_SWAY_FREQ) * TAIL_SWAY_AMPLITUDE;
    this._root.position.y += (0 - this._root.position.y) * k;

    if (this._state === 'run') {
      const swing = Math.sin(this._t * RUN_FREQ) * RUN_AMPLITUDE;
      this._armL.rotation.x += (swing - this._armL.rotation.x) * k;
      this._armR.rotation.x += (-swing - this._armR.rotation.x) * k;
      this._legL.rotation.x += (-swing - this._legL.rotation.x) * k;
      this._legR.rotation.x += (swing - this._legR.rotation.x) * k;
      this._root.rotation.x += (-RUN_LEAN - this._root.rotation.x) * k;
      this._head.rotation.y += (0 - this._head.rotation.y) * k;
      this._head.rotation.x += (RUN_LEAN * 0.6 - this._head.rotation.x) * k;
      return;
    }

    // Idle: relax limbs, look around every few seconds.
    this._headTimer -= dt;
    if (this._headTimer <= 0) {
      this._headTimer = 2 + Math.random() * 3;
      this._headYawTarget = (Math.random() * 2 - 1) * 0.7;
    }
    this._head.rotation.y += (this._headYawTarget - this._head.rotation.y) * k * 0.5;
    this._head.rotation.x += (0 - this._head.rotation.x) * k;
    this._root.rotation.x += (0 - this._root.rotation.x) * k;
    this._armL.rotation.x += (0 - this._armL.rotation.x) * k;
    this._armR.rotation.x += (0 - this._armR.rotation.x) * k;
    this._legL.rotation.x += (0 - this._legL.rotation.x) * k;
    this._legR.rotation.x += (0 - this._legR.rotation.x) * k;
  }

  /** Dispose all geometries and materials created by this avatar. */
  dispose() {
    for (const geometry of this._geometries) geometry.dispose();
    for (const entry of this._materials) entry.material.dispose();
    this._geometries.length = 0;
    this._materials.length = 0;
    this.group.clear();
  }
}
