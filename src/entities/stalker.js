// The stalker. Something tall and thin that lives in the jungle and has decided you are interesting.
// It keeps its distance, prefers to stand where the leaves are thickest, and moves mostly where you
// are not looking. Sometimes it stops and lets its eyes catch the light (a peek); look straight at it
// and it is gone in a crash of leaves. Sometimes it circles you, breathing. Very rarely it rushes in
// from behind and simply is not there any more. It runs on its own clock whether you watch or not.
import * as THREE from 'three';
import { sweepGeometry, blobGeometry } from '../geometry/sweep.js';
import { merge } from '../geometry/generators.js';
import { organicMaterial } from '../materials/library.js';
import { glowSprite } from './heart.js';
import { FOLIAGE } from '../zones/foliage.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export class Stalker {
  constructor(scene, jungle) {
    this.jungle = jungle;
    this.group = new THREE.Group(); this.group.name = 'stalker'; jungle.root.add(this.group);
    const skin = organicMaterial({ color: 0x080907, color2: 0x020302, veinColor: 0x5aff9a, veinAmount: 0.15, veinScale: 3, breath: 0.15, roughness: 0.9, rim: 0.6, rimColor: 0x41604a, normalMap: null });
    // hunched torso, long neck, a narrow skull with a hanging jaw
    const torso = blobGeometry(0.55, { detail: 3, noise: 0.25, seed: 3, squash: [0.75, 1.5, 0.6] }); torso.rotateX(0.5); torso.translate(0, 1.75, 0);
    const neck = sweepGeometry(new THREE.CatmullRomCurve3([V(0, 2.4, 0.2), V(0, 2.7, 0.55), V(0, 2.65, 0.95)]), { tubular: 12, radial: 7, radius: (t) => 0.16 - t * 0.05 });
    const ribs = []; for (let k = 0; k < 6; k++) { const y = 1.35 + k * 0.17; ribs.push(sweepGeometry(new THREE.CatmullRomCurve3([V(-0.38, y, 0.05), V(0, y + 0.08, 0.45), V(0.38, y, 0.05)]), { tubular: 10, radial: 5, radius: () => 0.035 })); }
    this.body = new THREE.Mesh(merge([torso, neck, ...ribs]), skin); this.group.add(this.body);
    this.head = new THREE.Group(); this.head.position.set(0, 2.65, 1.0); this.group.add(this.head);
    const skull = blobGeometry(0.22, { detail: 3, noise: 0.2, seed: 9, squash: [0.8, 0.8, 1.6] }); skull.translate(0, 0, 0.15);
    const jaw = blobGeometry(0.15, { detail: 2, noise: 0.25, seed: 11, squash: [0.7, 0.4, 1.8] }); jaw.translate(0, -0.17, 0.25);
    this.head.add(new THREE.Mesh(merge([skull, jaw]), skin));
    // eyes: three, small, wet; they only catch the light when it wants you to see them
    this.eyes = [];
    [[-0.09, 0.05, 0.36, 1], [0.09, 0.05, 0.36, 1], [0, 0.13, 0.3, 0.6]].forEach(([x, y, z, s]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.045 * s, 10, 8), new THREE.MeshBasicMaterial({ color: 0xdfff7a, transparent: true, opacity: 0, fog: false }));
      m.position.set(x, y, z); this.head.add(m);
      const gl = glowSprite(0xc8ff6a, 0.7 * s, 0); gl.position.set(x, y, z + 0.02); gl.material.fog = false; this.head.add(gl);
      this.eyes.push(m, gl);
    });
    // limbs: long arms that knuckle-walk, legs folded like a heron's
    this.limbs = [];
    const limb = (side, front) => {
      const g = new THREE.Group(); g.position.set(side * 0.35, front ? 2.15 : 1.25, front ? 0.45 : -0.1); this.group.add(g);
      const L = front ? 2.3 : 1.4;
      const c = new THREE.CatmullRomCurve3([V(0, 0, 0), V(side * 0.35, -L * 0.45, front ? 0.35 : -0.3), V(side * 0.25, -L, front ? 0.6 : 0.1)]);
      const parts = [sweepGeometry(c, { tubular: 16, radial: 6, radius: (t) => 0.07 * (1 - 0.6 * t) + 0.02 })];
      if (front) for (let k = -1; k <= 1; k++) parts.push(sweepGeometry(new THREE.CatmullRomCurve3([V(side * 0.25, -L, 0.6), V(side * 0.25 + k * 0.08, -L - 0.05, 0.75), V(side * 0.25 + k * 0.12, -L - 0.1, 0.95)]), { tubular: 6, radial: 4, radius: (t) => 0.025 * (1 - t) + 0.006 }));
      g.add(new THREE.Mesh(merge(parts), skin));
      this.limbs.push({ g, side, front });
    };
    limb(-1, true); limb(1, true); limb(-1, false); limb(1, false);
    this.group.scale.setScalar(1.1);

    this.pos = jungle.center.clone().add(V(14, 0, -6)); this.vel = new THREE.Vector3();
    this.target = this.pos.clone(); this.state = 'hidden'; this.stateT = 0; this.stateDur = 8;
    this.eyeK = 0; this.rustle = 0; this.breath = 0; this.lookedAt = 0; this.lastRush = -40; this.trail = this.pos.clone();
    this.decoy = V(1e5, 0, 0); this.decoyK = 0; this.time = 0;
    this.sounds = null; // JungleAudio
    this.onRush = null;
  }

  setState(s, dur) { this.state = s; this.stateT = 0; this.stateDur = dur ?? this.stateDur; this._picked = false; }

  _coverSpot(player, camFwd, { rMin, rMax, inView = false, behind = false }) {
    const J = this.jungle; let best = null;
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin);
      const x = player.x + Math.cos(a) * r, z = player.z + Math.sin(a) * r;
      if (J.ground(x, z) === null) continue;
      if (J.trunks.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + 0.6)) continue;
      const dir = V(x - player.x, 0, z - player.z).normalize();
      const f = V(camFwd.x, 0, camFwd.z).normalize();
      const dot = dir.dot(f);
      let score = Math.min(1.5, J.coverAt(x, z)) - 0.05 * Math.abs(r - (rMin + rMax) / 2);
      if (inView) score += dot > 0.7 && dot < 0.93 ? 1 : -1; // the edge of your vision
      if (behind) score += (1 - dot) * 0.6;
      if (!best || score > best.score) best = { x, z, score };
    }
    return best ? V(best.x, 0, best.z) : null;
  }

  update(dt, t, player, camera) {
    this.time = t; this.stateT += dt;
    const J = this.jungle, P = player.position;
    const camFwd = camera.getWorldDirection(V(0, 0, 0));
    const toMe = this.pos.clone().sub(camera.position); const dist = Math.hypot(toMe.x, toMe.z);
    const ang = Math.acos(Math.min(1, Math.max(-1, toMe.clone().normalize().dot(camFwd))));
    const S = this.sounds;
    let speed = 2.2, rustle = 0.25, breath = 0.35, eyes = 0;
    switch (this.state) {
      case 'hidden':
        this.group.visible = false; rustle = 0; breath = 0;
        if (this.stateT > this.stateDur) { const p = this._coverSpot(P, camFwd, { rMin: 16, rMax: 22, behind: true }); if (p) this.pos.copy(p); this.group.visible = true; this.setState('stalk', 10 + Math.random() * 10); }
        break;
      case 'stalk':
        if (!this._picked || this.stateT % 6 < dt) { const p = this._coverSpot(P, camFwd, { rMin: 8, rMax: 13, behind: true }); if (p) this.target.copy(p); this._picked = true; }
        if (Math.random() < dt / 25 && S) S.thump(this.pos, 0.5);
        if (this.stateT > this.stateDur) {
          const r = Math.random();
          if (r < 0.15 && t - this.lastRush > 55) this.setState('rush', 3);
          else if (r < 0.6) this.setState('peek', 3 + Math.random() * 3);
          else if (r < 0.85) this.setState('circle', 6 + Math.random() * 5);
          else this.setState('stalk', 8 + Math.random() * 8);
        }
        break;
      case 'peek':
        if (!this._picked) { const p = this._coverSpot(P, camFwd, { rMin: 7, rMax: 11, inView: true }); if (p) this.target.copy(p); this._picked = true; this._arrived = false; }
        speed = this._arrived ? 0 : 4.5; rustle = this._arrived ? 0.35 : 0.5; breath = 0.55;
        if (!this._arrived && this.pos.distanceTo(this.target.clone().setY(this.pos.y)) < 0.6) { this._arrived = true; this.stateT = 0; if (S) S.clicks(this.head.getWorldPosition(V(0, 0, 0))); }
        if (this._arrived) eyes = Math.min(1, this.stateT * 1.5);
        if (this._arrived && this.stateT > this.stateDur) this.setState('stalk', 8 + Math.random() * 8);
        if (!this._arrived && this.stateT > 6) this._arrived = true;
        break;
      case 'circle': {
        if (!this._picked) { this._ca = Math.atan2(this.pos.z - P.z, this.pos.x - P.x); this._cdir = Math.random() < 0.5 ? -1 : 1; this._picked = true; }
        this._ca += this._cdir * dt * 0.45;
        this.target.set(P.x + Math.cos(this._ca) * 7.5, 0, P.z + Math.sin(this._ca) * 7.5);
        speed = 4; rustle = 0.75; breath = 1; eyes = Math.sin(this.stateT * 0.9) > 0.85 ? 0.6 : 0;
        if (this.stateT > this.stateDur) this.setState('stalk', 10 + Math.random() * 8);
        break;
      }
      case 'rush': {
        if (!this._picked) {
          const p = V(P.x - camFwd.x * 14, 0, P.z - camFwd.z * 14);
          if (J.ground(p.x, p.z) !== null) this.pos.set(p.x, this.pos.y, p.z);
          this._picked = true; this.lastRush = t; if (S) { S.thump(this.pos, 1); S.growl(this.pos, 1); }
        }
        this.target.set(P.x, 0, P.z); speed = 9; rustle = 1; breath = 1; eyes = 1;
        if (dist < 2.3 || this.stateT > 3) {
          // ...and it is not there any more
          this.decoy.copy(this.pos); this.decoyK = 1.4;
          if (S) S.clicks(this.pos, 4);
          this.onRush?.();
          this.setState('hidden', 9 + Math.random() * 8); this.group.visible = false;
        }
        break;
      }
      case 'retreat': {
        if (!this._picked) {
          const away = V(this.pos.x - P.x, 0, this.pos.z - P.z).normalize();
          this.target.set(P.x + away.x * 20, 0, P.z + away.z * 20);
          if (J.ground(this.target.x, this.target.z) === null) this.target.set(P.x - away.x * 4 + away.z * 16, 0, P.z - away.z * 4 - away.x * 16);
          this._picked = true; if (S && Math.random() < 0.6) S.growl(this.pos, 0.7);
        }
        speed = 7.5; rustle = 1; breath = 0.8;
        if (this.stateT > 2.5) this.setState(Math.random() < 0.5 ? 'hidden' : 'stalk', Math.random() < 0.5 ? 6 : 10);
        break;
      }
    }
    // looked at directly while visible and fairly close -> it bolts
    if (this.group.visible && this.state !== 'retreat' && this.state !== 'rush' && this.state !== 'hidden') {
      const seen = ang < 0.2 && dist < 24;
      this.lookedAt = seen ? this.lookedAt + dt : Math.max(0, this.lookedAt - dt * 2);
      if (this.lookedAt > (this.state === 'peek' ? 0.45 : 0.8) || dist < 3.5) { this.lookedAt = 0; eyes = 0; this.setState('retreat'); }
    }
    // move (slide around trunks, stay inside the jungle)
    if (this.group.visible && speed > 0) {
      const d = V(this.target.x - this.pos.x, 0, this.target.z - this.pos.z);
      const L = d.length();
      if (L > 0.05) { d.multiplyScalar(Math.min(speed * dt, L) / L); this.vel.lerp(d.clone().divideScalar(dt), Math.min(1, dt * 4)); } else this.vel.multiplyScalar(0.8);
      const np = this.pos.clone().addScaledVector(this.vel, dt);
      for (const tr of J.trunks) { const dx = np.x - tr.x, dz = np.z - tr.z, dd = Math.hypot(dx, dz), m = tr.r + 0.55; if (dd < m) { np.x = tr.x + dx / dd * m; np.z = tr.z + dz / dd * m; } }
      if (J.ground(np.x, np.z) !== null) this.pos.copy(np);
    } else this.vel.multiplyScalar(0.8);
    const gy = J.ground(this.pos.x, this.pos.z); if (gy !== null) this.pos.y = gy;
    // pose: face its way of travel (or you, when still), gait, head tilt
    const mv = Math.hypot(this.vel.x, this.vel.z);
    const face = mv > 0.3 ? Math.atan2(this.vel.x, this.vel.z) : Math.atan2(P.x - this.pos.x, P.z - this.pos.z);
    let dy = face - this.group.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.group.rotation.y += dy * Math.min(1, dt * 5);
    this.group.position.copy(this.pos);
    const gait = t * (2 + mv * 1.6);
    this.limbs.forEach((l, i) => { l.g.rotation.x = Math.sin(gait + i * Math.PI * 0.5 + (l.side > 0 ? Math.PI : 0)) * Math.min(0.6, mv * 0.15); });
    this.body.position.y = Math.sin(gait * 2) * 0.03 * Math.min(1, mv) - (this.state === 'peek' ? 0.25 : 0);
    this.head.rotation.z = this.state === 'peek' ? Math.sin(t * 0.8) * 0.4 + 0.3 : Math.sin(t * 0.5) * 0.1;
    this.head.rotation.x = Math.sin(t * 1.3) * 0.08;
    // eyes
    this.eyeK += (eyes - this.eyeK) * Math.min(1, dt * (eyes > this.eyeK ? 3 : 12));
    const blink = (t % 4.3) < 0.12 ? 0 : 1;
    this.eyes.forEach((m, i) => { m.material.opacity = (i % 2 ? 0.8 : 1) * this.eyeK * blink; });
    // rustle sources for the leaf shader and the audio
    this.rustle += (rustle * (this.group.visible ? 1 : 0) * (0.3 + Math.min(1, mv / 3)) - this.rustle) * Math.min(1, dt * 5);
    if (this.state === 'peek' && this._arrived) this.rustle = Math.max(this.rustle, 0.35 + 0.25 * Math.sin(t * 6));
    this.breath += (breath * (this.group.visible ? 1 : 0) - this.breath) * Math.min(1, dt * 2);
    this.trail.lerp(this.pos, Math.min(1, dt * 1.5));
    this.decoyK = Math.max(0, this.decoyK - dt * 0.6);
    // occasionally a bush shakes somewhere it is not, to keep you guessing
    if (Math.random() < dt / 14 && this.decoyK <= 0) { const p = this._coverSpot(P, camFwd, { rMin: 5, rMax: 12, inView: true }); if (p) { this.decoy.set(p.x, J.hAt(p.x, p.z) + 1, p.z); this.decoyK = 1; } }
    const R = FOLIAGE.uRustle.value;
    R[0].set(this.pos.x, this.pos.y + 1.4, this.pos.z, this.rustle * 1.4);
    R[1].set(this.trail.x, this.trail.y + 1.2, this.trail.z, this.rustle * 0.6);
    R[2].set(this.decoy.x, this.decoy.y, this.decoy.z, Math.min(1, this.decoyK) * 0.9);
    return {
      pos: this.pos.clone().setY(this.pos.y + 2), breath: this.breath,
      rustle: Math.max(this.rustle, this.decoyK > 0 ? this.decoyK * 0.6 : 0), rustlePos: this.decoyK > this.rustle ? this.decoy : this.pos.clone().setY(this.pos.y + 1.2),
    };
  }
}
