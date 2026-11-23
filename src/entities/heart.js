// The heart: a hanging organ that beats (lub-dub). Its pulse drives U.heartbeat, which every
// organic material, the cilia, the audio thump and the lights listen to.
import * as THREE from 'three';
import { blobGeometry, sweepGeometry } from '../geometry/sweep.js';
import { merge } from '../geometry/generators.js';
import { organicMaterial, U } from '../materials/library.js';
import { L } from '../world/layout.js';
import { GLSL_NOISE } from '../core/noise.js';

export function lightShaft({ from, to, r0 = 2, r1 = 8, color = 0xffb070, intensity = 0.25 }) {
  const len = from.distanceTo(to);
  const g = new THREE.CylinderGeometry(r0, r1, len, 48, 24, true);
  g.translate(0, -len / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: U.time, uColor: { value: new THREE.Color(color) }, uI: { value: intensity }, uHeart: U.heartbeat, uRitual: U.ritual },
    vertexShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      uniform float uTime; uniform vec3 uColor; uniform float uI; uniform float uHeart; uniform float uRitual;
      ${GLSL_NOISE}
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
        float along = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
        float streak = 0.6 + 0.4 * kl_snoise(vec3(vUv.x * 18.0, vUv.y * 2.0 - uTime * 0.15, uTime * 0.05));
        float dust = 0.7 + 0.3 * kl_snoise(vW * 0.4 + vec3(0.0, -uTime * 0.3, 0.0));
        float a = edge * along * streak * dust * uI * (1.0 + uHeart * 0.6 + uRitual * 1.2);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
  const m = new THREE.Mesh(g, mat);
  m.position.copy(from);
  const dir = to.clone().sub(from).normalize();
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  m.renderOrder = 5;
  return m;
}

export function glowSprite(color = 0xffa060, size = 10, opacity = 0.6) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'); const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0.1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  s.scale.setScalar(size);
  return s;
}

export class Heart {
  constructor(scene, quality) {
    this.group = new THREE.Group(); this.group.position.copy(L.heart); scene.add(this.group);
    const body = blobGeometry(4.6, { detail: 5, noise: 0.28, noiseScale: 1.6, seed: 12, squash: [1, 1.25, 0.95], lumps: [{ dir: [0.4, 1, 0.2], size: 4, amp: 0.4 }, { dir: [-0.6, 0.8, -0.2], size: 5, amp: 0.35 }, { dir: [0, -1, 0], size: 3, amp: 0.25 }] });
    // arteries wrapping the heart
    const vessels = [];
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const pts = [];
      for (let k = 0; k <= 8; k++) { const t = k / 8; const aa = a + t * 1.6; const y = 6 - t * 12; const r = 4.9 * Math.sin(Math.PI * (0.12 + t * 0.8)) + 0.4; pts.push(new THREE.Vector3(Math.cos(aa) * r, y, Math.sin(aa) * r)); }
      vessels.push(sweepGeometry(new THREE.CatmullRomCurve3(pts), { tubular: 48, radial: 7, radius: (t) => 0.45 * (1 - t * 0.6) + 0.12 * Math.sin(t * 30) ** 2, noise: 0.2, noiseScale: 1.5 }));
    }
    this.mat = organicMaterial({ color: 0x4a1a1e, color2: 0x1a0608, veinColor: 0xffa060, veinAmount: 2.2, veinScale: 0.55, breath: 0.15, breathScale: 0.4, rim: 1.4, rimColor: 0xff5a3a, emissive: 0x2a0604, roughness: 0.35 });
    this.vesselMat = organicMaterial({ color: 0x3a1418, color2: 0x12060a, veinColor: 0xff7a5a, veinAmount: 1.2, breath: 0.05, rim: 1.0, rimColor: 0xa03020, roughness: 0.3 });
    this.body = new THREE.Mesh(body, this.mat); this.body.castShadow = true;
    this.vessels = new THREE.Mesh(merge(vessels), this.vesselMat); this.vessels.castShadow = true;
    this.group.add(this.body, this.vessels);
    this.halo = glowSprite(0xff8a50, 30, 0.35); this.group.add(this.halo);
    // light
    this.point = new THREE.PointLight(0xff9a5a, 2600, 90, 2); this.group.add(this.point);
    this.spot = new THREE.SpotLight(0xffb27a, 9000, 70, Math.PI / 9, 0.6, 2);
    this.spot.position.set(0, -4, 0);
    this.spot.target.position.copy(L.ritual).sub(L.heart);
    this.group.add(this.spot, this.spot.target);
    if (quality.shadows) { this.spot.castShadow = true; this.spot.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize); this.spot.shadow.camera.near = 4; this.spot.shadow.camera.far = 60; this.spot.shadow.bias = -0.0004; this.spot.shadow.normalBias = 0.05; }
    this.shaft = lightShaft({ from: L.heart.clone().add(new THREE.Vector3(0, -3, 0)), to: L.ritual.clone(), r0: 2.2, r1: 8.5, color: 0xffa868, intensity: 0.11 });
    scene.add(this.shaft);
    this.period = 1.75; this.beatT = 0; this.onBeat = null; this.excite = 0;
  }
  update(dt, t) {
    const period = this.period / (1 + this.excite * 0.8);
    this.beatT += dt;
    if (this.beatT > period) { this.beatT -= period; this.onBeat?.(); }
    const x = this.beatT;
    const lub = Math.exp(-Math.pow((x - 0.05) / 0.07, 2)), dub = 0.65 * Math.exp(-Math.pow((x - 0.32) / 0.08, 2));
    const hb = Math.min(1, lub + dub);
    U.heartbeat.value = hb;
    const s = 1 + hb * 0.06;
    this.body.scale.set(s, s * 1.02, s); this.vessels.scale.set(s * 1.01, s, s * 1.01);
    this.group.rotation.y = t * 0.03; this.group.position.y = L.heart.y + Math.sin(t * 0.25) * 0.6;
    this.point.intensity = 1800 + hb * 2200 + this.excite * 2500;
    this.spot.intensity = 7000 + hb * 4000 + U.ritual.value * 8000;
    this.halo.material.opacity = 0.25 + hb * 0.25;
    this.excite = Math.max(0, this.excite - dt * 0.15);
  }
}
