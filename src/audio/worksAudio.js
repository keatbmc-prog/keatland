// Sound for the Catecholamine Works. Builds on StoryAudio (same voices: synthesised babble for
// Keaten, Moss and Dale from their actual words, Yesterkeat on the PA) with a bigger, longer room,
// and adds the factory itself, all positional (HRTF panners at the sources):
//   machinery hum from every vat, the bottling line's clatter, steam hisses, bubbling columns;
//   the WOOOOP siren from the beacons; the flood's roar riding the breaking front and its churn
//   all around you; the drain vortex; and the one-shots the scene calls for: valve squeaks, the
//   KRRRUNK of the plug, the TINK, the WHOOOOSH, the KRRRAAANG and THOOM of the bolts, the KONK
//   of the valves, the MMMNNNGGG of the system settling, tch-tch gears, the ding, the CLANK
//   behind the FREEDOMLAND door, a slurp, a ceiling coming down, and a guitar phrase in the tide.
import { StoryAudio } from './storyAudio.js';

export class WorksAudio extends StoryAudio {
  constructor(engine, { vats = [], conveyor = null, beacons = [], drain = null, toWorld }) {
    super(engine);
    Object.assign(this, { vatsL: vats, conveyorL: conveyor, beaconsL: beacons, drainL: drain, W: toWorld });
    this.lv = { power: 1, alarm: 0, flood: 0, vortex: 0, front: null };
  }
  _init() {
    super._init();
    const E = this.E, ctx = E.ctx;
    this.room.buffer = E.impulse(3.4, 2.2); this.roomWet.gain.value = 0.45;
    // machinery: a low drone per vat (two partials + filtered rumble), slowly beating against each other
    this.machG = ctx.createGain(); this.machG.gain.value = 0; this.machG.connect(this.out);
    this.vatVoices = this.vatsL.map((v, i) => {
      const p = this.W(v); const pan = E.panner(p.x, p.y + 3, p.z, 6); pan.rolloffFactor = 0.9; pan.connect(this.machG);
      const g = ctx.createGain(); g.gain.value = 0.5; g.connect(pan);
      const f = 46 + i * 3.7;
      for (const [m, a] of [[1, 0.35], [2.01, 0.12], [3.02, 0.05]]) { const o = ctx.createOscillator(); o.type = m === 1 ? 'sawtooth' : 'sine'; o.frequency.value = f * m; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; const og = ctx.createGain(); og.gain.value = a; o.connect(lp).connect(og).connect(g); o.start(); }
      const s = E.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 140 + i * 20; bp.Q.value = 1.2; const sg = ctx.createGain(); sg.gain.value = 0.25; s.connect(bp).connect(sg).connect(g);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.1 + i * 0.03; const lg = ctx.createGain(); lg.gain.value = 0.15; lfo.connect(lg).connect(g.gain); lfo.start();
      return g;
    });
    // the bottling line: a clatter pan at the middle of the conveyor
    const cv = this.W(this.conveyorL); this.cvPan = E.panner(cv.x, cv.y + 1, cv.z, 4); this.cvPan.connect(this.machG);
    this.nextClink = 0; this.nextHiss = 2; this.nextBubble = 1;
    // siren: two beacons, a swept sawtooth through a horn-ish bandpass
    this.sirenG = ctx.createGain(); this.sirenG.gain.value = 0; this.sirenG.connect(this.out);
    { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 320; this.sirenO = o; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 1.4; const sh = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 3); } sh.curve = c;
      const g = ctx.createGain(); g.gain.value = 0.18; o.connect(bp).connect(sh).connect(g);
      this.beaconsL.slice(0, 3).forEach((b) => { const p = this.W(b); const pn = E.panner(p.x, p.y, p.z, 8); pn.rolloffFactor = 0.6; g.connect(pn).connect(this.sirenG); });
      o.start(); this.sirenT = 0; }
    // flood: the roar at the front (positioned per frame) + churn everywhere
    this.roarPan = E.panner(0, 0, 0, 10); this.roarPan.rolloffFactor = 0.7; this.roarPan.connect(this.out);
    this.roarG = ctx.createGain(); this.roarG.gain.value = 0; this.roarG.connect(this.roarPan);
    { const s = E.noiseSrc(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; const g = ctx.createGain(); g.gain.value = 1.0; s.connect(lp).connect(g).connect(this.roarG);
      const s2 = E.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7; const g2 = ctx.createGain(); g2.gain.value = 0.35; s2.connect(bp).connect(g2).connect(this.roarG);
      const o = ctx.createOscillator(); o.frequency.value = 32; const og = ctx.createGain(); og.gain.value = 0.6; o.connect(og).connect(this.roarG); o.start(); }
    this.churnG = ctx.createGain(); this.churnG.gain.value = 0; this.churnG.connect(this.out);
    { const s = E.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.5; const lfo = ctx.createOscillator(); lfo.frequency.value = 0.3; const lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg).connect(bp.frequency); lfo.start(); s.connect(bp).connect(this.churnG); }
    this.nextDebris = 0;
    // the drain vortex: gurgle (LFO'd lowpass) + a rising whoosh at the drain
    const dr = this.W(this.drainL); this.drainPan = E.panner(dr.x, dr.y, dr.z, 5); this.drainPan.rolloffFactor = 0.8; this.drainPan.connect(this.out);
    this.drainG = ctx.createGain(); this.drainG.gain.value = 0; this.drainG.connect(this.drainPan);
    { const s = E.noiseSrc(); const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400; lp.Q.value = 8; const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg).connect(lp.frequency); lfo.start(); s.connect(lp).connect(this.drainG);
      const s2 = E.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.6; const g2 = ctx.createGain(); g2.gain.value = 0.6; s2.connect(bp).connect(g2).connect(this.drainG); this.drainBP = bp; }
  }

  // ------------------------------------------------------------------ one-shots (pos = world)
  _tone(pos, { f = 200, f2 = null, type = 'sine', dur = 0.5, gain = 0.4, ref = 4, q = 0, filt = null, attack = 0.005 } = {}) {
    if (!this.ready) return; const ctx = this.E.ctx, t = ctx.currentTime;
    const pan = this.E.panner(pos.x, pos.y, pos.z, ref); pan.connect(this.out);
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    let n = o; if (filt) { const b = ctx.createBiquadFilter(); b.type = filt; b.frequency.value = q || 1000; b.Q.value = 2; n = o.connect(b); }
    n.connect(g).connect(pan); o.start(t); o.stop(t + dur + 0.05);
    setTimeout(() => { try { pan.disconnect(); } catch { /* gone */ } }, (dur + 1) * 1000);
  }
  /** metal: a few inharmonic partials */
  _metal(pos, { f = 300, dur = 1.2, gain = 0.4, ref = 5 } = {}) { for (const [m, a] of [[1, 1], [2.76, 0.5], [5.4, 0.3], [8.93, 0.15]]) this._tone(pos, { f: f * m, dur: dur / Math.sqrt(m), gain: gain * a, ref }); }
  squeak(pos) { this._tone(pos, { f: 900 + Math.random() * 400, f2: 1400, type: 'sawtooth', dur: 0.45, gain: 0.08, filt: 'bandpass', q: 1800, attack: 0.08 }); }
  tink(pos) { this._metal(pos, { f: 1250, dur: 0.6, gain: 0.25, ref: 3 }); }
  krunk(pos) { this._burst(pos, { dur: 0.9, f: 220, q: 0.6, gain: 0.9, thump: 1, ref: 6 }); this._tone(pos, { f: 70, f2: 40, type: 'sawtooth', dur: 1.0, gain: 0.3, filt: 'lowpass', q: 300 }); }
  whoosh(pos) { this._burst(pos, { dur: 3.5, f: 700, q: 0.4, gain: 1.0, thump: 0.8, ref: 10 }); }
  krang(pos) { this._tone(pos, { f: 520, f2: 140, type: 'sawtooth', dur: 2.4, gain: 0.25, filt: 'bandpass', q: 1200, ref: 10 }); this._metal(pos, { f: 160, dur: 2.5, gain: 0.5, ref: 10 }); this._burst(pos, { dur: 1.2, f: 3000, q: 0.8, gain: 0.4, ref: 10 }); }
  skree(pos) { this._tone(pos, { f: 2400, f2: 1700, type: 'sawtooth', dur: 1.2, gain: 0.07, filt: 'bandpass', q: 2600, attack: 0.1 }); }
  thoom(pos) { this._tone(pos, { f: 58, f2: 30, dur: 1.6, gain: 0.9, ref: 14 }); this._burst(pos, { dur: 1.0, f: 160, q: 0.5, gain: 0.6, ref: 14 }); }
  konk(pos) { this._metal(pos, { f: 190, dur: 1.4, gain: 0.55, ref: 6 }); this._burst(pos, { dur: 0.15, f: 800, q: 1, gain: 0.4, thump: 0.5 }); }
  tch(pos, gain = 0.25) { this._burst(pos, { dur: 0.05, f: 4200, q: 3, gain, ref: 2 }); this._tone(pos, { f: 2100, dur: 0.06, gain: gain * 0.4 }); }
  chnk(pos) { this._burst(pos, { dur: 0.25, f: 900, q: 1.2, gain: 0.8, thump: 0.7, ref: 4 }); this._metal(pos, { f: 330, dur: 0.5, gain: 0.3 }); }
  mmmng(pos, dur = 5) { if (!this.ready) return; this._tone(pos, { f: 62, f2: 44, type: 'sawtooth', dur, gain: 0.35, filt: 'lowpass', q: 240, attack: 0.8, ref: 20 }); this._tone(pos, { f: 93, f2: 66, type: 'sine', dur, gain: 0.2, attack: 1.0, ref: 20 }); }
  ding(pos) { this._tone(pos, { f: 1568, dur: 1.8, gain: 0.25, ref: 5 }); this._tone(pos, { f: 3136, dur: 0.9, gain: 0.08, ref: 5 }); }
  clank(pos) { this._metal(pos, { f: 240, dur: 1.4, gain: 0.6, ref: 6 }); this._burst(pos, { dur: 0.4, f: 500, q: 1, gain: 0.5, thump: 0.6, ref: 6 }); }
  slurp(pos) { this._tone(pos, { f: 380, f2: 90, type: 'sine', dur: 0.7, gain: 0.35, ref: 5, attack: 0.02 }); this._burst(pos, { dur: 0.6, f: 300, q: 4, gain: 0.5, ref: 5 }); }
  doorsBurst(pos) { this.krang(pos); this.thoom(pos); setTimeout(() => this._burst(pos, { dur: 4, f: 400, q: 0.3, gain: 1.0, thump: 1, ref: 14 }), 200); }
  ceiling(pos, landPos) { this._burst(pos, { dur: 0.5, f: 2600, q: 1.2, gain: 0.6, ref: 8 }); setTimeout(() => { this._burst(landPos, { dur: 1.2, f: 300, q: 0.4, gain: 1.0, thump: 1.2, ref: 6 }); this._burst(landPos, { dur: 2.4, f: 5000, q: 0.5, gain: 0.25, ref: 6 }); }, 2100); }
  wham(pos) { this._burst(pos, { dur: 0.5, f: 250, q: 0.7, gain: 1.0, thump: 1.4, ref: 5 }); }
  drawer(pos) { this._burst(pos, { dur: 0.35, f: 1200, q: 2, gain: 0.35, ref: 2 }); }
  cronch(pos) { for (let i = 0; i < 3; i++) setTimeout(() => this._burst(pos, { dur: 0.08, f: 2500 + Math.random() * 2000, q: 2, gain: 0.5, ref: 1.5 }), i * 50); }
  lighter(pos) { this._burst(pos, { dur: 0.06, f: 6000, q: 2, gain: 0.3, ref: 1.5 }); setTimeout(() => this._burst(pos, { dur: 0.5, f: 1500, q: 0.6, gain: 0.12, ref: 1.5 }), 80); }
  /** a phrase from a guitar somewhere in the tide (plucked, Karplus-ish with decaying sines) */
  guitar(pos) {
    if (!this.ready) return;
    const notes = [196, 247, 294, 392, 294, 247, 330, 294];
    notes.forEach((f, i) => setTimeout(() => { for (const [m, a] of [[1, 0.25], [2, 0.12], [3, 0.06]]) this._tone(pos, { f: f * m, dur: 1.6 / m, gain: a, ref: 4, attack: 0.003 }); }, i * 260));
  }
  /** WOOOOOOOOP: on/off */
  setAlarm(v) { this.lv.alarm = v; }

  update(dt, { on = false, camera = null, power = 1, alarm = 0, flood = 0, front = null, vortex = 0, frontRun = 0 } = {}) {
    if (!this.E.ctx) return;
    if (!this.ready) { if (!on) return; this._init(); }
    const ctx = this.E.ctx, t = ctx.currentTime;
    this.out.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.5 : 0.15);
    if (!on) return;
    this.windG.gain.setTargetAtTime(0, t, 0.3); this.buzzG.gain.setTargetAtTime(0.12 * power, t, 0.5); this.holdG.gain.setTargetAtTime(0, t, 0.3);
    this.machG.gain.setTargetAtTime(0.55 * power, t, power < 0.5 ? 1.5 : 0.5);
    // siren sweep: up for 1.1 s, down, repeat
    this.sirenT += dt; const ph = (this.sirenT % 1.6) / 1.6; this.sirenO.frequency.setTargetAtTime(alarm > 0 ? (ph < 0.7 ? 300 + ph / 0.7 * 620 : 920 - (ph - 0.7) / 0.3 * 600) : 300, t, 0.03);
    this.sirenG.gain.setTargetAtTime(alarm * 0.9, t, 0.1);
    // flood
    if (front) { this.roarPan.positionX.setTargetAtTime(front.x, t, 0.1); this.roarPan.positionY.setTargetAtTime(front.y, t, 0.1); this.roarPan.positionZ.setTargetAtTime(front.z, t, 0.1); }
    this.roarG.gain.setTargetAtTime(frontRun * 1.1, t, 0.3);
    this.churnG.gain.setTargetAtTime(flood * 0.12, t, 0.6);
    this.drainG.gain.setTargetAtTime(vortex * 1.2, t, 0.4); this.drainBP.frequency.setTargetAtTime(600 + vortex * 1400, t, 0.5);
    // line clatter, hisses, bubbles, debris knocks
    this.nextClink -= dt;
    if (this.nextClink < 0 && power > 0.3) { this.nextClink = 0.18 + Math.random() * 0.25; const p = this.W(this.conveyorL); p.x += (Math.random() - 0.5) * 20; this._tone(p, { f: 2400 + Math.random() * 1600, dur: 0.12, gain: 0.05 * power, ref: 2 }); }
    this.nextHiss -= dt;
    if (this.nextHiss < 0 && power > 0.3 && camera) { this.nextHiss = 4 + Math.random() * 7; const v = this.vatsL[Math.floor(Math.random() * this.vatsL.length)]; const p = this.W(v); p.y += 10; this._burst(p, { dur: 1.2 + Math.random(), f: 5200, q: 0.5, gain: 0.25, ref: 6 }); }
    this.nextDebris -= dt;
    if (this.nextDebris < 0 && flood > 0.3 && camera) { this.nextDebris = 0.3 + Math.random() * 0.8; const p = camera.position.clone(); p.x += (Math.random() - 0.5) * 16; p.z += (Math.random() - 0.5) * 16; p.y -= 1.5; if (Math.random() < 0.5) this._metal(p, { f: 200 + Math.random() * 500, dur: 0.4, gain: 0.12, ref: 3 }); else this._burst(p, { dur: 0.2, f: 400 + Math.random() * 600, q: 1, gain: 0.2, thump: 0.2, ref: 3 }); }
  }
}
