// Custom shading for the Catecholamine Works:
//  - floodMaterial: the norepinephrine project tide. A MeshStandardMaterial patched so the surface
//    is displaced on the GPU (a breaking front that sweeps in from the big doors, chop, a spiral
//    funnel at the drain) and coloured from advected cell noise: sand, broken glass that sparkles,
//    soaked wood, rusted scrap, trash, all in a murky amber liquor that glows a little at the crest.
//    The same height function lives in JS (floodHeight) so debris, rafts and swimmers ride it.
//  - columnMaterial: glass reaction columns with liquid, rising bubbles and a meniscus.
//  - shaftMaterial: soft additive light beams from the high windows, with drifting dust density.
import * as THREE from 'three';
import { U } from '../../materials/library.js';
import { GLSL_NOISE } from '../../core/noise.js';

export const FLOOD = {
  uLevel: { value: -0.8 }, uFront: { value: -40 }, uSurge: { value: 0 }, uChop: { value: 1 },
  uVortex: { value: 0 }, uDrain: { value: new THREE.Vector2(0, 2) }, uGlow: { value: 1 }, uOpen: { value: 0 },
};

const HEIGHT_GLSL = /* glsl */`
uniform float uLevel; uniform float uFront; uniform float uSurge; uniform float uChop; uniform float uVortex; uniform vec2 uDrain; uniform float uOpen;
float klWave(vec2 p, float t){
  return (0.12*sin(0.35*p.x + 1.3*t) + 0.10*sin(0.28*p.y - 1.1*t + 0.1*p.x) + 0.06*sin(0.9*(p.x+p.y) + 2.1*t) + 0.04*sin(1.7*p.x - 0.8*p.y + 2.9*t)) * uChop;
}
float klFloodH(vec2 p, float t){
  float m = 1.0 - smoothstep(uFront - 5.0, uFront + 1.0, p.x);
  float crest = 1.7 * exp(-pow((p.x - (uFront - 2.5)) / 2.4, 2.0)) * uSurge;
  float r = length(p - uDrain);
  float dip = uVortex * (4.2 / (r*r*0.12 + 1.0));
  float h = uLevel + klWave(p, t) * (0.4 + 0.6*clamp(uLevel+0.2, 0.0, 1.0)) + crest - dip;
  return mix(-0.9, h, m);
}`;

/** JS mirror of klFloodH (no noise in it, so it matches exactly). */
export function floodHeight(x, z, t) {
  const F = FLOOD;
  const mm = 1 - THREE.MathUtils.smoothstep(x, F.uFront.value - 5.0, F.uFront.value + 1.0);
  const crest = 1.7 * Math.exp(-(((x - (F.uFront.value - 2.5)) / 2.4) ** 2)) * F.uSurge.value;
  const r = Math.hypot(x - F.uDrain.value.x, z - F.uDrain.value.y);
  const dip = F.uVortex.value * (4.2 / (r * r * 0.12 + 1));
  const w = (0.12 * Math.sin(0.35 * x + 1.3 * t) + 0.10 * Math.sin(0.28 * z - 1.1 * t + 0.1 * x) + 0.06 * Math.sin(0.9 * (x + z) + 2.1 * t) + 0.04 * Math.sin(1.7 * x - 0.8 * z + 2.9 * t)) * F.uChop.value;
  const h = F.uLevel.value + w * (0.4 + 0.6 * Math.min(1, Math.max(0, F.uLevel.value + 0.2))) + crest - dip;
  return -0.9 + (h + 0.9) * mm;
}
/** is there liquid here at all (behind the front)? */
export const floodAt = (x) => x < FLOOD.uFront.value - 1.0;

