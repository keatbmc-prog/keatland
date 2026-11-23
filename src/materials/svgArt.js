// Procedural SVG artwork. Every function returns an SVG string that is rasterised to a texture
// (see textures.js). These are the "embedded artwork" of Keatland: honeycomb skin, sun-irises,
// ritual sigils, relief panels, pencil livery, serpent silhouettes. Replace any of them with a
// hand-made SVG of the same aspect ratio and the world picks it up unchanged.
import { mulberry32 } from '../core/noise.js';

const svg = (w, h, body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${defs}</defs>${body}</svg>`;

const wobbleFilter = (id, scale = 3, freq = 0.03, seed = 3) =>
  `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="2" seed="${seed}"/><feDisplacementMap in="SourceGraphic" scale="${scale}"/></filter>`;

const chalkFilter = (id) =>
  `<filter id="${id}"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -2.2 1.6" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>`;

/** Tileable honeycomb skin: chalk-teal cell walls, nested inner cells, sparkle stars, pores. */
export function honeycombSVG({ size = 1024, cells = 8, line = '#7fd6c8', seed = 2 } = {}) {
  const rnd = mulberry32(seed);
  const r = size / cells / Math.sqrt(3);
  const w = Math.sqrt(3) * r, hstep = 1.5 * r;
  const rows = Math.round(size / hstep);
  const hex = (cx, cy, rr) => {
    let d = '';
    for (let i = 0; i < 6; i++) { const a = Math.PI / 3 * i + Math.PI / 6; d += (i ? 'L' : 'M') + (cx + rr * Math.cos(a)).toFixed(1) + ',' + (cy + rr * Math.sin(a)).toFixed(1); }
    return d + 'Z';
  };
  let outer = '', inner = '', pores = '', stars = '';
  const sy = size / (rows * hstep);
  for (let row = -1; row <= rows + 1; row++) {
    for (let col = -1; col <= cells + 1; col++) {
      const cx = col * w + (row & 1 ? w / 2 : 0), cy = row * hstep * sy;
      outer += hex(cx, cy, r * 0.97);
      if (rnd() < 0.55) inner += hex(cx, cy, r * (0.45 + rnd() * 0.3));
      if (rnd() < 0.35) pores += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(r * (0.08 + rnd() * 0.12)).toFixed(1)}"/>`;
      if (rnd() < 0.12) { const s = r * 0.18; stars += `<path d="M${cx},${cy - s}L${cx + s * 0.2},${cy - s * 0.2}L${cx + s},${cy}L${cx + s * 0.2},${cy + s * 0.2}L${cx},${cy + s}L${cx - s * 0.2},${cy + s * 0.2}L${cx - s},${cy}L${cx - s * 0.2},${cy - s * 0.2}Z"/>`; }
    }
  }
  return svg(size, size, `
    <rect width="100%" height="100%" fill="#000"/>
    <g filter="url(#wob)">
      <path d="${outer}" fill="none" stroke="${line}" stroke-width="${(r * 0.09).toFixed(1)}" stroke-linejoin="round" opacity="0.95"/>
      <path d="${inner}" fill="none" stroke="${line}" stroke-width="${(r * 0.035).toFixed(1)}" opacity="0.45"/>
      <g fill="#e05aa0" opacity="0.8">${pores}</g>
      <g fill="#f4e04d">${stars}</g>
    </g>`, wobbleFilter('wob', 4, 0.02));
}

