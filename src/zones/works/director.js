// Runs the Works scene from src/data/worksScript.js: lines go to the speech layer (and to synthesised
// voices / the PA), events move the world. Every event can also be applied "instantly", which is
// how jump(label) rebuilds the state of any point in the scene (debug API + screenshots).
import { PA } from '../../story/style/toon.js';
import * as THREE from 'three';
import { WORKS_SCRIPT } from '../../data/worksScript.js';
import { WL, WORKS } from './layout.js';
import { floodHeight } from './shaders.js';
import { screen as _screen, crt } from './paint.js';
import { clockFace } from './factory.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const ease = (t) => t * t * (3 - 2 * t);
const STYLE = {
  k: { color: '#ffe3a8' }, m: { color: '#d6e6ff' }, d: { color: '#f4efe4' }, w: { color: '#ffffff' },
  y: { color: '#ffb347', font: 'VT323', weight: '400' }, yk: { color: '#ffd89a', font: 'VT323', weight: '400' }, t: { color: '#e8f4ff', font: 'VT323', weight: '400' }, all: { color: '#ffb347', font: 'VT323', weight: '400' },
};
const F0 = { k: 108, m: 124, d: 140, w: 150 };
void _screen;

export class Director {
  constructor(ctx) {
    Object.assign(this, ctx); // factory, flood, hold, cast, audio(WorksAudio), speech, voice, root, collision, rides, getCamera
    this.i = 0; this.wait = 0; this.gate = null; this.pulls = 0; this.running = false; this.busy = null; this.timers = [];
    this.tweens = []; this.state = {};
    this.labels = {}; WORKS_SCRIPT.forEach((s, i) => { if (s.label) this.labels[s.label] = i; });
    this.mossAnchor = new THREE.Object3D(); this.root.add(this.mossAnchor);
  }
  W(v) { return v.clone().add(WORKS); }
  camLocal() { return this.getCamera().position.clone().sub(WORKS); }
  /** a tween on anything: fn(k) for k 0..1 over dur */
  tween(dur, fn, done) { const tw = { t: 0, dur, fn, done }; this.tweens.push(tw); if (this.instant) { fn(1); done?.(); this.tweens.pop(); } return tw; }
  later(sec, fn) { if (this.instant) { fn(); return; } this.timers.push({ t: sec, fn }); }

  reset() {
    this.i = 0; this.wait = 0; this.gate = null; this.pulls = 0; this.running = false; this.tweens = []; this.timers = []; this.state = { alarm: 0, power: 1 };
    const { cast: C, factory: F, flood, hold } = this;
    flood.reset(); hold.group.visible = false;
    F.alarm = 0; F.power = 1; F.setGauge(0.1); F.wheel.rotation.z = 0; F.leaves.forEach((l) => { l.hinge.rotation.y = 0; }); F.doorWall.off = false;
    F.barricade.visible = false; F.barricade.scale.setScalar(1); F.barricade.rotation.set(0, 0, 0); F.barricade.position.y = 0;
    F.plates.forEach((p) => { p.open = 0; p.m.visible = true; }); F.pit.open = false; F.throat.visible = true; F.plug.position.set(WL.drain.x, 0, WL.drain.z); F.plug.rotation.set(0, 0, 0); F.chain.visible = false; F.grate.visible = true;
    F.button.position.z = 0.14; F.cjpValves.forEach((v) => (v.rotation.z = 0));
    F.screens.forEach((s) => s.draw((c, w, h) => crt(c, w, h, ['KEATLAND NEUROCHEMICAL', 'LINE 1: NOMINAL', '> _'], { size: 44 })));
    F.screens.clock.draw((c, w, h) => clockFace(c, w, h, '3:16 AM'));
    F.bottlerObs.off = false; F.pullVatObs.off = false; this.cages?.forEach((c) => c.forEach((w) => (w.off = true)));
    C.keaten.visible = true; C.keaten.mode = 'ground'; C.keaten.attach = null; C.keaten.dip = 0; C.keaten.place(WL.stairFoot.clone().add(V(-1.4, 0, 1.6)), 2.6); C.keaten.rest = 'stand'; C.keaten.face = 'player';
    C.dale.visible = true; C.dale.mode = 'ground'; C.dale.attach = null; C.dale.place(WL.stairFoot.clone().add(V(1.0, 0, -0.8)), 2.4); C.dale.rest = 'stand'; C.dale.face = 'player';
    C.worker.place(V(-3, WL.catwalkY, -12.6), 0); C.worker.rest = 'stand'; C.worker.fig.pose = 'stand';
    C.hat.visible = false; C.pen.visible = false; C.cig.visible = false; C.wheel.visible = false; C.cookie.visible = false; C.dollar.visible = false; C.pack.visible = false;
    C.office.visible = false; C.ceiling.visible = false; C.drawer.position.z = -0.1; Object.values(C.items).forEach((o) => (o.visible = false));
    if (C.pen.parent) C.pen.parent.remove(C.pen); if (C.cig.parent) C.cig.parent.remove(C.cig);
    this.speech.clear();
  }
  start() { this.reset(); this.running = true; }
  /** rebuild the state at a label (instantly applying every event before it) and run from there */
  jump(label) {
    const to = this.labels[label]; if (to === undefined) return false;
    this.reset(); this.instant = true;
    for (let k = 0; k < to; k++) { const s = WORKS_SCRIPT[k]; if (s.do) this.event(s); if (s.gate === 'pull') this.pulls++; }
    // settle actor paths
    for (const a of [this.cast.keaten, this.cast.dale]) if (a.path.length) { a.p.copy(a.path.at(-1)); a.path = []; a.fig.pose = a.rest; a.onArrive?.(); a.onArrive = null; }
    this.instant = false; this.i = to; this.running = true; this.wait = 0.5;
    return true;
  }

