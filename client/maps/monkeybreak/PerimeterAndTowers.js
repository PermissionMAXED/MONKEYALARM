import * as THREE from 'three';
import { SEEDS } from './shared.js';

/**
 * PERIMETER & TOWERS — the sealed 16 m outer wall ring, six guard towers
 * with swept searchlights, and the patrol strip between |coord| = 62 and
 * the walls.
 *
 * Frozen contract (from the stub):
 * - Walls at +/-70.8: 16 m tall, 2.4 thick, barbed-wire crown, with the
 *   north gate gap at x in [-6, 6]. The gap is a tunnel mouth: a heavy
 *   lintel spans it from y = 5 up to the wall top, and the CentralHub
 *   gatehouse plugs the opening — the perimeter stays sealed.
 * - 2 COFFEE escape items ('coffee-1', 'coffee-2') at the guard posts.
 */

const WALL_H = 16;
const WALL = 70.8;   // wall centreline
const PLAT_Y = 6.3;  // tower platform walking surface
const DIRS = ['+x', '+z', '-x', '-z'];

/**
 * Quarter-turn local->world helper so one tower/post definition serves every
 * orientation while keeping all colliders axis-aligned (dims swap on odd k).
 */
function rotSpace(ctx, cx, cz, k) {
  const cs = [1, 0, -1, 0][k];
  const sn = [0, 1, 0, -1][k];
  const swap = k % 2 === 1;
  const wx = (lx, lz) => cx + cs * lx - sn * lz;
  const wz = (lx, lz) => cz + sn * lx + cs * lz;
  return {
    wx,
    wz,
    dir: (d) => DIRS[(DIRS.indexOf(d) + k) % 4],
    box(bucket, w, h, d, lx, y, lz, collide = false) {
      (collide ? ctx.solid : ctx.pushBox)(
        bucket, swap ? d : w, h, swap ? w : d, wx(lx, lz), y, wz(lx, lz));
    }
  };
}

export function buildPerimeterAndTowers(ctx) {
  const rng = ctx.makeRng(SEEDS.PERIM);

  buildWalls(ctx, rng);

  // Six towers: k orients each so its switchback stair lands inside the
  // ring region (|x| > 62 or |z| > 62) without touching a wall face.
  const towers = [
    { x: 66, z: 66, k: 2, spawn: false },
    { x: -66, z: 66, k: 3, spawn: true },
    { x: 66, z: -66, k: 1, spawn: true },
    { x: -66, z: -66, k: 0, spawn: false },
    { x: 0, z: 66, k: 3, spawn: false },
    { x: -66, z: 0, k: 0, spawn: false }
  ];
  const lamps = towers.map((t) => buildTower(ctx, t));

  buildSearchlightsAndStrobes(ctx, lamps);
  buildPatrolStrip(ctx, rng);
}

// ------------------------------------------------------------------- walls

