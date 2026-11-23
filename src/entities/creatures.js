// The congregation: five lumpy toad-things (Gloria, Mortimer, Dot, Big Rhonda, Wendell, after the
// prototype's toad directory). Each is procedurally built and individually animated; a shared
// Congregation controller runs their ceremony on its own clock - wander, gather, chant, procession,
// bow, disperse - whether or not anybody is watching. Individuals still blink, glance at the
// visitor, startle at the sword, and hop out of the way when crowded.
import * as THREE from 'three';
import { blobGeometry, sweepGeometry } from '../geometry/sweep.js';
import { merge } from '../geometry/generators.js';
import { organicMaterial, getTextures, U } from '../materials/library.js';
import { L, hubFloor } from '../world/layout.js';
import { mulberry32 } from '../core/noise.js';
import { glowSprite } from './heart.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const SPECS = [
  { name: 'Gloria', color: 0x58702a, color2: 0x1c260a, vein: 0xd8ff6a, scale: 1.0, eyes: [{ x: -0.35, y: 0.55, z: 0.55, r: 0.28, iris: 'irisGreen' }, { x: 0.38, y: 0.62, z: 0.5, r: 0.2, iris: 'irisGreen' }], lure: true, seed: 1 },
  { name: 'Mortimer', color: 0x6a3a5a, color2: 0x220c1c, vein: 0xff7ab0, scale: 1.15, eyes: [{ x: 0, y: 1.05, z: 0.15, r: 0.22, iris: 'irisPink', stalk: 0.7 }, { x: -0.4, y: 0.95, z: 0.1, r: 0.17, iris: 'irisPink', stalk: 0.5 }, { x: 0.42, y: 0.9, z: 0.15, r: 0.15, iris: 'iris', stalk: 0.45 }], seed: 2 },
  { name: 'Dot', color: 0x3a6a72, color2: 0x0c2226, vein: 0x9ff4ff, scale: 0.62, eyes: [{ x: -0.3, y: 0.5, z: 0.6, r: 0.16, iris: 'iris' }, { x: 0.05, y: 0.62, z: 0.62, r: 0.13, iris: 'irisGreen' }, { x: 0.33, y: 0.5, z: 0.58, r: 0.15, iris: 'irisPink' }, { x: -0.12, y: 0.8, z: 0.45, r: 0.1, iris: 'iris' }, { x: 0.22, y: 0.82, z: 0.42, r: 0.09, iris: 'irisGreen' }], seed: 3 },
  { name: 'Big Rhonda', color: 0x5a4630, color2: 0x1e140a, vein: 0xffc060, scale: 1.85, eyes: [{ x: -0.38, y: 0.6, z: 0.55, r: 0.24, iris: 'iris' }, { x: 0.36, y: 0.58, z: 0.56, r: 0.3, iris: 'iris' }], crown: true, seed: 4 },
  { name: 'Wendell', color: 0x4a4a62, color2: 0x12121e, vein: 0xb6a0ff, scale: 0.95, eyes: [{ x: 0.05, y: 0.7, z: 0.5, r: 0.38, iris: 'irisPink' }], candle: true, crooked: true, seed: 5 },
];

