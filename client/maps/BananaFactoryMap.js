import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MapBase } from './MapBase.js';

// ---------------------------------------------------------------------------
// Banana Factory — a noisy industrial plant full of conveyor belts and crates.
//
// Layout (120 x 120 sealed hall, interior wall faces at +/-59):
//   south      : loading dock + delivery truck (police staging area)
//   south-west : banana-crate maze (prime hiding)
//   north-west : ripening vats + overhead pipes
//   north/east : catwalk ring (deck top y=4) with stairs at NW and SE
//   east       : glass control room on a mezzanine (deck top y=4)
//   center     : colossal rotating banana statue (landmark)
//   belts      : 2 ground lines, 1 cross line, 1 elevated line (top y=3.5)
// ---------------------------------------------------------------------------

// ----------------------------- canvas helpers ------------------------------

function makeCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
}

function makeTexture(canvas, repeatX = 1, repeatY = 1) {
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
    ctx.globalAlpha = 0.08 + Math.random() * 0.2;
    ctx.fillRect(Math.random() * w, Math.random() * h, r, r);
  }
  ctx.globalAlpha = 1;
}

/** Stencil-style banana crescent with brown tips. */
function drawBanana(ctx, cx, cy, r, rot, color, lineW) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -r * 0.35, r, Math.PI * 0.15, Math.PI * 0.85);
  ctx.stroke();
  ctx.fillStyle = '#5b3a17';
  const ex = r * Math.cos(Math.PI * 0.15);
  const ey = -r * 0.35 + r * Math.sin(Math.PI * 0.15);
  ctx.beginPath();
  ctx.arc(-ex, ey, lineW * 0.32, 0, Math.PI * 2);
  ctx.arc(ex, ey, lineW * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function concreteTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#686c6f';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 900, ['#5a5e61', '#75797c', '#4e5254', '#7e8284'], 2.5);
  ctx.strokeStyle = 'rgba(40,42,44,0.55)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.strokeStyle = 'rgba(50,53,55,0.35)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * 256, Math.random() * 256);
    ctx.lineTo(Math.random() * 256, Math.random() * 256);
    ctx.stroke();
  }
  return canvas;
}

function corrugatedTexture() {
  const { canvas, ctx } = makeCanvas(128, 256);
  for (let x = 0; x < 128; x += 16) {
    const g = ctx.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, '#3a4148');
    g.addColorStop(0.5, '#59626b');
    g.addColorStop(1, '#31383e');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 16, 256);
  }
  ctx.fillStyle = 'rgba(20,24,27,0.5)';
  ctx.fillRect(0, 124, 128, 8);
  ctx.fillStyle = '#7c858d';
  for (let x = 8; x < 128; x += 16) {
    ctx.beginPath();
    ctx.arc(x, 128, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, 128, 256, 250, ['#2c3237', '#666f77'], 2);
  return canvas;
}

function crateTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#a87c46';
  ctx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = y % 128 === 0 ? '#a2763f' : '#b0824a';
    ctx.fillRect(0, y, 256, 60);
    ctx.fillStyle = 'rgba(60,38,15,0.8)';
    ctx.fillRect(0, y + 60, 256, 4);
  }
  ctx.strokeStyle = 'rgba(92,60,24,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 256;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(80, y + 6, 170, y - 6, 256, y + 3);
    ctx.stroke();
  }
  ctx.strokeStyle = '#7a5426';
  ctx.lineWidth = 18;
  ctx.strokeRect(9, 9, 238, 238);
  ctx.fillStyle = '#4d5359';
  for (const [bx, by] of [[0, 0], [226, 0], [0, 226], [226, 226]]) ctx.fillRect(bx, by, 30, 30);
  drawBanana(ctx, 128, 96, 52, 0.2, 'rgba(58,36,12,0.85)', 26);
  ctx.fillStyle = 'rgba(58,36,12,0.9)';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BANANA CO.', 128, 186);
  ctx.font = 'bold 20px Arial, sans-serif';
  ctx.fillText('FRAGILE - RIPE', 128, 216);
  return canvas;
}

function beltTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#17181b';
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = '#31353b';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (const x of [16, 80]) {
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x + 30, 64);
    ctx.lineTo(x, 116);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(70,74,80,0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(128, 4);
  ctx.moveTo(0, 124);
  ctx.lineTo(128, 124);
  ctx.stroke();
  speckle(ctx, 128, 128, 130, ['#26282c', '#0e0f11'], 2);
  return canvas;
}

function hazardTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#d9a91c';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#191a1c';
  ctx.save();
  ctx.translate(64, 64);
  ctx.rotate(Math.PI / 4);
  for (let x = -200; x < 200; x += 44) ctx.fillRect(x, -110, 22, 220);
  ctx.restore();
  speckle(ctx, 128, 128, 80, ['#8a6c10', '#2a2b2d'], 2);
  return canvas;
}

function plateTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#565d64';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#6a727a';
  for (let y = 8; y < 128; y += 32) {
    for (let x = 8; x < 128; x += 32) {
      ctx.save();
      ctx.translate(x + ((y / 32) % 2) * 16, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-7, -3, 14, 6);
      ctx.restore();
    }
  }
  speckle(ctx, 128, 128, 200, ['#41474d', '#788089'], 2);
  return canvas;
}

function palletTexture() {
  const { canvas, ctx } = makeCanvas(128, 128);
  ctx.fillStyle = '#8d6b3e';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#231508';
  for (let y = 20; y < 128; y += 26) ctx.fillRect(0, y, 128, 7);
  speckle(ctx, 128, 128, 160, ['#6e5330', '#a5824f'], 2);
  return canvas;
}

function vatTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#828a91');
  g.addColorStop(0.6, '#6d757c');
  g.addColorStop(1, '#565d63');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 2;
  for (let x = 0; x < 256; x += 7) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }
  ctx.fillStyle = '#454b50';
  for (const y of [18, 238]) {
    for (let x = 10; x < 256; x += 24) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = '#d9a91c';
  ctx.fillRect(0, 96, 256, 62);
  ctx.fillStyle = '#191a1c';
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RIPENING VAT', 128, 136);
  drawBanana(ctx, 30, 128, 16, 0.3, '#191a1c', 9);
  drawBanana(ctx, 226, 128, 16, 0.3, '#191a1c', 9);
  ctx.fillStyle = 'rgba(46,40,30,0.45)';
  ctx.fillRect(0, 232, 256, 24);
  return canvas;
}

function signTexture(title, sub) {
  const { canvas, ctx } = makeCanvas(1024, 256);
  ctx.fillStyle = '#131519';
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = '#e9bc2b';
  ctx.lineWidth = 14;
  ctx.strokeRect(14, 14, 996, 228);
  ctx.fillStyle = '#f2ca35';
  ctx.font = 'bold 120px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 512, sub ? 132 : 158);
  if (sub) {
    ctx.fillStyle = '#c8cdd2';
    ctx.font = 'bold 52px Arial, sans-serif';
    ctx.fillText(sub, 512, 212);
  }
  drawBanana(ctx, 78, 130, 44, 0.4, '#f2ca35', 24);
  drawBanana(ctx, 946, 130, 44, -0.4, '#f2ca35', 24);
  return canvas;
}

