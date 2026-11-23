// Core procedural primitive: sweep a (noisy, variable-radius) ring along any curve.
// Used for ribs, tendrils, pillars, sinew strands, tunnels and the pencil's body.
import * as THREE from 'three';
import { fbm3, noise3 } from '../core/noise.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * @param {THREE.Curve} curve
 * @param {object} o
 *   radius(t, a) -> number   radius along the curve (t 0..1) and around (a 0..2PI)
 *   tubular, radial           segment counts
 *   noise, noiseScale         organic displacement amplitude & frequency (world units)
 *   sway                      write aSway attribute (0 at root -> 1 at tip) for hanging motion
 *   phase                     aPhase attribute value (desync swaying)
 *   capStart, capEnd          close the ends
 *   inside                    flip normals (tunnels)
 *   uvScale                   [u, v] repeat
 */
export function sweepGeometry(curve, o = {}) {
  const tubular = o.tubular ?? 64, radial = o.radial ?? 12;
  const radius = o.radius ?? (() => 1);
  const nAmp = o.noise ?? 0, nScale = o.noiseScale ?? 0.3;
  const frames = curve.computeFrenetFrames(tubular, !!o.closed);
  const pos = [], uv = [], sway = [], phase = [], idx = [];
  const P = new THREE.Vector3(), N = new THREE.Vector3(), V = new THREE.Vector3();
  const uvs = o.uvScale ?? [1, 1];
  let length = curve.getLength();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, P);
    const n = frames.normals[i], b = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const r0 = radius(t, a);
      N.set(0, 0, 0).addScaledVector(n, Math.cos(a)).addScaledVector(b, Math.sin(a));
      V.copy(P).addScaledVector(N, r0);
      let r = r0;
      if (nAmp) r += nAmp * r0 * fbm3(V.x * nScale, V.y * nScale, V.z * nScale, 3);
      V.copy(P).addScaledVector(N, r);
      pos.push(V.x, V.y, V.z);
      uv.push((j / radial) * uvs[0], t * uvs[1] * length / 10);
      sway.push(t);
      phase.push(o.phase ?? 0);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = (i + 1) * (radial + 1) + j, c = b + 1, d = a + 1;
    if (o.inside) idx.push(a, b, d, b, c, d); else idx.push(a, d, b, b, d, c);
  }
  const addCap = (ti, flip) => {
    const center = curve.getPointAt(ti);
    const base = pos.length / 3;
    pos.push(center.x, center.y, center.z); uv.push(0.5, 0.5); sway.push(ti); phase.push(o.phase ?? 0);
    const ring = (ti === 0 ? 0 : tubular) * (radial + 1);
    for (let j = 0; j < radial; j++) flip ? idx.push(base, ring + j, ring + j + 1) : idx.push(base, ring + j + 1, ring + j);
  };
  if (o.capStart) addCap(0, false);
  if (o.capEnd) addCap(1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('aSway', new THREE.Float32BufferAttribute(o.sway ? sway : sway.map(() => 0), 1));
  g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Displaced icosphere blob. squash = [sx, sy, sz]. lumps adds a few large tumours. */
export function blobGeometry(radius = 1, o = {}) {
  const detail = o.detail ?? 5;
  let g = new THREE.IcosahedronGeometry(radius, detail);
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-4);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const amp = o.noise ?? 0.25, sc = o.noiseScale ?? 1.2, seed = o.seed ?? 0;
  const sq = o.squash ?? [1, 1, 1];
  const lumps = (o.lumps ?? []).map((l) => ({ dir: new THREE.Vector3(...l.dir).normalize(), size: l.size, amp: l.amp }));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = v.clone().normalize();
    let d = 1 + amp * fbm3(n.x * sc + seed, n.y * sc, n.z * sc - seed, 4);
    if (o.ridge) d += o.ridge * (1 - Math.abs(noise3(n.x * sc * 3 + seed, n.y * sc * 3, n.z * sc * 3)));
    for (const l of lumps) { const k = Math.max(0, n.dot(l.dir)); d += l.amp * Math.pow(k, l.size); }
    v.copy(n).multiplyScalar(radius * d);
    v.set(v.x * sq[0], v.y * sq[1], v.z * sq[2]);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  // spherical uvs for the normal maps
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).normalize(); uv.setXY(i, 0.5 + Math.atan2(v.z, v.x) / (2 * Math.PI) * 4, Math.acos(v.y) / Math.PI * 4); }
  ensureAttrs(g);
  return g;
}

/** Make sure geometry has the attribute set every organic material expects, so merges work. */
export function ensureAttrs(g, swayVal = 0, phaseVal = 0) {
  const n = g.attributes.position.count;
  if (!g.attributes.aSway) g.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(n).fill(swayVal), 1));
  if (!g.attributes.aPhase) g.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Float32Array(n).fill(phaseVal), 1));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  if (g.index === null) { /* fine */ }
  return g;
}

/** Strip to the canonical attribute set (position, normal, uv, aSway, aPhase) and non-indexed-safe merge. */
export function canonical(g) {
  ensureAttrs(g);
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aSway', 'aPhase'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  return g.index ? g : g; // mergeGeometries requires consistent indexing; callers use toIndexed()
}

export function toIndexed(g) {
  if (g.index) return g;
  const n = g.attributes.position.count; const idx = new Uint32Array(n); for (let i = 0; i < n; i++) idx[i] = i;
  g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
}
