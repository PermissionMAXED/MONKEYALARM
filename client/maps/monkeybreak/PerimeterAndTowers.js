import * as THREE from 'three';

/**
 * PERIMETER & TOWERS — the sealed outer wall ring and guard towers. STUB.
 *
 * The real section replaces this body but MUST keep the frozen contract data:
 * - Perimeter walls at +/-70.8: 16 m tall, 2.4 thick, barbed wire on top,
 *   WITH a gap in the north wall (z -70.8) at x in [-6, 6]. That gap is
 *   plugged by the CentralHub gatehouse header + closed main gate, so the
 *   perimeter stays fully sealed in every mode — never widen or move it.
 * - 2 COFFEE escape items.
 *
 * Build rules: use `ctx.makeRng(SEEDS.PERIM)` for any randomness
 * (Math.random is banned). Keep the barbed wire as a single InstancedMesh.
 */

const WALL_H = 16;

export function buildPerimeterAndTowers(ctx) {
  // Placeholder marker (visual only) so the section reads on the map.
  ctx.pushBox('caution', 0.7, 1.8, 0.7, 0, 0, 64);
  ctx.pushBox('glow', 0.3, 0.3, 0.3, 0, 1.9, 64);

  // North wall (z -70.8) in two segments, leaving the x [-6, 6] gate gap.
  ctx.solid('concrete', 66, WALL_H, 2.4, -39, 0, -70.8);
  ctx.solid('concrete', 66, WALL_H, 2.4, 39, 0, -70.8);
  // South, west and east walls — unbroken.
  ctx.solid('concrete', 144, WALL_H, 2.4, 0, 0, 70.8);
  ctx.solid('concrete', 2.4, WALL_H, 144, -70.8, 0, 0);
  ctx.solid('concrete', 2.4, WALL_H, 144, 70.8, 0, 0);

  // Barbed wire along the top of each wall (decorative, no collider). The
  // run over the gate gap sits on the gatehouse header, which tops out at
  // the same y = 16 as the walls.
  const bwMatrices = [];
  for (let x = -69; x <= 69; x += 1.8) {
    bwMatrices.push(ctx.matrixAt(x, WALL_H + 0.3, -70.8, 0, 0, 0, 1, 0.6, 1));
    bwMatrices.push(ctx.matrixAt(x, WALL_H + 0.3, 70.8, 0, 0, 0, 1, 0.6, 1));
  }
  for (let z = -69; z <= 69; z += 1.8) {
    bwMatrices.push(ctx.matrixAt(-70.8, WALL_H + 0.3, z, 0, 0, 0, 1, 0.6, 1));
    bwMatrices.push(ctx.matrixAt(70.8, WALL_H + 0.3, z, 0, 0, 0, 1, 0.6, 1));
  }
  const bwGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 4);
  ctx.makeInstanced(bwGeo, ctx.mats.barbedWire, bwMatrices, { cast: false, receive: false });

  ctx.addEscapeItem({ id: 'COFFEE_1', type: 'COFFEE', x: 66, y: 0.6, z: -62 });
  ctx.addEscapeItem({ id: 'COFFEE_2', type: 'COFFEE', x: -66, y: 0.6, z: 64 });
}