function screenTexture(kind) {
  const { canvas, ctx } = makeCanvas(256, 160);
  ctx.fillStyle = '#04121e';
  ctx.fillRect(0, 0, 256, 160);
  ctx.strokeStyle = 'rgba(40,120,90,0.35)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= 256; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 160);
    ctx.stroke();
  }
  for (let y = 0; y <= 160; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  if (kind === 0) {
    ctx.strokeStyle = '#37e08c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 4) {
      const y = 90 - Math.sin(x * 0.08) * 26 - Math.sin(x * 0.021) * 14;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#37e08c';
    ctx.font = 'bold 20px monospace';
    ctx.fillText('LINE A -- OK', 12, 26);
  } else {
    ctx.fillStyle = '#ffb02e';
    for (let i = 0; i < 8; i++) {
      const h = 20 + ((i * 53) % 90);
      ctx.fillRect(14 + i * 30, 150 - h, 20, h);
    }
    ctx.font = 'bold 20px monospace';
    ctx.fillText('THROUGHPUT t/h', 12, 26);
  }
  return canvas;
}

function clockTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  ctx.fillStyle = '#22262a';
  ctx.beginPath();
  ctx.arc(128, 128, 126, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8e4da';
  ctx.beginPath();
  ctx.arc(128, 128, 112, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22262a';
  ctx.textAlign = 'center';
  ctx.font = 'bold 34px Arial, sans-serif';
  ctx.fillText('12', 128, 52);
  ctx.fillText('6', 128, 232);
  ctx.fillText('3', 216, 140);
  ctx.fillText('9', 40, 140);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillRect(128 + Math.cos(a) * 100 - 3, 128 + Math.sin(a) * 100 - 3, 6, 6);
  }
  return canvas;
}

function rollerDoorTexture() {
  const { canvas, ctx } = makeCanvas(256, 256);
  for (let y = 0; y < 256; y += 32) {
    const g = ctx.createLinearGradient(0, y, 0, y + 32);
    g.addColorStop(0, '#61686f');
    g.addColorStop(0.5, '#7b838b');
    g.addColorStop(1, '#4b5258');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, 256, 32);
    ctx.fillStyle = 'rgba(20,22,25,0.65)';
    ctx.fillRect(0, y + 29, 256, 3);
  }
  ctx.fillStyle = 'rgba(24,26,29,0.8)';
  ctx.font = 'bold 60px "Arial Black", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('DOCK 1', 128, 148);
  speckle(ctx, 256, 256, 220, ['#3c4247', '#868e96'], 2);
  return canvas;
}

// --------------------------- geometry helpers ------------------------------

/** Rotate (X, then Z, then Y) and translate a geometry in-place; returns it. */
function placed(geom, x, y, z, ry = 0, rx = 0, rz = 0) {
  if (rx) geom.rotateX(rx);
  if (rz) geom.rotateZ(rz);
  if (ry) geom.rotateY(ry);
  geom.translate(x, y, z);
  return geom;
}

function uvScale(geom, su, sv) {
  const uv = geom.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geom;
}

const HALF = 59;          // interior wall faces
const WALL_H = 16;        // roof underside
const CAT_Y = 4.0;        // catwalk / mezzanine deck top
const BELT_ELEV_Y = 3.5;  // elevated belt top

// Crate maze grid: '#' = double stack, '1' = single crate, 'p' = pallet.
const MAZE = [
  '##.###.1###.##',
  '#p...........1',
  '..1#.##.#1#..#',
  '#..#....#..#p#',
  '#.##.1#.#.##.#',
  '#....#p...1..#',
  '#.#1.#.##.##.1',
  '..#p.........#',
  '#.#.###.1#.#.#',
  '#.....p......#',
  '1#.#1.##.#.###',
  '..............'
];
const MAZE_X0 = -51;
const MAZE_Z0 = 12;
const MAZE_PITCH = 2.6;
const CRATE_S = 1.35;
const CRATE_H = 1.25;

