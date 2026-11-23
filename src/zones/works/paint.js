// Canvas painters for the Catecholamine Works: poured factory concrete with joints, stains and
// safety paint; riveted steel plate; painted block; catwalk grating; diamond tread; and the
// screens (monitors, clock, gauge face). Every word in the factory is painted into a texture.
import * as THREE from 'three';
import { canvasTexture } from '../../materials/textures.js';
import { mulberry32 } from '../../core/noise.js';

const R = (s) => mulberry32(s);
function mottle(g, w, h, rng, n, cols, r0, r1, a0, a1) {
  for (let i = 0; i < n; i++) { const c = cols[Math.floor(rng() * cols.length)]; g.fillStyle = `rgba(${c},${a0 + rng() * (a1 - a0)})`; g.beginPath(); g.ellipse(rng() * w, rng() * h, r0 + rng() * (r1 - r0), r0 + rng() * (r1 - r0), rng() * 3, 0, 7); g.fill(); }
}
function grain(g, w, h, rng, amt, n) { for (let i = 0; i < n; i++) { const v = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${rng() * amt})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2); } }
function drips(g, w, h, rng, n, col = '110,60,25', top = 0) {
  for (let i = 0; i < n; i++) { const x = rng() * w, y = top + rng() * h * 0.3, l = 30 + rng() * h * 0.5; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, `rgba(${col},${0.1 + rng() * 0.25})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x, y, 1.5 + rng() * 4, l); }
}

/** the whole hall floor, one non-repeating texture: x -> u (0..W m), z -> v (0..D m) */
export function factoryFloor(Wm, Dm, drain, { px = 24 } = {}) {
  const w = Math.round(Wm * px), h = Math.round(Dm * px);
  return canvasTexture(w, h, (g) => {
    const rng = R(41), m = (x) => x * px, X = (x) => (x + Wm / 2) * px, Z = (z) => (z + Dm / 2) * px;
    g.fillStyle = '#7b7368'; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rng, 2600, ['60,56,50', '140,132,120', '100,94,84', '84,70,56'], 6, 70, 0.03, 0.1);
    // trowel swirls
    g.lineWidth = 1;
    for (let i = 0; i < 900; i++) { const x = rng() * w, y = rng() * h, r = 10 + rng() * 40; g.strokeStyle = `rgba(${rng() < 0.5 ? '40,36,32' : '170,160,146'},0.05)`; g.beginPath(); g.arc(x, y, r, rng() * 6, rng() * 6 + 1.8); g.stroke(); }
    grain(g, w, h, rng, 0.08, w * h * 0.05);
    // pour joints every 6 m
    g.strokeStyle = 'rgba(30,26,22,0.6)'; g.lineWidth = 2;
    for (let x = -Wm / 2 + 2; x < Wm / 2; x += 6) { g.beginPath(); g.moveTo(X(x), 0); g.lineTo(X(x), h); g.stroke(); }
    for (let z = -Dm / 2 + 2; z < Dm / 2; z += 6) { g.beginPath(); g.moveTo(0, Z(z)); g.lineTo(w, Z(z)); g.stroke(); }
    // oil and chemical stains (amber, a little red)
    for (let i = 0; i < 90; i++) { const x = rng() * w, y = rng() * h, r = m(0.3 + rng() * 2.2); const c = rng() < 0.6 ? '28,24,20' : rng() < 0.6 ? '120,70,20' : '110,30,20'; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${c},0.35)`); gr.addColorStop(0.7, `rgba(${c},0.18)`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.4 + rng() * 0.6), rng() * 3, 0, 7); g.fill(); }
    // safety walkways (yellow, worn)
    const lane = (x0, z0, x1, z1) => { g.strokeStyle = 'rgba(214,170,40,0.75)'; g.lineWidth = m(0.12); g.beginPath(); g.moveTo(X(x0), Z(z0)); g.lineTo(X(x1), Z(z1)); g.stroke(); };
    lane(-14, -40, -14, 18); lane(14, -40, 14, 18); lane(-14, 18, 14, 18); lane(-14, -40, 14, -40); lane(-11, -37, 11, -37);
    // hazard ring around the drain plates
    const cx = X(drain.x), cz = Z(drain.z);
    for (let a = 0; a < 64; a++) { g.fillStyle = a % 2 ? 'rgba(20,18,14,0.85)' : 'rgba(220,170,30,0.85)'; g.beginPath(); g.arc(cx, cz, m(8.0), a / 64 * Math.PI * 2, (a + 1) / 64 * Math.PI * 2); g.arc(cx, cz, m(7.3), (a + 1) / 64 * Math.PI * 2, a / 64 * Math.PI * 2, true); g.fill(); }
    // stencils
    g.save(); g.fillStyle = 'rgba(230,226,210,0.55)'; g.font = `700 ${m(0.9)}px "Oswald"`; g.textAlign = 'center';
    g.translate(cx, cz + m(9.4)); g.fillText('KEEP CLEAR OF DRAIN', 0, 0); g.restore();
    g.save(); g.fillStyle = 'rgba(230,226,210,0.5)'; g.font = `700 ${m(0.8)}px "Oswald"`; g.translate(X(-26), Z(0)); g.rotate(Math.PI / 2); g.textAlign = 'center'; g.fillText('TYROSINE INTAKE  ▶', 0, 0); g.restore();
    g.save(); g.fillStyle = 'rgba(220,60,40,0.55)'; g.font = `700 ${m(0.7)}px "Oswald"`; g.translate(X(17.5), Z(17.2)); g.textAlign = 'center'; g.fillText('EMERGENCY ONLY', 0, 0); g.restore();
    // flake the paint
    for (let i = 0; i < w * h * 0.01; i++) { g.fillStyle = `rgba(${110 + rng() * 30},${104 + rng() * 26},${94 + rng() * 20},${0.3 + rng() * 0.5})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 2); }
  }, { wrap: false });
}

/** riveted steel plate, rust and grime (tiles every `metres`) */
export function steelPlate(seed = 3, base = '#5d6064', { rust = 0.6, panel = 4 } = {}) {
  return canvasTexture(512, 512, (g, w, h) => {
    const rng = R(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rng, 500, ['40,40,40', '120,120,118', '90,60,40'], 5, 60, 0.03, 0.12);
    const s = w / panel * 2;
    g.strokeStyle = 'rgba(15,15,15,0.7)'; g.lineWidth = 3;
    for (let x = 0; x <= w; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += s / 2) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    for (let x = 0; x <= w; x += s) for (let y = 0; y <= h; y += 16) { [-7, 7].forEach((o) => { g.fillStyle = 'rgba(20,20,20,0.6)'; g.beginPath(); g.arc(x + o, y + 8, 2.6, 0, 7); g.fill(); g.fillStyle = 'rgba(200,200,196,0.35)'; g.beginPath(); g.arc(x + o - 0.8, y + 7.2, 1.2, 0, 7); g.fill(); }); }
    drips(g, w, h, rng, Math.round(60 * rust));
    mottle(g, w, h, rng, Math.round(160 * rust), ['120,62,24', '150,80,30', '80,40,18'], 3, 22, 0.08, 0.3);
    grain(g, w, h, rng, 0.1, 20000);
  }, { repeat: [1, 1] });
}

/** painted concrete block, two-tone with a dado stripe and grime at the base */
export function blockWall(seed = 5) {
  return canvasTexture(512, 512, (g, w, h) => {
    const rng = R(seed);
    g.fillStyle = '#6f7766'; g.fillRect(0, 0, w, h * 0.45); g.fillStyle = '#8a8a7c'; g.fillRect(0, h * 0.45, w, h * 0.55);
    g.fillStyle = '#a3721e'; g.fillRect(0, h * 0.43, w, h * 0.035);
    g.strokeStyle = 'rgba(30,30,26,0.35)'; g.lineWidth = 2;
    for (let r = 0, y = 0; y < h; r++, y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); for (let x = (r % 2) * 64; x < w; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 32); g.stroke(); } }
    mottle(g, w, h, rng, 400, ['40,40,36', '160,160,150', '90,70,50'], 5, 50, 0.03, 0.1);
    const gr = g.createLinearGradient(0, h * 0.7, 0, h); gr.addColorStop(0, 'rgba(30,24,18,0)'); gr.addColorStop(1, 'rgba(30,24,18,0.55)'); g.fillStyle = gr; g.fillRect(0, h * 0.7, w, h * 0.3);
    drips(g, w, h, rng, 30, '60,50,40');
    grain(g, w, h, rng, 0.08, 16000);
  });
}

/** corrugated cladding (upper walls) */
export function corrugated(seed = 6, base = '#4f5458') {
  return canvasTexture(512, 512, (g, w, h) => {
    const rng = R(seed);
    for (let x = 0; x < w; x++) { const v = 0.75 + 0.25 * Math.sin(x / w * Math.PI * 2 * 16); g.fillStyle = `rgba(${Math.round(79 * v)},${Math.round(84 * v)},${Math.round(88 * v)},1)`; g.fillRect(x, 0, 1, h); }
    void base;
    drips(g, w, h, rng, 50, '120,64,26');
    mottle(g, w, h, rng, 200, ['30,30,30', '130,90,50'], 4, 40, 0.05, 0.16);
    grain(g, w, h, rng, 0.08, 12000);
  });
}

/** catwalk grating (alpha) */
export function grating() {
  const t = canvasTexture(256, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#4b4b48';
    for (let x = 0; x < w; x += 32) g.fillRect(x, 0, 7, h);
    for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 4);
  });
  return t;
}

/** diamond tread plate */
export function treadPlate(seed = 8) {
  return canvasTexture(256, 256, (g, w, h) => {
    const rng = R(seed);
    g.fillStyle = '#6c6e70'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 8; x < w; x += 16) { g.save(); g.translate(x, y); g.rotate(((x + y) / 16 % 2) ? 0.8 : -0.8); g.fillStyle = 'rgba(200,200,200,0.35)'; g.fillRect(-5, -1.2, 10, 2.4); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-5, 1.2, 10, 1.2); g.restore(); }
    mottle(g, w, h, rng, 120, ['30,30,30', '120,70,30'], 3, 30, 0.05, 0.2);
  });
}

/** a dynamic screen: draw(ctx, w, h) can be called again; returns {texture, draw} */
export function screen(w = 512, h = 384) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace;
  const draw = (fn) => { fn(g, w, h); texture.needsUpdate = true; };
  return { texture, draw, canvas: c };
}

/** CRT look: green-amber phosphor text with scanlines */
export function crt(g, w, h, lines, { color = '#ffb347', bg = '#120a04', size = 56, align = 'left', blink = false } = {}) {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const gr = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); gr.addColorStop(0, 'rgba(255,170,80,0.10)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.font = `${size}px "VT323"`; g.textBaseline = 'top'; g.fillStyle = color; g.shadowColor = color; g.shadowBlur = 12;
  let y = h * 0.1;
  for (const l of lines) {
    const sz = l.size || size; g.font = `${sz}px "VT323"`;
    const tw = g.measureText(l.t ?? l).width; const sc = Math.min(1, (w * 0.88) / tw);
    g.save(); g.translate(align === 'center' ? w / 2 : w * 0.06, y); g.scale(sc, 1); g.textAlign = align === 'center' ? 'center' : 'left'; g.fillStyle = l.color || color; g.fillText(l.t ?? l, 0, 0); g.restore();
    y += sz * 1.08;
  }
  if (blink) { g.fillRect(w * 0.06, y, size * 0.5, size * 0.8); }
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y2 = 0; y2 < h; y2 += 4) g.fillRect(0, y2, w, 2);
}

/** the NORMAL / ALERT / FUCK / (red) gauge face */
export function gaugeFace() {
  return canvasTexture(512, 512, (g, w, h) => {
    const cx = w / 2, cy = h / 2, r = w * 0.46;
    g.fillStyle = '#e9e2cf'; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill();
    const band = (a0, a1, col) => { g.strokeStyle = col; g.lineWidth = 34; g.beginPath(); g.arc(cx, cy, r * 0.78, a0, a1); g.stroke(); };
    // sweep from 135deg to 405deg (clockwise, canvas y down)
    const A = (f) => Math.PI * 0.75 + f * Math.PI * 1.5;
    band(A(0), A(0.3), '#5d8a4a'); band(A(0.3), A(0.55), '#d9a520'); band(A(0.55), A(0.8), '#d0601e'); band(A(0.8), A(1), '#b3150f');
    g.strokeStyle = '#1c1a16'; g.lineWidth = 4; for (let i = 0; i <= 20; i++) { const a = A(i / 20); g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.62, cy + Math.sin(a) * r * 0.62); g.lineTo(cx + Math.cos(a) * r * (i % 5 ? 0.68 : 0.72), cy + Math.sin(a) * r * (i % 5 ? 0.68 : 0.72)); g.stroke(); }
    g.fillStyle = '#1c1a16'; g.font = '700 40px "Oswald"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const lab = (f, t) => { const a = A(f); g.save(); g.translate(cx + Math.cos(a) * r * 0.48, cy + Math.sin(a) * r * 0.48); g.fillText(t, 0, 0); g.restore(); };
    lab(0.15, 'NORMAL'); lab(0.43, 'ALERT'); lab(0.67, 'FUCK');
    g.font = '600 26px "Oswald"'; g.fillText('NOREPINEPHRINE', cx, cy + r * 0.42); g.font = '400 20px "Oswald"'; g.fillText('PSI × 1000', cx, cy + r * 0.56);
    g.strokeStyle = '#2a2620'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke();
  }, { wrap: false });
}

/** hand-lettered text on a transparent ground (Sharpie note, stickers, floating sentences) */
export function handText(lines, { w = 1024, h = 256, color = '#111', font = 'Permanent Marker', size = 80, rot = 0, bg = null } = {}) {
  return canvasTexture(w, h, (g) => {
    g.clearRect(0, 0, w, h); if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.translate(w / 2, h / 2); g.rotate(rot); g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    const L = Array.isArray(lines) ? lines : [lines];
    L.forEach((l, i) => { g.font = `${size}px "${font}"`; const tw = g.measureText(l).width; const sc = Math.min(1, w * 0.92 / tw); g.save(); g.translate(0, (i - (L.length - 1) / 2) * size * 1.1); g.scale(sc, 1); g.fillText(l, 0, 0); g.restore(); });
  }, { wrap: false });
}

/** Living-organ skin for the vats: glossy coral flesh with branching violet veins and pale ribs. */
export function organSkin(seed = 5) {
  return canvasTexture(512, 512, (g, w, h) => {
    const rng = R(seed);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffb0a8'); gr.addColorStop(0.5, '#ff8a92'); gr.addColorStop(1, '#e4607a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) { const r = 6 + rng() * 26; const x = rng() * w, y = rng() * h; const c = g.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, `rgba(255,${200 + rng() * 40 | 0},${190 + rng() * 40 | 0},0.35)`); c.addColorStop(1, 'rgba(255,200,200,0)'); g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2); }
    const vein = (x, y, a, wdt, depth) => {
      if (depth <= 0 || wdt < 0.6) return;
      const L = 20 + rng() * 40; const nx = x + Math.cos(a) * L, ny = y + Math.sin(a) * L;
      g.strokeStyle = `rgba(${110 + rng() * 40 | 0},30,${120 + rng() * 60 | 0},0.55)`; g.lineWidth = wdt; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo((x + nx) / 2 + (rng() - 0.5) * 20, (y + ny) / 2 + (rng() - 0.5) * 20, nx, ny); g.stroke();
      vein(nx, ny, a + (rng() - 0.5) * 0.9, wdt * 0.82, depth - 1);
      if (rng() < 0.45) vein(nx, ny, a + (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 0.6), wdt * 0.6, depth - 2);
    };
    for (let i = 0; i < 9; i++) vein(rng() * w, h + 10, -Math.PI / 2 + (rng() - 0.5) * 0.8, 5 + rng() * 4, 9);
    g.strokeStyle = 'rgba(255,230,220,0.35)'; g.lineWidth = 6; for (let y = 40; y < h; y += 96) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 6); g.stroke(); }
  }, { wrap: true });
}
