// Canvas painters for the story realm: sun-bleached asphalt with cracks and faded stall lines,
// desert sand, stucco, yellowed Backrooms wallpaper, damp carpet, drop-ceiling tiles, cardboard,
// and a generic weathered-sign painter used for every piece of text written into the world.
import * as THREE from 'three';
import { canvasTexture } from '../materials/textures.js';
import { mulberry32 } from '../core/noise.js';

const tex = (w, h, paint, o) => canvasTexture(w, h, paint, o);
export const rngOf = (seed) => mulberry32(seed);

/** speckle / mottling helper */
function mottle(g, w, h, rng, n, colors, rMin, rMax, aMin = 0.03, aMax = 0.1) {
  for (let i = 0; i < n; i++) {
    const c = colors[Math.floor(rng() * colors.length)];
    g.fillStyle = `rgba(${c},${aMin + rng() * (aMax - aMin)})`;
    g.beginPath(); g.ellipse(rng() * w, rng() * h, rMin + rng() * (rMax - rMin), rMin + rng() * (rMax - rMin), rng() * 3, 0, 7); g.fill();
  }
}
function grain(g, w, h, rng, amt = 0.06, n = w * h * 0.08) {
  for (let i = 0; i < n; i++) { const v = rng() < 0.5 ? 0 : 255; g.fillStyle = `rgba(${v},${v},${v},${rng() * amt})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 1.5, 1 + rng() * 1.5); }
}
function crack(g, x, y, len, rng, width = 1.6, col = 'rgba(20,16,12,0.75)') {
  g.strokeStyle = col; g.lineCap = 'round';
  let a = rng() * Math.PI * 2;
  for (let i = 0; i < len; i++) {
    const nx = x + Math.cos(a) * (4 + rng() * 6), ny = y + Math.sin(a) * (4 + rng() * 6);
    g.lineWidth = width * (1 - i / len) + 0.4; g.beginPath(); g.moveTo(x, y); g.lineTo(nx, ny); g.stroke();
    x = nx; y = ny; a += (rng() - 0.5) * 0.9;
    if (rng() < 0.06) crack(g, x, y, Math.floor(len * 0.4), rng, width * 0.6, col);
  }
}

/**
 * The parking lot: one big non-repeating texture covering `sizeX` x `sizeZ` metres (x right, z down),
 * with stall lines (faded), the valet lane, oil stains, patches and a web of cracks with weeds.
 * `stalls(g, m)` gets a metre->pixel function for painting lines in lot coordinates.
 */
export function asphaltTexture({ size = 2048, metres = 96, seed = 11, paintLines }) {
  return tex(size, size, (g, w, h) => {
    const rng = rngOf(seed), m = w / metres;
    g.fillStyle = '#8d8579'; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rng, 2200, ['70,64,58', '150,140,124', '110,102,92', '60,55,50'], 4, 40, 0.03, 0.09);
    // big sun-bleached patches and darker repaired squares
    for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '60,56,52' : '170,160,140'},${0.08 + rng() * 0.14})`; const pw = 40 + rng() * 260, ph = 40 + rng() * 200; g.fillRect(rng() * w, rng() * h, pw, ph); }
    grain(g, w, h, rng, 0.1);
    // lines (faded paint, flaking)
    g.save(); paintLines?.(g, m, rng); g.restore();
    // flake the paint: knock holes through lines with asphalt colour
    for (let i = 0; i < 26000; i++) { g.fillStyle = `rgba(${120 + rng() * 30},${112 + rng() * 26},${100 + rng() * 22},${0.25 + rng() * 0.6})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 2); }
    // oil stains
    for (let i = 0; i < 40; i++) { const x = rng() * w, y = rng() * h, r = 8 + rng() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(25,22,20,0.35)'); gr.addColorStop(1, 'rgba(25,22,20,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, r, r * (0.5 + rng() * 0.5), rng() * 3, 0, 7); g.fill(); }
    // cracks: a few long ones and lots of alligator cracking
    for (let i = 0; i < 55; i++) crack(g, rng() * w, rng() * h, 20 + Math.floor(rng() * 70), rng, 1.0 + rng() * 1.2, 'rgba(40,34,28,0.5)');
    for (let i = 0; i < 40; i++) { const cx = rng() * w, cy = rng() * h; for (let k = 0; k < 10; k++) crack(g, cx + (rng() - 0.5) * 80, cy + (rng() - 0.5) * 80, 6 + Math.floor(rng() * 8), rng, 0.8, 'rgba(40,34,28,0.45)'); }
    // weeds in the cracks
    for (let i = 0; i < 500; i++) { const x = rng() * w, y = rng() * h; g.strokeStyle = `rgba(${110 + rng() * 40},${100 + rng() * 30},${50 + rng() * 20},0.55)`; g.lineWidth = 1; for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 8, y - rng() * 8); g.stroke(); } }
  }, { wrap: false });
}

export function sandTexture(seed = 3) {
  return tex(1024, 1024, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = '#c4a57c'; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rng, 1800, ['150,120,86', '214,190,150', '170,140,100', '120,100,76'], 6, 60, 0.04, 0.12);
    grain(g, w, h, rng, 0.14, w * h * 0.15);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${90 + rng() * 40},${80 + rng() * 30},${60 + rng() * 20},0.5)`; g.beginPath(); g.ellipse(rng() * w, rng() * h, 1 + rng() * 4, 1 + rng() * 3, rng() * 3, 0, 7); g.fill(); }
  }, { repeat: [1, 1] });
}

