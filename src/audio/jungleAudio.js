// Jungle sound: an ambience bed (insect chorus, dripping, leaf-wind) and the stalker's voice set
// (breathing, clicks, growls, low thumps, leaf rustle), all placed in space with HRTF panners.
// Built lazily on the shared AudioEngine once audio has started.
export class JungleAudio {
  constructor(engine) { this.E = engine; this.ready = false; this.level = 0; this.nextDrip = 0; this.nextCall = 0; }

  _init() {
    const E = this.E, ctx = E.ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0; this.out.connect(E.bus);
    // insect chorus: several pulsing narrow bands, each its own little creature somewhere around
    this.insects = [];
    for (let i = 0; i < 5; i++) {
      const s = E.noiseSrc();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200 + i * 900 + Math.random() * 400; bp.Q.value = 18;
      const am = ctx.createGain(); am.gain.value = 0;
      const lfo = ctx.createOscillator(); lfo.type = i % 2 ? 'square' : 'sine'; lfo.frequency.value = 9 + Math.random() * 22;
      const lfoG = ctx.createGain(); lfoG.gain.value = 0.5; lfo.connect(lfoG).connect(am.gain);
      const slow = ctx.createOscillator(); slow.frequency.value = 0.05 + Math.random() * 0.1; const slowG = ctx.createGain(); slowG.gain.value = 0.45; slow.connect(slowG).connect(am.gain);
      const g = ctx.createGain(); g.gain.value = 0.05;
      const pan = E.panner(0, 0, 0, 4);
      s.connect(bp).connect(am).connect(g).connect(pan).connect(this.out);
      lfo.start(); slow.start();
      this.insects.push({ pan, a: Math.random() * 6.28, r: 6 + Math.random() * 10, h: 1 + Math.random() * 6 });
    }
    // leaf-wind through the canopy
    { const s = E.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.5; const g = ctx.createGain(); g.gain.value = 0.05;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09; const lg = ctx.createGain(); lg.gain.value = 0.04; lfo.connect(lg).connect(g.gain); lfo.start();
      s.connect(bp).connect(g).connect(this.out); }
    // the stalker: a breathing voice that follows its position
    this.sPan = E.panner(0, 0, 0, 3); this.sPan.rolloffFactor = 1.4; this.sOut = ctx.createGain(); this.sOut.gain.value = 1;
    this.sPan.connect(this.sOut).connect(this.out);
    { const s = E.noiseSrc(); const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 520; f1.Q.value = 3; const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1300; f2.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0; this.breathG = g; this.breathF = f1;
      s.connect(f1).connect(g); s.connect(f2).connect(g); g.connect(this.sPan); }
    // leaf rustle bus (spatial), driven per frame by rustle strength
    this.rPan = E.panner(0, 0, 0, 3);
    { const s = E.noiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800; const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 4200; bp.gain.value = 6;
      const g = ctx.createGain(); g.gain.value = 0; this.rustleG = g;
      const chop = ctx.createGain(); chop.gain.value = 0.5; const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = 0.5; lfo.connect(lg).connect(chop.gain); lfo.start();
      s.connect(hp).connect(bp).connect(chop).connect(g).connect(this.rPan).connect(this.out); }
    // the player's own passage through the leaves (close, non-spatial)
    { const s = E.noiseSrc(); const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 2600; hp.Q.value = 0.8; const g = ctx.createGain(); g.gain.value = 0; this.selfG = g; s.connect(hp).connect(g).connect(this.out); }
    this.ready = true;
  }

  _at(pan, p, t) { pan.positionX.setTargetAtTime(p.x, t, 0.05); pan.positionY.setTargetAtTime(p.y, t, 0.05); pan.positionZ.setTargetAtTime(p.z, t, 0.05); }

