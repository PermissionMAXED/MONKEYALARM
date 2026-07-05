import * as THREE from 'three';
import { SEEDS } from './shared.js';

/**
 * CELL BLOCKS — west wing of the prison (x -62..-24, z -58..20) plus the
 * showers/laundry annex (x -62..-2, z 24..58).
 *
 * Layout: one brick envelope holds Block A (hall z -57..-25) and Block B
 * (hall z -14..19) with a guard lobby between them. Each block has a single
 * row of 8 cells per tier against the west wall; tier-1 sits on a shared
 * gallery slab (top y 3.2 = 8 stairs x 0.4) that runs the full wing, with a
 * guard catwalk spur bridging east over the lobby between the two galleries.
 * Railings are visual only (no colliders) so players can hop down.
 *
 * Frozen contract kept:
 * - The stub's 8 monkey spawns keep their exact coordinates and stay spawn
 *   indices 0-7; extra hides are appended after them (17 total).
 * - Door gaps D1 (z -12..-8) and D2 (z 6..10) pierce the east wall next to
 *   the x -24..-22 seam strip; the annex south wall leaves D5 (x -14..-10)
 *   on the z 22..24 seam. The H2 stairwell hole (x -42..-38, z 38..44) is
 *   kept open with a 1 m margin — the shower room is built around it as a
 *   floor drain (tile overlay is cut away around the margin).
 * - All randomness comes from ctx.makeRng(SEEDS.CELLS).
 *
 * Dynamics: map.dynamics.cellDoors = { setOpen(f) } slides every working
 * cell door (one 32-instance InstancedMesh); 3 rng-picked "jammed" doors
 * ignore it and grind back and forth via one updater. One more updater
 * flickers a cloned lightFixture material (fluorescent strips + 2 hall
 * PointLights), and one drives the laundry boiler's steam puffs.
 */

const CELL_PITCH = 3.4;   // partition-to-partition cell spacing
const GALLERY_Y = 3.2;    // tier-1 floor height (8 stairs x 0.4 rise)
const DOOR_TRAVEL = 1.55; // slide distance between closed and parked-open

const _v = new THREE.Vector3();

export function buildCellBlocks(ctx) {
  const rng = ctx.makeRng(SEEDS.CELLS);
  buildShells(ctx);
  buildGalleryAndCatwalk(ctx);
  const doorRecs = buildCellRows(ctx);
  buildCellDoors(ctx, rng, doorRecs);
  buildHallFurniture(ctx);
  buildShowers(ctx);
  buildLaundry(ctx);
  buildSteam(ctx, rng);
  buildLighting(ctx, rng);
  addSpawns(ctx);
}

// ------------------------------------------------------------------ shells

