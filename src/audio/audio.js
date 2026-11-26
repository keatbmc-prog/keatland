// Procedural ambient audio (WebAudio, no samples): a breathing drone, the heart's thump, wind in
// the void, the congregation's chant (spatialised at the altar), the pencil's scratching (follows
// its tip), distant groans, and one-shots for the sword and the transitions.
export class AudioEngine {
  constructor({ voices = 6 } = {}) { this.ctx = null; this.started = false; this.maxVoices = voices; } // phones: fewer chant voices

  start() {
    if (this.started) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.started = true;
    // iOS Safari: unlock inside the user gesture (resume + a one-sample silent buffer)
    if (ctx.state !== 'running') ctx.resume?.();
    try { const b = ctx.createBufferSource(); b.buffer = ctx.createBuffer(1, 1, 22050); b.connect(ctx.destination); b.start(0); } catch (e) { /* ignore */ }
    const master = this.master = ctx.createGain(); master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
    // shared reverb (generated impulse)
    const conv = ctx.createConvolver(); conv.buffer = this.impulse(5.5, 2.4);
    const wet = ctx.createGain(); wet.gain.value = 0.55;
    this.bus = ctx.createGain();
    this.bus.connect(comp); this.bus.connect(conv); conv.connect(wet); wet.connect(comp);
    comp.connect(master); master.connect(ctx.destination);
    master.gain.linearRampToValueAtTime(0.9, ctx.currentTime + 4);
    this.noiseBuf = this.noise(4);
    this.drone(); this.wind(); this.chant(); this.scratch();
    this.nextGroan = ctx.currentTime + 8;
  }