/** Sun-iris: the wavy-ray sun from the 2D prototype becomes the iris of every eye. */
export function irisSVG({ size = 512, rays = 22, c1 = '#f4b43d', c2 = '#e0562c', c3 = '#7fd6c8', seed = 5 } = {}) {
  const rnd = mulberry32(seed);
  const cx = size / 2, R = size * 0.48;
  let raysD = '';
  for (let i = 0; i < rays; i++) {
    const a0 = (i / rays) * Math.PI * 2, a1 = ((i + 0.5) / rays) * Math.PI * 2, a2 = ((i + 1) / rays) * Math.PI * 2;
    const ri = R * 0.32, ro = R * (0.85 + rnd() * 0.15);
    const mid = (a0 + a2) / 2 + (rnd() - 0.5) * 0.2;
    raysD += `M${cx + ri * Math.cos(a0)},${cx + ri * Math.sin(a0)} Q${cx + ro * 0.7 * Math.cos(a1 - 0.15)},${cx + ro * 0.7 * Math.sin(a1 - 0.15)} ${cx + ro * Math.cos(mid)},${cx + ro * Math.sin(mid)} Q${cx + ro * 0.7 * Math.cos(a1 + 0.15)},${cx + ro * 0.7 * Math.sin(a1 + 0.15)} ${cx + ri * Math.cos(a2)},${cx + ri * Math.sin(a2)}Z `;
  }
  let fibres = '';
  for (let i = 0; i < 180; i++) {
    const a = rnd() * Math.PI * 2, r0 = R * 0.3, r1 = R * (0.6 + rnd() * 0.38);
    fibres += `<path d="M${cx + r0 * Math.cos(a)},${cx + r0 * Math.sin(a)} Q${cx + (r0 + r1) / 2 * Math.cos(a + 0.12)},${cx + (r0 + r1) / 2 * Math.sin(a + 0.12)} ${cx + r1 * Math.cos(a)},${cx + r1 * Math.sin(a)}" stroke="${rnd() < 0.5 ? '#fff3c4' : '#5a1a10'}" stroke-width="${1 + rnd() * 2}" fill="none" opacity="${0.15 + rnd() * 0.3}"/>`;
  }
  return svg(size, size, `
    <rect width="100%" height="100%" fill="#f2ead8"/>
    <circle cx="${cx}" cy="${cx}" r="${R}" fill="url(#ig)"/>
    <path d="${raysD}" fill="${c1}" opacity="0.85" filter="url(#wob)"/>
    ${fibres}
    <circle cx="${cx}" cy="${cx}" r="${R * 0.98}" fill="none" stroke="#120806" stroke-width="${R * 0.07}"/>
    <circle cx="${cx}" cy="${cx}" r="${R * 0.28}" fill="#050203"/>
    <circle cx="${cx}" cy="${cx}" r="${R * 0.33}" fill="none" stroke="${c3}" stroke-width="${R * 0.03}" opacity="0.8"/>
    <ellipse cx="${cx - R * 0.18}" cy="${cx - R * 0.22}" rx="${R * 0.09}" ry="${R * 0.06}" fill="#fff" opacity="0.85"/>`,
    `<radialGradient id="ig"><stop offset="0.25" stop-color="${c2}"/><stop offset="0.75" stop-color="${c1}"/><stop offset="1" stop-color="#2a0c06"/></radialGradient>${wobbleFilter('wob', 6, 0.04)}`);
}

/** Veined sclera for creature eyes. */
export function scleraSVG({ size = 512, seed = 8 } = {}) {
  const rnd = mulberry32(seed);
  let veins = '';
  for (let i = 0; i < 26; i++) {
    let x = rnd() * size, y = rnd() < 0.5 ? 0 : size; let d = `M${x},${y}`;
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 80; y += (y < size / 2 ? 1 : -1) * (20 + rnd() * 30); d += ` L${x.toFixed(1)},${y.toFixed(1)}`; }
    veins += `<path d="${d}" stroke="#b0202c" stroke-width="${0.8 + rnd() * 2.2}" fill="none" opacity="${0.3 + rnd() * 0.5}"/>`;
  }
  return svg(size, size, `<rect width="100%" height="100%" fill="#efe6d2"/><g filter="url(#wob)">${veins}</g>`, wobbleFilter('wob', 5, 0.05));
}

