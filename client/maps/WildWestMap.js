import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * WILD WEST — "Dusty Gulch", a frontier town in a sealed red-rock canyon.
 *
 * Layout (144 x 144, canyon walls at +/-71):
 * - MAIN STREET runs north-south through the centre (open lane x -6..6).
 *   West side: saloon (bar + stage + interior stair to a y3.2 balcony),
 *   general store, bank with a walk-in vault. East side: hotel (exterior
 *   stair to a y3.2 balcony walkway), sheriff's office with barred jail
 *   cells, undertaker. All false-front buildings with boardwalk porches.
 * - North: train depot — platform (y0.4), a static train (loco + tender +
 *   enterable boxcar + flatcar deck y1.2 via crate steps), a water tower
 *   with a walkable platform (~y5.2) via switchback stairs.
 * - A dry creek (bed top -0.4) crosses the map east-west with a plank
 *   bridge on the street; a windmill spins beside the corral.
 * - NW: mine butte with an enterable tunnel room + switchback to a y6 ledge.
 * - SE: mesa with a switchback climbing to its y7.2 top.
 * - South: church + fenced graveyard (instanced headstones), corral + barn
 *   with a hayloft (y3.0) reached by hay-bale steps, and the police muster
 *   plaza inside the south gate.
 * - Instanced saguaros (colliders) and scrub fill the open desert.
 *   Tumbleweeds roll, buzzards circle, the windmill spins, the town flag
 *   waves and the saloon sign flickers in update().
 */

const STEP_RISE = 0.4;  // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;   // stair tread depth
const TRACK_Z = -56.7;  // railway centreline

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

