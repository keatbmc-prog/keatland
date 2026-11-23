// The stylized shading kit for the story realm (Keatland Reception, the Backrooms, the Works).
// A saturated, alien, art-directed look: soft toon light bands instead of a realistic falloff,
// shadows that lean violet/teal instead of grey, a coloured fresnel rim, more saturation, a soft
// vertical gradient, and optional "alive" vertex motion:
//   wobble / breathe  - goopy wobble along the normal, breathing scale (organic props)
//   warp              - a continuous WORLD-SPACE field that bulges, sways and melts architecture.
//                       Because it is a field of world position, every mesh that shares an edge moves
//                       the same way (no cracks), floors stay put (the field fades to zero at the
//                       floor), and it is periodic in x so the Backrooms loop stays seamless.
//   peri              - a peristaltic bulge travelling along pipes
//   organ             - slow lumpy swelling (the Works vats)
// It patches MeshStandardMaterial through onBeforeCompile (maps, shadows, fog and instancing keep
// working) and chains any patch the material already had (the flood, the glass...).
import * as THREE from 'three';

export const TOON = { time: { value: 0 } };

/** Shared "Yesterkeat is on the PA" state: speaker critters flap their mouths while talk > 0. */
export const PA = { talk: 0, level: 0 };

const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

export const TOON_DEFAULTS = { rim: 0x56f0ff, rimK: 0.45, rimP: 3.0, bands: 3, soft: 0.6, sat: 1.35, shade: 0x5a3aa0, shadeK: 0.5, wobble: 0, wobbleF: 2.4, breathe: 0, phase: 0, glow: 1, grad: 0, gradY0: 0, gradY1: 4, warp: null, peri: 0, organ: 0 };

/** warp field parameters, shared per realm (one object, so a realm can animate them together) */
export function warpField({ amp = 0.2, base = 0, h = 4, period = 15, breathe = 0.3, hot = new THREE.Vector3(1e6, 0, 0), hotR = 1, hotAmp = 0 } = {}) {
  return { uWarpAmp: { value: amp }, uWarpBase: { value: base }, uWarpH: { value: h }, uWarpPeriod: { value: period }, uWarpBreathe: { value: breathe }, uWarpHot: { value: hot }, uWarpHotR: { value: hotR }, uWarpHotAmp: { value: hotAmp } };
}

const WARP_GLSL = /* glsl */`
  uniform float uWarpAmp; uniform float uWarpBase; uniform float uWarpH; uniform float uWarpPeriod; uniform float uWarpBreathe;
  uniform vec3 uWarpHot; uniform float uWarpHotR; uniform float uWarpHotAmp;
  vec3 klWarp(vec3 p, float t) {
    float k = 6.2831853 / uWarpPeriod;
    float h = clamp((p.y - uWarpBase) / uWarpH, 0.0, 1.0);
    float br = 1.0 + uWarpBreathe * sin(t * 0.9 + p.x * k + p.z * 0.31);
    vec3 d;
    d.x = sin(p.z * 0.83 + p.y * 0.61 + 1.3) * 0.62 + sin(p.z * 2.1 + p.y * 1.7 + t * 0.35) * 0.22;
    d.z = sin(p.x * k + p.y * 0.73 + 0.4) * 0.62 + sin(p.x * k * 3.0 + p.y * 1.9 + 0.7 + t * 0.35) * 0.22;
    float sag = 0.5 + 0.5 * sin(p.x * k * 2.0 + p.z * 1.37);
    d.y = sin(p.x * k * 2.0 + p.z * 1.1) * 0.25 * h - h * h * 0.45 * sag;   // tops droop and melt
    d.xz *= h * (0.6 + 1.4 * sin(h * 3.14159)) * br;                     // feet (and furniture) planted, bellies bulge, tops sway
    float amp = uWarpAmp + uWarpHotAmp * (1.0 - smoothstep(0.0, uWarpHotR, distance(p.xz, uWarpHot.xz)));
    return d * amp;
  }`;

