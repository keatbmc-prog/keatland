// Small-scale living detail: cilia fields (thousands of instanced hairs that sway and recoil from
// the player), drifting spores, and the eyes that blink in the far darkness.
import * as THREE from 'three';
import { U } from '../materials/library.js';
import { GLSL_NOISE } from '../core/noise.js';

export const playerUniform = { value: new THREE.Vector3() };

export function ciliaField(samples, { length = 0.9, width = 0.05, tip = 0xff7ab0, root = 0x140a0e, lengthJitter = 0.6, rng = Math.random } = {}) {
  const geo = new THREE.ConeGeometry(width, 1, 4, 4, true);
  geo.translate(0, 0.5, 0);
  // cones point +Y; flip so the wide end is the root
  const count = samples.length;
  const mesh = new THREE.InstancedMesh(geo, bindShared(ciliaMaterial(tip, root)), count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const phase = new Float32Array(count);
  const Y = new THREE.Vector3(0, 1, 0);
  samples.forEach((smp, i) => {
    const n = smp.n.clone().lerp(new THREE.Vector3(0, smp.n.y > -0.3 ? 1 : -1, 0), 0.25).normalize();
    q.setFromUnitVectors(Y, n);
    const l = length * (1 - lengthJitter / 2 + rng() * lengthJitter);
    s.set(1 + rng(), l, 1 + rng());
    m.compose(smp.p, q, s);
    mesh.setMatrixAt(i, m);
    phase[i] = rng();
  });
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phase, 1));
  mesh.frustumCulled = false; // spread across the whole hub
  mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}

