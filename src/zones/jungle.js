// The jungle: a bounded, claustrophobic pocket of overgrowth reached through the leaf portal.
// Huge layered leaves at eye height (they part as you push through, so they block your view but
// never trap you), buttressed trunks with bone knuckles, old ribs arching over a loose path, vines,
// a canopy that lets only dappled light through, drifting spores, and somewhere, something else.
import * as THREE from 'three';
import { sweepGeometry, blobGeometry } from '../geometry/sweep.js';
import { merge, vertebraGeometry, vertebraeAlong } from '../geometry/generators.js';
import { organicMaterial, getTextures } from '../materials/library.js';
import { sporeField } from '../render/effects.js';
import { lightShaft } from '../entities/heart.js';
import { mulberry32, fbm3 } from '../core/noise.js';
import { leafTextures, leafGeometry, foliageMaterial } from './foliage.js';
import { buildLeafPortal } from './leafPortal.js';

export const J = new THREE.Vector3(-400, -400, 400);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildJungle({ scene, mats, quality, collision }) {
  const D = quality.detail;
  const rng = mulberry32(4242);
  const root = new THREE.Group(); root.name = 'jungle'; scene.add(root);
  const RB = 31; // walkable radius (organic)
  const boundR = (a) => RB * (1 + 0.07 * Math.sin(a * 3 + 1) + 0.05 * Math.sin(a * 5 + 2));
  const hAt = (x, z) => J.y + 0.45 * fbm3((x - J.x) * 0.08, 0.5, (z - J.z) * 0.08, 3) + 0.25 * fbm3((x - J.x) * 0.3, 2, (z - J.z) * 0.3, 2);
  const ground = (x, z) => { const dx = x - J.x, dz = z - J.z; return Math.hypot(dx, dz) < boundR(Math.atan2(dz, dx)) ? hAt(x, z) : null; };
  collision.addGround(ground);

  // ---------------------------------------------------------------- the loose path (arrival south -> exit north)
  const path = new THREE.CatmullRomCurve3([[0, 27], [5, 19], [-3, 11], [-8, 2], [-1, -6], [7, -14], [3, -21], [0, -25]].map(([x, z]) => V(J.x + x, J.y, J.z + z)));
  const pathPts = path.getSpacedPoints(160);
  const pathDist = (x, z) => { let m = 1e9; for (const p of pathPts) m = Math.min(m, (p.x - x) ** 2 + (p.z - z) ** 2); return Math.sqrt(m); };

  // ---------------------------------------------------------------- ground
  const gG = new THREE.CircleGeometry(44, 160); gG.rotateX(-Math.PI / 2);
  { const p = gG.attributes.position, uv = gG.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + J.x, z = p.getZ(i) + J.z; p.setY(i, hAt(x, z) - J.y - 0.02); uv.setXY(i, x / 3, z / 3); } gG.computeVertexNormals(); }
  const groundMat = organicMaterial({ color: 0x1d1c12, color2: 0x070805, veinColor: 0x7fffb0, veinAmount: 0.12, veinScale: 0.5, breath: 0, roughness: 0.92, rim: 0.1, normalMap: getTextures().fleshNormal, normalScale: 1.4 });
  const gm = new THREE.Mesh(gG, groundMat); gm.position.copy(J).setY(J.y); gm.receiveShadow = true; root.add(gm);

  // ---------------------------------------------------------------- trunks (buttressed, knuckled), solid
  const barkMat = organicMaterial({ color: 0x2c2a1c, color2: 0x0b0a06, veinColor: 0x6fffa8, veinAmount: 0.18, veinScale: 1.4, breath: 0.02, roughness: 0.85, rim: 0.2, rimColor: 0x1a2a16, normalMap: getTextures().barkNormal, normalScale: 2.2 });
  const trunks = [], trunkGeo = [], knuckles = [];
  const nT = Math.round(62 * D) + 18;
  for (let tries = 0; trunks.length < nT && tries < 3000; tries++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 40;
    const x = J.x + Math.cos(a) * r, z = J.z + Math.sin(a) * r;
    if (pathDist(x, z) < 2.4) continue;
    const rad = 0.3 + Math.pow(rng(), 2) * 1.1;
    if (trunks.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + rad + 1.6)) continue;
    trunks.push({ x, z, r: rad });
  }
  const vg = vertebraGeometry(77, D);
  for (const t of trunks) {
    const y0 = hAt(t.x, t.z) - 0.3, H = 18 + rng() * 12;
    const lean = V((rng() - 0.5) * 2.5, 0, (rng() - 0.5) * 2.5);
    const c = new THREE.CatmullRomCurve3([V(t.x, y0, t.z), V(t.x + lean.x * 0.2, y0 + H * 0.3, t.z + lean.z * 0.2), V(t.x + lean.x * 0.6, y0 + H * 0.7, t.z + lean.z * 0.6), V(t.x + lean.x, y0 + H, t.z + lean.z)]);
    trunkGeo.push(sweepGeometry(c, { tubular: Math.round(40 * Math.max(0.6, D)), radial: 12, radius: (u, ang) => t.r * (1.25 - 0.55 * u) * (1 + 0.12 * Math.sin(ang * 5 + u * 30)) + (u < 0.06 ? (0.06 - u) * 8 * t.r : 0), noise: 0.12 * t.r + 0.05, noiseScale: 0.9, uvScale: [1, 4] }));
    // buttress roots
    const nR = 3 + Math.floor(rng() * 4);
    for (let k = 0; k < nR; k++) {
      const ra = rng() * Math.PI * 2, L = t.r * 2.5 + 0.8 + rng() * 1.5;
      const p0 = V(t.x + Math.cos(ra) * t.r * 0.5, y0 + 1.4 + t.r, t.z + Math.sin(ra) * t.r * 0.5);
      const p1 = V(t.x + Math.cos(ra) * L * 0.6, hAt(t.x, t.z) + 0.3, t.z + Math.sin(ra) * L * 0.6);
      const p2 = V(t.x + Math.cos(ra) * L, hAt(t.x, t.z) - 0.2, t.z + Math.sin(ra) * L);
      trunkGeo.push(sweepGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), { tubular: 16, radial: 7, radius: (u) => t.r * 0.35 * (1 - u) + 0.05, noise: 0.05, capEnd: true }));
    }
    // a few trunks grow knuckles of vertebrae (the place is still Keatland)
    if (rng() < 0.35) knuckles.push(...vertebraeAlong(new THREE.CatmullRomCurve3(c.getPoints(10).slice(1, 6)), 0.9, () => t.r * 0.45, V(rng() - 0.5, 0, rng() - 0.5)));
    collision.addObstacle({ x: t.x, z: t.z, r: t.r * 1.2 + 0.15 });
  }
  const trunkMesh = new THREE.Mesh(merge(trunkGeo), barkMat); trunkMesh.castShadow = true; trunkMesh.receiveShadow = true; root.add(trunkMesh);
  if (knuckles.length) { const km = new THREE.InstancedMesh(vg, mats.bone, knuckles.length); knuckles.forEach((m, i) => km.setMatrixAt(i, m)); km.castShadow = true; root.add(km); }

  // old ribs arching over the path, half swallowed
  const ribMats = [];
  for (let i = 0; i < 6; i++) {
    const u = 0.12 + i * 0.14, p = path.getPointAt(u), tan = path.getTangentAt(u);
    const side = V(-tan.z, 0, tan.x).normalize();
    const w = 2.6 + rng() * 1.2, h = 4 + rng() * 2;
    const g0 = p.clone().addScaledVector(side, -w); g0.y = hAt(g0.x, g0.z) - 0.3;
    const g1 = p.clone().addScaledVector(side, w); g1.y = hAt(g1.x, g1.z) - 0.3;
    const top = p.clone(); top.y = hAt(p.x, p.z) + h;
    const c = new THREE.CatmullRomCurve3([g0, g0.clone().lerp(top, 0.5).add(V(0, h * 0.35, 0)).addScaledVector(side, -w * 0.25), top, g1.clone().lerp(top, 0.5).add(V(0, h * 0.35, 0)).addScaledVector(side, w * 0.25), g1]);
    ribMats.push(...vertebraeAlong(c, 0.36, (t) => 0.19 + 0.07 * Math.sin(t * Math.PI), tan.clone()));
    collision.addObstacle({ x: g0.x, z: g0.z, r: 0.5 }); collision.addObstacle({ x: g1.x, z: g1.z, r: 0.5 });
  }
  const ribs = new THREE.InstancedMesh(vg, mats.bone, ribMats.length); ribMats.forEach((m, i) => ribs.setMatrixAt(i, m)); ribs.castShadow = true; root.add(ribs);

  // vines: hanging (swaying) and slung between trunks
  const vines = [];
  for (let i = 0; i < Math.round(150 * D); i++) {
    const t = trunks[Math.floor(rng() * trunks.length)];
    const a = rng() * Math.PI * 2, r = t.r + rng() * 4;
    const x = t.x + Math.cos(a) * r, z = t.z + Math.sin(a) * r, top = hAt(x, z) + 10 + rng() * 10, bot = hAt(x, z) + 0.6 + rng() * 5;
    const c = new THREE.CatmullRomCurve3([V(x, top, z), V(x + (rng() - 0.5), (top + bot) / 2, z + (rng() - 0.5)), V(x + (rng() - 0.5) * 0.6, bot, z + (rng() - 0.5) * 0.6)]);
    vines.push(sweepGeometry(c, { tubular: 24, radial: 5, radius: (u) => 0.035 + 0.02 * Math.pow(Math.abs(Math.sin(u * 40)), 8), sway: true, phase: rng() }));
  }
  for (let i = 0; i < Math.round(40 * D); i++) {
    const a = trunks[Math.floor(rng() * trunks.length)], b = trunks[Math.floor(rng() * trunks.length)];
    if (a === b || Math.hypot(a.x - b.x, a.z - b.z) > 14) continue;
    const ya = hAt(a.x, a.z) + 6 + rng() * 10, yb = hAt(b.x, b.z) + 6 + rng() * 10;
    const m = V((a.x + b.x) / 2, Math.min(ya, yb) - 2 - rng() * 4, (a.z + b.z) / 2);
    vines.push(sweepGeometry(new THREE.QuadraticBezierCurve3(V(a.x, ya, a.z), m, V(b.x, yb, b.z)), { tubular: 30, radial: 6, radius: () => 0.06 + rng() * 0.05 }));
  }
  root.add(new THREE.Mesh(merge(vines), mats.sinew));

  // ---------------------------------------------------------------- leaves
  const T = leafTextures();
  const kinds = {
    broad: { geo: leafGeometry({ w: 0.62, h: 1.6, droop: 0.4, cup: 0.3 }), map: T.broad, em: T.broadE, mats: [] },
    monstera: { geo: leafGeometry({ w: 1.05, h: 1.5, droop: 0.35, cup: 0.22 }), map: T.monstera, em: T.monsteraE, mats: [] },
    frond: { geo: leafGeometry({ w: 0.7, h: 1.9, droop: 0.6, cup: 0.1 }), map: T.frond, em: T.frondE, mats: [] },
  };
  const coverCell = 2, coverN = 44, cover = new Float32Array(coverN * coverN);
  const cIdx = (x, z) => { const i = Math.floor((x - J.x + 44) / coverCell), k = Math.floor((z - J.z + 44) / coverCell); return i < 0 || k < 0 || i >= coverN || k >= coverN ? -1 : k * coverN + i; };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ');
  const addPlant = (x, z, big) => {
    const y = hAt(x, z);
    const r = rng(), kind = r < 0.45 ? 'broad' : r < 0.75 ? 'monstera' : 'frond';
    const K = kinds[kind];
    const n = 5 + Math.floor(rng() * 6), stem = big ? 0.3 + rng() * 1.4 : rng() * 0.5;
    const sc = (big ? 1.2 + rng() * 1.4 : 0.7 + rng() * 0.8);
    for (let k = 0; k < n; k++) {
      e.set(-(0.25 + rng() * 0.9), (k / n) * Math.PI * 2 + rng() * 0.6, (rng() - 0.5) * 0.4);
      q.setFromEuler(e); const s = sc * (0.75 + rng() * 0.5);
      m4.compose(V(x + (rng() - 0.5) * 0.3, y + stem * (0.6 + rng() * 0.6), z + (rng() - 0.5) * 0.3), q, V(s, s, s));
      K.mats.push(m4.clone());
    }
    const ci = cIdx(x, z); if (ci >= 0) cover[ci] += n * sc * (1 + stem);
  };
  const nPlants = Math.round(520 * D) + 120;
  for (let i = 0; i < nPlants; i++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 38;
    const x = J.x + Math.cos(a) * rr, z = J.z + Math.sin(a) * rr;
    const pd = pathDist(x, z);
    if (pd < 1.3 && rng() < 0.55) continue; // the path is looser, never clear
    if (Math.hypot(x - J.x, z - (J.z - 24)) < 5.5 && rng() < 0.85) continue; // a little hollow before the way out
    if (Math.hypot(x - J.x, z - (J.z + 27)) < 2.6 && rng() < 0.7) continue; // room to arrive
    if (trunks.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + 0.2)) continue;
    addPlant(x, z, rng() < 0.6);
  }
  // a wall of growth at the edge so the world ends in leaves, not a cliff
  for (let i = 0; i < Math.round(160 * D) + 40; i++) {
    const a = rng() * Math.PI * 2, rr = boundR(a) + 0.5 + rng() * 6;
    addPlant(J.x + Math.cos(a) * rr, J.z + Math.sin(a) * rr, true);
  }
  // the canopy: big leaves up high that let only dappled light through (they cast the shadows)
  const canopyMats = [];
  for (let i = 0; i < Math.round(1500 * D) + 300; i++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 46;
    const x = J.x + Math.cos(a) * rr, z = J.z + Math.sin(a) * rr;
    if (rng() < 0.18 && fbm3(x * 0.06, 1, z * 0.06, 2) > 0.15) continue; // light gaps
    e.set(-Math.PI / 2 + (rng() - 0.5) * 1.0, rng() * 6.28, (rng() - 0.5) * 0.6); q.setFromEuler(e);
    const s = 2 + rng() * 2.5;
    m4.compose(V(x, J.y + 13 + rng() * 12, z), q, V(s, s, s)); canopyMats.push(m4.clone());
  }
  // litter on the floor
  const litterMats = [];
  for (let i = 0; i < Math.round(1600 * D); i++) {
    const a = rng() * Math.PI * 2, rr = Math.sqrt(rng()) * 36;
    const x = J.x + Math.cos(a) * rr, z = J.z + Math.sin(a) * rr;
    e.set(-Math.PI / 2 + (rng() - 0.5) * 0.3, rng() * 6.28, 0); q.setFromEuler(e);
    const s = 0.25 + rng() * 0.35;
    m4.compose(V(x, hAt(x, z) + 0.03, z), q, V(s, s, s)); litterMats.push(m4.clone());
  }
  const leafMeshes = [];
  for (const K of Object.values(kinds)) {
    const mesh = new THREE.InstancedMesh(K.geo, foliageMaterial({ map: K.map, emissiveMap: K.em, emissive: 0x2aff8a, emissiveIntensity: 0.14 }), K.mats.length);
    K.mats.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.receiveShadow = true; mesh.frustumCulled = false;
    root.add(mesh); leafMeshes.push(mesh);
  }
  const canopy = new THREE.InstancedMesh(kinds.monstera.geo, foliageMaterial({ map: T.monstera, emissiveMap: T.monsteraE, emissive: 0x2aff8a, emissiveIntensity: 0.05, push: 0, sway: 2.5 }), canopyMats.length);
  canopyMats.forEach((m, i) => canopy.setMatrixAt(i, m)); canopy.castShadow = true; canopy.frustumCulled = false; root.add(canopy);
  const litter = new THREE.InstancedMesh(kinds.broad.geo, foliageMaterial({ map: T.broad, emissiveMap: T.broadE, emissive: 0x2aff8a, emissiveIntensity: 0.05, push: 0, sway: 0 }), litterMats.length);
  litterMats.forEach((m, i) => litter.setMatrixAt(i, m)); litter.receiveShadow = true; litter.frustumCulled = false; root.add(litter);
  // dark masses up in the crowns so no sky shows through
  const crowns = [];
  for (const t of trunks) if (rng() < 0.7) { const b = blobGeometry(4 + rng() * 5, { detail: 2, noise: 0.5, seed: rng() * 50, squash: [1.2, 0.5, 1.2] }); b.translate(t.x, J.y + 24 + rng() * 8, t.z); crowns.push(b); }
  const crownMesh = new THREE.Mesh(merge(crowns), organicMaterial({ color: 0x0b140b, color2: 0x030503, veinAmount: 0, roughness: 1, rim: 0.05 })); crownMesh.castShadow = true; root.add(crownMesh);

  // ---------------------------------------------------------------- light and air
  for (let i = 0; i < 9; i++) {
    const a = rng() * Math.PI * 2, rr = 4 + rng() * 24;
    const top = V(J.x + Math.cos(a) * rr + 6, J.y + 26, J.z + Math.sin(a) * rr - 4);
    const bot = V(J.x + Math.cos(a) * rr, hAt(J.x + Math.cos(a) * rr, J.z + Math.sin(a) * rr), J.z + Math.sin(a) * rr);
    root.add(lightShaft({ from: top, to: bot, r0: 0.3 + rng() * 0.6, r1: 1.0 + rng() * 1.4, color: 0xd8f0a8, intensity: 0.035 }));
  }
  const spores = sporeField(Math.round(quality.particles * 0.35), { center: J.clone(), radius: 30, height: 14, yMin: J.y, rng }); root.add(spores);
  // fireflies: little green lights that blink in and out among the leaves
  const nF = Math.round(220 * D), fp = new Float32Array(nF * 3), fd = [];
  for (let i = 0; i < nF; i++) { const a = rng() * 6.28, rr = Math.sqrt(rng()) * 30; fd.push({ x: J.x + Math.cos(a) * rr, z: J.z + Math.sin(a) * rr, y: 0.4 + rng() * 3, s: rng() * 6.28, sp: 0.2 + rng() * 0.5 }); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(fp, 3));
  const fmat = new THREE.PointsMaterial({ color: 0xb8ff7a, size: 0.07, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const flies = new THREE.Points(fg, fmat); flies.frustumCulled = false; root.add(flies);
  const glowL = new THREE.PointLight(0x7fffb0, 5, 14, 2); root.add(glowL);

  // ---------------------------------------------------------------- the way out
  const exitBase = path.getPointAt(1).clone(); exitBase.z -= 2.5; exitBase.y = hAt(exitBase.x, exitBase.z);
  const exitPortal = buildLeafPortal({ parent: root, mats, collision, base: exitBase, facing: 0, ground, glow: 0xffd88a, seed: 9, detail: D, leaves: 300 });
  const arrivalPos = path.getPointAt(0).clone(); arrivalPos.y = hAt(arrivalPos.x, arrivalPos.z);
  const arrivalFwd = path.getTangentAt(0.02);

  return {
    root, exitPortal, path, trunks,
    arrival: { pos: arrivalPos, yaw: Math.atan2(-arrivalFwd.x, -arrivalFwd.z) },
    ground, hAt, center: J.clone(), radius: RB,
    /** how much leaf cover there is around a point (0 = open, 1+ = dense) */
    coverAt(x, z) { const i = cIdx(x, z); return i < 0 ? 0 : cover[i] / 60; },
    pathDist,
    update(dt, t, playerPos) {
      exitPortal.update(dt, t);
      for (let i = 0; i < nF; i++) { const d = fd[i]; fp[i * 3] = d.x + Math.sin(t * d.sp + d.s) * 0.6; fp[i * 3 + 1] = hAt(d.x, d.z) + d.y + Math.sin(t * d.sp * 1.7 + d.s) * 0.3; fp[i * 3 + 2] = d.z + Math.cos(t * d.sp * 0.8 + d.s) * 0.6; }
      fg.attributes.position.needsUpdate = true;
      fmat.opacity = 0.6 + 0.4 * Math.sin(t * 2.3);
      if (playerPos) glowL.position.set(playerPos.x + Math.sin(t * 0.3) * 3, playerPos.y + 3, playerPos.z + Math.cos(t * 0.3) * 3);
    },
  };
}
