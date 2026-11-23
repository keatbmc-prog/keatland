// The story realm's art-direction pass (High-on-Life-ish): runs once after the realm is built.
//  1. Sweeps every MeshStandardMaterial under the story and Works roots into the toon kit with
//     per-zone rim / shadow colours (materials shared with the hub are cloned first, so the hub,
//     the gallery and the jungle are untouched).
//  2. Dresses each zone with "alive" organic pieces: goopy alien plants and boulders round the lot,
//     eyes on the Keatland Motors pylon and over the Reception door, eyes and fleshy growths in the
//     Backrooms wallpaper, eyes on the Works vats, and Yesterkeat's speaker critters in both.
// update(dt, t, camera, realm) animates the shared toon time, the eyes and the critters.
import * as THREE from 'three';
import { toonify, TOON, PA, punch } from './toon.js';
import { alienPlant, blobGeo, toonMat, Eyeball, SpeakerCritter, PAL } from './goop.js';
import { S, SL, FLOOR } from '../layout.js';
import { mulberry32 } from '../../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

const ZONES = {
  lot: { rim: 0xff6ad0, shade: 0x5a2aa0, sat: 1.4 },
  reception: { rim: 0x3ef0ff, shade: 0x6a2a90, sat: 1.35 },
  backrooms: { rim: 0xb4ff3a, shade: 0x9a9a3a, sat: 1.3, shadeK: 0.2 }, // stays yellowed and liminal, just more alive
  works: { rim: 0x30e8ff, shade: 0x4a1a8a, sat: 1.35 },
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
      const fix = (m) => {
        if (!m.isMeshStandardMaterial || m.userData.toon || m.userData.noToon) return m;
        if (shared.has(m)) { if (!clones.has(m)) { const c = m.clone(); c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; clones.set(m, c); } m = clones.get(m); if (m.userData.toon) return m; }
        if (!m.map && m.color) punch(m.color, { sat: figure ? 1.25 : 1.35 });
        // the ground outside: candy-orange sand, lavender asphalt and pavement
        if (zone === 'lot' && big && m.map && m.color) m.color.set(sph.radius > 500 ? 0xffa066 : 0xc0a0f0);
        if (m.metalness > 0.5) { m.metalness *= 0.7; m.roughness = Math.min(1, m.roughness * 0.8); }
        if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0) m.emissiveIntensity *= 1.5;
        return toonify(m, figure
          ? { rim: zone === 'backrooms' ? 0x3af0ff : 0xff7ad8, rimK: 0.5, rimP: 2.6, sat: 1.25, shade: 0x6a2a9a, shadeK: 0.35, bands: 3, soft: 0.45 }
          : { rim: Z.rim, shade: Z.shade, shadeK: Z.shadeK ?? 0.5, sat: Z.sat, rimK: big ? 0.1 : 0.42, rimP: big ? 4.5 : 3.0, bands: big ? 4 : 3 });
      };
      o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material);
    });
  };

  const rng = mulberry32(4242);
  const alive = []; // { update(dt, t, cam), pos (world), realm }
  const D = quality.detail;

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
  const eyesAt = (parent, pts, r, iris, lid) => pts.forEach((p, k) => { const e = new Eyeball({ r, iris, lidColor: lid, seed: 50 + k + Math.round(p.x * 7) }); e.group.position.copy(p); parent.add(e.group); alive.push({ e, p: null, realm: 'story' }); });
  { const g = new THREE.Group(); g.position.copy(SL.pylon); g.rotation.y = 0.5; story.root.add(g);
    eyesAt(g, [V(-1.1, 10.9, 0.15), V(1.1, 10.9, 0.15)], 0.55, PAL.acid, 0xc8326a);
    const lump = new THREE.Mesh(blobGeo(1.6, { seed: 77, detail: 3, lump: 0.2, stretch: [2.3, 0.7, 0.7] }), toonMat(0xc8326a, { toon: { breathe: 0.03, wobble: 0.06 } })); lump.position.set(0, 10.6, -0.2); g.add(lump); }
  eyesAt(story.root, [V(2.6, 4.75, SL.rz1 + 0.32), V(3.9, 4.75, SL.rz1 + 0.32)], 0.38, PAL.teal, 0xff8a2a);
  { const brow = new THREE.Mesh(blobGeo(1, { seed: 12, detail: 3, lump: 0.15, stretch: [1.9, 0.32, 0.5] }), toonMat(0xff8a2a, { toon: { breathe: 0.02, wobble: 0.03 } })); brow.position.set(3.25, 5.35, SL.rz1 + 0.25); story.root.add(brow); }

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

  // sweep after dressing so the new pieces get zone rims too (already-toon materials are skipped)
  sweep(story.root, (p) => zoneOfStory(p));
  sweep(works.root, () => 'works');

  return {
    lot, backrooms: br, works: wg,
    update(dt, t, camera, realm) {
      TOON.time.value = t;
      PA.talk = Math.max(0, PA.talk - dt);
      if (realm !== 'story' && realm !== 'works') return;
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
