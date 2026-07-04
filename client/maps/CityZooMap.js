import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

// ---------------------------------------------------------------------------
// City Zoo — "The zoo the monkeys just escaped from."
//
// 130 x 130 walled park, bright late afternoon.
//   south      : grand entrance gate, ticket booths, turnstiles (police spawn)
//   center     : observation tower landmark (deck y=4 via stairs, tall mast)
//   center-west: BROKEN monkey enclosure (bent bars, climbing frame, red
//                MONKEY ALARM beacon flickering outside the hole)
//   center-east: lion pit with stepped viewing terraces + lion statue
//   north-west : penguin pool (animated water) | north-east: aviary dome
//   north      : reptile house (enterable, terrariums inside)
//   south-east : food court (kiosks, umbrellas, tables) + ZOO EXPRESS train
//   west wall  : service alley (dumpsters, crate stacks)
// Animated: penguin water, spinning welcome sign, beacon pulse, tower pod.
// ---------------------------------------------------------------------------

// ------------------------------ canvas helpers ------------------------------

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function canvasTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function speckle(ctx, w, h, count, colors, maxR = 2) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = colors[(Math.random() * colors.length) | 0];
    const r = 0.5 + Math.random() * maxR;
    ctx.globalAlpha = 0.1 + Math.random() * 0.25;
    ctx.fillRect(Math.random() * w, Math.random() * h, r, r);
  }
  ctx.globalAlpha = 1;
}

function grassTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#5f9c45';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 1400, ['#4e8a38', '#6fae52', '#578f3e', '#7cba5e'], 2.5);
  ctx.strokeStyle = 'rgba(60,110,40,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4);
    ctx.stroke();
  }
  return canvasTexture(canvas, 26, 26);
}

function pavingTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#b8b0a2';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 600, ['#a89f90', '#c4bcaf', '#9c948a'], 2);
  ctx.strokeStyle = 'rgba(90,85,75,0.6)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 2; i++) {
    ctx.beginPath(); ctx.moveTo(0, i * 128); ctx.lineTo(256, i * 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(i * 128, 0); ctx.lineTo(i * 128, 256); ctx.stroke();
  }
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(64, 0); ctx.lineTo(64, 128); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(192, 128); ctx.lineTo(192, 256); ctx.stroke();
  return canvasTexture(canvas, 1, 1);
}

function brickTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#8d5a41';
  ctx.fillRect(0, 0, 256, 256);
  const bh = 32;
  const bw = 64;
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col < 5; col++) {
      const off = row % 2 ? bw / 2 : 0;
      ctx.fillStyle = ['#96604a', '#855239', '#9c6a4e', '#7e4e37'][(Math.random() * 4) | 0];
      ctx.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  ctx.strokeStyle = '#c9b8a6';
  ctx.lineWidth = 3;
  for (let row = 0; row <= 8; row++) {
    ctx.beginPath(); ctx.moveTo(0, row * bh); ctx.lineTo(256, row * bh); ctx.stroke();
  }
  return canvasTexture(canvas, 6, 1);
}

function sandTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#cbb27f';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, 700, ['#bda06c', '#d8c091', '#b09363'], 1.6);
  return canvasTexture(canvas, 6, 6);
}

function plankTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = ['#8a6238', '#7d5730', '#966c3e', '#84603a'][i % 4];
    ctx.fillRect(0, i * 32, 128, 32);
    ctx.strokeStyle = 'rgba(50,32,14,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, i * 32, 128, 32);
  }
  ctx.strokeStyle = 'rgba(60,40,18,0.4)';
  for (let i = 0; i < 20; i++) {
    const y = Math.random() * 128;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y + (Math.random() - 0.5) * 6); ctx.stroke();
  }
  return canvasTexture(canvas, 2, 2);
}

function crateTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#a97e46';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, 250, ['#96702c', '#b98d52'], 2);
  ctx.strokeStyle = '#6f4d22';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 120, 120);
  ctx.beginPath(); ctx.moveTo(4, 4); ctx.lineTo(124, 124); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(124, 4); ctx.lineTo(4, 124); ctx.stroke();
  ctx.fillStyle = '#3e2a10';
  ctx.font = 'bold 26px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ZOO', 64, 72);
  return canvasTexture(canvas, 1, 1);
}

function awningTexture(colorA, colorB) {
  const { canvas, ctx } = makeCanvas(128, 64);
  for (let x = 0; x < 128; x += 16) {
    ctx.fillStyle = (x / 16) % 2 ? colorA : colorB;
    ctx.fillRect(x, 0, 16, 64);
  }
  return canvasTexture(canvas, 2, 1);
}

function waterTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#2f7fb8';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    ctx.strokeStyle = `rgba(190,230,250,${0.15 + Math.random() * 0.3})`;
    ctx.lineWidth = 1.5 + Math.random() * 2;
    const y = Math.random() * 128;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 128; x += 16) {
      ctx.quadraticCurveTo(x + 8, y + (Math.random() - 0.5) * 10, x + 16, y);
    }
    ctx.stroke();
  }
  return canvasTexture(canvas, 3, 3);
}

function hedgeTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#2f6b2a';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    ctx.fillStyle = ['#255c21', '#3a7d33', '#478f3e', '#1e4d1b'][(Math.random() * 4) | 0];
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(Math.random() * 128, Math.random() * 128, 2 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return canvasTexture(canvas, 2, 1);
}

function zooMapTexture() {
  const { canvas, ctx } = makeCanvas(256, 192);
  ctx.fillStyle = '#f2e9d4';
  ctx.fillRect(0, 0, 256, 192);
  ctx.strokeStyle = '#14532d';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 248, 184);
  const blobs = [
    ['#7cba5e', 40, 60, 26], ['#e6b34c', 110, 50, 22], ['#6fb7d9', 190, 60, 24],
    ['#c78b5a', 60, 130, 24], ['#9b86c9', 150, 130, 28], ['#d97c7c', 210, 140, 18]
  ];
  for (const [c, x, y, r] of blobs) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#b8b0a2';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(20, 170); ctx.quadraticCurveTo(128, 100, 236, 170);
  ctx.stroke();
  ctx.fillStyle = '#14532d';
  ctx.font = 'bold 24px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('ZOO MAP', 128, 30);
  return canvasTexture(canvas, 1, 1);
}

function textSignTexture(text, { bg = '#14532d', fg = '#ffffff', border = '#f5d76e', sub = '' } = {}) {
  const { canvas, ctx } = makeCanvas(512, 192);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = border;
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 496, 176);
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 64px Arial';
  const w = ctx.measureText(text).width;
  if (w > 450) ctx.font = `bold ${Math.floor((64 * 450) / w)}px Arial`;
  ctx.fillText(text, 256, sub ? 74 : 96);
  if (sub) {
    ctx.font = 'italic 30px Arial';
    ctx.fillText(sub, 256, 142);
  }
  return canvasTexture(canvas, 1, 1);
}

// --------------------------------- the map ----------------------------------

