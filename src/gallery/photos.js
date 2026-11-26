// Photo manifest + textures for the Instagram portal (the cube and the gallery).
// public/gallery/manifest.json: { account, profileUrl, photos: [{ file, caption, postUrl, ... }] }
// Swap photos by replacing the files and editing the manifest; nothing else needs to change.
// If the manifest is missing or a file fails to load, clearly labelled PLACEHOLDER art is drawn
// instead so the portal still works.
import * as THREE from 'three';


function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.decoding = 'async'; im.onload = () => res(im); im.onerror = rej; im.src = url; });
}

/** Painted stand-in, labelled as a placeholder so it is never mistaken for a real photo. */
function placeholderCanvas(i, w = 768, h = 960) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const hue = (i * 47) % 360;
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, `hsl(${hue},35%,22%)`); gr.addColorStop(1, `hsl(${(hue + 60) % 360},40%,8%)`);
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  g.strokeStyle = `hsla(${(hue + 180) % 360},60%,70%,0.5)`; g.lineWidth = 3;
  for (let k = 0; k < 14; k++) { g.beginPath(); g.arc(w / 2, h / 2, 30 + k * 26, k * 0.4, k * 0.4 + 4.2); g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '48px "Special Elite", monospace'; g.textAlign = 'center';
  g.fillText('PLACEHOLDER', w / 2, h - 90); g.font = '30px "Special Elite", monospace'; g.fillText('photo ' + (i + 1), w / 2, h - 45);
  return c;
}

/** draw a centred square crop of src into ctx at (x, y, size) */
function squareInto(g, src, x, y, size) {
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, s = Math.min(w, h);
  g.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, x, y, size, size);
}

/** One square atlas for every cube sticker: a grid of centred square crops, one cell per photo
 *  (64 photos = 8x8). One texture instead of one per photo keeps GPU memory and binds low. */
function buildAtlas(sources, cell) {
  const n = Math.max(1, sources.length), cols = Math.ceil(Math.sqrt(n)), size = cols * cell;
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = '#120c0a'; g.fillRect(0, 0, size, size);
  const cells = sources.map((src, i) => {
    const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
    squareInto(g, src, x, y, cell);
    // uv of the cell's lower-left corner (flipY: canvas row 0 is the top) and its size
    return { u: x / size, v: 1 - (y + cell) / size, s: cell / size };
  });
  return { texture: tex(c), cells };
}

function tex(src) {
  const t = new THREE.CanvasTexture(src);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Loads the manifest and every photo. Resolves to [{ caption, postUrl, aspect, full, cell, placeholder }]
 *  plus `.atlas` (the shared square-crop texture the cube stickers sample through each photo's `cell`).
 *  maxEdge caps each framed photo's texture (GPU memory: phones get smaller ones), atlasCell the sticker crops. */
export async function loadPhotos(base = './gallery/', { min = 12, maxEdge = 640, atlasCell = 256 } = {}) {
  let list = [];
  let profileUrl = 'https://www.instagram.com/keaten.blank/';
  try {
    const r = await fetch(base + 'manifest.json', { cache: 'no-cache' });
    if (r.ok) { const m = await r.json(); list = m.photos || []; profileUrl = m.profileUrl || profileUrl; }
  } catch { /* fall through to placeholders */ }
  const out = await Promise.all(list.map(async (p, i) => {
    try {
      const im = await loadImage(base + p.file);
      // downscale very large photos to keep GPU memory sane
      const s = Math.min(1, maxEdge / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return { caption: p.caption || '', postUrl: p.postUrl || profileUrl, aspect: c.width / c.height, full: tex(c), src: c, placeholder: false };
    } catch {
      const c = placeholderCanvas(i);
      return { caption: 'PLACEHOLDER', postUrl: p.postUrl || profileUrl, aspect: c.width / c.height, full: tex(c), src: c, placeholder: true };
    }
  }));
  for (let i = out.length; i < Math.min(min, 6); i++) {
    const c = placeholderCanvas(i);
    out.push({ caption: 'PLACEHOLDER', postUrl: profileUrl, aspect: c.width / c.height, full: tex(c), src: c, placeholder: true });
  }
  const atlas = buildAtlas(out.map((p) => p.src), atlasCell);
  out.forEach((p, i) => { p.cell = atlas.cells[i]; delete p.src; });
  out.atlas = atlas.texture;
  return out;
}
