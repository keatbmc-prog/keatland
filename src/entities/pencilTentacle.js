// The pencil-tentacle: a giant hexagonal pencil that grew muscles. Its body is integrated each
// frame from travelling curvature waves (so it coils, uncoils and reaches on its own), it has a
// behaviour loop (idle coil -> draw -> watch the ceremony -> notice the visitor), and its graphite
// tip leaves luminous lines hanging in the air that slowly fade.
import * as THREE from 'three';
import { getTextures, U } from '../materials/library.js';
import { L, platformRadius } from '../world/layout.js';
import { blobGeometry } from '../geometry/sweep.js';
import { noise3 } from '../core/noise.js';

const SIDES = 6;

export class PencilTentacle {
  constructor(scene, { quality, mats, ctx }) {
    this.ctx = ctx;
    this.N = Math.round(200 * Math.max(0.6, quality.detail));
    this.length = 64; this.R = 1.25;
    this.base = new THREE.Vector3(-37, -16, 4);
    this.baseDir = new THREE.Vector3(0.25, 1, 0.05).normalize();
    this.spine = Array.from({ length: this.N + 1 }, () => new THREE.Vector3());
    this.frames = Array.from({ length: this.N + 1 }, () => ({ t: new THREE.Vector3(), n: new THREE.Vector3(), b: new THREE.Vector3() }));
    this.state = 'coil'; this.stateT = 0; this.stateDur = 10;
    this.reach = 0; this.target = new THREE.Vector3(0, 18, 0); this.targetSm = this.target.clone();
    this.curl = 1; this.curlTarget = 1;
    this.tip = new THREE.Vector3(); this.tipPrev = new THREE.Vector3(); this.tipSpeed = 0;
    this.yaw = 0;
    this.buildMesh(scene);
    this.buildTrail(scene);
    // the rupture it grows out of
    const rup = blobGeometry(5, { detail: 4, noise: 0.45, noiseScale: 1.4, squash: [1.4, 0.8, 1.4], seed: 77, lumps: [{ dir: [0, -1, 0], size: 2, amp: 1.2 }] });
    rup.translate(this.base.x, this.base.y + 3, this.base.z);
    const rm = new THREE.Mesh(rup, mats.flesh); rm.castShadow = true; scene.add(rm);
    this.tipLight = new THREE.PointLight(0xbfe8ff, 0, 14, 2); scene.add(this.tipLight);
  }

  buildMesh(scene) {
    const T = getTextures();
    const ringV = SIDES * 2; // split vertices for flat facets
    const count = (this.N + 1) * ringV;
    const pos = new Float32Array(count * 3), nor = new Float32Array(count * 3), uv = new Float32Array(count * 2), aS = new Float32Array(count), aA = new Float32Array(count);
    const idx = [];
    for (let i = 0; i <= this.N; i++) {
      for (let f = 0; f < SIDES; f++) for (let c = 0; c < 2; c++) {
        const k = i * ringV + f * 2 + c;
        uv[k * 2] = (f + c) / SIDES; uv[k * 2 + 1] = (i / this.N) * 9;
        aS[k] = i / this.N; aA[k] = (f + c) / SIDES;
      }
    }
    for (let i = 0; i < this.N; i++) for (let f = 0; f < SIDES; f++) {
      const a = i * ringV + f * 2, b = a + 1, c = a + ringV, d = b + ringV;
      idx.push(a, b, c, b, d, c);
    }
    // tip cap
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    g.setAttribute('aA', new THREE.BufferAttribute(aA, 1));
    g.setIndex(idx);
    const mat = new THREE.MeshStandardMaterial({ map: T.pencil, roughness: 0.32, metalness: 0.0, envMapIntensity: 1.0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = U.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
        attribute float aS; attribute float aA; varying float vS; varying float vA;`).replace('#include <begin_vertex>', `#include <begin_vertex>
        vS = aS; vA = aA;`);
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        varying float vS; varying float vA; uniform float uTime;
        float pHash(float n){ return fract(sin(n)*43758.5453); }`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        float pScal = 0.905 + 0.006 * cos(vA * 6.2831 * 6.0);
        if (vS > pScal && vS < 0.987) roughnessFactor = 0.8;
        if (vS < 0.06) roughnessFactor = 0.85;`)
        .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        if (vS > 0.06 && vS < 0.11) metalnessFactor = 1.0;
        if (vS >= 0.987) metalnessFactor = 0.6;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float sc = 0.905 + 0.006 * cos(vA * 6.2831 * 6.0);
          if (vS < 0.06) diffuseColor.rgb = vec3(0.62, 0.30, 0.32) * (0.85 + 0.15 * pHash(floor(vA*40.0)+floor(vS*900.0)));
          else if (vS < 0.11) {
            float rib = 0.6 + 0.4 * step(0.5, fract(vS * 260.0));
            diffuseColor.rgb = vec3(0.78, 0.74, 0.62) * rib;
          }
          else if (vS > sc && vS < 0.987) {
            float grain = 0.85 + 0.15 * sin(vA * 140.0 + sin(vS * 300.0) * 2.0);
            diffuseColor.rgb = vec3(0.72, 0.52, 0.32) * grain;
          }
          else if (vS >= 0.987) diffuseColor.rgb = vec3(0.08, 0.08, 0.09);
        }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          if (vS > 0.993) totalEmissiveRadiance += vec3(0.5, 0.75, 0.9) * (0.4 + 0.3 * sin(uTime * 3.0));`);
    };
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true; this.mesh.frustumCulled = false;
    this.mesh.name = 'pencil-tentacle';
    scene.add(this.mesh);
  }

