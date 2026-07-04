import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

/**
 * MONKEY BREAK (PRISON) — "You monkeys broke out of prison. Now survive."
 *
 * Layout (144 x 144, sealed by concrete walls at +/-72):
 * - South-west corner: cell block A (two-tier cells, guard catwalk, broken
 *   wall gap to the yard).
 * - South-east corner: cell block B (identical to A, mirrored).
 * - Centre-south: central guard tower with a rotating spotlight.
 * - Centre: yard with gravel floor, basketball hoop, drain grate.
 * - North-west: cafeteria (overturned tables, kitchen with steam pipes).
 * - North-east: workshop / laundry (bent shelves, industrial press, vents).
 * - North wall: armory and warden's office (smashed glass, gun lockers).
 * - The whole map is ringed by 16 m concrete walls topped with barbed wire.
 * - Steam vents hiss, lights flicker, and the searchlight sweeps in update().
 */

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

/** Uniformly scales a geometry's UVs (used before merging for texel density). */
function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
}

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
    this.environment = {
      skyColor: 0x4a4f54,
      fog: { color: 0x4a4f54, near: 25, far: 100 }
    };

    this._dummy = new THREE.Object3D();
    // Geometry buckets merged into one mesh per material.
    this._buckets = {
      concrete: [], concreteDark: [], floor: [], gravel: [],
      bars: [], steel: [], caution: [], pipe: [], dirt: []
    };
    this._steamPuffs = [];
    this._steamMesh = null;
    this._searchLight = null;
    this._searchLightMat = null;
    this._flickerLights = [];
    this._beaconMat = null;
    this._waterMat = null;
  }

  // ------------------------------------------------------------------ build

  build() {
    this._makeMaterials();
    this._buildLights();
    this._buildFloorAndPerimeter();
    this._buildGuardTowers();
    this._buildWardenOffice();
    this._buildBoilerRoom();
    this._buildExerciseYard();
    this._buildFence();
    this._buildTunnels();
    // Sektionen folgen hier — _buildCellBlock(), _buildCafeteria(),
    // _buildWorkshop(), _buildArmory(), _buildGuardTower(), _buildSpawns()
    this._flushBuckets();
  }

  // ------------------------------------------------------- procedural paint

  _canvasTex(size, painter) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    painter(canvas.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _paintConcrete(ctx, size) {
    // Gray concrete with cracks and water stains
    ctx.fillStyle = '#6e7378';
    ctx.fillRect(0, 0, size, size);
    // Aggregate speckle
    for (let i = 0; i < 600; i++) {
      const g = 100 + Math.floor(Math.random() * 40);
      ctx.fillStyle = `rgba(${g - 10},${g},${g + 5},0.35)`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size,
        1 + Math.random() * 3, 1 + Math.random() * 2, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Cracks
    ctx.strokeStyle = 'rgba(40,42,44,0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      let x = Math.random() * size;
      let y = Math.random() * size;
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 50;
        y += (Math.random() - 0.5) * 50;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    // Water stains (dark patches)
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = `rgba(50,55,60,${0.08 + Math.random() * 0.18})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size,
        8 + Math.random() * 30, 4 + Math.random() * 18, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintBars(ctx, size) {
    // Dark metal bars with rivets
    ctx.fillStyle = '#2a2d30';
    ctx.fillRect(0, 0, size, size);
    // Vertical bars
    ctx.fillStyle = '#3d4247';
    const barW = size / 8;
    for (let x = 0; x < size; x += barW * 2) {
      ctx.fillRect(x, 0, barW - 2, size);
    }
    // Rivets
    ctx.fillStyle = '#5a6168';
    for (let i = 0; i < 24; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, 1.5 + Math.random() * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,22,24,0.5)';
    for (let i = 0; i < 12; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, 1 + Math.random() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintDirtyFloor(ctx, size) {
    // Brown-gray floor with scuff marks and shoe prints
    ctx.fillStyle = '#6b6356';
    ctx.fillRect(0, 0, size, size);
    // Scuff marks
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(50,45,38,${0.08 + Math.random() * 0.2})`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size,
        2 + Math.random() * 8, 1 + Math.random() * 4, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Shoe prints (dark sole shapes)
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = `rgba(40,36,30,${0.12 + Math.random() * 0.15})`;
      ctx.save();
      ctx.translate(Math.random() * size, Math.random() * size);
      ctx.rotate(Math.random() * Math.PI);
      ctx.beginPath();
      ctx.ellipse(0, 0, 5 + Math.random() * 3, 2 + Math.random() * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(6 + Math.random() * 3, 0, 3 + Math.random() * 2, 2 + Math.random() * 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Light scuffs
    ctx.fillStyle = 'rgba(100,95,85,0.15)';
    for (let i = 0; i < 60; i++) {
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size,
        4 + Math.random() * 10, 1 + Math.random() * 3, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintGravel(ctx, size) {
    // Speckled gravel with colorful dots
    ctx.fillStyle = '#7a7a6e';
    ctx.fillRect(0, 0, size, size);
    const colors = ['#8a8a7a', '#6e6e62', '#949485', '#5e5e54', '#a09f8e', '#707065'];
    for (let i = 0; i < 800; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size,
        1 + Math.random() * 4, 0.8 + Math.random() * 3, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    // Occasional brighter pebbles
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = `rgba(${160 + Math.floor(Math.random() * 40)},${160 + Math.floor(Math.random() * 30)},${130 + Math.floor(Math.random() * 30)},0.5)`;
      ctx.beginPath();
      ctx.ellipse(Math.random() * size, Math.random() * size,
        1 + Math.random() * 2, 0.8 + Math.random() * 1.5, Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _paintBarbedWire(ctx, size) {
    // Diagonal lines with barbs
    ctx.fillStyle = '#3a3e42';
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = '#5a6168';
    ctx.lineWidth = 2;
    // Diagonal strands
    for (let row = -size; row < size * 2; row += 16) {
      ctx.beginPath();
      ctx.moveTo(0, row);
      ctx.lineTo(size, row + size);
      ctx.stroke();
    }
    for (let row = -size; row < size * 2; row += 16) {
      ctx.beginPath();
      ctx.moveTo(0, row + 8);
      ctx.lineTo(size, row + 8 + size);
      ctx.stroke();
    }
    // Barb hooks
    ctx.fillStyle = '#7a828a';
    for (let i = 0; i < 60; i++) {
      const bx = Math.random() * size;
      const by = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 3 + Math.random() * 4, by + (Math.random() - 0.5) * 4);
      ctx.lineTo(bx + 6 + Math.random() * 3, by + (Math.random() - 0.5) * 3);
      ctx.closePath();
      ctx.fill();
    }
  }

  _paintCaution(ctx, size) {
    // Yellow/black diagonal stripe pattern
    ctx.fillStyle = '#d9a91c';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#1a1c1d';
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI / 4);
    const stripeW = size / 6;
    for (let x = -size; x < size * 2; x += stripeW * 2) {
      ctx.fillRect(x, -size, stripeW, size * 3);
    }
    ctx.restore();
  }

  _makeMaterials() {
    const concreteTex = this._canvasTex(256, (c, s) => this._paintConcrete(c, s));
    const barsTex = this._canvasTex(128, (c, s) => this._paintBars(c, s));
    const dirtyFloorTex = this._canvasTex(256, (c, s) => this._paintDirtyFloor(c, s));
    const gravelTex = this._canvasTex(128, (c, s) => this._paintGravel(c, s));
    const barbedWireTex = this._canvasTex(256, (c, s) => this._paintBarbedWire(c, s));
    const cautionTex = this._canvasTex(128, (c, s) => this._paintCaution(c, s));

    this._mats = {
      concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95, metalness: 0.05 }),
      concreteDark: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.95, metalness: 0.05, color: 0x5a6066 }),
      floor: new THREE.MeshStandardMaterial({ map: dirtyFloorTex, roughness: 0.9, metalness: 0.05 }),
      gravel: new THREE.MeshStandardMaterial({ map: gravelTex, roughness: 1.0, metalness: 0.0 }),
      bars: new THREE.MeshStandardMaterial({ map: barsTex, roughness: 0.6, metalness: 0.5 }),
      steel: new THREE.MeshStandardMaterial({
        color: 0x7a828a, roughness: 0.4, metalness: 0.7
      }),
      steelDark: new THREE.MeshStandardMaterial({
        color: 0x4a525a, roughness: 0.45, metalness: 0.65
      }),
      caution: new THREE.MeshStandardMaterial({ map: cautionTex, roughness: 0.7, metalness: 0.1 }),
      pipe: new THREE.MeshStandardMaterial({
        color: 0x8a929a, roughness: 0.35, metalness: 0.8
      }),
      dirt: new THREE.MeshStandardMaterial({
        color: 0x5a5246, roughness: 1.0, metalness: 0.0
      }),
      barbedWire: new THREE.MeshStandardMaterial({ map: barbedWireTex, roughness: 0.7, metalness: 0.4 }),
      glass: new THREE.MeshStandardMaterial({
        color: 0xbfe4f5, transparent: true, opacity: 0.25,
        roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false
      }),
      glow: new THREE.MeshBasicMaterial({ color: 0xff8c1a }),
      lightFixture: new THREE.MeshStandardMaterial({
        color: 0xf2e8c4, emissive: 0xffe9a0, emissiveIntensity: 0.8,
        roughness: 0.7
      }),
      dirtWall: new THREE.MeshStandardMaterial({
        map: dirtyFloorTex, color: 0x7a7264, roughness: 1.0
      })
    };
    // Beacon material for flickering red lights (updated in update())
    this._beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff2a1a, emissive: 0xff2013, emissiveIntensity: 2, roughness: 0.4
    });
  }

  // ------------------------------------------------------- low-level helpers

  /** Pushes a box geometry into a merge bucket. rotY is visual-only here. */
  _pushBox(bucket, w, h, d, x, y, z, rotY = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    scaleUV(g, clamp(Math.max(w, d) / 3, 0.4, 40), clamp(h / 3, 0.4, 40));
    if (rotY) g.rotateY(rotY);
    g.translate(x, y + h / 2, z);
    this._buckets[bucket].push(g);
  }

  /** Registers an AABB collider; rotY must be a multiple of PI/2 (swaps w/d). */
  _boxCollider(w, h, d, x, y, z, rotY = 0) {
    const quarter = Math.round(rotY / (Math.PI / 2));
    const swap = ((quarter % 2) + 2) % 2 === 1;
    const hw = (swap ? d : w) / 2;
    const hd = (swap ? w : d) / 2;
    this.addCollider(new THREE.Box3(
      new THREE.Vector3(x - hw, y, z - hd),
      new THREE.Vector3(x + hw, y + h, z + hd)
    ));
  }

  /** Prison box: pushed geometry + optional collider in one call. */
  _prisonBox(bucket, w, h, d, x, y, z, rotY = 0, collide = true) {
    this._pushBox(bucket, w, h, d, x, y, z, rotY);
    if (collide) this._boxCollider(w, h, d, x, y, z, rotY);
  }

  _flushBuckets() {
    const matFor = {
      concrete: this._mats.concrete, concreteDark: this._mats.concreteDark,
      floor: this._mats.floor, gravel: this._mats.gravel,
      bars: this._mats.bars, steel: this._mats.steel,
      caution: this._mats.caution, pipe: this._mats.pipe,
      dirt: this._mats.dirt
    };
    for (const key of Object.keys(this._buckets)) {
      const list = this._buckets[key];
      if (!list.length) continue;
      const merged = mergeGeometries(list, false);
      for (const g of list) g.dispose();
      list.length = 0;
      const mesh = new THREE.Mesh(merged, matFor[key]);
      mesh.castShadow = key !== 'gravel' && key !== 'dirt';
      mesh.receiveShadow = true;
      this.group.add(mesh);
    }
  }

  _makeInstanced(geo, mat, matrices, { cast = true, receive = true } = {}) {
    const mesh = new THREE.InstancedMesh(geo, mat, matrices.length);
    for (let i = 0; i < matrices.length; i++) mesh.setMatrixAt(i, matrices[i]);
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    this.group.add(mesh);
    return mesh;
  }

  _matrixAt(x, y, z, rx, ry, rz, sx, sy, sz) {
    const d = this._dummy;
    d.position.set(x, y, z);
    d.rotation.set(rx, ry, rz);
    d.scale.set(sx, sy, sz);
    d.updateMatrix();
    return d.matrix.clone();
  }

  // --------------------------------------------------------------- lighting

  _buildLights() {
    // Dim directional "moon" light — the prison yard is always overcast.
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

    // Red emergency beacons — flicker in update()
    const beaconPositions = [
      [28, 6, 28], [28, 6, -28], [-28, 6, 28], [-28, 6, -28],
      [0, 10, 0], [52, 6, -52]
    ];
    for (const [bx, by, bz] of beaconPositions) {
      const pl = new THREE.PointLight(0xff1a0a, 2, 40, 1.8);
      pl.position.set(bx, by, bz);
      this.group.add(pl);
      this._flickerLights.push(pl);
      // Visual beacon sphere
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), this._beaconMat);
      bulb.position.set(bx, by, bz);
      this.group.add(bulb);
    }
  }

  // --------------------------------------------------------- floor & walls

  _buildFloorAndPerimeter() {
    // Main floor slab — walkable at y=0
    this._prisonBox('concrete', 144, 1.2, 144, 0, -1.2, 0, 0, true);

    // Four perimeter walls, 16 m tall, sunk into the floor
    const wallH = 16;
    this._prisonBox('concrete', 144, wallH, 2.4, 0, 0, -70.8);
    this._prisonBox('concrete', 144, wallH, 2.4, 0, 0, 70.8);
    this._prisonBox('concrete', 2.4, wallH, 144, -70.8, 0, 0);
    this._prisonBox('concrete', 2.4, wallH, 144, 70.8, 0, 0);

    // Barbed wire along the top of each wall (decorative, no collider)
    const bwMatrices = [];
    for (let x = -69; x <= 69; x += 1.8) {
      bwMatrices.push(this._matrixAt(x, wallH + 0.3, -70.8, 0, 0, 0, 1, 0.6, 1));
      bwMatrices.push(this._matrixAt(x, wallH + 0.3, 70.8, 0, 0, 0, 1, 0.6, 1));
    }
    for (let z = -69; z <= 69; z += 1.8) {
      bwMatrices.push(this._matrixAt(-70.8, wallH + 0.3, z, 0, 0, 0, 1, 0.6, 1));
      bwMatrices.push(this._matrixAt(70.8, wallH + 0.3, z, 0, 0, 0, 1, 0.6, 1));
    }
    const bwGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 4);
    this._makeInstanced(bwGeo, this._mats.barbedWire, bwMatrices, { cast: false, receive: false });
  }

  // --------------------------------------------------------- cafeteria

  _buildCafeteria() {
    // Bodenplatte (concrete, 55 x 0.3 x 30, bei z=10)
    this._prisonBox('concrete', 55, 0.3, 30, -32.5, 0, 10);

    // 6 Tische (steel, mit Kollision)
    const tische = [
      [-40, 0, 5], [-30, 0, 5], [-20, 0, 5],
      [-40, 0, 15], [-30, 0, 15], [-20, 0, 15]
    ];
    for (const [x, y, z] of tische) {
      this._prisonBox('steel', 2.5, 0.75, 1.2, x, y, z);
    }

    // 12 Baenke (je 2 pro Tisch, ohne Collider)
    for (const [x, , z] of tische) {
      this._pushBox('steel', 1.5, 0.5, 0.3, x, 0, z - 1.2);
      this._pushBox('steel', 1.5, 0.5, 0.3, x, 0, z + 1.2);
    }

    // Tresen
    this._prisonBox('steel', 8, 1.2, 1.5, -33, 0, -2.5);
  }

  // --------------------------------------------------------- exercise yard

  _buildExerciseYard() {
    // Schotterboden (gravel, 140 x 0.3 x 25)
    this._prisonBox('gravel', 140, 0.3, 25, 0, 0, -17.5);

    // 4 Bank-Reihen aus Stahl
    const baenke = [
      [-50, 0, -10], [-25, 0, -10],
      [25, 0, -10], [50, 0, -10]
    ];
    for (const [x, y, z] of baenke) {
      this._prisonBox('steel', 2, 0.5, 0.4, x, y, z);
    }

    // Basketballkorb
    this._prisonBox('steel', 0.15, 4.5, 0.15, -2, 0, -20);     // Pfosten
    this._prisonBox('concrete', 1.2, 0.08, 0.8, -2, 4.2, -20); // Brett

    // Ring (optional, TorusGeometry)
    const ringGeo = new THREE.TorusGeometry(0.45, 0.05, 8, 16);
    const ring = new THREE.Mesh(ringGeo, this._mats.steel);
    ring.position.set(-2, 4.3, -20);
    ring.rotation.x = Math.PI / 2;
    ring.castShadow = true;
    ring.receiveShadow = true;
    this.group.add(ring);

    this._hoopSway = null;
  }

  // --------------------------------------------------------- fence (z = -5)

  _buildFence() {
    // Stacheldraht-Material transparent schalten
    this._mats.barbedWire.transparent = true;
    this._mats.barbedWire.alphaTest = 0.5;

    const pfostenGeo = new THREE.BoxGeometry(0.1, 4, 0.1);

    // Südzaun (z=-5)
    for (let y = 1; y <= 3; y++) {
      this._prisonBox('barbedWire', 140, 0.08, 0.08, 0, y, -5, 0, false);
    }
    const pfostenSued = [];
    for (let x = -70; x <= 70; x += 8) {
      pfostenSued.push(this._matrixAt(x, 2, -5, 0, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(pfostenGeo, this._mats.steel, pfostenSued);

    // Nordzaun (z=-30)
    for (let y = 1; y <= 3; y++) {
      this._prisonBox('barbedWire', 140, 0.08, 0.08, 0, y, -30, 0, false);
    }
    const pfostenNord = [];
    for (let x = -70; x <= 70; x += 8) {
      pfostenNord.push(this._matrixAt(x, 2, -30, 0, 0, 0, 1, 1, 1));
    }
    this._makeInstanced(pfostenGeo, this._mats.steel, pfostenNord);
  }

  // ------------------------------------------------------------- guard towers

  _buildGuardTowers() {
    const positions = [
      { cx: -65, cz: 55 },
      { cx: 65, cz: 55 }
    ];
    for (const { cx, cz } of positions) {
      // 4 Beine
      this._prisonBox('steel', 0.3, 5.8, 0.3, cx - 0.8, 0, cz - 0.8);
      this._prisonBox('steel', 0.3, 5.8, 0.3, cx + 0.8, 0, cz - 0.8);
      this._prisonBox('steel', 0.3, 5.8, 0.3, cx - 0.8, 0, cz + 0.8);
      this._prisonBox('steel', 0.3, 5.8, 0.3, cx + 0.8, 0, cz + 0.8);
      // Plattform y=6
      this._prisonBox('concrete', 4, 0.3, 4, cx, 6, cz);
      // Gelaender y=5.8 an 4 Seiten
      this._pushBox('steel', 4.2, 0.08, 0.08, cx, 5.8, cz - 2);
      this._pushBox('steel', 4.2, 0.08, 0.08, cx, 5.8, cz + 2);
      this._pushBox('steel', 0.08, 0.08, 4.2, cx - 2, 5.8, cz);
      this._pushBox('steel', 0.08, 0.08, 4.2, cx + 2, 5.8, cz);
    }
    // Scheinwerfer an beiden Türmen
    this._spotlightGroup = new THREE.Group();
    this.group.add(this._spotlightGroup);
    for (const { cx, cz } of positions) {
      const spot = new THREE.SpotLight(0xffffcc, 2.5, 50, Math.PI / 6, 0.5, 1);
      spot.position.set(cx, 6, cz);
      spot.target.position.set(0, 0, -17.5);
      this._spotlightGroup.add(spot);
      this._spotlightGroup.add(spot.target);
    }
  }

  // --------------------------------------------------------- warden's office

  _buildWardenOffice() {
    // Boden
    this._prisonBox('concrete', 25, 0.3, 25, 22.5, 0, 7.5);
    // Waende
    this._prisonBox('concrete', 25, 3.5, 0.5, 22.5, 0, 20);
    this._prisonBox('concrete', 25, 3.5, 0.5, 22.5, 0, -5);
    this._prisonBox('concrete', 0.5, 3.5, 25, 35, 0, 7.5);
    // West-Wand (halb Beton, halb Glas)
    this._prisonBox('concrete', 0.5, 3.5, 12, 10, 0, 10);
    this._prisonBox('glass', 0.5, 3.5, 13, 10, 0, 22);
    // Schreibtisch
    this._prisonBox('steel', 2, 0.8, 1.2, 20, 0, 10);
    // Tresor
    this._prisonBox('steel', 1, 1.5, 1, 28, 0, 5);
    // Obergeschoss (y=3.5)
    this._prisonBox('concrete', 20, 0.3, 20, 22.5, 3.5, 7.5);
  }

  // ------------------------------------------------------------ boiler room

  _buildBoilerRoom() {
    // Boden
    this._prisonBox('concrete', 30, 0.3, 25, 45, 0, 32.5);
    // Waende y=7
    this._prisonBox('concrete', 30, 7, 0.5, 45, 0, 20);
    this._prisonBox('concrete', 30, 7, 0.5, 45, 0, 45);
    this._prisonBox('concrete', 0.5, 7, 25, 30, 0, 32.5);
    this._prisonBox('concrete', 0.5, 7, 25, 60, 0, 32.5);

    // 3 Kessel
    const boilerPositions = [
      { x: 38, z: 28 },
      { x: 45, z: 35 },
      { x: 52, z: 28 }
    ];
    for (const { x, z } of boilerPositions) {
      const kessel = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 5, 12), this._mats.steel);
      kessel.position.set(x, 2.5, z);
      this.group.add(kessel);
      this._boxCollider(3, 5, 3, x, 0, z);
    }

    // Rohre horizontal und vertikal
    this._prisonBox('pipe', 8, 0.4, 0.4, 35, 3, 28, 0, false);
    this._prisonBox('pipe', 8, 0.4, 0.4, 55, 3, 28, 0, false);
    this._prisonBox('pipe', 0.4, 6, 0.4, 38, 3, 30, 0, false);
    this._prisonBox('pipe', 0.4, 6, 0.4, 52, 3, 30, 0, false);
    this._prisonBox('pipe', 6, 0.4, 0.4, 42, 5, 35, 0, false);
    this._prisonBox('pipe', 6, 0.4, 0.4, 48, 5, 35, 0, false);

    // Boiler-Lichter (rotlich)
    this._boilerLights = [];
    const bl1 = new THREE.PointLight(0xff0000, 1, 12);
    bl1.position.set(36, 4, 30);
    this.group.add(bl1);
    this._boilerLights.push(bl1);
    const bl2 = new THREE.PointLight(0xff0000, 1, 12);
    bl2.position.set(54, 4, 35);
    this.group.add(bl2);
    this._boilerLights.push(bl2);

    // Dampf-Partikel um die Kessel
    this._steamPuffs = [];
    if (!this._mats.steamMat) {
      this._mats.steamMat = new THREE.MeshStandardMaterial({
        color: 0xcccccc, transparent: true, opacity: 0.3,
        roughness: 0.2, side: THREE.DoubleSide, depthWrite: false
      });
    }
    const puffGeo = new THREE.SphereGeometry(0.15, 8, 6);
    for (const { x, z } of boilerPositions) {
      for (let i = 0; i < 8; i++) {
        const mesh = new THREE.Mesh(puffGeo, this._mats.steamMat);
        const px = x + (Math.random() - 0.5) * 3;
        const pz = z + (Math.random() - 0.5) * 3;
        const py = 0.5 + Math.random() * 2;
        mesh.position.set(px, py, pz);
        this.group.add(mesh);
        this._steamPuffs.push({
          mesh,
          baseY: py,
          phase: i * 0.8
        });
      }
    }
  }

  // --------------------------------------------------------------- tunnels

  _buildTunnels() {
    // Gang-Korridor (unterirdisch y=-2, z:45..70)
    this._pushBox('dirt', 140, 2.5, 3, 0, -2, 55);
    // Gewundene Seitenarme
    this._pushBox('dirt', 20, 2.5, 3, -50, -2, 55);
    this._pushBox('dirt', 20, 2.5, 3, 50, -2, 55);
    this._pushBox('dirt', 3, 2.5, 15, -35, -2, 62);
    this._pushBox('dirt', 3, 2.5, 15, 35, -2, 62);
  }

  // ---------------------------------------------------------------- update

  update(dt, time) {
    // Flickernde Zellen-Lichter
    if (this._cellLights) {
      for (let i = 0; i < this._cellLights.length; i++) {
        this._cellLights[i].intensity = 1.2 + 0.3 * Math.sin(time * 11 + i * 1.7);
      }
    }
    // Flickernde Kessel-Lichter
    if (this._boilerLights) {
      for (let i = 0; i < this._boilerLights.length; i++) {
        this._boilerLights[i].intensity = 0.8 + 0.5 * Math.sin(time * 8 + i * 2.3);
      }
    }
    // Rotierender Scheinwerfer
    if (this._spotlightGroup) {
      this._spotlightGroup.rotation.y = time * 0.3;
    }
    // Dampf-Animation
    if (this._steamPuffs) {
      for (let i = 0; i < this._steamPuffs.length; i++) {
        const puff = this._steamPuffs[i];
        const cycle = (time * 0.8 + puff.phase) % 4;
        const h = cycle * 0.4;
        puff.mesh.position.y = puff.baseY + h;
        puff.mesh.material.opacity = 0.3 * (1 - cycle / 4);
      }
    }
  }
}
