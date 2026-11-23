// Photo manifest + textures for the Instagram portal (the cube and the gallery).
// public/gallery/manifest.json: { account, profileUrl, photos: [{ file, caption, postUrl, ... }] }
// Swap photos by replacing the files and editing the manifest; nothing else needs to change.
// If the manifest is missing or a file fails to load, clearly labelled PLACEHOLDER art is drawn
// instead so the portal still works.
import * as THREE from 'three';

const SQ = 512; // square crop used for cube stickers

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

function squareCrop(src) {
  const c = document.createElement('canvas'); c.width = c.height = SQ;
  const g = c.getContext('2d');
  const w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, s = Math.min(w, h);
  g.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, SQ, SQ);
  return c;
}

function tex(src) {
  const t = new THREE.CanvasTexture(src);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Loads the manifest and every photo. Resolves to [{ caption, postUrl, aspect, full, square, placeholder }]. */
export async function loadPhotos(base = './gallery/', min = 12) {
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
      const s = Math.min(1, 1024 / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      return { caption: p.caption || '', postUrl: p.postUrl || profileUrl, aspect: c.width / c.height, full: tex(c), square: tex(squareCrop(c)), placeholder: false };
    } catch {
      const c = placeholderCanvas(i);
      return { caption: 'PLACEHOLDER', postUrl: p.postUrl || profileUrl, aspect: c.width / c.height, full: tex(c), square: tex(squareCrop(c)), placeholder: true };
    }
  }));
  for (let i = out.length; i < Math.min(min, 6); i++) {
    const c = placeholderCanvas(i);
    out.push({ caption: 'PLACEHOLDER', postUrl: profileUrl, aspect: c.width / c.height, full: tex(c), square: tex(squareCrop(c)), placeholder: true });
  }
  return out;
}