function buildShells(ctx) {
  // Cell wing envelope (x -62..-24.2, z -58..20, 7.5 m brick).
  ctx.solid('brick', 1.0, 7.5, 78, -61.5, 0, -19);   // west
  ctx.solid('brick', 37, 7.5, 1.0, -43.5, 0, -57.5); // south
  // North wall with a door gap (x -48..-44) toward the showers corridor.
  ctx.solid('brick', 14, 7.5, 1.0, -55, 0, 19.5);
  ctx.solid('brick', 19, 7.5, 1.0, -34.5, 0, 19.5);
  ctx.solid('brick', 4, 4.9, 1.0, -46, 2.6, 19.5);
  // East wall (x -25..-24.2, clear of the seam strip) with door gaps
  // D1 (z -12..-8) and D2 (z 6..10) plus headers above head height.
  ctx.solid('brick', 0.8, 7.5, 46, -24.6, 0, -35);
  ctx.solid('brick', 0.8, 7.5, 14, -24.6, 0, -1);
  ctx.solid('brick', 0.8, 7.5, 10, -24.6, 0, 15);
  ctx.solid('brick', 0.8, 4.7, 4, -24.6, 2.8, -10);
  ctx.solid('brick', 0.8, 4.7, 4, -24.6, 2.8, 8);
  for (const z of [-12.15, -7.85, 5.85, 10.15]) { // caution jambs (visual)
    ctx.pushBox('caution', 0.86, 2.8, 0.26, -24.6, 0, z);
  }
  // Cross walls bounding the guard lobby (z -24..-15.1). Each leaves a
  // ground doorway (x -47..-41) and a tier-1 pass-through over the gallery
  // (x -61..-55, open y 2.9..5.6). Wall B sits south of SEAM_WEST (z >= -14).
  for (const zc of [-24.5, -14.6]) {
    ctx.solid('concrete', 6, 2.9, 1.0, -58, 0, zc);
    ctx.solid('concrete', 6, 1.9, 1.0, -58, 5.6, zc);
    ctx.solid('concrete', 8, 7.5, 1.0, -51, 0, zc);
    ctx.solid('concrete', 6, 4.9, 1.0, -44, 2.6, zc);
    ctx.solid('concrete', 16, 7.5, 1.0, -33, 0, zc);
  }
  // Showers/laundry annex envelope (x -62..-2, z 24.2..58, 5.5 m).
  ctx.solid('brick', 1.0, 5.5, 33.8, -61.5, 0, 41.1); // west
  ctx.solid('brick', 1.0, 5.5, 33.8, -2.5, 0, 41.1);  // east
  ctx.solid('brick', 60, 5.5, 1.0, -32, 0, 57.5);     // north
  // South wall (z 24.2..25, clear of the z 22..24 seam) with door gaps at
  // x -48..-44 (facing the wing's north door) and D5 at x -14..-10.
  ctx.solid('brick', 14, 5.5, 0.8, -55, 0, 24.6);
  ctx.solid('brick', 30, 5.5, 0.8, -29, 0, 24.6);
  ctx.solid('brick', 8, 5.5, 0.8, -6, 0, 24.6);
  ctx.solid('brick', 4, 2.9, 0.8, -46, 2.6, 24.6);
  ctx.solid('brick', 4, 2.9, 0.8, -12, 2.6, 24.6);
  // Divider between showers (west) and laundry (east) with a doorway.
  ctx.solid('concrete', 0.8, 5.5, 13, -30, 0, 31.5);
  ctx.solid('concrete', 0.8, 5.5, 15, -30, 0, 49.5);
  ctx.solid('concrete', 0.8, 3.1, 4, -30, 2.4, 40);
}

// -------------------------------------------- gallery, catwalk and stairs

function buildGalleryAndCatwalk(ctx) {
  // One gallery slab (top y 3.2) runs the whole wing through the cross-wall
  // pass-throughs; tier-1 cells and the walkway sit on it.
  ctx.solid('concrete', 6, 0.3, 76, -58, 2.9, -19);
  // Central guard catwalk spur bridging east over the lobby.
  ctx.solid('steelDark', 19, 0.25, 2.2, -45.5, 2.95, -19.5);
  ctx.solid('steel', 0.35, 2.95, 0.35, -49, 0, -19.5);
  ctx.solid('steel', 0.35, 2.95, 0.35, -38, 0, -19.5);
  // Stairs to the gallery at both ends of each block (8 x 0.4 rise).
  ctx.stairs({ x: -49.4, z: -55.85, dir: '-x', width: 2.2, steps: 8, rise: 0.4, run: 0.7 });
  ctx.stairs({ x: -49.4, z: -26.15, dir: '-x', width: 2.2, steps: 8, rise: 0.4, run: 0.7 });
  ctx.stairs({ x: -49.4, z: -12.7, dir: '-x', width: 2.4, steps: 8, rise: 0.4, run: 0.7 });
  ctx.stairs({ x: -49.4, z: 17.55, dir: '-x', width: 2.4, steps: 8, rise: 0.4, run: 0.7 });
  // Gallery railing — visual bars only (players hop down over it), with
  // gaps at the stair landings and the spur junction.
  const rail = (len, cz) => {
    ctx.pushBox('bars', 0.07, 1.0, len, -55.16, GALLERY_Y, cz);
    ctx.pushBox('steel', 0.1, 0.06, len, -55.16, GALLERY_Y + 1.0, cz);
  };
  rail(27.2, -41);
  rail(4.4, -22.8);
  rail(4.3, -16.25);
  rail(27.2, 2.4);
  for (const z of [-20.63, -18.37]) { // spur side railings
    ctx.pushBox('bars', 19, 1.0, 0.07, -45.5, GALLERY_Y, z);
    ctx.pushBox('steel', 19, 0.06, 0.1, -45.5, GALLERY_Y + 1.0, z);
  }
  ctx.pushBox('bars', 0.07, 1.0, 2.2, -36.03, GALLERY_Y, -19.5); // spur end
  ctx.pushBox('steel', 0.1, 0.06, 2.2, -36.03, GALLERY_Y + 1.0, -19.5);
}

