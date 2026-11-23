// The leaf portal: a ribbed archway of fused vertebrae with a living curtain of leaves growing out
// of it. The curtain breathes, parts as you come near, and behind it is a green dark that is clearly
// somewhere else. Used in the hub (way in) and, overgrown and paler, in the jungle (way out).
import * as THREE from 'three';
import { sweepGeometry } from '../geometry/sweep.js';
import { merge, vertebraGeometry, vertebraeAlong } from '../geometry/generators.js';
import { leafTextures, leafGeometry, foliageMaterial } from './foliage.js';
import { glowSprite } from '../entities/heart.js';
import { mulberry32 } from '../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * @param base    world position of the arch's centre on the ground
 * @param facing  yaw: the arch's front faces this direction (the side you walk in from)
 * @param ground  (x, z) -> floor height (world) or null
 */
export function buildLeafPortal({ parent, mats, collision, base, facing = 0, ground = () => 0, width = 4.2, height = 5.6, glow = 0x3aff9a, seed = 3, detail = 1, leaves = 340 }) {
  const rng = mulberry32(seed);
  const g = new THREE.Group(); g.position.copy(base); g.rotation.y = facing; parent.add(g);
  g.updateMatrixWorld(true);
  const hw = width / 2;
  // the arch line (local, in the XY plane; front faces +Z)
  const arch = new THREE.CatmullRomCurve3([V(-hw - 0.3, -0.3, 0), V(-hw, height * 0.55, 0.1), V(-hw * 0.55, height * 0.95, 0), V(0, height, -0.1), V(hw * 0.55, height * 0.95, 0), V(hw, height * 0.55, 0.1), V(hw + 0.3, -0.3, 0)]);
  const vg = vertebraGeometry(seed + 4, detail);
  const vm = vertebraeAlong(arch, 0.42, (t) => 0.27 + 0.1 * Math.pow(Math.sin(t * Math.PI), 0.3), V(0, 0, 1));
  const spine = new THREE.InstancedMesh(vg, mats.bone, vm.length); vm.forEach((m, i) => spine.setMatrixAt(i, m)); spine.castShadow = true; g.add(spine);
  // sinew cables + ribs that wrap the arch, roots that splay into the floor
  const parts = [];
  for (let k = 0; k < 3; k++) {
    const off = (k - 1) * 0.28;
    const pts = arch.getPoints(40).map((p) => p.clone().add(V(0, 0, off)).multiplyScalar(1).add(V(p.x * 0.06 * (k - 1), 0, 0)));
    parts.push(sweepGeometry(new THREE.CatmullRomCurve3(pts), { tubular: 120, radial: 7, radius: (t) => 0.07 + 0.03 * Math.pow(Math.abs(Math.sin(t * 50 + k)), 6), noise: 0.02 }));
  }
  for (let i = 0; i < 18; i++) {
    const t = 0.04 + (i / 17) * 0.92, p = arch.getPointAt(t), tan = arch.getTangentAt(t);
    const n = V(-tan.y, tan.x, 0).normalize();
    const ring = []; for (let k = 0; k <= 16; k++) { const a = (k / 16) * Math.PI * 2; ring.push(p.clone().addScaledVector(n, Math.cos(a) * 0.48).add(V(0, 0, Math.sin(a) * 0.48))); }
    parts.push(sweepGeometry(new THREE.CatmullRomCurve3(ring, true), { closed: true, tubular: 32, radial: 6, radius: () => 0.045 }));
  }
  for (const s of [-1, 1]) for (let r = 0; r < 4; r++) {
    const a = (r / 3 - 0.5) * 1.8 + (s < 0 ? Math.PI : 0);
    const p0 = V(s * hw, 1.2, 0), p1 = V(s * hw + Math.cos(a) * 1.0, 0.2, Math.sin(a) * 1.0), p2 = V(s * hw + Math.cos(a) * 2.0, -0.2, Math.sin(a) * 2.0);
    parts.push(sweepGeometry(new THREE.CatmullRomCurve3([p0, p1, p2]), { tubular: 24, radial: 7, radius: (t) => 0.2 * (1 - t) + 0.03, noise: 0.03, capEnd: true }));
  }
  const cables = new THREE.Mesh(merge(parts), mats.sinew); cables.castShadow = true; g.add(cables);

  // the curtain: rows of leaves hanging from the arch, plus leaves sprouting off the vertebrae
  const T = leafTextures();
  const kinds = [[T.broad, T.broadE, leafGeometry({ w: 0.55, h: 1.5, droop: 0.15, cup: 0.3 })], [T.monstera, T.monsteraE, leafGeometry({ w: 0.9, h: 1.4, droop: 0.12, cup: 0.25 })]];
  const curtains = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  kinds.forEach(([map, emap, geo], ki) => {
    const n = Math.round(leaves * (ki ? 0.4 : 0.6) * detail);
    const mesh = new THREE.InstancedMesh(geo, foliageMaterial({ map, emissiveMap: emap, emissive: glow, emissiveIntensity: 0.3, push: 1.6 }), n);
    for (let i = 0; i < n; i++) {
      let p;
      if (rng() < 0.7) {
        // hanging inside the opening: hung from the arch's underside, leaf tip pointing down
        const x = (rng() * 2 - 1) * hw * 0.92;
        const top = height * (1 - Math.pow(Math.abs(x) / (hw * 1.05), 2.4)) - 0.2;
        const y = top - rng() * top * 0.95;
        p = V(x, y, (rng() - 0.5) * 0.6);
        e.set(Math.PI + (rng() - 0.5) * 0.5, (rng() - 0.5) * 1.2, (rng() - 0.5) * 0.4);
      } else {
        const t = rng(), a = arch.getPointAt(t);
        p = a.clone().add(V((rng() - 0.5) * 0.4, (rng() - 0.5) * 0.3, (rng() - 0.5) * 0.6));
        e.set((rng() - 0.5) * 2.2, rng() * 6.28, (rng() - 0.5) * 2.2);
      }
      q.setFromEuler(e); const s = 0.6 + rng() * 0.8;
      m4.compose(p, q, V(s, s, s)).premultiply(g.matrixWorld);
      mesh.setMatrixAt(i, m4);
    }
    mesh.frustumCulled = false; parent.add(mesh); curtains.push(mesh);
  });

  // what is behind it: a green depth you cannot see the end of
  const veil = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.1, height * 1.05, 1, 1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(glow) }, uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */`varying vec2 vUv; uniform vec3 uColor; uniform float uTime;
      void main(){ vec2 d = vUv - vec2(0.5, 0.35); float a = exp(-dot(d * vec2(2.2, 1.6), d * vec2(2.2, 1.6)) * 3.0);
        float mask = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x) * smoothstep(1.0, 0.7, vUv.y);
        float fl = 0.85 + 0.15 * sin(uTime * 0.9 + vUv.y * 6.0);
        gl_FragColor = vec4(uColor * a * mask * 0.4 * fl, 1.0); }`,
  }));
  veil.position.set(0, height * 0.45, -0.5); g.add(veil);
  const light = new THREE.PointLight(glow, 9, 10, 1.8); light.position.set(0, 2.2, -0.6); g.add(light);
  const halo = glowSprite(glow, 4.5, 0.12); halo.position.set(0, 2.0, -0.8); g.add(halo);

  // feet are solid; the opening is not
  for (const s of [-1, 1]) {
    const w = V(s * (hw + 0.1), 0, 0).applyMatrix4(g.matrixWorld);
    collision.addObstacle({ x: w.x, z: w.z, r: 0.55 });
  }
  const front = V(Math.sin(facing), 0, Math.cos(facing)); // local +Z in world
  const center = base.clone();
  return {
    group: g, curtains, center, front,
    /** signed distance in front of the arch plane, and lateral offset */
    local(p) { const d = p.clone().sub(center); return { along: d.dot(front), side: d.x * Math.cos(facing) - d.z * Math.sin(facing) }; },
    update(dt, t) { veil.material.uniforms.uTime.value = t; light.intensity = 8 + Math.sin(t * 0.8) * 1.5; },
  };
}