function buildWalls(ctx, rng) {
  // North wall (z = -70.8): two segments leaving the x [-6, 6] gate gap,
  // plus a heavy lintel from y = 5 to the wall top (tunnel mouth, not a
  // sky gap). SEAM_GATE stays traversable at ground level.
  ctx.solid('concrete', 66, WALL_H, 2.4, -39, 0, -WALL);
  ctx.solid('concrete', 66, WALL_H, 2.4, 39, 0, -WALL);
  ctx.solid('concrete', 13.6, WALL_H - 5, 2.4, 0, 5, -WALL);
  // South / west / east — continuous 144 m runs, overlapping at corners.
  ctx.solid('concrete', 144, WALL_H, 2.4, 0, 0, WALL);
  ctx.solid('concrete', 2.4, WALL_H, 144, -WALL, 0, 0);
  ctx.solid('concrete', 2.4, WALL_H, 144, WALL, 0, 0);

  // Coping course along every wall top (decorative; unreachable at 16 m).
  ctx.pushBox('concreteDark', 145.2, 0.4, 3.4, 0, WALL_H, -WALL);
  ctx.pushBox('concreteDark', 145.2, 0.4, 3.4, 0, WALL_H, WALL);
  ctx.pushBox('concreteDark', 3.4, 0.4, 145.2, -WALL, 0 + WALL_H, 0);
  ctx.pushBox('concreteDark', 3.4, 0.4, 145.2, WALL, WALL_H, 0);

  // Inner-face pilasters every 12 m (flush relief — no ledges, no colliders).
  for (let p = -66; p <= 66; p += 12) {
    if (Math.abs(p) >= 8) {
      ctx.pushBox('concreteDark', 0.9, 15.4, 0.55, p, 0, -69.45);
    }
    ctx.pushBox('concreteDark', 0.9, 15.4, 0.55, p, 0, 69.45);
    ctx.pushBox('concreteDark', 0.55, 15.4, 0.9, -69.45, 0, p);
    ctx.pushBox('concreteDark', 0.55, 15.4, 0.9, 69.45, 0, p);
  }

  // Caution pillars flanking the gate mouth.
  ctx.pushBox('caution', 0.6, 5, 0.3, -6.4, 0, -69.45);
  ctx.pushBox('caution', 0.6, 5, 0.3, 6.4, 0, -69.45);

  // Barbed-wire crown: ONE InstancedMesh of coils lying along each wall top.
  // The run over the gate gap rides the gatehouse header (tops out at 16 too).
  const coils = [];
  for (let c = -69; c <= 69; c += 1.8) {
    const sy = 0.95 + rng() * 0.15;
    coils.push(ctx.matrixAt(c, WALL_H + 0.55 + rng() * 0.08, -WALL, 0, 0, Math.PI / 2, 1, sy, 1));
    coils.push(ctx.matrixAt(c, WALL_H + 0.55 + rng() * 0.08, WALL, 0, 0, Math.PI / 2, 1, sy, 1));
    coils.push(ctx.matrixAt(-WALL, WALL_H + 0.55 + rng() * 0.08, c, Math.PI / 2, 0, 0, 1, sy, 1));
    coils.push(ctx.matrixAt(WALL, WALL_H + 0.55 + rng() * 0.08, c, Math.PI / 2, 0, 0, 1, sy, 1));
  }
  const coilGeo = new THREE.CylinderGeometry(0.15, 0.15, 1.9, 5);
  ctx.makeInstanced(coilGeo, ctx.mats.barbedWire, coils, { cast: false, receive: false });
}

// ------------------------------------------------------------------ towers

/**
 * One guard tower: 4 legs, platform at y = 6.3, enclosed cabin (parapet +
 * glass band + roof), and a switchback stair (2 x 7 steps, rise 0.45, mid
 * landing at 3.15) whose top step lands flush in the parapet entry gap.
 * Returns lamp/roof anchors for the searchlight pass.
 */
