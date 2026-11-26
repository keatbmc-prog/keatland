// Touch controls for phones and tablets (used instead of pointer lock when the device is touch-first).
//  - left side: a floating analog joystick. It appears where the thumb lands; speed follows how far you
//    push; pushing past the ring's edge runs.
//  - right side: drag to look (yaw/pitch, pitch is clamped by the player so it never flips). A quick
//    tap there is a "tap" (used for the gallery photos).
//  - the interact ring (bottom right): the touch version of E. It is invisible until something can be
//    used, then it brightens and shows the action word. It is hit-tested on touchstart with a generous
//    radius and fires once on touchend (no synthetic click, no double fire), and a touch that starts on
//    it never moves the joystick or the camera.
// Everything is thin monochrome rings: no icons, no panels. One overlay owns every touch (multi-touch by
// identifier), with touch-action none + preventDefault so the page never scrolls, zooms or refreshes.
const R = 58;           // joystick radius (px)
const LOOK = 2.6;       // look sensitivity (px -> player look units; the player turns 0.0022 rad per unit)
const TAP_MS = 280, TAP_PX = 12;

export class TouchControls {
  constructor({ player, onInteract, onTap }) {
    this.player = player; this.onInteract = onInteract; this.onTap = onTap;
    this.move = null; this.look = null; this.press = null; this.enabled = false;
    this.label = ''; this.labelT = 0; this.lastFire = 0;
    const el = this.el = document.createElement('div'); el.id = 'touch-ui';
    el.innerHTML = '<div class="tj-base"><div class="tj-knob"></div></div><div class="t-act"><span></span></div>';
    document.body.appendChild(el);
    this.base = el.querySelector('.tj-base'); this.knob = el.querySelector('.tj-knob');
    this.act = el.querySelector('.t-act'); this.actText = el.querySelector('.t-act span');
    const opt = { passive: false };
    el.addEventListener('touchstart', (e) => this.start(e), opt);
    el.addEventListener('touchmove', (e) => this.moveEv(e), opt);
    el.addEventListener('touchend', (e) => this.end(e), opt);
    el.addEventListener('touchcancel', (e) => this.end(e, true), opt);
    // no context menus / magnifier / iOS pinch gestures on long press
    for (const ev of ['contextmenu', 'gesturestart', 'gesturechange', 'gestureend']) el.addEventListener(ev, (e) => { if (e.cancelable) e.preventDefault(); });
    this.layout();
  }

  layout() { this.reset(); }

  /** drop every touch (orientation change, resize, pause, transitions) */
  reset() {
    this.move = null; this.look = null; this.press = null;
    this.player.touch.mv.set(0, 0); this.player.touch.run = false;
    this.base.classList.remove('on'); this.act.classList.remove('down');
  }

