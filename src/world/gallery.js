// The gallery inside the photo cube: a low, ribbed, breathing chamber where Keaten's photos hang as
// framed works, each lit by its own little hanging lamp-pod, light cone and warm wash on the wall.
// It sits far from the hub (its own realm); the camera reaches it by diving into the cube.
//
// Everything is generated from the photo list, so adding photos to public/gallery/manifest.json
// simply widens the room and hangs more frames: two tiers of pieces, one photo per frame, never
// repeated. The lower tier is lit from lamp-pods at its foot, the upper tier from pods above it.
// Per-piece trimmings (mats, washes, light cones, lamp glows) are merged into a handful of meshes,
// so a wider room costs one draw call per photo and not five.
import * as THREE from 'three';
import { sweepGeometry, blobGeometry } from '../geometry/sweep.js';
import { merge, tendrilTree, vertebraGeometry, vertebraeAlong } from '../geometry/generators.js';
import { organicMaterial, getTextures, U } from '../materials/library.js';
import { ciliaField, sporeField } from '../render/effects.js';
import { lightShaft, glowSprite } from '../entities/heart.js';
import { PhotoCube } from '../entities/photoCube.js';
import { mulberry32, fbm3 } from '../core/noise.js';

export const G = new THREE.Vector3(400, -400, 400); // chamber floor centre (far from everything)
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Photo surface: not lit by scene lights but by its own painted spotlight pool (cheap per-piece light). */
function photoMaterial(tex, seed) {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: null }, uHover: { value: 0 }, uSeed: { value: seed }, uI: { value: 0.62 }, uLampY: { value: 1.05 } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){ vec3 transformed = position; vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uMap; uniform float uHover; uniform float uSeed; uniform float uI; uniform float uLampY;
      varying vec2 vUv; varying vec3 vW; varying vec3 vN;
      void main(){
        vec3 c = texture2D(uMap, vUv).rgb;
        // the pool of light from the lamp above: brightest top-centre, falling off, slight flicker
        vec2 d = vUv - vec2(0.5, uLampY);
        float pool = exp(-(d.x * d.x * 2.2 + d.y * d.y * 0.9));
        float flick = 0.94 + 0.06 * sin(fogFar * 7.0 + uSeed * 13.0) * sin(fogFar * 2.3 + uSeed);
        float vig = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
        float lightI = (0.1 + pool * 0.95 * flick) * (0.55 + 0.45 * vig) * (1.0 + uHover * 0.35);
        // varnish: a soft specular band that slides as you move
        vec3 vdir = normalize(cameraPosition - vW);
        float sheen = pow(max(0.0, dot(reflect(-vdir, normalize(vN)), normalize(vec3(0.0, 1.0, 0.25)))), 24.0) * 0.12;
        vec3 col = c * lightI * uI * vec3(1.0, 0.95, 0.86) + sheen * vec3(1.0, 0.9, 0.75);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

/** Additive warm wash on the wall behind a piece. */
function washMaterial(color) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uHeart: U.heartbeat },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`
      varying vec2 vUv; uniform vec3 uColor; uniform float uHeart;
      void main(){ vec2 d = (vUv - vec2(0.5, 0.78)) * vec2(1.3, 1.0); float a = exp(-dot(d, d) * 9.0) * 0.07 * (1.0 + uHeart * 0.15);
        gl_FragColor = vec4(uColor * a, 1.0); }`,
  });
}

