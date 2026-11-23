// Organic, "alive" props in the High-on-Life-ish language: goopy bulbous blobs, alien plants with
// glowing pods, blinking eyeballs that follow you, and the PA "speaker critters" (Yesterkeat's
// presence: a bulbous horn with one eye and a mouth that flaps while the PA is talking).
// Everything is built from a few shared geometries and toon materials, so it stays cheap.
import * as THREE from 'three';
import { toonify, PA } from './toon.js';
import { mulberry32 } from '../../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
export const PAL = { teal: 0x19d3c5, magenta: 0xff3fa4, acid: 0x9dff3a, orange: 0xff8a2a, violet: 0x7a3cff, pink: 0xff7fc8, cream: 0xfff1d6, plum: 0x3a1450, yellow: 0xffd23a };

export function toonMat(color, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.45, metalness: 0, emissive: o.emissive ?? 0x000000, emissiveIntensity: o.emissiveIntensity ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1 });
  return toonify(m, { rimK: 0.6, ...o.toon });
}

/** A lumpy blob: an icosphere pushed around by smooth noise (one geometry per seed). */
export function blobGeo(r = 1, { detail = 3, seed = 1, lump = 0.22, stretch = [1, 1, 1] } = {}) {
  const g = new THREE.IcosahedronGeometry(r, detail);
  const p = g.attributes.position, rng = mulberry32(seed);
  const ph = [rng() * 6, rng() * 6, rng() * 6, rng() * 6];
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i)); const n = v.clone().normalize();
    const k = 1 + lump * (Math.sin(n.x * 3.1 + ph[0]) * Math.cos(n.y * 2.7 + ph[1]) + 0.5 * Math.sin(n.z * 5.3 + ph[2]) * Math.sin(n.x * 4.1 + ph[3]));
    v.multiplyScalar(k); p.setXYZ(i, v.x * stretch[0], v.y * stretch[1], v.z * stretch[2]);
  }
  g.computeVertexNormals();
  return g;
}

/** A bulbous stalk (lathe with bulges) topped by a glowing pod. */
export function alienPlant({ seed = 1, h = 2.4, color = PAL.teal, pod = PAL.magenta, glow = 1.6 } = {}) {
  const rng = mulberry32(seed), g = new THREE.Group();
  const prof = []; const n = 14;
  for (let i = 0; i <= n; i++) { const t = i / n; prof.push(new THREE.Vector2(0.001 + (0.22 * (1 - t) + 0.07) * (1 + 0.35 * Math.sin(t * 9 + seed)), t * h)); }
  const stalkM = toonMat(color, { toon: { wobble: 0.04, wobbleF: 1.6, phase: rng() * 6, rim: PAL.acid, rimK: 0.7 } });
  const stalk = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), stalkM); stalk.castShadow = true; g.add(stalk);
  const podM = toonMat(pod, { emissive: pod, emissiveIntensity: glow, toon: { breathe: 0.08, phase: rng() * 6, rim: PAL.yellow, rimK: 0.8 } });
  const p = new THREE.Mesh(blobGeo(0.42 + rng() * 0.25, { seed, detail: 2, lump: 0.18, stretch: [1, 1.25, 1] }), podM); p.position.y = h + 0.25; g.add(p);
  // a couple of droopy side leaves (flattened blobs)
  for (let k = 0; k < 3; k++) {
    const leaf = new THREE.Mesh(blobGeo(0.35, { seed: seed + k * 9, detail: 1, lump: 0.25, stretch: [1.8, 0.3, 0.8] }), stalkM);
    const a = rng() * Math.PI * 2; leaf.position.set(Math.cos(a) * 0.35, h * (0.25 + 0.2 * k), Math.sin(a) * 0.35); leaf.rotation.set(0, -a, -0.5); g.add(leaf);
  }
  g.userData.pod = p;
  return g;
}

