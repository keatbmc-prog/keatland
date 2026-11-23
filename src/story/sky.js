// The big desert sky over Keatland Reception: a deep zenith blue falling to a dusty pale horizon,
// a hot afternoon sun with a wide warm glow, drifting fair-weather cumulus, and a ring of mesas and
// far ranges that the haze pushes back. Also builds a matching daylight environment map so metal
// and glass pick up the sky instead of the hub's dark room.
import * as THREE from 'three';
import { GLSL_NOISE, mulberry32, fbm3 } from '../core/noise.js';
import { U } from '../materials/library.js';

export const SUN_DIR = new THREE.Vector3(-0.8, 0.42, 0.42).normalize();

const skyFrag = /* glsl */`
  varying vec3 vDir; uniform vec3 uSun; uniform float uTime; uniform float uClouds;
  ${GLSL_NOISE}
  vec3 skyCol(vec3 d){
    float y = max(d.y, -0.05);
    // alien afternoon: deep teal-violet zenith, a magenta band, a hot orange horizon
    vec3 zen = vec3(0.10, 0.16, 0.48), mid = vec3(0.10, 0.62, 0.72), band = vec3(0.95, 0.38, 0.72), hor = vec3(1.0, 0.68, 0.42);
    vec3 c = mix(hor, band, smoothstep(0.0, 0.12, y));
    c = mix(c, mid, smoothstep(0.10, 0.36, y));
    c = mix(c, zen, smoothstep(0.32, 0.95, y));
    float s = max(dot(d, uSun), 0.0);
    c += vec3(1.0, 0.62, 0.35) * pow(s, 6.0) * 0.45 + vec3(1.0, 0.85, 0.6) * pow(s, 64.0) * 0.6;
    c = mix(c, vec3(1.0, 0.62, 0.50), 1.0 - smoothstep(-0.02, 0.06, d.y)); // glowing haze at the horizon
    return c;
  }
  void main(){
    vec3 d = normalize(vDir);
    vec3 c = skyCol(d);
    // sun disc
    float s = dot(d, uSun);
    c += vec3(1.6, 1.4, 1.1) * smoothstep(0.9993, 0.9997, s) * 6.0;
    // a huge ringed planet hanging over the mesas, and a little teal moon
    {
      vec3 pd = normalize(vec3(0.55, 0.30, -0.78)); float R = 0.16;
      vec3 pu = normalize(cross(pd, vec3(0.0, 1.0, 0.0))); vec3 pv = cross(pu, pd);
      float dd = dot(d, pd);
      vec2 q = vec2(dot(d, pu), dot(d, pv)) / max(dd, 0.01);
      // the ring (tilted ellipse), hidden behind the planet's upper half
      vec2 rq = vec2(q.x * cos(0.35) - q.y * sin(0.35), q.x * sin(0.35) + q.y * cos(0.35));
      float rr = length(vec2(rq.x, rq.y * 4.2));
      float ringM = smoothstep(0.205, 0.215, rr) * (1.0 - smoothstep(0.30, 0.31, rr)) * step(0.0, dd);
      float inDisc = 1.0 - smoothstep(R - 0.004, R, length(q));
      float behind = inDisc * step(0.0, rq.y);
      vec3 ringC = mix(vec3(1.0, 0.55, 0.85), vec3(0.4, 1.0, 0.9), smoothstep(0.22, 0.30, rr)) * (0.75 + 0.25 * sin(rr * 260.0));
      if (dd > 0.0 && inDisc > 0.0) {
        vec3 n = normalize(vec3(q / R, sqrt(max(0.0, 1.0 - dot(q, q) / (R * R)))));
        float lit = clamp(dot(n, normalize(vec3(-0.7, 0.4, 0.6))), 0.0, 1.0);
        float bands = sin(q.y * 70.0 + kl_snoise(vec3(q * 18.0, 1.0)) * 2.0);
        vec3 pc = mix(vec3(0.85, 0.22, 0.55), vec3(1.0, 0.62, 0.30), 0.5 + 0.5 * bands);
        pc = mix(pc * 0.25 + vec3(0.12, 0.05, 0.25), pc * 1.15, smoothstep(0.0, 0.6, lit));
        c = mix(c, pc, inDisc);
        c += vec3(0.5, 1.0, 0.9) * pow(1.0 - n.z, 4.0) * inDisc * 0.8; // rim glow
      }
      c = mix(c, ringC, ringM * 0.85 * (1.0 - behind));
      vec3 md = normalize(vec3(-0.35, 0.55, -0.75)); float mm = dot(d, md);
      c = mix(c, vec3(0.35, 1.0, 0.85), smoothstep(0.99935, 0.9995, mm));
      c += vec3(0.2, 0.9, 0.8) * pow(max(mm, 0.0), 900.0) * 0.4;
    }
    // clouds: flattened fbm on a dome, brighter toward the sun, grey bellies
    if (d.y > 0.0 && uClouds > 0.0) {
      vec2 p = d.xz / (d.y + 0.12) * 1.3 + vec2(uTime * 0.004, uTime * 0.0015);
      float n = kl_fbm(vec3(p * 1.4, 0.3)) * 0.6 + kl_fbm(vec3(p * 3.6, 1.7)) * 0.3;
      float cov = smoothstep(0.08, 0.42, n) * smoothstep(0.0, 0.12, d.y) * uClouds;
      float lit = 0.75 + 0.35 * pow(max(s, 0.0), 3.0);
      // toon clouds: hard-ish edges, violet bellies, pink-lit tops
      vec3 cc = mix(vec3(0.55, 0.36, 0.78), vec3(1.1, 0.80, 0.92) * lit, smoothstep(0.24, 0.30, n));
      cov = smoothstep(0.18, 0.24, n) * smoothstep(0.0, 0.12, d.y) * uClouds;
      c = mix(c, cc, cov * 0.95);
    }
    gl_FragColor = vec4(c, 1.0);
  }`;

