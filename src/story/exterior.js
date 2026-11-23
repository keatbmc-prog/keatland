// Outside Keatland Reception: a sun-bleached parking lot in the desert. Cracked asphalt with faded
// stalls, the valet lane and the empty curb where the car was, the lonely lectern that turned out
// not to be a valet podium, rusted lamp posts, the Keatland Motors pylon, a road with power poles,
// scrub, a stand of cottonwoods to the west (where the wind moves through the trees, and where the
// voice comes from), and Moss, standing at the curb holding a catalytic converter.
import * as THREE from 'three';
import { S, SL, FLOOR } from './layout.js';
import { V, std, box, cyl, tiledBox, rustMat } from './kit.js';
import { asphaltTexture, sandTexture, stuccoTexture, signTexture, signPlane, woodTexture, rngOf } from './paint.js';
import { mesaRing } from './sky.js';
import { sweepGeometry } from '../geometry/sweep.js';
import { merge } from '../geometry/generators.js';
import { fbm3 } from '../core/noise.js';
import { canvasTexture } from '../materials/textures.js';
import { Figure, catalyticConverter } from './figures.js';
import { SIGNS } from '../data/storyLines.js';
import { U } from '../materials/library.js';

const LOT = { x0: -44, x1: 44, z0: -13, z1: 53 };
const inBuildings = (x, z) => x > -19 && x < 100 && z < -8 && z > -102;