const eyeGeo = new THREE.SphereGeometry(1, 20, 14);
const lidGeo = new THREE.SphereGeometry(1.06, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
const scleraM = () => toonify(new THREE.MeshStandardMaterial({ color: 0xfffbf0, roughness: 0.25, emissive: 0x332a20, emissiveIntensity: 0.4 }), { rimK: 0.25, rim: 0xffd0ff, shadeK: 0.3 });
const pupilM = new THREE.MeshBasicMaterial({ color: 0x07040a });
/**
 * A blinking eyeball that tracks a target. `lidColor` makes the lids (skin / goop colour).
 * update(dt, t, targetWorld)
 */
export class Eyeball {
  constructor({ r = 0.2, iris = PAL.teal, lidColor = PAL.magenta, seed = 1, lazy = 0.2 } = {}) {
    this.group = new THREE.Group(); this.r = r; this.rng = mulberry32(seed); this.lazy = lazy;
    const ball = new THREE.Mesh(eyeGeo, scleraM()); ball.scale.setScalar(r); this.group.add(ball);
    this.look = new THREE.Group(); this.group.add(this.look);
    const irisM = toonify(new THREE.MeshStandardMaterial({ color: iris, emissive: iris, emissiveIntensity: 0.6, roughness: 0.2 }), { rimK: 0 });
    const ir = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 24), irisM); ir.position.z = r * 0.99; this.look.add(ir);
    const pu = new THREE.Mesh(new THREE.CircleGeometry(r * 0.27, 18), pupilM); pu.position.z = r * 1.0; this.look.add(pu);
    const hl = new THREE.Mesh(new THREE.CircleGeometry(r * 0.1, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); hl.position.set(r * 0.18, r * 0.2, r * 1.01); this.look.add(hl);
    const lm = toonMat(lidColor, { roughness: 0.5 });
    this.lids = [1, -1].map(() => { const l = new THREE.Mesh(lidGeo, lm); l.scale.setScalar(r); this.group.add(l); return l; });
    this.blinkT = 1 + this.rng() * 4; this.blink = 0; this.open = 1;
  }
  update(dt, t, target) {
    this.blinkT -= dt; if (this.blinkT <= 0) { this.blink = 0.16; this.blinkT = 1.5 + this.rng() * 4.5; }
    const closed = this.blink > 0 ? 1 : 0; this.blink -= dt;
    const o = Math.max(0, Math.min(1, this.open * (1 - closed)));
    // lids: rotate together from the poles (open = 1: lids retracted)
    // closed: one hemisphere over the top, one under the bottom; open: both rolled back
    this.lids[0].rotation.x = -(Math.PI * 0.5 - 0.3) * o;
    this.lids[1].rotation.x = Math.PI + (Math.PI * 0.5 - 0.4) * o;
    if (target) {
      const local = this.group.worldToLocal(target.clone());
      const yaw = Math.atan2(local.x, local.z), pitch = -Math.atan2(local.y, Math.hypot(local.x, local.z));
      const k = Math.min(1, dt * 6);
      this.look.rotation.y += (THREE.MathUtils.clamp(yaw, -0.9, 0.9) + Math.sin(t * 0.7) * this.lazy - this.look.rotation.y) * k;
      this.look.rotation.x += (THREE.MathUtils.clamp(pitch, -0.7, 0.7) - this.look.rotation.x) * k;
    }
  }
}

/**
 * A speaker critter: a bulbous goopy horn with one big eye and a mouth that flaps while the PA talks.
 * Yesterkeat's presence in the Backrooms and the Works. update(dt, t, camWorld)
 */
export class SpeakerCritter {
  constructor({ seed = 1, scale = 1, body = PAL.violet, mouth = 0x2a0614 } = {}) {
    const rng = mulberry32(seed); this.g = new THREE.Group(); this.g.scale.setScalar(scale); this.phase = rng() * 6;
    const bm = toonMat(body, { roughness: 0.35, toon: { breathe: 0.04, phase: this.phase, rim: PAL.acid, rimK: 0.8 } });
    this.body = new THREE.Mesh(blobGeo(0.32, { seed, detail: 3, lump: 0.12, stretch: [1.1, 0.85, 1.0] }), bm); this.g.add(this.body);
    const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.12, 0.3, 20, 1, true), toonMat(PAL.orange, { toon: { rim: PAL.yellow } })); horn.material.side = THREE.DoubleSide; horn.rotation.x = Math.PI / 2; horn.position.set(0, -0.08, 0.3); this.g.add(horn);
    this.mouth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10), toonMat(mouth, { emissive: 0xff2a6a, emissiveIntensity: 0.25 })); this.mouth.scale.set(1, 0.15, 0.4); this.mouth.position.set(0, -0.08, 0.43); this.g.add(this.mouth);
    this.eye = new Eyeball({ r: 0.13, iris: PAL.acid, lidColor: body, seed: seed + 3 }); this.eye.group.position.set(0, 0.17, 0.22); this.g.add(this.eye.group);
    this.open = 0;
  }
  update(dt, t, cam) {
    const talking = PA.talk > 0;
    const target = talking ? 0.35 + 0.65 * Math.abs(Math.sin(t * 13 + this.phase) * Math.sin(t * 5.3)) : 0.05;
    this.open += (target - this.open) * Math.min(1, dt * 18);
    this.mouth.scale.y = 0.12 + this.open * 0.85;
    this.g.rotation.z = Math.sin(t * 1.3 + this.phase) * 0.08 + (talking ? Math.sin(t * 9) * 0.05 : 0);
    this.body.scale.set(1 + this.open * 0.06, 1 - this.open * 0.06, 1);
    this.eye.update(dt, t, cam);
  }
}
