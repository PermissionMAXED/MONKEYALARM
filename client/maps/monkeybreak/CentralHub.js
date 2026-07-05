import * as THREE from 'three';
import { SEEDS } from './shared.js';

/**
 * CENTRAL HUB — gatehouse + main gate, rotunda with guard station and upper
 * gallery, warden's office (keycard safe), cafeteria/kitchen and infirmary.
 *
 * Frozen contract kept here:
 * - 5 police spawns around the rotunda guard station near (0, y, -10).
 * - addEscapeExit MAIN_GATE at (0, 0, -70), radius 2.4, requiresKeycard true.
 * - dynamics mainGate / sallyGateA / sallyGateB, each { open(), close(),
 *   get isOpen() }, all CLOSED by default. The dead-end tunnel behind the
 *   main gate ends in a STATIC barred grille so the map stays sealed.
 * - addEscapeItem 'keycard-1' (KEYCARD) hovering above the warden's safe.
 *
 * SEAM_GATE stays walkable end to end; the main gate (plus the section-spec'd
 * inner sally gate) are its only openable blockers.
 */

const WALL_H = 7;

/** Uniformly scales a geometry's UVs (texel density for standalone meshes). */
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}

/**
 * Standalone sliding-slab gate. The mesh eases sideways over `duration`
 * seconds via a registered updater; the collider parks at y-5000 the moment
 * open() is called and is restored EXACTLY (Box3.copy of its home) on close().
 */
function slidingGate(ctx, { w, h, d, x, z, mat, dx = 0, dz = 0, duration = 1.5 }) {
  const geo = new THREE.BoxGeometry(w, h, d);
  scaleUV(geo, Math.max(w, d) / 3, h / 3);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  ctx.addMesh(mesh);
  const collider = ctx.boxCollider(w, h, d, x, 0, z);
  const home = collider.clone();
  let isOpen = false;
  let t = 0; // 0 = closed .. 1 = fully open
  ctx.registerUpdater((dt) => {
    const target = isOpen ? 1 : 0;
    if (t === target) return;
    t = isOpen ? Math.min(1, t + dt / duration) : Math.max(0, t - dt / duration);
    mesh.position.set(x + dx * t, h / 2, z + dz * t);
  });
  return {
    open() {
      if (isOpen) return;
      isOpen = true;
      collider.min.y = home.min.y - 5000;
      collider.max.y = home.max.y - 5000;
    },
    close() {
      if (!isOpen) return;
      isOpen = false;
      collider.copy(home);
    },
    get isOpen() {
      return isOpen;
    }
  };
}

