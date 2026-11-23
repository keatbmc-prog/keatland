// The Catecholamine Works hall: architecture and machinery. Static structure is batched into a few
// vertex-coloured merged meshes (pipes, steelwork, rails, rollers) and instanced meshes (lamps,
// bottles, flanges), so the hall stays cheap to draw at every quality tier. Moving parts (the
// valve wheel, the gauge needle, the giant doors, the plates over the drain, the CJP button and
// valves, the monitors) are kept as separate objects and handed back to works.js / the director.
import { toonify } from '../../story/style/toon.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WL } from './layout.js';
import { factoryFloor, steelPlate, blockWall, corrugated, grating, treadPlate, screen, crt, gaugeFace, handText } from './paint.js';
import { signTexture, signPlane } from '../../story/paint.js';
import { columnMaterial, shaftMaterial } from './shaders.js';
import { dustMotes } from '../../story/reception.js';
import { mulberry32 } from '../../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, ...o });
const UP = V(0, 1, 0);
const KEEP = ['position', 'normal', 'uv', 'color'];

/** vertex-coloured merged geometry: one draw call for lots of steelwork */
class Batch {
  constructor() { this.list = []; }
  add(geo, m4, color) {
    const g = geo.clone(); g.applyMatrix4(m4);
    for (const k of Object.keys(g.attributes)) if (!KEEP.includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, c = new THREE.Color(color), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    this.list.push(g.index ? g.toNonIndexed() : g);
  }
  /** a box from a to b (its long axis), cross-section w x h */
  beam(a, b, w, h, color) {
    const d = b.clone().sub(a), L = d.length(); if (L < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    this.add(BOX, new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(w, L, h)), color);
  }
  /** a cylinder from a to b */
  rod(a, b, r, color, seg = 10) {
    const d = b.clone().sub(a), L = d.length(); if (L < 1e-4) return;
    const q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
    this.add(cylGeo(seg), new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, V(r, L, r)), color);
  }
  at(geo, p, s, color, q = new THREE.Quaternion()) { this.add(geo, new THREE.Matrix4().compose(p, q, typeof s === 'number' ? V(s, s, s) : s), color); }
  mesh(mat, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(mergeGeometries(this.list, false), mat); m.castShadow = cast; m.receiveShadow = receive; this.list = []; return m;
  }
}
const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYLS = {}; const cylGeo = (seg) => (CYLS[seg] ||= new THREE.CylinderGeometry(1, 1, 1, seg, 1, false));
const SPH = new THREE.SphereGeometry(1, 12, 8);
const TOR = new THREE.TorusGeometry(1, 0.08, 6, 28);

/** a wall face with rectangular openings, cut into a grid of cells, UVs in metres / tile */
function wallFace(len, H, holes, bands) {
  const us = new Set([0, len]), vs = new Set([0, H]);
  holes.forEach((h) => { us.add(h.u0); us.add(h.u1); vs.add(h.v0); vs.add(h.v1); });
  bands.forEach((b) => { vs.add(b.v0); vs.add(b.v1); });
  const U = [...us].sort((a, b) => a - b), Vv = [...vs].filter((v) => v >= 0 && v <= H).sort((a, b) => a - b);
  const out = bands.map(() => []);
  for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < Vv.length - 1; j++) {
    const u0 = U[i], u1 = U[i + 1], v0 = Vv[j], v1 = Vv[j + 1], cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    if (holes.some((h) => cu > h.u0 && cu < h.u1 && cv > h.v0 && cv < h.v1)) continue;
    const bi = bands.findIndex((b) => cv >= b.v0 && cv <= b.v1); if (bi < 0) continue;
    const b = bands[bi];
    const g = new THREE.PlaneGeometry(u1 - u0, v1 - v0); g.translate(cu, cv, 0);
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, p.getX(k) / b.tu, (p.getY(k) - b.v0) / b.tv);
    out[bi].push(g);
  }
  return out.map((l) => (l.length ? mergeGeometries(l, false) : null));
}

