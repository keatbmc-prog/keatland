// The disembodied voice. Every so often the wind moves through the trees and a voice drifts out of
// them, stretching one word: "proooojects..." (rarely "groooowth..."). It comes from a different
// place among the trees each time, drifts while it speaks, and is carried on a gust.
//
// The word is synthesised: a breathy glottal source (two detuned sawtooths an octave apart plus
// aspiration noise) through three formant filters whose frequencies glide phoneme to phoneme, with
// noise fricatives and plosive bursts. That lets the vowel be stretched for as long as it likes,
// which speech engines cannot do. Lines (and optional recorded files) live in src/data/voiceLines.js.
import { VOICE_LINES, VOICE_SCHEDULE, PHONEMES } from '../data/voiceLines.js';

// vowel / approximant formants (F1, F2, F3) for a low, adult voice; diphthongs give [start, end]
const VOW = {
  oU: [[560, 900, 2400], [380, 760, 2300]], eI: [[560, 1750, 2500], [380, 2150, 2700]],
  E: [[560, 1750, 2500]], I: [[400, 1950, 2600]], A: [[700, 1100, 2450]], '@': [[500, 1450, 2450]], V: [[620, 1200, 2500]],
  r: [[420, 1150, 1500]], w: [[320, 680, 2200]], l: [[380, 1100, 2600]], m: [[260, 1000, 2300]], n: [[260, 1500, 2500]],
};
const AMP = { oU: 1, eI: 1, E: 0.9, I: 0.8, A: 1, '@': 0.7, V: 0.9, r: 0.55, w: 0.5, l: 0.55, m: 0.35, n: 0.35 };
const FRIC = { s: [5200, 3, 0.9], th: [3800, 0.8, 0.45], sh: [2600, 2, 0.8], f: [4200, 0.6, 0.35] };
const BURST = { p: [800, 0.5], t: [3800, 0.7], k: [1800, 0.7], g: [1500, 0.5], d: [3000, 0.5], j: [2600, 0.8] };

function noiseBuffer(ctx, sec = 3) {
  const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}

/**
 * Synthesise one stretched word into `dest`, starting at time t0. Works on AudioContext and
 * OfflineAudioContext. Returns its duration in seconds.
 */