  buildTrail(scene) {
    this.TN = 900;
    this.trail = []; // {p, t, w}
    const g = new THREE.BufferGeometry();
    this.tPos = new Float32Array(this.TN * 2 * 3); this.tAge = new Float32Array(this.TN * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.tPos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aAge', new THREE.BufferAttribute(this.tAge, 1).setUsage(THREE.DynamicDrawUsage));
    const idx = []; for (let i = 0; i < this.TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: U.time },
      vertexShader: `attribute float aAge; varying float vAge; void main(){ vAge = aAge; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `varying float vAge; uniform float uTime;
        void main(){ float a = clamp(1.0 - vAge / 26.0, 0.0, 1.0); a = a*a; if (vAge < 0.0) discard;
          vec3 c = mix(vec3(0.55,0.85,0.95), vec3(0.85,0.82,0.75), clamp(vAge/8.0,0.0,1.0));
          gl_FragColor = vec4(c * a * 0.6, 1.0); }`,
    });
    this.trailMesh = new THREE.Mesh(g, mat); this.trailMesh.frustumCulled = false; this.trailMesh.renderOrder = 6;
    scene.add(this.trailMesh);
    this.trailAcc = 0;
  }

  pickState() {
    const ctx = this.ctx;
    const r = Math.random();
    const playerNear = ctx.player && ctx.player.position.distanceTo(this.base) < 30;
    if (playerNear && r < 0.35) { this.state = 'notice'; this.stateDur = 7 + Math.random() * 4; }
    else if (U.ritual.value > 0.3 && r < 0.7) { this.state = 'watch'; this.stateDur = 12; }
    else if (r < 0.6) { this.state = 'draw'; this.stateDur = 14 + Math.random() * 8; }
    else { this.state = 'coil'; this.stateDur = 8 + Math.random() * 6; }
    this.stateT = 0;
  }

  update(dt, t, camera) {
    this.simT = t;
    this.stateT += dt;
    if (this.stateT > this.stateDur) this.pickState();
    // behaviour -> reach target, curl amount
    let reach = 0, curl = 1;
    if (this.state === 'coil') { curl = 1.35; reach = 0.15; this.target.set(-30, 30, -6); }
    if (this.state === 'draw') {
      curl = 0.55; reach = 0.9;
      const a = t * 0.35; // trace a slow lemniscate-ish figure in the air: it is drawing
      this.target.set(-14 + Math.cos(a) * 9, 17 + Math.sin(a * 2) * 5, 6 + Math.sin(a) * 9);
    }
    if (this.state === 'watch') { curl = 0.8; reach = 0.8; const a = t * 0.5; this.target.set(L.ritual.x + Math.cos(a) * 6, 13 + Math.sin(t * 0.7), L.ritual.z + Math.sin(a) * 6); }
    if (this.state === 'notice' && this.ctx.player) { curl = 0.4; reach = 1.0; this.target.copy(this.ctx.player.position).add(new THREE.Vector3(0, 5 + Math.sin(t) * 0.8, 0)); this.target.y = Math.max(this.target.y, 5); }
    if (this.ctx.swordShock > 0) { curl = 1.6; reach = 0.1; }
    this.reach += (reach - this.reach) * Math.min(1, dt * 0.6);
    this.curl += (curl - this.curl) * Math.min(1, dt * 0.4);
    this.targetSm.lerp(this.target, Math.min(1, dt * 0.5));

    // integrate the spine
    const ds = this.length / this.N;
    const dir = this.baseDir.clone();
    const p = this.base.clone();
    const n = new THREE.Vector3(1, 0, 0); n.sub(dir.clone().multiplyScalar(n.dot(dir))).normalize();
    const q = new THREE.Quaternion();
    const tmp = new THREE.Vector3(), toT = new THREE.Vector3();
    for (let i = 0; i <= this.N; i++) {
      const s = i / this.N;
      this.spine[i].copy(p);
      const fr = this.frames[i]; fr.t.copy(dir); fr.n.copy(n); fr.b.crossVectors(dir, n);
      // curvature: travelling waves + tightening coil toward the tip
      const k1 = 0.05 * Math.sin(s * 7 - t * 0.7) + 0.035 * Math.sin(s * 13 + t * 0.45) + this.curl * 0.42 * Math.pow(s, 3.2) * (1 + 0.3 * Math.sin(t * 0.3));
      const k2 = 0.045 * Math.sin(s * 5.3 + t * 0.52 + 1.3) + 0.02 * noise3(s * 3, t * 0.1, 7);
      q.setFromAxisAngle(fr.b, k1 * ds); dir.applyQuaternion(q); n.applyQuaternion(q);
      q.setFromAxisAngle(fr.n, k2 * ds); dir.applyQuaternion(q);
      // twist the frame slowly so the hex facets roll
      q.setFromAxisAngle(dir, 0.004); n.applyQuaternion(q);
      // reach toward the target (stronger mid-body)
      const w = this.reach * 0.06 * Math.sin(Math.PI * Math.min(1, s * 1.15)) ;
      toT.subVectors(this.targetSm, p).normalize();
      tmp.copy(dir).lerp(toT, w).normalize();
      q.setFromUnitVectors(dir, tmp); dir.copy(tmp); n.applyQuaternion(q);
      // stay out of the walkway: lift over the platform
      if (s > 0.15) {
        const r = Math.hypot(p.x, p.z);
        const R = platformRadius(Math.atan2(p.z, p.x));
        const floorClear = (r < R + 2) ? 4.5 : -40;
        if (p.y < floorClear) { dir.y += (floorClear - p.y) * 0.02; dir.normalize(); }
        if (p.y > 46) { dir.y -= 0.03; dir.normalize(); }
      }
      n.sub(tmp.copy(dir).multiplyScalar(n.dot(dir)));
      if (n.lengthSq() < 1e-8) n.set(dir.y, -dir.x, 0.3).cross(dir);
      n.normalize();
      p.addScaledVector(dir, ds);
    }
    this.writeGeometry(t);
    // tip + trail
    this.tipPrev.copy(this.tip);
    this.tip.copy(this.spine[this.N]).addScaledVector(this.frames[this.N].t, 0.2);
    this.tipSpeed = this.tipPrev.distanceTo(this.tip) / Math.max(dt, 1e-3);
    this.tipLight.position.copy(this.tip);
    this.tipLight.intensity = 30 + 20 * Math.sin(t * 3);
    this.updateTrail(dt, camera);
  }

  writeGeometry() {
    const pos = this.mesh.geometry.attributes.position, nor = this.mesh.geometry.attributes.normal;
    const P = pos.array, Nn = nor.array;
    const corner = new THREE.Vector3(), fn = new THREE.Vector3();
    const ringV = SIDES * 2;
    for (let i = 0; i <= this.N; i++) {
      const s = i / this.N;
      let r = this.R;
      if (s < 0.06) r = this.R * 1.02; // eraser
      else if (s < 0.11) r = this.R * (1.06 + 0.025 * (Math.sin(s * 1600) > 0 ? 1 : 0)); // ferrule crimps
      if (s > 0.9) r = this.R * Math.max(0.02, 1 - (s - 0.9) / 0.1) ; // sharpened cone
      if (s > 0.985) r = Math.min(r, this.R * 0.15 * (1 - (s - 0.985) / 0.015) + 0.01);
      if (s < 0.004) r *= 0.9;
      const fr = this.frames[i], c = this.spine[i];
      for (let f = 0; f < SIDES; f++) {
        const a0 = (f / SIDES) * Math.PI * 2, a1 = ((f + 1) / SIDES) * Math.PI * 2, am = (a0 + a1) / 2;
        fn.set(0, 0, 0).addScaledVector(fr.n, Math.cos(am)).addScaledVector(fr.b, Math.sin(am));
        if (s > 0.9) fn.addScaledVector(fr.t, 0.5).normalize();
        for (let cc = 0; cc < 2; cc++) {
          const a = cc ? a1 : a0;
          corner.copy(c).addScaledVector(fr.n, Math.cos(a) * r).addScaledVector(fr.b, Math.sin(a) * r);
          const k = (i * ringV + f * 2 + cc) * 3;
          P[k] = corner.x; P[k + 1] = corner.y; P[k + 2] = corner.z;
          Nn[k] = fn.x; Nn[k + 1] = fn.y; Nn[k + 2] = fn.z;
        }
      }
    }
    pos.needsUpdate = true; nor.needsUpdate = true;
    this.mesh.geometry.computeBoundingSphere();
  }

  updateTrail(dt, camera) {
    this.trailAcc += dt;
    const drawing = this.state === 'draw' || this.state === 'watch' || this.state === 'notice';
    if (this.trailAcc > 0.035) {
      this.trailAcc = 0;
      this.trail.push({ p: this.tip.clone(), born: this.simT, w: drawing ? 0.06 : 0.0, gap: !drawing });
      if (this.trail.length > this.TN) this.trail.shift();
    }
    const now = this.simT;
    const cam = camera.position;
    const side = new THREE.Vector3(), tan = new THREE.Vector3(), view = new THREE.Vector3();
    const n = this.trail.length;
    for (let i = 0; i < this.TN; i++) {
      const k = i * 2;
      if (i >= n) { this.tAge[k] = this.tAge[k + 1] = -1; this.tPos.fill(0, k * 3, k * 3 + 6); continue; }
      const e = this.trail[i];
      const nb = this.trail[Math.min(n - 1, i + 1)].p, pb = this.trail[Math.max(0, i - 1)].p;
      tan.subVectors(nb, pb); if (tan.lengthSq() < 1e-10) tan.set(0, 1, 0); tan.normalize(); view.subVectors(cam, e.p).normalize();
      side.crossVectors(tan, view); if (side.lengthSq() < 1e-10) side.set(1, 0, 0); side.normalize().multiplyScalar(e.w);
      this.tPos[k * 3] = e.p.x + side.x; this.tPos[k * 3 + 1] = e.p.y + side.y; this.tPos[k * 3 + 2] = e.p.z + side.z;
      this.tPos[k * 3 + 3] = e.p.x - side.x; this.tPos[k * 3 + 4] = e.p.y - side.y; this.tPos[k * 3 + 5] = e.p.z - side.z;
      const age = e.gap ? -1 : now - e.born;
      this.tAge[k] = this.tAge[k + 1] = age;
    }
    this.trailMesh.geometry.attributes.position.needsUpdate = true;
    this.trailMesh.geometry.attributes.aAge.needsUpdate = true;
  }

  get drawingIntensity() { return (this.state === 'draw' || this.state === 'watch' || this.state === 'notice') ? Math.min(1, this.tipSpeed / 8) : 0; }
}