export function buildFactory({ root, quality, collision, WORKS }) {
  const rng = mulberry32(77);
  const D = quality.detail;
  const g = new THREE.Group(); g.name = 'works:hall'; root.add(g);
  const steel = new Batch(), pipes = new Batch(), rails = new Batch(), glow = new Batch();
  const batchMat = std({ vertexColors: true, roughness: 0.55, metalness: 0.55 });
  const pipeMat = std({ vertexColors: true, roughness: 0.42, metalness: 0.35 });
  const railMat = std({ vertexColors: true, roughness: 0.6, metalness: 0.6 });
  const glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const { hx, hz, roof } = WL;
  let bottlerObs = null, pullVatObs = null;

  // ---------------------------------------------------------------- floor (with the drain hole)
  const floorTex = factoryFloor(hx * 2, hz * 2, WL.drain);
  floorTex.repeat.set(1 / (hx * 2), 1 / (hz * 2)); floorTex.offset.set(0.5, 0.5);
  const shape = new THREE.Shape(); shape.moveTo(-hx, -hz); shape.lineTo(hx, -hz); shape.lineTo(hx, hz); shape.lineTo(-hx, hz); shape.closePath();
  const hole = new THREE.Path(); hole.absarc(WL.drain.x, -WL.drain.z, WL.plateR, 0, Math.PI * 2, true); shape.holes.push(hole);
  const fg = new THREE.ShapeGeometry(shape, 48); fg.rotateX(-Math.PI / 2);
  // ShapeGeometry uv = (x, y) with y = -z: v runs north (top of the canvas) to south
  const floorMat = std({ map: floorTex, roughness: 0.78, metalness: 0.05 });
  const floor = new THREE.Mesh(fg, floorMat); floor.receiveShadow = true; g.add(floor);
  // thick edge of the slab around the pit
  const pitWall = new THREE.Mesh(new THREE.CylinderGeometry(WL.plateR, WL.plateR, 1.6, 64, 1, true), std({ color: 0x55504a, roughness: 0.9, side: THREE.BackSide }));
  pitWall.position.set(WL.drain.x, -0.8, WL.drain.z); g.add(pitWall);

  // ---------------------------------------------------------------- walls
  const tBlock = blockWall(5); const tCor = corrugated(6);
  const matBlock = std({ map: tBlock, roughness: 0.9 }), matCor = std({ map: tCor, roughness: 0.6, metalness: 0.4, color: 0x9a9890 });
  const bands = [{ v0: 0, v1: 7, tu: 4, tv: 7 }, { v0: 7, v1: roof, tu: 3, tv: 6 }];
  const walls = [
    { o: V(-hx, 0, -hz), n: V(0, 0, 1), len: hx * 2, holes: [{ u0: WL.door.x + hx - 2.2, u1: WL.door.x + hx + 2.2, v0: 14, v1: 17.6 }] },
    { o: V(hx, 0, hz), n: V(0, 0, -1), len: hx * 2, holes: WL.windows.map((c) => ({ u0: hx - c - 3.5, u1: hx - c + 3.5, v0: 16.5, v1: 25 })) },
    { o: V(-hx, 0, hz), n: V(1, 0, 0), len: hz * 2, holes: [{ u0: hz - WL.bigDoors.z1, u1: hz - WL.bigDoors.z0, v0: 0, v1: WL.bigDoors.h }] },
    { o: V(hx, 0, -hz), n: V(-1, 0, 0), len: hz * 2, holes: [{ u0: WL.freedom.z + hz - 1.15, u1: WL.freedom.z + hz + 1.15, v0: 0, v1: 3.0 }] },
  ];
  for (const w of walls) {
    const right = UP.clone().cross(w.n); const basis = new THREE.Matrix4().makeBasis(right, UP, w.n).setPosition(w.o);
    const [lo, hi] = wallFace(w.len, roof + 1, w.holes, [bands[0], { ...bands[1], v1: roof + 1 }]);
    for (const [geo, mat] of [[lo, matBlock], [hi, matCor]]) { if (!geo) continue; geo.applyMatrix4(basis); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.castShadow = true; g.add(m); }
    // pilasters every 8 m + knee braces
    for (let u = 4; u < w.len - 1; u += 8) {
      if (w.holes.some((h) => u > h.u0 - 0.6 && u < h.u1 + 0.6)) continue;
      const p = w.o.clone().addScaledVector(right, u).addScaledVector(w.n, 0.3);
      steel.beam(p, p.clone().setY(roof - 4.5), 0.55, 0.45, 0x2c3034);
      steel.beam(p.clone().setY(roof - 8), p.clone().setY(roof - 4.5).addScaledVector(w.n, 3), 0.25, 0.25, 0x2c3034);
      // a band of rivet plate and grime at the foot
      steel.beam(p.clone().setY(0), p.clone().setY(0.6), 0.8, 0.7, 0x3a3631);
    }
    // wall collision
    const a = w.o.clone().addScaledVector(w.n, 0.3), b = a.clone().addScaledVector(right, w.len);
    collision.addWall({ x1: a.x + WORKS.x, z1: a.z + WORKS.z, x2: b.x + WORKS.x, z2: b.z + WORKS.z, r: 0.3 });
  }

  // windows: grimy glass glowing with the day outside, mullions
  const winTex = signTexture([''], { w: 256, h: 256, bg: '#fff4dc', fg: '#fff', weather: 0.9, seed: 9 });
  const winMat = new THREE.MeshBasicMaterial({ map: winTex, color: 0xffe6b8, toneMapped: false });
  for (const c of WL.windows) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(7, 8.5), winMat); m.position.set(c, 20.75, hz + 0.05); m.rotation.y = Math.PI; g.add(m);
    for (let i = 0; i <= 4; i++) steel.beam(V(c - 3.5 + i * 1.75, 16.5, hz - 0.05), V(c - 3.5 + i * 1.75, 25, hz - 0.05), 0.12, 0.1, 0x1e2124);
    for (let j = 0; j <= 3; j++) steel.beam(V(c - 3.5, 16.5 + j * 2.83, hz - 0.05), V(c + 3.5, 16.5 + j * 2.83, hz - 0.05), 0.1, 0.12, 0x1e2124);
    // broken panes: a few missing (darker)
  }
  // the door you came in through, high in the north wall: light from the Backrooms behind it
  { const m = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 3.6), new THREE.MeshBasicMaterial({ color: 0xfff0b0, toneMapped: false })); m.position.set(WL.door.x, 15.8, -hz - 0.6); g.add(m);
    const sideM = std({ color: 0x8a7a40 }); for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.1, 3.6, 0.6), sideM); b.position.set(WL.door.x + s * 2.2, 15.8, -hz - 0.3); g.add(b); }
    const lead = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.6, 0.08), std({ color: 0x5c5f62, metalness: 0.6, roughness: 0.4 })); lead.position.set(WL.door.x - 1.6, 15.3, -hz + 0.6); lead.rotation.y = -1.2; g.add(lead); }

  // ---------------------------------------------------------------- roof: trusses, purlins, deck
  const roofY = (x) => roof - 0.5 - Math.abs(x) / hx * 2.5;
  for (let z = -hz + 4; z < hz; z += 8) {
    const bot = (x) => V(x, roof - 5, z), top = (x) => V(x, roofY(x), z);
    steel.beam(bot(-hx), bot(hx), 0.3, 0.35, 0x24272a);
    steel.beam(top(-hx), top(0), 0.32, 0.35, 0x24272a); steel.beam(top(0), top(hx), 0.32, 0.35, 0x24272a);
    for (let x = -hx; x < hx; x += 4) { steel.beam(bot(x), top(x), 0.14, 0.14, 0x2a2e31); steel.beam(bot(x), top(x + 4), 0.12, 0.12, 0x2a2e31); }
  }
  for (let x = -hx; x <= hx; x += 4) steel.beam(V(x, roofY(x) + 0.25, -hz), V(x, roofY(x) + 0.25, hz), 0.18, 0.22, 0x1d2022);
  { const deckMat = std({ map: corrugated(12), color: 0x4a4440, roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide }); deckMat.map.repeat.set(10, 30);
    for (const s of [-1, 1]) { const pl = new THREE.Mesh(new THREE.PlaneGeometry(hx * 1.02, hz * 2), deckMat); pl.rotation.x = Math.PI / 2; pl.rotation.y = s * Math.atan(2.5 / hx); pl.position.set(s * hx / 2, roof - 0.5 - 1.25 + 0.45, 0); pl.castShadow = true; g.add(pl); }
    // a few skylights the dust has nearly closed
    const skyM = new THREE.MeshBasicMaterial({ color: 0x8c7a5a, toneMapped: false });
    for (let z = -32; z <= 32; z += 16) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 6), skyM); p.rotation.x = Math.PI / 2; p.position.set(-8, roofY(-8) + 0.1, z); g.add(p); const p2 = p.clone(); p2.position.x = 8; g.add(p2); } }

  // ---------------------------------------------------------------- ring catwalk at 9 m
  const gratTex = grating(); gratTex.repeat.set(1, 1);
  const gratMat = std({ map: gratTex, alphaTest: 0.5, metalness: 0.6, roughness: 0.55, side: THREE.DoubleSide, color: 0x8a8a84 });
  const cw = WL.catwalkY, inset = 0.35, wid = 2.0;
  const walk = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0); const geo = new THREE.PlaneGeometry(len, wid); geo.rotateX(-Math.PI / 2);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 1.0, uv.getY(i) * wid / 1.0);
    const m = new THREE.Mesh(geo, gratMat); m.position.set((x0 + x1) / 2, cw, (z0 + z1) / 2); m.rotation.y = -Math.atan2(z1 - z0, x1 - x0); m.castShadow = true; m.receiveShadow = true; g.add(m);
    // stringers, rails, posts, brackets
    const d = V(x1 - x0, 0, z1 - z0).normalize(), n = V(-d.z, 0, d.x);
    for (const s of [-1, 1]) steel.beam(V(x0, cw - 0.12, z0).addScaledVector(n, s * wid / 2), V(x1, cw - 0.12, z1).addScaledVector(n, s * wid / 2), 0.1, 0.22, 0x33373a);
    // which side faces the hall? the one pointing at the centre
    const mid = V((x0 + x1) / 2, 0, (z0 + z1) / 2); const inSide = n.dot(mid.clone().negate()) > 0 ? 1 : -1;
    const ra = (k) => V(x0, cw, z0).addScaledVector(d, k).addScaledVector(n, inSide * wid / 2);
    rails.beam(ra(0).setY(cw + 1.05), ra(len).setY(cw + 1.05), 0.06, 0.06, 0xc9a227);
    rails.beam(ra(0).setY(cw + 0.55), ra(len).setY(cw + 0.55), 0.04, 0.04, 0xc9a227);
    rails.beam(ra(0).setY(cw + 0.06), ra(len).setY(cw + 0.06), 0.02, 0.12, 0xc9a227);
    const step = D < 0.7 ? 2.4 : 1.5;
    for (let k = 0; k <= len; k += step) { const p = ra(k); rails.beam(p.clone().setY(cw), p.clone().setY(cw + 1.08), 0.05, 0.05, 0xc9a227); }
    for (let k = 1; k < len; k += 4) { const p = V(x0, cw, z0).addScaledVector(d, k).addScaledVector(n, -inSide * wid / 2); steel.beam(p.clone().setY(cw - 0.15), p.clone().setY(cw - 1.8).addScaledVector(n, inSide * 1.6), 0.1, 0.1, 0x33373a); }
  };
  const ix = hx - inset - wid / 2, iz = hz - inset - wid / 2;
  walk(-ix, -iz, ix, -iz); walk(ix, -iz + wid / 2, ix, iz - wid / 2); walk(ix, iz, -ix, iz); walk(-ix, iz - wid / 2, -ix, -iz + wid / 2);
  // the cross gantry over the floor (where the worker shouts from)
  walk(-ix + wid / 2, -12, ix - wid / 2, -12);
  for (const x of [-12, 0, 12]) steel.beam(V(x, cw - 0.2, -12), V(x, roof - 5, -12), 0.12, 0.12, 0x33373a);

  // ---------------------------------------------------------------- landing + spiral stair
  { const L = WL.landing; const pl = new THREE.Mesh(new THREE.BoxGeometry(L.x1 - L.x0, 0.2, L.z1 - L.z0 + 2.5), std({ map: treadPlate(), metalness: 0.7, roughness: 0.45 })); pl.material.map.repeat.set(6, 3); pl.position.set((L.x0 + L.x1) / 2, L.y - 0.1, (L.z0 + L.z1 + 2.5) / 2); pl.castShadow = pl.receiveShadow = true; g.add(pl);
    for (const x of [L.x0, L.x1]) { steel.beam(V(x, L.y - 0.2, L.z1 + 2.5), V(x, 0, L.z1 + 2.5), 0.2, 0.2, 0x2c3034); }
    rails.beam(V(L.x0, L.y + 1.05, L.z1 + 2.5), V(18.5, L.y + 1.05, L.z1 + 2.5), 0.06, 0.06, 0xc9a227);
    rails.beam(V(21.5, L.y + 1.05, L.z1 + 2.5), V(L.x1, L.y + 1.05, L.z1 + 2.5), 0.06, 0.06, 0xc9a227); }
  const ST = WL.stair, nSteps = Math.round(ST.turns * 24), rise = ST.y0 / nSteps;
  const stairPts = [];
  for (let i = 0; i <= nSteps; i++) {
    const a = ST.aTop - (i / nSteps) * ST.turns * Math.PI * 2, y = ST.y0 - i * rise;
    const c = ST.c; const q = new THREE.Quaternion().setFromAxisAngle(UP, -a);
    steel.at(BOX, V(c.x + Math.cos(a) * ST.r * 0.52, y - 0.04, c.z + Math.sin(a) * ST.r * 0.52), V(ST.r * 0.98, 0.07, 0.62), 0x4a4d50, q);
    const op = V(c.x + Math.cos(a) * ST.r, y, c.z + Math.sin(a) * ST.r);
    rails.beam(op, op.clone().setY(y + 1.0), 0.035, 0.035, 0xc9a227);
    stairPts.push(op.clone().setY(y + 1.0));
  }
  steel.rod(V(ST.c.x, 0, ST.c.z), V(ST.c.x, ST.y0 + 1, ST.c.z), 0.24, 0x3a3d40, 16);
  { const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stairPts), nSteps * 3, 0.04, 6, false); rails.add(tube, new THREE.Matrix4(), 0xc9a227); }
  collision.addObstacle({ x: ST.c.x + WORKS.x, z: ST.c.z + WORKS.z, r: ST.r + 0.25 });

  // ---------------------------------------------------------------- vats
  const vatTex = steelPlate(11, '#8d9193', { rust: 0.35, panel: 4 }); vatTex.repeat.set(6, 3);
  // the vats are alive: teal-glazed steel that slowly breathes, candy-pink domes
  const vatMat = toonify(std({ map: vatTex, color: 0x8fe8ff, metalness: 0.4, roughness: 0.3 }), { rim: 0xff6ad0, rimK: 0.5, wobble: 0.05, wobbleF: 0.9, breathe: 0.012 });
  const domeMat = toonify(std({ map: vatTex, color: 0xff8ad0, metalness: 0.4, roughness: 0.28 }), { rim: 0x9dff3a, rimK: 0.5, breathe: 0.012 });
  const LABELS = [['TYROSINE', 'LOCALLY SOURCED'], ['L-DOPA', 'TYROSINE HYDROXYLASE STAGE'], ['DOPAMINE', 'WANT'], ['NOREPINEPHRINE', 'VIGILANCE'], ['EPINEPHRINE', 'CARDIOVASCULAR CONSEQUENCES'], ['DOPAMINE β-HYDROXYLASE', 'CATALYST RESERVE']];
  const LCOL = ['#3f6e4a', '#2e4f7a', '#2e6a4a', '#9b1e14', '#a36a10', '#4a4a52'];
  const vats = [];
  WL.vats.forEach(([x, z, r, h], i) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40, 10, true), vatMat); body.position.set(x, h / 2 + 1.2, z); body.castShadow = body.receiveShadow = true; g.add(body); // (height rings so the vats can breathe)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat); dome.scale.y = 0.42; dome.position.set(x, h + 1.2, z); dome.castShadow = true; g.add(dome);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.3, 1.2, 40, 1, true), vatMat); cone.position.set(x, 0.6 + 0.0, z); g.add(cone);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.785; steel.beam(V(x + Math.cos(a) * r * 0.92, 0, z + Math.sin(a) * r * 0.92), V(x + Math.cos(a) * r * 0.98, 2.2, z + Math.sin(a) * r * 0.98), 0.3, 0.3, 0x2f3236); }
    { const band = new THREE.TorusGeometry(r * 1.01, 0.07, 6, 48); for (let k = 1; k < h; k += 2.6) steel.at(band, V(x, 1.2 + k, z), 1, 0x5a5e60, new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)); }
    // face the hall centre
    const ang = Math.atan2(-x, 2 - z), f = V(Math.sin(ang), 0, Math.cos(ang)), side = V(f.z, 0, -f.x);
    // ladder + cage
    const lb = V(x, 0, z).addScaledVector(f, r + 0.35).addScaledVector(side, r * 0.55);
    for (const s of [-0.25, 0.25]) rails.beam(lb.clone().addScaledVector(side, s), lb.clone().addScaledVector(side, s).setY(h + 1.6), 0.05, 0.05, 0x6b6f72);
    for (let y = 0.4; y < h + 1.4; y += 0.32) rails.beam(lb.clone().addScaledVector(side, -0.25).setY(y), lb.clone().addScaledVector(side, 0.25).setY(y), 0.03, 0.03, 0x6b6f72);
    // sight glass (liquid inside, glowing)
    const sg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h * 0.7, 10), columnMaterial(new THREE.Color(LCOL[i]).offsetHSL(0, 0.2, 0.25).getHex(), { fill: 0.55 + rng() * 0.35, height: h * 0.7 }));
    sg.position.copy(V(x, 1.2 + h * 0.45, z).addScaledVector(f, r + 0.12).addScaledVector(side, -r * 0.4)); g.add(sg);
    // stencilled label plate
    const tex = signTexture(LABELS[i], { w: 1024, h: 360, bg: '#d9d2bd', fg: LCOL[i], font: 'Oswald', weight: '700', sizes: [1, 0.42], weather: 0.7, seed: 30 + i, border: 10 });
    const lab = signPlane(tex, Math.min(5.2, r * 1.25), Math.min(5.2, r * 1.25) * 0.35, { roughness: 0.7 }); lab.position.copy(V(x, 1.2 + h * 0.62, z).addScaledVector(f, r + 0.03)); lab.lookAt(lab.position.clone().add(f)); g.add(lab);
    collision.addObstacle({ x: x + WORKS.x, z: z + WORKS.z, r: r + 0.45 });
    vats.push({ x, z, r, h, top: V(x, h + 1.2 + r * 0.42, z), label: LABELS[i][0] });
  });

  // ---------------------------------------------------------------- glass reaction columns
  const columnMats = [];
  const CC = [0xff8a1e, 0xd1281a, 0xffc24a, 0x7ad16a, 0xff5a1e, 0xffa040, 0xd1281a, 0xffd070];
  WL.columns.forEach(([x, z], i) => {
    const h = 9 + (i % 3) * 1.5, r = 0.75;
    const m = columnMaterial(CC[i % CC.length], { fill: 0.6 + rng() * 0.3, height: h }); columnMats.push(m);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true), m); c.position.set(x, 1.0 + h / 2, z); c.renderOrder = 3; g.add(c);
    steel.rod(V(x, 0, z), V(x, 1.0, z), r * 1.3, 0x2e3134, 20);
    steel.rod(V(x, 1.0 + h, z), V(x, 1.6 + h, z), r * 1.25, 0x2e3134, 20);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; rails.beam(V(x + Math.cos(a) * r * 1.12, 1.0, z + Math.sin(a) * r * 1.12), V(x + Math.cos(a) * r * 1.12, 1.0 + h, z + Math.sin(a) * r * 1.12), 0.04, 0.04, 0x4a4d50); }
    // a soft pool of light at the foot
    const pool = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), new THREE.MeshBasicMaterial({ color: CC[i % CC.length], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.02, z); g.add(pool);
    collision.addObstacle({ x: x + WORKS.x, z: z + WORKS.z, r: r * 1.4 + 0.2 });
  });

  // ---------------------------------------------------------------- pipe network
  const PC = [0x8a2f22, 0xc9a227, 0x3f6e4a, 0x9aa0a4, 0xd8d2c4, 0x2e4f7a, 0x7b4a2a];
  const flangeGeo = new THREE.CylinderGeometry(1, 1, 1, 14);
  const route = (pts, r, col) => {
    for (let i = 0; i < pts.length - 1; i++) {
      pipes.rod(pts[i], pts[i + 1], r, col, 12);
      const d = pts[i + 1].clone().sub(pts[i]), L = d.length(), q = new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize());
      for (let k = 1.2; k < L - 0.6; k += 3.2) pipes.at(flangeGeo, pts[i].clone().addScaledVector(d, k / L), V(r * 1.45, 0.09, r * 1.45), 0x2a2a28, q);
    }
    for (let i = 1; i < pts.length - 1; i++) pipes.at(SPH, pts[i], r * 1.18, col);
  };
  // from every vat dome up into the roof manifolds, across, and down to the line
  vats.forEach((v, i) => {
    const col = PC[i % PC.length], r = 0.28 + rng() * 0.12, hy = 19 + (i % 3) * 1.4;
    const tx = v.x > 0 ? 6 + i : -6 - i, tz = 26 - i * 0.6;
    route([v.top, v.top.clone().setY(hy), V(v.x, hy, tz), V(tx, hy, tz), V(tx, 4.6, tz), V(tx, 4.6, 27.6)], r, col);
    route([V(v.x + v.r * 0.6, v.h + 1.2 + v.r * 0.2, v.z), V(v.x + v.r * 0.6, roof - 5.6, v.z), V(v.x > 0 ? hx - 1 : -hx + 1, roof - 5.6, v.z)], 0.18, 0x9aa0a4);
  });
  // wall bundles: three runs around the hall at 5.2 / 5.8 / 6.4 m with brackets
  [5.2, 5.8, 6.4].forEach((y, k) => {
    const c = [0x8a2f22, 0xd8d2c4, 0x2e4f7a][k], o = 0.6 + k * 0.05;
    route([V(-hx + o, y, -hz + o), V(hx - o, y, -hz + o), V(hx - o, y, hz - o), V(-hx + o, y, hz - o), V(-hx + o, y, 10)], 0.13, c);
  });
  for (let u = -hz + 6; u < hz; u += 6) { for (const x of [-hx + 0.3, hx - 0.3]) steel.beam(V(x, 4.9, u), V(x + Math.sign(-x) * 0.9, 4.9, u), 0.08, 0.08, 0x2c3034); }
  // random vertical drops along the walls, valves on some
  const nDrops = Math.round(26 * D);
  for (let i = 0; i < nDrops; i++) {
    const side = Math.floor(rng() * 4), t = rng() * 0.9 + 0.05, col = PC[Math.floor(rng() * PC.length)], r = 0.08 + rng() * 0.12;
    const p = side === 0 ? V(-hx + 0.8 + t * hx * 2 * 0.96, 0, -hz + 0.9) : side === 1 ? V(hx - 0.9, 0, -hz + 0.8 + t * hz * 2 * 0.96) : side === 2 ? V(-hx + 0.8 + t * hx * 2 * 0.96, 0, hz - 0.9) : V(-hx + 0.9, 0, -hz + 0.8 + t * hz * 2 * 0.96);
    if (side === 3 && Math.abs(p.z) < 10) continue; if (side === 1 && Math.abs(p.z - WL.freedom.z) < 3) continue;
    route([p.clone().setY(0.0), p.clone().setY(roof - 6)], r, col);
    if (rng() < 0.5) { pipes.at(TOR, p.clone().setY(1.3 + rng()), V(r * 3.4, r * 3.4, r * 3.4), 0xb01e14, new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2)); }
  }
  // overhead crossings
  for (let i = 0; i < Math.round(10 * D); i++) {
    const z = -36 + rng() * 72, y = 15 + rng() * 6, col = PC[Math.floor(rng() * PC.length)];
    route([V(-hx + 0.6, y, z), V(hx - 0.6, y, z)], 0.14 + rng() * 0.16, col);
  }

  // ---------------------------------------------------------------- bottling line
  const CV = WL.conveyor, cvLen = CV.x1 - CV.x0;
  steel.beam(V(CV.x0, CV.y - 0.05, CV.z - 0.55), V(CV.x1, CV.y - 0.05, CV.z - 0.55), 0.08, 0.28, 0x3a5a6a);
  steel.beam(V(CV.x0, CV.y - 0.05, CV.z + 0.55), V(CV.x1, CV.y - 0.05, CV.z + 0.55), 0.08, 0.28, 0x3a5a6a);
  for (let x = CV.x0 + 0.5; x < CV.x1; x += 2.5) for (const s of [-0.5, 0.5]) steel.beam(V(x, 0, CV.z + s), V(x, CV.y - 0.15, CV.z + s), 0.08, 0.08, 0x2c3a44);
  for (let x = CV.x0; x <= CV.x1; x += D < 0.7 ? 0.5 : 0.25) steel.at(cylGeo(8), V(x, CV.y - 0.08, CV.z), V(0.05, 1.04, 0.05), 0x9aa0a4, new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
  const beltTex = canvasStripe(); beltTex.repeat.set(cvLen / 0.6, 1);
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(cvLen, 1.0), std({ map: beltTex, roughness: 0.85, color: 0x555048 })); belt.rotation.x = -Math.PI / 2; belt.position.set((CV.x0 + CV.x1) / 2, CV.y - 0.01, CV.z); belt.receiveShadow = true; g.add(belt);
  collision.addWall({ x1: CV.x0 + WORKS.x, z1: CV.z + WORKS.z, x2: CV.x1 + WORKS.x, z2: CV.z + WORKS.z, r: 0.7 });
  // bottles: amber glass, label colour by stage
  const nB = Math.round(cvLen / 0.55);
  const bottleGeo = new THREE.LatheGeometry([[0, 0], [0.07, 0], [0.075, 0.02], [0.075, 0.17], [0.06, 0.21], [0.025, 0.25], [0.022, 0.3], [0.026, 0.31], [0, 0.31]].map(([x, y]) => new THREE.Vector2(x, y)), 12);
  const bottles = new THREE.InstancedMesh(bottleGeo, std({ color: 0x6a2e08, roughness: 0.12, metalness: 0.0, emissive: 0x3a1004, emissiveIntensity: 0.4, transparent: true, opacity: 0.92 }), nB);
  const labels = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.078, 0.078, 0.08, 12, 1, true), std({ color: 0xffffff, roughness: 0.7 }), nB);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8), std({ color: 0xd8d2c4, metalness: 0.7, roughness: 0.3 }), nB);
  const LC = [new THREE.Color(0x4fa36a), new THREE.Color(0xc0291c), new THREE.Color(0xe0b020)];
  for (let i = 0; i < nB; i++) labels.setColorAt(i, LC[i % 3]);
  bottles.castShadow = true; g.add(bottles, labels, caps);
  const bottleState = { off: 0, speed: 0.55 };
  const dummy = new THREE.Object3D();
  function updateBottles(dt) {
    bottleState.off = (bottleState.off + dt * bottleState.speed) % cvLen;
    for (let i = 0; i < nB; i++) {
      const x = CV.x0 + ((i * 0.55 + bottleState.off) % cvLen);
      dummy.position.set(x, CV.y, CV.z + Math.sin(i * 1.7) * 0.18); dummy.rotation.set(0, i, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      bottles.setMatrixAt(i, dummy.matrix);
      dummy.position.y = CV.y + 0.1; dummy.updateMatrix(); labels.setMatrixAt(i, dummy.matrix);
      dummy.position.y = CV.y + 0.325; dummy.updateMatrix(); caps.setMatrixAt(i, dummy.matrix);
    }
    bottles.instanceMatrix.needsUpdate = labels.instanceMatrix.needsUpdate = caps.instanceMatrix.needsUpdate = true;
  }
  updateBottles(0);
  // the machines at both ends, the bottler housing, hoppers, control panels with lit buttons
  const machMat = std({ map: steelPlate(21, '#3f5f6e', { rust: 0.4, panel: 2 }), metalness: 0.55, roughness: 0.5 });
  const machine = (x, z, w, h, d, name) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), machMat); m.position.set(x, h / 2, z); m.castShadow = m.receiveShadow = true; g.add(m);
    steel.rod(V(x - w * 0.2, h, z), V(x - w * 0.2, h + 1.0, z), 0.45, 0x8d9193, 18);
    steel.at(new THREE.ConeGeometry(1, 1, 18), V(x - w * 0.2, h + 1.6, z), V(0.9, 1.2, 0.9), 0x8d9193, new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI));
    const t = signTexture([name], { w: 512, h: 128, bg: '#c9a227', fg: '#1c1a16', font: 'Oswald', weight: '700', weather: 0.5, seed: x | 0 });
    const s = signPlane(t, 2.2, 0.55); s.position.set(x, h - 0.5, z - d / 2 - 0.01); s.rotation.y = Math.PI; g.add(s);
    for (let k = 0; k < 8; k++) glow.at(SPH, V(x - w * 0.35 + (k % 4) * 0.22, 1.3 + Math.floor(k / 4) * 0.22, z - d / 2 - 0.02), 0.05, [0xff3010, 0x30ff60, 0xffc020][k % 3]);
    collision.addObstacle({ x: x + WORKS.x, z: z + WORKS.z, r: Math.max(w, d) * 0.55 });
  };
  machine(CV.x0 - 2.6, CV.z, 4.8, 3.4, 3.6, 'FILLER 1'); machine(CV.x1 + 2.6, CV.z, 4.8, 3.4, 3.6, 'CAPPER 2');
  // the bottler housing (Moss gets washed onto this)
  { const B = WL.bottler; const m = new THREE.Mesh(new THREE.BoxGeometry(3.2, WL.bottlerTop, 2.4), machMat); m.position.set(B.x, WL.bottlerTop / 2, B.z); m.castShadow = m.receiveShadow = true; g.add(m);
    const top = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.06, 2.5), std({ map: treadPlate(), metalness: 0.7, roughness: 0.45 })); top.position.set(B.x, WL.bottlerTop + 0.03, B.z); top.receiveShadow = true; g.add(top);
    collision.addGround((x, z) => { const lx = x - WORKS.x - B.x, lz = z - WORKS.z - B.z; return Math.abs(lx) < 1.6 && Math.abs(lz) < 1.2 ? WORKS.y + WL.bottlerTop + 0.06 : null; });
    bottlerObs = collision.addObstacle({ x: B.x + WORKS.x, z: B.z + WORKS.z, r: 1.4 }); }
  // the stainless dopamine pipe right above it
  const dopa = [V(CV.x0 - 1.0, WL.dopaPipeY, 23.4), V(-4, WL.dopaPipeY, 23.4), V(-4, 21, 23.4)];
  route(dopa, 0.22, 0xc8ccce);
  for (let x = -17; x < -4; x += 4.2) { const t = signTexture(['DOPAMINE  ▶'], { w: 512, h: 96, bg: '#2e6a4a', fg: '#f2eedc', font: 'Oswald', weight: '700', weather: 0.3, seed: 60 + x }); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.5, 20, 1, true, Math.PI * 0.5, Math.PI), std({ map: t, roughness: 0.6 })); s.rotation.z = Math.PI / 2; s.position.set(x, WL.dopaPipeY, 23.4); g.add(s); }
  // stage boards over the line: the bottle copy, which is the whole philosophy
  const BOARDS = [[-10, ['DOPAMINE', '“Want.”'], '#2e6a4a'], [0, ['NOREPINEPHRINE', '“PAY ATTENTION TO THAT FUCKING THING.”'], '#9b1e14'], [10, ['EPINEPHRINE', '“THE FUCKING THING IS NOW CHASING YOU.”'], '#a36a10']];
  for (const [x, lines, bg] of BOARDS) {
    const t = signTexture(lines, { w: 1024, h: 384, bg, fg: '#f4ecd6', font: 'Oswald', weight: '700', sizes: [1, 0.5], weather: 0.5, seed: 70 + x, border: 12, borderColor: '#f4ecd6' });
    for (const ry of [0, Math.PI]) { const s = signPlane(t, 6.2, 2.3, { emissive: 0.25 }); s.position.set(x, 4.8, CV.z + (ry ? 0.04 : -0.04)); s.rotation.y = ry ? 0 : Math.PI; g.add(s); }
    for (const dx of [-2.8, 2.8]) steel.rod(V(x + dx, 6.0, CV.z), V(x + dx, roof - 5, CV.z), 0.02, 0x2a2a28, 6);
  }

  // ---------------------------------------------------------------- NOREPINEPHRINE pipe, valve, gauge
  const NP = WL.norPipe;
  route([V(NP.x, 0, NP.z), V(NP.x, 22, NP.z)], 0.32, 0xb01e14);
  route([V(NP.x, 3.6, NP.z), V(NP.x, 3.6, CV.z), V(CV.x1 + 1.0, 3.6, CV.z)], 0.2, 0xb01e14);
  steel.at(SPH, V(NP.x, 1.25, NP.z), V(0.5, 0.42, 0.5), 0x7a1a12);
  steel.rod(V(NP.x, 1.25, NP.z), V(NP.x, 1.25, NP.z - 0.62), 0.07, 0x55504a, 10);
  const wheel = new THREE.Group(); wheel.position.set(NP.x, 1.25, NP.z - 0.64); g.add(wheel);
  { const wm = std({ color: 0xc0281a, roughness: 0.45, metalness: 0.4 }); const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.045, 10, 36), wm); rim.castShadow = true; wheel.add(rim);
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.42, 6), wm); const a = k / 5 * Math.PI * 2; sp.position.set(Math.cos(a) * 0.21, Math.sin(a) * 0.21, 0); sp.rotation.z = a - Math.PI / 2; wheel.add(sp); }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.1, 12), wm); hub.rotation.x = Math.PI / 2; wheel.add(hub); }
  const gauge = new THREE.Group(); gauge.position.set(NP.x + 0.75, 2.25, NP.z - 0.25); g.add(gauge);
  steel.rod(V(NP.x, 2.25, NP.z), V(NP.x + 0.75, 2.25, NP.z), 0.05, 0x55504a, 8);
  { const face = new THREE.Mesh(new THREE.CircleGeometry(0.36, 40), std({ map: gaugeFace(), roughness: 0.5, emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0 })); face.rotation.y = Math.PI; gauge.add(face);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.035, 8, 40), std({ color: 0xb8b2a0, metalness: 0.9, roughness: 0.25 })); gauge.add(bez);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.12, 32), std({ color: 0x2a2826, metalness: 0.6 })); back.rotation.x = Math.PI / 2; back.position.z = 0.07; gauge.add(back); }
  const needleHolder = new THREE.Group(); needleHolder.rotation.y = Math.PI; gauge.add(needleHolder);
  const needle = new THREE.Group(); needle.position.z = 0.012; needleHolder.add(needle);
  { const n = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.3, 0.008), std({ color: 0x111111 })); n.position.y = 0.13; needle.add(n); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), std({ color: 0x111111 })); c.rotation.x = Math.PI / 2; needle.add(c); }
  const setGauge = (f) => { // f 0..1 along the dial (0 = NORMAL start, 1 = the unlabeled red)
    const a = Math.PI * 0.75 + f * Math.PI * 1.5; // canvas angle, y down; face is mirrored by rotation.y = PI
    needle.rotation.z = -a - Math.PI / 2; // canvas angles run clockwise (y down); the needle mesh points +y
  };
  setGauge(0.1);
  { const t = signTexture(['NOREPINEPHRINE:', 'EMERGENCY DISTRIBUTION ONLY'], { w: 1024, h: 300, bg: '#efe8d6', fg: '#b01e14', font: 'Oswald', weight: '700', sizes: [1, 0.72], weather: 0.5, seed: 81, border: 10 }); const s = signPlane(t, 1.9, 0.56); s.position.set(NP.x, 3.0, NP.z - 0.34); s.rotation.y = Math.PI; g.add(s); }
  collision.addObstacle({ x: NP.x + WORKS.x, z: NP.z + WORKS.z, r: 0.55 });

  // ---------------------------------------------------------------- the giant doors (west)
  const BD = WL.bigDoors;
  const doorTex = steelPlate(31, '#4d4a44', { rust: 0.9, panel: 3 }); doorTex.repeat.set(2, 4);
  const doorMat = std({ map: doorTex, metalness: 0.6, roughness: 0.55 });
  const leaves = [];
  for (const s of [-1, 1]) {
    const hinge = new THREE.Group(); hinge.position.set(-hx + 0.25, 0, s < 0 ? BD.z0 : BD.z1); g.add(hinge);
    const w = (BD.z1 - BD.z0) / 2;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.35, BD.h, w), doorMat); leaf.position.set(0, BD.h / 2, -s * w / 2); leaf.castShadow = leaf.receiveShadow = true; hinge.add(leaf);
    const bm = std({ color: 0x2c2a26, metalness: 0.6, roughness: 0.5 });
    for (const y of [1.5, BD.h / 2, BD.h - 1.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, w), bm); b.position.set(0.25, y, -s * w / 2); hinge.add(b); }
    const diag = new THREE.Mesh(new THREE.BoxGeometry(0.18, Math.hypot(BD.h - 3, w), 0.35), bm); diag.position.set(0.26, BD.h / 2, -s * w / 2); diag.rotation.x = s * Math.atan2(w, BD.h - 3); hinge.add(diag);
    const t = signTexture(['INTAKE'], { w: 512, h: 160, bg: '#c9a227', fg: '#1c1a16', font: 'Oswald', weight: '700', weather: 0.7, seed: 90 + s }); const sg = signPlane(t, 3, 0.95); sg.position.set(0.37, 5, -s * w / 2); sg.rotation.y = Math.PI / 2; hinge.add(sg);
    leaves.push({ hinge, s, open: 0 });
  }
  const doorWall = collision.addWall({ x1: -hx + 0.3 + WORKS.x, z1: BD.z0 + WORKS.z, x2: -hx + 0.3 + WORKS.x, z2: BD.z1 + WORKS.z, r: 0.35 });
  // the intake tunnel beyond, dark, where the tide comes from
  { const tun = new THREE.Mesh(new THREE.BoxGeometry(22, BD.h + 2, BD.z1 - BD.z0 + 2), std({ map: (() => { const t = blockWall(15); t.repeat.set(5, 2); return t; })(), side: THREE.BackSide, color: 0x6a645c })); tun.position.set(-hx - 11, BD.h / 2 + 1, 0); tun.receiveShadow = true; g.add(tun);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), new THREE.MeshBasicMaterial({ color: 0x3a2410, toneMapped: false })); far.position.set(-hx - 21.9, 4, 0); far.rotation.y = Math.PI / 2; g.add(far); }

  // ---------------------------------------------------------------- FREEDOMLAND, lit over a door (east)
  const FR = WL.freedom;
  { const frame = std({ color: 0x3a3631, metalness: 0.5, roughness: 0.5 });
    steel.beam(V(hx - 0.25, 0, FR.z - 1.2), V(hx - 0.25, 3.1, FR.z - 1.2), 0.25, 0.2, 0x3a3631); steel.beam(V(hx - 0.25, 0, FR.z + 1.2), V(hx - 0.25, 3.1, FR.z + 1.2), 0.25, 0.2, 0x3a3631); steel.beam(V(hx - 0.25, 3.1, FR.z - 1.3), V(hx - 0.25, 3.1, FR.z + 1.3), 0.25, 0.25, 0x3a3631);
    void frame;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 2.3), std({ color: 0xd8cfb6, roughness: 0.6 })); door.position.set(hx + 0.02, 1.5, FR.z); g.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), std({ color: 0xc9a24a, metalness: 0.9, roughness: 0.3 })); knob.position.set(hx - 0.06, 1.05, FR.z + 0.85); g.add(knob);
    const t = signTexture(['FREEDOMLAND'], { w: 1024, h: 220, bg: '#efe3c4', fg: '#a3261c', font: 'Rye', weather: 0.4, seed: 95, border: 10 });
    const s = signPlane(t, 5.2, 1.1, { emissive: 0.9 }); s.position.set(hx - 0.2, 4.0, FR.z); s.rotation.y = -Math.PI / 2; g.add(s);
    for (let k = 0; k < 10; k++) glow.at(SPH, V(hx - 0.25, 4.0 + (k < 5 ? 0.68 : -0.68), FR.z - 2.4 + (k % 5) * 1.2), 0.07, 0xffe0a0); }
  const freedomLight = new THREE.PointLight(0xffc890, 6, 14, 1.8); freedomLight.position.set(hx - 2.2, 4.2, FR.z); g.add(freedomLight);
  // the barricade (built by the tide)
  const barricade = new THREE.Group(); barricade.position.set(hx - 2.0, 0, FR.z); g.add(barricade);
  { const wood = std({ color: 0x7a5634, roughness: 0.85 }), pvc = std({ color: 0xe8e6e0, roughness: 0.5 }), card = std({ color: 0xa98a5e, roughness: 0.9 });
    for (let k = 0; k < 22; k++) { const m = new THREE.Mesh(k % 3 === 0 ? new THREE.CylinderGeometry(0.05, 0.05, 2.4 + rng() * 2, 8) : new THREE.BoxGeometry(0.1 + rng() * 0.3, 0.08 + rng() * 0.6, 1.8 + rng() * 2.4), k % 3 === 0 ? pvc : k % 4 === 0 ? card : wood); m.position.set((rng() - 0.5) * 1.6, 0.2 + rng() * 2.2, (rng() - 0.5) * 2.4); m.rotation.set((rng() - 0.5) * 1.4, rng() * 3, (rng() - 0.5) * 1.4); m.castShadow = true; barricade.add(m); } }
  barricade.visible = false;

  // ---------------------------------------------------------------- the drain: grate, plug, chain, plates
  const DR = WL.drain;
  const plates = [];
  const plateMat = std({ map: (() => { const t = treadPlate(17); t.repeat.set(0.5, 0.5); return t; })(), metalness: 0.75, roughness: 0.42, color: 0xb0b0a8 });
  for (let k = 0; k < 8; k++) {
    const a0 = k / 8 * Math.PI * 2 + 0.012, a1 = (k + 1) / 8 * Math.PI * 2 - 0.012;
    const sh = new THREE.Shape(); sh.absarc(0, 0, WL.plateR - 0.05, a0, a1, false); sh.absarc(0, 0, 1.5, a1, a0, true);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.22, bevelEnabled: false, curveSegments: 10 }); geo.rotateX(Math.PI / 2); // shape y -> -z? (rotateX +90: y -> z)
    const m = new THREE.Mesh(geo, plateMat); m.position.set(DR.x, 0.0, DR.z); m.castShadow = m.receiveShadow = true; g.add(m);
    const mid = (a0 + a1) / 2; plates.push({ m, dir: V(Math.cos(mid), 0, Math.sin(mid)), open: 0 });
  }
  // seams and bolts on the plates (hazard edge)
  const ringM = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.52, 48), std({ color: 0x2a2826, metalness: 0.8 })); ringM.rotation.x = -Math.PI / 2; ringM.position.set(DR.x, 0.015, DR.z); g.add(ringM);
  const grate = new THREE.Mesh(new THREE.CircleGeometry(1.5, 40), std({ map: (() => { const t = grating(); t.repeat.set(3, 3); return t; })(), alphaTest: 0.5, metalness: 0.7, roughness: 0.5, side: THREE.DoubleSide })); grate.rotation.x = -Math.PI / 2; grate.position.set(DR.x, -0.03, DR.z); g.add(grate);
  const throat = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 5, 32, 1, true), std({ color: 0x0e0c0a, side: THREE.BackSide })); throat.position.set(DR.x, -2.5, DR.z); g.add(throat);
  // the plug (as wide as a tractor tire)
  const plug = new THREE.Group(); plug.position.set(DR.x, 0.0, DR.z); g.add(plug);
  { const rub = new THREE.Mesh(new THREE.CylinderGeometry(1.32, 1.22, 0.42, 40), std({ color: 0x1b1a19, roughness: 0.7 })); rub.position.y = 0.05; rub.castShadow = true; plug.add(rub);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 32), std({ color: 0x8d9193, metalness: 0.85, roughness: 0.35 })); cap.position.y = 0.3; plug.add(cap);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 8, 20), cap.material); eye.position.y = 0.5; plug.add(eye);
    for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 6), cap.material); b.position.set(Math.cos(k / 8 * 6.283) * 0.7, 0.35, Math.sin(k / 8 * 6.283) * 0.7); plug.add(b); } }
  const plugEye = () => plug.localToWorld(V(0, 0.5, 0));
  // chain: links along a sagging curve from the plug eye to wherever it is being hauled from
  const nLinks = 60;
  const chain = new THREE.InstancedMesh(new THREE.TorusGeometry(0.07, 0.022, 6, 12), std({ color: 0x5a5550, metalness: 0.85, roughness: 0.4 }), nLinks); chain.visible = false; chain.castShadow = true; g.add(chain);
  const setChain = (aLocal, bLocal, sag = 0.6) => {
    chain.visible = true;
    for (let i = 0; i < nLinks; i++) {
      const t = i / (nLinks - 1); const p = aLocal.clone().lerp(bLocal, t); p.y -= Math.sin(t * Math.PI) * sag;
      const t2 = Math.min(1, t + 0.02); const p2 = aLocal.clone().lerp(bLocal, t2); p2.y -= Math.sin(t2 * Math.PI) * sag;
      dummy.position.copy(p); dummy.lookAt(p2); dummy.rotateY(Math.PI / 2); dummy.rotateX(i % 2 ? Math.PI / 2 : 0); dummy.scale.setScalar(1); dummy.updateMatrix(); chain.setMatrixAt(i, dummy.matrix);
    }
    chain.instanceMatrix.needsUpdate = true;
  };
  // the bolted-down vat everyone stands on to haul
  { const PV = WL.pullVat; const m = new THREE.Mesh(new THREE.CylinderGeometry(WL.pullVatR, WL.pullVatR * 1.04, WL.pullVatH, 36), std({ map: (() => { const t = steelPlate(44, '#7f8385', { rust: 0.7 }); t.repeat.set(4, 1); return t; })(), metalness: 0.7, roughness: 0.45 })); m.position.set(PV.x, WL.pullVatH / 2, PV.z); m.castShadow = m.receiveShadow = true; g.add(m);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(WL.pullVatR * 1.02, WL.pullVatR * 1.02, 0.08, 36), std({ map: treadPlate(45), metalness: 0.7, roughness: 0.4 })); lid.position.set(PV.x, WL.pullVatH + 0.04, PV.z); lid.receiveShadow = true; g.add(lid);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; steel.at(cylGeo(6), V(PV.x + Math.cos(a) * WL.pullVatR * 1.06, 0.1, PV.z + Math.sin(a) * WL.pullVatR * 1.06), V(0.08, 0.2, 0.08), 0x8d9193); }
    collision.addGround((x, z) => (Math.hypot(x - WORKS.x - PV.x, z - WORKS.z - PV.z) < WL.pullVatR - 0.1 ? WORKS.y + WL.pullVatH + 0.08 : null));
    pullVatObs = collision.addObstacle({ x: PV.x + WORKS.x, z: PV.z + WORKS.z, r: WL.pullVatR + 0.05 }); }

  // ---------------------------------------------------------------- the Cathartic Jettison Protocol panel
  const CJ = WL.cjp; const cjpYaw = Math.atan2(DR.x - CJ.x, DR.z - CJ.z);
  const cjp = new THREE.Group(); cjp.position.set(CJ.x, 0, CJ.z); cjp.rotation.y = cjpYaw; g.add(cjp);
  { const pier = new THREE.Mesh(new THREE.BoxGeometry(2.6, 7, 1.4), std({ map: (() => { const t = blockWall(50); t.repeat.set(1, 1); return t; })(), roughness: 0.9 })); pier.position.set(0, 3.5, -0.7); pier.castShadow = pier.receiveShadow = true; cjp.add(pier);
    const hz2 = signTexture([''], { w: 512, h: 64, bg: '#c9a227', fg: '#000', weather: 0.6, seed: 3 }); const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.3), std({ map: hazardTex() })); stripe.position.set(0, 2.55, 0.01); cjp.add(stripe); void hz2;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.55, 0.08), std({ color: 0x5d6064, metalness: 0.8, roughness: 0.35 })); plate.position.set(0, 1.55, 0.04); plate.castShadow = true; cjp.add(plate);
    const head = signTexture(['CJP'], { w: 512, h: 160, bg: '#1c1a16', fg: '#e8dcc0', font: 'Oswald', weight: '700', weather: 0.3, seed: 4 }); const hs = signPlane(head, 0.7, 0.22); hs.position.set(0, 2.18, 0.085); cjp.add(hs);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })); lamp.position.set(0, 2.85, 0.25); cjp.add(lamp); }
  const cjpValves = [];
  for (let k = 0; k < 3; k++) { const v = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.025, 8, 24), std({ color: 0xc0281a, metalness: 0.4, roughness: 0.4 })); v.position.set(-0.55 + k * 0.55, 1.95, 0.14); cjp.add(v); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.03, 0.03), v.material); v.add(sp); cjpValves.push(v); }
  const keySlot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), std({ color: 0xd0d0cc, metalness: 0.95, roughness: 0.15 })); keySlot.rotation.x = Math.PI / 2; keySlot.position.set(-0.55, 1.35, 0.1); cjp.add(keySlot);
  { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.02), std({ color: 0x050505 })); sl.position.set(-0.55, 1.35, 0.13); cjp.add(sl); }
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.045, 12, 40), new THREE.MeshPhysicalMaterial({ color: 0xe8e4dc, metalness: 1, roughness: 0.08, clearcoat: 1 })); bezel.position.set(0.3, 1.32, 0.1); cjp.add(bezel);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 32), std({ color: 0xd0140c, roughness: 0.25, emissive: 0x5a0402, emissiveIntensity: 0.6 })); button.rotation.x = Math.PI / 2; button.position.set(0.3, 1.32, 0.14); cjp.add(button);
  { const t = signTexture(['CATHARTIC JETTISON PROTOCOL', 'For circumstances in which accumulated internal cargo threatens continued operation.', 'WARNING: RELEASE IS IRREVERSIBLE.'], { w: 1024, h: 420, bg: '#b08d3e', fg: '#2a1c0c', font: 'Oswald', weight: '600', sizes: [1, 0.48, 0.62], weather: 0.25, seed: 7, border: 8, borderColor: '#6e5420' });
    const pq = signPlane(t, 1.5, 0.62, { metalness: 0.7, roughness: 0.35 }); pq.position.set(0, 0.62, 0.01); cjp.add(pq);
    const note = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.3), new THREE.MeshStandardMaterial({ map: handText(['DO NOT ACTIVATE JUST BECAUSE', 'YOU CAN HANDLE WHAT COMES OUT'], { w: 1024, h: 210, size: 70, color: '#121212', rot: -0.02 }), transparent: true, roughness: 0.9 })); note.position.set(0, 0.17, 0.012); cjp.add(note); }
  const cjpFront = () => cjp.localToWorld(V(0, 1.4, 1.2));
  collision.addObstacle({ x: CJ.x + WORKS.x, z: CJ.z + WORKS.z, r: 1.45 });

  // ---------------------------------------------------------------- monitors + clock (facing north)
  const MO = WL.monitors;
  const screens = [];
  { const frameM = std({ color: 0x2a2c2e, metalness: 0.6, roughness: 0.5 });
    steel.beam(V(MO.x - 6, MO.y - 1.5, MO.z + 0.2), V(MO.x + 6, MO.y - 1.5, MO.z + 0.2), 0.24, 0.6, 0x2a2c2e);
    for (const dx of [-5.6, 5.6]) steel.beam(V(MO.x + dx, 0, MO.z + 0.3), V(MO.x + dx, MO.y + 2.8, MO.z + 0.3), 0.22, 0.22, 0x2a2c2e);
    for (let k = 0; k < 3; k++) {
      const x = MO.x + (k - 1) * 3.6;
      const box = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.45, 1.8), std({ color: 0xcfc6ae, roughness: 0.6 })); box.position.set(x, MO.y, MO.z + 0.4); box.castShadow = true; g.add(box);
      const sc = screen(512, 384); sc.draw((c, w, h) => crt(c, w, h, ['KEATLAND NEUROCHEMICAL', 'LINE 1: NOMINAL', '> _'], { size: 44 }));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.05), new THREE.MeshBasicMaterial({ map: sc.texture, toneMapped: false, color: 0xbbbbbb })); m.position.set(x, MO.y, MO.z - 0.51); m.rotation.y = Math.PI; g.add(m);
      screens.push({ ...sc, mesh: m });
    }
    void frameM;
    const ck = screen(512, 160); ck.draw((c, w, h) => clockFace(c, w, h, '3:16 AM'));
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshBasicMaterial({ map: ck.texture, toneMapped: false })); cm.position.set(MO.x, MO.y + 1.95, MO.z - 0.05); cm.rotation.y = Math.PI; g.add(cm);
    const cb = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 0.4), std({ color: 0x1a1a1a })); cb.position.set(MO.x, MO.y + 1.95, MO.z + 0.16); g.add(cb);
    screens.clock = ck; }

  // ---------------------------------------------------------------- intercom horns, alarm beacons
  const speakers = [V(-hx + 0.6, 8, -20), V(hx - 0.6, 8, -20), V(-hx + 0.6, 8, 22), V(hx - 0.6, 8, 22), V(0, 8, -hz + 0.6), V(8, 8, hz - 0.6), V(-6, 8.2, 3), V(MO.x, MO.y + 2.4, MO.z)];
  for (const p of speakers) { const dir = V(-p.x, 0, 2 - p.z).normalize(); const q = new THREE.Quaternion().setFromUnitVectors(UP, dir); steel.at(new THREE.CylinderGeometry(0.32, 0.08, 0.6, 14, 1, true), p.clone().addScaledVector(dir, 0.2), 1, 0x8a8478, q); steel.at(BOX, p, V(0.18, 0.18, 0.18), 0x3a3631); }
  const beaconPos = [V(-hx + 0.5, 11.5, 0 + 12), V(hx - 0.5, 11.5, 0), V(0, 11.5, -hz + 0.5), V(NP.x, 4.4, NP.z), V(-4, 11.5, hz - 0.5)];
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0x401008, toneMapped: false });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beacons = beaconPos.map((p) => {
    const b = new THREE.Group(); b.position.copy(p); g.add(b);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), beaconMat); b.add(dome);
    const spin = new THREE.Group(); b.add(spin);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(2.2, 9, 20, 1, true), beamMat); beam.rotation.z = Math.PI / 2; beam.position.x = 4.5; spin.add(beam);
    return { b, spin };
  });
  const alarmLights = [new THREE.PointLight(0xff2010, 0, 40, 1.5), new THREE.PointLight(0xff2010, 0, 40, 1.5)];
  alarmLights[0].position.set(-12, 10, 0); alarmLights[1].position.set(14, 10, 14); g.add(...alarmLights);

  // ---------------------------------------------------------------- lamps, light shafts, dust
  const lampPos = [];
  for (const x of [-16, -6, 6, 16]) for (let z = -34; z <= 36; z += 11.6) lampPos.push(V(x, 13.5 + (Math.abs(x) > 10 ? 1 : 0), z));
  const shadeGeo = new THREE.CylinderGeometry(0.18, 0.9, 0.7, 20, 1, true);
  const shades = new THREE.InstancedMesh(shadeGeo, std({ color: 0x2f4a3a, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide }), lampPos.length);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffe0a8, toneMapped: false }), lampPos.length);
  lampPos.forEach((p, i) => { dummy.position.copy(p); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); shades.setMatrixAt(i, dummy.matrix); dummy.position.y -= 0.25; dummy.updateMatrix(); bulbs.setMatrixAt(i, dummy.matrix); rails.rod(p.clone().setY(p.y + 0.35), p.clone().setY(roof - 5), 0.015, 0x2a2a28, 5); });
  g.add(shades, bulbs);
  const shafts = [];
  if (D >= 0.7) {
    const coneGeo = new THREE.CylinderGeometry(0.75, 4.2, 12, 24, 1, true);
    const coneMat = shaftMaterial(0xffd9a0, 0.075);
    lampPos.forEach((p) => { const c = new THREE.Mesh(coneGeo, coneMat); c.position.copy(p).setY(p.y - 0.3 - 6); g.add(c); });
    shafts.push(coneMat);
  }
  // window shafts: big soft beams from the south windows along the light direction
  const SUN = V(0.22, -0.62, -0.75).normalize();
  const winShaftMat = shaftMaterial(0xffe2b0, 0.22);
  for (const c of WL.windows) {
    const L = 36; const geo = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true); geo.rotateY(Math.PI / 4); geo.scale(3.4 * Math.SQRT2, L, 4.0 * Math.SQRT2);
    const m = new THREE.Mesh(geo, winShaftMat); const top = V(c, 20.75, hz - 0.2);
    m.position.copy(top).addScaledVector(SUN, L / 2); m.quaternion.setFromUnitVectors(UP, SUN.clone().negate()); g.add(m);
  }
  const motes = dustMotes(Math.round(2200 * D), new THREE.Box3(V(-hx + 2, 0.5, -hz + 2), V(hx - 2, 20, hz - 2)), 0xffe6c0, 1.5); g.add(motes);

  // ---------------------------------------------------------------- misc. floor clutter: drums, pallets, carts
  for (let i = 0; i < Math.round(40 * D); i++) {
    const x = (rng() < 0.5 ? -1 : 1) * (12 + rng() * 17), z = -40 + rng() * 80;
    if (Math.hypot(x - NP.x, z - NP.z) < 3 || Math.hypot(x - WL.stair.c.x, z - WL.stair.c.z) < 5.5 || Math.abs(z - CV.z) < 3 || (x < -26 && Math.abs(z) < 10) || (x > 26 && Math.abs(z - FR.z) < 4)) continue;
    if (WL.vats.some(([vx, vz, vr]) => Math.hypot(x - vx, z - vz) < vr + 1.5) || WL.columns.some(([cx2, cz2]) => Math.hypot(x - cx2, z - cz2) < 2)) continue;
    const k = rng();
    if (k < 0.55) { const n = 1 + Math.floor(rng() * 3); for (let j = 0; j < n; j++) { const px = x + (j % 2) * 0.62, pz = z + Math.floor(j / 2) * 0.62; steel.rod(V(px, 0, pz), V(px, 0.88, pz), 0.29, [0x2e4f7a, 0x8a2f22, 0x3f6e4a, 0xc9a227][Math.floor(rng() * 4)], 14); } collision.addObstacle({ x: x + 0.3 + WORKS.x, z: z + WORKS.z, r: 0.75 }); }
    else { steel.beam(V(x, 0.07, z), V(x, 0.07, z + 1.2), 1.0, 0.14, 0x8a6a44); for (let j = 0; j < 3; j++) steel.at(BOX, V(x, 0.14 + 0.2 + j * 0.36, z + 0.6), V(0.9, 0.34, 1.1), [0xa98a5e, 0x9a7a52][j % 2]); collision.addObstacle({ x: x + WORKS.x, z: z + 0.6 + WORKS.z, r: 0.8 }); }
  }

  // assemble batches
  g.add(steel.mesh(batchMat), pipes.mesh(pipeMat), rails.mesh(railMat), glow.mesh(glowMat, { cast: false, receive: false }));

  // floor provider for the hall (null inside the pit when the plates are gone)
  const pit = { open: false };
  collision.addGround((x, z) => {
    const lx = x - WORKS.x, lz = z - WORKS.z;
    if (lx < -hx - 0.5 || lx > hx + 0.5 || lz < -hz - 0.5 || lz > hz + 0.5) return null;
    if (pit.open && Math.hypot(lx - DR.x, lz - DR.z) < WL.plateR + 0.4) return null;
    return WORKS.y;
  });

  // ---------------------------------------------------------------- runtime
  let alarm = 0, power = 1;
  return {
    group: g, vats, bottlerObs, pullVatObs, wheel, gauge, setGauge, leaves, doorWall, barricade, freedomLight, plates, plug, plugEye, setChain, chain, grate,
    throat, cjp, cjpValves, button, bezel, keySlot, cjpFront, screens, speakers, lampPos, beacons, columnMats, bottleState, shafts, pit, SUN,
    get alarm() { return alarm; }, set alarm(v) { alarm = v; },
    get power() { return power; }, set power(v) { power = v; },
    update(dt, t) {
      bottleState.speed = 0.55 * power;
      beltTex.offset.x = (beltTex.offset.x - dt * bottleState.speed / 0.6) % 1;
      updateBottles(dt);
      for (const m of columnMats) m.uniforms.uPower.value = power;
      bulbs.material.color.setHex(0xffe0a8).multiplyScalar(0.12 + 0.88 * power); for (const m of shafts) m.uniforms.uK.value = 0.15 + 0.85 * power;
      // alarm beacons spin and the red lights throb
      beamMat.opacity = 0.22 * alarm; beaconMat.color.setRGB(0.25 + 0.75 * alarm, 0.06 + 0.06 * alarm, 0.03);
      beacons.forEach((b, i) => { b.spin.rotation.y = t * 4.2 + i; });
      const throb = alarm * (0.5 + 0.5 * Math.sin(t * 5.2));
      alarmLights.forEach((l, i) => { l.intensity = 260 * throb * (i ? 0.8 : 1); });
      for (const p of plates) { p.m.position.set(DR.x + p.dir.x * p.open * 7.6, Math.sin(Math.min(1, p.open * 3) * Math.PI / 2) * 0.35 - Math.max(0, p.open - 0.4) * 0.6, DR.z + p.dir.z * p.open * 7.6); p.m.visible = p.open < 0.99; }
    },
  };
}

function canvasStripe() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#3a3632'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#26231f'; for (let x = 0; x < 128; x += 16) g.fillRect(x, 0, 6, 64);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function hazardTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#d9a520'; g.fillRect(0, 0, 512, 64); g.fillStyle = '#16140f'; for (let x = -64; x < 576; x += 64) { g.beginPath(); g.moveTo(x, 64); g.lineTo(x + 32, 64); g.lineTo(x + 64, 0); g.lineTo(x + 32, 0); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
/** red seven-segment-ish clock face */
export function clockFace(g, w, h, text) {
  g.fillStyle = '#0a0302'; g.fillRect(0, 0, w, h);
  g.font = `${h * 0.86}px "VT323"`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,40,20,0.08)'; g.fillText('8:88 AM', w / 2, h / 2 + 4);
  g.shadowColor = '#ff2a10'; g.shadowBlur = 18; g.fillStyle = '#ff3a1c'; g.fillText(text, w / 2, h / 2 + 4); g.shadowBlur = 0;
}
