import * as THREE from 'three';
import { SEEDS } from './shared.js';

/**
 * UNDERGROUND — access stairwells, sewer tunnel network and the SEWER escape
 * exit chamber. Everything lives below the main floor slab (y < -1.2) except
 * the two stairwells that rise through the shell's floor holes to y = 0:
 *   H1 x [32, 36] z [-8, -2]   and   H2 x [-42, -38] z [38, 44].
 *
 * Layout (all inner spaces, floor top y = -3.6, ceilings at y = -1.4):
 *   H1 shaft -> trunk south (x 32..36, z -32..-2) -> junction room
 *   (x 28..40, z -44..-32, valve wheels) -> south + east dog-leg -> exit
 *   chamber (x 42..54, z -54..-42) with the sealed outfall grille.
 *   From the junction a long branch runs west (z -40..-36) then north
 *   (x -42..-38) all the way to the H2 shaft. Two dead-end stubs hold the
 *   SMOKE canisters; a wall alcove on the north branch is a hiding nook.
 * Every space is wrapped in floor + wall + ceiling colliders so players can
 * never slip into the void below the map.
 */

const FLOOR_Y = -3.6;  // tunnel walkable top
const WALL_H = 2.4;    // walls run floor (-3.6) to slab bottom (-1.2)
const CEIL_Y = -1.4;   // ceiling slab bottom (2.2 m clearance), tops at -1.2

