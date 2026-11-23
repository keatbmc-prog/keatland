// Material library. Built-in PBR materials extended (onBeforeCompile) with:
//   - "breathing" vertex displacement (the structure is alive),
//   - world-space vein networks that pulse with light,
//   - fresnel rim (subsurface-ish edge glow),
//   - noise-driven colour variation so huge surfaces never look flat.
// All materials share one clock uniform (U.time) advanced by the engine.
import * as THREE from 'three';
import { GLSL_NOISE } from '../core/noise.js';
import { svgTexture, svgNormalTexture, tileableHeight, heightToNormalTexture, heightToGreyTexture } from './textures.js';
import { honeycombSVG, runeBandSVG, reliefPanelSVG, sigilSVG, pencilLiverySVG, irisSVG, scleraSVG, checkerSVG } from './svgArt.js';

export const U = {
  time: { value: 0 },
  heartbeat: { value: 0 },   // 0..1 pulse driven by the heart entity
  ritual: { value: 0 },      // 0..1 intensity of the ceremony (brightens veins nearby)
  ritualPos: { value: new THREE.Vector3(0, 0, -4) },
};

let cache = null;
export function getTextures() {
  if (cache) return cache;
  const hFlesh = tileableHeight(256, 6, 3, 5, true);
  const hStone = tileableHeight(256, 10, 9, 6, false);
  const hBark = tileableHeight(256, 4, 15, 5, true);
  cache = {
    fleshNormal: heightToNormalTexture(hFlesh, 256, 3.0, [3, 3]),
    stoneNormal: heightToNormalTexture(hStone, 256, 4.0, [2, 2]),
    barkNormal: heightToNormalTexture(hBark, 256, 3.5, [2, 6]),
    fleshRough: heightToGreyTexture(hFlesh, 256, (v) => 0.45 + v * 0.35, [3, 3]),
    honeycomb: svgTexture(honeycombSVG({}), { width: 1024, height: 1024 }),
    honeycombPink: svgTexture(honeycombSVG({ line: '#d9467f', seed: 7, cells: 6 }), { width: 1024, height: 1024 }),
    runes: svgTexture(runeBandSVG({}), { width: 2048, height: 256 }),
    runesAmber: svgTexture(runeBandSVG({ color: '#ffb347', seed: 23, count: 24 }), { width: 2048, height: 256 }),
    relief: svgTexture(reliefPanelSVG({}), { width: 512, height: 1024 }),
    relief2: svgTexture(reliefPanelSVG({ seed: 57 }), { width: 512, height: 1024 }),
    sigil: svgTexture(sigilSVG({}), { width: 2048, height: 2048, wrap: false }),
    pencil: svgTexture(pencilLiverySVG({}), { width: 512, height: 2048 }),
    iris: svgTexture(irisSVG({}), { width: 512, height: 512, wrap: false }),
    irisGreen: svgTexture(irisSVG({ c1: '#b6e33a', c2: '#3f7d1a', c3: '#e05aa0', seed: 9, rays: 16 }), { width: 256, height: 256, wrap: false }),
    irisPink: svgTexture(irisSVG({ c1: '#e05aa0', c2: '#5a1a50', c3: '#b6e33a', seed: 12, rays: 14 }), { width: 256, height: 256, wrap: false }),
    sclera: svgTexture(scleraSVG({}), { width: 256, height: 256 }),
    checker: svgTexture(checkerSVG({}), { width: 1024, height: 1024 }),
    // carved versions of the artwork (luminance -> height -> normals)
    honeycombNormal: svgNormalTexture(honeycombSVG({ seed: 4 }), { width: 1024, height: 1024, strength: 5, invert: true, blur: 2.5 }),
    reliefNormal: svgNormalTexture(reliefPanelSVG({}), { width: 512, height: 1024, strength: 7, blur: 2 }),
    relief2Normal: svgNormalTexture(reliefPanelSVG({ seed: 57 }), { width: 512, height: 1024, strength: 7, blur: 2 }),
  };
  return cache;
}

/**
 * Organic surface: MeshStandardMaterial + breathing + veins + rim.
 * opts: color, color2, roughness, metalness, veinColor, veinAmount, breath, breathScale, rim, rimColor, normalMap, normalScale, emissiveMap
 */
