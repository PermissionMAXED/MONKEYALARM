import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * BANANA SPACE CENTER — "A night launch site: rocket gantry, hangar and
 * mission control."
 *
 * Layout (144 x 144, sealed by chain-link fence + colliders at +/-71.4):
 * - Centre-north: raised concrete launch pad (steps at 0.4/0.7) carrying a
 *   tall cartoon rocket with a banana-yellow stripe and a gantry service
 *   tower: switchback stair flights, three walkable levels and two short
 *   bridges to the rocket (vertical hide spots).
 * - West: vehicle assembly hangar — enterable, with shelving rows, stacked
 *   crates and a catwalk along the west wall.
 * - East: glass-walled mission control with emissive console screens and a
 *   roof reached by an external stair.
 * - South-west: fuel tank farm (instanced tanks, decor-only pipe runs).
 * - South-east: sandy rover test yard with shallow (0.4 deep) craters,
 *   a rover prop and boulders.
 * - NE corner: rotating radar dish array. A crawlerway links pad and
 *   hangar; the main gate + security checkpoint (police spawns) sit at the
 *   south edge. Strobes blink, steam vents, screens flicker and one
 *   searchlight sweeps in update().
 */

const STEP_RISE = 0.4;           // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;            // stair tread depth
const PAD_X = 0;                 // launch pad centre
const PAD_Z = -34;               // pad spans x -15..15, z -49..-19
const PAD_TOP = 2;               // pad walking surface
const ROCKET_Z = -38;            // rocket centre (x 0)
const LVL = [4.4, 6.8, 9.2];     // gantry tower walkable levels

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

