import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * CORAL REEF DOME — "A dry concrete promenade sealed inside a glass dome
 * on the sea bed; the ocean presses in on every side."
 *
 * Layout (124 x 124, sealed at +/-61 by glass wall segments between
 * concrete pillars — full solid colliders):
 * - Centre: coral atrium — four 0.4-step terraced reef shelves rising to a
 *   railed crow's-nest platform (y 3.2, via stair), swaying kelp and
 *   emissive coral clusters.
 * - North: exhibit hall — enterable building with a grid of glass
 *   fish-tank columns, touch-pool tables and kiosks.
 * - West: research wing — moon-pool room (bed -0.4, water -0.15), mini-sub
 *   on a gantry, lockers and a wall catwalk at y 4.4.
 * - East: food court — kiosks, café tables and a golden banana-fish
 *   mascot statue.
 * - South: maintenance pump hall — chest-high pipe runs, ballast tanks
 *   and a catwalk loop at y 4.4 (two stairs). Police airlock at z 56..60.
 * - Outside the glass: sand, rock spires, kelp forests, orbiting fish
 *   schools, drifting jellyfish, rising bubbles — all decor.
 */

const STEP_RISE = 0.4;           // stair riser (<= 0.45 auto-step)
const STEP_RUN = 0.7;            // stair tread depth

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

