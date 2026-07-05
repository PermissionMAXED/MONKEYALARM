/**
 * UNDERGROUND — stairwells, escape tunnels and the sewer. STUB.
 *
 * The real section replaces this body but MUST keep the frozen contract data:
 * - Stairwells descend through the two shell floor holes (ctx.RESERVED):
 *   H1 x [32, 36], z [-8, -2] and H2 x [-42, -38], z [38, 44], down to the
 *   tunnel floor level y = -3.6 (risers <= 0.45 — use ctx.stairs).
 * - addEscapeExit SEWER at (48, -3.6, -48), radius 2.4, no keycard.
 * - 2 SMOKE escape items.
 *
 * Build rules: use `ctx.makeRng(SEEDS.UNDER)` for any randomness
 * (Math.random is banned). Tunnels must stay sealed below grade (walls from
 * the tunnel floor up to the main-floor slab bottom at y = -1.2) so players
 * cannot slip into the void under the map. The main floor slabs are the
 * tunnel ceiling (2.4 m clearance).
 */

const FLOOR_Y = -3.6;   // tunnel walkable top
const WALL_H = 2.4;     // tunnel floor (-3.6) up to slab bottom (-1.2)

export function buildUnderground(ctx) {
  // Placeholder marker (visual only) so the section reads on the map.
  ctx.pushBox('caution', 0.7, 1.8, 0.7, 34, FLOOR_Y, -20);
  ctx.pushBox('glow', 0.3, 0.3, 0.3, 34, FLOOR_Y + 1.9, -20);

  // Stairwell H1: 8 x 0.45 risers from the tunnel floor up through the hole,
  // topping out flush with the main floor (y = 0) at the hole's south edge.
  ctx.stairs({ x: 34, z: -7.6, dir: '+z', width: 4, steps: 8, rise: 0.45, baseY: FLOOR_Y });
  // Stairwell H2: mirrored — tops out flush at the hole's north edge (z 38).
  ctx.stairs({ x: -40, z: 43.6, dir: '-z', width: 4, steps: 8, rise: 0.45, baseY: FLOOR_Y });

  // --- Corridor A: north from stairwell H1 (x 32..36, z -50..-2) ----------
  ctx.solid('dirt', 4, 1.2, 48, 34, FLOOR_Y - 1.2, -26);          // floor
  ctx.solid('dirt', 0.6, WALL_H, 48, 31.7, FLOOR_Y, -26);         // west wall
  ctx.solid('dirt', 0.6, WALL_H, 44, 36.3, FLOOR_Y, -24);         // east wall (opening z -50..-46)
  ctx.solid('dirt', 5.8, WALL_H, 0.6, 34, FLOOR_Y, -50.3);        // north end wall

  // --- Corridor B: east to the sewer (x 36..52, z -50..-46) ---------------
  ctx.solid('dirt', 16, 1.2, 4, 44, FLOOR_Y - 1.2, -48);          // floor
  ctx.solid('dirt', 16.6, WALL_H, 0.6, 44.3, FLOOR_Y, -50.3);     // north wall
  ctx.solid('dirt', 16.6, WALL_H, 0.6, 44.3, FLOOR_Y, -45.7);     // south wall
  ctx.solid('dirt', 0.6, WALL_H, 5.8, 52.3, FLOOR_Y, -48);        // east end wall

  // --- Stairwell H2 stub chamber (x -42..-38, z 38..50) -------------------
  ctx.solid('dirt', 4, 1.2, 12, -40, FLOOR_Y - 1.2, 44);          // floor
  ctx.solid('dirt', 0.6, WALL_H, 12.6, -42.3, FLOOR_Y, 44.3);     // west wall
  ctx.solid('dirt', 0.6, WALL_H, 12.6, -37.7, FLOOR_Y, 44.3);     // east wall
  ctx.solid('dirt', 5.8, WALL_H, 0.6, -40, FLOOR_Y, 50.3);        // south end wall

  ctx.addEscapeExit({
    id: 'SEWER', name: 'Sewer',
    x: 48, y: FLOOR_Y, z: -48, radius: 2.4, requiresKeycard: false
  });

  ctx.addEscapeItem({ id: 'SMOKE_1', type: 'SMOKE', x: 44, y: FLOOR_Y + 0.6, z: -48 });
  ctx.addEscapeItem({ id: 'SMOKE_2', type: 'SMOKE', x: -40, y: FLOOR_Y + 0.6, z: 47 });
}
