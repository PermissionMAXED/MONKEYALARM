import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SEEDS } from './shared.js';

/**
 * PROPS — global set dressing scattered on OPEN ground, avoiding every other
 * section's structures. All randomness comes from ctx.makeRng(SEEDS.PROPS).
 * Meshes beyond the shared buckets: 7 InstancedMesh + 1 merged sign mesh.
 */
export function buildProps(ctx) {
  const rng = ctx.makeRng(SEEDS.PROPS);
  const HPI = Math.PI / 2;
  const q = () => Math.floor(rng() * 4) * HPI;

  // ---- keep-out data: section rects, seam strips, stair holes (+1 m) ----
  const rects = [
    [-62, -24, -58, 20], [-62, -2, 24, 58], [-22, 22, -62, 22],
    [24, 62, -58, -28], [2, 62, 24, 58],
    [-24, -22, -70, 62], [22, 24, -70, 62], [-62, 62, 22, 24],
    [31, 37, -9, -1], [-43, -37, 37, 45]
  ];
  for (const r of ctx.RESERVED) rects.push([r.minX - 0.5, r.maxX + 0.5, r.minZ - 0.5, r.maxZ + 0.5]);
  const exits = [[60.5, 6], [0, -70]];

  // Props builds LAST, so earlier sections' spawn lists are complete. The
  // frozen ctx doesn't expose the map object, so fall back to the Yard
  // spawns known to sit on open scatter ground (every other spawn is inside
  // a keep-out rect) when `ctx.map` is absent.
  const spawns = [[54.1, -20], [48.5, 15.8], [30, -10.5]];
  if (ctx.map) {
    spawns.length = 0;
    for (const list of [ctx.map.policeSpawns, ctx.map.monkeySpawns]) {
      for (const s of list || []) spawns.push([s.x, s.z]);
    }
  }

  const placed = [];
  const cols = []; // [x0, x1, y0, y1, z0, z1] — mirror of registered colliders
  const col = (w, h, d, x, y, z) => {
    cols.push([x - w / 2, x + w / 2, y, y + h, z - d / 2, z + d / 2]);
    ctx.boxCollider(w, h, d, x, y, z);
  };
  const open = (x, z, r, ignorePlaced) => {
    for (const rc of rects) {
      if (x > rc[0] - r && x < rc[1] + r && z > rc[2] - r && z < rc[3] + r) return false;
    }
    for (const e of exits) {
      const dx = x - e[0]; const dz = z - e[1];
      if (dx * dx + dz * dz < (3 + r) * (3 + r)) return false;
    }
    for (const s of spawns) {
      const dx = x - s[0]; const dz = z - s[1];
      if (dx * dx + dz * dz < (2.2 + r) * (2.2 + r)) return false;
    }
    if (!ignorePlaced) {
      for (const p of placed) {
        const dx = x - p[0]; const dz = z - p[1];
        const m = r + p[2] + 0.25;
        if (dx * dx + dz * dz < m * m) return false;
      }
    }
    return true;
  };

  // Open-ground regions: east yard gravel, patrol strips, west edge band.
  const YARD = [25, 55, -25, 17];
  const NORTH = [-55, 55, -60.4, -58.9];
  const SOUTH = [-55, 55, 58.9, 60.4];
  const WBAND = [-58, -27, 20.3, 21.6];
  const ALL = [YARD, YARD, NORTH, SOUTH, WBAND];
  const scatter = (n, r, regions, fn) => {
    let done = 0;
    for (let t = 0; t < n * 24 && done < n; t++) {
      const reg = regions[Math.floor(rng() * regions.length)];
      const x = reg[0] + rng() * (reg[1] - reg[0]);
      const z = reg[2] + rng() * (reg[3] - reg[2]);
      if (!open(x, z, r, false)) continue;
      fn(x, z);
      placed.push([x, z, r]);
      done++;
    }
  };

  // ------------------------------------------------ instanced prop builders
  const crateM = []; const palletM = []; const coneM = [];
  const bagM = []; const barM = []; const leafM = []; const pudM = [];
  const anchors = []; // larger clusters: extra monkey spawns hide behind these

  const crate = (x, y, z, s, h) => {
    crateM.push(ctx.matrixAt(x, y + h / 2, z, 0, q(), 0, s, h, s));
    col(s, h, s, x, y, z);
  };
  // Pallet base + a 2/3-high stack, with a 0.44 step crate so the first
  // level is climbable (<= 0.45 rises: ground -> 0.44 -> 0.85 -> 1.07).
  const crateCluster = (x, z) => {
    palletM.push(ctx.matrixAt(x, 0.06, z, 0, q(), 0, 1, 1, 1)); // 0.12 m: no collider
    crate(x - 0.35, 0.12, z - 0.3, 0.95, 0.95);
    crate(x - 0.35, 1.07, z - 0.3, 0.8, 0.8);
    if (rng() < 0.4) crate(x - 0.35, 1.87, z - 0.3, 0.62, 0.6);
    crate(x + 0.5, 0, z + 0.55, 0.85, 0.85);
    crate(x + 1.25, 0, z + 0.5, 0.7, 0.44);
    anchors.push([x, z, 2.0]);
  };
  const sandbagWall = (x, z) => {
    const ax = rng() < 0.5;
    const ry = ax ? 0 : HPI;
    for (let i = 0; i < 4; i++) {
      const o = (i - 1.5) * 0.6; const j = (rng() - 0.5) * 0.08;
      bagM.push(ctx.matrixAt(x + (ax ? o : j), 0.13, z + (ax ? j : o), 0, ry + (rng() - 0.5) * 0.3, 0, 1, 1, 1));
    }
    for (let i = 0; i < 3; i++) {
      const o = (i - 1) * 0.6;
      bagM.push(ctx.matrixAt(x + (ax ? o : 0), 0.39, z + (ax ? 0 : o), 0, ry + (rng() - 0.5) * 0.3, 0, 1, 1, 1));
    }
    col(ax ? 2.6 : 0.7, 0.52, ax ? 0.7 : 2.6, x, 0, z);
    anchors.push([x, z, 1.7]);
  };
  const drumGroup = (x, z) => {
    const n = 2 + Math.floor(rng() * 2);
    const offs = [[-0.38, 0.05], [0.38, -0.05], [0, -0.68]];
    let x0 = 1e9; let x1 = -1e9; let z0 = 1e9; let z1 = -1e9;
    for (let i = 0; i < n; i++) {
      const dx = x + offs[i][0]; const dz = z + offs[i][1];
      ctx.pushCyl('rust', 0.32, 0.34, 0.88, 10, dx, 0, dz);
      x0 = Math.min(x0, dx - 0.34); x1 = Math.max(x1, dx + 0.34);
      z0 = Math.min(z0, dz - 0.34); z1 = Math.max(z1, dz + 0.34);
    }
    col(x1 - x0, 0.88, z1 - z0, (x0 + x1) / 2, 0, (z0 + z1) / 2);
  };
  const barrier = (x, z) => {
    const ax = rng() < 0.5;
    const ry = ax ? 0 : HPI;
    barM.push(ctx.matrixAt(x, 0.7, z, 0, ry, 0, 1, 1, 1));
    const dx = ax ? 0.7 : 0; const dz = ax ? 0 : 0.7;
    ctx.pushBox('steelDark', 0.12, 0.8, 0.36, x - dx, 0, z - dz, ry);
    ctx.pushBox('steelDark', 0.12, 0.8, 0.36, x + dx, 0, z + dz, ry);
    col(ax ? 1.8 : 0.5, 0.9, ax ? 0.5 : 1.8, x, 0, z);
  };
  // Spilled banana crate — VISUAL only, never registered as an escape item.
  const bananaCrate = (x, z) => {
    ctx.pushBox('rust', 0.75, 0.55, 0.75, x, 0, z, q());
    for (let i = 0; i < 5; i++) {
      ctx.pushBox('caution', 0.26, 0.06, 0.09, x + 0.5 + rng() * 0.8, 0, z - 0.4 + rng() * 0.9, rng() * Math.PI);
    }
    col(0.75, 0.55, 0.75, x, 0, z);
  };
  // Micro-props: buckets, trays, mops — small, no colliders, shared buckets.
  const micro = (x, z) => {
    const t = rng();
    if (t < 0.35) {
      ctx.pushCyl('steelDark', 0.15, 0.17, 0.3, 8, x, 0, z);
    } else if (t < 0.65) {
      ctx.pushBox('steel', 0.4, 0.035, 0.3, x, 0, z, rng() * Math.PI);
    } else {
      ctx.pushCyl('pipe', 0.022, 0.022, 1.25, 6, x, 0.05, z);
      ctx.pushBox('dirt', 0.2, 0.07, 0.12, x, 0, z, rng() * Math.PI);
    }
  };

  // ----------------------------------------------------------- placement
  scatter(6, 2.1, [YARD], crateCluster);
  scatter(3, 1.6, [YARD], sandbagWall);

  // Extra monkey spawns tucked behind the larger clusters (0.7 x 1.7 clear).
  const spawnClear = (x, z) => {
    for (const c of cols) {
      if (x + 0.35 > c[0] && x - 0.35 < c[1] && c[2] < 1.7 && c[3] > 0 &&
          z + 0.35 > c[4] && z - 0.35 < c[5]) return false;
    }
    return true;
  };
  let extras = 0;
  for (const [ax, az, ar] of anchors) {
    if (extras >= 6) break;
    for (let k = 0; k < 10; k++) {
      const ang = rng() * Math.PI * 2;
      const sx = ax + Math.cos(ang) * ar;
      const sz = az + Math.sin(ang) * ar;
      if (!open(sx, sz, 0.35, true) || !spawnClear(sx, sz)) continue;
      ctx.addMonkeySpawn(sx, 0, sz);
      spawns.push([sx, sz]);
      extras++;
      break;
    }
  }

  scatter(6, 1.05, [YARD, YARD, NORTH, SOUTH], drumGroup);
  scatter(4, 1.2, [YARD, NORTH, SOUTH], barrier);
  scatter(1, 1.2, [YARD], bananaCrate);
  scatter(14, 0.35, ALL, (x, z) => coneM.push(ctx.matrixAt(x, 0.28, z, 0, rng() * Math.PI, 0, 1, 1, 1)));
  scatter(10, 0.35, ALL, micro);
  scatter(22, 0.2, ALL, (x, z) => leafM.push(
    ctx.matrixAt(x, 0.02, z, 0, rng() * Math.PI * 2, 0, 0.8 + rng() * 0.7, 1, 0.8 + rng() * 0.7)));
  scatter(8, 0.7, ALL, (x, z) => pudM.push(
    ctx.matrixAt(x, 0.02, z, -HPI, 0, rng() * Math.PI, 0.7 + rng() * 1.2, 0.5 + rng() * 0.9, 1)));

  // -------------------------------------------- wall signs (shared atlas)
  const prng = ctx.makeRng(SEEDS.PROPS); // separate stream for the painter
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d');
  const cell = (cx, cy, bg, fg, lines) => {
    const x0 = cx * 256; const y0 = cy * 256;
    g.fillStyle = bg; g.fillRect(x0, y0, 256, 256);
    g.strokeStyle = fg; g.lineWidth = 10; g.strokeRect(x0 + 12, y0 + 12, 232, 232);
    g.fillStyle = fg; g.font = 'bold 46px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((t, i) => g.fillText(t, x0 + 128, y0 + 128 + (i - (lines.length - 1) / 2) * 54, 220));
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgba(30,28,24,${0.05 + prng() * 0.15})`;
      g.beginPath();
      g.ellipse(x0 + prng() * 256, y0 + prng() * 256, 2 + prng() * 8, 1 + prng() * 5, prng() * Math.PI, 0, Math.PI * 2);
      g.fill();
    }
  };
  cell(0, 0, '#22384e', '#e8eef4', ['BLOCK A']);
  cell(1, 0, '#d9a91c', '#20221f', ['YARD']);
  cell(0, 1, '#e9e9e2', '#b0281e', ['NO', 'RUNNING']);
  cell(1, 1, '#1f4a2c', '#e8f4e8', ['\u2192 EXIT']);
  const atlas = new THREE.CanvasTexture(cv);
  atlas.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.8, metalness: 0.1 });
  const signGeos = [];
  const sign = (cx, cy, x, y, z, ry) => {
    const gg = new THREE.BoxGeometry(1.5, 0.95, 0.06);
    const uv = gg.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, uv.getX(i) * 0.5 + cx * 0.5, uv.getY(i) * 0.5 + (1 - cy) * 0.5);
    }
    gg.rotateY(ry);
    gg.translate(x, y, z);
    signGeos.push(gg);
  };
  // Mounted just proud of REAL wall faces (0.06-thick sign centred 0.10 m
  // off each face -> 0.07 m air gap), facing the walkable side. No colliders.
  sign(0, 0, -24.1, 1.8, -30, HPI); // cell-wing east wall (face x -24.2), west seam strip
  sign(0, 0, -24.1, 1.8, 4, HPI);   // cell-wing east wall (face x -24.2), between D1/D2
  sign(1, 0, 38, 1.8, -31.7, 0);    // workshop north wall (face z -31.8), yard side
  sign(1, 0, 18, 1.8, 22.5, 0);     // hub south wall (face z 22.4), divider strip
  sign(0, 1, 22.5, 1.8, -14, HPI);  // hub east wall (face x 22.4), east seam strip
  sign(0, 1, -22.5, 1.8, -30, HPI); // hub west wall (face x -22.4), west seam strip
  sign(1, 1, 25.7, 1.8, -40, HPI);  // workshop west wall (face x 25.8)
  const signMesh = new THREE.Mesh(mergeGeometries(signGeos, false), signMat);
  signMesh.castShadow = true;
  signMesh.receiveShadow = true;
  ctx.addMesh(signMesh);

  // ------------------------------------------------------ instanced meshes
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x20282c, roughness: 0.08, metalness: 0.5,
    transparent: true, opacity: 0.55, depthWrite: false
  });
  const inst = (geo, mat, m, opts) => { if (m.length) ctx.makeInstanced(geo, mat, m, opts); };
  inst(new THREE.BoxGeometry(1, 1, 1), ctx.mats.rust, crateM);
  inst(new THREE.BoxGeometry(1.5, 0.12, 1.5), ctx.mats.steelDark, palletM);
  inst(new THREE.ConeGeometry(0.24, 0.55, 8), ctx.mats.glow, coneM);
  inst(new THREE.BoxGeometry(0.62, 0.26, 0.34), ctx.mats.dirt, bagM);
  inst(new THREE.BoxGeometry(1.7, 0.35, 0.14), ctx.mats.caution, barM);
  inst(new THREE.BoxGeometry(0.26, 0.012, 0.34), ctx.mats.concrete, leafM, { cast: false });
  inst(new THREE.CircleGeometry(0.9, 12), puddleMat, pudM, { cast: false });
}
