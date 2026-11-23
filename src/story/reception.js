// Keatland Reception. A low stucco building with a big dusty lobby window onto the lot. Inside:
// the reception counter with the stickers, lanyards, business cards and the Human Pretzel magnet on
// the mini-fridge, the polished dorodango (now Evidence) on its stand, the catalytic converter, and
// the Humane Realizations "office": a cardboard box with a CEO plaque, a broken chair, and Keaten
// in a mop-head wig. Walk up to the box and the plaque turns, the chair collapses, the trees say
// "groooowth...", and the door you came in by is no longer there. The only way on is the
// fluorescent corridor beyond the wrecked chair.
import * as THREE from 'three';
import { S, SL, FLOOR } from './layout.js';
import { V, std, box, cyl, tiledBox } from './kit.js';
import { stuccoTexture, vinylTexture, ceilingTexture, cardboardTexture, woodTexture, signTexture, signPlane, rngOf } from './paint.js';
import { canvasTexture } from '../materials/textures.js';
import { Figure, catalyticConverter, mug } from './figures.js';
import { SUN_DIR } from './sky.js';
import { SIGNS } from '../data/storyLines.js';
import { U } from '../materials/library.js';
import { GLSL_NOISE } from '../core/noise.js';

/** A sunbeam through a window: the parallelepiped swept from the window rectangle along the light. */
function sunbeam(x0, x1, y0, y1, z, floorY, strength = 0.06) {
  const L = SUN_DIR.clone().negate();
  const t = (y) => (y - floorY) / -L.y; // distance along L to reach the floor from height y
  const c = [V(x0, y0, z), V(x1, y0, z), V(x1, y1, z), V(x0, y1, z)];
  const f = c.map((p) => p.clone().addScaledVector(L, t(p.y)));
  const pos = [], uvs = [];
  const quad = (a, b, cc, d, va, vb) => { pos.push(...a.toArray(), ...b.toArray(), ...cc.toArray(), ...a.toArray(), ...cc.toArray(), ...d.toArray()); uvs.push(0, va, 1, va, 1, vb, 0, va, 1, vb, 0, vb); };
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(c[i], c[j], f[j], f[i], 0, 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.computeVertexNormals();
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uTime: U.time, uI: { value: strength } },
    vertexShader: 'varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `varying vec2 vUv; varying vec3 vW; varying vec3 vN; varying vec3 vV; uniform float uTime; uniform float uI;
      ${GLSL_NOISE}
      void main(){ float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.6);
        float along = smoothstep(0.0, 0.15, vUv.y) * (1.0 - 0.5 * vUv.y);
        float dust = 0.6 + 0.4 * kl_snoise(vW * 0.9 + vec3(uTime * 0.05, -uTime * 0.03, 0.0));
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.62) * uI * along * dust * (0.4 + edge), 1.0); }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 6; return mesh;
}

/** Dust motes hanging in the warm air of a room. */
export function dustMotes(count, box3, color = 0xffe2b0, size = 1) {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) { pos[i * 3] = THREE.MathUtils.lerp(box3.min.x, box3.max.x, Math.random()); pos[i * 3 + 1] = THREE.MathUtils.lerp(box3.min.y, box3.max.y, Math.random()); pos[i * 3 + 2] = THREE.MathUtils.lerp(box3.min.z, box3.max.z, Math.random()); seed[i] = Math.random(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.time, uC: { value: new THREE.Color(color) }, uS: { value: size } },
    vertexShader: `attribute float aSeed; uniform float uTime; uniform float uS; varying float vA;
      void main(){ vec3 p = position; float t = uTime * (0.05 + aSeed * 0.05);
        p += vec3(sin(t * 3.1 + aSeed * 40.0), sin(t * 2.3 + aSeed * 17.0) * 0.6, cos(t * 2.7 + aSeed * 23.0)) * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = uS * (1.0 + aSeed * 2.0) * (18.0 / max(0.5, -mv.z));
        vA = (0.4 + 0.6 * sin(uTime * (0.5 + aSeed) + aSeed * 60.0)) * smoothstep(12.0, 1.0, -mv.z); }`,
    fragmentShader: 'uniform vec3 uC; varying float vA; void main(){ float r = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, r); gl_FragColor = vec4(uC * a * vA * 0.5, 1.0); }',
  });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}