  /** one-shot sounds from the stalker */
  growl(p, vol = 1) {
    if (!this.E.ctx || !this.ready) return; // audio not started yet (or headless)
    const ctx = this.E.ctx, t = ctx.currentTime, dur = 1.2 + Math.random() * 1.4;
    const pan = this.E.panner(p.x, p.y, p.z, 3); pan.connect(this.out);
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(55 + Math.random() * 20, t); o.frequency.linearRampToValueAtTime(38, t + dur);
    const fm = ctx.createOscillator(); fm.frequency.value = 23 + Math.random() * 14; const fmg = ctx.createGain(); fmg.gain.value = 18; fm.connect(fmg).connect(o.frequency);
    const ws = ctx.createWaveShaper(); const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; c[i] = Math.tanh(x * 4); } ws.curve = c;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(240, t + dur); f.Q.value = 2.5;
    const n = this.E.noiseSrc(); const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 700; nf.Q.value = 1.5; const ng = ctx.createGain(); ng.gain.value = 0.25;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5 * vol, t + 0.25); g.gain.setTargetAtTime(0, t + dur * 0.7, dur * 0.2);
    o.connect(ws).connect(f).connect(g); n.connect(nf).connect(ng).connect(g); g.connect(pan);
    o.start(t); fm.start(t); o.stop(t + dur + 1); fm.stop(t + dur + 1); setTimeout(() => n.stop(), (dur + 1) * 1000);
  }
  clicks(p, n = 6 + Math.floor(Math.random() * 8)) {
    if (!this.E.ctx || !this.ready) return; // audio not started yet (or headless)
    const ctx = this.E.ctx, t0 = ctx.currentTime;
    const pan = this.E.panner(p.x, p.y, p.z, 2.5); pan.connect(this.out);
    for (let i = 0; i < n; i++) {
      const t = t0 + i * (0.05 + Math.random() * 0.07) + (i > n / 2 ? 0.25 : 0);
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.setValueAtTime(1900 + Math.random() * 1500, t); o.frequency.exponentialRampToValueAtTime(400, t + 0.02);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2600; f.Q.value = 3;
      o.connect(f).connect(g).connect(pan); o.start(t); o.stop(t + 0.05);
    }
  }
  thump(p, vol = 1) {
    if (!this.E.ctx || !this.ready) return; // audio not started yet (or headless)
    const ctx = this.E.ctx, t = ctx.currentTime;
    const pan = this.E.panner(p.x, p.y, p.z, 4); pan.connect(this.out);
    for (let k = 0; k < 2; k++) {
      const tt = t + k * 0.32;
      const o = ctx.createOscillator(); o.frequency.setValueAtTime(70, tt); o.frequency.exponentialRampToValueAtTime(32, tt + 0.35);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.55 * vol * (k ? 0.6 : 1), tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.5);
      o.connect(g).connect(pan); o.start(tt); o.stop(tt + 0.6);
    }
  }

  /**
   * per frame. inJungle: fade the bed in/out. s: stalker snapshot { pos, breath 0..1, rustle 0..1, rustlePos }.
   * playerRustle 0..1: how hard the player is pushing through leaves.
   */
  update(camera, { inJungle, s, playerRustle = 0 }) {
    const E = this.E; if (!E.ctx) return;
    if (!this.ready) this._init();
    const ctx = E.ctx, t = ctx.currentTime, c = camera.position;
    this.out.gain.setTargetAtTime(inJungle ? 1 : 0, t, inJungle ? 1.5 : 0.4);
    if (E.droneGain) E.droneGain.gain.setTargetAtTime(inJungle ? 0.025 : 0.07, t, 1.5);
    if (!inJungle) return;
    const now = performance.now() / 1000;
    this.insects.forEach((k, i) => { const a = k.a + now * 0.02 * (i % 2 ? 1 : -1); this._at(k.pan, { x: c.x + Math.cos(a) * k.r, y: c.y + k.h, z: c.z + Math.sin(a) * k.r }, t); });
    if (s) {
      this._at(this.sPan, s.pos, t);
      this.breathG.gain.setTargetAtTime(0.16 * s.breath * (0.55 + 0.45 * Math.max(0, Math.sin(now * 1.7))), t, 0.15);
      this.breathF.frequency.setTargetAtTime(420 + 200 * Math.sin(now * 1.7), t, 0.2);
      this._at(this.rPan, s.rustlePos || s.pos, t);
      this.rustleG.gain.setTargetAtTime(0.09 * s.rustle, t, 0.05);
    }
    this.selfG.gain.setTargetAtTime(0.05 * playerRustle, t, 0.08);
    // drips: little pitched plinks from random spots around
    if (t > this.nextDrip) {
      this.nextDrip = t + 0.4 + Math.random() * 2.2;
      const a = Math.random() * 6.28, r = 3 + Math.random() * 12;
      const pan = E.panner(c.x + Math.cos(a) * r, c.y + 2, c.z + Math.sin(a) * r, 2); pan.connect(this.out);
      const o = ctx.createOscillator(); const f = 900 + Math.random() * 1400; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.04);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(g).connect(pan); o.start(t); o.stop(t + 0.2);
    }
  }
}
