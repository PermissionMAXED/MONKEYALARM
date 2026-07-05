import * as THREE from 'three';
import { SEEDS } from './shared.js';

/**
 * YARD — the whole east side of the prison: exercise yard, workshop + boiler
 * room, the inner compound wall with the rubble breach, and the motor pool /
 * vehicle sally garage to the south.
 *
 * Regions owned: east yard x [24,62], z [-58,20]; motor pool x [2,62],
 * z [24,58]. Kept clear: the x [22,24] seam strip (hub east-wall gaps open
 * onto the yard at z -10±2 and z 8±2), the z [22,24] divider strip (door D6
 * at x 12±2), and floor hole H1 (x [32,36], z [-8,-2]) + 1 m margin — themed
 * below as the big yard drain.
 *
 * Frozen contract kept: WALL_BREACH exit at (60.5, 0, 6) r 2.4 (no keycard),
 * 3 BANANA items, >= 4 monkey spawns. All randomness comes from
 * ctx.makeRng(SEEDS.YARD); Math.random is banned.
 */
export function buildYard(ctx) {
  const rng = ctx.makeRng(SEEDS.YARD);

  buildExerciseYard(ctx);
  buildCompoundWallAndBreach(ctx, rng);
  buildWorkshopAndBoilers(ctx, rng);
  buildMotorPool(ctx, rng);

  // Monkey spawns (FEET on real floor / collider tops; order = spawn index).
  ctx.addMonkeySpawn(54.1, 0, -20);      // hollow behind the bleacher slabs
  ctx.addMonkeySpawn(26.9, 0.9, -38.5);  // on top of the workshop shelf unit
  ctx.addMonkeySpawn(43.2, 0, -54.2);    // boiler-room nook west of boiler 1
  ctx.addMonkeySpawn(32.5, 0.5, 46);     // prison bus interior (rear aisle)
  ctx.addMonkeySpawn(20, 0, 52.5);       // garage bay, west of the bus nose
  ctx.addMonkeySpawn(30, 0, -10.5);      // NW corner of the yard drain (H1)
  ctx.addMonkeySpawn(48.5, 0, 15.8);     // between picnic tables and fence

  // Escape contract — WALL_BREACH sits in the enclosed patrol strip just
  // past the inner wall (the outer perimeter stays sealed).
  ctx.addEscapeExit({
    id: 'WALL_BREACH', name: 'Wall Breach',
    x: 60.5, y: 0, z: 6, radius: 2.4, requiresKeycard: false
  });
  ctx.addEscapeItem({ id: 'banana-1', type: 'BANANA', x: 52.9, y: 2.6, z: -20 });   // bleacher top
  ctx.addEscapeItem({ id: 'banana-2', type: 'BANANA', x: 48.2, y: 5.1, z: -53.5 }); // boiler catwalk
  ctx.addEscapeItem({ id: 'banana-3', type: 'BANANA', x: 30, y: 3.5, z: 46 });      // bus roof
}

// ----------------------------------------------------------- exercise yard