// ------------------------------------------------------------------- cells

function buildCellRows(ctx) {
  const doorRecs = [];
  for (const rowZ0 of [-54.6, -11.2]) { // Block A row, Block B row
    for (const f of [0, GALLERY_Y]) {
      const tier1 = f > 0;
      const partH = tier1 ? 2.7 : 2.9;  // tier-0 partitions meet the slab
      const frontH = tier1 ? 2.5 : 2.9;
      for (let i = 0; i <= 8; i++) {
        ctx.solid('concrete', 3.0, partH, 0.2, -59.5, f, rowZ0 + i * CELL_PITCH);
      }
      for (let i = 0; i < 8; i++) {
        const zb = rowZ0 + i * CELL_PITCH;
        // Bunk bed: lower deck auto-steppable (0.44 <= 0.45), upper deck top
        // at +1.35 so it is jumpable from the lower deck's exposed foot end.
        ctx.pushBox('steelDark', 2.2, 0.3, 0.95, -59.8, f, zb + 0.625);
        ctx.pushBox('floor', 2.1, 0.14, 0.85, -59.8, f + 0.3, zb + 0.625);
        ctx.boxCollider(2.2, 0.44, 0.95, -59.8, f, zb + 0.625);
        ctx.pushBox('steelDark', 1.3, 0.1, 0.95, -60.25, f + 1.13, zb + 0.625);
        ctx.pushBox('floor', 1.2, 0.12, 0.85, -60.25, f + 1.23, zb + 0.625);
        ctx.boxCollider(1.3, 0.22, 0.95, -60.25, f + 1.13, zb + 0.625);
        ctx.pushBox('steelDark', 0.07, 1.35, 0.07, -59.63, f, zb + 0.19);
        ctx.pushBox('steelDark', 0.07, 1.35, 0.07, -59.63, f, zb + 1.06);
        // Toilet + cistern and a wall sink (visual only).
        ctx.pushCyl('tile', 0.26, 0.3, 0.4, 10, -60.45, f, zb + 2.8);
        ctx.pushBox('tile', 0.42, 0.5, 0.16, -60.78, f + 0.25, zb + 2.8);
        ctx.pushCyl('steel', 0.06, 0.07, 0.8, 6, -58.62, f, zb + 3.02);
        ctx.pushBox('steel', 0.46, 0.16, 0.36, -58.62, f + 0.8, zb + 3.05);
        // Barred front: fixed half-panel + overhead slide track; the sliding
        // door (instanced) covers the other half when closed.
        ctx.solid('bars', 0.12, frontH, 1.8, -58, f, zb + 1.0);
        ctx.pushBox('steelDark', 0.16, 0.09, 3.15, -57.82, f + 2.56, zb + 1.83);
        doorRecs.push({
          x: -57.82, yc: f + 1.275,
          closedZ: zb + 2.6, curZ: zb + 2.6,
          jammed: false, collider: null
        });
      }
    }
  }
  return doorRecs;
}

