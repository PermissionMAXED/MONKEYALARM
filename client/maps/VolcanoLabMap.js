import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * VOLCANO RESEARCH LAB — "A science outpost clinging to an active volcano."
 *
 * Layout (144 x 144, sealed by basalt cliff walls at +/-71):
 * - NE: the volcano cone — five square terrace rings (1.6 m each) up to a
 *   walkable crater rim at y 8 with a parapet, a glowing crater disc (decor)
 *   recessed at y ~6.8, and a switchback stair zig-zagging up the SW face.
 * - An L-shaped lava river (visual only — the walkable bed tops out at -0.4
 *   under a glowing, scrolling lava plane): N-S at x 8..14 (z -20..30) then
 *   E-W at z 30..36 running to the sealed west wall. Two raised steel grate
 *   bridges and basalt stepping blocks cross it.
 * - W-centre: the research station — enterable lab hall (flickering console
 *   screens, tanks), a corridor tube to the dorm, a garage with a drill rig,
 *   and an external stair to the lab roof deck (y 4.4).
 * - NW: a watchtower platform (y 6.8) reached by a switchback stair.
 * - S: monitoring yard — seismograph masts with blinking strobes, instanced
 *   crates and a tank farm. E: lava field with boulders, fumaroles and
 *   emissive fissures. SE: the police helipad checkpoint.
 * - update(): lava scroll + pulse, crater flicker, fumarole steam, strobe
 *   blink, console flicker and rising embers.
 */

const TIER_H = 1.6;              // volcano terrace rise (climbed via stairs)
const STEP_RISE = 0.4;           // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;            // stair tread depth
const CONE_X = 38;               // volcano cone centre
const CONE_Z = -38;
const CONE_HALVES = [16, 13.2, 10.4, 7.6, 4.8];
const RIM_Y = CONE_HALVES.length * TIER_H; // 8

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

