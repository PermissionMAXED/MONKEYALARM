import * as THREE from 'three';
import { MapBase } from './MapBase.js';

// Treetop Village: a canopy hamlet of platforms, rope bridges and huts built
// around five giant trees. Falls are survivable (no fall damage), so dropping
// from any platform to the forest floor is always a safe escape route.
export default class TreetopVillageMap extends MapBase {
  constructor() {
    super();
    this.id = 'TREETOP_VILLAGE';
    this.name = 'Treetop Village';
    this.environment = {
      skyColor: 0xffd9a0,
      fog: { color: 0xffcf99, near: 25, far: 150 }
    };
    this.killY = -12;
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-65, -12, -65),
      new THREE.Vector3(65, 45, 65)
    );
    this._lanterns = null;
    this._lanternPts = [];
    this._leaves = null;
    this._leafVel = null;
    this._m4 = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
  }

  build() {
    // Shared materials.
    this._matFloor = new THREE.MeshStandardMaterial({ color: 0x4c7a3d });
    this._matWall = new THREE.MeshStandardMaterial({ color: 0x3a5c30 });
    this._matTrunk = new THREE.MeshStandardMaterial({ color: 0x6b4a2b });
    this._matWood = new THREE.MeshStandardMaterial({ color: 0x9a6b3f });
    this._matPlank = new THREE.MeshStandardMaterial({ color: 0xb07d4a });
    this._matRoof = new THREE.MeshStandardMaterial({ color: 0xa5533a });
    this._matLeaf = new THREE.MeshStandardMaterial({ color: 0x5f8f3e });
    this._matRail = new THREE.MeshStandardMaterial({ color: 0x7a5a35 });

    this._buildLights();
    this._buildGround();
    this._buildTrees();
    this._buildPlatformsAndPaths();
    this._buildHuts();
    this._buildDecor();
    this._buildSpawns();
  }

  _buildLights() {
    const sun = new THREE.DirectionalLight(0xffe0b0, 1.1);
    sun.position.set(40, 60, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.camera.near = 5;
    sun.shadow.camera.far = 160;
    this.group.add(sun);
    this.group.add(sun.target);
    const hemi = new THREE.HemisphereLight(0xffe8c0, 0x3d5a2e, 0.55);
    this.group.add(hemi);
  }

  _buildGround() {
    // 120x120 forest floor, top surface at y = 0.
    this.addSolidBox({
      width: 120, height: 1, depth: 120, x: 0, y: -1, z: 0,
      material: this._matFloor, castShadow: false
    });
    // Sealed perimeter: 4 tall walls so players cannot leave.
    const wall = { height: 10, material: this._matWall, castShadow: false };
    this.addSolidBox({ ...wall, width: 124, depth: 2, x: 0, y: 0, z: 61 });
    this.addSolidBox({ ...wall, width: 124, depth: 2, x: 0, y: 0, z: -61 });
    this.addSolidBox({ ...wall, width: 2, depth: 124, x: 61, y: 0, z: 0 });
    this.addSolidBox({ ...wall, width: 2, depth: 124, x: -61, y: 0, z: 0 });
  }

  _addTree(x, z, trunkH, trunkR) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(trunkR * 0.85, trunkR, trunkH, 10),
      this._matTrunk
    );
    trunk.position.set(x, trunkH / 2, z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.group.add(trunk);
    this.addColliderFromMesh(trunk); // collider on trunk only
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(trunkR * 3.2, 12, 10), this._matLeaf);
    canopy.position.set(x, trunkH + trunkR * 1.2, z);
    canopy.castShadow = true;
    this.group.add(canopy);
    const canopy2 = new THREE.Mesh(new THREE.SphereGeometry(trunkR * 2.2, 10, 8), this._matLeaf);
    canopy2.position.set(x + trunkR * 1.6, trunkH - 1.5, z - trunkR * 1.2);
    canopy2.castShadow = true;
    this.group.add(canopy2);
  }

  _buildTrees() {
    // Central tree (tallest, hosts the crow's nest) + four outer trees.
    this._addTree(0, 0, 15, 2.2);
    this._addTree(-30, 0, 14, 2);
    this._addTree(30, 0, 14, 2);
    this._addTree(0, -30, 14, 2);
    this._addTree(0, 30, 14, 2);
  }

  // Straight run of stepped boxes (riser 0.4m, auto-steppable) from ground.
  _stairs(fromX, fromZ, toX, toZ, steps) {
    for (let i = 1; i <= steps; i++) {
      const t = (i - 1) / Math.max(steps - 1, 1);
      this.addSolidBox({
        width: 1.7, height: 0.4, depth: 1.7,
        x: fromX + (toX - fromX) * t,
        y: 0.4 * i - 0.4,
        z: fromZ + (toZ - fromZ) * t,
        material: this._matWood
      });
    }
  }

  // Axis-aligned rope bridge: a row of thin plank boxes (each with a collider,
  // touching end-to-end) that rise gently (each riser well under 0.45m).
  _bridge(x0, z0, y0, x1, z1, y1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const dist = Math.abs(dx) + Math.abs(dz); // axis-aligned spans only
    const n = Math.max(6, Math.round(dist / 1.2));
    const alongX = Math.abs(dx) > Math.abs(dz);
    for (let i = 0; i < n; i++) {
      const tMid = (i + 0.5) / n;
      const top = y0 + (y1 - y0) * ((i + 1) / n);
      this.addSolidBox({
        width: alongX ? dist / n + 0.1 : 1.4,
        height: 0.2,
        depth: alongX ? 1.4 : dist / n + 0.1,
        x: x0 + dx * tMid,
        y: top - 0.2,
        z: z0 + dz * tMid,
        material: this._matPlank
      });
    }
    // Side rails: thin cylinders, no colliders.
    const off = 0.8;
    const ox = alongX ? 0 : off;
    const oz = alongX ? off : 0;
    this._rail(x0 + ox, y0 + 1, z0 + oz, x1 + ox, y1 + 1, z1 + oz);
    this._rail(x0 - ox, y0 + 1, z0 - oz, x1 - ox, y1 + 1, z1 - oz);
  }

  _rail(x0, y0, z0, x1, y1, z1) {
    const a = new THREE.Vector3(x0, y0, z0);
    const b = new THREE.Vector3(x1, y1, z1);
    const len = a.distanceTo(b);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 6), this._matRail);
    rail.position.copy(a).add(b).multiplyScalar(0.5);
    this._v.copy(b).sub(a).normalize();
    this._q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._v);
    rail.quaternion.copy(this._q);
    this.group.add(rail); // collider: none (decorative)
  }

  _platform(cx, cz, topY, size) {
    this.addSolidBox({
      width: size, height: 0.4, depth: size,
      x: cx, y: topY - 0.4, z: cz,
      material: this._matWood
    });
  }

  _buildPlatformsAndPaths() {
    // Outer platforms hug their trunks; the hub ring wraps the central trunk.
    this._platform(-25, 0, 3.5, 6);  // P1 (west tree)
    this._platform(25, 0, 3.5, 6);   // P2 (east tree)
    this._platform(0, -25, 5, 6);    // P3 (south tree)
    this._platform(0, 25, 5, 6);     // P4 (north tree)
    this._platform(0, 0, 6.5, 8);    // P5 hub around central trunk

    // Ground staircases up to each outer platform (riser 0.4, last step ≤0.3
    // below the platform top so it auto-steps).
    this._stairs(-25, 12, -25, 4.4, 8);   // to P1 (top 3.2 -> 3.5)
    this._stairs(25, 12, 25, 4.4, 8);     // to P2
    this._stairs(16, -25, 4.4, -25, 12);  // to P3 (top 4.8 -> 5.0)
    this._stairs(-16, 25, -4.4, 25, 12);  // to P4

    // Rope bridges converging on the hub (gentle stepped rise ≤0.2/plank).
    this._bridge(-22, 0, 3.5, -4, 0, 6.5); // P1 -> P5
    this._bridge(22, 0, 3.5, 4, 0, 6.5);   // P2 -> P5
    this._bridge(0, -22, 5, 0, -4, 6.5);   // P3 -> P5
    this._bridge(0, 22, 5, 0, 4, 6.5);     // P4 -> P5

    // Crow's nest: railed platform atop the central tree, reached by a
    // spiral of stepped boxes climbing around the trunk from the hub.
    const nestTop = 9.7;
    const steps = 8; // 6.5 + 8 * 0.4 = 9.7
    for (let i = 1; i <= steps; i++) {
      const ang = -Math.PI / 2 + (i - 1) * (Math.PI * 1.5 / (steps - 1));
      this.addSolidBox({
        width: 1.6, height: 0.4, depth: 1.3,
        x: Math.cos(ang) * 3.3,
        y: 6.5 + 0.4 * i - 0.4,
        z: Math.sin(ang) * 3.3,
        material: this._matWood,
        rotationY: -ang
      });
    }
    this._platform(0, 0, nestTop, 6);
    // Nest rails (decorative, no colliders).
    for (const [rx, rz, w, d] of [[0, 3, 6, 0.15], [0, -3, 6, 0.15], [3, 0, 0.15, 6], [-3, 0, 0.15, 6]]) {
      this.addSolidBox({
        width: w, height: 0.9, depth: d, x: rx, y: nestTop, z: rz,
        material: this._matRail, collider: false, castShadow: false
      });
    }
  }

  // Hut: 4 short walls with a door gap on +Z, pyramid roof; colliders on walls.
  _hut(x, z, y, w, h) {
    const t = 0.25;
    const m = this._matWood;
    this.addSolidBox({ width: w, height: h, depth: t, x, y, z: z - w / 2, material: m }); // back
    this.addSolidBox({ width: t, height: h, depth: w, x: x - w / 2, y, z, material: m }); // left
    this.addSolidBox({ width: t, height: h, depth: w, x: x + w / 2, y, z, material: m }); // right
    const seg = (w - 1.2) / 2; // front segments leave a 1.2m door gap
    this.addSolidBox({ width: seg, height: h, depth: t, x: x - (1.2 + seg) / 2, y, z: z + w / 2, material: m });
    this.addSolidBox({ width: seg, height: h, depth: t, x: x + (1.2 + seg) / 2, y, z: z + w / 2, material: m });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.85, 1.5, 4), this._matRoof);
    roof.position.set(x, y + h + 0.75, z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    this.group.add(roof); // no collider (decorative cap)
  }

  _buildHuts() {
    this._hut(-15, 18, 0, 4.5, 2.2); // ranger station (police spawn area)
    this._hut(20, -18, 0, 4, 2.2);
    this._hut(-20, -15, 0, 4, 2.2);
    this._hut(0, 26, 5, 3, 1.9);     // hut on platform P4
  }

  _buildDecor() {
    // Hanging lanterns (instanced, animated sway in update()).
    const lanternGeo = new THREE.SphereGeometry(0.18, 8, 6);
    const lanternMat = new THREE.MeshStandardMaterial({
      color: 0xffc766, emissive: 0xff9a2e, emissiveIntensity: 1.4
    });
    const plats = [[-25, 0, 3.5], [25, 0, 3.5], [0, -25, 5], [0, 25, 5], [0, 0, 6.5]];
    for (const [px, pz, py] of plats) {
      this._lanternPts.push({ x: px + 2.6, y: py + 2.1, z: pz + 2.6, phase: px + pz });
      this._lanternPts.push({ x: px - 2.6, y: py + 2.1, z: pz - 2.6, phase: px - pz });
      this._lanternPts.push({ x: px + 2.6, y: py + 2.1, z: pz - 2.6, phase: pz - px });
    }
    for (const [hx, hz] of [[-15, 18], [20, -18], [-20, -15]]) {
      this._lanternPts.push({ x: hx, y: 2.8, z: hz + 2.6, phase: hx });
    }
    this._lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, this._lanternPts.length);
    for (let i = 0; i < this._lanternPts.length; i++) {
      const p = this._lanternPts[i];
      this._m4.makeTranslation(p.x, p.y, p.z);
      this._lanterns.setMatrixAt(i, this._m4);
    }
    this.group.add(this._lanterns);

    // Ferns / bushes on the floor (instanced, no colliders) - hiding thickets.
    const fernGeo = new THREE.ConeGeometry(0.7, 1.1, 6);
    const ferns = new THREE.InstancedMesh(fernGeo, this._matLeaf, 80);
    for (let i = 0; i < 80; i++) {
      const ang = (i / 80) * Math.PI * 2 * 7.3;
      const r = 8 + (i % 12) * 4 + Math.sin(i * 3.7) * 2;
      this._m4.makeRotationY(i * 1.3);
      this._m4.setPosition(Math.cos(ang) * r, 0.55, Math.sin(ang) * r);
      ferns.setMatrixAt(i, this._m4);
    }
    ferns.castShadow = true;
    this.group.add(ferns);

    // Background trees near the perimeter (instanced trunks + canopies).
    const bgTrunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.65, 9, 7), this._matTrunk, 18);
    const bgCanopies = new THREE.InstancedMesh(
      new THREE.SphereGeometry(2.6, 8, 7), this._matLeaf, 18);
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 + Math.sin(i * 5.1) * 0.15;
      const r = 48 + (i % 3) * 4;
      const bx = Math.cos(ang) * r;
      const bz = Math.sin(ang) * r;
      this._m4.makeTranslation(bx, 4.5, bz);
      bgTrunks.setMatrixAt(i, this._m4);
      this._m4.makeTranslation(bx, 9.5, bz);
      bgCanopies.setMatrixAt(i, this._m4);
    }
    bgTrunks.castShadow = true;
    bgCanopies.castShadow = true;
    this.group.add(bgTrunks);
    this.group.add(bgCanopies);

    // Falling leaves (points that drift down and respawn at canopy height).
    const count = 130;
    const pos = new Float32Array(count * 3);
    this._leafVel = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.sin(i * 12.9898) * 0.5 + 0.5) * 90 - 45;
      pos[i * 3 + 1] = 2 + (i % 11);
      pos[i * 3 + 2] = (Math.sin(i * 78.233) * 0.5 + 0.5) * 90 - 45;
      this._leafVel[i] = 0.5 + (i % 7) * 0.12;
    }
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this._leaves = new THREE.Points(leafGeo, new THREE.PointsMaterial({
      color: 0xd7a24a, size: 0.25, sizeAttenuation: true
    }));
    this.group.add(this._leaves);
  }

  _buildSpawns() {
    // Police spawn at the ground-level ranger station (all on floor, y = 0,
    // outside hut walls).
    this.policeSpawns = [
      new THREE.Vector3(-15, 0, 23),
      new THREE.Vector3(-10, 0, 18),
      new THREE.Vector3(-20, 0, 20),
      new THREE.Vector3(-15, 0, 13.5),
      new THREE.Vector3(-10, 0, 22),
    ];
    // Monkey spawns: platform tops (y = platform top) + floor thickets.
    this.monkeySpawns = [
      new THREE.Vector3(-25, 3.5, -1.8),  // P1 top
      new THREE.Vector3(25, 3.5, 1.8),    // P2 top
      new THREE.Vector3(1.8, 5, -25),     // P3 top
      new THREE.Vector3(-2.2, 5, 23),     // P4 top (clear of hut)
      new THREE.Vector3(3.2, 6.5, 0),     // P5 hub rim (clear of trunk AABB)
      new THREE.Vector3(0, 9.7, 2.5),     // crow's nest rim
      new THREE.Vector3(32, 0, 32),       // floor thickets
      new THREE.Vector3(-32, 0, -32),
      new THREE.Vector3(12, 0, -42),
      new THREE.Vector3(-42, 0, 12),
      new THREE.Vector3(42, 0, -12),
    ];
  }

  update(dt, time) {
    // Sway the lanterns.
    if (this._lanterns) {
      for (let i = 0; i < this._lanternPts.length; i++) {
        const p = this._lanternPts[i];
        const s = Math.sin(time * 1.6 + p.phase);
        this._m4.makeRotationZ(s * 0.12);
        this._m4.setPosition(p.x + s * 0.12, p.y + Math.cos(time * 1.6 + p.phase) * 0.05, p.z);
        this._lanterns.setMatrixAt(i, this._m4);
      }
      this._lanterns.instanceMatrix.needsUpdate = true;
    }
    // Drift the falling leaves downward, respawning at canopy height.
    if (this._leaves) {
      const attr = this._leaves.geometry.getAttribute('position');
      const arr = attr.array;
      for (let i = 0; i < this._leafVel.length; i++) {
        arr[i * 3 + 1] -= this._leafVel[i] * dt;
        arr[i * 3] += Math.sin(time * 0.8 + i) * dt * 0.4;
        if (arr[i * 3 + 1] < 0.1) arr[i * 3 + 1] = 12 + (i % 5);
      }
      attr.needsUpdate = true;
    }
  }
}
