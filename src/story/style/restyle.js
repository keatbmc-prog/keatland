// The story realm's art-direction pass (High-on-Life-ish): runs once after the realm is built.
//  1. Sweeps every MeshStandardMaterial under the story and Works roots into the toon kit with
//     per-zone rim / shadow colours (materials shared with the hub are cloned first, so the hub,
//     the gallery and the jungle are untouched).
//  2. Dresses each zone with "alive" organic pieces: goopy alien plants and boulders round the lot,
//     eyes on the Keatland Motors pylon and over the Reception door, eyes and fleshy growths in the
//     Backrooms wallpaper, eyes on the Works vats, and Yesterkeat's speaker critters in both.
//  3. Remodels the architecture (second pass): every static mesh in the realm is tessellated (to a
//     budget set by the quality tier) and moved by a shared world-space warp field, so Reception, the
//     Backrooms walls and doorways and the factory hall bulge, sway and melt softly without cracks,
//     floors stay where the collision says they are, and the Backrooms loop stays seamless. On top:
//     Reception gets soft rounded edges (fat corner and roof-edge rolls, a puffy awning, a pillowy
//     roof), the pylon goes goopy, the Backrooms ceilings drip, the factory grows fleshy ribs, its
//     pipes peristalt and its vats are veined, swelling organs.
// update(dt, t, camera, realm) animates the shared toon time, the eyes and the critters.
import * as THREE from 'three';
import { TessellateModifier } from 'three/addons/modifiers/TessellateModifier.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonify, TOON, PA, punch, warpField, warpAt } from './toon.js';
import { WORKS } from '../../zones/works/layout.js';
import { alienPlant, blobGeo, toonMat, Eyeball, SpeakerCritter, PAL } from './goop.js';
import { S, SL, FLOOR } from '../layout.js';
import { mulberry32 } from '../../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const ZONES = {
  lot: { rim: 0xff8ac8, shade: 0x3a5a8a, sat: 1.3, shadeK: 0.3 },
  reception: { rim: 0x3ef0ff, shade: 0x6a2a90, sat: 1.4, grad: 0.75, gradY0: -0.2, gradY1: 5.5 },
  backrooms: { rim: 0xb4ff3a, shade: 0x9a9a3a, sat: 1.3, shadeK: 0.2 }, // stays yellowed and liminal, just more alive
  works: { rim: 0x30e8ff, shade: 0x4a1a8a, sat: 1.35, grad: 0.55, gradY0: -1, gradY1: 22 },
};

function zoneOfStory(p) {
  const x = p.x - S.x, z = p.z - S.z;
  if (z < -36 || x > 18) return 'backrooms';
  if (x > SL.rx0 - 0.5 && x < SL.rx1 + 0.5 && z > SL.rz0 - 0.5 && z < SL.rz1 + 0.5) return 'reception';
  return 'lot';
}

