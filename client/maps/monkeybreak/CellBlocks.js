/**
 * CELL BLOCKS — west wing of the prison (two-tier cells, catwalks…). STUB.
 *
 * The real section replaces this body but MUST keep the frozen contract data:
 * - >= 8 monkey spawns around x -43, z -40..8 (FEET y=0 on the main floor).
 *   Spawn call order = spawn index order; keep these coordinates.
 *
 * Build rules: use `ctx.makeRng(SEEDS.CELLS)` for any randomness (Math.random
 * is banned), merge static geometry via ctx.pushBox/solid, consult
 * ctx.RESERVED (SEAM_WEST crosses this section's east edge — keep it walkable).
 */
export function buildCellBlocks(ctx) {
  // Placeholder marker (visual only) so the section reads on the map.
  ctx.pushBox('caution', 0.7, 1.8, 0.7, -43, 0, -44);
  ctx.pushBox('glow', 0.3, 0.3, 0.3, -43, 1.9, -44);

  // Monkey spawns — final coordinates, on the shell's main floor (top y=0).
  ctx.addMonkeySpawn(-47, 0, -38);
  ctx.addMonkeySpawn(-39, 0, -34);
  ctx.addMonkeySpawn(-47, 0, -28);
  ctx.addMonkeySpawn(-39, 0, -22);
  ctx.addMonkeySpawn(-47, 0, -16);
  ctx.addMonkeySpawn(-39, 0, -10);
  ctx.addMonkeySpawn(-47, 0, -2);
  ctx.addMonkeySpawn(-39, 0, 6);
}