export function floodMaterial({ cheap = false } = {}) {
  const m = new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 0.35, metalness: 0.1, envMapIntensity: 0.3 }); // glossy goo (low env so it stays saturated, not pastel)
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FLOOD, { uTime: U.time });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;\nvarying vec3 vFl;\n${HEIGHT_GLSL}`)
      .replace('#include <beginnormal_vertex>', `
        vec2 lp = position.xz;
        float e = 0.35;
        float h0 = klFloodH(lp, uTime);
        float hx = klFloodH(lp + vec2(e, 0.0), uTime), hz = klFloodH(lp + vec2(0.0, e), uTime);
        vec3 objectNormal = normalize(vec3(-(hx - h0) / e, 1.0, -(hz - h0) / e));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3( tangent.xyz );
        #endif`)
      .replace('#include <begin_vertex>', `vec3 transformed = vec3(position.x, h0, position.z);
        vFl = vec3(lp, h0);`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uSurge; uniform float uFront; uniform float uVortex; uniform vec2 uDrain; uniform float uGlow; uniform float uLevel;\nvarying vec3 vFl;\nfloat vKlMetal = 0.0;\n${GLSL_NOISE}
        vec2 klHash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
        // cellular: returns (distance to nearest cell point, that cell's id hash)
        vec2 klCell(vec2 p){ vec2 i = floor(p), f = fract(p); float d = 9.0; float id = 0.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 g = vec2(x, y); vec2 o = klHash2(i + g); vec2 r = g + o - f; float dd = dot(r, r); if (dd < d) { d = dd; id = fract(o.x * 7.13 + o.y * 3.7); } }
          return vec2(sqrt(d), id); }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        {
          vec2 p = vFl.xy;
          // advect: a general drift east (from the big doors), and a swirl around the drain
          vec2 dp = p - uDrain; float r = length(dp);
          float sw = uVortex * uTime * 2.6 / (r * 0.35 + 0.6);
          float cs = cos(sw), sn = sin(sw);
          vec2 q = uDrain + mat2(cs, -sn, sn, cs) * dp;
          q.x -= uTime * 0.9 * (1.0 - uVortex);
          float n1 = kl_snoise(vec3(q * 0.22, uTime * 0.05));
          float n2 = kl_snoise(vec3(q * 0.9 + 4.0, uTime * 0.11));
          vec2 c = klCell(q * 0.55 + n1 * 0.4);
          #ifdef KL_CHEAP
          vec2 c2 = vec2(1.0, 0.0); // phones: no broken-glass glints (saves a 9-tap cell pass)
          #else
          vec2 c2 = klCell(q * 1.6 + 7.0);
          #endif
          vec3 murk = mix(vec3(0.0, 0.085, 0.075), vec3(0.07, 0.30, 0.0), 0.5 + 0.5 * n1);      // deep teal-to-acid goo
          murk = mix(murk, vec3(0.34, 0.0, 0.20), smoothstep(0.35, 0.7, n2) * 0.65);            // magenta swirls
          vec3 col = murk; float rough = 0.25; float metal = 0.0;
          // things in it: patches of sand, soaked wood, rusted scrap, trash colours
          float chunk = (1.0 - smoothstep(0.18, 0.42, c.x)) * smoothstep(-0.2, 0.5, n2);
          vec3 thing = c.y < 0.3 ? vec3(1.0, 0.62, 0.22)                                 // sand (candy orange)
                     : c.y < 0.5 ? vec3(0.62, 0.26, 0.10)                                // wood
                     : c.y < 0.65 ? vec3(0.55, 0.16, 0.30)                               // rust
                     : c.y < 0.75 ? vec3(0.55, 0.56, 0.58)                               // scrap/tin
                     : c.y < 0.82 ? vec3(0.62, 0.12, 0.08)                               // red plastic
                     : c.y < 0.9 ? vec3(0.12, 0.28, 0.55)                                // blue tarp
                     : vec3(0.85, 0.8, 0.62);                                            // paper
          col = mix(col, thing, chunk * 0.85);
          rough = mix(rough, c.y < 0.3 ? 0.95 : c.y < 0.65 ? 0.8 : 0.45, chunk);
          metal = (c.y > 0.65 && c.y < 0.75) ? chunk * 0.8 : 0.0;
          // broken glass: tiny bright facets
          float glint = (1.0 - smoothstep(0.0, 0.08, c2.x)) * step(0.82, c2.y);
          col += vec3(0.6, 0.7, 0.75) * glint; rough = mix(rough, 0.05, glint);
          // foam at the breaking crest and in the funnel
          float crest = exp(-pow((p.x - (uFront - 2.5)) / 2.0, 2.0)) * uSurge;
          float foam = clamp(crest * (0.6 + 0.6 * n2) + uVortex * (1.0 - smoothstep(1.0, 5.0, r)) * (0.5 + 0.5 * sin(atan(dp.y, dp.x) * 6.0 - uTime * 8.0 + r * 2.0)), 0.0, 1.0);
          col = mix(col, vec3(0.45, 0.9, 0.25), foam * 0.55); rough = mix(rough, 0.7, foam);
          // the funnel throat goes dark
          col = mix(col, vec3(0.10, 0.02, 0.16), uVortex * (1.0 - smoothstep(0.4, 3.0, r)) * 0.8);
          diffuseColor.rgb = col;
          roughnessFactor = rough;
          totalEmissiveRadiance += (vec3(0.18, 0.7, 0.05) * crest * 0.45 + vec3(0.0, 0.03, 0.025) + vec3(0.12, 0.0, 0.07) * smoothstep(0.5, 0.75, n2)) * uGlow * (0.6 + 0.4 * n1);
          vKlMetal = metal;
        }`)
      .replace('#include <lights_physical_fragment>', 'metalnessFactor = max(metalnessFactor, vKlMetal);\n#include <lights_physical_fragment>');
  };
  if (cheap) m.defines = { KL_CHEAP: '' };
  m.customProgramCacheKey = () => 'kl-flood' + (cheap ? '-cheap' : '');
  return m;
}

/** glass column: liquid with bubbles, coloured `c`, fill level 0..1 */
export function columnMaterial(color = 0xff7a20, { fill = 0.8, height = 10 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uC: { value: new THREE.Color(color) }, uFill: { value: fill }, uH: { value: height }, uPower: { value: 1 } }]),
    vertexShader: `uniform float uH; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      #include <fog_pars_vertex>
      void main(){ vUv = uv; vec3 transformed = position; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = -mvPosition.xyz; gl_Position = projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uC; uniform float uFill; uniform float uH; uniform float uPower; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      #include <fog_pars_fragment>
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
        float y = vUv.y; float t = fogFar;
        float liquid = step(y, uFill + 0.006*sin(vUv.x*40.0 + t*3.0));
        // bubbles: columns of rising dots
        vec2 g = vec2(vUv.x * 14.0, y * uH * 3.0 - t * (2.0 + 1.5 * uPower));
        vec2 id = floor(g); vec2 f = fract(g) - 0.5; float rnd = h(id);
        float b = (1.0 - smoothstep(0.12, 0.22, length(f + vec2(sin(t*2.0 + rnd*30.0)*0.2, 0.0)))) * step(0.72, rnd) * uPower;
        vec3 col = uC * (0.5 + 0.5 * y) * liquid * (0.9 + 0.3*uPower);
        col += vec3(1.0, 0.9, 0.7) * b * liquid * 0.9;
        col += vec3(1.0) * (1.0 - smoothstep(0.0, 0.012, abs(y - uFill))) * 0.8 * uPower; // meniscus
        vec3 glass = vec3(0.7, 0.8, 0.85) * fres * 0.35;
        gl_FragColor = vec4(col + glass, clamp(liquid * 0.82 + fres * 0.4, 0.0, 1.0));
        #include <fog_fragment>
      }`,
  });
}

/** a soft additive light beam on an open cylinder whose top (uv.y = 1) is the source */
export function shaftMaterial(color = 0xffd9a0, strength = 0.18) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uC: { value: new THREE.Color(color) }, uS: { value: strength }, uTime: U.time, uK: { value: 1 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec3 vV;
      void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vec4 mv = viewMatrix * w; vN = normalize(normalMatrix*normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uC; uniform float uS; uniform float uTime; uniform float uK; varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec3 vV;
      ${GLSL_NOISE}
      void main(){
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);           // soft sides
        float sd = 1.0 - vUv.y; float along = smoothstep(0.0, 0.05, sd) * (1.0 - smoothstep(0.4, 1.0, sd)); // from the window (top) down to the floor
        float dust = 0.65 + 0.35 * kl_snoise(vec3(vW * 0.35 + vec3(0.0, -uTime * 0.12, uTime * 0.05)));
        float a = edge * along * dust * uS * uK;
        gl_FragColor = vec4(uC * a, 1.0);
      }`,
  });
}
