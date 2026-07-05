import { SEEDS } from './shared.js';

/**
 * PROPS — scatter clutter across every section (crates, lockers, litter…).
 * STUB: a few supply crates for hiding cover.
 *
 * Build rules: use `ctx.makeRng(SEEDS.PROPS)` for any randomness
 * (Math.random is banned). Props must avoid ctx.RESERVED rects and keep
 * >= 2.2 m clearance from every spawn registered by the earlier sections
 * (props builds LAST, so map.policeSpawns / map.monkeySpawns are complete).
 * Prefer instancing/merged buckets — draw-call budget for the map is ~250.
 */
export function buildProps(ctx) {
  // Placeholder marker (visual only) so the section reads on the map.
  ctx.pushBox('caution', 0.7, 1.8, 0.7, -14, 0, 34);
  ctx.pushBox('glow', 0.3, 0.3, 0.3, -14, 1.9, 34);

  const rng = ctx.makeRng(SEEDS.PROPS);
  // A few crates, clear of reserved rects and section spawn points.
  const crates = [
    [14, 0, -30], [16.1, 0, -28.6], [-20, 0, 24],
    [10, 0, 40], [58, 0, -20]
  ];
  let stackBase = null;
  for (const [x, y, z] of crates) {
    const s = 0.8 + rng() * 0.35;
    ctx.solid('rust', s, s, s, x, y, z, 0);
    stackBase = { x, z, top: y + s, s };
  }
  // One smaller crate stacked on the last one (jump-up hiding spot).
  const top = 0.55 + rng() * 0.15;
  ctx.solid('rust', top, top, top, stackBase.x + 0.1, stackBase.top, stackBase.z - 0.1, 0);
}