  // ------------------------------------------------------------------ lines
  line(who, text, opt = {}) {
    const C = this.cast, st = { ...STYLE[who] }; let follow = null, pos = V(), height = 0.4;
    const caps = text === text.toUpperCase() && /[A-Z]/.test(text);
    const dur = Math.min(9, 1.0 + text.length * 0.062);
    if (who === 'k') { follow = C.keaten.fig.head; height = C.hat.visible ? 0.55 : 0.42; }
    else if (who === 'd') { follow = C.dale.fig.head; }
    else if (who === 'w') { follow = C.worker.fig.head; }
    else if (who === 'm') { follow = this.mossAnchor; height = 0; }
    if (who === 'y' || who === 'yk' || who === 't' || who === 'all') {
      const cam = this.camLocal();
      const sp = this.factory.speakers.map((p) => ({ p, d: p.distanceToSquared(cam) })).sort((a, b) => a.d - b.d);
      const use = who === 'all' ? sp : sp.slice(0, 3);
      if (who === 'all') for (const s of sp.slice(0, 4)) this.speech.say(text, s.p.clone().add(V(0, -0.6, 0)), { style: st, life: dur + 1.5, scale: 1.3 });
      else this.speech.say(text, sp[0].p.clone().add(V(0, -0.7, 0)), { style: st, life: dur + 2.5, scale: 1.25 });
      PA.talk = Math.max(PA.talk, dur); // the speaker critters flap along
      const p = this.audio.pa({ text }, use.map((s) => this.W(s.p)));
      return { dur: dur + 1.8, promise: p };
    }
    this.speech.say(text, pos, { follow, height, style: st, life: dur + 0.9, scale: caps ? 1.18 : opt.whisper ? 0.8 : 1 });
    const at = who === 'm' ? this.getCamera().position.clone() : follow.getWorldPosition(V());
    this.audio.babble(text, at, { f0: F0[who] ?? 130, shout: caps });
    return { dur };
  }

  // ------------------------------------------------------------------ per frame
  update(dt, t) {
    const cam = this.getCamera();
    // Moss's words appear just in front of you, a little low
    const fwd = V(0, 0, -1).applyQuaternion(cam.quaternion); fwd.y *= 0.3; fwd.normalize();
    this.mossAnchor.position.copy(cam.position).sub(WORKS).addScaledVector(fwd, 2.4).add(V(0, -0.5, 0));
    for (const tw of [...this.tweens]) { tw.t += dt; const k = Math.min(1, tw.t / tw.dur); tw.fn(k); if (k >= 1) { this.tweens.splice(this.tweens.indexOf(tw), 1); tw.done?.(); } }
    for (const tm of [...this.timers]) { tm.t -= dt; if (tm.t <= 0) { this.timers.splice(this.timers.indexOf(tm), 1); tm.fn(); } }
    this.tick?.(dt, t);
    if (!this.running) return;
    if (this.gate) { this.gateT += dt; if (this.gateT > 40) this.pass(); return; }
    if (this.waitPromise) return;
    this.wait -= dt; if (this.wait > 0) return;
    if (this.i >= WORKS_SCRIPT.length) { this.running = false; return; }
    const s = WORKS_SCRIPT[this.i++];
    if (Array.isArray(s)) {
      const r = this.line(s[0], s[1], s[2] || {});
      this.wait = r.dur * 0.92;
      if (r.promise) { this.waitPromise = true; const done = () => { this.waitPromise = false; this.wait = 0.4; }; Promise.race([r.promise, new Promise((res) => setTimeout(res, 14000))]).then(done); }
    } else if (s.wait) this.wait = s.wait;
    else if (s.gate) { this.gate = s.gate; this.gateT = 0; }
    else if (s.do) { this.event(s); this.wait = 0.05; }
  }
  /** the player did the thing the gate waits for */
  pass() {
    if (!this.gate) return false;
    if (this.gate === 'pull') { this.pulls++; this.heave(); }
    this.gate = null; this.wait = 0.6; return true;
  }
  heave() {
    const C = this.cast; this.rides.tug();
    C.keaten.fig.t += 0.3; C.dale.fig.t += 0.5;
    const F = this.factory; const k = this.pulls;
    F.plug.position.y = Math.min(0.6, k * 0.15);
  }