/** wind sway for foliage cards / tufts (object-space y drives the amplitude) */
function windy(mat, amp = 0.08, key = 'kl-story-wind') {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTimeW = U.time;
    sh.vertexShader = 'uniform float uTimeW;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 wp0 = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
      #else
        vec3 wp0 = vec3(0.0);
      #endif
      float sw = sin(uTimeW * 1.3 + wp0.x * 0.4 + wp0.z * 0.3) * 0.6 + sin(uTimeW * 2.9 + wp0.x) * 0.4;
      transformed.x += sw * ${amp.toFixed(3)} * max(0.0, position.y);
      transformed.z += sw * ${(amp * 0.6).toFixed(3)} * max(0.0, position.y);`);
  };
  mat.customProgramCacheKey = () => key + amp;
  return mat;
}

export function buildExterior({ root, mats, quality, collision }) {
  const D = quality.detail, rng = rngOf(77);
  const W = (x, z) => ({ x: S.x + x, z: S.z + z });
  const obstacle = (x, z, r) => { const w = W(x, z); return collision.addObstacle({ x: w.x, z: w.z, r }); };

  // ---------------------------------------------------------------- ground: desert, lot, sidewalk, road
  const sand = sandTexture(); sand.repeat.set(160, 160);
  const desertG = new THREE.PlaneGeometry(2400, 2400, 120, 120); desertG.rotateX(-Math.PI / 2);
  { const p = desertG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z + 20); const k = THREE.MathUtils.smoothstep(d, 70, 260); p.setY(i, -0.05 + k * (6 * fbm3(x * 0.004, 0.5, z * 0.004, 3) + 2.5 * fbm3(x * 0.02, 1.5, z * 0.02, 2))); } desertG.computeVertexNormals(); }
  const desert = new THREE.Mesh(desertG, std({ map: sand, color: 0xe8d2b0, roughness: 1 })); desert.receiveShadow = true; root.add(desert);

  const paintLines = (g, m) => {
    const X = (x) => (x - LOT.x0) * m, Z = (z) => (z - LOT.z0) * m;
    g.strokeStyle = 'rgba(236,232,220,0.62)'; g.lineWidth = 0.13 * m;
    for (const [z0, z1] of [[6, 11.5], [11.5, 17], [27, 32.5], [32.5, 38]]) for (let x = -40; x <= 40; x += 2.8) { g.beginPath(); g.moveTo(X(x), Z(z0)); g.lineTo(X(x), Z(z1)); g.stroke(); }
    g.beginPath(); g.moveTo(X(-40), Z(11.5)); g.lineTo(X(40), Z(11.5)); g.moveTo(X(-40), Z(32.5)); g.lineTo(X(40), Z(32.5)); g.stroke();
    // valet lane: yellow hatching + the words
    g.strokeStyle = 'rgba(222,186,70,0.55)'; g.lineWidth = 0.12 * m;
    g.beginPath(); g.moveTo(X(-14), Z(-3)); g.lineTo(X(14), Z(-3)); g.stroke();
    for (let x = 8; x < 14; x += 1.2) { g.beginPath(); g.moveTo(X(x), Z(-3)); g.lineTo(X(x + 1.6), Z(-8.9)); g.stroke(); }
    g.fillStyle = 'rgba(236,232,220,0.6)'; g.font = `600 ${Math.round(0.9 * m)}px Oswald`; g.textAlign = 'center';
    g.save(); g.translate(X(-1), Z(-4.2)); g.scale(1, 1.6); g.fillText(SIGNS.curbPaint, 0, 0); g.restore();
    // arrows
    g.fillStyle = 'rgba(236,232,220,0.5)';
    for (const [x, z, a] of [[-20, 22, 0], [20, 22, Math.PI], [0, 2, -Math.PI / 2]]) { g.save(); g.translate(X(x), Z(z)); g.rotate(a); g.beginPath(); g.moveTo(-1.6 * m, -0.2 * m); g.lineTo(0.6 * m, -0.2 * m); g.lineTo(0.6 * m, -0.6 * m); g.lineTo(1.6 * m, 0); g.lineTo(0.6 * m, 0.6 * m); g.lineTo(0.6 * m, 0.2 * m); g.lineTo(-1.6 * m, 0.2 * m); g.fill(); g.restore(); }
    // the oil stain where the car was
    const ox = X(SL.emptySpot.x), oz = Z(SL.emptySpot.z);
    for (let i = 0; i < 6; i++) { const r = (0.5 + i * 0.25) * m; const gr = g.createRadialGradient(ox + i * 4, oz - i * 3, 0, ox, oz, r); gr.addColorStop(0, 'rgba(18,16,14,0.45)'); gr.addColorStop(1, 'rgba(18,16,14,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(ox, oz, r * 1.4, r, 0.2, 0, 7); g.fill(); }
  };
  const lotW = LOT.x1 - LOT.x0, lotD = LOT.z1 - LOT.z0, metres = Math.max(lotW, lotD);
  const asphalt = asphaltTexture({ size: quality.detail >= 0.8 ? 2048 : 1024, metres, paintLines });
  const lotG = new THREE.PlaneGeometry(lotW, lotD); lotG.rotateX(-Math.PI / 2);
  { const uv = lotG.attributes.uv, p = lotG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + lotW / 2) / metres, 1 - (p.getZ(i) + lotD / 2) / metres); }
  const lot = new THREE.Mesh(lotG, std({ map: asphalt, roughness: 0.93, color: 0xffffff })); lot.position.set((LOT.x0 + LOT.x1) / 2, 0.01, (LOT.z0 + LOT.z1) / 2); lot.receiveShadow = true; root.add(lot);
  // ragged lot edge: sand drifts over the asphalt
  {
    const drift = canvasTexture(512, 64, (g, w, h) => { const r = rngOf(5); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(196,165,124,0)'); gr.addColorStop(1, 'rgba(196,165,124,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(196,165,124,${r()})`; g.beginPath(); g.ellipse(r() * w, h * (0.3 + r() * 0.7), 3 + r() * 20, 2 + r() * 6, 0, 0, 7); g.fill(); } }, { repeat: [12, 1] });
    const dm = std({ map: drift, transparent: true, depthWrite: false, roughness: 1, color: 0xe8d2b0 });
    for (const [x, z, w, rot] of [[0, LOT.z1, lotW, 0], [0, LOT.z0 - 0.0, 30, Math.PI], [LOT.x0, 20, lotD, -Math.PI / 2], [LOT.x1, 20, lotD, Math.PI / 2]]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 3.5), dm); p.rotation.set(-Math.PI / 2, 0, rot); p.position.set(x - Math.sin(rot) * 1.6, 0.02, z - Math.cos(rot) * 1.6); p.receiveShadow = true; root.add(p);
    }
  }
  // sidewalk + curb (the curb where I left my car)
  const concrete = stuccoTexture(41, '#c8bfae'); concrete.repeat.set(1, 1);
  const cm = std({ map: concrete, roughness: 0.95 });
  const walk = tiledBox(36, FLOOR, 5.2, cm, 3); walk.position.set(0, FLOOR / 2, -11.6); root.add(walk);
  const curbM = std({ color: 0xc9b46a, roughness: 0.9 });
  const curb = box(28.4, FLOOR + 0.02, 0.25, curbM, 0, (FLOOR + 0.02) / 2, -9.1); root.add(curb);
  // expansion joints
  for (let x = -17; x <= 17; x += 2) box(0.03, 0.01, 5.2, std({ color: 0x6d655a }), x, FLOOR + 0.002, -11.6, { parent: root, cast: false });
  // road + centre line
  const roadTex = asphaltTexture({ size: 512, metres: 40, seed: 19, paintLines: (g, m) => { g.fillStyle = 'rgba(210,180,60,0.5)'; for (let x = 0; x < 40; x += 6) g.fillRect(x * m, 19.6 * m, 3 * m, 0.25 * m); } });
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(40, 0.3);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1600, 12), std({ map: roadTex, roughness: 0.95 })); road.rotation.x = -Math.PI / 2; road.position.set(0, 0.015, 66); road.receiveShadow = true; root.add(road);
  // a driveway from the road to the lot
  const drive = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), std({ map: asphalt, roughness: 0.95 })); drive.rotation.x = -Math.PI / 2; drive.position.set(8, 0.012, 57); drive.receiveShadow = true; root.add(drive);

  // ground provider: the lot/desert (walkable out to ~110 m), the sidewalk and floors are 0.15 up
  collision.addGround((x, z) => {
    const lx = x - S.x, lz = z - S.z;
    if (Math.hypot(lx, lz + 20) > 115) return null;
    if (lz < -9 && lz > -14.2 && Math.abs(lx) < 18) return S.y + FLOOR;
    return S.y;
  });

  // ---------------------------------------------------------------- the lectern ("valet podium")
  const lectern = new THREE.Group(); lectern.position.copy(SL.lectern); lectern.rotation.y = 0.35; root.add(lectern);
  {
    const wood = std({ map: woodTexture(15, '#6b4a2c'), roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.4, 1.05, 4, 1), wood); body.rotation.y = Math.PI / 4; body.scale.set(1.15, 1, 0.8); body.position.y = 0.6; body.castShadow = true; lectern.add(body);
    box(0.62, 0.06, 0.5, wood, 0, 0.06, 0, { parent: lectern });
    const top = box(0.72, 0.05, 0.52, wood, 0, 1.17, 0.02, { parent: lectern }); top.rotation.x = 0.28;
    box(0.72, 0.04, 0.05, wood, 0, 1.12, 0.27, { parent: lectern });
    const placard = signPlane(signTexture([SIGNS.valetPlacard], { w: 512, h: 192, bg: '#f2e6c8', fg: '#1d2a44', font: 'Oswald', weight: '700', weather: 0.9, border: 10, seed: 3 }), 0.5, 0.19);
    placard.position.set(0, 0.86, 0.32); placard.rotation.x = -0.05; lectern.add(placard);
    // tape corners
    for (const sx of [-1, 1]) { const t = box(0.07, 0.025, 0.002, std({ color: 0xd8d0b0, transparent: true, opacity: 0.8 }), sx * 0.24, 0.95, 0.323, { parent: lectern }); t.rotation.z = sx * 0.6; }
    const sticky = signPlane(signTexture(SIGNS.valetSticky, { w: 256, h: 256, bg: '#f6e27a', fg: '#2a2a50', font: 'Caveat', weight: '700', weather: 0.3, seed: 8, rotate: -0.08 }), 0.12, 0.12);
    sticky.position.set(0.2, 0.68, 0.315); sticky.rotation.z = 0.12; lectern.add(sticky);
    // an empty key board on the lectern top
    const kb = box(0.3, 0.2, 0.015, std({ color: 0x3a2a1a }), -0.12, 1.25, -0.08, { parent: lectern }); kb.rotation.x = 0.28;
    for (let i = 0; i < 6; i++) { const h = cyl(0.004, 0.004, 0.03, std({ color: 0xb0a080, metalness: 0.8, roughness: 0.3 }), -0.22 + (i % 3) * 0.1, 1.3 - Math.floor(i / 3) * 0.08, -0.06, { parent: lectern, seg: 5 }); h.rotation.x = Math.PI / 2; }
    lectern.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  obstacle(SL.lectern.x, SL.lectern.z, 0.45);

  // ---------------------------------------------------------------- the empty curb: glass, a bolt, nothing
  {
    const glass = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.03, 0.025), std({ color: 0xcfe6e0, metalness: 0.2, roughness: 0.05, envMapIntensity: 2 }), 140);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < 140; i++) { const a = rng() * 6.28, r = Math.pow(rng(), 0.6) * 1.4; e.set(-Math.PI / 2 + (rng() - 0.5) * 0.4, rng() * 6, 0); q.setFromEuler(e); const s = 0.5 + rng() * 1.5; m4.compose(V(SL.emptySpot.x + 1.1 + Math.cos(a) * r, 0.02, SL.emptySpot.z + 0.8 + Math.sin(a) * r * 0.6), q, V(s, s, s)); glass.setMatrixAt(i, m4); }
    glass.receiveShadow = true; root.add(glass);
    const bolt = cyl(0.012, 0.012, 0.06, std({ color: 0x777777, metalness: 0.9, roughness: 0.4 }), SL.emptySpot.x - 0.6, 0.02, SL.emptySpot.z + 0.5, { parent: root, seg: 6 }); bolt.rotation.z = Math.PI / 2;
  }

  // ---------------------------------------------------------------- Moss at the curb with the converter
  const moss = new Figure('moss', { seed: 3 });
  moss.group.position.copy(SL.moss); moss.group.rotation.y = Math.PI * 0.78; // looking at the empty spot
  moss.pose = 'hold';
  const conv = catalyticConverter(); moss.hold(conv, 'R', V(-0.12, -0.12, 0.1)); conv.rotation.set(0, 0.3, 0.2);
  root.add(moss.group); obstacle(SL.moss.x, SL.moss.z, 0.35);

  // ---------------------------------------------------------------- lamp posts (rusted, double heads)
  const rust = rustMat(0x6a4630), dark = std({ color: 0x2d2a26, roughness: 0.6, metalness: 0.6 });
  for (const [x, z] of [[-22, 11.5], [22, 11.5], [0, 32.5], [-34, 32.5], [34, 32.5], [-12, -2]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    cyl(0.75, 0.85, 0.7, std({ color: 0xb8ad98, roughness: 1 }), 0, 0.35, 0, { parent: g });
    cyl(0.09, 0.13, 9.5, rust, 0, 5.1, 0, { parent: g, seg: 10 });
    box(2.4, 0.12, 0.12, rust, 0, 9.7, 0, { parent: g });
    for (const s of [-1, 1]) { const h = box(0.7, 0.18, 0.35, dark, s * 1.2, 9.6, 0, { parent: g }); h.rotation.z = s * -0.05; }
    obstacle(x, z, 0.85);
  }

  // ---------------------------------------------------------------- the Keatland Motors pylon
  {
    const g = new THREE.Group(); g.position.copy(SL.pylon); g.rotation.y = 0.5; root.add(g);
    const beam = rustMat(0x7a5236);
    for (const s of [-1, 1]) { box(0.28, 10.5, 0.28, beam, s * 2.2, 5.25, 0, { parent: g }); }
    const cab = box(5.6, 2.4, 0.5, std({ color: 0x8a2a20, roughness: 0.6, metalness: 0.3 }), 0, 9.0, 0, { parent: g });
    const face = signTexture(SIGNS.motorsPylon, { w: 1024, h: 440, bg: '#efe3c4', fg: '#a3261c', font: 'Rye', weather: 0.8, seed: 12, sizes: [1, 1], border: 14 });
    for (const s of [1, -1]) { const f = signPlane(face, 5.3, 2.2, { roughness: 0.7 }); f.position.set(0, 9.0, s * 0.26); if (s < 0) f.rotation.y = Math.PI; g.add(f); }
    const board = signTexture(SIGNS.motorsLetterBoard, { w: 1024, h: 300, bg: '#f4f1e6', fg: '#141414', font: 'Oswald', weight: '600', weather: 0.6, seed: 13, border: 12, borderColor: '#2a2a2a' });
    box(5.0, 1.5, 0.3, std({ color: 0x2b2b2b, roughness: 0.5, metalness: 0.5 }), 0, 6.8, 0, { parent: g });
    for (const s of [1, -1]) { const f = signPlane(board, 4.8, 1.35, { roughness: 0.6 }); f.position.set(0, 6.8, s * 0.16); if (s < 0) f.rotation.y = Math.PI; g.add(f); }
    // a bird's nest in the frame
    const nest = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.08, 6, 12), std({ color: 0x6b5a3a, roughness: 1 })); nest.rotation.x = Math.PI / 2; nest.position.set(-2.2, 10.35, 0); g.add(nest);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const a = Math.cos(0.5), b = Math.sin(0.5);
    obstacle(SL.pylon.x + a * 2.2, SL.pylon.z - b * 2.2, 0.35); obstacle(SL.pylon.x - a * 2.2, SL.pylon.z + b * 2.2, 0.35);
  }
  // little sign posts
  const post = (x, z, ry, lines, o = {}) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    cyl(0.03, 0.03, 2.4, std({ color: 0x9a9a94, metalness: 0.8, roughness: 0.4 }), 0, 1.2, 0, { parent: g, seg: 8 });
    const p = signPlane(signTexture(lines, { w: 512, h: 512, weather: 0.8, seed: Math.round(x * 13), ...o }), 0.62, 0.62); p.position.set(0, 2.05, 0.035); g.add(p);
    const back = box(0.62, 0.62, 0.02, std({ color: 0x8a8a86, metalness: 0.7, roughness: 0.5 }), 0, 2.05, 0.02, { parent: g });
    obstacle(x, z, 0.15); return g;
  };
  post(-14.5, -8.4, 0.2, SIGNS.lotSign, { bg: '#1f4f8a', fg: '#f2efe6', font: 'Oswald', weight: '600', sizes: [1.2, 0.8, 0.8] });
  post(12.5, -8.4, -0.15, SIGNS.riskSign, { bg: '#f2efe6', fg: '#a3261c', font: 'Oswald', weight: '600', border: 10 });

  // ---------------------------------------------------------------- power poles + wires along the road
  {
    const wood = std({ color: 0x5a4632, roughness: 0.95 });
    const poles = [];
    for (let x = -420; x <= 420; x += 42) {
      const g = new THREE.Group(); g.position.set(x, 0, 74); root.add(g);
      cyl(0.13, 0.17, 10, wood, 0, 5, 0, { parent: g, seg: 8 }); box(2.2, 0.14, 0.14, wood, 0, 9.3, 0, { parent: g });
      poles.push(x);
    }
    const wm = std({ color: 0x1c1a18, roughness: 0.6 });
    const segs = [];
    for (let i = 0; i < poles.length - 1; i++) for (const dx of [-0.9, 0, 0.9]) {
      const a = V(poles[i] + dx * 0, 9.35, 74 + dx), b = V(poles[i + 1], 9.35, 74 + dx);
      const pts = []; for (let k = 0; k <= 10; k++) { const t = k / 10; const p = a.clone().lerp(b, t); p.y -= Math.sin(t * Math.PI) * 0.9; pts.push(p); }
      segs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.018, 3));
    }
    root.add(new THREE.Mesh(merge(segs), wm));
  }

  // ---------------------------------------------------------------- the treeline (cottonwoods + dead trees)
  const bark = std({ color: 0x6b5d4d, roughness: 0.95 });
  const leafTex = canvasTexture(256, 256, (g, w, h) => {
    const r = rngOf(9); g.clearRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { const x = w / 2 + (r() - 0.5) * w * 0.85, y = h / 2 + (r() - 0.5) * h * 0.85; const c = 80 + r() * 50; g.fillStyle = `rgb(${c * 0.85},${c},${c * 0.55})`; g.beginPath(); g.ellipse(x, y, 7 + r() * 8, 4 + r() * 5, r() * 6, 0, 7); g.fill(); }
  }, { wrap: false });
  const leafMat = windy(std({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: 0xc9cfa0 }), 0.05, 'kl-story-leaves');
  const branchGeos = [], cards = [];
  const T = SL.treeline;
  const trees = [];
  const nTrees = Math.round(26 * D) + 8;
  for (let i = 0; i < nTrees; i++) {
    const x = T.x0 + rng() * (T.x1 - T.x0), z = T.z0 + rng() * (T.z1 - T.z0);
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    const dead = rng() < 0.22, H = 9 + rng() * 7;
    trees.push({ x, z, H, dead });
    const grow = (p, d, len, r, depth) => {
      const pts = [p.clone()]; const dir = d.clone();
      for (let k = 1; k <= 5; k++) { dir.add(V((rng() - 0.5) * 0.35, 0.05, (rng() - 0.5) * 0.35)).normalize(); pts.push(pts[k - 1].clone().addScaledVector(dir, len / 5)); }
      branchGeos.push(sweepGeometry(new THREE.CatmullRomCurve3(pts), { tubular: 10, radial: 6, radius: (t) => r * (1 - t * 0.7), noise: 0.15, noiseScale: 1.5 }));
      const end = pts[5];
      if (depth > 0) { const n = 2 + Math.floor(rng() * 2); for (let k = 0; k < n; k++) { const nd = dir.clone().add(V((rng() - 0.5) * 1.6, 0.25 + rng() * 0.5, (rng() - 0.5) * 1.6)).normalize(); grow(pts[3 + Math.floor(rng() * 3) - 1].clone(), nd, len * (0.55 + rng() * 0.2), r * 0.6, depth - 1); } }
      else if (!dead) for (let k = 0; k < 9; k++) cards.push({ p: end.clone().add(V((rng() - 0.5) * 2.6, (rng() - 0.3) * 1.8, (rng() - 0.5) * 2.6)), s: 1.6 + rng() * 1.6, r: rng() * 6 });
    };
    grow(V(x, -0.2, z), V((rng() - 0.5) * 0.2, 1, (rng() - 0.5) * 0.2), H * 0.45, 0.35 + rng() * 0.2, 3);
    obstacle(x, z, 0.5);
  }
  const branches = new THREE.Mesh(merge(branchGeos), bark); branches.castShadow = true; branches.receiveShadow = true; root.add(branches);
  if (cards.length) {
    const cg = new THREE.PlaneGeometry(1, 1); cg.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(cg, leafMat, cards.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    cards.forEach((c, i) => { for (let k = 0; k < 2; k++) { e.set((rng() - 0.5) * 1.2, c.r + k * 1.57, (rng() - 0.5) * 1.2); q.setFromEuler(e); m4.compose(c.p, q, V(c.s, c.s, c.s)); im.setMatrixAt(i * 2 + k, m4); } });
    im.castShadow = true; im.receiveShadow = true; root.add(im);
  }

  // ---------------------------------------------------------------- scrub, tufts and rocks
  {
    const n = Math.round(700 * D);
    const bushG = new THREE.IcosahedronGeometry(1, 2); { const p = bushG.attributes.position; for (let i = 0; i < p.count; i++) { const v = V(p.getX(i), p.getY(i), p.getZ(i)); const k = 0.75 + 0.45 * fbm3(v.x * 2, v.y * 2, v.z * 2, 2); p.setXYZ(i, v.x * k, Math.max(-0.1, v.y * k * 0.7), v.z * k); } bushG.computeVertexNormals(); }
    const bm = std({ color: 0x8c8a66, roughness: 1, flatShading: true });
    const bushes = new THREE.InstancedMesh(bushG, bm, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    let k = 0;
    for (let i = 0; i < n * 3 && k < n; i++) {
      const a = rng() * 6.28, r = 20 + Math.pow(rng(), 0.7) * 230; const x = Math.cos(a) * r, z = Math.sin(a) * r - 10;
      if (x > LOT.x0 - 1 && x < LOT.x1 + 1 && z > -100 && z < LOT.z1 + 1) continue; // lot + buildings
      if (z > 60 && z < 72) continue; // road
      if (inBuildings(x, z)) continue;
      const s = 0.3 + rng() * 0.9; q.setFromEuler(new THREE.Euler(0, rng() * 6, 0)); m4.compose(V(x, 0, z), q, V(s * (1 + rng() * 0.5), s, s)); bushes.setMatrixAt(k++, m4);
      if (Math.hypot(x, z + 20) < 110 && s > 0.7) obstacle(x, z, s * 0.8);
    }
    bushes.count = k; bushes.castShadow = true; bushes.receiveShadow = true; root.add(bushes);
    // grass tufts: crossed alpha cards, in the lot's cracks and all over the desert
    const tuftTex = canvasTexture(128, 128, (g, w, h) => { const r = rngOf(4); g.clearRect(0, 0, w, h); for (let i = 0; i < 40; i++) { const x = w / 2 + (r() - 0.5) * w * 0.6; g.strokeStyle = `rgb(${120 + r() * 40},${108 + r() * 30},${70 + r() * 25})`; g.lineWidth = 2 + r() * 2; g.beginPath(); g.moveTo(w / 2 + (r() - 0.5) * 10, h); g.quadraticCurveTo(x, h * 0.6, x + (r() - 0.5) * 30, h * (0.05 + r() * 0.4)); g.stroke(); } }, { wrap: false });
    const tm = windy(std({ map: tuftTex, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 1 }), 0.12, 'kl-story-tufts');
    const tg = merge([new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateY(Math.PI / 2)]);
    const nt = Math.round(1300 * D), tufts = new THREE.InstancedMesh(tg, tm, nt);
    for (let i = 0; i < nt; i++) {
      let x, z; if (i < nt * 0.3) { x = LOT.x0 + rng() * lotW; z = LOT.z0 + 4 + rng() * (lotD - 4); } else { const a = rng() * 6.28, r = 8 + Math.pow(rng(), 0.6) * 140; x = Math.cos(a) * r; z = Math.sin(a) * r; if (x > LOT.x0 && x < LOT.x1 && z > -100 && z < LOT.z1) { x += Math.sign(x || 1) * 50; } if (inBuildings(x, z)) { z += 120; } }
      const s = 0.25 + rng() * 0.45; q.setFromEuler(new THREE.Euler(0, rng() * 6, 0)); m4.compose(V(x, 0, z), q, V(s, s * (0.8 + rng() * 0.6), s)); tufts.setMatrixAt(i, m4);
    }
    tufts.receiveShadow = true; root.add(tufts);
    const rockG = new THREE.DodecahedronGeometry(1, 0); const rm = std({ color: 0x9a7a5c, roughness: 1, flatShading: true });
    const nr = Math.round(160 * D), rocks = new THREE.InstancedMesh(rockG, rm, nr);
    for (let i = 0; i < nr; i++) { const a = rng() * 6.28, r = 50 + rng() * 300; const s = 0.2 + Math.pow(rng(), 3) * 2.5; let rx = Math.cos(a) * r, rz = Math.sin(a) * r - 20; if (inBuildings(rx, rz)) rz += 140; q.setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3)); m4.compose(V(rx, s * 0.3, rz), q, V(s, s * 0.6, s * 0.9)); rocks.setMatrixAt(i, m4); }
    rocks.castShadow = true; rocks.receiveShadow = true; root.add(rocks);
  }
  // barrels and a dumpster by the side of the building
  {
    const bm = std({ color: 0x3f5f6a, roughness: 0.7, metalness: 0.4 }), rb = rustMat(0x7a4a2a);
    [[17.5, -16, bm], [18.3, -17.2, rb], [17.4, -18.5, bm]].forEach(([x, z, m]) => { cyl(0.3, 0.3, 0.9, m, x, 0.45, z, { parent: root }); obstacle(x, z, 0.35); });
    const dump = box(1.8, 1.3, 1.2, std({ color: 0x2f4a36, roughness: 0.7, metalness: 0.5 }), 18.2, 0.65, -24, { parent: root }); obstacle(18.2, -23.6, 0.9); obstacle(18.2, -24.4, 0.9);
  }
  // the mesas
  root.add(mesaRing(V(0, 0, 0)));

  // ---------------------------------------------------------------- tumbleweed + grinder sparks in the trees
  const tw = new THREE.Group(); root.add(tw);
  {
    const pts = []; for (let i = 0; i < 260; i++) { const a = rng() * 6.28, b = Math.acos(2 * rng() - 1), r = 0.35 + rng() * 0.1; pts.push(V(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r, Math.sin(b) * Math.sin(a) * r)); }
    const tubes = []; for (let i = 0; i < 18; i++) { const sub = []; for (let k = 0; k < 8; k++) sub.push(pts[Math.floor(rng() * pts.length)]); tubes.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(sub, true), 40, 0.008, 3, true)); }
    const m = new THREE.Mesh(merge(tubes), std({ color: 0xa08a5e, roughness: 1 })); m.castShadow = true; tw.add(m);
  }
  const tumble = { t: 0, active: false, from: V(), to: V(), dur: 1 };
  const sparkN = 40, spPos = new Float32Array(sparkN * 3), spVel = [];
  const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
  const sparks = new THREE.Points(spG, new THREE.PointsMaterial({ color: 0xffc070, size: 0.08, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  sparks.frustumCulled = false; sparks.visible = false; root.add(sparks);
  const grinderAt = V(-62, 1.1, -12);
  for (let i = 0; i < sparkN; i++) spVel.push(V());
  let sparkT = 0;

  return {
    moss, trees, grinderAt,
    treePoint(r = rng) { const t = trees[Math.floor(r() * trees.length)]; return V(t.x + (r() - 0.5) * 4, 3 + r() * 6, t.z + (r() - 0.5) * 4); },
    grind(dur = 2.5) { sparkT = dur; sparks.visible = true; },
    update(dt, t, camLocal) {
      moss.update(dt, camLocal.clone().add(S));
      // tumbleweed: now and then one rolls across the lot with the wind
      if (!tumble.active && Math.random() < dt / 25) { tumble.active = true; tumble.t = 0; const z = -2 + Math.random() * 45; tumble.from.set(-70, 0.4, z); tumble.to.set(70, 0.4, z + (Math.random() - 0.5) * 20); tumble.dur = 14 + Math.random() * 8; }
      tw.visible = tumble.active;
      if (tumble.active) {
        tumble.t += dt; const u = tumble.t / tumble.dur;
        tw.position.copy(tumble.from).lerp(tumble.to, u); tw.position.y = 0.42 + Math.abs(Math.sin(u * 40)) * 0.35;
        tw.rotation.z -= dt * 4; tw.rotation.x += dt * 0.7;
        if (u >= 1) tumble.active = false;
      }
      if (sparkT > 0) {
        sparkT -= dt;
        for (let i = 0; i < sparkN; i++) {
          const v = spVel[i];
          if (spPos[i * 3 + 1] < 0.05 || Math.random() < dt * 2) { spPos[i * 3] = grinderAt.x; spPos[i * 3 + 1] = grinderAt.y; spPos[i * 3 + 2] = grinderAt.z; v.set(2 + Math.random() * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3); }
          v.y -= 9.8 * dt; spPos[i * 3] += v.x * dt; spPos[i * 3 + 1] += v.y * dt; spPos[i * 3 + 2] += v.z * dt;
        }
        spG.attributes.position.needsUpdate = true;
        if (sparkT <= 0) sparks.visible = false;
      }
    },
  };
}