function buildExerciseYard(ctx) {
  // Gravel pad (visual only, 4 cm), split around drain hole H1 + 1 m margin
  // (x [31,37], z [-9,-1]) so the Underground stairwell stays open.
  ctx.pushBox('gravel', 30, 0.04, 19, 41, 0, -18.5); // z -28..-9
  ctx.pushBox('gravel', 5, 0.04, 8, 28.5, 0, -5);    // z  -9..-1, x 26..31
  ctx.pushBox('gravel', 19, 0.04, 8, 46.5, 0, -5);   // z  -9..-1, x 37..56
  ctx.pushBox('gravel', 30, 0.04, 19, 41, 0, 8.5);   // z  -1..18

  // Yard drain theming: flat caution lip framing H1 (visual, non-blocking).
  ctx.pushBox('caution', 5.6, 0.03, 0.5, 34, 0, -8.35);
  ctx.pushBox('caution', 5.6, 0.03, 0.5, 34, 0, -1.65);
  ctx.pushBox('caution', 0.5, 0.03, 7.2, 31.65, 0, -5);
  ctx.pushBox('caution', 0.5, 0.03, 7.2, 36.35, 0, -5);

  // Basketball hoop + backboard (pole collides; court lines are flat paint).
  ctx.pushCyl('steel', 0.09, 0.11, 3.5, 8, 41, 0, -25.2);
  ctx.boxCollider(0.3, 3.5, 0.3, 41, 0, -25.2);
  ctx.pushBox('steel', 0.12, 0.12, 0.9, 41, 3.28, -24.75);
  ctx.pushBox('tile', 1.8, 1.2, 0.1, 41, 2.6, -24.35);
  ctx.pushBox('caution', 0.5, 0.05, 0.06, 41, 3.02, -23.65); // rim square
  ctx.pushBox('caution', 0.5, 0.05, 0.06, 41, 3.02, -24.18);
  ctx.pushBox('caution', 0.06, 0.05, 0.59, 40.75, 3.02, -23.92);
  ctx.pushBox('caution', 0.06, 0.05, 0.59, 41.25, 3.02, -23.92);
  ctx.pushBox('caution', 8, 0.012, 0.1, 41, 0.041, -24.2);  // baseline
  ctx.pushBox('caution', 8, 0.012, 0.1, 41, 0.041, -13.2);  // half-court
  ctx.pushBox('caution', 0.1, 0.012, 11, 37, 0.041, -18.7); // sidelines
  ctx.pushBox('caution', 0.1, 0.012, 11, 45, 0.041, -18.7);

  // Pull-up bar rig: four posts, three bars at rising heights.
  const postZ = [-22, -20.7, -19.4, -18.1];
  const postH = [1.5, 1.9, 2.3, 2.3];
  for (let i = 0; i < 4; i++) {
    ctx.pushCyl('steelDark', 0.06, 0.06, postH[i], 6, 28.8, 0, postZ[i]);
    ctx.boxCollider(0.18, postH[i], 0.18, 28.8, 0, postZ[i]);
  }
  ctx.pushBox('steel', 0.06, 0.06, 1.3, 28.8, 1.47, -21.35);
  ctx.pushBox('steel', 0.06, 0.06, 1.3, 28.8, 1.87, -20.05);
  ctx.pushBox('steel', 0.06, 0.06, 1.3, 28.8, 2.27, -18.75);

  // Concrete bleachers: five floating 0.4-thick tiers (0.4 rises, climbable)
  // with an open hollow behind/beneath the higher slabs.
  for (let i = 0; i < 5; i++) {
    ctx.solid('concreteDark', 0.85, 0.4, 9, 49.5 + i * 0.85, i * 0.4, -20);
  }
  for (const pz of [-24.3, -15.7]) { // rear + mid support posts (visual)
    ctx.pushCyl('steelDark', 0.08, 0.08, 1.6, 6, 53.1, 0, pz);
    ctx.pushCyl('steelDark', 0.08, 0.08, 0.8, 6, 51.4, 0, pz);
  }
  ctx.pushBox('steelDark', 0.07, 0.85, 9, 53.29, 2.0, -20); // back rail

  // Picnic tables (bench tops 0.45 -> table tops 0.8, both climbable).
  for (const [tx, tz] of [[46, 13], [51, 13.8]]) {
    ctx.solid('floor', 1.9, 0.09, 0.85, tx, 0.71, tz);
    ctx.solid('floor', 1.9, 0.07, 0.32, tx, 0.38, tz - 0.62);
    ctx.solid('floor', 1.9, 0.07, 0.32, tx, 0.38, tz + 0.62);
    for (const sx of [-0.8, 0.8]) {
      ctx.pushBox('steelDark', 0.08, 0.71, 0.08, tx + sx, 0, tz - 0.3);
      ctx.pushBox('steelDark', 0.08, 0.71, 0.08, tx + sx, 0, tz + 0.3);
      ctx.pushBox('steelDark', 0.06, 0.38, 0.06, tx + sx, 0, tz - 0.62);
      ctx.pushBox('steelDark', 0.06, 0.38, 0.06, tx + sx, 0, tz + 0.62);
    }
  }

  // Inner chain-link fence (x 27..55, z -27..17) with TWO open gate gaps on
  // the west and east runs at z 0..11 — both aligned over SEAM_EAST so the
  // hub -> breach corridor stays walkable end to end.
  const seg = (w, d, x, z) => {
    ctx.solid('barbedWire', w, 2.5, d, x, 0, z);
    ctx.pushBox('steelDark', Math.max(w, 0.06), 0.06, Math.max(d, 0.06), x, 2.5, z); // top rail
  };
  seg(0.08, 27, 27, -13.5); // west, z -27..0
  seg(0.08, 6, 27, 14);     // west, z 11..17
  seg(0.08, 27, 55, -13.5); // east, z -27..0
  seg(0.08, 6, 55, 14);     // east, z 11..17
  seg(28, 0.08, 41, -27);   // north
  seg(28, 0.08, 41, 17);    // south
  for (const [gx, gz] of [[27, 0], [27, 11], [55, 0], [55, 11]]) {
    ctx.pushBox('caution', 0.22, 2.7, 0.22, gx, 0, gz); // gate posts (visual)
  }
  const postMats = [];
  for (let k = 0; k <= 8; k++) { // west + east runs (long segment)
    postMats.push(ctx.matrixAt(27, 1.375, -27 + k * 3.375, 0, 0, 0, 1, 1, 1));
    postMats.push(ctx.matrixAt(55, 1.375, -27 + k * 3.375, 0, 0, 0, 1, 1, 1));
  }
  for (let k = 0; k <= 2; k++) { // west + east runs (short segment)
    postMats.push(ctx.matrixAt(27, 1.375, 11 + k * 3, 0, 0, 0, 1, 1, 1));
    postMats.push(ctx.matrixAt(55, 1.375, 11 + k * 3, 0, 0, 0, 1, 1, 1));
  }
  for (let k = 0; k <= 6; k++) { // north + south runs (skip shared corners)
    postMats.push(ctx.matrixAt(30.5 + k * 3.5, 1.375, -27, 0, 0, 0, 1, 1, 1));
    postMats.push(ctx.matrixAt(30.5 + k * 3.5, 1.375, 17, 0, 0, 0, 1, 1, 1));
  }
  ctx.makeInstanced(
    new THREE.CylinderGeometry(0.07, 0.07, 2.75, 6),
    ctx.mats.steelDark, postMats
  );
}