export function synthWord(ctx, dest, phonemes, { t0 = ctx.currentTime + 0.05, stretch = 1, f0 = 98, breath = 0.55, gain = 1 } = {}) {
  const segs = phonemes.map(([p, d, fl]) => ({ p, d: fl && fl.includes('L') ? d * stretch : d, long: !!(fl && fl.includes('L')) }));
  let T = 0; segs.forEach((s) => { s.t = T; T += s.d; });
  const end = t0 + T + 0.6;
  const nb = noiseBuffer(ctx, 3);
  const noise = () => { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(t0); s.stop(end); return s; };

  // glottal source: sawtooth + sub-octave, with vibrato and a long falling moan on the long vowel
  const src = ctx.createGain(); src.gain.value = 1;
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
  const o2 = ctx.createOscillator(); o2.type = 'sawtooth';
  const sub = ctx.createGain(); sub.gain.value = 0.35;
  const vib = ctx.createOscillator(); vib.frequency.value = 4.6; const vibG = ctx.createGain(); vibG.gain.value = 1.8;
  vib.connect(vibG); vibG.connect(o1.frequency); vibG.connect(o2.frequency);
  const voiced = ctx.createGain(); voiced.gain.value = 0;
  o1.connect(voiced); o2.connect(sub).connect(voiced);
  const glot = ctx.createBiquadFilter(); glot.type = 'lowpass'; glot.frequency.value = 2600; // soften the buzz
  voiced.connect(glot).connect(src);
  const asp = ctx.createGain(); asp.gain.value = 0; noise().connect(asp).connect(src);
  [o1, o2, vib].forEach((o) => { o.start(t0); o.stop(end); });
  // pitch contour
  const longSeg = segs.find((s) => s.long) || segs[0];
  o1.frequency.setValueAtTime(f0 * 1.04, t0);
  o1.frequency.linearRampToValueAtTime(f0 * 1.12, t0 + longSeg.t + 0.15);
  o1.frequency.linearRampToValueAtTime(f0 * 0.78, t0 + longSeg.t + longSeg.d);
  o1.frequency.linearRampToValueAtTime(f0 * 0.7, t0 + T);
  o2.frequency.setValueAtTime(f0 * 0.52, t0);
  o2.frequency.linearRampToValueAtTime(f0 * 0.56, t0 + longSeg.t + 0.15);
  o2.frequency.linearRampToValueAtTime(f0 * 0.39, t0 + longSeg.t + longSeg.d);
  o2.frequency.linearRampToValueAtTime(f0 * 0.35, t0 + T);
  o2.detune.value = 9;

  // vocal tract: three formant band-passes in parallel
  const out = ctx.createGain(); out.gain.value = 0;
  const F = [0, 1, 2].map((i) => {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = [7, 11, 13][i];
    const g = ctx.createGain(); g.gain.value = [1.0, 0.55, 0.28][i] * 3.2;
    src.connect(bp).connect(g).connect(out);
    return bp;
  });
  // fricative and burst paths (noise straight to the output, shaped)
  const fr = ctx.createBiquadFilter(); fr.type = 'bandpass'; const frG = ctx.createGain(); frG.gain.value = 0;
  noise().connect(fr).connect(frG).connect(out);
  const br = ctx.createBiquadFilter(); br.type = 'bandpass'; const brG = ctx.createGain(); brG.gain.value = 0;
  noise().connect(br).connect(brG).connect(out);

  const tau = 0.035;
  let lastV = VOW.oU[0];
  for (const s of segs) {
    const ts = t0 + s.t;
    if (VOW[s.p]) {
      const [a, b] = VOW[s.p]; lastV = b || a;
      F.forEach((f, i) => {
        f.frequency.setTargetAtTime(a[i], ts, tau);
        if (b) f.frequency.setTargetAtTime(b[i], ts + s.d * 0.35, s.d * 0.4); // the slow glide of a long "ooo"
      });
      const amp = AMP[s.p];
      voiced.gain.setTargetAtTime(amp, ts, tau);
      asp.gain.setTargetAtTime(breath * (s.long ? 1.15 : 0.8), ts, tau);
      frG.gain.setTargetAtTime(0, ts, 0.02);
      if (s.long) { // the moan swells and sags while it is drawn out
        voiced.gain.setTargetAtTime(amp * 1.15, ts + s.d * 0.2, s.d * 0.2);
        voiced.gain.setTargetAtTime(amp * 0.55, ts + s.d * 0.6, s.d * 0.25);
      }
    } else if (FRIC[s.p]) {
      const [fq, q, a] = FRIC[s.p];
      fr.frequency.setValueAtTime(fq, ts); fr.Q.setValueAtTime(q, ts);
      voiced.gain.setTargetAtTime(0, ts, 0.02); asp.gain.setTargetAtTime(breath * 0.3, ts, 0.02);
      frG.gain.setTargetAtTime(a * 0.9, ts, 0.03); frG.gain.setTargetAtTime(0, ts + s.d * 0.6, s.d * 0.25);
    } else if (BURST[s.p]) {
      const [fq, a] = BURST[s.p];
      voiced.gain.setTargetAtTime(s.p === 'g' || s.p === 'd' || s.p === 'j' ? 0.15 : 0, ts, 0.008);
      asp.gain.setTargetAtTime(0.05, ts, 0.01);
      br.frequency.setValueAtTime(fq, ts); br.Q.setValueAtTime(1.2, ts);
      brG.gain.setValueAtTime(0, ts + s.d * 0.5); brG.gain.linearRampToValueAtTime(a, ts + s.d * 0.5 + 0.006); brG.gain.exponentialRampToValueAtTime(0.0005, ts + s.d + 0.03);
      if (s.p === 'j') { fr.frequency.setValueAtTime(2600, ts); fr.Q.setValueAtTime(2, ts); frG.gain.setTargetAtTime(0.5, ts + s.d * 0.5, 0.02); frG.gain.setTargetAtTime(0, ts + s.d, 0.03); }
    }
  }
  // overall envelope
  out.gain.setValueAtTime(0, t0);
  out.gain.linearRampToValueAtTime(gain, t0 + 0.06);
  out.gain.setValueAtTime(gain, t0 + T - 0.05);
  out.gain.linearRampToValueAtTime(0, t0 + T + 0.35);
  voiced.gain.setTargetAtTime(0, t0 + T, 0.08); asp.gain.setTargetAtTime(0, t0 + T, 0.1);
  out.connect(dest);
  return T;
}

export class Voice {
  /**
   * @param engine   AudioEngine (ctx, bus) - the voice joins its reverb
   * @param textEl   optional element for the faint dissolving text
   */
  constructor(engine, { textEl = null, showText = true, lines = VOICE_LINES, schedule = VOICE_SCHEDULE } = {}) {
    Object.assign(this, { engine, textEl, showText, lines, schedule });
    this.next = { jungle: null, hub: null, gallery: null, story: null };
    this.speaking = 0; this.zone = 'hub'; this.buffers = new Map();
    this.onSpeak = null; // (line, worldPos) => void
    this.placer = null; // optional (zone, camera) => Vector3 | null: where in the world the trees are
  }
  _rand([a, b]) { return a + Math.random() * (b - a); }
  _pick(zone) {
    const c = this.lines.filter((l) => !l.zones || l.zones.includes(zone));
    let w = c.reduce((s, l) => s + (l.weight ?? 1), 0) * Math.random();
    for (const l of c) { w -= l.weight ?? 1; if (w <= 0) return l; }
    return c[0];
  }

  /** Call every frame. `time` = simulation seconds, `zone` = current realm, camera for placement. */
  update(time, zone, camera) {
    this._lastTime = time;
    if (zone !== this.zone) { this.zone = zone; this.next[zone] = null; }
    const sch = this.schedule[zone];
    if (!sch) return;
    if (this.next[zone] === null) this.next[zone] = time + this._rand(this.schedule[zone + 'First'] || sch);
    if (time >= this.next[zone] && this.engine.ctx && time > this.speaking) {
      this.speak(this._pick(zone), camera);
      this.next[zone] = time + this._rand(sch);
    }
  }

