// Sound for the Keatland Reception story realm: desert wind and a hawk outside, the fluorescent hum
// of Reception and the Backrooms, hold music leaking out of the reception phone, a distant angle
// grinder in the cottonwoods, crashes (the chair, the ceiling tile), door swings and rattles, Dale's
// babble (synthesised from his actual lines), and Yesterkeat's PA (chime, crackle, then the line -
// spoken by the browser's speech engine when it has one, through a tinny ceiling-speaker filter; or
// a recorded file if the line has `audio`; or a synthesised mumble if neither).
// Built lazily on the shared AudioEngine once audio has started; every one-shot is a no-op before.
import { synthWord } from './voice.js';

// crude text -> phoneme list, for babble (each word is one burst of the formant synth)
const VOWEL = { a: 'A', e: 'E', i: 'I', o: 'oU', u: 'V', y: 'I' };
const CONS = { s: 's', c: 'k', k: 'k', q: 'k', x: 's', z: 's', t: 't', d: 'd', p: 'p', b: 'p', g: 'g', j: 'j', m: 'm', n: 'n', l: 'l', r: 'r', w: 'w', f: 'f', v: 'f', h: 'th' };
export function wordPhonemes(word, { shout = false, long = 0 } = {}) {
  const w = word.toLowerCase().replace(/[^a-z]/g, ''); const out = [];
  for (let i = 0; i < w.length; i++) {
    const c = w[i], n = w[i + 1];
    if (c === 's' && n === 'h') { out.push(['sh', 0.09]); i++; continue; }
    if (c === 't' && n === 'h') { out.push(['th', 0.07]); i++; continue; }
    if (c === 'c' && n === 'h') { out.push(['j', 0.08]); i++; continue; }
    if (VOWEL[c]) { if (VOWEL[out.at(-1)?.[0]]) continue; out.push([VOWEL[c], (shout ? 0.13 : 0.1) + (long && i === w.length - 1 ? long : 0)]); }
    else if (CONS[c]) { if (out.at(-1)?.[0] === CONS[c]) continue; out.push([CONS[c], 0.05]); }
  }
  if (!out.length) out.push(['@', 0.1]);
  return out;
}

export class StoryAudio {
  constructor(engine) { this.E = engine; this.ready = false; this.lvl = { wind: 0, buzz: 0, hold: 0, out: 0 }; this.nextHawk = 30; this.paQueue = Promise.resolve(); }

  _init() {
    const E = this.E, ctx = E.ctx;
    // own output: dry into the master, plus a short room reverb (not the hub's cathedral)
    this.out = ctx.createGain(); this.out.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    this.room = ctx.createConvolver(); this.room.buffer = E.impulse(1.3, 3.2); this.roomWet = ctx.createGain(); this.roomWet.gain.value = 0.25;
    this.out.connect(comp); this.out.connect(this.room); this.room.connect(this.roomWet).connect(comp); comp.connect(E.master);
    // desert wind: two bands with gusts
    this.windG = ctx.createGain(); this.windG.gain.value = 0;
    for (const [f, q, a] of [[380, 0.6, 0.6], [1400, 0.9, 0.25]]) {
      const s = E.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const g = ctx.createGain(); g.gain.value = a; const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06 + Math.random() * 0.05; const lg = ctx.createGain(); lg.gain.value = a * 0.7; lfo.connect(lg).connect(g.gain); lfo.start();
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.11; const lg2 = ctx.createGain(); lg2.gain.value = f * 0.4; lfo2.connect(lg2).connect(bp.frequency); lfo2.start();
      s.connect(bp).connect(g).connect(this.windG);
    }
    this.windG.connect(this.out);
    // fluorescent hum: 120 Hz mains buzz and its harmonics, a little ballast whine, crackle
    this.buzzG = ctx.createGain(); this.buzzG.gain.value = 0;
    { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 120; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; const g = ctx.createGain(); g.gain.value = 0.05; o.connect(lp).connect(g).connect(this.buzzG); o.start();
      const o2 = ctx.createOscillator(); o2.frequency.value = 240; const g2 = ctx.createGain(); g2.gain.value = 0.03; o2.connect(g2).connect(this.buzzG); o2.start();
      const w = ctx.createOscillator(); w.frequency.value = 9800; const gw = ctx.createGain(); gw.gain.value = 0.004; w.connect(gw).connect(this.buzzG); w.start();
      const s = E.noiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000; const gc = ctx.createGain(); gc.gain.value = 0.012; s.connect(hp).connect(gc).connect(this.buzzG); }
    this.buzzG.connect(this.out);
    this.flickG = ctx.createGain(); this.flickG.gain.value = 0; { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 120; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; o.connect(bp).connect(this.flickG); o.start(); } this.flickG.connect(this.out);
    // hold music out of the reception phone (lo-fi, band-limited, looping)
    this.holdPan = E.panner(0, 0, 0, 1.2); this.holdPan.rolloffFactor = 1.6;
    this.holdG = ctx.createGain(); this.holdG.gain.value = 0;
    const tel = ctx.createBiquadFilter(); tel.type = 'bandpass'; tel.frequency.value = 1200; tel.Q.value = 0.8;
    this.holdIn = ctx.createGain(); this.holdIn.connect(tel).connect(this.holdG).connect(this.holdPan).connect(this.out);
    this.holdNext = ctx.currentTime + 0.2; this.holdStep = 0;
    // grinder (positioned when it runs)
    this.grindPan = E.panner(0, 0, 0, 8); this.grindPan.rolloffFactor = 0.8; this.grindPan.connect(this.out);
    this.ready = true;
  }