/** Ritual floor sigil: concentric rings, spiral, tooth-ring, eye glyphs, radial spokes. */
export function sigilSVG({ size = 2048, color = '#ffc76a', accent = '#7fd6c8', seed = 11 } = {}) {
  const rnd = mulberry32(seed);
  const c = size / 2;
  let g = '';
  [0.47, 0.44, 0.36, 0.33, 0.2, 0.12].forEach((rr, i) => {
    g += `<circle cx="${c}" cy="${c}" r="${size * rr}" fill="none" stroke="${i % 2 ? accent : color}" stroke-width="${size * (i < 2 ? 0.006 : 0.004)}" ${i === 3 ? `stroke-dasharray="${size * 0.01} ${size * 0.006}"` : ''}/>`;
  });
  // tooth ring
  let teeth = '';
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2, a2 = ((i + 0.5) / 64) * Math.PI * 2, a3 = ((i + 1) / 64) * Math.PI * 2;
    const r0 = size * 0.36, r1 = size * (0.395 + rnd() * 0.03);
    teeth += `M${c + r0 * Math.cos(a)},${c + r0 * Math.sin(a)} L${c + r1 * Math.cos(a2)},${c + r1 * Math.sin(a2)} L${c + r0 * Math.cos(a3)},${c + r0 * Math.sin(a3)} `;
  }
  g += `<path d="${teeth}" fill="none" stroke="${color}" stroke-width="${size * 0.003}"/>`;
  // spokes with eye glyphs
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x0 = c + size * 0.2 * Math.cos(a), y0 = c + size * 0.2 * Math.sin(a), x1 = c + size * 0.33 * Math.cos(a), y1 = c + size * 0.33 * Math.sin(a);
    g += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${accent}" stroke-width="${size * 0.0025}"/>`;
    const ex = c + size * 0.415 * Math.cos(a + 0.26), ey = c + size * 0.415 * Math.sin(a + 0.26), er = size * 0.018;
    g += `<g transform="translate(${ex},${ey}) rotate(${(a + 0.26) * 57.3 + 90})"><path d="M${-er * 1.6},0 Q0,${-er * 1.3} ${er * 1.6},0 Q0,${er * 1.3} ${-er * 1.6},0Z" fill="none" stroke="${color}" stroke-width="${size * 0.003}"/><circle r="${er * 0.5}" fill="${color}"/></g>`;
  }
  // central spiral (swirl-snake)
  let sp = `M${c},${c}`;
  for (let t = 0; t < 6 * Math.PI; t += 0.15) { const rr = size * 0.0055 * t; sp += ` L${(c + rr * Math.cos(t)).toFixed(1)},${(c + rr * Math.sin(t)).toFixed(1)}`; }
  g += `<path d="${sp}" fill="none" stroke="${color}" stroke-width="${size * 0.006}" stroke-linecap="round"/>`;
  // scattered glyph marks between rings
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2, rr = size * (0.21 + rnd() * 0.1);
    const x = c + rr * Math.cos(a), y = c + rr * Math.sin(a), s = size * (0.004 + rnd() * 0.006);
    g += rnd() < 0.5 ? `<circle cx="${x}" cy="${y}" r="${s}" fill="${accent}" opacity="0.7"/>` : `<path d="M${x - s},${y} L${x},${y - s * 2} L${x + s},${y}" stroke="${color}" fill="none" stroke-width="${size * 0.002}" opacity="0.7"/>`;
  }
  return svg(size, size, `<rect width="100%" height="100%" fill="#000"/><g filter="url(#wob)">${g}</g>`, wobbleFilter('wob', 10, 0.01));
}