export function organicMaterial(opts = {}) {
  const T = getTextures();
  const m = new THREE.MeshStandardMaterial({
    color: opts.color ?? 0x2a2224,
    roughness: opts.roughness ?? 0.62,
    metalness: opts.metalness ?? 0.0,
    normalMap: opts.normalMap === null ? null : (opts.normalMap ?? T.fleshNormal),
    normalScale: new THREE.Vector2(opts.normalScale ?? 1.2, opts.normalScale ?? 1.2),
    roughnessMap: opts.roughnessMap ?? null,
    emissive: new THREE.Color(opts.emissive ?? 0x000000),
    emissiveMap: opts.emissiveMap ?? null,
    emissiveIntensity: opts.emissiveIntensity ?? 1,
    side: opts.side ?? THREE.FrontSide,
    envMapIntensity: opts.envMapIntensity ?? 0.6,
    flatShading: opts.flatShading ?? false,
  });
  const p = {
    uColor2: { value: new THREE.Color(opts.color2 ?? 0x120d10) },
    uVein: { value: new THREE.Color(opts.veinColor ?? 0x6fe0d0) },
    uVeinAmt: { value: opts.veinAmount ?? 0.6 },
    uVeinScale: { value: opts.veinScale ?? 0.18 },
    uBreath: { value: opts.breath ?? 0.25 },
    uBreathScale: { value: opts.breathScale ?? 0.06 },
    uRim: { value: new THREE.Color(opts.rimColor ?? 0x40202a) },
    uRimAmt: { value: opts.rim ?? 0.6 },
    uColorScale: { value: opts.colorScale ?? 0.05 },
    uSway: { value: opts.sway ?? 0.0 },
  };
  m.userData.klUniforms = p;
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, p, { uTime: U.time, uHeart: U.heartbeat, uRitual: U.ritual, uRitualPos: U.ritualPos });
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uBreath; uniform float uBreathScale; uniform float uHeart; uniform float uSway;
        attribute float aSway; attribute float aPhase;
        varying vec3 vKlWorld; varying vec3 vKlObj;
        ${GLSL_NOISE}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 wp0 = vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            wp0 = instanceMatrix * wp0;
          #endif
          wp0 = modelMatrix * wp0;
          float br = kl_snoise(wp0.xyz * uBreathScale + vec3(0.0, uTime*0.07, uTime*0.05));
          float swell = sin(uTime*0.6 + wp0.y*0.08 + br*2.0) * 0.5 + 0.5;
          transformed += objectNormal * uBreath * (br*0.6 + swell*0.4 + uHeart*0.25);
          // hanging growths sway: aSway is 0 at the root and 1 at the tip
          float sw = aSway * aSway * uSway;
          transformed += vec3(sin(uTime*0.45 + aPhase*6.28 + wp0.y*0.05), 0.0, cos(uTime*0.37 + aPhase*4.1)) * sw;
          vKlObj = position;
        }`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        {
          vec4 wp = vec4(transformed,1.0);
          #ifdef USE_INSTANCING
            wp = instanceMatrix * wp;
          #endif
          vKlWorld = (modelMatrix * wp).xyz;
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform vec3 uColor2; uniform vec3 uVein; uniform float uVeinAmt; uniform float uVeinScale;
        uniform vec3 uRim; uniform float uRimAmt; uniform float uColorScale; uniform float uHeart; uniform float uRitual; uniform vec3 uRitualPos;
        varying vec3 vKlWorld; varying vec3 vKlObj;
        ${GLSL_NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float klN = kl_fbm(vKlWorld * uColorScale);
        diffuseColor.rgb = mix(diffuseColor.rgb, uColor2, smoothstep(-0.3, 0.5, klN));
        float klMott = kl_snoise(vKlWorld * uColorScale * 7.0);
        diffuseColor.rgb *= 0.85 + 0.3 * klMott;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 vp = vKlWorld * uVeinScale;
          float v1 = clamp(1.0 - abs(kl_snoise(vp + vec3(0.0, uTime*0.01, 0.0))), 0.0, 1.0);
          float v2 = clamp(1.0 - abs(kl_snoise(vp * 2.1 + 7.3)), 0.0, 1.0);
          float vmask = smoothstep(0.05, 0.55, kl_snoise(vp * 0.27 + 11.0));
          float vein = (pow(v1, 28.0) + pow(v2, 40.0) * 0.5) * vmask;
          float flow = 0.55 + 0.45 * sin(uTime*1.3 - length(vKlWorld)*0.15 + kl_snoise(vp*0.5)*3.0);
          float near = 1.0 + uRitual * 2.5 * exp(-distance(vKlWorld, uRitualPos) * 0.06);
          totalEmissiveRadiance += uVein * vein * uVeinAmt * flow * (0.6 + uHeart*0.8) * near;
        }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        {
          float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
          totalEmissiveRadiance += uRim * fr * uRimAmt;
        }`);
  };
  m.customProgramCacheKey = () => 'kl-organic';
  return m;
}