export default class WildWestMap extends MapBase {
  constructor() {
    super();
    this.id = 'WILD_WEST';
    this.name = 'Dusty Gulch';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-72, -5, -72),
      new THREE.Vector3(72, 50, 72)
    );
    this.killY = -15;
    this.environment = {
      skyColor: 0xf2d59a,
      fog: { color: 0xecd3a0, near: 45, far: 175 }
    };

    this._rng = mulberry32(0xdc0517);
    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = {
      ground: [], wood: [], woodDark: [], adobe: [], brick: [],
      rock: [], metal: [], hay: [], glow: []
    };
    this._signMat = null;
    this._blades = null;
    this._flag = null;
    this._tumbleweeds = [];
    this._buzzards = [];
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns(); // early: scrub scatter avoids spawn points
    this._buildLights();
    this._buildGroundAndCreek();
    this._buildPerimeter();
    this._buildSaloon();
    this._buildGeneralStore();
    this._buildBank();
    this._buildHotel();
    this._buildSheriff();
    this._buildUndertaker();
    this._buildPorches();
    this._buildDepotAndTrain();
    this._buildWaterTower();
    this._buildWindmill();
    this._buildMineButte();
    this._buildMesa();
    this._buildChurch();
    this._buildGraveyard();
    this._buildCorralAndBarn();
    this._buildPlazaAndGate();
    this._buildCacti();
    this._buildScrub();
    this._buildBarrels();
    this._buildTumbleweeds();
    this._buildBuzzards();
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

  _paintSand(ctx, size) {
    const rng = mulberry32(0xd057a1);
    ctx.fillStyle = '#d3a96e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 850; i++) {
      const t = rng();
      ctx.fillStyle = t < 0.5
        ? `rgba(${196 + rng() * 40},${150 + rng() * 34},${92 + rng() * 26},0.5)`
        : `rgba(${160 + rng() * 30},${118 + rng() * 26},${70 + rng() * 20},0.4)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        1 + rng() * 4, 1 + rng() * 2.5, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // wind ripples
    ctx.strokeStyle = 'rgba(120,86,50,0.22)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 16; i++) {
      const y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i * 2.1) * 5);
      }
      ctx.stroke();
    }
  }

  _paintPlanks(ctx, size) {
    const rng = mulberry32(0xbadd0c);
    ctx.fillStyle = '#8a6c47';
    ctx.fillRect(0, 0, size, size);
    const rows = 5;
    for (let r = 0; r < rows; r++) {
      const shade = Math.floor((rng() - 0.5) * 42);
      ctx.fillStyle = `rgb(${138 + shade},${106 + shade},${68 + shade})`;
      ctx.fillRect(0, r * (size / rows) + 2, size, size / rows - 4);
      ctx.strokeStyle = 'rgba(56,40,22,0.6)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 9; i++) {
        const x = rng() * size;
        ctx.beginPath();
        ctx.moveTo(x, r * (size / rows));
        ctx.lineTo(x + (rng() - 0.5) * 18, (r + 1) * (size / rows));
        ctx.stroke();
      }
      // nail heads
      ctx.fillStyle = 'rgba(40,30,18,0.7)';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(rng() * size, r * (size / rows) + 4 + rng() * 6, 2, 2);
      }
    }
  }

  _paintAdobe(ctx, size) {
    const rng = mulberry32(0xad0be1);
    ctx.fillStyle = '#d8c39a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 130; i++) {
      const g = Math.floor((rng() - 0.5) * 30);
      ctx.fillStyle = `rgba(${212 + g},${190 + g},${150 + g},0.5)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        4 + rng() * 16, 3 + rng() * 10, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(96,78,50,0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      let x = rng() * size;
      let y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (rng() - 0.5) * 26;
        y += rng() * 24;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  _paintBrick(ctx, size) {
    const rng = mulberry32(0xb51c4);
    ctx.fillStyle = '#7c4a34';
    ctx.fillRect(0, 0, size, size);
    const rows = 8;
    const bh = size / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (bh * 1.1);
      for (let c = -1; c < rows + 1; c++) {
        const shade = Math.floor((rng() - 0.5) * 40);
        ctx.fillStyle = `rgb(${150 + shade},${84 + shade},${58 + shade})`;
        ctx.fillRect(c * bh * 2.2 + off + 2, r * bh + 2, bh * 2.2 - 4, bh - 4);
      }
    }
  }

  _paintRock(ctx, size) {
    const rng = mulberry32(0x0c4a71);
    ctx.fillStyle = '#a05a36';
    ctx.fillRect(0, 0, size, size);
    // horizontal sediment strata
    let y = 0;
    while (y < size) {
      const h = 8 + rng() * 22;
      const shade = Math.floor((rng() - 0.5) * 46);
      ctx.fillStyle = `rgb(${168 + shade},${94 + shade},${56 + shade})`;
      ctx.fillRect(0, y, size, h);
      y += h;
    }
    for (let i = 0; i < 120; i++) {
      ctx.fillStyle = `rgba(${90 + rng() * 60},${48 + rng() * 34},${30 + rng() * 20},0.35)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        2 + rng() * 9, 1 + rng() * 4, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintMetal(ctx, size) {
    const rng = mulberry32(0x3e7a11);
    ctx.fillStyle = '#464a50';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      const shade = Math.floor((rng() - 0.5) * 26);
      ctx.fillStyle = `rgba(${70 + shade},${74 + shade},${80 + shade},0.6)`;
      ctx.fillRect(rng() * size, 0, 3 + rng() * 10, size);
    }
    ctx.fillStyle = 'rgba(20,22,26,0.8)';
    for (let i = 0; i < 40; i++) {
      ctx.beginPath();
      ctx.arc(rng() * size, rng() * size, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // rust streaks
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(${140 + rng() * 40},${70 + rng() * 20},30,0.25)`;
      ctx.fillRect(rng() * size, rng() * size, 2 + rng() * 4, 10 + rng() * 30);
    }
  }

  _paintHay(ctx, size) {
    const rng = mulberry32(0x4a715e);
    ctx.fillStyle = '#c49a3d';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 260; i++) {
      const shade = Math.floor((rng() - 0.5) * 60);
      ctx.strokeStyle = `rgba(${200 + shade},${160 + shade},${64 + shade},0.7)`;
      ctx.lineWidth = 1 + rng();
      const x = rng() * size;
      const y = rng() * size;
      const a = (rng() - 0.5) * 0.9;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * (8 + rng() * 16), y + Math.sin(a) * (8 + rng() * 16));
      ctx.stroke();
    }
  }

  _paintSign(ctx, size, text) {
    ctx.fillStyle = '#241408';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#f7c751';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, size - 16, size - 16);
    ctx.fillStyle = '#ffd964';
    ctx.font = `bold ${Math.floor(size / (text.length > 7 ? 6.4 : 4.2))}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, size / 2);
  }

  _makeMaterials() {
    const sandTex = this._canvasTex(256, (c, s) => this._paintSand(c, s));
    const plankTex = this._canvasTex(256, (c, s) => this._paintPlanks(c, s));
    const adobeTex = this._canvasTex(128, (c, s) => this._paintAdobe(c, s));
    const brickTex = this._canvasTex(128, (c, s) => this._paintBrick(c, s));
    const rockTex = this._canvasTex(256, (c, s) => this._paintRock(c, s));
    const metalTex = this._canvasTex(128, (c, s) => this._paintMetal(c, s));
    const hayTex = this._canvasTex(128, (c, s) => this._paintHay(c, s));
    const saloonTex = this._canvasTex(256, (c, s) => this._paintSign(c, s, 'SALOON'));
    const gateTex = this._canvasTex(256, (c, s) => this._paintSign(c, s, 'DUSTY GULCH'));

    this._mats = {
      ground: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1.0 }),
      wood: new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }),
      woodDark: new THREE.MeshStandardMaterial({ map: plankTex, color: 0x8a6c50, roughness: 0.95 }),
      adobe: new THREE.MeshStandardMaterial({ map: adobeTex, roughness: 1.0 }),
      brick: new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.95 }),
      rock: new THREE.MeshStandardMaterial({ map: rockTex, roughness: 1.0 }),
      metal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.6, metalness: 0.55 }),
      hay: new THREE.MeshStandardMaterial({ map: hayTex, roughness: 1.0 }),
      glow: new THREE.MeshStandardMaterial({
        color: 0x9a5a20, emissive: 0xffb340, emissiveIntensity: 1.3, roughness: 0.5
      }),
      dark: new THREE.MeshStandardMaterial({ color: 0x2a211c, roughness: 0.9 }),
      tumble: new THREE.MeshStandardMaterial({ color: 0xb08d52, roughness: 1.0, wireframe: true })
    };
    this._signMat = new THREE.MeshStandardMaterial({
      map: saloonTex, emissive: 0xffffff, emissiveMap: saloonTex, emissiveIntensity: 1.3
    });
    this._gateSignMat = new THREE.MeshStandardMaterial({ map: gateTex, roughness: 0.9 });
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

  /** Pushes an arbitrary pre-transformed geometry into a merge bucket. */
  _pushGeo(bucket, geo) {
    this._buckets[bucket].push(geo);
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

  /** Merged solid box + collider in one call. */
  _solid(bucket, w, h, d, x, y, z, rotY = 0, collide = true) {
    this._pushBox(bucket, w, h, d, x, y, z, rotY);
    if (collide) this._boxCollider(w, h, d, x, y, z, rotY);
  }

  /**
   * Stair flight (0.4 rise / 0.7 run) with colliders. Ground flights
   * (y0 === 0) get solid columns; elevated flights get floating treads.
   * axis: 'x' or 'z'; dir: +1/-1 along that axis from the (x, z) base edge.
   */
  _stairs(bucket, { axis, dir, x, z, y0, steps, width }) {
    for (let i = 0; i < steps; i++) {
      const top = y0 + (i + 1) * STEP_RISE;
      const off = dir * (i + 0.5) * STEP_RUN;
      const cx = axis === 'x' ? x + off : x;
      const cz = axis === 'z' ? z + off : z;
      const w = axis === 'x' ? STEP_RUN : width;
      const d = axis === 'z' ? STEP_RUN : width;
      const h = y0 === 0 ? top : 0.45;
      this._solid(bucket, w, h, d, cx, top - h, cz);
    }
  }

  _flushBuckets() {
    const matFor = {
      ground: this._mats.ground, wood: this._mats.wood,
      woodDark: this._mats.woodDark, adobe: this._mats.adobe,
      brick: this._mats.brick, rock: this._mats.rock,
      metal: this._mats.metal, hay: this._mats.hay, glow: this._mats.glow
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
    const sun = new THREE.DirectionalLight(0xffe3b0, 1.4);
    sun.position.set(52, 90, -40);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 240;
    sun.shadow.bias = -0.0006;
    this.group.add(sun);
    this.group.add(sun.target);
    sun.target.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0xf2d59a, 0x8a5a34, 0.8);
    this.group.add(hemi);
    const amb = new THREE.AmbientLight(0x9a7a54, 0.45);
    this.group.add(amb);
  }

  // ------------------------------------------------------- ground and creek

  _buildGroundAndCreek() {
    // Sand slabs (top y = 0) split by the dry creek channel (z 26..32)
    // whose bed slab tops out at -0.4 — knee-deep, auto-steppable banks.
    const g = (w, d, x, z, top) => {
      const geo = new THREE.BoxGeometry(w, 1.2, d);
      scaleUV(geo, w / 7, d / 7);
      geo.translate(x, top - 0.6, z);
      this._buckets.ground.push(geo);
      this._boxCollider(w, 1.2, d, x, top - 1.2, z);
    };
    g(144, 98, 0, -23, 0);     // north slab (z -72..26)
    g(144, 40, 0, 52, 0);      // south slab (z 32..72)
    g(144, 6, 0, 29, -0.4);    // creek bed  (z 26..32)

    // Cracked silt streaks in the bed (decor).
    for (let i = 0; i < 10; i++) {
      this._pushBox('rock', 1.2 + this._rng() * 2.4, 0.07, 0.8 + this._rng(),
        (this._rng() - 0.5) * 130, -0.4, 27.5 + this._rng() * 3);
    }

    // Plank bridge carrying Main Street over the creek.
    this._solid('wood', 6.4, 0.25, 9.0, 0, -0.05, 29);   // deck, top 0.2
    this._solid('woodDark', 0.25, 0.35, 9.0, -3.05, 0.2, 29);
    this._solid('woodDark', 0.25, 0.35, 9.0, 3.05, 0.2, 29);
    // Bridge piers (decor, in the bed).
    for (const px of [-2.4, 2.4]) {
      for (const pz of [26.8, 31.2]) {
        this._pushBox('woodDark', 0.3, 0.5, 0.3, px, -0.45, pz);
      }
    }
  }

  _buildPerimeter() {
    // Sheer red-rock canyon sealing the map. Bottoms sunk to -1.5 so the
    // creek bed (top -0.4) is sealed at both ends too.
    const H = 9.5;
    this._solid('rock', 146, H, 2.6, 0, -1.5, -71);
    this._solid('rock', 146, H, 2.6, 0, -1.5, 71);
    this._solid('rock', 2.6, H, 146, -71, -1.5, 0);
    this._solid('rock', 2.6, H, 146, 71, -1.5, 0);
    // SE rim raise: the mesa top (y 7.2) is close enough to the east/south
    // walls that a jump (apex ~0.96) plus the 0.45 auto-step could land on
    // the base rim top (y 8.0) and walk out of the arena. Raise the rim to
    // y 11.5 alongside the mesa — max reachable feet height from the mesa
    // is ~8.61 — and extend it well past the mesa edges (max airborne
    // horizontal reach ~5.4 m vs ~8.8 m to the nearest unraised rim top).
    this._solid('rock', 2.6, 3.6, 38, 71, 7.9, 54);  // east rim,  z 35..73
    this._solid('rock', 36, 3.6, 2.6, 55, 7.9, 71);  // south rim, x 37..73
    // Uneven crags along the rim + occasional buttresses (decor / cover).
    for (let i = 0; i < 40; i++) {
      const t = this._rng() * 4;
      const side = Math.floor(t);
      const s = (t - side) * 132 - 66;
      const w = 2 + this._rng() * 4;
      const h = 0.8 + this._rng() * 2.6;
      if (side === 0) this._pushBox('rock', w, h, 2.4, s, H - 1.5, -71);
      else if (side === 1) this._pushBox('rock', w, h, 2.4, s, H - 1.5, 71);
      else if (side === 2) this._pushBox('rock', 2.4, h, w, -71, H - 1.5, s);
      else this._pushBox('rock', 2.4, h, w, 71, H - 1.5, s);
    }
    for (const [bx, bz] of [[-70, -20], [-70, 30], [70, -28], [70, 12], [-30, -70], [36, -70], [-22, 70], [30, 70]]) {
      const w = 2.2 + this._rng() * 1.6;
      this._solid('rock', w, 3.2 + this._rng() * 2.5, w,
        bx + (bx === -70 ? 1.6 : bx === 70 ? -1.6 : 0),
        0, bz + (bz === -70 ? 1.6 : bz === 70 ? -1.6 : 0));
    }
  }

  // ----------------------------------------------------------- main street
  // West buildings: front wall x=-9, back x=-21. East: front x=9, back x=21.

  _buildSaloon() {
    // Two-storey saloon, z -34..-16. Bar, stage, interior stair to balcony.
    const B = 'wood';
    // Front wall (x -9), false front h 7, door gap z -26..-24 (2 x 2.5).
    this._solid(B, 0.4, 7, 8, -9, 0, -30);
    this._solid(B, 0.4, 7, 8, -9, 0, -20);
    this._solid(B, 0.4, 4.5, 2, -9, 2.5, -25);
    // Back wall (x -21) h 6, back door gap z -21.6..-20.
    this._solid(B, 0.4, 6, 12.4, -21, 0, -27.8);
    this._solid(B, 0.4, 6, 4, -21, 0, -18);
    this._solid(B, 0.4, 3.5, 1.6, -21, 2.5, -20.8);
    // Side walls.
    this._solid(B, 12, 6, 0.4, -15, 0, -34);
    this._solid(B, 12, 6, 0.4, -15, 0, -16);
    // Roof + cornice trim.
    this._solid('woodDark', 12.4, 0.4, 18.4, -15, 6, -25);
    this._pushBox('woodDark', 0.55, 0.35, 18.6, -8.85, 6.9, -25);
    // Interior balcony over the west half (top y 3.2) + railing.
    this._solid(B, 5.8, 0.3, 17.6, -17.9, 2.9, -25);
    this._solid('woodDark', 0.2, 0.9, 16, -15, 3.2, -24.2); // gap at the stair
    // Interior stair, south wall: 8 steps up to the balcony.
    this._stairs('woodDark', { axis: 'x', dir: -1, x: -9.6, z: -33, y0: 0, steps: 8, width: 1.6 });
    // Stage (north end) + piano.
    this._solid('woodDark', 7, 0.4, 3.8, -15.5, 0, -31.9);
    this._solid('woodDark', 1.6, 1.2, 0.7, -18.2, 0.4, -33.2);
    // Bar counter + back-bar bottle glow.
    this._solid('woodDark', 1.2, 1.05, 8, -11.8, 0, -25);
    this._pushBox('glow', 0.25, 0.35, 2.6, -10.6, 1.2, -25);
    // Round tables (merged) with squat colliders.
    for (const [tx, tz] of [[-17.8, -20.5], [-12.5, -19], [-17.6, -28.5]]) {
      this._pushCyl('woodDark', 0.72, 0.72, 0.08, 10, tx, 0.68, tz);
      this._pushCyl('woodDark', 0.09, 0.12, 0.68, 6, tx, 0, tz);
      this._boxCollider(1.1, 0.78, 1.1, tx, 0, tz);
    }
    // Flickering SALOON sign over the door (animated in update()).
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.3, 4.2), this._signMat);
    sign.position.set(-8.6, 5.2, -25);
    sign.castShadow = true;
    this.group.add(sign);
    // Outhouse behind the saloon.
    this._solid('woodDark', 1.3, 2.3, 1.3, -24.5, 0, -24);
  }

  _buildGeneralStore() {
    // General store, z -10..2, false front h 5, door gap z -5.2..-3.6.
    const B = 'wood';
    this._solid(B, 0.4, 5, 4.8, -9, 0, -7.6);
    this._solid(B, 0.4, 5, 5.6, -9, 0, -0.8);
    this._solid(B, 0.4, 2.5, 1.6, -9, 2.5, -4.4);
    this._solid(B, 0.4, 3.6, 12, -21, 0, -4);
    this._solid(B, 12, 3.6, 0.4, -15, 0, -10);
    this._solid(B, 12, 3.6, 0.4, -15, 0, 2);
    this._solid('woodDark', 12.4, 0.4, 12.4, -15, 3.6, -4);
    this._pushBox('woodDark', 0.55, 0.35, 12.6, -8.85, 4.9, -4);
    // Shelf rows (hide in the back aisle) + counter + goods.
    this._solid('woodDark', 1.1, 1.9, 6, -17.5, 0, -4);
    this._solid('woodDark', 1.1, 1.9, 6, -14, 0, -4);
    this._solid('woodDark', 2.4, 1.0, 1.0, -11, 0, 0.4);
    this._pushBox('hay', 0.8, 0.6, 0.8, -19.8, 0, -8.9);
    this._pushBox('wood', 0.9, 0.9, 0.9, -10.6, 0, -8.9);
    this._boxCollider(0.9, 0.9, 0.9, -10.6, 0, -8.9);
  }

  _buildBank() {
    // Brick bank, z 6..20, door gap z 12..13.6, walk-in vault at the back.
    const B = 'brick';
    this._solid(B, 0.4, 5.6, 6, -9, 0, 9);
    this._solid(B, 0.4, 5.6, 6.4, -9, 0, 16.8);
    this._solid(B, 0.4, 3.1, 1.6, -9, 2.5, 12.8);
    this._solid(B, 0.4, 4.2, 14, -21, 0, 13);
    this._solid(B, 12, 4.2, 0.4, -15, 0, 6);
    this._solid(B, 12, 4.2, 0.4, -15, 0, 20);
    this._solid('woodDark', 12.4, 0.4, 14.4, -15, 4.2, 13);
    this._pushBox('brick', 0.55, 0.4, 14.6, -8.85, 5.5, 13);
    // Vault: metal walls in the SW corner, open doorway (1.5 x 2.8).
    this._solid('metal', 0.5, 2.8, 2.8, -15.8, 0, 7.6);
    this._solid('metal', 0.5, 2.8, 2.0, -15.8, 0, 11.5);
    this._solid('metal', 5.25, 2.8, 0.5, -18.18, 0, 12.75);
    this._solid('metal', 5.25, 0.4, 6.8, -18.18, 2.8, 9.6);
    // Swung-open vault door (decor) + gold glow inside.
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.6, 1.45), this._mats.metal);
    door.position.set(-15.2, 1.3, 9.1);
    door.rotation.y = 0.85;
    door.castShadow = true;
    this.group.add(door);
    this._pushBox('glow', 0.5, 0.2, 0.32, -20.2, 0, 7.3);
    this._pushBox('glow', 0.5, 0.2, 0.32, -20.2, 0.2, 7.45);
    this._pushBox('glow', 0.5, 0.2, 0.32, -19.55, 0, 7.35);
    // Teller counter.
    this._solid('woodDark', 1.0, 1.1, 8, -13, 0, 13);
  }

  _buildHotel() {
    // Two-storey hotel, z -34..-18, exterior stair to a y3.2 balcony
    // walkway that leads through an upper door to the second floor.
    const B = 'wood';
    // Front wall (x 9): lower + upper door gaps at z -27..-25.4.
    this._solid(B, 0.4, 6.4, 7, 9, 0, -30.5);
    this._solid(B, 0.4, 6.4, 7.4, 9, 0, -21.7);
    this._solid(B, 0.4, 0.7, 1.6, 9, 2.5, -26.2);
    this._solid(B, 0.4, 0.7, 1.6, 9, 5.7, -26.2);
    this._solid(B, 0.4, 6.4, 16, 21, 0, -26);
    this._solid(B, 12, 6.4, 0.4, 15, 0, -34);
    this._solid(B, 12, 6.4, 0.4, 15, 0, -18);
    this._solid('woodDark', 12.4, 0.4, 16.4, 15, 6.4, -26);
    this._pushBox('woodDark', 0.55, 0.35, 16.6, 8.85, 7.3, -26);
    // Second floor slab (top 3.2) + beds up there, desk below.
    this._solid(B, 11.6, 0.3, 15.6, 15, 2.9, -26);
    this._solid('woodDark', 2.0, 0.5, 1.2, 18.8, 3.2, -31.5);
    this._solid('woodDark', 2.0, 0.5, 1.2, 18.8, 3.2, -20.5);
    this._solid('woodDark', 0.9, 1.05, 2.6, 19.6, 0, -26);
    // Balcony walkway over the porch (top 3.2) + rails.
    this._solid(B, 2.2, 0.3, 16, 7.9, 2.9, -26);
    this._solid('woodDark', 0.2, 0.9, 16, 6.9, 3.2, -26);
    this._solid('woodDark', 2.2, 0.9, 0.2, 7.9, 3.2, -33.9);
    // Exterior stair from the boardwalk up to the balcony's south end.
    this._stairs('woodDark', { axis: 'z', dir: -1, x: 7.9, z: -12.4, y0: 0, steps: 8, width: 1.6 });
  }

  _buildSheriff() {
    // Sheriff's office + jail, z -12..0, door gap z -7..-5.4.
    const B = 'adobe';
    this._solid(B, 0.4, 3.4, 5, 9, 0, -9.5);
    this._solid(B, 0.4, 3.4, 5.4, 9, 0, -2.7);
    this._solid(B, 0.4, 0.9, 1.6, 9, 2.5, -6.2);
    this._solid(B, 0.4, 3.4, 12, 19, 0, -6);
    this._solid(B, 10, 3.4, 0.4, 14, 0, -12);
    this._solid(B, 10, 3.4, 0.4, 14, 0, 0);
    this._solid('woodDark', 10.4, 0.4, 12.4, 14, 3.4, -6);
    // Two barred cells at the back (x > 15); open cell doors.
    this._solid(B, 3.8, 3.4, 0.3, 17, 0, -6); // divider
    const barSegs = [
      [-11.8, -8.6], [-7.1, -6.15],   // cell A front, door z -8.6..-7.1
      [-5.85, -4.4], [-2.9, -0.2]     // cell B front, door z -4.4..-2.9
    ];
    const barMats = [];
    const barGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6);
    barGeo.translate(0, 1.3, 0);
    for (const [z0, z1] of barSegs) {
      const len = z1 - z0;
      this._boxCollider(0.15, 2.6, len, 15, 0, (z0 + z1) / 2);
      this._pushBox('metal', 0.07, 0.09, len, 15, 2.45, (z0 + z1) / 2);
      this._pushBox('metal', 0.07, 0.09, len, 15, 0.06, (z0 + z1) / 2);
      const n = Math.max(2, Math.round(len / 0.27));
      for (let i = 0; i <= n; i++) {
        barMats.push(this._matrixAt(15, 0.05, z0 + (len * i) / n, 0, 0, 0, 1, 1, 1));
      }
    }
    for (const dz of [-8.6, -7.1, -4.4, -2.9]) {
      this._pushBox('metal', 0.09, 2.6, 0.09, 15, 0, dz);
    }
    this._makeInstanced(barGeo, this._mats.metal, barMats, { cast: false });
    // Sheriff's desk + cell bunks.
    this._solid('woodDark', 1.6, 1.0, 0.9, 11.5, 0, -10.2);
    this._solid('woodDark', 0.7, 0.45, 1.8, 18.3, 0, -10.8);
    this._solid('woodDark', 0.7, 0.45, 1.8, 18.3, 0, -1.2);
  }

  _buildUndertaker() {
    // Undertaker, z 4..14, door gap z 8.2..9.8, coffins inside.
    const B = 'woodDark';
    this._solid(B, 0.4, 4.4, 4.2, 9, 0, 6.1);
    this._solid(B, 0.4, 4.4, 4.2, 9, 0, 11.9);
    this._solid(B, 0.4, 1.9, 1.6, 9, 2.5, 9);
    this._solid(B, 0.4, 3.2, 10, 19, 0, 9);
    this._solid(B, 10, 3.2, 0.4, 14, 0, 4);
    this._solid(B, 10, 3.2, 0.4, 14, 0, 14);
    this._solid('wood', 10.4, 0.4, 10.4, 14, 3.2, 9);
    this._pushBox('wood', 0.55, 0.35, 10.6, 8.85, 4.3, 9);
    this._solid('wood', 0.75, 0.55, 2.0, 16.5, 0, 6.5);
    this._solid('wood', 0.75, 0.55, 2.0, 16.5, 0, 12);
    this._solid('wood', 0.8, 2.1, 0.5, 18.5, 0, 9.2);
    this._solid('woodDark', 1.0, 0.95, 3.0, 10.6, 0, 12);
  }

  _buildPorches() {
    // Boardwalk decks (top 0.15) + instanced posts + porch roofs.
    const postGeo = new THREE.CylinderGeometry(0.08, 0.09, 2.9, 7);
    postGeo.translate(0, 1.45, 0);
    const postMats = [];
    const lampSpots = [];
    const porch = (side, z0, z1, roof) => {
      const cx = side * 7.8;
      const len = z1 - z0;
      this._solid('wood', 2.4, 0.15, len, cx, 0, (z0 + z1) / 2);
      if (roof) this._pushBox('woodDark', 2.5, 0.12, len, cx, 2.95, (z0 + z1) / 2);
      for (let z = z0 + 0.5; z <= z1 - 0.3; z += 3.2) {
        postMats.push(this._matrixAt(side * 6.85, 0.15, z, 0, 0, 0, 1, 1, 1));
      }
      lampSpots.push([side * 6.85, 2.25, z0 + 0.5]);
    };
    porch(-1, -34.2, -15.8, true);  // saloon
    porch(-1, -10.2, 2.2, true);    // general store
    porch(-1, 5.8, 20.2, true);     // bank
    porch(1, -34.2, -17.8, false);  // hotel (balcony above is the cover)
    porch(1, -12.2, 0.2, true);     // sheriff
    porch(1, 3.8, 14.2, true);      // undertaker
    this._makeInstanced(postGeo, this._mats.woodDark, postMats);
    // Oil lamps on the lead posts (emissive, no PointLights).
    for (const [lx, ly, lz] of lampSpots) {
      this._pushBox('glow', 0.16, 0.24, 0.16, lx, ly, lz);
    }
    // Hitching rails at the street edge (decor).
    const railGeo = new THREE.BoxGeometry(1, 0.09, 0.06);
    const hitchMats = [];
    for (const [hx, hz] of [[-6.3, -22], [6.3, -20], [-6.3, 15], [6.3, 11]]) {
      hitchMats.push(this._matrixAt(hx, 0.85, hz, 0, 0, 0, 2.2, 1, 1));
      hitchMats.push(this._matrixAt(hx, 0.42, hz - 1.05, 0, 0, Math.PI / 2, 0.85, 1, 1));
      hitchMats.push(this._matrixAt(hx, 0.42, hz + 1.05, 0, 0, Math.PI / 2, 0.85, 1, 1));
    }
    this._makeInstanced(railGeo, this._mats.woodDark, hitchMats, { cast: false });
  }

  // ------------------------------------------------------------ train depot

  _buildDepotAndTrain() {
    // Ballast + instanced ties + rails (all low enough to step over).
    this._pushBox('rock', 104, 0.12, 4.4, -8, 0, TRACK_Z);
    const tieGeo = new THREE.BoxGeometry(0.22, 0.1, 2.6);
    const tieMats = [];
    for (let x = -58; x <= 42; x += 1.1) {
      tieMats.push(this._matrixAt(x, 0.17, TRACK_Z, 0, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(tieGeo, this._mats.woodDark, tieMats, { cast: false });
    this._pushBox('metal', 102, 0.14, 0.12, -8, 0.22, -57.4);
    this._pushBox('metal', 102, 0.14, 0.12, -8, 0.22, -56.0);

    // Platform (top 0.4) + depot office + furniture.
    this._solid('wood', 34, 0.4, 6.2, -3, 0, -52.1);
    this._solid('adobe', 0.3, 3, 1.3, 4, 0.4, -52.55);
    this._solid('adobe', 0.3, 3, 1.1, 4, 0.4, -49.75);
    this._solid('adobe', 0.3, 0.5, 1.6, 4, 2.9, -51.1);
    this._solid('adobe', 0.3, 3, 4, 12, 0.4, -51.2);
    this._solid('adobe', 8, 3, 0.3, 8, 0.4, -53.2);
    this._solid('adobe', 8, 3, 0.3, 8, 0.4, -49.2);
    this._solid('woodDark', 8.6, 0.35, 4.8, 8, 3.4, -51.2);
    this._solid('woodDark', 1.8, 0.45, 0.5, -8, 0.4, -49.6);
    this._solid('wood', 0.9, 0.9, 0.9, -16, 0.4, -50.5);
    this._pushBox('wood', 0.7, 0.7, 0.7, -16.9, 0.4, -50.3);
    this._boxCollider(0.7, 0.7, 0.7, -16.9, 0.4, -50.3);

    // --- The 4:15 to Yuma (static). Wheels are shared instanced cylinders.
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.16, 10);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelMats = [];
    const wheelsAt = (x, s) => {
      for (const wz of [-57.4, -56.0]) {
        wheelMats.push(this._matrixAt(x, 0.45 * s, wz, 0, 0, 0, s, s, 1));
      }
    };
    // Locomotive (one big collider).
    const boiler = new THREE.CylinderGeometry(1.05, 1.05, 6.2, 14);
    boiler.rotateZ(Math.PI / 2);
    boiler.translate(-30.5, 1.55, TRACK_Z);
    this._pushGeo('metal', boiler);
    this._pushBox('metal', 2.2, 2.4, 2.6, -26.2, 1.0, TRACK_Z);
    this._pushBox('metal', 2.6, 0.18, 3.0, -26.2, 3.4, TRACK_Z);
    this._pushCyl('metal', 0.3, 0.45, 1.3, 10, -32.6, 2.5, TRACK_Z);
    this._pushCyl('metal', 0.42, 0.42, 0.5, 8, -30.6, 2.55, TRACK_Z);
    this._pushBox('glow', 0.34, 0.34, 0.34, -33.9, 1.9, TRACK_Z);
    const catcher = new THREE.BoxGeometry(0.9, 1.0, 1.9);
    catcher.rotateX(0.5);
    catcher.translate(-34.3, 0.55, TRACK_Z);
    this._pushGeo('metal', catcher);
    this._boxCollider(10, 3.4, 3.0, -29.6, 0, TRACK_Z);
    wheelsAt(-32.4, 1.25); wheelsAt(-30.2, 1.25); wheelsAt(-28.0, 1.25);
    // Tender with a coal heap.
    this._pushBox('metal', 4.6, 2.2, 2.6, -21.7, 0.5, TRACK_Z);
    this._pushBox('rock', 3.6, 0.45, 2.0, -21.7, 2.35, TRACK_Z);
    this._boxCollider(4.6, 2.8, 2.8, -21.7, 0, TRACK_Z);
    wheelsAt(-23.2, 1); wheelsAt(-20.2, 1);
    // Enterable boxcar: floor top 0.4, side door (3.2 x 2.3) facing platform.
    this._solid('wood', 10, 0.4, 2.8, -12, 0, TRACK_Z);
    this._solid('woodDark', 0.25, 2.3, 2.8, -16.87, 0.4, TRACK_Z);
    this._solid('woodDark', 0.25, 2.3, 2.8, -7.13, 0.4, TRACK_Z);
    this._solid('woodDark', 10, 2.3, 0.25, -12, 0.4, -57.97);
    this._solid('woodDark', 3.15, 2.3, 0.25, -15.17, 0.4, -55.42);
    this._solid('woodDark', 3.15, 2.3, 0.25, -8.82, 0.4, -55.42);
    this._solid('woodDark', 10.4, 0.25, 3.2, -12, 2.7, TRACK_Z);
    wheelsAt(-15.5, 1); wheelsAt(-8.5, 1);
    // Flatcar (deck top 1.2) reached by crate steps at its east end.
    this._pushBox('wood', 10, 0.5, 2.8, 0, 0.7, TRACK_Z);
    this._boxCollider(10, 1.2, 2.8, 0, 0, TRACK_Z);
    this._solid('wood', 1.1, 1.0, 1.1, -2, 1.2, -56.9);
    this._pushCyl('woodDark', 0.34, 0.34, 0.75, 9, -3.6, 1.2, -56.3);
    this._boxCollider(0.68, 0.75, 0.68, -3.6, 1.2, -56.3);
    this._solid('wood', 1.2, 0.8, 1.2, 5.7, 0, TRACK_Z);
    this._solid('wood', 1.2, 0.4, 1.2, 6.9, 0, TRACK_Z);
    wheelsAt(-3.5, 1); wheelsAt(3.5, 1);
    this._makeInstanced(wheelGeo, this._mats.dark, wheelMats, { cast: false });
    // Buffer stop at the track's east end.
    this._solid('woodDark', 1.0, 1.3, 2.8, 42.5, 0, TRACK_Z);
  }

  _buildWaterTower() {
    // Tank on legs beside the depot; walkable rim platform at y 5.2
    // reached by a switchback (flight south, landing, flight north).
    const cx = 26, cz = -50;
    for (const sx of [-1.7, 1.7]) {
      for (const sz of [-1.7, 1.7]) {
        this._solid('woodDark', 0.35, 5.0, 0.35, cx + sx, 0, cz + sz);
      }
    }
    this._solid('wood', 6.4, 0.3, 6.4, cx, 4.9, cz);           // platform, top 5.2
    this._pushCyl('woodDark', 2.2, 2.2, 3.4, 14, cx, 5.2, cz); // tank
    this._boxCollider(4.4, 3.4, 4.4, cx, 5.2, cz);
    this._pushCyl('woodDark', 2.5, 2.3, 0.7, 14, cx, 8.6, cz); // roof
    const spout = new THREE.CylinderGeometry(0.14, 0.17, 2.2, 8);
    spout.rotateX(1.15);
    spout.translate(cx, 5.6, cz - 3.2);
    this._pushGeo('metal', spout);
    this._stairs('wood', { axis: 'z', dir: 1, x: 25.2, z: -46.5, y0: 0, steps: 7, width: 1.4 });
    this._solid('wood', 3.0, 0.3, 1.4, 26, 2.5, -40.9);        // landing, top 2.8
    this._stairs('wood', { axis: 'z', dir: -1, x: 26.8, z: -41.6, y0: 2.8, steps: 6, width: 1.4 });
    this._solid('wood', 1.4, 0.3, 1.5, 26.8, 4.9, -46.15);     // short bridge to the platform
  }

  _buildWindmill() {
    // Steel windmill by the creek; blades spin in update().
    const cx = 32, cz = 20;
    for (const sx of [-0.8, 0.8]) {
      for (const sz of [-0.8, 0.8]) {
        this._solid('metal', 0.22, 6.6, 0.22, cx + sx, 0, cz + sz);
      }
    }
    this._pushBox('metal', 1.5, 0.15, 1.5, cx, 6.3, cz);
    this._pushBox('metal', 0.3, 0.5, 0.3, cx, 6.45, cz);
    this._pushBox('metal', 0.1, 0.35, 1.8, cx, 6.75, cz - 1.0); // tail vane
    const bladeGeos = [];
    for (let k = 0; k < 6; k++) {
      const b = new THREE.BoxGeometry(0.17, 2.3, 0.05);
      b.translate(0, 1.35, 0);
      b.rotateZ((k / 6) * Math.PI * 2);
      bladeGeos.push(b);
    }
    const hub = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 8);
    hub.rotateX(Math.PI / 2);
    bladeGeos.push(hub);
    this._blades = new THREE.Mesh(mergeGeometries(bladeGeos, false), this._mats.woodDark);
    for (const g of bladeGeos) g.dispose();
    this._blades.position.set(cx, 6.95, cz + 0.55);
    this._blades.castShadow = true;
    this.group.add(this._blades);
    // Stock tank at its foot.
    this._pushCyl('woodDark', 1.0, 1.0, 0.5, 12, cx, 0, cz + 2.2);
    this._boxCollider(2.0, 0.5, 2.0, cx, 0, cz + 2.2);
  }

  // -------------------------------------------------------- rock formations

  _buildMineButte() {
    // NW butte (h 8) hollowed by a tunnel room; switchback to a y6 ledge.
    this._solid('rock', 20, 8, 6, -56, 0, -63);   // north mass
    this._solid('rock', 6, 8, 14, -63, 0, -53);   // west mass
    this._solid('rock', 6, 8, 14, -49, 0, -53);   // east mass
    this._solid('rock', 3, 8, 6, -58.5, 0, -49);  // south, west of tunnel
    this._solid('rock', 3, 8, 6, -53.5, 0, -49);  // south, east of tunnel
    this._solid('rock', 2, 5.4, 6, -56, 2.6, -49); // tunnel header (2 x 2.6)
    this._solid('rock', 8, 5, 8, -56, 3.0, -56);  // room ceiling mass
    // Timber portal framing the tunnel mouth.
    this._pushBox('woodDark', 0.3, 2.7, 0.3, -57.15, 0, -46.2);
    this._pushBox('woodDark', 0.3, 2.7, 0.3, -54.85, 0, -46.2);
    this._pushBox('woodDark', 2.9, 0.3, 0.4, -56, 2.65, -46.2);
    // Mine cart + crate + lantern inside the room.
    this._solid('metal', 0.9, 0.7, 1.4, -57.8, 0, -55);
    this._solid('wood', 0.8, 0.8, 0.8, -54, 0, -58.6);
    this._pushBox('glow', 0.15, 0.22, 0.15, -52.9, 1.7, -56);
    this._pushBox('metal', 0.1, 0.08, 6.5, -56.4, 0.02, -49.5); // cart rails
    this._pushBox('metal', 0.1, 0.08, 6.5, -55.6, 0.02, -49.5);
    // Switchback on the east face up to the ledge (top 6.0).
    this._stairs('rock', { axis: 'z', dir: -1, x: -44.7, z: -46.5, y0: 0, steps: 8, width: 1.4 });
    this._solid('rock', 2.9, 0.3, 1.5, -43.95, 2.9, -52.85);  // landing, top 3.2
    this._stairs('rock', { axis: 'z', dir: 1, x: -43.2, z: -52.1, y0: 3.2, steps: 7, width: 1.4 });
    this._solid('rock', 3.6, 0.4, 2.8, -44.4, 5.6, -46.0);    // ledge, top 6.0
  }

  _buildMesa() {
    // SE mesa (top 7.2); switchback on the north face reaches the top.
    this._solid('rock', 20, 7.2, 20, 56, 0, 54);
    // Rim boulders (kept off the stair approach, NW corner).
    for (const [rx, rz] of [[63, 46], [64.5, 58], [58, 62.5], [48, 61], [61, 52]]) {
      this._pushBox('rock', 1.6 + this._rng() * 1.4, 0.8 + this._rng() * 1.2,
        1.6 + this._rng() * 1.2, rx, 7.2, rz);
    }
    this._stairs('rock', { axis: 'x', dir: 1, x: 47, z: 42.9, y0: 0, steps: 9, width: 1.4 });
    this._solid('rock', 1.6, 0.3, 2.9, 54.1, 3.3, 42.15);   // landing, top 3.6
    this._stairs('rock', { axis: 'x', dir: -1, x: 53.3, z: 41.4, y0: 3.6, steps: 9, width: 1.4 });
    this._solid('rock', 2.4, 0.4, 3.2, 47.7, 6.8, 42.6);    // bridge onto the top
  }

  // ----------------------------------------------------------- south of town

  _buildChurch() {
    // Whitewashed chapel, x -34..-24, z 42..54, door on the east side.
    const B = 'adobe';
    this._solid(B, 0.4, 4, 5, -24, 0, 44.5);
    this._solid(B, 0.4, 4, 5.2, -24, 0, 51.4);
    this._solid(B, 0.4, 1.5, 1.8, -24, 2.5, 47.9);
    this._solid(B, 0.4, 4, 12, -34, 0, 48);
    this._solid(B, 10, 4, 0.4, -29, 0, 42);
    this._solid(B, 10, 4, 0.4, -29, 0, 54);
    // Gabled roof + belfry + spire (decor, out of reach).
    for (const s of [-1, 1]) {
      const panel = new THREE.BoxGeometry(5.8, 0.16, 12.8);
      scaleUV(panel, 2, 4);
      panel.rotateZ(s * 0.5);
      panel.translate(-29 + s * 2.3, 4.95, 48);
      this._pushGeo('woodDark', panel);
    }
    this._pushBox('woodDark', 0.5, 0.3, 13, -29, 5.9, 48);
    this._pushBox(B, 10, 1.3, 0.3, -29, 4, 42.2);
    this._pushBox(B, 10, 1.3, 0.3, -29, 4, 53.8);
    this._pushBox(B, 2.6, 3.0, 2.6, -24.4, 4.0, 47.9);
    const spire = new THREE.ConeGeometry(1.9, 2.2, 4);
    spire.rotateY(Math.PI / 4);
    spire.translate(-24.4, 8.1, 47.9);
    this._pushGeo('woodDark', spire);
    this._pushBox('woodDark', 0.14, 0.9, 0.14, -24.4, 9.2, 47.9);
    this._pushBox('woodDark', 0.6, 0.14, 0.14, -24.4, 9.6, 47.9);
    // Pews (two columns) + altar.
    for (const px of [-26.5, -28, -29.5, -31]) {
      this._solid('woodDark', 0.5, 0.85, 2.2, px, 0, 44.8);
      this._solid('woodDark', 0.5, 0.85, 2.2, px, 0, 51);
    }
    this._solid('woodDark', 0.9, 1.0, 1.8, -33.1, 0, 47.9);
  }

  _buildGraveyard() {
    // Fenced boot hill west of the church; gate faces the chapel door.
    const fence = (w, d, x, z) => this._boxCollider(Math.max(w, 0.15), 1.0, Math.max(d, 0.15), x, 0, z);
    fence(10, 0, -43, 40);
    fence(10, 0, -43, 54);
    fence(0, 14, -48, 47);
    fence(0, 6, -38, 43);   // east side, gate gap z 46..48
    fence(0, 6, -38, 51);
    const postGeo = new THREE.BoxGeometry(0.12, 1.15, 0.12);
    postGeo.translate(0, 0.575, 0);
    const railGeo = new THREE.BoxGeometry(1, 0.08, 0.05);
    const postMats = [], railMats = [];
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.round(len / 2.2);
      const yaw = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 0 : Math.PI / 2;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        postMats.push(this._matrixAt(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0, 0, 0, 1, 1, 1));
      }
      for (const ry of [0.45, 0.9]) {
        railMats.push(this._matrixAt((x0 + x1) / 2, ry, (z0 + z1) / 2, 0, yaw, 0, len, 1, 1));
      }
    };
    run(-48, 40, -38, 40);
    run(-48, 54, -38, 54);
    run(-48, 40, -48, 54);
    run(-38, 40, -38, 46);
    run(-38, 48, -38, 54);
    this._makeInstanced(postGeo, this._mats.woodDark, postMats, { cast: false });
    this._makeInstanced(railGeo, this._mats.woodDark, railMats, { cast: false });
    // Instanced headstones (small colliders — hiding cover).
    const stoneGeo = new THREE.BoxGeometry(0.56, 0.85, 0.14);
    stoneGeo.translate(0, 0.425, 0);
    const stoneMats = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === 2 && c === 2) continue; // clearing for the spawn point
        const x = -46.6 + c * 2.4 + (this._rng() - 0.5) * 0.5;
        const z = 42.2 + r * 3.0 + (this._rng() - 0.5) * 0.5;
        stoneMats.push(this._matrixAt(x, 0, z, 0, (this._rng() - 0.5) * 0.5,
          (this._rng() - 0.5) * 0.12, 0.85 + this._rng() * 0.4, 0.85 + this._rng() * 0.5, 1));
        this._boxCollider(0.6, 0.85, 0.35, x, 0, z);
      }
    }
    this._makeInstanced(stoneGeo, this._mats.adobe, stoneMats);
    // One grand cross marker.
    this._pushBox('woodDark', 0.16, 1.6, 0.16, -46.8, 0, 52.6);
    this._pushBox('woodDark', 0.8, 0.16, 0.16, -46.8, 1.05, 52.6);
  }

  _buildCorralAndBarn() {
    // Corral (rail fence, gate on the south side aligned with the barn door).
    this._boxCollider(22, 1.1, 0.15, 25, 0, 34);
    this._boxCollider(0.15, 1.1, 8, 14, 0, 38);
    this._boxCollider(0.15, 1.1, 8, 36, 0, 38);
    this._boxCollider(12, 1.1, 0.15, 20, 0, 42);
    this._boxCollider(7.6, 1.1, 0.15, 32.2, 0, 42);
    const postGeo = new THREE.BoxGeometry(0.16, 1.3, 0.16);
    postGeo.translate(0, 0.65, 0);
    const railGeo = new THREE.BoxGeometry(1, 0.1, 0.07);
    const postMats = [], railMats = [];
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 2.4));
      const yaw = Math.abs(x1 - x0) > Math.abs(z1 - z0) ? 0 : Math.PI / 2;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        postMats.push(this._matrixAt(x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0, 0, 0, 1, 1, 1));
      }
      for (const ry of [0.5, 1.0]) {
        railMats.push(this._matrixAt((x0 + x1) / 2, ry, (z0 + z1) / 2, 0, yaw, 0, len, 1, 1));
      }
    };
    run(14, 34, 36, 34);
    run(14, 34, 14, 42);
    run(36, 34, 36, 42);
    run(14, 42, 26, 42);
    run(28.4, 42, 36, 42);
    this._makeInstanced(postGeo, this._mats.woodDark, postMats, { cast: false });
    this._makeInstanced(railGeo, this._mats.woodDark, railMats, { cast: false });
    this._solid('woodDark', 1.8, 0.45, 0.7, 18, 0, 37);  // trough
    const hayPile = new THREE.ConeGeometry(1.3, 1.2, 9);
    hayPile.translate(31, 0.6, 37.5);
    this._pushGeo('hay', hayPile);

    // Barn, x 22..34, z 44..56; big north door (3 x 3) faces the corral.
    const B = 'wood';
    this._solid(B, 4, 4.2, 0.4, 24, 0, 44);
    this._solid(B, 5, 4.2, 0.4, 31.5, 0, 44);
    this._solid(B, 3, 1.2, 0.4, 27.5, 3.0, 44);
    this._solid(B, 12, 4.2, 0.4, 28, 0, 56);
    this._solid(B, 0.4, 4.2, 12, 22, 0, 50);
    this._solid(B, 0.4, 4.2, 12, 34, 0, 50);
    for (const s of [-1, 1]) {
      const panel = new THREE.BoxGeometry(7.4, 0.18, 12.8);
      scaleUV(panel, 2.5, 4);
      panel.rotateZ(s * 0.55);
      panel.translate(28 + s * 3.0, 5.15, 50);
      this._pushGeo('woodDark', panel);
    }
    this._pushBox('woodDark', 0.5, 0.3, 13, 28, 6.5, 50);
    this._pushBox(B, 12, 1.8, 0.3, 28, 4.2, 44.2);
    this._pushBox(B, 12, 1.8, 0.3, 28, 4.2, 55.8);
    // Hayloft (top 3.0) over the south half + hay-bale staircase.
    this._solid(B, 11.6, 0.3, 5.8, 28, 2.7, 52.9);
    for (let i = 0; i < 7; i++) {
      const h = (i + 1) * STEP_RISE;
      this._solid('hay', 1.4, h, 0.8, 32.9, 0, 44.4 + i * 0.8);
    }
    this._pushBox('hay', 2.2, 0.7, 1.6, 25, 3.0, 54.6); // loose hay on the loft
    this._solid('woodDark', 3.5, 1.4, 0.25, 24, 0, 47.5); // stall divider
    this._pushBox('hay', 1.0, 0.5, 0.7, 23.5, 0, 45.6);
  }

  _buildPlazaAndGate() {
    // Police muster plaza inside the sealed south gate.
    this._pushBox('wood', 16, 0.08, 11, 0, 0, 62.5); // decked muster ground
    this._solid('woodDark', 1.4, 7, 1.4, -5, 0, 68.8);
    this._solid('woodDark', 1.4, 7, 1.4, 5, 0, 68.8);
    this._pushBox('woodDark', 11.6, 0.5, 0.5, 0, 5.9, 68.8);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(6.0, 1.1, 0.14), this._gateSignMat);
    sign.position.set(0, 6.95, 68.7);
    sign.castShadow = true;
    this.group.add(sign);
    // Notice board, benches, supply wagon.
    this._solid('woodDark', 0.2, 2.2, 1.8, -7.5, 0, 60);
    this._solid('woodDark', 1.8, 0.45, 0.5, -6, 0, 65);
    this._solid('woodDark', 1.8, 0.45, 0.5, 6, 0, 63);
    this._solid('wood', 1.6, 1.1, 3.4, 12, 0.5, 62);
    this._pushBox('adobe', 1.7, 1.2, 2.4, 12, 1.6, 62); // canvas bonnet
    this._boxCollider(1.7, 2.8, 3.4, 12, 0, 62);
    // Town flag (waves in update()).
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 7, 8), this._mats.woodDark);
    pole.position.set(7, 3.5, 64);
    pole.castShadow = true;
    this.group.add(pole);
    this._boxCollider(0.3, 7, 0.3, 7, 0, 64);
    const flagGeo = new THREE.BoxGeometry(1.6, 1.0, 0.05);
    flagGeo.translate(0.85, 0, 0); // pivot at the pole
    this._flag = new THREE.Mesh(flagGeo, this._mats.brick);
    this._flag.position.set(7, 6.3, 64);
    this._flag.castShadow = true;
    this.group.add(this._flag);
  }

  // ----------------------------------------------------------------- desert

  /** True where scatter decor must not go (structures, lanes, spawns). */
  _inKeepZone(x, z) {
    for (const s of this._allSpawns) {
      if ((s.x - x) * (s.x - x) + (s.z - z) * (s.z - z) < 2.2 * 2.2) return true;
    }
    if (x > -26 && x < 26 && z > -40 && z < 24) return true;  // street + buildings
    if (z > 23 && z < 35) return true;                        // creek + banks
    if (x > -64 && x < 46 && z > -63 && z < -44) return true; // depot + tracks
    if (x > -12 && x < 14 && z > 55) return true;             // plaza + gate
    if (x > 12 && x < 38 && z > 32 && z < 58) return true;    // corral + barn
    if (x > -50 && x < -22 && z > 38 && z < 58) return true;  // church + graveyard
    if (x > -69 && x < -40 && z < -40) return true;           // mine butte
    if (x > 44 && z > 38) return true;                        // mesa + stairs
    if ((x - 26) * (x - 26) + (z + 50) * (z + 50) < 49) return true; // water tower
    if ((x - 32) * (x - 32) + (z - 20) * (z - 20) < 16) return true; // windmill
    return false;
  }

  _buildCacti() {
    // One saguaro geometry (trunk + two arms), instanced with colliders.
    const parts = [];
    const trunk = new THREE.CylinderGeometry(0.3, 0.36, 3.4, 8);
    trunk.translate(0, 1.7, 0);
    parts.push(trunk);
    for (const s of [-1, 1]) {
      const elbow = new THREE.CylinderGeometry(0.17, 0.17, 0.8, 7);
      elbow.rotateZ(Math.PI / 2);
      elbow.translate(s * 0.55, 1.5 + (s > 0 ? 0.5 : 0), 0);
      parts.push(elbow);
      const arm = new THREE.CylinderGeometry(0.17, 0.19, 1.3, 7);
      arm.translate(s * 0.9, 2.15 + (s > 0 ? 0.5 : 0), 0);
      parts.push(arm);
    }
    const cactusGeo = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    const spots = [
      [-32, -30], [-40, -12], [-36, 6], [-30, 21], [-52, 10], [-58, 37],
      [-55, 42], [-62, -20], [-44, -36], [26, -30], [38, -20], [44, 4],
      [53, 36], [60, -10], [58, -38], [40, 34], [11, 50], [-16, 36], [65, 30]
    ];
    const mats = [];
    for (const [x, z] of spots) {
      const s = 0.75 + this._rng() * 0.55;
      mats.push(this._matrixAt(x, 0, z, 0, this._rng() * Math.PI, 0, s, s, s));
      this._boxCollider(0.72 * s, 3.4 * s, 0.72 * s, x, 0, z);
    }
    this._makeInstanced(cactusGeo, new THREE.MeshStandardMaterial({ color: 0x5f7d3a, roughness: 0.95 }), mats);
  }

  _buildScrub() {
    // Dry brush + small stones (visual only).
    const bushGeo = new THREE.DodecahedronGeometry(0.5, 0);
    const stoneGeo = new THREE.DodecahedronGeometry(0.4, 0);
    const bushMats = [], stoneMats = [];
    const scatter = (list, count, yScale) => {
      let placed = 0, tries = 0;
      while (placed < count && tries++ < count * 10) {
        const x = (this._rng() - 0.5) * 134;
        const z = (this._rng() - 0.5) * 134;
        if (this._inKeepZone(x, z)) continue;
        const s = 0.5 + this._rng() * 1.0;
        list.push(this._matrixAt(x, 0.16 * s, z, (this._rng() - 0.5) * 0.4,
          this._rng() * Math.PI, (this._rng() - 0.5) * 0.4, s, s * yScale, s));
        placed++;
      }
    };
    scatter(bushMats, 80, 0.62);
    scatter(stoneMats, 45, 0.55);
    this._makeInstanced(bushGeo,
      new THREE.MeshStandardMaterial({ color: 0x8f8a4e, roughness: 1.0 }),
      bushMats, { cast: false });
    this._makeInstanced(stoneGeo, this._mats.rock, stoneMats, { cast: false });
  }

  _buildBarrels() {
    // Rain barrels + crates around town (colliders — hiding cover).
    const barrelGeo = new THREE.CylinderGeometry(0.34, 0.3, 0.75, 10);
    barrelGeo.translate(0, 0.375, 0);
    const spots = [
      [-7.6, 0.15, -16.6], [-7.6, 0.15, -33.4], [-7.6, 0.15, 1.4],
      [-7.6, 0.15, 19.4], [7.7, 0.15, -11.5], [7.7, 0.15, 13.4],
      [-22, 0, -48], [16, 0, -50.5], [34.5, 0, 40.5], [23.5, 0, 45.5],
      [-53.5, 0, -46.5], [7.6, 0, 59.5], [22.8, 0, -46.2], [-23.3, 0, -21.8]
    ];
    const mats = [];
    for (const [x, y, z] of spots) {
      mats.push(this._matrixAt(x, y, z, 0, this._rng() * Math.PI, 0, 1, 1, 1));
      this._boxCollider(0.68, 0.75, 0.68, x, y, z);
    }
    this._makeInstanced(barrelGeo, this._mats.woodDark, mats);
  }

  // ------------------------------------------------------------ live decor

  _buildTumbleweeds() {
    // Three tumbleweeds rolling east and wrapping (decor, no colliders).
    const geo = new THREE.IcosahedronGeometry(0.55, 1);
    for (const [z, speed, offset] of [[-44, 5.5, 10], [23, 4.2, 70], [66, 6.4, 120]]) {
      const mesh = new THREE.Mesh(geo, this._mats.tumble);
      mesh.castShadow = false;
      this.group.add(mesh);
      this._tumbleweeds.push({ mesh, z, speed, offset, phase: this._rng() * Math.PI * 2 });
    }
  }

  _buildBuzzards() {
    // Two buzzards circling high overhead (decor).
    const make = () => {
      const grp = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.75), this._mats.dark);
      grp.add(body);
      for (const s of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.32), this._mats.dark);
        wing.position.set(s * 0.55, 0.06, 0.05);
        wing.rotation.z = s * 0.18;
        grp.add(wing);
      }
      this.group.add(grp);
      return grp;
    };
    this._buzzards.push({ group: make(), cx: 0, cz: 0, y: 26, r: 34, speed: 0.12, phase: 0 });
    this._buzzards.push({ group: make(), cx: -50, cz: -50, y: 22, r: 14, speed: 0.2, phase: 2.1 });
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: muster plaza inside the south gate.
    this.policeSpawns = [
      v(-4, 0, 61), v(4, 0, 61), v(0, 0, 63.5), v(-2.5, 0, 58.5), v(2.5, 0, 58.5)
    ];
    this.monkeySpawns = [
      v(-13, 0, -29.2),        // saloon stage — floor nook at its foot
      v(-18, 3.2, -20),        // saloon balcony (y 3.2)
      v(-18.4, 0, 9.5),        // inside the bank vault
      v(17, 0, -9.5),          // jail cell, behind the bars
      v(7.9, 3.2, -30),        // hotel balcony walkway (y 3.2)
      v(26, 3.0, 53),          // barn hayloft (y 3.0)
      v(23.3, 5.2, -52.6),     // water-tower platform rim (y 5.2)
      v(-57.5, 0, -57),        // mine tunnel room
      v(16, -0.4, 29),         // crouched in the dry creek bed
      v(-43.2, 0, 46.6),       // graveyard, among the headstones
      v(50, 7.2, 48),          // mesa ledge (y ~7)
      v(-14.5, 0.4, TRACK_Z),  // inside the boxcar
      v(2, 1.2, TRACK_Z),      // on the flatcar deck (y 1.2)
      v(22, 0, 38),            // corral, behind the rail fence
      v(-19.6, 0, -4),         // general store, back shelf aisle
      v(-32.2, 0, 44.5)        // church, behind the pews
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
          console.warn('[WildWest] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    // 1) Windmill spin.
    if (this._blades) this._blades.rotation.z = time * 1.7;
    // 2) Town flag waving.
    if (this._flag) {
      this._flag.rotation.y = Math.sin(time * 1.4) * 0.35 + Math.sin(time * 3.7) * 0.08;
      this._flag.rotation.z = Math.sin(time * 2.3) * 0.06;
    }
    // 3) Tumbleweeds rolling east + wrapping.
    for (const t of this._tumbleweeds) {
      const x = -66 + ((t.offset + time * t.speed) % 132);
      t.mesh.position.set(
        x,
        0.5 + Math.abs(Math.sin(time * 4.5 + t.phase)) * 0.22,
        t.z + Math.sin(time * 0.6 + t.phase) * 1.2
      );
      t.mesh.rotation.z = -x * 1.9;
      t.mesh.rotation.x = Math.sin(time * 0.8 + t.phase) * 0.4;
    }
    // 4) Buzzards circling.
    for (const b of this._buzzards) {
      const a = time * b.speed + b.phase;
      b.group.position.set(
        b.cx + Math.cos(a) * b.r,
        b.y + Math.sin(time * 0.5 + b.phase) * 1.4,
        b.cz + Math.sin(a) * b.r
      );
      b.group.rotation.y = -a;
      b.group.rotation.z = 0.16;
    }
    // 5) Saloon sign buzzing/flickering.
    if (this._signMat) {
      const buzz = 0.8 + 0.2 * Math.sin(time * 31);
      const drop =
        Math.sin(time * 2.1) > 0.96 || Math.sin(time * 5.3 + 1.2) > 0.985 ? 0.12 : 1;
      this._signMat.emissiveIntensity = 1.35 * buzz * drop;
    }
  }
}