  // hold music: a jaunty, slightly sad tune in a square wave, the classic on-hold loop
  _hold() {
    const ctx = this.E.ctx;
    const tune = [[67, 0.3], [72, 0.3], [74, 0.3], [76, 0.6], [74, 0.3], [72, 0.3], [69, 0.6], [67, 0.3], [64, 0.3], [67, 0.9], [0, 0.3], [65, 0.3], [69, 0.3], [72, 0.3], [74, 0.6], [72, 0.3], [71, 0.3], [72, 1.2], [0, 0.6]];
    while (this.holdNext < ctx.currentTime + 0.5) {
      const [n, d] = tune[this.holdStep % tune.length]; this.holdStep++;
      if (n) {
        const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 440 * Math.pow(2, (n - 69) / 12);
        const g = ctx.createGain(); g.gain.setValueAtTime(0, this.holdNext); g.gain.linearRampToValueAtTime(0.06, this.holdNext + 0.01); g.gain.exponentialRampToValueAtTime(0.004, this.holdNext + d * 0.95);
        o.connect(g).connect(this.holdIn); o.start(this.holdNext); o.stop(this.holdNext + d);
        if (this.holdStep % 2) { const b = ctx.createOscillator(); b.type = 'triangle'; b.frequency.value = 440 * Math.pow(2, (n - 69 - 24) / 12); const bg = ctx.createGain(); bg.gain.setValueAtTime(0.05, this.holdNext); bg.gain.exponentialRampToValueAtTime(0.003, this.holdNext + d); b.connect(bg).connect(this.holdIn); b.start(this.holdNext); b.stop(this.holdNext + d); }
      }
      this.holdNext += d;
    }
  }