export function restyleStory({ scene, story, works, collision, quality }) {
  const roots = [story.root, works.root];
  // materials used anywhere else in the scene (hub, gallery, jungle) must not change
  const shared = new Set();
  const inRoots = (o) => { for (let q = o; q; q = q.parent) if (roots.includes(q) || q === story.sky) return true; return false; };
  scene.traverse((o) => { if (!o.material || inRoots(o)) return; (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => shared.add(m)); });
  const clones = new Map();
  const tmp = new THREE.Vector3(), sph = new THREE.Sphere();
  const D = quality.detail;

  // ---- the warp fields (one per realm). Story: soft, period 15 in x (the Backrooms loop jumps 15 m),
  // with a goopy hot-spot on the Keatland Motors pylon. Works: big, slow, cathedral-scale sag.
  const pylonW = SL.pylon.clone().add(S);
  const storyWarp = warpField({ amp: 0.28, base: S.y + FLOOR, h: 3.4, period: 15, breathe: 0.35, hot: pylonW, hotR: 9, hotAmp: 0.75 });
  const worksWarp = warpField({ amp: 0.6, base: WORKS.y + 0.05, h: 24, period: 30, breathe: 0.25 });
  const noWarp = new Set(); // materials on anything that moves on its own, or must not bend
  const noWarpRoots = [works.flood?.group, works.flood?.mesh, ...(Object.values(works.cast || {}).filter((v) => v?.isObject3D))].filter(Boolean);
  const warpable = (o) => {
    if (o.isSprite || o.isPoints || o.isLine || o.userData.noWarp) return false;
    for (let q = o; q; q = q.parent) { if (q.name?.startsWith('figure:') || noWarpRoots.includes(q) || q.userData?.noWarp) return false; }
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    return o.geometry.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < 160;
  };
  for (const r of roots) r.traverse((o) => { if (o.isMesh && o.material && !warpable(o)) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => noWarp.add(m)); });
  // ---- tessellation so flat walls have vertices to bend (budgeted by the quality tier)
  const edge = D >= 1 ? 0.6 : D >= 0.8 ? 0.85 : 1.3;
  const perMesh = Math.round(90000 * D); let triBudget = Math.round(1400000 * D);
  const tessCache = new Map(); const stats = { tess: [], skipped: [] };
  const tessellate = (o, scale) => {
    const g = o.geometry;
    if (o.isInstancedMesh || o.isSkinnedMesh || !g.attributes.position || g.morphAttributes?.position) return;
    if (tessCache.has(g)) { o.geometry = tessCache.get(g); return; }
    const ws = o.matrixWorld.getMaxScaleOnAxis() || 1; let e = (edge * scale) / ws, out = null;
    // multi-material geometry (the tiled boxes): tessellate each group on its own and merge them back with groups
    const multi = Array.isArray(o.material) && g.groups?.length;
    const ng = multi ? (g.index ? g.toNonIndexed() : g) : g;
    const parts = multi ? ng.groups.map((gr) => { const sub = new THREE.BufferGeometry(); for (const [k, a] of Object.entries(ng.attributes)) sub.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize, a.normalized)); return { sub, mi: gr.materialIndex }; }) : null;
    const run = (e) => {
      if (!multi) return new TessellateModifier(e, 24).modify(g);
      const subs = parts.map(({ sub }) => new TessellateModifier(e, 24).modify(sub));
      const m = mergeGeometries(subs, true); subs.forEach((x) => x.dispose());
      if (!m) return null; m.groups.forEach((gr, i) => { gr.materialIndex = parts[i].mi; }); return m;
    };
    for (let k = 0; k < 4; k++, e *= 1.7) {
      const t = run(e); if (!t) break;
      const tris = t.attributes.position.count / 3;
      if (tris <= perMesh && tris <= triBudget) { out = t; triBudget -= tris; break; }
      t.dispose();
    }
    if (!out) { stats.skipped.push([o.name || o.parent?.name, g.attributes.position.count / 3]); return; }
    stats.tess.push([o.name || o.parent?.name, g.attributes.position.count / 3, out.attributes.position.count / 3]);
    out.computeBoundingSphere(); out.boundingSphere.radius += 1.5;
    tessCache.set(g, out); o.geometry = out;
  };

  const sweep = (root, zoneFn) => {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      let figure = false; for (let q = o; q; q = q.parent) if (q.name?.startsWith('figure:')) { figure = true; break; }
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      sph.copy(o.geometry.boundingSphere).applyMatrix4(o.matrixWorld);
      const big = sph.radius > 3.5;
      const zone = zoneFn(sph.radius > 1 ? sph.center : o.getWorldPosition(tmp)); // merged meshes sit at the root origin: use their bounds
      const Z = ZONES[zone];
      const field = root === works.root ? worksWarp : storyWarp;
      const bend = !figure && warpable(o) && !(Array.isArray(o.material) ? o.material : [o.material]).some((m) => noWarp.has(m) || (m.userData.toon && !m.userData.toonOpts?.warp));
      if (bend && sph.radius > 0.4 && !(zone === 'lot' && sph.radius > 40) && !(Array.isArray(o.material) ? o.material : [o.material]).some((m) => m.userData.toon || m.userData.role === 'pipe')) tessellate(o, root === works.root ? 2.2 : 1);
      if (bend) { o.geometry.computeBoundingSphere(); o.geometry.boundingSphere.radius += 1.5; }
      const fix = (m) => {
        if (!m.isMeshStandardMaterial || m.userData.toon || m.userData.noToon) return m;
        if (shared.has(m)) { if (!clones.has(m)) { const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; clones.set(m, c); } m = clones.get(m); if (m.userData.toon) return m; }
        if (!m.map && m.color) punch(m.color, { sat: figure ? 1.25 : 1.35 });
        // the ground outside: candy-orange sand, slate blue-grey asphalt and pavement (not lavender)
        if (zone === 'lot' && big && m.map && m.color) m.color.set(sph.radius > 500 ? 0xffa066 : 0xbcc6d6);
        if (m.metalness > 0.5) { m.metalness *= 0.7; m.roughness = Math.min(1, m.roughness * 0.8); }
        if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) m.emissiveIntensity *= 1.5;
        return toonify(m, figure
          ? { rim: zone === 'backrooms' ? 0x3af0ff : 0xff7ad8, rimK: 0.5, rimP: 2.6, sat: 1.25, shade: 0x6a2a9a, shadeK: 0.35, bands: 3, soft: 0.45 }
          : { rim: Z.rim, shade: Z.shade, shadeK: Z.shadeK ?? 0.5, sat: Z.sat, rimK: big ? 0.1 : 0.42, rimP: big ? 4.5 : 3.0, bands: big ? 4 : 3,
            grad: Z.grad ?? 0, gradY0: (root === works.root ? WORKS.y : S.y) + (Z.gradY0 ?? 0), gradY1: (root === works.root ? WORKS.y : S.y) + (Z.gradY1 ?? 4),
            warp: bend ? field : null,
            peri: m.userData.role === 'pipe' ? 0.16 : 0, organ: m.userData.role === 'organ' ? 0.32 : 0 });
      };
      o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    });
  };

  const rng = mulberry32(4242);
  const alive = []; // { update(dt, t, cam), pos (world), realm }

  // ------------------------------------------------------------------ the lot: alien plants, goop boulders, eyes
  const lot = new THREE.Group(); lot.name = 'style:lot'; story.root.add(lot);
  const free = (x, z) => !(x > -44 && x < 44 && z > -6 && z < 41) && !(x > -19 && x < 19 && z > -38 && z < -11) && !(z < -36 && x > -2) && Math.hypot(x - SL.pylon.x, z - SL.pylon.z) > 5;
  const plantCols = [[PAL.teal, PAL.magenta], [PAL.violet, PAL.acid], [PAL.magenta, PAL.yellow], [0x2a9a6a, PAL.orange], [PAL.orange, PAL.teal]];
  let placed = 0;
  // a hero cluster framing Reception and the lot corners (seen from the curb)
  [[-21, -10, 1.5], [-27, -7.5, 1.2], [-33, -10, 1.7], [21, -9, 1.4], [27, -11, 1.8], [35, -8, 1.2], [47, 8, 1.6], [-48, 12, 1.5], [47, 30, 1.3], [-47, 32, 1.7]].forEach(([x, z, sc], k) => {
    const [c, p] = plantCols[k % plantCols.length];
    const pl = alienPlant({ seed: 600 + k, h: 2.6 + (k % 3) * 0.8, color: c, pod: p, glow: 1.8 });
    pl.position.set(x, 0.1, z); pl.rotation.y = k * 1.7; pl.scale.setScalar(sc); lot.add(pl);
    collision.addObstacle({ x: S.x + x, z: S.z + z, r: 0.45 * sc });
  });
  for (let i = 0; i < 400 && placed < Math.round(46 * Math.max(0.5, D)); i++) {
    const x = -90 + rng() * 180, z = -60 + rng() * 140; if (!free(x, z)) continue;
    const [c, p] = plantCols[Math.floor(rng() * plantCols.length)];
    const h = 1.6 + rng() * 3.8;
    const pl = alienPlant({ seed: 100 + i, h, color: c, pod: p, glow: 1.2 + rng() });
    pl.position.set(x, -0.05, z); pl.rotation.y = rng() * 6; const s = 0.8 + rng() * 0.9; pl.scale.setScalar(s); lot.add(pl); placed++;
    if (s * h > 3.4) collision.addObstacle({ x: S.x + x, z: S.z + z, r: 0.45 * s });
  }
  // squishy goop boulders, half sunk in the sand, a few with an eye
  const bCols = [PAL.violet, PAL.magenta, 0x2a8a9a, PAL.orange, 0x5a2a8a];
  for (let i = 0, n = 0; i < 300 && n < 26; i++) {
    const x = -110 + rng() * 220, z = -70 + rng() * 170; if (!free(x, z)) continue;
    const r = 0.8 + rng() * 2.6; const col = bCols[Math.floor(rng() * bCols.length)];
    const m = new THREE.Mesh(blobGeo(r, { seed: 300 + i, detail: 3, lump: 0.25, stretch: [1.2, 0.75, 1.0] }), toonMat(col, { roughness: 0.3, toon: { wobble: 0.05 * r, wobbleF: 1.2, breathe: 0.015, phase: rng() * 6, rim: PAL.acid, rimK: 0.55 } }));
    m.position.set(x, r * 0.25, z); m.rotation.y = rng() * 6; m.castShadow = true; m.receiveShadow = true; lot.add(m); n++;
    collision.addObstacle({ x: S.x + x, z: S.z + z, r: r * 1.05 });
    if (rng() < 0.4) { const e = new Eyeball({ r: 0.22 * r, iris: PAL.acid, lidColor: col, seed: 900 + i }); e.group.position.set(x, r * 0.25 + r * 0.55, z + r * 0.55); lot.add(e.group); alive.push({ e, p: e.group.getWorldPosition(new THREE.Vector3()), realm: 'story' }); }
  }
  // the Keatland Motors pylon watches the lot; Reception has eyes over its door
  const pinned = [];
  const eyesAt = (parent, pts, r, iris, lid) => pts.forEach((p, k) => { const e = new Eyeball({ r, iris, lidColor: lid, seed: 50 + k + Math.round(p.x * 7) }); e.group.position.copy(p); parent.add(e.group); pinned.push(e.group); alive.push({ e, p: null, realm: 'story' }); });
  { const g = new THREE.Group(); g.position.copy(SL.pylon); g.rotation.y = 0.5; story.root.add(g);
    eyesAt(g, [V(-1.1, 10.9, 0.15), V(1.1, 10.9, 0.15)], 0.55, PAL.acid, 0xc8326a);
    const lump = new THREE.Mesh(blobGeo(1.6, { seed: 77, detail: 3, lump: 0.2, stretch: [2.3, 0.7, 0.7] }), toonMat(0xc8326a, { toon: { breathe: 0.03, wobble: 0.06 } })); lump.position.set(0, 10.6, -0.2); g.add(lump); pinned.push(lump); }
  eyesAt(story.root, [V(2.6, 4.75, SL.rz1 + 0.32), V(3.9, 4.75, SL.rz1 + 0.32)], 0.38, PAL.teal, 0xff8a2a);
  { const brow = new THREE.Mesh(blobGeo(1, { seed: 12, detail: 3, lump: 0.15, stretch: [1.9, 0.32, 0.5] }), toonMat(0xff8a2a, { toon: { breathe: 0.02, wobble: 0.03 } })); brow.position.set(3.25, 5.12, SL.rz1 + 0.62); story.root.add(brow); pinned.push(brow); }

  // ------------------------------------------------------------------ the Backrooms: eyes in the wallpaper, growths, critters
  const back = story.back, br = new THREE.Group(); br.name = 'style:backrooms'; story.root.add(br);
  const walls = (back.walls || []).filter((w) => Math.hypot(w.x2 - w.x1, w.z2 - w.z1) > 2);
  const roomAt = (x, z) => back.plan.at(x, z);
  const fleshCols = [0xd6c43a, 0xc8a83a, 0xb8d04a];
  for (let i = 0, n = 0; i < 400 && walls.length && n < Math.round(34 * Math.max(0.5, D)); i++) {
    const w = walls[Math.floor(rng() * walls.length)], u = 0.1 + rng() * 0.8;
    const x = w.x1 + (w.x2 - w.x1) * u, z = w.z1 + (w.z2 - w.z1) * u;
    const vert = Math.abs(w.x2 - w.x1) < 0.01, side = rng() < 0.5 ? -1 : 1;
    const nx = vert ? side : 0, nz = vert ? 0 : side;
    const id = roomAt(x + nx * 0.6, z + nz * 0.6); if (id === null || id === 'reception' || z > -37) continue;
    const y = FLOOR + 0.5 + rng() * 2.1;
    const kind = rng();
    if (kind < 0.55) { // an eye pushing through the wallpaper, with a fleshy rim
      const r = 0.07 + rng() * 0.12, col = fleshCols[n % 3];
      const e = new Eyeball({ r, iris: [PAL.magenta, PAL.teal, PAL.acid][n % 3], lidColor: col, seed: 2000 + i });
      e.group.position.set(x + nx * r * 0.45, y, z + nz * r * 0.45); e.group.rotation.y = Math.atan2(nx, nz); br.add(e.group);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.05, r * 0.32, 8, 20), toonMat(col, { roughness: 0.4, toon: { breathe: 0.08, phase: rng() * 6, rim: PAL.magenta, rimK: 0.5 } })); ring.position.copy(e.group.position).add(V(nx * -0.01, 0, nz * -0.01)); ring.rotation.y = Math.atan2(nx, nz); br.add(ring);
      alive.push({ e, p: e.group.getWorldPosition(new THREE.Vector3()), realm: 'story', near: 16 });
    } else { // a goopy growth with glowing pustules at the foot of the wall
      const r = 0.25 + rng() * 0.35, g = new THREE.Group(); g.position.set(x + nx * r * 0.4, FLOOR, z + nz * r * 0.4); br.add(g);
      const m = toonMat([0x8a9a2a, 0x6a2a6a, 0x3a8a6a][n % 3], { roughness: 0.25, toon: { wobble: 0.04, breathe: 0.04, phase: rng() * 6, rim: PAL.acid, rimK: 0.7 } });
      const b = new THREE.Mesh(blobGeo(r, { seed: 3000 + i, detail: 2, lump: 0.3, stretch: [1.3, 0.8, 0.9] }), m); b.position.y = r * 0.4; g.add(b);
      const pm = toonMat(PAL.acid, { emissive: PAL.acid, emissiveIntensity: 1.6 });
      for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(r * (0.15 + rng() * 0.15), 10, 8), pm); p.position.set((rng() - 0.5) * r * 1.4, r * (0.5 + rng() * 0.5), (rng() - 0.5) * r * 1.2); g.add(p); }
    }
    n++;
  }
  const critters = [];
  for (const [i, p] of (back.speakerPos || []).entries()) { const c = new SpeakerCritter({ seed: 70 + i, scale: 0.55 }); c.g.position.copy(p).add(V(0, -0.2, 0)); br.add(c.g); critters.push({ c, realm: 'story' }); }

  // ------------------------------------------------------------------ the Works: eyes on the vats, critters at the horns
  const F = works.factory, wg = new THREE.Group(); wg.name = 'style:works'; works.root.add(wg);
  (F.vats || []).forEach((v, i) => {
    const toC = V(-v.x, 0, -v.z).normalize(); const yaw = Math.atan2(toC.x, toC.z);
    const g = new THREE.Group(); g.position.set(v.x + toC.x * (v.r + 0.05), 1.2 + v.h * 0.62, v.z + toC.z * (v.r + 0.05)); g.rotation.y = yaw; wg.add(g);
    const lid = [PAL.magenta, PAL.orange, PAL.violet, 0xff3a3a, PAL.yellow, PAL.teal][i % 6];
    for (const s of [-1, 1]) { const e = new Eyeball({ r: 0.55, iris: PAL.acid, lidColor: lid, seed: 4000 + i * 2 + s }); e.group.position.set(s * 0.8, 0, 0); g.add(e.group); alive.push({ e, p: e.group.getWorldPosition(new THREE.Vector3()), realm: 'works', near: 60 }); }
  });
  for (const [i, p] of (F.speakers || []).entries()) { const c = new SpeakerCritter({ seed: 170 + i, scale: 1.4, body: [PAL.violet, PAL.magenta, 0x2a8a9a][i % 3] }); c.g.position.copy(p).add(V(0, 0.3, 0)); c.g.lookAt(V(0, p.y - 2, 0).add(works.root.position)); wg.add(c.g); critters.push({ c, realm: 'works' }); }

  // ------------------------------------------------------------------ second pass: remodelled architecture
  const sw = { warp: storyWarp }, ww = { warp: worksWarp };
  const followers = []; // props stuck to warped surfaces ride the field: { o, base (local), w (world at rest), W, realm }
  const follow = (o, W, realm) => { o.updateWorldMatrix(true, false); const q = o.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); followers.push({ o, base: o.position.clone(), w: o.getWorldPosition(new THREE.Vector3()), W, realm, q, s: (o.parent?.matrixWorld.getMaxScaleOnAxis() || 1) }); };
  // Reception: a bulbous, soft-edged building. Fat rolls round every top edge and down every corner
  // turn the stucco box into a pillow; the roof swells into a rounded cushion; a puffy lip over the door.
  {
    const rg = new THREE.Group(); rg.name = 'style:reception'; story.root.add(rg);
    const { rx0, rx1, rz0, rz1, rH } = SL; const zc = (rz0 + rz1) / 2;
    const roll = toonMat(0xf4b48a, { roughness: 0.6, toon: { ...sw, rim: PAL.teal, rimK: 0.35, grad: 0.6, gradY0: S.y, gradY1: S.y + 6 } });
    const cushion = toonMat(0xff9aa8, { roughness: 0.5, toon: { ...sw, rim: PAL.teal, rimK: 0.4, breathe: 0 } });
    const capsule = (r, len, seg) => new THREE.CapsuleGeometry(r, len, Math.max(4, Math.round(8 * D)), Math.max(12, Math.round(seg * D)), Math.max(6, Math.round(len * 2.2 * D)));
    const add = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); m.castShadow = true; m.receiveShadow = true; rg.add(m); return m; };
    const R = 0.62;
    // top-edge rolls (front/back along x, sides along z)
    add(capsule(R, rx1 - rx0, 20), roll, 0, rH + 0.1, rz1 + 0.12, 0, Math.PI / 2).castShadow = false;
    add(capsule(R, rx1 - rx0, 20), roll, 0, rH + 0.1, rz0 - 0.12, 0, Math.PI / 2);
    add(capsule(R, rz1 - rz0, 20), roll, rx0 - 0.12, rH + 0.1, zc, Math.PI / 2, 0);
    add(capsule(R, rz1 - rz0, 20), roll, rx1 + 0.12, rH + 0.1, zc, Math.PI / 2, 0);
    // corner columns, fattest at the foot like they are settling
    const colGeo = new THREE.LatheGeometry(Array.from({ length: 14 }, (_, i) => { const t = i / 13; return new THREE.Vector2(0.001 + R * (1.35 - 0.45 * t + 0.12 * Math.sin(t * 9)) * Math.sin(Math.min(1, t * 6 + 0.25) * Math.PI / 2), t * (rH + 0.2)); }), Math.max(14, Math.round(26 * D)));
    for (const [x, z] of [[rx0, rz1], [rx1, rz1], [rx0, rz0], [rx1, rz0]]) { add(colGeo, roll, x, 0, z); collision.addObstacle({ x: S.x + x, z: S.z + z, r: R * 1.3 }); }
    // pillowy roof
    add(new RoundedBoxGeometry(rx1 - rx0 + 0.6, 1.3, rz1 - rz0 + 0.6, Math.max(3, Math.round(6 * D)), 0.6), cushion, 0, rH + 0.45, zc);
    // a puffy lip over the door and fat sills on the windows
    const lip = add(blobGeo(1, { seed: 31, detail: D >= 0.8 ? 4 : 3, lump: 0.12, stretch: [1.75, 0.3, 0.6] }), toonMat(0xff6aa8, { roughness: 0.35, toon: { ...sw, breathe: 0.03, rim: PAL.acid, rimK: 0.5 } }), (SL.door[0] + SL.door[1]) / 2, 2.95, rz1 + 0.35);
    lip.castShadow = true;
    for (const [a, b, y] of [[SL.window1[0], SL.window1[1], 0.85], [SL.window2[0], SL.window2[1], 1.0]]) add(capsule(0.2, b - a, 14), roll, (a + b) / 2, y, rz1 + 0.2, 0, Math.PI / 2);
  }
  // the pylon goes goopy: the warp hot-spot bends its legs; goo drips off the sign box and pools round its feet
  {
    const g = new THREE.Group(); g.position.copy(SL.pylon); g.rotation.y = 0.5; story.root.add(g);
    const goo = toonMat(0xd8327a, { roughness: 0.18, toon: { ...sw, wobble: 0.05, wobbleF: 1.6, breathe: 0.02, rim: PAL.acid, rimK: 0.6 } });
    for (let i = 0; i < 7; i++) { const x = -2.4 + i * 0.8 + (rng() - 0.5) * 0.3, L = 0.6 + rng() * 1.6; const d = new THREE.Mesh(blobGeo(0.28, { seed: 500 + i, detail: 2, lump: 0.1, stretch: [1, L / 0.28 * 0.5, 1] }), goo); d.position.set(x, 9.35 - L * 0.45, (rng() - 0.5) * 0.4); g.add(d); }
    const pool = new THREE.Mesh(blobGeo(1.2, { seed: 509, detail: 3, lump: 0.2, stretch: [2.6, 0.18, 1.7] }), goo); pool.position.set(0, 0.04, 0); g.add(pool);
  }
  // the Backrooms ceilings sag and drip
  {
    const drip = toonMat(0xc8c44a, { roughness: 0.22, toon: { ...sw, wobble: 0.03, breathe: 0.05, rim: PAL.acid, rimK: 0.6 } });
    for (let i = 0, n = 0; i < 300 && walls.length && n < Math.round(26 * Math.max(0.5, D)); i++) {
      const w = walls[Math.floor(rng() * walls.length)], u = 0.1 + rng() * 0.8;
      const x = w.x1 + (w.x2 - w.x1) * u, z = w.z1 + (w.z2 - w.z1) * u; const vert = Math.abs(w.x2 - w.x1) < 0.01, side = rng() < 0.5 ? -1 : 1;
      const px = x + (vert ? side * 0.25 : 0), pz = z + (vert ? 0 : side * 0.25);
      const id = roomAt(px, pz); if (id === null || id === 'reception' || pz > -37) continue;
      const L = 0.25 + rng() * 0.55;
      const d = new THREE.Mesh(blobGeo(0.13 + rng() * 0.08, { seed: 5200 + i, detail: 2, lump: 0.15, stretch: [1, L * 4, 1] }), drip); d.position.set(px, FLOOR + 2.8 - L * 0.25, pz); br.add(d); n++;
    }
  }
  // the factory: fleshy rib arches vault the hall (well above the catwalks), lumpy flesh collars on the vats
  {
    const flesh = toonMat(0xe8607a, { roughness: 0.3, emissive: 0x5a0a2a, emissiveIntensity: 0.4, toon: { ...ww, organ: 0.18, rim: PAL.teal, rimK: 0.55, shade: 0x4a1a8a } });
    const n = D >= 0.8 ? 7 : 4;
    for (let i = 0; i < n; i++) {
      const z = -30 + (i + 0.5) * (60 / n);
      const pts = []; for (let k = 0; k <= 24; k++) { const a = (k / 24) * Math.PI; pts.push(V(Math.cos(a) * 31.5, 22.5 + Math.sin(a) * 5.2 + Math.sin(a * 6) * 0.35, z + Math.sin(a * 3 + i) * 0.6)); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.round(70 * D), 0.75, Math.round(14 * D) + 4, false), flesh);
      tube.castShadow = false; wg.add(tube);
      for (const s of [-1, 1]) { const k = new THREE.Mesh(blobGeo(1.5, { seed: 7000 + i * 2 + s, detail: 2, lump: 0.25, stretch: [0.8, 1.6, 1.1] }), flesh); k.position.set(s * 31.6, 22.2, z); wg.add(k); }
    }
    (F.vats || []).forEach((v, i) => {
      const c = new THREE.Mesh(new THREE.TorusGeometry(v.r + 0.08, 0.32, Math.round(10 * D) + 4, Math.round(40 * D) + 8), flesh); c.rotation.x = Math.PI / 2; c.position.set(v.x, 1.0 + v.h * 0.18, v.z); wg.add(c);
    });
  }
  // props pinned to walls ride the warp (eyes, rings, growths and drips in the Backrooms; Reception's door eyes)
  const rides = (o) => { let w = false; o.traverse((q) => { if (q.material?.userData?.toonOpts?.warp) w = true; }); return !w; }; // already bent by the shader
  for (const o of [...br.children, ...pinned]) if (rides(o)) follow(o, storyWarp, 'story');
  wg.children.forEach((o) => { if (rides(o)) follow(o, worksWarp, 'works'); });

  // the goo: deep and saturated under the hall lights instead of pastel (strong saturation, violet shadows, magenta rim)
  if (works.flood?.surface?.material) toonify(works.flood.surface.material, { rim: PAL.magenta, rimK: 0.22, rimP: 3.5, sat: 1.85, shade: 0x1a0a5a, shadeK: 0.6, bands: 4, soft: 0.7 });

  // sweep after dressing so the new pieces get zone rims too (already-toon materials are skipped)
  sweep(story.root, (p) => zoneOfStory(p));
  sweep(works.root, () => 'works');

  return {
    lot, backrooms: br, works: wg, stats,
    update(dt, t, camera, realm) {
      TOON.time.value = t;
      PA.talk = Math.max(0, PA.talk - dt);
      if (realm !== 'story' && realm !== 'works') return;
      for (const f of followers) { if (f.realm !== realm) continue; warpAt(f.W, f.w, t, tmp); f.o.position.copy(f.base).addScaledVector(tmp.applyQuaternion(f.q), 1 / f.s); }
      const cw = camera.position;
      for (const a of alive) {
        if (a.realm !== realm) continue;
        if (a.p && a.p.distanceToSquared(cw) > (a.near ?? 90) ** 2) continue;
        a.e.update(dt, t, cw);
      }
      for (const { c, realm: r } of critters) if (r === realm) c.update(dt, t, cw);
    },
  };
}
