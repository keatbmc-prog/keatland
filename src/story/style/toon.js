// The stylized shading kit for the story realm (Keatland Reception, the Backrooms, the Works).
// Aiming at a saturated, alien, hand-art-directed look: soft toon light bands instead of a realistic
// falloff, shadows that lean violet/teal instead of grey, a coloured fresnel rim on everything, more
// saturation, emissive glow, and an optional "alive" vertex wobble + breathing for organic props.
//
// It patches MeshStandardMaterial (so PBR maps, shadows, fog and instancing keep working) through
// onBeforeCompile, chaining any patch the material already had (the flood, the glass, etc.).
//   toonify(material, { rim, rimK, rimP, bands, soft, sat, shade, shadeK, wobble, wobbleF, breathe, phase })
//   TOON.time is advanced by the realm's update (shared by every toon material).
import * as THREE from 'three';

export const TOON = { time: { value: 0 } };

/** Shared "Yesterkeat is on the PA" state: speaker critters flap their mouths while talk > 0. */
export const PA = { talk: 0, level: 0 };

const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return (h >>> 0).toString(36); };

export const TOON_DEFAULTS = { rim: 0x56f0ff, rimK: 0.45, rimP: 3.0, bands: 3, soft: 0.6, sat: 1.35, shade: 0x5a3aa0, shadeK: 0.5, wobble: 0, wobbleF: 2.4, breathe: 0, phase: 0, glow: 1 };

export function toonify(m, opts = {}) {
  if (!m || !(m.isMeshStandardMaterial) || m.userData.toon) return m;
  const o = { ...TOON_DEFAULTS, ...opts };
  const u = {
    uToonTime: TOON.time,
    uRim: { value: new THREE.Color(o.rim) }, uRimK: { value: o.rimK }, uRimP: { value: o.rimP },
    uBands: { value: o.bands }, uSoft: { value: o.soft }, uSat: { value: o.sat },
    uShade: { value: new THREE.Color(o.shade) }, uShadeK: { value: o.shadeK },
    uWob: { value: o.wobble }, uWobF: { value: o.wobbleF }, uBreathe: { value: o.breathe }, uPhase: { value: o.phase },
  };
  m.userData.toon = u;
  if (o.glow !== 1 && m.emissive) m.emissiveIntensity *= o.glow;
  const prev = m.onBeforeCompile && m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile ? m.onBeforeCompile : null;
  const wob = o.wobble > 0 || o.breathe > 0;
  const key = 'toon' + (wob ? 'W' : '') + (prev ? hashStr(prev.toString()) : '');
  m.onBeforeCompile = function (sh, r) {
    prev?.call(this, sh, r);
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uToonTime; uniform float uWob; uniform float uWobF; uniform float uBreathe; uniform float uPhase;')
      .replace('#include <begin_vertex>', wob ? `#include <begin_vertex>
        { // alive: a slow goopy wobble along the normal, and breathing
          float kw = sin(position.y * uWobF + uToonTime * 2.1 + uPhase + position.x * 1.3) * cos(position.z * uWobF * 0.8 - uToonTime * 1.7 + uPhase);
          transformed += objectNormal * kw * uWob;
          transformed *= 1.0 + uBreathe * sin(uToonTime * 1.6 + uPhase);
        }` : '#include <begin_vertex>');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRim; uniform float uRimK; uniform float uRimP; uniform float uBands; uniform float uSoft; uniform float uSat; uniform vec3 uShade; uniform float uShadeK;')
      .replace('#include <opaque_fragment>', `{
          // soft toon bands on the lit result
          float kl = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
          float kf = kl * uBands; float kq = (floor(kf) + smoothstep(0.5 - uSoft * 0.5, 0.5 + uSoft * 0.5, fract(kf))) / uBands;
          kq = mix(kl, kq, 0.7);
          outgoingLight *= (kq + 0.015) / (kl + 0.015);
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
