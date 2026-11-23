// Whispers: the dream noticing you. Lines from the 2D prototype (SAMPLE copy, to be replaced by
// Keaten's own words) are written INTO the world - chalked on the floor, scratched into stone -
// and only write themselves in when you come close, stroke by stroke, then fade when you leave.
import * as THREE from 'three';
import { textTexture } from '../materials/textures.js';
import { U } from '../materials/library.js';

export const WHISPERS = [
  // text lines, position, yaw (direction the text reads facing), size, colour, surface
  { lines: ['Shh. It is still asleep.', 'You are walking around inside its dream.'], pos: [0, 0.03, 13.5], yaw: 0, w: 11, color: '#a9d3cc' },
  { lines: ['Don\u2019t count the eyes.', 'They are already counting you.'], pos: [0, 0.4, -36], yaw: 0, w: 4.2, color: '#f4e04d', surface: 'bridge' },
  { lines: ['Everything here is very large', 'and slightly too close.'], pos: [-17, 0.03, 4], yaw: Math.PI / 2 * 0.8, w: 7, color: '#a9d3cc' },
  { lines: ['The honeycomb is not a wall.', 'It is a skin. Please wipe your feet.'], pos: [-9, 0.03, -19], yaw: 0.6, w: 7, color: '#e3a6c4' },
  { lines: ['If it wakes up, act natural.', 'Be a doorknob.'], pos: [0, 0.2, -49.5], yaw: 0, w: 4.4, color: '#ffb36a', surface: 'maw' },
  { lines: ['The toads aren\u2019t guarding the treasure.', 'They\u2019re guarding you from the treasure.'], pos: [12, 0.03, -14], yaw: -0.5, w: 7.5, color: '#d8ff6a' },
];

export function buildWhispers(scene, groundAt) {
  const items = [];
  for (const w of WHISPERS) {
    const tex = textTexture(w.lines, { width: 2048, height: 384, font: '92px "Permanent Marker"', color: w.color, glow: w.color, lineHeight: 1.2 });
    const h = w.w * (384 / 2048);
    const geo = new THREE.PlaneGeometry(w.w, h, 32, 6);
    geo.rotateX(-Math.PI / 2);
    geo.rotateY(w.yaw);
    const pa = geo.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const x = pa.getX(i) + w.pos[0], z = pa.getZ(i) + w.pos[2];
      const gy = groundAt(x, z);
      pa.setXYZ(i, x, (gy ?? w.pos[1]) + 0.045, z);
    }
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: true, blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMap: { value: tex }, uReveal: { value: 0 }, uFade: { value: 0 } }]),
      vertexShader: `#include <common>
        #include <fog_pars_vertex>
        varying vec2 vUv;
        void main(){ vUv = uv; vec3 transformed = position; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: `#include <common>
        #include <fog_pars_fragment>
        uniform sampler2D uMap; uniform float uReveal; uniform float uFade; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(uMap, vUv);
          float wob = sin(vUv.y * 40.0) * 0.01;
          float rev = smoothstep(uReveal * 1.08 - 0.04, uReveal * 1.08 - 0.06, vUv.x + wob);
          float edge = smoothstep(0.03, 0.0, abs(vUv.x + wob - (uReveal * 1.08 - 0.05))) * step(0.01, uReveal) * step(uReveal, 0.99);
          float a = c.a * rev * uFade;
          gl_FragColor = vec4(c.rgb * a * 0.55 + vec3(1.0, 0.95, 0.8) * edge * c.a * 1.2, 1.0);
          #include <fog_fragment>
        }`,
    });
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 4; m.frustumCulled = false;
    scene.add(m);
    items.push({ mesh: m, mat, center: new THREE.Vector3(w.pos[0], 0, w.pos[2]), reveal: 0, fade: 0 });
  }
  return {
    items,
    update(dt, playerPos) {
      for (const it of items) {
        const d = playerPos ? Math.hypot(playerPos.x - it.center.x, playerPos.z - it.center.z) : 99;
        const near = d < 11 && Math.abs((playerPos?.y ?? 0) - it.center.y) < 20;
        if (near) { it.fade = Math.min(1, it.fade + dt * 0.8); it.reveal = Math.min(1, it.reveal + dt * 0.28); }
        else { it.fade = Math.max(0, it.fade - dt * 0.15); if (it.fade === 0) it.reveal = 0; }
        it.mat.uniforms.uReveal.value = it.reveal; it.mat.uniforms.uFade.value = it.fade;
      }
    },
    revealAll() { for (const it of items) { it.reveal = 1; it.fade = 1; it.mat.uniforms.uReveal.value = 1; it.mat.uniforms.uFade.value = 1; } },
  };
}