  /** Speak a line now, from somewhere around the camera (or at `at`). */
  async speak(line, camera, at = null) {
    const E = this.engine; if (!E.ctx || !line) return;
    const ctx = E.ctx, t0 = ctx.currentTime + 0.4;
    // somewhere among the trees: random bearing, 9..20 m out, a little above head height
    const a = Math.random() * Math.PI * 2, d = 9 + Math.random() * 11;
    const c = camera.position;
    const placed = at ? null : this.placer?.(this.zone, camera);
    const p0 = at ? at.clone() : placed ? placed.clone() : c.clone().set(c.x + Math.cos(a) * d, c.y + 1 + Math.random() * 3, c.z + Math.sin(a) * d);
    const drift = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5);
    const p1 = c.clone().set(c.x + Math.cos(a + drift) * d * 0.9, p0.y + 0.5, c.z + Math.sin(a + drift) * d * 0.9);
    const pan = E.panner(p0.x, p0.y, p0.z, 5); pan.rolloffFactor = 0.6;
    // wind-carried: a wandering low-pass and a slow tremor in level, a long echo off the trunks
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5; lp.frequency.value = 3200;
    const trem = ctx.createGain(); trem.gain.value = 0.8;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.35 + Math.random() * 0.3; const lg = ctx.createGain(); lg.gain.value = 0.22; lfo.connect(lg).connect(trem.gain);
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.21; const lg2 = ctx.createGain(); lg2.gain.value = 1100; lfo2.connect(lg2).connect(lp.frequency);
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.38; const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1400;
    const echo = ctx.createGain(); echo.gain.value = 0.45;
    const voiceIn = ctx.createGain(); voiceIn.gain.value = 1.0;
    voiceIn.connect(lp).connect(trem).connect(pan).connect(E.bus);
    trem.connect(dl); dl.connect(dlp).connect(fb).connect(dl); dlp.connect(echo).connect(pan);

    let dur;
    if (line.audio) {
      try {
        let buf = this.buffers.get(line.audio);
        if (!buf) { const r = await fetch(line.audio); buf = await ctx.decodeAudioData(await r.arrayBuffer()); this.buffers.set(line.audio, buf); }
        const s = ctx.createBufferSource(); s.buffer = buf; s.connect(voiceIn); s.start(t0); dur = buf.duration;
      } catch { dur = null; }
    }
    if (!dur) {
      const ph = line.phonemes || PHONEMES[line.say];
      if (!ph) return;
      dur = synthWord(ctx, voiceIn, ph, { t0, stretch: line.stretch ?? 1, f0: 86 + Math.random() * 22, breath: 0.5 + Math.random() * 0.2, gain: 0.55 });
    }
    const T = dur + 2.5;
    // it moves while it speaks
    pan.positionX.setValueAtTime(p0.x, t0); pan.positionX.linearRampToValueAtTime(p1.x, t0 + T);
    pan.positionY.setValueAtTime(p0.y, t0); pan.positionY.linearRampToValueAtTime(p1.y, t0 + T);
    pan.positionZ.setValueAtTime(p0.z, t0); pan.positionZ.linearRampToValueAtTime(p1.z, t0 + T);
    // the gust that carries it
    const gs = ctx.createBufferSource(); gs.buffer = E.noiseBuf; gs.loop = true;
    const gbp = ctx.createBiquadFilter(); gbp.type = 'bandpass'; gbp.frequency.setValueAtTime(300, t0 - 0.3); gbp.frequency.linearRampToValueAtTime(700, t0 + dur * 0.5); gbp.frequency.linearRampToValueAtTime(250, t0 + T); gbp.Q.value = 0.6;
    const gg = ctx.createGain(); gg.gain.setValueAtTime(0, t0 - 0.4); gg.gain.linearRampToValueAtTime(0.16, t0 + dur * 0.45); gg.gain.linearRampToValueAtTime(0, t0 + T);
    gs.connect(gbp).connect(gg).connect(pan);
    [gs, lfo, lfo2].forEach((n) => { n.start(t0 - 0.4); n.stop(t0 + T + 3); });
    setTimeout(() => { try { [voiceIn, lp, trem, dl, fb, dlp, echo, pan].forEach((n) => n.disconnect()); } catch { /* already gone */ } }, (T + 4) * 1000);
    this.speaking = (this._lastTime ?? 0) + T;
    this._showText(line.text || line.say, dur);
    this.onSpeak?.(line, p0);
    return dur;
  }

  _showText(text, dur) {
    const el = this.textEl; if (!el || !this.showText) return;
    el.textContent = text;
    el.style.left = (18 + Math.random() * 50) + '%'; el.style.top = (22 + Math.random() * 45) + '%';
    el.classList.remove('on'); void el.offsetWidth; el.style.animationDuration = (dur + 3) + 's'; el.classList.add('on');
  }
}