class Creature {
  constructor(spec, i, scene, quality) {
    const T = getTextures();
    this.spec = spec; this.i = i; this.name = spec.name;
    this.rng = mulberry32(spec.seed * 99);
    this.root = new THREE.Group(); this.root.name = 'creature-' + spec.name;
    this.body = new THREE.Group(); this.root.add(this.body);
    this.root.scale.setScalar(spec.scale);
    const skin = organicMaterial({ color: spec.color, color2: spec.color2, veinColor: spec.vein, veinAmount: 0.35, veinScale: 2.2, breath: 0.03, breathScale: 1.5, rim: 0.4, rimColor: spec.vein, roughness: 0.42, colorScale: 0.9 });
    this.skin = skin;
    const bodyG = blobGeometry(0.85, { detail: 4, noise: 0.22, noiseScale: 1.8, seed: spec.seed * 3.1, squash: [1.25, 0.82, 1.1], lumps: [{ dir: [0, 1, -0.4], size: 3, amp: 0.25 }, { dir: [spec.crooked ? 0.8 : 0.2, 0.6, 0.3], size: 5, amp: 0.2 }] });
    bodyG.translate(0, 0.62, 0);
    const parts = [bodyG];
    // back warts and dorsal spines
    for (let k = 0; k < 9; k++) {
      const a = this.rng() * Math.PI * 2, el = 0.3 + this.rng() * 1.0;
      const d = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el) - 0.3).normalize();
      const w = blobGeometry(0.1 + this.rng() * 0.12, { detail: 2, noise: 0.3 }); w.translate(d.x * 0.95, 0.62 + d.y * 0.7, d.z * 0.85); parts.push(w);
    }
    for (let k = 0; k < 6; k++) {
      const z = -0.6 + k * 0.18, y = 1.2 - Math.abs(k - 2.5) * 0.06;
      const c = new THREE.CatmullRomCurve3([V(0, y - 0.15, z), V(0, y + 0.18, z - 0.08), V(0, y + 0.32 + this.rng() * 0.2, z - 0.25)]);
      parts.push(sweepGeometry(c, { tubular: 8, radial: 5, radius: (t) => 0.07 * (1 - t), capEnd: true }));
    }
    // legs
    this.legs = [];
    const legG = new THREE.CapsuleGeometry(0.16, 0.35, 4, 8);
    for (const [lx, lz] of [[-0.6, 0.45], [0.6, 0.45], [-0.6, -0.45], [0.6, -0.45]]) {
      const leg = new THREE.Mesh(legG, skin); leg.position.set(lx, 0.28, lz); leg.rotation.z = lx > 0 ? -0.5 : 0.5; leg.castShadow = true; this.body.add(leg); this.legs.push(leg);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6), skin); foot.scale.set(1.3, 0.4, 1.6); foot.position.set(lx * 1.25, 0.06, lz + 0.08); this.body.add(foot);
    }
    const bodyMesh = new THREE.Mesh(merge(parts), skin); bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
    this.body.add(bodyMesh);
    // mouth: dark slit with crooked teeth; opens by scaling
    this.mouth = new THREE.Group(); this.mouth.position.set(0, 0.42, 0.78); this.body.add(this.mouth);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x1a0306, roughness: 0.4, emissive: 0x200204 });
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 10), mouthMat); cavity.scale.set(1.3, 0.12, 0.45); this.mouth.add(cavity);
    this.cavity = cavity;
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.35 });
    const teeth = [];
    const nt = 9 + Math.floor(this.rng() * 5);
    for (let k = 0; k < nt; k++) {
      const x = -0.55 + (k / (nt - 1)) * 1.1; const l = 0.06 + this.rng() * 0.1;
      const tg = new THREE.ConeGeometry(0.035 + this.rng() * 0.02, l, 5); tg.rotateX(Math.PI); tg.rotateZ((this.rng() - 0.5) * 0.6); tg.translate(x, 0.02 - l / 2, 0.16 - Math.abs(x) * 0.12);
      teeth.push(tg);
    }
    this.teeth = new THREE.Mesh(merge(teeth), toothMat); this.mouth.add(this.teeth);
    // eyes
    this.eyes = [];
    const scleraMat = new THREE.MeshStandardMaterial({ map: T.sclera, roughness: 0.15, emissive: 0x111111 });
    for (const e of spec.eyes) {
      const eg = new THREE.Group(); eg.position.set(e.x, e.y + 0.1, e.z);
      if (e.stalk) {
        const c = new THREE.CatmullRomCurve3([V(0, -e.stalk, -0.1), V(0.05, -e.stalk * 0.4, 0), V(0, 0, 0)]);
        const st = new THREE.Mesh(sweepGeometry(c, { tubular: 10, radial: 6, radius: (t) => 0.07 * (1 - t * 0.3) }), skin); eg.add(st);
        eg.position.y += e.stalk;
      }
      const ball = new THREE.Mesh(new THREE.SphereGeometry(e.r, 20, 14), scleraMat); eg.add(ball);
      const irisMat = new THREE.MeshStandardMaterial({ map: T[e.iris], roughness: 0.1, emissive: 0xffffff, emissiveMap: T[e.iris], emissiveIntensity: 0.35 });
      const iris = new THREE.Mesh(new THREE.CircleGeometry(e.r * 0.62, 24), irisMat); iris.position.z = e.r * 0.93; ball.add(iris);
      const lid = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.08, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), skin);
      lid.rotation.x = -1.6; eg.add(lid);
      this.body.add(eg);
      this.eyes.push({ g: eg, ball, lid, r: e.r, blinkT: this.rng() * 4 });
    }
    // extras
    this.lights = [];
    if (spec.lure) {
      const c = new THREE.CatmullRomCurve3([V(0, 1.2, -0.1), V(0, 2.2, 0.2), V(0, 2.5, 0.9), V(0, 2.2, 1.4)]);
      this.lure = new THREE.Mesh(sweepGeometry(c, { tubular: 24, radial: 6, radius: (t) => 0.06 * (1 - t * 0.5) }), skin); this.body.add(this.lure);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.6, 0.9) }));
      bulb.position.set(0, 2.05, 1.45); this.body.add(bulb); this.bulb = bulb;
      const pl = new THREE.PointLight(0xd8ff6a, 25, 9, 2); pl.position.copy(bulb.position); this.body.add(pl); this.lights.push(pl);
      const halo = glowSprite(0xd8ff6a, 1.4, 0.5); halo.position.copy(bulb.position); this.body.add(halo);
    }
    if (spec.candle) {
      const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 10), new THREE.MeshStandardMaterial({ color: 0xd8c8a8, roughness: 0.6 }));
      wax.position.set(0.55, 1.45, 0.1); wax.rotation.z = -0.3; this.body.add(wax);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.5) })); flame.scale.set(1, 2, 1); flame.position.set(0.65, 1.82, 0.1); this.body.add(flame); this.flame = flame;
      const pl = new THREE.PointLight(0xffa040, 22, 8, 2); pl.position.copy(flame.position); this.body.add(pl); this.lights.push(pl);
      const halo = glowSprite(0xffa040, 1.2, 0.6); halo.position.copy(flame.position); this.body.add(halo);
    }
    if (spec.crown) {
      const spikes = [];
      for (let k = 0; k < 11; k++) {
        const a = (k / 11) * Math.PI * 2; const r = 0.42;
        const c = new THREE.CatmullRomCurve3([V(Math.cos(a) * r, 1.18, Math.sin(a) * r - 0.1), V(Math.cos(a) * r * 1.4, 1.5, Math.sin(a) * r * 1.4 - 0.1), V(Math.cos(a) * r * 1.2, 1.75 + (k % 2) * 0.2, Math.sin(a) * r * 1.2 - 0.1)]);
        spikes.push(sweepGeometry(c, { tubular: 8, radial: 5, radius: (t) => 0.06 * (1 - t), capEnd: true }));
      }
      const cm = new THREE.Mesh(merge(spikes), organicMaterial({ color: 0xc8b890, color2: 0x5a4a30, veinColor: 0xffc060, veinAmount: 1.5, veinScale: 3, breath: 0, rim: 1.2, rimColor: 0xffc060 }));
      this.body.add(cm);
    }
    scene.add(this.root);
    // runtime state
    this.pos = V(0, 0, 0); this.heading = 0; this.target = null; this.speed = 0; this.gait = this.rng() * 10;
    this.mouthOpen = 0; this.look = null; this.lookW = 0; this.mode = 'idle'; this.pause = 0; this.startle = 0;
    this.radius = 0.95 * spec.scale;
  }

  setPosition(x, z) { this.pos.set(x, hubFloor(x, z) ?? 0, z); }

  walkTo(p, speed = 1.5) { this.target = p.clone(); this.walkSpeed = speed; }

  update(dt, t, ctx) {
    // locomotion: turn toward target, hop forward
    let moving = false;
    if (this.target && this.startle <= 0) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z; const d = Math.hypot(dx, dz);
      if (d > 0.25) {
        const want = Math.atan2(dx, dz);
        let da = want - this.heading; da = Math.atan2(Math.sin(da), Math.cos(da));
        this.heading += da * Math.min(1, dt * 3.5);
        const sp = this.walkSpeed * (Math.abs(da) > 1.2 ? 0.2 : 1);
        this.pos.x += Math.sin(this.heading) * sp * dt; this.pos.z += Math.cos(this.heading) * sp * dt;
        moving = true;
      } else this.target = null;
    }
    // keep off the altar and out of the void
    const ax = this.pos.x - L.ritual.x, az = this.pos.z - L.ritual.z, ad = Math.hypot(ax, az);
    if (ad < 4.4) { this.pos.x = L.ritual.x + ax / ad * 4.4; this.pos.z = L.ritual.z + az / ad * 4.4; }
    let fh = hubFloor(this.pos.x, this.pos.z); if (fh === null) { this.pos.multiplyScalar(0.98); fh = 0; }
    this.pos.y = fh;
    this.gait += dt * (moving ? 7.5 : 0) / Math.sqrt(this.spec.scale);
    const hop = moving ? Math.abs(Math.sin(this.gait)) * 0.28 : 0;
    this.root.position.set(this.pos.x, this.pos.y + hop * this.spec.scale, this.pos.z);
    // facing: heading, optionally overridden by a look target
    let face = this.heading;
    if (this.look && !moving) { const lx = this.look.x - this.pos.x, lz = this.look.z - this.pos.z; let want = Math.atan2(lx, lz); let da = want - this.heading; da = Math.atan2(Math.sin(da), Math.cos(da)); this.heading += da * Math.min(1, dt * 2.5); face = this.heading; }
    this.root.rotation.y = face;
    // body squash, breathing, chant sway
    const chant = this.mode === 'chant' || this.mode === 'procession';
    const breath = Math.sin(t * 1.3 + this.i) * 0.03;
    const sway = chant ? Math.sin(t * 2.2 + this.i * 0.6) * 0.18 : 0;
    const bow = this.mode === 'bow' ? 0.55 : 0;
    this.body.rotation.z = sway + (this.spec.crooked ? 0.12 : 0);
    this.body.rotation.x = bow + (moving ? Math.sin(this.gait * 2) * 0.08 : 0) - (chant ? 0.22 : 0) + (this.startle > 0 ? -0.3 : 0);
    const sq = moving ? 1 - Math.abs(Math.cos(this.gait)) * 0.08 : 1 + breath;
    this.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    this.legs.forEach((lg, k) => { lg.rotation.x = moving ? Math.sin(this.gait + k * Math.PI) * 0.5 : 0; });
    // mouth: chant opens it in time with the heart
    const targetOpen = chant ? 0.4 + 0.6 * Math.max(0, Math.sin(t * 4.4 + this.i * 0.3)) * (0.6 + U.heartbeat.value * 0.6) : (this.startle > 0 ? 0.9 : 0.05 + 0.05 * Math.sin(t * 0.7 + this.i));
    this.mouthOpen += (targetOpen - this.mouthOpen) * Math.min(1, dt * 10);
    this.cavity.scale.y = 0.08 + this.mouthOpen * 0.55;
    this.teeth.position.y = this.mouthOpen * 0.14;
    // eyes: blink and track
    for (const e of this.eyes) {
      e.blinkT -= dt;
      let lid = -1.6;
      if (e.blinkT < 0) { lid = 1.45; if (e.blinkT < -0.14) e.blinkT = 1.5 + this.rng() * 5; }
      if (this.mode === 'bow') lid = 0.7;
      e.lid.rotation.x += (lid - e.lid.rotation.x) * Math.min(1, dt * 25);
      if (this.look) {
        const wp = this.look.clone(); this.body.worldToLocal(wp);
        const dir = wp.sub(e.g.position).normalize();
        e.ball.rotation.y = THREE.MathUtils.clamp(Math.atan2(dir.x, dir.z), -0.7, 0.7);
        e.ball.rotation.x = THREE.MathUtils.clamp(-Math.asin(dir.y), -0.5, 0.5);
      }
    }
    if (this.lure) this.lure.rotation.z = Math.sin(t * 1.7 + this.i) * 0.1;
    if (this.bulb) { const k = 1 + 0.4 * Math.sin(t * 3 + this.i) + (chant ? 0.8 : 0); this.bulb.material.color.setRGB(2.2 * k, 2.6 * k, 0.9 * k); }
    if (this.flame) { this.flame.scale.set(1, 2 + Math.sin(t * 13) * 0.3 + Math.sin(t * 7.3) * 0.2, 1); this.lights[0].intensity = 18 + Math.sin(t * 11) * 3 + Math.sin(t * 17.3) * 2; }
    this.startle = Math.max(0, this.startle - dt);
  }
}

