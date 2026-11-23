// Reusable procedural structure generators. Each returns plain BufferGeometry (world-space or
// local), so they can be merged, instanced, or swapped for imported GLB meshes later.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sweepGeometry, blobGeometry, ensureAttrs } from './sweep.js';
import { mulberry32, noise3, fbm3 } from '../core/noise.js';

const _v = new THREE.Vector3();

export function merge(geoms) {
  const clean = geoms.filter(Boolean).map((g) => {
    ensureAttrs(g);
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'aSway', 'aPhase'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); }
    return g;
  });
  if (!clean.length) return new THREE.BufferGeometry();
  return mergeGeometries(clean, false);
}

/**
 * Recursive branching tendril (an L-system-ish growth). Produces branches + tip pods.
 * opts: start, dir, length, radius, depth, gravity (+down / -up), curl, rng, detail, sway, children
 * returns { body: BufferGeometry, pods: BufferGeometry, tips: Vector3[] }
 */
export function tendrilTree(opts) {
  const rng = opts.rng ?? mulberry32(opts.seed ?? 1);
  const body = [], pods = [], tips = [];
  const detail = opts.detail ?? 1;
  const grow = (start, dir, length, radius, depth, swayBase, phase) => {
    const pts = [start.clone()];
    const d = dir.clone().normalize();
    const steps = 7;
    const p = start.clone();
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // curl via noise, droop by gravity
      const n = new THREE.Vector3(noise3(p.x * 0.07, p.y * 0.07, p.z * 0.07 + depth), noise3(p.x * 0.07 + 9, p.y * 0.07, p.z * 0.07), noise3(p.x * 0.07, p.y * 0.07 + 4, p.z * 0.07 - 3));
      d.addScaledVector(n, opts.curl ?? 0.5).add(new THREE.Vector3(0, -(opts.gravity ?? 0.25) * t, 0)).normalize();
      p.addScaledVector(d, length / steps);
      pts.push(p.clone());
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const nodes = 3 + Math.floor(rng() * 4);
    const tub = Math.max(10, Math.round(length * 1.6 * detail));
    const rad = Math.max(5, Math.round((radius > 0.6 ? 12 : radius > 0.25 ? 8 : 6) * Math.min(1, detail + 0.2)));
    const g = sweepGeometry(curve, {
      tubular: tub, radial: rad,
      radius: (t) => radius * (1 - 0.82 * t) * (1 + 0.22 * Math.pow(Math.max(0, Math.sin(t * Math.PI * nodes)), 6)),
      noise: 0.18, noiseScale: 0.5, sway: true, phase, capEnd: true,
    });
    // remap sway so children inherit their parent's motion at the attachment point
    const sw = g.attributes.aSway;
    for (let i = 0; i < sw.count; i++) sw.setX(i, swayBase + sw.getX(i) * (1 - swayBase) * 0.8);
    body.push(g);
    const tip = curve.getPointAt(1);
    if (depth <= 0) {
      tips.push(tip);
      if (rng() < (opts.podChance ?? 0.5)) {
        const pod = blobGeometry(radius * (1.4 + rng() * 1.4) + 0.06, { detail: 2, noise: 0.25, noiseScale: 2, seed: rng() * 10, squash: [1, 1.5, 1] });
        pod.translate(tip.x, tip.y - radius, tip.z);
        const ps = pod.attributes.aSway; for (let i = 0; i < ps.count; i++) ps.setX(i, Math.min(1, swayBase + (1 - swayBase) * 0.8));
        const pp = pod.attributes.aPhase; for (let i = 0; i < pp.count; i++) pp.setX(i, phase);
        pods.push(pod);
      }
      return;
    }
    const kids = opts.children ?? 3;
    for (let k = 0; k < kids; k++) {
      const t = 0.35 + rng() * 0.6;
      const at = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      const side = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).cross(tan).normalize();
      const nd = tan.clone().multiplyScalar(0.6).addScaledVector(side, 0.8).normalize();
      const r = radius * (1 - 0.82 * t) * 0.85;
      if (r < 0.02) continue;
      grow(at, nd, length * (0.45 + rng() * 0.25), r, depth - 1, swayBase + (1 - swayBase) * t * 0.8, phase + rng() * 0.2);
    }
  };
  grow(opts.start.clone(), opts.dir.clone(), opts.length, opts.radius, opts.depth ?? 3, opts.swayBase ?? 0, opts.phase ?? rng());
  return { body: merge(body), pods: pods.length ? merge(pods) : null, tips };
}

