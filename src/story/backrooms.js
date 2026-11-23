// The fluorescent Backrooms behind Keatland Reception (Part Three). Yellowed wallpaper, damp carpet,
// drop ceilings and buzzing tubes. The hallway doglegs, a ceiling tile falls to show an office room
// above (fluorescent lights running sideways), branches push through the drywall, Accounting is off
// to the left, the sales office has the Keatland Motors brochure desk and the Freedomland poster, and
// beyond it a corridor of AUTHORIZED PERSONNEL ONLY doors loops back on itself (twice) before it lets
// you reach the locked FREEDOMLAND door, the EXIT to Tomorrow, and the doors to the Catecholamine Works.
import * as THREE from 'three';
import { S, SL, FLOOR } from './layout.js';
import { V, std, box, cyl, tiledBox } from './kit.js';
import { CellPlan } from './rooms.js';
import { wallpaperTexture, carpetTexture, carpetRoughness, ceilingTexture, stuccoTexture, vinylTexture, woodTexture, signTexture, signPlane, freedomlandPoster, tickerCanvas, rngOf } from './paint.js';
import { canvasTexture } from '../materials/textures.js';
import { sweepGeometry } from '../geometry/sweep.js';
import { merge } from '../geometry/generators.js';
import { Figure } from './figures.js';
import { SIGNS } from '../data/storyLines.js';