export class Congregation {
  constructor(scene, quality) {
    this.creatures = SPECS.map((s, i) => new Creature(s, i, scene, quality));
    const starts = [[-8, 12], [10, 4], [-12, -10], [6, 16], [12, -12]];
    this.creatures.forEach((c, i) => { c.setPosition(...starts[i]); c.heading = Math.random() * 6; });
    this.phase = 'wander'; this.phaseT = 0;
    this.durations = { wander: 22, gather: 14, chant: 16, procession: 16, bow: 6 };
    this.ring = 0; this.ritualLevel = 0;
    this.listeners = [];
    this.debugForce = null;
  }
  get obstacles() { return this.creatures.map((c) => ({ x: c.pos.x, z: c.pos.z, r: c.radius * 0.8 })); }
  slot(i, extra = 0) {
    const n = this.creatures.length; const a = (i / n) * Math.PI * 2 + this.ring + extra;
    const r = 6.2; return V(L.ritual.x + Math.cos(a) * r, 0, L.ritual.z + Math.sin(a) * r);
  }
  setPhase(p) { this.phase = p; this.phaseT = 0; this.listeners.forEach((f) => f(p)); }
  startle(at) { for (const c of this.creatures) { c.startle = 2.5 + Math.random(); c.look = at.clone(); c.target = null; } }
  update(dt, t, ctx) {
    this.phaseT += dt;
    const P = this.phase, dur = this.durations[P];
    const player = ctx.player?.position;
    // phase transitions (the ceremony runs on its own clock)
    if (P === 'wander' && this.phaseT > dur) this.setPhase('gather');
    else if (P === 'gather' && (this.phaseT > dur || this.creatures.every((c) => !c.target))) this.setPhase('chant');
    else if (P === 'chant' && this.phaseT > dur) this.setPhase('procession');
    else if (P === 'procession' && this.phaseT > dur) this.setPhase('bow');
    else if (P === 'bow' && this.phaseT > dur) { this.setPhase('wander'); this.creatures.forEach((c) => (c.target = null)); }
    const want = { wander: 0, gather: 0.15, chant: 0.75, procession: 1, bow: 0.6 }[this.phase];
    this.ritualLevel += (want - this.ritualLevel) * Math.min(1, dt * 0.35);
    U.ritual.value = this.ritualLevel;
    this.creatures.forEach((c, i) => {
      if (this.phase === 'wander') {
        c.mode = 'idle';
        if (!c.target && c.startle <= 0) {
          c.pause -= dt;
          if (c.pause <= 0) {
            const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 18;
            const p = V(Math.cos(a) * r, 0, Math.sin(a) * r);
            if (hubFloor(p.x, p.z) !== null && p.distanceTo(L.sword) > 4) c.walkTo(p, 1.1 + Math.random() * 0.6);
            c.pause = 2 + Math.random() * 5;
          }
        }
        // curiosity / shyness toward the visitor
        if (player) {
          const d = Math.hypot(player.x - c.pos.x, player.z - c.pos.z);
          if (d < 9) c.look = player.clone().setY(player.y + 1.2); else if (c.startle <= 0) c.look = null;
          if (d < 2.6 && c.startle <= 0) { const away = V(c.pos.x - player.x, 0, c.pos.z - player.z).normalize().multiplyScalar(4); const p = c.pos.clone().add(away); if (hubFloor(p.x, p.z) !== null) c.walkTo(p, 2.6); }
        }
      } else if (this.phase === 'gather') {
        c.mode = 'gather';
        if (this.phaseT < 0.1 || (!c.target && c.pos.distanceTo(this.slot(i).setY(c.pos.y)) > 0.5)) c.walkTo(this.slot(i), 1.6);
        c.look = L.ritual.clone().setY(2.5);
      } else if (this.phase === 'chant' || this.phase === 'bow') {
        c.mode = this.phase; c.target = null; c.look = L.ritual.clone().setY(this.phase === 'bow' ? 0 : 3.5);
        const s = this.slot(i); c.pos.x += (s.x - c.pos.x) * dt; c.pos.z += (s.z - c.pos.z) * dt;
      } else if (this.phase === 'procession') {
        c.mode = 'procession';
        this.ring += dt * 0.05 / this.creatures.length;
        const s = this.slot(i, 0.35);
        c.walkTo(s, 1.4);
        c.look = null;
      }
      c.update(dt, t, ctx);
    });
    // gently separate overlapping creatures
    for (let a = 0; a < this.creatures.length; a++) for (let b = a + 1; b < this.creatures.length; b++) {
      const A = this.creatures[a], B = this.creatures[b];
      const dx = B.pos.x - A.pos.x, dz = B.pos.z - A.pos.z, d = Math.hypot(dx, dz), m = (A.radius + B.radius) * 0.9;
      if (d < m && d > 1e-3) { const k = (m - d) / d * 0.5; A.pos.x -= dx * k; A.pos.z -= dz * k; B.pos.x += dx * k; B.pos.z += dz * k; }
    }
  }
}