/** A band of runes (sword stone, rib inlays). Glyph alphabet built from the prototype's motifs. */
export function runeBandSVG({ w = 2048, h = 256, color = '#7fd6c8', seed = 21, count = 18 } = {}) {
  const rnd = mulberry32(seed);
  let g = '';
  const step = w / count;
  for (let i = 0; i < count; i++) {
    const cx = step * (i + 0.5), cy = h / 2, s = h * 0.32;
    const t = Math.floor(rnd() * 6);
    let d = '';
    if (t === 0) d = `M${cx - s},${cy} Q${cx},${cy - s * 1.4} ${cx + s},${cy} Q${cx},${cy + s * 1.4} ${cx - s},${cy}Z M${cx},${cy - s * 0.3} L${cx},${cy + s * 0.3}`; // eye
    if (t === 1) { d = `M${cx},${cy}`; for (let a = 0; a < 4 * Math.PI; a += 0.3) d += ` L${cx + a * s / 12 * Math.cos(a)},${cy + a * s / 12 * Math.sin(a)}`; } // spiral
    if (t === 2) d = `M${cx - s},${cy + s} L${cx},${cy - s} L${cx + s},${cy + s} M${cx - s * 0.5},${cy} L${cx + s * 0.5},${cy}`; // stair/peak
    if (t === 3) { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; d += `M${cx},${cy} L${cx + s * Math.cos(a)},${cy + s * Math.sin(a)} `; } } // sun
    if (t === 4) d = `M${cx - s},${cy - s * 0.4} L${cx - s * 0.5},${cy + s * 0.4} L${cx},${cy - s * 0.4} L${cx + s * 0.5},${cy + s * 0.4} L${cx + s},${cy - s * 0.4}`; // teeth
    if (t === 5) d = `M${cx},${cy - s} L${cx},${cy + s} M${cx - s * 0.6},${cy - s * 0.4} L${cx + s * 0.6},${cy - s * 0.4} M${cx - s * 0.3},${cy + s * 0.5} A${s * 0.3},${s * 0.3} 0 1,0 ${cx + s * 0.3},${cy + s * 0.5}`; // key
    g += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${h * 0.035}" stroke-linecap="round" stroke-linejoin="round"/>`;
    g += `<circle cx="${cx + step / 2}" cy="${cy}" r="${h * 0.02}" fill="${color}" opacity="0.6"/>`;
  }
  return svg(w, h, `<rect width="100%" height="100%" fill="#000"/>
    <line x1="0" y1="${h * 0.08}" x2="${w}" y2="${h * 0.08}" stroke="${color}" stroke-width="${h * 0.02}" opacity="0.6"/>
    <line x1="0" y1="${h * 0.92}" x2="${w}" y2="${h * 0.92}" stroke="${color}" stroke-width="${h * 0.02}" opacity="0.6"/>
    <g filter="url(#wob)">${g}</g>`, wobbleFilter('wob', 6, 0.03));
}