export function stuccoTexture(seed = 5, base = '#d9c8a8') {
  return tex(1024, 1024, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rng, 1500, ['180,160,130', '235,225,205', '160,140,110'], 4, 50, 0.04, 0.1);
    grain(g, w, h, rng, 0.12, w * h * 0.2);
    // rust / water streaks from the top
    for (let i = 0; i < 30; i++) { const x = rng() * w, len = 100 + rng() * 500; const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(${120 + rng() * 40},${70 + rng() * 20},40,${0.18 + rng() * 0.2})`); gr.addColorStop(1, 'rgba(120,70,40,0)'); g.fillStyle = gr; g.fillRect(x, 0, 2 + rng() * 8, len); }
  });
}

/** Backrooms: mono-yellow wallpaper with a faint chevron, water damage and scuffs near the floor. */
export function wallpaperTexture(seed = 7) {
  return tex(512, 1024, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = '#c9b86c'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(150,130,60,0.22)'; g.lineWidth = 3;
    for (let y = -20; y < h + 40; y += 34) for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16, y + 12); g.lineTo(x + 32, y); g.stroke(); }
    for (let x = 0; x < w; x += 64) { g.fillStyle = 'rgba(120,100,40,0.08)'; g.fillRect(x, 0, 2, h); }
    mottle(g, w, h, rng, 400, ['150,130,60', '210,200,130', '120,100,50'], 8, 60, 0.03, 0.08);
    // tide-line water stains along the bottom, a few drips from the top
    const gr = g.createLinearGradient(0, h, 0, h * 0.78); gr.addColorStop(0, 'rgba(90,70,30,0.45)'); gr.addColorStop(1, 'rgba(90,70,30,0)'); g.fillStyle = gr; g.fillRect(0, h * 0.78, w, h * 0.22);
    for (let i = 0; i < 5; i++) { const x = rng() * w, l = 60 + rng() * 300; const d = g.createLinearGradient(0, 0, 0, l); d.addColorStop(0, 'rgba(110,85,35,0.3)'); d.addColorStop(1, 'rgba(110,85,35,0)'); g.fillStyle = d; g.fillRect(x, 0, 3 + rng() * 10, l); }
    grain(g, w, h, rng, 0.06, w * h * 0.06);
  });
}
export function carpetTexture(seed = 8) {
  return tex(1024, 1024, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = '#8f7d4a'; g.fillRect(0, 0, w, h);
    grain(g, w, h, rng, 0.22, w * h * 0.5);
    mottle(g, w, h, rng, 120, ['70,58,30', '60,50,26'], 30, 140, 0.08, 0.2); // damp patches
    mottle(g, w, h, rng, 600, ['170,150,95', '110,95,55'], 3, 20, 0.05, 0.12);
  });
}
export function carpetRoughness(seed = 9) {
  return tex(512, 512, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, w, h);
    mottle(g, w, h, rng, 60, ['90,90,90', '120,120,120'], 20, 80, 0.3, 0.6); // wet = shinier
  }, { srgb: false });
}
/** 0.6 m drop-ceiling tiles: 1 texture tile = 1 ceiling tile, with occasional stains. */
export function ceilingTexture(seed = 10) {
  return tex(256, 256, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = '#d8cfae'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(80,70,50,${rng() * 0.25})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 2, 1 + rng() * 2); }
    g.fillStyle = '#9a917a'; g.fillRect(0, 0, w, 6); g.fillRect(0, 0, 6, h);
    const gr = g.createRadialGradient(w * 0.6, h * 0.55, 0, w * 0.6, h * 0.55, w * 0.4); gr.addColorStop(0, 'rgba(140,110,50,0.25)'); gr.addColorStop(1, 'rgba(140,110,50,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}
/** Reception floor: cream vinyl tiles, dusty, sun-faded. */
export function vinylTexture(seed = 12) {
  return tex(1024, 1024, (g, w, h) => {
    const rng = rngOf(seed), n = 4, s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = 200 + rng() * 26; g.fillStyle = `rgb(${v},${v - 10},${v - 30})`; g.fillRect(i * s, j * s, s, s); }
    mottle(g, w, h, rng, 700, ['150,130,100', '230,220,200', '170,150,120'], 4, 30, 0.04, 0.1);
    g.strokeStyle = 'rgba(90,80,60,0.6)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
    for (let i = 0; i < 40; i++) crack(g, rng() * w, rng() * h, 6 + Math.floor(rng() * 12), rng, 0.8, 'rgba(80,70,55,0.35)');
    grain(g, w, h, rng, 0.08);
  });
}
export function cardboardTexture(seed = 13) {
  return tex(512, 512, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = '#b08a5a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 7) { g.fillStyle = `rgba(120,90,50,${0.05 + rng() * 0.05})`; g.fillRect(x, 0, 3, h); }
    mottle(g, w, h, rng, 120, ['90,65,35', '200,170,120'], 6, 50, 0.05, 0.14);
    g.fillStyle = 'rgba(200,190,170,0.6)'; g.fillRect(0, h * 0.47, w, 26); // packing tape
    grain(g, w, h, rng, 0.08);
  });
}
export function woodTexture(seed = 14, base = '#7a5634') {
  return tex(512, 512, (g, w, h) => {
    const rng = rngOf(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(${rng() < 0.5 ? '40,25,10' : '160,120,80'},${0.04 + rng() * 0.08})`; g.fillRect(0, y + Math.sin(y * 0.05) * 3, w, 1 + rng() * 2); }
    grain(g, w, h, rng, 0.06);
  });
}