export function toonify(m, opts = {}) {
  if (!m || !(m.isMeshStandardMaterial) || m.userData.toon) return m;
  const o = { ...TOON_DEFAULTS, ...opts };
  const u = {
    uToonTime: TOON.time,
    uRim: { value: new THREE.Color(o.rim) }, uRimK: { value: o.rimK }, uRimP: { value: o.rimP },
    uBands: { value: o.bands }, uSoft: { value: o.soft }, uSat: { value: o.sat },
    uShade: { value: new THREE.Color(o.shade) }, uShadeK: { value: o.shadeK },
    uWob: { value: o.wobble }, uWobF: { value: o.wobbleF }, uBreathe: { value: o.breathe }, uPhase: { value: o.phase },
    uGrad: { value: o.grad }, uGradY0: { value: o.gradY0 }, uGradY1: { value: o.gradY1 },
    uPeri: { value: o.peri }, uOrgan: { value: o.organ },
    ...(o.warp || {}),
  };
  m.userData.toon = u; m.userData.toonOpts = o;
  if (o.glow !== 1 && m.emissive) m.emissiveIntensity *= o.glow;
  const prev = m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ? m.onBeforeCompile : null;
  const F = { WOB: o.wobble > 0 || o.breathe > 0, WARP: !!o.warp, PERI: o.peri > 0, ORGAN: o.organ > 0 };
  const key = 'toon' + Object.entries(F).filter(([, v]) => v).map(([k]) => k).join('') + (prev ? hashStr(prev.toString()) : '');
  m.onBeforeCompile = function (sh, r) {
    prev?.call(this, sh, r);
    Object.assign(sh.uniforms, u);
    const defs = Object.entries(F).filter(([, v]) => v).map(([k]) => `#define KL_${k}`).join('\n');
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\n${defs}\nuniform float uToonTime; uniform float uWob; uniform float uWobF; uniform float uBreathe; uniform float uPhase; uniform float uPeri; uniform float uOrgan;\nvarying vec3 vKlW;\n${F.WARP ? WARP_GLSL : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            mat4 klM = modelMatrix * instanceMatrix;
          #else
            mat4 klM = modelMatrix;
          #endif
          vec3 klP = (klM * vec4(transformed, 1.0)).xyz;
          #ifdef KL_WOB
            float kw = sin(position.y * uWobF + uToonTime * 2.1 + uPhase + position.x * 1.3) * cos(position.z * uWobF * 0.8 - uToonTime * 1.7 + uPhase);
            transformed += objectNormal * kw * uWob;
            transformed *= 1.0 + uBreathe * sin(uToonTime * 1.6 + uPhase);
          #endif
          #ifdef KL_PERI
            { // a lump travelling along the pipe runs
              float s = dot(klP, vec3(0.57, 0.62, 0.53)) * 0.9 - uToonTime * 2.4;
              transformed += objectNormal * uPeri * pow(max(0.0, sin(s)), 8.0);
            }
          #endif
          #ifdef KL_ORGAN
            transformed += objectNormal * uOrgan * (0.55 * sin(klP.y * 0.7 + klP.x * 0.4 + uToonTime * 0.8) + 0.35 * sin(klP.y * 1.9 - klP.z * 0.8 - uToonTime * 1.3) + 0.25 * sin(atan(klP.z, klP.x) * 5.0 + klP.y * 0.5));
          #endif
          #ifdef KL_WARP
            vec3 klD = klWarp(klP, uToonTime);
            mat3 klIM = inverse(mat3(klM));
            transformed += klIM * klD;
            #ifndef FLAT_SHADED
            { // bend the normal with the field (finite-difference Jacobian) so the bulges shade
              const float e = 0.12;
              vec3 jx = (klWarp(klP + vec3(e, 0.0, 0.0), uToonTime) - klD) / e;
              vec3 jy = (klWarp(klP + vec3(0.0, e, 0.0), uToonTime) - klD) / e;
              vec3 jz = (klWarp(klP + vec3(0.0, 0.0, e), uToonTime) - klD) / e;
              vec3 nW = normalize(transpose(klIM) * objectNormal);
              nW = normalize(nW - vec3(dot(jx, nW), dot(jy, nW), dot(jz, nW)));
              vNormal = normalize(mat3(viewMatrix) * nW);
              #ifdef FLIP_SIDED
                vNormal = -vNormal;
              #endif
            }
            #endif
          #endif
          vKlW = (klM * vec4(transformed, 1.0)).xyz;
        }`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimK; uniform float uRimP; uniform float uBands; uniform float uSoft; uniform float uSat; uniform vec3 uShade; uniform float uShadeK; uniform float uGrad; uniform float uGradY0; uniform float uGradY1;\nvarying vec3 vKlW;')
      .replace('#include <opaque_fragment>', `{
          // soft toon bands on the lit result
          float kl = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          float kf = kl * uBands; float kq = (floor(kf) + smoothstep(0.5 - uSoft * 0.5, 0.5 + uSoft * 0.5, fract(kf))) / uBands;
          kq = mix(kl, kq, 0.7);
          outgoingLight *= (kq + 0.015) / (kl + 0.015);
          // a soft vertical gradient: cooler and darker at the foot, warmer at the top
          float kg = smoothstep(uGradY0, uGradY1, vKlW.y);
          outgoingLight *= mix(vec3(1.0), mix(vec3(0.62, 0.6, 0.85), vec3(1.12, 1.04, 0.95), kg), uGrad);
          // shadows lean violet / teal instead of grey
          float ksh = 1.0 - smoothstep(0.0, 0.32, kl);
          outgoingLight = mix(outgoingLight, outgoingLight * uShade * 2.4 + uShade * 0.035, ksh * uShadeK);
          float kl2 = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          outgoingLight = max(mix(vec3(kl2), outgoingLight, uSat), 0.0);
          // coloured rim
          float kfr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), uRimP);
          outgoingLight += uRim * kfr * uRimK;
        }
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => key;
  m.needsUpdate = true;
  return m;
}

