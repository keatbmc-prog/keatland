// Where the photo cube hangs in the hub: a cradle of sinew fingers curling up toward it (open on the
// side facing the entrance), a ring of amber runes on the floor, motes that orbit it, its own light.
import * as THREE from 'three';
import { sweepGeometry } from '../geometry/sweep.js';
import { merge } from '../geometry/generators.js';
import { conformRing } from '../geometry/surfaces.js';
import { hubFloor } from './layout.js';
import { getTextures } from '../materials/library.js';
import { glowSprite } from '../entities/heart.js';
import { mulberry32 } from '../core/noise.js';

export const CUBE_SPOT = new THREE.Vector3(-14.5, 0, 11);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildCubeShrine({ scene, mats, collision, cube }) {
  const rng = mulberry32(31);
  const base = CUBE_SPOT.clone(); base.y = hubFloor(base.x, base.z) ?? 0;
  const g = new THREE.Group(); g.name = 'cube-shrine'; g.position.copy(base); scene.add(g);
  const C = V(0, 3.0, 0); // cube centre (local)
  cube.group.position.copy(C); g.add(cube.group);
  const openDir = Math.atan2(25 - base.z, 0 - base.x); // toward the spawn: leave the cradle open there
  const fingers = [], thorns = [];
  const nF = 9;
  for (let i = 0; i < nF; i++) {
    const a = openDir + Math.PI * 0.28 + (i / (nF - 1)) * Math.PI * 1.44;
    const r0 = 3.1 + rng() * 0.5;
    const p0 = V(Math.cos(a) * r0, -0.1, Math.sin(a) * r0);
    const p1 = V(Math.cos(a) * (r0 + 0.4), 1.4 + rng() * 0.6, Math.sin(a) * (r0 + 0.4));
    const p2 = V(Math.cos(a) * 2.9, 3.4 + rng() * 0.8, Math.sin(a) * 2.9);
    const p3 = V(Math.cos(a + 0.25) * 2.2, 4.6 + rng() * 0.6, Math.sin(a + 0.25) * 2.2);
    const p4 = V(Math.cos(a + 0.5) * 1.6, 4.1 + rng() * 0.4, Math.sin(a + 0.5) * 1.6);
    const c = new THREE.CatmullRomCurve3([p0, p1, p2, p3, p4]);
    const rad = 0.16 + rng() * 0.06;
    fingers.push(sweepGeometry(c, { tubular: 60, radial: 9, radius: (t) => rad * (1 - 0.8 * t) * (1 + 0.25 * Math.pow(Math.abs(Math.sin(t * 34)), 6)), noise: 0.04, noiseScale: 3, capEnd: true }));
    // little hooks along each finger
    for (let k = 1; k < 9; k++) {
      const t = k / 10, p = c.getPointAt(t), tan = c.getTangentAt(t);
      const out = p.clone().setY(0).normalize();
      const hk = new THREE.ConeGeometry(0.03 * (1 - t) + 0.012, 0.18, 5); hk.translate(0, 0.09, 0);
      hk.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), out.lerp(tan, 0.3).normalize()));
      hk.translate(p.x, p.y, p.z); thorns.push(hk);
    }
    collision.addObstacle({ x: base.x + p0.x, z: base.z + p0.z, r: 0.35 });
  }
  const fm = new THREE.Mesh(merge(fingers), mats.sinew); fm.castShadow = true; g.add(fm);
  g.add(new THREE.Mesh(merge(thorns), mats.bone));

  const T = getTextures();
  const ringMat = new THREE.MeshBasicMaterial({ map: T.runesAmber, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x885a2a });
  const ring = new THREE.Mesh(conformRing({ cx: 0, cz: 0, r0: 3.6, r1: 4.2, height: (x, z) => (hubFloor(base.x + x, base.z + z) ?? 0) - base.y, uRepeat: 3 }), ringMat);
  g.add(ring);

  const light = new THREE.PointLight(0xffc090, 14, 13, 1.8); light.position.copy(C).add(V(1.2, 2.6, 2.0)); g.add(light);
  const halo = glowSprite(0xffb070, 9, 0.1); halo.position.copy(C); halo.renderOrder = -1; g.add(halo);

  // motes orbiting the cube
  const nM = 160, mp = new Float32Array(nM * 3), md = [];
  for (let i = 0; i < nM; i++) md.push({ r: 2 + rng() * 1.8, a: rng() * 6.28, y: (rng() - 0.5) * 2.8, s: (0.15 + rng() * 0.4) * (rng() < 0.5 ? -1 : 1), tilt: (rng() - 0.5) * 0.8 });
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xffd0a0, size: 0.05, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  motes.frustumCulled = false; g.add(motes);

  return {
    group: g, center: () => g.localToWorld(C.clone()),
    update(dt, t) {
      for (let i = 0; i < nM; i++) {
        const d = md[i]; const a = d.a + t * d.s * (1 + cube.twisting * 3);
        mp[i * 3] = C.x + Math.cos(a) * d.r; mp[i * 3 + 1] = C.y + d.y + Math.sin(a * 2 + d.tilt) * 0.3; mp[i * 3 + 2] = C.z + Math.sin(a) * d.r;
      }
      mg.attributes.position.needsUpdate = true;
      light.intensity = 12 + cube.twisting * 10 + Math.sin(t * 2.1) * 1.5;
      halo.material.opacity = 0.08 + cube.twisting * 0.08;
    },
  };
}