export default class CityZooMap extends MapBase {
  constructor() {
    super();
    this.id = 'CITY_ZOO';
    this.name = 'City Zoo';
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-66, -2, -66),
      new THREE.Vector3(66, 42, 66)
    );
    this.killY = -12;
    this.environment = {
      skyColor: 0x87ceeb,
      fog: { color: 0xa9d7ea, near: 70, far: 200 }
    };
  }

  build() {
    this._buildMaterials();
    this._buildLights();
    this._buildGroundAndPerimeter();
    this._buildPaths();
    this._buildEntrance();
    this._buildTower();
    this._buildMonkeyEnclosure();
    this._buildLionPit();
    this._buildAviary();
    this._buildPenguinPool();
    this._buildReptileHouse();
    this._buildFoodCourt();
    this._buildRestrooms();
    this._buildServiceAlley();
    this._buildTrain();
    this._buildGreenery();
    this._buildSpawns();
  }

  update(_dt, time) {
    // 1) rotating welcome sign at the gate
    if (this._spinSign) this._spinSign.rotation.y = time * 0.6;
    // 2) penguin-pool water: drifting texture + gentle bob
    if (this._waterTex) {
      this._waterTex.offset.set(time * 0.02, time * 0.014);
      this._water.position.y = 0.36 + Math.sin(time * 1.5) * 0.03;
    }
    // 3) flickering red MONKEY ALARM beacon near the broken cage
    if (this._beaconLight) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 6.5);
      const jitter = 0.15 * Math.sin(time * 29.0) + 0.1 * Math.sin(time * 47.0);
      const level = Math.max(0.05, pulse + jitter);
      this._beaconLight.intensity = 1.0 + 9.0 * level;
      this._beaconMat.emissiveIntensity = 0.4 + 2.6 * level;
    }
    // 4) slowly rotating observation pod on the landmark tower
    if (this._pod) this._pod.rotation.y = time * 0.25;
  }

  // ----------------------------- shared helpers -----------------------------

  _buildMaterials() {
    const std = (opts) => new THREE.MeshStandardMaterial(opts);
    this._m = {
      grass: std({ map: grassTexture(), roughness: 1 }),
      paving: std({ map: pavingTexture(), roughness: 0.95 }),
      brick: std({ map: brickTexture(), roughness: 0.9 }),
      sand: std({ map: sandTexture(), roughness: 1 }),
      plank: std({ map: plankTexture(), roughness: 0.9 }),
      crate: std({ map: crateTexture(), roughness: 0.9 }),
      concrete: std({ color: 0x9aA0a3, roughness: 0.95 }),
      concreteDark: std({ color: 0x7c8285, roughness: 0.95 }),
      steel: std({ color: 0x5a6570, roughness: 0.45, metalness: 0.7 }),
      steelDark: std({ color: 0x3c444c, roughness: 0.5, metalness: 0.6 }),
      cream: std({ color: 0xe9e2cf, roughness: 0.9 }),
      roofRed: std({ color: 0xa8433a, roughness: 0.85 }),
      roofTeal: std({ color: 0x2f7f78, roughness: 0.85 }),
      hedge: std({ map: hedgeTexture(), roughness: 1 }),
      trunk: std({ color: 0x6b4a2c, roughness: 1 }),
      leaf: std({ color: 0x3d7a33, roughness: 1 }),
      leafLight: std({ color: 0x55943f, roughness: 1 }),
      rock: std({ color: 0x8f8578, roughness: 1 }),
      ice: std({ color: 0xe8f4fa, roughness: 0.35 }),
      glass: std({ color: 0xbfe4f5, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.35 }),
      lion: std({ color: 0xc79a55, roughness: 0.95 }),
      mane: std({ color: 0x8a5a22, roughness: 1 }),
      penguinBlack: std({ color: 0x1d232b, roughness: 0.8 }),
      penguinWhite: std({ color: 0xf2f5f7, roughness: 0.7 }),
      beak: std({ color: 0xe8912a, roughness: 0.7 }),
      dumpster: std({ color: 0x3e6b3a, roughness: 0.8, metalness: 0.2 }),
      trainRed: std({ color: 0xb03a30, roughness: 0.6, metalness: 0.2 }),
      trainYellow: std({ color: 0xe0b73c, roughness: 0.6 }),
      awningRed: std({ map: awningTexture('#c94436', '#f2ede0'), roughness: 0.9, side: THREE.DoubleSide }),
      awningTeal: std({ map: awningTexture('#2f7f78', '#f2ede0'), roughness: 0.9, side: THREE.DoubleSide }),
      lampGlow: std({ color: 0xfff3c0, emissive: 0xffe9a0, emissiveIntensity: 0.9 }),
      water: std({
        map: waterTexture(), color: 0x9fd4ee, roughness: 0.15, metalness: 0.1,
        transparent: true, opacity: 0.85
      })
    };
    this._waterTex = this._m.water.map;
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6f8f5a, 0.7);
    this.group.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d5, 1.5);
    sun.position.set(48, 70, 32);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -90;
    sun.shadow.camera.right = 90;
    sun.shadow.camera.top = 90;
    sun.shadow.camera.bottom = -90;
    sun.shadow.camera.near = 10;
    sun.shadow.camera.far = 200;
    sun.shadow.bias = -0.0004;
    this.group.add(sun);
    this.group.add(sun.target);
  }

  /** InstancedMesh from transform items: {x,y,z, rx?,ry?,rz?, s?|sx?,sy?,sz?, color?}. */
  _instanced(geometry, material, items, { castShadow = true, receiveShadow = true } = {}) {
    const mesh = new THREE.InstancedMesh(geometry, material, items.length);
    const mat4 = new THREE.Matrix4();
    const quat = new THREE.Quaternion();
    const eul = new THREE.Euler();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    items.forEach((it, i) => {
      eul.set(it.rx || 0, it.ry || 0, it.rz || 0);
      quat.setFromEuler(eul);
      const s = it.s ?? 1;
      scl.set(it.sx ?? s, it.sy ?? s, it.sz ?? s);
      pos.set(it.x, it.y, it.z);
      mat4.compose(pos, quat, scl);
      mesh.setMatrixAt(i, mat4);
      if (it.color !== undefined) mesh.setColorAt(i, new THREE.Color(it.color));
    });
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.group.add(mesh);
    return mesh;
  }

  _mergedMesh(geometries, material, { castShadow = true, receiveShadow = true } = {}) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    this.group.add(mesh);
    return mesh;
  }

  _boxCollider(cx, y0, cz, w, h, d) {
    this.addCollider(new THREE.Box3(
      new THREE.Vector3(cx - w / 2, y0, cz - d / 2),
      new THREE.Vector3(cx + w / 2, y0 + h, cz + d / 2)
    ));
  }

  /** Solid chunky staircase; each step is a box from the ground (risers 0.4). */
  _stairs({ x, z, width, steps, dirX = 0, dirZ = 0, stepH = 0.4, stepD = 0.7, material }) {
    for (let i = 0; i < steps; i++) {
      const cx = x + dirX * stepD * i;
      const cz = z + dirZ * stepD * i;
      const alongX = dirX !== 0;
      this.addSolidBox({
        width: alongX ? stepD : width,
        height: stepH * (i + 1),
        depth: alongX ? width : stepD,
        x: cx, y: 0, z: cz,
        material: material || this._m.concrete
      });
    }
  }

  /** Free-standing text sign: two posts + double-sided board. Decor (no collider). */
  _addSign(text, { x, z, ry = 0, y = 2.2, w = 3, h = 1.1, posts = true, bg, fg, border, sub } = {}) {
    const g = new THREE.Group();
    const boardMat = new THREE.MeshBasicMaterial({
      map: textSignTexture(text, { bg, fg, border, sub }),
      side: THREE.DoubleSide
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), boardMat);
    board.position.y = y;
    g.add(board);
    if (posts) {
      const postGeos = [];
      for (const sx of [-1, 1]) {
        const p = new THREE.CylinderGeometry(0.06, 0.06, y + h / 2, 8);
        p.translate(sx * (w / 2 - 0.2), (y + h / 2) / 2, -0.03);
        postGeos.push(p);
      }
      const postsMesh = new THREE.Mesh(mergeGeometries(postGeos), this._m.steelDark);
      postsMesh.castShadow = true;
      g.add(postsMesh);
    }
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    this.group.add(g);
    return g;
  }

  // ------------------------------- ground/walls ------------------------------

  _buildGroundAndPerimeter() {
    // grass ground slab, top at y=0
    this.addSolidBox({
      width: 132, height: 0.5, depth: 132, x: 0, y: -0.5, z: 0,
      material: this._m.grass, castShadow: false
    });

    // sealed brick perimeter (inner faces at +/-64)
    const wallH = 4;
    const t = 1;
    this.addSolidBox({ width: 130 + 2 * t, height: wallH, depth: t, x: 0, y: 0, z: -64.5, material: this._m.brick });
    this.addSolidBox({ width: 130 + 2 * t, height: wallH, depth: t, x: 0, y: 0, z: 64.5, material: this._m.brick });
    this.addSolidBox({ width: t, height: wallH, depth: 130, x: -64.5, y: 0, z: 0, material: this._m.brick });
    this.addSolidBox({ width: t, height: wallH, depth: 130, x: 64.5, y: 0, z: 0, material: this._m.brick });

    // decorative wall pillars (instanced, inside the wall line, no colliders)
    const pillars = [];
    for (let v = -60; v <= 60; v += 12) {
      pillars.push({ x: v, y: 2.3, z: -64.5 });
      pillars.push({ x: v, y: 2.3, z: 64.5 });
      pillars.push({ x: -64.5, y: 2.3, z: v });
      pillars.push({ x: 64.5, y: 2.3, z: v });
    }
    this._instanced(new THREE.BoxGeometry(1.5, 4.6, 1.5), this._m.concreteDark, pillars);
  }

  _buildPaths() {
    // flush paved paths, no colliders; tiny y offsets avoid z-fighting overlaps
    const rects = [
      [-3, -56, 3, 63],        // main north-south promenade
      [-58, 11, 58, 17],       // east-west crossway
      [-44, -43, 44, -37],     // north loop (penguin - reptile - aviary)
      [-14, 44, 14, 63],       // entrance plaza
      [22, 22, 44, 44],        // food court pad
      [-26, -1, -20, 17],      // spur to broken monkey house
      [26, -6, 30.8, 17],      // spur to lion pit
      [-39, 17, -33, 41.5],    // spur to restrooms
      [-63, 8, -52, 34],       // service alley pad
      [50, 17, 58, 22],        // train station pad
      [-8, -45, 8, -37]        // reptile house forecourt
    ];
    const geos = rects.map(([x1, z1, x2, z2], i) => {
      const w = x2 - x1;
      const d = z2 - z1;
      const g = new THREE.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * w) / 3, (uv.getY(k) * d) / 3);
      g.translate(x1 + w / 2, 0.045 + i * 0.004, z1 + d / 2);
      return g;
    });
    this._mergedMesh(geos, this._m.paving, { castShadow: false });
  }

  // --------------------------------- entrance --------------------------------

  _buildEntrance() {
    // gatehouse towers flanking the (sealed) south gate + arch beam
    for (const sx of [-1, 1]) {
      this.addSolidBox({
        width: 3, height: 6, depth: 3, x: sx * 8, y: 0, z: 63.2,
        material: this._m.brick
      });
      // little pyramid roofs
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.3, 1.4, 4), this._m.roofRed);
      roof.position.set(sx * 8, 6.7, 63.2);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.group.add(roof);
    }
    this.addSolidBox({
      width: 13, height: 1.6, depth: 1.2, x: 0, y: 4.4, z: 63.2,
      material: this._m.cream
    });
    const gateSign = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 1.4),
      new THREE.MeshBasicMaterial({
        map: textSignTexture('CITY ZOO', { bg: '#14532d', sub: 'EST. 1928' }),
        side: THREE.DoubleSide
      })
    );
    gateSign.position.set(0, 5.2, 62.55);
    gateSign.rotation.y = Math.PI;
    this.group.add(gateSign);

    // ticket booths
    for (const sx of [-1, 1]) {
      const bx = sx * 7;
      this.addSolidBox({ width: 2.2, height: 2.3, depth: 2.2, x: bx, y: 0, z: 56, material: this._m.cream });
      this.addSolidBox({
        width: 2.6, height: 0.2, depth: 2.6, x: bx, y: 2.4, z: 56,
        material: this._m.roofTeal, collider: false
      });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), this._m.glass);
      win.position.set(bx, 1.5, 56 - 1.12);
      win.rotation.y = Math.PI;
      this.group.add(win);
      const tag = new THREE.Mesh(
        new THREE.PlaneGeometry(1.9, 0.55),
        new THREE.MeshBasicMaterial({
          map: textSignTexture('TICKETS', { bg: '#a8433a' }),
          side: THREE.DoubleSide
        })
      );
      tag.position.set(bx, 2.05, 56 - 1.14);
      tag.rotation.y = Math.PI;
      this.group.add(tag);
    }

    // turnstile row at z=50 with walk-through gaps + side rails
    for (const sx of [-1, 1]) {
      this.addSolidBox({
        width: 4.5, height: 1.1, depth: 0.25, x: sx * 9.75, y: 0, z: 50,
        material: this._m.steel
      });
    }
    const postItems = [];
    const armGeos = [];
    for (const px of [-6, -3, 0, 3, 6]) {
      postItems.push({ x: px, y: 0.55, z: 50 });
      for (let a = 0; a < 3; a++) {
        const arm = new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6);
        arm.rotateZ(Math.PI / 2);
        arm.rotateY((a * Math.PI * 2) / 3);
        arm.translate(px, 0.95, 50);
        armGeos.push(arm);
      }
      this._boxCollider(px, 0, 50, 0.4, 1.1, 0.4);
    }
    this._instanced(new THREE.BoxGeometry(0.35, 1.1, 0.35), this._m.steelDark, postItems);
    this._mergedMesh(armGeos, this._m.steel);

    // slowly rotating welcome sign on a pole (animated in update)
    const polePos = new THREE.Vector3(-11, 0, 52);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.2, 10), this._m.steelDark);
    pole.position.set(polePos.x, 2.1, polePos.z);
    pole.castShadow = true;
    this.group.add(pole);
    this._boxCollider(polePos.x, 0, polePos.z, 0.4, 4.2, 0.4);
    this._spinSign = new THREE.Mesh(
      new THREE.PlaneGeometry(2.6, 1.2),
      new THREE.MeshBasicMaterial({
        map: textSignTexture('WELCOME!', { bg: '#e6b34c', fg: '#14532d', border: '#14532d', sub: 'please do not feed the monkeys' }),
        side: THREE.DoubleSide
      })
    );
    this._spinSign.position.set(polePos.x, 3.4, polePos.z);
    this.group.add(this._spinSign);

    // zoo map board
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 1.8),
      new THREE.MeshBasicMaterial({ map: zooMapTexture(), side: THREE.DoubleSide })
    );
    board.position.set(11, 1.7, 47);
    board.rotation.y = -0.5;
    this.group.add(board);
    const legGeos = [];
    for (const sx of [-1, 1]) {
      const leg = new THREE.BoxGeometry(0.12, 1.8, 0.12);
      leg.translate(sx * 1.0, 0.9, 0);
      legGeos.push(leg);
    }
    const legs = this._mergedMesh(legGeos, this._m.plank);
    legs.position.set(11, 0, 47);
    legs.rotation.y = -0.5;
  }

  // ------------------------------ landmark tower -----------------------------

  _buildTower() {
    // legs + walk-on deck at y=4 (reachable by south staircase)
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this.addSolidBox({
          width: 0.5, height: 3.6, depth: 0.5, x: sx * 3, y: 0, z: sz * 3,
          material: this._m.steelDark
        });
      }
    }
    this.addSolidBox({
      width: 7, height: 0.4, depth: 7, x: 0, y: 3.6, z: 0,
      material: this._m.plank
    });
    // staircase ascends northward toward the deck (10 x 0.4 risers -> y=4)
    this._stairs({ x: 0, z: 10.15, width: 2.4, steps: 10, dirZ: -1, material: this._m.concrete });

    // deck railings (gap on the south side for the stairs)
    const railGeos = [];
    const railRuns = [
      { x: 0, z: -3.45, w: 7, d: 0.12 },
      { x: -3.45, z: 0, w: 0.12, d: 7 },
      { x: 3.45, z: 0, w: 0.12, d: 7 },
      { x: -2.45, z: 3.45, w: 2.1, d: 0.12 },
      { x: 2.45, z: 3.45, w: 2.1, d: 0.12 }
    ];
    for (const r of railRuns) {
      const g = new THREE.BoxGeometry(r.w, 1.0, r.d);
      g.translate(r.x, 4.5, r.z);
      railGeos.push(g);
      this._boxCollider(r.x, 4.0, r.z, r.w, 1.0, r.d);
    }
    this._mergedMesh(railGeos, this._m.steel);

    // mast + rotating observation pod (visual landmark, visible map-wide)
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 16, 12), this._m.steel);
    mast.position.set(0, 12, 0);
    mast.castShadow = true;
    this.group.add(mast);
    this._boxCollider(0, 4, 0, 1.2, 16, 1.2);

    this._pod = new THREE.Group();
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.7, 1.7, 8), this._m.cream);
    cab.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.45, 0.6, 8), this._m.glass);
    band.position.y = 0.2;
    const podRoof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.2, 8), this._m.roofRed);
    podRoof.position.y = 1.45;
    podRoof.castShadow = true;
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6), this._m.steelDark);
    antenna.position.y = 3.1;
    this._pod.add(cab, band, podRoof, antenna);
    this._pod.position.set(0, 18.5, 0);
    this.group.add(this._pod);
  }

  // --------------------------- broken monkey enclosure -----------------------

  _buildMonkeyEnclosure() {
    const cx = -34;
    const cz = 2;
    const r = 8;

    // sandy floor pad
    const pad = new THREE.Mesh(new THREE.CircleGeometry(r + 0.6, 40), this._m.sand);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, 0.03, cz);
    pad.receiveShadow = true;
    this.group.add(pad);

    // cage bars (instanced) with a broken gap facing east; each bar collides
    const barGeo = new THREE.CylinderGeometry(0.07, 0.07, 4.5, 6);
    const straight = [];
    const nBars = 66;
    for (let i = 0; i < nBars; i++) {
      const th = (i / nBars) * Math.PI * 2;
      let d = th; // wrap to [-PI, PI] to test the gap around angle 0 (east)
      if (d > Math.PI) d -= Math.PI * 2;
      if (Math.abs(d) < 0.38) continue; // broken hole ~5.8m wide
      const bx = cx + r * Math.cos(th);
      const bz = cz + r * Math.sin(th);
      straight.push({ x: bx, y: 2.25, z: bz });
      this._boxCollider(bx, 0, bz, 0.22, 4.5, 0.22);
    }
    this._instanced(barGeo, this._m.steel, straight);

    // bent / torn-out bars around the hole (decor, no colliders)
    const bent = [
      { x: cx + r + 0.6, y: 1.6, z: cz + 2.4, rz: 1.15, ry: 0.4 },
      { x: cx + r + 1.1, y: 1.2, z: cz - 2.2, rz: 1.35, ry: -0.5 },
      { x: cx + r + 0.3, y: 1.9, z: cz + 1.1, rz: 0.8, rx: 0.3 },
      { x: cx + r + 1.6, y: 0.35, z: cz - 0.6, rz: 1.52, ry: 0.9 },
      { x: cx + r - 0.2, y: 1.8, z: cz - 1.6, rz: -0.7, rx: 0.4 }
    ];
    this._instanced(barGeo, this._m.steelDark, bent);

    // top and bottom rings
    const topRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.13, 8, 48), this._m.steelDark);
    topRing.rotation.x = Math.PI / 2;
    topRing.position.set(cx, 4.5, cz);
    this.group.add(topRing);
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(r, 0.16, 8, 48), this._m.concreteDark);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.set(cx, 0.08, cz);
    this.group.add(baseRing);

    // climbing structure inside: stepped wooden platforms (0.4 risers)
    const plats = [
      { x: cx - 3, z: cz - 2, h: 0.4 },
      { x: cx - 1.5, z: cz, h: 0.8 },
      { x: cx, z: cz + 2, h: 1.2 },
      { x: cx + 2, z: cz, h: 1.6 }
    ];
    for (const p of plats) {
      this.addSolidBox({ width: 2, height: p.h, depth: 2, x: p.x, y: 0, z: p.z, material: this._m.plank });
    }
    const poleGeos = [];
    for (const [px, pz] of [[cx - 3.4, cz + 1.4], [cx + 3.2, cz + 1.6], [cx - 0.5, cz - 3], [cx + 3.4, cz - 1.8]]) {
      const g = new THREE.CylinderGeometry(0.09, 0.09, 2.8, 8);
      g.translate(px, 1.4, pz);
      poleGeos.push(g);
    }
    const cross = new THREE.CylinderGeometry(0.07, 0.07, 5.4, 8);
    cross.rotateZ(Math.PI / 2);
    cross.translate(cx, 2.75, cz - 2.4);
    poleGeos.push(cross);
    const rope = new THREE.CylinderGeometry(0.04, 0.04, 1.1, 6);
    rope.translate(cx - 1.2, 2.2, cz - 2.4);
    poleGeos.push(rope);
    this._mergedMesh(poleGeos, this._m.trunk);
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 18), this._m.steelDark);
    tire.position.set(cx - 1.2, 1.3, cz - 2.4);
    this.group.add(tire);

    // MONKEY HOUSE sign by the path spur + fallen sign inside the hole
    this._addSign('MONKEY HOUSE', { x: -22, z: 7, ry: 0.9, bg: '#7a4a12', sub: 'enclosure 7 — CLOSED' });
    const fallen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 0.7),
      new THREE.MeshBasicMaterial({
        map: textSignTexture('DANGER', { bg: '#a8433a' }),
        side: THREE.DoubleSide
      })
    );
    fallen.position.set(cx + r + 1.8, 0.06, cz + 1.2);
    fallen.rotation.set(-Math.PI / 2, 0, 0.7);
    this.group.add(fallen);

    // flickering MONKEY ALARM beacon just outside the hole
    const bx = -23.5;
    const bz = 2;
    const bpole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 3.1, 10), this._m.steelDark);
    bpole.position.set(bx, 1.55, bz);
    bpole.castShadow = true;
    this.group.add(bpole);
    this._boxCollider(bx, 0, bz, 0.45, 3.2, 0.45);
    this._beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff2a1a, emissive: 0xff2013, emissiveIntensity: 2, roughness: 0.4
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 10), this._beaconMat);
    bulb.position.set(bx, 3.35, bz);
    this.group.add(bulb);
    this._beaconLight = new THREE.PointLight(0xff2a1a, 6, 28, 1.8);
    this._beaconLight.position.set(bx, 3.35, bz);
    this.group.add(this._beaconLight);
    const alarmSign = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 0.65),
      new THREE.MeshBasicMaterial({
        map: textSignTexture('MONKEY ALARM', { bg: '#7f1d1d', border: '#ffffff' }),
        side: THREE.DoubleSide
      })
    );
    alarmSign.position.set(bx, 2.3, bz);
    alarmSign.rotation.y = Math.PI / 2;
    this.group.add(alarmSign);
  }

  // --------------------------------- lion pit --------------------------------

  _buildLionPit() {
    // pit interior spans x 31..41, z -8..0
    const pit = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), this._m.sand);
    pit.rotation.x = -Math.PI / 2;
    pit.position.set(36, 0.035, -4);
    pit.receiveShadow = true;
    this.group.add(pit);

    // stepped viewing terraces (east / north / south), 0.4 risers — walkable
    const tiers = [0.4, 0.8, 1.2];
    tiers.forEach((h, i) => {
      const off = 0.6 + i * 1.2;
      this.addSolidBox({ width: 1.2, height: h, depth: 8 + 2 * (0.6 + i * 1.2 + 0.6), x: 41 + off, y: 0, z: -4, material: this._m.concrete });
      this.addSolidBox({ width: 10, height: h, depth: 1.2, x: 36, y: 0, z: -8 - off, material: this._m.concrete });
      this.addSolidBox({ width: 10, height: h, depth: 1.2, x: 36, y: 0, z: off, material: this._m.concrete });
    });

    // safety rail on the west side, with a keeper gap at z=-4
    for (const seg of [{ z: -6.6, d: 2.8 }, { z: -1.4, d: 2.8 }]) {
      this.addSolidBox({ width: 0.12, height: 1.0, depth: seg.d, x: 31, y: 0, z: seg.z, material: this._m.steel });
    }

    // lion statue
    this.addSolidBox({
      width: 2.3, height: 1.0, depth: 1.1, x: 37, y: 0.5, z: -4, material: this._m.lion, collider: false
    });
    this._boxCollider(37, 0, -4, 2.6, 1.9, 1.3);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), this._m.lion);
    head.position.set(38.2, 1.7, -4);
    head.castShadow = true;
    this.group.add(head);
    const maneRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.2, 10, 18), this._m.mane);
    maneRing.rotation.y = Math.PI / 2;
    maneRing.position.set(38.05, 1.7, -4);
    this.group.add(maneRing);
    const legGeos = [];
    for (const [lx, lz] of [[36.1, -3.6], [36.1, -4.4], [37.9, -3.6], [37.9, -4.4]]) {
      const g = new THREE.BoxGeometry(0.3, 0.5, 0.3);
      g.translate(lx, 0.25, lz);
      legGeos.push(g);
    }
    const tail = new THREE.CylinderGeometry(0.06, 0.06, 1.1, 6);
    tail.rotateZ(1.2);
    tail.translate(35.6, 1.15, -4);
    legGeos.push(tail);
    this._mergedMesh(legGeos, this._m.lion);

    // boulders (instanced)
    const rockGeo = new THREE.DodecahedronGeometry(0.9, 0);
    this._instanced(rockGeo, this._m.rock, [
      { x: 32.5, y: 0.5, z: -7, s: 1.1, ry: 0.7 },
      { x: 40, y: 0.4, z: -1.5, s: 0.9, ry: 2.1 },
      { x: 39.5, y: 0.45, z: -7.2, s: 1.0, ry: 4.0 }
    ]);
    this._boxCollider(32.5, 0, -7, 1.9, 1.6, 1.9);
    this._boxCollider(40, 0, -1.5, 1.6, 1.3, 1.6);
    this._boxCollider(39.5, 0, -7.2, 1.7, 1.5, 1.7);

    this._addSign('LION PIT', { x: 29.2, z: -8.6, ry: -0.6, bg: '#7a4a12', sub: 'do not lean over the rail' });
  }

  // ---------------------------------- aviary ---------------------------------

  _buildAviary() {
    // square base wall 12x12 (x 32..44, z -46..-34), door gap on the west side
    const wallH = 1.0;
    this.addSolidBox({ width: 12, height: wallH, depth: 0.4, x: 38, y: 0, z: -45.8, material: this._m.concreteDark });
    this.addSolidBox({ width: 12, height: wallH, depth: 0.4, x: 38, y: 0, z: -34.2, material: this._m.concreteDark });
    this.addSolidBox({ width: 0.4, height: wallH, depth: 3.6, x: 32.2, y: 0, z: -44.2, material: this._m.concreteDark });
    this.addSolidBox({ width: 0.4, height: wallH, depth: 3.6, x: 32.2, y: 0, z: -35.8, material: this._m.concreteDark });
    this.addSolidBox({ width: 0.4, height: wallH, depth: 11.2, x: 43.8, y: 0, z: -40, material: this._m.concreteDark });

    // wireframe dome = the bird-mesh; plus a couple of solid frame rings
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(6.6, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x2f3a42, wireframe: true })
    );
    dome.position.set(38, 1.0, -40);
    this.group.add(dome);
    const ringGeos = [];
    for (const [rr, ry] of [[6.6, 1.0], [5.6, 4.4], [3.4, 6.6]]) {
      const g = new THREE.TorusGeometry(rr, 0.09, 8, 40);
      g.rotateX(Math.PI / 2);
      g.translate(38, ry, -40);
      ringGeos.push(g);
    }
    this._mergedMesh(ringGeos, this._m.steelDark, { castShadow: false });

    // interior perch tree
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 3.4, 10), this._m.trunk);
    trunk.position.set(41, 1.7, -43);
    trunk.castShadow = true;
    this.group.add(trunk);
    this._boxCollider(41, 0, -43, 0.7, 3.4, 0.7);
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.7, 0), this._m.leafLight);
    canopy.position.set(41, 4.1, -43);
    canopy.castShadow = true;
    this.group.add(canopy);

    // colorful birds (instanced spheres with per-instance color)
    const birds = [
      { x: 40.2, y: 3.6, z: -42.4, color: 0xd9482f }, { x: 41.8, y: 3.2, z: -43.5, color: 0x2f7fd9 },
      { x: 38, y: 5.6, z: -40, color: 0xe6b34c }, { x: 36, y: 4.2, z: -38, color: 0x59b93c },
      { x: 35, y: 2.4, z: -42.6, color: 0xc94f9e }, { x: 40.5, y: 6.2, z: -38.5, color: 0xffffff },
      { x: 37.2, y: 1.1, z: -36.4, color: 0xd9482f }, { x: 42.6, y: 2.0, z: -37.2, color: 0x2f7fd9 }
    ];
    this._instanced(
      new THREE.SphereGeometry(0.16, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }),
      birds
    );

    this._addSign('AVIARY', { x: 30.4, z: -36.6, ry: 0.5, bg: '#2f5f7f', sub: 'mind the door — birds escape too' });
  }

  // ------------------------------- penguin pool ------------------------------

  _buildPenguinPool() {
    // rim walls: pool spans x -44..-32, z -44.5..-35.5 (jump in over 0.6 rim)
    const rimH = 0.6;
    this.addSolidBox({ width: 12, height: rimH, depth: 0.5, x: -38, y: 0, z: -44.25, material: this._m.concrete });
    this.addSolidBox({ width: 12, height: rimH, depth: 0.5, x: -38, y: 0, z: -35.75, material: this._m.concrete });
    this.addSolidBox({ width: 0.5, height: rimH, depth: 9, x: -43.75, y: 0, z: -40, material: this._m.concrete });
    this.addSolidBox({ width: 0.5, height: rimH, depth: 9, x: -32.25, y: 0, z: -40, material: this._m.concrete });

    // animated water plane
    this._water = new THREE.Mesh(new THREE.PlaneGeometry(11, 8), this._m.water);
    this._water.rotation.x = -Math.PI / 2;
    this._water.position.set(-38, 0.36, -40);
    this.group.add(this._water);

    // ice floes to hide behind
    this.addSolidBox({ width: 1.7, height: 0.55, depth: 1.4, x: -41, y: 0, z: -42, material: this._m.ice });
    this.addSolidBox({ width: 1.2, height: 0.75, depth: 1.0, x: -34.5, y: 0, z: -37.5, material: this._m.ice });

    // stepped diving rock (0.4 risers) at the north edge
    this.addSolidBox({ width: 2.2, height: 0.4, depth: 1.4, x: -41.5, y: 0, z: -37, material: this._m.rock });
    this.addSolidBox({ width: 1.4, height: 0.8, depth: 1.2, x: -41.8, y: 0, z: -36.4, material: this._m.rock });

    // penguins: black bodies+heads, white bellies, orange beaks (3 instanced)
    const bodyGeos = [];
    const body = new THREE.ConeGeometry(0.24, 0.62, 10);
    body.translate(0, 0.31, 0);
    bodyGeos.push(body);
    const headG = new THREE.SphereGeometry(0.13, 10, 8);
    headG.translate(0, 0.68, 0);
    bodyGeos.push(headG);
    const penguinGeo = mergeGeometries(bodyGeos);
    const spots = [
      { x: -41, y: 0.55, z: -42, ry: 0.5 }, { x: -34.5, y: 0.75, z: -37.5, ry: 2.6 },
      { x: -41.8, y: 0.8, z: -36.4, ry: 3.5 }, { x: -38, y: rimH, z: -44.1, ry: 0.1 },
      { x: -35.5, y: rimH, z: -44.1, ry: -0.4 }, { x: -43.6, y: rimH, z: -41, ry: 1.4 },
      { x: -36.8, y: 0.36, z: -41.5, ry: 5.2 }
    ];
    this._instanced(penguinGeo, this._m.penguinBlack, spots);
    const bellyGeo = new THREE.SphereGeometry(0.17, 10, 8);
    bellyGeo.scale(1, 1.5, 0.7);
    this._instanced(bellyGeo, this._m.penguinWhite,
      spots.map((s) => ({ ...s, x: s.x + Math.sin(s.ry) * 0.12, y: s.y + 0.34, z: s.z + Math.cos(s.ry) * 0.12 })));
    const beakGeo = new THREE.ConeGeometry(0.045, 0.16, 6);
    beakGeo.rotateX(Math.PI / 2);
    this._instanced(beakGeo, this._m.beak,
      spots.map((s) => ({ ...s, x: s.x + Math.sin(s.ry) * 0.19, y: s.y + 0.66, z: s.z + Math.cos(s.ry) * 0.19 })));

    // pump shed (extra hiding corner)
    this.addSolidBox({ width: 2, height: 2.2, depth: 2, x: -45.5, y: 0, z: -33, material: this._m.concreteDark });
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.8, 8), this._m.steel);
    vent.position.set(-45.5, 2.6, -33);
    this.group.add(vent);

    this._addSign('PENGUIN POOL', { x: -31, z: -36.2, ry: -0.5, bg: '#2f5f7f', sub: 'feeding at 3 PM' });
  }

  // ------------------------------- reptile house -----------------------------

  _buildReptileHouse() {
    // enterable building x -10..10, z -54.5..-45.5, two door gaps on the south
    const H = 3.6;
    this.addSolidBox({ width: 20, height: H, depth: 0.5, x: 0, y: 0, z: -54.25, material: this._m.brick });
    this.addSolidBox({ width: 0.5, height: H, depth: 9, x: -9.75, y: 0, z: -50, material: this._m.brick });
    this.addSolidBox({ width: 0.5, height: H, depth: 9, x: 9.75, y: 0, z: -50, material: this._m.brick });
    // south wall segments leave door gaps at x=+-3 (1.8m wide)
    this.addSolidBox({ width: 6.1, height: H, depth: 0.5, x: -6.95, y: 0, z: -45.75, material: this._m.brick });
    this.addSolidBox({ width: 4.2, height: H, depth: 0.5, x: 0, y: 0, z: -45.75, material: this._m.brick });
    this.addSolidBox({ width: 6.1, height: H, depth: 0.5, x: 6.95, y: 0, z: -45.75, material: this._m.brick });
    // lintels over the doors
    for (const dx of [-3, 3]) {
      this.addSolidBox({ width: 1.8, height: 1.0, depth: 0.5, x: dx, y: 2.6, z: -45.75, material: this._m.brick });
    }
    // roof slab with slight overhang
    this.addSolidBox({ width: 21.4, height: 0.5, depth: 10.4, x: 0, y: H, z: -50, material: this._m.roofTeal });

    // interior: terrarium stands + glass tanks along the north wall (instanced)
    const standItems = [];
    const glassItems = [];
    const snakeItems = [];
    for (let i = 0; i < 5; i++) {
      const tx = -7.2 + i * 3.6;
      standItems.push({ x: tx, y: 0.45, z: -53.3 });
      glassItems.push({ x: tx, y: 1.35, z: -53.3 });
      snakeItems.push({ x: tx, y: 1.05, z: -53.3, ry: i * 1.3 });
      this._boxCollider(tx, 0, -53.3, 1.5, 1.8, 1.1);
    }
    this._instanced(new THREE.BoxGeometry(1.4, 0.9, 1.0), this._m.plank, standItems);
    this._instanced(new THREE.BoxGeometry(1.3, 0.9, 0.9), this._m.glass, glassItems, { castShadow: false });
    this._instanced(new THREE.TorusGeometry(0.22, 0.07, 8, 14),
      new THREE.MeshStandardMaterial({ color: 0x4f9a3a, roughness: 0.8 }), snakeItems);

    // central croc display island
    this.addSolidBox({ width: 2.2, height: 0.5, depth: 1.5, x: 0, y: 0, z: -50, material: this._m.rock });
    const croc = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.28, 0.5), this._m.leaf);
    croc.position.set(0, 0.64, -50);
    croc.rotation.y = 0.5;
    croc.castShadow = true;
    this.group.add(croc);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.18, 0.3), this._m.leaf);
    snout.position.set(0.95, 0.6, -49.5);
    snout.rotation.y = 0.5;
    this.group.add(snout);

    this._addSign('REPTILE HOUSE', { x: 0, z: -44.6, y: 3.0, w: 5, h: 1.2, posts: false, bg: '#3a5f2f', sub: 'sssshhh…' });
  }

  // -------------------------------- food court -------------------------------

  _buildFoodCourt() {
    const kiosks = [
      { x: 26, z: 26, ry: 0, name: 'BANANA SPLITS', awn: this._m.awningRed },
      { x: 40, z: 26, ry: 0, name: 'SNACK SHACK', awn: this._m.awningTeal },
      { x: 42, z: 38, ry: -Math.PI / 2, name: 'COLD DRINKS', awn: this._m.awningRed }
    ];
    for (const k of kiosks) {
      // counter + back wall + roof (rotY multiples of PI/2 keep colliders exact)
      this.addSolidBox({ width: 3, height: 1.0, depth: 2, x: k.x, y: 0, z: k.z, rotationY: k.ry, material: this._m.cream });
      const backOff = { x: Math.sin(k.ry) * -0.7, z: Math.cos(k.ry) * -0.7 };
      this.addSolidBox({
        width: 3, height: 2.3, depth: 0.6,
        x: k.x + backOff.x, y: 0, z: k.z + backOff.z, rotationY: k.ry, material: this._m.cream
      });
      this.addSolidBox({
        width: 3.4, height: 0.18, depth: 2.7, x: k.x, y: 2.3, z: k.z, rotationY: k.ry,
        material: this._m.roofRed, collider: false
      });
      // slanted striped awning over the counter (decor)
      const awning = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.2), k.awn);
      awning.position.set(k.x + Math.sin(k.ry) * 1.4, 2.0, k.z + Math.cos(k.ry) * 1.4);
      awning.rotation.set(-Math.PI / 3, k.ry, 0, 'YXZ');
      awning.castShadow = true;
      this.group.add(awning);
      // fascia sign
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 0.6),
        new THREE.MeshBasicMaterial({ map: textSignTexture(k.name, { bg: '#a8433a' }), side: THREE.DoubleSide })
      );
      sign.position.set(k.x + Math.sin(k.ry) * 1.15, 1.75, k.z + Math.cos(k.ry) * 1.15);
      sign.rotation.y = k.ry;
      this.group.add(sign);
    }

    // umbrella tables (poles+canopies+tabletops instanced) + stools
    const spots = [[30, 33], [35, 30], [31, 39], [37, 36], [33, 43]];
    const tableGeos = [];
    const top = new THREE.CylinderGeometry(0.7, 0.7, 0.08, 14);
    top.translate(0, 0.78, 0);
    tableGeos.push(top);
    const stem = new THREE.CylinderGeometry(0.07, 0.07, 0.78, 8);
    stem.translate(0, 0.39, 0);
    tableGeos.push(stem);
    const foot = new THREE.CylinderGeometry(0.3, 0.34, 0.06, 10);
    foot.translate(0, 0.03, 0);
    tableGeos.push(foot);
    const tableGeo = mergeGeometries(tableGeos);
    const tableItems = spots.map(([x, z]) => ({ x, y: 0, z }));
    this._instanced(tableGeo, this._m.cream, tableItems);
    this._instanced(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), this._m.steelDark,
      spots.map(([x, z]) => ({ x, y: 1.55, z })));
    this._instanced(new THREE.ConeGeometry(1.35, 0.6, 10), this._m.awningRed,
      spots.map(([x, z], i) => ({ x, y: 2.3, z, ry: i * 0.8 })));
    const stoolItems = [];
    for (const [x, z] of spots) {
      stoolItems.push({ x: x + 1.0, y: 0.25, z });
      stoolItems.push({ x: x - 1.0, y: 0.25, z: z + 0.3 });
    }
    this._instanced(new THREE.CylinderGeometry(0.24, 0.28, 0.5, 10), this._m.roofTeal, stoolItems);
    for (const [x, z] of spots) this._boxCollider(x, 0, z, 1.5, 0.9, 1.5);

    this._addSign('FOOD COURT', { x: 23.4, z: 20.4, ry: 0.4, bg: '#a8433a', sub: 'no monkey business' });
  }

  // --------------------------------- restrooms -------------------------------

  _buildRestrooms() {
    this.addSolidBox({ width: 8, height: 3.2, depth: 5, x: -36, y: 0, z: 44, material: this._m.cream });
    this.addSolidBox({
      width: 8.8, height: 0.3, depth: 5.8, x: -36, y: 3.2, z: 44,
      material: this._m.roofTeal, collider: false
    });
    // dark door insets on the north face
    for (const dx of [-2, 2]) {
      const door = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 2.2),
        new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.9 })
      );
      door.position.set(-36 + dx, 1.1, 41.48);
      door.rotation.y = Math.PI;
      this.group.add(door);
    }
    this._addSign('RESTROOMS', { x: -36, z: 41.2, y: 2.6, w: 3.4, h: 0.9, posts: false, bg: '#2f5f7f' });
    // drinking fountain
    this.addSolidBox({ width: 0.5, height: 0.9, depth: 0.5, x: -31, y: 0, z: 42, material: this._m.concreteDark });
  }

  // ------------------------------- service alley -----------------------------

  _buildServiceAlley() {
    // dumpsters along the west wall with hide-gaps between them
    for (const dz of [12, 16, 20]) {
      this.addSolidBox({ width: 2.2, height: 1.3, depth: 1.4, x: -60.5, y: 0, z: dz, material: this._m.dumpster });
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.5), this._m.dumpster);
      lid.position.set(-60.5, 1.42, dz - 0.12);
      lid.rotation.x = -0.35;
      lid.castShadow = true;
      this.group.add(lid);
    }
    // crate stacks (instanced) with per-stack colliders
    const crateGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
    const crates = [];
    const stacks = [
      { x: -61, z: 26, n: 2 }, { x: -61, z: 28.4, n: 3 }, { x: -59.4, z: 27.2, n: 1 },
      { x: -61, z: 31, n: 2 }, { x: -58.8, z: 31.8, n: 1 }
    ];
    for (const st of stacks) {
      for (let i = 0; i < st.n; i++) {
        crates.push({ x: st.x, y: 0.55 + i * 1.1, z: st.z, ry: (i * 0.4 + st.x) % 0.5 - 0.25 });
      }
      this._boxCollider(st.x, 0, st.z, 1.35, st.n * 1.1 + 0.1, 1.35);
    }
    this._instanced(crateGeo, this._m.crate, crates);
    this._addSign('STAFF ONLY', { x: -55, z: 9.4, ry: 0.2, w: 2.2, h: 0.8, y: 1.6, bg: '#4a4a4a' });
  }

  // --------------------------------- zoo train -------------------------------

  _buildTrain() {
    // oval track (flush decor): ellipse centred (54, 0), rx 6.5, rz 16
    const cx = 54;
    const cz = 0;
    const rx = 6.5;
    const rz = 16;
    const n = 30;
    const tieGeos = [];
    const railGeos = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const px = cx + rx * Math.cos(t);
      const pz = cz + rz * Math.sin(t);
      const tanX = -rx * Math.sin(t);
      const tanZ = rz * Math.cos(t);
      const tanA = Math.atan2(-tanZ, tanX);
      const nx = Math.cos(t);
      const nz = Math.sin(t);
      const tie = new THREE.BoxGeometry(1.5, 0.07, 0.45);
      tie.rotateY(Math.atan2(-nz, nx));
      tie.translate(px, 0.035, pz);
      tieGeos.push(tie);
      for (const side of [-1, 1]) {
        const rail = new THREE.BoxGeometry(3.4, 0.09, 0.09);
        rail.rotateY(tanA);
        rail.translate(px + nx * 0.5 * side, 0.1, pz + nz * 0.5 * side);
        railGeos.push(rail);
      }
    }
    this._mergedMesh(tieGeos, this._m.plank, { castShadow: false });
    this._mergedMesh(railGeos, this._m.steelDark, { castShadow: false });

    // station platform + sign
    this.addSolidBox({ width: 4.5, height: 0.4, depth: 1.6, x: 54, y: 0, z: 19.8, material: this._m.concrete });
    this._addSign('ZOO EXPRESS', { x: 57, z: 20.4, ry: Math.PI, bg: '#2f5f7f', sub: 'departs whenever the driver returns' });

    // cute engine parked at the south of the loop, heading west
    const eng = new THREE.Group();
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.45, 1.3), this._m.steelDark);
    chassis.position.y = 0.5;
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.7, 14), this._m.trainRed);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(-0.45, 1.05, 0);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.3, 1.2), this._m.trainRed);
    cab.position.set(0.85, 1.35, 0);
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.12, 1.4), this._m.trainYellow);
    cabRoof.position.set(0.85, 2.05, 0);
    const stack = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 10), this._m.steelDark);
    stack.position.set(-1.0, 1.85, 0);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.15, 14), this._m.trainYellow);
    nose.rotation.z = Math.PI / 2;
    nose.position.set(-1.35, 1.05, 0);
    eng.add(chassis, boiler, cab, cabRoof, stack, nose);
    eng.traverse((o) => { o.castShadow = true; });
    eng.position.set(54, 0, 16);
    this.group.add(eng);
    this._boxCollider(54, 0, 16, 3.2, 2.1, 1.5);

    // one open passenger car behind the engine
    const car = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.4, 1.3), this._m.trainYellow);
    base.position.y = 0.5;
    const sideA = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.12), this._m.trainRed);
    sideA.position.set(0, 0.95, 0.6);
    const sideB = sideA.clone();
    sideB.position.z = -0.6;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 1.5), this._m.awningTeal);
    canopy.position.y = 2.0;
    const canopyPosts = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), this._m.steelDark);
    canopyPosts.position.set(-1.1, 1.25, 0.55);
    car.add(base, sideA, sideB, canopy, canopyPosts);
    car.traverse((o) => { o.castShadow = true; });
    car.position.set(57.6, 0, 15.4);
    car.rotation.y = 0.25;
    this.group.add(car);
    this._boxCollider(57.6, 0, 15.4, 2.9, 2.1, 1.8);

    // wheels for engine + car (instanced)
    const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12);
    wheelGeo.rotateX(Math.PI / 2);
    const wheels = [];
    for (const wx of [53.1, 54.9]) {
      for (const wz of [15.35, 16.65]) wheels.push({ x: wx, y: 0.3, z: wz });
    }
    for (const wx of [56.8, 58.4]) {
      for (const wz of [14.6, 15.9]) wheels.push({ x: wx, y: 0.3, z: wz });
    }
    this._instanced(wheelGeo, this._m.steelDark, wheels);
  }

  // ------------------------ hedges, trees, lamps, benches --------------------

  _buildGreenery() {
    // trimmed hedge rows (instanced) — every hedge collides
    const hedgeGeo = new THREE.BoxGeometry(1, 1, 2.6);
    const hedgeSpots = [];
    for (const sx of [-1, 1]) {
      for (const hz of [47.5, 51, 54.5, 58]) hedgeSpots.push([sx * 13, hz]);
      for (const hz of [-16, -12, 24, 28]) hedgeSpots.push([sx * 5.8, hz]);
    }
    this._instanced(hedgeGeo, this._m.hedge, hedgeSpots.map(([x, z]) => ({ x, y: 0.5, z })));
    for (const [x, z] of hedgeSpots) this._boxCollider(x, 0, z, 1, 1, 2.6);

    // trees (instanced trunks + two-tone canopies)
    const treeSpots = [
      [-16, 28], [17, 26], [-22, -18], [24, -24], [-50, -16], [52, 36],
      [-14, -30], [18, -58], [-52, 44], [56, 52], [48, -56], [-54, -52]
    ];
    this._instanced(new THREE.CylinderGeometry(0.22, 0.3, 2.8, 8), this._m.trunk,
      treeSpots.map(([x, z]) => ({ x, y: 1.4, z })));
    this._instanced(new THREE.IcosahedronGeometry(1.6, 0), this._m.leaf,
      treeSpots.map(([x, z], i) => ({ x, y: 3.4, z, ry: i, s: 1 + (i % 3) * 0.15 })));
    this._instanced(new THREE.IcosahedronGeometry(1.0, 0), this._m.leafLight,
      treeSpots.map(([x, z], i) => ({ x: x + 0.5, y: 4.3, z: z - 0.3, ry: i * 2 })));
    for (const [x, z] of treeSpots) this._boxCollider(x, 0, z, 0.7, 2.8, 0.7);

    // lampposts (instanced poles + glowing heads)
    const lampSpots = [
      [4.5, 46], [-4.5, 36], [4.5, 22], [-4.5, -12], [4.5, -28], [-4.5, -44],
      [24, 10], [-24, 18], [48, 10], [-48, 18]
    ];
    this._instanced(new THREE.CylinderGeometry(0.07, 0.1, 3.6, 8), this._m.steelDark,
      lampSpots.map(([x, z]) => ({ x, y: 1.8, z })));
    this._instanced(new THREE.SphereGeometry(0.22, 10, 8), this._m.lampGlow,
      lampSpots.map(([x, z]) => ({ x, y: 3.7, z })), { castShadow: false });
    for (const [x, z] of lampSpots) this._boxCollider(x, 0, z, 0.3, 3.6, 0.3);

    // park benches (merged geometry, instanced)
    const benchGeos = [];
    const seat = new THREE.BoxGeometry(1.6, 0.08, 0.5);
    seat.translate(0, 0.45, 0);
    benchGeos.push(seat);
    const back = new THREE.BoxGeometry(1.6, 0.5, 0.08);
    back.translate(0, 0.75, -0.24);
    benchGeos.push(back);
    for (const sx of [-1, 1]) {
      const legB = new THREE.BoxGeometry(0.08, 0.45, 0.45);
      legB.translate(sx * 0.7, 0.225, 0);
      benchGeos.push(legB);
    }
    const benchGeo = mergeGeometries(benchGeos);
    const benchSpots = [
      { x: 8, z: 40, ry: Math.PI / 2 }, { x: -8, z: 40, ry: -Math.PI / 2 },
      { x: 8, z: -20, ry: Math.PI / 2 }, { x: -8, z: -20, ry: -Math.PI / 2 },
      { x: 24, z: 44, ry: Math.PI }, { x: 44, z: 24, ry: -Math.PI / 2 }
    ];
    this._instanced(benchGeo, this._m.plank, benchSpots.map((b) => ({ x: b.x, y: 0, z: b.z, ry: b.ry })));
    for (const b of benchSpots) this._boxCollider(b.x, 0, b.z, 1.7, 1.0, 1.7);
  }

  // ---------------------------------- spawns ---------------------------------

  _buildSpawns() {
    // police staging: just inside the entrance gate
    this.policeSpawns = [
      new THREE.Vector3(-2.5, 0, 57),
      new THREE.Vector3(2.5, 0, 57),
      new THREE.Vector3(-5, 0, 59),
      new THREE.Vector3(5, 0, 59),
      new THREE.Vector3(0, 0, 60.5)
    ];

    // monkeys: scattered across the best hiding spots
    this.monkeySpawns = [
      new THREE.Vector3(-35, 0, -2),      // inside the broken enclosure
      new THREE.Vector3(-39, 0, 6),       // enclosure, behind the climb frame
      new THREE.Vector3(-32, 1.6, 2),     // on top of the climbing platform
      new THREE.Vector3(-6, 0, -51),      // reptile house, west aisle
      new THREE.Vector3(6, 0, -52),       // reptile house, east aisle
      new THREE.Vector3(-61.5, 0, 14),    // between dumpsters (service alley)
      new THREE.Vector3(-61.5, 0, 18),    // between dumpsters (service alley)
      new THREE.Vector3(26, 0, 23.4),     // behind the Banana Splits kiosk
      new THREE.Vector3(44.6, 0, 38),     // behind the Cold Drinks kiosk
      new THREE.Vector3(38, 0, -40),      // inside the aviary dome
      new THREE.Vector3(-38, 0, -40),     // wading in the penguin pool
      new THREE.Vector3(32.5, 0, -1.5),   // down in the lion pit
      new THREE.Vector3(1.5, 4, -1.5)     // observation tower deck
    ];
  }
}