/** One vertebra (local, along +Y): centrum disc, neural spine, two transverse processes, little hooks. */
export function vertebraGeometry(seed = 1, detail = 1) {
  const rng = mulberry32(seed);
  const parts = [];
  const centrum = blobGeometry(1, { detail: detail > 0.7 ? 3 : 2, noise: 0.18, noiseScale: 1.8, seed, squash: [1.35, 0.55, 1.35] });
  parts.push(centrum);
  const proc = (dir, len, rad) => {
    const end = dir.clone().multiplyScalar(len);
    const mid = end.clone().multiplyScalar(0.5).add(new THREE.Vector3(0, 0.35, 0));
    const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(), mid, end);
    parts.push(sweepGeometry(c, { tubular: 8, radial: 6, radius: (t) => rad * (1 - 0.85 * t) * (1 + 0.6 * Math.exp(-t * 8)), capEnd: true }));
  };
  proc(new THREE.Vector3(0, 0.25, 1), 2.6 + rng() * 0.8, 0.42);       // neural spine (dorsal)
  proc(new THREE.Vector3(1, 0.1, 0.2), 1.9 + rng() * 0.5, 0.32);      // transverse
  proc(new THREE.Vector3(-1, 0.1, 0.2), 1.9 + rng() * 0.5, 0.32);
  proc(new THREE.Vector3(0.6, -0.4, -0.7), 1.1, 0.2);                 // hooks
  proc(new THREE.Vector3(-0.6, -0.4, -0.7), 1.1, 0.2);
  return merge(parts);
}

/** Instancing transforms of vertebrae along a curve. */
export function vertebraeAlong(curve, spacing, scaleFn, up = new THREE.Vector3(0, 1, 0)) {
  const len = curve.getLength();
  const n = Math.max(2, Math.floor(len / spacing));
  const mats = [];
  const q = new THREE.Quaternion(), m = new THREE.Matrix4(), s = new THREE.Vector3();
  const Y = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = curve.getPointAt(t), tan = curve.getTangentAt(t);
    q.setFromUnitVectors(Y, tan);
    // roll so the dorsal spine faces "outward/up" relative to `up`
    const dorsal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const want = up.clone().sub(tan.clone().multiplyScalar(up.dot(tan))).normalize();
    const ang = Math.atan2(dorsal.clone().cross(want).dot(tan), dorsal.dot(want));
    q.premultiply(new THREE.Quaternion().setFromAxisAngle(tan, ang));
    const sc = scaleFn(t);
    s.set(sc, sc * (0.9 + 0.2 * Math.sin(i * 1.7)), sc);
    m.compose(p, q, s);
    mats.push(m.clone());
  }
  return mats;
}

