// The sword in the stone. It notices you (runes and the pommel-eye wake as you approach), and when
// you try to pull it (E) it resists: it trembles, rises a hand's breadth, then slams back with a
// burst of light and sparks. The whole hub reacts: the heart races, the congregation startles, the
// sky-eye opens, the pencil flinches. On the third attempt the stone answers in writing.
import * as THREE from 'three';
import { blobGeometry, sweepGeometry } from '../geometry/sweep.js';
import { merge } from '../geometry/generators.js';
import { organicMaterial, getTextures, U } from '../materials/library.js';
import { conformRing } from '../geometry/surfaces.js';
import { L, hubFloor } from '../world/layout.js';
import { glowSprite } from './heart.js';
import { textTexture } from '../materials/textures.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function swordGeometry() {
  // blade profile (local: blade along +Y, tip at y=0)
  const s = new THREE.Shape();
  const L = 2.6, W = 0.15;
  s.moveTo(0, 0);
  s.quadraticCurveTo(W * 0.9, 0.35, W, 0.9); s.lineTo(W * 0.92, L - 0.25); s.quadraticCurveTo(W * 1.6, L - 0.08, W * 1.1, L);
  s.lineTo(-W * 1.1, L); s.quadraticCurveTo(-W * 1.6, L - 0.08, -W * 0.92, L - 0.25); s.lineTo(-W, 0.9); s.quadraticCurveTo(-W * 0.9, 0.35, 0, 0);
  const blade = new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.05, bevelSegments: 3, curveSegments: 16 });
  blade.translate(0, 0, -0.015);
  blade.computeVertexNormals();
  // crossguard: two curling horns
  const guard = [];
  for (const k of [-1, 1]) {
    const c = new THREE.CatmullRomCurve3([V(0, L + 0.02, 0), V(k * 0.45, L + 0.05, 0), V(k * 0.75, L + 0.2, 0.05), V(k * 0.82, L + 0.42, 0), V(k * 0.65, L + 0.5, -0.03), V(k * 0.58, L + 0.38, 0)]);
    guard.push(sweepGeometry(c, { tubular: 40, radial: 8, radius: (t) => 0.075 * (1 - t * 0.6) + 0.03 * Math.exp(-t * 6), capEnd: true }));
  }
  const gb = blobGeometry(0.16, { detail: 3, noise: 0.15, squash: [1.3, 0.8, 0.9] }); gb.translate(0, L + 0.04, 0); guard.push(gb);
  // grip: twisted cords
  const grip = [];
  for (let k = 0; k < 3; k++) {
    const pts = []; for (let i = 0; i <= 40; i++) { const t = i / 40; const a = t * Math.PI * 8 + k * 2.09; pts.push(V(Math.cos(a) * 0.05, L + 0.1 + t * 0.62, Math.sin(a) * 0.05)); }
    grip.push(sweepGeometry(new THREE.CatmullRomCurve3(pts), { tubular: 80, radial: 6, radius: () => 0.035 }));
  }
  const core = new THREE.CylinderGeometry(0.05, 0.05, 0.62, 8); core.translate(0, L + 0.41, 0); grip.push(core);
  return { blade, guard: merge(guard), grip: merge(grip), length: L };
}