export default class BananaFactoryMap extends MapBase {
  constructor() {
    super();
    this.id = 'BANANA_FACTORY';
    this.name = 'Banana Factory';
    this.environment = {
      skyColor: 0x2b2f33,
      fog: { color: 0x2b2f33, near: 35, far: 165 }
    };
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-62, -4, -62),
      new THREE.Vector3(62, 22, 62)
    );
    this.killY = -12;

    // runtime animation state
    this._belts = [];
    this._bunches = [];
    this._bananaMesh = null;
    this._fans = [];
    this._statueSpin = null;
    this._handMin = null;
    this._handHour = null;
    this._beacon = null;
    this._beaconMat = null;
    this._screenScrollTex = null;
    this._tmpM = new THREE.Matrix4();
    this._tmpM2 = new THREE.Matrix4();
    this._tmpV = new THREE.Vector3();
    this._bunchLocal = [];
    this._parts = new Map(); // material -> BufferGeometry[] (batched statics)
  }

  // --------------------------------------------------------------- batching

  _part(mat, geom) {
    if (!this._parts.has(mat)) this._parts.set(mat, []);
    this._parts.get(mat).push(geom);
  }

  /** Merge all batched geometries into one mesh per material. */
  _finalizeParts() {
    for (const [mat, list] of this._parts) {
      if (!list.length) continue;
      const mesh = new THREE.Mesh(mergeGeometries(list, false), mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      for (const g of list) g.dispose();
    }
    this._parts.clear();
  }

  /** AABB collider from center-x/z, bottom-y and dimensions. */
  _box(cx, y0, cz, w, h, d) {
    return this.addCollider(new THREE.Box3(
      new THREE.Vector3(cx - w / 2, y0, cz - d / 2),
      new THREE.Vector3(cx + w / 2, y0 + h, cz + d / 2)
    ));
  }

  // ------------------------------------------------------------------ build

  build() {
    this.group.name = 'BananaFactoryMap';
    this._makeMaterials();
    this._buildShell();
    this._buildLighting();
    this._buildLandmark();
    this._buildCatwalks();
    this._buildBelts();
    this._buildCrates();
    this._buildVats();
    this._buildMezzanine();
    this._buildDock();
    this._buildProps();
    this._buildBananas();
    this._finalizeParts();
    this._setSpawns();
  }

  _makeMaterials() {
    const M = THREE.MeshStandardMaterial;
    this._matFloor = new M({ map: makeTexture(concreteTexture(), 26, 26), roughness: 0.95, metalness: 0.05 });
    this._matWall = new M({ map: makeTexture(corrugatedTexture(), 30, 4), roughness: 0.8, metalness: 0.35 });
    this._matRoof = new M({ color: 0x24282d, roughness: 0.9, metalness: 0.2 });
    this._matSteel = new M({ color: 0x8a939c, roughness: 0.5, metalness: 0.6 });
    this._matSteelDark = new M({ color: 0x3c4248, roughness: 0.6, metalness: 0.55 });
    this._matPipe = new M({ color: 0x9aa4ad, roughness: 0.35, metalness: 0.8 });
    this._matYellow = new M({ color: 0xe0a81f, roughness: 0.55, metalness: 0.25 });
    this._matRubber = new M({ color: 0x232529, roughness: 0.95, metalness: 0.05 });
    this._matWood = new M({ map: makeTexture(palletTexture(), 1, 1), roughness: 0.9, metalness: 0 });
    this._matHazard = new M({ map: makeTexture(hazardTexture(), 1, 1), roughness: 0.7, metalness: 0.1 });
    this._matPlate = new M({ map: makeTexture(plateTexture(), 1, 1), roughness: 0.6, metalness: 0.5 });
    this._matCrate = new M({ map: makeTexture(crateTexture(), 1, 1), roughness: 0.85, metalness: 0 });
    this._matVat = new M({ map: makeTexture(vatTexture(), 2, 1), roughness: 0.5, metalness: 0.7 });
    this._matBanana = new M({ color: 0xf6c81f, roughness: 0.45, metalness: 0.05, emissive: 0x3a2c00, emissiveIntensity: 0.5 });
    this._matBananaProp = new M({ color: 0xffd23f, roughness: 0.6, metalness: 0 });
    this._matBrown = new M({ color: 0x5b3a17, roughness: 0.8, metalness: 0 });
    this._matGlass = new M({
      color: 0x9fd4e6, transparent: true, opacity: 0.22, roughness: 0.12,
      metalness: 0.1, side: THREE.DoubleSide, depthWrite: false
    });
    this._matGlow = new THREE.MeshBasicMaterial({ color: 0xff8c1a });
    this._matSkylight = new THREE.MeshBasicMaterial({ color: 0xdfe9f2 });
    this._matLane = new THREE.MeshBasicMaterial({
      color: 0xc0951a, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
    });
    this._beltCanvas = beltTexture();
  }

  // ------------------------------------------------------- shell & lighting

  _buildShell() {
    // floor (single big walkable collider)
    this.addSolidBox({
      width: 124, height: 1, depth: 124, x: 0, y: -1, z: 0,
      material: this._matFloor, castShadow: false
    });

    // perimeter walls (sealed)
    const wallOpts = { material: this._matWall, castShadow: false };
    this.addSolidBox({ width: 124, height: WALL_H, depth: 1, x: 0, y: 0, z: -HALF - 0.5, ...wallOpts });
    this.addSolidBox({ width: 124, height: WALL_H, depth: 1, x: 0, y: 0, z: HALF + 0.5, ...wallOpts });
    this.addSolidBox({ width: 1, height: WALL_H, depth: 124, x: -HALF - 0.5, y: 0, z: 0, ...wallOpts });
    this.addSolidBox({ width: 1, height: WALL_H, depth: 124, x: HALF + 0.5, y: 0, z: 0, ...wallOpts });

    // roof
    this.addSolidBox({
      width: 124, height: 0.6, depth: 124, x: 0, y: WALL_H, z: 0,
      material: this._matRoof, castShadow: false
    });

    // skylight strips (emissive, merged into one mesh)
    const skyGeoms = [];
    for (const z of [-36, -12, 12, 36]) {
      skyGeoms.push(placed(new THREE.PlaneGeometry(96, 5), 0, WALL_H - 0.28, z, 0, Math.PI / 2));
    }
    const sky = new THREE.Mesh(mergeGeometries(skyGeoms, false), this._matSkylight);
    this.group.add(sky);

    // roof beams (overhead decor)
    for (const z of [-48, -24, 0, 24, 48]) {
      this._part(this._matSteelDark, placed(new THREE.BoxGeometry(117, 0.55, 0.75), 0, 14.4, z));
    }

    // wall pillars + hazard-striped bases
    const pillars = [];
    for (const x of [-40, -20, 20, 40]) pillars.push([x, -58.2], [x, 58.2]);
    for (const z of [-40, 24, 44]) pillars.push([58.2, z]);
    for (const z of [-20, 4, 28, 48]) pillars.push([-58.2, z]);
    for (const [x, z] of pillars) {
      this._part(this._matSteelDark, placed(new THREE.BoxGeometry(1.2, 12, 1.2), x, 6, z));
      this._part(this._matHazard, uvScale(placed(new THREE.BoxGeometry(1.3, 0.9, 1.3), x, 0.45, z), 1, 0.5));
      this._box(x, 0, z, 1.3, 12, 1.3);
    }

    // hazard skirting along the wall bases (thin trim, no collider needed)
    this._part(this._matHazard, uvScale(placed(new THREE.BoxGeometry(117.6, 0.7, 0.12), 0, 0.35, -HALF + 0.06), 40, 0.35));
    this._part(this._matHazard, uvScale(placed(new THREE.BoxGeometry(117.6, 0.7, 0.12), 0, 0.35, HALF - 0.06), 40, 0.35));
    this._part(this._matHazard, uvScale(placed(new THREE.BoxGeometry(0.12, 0.7, 117.6), -HALF + 0.06, 0.35, 0), 40, 0.35));
    this._part(this._matHazard, uvScale(placed(new THREE.BoxGeometry(0.12, 0.7, 117.6), HALF - 0.06, 0.35, 0), 40, 0.35));

    // painted floor lanes + statue ring
    const laneGeoms = [
      placed(new THREE.PlaneGeometry(0.4, 45), 1.5, 0.02, 29.5, 0, -Math.PI / 2),
      placed(new THREE.PlaneGeometry(0.4, 45), 6.5, 0.02, 29.5, 0, -Math.PI / 2),
      placed(new THREE.PlaneGeometry(40, 0.4), -30, 0.02, 8, 0, -Math.PI / 2),
      placed(new THREE.PlaneGeometry(0.4, 56), 38, 0.02, -22, 0, -Math.PI / 2),
      placed(new THREE.RingGeometry(5.6, 6.1, 40), 0, 0.02, 0, 0, -Math.PI / 2)
    ];
    const lanes = new THREE.Mesh(mergeGeometries(laneGeoms, false), this._matLane);
    lanes.receiveShadow = false;
    this.group.add(lanes);

    // wall signage (emissive canvas planes)
    const addSign = (canvas, w, h, x, y, z, ry) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: makeTexture(canvas, 1, 1) })
      );
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      this.group.add(mesh);
    };
    addSign(signTexture('BANANA CO.', 'RIPE & READY SINCE 1962'), 30, 7.5, 0, 9.2, -HALF + 0.08, 0);
    addSign(signTexture('FRESH BANANAS', 'DAILY DISPATCH - LINE A'), 22, 5.5, HALF - 0.08, 8.5, 22, -Math.PI / 2);
    addSign(signTexture('LOADING DOCK', 'AUTHORIZED TRUCKS ONLY'), 11, 2.75, 18, 7.6, HALF - 0.08, Math.PI);
    addSign(rollerDoorTexture(), 8, 6.2, 18, 3.1, HALF - 0.1, Math.PI);

    // wall clock with animated hands (south wall, faces the hall)
    const clockGroup = new THREE.Group();
    clockGroup.position.set(-10, 8, HALF - 0.12);
    clockGroup.rotation.y = Math.PI;
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(1.25, 24),
      new THREE.MeshBasicMaterial({ map: makeTexture(clockTexture(), 1, 1) })
    );
    clockGroup.add(face);
    const handMat = new THREE.MeshBasicMaterial({ color: 0x22262a });
    this._handMin = new THREE.Mesh(placed(new THREE.BoxGeometry(0.09, 0.95, 0.03), 0, 0.42, 0), handMat);
    this._handMin.position.z = 0.03;
    this._handHour = new THREE.Mesh(placed(new THREE.BoxGeometry(0.11, 0.62, 0.03), 0, 0.27, 0), handMat);
    this._handHour.position.z = 0.05;
    clockGroup.add(this._handMin, this._handHour);
    this.group.add(clockGroup);
  }

  _buildLighting() {
    this.group.add(new THREE.HemisphereLight(0x9fb4c6, 0x35302a, 0.55));
    this.group.add(new THREE.AmbientLight(0x424a52, 0.5));

    // one shadow-casting directional "sun" slanting through the skylights
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sun.position.set(26, 14.6, -8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 80;
    sun.shadow.camera.bottom = -80;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0006;
    this.group.add(sun);
    this.group.add(sun.target);
    sun.target.position.set(0, 0, 0);

    // warm pools under the skylights + area accents
    const points = [
      [0xffc66b, 0, 10.5, 4, 55],    // over the statue
      [0xffc66b, -24, 12.5, 14, 60],
      [0xffc66b, 24, 12.5, -22, 60],
      [0xffd9a0, 6, 6.5, 52, 40],    // loading dock
      [0xbfffd2, 51, 7, -7, 26],     // control room
      [0xffb556, -41, 8.5, -40, 45]  // vat corner amber
    ];
    for (const [color, x, y, z, intensity] of points) {
      const p = new THREE.PointLight(color, intensity, 46, 1.8);
      p.position.set(x, y, z);
      this.group.add(p);
    }
  }

  // -------------------------------------------------------------- landmark

  _buildLandmark() {
    // tiered pedestal (0.75 risers, each jumpable)
    const tiers = [[5.2, 0], [4.2, 0.75], [3.2, 1.5]];
    for (const [r, y0] of tiers) {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.15, 0.75, 36), this._matSteelDark);
      mesh.position.set(0, y0 + 0.375, 0);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this._box(0, y0, 0, r * 2, 0.75, r * 2);
    }
    const band = new THREE.Mesh(new THREE.CylinderGeometry(5.28, 5.28, 0.42, 36, 1, true), this._matHazard);
    band.position.set(0, 0.32, 0);
    this.group.add(band);

    // mount column
    this._part(this._matSteel, placed(new THREE.CylinderGeometry(0.85, 1.05, 2.6, 14), 0, 3.55, 0));
    this._box(0, 2.25, 0, 1.9, 2.6, 1.9);

    // colossal rotating banana (visual only, lowest point well above heads)
    const spin = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.6, 8.4, 0),
      new THREE.Vector3(-3.5, 6.8, 0),
      new THREE.Vector3(0, 6.0, 0),
      new THREE.Vector3(3.5, 6.8, 0),
      new THREE.Vector3(4.6, 8.4, 0)
    ]);
    const banana = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 1.05, 12, false), this._matBanana);
    banana.castShadow = true;
    spin.add(banana);
    for (const s of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.05, 10, 8), this._matBanana);
      cap.position.set(s * 4.6, 8.4, 0);
      spin.add(cap);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 8), this._matBrown);
      tip.position.set(s * 5.15, 9.15, 0);
      tip.rotation.z = -s * 0.85;
      tip.castShadow = true;
      spin.add(tip);
    }
    this.group.add(spin);
    this._statueSpin = spin;
  }

  // -------------------------------------------------------------- catwalks

  _buildCatwalks() {
    const deckH = 0.3;
    const deck = (cx, cz, w, d, topY = CAT_Y) => {
      this._part(this._matPlate, uvScale(
        placed(new THREE.BoxGeometry(w, deckH, d), cx, topY - deckH / 2, cz),
        Math.max(w, d) / 1.4, Math.min(w, d) / 1.4
      ));
      this._box(cx, topY - deckH, cz, w, deckH, d);
    };

    deck(0, -57.7, 117.8, 2.4);              // north catwalk along the wall
    deck(57.7, -37.25, 2.4, 38.5);           // east catwalk down to the mezzanine
    deck(30.5, -55.55, 3, 1.9, BELT_ELEV_Y); // hop-down stub onto the elevated belt

    // support columns
    const cols = [];
    for (const x of [-48, -32, -16, 0, 16, 32, 48]) cols.push([x, -57.7]);
    for (const z of [-48, -34, -22]) cols.push([57.7, z]);
    for (const [x, z] of cols) {
      this._part(this._matSteel, placed(new THREE.BoxGeometry(0.5, CAT_Y - deckH, 0.5), x, (CAT_Y - deckH) / 2, z));
      this._box(x, 0, z, 0.5, CAT_Y - deckH, 0.5);
    }

    // guard rails (gaps: x < -56.4 = NW stair landing, x 28.8..32.2 = belt
    // stub, x > 56.4 = east catwalk junction)
    this._rail(-56.4, 28.8, -56.46, -56.46, CAT_Y);
    this._rail(32.2, 56.4, -56.46, -56.46, CAT_Y);
    this._rail(56.46, 56.46, -56.4, -18, CAT_Y);

    // duct boxes on the catwalk (hide-behind props)
    for (const x of [-32, 22]) {
      this.addSolidBox({
        width: 1.5, height: 1.4, depth: 1.2, x, y: CAT_Y, z: -58.2,
        material: this._matSteel
      });
    }

    // stairs: NW corner heading south, SE from the mezzanine heading south
    this._stairs(-57.7, -56.5, 0, 1, 2.4);
    this._stairs(50.2, 6, 0, 1, 2.4);
  }

  /** Guard-rail run between (x1,z1)-(x2,z2) on a deck whose top is `topY`. */
  _rail(x1, x2, z1, z2, topY) {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const ry = alongX ? 0 : Math.PI / 2;
    this._part(this._matYellow, placed(new THREE.BoxGeometry(len, 0.07, 0.07), cx, topY + 1.05, cz, ry));
    this._part(this._matYellow, placed(new THREE.BoxGeometry(len, 0.06, 0.06), cx, topY + 0.55, cz, ry));
    const posts = Math.max(2, Math.round(len / 2.4));
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      this._part(this._matYellow, placed(
        new THREE.BoxGeometry(0.07, 1.05, 0.07),
        x1 + (x2 - x1) * t, topY + 0.525, z1 + (z2 - z1) * t
      ));
    }
    if (alongX) this._box(cx, topY, cz, len, 1.15, 0.14);
    else this._box(cx, topY, cz, 0.14, 1.15, len);
  }

  /** Solid stepped staircase from a CAT_Y deck down to the floor (0.4 risers). */
  _stairs(cx, edgeZ, dirX, dirZ, width) {
    const tread = 0.55;
    for (let i = 0; i < 9; i++) {
      const top = 3.6 - i * 0.4;
      const px = cx + dirX * (i + 0.5) * tread;
      const pz = edgeZ + dirZ * (i + 0.5) * tread;
      const w = dirZ !== 0 ? width : tread;
      const d = dirZ !== 0 ? tread : width;
      this._part(this._matSteelDark, placed(new THREE.BoxGeometry(w, top, d), px, top / 2, pz));
      this._part(this._matYellow, placed(
        new THREE.BoxGeometry(dirZ !== 0 ? w : 0.06, 0.05, dirZ !== 0 ? 0.06 : d),
        px + dirX * (tread / 2 - 0.04), top + 0.02, pz + dirZ * (tread / 2 - 0.04)
      ));
      this._box(px, 0, pz, w, top, d);
    }
  }

  // ----------------------------------------------------------------- belts

  /**
   * Conveyor line: dark walkable frame + scrolling belt-top plane + banana
   * bunches riding along (instanced, repositioned in update). Axis-aligned.
   */
  _addBelt({ x1, z1, x2, z2, topY, width = 1.6, frameBottom = 0, bunches = 8, speed = 1.6 }) {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const cx = (x1 + x2) / 2;
    const cz = (z1 + z2) / 2;
    const frameH = topY - frameBottom;

    this.addSolidBox({
      width: alongX ? len : width, height: frameH, depth: alongX ? width : len,
      x: cx, y: frameBottom, z: cz, material: this._matSteelDark
    });
    // yellow trim rails on the frame edges
    const trimOff = width / 2 - 0.06;
    for (const s of [-1, 1]) {
      this._part(this._matYellow, placed(
        new THREE.BoxGeometry(alongX ? len : 0.12, 0.1, alongX ? 0.12 : len),
        cx + (alongX ? 0 : s * trimOff), topY + 0.02, cz + (alongX ? s * trimOff : 0)
      ));
    }

    const tex = makeTexture(this._beltCanvas, len / 1.6, 1);
    const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0.1 });
    const plane = new THREE.PlaneGeometry(len, width - 0.24);
    plane.rotateX(-Math.PI / 2);
    if (!alongX) plane.rotateY(Math.PI / 2);
    const top = new THREE.Mesh(plane, topMat);
    top.position.set(cx, topY + 0.015, cz);
    top.receiveShadow = true;
    this.group.add(top);

    const dx = alongX ? Math.sign(x2 - x1) : 0;
    const dz = alongX ? 0 : Math.sign(z2 - z1);
    const idx = this._belts.length;
    this._belts.push({
      sx: x1, sz: z1, dx, dz, len, topY, speed, tex,
      scrollSign: alongX ? dx : -dz,
      quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.atan2(dx, dz), 0))
    });
    for (let i = 0; i < bunches; i++) {
      this._bunches.push({ belt: idx, t0: (i + 0.35) * (len / bunches), first: -1 });
    }
  }

  _buildBelts() {
    // two long ground lines mid-hall (tops at 0.8, jump-on walkable)
    this._addBelt({ x1: -34, z1: -8, x2: 34, z2: -8, topY: 0.8, bunches: 9, speed: 1.7 });
    this._addBelt({ x1: 34, z1: -16, x2: -34, z2: -16, topY: 0.8, bunches: 9, speed: 1.4 });
    // cross line by the vats
    this._addBelt({ x1: -42, z1: 4, x2: -42, z2: -26, topY: 0.8, bunches: 5, speed: 1.2 });
    // elevated line along the north catwalk (walkable, reached via the stub)
    this._addBelt({
      x1: -44, z1: -53.9, x2: 34, z2: -53.9, topY: BELT_ELEV_Y,
      frameBottom: BELT_ELEV_Y - 0.6, bunches: 11, speed: 2.0
    });

    // legs under the elevated line
    for (const x of [-40, -26, -12, 2, 16, 30]) {
      this._part(this._matSteel, placed(
        new THREE.BoxGeometry(0.5, BELT_ELEV_Y - 0.6, 0.5), x, (BELT_ELEV_Y - 0.6) / 2, -53.9
      ));
      this._box(x, 0, -53.9, 0.5, BELT_ELEV_Y - 0.6, 0.5);
    }
    // hopper towers masking the elevated belt ends
    for (const x of [-44, 34]) {
      this.addSolidBox({ width: 2.6, height: 5.4, depth: 2.6, x, y: 0, z: -53.9, material: this._matSteel });
      this._part(this._matHazard, uvScale(placed(new THREE.BoxGeometry(2.7, 0.5, 2.7), x, 4.4, -53.9), 2, 0.3));
    }
    // end housings on the ground lines
    for (const z of [-8, -16]) {
      for (const x of [-34.9, 34.9]) {
        this.addSolidBox({ width: 2, height: 1.6, depth: 2.2, x, y: 0, z, material: this._matSteel });
      }
    }
    for (const z of [4.9, -26.9]) {
      this.addSolidBox({ width: 2.2, height: 1.6, depth: 2, x: -42, y: 0, z, material: this._matSteel });
    }
  }

  _buildBananas() {
    // per-banana local matrices within a bunch (fan of 5 bent ellipsoids)
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      this._bunchLocal.push(new THREE.Matrix4().compose(
        new THREE.Vector3(Math.cos(a) * 0.17, 0.14 + (k % 2) * 0.08, Math.sin(a) * 0.17),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.55, a, 0)),
        new THREE.Vector3(0.13, 0.13, 0.36)
      ));
    }

    // static piles: by the cross-belt outlet and on the dock pallet
    const staticPiles = [
      [-40.6, 0.1, -28.6], [-42.3, 0.1, -29.4], [-41.2, 0.1, -30.4],
      [-6, 0.3, 56.4], [-5.3, 0.3, 57]
    ];

    const total = (this._bunches.length + staticPiles.length) * 5;
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), this._matBananaProp, total);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;

    let i = 0;
    for (const bn of this._bunches) {
      bn.first = i;
      i += 5;
    }
    const m = this._tmpM;
    const one = new THREE.Vector3(1, 1, 1);
    for (const [px, py, pz] of staticPiles) {
      const base = this._tmpM2.compose(
        this._tmpV.set(px, py, pz),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, px * 2.3, 0)),
        one
      );
      for (let k = 0; k < 5; k++) {
        m.multiplyMatrices(base, this._bunchLocal[k]);
        mesh.setMatrixAt(i++, m);
      }
    }
    this.group.add(mesh);
    this._bananaMesh = mesh;
    this.update(0, 0); // place the riding bunches immediately
  }

  // ---------------------------------------------------------------- crates

  _buildCrates() {
    const crateMatrices = [];
    const palletMatrices = [];
    const tmpQ = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    const rots = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
    let seed = 0;

    const pushCrate = (x, y, z) => {
      tmpQ.setFromEuler(new THREE.Euler(0, rots[seed++ % 4], 0));
      const jx = (((seed * 7919) % 13) - 6) * 0.005;
      const jz = (((seed * 104729) % 13) - 6) * 0.005;
      crateMatrices.push(new THREE.Matrix4().compose(
        new THREE.Vector3(x + jx, y + CRATE_H / 2, z + jz), tmpQ, one
      ));
    };
    const pushStack = (x, z, levels) => {
      for (let l = 0; l < levels; l++) pushCrate(x, l * CRATE_H, z);
      this._box(x, 0, z, CRATE_S, levels * CRATE_H, CRATE_S);
    };
    const pushPallet = (x, z, layers = 1) => {
      for (let l = 0; l < layers; l++) {
        tmpQ.setFromEuler(new THREE.Euler(0, rots[seed++ % 4], 0));
        palletMatrices.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x, l * 0.35 + 0.175, z), tmpQ, one
        ));
      }
      this._box(x, 0, z, 1.7, layers * 0.35, 1.7);
    };

    // maze from the ASCII grid (south-west quadrant)
    for (let r = 0; r < MAZE.length; r++) {
      for (let c = 0; c < MAZE[r].length; c++) {
        const x = MAZE_X0 + c * MAZE_PITCH;
        const z = MAZE_Z0 + r * MAZE_PITCH;
        if (MAZE[r][c] === '#') pushStack(x, z, 2);
        else if (MAZE[r][c] === '1') pushStack(x, z, 1);
        else if (MAZE[r][c] === 'p') pushPallet(x, z, 1);
      }
    }

    // scattered stacks and pallets around the hall
    pushStack(26, 24, 2);
    pushStack(27.6, 22.5, 1);
    pushStack(-8, 22, 1);
    pushStack(-6.5, 23.6, 2);
    pushStack(44, 34, 2);
    pushStack(44, 36.7, 1);
    pushStack(12, -32, 1);
    pushStack(13.6, -33.4, 2);
    pushStack(-16, -28, 1);
    pushPallet(24.5, 25.8, 1);
    pushPallet(10.3, -32.6, 1);
    pushPallet(-6, 56.4, 1);       // dock pallet with a banana pile on it
    pushPallet(-53.5, 52, 3);      // SW corner pallet stacks
    pushPallet(-51, 54.5, 2);
    pushPallet(30, 48, 1);

    // crate hanging from a chain hoist (overhead)
    tmpQ.identity();
    crateMatrices.push(new THREE.Matrix4().compose(new THREE.Vector3(-6, 9.1, -12), tmpQ, one));
    this._box(-6, 8.475, -12, CRATE_S, CRATE_H, CRATE_S);

    const crates = new THREE.InstancedMesh(
      new THREE.BoxGeometry(CRATE_S, CRATE_H, CRATE_S), this._matCrate, crateMatrices.length
    );
    crateMatrices.forEach((mtx, i) => crates.setMatrixAt(i, mtx));
    crates.castShadow = true;
    crates.receiveShadow = true;
    this.group.add(crates);

    const pallets = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1.7, 0.35, 1.7), this._matWood, palletMatrices.length
    );
    palletMatrices.forEach((mtx, i) => pallets.setMatrixAt(i, mtx));
    pallets.castShadow = true;
    pallets.receiveShadow = true;
    this.group.add(pallets);
  }

  // ------------------------------------------------------------------ vats

  _buildVats() {
    const vats = [[-48, -46], [-48, -32], [-34, -46]];
    const vatGeoms = [];
    for (const [x, z] of vats) {
      vatGeoms.push(placed(new THREE.CylinderGeometry(3.2, 3.4, 5.5, 24), x, 2.75, z));
      this._box(x, 0, z, 6.4, 5.5, 6.4);
      // lid + hatch
      this._part(this._matSteel, placed(new THREE.CylinderGeometry(3.25, 3.25, 0.4, 24), x, 5.7, z));
      this._part(this._matSteelDark, placed(new THREE.CylinderGeometry(0.8, 0.8, 0.5, 12), x, 6.1, z));
      // riser pipe -> elbow -> run to the north wall (overhead, no colliders)
      this._part(this._matPipe, placed(new THREE.CylinderGeometry(0.28, 0.28, 6.2, 10), x, 9.1, z));
      this._part(this._matPipe, placed(
        new THREE.TorusGeometry(0.62, 0.28, 10, 12, Math.PI / 2),
        x, 12.82, z, Math.PI / 2, 0, -Math.PI / 2
      ));
      const runLen = (z - 0.62) + HALF;
      this._part(this._matPipe, placed(
        new THREE.CylinderGeometry(0.28, 0.28, runLen, 10),
        x, 12.82, (z - 0.62 - HALF) / 2, 0, Math.PI / 2
      ));
      // valve handwheel on the east face
      this._part(this._matYellow, placed(new THREE.TorusGeometry(0.42, 0.07, 8, 14), x + 3.35, 1.6, z, Math.PI / 2));
    }
    const vatMesh = new THREE.Mesh(mergeGeometries(vatGeoms, false), this._matVat);
    vatMesh.castShadow = true;
    vatMesh.receiveShadow = true;
    this.group.add(vatMesh);

    // maintenance ladder on the first vat (decor)
    for (let i = 0; i < 9; i++) {
      this._part(this._matSteelDark, placed(new THREE.BoxGeometry(0.7, 0.06, 0.06), -48, 0.6 + i * 0.55, -42.55));
    }
    for (const s of [-1, 1]) {
      this._part(this._matSteelDark, placed(new THREE.BoxGeometry(0.06, 5.2, 0.06), -48 + s * 0.38, 2.9, -42.55));
    }
  }

  // ------------------------------------------------------------- mezzanine

  _buildMezzanine() {
    // deck x 42..59, z -18..6, top at CAT_Y (meets the east catwalk at z=-18)
    this._part(this._matPlate, uvScale(placed(new THREE.BoxGeometry(17, 0.4, 24), 50.5, CAT_Y - 0.2, -6), 12, 18));
    this._box(50.5, CAT_Y - 0.4, -6, 17, 0.4, 24);

    // support columns
    for (const [x, z] of [[43, -17], [43, -6], [43, 5], [57, -17], [57, -6], [57, 5]]) {
      this._part(this._matSteel, placed(new THREE.BoxGeometry(0.5, CAT_Y - 0.4, 0.5), x, (CAT_Y - 0.4) / 2, z));
      this._box(x, 0, z, 0.5, CAT_Y - 0.4, 0.5);
    }

    // guard rails on the open edges (west gap = jump-down, south gap = stairs)
    this._rail(42, 42, -18, -9, CAT_Y);
    this._rail(42, 42, -6.8, 6, CAT_Y);
    this._rail(42, 49, 6, 6, CAT_Y);
    this._rail(51.4, 58.9, 6, 6, CAT_Y);

    // glass control room (x 44..59, z -13..2), door gap on the west face.
    // The strip z -18..-13 stays open so the east catwalk connects through.
    const glassGeoms = [];
    const frame = (cx, cz, w, d) => {
      this._part(this._matSteelDark, placed(
        new THREE.BoxGeometry(Math.max(w, 0.14), 0.16, Math.max(d, 0.14)), cx, CAT_Y + 2.5, cz
      ));
      this._part(this._matSteelDark, placed(
        new THREE.BoxGeometry(Math.max(w, 0.14), 0.14, Math.max(d, 0.14)), cx, CAT_Y + 0.07, cz
      ));
    };
    const glassWall = (cx, cz, w, d) => {
      glassGeoms.push(placed(new THREE.BoxGeometry(Math.max(w, 0.08), 2.5, Math.max(d, 0.08)), cx, CAT_Y + 1.25, cz));
      this._box(cx, CAT_Y, cz, Math.max(w, 0.16), 2.6, Math.max(d, 0.16));
      frame(cx, cz, w, d);
    };
    glassWall(44, -10.7, 0, 4.6);  // west face, north of the door
    glassWall(44, -2.6, 0, 9.2);   // west face, south of the door (gap z -8.4..-7.2)
    glassWall(51.5, 2, 15, 0);     // south face
    glassWall(51.5, -13, 15, 0);   // north face
    const glass = new THREE.Mesh(mergeGeometries(glassGeoms, false), this._matGlass);
    glass.castShadow = false;
    this.group.add(glass);
    for (const z of [-8.6, -7.0]) {
      this._part(this._matSteelDark, placed(new THREE.BoxGeometry(0.16, 2.64, 0.16), 44, CAT_Y + 1.32, z));
    }

    // console desk + emissive telemetry screens
    this.addSolidBox({ width: 1.1, height: 1.0, depth: 5.5, x: 57.2, y: CAT_Y, z: -9, material: this._matSteelDark });
    const screenA = new THREE.MeshBasicMaterial({ map: makeTexture(screenTexture(0), 1, 1) });
    this._screenScrollTex = screenA.map;
    const screenB = new THREE.MeshBasicMaterial({ map: makeTexture(screenTexture(1), 1, 1) });
    let flip = 0;
    for (const z of [-11, -9, -7]) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.85), flip++ % 2 ? screenB : screenA);
      s.position.set(57.05, CAT_Y + 1.45, z);
      s.rotation.y = -Math.PI / 2;
      s.rotation.x = -0.15;
      this.group.add(s);
    }
    // server racks (hide-behind) + stool
    this.addSolidBox({ width: 1.0, height: 2.2, depth: 0.9, x: 56.9, y: CAT_Y, z: -14.9, material: this._matRubber });
    this.addSolidBox({ width: 1.0, height: 2.2, depth: 0.9, x: 55.7, y: CAT_Y, z: -14.9, material: this._matRubber });
    this.addSolidBox({ width: 0.5, height: 0.45, depth: 0.5, x: 55.4, y: CAT_Y, z: -9, material: this._matYellow });

    // rotating amber beacon on the control-room corner
    this._part(this._matSteelDark, placed(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), 44, CAT_Y + 2.83, 2));
    this._beaconMat = new THREE.MeshBasicMaterial({ color: 0xffa41c });
    const beacon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.14), this._beaconMat);
    beacon.position.set(44, CAT_Y + 3.15, 2);
    this.group.add(beacon);
    this._beacon = beacon;

    // storage alcove below the mezzanine
    this.addSolidBox({ width: 1.2, height: 2.4, depth: 10, x: 58.2, y: 0, z: -8, material: this._matSteelDark });
    for (let i = 1; i < 3; i++) {
      this._part(this._matSteel, placed(new THREE.BoxGeometry(1.3, 0.06, 10), 58.2, i * 0.8, -8));
    }
  }

  // ------------------------------------------------------------------ dock

  _buildDock() {
    // raised dock platform (0.45 = auto-steppable) with hazard edge band
    this.addSolidBox({
      width: 12, height: 0.45, depth: 5.2, x: 4, y: 0, z: 56.5,
      material: this._matPlate
    });
    this._part(this._matHazard, uvScale(placed(new THREE.BoxGeometry(12, 0.46, 0.14), 4, 0.225, 53.84), 8, 0.3));

    // delivery truck: cab + cargo box + wheels
    const tx = 18;
    this._part(this._matYellow, placed(new THREE.BoxGeometry(2.4, 1.5, 2.3), tx, 0.85, 44.6));
    this._part(this._matYellow, placed(new THREE.BoxGeometry(2.4, 0.7, 0.9), tx, 0.85, 43.2));
    this._part(this._matSteelDark, placed(new THREE.BoxGeometry(2.2, 0.7, 0.1), tx, 1.55, 43.75));
    this._box(tx, 0, 44.3, 2.4, 2.4, 3.2);
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.5, 6.4), this._matSteel);
    cargo.position.set(tx, 2.1, 49.3);
    cargo.castShadow = true;
    cargo.receiveShadow = true;
    this.group.add(cargo);
    this._box(tx, 0.85, 49.3, 2.6, 2.5, 6.4);
    // banana livery on the cargo side facing the hall
    const livery = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 2.1),
      new THREE.MeshBasicMaterial({ map: makeTexture(signTexture('BANANA CO.', 'EXPRESS'), 1, 1) })
    );
    livery.position.set(tx - 1.32, 2.1, 49.3);
    livery.rotation.y = -Math.PI / 2;
    this.group.add(livery);
    for (const [wx, wz] of [[-1.1, 44.4], [1.1, 44.4], [-1.1, 47.6], [1.1, 47.6], [-1.1, 51.2], [1.1, 51.2]]) {
      this._part(this._matRubber, placed(
        new THREE.CylinderGeometry(0.45, 0.45, 0.35, 12), tx + wx, 0.45, wz, 0, 0, Math.PI / 2
      ));
    }

    // hazard bollards guarding the platform corners
    for (const [bx, bz] of [[-2.6, 53.4], [10.6, 53.4]]) {
      this._part(this._matHazard, uvScale(placed(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 8), bx, 0.55, bz), 1, 0.5));
      this._box(bx, 0, bz, 0.4, 1.1, 0.4);
    }
  }

  // ----------------------------------------------------------------- props

  /** Forklift prop built from batched boxes; ry must be a multiple of PI/2. */
  _forklift(x, z, ry) {
    const add = (mat, geom, lx, ly, lz) => {
      geom.translate(lx, ly, lz);
      geom.rotateY(ry);
      geom.translate(x, 0, z);
      this._part(mat, geom);
    };
    add(this._matYellow, new THREE.BoxGeometry(1.1, 0.85, 1.9), 0, 0.75, 0.1);
    add(this._matSteelDark, new THREE.BoxGeometry(1.1, 0.7, 0.7), 0, 0.65, 1.15);      // counterweight
    add(this._matSteelDark, new THREE.BoxGeometry(0.12, 2.7, 0.12), -0.4, 1.35, -1.05); // mast
    add(this._matSteelDark, new THREE.BoxGeometry(0.12, 2.7, 0.12), 0.4, 1.35, -1.05);
    add(this._matSteel, new THREE.BoxGeometry(0.95, 0.06, 1.05), 0, 0.16, -1.65);       // forks
    add(this._matSteelDark, new THREE.BoxGeometry(0.08, 1.6, 0.08), -0.45, 1.95, 0.75); // cage posts
    add(this._matSteelDark, new THREE.BoxGeometry(0.08, 1.6, 0.08), 0.45, 1.95, 0.75);
    add(this._matSteelDark, new THREE.BoxGeometry(0.08, 1.6, 0.08), -0.45, 1.95, -0.55);
    add(this._matSteelDark, new THREE.BoxGeometry(0.08, 1.6, 0.08), 0.45, 1.95, -0.55);
    add(this._matSteelDark, new THREE.BoxGeometry(1.15, 0.09, 1.55), 0, 2.75, 0.1);     // roof cage
    for (const [wx, wz] of [[-0.62, -0.7], [0.62, -0.7], [-0.62, 0.9], [0.62, 0.9]]) {
      add(this._matRubber, placed(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 10), 0, 0, 0, 0, 0, Math.PI / 2), wx, 0.32, wz);
    }
    add(this._matGlow, new THREE.SphereGeometry(0.09, 6, 5), 0, 2.86, 0.1);
    const swap = Math.abs(Math.sin(ry)) > 0.5;
    this._box(x, 0, z, swap ? 3.6 : 1.3, 2.85, swap ? 1.3 : 3.6);
  }

  _buildProps() {
    this._forklift(16, 24, Math.PI / 2);
    this._forklift(-14, 44, 0);

    // hanging chain hoists over the ground belts (overhead decor)
    for (const hx of [-20, -6, 8, 26]) {
      this._part(this._matSteelDark, placed(new THREE.CylinderGeometry(0.035, 0.035, 5.6, 6), hx, 13.1, -12));
      this._part(this._matSteelDark, placed(new THREE.BoxGeometry(0.55, 0.75, 0.55), hx, 9.95, -12));
      this._part(this._matSteel, placed(new THREE.TorusGeometry(0.2, 0.05, 8, 12), hx, 9.4, -12));
    }

    // yellow drums (instanced) tucked into corners and alcoves
    const barrelSpots = [
      [53, -53], [55, -51], [52.4, -50.6],
      [-28.5, -52.5], [-26.6, -51.4],
      [54, -13], [53, -11.6],
      [-3.4, 47], [-4.9, 48]
    ];
    const barrels = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), this._matYellow, barrelSpots.length
    );
    const q0 = new THREE.Quaternion();
    const one = new THREE.Vector3(1, 1, 1);
    barrelSpots.forEach(([bx, bz], i) => {
      barrels.setMatrixAt(i, this._tmpM.compose(this._tmpV.set(bx, 0.55, bz), q0, one));
      this._box(bx, 0, bz, 0.9, 1.1, 0.9);
    });
    barrels.castShadow = true;
    barrels.receiveShadow = true;
    this.group.add(barrels);

    // ceiling fans (rotate in update)
    const fanGeoms = [
      placed(new THREE.CylinderGeometry(0.09, 0.09, 1.8, 6), 0, 0.95, 0),
      placed(new THREE.CylinderGeometry(0.34, 0.4, 0.35, 10), 0, 0, 0)
    ];
    for (let k = 0; k < 4; k++) {
      const blade = new THREE.BoxGeometry(2.7, 0.05, 0.52);
      blade.translate(1.6, -0.1, 0);
      blade.rotateY((k / 4) * Math.PI * 2);
      fanGeoms.push(blade);
    }
    const fanGeo = mergeGeometries(fanGeoms, false);
    for (const [fx, fz] of [[-25, 26], [25, -26], [0, 44]]) {
      const fan = new THREE.Mesh(fanGeo, this._matSteelDark);
      fan.position.set(fx, 13.3, fz);
      fan.castShadow = true;
      this.group.add(fan);
      this._fans.push(fan);
    }
  }

  // ---------------------------------------------------------------- spawns

  _setSpawns() {
    const v = (x, y, z) => new THREE.Vector3(x, y, z);
    // police staging: loading dock platform + apron beside the truck
    this.policeSpawns = [
      v(0, 0.45, 56.2), v(4, 0.45, 56.2), v(8, 0.45, 56.2),
      v(2, 0, 51.5), v(7, 0, 51.5)
    ];
    const mazeCell = (c, r) => [MAZE_X0 + c * MAZE_PITCH, MAZE_Z0 + r * MAZE_PITCH];
    const [m1x, m1z] = mazeCell(5, 3);
    const [m2x, m2z] = mazeCell(11, 7);
    this.monkeySpawns = [
      v(m1x, 0, m1z),            // crate-maze pocket
      v(m2x, 0, m2z),            // crate-maze pocket
      v(-55.5, 0, -46),          // behind vat 1, against the west wall
      v(-41, 0, -39),            // pocket between the three vats
      v(0, CAT_Y, -57.7),        // north catwalk
      v(48, CAT_Y, -12),         // inside the glass control room
      v(-18, 0, -53.9),          // under the elevated belt
      v(2.3, 2.25, 0),           // on the statue pedestal top tier
      v(-14, 0, 41.3),           // behind the forklift by the maze
      v(49.5, 0, -54),           // NE corner behind the drums
      v(6, 0.8, -8),             // riding ground belt A
      v(52, 0, -8),              // storage alcove under the mezzanine
      v(-55.5, 0, 55.5)          // SW corner behind the pallet stacks
    ];
  }

  // ---------------------------------------------------------------- update

  update(dt, time) {
    // scrolling belt surfaces
    for (const b of this._belts) {
      b.tex.offset.x = (b.tex.offset.x - (b.scrollSign * b.speed * dt) / 1.6) % 1;
    }

    // banana bunches riding the belts (instanced, wrap at the hoppers)
    if (this._bananaMesh) {
      const m = this._tmpM;
      const base = this._tmpM2;
      const one = this._tmpV.set(1, 1, 1);
      for (const bn of this._bunches) {
        const b = this._belts[bn.belt];
        const t = (bn.t0 + time * b.speed) % b.len;
        base.compose(
          new THREE.Vector3(b.sx + b.dx * t, b.topY + 0.02, b.sz + b.dz * t),
          b.quat, one
        );
        for (let k = 0; k < 5; k++) {
          m.multiplyMatrices(base, this._bunchLocal[k]);
          this._bananaMesh.setMatrixAt(bn.first + k, m);
        }
      }
      this._bananaMesh.instanceMatrix.needsUpdate = true;
    }

    // ceiling fans
    for (let i = 0; i < this._fans.length; i++) {
      this._fans[i].rotation.y = time * (1.1 + i * 0.25);
    }

    // landmark banana slowly rotating on its pedestal
    if (this._statueSpin) this._statueSpin.rotation.y = time * 0.12;

    // wall clock hands
    if (this._handMin) {
      this._handMin.rotation.z = -time * 0.2;
      this._handHour.rotation.z = -time * (0.2 / 12);
    }

    // control room: scrolling telemetry + pulsing rotating beacon
    if (this._screenScrollTex) this._screenScrollTex.offset.x = (time * 0.07) % 1;
    if (this._beacon) {
      this._beacon.rotation.y = time * 3.2;
      const pulse = 0.55 + 0.45 * Math.sin(time * 6);
      this._beaconMat.color.setRGB(Math.min(1, pulse + 0.25), 0.55 * pulse + 0.1, 0.05);
    }
  }
}

export { BananaFactoryMap };
