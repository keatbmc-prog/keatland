// Foliage kit for the jungle (and the leaf portal): canvas-painted alpha-cut leaves, bent leaf
// geometry, and one instanced leaf material that sways in the wind, parts around the player and
// shakes where something unseen is moving (up to 4 "rustle" sources fed by the stalker).
import * as THREE from 'three';
import { U } from '../materials/library.js';
import { mulberry32 } from '../core/noise.js';

/** Shared uniforms: the player's feet and the rustle sources (xyz + strength). */
export const FOLIAGE = {
  uPlayer: { value: new THREE.Vector3(1e5, 0, 0) },
  uRustle: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(1e5, 0, 0, 0)) },
  uWind: { value: 1 },
};

// ---------------------------------------------------------------- painted leaves
function paintLeaf(kind, seed, emissive = false) {
  const W = 256, H = 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rng = mulberry32(seed);
  const cx = W / 2;
  // outline: base at bottom (y = H), tip at top (y = 0)
  const outline = new Path2D();
  if (kind === 'frond') {
    // a fern frond: many narrow leaflets off a midrib
    const n = 18;
    for (let i = 0; i < n; i++) {
      const y = H - 20 - (i / n) * (H - 40), len = (W * 0.46) * Math.sin(((i + 1) / (n + 1)) * Math.PI) * (0.85 + rng() * 0.2);
      for (const s of [-1, 1]) {
        outline.moveTo(cx, y); outline.quadraticCurveTo(cx + s * len * 0.5, y - 18, cx + s * len, y - 26 - rng() * 10);
        outline.quadraticCurveTo(cx + s * len * 0.55, y + 4, cx, y + 10);
      }
    }
    outline.rect(cx - 3, 10, 6, H - 10);
  } else {
    const wMax = kind === 'monstera' ? W * 0.48 : W * 0.36;
    outline.moveTo(cx, H - 6);
    const pts = 40;
    const side = (s) => { for (let i = 0; i <= pts; i++) { const t = i / pts; const y = H - 6 - t * (H - 14); const w = wMax * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9) * (1 + 0.04 * Math.sin(t * 40 * (1 + rng() * 0.1))); outline.lineTo(cx + s * w, y); } };
    side(1); for (let i = pts; i >= 0; i--) { const t = i / pts; const y = H - 6 - t * (H - 14); const w = wMax * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.8)), 0.9); outline.lineTo(cx - w, y); }
    outline.closePath();
  }
  g.save(); g.clip(outline);
  if (!emissive) {
    // body: deep green-black with a lighter midrib zone and mottling
    const gr = g.createLinearGradient(0, H, 0, 0);
    gr.addColorStop(0, '#112216'); gr.addColorStop(0.5, '#244628'); gr.addColorStop(1, '#3a5a2a');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '60,90,40' : '5,15,8'},${0.05 + rng() * 0.08})`; g.beginPath(); g.ellipse(rng() * W, rng() * H, 4 + rng() * 20, 3 + rng() * 14, rng() * 3, 0, 7); g.fill(); }
  } else { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); }
  // veins
  g.strokeStyle = emissive ? 'rgba(120,255,190,0.38)' : 'rgba(150,190,110,0.45)'; g.lineCap = 'round';
  g.lineWidth = kind === 'frond' ? 3 : 5; g.beginPath(); g.moveTo(cx, H); g.lineTo(cx, 8); g.stroke();
  if (kind !== 'frond') {
    g.lineWidth = 2;
    for (let i = 0; i < 14; i++) { const y = H - 30 - i * ((H - 60) / 14); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, y); g.quadraticCurveTo(cx + s * 40, y - 20, cx + s * W * 0.42, y - 60 - rng() * 20); g.stroke(); } }
  }
  // Keatland: a few leaves carry an eye-spot (they are eyelids, a little)
  if (kind === 'broad' && seed % 3 === 0) {
    const y = H * 0.45;
    g.fillStyle = emissive ? 'rgba(255,200,90,0.3)' : 'rgba(200,170,90,0.55)'; g.beginPath(); g.ellipse(cx + 26, y, 26, 16, -0.3, 0, 7); g.fill();
    g.fillStyle = emissive ? 'rgba(0,0,0,1)' : 'rgba(10,8,4,0.9)'; g.beginPath(); g.ellipse(cx + 26, y, 9, 13, -0.3, 0, 7); g.fill();
  }
  g.restore();
  // monstera: tear fenestrations (holes) out of the alpha
  if (kind === 'monstera') {
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 9; i++) {
      const y = H - 80 - i * 42;
      for (const s of [-1, 1]) {
        g.beginPath(); const x0 = cx + s * (30 + rng() * 20), x1 = cx + s * (W * 0.5);
        g.moveTo(x0, y); g.quadraticCurveTo((x0 + x1) / 2, y - 22, x1, y - 40 - rng() * 10); g.lineTo(x1, y - 26); g.quadraticCurveTo((x0 + x1) / 2, y - 6, x0, y + 6); g.fill();
        if (rng() < 0.6) { g.beginPath(); g.ellipse(cx + s * (22 + rng() * 10), y - 8, 6, 10, 0, 0, 7); g.fill(); }
      }
    }
    g.globalCompositeOperation = 'source-over';
  }
  // chewed edges
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(rng() < 0.5 ? cx - W * 0.35 : cx + W * 0.35, 60 + rng() * (H - 120), 6 + rng() * 14, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

let _tex = null;
export function leafTextures() {
  if (_tex) return _tex;
  _tex = {
    broad: paintLeaf('broad', 3), broadE: paintLeaf('broad', 3, true),
    monstera: paintLeaf('monstera', 5), monsteraE: paintLeaf('monstera', 5, true),
    frond: paintLeaf('frond', 7), frondE: paintLeaf('frond', 7, true),
  };
  return _tex;
}

/** A leaf blade: base at the origin, growing +Y, curved (droop) and cupped. */
export function leafGeometry({ w = 0.6, h = 1.4, droop = 0.35, cup = 0.25 } = {}) {
  const g = new THREE.PlaneGeometry(w, h, 4, 10);
  g.translate(0, h / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), t = y / h;
    p.setZ(i, droop * t * t * h + cup * (x / w) * (x / w) * w * 2);
    p.setY(i, y - droop * 0.4 * t * t * t * h);
  }
  g.computeVertexNormals();
  return g;
}

/** Instanced leaf material (lit) with sway, player push and rustle shake. */
export function foliageMaterial({ map, emissiveMap, color = 0xffffff, emissive = 0x2a8a5a, emissiveIntensity = 0.35, push = 1, sway = 1 }) {
  const m = new THREE.MeshStandardMaterial({ map, color, emissive, emissiveMap, emissiveIntensity, roughness: 0.55, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide, envMapIntensity: 0.4 });
  const local = { uPush: { value: push }, uSway: { value: sway } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, FOLIAGE, local, { uTime: U.time });
    sh.vertexShader = /* glsl */`
      uniform vec3 uPlayer; uniform vec4 uRustle[4]; uniform float uWind; uniform float uPush; uniform float uSway; uniform float uTime;
      varying float vTip;
    ` + sh.vertexShader.replace('#include <project_vertex>', /* glsl */`
      vec4 kWp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        kWp = instanceMatrix * kWp;
        vec3 kSeed = instanceMatrix[3].xyz;
      #else
        vec3 kSeed = vec3(0.0);
      #endif
      kWp = modelMatrix * kWp;
      float kTip = clamp(uv.y, 0.0, 1.0); vTip = kTip;
      vec3 kOff = vec3(0.0);
      // wind: slow heave + flutter, phase from instance position
      float ph = dot(kSeed, vec3(0.37, 0.11, 0.53));
      kOff.x += sin(uTime * 0.7 + ph) * 0.08 * kTip * uSway * uWind;
      kOff.z += cos(uTime * 0.53 + ph * 1.3) * 0.06 * kTip * uSway * uWind;
      kOff.y += sin(uTime * 3.1 + ph * 5.0 + kWp.x * 2.0) * 0.015 * kTip * uSway;
      // the player parts the leaves (body-height band only)
      vec2 d = kWp.xz - uPlayer.xz; float dist = length(d);
      float band = smoothstep(-0.4, 0.3, kWp.y - uPlayer.y) * (1.0 - smoothstep(2.0, 2.9, kWp.y - uPlayer.y));
      float pushK = (1.0 - smoothstep(0.35, 1.9, dist)) * band * uPush;
      kOff.xz += normalize(d + 1e-4) * pushK * (0.25 + 0.95 * kTip);
      kOff.y += pushK * 0.25 * kTip;
      // rustle: something moving nearby makes the leaves shiver
      for (int i = 0; i < 4; i++) {
        float s = uRustle[i].w * (1.0 - smoothstep(0.4, 3.2, distance(kWp.xyz, uRustle[i].xyz)));
        kOff += vec3(sin(uTime * 23.0 + kWp.y * 7.0 + ph), 0.4 * sin(uTime * 17.0 + ph * 3.0), cos(uTime * 19.0 + kWp.x * 6.0)) * 0.11 * s * (0.2 + kTip);
      }
      kWp.xyz += kOff;
      vec4 mvPosition = viewMatrix * kWp;
      gl_Position = projectionMatrix * mvPosition;`);
    sh.fragmentShader = 'varying float vTip;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance *= 0.6 + 0.4 * sin(vTip * 9.0 - uTimeF * 1.3);')
      .replace('void main() {', 'uniform float uTimeF;\nvoid main() {');
    sh.uniforms.uTimeF = U.time;
  };
  m.customProgramCacheKey = () => 'kl-foliage';
  return m;
}

/** Leaves that stream past the camera during the portal transitions. */
export class LeafSwarm {
  constructor(scene, count = 260) {
    const T = leafTextures();
    this.mesh = new THREE.InstancedMesh(leafGeometry({ w: 0.5, h: 1.1, droop: 0.2, cup: 0.3 }), foliageMaterial({ map: T.monstera, emissiveMap: T.monsteraE, push: 0, sway: 0.4 }), count);
    this.mesh.frustumCulled = false; this.mesh.visible = false; this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    const rng = mulberry32(17);
    this.p = [];
    for (let i = 0; i < count; i++) this.p.push({ a: rng() * 6.283, r: 0.15 + Math.pow(rng(), 0.7) * 2.2, z: -rng() * 7, rot: new THREE.Euler(rng() * 6.3, rng() * 6.3, rng() * 6.3), s: 0.6 + rng() * 1.2, k: rng() });
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._s = new THREE.Vector3();
  }
  /** density 0..1 (how many/large), speed in m/s toward the camera. */
  update(dt, camera, density, speed = 4) {
    this.mesh.visible = density > 0.01;
    if (!this.mesh.visible) return;
    camera.updateMatrixWorld();
    for (let i = 0; i < this.p.length; i++) {
      const L = this.p[i];
      L.z += speed * dt; if (L.z > 0.4) { L.z = -7; }
      L.rot.x += dt * 0.6; L.rot.z += dt * 0.4;
      const show = L.k < density ? Math.min(1, (density - L.k) * 4) : 0;
      const r = L.r * (1.2 - density * 0.8);
      this._v.set(Math.cos(L.a) * r, Math.sin(L.a) * r, L.z).applyMatrix4(camera.matrixWorld);
      this._q.setFromEuler(L.rot).premultiply(camera.quaternion);
      this._s.setScalar(L.s * show + 1e-4);
      this.mesh.setMatrixAt(i, this._m.compose(this._v, this._q, this._s));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
