import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * FROSTPEAK SKI RESORT — "An alpine village buried in fresh powder."
 *
 * Layout (144 x 144, sealed by snowbank walls at +/-71, ground top y = 0):
 * - North: three snow terraces (tops 1.6 / 3.2 / 4.8) climbing toward the
 *   summit, joined by 0.4-step stairs at x -40 / 0 / 40 and a wide stepped
 *   ski-jump piste at x 25. A warming hut sits on the summit terrace.
 * - East: chair-lift line at x 45 — base station with a rotating bullwheel,
 *   instanced pylons, six swaying gondola cabins on the cable, and a
 *   walkable mid-station platform (45, 4.4, 0) reached by a switchback
 *   stair. Beside it, a frozen pond (bed -0.2 under a translucent ice
 *   sheet) guarded by a snowman.
 * - Centre: the two-story LODGE (x -8..14, z 18..38) with an interior stair
 *   to an upper gallery, an exterior balcony at y 3.2, and a chimney with
 *   an emissive hearth and drifting smoke.
 * - West: a village of three enterable cabins, a sauna and firewood piles.
 *   A parked snowcat (walkable roof via 0.4 rear steps) sits south-west.
 * - South: the police welcome plaza (z 58..64) behind a ticket arch.
 * - Instanced pine forest (trunk colliders only) and snow drifts fill the
 *   gaps; snow falls, gondolas sway and the hearth flickers in update().
 */

const STEP_RISE = 0.4;           // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;            // stair tread depth
const LIFT_X = 45;               // chair-lift line
const CABLE_Y = 8.5;             // cable height
// Terrace front edges and the base height of the flight climbing onto them.
const TERRACE_FLIGHTS = [[-40, 0], [-50, 1.6], [-60, 3.2]];
// Rectangles [x0, z0, x1, z1] where the pine scatter must not plant trees.
const KEEP_RECTS = [
  [-13, 15, 17, 41],    // lodge + balcony
  [-15, 53, 15, 67],    // welcome plaza + arch
  [36, -68, 52, 51],    // chair-lift corridor + stations
  [30, 8, 53, 28],      // frozen pond + snowman bank
  [-59, -14, -31, 36],  // cabin village + sauna
  [-36, 42, -23, 54],   // snowcat park
  [-44, -64, -36, -35], // west terrace stairs
  [-4, -64, 4, -35],    // centre terrace stairs
  [19, -66, 31, -27],   // ski-jump piste + outrun
  [-6, -69, 6, -60],    // summit hut
  [-2, 38, 8, 58]       // plaza -> lodge footpath
];

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