export class Sword {
  constructor(scene, { mats, ctx, collision }) {
    const T = getTextures();
    this.ctx = ctx;
    const base = L.sword.clone(); base.y = hubFloor(base.x, base.z) ?? 0;
    this.base = base;
    this.group = new THREE.Group(); this.group.position.copy(base); scene.add(this.group);
    // stone: a split boulder with a rune band
    const stoneG = merge([
      (() => { const g = blobGeometry(1.5, { detail: 5, noise: 0.28, noiseScale: 1.3, ridge: 0.1, squash: [1.35, 0.85, 1.15], seed: 8 }); g.translate(0, 0.55, 0); return g; })(),
      (() => { const g = blobGeometry(0.9, { detail: 4, noise: 0.3, noiseScale: 1.8, seed: 9 }); g.translate(1.2, 0.2, 0.7); return g; })(),
      (() => { const g = blobGeometry(0.7, { detail: 4, noise: 0.3, noiseScale: 1.8, seed: 10 }); g.translate(-1.1, 0.15, -0.8); return g; })(),
    ]);
    this.stoneMat = organicMaterial({ color: 0x4a4744, color2: 0x1a1918, veinColor: 0x7fe6ff, veinAmount: 0.1, veinScale: 1.4, breath: 0, roughness: 0.82, rim: 0.25, rimColor: 0x1a2a30, colorScale: 0.5 });
    const stone = new THREE.Mesh(stoneG, this.stoneMat); stone.castShadow = true; stone.receiveShadow = true; this.group.add(stone);
    // standing menhirs with carved glyph faces
    const men = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3, r = 4.4;
      const g = new THREE.BoxGeometry(0.7, 2.2 + (i % 3) * 0.6, 0.45, 4, 10, 2);
      const pa = g.attributes.position; const v = new THREE.Vector3();
      for (let k = 0; k < pa.count; k++) { v.fromBufferAttribute(pa, k); const f = 1 - Math.max(0, v.y) * 0.12; pa.setXYZ(k, v.x * f + Math.sin(v.y * 3 + i) * 0.05, v.y, v.z * f); }
      g.computeVertexNormals();
      g.rotateZ((Math.random() - 0.5) * 0.25); g.rotateY(-a + Math.PI / 2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      g.translate(x, (hubFloor(base.x + x, base.z + z) ?? 0) - base.y + 0.8, z);
      men.push(g);
      collision.addObstacle({ x: base.x + x, z: base.z + z, r: 0.55 });
    }
    this.menMat = organicMaterial({ color: 0x3a3836, color2: 0x141312, veinColor: 0x7fe6ff, veinAmount: 0.25, veinScale: 2.5, breath: 0, roughness: 0.9, emissive: 0xffffff, emissiveMap: T.runes, emissiveIntensity: 0.0, colorScale: 0.4 });
    const menMesh = new THREE.Mesh(merge(men), this.menMat); menMesh.castShadow = true; menMesh.receiveShadow = true; this.group.add(menMesh);
    // rune ring on the ground
    this.ringMat = new THREE.MeshBasicMaterial({ map: T.runes, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0x000000 });
    const ring = new THREE.Mesh(conformRing({ cx: 0, cz: 0, r0: 2.4, r1: 3.1, height: (x, z) => (hubFloor(base.x + x, base.z + z) ?? 0) - base.y, uRepeat: 2 }), this.ringMat);
    ring.renderOrder = 3; this.group.add(ring);
    // sword
    const sg = swordGeometry();
    this.swordG = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 1.0, roughness: 0.22, envMapIntensity: 1.6 });
    this.edgeMat = metal;
    metal.onBeforeCompile = (sh) => {
      sh.uniforms.uGlow = this.glowU = { value: 0 }; sh.uniforms.uTime = U.time;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP; uniform float uGlow; uniform float uTime;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float fuller = smoothstep(0.035, 0.0, abs(vLP.x)) * step(0.4, vLP.y) * step(vLP.y, 2.45);
          float glyph = step(0.5, fract(vLP.y * 6.0 + sin(vLP.y * 20.0) * 0.2)) * fuller;
          totalEmissiveRadiance += vec3(0.4, 0.9, 1.0) * (fuller * 0.3 + glyph * 0.9) * uGlow * (0.8 + 0.2 * sin(uTime * 9.0 + vLP.y * 4.0));`);
    };
    const blade = new THREE.Mesh(sg.blade, metal); blade.castShadow = true;
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.2 });
    const guard = new THREE.Mesh(sg.guard, guardMat); guard.castShadow = true;
    const grip = new THREE.Mesh(sg.grip, organicMaterial({ color: 0x2a1a14, color2: 0x0a0604, veinAmount: 0.2, breath: 0, roughness: 0.7, normalScale: 0.4 }));
    // pommel eye
    const pommel = new THREE.Group(); pommel.position.y = sg.length + 0.82;
    const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), new THREE.MeshStandardMaterial({ map: T.sclera, roughness: 0.15 }));
    const iris = new THREE.Mesh(new THREE.CircleGeometry(0.08, 20), new THREE.MeshStandardMaterial({ map: T.iris, emissive: 0xffffff, emissiveMap: T.iris, emissiveIntensity: 0.4, roughness: 0.1 }));
    iris.position.z = 0.125; eyeBall.add(iris);
    this.pommelLid = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), guardMat); this.pommelLid.rotation.x = 1.45;
    const pommelCage = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 8, 24), guardMat);
    pommel.add(eyeBall, this.pommelLid, pommelCage); this.eyeBall = eyeBall;
    this.swordG.add(blade, guard, grip, pommel);
    this.swordG.position.set(0, 1.25 - sg.length * 0.55, 0);
    this.swordG.rotation.set(0.08, 0.6, -0.1);
    this.restY = this.swordG.position.y;
    this.group.add(this.swordG);
    collision.addObstacle({ x: base.x, z: base.z, r: 2.0 });
    // lights & fx
    this.light = new THREE.PointLight(0x9fe8ff, 0, 18, 2); this.light.position.set(0, 2.2, 0); this.group.add(this.light);
    this.halo = glowSprite(0x9fe8ff, 3.5, 0); this.halo.position.set(0, 1.8, 0); this.group.add(this.halo);
    this.sparks = this.makeSparks(); this.group.add(this.sparks.points);
    this.inscriptionMat = null;
    this.prox = 0; this.attempts = 0; this.anim = -1; this.burst = 0;
  }

  makeSparks() {
    const n = 320;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aLife; varying float vL; void main(){ vL = aLife; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_Position = projectionMatrix*mv; gl_PointSize = (2.0 + aLife*5.0) * (30.0 / max(1.0,-mv.z)); }`,
      fragmentShader: `varying float vL; void main(){ if (vL <= 0.0) discard; float r = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,r); gl_FragColor = vec4(vec3(0.6,0.95,1.0)*a*vL*2.0 + vec3(1.0,0.7,0.3)*a*vL*vL, 1.0); }` });
    const points = new THREE.Points(g, m); points.frustumCulled = false;
    return { points, pos, vel, life, n };
  }

  emitSparks(count) {
    const s = this.sparks;
    for (let i = 0, k = 0; i < s.n && k < count; i++) {
      if (s.life[i] > 0) continue; k++;
      s.pos[i * 3] = (Math.random() - 0.5) * 0.4; s.pos[i * 3 + 1] = 1.2 + Math.random() * 0.4; s.pos[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 6;
      s.vel[i * 3] = Math.cos(a) * sp; s.vel[i * 3 + 1] = 2 + Math.random() * 6; s.vel[i * 3 + 2] = Math.sin(a) * sp;
      s.life[i] = 1;
    }
  }

  setInscription(mesh) { this.inscription = mesh; }

  get near() { return this.prox > 0.5; }

  interact() {
    if (this.anim >= 0) return false;
    this.anim = 0; this.attempts++;
    this.ctx.audio?.swordStrain(this.attempts);
    return true;
  }

  update(dt, t, playerPos) {
    const d = playerPos ? Math.hypot(playerPos.x - this.base.x, playerPos.z - this.base.z) : 99;
    const prox = THREE.MathUtils.clamp((7.5 - d) / 4.5, 0, 1);
    this.prox += (prox - this.prox) * Math.min(1, dt * 2);
    const glow = this.prox * 0.7 + this.burst * 2;
    this.glowU && (this.glowU.value = glow);
    const ringK = 0.15 + this.prox * 0.8 + this.burst * 2;
    this.ringMat.color.setRGB(0.5 * ringK, 0.85 * ringK, 0.95 * ringK);
    this.menMat.emissiveIntensity = 0.03 + this.prox * 0.12 + this.burst * 0.35;
    this.menMat.emissive.setRGB(0.5, 0.9, 1.0);
    this.stoneMat.userData.klUniforms.uVeinAmt.value = 0.1 + this.prox * 0.6 + this.burst * 4;
    this.light.intensity = 4 + this.prox * 30 + this.burst * this.burst * 260;
    this.halo.material.opacity = this.prox * 0.08 + this.burst * this.burst * 0.3;
    this.pommelLid.rotation.x += ((this.prox > 0.3 ? -1.6 : 1.45) - this.pommelLid.rotation.x) * Math.min(1, dt * 3);
    if (playerPos) { const lp = playerPos.clone().setY(playerPos.y + 1.6); this.eyeBall.lookAt(lp); }
    // the pull
    if (this.anim >= 0) {
      this.anim += dt; const a = this.anim;
      const strain = Math.min(1, a / 1.2);
      const tremble = (a < 1.6 ? strain : Math.max(0, 1 - (a - 1.6) * 3)) * 0.03;
      this.swordG.position.x = (Math.random() - 0.5) * tremble; this.swordG.position.z = (Math.random() - 0.5) * tremble;
      const rise = a < 1.4 ? strain * 0.22 * Math.min(1, 0.6 + this.attempts * 0.2) : Math.max(0, 0.22 - (a - 1.4) * 4);
      this.swordG.position.y = this.restY + rise;
      if (a > 1.45 && this.burst === 0 && !this.slammed) {
        this.slammed = true; this.burst = 1; this.emitSparks(220);
        this.ctx.onSwordBurst?.(this.attempts);
      }
      if (a > 3.2) { this.anim = -1; this.slammed = false; this.swordG.position.set(0, this.restY, 0); }
    }
    this.burst = Math.max(0, this.burst - dt * 0.9);
    // sparks
    const s = this.sparks;
    for (let i = 0; i < s.n; i++) {
      if (s.life[i] <= 0) continue;
      s.vel[i * 3 + 1] -= 9.8 * dt;
      s.pos[i * 3] += s.vel[i * 3] * dt; s.pos[i * 3 + 1] += s.vel[i * 3 + 1] * dt; s.pos[i * 3 + 2] += s.vel[i * 3 + 2] * dt;
      if (s.pos[i * 3 + 1] < 0) { s.pos[i * 3 + 1] = 0; s.vel[i * 3 + 1] *= -0.3; s.vel[i * 3] *= 0.6; s.vel[i * 3 + 2] *= 0.6; }
      s.life[i] -= dt * 0.7;
    }
    s.points.geometry.attributes.position.needsUpdate = true; s.points.geometry.attributes.aLife.needsUpdate = true;
  }
}