function buildCellDoors(ctx, rng, doorRecs) {
  const mesh = ctx.makeInstanced(
    new THREE.BoxGeometry(0.1, 2.55, 1.5), ctx.mats.bars,
    doorRecs.map((r) => ctx.matrixAt(r.x, r.yc, r.curZ, 0, 0, 0, 1, 1, 1))
  );
  // Three jammed doors oscillate forever and ignore setOpen (no colliders,
  // so their cells always stay physically enterable).
  const jammed = [];
  while (jammed.length < 3) {
    const idx = Math.floor(rng() * doorRecs.length);
    if (doorRecs[idx].jammed) continue;
    doorRecs[idx].jammed = true;
    jammed.push({ idx, speed: 0.8 + rng() * 0.6, phase: rng() * Math.PI * 2 });
  }
  for (const r of doorRecs) {
    if (!r.jammed) r.collider = ctx.boxCollider(0.1, 2.55, 1.5, r.x, r.yc - 1.275, r.curZ);
  }
  const apply = (i, z) => {
    const r = doorRecs[i];
    if (r.collider) r.collider.translate(_v.set(0, 0, z - r.curZ));
    r.curZ = z;
    mesh.setMatrixAt(i, ctx.matrixAt(r.x, r.yc, z, 0, 0, 0, 1, 1, 1));
  };
  const setOpen = (f) => {
    const t = Math.min(1, Math.max(0, f));
    for (let i = 0; i < doorRecs.length; i++) {
      if (!doorRecs[i].jammed) apply(i, doorRecs[i].closedZ - t * DOOR_TRAVEL);
    }
    mesh.instanceMatrix.needsUpdate = true;
  };
  setOpen(1); // breakout state: every working door parked open
  ctx.registerDynamic('cellDoors', { setOpen });
  ctx.registerUpdater((_dt, time) => { // rewrites only the 3 jammed matrices
    for (const j of jammed) {
      const r = doorRecs[j.idx];
      const z = r.closedZ - (0.775 + 0.45 * Math.sin(time * j.speed + j.phase));
      mesh.setMatrixAt(j.idx, ctx.matrixAt(r.x, r.yc, z, 0, 0, 0, 1, 1, 1));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// --------------------------------------------------------- hall furniture

function buildHallFurniture(ctx) {
  const messTable = (x, z) => {
    ctx.solid('concreteDark', 2.8, 0.85, 1.1, x, 0, z);
    ctx.solid('concreteDark', 2.8, 0.45, 0.4, x, 0, z - 1.15);
    ctx.solid('concreteDark', 2.8, 0.45, 0.4, x, 0, z + 1.15);
  };
  messTable(-30, -37); // Block A nave
  messTable(-31, -3);  // Block B nave
  messTable(-31, 13);
  ctx.solid('steelDark', 2.2, 0.9, 0.9, -44, 0, -19.5); // lobby guard desk
}

// -------------------------------------------------------- showers/laundry

function buildShowers(ctx) {
  // Tile overlay (visual, 2 cm) cut away around the H2 drain margin
  // (x -43..-37, z 37..45) so the stairwell hole stays fully open.
  ctx.pushBox('tile', 30.6, 0.08, 12, -45.7, -0.06, 31);
  ctx.pushBox('tile', 18, 0.08, 8, -52, -0.06, 41);
  ctx.pushBox('tile', 6.6, 0.08, 8, -33.7, -0.06, 41);
  ctx.pushBox('tile', 30.6, 0.08, 12, -45.7, -0.06, 51);
  // Stalls with low partitions along the north wall.
  for (let k = 0; k < 7; k++) {
    ctx.solid('tile', 0.15, 1.6, 2.6, -60.2 + k * 2.6, 0, 55.7);
  }
  for (let k = 0; k < 6; k++) { // riser pipes + shower heads (visual)
    const xc = -58.9 + k * 2.6;
    ctx.pushCyl('pipe', 0.045, 0.045, 1.5, 6, xc, 0.9, 56.75);
    ctx.pushBox('steel', 0.16, 0.1, 0.3, xc, 2.35, 56.6);
  }
  ctx.solid('concreteDark', 3.2, 0.45, 0.5, -52, 0, 34); // benches
  ctx.solid('concreteDark', 3.2, 0.45, 0.5, -46, 0, 48);
}

function buildLaundry(ctx) {
  ctx.pushBox('floor', 26.6, 0.08, 32, -16.3, -0.06, 41); // worn lino overlay
  for (let k = 0; k < 8; k++) { // washer row along the east wall
    const z = 29.5 + k * 2.2;
    ctx.pushBox('steel', 0.95, 1.15, 0.9, -3.55, 0, z);
    ctx.pushBox('steelDark', 0.08, 0.6, 0.6, -4.06, 0.35, z);
  }
  ctx.boxCollider(1.0, 1.15, 17.6, -3.55, 0, 37.2); // one collider strip
  ctx.solid('concreteDark', 4.5, 0.9, 1.4, -14, 0, 33); // folding table
  for (const [x, z] of [[-28.4, 53.6], [-22, 29.5], [-8.5, 51.5]]) { // carts
    ctx.pushBox('rust', 1.1, 0.65, 0.7, x, 0.35, z);
    ctx.pushBox('steelDark', 1.0, 0.06, 0.6, x, 0.12, z);
    for (const [dx, dz] of [[-0.45, -0.25], [0.45, -0.25], [-0.45, 0.25], [0.45, 0.25]]) {
      ctx.pushCyl('steelDark', 0.05, 0.05, 0.12, 6, x + dx, 0, z + dz);
    }
    ctx.boxCollider(1.1, 1.0, 0.7, x, 0, z);
  }
  for (const z of [41.5, 45.5]) { // drying lines (visual)
    ctx.pushBox('pipe', 17, 0.05, 0.05, -17.5, 2.5, z);
    for (const x of [-26, -9]) ctx.pushBox('steelDark', 0.06, 2.5, 0.06, x, 0, z);
  }
  // Hanging sheets — translucent panes, no colliders (hide behind them).
  for (const [x, z] of [[-24, 41.5], [-20.5, 41.5], [-15, 41.5], [-11, 41.5], [-22.5, 45.5], [-13, 45.5]]) {
    ctx.pushBox('glass', 1.9, 1.85, 0.04, x, 0.62, z);
  }
  // Steam boiler in the south-west corner.
  ctx.pushCyl('rust', 0.85, 0.9, 2.3, 12, -27.6, 0, 27.6);
  ctx.pushCyl('pipe', 0.12, 0.12, 3.2, 8, -27.6, 2.3, 27.6);
  ctx.boxCollider(1.8, 2.3, 1.8, -27.6, 0, 27.6);
}

function buildSteam(ctx, rng) {
  const ox = -26.9, oy = 2.1, oz = 28.1; // boiler vent
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xc8d2d6, transparent: true, opacity: 0.3, depthWrite: false
  });
  const puffs = [];
  for (let i = 0; i < 7; i++) {
    puffs.push({ phase: rng(), speed: 0.32 + rng() * 0.22, wob: rng() * Math.PI * 2 });
  }
  const mesh = ctx.makeInstanced(
    new THREE.SphereGeometry(0.26, 8, 6), steamMat,
    puffs.map(() => ctx.matrixAt(ox, oy, oz, 0, 0, 0, 0.4, 0.4, 0.4)),
    { cast: false }
  );
  ctx.registerUpdater((_dt, time) => {
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      const u = (time * p.speed + p.phase) % 1; // rise, swell, recycle
      const s = 0.45 + u * 1.5;
      mesh.setMatrixAt(i, ctx.matrixAt(
        ox + Math.sin(time * 0.9 + p.wob) * 0.18 + u * 0.35,
        oy + u * 2.9,
        oz + Math.cos(time * 0.7 + p.wob) * 0.18 + u * 0.2,
        0, 0, 0, s, s, s
      ));
    }
    mesh.instanceMatrix.needsUpdate = true;
  });
}

// ---------------------------------------------------------------- lighting

function buildLighting(ctx, rng) {
  // Fluorescent strips share ONE cloned emissive material so the whole
  // wing flickers together without touching the shared bucket material.
  const fluoroMat = ctx.mats.lightFixture.clone();
  const HALF_PI = Math.PI / 2;
  const defs = [];
  for (const z of [-52, -46, -40, -34, -28, -19.5, -10, -4, 2, 8, 14]) {
    defs.push([-56.5, 2.8, z, HALF_PI]); // under the gallery walkway
  }
  defs.push([-45.5, 2.8, -19.5, 0]);     // under the catwalk spur
  for (const x of [-56, -47, -20, -10]) defs.push([x, 4.5, 56.75, 0]); // annex
  ctx.makeInstanced(
    new THREE.BoxGeometry(3.0, 0.09, 0.28), fluoroMat,
    defs.map(([x, y, z, ry]) => ctx.matrixAt(x, y, z, 0, ry, 0, 1, 1, 1)),
    { cast: false }
  );
  const light = (color, x, y, z, intensity, dist) => {
    const pl = new THREE.PointLight(color, intensity, dist, 1.9);
    pl.position.set(x, y, z);
    return ctx.addMesh(pl);
  };
  const hallA = light(0xffd9a0, -45, 5.6, -41, 1.1, 42);
  const hallB = light(0xffd9a0, -45, 5.6, 2, 1.1, 42);
  light(0xbfd9e2, -46, 4.4, 44, 0.9, 30); // showers
  light(0xffd9a0, -14, 4.4, 40, 0.9, 30); // laundry
  const seed = rng() * Math.PI * 2;
  const drop = rng() * Math.PI * 2;
  ctx.registerUpdater((_dt, time) => {
    let v = 0.78 + 0.3 * Math.sin(time * 12.7 + seed) * Math.sin(time * 3.3 + seed * 0.5);
    if (Math.sin(time * 2.1 + drop) > 0.965) v = 0.12; // intermittent dropout
    fluoroMat.emissiveIntensity = v;
    hallA.intensity = 0.55 + 0.55 * v;
    hallB.intensity = 0.55 + 0.55 * v;
  });
}

// ------------------------------------------------------------------ spawns

function addSpawns(ctx) {
  // Contract spawns from the stub (indices 0-7) — coordinates preserved.
  ctx.addMonkeySpawn(-47, 0, -38);
  ctx.addMonkeySpawn(-39, 0, -34);
  ctx.addMonkeySpawn(-47, 0, -28);
  ctx.addMonkeySpawn(-39, 0, -22);
  ctx.addMonkeySpawn(-47, 0, -16);
  ctx.addMonkeySpawn(-39, 0, -10);
  ctx.addMonkeySpawn(-47, 0, -2);
  ctx.addMonkeySpawn(-39, 0, 6);
  // Extra hides (indices 8+).
  ctx.addMonkeySpawn(-59.5, 0, -45.5);         // Block A ground cell
  ctx.addMonkeySpawn(-60.3, 0, -32.4);         // corner behind a bunk head
  ctx.addMonkeySpawn(-59.5, GALLERY_Y, -38.7); // Block A tier-1 cell
  ctx.addMonkeySpawn(-56.5, GALLERY_Y, 12);    // Block B gallery walkway
  ctx.addMonkeySpawn(-59.5, 0, 11.5);          // Block B ground cell
  ctx.addMonkeySpawn(-56.3, 0, 55.6);          // shower stall
  ctx.addMonkeySpawn(-50, 0, 47);              // showers open floor
  ctx.addMonkeySpawn(-28.6, 0, 55.6);          // laundry cart nook
  ctx.addMonkeySpawn(-16, 0, 43.5);            // behind the hanging sheets
}
