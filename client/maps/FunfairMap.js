import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * BANANA FUNFAIR — "A night carnival lit by strings of golden bulbs."
 *
 * Layout (144 x 144, sealed by carnival hoarding walls at +/-71):
 * - South: entrance arch + ticket booths — the police spawn plaza.
 * - A neon midway (x -8..8) runs north from the entrance, lined with
 *   enterable game stalls, string-light poles and the high-striker tower.
 * - North end: the ferris wheel (rotating wheel + upright cabins are pure
 *   decor) behind a fenced boarding platform and a queue-rail maze.
 * - West: carousel with rotating canopy and bobbing horses on a solid
 *   plinth; NW: bumper-car pavilion with a raised rink under a roof.
 * - East: a closed decorative roller-coaster loop with a 4-car train and
 *   a boarding station you can hide on AND under; SE: food court with
 *   snack booths, picnic tables and a giant emissive banana-split statue.
 * - SW: enterable funhouse mini-maze with dead-end nooks and a roof deck.
 * - All colliders are STATIC world AABBs; every moving part (wheel,
 *   cabins, train, canopy, horses, confetti) is collider-free decor.
 */

const STEP_RISE = 0.4;           // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;            // stair tread depth
const WHEEL_HUB_Y = 16;          // ferris wheel hub height
const WHEEL_R = 12.4;            // ferris wheel radius
const WHEEL_Z = -40;             // ferris wheel plane
const CABIN_COUNT = 10;
const WHEEL_SPEED = 0.16;        // rad/s
const CAR_X = -35;               // carousel centre
const CAR_Z = 10;

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