export default class ReefDomeMap extends MapBase {
  constructor() {
    super();
    this.id = 'REEF_DOME';
    this.name = 'Coral Reef Dome';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-62, -6, -62),
      new THREE.Vector3(62, 50, 62)
    );
    this.killY = -15;
    this.environment = {
      skyColor: 0x0d3b50,
      fog: { color: 0x11506b, near: 22, far: 110 }
    };

    this._rng = mulberry32(0xc0a1ef);
    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh (one draw call) per material.
    this._buckets = {
      concrete: [], steel: [], metal: [], wood: [],
      glass: [], glow: [], gold: [], hull: []
    };
    this._causticsMat = null;
    this._poolWaterMat = null;
    this._kelpMesh = null;
    this._kelpData = [];
    this._schoolMesh = null;
    this._schoolData = [];
    this._tankFishMesh = null;
    this._tankFishData = [];
    this._bubbleGeo = null;
    this._bubbleData = [];
    this._jellies = [];
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._placeSpawns(); // early: scatter decor can respect spawn points
    this._buildLights();
    this._buildFloor();
    this._buildPerimeterDome();
    this._buildOcean();
    this._buildAtrium();
    this._buildExhibitHall();
    this._buildResearchWing();
    this._buildFoodCourt();
    this._buildMaintenance();
    this._buildAirlock();
    this._buildBenchesAndStrips();
    this._buildKelp();
    this._buildCoral();
    this._buildBubbles();
    this._buildJellyfish();
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
    const rng = mulberry32(0x11aa22);
    ctx.fillStyle = '#55666d';
    ctx.fillRect(0, 0, size, size);
    // large tiles with seams
    const tiles = 4;
    const ts = size / tiles;
    for (let r = 0; r < tiles; r++) {
      for (let c = 0; c < tiles; c++) {
        const shade = Math.floor((rng() - 0.5) * 22);
        ctx.fillStyle = `rgba(${88 + shade},${104 + shade},${110 + shade},0.65)`;
        ctx.fillRect(c * ts + 2, r * ts + 2, ts - 4, ts - 4);
      }
    }
    ctx.strokeStyle = 'rgba(24,32,36,0.7)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= tiles; i++) {
      ctx.beginPath(); ctx.moveTo(i * ts, 0); ctx.lineTo(i * ts, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * ts); ctx.lineTo(size, i * ts); ctx.stroke();
    }
    // damp teal stains + speckles
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = `rgba(40,${90 + Math.floor(rng() * 40)},${100 + Math.floor(rng() * 40)},${0.08 + rng() * 0.1})`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 6 + rng() * 30, 4 + rng() * 18,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < 340; i++) {
      const g = 70 + Math.floor(rng() * 60);
      ctx.fillStyle = `rgba(${g},${g + 8},${g + 10},0.35)`;
      ctx.fillRect(rng() * size, rng() * size, 1.4, 1.4);
    }
  }

  _paintMetal(ctx, size) {
    const rng = mulberry32(0x2288ff);
    ctx.fillStyle = '#2f6d76';
    ctx.fillRect(0, 0, size, size);
    const panels = 3;
    const ps = size / panels;
    for (let r = 0; r < panels; r++) {
      for (let c = 0; c < panels; c++) {
        const shade = Math.floor((rng() - 0.5) * 26);
        ctx.fillStyle = `rgba(${52 + shade},${116 + shade},${126 + shade},0.7)`;
        ctx.fillRect(c * ps + 2, r * ps + 2, ps - 4, ps - 4);
        // rivets
        ctx.fillStyle = 'rgba(18,40,44,0.85)';
        for (const [ox, oy] of [[6, 6], [ps - 8, 6], [6, ps - 8], [ps - 8, ps - 8]]) {
          ctx.beginPath();
          ctx.arc(c * ps + ox, r * ps + oy, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = `rgba(200,235,240,${0.04 + rng() * 0.07})`;
      ctx.lineWidth = 1;
      const y = rng() * size;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y + (rng() - 0.5) * 6); ctx.stroke();
    }
  }

  _paintSteel(ctx, size) {
    const rng = mulberry32(0x515e6a);
    ctx.fillStyle = '#39424a';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 90; i++) {
      const g = 48 + Math.floor(rng() * 46);
      ctx.strokeStyle = `rgba(${g},${g + 6},${g + 12},0.4)`;
      ctx.lineWidth = 1 + rng() * 2;
      const y = rng() * size;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      ctx.strokeStyle = 'rgba(16,20,24,0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(rng() * size, rng() * size);
      ctx.lineTo(rng() * size, rng() * size);
      ctx.stroke();
    }
  }

  _paintSand(ctx, size) {
    const rng = mulberry32(0xbeac11);
    ctx.fillStyle = '#6f6a52';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 420; i++) {
      const g = 90 + Math.floor(rng() * 70);
      ctx.fillStyle = `rgba(${g},${g - 8},${g - 30},0.4)`;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 1 + rng() * 3, 1 + rng() * 2,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // ripple ridges
    ctx.strokeStyle = 'rgba(40,42,32,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = (i / 9) * size + rng() * 10;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 16) {
        ctx.lineTo(x, y + Math.sin(x * 0.12 + i) * 4);
      }
      ctx.stroke();
    }
  }

  _paintWater(ctx, size) {
    const rng = mulberry32(0x0a9ed1);
    ctx.fillStyle = '#155f78';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 26; i++) {
      ctx.strokeStyle = `rgba(150,225,235,${0.1 + rng() * 0.16})`;
      ctx.lineWidth = 1.5 + rng() * 2;
      const y = rng() * size;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= size; x += 12) {
        ctx.lineTo(x, y + Math.sin(x * 0.09 + i * 1.7) * 5);
      }
      ctx.stroke();
    }
  }

  _paintCaustics(ctx, size) {
    const rng = mulberry32(0xca57cc);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 60; i++) {
      ctx.strokeStyle = `rgba(${170 + Math.floor(rng() * 60)},235,255,${0.14 + rng() * 0.24})`;
      ctx.lineWidth = 1.5 + rng() * 2.5;
      ctx.beginPath();
      ctx.ellipse(rng() * size, rng() * size, 8 + rng() * 26, 6 + rng() * 20,
        rng() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _makeMaterials() {
    this._causticsMat = new THREE.MeshBasicMaterial({
      map: this._canvasTex(256, (c, s) => this._paintCaustics(c, s)),
      transparent: true, opacity: 0.15, blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this._causticsMat.map.repeat.set(10, 10);
    this._poolWaterMat = new THREE.MeshStandardMaterial({
      map: this._canvasTex(128, (c, s) => this._paintWater(c, s)),
      transparent: true, opacity: 0.78, roughness: 0.25, depthWrite: false
    });
    this._mats = {
      concrete: new THREE.MeshStandardMaterial({
        map: this._canvasTex(256, (c, s) => this._paintConcrete(c, s)), roughness: 0.93
      }),
      steel: new THREE.MeshStandardMaterial({
        map: this._canvasTex(128, (c, s) => this._paintSteel(c, s)),
        roughness: 0.55, metalness: 0.5
      }),
      metal: new THREE.MeshStandardMaterial({
        map: this._canvasTex(128, (c, s) => this._paintMetal(c, s)),
        roughness: 0.62, metalness: 0.3
      }),
      wood: new THREE.MeshStandardMaterial({ color: 0x7c5a38, roughness: 0.85 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0x8fe0dc, transparent: true, opacity: 0.22, roughness: 0.12,
        metalness: 0.1, depthWrite: false, side: THREE.DoubleSide
      }),
      glow: new THREE.MeshStandardMaterial({
        color: 0x0c2a30, emissive: 0x54f0ff, emissiveIntensity: 1.1
      }),
      gold: new THREE.MeshStandardMaterial({
        color: 0xd8a93a, emissive: 0xffc84d, emissiveIntensity: 0.65,
        roughness: 0.35, metalness: 0.65
      }),
      hull: new THREE.MeshStandardMaterial({ color: 0xd9c22e, roughness: 0.5, metalness: 0.35 }),
      sand: new THREE.MeshStandardMaterial({
        map: this._canvasTex(128, (c, s) => this._paintSand(c, s)), roughness: 1
      }),
      kelp: new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 0.8 }),
      coralA: new THREE.MeshStandardMaterial({
        color: 0xd4548a, emissive: 0xff5f9e, emissiveIntensity: 0.5, roughness: 0.7
      }),
      coralB: new THREE.MeshStandardMaterial({
        color: 0xe08840, emissive: 0xff7f2a, emissiveIntensity: 0.45, roughness: 0.7
      }),
      fish: new THREE.MeshStandardMaterial({
        color: 0xa8d8e8, emissive: 0x39707e, emissiveIntensity: 0.35, roughness: 0.5
      }),
      tankFish: new THREE.MeshStandardMaterial({
        color: 0xe8b84a, emissive: 0x8f5a12, emissiveIntensity: 0.3, roughness: 0.5
      }),
      rock: new THREE.MeshStandardMaterial({ color: 0x2c3f46, roughness: 0.95 }),
      jelly: new THREE.MeshStandardMaterial({
        color: 0xc9a8f0, emissive: 0x8f7fff, emissiveIntensity: 0.4,
        transparent: true, opacity: 0.32, depthWrite: false
      })
    };
    this._mats.sand.map.repeat.set(24, 24);
  }

  // ----------------------------------------------------- merge/mesh helpers

  /** Pushes a Y-bottomed box into a merge bucket (visual only). */
  _pushBox(bucket, w, h, d, x, y, z, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    scaleUV(g, clamp(Math.max(w, d) / 3, 0.4, 40), clamp(h / 3, 0.4, 40));
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    this._buckets[bucket].push(g);
  }

  /** Pushes a Y-axis cylinder into a merge bucket (visual only). */
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

  /**
   * Solid stepped stair run (0.4 rise / 0.7 run). `edge` is the platform-edge
   * coordinate along `axis`; steps descend away in direction `dir`.
   */
  _stairRun(bucket, axis, edge, dir, count, floorY, cross, width) {
    for (let i = 0; i < count; i++) {
      const top = floorY + (count - i) * STEP_RISE;
      const c = edge + dir * (i + 0.5) * STEP_RUN;
      if (axis === 'z') {
        this._solid(bucket, width, top - floorY, STEP_RUN, cross, floorY, c);
      } else {
        this._solid(bucket, STEP_RUN, top - floorY, width, c, floorY, cross);
      }
    }
  }

  _flushBuckets() {
    const matFor = {
      concrete: this._mats.concrete, steel: this._mats.steel,
      metal: this._mats.metal, wood: this._mats.wood,
      glass: this._mats.glass, glow: this._mats.glow,
      gold: this._mats.gold, hull: this._mats.hull
    };
    for (const key of Object.keys(this._buckets)) {
      const list = this._buckets[key];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      list.length = 0;
      const mesh = new THREE.Mesh(merged, matFor[key]);
      mesh.castShadow = key !== 'glass' && key !== 'glow';
      mesh.receiveShadow = key !== 'glass';
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
    // Single soft teal-white key light filtering down through the sea.
    const sun = new THREE.DirectionalLight(0xcfeef2, 0.8);
    sun.position.set(35, 70, -25);
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

    // High fills so the dim underwater palette keeps readable silhouettes.
    this.group.add(new THREE.HemisphereLight(0x7fd4e8, 0x0a2833, 0.95));
    this.group.add(new THREE.AmbientLight(0x3f6672, 0.55));
  }

  // ------------------------------------------------------------------ floor

  /** Concrete floor slab with top surface at `top`. */
  _floorSlab(w, d, x, z, top) {
    this._pushBox('concrete', w, 1.2, d, x, top - 1.2, z);
    this._boxCollider(w, 1.2, d, x, top - 1.2, z);
  }

  _buildFloor() {
    // Main promenade, split around the research-wing moon-pool recess
    // (pool x -46..-36, z -6..4; bed top -0.4).
    this._floorSlab(124, 56, 0, -34, 0);     // north of pool band
    this._floorSlab(124, 58, 0, 33, 0);      // south of pool band
    this._floorSlab(16, 10, -54, -1, 0);     // pool band, west of pool
    this._floorSlab(98, 10, 13, -1, 0);      // pool band, east of pool
    this._floorSlab(10, 10, -41, -1, -0.4);  // moon-pool bed (steppable 0.4)

    // Caustics overlay — its texture scrolls in update().
    const caustics = new THREE.Mesh(new THREE.PlaneGeometry(124, 124), this._causticsMat);
    caustics.rotation.x = -Math.PI / 2;
    caustics.position.set(0, 0.02, 0);
    this.group.add(caustics);
  }

  // -------------------------------------------------------------- perimeter

  _buildPerimeterDome() {
    // Glass wall ring at +/-61: 8 panels per side between concrete pillars.
    // FULL solid colliders per side (bottom -1.4, top 8.4) seal the map.
    const H = 9.4;
    const pillars = [];
    for (let i = 0; i <= 8; i++) pillars.push(-60.5 + i * 15.125);
    for (let i = 0; i <= 8; i++) {
      const s = pillars[i];
      this._pushBox('concrete', 1.4, 10.4, 1.4, s, -1.4, -61);
      this._pushBox('concrete', 1.4, 10.4, 1.4, s, -1.4, 61);
      this._pushBox('concrete', 1.4, 10.4, 1.4, -61, -1.4, s);
      this._pushBox('concrete', 1.4, 10.4, 1.4, 61, -1.4, s);
    }
    for (let i = 0; i < 8; i++) {
      const c = (pillars[i] + pillars[i + 1]) / 2;
      const w = 15.125 - 1.4;
      this._pushBox('glass', w, H, 0.35, c, -1.4, -61);
      this._pushBox('glass', w, H, 0.35, c, -1.4, 61);
      this._pushBox('glass', 0.35, H, w, -61, -1.4, c);
      this._pushBox('glass', 0.35, H, w, 61, -1.4, c);
    }
    // Solid sealing colliders (inner face 60.2 so bodies never clip pillars).
    this._boxCollider(126, 9.8, 2.4, 0, -1.4, -61.4);
    this._boxCollider(126, 9.8, 2.4, 0, -1.4, 61.4);
    this._boxCollider(2.4, 9.8, 126, -61.4, -1.4, 0);
    this._boxCollider(2.4, 9.8, 126, 61.4, -1.4, 0);

    // Steel crown beams along the panel tops (decor).
    this._pushBox('steel', 124, 0.5, 1.0, 0, 8.0, -61);
    this._pushBox('steel', 124, 0.5, 1.0, 0, 8.0, 61);
    this._pushBox('steel', 1.0, 0.5, 124, -61, 8.0, 0);
    this._pushBox('steel', 1.0, 0.5, 124, 61, 8.0, 0);

    // Dome-cap arc ribs + a high ring (decor, no colliders, out of reach).
    for (const ry of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
      const rib = new THREE.TorusGeometry(60, 0.5, 6, 26, Math.PI);
      rib.rotateY(ry);
      this._buckets.steel.push(rib);
    }
    const ring = new THREE.TorusGeometry(56, 0.4, 6, 40);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, 18, 0);
    this._buckets.steel.push(ring);
  }

  // ------------------------------------------------- ocean outside the glass

  _buildOcean() {
    // Sea bed extending past the dome (decor — unreachable).
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), this._mats.sand);
    bed.rotation.x = -Math.PI / 2;
    bed.position.set(0, -1.6, 0);
    bed.receiveShadow = true;
    this.group.add(bed);

    // Rock spires scattered around the dome.
    const rockMats = [];
    for (let i = 0; i < 26; i++) {
      const ang = this._rng() * Math.PI * 2;
      const r = 68 + this._rng() * 24;
      const s = 0.6 + this._rng() * 1.2;
      rockMats.push(this._matrixAt(
        Math.cos(ang) * r, -1.6, Math.sin(ang) * r,
        0, this._rng() * Math.PI, 0, s, s * (0.7 + this._rng() * 0.9), s));
    }
    const rockGeo = new THREE.ConeGeometry(2.4, 8, 6);
    rockGeo.translate(0, 4, 0);
    this._makeInstanced(rockGeo, this._mats.rock, rockMats, { cast: false });

    // Fish schools orbiting outside the glass (animated in update()).
    const schools = [
      { cx: 74, cy: 6, cz: -10, r: 9 },
      { cx: -70, cy: 8, cz: 28, r: 11 },
      { cx: 10, cy: 11, cz: 76, r: 8 }
    ];
    const fishGeo = new THREE.ConeGeometry(0.16, 0.6, 6);
    fishGeo.rotateX(Math.PI / 2); // point along +Z, matches orbit heading
    const mats = [];
    for (const s of schools) {
      for (let i = 0; i < 16; i++) {
        this._schoolData.push({
          cx: s.cx, cy: s.cy + (this._rng() - 0.5) * 3, cz: s.cz,
          r: s.r * (0.7 + this._rng() * 0.5),
          speed: 0.25 + this._rng() * 0.25,
          phase: this._rng() * Math.PI * 2,
          bob: 0.5 + this._rng() * 1.2
        });
        mats.push(this._matrixAt(s.cx, s.cy, s.cz, 0, 0, 0, 1, 1, 1));
      }
    }
    this._schoolMesh = this._makeInstanced(fishGeo, this._mats.fish, mats,
      { cast: false, receive: false });
  }

  // ------------------------------------------------------------ coral atrium

  _buildAtrium() {
    // Four terraced reef shelves, each a 0.4 auto-step.
    this._solid('concrete', 20, 0.4, 20, 0, 0, 0);
    this._solid('concrete', 16, 0.8, 16, 0, 0, 0);
    this._solid('concrete', 12, 1.2, 12, 0, 0, 0);
    this._solid('concrete', 9, 1.6, 9, 0, 0, 0);

    // Crow's-nest: column + platform at y 3.2, reached by a 3-step stair
    // from the top shelf (1.6 -> 2.0/2.4/2.8 -> 3.2).
    this._solid('steel', 1.2, 1.3, 1.2, 0, 1.6, 0);
    this._solid('steel', 3, 0.3, 3, 0, 2.9, 0);
    this._stairRun('steel', 'z', 1.5, 1, 3, 1.6, 0, 1.6);
    // Railings (south edge open at the stair).
    this._solid('steel', 3.0, 0.9, 0.14, 0, 3.2, -1.43);
    this._solid('steel', 0.14, 0.9, 3.0, -1.43, 3.2, 0);
    this._solid('steel', 0.14, 0.9, 3.0, 1.43, 3.2, 0);
    this._solid('steel', 0.7, 0.9, 0.14, -1.15, 3.2, 1.43);
    this._solid('steel', 0.7, 0.9, 0.14, 1.15, 3.2, 1.43);
  }

  // ------------------------------------------------------------ exhibit hall

  _buildExhibitHall() {
    // Enterable building x -20..20, z -50..-26. Two door gaps in the south
    // wall at x +/-4 (2.6 wide, 2.5 high).
    const H = 5;
    this._solid('concrete', 40.6, H, 0.6, 0, 0, -50);          // north
    this._solid('concrete', 0.6, H, 23.4, -20, 0, -38);        // west
    this._solid('concrete', 0.6, H, 23.4, 20, 0, -38);         // east
    this._solid('concrete', 15, H, 0.6, -12.8, 0, -26);        // south, west run
    this._solid('concrete', 5.4, H, 0.6, 0, 0, -26);           // south, centre
    this._solid('concrete', 15, H, 0.6, 12.8, 0, -26);         // south, east run
    this._solid('concrete', 2.6, H - 2.5, 0.6, -4, 2.5, -26);  // lintels
    this._solid('concrete', 2.6, H - 2.5, 0.6, 4, 2.5, -26);
    this._solid('concrete', 41.2, 0.5, 25.2, 0, H, -38);       // roof

    // Grid of glass fish-tank columns (full colliders; some hold fish).
    const tankXs = [-13, -4.5, 4.5, 13];
    const tankZs = [-43, -34];
    for (const tx of tankXs) {
      for (const tz of tankZs) {
        this._pushCyl('metal', 1.2, 1.25, 0.5, 12, tx, 0, tz);   // base
        this._pushCyl('glass', 1.0, 1.0, 3.4, 12, tx, 0.5, tz);  // water column
        this._pushCyl('metal', 1.15, 1.15, 0.25, 12, tx, 3.9, tz); // cap
        this._boxCollider(2.3, 4.3, 2.3, tx, 0, tz);
      }
    }
    // A few fish orbiting inside three of the tanks.
    const tankFishGeo = new THREE.ConeGeometry(0.09, 0.32, 5);
    tankFishGeo.rotateX(Math.PI / 2);
    const tfMats = [];
    for (const [tx, tz] of [[-13, -43], [4.5, -34], [13, -43]]) {
      for (let i = 0; i < 3; i++) {
        this._tankFishData.push({
          cx: tx, cy: 1.2 + this._rng() * 2.2, cz: tz,
          r: 0.45 + this._rng() * 0.25,
          speed: 0.8 + this._rng() * 0.8,
          phase: this._rng() * Math.PI * 2
        });
        tfMats.push(this._matrixAt(tx, 2, tz, 0, 0, 0, 1, 1, 1));
      }
    }
    this._tankFishMesh = this._makeInstanced(tankFishGeo, this._mats.tankFish,
      tfMats, { cast: false, receive: false });

    // Touch-pool tables: raised slab on corner legs (open beneath the lip).
    for (const px of [-8.5, 8.5]) {
      const pz = -38.5;
      this._pushBox('metal', 3.0, 0.2, 1.4, px, 0.75, pz);
      this._boxCollider(3.0, 0.2, 1.4, px, 0.75, pz);
      this._pushBox('glow', 2.6, 0.05, 1.0, px, 0.96, pz); // lit water surface
      for (const lx of [-1.3, 1.3]) {
        for (const lz of [-0.55, 0.55]) {
          this._solid('steel', 0.16, 0.75, 0.16, px + lx, 0, pz + lz);
        }
      }
    }

    // Kiosks near the entrances.
    this._buildKiosk(-16, -29);
    this._buildKiosk(16.5, -47.5);
  }

  /** Ticket/snack kiosk: solid body, awning + glowing sign (decor). */
  _buildKiosk(x, z) {
    this._solid('metal', 2.4, 2.3, 2.2, x, 0, z);
    this._pushBox('steel', 3.0, 0.15, 2.8, x, 2.3, z);
    this._pushBox('glow', 1.8, 0.35, 0.15, x, 1.75, z + 1.12);
  }

  // ----------------------------------------------------------- research wing

  _buildResearchWing() {
    // Room x -52..-28, z -14..12; door gaps: east wall (z -1, 3 wide) and
    // north wall (x -40, 2.6 wide), both 2.5 high.
    const H = 7.2;
    this._solid('concrete', 0.6, H, 26.6, -52, 0, -1);          // west
    this._solid('concrete', 24.6, H, 0.6, -40, 0, 12);          // south
    this._solid('concrete', 11, H, 0.6, -46.8, 0, -14);         // north, west run
    this._solid('concrete', 11, H, 0.6, -33.2, 0, -14);         // north, east run
    this._solid('concrete', 2.6, H - 2.5, 0.6, -40, 2.5, -14);  // north lintel
    this._solid('concrete', 0.6, H, 11.8, -28, 0, -8.4);        // east, north run
    this._solid('concrete', 0.6, H, 11.8, -28, 0, 6.4);         // east, south run
    this._solid('concrete', 0.6, H - 2.5, 3, -28, 2.5, -1);     // east lintel
    this._solid('concrete', 25.2, 0.5, 27.2, -40, H, -1);       // roof

    // Moon pool: water plane over the recessed bed (bed built in _buildFloor).
    const water = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 9.6), this._poolWaterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(-41, -0.15, -1);
    this.group.add(water);
    // Glow trim around the pool mouth.
    this._pushBox('glow', 10.6, 0.06, 0.3, -41, 0.001, -6.15);
    this._pushBox('glow', 10.6, 0.06, 0.3, -41, 0.001, 4.15);
    this._pushBox('glow', 0.3, 0.06, 10.6, -46.15, 0.001, -1);
    this._pushBox('glow', 0.3, 0.06, 10.6, -35.85, 0.001, -1);

    // Gantry over the pool with the mini-sub prop (sub is decor).
    for (const [gx, gz] of [[-46.6, -6.6], [-46.6, 4.6], [-35.4, -6.6], [-35.4, 4.6]]) {
      this._solid('steel', 0.35, 3.6, 0.35, gx, 0, gz);
    }
    this._pushBox('steel', 11.6, 0.3, 0.35, -41, 3.6, -6.6);
    this._pushBox('steel', 11.6, 0.3, 0.35, -41, 3.6, 4.6);
    this._pushBox('steel', 0.35, 0.3, 11.55, -41, 3.6, -1);
    this._pushBox('steel', 0.06, 0.9, 0.06, -41, 2.7, -2.2); // hoist cables
    this._pushBox('steel', 0.06, 0.9, 0.06, -41, 2.7, 0.2);
    const subBody = new THREE.CylinderGeometry(0.55, 0.55, 2.4, 10);
    subBody.rotateX(Math.PI / 2);
    subBody.translate(-41, 2.1, -1);
    this._buckets.hull.push(subBody);
    const nose = new THREE.SphereGeometry(0.55, 10, 8);
    nose.translate(-41, 2.1, 0.2);
    this._buckets.hull.push(nose);
    const tail = new THREE.SphereGeometry(0.55, 10, 8);
    tail.translate(-41, 2.1, -2.2);
    this._buckets.hull.push(tail);
    this._pushCyl('hull', 0.28, 0.32, 0.4, 8, -41, 2.6, -0.6);  // conning tower
    this._pushBox('hull', 0.1, 0.5, 0.7, -41, 2.2, -2.55);      // tail fin

    // Lockers along the east wall, in two banks with a hiding gap between.
    for (const lz of [3, 4.1, 5.2, 7.3, 8.4, 9.5]) {
      this._solid('metal', 0.7, 2.0, 1.0, -28.65, 0, lz);
    }

    // Wall catwalk at y 4.4 (west + north legs) reached by a 10-step stair.
    this._solid('steel', 1.8, 0.3, 22.7, -50.8, 4.1, -2.35);   // west leg
    this._solid('steel', 11.9, 0.3, 1.8, -43.95, 4.1, -12.8);  // north leg
    this._stairRun('steel', 'x', -38, 1, 10, 0, -12.8, 1.6);
    this._solid('steel', 0.14, 0.95, 20.9, -49.97, 4.4, -1.45); // rails
    this._solid('steel', 11.9, 0.95, 0.14, -43.95, 4.4, -11.97);
    this._solid('steel', 1.8, 0.95, 0.14, -50.8, 4.4, 8.95);
  }

  // ------------------------------------------------------------- food court

  _buildFoodCourt() {
    this._buildKiosk(36, 6);
    this._buildKiosk(52, -8);

    // Café tables (pole + round top; simple solid collider).
    for (const [tx, tz] of [[32, -5], [38, -9], [34, 2], [48, 3]]) {
      this._pushCyl('steel', 0.12, 0.16, 0.72, 8, tx, 0, tz);
      this._pushCyl('metal', 0.8, 0.8, 0.06, 12, tx, 0.72, tz);
      this._boxCollider(1.6, 0.95, 1.6, tx, 0, tz);
    }

    // Golden banana-fish mascot statue on a pedestal (emissive, pulses).
    const mx = 44, mz = 0;
    this._pushCyl('metal', 1.2, 1.3, 0.9, 14, mx, 0, mz);
    this._boxCollider(2.6, 1.0, 2.6, mx, 0, mz);
    const body = new THREE.TorusGeometry(0.9, 0.34, 8, 14, Math.PI * 0.95);
    body.rotateZ(Math.PI * 0.05);
    body.translate(mx, 2.1, mz);
    this._buckets.gold.push(body);
    const tailFin = new THREE.ConeGeometry(0.34, 0.8, 8);
    tailFin.rotateZ(Math.PI / 2);
    tailFin.translate(mx - 1.25, 1.8, mz);
    this._buckets.gold.push(tailFin);
    const eye = new THREE.SphereGeometry(0.16, 8, 6);
    eye.translate(mx + 1.0, 2.35, mz + 0.22);
    this._buckets.gold.push(eye);
    this._pushBox('gold', 0.1, 0.5, 0.4, mx, 2.9, mz); // dorsal fin
  }

  // ------------------------------------------------------- maintenance hall

  _buildMaintenance() {
    // Pump hall x -16..14, z 30..50; two door gaps in the north wall at
    // x -8 and x 6 (2.8 wide, 2.5 high).
    const H = 7.4;
    this._solid('concrete', 30.6, H, 0.6, -1, 0, 50);          // south
    this._solid('concrete', 0.6, H, 19.4, -16, 0, 40);         // west
    this._solid('concrete', 0.6, H, 19.4, 14, 0, 40);          // east
    this._solid('concrete', 6.9, H, 0.6, -12.85, 0, 30);       // north, west run
    this._solid('concrete', 11.2, H, 0.6, -1, 0, 30);          // north, centre
    this._solid('concrete', 6.3, H, 0.6, 10.55, 0, 30);        // north, east run
    this._solid('concrete', 2.8, H - 2.5, 0.6, -8, 2.5, 30);   // lintels
    this._solid('concrete', 2.8, H - 2.5, 0.6, 6, 2.5, 30);
    this._solid('concrete', 31.2, 0.5, 21.2, -1, H, 40);       // roof

    // Chest-high pipe runs with walking gaps aligned to the doors.
    const pipeRun = (cx, len, z) => {
      const pipe = new THREE.CylinderGeometry(0.32, 0.32, len, 10);
      pipe.rotateZ(Math.PI / 2);
      pipe.translate(cx, 0.95, z);
      this._buckets.steel.push(pipe);
      const pipe2 = new THREE.CylinderGeometry(0.16, 0.16, len, 8);
      pipe2.rotateZ(Math.PI / 2);
      pipe2.translate(cx, 1.35, z);
      this._buckets.steel.push(pipe2);
      this._boxCollider(len, 1.35, 0.8, cx, 0, z);
    };
    pipeRun(-12.5, 5.8, 34.5);
    pipeRun(-0.9, 10.6, 34.5);
    pipeRun(10.5, 5.8, 34.5);
    pipeRun(-8.7, 13.4, 43);
    pipeRun(7.95, 10.9, 43);
    // Vertical feeders at a few pipe ends (decor, inside collider regions).
    for (const [vx, vz] of [[-15.2, 34.5], [4.2, 34.5], [-15.2, 43], [13.2, 43]]) {
      this._pushCyl('steel', 0.28, 0.28, 3.2, 8, vx, 0, vz);
    }

    // Pump units.
    for (const px of [-8, 0, 8]) {
      this._pushBox('metal', 2.0, 1.2, 2.0, px, 0, 38);
      this._pushCyl('steel', 0.6, 0.66, 1.4, 10, px, 1.2, 38);
      this._pushBox('glow', 0.5, 0.2, 0.06, px, 0.8, 39.02);
      this._boxCollider(2.0, 2.6, 2.0, px, 0, 38);
    }

    // Ballast tanks along the south wall (hiding slot behind them).
    for (const bx of [-9, 0, 9]) {
      this._pushCyl('metal', 1.55, 1.55, 5.2, 14, bx, 0, 46.8);
      const dome = new THREE.SphereGeometry(1.55, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      dome.translate(bx, 5.2, 46.8);
      this._buckets.metal.push(dome);
      this._boxCollider(3.3, 5.4, 3.3, bx, 0, 46.8);
    }

    // Catwalk loop at y 4.4 (west + north + east legs, two stairs down).
    this._solid('steel', 1.8, 0.3, 11, -14.8, 4.1, 36.5);      // west leg
    this._solid('steel', 25.8, 0.3, 1.8, -1, 4.1, 31.2);       // north leg
    this._solid('steel', 1.8, 0.3, 11, 12.8, 4.1, 36.5);       // east leg
    this._stairRun('steel', 'z', 42, 1, 10, 0, -14.8, 1.6);
    this._stairRun('steel', 'z', 42, 1, 10, 0, 12.8, 1.6);
    this._solid('steel', 0.14, 0.95, 11, -13.97, 4.4, 36.5);   // rails
    this._solid('steel', 25.8, 0.95, 0.14, -1, 4.4, 32.17);
    this._solid('steel', 0.14, 0.95, 11, 11.97, 4.4, 36.5);
  }

  // ---------------------------------------------------------------- airlock

  _buildAirlock() {
    // Police entry chamber against the south glass, z 54.5..61.
    this._solid('concrete', 0.6, 4, 6.5, -5.4, 0, 57.75);
    this._solid('concrete', 0.6, 4, 6.5, 5.4, 0, 57.75);
    this._solid('concrete', 3.3, 4, 0.6, -4.05, 0, 54.5);
    this._solid('concrete', 3.3, 4, 0.6, 4.05, 0, 54.5);
    this._solid('concrete', 4.8, 1.5, 0.6, 0, 2.5, 54.5);   // lintel (2.5 clear)
    this._solid('concrete', 11.4, 0.4, 6.5, 0, 4, 57.75);   // roof
    this._pushBox('glow', 4.8, 0.25, 0.2, 0, 3.6, 54.15);   // door warning strip

    // Circular hatch on the seaward side (decor).
    const rim = new THREE.TorusGeometry(1.3, 0.16, 8, 20);
    rim.translate(0, 1.7, 60.15);
    this._buckets.steel.push(rim);
    const hatch = new THREE.CylinderGeometry(1.25, 1.25, 0.12, 20);
    hatch.rotateX(Math.PI / 2);
    hatch.translate(0, 1.7, 60.2);
    this._buckets.metal.push(hatch);
  }

  // ----------------------------------------------- benches + light strips

  _buildBenchesAndStrips() {
    // Benches on the atrium diagonals.
    for (const [bx, bz] of [[13.5, 13.5], [-13.5, 13.5], [13.5, -13.5], [-13.5, -13.5]]) {
      this._pushBox('wood', 2.0, 0.15, 0.6, bx, 0.42, bz);
      this._pushBox('wood', 2.0, 0.5, 0.12, bx, 0.57, bz + 0.28);
      this._solid('steel', 0.15, 0.42, 0.5, bx - 0.8, 0, bz);
      this._solid('steel', 0.15, 0.42, 0.5, bx + 0.8, 0, bz);
      this._boxCollider(2.0, 0.62, 0.6, bx, 0, bz);
    }

    // Emissive guide strips down each promenade (decor, walk-over).
    for (const sx of [-1.6, 1.6]) {
      this._pushBox('glow', 0.5, 0.045, 13.6, sx, 0.001, -18.8); // to exhibit hall
      this._pushBox('glow', 0.5, 0.045, 18.7, sx, 0.001, 20.35); // to maintenance
    }
    for (const sz of [-1.6, 1.6]) {
      this._pushBox('glow', 16, 0.045, 0.5, 19, 0.001, sz);      // to food court
      this._pushBox('glow', 16, 0.045, 0.5, -19, 0.001, sz);     // to research wing
    }
  }

  // -------------------------------------------------------- kelp and coral

  _buildKelp() {
    const geo = new THREE.CylinderGeometry(0.05, 0.16, 3.2, 5);
    geo.translate(0, 1.6, 0); // origin at base so sway pivots at the floor
    const mats = [];
    const add = (x, y, z, s) => {
      this._kelpData.push({ x, y, z, s, phase: this._rng() * Math.PI * 2 });
      mats.push(this._matrixAt(x, y, z, 0, 0, 0, s, s, s));
    };
    // Atrium shelf rings.
    for (let i = 0; i < 26; i++) {
      const ang = this._rng() * Math.PI * 2;
      const ring = i % 3;
      const r = [9.2, 7.2, 5.3][ring];
      const y = [0.4, 0.8, 1.2][ring];
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      if (Math.abs(x - 9) < 1 && Math.abs(z) < 1) continue; // keep shelf spawn clear
      add(x, y, z, 0.45 + this._rng() * 0.5);
    }
    // Hiding cluster south-west of the atrium (spawn sits inside it).
    for (let i = 0; i < 8; i++) {
      add(-14 + (this._rng() - 0.5) * 3.4, 0, 9 + (this._rng() - 0.5) * 3.4,
        0.7 + this._rng() * 0.5);
    }
    // Forests outside the glass.
    for (let i = 0; i < 40; i++) {
      const ang = this._rng() * Math.PI * 2;
      const r = 64 + this._rng() * 18;
      add(Math.cos(ang) * r, -1.6, Math.sin(ang) * r, 1.0 + this._rng() * 1.6);
    }
    this._kelpMesh = this._makeInstanced(geo, this._mats.kelp, mats, { cast: false });
  }

  _buildCoral() {
    // Emissive coral clusters: pink lumps + orange spikes (decor).
    const lump = new THREE.SphereGeometry(0.5, 6, 5);
    const spike = new THREE.ConeGeometry(0.3, 0.95, 6);
    spike.translate(0, 0.47, 0);
    const pink = [];
    const orange = [];
    const cluster = (cx, cy, cz, n) => {
      for (let i = 0; i < n; i++) {
        const ox = (this._rng() - 0.5) * 2.4;
        const oz = (this._rng() - 0.5) * 2.4;
        const s = 0.4 + this._rng() * 0.8;
        if (this._rng() < 0.55) {
          pink.push(this._matrixAt(cx + ox, cy + 0.1 * s, cz + oz,
            0, this._rng() * Math.PI, 0, s, s * 0.7, s));
        } else {
          orange.push(this._matrixAt(cx + ox, cy, cz + oz,
            0, this._rng() * Math.PI, 0, s, s, s));
        }
      }
    };
    cluster(-6, 0.4, -7, 6);   // atrium shelves
    cluster(6.5, 0.8, 5.5, 6);
    cluster(-4, 1.2, 4, 5);
    cluster(3, 1.6, -3, 4);
    cluster(-43.5, -0.4, 1.5, 5); // moon-pool bed corner
    for (let i = 0; i < 7; i++) { // sea bed outside
      const ang = this._rng() * Math.PI * 2;
      const r = 64 + this._rng() * 14;
      cluster(Math.cos(ang) * r, -1.6, Math.sin(ang) * r, 4);
    }
    this._makeInstanced(lump, this._mats.coralA, pink, { cast: false });
    this._makeInstanced(spike, this._mats.coralB, orange, { cast: false });
  }

  // ----------------------------------------------------- bubbles + jellies

  _buildBubbles() {
    // Rising bubble columns (positions wrap in update()).
    const columns = [
      { x: 6, y: 0.4, z: 6, h: 7 },
      { x: -5.5, y: 0.4, z: -6.5, h: 7 },
      { x: -41, y: -0.4, z: -1, h: 6 },      // moon pool
      { x: 44, y: 1.0, z: 0, h: 5 },         // mascot statue
      { x: 66, y: -1.6, z: 18, h: 10 },      // outside the glass
      { x: -64, y: -1.6, z: -36, h: 10 }
    ];
    const positions = [];
    for (const col of columns) {
      for (let i = 0; i < 12; i++) {
        this._bubbleData.push({
          x: col.x + (this._rng() - 0.5) * 0.8,
          z: col.z + (this._rng() - 0.5) * 0.8,
          y0: col.y, h: col.h,
          speed: 0.9 + this._rng() * 0.9,
          phase: this._rng() * col.h
        });
        positions.push(col.x, col.y, col.z);
      }
    }
    this._bubbleGeo = new THREE.BufferGeometry();
    this._bubbleGeo.setAttribute('position',
      new THREE.BufferAttribute(new Float32Array(positions), 3));
    const points = new THREE.Points(this._bubbleGeo, new THREE.PointsMaterial({
      color: 0xcfeeff, size: 0.16, transparent: true, opacity: 0.65,
      depthWrite: false, sizeAttenuation: true
    }));
    this.group.add(points);
  }

  _buildJellyfish() {
    // Translucent jellyfish drifting outside the dome (decor).
    const geo = new THREE.SphereGeometry(0.8, 10, 8);
    const bases = [
      new THREE.Vector3(68, 8, 10), new THREE.Vector3(-66, 10, -20),
      new THREE.Vector3(30, 12, -70), new THREE.Vector3(-20, 9, 70)
    ];
    for (let i = 0; i < bases.length; i++) {
      const mesh = new THREE.Mesh(geo, this._mats.jelly);
      mesh.scale.set(1, 0.7, 1);
      mesh.position.copy(bases[i]);
      this.group.add(mesh);
      this._jellies.push({ mesh, base: bases[i], phase: i * 1.7 });
    }
  }

  // ----------------------------------------------------------------- spawns

  _placeSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // Police: airlock chamber against the south glass (z 56..60).
    this.policeSpawns = [
      v(-2.2, 0, 57.2), v(2.2, 0, 57.2), v(0, 0, 58.6),
      v(-3.4, 0, 59.4), v(3.4, 0, 59.4)
    ];
    this.monkeySpawns = [
      v(9, 0.4, 0),          // first reef-shelf ledge, east side
      v(-3.2, 1.6, -3.2),    // elevated top reef shelf, behind the nest column
      v(0, 3.2, 0),          // crow's-nest platform
      v(-13, 0, -46),        // behind the NW fish-tank column
      v(4.5, 0, -31.7),      // behind a tank column near the exhibit doors
      v(-41, -0.4, -1),      // moon-pool bed, under the mini-sub
      v(-50.8, 4.4, 2),      // research-wing wall catwalk
      v(-28.95, 0, 6.25),    // gap between the locker banks
      v(-18.4, 0, -29),      // behind the exhibit-hall kiosk
      v(36, 0, 8.3),         // behind the food-court kiosk
      v(46.3, 0, 0),         // behind the golden mascot statue
      v(4, 0, 41.5),         // pump-hall floor, among the machinery
      v(5, 0, 49.05),        // slot behind the ballast tanks
      v(8.5, 0, -37.3),      // under the touch-pool table lip
      v(-14, 0, 9)           // inside the kelp cluster SW of the atrium
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
          console.warn('[ReefDome] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(_dt, time) {
    // 1) Caustics shimmer across the floor.
    if (this._causticsMat && this._causticsMat.map) {
      this._causticsMat.map.offset.x = (time * 0.018) % 1;
      this._causticsMat.map.offset.y = (time * 0.011) % 1;
    }
    // 2) Moon-pool water drift.
    if (this._poolWaterMat && this._poolWaterMat.map) {
      this._poolWaterMat.map.offset.x = (time * 0.04) % 1;
      this._poolWaterMat.map.offset.y = Math.sin(time * 0.5) * 0.02;
    }
    // 3) Kelp sway.
    if (this._kelpMesh) {
      const d = this._dummy;
      for (let i = 0; i < this._kelpData.length; i++) {
        const k = this._kelpData[i];
        d.position.set(k.x, k.y, k.z);
        d.rotation.set(
          Math.cos(time * 0.7 + k.phase) * 0.09,
          0,
          Math.sin(time * 0.8 + k.phase) * 0.13
        );
        d.scale.set(k.s, k.s, k.s);
        d.updateMatrix();
        this._kelpMesh.setMatrixAt(i, d.matrix);
      }
      this._kelpMesh.instanceMatrix.needsUpdate = true;
    }
    // 4) Fish schools orbiting outside the glass.
    if (this._schoolMesh) {
      const d = this._dummy;
      for (let i = 0; i < this._schoolData.length; i++) {
        const f = this._schoolData[i];
        const a = time * f.speed + f.phase;
        d.position.set(
          f.cx + Math.cos(a) * f.r,
          f.cy + Math.sin(time * 0.9 + f.phase) * f.bob,
          f.cz + Math.sin(a) * f.r
        );
        d.rotation.set(0, -a, 0); // heading tangent to the orbit
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this._schoolMesh.setMatrixAt(i, d.matrix);
      }
      this._schoolMesh.instanceMatrix.needsUpdate = true;
    }
    // 5) Tank fish orbiting their columns.
    if (this._tankFishMesh) {
      const d = this._dummy;
      for (let i = 0; i < this._tankFishData.length; i++) {
        const f = this._tankFishData[i];
        const a = time * f.speed + f.phase;
        d.position.set(f.cx + Math.cos(a) * f.r, f.cy, f.cz + Math.sin(a) * f.r);
        d.rotation.set(0, -a, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        this._tankFishMesh.setMatrixAt(i, d.matrix);
      }
      this._tankFishMesh.instanceMatrix.needsUpdate = true;
    }
    // 6) Rising bubbles (wrap within each column).
    if (this._bubbleGeo) {
      const attr = this._bubbleGeo.attributes.position;
      const arr = attr.array;
      for (let i = 0; i < this._bubbleData.length; i++) {
        const b = this._bubbleData[i];
        const rise = (b.phase + time * b.speed) % b.h;
        arr[i * 3] = b.x + Math.sin(time * 1.8 + i) * 0.12;
        arr[i * 3 + 1] = b.y0 + rise;
        arr[i * 3 + 2] = b.z + Math.cos(time * 1.5 + i) * 0.12;
      }
      attr.needsUpdate = true;
    }
    // 7) Jellyfish drift + pulse.
    for (const j of this._jellies) {
      j.mesh.position.set(
        j.base.x + Math.sin(time * 0.22 + j.phase) * 4,
        j.base.y + Math.sin(time * 0.5 + j.phase) * 1.4,
        j.base.z + Math.cos(time * 0.18 + j.phase) * 4
      );
      const p = 1 + Math.sin(time * 2.2 + j.phase) * 0.12;
      j.mesh.scale.set(p, 0.7 * (2 - p), p);
    }
    // 8) Mascot statue glow pulse.
    if (this._mats && this._mats.gold) {
      this._mats.gold.emissiveIntensity = 0.55 + 0.3 * (0.5 + 0.5 * Math.sin(time * 1.4));
    }
  }
}
