// The Jettison Hold: what the Cathartic Jettison Protocol uncovers under the drain plates. A shaft
// much deeper than the factory is tall, its walls stacked with everything Keatland ever put away:
// old rooms, plans, doors with no buildings behind them, boxes, a chair pulled up beside a
// hospital bed, whole headquarters stacked on top of each other, and thousands of unfinished
// sentences hanging in the dark. Far below, stamped across the floor: JETTISON HOLD.
import * as THREE from 'three';
import { WL } from './layout.js';
import { canvasTexture } from '../../materials/textures.js';
import { handText } from './paint.js';
import { mulberry32 } from '../../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

const SENTENCES = [
  'I was going to', 'when things calm down I’ll', 'someday we should', 'I never finished telling you',
  'remind me to', 'it’s fine, I’ll just', 'next week for sure', 'we should really get around to',
  'I meant to call', 'once the shop is set up', 'I’ll fix it when', 'after this one project',
  'we were almost', 'I keep meaning to', 'if I’d just', 'hold that thought',
];

function wallTexture() {
  // strata of stored things: shelves of boxes, doorways, old room corners, filing, paper
  return canvasTexture(1024, 1024, (g, w, h) => {
    const rng = mulberry32(5);
    g.fillStyle = '#2a241e'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      const y0 = row * 128;
      g.fillStyle = '#1a1612'; g.fillRect(0, y0 + 118, w, 10); // shelf
      let x = 0;
      while (x < w) {
        const k = rng(); const bw = 30 + rng() * 120, bh = 40 + rng() * 76;
        if (k < 0.5) { g.fillStyle = `rgb(${130 + rng() * 40},${100 + rng() * 30},${62 + rng() * 20})`; g.fillRect(x, y0 + 118 - bh, bw, bh); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, y0 + 118 - bh, bw, 4); g.fillRect(x + bw * 0.45, y0 + 118 - bh, 3, bh); }
        else if (k < 0.65) { g.fillStyle = '#5a4630'; g.fillRect(x, y0 + 10, 44, 108); g.fillStyle = '#0c0a08'; g.fillRect(x + 6, y0 + 16, 32, 102); g.fillStyle = 'rgba(255,220,160,0.12)'; g.fillRect(x + 6, y0 + 16, 32, 102); }
        else if (k < 0.8) { g.fillStyle = `rgb(${90 + rng() * 30},${96 + rng() * 30},${90 + rng() * 20})`; g.fillRect(x, y0 + 30, bw * 0.6, 88); for (let d = 0; d < 4; d++) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 4, y0 + 36 + d * 21, bw * 0.6 - 8, 2); } }
        else { g.fillStyle = `rgba(${200 + rng() * 40},${190 + rng() * 40},${170 + rng() * 30},0.8)`; for (let s = 0; s < 6; s++) g.fillRect(x + rng() * bw, y0 + 118 - rng() * 60, 18, 24); }
        x += bw + 4 + rng() * 10;
      }
    }
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${rng() * 0.2})`; g.fillRect(rng() * w, rng() * h, 2 + rng() * 8, 2 + rng() * 8); }
  }, { repeat: [5, 1] });
}

export function buildHold({ root, quality }) {
  const D = quality.detail, R = WL.plateR - 0.05, H = WL.holdDepth, DR = WL.drain;
  const rng = mulberry32(13);
  const g = new THREE.Group(); g.name = 'works:hold'; g.position.set(DR.x, 0, DR.z); root.add(g);
  const wt = wallTexture(); wt.repeat.set(5, H / 9);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H, 64, 1, true), std({ map: wt, side: THREE.BackSide, color: 0xb0a090 }));
  wall.position.y = -H / 2 - 0.2; g.add(wall);
  // ledges every 9 m with things on them, spiralling down
  const ledgeMat = std({ color: 0x3a342c, roughness: 0.9 });
  const items = [];
  const card = std({ color: 0xa98a5e }), wood = std({ color: 0x6a4a2c }), paint = std({ color: 0xd8cfb6 }), metal = std({ color: 0x8a8e90, metalness: 0.6, roughness: 0.4 }), sheet = std({ color: 0xe8e4da });
  const boxG = new THREE.BoxGeometry(1, 1, 1);
  const nLedges = Math.round(10 * D) + 3;
  for (let i = 0; i < nLedges; i++) {
    const y = -3.5 - i * 9.5;
    const ledge = new THREE.Mesh(new THREE.RingGeometry(R - 1.3, R, 48), ledgeMat); ledge.rotation.x = -Math.PI / 2; ledge.position.y = y; g.add(ledge);
    const n = Math.round(14 * D) + 6;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + i * 0.7, r = R - 0.7, p = V(Math.cos(a) * r, y, Math.sin(a) * r), yaw = -a + Math.PI / 2;
      const kind = rng(); let o;
      if (kind < 0.45) { o = new THREE.Mesh(boxG, card); const s = 0.4 + rng() * 0.6; o.scale.set(s, s * (0.6 + rng() * 0.5), s); o.position.copy(p).setY(y + o.scale.y / 2); if (rng() < 0.4) { const o2 = o.clone(); o2.position.y += o.scale.y; o2.rotation.y = rng(); g.add(o2); } }
      else if (kind < 0.62) { o = new THREE.Group(); const fr = new THREE.Mesh(boxG, wood); fr.scale.set(1.0, 2.1, 0.12); fr.position.y = 1.05; o.add(fr); const dr = new THREE.Mesh(boxG, paint); dr.scale.set(0.82, 1.95, 0.06); dr.position.set(0.1, 1.0, 0.08); dr.rotation.y = 0.5; o.add(dr); o.position.copy(p); } // a door with no building
      else if (kind < 0.74) { o = new THREE.Group(); const seat = new THREE.Mesh(boxG, wood); seat.scale.set(0.45, 0.05, 0.45); seat.position.y = 0.45; o.add(seat); const back = new THREE.Mesh(boxG, wood); back.scale.set(0.45, 0.5, 0.05); back.position.set(0, 0.72, -0.2); o.add(back); for (const [dx, dz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) { const l = new THREE.Mesh(boxG, wood); l.scale.set(0.04, 0.45, 0.04); l.position.set(dx, 0.22, dz); o.add(l); } o.position.copy(p); }
      else if (kind < 0.86) { o = new THREE.Group(); const hq = new THREE.Mesh(boxG, std({ color: [0xcfc6ae, 0xb8a888, 0x9a9488][k % 3] })); hq.scale.set(0.9, 1.1, 0.7); hq.position.y = 0.55; o.add(hq); const hq2 = hq.clone(); hq2.scale.set(0.7, 0.8, 0.6); hq2.position.y = 1.5; hq2.rotation.y = 0.3; o.add(hq2); const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })); win.position.set(0, 0.7, 0.36); o.add(win); o.position.copy(p); } // stacked headquarters
      else { o = new THREE.Mesh(boxG, metal); o.scale.set(0.5, 1.3, 0.6); o.position.copy(p).setY(y + 0.65); } // filing cabinet
      o.rotation.y = yaw + (rng() - 0.5) * 0.6; g.add(o); items.push(o);
    }
  }
  // the chair beside the hospital bed (second ledge, facing the hole)
  { const y = -3.5 - 9.5, a = 1.2, r = R - 0.75, p = V(Math.cos(a) * r, y, Math.sin(a) * r);
    const bed = new THREE.Group(); bed.position.copy(p); bed.rotation.y = -a; g.add(bed);
    const frame = new THREE.Mesh(boxG, metal); frame.scale.set(0.95, 0.12, 2.0); frame.position.y = 0.6; bed.add(frame);
    const mat = new THREE.Mesh(boxG, sheet); mat.scale.set(0.9, 0.16, 1.9); mat.position.y = 0.74; bed.add(mat);
    const pil = new THREE.Mesh(boxG, sheet); pil.scale.set(0.6, 0.12, 0.35); pil.position.set(0, 0.86, -0.75); bed.add(pil);
    const head = new THREE.Mesh(boxG, metal); head.scale.set(0.95, 0.7, 0.05); head.position.set(0, 0.95, -1.0); bed.add(head);
    for (const [dx, dz] of [[-0.42, -0.95], [0.42, -0.95], [-0.42, 0.95], [0.42, 0.95]]) { const l = new THREE.Mesh(boxG, metal); l.scale.set(0.04, 0.6, 0.04); l.position.set(dx, 0.3, dz); bed.add(l); }
    const chair = new THREE.Group(); chair.position.set(0.85, 0, 0.1); chair.rotation.y = -Math.PI / 2; bed.add(chair);
    const seat = new THREE.Mesh(boxG, wood); seat.scale.set(0.45, 0.05, 0.45); seat.position.y = 0.45; chair.add(seat); const back = new THREE.Mesh(boxG, wood); back.scale.set(0.45, 0.55, 0.05); back.position.set(0, 0.74, 0.2); chair.add(back);
    const lamp = new THREE.PointLight(0xffd9a0, 6, 6, 1.6); lamp.position.set(0, 2, 0); bed.add(lamp); }
  // unfinished sentences hanging in the dark
  const sentences = [];
  const nS = Math.round(40 * D) + 10;
  for (let i = 0; i < nS; i++) {
    const t = SENTENCES[i % SENTENCES.length] + '…';
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: handText(t, { w: 1024, h: 200, size: 92, color: '#f2e6c8', font: 'Caveat' }), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: 0.55 + rng() * 0.35, fog: true }));
    const a = rng() * Math.PI * 2, r = rng() * (R - 2.2);
    m.position.set(Math.cos(a) * r, -4 - rng() * (H - 12), Math.sin(a) * r); m.rotation.y = rng() * 6.28;
    g.add(m); sentences.push({ m, spin: (rng() - 0.5) * 0.3, bob: rng() * 6 });
  }
  // the floor: stamped
  const stamp = canvasTexture(1024, 1024, (c, w, h) => {
    c.fillStyle = '#5a544c'; c.fillRect(0, 0, w, h);
    const r2 = mulberry32(9); for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(${r2() < 0.5 ? '0,0,0' : '255,240,220'},${r2() * 0.1})`; c.fillRect(r2() * w, r2() * h, 2 + r2() * 6, 2 + r2() * 6); }
    c.save(); c.translate(w / 2, h / 2); c.rotate(-0.12); c.fillStyle = 'rgba(200,40,24,0.92)'; c.font = '700 150px "Oswald"'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('JETTISON', 0, -90); c.fillText('HOLD', 0, 90); c.strokeStyle = 'rgba(200,40,24,0.92)'; c.lineWidth = 16; c.strokeRect(-380, -230, 760, 460); c.restore();
    c.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(0,0,0,${r2() * 0.5})`; c.fillRect(r2() * w, r2() * h, 2 + r2() * 5, 2 + r2() * 3); } c.globalCompositeOperation = 'source-over';
  }, { wrap: false });
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshStandardMaterial({ map: stamp, roughness: 0.9, emissive: 0xffffff, emissiveMap: stamp, emissiveIntensity: 0.35 }));
  bottom.rotation.x = -Math.PI / 2; bottom.position.y = -H; g.add(bottom);
  const deepLight = new THREE.PointLight(0xffb070, 40, 60, 1.4); deepLight.position.y = -H + 20; g.add(deepLight);
  g.visible = false;
  return {
    group: g,
    update(dt, t) { if (!g.visible) return; for (const s of sentences) { s.m.rotation.y += s.spin * dt; s.m.position.y += Math.sin(t * 0.4 + s.bob) * 0.002; } },
  };
}
