import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * MONKEYBREAK shared build kit — the FROZEN contract between the map shell
 * (`../MonkeyBreakMap.js`) and the six section builders in this directory
 * (CellBlocks, CentralHub, Yard, PerimeterAndTowers, Underground, props).
 *
 * Section builder rules:
 * - `Math.random` is BANNED in all map code. Use `ctx.makeRng(SEEDS.<YOURS>)`
 *   for every random decision so the map is identical on every client.
 * - Colliders are world-space AABBs only. Collidable `rotY` must be a
 *   multiple of PI/2 (`boxCollider` swaps w/d for odd quarter turns).
 * - Stair risers must be <= 0.45 (the player auto-step height);
 *   `ctx.stairs()` throws otherwise.
 * - Consult `ctx.RESERVED` before placing blocking geometry: those rects are
 *   the two Underground stairwell floor holes (keep them open) and the three
 *   walkable seam corridors between sections (keep them traversable — the
 *   CentralHub main gate is the one sanctioned blocker on SEAM_GATE).
 * - Draw-call budget for the whole map is ~250 (<= 60 while stubs are in
 *   place): push static geometry into merge buckets (one mesh per material)
 *   via `pushBox`/`pushCyl`/`solid`, and use `makeInstanced` for repeats.
 *   Reserve standalone `addMesh` objects for things that must move.
 * - Coordinate conventions: for `pushBox`/`solid`/`stairs`, `y` is the box
 *   BOTTOM; for `matrixAt`, `y` is the instance CENTER. Spawns are FEET
 *   positions on solid ground. The map is never transformed, so local
 *   coordinates equal world coordinates.
 */

/** Fixed seeds — one per section so parallel work stays deterministic. */
export const SEEDS = {
  SHELL: 0x6b0a7e01,
  CELLS: 0xce11b10c,
  HUB: 0x0c3a17a1,
  YARD: 0x9a2dd00d,
  PERIM: 0x9e21ae7e,
  UNDER: 0x5e3e2aa7,
  PROPS: 0x92095eed
};