export function storySky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: U.time, uClouds: { value: 1 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: skyFrag,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10; mesh.name = 'story-sky';
  return mesh;
}

/** A matching daylight environment for reflections (PMREM). */
export function storyEnvironment(renderer) {
  const pm = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uSun: { value: SUN_DIR.clone() }, uTime: { value: 0 }, uClouds: { value: 0 } }, vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }', fragmentShader: skyFrag });
  env.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), m));
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), new THREE.MeshBasicMaterial({ color: 0x9a5a7a })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.5; env.add(ground);
  const tex = pm.fromScene(env, 0.02).texture; pm.dispose();
  return tex;
}

/** Mesas and far ranges around `center` (world). Vertex-coloured strata, flat tops, talus skirts. */
export function mesaRing(center, { rng = mulberry32(31), count = 16 } = {}) {
  const geos = [];
  const strata = [new THREE.Color(0xe0507a), new THREE.Color(0xff8a4a), new THREE.Color(0x8a3aa0), new THREE.Color(0xffb35a), new THREE.Color(0x2a8a9a)]; // candy strata
  const mesa = (cx, cz, R, H, seed) => {
    const rr = mulberry32(seed), seg = 40;
    const rings = [[1.75, 0], [1.35, 0.22], [1.08, 0.5], [1.02, 0.86], [1.0, 1.0], [0.0, 1.0]];
    const pos = [], col = [], idx = [];
    const wob = []; for (let i = 0; i < seg; i++) wob.push(0.75 + 0.5 * rr());
    for (let k = 0; k < rings.length; k++) {
      const [rs, hs] = rings[k];
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2, w = wob[i % seg] * (0.85 + 0.3 * fbm3(Math.cos(a) * 2 + seed, hs * 3, Math.sin(a) * 2, 2));
        const r = R * rs * (k === 5 ? 0 : w);
        pos.push(cx + Math.cos(a) * r, hs * H + (k === 0 ? -2 : 0), cz + Math.sin(a) * r);
        const c = strata[Math.floor(hs * 9 + seed) % strata.length].clone().multiplyScalar(k === 0 ? 0.85 : 1);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let k = 0; k < rings.length - 1; k++) for (let i = 0; i < seg; i++) { const a = k * (seg + 1) + i, b = a + seg + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    geos.push(g);
  };
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng() * 0.3, d = 650 + rng() * 900;
    if (rng() < 0.25) continue;
    mesa(center.x + Math.cos(a) * d, center.z + Math.sin(a) * d, 50 + rng() * 140, 35 + rng() * 90, i * 13 + 1);
  }
  // far ranges: a jagged ring
  {
    const seg = 220, pos = [], col = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2, d = 2050;
      const h = 40 + 110 * Math.max(0, fbm3(Math.cos(a) * 3, 0.5, Math.sin(a) * 3, 4) + 0.35) + 25 * Math.abs(Math.sin(a * 23));
      pos.push(center.x + Math.cos(a) * d, -10, center.z + Math.sin(a) * d, center.x + Math.cos(a) * d, h, center.z + Math.sin(a) * d);
      col.push(0.35, 0.22, 0.55, 0.55, 0.30, 0.70);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    geos.push(g);
  }
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide });
  geos.forEach((g) => { const m = new THREE.Mesh(g, mat); m.position.y = center.y; group.add(m); });
  return group;
}
