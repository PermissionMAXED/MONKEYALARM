import * as THREE from 'three';
import { MapBase } from './MapBase.js';
import { createBuildContext, flushBuckets } from './monkeybreak/shared.js';
import { buildCellBlocks } from './monkeybreak/CellBlocks.js';
import { buildCentralHub } from './monkeybreak/CentralHub.js';
import { buildYard } from './monkeybreak/Yard.js';
import { buildPerimeterAndTowers } from './monkeybreak/PerimeterAndTowers.js';
import { buildUnderground } from './monkeybreak/Underground.js';
import { buildProps } from './monkeybreak/props.js';

/**
 * MONKEY BREAK (PRISON) — "The monkeys have broken out of their cells."
 *
 * Modular shell (144 x 144, sealed by 16 m concrete walls at +/-70.8): this
 * file owns only the foundation — lights, the main floor (with the two
 * Underground stairwell holes), the alarm-beacon dynamic and the escape
 * intro — then delegates every themed area to the section builders in
 * `./monkeybreak/` via the frozen `ctx` contract from `./monkeybreak/shared.js`:
 *
 *   1. CellBlocks           — west wing, two-tier cells (monkey spawns)
 *   2. CentralHub           — processing atrium, main gate (police spawns)
 *   3. Yard                 — east exercise yard, wall breach
 *   4. PerimeterAndTowers   — sealed outer wall ring + guard towers
 *   5. Underground          — stairwells, tunnels, sewer exit
 *   6. props                — clutter pass across all sections
 *
 * Section call order is FIXED (spawn index order and props' spawn-avoidance
 * both depend on it). All randomness is seeded (Math.random is banned), all
 * colliders are AABBs, and static geometry merges into one mesh per material.
 */

// Underground stairwell floor holes (also published via ctx.RESERVED).
const HOLE_H1 = { minX: 32, maxX: 36, minZ: -8, maxZ: -2 };
const HOLE_H2 = { minX: -42, maxX: -38, minZ: 38, maxZ: 44 };