function buildTower(ctx, { x: cx, z: cz, k, spawn }) {
  const r = rotSpace(ctx, cx, cz, k);

  // Legs + braces up to the platform slab (5.95..6.3).
  for (const lx of [-1.8, 1.8]) {
    for (const lz of [-1.8, 1.8]) {
      r.box('steelDark', 0.5, 5.95, 0.5, lx, 0, lz, true);
    }
  }
  r.box('steelDark', 4.1, 0.26, 0.26, 0, 2.9, -1.8);
  r.box('steelDark', 4.1, 0.26, 0.26, 0, 2.9, 1.8);
  r.box('steelDark', 0.26, 0.26, 4.1, -1.8, 4.2, 0);
  r.box('steelDark', 0.26, 0.26, 4.1, 1.8, 4.2, 0);
  r.box('concrete', 4.6, 0.35, 4.6, 0, PLAT_Y - 0.35, 0, true);

  // Cabin: parapet (entry gap on +z at x -2.3..-1.1), posts, glass, roof.
  r.box('concreteDark', 4.6, 1.05, 0.18, 0, PLAT_Y, -2.21, true);
  r.box('concreteDark', 0.18, 1.05, 4.6, -2.21, PLAT_Y, 0, true);
  r.box('concreteDark', 0.18, 1.05, 4.6, 2.21, PLAT_Y, 0, true);
  r.box('concreteDark', 3.4, 1.05, 0.18, 0.6, PLAT_Y, 2.21, true);
  for (const lx of [-2.1, 2.1]) {
    for (const lz of [-2.1, 2.1]) {
      r.box('steelDark', 0.2, 2.6, 0.2, lx, PLAT_Y, lz);
    }
  }
  r.box('glass', 4.2, 1.35, 0.06, 0, PLAT_Y + 1.15, -2.12);
  r.box('glass', 0.06, 1.35, 4.2, -2.12, PLAT_Y + 1.15, 0);
  r.box('glass', 0.06, 1.35, 4.2, 2.12, PLAT_Y + 1.15, 0);
  r.box('glass', 4.2, 1.35, 0.06, 0, PLAT_Y + 1.15, 2.12);
  // Roof stays non-collidable so no climb route rises past the platform.
  r.box('concreteDark', 5.4, 0.28, 5.4, 0, PLAT_Y + 2.6, 0);
  r.box('steelDark', 0.6, 0.45, 0.6, 0, PLAT_Y + 2.1, 2.5);

  // Switchback stair on the +z side: flight A up to the 3.15 landing, then
  // flight B back to the platform (7 * 0.45 * 2 = 6.3 = PLAT_Y exactly).
  ctx.stairs({
    bucket: 'concrete', x: r.wx(-2.3, 4.1), z: r.wz(-2.3, 4.1),
    dir: r.dir('+x'), width: 1.2, steps: 7, rise: 0.45, run: 0.7, baseY: 0
  });
  r.box('concrete', 1.4, 3.15, 2.6, 3.3, 0, 3.5, true);
  ctx.stairs({
    bucket: 'concrete', x: r.wx(2.6, 2.9), z: r.wz(2.6, 2.9),
    dir: r.dir('-x'), width: 1.2, steps: 7, rise: 0.45, run: 0.7, baseY: 3.15
  });
  // Railings (visual): outer flight rail, landing rail, inner return rail.
  r.box('steel', 5.0, 0.08, 0.06, 0.15, 2.0, 4.76);
  r.box('steel', 0.06, 0.9, 2.7, 4.03, 3.15, 3.5);
  r.box('steel', 5.0, 0.08, 0.06, 0.15, 5.2, 3.53);

  if (spawn) ctx.addMonkeySpawn(cx, PLAT_Y, cz);

  return {
    lamp: new THREE.Vector3(r.wx(0, 2.5), PLAT_Y + 2.35, r.wz(0, 2.5)),
    roof: new THREE.Vector3(cx, PLAT_Y + 2.95, cz),
    base: Math.atan2(-cz, -cx) // aim toward the map centre
  };
}

// ---------------------------------------------- searchlights & red strobes

function buildSearchlightsAndStrobes(ctx, lamps) {
  // Bespoke dynamic materials (the only two this section owns).
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff3c4, transparent: true, opacity: 0.09,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  const strobeMat = new THREE.MeshStandardMaterial({
    color: 0x2a0404, emissive: 0xff2222, emissiveIntensity: 2, roughness: 0.4
  });

  // Beam cone: apex at the lamp, extending along +z (lookAt-friendly).
  const coneGeo = new THREE.ConeGeometry(4.6, 34, 12, 1, true);
  coneGeo.translate(0, -17, 0);
  coneGeo.rotateX(-Math.PI / 2);
  const strobeGeo = new THREE.BoxGeometry(0.5, 0.2, 0.18);

  const sweeps = lamps.map((l, i) => {
    const spot = new THREE.SpotLight(0xffe9b0, 900, 90, 0.16, 0.45, 1.7);
    spot.castShadow = false;
    spot.position.copy(l.lamp);
    const target = new THREE.Object3D();
    target.position.set(l.lamp.x + Math.cos(l.base) * 42, 0.5, l.lamp.z + Math.sin(l.base) * 42);
    spot.target = target;
    ctx.addMesh(spot);
    ctx.addMesh(target);
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.copy(l.lamp);
    cone.lookAt(target.position);
    ctx.addMesh(cone);
    return { spot, target, cone, base: l.base, phase: i * 1.13, speed: 0.35 + 0.09 * (i % 3) };
  });

  // Rotating red strobes on the four corner-tower roofs.
  const strobes = lamps.slice(0, 4).map((l) => {
    const m = new THREE.Mesh(strobeGeo, strobeMat);
    m.position.copy(l.roof);
    return ctx.addMesh(m);
  });

  // ONE updater sweeps every beam (per-tower phase) and spins the strobes.
  ctx.registerUpdater((_dt, time) => {
    for (const s of sweeps) {
      const a = s.base + Math.sin(time * s.speed + s.phase) * 0.85;
      s.target.position.set(
        s.spot.position.x + Math.cos(a) * 42, 0.5,
        s.spot.position.z + Math.sin(a) * 42);
      s.cone.lookAt(s.target.position);
    }
    strobeMat.emissiveIntensity = 1.6 + Math.sin(time * 7) * 1.1;
    for (let i = 0; i < strobes.length; i++) {
      strobes[i].rotation.y = time * 3 + i * 1.57;
    }
  });
}

