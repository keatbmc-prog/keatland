// Yesterkeat, over the ceiling speakers. Each announcement scrolls across the amber LED boards
// under the speakers (one shared canvas, so every board says the same thing at the same time) and
// is played through the PA chain in storyAudio. Between announcements the boards idle with the
// company slogan. Lines and timing live in src/data/storyLines.js.
import { YESTERKEAT, YESTERKEAT_SCHEDULE, NUMBER_WORDS } from '../data/storyLines.js';
import { PA } from './style/toon.js';

const IDLE = 'KEATLAND OPERATIONS DEPT.  ·  WE FUCK THINGS UP  ·  NEAREST EXIT: TOMORROW  ·  ';

export class Yesterkeat {
  constructor({ ticker, audio, speakersWorld }) {
    Object.assign(this, { ticker, audio, speakersWorld });
    this.queue = []; this.current = null; this.scroll = 0; this.redraw = 0; this.next = null; this.said = new Set();
    this.countdownStart = null; this.lastN = null; this.lastText = '';
    this._draw(0);
  }
  reset() { this.queue = []; this.current = null; this.next = null; this.said.clear(); this.countdownStart = null; this.lastN = null; }
  line(id) { return YESTERKEAT.find((l) => l.id === id); }
  /** queue an announcement by id (once: only the first time unless `again`) */
  announce(id, { again = false, text = null } = {}) {
    if (!again && this.said.has(id)) return false;
    const l = this.line(id); if (!l) return false;
    this.said.add(id);
    this.queue.push({ ...l, text: text ?? l.text });
    return true;
  }
  /** the FREEDOMLAND door was rattled: the countdown (in real minutes), then the myth */
  countdown(nowSec) {
    if (this.countdownStart === null) this.countdownStart = nowSec;
    const n = Math.max(0, 7 - Math.floor((nowSec - this.countdownStart) / 60));
    if (this.lastN === n || n === 0) { this.announce('myth', { again: true }); return; }
    this.lastN = n;
    if (n === 1) this.announce('remaining1', { again: true });
    else this.announce('remaining', { again: true, text: this.line('remaining').text.replace('{n}', NUMBER_WORDS[n]) });
  }
  get speaking() { return !!this.current; }

  _draw(dt) {
    const { ctx, canvas, texture } = this.ticker, W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#0d0905'; ctx.fillRect(0, 0, W, H);
    // dot-matrix grid
    ctx.fillStyle = 'rgba(255,140,30,0.06)'; for (let x = 2; x < W; x += 6) for (let y = 2; y < H; y += 6) ctx.fillRect(x, y, 3, 3);
    const txt = this.current ? `YESTERKEAT:  ${this.current.text.toUpperCase()}      ` : IDLE;
    ctx.font = `${Math.round(H * 0.78)}px "VT323"`; ctx.textBaseline = 'middle';
    const w = ctx.measureText(txt).width;
    this.scroll = (this.scroll + dt * (this.current ? 150 : 70)) % (w + (this.current ? W * 0.3 : 0));
    ctx.fillStyle = this.current ? '#ffb347' : '#c9772a'; ctx.shadowColor = '#ff8a1a'; ctx.shadowBlur = this.current ? 14 : 6;
    let x = W - this.scroll; if (!this.current) x = -this.scroll;
    for (let k = 0; k < 3; k++) { ctx.fillText(txt, x + k * w, H * 0.54); if (this.current) break; }
    ctx.shadowBlur = 0;
    texture.needsUpdate = true;
  }

  update(dt, t, { active, nearestSpeakers }) {
    // unprompted announcements while you are in the back
    if (active) {
      if (this.next === null) this.next = t + 6;
      if (t > this.next && !this.current && !this.queue.length) {
        if (!this.said.has('attention')) this.announce('attention');
        else this.announce('ethics', { again: true });
        this.next = t + YESTERKEAT_SCHEDULE[0] + Math.random() * (YESTERKEAT_SCHEDULE[1] - YESTERKEAT_SCHEDULE[0]);
      }
    }
    if (!this.current && this.queue.length) {
      const l = this.queue.shift(); this.current = l; this.scroll = 0; this._t = 0;
      const minShow = 4 + l.text.length * 0.07;
      const started = performance.now();
      this.audio.pa(l, nearestSpeakers()).then(() => {
        const left = minShow * 1000 - (performance.now() - started);
        setTimeout(() => { if (this.current === l) this.current = null; }, Math.max(600, left));
      });
    }
    if (this.current) PA.talk = Math.max(PA.talk, 0.25); // the speaker critters' mouths
    this.redraw += dt;
    if (this.redraw >= 0.05) { this._draw(this.redraw); this.redraw = 0; }
  }
}