/** Carved relief panel (used as emissive + bump): spiralling growths, a toothy face, eyes, drips. */
export function reliefPanelSVG({ w = 1024, h = 2048, seed = 31, color = '#ffffff' } = {}) {
  const rnd = mulberry32(seed);
  let g = '';
  // vine scrolls climbing the panel
  for (let k = 0; k < 3; k++) {
    let x = w * (0.2 + k * 0.3), y = h; let d = `M${x},${y}`;
    while (y > 0) {
      const nx = x + (rnd() - 0.5) * w * 0.3, ny = y - h * (0.05 + rnd() * 0.05);
      d += ` Q${x + (rnd() - 0.5) * w * 0.4},${(y + ny) / 2} ${nx},${ny}`;
      // curl
      const cr = w * (0.03 + rnd() * 0.05), dir = rnd() < 0.5 ? -1 : 1;
      let cd = `M${nx},${ny}`;
      for (let a = 0; a < 2.6 * Math.PI; a += 0.35) { const rr = cr * (1 - a / (2.8 * Math.PI)); cd += ` L${(nx + dir * rr * Math.cos(a) - dir * cr).toFixed(1)},${(ny + rr * Math.sin(a)).toFixed(1)}`; }
      g += `<path d="${cd}" fill="none" stroke="${color}" stroke-width="${w * 0.008}" stroke-linecap="round" opacity="0.8"/>`;
      x = Math.max(w * 0.05, Math.min(w * 0.95, nx)); y = ny;
    }
    g += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w * 0.014}" stroke-linecap="round"/>`;
  }
  // a tall sleeping face (the Dreamer) mid-panel
  const fx = w / 2, fy = h * 0.42, fr = w * 0.3;
  g += `<ellipse cx="${fx}" cy="${fy}" rx="${fr}" ry="${fr * 1.25}" fill="none" stroke="${color}" stroke-width="${w * 0.016}"/>`;
  g += `<path d="M${fx - fr * 0.55},${fy - fr * 0.2} q${fr * 0.2},${fr * 0.18} ${fr * 0.4},0 M${fx + fr * 0.15},${fy - fr * 0.2} q${fr * 0.2},${fr * 0.18} ${fr * 0.4},0" stroke="${color}" stroke-width="${w * 0.012}" fill="none" stroke-linecap="round"/>`;
  let teeth = `M${fx - fr * 0.6},${fy + fr * 0.4}`;
  for (let i = 0; i <= 12; i++) teeth += ` L${fx - fr * 0.6 + i * fr * 0.1},${fy + fr * (0.4 + (i % 2 ? 0.16 : 0))}`;
  g += `<path d="${teeth}" stroke="${color}" stroke-width="${w * 0.009}" fill="none"/>`;
  g += `<path d="M${fx - fr * 0.62},${fy + fr * 0.36} Q${fx},${fy + fr * 0.9} ${fx + fr * 0.62},${fy + fr * 0.36}" stroke="${color}" stroke-width="${w * 0.012}" fill="none"/>`;
  // rays around the face
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r0 = fr * 1.35, r1 = fr * (1.6 + rnd() * 0.4);
    g += `<path d="M${fx + r0 * Math.cos(a)},${fy + r0 * 1.2 * Math.sin(a)} Q${fx + (r0 + r1) / 2 * Math.cos(a + 0.15)},${fy + (r0 + r1) / 2 * 1.2 * Math.sin(a + 0.15)} ${fx + r1 * Math.cos(a)},${fy + r1 * 1.2 * Math.sin(a)}" stroke="${color}" stroke-width="${w * 0.008}" fill="none" stroke-linecap="round"/>`;
  }
  // scattered eyes
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w, y = h * (0.65 + rnd() * 0.33), s = w * (0.02 + rnd() * 0.04);
    g += `<path d="M${x - s * 1.6},${y} Q${x},${y - s * 1.3} ${x + s * 1.6},${y} Q${x},${y + s * 1.3} ${x - s * 1.6},${y}Z" fill="none" stroke="${color}" stroke-width="${w * 0.006}"/><circle cx="${x}" cy="${y}" r="${s * 0.5}" fill="${color}"/>`;
  }
  // drips from top
  for (let i = 0; i < 10; i++) {
    const x = rnd() * w, l = h * (0.04 + rnd() * 0.12);
    g += `<path d="M${x},0 L${x},${l}" stroke="${color}" stroke-width="${w * 0.02}" stroke-linecap="round" opacity="0.8"/>`;
  }
  return svg(w, h, `<rect width="100%" height="100%" fill="#000"/><g filter="url(#wob)">${g}</g>
    <rect x="${w * 0.02}" y="${h * 0.01}" width="${w * 0.96}" height="${h * 0.98}" fill="none" stroke="${color}" stroke-width="${w * 0.012}" rx="${w * 0.08}"/>`,
    wobbleFilter('wob', 12, 0.012));
}