// --------------------------------------- inner compound wall + wall breach

function buildCompoundWallAndBreach(ctx, rng) {
  // Solid 5 m wall on x = 58 (z -58..20) with the breach gap EXACTLY z 4..8.
  ctx.solid('concrete', 1.0, 5, 62, 58, 0, -27); // z -58..4
  ctx.solid('concrete', 1.0, 5, 12, 58, 0, 14);  // z 8..20
  ctx.pushBox('concreteDark', 1.2, 0.25, 62, 58, 5, -27); // cap course
  ctx.pushBox('concreteDark', 1.2, 0.25, 12, 58, 5, 14);

  // Crumbled shoulders: jagged chunks + rebar at both gap edges (visual).
  for (const gz of [3.6, 8.4]) {
    for (let i = 0; i < 3; i++) {
      ctx.pushBox('concreteDark',
        0.5 + rng() * 0.5, 0.5 + rng() * 0.6, 0.4 + rng() * 0.4,
        58 + (rng() - 0.5) * 0.5, 3.3 + i * 0.55, gz + (rng() - 0.5) * 0.5,
        rng() * Math.PI);
    }
    ctx.pushBox('rust', 0.04, 0.9, 0.04,
      58 + (rng() - 0.5) * 0.4, 3.6 + rng() * 0.9, gz, rng() * Math.PI);
  }

  // Climbable rubble mound through the gap (0.4 rises from either side).
  ctx.solid('concreteDark', 0.9, 0.4, 3.6, 56.35, 0, 6);
  ctx.solid('concreteDark', 0.9, 0.8, 3.6, 57.25, 0, 6);
  ctx.solid('concreteDark', 0.9, 0.8, 3.6, 58.15, 0, 6);
  ctx.solid('concreteDark', 0.9, 0.4, 3.6, 59.05, 0, 6);

  // Scattered debris around both sides of the breach (visual, walk-through).
  for (let i = 0; i < 14; i++) {
    ctx.pushBox('concreteDark',
      0.25 + rng() * 0.55, 0.12 + rng() * 0.28, 0.25 + rng() * 0.55,
      55.2 + rng() * 5.8, 0, 3 + rng() * 6, rng() * Math.PI);
  }
}