export default class FunfairMap extends MapBase {
  constructor() {
    super();
    this.id = 'FUNFAIR';
    this.name = 'Banana Funfair';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-72, -5, -72),
      new THREE.Vector3(72, 60, 72)
    );
    this.killY = -15;
    this.environment = {
      skyColor: 0x201a3d,
      fog: { color: 0x281f4d, near: 35, far: 160 }
    };

    this._rng = mulberry32(0xfe1215);
    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = {
      ground: [], hoard: [], wood: [], awn: [], fun: [],
      steel: [], trim: [], neon: [], paint: [], bulbs: []
    };
    this._wheelGroup = null;
    this._cabinMesh = null;
    this._coasterCurve = null;
    this._coasterLen = 1;
    this._trainMesh = null;
    this._carouselGroup = null;
    this._horseMesh = null;
    this._bulbMat = null;
    this._neonMat = null;
    this._bellMat = null;
    this._puckMat = null;
    this._strikerPuck = null;
    this._sparkMat = null;
    this._confettiGeo = null;
    this._confettiBase = null;
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns(); // early: layout below is checked against these
    this._buildLights();
    this._buildGround();
    this._buildPerimeter();
    this._buildEntrance();
    this._buildMidway();
    this._buildFerrisWheel();
    this._buildCarousel();
    this._buildCoaster();
    this._buildBumperPavilion();
    this._buildFoodCourt();
    this._buildFunhouse();
    this._buildConfetti();
    this._flushBuckets();
    this.update(0, 0); // seed all animated instance matrices
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

  _paintAsphalt(ctx, size) {
    const rng = mulberry32(0xa5fa17);
    ctx.fillStyle = '#26262e';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 700; i++) {
      const g = 30 + Math.floor(rng() * 34);
      ctx.fillStyle = `rgba(${g},${g},${g + 6},${0.25 + rng() * 0.4})`;
      ctx.fillRect(rng() * size, rng() * size, 1 + rng() * 2, 1 + rng() * 2);
    }
    // oil stains + faint chalk scuffs
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = `rgba(12,12,18,${0.2 + rng() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 8 + rng() * 22, 6 + rng() * 14,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(190,185,160,0.10)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.moveTo(rng() * size, rng() * size);
      ctx.lineTo(rng() * size, rng() * size);
      ctx.stroke();
    }
  }

  _paintStripes(ctx, size, colA, colB) {
    const rng = mulberry32(0x5711fe);
    const stripes = 8;
    const w = size / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? colA : colB;
      ctx.fillRect(i * w, 0, w, size);
    }
    // grime specks so it isn't sterile
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = `rgba(30,24,20,${0.06 + rng() * 0.14})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 1 + rng() * 4, 1 + rng() * 3,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintPlanks(ctx, size) {
    const rng = mulberry32(0xca11fe);
    ctx.fillStyle = '#7a5236';
    ctx.fillRect(0, 0, size, size);
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const shade = Math.floor((rng() - 0.5) * 36);
      ctx.fillStyle = `rgb(${124 + shade},${88 + shade},${54 + shade})`;
      ctx.fillRect(0, r * (size / rows) + 2, size, size / rows - 4);
      ctx.strokeStyle = 'rgba(44,28,14,0.6)';
      for (let i = 0; i < 8; i++) {
        const x = rng() * size;
        ctx.beginPath();
        ctx.moveTo(x, r * (size / rows));
        ctx.lineTo(x + (rng() - 0.5) * 20, (r + 1) * (size / rows));
        ctx.stroke();
      }
    }
  }

  _paintFun(ctx, size) {
    const rng = mulberry32(0xf00baa);
    ctx.fillStyle = '#3f2a63';
    ctx.fillRect(0, 0, size, size);
    const dots = ['#ff6ea9', '#ffd23e', '#4dd8c0', '#7f9bff'];
    for (let i = 0; i < 42; i++) {
      ctx.fillStyle = dots[Math.floor(rng() * dots.length)];
      ctx.globalAlpha = 0.5 + rng() * 0.4;
      ctx.beginPath();
      ctx.arc(rng() * size, rng() * size, 2 + rng() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,210,62,0.5)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= size; x += size / 8) {
      ctx.lineTo(x, size * 0.5 + ((x / (size / 8)) % 2 === 0 ? -10 : 10));
    }
    ctx.stroke();
  }

  _paintSign(ctx, size) {
    ctx.fillStyle = '#1c1030';
    ctx.fillRect(0, 0, size, size);
    // bulb border
    ctx.fillStyle = '#ffd98a';
    for (let i = 0; i < 16; i++) {
      const t = (i / 16) * size;
      for (const [x, y] of [[t + 8, 10], [t + 8, size - 10], [10, t + 8], [size - 10, t + 8]]) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BANANA', size / 2, size * 0.42);
    ctx.fillText('FUNFAIR', size / 2, size * 0.64);
    // simple banana swoosh
    ctx.strokeStyle = '#ffe27a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(size / 2, size * 0.62, size * 0.26, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();
  }

  _makeMaterials() {
    const asphaltTex = this._canvasTex(256, (c, s) => this._paintAsphalt(c, s));
    const hoardTex = this._canvasTex(128, (c, s) => this._paintStripes(c, s, '#a32638', '#e8e0d2'));
    const awnTex = this._canvasTex(128, (c, s) => this._paintStripes(c, s, '#e0b23c', '#f2ead8'));
    const plankTex = this._canvasTex(128, (c, s) => this._paintPlanks(c, s));
    const funTex = this._canvasTex(128, (c, s) => this._paintFun(c, s));
    const signTex = this._canvasTex(256, (c, s) => this._paintSign(c, s));

    // Twinkling string-light bulbs (merged geometry, NO PointLights).
    this._bulbMat = new THREE.MeshStandardMaterial({
      color: 0x4a3d22, emissive: 0xffd98a, emissiveIntensity: 1.3, roughness: 0.4
    });
    // Static neon trim (gently pulsed in update()).
    this._neonMat = new THREE.MeshStandardMaterial({
      color: 0x2a1c10, emissive: 0xffc23e, emissiveIntensity: 1.0, roughness: 0.5
    });
    this._bellMat = new THREE.MeshStandardMaterial({
      color: 0x6b5310, emissive: 0xffe27a, emissiveIntensity: 0.85,
      metalness: 0.6, roughness: 0.35
    });
    this._puckMat = new THREE.MeshStandardMaterial({
      color: 0x531212, emissive: 0xff4d2e, emissiveIntensity: 1.5
    });

    this._mats = {
      ground: new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 1.0 }),
      hoard: new THREE.MeshStandardMaterial({ map: hoardTex, roughness: 0.9 }),
      wood: new THREE.MeshStandardMaterial({ map: plankTex, roughness: 0.9 }),
      awn: new THREE.MeshStandardMaterial({ map: awnTex, roughness: 0.85 }),
      fun: new THREE.MeshStandardMaterial({ map: funTex, roughness: 0.9 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x8f93a8, metalness: 0.55, roughness: 0.45 }),
      trim: new THREE.MeshStandardMaterial({ color: 0x2c2438, roughness: 0.8 }),
      paint: new THREE.MeshStandardMaterial({
        color: 0xe8e4d0, emissive: 0x8a8570, emissiveIntensity: 0.25, roughness: 0.9
      }),
      track: new THREE.MeshStandardMaterial({ color: 0xb03a4e, metalness: 0.4, roughness: 0.5 }),
      cream: new THREE.MeshStandardMaterial({ color: 0xf0e6d8, roughness: 0.7 }),
      sign: new THREE.MeshBasicMaterial({ map: signTex })
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

  /** Steel guard rail / fence run with collider. */
  _rail(w, d, x, y, z) {
    this._solid('steel', w, 0.9, d, x, y, z);
  }

  _flushBuckets() {
    const matFor = {
      ground: this._mats.ground, hoard: this._mats.hoard, wood: this._mats.wood,
      awn: this._mats.awn, fun: this._mats.fun, steel: this._mats.steel,
      trim: this._mats.trim, neon: this._neonMat, paint: this._mats.paint,
      bulbs: this._bulbMat
    };
    const noShadow = { ground: true, paint: true, bulbs: true, neon: true };
    for (const key of Object.keys(this._buckets)) {
      const list = this._buckets[key];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      list.length = 0;
      const mesh = new THREE.Mesh(merged, matFor[key]);
      mesh.castShadow = !noShadow[key];
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

  /** Matrix positioned at p, +Z aimed at q, stretched sz along the aim. */
  _lookMatrix(px, py, pz, qx, qy, qz, sz = 1) {
    const d = this._dummy;
    d.position.set(px, py, pz);
    d.scale.set(1, 1, sz);
    d.lookAt(qx, qy, qz);
    d.updateMatrix();
    return d.matrix.clone();
  }

  // --------------------------------------------------------------- lighting

  _buildLights() {
    // Night carnival: ONE cool violet-white moon + strong fill so
    // silhouettes always read. Bulbs/neon are emissive geometry, not lights.
    const moon = new THREE.DirectionalLight(0xcfc4ff, 0.65);
    moon.position.set(45, 75, 25);
    moon.castShadow = true;
    moon.shadow.mapSize.set(2048, 2048);
    moon.shadow.camera.left = -80;
    moon.shadow.camera.right = 80;
    moon.shadow.camera.top = 80;
    moon.shadow.camera.bottom = -80;
    moon.shadow.camera.near = 10;
    moon.shadow.camera.far = 220;
    moon.shadow.bias = -0.0006;
    this.group.add(moon);
    this.group.add(moon.target);
    moon.target.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0x6f5fae, 0x1a1430, 0.85);
    this.group.add(hemi);
    const amb = new THREE.AmbientLight(0x3c3560, 0.6);
    this.group.add(amb);
  }

  // ----------------------------------------------------------------- ground

  _buildGround() {
    // One asphalt slab, top y = 0.
    this._pushBox('ground', 144, 1.2, 144, 0, -1.2, 0);
    this._boxCollider(144, 1.2, 144, 0, -1.2, 0);

    // Midway lane markings (thin painted dashes, decor).
    for (let z = 58; z >= -28; z -= 4) {
      this._pushBox('paint', 0.14, 0.02, 1.8, -8, 0, z);
      this._pushBox('paint', 0.14, 0.02, 1.8, 8, 0, z);
    }
    for (let z = 57; z >= -27; z -= 6) {
      this._pushBox('paint', 0.12, 0.02, 1.2, 0, 0, z);
    }
  }

  _buildPerimeter() {
    // Carnival hoarding sealing the fairground. Bottoms sunk to -1.4.
    const H = 9.4;
    this._solid('hoard', 146, H, 2, 0, -1.4, -71);
    this._solid('hoard', 146, H, 2, 0, -1.4, 71);
    this._solid('hoard', 2, H, 146, -71, -1.4, 0);
    this._solid('hoard', 2, H, 146, 71, -1.4, 0);
    // Neon crown strips along the inner faces (decor, out of reach).
    this._pushBox('neon', 140, 0.18, 0.1, 0, 7.6, -69.9);
    this._pushBox('neon', 140, 0.18, 0.1, 0, 7.6, 69.9);
    this._pushBox('neon', 0.1, 0.18, 140, -69.9, 7.6, 0);
    this._pushBox('neon', 0.1, 0.18, 140, 69.9, 7.6, 0);
  }

  // --------------------------------------------------------------- entrance

  _buildEntrance() {
    // Grand arch over the midway mouth.
    this._solid('hoard', 1.4, 5.6, 1.4, -5.5, 0, 60);
    this._solid('hoard', 1.4, 5.6, 1.4, 5.5, 0, 60);
    this._pushBox('hoard', 12.6, 1.5, 1.6, 0, 5.6, 60); // beam (decor, overhead)
    this._pushBox('neon', 12.6, 0.12, 0.14, 0, 7.12, 60.75);
    this._pushBox('neon', 12.6, 0.12, 0.14, 0, 7.12, 59.25);

    // Lit marquee facing the police plaza.
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.6), this._mats.sign);
    sign.position.set(0, 6.4, 60.95);
    this.group.add(sign);

    // Ticket booths flanking the plaza (solid; monkeys hide behind them).
    for (const bx of [-10, 10]) {
      this._solid('hoard', 2.4, 2.5, 2.4, bx, 0, 63.5);
      const roof = new THREE.ConeGeometry(1.9, 0.9, 4);
      roof.rotateY(Math.PI / 4);
      roof.translate(bx, 3.0, 63.5);
      this._buckets.awn.push(roof);
      this._pushBox('trim', 1.6, 0.9, 0.08, bx, 1.1, 64.74); // window (decor)
    }
  }

  // ----------------------------------------------------------------- midway

  /**
   * Enterable game stall. Local design opens toward +x; yaw must be a
   * multiple of PI/2 so wall/counter colliders stay tight AABBs.
   * Duck behind the 1 m counter to hide; entry gap at one counter end.
   */
  _stall(cx, cz, yaw) {
    const c = Math.round(Math.cos(yaw));
    const s = Math.round(Math.sin(yaw));
    const piece = (bucket, w, h, d, lx, y, lz, collide) => {
      const wx = cx + c * lx + s * lz;
      const wz = cz - s * lx + c * lz;
      this._pushBox(bucket, w, h, d, wx, y, wz, yaw);
      if (collide) this._boxCollider(w, h, d, wx, y, wz, yaw);
    };
    piece('wood', 0.3, 2.7, 5.2, -1.65, 0, 0, true);        // back wall
    piece('wood', 3.3, 2.7, 0.3, -0.15, 0, -2.45, true);    // side walls
    piece('wood', 3.3, 2.7, 0.3, -0.15, 0, 2.45, true);
    piece('wood', 0.45, 1.0, 3.4, 1.35, 0, -0.75, true);    // duck-behind counter
    piece('trim', 0.6, 0.06, 3.5, 1.35, 1.0, -0.75, false); // counter top
    piece('awn', 4.3, 0.22, 5.9, -0.2, 2.7, 0, false);      // roof (decor)
    piece('awn', 1.5, 0.14, 5.9, 2.0, 2.62, 0, false);      // awning lip (decor)
    piece('neon', 0.14, 0.2, 3.6, 2.05, 2.3, 0, false);     // sign strip (decor)
  }

  _buildMidway() {
    // Game stalls lining the lane (west row opens east, east row opens west).
    for (const z of [48, 34, 20, 4]) this._stall(-11.5, z, 0);
    for (const z of [42, 12, -4]) this._stall(11.5, z, Math.PI);

    // High-striker tower with a climbing light (update()).
    this._solid('wood', 1.8, 0.7, 1.8, 14, 0, 20);
    this._solid('steel', 0.5, 8.6, 0.5, 14, 0.7, 20);
    for (let y = 1.4; y <= 8.0; y += 0.75) {
      this._pushBox('trim', 0.62, 0.07, 0.07, 14, y, 20.3);
    }
    this._pushBox('neon', 0.1, 8.4, 0.1, 13.72, 0.8, 20.28);
    this._pushBox('neon', 0.1, 8.4, 0.1, 14.28, 0.8, 20.28);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), this._bellMat);
    bell.position.set(14, 9.55, 20);
    this.group.add(bell);
    this._strikerPuck = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.26, 0.22), this._puckMat);
    this._strikerPuck.position.set(14, 1.0, 20.45);
    this.group.add(this._strikerPuck);

    // String-light poles (instanced) + sagging bulb strings across the lane
    // (merged emissive spheres, twinkled via material pulse — no lights).
    const zs = [];
    for (let z = 56; z >= -28; z -= 7) zs.push(z);
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.1, 4.6, 7);
    poleGeo.translate(0, 2.3, 0);
    const poleMats = [];
    for (const z of zs) {
      for (const px of [-9, 9]) {
        poleMats.push(this._matrixAt(px, 0, z, 0, 0, 0, 1, 1, 1));
        this._boxCollider(0.26, 4.6, 0.26, px, 0, z);
        const knob = new THREE.SphereGeometry(0.15, 6, 5);
        knob.translate(px, 4.66, z);
        this._buckets.bulbs.push(knob);
      }
      // wire (4 straight segments approximating the sag)
      const sagAt = (x) => 4.62 - 0.75 * (1 - (x / 9) * (x / 9));
      const pts = [-9, -4.5, 0, 4.5, 9];
      for (let i = 0; i < 4; i++) {
        const x0 = pts[i], x1 = pts[i + 1];
        const y0 = sagAt(x0), y1 = sagAt(x1);
        const len = Math.hypot(x1 - x0, y1 - y0);
        const wire = new THREE.BoxGeometry(len, 0.04, 0.04);
        wire.rotateZ(Math.atan2(y1 - y0, x1 - x0));
        wire.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
        this._buckets.trim.push(wire);
      }
      for (let bx = -8.4; bx <= 8.41; bx += 1.2) {
        const bulb = new THREE.SphereGeometry(0.09, 6, 5);
        bulb.translate(bx, sagAt(bx) - 0.12, z);
        this._buckets.bulbs.push(bulb);
      }
    }
    this._makeInstanced(poleGeo, this._mats.steel, poleMats);

    // Trash bins (instanced, low colliders — hop-overable cover).
    const binGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.95, 8);
    binGeo.translate(0, 0.475, 0);
    const binMats = [];
    for (const [bx, bz] of [[9.2, 51], [-9.2, 44], [9.2, 26], [-9.2, 9],
      [9.2, -12], [-9.2, -20], [34, 45.5], [47, 42]]) {
      binMats.push(this._matrixAt(bx, 0, bz, 0, this._rng() * Math.PI, 0, 1, 1, 1));
      this._boxCollider(0.7, 0.95, 0.7, bx, 0, bz);
    }
    this._makeInstanced(binGeo, this._mats.trim, binMats);
  }

  // ----------------------------------------------------------- ferris wheel

  _buildFerrisWheel() {
    // Static A-frame legs (angled decor cylinders + slim base colliders).
    const legParts = [];
    const legGeo = new THREE.CylinderGeometry(0.26, 0.34, 17.0, 8);
    for (const [sx, zz] of [[1, -38.6], [-1, -38.6], [1, -41.4], [-1, -41.4]]) {
      const g = legGeo.clone();
      g.translate(0, 8.5, 0);
      g.rotateZ(sx * 0.329);
      g.translate(5.5 * sx, 0, zz);
      legParts.push(g);
      this._boxCollider(1.1, 2.6, 1.1, 5.5 * sx, 0, zz);
    }
    legGeo.dispose();
    for (const zz of [-38.6, -41.4]) {
      const brace = new THREE.BoxGeometry(7.4, 0.26, 0.26);
      brace.translate(0, 6, zz);
      legParts.push(brace);
      const brace2 = new THREE.BoxGeometry(4.2, 0.24, 0.24);
      brace2.translate(0, 11, zz);
      legParts.push(brace2);
    }
    const legMesh = new THREE.Mesh(mergeGeometries(legParts, false), this._mats.steel);
    for (const g of legParts) g.dispose();
    legMesh.castShadow = true;
    legMesh.receiveShadow = true;
    this.group.add(legMesh);

    // Rotating wheel (PURE DECOR — no colliders ever).
    this._wheelGroup = new THREE.Group();
    this._wheelGroup.position.set(0, WHEEL_HUB_Y, WHEEL_Z);
    this.group.add(this._wheelGroup);
    const wheelParts = [];
    const spokeBase = new THREE.BoxGeometry(0.14, WHEEL_R - 0.2, 0.14);
    for (let i = 0; i < CABIN_COUNT; i++) {
      const g = spokeBase.clone();
      g.translate(0, (WHEEL_R - 0.2) / 2, 0);
      g.rotateZ((i / CABIN_COUNT) * Math.PI * 2);
      wheelParts.push(g);
    }
    spokeBase.dispose();
    const rim = new THREE.TorusGeometry(WHEEL_R, 0.26, 8, 44);
    wheelParts.push(rim);
    const innerRim = new THREE.TorusGeometry(3.6, 0.16, 6, 20);
    wheelParts.push(innerRim);
    const axle = new THREE.CylinderGeometry(0.42, 0.42, 3.4, 10);
    axle.rotateX(Math.PI / 2);
    wheelParts.push(axle);
    const wheelMesh = new THREE.Mesh(mergeGeometries(wheelParts, false), this._mats.steel);
    for (const g of wheelParts) g.dispose();
    wheelMesh.castShadow = true;
    this._wheelGroup.add(wheelMesh);
    // Rim bulbs ride around with the wheel and twinkle with the strings.
    const rimBulbs = [];
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const b = new THREE.SphereGeometry(0.15, 6, 5);
      b.translate(Math.cos(a) * WHEEL_R, Math.sin(a) * WHEEL_R, 0);
      rimBulbs.push(b);
    }
    const rimBulbMesh = new THREE.Mesh(mergeGeometries(rimBulbs, false), this._bulbMat);
    for (const g of rimBulbs) g.dispose();
    this._wheelGroup.add(rimBulbMesh);

    // Upright cabins (decor; matrices recomputed every frame, world space).
    const cabinParts = [];
    const body = new THREE.BoxGeometry(1.25, 1.05, 1.05);
    body.translate(0, -0.12, 0);
    cabinParts.push(body);
    const cRoof = new THREE.ConeGeometry(0.85, 0.55, 4);
    cRoof.rotateY(Math.PI / 4);
    cRoof.translate(0, 0.62, 0);
    cabinParts.push(cRoof);
    const cabinGeo = mergeGeometries(cabinParts, false);
    for (const g of cabinParts) g.dispose();
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.15 });
    this._cabinMesh = new THREE.InstancedMesh(cabinGeo, cabinMat, CABIN_COUNT);
    const palette = [0xff5a76, 0xffc94d, 0x59d6a9, 0x5aa7ff, 0xc77dff];
    const col = new THREE.Color();
    for (let i = 0; i < CABIN_COUNT; i++) {
      this._cabinMesh.setColorAt(i, col.setHex(palette[i % palette.length]));
    }
    this._cabinMesh.instanceColor.needsUpdate = true;
    this._cabinMesh.castShadow = true;
    this._cabinMesh.frustumCulled = false;
    this.group.add(this._cabinMesh);

    // Fenced boarding platform (two 0.4 risers) — all colliders static.
    this._solid('wood', 8, 0.8, 3, 0, 0, -36.5);              // platform, top 0.8
    this._solid('wood', 0.7, 0.4, 3, 4.35, 0, -36.5);         // east step, top 0.4
    this._rail(8, 0.15, 0, 0.8, -37.925);                     // north fence
    this._rail(0.15, 3, -3.925, 0.8, -36.5);                  // west fence
    this._rail(8, 0.15, 0, 0.8, -35.075);                     // south fence (entry via east step)

    // Queue-rail maze in front (walkable serpentine).
    this._rail(8.5, 0.15, -1.75, 0, -34.2);
    this._rail(8.5, 0.15, 1.75, 0, -31.4);
    this._rail(0.15, 2.95, -6, 0, -32.8);
    this._rail(0.15, 2.95, 6, 0, -32.8);
  }

  // --------------------------------------------------------------- carousel

  _buildCarousel() {
    // Solid 1.1 m plinth (single static collider); ride above is decor.
    this._solid('fun', 8, 1.1, 8, CAR_X, 0, CAR_Z);
    this._pushBox('neon', 8.2, 0.12, 0.18, CAR_X, 1.0, CAR_Z - 4.02);
    this._pushBox('neon', 8.2, 0.12, 0.18, CAR_X, 1.0, CAR_Z + 4.02);
    this._pushBox('neon', 0.18, 0.12, 8.2, CAR_X - 4.02, 1.0, CAR_Z);
    this._pushBox('neon', 0.18, 0.12, 8.2, CAR_X + 4.02, 1.0, CAR_Z);

    // Rotating canopy + centre column (decor group).
    this._carouselGroup = new THREE.Group();
    this._carouselGroup.position.set(CAR_X, 1.1, CAR_Z);
    this.group.add(this._carouselGroup);
    const parts = [];
    const column = new THREE.CylinderGeometry(0.28, 0.34, 3.3, 10);
    column.translate(0, 1.65, 0);
    parts.push(column);
    const canopy = new THREE.ConeGeometry(5.7, 1.9, 12);
    canopy.translate(0, 4.15, 0);
    parts.push(canopy);
    const finial = new THREE.SphereGeometry(0.35, 8, 6);
    finial.translate(0, 5.35, 0);
    parts.push(finial);
    const topMesh = new THREE.Mesh(mergeGeometries(parts, false), this._mats.awn);
    for (const g of parts) g.dispose();
    topMesh.castShadow = true;
    this._carouselGroup.add(topMesh);

    // Eight bobbing horses (instanced decor inside the rotating group).
    const hParts = [];
    const hp = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y, z);
      hParts.push(g);
    };
    hp(0.78, 0.4, 0.3, 0, 1.15, 0);        // body
    hp(0.24, 0.34, 0.22, 0.44, 1.42, 0);   // head
    hp(0.07, 0.45, 0.07, 0.28, 0.72, 0.1); // legs
    hp(0.07, 0.45, 0.07, 0.28, 0.72, -0.1);
    hp(0.07, 0.45, 0.07, -0.28, 0.72, 0.1);
    hp(0.07, 0.45, 0.07, -0.28, 0.72, -0.1);
    const pole = new THREE.CylinderGeometry(0.045, 0.045, 3.1, 6);
    pole.translate(0, 1.55, 0);
    hParts.push(pole);
    const horseGeo = mergeGeometries(hParts, false);
    for (const g of hParts) g.dispose();
    const horseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
    this._horseMesh = new THREE.InstancedMesh(horseGeo, horseMat, 8);
    const pastel = [0xf7f7f2, 0xffd9e8, 0xd9ecff, 0xfff3c9, 0xe6d9ff, 0xd9ffe6, 0xffe1c9, 0xf0f0ff];
    const col = new THREE.Color();
    for (let i = 0; i < 8; i++) this._horseMesh.setColorAt(i, col.setHex(pastel[i]));
    this._horseMesh.instanceColor.needsUpdate = true;
    this._horseMesh.castShadow = true;
    this._horseMesh.frustumCulled = false;
    this._carouselGroup.add(this._horseMesh);

    // Queue fence ring (axis-aligned square, entrance gap facing the midway).
    this._rail(14.3, 0.15, CAR_X, 0, 3);
    this._rail(14.3, 0.15, CAR_X, 0, 17);
    this._rail(0.15, 14.3, -42, 0, 10);
    this._rail(0.15, 5.5, -28, 0, 5.75);
    this._rail(0.15, 5.5, -28, 0, 14.25);
  }

  // ----------------------------------------------------------- rollercoaster

  _buildCoaster() {
    // Closed parametric loop over the east grounds, 3.2..9 m up.
    this._coasterCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(42, 3.2, -15),
      new THREE.Vector3(38, 4.6, -30),
      new THREE.Vector3(34, 6.6, -44),
      new THREE.Vector3(45, 9.0, -47),
      new THREE.Vector3(56, 7.6, -40),
      new THREE.Vector3(57, 5.6, -22),
      new THREE.Vector3(52, 4.0, -5),
      new THREE.Vector3(56, 6.2, 8),
      new THREE.Vector3(48, 8.2, 15),
      new THREE.Vector3(36, 7.2, 12),
      new THREE.Vector3(30, 5.2, 0),
      new THREE.Vector3(35, 3.6, -8)
    ], true, 'catmullrom', 0.5);
    this._coasterLen = this._coasterCurve.getLength();

    // Track: instanced angled segments following the curve (DECOR).
    const N = 150;
    const segLen = this._coasterLen / N;
    const segGeo = new THREE.BoxGeometry(0.85, 0.2, 1);
    const segMats = [];
    for (let i = 0; i < N; i++) {
      const p0 = this._coasterCurve.getPointAt(i / N);
      const p1 = this._coasterCurve.getPointAt(((i + 1) % N) / N);
      segMats.push(this._lookMatrix(
        (p0.x + p1.x) / 2, (p0.y + p1.y) / 2, (p0.z + p1.z) / 2,
        p1.x, p1.y, p1.z, segLen * 1.25));
    }
    this._makeInstanced(segGeo, this._mats.track, segMats);

    // Support columns (instanced; slim STATIC colliders on the ground).
    const colGeo = new THREE.CylinderGeometry(0.2, 0.26, 1, 7);
    colGeo.translate(0, 0.5, 0);
    const colMats = [];
    for (let i = 0; i < N; i += 8) {
      const p = this._coasterCurve.getPointAt(i / N);
      // keep the station area clear (deck, stairs and the hide-under space)
      if (p.x > 41 && p.x < 50.5 && p.z > -19.5 && p.z < -8) continue;
      colMats.push(this._matrixAt(p.x, 0, p.z, 0, 0, 0, 1, p.y - 0.12, 1));
      this._boxCollider(0.5, p.y - 0.1, 0.5, p.x, 0, p.z);
    }
    this._makeInstanced(colGeo, this._mats.steel, colMats);

    // 4-car train riding the loop (decor; matrices set in update()).
    const carParts = [];
    const carBody = new THREE.BoxGeometry(1.0, 0.5, 1.7);
    carBody.translate(0, 0.25, 0);
    carParts.push(carBody);
    const seatBack = new THREE.BoxGeometry(0.9, 0.35, 0.12);
    seatBack.translate(0, 0.6, -0.7);
    carParts.push(seatBack);
    const carGeo = mergeGeometries(carParts, false);
    for (const g of carParts) g.dispose();
    const carMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.2 });
    this._trainMesh = new THREE.InstancedMesh(carGeo, carMat, 4);
    const carCols = [0xffd23e, 0xff5a76, 0x59d6a9, 0x5aa7ff];
    const col = new THREE.Color();
    for (let i = 0; i < 4; i++) this._trainMesh.setColorAt(i, col.setHex(carCols[i]));
    this._trainMesh.instanceColor.needsUpdate = true;
    this._trainMesh.castShadow = true;
    this._trainMesh.frustumCulled = false;
    this.group.add(this._trainMesh);

    // Boarding station: railed deck at y 2.4 you can hide ON and UNDER.
    this._solid('steel', 6, 0.3, 4, 46, 2.1, -15);             // deck slab
    for (const [px, pz] of [[43.4, -16.7], [48.6, -16.7], [43.4, -13.3], [48.6, -13.3]]) {
      this._solid('steel', 0.4, 2.1, 0.4, px, 0, pz);          // deck pillars
    }
    this._rail(6, 0.15, 46, 2.4, -16.925);                     // deck railings
    this._rail(0.15, 4, 48.925, 2.4, -15);
    this._rail(0.15, 4, 43.075, 2.4, -15);
    this._rail(2, 0.15, 44, 2.4, -13.075);                     // south, gap for stairs
    this._rail(2, 0.15, 48, 2.4, -13.075);
    // Stairs up (0.4 rise / 0.7 run), approaching from the south.
    for (let j = 1; j <= 6; j++) {
      this._solid('steel', 2, j * STEP_RISE, STEP_RUN,
        46, 0, -13 + (6 - j) * STEP_RUN + STEP_RUN / 2);
    }
    // Station canopy (decor).
    this._pushBox('steel', 0.12, 2.4, 0.12, 46, 2.4, -16.8);
    this._pushBox('steel', 0.12, 2.4, 0.12, 46, 2.4, -13.2);
    this._pushBox('awn', 6.6, 0.18, 4.4, 46, 4.8, -15);
    this._pushBox('neon', 6.2, 0.14, 0.12, 46, 4.62, -12.9);
  }

  // ------------------------------------------------------ bumper-car pavilion

  _buildBumperPavilion() {
    // Raised rink floor (0.2 step) under a roof on pillars.
    this._solid('fun', 22, 0.2, 22, -37.5, 0, -42.5);
    for (const [px, pz] of [[-48, -53], [-27, -53], [-48, -32], [-27, -32],
      [-48, -42.5], [-27, -42.5]]) {
      this._solid('steel', 0.5, 5.2, 0.5, px, 0, pz);
    }
    this._pushBox('trim', 24, 0.35, 24, -37.5, 5.2, -42.5);   // roof (decor)
    this._pushBox('neon', 24.4, 0.14, 0.16, -37.5, 5.05, -54.4);
    this._pushBox('neon', 24.4, 0.14, 0.16, -37.5, 5.05, -30.6);
    this._pushBox('neon', 0.16, 0.14, 24.4, -49.4, 5.05, -42.5);
    this._pushBox('neon', 0.16, 0.14, 24.4, -25.6, 5.05, -42.5);

    // Low border walls with two entrance gaps (south + east).
    this._solid('steel', 22, 0.5, 0.25, -37.5, 0.2, -53.35);
    this._solid('steel', 8.5, 0.5, 0.25, -44.25, 0.2, -31.65);
    this._solid('steel', 8.5, 0.5, 0.25, -30.75, 0.2, -31.65);
    this._solid('steel', 0.25, 0.5, 22, -48.35, 0.2, -42.5);
    this._solid('steel', 0.25, 0.5, 8.5, -26.65, 0.2, -49.25);
    this._solid('steel', 0.25, 0.5, 8.5, -26.65, 0.2, -35.75);

    // Parked bumper cars (instanced, WITH colliders — chest-high cover).
    const carParts = [];
    const base = new THREE.CylinderGeometry(0.72, 0.8, 0.42, 10);
    base.translate(0, 0.21, 0);
    carParts.push(base);
    const seat = new THREE.BoxGeometry(0.7, 0.35, 0.7);
    seat.translate(0, 0.5, 0);
    carParts.push(seat);
    const back = new THREE.BoxGeometry(0.75, 0.5, 0.14);
    back.translate(0, 0.55, -0.34);
    carParts.push(back);
    const pole = new THREE.CylinderGeometry(0.035, 0.035, 2.1, 6);
    pole.translate(0, 1.45, 0);
    carParts.push(pole);
    const carGeo = mergeGeometries(carParts, false);
    for (const g of carParts) g.dispose();
    const bumperMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.25 });
    const spots = [[-33.5, -36], [-42, -38], [-30, -46], [-37, -49.5],
      [-45, -44], [-40, -33.5], [-29, -51.5]];
    const mats = [];
    for (const [bx, bz] of spots) {
      mats.push(this._matrixAt(bx, 0.2, bz, 0, this._rng() * Math.PI * 2, 0, 1, 1, 1));
      this._boxCollider(1.5, 1.0, 1.5, bx, 0.2, bz);
    }
    const bumperMesh = this._makeInstanced(carGeo, bumperMat, mats);
    const bCols = [0xff5a76, 0xffd23e, 0x59d6a9, 0x5aa7ff, 0xc77dff, 0xff9a4d, 0x7fe07f];
    const col = new THREE.Color();
    for (let i = 0; i < spots.length; i++) bumperMesh.setColorAt(i, col.setHex(bCols[i]));
    bumperMesh.instanceColor.needsUpdate = true;

    // Ceiling spark flashes (additive points, opacity strobed in update()).
    const N = 16;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -46 + this._rng() * 17;
      pos[i * 3 + 1] = 4.55 + this._rng() * 0.45;
      pos[i * 3 + 2] = -52 + this._rng() * 19;
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._sparkMat = new THREE.PointsMaterial({
      color: 0x9fe8ff, size: 0.5, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    const sparks = new THREE.Points(sparkGeo, this._sparkMat);
    sparks.frustumCulled = false;
    this.group.add(sparks);
  }

  // ------------------------------------------------------------- food court

  _buildFoodCourt() {
    // Snack booths (same enterable stall design as the midway).
    this._stall(52, 38, Math.PI);
    this._stall(33, 55.5, Math.PI / 2);
    this._stall(27.5, 47, 0);

    // Picnic tables: tops are DECOR (crawl-under hiding); benches collide.
    const parts = [];
    const part = (w, h, d, x, y, z) => {
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(x, y + h / 2, z);
      parts.push(g);
    };
    part(2.0, 0.1, 1.1, 0, 0.72, 0);
    for (const sx of [-0.85, 0.85]) {
      for (const sz of [-0.4, 0.4]) part(0.09, 0.72, 0.09, sx, 0, sz);
    }
    for (const sz of [-0.78, 0.78]) {
      part(2.0, 0.09, 0.4, 0, 0.46, sz);
      part(0.07, 0.46, 0.07, -0.8, 0, sz);
      part(0.07, 0.46, 0.07, 0.8, 0, sz);
    }
    const tableGeo = mergeGeometries(parts, false);
    for (const g of parts) g.dispose();
    const tables = [[31, 44, 0], [37, 50.5, 1], [44, 55.5, 0],
      [30, 52.5, 1], [49, 52, 0], [39, 42, 1]]; // 1 = rotated 90 deg
    const mats = [];
    for (const [tx, tz, q] of tables) {
      const yaw = q * (Math.PI / 2);
      mats.push(this._matrixAt(tx, 0, tz, 0, yaw, 0, 1, 1, 1));
      const c = Math.round(Math.cos(yaw));
      const s = Math.round(Math.sin(yaw));
      for (const lz of [-0.78, 0.78]) {
        this._boxCollider(2.0, 0.55, 0.4, tx + s * lz, 0, tz + c * lz, yaw);
      }
    }
    this._makeInstanced(tableGeo, this._mats.wood, mats);

    // Giant banana-split statue (base collides; sweets are lofty decor).
    this._pushCyl('trim', 2.1, 2.3, 1.2, 12, 45, 0, 48);
    this._boxCollider(2.8, 1.2, 2.8, 45, 0, 48);
    const bowlParts = [];
    const bowl = new THREE.CylinderGeometry(2.35, 1.1, 1.1, 12);
    bowl.translate(45, 1.75, 48);
    bowlParts.push(bowl);
    for (const [sx, sy, sz] of [[44.2, 2.75, 48.4], [45.8, 2.75, 48.3], [45.1, 2.85, 47.5]]) {
      const scoop = new THREE.SphereGeometry(0.85, 10, 8);
      scoop.translate(sx, sy, sz);
      bowlParts.push(scoop);
    }
    const bowlMesh = new THREE.Mesh(mergeGeometries(bowlParts, false), this._mats.cream);
    for (const g of bowlParts) g.dispose();
    bowlMesh.castShadow = true;
    this.group.add(bowlMesh);
    for (const [bz, ry] of [[48.85, 0], [47.15, Math.PI]]) {
      const banana = new THREE.Mesh(
        new THREE.TorusGeometry(1.7, 0.3, 8, 14, 2.4), this._neonMat);
      banana.position.set(45, 2.3, bz);
      banana.rotation.set(0, ry, 0.4);
      banana.castShadow = true;
      this.group.add(banana);
    }
    const cherryMat = new THREE.MeshStandardMaterial({
      color: 0xd8244a, emissive: 0xff3d63, emissiveIntensity: 0.9
    });
    const cherry = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), cherryMat);
    cherry.position.set(45, 4.0, 47.95);
    this.group.add(cherry);
  }

  // --------------------------------------------------------------- funhouse

  _buildFunhouse() {
    // Enterable mini-maze; walls are full height so the roof deck sits on top.
    const W = (w, h, d, x, z) => this._solid('fun', w, h, d, x, 0, z);
    W(14.3, 3.3, 0.3, -46, 48);            // north wall
    W(7.15, 3.3, 0.3, -49.575, 32);        // south wall, west of door (1.6 m)
    W(5.55, 3.3, 0.3, -41.625, 32);        // south wall, east of door
    W(0.3, 3.3, 15.7, -53, 40);            // west wall
    W(0.3, 3.3, 9.85, -39, 37.075);        // east wall, south of door (1.6 m)
    W(0.3, 3.3, 4.25, -39, 45.725);        // east wall, north of door
    W(10.15, 3.3, 0.3, -48.075, 44);       // P1 — north corridor divider
    W(10.15, 3.3, 0.3, -43.925, 38);       // P2 — middle divider
    W(0.3, 3.3, 2.4, -46, 45.2);           // P3 — NW nook gate
    W(0.3, 3.3, 4.0, -44, 40);             // P4 — east pocket divider
    W(0.3, 3.3, 3.5, -49.5, 33.75);        // P5 — SW nook gate

    // Interior neon strips so the maze reads at night (decor).
    this._pushBox('neon', 9, 0.14, 0.08, -48, 2.6, 43.79);
    this._pushBox('neon', 9, 0.14, 0.08, -44, 2.6, 38.21);
    this._pushBox('neon', 12, 0.14, 0.08, -46, 2.6, 32.21);
    this._pushBox('neon', 12, 0.14, 0.08, -46, 2.6, 47.79);
    // Door frames (decor).
    this._pushBox('neon', 0.08, 3.3, 0.12, -38.92, 0, 41.9);
    this._pushBox('neon', 0.08, 3.3, 0.12, -38.92, 0, 43.7);
    this._pushBox('neon', 0.12, 3.3, 0.08, -46.0, 0, 31.8);
    this._pushBox('neon', 0.12, 3.3, 0.08, -44.4, 0, 31.8);

    // Roof deck (y 3.6) with railings; reached by the rear outside stair.
    this._solid('fun', 15.4, 0.3, 16.6, -46, 3.3, 40);
    this._rail(15.4, 0.15, -46, 3.6, 48.225);
    this._rail(15.4, 0.15, -46, 3.6, 31.775);
    this._rail(0.15, 16.6, -38.375, 3.6, 40);
    this._rail(0.15, 7.7, -53.625, 3.6, 35.55);  // west rail, gap at stair top
    this._rail(0.15, 7.7, -53.625, 3.6, 44.45);
    for (let k = 1; k <= 9; k++) {
      this._solid('wood', 1.8, k * STEP_RISE, STEP_RUN,
        -54.3, 0, 34 + (k - 1) * STEP_RUN + STEP_RUN / 2);
    }

    // Tilted facade panels (pure decor, deliberately askew).
    for (const [fz, tilt] of [[36, 0.07], [46.6, -0.06]]) {
      const facade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 4.2, 5.5), this._mats.fun);
      facade.position.set(-38.1, 2.1, fz);
      facade.rotation.z = tilt;
      facade.castShadow = true;
      this.group.add(facade);
    }
  }

  // --------------------------------------------------------------- confetti

  _buildConfetti() {
    const N = 160;
    const pos = new Float32Array(N * 3);
    const colArr = new Float32Array(N * 3);
    const palette = [
      new THREE.Color(0xff6ea9), new THREE.Color(0xffd23e),
      new THREE.Color(0x4dd8c0), new THREE.Color(0xff9a4d)
    ];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (this._rng() - 0.5) * 132;
      pos[i * 3 + 1] = 1.5 + this._rng() * 12;
      pos[i * 3 + 2] = (this._rng() - 0.5) * 132;
      const c = palette[Math.floor(this._rng() * palette.length)];
      colArr[i * 3] = c.r;
      colArr[i * 3 + 1] = c.g;
      colArr[i * 3 + 2] = c.b;
    }
    this._confettiBase = pos.slice();
    this._confettiGeo = new THREE.BufferGeometry();
    this._confettiGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._confettiGeo.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.18, vertexColors: true, transparent: true, opacity: 0.85,
      depthWrite: false, sizeAttenuation: true
    });
    const pts = new THREE.Points(this._confettiGeo, mat);
    pts.frustumCulled = false;
    this.group.add(pts);
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: the entrance plaza between the arch and the ticket booths.
    this.policeSpawns = [
      v(0, 0, 65), v(-3, 0, 66), v(3, 0, 66), v(-6, 0, 64), v(6, 0, 64)
    ];
    this.monkeySpawns = [
      v(46, 2.4, -15.5),      // ON the coaster station deck (y 2.4)
      v(46, 0, -15.2),        // UNDER the coaster station deck
      v(0, 0, -32.8),         // inside the ferris queue-rail maze
      v(2.5, 0.8, -36.5),     // on the ferris boarding platform (y 0.8)
      v(-11.8, 0, 47.25),     // behind the counter of a west midway stall
      v(11.8, 0, 12.75),      // behind the counter of an east midway stall
      v(-50.5, 0, 46),        // funhouse NW dead-end nook
      v(-51.5, 0, 34),        // funhouse SW dead-end nook
      v(-46, 3.6, 45),        // funhouse roof deck (y ~3.6)
      v(-33, 0.2, -40),       // bumper rink, between parked cars (y 0.2)
      v(-43, 0.2, -47),       // bumper rink, far corner (y 0.2)
      v(52.3, 0, 38.75),      // inside a food-court snack booth
      v(31, 0, 44),           // under a food-court picnic table
      v(-29.5, 0, 12.5),      // carousel queue, behind the fence ring
      v(10, 0, 66.3),         // behind the east ticket booth
      v(14, 0, 22.4)          // beside the high-striker tower
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
          console.warn('[Funfair] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    const d = this._dummy;

    // 1) Ferris wheel spin + counter-rotated (world-upright) cabins.
    if (this._wheelGroup) this._wheelGroup.rotation.z = time * WHEEL_SPEED;
    if (this._cabinMesh) {
      for (let i = 0; i < CABIN_COUNT; i++) {
        const a = time * WHEEL_SPEED + (i / CABIN_COUNT) * Math.PI * 2;
        d.position.set(Math.cos(a) * WHEEL_R, WHEEL_HUB_Y + Math.sin(a) * WHEEL_R, WHEEL_Z);
        d.rotation.set(0, 0, Math.sin(time * 1.4 + i) * 0.05); // slight pendulum
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this._cabinMesh.setMatrixAt(i, d.matrix);
      }
      this._cabinMesh.instanceMatrix.needsUpdate = true;
    }

    // 2) Coaster train riding the parametric closed curve.
    if (this._trainMesh && this._coasterCurve) {
      const tHead = ((time * 9.5) / this._coasterLen) % 1;
      const spacing = 2.6 / this._coasterLen;
      for (let i = 0; i < 4; i++) {
        const t = (tHead - i * spacing + 1) % 1;
        const p = this._coasterCurve.getPointAt(t);
        const q = this._coasterCurve.getPointAt((t + 0.006) % 1);
        d.position.set(p.x, p.y + 0.32, p.z);
        d.scale.set(1, 1, 1);
        d.lookAt(q.x, q.y + 0.32, q.z);
        d.updateMatrix();
        this._trainMesh.setMatrixAt(i, d.matrix);
      }
      this._trainMesh.instanceMatrix.needsUpdate = true;
    }

    // 3) Carousel spin + bobbing horses.
    if (this._carouselGroup) {
      this._carouselGroup.rotation.y = time * 0.55;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const bob = Math.sin(time * 2.3 + i * 1.4) * 0.18;
        d.position.set(Math.cos(a) * 3.1, 0.25 + bob, Math.sin(a) * 3.1);
        d.rotation.set(0, Math.PI / 2 - a, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this._horseMesh.setMatrixAt(i, d.matrix);
      }
      this._horseMesh.instanceMatrix.needsUpdate = true;
    }

    // 4) String-light twinkle + neon pulse + high-striker climb.
    if (this._bulbMat) {
      this._bulbMat.emissiveIntensity =
        1.15 + 0.55 * Math.sin(time * 3.1) + 0.3 * Math.sin(time * 7.7 + 1.3);
    }
    if (this._neonMat) {
      this._neonMat.emissiveIntensity = 0.95 + 0.2 * Math.sin(time * 1.8);
    }
    if (this._strikerPuck) {
      const cyc = (time * 3.0) % 10;
      this._strikerPuck.position.y = 1.0 + Math.min(cyc, 7.6);
      this._bellMat.emissiveIntensity = cyc > 7.6 ? 2.2 : 0.85;
    }

    // 5) Bumper-pavilion ceiling spark strobes.
    if (this._sparkMat) {
      this._sparkMat.opacity =
        clamp(Math.sin(time * 9.7) * Math.sin(time * 4.3 + 2.1) * 2.2 - 0.9, 0, 1);
    }

    // 6) Drifting confetti.
    if (this._confettiGeo) {
      const attr = this._confettiGeo.attributes.position;
      const arr = attr.array;
      const base = this._confettiBase;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = base[i] + Math.sin(time * 0.4 + i * 0.7) * 1.1;
        arr[i + 1] = base[i + 1] + Math.sin(time * 0.6 + i) * 0.9;
        arr[i + 2] = base[i + 2] + Math.cos(time * 0.33 + i * 1.3) * 1.1;
      }
      attr.needsUpdate = true;
    }
  }
}