/** Pencil livery: lacquer yellow with dark stamped band, foil lettering, scuffs. Wraps around a hexagonal shaft. */
export function pencilLiverySVG({ w = 512, h = 2048 } = {}) {
  const rnd = mulberry32(77);
  let scuffs = '';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * w, y = rnd() * h, l = 4 + rnd() * 40;
    scuffs += `<line x1="${x}" y1="${y}" x2="${x + (rnd() - 0.5) * 6}" y2="${y + l}" stroke="${rnd() < 0.6 ? '#7a4b17' : '#fff5c0'}" stroke-width="${0.6 + rnd() * 1.6}" opacity="${0.2 + rnd() * 0.5}"/>`;
  }
  let text = '';
  for (let k = 0; k < 3; k++) {
    const y = h * (0.15 + k * 0.33);
    text += `<g transform="translate(${w * 0.5},${y}) rotate(90)"><text x="0" y="0" font-family="Georgia, serif" font-size="${w * 0.11}" font-weight="bold" letter-spacing="${w * 0.02}" text-anchor="middle" fill="#1c1408" opacity="0.9">KEATLAND · HB · No.2</text></g>`;
  }
  return svg(w, h, `
    <rect width="100%" height="100%" fill="url(#lac)"/>
    ${scuffs}
    ${text}
    <rect y="${h * 0.48}" width="${w}" height="${h * 0.012}" fill="#1c1408" opacity="0.7"/>
    <rect y="${h * 0.505}" width="${w}" height="${h * 0.004}" fill="#c99b2e" opacity="0.8"/>`,
    `<linearGradient id="lac" x1="0" x2="1"><stop offset="0" stop-color="#d9a21b"/><stop offset="0.5" stop-color="#f2c230"/><stop offset="1" stop-color="#c88d12"/></linearGradient>`);
}

/** Silhouette of a vast swirl-serpent, used on far-away cards drifting through the haze. */
export function serpentSilhouetteSVG({ w = 2048, h = 1024, seed = 41 } = {}) {
  const rnd = mulberry32(seed);
  let d = '';
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    pts.push([w * (0.05 + t * 0.9), h * (0.5 + 0.28 * Math.sin(t * Math.PI * 3.2 + 0.5) * (0.6 + 0.4 * t))]);
  }
  // body as thick polyline with tapering width
  const left = [], right = [];
  for (let i = 0; i < pts.length; i++) {
    const [x, y] = pts[i];
    const [x2, y2] = pts[Math.min(i + 1, pts.length - 1)];
    const [x0, y0] = pts[Math.max(i - 1, 0)];
    let nx = -(y2 - y0), ny = x2 - x0; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const ww = h * 0.07 * Math.sin(Math.PI * Math.min(1, (i / pts.length) * 1.15 + 0.05));
    left.push([x + nx * ww, y + ny * ww]); right.push([x - nx * ww, y - ny * ww]);
  }
  d = 'M' + left.map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L') + ' L' + right.reverse().map((p) => p.map((v) => v.toFixed(1)).join(',')).join(' L') + 'Z';
  let spines = '';
  for (let i = 2; i < pts.length - 2; i++) {
    const [x, y] = pts[i]; const s = h * (0.02 + rnd() * 0.04);
    spines += `<path d="M${x - s * 0.4},${y - h * 0.05} L${x},${y - h * 0.05 - s * 2} L${x + s * 0.4},${y - h * 0.05}Z"/>`;
  }
  return svg(w, h, `<g fill="#fff">${spines}<path d="${d}"/><circle cx="${pts[40][0]}" cy="${pts[40][1]}" r="${h * 0.06}"/></g>`);
}

/** Warped checkerboard (the prototype's tunnel), tileable, for the gullet tunnel walls. */
export function checkerSVG({ size = 1024, n = 8, a = '#0b0a10', b = '#d8d2c0' } = {}) {
  let cells = '';
  const s = size / n;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if ((x + y) % 2) cells += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}"/>`;
  return svg(size, size, `<rect width="100%" height="100%" fill="${a}"/><g fill="${b}" filter="url(#wob)">${cells}</g>`, wobbleFilter('wob', 18, 0.006));
}