// ------------------------------------------------------------ patrol strip

/** Open hut + bench; the COFFEE item hovers over the bench. Opening faces +z. */
function guardPost(ctx, cx, cz, k, coffeeId) {
  const r = rotSpace(ctx, cx, cz, k);
  r.box('concrete', 2.8, 0.12, 2.8, 0, 0, 0);
  r.box('concreteDark', 2.8, 2.3, 0.16, 0, 0, -1.32, true);
  r.box('concreteDark', 0.16, 2.3, 2.8, -1.32, 0, 0, true);
  r.box('concreteDark', 0.16, 2.3, 2.8, 1.32, 0, 0, true);
  r.box('concreteDark', 3.2, 0.22, 3.2, 0, 2.3, 0, true);
  r.box('caution', 0.7, 0.06, 0.7, 0, 2.55, 0);
  r.box('steelDark', 1.6, 0.45, 0.5, 0, 0, -0.9, true);
  ctx.addEscapeItem({ id: coffeeId, type: 'COFFEE', x: r.wx(0, -0.9), y: 0.75, z: r.wz(0, -0.9) });
}

/** Two-layer sandbag emplacement (one collider, hop-over height). */
function sandbagStack(ctx, rng, x, z, alongZ) {
  ctx.solid('dirt', alongZ ? 0.7 : 2.4, 0.42, alongZ ? 2.4 : 0.7, x, 0, z);
  ctx.pushBox('dirt', alongZ ? 0.6 : 1.8, 0.36, alongZ ? 1.8 : 0.6,
    x + (rng() - 0.5) * 0.12, 0.42, z + (rng() - 0.5) * 0.12);
}

function buildPatrolStrip(ctx, rng) {
  // Guard posts open toward the interior; they hold the two COFFEE items.
  guardPost(ctx, 66.4, -34, 1, 'coffee-1');
  guardPost(ctx, -34, 66.4, 2, 'coffee-2');

  // Sandbag emplacements — cover on the strip, walkable all around, and
  // well clear of the WALL_BREACH exit point at (60.5, 0, 6).
  sandbagStack(ctx, rng, 65.5, 30, true);
  sandbagStack(ctx, rng, -65.5, -20, true);
  sandbagStack(ctx, rng, 20, 65.5, false);
  sandbagStack(ctx, rng, -20, -65.5, false);
  sandbagStack(ctx, rng, 30, -65.5, false);
  ctx.addMonkeySpawn(67.6, 0, 30); // tucked between the sandbags and the wall

  // Light poles along the strip (thin — no colliders).
  const poles = [[64.5, 50], [48, 64.5], [-64.5, 50], [-48, -64.5], [64.5, -50], [-64.5, -50]];
  for (const [px, pz] of poles) {
    ctx.pushCyl('steelDark', 0.09, 0.13, 5.2, 6, px, 0, pz);
    ctx.pushBox('lightFixture', 0.5, 0.18, 0.5, px, 5.2, pz);
  }
}