/** Deterministic PRNG so the map is identical for every client. */
export function mulberry32(seed) {
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

// ---------------------------------------------------------------- RESERVED

/**
 * Keep-clear rects (x/z, inclusive) that every section builder must consult:
 * - HOLE_H1 / HOLE_H2: the shell leaves these floor rects open — they are
 *   the Underground stairwells. Never cover them or block their mouths.
 * - SEAM_*: walkable corridors linking sections; do not place blocking
 *   geometry inside them (the CentralHub main gate on SEAM_GATE is the one
 *   sanctioned, openable blocker).
 */
const RESERVED_RECTS = Object.freeze([
  Object.freeze({ id: 'HOLE_H1', minX: 32, maxX: 36, minZ: -8, maxZ: -2,
    note: 'Underground stairwell hole — keep the floor open here' }),
  Object.freeze({ id: 'HOLE_H2', minX: -42, maxX: -38, minZ: 38, maxZ: 44,
    note: 'Underground stairwell hole — keep the floor open here' }),
  Object.freeze({ id: 'SEAM_GATE', minX: -6, maxX: 6, minZ: -70.5, maxZ: -16,
    note: 'Hub -> main gate corridor; only the mainGate dynamic may block it' }),
  Object.freeze({ id: 'SEAM_WEST', minX: -38, maxX: -8, minZ: -14, maxZ: -6,
    note: 'Cell blocks -> hub corridor; keep walkable' }),
  Object.freeze({ id: 'SEAM_EAST', minX: 8, maxX: 58, minZ: 2, maxZ: 10,
    note: 'Hub -> yard breach corridor; keep walkable' })
]);

// ------------------------------------------------------- procedural paint
// All painters draw with a local mulberry32 rng — never Math.random — so
// every client bakes byte-identical textures.

function canvasTex(size, painter) {
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

function paintConcrete(ctx, size, rng) {
  // Gray concrete with cracks and water stains.
  ctx.fillStyle = '#6e7378';
  ctx.fillRect(0, 0, size, size);
  // Aggregate speckle
  for (let i = 0; i < 600; i++) {
    const g = 100 + Math.floor(rng() * 40);
    ctx.fillStyle = `rgba(${g - 10},${g},${g + 5},0.35)`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      1 + rng() * 3, 1 + rng() * 2, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cracks
  ctx.strokeStyle = 'rgba(40,42,44,0.6)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let x = rng() * size;
    let y = rng() * size;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) {
      x += (rng() - 0.5) * 50;
      y += (rng() - 0.5) * 50;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // Water stains (dark patches)
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = `rgba(50,55,60,${0.08 + rng() * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      8 + rng() * 30, 4 + rng() * 18, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBars(ctx, size, rng) {
  // Dark metal bars with rivets.
  ctx.fillStyle = '#2a2d30';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#3d4247';
  const barW = size / 8;
  for (let x = 0; x < size; x += barW * 2) {
    ctx.fillRect(x, 0, barW - 2, size);
  }
  ctx.fillStyle = '#5a6168';
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 1.5 + rng() * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(20,22,24,0.5)';
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    ctx.arc(rng() * size, rng() * size, 1 + rng() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintDirtyFloor(ctx, size, rng) {
  // Brown-gray floor with scuff marks and shoe prints.
  ctx.fillStyle = '#6b6356';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(50,45,38,${0.08 + rng() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      2 + rng() * 8, 1 + rng() * 4, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Shoe prints (dark sole shapes)
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(40,36,30,${0.12 + rng() * 0.15})`;
    ctx.save();
    ctx.translate(rng() * size, rng() * size);
    ctx.rotate(rng() * Math.PI);
    ctx.beginPath();
    ctx.ellipse(0, 0, 5 + rng() * 3, 2 + rng() * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(6 + rng() * 3, 0, 3 + rng() * 2, 2 + rng() * 1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Light scuffs
  ctx.fillStyle = 'rgba(100,95,85,0.15)';
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      4 + rng() * 10, 1 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintGravel(ctx, size, rng) {
  // Speckled gravel.
  ctx.fillStyle = '#7a7a6e';
  ctx.fillRect(0, 0, size, size);
  const colors = ['#8a8a7a', '#6e6e62', '#949485', '#5e5e54', '#a09f8e', '#707065'];
  for (let i = 0; i < 800; i++) {
    ctx.fillStyle = colors[Math.floor(rng() * colors.length)];
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      1 + rng() * 4, 0.8 + rng() * 3, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Occasional brighter pebbles
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(${160 + Math.floor(rng() * 40)},${160 + Math.floor(rng() * 30)},${130 + Math.floor(rng() * 30)},0.5)`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      1 + rng() * 2, 0.8 + rng() * 1.5, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBarbedWire(ctx, size, rng) {
  // Diagonal strands with barbs.
  ctx.fillStyle = '#3a3e42';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#5a6168';
  ctx.lineWidth = 2;
  for (let row = -size; row < size * 2; row += 16) {
    ctx.beginPath();
    ctx.moveTo(0, row);
    ctx.lineTo(size, row + size);
    ctx.stroke();
  }
  for (let row = -size; row < size * 2; row += 16) {
    ctx.beginPath();
    ctx.moveTo(0, row + 8);
    ctx.lineTo(size, row + 8 + size);
    ctx.stroke();
  }
  ctx.fillStyle = '#7a828a';
  for (let i = 0; i < 60; i++) {
    const bx = rng() * size;
    const by = rng() * size;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(bx + 3 + rng() * 4, by + (rng() - 0.5) * 4);
    ctx.lineTo(bx + 6 + rng() * 3, by + (rng() - 0.5) * 3);
    ctx.closePath();
    ctx.fill();
  }
}

function paintCaution(ctx, size) {
  // Yellow/black diagonal stripes (fully deterministic — no rng needed).
  ctx.fillStyle = '#d9a91c';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#1a1c1d';
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(Math.PI / 4);
  const stripeW = size / 6;
  for (let x = -size; x < size * 2; x += stripeW * 2) {
    ctx.fillRect(x, -size, stripeW, size * 3);
  }
  ctx.restore();
}

function paintTile(ctx, size, rng) {
  // Institutional ceramic tiles with grout lines and grime.
  ctx.fillStyle = '#242a2d';
  ctx.fillRect(0, 0, size, size);
  const n = 6;
  const t = size / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const shade = Math.floor((rng() - 0.5) * 20);
      ctx.fillStyle = `rgb(${146 + shade},${160 + shade},${154 + shade})`;
      ctx.fillRect(c * t + 2, r * t + 2, t - 4, t - 4);
    }
  }
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = `rgba(40,46,44,${0.08 + rng() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      4 + rng() * 18, 3 + rng() * 10, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintBrick(ctx, size, rng) {
  // Aged prison brick with mortar joints.
  ctx.fillStyle = '#4e4038';
  ctx.fillRect(0, 0, size, size);
  const rows = 8;
  const bh = size / rows;
  const bw = bh * 2;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (bw / 2);
    for (let c = -1; c < rows / 2 + 1; c++) {
      const shade = Math.floor((rng() - 0.5) * 30);
      ctx.fillStyle = `rgb(${138 + shade},${82 + shade},${62 + shade})`;
      ctx.fillRect(c * bw + off + 2, r * bh + 2, bw - 4, bh - 4);
    }
  }
  // Soot streaks
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = `rgba(30,26,24,${0.1 + rng() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      3 + rng() * 14, 8 + rng() * 24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintRust(ctx, size, rng) {
  // Scratched steel eaten by rust blotches and drips.
  ctx.fillStyle = '#6d757c';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(120,128,136,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 24; i++) {
    const y = rng() * size;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + (rng() - 0.5) * 10);
    ctx.stroke();
  }
  for (let i = 0; i < 34; i++) {
    ctx.fillStyle = `rgba(${140 + Math.floor(rng() * 40)},${66 + Math.floor(rng() * 28)},${26 + Math.floor(rng() * 16)},${0.2 + rng() * 0.35})`;
    ctx.beginPath();
    ctx.ellipse(rng() * size, rng() * size,
      3 + rng() * 14, 2 + rng() * 9, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  // Vertical rust drips
  for (let i = 0; i < 12; i++) {
    const x = rng() * size;
    ctx.fillStyle = `rgba(128,60,24,${0.15 + rng() * 0.2})`;
    ctx.fillRect(x, rng() * size * 0.5, 1.5 + rng() * 2, 14 + rng() * 40);
  }
}

// --------------------------------------------------------------- materials

function makeMaterials() {
  const concreteTex = canvasTex(256, (c, s) => paintConcrete(c, s, mulberry32(0x6e7378)));
  const barsTex = canvasTex(128, (c, s) => paintBars(c, s, mulberry32(0x2a2d30)));
  const dirtyFloorTex = canvasTex(256, (c, s) => paintDirtyFloor(c, s, mulberry32(0x6b6356)));
  const gravelTex = canvasTex(128, (c, s) => paintGravel(c, s, mulberry32(0x7a7a6e)));
  const barbedWireTex = canvasTex(256, (c, s) => paintBarbedWire(c, s, mulberry32(0x3a3e42)));
  const cautionTex = canvasTex(128, (c, s) => paintCaution(c, s));
  const tileTex = canvasTex(128, (c, s) => paintTile(c, s, mulberry32(0x242a2d)));
  const brickTex = canvasTex(256, (c, s) => paintBrick(c, s, mulberry32(0x4e4038)));
  const rustTex = canvasTex(128, (c, s) => paintRust(c, s, mulberry32(0x6d757c)));

  return {
    concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95, metalness: 0.05 }),
    concreteDark: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95, metalness: 0.05, color: 0x5a6066 }),
    floor: new THREE.MeshStandardMaterial({ map: dirtyFloorTex, roughness: 0.9, metalness: 0.05 }),
    tile: new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.35, metalness: 0.05 }),
    gravel: new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1.0, metalness: 0.0 }),
    bars: new THREE.MeshStandardMaterial({ map: barsTex, roughness: 0.6, metalness: 0.5 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x7a828a, roughness: 0.4, metalness: 0.7 }),
    steelDark: new THREE.MeshStandardMaterial({ color: 0x4a525a, roughness: 0.45, metalness: 0.65 }),
    caution: new THREE.MeshStandardMaterial({ map: cautionTex, roughness: 0.7, metalness: 0.1 }),
    pipe: new THREE.MeshStandardMaterial({ color: 0x8a929a, roughness: 0.35, metalness: 0.8 }),
    dirt: new THREE.MeshStandardMaterial({ color: 0x5a5246, roughness: 1.0, metalness: 0.0 }),
    brick: new THREE.MeshStandardMaterial({ map: brickTex, roughness: 0.9, metalness: 0.0 }),
    rust: new THREE.MeshStandardMaterial({ map: rustTex, roughness: 0.8, metalness: 0.35 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xbfe4f5, transparent: true, opacity: 0.25,
      roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false
    }),
    barbedWire: new THREE.MeshStandardMaterial({ map: barbedWireTex, roughness: 0.7, metalness: 0.4 }),
    lightFixture: new THREE.MeshStandardMaterial({
      color: 0xf2e8c4, emissive: 0xffe9a0, emissiveIntensity: 0.8, roughness: 0.7
    }),
    glow: new THREE.MeshBasicMaterial({ color: 0xff8c1a })
  };
}

// ------------------------------------------------------------ escape items

const ITEM_MAT_DEFS = {
  KEYCARD: { color: 0xf4f8fa, emissive: 0x35e0ff, emissiveIntensity: 0.9, roughness: 0.35, metalness: 0.1 },
  BANANA: { color: 0xffd23f, emissive: 0x8a6a10, emissiveIntensity: 0.25, roughness: 0.6, metalness: 0.0 },
  COFFEE: { color: 0x6b4226, roughness: 0.7, metalness: 0.05 },
  SMOKE: { color: 0x8a9096, roughness: 0.5, metalness: 0.5 }
};

/** One simple primitive per pickup type (<= 1 mesh each). */
function itemGeometry(type) {
  switch (type) {
    case 'KEYCARD': return new THREE.BoxGeometry(0.34, 0.03, 0.22);          // white card
    case 'BANANA': return new THREE.TorusGeometry(0.22, 0.07, 6, 10, Math.PI * 1.2); // crescent
    case 'COFFEE': return new THREE.CylinderGeometry(0.1, 0.08, 0.2, 10);    // cup
    default: return new THREE.CylinderGeometry(0.08, 0.08, 0.26, 10);        // SMOKE canister
  }
}

// ------------------------------------------------------------ build context

/** Shell-only internals (buckets etc.) keyed by ctx; not part of the contract. */
const INTERNALS = new WeakMap();

/**
 * Creates the frozen build context handed to every section builder.
 * Member list is a frozen contract — do not add, rename or remove members.
 * @param {import('../MapBase.js').MapBase} map
 */
export function createBuildContext(map) {
  map.dynamics = map.dynamics || {};
  map.escape = map.escape || {};
  map.escape.exits = map.escape.exits || [];
  map.escape.items = map.escape.items || [];
  map._updaters = map._updaters || [];

  const mats = makeMaterials();
  const buckets = {};
  for (const key of Object.keys(mats)) buckets[key] = [];
  const dummy = new THREE.Object3D();

  const bucketOf = (name) => {
    const list = buckets[name];
    if (!list) throw new Error(`[MonkeyBreak] unknown merge bucket '${name}'`);
    return list;
  };

  /** Pushes a box geometry into a merge bucket; `y` is the box BOTTOM. */
  const pushBox = (bucket, w, h, d, x, y, z, rotY = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    scaleUV(g, clamp(Math.max(w, d) / 3, 0.4, 40), clamp(h / 3, 0.4, 40));
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    bucketOf(bucket).push(g);
  };

  /** Pushes a Y-axis cylinder into a merge bucket; `y` is the cylinder BOTTOM. */
  const pushCyl = (bucket, rTop, rBot, h, seg, x, y, z) => {
    const g = new THREE.CylinderGeometry(rTop, rBot, h, seg);
    scaleUV(g, 2, clamp(h / 3, 0.4, 20));
    g.translate(x, y + h / 2, z);
    bucketOf(bucket).push(g);
  };

  /**
   * Registers an AABB collider; rotY must be a multiple of PI/2 (swaps w/d).
   * @returns {THREE.Box3} the registered collider (mutable — dynamics may move it)
   */
  const boxCollider = (w, h, d, x, y, z, rotY = 0) => {
    const quarter = Math.round(rotY / (Math.PI / 2));
    const swap = ((quarter % 2) + 2) % 2 === 1;
    const hw = (swap ? d : w) / 2;
    const hd = (swap ? w : d) / 2;
    return map.addCollider(new THREE.Box3(
      new THREE.Vector3(x - hw, y, z - hd),
      new THREE.Vector3(x + hw, y + h, z + hd)
    ));
  };

  /** Merged visual box + collider in one call. */
  const solid = (bucket, w, h, d, x, y, z, rotY = 0, collide = true) => {
    pushBox(bucket, w, h, d, x, y, z, rotY);
    if (collide) boxCollider(w, h, d, x, y, z, rotY);
  };

  /**
   * Solid stepped columns (JungleTemple-style stairs). `(x, z)` is the centre
   * of the BOTTOM edge; steps ascend along `dir` ('+x'|'-x'|'+z'|'-z'), each
   * column rising from `baseY`. Step i tops out at `baseY + (i + 1) * rise`.
   */
  const stairs = ({ bucket = 'concrete', x, z, dir, width, steps, rise = 0.4, run = 0.7, baseY = 0 }) => {
    if (rise > 0.45) {
      throw new Error(`[MonkeyBreak] stairs(): rise ${rise} exceeds the 0.45 auto-step limit`);
    }
    const dx = dir === '+x' ? 1 : dir === '-x' ? -1 : 0;
    const dz = dir === '+z' ? 1 : dir === '-z' ? -1 : 0;
    if (dx === 0 && dz === 0) {
      throw new Error(`[MonkeyBreak] stairs(): dir must be '+x'|'-x'|'+z'|'-z', got '${dir}'`);
    }
    for (let i = 0; i < steps; i++) {
      const h = (i + 1) * rise;
      const cx = x + dx * (i + 0.5) * run;
      const cz = z + dz * (i + 0.5) * run;
      const w = dx !== 0 ? run : width;
      const dd = dx !== 0 ? width : run;
      solid(bucket, w, h, dd, cx, baseY, cz);
    }
  };

  /** Adds any Object3D (mesh, light, group…) to the map group. */
  const addMesh = (obj3d) => {
    map.group.add(obj3d);
    return obj3d;
  };

  /** InstancedMesh from prebuilt matrices, added to the map group. */
  const makeInstanced = (geo, mat, matrices, { cast = true, receive = true } = {}) => {
    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    map.group.add(mesh);
    return mesh;
  };

  /** Cloned Matrix4 for makeInstanced; here `y` is the instance CENTER. */
  const matrixAt = (x, y, z, rx, ry, rz, sx, sy, sz) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    return dummy.matrix.clone();
  };

  // Shared escape-items manager: pickups are hidden by default and bob/spin
  // via one registered updater. Registered lazily on the first addEscapeItem.
  const itemsState = { records: [], itemMats: {}, allVisible: false, registered: false };
  const refreshItem = (r) => {
    r.mesh.visible = itemsState.allVisible && !r.taken;
  };
  const ensureItemsManager = () => {
    if (itemsState.registered) return;
    itemsState.registered = true;
    map.dynamics.items = {
      setAllVisible(b) {
        itemsState.allVisible = !!b;
        for (const r of itemsState.records) refreshItem(r);
      },
      setTaken(id, b) {
        const r = itemsState.records.find((rec) => rec.id === id);
        if (!r) return;
        r.taken = !!b;
        refreshItem(r);
      },
      moveTo(id, x, y, z) {
        const r = itemsState.records.find((rec) => rec.id === id);
        if (!r) return;
        r.baseY = y;
        r.mesh.position.set(x, y, z);
        r.entry.x = x;
        r.entry.y = y;
        r.entry.z = z;
      }
    };
    map._updaters.push((_dt, time) => {
      for (const r of itemsState.records) {
        if (!r.mesh.visible) continue;
        r.mesh.position.y = r.baseY + 0.12 * Math.sin(time * 2.2 + r.phase);
        r.mesh.rotation.y = time * 1.6 + r.phase;
      }
    });
  };

  const ctx = {
    /** Material dict; keys double as merge-bucket names. */
    mats,
    /** Fresh deterministic PRNG for a given seed (see SEEDS). */
    makeRng: (seed) => mulberry32(seed),
    pushBox,
    pushCyl,
    boxCollider,
    solid,
    stairs,
    addMesh,
    makeInstanced,
    matrixAt,
    /** FEET-position spawn; call order = spawn index order. */
    addPoliceSpawn: (x, y, z) => {
      map.policeSpawns.push(new THREE.Vector3(x, y, z));
    },
    /** FEET-position spawn; call order = spawn index order. */
    addMonkeySpawn: (x, y, z) => {
      map.monkeySpawns.push(new THREE.Vector3(x, y, z));
    },
    /** Exposes a section API on map.dynamics (e.g. 'mainGate', 'alarm'). */
    registerDynamic: (name, api) => {
      map.dynamics[name] = api;
    },
    /** fn(dt, time) runs every frame via map.update(). */
    registerUpdater: (fn) => {
      map._updaters.push(fn);
    },
    /** Escape-mode exit trigger; ids/coords are frozen contract data. */
    addEscapeExit: ({ id, name, x, y, z, radius, requiresKeycard }) => {
      map.escape.exits.push({ id, name, x, y, z, radius, requiresKeycard: !!requiresKeycard });
    },
    /**
     * Escape-mode pickup: registers the data entry AND builds a small hidden
     * bobbing visual, managed via map.dynamics.items
     * (`setAllVisible(b)` / `setTaken(id, b)` / `moveTo(id, x, y, z)`).
     */
    addEscapeItem: ({ id, type, x, y, z }) => {
      const entry = { id, type, x, y, z };
      map.escape.items.push(entry);
      ensureItemsManager();
      if (!itemsState.itemMats[type]) {
        itemsState.itemMats[type] = new THREE.MeshStandardMaterial(ITEM_MAT_DEFS[type] || ITEM_MAT_DEFS.SMOKE);
      }
      const mesh = new THREE.Mesh(itemGeometry(type), itemsState.itemMats[type]);
      if (type === 'BANANA') mesh.rotation.x = -Math.PI / 2; // lay the crescent flat
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.visible = false;
      map.group.add(mesh);
      itemsState.records.push({
        id, entry, mesh, baseY: y, taken: false,
        phase: itemsState.records.length * 1.37
      });
    },
    /** Keep-clear rects (stairwell holes + seam corridors) — consult before building. */
    RESERVED: RESERVED_RECTS
  };

  INTERNALS.set(ctx, { map, buckets, mats });
  return Object.freeze(ctx);
}

/**
 * Merges every non-empty bucket into one mesh per material and adds it to
 * the map group. Called ONCE by the shell after all sections have built —
 * section builders must never call this.
 */
export function flushBuckets(ctx) {
  const { map, buckets, mats } = INTERNALS.get(ctx);
  const noCast = new Set(['gravel', 'dirt', 'glass', 'glow']);
  for (const key of Object.keys(buckets)) {
    const list = buckets[key];
    if (!list.length) continue;
    const merged = mergeGeometries(list, false);
    for (const g of list) g.dispose();
    list.length = 0;
    const mesh = new THREE.Mesh(merged, mats[key]);
    mesh.castShadow = !noCast.has(key);
    mesh.receiveShadow = true;
    map.group.add(mesh);
  }
}