export default class MonkeyBreakMap extends MapBase {
  constructor() {
    super();
    this.id = 'MONKEY_BREAK';
    this.name = 'MonkeyBreak (Prison)';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-72, -5, -72),
      new THREE.Vector3(72, 25, 72)
    );
    this.killY = -15;
    // Night prison.
    this.environment = {
      skyColor: 0x232830,
      fog: { color: 0x232830, near: 28, far: 130 }
    };

    this.dynamics = {};
    this._updaters = [];
    this.escape = {
      exits: [],
      items: [],
      intro: {
        duration: 9.5,
        keys: [
          { t: 0.0, pos: [0, 44, 40], look: [0, 6, -10] },
          { t: 2.6, pos: [-42, 6, -40], look: [-42, 2, -24] },
          { t: 5.0, pos: [0, 10, -10], look: [0, 4, -40] },
          { t: 7.4, pos: [0, 3, -56], look: [0, 2, -70] },
          { t: 9.4, pos: [0, 1.7, -10], look: [0, 1.7, -20] }
        ],
        subs: [
          { t: 0.4, text: 'MONKEYBREAK PENITENTIARY — 2:14 AM' },
          { t: 3.0, text: 'Every cell… empty.' },
          { t: 6.2, text: "They're heading for the exits." },
          { t: 8.2, text: 'Stop them, Warden. 🚨' }
        ]
      }
    };
  }

  // ------------------------------------------------------------------ build

  build() {
    const ctx = createBuildContext(this); // materials + frozen build kit
    this._buildFoundation(ctx);
    // Section order is FIXED — do not reorder (spawn indices depend on it).
    buildCellBlocks(ctx);
    buildCentralHub(ctx);
    buildYard(ctx);
    buildPerimeterAndTowers(ctx);
    buildUnderground(ctx);
    buildProps(ctx);
    flushBuckets(ctx); // one merged mesh per material
    this._validateSpawns();
  }

  // ------------------------------------------------------------- foundation

  _buildFoundation(ctx) {
    // Dim directional "moon" light — the single shadow caster on this map.
    const sun = new THREE.DirectionalLight(0xaab0b8, 1.2);
    sun.position.set(-48, 85, -34);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 220;
    sun.shadow.bias = -0.0006;
    this.group.add(sun);
    this.group.add(sun.target);
    sun.target.position.set(0, 0, 0);

    const hemi = new THREE.HemisphereLight(0x6a7078, 0x2a2e32, 0.6);
    this.group.add(hemi);

    this._buildMainFloor(ctx);
    this._buildAlarm(ctx);
  }

  /**
   * Main floor: 1.2 m-thick slabs whose walkable top is y = 0, tiling the
   * full 144 x 144 in z-rows EXCEPT the two stairwell holes H1/H2 that the
   * Underground section descends through.
   */
  _buildMainFloor(ctx) {
    const X0 = -72, X1 = 72;
    const row = (z0, z1, hole) => {
      const d = z1 - z0;
      const zc = (z0 + z1) / 2;
      if (!hole) {
        ctx.solid('concrete', X1 - X0, 1.2, d, (X0 + X1) / 2, -1.2, zc);
        return;
      }
      // Split the row around the hole's x extent.
      ctx.solid('concrete', hole.minX - X0, 1.2, d, (X0 + hole.minX) / 2, -1.2, zc);
      ctx.solid('concrete', X1 - hole.maxX, 1.2, d, (hole.maxX + X1) / 2, -1.2, zc);
    };
    row(-72, HOLE_H1.minZ);                    // z -72..-8
    row(HOLE_H1.minZ, HOLE_H1.maxZ, HOLE_H1);  // z  -8..-2 (around H1)
    row(HOLE_H1.maxZ, HOLE_H2.minZ);           // z  -2..38
    row(HOLE_H2.minZ, HOLE_H2.maxZ, HOLE_H2);  // z  38..44 (around H2)
    row(HOLE_H2.maxZ, 72);                     // z  44..72
  }

  /**
   * Alarm system: 6 red beacon PointLights + emissive bulb spheres. Exposed
   * as map.dynamics.alarm = { setActive(b) }; while active the beacons
   * pulse and rotate ~3x faster.
   */
  _buildAlarm(ctx) {
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff2a1a, emissive: 0xff2013, emissiveIntensity: 2, roughness: 0.4
    });
    const beaconPositions = [
      [28, 6, 28], [28, 6, -28], [-28, 6, 28], [-28, 6, -28],
      [0, 10, 0], [52, 6, -52]
    ];
    const lights = [];
    const bulbs = [];
    const bulbGeo = new THREE.SphereGeometry(0.18, 10, 8);
    for (const [bx, by, bz] of beaconPositions) {
      const pl = new THREE.PointLight(0xff1a0a, 2, 40, 1.8);
      pl.position.set(bx, by, bz);
      this.group.add(pl);
      lights.push(pl);
      const bulb = new THREE.Mesh(bulbGeo, beaconMat);
      bulb.position.set(bx, by, bz);
      this.group.add(bulb);
      bulbs.push(bulb);
    }

    const state = { active: false, phase: 0 };
    ctx.registerDynamic('alarm', {
      setActive(b) {
        state.active = !!b;
      }
    });
    ctx.registerUpdater((dt, _time) => {
      // Phase accumulator so toggling speed never pops the animation.
      state.phase += dt * (state.active ? 3 : 1);
      const p = state.phase;
      beaconMat.emissiveIntensity = 1.5 + 1.1 * Math.sin(p * 6);
      for (let i = 0; i < lights.length; i++) {
        lights[i].intensity = 1.6 + 1.0 * Math.sin(p * 6 + i * 1.3);
        bulbs[i].rotation.y = p * 2.4 + i;
      }
    });
  }

  // ----------------------------------------------------------------- spawns

  /** Dev safety net: warn if any spawn overlaps a collider. */
  _validateSpawns() {
    const all = [...this.policeSpawns, ...this.monkeySpawns];
    const box = new THREE.Box3();
    for (const s of all) {
      box.min.set(s.x - 0.34, s.y + 0.06, s.z - 0.34);
      box.max.set(s.x + 0.34, s.y + 1.76, s.z + 0.34);
      for (const c of this.colliders) {
        if (box.intersectsBox(c)) {
          console.warn('[MonkeyBreak] spawn intersects collider', s, c);
          break;
        }
      }
    }
  }

  // ----------------------------------------------------------------- update

  update(dt, time) {
    for (const fn of this._updaters) fn(dt, time);
  }
}
