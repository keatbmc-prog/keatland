// The people in the Works and the things they carry: Keaten (tiny top hat, cane), Dale, the worker
// on the gantry, and the props the scene hands around (the Moss v3.5 pen, the wet cigarette, the
// lawnmower wheel, the executive chair and desk that come through the ceiling with what is in its
// drawers, the fortune cookie, the pink slip, a dollar). Actors walk, swim, ride rafts and sit.
import * as THREE from 'three';
import { Figure, cigarette, lawnmowerWheel } from '../../story/figures.js';
import { handText } from './paint.js';
import { floodHeight } from './shaders.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });

export class Actor {
  constructor(fig, root) { this.fig = fig; root.add(fig.group); this.p = V(); this.yaw = 0; this.path = []; this.speed = 1.3; this.rest = 'stand'; this.mode = 'ground'; this.base = 0; this.face = null; this.attach = null; this.dip = 0; this.onArrive = null; this.visible = true; }
  place(p, yaw = this.yaw) { this.p.copy(p); this.base = p.y; this.yaw = yaw; this.path = []; this._apply(); return this; }
  go(pts, { speed = 1.3, rest = this.rest, onArrive = null } = {}) { this.path = pts.map((q) => q.clone()); this.speed = speed; this.rest = rest; this.onArrive = onArrive; return this; }
  _turn(want, k) { let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * k; }
  _apply() { this.fig.group.position.copy(this.p); this.fig.group.rotation.y = this.yaw; this.fig.group.visible = this.visible; }
  update(dt, t, camWorld, camLocal) {
    const f = this.fig;
    if (this.attach) { // riding a floating prop
      const a = this.attach; this.p.copy(a.P.p).add(a.off); this.p.y = a.P.p.y + (a.dy ?? 0.18); this._turn(a.P.yaw + (a.yaw ?? 0), Math.min(1, dt * 4)); f.pose = a.pose || 'sit'; f.speed = 0;
    } else if (this.path.length) {
      const tgt = this.path[0]; const d = V(tgt.x - this.p.x, 0, tgt.z - this.p.z); const L = d.length();
      if (L < 0.12) { this.path.shift(); if (!this.path.length) { f.pose = this.rest; f.speed = 0; const cb = this.onArrive; this.onArrive = null; cb?.(); } }
      else { const step = Math.min(L, this.speed * dt); this.p.addScaledVector(d.normalize(), step); this._turn(Math.atan2(d.x, d.z), Math.min(1, dt * 6)); f.pose = this.mode === 'swim' ? 'swim' : 'walk'; f.speed = this.speed; if (tgt.y !== undefined && this.mode === 'ground') this.base += (tgt.y - this.base) * Math.min(1, dt * 3); }
    } else if (this.face) {
      const fp = this.face === 'player' ? camLocal : this.face; this._turn(Math.atan2(fp.x - this.p.x, fp.z - this.p.z), Math.min(1, dt * 2.5));
    }
    if (!this.attach) {
      if (this.mode === 'swim') { const h = floodHeight(this.p.x, this.p.z, t); this.p.y = Math.max(this.base, h - 1.3 + this.dip); }
      else this.p.y = this.base;
    }
    this._apply();
    f.update(dt, camWorld);
  }
}

