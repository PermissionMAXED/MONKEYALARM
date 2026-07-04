import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * BANANA BAY DOCKS — "A sunset cargo harbor: containers, cranes and a
 * moored freighter."
 *
 * Layout (144 x 144, sealed by concrete sea-walls at +/-70):
 * - South strip (z 40..70) is the bay: a wadeable water bed (top -0.4,
 *   auto-steppable back onto the quay) under a drifting water plane.
 * - A freighter is moored mid-bay, boarded by a 0.4-rise gangway stair;
 *   its deck ring surrounds a sunken cargo-hold pit with crate steps out.
 * - Container yard fills the centre: 4 instanced rows with alleys, some
 *   stacks 2 high, plus scattered singles in the north lot.
 * - Two gantry cranes (one over the yard, one on the quay) each have a
 *   21-step grand stair up to a railed, walkable boom platform.
 * - West: a warehouse with two roller-gate gaps, shelving rows and a
 *   catwalk. South-east: a rocky point with a lighthouse whose wrapping
 *   ledge stair reaches a balcony; its beam sweeps in update().
 * - North edge: harbor security gate — the police spawn.
 * - update(): water drift, bobbing rowboats, rotating beam, swinging
 *   crane hooks, drifting gull flock.
 */

const STEP_RISE = 0.4;           // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;            // stair tread depth
const DECK_Y = 2.8;              // freighter deck height
const HOLD_Y = 1.6;              // cargo-hold pit floor
const BOOM_Y = 8.4;              // crane boom platform walking height

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

