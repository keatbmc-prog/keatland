// The lower place, reached only by being swallowed: the gullet (a real tunnel that runs from the
// Dreamer's mouth down through its body and opens into the void), the floating stairs from the
// prototype, and a small landing with the door: THE ONLY WAY OUT IS THROUGH.
import * as THREE from 'three';
import { L } from './layout.js';
import { sweepGeometry, blobGeometry } from '../geometry/sweep.js';
import { merge, tendrilTree } from '../geometry/generators.js';
import { radialSurface } from '../geometry/surfaces.js';
import { getTextures, U, organicMaterial } from '../materials/library.js';
import { textTexture } from '../materials/textures.js';
import { GLSL_NOISE, mulberry32, fbm3 } from '../core/noise.js';
import { glowSprite } from '../entities/heart.js';
import { ciliaField } from '../render/effects.js';
import { scatterOnGeometry } from '../geometry/generators.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export const GULLET = new THREE.CatmullRomCurve3([
  V(0, 5.5, -54), V(0, 4.5, -62), V(0, 0, -73), V(3, -13, -87), V(16, -38, -103), V(38, -70, -121), V(57, -97, -138), V(70, -112, -150), V(74, -116, -154),
], false, 'centripetal');

function tunnelMaterial() {
  const T = getTextures();
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uChecker: { value: T.checker }, uSwallow: { value: 0 } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      uniform float uTime; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        vUv = uv;
        vec3 transformed = position;
        // peristalsis: rings of muscle travel down the gullet
        float wave = sin(uv.y * 6.0 - uTime * 2.2);
        transformed -= normal * (0.35 * smoothstep(0.6, 1.0, wave) + 0.15 * kl_snoise(position * 0.3 + uTime * 0.2));
        vec4 w = modelMatrix * vec4(transformed, 1.0); vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform sampler2D uChecker; uniform float uTime; uniform float uSwallow; uniform float uHeart;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      ${GLSL_NOISE}
      void main(){
        // warped checkerboard (the prototype's tunnel) under wet flesh
        vec2 uv = vec2(vUv.x * 4.0 + sin(vUv.y * 3.0 + uTime * 0.3) * 0.3, vUv.y * 1.5 - uTime * 0.25);
        uv += vec2(kl_snoise(vec3(uv * 1.5, uTime * 0.1)) * 0.12);
        vec3 chk = texture2D(uChecker, uv).rgb;
        float n = kl_fbm(vW * 0.25);
        vec3 flesh = mix(vec3(0.16, 0.035, 0.06), vec3(0.03, 0.006, 0.012), n * 0.5 + 0.5);
        vec3 col = mix(flesh, chk * vec3(0.30, 0.16, 0.22), 0.30);
        float ring = smoothstep(0.85, 1.0, sin(vUv.y * 6.0 - uTime * 2.2));
        float ribs = pow(abs(sin(vUv.y * 40.0)), 12.0);
        vec3 V = normalize(cameraPosition - vW);
        float fres = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
        col += vec3(1.0, 0.25, 0.4) * ring * 0.35 + vec3(0.4, 0.9, 0.85) * ribs * 0.12;
        col += vec3(0.5, 0.12, 0.2) * fres * 0.6;
        col *= 0.55 + uSwallow * 0.35 + uHeart * 0.25;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

export function buildBelow({ scene, mats, quality, collision }) {
  const rng = mulberry32(808);
  const D = quality.detail;
  const root = new THREE.Group(); root.name = 'below'; scene.add(root);
  const updaters = [];
  // --- the gullet, inside and out
  const tMat = tunnelMaterial();
  tMat.uniforms.uTime = U.time; tMat.uniforms.uHeart = U.heartbeat;
  const radius = (t) => 4.4 + 1.3 * Math.sin(t * Math.PI) + 0.5 * Math.pow(Math.abs(Math.sin(t * 70)), 6) - 1.2 * Math.exp(-t * 30);
  const inner = sweepGeometry(GULLET, { tubular: Math.round(420 * Math.max(0.6, D)), radial: 28, radius, inside: true, noise: 0.08, noiseScale: 0.3 });
  const innerMesh = new THREE.Mesh(inner, tMat); innerMesh.frustumCulled = false; root.add(innerMesh);
  const outer = sweepGeometry(GULLET, { tubular: Math.round(200 * Math.max(0.6, D)), radial: 20, radius: (t) => radius(t) + 1.6 + 0.6 * Math.sin(t * 40), noise: 0.2, noiseScale: 0.12 });
  const outerMesh = new THREE.Mesh(outer, mats.flesh); outerMesh.castShadow = false; root.add(outerMesh);
  const gulletCilia = ciliaField(scatterOnGeometry(outer, Math.round(1500 * D), rng, (p) => p.y < -30), { length: 2.2, width: 0.09, tip: 0xff7ab0, root: 0x150a0e, rng });
  root.add(gulletCilia);
  // the exit lip
  const lipPts = []; const exitT = 0.985; const ep = GULLET.getPointAt(exitT), et = GULLET.getTangentAt(exitT);
  const en = new THREE.Vector3(0, 1, 0).cross(et).normalize(), eb = et.clone().cross(en).normalize();
  for (let i = 0; i < 36; i++) { const a = (i / 36) * Math.PI * 2; lipPts.push(ep.clone().addScaledVector(en, Math.cos(a) * 6.8).addScaledVector(eb, Math.sin(a) * 6.8)); }
  root.add(new THREE.Mesh(sweepGeometry(new THREE.CatmullRomCurve3(lipPts, true), { closed: true, tubular: 120, radial: 10, radius: (t) => 1.4 + 0.4 * Math.sin(t * 30), noise: 0.2, noiseScale: 0.5 }), mats.sinew));

  // --- floating stairs
  const stairCurve = new THREE.CatmullRomCurve3([L.below.stairsTop.clone(), V(83, -133, -178), V(86, -138, -194), V(77, -143, -204), V(70, -147.5, -208), V(70, -150, -211)]);
  const steps = [];
  const stepGeoms = [];
  const len = stairCurve.getLength(); const n = Math.floor(len / 1.55);
  for (let i = 0; i <= n; i++) {
    const t = i / n; const p = stairCurve.getPointAt(t), tan = stairCurve.getTangentAt(t);
    const yaw = Math.atan2(tan.x, tan.z);
    const w = 3.4, d = 1.9, h = 0.55 + rng() * 0.3;
    const g = new THREE.BoxGeometry(w, h, d, 6, 2, 4);
    const pa = g.attributes.position; const v = new THREE.Vector3();
    for (let k = 0; k < pa.count; k++) { v.fromBufferAttribute(pa, k); if (v.y < 0) { v.y -= 0.6 * (1 - Math.abs(v.x) / w * 1.5) * (0.6 + rng() * 0.8); } v.x += 0.05 * fbm3(v.y * 3 + i, v.z * 3, i, 2); pa.setXYZ(k, v.x, v.y, v.z); }
    g.computeVertexNormals();
    // hanging honeycomb dregs under each step
    const drip = blobGeometry(0.6 + rng() * 0.4, { detail: 2, noise: 0.4, squash: [1.6, 1.2, 0.9], seed: i }); drip.translate((rng() - 0.5) * 1.5, -1.1, 0); g.translate(0, -h / 2, 0);
    const sg = merge([g, drip]);
    const jitter = (rng() - 0.5) * 0.12;
    sg.rotateY(yaw + jitter); sg.rotateZ((rng() - 0.5) * 0.04);
    sg.translate(p.x, p.y, p.z);
    stepGeoms.push(sg);
    steps.push({ x: p.x, z: p.z, y: p.y, yaw: yaw + jitter, hw: w / 2, hd: d / 2 + 0.05, phase: rng() * 6 });
  }
  const stairMesh = new THREE.Mesh(merge(stepGeoms), organicMaterial({ color: 0x3a3634, color2: 0x121110, veinColor: 0x7fd6c8, veinAmount: 0.25, veinScale: 0.6, breath: 0, roughness: 0.8, emissive: 0xffffff, emissiveMap: getTextures().honeycomb, emissiveIntensity: 0.035, normalMap: getTextures().honeycombNormal, normalScale: 0.8, rim: 0.3, rimColor: 0x1a3a3a })); stairMesh.castShadow = true; stairMesh.receiveShadow = true; root.add(stairMesh);
  collision.addGround((x, z) => {
    let best = null;
    for (const s of steps) {
      const dx = x - s.x, dz = z - s.z; const c = Math.cos(-s.yaw), si = Math.sin(-s.yaw);
      const lx = dx * c + dz * si, lz = -dx * si + dz * c;
      if (Math.abs(lx) <= s.hw && Math.abs(lz) <= s.hd) { if (best === null || s.y > best) best = s.y; }
    }
    return best;
  });
  // ...and the stairs keep going down, forever (decor)
  const deep = [];
  for (let i = 0; i < 40; i++) {
    const a = i * 0.42; const g = new THREE.BoxGeometry(3.2, 0.6, 1.8); g.rotateY(a + Math.PI / 2);
    g.translate(70 + Math.cos(a) * 14, -156 - i * 1.6, -214 + Math.sin(a) * 14); deep.push(g);
  }
  root.add(new THREE.Mesh(merge(deep), mats.stone));

  // --- the landing island
  const lc = L.below.landing;
  const landR = (a) => 7.5 + 0.6 * Math.sin(a * 3) + 0.4 * Math.sin(a * 5 + 1);
  const landTop = radialSurface({ center: V(lc.x, lc.y, lc.z), outline: landR, sectors: 96, profile: [{ r: 0, y: 0 }, { r: 0.5, y: 0 }, { r: 0.85, y: 0.05 }, { r: 0.97, y: 0.4, noise: 0.3 }, { r: 1.0, y: 0.1 }], noiseScale: 0.4 });
  root.add(Object.assign(new THREE.Mesh(landTop, mats.floor), { receiveShadow: true }));
  const landBelly = radialSurface({ center: V(lc.x, lc.y, lc.z), outline: landR, sectors: 96, noise: 1.2, noiseScale: 0.2, profile: [{ r: 1.0, y: 0.1 }, { r: 1.02, y: -1.5 }, { r: 0.8, y: -5 }, { r: 0.45, y: -9 }, { r: 0.0, y: -14 }] });
  root.add(new THREE.Mesh(landBelly, mats.flesh));
  collision.addGround((x, z) => { const dx = x - lc.x, dz = z - lc.z; const r = Math.hypot(dx, dz); return r < landR(Math.atan2(dz, dx)) - 1.2 ? lc.y : null; });
  const roots = [];
  for (let i = 0; i < 6; i++) { const a = rng() * 6.28; const t = tendrilTree({ start: V(lc.x + Math.cos(a) * 3, lc.y - 8, lc.z + Math.sin(a) * 3), dir: V(0, -1, 0), length: 14 + rng() * 10, radius: 0.4, depth: 2, gravity: 0.6, rng, detail: D }); roots.push(t.body); }
  root.add(new THREE.Mesh(merge(roots), mats.sinew));

  // --- the door
  const dc = L.below.door;
  const doorParts = [];
  for (const s of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([V(dc.x + s * 2.2, dc.y - 0.5, dc.z), V(dc.x + s * 2.4, dc.y + 2.5, dc.z + 0.2), V(dc.x + s * 2.0, dc.y + 5.0, dc.z), V(dc.x + s * 0.8, dc.y + 6.4, dc.z - 0.1), V(dc.x, dc.y + 6.7, dc.z)]);
    doorParts.push(sweepGeometry(c, { tubular: 50, radial: 12, radius: (t) => 0.55 - 0.15 * t + 0.12 * Math.pow(Math.abs(Math.sin(t * 22)), 4), noise: 0.15, noiseScale: 0.8 }));
  }
  const knob = blobGeometry(0.28, { detail: 3, noise: 0.05 }); knob.translate(dc.x + 1.2, dc.y + 2.6, dc.z + 0.25); // a doorknob, of course
  root.add(new THREE.Mesh(merge(doorParts), mats.bone));
  const knobMesh = new THREE.Mesh(knob, new THREE.MeshStandardMaterial({ color: 0xc9a050, metalness: 1, roughness: 0.25 })); root.add(knobMesh);
  const portalMat = new THREE.ShaderMaterial({
    transparent: true, side: THREE.DoubleSide, depthWrite: false,
    uniforms: { uTime: U.time, uI: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform float uTime; uniform float uI; ${GLSL_NOISE}
      void main(){ vec2 p = vUv - 0.5; p.y *= 1.6; float r = length(p); float a = atan(p.y, p.x);
        float sw = sin(a * 3.0 + r * 18.0 - uTime * 1.8 + kl_snoise(vec3(p*3.0, uTime*0.2))*2.0);
        vec3 c = mix(vec3(0.02,0.01,0.03), vec3(0.95,0.85,0.35), smoothstep(0.6, 1.0, sw) * (1.0 - r*1.4));
        c += vec3(0.4, 0.85, 0.8) * smoothstep(0.35, 0.0, r) * 0.6;
        float edge = smoothstep(0.5, 0.42, r);
        gl_FragColor = vec4(c * uI, edge); }`,
  });
  const portal = new THREE.Mesh(new THREE.CircleGeometry(2.0, 48), portalMat); portal.scale.set(1, 1.55, 1); portal.position.set(dc.x, dc.y + 3.0, dc.z); root.add(portal);
  const doorLight = new THREE.PointLight(0xffd070, 55, 26, 2); doorLight.position.set(dc.x, dc.y + 3, dc.z + 2); root.add(doorLight);
  const halo = glowSprite(0xffd070, 9, 0.35); halo.position.copy(portal.position); root.add(halo);
  // the mantra: Keaten's own painted words
  const mantra = textTexture(['THE ONLY WAY', 'OUT IS THROUGH'], { width: 2048, height: 512, font: '150px "Permanent Marker"', color: '#f4e04d', glow: 'rgba(244,224,77,0.7)', lineHeight: 1.1, rotate: -0.03 });
  const mm = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: mantra, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color(0.9, 0.9, 0.9) }));
  mm.position.set(dc.x, dc.y + 8.8, dc.z - 0.2); root.add(mm);
  const landLight = new THREE.PointLight(0x9fd8ff, 260, 40, 2); landLight.position.set(lc.x + 4, lc.y + 10, lc.z + 6); root.add(landLight);
  updaters.push((dt, t) => { portalMat.uniforms.uI.value = 0.9 + 0.2 * Math.sin(t * 2); mm.position.y = dc.y + 8.8 + Math.sin(t * 0.6) * 0.15; });
  // stairs bob very slightly
  return {
    root, tunnelMat: tMat, steps, portal,
    update(dt, t) { updaters.forEach((u) => u(dt, t)); },
    doorTrigger(p) { return Math.abs(p.x - dc.x) < 1.8 && p.z < dc.z + 0.9 && p.z > dc.z - 2 && Math.abs(p.y - dc.y) < 3; },
  };
}