export function buildGallery({ scene, mats, quality, collision, photos }) {
  const D = quality.detail;
  const rng = mulberry32(777);
  const root = new THREE.Group(); root.name = 'gallery'; scene.add(root);
  const updaters = [];
  const NP = photos.length, TIERS = NP > 18 ? 2 : 1, N = Math.ceil(NP / TIERS); // N = columns round the wall
  const R = Math.max(11, (N * 3.6) / (Math.PI * 2));
  const H = 6.5;
  const frameAngle = (i) => (i / N) * Math.PI * 2 + Math.PI / N;
  const alcove = (a) => { const i = Math.round(((a - Math.PI / N) / (Math.PI * 2)) * N); let k = 0; for (const j of [i - 1, i, i + 1]) { const d = Math.atan2(Math.sin(a - frameAngle(j)), Math.cos(a - frameAngle(j))); k = Math.max(k, Math.exp(-Math.pow(d * R / 1.9, 4))); } return k; };
  const tierY = TIERS === 2 ? [2.05, 4.4] : [2.35], tierH = TIERS === 2 ? 1.78 : 2.05; // photo centre heights / max photo height

  // ------------------------------------------------------------------ floor
  const floorG = new THREE.CircleGeometry(R + 1.5, 128, 0, Math.PI * 2);
  floorG.rotateX(-Math.PI / 2);
  { const p = floorG.attributes.position, uv = floorG.attributes.uv; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); uv.setXY(i, x / 6, z / 6); p.setY(i, 0.05 * fbm3(x * 0.2, 0, z * 0.2, 2)); } floorG.computeVertexNormals(); }
  const floor = new THREE.Mesh(floorG, mats.floor); floor.position.copy(G); floor.receiveShadow = true; root.add(floor);
  // inner ring of darker flesh where floor meets wall
  collision.addGround((x, z) => { const r = Math.hypot(x - G.x, z - G.z); return r < R - 1.3 ? G.y : null; });

  // ------------------------------------------------------------------ walls: one breathing skin with an alcove per piece
  const wallMat = organicMaterial({ color: 0x2b1b1f, color2: 0x0c0607, veinColor: 0xff9a6a, veinAmount: 0.22, veinScale: 0.9, breath: 0.08, roughness: 0.7, rim: 0.25, rimColor: 0x3a1a1a, side: THREE.DoubleSide });
  const segA = Math.round(220 * Math.max(0.6, D)), segY = 40;
  const wallPos = [], wallIdx = [], wallUv = [];
  for (let j = 0; j <= segY; j++) {
    const v = j / segY;
    // wall rises then curves inward into a low dome
    const ang = v * Math.PI * 0.5;
    const yy = v < 0.55 ? (v / 0.55) * H : H + Math.sin(((v - 0.55) / 0.45) * Math.PI * 0.5) * R * 0.45;
    const rr0 = v < 0.55 ? 1 : Math.cos(((v - 0.55) / 0.45) * Math.PI * 0.5);
    for (let i = 0; i <= segA; i++) {
      const a = (i / segA) * Math.PI * 2;
      const al = alcove(a) * (TIERS === 2 ? Math.exp(-Math.pow((yy - 3.25) / 2.5, 4)) : Math.exp(-Math.pow((yy - 2.3) / 2.6, 2))) * (v < 0.6 ? 1 : 0);
      const ribs = 0.25 * Math.pow(Math.abs(Math.sin(a * N + 1.0)), 6) * (1 - al);
      const n = 0.45 * fbm3(Math.cos(a) * 3, yy * 0.25, Math.sin(a) * 3, 4);
      const r = (R + 0.8 * al - ribs + n) * Math.max(0.02, rr0) + 0.5 * (1 - rr0) * fbm3(a * 2, v * 5, 1, 2);
      wallPos.push(G.x + Math.cos(a) * r, G.y + yy, G.z + Math.sin(a) * r);
      wallUv.push((i / segA) * 24, v * 6);
    }
  }
  for (let j = 0; j < segY; j++) for (let i = 0; i < segA; i++) {
    const a = j * (segA + 1) + i, b = a + segA + 1;
    wallIdx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const wallG = new THREE.BufferGeometry();
  wallG.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallG.setAttribute('uv', new THREE.Float32BufferAttribute(wallUv, 2));
  wallG.setIndex(wallIdx); wallG.computeVertexNormals();
  const n0 = wallPos.length / 3;
  wallG.setAttribute('aSway', new THREE.Float32BufferAttribute(new Float32Array(n0), 1));
  wallG.setAttribute('aPhase', new THREE.Float32BufferAttribute(new Float32Array(n0), 1));
  const wall = new THREE.Mesh(wallG, wallMat); wall.receiveShadow = true; root.add(wall);

  // ------------------------------------------------------------------ vertebral ribs climbing between the pieces and meeting overhead
  const vgeo = vertebraGeometry(11, D);
  const ribMats = [];
  const ribEvery = D < 0.8 && N > 16 ? 2 : 1, ribStep = D < 0.8 ? 0.95 : 0.62; // a wide room on a phone: half the ribs, sparser vertebrae
  for (let i = 0; i < N; i += ribEvery) {
    const a = (i / N) * Math.PI * 2;
    const pts = [];
    for (let k = 0; k <= 12; k++) {
      const v = k / 12;
      const yy = v < 0.5 ? (v / 0.5) * H : H + Math.sin(((v - 0.5) / 0.5) * Math.PI * 0.5) * R * 0.42;
      const rr = (v < 0.5 ? 1 : Math.cos(((v - 0.5) / 0.5) * Math.PI * 0.5) * 0.92 + 0.08) * (R - 0.45);
      pts.push(V(G.x + Math.cos(a) * rr, G.y + yy, G.z + Math.sin(a) * rr));
    }
    const c = new THREE.CatmullRomCurve3(pts);
    ribMats.push(...vertebraeAlong(c, ribStep, (t) => 0.2 + 0.07 * Math.sin(t * Math.PI), V(0, 1, 0).add(V(-Math.cos(a), 0, -Math.sin(a)))));
  }
  const ribs = new THREE.InstancedMesh(vgeo, mats.bone, ribMats.length);
  ribMats.forEach((m, i) => ribs.setMatrixAt(i, m)); root.add(ribs);

  // ------------------------------------------------------------------ hanging growth from the dome, with lamp pods
  const hang = [], hangPods = [];
  for (let i = 0; i < Math.round(10 * D) + 4; i++) {
    const a = rng() * Math.PI * 2, r = rng() * R * 0.55;
    const t = tendrilTree({ start: V(G.x + Math.cos(a) * r, G.y + H + R * 0.4 * Math.cos((r / R) * 1.2), G.z + Math.sin(a) * r), dir: V(0, -1, 0), length: 2 + rng() * 3, radius: 0.08 + rng() * 0.06, depth: Math.max(1, quality.tendrilDepth - 1), gravity: 0.9, curl: 0.5, rng, detail: D * 0.7, podChance: 0.5, children: 2 });
    hang.push(t.body); if (t.pods) hangPods.push(t.pods);
  }
  root.add(new THREE.Mesh(merge(hang), mats.sinew));
  const podMat = organicMaterial({ sway: 1.4, color: 0x5a2a20, color2: 0x200a08, veinColor: 0xffb060, veinAmount: 1.6, veinScale: 1.2, breath: 0.05, rim: 2.0, rimColor: 0xff7a3a, emissive: 0x401204, roughness: 0.35 });
  if (hangPods.length) root.add(new THREE.Mesh(merge(hangPods), podMat));

  // ------------------------------------------------------------------ the pieces
  const frames = [];
  const frameMats = [
    organicMaterial({ color: 0x8a6a3a, color2: 0x2a1a0a, veinColor: 0xffc27a, veinAmount: 0.15, breath: 0, roughness: 0.32, metalness: 0.65, rim: 0.4, rimColor: 0x6a4a2a, normalMap: getTextures().barkNormal, normalScale: 0.8 }),
    mats.bone,
    organicMaterial({ color: 0x1a1418, color2: 0x050304, veinColor: 0xd9467f, veinAmount: 0.4, veinScale: 2.0, breath: 0, roughness: 0.25, rim: 0.7, rimColor: 0x23304a, normalMap: null }),
  ];
  const lampMat = organicMaterial({ color: 0x6a3a20, color2: 0x2a0a04, veinColor: 0xffd090, veinAmount: 2.0, veinScale: 3.0, breath: 0.1, rim: 2.2, rimColor: 0xffb070, emissive: 0xffa050, emissiveIntensity: 1.6, roughness: 0.3 });
  const frameGeoms = [[], [], []], thorns = [], lamps = [], stems = [], backs = [], washes = [], shafts = [], glowPts = [];
  const photoMeshes = []; let shaftMat = null;
  const thornG = new THREE.ConeGeometry(0.035, 0.22, 5); thornG.translate(0, 0.11, 0);
  photos.forEach((ph, i) => {
    const col = i % N, tier = Math.floor(i / N), low = TIERS === 2 && tier === 0; // the lower tier is lit from below
    const a = frameAngle(col);
    const inward = V(-Math.cos(a), 0, -Math.sin(a));
    let h = tierH, w = h * ph.aspect;
    if (w > 2.6) { w = 2.6; h = w / ph.aspect; }
    const cy = tierY[tier];
    const rr = R + 0.25;
    const center = V(G.x + Math.cos(a) * rr, G.y + cy, G.z + Math.sin(a) * rr);
    const grp = new THREE.Group(); grp.position.copy(center); grp.lookAt(center.clone().add(inward)); root.add(grp);
    grp.updateMatrixWorld();
    const M = grp.matrixWorld;
    // photo
    const pm = photoMaterial(ph.full, i * 1.7);
    pm.uniforms.uMap.value = ph.full; pm.uniforms.uLampY.value = low ? -0.05 : 1.05;
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, h), pm); photo.position.z = 0.06; grp.add(photo);
    photo.userData = { index: i, postUrl: ph.postUrl, caption: ph.caption };
    photoMeshes.push(photo);
    // dark mat behind
    const bg = new THREE.PlaneGeometry(w + 0.36, h + 0.36); bg.applyMatrix4(M); backs.push(bg);
    // knotted frame: a closed sweep around the photo, thickened at the corners
    const hw = w / 2 + 0.13, hh = h / 2 + 0.13, cr = 0.12;
    const pts = [];
    const corners = [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]];
    for (let k = 0; k < 4; k++) {
      const [x0, y0] = corners[k], [x1, y1] = corners[(k + 1) % 4];
      for (let s = 0; s < 8; s++) { const u = s / 8; pts.push(V(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0.08 + 0.02 * Math.sin(u * Math.PI * 3 + i))); }
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    const fg = sweepGeometry(curve, { closed: true, tubular: Math.round(160 * Math.max(0.6, D)), radial: 10, radius: (t) => 0.075 + 0.045 * Math.pow(Math.abs(Math.sin(t * Math.PI * 4)), 6) + 0.022 * Math.pow(Math.abs(Math.sin(t * 61 + i)), 8), noise: 0.025, noiseScale: 6 });
    fg.applyMatrix4(M);
    frameGeoms[i % 3].push(fg);
    // thorns along the top edge, curling up
    for (let k = 0; k < 9 && !low; k++) { // no thorns on the lower tier (they would poke the piece above)
      const x = -hw + (k + 0.5) * (2 * hw / 9);
      const m = new THREE.Matrix4().compose(V(x, hh + 0.05, 0.08), new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 * (rng() - 0.3), 0, (rng() - 0.5) * 0.7)), V(1, 0.6 + rng() * 0.9, 1));
      const g = thornG.clone(); g.applyMatrix4(m); g.applyMatrix4(M); thorns.push(g);
    }
    // the lamp: a glowing pod on a curled stem leaning out over the piece
    const ly = low ? -1 : 1; // lower tier: the pod curls up from below the piece (footlight)
    const stemC = new THREE.CatmullRomCurve3([V(0, ly * (hh + 0.1), 0.05), V(0.15, ly * (hh + 0.75), 0.25), V(-0.05, ly * (hh + 0.95), 0.75), V(0, ly * (hh + 0.7), 0.95)]);
    const sg = sweepGeometry(stemC, { tubular: 24, radial: 6, radius: (t) => 0.035 * (1 - 0.5 * t) + 0.01 });
    sg.applyMatrix4(M); stems.push(sg);
    const lampLocal = V(0, ly * (hh + (low ? 0.45 : 0.62)), 0.98);
    const lg = blobGeometry(0.11, { detail: 2, noise: 0.25, seed: i, squash: [1, 1.4, 1] }); lg.translate(lampLocal.x, lampLocal.y, lampLocal.z); lg.applyMatrix4(M); lamps.push(lg);
    const lampW = lampLocal.clone().applyMatrix4(M);
    glowPts.push(lampW.x, lampW.y, lampW.z);
    // light cone from lamp to the piece and the wash on the wall
    const shaft = lightShaft({ from: lampW, to: center.clone().add(inward.clone().multiplyScalar(0.05)).add(V(0, -ly * h * 0.25, 0)), r0: 0.06, r1: Math.max(w, h) * 0.55, color: 0xffc890, intensity: 0.09 });
    shaft.updateMatrix(); const sLen = shaft.geometry.parameters.height; const shG = new THREE.CylinderGeometry(0.06, Math.max(w, h) * 0.55, sLen, D < 0.8 ? 14 : 24, 6, true); shG.translate(0, -sLen / 2, 0); // lighter than the stand-alone cone: 64 of them get merged shG.applyMatrix4(shaft.matrix); shafts.push(shG); shaftMat = shaftMat || shaft.material; shaft.geometry.dispose();
    const wg = new THREE.PlaneGeometry(w * 2.6, h * 2.4); if (low) { const uv = wg.attributes.uv; for (let q = 0; q < uv.count; q++) uv.setY(q, 1 - uv.getY(q)); }
    wg.translate(0, ly * h * 0.25, -0.02); wg.applyMatrix4(M); washes.push(wg);
    collision.addObstacle({ x: center.x + inward.x * 0.3, z: center.z + inward.z * 0.3, r: 0.25 });
    // where to stand to look at it
    const stand = center.clone().add(inward.clone().multiplyScalar(2.9)); stand.y = G.y;
    frames.push({ photo, group: grp, center, normal: inward.clone(), stand, w, h, postUrl: ph.postUrl, caption: ph.caption, index: i });
  });
  frameGeoms.forEach((gs, k) => { if (gs.length) { const m = new THREE.Mesh(merge(gs), frameMats[k]); m.castShadow = true; root.add(m); } });
  // the per-piece trimmings, each merged into one mesh
  root.add(new THREE.Mesh(merge(backs), frameMats[2]));
  { const m = new THREE.Mesh(merge(washes), washMaterial(0xffa868)); m.renderOrder = 1; root.add(m); }
  root.add(new THREE.Mesh(merge(shafts), shaftMat));
  { // lamp glows: one point sprite each, in a single Points draw (world-size like the old sprites)
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(glowPts, 3));
    const tex = glowSprite(0xffb070, 1, 0.7).material.map;
    root.add(new THREE.Points(pg, new THREE.PointsMaterial({ map: tex, color: 0xffb070, size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
  }
  root.add(new THREE.Mesh(merge(thorns), mats.bone));
  root.add(new THREE.Mesh(merge(stems), mats.sinew));
  root.add(new THREE.Mesh(merge(lamps), lampMat));

  // ------------------------------------------------------------------ centre: a plinth of fused vertebrae with a small cube (the way back)
  const plinthParts = [];
  // a short spine of fused vertebrae, each twisted a little further, wrapped by a sinew spiral
  const pv = vertebraGeometry(23, D);
  const plinthMats = [];
  for (let k = 0; k < 7; k++) {
    const sc = 0.42 - k * 0.025;
    plinthMats.push(new THREE.Matrix4().compose(V(G.x, G.y + 0.15 + k * 0.24, G.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, k * 0.9)), V(sc, sc, sc)));
  }
  const plinth = new THREE.InstancedMesh(pv, mats.bone, plinthMats.length); plinthMats.forEach((m, i) => plinth.setMatrixAt(i, m)); root.add(plinth);
  const spiral = []; for (let k = 0; k <= 40; k++) { const u = k / 40, a = u * Math.PI * 7; spiral.push(V(G.x + Math.cos(a) * (0.62 - u * 0.25), G.y + 0.05 + u * 1.75, G.z + Math.sin(a) * (0.62 - u * 0.25))); }
  plinthParts.push(sweepGeometry(new THREE.CatmullRomCurve3(spiral), { tubular: 160, radial: 8, radius: (t) => 0.06 * (1 - 0.5 * t) + 0.015 * Math.pow(Math.abs(Math.sin(t * 80)), 4) }));
  const cupG = blobGeometry(0.5, { detail: 3, noise: 0.18, seed: 5, squash: [1.1, 0.3, 1.1] }); cupG.translate(G.x, G.y + 1.85, G.z); plinthParts.push(cupG);
  root.add(new THREE.Mesh(merge(plinthParts), mats.sinew));
  collision.addObstacle({ x: G.x, z: G.z, r: 1.0 });
  const exitCube = new PhotoCube(photos, { size: 0.3, gap: 0.018, seed: 99, tempo: 1.3 });
  exitCube.group.position.set(G.x, G.y + 2.35, G.z); root.add(exitCube.group);
  const exitGlow = glowSprite(0xffc890, 3.2, 0.15); exitGlow.position.copy(exitCube.group.position); root.add(exitGlow);
  updaters.push((dt, t) => exitCube.update(dt, t));

  // floor cilia around the plinth and along the wall foot
  const samples = [];
  for (let i = 0; i < Math.round(2600 * D); i++) {
    const a = rng() * Math.PI * 2;
    const r = rng() < 0.35 ? 1.1 + rng() * 1.2 : R - 1.4 + rng() * 1.3;
    samples.push({ p: V(G.x + Math.cos(a) * r, G.y + 0.02, G.z + Math.sin(a) * r), n: V(0, 1, 0) });
  }
  root.add(ciliaField(samples, { length: 0.28, width: 0.012, tip: 0xffb070, root: 0x1a0a08, rng }));
  const spores = sporeField(Math.round(quality.particles * 0.25), { center: G.clone(), radius: R * 0.85, height: H + 3, yMin: G.y, rng });
  root.add(spores);

  // room lights: a warm one hanging in the dome, a dim cold one low
  const warm = new THREE.PointLight(0xffb880, 26, R * 2.2, 1.6); warm.position.copy(G).add(V(0, H + 1.5, 0)); root.add(warm);
  const cold = new THREE.PointLight(0x7fd6c8, 6, R * 1.6, 1.8); cold.position.copy(G).add(V(0, 0.6, 0)); root.add(cold);
  const domeGlow = glowSprite(0xffb070, 5, 0.25); domeGlow.position.copy(warm.position); root.add(domeGlow);

  const arrival = { pos: G.clone().add(V(0, 0, 4.2)), yaw: 0 };
  const ray = new THREE.Raycaster(); ray.far = 6.5;
  let hover = null;
  return {
    root, frames, exitCube, radius: R, arrival,
    update(dt, t) { updaters.forEach((f) => f(dt, t)); },
    /** The framed piece in the middle of the view (within reach), or null. */
    /** the photo under a screen point (normalised device coords), for taps on touch screens */
    pickAt(camera, ndc) {
      camera.updateMatrixWorld(); ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(photoMeshes, false)[0];
      return hit ? frames[hit.object.userData.index] : null;
    },
    pick(camera) {
      camera.updateMatrixWorld(); ray.setFromCamera(new THREE.Vector2(0, 0), camera);
      const hit = ray.intersectObjects(photoMeshes, false)[0];
      const f = hit ? frames[hit.object.userData.index] : null;
      if (hover && hover !== f) hover.photo.material.uniforms.uHover.value = 0;
      if (f) f.photo.material.uniforms.uHover.value = 1;
      hover = f;
      return f;
    },
    nearExit(p) { return Math.hypot(p.x - G.x, p.z - G.z) < 3.8; },
    touchingExit(p) { return Math.hypot(p.x - G.x, p.z - G.z) < 1.6; },
    /** Scale the whole chamber about a world point (the "you shrank" emergence). */
    scaleAbout(pivot, s) { root.scale.setScalar(s); root.position.copy(pivot).multiplyScalar(1 - s); },
  };
}