// ------------------------------------------------- workshop + boiler room

function buildWorkshopAndBoilers(ctx, rng) {
  // Roofless brick building x 26..54, z -56..-32; divider at x 42 splits the
  // workshop (west) from the boiler room (east). Door gaps get lintels.
  ctx.solid('brick', 28, 5.5, 0.4, 40, 0, -56);        // south wall
  ctx.solid('brick', 5, 5.5, 0.4, 28.5, 0, -32);       // north wall (door x 31..35)
  ctx.solid('brick', 19, 5.5, 0.4, 44.5, 0, -32);
  ctx.solid('brick', 4, 2.9, 0.4, 33, 2.6, -32);
  ctx.solid('brick', 0.4, 5.5, 10, 26, 0, -51);        // west wall (door z -46..-42)
  ctx.solid('brick', 0.4, 5.5, 10, 26, 0, -37);
  ctx.solid('brick', 0.4, 2.9, 4, 26, 2.6, -44);
  ctx.solid('brick', 0.4, 5.5, 16, 54, 0, -48);        // east wall (door z -40..-36)
  ctx.solid('brick', 0.4, 5.5, 4, 54, 0, -34);
  ctx.solid('brick', 0.4, 2.9, 4, 54, 2.6, -38);
  ctx.solid('brick', 0.4, 5.5, 4, 42, 0, -54);         // divider (door z -52..-48)
  ctx.solid('brick', 0.4, 5.5, 16, 42, 0, -40);
  ctx.solid('brick', 0.4, 2.9, 4, 42, 2.6, -50);
  ctx.pushBox('caution', 0.15, 2.6, 0.45, 31.1, 0, -32); // north door jambs
  ctx.pushBox('caution', 0.15, 2.6, 0.45, 34.9, 0, -32);
  ctx.pushBox('floor', 27.2, 0.05, 23.2, 40, 0, -44);    // interior floor skin

  // Workshop: benches, pegboard, press, shelving.
  for (const bx of [30.2, 34.6]) {
    ctx.solid('steelDark', 3.2, 0.82, 1.0, bx, 0, -55.2);
    ctx.pushBox('floor', 3.3, 0.08, 1.06, bx, 0.82, -55.2);
    ctx.pushBox('steel', 0.35, 0.2, 0.3, bx - 1 + rng() * 2, 0.9, -55.2); // tool clutter
    ctx.pushBox('caution', 0.3, 0.14, 0.22, bx - 1 + rng() * 2, 0.9, -55.05);
  }
  ctx.pushBox('rust', 5.5, 2.2, 0.08, 32.4, 1.1, -55.75); // pegboard
  for (let i = 0; i < 5; i++) {
    ctx.pushBox('steel', 0.08, 0.3 + rng() * 0.4, 0.06,
      30.2 + i * 1.1, 1.5 + rng() * 0.5, -55.68); // hung tools
  }
  ctx.solid('steelDark', 1.2, 0.5, 1.0, 39.5, 0, -53.5);  // press base
  ctx.pushBox('steel', 0.35, 2.4, 0.35, 39.8, 0.5, -53.5);
  ctx.pushBox('steel', 0.9, 0.55, 0.8, 39.5, 1.95, -53.5);
  ctx.pushBox('caution', 0.7, 0.06, 0.6, 39.35, 0.5, -53.5);
  // Low climbable shelf unit (0.45 / 0.9 tiers — a monkey perch).
  ctx.solid('floor', 1.0, 0.06, 3.2, 26.9, 0.39, -38.5);
  ctx.solid('floor', 1.0, 0.06, 3.2, 26.9, 0.84, -38.5);
  for (const uz of [-40, -37]) {
    ctx.pushBox('steelDark', 0.07, 1.0, 0.07, 26.45, 0, uz);
    ctx.pushBox('steelDark', 0.07, 1.0, 0.07, 27.35, 0, uz);
  }
  ctx.solid('floor', 0.55, 0.45, 0.55, 26.9, 0, -40.5); // crate step up to the shelf top
  ctx.solid('steelDark', 4, 2.2, 0.8, 39, 0, -33);        // tall storage rack
  ctx.pushBox('floor', 4.1, 0.06, 0.86, 39, 0.75, -33);
  ctx.pushBox('floor', 4.1, 0.06, 0.86, 39, 1.5, -33);

  // Boiler room: three riveted boilers with box colliders + pipe runs.
  const boilerX = [45.2, 48.6, 52.0];
  for (const bx of boilerX) {
    ctx.pushCyl('rust', 1.15, 1.15, 3.6, 14, bx, 0, -53.6);
    ctx.pushCyl('rust', 0.7, 1.15, 0.5, 14, bx, 3.6, -53.6);
    ctx.boxCollider(2.3, 3.6, 2.3, bx, 0, -53.6);
    ctx.pushBox('steelDark', 0.7, 0.9, 0.1, bx, 0.3, -52.4);  // fire door
    ctx.pushBox('caution', 0.6, 0.18, 0.06, bx, 1.35, -52.42);
    ctx.pushCyl('pipe', 0.16, 0.16, 2.5, 8, bx, 3.2, -54.4);  // steam stack
    ctx.pushBox('pipe', 0.24, 0.24, 1.9, bx, 3.92, -54.4);    // feed drop
    ctx.pushBox('caution', 0.3, 0.3, 0.08, bx, 3.85, -53.3);  // valve wheel
  }
  ctx.pushBox('pipe', 10, 0.28, 0.28, 48.6, 3.9, -55.35);     // header run
  ctx.pushCyl('pipe', 0.14, 0.14, 3.9, 8, 43.6, 0, -55.3);    // riser

  // Roof catwalk OVER the boilers (walk surface y 4.5) + 10x0.45 stairs.
  ctx.solid('steel', 10.8, 0.22, 3.0, 48.2, 4.28, -53.5);
  ctx.stairs({ bucket: 'steel', x: 52.9, z: -45, dir: '-z',
    width: 1.4, steps: 10, rise: 0.45, run: 0.7 });
  ctx.pushBox('steelDark', 9.3, 0.85, 0.06, 47.45, 4.5, -52.03); // railings (gap at stair landing)
  ctx.pushBox('steelDark', 10.8, 0.85, 0.06, 48.2, 4.5, -54.97);
  ctx.pushBox('steelDark', 0.06, 0.85, 3.0, 42.83, 4.5, -53.5);

  // Two flickering red boiler lights + rng-seeded steam puffs, all driven by
  // ONE registered updater. Steam material is bespoke dynamic material #1.
  const lights = [];
  for (const lx of [45.2, 52.0]) {
    const pl = new THREE.PointLight(0xff2d12, 1.5, 16, 1.9);
    pl.position.set(lx, 2.9, -52.2);
    ctx.addMesh(pl);
    lights.push(pl);
    ctx.pushBox('glow', 0.14, 0.14, 0.14, lx, 2.83, -52.2);
    ctx.pushBox('steelDark', 0.24, 0.08, 0.24, lx, 2.97, -52.2);
  }
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    puffs.push({
      x: boilerX[i % 3], z: -54.4,
      off: rng() * 3, speed: 0.7 + rng() * 0.5, sway: rng() * Math.PI * 2
    });
  }
  const steamMat = new THREE.MeshBasicMaterial({
    color: 0xb9c0c6, transparent: true, opacity: 0.32, depthWrite: false
  });
  const steam = ctx.makeInstanced(
    new THREE.SphereGeometry(0.3, 8, 6), steamMat,
    puffs.map(() => ctx.matrixAt(0, -50, 0, 0, 0, 0, 1, 1, 1)),
    { cast: false, receive: false }
  );
  const phases = [rng() * 10, rng() * 10, rng() * 10, rng() * 10];
  const dummy = new THREE.Object3D();
  ctx.registerUpdater((_dt, time) => {
    lights[0].intensity = 1.15 + 0.55 * Math.sin(time * 11 + phases[0]) *
      Math.abs(Math.sin(time * 5.1 + phases[1]));
    lights[1].intensity = 1.15 + 0.55 * Math.sin(time * 9.7 + phases[2]) *
      Math.abs(Math.sin(time * 6.3 + phases[3]));
    for (let i = 0; i < puffs.length; i++) {
      const p = puffs[i];
      const h = (time * p.speed + p.off) % 3;
      const s = 0.5 + h * 0.5;
      dummy.position.set(
        p.x + Math.sin(time * 0.8 + p.sway) * 0.12 * h, 5.75 + h, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      steam.setMatrixAt(i, dummy.matrix);
    }
    steam.instanceMatrix.needsUpdate = true;
  });
}