export default class SkiResortMap extends MapBase {
  constructor() {
    super();
    this.id = 'SKI_RESORT';
    this.name = 'Frostpeak Ski Resort';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-72, -5, -72),
      new THREE.Vector3(72, 55, 72)
    );
    this.killY = -15;
    this.environment = {
      skyColor: 0xbfd9ee,
      fog: { color: 0xcfe2f2, near: 45, far: 180 }
    };

    this._rng = mulberry32(0x1ce001);
    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = { ground: [], snow: [], log: [], wood: [], stone: [], steel: [], roof: [] };
    this._gondolas = [];
    this._wheels = [];
    this._smoke = [];
    this._hearthMat = null;
    this._snowGeo = null;
    this._snowBase = null;
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns(); // early: the pine scatter avoids spawn points
    this._buildLights();
    this._buildGround();
    this._buildPerimeter();
    this._buildTerraces();
    this._buildPiste();
    this._buildLodge();
    this._buildPond();
    this._buildVillage();
    this._buildSnowcat();
    this._buildChairLift();
    this._buildPlaza();
    this._buildForest();
    this._buildDrifts();
    this._buildSnowfall();
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

  _paintSnow(ctx, size, seed, tracks) {
    const rng = mulberry32(seed);
    ctx.fillStyle = '#eef2f7';
    ctx.fillRect(0, 0, size, size);
    // soft blue shadow dapple
    for (let i = 0; i < 240; i++) {
      const b = 195 + Math.floor(rng() * 40);
      ctx.fillStyle = `rgba(${b - 25},${b - 10},${b + 20},${0.12 + rng() * 0.16})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        2 + rng() * 12, 1.5 + rng() * 7, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    for (let i = 0; i < 90; i++) {
      ctx.fillRect(rng() * size, rng() * size, 1.4, 1.4);
    }
    if (tracks) {
      // faint ski tracks
      ctx.strokeStyle = 'rgba(165,182,205,0.4)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const x = rng() * size;
        for (const off of [0, 6]) {
          ctx.beginPath();
          ctx.moveTo(x + off, 0);
          for (let y = 0; y <= size; y += 16) {
            ctx.lineTo(x + off + Math.sin(y * 0.05 + i * 2) * 8, y);
          }
          ctx.stroke();
        }
      }
    }
  }

  _paintLogs(ctx, size) {
    const rng = mulberry32(0x10a601);
    ctx.fillStyle = '#6e4f30';
    ctx.fillRect(0, 0, size, size);
    const rows = 5;
    const rh = size / rows;
    for (let r = 0; r < rows; r++) {
      const shade = Math.floor((rng() - 0.5) * 34);
      ctx.fillStyle = `rgb(${118 + shade},${86 + shade},${52 + shade})`;
      ctx.fillRect(0, r * rh + 2, size, rh - 4);
      // rounded log highlight
      ctx.fillStyle = 'rgba(255,235,200,0.14)';
      ctx.fillRect(0, r * rh + 4, size, rh * 0.3);
      ctx.fillStyle = 'rgba(40,24,10,0.55)';
      ctx.fillRect(0, r * rh + rh - 4, size, 3);
      // knots
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = 'rgba(56,36,18,0.6)';
        ctx.beginPath();
        ctx.ellipse(rng() * size, r * rh + rh / 2, 2.5 + rng() * 3, 2 + rng() * 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  _paintPlanks(ctx, size) {
    const rng = mulberry32(0x9e1102);
    ctx.fillStyle = '#8a7458';
    ctx.fillRect(0, 0, size, size);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const shade = Math.floor((rng() - 0.5) * 30);
      ctx.fillStyle = `rgb(${140 + shade},${118 + shade},${88 + shade})`;
      ctx.fillRect(0, r * (size / rows) + 2, size, size / rows - 4);
      ctx.strokeStyle = 'rgba(64,48,28,0.55)';
      for (let i = 0; i < 7; i++) {
        const x = rng() * size;
        ctx.beginPath();
        ctx.moveTo(x, r * (size / rows));
        ctx.lineTo(x + (rng() - 0.5) * 16, (r + 1) * (size / rows));
        ctx.stroke();
      }
    }
  }

  _paintStone(ctx, size) {
    const rng = mulberry32(0x57a303);
    ctx.fillStyle = '#8c9095';
    ctx.fillRect(0, 0, size, size);
    const rows = 5;
    const bh = size / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bh;
      for (let c = -1; c < rows + 1; c++) {
        const shade = Math.floor((rng() - 0.5) * 30);
        ctx.fillStyle = `rgba(${138 + shade},${142 + shade},${148 + shade},0.6)`;
        ctx.fillRect(c * bh + off + 2, r * bh + 2, bh - 4, bh - 4);
      }
    }
    ctx.strokeStyle = 'rgba(45,48,54,0.55)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * bh);
      ctx.lineTo(size, r * bh + (rng() - 0.5) * 3);
      ctx.stroke();
    }
    // snow dust on ledges
    ctx.fillStyle = 'rgba(238,244,250,0.5)';
    for (let i = 0; i < 22; i++) {
      ctx.fillRect(rng() * size, rng() * size, 4 + rng() * 14, 2 + rng() * 3);
    }
  }

  _paintRoof(ctx, size) {
    const rng = mulberry32(0xd00f04);
    ctx.fillStyle = '#7d2f2a';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(40,14,12,0.6)';
    ctx.lineWidth = 3;
    for (let x = 0; x < size; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    // clinging snow patches
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(238,243,249,${0.35 + rng() * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 5 + rng() * 16, 3 + rng() * 6,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintIce(ctx, size) {
    const rng = mulberry32(0x1cede5);
    ctx.fillStyle = '#bfe0f0';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      const b = 200 + Math.floor(rng() * 55);
      ctx.fillStyle = `rgba(${b - 40},${b - 10},${b},0.25)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 8 + rng() * 30, 5 + rng() * 18,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // cracks
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 10; i++) {
      let x = rng() * size;
      let y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (rng() - 0.5) * 60;
        y += (rng() - 0.5) * 60;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  _paintBanner(ctx, size) {
    ctx.fillStyle = '#1d3f66';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#e8eef6';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, size - 16, size - 16);
    ctx.fillStyle = '#f2f6fb';
    ctx.font = `bold ${Math.floor(size * 0.17)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FROSTPEAK', size / 2, size * 0.42);
    ctx.font = `${Math.floor(size * 0.1)}px sans-serif`;
    ctx.fillText('SKI RESORT', size / 2, size * 0.62);
  }

  _makeMaterials() {
    const snowTex = this._canvasTex(256, (c, s) => this._paintSnow(c, s, 0x5a0e01, false));
    const groundTex = this._canvasTex(256, (c, s) => this._paintSnow(c, s, 0x5a0e02, true));
    const logTex = this._canvasTex(128, (c, s) => this._paintLogs(c, s));
    const plankTex = this._canvasTex(128, (c, s) => this._paintPlanks(c, s));
    const stoneTex = this._canvasTex(128, (c, s) => this._paintStone(c, s));
    const roofTex = this._canvasTex(128, (c, s) => this._paintRoof(c, s));
    const iceTex = this._canvasTex(256, (c, s) => this._paintIce(c, s));
    const bannerTex = this._canvasTex(256, (c, s) => this._paintBanner(c, s));

    this._mats = {
      snow: new THREE.MeshStandardMaterial({ map: snowTex, roughness: 0.95 }),
      ground: new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1.0 }),
      log: new THREE.MeshStandardMaterial({ map: logTex, roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.85 }),
      stone: new THREE.MeshStandardMaterial({ map: stoneTex, roughness: 0.95 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.55, roughness: 0.45 }),
      steelDark: new THREE.MeshStandardMaterial({ color: 0x39404a, metalness: 0.6, roughness: 0.4 }),
      roof: new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.7 }),
      bark: new THREE.MeshStandardMaterial({ map: logTex, color: 0x9a7a55, roughness: 1.0 }),
      pine: new THREE.MeshStandardMaterial({ color: 0x2e5233, roughness: 0.95 }),
      snowCap: new THREE.MeshStandardMaterial({ color: 0xf4f8fc, roughness: 0.9 }),
      cabin: new THREE.MeshStandardMaterial({ color: 0xc23b2e, roughness: 0.55, metalness: 0.15 }),
      fabric: new THREE.MeshStandardMaterial({ color: 0x27466e, roughness: 1.0, side: THREE.DoubleSide }),
      banner: new THREE.MeshStandardMaterial({ map: bannerTex, roughness: 0.85 }),
      ice: new THREE.MeshStandardMaterial({
        map: iceTex, transparent: true, opacity: 0.62, roughness: 0.12,
        metalness: 0.05, depthWrite: false, color: 0xcfeaff
      }),
      hearth: new THREE.MeshStandardMaterial({
        color: 0xff8226, emissive: 0xff9433, emissiveIntensity: 1.4,
        roughness: 0.6
      }),
      smoke: new THREE.MeshStandardMaterial({
        color: 0xdfe4ea, transparent: true, opacity: 0.38,
        depthWrite: false, roughness: 1.0
      }),
      carrot: new THREE.MeshStandardMaterial({ color: 0xd97a20, roughness: 0.8 })
    };
    this._hearthMat = this._mats.hearth;
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

  /** Four 0.4/0.7 steps climbing north onto a terrace whose front is edgeZ. */
  _flight(cx, w, baseY, edgeZ, bucket = 'snow') {
    for (let i = 0; i < 4; i++) {
      const h = (i + 1) * STEP_RISE;
      const cz = edgeZ + 0.35 + (3 - i) * STEP_RUN;
      this._solid(bucket, w, h, STEP_RUN, cx, baseY, cz);
    }
  }

  /**
   * Axis-aligned hut: four log walls (with a full-height door gap >= 1.6
   * wide on doorSide 'N'|'S'|'E'|'W') plus a snow roof slab (decor).
   */
  _hut(cx, cz, w, d, h, doorSide, baseY = 0, roofBucket = 'snow') {
    const t = 0.4;
    const dw = 1.6;
    const wall = (ww, dd, x, z) => this._solid('log', ww, h, dd, x, baseY, z);
    const zN = cz - d / 2 + t / 2;
    const zS = cz + d / 2 - t / 2;
    const xW = cx - w / 2 + t / 2;
    const xE = cx + w / 2 - t / 2;
    const segW = (w - dw) / 2;
    const segD = (d - dw) / 2;
    if (doorSide === 'N') {
      wall(segW, t, cx - dw / 2 - segW / 2, zN);
      wall(segW, t, cx + dw / 2 + segW / 2, zN);
    } else wall(w, t, cx, zN);
    if (doorSide === 'S') {
      wall(segW, t, cx - dw / 2 - segW / 2, zS);
      wall(segW, t, cx + dw / 2 + segW / 2, zS);
    } else wall(w, t, cx, zS);
    if (doorSide === 'W') {
      wall(t, segD, xW, cz - dw / 2 - segD / 2);
      wall(t, segD, xW, cz + dw / 2 + segD / 2);
    } else wall(t, d, xW, cz);
    if (doorSide === 'E') {
      wall(t, segD, xE, cz - dw / 2 - segD / 2);
      wall(t, segD, xE, cz + dw / 2 + segD / 2);
    } else wall(t, d, xE, cz);
    this._pushBox(roofBucket, w + 0.7, 0.28, d + 0.7, cx, baseY + h, cz);
  }

  _flushBuckets() {
    const matFor = {
      ground: this._mats.ground, snow: this._mats.snow, log: this._mats.log,
      wood: this._mats.wood, stone: this._mats.stone, steel: this._mats.steel,
      roof: this._mats.roof
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

  /** Terrain height (terrace tops) at a given z. */
  _groundYAt(z) {
    return z < -60 ? 4.8 : z < -50 ? 3.2 : z < -40 ? 1.6 : 0;
  }

  // --------------------------------------------------------------- lighting

  _buildLights() {
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    sun.position.set(58, 90, 42);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 230;
    sun.shadow.bias = -0.0006;
    this.group.add(sun);
    this.group.add(sun.target);
    sun.target.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xbfd9ee, 0xdfe8f2, 0.85);
    this.group.add(hemi);
    const amb = new THREE.AmbientLight(0x9fb3c8, 0.5);
    this.group.add(amb);
  }

  // --------------------------------------------------------------- terrain

  _buildGround() {
    // Snow field (top y = 0) split around the frozen-pond depression
    // (x 33..47, z 11..25), whose bed slab tops out at -0.2.
    const g = (w, d, x, z, top) => {
      const geo = new THREE.BoxGeometry(w, 1.2, d);
      scaleUV(geo, w / 7, d / 7);
      geo.translate(x, top - 0.6, z);
      this._buckets.ground.push(geo);
      this._boxCollider(w, 1.2, d, x, top - 1.2, z);
    };
    g(142, 82, 0, -30, 0);     // north field   (z -71..11)
    g(142, 46, 0, 48, 0);      // south field   (z 25..71)
    g(104, 14, -19, 18, 0);    // west of pond  (x -71..33)
    g(24, 14, 59, 18, 0);      // east of pond  (x 47..71)
    g(14, 14, 40, 18, -0.2);   // pond bed
  }

  _buildPerimeter() {
    // Towering snowbank walls sealing the map. Bottoms sunk to -1.4 so the
    // pond bed (top -0.2) cannot leak, tops well above the summit terrace.
    const H = 10;
    this._solid('snow', 145, H, 2.5, 0, -1.4, -70.75);
    this._solid('snow', 145, H, 2.5, 0, -1.4, 70.75);
    this._solid('snow', 2.5, H, 145, -70.75, -1.4, 0);
    this._solid('snow', 2.5, H, 145, 70.75, -1.4, 0);
    // Rounded crown lumps along the tops (decor, out of reach).
    for (let i = 0; i < 30; i++) {
      const t = this._rng() * 4;
      const side = Math.floor(t);
      const s = (t - side) * 132 - 66;
      const w = 2 + this._rng() * 4;
      const h = 0.5 + this._rng() * 1.1;
      if (side === 0) this._pushBox('snow', w, h, 2.3, s, H - 1.4, -70.75);
      else if (side === 1) this._pushBox('snow', w, h, 2.3, s, H - 1.4, 70.75);
      else if (side === 2) this._pushBox('snow', 2.3, h, w, -70.75, H - 1.4, s);
      else this._pushBox('snow', 2.3, h, w, 70.75, H - 1.4, s);
    }
  }

  _buildTerraces() {
    // Three broad snow shelves stacked toward the north wall.
    this._solid('snow', 142, 1.6, 31, 0, 0, -55.5);  // top 1.6, z -71..-40
    this._solid('snow', 142, 3.2, 21, 0, 0, -60.5);  // top 3.2, z -71..-50
    this._solid('snow', 142, 4.8, 11, 0, 0, -65.5);  // top 4.8, z -71..-60
    // Stairs at three x positions join every level.
    for (const x of [-40, 0, 40]) {
      for (const [edgeZ, baseY] of TERRACE_FLIGHTS) {
        this._flight(x, 4, baseY, edgeZ);
      }
    }
    // Summit warming hut on the top terrace.
    this._hut(0, -65, 5, 4.4, 2.6, 'S', 4.8);
    this._pushCyl('steel', 0.07, 0.07, 1.2, 6, 1.6, 7.4, -66); // stove pipe
  }

  _buildPiste() {
    // Wide stepped ski-jump run at x 25 climbing all three terraces.
    for (const [edgeZ, baseY] of TERRACE_FLIGHTS) {
      this._flight(25, 9, baseY, edgeZ);
    }
    // Finish banner across the outrun.
    for (const px of [20.5, 29.5]) {
      this._pushCyl('steel', 0.07, 0.09, 3.2, 6, px, 0, -33);
    }
    const finish = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.7, 0.1), this._mats.banner);
    finish.position.set(25, 2.6, -33);
    finish.castShadow = true;
    this.group.add(finish);
    // Slalom gate poles down the fall line (decor).
    const gateGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.3, 5);
    gateGeo.translate(0, 0.65, 0);
    const gates = [];
    for (const gz of [-36, -45, -55, -63]) {
      for (const gx of [21, 29]) {
        gates.push(this._matrixAt(gx, this._groundYAt(gz), gz,
          (this._rng() - 0.5) * 0.15, 0, (this._rng() - 0.5) * 0.15, 1, 1, 1));
      }
    }
    this._makeInstanced(gateGeo, this._mats.cabin, gates, { cast: false });
    // Take-off kicker mound at the bottom of the outrun (decor).
    const kick = new THREE.BoxGeometry(6, 0.8, 3.2);
    kick.rotateX(0.24);
    kick.translate(25, 0.12, -29.5);
    this._buckets.snow.push(kick);
  }

  // ------------------------------------------------------------------ lodge

  _buildLodge() {
    const t = 0.5;
    // Plank floor (decor).
    this._pushBox('wood', 21.5, 0.08, 19.5, 3, 0, 28);
    // South wall (z 38, faces the plaza) with a door gap x 1.8..4.2.
    this._solid('log', 9.8, 6.4, t, -3.1, 0, 37.75);
    this._solid('log', 9.8, 6.4, t, 9.1, 0, 37.75);
    this._solid('log', 2.4, 3.9, t, 3, 2.5, 37.75);   // lintel (door 2.5 high)
    // North wall (z 18), matching door.
    this._solid('log', 9.8, 6.4, t, -3.1, 0, 18.25);
    this._solid('log', 9.8, 6.4, t, 9.1, 0, 18.25);
    this._solid('log', 2.4, 3.9, t, 3, 2.5, 18.25);
    // East wall, solid full height.
    this._solid('log', t, 6.4, 20, 13.75, 0, 28);
    // West wall: solid below, balcony door gap (z 26.6..29) above.
    this._solid('log', t, 3.2, 20, -7.75, 0, 28);
    this._solid('log', t, 3.2, 8.6, -7.75, 3.2, 22.3);
    this._solid('log', t, 3.2, 9, -7.75, 3.2, 33.5);
    this._solid('log', t, 0.7, 2.4, -7.75, 5.7, 27.8); // balcony-door lintel
    // Upper gallery floor (north half) + guard rail with stair opening.
    this._solid('wood', 21, 0.3, 12.5, 3, 2.9, 24.75);
    this._solid('wood', 18, 1.0, 0.15, 1.5, 3.2, 30.925);
    // Interior stair to the gallery along the east wall (0.4 / 0.7).
    for (let i = 0; i < 8; i++) {
      const h = (i + 1) * STEP_RISE;
      this._solid('wood', 3, h, STEP_RUN, 12, 0, 31.35 + (7 - i) * STEP_RUN);
    }
    // Chimney column against the east wall + emissive hearth.
    this._solid('stone', 0.9, 8.8, 1.9, 13.2, 0, 24);
    this._pushBox('wood', 1.6, 0.14, 0.4, 12.7, 1.5, 24); // mantel (decor)
    const fire = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 1.2), this._mats.hearth);
    fire.position.set(12.68, 0.58, 24);
    this.group.add(fire);
    // Chimney smoke puffs, recycled in update().
    const puffGeo = new THREE.SphereGeometry(0.34, 8, 6);
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(puffGeo, this._mats.smoke);
      m.castShadow = false;
      m.position.set(13.2, 9 + i * 0.9, 24);
      this.group.add(m);
      this._smoke.push(m);
    }
    // Great-hall furniture.
    this._solid('wood', 2.2, 0.75, 1.1, 0, 0, 34);
    this._solid('wood', 2.2, 0.42, 0.5, 0, 0, 32.9);
    this._solid('wood', 2.2, 0.42, 0.5, 0, 0, 35.1);
    // Exterior balcony (west face, y 3.2) with rails and posts.
    this._solid('wood', 2.4, 0.3, 12, -9.2, 2.9, 28);
    this._solid('wood', 0.12, 1.0, 12, -10.34, 3.2, 28);
    this._solid('wood', 2.28, 1.0, 0.12, -9.14, 3.2, 22.06);
    this._solid('wood', 2.28, 1.0, 0.12, -9.14, 3.2, 33.94);
    for (const pz of [23.2, 32.8]) {
      this._pushCyl('log', 0.14, 0.16, 2.9, 7, -10.1, 0, pz);
      this._boxCollider(0.4, 2.9, 0.4, -10.1, 0, pz);
    }
    // Gabled roof (rotated panels — decor only, out of reach).
    const angle = 0.254;
    const north = new THREE.BoxGeometry(23.5, 0.22, 10.9);
    scaleUV(north, 7, 3.5);
    north.rotateX(-angle);
    north.translate(3, 7.7, 22.85);
    this._buckets.roof.push(north);
    const south = new THREE.BoxGeometry(23.5, 0.22, 10.9);
    scaleUV(south, 7, 3.5);
    south.rotateX(angle);
    south.translate(3, 7.7, 33.15);
    this._buckets.roof.push(south);
    this._pushBox('roof', 23.8, 0.18, 0.5, 3, 8.95, 28); // ridge cap
    for (const gx of [-7.75, 13.75]) {                   // gable fillers
      this._pushBox('log', 0.45, 1.0, 14, gx, 6.4, 28);
      this._pushBox('log', 0.45, 1.0, 8, gx, 7.4, 28);
      this._pushBox('log', 0.45, 0.6, 3, gx, 8.4, 28);
    }
    // Lodge sign over the south door + porch slab (decor).
    const sign = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.12), this._mats.banner);
    sign.position.set(3, 3.2, 38.15);
    sign.castShadow = true;
    this.group.add(sign);
    this._pushBox('stone', 3, 0.06, 1.6, 3, 0, 39);
  }

  // ------------------------------------------------------------------- pond

  _buildPond() {
    // Translucent ice sheet floating just above the sunken bed (walk under).
    const ice = new THREE.Mesh(new THREE.PlaneGeometry(13.4, 13.4), this._mats.ice);
    ice.rotation.x = -Math.PI / 2;
    ice.position.set(40, -0.04, 18);
    ice.receiveShadow = true;
    this.group.add(ice);
    // Snowman on the east bank.
    this._pushCyl('snow', 0.62, 0.72, 1.05, 12, 48.6, -0.1, 22);
    const ball = (r, y) => {
      const g = new THREE.SphereGeometry(r, 12, 10);
      g.translate(48.6, y, 22);
      this._buckets.snow.push(g);
    };
    ball(0.62, 0.55);
    ball(0.45, 1.4);
    ball(0.32, 2.02);
    this._boxCollider(1.3, 2.3, 1.3, 48.6, 0, 22);
    const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 6), this._mats.carrot);
    carrot.rotation.x = -Math.PI / 2;
    carrot.position.set(48.6, 2.02, 21.6);
    this.group.add(carrot);
  }

  // ---------------------------------------------------------------- village

  _buildVillage() {
    this._hut(-52, -8, 6, 5, 2.6, 'E');    // cabin one
    this._hut(-38, 6, 6, 5, 2.6, 'S');     // cabin two
    this._hut(-54, 22, 6, 5, 2.6, 'E');    // cabin three
    this._hut(-40, 30, 4.2, 3.4, 2.5, 'S'); // sauna
    // Cabin furnishings (hiding cover).
    this._solid('wood', 2.2, 0.5, 1.1, -53.4, 0, -9.5);  // bunk, cabin one
    this._solid('wood', 1.4, 0.7, 1.0, -39.8, 0, 4.6);   // table, cabin two
    this._solid('wood', 0.9, 0.9, 0.9, -55.8, 0, 23.3);  // crate, cabin three
    this._solid('steel', 0.7, 0.8, 0.7, -41.2, 0, 29.2); // sauna stove
    this._solid('wood', 1.6, 0.5, 0.6, -39.2, 0, 31.0);  // sauna bench
    this._pushCyl('steel', 0.08, 0.08, 1.6, 6, -41.2, 2.5, 29.2); // sauna pipe
    // Plunge barrel outside the sauna.
    this._pushCyl('wood', 0.45, 0.45, 0.9, 10, -37.2, 0, 32.4);
    this._boxCollider(1.0, 0.9, 1.0, -37.2, 0, 32.4);
    // Firewood piles (instanced logs + one low collider per pile).
    const logGeo = new THREE.CylinderGeometry(0.13, 0.13, 1.15, 7);
    logGeo.rotateZ(Math.PI / 2);
    const logM = [];
    const pile = (x, z) => {
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3 - r; c++) {
          logM.push(this._matrixAt(x, 0.14 + r * 0.24, z - 0.26 + c * 0.26 + r * 0.13,
            0, 0, 0, 1, 1, 1));
        }
      }
      this._boxCollider(1.25, 0.55, 0.85, x, 0, z);
    };
    pile(-49, -4);
    pile(-35.5, 9.6);
    pile(-46, 27);
    this._makeInstanced(logGeo, this._mats.bark, logM);
  }

  // ---------------------------------------------------------------- snowcat

  _buildSnowcat() {
    const cx = -30, cz = 48;
    // Treads.
    this._solid('steel', 4.8, 0.85, 0.95, cx, 0, cz - 1.15);
    this._solid('steel', 4.8, 0.85, 0.95, cx, 0, cz + 1.15);
    // Body deck (walkable roof, top 1.8) + cab at the front (west).
    this._solid('roof', 3.6, 0.95, 2.6, cx, 0.85, cz);
    this._solid('roof', 1.5, 0.45, 2.4, cx - 0.9, 1.8, cz);
    this._pushBox('steel', 0.06, 0.35, 2.1, cx - 1.68, 1.85, cz); // windshield band
    // Rear boarding steps: 0.4 risers up to the deck.
    for (let i = 0; i < 4; i++) {
      const h = (i + 1) * STEP_RISE;
      this._solid('steel', STEP_RUN, h, 1.6, cx + 4.05 - i * STEP_RUN, 0, cz);
    }
    // Front blade (tilted, decor) + exhaust + beacon.
    const blade = new THREE.BoxGeometry(0.5, 1.1, 3.6);
    blade.rotateZ(0.28);
    blade.translate(cx - 2.9, 0.55, cz);
    this._buckets.steel.push(blade);
    this._pushCyl('steel', 0.07, 0.07, 0.8, 6, cx - 0.3, 1.8, cz - 0.7);
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), this._mats.hearth);
    beacon.position.set(cx - 0.9, 2.33, cz);
    this.group.add(beacon);
  }

  // ------------------------------------------------------------- chair lift

  _buildChairLift() {
    // Pylons along x 45 (colliders) with crossarms and twin cables (decor).
    const pylons = [[36, 0], [18, 0], [-16, 0], [-34, 0], [-52, 3.2]];
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.3, 1, 8);
    scaleUV(poleGeo, 2, 3);
    poleGeo.translate(0, 0.5, 0);
    const poleM = [];
    for (const [pz, baseY] of pylons) {
      const h = CABLE_Y - baseY - 0.2;
      poleM.push(this._matrixAt(LIFT_X, baseY, pz, 0, 0, 0, 1, h, 1));
      this._boxCollider(0.62, h, 0.62, LIFT_X, baseY, pz);
      this._pushBox('steel', 3.0, 0.2, 0.34, LIFT_X, CABLE_Y - 0.34, pz);
    }
    this._makeInstanced(poleGeo, this._mats.steel, poleM);
    this._pushBox('steel', 0.07, 0.07, 110, LIFT_X - 0.6, CABLE_Y - 0.04, -9);
    this._pushBox('steel', 0.07, 0.07, 110, LIFT_X + 0.6, CABLE_Y - 0.04, -9);

    // Base station: boarding deck, posts, canopy and rotating bullwheel.
    this._solid('wood', 8, 0.4, 8, LIFT_X, 0, 46);
    for (const [sx, sz] of [[-3.5, -3.5], [-3.5, 3.5], [3.5, -3.5], [3.5, 3.5]]) {
      this._pushCyl('steel', 0.24, 0.28, 4.4, 8, LIFT_X + sx, 0.4, 46 + sz);
      this._boxCollider(0.6, 4.4, 0.6, LIFT_X + sx, 0.4, 46 + sz);
    }
    this._pushBox('roof', 9, 0.26, 9, LIFT_X, 4.8, 46);
    this._pushBox('steel', 0.5, 3.3, 0.5, LIFT_X, 5.06, 46);
    const wheelGeo = new THREE.CylinderGeometry(1.8, 1.8, 0.26, 20);
    const wheel = new THREE.Mesh(wheelGeo, this._mats.steelDark);
    wheel.position.set(LIFT_X, CABLE_Y - 0.15, 46);
    wheel.castShadow = true;
    this.group.add(wheel);
    this._wheels.push({ mesh: wheel, speed: 1.3 });
    // Top return terminal on the summit terrace.
    this._pushBox('steel', 0.5, 3.4, 0.5, LIFT_X, 4.8, -64);
    this._boxCollider(0.8, 3.4, 0.8, LIFT_X, 4.8, -64);
    const topWheel = new THREE.Mesh(wheelGeo, this._mats.steelDark);
    topWheel.position.set(LIFT_X, CABLE_Y - 0.15, -64);
    topWheel.scale.set(0.89, 1, 0.89);
    topWheel.castShadow = true;
    this.group.add(topWheel);
    this._wheels.push({ mesh: topWheel, speed: -1.3 });

    // Mid-station: walkable platform (45, 4.4, 0) on legs, guard rails and
    // a switchback stair (six risers up, landing, five risers back).
    this._solid('wood', 7, 0.5, 7, 46.1, 3.9, 0);
    for (const [lx, lz] of [[43.6, -2.5], [43.6, 2.5], [48.6, -2.5], [48.6, 2.5]]) {
      this._pushCyl('steel', 0.26, 0.3, 3.9, 8, lx, 0, lz);
      this._boxCollider(0.66, 3.9, 0.66, lx, 0, lz);
    }
    this._solid('wood', 7, 1.0, 0.15, 46.1, 4.4, -3.42);
    this._solid('wood', 7, 1.0, 0.15, 46.1, 4.4, 3.42);
    this._solid('wood', 0.15, 1.0, 7, 49.52, 4.4, 0);
    this._solid('wood', 0.15, 1.0, 5.3, 42.68, 4.4, -0.85);
    for (let i = 0; i < 6; i++) {
      const h = (i + 1) * STEP_RISE;
      this._solid('wood', 2.5, h, STEP_RUN, 38.85, 0, 2.45 + (5 - i) * STEP_RUN);
    }
    this._solid('wood', 2.5, 2.4, 2.5, 38.85, 0, 0.85);
    for (let j = 0; j < 5; j++) {
      const h = 2.4 + (j + 1) * STEP_RISE;
      this._solid('wood', 2.5, h, STEP_RUN, 41.35, 0, -0.05 + j * STEP_RUN);
    }

    // Six gondola cabins hanging from the cable, swaying in update().
    const armGeo = new THREE.CylinderGeometry(0.05, 0.05, 1.0, 6);
    const cabGeo = new THREE.BoxGeometry(1.15, 1.25, 1.15);
    const capGeo = new THREE.BoxGeometry(1.3, 0.16, 1.3);
    const zs = [-55, -36, -14, 6, 22, 38];
    for (let i = 0; i < zs.length; i++) {
      const g = new THREE.Group();
      const arm = new THREE.Mesh(armGeo, this._mats.steelDark);
      arm.position.y = -0.5;
      const cab = new THREE.Mesh(cabGeo, this._mats.cabin);
      cab.position.y = -1.62;
      cab.castShadow = true;
      const cap = new THREE.Mesh(capGeo, this._mats.snowCap);
      cap.position.y = -0.95;
      g.add(arm, cab, cap);
      g.position.set(i % 2 ? LIFT_X - 0.6 : LIFT_X + 0.6, CABLE_Y, zs[i]);
      this.group.add(g);
      this._gondolas.push({ group: g, phase: this._rng() * Math.PI * 2 });
    }
  }

  // ------------------------------------------------------------------ plaza

  _buildPlaza() {
    // Paved welcome plaza (decor slab) + footpath to the lodge door.
    this._pushBox('stone', 24, 0.06, 9, 0, 0, 61.5);
    this._pushBox('stone', 3, 0.05, 18, 3, 0, 48);
    // Ticket arch across the resort entrance.
    this._solid('stone', 0.8, 3.6, 0.8, -2.6, 0, 57);
    this._solid('stone', 0.8, 3.6, 0.8, 2.6, 0, 57);
    const banner = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 0.3), this._mats.banner);
    banner.position.set(0, 4.0, 57);
    banner.castShadow = true;
    this.group.add(banner);
    this._boxCollider(6.4, 0.9, 0.3, 0, 3.55, 57);
    // Ticket booth, benches and flags.
    this._hut(11, 60, 2.6, 2.2, 2.4, 'W', 0, 'roof');
    this._solid('wood', 2.4, 0.42, 0.55, -7, 0, 64.5);
    this._solid('wood', 2.4, 0.42, 0.55, 7, 0, 64.5);
    for (const fx of [-12, 12]) {
      this._pushCyl('steel', 0.06, 0.08, 4.6, 6, fx, 0, 62);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.06), this._mats.fabric);
      flag.position.set(fx + 0.85, 3.9, 62);
      flag.castShadow = true;
      this.group.add(flag);
    }
  }

  // ----------------------------------------------------------------- forest

  _inKeepZone(x, z) {
    for (const s of this._allSpawns) {
      if ((s.x - x) * (s.x - x) + (s.z - z) * (s.z - z) < 2.4 * 2.4) return true;
    }
    for (const [x0, z0, x1, z1] of KEEP_RECTS) {
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return true;
    }
    return false;
  }

  _buildForest() {
    const trees = [];
    const clear = (x, z, dist) =>
      trees.every((t) => (t.x - x) * (t.x - x) + (t.z - z) * (t.z - z) > dist * dist);
    // Dense ring hugging the snowbank walls.
    const ringPts = 70;
    for (let i = 0; i < ringPts; i++) {
      const t = (i / ringPts) * 4;
      const side = Math.floor(t);
      const f = (t - side) * 2 - 1;
      const r = 62 + this._rng() * 6;
      let x, z;
      if (side === 0) { x = f * 64; z = -r; }
      else if (side === 1) { x = r; z = f * 64; }
      else if (side === 2) { x = -f * 64; z = r; }
      else { x = -r; z = -f * 64; }
      x += (this._rng() - 0.5) * 3;
      z += (this._rng() - 0.5) * 3;
      if (Math.abs(x) > 68 || Math.abs(z) > 68) continue;
      if (this._inKeepZone(x, z) || !clear(x, z, 3.4)) continue;
      trees.push({ x, z, s: 0.85 + this._rng() * 0.5 });
    }
    // Interior copses.
    let placed = 0, tries = 0;
    while (placed < 26 && tries++ < 260) {
      const x = (this._rng() - 0.5) * 132;
      const z = (this._rng() - 0.5) * 132;
      if (this._inKeepZone(x, z) || !clear(x, z, 4.2)) continue;
      trees.push({ x, z, s: 0.8 + this._rng() * 0.55 });
      placed++;
    }
    // Instanced pines: trunk (collider) + three foliage tiers + snow cap.
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.3, 1, 7);
    scaleUV(trunkGeo, 1.5, 2);
    trunkGeo.translate(0, 0.5, 0);
    const tierGeo = new THREE.ConeGeometry(1, 1, 8);
    tierGeo.translate(0, 0.5, 0);
    const capGeo = new THREE.ConeGeometry(1, 1, 8);
    capGeo.translate(0, 0.5, 0);
    const trunkM = [], tierM = [], capM = [];
    const fr = [0.2, 0.42, 0.62];
    const rr = [1.9, 1.45, 0.95];
    for (const t of trees) {
      const baseY = this._groundYAt(t.z);
      const H = (5.2 + this._rng() * 2.6) * t.s;
      trunkM.push(this._matrixAt(t.x, baseY, t.z, 0, this._rng() * Math.PI, 0, t.s, H * 0.5, t.s));
      this._boxCollider(0.62 * t.s, H * 0.6, 0.62 * t.s, t.x, baseY, t.z);
      const yaw = this._rng() * Math.PI;
      for (let k = 0; k < 3; k++) {
        tierM.push(this._matrixAt(t.x, baseY + H * fr[k], t.z, 0, yaw + k, 0,
          rr[k] * t.s, H * 0.38, rr[k] * t.s));
      }
      capM.push(this._matrixAt(t.x, baseY + H * 0.8, t.z, 0, yaw, 0,
        0.62 * t.s, H * 0.24, 0.62 * t.s));
    }
    this._makeInstanced(trunkGeo, this._mats.bark, trunkM);
    this._makeInstanced(tierGeo, this._mats.pine, tierM);
    this._makeInstanced(capGeo, this._mats.snowCap, capM, { cast: false });
  }

  _buildDrifts() {
    // Soft powder mounds (decor — no colliders, monkeys duck behind them).
    const driftGeo = new THREE.SphereGeometry(1, 9, 7);
    const mats = [];
    const put = (x, z) => {
      const sx = 1.6 + this._rng() * 1.6;
      const sy = 0.4 + this._rng() * 0.4;
      const sz = 1.3 + this._rng() * 1.3;
      mats.push(this._matrixAt(x, this._groundYAt(z) + sy * 0.3, z,
        0, this._rng() * Math.PI, 0, sx, sy, sz));
    };
    put(-16.5, -21); // covers the mid-field drift spawn
    let placed = 0, tries = 0;
    while (placed < 24 && tries++ < 200) {
      const x = (this._rng() - 0.5) * 130;
      const z = (this._rng() - 0.5) * 130;
      if (this._inKeepZone(x, z)) continue;
      put(x, z);
      placed++;
    }
    this._makeInstanced(driftGeo, this._mats.snow, mats, { cast: false });
  }

  // --------------------------------------------------------------- snowfall

  _buildSnowfall() {
    const N = 150;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (this._rng() - 0.5) * 140;
      pos[i * 3 + 1] = this._rng() * 28;
      pos[i * 3 + 2] = (this._rng() - 0.5) * 140;
    }
    this._snowBase = pos.slice();
    this._snowGeo = new THREE.BufferGeometry();
    this._snowGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffffff, size: 0.14, transparent: true, opacity: 0.85,
      depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(this._snowGeo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: welcome plaza behind the ticket arch, south edge.
    this.policeSpawns = [
      v(-4, 0, 61), v(4, 0, 61), v(0, 0, 63.5), v(-7.5, 0, 59.5), v(7, 0, 59.5)
    ];
    // Monkeys: lodge, lift, village, pond, forest...
    this.monkeySpawns = [
      v(-9.2, 3.2, 28),    // lodge exterior balcony, west face
      v(6, 3.2, 22),       // lodge upper gallery
      v(46, 4.4, 0.5),     // chair-lift mid-station platform
      v(0, 4.8, -65),      // summit warming hut, top terrace
      v(-20, 1.6, -44),    // first terrace ledge overlooking the field
      v(-52, 0, -8),       // inside cabin one, north village
      v(-38, 0, 6),        // inside cabin two, mid village
      v(-40, 0, 30),       // inside the sauna
      v(-29.4, 1.8, 48),   // snowcat roof deck
      v(40, -0.2, 18),     // frozen pond bed, under the ice sheet
      v(50.2, 0, 22),      // behind the snowman on the pond bank
      v(-60, 0, -25),      // west pine forest
      v(60, 0, -12),       // east pine forest
      v(-15, 0, -20),      // behind a snow drift mid-field
      v(0, 0, 56)          // under the ticket arch gate
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
          console.warn('[SkiResort] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    // 1) Falling snow — wrap each flake back to the top as it lands.
    if (this._snowGeo) {
      const attr = this._snowGeo.attributes.position;
      const arr = attr.array;
      const base = this._snowBase;
      for (let i = 0; i < arr.length; i += 3) {
        const fall = 2.2 + (i % 15) * 0.12;
        const y = base[i + 1] - time * fall;
        arr[i + 1] = ((y % 28) + 28) % 28;
        arr[i] = base[i] + Math.sin(time * 0.6 + i) * 0.7;
      }
      attr.needsUpdate = true;
    }
    // 2) Gondola sway.
    for (const g of this._gondolas) {
      g.group.rotation.z = Math.sin(time * 0.9 + g.phase) * 0.06;
      g.group.rotation.x = Math.cos(time * 0.7 + g.phase) * 0.04;
    }
    // 3) Bullwheel spin (base + top return).
    for (const w of this._wheels) {
      w.mesh.rotation.y = time * w.speed;
    }
    // 4) Chimney smoke — puffs rise, drift and recycle.
    for (let i = 0; i < this._smoke.length; i++) {
      const t = (time * 0.45 + i * 0.8) % 4;
      const m = this._smoke[i];
      m.position.set(
        13.2 + Math.sin(time * 0.7 + i) * 0.2 + t * 0.3,
        8.9 + t * 1.1,
        24 + Math.cos(time * 0.5 + i * 2) * 0.15
      );
      m.scale.setScalar(0.5 + t * 0.45);
    }
    // 5) Hearth flicker.
    if (this._hearthMat) {
      this._hearthMat.emissiveIntensity =
        1.25 + Math.sin(time * 13) * 0.25 + Math.sin(time * 29 + 1) * 0.15;
    }
  }
}