export default class SpaceCenterMap extends MapBase {
  constructor() {
    super();
    this.id = 'SPACE_CENTER';
    this.name = 'Banana Space Center';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-72, -5, -72),
      new THREE.Vector3(72, 60, 72)
    );
    this.killY = -15;
    this.environment = {
      skyColor: 0x0b1026,
      fog: { color: 0x0b1026, near: 30, far: 160 }
    };

    this._rng = mulberry32(0x5ace0b);
    this._dummy = new THREE.Object3D();
    this._dummy.rotation.order = 'YXZ'; // yaw first, then pitch (floodlights)
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = {
      apron: [], concrete: [], road: [], sand: [], metal: [], steel: [],
      white: [], yellow: [], hazard: [], glass: [], screen: [], strobe: [],
      fence: [], lamp: []
    };
    this._mats = null;
    this._dishes = [];
    this._puffs = [];
    this._searchPivot = null;
    // Populated in _buildLaunchPad, consumed in _buildCheckpoint; initialized
    // here so a build-call reordering can't throw on an undefined list.
    this._crateList = [];
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns();
    this._buildLights();
    this._buildGround();
    this._buildPerimeter();
    this._buildLaunchPad();
    this._buildRocket();
    this._buildGantry();
    this._buildHangar();
    this._buildMissionControl();
    this._buildTankFarm();
    this._buildRoverYard();
    this._buildRadarArray();
    this._buildCheckpoint();
    this._buildFloodlights();
    this._buildSearchlight();
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

  _paintConcrete(ctx, size) {
    const rng = mulberry32(0xc0ffee);
    ctx.fillStyle = '#7d8389';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 650; i++) {
      const g = 110 + Math.floor(rng() * 50);
      ctx.fillStyle = `rgba(${g},${g + 3},${g + 6},${0.25 + rng() * 0.3})`;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng() * 3);
    }
    // expansion-joint seams
    ctx.strokeStyle = 'rgba(38,42,48,0.55)';
    ctx.lineWidth = 3;
    const cell = size / 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(size, i * cell);
      ctx.stroke();
    }
    // oil stains
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(24,26,30,${0.08 + rng() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 6 + rng() * 26, 5 + rng() * 18,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintAsphalt(ctx, size) {
    const rng = mulberry32(0xa5fa17);
    ctx.fillStyle = '#31363d';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 520; i++) {
      const g = 40 + Math.floor(rng() * 40);
      ctx.fillStyle = `rgba(${g},${g + 2},${g + 6},${0.3 + rng() * 0.3})`;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2.5, 1 + rng() * 2.5);
    }
    // faded tyre streaks
    ctx.strokeStyle = 'rgba(16,18,20,0.28)';
    ctx.lineWidth = 7;
    for (let i = 0; i < 4; i++) {
      const x = rng() * size;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (rng() - 0.5) * 30, size);
      ctx.stroke();
    }
  }

  _paintMetal(ctx, size) {
    const rng = mulberry32(0x33ee71);
    ctx.fillStyle = '#98a1aa';
    ctx.fillRect(0, 0, size, size);
    const cells = 4;
    const cw = size / cells;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const shade = Math.floor((rng() - 0.5) * 26);
        ctx.fillStyle = `rgb(${150 + shade},${158 + shade},${166 + shade})`;
        ctx.fillRect(c * cw + 2, r * cw + 2, cw - 4, cw - 4);
        // rivets
        ctx.fillStyle = 'rgba(60,66,74,0.8)';
        for (const [ox, oy] of [[6, 6], [cw - 8, 6], [6, cw - 8], [cw - 8, cw - 8]]) {
          ctx.beginPath();
          ctx.arc(c * cw + ox, r * cw + oy, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    // weathering streaks
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 24; i++) {
      ctx.fillRect(rng() * size, rng() * size, 2, 10 + rng() * 40);
    }
  }

  _paintHazard(ctx, size) {
    const rng = mulberry32(0x4aa2a2);
    ctx.fillStyle = '#e3b83a';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#1d1d18';
    for (let x = -size * 1.5; x < size * 1.5; x += 52) {
      ctx.fillRect(x, -size, 26, size * 2);
    }
    ctx.restore();
    // scuffs
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(90,84,60,${0.1 + rng() * 0.2})`;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 4, 1 + rng() * 2);
    }
  }

  _paintSand(ctx, size) {
    const rng = mulberry32(0x5a17d0);
    ctx.fillStyle = '#b09468';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 800; i++) {
      const t = rng();
      ctx.fillStyle = t < 0.5
        ? `rgba(${168 + rng() * 40},${142 + rng() * 34},${96 + rng() * 24},0.4)`
        : `rgba(${128 + rng() * 30},${106 + rng() * 26},${70 + rng() * 18},0.35)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 1 + rng() * 4, 1 + rng() * 2.5,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // pebbles + rover tracks
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = 'rgba(84,74,58,0.5)';
      ctx.beginPath();
      ctx.arc(rng() * size, rng() * size, 1 + rng() * 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(96,80,56,0.35)';
    ctx.lineWidth = 4;
    for (let i = 0; i < 3; i++) {
      const y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 20) {
        ctx.lineTo(x, y + Math.sin(x * 0.05 + i * 2) * 10);
      }
      ctx.stroke();
    }
  }

  _paintScreen(ctx, size) {
    const rng = mulberry32(0x0dda7a);
    ctx.fillStyle = '#071220';
    ctx.fillRect(0, 0, size, size);
    // grid
    ctx.strokeStyle = 'rgba(46,140,170,0.2)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= size; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
    }
    // telemetry traces
    const colors = ['rgba(96,240,150,0.9)', 'rgba(90,190,255,0.85)', 'rgba(255,196,70,0.85)'];
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = colors[k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      const base = size * (0.28 + k * 0.24);
      ctx.moveTo(0, base);
      for (let x = 0; x <= size; x += 8) {
        ctx.lineTo(x, base + Math.sin(x * (0.05 + k * 0.02) + k * 2) * 12 + (rng() - 0.5) * 6);
      }
      ctx.stroke();
    }
    // orbit plot
    ctx.strokeStyle = 'rgba(140,220,255,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(size * 0.5, size * 0.5, size * 0.34, size * 0.2, 0.5, 0, Math.PI * 2);
    ctx.stroke();
    // data blocks
    for (let i = 0; i < 14; i++) {
      const bright = rng();
      ctx.fillStyle = bright < 0.25
        ? 'rgba(255,90,90,0.85)'
        : `rgba(${90 + rng() * 60},${190 + rng() * 50},${140 + rng() * 80},0.8)`;
      ctx.fillRect(rng() * size, rng() * size, 6 + rng() * 16, 4 + rng() * 6);
    }
    // header bar
    ctx.fillStyle = 'rgba(255,205,60,0.9)';
    ctx.fillRect(0, 0, size, 8);
  }

  _paintChainlink(ctx, size) {
    ctx.clearRect(0, 0, size, size);
    ctx.strokeStyle = 'rgba(196,204,214,0.9)';
    ctx.lineWidth = 1.6;
    for (let d = -size; d <= size; d += 10) {
      ctx.beginPath();
      ctx.moveTo(d, 0);
      ctx.lineTo(d + size, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(d + size, 0);
      ctx.lineTo(d, size);
      ctx.stroke();
    }
  }

  _makeMaterials() {
    const concreteTex = this._canvasTex(256, (c, s) => this._paintConcrete(c, s));
    const asphaltTex = this._canvasTex(256, (c, s) => this._paintAsphalt(c, s));
    const metalTex = this._canvasTex(256, (c, s) => this._paintMetal(c, s));
    const hazardTex = this._canvasTex(128, (c, s) => this._paintHazard(c, s));
    const sandTex = this._canvasTex(256, (c, s) => this._paintSand(c, s));
    const screenTex = this._canvasTex(256, (c, s) => this._paintScreen(c, s));
    const chainTex = this._canvasTex(128, (c, s) => this._paintChainlink(c, s));

    const concrete = new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95 });
    this._mats = {
      apron: concrete,
      concrete,
      road: new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 1.0 }),
      sand: new THREE.MeshStandardMaterial({ map: sandTex, roughness: 1.0 }),
      metal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.55, metalness: 0.35 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x46505c, roughness: 0.5, metalness: 0.55 }),
      white: new THREE.MeshStandardMaterial({
        map: metalTex, color: 0xe9edf2, roughness: 0.5, metalness: 0.15
      }),
      yellow: new THREE.MeshStandardMaterial({
        color: 0xffc93c, roughness: 0.55, metalness: 0.15,
        emissive: 0x7a5a00, emissiveIntensity: 0.35
      }),
      hazard: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.7 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0xa8d4ff, transparent: true, opacity: 0.2, roughness: 0.12,
        metalness: 0.25, side: THREE.DoubleSide, depthWrite: false
      }),
      screen: new THREE.MeshStandardMaterial({
        map: screenTex, emissive: 0xffffff, emissiveMap: screenTex,
        emissiveIntensity: 0.9, color: 0x0a0f16, roughness: 0.4
      }),
      strobe: new THREE.MeshStandardMaterial({
        color: 0x2a0505, emissive: 0xff2d2d, emissiveIntensity: 2.5, roughness: 0.4
      }),
      fence: new THREE.MeshStandardMaterial({
        map: chainTex, transparent: true, alphaTest: 0.05,
        side: THREE.DoubleSide, roughness: 0.8, metalness: 0.4
      }),
      lamp: new THREE.MeshStandardMaterial({
        color: 0x1c232b, emissive: 0xcfe4ff, emissiveIntensity: 1.5
      }),
      // instanced-only materials
      tank: new THREE.MeshStandardMaterial({
        map: metalTex, color: 0xc2ccd4, roughness: 0.45, metalness: 0.5
      }),
      boulder: new THREE.MeshStandardMaterial({ map: sandTex, color: 0x8d8272, roughness: 1.0 }),
      dish: new THREE.MeshStandardMaterial({
        map: metalTex, color: 0xe4e9ee, roughness: 0.5, metalness: 0.25,
        side: THREE.DoubleSide
      })
    };
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

  /** Pushes a small strobe sphere (blinks via shared material in update()). */
  _pushStrobe(x, y, z, r = 0.16) {
    const g = new THREE.SphereGeometry(r, 6, 5);
    g.translate(x, y, z);
    this._buckets.strobe.push(g);
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

  _flushBuckets() {
    const noCast = new Set(['apron', 'road', 'sand', 'glass', 'screen', 'strobe', 'fence', 'lamp']);
    const noReceive = new Set(['glass', 'fence', 'strobe', 'lamp', 'screen']);
    for (const key of Object.keys(this._buckets)) {
      const list = this._buckets[key];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      list.length = 0;
      const mesh = new THREE.Mesh(merged, this._mats[key]);
      mesh.castShadow = !noCast.has(key);
      mesh.receiveShadow = !noReceive.has(key);
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
    // Cool moonlight — the single shadow caster.
    const moon = new THREE.DirectionalLight(0x9db8ff, 0.6);
    moon.position.set(55, 90, -50);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -85;
    moon.shadow.camera.right = 85;
    moon.shadow.camera.top = 85;
    moon.shadow.camera.bottom = -85;
    moon.shadow.camera.near = 10;
    moon.shadow.camera.far = 240;
    moon.shadow.bias = -0.0006;
    this.group.add(moon);
    this.group.add(moon.target);
    moon.target.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0x24365e, 0x0b0f18, 0.55);
    this.group.add(hemi);
    const amb = new THREE.AmbientLight(0x202a44, 0.55);
    this.group.add(amb);

    // A few point lights only — everything else glows via emissive materials.
    const padGlow = new THREE.PointLight(0xffd9a6, 1.1, 48, 2);
    padGlow.position.set(PAD_X, 10, PAD_Z - 2);
    this.group.add(padGlow);
    const gateGlow = new THREE.PointLight(0xbcd4ff, 0.9, 34, 2);
    gateGlow.position.set(0, 6.5, 64);
    this.group.add(gateGlow);
  }

  // ----------------------------------------------------------------- ground

  _buildGround() {
    // Walkable floor slabs (tops y = 0), the sandy rover yard (x 24..60,
    // z 28..60) carved out and rebuilt with two 0.4-deep crater cells.
    const slab = (bucket, w, d, cx, cz, top) => {
      const g = new THREE.BoxGeometry(w, 1.2, d);
      scaleUV(g, w / 7, d / 7);
      g.translate(cx, top - 0.6, cz);
      this._buckets[bucket].push(g);
      this._boxCollider(w, 1.2, d, cx, top - 1.2, cz);
    };
    slab('apron', 146, 101, 0, -22.5, 0);      // everything north of z 28
    slab('apron', 97, 45, -24.5, 50.5, 0);     // south-west
    slab('apron', 13, 45, 66.5, 50.5, 0);      // east strip
    slab('apron', 36, 13, 42, 66.5, 0);        // south strip below the yard
    // Rover yard sand, leaving two crater holes.
    slab('sand', 36, 6, 42, 31, 0);
    slab('sand', 6, 10, 27, 39, 0);
    slab('sand', 20, 10, 50, 39, 0);
    slab('sand', 36, 2, 42, 45, 0);
    slab('sand', 22, 8, 35, 50, 0);
    slab('sand', 6, 8, 57, 50, 0);
    slab('sand', 36, 6, 42, 57, 0);
    slab('sand', 10, 10, 35, 39, -0.4);        // crater A floor (0.4 deep)
    slab('sand', 8, 8, 50, 50, -0.4);          // crater B floor

    // Main road: checkpoint -> pad steps (decor).
    this._pushBox('road', 7, 0.05, 80, 0, 0.004, 24);
    // Crawlerway: pad west steps -> hangar main door (decor).
    this._pushBox('road', 29, 0.05, 7, -29.5, 0.004, PAD_Z);
    this._pushBox('road', 7, 0.05, 18.5, -44, 0.004, -25.2);
  }

  _buildPerimeter() {
    // Chain-link fence on a concrete curb; colliders seal the map at +/-71.4.
    for (const s of [-1, 1]) {
      this._pushBox('concrete', 145, 0.5, 0.6, 0, 0, s * 71.4);
      this._pushBox('concrete', 0.6, 0.5, 145, s * 71.4, 0, 0);
      this._pushBox('fence', 145, 4.2, 0.06, 0, 0.4, s * 71.4);
      this._pushBox('fence', 0.06, 4.2, 145, s * 71.4, 0.4, 0);
      this._boxCollider(145.6, 6, 1.2, 0, 0, s * 71.4);
      this._boxCollider(1.2, 6, 145.6, s * 71.4, 0, 0);
    }
    // Fence posts (instanced).
    const postGeo = new THREE.CylinderGeometry(0.09, 0.12, 4.8, 6);
    const postMats = [];
    for (let t = -69; t <= 69; t += 6) {
      postMats.push(this._matrixAt(t, 2.4, -71.4, 0, 0, 0, 1, 1, 1));
      postMats.push(this._matrixAt(-71.4, 2.4, t, 0, 0, 0, 1, 1, 1));
      postMats.push(this._matrixAt(71.4, 2.4, t, 0, 0, 0, 1, 1, 1));
      if (Math.abs(t) > 7.5) postMats.push(this._matrixAt(t, 2.4, 71.4, 0, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(postGeo, this._mats.steel, postMats, { cast: false });
  }

  // -------------------------------------------------------------- launch pad

  _buildLaunchPad() {
    // Raised concrete platform, top y = 2.
    this._solid('concrete', 30, 2, 30, PAD_X, 0, PAD_Z);
    // Hazard stripes along the pad edges (decor).
    this._pushBox('hazard', 30, 0.04, 0.9, PAD_X, 2.001, -19.5);
    this._pushBox('hazard', 30, 0.04, 0.9, PAD_X, 2.001, -48.5);
    this._pushBox('hazard', 0.9, 0.04, 28.2, -14.5, 2.001, PAD_Z);
    this._pushBox('hazard', 0.9, 0.04, 28.2, 14.5, 2.001, PAD_Z);
    // Scorch ring under the rocket (decor).
    this._pushCyl('road', 4.2, 4.2, 0.045, 22, PAD_X, PAD_TOP, ROCKET_Z);

    // Access steps: south (from the main road) and west (crawlerway).
    for (let i = 0; i < 4; i++) {
      const h = (i + 1) * STEP_RISE;
      this._solid('concrete', 8, h, STEP_RUN, PAD_X, 0, -19 + (3 - i) * STEP_RUN + 0.35);
      this._solid('concrete', STEP_RUN, h, 10, -15 - (3 - i) * STEP_RUN - 0.35, 0, PAD_Z);
    }

    // Lightning masts with red strobes.
    for (const mx of [-13, 13]) {
      this._pushCyl('steel', 0.1, 0.24, 15, 8, mx, PAD_TOP, -47);
      this._boxCollider(0.6, 15, 0.6, mx, PAD_TOP, -47);
      this._pushStrobe(mx, 17.3, -47, 0.18);
    }
    // Hold-down blocks around the rocket base.
    for (const [hx, hz] of [[-3.1, 0], [3.1, 0], [0, -3.1], [0, 3.1]]) {
      this._solid('steel', 0.8, 1.1, 0.8, PAD_X + hx, PAD_TOP, ROCKET_Z + hz);
    }
    // Supply crates on the pad corner (part of the shared crate batch is
    // ground-level; these two live on the pad).
    this._crateList = [
      // hangar interior
      [-32.6, 7.6, 0.95, 0], [-32.6, 7.6, 0.7, 0.95], [-33.9, 8.8, 0.8, 0],
      [-32.0, 9.5, 0.7, 0], [-35.6, -13.6, 0.9, 0], [-31.6, -13.9, 0.75, 0],
      [-51.5, 10.6, 0.85, 0],
      // checkpoint
      [-6.5, 60.5, 0.9, 0], [-7.7, 61.7, 0.7, 0],
      // launch pad corner
      [12.8, -21.5, 0.9, PAD_TOP], [11.6, -20.6, 0.7, PAD_TOP]
    ];
  }

  _buildRocket() {
    const rz = ROCKET_Z;
    // Stacked cylinders + nose cone; banana-yellow stripes and fins.
    this._pushCyl('steel', 2.35, 2.75, 1.4, 16, PAD_X, PAD_TOP, rz);   // engine skirt
    this._pushCyl('white', 2.2, 2.35, 10.2, 16, PAD_X, 3.4, rz);       // booster
    this._pushCyl('yellow', 2.26, 2.26, 1.8, 16, PAD_X, 8.2, rz);      // banana stripe
    this._pushCyl('white', 1.7, 2.2, 1.2, 16, PAD_X, 13.6, rz);        // adapter
    this._pushCyl('white', 1.7, 1.7, 3.6, 16, PAD_X, 14.8, rz);        // upper stage
    this._pushCyl('yellow', 1.74, 1.74, 0.7, 16, PAD_X, 16.4, rz);     // thin stripe
    const nose = new THREE.ConeGeometry(1.72, 4.2, 16);
    nose.translate(PAD_X, 20.5, rz);
    this._buckets.yellow.push(nose);
    this._pushStrobe(PAD_X, 22.75, rz, 0.15);
    // Glowing porthole facing the road (decor).
    const port = new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12);
    port.rotateX(Math.PI / 2);
    port.translate(PAD_X, 11.4, rz + 2.22);
    this._buckets.lamp.push(port);
    // Fins (axis-aligned, small colliders).
    this._solid('yellow', 1.5, 3.4, 0.38, PAD_X - 2.65, PAD_TOP, rz);
    this._solid('yellow', 1.5, 3.4, 0.38, PAD_X + 2.65, PAD_TOP, rz);
    this._solid('yellow', 0.38, 3.4, 1.5, PAD_X, PAD_TOP, rz - 2.65);
    this._solid('yellow', 0.38, 3.4, 1.5, PAD_X, PAD_TOP, rz + 2.65);
    // One AABB for the whole rocket body.
    this._boxCollider(4.8, 21, 4.8, PAD_X, PAD_TOP, rz);
  }

  // ------------------------------------------------------------ gantry tower

  _buildGantry() {
    const cx = 9, cz = ROCKET_Z; // footprint x 6..12, z -41..-35 (on the pad)
    // Corner columns.
    for (const px of [6.35, 11.65]) {
      for (const pz of [-40.65, -35.35]) {
        this._solid('steel', 0.7, 11.2, 0.7, px, PAD_TOP, pz);
        this._pushStrobe(px, 13.85, pz);
      }
    }
    // Crown beams.
    this._pushBox('steel', 6.7, 0.45, 0.7, cx, 13.2, -40.65);
    this._pushBox('steel', 6.7, 0.45, 0.7, cx, 13.2, -35.35);
    this._pushBox('steel', 0.7, 0.45, 6.7, 6.35, 13.2, cz);
    this._pushBox('steel', 0.7, 0.45, 6.7, 11.65, 13.2, cz);

    // Walkable platform levels.
    for (const top of LVL) this._solid('metal', 6, 0.3, 6, cx, top - 0.3, cz);

    // Cross-brace trusses (instanced decor; north/south/east faces only so
    // they never cross the rocket bridges on the west side).
    const braceGeo = new THREE.BoxGeometry(0.14, 3.6, 0.14);
    const braceMats = [];
    const heights = [3.8, 6.6, 9.4, 12.2];
    for (let i = 0; i < heights.length; i++) {
      const sign = i % 2 === 0 ? 1 : -1;
      braceMats.push(this._matrixAt(cx, heights[i], -40.65, 0, 0, sign * 0.72, 1, 1, 1));
      braceMats.push(this._matrixAt(cx, heights[i], -35.35, 0, 0, -sign * 0.72, 1, 1, 1));
      braceMats.push(this._matrixAt(11.65, heights[i], cz, sign * 0.72, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(braceGeo, this._mats.steel, braceMats, { cast: false });

    // Switchback stair flights in two lanes east of the tower.
    // Lane A (x 12..13.7): pad -> L1 and L2 -> L3. Lane B (x 13.7..15.4): L1 -> L2.
    const tread = (x, z, top) => this._solid('metal', 1.7, 0.22, 0.7, x, top - 0.22, z);
    for (let i = 0; i < 6; i++) {
      const zC = -40.5 + (i + 0.5) * STEP_RUN;
      tread(12.85, zC, PAD_TOP + (i + 1) * STEP_RISE);   // flight 1 (up, northward)
      tread(12.85, zC, LVL[1] + (i + 1) * STEP_RISE);    // flight 3 (up, northward)
    }
    for (let i = 0; i < 6; i++) {
      const zC = -36.3 - (i + 0.5) * STEP_RUN;
      tread(14.55, zC, LVL[0] + (i + 1) * STEP_RISE);    // flight 2 (up, southward)
    }
    // Landings joining the lanes (L1 at the south end, L2 at the north end).
    this._solid('metal', 3.4, 0.25, 1.5, 13.7, LVL[0] - 0.25, -35.55);
    // The NE column (x 11.3..12, z -41..-40.3) plus the flight-3 treads used
    // to block the whole landing->platform crossing at the 6.8 level, so the
    // L2 landing extends one metre further north and an L-shaped walkway
    // (x 10.4..12, z -42..-41, abutting the platform edge at z -41) wraps
    // around the column: clear flat lanes z -42..-41 (1.0 wide) then
    // x 10.4..11.3 (0.9 wide), no jump or auto-step needed.
    this._solid('metal', 3.4, 0.25, 1.8, 13.7, LVL[1] - 0.25, -41.1);
    this._solid('metal', 1.6, 0.25, 1.0, 11.2, LVL[1] - 0.25, -41.5);
    // Landing support legs (decor). The x 15.1 legs hang past the pad edge
    // (pad ends at x 15), so those drop to the apron at y 0 instead.
    for (const [sx, sz] of [[13.0, -35.2], [15.1, -35.2], [13.0, -41.2], [15.1, -41.2]]) {
      const legBase = sx > 15 ? 0 : PAD_TOP;
      this._pushCyl('steel', 0.08, 0.08, 8.4 - legBase, 6, sx, legBase, sz);
    }
    this._pushCyl('steel', 0.08, 0.08, 4.55, 6, 10.8, PAD_TOP, -41.6); // walkway leg
    // Simple guard rails (decor). The L2 north rail stops short of the
    // walkway crossing (x >= 10.2) so players don't clip through it.
    for (const top of LVL) {
      if (top === LVL[1]) {
        this._pushBox('steel', 4.2, 0.08, 0.08, 8.1, top + 1.0, -40.95);
      } else {
        this._pushBox('steel', 6, 0.08, 0.08, cx, top + 1.0, -40.95);
      }
      this._pushBox('steel', 6, 0.08, 0.08, cx, top + 1.0, -35.05);
    }

    // Short bridges linking tower and rocket at L2 and L3 (hide spots).
    for (const top of [LVL[1], LVL[2]]) {
      this._solid('metal', 4.6, 0.25, 1.7, 3.9, top - 0.25, cz);
      this._pushBox('yellow', 4.6, 0.12, 0.1, 3.9, top + 0.85, cz - 0.85);
      this._pushBox('yellow', 4.6, 0.12, 0.1, 3.9, top + 0.85, cz + 0.85);
      for (const bx of [2.2, 5.6]) {
        this._pushBox('steel', 0.07, 0.9, 0.07, bx, top, cz - 0.85);
        this._pushBox('steel', 0.07, 0.9, 0.07, bx, top, cz + 0.85);
      }
    }
    // Umbilical arm near the top (decor).
    this._pushBox('steel', 3.8, 0.35, 0.5, 4.1, 12.0, cz);
  }

  // ---------------------------------------------------------------- hangar

  _buildHangar() {
    // Vehicle assembly hangar, x -58..-30, z -16..12, walls h 10.
    const H = 10;
    // West wall (full).
    this._solid('metal', 0.8, H, 28.8, -58, 0, -2);
    // North wall: big vehicle door gap x -48..-40 (crawlerway side).
    this._solid('metal', 10.4, H, 0.8, -53.2, 0, -16);
    this._solid('metal', 10.4, H, 0.8, -34.8, 0, -16);
    this._solid('metal', 8, 3, 0.8, -44, 7, -16);          // door header
    // South wall: personnel door gap x -36..-33.
    this._solid('metal', 22.4, H, 0.8, -47.2, 0, 12);
    this._solid('metal', 3.4, H, 0.8, -31.3, 0, 12);
    this._solid('metal', 3, 7.4, 0.8, -34.5, 2.6, 12);
    // East wall: personnel door gap z -6..-2 (faces the pad).
    this._solid('metal', 0.8, H, 10.4, -30, 0, -11.2);
    this._solid('metal', 0.8, H, 14.4, -30, 0, 5.2);
    this._solid('metal', 0.8, 7.4, 4, -30, 2.6, -4);
    // Roof.
    this._solid('metal', 30, 0.5, 30, -44, H, -2);
    // Big-door hazard trim + sign (decor).
    this._pushBox('hazard', 0.4, 7, 0.15, -48.3, 0, -16.5);
    this._pushBox('hazard', 0.4, 7, 0.15, -39.7, 0, -16.5);
    this._pushBox('yellow', 6, 1.2, 0.2, -44, 7.6, -16.5);
    // Ceiling light strips (emissive decor).
    for (const lx of [-52, -44, -36]) {
      this._pushBox('lamp', 5, 0.1, 0.6, lx, 9.2, -2);
    }

    // Shelving rows (collider per unit, clutter boxes on the boards).
    const shelf = (cxS, czS) => {
      for (const ex of [-2.44, 2.44]) {
        this._pushBox('metal', 0.12, 2.3, 1.25, cxS + ex, 0, czS);
      }
      for (const y of [0.55, 1.25, 1.95]) {
        this._pushBox('metal', 5, 0.08, 1.25, cxS, y, czS);
      }
      this._boxCollider(5, 2.3, 1.3, cxS, 0, czS);
      const n = 3 + Math.floor(this._rng() * 3);
      for (let i = 0; i < n; i++) {
        const bx = cxS + (this._rng() - 0.5) * 4.4;
        const lvl = [0.63, 1.33, 2.03][Math.floor(this._rng() * 3)];
        const s = 0.3 + this._rng() * 0.35;
        this._pushBox(this._rng() < 0.4 ? 'yellow' : 'hazard',
          s, s, s, bx, lvl, czS, this._rng() * 0.6);
      }
    };
    for (const czS of [-10, 0]) {
      for (const cxS of [-52, -45, -38]) shelf(cxS, czS);
    }

    // Catwalk along the west wall (deck top y 4), reached by a stair flight.
    for (let i = 0; i < 10; i++) {
      const zC = 8.75 - i * STEP_RUN;
      this._solid('metal', 1.8, 0.22, 0.7, -56.5, (i + 1) * STEP_RISE - 0.22, zC);
    }
    this._solid('metal', 1.8, 0.3, 17.3, -56.5, 3.7, -6.55);
    this._pushBox('steel', 0.08, 0.9, 17.3, -55.68, 4.0, -6.55); // rail (decor)
    for (const pz of [-14, -8, -2]) {
      this._pushCyl('steel', 0.1, 0.1, 3.7, 6, -56.5, 0, pz);    // legs (decor)
    }
  }

  // --------------------------------------------------------- mission control

  _buildMissionControl() {
    // Glass-walled control room, x 30..52, z -12..10, roof top y 4.5.
    const wall = (cxW, czW, w, d) => {
      this._pushBox('concrete', w, 0.7, d, cxW, 0, czW);
      this._pushBox('glass', Math.max(w - 0.15, 0.35), 3.0, Math.max(d - 0.15, 0.35),
        cxW, 0.7, czW);
      this._pushBox('metal', w, 0.5, d, cxW, 3.7, czW);
      this._boxCollider(w, 4.2, d, cxW, 0, czW);
    };
    // West face (door gap z -3..1, facing the pad road).
    wall(30, -7.5, 0.6, 9);
    wall(30, 5.5, 0.6, 9);
    this._solid('metal', 0.6, 1.6, 4, 30, 2.6, -1);
    // East face (door gap z 0..3).
    wall(52, -6, 0.6, 12);
    wall(52, 6.5, 0.6, 7);
    this._solid('metal', 0.6, 1.6, 3, 52, 2.6, 1.5);
    // North + south faces (full).
    wall(41, -12, 22.6, 0.6);
    wall(41, 10, 22.6, 0.6);
    // Mullion columns (decor).
    for (const mx of [34, 38, 44, 48]) {
      this._pushBox('steel', 0.16, 3.0, 0.7, mx, 0.7, -12);
      this._pushBox('steel', 0.16, 3.0, 0.7, mx, 0.7, 10);
    }
    // Roof slab + parapet (south parapet leaves a gap for the stair).
    this._solid('metal', 23.2, 0.3, 23.2, 41, 4.2, -1);
    this._pushBox('metal', 23.2, 0.5, 0.4, 41, 4.5, -12.4);
    this._pushBox('metal', 0.4, 0.5, 23.2, 29.6, 4.5, -1);
    this._pushBox('metal', 0.4, 0.5, 23.2, 52.4, 4.5, -1);
    this._pushBox('metal', 8.6, 0.5, 0.4, 33.9, 4.5, 10.4);
    // Roof AC units (hide cover).
    this._solid('metal', 1.6, 1.1, 1.6, 37, 4.5, -5);
    this._solid('metal', 1.6, 1.1, 1.6, 46, 4.5, 2);
    // External stair to the roof, along the south face.
    for (let i = 0; i < 11; i++) {
      const xC = 33.35 + i * STEP_RUN;
      this._solid('metal', 0.7, 0.22, 1.7, xC, (i + 1) * STEP_RISE - 0.22, 11.15);
    }
    this._pushBox('steel', 8.4, 0.08, 0.08, 37.2, 2.6, 12.05); // handrail (decor)

    // Console desks with emissive screens, facing the big wall display.
    for (const czD of [-6, -1, 4]) {
      for (const cxD of [35.5, 46.5]) {
        this._solid('metal', 6, 0.75, 1.5, cxD, 0, czD);
        for (const mx of [-1.9, 0, 1.9]) {
          this._pushBox('screen', 1.15, 0.7, 0.07, cxD + mx, 0.85, czD - 0.4,
            (this._rng() - 0.5) * 0.4);
        }
        this._pushBox('steel', 0.55, 0.5, 0.55, cxD - 1.3, 0, czD + 1.25); // chairs
        this._pushBox('steel', 0.55, 0.5, 0.55, cxD + 1.3, 0, czD + 1.25);
      }
    }
    // Main wall display + interior light strips.
    this._pushBox('screen', 14, 3.0, 0.15, 41, 0.9, -11.55);
    for (const lx of [35, 41, 47]) {
      this._pushBox('lamp', 4, 0.07, 0.4, lx, 4.0, -3);
    }
  }

  // -------------------------------------------------------------- tank farm

  _buildTankFarm() {
    // Fat fuel tanks (instanced) inside a low containment bund (0.44 high,
    // auto-steppable). Pipes and valves are decor only.
    this._solid('concrete', 26.8, 0.44, 0.4, -43, 0, 32);
    this._solid('concrete', 26.8, 0.44, 0.4, -43, 0, 56);
    this._solid('concrete', 0.4, 0.44, 24.0, -56.2, 0, 44);
    this._solid('concrete', 0.4, 0.44, 24.0, -29.8, 0, 44);

    const tankGeo = new THREE.CylinderGeometry(2.6, 2.6, 7, 16);
    scaleUV(tankGeo, 3, 2);
    const domeGeo = new THREE.SphereGeometry(2.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const tankMats = [], domeMats = [];
    const tanks = [];
    for (const tz of [38, 48]) {
      for (const tx of [-52, -44, -36]) tanks.push([tx, tz]);
    }
    for (const [tx, tz] of tanks) {
      tankMats.push(this._matrixAt(tx, 3.5, tz, 0, this._rng() * Math.PI, 0, 1, 1, 1));
      domeMats.push(this._matrixAt(tx, 7, tz, 0, 0, 0, 1, 0.55, 1));
      this._boxCollider(5.2, 7.6, 5.2, tx, 0, tz);
    }
    this._makeInstanced(tankGeo, this._mats.tank, tankMats);
    this._makeInstanced(domeGeo, this._mats.tank, domeMats);

    // Pipe runs (decor, collider-less): row manifolds, risers, a cross-link
    // and one line running out toward the pad. Horizontal runs sit at
    // pipe-rack height (centre y 2.2, bottom 1.92) so a 1.8-tall player
    // walks under them instead of clipping through waist-high tubes; the
    // tank risers (y 0..2) double as rack stands and the raised runs get
    // their own vertical stands.
    const pipeGeo = new THREE.CylinderGeometry(0.28, 0.28, 1, 8);
    const pipeMats = [];
    const pipeY = 2.2;
    pipeMats.push(this._matrixAt(-44, pipeY, 38 - 2.9, 0, 0, Math.PI / 2, 1, 22, 1));
    pipeMats.push(this._matrixAt(-44, pipeY, 48 - 2.9, 0, 0, Math.PI / 2, 1, 22, 1));
    pipeMats.push(this._matrixAt(-33, pipeY, 40.1, Math.PI / 2, 0, 0, 1, 10, 1));
    pipeMats.push(this._matrixAt(-26, pipeY, 23, Math.PI / 2, 0, 0, 1, 18, 1));
    for (const sz of [16, 23, 30]) {
      pipeMats.push(this._matrixAt(-26, 1.1, sz, 0, 0, 0, 1, 2.2, 1)); // apron stands
    }
    pipeMats.push(this._matrixAt(-33, 1.1, 40.1, 0, 0, 0, 1, 2.2, 1)); // cross-link stand
    for (const [tx, tz] of tanks) {
      pipeMats.push(this._matrixAt(tx, 1.0, tz - 2.9, 0, 0, 0, 1, 2, 1));
    }
    this._makeInstanced(pipeGeo, this._mats.steel, pipeMats, { cast: false });

    // Valve boxes + handwheels (decor clutter).
    const valveGeo = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const wheelGeo = new THREE.TorusGeometry(0.22, 0.055, 6, 10);
    const valveMats = [], wheelMats = [];
    for (const [tx, tz] of tanks) {
      valveMats.push(this._matrixAt(tx + 0.9, 0.85, tz - 2.9, 0, 0, 0, 1, 1, 1));
      wheelMats.push(this._matrixAt(tx + 0.9, 1.2, tz - 2.9, Math.PI / 2, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(valveGeo, this._mats.yellow, valveMats, { cast: false });
    this._makeInstanced(wheelGeo, this._mats.hazard, wheelMats, { cast: false });
  }

  // ------------------------------------------------------------- rover yard

  _buildRoverYard() {
    // Crater rims (decor tori over the carved crater cells). They have no
    // colliders, so they are sunk to show only 0.4 above the sand (within
    // the 0.45 auto-step) and reading as walk-over humps rather than
    // solid-looking rings players clip through.
    const rimA = new THREE.TorusGeometry(5.3, 0.35, 8, 22);
    rimA.rotateX(Math.PI / 2);
    rimA.translate(35, 0.05, 39);
    this._buckets.sand.push(rimA);
    const rimB = new THREE.TorusGeometry(4.3, 0.35, 8, 20);
    rimB.rotateX(Math.PI / 2);
    rimB.translate(50, 0.05, 50);
    this._buckets.sand.push(rimB);

    // Small test rover prop (one collider).
    const rx = 40, rzR = 51;
    this._pushBox('white', 2.6, 0.8, 1.6, rx, 0.5, rzR);
    this._pushBox('screen', 1.8, 0.06, 1.2, rx, 1.32, rzR);       // solar deck
    this._pushCyl('steel', 0.06, 0.06, 1.1, 6, rx - 0.9, 1.3, rzR);
    this._pushBox('white', 0.36, 0.3, 0.3, rx - 0.9, 2.4, rzR);   // camera head
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
    for (const wx of [rx - 0.95, rx, rx + 0.95]) {
      for (const s of [-1, 1]) {
        const w = wheelGeo.clone();
        w.rotateZ(Math.PI / 2);
        w.translate(wx, 0.42, rzR + s * 0.95);
        this._buckets.steel.push(w);
      }
    }
    wheelGeo.dispose();
    this._boxCollider(3.4, 1.6, 2.6, rx, 0, rzR);

    // Boulders (instanced; colliders on the big ones).
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rockMats = [];
    const rocks = [
      [28, 57, 1.3], [56, 36, 1.5], [57, 57, 1.0], [30, 45, 0.8],
      [47, 31, 0.9], [26, 36, 0.7], [44, 58.5, 0.85], [58.5, 44, 1.1]
    ];
    for (const [x, z, s] of rocks) {
      rockMats.push(this._matrixAt(x, s * 0.68, z,
        this._rng() * Math.PI, this._rng() * Math.PI, this._rng() * Math.PI,
        s, s * 0.8, s));
      if (s >= 0.9) this._boxCollider(1.5 * s, 1.3 * s, 1.5 * s, x, 0, z);
    }
    this._makeInstanced(rockGeo, this._mats.boulder, rockMats);
  }

  // ------------------------------------------------------------ radar array

  _buildRadarArray() {
    const dishes = [[46, -52, 0.30, 0.0], [56, -46, 0.45, 2.1], [52, -60, 0.22, 4.2]];
    for (const [x, z, speed, yaw] of dishes) {
      this._pushCyl('steel', 0.4, 0.55, 5.4, 10, x, 0, z);
      this._boxCollider(1.1, 5.4, 1.1, x, 0, z);
      // Side-mounted beacon just below the mast top (mast radius ~0.41
      // there). It can't sit on the axis: the yoke box (half-width 0.35,
      // y 5.4..6.2, corner sweep radius ~0.5 as the head yaws) rests
      // directly on the mast top, so an axial strobe stays hidden.
      this._pushStrobe(x, 5.18, z + 0.45, 0.13);

      const head = new THREE.Group();
      head.position.set(x, 5.7, z);
      const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.7), this._mats.steel);
      yoke.position.y = 0.1;
      yoke.castShadow = true;
      head.add(yoke);
      const tilt = new THREE.Group();
      tilt.position.y = 0.55;
      tilt.rotation.x = -0.95;
      const bowlGeo = new THREE.SphereGeometry(2.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.6);
      bowlGeo.rotateX(Math.PI); // opening up
      const bowl = new THREE.Mesh(bowlGeo, this._mats.dish);
      bowl.position.y = 0.7;
      bowl.castShadow = true;
      tilt.add(bowl);
      const feed = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6), this._mats.steel);
      feed.position.y = 1.3;
      tilt.add(feed);
      const horn = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), this._mats.yellow);
      horn.position.y = 2.15;
      tilt.add(horn);
      head.add(tilt);
      this.group.add(head);
      this._dishes.push({ head, speed, yaw });
    }
    // Equipment cabin with a glowing door lamp.
    this._solid('concrete', 2.2, 2.3, 2.2, 49, 0, -57);
    this._pushBox('metal', 0.9, 1.7, 0.08, 49, 0, -55.92);
    this._pushBox('lamp', 0.5, 0.14, 0.1, 49, 1.9, -55.9);
  }

  // ------------------------------------------------- checkpoint + main gate

  _buildCheckpoint() {
    // Closed main gate in the south fence (map stays sealed).
    this._pushBox('hazard', 12.4, 4.4, 0.25, 0, 0.3, 71.0);
    this._pushCyl('steel', 0.2, 0.2, 5, 8, -6.4, 0, 71.0);
    this._pushCyl('steel', 0.2, 0.2, 5, 8, 6.4, 0, 71.0);
    // Overhead sign gantry across the road.
    for (const sx of [-8, 8]) {
      this._pushCyl('steel', 0.22, 0.3, 6, 8, sx, 0, 66);
      this._boxCollider(0.8, 6, 0.8, sx, 0, 66);
    }
    this._pushBox('steel', 16.4, 0.5, 0.5, 0, 5.5, 66);
    this._pushBox('yellow', 11, 1.5, 0.18, 0, 4.2, 66);
    this._pushBox('lamp', 10, 0.08, 0.24, 0, 5.8, 66);
    // Guard hut with a glowing window.
    this._solid('concrete', 3.2, 2.7, 3.2, -9.5, 0, 65.5);
    this._pushBox('metal', 3.8, 0.25, 3.8, -9.5, 2.7, 65.5);
    this._pushBox('lamp', 0.06, 0.8, 1.4, -7.86, 1.2, 65.5);
    // Barrier arm across the road (decor — the arm is up-gameplay passable).
    this._pushCyl('steel', 0.12, 0.14, 1.3, 6, -6.8, 0, 63);
    this._pushBox('hazard', 6.6, 0.16, 0.16, -3.5, 1.05, 63);
    // Jersey barriers funnelling traffic (colliders, hide cover).
    for (const [bx, bz] of [[-4, 62], [4, 62], [-8.5, 59.5], [8.5, 59.5]]) {
      this._solid('hazard', 2.2, 1.0, 0.7, bx, 0, bz);
    }

    // Shared crate batch (hangar + checkpoint + pad), instanced.
    const crateGeo = new THREE.BoxGeometry(1, 1, 1);
    const crateMats = [];
    for (const [x, z, s, y0] of this._crateList) {
      crateMats.push(this._matrixAt(x, y0 + s / 2, z, 0, 0, 0, s, s, s));
      this._boxCollider(s, s, s, x, y0, z);
    }
    this._makeInstanced(crateGeo, this._mats.metal, crateMats);
  }

  // ------------------------------------------------- floodlights and beams

  _buildFloodlights() {
    const spots = [
      [-24, -64], [24, -64], [-64, -24], [-64, 26], [64, -24],
      [64, 26], [-26, 64], [26, 64], [-20, -16], [22, -52]
    ];
    const poleGeo = new THREE.CylinderGeometry(0.22, 0.3, 9, 8);
    const headGeo = new THREE.BoxGeometry(1.35, 0.45, 0.75);
    const poleMats = [], headMats = [];
    for (const [x, z] of spots) {
      poleMats.push(this._matrixAt(x, 4.5, z, 0, 0, 0, 1, 1, 1));
      this._boxCollider(0.9, 9, 0.9, x, 0, z);
      const yaw = Math.atan2(-x, -z);
      headMats.push(this._matrixAt(x, 8.85, z, 0.5, yaw, 0, 1, 1, 1));
    }
    this._makeInstanced(poleGeo, this._mats.steel, poleMats);
    this._makeInstanced(headGeo, this._mats.lamp, headMats, { cast: false });
  }

  _buildSearchlight() {
    // One sweeping searchlight on a mast between road and pad.
    const px = 20, pz = -18;
    this._pushCyl('steel', 0.18, 0.28, 10.6, 8, px, 0, pz);
    this._boxCollider(0.8, 10.6, 0.8, px, 0, pz);
    this._pushBox('lamp', 0.9, 0.7, 0.9, px, 10.6, pz);

    const pivot = new THREE.Group();
    pivot.position.set(px, 10.9, pz);
    const beamGeo = new THREE.ConeGeometry(4.5, 22, 14, 1, true);
    beamGeo.translate(0, -11, 0); // apex at the pivot
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({
      color: 0xf5efd0, transparent: true, opacity: 0.11,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    }));
    beam.rotation.x = 0.65;
    beam.castShadow = false;
    pivot.add(beam);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff6d8 }));
    pivot.add(lens);
    this.group.add(pivot);
    this._searchPivot = pivot;
  }

  // ------------------------------------------------------------ steam vents

  _buildSteam() {
    // Pooled venting puffs cycling at the rocket base (animated in update()).
    const puffGeo = new THREE.SphereGeometry(1, 8, 6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const mat = new THREE.MeshBasicMaterial({
        color: 0xd8e2ea, transparent: true, opacity: 0, depthWrite: false
      });
      const mesh = new THREE.Mesh(puffGeo, mat);
      mesh.castShadow = false;
      const ox = Math.cos(a) * (2.6 + this._rng() * 0.8);
      const oz = Math.sin(a) * (2.6 + this._rng() * 0.8);
      mesh.position.set(PAD_X + ox, PAD_TOP + 0.3, ROCKET_Z + oz);
      this.group.add(mesh);
      this._puffs.push({ mesh, mat, phase: this._rng(), ox, oz });
    }
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: security checkpoint just inside the main gate.
    this.policeSpawns = [
      v(0, 0, 66), v(-3, 0, 64), v(3, 0, 64),
      v(-6, 0, 67), v(6, 0, 67), v(0, 0, 61.5)
    ];
    // Monkeys: every zone, ground/platform FEET positions.
    this.monkeySpawns = [
      v(9, LVL[2], -38),        // gantry top platform (L3)
      v(4, LVL[1], -38),        // rocket bridge at L2
      v(0, PAD_TOP, -44.5),     // launch pad, behind the rocket
      v(9, PAD_TOP, -39),       // under the gantry tower
      v(-56.5, 4, -8),          // hangar catwalk
      v(-46, 0, -12.5),         // hangar, behind the shelf row
      v(-33, 0, 3),             // hangar SE corner near the crates
      v(48, 0, 7),              // mission control, behind the back desks
      v(46, 4.5, -6),           // mission control roof
      v(-48, 0, 43),            // tank farm, between the rows
      v(-32, 0, 54),            // tank farm bund corner
      v(35, -0.4, 39),          // inside crater A
      v(53.5, 0, 39),           // rover yard, by the big boulder
      v(37.5, 0, 51),           // behind the rover
      v(51, 0, -53),            // radar dish array
      v(-20, 0, -66)            // north fence shadow, by a floodlight
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
          console.warn('[SpaceCenterMap] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    // 1) Blinking red gantry/mast strobes (shared emissive material).
    if (this._mats) {
      this._mats.strobe.emissiveIntensity = (time % 1.4) < 0.18 ? 3.2 : 0.12;
      // 2) Console screens flicker.
      this._mats.screen.emissiveIntensity =
        0.85 + 0.14 * Math.sin(time * 12.7) + 0.07 * Math.sin(time * 47.3 + 1.3);
    }
    // 3) Rotating radar dishes.
    for (const d of this._dishes) {
      d.head.rotation.y = d.yaw + time * d.speed;
    }
    // 4) Venting steam puffs at the rocket base (pooled meshes).
    for (const p of this._puffs) {
      const t = (time * 0.16 + p.phase) % 1;
      const spread = 1 + t * 0.7;
      p.mesh.position.set(
        PAD_X + p.ox * spread,
        PAD_TOP + 0.3 + t * 5.2,
        ROCKET_Z + p.oz * spread
      );
      const s = 0.55 + t * 2.3;
      p.mesh.scale.set(s, s * 0.8, s);
      p.mat.opacity = 0.34 * (1 - t) * Math.min(1, t * 8);
    }
    // 5) Sweeping searchlight cone.
    if (this._searchPivot) this._searchPivot.rotation.y = time * 0.42;
  }
}
