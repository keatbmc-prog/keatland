// Dale from Building C. He roams the Backrooms on his own little routine (unscrewing the bulb out of
// the brochure-desk lamp, staring at the Freedomland door, listening at the Catecholamine Works,
// pacing Accounting), and when he sees you he power-walks after you, relentless, never quite running,
// asking for smokes and "somedat". Catch-up means a sad little exchange and a cooldown. He hears the
// voice in the trees too. Lines live in src/data/storyLines.js (DALE).
import * as THREE from 'three';
import { S, FLOOR } from './layout.js';
import { V } from './kit.js';
import { Figure, lawnmowerWheel, copperCoil, cigarette, badge } from './figures.js';
import { signTexture } from './paint.js';
import { DALE } from '../data/storyLines.js';

const NODES = {
  annex: [9.5, -42], dog: [11, -48.5], hallS: [12.5, -52], hallM: [12.5, -62], accDoor: [12.5, -69.5], acc: [6, -69.5], accBack: [3, -74.5],
  hallN: [12.5, -80], office: [15, -87.5], desk: [11.2, -90.6], poster: [15.5, -95.4], loop0: [26, -90.5], loop1: [40.5, -90.5], loop2: [55.5, -90.5],
  loop3: [70.5, -90.5], works: [84, -90.2], freedom: [90.4, -90.5],
};
const EDGES = [['annex', 'dog'], ['dog', 'hallS'], ['hallS', 'hallM'], ['hallM', 'accDoor'], ['accDoor', 'acc'], ['acc', 'accBack'], ['accDoor', 'hallN'], ['hallN', 'office'],
  ['office', 'desk'], ['office', 'poster'], ['office', 'loop0'], ['loop0', 'loop1'], ['loop1', 'loop2'], ['loop2', 'loop3'], ['loop3', 'works'], ['works', 'freedom']];
// things he does when nobody is around: [node, seconds, what, facing (local yaw toward)]
const TASKS = [
  { at: 'desk', dur: [8, 14], act: 'unscrew', face: [11.35, -92.25] },
  { at: 'freedom', dur: [7, 12], act: 'stare', face: [92, -90.5] },
  { at: 'works', dur: [6, 10], act: 'listen', face: [84, -88.9] },
  { at: 'accBack', dur: [5, 9], act: 'pace', face: [3, -77] },
  { at: 'poster', dur: [6, 10], act: 'stare', face: [15.5, -98] },
  { at: 'hallM', dur: [3, 6], act: 'smoke', face: [14, -62] },
];