  impulse(sec, decay) {
    const ctx = this.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  noise(sec) {
    const ctx = this.ctx, n = ctx.sampleRate * sec, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0; for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.5 + last * 3; }
    return b;
  }
  noiseSrc() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(); return s; }

  drone() {
    const ctx = this.ctx;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 4;
    const g = ctx.createGain(); g.gain.value = 0.07;
    [43.65, 43.9, 65.4, 87.3, 98.0].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'triangle'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12; const og = ctx.createGain(); og.gain.value = i < 2 ? 0.5 : 0.25; o.connect(og).connect(lp); o.start(); });
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05; const lg = ctx.createGain(); lg.gain.value = 140; lfo.connect(lg).connect(lp.frequency); lfo.start();
    lp.connect(g).connect(this.bus);
    this.droneGain = g;
  }
  wind() {
    const ctx = this.ctx, s = this.noiseSrc();
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.7;
    const g = ctx.createGain(); g.gain.value = 0.05;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 250; lfo.connect(lg).connect(bp.frequency); lfo.start();
    s.connect(bp).connect(g).connect(this.bus);
    this.windGain = g;
  }
  panner(x = 0, y = 0, z = 0, ref = 6) {
    const p = this.ctx.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = ref; p.rolloffFactor = 1.2; p.maxDistance = 400;
    p.positionX.value = x; p.positionY.value = y; p.positionZ.value = z; return p;
  }
  chant() {
    const ctx = this.ctx;
    this.chantPan = this.panner(0, 2, -3, 8);
    const g = this.chantGain = ctx.createGain(); g.gain.value = 0;
    const voices = [110, 130.8, 164.8, 98].slice(0, Math.max(2, Math.min(4, this.maxVoices)));
    this.formants = [];
    voices.forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 20;
      const vib = ctx.createOscillator(); vib.frequency.value = 4 + i * 0.7; const vg = ctx.createGain(); vg.gain.value = 3; vib.connect(vg).connect(o.frequency); vib.start();
      const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 600; f1.Q.value = 9;
      const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1000; f2.Q.value = 12;
      const og = ctx.createGain(); og.gain.value = 0.35;
      o.connect(f1).connect(og); o.connect(f2).connect(og); og.connect(g); o.start();
      this.formants.push([f1, f2]);
    });
    g.connect(this.chantPan).connect(this.bus);
  }
  scratch() {
    const ctx = this.ctx, s = this.noiseSrc();
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const bp = ctx.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 5200; bp.gain.value = 10;
    const g = this.scratchGain = ctx.createGain(); g.gain.value = 0;
    this.scratchPan = this.panner(0, 10, 0, 10);
    s.connect(hp).connect(bp).connect(g).connect(this.scratchPan).connect(this.bus);
  }

  heartbeat(strength = 1) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [dt, a] of [[0, 1], [0.27, 0.65]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(62, t + dt); o.frequency.exponentialRampToValueAtTime(34, t + dt + 0.25);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t + dt); g.gain.linearRampToValueAtTime(0.32 * a * strength, t + dt + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dt + 0.4);
      o.connect(g).connect(this.bus); o.start(t + dt); o.stop(t + dt + 0.5);
    }
  }

  groan() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sawtooth'; const f = 50 + Math.random() * 40;
    o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * (0.6 + Math.random() * 0.3), t + 6);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(120, t); lp.frequency.linearRampToValueAtTime(420, t + 2.5); lp.frequency.linearRampToValueAtTime(90, t + 6); lp.Q.value = 8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 2); g.gain.linearRampToValueAtTime(0, t + 6.5);
    const a = Math.random() * Math.PI * 2; const p = this.panner(Math.cos(a) * 200, -40 + Math.random() * 120, Math.sin(a) * 200, 120);
    o.connect(lp).connect(g).connect(p).connect(this.bus); o.start(t); o.stop(t + 7);
  }

  /** A dry wooden-bone clack + grind as a cube layer turns, placed in space. */
  cubeTwist(pos, dur = 0.5, vol = 1) {
    if (!this.ctx || vol < 0.02) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const pan = this.panner(pos.x, pos.y, pos.z, 3);
    const s = this.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
    bp.frequency.setValueAtTime(500 + Math.random() * 300, t); bp.frequency.linearRampToValueAtTime(1400 + Math.random() * 600, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06 * vol, t + dur * 0.3); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(bp).connect(g).connect(pan); pan.connect(this.bus);
    // the snap at the end of the turn
    const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(900 + Math.random() * 500, t + dur); o.frequency.exponentialRampToValueAtTime(140, t + dur + 0.06);
    const og = ctx.createGain(); og.gain.setValueAtTime(0, t + dur - 0.01); og.gain.linearRampToValueAtTime(0.18 * vol, t + dur); og.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.09);
    o.connect(og).connect(pan); o.start(t + dur - 0.02); o.stop(t + dur + 0.12);
    setTimeout(() => { s.stop(); }, (dur + 0.2) * 1000);
  }
  swordStrain(attempt) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // grinding strain
    const s = this.noiseSrc(); const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(200, t); bp.frequency.linearRampToValueAtTime(900, t + 1.4); bp.Q.value = 6;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 1.2); g.gain.linearRampToValueAtTime(0, t + 1.5);
    s.connect(bp).connect(g).connect(this.bus); setTimeout(() => s.stop(), 1800);
  }
  swordBurst() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    // bell-like inharmonic ring
    [523, 1187, 1781, 2491, 3301].forEach((f, i) => {
      const o = ctx.createOscillator(); o.frequency.value = f * (0.5 + Math.random() * 0.01);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.18 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 4 - i * 0.5);
      o.connect(g).connect(this.bus); o.start(t); o.stop(t + 4.5);
    });
    // slam
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + 1.3);
  }
  whoosh(dur = 4, down = true) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, s = this.noiseSrc();
    const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.Q.value = 1.5;
    lp.frequency.setValueAtTime(down ? 1800 : 200, t); lp.frequency.exponentialRampToValueAtTime(down ? 160 : 2400, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + dur * 0.4); g.gain.linearRampToValueAtTime(0, t + dur);
    s.connect(lp).connect(g).connect(this.bus); setTimeout(() => s.stop(), dur * 1000 + 200);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(down ? 220 : 55, t); o.frequency.exponentialRampToValueAtTime(down ? 40 : 330, t + dur);
    const og = ctx.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(0.15, t + dur * 0.5); og.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(og).connect(this.bus); o.start(t); o.stop(t + dur + 0.1);
  }
  gulp() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.5);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.8);
  }

  /** per-frame: listener follows the camera, chant follows the ritual, scratch follows the pencil */
  update(camera, { ritual = 0, pencilTip, pencilDraw = 0, below = false, quiet = false } = {}) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, Lr = ctx.listener;
    const p = camera.position; const f = camera.getWorldDirection(this._f || (this._f = camera.position.clone()));
    if (Lr.positionX) { Lr.positionX.setTargetAtTime(p.x, t, 0.05); Lr.positionY.setTargetAtTime(p.y, t, 0.05); Lr.positionZ.setTargetAtTime(p.z, t, 0.05); Lr.forwardX.setTargetAtTime(f.x, t, 0.05); Lr.forwardY.setTargetAtTime(f.y, t, 0.05); Lr.forwardZ.setTargetAtTime(f.z, t, 0.05); Lr.upX.value = 0; Lr.upY.value = 1; Lr.upZ.value = 0; }
    else { Lr.setPosition(p.x, p.y, p.z); Lr.setOrientation(f.x, f.y, f.z, 0, 1, 0); }
    this.chantGain.gain.setTargetAtTime(ritual * 0.22, t, 0.5);
    // vowels drift with the ceremony
    const vowel = 0.5 + 0.5 * Math.sin(t * 0.7);
    this.formants.forEach(([a, b], i) => { a.frequency.setTargetAtTime(450 + vowel * 400 + i * 20, t, 0.2); b.frequency.setTargetAtTime(900 + (1 - vowel) * 900, t, 0.2); });
    if (pencilTip) { this.scratchPan.positionX.setTargetAtTime(pencilTip.x, t, 0.05); this.scratchPan.positionY.setTargetAtTime(pencilTip.y, t, 0.05); this.scratchPan.positionZ.setTargetAtTime(pencilTip.z, t, 0.05); }
    this.scratchGain.gain.setTargetAtTime(pencilDraw * 0.12, t, 0.08);
    this.windGain.gain.setTargetAtTime(quiet ? 0 : below ? 0.11 : 0.05, t, 1);
    this.droneGain.gain.setTargetAtTime(quiet ? 0 : 0.07, t, 0.8); // the story realm is daylight: no hub drone, no groans
    if (quiet) { this.nextGroan = Math.max(this.nextGroan, t + 10); return; }
    if (t > this.nextGroan) { this.groan(); this.nextGroan = t + 18 + Math.random() * 25; }
  }
}
