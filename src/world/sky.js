// The darkness the hub hangs in: not empty black but a slowly moving abyss with faint nebular
// veils, a glow from below (something huge and warm far beneath), and colour bleeding from the eye.
import * as THREE from 'three';
import { GLSL_NOISE } from '../core/noise.js';
import { U } from '../materials/library.js';

export function createSky() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: U.time, uEyeDir: { value: new THREE.Vector3(0, 0.35, -1).normalize() }, uFold: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir; uniform float uTime; uniform vec3 uEyeDir; uniform float uFold;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 deep = vec3(0.010, 0.010, 0.016);
        vec3 below = vec3(0.055, 0.020, 0.035);
        vec3 horizon = vec3(0.016, 0.024, 0.032);
        vec3 c = mix(horizon, deep, smoothstep(0.0, 0.7, y));
        c = mix(c, below, smoothstep(0.0, -0.8, y));
        // nebular veils
        float n = kl_fbm(d * 2.2 + vec3(uTime*0.004, 0.0, uTime*0.003));
        float n2 = kl_fbm(d * 5.0 - vec3(0.0, uTime*0.006, 0.0) + n);
        float veil = smoothstep(0.05, 0.7, n * 0.6 + n2 * 0.5);
        c += veil * mix(vec3(0.020, 0.045, 0.050), vec3(0.060, 0.018, 0.045), smoothstep(-0.2, 0.3, n2)) * 1.0;
        // warm unseen thing far below
        c += vec3(0.11, 0.035, 0.02) * pow(max(0.0, -y), 3.0) * (0.7 + 0.3 * sin(uTime * 0.3));
        // halo around the sky-eye
        float e = max(0.0, dot(d, uEyeDir));
        c += vec3(0.09, 0.07, 0.04) * pow(e, 24.0) + vec3(0.02, 0.03, 0.035) * pow(e, 4.0);
        // faint dust of stars
        vec3 sd = floor(d * 380.0);
        float h = fract(sin(dot(sd, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        c += vec3(0.7, 0.75, 0.8) * step(0.9965, h) * (0.4 + 0.6 * sin(uTime * 2.0 + h * 100.0)) * smoothstep(-0.2, 0.3, y) * 0.5;
        // the world folding (transition)
        c += uFold * vec3(0.2, 0.05, 0.15) * (0.5 + 0.5 * sin(d.y * 40.0 - uTime * 6.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 48, 32), mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}