export function buildCast(root) {
  const keaten = new Actor(new Figure('keaten', { seed: 41 }), root);
  const dale = new Actor(new Figure('dale', { seed: 42 }), root);
  const worker = new Actor(new Figure('worker', { seed: 43 }), root);
  // Keaten: cane in his right hand, the tiny top hat (on only when the factory starts to shake)
  const cane = new THREE.Group(); { const m = std({ color: 0x1a1210, roughness: 0.35 }); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.9, 8), m); s.position.y = -0.42; cane.add(s); const k = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), std({ color: 0xc9a24a, metalness: 0.9, roughness: 0.3 })); cane.add(k); }
  keaten.fig.hold(cane, 'R', V(0, -0.08, 0.03));
  const hat = new THREE.Group(); { const m = std({ color: 0x111111, roughness: 0.5 }); const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.08, 16), m); crown.position.y = 0.04; hat.add(crown); const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 18), m); hat.add(brim); const band = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.051, 0.014, 16), std({ color: 0x7a1a14 })); band.position.y = 0.012; hat.add(band); }
  hat.position.set(0.025, 0.215, 0.0); hat.rotation.z = -0.18; hat.visible = false; keaten.fig.head.add(hat);
  // the worker's hard hat
  { const hh = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xf2c12a, roughness: 0.4 })); hh.position.y = 0.16; worker.fig.head.add(hh); const br = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.01, 18), hh.material); br.position.y = 0.165; worker.fig.head.add(br); }
  // the Moss v3.5 pen
  const pen = new THREE.Group(); { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 10), std({ color: 0x1d3a6a, metalness: 0.4, roughness: 0.3 })); b.rotation.z = Math.PI / 2; pen.add(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.04, 10), std({ color: 0xd8d2c4, metalness: 0.9, roughness: 0.2 })); c.rotation.z = Math.PI / 2; c.position.x = 0.06; pen.add(c); }
  pen.visible = false;
  const cig = cigarette(); cig.visible = false;
  const wheel = lawnmowerWheel(); wheel.visible = false; dale.fig.hold(wheel, 'L', V(0, -0.1, 0.1));
  // the executive chair and desk that come through the ceiling
  const office = new THREE.Group(); office.visible = false; root.add(office);
  const wood = std({ color: 0x5a3418, roughness: 0.45 }), leather = std({ color: 0x3a1a10, roughness: 0.5 }), brass = std({ color: 0xc9a24a, metalness: 0.9, roughness: 0.3 });
  const chair = new THREE.Group(); office.add(chair);
  { const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.58), leather); seat.position.y = 0.5; chair.add(seat); const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.95, 0.12), leather); back.position.set(0, 1.0, -0.3); back.rotation.x = -0.12; chair.add(back); const frame = new THREE.Mesh(new THREE.BoxGeometry(0.68, 1.05, 0.06), wood); frame.position.set(0, 1.0, -0.37); frame.rotation.x = -0.12; chair.add(frame);
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.55), wood); arm.position.set(s * 0.33, 0.75, -0.02); chair.add(arm); const post = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.05), wood); post.position.set(s * 0.33, 0.62, 0.2); chair.add(post); }
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.36, 10), brass); col.position.y = 0.26; chair.add(col);
    for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.36), wood); leg.position.set(Math.sin(a) * 0.17, 0.06, Math.cos(a) * 0.17); leg.rotation.y = a; chair.add(leg); } }
  chair.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const desk = new THREE.Group(); desk.position.set(0, 0, 0.95); office.add(desk);
  { const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.85), wood); top.position.y = 0.76; desk.add(top); for (const s of [-1, 1]) { const ped = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.73, 0.78), wood); ped.position.set(s * 0.6, 0.365, 0); desk.add(ped); } const front = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.5, 0.03), wood); front.position.set(0, 0.48, 0.38); desk.add(front); }
  desk.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  const drawer = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.6), std({ color: 0x6a3e1e, roughness: 0.5 })); drawer.position.set(-0.6, 0.6, -0.1); desk.add(drawer);
  { const h = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), brass); h.position.set(0, 0, -0.31); drawer.add(h); }
  // what is in the drawer, laid out on the desk top one by one
  const items = {};
  const onDesk = (name, obj, x, z, ry = 0) => { obj.position.set(x, 0.8, z); obj.rotation.y = ry; obj.visible = false; desk.add(obj); items[name] = obj; };
  { const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.1), [std({ color: 0xf2efe6 }), std({ color: 0xf2efe6 }), new THREE.MeshStandardMaterial({ map: handText('KEATLAND', { w: 512, h: 128, size: 80, color: '#b01e14', bg: '#f2efe6', font: 'Oswald' }) }), std({ color: 0xb01e14 }), std({ color: 0xb01e14 }), std({ color: 0xb01e14 })]); onDesk('carton', c, -0.45, 0.05, 0.2); }
  { const k = new THREE.Group(); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 14), std({ color: 0xc0c0c0, metalness: 0.9 })); ring.rotation.x = Math.PI / 2; k.add(ring); for (const a of [0.3, -0.4]) { const key = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.018), std({ color: 0xd8d0b0, metalness: 0.9, roughness: 0.3 })); key.position.set(Math.cos(a) * 0.045, 0, Math.sin(a) * 0.045); key.rotation.y = -a; k.add(key); } onDesk('keys', k, -0.1, 0.12); }
  { const cash = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.07), std({ color: 0x7a9a6a })); const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.052, 0.072), std({ color: 0xe8e0c8 })); cash.add(band); onDesk('cash', cash, 0.15, 0.08, -0.3); }
  const STICKERS = ['WE FUCK THINGS UP', 'I SURVIVED HUMANE REALIZATIONS', 'FREEDOMLAND OR BUST', 'PROJECTS'];
  STICKERS.forEach((s, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.09), new THREE.MeshStandardMaterial({ map: handText(s, { w: 512, h: 192, size: 64, color: ['#f2efe6', '#1a1a1a', '#a3261c', '#f2efe6'][i], bg: ['#a3261c', '#f2c12a', '#efe3c4', '#2e4f7a'][i], font: 'Oswald' }), roughness: 0.6 })); m.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(m); onDesk('sticker' + i, o, 0.1 + (i - 1.5) * 0.17, -0.18 + Math.abs(i - 1.5) * 0.04, (i - 1.5) * 0.18); });
  { const slip = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), new THREE.MeshStandardMaterial({ map: handText(['TERMINATION', '______'], { w: 256, h: 320, size: 40, color: '#5a1a2a', bg: '#f4b8c8', font: 'Oswald' }), roughness: 0.8 })); slip.rotation.x = -Math.PI / 2; const o = new THREE.Group(); o.add(slip); onDesk('slip', o, 0.35, 0.15, 0.1); }
  const cookie = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xd8a860, roughness: 0.6 })); cookie.scale.set(1.3, 0.8, 0.8); cookie.visible = false; root.add(cookie);
  const dollar = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.065), std({ color: 0x8aa878, side: THREE.DoubleSide })); dollar.visible = false; root.add(dollar);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.025), std({ color: 0xf2efe6 })); pack.visible = false; root.add(pack);
  // falling ceiling: tiles, insulation, dust
  const ceiling = new THREE.Group(); ceiling.visible = false; root.add(ceiling);
  const tileM = std({ color: 0xd8d0bc, roughness: 0.95 }), insM = std({ color: 0xe89aa0, roughness: 1 });
  const bits = [];
  for (let i = 0; i < 26; i++) { const m = new THREE.Mesh(i % 3 ? new THREE.BoxGeometry(0.6, 0.02, 0.6) : new THREE.IcosahedronGeometry(0.18 + Math.random() * 0.12, 0), i % 3 ? tileM : insM); m.castShadow = true; ceiling.add(m); bits.push({ m, off: V((Math.random() - 0.5) * 3, Math.random() * 4, (Math.random() - 0.5) * 3), spin: V(Math.random() * 4, Math.random() * 4, Math.random() * 4), delay: Math.random() * 0.5 }); }
  const dustGeo = new THREE.BufferGeometry(); const N = 400; const dp = new Float32Array(N * 3), dv = []; for (let i = 0; i < N; i++) dv.push(V((Math.random() - 0.5), Math.random() * 0.6, (Math.random() - 0.5)).multiplyScalar(5));
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xd8cbb0, size: 0.12, transparent: true, opacity: 0, depthWrite: false })); dust.frustumCulled = false; ceiling.add(dust);
  return { keaten, dale, worker, cane, hat, pen, cig, wheel, office, chair, desk, drawer, items, cookie, dollar, pack, ceiling, bits, dust, dustV: dv };
}