/** Push a colour toward the art direction: more saturation, a little lift. */
export function punch(color, { sat = 1.45, light = 1.0, hueShift = 0 } = {}) {
  const h = {}; color.getHSL(h);
  color.setHSL((h.h + hueShift + 1) % 1, Math.min(1, h.s * sat + 0.06), Math.min(0.92, h.l * light));
  return color;
}

/** The same warp as the shader (klWarp), on the CPU, so props stuck to a wall can ride its bulge. */
export function warpAt(W, p, t, out = new THREE.Vector3()) {
  const k = 6.2831853 / W.uWarpPeriod.value;
  const h = Math.min(1, Math.max(0, (p.y - W.uWarpBase.value) / W.uWarpH.value));
  const br = 1 + W.uWarpBreathe.value * Math.sin(t * 0.9 + p.x * k + p.z * 0.31);
  let dx = Math.sin(p.z * 0.83 + p.y * 0.61 + 1.3) * 0.62 + Math.sin(p.z * 2.1 + p.y * 1.7 + t * 0.35) * 0.22;
  let dz = Math.sin(p.x * k + p.y * 0.73 + 0.4) * 0.62 + Math.sin(p.x * k * 3 + p.y * 1.9 + 0.7 + t * 0.35) * 0.22;
  const sag = 0.5 + 0.5 * Math.sin(p.x * k * 2 + p.z * 1.37);
  const dy = Math.sin(p.x * k * 2 + p.z * 1.1) * 0.25 * h - h * h * 0.45 * sag;
  const f = h * (0.6 + 1.4 * Math.sin(h * Math.PI)) * br; dx *= f; dz *= f;
  const hot = W.uWarpHot.value, hd = Math.hypot(p.x - hot.x, p.z - hot.z), r = W.uWarpHotR.value;
  const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  const amp = W.uWarpAmp.value + W.uWarpHotAmp.value * (1 - sm(hd / r));
  return out.set(dx * amp, dy * amp, dz * amp);
}
