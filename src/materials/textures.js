// Texture factory: rasterises SVG artwork and procedural noise to GPU textures.
// Every texture here is generated in code, so artists can later replace any of them with files
// (see README: "Replacing art").
import * as THREE from 'three';
import { createNoise3D } from '../core/noise.js';

const pending = [];
export const texturesReady = () => Promise.all(pending);

let maxAniso = 4;
export function setMaxAnisotropy(n) { maxAniso = n; }

/** SVG string -> CanvasTexture (drawn asynchronously; texture updates when the image decodes). */
export function svgTexture(svg, { width = 1024, height = 1024, repeat = [1, 1], srgb = true, wrap = true, mipmaps = true, post } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = maxAniso;
  tex.generateMipmaps = mipmaps;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const p = new Promise((resolve) => {
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      if (post) post(ctx, width, height);
      tex.needsUpdate = true; URL.revokeObjectURL(url); resolve();
    };
    img.onerror = (e) => { console.warn('[keatland] svg texture failed', e); resolve(); };
  });
  img.src = url;
  pending.push(p);
  tex.userData.svg = svg;
  return tex;
}

/** SVG -> tangent-space normal map: luminance is treated as height (bright = raised). */
export function svgNormalTexture(svg, { width = 1024, height = 1024, strength = 3, invert = false, blur = 2, repeat = [1, 1] } = {}) {
  const out = document.createElement('canvas'); out.width = width; out.height = height;
  const octx = out.getContext('2d'); octx.fillStyle = 'rgb(128,128,255)'; octx.fillRect(0, 0, width, height);
  const tex = new THREE.CanvasTexture(out);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); tex.anisotropy = maxAniso;
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  pending.push(new Promise((resolve) => {
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      const ctx = c.getContext('2d'); ctx.filter = `blur(${blur}px)`; ctx.drawImage(img, 0, 0, width, height);
      const d = ctx.getImageData(0, 0, width, height).data;
      const h = new Float32Array(width * height);
      for (let i = 0; i < h.length; i++) { const v = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; h[i] = invert ? 1 - v : v; }
      const o = octx.createImageData(width, height);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const l = h[y * width + ((x - 1 + width) % width)], r = h[y * width + ((x + 1) % width)];
        const u = h[((y - 1 + height) % height) * width + x], dn = h[((y + 1) % height) * width + x];
        let nx = (l - r) * strength, ny = (dn - u) * strength, nz = 1; const len = Math.hypot(nx, ny, nz);
        const k = (y * width + x) * 4; o.data[k] = (nx / len * 0.5 + 0.5) * 255; o.data[k + 1] = (ny / len * 0.5 + 0.5) * 255; o.data[k + 2] = (nz / len * 0.5 + 0.5) * 255; o.data[k + 3] = 255;
      }
      octx.putImageData(o, 0, 0); tex.needsUpdate = true; URL.revokeObjectURL(url); resolve();
    };
    img.onerror = () => resolve();
  }));
  img.src = url;
  return tex;
}

/** Canvas painter -> texture (synchronous). */
export function canvasTexture(width, height, paint, { srgb = true, repeat = [1, 1], wrap = true } = {}) {
  const c = document.createElement('canvas'); c.width = width; c.height = height;
  paint(c.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.anisotropy = maxAniso;
  return tex;
}

/** Tileable height field: x wraps via a noise cylinder, y via a cross-fade. */
export function tileableHeight(size, scale, seed, octaves = 5, ridge = false) {
  const n = createNoise3D(seed);
  const h = new Float32Array(size * size);
  const R = scale / (2 * Math.PI);
  const sample = (x, yy) => {
    const a = (x / size) * Math.PI * 2;
    const nx = Math.cos(a) * R, nz = Math.sin(a) * R, ny = (yy / size) * scale;
    let s = 0, amp = 1, f = 1, norm = 0;
    for (let o = 0; o < octaves; o++) {
      let v = n(nx * f, ny * f, nz * f + o * 17.3);
      if (ridge) { v = 1 - Math.abs(v); v = v * v * 2 - 1; }
      s += v * amp; norm += amp; amp *= 0.5; f *= 2;
    }
    return s / norm;
  };
  for (let y = 0; y < size; y++) {
    const t = y / size;
    for (let x = 0; x < size; x++) h[y * size + x] = sample(x, y) * (1 - t) + sample(x, y - size) * t;
  }
  return h;
}

export function heightToNormalTexture(h, size, strength = 2.0, repeat = [1, 1]) {
  return canvasTexture(size, size, (ctx) => {
    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const l = h[y * size + ((x - 1 + size) % size)], r = h[y * size + ((x + 1) % size)];
      const u = h[((y - 1 + size) % size) * size + x], d = h[((y + 1) % size) * size + x];
      let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1;
      const len = Math.hypot(nx, ny, nz); nx /= len; ny /= len; nz /= len;
      const i = (y * size + x) * 4;
      img.data[i] = (nx * 0.5 + 0.5) * 255; img.data[i + 1] = (ny * 0.5 + 0.5) * 255; img.data[i + 2] = (nz * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb: false, repeat });
}

export function heightToGreyTexture(h, size, map = (v) => v * 0.5 + 0.5, repeat = [1, 1], srgb = false) {
  return canvasTexture(size, size, (ctx) => {
    const img = ctx.createImageData(size, size);
    for (let i = 0; i < size * size; i++) {
      const v = Math.max(0, Math.min(1, map(h[i]))) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, { srgb, repeat });
}

/** Text written into the world (chalk / carved). Fonts must be loaded before calling. */
export function textTexture(lines, { width = 1024, height = 256, font = '64px "Permanent Marker"', color = '#a9d3cc', glow = 'rgba(169,211,204,0.6)', align = 'center', lineHeight = 1.15, rotate = 0, chalk = true } = {}) {
  return canvasTexture(width, height, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2); ctx.rotate(rotate); ctx.translate(-w / 2, -h / 2);
    ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle';
    const size = parseInt(font, 10);
    const total = lines.length * size * lineHeight;
    lines.forEach((t, i) => {
      const y = h / 2 - total / 2 + size * lineHeight * (i + 0.5);
      ctx.shadowColor = glow; ctx.shadowBlur = size * 0.35;
      ctx.fillStyle = color; ctx.fillText(t, w / 2, y);
    });
    if (chalk) { // knock holes in the strokes so it reads as chalk/scratched graphite
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < w * h * 0.02; i++) {
        ctx.globalAlpha = Math.random() * 0.6; ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
  }, { wrap: false });
}