const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Dale {
  constructor({ root, collision, speech }) {
    Object.assign(this, { root, collision, speech });
    this.fig = new Figure('dale', { seed: 77 });
    this.group = this.fig.group; root.add(this.group);
    // what he carries: a lawnmower wheel, a coil of copper, his badge, a cigarette behind the ear
    this.wheel = this.fig.hold(lawnmowerWheel(), 'L', V(0, -0.14, 0.06));
    this.coil = copperCoil(); this.coil.position.set(0.2, 0.95, -0.12); this.group.add(this.coil);
    const bt = signTexture(['DALE', 'BLDG C', 'ACCESS: ALL?'], { w: 256, h: 360, bg: '#f2efe6', fg: '#222', font: 'Oswald', weight: '600', weather: 0.4, seed: 301, border: 6 });
    this.badge = badge(bt); this.badge.position.set(0.1, 1.28, 0.13); this.group.add(this.badge);
    this.cig = cigarette(); this.fig.head.add(this.cig); this.cig.position.set(0.09, 0.07, 0.0); this.cig.rotation.y = Math.PI / 2;
    this.obs = collision.addObstacle({ x: 0, z: 0, r: 0.38 });
    this.adj = {}; for (const k in NODES) this.adj[k] = []; for (const [a, b] of EDGES) { this.adj[a].push(b); this.adj[b].push(a); }
    this.onLine = null; // (text, localPos, mood) => void  (audio babble)
    this.reset();
  }

  reset() {
    this.p = V(...[NODES.desk[0], FLOOR, NODES.desk[1]]); this.yaw = 0;
    this.mode = 'task'; this.task = TASKS[0]; this.timer = 9; this.path = []; this.lineT = 2; this.cool = 0; this.chaseT = 0; this.seen = false; this.lastSaid = '';
    this.fig.pose = 'stand'; this._place();
  }

  _place() { this.group.position.copy(this.p); this.group.rotation.y = this.yaw; const w = this.p.clone().add(S); this.obs.x = w.x; this.obs.z = w.z; }

  _nearestNode(x, z) { let best = null, bd = Infinity; for (const k in NODES) { const [nx, nz] = NODES[k]; const d = (nx - x) ** 2 + (nz - z) ** 2; if (d < bd && this._los(x, z, nx, nz)) { bd = d; best = k; } } return best || 'hallS'; }
  _route(from, to) { // BFS on the little graph
    const prev = { [from]: null }, q = [from];
    while (q.length) { const n = q.shift(); if (n === to) break; for (const m of this.adj[n]) if (!(m in prev)) { prev[m] = n; q.push(m); } }
    const out = []; for (let n = to; n; n = prev[n]) out.unshift(n); return out;
  }
  /** line of sight in local coords, against room walls (closed doors included) */
  _los(x1, z1, x2, z2) {
    const ax = x1 + S.x, az = z1 + S.z, bx = x2 + S.x, bz = z2 + S.z;
    for (const w of this.collision.walls) {
      if (w.off) continue;
      const d = (bx - ax) * (w.z2 - w.z1) - (bz - az) * (w.x2 - w.x1); if (Math.abs(d) < 1e-9) continue;
      const t = ((w.x1 - ax) * (w.z2 - w.z1) - (w.z1 - az) * (w.x2 - w.x1)) / d;
      const u = ((w.x1 - ax) * (bz - az) - (w.z1 - az) * (bx - ax)) / d;
      if (t > 0.02 && t < 0.98 && u >= 0 && u <= 1) return false;
    }
    return true;
  }
  say(list, mood) {
    let line = pick(list); if (line === this.lastSaid && list.length > 1) line = pick(list.filter((l) => l !== line));
    this.lastSaid = line;
    this.speech.say(line, this.p, { follow: this.fig.head, height: 0.38, style: mood === 'caught' ? { color: '#ffe9b0' } : {} });
    this.onLine?.(line, this.p.clone().setY(this.p.y + 1.65), mood);
  }
  /** the voice spoke somewhere: if he is near you, he heard it too */
  heardVoice(playerLocal) { if (this.p.distanceTo(playerLocal) < 14 && Math.random() < 0.85) setTimeout(() => this.say(DALE.hearsVoice, 'voice'), 1400 + Math.random() * 900); }
  /** the loop moved the player back one door: keep him where he was relative to them */
  shift(dx, playerLocal) { if (this.p.x > 30 && this.p.z < -88.5 && this.p.z > -92.5 && this.p.x + dx > 25) { this.p.x += dx; this.path = []; this._place(); } }

  _walkTo(tx, tz, speed, dt) {
    const dx = tx - this.p.x, dz = tz - this.p.z, d = Math.hypot(dx, dz);
    if (d < 0.05) return d;
    const step = Math.min(d, speed * dt);
    let nx = this.p.x + dx / d * step, nz = this.p.z + dz / d * step;
    // walls only (resolve() would also push him off his own obstacle)
    this.obs.off = true; const r = this.collision.resolve(nx + S.x, nz + S.z, 0.34); this.obs.off = false;
    this.p.x = r.x - S.x; this.p.z = r.z - S.z;
    const want = Math.atan2(dx, dz); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 8);
    this.fig.speed = speed;
    return d;
  }

  update(dt, t, playerLocal, camWorld, active) {
    const pl = playerLocal;
    this.fig.lookAt = null;
    if (!active) { this.fig.update(dt, camWorld); return; }
    this.lineT -= dt; this.cool -= dt;
    const dist = Math.hypot(pl.x - this.p.x, pl.z - this.p.z);
    const sees = dist < 13 && this._los(this.p.x, this.p.z, pl.x, pl.z);
    if (this.mode !== 'chase' && this.mode !== 'caught' && sees && this.cool <= 0) {
      this.mode = 'chase'; this.chaseT = 0; this.say(DALE.notice, 'notice'); this.lineT = 3.5; this.path = [];
    }
    if (this.mode === 'chase') {
      this.chaseT += dt; this.fig.pose = 'powerwalk';
      if (sees) { this.path = []; this.lastSeen = V(pl.x, 0, pl.z); this._walkTo(pl.x, pl.z, 4.3, dt); }
      else {
        if (!this.path.length) { const a = this._nearestNode(this.p.x, this.p.z), b = this._nearestNode(pl.x, pl.z); this.path = this._route(a, b); }
        const n = NODES[this.path[0]]; if (n && this._walkTo(n[0], n[1], 4.3, dt) < 0.4) this.path.shift();
        if (!this.path.length && this.lastSeen) this._walkTo(pl.x, pl.z, 4.3, dt);
      }
      if (this.lineT <= 0) { this.say(DALE.chase, 'chase'); this.lineT = 3 + Math.random() * 2; }
      if (dist < 1.45) { this.mode = 'caught'; this.timer = 4.5; this.say(DALE.caught, 'caught'); this.fig.pose = 'stand'; }
      else if (this.chaseT > 26 || dist > 30) { this.mode = 'giveup'; this.timer = 3; this.say(DALE.giveUp, 'giveup'); this.fig.pose = 'stand'; }
    } else if (this.mode === 'caught' || this.mode === 'giveup') {
      this.fig.pose = 'stand'; this.fig.lookAt = camWorld;
      const want = Math.atan2(pl.x - this.p.x, pl.z - this.p.z); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 4);
      this.timer -= dt;
      if (this.timer <= 0) { this.cool = this.mode === 'caught' ? 22 : 14; this.mode = 'wander'; this.path = []; if (Math.random() < 0.6) this.say(DALE.idle, 'idle'); }
    } else if (this.mode === 'wander') {
      this.fig.pose = 'walk';
      if (!this.path.length) { this.task = pick(TASKS); this.path = this._route(this._nearestNode(this.p.x, this.p.z), this.task.at); }
      const n = NODES[this.path[0]];
      if (n && this._walkTo(n[0], n[1], 1.5, dt) < 0.3) { this.path.shift(); if (!this.path.length) { this.mode = 'task'; this.timer = this.task.dur[0] + Math.random() * (this.task.dur[1] - this.task.dur[0]); } }
    } else if (this.mode === 'task') {
      const tk = this.task; this.fig.pose = tk.act === 'pace' ? 'walk' : 'stand'; this.fig.speed = 0.8;
      const [fx, fz] = tk.face; const want = Math.atan2(fx - this.p.x, fz - this.p.z); let dy = want - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += dy * Math.min(1, dt * 3);
      if (tk.act === 'pace') { const n = NODES[tk.at]; this.p.x = n[0] + Math.sin(t * 0.7) * 1.6; this.yaw = Math.cos(t * 0.7) > 0 ? Math.PI / 2 : -Math.PI / 2; }
      this.timer -= dt; if (this.timer <= 0) { this.mode = 'wander'; this.path = []; }
    }
    this._place();
    this.fig.update(dt, camWorld);
    // task arm poses on top of the base pose
    if (this.mode === 'task') {
      const [AL, AR] = this.fig.arms;
      if (this.task.act === 'unscrew') { AR.sh.rotation.x = -1.9; AR.el.rotation.x = -0.6; AR.hand.rotation.y = Math.sin(t * 6) * 0.9; }
      else if (this.task.act === 'listen') { this.fig.head.rotation.z = 0.35; }
      else if (this.task.act === 'smoke') { AR.sh.rotation.x = -1.2; AR.el.rotation.x = -1.9 + Math.max(0, Math.sin(t * 0.8)) * 0.4; }
    } else this.fig.head.rotation.z = 0;
  }
}
