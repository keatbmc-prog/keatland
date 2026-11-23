// Surface generators: angle-varying lathes (platforms, islands), conforming decals, shells.
import * as THREE from 'three';
import { fbm3 } from '../core/noise.js';
import { ensureAttrs } from './sweep.js';

/**
 * Revolve a profile whose radius can depend on angle.
 * profile: array of {r: fraction-of-outline, y: number | (x,z)=>number, noise?}
 * outline(a) -> radius at angle a
 */
export function radialSurface({ center = new THREE.Vector3(), outline, profile, sectors = 128, noise = 0, noiseScale = 0.1, uvRepeat = 12, planarUV = 0 }) {
  const pos = [], uv = [], idx = [];
  const rows = profile.length;
  let arc = 0;
  const arcs = [0];
  for (let k = 1; k < rows; k++) {
    const a = profile[k - 1], b = profile[k];
    const ya = typeof a.y === 'number' ? a.y : 0, yb = typeof b.y === 'number' ? b.y : 0;
    arc += Math.hypot((b.r - a.r) * 30, yb - ya); arcs.push(arc);
  }
  for (let s = 0; s <= sectors; s++) {
    const ang = (s / sectors) * Math.PI * 2;
    const R = outline(ang);
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let k = 0; k < rows; k++) {
      const pr = profile[k];
      const rr = pr.r * R;
      const x = center.x + ca * rr, z = center.z + sa * rr;
      let y = typeof pr.y === 'function' ? pr.y(x, z) : pr.y;
      let dx = 0, dz = 0;
      if (pr.noise ?? noise) {
        const n = (pr.noise ?? noise);
        y += n * fbm3(x * noiseScale, y * noiseScale, z * noiseScale, 4);
        const m = n * 0.6 * fbm3(x * noiseScale + 5, y * noiseScale, z * noiseScale - 5, 3);
        dx = ca * m; dz = sa * m;
      }
      pos.push(x + dx, center.y + y, z + dz);
      if (planarUV) uv.push((x + dx) / planarUV, (z + dz) / planarUV); else uv.push((s / sectors) * uvRepeat, arcs[k] / 8);
    }
  }
  for (let s = 0; s < sectors; s++) for (let k = 0; k < rows - 1; k++) {
    const a = s * rows + k, b = (s + 1) * rows + k;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return ensureAttrs(g);
}

/** Disc decal conforming to a height function (so it sits on curved floors). uv: planar. */
export function conformDisc({ cx, cz, radius, segs = 64, rings = 24, height, offset = 0.03 }) {
  const pos = [], uv = [], idx = [];
  for (let r = 0; r <= rings; r++) for (let s = 0; s <= segs; s++) {
    const rr = (r / rings) * radius, a = (s / segs) * Math.PI * 2;
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    pos.push(x, (height(x, z) ?? 0) + offset, z);
    uv.push(0.5 + Math.cos(a) * (r / rings) * 0.5, 0.5 - Math.sin(a) * (r / rings) * 0.5);
  }
  for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) {
    const a = r * (segs + 1) + s, b = a + segs + 1;
    idx.push(a, a + 1, b, a + 1, b + 1, b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Annulus whose u runs around (for rune bands) conforming to a height function. */
export function conformRing({ cx, cz, r0, r1, segs = 128, height, offset = 0.035, uRepeat = 3 }) {
  const pos = [], uv = [], idx = [];
  for (let s = 0; s <= segs; s++) for (let k = 0; k <= 1; k++) {
    const a = (s / segs) * Math.PI * 2, rr = k ? r1 : r0;
    const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr;
    pos.push(x, (height(x, z) ?? 0) + offset, z); uv.push((s / segs) * uRepeat, k);
  }
  for (let s = 0; s < segs; s++) { const a = s * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

/** Displaced spherical shell patch (membranes, walls of the hub). */
export function shellPatch({ radius, phiStart, phiLength, thetaStart, thetaLength, center = new THREE.Vector3(), w = 64, h = 32, noise = 0.06, noiseScale = 0.03, inward = true }) {
  const g = new THREE.SphereGeometry(radius, w, h, phiStart, phiLength, thetaStart, thetaLength);
  const p = g.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x * noiseScale, v.y * noiseScale, v.z * noiseScale, 4);
    v.multiplyScalar(1 + noise * n);
    p.setXYZ(i, v.x + center.x, v.y + center.y, v.z + center.z);
  }
  if (inward) { // face the inside
    const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
  }
  g.computeVertexNormals();
  return ensureAttrs(g);
}
