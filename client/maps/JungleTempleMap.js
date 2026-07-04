import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * JUNGLE TEMPLE — "Overgrown ruins swallowed by the rainforest."
 *
 * Layout (120 x 120, sealed by rampart walls at +/-60):
 * - Centre-north: stepped Mayan pyramid (5 tiers, grand stairs north+south)
 *   topped by a golden-idol shrine — the map-wide landmark.
 * - South of it: stone plaza with a dry fountain and a broken gateway arch.
 * - A shallow river crosses the whole map east-west (z 20..26) with three
 *   stepping-stone fords; its water texture drifts every frame.
 * - Colonnade avenue links the plaza to the police expedition camp at the
 *   south edge. Ruined roofless buildings sit east and west, stepped
 *   terraces fill the north-east corner, boulder groves fill the rest.
 * - Dense instanced jungle rings the perimeter. Vines sway, fireflies
 *   drift, the campfire flickers and the idol pulses in update().
 */

const TIER_H = 1.6;              // pyramid tier height (climbed via stairs)
const STEP_RISE = 0.4;           // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;            // stair tread depth
const PYR_X = 0;                 // pyramid centre
const PYR_Z = -10;
const PYR_HALVES = [15, 12.25, 9.5, 6.75, 4];
const PYR_TOP_Y = PYR_HALVES.length * TIER_H; // 8

/** Deterministic PRNG so the map is identical for every client. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Uniformly scales a geometry's UVs (used before merging for texel density). */
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}