export default class BananaBayMap extends MapBase {
  constructor() {
    super();
    this.id = 'BANANA_BAY';
    this.name = 'Banana Bay Docks';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-72, -4, -72),
      new THREE.Vector3(72, 45, 72)
    );
    this.killY = -12;
    this.environment = {
      skyColor: 0xf2a35e,
      fog: { color: 0xeda060, near: 35, far: 150 }
    };

    this._rng = mulberry32(0xba17a7);
    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = {
      ground: [], concrete: [], metal: [], crane: [],
      hull: [], wood: [], white: [], rock: [], dark: []
    };
    this._waterMat = null;
    this._hooks = [];
    this._boats = [];
    this._beamGroup = null;
    this._gullGeo = null;
    this._gullBase = null;
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns();
    this._buildLights();
    this._buildGroundAndWater();
    this._buildPerimeter();
    this._buildShip();
    this._buildContainers();
    this._buildCrane(20, 35.5, 0.0);    // quay crane
    this._buildCrane(-22, 12.5, 2.1);   // yard crane
    this._buildWarehouse();
    this._buildLighthouse();
    this._buildGate();
    this._buildClutter();
    this._buildBoats();
    this._buildGulls();
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

  _paintMetal(ctx, size) {
    const rng = mulberry32(0x4d0c01);
    ctx.fillStyle = '#878c91';
    ctx.fillRect(0, 0, size, size);
    const plates = 4;
    const p = size / plates;
    for (let r = 0; r < plates; r++) {
      for (let c = 0; c < plates; c++) {
        const shade = Math.floor((rng() - 0.5) * 26);
        ctx.fillStyle = `rgba(${132 + shade},${138 + shade},${144 + shade},0.55)`;
        ctx.fillRect(c * p + 1, r * p + 1, p - 2, p - 2);
      }
    }
    ctx.strokeStyle = 'rgba(40,44,48,0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= plates; i++) {
      ctx.strokeRect(0, i * p, size, 0.1);
      ctx.strokeRect(i * p, 0, 0.1, size);
    }
    // rivets
    ctx.fillStyle = 'rgba(50,54,58,0.8)';
    for (let r = 0; r <= plates; r++) {
      for (let i = 0; i < size; i += 12) {
        ctx.fillRect(i + 4, r * p + 3, 2, 2);
        ctx.fillRect(r * p + 3, i + 4, 2, 2);
      }
    }
    // rust streaks
    for (let i = 0; i < 22; i++) {
      const x = rng() * size;
      ctx.fillStyle = `rgba(${120 + rng() * 50},${66 + rng() * 24},34,${0.10 + rng() * 0.16})`;
      ctx.fillRect(x, rng() * size * 0.5, 2 + rng() * 4, 20 + rng() * 60);
    }
  }

  _paintConcrete(ctx, size) {
    const rng = mulberry32(0xc0dec2);
    ctx.fillStyle = '#a09a8d';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 700; i++) {
      const g = 130 + Math.floor((rng() - 0.5) * 60);
      ctx.fillStyle = `rgba(${g},${g - 4},${g - 14},0.35)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        1 + rng() * 4, 1 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // expansion joints
    ctx.strokeStyle = 'rgba(52,50,44,0.55)';
    ctx.lineWidth = 3;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, i * size / 4); ctx.lineTo(size, i * size / 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(i * size / 4, 0); ctx.lineTo(i * size / 4, size); ctx.stroke();
    }
    // oil stains
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(30,28,26,${0.08 + rng() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 8 + rng() * 26, 6 + rng() * 18,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintContainer(ctx, size) {
    const rng = mulberry32(0xc047a1);
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(0, 0, size, size);
    // vertical corrugation ribs (tinted by material color)
    const rib = size / 14;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 ? 'rgba(90,90,90,0.35)' : 'rgba(255,255,255,0.16)';
      ctx.fillRect(i * rib, 0, rib * 0.55, size);
    }
    ctx.fillStyle = 'rgba(40,40,40,0.5)';
    ctx.fillRect(0, 0, size, 5);
    ctx.fillRect(0, size - 5, size, 5);
    // scuffs + rust spots
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${70 + rng() * 60},${50 + rng() * 30},30,${0.10 + rng() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 2 + rng() * 8, 1 + rng() * 4,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintPlanks(ctx, size) {
    const rng = mulberry32(0xcafe04);
    ctx.fillStyle = '#8a7350';
    ctx.fillRect(0, 0, size, size);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const shade = Math.floor((rng() - 0.5) * 34);
      ctx.fillStyle = `rgb(${138 + shade},${112 + shade},${74 + shade})`;
      ctx.fillRect(0, r * (size / rows) + 2, size, size / rows - 4);
      ctx.strokeStyle = 'rgba(56,42,22,0.6)';
      for (let i = 0; i < 8; i++) {
        const x = rng() * size;
        ctx.beginPath();
        ctx.moveTo(x, r * (size / rows));
        ctx.lineTo(x + (rng() - 0.5) * 20, (r + 1) * (size / rows));
        ctx.stroke();
      }
    }
  }

  _paintRock(ctx, size) {
    const rng = mulberry32(0x50c7e5);
    ctx.fillStyle = '#71695f';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const g = 90 + Math.floor((rng() - 0.5) * 70);
      ctx.fillStyle = `rgba(${g},${g - 6},${g - 16},0.45)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 4 + rng() * 20, 3 + rng() * 12,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(34,30,26,0.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      let x = rng() * size, y = rng() * size;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (rng() - 0.5) * 44; y += rng() * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  _paintWhite(ctx, size) {
    const rng = mulberry32(0x11f0e5);
    ctx.fillStyle = '#efe9dd';
    ctx.fillRect(0, 0, size, size);
    // two red lighthouse bands (v runs up the cylinder)
    ctx.fillStyle = '#b03a2a';
    ctx.fillRect(0, size * 0.30, size, size * 0.12);
    ctx.fillRect(0, size * 0.62, size, size * 0.12);
    // weather streaks
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(120,110,96,${0.06 + rng() * 0.1})`;
      ctx.fillRect(rng() * size, rng() * size * 0.6, 1 + rng() * 3, 14 + rng() * 40);
    }
  }

  _paintWater(ctx, size) {
    const rng = mulberry32(0xbeef03);
    ctx.fillStyle = '#2e6076';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 44; i++) {
      const y = rng() * size;
      const warm = rng() < 0.45;
      ctx.strokeStyle = warm
        ? `rgba(255,${170 + rng() * 50},${100 + rng() * 40},${0.10 + rng() * 0.18})`
        : `rgba(${160 + rng() * 60},${205 + rng() * 40},220,${0.08 + rng() * 0.18})`;
      ctx.lineWidth = 1 + rng() * 2.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 4);
      }
      ctx.stroke();
    }
  }

  _makeMaterials() {
    const metalTex = this._canvasTex(256, (c, s) => this._paintMetal(c, s));
    const concTex = this._canvasTex(256, (c, s) => this._paintConcrete(c, s));
    const contTex = this._canvasTex(128, (c, s) => this._paintContainer(c, s));
    const plankTex = this._canvasTex(128, (c, s) => this._paintPlanks(c, s));
    const rockTex = this._canvasTex(256, (c, s) => this._paintRock(c, s));
    const whiteTex = this._canvasTex(128, (c, s) => this._paintWhite(c, s));
    const waterTex = this._canvasTex(128, (c, s) => this._paintWater(c, s));
    waterTex.repeat.set(18, 4);

    this._mats = {
      concrete: new THREE.MeshStandardMaterial({ map: concTex, roughness: 1.0 }),
      metal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.75, metalness: 0.25 }),
      crane: new THREE.MeshStandardMaterial({
        map: metalTex, color: 0xd9822b, roughness: 0.7, metalness: 0.3
      }),
      hull: new THREE.MeshStandardMaterial({
        map: metalTex, color: 0x9c4530, roughness: 0.8, metalness: 0.25
      }),
      wood: new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }),
      rock: new THREE.MeshStandardMaterial({ map: rockTex, roughness: 1.0 }),
      white: new THREE.MeshStandardMaterial({ map: whiteTex, roughness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1c2126, roughness: 0.5, metalness: 0.4 }),
      water: new THREE.MeshStandardMaterial({
        map: waterTex, transparent: true, opacity: 0.74, roughness: 0.3,
        metalness: 0.15, depthWrite: false, color: 0xdba36a
      }),
      contRed: new THREE.MeshStandardMaterial({ map: contTex, color: 0xb3402e, roughness: 0.75 }),
      contBlue: new THREE.MeshStandardMaterial({ map: contTex, color: 0x2e5f8a, roughness: 0.75 }),
      contGreen: new THREE.MeshStandardMaterial({ map: contTex, color: 0x3f7d4e, roughness: 0.75 }),
      net: new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 1.0 })
    };
    this._waterMat = this._mats.water;
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

  /** Merged box + collider in one call. */
  _solid(bucket, w, h, d, x, y, z, rotY = 0) {
    this._pushBox(bucket, w, h, d, x, y, z, rotY);
    this._boxCollider(w, h, d, x, y, z, rotY);
  }

  _flushBuckets() {
    const matFor = {
      ground: this._mats.concrete, concrete: this._mats.concrete,
      metal: this._mats.metal, crane: this._mats.crane,
      hull: this._mats.hull, wood: this._mats.wood,
      white: this._mats.white, rock: this._mats.rock, dark: this._mats.dark
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

  /** Solid stepped stair along +x or +z; 0.4 rise / 0.7 run columns from y0. */
  _stairs(bucket, count, width, x, z, axis, dir, y0 = 0) {
    for (let i = 0; i < count; i++) {
      const h = (i + 1) * STEP_RISE;
      const off = dir * (i + 0.5) * STEP_RUN;
      if (axis === 'x') this._solid(bucket, STEP_RUN, h, width, x + off, y0, z);
      else this._solid(bucket, width, h, STEP_RUN, x, y0, z + off);
    }
  }

  // --------------------------------------------------------------- lighting

  _buildLights() {
    // Low golden-hour sun from over the bay (south-west).
    const sun = new THREE.DirectionalLight(0xffc27a, 1.5);
    sun.position.set(-55, 38, 85);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -95;
    sun.shadow.camera.right = 95;
    sun.shadow.camera.top = 95;
    sun.shadow.camera.bottom = -95;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 260;
    sun.shadow.bias = -0.0006;
    this.group.add(sun);
    this.group.add(sun.target);
    sun.target.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xffb877, 0x3a3f4a, 0.7);
    this.group.add(hemi);
    const amb = new THREE.AmbientLight(0x6b4a33, 0.45);
    this.group.add(amb);
  }

  // -------------------------------------------------------- ground and water

  _buildGroundAndWater() {
    // Quay slab (top 0) north of z 40; water bed slab (top -0.4) to the
    // south — a 0.4 drop each way, wadeable via auto-step.
    this._pushBox('ground', 146, 1.2, 112.6, 0, -1.2, -16.3);
    this._boxCollider(146, 1.2, 112.6, 0, -1.2, -16.3);
    this._pushBox('ground', 146, 1.2, 32.6, 0, -1.6, 56.3);
    this._boxCollider(146, 1.2, 32.6, 0, -1.6, 56.3);

    // Water surface, drifting in update().
    const water = new THREE.Mesh(new THREE.PlaneGeometry(140, 29.6), this._mats.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.15, 54.9);
    water.receiveShadow = true;
    this.group.add(water);

    // Quay safety stripe + bollards (decor).
    this._pushBox('white', 140, 0.04, 0.5, 0, 0.001, 39.4);
    const bollGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.85, 8);
    const bollMats = [];
    for (let x = -64; x <= 64; x += 8) {
      if (Math.abs(x + 16) < 2.5) continue;      // gangway lane
      if (Math.abs(x - 10) < 1.6 || Math.abs(x - 30) < 1.6) continue; // crane legs
      bollMats.push(this._matrixAt(x, 0.42, 39.3, 0, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(bollGeo, this._mats.dark, bollMats, { cast: false });
  }

  _buildPerimeter() {
    // Concrete sea-walls, bottoms sunk to -1.6 so the water bed (top -0.4)
    // is sealed on all sides too.
    this._solid('concrete', 146, 9.6, 2.4, 0, -1.6, -70.6);
    this._solid('concrete', 146, 9.6, 2.4, 0, -1.6, 70.6);
    this._solid('concrete', 2.4, 9.6, 146, -70.6, -1.6, 0);
    this._solid('concrete', 2.4, 9.6, 146, 70.6, -1.6, 0);
    // Cap blocks along the crest (decor, out of reach).
    for (let i = 0; i < 26; i++) {
      const t = this._rng() * 4;
      const side = Math.floor(t);
      const s = (t - side) * 132 - 66;
      const w = 2 + this._rng() * 3;
      if (side === 0) this._pushBox('concrete', w, 0.5, 2.2, s, 8.0, -70.6);
      else if (side === 1) this._pushBox('concrete', w, 0.5, 2.2, s, 8.0, 70.6);
      else if (side === 2) this._pushBox('concrete', 2.2, 0.5, w, -70.6, 8.0, s);
      else this._pushBox('concrete', 2.2, 0.5, w, 70.6, 8.0, s);
    }
  }

  // ------------------------------------------------------------------- ship

  _buildShip() {
    // Hull base: x -22..14, z 45.5..56.5; its top (1.6) is the hold floor.
    this._solid('hull', 36, 2.8, 11, -4, -1.2, 51);
    // Deck ring around the cargo-hold pit (x -12..-2, z 47.5..54.5).
    this._solid('hull', 10, 1.2, 11, -17, HOLD_Y, 51);   // west deck
    this._solid('hull', 16, 1.2, 11, 6, HOLD_Y, 51);     // east deck
    this._solid('hull', 10, 1.2, 2, -7, HOLD_Y, 46.5);   // north strip
    this._solid('hull', 10, 1.2, 2, -7, HOLD_Y, 55.5);   // south strip
    // Pointed bow (decor, freely rotated) + one AABB approximation.
    this._pushBox('hull', 6, 4.0, 4, -23.5, -1.2, 48.2, 0.6);
    this._pushBox('hull', 6, 4.0, 4, -23.5, -1.2, 53.8, -0.6);
    this._boxCollider(4, 4.0, 7, -23.5, -1.2, 51);
    // Forecastle step (0.4, walkable) + mast.
    this._solid('hull', 4, 0.4, 11, -20, DECK_Y, 51);
    this._pushCyl('metal', 0.07, 0.1, 4.5, 8, -20, 3.2, 51);
    this._pushBox('metal', 1.6, 0.1, 0.1, -20, 6.6, 51);

    // Bulwark rails (0.9 high) with a gap where the gangway lands.
    this._solid('hull', 4.6, 0.9, 0.3, -19.7, DECK_Y, 45.65);
    this._solid('hull', 28.6, 0.9, 0.3, -0.3, DECK_Y, 45.65);
    this._solid('hull', 36, 0.9, 0.3, -4, DECK_Y, 56.35);
    this._solid('hull', 0.3, 0.9, 11, -21.85, DECK_Y, 51);
    this._solid('hull', 0.3, 0.9, 11, 13.85, DECK_Y, 51);

    // Gangway: 7 steps from the quay edge (z 40, top 0) up to the deck.
    this._stairs('wood', 7, 2.4, -16, 40, 'z', 1);
    this._solid('wood', 2.4, DECK_Y, 0.9, -16, 0, 45.25); // landing plate

    // Hold escape: pallet (2.0) -> crate (2.4) -> deck (2.8), 0.4 rises.
    this._solid('wood', 1.4, 0.4, 1.4, -2.9, HOLD_Y, 52.9);
    // (the 0.8 crate is added with the instanced crates in _buildClutter)
    this._holdCrate = { x: -2.9, z: 51.5 };

    // Deckhouse + white bridge + windows + funnel.
    this._solid('hull', 7, 3.0, 8, 9, DECK_Y, 51);
    this._solid('white', 7.4, 2.2, 4.5, 9, 5.8, 49.5);
    this._pushBox('dark', 6.6, 0.7, 0.12, 9, 6.7, 47.22);
    this._pushBox('dark', 0.12, 0.6, 3.4, 12.75, 6.6, 49.5);
    this._pushBox('dark', 0.12, 0.6, 3.4, 5.25, 6.6, 49.5);
    this._pushCyl('hull', 0.9, 1.1, 2.8, 12, 9, 5.8, 53);
    this._pushCyl('white', 1.0, 1.0, 0.5, 12, 9, 7.5, 53);
  }

  // ------------------------------------------------------------- containers

  _buildContainers() {
    const geo = new THREE.BoxGeometry(6, 2.6, 2.5);
    const colorMats = [this._mats.contRed, this._mats.contBlue, this._mats.contGreen];
    const lists = [[], [], []];

    const put = (x, z, level, rotY) => {
      const y = level * 2.6;
      lists[Math.floor(this._rng() * 3)].push(
        this._matrixAt(x, y + 1.3, z, 0, rotY, 0, 1, 1, 1));
      this._boxCollider(6, 2.6, 2.5, x, y, z, rotY);
    };

    // Yard rows (long axis x) with alleys between; keep clear of the yard
    // crane legs at (-32/-12, 9.5/15.5).
    const rows = [2, 9, 16, 23];
    for (const rz of rows) {
      for (let k = 0; k < 10; k++) {
        const sx = -38 + k * 7.6;
        if ((rz === 9 || rz === 16) &&
            (Math.abs(sx + 32) < 5.2 || Math.abs(sx + 12) < 5.2)) continue;
        if (this._rng() > 0.68) continue;
        put(sx, rz, 0, 0);
        if (this._rng() < 0.38) put(sx, rz, 1, 0);
      }
    }
    // Scattered singles in the northern lot + east side.
    const singles = [
      [18, -44, Math.PI / 2], [34, -38, 0], [48, -8, Math.PI / 2],
      [52, 8, 0], [-8, -38, 0], [-24, -46, Math.PI / 2]
    ];
    for (const [x, z, r] of singles) put(x, z, 0, r);

    for (let i = 0; i < 3; i++) this._makeInstanced(geo, colorMats[i], lists[i]);
  }

  // ----------------------------------------------------------------- cranes

  _buildCrane(cx, cz, hookPhase) {
    // Portal legs + cross braces.
    for (const lx of [cx - 10, cx + 10]) {
      for (const lz of [cz - 3, cz + 3]) {
        this._solid('crane', 0.9, 7.9, 0.9, lx, 0, lz);
      }
      this._pushBox('crane', 0.4, 0.4, 6.2, lx, 4.4, cz);
    }
    // Walkable boom platform (top 8.4) with side + end rails.
    this._solid('crane', 24, 0.5, 2.6, cx, BOOM_Y - 0.5, cz);
    this._solid('crane', 24, 0.9, 0.18, cx, BOOM_Y, cz - 1.21);
    this._solid('crane', 24, 0.9, 0.18, cx, BOOM_Y, cz + 1.21);
    this._solid('crane', 0.18, 0.9, 2.6, cx + 11.9, BOOM_Y, cz);
    // Machinery cab hanging under the boom (decor).
    this._pushBox('crane', 2.2, 1.7, 2.4, cx + 7, 6.0, cz);
    // Grand stair: 21 solid steps rising east to the boom's west end.
    this._stairs('crane', 21, 1.6, cx - 26.7, cz, 'x', 1);
    // Swinging hook: cable + block, pivot anchored under the boom.
    const grp = new THREE.Group();
    grp.position.set(cx + 4, BOOM_Y - 0.5, cz);
    const cable = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 2.8, 6), this._mats.dark);
    cable.position.y = -1.4;
    const block = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.55), this._mats.dark);
    block.position.y = -3.0;
    block.castShadow = true;
    grp.add(cable, block);
    this.group.add(grp);
    this._hooks.push({ grp, phase: hookPhase });
  }

  // -------------------------------------------------------------- warehouse

  _buildWarehouse() {
    // Shed x -58..-34, z -34..-14; two roller-gate gaps south, door east.
    const H = 5.2;
    this._solid('metal', 24, H, 0.5, -46, 0, -33.75);          // north
    this._solid('metal', 6, H, 0.5, -55, 0, -14.25);           // south segs
    this._solid('metal', 6, H, 0.5, -45, 0, -14.25);
    this._solid('metal', 4, H, 0.5, -36, 0, -14.25);
    this._solid('metal', 4, 1.8, 0.5, -50, 3.4, -14.25);       // gate lintels
    this._solid('metal', 4, 1.8, 0.5, -40, 3.4, -14.25);
    this._solid('metal', 0.5, H, 20, -57.75, 0, -24);          // west
    this._solid('metal', 0.5, H, 8, -34.25, 0, -30);           // east segs
    this._solid('metal', 0.5, H, 8.4, -34.25, 0, -18.3);
    this._solid('metal', 0.5, 1.8, 3.4, -34.25, 3.4, -24.3);   // door lintel
    this._solid('metal', 24, 0.6, 20, -46, H, -24);            // flat roof

    // Interior shelving rows (climbable base, thin top slab, stock crates).
    for (const rz of [-27.8, -20.4]) {
      this._solid('metal', 15, 1.0, 1.2, -46, 0, rz);
      this._solid('metal', 15, 0.12, 1.2, -46, 2.0, rz);
      for (let px = -53; px <= -39; px += 3.5) {
        this._pushBox('metal', 0.16, 2.1, 0.16, px, 0, rz - 0.5);
        this._pushBox('metal', 0.16, 2.1, 0.16, px, 0, rz + 0.5);
      }
      for (let i = 0; i < 5; i++) {
        const s = 0.55 + this._rng() * 0.3;
        this._pushBox('wood', s, s, s, -52.5 + this._rng() * 13, 1.0, rz,
          this._rng() * Math.PI);
      }
    }

    // Catwalk along the north wall (top 2.8) + access stair + rail.
    this._pushBox('metal', 20, 0.3, 1.8, -46, 2.5, -32.45);
    this._boxCollider(20, 0.3, 1.8, -46, 2.5, -32.45);
    this._pushCyl('metal', 0.12, 0.12, 2.5, 6, -52, 0, -32.45);
    this._pushCyl('metal', 0.12, 0.12, 2.5, 6, -44, 0, -32.45);
    this._stairs('metal', 7, 1.4, -37, -26.6, 'z', -1);
    this._solid('metal', 18.1, 0.9, 0.15, -46.95, DECK_Y, -31.7);
    this._solid('metal', 0.15, 0.9, 1.8, -56.05, DECK_Y, -32.45);
  }

  // ------------------------------------------------------------- lighthouse

  _buildLighthouse() {
    // Rocky point: wadeable ledge (top 0) then slab (top 0.4).
    this._solid('rock', 14, 0.4, 14, 58, -0.4, 58);
    this._solid('rock', 12, 0.8, 12, 58, -0.4, 58);
    // Tower: tapered white cylinder, square AABB.
    this._pushCyl('white', 1.7, 2.2, 8.0, 14, 58, 0.4, 58);
    this._boxCollider(3.4, 8.0, 3.4, 58, 0.4, 58);
    // Wrapping ledge stair: south flight, corner landing, east flight.
    for (let i = 0; i < 6; i++) {
      this._solid('rock', 0.7, (i + 1) * STEP_RISE, 1.4,
        55.6 + (i + 0.5) * STEP_RUN, 0.4, 60.35);
    }
    this._solid('rock', 1.4, 2.4, 1.4, 60.35, 0.4, 60.35);
    for (let i = 0; i < 5; i++) {
      this._solid('rock', 1.4, 2.4 + (i + 1) * STEP_RISE, 0.7,
        60.35, 0.4, 59.65 - (i + 0.5) * STEP_RUN);
    }
    // Balcony platform (top 4.8) on the north side + rails (south open).
    this._solid('white', 6.4, 0.4, 2.6, 58, 4.4, 55.3);
    this._solid('white', 6.4, 0.8, 0.14, 58, 4.8, 54.05);
    this._solid('white', 0.14, 0.8, 2.6, 54.87, 4.8, 55.3);
    this._solid('white', 0.14, 0.8, 2.6, 61.13, 4.8, 55.3);
    // Lantern room + red cap.
    this._pushCyl('white', 1.3, 1.3, 1.0, 12, 58, 8.4, 58);
    const cap = new THREE.ConeGeometry(1.5, 0.9, 12);
    cap.translate(58, 9.85, 58);
    this._buckets.hull.push(cap);
    // Rotating beam (emissive, additive).
    this._beamGroup = new THREE.Group();
    this._beamGroup.position.set(58, 8.9, 58);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xfff1c4, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(9, 0.18, 0.18), beamMat);
    this._beamGroup.add(beam);
    this.group.add(this._beamGroup);
    // Rocks around the point and the south sea-wall (decor).
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rockMats = [];
    for (let i = 0; i < 12; i++) {
      const a = this._rng() * Math.PI * 2;
      const r = 7.4 + this._rng() * 2.2;
      const s = 0.7 + this._rng() * 1.3;
      rockMats.push(this._matrixAt(58 + Math.cos(a) * r, -0.35, 58 + Math.sin(a) * r,
        this._rng() * Math.PI, this._rng() * Math.PI, this._rng() * Math.PI,
        s, s * 0.8, s));
    }
    for (let i = 0; i < 10; i++) {
      const s = 0.8 + this._rng() * 1.4;
      rockMats.push(this._matrixAt(-66 + this._rng() * 108, -0.4, 66.5 + this._rng() * 2.4,
        this._rng() * Math.PI, this._rng() * Math.PI, this._rng() * Math.PI,
        s, s * 0.8, s));
    }
    this._makeInstanced(rockGeo, this._mats.rock, rockMats);
  }

  // --------------------------------------------------------- security gate

  _buildGate() {
    // Guard booth with roof + window, barrier posts and arm, sign.
    this._solid('metal', 2.6, 2.8, 2.6, -5, 0, -60);
    this._pushBox('metal', 3.2, 0.2, 3.2, -5, 2.8, -60);
    this._pushBox('dark', 1.6, 0.7, 0.12, -5, 1.5, -58.72);
    this._solid('crane', 0.3, 1.1, 0.3, -1.5, 0, -60);
    this._solid('crane', 0.3, 1.1, 0.3, 6.5, 0, -60);
    this._pushBox('white', 7.6, 0.16, 0.16, 2.5, 1.0, -60);
    this._pushBox('white', 3.0, 0.8, 0.12, -5, 3.1, -60.2);
  }

  // ---------------------------------------------------------------- clutter

  _buildClutter() {
    // Barrels (instanced, colliders — hiding cover).
    const barrelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.95, 10);
    const barrels = [
      [41.5, 33.2], [40.8, 35.1], [42.4, 34.5], [-49.5, -12.4], [-48.2, -11.6],
      [63.4, -18.6], [62.6, -17.2], [64.2, -21.2], [-2.2, -61.8], [-0.9, -62.6],
      [24.5, 27.2], [-35.4, 30.6], [-36.6, 31.5], [10.8, 41.2]
    ];
    const bMats = [];
    for (const [x, z] of barrels) {
      bMats.push(this._matrixAt(x, 0.475, z, 0, this._rng() * Math.PI, 0, 1, 1, 1));
      this._boxCollider(0.9, 0.95, 0.9, x, 0, z);
    }
    this._makeInstanced(barrelGeo, this._mats.hull, bMats);

    // Crates (instanced, colliders) — includes the hold-escape 0.8 crate.
    const crateGeo = new THREE.BoxGeometry(1, 1, 1);
    const crates = [
      [this._holdCrate.x, HOLD_Y, this._holdCrate.z, 0.8, 1.4],
      [-10.4, HOLD_Y, 48.8, 1.1, 1.1], [-9.2, HOLD_Y, 53.6, 0.9, 0.9],
      [-63.8, 0, 29.2, 1.0, 1.0], [-60.6, 0, 31.8, 0.85, 0.85],
      [-62.6, 0, 27.4, 0.7, 0.7], [36.2, 0, 30.4, 0.95, 0.95],
      [-40.2, 0, -30.2, 0.9, 0.9], [-41.4, 0, -28.8, 0.75, 0.75],
      [12.4, 0, -58.8, 0.9, 0.9], [44.6, 0, 18.4, 0.85, 0.85],
      [17.2, 0, 30.8, 0.8, 0.8], [-52.4, 0, 34.2, 1.0, 1.0]
    ];
    const cMats = [];
    for (const [x, y, z, h, w] of crates) {
      cMats.push(this._matrixAt(x, y + h / 2, z, 0, this._rng() * 0.4, 0, w, h, w));
      this._boxCollider(w, h, w, x, y, z);
    }
    this._makeInstanced(crateGeo, this._mats.wood, cMats);

    // Draped cargo nets (thin rotated slabs, decor — no colliders).
    const netGeo = new THREE.BoxGeometry(3, 0.12, 2.2);
    const nets = [[-34, 0.05, 36.5, 0.4], [4, 2.85, 45.2, 1.1], [46, 0.05, 36.8, 2.3]];
    for (const [x, y, z, yaw] of nets) {
      const m = new THREE.Mesh(netGeo, this._mats.net);
      m.position.set(x, y + 0.06, z);
      m.rotation.set(0.06, yaw, 0.04);
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  // ------------------------------------------------------------------ boats

  _buildBoats() {
    for (const [x, z, yaw, phase] of [
      [32, 62, 0.7, 0], [-38, 60, 2.4, 2.1], [-58, 48, 4.2, 4.4]
    ]) {
      const grp = new THREE.Group();
      const hullMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 3.2), this._mats.wood);
      hullMesh.position.y = 0.1;
      hullMesh.castShadow = true;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.4), this._mats.wood);
      bench.position.set(0, 0.32, 0.2);
      grp.add(hullMesh, bench);
      grp.position.set(x, -0.18, z);
      grp.rotation.y = yaw;
      this.group.add(grp);
      this._boats.push({ grp, phase });
    }
  }

  // ------------------------------------------------------------------ gulls

  _buildGulls() {
    const N = 34;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (this._rng() - 0.5) * 110;
      pos[i * 3 + 1] = 12 + this._rng() * 10;
      pos[i * 3 + 2] = 28 + this._rng() * 38;
    }
    this._gullBase = pos.slice();
    this._gullGeo = new THREE.BufferGeometry();
    this._gullGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfff4e0, size: 0.45, transparent: true, opacity: 0.95,
      depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(this._gullGeo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: the harbor security gate at the north edge.
    this.policeSpawns = [
      v(1.5, 0, -58), v(-1.5, 0, -56), v(4.5, 0, -56.5),
      v(-4, 0, -54.5), v(1, 0, -53.5), v(6.5, 0, -58.5)
    ];
    // Monkeys: ship, alleys, cranes, warehouse, lighthouse, waterline...
    this.monkeySpawns = [
      v(-6.5, HOLD_Y, 52.5),     // freighter cargo-hold pit
      v(2, DECK_Y, 53),          // aft deck beside the deckhouse
      v(-16, DECK_Y, 54),        // fore deck, port side
      v(-15, 0, 5.5),            // container alley 1
      v(10, 0, 12.5),            // container alley 2
      v(-30, 0, 19.5),           // container alley 3
      v(20, BOOM_Y, 35.5),       // quay-crane boom platform
      v(-22, BOOM_Y, 12.5),      // yard-crane boom platform
      v(-46, DECK_Y, -32.45),    // warehouse catwalk
      v(-52, 0, -25),            // warehouse floor between shelves
      v(58, 4.8, 55),            // lighthouse balcony
      v(53.5, 0.4, 62),          // lighthouse rock slab
      v(30, -0.4, 55),           // wading in the bay
      v(40, 0, 34),              // behind the quay barrels
      v(-62, 0, 30),             // SW corner crate stash
      v(62, 0, -20),             // east-wall barrel cluster
      v(15, 0, -44)              // behind a north-lot container
    ];
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
          console.warn('[BananaBayMap] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    // 1) Bay swell — scroll the water CanvasTexture.
    if (this._waterMat && this._waterMat.map) {
      this._waterMat.map.offset.x = (time * 0.04) % 1;
      this._waterMat.map.offset.y = Math.sin(time * 0.4) * 0.02;
    }
    // 2) Bobbing rowboats.
    for (const b of this._boats) {
      b.grp.position.y = -0.18 + Math.sin(time * 0.8 + b.phase) * 0.07;
      b.grp.rotation.x = Math.sin(time * 0.6 + b.phase) * 0.05;
      b.grp.rotation.z = Math.cos(time * 0.7 + b.phase * 1.3) * 0.06;
    }
    // 3) Sweeping lighthouse beam.
    if (this._beamGroup) this._beamGroup.rotation.y = time * 0.85;
    // 4) Swinging crane hooks.
    for (const h of this._hooks) {
      h.grp.rotation.z = Math.sin(time * 0.7 + h.phase) * 0.18;
      h.grp.rotation.x = Math.cos(time * 0.55 + h.phase) * 0.12;
    }
    // 5) Drifting gulls.
    if (this._gullGeo) {
      const attr = this._gullGeo.attributes.position;
      const arr = attr.array;
      const base = this._gullBase;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = base[i] + Math.sin(time * 0.15 + i) * 6;
        arr[i + 1] = base[i + 1] + Math.sin(time * 0.9 + i * 1.3) * 0.5;
        arr[i + 2] = base[i + 2] + Math.cos(time * 0.12 + i * 0.7) * 5;
      }
      attr.needsUpdate = true;
    }
  }
}