export function buildBackrooms({ root, collision, quality }) {
  const rng = rngOf(909);
  const g = new THREE.Group(); g.name = 'backrooms'; root.add(g);
  const W = (x, z) => ({ x: S.x + x, z: S.z + z });
  const wallSeg = (x1, z1, x2, z2, r = 0.12) => { const a = W(x1, z1), b = W(x2, z2); return collision.addWall({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r }); };
  const obstacle = (x, z, r) => { const w = W(x, z); return collision.addObstacle({ x: w.x, z: w.z, r }); };

  // ---------------------------------------------------------------- materials
  const wp = wallpaperTexture(); const wallMat = std({ map: wp, roughness: 0.85, color: 0xffffff });
  const wp2 = wallpaperTexture(17); const accMat = std({ map: wp2, roughness: 0.85, color: 0xf2e9c8 });
  const panel = woodTexture(141, '#6a4a2c'); const officeWall = std({ map: panel, roughness: 0.7, color: 0xd8c0a0 });
  const carpet = carpetTexture(); const carpetMat = std({ map: carpet, roughnessMap: carpetRoughness(), roughness: 1, color: 0xd8c08a });
  const vinyl = vinylTexture(142); const officeFloor = std({ map: vinyl, roughness: 0.5, color: 0xe8d8b8 });
  const ceil = ceilingTexture(); const ceilMat = std({ map: ceil, roughness: 0.95 });
  const ext = std({ map: stuccoTexture(143, '#d3c09c'), roughness: 0.95 });
  const baseboard = std({ color: 0x6a5a3a, roughness: 0.7 });
  const frame = std({ color: 0x8c8a84, metalness: 0.7, roughness: 0.35 });

  // ---------------------------------------------------------------- the plan
  const plan = new CellPlan();
  plan.addRoom({ id: 'reception', rects: [[SL.rx0, SL.rx1, SL.rz0, SL.rz1]], build: false, wall: std({ color: 0xe9dcc4 }) });
  plan.addRoom({ id: 'hall', rects: [[8, 11, -47, -34], [8, 14, -50, -47], [11, 14, -82, -50]], wall: wallMat, floor: carpetMat, ceiling: ceilMat, height: 2.8, baseboard: true });
  plan.addRoom({ id: 'accounting', rects: [[0, 11, -77, -64]], wall: accMat, floor: carpetMat, ceiling: ceilMat, height: 2.8, baseboard: true });
  const O = SL.office, Lp = SL.loop;
  plan.addRoom({ id: 'office', rects: [[O.x0, O.x1, O.z0, O.z1]], wall: officeWall, floor: officeFloor, ceiling: ceilMat, height: 3.0, baseboard: true, floorScale: 2.4 });
  plan.addRoom({ id: 'loop', rects: [[Lp.x0, Lp.x1, Lp.z0, Lp.z1]], wall: wallMat, floor: carpetMat, ceiling: ceilMat, height: 2.8, baseboard: true });
  plan.openZ(SL.rz0, SL.corridor[0], SL.corridor[1]);
  plan.openX(11, -71, -68); // into Accounting
  plan.openZ(-82, 11, 14); // hall -> sales office
  plan.openX(24, Lp.z0, Lp.z1); // sales office -> the loop
  const tileCell = [Math.floor(SL.tile.x), Math.floor(SL.tile.z)];
  plan.hole(tileCell[0], tileCell[1]); plan.hole(tileCell[0], tileCell[1] - 1); // a 1 x 2 m gap in the grid
  const built = plan.build({ y: FLOOR, exterior: ext, baseboard });
  g.add(built.group);
  built.walls.forEach((w) => wallSeg(w.x1, w.z1, w.x2, w.z2));
  collision.addGround((x, z) => (plan.at(x - S.x, z - S.z) !== null ? S.y + FLOOR : null));
  // roof slabs over each room (from outside: one long low windowless building); the hall's slab
  // stops for the office room that sits on top of it, over the ceiling tile
  for (const r of [[7.7, 14.3, -54.0, -33.9], [7.7, 14.3, -82.3, -60.0], [-0.3, 11, -77.3, -63.7], [O.x0 - 0.3, O.x1 + 0.3, O.z0 - 0.3, O.z1 + 0.3], [Lp.x0, Lp.x1 + 0.3, Lp.z0 - 0.3, Lp.z1 + 0.3]]) {
    const [x0, x1, z0, z1] = r;
    const slab = tiledBox(x1 - x0, 0.3, z1 - z0, ext, 3); slab.position.set((x0 + x1) / 2, FLOOR + 3.2, (z0 + z1) / 2); slab.castShadow = true;
    g.add(slab);
  }
  // exterior skin strips between wall tops (2.8/3.0) and the roof (3.05..3.35)
  for (const w of built.walls) {
    const L = Math.hypot(w.x2 - w.x1, w.z2 - w.z1); if (L < 0.01) continue;
    const mx = (w.x1 + w.x2) / 2, mz = (w.z1 + w.z2) / 2, vert = w.x1 === w.x2;
    const a = plan.at(vert ? mx - 0.5 : mx, vert ? mz : mz - 0.5), b = plan.at(vert ? mx + 0.5 : mx, vert ? mz : mz + 0.5);
    if (a !== null && b !== null) continue; // inside wall: hidden above the ceilings
    const out = a === null ? -1 : 1, off = out * 0.11;
    const s = tiledBox(vert ? 0.08 : L + 0.3, 0.62, vert ? L + 0.3 : 0.08, ext, 3); s.position.set(mx + (vert ? off : 0), FLOOR + 3.05, mz + (vert ? 0 : off)); s.castShadow = true; g.add(s);
  }
  // "BUILDING C" on the outside
  { const t = signPlane(signTexture(SIGNS.buildingC, { w: 1024, h: 256, bg: '#d3c09c', fg: '#5a3a22', font: 'Oswald', weight: '700', weather: 0.9, seed: 150 }), 4, 1); t.position.set(14.32, FLOOR + 2.0, -60); t.rotation.y = Math.PI / 2; g.add(t);
    const t2 = t.clone(); t2.position.set(-0.32, FLOOR + 2.0, -70); t2.rotation.y = -Math.PI / 2; g.add(t2); }

  // ---------------------------------------------------------------- fluorescent fixtures: steady, flickering, dead
  const fixtures = built.fixtures.filter((p) => !(Math.floor(p.x) === tileCell[0] && Math.abs(Math.floor(p.z) - tileCell[1] + 0.5) < 1.6));
  const panelGeo = new THREE.BoxGeometry(0.6, 0.04, 1.2);
  const onMat = std({ color: 0xfffbe6, emissive: 0xfff2c8, emissiveIntensity: 0.85, roughness: 0.4 });
  const flicker = [], steady = [];
  const inLoop = (p) => p.x > Lp.x0 && p.z < Lp.z1 && p.z > Lp.z0; // must repeat exactly every period: all steady
  fixtures.forEach((p) => {
    const r = inLoop(p) ? 1 : rng();
    if (r < 0.1) { const m = std({ color: 0xfffbe6, emissive: 0xfff2c8, emissiveIntensity: 0.85, roughness: 0.4 }); const mesh = new THREE.Mesh(panelGeo, m); mesh.position.copy(p); g.add(mesh); flicker.push({ m, p, ph: rng() * 10, rate: 3 + rng() * 9 }); }
    else if (r < 0.14) { const mesh = new THREE.Mesh(panelGeo, std({ color: 0xcfc7a8, roughness: 0.5 })); mesh.position.copy(p); g.add(mesh); p.dead = true; }
    else steady.push(p);
  });
  { const im = new THREE.InstancedMesh(panelGeo, onMat, steady.length); const m4 = new THREE.Matrix4(); steady.forEach((p, i) => im.setMatrixAt(i, m4.makeTranslation(p.x, p.y, p.z))); g.add(im); }
  const lightFixtures = fixtures.filter((p) => !p.dead);

  // ---------------------------------------------------------------- the ceiling tile, and the office above it
  const hx = tileCell[0] + 0.5, hz = tileCell[1], ceilY = FLOOR + 2.8, HD = 1; // hole: 1 m across, 2 m along the hall
  const tileMesh = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.02, 1.96), ceilMat); tileMesh.position.set(hx, ceilY, hz); tileMesh.castShadow = true; g.add(tileMesh);
  const up = new THREE.Group(); g.add(up);
  {
    const uy = ceilY + 0.14, uH = 2.7, ux0 = hx - 3.5, ux1 = hx + 3.5, uz0 = hz - 3, uz1 = hz + 3;
    const upWall = std({ map: wallpaperTexture(23), roughness: 0.85, color: 0xe6dcc0 });
    // floor around the hole
    const fm = std({ map: carpetTexture(24), roughness: 1, color: 0xcfc3a0 });
    box(hx - 0.5 - ux0, 0.06, uz1 - uz0, fm, (ux0 + hx - 0.5) / 2, uy - 0.03, (uz0 + uz1) / 2, { parent: up });
    box(ux1 - hx - 0.5, 0.06, uz1 - uz0, fm, (hx + 0.5 + ux1) / 2, uy - 0.03, (uz0 + uz1) / 2, { parent: up });
    box(1, 0.06, hz - HD - uz0, fm, hx, uy - 0.03, (uz0 + hz - HD) / 2, { parent: up });
    box(1, 0.06, uz1 - hz - HD, fm, hx, uy - 0.03, (hz + HD + uz1) / 2, { parent: up });
    // hole rim: the broken edge of the tile grid, and the plenum sides between the two floors
    for (const [x, z, w, d] of [[hx, hz - HD, 1, 0.04], [hx, hz + HD, 1, 0.04], [hx - 0.5, hz, 0.04, 2 * HD], [hx + 0.5, hz, 0.04, 2 * HD]]) { box(w, 0.04, d, frame, x, ceilY - 0.01, z, { parent: up }); box(w, uy - ceilY, d, std({ color: 0x5a5040, roughness: 1 }), x, (ceilY + uy) / 2, z, { parent: up }); }
    // walls (inside faces wallpaper, outside stucco) + ceiling + roof
    const F = (inner) => inner;
    const walls = [[ux0, uz0, ux1, uz0, 'z', 1], [ux0, uz1, ux1, uz1, 'z', -1], [ux0, uz0, ux0, uz1, 'x', 1], [ux1, uz0, ux1, uz1, 'x', -1]];
    for (const [x0, z0, x1, z1, axis, inSide] of walls) {
      const L = Math.hypot(x1 - x0, z1 - z0);
      const mats = axis === 'z' ? (inSide > 0 ? [ext, ext, ext, ext, upWall, ext] : [ext, ext, ext, ext, ext, upWall]) : (inSide > 0 ? [upWall, ext, ext, ext, ext, ext] : [ext, upWall, ext, ext, ext, ext]);
      const m = tiledBox(axis === 'z' ? L : 0.16, uH, axis === 'z' ? 0.16 : L, mats, 2); m.position.set((x0 + x1) / 2, uy + uH / 2, (z0 + z1) / 2); up.add(m);
    }
    const rf = tiledBox(ux1 - ux0 + 0.3, 0.3, uz1 - uz0 + 0.3, [ext, ext, ext, ceilMat, ext, ext], 0.6); rf.position.set(hx, uy + uH + 0.15, hz); up.add(rf);
    // a desk, filing cabinets, a chair, papers
    const metal = std({ color: 0x7a7a6c, metalness: 0.6, roughness: 0.5 }), wood = std({ map: woodTexture(25, '#8a6a44'), roughness: 0.6 });
    box(1.6, 0.05, 0.8, wood, hx + 1.6, uy + 0.75, hz - 1.5, { parent: up }); for (const [dx, dz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) box(0.05, 0.75, 0.05, metal, hx + 1.6 + dx, uy + 0.375, hz - 1.5 + dz, { parent: up });
    for (let i = 0; i < 3; i++) { box(0.5, 1.35, 0.6, metal, hx - 2.6 + i * 0.55, uy + 0.675, hz - 2.5, { parent: up }); for (let k = 0; k < 4; k++) box(0.08, 0.02, 0.02, frame, hx - 2.6 + i * 0.55, uy + 0.25 + k * 0.32, hz - 2.19, { parent: up }); }
    box(0.5, 0.08, 0.5, std({ color: 0x2a2a2e }), hx + 1.6, uy + 0.48, hz - 0.8, { parent: up }); box(0.5, 0.5, 0.06, std({ color: 0x2a2a2e }), hx + 1.6, uy + 0.75, hz - 0.55, { parent: up });
    // the fluorescent tubes run sideways: up the walls and across, not in the ceiling
    const tube = std({ color: 0xffffff, emissive: 0xfff4d8, emissiveIntensity: 2.2 });
    for (let i = 0; i < 4; i++) { const t = cyl(0.025, 0.025, 2.2, tube, ux0 + 0.15, uy + 1.3, hz - 2 + i * 1.3, { parent: up, seg: 8, cast: false }); t.rotation.x = Math.PI / 2 * (i % 2); t.rotation.z = Math.PI / 2 * ((i + 1) % 2) * 0.0; }
    for (let i = 0; i < 3; i++) { const t = cyl(0.025, 0.025, 2.6, tube, hx - 1 + i * 1.2, uy + 1.4, uz0 + 0.15, { parent: up, seg: 8, cast: false }); t.rotation.z = Math.PI / 2; }
    // and right over the hole: tubes standing on end, a desk hanging half over the edge, a dangling phone
    for (const [dx, dz, h] of [[-0.3, -0.7, 2.2], [0.25, 0.1, 1.9], [-0.2, 0.8, 2.4]]) cyl(0.03, 0.03, h, tube, hx + dx, uy + 0.25 + h / 2, hz + dz, { parent: up, seg: 8, cast: false });
    { const d = new THREE.Group(); d.position.set(hx + 0.75, uy, hz - 0.2); d.rotation.z = 0.12; up.add(d);
      box(1.2, 0.05, 0.7, wood, -0.1, 0.75, 0, { parent: d }); box(0.05, 0.75, 0.6, metal, 0.45, 0.375, 0, { parent: d });
      const ph = box(0.2, 0.07, 0.18, std({ color: 0x1e1e1e }), -0.55, 0.81, 0.1, { parent: d });
      const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(-0.55, 0.78, 0.1), V(-0.75, 0.3, 0.12), V(-0.8, -0.6, 0.1), V(-0.78, -1.0, 0.15)]), 24, 0.006, 5), std({ color: 0x1e1e1e })); d.add(cord);
      const hs = box(0.06, 0.2, 0.06, std({ color: 0x1e1e1e }), -0.78, -1.05, 0.15, { parent: d }); }
    const ul = new THREE.PointLight(0xfff0d0, 7, 9, 1.6); ul.position.set(hx, uy + 1.8, hz); up.add(ul);
    up.userData.light = ul;
    // a paper or two drifting at the hole's edge
    for (let i = 0; i < 4; i++) { const p = box(0.21, 0.002, 0.3, std({ color: 0xf2efe6 }), hx + (rng() - 0.5) * 2, uy + 0.01, hz + HD + 0.2 + rng() * 0.6, { parent: up }); p.rotation.y = rng() * 3; }
  }
  // the debris that comes down with the tile
  const debris = []; for (let i = 0; i < 18; i++) { const d = box(0.04 + rng() * 0.08, 0.02 + rng() * 0.05, 0.04 + rng() * 0.08, ceilMat, hx + (rng() - 0.5) * 0.8, ceilY, hz + (rng() - 0.5) * 1.8, { parent: g }); d.visible = false; debris.push({ m: d, v: V((rng() - 0.5) * 1.2, -rng(), (rng() - 0.5) * 1.2), w: V(rng() * 6, rng() * 6, rng() * 6) }); }
  const tile = { state: 'up', t: 0, v: 0 };

  // ---------------------------------------------------------------- branches through the wall
  {
    const bx = 14, bz = SL.branchZ;
    const barkM = std({ color: 0x5e5040, roughness: 0.95 });
    const geos = [];
    // the trunk outside, against Building C
    geos.push(sweepGeometry(new THREE.CatmullRomCurve3([V(16.6, -0.3, bz + 0.4), V(16.4, 3, bz), V(16.0, 6.5, bz - 0.6), V(16.8, 9, bz - 1)]), { tubular: 20, radial: 10, radius: (t) => 0.45 * (1 - t * 0.6), noise: 0.15, noiseScale: 1.4 }));
    const branchesIn = [];
    for (let i = 0; i < 5; i++) {
      const y = FLOOR + 0.9 + rng() * 1.7, z = bz + (rng() - 0.5) * 2.4;
      const p0 = V(16.4, y + 0.3, bz), p1 = V(bx + 0.4, y, z), p2 = V(bx - 0.6 - rng() * 1.0, y + (rng() - 0.3) * 0.6, z + (rng() - 0.5) * 1.4);
      geos.push(sweepGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), { tubular: 16, radial: 7, radius: (t) => 0.11 * (1 - t * 0.75) + 0.01, noise: 0.2, noiseScale: 3, capEnd: true }));
      branchesIn.push(p2);
      // twigs
      for (let k = 0; k < 3; k++) { const q = p1.clone().lerp(p2, 0.4 + rng() * 0.6); geos.push(sweepGeometry(new THREE.CatmullRomCurve3([q, q.clone().add(V(-0.3 - rng() * 0.3, (rng() - 0.3) * 0.5, (rng() - 0.5) * 0.6))]), { tubular: 5, radial: 4, radius: (t) => 0.025 * (1 - t) + 0.004 })); }
    }
    const m = new THREE.Mesh(merge(geos), barkM); m.castShadow = true; m.receiveShadow = true; g.add(m);
    // dusty leaves on the branch tips
    const leafTex = canvasTexture(128, 128, (c, w, h) => { const r = rngOf(4); c.clearRect(0, 0, w, h); for (let i = 0; i < 30; i++) { const cc = 70 + r() * 40; c.fillStyle = `rgb(${cc * 0.9},${cc},${cc * 0.55})`; c.beginPath(); c.ellipse(w / 2 + (r() - 0.5) * w * 0.7, h / 2 + (r() - 0.5) * h * 0.7, 6 + r() * 6, 3 + r() * 4, r() * 6, 0, 7); c.fill(); } }, { wrap: false });
    const lm = std({ map: leafTex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 });
    for (const p of branchesIn) for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), lm); l.position.copy(p).add(V((rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4, (rng() - 0.5) * 0.4)); l.rotation.set(rng() * 3, rng() * 3, rng() * 3); g.add(l); }
    // a crown outside above the roof
    for (let k = 0; k < 20; k++) { const l = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), lm); l.position.set(16.5 + (rng() - 0.5) * 4, 7 + rng() * 4, bz + (rng() - 0.5) * 4); l.rotation.set(rng() * 3, rng() * 3, rng() * 3); l.castShadow = true; g.add(l); }
    // cracked, bulging drywall where they came through + chunks on the carpet
    const crack = canvasTexture(512, 512, (c, w, h) => { c.clearRect(0, 0, w, h); const r = rngOf(8); c.strokeStyle = 'rgba(60,45,20,0.8)'; for (let i = 0; i < 26; i++) { let x = w / 2 + (r() - 0.5) * 120, y = h / 2 + (r() - 0.5) * 160, a = r() * 6.28; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 14; k++) { x += Math.cos(a) * 12; y += Math.sin(a) * 12; a += (r() - 0.5) * 0.8; c.lineTo(x, y); } c.stroke(); } const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(70,55,30,0.5)'); gr.addColorStop(1, 'rgba(70,55,30,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { wrap: false });
    const cp = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), std({ map: crack, transparent: true, depthWrite: false, roughness: 0.9 })); cp.position.set(bx - 0.085, FLOOR + 1.8, bz); cp.rotation.y = -Math.PI / 2; g.add(cp);
    for (let i = 0; i < 14; i++) { const d = box(0.05 + rng() * 0.15, 0.02 + rng() * 0.05, 0.05 + rng() * 0.15, std({ color: 0xd9d0b0 }), bx - 0.3 - rng() * 0.8, FLOOR + 0.03, bz + (rng() - 0.5) * 2, { parent: g }); d.rotation.y = rng() * 3; }
    const gr = signPlane(signTexture(SIGNS.treesGraffiti, { w: 1024, h: 384, transparent: true, fg: '#1a1a1a', font: 'Permanent Marker', weather: 0.3, seed: 160, rotate: -0.04 }), 1.6, 0.6, { transparent: true }); gr.position.set(11.09, FLOOR + 1.6, bz + 2.6); gr.rotation.y = Math.PI / 2; g.add(gr);
  }

  // ---------------------------------------------------------------- writing on the walls, signs
  const decal = (lines, x, y, z, ry, w, h, o = {}) => { const p = signPlane(signTexture(lines, { w: 1024, h: Math.round(1024 * h / w), transparent: true, fg: '#141414', font: 'Permanent Marker', weather: 0.3, seed: Math.round(x * 31 + z), ...o }), w, h, { transparent: true }); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); return p; };
  decal(SIGNS.graffitiStart, 13.91, FLOOR + 1.7, -49.2, -Math.PI / 2, 1.3, 0.55);
  decal(SIGNS.graffitiMiddle, 11.09, FLOOR + 1.6, -60.5, Math.PI / 2, 1.8, 0.7);
  decal(SIGNS.graffitiRelative, 13.91, FLOOR + 1.5, -73.5, -Math.PI / 2, 2.0, 0.6, { fg: '#3a1a10' });
  { const plaque = signPlane(signTexture(SIGNS.feverDream, { w: 1024, h: 300, bg: '#2a2a2a', fg: '#e8e0c8', font: 'Special Elite', weather: 0.2, seed: 161, border: 8, borderColor: '#b8913e' }), 0.9, 0.26); plaque.position.set(8.09, FLOOR + 1.5, -40); plaque.rotation.y = Math.PI / 2; g.add(plaque); }
  const accSign = signPlane(signTexture([SIGNS.accounting], { w: 512, h: 128, bg: '#2a2a2a', fg: '#f2efe6', font: 'Oswald', weight: '600', weather: 0.3, seed: 162 }), 1.1, 0.28); accSign.position.set(11.09, FLOOR + 2.45, -69.5); accSign.rotation.y = Math.PI / 2; g.add(accSign);

  // ---------------------------------------------------------------- Accounting
  {
    const deskM = std({ color: 0x9a9384, roughness: 0.6 }), part = std({ color: 0x6d6a5e, roughness: 0.9 }), crt = std({ color: 0xcfc6ae, roughness: 0.5 });
    for (let i = 0; i < 4; i++) {
      const x = 2.5 + (i % 2) * 4, z = -67 - Math.floor(i / 2) * 5;
      box(1.6, 0.05, 0.8, deskM, x, FLOOR + 0.74, z, { parent: g }); box(1.6, 0.72, 0.05, deskM, x, FLOOR + 0.37, z - 0.38, { parent: g });
      box(1.8, 1.4, 0.06, part, x, FLOOR + 0.7, z - 0.5, { parent: g }); box(0.06, 1.4, 1.4, part, x - 0.9, FLOOR + 0.7, z + 0.2, { parent: g });
      box(0.42, 0.36, 0.4, crt, x - 0.2, FLOOR + 0.95, z - 0.12, { parent: g }); box(0.34, 0.26, 0.01, std({ color: 0x1a2218, emissive: 0x1a3020, emissiveIntensity: 0.5 }), x - 0.2, FLOOR + 0.96, z + 0.085, { parent: g });
      box(0.22, 0.06, 0.28, crt, x + 0.45, FLOOR + 0.79, z, { parent: g }); // adding machine
      for (let k = 0; k < 4; k++) box(0.21, 0.01, 0.3, std({ color: 0xf2efe6 }), x + 0.3 + (rng() - 0.5) * 0.3, FLOOR + 0.77 + k * 0.01, z + (rng() - 0.5) * 0.1, { parent: g });
      wallSeg(x - 0.9, z - 0.5, x + 0.9, z - 0.5, 0.06); wallSeg(x - 0.9, z - 0.5, x - 0.9, z + 0.9, 0.06); obstacle(x, z, 0.45); obstacle(x + 0.5, z, 0.4);
    }
    // the remains of the Humane Realizations chair (it got here before you did)
    const uph = std({ color: 0x2a2a2e, roughness: 0.9 });
    box(0.5, 0.08, 0.48, uph, 9.3, FLOOR + 0.05, -70.4, { parent: g }).rotation.set(0.1, 0.6, 0.05);
    box(0.48, 0.55, 0.07, uph, 8.7, FLOOR + 0.05, -69.6, { parent: g }).rotation.set(Math.PI / 2, 0.4, 0);
    for (let i = 0; i < 4; i++) box(0.28, 0.03, 0.04, frame, 9 + (rng() - 0.5) * 1.2, FLOOR + 0.02, -70 + (rng() - 0.5) * 1.2, { parent: g }).rotation.y = rng() * 3;
  }

  // ---------------------------------------------------------------- the sales office: brochure desk, Freedomland
  const office = new THREE.Group(); g.add(office);
  const D = SL.desk;
  const deskWood = std({ map: woodTexture(171, '#6a4a2a'), roughness: 0.55 });
  box(1.7, 0.06, 0.85, deskWood, D.x, FLOOR + 0.76, D.z, { parent: office }); box(0.45, 0.74, 0.8, deskWood, D.x - 0.6, FLOOR + 0.37, D.z, { parent: office }); box(0.45, 0.74, 0.8, deskWood, D.x + 0.6, FLOOR + 0.37, D.z, { parent: office });
  obstacle(D.x - 0.45, D.z, 0.55); obstacle(D.x + 0.45, D.z, 0.55);
  const topY = FLOOR + 0.79;
  // brochure: front and back laid side by side
  const broF = signPlane(signTexture(SIGNS.brochureFront, { w: 768, h: 1024, bg: '#a3261c', fg: '#f2e6c8', font: 'Oswald', weight: '600', sizes: [1.6, 1.25, 0.42], weather: 0.25, seed: 172 }), 0.24, 0.32); broF.rotation.set(-Math.PI / 2, 0, 0.05); broF.position.set(D.x - 0.15, topY + 0.002, D.z + 0.15); office.add(broF);
  const broB = signPlane(signTexture(SIGNS.brochureBack, { w: 768, h: 1024, bg: '#f2e6c8', fg: '#2a2219', font: 'Special Elite', weather: 0.2, seed: 173 }), 0.24, 0.32); broB.rotation.set(-Math.PI / 2, 0, -0.08); broB.position.set(D.x + 0.14, topY + 0.002, D.z + 0.14); office.add(broB);
  // the clipboard with the prophecy, and the pen
  box(0.24, 0.012, 0.33, std({ color: 0x8a6a40, roughness: 0.6 }), D.x + 0.5, topY + 0.006, D.z + 0.05, { parent: office });
  const proph = signPlane(signTexture(SIGNS.clipboard, { w: 512, h: 700, bg: '#f7f4ea', fg: '#1d1d3a', font: 'Caveat', weight: '700', weather: 0.1, seed: 174, rotate: -0.05 }), 0.21, 0.29); proph.rotation.set(-Math.PI / 2, 0, 0); proph.position.set(D.x + 0.5, topY + 0.014, D.z + 0.06); office.add(proph);
  const pen = cyl(0.006, 0.006, 0.14, std({ color: 0x1a1a24, metalness: 0.7, roughness: 0.25, emissive: 0x3a2a60, emissiveIntensity: 0.4 }), D.x - 0.45, topY + 0.008, D.z + 0.12, { parent: office, seg: 8 }); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5;
  const penTag = signPlane(signTexture(SIGNS.penTag, { w: 512, h: 400, bg: '#f4efe2', fg: '#2a2219', font: 'Special Elite', sizes: [1.2, 1, 0.7, 0.7], weather: 0.2, seed: 175, border: 6 }), 0.1, 0.08); penTag.rotation.set(-Math.PI / 2, 0, 0.3); penTag.position.set(D.x - 0.42, topY + 0.003, D.z + 0.25); office.add(penTag);
  // the desk lamp (Dale is unscrewing it)
  const lamp = new THREE.Group(); lamp.position.set(D.x - 0.65, topY, D.z - 0.25); office.add(lamp);
  { const lm = std({ color: 0x2a5a3a, metalness: 0.5, roughness: 0.4 }); cyl(0.08, 0.09, 0.03, lm, 0, 0.015, 0, { parent: lamp }); const arm = cyl(0.01, 0.01, 0.4, frame, 0, 0.2, 0, { parent: lamp, seg: 6 }); const shade = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 16, 1, true), std({ color: 0x2a5a3a, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.4 })); shade.position.set(0.06, 0.4, 0); shade.rotation.z = 0.6; lamp.add(shade); }
  // the swivel chair, pulled out for you
  const chair = new THREE.Group(); chair.position.set(D.x, FLOOR, D.z + 0.95); chair.rotation.y = Math.PI + 0.35; office.add(chair);
  { const uph = std({ color: 0x3a2a24, roughness: 0.8 }); box(0.5, 0.09, 0.48, uph, 0, 0.48, 0, { parent: chair }); box(0.48, 0.6, 0.08, uph, 0, 0.85, -0.25, { parent: chair }); cyl(0.025, 0.025, 0.4, frame, 0, 0.25, 0, { parent: chair, seg: 8 }); for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const l = box(0.28, 0.03, 0.04, frame, Math.cos(a) * 0.14, 0.05, Math.sin(a) * 0.14, { parent: chair }); l.rotation.y = -a; }
    const note = signPlane(signTexture(SIGNS.haveASeat, { w: 384, h: 256, bg: '#f6e27a', fg: '#2a2a50', font: 'Caveat', weight: '700', weather: 0.2, seed: 176 }), 0.18, 0.12); note.position.set(0, 0.9, -0.205); note.rotation.y = 0; chair.add(note); const n2 = note.clone(); n2.rotation.y = Math.PI; n2.position.z = -0.295; chair.add(n2); }
  obstacle(D.x, D.z + 0.95, 0.35);
  // Keaten (no wig now), pulling the chair out
  const keaten = new Figure('keaten', { seed: 21 });
  keaten.group.position.set(D.x + 0.75, FLOOR, D.z + 0.95); keaten.group.rotation.y = -0.4; keaten.pose = 'pull';
  office.add(keaten.group); obstacle(D.x + 0.75, D.z + 0.95, 0.35);
  // Freedomland: the poster, the diorama under it, BENEFITS, CRTs, cabinets, the compass rose
  const fp = freedomlandPoster();
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.0 * 0.62), std({ map: fp, roughness: 0.7 })); poster.position.set(15.5, FLOOR + 1.85, O.z0 + 0.09); office.add(poster);
  { const pf = std({ color: 0x3a2a18 }); box(3.3, 0.06, 0.04, pf, 15.5, FLOOR + 3.08, O.z0 + 0.1, { parent: office }); box(3.3, 0.06, 0.04, pf, 15.5, FLOOR + 0.62, O.z0 + 0.1, { parent: office });
    const strip = box(3.2, 0.06, 0.12, std({ color: 0xffffff, emissive: 0xfff0c8, emissiveIntensity: 1.5 }), 15.5, FLOOR + 3.05, O.z0 + 0.25, { parent: office, cast: false }); }
  {
    const table = box(2.6, 0.06, 0.9, deskWood, 15.5, FLOOR + 0.82, O.z0 + 0.7, { parent: office }); box(2.6, 0.8, 0.04, std({ color: 0x1d2a44 }), 15.5, FLOOR + 0.4, O.z0 + 1.13, { parent: office });
    const tf = signPlane(signTexture([SIGNS.freedomland], { w: 1024, h: 256, bg: '#1d2a44', fg: '#d4a02a', font: 'Rye', weather: 0.3, seed: 177 }), 1.8, 0.45); tf.position.set(15.5, FLOOR + 0.45, O.z0 + 1.16); office.add(tf);
    const grass = std({ color: 0x6a8a3a, roughness: 1, flatShading: true });
    const hills = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), grass); hills.scale.set(1.2, 0.18, 0.4); hills.position.set(15.5, FLOOR + 0.85, O.z0 + 0.7); office.add(hills);
    const stone = std({ color: 0xe8dcc0 });
    for (const [dx, h] of [[-0.25, 0.3], [0, 0.42], [0.25, 0.3]]) { cyl(0.04, 0.04, h, stone, 15.5 + dx, FLOOR + 1.0 + h / 2, O.z0 + 0.65, { parent: office, seg: 8 }); const roof = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.1, 8), std({ color: 0x7a8fb0 })); roof.position.set(15.5 + dx, FLOOR + 1.05 + h, O.z0 + 0.65); office.add(roof); }
    for (let i = 0; i < 16; i++) { const tr = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 6), std({ color: 0x2f5a2a })); tr.position.set(15.5 + (rng() - 0.5) * 2.2, FLOOR + 0.92 + rng() * 0.05, O.z0 + 0.5 + rng() * 0.4); office.add(tr); }
    wallSeg(14.2, O.z0 + 1.15, 16.8, O.z0 + 1.15, 0.1);
  }
  const ben = signPlane(signTexture(SIGNS.benefits, { w: 768, h: 1024, bg: '#efe6d0', fg: '#2a2219', font: 'Oswald', weight: '500', align: 'left', sizes: [1.3, 1, 1, 1, 1, 1], weather: 0.6, seed: 178, border: 10 }), 1.1, 1.45); ben.position.set(19.3, FLOOR + 1.85, O.z0 + 0.09); office.add(ben);
  const sales = signPlane(signTexture(SIGNS.salesPoster, { w: 768, h: 768, bg: '#d49a2a', fg: '#2a1a0a', font: 'Oswald', weight: '600', sizes: [1.5, 0.7, 0.8], weather: 0.5, seed: 179, border: 10 }), 1.2, 1.2); sales.position.set(O.x0 + 0.09, FLOOR + 1.75, -90); sales.rotation.y = Math.PI / 2; office.add(sales);
  {
    const cab = std({ color: 0x7a7258, metalness: 0.5, roughness: 0.5 });
    const fpTV = freedomlandPoster(5);
    for (const [x, z] of [[8, O.z0 + 0.5], [9.1, O.z0 + 0.5], [22.4, O.z0 + 0.5], [23.3, -86]]) { box(0.55, 1.35, 0.65, cab, x, FLOOR + 0.675, z, { parent: office }); obstacle(x, z, 0.45); }
    for (const [x, z, ry] of [[8.5, O.z0 + 0.55, 0], [22.4, O.z0 + 0.55, 0]]) { const tv = new THREE.Group(); tv.position.set(x, FLOOR + 1.6, z); tv.rotation.y = ry; office.add(tv); box(0.6, 0.48, 0.5, std({ color: 0x2a2826, roughness: 0.5 }), 0, 0, 0, { parent: tv }); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.36), std({ map: fpTV, emissive: 0xffffff, emissiveMap: fpTV, emissiveIntensity: 0.7, roughness: 0.2 })); scr.position.z = 0.252; tv.add(scr); }
    const rose = canvasTexture(512, 512, (c, w, h) => { c.clearRect(0, 0, w, h); c.translate(w / 2, h / 2); for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.fillStyle = i % 2 ? '#a3261c' : '#d49a2a'; c.beginPath(); c.moveTo(0, -(i % 2 ? 150 : 240)); c.lineTo(28, 0); c.lineTo(-28, 0); c.fill(); } c.strokeStyle = '#6a3a1a'; c.lineWidth = 6; c.beginPath(); c.arc(0, 0, 160, 0, 7); c.stroke(); }, { wrap: false });
    const rm = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), std({ map: rose, transparent: true, depthWrite: false, roughness: 0.6 })); rm.rotation.x = -Math.PI / 2; rm.position.set(15.5, FLOOR + 0.006, -92.5); office.add(rm);
  }

  // ---------------------------------------------------------------- the loop: AUTHORIZED PERSONNEL ONLY, again and again
  const doors = [];
  const doorTex = signTexture(SIGNS.authorized, { w: 512, h: 256, bg: '#a3261c', fg: '#f2efe6', font: 'Oswald', weight: '700', weather: 0.4, seed: 180, border: 8, borderColor: '#f2efe6' });
  const doorMat = std({ color: 0x8a7a5a, roughness: 0.6, metalness: 0.2 });
  const wired = new THREE.MeshStandardMaterial({ color: 0xe8e4c8, roughness: 0.25, transparent: true, opacity: 0.6, emissive: 0x3a3420, emissiveIntensity: 0.3 });
  const zc = (Lp.z0 + Lp.z1) / 2, half = (Lp.z1 - Lp.z0) / 2;
  for (const x of Lp.doors) {
    const dg = new THREE.Group(); dg.position.set(x, FLOOR, zc); g.add(dg);
    box(0.25, 2.25, 0.12, frame, 0, 1.125, -half + 0.06, { parent: dg }); box(0.25, 2.25, 0.12, frame, 0, 1.125, half - 0.06, { parent: dg });
    box(0.25, 0.55, Lp.z1 - Lp.z0, wallMat, 0, 2.525, 0, { parent: dg });
    const leaves = [-1, 1].map((s) => {
      const hinge = new THREE.Group(); hinge.position.set(0, 0, s * (half - 0.12)); dg.add(hinge);
      const w = half - 0.13;
      const leaf = box(0.06, 2.15, w, doorMat, 0, 1.09, -s * w / 2, { parent: hinge });
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), wired); win.position.set(0.035, 1.55, -s * w / 2); win.rotation.y = Math.PI / 2; hinge.add(win); const win2 = win.clone(); win2.position.x = -0.035; win2.rotation.y = -Math.PI / 2; hinge.add(win2);
      for (const side of [1, -1]) { const sg = signPlane(doorTex, 0.55, 0.27); sg.position.set(side * 0.035, 1.05, -s * w / 2); sg.rotation.y = side * Math.PI / 2; hinge.add(sg); }
      box(0.1, 0.04, 0.3, frame, 0, 1.0, -s * (w - 0.25), { parent: hinge });
      return { hinge, s };
    });
    const col = wallSeg(x, Lp.z0, x, Lp.z1, 0.08);
    doors.push({ x, dg, leaves, open: 0, dir: 1, col });
  }
  // a wet floor sign once per period, so the loop can be noticed
  const wetTex = signTexture(SIGNS.wetFloor, { w: 512, h: 512, bg: '#f2c12a', fg: '#1a1a1a', font: 'Oswald', weight: '700', weather: 0.3, seed: 181 });
  for (let x = Lp.doors[0] + 7; x < Lp.x1; x += 15) { const ws = new THREE.Group(); ws.position.set(x, FLOOR, Lp.z1 - 0.45); ws.rotation.y = 0.5; g.add(ws); for (const s of [-1, 1]) { const p = signPlane(wetTex, 0.32, 0.62, { side: THREE.DoubleSide }); p.position.set(0, 0.31, s * 0.09); p.rotation.x = s * 0.28; ws.add(p); } obstacle(x, Lp.z1 - 0.45, 0.25); }
  // the end of the loop: FREEDOMLAND, the EXIT to Tomorrow, the Catecholamine Works
  const endX = SL.freedomDoorX;
  const fd = new THREE.Group(); fd.position.set(endX - 0.09, FLOOR, zc); g.add(fd);
  { const wood = std({ map: woodTexture(182, '#5a3a22'), roughness: 0.5 });
    box(0.08, 2.2, 1.1, wood, 0, 1.1, 0, { parent: fd }); box(0.1, 2.3, 0.08, frame, 0, 1.15, 0.58, { parent: fd }); box(0.1, 2.3, 0.08, frame, 0, 1.15, -0.58, { parent: fd }); box(0.1, 0.08, 1.24, frame, 0, 2.3, 0, { parent: fd });
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), std({ color: 0xc9a040, metalness: 0.9, roughness: 0.25 })); knob.position.set(-0.07, 1.0, -0.4); fd.add(knob);
    const fs = signPlane(signTexture([SIGNS.freedomland], { w: 1024, h: 256, bg: '#efe3c4', fg: '#a3261c', font: 'Rye', weather: 0.4, seed: 183, border: 10 }), 1.0, 0.25); fs.position.set(-0.05, 1.75, 0); fs.rotation.y = -Math.PI / 2; fd.add(fs);
    const sun = signPlane(signTexture(SIGNS.freedomTag, { w: 512, h: 384, bg: '#d4a02a', fg: '#3a2a18', font: 'Oswald', weight: '600', weather: 0.3, seed: 184 }), 0.5, 0.38); sun.position.set(-0.05, 1.2, 0); sun.rotation.y = -Math.PI / 2; fd.add(sun);
    // a warm line of light under it
    const glow = box(0.02, 0.02, 1.0, std({ color: 0xffffff, emissive: 0xffe0a0, emissiveIntensity: 3 }), -0.05, 0.01, 0, { parent: fd, cast: false });
    const mat = signPlane(signTexture(SIGNS.doormat, { w: 1024, h: 512, bg: '#7a5a34', fg: '#2a1a0a', font: 'Oswald', weight: '600', weather: 0.8, seed: 185, border: 14, borderColor: '#4a3018' }), 1.3, 0.65); mat.rotation.set(-Math.PI / 2, 0, Math.PI / 2); mat.position.set(endX - 0.9, FLOOR + 0.008, zc); g.add(mat);
  }
  const exitX = SL.exitDoorX;
  const ex = new THREE.Group(); ex.position.set(exitX, FLOOR, Lp.z0 + 0.09); g.add(ex);
  { const steel = std({ color: 0x6a7a6a, metalness: 0.6, roughness: 0.45 });
    box(1.0, 2.15, 0.06, steel, 0, 1.075, 0, { parent: ex }); box(0.08, 0.05, 0.9, frame, 0, 1.0, 0.06, { parent: ex }).rotation.y = Math.PI / 2;
    const es = signPlane(signTexture(SIGNS.exitTomorrow, { w: 512, h: 256, bg: '#0c3a1a', fg: '#7dff9a', font: 'Oswald', weight: '700', weather: 0.1, seed: 186 }), 0.55, 0.26, { emissive: 1.6 }); es.position.set(0, 2.45, 0.06); ex.add(es);
    const sub = signPlane(signTexture(SIGNS.exitSub, { w: 1024, h: 160, bg: '#f2efe6', fg: '#1a1a1a', font: 'Oswald', weight: '600', weather: 0.3, seed: 187, border: 6 }), 0.9, 0.14); sub.position.set(0, 1.55, 0.04); ex.add(sub);
    const el = new THREE.PointLight(0x50ff80, 0.8, 4, 2); el.position.set(0, 2.3, 0.4); ex.add(el);
  }
  const worksX = SL.worksDoorX;
  const worksLeaves = []; // the Catecholamine Works double door (swings open into the factory)
  const wk = new THREE.Group(); wk.position.set(worksX, FLOOR, Lp.z1 - 0.09); g.add(wk);
  { const steel = std({ color: 0xb8b8b0, metalness: 0.8, roughness: 0.3 });
    for (const s of [-1, 1]) { const hinge = new THREE.Group(); hinge.position.set(s * 0.72, 0, 0); wk.add(hinge); box(0.7, 2.2, 0.06, steel, -s * 0.35, 1.1, 0, { parent: hinge }); const w = new THREE.Mesh(new THREE.CircleGeometry(0.13, 20), std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 3 })); w.position.set(-s * 0.35, 1.6, -0.04); w.rotation.y = Math.PI; hinge.add(w); worksLeaves.push({ hinge, s }); }
    const gap = box(0.02, 2.2, 0.02, std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 4 }), 0, 1.1, -0.04, { parent: wk, cast: false });
    const under = box(1.4, 0.02, 0.02, std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 4 }), 0, 0.01, -0.05, { parent: wk, cast: false });
    const ws1 = signPlane(signTexture(SIGNS.works, { w: 1024, h: 200, bg: '#2a2a2a', fg: '#e8c070', font: 'Rye', weather: 0.2, seed: 188, border: 6, borderColor: '#b8913e' }), 1.4, 0.27); ws1.position.set(0, 2.5, -0.05); ws1.rotation.y = Math.PI; wk.add(ws1);
    const ws2 = signPlane(signTexture(SIGNS.worksSub, { w: 1024, h: 160, bg: '#f2c12a', fg: '#1a1a1a', font: 'Oswald', weight: '700', weather: 0.3, seed: 189 }), 0.9, 0.14); ws2.position.set(0, 1.2, -0.05); ws2.rotation.y = Math.PI; wk.add(ws2);
    const wl = new THREE.PointLight(0xffffff, 2.5, 4, 2); wl.position.set(0, 0.6, -0.6); wk.add(wl);
  }

  // ---------------------------------------------------------------- Yesterkeat's ceiling speakers + announcement boards
  const speakerPos = [V(12.5, FLOOR + 2.78, -45.5), V(12.5, FLOOR + 2.78, -62.5), V(12.5, FLOOR + 2.78, -77.5), V(5.5, FLOOR + 2.78, -70.5), V(15.5, FLOOR + 2.98, -88.5)];
  for (let x = 40.5; x < Lp.x1; x += 15) speakerPos.push(V(x, FLOOR + 2.78, zc));
  const grill = canvasTexture(128, 128, (c, w, h) => { c.fillStyle = '#d8d0b4'; c.fillRect(0, 0, w, h); c.fillStyle = '#3a3428'; for (let y = 10; y < h; y += 9) for (let x = 10; x < w; x += 9) if (Math.hypot(x - w / 2, y - h / 2) < w * 0.42) { c.beginPath(); c.arc(x, y, 2.5, 0, 7); c.fill(); } }, { wrap: false });
  for (const p of speakerPos) { const s = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24), std({ map: grill, roughness: 0.6 })); s.rotation.x = Math.PI / 2; s.position.copy(p); g.add(s); }
  const ticker = tickerCanvas(1024, 96);
  const boardMat = new THREE.MeshBasicMaterial({ map: ticker.texture, toneMapped: false });
  const boards = [];
  const board = (x, y, z, ry) => { const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.y = ry; g.add(b); box(1.7, 0.24, 0.08, std({ color: 0x1a1a1a, roughness: 0.4 }), 0, 0, -0.03, { parent: b, cast: false }); const f = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.15), boardMat); f.position.z = 0.012; b.add(f); boards.push(b); };
  board(11.12, FLOOR + 2.4, -55, Math.PI / 2); board(13.88, FLOOR + 2.4, -78.5, -Math.PI / 2); board(O.x0 + 0.12, FLOOR + 2.55, -86, Math.PI / 2);
  for (let x = 40.5; x < Lp.x1; x += 15) board(x, FLOOR + 2.45, Lp.z0 + 0.12, 0);
  board(-8, FLOOR + 2.85, SL.rz0 + 0.2, 0); // one behind the reception counter too
  board(87.5, FLOOR + 2.45, Lp.z1 - 0.12, Math.PI); // and one facing the FREEDOMLAND door

  // ---------------------------------------------------------------- update
  const st = { loops: 0, tileTrig: false };
  const api = {
    group: g, fixtures: lightFixtures, flicker, speakerPos, boards, ticker, keaten, doors, plan, up, walls: built.walls,
    deskPos: D, freedomDoor: V(endX - 0.6, FLOOR, zc), exitDoor: V(exitX, FLOOR, Lp.z0 + 0.6), worksDoor: V(worksX, FLOOR, Lp.z1 - 0.6), worksLeaves,
    state: st, onTileFall: null, onLoop: null,
    inBackrooms(p) { const id = plan.at(p.x, p.z); return id !== null && id !== 'reception' && !(id === 'hall' && p.z > -37); },
    deep(p) { const id = plan.at(p.x, p.z); return id !== null && id !== 'reception' && p.z < -44; },
    reset() {
      st.loops = 0; st.tileTrig = false; tile.state = 'up'; tile.t = 0; tile.v = 0; tileMesh.position.set(hx, ceilY, hz); tileMesh.rotation.set(0, 0, 0);
      debris.forEach((d) => { d.m.visible = false; d.m.position.set(hx + (Math.random() - 0.5) * 0.8, ceilY, hz + (Math.random() - 0.5) * 1.8); });
    },
    /** returns a shift (local x) when the player went through the seam door, else 0 */
    update(dt, t, pl, camLocal, movers = []) {
      keaten.update(dt, camLocal.clone().add(S));
      // fixtures flicker and buzz
      for (const f of flicker) { const on = Math.sin(t * f.rate + f.ph) + Math.sin(t * f.rate * 2.7 + f.ph * 3) > -0.2 || Math.random() < 0.02; f.m.emissiveIntensity = on ? 0.85 : 0.04; f.on = on; }
      // the tile: falls when you walk under its row
      if (!st.tileTrig && Math.abs(pl.x - hx) < 2 && pl.z < hz + 5 && pl.z > hz - 2) { st.tileTrig = true; tile.state = 'falling'; tile.t = 0; debris.forEach((d) => (d.m.visible = true)); api.onTileFall?.(V(hx, FLOOR, hz)); }
      if (tile.state === 'falling') {
        tile.t += dt; tile.v -= 9.8 * dt; tileMesh.position.y += tile.v * dt; tileMesh.rotation.x += dt * 2.2; tileMesh.rotation.z += dt * 0.8; tileMesh.position.z += dt * 0.25;
        if (tileMesh.position.y < FLOOR + 0.02) { tileMesh.position.y = FLOOR + 0.02; tileMesh.rotation.set(0, 0.3, 0); tile.state = 'down'; }
        for (const d of debris) { d.v.y -= 9.8 * dt; d.m.position.addScaledVector(d.v, dt); d.m.rotation.x += d.w.x * dt; if (d.m.position.y < FLOOR + 0.02) { d.m.position.y = FLOOR + 0.02; d.v.set(0, 0, 0); d.w.set(0, 0, 0); } }
      }
      // doors swing away from whoever is approaching
      const who = [pl, ...movers];
      for (const d of doors) {
        let want = 0, dir = d.dir;
        for (const p of who) { const dx = p.x - d.x; if (Math.abs(dx) < 2.0 && p.z > Lp.z0 - 0.5 && p.z < Lp.z1 + 0.5) { want = 1; if (d.open < 0.05) dir = dx < 0 ? 1 : -1; } }
        d.dir = dir; d.open += (want - d.open) * Math.min(1, dt * (want ? 6 : 2.5));
        d.leaves.forEach((l) => { l.hinge.rotation.y = l.s * d.dir * d.open * 1.45; });
        d.col.off = d.open > 0.5;
      }
      // the seam: walk east through the seam door and you are back one door
      let shift = 0;
      if (st.loops < Lp.loops && pl.z > Lp.z0 && pl.z < Lp.z1 && pl.x > Lp.seam + 0.7 && pl.x < Lp.seam + 1.6) {
        shift = -Lp.back; st.loops++;
        const a = doors.find((d) => d.x === Lp.seam), b = doors.find((d) => d.x === Lp.seam - Lp.back), c = doors.find((d) => d.x === Lp.seam + Lp.back);
        if (a && b) { b.open = a.open; b.dir = a.dir; }
        if (c && a) { a.open = c.open; a.dir = c.dir; }
        api.onLoop?.(st.loops);
      }
      return shift;
    },
  };
  return api;
}