  _burst(pos, { dur = 0.5, f = 600, q = 0.8, gain = 0.8, thump = 0, ref = 3 } = {}) {
    if (!this.E.ctx || !this.ready) return;
    const E = this.E, ctx = E.ctx, t = ctx.currentTime;
    const pan = E.panner(pos.x, pos.y, pos.z, ref); pan.connect(this.out);
    const s = ctx.createBufferSource(); s.buffer = E.noiseBuf; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(bp).connect(g).connect(pan); s.start(t, Math.random() * 2); s.stop(t + dur + 0.05);
    if (thump) { const o = ctx.createOscillator(); o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(38, t + 0.3); const og = ctx.createGain(); og.gain.setValueAtTime(thump, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.45); o.connect(og).connect(pan); o.start(t); o.stop(t + 0.5); }
    setTimeout(() => { try { pan.disconnect(); } catch { /* gone */ } }, (dur + 1) * 1000);
  }
  /** the chair coming apart: a clatter of parts */
  chairCrash(pos) { if (!this.ready) return; for (let i = 0; i < 6; i++) setTimeout(() => this._burst(pos, { dur: 0.15 + Math.random() * 0.25, f: 900 + Math.random() * 2500, q: 2, gain: 0.5, thump: i === 0 ? 0.9 : 0 }), i * (60 + Math.random() * 90)); }
  /** a ceiling tile: a soft crack, a whump, then grit */
  tileFall(pos, landPos) { if (!this.ready) return; this._burst(pos, { dur: 0.2, f: 2500, q: 1.5, gain: 0.4 }); setTimeout(() => { this._burst(landPos, { dur: 0.6, f: 400, q: 0.5, gain: 0.7, thump: 0.6 }); this._burst(landPos, { dur: 1.4, f: 5000, q: 0.6, gain: 0.12 }); }, 720); }
  doorSwing(pos) { if (!this.ready) return; const ctx = this.E.ctx, t = ctx.currentTime; const pan = this.E.panner(pos.x, pos.y, pos.z, 2); pan.connect(this.out); const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(320 + Math.random() * 120, t); o.frequency.linearRampToValueAtTime(190, t + 0.5); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1300; bp.Q.value = 6; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.08); g.gain.linearRampToValueAtTime(0, t + 0.55); o.connect(bp).connect(g).connect(pan); o.start(t); o.stop(t + 0.6); this._burst(pos, { dur: 0.12, f: 300, q: 1, gain: 0.25, thump: 0.25 }); }
  rattle(pos) { if (!this.ready) return; for (let i = 0; i < 7; i++) setTimeout(() => this._burst(pos, { dur: 0.06, f: 1800 + Math.random() * 600, q: 4, gain: 0.6, thump: i % 2 ? 0.2 : 0 }), i * 75); }
  worksCrash(pos) { if (!this.ready) return; this._burst(pos, { dur: 1.2, f: 1500, q: 0.4, gain: 0.9, thump: 1 }); for (let i = 0; i < 5; i++) setTimeout(() => this._burst(pos, { dur: 0.3, f: 3000 + Math.random() * 3000, q: 3, gain: 0.3 }), 120 + i * 110); }
  /** angle grinder: a whine that bites and sparks, `dur` seconds, from somewhere in the trees */
  grind(pos, dur = 3) {
    if (!this.E.ctx || !this.ready) return;
    const ctx = this.E.ctx, t = ctx.currentTime, P = this.grindPan;
    P.positionX.setValueAtTime(pos.x, t); P.positionY.setValueAtTime(pos.y, t); P.positionZ.setValueAtTime(pos.z, t);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(190, t + 0.6);
    const s = ctx.createBufferSource(); s.buffer = this.E.noiseBuf; s.loop = true; const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 4200; bp.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.1, t + 0.4);
    for (let k = 0.6; k < dur; k += 0.35 + Math.random() * 0.4) g.gain.setTargetAtTime(0.08 + Math.random() * 0.1, t + k, 0.05);
    g.gain.setTargetAtTime(0, t + dur, 0.3); o.frequency.setTargetAtTime(60, t + dur, 0.6);
    const og = ctx.createGain(); og.gain.value = 0.35; o.connect(og).connect(g); s.connect(bp).connect(g); g.connect(P);
    o.start(t); s.start(t); o.stop(t + dur + 2); s.stop(t + dur + 2);
  }
  hawk(pos) { if (!this.ready) return; const ctx = this.E.ctx, t = ctx.currentTime; const pan = this.E.panner(pos.x, pos.y, pos.z, 30); pan.connect(this.out); const o = ctx.createOscillator(); o.frequency.setValueAtTime(2900, t); o.frequency.exponentialRampToValueAtTime(1500, t + 1.4); const v = ctx.createOscillator(); v.frequency.value = 38; const vg = ctx.createGain(); vg.gain.value = 120; v.connect(vg).connect(o.frequency); const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 1.5); o.connect(g).connect(pan); o.start(t); v.start(t); o.stop(t + 1.6); v.stop(t + 1.6); }

  /** Dale's voice: his words, synthesised syllable by syllable, from where he is */
  babble(text, pos, { shout = true, f0 = 138 } = {}) {
    if (!this.E.ctx || !this.ready) return;
    const ctx = this.E.ctx; const pan = this.E.panner(pos.x, pos.y, pos.z, 2.5); pan.rolloffFactor = 1.3; pan.connect(this.out);
    const words = text.split(/\s+/).filter(Boolean).slice(0, 9);
    let t0 = ctx.currentTime + 0.05;
    const caps = text === text.toUpperCase();
    words.forEach((w, i) => {
      const ph = wordPhonemes(w, { shout: caps, long: /[?!]/.test(w) ? 0.18 : 0 });
      const d = synthWord(ctx, pan, ph, { t0, f0: f0 * (caps ? 1.25 : 1) * (1 + (Math.random() - 0.5) * 0.12), breath: 0.35, gain: caps ? 0.55 : 0.4 });
      t0 += d + (/[.,…]/.test(w) ? 0.22 : 0.05);
    });
    setTimeout(() => { try { pan.disconnect(); } catch { /* gone */ } }, (t0 - ctx.currentTime + 2) * 1000);
  }

  /** PA: chime, crackle, then the line. Returns a promise for when it is done. */
  pa(line, speakers, { onStart } = {}) {
    if (!this.E.ctx || !this.ready) { onStart?.(); return Promise.resolve(); }
    this.paQueue = this.paQueue.then(() => this._pa(line, speakers, onStart));
    return this.paQueue;
  }
  async _pa(line, speakers, onStart) {
    const E = this.E, ctx = E.ctx;
    // a speaker bus: each ceiling speaker is a panner fed by the same tinny chain
    const bus = ctx.createGain(); bus.gain.value = 1;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 380; const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3400; const sh = ctx.createWaveShaper(); const c = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; c[i] = Math.tanh(x * 2.2); } sh.curve = c;
    bus.connect(hp).connect(lp).connect(sh);
    const pans = speakers.map((p) => { const pn = E.panner(p.x, p.y, p.z, 3); pn.rolloffFactor = 1.1; sh.connect(pn).connect(this.out); return pn; });
    const t = ctx.currentTime + 0.05;
    // crackle on, ding-dong
    this._paCrackle(bus, t, 0.4);
    for (const [f, dt] of [[784, 0], [622, 0.45]]) { const o = ctx.createOscillator(); o.frequency.value = f; const g = ctx.createGain(); g.gain.setValueAtTime(0, t + 0.3 + dt); g.gain.linearRampToValueAtTime(0.35, t + 0.32 + dt); g.gain.exponentialRampToValueAtTime(0.001, t + 1.4 + dt); o.connect(g).connect(bus); o.start(t + 0.3 + dt); o.stop(t + 1.5 + dt); }
    // hiss under the voice
    const hs = E.noiseSrc(); const hg = ctx.createGain(); hg.gain.value = 0; hs.connect(hg).connect(bus); hg.gain.setTargetAtTime(0.03, t + 1.2, 0.2);
    await new Promise((r) => setTimeout(r, 1600));
    onStart?.();
    let dur = 0;
    if (line.audio) {
      try { const r = await fetch(line.audio); const buf = await ctx.decodeAudioData(await r.arrayBuffer()); const s = ctx.createBufferSource(); s.buffer = buf; s.connect(bus); s.start(); dur = buf.duration; await new Promise((res) => setTimeout(res, dur * 1000 + 200)); } catch { dur = 0; }
    }
    if (!dur) dur = await this._speak(line.text, bus);
    hg.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
    this._paCrackle(bus, ctx.currentTime + 0.1, 0.25);
    setTimeout(() => { try { hs.stop(); bus.disconnect(); sh.disconnect(); pans.forEach((p) => p.disconnect()); } catch { /* gone */ } }, 1500);
  }
  _paCrackle(bus, t, dur) { const ctx = this.E.ctx; const s = ctx.createBufferSource(); s.buffer = this.E.noiseBuf; const g = ctx.createGain(); g.gain.setValueAtTime(0, t); for (let k = 0; k < dur; k += 0.02) g.gain.setValueAtTime(Math.random() < 0.4 ? Math.random() * 0.3 : 0, t + k); g.gain.setValueAtTime(0, t + dur); s.connect(g).connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05); }
  /** the speech engine if the browser has one (it cannot be routed through Web Audio, so the PA
   *  chain carries only the chime and hiss; the voice is pitched down and slowed), else a mumble */
  _speak(text, bus) {
    const synth = window.speechSynthesis;
    const voices = synth?.getVoices?.() || [];
    if (synth && voices.length) {
      return new Promise((res) => {
        const u = new SpeechSynthesisUtterance(text.replace(/…/g, '... '));
        const en = voices.filter((v) => /^en/i.test(v.lang)); u.voice = en.find((v) => /male|daniel|fred|alex|david|google uk english male/i.test(v.name)) || en[0] || voices[0];
        u.pitch = 0.7; u.rate = 0.92; u.volume = 0.85;
        const t0 = performance.now(); let done = false; const fin = () => { if (!done) { done = true; res((performance.now() - t0) / 1000); } };
        u.onend = fin; u.onerror = fin; setTimeout(fin, 2000 + text.length * 120);
        synth.speak(u);
      });
    }
    // fallback: a low, flat, formant mumble of the actual words through the speakers
    const ctx = this.E.ctx; let t0 = ctx.currentTime + 0.05; const start = t0;
    for (const w of text.split(/\s+/).slice(0, 14)) { t0 += synthWord(ctx, bus, wordPhonemes(w), { t0, f0: 82, breath: 0.25, gain: 0.5 }) + 0.06; }
    return new Promise((r) => setTimeout(() => r(t0 - start), (t0 - start) * 1000 + 300));
  }

  /**
   * per frame. lv = {outdoor, inside, backrooms} weights 0..1, `phone` world pos of the reception
   * phone, `flicker` 0..1 near a flickering tube, `on` = in the story realm.
   */
  update(dt, { on = false, outdoor = 0, inside = 0, backrooms = 0, phone = null, flicker = 0, camera = null } = {}) {
    if (!this.E.ctx) return;
    if (!this.ready) { if (!on) return; this._init(); }
    const t = this.E.ctx.currentTime;
    this.out.gain.setTargetAtTime(on ? 1 : 0, t, on ? 0.4 : 0.15);
    if (!on) return;
    this.windG.gain.setTargetAtTime(0.16 * outdoor + 0.035 * inside + 0.008 * backrooms, t, 0.6);
    this.buzzG.gain.setTargetAtTime(0.35 * inside + 1.0 * backrooms, t, 0.4);
    this.flickG.gain.setTargetAtTime(flicker * 0.02 * (Math.random() < 0.5 ? 1 : 0.2), t, 0.02);
    this.roomWet.gain.setTargetAtTime(0.12 + 0.3 * backrooms + 0.15 * inside, t, 0.5);
    if (phone) { this.holdPan.positionX.setTargetAtTime(phone.x, t, 0.1); this.holdPan.positionY.setTargetAtTime(phone.y, t, 0.1); this.holdPan.positionZ.setTargetAtTime(phone.z, t, 0.1); }
    this.holdG.gain.setTargetAtTime(phone ? 0.8 * (inside + outdoor * 0.15) : 0, t, 0.3);
    this._hold();
    this.nextHawk -= dt;
    if (this.nextHawk < 0 && outdoor > 0.5 && camera) { const a = Math.random() * 6.28; this.hawk({ x: camera.position.x + Math.cos(a) * 60, y: camera.position.y + 40, z: camera.position.z + Math.sin(a) * 60 }); this.nextHawk = 35 + Math.random() * 50; }
  }
}
