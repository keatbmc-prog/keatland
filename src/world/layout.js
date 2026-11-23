// One place for the hub's spatial plan, so structures, collision, AI and transitions agree.
import * as THREE from 'three';
import { fbm3 } from '../core/noise.js';

export const L = {
  spawn: new THREE.Vector3(0, 0, 25), spawnYaw: 0, // facing -Z (north, toward the ritual and the maw)
  platformR: 31,
  ritual: new THREE.Vector3(0, 0, -3), ritualR: 8,
  sword: new THREE.Vector3(16.5, 0, 9.5),
  heart: new THREE.Vector3(0, 33, -3),
  crown: new THREE.Vector3(0, 82, -3),
  bridge: { x0: -2.4, x1: 2.4, z0: -50, z1: -27 },
  maw: new THREE.Vector3(0, 5.5, -58), mawTrigger: -53.5,
  pencilBase: new THREE.Vector3(-29, -14, 2),
  pillarR: 60,
  // the lower place, reached through the gullet
  below: {
    tunnelExit: new THREE.Vector3(70, -112, -150),
    stairsTop: new THREE.Vector3(70, -128, -168),
    landing: new THREE.Vector3(70, -150, -214),
    door: new THREE.Vector3(70, -150, -219.5),
  },
};

/** Platform outline radius at angle a (organic, not a circle). */
export function platformRadius(a) {
  return L.platformR * (1 + 0.08 * Math.sin(a * 3 + 0.7) + 0.05 * Math.sin(a * 7 + 2.1)) + 2.5 * fbm3(Math.cos(a) * 1.3, Math.sin(a) * 1.3, 0.5, 2);
}

/** Walkable floor height on the hub platform, or null outside it. */
export function hubFloor(x, z) {
  const a = Math.atan2(z, x);
  const r = Math.hypot(x, z);
  const R = platformRadius(a) - 2.6;
  if (r > R) return null;
  let h = 0.18 * fbm3(x * 0.06, 0.3, z * 0.06, 3);
  const dr = Math.hypot(x - L.ritual.x, z - L.ritual.z);
  h -= 0.7 * (1 - smooth(L.ritualR - 1.5, L.ritualR + 1.5, dr)); // shallow ceremonial bowl
  const ds = Math.hypot(x - L.sword.x, z - L.sword.z);
  h += 0.55 * (1 - smooth(1.5, 7, ds)); // a mound under the sword
  return h;
}

export function bridgeFloor(x, z) {
  const b = L.bridge;
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return null;
  const t = (z - b.z1) / (b.z0 - b.z1);
  return 0.35 * Math.sin(t * Math.PI) - 0.1 * t;
}

export function mawFloor(x, z) {
  if (Math.abs(x) > 3.6 || z > -49 || z < -62) return null;
  return -0.1 - (Math.max(0, -z - 52)) * 0.18;
}

export function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
