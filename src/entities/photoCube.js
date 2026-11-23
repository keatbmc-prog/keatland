// The photo cube: a 3x3x3 twisty puzzle that hangs in the air and scrambles itself. Its stickers are
// Keaten's photos (one photo per face when solved, a mosaic of slices when scrambled) and the faces
// slowly wipe over to new photos. It works on its own rhythm: calm single turns, frantic bursts, and
// now and then it unwinds its own history back to "solved" for a moment before starting again.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { organicMaterial } from '../materials/library.js';

const AX = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
// face: [uAxis, vAxis, normal] (right-handed, u x v = n)
const FACES = [
  [[0, 0, -1], [0, 1, 0], [1, 0, 0]], [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  [[1, 0, 0], [0, 0, -1], [0, 1, 0]], [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
].map((f) => f.map((a) => new THREE.Vector3(...a)));

const easeInOutBack = (x) => { const c1 = 1.70158 * 0.9, c2 = c1 * 1.525; return x < 0.5 ? (Math.pow(2 * x, 2) * ((c2 + 1) * 2 * x - c2)) / 2 : (Math.pow(2 * x - 2, 2) * ((c2 + 1) * (x * 2 - 2) + c2) + 2) / 2; };
const ease = (t) => t * t * (3 - 2 * t);

function roundedSquare(size, r, seg = 5) {
  const h = size / 2, s = new THREE.Shape();
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return new THREE.ShapeGeometry(s, seg);
}

/** A lit photo material that can wipe from one photo (map) to another (uMap2). */
export function stickerMaterial(tex) {
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.0, envMapIntensity: 1.1 });
  m.userData.u = { uMap2: { value: tex }, uMix: { value: 0 }, uGlow: { value: 0.3 }, uPulse: { value: 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.fragmentShader = 'uniform sampler2D uMap2; uniform float uMix; uniform float uGlow; uniform float uPulse;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', /* glsl */`
        vec3 kPhoto = vec3(0.0);
        #ifdef USE_MAP
          vec4 kA = texture2D(map, vMapUv); vec4 kB = texture2D(uMap2, vMapUv);
          float kW = clamp(uMix * 1.5 - (1.0 - vMapUv.y) * 0.5, 0.0, 1.0);
          float kEdge = smoothstep(0.0, 0.06, kW) * (1.0 - smoothstep(0.06, 0.2, kW));
          vec4 sampledDiffuseColor = mix(kA, kB, smoothstep(0.0, 1.0, kW));
          // a little aged: lift the blacks toward bone, pull saturation down a touch
          float kL = dot(sampledDiffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          sampledDiffuseColor.rgb = mix(vec3(kL), sampledDiffuseColor.rgb, 0.82) * vec3(1.02, 0.98, 0.92) + vec3(0.012, 0.008, 0.006);
          diffuseColor *= sampledDiffuseColor;
          kPhoto = sampledDiffuseColor.rgb + kEdge * vec3(0.9, 0.55, 0.3);
        #endif`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += kPhoto * (uGlow + uPulse);');
  };
  m.customProgramCacheKey = () => 'kl-sticker';
  return m;
}

export class PhotoCube {
  /**
   * @param photos  [{ square: Texture }]
   * @param opts    { size: cubie edge (m), gap, bodyMat, seed }
   */
  constructor(photos, { size = 0.9, gap = 0.05, bodyMat = null, seed = 1, tempo = 1 } = {}) {
    this.photos = photos; this.size = size; this.step = size + gap; this.tempo = tempo;
    this.group = new THREE.Group(); this.group.name = 'photo-cube';
    this.float = new THREE.Group(); this.group.add(this.float);
    this.core = new THREE.Group(); this.float.add(this.core);
    this.pivot = new THREE.Group(); this.core.add(this.pivot);
    let s = seed >>> 0; this.rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    this.bodyMat = bodyMat || organicMaterial({ color: 0x17120f, color2: 0x050404, veinColor: 0xffa860, veinAmount: 0.35, veinScale: 3.0, breath: 0, roughness: 0.28, metalness: 0.35, rim: 0.6, rimColor: 0x5a3a2a, normalMap: null });
    this.faceMats = FACES.map((_, f) => stickerMaterial(photos[f % photos.length].square));
    this.facePhoto = FACES.map((_, f) => f % photos.length);
    this.nextPhoto = 6 % photos.length;
    const body = new RoundedBoxGeometry(size, size, size, 3, size * 0.14);
    const st = roundedSquare(size * 0.84, size * 0.12);
    this.cubies = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      if (!i && !j && !k) continue;
      const c = new THREE.Group();
      const p = new THREE.Vector3(i, j, k);
      c.position.copy(p).multiplyScalar(this.step); c.userData.p = p.clone();
      const b = new THREE.Mesh(body, this.bodyMat); b.castShadow = true; b.receiveShadow = true; c.add(b);
      FACES.forEach(([ua, va, n], f) => {
        if (p.dot(n) !== 1) return;
        const col = p.dot(ua), row = p.dot(va);
        const g = st.clone();
        const pos = g.attributes.position, uv = g.attributes.uv;
        for (let q = 0; q < pos.count; q++) {
          const x = pos.getX(q), y = pos.getY(q);
          uv.setXY(q, (col + 1.5 + x / size) / 3, (row + 1.5 + y / size) / 3);
        }
        const basis = new THREE.Matrix4().makeBasis(ua, va, n);
        g.applyMatrix4(basis); g.translate(n.x * (size / 2 + 0.004), n.y * (size / 2 + 0.004), n.z * (size / 2 + 0.004));
        const sm = new THREE.Mesh(g, this.faceMats[f]); sm.userData.face = f; sm.userData.center = !col && !row;
        c.add(sm);
      });
      this.core.add(c); this.cubies.push(c);
    }
    this.history = [];
    this.move = null; this.wait = 1.5; this.mode = 'calm'; this.modeT = 0; this.burstLeft = 0;
    this.photoT = 4; this.wipes = [];
    this.frozen = false; this.spin = new THREE.Vector3(0.11, 0.17, 0.07);
    this.twisting = 0; // 0..1 energy, for glow and sound
    this.onTwist = null;
  }

  /** Begin a layer turn. axis 0..2, layer -1..1, dir +-1 */
  turn(axis, layer, dir, dur) {
    const members = this.cubies.filter((c) => Math.round(c.userData.p.getComponent(axis)) === layer);
    this.pivot.rotation.set(0, 0, 0); this.pivot.updateMatrixWorld();
    members.forEach((c) => this.pivot.attach(c));
    this.move = { axis, layer, dir, dur, t: 0, members };
    this.onTwist?.(dur);
  }

  _finishMove() {
    const m = this.move;
    this.pivot.rotation.set(0, 0, 0); this.pivot.rotation[['x', 'y', 'z'][m.axis]] = m.dir * Math.PI / 2;
    this.pivot.updateMatrixWorld();
    for (const c of m.members) {
      this.core.attach(c);
      const p = c.position.clone().divideScalar(this.step).round();
      c.userData.p.copy(p); c.position.copy(p).multiplyScalar(this.step);
      // snap rotation to the nearest right angle
      const e = new THREE.Matrix4().makeRotationFromQuaternion(c.quaternion).elements;
      for (let i = 0; i < 16; i++) e[i] = Math.round(e[i]);
      c.quaternion.setFromRotationMatrix(new THREE.Matrix4().fromArray(e));
    }
    this.pivot.rotation.set(0, 0, 0);
    this.move = null;
  }

  _choose() {
    const r = this.rand;
    this.modeT -= 1;
    if (this.mode === 'unwind') {
      const last = this.history.pop();
      if (!last) { this.mode = 'hold'; this.wait = 3.5; this._cycleAll(); return; }
      this.turn(last[0], last[1], -last[2], 0.16 / this.tempo); this.wait = 0.02;
      return;
    }
    if (this.mode === 'hold') { this.mode = 'calm'; this.modeT = 6 + r() * 6; }
    if (this.modeT <= 0) {
      const x = r();
      if (this.history.length > 10 && x < 0.18) { this.mode = 'unwind'; this._choose(); return; }
      if (x < 0.55) { this.mode = 'burst'; this.modeT = 5 + Math.floor(r() * 9); } else { this.mode = 'calm'; this.modeT = 3 + Math.floor(r() * 5); }
    }
    const axis = Math.floor(r() * 3), layer = Math.floor(r() * 3) - 1, dir = r() < 0.5 ? -1 : 1;
    // avoid undoing the previous move immediately
    const prev = this.history[this.history.length - 1];
    if (prev && prev[0] === axis && prev[1] === layer && prev[2] === -dir) { this.wait = 0.05; return; }
    this.history.push([axis, layer, dir]);
    if (this.history.length > 60) this.history.shift();
    if (this.mode === 'burst') { this.turn(axis, layer, dir, (0.2 + r() * 0.12) / this.tempo); this.wait = r() < 0.2 ? 0.35 : 0.03; }
    else { this.turn(axis, layer, dir, (0.6 + r() * 0.5) / this.tempo); this.wait = (0.8 + r() * 2.4) / this.tempo; }
  }

  _wipe(f, photoIndex, dur = 1.6) {
    const mat = this.faceMats[f];
    mat.userData.u.uMap2.value = this.photos[photoIndex].square;
    this.wipes.push({ f, idx: photoIndex, t: 0, dur });
  }
  _cycleAll() { for (let f = 0; f < 6; f++) { this._wipe(f, this.nextPhoto, 1.2 + f * 0.15); this.nextPhoto = (this.nextPhoto + 1) % this.photos.length; } }

  /** World-space info about the center sticker of the face that looks most toward a point. */
  faceToward(point) {
    const c = this.group.getWorldPosition(new THREE.Vector3());
    const dir = point.clone().sub(c).normalize();
    let best = null;
    for (const cb of this.cubies) {
      for (const m of cb.children) {
        if (!m.userData.center) continue;
        const n = FACES[m.userData.face][2].clone().transformDirection(cb.matrixWorld);
        const d = n.dot(dir);
        if (!best || d > best.d) best = { d, n, face: m.userData.face, photo: this.facePhoto[m.userData.face] };
      }
    }
    return { center: c, normal: best.n, face: best.face, photo: best.photo, half: this.step * 1.5 * this.group.scale.x };
  }

  update(dt, t) {
    // float and tumble
    if (!this.frozen) {
      this.float.position.y = Math.sin(t * 0.7) * 0.12;
      this.float.rotation.x += dt * this.spin.x * (1 + this.twisting * 2);
      this.float.rotation.y += dt * this.spin.y * (1 + this.twisting * 2);
      this.float.rotation.z = Math.sin(t * 0.23) * 0.3;
      if (this.move) {
        const m = this.move; m.t += dt;
        const u = Math.min(1, m.t / m.dur);
        this.pivot.rotation.set(0, 0, 0);
        this.pivot.rotation[['x', 'y', 'z'][m.axis]] = m.dir * Math.PI / 2 * easeInOutBack(u);
        if (u >= 1) this._finishMove();
      } else if ((this.wait -= dt) <= 0) this._choose();
    }
    const target = this.move ? (this.mode === 'burst' || this.mode === 'unwind' ? 1 : 0.5) : 0;
    this.twisting += (target - this.twisting) * Math.min(1, dt * 4);
    // photo cycling
    if ((this.photoT -= dt) <= 0 && this.mode !== 'unwind') {
      this.photoT = 4 + this.rand() * 4;
      const busy = new Set(this.wipes.map((w) => w.f));
      const f = [0, 1, 2, 3, 4, 5].filter((x) => !busy.has(x))[Math.floor(this.rand() * (6 - busy.size))];
      if (f !== undefined) { this._wipe(f, this.nextPhoto); this.nextPhoto = (this.nextPhoto + 1) % this.photos.length; }
    }
    for (const w of this.wipes) {
      w.t += dt; const u = this.faceMats[w.f].userData.u;
      u.uMix.value = Math.min(1, w.t / w.dur);
      if (w.t >= w.dur) { this.faceMats[w.f].map = this.photos[w.idx].square; u.uMix.value = 0; this.facePhoto[w.f] = w.idx; w.done = true; }
    }
    this.wipes = this.wipes.filter((w) => !w.done);
    for (const m of this.faceMats) m.userData.u.uPulse.value = this.twisting * 0.12;
  }
}
