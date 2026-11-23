// Depth layers: colossal structures far out in the dark (same generators as the hub, scaled up and
// simplified), plus SVG silhouettes of serpents drifting through the haze at the edge of sight.
import * as THREE from 'three';
import { pillarGeometry, merge, vertebraGeometry, vertebraeAlong, tendrilTree } from '../geometry/generators.js';
import { blobGeometry, sweepGeometry } from '../geometry/sweep.js';
import { svgTexture } from '../materials/textures.js';
import { serpentSilhouetteSVG } from '../materials/svgArt.js';
import { organicMaterial, U } from '../materials/library.js';
import { mulberry32 } from '../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildDistant({ scene, mats, quality }) {
  const rng = mulberry32(99);
  const root = new THREE.Group(); root.name = 'distant'; scene.add(root);
  const farMat = organicMaterial({ color: 0x2a2228, color2: 0x0c080a, veinColor: 0x5fd6c6, veinAmount: 1.1, veinScale: 0.05, breath: 1.2, breathScale: 0.01, rim: 0.9, rimColor: 0x1c2a34, normalScale: 0.6, colorScale: 0.01 });
  const cores = [], strands = [], arches = [], masses = [], vmats = [], hangs = [];
  const N = quality.distantStructures;
  const tops = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + rng() * 0.3;
    const r = 150 + rng() * 300;
    const base = V(Math.cos(a) * r, -420, Math.sin(a) * r);
    const h = 460 + rng() * 300;
    const p = pillarGeometry({ base, height: h, radius: 10 + rng() * 14, strands: 4, twist: 0.8 + rng(), seed: 900 + i, detail: 0.35 });
    cores.push(p.core); strands.push(p.strands);
    tops.push({ p: p.curve.getPointAt(0.55 + rng() * 0.4), a, r });
    if (rng() < 0.6) { // hanging masses
      const m = blobGeometry(14 + rng() * 22, { detail: 3, noise: 0.35, noiseScale: 1.2, seed: i, squash: [1, 1.6, 1] });
      const pt = p.curve.getPointAt(0.3 + rng() * 0.4); m.translate(pt.x + (rng() - 0.5) * 40, pt.y, pt.z + (rng() - 0.5) * 40); masses.push(m);
    }
  }
  // vertebral arches spanning between neighbours
  for (let i = 0; i < tops.length; i++) {
    if (rng() < 0.35) continue;
    const A = tops[i].p, B = tops[(i + 1) % tops.length].p;
    const mid = A.clone().lerp(B, 0.5).add(V(0, 120 + rng() * 120, 0));
    const c = new THREE.QuadraticBezierCurve3(A, mid, B);
    arches.push(sweepGeometry(c, { tubular: 60, radial: 8, radius: (t) => 5 + 2 * Math.sin(t * Math.PI), noise: 0.2, noiseScale: 0.05 }));
    vmats.push(...vertebraeAlong(c, 16, () => 4.5, V(0, 1, 0)));
    for (let k = 0; k < 2; k++) { const st = c.getPointAt(0.3 + rng() * 0.4); const t = tendrilTree({ start: st, dir: V(0, -1, 0), length: 120 + rng() * 80, radius: 3, depth: 1, gravity: 0.9, curl: 0.3, rng, detail: 0.25, podChance: 0 }); hangs.push(t.body); }
  }
  root.add(new THREE.Mesh(merge([...cores, ...arches, ...masses]), farMat));
  root.add(new THREE.Mesh(merge([...strands, ...hangs]), farMat));
  if (vmats.length) {
    const vi = new THREE.InstancedMesh(vertebraGeometry(3, 0.4), farMat, vmats.length);
    vmats.forEach((m, i) => vi.setMatrixAt(i, m)); root.add(vi);
  }
  // serpent silhouettes: SVG art on cards, drifting
  const tex = svgTexture(serpentSilhouetteSVG({}), { width: 1024, height: 512, wrap: false });
  const serpents = [];
  for (let i = 0; i < 3; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x07060a, alphaMap: tex, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, opacity: 0.85 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(520, 260), mat);
    const a = 1.2 + i * 2.1; const r = 700 + i * 120;
    m.position.set(Math.cos(a) * r, 40 + i * 70, Math.sin(a) * r);
    m.lookAt(0, 30, 0); root.add(m);
    serpents.push({ m, a, r, speed: 0.004 + i * 0.002 });
  }
  return {
    root,
    update(dt, t) {
      for (const s of serpents) { const a = s.a + t * s.speed; s.m.position.x = Math.cos(a) * s.r; s.m.position.z = Math.sin(a) * s.r; s.m.lookAt(0, 30, 0); s.m.position.y += Math.sin(t * 0.1 + s.a) * 0.05; }
    },
  };
}