export default class VolcanoLabMap extends MapBase {
  constructor() {
    super();
    this.id = 'VOLCANO_LAB';
    this.name = 'Volcano Research Lab';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-72, -6, -72),
      new THREE.Vector3(72, 55, 72)
    );
    this.killY = -12;
    this.environment = {
      skyColor: 0x2a1412,
      fog: { color: 0x3a1a12, near: 28, far: 135 }
    };

    this._rng = mulberry32(0xba5a17);
    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = {
      ground: [], basaltL: [], basaltS: [], concrete: [],
      metal: [], grate: [], fissure: [], screen: [], paint: []
    };
    this._lavaTex = null;
    this._lavaMat = null;
    this._craterMat = null;
    this._fissureMat = null;
    this._screenMat = null;
    this._strobeMat = null;
    this._emberGeo = null;
    this._embers = [];
    this._steamGeo = null;
    this._steam = [];
    this._vents = [];
    this._strobePts = [];
    this._scoriaMats = [];
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns(); // early: prop placement keeps clear of spawn points
    this._buildLights();
    this._buildGroundAndLava();
    this._buildPerimeter();
    this._buildVolcano();
    this._buildBridges();
    this._buildLabHall();
    this._buildCorridorAndDorm();
    this._buildGarage();
    this._buildWatchtower();
    this._buildYard();
    this._buildLavaField();
    this._buildHelipad();
    this._buildEmbers();
    this._buildSteam();
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

  _paintBasalt(ctx, size, base, emberAmount) {
    const rng = mulberry32(0xab5a + Math.floor(emberAmount * 131));
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    const rows = 6;
    const bh = size / rows;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * bh;
      for (let c = -1; c < rows + 1; c++) {
        const shade = Math.floor((rng() - 0.5) * 26);
        ctx.fillStyle = `rgba(${64 + shade},${58 + shade},${54 + shade},0.55)`;
        ctx.fillRect(c * bh + off + 2, r * bh + 2, bh - 4, bh - 4);
      }
    }
    // deep joints
    ctx.strokeStyle = 'rgba(12,8,7,0.6)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * bh);
      ctx.lineTo(size, r * bh + (rng() - 0.5) * 4);
      ctx.stroke();
    }
    // faint glowing ember cracks
    const cracks = Math.floor(6 * emberAmount);
    for (let i = 0; i < cracks; i++) {
      ctx.strokeStyle = `rgba(255,${80 + Math.floor(rng() * 70)},20,${0.18 + rng() * 0.2})`;
      ctx.lineWidth = 1 + rng();
      ctx.beginPath();
      let x = rng() * size;
      let y = rng() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 4; s++) {
        x += (rng() - 0.5) * 46;
        y += rng() * 30;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  _paintAshGround(ctx, size) {
    const rng = mulberry32(0x0a5cb1);
    ctx.fillStyle = '#2c2523';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 850; i++) {
      const t = rng();
      const g = t < 0.6
        ? `rgba(${40 + rng() * 26},${34 + rng() * 20},${30 + rng() * 16},0.5)`
        : `rgba(${72 + rng() * 30},${60 + rng() * 20},${50 + rng() * 14},0.32)`;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size,
        1 + rng() * 5, 1 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // scattered cinder glints
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,${70 + rng() * 60},20,${0.10 + rng() * 0.16})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng(),
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintConcrete(ctx, size) {
    const rng = mulberry32(0xc0cc12);
    ctx.fillStyle = '#6a6660';
    ctx.fillRect(0, 0, size, size);
    const rows = 4;
    const bh = size / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < rows; c++) {
        const shade = Math.floor((rng() - 0.5) * 20);
        ctx.fillStyle = `rgb(${104 + shade},${100 + shade},${94 + shade})`;
        ctx.fillRect(c * bh + 2, r * bh + 2, bh - 4, bh - 4);
      }
    }
    ctx.strokeStyle = 'rgba(30,28,26,0.55)';
    ctx.lineWidth = 2;
    for (let r = 0; r <= rows; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * bh); ctx.lineTo(size, r * bh); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(r * bh, 0); ctx.lineTo(r * bh, size); ctx.stroke();
    }
    // ash stains
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `rgba(40,36,32,${0.12 + rng() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 6 + rng() * 22, 4 + rng() * 12,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintMetal(ctx, size) {
    const rng = mulberry32(0x3e7a01);
    ctx.fillStyle = '#5d6166';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 40; i++) {
      const shade = Math.floor((rng() - 0.5) * 24);
      ctx.fillStyle = `rgba(${96 + shade},${100 + shade},${106 + shade},0.5)`;
      ctx.fillRect(0, rng() * size, size, 2 + rng() * 5);
    }
    // panel seams + rivets
    ctx.strokeStyle = 'rgba(28,30,34,0.7)';
    ctx.lineWidth = 2;
    for (let x = 0; x <= size; x += size / 4) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(200,206,214,0.5)';
    for (let x = size / 8; x < size; x += size / 4) {
      for (let y = size / 8; y < size; y += size / 4) {
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  _paintGrate(ctx, size) {
    ctx.fillStyle = '#26282c';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(140,146,154,0.85)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= size; i += 16) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,110,30,0.16)'; // lava glow leaking through
    for (let x = 8; x < size; x += 16) {
      for (let y = 8; y < size; y += 16) {
        ctx.fillRect(x - 5, y - 5, 10, 10);
      }
    }
  }

  _paintCrate(ctx, size) {
    const rng = mulberry32(0xc4a7e5);
    ctx.fillStyle = '#7a6a3e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      const shade = Math.floor((rng() - 0.5) * 30);
      ctx.fillStyle = `rgba(${128 + shade},${110 + shade},${66 + shade},0.4)`;
      ctx.fillRect(rng() * size, rng() * size, 4 + rng() * 20, 2 + rng() * 6);
    }
    ctx.strokeStyle = 'rgba(40,32,16,0.8)';
    ctx.lineWidth = 5;
    ctx.strokeRect(4, 4, size - 8, size - 8);
    ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(size - 4, size - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size - 4, 4); ctx.lineTo(4, size - 4); ctx.stroke();
  }

  _paintLava(ctx, size) {
    const rng = mulberry32(0x1afa77);
    ctx.fillStyle = '#c93a08';
    ctx.fillRect(0, 0, size, size);
    // bright molten veins
    for (let i = 0; i < 26; i++) {
      const y = rng() * size;
      ctx.strokeStyle = `rgba(255,${150 + rng() * 90},${30 + rng() * 40},${0.35 + rng() * 0.4})`;
      ctx.lineWidth = 2 + rng() * 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 14) {
        ctx.lineTo(x, y + Math.sin(x * 0.09 + i * 1.7) * 7);
      }
      ctx.stroke();
    }
    // cooled crust plates
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${40 + rng() * 30},${16 + rng() * 14},10,${0.35 + rng() * 0.35})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 4 + rng() * 16, 3 + rng() * 9,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _makeMaterials() {
    const basaltTexL = this._canvasTex(256, (c, s) => this._paintBasalt(c, s, '#3c3632', 1.0));
    const basaltTexS = this._canvasTex(256, (c, s) => this._paintBasalt(c, s, '#4a423c', 0.4));
    const ashTex = this._canvasTex(256, (c, s) => this._paintAshGround(c, s));
    const concreteTex = this._canvasTex(256, (c, s) => this._paintConcrete(c, s));
    const metalTex = this._canvasTex(128, (c, s) => this._paintMetal(c, s));
    const grateTex = this._canvasTex(128, (c, s) => this._paintGrate(c, s));
    const crateTex = this._canvasTex(128, (c, s) => this._paintCrate(c, s));
    this._lavaTex = this._canvasTex(128, (c, s) => this._paintLava(c, s));
    this._lavaTex.repeat.set(2, 14);
    const craterTex = this._canvasTex(128, (c, s) => this._paintLava(c, s));
    craterTex.repeat.set(1.5, 1.5);

    this._mats = {
      basaltL: new THREE.MeshStandardMaterial({ map: basaltTexL, roughness: 1.0 }),
      basaltS: new THREE.MeshStandardMaterial({ map: basaltTexS, roughness: 0.95 }),
      ground: new THREE.MeshStandardMaterial({ map: ashTex, roughness: 1.0 }),
      concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.9 }),
      metal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.55, metalness: 0.45 }),
      grate: new THREE.MeshStandardMaterial({ map: grateTex, roughness: 0.7, metalness: 0.4 }),
      crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.95 }),
      tank: new THREE.MeshStandardMaterial({
        map: metalTex, color: 0xb8c2c6, roughness: 0.5, metalness: 0.55
      }),
      boulder: new THREE.MeshStandardMaterial({ map: basaltTexL, color: 0x76695f, roughness: 1.0 }),
      // Lava river surface: glowing, scrolling, semi-transparent — VISUAL ONLY.
      lava: new THREE.MeshStandardMaterial({
        map: this._lavaTex, emissive: 0xff6a1c, emissiveMap: this._lavaTex,
        emissiveIntensity: 1.15, transparent: true, opacity: 0.85,
        depthWrite: false, roughness: 0.6
      }),
      crater: new THREE.MeshStandardMaterial({
        map: craterTex, emissive: 0xff7526, emissiveMap: craterTex,
        emissiveIntensity: 1.3, transparent: true, opacity: 0.9,
        depthWrite: false, roughness: 0.6
      }),
      fissure: new THREE.MeshStandardMaterial({
        color: 0x241008, emissive: 0xff4d12, emissiveIntensity: 1.0, roughness: 0.9
      }),
      screen: new THREE.MeshStandardMaterial({
        color: 0x0a1512, emissive: 0x53ffc4, emissiveIntensity: 0.9, roughness: 0.5
      }),
      paint: new THREE.MeshStandardMaterial({
        color: 0xe8e4da, emissive: 0xdcd8ce, emissiveIntensity: 0.2, roughness: 0.85
      }),
      strobe: new THREE.MeshStandardMaterial({
        color: 0x3a0d0d, emissive: 0xff2a2a, emissiveIntensity: 1.8, roughness: 0.4
      })
    };
    this._lavaMat = this._mats.lava;
    this._craterMat = this._mats.crater;
    this._fissureMat = this._mats.fissure;
    this._screenMat = this._mats.screen;
    this._strobeMat = this._mats.strobe;
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
  _solid(bucket, w, h, d, x, y, z, rotY = 0, collide = true) {
    this._pushBox(bucket, w, h, d, x, y, z, rotY);
    if (collide) this._boxCollider(w, h, d, x, y, z, rotY);
  }

  /** Solid stepped stair flight along an axis. Tallest tread flush at edge. */
  _stairs(bucket, axis, fixed, edge, dir, baseTop, steps, width) {
    // axis 'z': treads run in z at x=fixed; axis 'x': treads run in x at z=fixed.
    for (let m = 1; m <= steps; m++) {
      const top = baseTop + m * STEP_RISE;
      const along = edge + dir * ((steps - m) * STEP_RUN + STEP_RUN / 2);
      if (axis === 'z') this._solid(bucket, width, top, STEP_RUN, fixed, 0, along);
      else this._solid(bucket, STEP_RUN, top, width, along, 0, fixed);
    }
  }

  _flushBuckets() {
    const matFor = {
      ground: this._mats.ground, basaltL: this._mats.basaltL,
      basaltS: this._mats.basaltS, concrete: this._mats.concrete,
      metal: this._mats.metal, grate: this._mats.grate,
      fissure: this._mats.fissure, screen: this._mats.screen,
      paint: this._mats.paint
    };
    const noCast = { ground: true, fissure: true, paint: true };
    for (const key of Object.keys(this._buckets)) {
      const list = this._buckets[key];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      list.length = 0;
      const mesh = new THREE.Mesh(merged, matFor[key]);
      mesh.castShadow = !noCast[key];
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
    // ONE dim warm shadow light — the "volcano glow" bouncing off the smoke.
    const glow = new THREE.DirectionalLight(0xff8c58, 0.6);
    glow.position.set(58, 75, -52);
    glow.castShadow = true;
    glow.shadow.mapSize.set(2048, 2048);
    glow.shadow.camera.left = -80;
    glow.shadow.camera.right = 80;
    glow.shadow.camera.top = 80;
    glow.shadow.camera.bottom = -80;
    glow.shadow.camera.near = 10;
    glow.shadow.camera.far = 220;
    glow.shadow.bias = -0.0006;
    this.group.add(glow);
    this.group.add(glow.target);
    glow.target.position.set(0, 0, 0);

    // Kept bright enough that silhouettes always read (dark map rule).
    const hemi = new THREE.HemisphereLight(0x6b3a2c, 0x1a100c, 0.7);
    this.group.add(hemi);
    const amb = new THREE.AmbientLight(0x4a2f24, 0.6);
    this.group.add(amb);
  }

  // ---------------------------------------------------- ground + lava river

  _buildGroundAndLava() {
    // Walkable floor slabs (top y = 0) tiled around the L-shaped lava channel:
    // N-S at x 8..14 (z -20..30), then E-W at z 30..36 (x -70..14, dead-ending
    // at the sealed west wall). The channel BED tops out at -0.4 — knee-deep,
    // auto-steppable — under the purely visual lava planes.
    const slab = (w, d, x, z) => {
      const geo = new THREE.BoxGeometry(w, 1.2, d);
      scaleUV(geo, w / 7, d / 7);
      geo.translate(x, -0.6, z);
      this._buckets.ground.push(geo);
      this._boxCollider(w, 1.2, d, x, -1.2, z);
    };
    slab(144, 52, 0, -46);   // north slab   (z -72..-20)
    slab(80, 50, -32, 5);    // west-centre  (x -72..8, z -20..30)
    slab(58, 50, 43, 5);     // east-centre  (x 14..72, z -20..30)
    slab(58, 6, 43, 33);     // east strip beside the E-W channel
    slab(144, 36, 0, 54);    // south slab   (z 36..72)

    // Channel beds (top -0.4, sunk to -1.4 so the west wall seals the flow).
    const bed = (w, d, x, z) => {
      const geo = new THREE.BoxGeometry(w, 1.0, d);
      scaleUV(geo, w / 7, d / 7);
      geo.translate(x, -0.9, z);
      this._buckets.ground.push(geo);
      this._boxCollider(w, 1.0, d, x, -1.4, z);
    };
    bed(6, 50, 11, 5);       // N-S bed
    bed(84, 6, -28, 33);     // E-W bed

    // Lava surfaces — scrolling in update(); depthWrite off, players wade under.
    const nsGeo = new THREE.PlaneGeometry(5.7, 50.6);
    nsGeo.rotateX(-Math.PI / 2);
    const ns = new THREE.Mesh(nsGeo, this._lavaMat);
    ns.position.set(11, -0.12, 4.9);
    ns.receiveShadow = true;
    this.group.add(ns);

    const ewGeo = new THREE.PlaneGeometry(5.7, 83.6);
    ewGeo.rotateX(-Math.PI / 2);
    ewGeo.rotateY(Math.PI / 2); // long axis along x, v still along the flow
    const ew = new THREE.Mesh(ewGeo, this._lavaMat);
    ew.position.set(-28.1, -0.12, 33);
    ew.receiveShadow = true;
    this.group.add(ew);

    // Basalt stepping blocks (tops 0.02 — riser 0.42 from bed, auto-step).
    for (const [bx, bz] of [[9.2, -10], [11, -10], [12.8, -10]]) {
      this._pushCyl('basaltS', 0.95, 1.1, 0.42, 9, bx, -0.4, bz);
      this._boxCollider(1.8, 0.42, 1.8, bx, -0.4, bz);
    }
    for (const [bx, bz] of [[-50, 31.2], [-50, 33], [-50, 34.8]]) {
      this._pushCyl('basaltS', 0.95, 1.1, 0.42, 9, bx, -0.4, bz);
      this._boxCollider(1.8, 0.42, 1.8, bx, -0.4, bz);
    }

    // Glowing bank fissures hugging the channel edges (decor).
    this._pushBox('fissure', 0.35, 0.05, 14, 7.6, 0.01, -8);
    this._pushBox('fissure', 0.35, 0.05, 10, 14.4, 0.01, 20);
    this._pushBox('fissure', 12, 0.05, 0.35, -20, 0.01, 29.6);
    this._pushBox('fissure', 16, 0.05, 0.35, -44, 0.01, 36.4);
  }

  _buildPerimeter() {
    // Sheer basalt cliffs sealing the caldera. Bottoms sunk to -1.4 so the
    // lava channel bed (top -0.4) is sealed where it meets the west wall.
    const H = 10;
    this._solid('basaltL', 146, H, 2.4, 0, -1.4, -71);
    this._solid('basaltL', 146, H, 2.4, 0, -1.4, 71);
    this._solid('basaltL', 2.4, H, 146, -71, -1.4, 0);
    this._solid('basaltL', 2.4, H, 146, 71, -1.4, 0);
    // Jagged crown spurs along the top (decor, out of reach).
    for (let i = 0; i < 30; i++) {
      const t = this._rng() * 4;
      const side = Math.floor(t);
      const s = (t - side) * 132 - 66;
      const w = 1.6 + this._rng() * 3.0;
      const h = 0.8 + this._rng() * 2.2;
      if (side === 0) this._pushBox('basaltL', w, h, 2.2, s, H - 1.4, -71);
      else if (side === 1) this._pushBox('basaltL', w, h, 2.2, s, H - 1.4, 71);
      else if (side === 2) this._pushBox('basaltL', 2.2, h, w, -71, H - 1.4, s);
      else this._pushBox('basaltL', 2.2, h, w, 71, H - 1.4, s);
    }
  }

  // ---------------------------------------------------------------- volcano

  _buildVolcano() {
    // Five square terrace rings, 1.6 m each; tiers 0-3 are solid, the top
    // tier is a walkable ring (crater rim, y 8) around an open crater.
    for (let k = 0; k < 4; k++) {
      const half = CONE_HALVES[k];
      this._solid('basaltL', half * 2, TIER_H, half * 2, CONE_X, k * TIER_H, CONE_Z);
    }
    // Crater rim ring (outer half 4.8, inner opening half 2.6, top y 8).
    const oh = CONE_HALVES[4];   // 4.8
    const ih = 2.6;
    const ringW = oh - ih;       // 2.2 walkable width
    const mid = ih + ringW / 2;  // 3.7
    this._solid('basaltL', oh * 2, TIER_H, ringW, CONE_X, 4 * TIER_H, CONE_Z - mid);
    this._solid('basaltL', oh * 2, TIER_H, ringW, CONE_X, 4 * TIER_H, CONE_Z + mid);
    this._solid('basaltL', ringW, TIER_H, ih * 2, CONE_X - mid, 4 * TIER_H, CONE_Z);
    this._solid('basaltL', ringW, TIER_H, ih * 2, CONE_X + mid, 4 * TIER_H, CONE_Z);

    // Rim parapet on the OUTER edge (h 0.5 cover, jumpable), with a gap on
    // the south side where the switchback stair arrives (x 34.4..36.6).
    const pT = 0.3;
    this._solid('basaltS', oh * 2, 0.5, pT, CONE_X, RIM_Y, CONE_Z - oh + pT / 2);
    this._solid('basaltS', 1.2, 0.5, pT, CONE_X - oh + 0.6, RIM_Y, CONE_Z + oh - pT / 2);
    this._solid('basaltS', 6.2, 0.5, pT, CONE_X + oh - 3.1, RIM_Y, CONE_Z + oh - pT / 2);
    this._solid('basaltS', pT, 0.5, oh * 2, CONE_X - oh + pT / 2, RIM_Y, CONE_Z);
    this._solid('basaltS', pT, 0.5, oh * 2, CONE_X + oh - pT / 2, RIM_Y, CONE_Z);

    // Crater floor is tier-3's top (6.4) — a monkey can wade in the crater
    // lava (disc at 6.8, decor) and hop out via the escape block (top 7.2:
    // 0.8 up from the floor and 0.8 below the rim, both under jump apex).
    this._solid('basaltS', 1.2, 0.8, 1.2, CONE_X + 1.8, 6.4, CONE_Z - 0.9);
    const discGeo = new THREE.CircleGeometry(2.45, 20);
    discGeo.rotateX(-Math.PI / 2);
    const disc = new THREE.Mesh(discGeo, this._craterMat);
    disc.position.set(CONE_X, 6.8, CONE_Z);
    this.group.add(disc);

    // Switchback stair up the SW face: one 4-step flight per terrace, each
    // offset sideways so you zig-zag along the ledges between climbs.
    const flightX = [26, 28, 30.5, 33, 35.5];
    for (let k = 0; k < 5; k++) {
      const edge = CONE_Z + CONE_HALVES[k]; // south edge of tier k
      this._stairs('basaltS', 'z', flightX[k], edge, 1, k * TIER_H, 4, 1.8);
    }

    // Loose scoria on the ledges (small — decor, no collider needed).
    const scoria = [
      [30, 1.6, -52.8, 0.8], [52.8, 1.6, -44, 0.85], [46, 3.2, -26.5, 0.75],
      [28, 4.8, -46.5, 0.7], [44.5, 6.4, -33.5, 0.65]
    ];
    for (const [sx, sy, sz, ss] of scoria) {
      this._scoriaMats.push(this._matrixAt(sx, sy + ss * 0.6, sz,
        this._rng() * Math.PI, this._rng() * Math.PI, this._rng() * Math.PI,
        ss, ss * 0.8, ss));
    }
  }

  // ---------------------------------------------------------------- bridges

  _buildBridges() {
    // Raised steel grate bridges (deck bottom 1.9, top 2.1). Underside sits
    // >= 1.9 above BOTH the banks (y 0) and the -0.4 lava bed, so even a
    // standing 1.8 m human monkey can hide UNDER them without the collision
    // resolver snapping them up onto the deck. 5-step flights each end
    // (0.4 risers, then a final 0.1 step onto the deck — all auto-steppable).
    const DECK_Y = 1.9;            // deck underside (> PLAYER.HEIGHT clearance)
    const DECK_TOP = DECK_Y + 0.2; // 2.1
    const bridge = (axis, cx, cz, span) => {
      const deckW = span + 2.4;
      if (axis === 'x') {
        // deck runs along x, crossing the N-S channel
        this._solid('grate', deckW, 0.2, 2.8, cx, DECK_Y, cz);
        this._solid('metal', deckW, 0.9, 0.14, cx, DECK_TOP, cz - 1.33);
        this._solid('metal', deckW, 0.9, 0.14, cx, DECK_TOP, cz + 1.33);
        this._stairs('metal', 'x', cz, cx - deckW / 2, -1, 0, 5, 2.8);
        this._stairs('metal', 'x', cz, cx + deckW / 2, 1, 0, 5, 2.8);
        // support legs on the banks (decor)
        this._pushCyl('metal', 0.14, 0.16, DECK_Y, 8, cx - deckW / 2 + 0.3, 0, cz - 1.1);
        this._pushCyl('metal', 0.14, 0.16, DECK_Y, 8, cx + deckW / 2 - 0.3, 0, cz + 1.1);
      } else {
        this._solid('grate', 2.8, 0.2, deckW, cx, DECK_Y, cz);
        this._solid('metal', 0.14, 0.9, deckW, cx - 1.33, DECK_TOP, cz);
        this._solid('metal', 0.14, 0.9, deckW, cx + 1.33, DECK_TOP, cz);
        this._stairs('metal', 'z', cx, cz - deckW / 2, -1, 0, 5, 2.8);
        this._stairs('metal', 'z', cx, cz + deckW / 2, 1, 0, 5, 2.8);
        this._pushCyl('metal', 0.14, 0.16, DECK_Y, 8, cx - 1.1, 0, cz - deckW / 2 + 0.3);
        this._pushCyl('metal', 0.14, 0.16, DECK_Y, 8, cx + 1.1, 0, cz + deckW / 2 - 0.3);
      }
    };
    bridge('x', 11, 8, 6);    // over the N-S channel
    bridge('z', -30, 33, 6);  // over the E-W channel
  }

  // ----------------------------------------------------------- lab hall (W)

  /** Axis-aligned wall segment (concrete) with collider. */
  _wall(x, z, w, d, h, y = 0) {
    this._solid('concrete', w, h, d, x, y, z);
  }

  _buildLabHall() {
    // Enterable hall, x -54..-36, z -14..0, walls h 4.2, roof deck top 4.4.
    const H = 4.2, T = 0.5;
    // East wall (x -36): doorway z -8.4..-6.4 (2.0 x 2.4) + lintel.
    this._wall(-36, -11.2, T, 5.6, H);
    this._wall(-36, -3.2, T, 6.4, H);
    this._wall(-36, -7.4, T, 2.0, 1.8, 2.4);
    // South wall (z 0): doorway x -47..-45 + lintel.
    this._wall(-50.5, 0, 7.0, T, H);
    this._wall(-40.5, 0, 9.0, T, H);
    this._wall(-46, 0, 2.0, T, 1.8, 2.4);
    // North wall (z -14): corridor opening x -47.7..-45.7 + lintel.
    this._wall(-50.85, -14, 6.3, T, H);
    this._wall(-40.85, -14, 9.7, T, H);
    this._wall(-46.7, -14, 2.0, T, 1.6, 2.6);
    // West wall solid.
    this._wall(-54, -7, T, 14.5, H);

    // Roof deck (top 4.4) + parapet cover; gap on the west edge for the stair.
    this._solid('concrete', 18.5, 0.2, 14.5, -45, H, -7);
    this._solid('concrete', 18.5, 0.45, 0.25, -45, 4.4, -14.13);
    this._solid('concrete', 18.5, 0.45, 0.25, -45, 4.4, 0.13);
    this._solid('concrete', 0.25, 0.45, 14.5, -35.88, 4.4, -7);
    this._solid('concrete', 0.25, 0.45, 5.4, -54.13, 4.4, -11.55);
    this._solid('concrete', 0.25, 0.45, 6.6, -54.13, 4.4, -3.35);
    // Roof furniture: vent housing (cover) + antenna (decor).
    this._solid('metal', 1.4, 1.0, 1.4, -50, 4.4, -11);
    this._pushCyl('metal', 0.05, 0.07, 3.4, 6, -38, 4.4, -12.5);
    this._pushBox('metal', 0.7, 0.06, 0.06, -38, 7.4, -12.5);

    // External stair to the roof (11 x 0.4 risers along the west wall,
    // climbing north so the top tread meets the parapet gap at z ~-7.85).
    this._stairs('concrete', 'z', -54.95, -8.2, 1, 0, 11, 1.4);

    // Interior: console desks along the north wall + flickering screens.
    this._solid('metal', 4.5, 0.95, 0.8, -50.25, 0, -13.3);
    this._solid('metal', 6.0, 0.95, 0.8, -41, 0, -13.3);
    for (const sx of [-51.6, -50.2, -43.4, -41.8, -40.2, -38.6]) {
      this._pushBox('screen', 1.1, 0.7, 0.06, sx, 1.15, -13.6);
    }
    // Big status wall-screen on the west wall.
    this._pushBox('screen', 0.06, 1.2, 2.4, -53.68, 1.4, -7);
    // Sample tanks (colliders) + centre analysis table.
    this._pushCyl('metal', 0.55, 0.6, 2.4, 12, -52.6, 0, -2.6);
    this._boxCollider(1.2, 2.4, 1.2, -52.6, 0, -2.6);
    this._pushCyl('metal', 0.55, 0.6, 2.4, 12, -51.2, 0, -1.6);
    this._boxCollider(1.2, 2.4, 1.2, -51.2, 0, -1.6);
    this._solid('metal', 2.4, 1.0, 1.2, -45, 0, -7);
    this._pushBox('screen', 0.8, 0.05, 0.5, -45.5, 1.0, -7.1);
  }

  _buildCorridorAndDorm() {
    // Corridor tube linking hall (z -14) to dorm (z -18); interior 2.0 wide,
    // 2.6 clearance, with a rounded tube shell (decor) over the flat roof.
    this._solid('metal', 0.5, 2.6, 4.0, -47.95, 0, -16);
    this._solid('metal', 0.5, 2.6, 4.0, -45.45, 0, -16);
    this._solid('metal', 3.0, 0.25, 4.5, -46.7, 2.6, -16);
    // Shell centred low so the walkable interior sits inside it (backfaces
    // are culled, so from inside the tube is invisible).
    const tube = new THREE.CylinderGeometry(1.9, 1.9, 4.6, 12);
    scaleUV(tube, 3, 2);
    tube.rotateX(Math.PI / 2);
    tube.translate(-46.7, 1.2, -16);
    this._buckets.metal.push(tube);

    // Dorm, x -52..-42, z -26..-18, walls h 3.0.
    const H = 3.0, T = 0.5;
    // South wall: corridor opening x -47.7..-45.7 + lintel.
    this._wall(-49.85, -18, 4.3, T, H);
    this._wall(-43.85, -18, 3.7, T, H);
    this._wall(-46.7, -18, 2.0, T, 0.4, 2.6);
    // East wall: doorway z -23..-21.4 + lintel.
    this._wall(-42, -24.5, T, 3.0, H);
    this._wall(-42, -19.7, T, 3.4, H);
    this._wall(-42, -22.2, T, 1.6, 0.6, 2.4);
    this._wall(-52, -22, T, 8.5, H);   // west
    this._wall(-47, -26, 10.5, T, H);  // north
    this._solid('concrete', 10.5, 0.2, 8.5, -47, H, -22); // roof
    // Bunks (colliders) with upper berths (decor) + a locker.
    this._solid('metal', 0.9, 0.5, 2.0, -51.25, 0, -24.5);
    this._pushBox('metal', 0.9, 0.12, 2.0, -51.25, 1.15, -24.5);
    this._solid('metal', 0.9, 0.5, 2.0, -51.25, 0, -20.5);
    this._pushBox('metal', 0.9, 0.12, 2.0, -51.25, 1.15, -20.5);
    this._solid('metal', 0.7, 1.8, 0.6, -42.85, 0, -25.2);
  }

  _buildGarage() {
    // Garage, x -54..-44, z 3..13, walls h 3.6, wide vehicle door on the east.
    const H = 3.6, T = 0.5;
    this._wall(-44, 4, T, 2.0, H);
    this._wall(-44, 11, T, 4.0, H);
    this._wall(-44, 7, T, 4.0, 0.6, 3.0);   // lintel over the 4 m door
    // North wall: personnel door x -50..-48.6 + lintel.
    this._wall(-52, 3, 4.0, T, H);
    this._wall(-46.3, 3, 4.6, T, H);
    this._wall(-49.3, 3, 1.4, T, 1.2, 2.4);
    this._wall(-49, 13, 10.5, T, H);        // south
    this._wall(-54, 8, T, 10.5, H);         // west
    this._solid('concrete', 10.5, 0.2, 10.5, -49, H, 8); // roof
    // Drill rig prop: collider base, decor mast + crossarm + hanging bit.
    this._solid('metal', 2.4, 0.5, 2.4, -49.5, 0, 8.5);
    this._pushCyl('metal', 0.22, 0.26, 3.0, 8, -49.5, 0.5, 8.5);
    this._pushBox('metal', 1.8, 0.22, 0.3, -48.9, 2.7, 8.5);
    this._pushCyl('metal', 0.1, 0.16, 1.4, 6, -48.2, 0.6, 8.5);
    // Fuel drums (colliders) in the corner.
    this._pushCyl('metal', 0.42, 0.42, 1.0, 10, -52.8, 0, 11.8);
    this._boxCollider(0.9, 1.0, 0.9, -52.8, 0, 11.8);
    this._pushCyl('metal', 0.42, 0.42, 1.0, 10, -51.7, 0, 12.1);
    this._boxCollider(0.9, 1.0, 0.9, -51.7, 0, 12.1);
  }

  // ------------------------------------------------------------- watchtower

  _buildWatchtower() {
    // NW platform (top 6.8) on four legs; switchback stair: flight north at
    // x -42.5, mid landing (3.6), flight west at z -52 up to the deck.
    const cx = -52, cz = -52;
    for (const [lx, lz] of [[-54.4, -54.4], [-49.6, -54.4], [-54.4, -49.6], [-49.6, -49.6]]) {
      this._pushCyl('metal', 0.28, 0.34, 6.5, 8, lx, 0, lz);
      this._boxCollider(0.8, 6.5, 0.8, lx, 0, lz);
    }
    this._solid('metal', 6, 0.3, 6, cx, 6.5, cz);
    // Parapet (h 0.9); the east side leaves a gap where the stair arrives.
    this._solid('metal', 6, 0.9, 0.2, cx, 6.8, cz - 2.9);
    this._solid('metal', 6, 0.9, 0.2, cx, 6.8, cz + 2.9);
    this._solid('metal', 0.2, 0.9, 6, cx - 2.9, 6.8, cz);
    this._solid('metal', 0.2, 0.9, 1.8, cx + 2.9, 6.8, cz - 2.1);
    this._solid('metal', 0.2, 0.9, 1.8, cx + 2.9, 6.8, cz + 2.1);
    // Canopy (decor, out of reach).
    for (const [px, pz] of [[-54.6, -54.6], [-49.4, -54.6], [-54.6, -49.4], [-49.4, -49.4]]) {
      this._pushCyl('metal', 0.08, 0.08, 2.2, 6, px, 6.8, pz);
    }
    this._pushBox('metal', 6.4, 0.18, 6.4, cx, 9.0, cz);
    // Flight 1: 9 risers to 3.6, heading north.
    this._stairs('basaltS', 'z', -42.5, -50.8, 1, 0, 9, 1.6);
    // Mid landing (solid, top 3.6).
    this._solid('basaltS', 2.4, 3.6, 2.4, -42.5, 0, -51.9);
    // Flight 2: 8 risers from 3.6 to 6.8, heading west onto the deck
    // (treads sit east of the platform edge at x -49).
    this._stairs('basaltS', 'x', -52, -49, 1, 3.6, 8, 1.6);
  }

  // -------------------------------------------------- monitoring yard (S)

  _buildYard() {
    // Seismograph masts: instrument box (collider) + thin pole (decor) +
    // blinking strobe sphere on top (instanced, shared strobe material).
    const masts = [[-16, 46], [-9, 56], [-1, 61], [6, 45], [14, 57], [17, 63], [-14, 63]];
    for (const [mx, mz] of masts) {
      this._solid('metal', 0.7, 0.7, 0.7, mx, 0, mz);
      this._pushCyl('metal', 0.09, 0.12, 3.4, 6, mx, 0.7, mz);
      this._strobePts.push([mx, 4.18, mz]);
    }

    // Supply crates (instanced, colliders — hiding cover), one stacked pair.
    const crateGeo = new THREE.BoxGeometry(1, 1, 1);
    const crateMats = [];
    const crates = [
      [-6.5, 49.4, 0.95], [-5.3, 48.5, 0.75], [-7.1, 50.9, 0.8],
      [12, 61, 1.0], [13.3, 62.2, 0.85], [11.2, 62.9, 0.7],
      [-14, 58, 0.9], [6.2, 44.2, 0.8], [7.3, 45.1, 0.7],
      [28, 40, 0.9], [-18, 44, 0.85], [33, 64, 0.8]
    ];
    for (const [cx, cz, s] of crates) {
      crateMats.push(this._matrixAt(cx, s / 2, cz, 0, 0, 0, s, s, s));
      this._boxCollider(s, s, s, cx, 0, cz);
    }
    crateMats.push(this._matrixAt(-6.5, 0.95 + 0.4, 49.4, 0, 0, 0, 0.8, 0.8, 0.8));
    this._boxCollider(0.8, 0.8, 0.8, -6.5, 0.95, 49.4);
    this._makeInstanced(crateGeo, this._mats.crate, crateMats);

    // Tank farm: five big cylinders (colliders) + connecting pipes (decor).
    const tankGeo = new THREE.CylinderGeometry(1, 1.05, 1, 14);
    scaleUV(tankGeo, 2, 1.2);
    tankGeo.translate(0, 0.5, 0);
    const tankMats = [];
    const tanks = [[22, 46], [27, 50], [22, 54], [27, 58], [22, 62]];
    for (const [tx, tz] of tanks) {
      tankMats.push(this._matrixAt(tx, 0, tz, 0, this._rng() * Math.PI, 0, 2.0, 3.4, 2.0));
      this._boxCollider(3.4, 3.4, 3.4, tx, 0, tz);
    }
    this._makeInstanced(tankGeo, this._mats.tank, tankMats);
    this._pushBox('metal', 0.22, 0.22, 12, 24.5, 1.15, 54, 0.4);
    this._pushBox('metal', 5.6, 0.22, 0.22, 24.5, 1.5, 48, -0.6);
    this._pushCyl('metal', 0.18, 0.18, 0.7, 6, 24.5, 3.4, 54);
  }

  // ------------------------------------------------------- lava field (E)

  _buildLavaField() {
    // Boulders: instanced icosahedra; colliders only on the big ones.
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rocks = [
      [26, 2, 1.4], [31, -10, 1.1], [35, 10, 0.9], [42, -4, 1.6],
      [48, 4, 1.2], [50, 16, 1.5], [56, -6, 1.0], [60, 6, 1.8],
      [63, -16, 1.2], [58, 20, 0.9], [30, 20, 1.3], [65, 14, 1.0],
      [24, -16, 1.2], [58, -26, 1.4], [64, -40, 1.1], [-62, 20, 1.5],
      [-58, -30, 1.2], [-30, -60, 1.4], [10, -60, 1.6], [-64, 52, 1.1]
    ];
    for (const [x, z, s] of rocks) {
      this._scoriaMats.push(this._matrixAt(x, s * 0.7, z,
        this._rng() * Math.PI, this._rng() * Math.PI, this._rng() * Math.PI,
        s, s * 0.85, s));
      if (s >= 1.0) this._boxCollider(1.5 * s, 1.3 * s, 1.5 * s, x, 0, z);
    }
    this._makeInstanced(rockGeo, this._mats.boulder, this._scoriaMats);

    // Fumarole vents (low basalt cones, colliders) — steam puffs in update().
    this._vents = [[28, -6], [36, 4], [46, -2], [52, 10], [60, -12], [40, 18]];
    for (const [vx, vz] of this._vents) {
      this._pushCyl('basaltS', 0.25, 0.95, 0.7, 9, vx, 0, vz);
      this._boxCollider(1.4, 0.7, 1.4, vx, 0, vz);
    }

    // Emissive fissure strips (decor — free rotation is fine, no colliders).
    const fissures = [
      [30, 14, 6, 0.4], [44, 10, 7, -0.7], [52, -2, 5, 1.2], [60, 10, 8, 0.3],
      [36, -14, 6, 2.2], [26, -2, 4, 1.0], [56, 26, 5, 0.5], [-8, -40, 6, 0.9],
      [24, -24, 5, 0.7]
    ];
    for (const [fx, fz, len, yaw] of fissures) {
      this._pushBox('fissure', 0.5 + this._rng() * 0.4, 0.06, len, fx, 0.005, fz, yaw);
    }
  }

  // ------------------------------------------------- helipad checkpoint (SE)

  _buildHelipad() {
    // Landing pad (top 0.12 — police spawn here) with a painted H.
    this._pushCyl('concrete', 6, 6.2, 0.12, 22, 55, 0, 58);
    this._boxCollider(11.4, 0.12, 11.4, 55, 0, 58);
    this._pushBox('paint', 0.5, 0.02, 3.2, 53.9, 0.12, 58);
    this._pushBox('paint', 0.5, 0.02, 3.2, 56.1, 0.12, 58);
    this._pushBox('paint', 1.7, 0.02, 0.5, 55, 0.12, 58);
    // Edge strobes share the blinking strobe material.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this._strobePts.push([55 + Math.cos(a) * 5.5, 0.2, 58 + Math.sin(a) * 5.5]);
    }

    // Checkpoint hut, x 44.3..47.7, z 48.3..51.7, door on the east side.
    const H = 2.6, T = 0.4;
    this._wall(46, 48.3, 3.4, T, H);
    this._wall(46, 51.7, 3.4, T, H);
    this._wall(44.3, 50, T, 3.4, H);
    this._wall(47.7, 48.75, T, 0.9, H);
    this._wall(47.7, 51.25, T, 0.9, H);
    this._wall(47.7, 50, T, 1.6, 0.2, 2.4);
    this._solid('concrete', 3.8, 0.2, 3.8, 46, H, 50);
    this._solid('metal', 0.9, 0.9, 0.6, 45.1, 0, 49.1);
    // Barrier arm (decor) across the approach.
    this._pushCyl('metal', 0.09, 0.11, 1.1, 6, 48.5, 0, 53.5);
    this._pushBox('paint', 4.5, 0.13, 0.13, 50.7, 0.95, 53.5);

    // Strobe instances (masts + pad edge), all blinking together.
    const strobeGeo = new THREE.SphereGeometry(0.1, 8, 6);
    const strobeMats = [];
    for (const [sx, sy, sz] of this._strobePts) {
      strobeMats.push(this._matrixAt(sx, sy, sz, 0, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(strobeGeo, this._strobeMat, strobeMats, { cast: false });
  }

  // ---------------------------------------------------- embers + steam (fx)

  _buildEmbers() {
    // ~120 rising orange embers, wrapping upward: over the crater, along the
    // lava channels, and across the eastern lava field.
    const N = 120;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      let x, z, y0, range;
      if (i < 40) {          // crater column
        x = CONE_X + (this._rng() - 0.5) * 5;
        z = CONE_Z + (this._rng() - 0.5) * 5;
        y0 = 7.0; range = 9;
      } else if (i < 80) {   // lava channels
        if (this._rng() < 0.5) { x = 8.5 + this._rng() * 5; z = -19 + this._rng() * 48; }
        else { x = -68 + this._rng() * 80; z = 30.5 + this._rng() * 5; }
        y0 = -0.2; range = 5;
      } else {               // lava field fissures
        x = 24 + this._rng() * 42;
        z = -18 + this._rng() * 42;
        y0 = 0.1; range = 4;
      }
      this._embers.push({
        x, z, y0, range,
        speed: 0.5 + this._rng() * 0.9,
        phase: this._rng() * 40,
        sway: this._rng() * Math.PI * 2
      });
      pos[i * 3] = x; pos[i * 3 + 1] = y0; pos[i * 3 + 2] = z;
    }
    this._emberGeo = new THREE.BufferGeometry();
    this._emberGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xff8a2a, size: 0.14, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(this._emberGeo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  _buildSteam() {
    // Six puffs per fumarole, slowly rising and wrapping.
    const pos = new Float32Array(this._vents.length * 6 * 3);
    let i = 0;
    for (const [vx, vz] of this._vents) {
      for (let p = 0; p < 6; p++) {
        this._steam.push({
          x: vx + (this._rng() - 0.5) * 0.5,
          z: vz + (this._rng() - 0.5) * 0.5,
          speed: 0.35 + this._rng() * 0.35,
          phase: this._rng() * 10,
          sway: this._rng() * Math.PI * 2
        });
        pos[i * 3] = vx; pos[i * 3 + 1] = 0.8; pos[i * 3 + 2] = vz;
        i++;
      }
    }
    this._steamGeo = new THREE.BufferGeometry();
    this._steamGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xb9aca4, size: 1.0, transparent: true, opacity: 0.3,
      depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(this._steamGeo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: exactly 5, on the helipad checkpoint (pad top 0.12).
    this.policeSpawns = [
      v(55, 0.12, 58), v(52.5, 0.12, 55.5), v(57.5, 0.12, 55.5),
      v(52.5, 0.12, 60.5), v(57.5, 0.12, 60.5)
    ];
    this.monkeySpawns = [
      v(40, RIM_Y, -34.3),        // crater rim, south ring segment (y 8)
      v(38, 3.2, -49.8),          // volcano mid ring, tier-1 north ledge
      v(-50, 0, -5),              // inside the lab hall
      v(-46, 0, -22),             // dorm room
      v(-47, 0, 11),              // garage, beside the drill rig
      v(-40, 4.4, -7),            // lab roof deck
      v(-52, 6.8, -52),           // watchtower platform
      v(24.5, 0, 52),             // squeezed between the tank-farm cylinders
      v(-5, 0, 51),               // among the yard crates
      v(44, 0, 8),                // lava-field boulder cluster
      v(33, 0, 16),               // beside a glowing fissure strip
      v(11, -0.4, -6),            // wading in the N-S lava channel bed
      v(-48, -0.4, 33),           // by the E-W stepping blocks (wading)
      v(-30, -0.4, 33),           // hidden UNDER the E-W grate bridge
      v(-46.7, 0, -16)            // inside the corridor tube
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
          console.warn('[VolcanoLab] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    // 1) Lava flow — scroll the shared texture + pulse the emissive glow.
    if (this._lavaTex) {
      this._lavaTex.offset.y = (time * 0.045) % 1;
      this._lavaTex.offset.x = Math.sin(time * 0.4) * 0.03;
    }
    if (this._lavaMat) {
      this._lavaMat.emissiveIntensity = 1.1 + 0.25 * Math.sin(time * 2.1);
    }
    // 2) Crater flicker (faster, harsher than the river).
    if (this._craterMat) {
      this._craterMat.emissiveIntensity =
        1.25 + 0.3 * Math.sin(time * 5.3) + 0.15 * Math.sin(time * 13.7 + 2.1);
      if (this._craterMat.emissiveMap) {
        this._craterMat.emissiveMap.offset.x = (time * 0.02) % 1;
        this._craterMat.emissiveMap.offset.y = (time * 0.013) % 1;
      }
    }
    // 3) Fissure pulse.
    if (this._fissureMat) {
      this._fissureMat.emissiveIntensity = 0.8 + 0.45 * (0.5 + 0.5 * Math.sin(time * 1.7));
    }
    // 4) Console screen flicker (with occasional dropouts).
    if (this._screenMat) {
      const drop = Math.sin(time * 9.1) > 0.96 ? 0.25 : 1;
      this._screenMat.emissiveIntensity =
        (0.8 + 0.15 * Math.sin(time * 3.3) + 0.08 * Math.sin(time * 17.2)) * drop;
    }
    // 5) Blinking mast + helipad strobes (synced square-wave blink).
    if (this._strobeMat) {
      this._strobeMat.emissiveIntensity = (time % 1.4) < 0.18 ? 2.4 : 0.12;
    }
    // 6) Rising embers, wrapping upward.
    if (this._emberGeo) {
      const arr = this._emberGeo.attributes.position.array;
      for (let i = 0; i < this._embers.length; i++) {
        const e = this._embers[i];
        const life = (time * e.speed + e.phase) % e.range;
        arr[i * 3] = e.x + Math.sin(time * 0.8 + e.sway) * 0.4;
        arr[i * 3 + 1] = e.y0 + life;
        arr[i * 3 + 2] = e.z + Math.cos(time * 0.6 + e.sway) * 0.4;
      }
      this._emberGeo.attributes.position.needsUpdate = true;
    }
    // 7) Fumarole steam puffs.
    if (this._steamGeo) {
      const arr = this._steamGeo.attributes.position.array;
      for (let i = 0; i < this._steam.length; i++) {
        const p = this._steam[i];
        const life = (time * p.speed + p.phase) % 3.0;
        arr[i * 3] = p.x + Math.sin(time * 0.7 + p.sway) * (0.15 + life * 0.2);
        arr[i * 3 + 1] = 0.6 + life;
        arr[i * 3 + 2] = p.z + Math.cos(time * 0.5 + p.sway) * (0.15 + life * 0.2);
      }
      this._steamGeo.attributes.position.needsUpdate = true;
    }
  }
}