/**
 * A sign, painted and then weathered by sun. lines: string[]; sizes: per-line font size multipliers.
 * `strike` text wrapped in ~~…~~ is drawn struck through (the dorodango placard).
 */
export function signTexture(lines, {
  w = 1024, h = 512, bg = '#efe3c4', fg = '#a3261c', font = 'Rye', weight = '', sizes = null, border = 0, borderColor = null,
  align = 'center', pad = 0.08, weather = 0.6, seed = 1, lineGap = 1.12, shadow = false, transparent = false, rotate = 0, fit = true, valign = 'middle',
} = {}) {
  return tex(w, h, (g) => {
    const rng = rngOf(seed);
    if (!transparent) {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      if (weather > 0) mottle(g, w, h, rng, Math.round(300 * weather), ['255,250,235', '160,140,110', '120,100,80'], 4, 60, 0.03, 0.1 * weather);
    }
    if (border) { g.strokeStyle = borderColor || fg; g.lineWidth = border; g.strokeRect(border, border, w - border * 2, h - border * 2); }
    g.save(); g.translate(w / 2, h / 2); g.rotate(rotate); g.translate(-w / 2, -h / 2);
    const L = Array.isArray(lines) ? lines : [lines];
    const S = sizes || L.map(() => 1);
    const innerW = w * (1 - pad * 2), innerH = h * (1 - pad * 2);
    // base size so the stack fits vertically, then shrink lines that overflow horizontally
    let base = innerH / (S.reduce((a, b) => a + b, 0) * lineGap);
    const px = (i) => base * S[i];
    const fontOf = (i) => `${weight ? weight + ' ' : ''}${Math.round(px(i))}px "${font}"`;
    const total = S.reduce((a, b) => a + b * base * lineGap, 0);
    let y = valign === 'top' ? h * pad : h / 2 - total / 2;
    g.textBaseline = 'middle'; g.fillStyle = fg;
    L.forEach((t, i) => {
      g.font = fontOf(i);
      const raw = t.replace(/~~/g, '');
      let mw = g.measureText(raw).width, scale = fit && mw > innerW ? innerW / mw : 1;
      const lh = px(i) * lineGap;
      const cy = y + lh / 2;
      g.save();
      const x = align === 'left' ? w * pad : align === 'right' ? w * (1 - pad) : w / 2;
      g.translate(x, cy); g.scale(scale, 1);
      g.textAlign = align;
      if (shadow) { g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = px(i) * 0.08; g.shadowOffsetY = px(i) * 0.04; }
      // struck-through segments
      const parts = t.split('~~');
      if (parts.length > 1) {
        g.textAlign = 'left';
        let cx = align === 'center' ? -mw / 2 : align === 'right' ? -mw : 0;
        parts.forEach((p, k) => { g.fillText(p, cx, 0); const pw = g.measureText(p).width; if (k % 2 === 1) { g.fillRect(cx - 4, -px(i) * 0.06, pw + 8, Math.max(3, px(i) * 0.09)); } cx += pw; });
      } else g.fillText(t, 0, 0);
      g.restore();
      y += lh;
    });
    g.restore();
    if (weather > 0) {
      // sun-bleach: lighten, then flake and scratch
      g.fillStyle = `rgba(255,248,230,${0.12 * weather})`; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = transparent ? 'destination-out' : 'source-over';
      for (let i = 0; i < w * h * 0.004 * weather; i++) { g.fillStyle = transparent ? `rgba(0,0,0,${rng() * 0.8})` : `rgba(${200 + rng() * 50},${190 + rng() * 50},${170 + rng() * 50},${rng() * 0.7})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 5, 1 + rng() * 2); }
      g.globalCompositeOperation = 'source-over';
      if (!transparent) for (let i = 0; i < 10 * weather; i++) { const x = rng() * w, l = 40 + rng() * h * 0.6; const gr = g.createLinearGradient(0, 0, 0, l); gr.addColorStop(0, `rgba(130,70,30,${0.15 + rng() * 0.2})`); gr.addColorStop(1, 'rgba(130,70,30,0)'); g.fillStyle = gr; g.fillRect(x, 0, 2 + rng() * 5, l); }
    }
  }, { wrap: false });
}

/** A mesh plane carrying a sign texture (metres). */
export function signPlane(texture, wM, hM, { emissive = 0, side = THREE.FrontSide, transparent = false, roughness = 0.8, metalness = 0, alphaTest = 0 } = {}) {
  const m = new THREE.MeshStandardMaterial({ map: texture, roughness, metalness, side, transparent, alphaTest, emissive: emissive ? 0xffffff : 0x000000, emissiveMap: emissive ? texture : null, emissiveIntensity: emissive });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(wM, hM), m);
  return mesh;
}

/** The Freedomland poster: a painted, too-cheerful landscape with a smiling sun and castles. */
export function freedomlandPoster(seed = 21) {
  return tex(1024, 1280, (g, w, h) => {
    const rng = rngOf(seed);
    const sky = g.createLinearGradient(0, 0, 0, h * 0.6); sky.addColorStop(0, '#f3dfa4'); sky.addColorStop(1, '#e9c47a'); g.fillStyle = sky; g.fillRect(0, 0, w, h);
    // sun with a face
    const sx = w * 0.3, sy = h * 0.33, sr = 70;
    g.fillStyle = '#f2b13a'; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.beginPath(); g.moveTo(sx + Math.cos(a) * sr, sy + Math.sin(a) * sr); g.lineTo(sx + Math.cos(a + 0.12) * sr * 1.7, sy + Math.sin(a + 0.12) * sr * 1.7); g.lineTo(sx + Math.cos(a + 0.26) * sr, sy + Math.sin(a + 0.26) * sr); g.fill(); }
    g.beginPath(); g.arc(sx, sy, sr, 0, 7); g.fill();
    g.strokeStyle = '#8a4a14'; g.lineWidth = 5; g.beginPath(); g.arc(sx, sy + 8, 34, 0.2, Math.PI - 0.2); g.stroke();
    g.fillStyle = '#8a4a14'; g.beginPath(); g.arc(sx - 22, sy - 14, 6, 0, 7); g.arc(sx + 22, sy - 14, 6, 0, 7); g.fill();
    // hills
    const hill = (y0, amp, col, ph) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 8) g.lineTo(x, y0 + Math.sin(x * 0.006 + ph) * amp + Math.sin(x * 0.017 + ph * 2) * amp * 0.3); g.lineTo(w, h); g.fill(); };
    hill(h * 0.5, 60, '#9db06a', 1); hill(h * 0.58, 50, '#7c9a52', 3); hill(h * 0.68, 40, '#5f7f3e', 5); hill(h * 0.8, 30, '#4d6a32', 7);
    // castles
    const castle = (cx, cy, s) => { g.fillStyle = '#e8dcc0'; g.fillRect(cx - 40 * s, cy - 60 * s, 80 * s, 60 * s); for (const dx of [-40, -14, 14, 40]) { g.fillRect(cx + dx * s - 9 * s, cy - 100 * s, 18 * s, 100 * s); g.fillStyle = '#7a8fb0'; g.beginPath(); g.moveTo(cx + dx * s - 12 * s, cy - 100 * s); g.lineTo(cx + dx * s, cy - 140 * s); g.lineTo(cx + dx * s + 12 * s, cy - 100 * s); g.fill(); g.fillStyle = '#e8dcc0'; } };
    castle(w * 0.62, h * 0.5, 1.2); castle(w * 0.83, h * 0.55, 0.8);
    // trees
    for (let i = 0; i < 60; i++) { const x = rng() * w, y = h * (0.6 + rng() * 0.25), s = 10 + rng() * 16; g.fillStyle = `rgb(${40 + rng() * 20},${80 + rng() * 30},${40 + rng() * 15})`; g.beginPath(); g.moveTo(x, y - s * 2.4); g.lineTo(x - s, y); g.lineTo(x + s, y); g.fill(); }
    // title + cartouche
    g.fillStyle = '#a3261c'; g.font = '150px "Rye"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(w / 2, h * 0.11); const tw = g.measureText('FREEDOMLAND').width; g.scale(Math.min(1, w * 0.92 / tw), 1); g.fillText('FREEDOMLAND', 0, 0); g.restore();
    g.fillStyle = '#efe3c4'; g.beginPath(); g.ellipse(w / 2, h * 0.86, w * 0.3, h * 0.08, 0, 0, 7); g.fill();
    g.fillStyle = '#3a2a18'; g.font = '600 44px "Oswald"'; ['LET GO.', 'MOVE FORWARD.', 'BE FREE.'].forEach((t, i) => g.fillText(t, w / 2, h * 0.82 + i * 46));
    // age
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '255,250,230' : '90,60,30'},${rng() * 0.12})`; g.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3); }
    g.strokeStyle = 'rgba(80,50,20,0.25)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.5, 0); g.lineTo(w * 0.5, h); g.moveTo(0, h * 0.5); g.lineTo(w, h * 0.5); g.stroke(); // fold lines
  }, { wrap: false });
}

/** Cracked, painted text that scrolls: the announcement board's dynamic canvas. */
export function tickerCanvas(w = 1024, h = 96) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return { canvas: c, ctx: c.getContext('2d'), texture: t };
}
