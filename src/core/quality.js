// Scalable quality presets. Desktop defaults to "high"; touch / small screens fall back to "low".
// Override with ?q=low|medium|high, or at runtime via window.__keatland.setQuality().
export const PRESETS = {
  low: {
    name: 'low', pixelRatio: 0.75, shadows: false, shadowMapSize: 512, bloom: true, bloomRes: 0.35,
    detail: 0.55, particles: 600, tendrilDepth: 2, distantStructures: 6, grain: true, antialias: false,
  },
  medium: {
    name: 'medium', pixelRatio: 1.0, shadows: true, shadowMapSize: 1024, bloom: true, bloomRes: 0.5,
    detail: 0.8, particles: 1600, tendrilDepth: 3, distantStructures: 12, grain: true, antialias: false,
  },
  high: {
    name: 'high', pixelRatio: 1.5, shadows: true, shadowMapSize: 2048, bloom: true, bloomRes: 0.5,
    detail: 1.0, particles: 3200, tendrilDepth: 3, distantStructures: 18, grain: true, antialias: false,
  },
};

export function pickQuality() {
  const q = new URLSearchParams(location.search).get('q');
  if (q && PRESETS[q]) return { ...PRESETS[q] };
  const touch = matchMedia('(pointer: coarse)').matches;
  const small = Math.min(innerWidth, innerHeight) < 600;
  return { ...PRESETS[touch || small ? 'low' : 'high'] };
}