export function buildUnderground(ctx) {
  const rng = ctx.makeRng(SEEDS.UNDER);

  // Shorthands: floor slab (0.5 thick), wall (full height), ceiling (0.2).
  const F = (w, d, x, z) => ctx.solid('concreteDark', w, 0.5, d, x, FLOOR_Y - 0.5, z);
  const W = (w, d, x, z) => ctx.solid('brick', w, WALL_H, d, x, FLOOR_Y, z);
  const C = (w, d, x, z) => ctx.solid('concreteDark', w, 0.2, d, x, CEIL_Y, z);

  // ---------------------------------------------------- 1) access stairwells
  // 9 x 0.40 risers climb 3.6 m from the tunnel floor to y = 0, filling each
  // shell hole; run 0.66 keeps the whole flight inside the hole footprint so
  // there is open headroom above every step.
  ctx.stairs({ x: 34, z: -7.94, dir: '+z', width: 4, steps: 9, rise: 0.4, run: 0.66, baseY: FLOOR_Y });
  ctx.stairs({ x: -40, z: 38.06, dir: '+z', width: 4, steps: 9, rise: 0.4, run: 0.66, baseY: FLOOR_Y });

  // Grate rims framing each hole at grade (visual only, 6 cm trim).
  for (const [hx, hz] of [[34, -5], [-40, 41]]) {
    ctx.pushBox('bars', 5.0, 0.06, 0.4, hx, 0, hz - 3.2);
    ctx.pushBox('bars', 5.0, 0.06, 0.4, hx, 0, hz + 3.2);
    ctx.pushBox('bars', 0.4, 0.06, 6.8, hx - 2.2, 0, hz);
    ctx.pushBox('bars', 0.4, 0.06, 6.8, hx + 2.2, 0, hz);
  }

  // ------------------------------------------------------- 2) tunnel network
  // Trunk T1: H1 shaft south to the junction (inner x 32..36, z -32..-2).
  F(4.8, 30.8, 34, -17);
  W(0.4, 30, 31.8, -17);                 // west wall
  W(0.4, 18, 36.2, -11);                 // east wall (leaves stub gap z -24..-20)
  W(0.4, 8, 36.2, -28);
  C(4, 24, 34, -20);                     // ceiling stops at the shaft (z -8)

  // Dead-end stub B2 east off the trunk (inner x 36..42, z -24..-20).
  F(6.4, 4.8, 39.2, -22);
  W(6.4, 0.4, 39.2, -19.8);
  W(6.4, 0.4, 39.2, -24.2);
  W(0.4, 4.8, 42.2, -22);                // end wall
  C(6, 4, 39, -22);

  // Junction room (inner x 28..40, z -44..-32) — openings north (trunk),
  // south (to the sewer) and west (long branch to H2).
  F(12.8, 12.8, 34, -38);
  W(4.4, 0.4, 29.8, -31.8);              // north wall pieces
  W(4.4, 0.4, 38.2, -31.8);
  W(4.4, 0.4, 29.8, -44.2);              // south wall pieces
  W(4.4, 0.4, 38.2, -44.2);
  W(0.4, 4.4, 27.8, -33.8);              // west wall pieces (gap z -40..-36)
  W(0.4, 4.4, 27.8, -42.2);
  W(0.4, 12.8, 40.2, -38);               // east wall (valve manifold wall)
  C(12, 12, 34, -38);

  // Dog-leg to the sewer: south leg (x 32..36, z -50..-44) …
  F(4.8, 6.4, 34, -47.2);
  W(0.4, 6.4, 31.8, -47.2);
  W(0.4, 2, 36.2, -45);                  // east wall above the corner opening
  W(4.8, 0.4, 34, -50.2);
  C(4, 6, 34, -47);
  // … then east leg (x 36..42, z -50..-46) into the chamber.
  F(6, 4.8, 39, -48);
  W(6, 0.4, 39, -45.8);
  W(6, 0.4, 39, -50.2);
  C(6, 4, 39, -48);

  // Long branch west from the junction (inner x -42..28, z -40..-36).
  F(70.4, 4.8, -7.2, -38);
  W(66, 0.4, -5, -35.8);                 // north wall (gap x -42..-38 for turn)
  W(22.4, 0.4, -31.2, -40.2);            // south wall pieces (stub gap x -20..-16)
  W(44, 0.4, 6, -40.2);
  W(0.4, 4.8, -42.2, -38);               // west end wall at the corner
  C(70, 4, -7, -38);

  // Dead-end stub B3 south (inner x -20..-16, z -46..-40).
  F(4.8, 6.4, -18, -43.2);
  W(0.4, 6.4, -20.2, -43.2);
  W(0.4, 6.4, -15.8, -43.2);
  W(4.8, 0.4, -18, -46.2);               // end wall
  C(4, 6, -18, -43);

  // Branch north to H2 (inner x -42..-38, z -36..44; shaft is z 38..44).
  F(4.8, 80.4, -40, 4.2);
  W(0.4, 80.4, -42.2, 4.2);              // west wall
  W(0.4, 34, -37.8, -19);                // east wall pieces (alcove gap z -2..2)
  W(0.4, 42.4, -37.8, 23.2);
  W(4.8, 0.4, -40, 44.2);                // seals below grade past the stair top
  C(4, 74, -40, 1);                      // ceiling stops at the shaft (z 38)

  // Alcove nook off the north branch (inner x -38..-36.6, z -2..2).
  F(1.8, 5.2, -37.1, 0);
  W(0.4, 4.8, -36.4, 0);                 // back wall
  W(1.8, 0.4, -37.1, -2.2);
  W(1.8, 0.4, -37.1, 2.2);
  C(1.8, 4.8, -37.1, 0);

  // ---------------------------------------------------- 3) sewer exit chamber
  // Vault (inner x 42..54, z -54..-42); the trunk enters on the west wall.
  F(12.8, 12.8, 48, -48);
  W(0.4, 4.4, 41.8, -43.8);              // west wall pieces (gap z -50..-46)
  W(0.4, 4.4, 41.8, -52.2);
  W(12.8, 0.4, 48, -41.8);
  W(12.8, 0.4, 48, -54.2);
  W(0.4, 4.4, 54.2, -43.8);              // east wall pieces flank the outfall
  W(0.4, 4.4, 54.2, -52.2);
  ctx.solid('brick', 0.4, 0.4, 4, 54.2, -1.6, -48);  // header over the mouth
  C(12, 12, 48, -48);
  ctx.solid('concrete', 1.2, WALL_H, 1.2, 51.4, FLOOR_Y, -52.2); // outfall pillar

  // Outfall pipe mouth: bent grille (SOLID — the exit stays sealed) with a
  // black unlit throat behind it so the pipe reads as endless dark.
  ctx.solid('bars', 0.3, 2.0, 4.2, 54.35, FLOOR_Y, -48);
  ctx.pushBox('bars', 0.1, 1.7, 1.8, 54.25, FLOOR_Y, -47.2, 0.45); // bent-out panel
  const voidMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const throat = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.2, 4.6), voidMat);
  throat.position.set(55.9, -2.5, -48);
  ctx.addMesh(throat);

  // Green outfall light marks the escape point.
  const exitLight = new THREE.PointLight(0x2fe86e, 1.1, 12, 1.6);
  exitLight.position.set(52.4, -2.0, -48);
  ctx.addMesh(exitLight);

  ctx.addEscapeExit({
    id: 'SEWER', name: 'Sewer Tunnel',
    x: 48, y: FLOOR_Y, z: -48, radius: 2.4, requiresKeycard: false
  });

  // ----------------------------------------------- pipes, valves and fixtures
  // Ceiling pipe runs (visual boxes just under the ceilings)…
  ctx.pushBox('pipe', 0.24, 0.24, 24, 35.4, -1.72, -20);     // trunk (stops at shaft)
  ctx.pushBox('pipe', 69, 0.24, 0.24, -7.5, -1.72, -36.9);   // west branch
  ctx.pushBox('pipe', 0.24, 0.24, 74, -41.1, -1.72, 1);      // north branch
  ctx.pushBox('pipe', 12, 0.24, 0.24, 34, -1.72, -34);       // junction cross
  ctx.pushBox('pipe', 11.5, 0.24, 0.24, 48, -1.72, -43);     // chamber
  // …with vertical risers tying them to the floor.
  ctx.pushCyl('pipe', 0.14, 0.14, 2.2, 8, 28.7, FLOOR_Y, -43.3);
  ctx.pushCyl('pipe', 0.14, 0.14, 2.2, 8, 39.4, FLOOR_Y, -32.7);
  ctx.pushCyl('pipe', 0.14, 0.14, 2.2, 8, 42.8, FLOOR_Y, -53.2);
  ctx.pushCyl('pipe', 0.14, 0.14, 2.2, 8, -30, FLOOR_Y, -39.6);

  // Valve manifold on the junction's east wall: three rusty stub pipes with
  // horizontal hand-wheels, plus a big rim ring seating the outfall mouth.
  const wheelGeo = new THREE.TorusGeometry(0.32, 0.06, 8, 14);
  const wheelMatrices = [];
  for (const vz of [-35, -38, -41]) {
    ctx.pushCyl('rust', 0.09, 0.09, 1.2, 8, 39.5, FLOOR_Y, vz);
    wheelMatrices.push(ctx.matrixAt(39.5, -2.36, vz, Math.PI / 2, 0, 0, 1, 1, 1));
  }
  wheelMatrices.push(ctx.matrixAt(54.1, -2.6, -48, 0, Math.PI / 2, 0, 3.1, 3.1, 3.1));
  ctx.makeInstanced(wheelGeo, ctx.mats.rust, wheelMatrices);

  // --------------------------------------------------------- 4) water + light
  // Shallow water channel: a drifting canvas texture painted with the section
  // rng, laid as two thin strips down the trunk and the west branch.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g2d = canvas.getContext('2d');
  g2d.fillStyle = '#1e3c34';
  g2d.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {                     // murky drift streaks
    g2d.strokeStyle = `rgba(${70 + Math.floor(rng() * 50)},${120 + Math.floor(rng() * 40)},${105 + Math.floor(rng() * 35)},${0.14 + rng() * 0.2})`;
    g2d.lineWidth = 1 + rng() * 2;
    const y0 = rng() * 128;
    g2d.beginPath();
    g2d.moveTo(0, y0);
    g2d.bezierCurveTo(32, y0 + (rng() - 0.5) * 24, 96, y0 + (rng() - 0.5) * 24, 128, y0);
    g2d.stroke();
  }
  for (let i = 0; i < 30; i++) {                     // scum flecks
    g2d.fillStyle = `rgba(150,160,120,${0.08 + rng() * 0.12})`;
    g2d.beginPath();
    g2d.arc(rng() * 128, rng() * 128, 0.6 + rng() * 1.6, 0, Math.PI * 2);
    g2d.fill();
  }
  const waterTex = new THREE.CanvasTexture(canvas);
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(1, 10);
  const waterMat = new THREE.MeshStandardMaterial({
    map: waterTex, transparent: true, opacity: 0.85, roughness: 0.25, metalness: 0.1
  });
  const water1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 22), waterMat);
  water1.position.set(34, -3.565, -20);
  water1.receiveShadow = true;
  ctx.addMesh(water1);
  const water2 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.05, 69), waterMat);
  water2.position.set(-7.5, -3.565, -38);
  water2.rotation.y = Math.PI / 2;
  water2.receiveShadow = true;
  ctx.addMesh(water2);

  // Three dim flickering service lights (the exit light stays steady).
  const flicker = [];
  const lightDefs = [
    [34, -1.8, -38, 0.9, 16],   // junction
    [34, -1.8, -16, 0.7, 13],   // trunk
    [-40, -1.8, 2, 0.7, 14]     // north branch, by the alcove
  ];
  for (let i = 0; i < lightDefs.length; i++) {
    const [lx, ly, lz, base, dist] = lightDefs[i];
    const light = new THREE.PointLight(0xffb066, base, dist, 1.5);
    light.position.set(lx, ly, lz);
    ctx.addMesh(light);
    flicker.push({ light, base, phase: rng() * Math.PI * 2 });
  }

  // Drip spheres: a handful of falling droplets recycled in the updater.
  const dripSpots = [[34, -24], [34, -10], [-20, -38], [-40, 20], [-40, -10], [48, -46]];
  const drips = dripSpots.map(([dx, dz]) => ({
    x: dx + (rng() - 0.5) * 1.4,
    z: dz + (rng() - 0.5) * 1.4,
    speed: 0.45 + rng() * 0.5,
    phase: rng()
  }));
  const dripMesh = ctx.makeInstanced(
    new THREE.SphereGeometry(0.05, 6, 5), ctx.mats.glass,
    drips.map((d) => ctx.matrixAt(d.x, -1.5, d.z, 0, 0, 0, 1, 1, 1)),
    { cast: false, receive: false }
  );

  // ONE updater: water drift + light flicker + drip cycling.
  ctx.registerUpdater((_dt, time) => {
    waterTex.offset.y = (time * 0.05) % 1;
    for (const f of flicker) {
      const buzz = 0.82 + 0.18 * Math.sin(time * 13 + f.phase) * Math.sin(time * 7.7 + f.phase * 2);
      const dropout = Math.sin(time * 0.9 + f.phase * 3) > 0.985 ? 0.2 : 1;
      f.light.intensity = f.base * buzz * dropout;
    }
    for (let i = 0; i < drips.length; i++) {
      const d = drips[i];
      const t = (time * d.speed + d.phase) % 1;
      dripMesh.setMatrixAt(i, ctx.matrixAt(d.x, -1.5 - 2.05 * t, d.z, 0, 0, 0, 1, 1, 1));
    }
    dripMesh.instanceMatrix.needsUpdate = true;
  });

  // ------------------------------------------------------- 5) spawns + items
  ctx.addMonkeySpawn(30, FLOOR_Y, -42);        // junction room
  ctx.addMonkeySpawn(39.5, FLOOR_Y, -21);      // stub B2 alcove
  ctx.addMonkeySpawn(53, FLOOR_Y, -53.1);      // behind the outfall pillar
  ctx.addMonkeySpawn(-40, -1.6, 41.03);        // H2 stairwell mid-landing
  ctx.addMonkeySpawn(-18, FLOOR_Y, -45);       // stub B3 dead end

  ctx.addEscapeItem({ id: 'smoke-1', type: 'SMOKE', x: 41.5, y: FLOOR_Y + 0.6, z: -23 });
  ctx.addEscapeItem({ id: 'smoke-2', type: 'SMOKE', x: -18, y: FLOOR_Y + 0.6, z: -45.4 });
}