export function makeMaterials() {
  const T = getTextures();
  const mats = {
    // the colossal body of the hub: dark wine-charcoal flesh with teal vein light
    flesh: organicMaterial({ color: 0x302830, color2: 0x0e0b10, veinColor: 0x5fd6c6, veinAmount: 0.45, breath: 0.35, rim: 0.5, rimColor: 0x3a1a26 }),
    // pale vertebral bone for ribs/arches
    bone: organicMaterial({ color: 0x8c8274, color2: 0x3b342e, veinColor: 0xffa860, veinAmount: 0.12, breath: 0.12, roughness: 0.55, rim: 0.35, rimColor: 0x2a2018, normalMap: T.barkNormal, normalScale: 1.6, colorScale: 0.08 }),
    // glossy black chitin
    chitin: organicMaterial({ color: 0x1c1a20, color2: 0x07060a, veinColor: 0xd9467f, veinAmount: 0.5, breath: 0.05, roughness: 0.28, rim: 0.7, rimColor: 0x23304a, normalScale: 0.6 }),
    // tendrils: sinewy, more emissive tips
    sinew: organicMaterial({ sway: 1.4, color: 0x3a2c32, color2: 0x120d10, veinColor: 0xffb060, veinAmount: 0.3, breath: 0.08, roughness: 0.5, rim: 0.8, rimColor: 0x50202c, normalMap: T.barkNormal, colorScale: 0.15, veinScale: 0.5 }),
    // floor: worn stone-flesh
    floor: organicMaterial({ color: 0x2a2523, color2: 0x0e0c0c, veinColor: 0x5fd6c6, veinAmount: 0.18, breath: 0.0, roughness: 0.5, rim: 0.15, normalMap: T.honeycombNormal, normalScale: 0.9, emissive: 0xffffff, emissiveMap: T.honeycomb, emissiveIntensity: 0.035, colorScale: 0.04, veinScale: 0.12 }),
    stone: organicMaterial({ color: 0x46423e, color2: 0x1a1817, veinColor: 0x7fd6c8, veinAmount: 0.15, breath: 0.0, roughness: 0.85, rim: 0.2, rimColor: 0x1a2a2a, normalMap: T.stoneNormal, normalScale: 2.0, colorScale: 0.2 }),
  };
  // Honeycomb skin: membranous shell with luminous chalk cells.
  mats.honeycomb = organicMaterial({ color: 0x17141a, color2: 0x060508, veinAmount: 0.25, breath: 0.25, emissive: 0xffffff, emissiveMap: T.honeycomb, emissiveIntensity: 0.22, rim: 0.4, rimColor: 0x103030 });
  mats.honeycombPink = organicMaterial({ color: 0x17141a, color2: 0x060508, veinAmount: 0.2, breath: 0.2, emissive: 0xffffff, emissiveMap: T.honeycombPink, emissiveIntensity: 0.2, rim: 0.4, rimColor: 0x301020 });
  mats.relief = organicMaterial({ color: 0x5a5048, color2: 0x231d1a, veinAmount: 0.1, breath: 0.0, emissive: 0xffc58a, emissiveMap: T.relief, emissiveIntensity: 0.12, roughness: 0.7, normalMap: T.reliefNormal, normalScale: 1.6, rim: 0.2 });
  mats.relief2 = organicMaterial({ color: 0x4a4440, color2: 0x1d1917, veinAmount: 0.1, breath: 0.0, emissive: 0x9fe0d6, emissiveMap: T.relief2, emissiveIntensity: 0.1, roughness: 0.7, normalMap: T.relief2Normal, normalScale: 1.6, rim: 0.2 });
  return mats;
}