// ------------------------------------------- motor pool / vehicle sally

function buildMotorPool(ctx, rng) {
  // Open garage: roof slab on six concrete columns (x 18..42, z 38..56).
  ctx.solid('steelDark', 24, 0.35, 18, 30, 5.0, 47);
  ctx.pushBox('caution', 24.2, 0.3, 0.12, 30, 4.72, 38); // fascia stripe
  for (const cx of [18.5, 30, 41.5]) {
    for (const cz of [38.5, 55.5]) {
      ctx.solid('concreteDark', 0.5, 5.0, 0.5, cx, 0, cz);
    }
  }
  const garageLight = new THREE.PointLight(0xffc873, 1.1, 22, 1.8);
  garageLight.position.set(30, 4.4, 46);
  ctx.addMesh(garageLight);
  ctx.pushBox('lightFixture', 1.4, 0.1, 0.35, 30, 4.55, 46);

  // Blocky prison bus (x 24.5..35.5, z 44.6..47.4): hollow, enterable via a
  // 0.25 step at the south-side door; roof reached over the crate stair.
  ctx.solid('steelDark', 11, 0.35, 2.8, 30, 0.15, 46);        // chassis/floor (top 0.5)
  ctx.solid('steelDark', 1.2, 0.25, 0.5, 34.2, 0, 47.65);     // door step
  ctx.solid('steelDark', 11, 2.1, 0.18, 30, 0.5, 44.69);      // north side
  ctx.solid('steelDark', 9.1, 2.1, 0.18, 29.05, 0.5, 47.31);  // south side (door x 33.6..34.8)
  ctx.solid('steelDark', 0.7, 2.1, 0.18, 35.15, 0.5, 47.31);
  ctx.solid('steelDark', 0.18, 2.1, 2.8, 24.59, 0.5, 46);     // front
  ctx.solid('steelDark', 0.18, 2.1, 2.8, 35.41, 0.5, 46);     // rear
  ctx.solid('steelDark', 11, 0.3, 2.8, 30, 2.6, 46);          // roof (top 2.9)
  ctx.pushBox('bars', 9.5, 0.75, 0.05, 30, 1.55, 44.58);      // barred windows
  ctx.pushBox('bars', 8.6, 0.75, 0.05, 28.9, 1.55, 47.44);
  ctx.pushBox('glass', 0.05, 0.9, 2.3, 24.48, 1.4, 46);       // windshield
  ctx.pushBox('caution', 11.1, 0.28, 0.04, 30, 0.95, 44.56);  // livery stripes
  ctx.pushBox('caution', 9.1, 0.28, 0.04, 29.05, 0.95, 47.46);
  ctx.pushBox('caution', 0.7, 0.28, 0.04, 35.15, 0.95, 47.46);
  ctx.pushBox('steel', 0.2, 0.25, 2.9, 24.4, 0.45, 46);       // bumpers
  ctx.pushBox('steel', 0.2, 0.25, 2.9, 35.6, 0.45, 46);
  ctx.pushBox('glow', 0.05, 0.12, 0.3, 24.28, 0.52, 45.2);    // headlights on bumper
  ctx.pushBox('glow', 0.05, 0.12, 0.3, 24.28, 0.52, 46.8);
  ctx.pushBox('caution', 0.8, 0.04, 0.8, 27, 2.9, 46);        // roof hatch
  for (const bx of [26.5, 28.5]) {                            // interior benches
    ctx.solid('steelDark', 0.9, 0.4, 0.6, bx, 0.5, 45.15);
    ctx.solid('steelDark', 0.9, 0.4, 0.6, bx, 0.5, 46.85);
  }
  // Crate stair up the rear to the roof (0.45 rises, then 0.2 onto roof).
  for (let i = 0; i < 6; i++) {
    ctx.solid('floor', 0.95, 2.7 - i * 0.45, 0.95, 35.975 + i * 0.95, 0, 46);
  }

  // Fuel island: raised pad, two pumps, caution bollards.
  ctx.solid('concrete', 1.7, 0.12, 6.4, 48, 0, 31.5);
  for (const pz of [29.9, 33.1]) {
    ctx.solid('rust', 0.65, 1.25, 0.5, 48, 0.12, pz);
    ctx.pushBox('caution', 0.67, 0.4, 0.52, 48, 0.75, pz);
    ctx.pushBox('steelDark', 0.7, 0.08, 0.55, 48, 1.37, pz);
    ctx.pushBox('steelDark', 0.05, 0.7, 0.05, 48.38, 0.55, pz + 0.3); // hose
  }
  ctx.solid('caution', 0.18, 0.9, 0.18, 48, 0.12, 28.9);
  ctx.solid('caution', 0.18, 0.9, 0.18, 48, 0.12, 34.1);

  // Tires: one InstancedMesh (bespoke rubber material #2) for the four bus
  // wheels + three flat stacks (each stack gets one AABB collider).
  const tireMats = [];
  for (const wx of [26.6, 33.4]) {
    for (const wz of [44.8, 47.2]) {
      tireMats.push(ctx.matrixAt(wx, 0.5, wz, 0, 0, 0, 1, 1, 1));
    }
  }
  for (const [sx, sz, n] of [[44.5, 53, 4], [46.8, 54.2, 3], [44.9, 50.6, 5]]) {
    for (let k = 0; k < n; k++) {
      tireMats.push(ctx.matrixAt(
        sx + (rng() - 0.5) * 0.12, 0.17 + k * 0.33, sz + (rng() - 0.5) * 0.12,
        Math.PI / 2, 0, rng() * Math.PI, 1, 1, 1));
    }
    ctx.boxCollider(1.2, n * 0.33 + 0.1, 1.2, sx, 0, sz);
  }
  const rubberMat = new THREE.MeshStandardMaterial({
    color: 0x23262a, roughness: 0.95, metalness: 0.05
  });
  ctx.makeInstanced(new THREE.TorusGeometry(0.42, 0.16, 8, 14), rubberMat, tireMats);

  // Closed roll-up sally door face at the z 58 edge (jambs/header + ribbed
  // panel), aligned with the bus lane. The map stays sealed regardless — the
  // outer perimeter wall is 12 m further south.
  ctx.solid('concrete', 1.2, 5.6, 0.6, 25.6, 0, 57.7);
  ctx.solid('concrete', 1.2, 5.6, 0.6, 38.4, 0, 57.7);
  ctx.solid('concrete', 14, 1.2, 0.6, 32, 4.4, 57.7);
  ctx.solid('steel', 11.6, 4.4, 0.25, 32, 0, 57.7);
  for (let i = 0; i < 5; i++) {
    ctx.pushBox('steelDark', 11.6, 0.06, 0.31, 32, 0.7 + i * 0.7, 57.7); // ribs
  }
  ctx.pushBox('caution', 0.5, 2.2, 0.64, 25.6, 0, 57.7);
  ctx.pushBox('caution', 0.5, 2.2, 0.64, 38.4, 0, 57.7);
  ctx.pushBox('caution', 3.0, 0.6, 0.08, 32, 4.6, 57.36); // "SALLY PORT" board

  // West apron: jersey barriers + painted parking stalls (flat, walkable).
  for (const bz of [30, 35]) {
    ctx.solid('concreteDark', 0.5, 0.9, 3.4, 5, 0, bz);
    ctx.pushBox('caution', 0.34, 0.12, 3.4, 5, 0.9, bz);
  }
  for (const lx of [4, 7, 10, 13]) {
    ctx.pushBox('caution', 0.12, 0.02, 5, lx, 0, 47);
  }
}