export function buildReception({ root, collision, quality, voiceTrees }) {
  const rng = rngOf(301);
  const W = (x, z) => ({ x: S.x + x, z: S.z + z });
  const wall = (x1, z1, x2, z2, r = 0.16) => { const a = W(x1, z1), b = W(x2, z2); return collision.addWall({ x1: a.x, z1: a.z, x2: b.x, z2: b.z, r }); };
  const obstacle = (x, z, r) => { const w = W(x, z); return collision.addObstacle({ x: w.x, z: w.z, r }); };
  const g = new THREE.Group(); g.name = 'reception'; root.add(g);

  const stucco = stuccoTexture(51, '#d8c4a0'); stucco.repeat.set(1, 1);
  const ext = std({ map: stucco, roughness: 0.95 });
  const paintTex = stuccoTexture(52, '#e9dcc4');
  const paint = std({ map: paintTex, roughness: 0.9, color: 0xfff0dc });
  const T = 0.3, H = SL.rH, y0 = 0;
  const { rx0, rx1, rz0, rz1 } = SL;
  // wall piece helper: faces [px, nx, py, ny, pz, nz]
  const piece = (xa, xb, ya, yb, za, zb, faces) => { const m = tiledBox(xb - xa, yb - ya, zb - za, faces, 2.5); m.position.set((xa + xb) / 2, (ya + yb) / 2, (za + zb) / 2); g.add(m); return m; };
  const F_front = [ext, ext, ext, paint, ext, paint], F_back = [ext, ext, ext, paint, paint, ext], F_west = [paint, ext, ext, paint, ext, ext], F_east = [ext, paint, ext, paint, ext, ext];
  // front wall (z = rz1) with the lobby window, the door and a second window
  const zf0 = rz1 - T / 2, zf1 = rz1 + T / 2;
  const [w1a, w1b] = SL.window1, [da, db] = SL.door, [w2a, w2b] = SL.window2;
  piece(rx0, w1a, y0, H, zf0, zf1, F_front); piece(w1b, da, y0, H, zf0, zf1, F_front); piece(db, w2a, y0, H, zf0, zf1, F_front); piece(w2b, rx1, y0, H, zf0, zf1, F_front);
  piece(w1a, w1b, y0, 0.85, zf0, zf1, F_front); piece(w1a, w1b, 3.2, H, zf0, zf1, F_front);
  piece(w2a, w2b, y0, 1.0, zf0, zf1, F_front); piece(w2a, w2b, 2.9, H, zf0, zf1, F_front);
  piece(da, db, 2.75, H, zf0, zf1, F_front);
  // sides + back (with the corridor opening)
  piece(rx0 - T / 2, rx0 + T / 2, y0, H, rz0, rz1, F_west); piece(rx1 - T / 2, rx1 + T / 2, y0, H, rz0, rz1, F_east);
  const [ca, cb] = SL.corridor, zb0 = rz0 - T / 2, zb1 = rz0 + T / 2;
  piece(rx0, ca, y0, H, zb0, zb1, F_back); piece(cb, rx1, y0, H, zb0, zb1, F_back); piece(ca, cb, 2.95, H, zb0, zb1, F_back);
  // roof, parapet, coping
  const roof = tiledBox(rx1 - rx0 + 0.8, 0.35, rz1 - rz0 + 0.8, ext, 3); roof.position.set(0, H + 0.17, (rz0 + rz1) / 2); g.add(roof);
  for (const [x, z, w, d] of [[0, rz1 + 0.3, rx1 - rx0 + 0.8, 0.2], [0, rz0 - 0.3, rx1 - rx0 + 0.8, 0.2], [rx0 - 0.3, (rz0 + rz1) / 2, 0.2, rz1 - rz0 + 0.8], [rx1 + 0.3, (rz0 + rz1) / 2, 0.2, rz1 - rz0 + 0.8]]) { const p = tiledBox(w, 0.7, d, ext, 3); p.position.set(x, H + 0.6, z); g.add(p); }
  // floor slab + interior floor + drop ceiling
  const floorTex = vinylTexture(); floorTex.repeat.set(1, 1);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(rx1 - rx0, rz1 - rz0), std({ map: floorTex, roughness: 0.55, color: 0xf2dcb4 }));
  { const uv = fl.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (rx1 - rx0) / 2.4, uv.getY(i) * (rz1 - rz0) / 2.4); }
  fl.rotation.x = -Math.PI / 2; fl.position.set(0, FLOOR, (rz0 + rz1) / 2); fl.receiveShadow = true; g.add(fl);
  const slab = box(rx1 - rx0, FLOOR, rz1 - rz0, ext, 0, FLOOR / 2 - 0.005, (rz0 + rz1) / 2, { parent: g, cast: false });
  const ceilTex = ceilingTexture(); 
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(rx1 - rx0, rz1 - rz0), std({ map: ceilTex, roughness: 0.95 }));
  { const uv = ceil.geometry.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (rx1 - rx0) / 0.6, uv.getY(i) * (rz1 - rz0) / 0.6); }
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, FLOOR + SL.ceil, (rz0 + rz1) / 2); ceil.receiveShadow = true; g.add(ceil);
  const panelMat = std({ color: 0xfffbea, emissive: 0xfff3d0, emissiveIntensity: 1.0, roughness: 0.4 });
  const panelOff = std({ color: 0xd8d2bc, emissive: 0x000000, roughness: 0.5 });
  const fixtures = [];
  for (const x of [-12, -6, 0, 6, 12]) for (const z of [-18, -24, -30]) {
    const off = (x === 12 && z === -18) || (x === -6 && z === -30);
    const p = box(0.6, 0.04, 1.2, off ? panelOff : panelMat, x, FLOOR + SL.ceil - 0.02, z, { parent: g, cast: false });
    if (!off) fixtures.push(V(x, FLOOR + SL.ceil - 0.05, z));
  }
  // collision walls: front (door gap), sides, back (corridor gap)
  wall(rx0, rz1, da, rz1); wall(db, rz1, rx1, rz1); wall(rx0, rz0, rx0, rz1); wall(rx1, rz0, rx1, rz1); wall(rx0, rz0, ca, rz0); wall(cb, rz0, rx1, rz0);
  const doorWall = wall(da, rz1, db, rz1); doorWall.off = true;
  collision.addGround((x, z) => { const lx = x - S.x, lz = z - S.z; return lx > rx0 && lx < rx1 && lz > rz0 - 0.2 && lz < rz1 + 0.2 ? S.y + FLOOR : null; });

  // ---------------------------------------------------------------- glass, door, facade signs, awning
  const grime = canvasTexture(512, 256, (c, w, h) => { const r = rngOf(17); c.fillStyle = 'rgba(200,190,170,0.08)'; c.fillRect(0, 0, w, h); for (let i = 0; i < 500; i++) { c.fillStyle = `rgba(${150 + r() * 60},${130 + r() * 50},${100 + r() * 40},${r() * 0.12})`; c.beginPath(); c.ellipse(r() * w, h * (0.5 + r() * 0.5), 5 + r() * 40, 3 + r() * 15, 0, 0, 7); c.fill(); } const gr = c.createLinearGradient(0, h, 0, h * 0.6); gr.addColorStop(0, 'rgba(170,140,100,0.35)'); gr.addColorStop(1, 'rgba(170,140,100,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }, { wrap: false });
  const glass = new THREE.MeshStandardMaterial({ color: 0xaab8b0, map: grime, transparent: true, opacity: 0.32, roughness: 0.06, metalness: 0.0, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
  const frame = std({ color: 0x8c8a84, metalness: 0.7, roughness: 0.35 });
  const pane = (xa, xb, ya, yb) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(xb - xa, yb - ya), glass); p.position.set((xa + xb) / 2, (ya + yb) / 2, rz1); p.renderOrder = 3; g.add(p);
    for (let x = xa; x <= xb + 0.01; x += (xb - xa) / Math.max(1, Math.round((xb - xa) / 2.8))) box(0.07, yb - ya, 0.12, frame, x, (ya + yb) / 2, rz1, { parent: g });
    box(xb - xa, 0.07, 0.12, frame, (xa + xb) / 2, ya, rz1, { parent: g }); box(xb - xa, 0.07, 0.12, frame, (xa + xb) / 2, yb, rz1, { parent: g });
  };
  pane(w1a, w1b, 0.85, 3.2); pane(w2a, w2b, 1.0, 2.9);
  // the entrance: an aluminium frame with one glass door stuck open; when the room seals, drywall
  const doorG = new THREE.Group(); g.add(doorG);
  box(0.08, 2.75, 0.14, frame, da + 0.04, 1.375, rz1, { parent: doorG }); box(0.08, 2.75, 0.14, frame, db - 0.04, 1.375, rz1, { parent: doorG }); box(db - da, 0.1, 0.14, frame, (da + db) / 2, 2.7, rz1, { parent: doorG });
  const leaf = new THREE.Group(); leaf.position.set(da + 0.08, 0, rz1); leaf.rotation.y = -1.25; doorG.add(leaf);
  const lp = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.5), glass); lp.position.set(0.55, 1.3, 0); leaf.add(lp);
  box(1.1, 0.08, 0.05, frame, 0.55, 0.08, 0, { parent: leaf }); box(1.1, 0.08, 0.05, frame, 0.55, 2.55, 0, { parent: leaf }); box(0.05, 2.5, 0.05, frame, 1.08, 1.3, 0, { parent: leaf }); box(0.04, 0.4, 0.06, frame, 0.95, 1.1, 0.05, { parent: leaf });
  const seal = piece(da, db, y0, 2.75, zf0, zf1, F_front); seal.visible = false;
  // fascia sign
  const fascia = box(20, 1.25, 0.12, std({ color: 0x8a2a20, roughness: 0.6, metalness: 0.3 }), -3, 4.15, rz1 + 0.2, { parent: g });
  const recSign = signPlane(signTexture([SIGNS.reception], { w: 2048, h: 128, bg: '#efe3c4', fg: '#a3261c', font: 'Rye', weather: 0.9, seed: 31, pad: 0.06 }), 19.4, 1.05);
  recSign.position.set(-3, 4.15, rz1 + 0.265); g.add(recSign);
  const svc = signPlane(signTexture(SIGNS.facadeServices, { w: 512, h: 1024, bg: '#efe3c4', fg: '#3a2a1a', font: 'Oswald', weight: '600', weather: 0.8, seed: 33, border: 12, pad: 0.12 }), 1.2, 2.4);
  svc.position.set(14.6, 2.4, rz1 + 0.17); g.add(svc);
  const awn = box(3.6, 0.12, 1.6, std({ color: 0x7a2a22, roughness: 0.8 }), (da + db) / 2, 3.0, rz1 + 0.85, { parent: g }); awn.rotation.x = 0.12;
  for (const s of [-1, 1]) cyl(0.04, 0.04, 3, frame, (da + db) / 2 + s * 1.7, 1.5, rz1 + 1.55, { parent: g, seg: 8 });
  obstacle((da + db) / 2 - 1.7, rz1 + 1.55, 0.12); obstacle((da + db) / 2 + 1.7, rz1 + 1.55, 0.12);

  // ---------------------------------------------------------------- the reception counter and its merch
  const woodLight = std({ map: woodTexture(61, '#b8925e'), roughness: 0.45 });
  const lam = std({ map: woodTexture(62, '#7c5a3a'), roughness: 0.7 });
  const C = SL.counter;
  box(8.4, 1.0, 0.7, lam, C.x, FLOOR + 0.5, C.z, { parent: g }); box(8.7, 0.05, 0.85, woodLight, C.x, FLOOR + 1.03, C.z, { parent: g });
  box(0.7, 1.0, 3.0, lam, C.x - 4.55, FLOOR + 0.5, C.z - 1.15, { parent: g }); box(0.85, 0.05, 3.2, woodLight, C.x - 4.55, FLOOR + 1.03, C.z - 1.2, { parent: g });
  wall(C.x - 4.2, C.z, C.x + 4.2, C.z, 0.4); wall(C.x - 4.55, C.z, C.x - 4.55, C.z - 2.6, 0.4);
  const front = signPlane(signTexture([SIGNS.lanyard, SIGNS.stickers], { w: 1024, h: 256, bg: '#7c5a3a', fg: '#e9d9b0', font: 'Oswald', weight: '600', weather: 0.5, seed: 64, sizes: [1, 0.7], transparent: true }), 4.0, 1.0, { transparent: true });
  front.position.set(C.x, FLOOR + 0.55, C.z + 0.355); g.add(front);
  const topY = FLOOR + 1.056;
  // sticker sheets
  const stickerTex = canvasTexture(512, 512, (c, w, h) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); const r = rngOf(70); for (let i = 0; i < 6; i++) { const x = 90 + (i % 2) * 330 - 10, y = 90 + Math.floor(i / 2) * 165; c.fillStyle = ['#a3261c', '#1d2a44', '#d49a2a'][i % 3]; c.beginPath(); c.ellipse(x + 70, y, 150, 70, 0, 0, 7); c.fill(); c.fillStyle = '#f4f1ea'; c.font = '600 40px Oswald'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('WE FUCK', x + 70, y - 20); c.fillText('THINGS UP', x + 70, y + 24); } for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(120,110,90,${r() * 0.1})`; c.fillRect(r() * w, r() * h, 2, 2); } }, { wrap: false });
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.34), std({ map: stickerTex, roughness: 0.5 })); s.rotation.x = -Math.PI / 2; s.rotation.z = (rng() - 0.5) * 0.5; s.position.set(C.x - 2.6 + i * 0.12, topY + i * 0.002, C.z + 0.05 + i * 0.03); g.add(s); }
  // lanyard rack
  { const rack = new THREE.Group(); rack.position.set(C.x - 1.4, topY, C.z - 0.1); g.add(rack);
    box(0.5, 0.02, 0.15, frame, 0, 0.01, 0, { parent: rack }); cyl(0.01, 0.01, 0.42, frame, -0.22, 0.21, 0, { parent: rack, seg: 6 }); cyl(0.01, 0.01, 0.42, frame, 0.22, 0.21, 0, { parent: rack, seg: 6 }); const bar = cyl(0.008, 0.008, 0.46, frame, 0, 0.42, 0, { parent: rack, seg: 6 }); bar.rotation.z = Math.PI / 2;
    const ly = canvasTexture(64, 512, (c, w, h) => { c.fillStyle = '#a3261c'; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.rotate(Math.PI / 2); c.fillStyle = '#f2e6c8'; c.font = '600 30px Oswald'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('KEATLAND OPERATIONS', 0, 0); c.restore(); }, { wrap: false });
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.36), std({ map: ly, side: THREE.DoubleSide })); s.position.set(-0.18 + i * 0.07, 0.24, 0.012); rack.add(s); const tag = box(0.05, 0.07, 0.003, std({ color: 0xf2efe6 }), -0.18 + i * 0.07, 0.06, 0.014, { parent: rack }); }
  }
  // business cards: HEAD OF MANAGED RISKS
  { const holder = box(0.12, 0.04, 0.08, std({ color: 0x222222, metalness: 0.6, roughness: 0.4 }), C.x - 0.4, topY + 0.02, C.z + 0.1, { parent: g });
    const card = signPlane(signTexture(SIGNS.businessCard, { w: 512, h: 300, bg: '#f7f3ea', fg: '#1d2a44', font: 'Oswald', weight: '600', sizes: [1.1, 0.9, 0.55], weather: 0.1, seed: 71 }), 0.09, 0.055); card.position.set(C.x - 0.4, topY + 0.05, C.z + 0.12); card.rotation.x = -0.5; g.add(card);
    const loose = card.clone(); loose.position.set(C.x - 0.15, topY + 0.002, C.z + 0.2); loose.rotation.set(-Math.PI / 2, 0, 0.4); g.add(loose); }
  // validation tent card
  { const tex = signTexture(SIGNS.validate, { w: 768, h: 512, bg: '#fbf7ec', fg: '#2a2a2a', font: 'Caveat', weight: '700', sizes: [1.2, 0.55], weather: 0.15, seed: 72, valign: 'middle' });
    for (const s of [1, -1]) { const p = signPlane(tex, 0.3, 0.2); p.position.set(C.x + 0.6, topY + 0.095, C.z + 0.1 + s * 0.03); p.rotation.x = s * -0.3; if (s < 0) p.rotation.y = Math.PI; g.add(p); } }
  // desk phone (hold music comes out of it)
  const phonePos = V(C.x + 1.6, topY + 0.06, C.z - 0.05);
  { box(0.22, 0.07, 0.2, std({ color: 0x1e1e1e, roughness: 0.4 }), phonePos.x, phonePos.y - 0.02, phonePos.z, { parent: g }); const hs = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.16, 4, 8), std({ color: 0x1e1e1e, roughness: 0.4 })); hs.rotation.z = Math.PI / 2; hs.position.set(phonePos.x, phonePos.y + 0.04, phonePos.z - 0.05); g.add(hs); const led = box(0.015, 0.01, 0.01, std({ color: 0x220000, emissive: 0xff3020, emissiveIntensity: 2 }), phonePos.x + 0.08, phonePos.y + 0.02, phonePos.z + 0.08, { parent: g }); }
  // the dorodango on its stand, with its appraisal (amended)
  const doro = new THREE.Mesh(new THREE.SphereGeometry(0.075, 48, 32), new THREE.MeshPhysicalMaterial({ color: 0x5a3a22, roughness: 0.12, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4 }));
  doro.position.set(C.x + 3.2, topY + 0.13, C.z + 0.05); doro.castShadow = true; g.add(doro);
  cyl(0.06, 0.08, 0.05, woodLight, C.x + 3.2, topY + 0.025, C.z + 0.05, { parent: g, seg: 20 });
  const appraisal = signPlane(signTexture(SIGNS.dorodango, { w: 1024, h: 560, bg: '#f4efe2', fg: '#1d1d1d', font: 'Special Elite', sizes: [1, 1, 1, 0.85, 0.85], weather: 0.2, seed: 73, align: 'left', border: 8 }), 0.34, 0.19);
  appraisal.position.set(C.x + 3.2, topY + 0.1, C.z + 0.33); appraisal.rotation.x = -0.35; g.add(appraisal);
  // the catalytic converter (lighter than it should be)
  const conv = catalyticConverter(); conv.position.set(C.x - 3.4, topY + 0.07, C.z + 0.05); conv.rotation.y = 0.3; g.add(conv);
  const tag = signPlane(signTexture(SIGNS.converterTag, { w: 256, h: 256, bg: '#f6e27a', fg: '#2a2a50', font: 'Caveat', weight: '700', weather: 0.2, seed: 74 }), 0.09, 0.09); tag.position.set(C.x - 3.25, topY + 0.13, C.z + 0.13); tag.rotation.set(-0.4, 0.3, 0.1); g.add(tag);
  // behind the counter: mini-fridge with the Human Pretzel magnet, a stool, the banner
  { const fx = C.x + 2.5, fz = C.z - 1.5;
    box(0.55, 0.85, 0.55, std({ color: 0xece6d8, roughness: 0.35, metalness: 0.1 }), fx, FLOOR + 0.425, fz, { parent: g }); box(0.02, 0.3, 0.03, frame, fx + 0.2, FLOOR + 0.55, fz + 0.29, { parent: g });
    const pretzel = new THREE.Mesh(new THREE.TorusKnotGeometry(0.035, 0.012, 64, 8, 2, 3), std({ color: 0xd9a47e, roughness: 0.5 })); pretzel.position.set(fx - 0.08, FLOOR + 0.66, fz + 0.29); pretzel.scale.z = 0.4; g.add(pretzel);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), std({ color: 0xd9a47e })); head.position.set(fx - 0.08, FLOOR + 0.725, fz + 0.29); g.add(head);
    const lbl = signPlane(signTexture([SIGNS.pretzel], { w: 256, h: 64, bg: '#a3261c', fg: '#fff', font: 'Oswald', weight: '600', weather: 0.1, seed: 75 }), 0.1, 0.025); lbl.position.set(fx - 0.08, FLOOR + 0.6, fz + 0.282); g.add(lbl);
    obstacle(fx, fz, 0.4);
    cyl(0.18, 0.18, 0.05, std({ color: 0x3a2a1a }), C.x - 1, FLOOR + 0.7, C.z - 0.9, { parent: g }); cyl(0.02, 0.02, 0.7, frame, C.x - 1, FLOOR + 0.35, C.z - 0.9, { parent: g, seg: 6 });
  }
  const bannerTex = signTexture(SIGNS.banner, { w: 2048, h: 320, bg: '#f2e6c8', fg: '#a3261c', font: 'Rye', sizes: [0.8, 1.15], weather: 0.5, seed: 76, border: 10 });
  const banner = signPlane(bannerTex, 6.6, 1.03, { side: THREE.DoubleSide }); banner.position.set(C.x, FLOOR + 2.45, C.z - 0.9); g.add(banner);
  for (const s of [-1, 1]) cyl(0.004, 0.004, 0.55, frame, C.x + s * 3.2, FLOOR + 3.0, C.z - 0.9, { parent: g, seg: 4 });

  // ---------------------------------------------------------------- the Humane Realizations office
  const Hd = SL.hrDesk;
  const card = std({ map: cardboardTexture(), roughness: 0.95 });
  const desk = box(1.35, 0.82, 0.82, card, Hd.x, FLOOR + 0.41, Hd.z, { parent: g });
  const flap = box(1.35, 0.02, 0.35, card, Hd.x, FLOOR + 0.8, Hd.z + 0.55, { parent: g }); flap.rotation.x = 0.55;
  obstacle(Hd.x - 0.35, Hd.z, 0.5); obstacle(Hd.x + 0.35, Hd.z, 0.5);
  const hrSign = signPlane(signTexture(SIGNS.hrBox, { w: 768, h: 512, bg: '#e9dfc6', fg: '#2a2219', font: 'Caveat', weight: '700', sizes: [1.6, 0.85, 0.65], weather: 0.3, seed: 81 }), 0.72, 0.48);
  hrSign.position.set(Hd.x - 0.15, FLOOR + 0.42, Hd.z + 0.415); g.add(hrSign);
  const feel = signPlane(signTexture(SIGNS.feelings, { w: 256, h: 256, bg: '#f4a6b8', fg: '#2a1a20', font: 'Caveat', weight: '700', weather: 0.2, seed: 82 }), 0.16, 0.16); feel.position.set(Hd.x + 0.45, FLOOR + 0.52, Hd.z + 0.416); feel.rotation.z = 0.08; g.add(feel);
  // the plaque: CEO on one side, HUMANE REALIZATIONS on the other
  const plaque = new THREE.Group(); plaque.position.set(Hd.x - 0.2, FLOOR + 0.84, Hd.z + 0.15); g.add(plaque);
  box(0.44, 0.1, 0.07, std({ map: woodTexture(83, '#4a2e18'), roughness: 0.5 }), 0, 0.05, 0, { parent: plaque });
  const brass = (lines, seed) => signTexture(lines, { w: 512, h: 128, bg: '#b8913e', fg: '#2a1a08', font: 'Oswald', weight: '600', weather: 0.15, seed, border: 6, borderColor: '#5a4010' });
  const pf = signPlane(brass([SIGNS.plaqueFront], 84), 0.4, 0.08, { metalness: 0.6, roughness: 0.35 }); pf.position.set(0, 0.05, 0.036); plaque.add(pf);
  const pb = signPlane(brass([SIGNS.plaqueBack], 85), 0.4, 0.08, { metalness: 0.6, roughness: 0.35 }); pb.position.set(0, 0.05, -0.036); pb.rotation.y = Math.PI; plaque.add(pb);
  const hrMug = mug(signTexture(['HR'], { w: 256, h: 128, bg: '#f0ebe0', fg: '#2a2a2a', font: 'Rye', weather: 0.1, seed: 86 })); hrMug.position.set(Hd.x + 0.42, FLOOR + 0.87, Hd.z + 0.05); g.add(hrMug);
  for (let i = 0; i < 6; i++) box(0.3, 0.012, 0.22, std({ color: 0xf2eee4 }), Hd.x + 0.1 + (rng() - 0.5) * 0.04, FLOOR + 0.83 + i * 0.012, Hd.z - 0.15, { parent: g });
  { const bell = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xd8d0c0, metalness: 0.9, roughness: 0.2 })); bell.position.set(Hd.x - 0.5, FLOOR + 0.83, Hd.z - 0.05); g.add(bell); }
  // the broken chair (pieces so it can collapse)
  const chair = new THREE.Group(); chair.position.set(Hd.x, FLOOR, Hd.z - 0.95); g.add(chair);
  const uph = std({ color: 0x2a2a2e, roughness: 0.9 }), torn = std({ color: 0xc9b48a, roughness: 1 });
  const parts = {
    seat: box(0.5, 0.08, 0.48, uph, 0, 0.48, 0, { parent: chair }),
    back: box(0.48, 0.55, 0.07, uph, 0, 0.82, -0.24, { parent: chair }),
    post: cyl(0.025, 0.025, 0.4, frame, 0, 0.25, 0, { parent: chair, seg: 8 }),
  };
  const foam = box(0.2, 0.03, 0.15, torn, 0.1, 0.53, 0.08, { parent: chair });
  parts.legs = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const l = box(0.28, 0.03, 0.04, frame, Math.cos(a) * 0.14, 0.06, Math.sin(a) * 0.14, { parent: chair }); l.rotation.y = -a; parts.legs.push(l); }
  const chairHome = new Map(); chair.traverse((o) => { if (o.isMesh) chairHome.set(o, { p: o.position.clone(), r: o.rotation.clone() }); });
  const keaten = new Figure('keatenHR', { seed: 11 });
  keaten.group.position.set(Hd.x, FLOOR, Hd.z - 0.95); keaten.pose = 'sit';
  const kMug = mug(signTexture(['HR'], { w: 256, h: 128, bg: '#f0ebe0', fg: '#2a2a2a', font: 'Rye', weather: 0.1, seed: 87 })); keaten.hold(kMug, 'R', V(0, -0.1, 0.06));
  g.add(keaten.group);
  const keatenObs = obstacle(Hd.x, Hd.z - 0.95, 0.4);
  // complaints box + the mop
  { const cb2 = box(0.6, 0.45, 0.45, card, Hd.x + 1.4, FLOOR + 0.225, Hd.z - 0.2, { parent: g }); const lab = signPlane(signTexture([SIGNS.complaints], { w: 512, h: 128, bg: '#e9dfc6', fg: '#2a2219', font: 'Caveat', weight: '700', weather: 0.2, seed: 88 }), 0.5, 0.12); lab.position.set(Hd.x + 1.4, FLOOR + 0.25, Hd.z + 0.03); g.add(lab);
    const mopPole = cyl(0.014, 0.014, 1.5, std({ color: 0xb02a2a }), Hd.x + 1.85, FLOOR + 0.75, Hd.z - 0.1, { parent: g, seg: 6 }); mopPole.rotation.z = 0.25;
    const mopHead = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.25, 12, 1, true), std({ color: 0xe2d6b8, roughness: 1, side: THREE.DoubleSide })); mopHead.position.set(Hd.x + 2.03, FLOOR + 0.12, Hd.z - 0.1); g.add(mopHead);
    obstacle(Hd.x + 1.45, Hd.z - 0.2, 0.4); }
  // the career ladder sign hanging from the ceiling
  { const lad = signPlane(signTexture(SIGNS.careerLadder, { w: 512, h: 1280, bg: '#efe6d0', fg: '#2a2219', font: 'Oswald', weight: '600', weather: 0.5, seed: 89, border: 10 }), 0.75, 1.9, { side: THREE.DoubleSide }); lad.position.set(Hd.x - 2.4, FLOOR + 1.95, Hd.z - 0.6); lad.rotation.y = 0.2; g.add(lad);
    for (const s of [-1, 1]) cyl(0.004, 0.004, 0.25, frame, Hd.x - 2.4 + s * 0.33, FLOOR + 3.0, Hd.z - 0.6, { parent: g, seg: 4 }); }
  // posters, the facilities map, the waiting area
  const poster = (lines, x, y, z, ry, w, h, o = {}) => { const p = signPlane(signTexture(lines, { w: 768, h: Math.round(768 * h / w), weather: 0.5, seed: Math.round(x * 7 + z * 3), ...o }), w, h); p.position.set(x, y, z); p.rotation.y = ry; g.add(p); const fr = box(w + 0.06, h + 0.06, 0.02, std({ color: 0x2a2219, roughness: 0.6 }), x, y, z, { parent: g, cast: false }); fr.rotation.y = ry; fr.position.addScaledVector(V(Math.sin(ry), 0, Math.cos(ry)), -0.012); return p; };
  poster(SIGNS.hrPoster, 1.6, FLOOR + 1.7, rz0 + 0.16, 0, 1.3, 0.95, { bg: '#f2e6c8', fg: '#3a2a1a', font: 'Oswald', weight: '500', sizes: [1.4, 0.8, 0.8, 0.8] });
  poster(SIGNS.errorPoster, -6, FLOOR + 1.7, rz0 + 0.16, 0, 1.3, 1.0, { bg: '#1d2a44', fg: '#efe3c4', font: 'Oswald', weight: '500', sizes: [1.4, 0.75, 0.75, 0.75, 0.75] });
  poster(SIGNS.pretzelPoster, rx0 + 0.16, FLOOR + 1.7, -28, Math.PI / 2, 1.3, 1.0, { bg: '#d49a2a', fg: '#2a1a0a', font: 'Oswald', weight: '500', sizes: [1.4, 0.75, 0.75, 0.7] });
  poster(SIGNS.specsPoster, rx0 + 0.16, FLOOR + 1.8, -18.5, Math.PI / 2, 1.5, 0.6, { bg: '#efe6d0', fg: '#a3261c', font: 'Oswald', weight: '700' });
  poster(SIGNS.metaphor, rx1 - 0.16, FLOOR + 1.7, -24, -Math.PI / 2, 1.2, 0.55, { bg: '#f4efe2', fg: '#2a2a2a', font: 'Special Elite' });
  poster(SIGNS.map, cb + 1.1, FLOOR + 1.55, rz0 + 0.16, 0, 0.85, 1.15, { bg: '#e8eef0', fg: '#1d2a44', font: 'Oswald', weight: '500', sizes: [1, 0.7, 1.1, 0.6, 0.7, 1.3, 0.55], border: 8, borderColor: '#a3261c' });
  // waiting chairs + a table of Keatland Motors brochures facing the window
  { const seatM = std({ color: 0x5a3a2a, roughness: 0.7 });
    for (let i = 0; i < 3; i++) { const x = -10.5 + i * 0.7, z = -16.2; box(0.6, 0.06, 0.55, seatM, x, FLOOR + 0.45, z, { parent: g }); box(0.6, 0.5, 0.06, seatM, x, FLOOR + 0.72, z - 0.25, { parent: g }); for (const s of [-1, 1]) box(0.04, 0.45, 0.5, frame, x + s * 0.28, FLOOR + 0.22, z, { parent: g }); }
    obstacle(-9.8, -16.2, 1.0);
    box(0.8, 0.45, 0.5, woodLight, -7.6, FLOOR + 0.225, -16.0, { parent: g });
    const bro = signPlane(signTexture(['2026 KEATLAND MOTORS', 'PRE-OWNED · PRE-JACKED · POST-CATALYTIC'], { w: 512, h: 360, bg: '#a3261c', fg: '#f2e6c8', font: 'Oswald', weight: '600', sizes: [1, 0.45], weather: 0.3, seed: 91 }), 0.21, 0.15);
    for (let i = 0; i < 3; i++) { const b = bro.clone(); b.rotation.set(-Math.PI / 2, 0, (rng() - 0.5) * 0.6); b.position.set(-7.7 + i * 0.1, FLOOR + 0.452 + i * 0.002, -16 + (rng() - 0.5) * 0.1); g.add(b); }
    obstacle(-7.6, -16.0, 0.4);
    // a dead plant
    cyl(0.18, 0.14, 0.4, std({ color: 0x8a4a2a }), 13.8, FLOOR + 0.2, -15.2, { parent: g }); for (let i = 0; i < 7; i++) { const st = cyl(0.006, 0.006, 0.7, std({ color: 0x6b5a3a }), 13.8 + (rng() - 0.5) * 0.15, FLOOR + 0.7, -15.2 + (rng() - 0.5) * 0.15, { parent: g, seg: 4 }); st.rotation.set((rng() - 0.5) * 0.8, 0, (rng() - 0.5) * 0.8); }
    obstacle(13.8, -15.2, 0.3);
  }
  // puddles (the roof leaks) and a mop bucket
  { const pm = new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.03, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, envMapIntensity: 1.5 });
    for (const [x, z, r] of [[-2.5, -19, 0.9], [9.5, -22.5, 0.6], [-11, -30, 1.1]]) { const p = new THREE.Mesh(new THREE.CircleGeometry(r, 24), pm); p.rotation.x = -Math.PI / 2; p.scale.set(1, 0.6 + rng() * 0.4, 1); p.position.set(x, FLOOR + 0.004, z); p.renderOrder = 2; g.add(p); }
    cyl(0.17, 0.14, 0.32, std({ color: 0xd8a020, roughness: 0.5 }), 10.4, FLOOR + 0.16, -22.2, { parent: g }); obstacle(10.4, -22.2, 0.25); }

  // the queue: chrome stanchions and sagging belts from the door to the counter, a sign on a post
  { const post = std({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.25 }), belt = std({ color: 0x8a2a20, roughness: 0.6 });
    const pts = [[2.4, -16.4], [0.4, -16.6], [-1.6, -17.2], [-3.6, -18.4], [-5.4, -19.4], [2.4, -18.0], [0.4, -18.4], [-1.6, -19.0]];
    for (const [x, z] of pts) { cyl(0.025, 0.025, 0.95, post, x, FLOOR + 0.475, z, { parent: g, seg: 10 }); cyl(0.17, 0.17, 0.03, post, x, FLOOR + 0.015, z, { parent: g, seg: 16 }); obstacle(x, z, 0.12); }
    for (const [i, j] of [[0, 1], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7]]) { const [x1, z1] = pts[i], [x2, z2] = pts[j]; const L = Math.hypot(x2 - x1, z2 - z1); const b = box(L, 0.05, 0.005, belt, (x1 + x2) / 2, FLOOR + 0.86, (z1 + z2) / 2, { parent: g }); b.rotation.y = -Math.atan2(z2 - z1, x2 - x1); }
    const qs = signPlane(signTexture(['PLEASE WAIT', 'TO BE HUMANELY', 'REALIZED'], { w: 512, h: 400, bg: '#f2e6c8', fg: '#3a2a1a', font: 'Oswald', weight: '600', weather: 0.4, seed: 96, border: 8, borderColor: '#8a2a20' }), 0.36, 0.28, { side: THREE.DoubleSide });
    qs.position.set(2.4, FLOOR + 1.12, -16.4); g.add(qs); cyl(0.012, 0.012, 0.3, post, 2.4, FLOOR + 0.98, -16.4, { parent: g, seg: 6 }); }
  // a water cooler (empty), a snack machine that only takes exact change, a floor fan, boxes
  { const plast = std({ color: 0xe8e2d4, roughness: 0.5 });
    box(0.36, 1.0, 0.36, plast, 14.9, FLOOR + 0.5, -19, { parent: g }); const jug = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 16), new THREE.MeshStandardMaterial({ color: 0xbcd8e8, roughness: 0.05, transparent: true, opacity: 0.45 })); jug.position.set(14.9, FLOOR + 1.22, -19); g.add(jug); obstacle(14.9, -19, 0.3);
    const vend = new THREE.Group(); vend.position.set(15.35, FLOOR, -26.5); vend.rotation.y = -Math.PI / 2; g.add(vend);
    box(1.0, 1.85, 0.8, std({ color: 0x8a2a20, roughness: 0.5, metalness: 0.3 }), 0, 0.925, 0, { parent: vend });
    box(0.62, 1.2, 0.02, new THREE.MeshStandardMaterial({ color: 0x223038, roughness: 0.05, metalness: 0.4, emissive: 0x302818, emissiveIntensity: 0.6 }), -0.12, 1.15, 0.41, { parent: vend, cast: false });
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) box(0.1, 0.14, 0.08, std({ color: [0xd8a020, 0x2a5a8a, 0xa02a2a, 0x3a7a3a][(r + c) % 4], roughness: 0.6 }), -0.34 + c * 0.15, 0.7 + r * 0.28, 0.33, { parent: vend });
    const vs = signPlane(signTexture(['EXACT CHANGE', 'ONLY', '(NO CHANGE)'], { w: 384, h: 300, bg: '#f2e6c8', fg: '#2a2219', font: 'Caveat', weight: '700', weather: 0.2, seed: 97 }), 0.2, 0.16); vs.position.set(0.33, 1.25, 0.415); vend.add(vs);
    obstacle(15.2, -26.5, 0.65); obstacle(15.2, -26.0, 0.5); obstacle(15.2, -27.0, 0.5);
    const fan = new THREE.Group(); fan.position.set(-14.6, FLOOR, -15.4); fan.rotation.y = 2.4; g.add(fan);
    cyl(0.02, 0.02, 1.2, frame, 0, 0.6, 0, { parent: fan, seg: 6 }); cyl(0.2, 0.22, 0.04, frame, 0, 0.02, 0, { parent: fan }); const cage = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.012, 6, 24), frame); cage.position.y = 1.25; fan.add(cage);
    const blades = new THREE.Group(); blades.position.y = 1.25; fan.add(blades); for (let i = 0; i < 3; i++) { const b = box(0.08, 0.2, 0.01, std({ color: 0x8a9a8a }), 0, 0.1, 0, { parent: blades }); b.position.set(Math.sin(i * 2.09) * 0.1, Math.cos(i * 2.09) * 0.1, 0); b.rotation.z = -i * 2.09; }
    g.userData.fanBlades = blades; obstacle(-14.6, -15.4, 0.3);
    const cb2 = std({ map: cardboardTexture(98), roughness: 0.95 });
    for (const [x, y, z, w, h, d, r] of [[-14.2, 0.3, -32.6, 0.8, 0.6, 0.6, 0.1], [-14.1, 0.85, -32.6, 0.6, 0.5, 0.5, -0.2], [-13.2, 0.25, -32.8, 0.6, 0.5, 0.5, 0.4], [14.6, 0.3, -32.4, 0.8, 0.6, 0.7, -0.15]]) { const b = box(w, h, d, cb2, x, FLOOR + y, z, { parent: g }); b.rotation.y = r; obstacle(x, z, 0.45); }
  }

  // ---------------------------------------------------------------- light: sunbeams + dust, fixtures
  g.add(sunbeam(w1a + 0.2, w1b - 0.2, 0.95, 3.1, rz1, FLOOR, 0.05));
  g.add(sunbeam(w2a + 0.2, w2b - 0.2, 1.1, 2.8, rz1, FLOOR, 0.05));
  g.add(dustMotes(Math.round(500 * quality.detail), new THREE.Box3(V(rx0 + 1, FLOOR + 0.3, rz0 + 1), V(rx1 - 1, FLOOR + 3, rz1 - 0.5))));
  g.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = o.castShadow ?? true; o.receiveShadow = true; } });

  // ---------------------------------------------------------------- the beat at the HR desk
  const st = { phase: 'idle', t: 0, sealed: false, keatenGone: false, walkPath: null };
  const flying = [];
  function collapse() {
    // the chair goes: seat drops, back tips over, legs scatter
    for (const o of [parts.seat, parts.back, parts.post, foam, ...parts.legs]) {
      flying.push({ o, v: V((Math.random() - 0.5) * 1.6, 0.6 + Math.random() * 1.2, (Math.random() - 0.5) * 1.6), w: V((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8), rest: o === parts.back ? 0.04 : 0.02 });
    }
    keaten.pose = 'floor';
  }
  const api = {
    group: g, keaten, fixtures, phonePos, doro, plaque, chair, state: st,
    onCollapse: null, onSeal: null, onPlaque: null,
    get sealed() { return st.sealed; },
    reset() {
      st.phase = 'idle'; st.t = 0; st.sealed = false; st.keatenGone = false; st.walkPath = null;
      plaque.rotation.y = 0; seal.visible = false; doorG.visible = true; doorWall.off = true;
      chairHome.forEach((h, o) => { o.position.copy(h.p); o.rotation.copy(h.r); }); flying.length = 0;
      keaten.group.visible = true; keaten.group.position.set(Hd.x, FLOOR, Hd.z - 0.95); keaten.group.rotation.y = 0; keaten.pose = 'sit'; keatenObs.off = false; keatenObs.x = S.x + Hd.x; keatenObs.z = S.z + Hd.z - 0.95;
    },
    update(dt, t, pl /* player local */, camLocal) {
      if (g.userData.fanBlades) g.userData.fanBlades.rotation.z += dt * 11;
      keaten.update(dt, camLocal.clone().add(S));
      // trigger: walk up to the front of the box
      if (st.phase === 'idle' && Math.abs(pl.x - Hd.x) < 2.6 && pl.z > Hd.z && pl.z < Hd.z + 3.4) { st.phase = 'flip'; st.t = 0; api.onPlaque?.(); }
      if (st.phase === 'idle') return;
      st.t += dt;
      if (st.phase === 'flip') {
        plaque.rotation.y = Math.PI * THREE.MathUtils.smootherstep(st.t / 1.1, 0, 1);
        if (st.t > 3.2) { st.phase = 'collapsed'; st.t = 0; collapse(); api.onCollapse?.(); }
      } else if (st.phase === 'collapsed') {
        if (!st.sealed && st.t > 0.6) { st.sealed = true; seal.visible = true; doorG.visible = false; doorWall.off = false; api.onSeal?.(); }
        if (st.t > 4.5) { keaten.pose = 'stand'; }
        if (st.t > 6.5) { st.phase = 'leaving'; st.t = 0; st.walkPath = [V(Hd.x + 1.6, FLOOR, Hd.z - 1.6), V(9.5, FLOOR, -32.5), V(9.5, FLOOR, -48.4), V(12.5, FLOOR, -48.6), V(12.5, FLOOR, -69.5), V(7.5, FLOOR, -69.5)]; keatenObs.off = true; }
      } else if (st.phase === 'leaving' && st.walkPath) {
        const tgt = st.walkPath[0], p = keaten.group.position;
        const d = V(tgt.x - p.x, 0, tgt.z - p.z), L = d.length();
        keaten.pose = 'walk'; keaten.speed = 1.3;
        if (L < 0.15) { st.walkPath.shift(); if (!st.walkPath.length) { st.phase = 'gone'; keaten.group.visible = false; st.keatenGone = true; } }
        else { d.multiplyScalar(Math.min(L, 1.3 * dt) / L); p.add(d); const yaw = Math.atan2(d.x, d.z); keaten.group.rotation.y += Math.atan2(Math.sin(yaw - keaten.group.rotation.y), Math.cos(yaw - keaten.group.rotation.y)) * Math.min(1, dt * 6); }
      }
      for (const f of flying) {
        if (f.done) continue;
        f.v.y -= 9.8 * dt; f.o.position.addScaledVector(f.v, dt); f.o.rotation.x += f.w.x * dt; f.o.rotation.y += f.w.y * dt; f.o.rotation.z += f.w.z * dt;
        if (f.o.position.y < f.rest) { f.o.position.y = f.rest; f.v.multiplyScalar(0.3); f.v.y = Math.abs(f.v.y) * 0.3; f.w.multiplyScalar(0.4); if (f.v.length() < 0.2) { f.done = true; f.o.rotation.x = Math.round(f.o.rotation.x / (Math.PI / 2)) * Math.PI / 2; f.o.rotation.z = Math.round(f.o.rotation.z / (Math.PI / 2)) * Math.PI / 2; } }
      }
    },
  };
  return api;
}
