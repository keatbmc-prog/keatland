// Assembles the central hub: a platform of flesh-stone hanging in the dark, ringed by twisted
// pillars that rise out of the void, vertebral ribs arching to a knotted crown, hanging tendril
// forests, honeycomb skin, a ribcage bridge leading to the Dreamer's mouth, and the heart.
import * as THREE from 'three';
import { L, platformRadius, hubFloor, bridgeFloor, mawFloor } from './layout.js';
import { sweepGeometry, blobGeometry } from '../geometry/sweep.js';
import { merge, tendrilTree, vertebraGeometry, vertebraeAlong, pillarGeometry, teethRing, scatterOnGeometry } from '../geometry/generators.js';
import { radialSurface, conformDisc, conformRing, shellPatch } from '../geometry/surfaces.js';
import { organicMaterial, getTextures, U } from '../materials/library.js';
import { ciliaField } from '../render/effects.js';
import { mulberry32, fbm3 } from '../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }

function mesh(geo, mat, { cast = true, receive = true, name } = {}) {
  const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; if (name) m.name = name; return m;
}

export function buildHub({ scene, mats, quality, collision }) {
  const T = getTextures();
  const rng = mulberry32(2024);
  const D = quality.detail;
  const root = new THREE.Group(); root.name = 'hub'; scene.add(root);
  const cilia = [];
  const updaters = [];

  // ------------------------------------------------------------------ platform
  const outline = (a) => platformRadius(a);
  const floorH = (x, z) => { const h = hubFloor(x, z); if (h !== null) return h; return 0.18 * fbm3(x * 0.06, 0.3, z * 0.06, 3); };
  const topProfile = [];
  const nTop = Math.round(36 * D) + 8;
  for (let k = 0; k <= nTop; k++) topProfile.push({ r: (k / nTop) * 0.9, y: floorH, noise: 0 });
  topProfile.push({ r: 0.93, y: (x, z) => floorH(x, z) + 0.3 }, { r: 0.96, y: 1.1, noise: 0.6 }, { r: 0.99, y: 1.3, noise: 0.8 }, { r: 1.01, y: 0.6, noise: 1.0 });
  const top = radialSurface({ outline, profile: topProfile, sectors: Math.round(200 * D), noiseScale: 0.15, planarUV: 7 });
  root.add(mesh(top, mats.floor, { cast: false, name: 'floor' }));
  collision.addGround(hubFloor);

  // belly: the platform's underside, a heavy organ dripping roots into the void
  const belly = radialSurface({
    outline, sectors: Math.round(160 * D), noise: 2.5, noiseScale: 0.09, uvRepeat: 24,
    profile: [{ r: 1.01, y: 0.6, noise: 0.5 }, { r: 1.04, y: -2 }, { r: 1.0, y: -6 }, { r: 0.85, y: -12 }, { r: 0.62, y: -19 }, { r: 0.4, y: -27 }, { r: 0.2, y: -36 }, { r: 0.0, y: -42 }],
  });
  root.add(mesh(belly, mats.flesh, { name: 'belly' }));

  // hanging roots under the platform
  const rootBodies = [], rootPods = [];
  const nRoots = Math.round(20 * D);
  for (let i = 0; i < nRoots; i++) {
    const a = rng() * Math.PI * 2, rr = L.platformR * (0.2 + rng() * 0.75);
    const y = -6 - (1 - rr / L.platformR) * 30;
    const t = tendrilTree({ start: V(Math.cos(a) * rr, y, Math.sin(a) * rr), dir: V((rng() - 0.5) * 0.4, -1, (rng() - 0.5) * 0.4), length: 18 + rng() * 26, radius: 0.5 + rng() * 0.6, depth: quality.tendrilDepth - 1, gravity: 0.6, curl: 0.35, rng, detail: D * 0.8, podChance: 0.35 });
    rootBodies.push(t.body); if (t.pods) rootPods.push(t.pods);
  }

  // rim lip: a sinew rope around the edge + bony nubs
  const rimPts = [];
  for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; const r = outline(a) * 0.985; rimPts.push(V(Math.cos(a) * r, 1.05 + 0.25 * Math.sin(a * 9), Math.sin(a) * r)); }
  const rimCurve = new THREE.CatmullRomCurve3(rimPts, true);
  const rim = sweepGeometry(rimCurve, { closed: true, tubular: Math.round(420 * D), radial: 10, radius: (t) => 0.55 + 0.25 * Math.pow(Math.abs(Math.sin(t * Math.PI * 48)), 3), noise: 0.3, noiseScale: 0.5 });
  root.add(mesh(rim, mats.sinew, { name: 'rim' }));

  // ------------------------------------------------------------------ ritual bowl: sigil + rune ring + altar
  const sigilMat = new THREE.MeshBasicMaterial({ map: T.sigil, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.55, 0.42, 0.3), fog: true });
  const sigil = mesh(conformDisc({ cx: L.ritual.x, cz: L.ritual.z, radius: L.ritualR + 0.8, height: hubFloor, offset: 0.04 }), sigilMat, { cast: false, receive: false, name: 'sigil' });
  sigil.renderOrder = 2; root.add(sigil);
  const runeMat = new THREE.MeshBasicMaterial({ map: T.runesAmber, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(0.45, 0.32, 0.2), fog: true });
  const runeRing = mesh(conformRing({ cx: L.ritual.x, cz: L.ritual.z, r0: L.ritualR + 1.3, r1: L.ritualR + 2.4, height: hubFloor, uRepeat: 4 }), runeMat, { cast: false, receive: false });
  runeRing.renderOrder = 2; root.add(runeRing);
  updaters.push((dt, t) => {
    const k = 0.45 + U.ritual.value * 1.4 + U.heartbeat.value * 0.25;
    sigilMat.color.setRGB(0.55 * k, 0.42 * k, 0.3 * k);
    runeMat.color.setRGB(0.45 * k, 0.32 * k, 0.2 * k);
    T.runesAmber.offset.x = t * 0.01;
  });

  // altar: stacked vertebral stone with a sleeping face relief and a bowl of light
  const altarParts = [];
  const ab = blobGeometry(1.6, { detail: 4, noise: 0.22, noiseScale: 1.4, squash: [1.3, 0.55, 1.3], seed: 3 }); ab.translate(L.ritual.x, -0.2, L.ritual.z); altarParts.push(ab);
  const ac = blobGeometry(1.0, { detail: 4, noise: 0.3, noiseScale: 2, squash: [1, 1.2, 1], seed: 7 }); ac.translate(L.ritual.x, 0.9, L.ritual.z); altarParts.push(ac);
  const ad = blobGeometry(1.3, { detail: 4, noise: 0.18, noiseScale: 1.6, squash: [1.25, 0.4, 1.25], seed: 9 }); ad.translate(L.ritual.x, 1.9, L.ritual.z); altarParts.push(ad);
  for (let i = 0; i < 7; i++) { // claws gripping the altar
    const a = (i / 7) * Math.PI * 2;
    const c = new THREE.CatmullRomCurve3([V(Math.cos(a) * 1.0, 2.0, Math.sin(a) * 1.0), V(Math.cos(a) * 1.9, 1.7, Math.sin(a) * 1.9), V(Math.cos(a) * 2.2, 0.6, Math.sin(a) * 2.2), V(Math.cos(a) * 2.6, -0.6, Math.sin(a) * 2.6)].map((p) => p.add(L.ritual)));
    altarParts.push(sweepGeometry(c, { tubular: 20, radial: 7, radius: (t) => 0.32 * (1 - t * 0.7), capEnd: true, noise: 0.2, noiseScale: 1 }));
  }
  // a crown of fangs ringing the altar
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, r = 3.1 + (i % 2) * 0.3;
    const h = 1.0 + (i % 3) * 0.45;
    const c = new THREE.CatmullRomCurve3([V(Math.cos(a) * r, -0.6, Math.sin(a) * r), V(Math.cos(a) * (r + 0.15), h * 0.6, Math.sin(a) * (r + 0.15)), V(Math.cos(a) * (r - 0.35), h, Math.sin(a) * (r - 0.35))].map((p) => p.add(L.ritual)));
    altarParts.push(sweepGeometry(c, { tubular: 14, radial: 7, radius: (t) => 0.2 * (1 - t * 0.9), capEnd: true }));
  }
  const altarG = merge(altarParts);
  altarG.translate(-L.ritual.x, 0, -L.ritual.z); altarG.scale(1.6, 1.6, 1.6); altarG.translate(L.ritual.x, 0, L.ritual.z);
  root.add(mesh(altarG, mats.bone, { name: 'altar' }));
  collision.addObstacle({ x: L.ritual.x, z: L.ritual.z, r: 3.9 });
  // the offering: a slowly turning orb of light (the sleeping sun, small)
  const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.3, 0.55) });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 3), orbMat); orb.position.copy(L.ritual).add(V(0, 4.7, 0)); orb.scale.setScalar(1.5); root.add(orb);
  updaters.push((dt, t) => { orb.position.y = 4.7 + Math.sin(t * 0.8) * 0.15 + U.ritual.value * 1.2; const k = 1 + U.ritual.value * 1.6 + U.heartbeat.value * 0.4; orbMat.color.setRGB(2.4 * k, 1.3 * k, 0.55 * k); });

  // ------------------------------------------------------------------ pillars rising from the void
  const pillarCore = [], pillarStrands = [], pillarCollars = [], ribSpines = [], vertebraMats = [], hangBodies = [], hangPods = [];
  const nP = 8;
  const pillarTops = [];
  for (let i = 0; i < nP; i++) {
    let a = -Math.PI / 2 + ((i + 0.5) / nP) * Math.PI * 2; // leave the north (maw) open
    const r = L.pillarR + (rng() - 0.5) * 6;
    const base = V(Math.cos(a) * r, -120, Math.sin(a) * r);
    const h = 170 + rng() * 25;
    const p = pillarGeometry({ base, height: h, radius: 2.5 + rng() * 1.0, strands: 4 + Math.floor(rng() * 2), twist: 1.6 + rng(), seed: 100 + i, detail: D });
    pillarCore.push(p.core); pillarStrands.push(p.strands); pillarCollars.push(p.collars);
    const topP = p.curve.getPointAt(1);
    pillarTops.push(topP);
    // vertebral rib: pillar top -> crown
    const ctrl = topP.clone().lerp(L.crown, 0.45).add(V(0, 28, 0));
    const rib = new THREE.QuadraticBezierCurve3(topP.clone().add(V(0, -6, 0)), ctrl, L.crown.clone().add(V(Math.cos(a) * 6, -2, Math.sin(a) * 6)));
    ribSpines.push(sweepGeometry(rib, { tubular: Math.round(90 * D), radial: 10, radius: (t) => 2.3 * (1 - t * 0.45) + 0.5 * Math.pow(Math.abs(Math.sin(t * 60)), 4), noise: 0.15, noiseScale: 0.3 }));
    const out = V(Math.cos(a), 0.6, Math.sin(a)).normalize();
    vertebraMats.push(...vertebraeAlong(rib, 3.4 / Math.max(0.6, D), (t) => 2.0 * (1 - t * 0.45), out));
    // tendril forests hanging from the rib
    const nh = Math.round((2 + rng() * 2) * D);
    for (let k = 0; k < nh; k++) {
      const st = rib.getPointAt(0.2 + rng() * 0.65);
      const t2 = tendrilTree({ start: st, dir: V((rng() - 0.5) * 0.3, -1, (rng() - 0.5) * 0.3), length: 12 + rng() * 16, radius: 0.35 + rng() * 0.35, depth: quality.tendrilDepth, gravity: 0.8, curl: 0.45, rng, detail: D, podChance: 0.7, children: 3 });
      hangBodies.push(t2.body); if (t2.pods) hangPods.push(t2.pods);
    }
  }
  const pillarCoreG = merge(pillarCore), pillarStrandG = merge(pillarStrands);
  root.add(mesh(pillarCoreG, mats.flesh, { name: 'pillars' }));
  root.add(mesh(pillarStrandG, mats.sinew, { name: 'pillar-strands' }));
  root.add(mesh(merge(pillarCollars), mats.bone, { name: 'pillar-collars' }));
  root.add(mesh(merge(ribSpines), mats.bone, { name: 'ribs' }));
  const vgeo = vertebraGeometry(5, D);
  const vInst = new THREE.InstancedMesh(vgeo, mats.bone, vertebraMats.length);
  vertebraMats.forEach((m, i) => vInst.setMatrixAt(i, m));
  vInst.castShadow = true; vInst.receiveShadow = true; vInst.name = 'vertebrae';
  root.add(vInst);

  // crown: a knot of masses where the ribs meet; cords lower the heart from it
  const crownParts = [];
  for (let i = 0; i < 6; i++) {
    const b = blobGeometry(5 + rng() * 5, { detail: 4, noise: 0.35, noiseScale: 1.3, seed: 40 + i, lumps: [{ dir: [rng() - 0.5, -1, rng() - 0.5], size: 6, amp: 0.5 }] });
    b.translate(L.crown.x + (rng() - 0.5) * 12, L.crown.y + (rng() - 0.3) * 8, L.crown.z + (rng() - 0.5) * 12);
    crownParts.push(b);
  }
  root.add(mesh(merge(crownParts), mats.flesh, { name: 'crown' }));
  const cords = [];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    const st = L.crown.clone().add(V(Math.cos(a) * 7, -4, Math.sin(a) * 7));
    const en = L.heart.clone().add(V(Math.cos(a) * 2.5, 3, Math.sin(a) * 2.5));
    const mid = st.clone().lerp(en, 0.5).add(V(Math.cos(a + 1) * 6, 0, Math.sin(a + 1) * 6));
    cords.push(sweepGeometry(new THREE.CatmullRomCurve3([st, mid, en]), { tubular: 60, radial: 8, radius: (t) => 0.7 - 0.3 * Math.sin(t * Math.PI) + 0.2 * Math.pow(Math.abs(Math.sin(t * 25)), 3), noise: 0.2, noiseScale: 0.5 }));
  }
  root.add(mesh(merge(cords), mats.sinew, { name: 'cords' }));

  const tendrilMesh = mesh(merge([...hangBodies, ...rootBodies]), mats.sinew, { name: 'tendrils' });
  root.add(tendrilMesh);
  const podMat = organicMaterial({ sway: 1.4, color: 0x5a2a20, color2: 0x200a08, veinColor: 0xffb060, veinAmount: 1.6, veinScale: 1.2, breath: 0.05, rim: 2.0, rimColor: 0xff7a3a, emissive: 0x401204, roughness: 0.35 });
  const podMesh = mesh(merge([...hangPods, ...rootPods]), podMat, { cast: false, name: 'pods' });
  root.add(podMesh);

  // ------------------------------------------------------------------ honeycomb lattice between the pillars
  // A dimensional hex lattice (instanced hexagonal rings) draped on spherical patches behind the
  // pillars. Some cells are skinned with membrane, some hold a dim eye. "Don't count the eyes."
  const ringMats = [], skinMats = [], eyeMats = [];
  const cellS = 2.4;
  const hexRing = new THREE.TorusGeometry(cellS * 0.98, cellS * 0.13, 5, 6); hexRing.rotateZ(Math.PI / 6);
  const hexSkin = new THREE.CircleGeometry(cellS * 0.92, 6); hexSkin.rotateZ(Math.PI / 6);
  const mtmp = new THREE.Matrix4(), qtmp = new THREE.Quaternion(), stmp = new THREE.Vector3(1, 1, 1), Zax = V(0, 0, 1);
  const hubC = V(0, -6, -3);
  const patches = [];
  for (let i = 0; i < 7; i++) {
    const phi = -Math.PI / 2 + 0.55 + (i / 7) * (Math.PI * 2 - 1.1) + (rng() - 0.5) * 0.15;
    patches.push({ R: 82 + rng() * 14, phi0: phi, dphi: 0.42 + rng() * 0.3, th0: 0.45 + rng() * 0.5, dth: 0.55 + rng() * 0.55 });
  }
  patches.push({ R: 96, phi0: -Math.PI / 2 - 0.5, dphi: 1.0, th0: 0.2, dth: 0.35 }); // high over the mouth
  for (const P of patches) {
    const dth = (1.5 * cellS) / P.R;
    let row = 0;
    for (let th = P.th0; th < P.th0 + P.dth; th += dth, row++) {
      const dph = (Math.sqrt(3) * cellS) / (P.R * Math.sin(th));
      const edgeT = Math.min(th - P.th0, P.th0 + P.dth - th) / P.dth;
      for (let ph = P.phi0 + (row & 1 ? dph / 2 : 0); ph < P.phi0 + P.dphi; ph += dph) {
        const edgeP = Math.min(ph - P.phi0, P.phi0 + P.dphi - ph) / P.dphi;
        // ragged, eaten edges
        if (Math.min(edgeT, edgeP) < 0.12 + 0.12 * fbm3(ph * 3, th * 3, P.R, 2)) continue;
        const R = P.R * (1 + 0.04 * fbm3(ph * 2.0, th * 2.0, 1, 3));
        const pos = V(Math.cos(ph) * Math.sin(th) * R, Math.cos(th) * R, Math.sin(ph) * Math.sin(th) * R).add(hubC);
        const nrm = hubC.clone().sub(pos).normalize();
        qtmp.setFromUnitVectors(Zax, nrm);
        const sc = 0.9 + 0.2 * rng();
        stmp.set(sc, sc, 1 + rng() * 1.5);
        mtmp.compose(pos, qtmp, stmp); ringMats.push(mtmp.clone());
        const r = rng();
        if (r < 0.33) { const p2 = pos.clone().addScaledVector(nrm, -0.6 - rng() * 0.8); mtmp.compose(p2, qtmp, V(sc, sc, 1)); skinMats.push(mtmp.clone()); }
        else if (r < 0.36) { const p2 = pos.clone().addScaledVector(nrm, -0.2); mtmp.compose(p2, qtmp, V(sc * 1.1, sc * 1.1, sc * 1.1)); eyeMats.push(mtmp.clone()); }
      }
    }
  }
  const latticeMat = organicMaterial({ color: 0x5a5048, color2: 0x1a1512, veinColor: 0x7fd6c8, veinAmount: 0.6, veinScale: 0.4, breath: 0.25, breathScale: 0.03, roughness: 0.5, rim: 0.7, rimColor: 0x1a3a3a, normalMap: T.barkNormal, normalScale: 0.8, colorScale: 0.08 });
  const lattice = new THREE.InstancedMesh(hexRing, latticeMat, ringMats.length);
  ringMats.forEach((m, i) => lattice.setMatrixAt(i, m)); lattice.name = 'honeycomb-lattice'; lattice.receiveShadow = true;
  root.add(lattice);
  const skins = new THREE.InstancedMesh(hexSkin, mats.honeycombPink, skinMats.length);
  skinMats.forEach((m, i) => skins.setMatrixAt(i, m)); skins.name = 'honeycomb-skins';
  mats.honeycombPink.side = THREE.DoubleSide;
  root.add(skins);
  if (eyeMats.length) {
    const eyeG = new THREE.SphereGeometry(cellS * 0.55, 16, 12);
    const cellEyeMat = new THREE.MeshStandardMaterial({ map: T.iris, emissive: 0xffffff, emissiveMap: T.iris, emissiveIntensity: 0.5, roughness: 0.2 });
    const ce = new THREE.InstancedMesh(eyeG, cellEyeMat, eyeMats.length);
    // spheres map the iris texture around them; face it inward
    const fix = new THREE.Matrix4().makeRotationY(-Math.PI / 2);
    eyeMats.forEach((m, i) => ce.setMatrixAt(i, m.clone().multiply(fix))); ce.name = 'honeycomb-eyes';
    root.add(ce);
  }

  // ------------------------------------------------------------------ colonnade + carved relief panels at the rim
  const postsCore = [], postsStr = [], panels = [], panels2 = [];
  const nPosts = 14;
  for (let i = 0; i < nPosts; i++) {
    const a = (i / nPosts) * Math.PI * 2 + 0.11;
    if (Math.abs(Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2))) < 0.3) continue; // bridge gap
    const r = outline(a) - 1.8;
    const base = V(Math.cos(a) * r, -0.5, Math.sin(a) * r);
    const p = pillarGeometry({ base, height: 6 + rng() * 5, radius: 0.55 + rng() * 0.2, strands: 4, twist: 1.5, seed: 300 + i, detail: D * 0.7 });
    postsCore.push(p.core); postsStr.push(p.strands);
    collision.addObstacle({ x: base.x, z: base.z, r: 1.2 });
    // relief slab between this post and the next
    if (i % 2 === 0) {
      const a2 = a + Math.PI / nPosts;
      const rr = outline(a2) - 2.0;
      const w = 2 * Math.sin(Math.PI / nPosts) * rr * 0.8, hgt = 5.2 + rng() * 2.5;
      const slab = new THREE.BoxGeometry(w, hgt, 0.5, Math.round(16 * D), Math.round(32 * D), 2);
      const pa = slab.attributes.position; const v = new THREE.Vector3();
      for (let k = 0; k < pa.count; k++) { v.fromBufferAttribute(pa, k); v.z += -0.25 * Math.pow(v.x / w * 2, 2) + 0.12 * fbm3(v.x * 0.6, v.y * 0.6, i, 3); v.x += 0.1 * fbm3(v.y * 0.3, i, 0, 2); pa.setXYZ(k, v.x, v.y, v.z); }
      slab.computeVertexNormals();
      // UVs on the front face already 0..1 — good for the relief artwork
      slab.translate(0, hgt / 2 - 0.4, 0);
      slab.lookAt(V(-Math.cos(a2), 0, -Math.sin(a2)));
      slab.rotateY(0); slab.translate(Math.cos(a2) * rr, 0, Math.sin(a2) * rr);
      (i % 4 === 0 ? panels : panels2).push(slab);
      collision.addObstacle({ x: Math.cos(a2) * rr, z: Math.sin(a2) * rr, r: 1.1 });
    }
  }
  root.add(mesh(merge(postsCore), mats.bone, { name: 'posts' }));
  root.add(mesh(merge(postsStr), mats.sinew, { name: 'post-strands' }));
  if (panels.length) root.add(mesh(merge(panels), mats.relief, { name: 'relief-panels' }));
  if (panels2.length) root.add(mesh(merge(panels2), mats.relief2, { name: 'relief-panels-2' }));

  // ------------------------------------------------------------------ ribcage bridge to the mouth
  const b = L.bridge;
  const deck = new THREE.BoxGeometry(b.x1 - b.x0 + 0.6, 1.2, b.z1 - b.z0, 12, 2, Math.round(80 * D));
  {
    const pa = deck.attributes.position; const v = new THREE.Vector3();
    for (let k = 0; k < pa.count; k++) {
      v.fromBufferAttribute(pa, k);
      const z = v.z + (b.z0 + b.z1) / 2;
      const top = bridgeFloor(0, Math.min(b.z1 - 0.01, Math.max(b.z0 + 0.01, z))) ?? 0;
      if (v.y > 0) v.y = top - 0.02 + 0.03 * fbm3(v.x, z, 0, 2); else v.y = top - 1.1 - 0.4 * Math.abs(Math.sin(z * 0.8));
      v.x *= 1 + 0.08 * Math.sin(z * 1.3);
      pa.setXYZ(k, v.x, v.y, z);
    }
    deck.computeVertexNormals(); scaleUV(deck, 2, 8);
  }
  root.add(mesh(deck, mats.floor, { name: 'bridge-deck' }));
  collision.addGround(bridgeFloor);
  const spine = new THREE.CatmullRomCurve3([V(0, -0.8, b.z1 + 2), V(0, -1.6, (b.z0 + b.z1) / 2), V(0, -0.6, b.z0 - 3)]);
  const bridgeVerts = vertebraeAlong(spine, 1.5, () => 1.0, V(0, -1, 0));
  const bvInst = new THREE.InstancedMesh(vgeo, mats.bone, bridgeVerts.length);
  bridgeVerts.forEach((m, i) => bvInst.setMatrixAt(i, m)); bvInst.castShadow = true; bvInst.receiveShadow = true;
  root.add(bvInst);
  const ribs = [];
  for (let z = b.z1 - 1.5; z > b.z0 + 1; z -= 2.6) {
    const yb = bridgeFloor(0, z) ?? 0;
    for (const s of [-1, 1]) {
      const h = 5.5 + 1.5 * Math.sin(z * 0.4);
      const c = new THREE.CatmullRomCurve3([V(s * 3.0, yb - 1.2, z), V(s * 3.6, yb + h * 0.4, z + 0.3), V(s * 2.6, yb + h * 0.85, z + 0.6), V(s * 0.9, yb + h + 0.3, z + 0.4)]);
      ribs.push(sweepGeometry(c, { tubular: 24, radial: 8, radius: (t) => 0.32 * (1 - 0.6 * t) + 0.1 * Math.exp(-t * 10), capEnd: true, noise: 0.15, noiseScale: 1.2 }));
    }
  }
  const ribMesh = mesh(merge(ribs), mats.bone, { name: 'bridge-ribs' });
  root.add(ribMesh);

  // ------------------------------------------------------------------ the Dreamer's face and mouth
  const face = [];
  const M = L.maw;
  const facePieces = [
    { p: [0, 17, -64], r: 15, s: [1.5, 0.75, 0.8], seed: 1 },   // brow
    { p: [-13, 4, -63], r: 10, s: [0.9, 1.3, 0.8], seed: 2 },   // cheeks
    { p: [13, 4, -63], r: 10, s: [0.9, 1.3, 0.8], seed: 3 },
    { p: [0, -9, -61], r: 10, s: [1.4, 0.7, 0.9], seed: 4 },    // chin
    { p: [-22, 14, -70], r: 14, s: [1, 1.4, 1], seed: 5 },
    { p: [22, 14, -70], r: 14, s: [1, 1.4, 1], seed: 6 },
    { p: [0, 34, -76], r: 22, s: [1.6, 0.9, 1], seed: 7 },
    { p: [0, -24, -66], r: 14, s: [1.3, 1.1, 1], seed: 8 },
  ];
  for (const f of facePieces) { const g = blobGeometry(f.r, { detail: 5, noise: 0.22, noiseScale: 1.2, squash: f.s, seed: f.seed, ridge: 0.05 }); g.translate(...f.p); face.push(g); }
  root.add(mesh(merge(face), mats.flesh, { name: 'face' }));
  // lips
  const lipPts = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; lipPts.push(V(M.x + Math.cos(a) * 6.6, M.y + Math.sin(a) * 5.2 * (Math.sin(a) > 0 ? 1 : 1.1), M.z + 1.2 - 0.6 * Math.abs(Math.cos(a)))); }
  const lipG = sweepGeometry(new THREE.CatmullRomCurve3(lipPts, true), { closed: true, tubular: 160, radial: 14, radius: (t) => 1.8 + 0.5 * Math.sin(t * Math.PI * 2 * 2) + 0.15 * Math.sin(t * 60), noise: 0.15, noiseScale: 0.6 });
  const lipMat = organicMaterial({ color: 0x5a2630, color2: 0x241016, veinColor: 0xff5a7a, veinAmount: 1.0, breath: 0.25, rim: 0.9, rimColor: 0x6a1a2a, roughness: 0.35 });
  const lips = mesh(lipG, lipMat, { name: 'lips' }); root.add(lips);
  const teethTop = mesh(teethRing({ rx: 5.2, ry: 4.0, count: Math.round(34 * Math.max(0.6, D)), len: 1.9, seed: 9 }), mats.bone, { name: 'teeth' });
  teethTop.position.set(M.x, M.y, M.z + 0.5); root.add(teethTop);
  const teeth2 = mesh(teethRing({ rx: 4.2, ry: 3.2, count: 26, len: 1.3, seed: 19, inward: 1.2 }), mats.bone);
  teeth2.position.set(M.x, M.y, M.z - 1.5); root.add(teeth2);
  // sleeping eyes above the mouth: closed lids with lashes
  const eyes = [];
  for (const s of [-1, 1]) {
    const lid = blobGeometry(4.2, { detail: 4, noise: 0.08, squash: [1.5, 0.7, 0.7], seed: 30 + s }); lid.translate(s * 9, 15.5, -54.8); eyes.push(lid);
  }
  root.add(mesh(merge(eyes), lipMat, { name: 'face-eyes' }));
  const lashSamples = [];
  for (const s of [-1, 1]) for (let i = 0; i < 40; i++) { const t = (i / 39) * Math.PI; const x = s * 9 + Math.cos(t) * 6.0, y = 15.0 - Math.sin(t) * 1.4; lashSamples.push({ p: V(x, y, -52.4), n: V(Math.cos(t) * 0.3, -1, 0.6).normalize() }); }
  const lashes = ciliaField(lashSamples, { length: 2.6, width: 0.09, tip: 0x2a1018, root: 0x07040a, lengthJitter: 0.4, rng }); root.add(lashes);
  // throat glow
  const throatLight = new THREE.PointLight(0xff4a6a, 120, 30, 2); throatLight.position.set(M.x, M.y - 1, M.z - 6); root.add(throatLight);
  collision.addGround(mawFloor);
  // jaw slowly works
  updaters.push((dt, t) => {
    const open = 0.5 + 0.5 * Math.sin(t * 0.21);
    lips.scale.y = 0.94 + open * 0.1; lips.position.y = (1 - lips.scale.y) * M.y;
    teethTop.scale.setScalar(0.96 + open * 0.06);
    throatLight.intensity = 90 + 70 * open + U.heartbeat.value * 60;
  });

  // ------------------------------------------------------------------ dangling spines from the crown
  // catenary chains of small vertebrae hanging from the crown and between ribs: they sway.
  const chainMats = [];
  const chainCurves = [];
  for (let i = 0; i < Math.round(14 * D) + 4; i++) {
    const a = rng() * Math.PI * 2, r0 = 8 + rng() * 18;
    const A = L.crown.clone().add(V(Math.cos(a) * r0 * 0.4, -6, Math.sin(a) * r0 * 0.4));
    const B = L.crown.clone().add(V(Math.cos(a + 0.8) * r0, -10 - rng() * 10, Math.sin(a + 0.8) * r0));
    const sag = 14 + rng() * 22;
    const mid = A.clone().lerp(B, 0.5).add(V(0, -sag, 0));
    const c = new THREE.QuadraticBezierCurve3(A, mid, B);
    chainCurves.push(c);
    chainMats.push(...vertebraeAlong(c, 1.1, (t) => 0.32 + 0.1 * Math.sin(t * Math.PI), V(0, -1, 0)));
  }
  const chain = new THREE.InstancedMesh(vgeo, mats.bone, chainMats.length);
  chainMats.forEach((m, i) => chain.setMatrixAt(i, m)); chain.castShadow = true; chain.name = 'spine-chains';
  const chainGroup = new THREE.Group(); chainGroup.add(chain); root.add(chainGroup);
  chainGroup.position.copy(L.crown); chain.position.copy(L.crown).negate();
  updaters.push((dt, t) => { chainGroup.rotation.z = Math.sin(t * 0.17) * 0.025; chainGroup.rotation.x = Math.sin(t * 0.13 + 1) * 0.02; });

  // ------------------------------------------------------------------ floor detail: bone shards, glowing fungus
  const shardG = new THREE.ConeGeometry(0.07, 0.6, 5, 2); shardG.translate(0, 0.25, 0);
  const shardMats = [], fungMats = [];
  for (let i = 0; i < Math.round(700 * D); i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * (L.platformR - 3);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = hubFloor(x, z); if (h === null) continue;
    if (Math.hypot(x - L.ritual.x, z - L.ritual.z) < L.ritualR + 2.6) continue;
    if (Math.hypot(x - L.sword.x, z - L.sword.z) < 3.5) continue;
    // cluster near the rim and around posts
    if (r < L.platformR * 0.7 && rng() < 0.85) continue;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 1.4, rng() * 6.28, (rng() - 0.5) * 1.4));
    const sc = 0.3 + rng() * 0.7;
    if (rng() < 0.55) shardMats.push(new THREE.Matrix4().compose(V(x, h - 0.05, z), q, V(sc, sc, sc)));
    else fungMats.push(new THREE.Matrix4().compose(V(x, h, z), new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - 0.5) * 0.4, 0, (rng() - 0.5) * 0.4)), V(sc * 0.8, sc * (0.6 + rng()), sc * 0.8)));
  }
  const shards = new THREE.InstancedMesh(shardG, mats.bone, shardMats.length);
  shardMats.forEach((m, i) => shards.setMatrixAt(i, m)); shards.castShadow = true; shards.receiveShadow = true; shards.name = 'bone-shards';
  root.add(shards);
  // fungus: a stalk with a luminous cap
  const stalk = new THREE.CylinderGeometry(0.03, 0.05, 0.4, 6); stalk.translate(0, 0.2, 0);
  const cap = new THREE.SphereGeometry(0.11, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); cap.scale(1, 0.6, 1); cap.translate(0, 0.4, 0);
  const fungG = merge([stalk, cap]);
  const fungMat = organicMaterial({ color: 0x3a3040, color2: 0x1a1020, veinColor: 0x6fd4c4, veinAmount: 1.2, veinScale: 4.0, breath: 0.01, rim: 0.6, rimColor: 0x2f8a80, emissive: 0x05201c, roughness: 0.4 });
  const fung = new THREE.InstancedMesh(fungG, fungMat, fungMats.length);
  fungMats.forEach((m, i) => fung.setMatrixAt(i, m)); fung.name = 'fungus';
  root.add(fung);

  // ------------------------------------------------------------------ floating debris drifting around the hub
  const debrisG = blobGeometry(1, { detail: 2, noise: 0.45, noiseScale: 1.6, seed: 61 });
  const nDeb = Math.round(70 * D);
  const debris = new THREE.InstancedMesh(debrisG, mats.stone, nDeb); debris.name = 'debris'; debris.castShadow = true;
  const debState = [];
  for (let i = 0; i < nDeb; i++) {
    const a = rng() * Math.PI * 2, r = 36 + rng() * 40, y = -30 + rng() * 70;
    debState.push({ a, r, y, s: 0.3 + Math.pow(rng(), 3) * 3.5, sp: (0.005 + rng() * 0.012) * (rng() < 0.5 ? -1 : 1), rot: rng() * 6, rs: (rng() - 0.5) * 0.2, bob: rng() * 6 });
  }
  root.add(debris);
  const dm = new THREE.Matrix4(), dq = new THREE.Quaternion(), de = new THREE.Euler(), dsv = new THREE.Vector3(), dp = new THREE.Vector3();
  updaters.push((dt, t) => {
    for (let i = 0; i < nDeb; i++) {
      const d = debState[i]; const a = d.a + t * d.sp;
      dp.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.3 + d.bob) * 0.8, Math.sin(a) * d.r);
      de.set(d.rot + t * d.rs, d.rot * 2 + t * d.rs * 0.7, 0); dq.setFromEuler(de); dsv.setScalar(d.s);
      debris.setMatrixAt(i, dm.compose(dp, dq, dsv));
    }
    debris.instanceMatrix.needsUpdate = true;
  });

  // ------------------------------------------------------------------ cilia: thousands of hairs
  const cN = quality.particles * 2.6;
  const floorSamples = scatterOnGeometry(rim, Math.round(cN * 0.35), rng, (p, n) => n.y > -0.2);
  cilia.push(ciliaField(floorSamples, { length: 0.8, width: 0.022, tip: 0x7fd6c8, root: 0x0e0a0c, rng }));
  const pillarSamples = scatterOnGeometry(pillarStrandG, Math.round(cN * 0.12), rng, (p) => p.y > -30 && p.y < 40);
  cilia.push(ciliaField(pillarSamples, { length: 1.0, width: 0.05, tip: 0xff7ab0, root: 0x120a0e, rng }));
  const bellySamples = scatterOnGeometry(belly, Math.round(cN * 0.3), rng);
  cilia.push(ciliaField(bellySamples, { length: 1.8, width: 0.05, tip: 0xffb060, root: 0x120a0a, rng }));
  const lipSamples = scatterOnGeometry(lipG, Math.round(cN * 0.08), rng);
  cilia.push(ciliaField(lipSamples, { length: 0.9, width: 0.05, tip: 0xff5a7a, root: 0x14060a, rng }));
  cilia.forEach((c) => root.add(c));

  // ------------------------------------------------------------------ pillars as colliders? (they stand outside the walkable rim)
  return {
    root, rim, pillarTops,
    update(dt, t) { for (const u of updaters) u(dt, t); },
  };
}