export default class JungleTempleMap extends MapBase {
  constructor() {
    super();
    this.id = 'JUNGLE_TEMPLE';
    this.name = 'Jungle Temple';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-62, -3, -62),
      new THREE.Vector3(62, 45, 62)
    );
    this.killY = -10;
    this.environment = {
      skyColor: 0x9fb98a,
      fog: { color: 0x9fb98a, near: 30, far: 140 }
    };

    this._rng = mulberry32(0x7e3a11);
    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = { stoneL: [], stoneS: [], gold: [], wood: [], fabric: [], ground: [] };
    this._vines = [];
    this._vineMesh = null;
    this._waterMat = null;
    this._flame = null;
    this._flameMat = null;
    this._idolMat = null;
    this._fireflyGeo = null;
    this._fireflyBase = null;
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns(); // early: vegetation scatter avoids spawn points
    this._buildLights();
    this._buildGroundAndRiver();
    this._buildPerimeter();
    this._buildPyramid();
    this._buildShrine();
    this._buildPlaza();
    this._buildRuinWest();
    this._buildRuinEast();
    this._buildTerraces();
    this._buildColonnadeAndPillars();
    this._buildCamp();
    this._buildJungle();
    this._buildBoulders();
    this._buildVines();
    this._buildFireflies();
    this._flushBuckets();
    this._validateSpawns();
  }

  // ------------------------------------------------------- procedural paint

  _canvasTex(size, painter) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    painter(canvas.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _paintStone(ctx, size, base, mossAmount) {
    const rng = mulberry32(0x51ab + Math.floor(mossAmount * 97));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const rows = 6;
    const bh = size / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bh;
      for (let c = -1; c < rows + 1; c++) {
        const shade = Math.floor((rng() - 0.5) * 34);
        ctx.fillStyle = `rgba(${128 + shade},${131 + shade},${116 + shade},0.5)`;
        ctx.fillRect(c * bh + off + 2, r * bh + 2, bh - 4, bh - 4);
      }
    }
    // mortar cracks
    ctx.strokeStyle = 'rgba(30,34,26,0.55)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * bh);
      ctx.lineTo(size, r * bh + (rng() - 0.5) * 4);
      ctx.stroke();
    }
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      let x = rng() * size;
      let y = rng() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (rng() - 0.5) * 40;
        y += rng() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // moss blotches
    const blobs = Math.floor(26 * mossAmount);
    for (let i = 0; i < blobs; i++) {
      const g = 90 + Math.floor(rng() * 60);
      ctx.fillStyle = `rgba(${g - 55},${g},${34},${0.22 + rng() * 0.3})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        4 + rng() * 26, 3 + rng() * 16, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintDirt(ctx, size) {
    const rng = mulberry32(0x33cc01);
    ctx.fillStyle = '#4d5a33';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 900; i++) {
      const t = rng();
      const g = t < 0.5
        ? `rgba(${58 + rng() * 30},${66 + rng() * 34},${30 + rng() * 18},0.5)`
        : `rgba(${86 + rng() * 40},${72 + rng() * 30},${44 + rng() * 20},0.35)`;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        1 + rng() * 5, 1 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // fallen leaves
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = `rgba(${120 + rng() * 60},${110 + rng() * 40},40,0.45)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 2 + rng() * 4, 1 + rng() * 2,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintLeaves(ctx, size) {
    const rng = mulberry32(0x77aa02);
    ctx.fillStyle = '#2f5423';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 320; i++) {
      const g = 60 + Math.floor(rng() * 90);
      ctx.fillStyle = `rgba(${g - 40},${g},${Math.floor(g * 0.35)},0.55)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 3 + rng() * 9, 2 + rng() * 5,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintBark(ctx, size) {
    const rng = mulberry32(0x1188ee);
    ctx.fillStyle = '#4a3a28';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      const w = 2 + rng() * 8;
      const x = rng() * size;
      const shade = Math.floor((rng() - 0.5) * 40);
      ctx.fillStyle = `rgba(${74 + shade},${58 + shade},${40 + shade},0.7)`;
      ctx.fillRect(x, 0, w, size);
    }
    ctx.fillStyle = 'rgba(70,110,50,0.35)';
    for (let i = 0; i < 26; i++) {
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 3 + rng() * 10, 8 + rng() * 20,
        0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintWater(ctx, size) {
    const rng = mulberry32(0xbeef03);
    ctx.fillStyle = '#3d6f7c';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 46; i++) {
      const y = rng() * size;
      ctx.strokeStyle = `rgba(${170 + rng() * 60},${210 + rng() * 40},220,${0.10 + rng() * 0.22})`;
      ctx.lineWidth = 1 + rng() * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 4);
      }
      ctx.stroke();
    }
  }

  _paintPlanks(ctx, size) {
    const rng = mulberry32(0xcafe04);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(0, 0, size, size);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const shade = Math.floor((rng() - 0.5) * 36);
      ctx.fillStyle = `rgb(${122 + shade},${90 + shade},${52 + shade})`;
      ctx.fillRect(0, r * (size / rows) + 2, size, size / rows - 4);
      ctx.strokeStyle = 'rgba(50,34,16,0.6)';
      for (let i = 0; i < 8; i++) {
        const x = rng() * size;
        ctx.beginPath();
        ctx.moveTo(x, r * (size / rows));
        ctx.lineTo(x + (rng() - 0.5) * 20, (r + 1) * (size / rows));
        ctx.stroke();
      }
    }
  }

  _paintFabric(ctx, size) {
    ctx.fillStyle = '#8c8358';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(70,66,44,0.5)';
    for (let x = 0; x < size; x += 22) ctx.fillRect(x, 0, 8, size);
    ctx.fillStyle = 'rgba(255,250,230,0.08)';
    for (let y = 0; y < size; y += 6) ctx.fillRect(0, y, size, 2);
  }

  _makeMaterials() {
    const stoneTexL = this._canvasTex(256, (c, s) => this._paintStone(c, s, '#7d8272', 1.0));
    const stoneTexS = this._canvasTex(256, (c, s) => this._paintStone(c, s, '#868a76', 0.7));
    const darkTex = this._canvasTex(256, (c, s) => this._paintStone(c, s, '#5c6152', 1.3));
    const dirtTex = this._canvasTex(256, (c, s) => this._paintDirt(c, s));
    const leafTex = this._canvasTex(128, (c, s) => this._paintLeaves(c, s));
    const barkTex = this._canvasTex(128, (c, s) => this._paintBark(c, s));
    const waterTex = this._canvasTex(128, (c, s) => this._paintWater(c, s));
    const plankTex = this._canvasTex(128, (c, s) => this._paintPlanks(c, s));
    const fabricTex = this._canvasTex(128, (c, s) => this._paintFabric(c, s));
    waterTex.repeat.set(16, 2);

    this._mats = {
      stoneL: new THREE.MeshStandardMaterial({ map: stoneTexL, roughness: 0.95 }),
      stoneS: new THREE.MeshStandardMaterial({ map: stoneTexS, roughness: 0.9 }),
      dark: new THREE.MeshStandardMaterial({ map: darkTex, roughness: 1.0 }),
      ground: new THREE.MeshStandardMaterial({ map: dirtTex, roughness: 1.0 }),
      leaves: new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.9, color: 0xb9cf9f }),
      leavesDark: new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.95, color: 0x7f9a6a }),
      bark: new THREE.MeshStandardMaterial({ map: barkTex, roughness: 1.0 }),
      water: new THREE.MeshStandardMaterial({
        map: waterTex, transparent: true, opacity: 0.72, roughness: 0.35,
        metalness: 0.1, depthWrite: false, color: 0x9fd4d8
      }),
      wood: new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }),
      fabric: new THREE.MeshStandardMaterial({
        map: fabricTex, roughness: 1.0, side: THREE.DoubleSide
      }),
      gold: new THREE.MeshStandardMaterial({
        color: 0xd8a63c, emissive: 0xff9d2e, emissiveIntensity: 0.8,
        metalness: 0.7, roughness: 0.35
      }),
      vine: new THREE.MeshStandardMaterial({ color: 0x3e6b2c, roughness: 1.0 }),
      fern: new THREE.MeshStandardMaterial({ map: leafTex, color: 0x86b264, roughness: 1.0 }),
      boulder: new THREE.MeshStandardMaterial({ map: stoneTexL, color: 0x9aa584, roughness: 1.0 })
    };
    this._waterMat = this._mats.water;
    this._idolMat = this._mats.gold;
  }

  // ------------------------------------------------------- low-level helpers

  /** Pushes a box geometry into a merge bucket. rotY is visual-only here. */
  _pushBox(bucket, w, h, d, x, y, z, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    scaleUV(g, clamp(Math.max(w, d) / 3, 0.4, 40), clamp(h / 3, 0.4, 40));
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    this._buckets[bucket].push(g);
  }

  /** Pushes a Y-axis cylinder into a merge bucket. */
  _pushCyl(bucket, rTop, rBot, h, seg, x, y, z) {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    scaleUV(g, 2, clamp(h / 3, 0.4, 20));
    g.translate(x, y + h / 2, z);
    this._buckets[bucket].push(g);
  }

  /** Registers an AABB collider; rotY must be a multiple of PI/2 (swaps w/d). */
  _boxCollider(w, h, d, x, y, z, rotY = 0) {
    const quarter = Math.round(rotY / (Math.PI / 2));
    const swap = ((quarter % 2) + 2) % 2 === 1;
    const hw = (swap ? d : w) / 2;
    const hd = (swap ? w : d) / 2;
    this.addCollider(new THREE.Box3(
      new THREE.Vector3(x - hw, y, z - hd),
      new THREE.Vector3(x + hw, y + h, z + hd)
    ));
  }

  /** Merged stone box + collider in one call. */
  _stoneBox(bucket, w, h, d, x, y, z, rotY = 0, collide = true) {
    this._pushBox(bucket, w, h, d, x, y, z, rotY);
    if (collide) this._boxCollider(w, h, d, x, y, z, rotY);
  }

  _flushBuckets() {
    const matFor = {
      stoneL: this._mats.stoneL, stoneS: this._mats.stoneS,
      gold: this._mats.gold, wood: this._mats.wood,
      fabric: this._mats.fabric, ground: this._mats.ground
    };
    for (const key of Object.keys(this._buckets)) {
      const list = this._buckets[key];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      list.length = 0;
      const mesh = new THREE.Mesh(merged, matFor[key]);
      mesh.castShadow = key !== 'ground';
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  _makeInstanced(geo, mat, matrices, { cast = true, receive = true } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    this.group.add(mesh);
    return mesh;
  }

  _matrixAt(x, y, z, rx, ry, rz, sx, sy, sz) {
    const d = this._dummy;
    d.position.set(x, y, z);
    d.rotation.set(rx, ry, rz);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    return d.matrix.clone();
  }

  // --------------------------------------------------------------- lighting

  _buildLights() {
    const sun = new THREE.DirectionalLight(0xf2e8c4, 1.35);
    sun.position.set(-48, 85, -34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0006;
    this.group.add(sun);
    this.group.add(sun.target);
    sun.target.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0x9fb98a, 0x27401f, 0.85);
    this.group.add(hemi);
    const amb = new THREE.AmbientLight(0x3e5233, 0.5);
    this.group.add(amb);
  }

  // ------------------------------------------------------- ground and river

  _buildGroundAndRiver() {
    // Walkable floor: two big slabs (top y = 0) split by the river channel
    // (z 20..26) whose bed slab tops out at -0.4 — knee-deep, auto-steppable.
    const g = (w, d, x, z, top) => {
      const geo = new THREE.BoxGeometry(w, 1.2, d);
      scaleUV(geo, w / 7, d / 7);
      geo.translate(x, top - 0.6, z);
      this._buckets.ground.push(geo);
      this._boxCollider(w, 1.2, d, x, top - 1.2, z);
    };
    g(124, 82, 0, -21, 0);      // north slab  (z -62..20)
    g(124, 36, 0, 44, 0);       // south slab  (z 26..62)
    g(124, 6, 0, 23, -0.4);     // river bed   (z 20..26)

    // Water surface, drifting in update().
    const water = new THREE.Mesh(new THREE.PlaneGeometry(124, 5.7), this._mats.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.15, 23);
    water.receiveShadow = true;
    this.group.add(water);

    // Stepping-stone fords (tops 0.02, riser 0.42 from bed — auto-step).
    for (const fx of [0, -30, 30]) {
      for (const fz of [20.9, 22.9, 24.9]) {
        const jx = fx + (this._rng() - 0.5) * 0.7;
        this._pushCyl('stoneS', 0.95, 1.1, 0.42, 9, jx, -0.4, fz);
        this._boxCollider(1.8, 0.42, 1.8, jx, -0.4, fz);
      }
    }
  }

  _buildPerimeter() {
    // Ancient rampart sealing the map. Bottom sunk to -1.4 so the river bed
    // (top -0.4) is sealed at both ends too.
    const H = 8.4;
    this._stoneBox('stoneL', 126, H, 2.4, 0, -1.4, -61.2);
    this._stoneBox('stoneL', 126, H, 2.4, 0, -1.4, 61.2);
    this._stoneBox('stoneL', 2.4, H, 126, -61.2, -1.4, 0);
    this._stoneBox('stoneL', 2.4, H, 126, 61.2, -1.4, 0);
    // Crumbled crown blocks along the top (decor, out of reach).
    for (let i = 0; i < 34; i++) {
      const t = this._rng() * 4;
      const side = Math.floor(t);
      const s = (t - side) * 116 - 58;
      const w = 1.4 + this._rng() * 2.4;
      const h = 0.5 + this._rng() * 1.2;
      if (side === 0) this._pushBox('stoneL', w, h, 2.2, s, H - 1.4, -61.2);
      else if (side === 1) this._pushBox('stoneL', w, h, 2.2, s, H - 1.4, 61.2);
      else if (side === 2) this._pushBox('stoneL', 2.2, h, w, -61.2, H - 1.4, s);
      else this._pushBox('stoneL', 2.2, h, w, 61.2, H - 1.4, s);
    }
  }

  // ---------------------------------------------------------------- pyramid

  _buildPyramid() {
    // Five shrinking tiers, 1.6 m each, 2.75 m walkable ledges.
    for (let k = 0; k < PYR_HALVES.length; k++) {
      const half = PYR_HALVES[k];
      this._stoneBox('stoneL', half * 2, TIER_H, half * 2, PYR_X, k * TIER_H, PYR_Z);
      // Corner blocks on each ledge (hiding cover).
      if (k < PYR_HALVES.length - 1) {
        const c = half - 0.7;
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            this._stoneBox('stoneS', 1.0, 0.8, 1.0,
              PYR_X + sx * c, (k + 1) * TIER_H, PYR_Z + sz * c);
          }
        }
      }
    }

    // Grand staircases: solid stepped columns, 0.4 rise / 0.7 run, 4.4 wide.
    // South run: z 8 -> -6 (top-tier edge). North run: z -28 -> -14.
    const buildStairs = (startZ, dir) => {
      for (let i = 0; i < 20; i++) {
        const h = (i + 1) * STEP_RISE;
        const zC = startZ + dir * (i + 0.5) * STEP_RUN;
        this._stoneBox('stoneS', 4.4, h, STEP_RUN, PYR_X, 0, zC);
      }
    };
    buildStairs(8, -1);
    buildStairs(-28, 1);

    // Serpent-head plinths flanking each stair base.
    for (const [px, pz] of [[-2.9, 7.6], [2.9, 7.6], [-2.9, -27.6], [2.9, -27.6]]) {
      this._stoneBox('stoneS', 1.3, 1.3, 1.6, PYR_X + px, 0, pz);
      this._pushBox('stoneS', 0.9, 0.7, 1.1, PYR_X + px, 1.3, pz);
      this._pushBox('gold', 0.35, 0.35, 0.35, PYR_X + px, 2.0, pz);
    }

    // Carved alcoves flanking the south stairs (monkey-sized shadow nooks).
    for (const ax of [-6.5, 6.5]) {
      this._pushBox('stoneL', 2.6, 2.2, 0.9, PYR_X + ax, 0, PYR_Z + PYR_HALVES[0] - 0.2);
      this._pushBox('stoneS', 0.6, 2.0, 0.5, PYR_X + ax - 1.2, 0, PYR_Z + PYR_HALVES[0] + 0.25);
      this._pushBox('stoneS', 0.6, 2.0, 0.5, PYR_X + ax + 1.2, 0, PYR_Z + PYR_HALVES[0] + 0.25);
      this._boxCollider(3.0, 2.2, 1.4, PYR_X + ax, 0, PYR_Z + PYR_HALVES[0] + 0.05);
    }
  }

  _buildShrine() {
    const y = PYR_TOP_Y;
    // Inlay floor (visual only, 6 cm).
    this._pushBox('stoneS', 6.4, 0.06, 6.4, PYR_X, y, PYR_Z);
    // Four posts + stacked roof slabs — the landmark silhouette.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this._stoneBox('stoneS', 0.55, 2.3, 0.55, PYR_X + sx * 2.3, y, PYR_Z + sz * 2.3);
      }
    }
    this._stoneBox('stoneL', 6.2, 0.45, 6.2, PYR_X, y + 2.3, PYR_Z);
    this._stoneBox('stoneL', 4.4, 0.4, 4.4, PYR_X, y + 2.75, PYR_Z);
    this._stoneBox('stoneL', 2.7, 0.35, 2.7, PYR_X, y + 3.15, PYR_Z);
    this._pushBox('gold', 1.0, 0.55, 1.0, PYR_X, y + 3.5, PYR_Z);

    // Golden monkey idol on a pedestal (emissive pulses in update()).
    this._stoneBox('stoneS', 1.1, 0.7, 1.1, PYR_X, y, PYR_Z);
    const idol = [];
    const sphere = (r, ox, oy, oz) => {
      const g = new THREE.SphereGeometry(r, 10, 8);
      g.translate(PYR_X + ox, y + oy, PYR_Z + oz);
      idol.push(g);
    };
    sphere(0.42, 0, 1.15, 0);          // body
    sphere(0.28, 0, 1.75, 0);          // head
    sphere(0.11, -0.3, 1.92, 0);       // ears
    sphere(0.11, 0.3, 1.92, 0);
    const crown = new THREE.ConeGeometry(0.2, 0.35, 8);
    crown.translate(PYR_X, y + 2.12, PYR_Z);
    idol.push(crown);
    for (const g of idol) this._buckets.gold.push(g);
  }

  // ------------------------------------------------------------------ plaza

  _buildPlaza() {
    // Cracked paving between pyramid base (z 5) and the river bank (z 20).
    this._pushBox('stoneS', 34, 0.06, 14.4, 0, 0, 12.5);
    for (let i = 0; i < 14; i++) {
      const px = (this._rng() - 0.5) * 30;
      const pz = 6 + this._rng() * 13;
      this._pushBox('stoneS', 1.2 + this._rng() * 1.6, 0.1 + this._rng() * 0.08,
        1.2 + this._rng() * 1.4, px, 0.02, pz, this._rng() * Math.PI);
    }

    // Dry fountain, east side: low round basin + cracked pedestal bowl.
    const fx = 9, fz = 12.5;
    this._pushCyl('stoneS', 3.1, 3.3, 0.42, 14, fx, 0, fz);
    this._boxCollider(6.3, 0.42, 6.3, fx, 0, fz);        // step-over rim
    // Dry silt bottom + rounded stone lip (thin decor, no colliders).
    const silt = new THREE.CylinderGeometry(2.65, 2.65, 0.05, 14);
    silt.translate(fx, 0.395, fz);
    this._buckets.ground.push(silt);
    const lip = new THREE.TorusGeometry(2.95, 0.17, 6, 18);
    lip.rotateX(Math.PI / 2);
    lip.translate(fx, 0.48, fz);
    this._buckets.stoneS.push(lip);
    this._pushCyl('stoneS', 0.5, 0.7, 1.2, 10, fx, 0.42, fz);
    this._pushCyl('stoneS', 1.15, 0.35, 0.5, 12, fx, 1.62, fz); // cracked bowl
    this._boxCollider(1.4, 1.7, 1.4, fx, 0.42, fz);

    // Mossy stela, west side (mirrors the fountain).
    this._stoneBox('stoneL', 1.5, 3.2, 0.7, -9, 0, 12.5);
    this._pushBox('stoneS', 1.9, 0.5, 1.1, -9, -0.02, 12.5);

    // Broken gateway arch where the ford meets the plaza.
    this._stoneBox('stoneS', 1.1, 3.6, 1.1, -2.9, 0, 19.3);
    this._stoneBox('stoneS', 1.1, 3.0, 1.1, 2.9, 0, 19.3);
    this._stoneBox('stoneS', 7.0, 0.7, 1.2, 0, 3.6, 19.3);
  }

  // ------------------------------------------------------------------ ruins

  /** wall(): axis-aligned merged wall segment with collider. */
  _wall(x, z, w, d, h) {
    this._stoneBox('stoneL', w, h, d, x, 0, z);
    // crumbled crest blocks
    const n = Math.floor((Math.max(w, d) / 2.4) * this._rng()) + 1;
    for (let i = 0; i < n; i++) {
      const along = (this._rng() - 0.5) * (Math.max(w, d) - 1);
      const bw = 0.5 + this._rng() * 0.8;
      const bh = 0.25 + this._rng() * 0.5;
      if (w >= d) this._pushBox('stoneL', bw, bh, d * 0.9, x + along, h, z);
      else this._pushBox('stoneL', w * 0.9, bh, bw, x, h, z + along);
    }
  }

  _buildRuinWest() {
    // Roofless two-room house, x -42..-26, z 0..16. Door gaps everywhere.
    this._wall(-37.7, 0.3, 8.6, 0.6, 3.2);   // north, west part
    this._wall(-28.7, 0.3, 5.4, 0.6, 2.6);   // north, east part (gap -33.4..-31.4)
    this._wall(-39.0, 15.7, 6.0, 0.6, 2.4);  // south, west part
    this._wall(-28.0, 15.7, 4.0, 0.6, 3.0);  // south, east part
    this._wall(-41.7, 3.5, 0.6, 7.0, 3.0);   // west, south part
    this._wall(-41.7, 12.3, 0.6, 6.8, 2.2);  // west, north part (gap 7.0..8.9)
    this._wall(-26.3, 2.5, 0.6, 5.0, 2.8);   // east, gap z 5..9
    this._wall(-26.3, 12.5, 0.6, 7.0, 2.2);
    this._wall(-34.0, 3.0, 0.6, 6.0, 2.5);   // inner divider, door z 6..7.6
    this._wall(-34.0, 11.8, 0.6, 8.4, 2.9);
    // Rubble + fallen lintel inside.
    this._stoneBox('stoneS', 1.2, 0.8, 1.0, -38.6, 0, 4.2);
    this._stoneBox('stoneS', 0.9, 0.6, 0.9, -29.5, 0, 13.6);
    this._pushBox('stoneS', 2.4, 0.4, 0.8, -31.0, 0, 6.4, 0.6);
  }

  _buildRuinEast() {
    // Open courtyard temple annex, x 26..42, z -2..14, altar at centre.
    this._wall(31.0, -1.7, 10.0, 0.6, 2.8);  // north, gap 36..38.6
    this._wall(40.3, -1.7, 3.4, 0.6, 2.2);
    this._wall(34.0, 13.7, 16.0, 0.6, 2.4);  // south full
    this._wall(26.3, 2.5, 0.6, 8.0, 2.6);    // west, gap z 6.5..9.5
    this._wall(26.3, 11.6, 0.6, 4.2, 2.0);
    this._wall(41.7, 6.0, 0.6, 15.0, 3.0);   // east full
    // Altar block + offering slabs (hide behind it).
    this._stoneBox('stoneS', 2.0, 1.1, 1.4, 34, 0, 6);
    this._pushBox('gold', 0.5, 0.25, 0.5, 34, 1.1, 6);
    this._stoneBox('stoneS', 0.9, 0.55, 0.9, 31.6, 0, 8.4);
    this._stoneBox('stoneS', 0.9, 0.7, 0.9, 36.6, 0, 3.8);
  }

  _buildTerraces() {
    // NE corner: four broad 0.4 m steps rising to a 1.6 m jungle plateau.
    for (let i = 1; i <= 4; i++) {
      const x0 = 26 + i * 3;
      const z1 = -26 - i * 3;
      const w = 57 - x0;
      const d = z1 + 57;
      this._stoneBox('stoneL', w, i * STEP_RISE, d, x0 + w / 2, 0, -57 + d / 2);
    }
  }

  // ------------------------------------------------------------- colonnade

  _buildColonnadeAndPillars() {
    const standing = []; // {x, z, baseY, hScale, capital}
    // Avenue: plaza -> camp (double row).
    for (let i = 0; i < 5; i++) {
      const z = 27.5 + i * 3.4;
      standing.push({ x: -4, z, baseY: 0, hScale: i === 2 ? 0.45 : 1, capital: i !== 2 });
      standing.push({ x: 4, z, baseY: 0, hScale: i === 3 ? 0.55 : 1, capital: i !== 3 });
    }
    // Plaza flanks.
    for (const z of [6.5, 12.5, 18.2]) {
      standing.push({ x: -14, z, baseY: 0, hScale: z === 12.5 ? 0.5 : 1, capital: z !== 12.5 });
      standing.push({ x: 14, z, baseY: 0, hScale: 1, capital: true });
    }
    // Ruin courtyard pair.
    standing.push({ x: 30, z: 11, baseY: 0, hScale: 1, capital: true });
    standing.push({ x: 38, z: 11, baseY: 0, hScale: 0.4, capital: false });

    const H = 4.4;
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.62, H, 10);
    scaleUV(pillarGeo, 2, 1.6);
    pillarGeo.translate(0, H / 2, 0);
    const mats = [];
    for (const p of standing) {
      mats.push(this._matrixAt(p.x, p.baseY, p.z, 0, this._rng() * Math.PI, 0, 1, p.hScale, 1));
      this._boxCollider(1.24, H * p.hScale, 1.24, p.x, p.baseY, p.z);
    }
    // Toppled pillars: freely rotated, half-buried (visible <= 0.45) so they
    // read as rubble and need no collider.
    const toppled = [
      [-3.2, 33.5, 0.5], [5.8, 31.2, 2.2], [-16.5, 17.5, 1.2],
      [-30, 44, 0.35], [-25, 48, 2.4], [-34, 40, 1.5],
      [28, 46, 0.8], [17.5, 6.5, 2.7]
    ];
    for (const [tx, tz, yaw] of toppled) {
      mats.push(this._matrixAt(tx, -0.07, tz, 0, yaw, Math.PI / 2, 0.9, 0.9, 0.9));
    }
    this._makeInstanced(pillarGeo, this._mats.stoneS, mats);

    // Capitals on intact pillars.
    const capGeo = new THREE.BoxGeometry(1.35, 0.5, 1.35);
    scaleUV(capGeo, 0.5, 0.3);
    const capMats = [];
    for (const p of standing) {
      if (!p.capital) continue;
      capMats.push(this._matrixAt(p.x, p.baseY + H * p.hScale + 0.25, p.z,
        0, this._rng() * Math.PI, 0, 1, 1, 1));
    }
    this._makeInstanced(capGeo, this._mats.stoneL, capMats);
  }

  // ------------------------------------------------------------------- camp

  _buildCamp() {
    // Expedition clearing at the south edge (x -12..12, z 41..57).
    // Canvas A-frame tents — leaned boxes, collider:false per design.
    const tent = (x, z, yaw) => {
      const grp = new THREE.Group();
      const panel = new THREE.BoxGeometry(2.7, 0.1, 3.2);
      scaleUV(panel, 1.4, 1.6);
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(panel.clone(), this._mats.fabric);
        m.position.set(s * 0.95, 0.82, 0);
        m.rotation.z = s * 1.02;
        m.castShadow = true;
        grp.add(m);
      }
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.5, 0.08), this._mats.fabric);
      back.position.set(0, 0.72, -1.5);
      back.castShadow = true;
      grp.add(back);
      grp.position.set(x, 0, z);
      grp.rotation.y = yaw;
      this.group.add(grp);
      panel.dispose();
    };
    tent(-7.5, 47, 0.5);
    tent(7.5, 47.5, -0.55);
    tent(0, 54.5, Math.PI);

    // Supply crates (instanced, colliders — also hiding cover).
    const crateGeo = new THREE.BoxGeometry(1, 1, 1);
    const crateMats = [];
    const crates = [
      [9.2, 44.2, 0.9, 0], [9.2, 44.2, 0.75, 0.9], [10.4, 46.0, 0.85, 0],
      [8.2, 45.6, 0.7, 0], [-9.5, 51.5, 0.9, 0], [-10.4, 49.8, 0.8, 0],
      [-8.6, 53.0, 0.7, 0], [11.0, 48.2, 0.75, 0], [-6.2, 55.4, 0.85, 0]
    ];
    let stackTop = 0;
    for (const [cx, cz, s, stackY] of crates) {
      const baseY = stackY === 0 ? 0 : stackTop;
      crateMats.push(this._matrixAt(cx, baseY + s / 2, cz, 0, 0, 0, s, s, s));
      this._boxCollider(s, s, s, cx, baseY, cz);
      if (stackY === 0) stackTop = s;
    }
    this._makeInstanced(crateGeo, this._mats.wood, crateMats);

    // Campfire: stone ring, crossed logs, flickering flame (update()).
    const fx = 0, fz = 49;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this._pushBox('stoneS', 0.35, 0.28, 0.35,
        fx + Math.cos(a) * 0.85, 0, fz + Math.sin(a) * 0.85, a);
    }
    for (const yaw of [0.4, 1.7]) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 6), this._mats.bark);
      log.rotation.set(Math.PI / 2, 0, yaw);
      log.position.set(fx, 0.14, fz);
      log.castShadow = true;
      this.group.add(log);
    }
    this._flameMat = new THREE.MeshStandardMaterial({
      color: 0xff7a1e, emissive: 0xff9a30, emissiveIntensity: 1.6,
      transparent: true, opacity: 0.85, depthWrite: false
    });
    this._flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 7), this._flameMat);
    this._flame.position.set(fx, 0.55, fz);
    this.group.add(this._flame);

    // Expedition banner at the camp entrance.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 4.2, 6), this._mats.bark);
    pole.position.set(-2.5, 2.1, 42);
    pole.castShadow = true;
    this.group.add(pole);
    const flag = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.05), this._mats.fabric);
    flag.position.set(-1.7, 3.6, 42);
    flag.castShadow = true;
    this.group.add(flag);
  }

  // ----------------------------------------------------------------- jungle

  /** True where big vegetation must not spawn (structures, paths, water). */
  _inKeepZone(x, z) {
    for (const s of this._allSpawns) {
      if ((s.x - x) * (s.x - x) + (s.z - z) * (s.z - z) < 2.2 * 2.2) return true;
    }
    if (Math.abs(x) < 17 && z > -31 && z < 10) return true;   // pyramid + stairs
    if (Math.abs(x) < 18 && z >= 3 && z < 21) return true;    // plaza
    if (z > 18 && z < 28.5) return true;                      // river
    if (Math.abs(x) < 7.5 && z >= 26 && z < 42) return true;  // avenue
    if (Math.abs(x) < 13.5 && z >= 40 && z < 58.5) return true; // camp
    if (x > -44.5 && x < -23.5 && z > -2.5 && z < 18.5) return true; // west ruin
    if (x > 23.5 && x < 44.5 && z > -4.5 && z < 16.5) return true;   // east ruin
    if (x > 27 && z < -27) return true;                       // terraces (explicit trees)
    return false;
  }

  _buildJungle() {
    const trees = []; // {x, z, baseY, s}
    const clearOthers = (x, z, dist) =>
      trees.every((t) => (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) > dist * dist);

    // Perimeter ring — dense canopy pressing against the ramparts.
    const ringPts = 62;
    for (let i = 0; i < ringPts; i++) {
      const t = (i / ringPts) * 4;
      const side = Math.floor(t);
      const f = (t - side) * 2 - 1;
      const r = 51 + this._rng() * 6;
      let x, z;
      if (side === 0) { x = f * 53; z = -r; }
      else if (side === 1) { x = r; z = f * 53; }
      else if (side === 2) { x = -f * 53; z = r; }
      else { x = -r; z = -f * 53; }
      x += (this._rng() - 0.5) * 3;
      z += (this._rng() - 0.5) * 3;
      if (Math.abs(x) > 57.5 || Math.abs(z) > 57.5) continue;
      if (this._inKeepZone(x, z) || !clearOthers(x, z, 3.2)) continue;
      trees.push({ x, z, baseY: 0, s: 0.85 + this._rng() * 0.55 });
    }
    // Interior groves.
    const groves = [
      [-48, -48, -20, -26, 9], [24, 30, 48, 52, 7], [-48, 30, -16, 52, 7],
      [20, -22, 46, -8, 5], [-46, -22, -20, -6, 5]
    ];
    for (const [x0, z0, x1, z1, count] of groves) {
      let placed = 0, tries = 0;
      while (placed < count && tries++ < 60) {
        const x = x0 + this._rng() * (x1 - x0);
        const z = z0 + this._rng() * (z1 - z0);
        if (this._inKeepZone(x, z) || !clearOthers(x, z, 3.6)) continue;
        trees.push({ x, z, baseY: 0, s: 0.8 + this._rng() * 0.6 });
        placed++;
      }
    }
    // Plateau trees on the NE terraces.
    for (const [x, z] of [[46, -48], [51, -42], [42, -52], [53, -52], [44, -41]]) {
      trees.push({ x, z, baseY: 1.6, s: 0.9 + this._rng() * 0.4 });
    }

    // Instanced trunks (with colliders) + canopy blobs (no colliders).
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.48, 1, 7);
    scaleUV(trunkGeo, 2, 3);
    trunkGeo.translate(0, 0.5, 0);
    const blobGeo = new THREE.SphereGeometry(1, 8, 6);
    const frondGeo = new THREE.ConeGeometry(1, 1.6, 7);
    const trunkMats = [], blobMats = [], frondMats = [];
    for (const t of trees) {
      const h = (5.5 + this._rng() * 3.2) * t.s;
      const lean = (this._rng() - 0.5) * 0.08;
      trunkMats.push(this._matrixAt(t.x, t.baseY, t.z, lean, this._rng() * Math.PI, lean, t.s, h, t.s));
      this._boxCollider(0.95 * t.s, h, 0.95 * t.s, t.x, t.baseY, t.z);
      const blobs = 2 + Math.floor(this._rng() * 2);
      for (let b = 0; b < blobs; b++) {
        const r = (1.9 + this._rng() * 1.3) * t.s;
        blobMats.push(this._matrixAt(
          t.x + (this._rng() - 0.5) * 2.4 * t.s,
          t.baseY + h - 0.4 + this._rng() * 1.6,
          t.z + (this._rng() - 0.5) * 2.4 * t.s,
          this._rng() * 0.5, this._rng() * Math.PI, 0,
          r, r * (0.62 + this._rng() * 0.25), r));
      }
      frondMats.push(this._matrixAt(t.x, t.baseY + h - 1.2 * t.s, t.z,
        0, this._rng() * Math.PI, 0, 2.1 * t.s, 1.6 * t.s, 2.1 * t.s));
    }
    this._makeInstanced(trunkGeo, this._mats.bark, trunkMats);
    this._makeInstanced(blobGeo, this._mats.leaves, blobMats);
    this._makeInstanced(frondGeo, this._mats.leavesDark, frondMats);
    this._trees = trees;

    // Undergrowth: ferns + grass tufts (visual only, monkey-height cover).
    const fernGeo = new THREE.ConeGeometry(0.62, 1.0, 6);
    const tuftGeo = new THREE.ConeGeometry(0.3, 0.55, 5);
    const fernMats = [], tuftMats = [];
    const scatterVeg = (list, count, minR, maxR) => {
      let placed = 0, tries = 0;
      while (placed < count && tries++ < count * 8) {
        const x = (this._rng() - 0.5) * 114;
        const z = (this._rng() - 0.5) * 114;
        if (this._inKeepZone(x, z)) continue;
        const s = minR + this._rng() * (maxR - minR);
        list.push(this._matrixAt(x, 0.3 * s, z, (this._rng() - 0.5) * 0.25,
          this._rng() * Math.PI, (this._rng() - 0.5) * 0.25, s, s, s));
        placed++;
      }
    };
    scatterVeg(fernMats, 95, 0.8, 1.7);
    scatterVeg(tuftMats, 120, 0.7, 1.4);
    // Reed clumps hugging the river banks.
    for (let i = 0; i < 26; i++) {
      const x = (this._rng() - 0.5) * 116;
      const z = this._rng() < 0.5 ? 18.9 + this._rng() * 0.8 : 27.1 + this._rng() * 0.8;
      tuftMats.push(this._matrixAt(x, 0.5, z, 0, this._rng() * Math.PI, 0,
        0.9, 1.7 + this._rng(), 0.9));
    }
    this._makeInstanced(fernGeo, this._mats.fern, fernMats, { cast: false });
    this._makeInstanced(tuftGeo, this._mats.leavesDark, tuftMats, { cast: false });
  }

  _buildBoulders() {
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rocks = [
      [-40, -35, 1.7], [-33, -41, 1.2], [-27, -30, 1.5], [-44, -26, 1.0],
      [-38, -46, 1.3], [30, 40, 1.5], [40, 36, 1.1], [35, 47, 1.6],
      [45, 43, 0.9], [-18, 24.5, 0.8], [21, 28.6, 0.9], [-44, 22, 1.4],
      [50, 20, 1.3], [-52, 4, 1.5], [18, -32, 1.2], [-14, -38, 1.4]
    ];
    const rockMats = [];
    for (const [x, z, s] of rocks) {
      rockMats.push(this._matrixAt(x, s * 0.72, z,
        this._rng() * Math.PI, this._rng() * Math.PI, this._rng() * Math.PI,
        s, s * 0.85, s));
      if (s >= 0.9) this._boxCollider(1.5 * s, 1.35 * s, 1.5 * s, x, 0, z);
    }
    // Terrace plateau boulders (base y 1.6).
    for (const [x, z, s] of [[48, -46, 1.2], [41, -44, 0.9]]) {
      rockMats.push(this._matrixAt(x, 1.6 + s * 0.72, z,
        this._rng() * Math.PI, this._rng() * Math.PI, 0, s, s * 0.85, s));
      this._boxCollider(1.5 * s, 1.35 * s, 1.5 * s, x, 1.6, z);
    }
    this._makeInstanced(rockGeo, this._mats.boulder, rockMats);
  }

  // ------------------------------------------------------------------ vines

  _buildVines() {
    // Hanging vines: attach point + length + phase; matrices recomputed in
    // update() so they sway from their anchors.
    const add = (x, y, z, len) => {
      this._vines.push({ x, y, z, len, phase: this._rng() * Math.PI * 2, yaw: this._rng() * Math.PI });
    };
    // Pyramid tier lips.
    for (let k = 1; k <= 4; k++) {
      const half = PYR_HALVES[k];
      const y = (k + 1) * TIER_H;
      add(PYR_X - half, y, PYR_Z - half * 0.4, 1.0 + this._rng());
      add(PYR_X + half, y, PYR_Z + half * 0.5, 1.0 + this._rng());
      add(PYR_X + half * 0.6, y, PYR_Z - half, 0.9 + this._rng());
      add(PYR_X - half * 0.5, y, PYR_Z + half, 0.9 + this._rng());
    }
    // Shrine roof corners.
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        add(PYR_X + sx * 3.0, PYR_TOP_Y + 2.5, PYR_Z + sz * 3.0, 1.6 + this._rng());
      }
    }
    // Gateway arch + ruin walls.
    add(-1.4, 3.9, 19.3, 2.4); add(1.6, 3.9, 19.3, 2.0);
    add(-34, 2.8, 8.0, 1.6); add(-41.7, 2.9, 5.0, 1.7);
    add(41.7, 2.9, 7.0, 1.8); add(31, 2.7, -1.7, 1.4);
    // A few jungle trees near paths.
    if (this._trees) {
      for (let i = 0; i < this._trees.length; i += 11) {
        const t = this._trees[i];
        add(t.x + 1.2, t.baseY + 5.4 * t.s, t.z, 2.2 + this._rng() * 1.4);
      }
    }

    const geo = new THREE.CylinderGeometry(0.045, 0.028, 1, 5);
    geo.translate(0, -0.5, 0); // pivot at the anchor (top)
    this._vineMesh = new THREE.InstancedMesh(geo, this._mats.vine, this._vines.length);
    this._vineMesh.castShadow = false;
    this._vineMesh.receiveShadow = false;
    this.group.add(this._vineMesh);
    this._updateVines(0);
  }

  _updateVines(time) {
    const d = this._dummy;
    for (let i = 0; i < this._vines.length; i++) {
      const v = this._vines[i];
      const sway = Math.sin(time * 0.9 + v.phase) * 0.16;
      const sway2 = Math.cos(time * 0.7 + v.phase * 1.7) * 0.12;
      d.position.set(v.x, v.y, v.z);
      d.rotation.set(sway2, v.yaw, sway);
      d.scale.set(1, v.len, 1);
      d.updateMatrix();
      this._vineMesh.setMatrixAt(i, d.matrix);
    }
    this._vineMesh.instanceMatrix.needsUpdate = true;
  }

  _buildFireflies() {
    const N = 110;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (this._rng() - 0.5) * 112;
      pos[i * 3 + 1] = 0.5 + this._rng() * 3.2;
      pos[i * 3 + 2] = (this._rng() - 0.5) * 112;
    }
    this._fireflyBase = pos.slice();
    this._fireflyGeo = new THREE.BufferGeometry();
    this._fireflyGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xd6ff9a, size: 0.16, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(this._fireflyGeo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: expedition camp clearing, south edge.
    this.policeSpawns = [
      v(-3, 0, 46), v(3, 0, 46), v(-4.5, 0, 51.5), v(4.5, 0, 51.5), v(0, 0, 44)
    ];
    // Monkeys: temple nooks, foliage, ruins, riverbed, terraces...
    this.monkeySpawns = [
      v(1.6, PYR_TOP_Y, PYR_Z + 1.6),      // inside the shrine
      v(8.2, 3 * TIER_H, PYR_Z),           // pyramid tier-2 ledge, east
      v(-13, TIER_H, -22),                 // tier-0 ledge, NW corner
      v(-36, 0, 10),                       // west ruin, back room
      v(34, 0, 8.4),                       // east ruin, behind the altar
      v(10.7, 0.42, 12.5),                 // inside the dry fountain basin
      v(44, 1.6, -44),                     // NE terrace plateau
      v(-40, 0, -32.4),                    // NW boulder grove
      v(14, -0.4, 23),                     // wading in the riverbed
      v(5.5, 0, 34.4),                     // behind an avenue pillar
      v(-35, 0, 44.5),                     // SW toppled-pillar field
      v(22, 0, 10.3),                      // foliage east of the plaza
      v(-28, 0, -20),                      // west grove
      v(-6.5, 0, 6.2)                      // alcove nook at the pyramid base
    ];
    this._allSpawns = [...this.policeSpawns, ...this.monkeySpawns];
  }

  /** Dev safety net: warn if any spawn overlaps a collider. */
  _validateSpawns() {
    const all = [...this.policeSpawns, ...this.monkeySpawns];
    const box = new THREE.Box3();
    for (const s of all) {
      box.min.set(s.x - 0.34, s.y + 0.06, s.z - 0.34);
      box.max.set(s.x + 0.34, s.y + 1.76, s.z + 0.34);
      for (const c of this.colliders) {
        if (box.intersectsBox(c)) {
          console.warn('[JungleTemple] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    // 1) River flow — scroll the water CanvasTexture.
    if (this._waterMat && this._waterMat.map) {
      this._waterMat.map.offset.x = (time * 0.05) % 1;
      this._waterMat.map.offset.y = Math.sin(time * 0.45) * 0.02;
    }
    // 2) Swaying vines.
    if (this._vineMesh) this._updateVines(time);
    // 3) Campfire flicker.
    if (this._flame) {
      const f = 1 + Math.sin(time * 11) * 0.14 + Math.sin(time * 23 + 1.7) * 0.09;
      this._flame.scale.set(1, Math.max(0.5, f), 1);
      this._flameMat.opacity = 0.7 + 0.2 * Math.sin(time * 17);
    }
    // 4) Golden idol pulse.
    if (this._idolMat) {
      this._idolMat.emissiveIntensity = 0.55 + 0.4 * (0.5 + 0.5 * Math.sin(time * 1.6));
    }
    // 5) Drifting fireflies.
    if (this._fireflyGeo) {
      const attr = this._fireflyGeo.attributes.position;
      const arr = attr.array;
      const base = this._fireflyBase;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = base[i] + Math.sin(time * 0.35 + i) * 0.8;
        arr[i + 1] = base[i + 1] + Math.sin(time * 0.8 + i * 1.3) * 0.35;
        arr[i + 2] = base[i + 2] + Math.cos(time * 0.3 + i * 0.7) * 0.8;
      }
      attr.needsUpdate = true;
    }
  }
}
