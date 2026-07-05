/**
 * YARD — exercise yard on the east side (gravel, hoop, bleachers…). STUB.
 *
 * The real section replaces this body but MUST keep the frozen contract data:
 * - addEscapeExit WALL_BREACH at (60.5, 0, 6), radius 2.4, no keycard.
 *   (The breach sits just inside the east perimeter wall at x 70.8 — the
 *   perimeter itself stays sealed; the exit is a trigger, not a hole.)
 * - 4 monkey spawns (call order = spawn index order; keep these coordinates).
 * - 3 BANANA escape items.
 *
 * Build rules: use `ctx.makeRng(SEEDS.YARD)` for any randomness (Math.random
 * is banned). The SEAM_EAST reserved rect (hub -> breach corridor) crosses
 * this section — keep it walkable.
 */
export function buildYard(ctx) {
  // Placeholder marker (visual only) so the section reads on the map.
  ctx.pushBox('caution', 0.7, 1.8, 0.7, 40, 0, 30);
  ctx.pushBox('glow', 0.3, 0.3, 0.3, 40, 1.9, 30);

  // Monkey spawns — final coordinates, on the shell's main floor (top y=0).
  ctx.addMonkeySpawn(30, 0, 22);
  ctx.addMonkeySpawn(52, 0, 34);
  ctx.addMonkeySpawn(24, 0, 46);
  ctx.addMonkeySpawn(56, 0, 14);

  ctx.addEscapeExit({
    id: 'WALL_BREACH', name: 'Wall Breach',
    x: 60.5, y: 0, z: 6, radius: 2.4, requiresKeycard: false
  });

  ctx.addEscapeItem({ id: 'BANANA_1', type: 'BANANA', x: 34, y: 0.6, z: 18 });
  ctx.addEscapeItem({ id: 'BANANA_2', type: 'BANANA', x: 48, y: 0.6, z: 42 });
  ctx.addEscapeItem({ id: 'BANANA_3', type: 'BANANA', x: 60, y: 0.6, z: 26 });
}
