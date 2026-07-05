import * as THREE from 'three';

/**
 * CENTRAL HUB — processing atrium, gatehouse and the main gate. STUB.
 *
 * The real section replaces this body but MUST keep the frozen contract data:
 * - 5 police spawns near (0, 0, -10) (call order = spawn index order).
 * - addEscapeExit MAIN_GATE at (0, 0, -70), radius 2.4, requiresKeycard true.
 * - map.dynamics.mainGate = { open(), close(), isOpen } — a CLOSED gate that
 *   plugs the perimeter gap in the north wall (x -6..6 at z -70.8) together
 *   with the static gatehouse header; its collider parks at y-5000 when open.
 * - addEscapeItem KEYCARD at (8, 0.8, 4).
 *
 * Build rules: use `ctx.makeRng(SEEDS.HUB)` for any randomness (Math.random
 * is banned). The SEAM_GATE reserved rect (hub -> gate corridor) must stay
 * walkable — the main gate is its only sanctioned blocker.
 */

/** Uniformly scales a geometry's UVs (texel density for standalone meshes). */
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}

export function buildCentralHub(ctx) {
  // Placeholder marker (visual only) so the section reads on the map.
  ctx.pushBox('caution', 0.7, 1.8, 0.7, -8, 0, -16);
  ctx.pushBox('glow', 0.3, 0.3, 0.3, -8, 1.9, -16);

  // Police spawns — final coordinates, on the shell's main floor (top y=0).
  ctx.addPoliceSpawn(0, 0, -10);
  ctx.addPoliceSpawn(-2.5, 0, -8);
  ctx.addPoliceSpawn(2.5, 0, -8);
  ctx.addPoliceSpawn(-2.5, 0, -12);
  ctx.addPoliceSpawn(2.5, 0, -12);

  // Gatehouse: static header sealing the wall gap above the gate (y 6.4..16)
  // so the perimeter stays fully sealed in every mode.
  ctx.solid('concrete', 12, 9.6, 2.4, 0, 6.4, -70.8);
  // Caution-striped jamb posts (visual only).
  ctx.pushBox('caution', 0.8, 6.4, 2.5, -5.7, 0, -70.8);
  ctx.pushBox('caution', 0.8, 6.4, 2.5, 5.7, 0, -70.8);

  // Main gate: closed barred slab filling the gap below the header. It must
  // move at runtime, so it is a standalone mesh, not merged geometry.
  const gateGeo = new THREE.BoxGeometry(12, 6.4, 0.6);
  scaleUV(gateGeo, 4, 2);
  const gate = new THREE.Mesh(gateGeo, ctx.mats.bars);
  gate.position.set(0, 3.2, -70.8);
  gate.castShadow = true;
  gate.receiveShadow = true;
  ctx.addMesh(gate);

  const gateCollider = ctx.boxCollider(12, 6.4, 0.6, 0, 0, -70.8);
  const PARK_Y = -5000; // collider (and mesh) park here while the gate is open
  let gateOpen = false;
  ctx.registerDynamic('mainGate', {
    open() {
      if (gateOpen) return;
      gateOpen = true;
      gate.position.y += PARK_Y;
      gateCollider.translate(new THREE.Vector3(0, PARK_Y, 0));
    },
    close() {
      if (!gateOpen) return;
      gateOpen = false;
      gate.position.y -= PARK_Y;
      gateCollider.translate(new THREE.Vector3(0, -PARK_Y, 0));
    },
    get isOpen() {
      return gateOpen;
    }
  });

  ctx.addEscapeExit({
    id: 'MAIN_GATE', name: 'Main Gate',
    x: 0, y: 0, z: -70, radius: 2.4, requiresKeycard: true
  });
  ctx.addEscapeItem({ id: 'KEYCARD', type: 'KEYCARD', x: 8, y: 0.8, z: 4 });
}