/** Twisted pillar: helical sinew strands around a knotted core, collars of bone at intervals. */
export function pillarGeometry({ base, height, radius = 3, strands = 6, twist = 1.5, seed = 1, detail = 1 }) {
  const rng = mulberry32(seed);
  const core = [], strandsG = [], collars = [];
  const lean = new THREE.Vector3((rng() - 0.5) * 0.15, 1, (rng() - 0.5) * 0.15).normalize();
  const spine = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    spine.push(base.clone().addScaledVector(lean, height * t).add(new THREE.Vector3(Math.sin(t * 5 + seed) * radius * 0.4, 0, Math.cos(t * 4 + seed) * radius * 0.4)));
  }
  const sc = new THREE.CatmullRomCurve3(spine);
  const swell = (t) => 1 + 0.35 * Math.sin(t * Math.PI * 3 + seed) + 0.5 * Math.exp(-t * 6) + 0.6 * Math.exp(-(1 - t) * 8);
  core.push(sweepGeometry(sc, { tubular: Math.round(70 * detail), radial: Math.round(18 * detail) + 6, radius: (t) => radius * 0.7 * swell(t), noise: 0.22, noiseScale: 0.12, capEnd: true }));
  const frames = sc.computeFrenetFrames(80, false);
  for (let s = 0; s < strands; s++) {
    const pts = [];
    const ph = (s / strands) * Math.PI * 2 + rng() * 0.3;
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const p = sc.getPointAt(t);
      const a = ph + t * twist * Math.PI * 2;
      const rr = radius * swell(t) * (0.82 + 0.12 * Math.sin(t * 20 + s));
      p.addScaledVector(frames.normals[i], Math.cos(a) * rr).addScaledVector(frames.binormals[i], Math.sin(a) * rr);
      pts.push(p);
    }
    const c = new THREE.CatmullRomCurve3(pts);
    const sr = radius * (0.22 + rng() * 0.12);
    strandsG.push(sweepGeometry(c, { tubular: Math.round(160 * detail), radial: Math.round(8 * detail) + 3, radius: (t) => sr * (0.8 + 0.4 * Math.sin(t * 31 + s * 2)), noise: 0.25, noiseScale: 0.4 }));
  }
  const nCol = 3 + Math.floor(rng() * 3);
  for (let k = 0; k < nCol; k++) {
    const t = 0.15 + (k / nCol) * 0.8 + rng() * 0.05;
    const p = sc.getPointAt(t), tan = sc.getTangentAt(t);
    const tor = new THREE.TorusGeometry(radius * swell(t) * 1.05, radius * 0.18, 8, Math.round(36 * detail) + 8);
    // knobbly
    const pa = tor.attributes.position;
    for (let i = 0; i < pa.count; i++) { _v.fromBufferAttribute(pa, i); const k2 = 1 + 0.25 * Math.max(0, Math.sin(Math.atan2(_v.y, _v.x) * 14)); pa.setXYZ(i, _v.x * (1 + (k2 - 1) * 0.08), _v.y * (1 + (k2 - 1) * 0.08), _v.z * k2); }
    tor.computeVertexNormals();
    tor.lookAt(tan); tor.translate(p.x, p.y, p.z);
    collars.push(tor);
  }
  return { core: merge(core), strands: merge(strandsG), collars: merge(collars), curve: sc };
}

/** Ring of crooked teeth (for the maw) in local space; opens along +Z. */
export function teethRing({ rx = 6, ry = 4, count = 28, len = 1.8, seed = 4, inward = 0.7 }) {
  const rng = mulberry32(seed);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng() * 0.05;
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    const l = len * (0.5 + rng() * 0.9);
    const tooth = new THREE.ConeGeometry(0.35 + rng() * 0.3, l, 7, 3);
    const pa = tooth.attributes.position;
    for (let k = 0; k < pa.count; k++) { _v.fromBufferAttribute(pa, k); const bend = Math.pow((_v.y / l + 0.5), 2) * 0.4; pa.setXYZ(k, _v.x + bend * (rng() - 0.5) * 0.4, _v.y, _v.z + bend); }
    tooth.translate(0, l / 2, 0);
    // point toward centre and slightly forward
    const dir = new THREE.Vector3(-x, -y, inward * Math.max(rx, ry) * 0.3).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    tooth.applyQuaternion(q);
    tooth.translate(x, y, 0);
    tooth.computeVertexNormals();
    parts.push(tooth);
  }
  return merge(parts);
}

/** Random surface samples (world-space positions + normals) for scattering cilia, pods, etc. */
export function scatterOnGeometry(geom, count, rng, filter) {
  const pos = geom.attributes.position, nor = geom.attributes.normal, idx = geom.index;
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  const areas = new Float32Array(triCount); let total = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const get = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, get(t, 0)); b.fromBufferAttribute(pos, get(t, 1)); c.fromBufferAttribute(pos, get(t, 2));
    total += b.sub(a).cross(c.sub(a)).length() * 0.5; areas[t] = total;
  }
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 8) {
    const r = rng() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (areas[mid] < r) lo = mid + 1; else hi = mid; }
    let u = rng(), v = rng(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    a.fromBufferAttribute(pos, get(lo, 0)); b.fromBufferAttribute(pos, get(lo, 1)); c.fromBufferAttribute(pos, get(lo, 2));
    const p = a.clone().multiplyScalar(1 - u - v).addScaledVector(b, u).addScaledVector(c, v);
    const na = new THREE.Vector3().fromBufferAttribute(nor, get(lo, 0)), nb = new THREE.Vector3().fromBufferAttribute(nor, get(lo, 1)), nc = new THREE.Vector3().fromBufferAttribute(nor, get(lo, 2));
    const n = na.multiplyScalar(1 - u - v).addScaledVector(nb, u).addScaledVector(nc, v).normalize();
    if (filter && !filter(p, n)) continue;
    out.push({ p, n });
  }
  return out;
}

export { fbm3 };