export function buildCentralHub(ctx) {
  const rng = ctx.makeRng(SEEDS.HUB);

  // ---------------------------------------------------------- region walls
  // East/west walls at x=+-22 with 4 m door gaps at z=-10+-2 and z=8+-2.
  for (const s of [-1, 1]) {
    ctx.solid('brick', 0.8, WALL_H, 50, s * 22, 0, -37); // z -62..-12
    ctx.solid('brick', 0.8, WALL_H, 14, s * 22, 0, -1);  // z  -8..6
    ctx.solid('brick', 0.8, WALL_H, 12, s * 22, 0, 16);  // z  10..22
  }
  // South walls at z=22 with gaps at x=-12+-2 (cafeteria) and x=12+-2 (infirmary).
  ctx.solid('brick', 8, WALL_H, 0.8, -18, 0, 22);
  ctx.solid('brick', 10, WALL_H, 0.8, -5, 0, 22);
  ctx.solid('brick', 10, WALL_H, 0.8, 5, 0, 22);
  ctx.solid('brick', 8, WALL_H, 0.8, 18, 0, 22);

  // ------------------------------------------------- gatehouse + main gate
  // Corridor walls flanking SEAM_GATE (inner faces at x=+-6), rotunda mouth
  // (z -20.5) to the dead-end grille (z -72). East wall leaves the booth door.
  ctx.solid('brick', 1, WALL_H, 51.5, -6.5, 0, -46.25);
  ctx.solid('brick', 1, WALL_H, 16, 6.5, 0, -64);      // z -72..-56
  ctx.solid('brick', 1, WALL_H, 33.5, 6.5, 0, -37.25); // z -54..-20.5
  // Tunnel roof (seals above the gate/grille) + brick facade header plugging
  // the perimeter north-wall gap above the tunnel mouth.
  ctx.solid('concrete', 14, 0.5, 10.4, 0, 5, -67);
  ctx.solid('brick', 14, 3.6, 1.2, 0, 5.4, -62);
  // Static barred grille sealing the dead end of the tunnel.
  ctx.solid('bars', 12, 5, 0.3, 0, 0, -71.7);
  // Caution jambs framing the main gate slab.
  ctx.solid('caution', 1.4, 5, 1, -5.5, 0, -64);
  ctx.solid('caution', 1.4, 5, 1, 5.5, 0, -64);

  // Main gate: bespoke sliding steel slab; open() pockets it +x into the wall.
  ctx.registerDynamic('mainGate', slidingGate(ctx, {
    w: 10, h: 5, d: 0.6, x: 0, z: -64, mat: ctx.mats.steelDark, dx: 11
  }));
  // Inner sally gate across the corridor, forming the sally chamber.
  ctx.registerDynamic('sallyGateA', slidingGate(ctx, {
    w: 12.4, h: 4.4, d: 0.4, x: 0, z: -58, mat: ctx.mats.bars, dx: 13
  }));

  // Guard booth off the sally corridor (door gap in the east wall, z -56..-54).
  ctx.solid('concrete', 0.6, 3.2, 4.6, 10.6, 0, -55);
  ctx.solid('concrete', 3.8, 3.2, 0.6, 8.6, 0, -57.2);
  ctx.solid('concrete', 3.8, 3.2, 0.6, 8.6, 0, -52.8);
  ctx.pushBox('steelDark', 0.9, 1.05, 3.4, 9.8, 0, -55); // duty counter
  ctx.boxCollider(0.9, 1.05, 3.4, 9.8, 0, -55);

  ctx.addEscapeExit({
    id: 'MAIN_GATE', name: 'Main Gate',
    x: 0, y: 0, z: -70, radius: 2.4, requiresKeycard: true
  });

  // ------------------------------------------------------------- rotunda
  // Octagonal drum at (0,-10), two stories: axis-aligned cardinal walls with
  // N/S/E/W openings, diagonal corner slabs (visual rotY +-PI/4) backed by
  // two stepped AABB colliders each.
  ctx.pushCyl('concreteDark', 10.2, 10.2, 0.06, 24, 0, 0, -10); // floor pad
  for (const s of [-1, 1]) {
    ctx.solid('concrete', 0.7, WALL_H, 4.5, -10.5, 0, -10 + s * 4.25); // west
    ctx.solid('concrete', 0.7, WALL_H, 4.5, 10.5, 0, -10 + s * 4.25);  // east
    ctx.solid('concrete', 4.5, WALL_H, 0.7, s * 4.25, 0, 0.5);         // south
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) { // sz -1 = north corners, +1 = south corners
      ctx.pushBox('concrete', 6.4, WALL_H, 0.7,
        sx * 8.5, 0, -10 + sz * 8.5, sx * sz * (Math.PI / 4));
      ctx.boxCollider(2.9, WALL_H, 2.9, sx * 7.5, 0, -10 + sz * 9.5);
      ctx.boxCollider(2.9, WALL_H, 2.9, sx * 9.5, 0, -10 + sz * 7.5);
    }
  }

  // Central raised guard station (two 0.4 steps up) with a console desk.
  ctx.solid('concreteDark', 6.6, 0.4, 6.6, 0, 0, -10);
  ctx.solid('concreteDark', 5, 0.8, 5, 0, 0, -10);
  ctx.solid('steelDark', 2.4, 1.0, 0.8, 0, 0.8, -11.6);
  ctx.pushBox('glow', 2, 0.45, 0.08, 0, 1.8, -11.9); // console screens

  // Police spawns around/on the guard station (order = spawn index order).
  ctx.addPoliceSpawn(0, 0.8, -9);
  ctx.addPoliceSpawn(-4.8, 0, -10);
  ctx.addPoliceSpawn(4.8, 0, -10);
  ctx.addPoliceSpawn(0, 0, -15);
  ctx.addPoliceSpawn(0, 0, -5);

  // Stair up to the east gallery ring (rise 0.4 x 8 = y 3.2 top).
  ctx.stairs({
    bucket: 'concreteDark', x: 2.4, z: -5.6, dir: '+x',
    width: 2.2, steps: 8, rise: 0.4, run: 0.7
  });
  // Gallery balcony along the inner east wall; railing is visual-only.
  ctx.solid('concreteDark', 2.15, 0.3, 9.5, 9.07, 2.9, -8.75);
  ctx.pushBox('steelDark', 0.07, 1.05, 6.5, 8.05, 3.2, -10.25);

  // ------------------------------------------------------ warden's office
  // Elevated room off the gallery, above the east ground corridor; entered
  // through the east wall opening (z -12..-8) at gallery level.
  ctx.solid('concreteDark', 7.5, 0.3, 10, 13.9, 2.9, -9);          // floor
  ctx.solid('concrete', 7.4, 3.2, 0.4, 13.9, 3.2, -13.8);          // north
  ctx.solid('concrete', 0.4, 3.2, 10, 17.4, 3.2, -9);              // east
  ctx.pushBox('glass', 7.4, 3.2, 0.15, 13.9, 3.2, -4.2);           // glass wall
  ctx.boxCollider(7.4, 3.2, 0.15, 13.9, 3.2, -4.2);
  ctx.solid('steelDark', 2, 0.85, 0.9, 14, 3.2, -11.5);            // desk
  ctx.solid('steel', 1.0, 1.2, 1.0, 16.6, 3.2, -13.05);            // safe
  ctx.pushBox('steel', 0.08, 1.1, 0.85, 16.06, 3.25, -12.15);      // safe door ajar
  // Keycard hovers above the safe.
  ctx.addEscapeItem({ id: 'keycard-1', type: 'KEYCARD', x: 16.6, y: 4.75, z: -13.05 });

  // Sally gate on the east ground corridor's outer door (x=22 wall, z -12..-8).
  ctx.registerDynamic('sallyGateB', slidingGate(ctx, {
    w: 0.4, h: 3.6, d: 4.4, x: 22, z: -10, mat: ctx.mats.bars, dz: 4.8
  }));

  // -------------------------------------------------- cafeteria + kitchen
  ctx.pushBox('tile', 21.2, 0.06, 19.2, -11, 0, 12); // floor pad
  ctx.solid('concrete', 0.5, WALL_H, 16, 0, 0, 14);  // divider, passage at z 2..6
  // Serving counter: top slab collider only, so monkeys can hide underneath.
  ctx.pushBox('steel', 6, 0.14, 1.5, -16, 1.02, 4.5);
  ctx.boxCollider(6, 0.2, 1.5, -16, 1.0, 4.5);
  ctx.pushBox('steel', 0.14, 1.0, 1.5, -18.95, 0, 4.5);
  ctx.pushBox('steel', 0.14, 1.0, 1.5, -13.05, 0, 4.5);
  // Long dining tables with benches.
  for (const zz of [9, 14.5]) {
    ctx.solid('steelDark', 6, 0.82, 1.1, -9.5, 0, zz);
    ctx.solid('concreteDark', 6, 0.45, 0.45, -9.5, 0, zz - 1.05);
    ctx.solid('concreteDark', 6, 0.45, 0.45, -9.5, 0, zz + 1.05);
  }
  // Walk-in freezer nook in the kitchen's back corner (door gap z 17.8..19.2).
  ctx.solid('steel', 3.5, 3, 0.4, -20.25, 0, 16);
  ctx.solid('steel', 0.4, 3, 1.8, -18.5, 0, 16.9);
  ctx.solid('steel', 0.4, 3, 2.8, -18.5, 0, 20.6);
  ctx.pushBox('steel', 3.9, 0.3, 6.4, -20.25, 3, 19); // freezer ceiling
  ctx.pushBox('steel', 3, 0.08, 0.7, -20.2, 1.5, 21.2); // shelf

  // ------------------------------------------------------------ infirmary
  // Keep z 2..10 clear: SEAM_EAST corridor runs through here to the x=22 door.
  ctx.pushBox('tile', 21.2, 0.06, 19.2, 11, 0, 12); // floor pad
  // Bed row along the east wall as one InstancedMesh (rng jitters the yaw).
  const bedGeo = new THREE.BoxGeometry(2.2, 0.55, 1.05);
  const bedMatrices = [];
  for (const bz of [12.5, 15, 17.5, 20]) {
    bedMatrices.push(ctx.matrixAt(20.4, 0.42, bz, 0, (rng() - 0.5) * 0.14, 0, 1, 1, 1));
    ctx.boxCollider(2.2, 0.7, 1.05, 20.4, 0, bz);
  }
  ctx.makeInstanced(bedGeo, ctx.mats.tile, bedMatrices);
  ctx.solid('steel', 1.4, 1.9, 0.6, 16.5, 0, 21.2);      // supply cabinet
  ctx.pushBox('tile', 0.1, 1.7, 1.6, 19.1, 0, 13.75);    // privacy screens
  ctx.pushBox('tile', 0.1, 1.7, 1.6, 19.1, 0, 16.25);

  // -------------------------------------------------------- monkey spawns
  ctx.addMonkeySpawn(-16, 0, 4.5);      // under the cafeteria serving counter
  ctx.addMonkeySpawn(-20.3, 0, 19.5);   // walk-in freezer
  ctx.addMonkeySpawn(20.4, 0, 18.75);   // between infirmary beds
  ctx.addMonkeySpawn(9.1, 3.2, -12.5);  // rotunda gallery
  ctx.addMonkeySpawn(8.1, 0, -55);      // gatehouse booth
  ctx.addMonkeySpawn(14.5, 3.2, -7);    // warden's office

  // --------------------------------------------------------------- lights
  const lightDefs = [
    [0, 5.6, -10],   // rotunda
    [0, 4.4, -63],   // sally chamber / tunnel mouth
    [-11, 5.2, 12],  // cafeteria
    [11, 5.2, 12]    // infirmary
  ];
  for (const [lx, ly, lz] of lightDefs) {
    const light = new THREE.PointLight(0xffd9a4, 18, 24, 1.8);
    light.position.set(lx, ly, lz);
    ctx.addMesh(light);
    ctx.pushBox('lightFixture', 0.9, 0.15, 0.9, lx, ly + 0.15, lz);
  }
}
