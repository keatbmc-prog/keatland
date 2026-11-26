// Scalable quality presets. Desktop defaults to "high"; phones / tablets / weak devices get "mobile"
// (a phone-first tier: capped resolution, no shadows or bloom, thinner instancing, cheaper shaders,
// no per-vertex architecture warp, heavier fog, adaptive resolution and zones built on approach).
// Override with ?q=low|medium|high, or at runtime via window.__keatland.setQuality().
const BASE = { mobile: false, warp: true, lazyZones: false, adaptive: false, fogMul: 1, cheapShaders: false, voices: 6, scrub: true };
export const PRESETS = {
  mobile: {
    ...BASE, name: 'mobile', mobile: true, pixelRatio: 1.25, minPixelRatio: 0.6, shadows: false, shadowMapSize: 512, bloom: false, bloomRes: 0.25,
    detail: 0.42, particles: 260, tendrilDepth: 2, distantStructures: 4, grain: false, antialias: false,
    warp: false, lazyZones: true, adaptive: true, fogMul: 1.35, cheapShaders: true, voices: 3, scrub: false, farClip: 2800,
  },
  low: {
    ...BASE, name: 'low', pixelRatio: 0.75, shadows: false, shadowMapSize: 512, bloom: true, bloomRes: 0.35,
    detail: 0.55, particles: 600, tendrilDepth: 2, distantStructures: 6, grain: true, antialias: false,
  },
  medium: {
    ...BASE, name: 'medium', pixelRatio: 1.0, shadows: true, shadowMapSize: 1024, bloom: true, bloomRes: 0.5,
    detail: 0.8, particles: 1600, tendrilDepth: 3, distantStructures: 12, grain: true, antialias: false,
  },
  high: {
    ...BASE, name: 'high', pixelRatio: 1.5, shadows: true, shadowMapSize: 2048, bloom: true, bloomRes: 0.5,
    detail: 1.0, particles: 3200, tendrilDepth: 3, distantStructures: 18, grain: true, antialias: false,
  },
};

/** true on phones / tablets / weak devices: a coarse primary pointer, a small touch screen, or low cores / memory */
export function isMobileDevice() {
  const coarse = matchMedia('(pointer: coarse)').matches, fine = matchMedia('(any-pointer: fine)').matches;
  const touch = coarse || (navigator.maxTouchPoints || 0) > 0;
  const small = Math.min(innerWidth, innerHeight) < 600;
  const weak = (navigator.hardwareConcurrency || 8) <= 2 || (navigator.deviceMemory || 8) <= 2;
  const ua = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  return (coarse && !fine) || (touch && small) || ua || weak;
}

export function pickQuality() {
  const q = new URLSearchParams(location.search).get('q');
  const touch = isMobileDevice();
  if (q && PRESETS[q]) return { ...PRESETS[q], touch };
  return { ...PRESETS[touch ? 'mobile' : 'high'], touch };
}