  // ------------------------------------------------------------------ world events
  event(s) {
    const { cast: C, factory: F, flood, audio: A, rides: R } = this, I = this.instant, DR = WL.drain;
    const W = (v) => this.W(v);
    const shake = (k) => { if (!I) this.rides.shake(k); };
    switch (s.do) {
      case 'keatenTo': {
        const pts = { tour: [V(14, 0, -18), V(8, 0, 6), V(10, 0, 12.5)], line: [V(4, 0, 18.5), V(-1.5, 0, 21.2)], cjp: [V(-6.8, 0, 8.4)] }[s.to];
        C.keaten.face = 'player'; C.keaten.go(pts, { speed: 1.2 }); break;
      }
      case 'keatenCane': C.keaten.fig.t += 0; if (!I) A.tch(W(C.keaten.p), 0.4); break;
      case 'daleTo': {
        const pts = { valve: [V(19, 0, -14), V(18.6, 0, 10), V(17.5, 0, 18.15)], cjp: [F.cjp.localToWorld(V(0.3, 0, 0.75)).sub(WORKS).setY(0)] }[s.to];
        C.dale.face = s.to === 'valve' ? V(17.5, 0, 25) : V(WL.cjp.x, 0, WL.cjp.z); C.dale.go(pts, { speed: s.to === 'valve' ? 1.6 : 1.2, rest: s.to === 'valve' ? 'hold' : 'stand' }); break;
      }
      case 'daleGrab': C.dale.rest = 'hold'; C.dale.fig.pose = 'hold'; C.dale.face = V(17.5, 0, 25); break;
      case 'lookLine': C.keaten.face = V(0, 1, 26); break;
      case 'squeak': if (!I) A.squeak(W(V(17.5, 1.25, 19.2))); F.wheel.rotation.z += 0.08; break;
      case 'valve': { const from = F.wheel.rotation.z, to = from + s.turn * Math.PI * 2; this.tween(s.turn > 0.5 ? 1.6 : 0.7, (k) => { F.wheel.rotation.z = from + (to - from) * ease(k); }); if (!I) { A.squeak(W(V(17.5, 1.25, 19.2))); this.later(0.4, () => A.squeak(W(V(17.5, 1.25, 19.2)))); } break; }
      case 'alarm': F.alarm = s.on; A.setAlarm(s.on); this.state.alarm = s.on; break;
      case 'gauge': { const g0 = this.state.gauge ?? 0.1; this.tween(s.dur, (k) => { const v = g0 + (s.to - g0) * ease(k); F.setGauge(v + (I ? 0 : Math.sin(k * 40) * 0.006)); this.state.gauge = v; }); break; }
      case 'rumble': if (!I) { A.mmmng(W(V(0, 2, 0)), 4); this.state.rumble = 1; this.tween(4, (k) => { this.state.rumble = k; }); } break;
      case 'tophat': C.hat.visible = true; C.keaten.face = V(-WL.hx, 1, 0); break;
      case 'doorsBurst': {
        F.doorWall.off = true;
        F.leaves.forEach((l) => { this.tween(0.9, (k) => { l.hinge.rotation.y = -l.s * (Math.PI / 2) * 0.92 * (1 - Math.pow(1 - k, 3)); }); });
        if (!I) { A.doorsBurst(W(V(-WL.hx, 6, 0))); shake(1.2); }
        C.keaten.face = V(-WL.hx, 1, 0); break;
      }
      case 'surge': if (I) flood.full(1.05); else flood.surge(8.5, 1.05); this.state.floodOn = 1; break;
      case 'swept': {
        // the tide hits: Keaten braces against the line railing, Dale is waist-deep by the valve, you are shoved against the railing
        C.keaten.go([V(-0.5, 0, 22.3)], { speed: 3.5, rest: 'hold' }); C.keaten.face = V(-WL.hx, 1, 0);
        C.dale.face = V(0, 0, 22);
        R.to(V(1.4, 0, 21.8), Math.PI / 2 + 0.25, -0.05, I ? 0 : 3.2, { delay: I ? 0 : 1.4, shake: 0.6 });
        break;
      }
      case 'guitar': if (!I) A.guitar(W(V(-6, 1, 12))); flood.float('guitar', V(-10, 1, 10), { target: V(6, 1, 8), speed: 1.2, spin: 0.2 }); break;
      case 'hoop': {
        flood.float('hoop', V(-14, 1, 21.6), { target: V(4, 1, 21.6), speed: 5.5, spin: 0 });
        flood.props.hoop.yaw = Math.PI / 2;
        if (!I) this.later(2.6, () => { R.knock(); A.clank(this.getCamera().position.clone()); });
        C.keaten.later = null; this.later(I ? 0 : 3.2, () => { C.keaten.go([V(0.6, 0, 22.2)], { speed: 2, rest: 'hold' }); });
        break;
      }
      case 'tin': flood.float('tin', V(-8, 1, 18), { target: V(-0.2, 1, 22.0), speed: 5, spin: 1.2 }); if (!I) this.later(1.6, () => A.clank(W(V(-0.2, 1, 22.6)))); C.keaten.face = V(-0.2, 1, 22); break;
      case 'raft': {
        const P = flood.float('raft', V(14, 1, 17), { target: V(-4, 1, 16.5), speed: 1.1, spin: 0.05 }); P.yaw = Math.PI / 2;
        C.dale.attach = { P, off: V(0, 0, 0), dy: 0.22, pose: 'sit' }; C.dale.face = null; break;
      }
      case 'pen': C.pen.visible = true; C.dale.fig.hold(C.pen, 'R', V(0, -0.1, 0.06)); C.dale.attach.pose = 'hold'; break;
      case 'keatenDive': {
        // he goes after Dale; the current takes you into the bottling line, onto the housing under the dopamine pipe
        C.keaten.mode = 'swim'; C.keaten.go([V(-2, 0, 18.5), V(-5, 0, 17)], { speed: 2.2, rest: 'swim' });
        R.to(V(WL.bottler.x + 0.3, WL.bottlerTop + 0.06, WL.bottler.z + 0.2), -Math.PI / 2 + 0.25, 0.02, I ? 0 : 3.4, { delay: I ? 0 : 0.6, shake: 0.5, cage: 'perch' });
        break;
      }
      case 'keatenSwim': {
        C.keaten.mode = 'swim'; C.keaten.dip = 0; C.keaten.place(V(-6.2, 0, 17.5), -Math.PI / 2 - 0.4); C.keaten.base = -5; C.keaten.rest = 'swim'; C.keaten.fig.pose = 'swim'; C.keaten.face = 'player';
        C.dale.attach = null; C.dale.mode = 'ground'; flood.hide('raft');
        if (C.pen.parent) C.pen.parent.remove(C.pen); C.pen.visible = false;
        // Dale floats past on a half-built workbench
        const P = flood.float('raft', V(4, 1, 13), { target: V(-8, 1, 13), speed: 0.35, spin: 0.02 }); C.dale.attach = { P, off: V(0, 0, 0), dy: 0.22, pose: 'sit' };
        break;
      }
      case 'bucket': flood.float('bucket', V(-2, 1, 16), { target: V(-12, 1, 19), speed: 6, spin: 3 }); break;
      case 'ballet': C.keaten.fig.pose = 'ballet'; C.keaten.rest = 'ballet'; this.tween(1.5, (k) => { C.keaten.dip = 0.75 * ease(k); }); break;
      case 'keatenUnder': C.keaten.rest = 'swim'; C.keaten.fig.pose = 'swim'; this.tween(1.0, (k) => { C.keaten.dip = 0.75 - 2.4 * ease(k); }); break;
      case 'keatenUp': {
        C.pen.visible = true; C.keaten.fig.head.add(C.pen); C.pen.position.set(0, -0.04, 0.1); C.pen.rotation.set(0, 0, 0);
        C.keaten.fig.pose = 'ballet'; C.keaten.rest = 'ballet'; this.tween(0.5, (k) => { C.keaten.dip = -1.65 + 2.4 * ease(k); });
        this.later(I ? 0 : 6, () => { C.keaten.fig.hold(C.pen, 'R', V(0, -0.08, 0.05)); C.keaten.fig.pose = 'swim'; C.keaten.rest = 'swim'; this.tween(1, (k) => { C.keaten.dip = 0.75 * (1 - k); }); });
        break;
      }
      case 'whiteboard': flood.float('whiteboard', V(2, 1, 14), { target: V(-6, 1, 19.6), speed: 1.0, spin: 0.1 }); C.keaten.go([V(-6.8, 0, 19.2)], { speed: 0.8, rest: 'swim' }); break;
      case 'penToss': {
        const from = C.pen.getWorldPosition(V()).sub(WORKS); if (C.pen.parent) C.pen.parent.remove(C.pen); this.root.add(C.pen); C.pen.visible = true;
        const to = this.camLocal().add(V(0, -0.4, 0));
        this.tween(I ? 0.01 : 0.9, (k) => { C.pen.position.lerpVectors(from, to, k); C.pen.position.y += Math.sin(k * Math.PI) * 1.2; C.pen.rotation.z = k * 9; }, () => { C.pen.visible = false; this.state.penInPocket = true; });
        break;
      }
      case 'raft2': { const P = flood.float('raft', V(4, 1, 11), { target: V(-6, 1, 15.5), speed: 0.4, spin: 0.03 }); C.dale.attach = { P, off: V(0, 0, 0), dy: 0.22, pose: 'sit' }; break; }
      case 'barricade': {
        F.barricade.visible = true; this.tween(3, (k) => { F.barricade.scale.set(1, Math.max(0.05, ease(k)), 1); });
        // we move toward it: onto the bolted-down vat; Keaten climbs up beside you; Dale bumps along on his raft
        R.to(V(WL.pullVat.x - 0.6, WL.pullVatH + 0.08, WL.pullVat.z + 0.5), -1.05, 0.0, I ? 0 : 4.5, { delay: 0.2, cage: 'vat' });
        C.keaten.mode = 'ground'; C.keaten.dip = 0; C.keaten.place(V(WL.pullVat.x + 0.9, WL.pullVatH + 0.08, WL.pullVat.z - 0.5), -1.05); C.keaten.rest = 'stand'; C.keaten.face = V(WL.freedom.x, 1, WL.freedom.z);
        const P = flood.float('raft', V(4, 1, 9), { target: V(12.2, 1, 6.4), speed: 1.2, spin: 0 }); C.dale.attach = { P, off: V(0, 0, 0), dy: 0.22, pose: 'sit' };
        break;
      }
      case 'hangTen': {
        const a = C.keaten.p.clone(), b = V(15.5, 0, 0.5);
        C.keaten.fig.pose = 'ballet'; C.keaten.face = null;
        this.tween(I ? 0.01 : 1.4, (k) => { C.keaten.p.lerpVectors(a, b, k); C.keaten.base = a.y + Math.sin(k * Math.PI) * 1.2 - k * 3.2; C.keaten.mode = 'ground'; }, () => { C.keaten.visible = false; C.keaten.mode = 'swim'; C.keaten.dip = -3; });
        if (!I) this.later(1.3, () => A._burst(W(b), { dur: 1.2, f: 500, q: 0.4, gain: 0.8, thump: 0.6, ref: 5 }));
        break;
      }
      case 'wetCig': C.cig.visible = true; C.dale.fig.hold(C.cig, 'R', V(0, -0.1, 0.06)); C.cig.rotation.x = 1.2; C.dale.attach.pose = 'hold'; break;
      case 'chainUp': {
        C.keaten.visible = true; C.keaten.mode = 'swim'; C.keaten.dip = 0; C.keaten.place(V(12.6, 0, 6.4), Math.PI + 0.4); C.keaten.base = -5; C.keaten.fig.pose = 'pull'; C.keaten.rest = 'pull'; C.keaten.face = 'player';
        this.state.chainTo = 'keaten'; if (!I) A._burst(W(V(12.6, 0.5, 6.4)), { dur: 0.8, f: 600, q: 0.5, gain: 0.6 }); break;
      }
      case 'knock': if (!I) { A.clank(W(V(DR.x, -3, DR.z))); this.later(0.3, () => A.thoom(W(V(DR.x, -4, DR.z)))); } break;
      case 'toVat': {
        C.keaten.mode = 'ground'; C.keaten.place(V(WL.pullVat.x + 0.95, WL.pullVatH + 0.08, WL.pullVat.z + 0.2), -1.75); C.keaten.rest = 'heave'; C.keaten.fig.pose = 'heave'; C.keaten.face = V(DR.x, 0, DR.z);
        C.dale.attach = null; flood.hide('raft'); if (C.cig.parent) C.cig.parent.remove(C.cig);
        C.dale.mode = 'ground'; C.dale.place(V(WL.pullVat.x - 0.2, WL.pullVatH + 0.08, WL.pullVat.z + 1.4), -1.75); C.dale.rest = 'heave'; C.dale.fig.pose = 'heave'; C.dale.face = V(DR.x, 0, DR.z);
        R.to(V(WL.pullVat.x - 0.4, WL.pullVatH + 0.08, WL.pullVat.z - 0.7), -1.75 + Math.PI, -0.2, I ? 0 : 2.5, { cage: 'vat', face: V(DR.x, 0.3, DR.z) });
        this.state.chainTo = 'player'; this.state.pullHint = true; break;
      }
      case 'tink': if (!I) A.tink(W(V(DR.x, 0, DR.z))); C.dale.face = V(DR.x, -2, DR.z); break;
      case 'krunk': if (!I) { A.krunk(W(V(DR.x, -1, DR.z))); shake(0.6); } break;
      case 'plugOut': {
        this.state.pullHint = false;
        const a = V(DR.x, 0.3, DR.z), b = V(WL.pullVat.x - 1.2, WL.pullVatH + 0.1, WL.pullVat.z + 0.6);
        this.tween(I ? 0.01 : 2.6, (k) => { const e = ease(k); F.plug.position.lerpVectors(a, b, e); F.plug.position.y = THREE.MathUtils.lerp(a.y, b.y, e) + Math.sin(e * Math.PI) * 1.6; F.plug.rotation.z = e * 0.4; });
        this.state.chainTo = 'plug'; if (!I) A._burst(W(a), { dur: 1.5, f: 300, q: 0.5, gain: 0.8, thump: 0.8 });
        break;
      }
      case 'drain': flood.drain(I ? 0.01 : 16); if (!I) { A.whoosh(W(V(DR.x, 0, DR.z))); shake(0.8); } F.chain.visible = false; this.state.chainTo = null; C.keaten.rest = 'stand'; C.keaten.fig.pose = 'stand'; C.dale.rest = 'stand'; C.dale.fig.pose = 'stand'; break;
      case 'butWhatIf': {
        const P = flood.float('butWhatIf', V(DR.x + 2.6, 0, DR.z), {}); P.mode = 'script';
        this.state.orbit = { P, a: 0, r: 2.6 }; C.keaten.face = V(DR.x, 0, DR.z); break;
      }
      case 'slurp': { const o = this.state.orbit; if (o) { this.tween(I ? 0.01 : 0.5, (k) => { o.r = 2.6 * (1 - k); o.P.shrink = 1 - k; }, () => { flood.hide('butWhatIf'); this.state.orbit = null; }); } if (!I) A.slurp(W(V(DR.x, 0, DR.z))); break; }
      case 'drained': {
        flood.drained(); flood.hide('raft'); flood.hide('whiteboard'); flood.hide('hoop'); flood.hide('tin'); flood.hide('guitar'); flood.hide('bucket');
        F.barricade.rotation.z = 0.35; F.barricade.position.y = -0.4; F.barricade.position.z = 2.2; F.barricade.scale.set(1, 0.55, 1);
        F.plug.position.set(WL.pullVat.x - 3.3, 0.0, WL.pullVat.z + 1.5); F.plug.rotation.set(0.25, 0, 0.1); F.chain.visible = false;
        break;
      }
      case 'climbDown': {
        R.to(V(WL.pullVat.x - 3.0, 0, WL.pullVat.z - 2.6), -1.6, -0.05, I ? 0 : 2.2, { cage: null });
        C.keaten.place(V(WL.pullVat.x + 1.2, 0, WL.pullVat.z - 2.8), -1.2); C.keaten.rest = 'stand';
        C.keaten.go([V(24, 0, -4), V(WL.freedom.x - 1.4, 0, WL.freedom.z)], { speed: 1.2 }); C.keaten.face = V(WL.freedom.x, 1, WL.freedom.z);
        C.dale.place(V(WL.pullVat.x - 1.0, 0, WL.pullVat.z - 3.6), -1.2); C.wheel.visible = true;
        C.dale.go([V(22, 0, -2.5), V(WL.freedom.x - 4.5, 0, WL.freedom.z + 1.6)], { speed: 1.0 }); C.dale.face = 'player';
        break;
      }
      case 'freedomTry': if (!I) { A.rattle(W(V(WL.freedom.x - 0.1, 1.05, WL.freedom.z + 0.85))); this.later(1.2, () => A.rattle(W(V(WL.freedom.x - 0.1, 1.05, WL.freedom.z + 0.85)))); } C.keaten.face = V(DR.x, 0, DR.z); C.dale.face = V(DR.x, 0, DR.z); break;
      case 'complaint': {
        if (!I) A.ding(W(WL.monitors));
        F.screens.forEach((sc, i) => sc.draw((c, w, h) => crt(c, w, h, i === 1 ? [{ t: 'KEATLAND HUMAN RESOURCES', size: 46 }, { t: 'COMPLAINT #000001', size: 64 }, { t: 'SUCCESSFULLY FILED', size: 64 }] : ['KEATLAND HR', i ? '> FILED' : '> ACK', ' '], { size: 46, color: i === 1 ? '#ffd27a' : '#ffb347' })));
        C.keaten.face = V(WL.monitors.x, WL.monitors.y, WL.monitors.z); break;
      }
      case 'tinktink': if (!I) { A.tink(W(F.cjpFront().sub(WORKS))); this.later(0.25, () => A.tink(W(F.cjpFront().sub(WORKS)))); } C.dale.fig.pose = 'hold'; C.dale.rest = 'hold'; break;
      case 'noteLook': C.keaten.go([V(-6.2, 0, 8.6)], { speed: 1.3 }); C.keaten.face = V(WL.cjp.x, 0.6, WL.cjp.z); C.dale.rest = 'stand'; C.dale.fig.pose = 'stand'; C.dale.go([F.cjp.localToWorld(V(1.4, 0, 1.6)).sub(WORKS).setY(0)], { speed: 1 }); break;
      case 'clank': if (!I) A.clank(W(V(WL.freedom.x + 1, 1.5, WL.freedom.z))); C.keaten.face = V(WL.freedom.x, 1, WL.freedom.z); C.dale.face = V(WL.freedom.x, 1, WL.freedom.z); break;
      case 'gears': if (!I) [0, 0.7, 1.2, 1.5, 1.75, 2.0].forEach((d) => this.later(d, () => A.tch(W(V(DR.x, -1, DR.z)), 0.3))); break;
      case 'buttonCreep': this.tween(I ? 0.01 : 14, (k) => { F.button.position.z = 0.14 - 0.08 * k; }); C.dale.face = V(WL.cjp.x, 1.3, WL.cjp.z); break;
      case 'tch3': if (!I) [0, 0.35, 0.7].forEach((d) => this.later(d, () => A.tch(W(V(DR.x, -1, DR.z)), 0.6))); break;
      case 'tch2': if (!I) for (let k = 0; k < 7; k++) this.later(k * 0.12, () => A.tch(W(V(DR.x, -1, DR.z)), 0.35)); break;
      case 'bolts': if (!I) { const p = W(V(DR.x, -2, DR.z)); A.krang(p); shake(0.5); this.later(1.6, () => A.skree(p)); this.later(2.6, () => { A.thoom(p); shake(0.9); }); this.later(3.4, () => { A.thoom(p); shake(1.0); }); } break;
      case 'konk': F.cjpValves.forEach((v, k) => this.later(I ? 0 : k * 1.1, () => { this.tween(I ? 0.01 : 0.5, (u) => { v.rotation.z = -u * Math.PI / 2; }); if (!I) A.konk(W(F.cjpFront().sub(WORKS))); })); break;
      case 'powerDown': {
        if (!I) A.mmmng(W(V(0, 4, 0)), 7);
        const g0 = this.state.gauge ?? 0.97; this.tween(I ? 0.01 : 3, (k) => { F.setGauge(g0 * (1 - k)); this.state.power = 1 - 0.75 * ease(k); F.power = this.state.power; });
        F.alarm = 0; A.setAlarm(0); this.state.alarm = 0; break;
      }
      case 'plates': {
        // the drain closes; the plates unlock, lift and slide away
        F.grate.visible = true; if (!I) A.clank(W(V(DR.x, 0, DR.z)));
        // anyone standing on them is stepped back off
        const cam = this.camLocal(); const d = V(cam.x - DR.x, 0, cam.z - DR.z); if (d.length() < WL.plateR + 0.8) { d.setLength(WL.plateR + 1.6); R.to(V(DR.x + d.x, 0, DR.z + d.z), Math.atan2(d.x, d.z), -0.3, I ? 0 : 1.5); }
        this.hold.group.visible = true;
        F.plates.forEach((p, k) => this.later(I ? 0 : 0.6 + k * 0.45, () => { this.tween(I ? 0.01 : 2.6, (u) => { p.open = ease(u); }); if (!I) { A.thoom(W(V(DR.x + p.dir.x * 4, -0.5, DR.z + p.dir.z * 4))); A.skree(W(V(DR.x + p.dir.x * 4, 0, DR.z + p.dir.z * 4))); } }));
        F.pit.open = true; F.grate.visible = false; F.throat.visible = false; F.plug.visible = true;
        C.keaten.go([V(-3.5, 0, 10.4)], { speed: 1.2 }); C.keaten.face = V(DR.x, 0, DR.z);
        C.dale.go([V(4.8, 0, 9.8)], { speed: 1.2 }); C.dale.face = V(DR.x, -2, DR.z);
        break;
      }
      case 'lookHold': {
        const cam = this.camLocal(); const d = V(cam.x - DR.x, 0, cam.z - DR.z); if (d.length() < 0.1) d.set(0, 0, 1); d.setLength(WL.plateR + 1.1);
        R.to(V(DR.x + d.x, 0, DR.z + d.z), Math.atan2(d.x, d.z), -0.55, I ? 0 : 2.4);
        const side = V(-d.z, 0, d.x).normalize();
        C.keaten.go([V(DR.x + d.x * 1.02 + side.x * 1.1, 0, DR.z + d.z * 1.02 + side.z * 1.1)], { speed: 1.4 }); C.keaten.face = V(DR.x, -3, DR.z);
        C.dale.go([V(DR.x + d.x * 0.96 - side.x * 1.6, 0, DR.z + d.z * 0.96 - side.z * 1.6)], { speed: 1.4, rest: 'hold' }); C.dale.face = V(DR.x, -6, DR.z);
        this.state.holdView = { d: d.clone(), side };
        break;
      }
      case 'keatenVanish': C.keaten.visible = false; C.keaten.path = []; break;
      case 'ceilingCrash': {
        const hv = this.state.holdView || { d: V(0, 0, WL.plateR + 1.1), side: V(1, 0, 0) };
        const me = V(DR.x + hv.d.x, 0, DR.z + hv.d.z); const out = hv.d.clone().normalize();
        // ~12 ft away, on clear floor: not over the hole, not on a vat or the CJP pier
        const solids = WL.vats.map(([x, z, r]) => [x, z, r]).concat([[WL.pullVat.x, WL.pullVat.z, WL.pullVatR], [WL.cjp.x, WL.cjp.z, 0.8], [WL.stair.c.x, WL.stair.c.z, WL.stair.r]]);
        const clear = (p) => Math.hypot(p.x - DR.x, p.z - DR.z) > WL.plateR + 1.6 && solids.every(([x, z, r]) => Math.hypot(p.x - x, p.z - z) > r + 1.8);
        let spot = null;
        for (const [o, sd] of [[1.6, 3.4], [1.6, -3.4], [2.4, 2.6], [2.4, -2.6], [3.6, 0]]) { const c = me.clone().addScaledVector(out, o).addScaledVector(hv.side, sd); if (clear(c)) { spot = c; break; } }
        spot = spot || me.clone().addScaledVector(out, 3.6);
        C.office.position.copy(spot);         C.office.rotation.y = Math.atan2(me.x - spot.x, me.z - spot.z);
        C.office.visible = true; C.ceiling.visible = true; C.ceiling.position.copy(spot);
        const fall = I ? 0.01 : 2.2;
        C.keaten.visible = true; C.keaten.mode = 'ground'; C.keaten.path = []; C.keaten.fig.pose = 'lounge'; C.keaten.rest = 'lounge'; C.keaten.face = null;
        this.tween(fall, (k) => { const y = (1 - k * k) * (WL.roof - 6); C.office.position.y = y; C.chair.rotation.y = (1 - k) * 3; C.bits.forEach((b) => { b.m.position.copy(b.off).multiplyScalar(1 + k); b.m.position.y = Math.max(0.03, y + b.off.y * (1 - k) + 0.5); b.m.rotation.set(b.spin.x * k * 3, b.spin.y * k * 3, b.spin.z * k * 3); }); }, () => {
          C.chair.rotation.y = 0; if (!I) { A.wham(W(spot)); shake(0.9); }
          const pos = C.dust.geometry.attributes.position; this.tween(I ? 0.01 : 4, (k) => { for (let i = 0; i < pos.count; i++) { const v = C.dustV[i]; pos.setXYZ(i, v.x * ease(k), 0.2 + v.y * k * 1.5, v.z * ease(k)); } pos.needsUpdate = true; C.dust.material.opacity = 0.55 * (1 - k); });
        });
        if (!I) { A.ceiling(W(spot.clone().setY(WL.roof - 6)), W(spot)); R.look(spot.clone().setY(1.0), 0.9, 0.3); }
        // Keaten rides the chair down
        this.state.keatenChair = true;
        break;
      }
      case 'drawer': this.tween(I ? 0.01 : 0.3, (k) => { C.drawer.position.z = -0.1 - 0.32 * k; }); if (!I) A.drawer(W(C.office.position)); ['carton', 'keys', 'cash', 'sticker0', 'sticker1', 'sticker2', 'sticker3'].forEach((n, k) => this.later(I ? 0 : 0.5 + k * 0.5, () => { C.items[n].visible = true; })); C.dale.face = C.office.position.clone(); C.dale.go([C.office.position.clone().add(V(1.5, 0, 0.6))], { speed: 1.6 }); break;
      case 'lightUp': C.cig.visible = true; if (C.cig.parent) C.cig.parent.remove(C.cig); C.keaten.fig.hold(C.cig, 'R', V(0, -0.08, 0.05)); if (!I) A.lighter(W(C.office.position.clone().setY(1.2))); break;
      case 'keys': {
        const from = C.office.localToWorld(V(-0.1, 0.85, 1.07)).sub(WORKS); const me = this.camLocal().add(V(0, -0.5, 0));
        C.items.keys.visible = false; const k2 = C.items.keys.clone(); k2.visible = true; this.root.add(k2);
        this.tween(I ? 0.01 : 0.8, (k) => { k2.position.lerpVectors(from, me, k); k2.position.y += Math.sin(k * Math.PI) * 0.8; k2.rotation.y = k * 8; }, () => {
          this.later(I ? 0 : 3.8, () => this.tween(I ? 0.01 : 0.8, (k) => { k2.position.lerpVectors(me, from, k); k2.position.y += Math.sin(k * Math.PI) * 0.9; }, () => { this.root.remove(k2); C.items.keys.visible = true; }));
        });
        break;
      }
      case 'daleLaugh': { C.dale.fig.pose = 'stand'; const a = C.dale.p.clone().add(V(0, 1.1, 0)); C.pack.visible = true; this.tween(I ? 0.01 : 0.7, (k) => { C.pack.position.copy(a).add(V(0.15 * k, -1.06 * k * k, 0.1 * k)); C.pack.rotation.z = k * 2; }); if (!I) for (let k = 0; k < 8; k++) this.later(k * 0.18, () => { C.dale.fig.t += 0.4; }); break; }
      case 'projects': { if (!I) { const l = this.voice.lines.find((x) => x.say === 'projects' && x.stretch > 1.2) || this.voice.lines.find((x) => x.say === 'projects'); this.voice.speak(l, this.getCamera(), this.W(V(DR.x, -40, DR.z))); } this.speech.say('prooooojects…', V(DR.x + 1.5, -6, DR.z), { style: { color: '#c8d8c0', font: 'Caveat', weight: '400' }, life: 5, scale: 1.4 }); C.dale.face = V(DR.x, -5, DR.z); break; }
      case 'cookie': { const p = C.dale.p.clone().add(V(0, 0, 0.35)); C.cookie.visible = true; C.cookie.position.copy(p).setY(0.03); break; }
      case 'cronch': C.cookie.visible = false; if (!I) A.cronch(W(C.dale.p.clone().setY(1.5))); C.dale.face = 'player'; break;
      case 'onboarding': F.screens.forEach((sc, i) => sc.draw((c, w, h) => crt(c, w, h, [{ t: 'KEATLAND EMPLOYEE ONBOARDING', size: 38 }, 'APPLICANT: DALE', 'STATUS: HIRED', { t: 'PREREQUISITE: MUST FIRST BE FIRED', size: 34 }, { t: 'STATUS: PENDING', color: i % 2 ? '#ffd27a' : '#ffb347' }], { size: 46 }))); if (!I) A.ding(W(WL.monitors)); break;
      case 'pinkSlip': C.items.slip.visible = true; C.keaten.fig.pose = 'stand'; C.keaten.rest = 'stand'; this.state.keatenChair = false; C.keaten.place(C.office.localToWorld(V(0, 0, 0.25)).sub(WORKS).setY(0)); C.keaten.face = C.dale.p.clone(); break;
      case 'dollar': { const a = C.dale.p.clone().add(V(0, 1.1, 0)), b = this.camLocal().add(V(0, -0.45, 0)); C.dollar.visible = true; this.tween(I ? 0.01 : 0.8, (k) => { C.dollar.position.lerpVectors(a, b, k); C.dollar.rotation.set(k * 2, k * 3, 0); }, () => { C.dollar.visible = false; }); break; }
      case 'clock317': F.screens.clock.draw((c, w, h) => clockFace(c, w, h, '3:17 AM')); break;
      case 'daleSigns': C.dale.go([C.office.localToWorld(V(0.45, 0, 1.75)).sub(WORKS).setY(0)], { speed: 1.2, rest: 'hold' }); C.dale.face = C.office.position.clone(); break;
      case 'procError': {
        F.screens.forEach((sc) => sc.draw((c, w, h) => crt(c, w, h, [{ t: 'PROCEDURAL ERROR', size: 64 }, { t: 'EMPLOYEE ATTEMPTED TO QUIT', size: 40 }, { t: 'PRIOR TO HIRING', size: 40 }], { color: '#ff4a2a', bg: '#1a0402' })));
        if (!I) A.ding(W(WL.monitors));
        C.dale.go([C.dale.p.clone().add(V(-6, 0, -7))], { speed: 4.5, rest: 'stand' }); break;
      }
      case 'coast': if (!I) { const p = W(V(DR.x, -2, DR.z)); [0, 1.1, 2.6, 4.6].forEach((d) => this.later(d, () => A.tch(p, 0.35))); this.later(5.8, () => A.chnk(p)); } break;
      case 'end': this.state.ended = true; break;
      default: break;
    }
  }
}