  actCenter() { const r = this.act.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, r: r.width / 2 }; }
  onAct(t) { const c = this.actCenter(); return Math.hypot(t.clientX - c.x, t.clientY - c.y) < c.r + 22; }

  start(e) {
    if (e.cancelable) e.preventDefault();
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      if (!this.press && this.label && this.onAct(t)) { this.press = { id: t.identifier }; this.act.classList.add('down'); continue; }
      if (!this.move && t.clientX < innerWidth * 0.45) {
        this.move = { id: t.identifier, x: t.clientX, y: t.clientY };
        this.base.style.transform = `translate(${t.clientX - R}px, ${t.clientY - R}px)`; this.knob.style.transform = 'translate(0px, 0px)';
        this.base.classList.add('on'); continue;
      }
      if (!this.look) { this.look = { id: t.identifier, x: t.clientX, y: t.clientY, x0: t.clientX, y0: t.clientY, t0: performance.now(), moved: 0 }; continue; }
      // a third finger: ignored
    }
  }

  moveEv(e) {
    if (e.cancelable) e.preventDefault();
    if (!this.enabled) return;
    for (const t of e.changedTouches) {
      if (this.move?.id === t.identifier) {
        const dx = t.clientX - this.move.x, dy = t.clientY - this.move.y, d = Math.hypot(dx, dy);
        const k = d > R ? R / d : 1;
        this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        const dead = 6, m = d < dead ? 0 : Math.min(1, (d - dead) / (R - dead));
        this.player.touch.mv.set(d ? (dx / d) * m : 0, d ? (dy / d) * m : 0);
        this.player.touch.run = d > R * 1.05;
        this.base.classList.toggle('run', this.player.touch.run);
      } else if (this.look?.id === t.identifier) {
        const dx = t.clientX - this.look.x, dy = t.clientY - this.look.y;
        this.player.lookSmooth.x += dx * LOOK; this.player.lookSmooth.y += dy * LOOK;
        this.look.x = t.clientX; this.look.y = t.clientY;
        this.look.moved = Math.max(this.look.moved, Math.hypot(t.clientX - this.look.x0, t.clientY - this.look.y0));
      }
    }
  }

  end(e, cancel = false) {
    if (e.cancelable) e.preventDefault();
    for (const t of e.changedTouches) {
      if (this.press?.id === t.identifier) {
        this.press = null; this.act.classList.remove('down');
        // fire if the finger is still (roughly) on the ring
        if (!cancel && this.onAct(t)) this.fire();
      } else if (this.move?.id === t.identifier) {
        this.move = null; this.player.touch.mv.set(0, 0); this.player.touch.run = false; this.base.classList.remove('on', 'run');
      } else if (this.look?.id === t.identifier) {
        const L = this.look; this.look = null;
        if (!cancel && this.enabled && L.moved < TAP_PX && performance.now() - L.t0 < TAP_MS) this.onTap?.(t.clientX, t.clientY);
      }
    }
  }

  fire() {
    const now = performance.now(); if (now - this.lastFire < 250) return; // one action per tap
    this.lastFire = now; this.onInteract?.();
  }

  /** called every frame with the current action word ('' when nothing is usable) */
  setAction(label, dt) {
    if (label) { this.labelT = 0.4; if (label !== this.label) { this.label = label; this.actText.textContent = label; } }
    else if (this.label) { this.labelT -= dt; if (this.labelT <= 0) this.label = ''; } // a short grace so it never flickers at a range edge
    this.act.classList.toggle('on', !!this.label);
  }
}

export const TOUCH_CSS = `
  html, body { touch-action: none; overscroll-behavior: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  #touch-ui { position: fixed; inset: 0; z-index: 3; touch-action: none; }
  #touch-ui .tj-base { position: absolute; left: 0; top: 0; width: ${R * 2}px; height: ${R * 2}px; border-radius: 50%; border: 1px solid rgba(225,220,205,.32); opacity: 0; transition: opacity .25s; pointer-events: none; }
  #touch-ui .tj-base.on { opacity: 1; }
  #touch-ui .tj-base.run { border-color: rgba(225,220,205,.6); }
  #touch-ui .tj-knob { position: absolute; left: ${R - 18}px; top: ${R - 18}px; width: 36px; height: 36px; border-radius: 50%; border: 1px solid rgba(225,220,205,.55); }
  #touch-ui .t-act { position: absolute; right: max(26px, env(safe-area-inset-right)); bottom: max(34px, calc(env(safe-area-inset-bottom) + 18px)); width: 74px; height: 74px; border-radius: 50%; border: 1px solid rgba(225,220,205,.5);
    display: grid; place-items: center; opacity: 0; transform: scale(.92); transition: opacity .2s, transform .2s, background .1s; pointer-events: none; }
  #touch-ui .t-act.on { opacity: .85; transform: scale(1); }
  #touch-ui .t-act.down { background: rgba(225,220,205,.14); transform: scale(.94); }
  #touch-ui .t-act span { font-family: 'Special Elite', monospace; font-size: 11px; letter-spacing: .14em; color: rgba(235,230,215,.85); text-transform: lowercase; text-align: center; padding: 0 6px; }
  body.touch #hint { display: none; }
`;