function ciliaMaterial(tip, root) {
  return new THREE.ShaderMaterial({
    fog: true,
    side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uTip: { value: new THREE.Color(tip) }, uRoot: { value: new THREE.Color(root) } }]),
    vertexShader: /* glsl */`
      #include <common>
      #include <fog_pars_vertex>
      attribute float aPhase;
      uniform float uTime; uniform vec3 uPlayer; uniform float uRitual; uniform vec3 uRitualPos;
      varying float vH; varying float vPh; varying float vNear;
      void main(){
        vec3 transformed = position;
        vec4 wp = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
        vec4 root = modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        vec4 tipW = modelMatrix * instanceMatrix * vec4(0.0,1.0,0.0,1.0);
        float h = position.y; float len = length(tipW.xyz - root.xyz);
        float t = uTime * (1.2 + aPhase) + aPhase * 6.28 + root.x * 0.3 + root.z * 0.2;
        vec3 bend = vec3(sin(t), 0.0, cos(t * 0.8)) * 0.25 + vec3(sin(t*3.1), 0.0, cos(t*2.7)) * 0.08;
        // recoil from the player, lean toward the ceremony
        vec3 away = root.xyz - uPlayer; away.y = 0.0;
        float d = length(away);
        float recoil = smoothstep(3.5, 0.5, d);
        bend += normalize(away + 1e-4) * recoil * 1.1;
        vec3 toR = uRitualPos - root.xyz; toR.y = 0.0;
        bend += normalize(toR + 1e-4) * uRitual * 0.35 * exp(-length(toR) * 0.03);
        wp.xyz += bend * h * h * len;
        wp.y -= recoil * h * h * len * 0.4;
        vH = h; vPh = aPhase; vNear = recoil;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      #include <common>
      #include <fog_pars_fragment>
      uniform vec3 uTip; uniform vec3 uRoot; uniform float uTime; uniform float uHeart;
      varying float vH; varying float vPh; varying float vNear;
      void main(){
        float glow = smoothstep(0.55, 1.0, vH);
        float pulse = 0.55 + 0.45 * sin(uTime * 2.0 + vPh * 12.0);
        vec3 c = mix(uRoot, uTip * (0.35 + 0.5 * pulse + uHeart * 0.4 + vNear * 1.2), glow);
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}

// patch shared uniforms in after creation (UniformsUtils.merge clones values)
export function bindShared(mat) {
  mat.uniforms.uTime = U.time; mat.uniforms.uPlayer = playerUniform; mat.uniforms.uRitual = U.ritual;
  mat.uniforms.uRitualPos = U.ritualPos; mat.uniforms.uHeart = U.heartbeat;
  return mat;
}

/** Spores / dust motes drifting through the whole hub volume. */
export function sporeField(count, { center = new THREE.Vector3(), radius = 80, height = 90, yMin = -40, rng = Math.random } = {}) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count), col = new Float32Array(count * 3);
  const palette = [new THREE.Color(0x7fd6c8), new THREE.Color(0xffc27a), new THREE.Color(0xd9b8c8), new THREE.Color(0xe05aa0)];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
    pos[i * 3] = center.x + Math.cos(a) * r; pos[i * 3 + 1] = yMin + rng() * height; pos[i * 3 + 2] = center.z + Math.sin(a) * r;
    seed[i] = rng();
    const c = palette[rng() < 0.55 ? 2 : rng() < 0.6 ? 0 : rng() < 0.7 ? 1 : 3];
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.time, uPx: { value: 1 }, uHeart: U.heartbeat },
    vertexShader: /* glsl */`
      attribute float aSeed; attribute vec3 aColor;
      uniform float uTime; uniform float uPx;
      varying vec3 vC; varying float vA;
      ${GLSL_NOISE}
      void main(){
        vec3 p = position;
        float t = uTime * 0.05;
        p += vec3(kl_snoise(vec3(aSeed*40.0, t, 0.0)), kl_snoise(vec3(0.0, aSeed*40.0, t)) * 0.6 + 0.2, kl_snoise(vec3(t, 0.0, aSeed*40.0))) * 6.0;
        p.y += mod(uTime * (0.15 + aSeed*0.3) + aSeed * 90.0, 90.0) - 45.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + aSeed * 3.0) + aSeed * 50.0);
        gl_PointSize = uPx * (0.6 + aSeed * 1.4) * (40.0 / max(1.0, -mv.z));
        vA = tw * smoothstep(160.0, 20.0, -mv.z) * smoothstep(0.3, 3.0, -mv.z);
        vC = aColor;
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vC; varying float vA;
      void main(){
        vec2 d = gl_PointCoord - 0.5; float r = length(d);
        float a = smoothstep(0.5, 0.0, r); a *= a;
        gl_FragColor = vec4(vC * a * vA * 1.4, 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}

/** Pairs of eyes in the far darkness. They blink independently and occasionally all look your way. */
export function distantEyes(count, { radius = 420, rng = Math.random } = {}) {
  const pos = [], seed = [], side = [];
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2, el = (rng() - 0.35) * 1.1, r = radius * (0.7 + rng() * 0.5);
    const c = new THREE.Vector3(Math.cos(a) * Math.cos(el) * r, Math.sin(el) * r * 0.6, Math.sin(a) * Math.cos(el) * r);
    const tang = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const gap = 1.2 + rng() * 3.5; const s = rng();
    for (const k of [-1, 1]) { const p = c.clone().addScaledVector(tang, k * gap); pos.push(p.x, p.y, p.z); seed.push(s); side.push(k); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.time, uPx: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aSeed; uniform float uTime; uniform float uPx; varying float vOpen; varying float vS;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float cyc = fract(uTime * (0.02 + aSeed * 0.03) + aSeed * 7.0);
        float open = smoothstep(0.0, 0.08, cyc) * smoothstep(0.75, 0.6, cyc);
        float blink = step(0.06, abs(fract(uTime * 0.23 + aSeed * 3.0) - 0.5));
        vOpen = open * blink; vS = aSeed;
        gl_PointSize = uPx * (3.0 + aSeed * 5.0) * (300.0 / max(1.0, -mv.z));
      }`,
    fragmentShader: /* glsl */`
      varying float vOpen; varying float vS;
      void main(){
        vec2 d = gl_PointCoord - 0.5; d.y *= 2.2;
        float r = length(d);
        float a = smoothstep(0.5, 0.15, r);
        float pupil = smoothstep(0.08, 0.14, abs(d.x));
        vec3 c = mix(vec3(1.0, 0.75, 0.3), vec3(0.6, 1.0, 0.85), step(0.5, vS));
        gl_FragColor = vec4(c * a * mix(0.25, 1.0, pupil) * vOpen * 0.9, 1.0);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  return pts;
}
