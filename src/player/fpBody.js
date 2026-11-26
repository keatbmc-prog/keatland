// The first-person body: a sculpted right hand + forearm in the lower-right of the view, and the rest of
// you (torso, hips, legs, feet, the left arm) below the camera for when you look down. Keaten's colours
// (green open shirt, navy trousers, plum shoes), rounded lathe / capsule / blob forms, no boxes.
//
// Cheap by construction: each half is ONE rigidly skinned mesh (all parts merged, vertex-coloured, one
// toon material), so the whole body is two draw calls on every device.
//  - the hand is parented to the camera and drawn last with a fresh depth buffer, so it never sinks into
//    walls or clips the near plane; it is placed from screen-space anchors, so it sits in the lower right
//    in landscape and tucks in towards the centre in portrait (clear of the touch interact ring).
//  - the body follows the player's feet and yaw, strides with the walk / run cycle, and stays behind the
//    camera's near plane even when you look straight down.
// Motion: idle breathing, walk bob / run swing, a weighty lag when you turn, a reach-and-grab on interact,
// and a clean tuck away during transitions, scripted rides and while seated.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { toonify } from '../story/style/toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const SKIN = new THREE.Color(0xe8a070), SHIRT = new THREE.Color(0x8fb83a), SLEEVE = new THREE.Color(0x7aa830), PANTS = new THREE.Color(0x2e3a6a), SHOE = new THREE.Color(0x3a1428), BELT = new THREE.Color(0x2a1e14), NAIL = new THREE.Color(0xf2c2a0);

/** a part: geometry (already in bind-pose model space), the bone it rides, a colour (or a colour fn of position) */
function rigidSkinned(parts, bones, material) {
  const geos = parts.map(({ geo, bone, color }) => {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count, col = new Float32Array(n * 3), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), p = new THREE.Vector3(), c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      p.fromBufferAttribute(g.attributes.position, i);
      if (typeof color === 'function') color(p, c); else c.copy(color);
      col.set([c.r, c.g, c.b], i * 3); si[i * 4] = bone; sw[i * 4] = 1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    return g;
  });
  const geo = mergeGeometries(geos, false); geos.forEach((g) => g.dispose());
  const mesh = new THREE.SkinnedMesh(geo, material);
  mesh.add(bones[0]); mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.frustumCulled = false; mesh.castShadow = false; mesh.receiveShadow = false;
  return mesh;
}
/** bones from [name, parentIndex, modelSpacePosition]: local positions are derived from the parents */
function makeBones(spec) {
  const bones = [];
  spec.forEach(([name, parent, pos]) => {
    const b = new THREE.Bone(); b.name = name; b.userData.mp = pos.clone();
    if (parent >= 0) { b.position.copy(pos).sub(bones[parent].userData.mp); bones[parent].add(b); } else b.position.copy(pos);
    bones.push(b);
  });
  return bones;
}
/** a tapered, slightly muscled limb between two points (lathe), radius r0 at a, r1 at b */
function limb(a, b, r0, r1, { seg = 12, rings = 8, bulge = 0.08, flat = 1 } = {}) {
  const L = a.distanceTo(b), pts = [];
  pts.push(new THREE.Vector2(0.0005, -r0 * 0.6));
  for (let i = 0; i <= rings; i++) { const t = i / rings; pts.push(new THREE.Vector2(Math.max(0.001, (r0 + (r1 - r0) * t) * (1 + bulge * Math.sin(t * Math.PI))), t * L)); }
  pts.push(new THREE.Vector2(0.0005, L + r1 * 0.6));
  const g = new THREE.LatheGeometry(pts, seg);
  g.scale(1, 1, flat);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q); g.translate(a.x, a.y, a.z); return g;
}
const ball = (p, r, sx = 1, sy = 1, sz = 1, seg = 12) => { const g = new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7 | 0)); g.scale(sx, sy, sz); g.translate(p.x, p.y, p.z); return g; };
function capsuleAlong(a, b, r, seg = 8) {
  const L = a.distanceTo(b), g = new THREE.CapsuleGeometry(r, Math.max(0.001, L), 3, seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()));
  const m = a.clone().add(b).multiplyScalar(0.5); g.translate(m.x, m.y, m.z); return g;
}

function toonSkin() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, emissive: 0x000000 });
  return toonify(m, { rim: 0xffb08a, rimK: 0.22, rimP: 2.6, bands: 3, soft: 0.55, sat: 1.15, shade: 0x5a3a7a, shadeK: 0.35 });
}

// ------------------------------------------------------------------------------------------ the hand
// Arm space: wrist at the origin, fingers towards -Z, the elbow at +Z, palm facing -Y.
const FINGERS = [ // x at the knuckle, lengths of the three phalanges, radius
  { x: -0.026, L: [0.040, 0.026, 0.021], r: 0.0102 }, // index
  { x: -0.0085, L: [0.044, 0.029, 0.022], r: 0.0105 }, // middle
  { x: 0.009, L: [0.041, 0.027, 0.021], r: 0.0100 }, // ring
  { x: 0.025, L: [0.032, 0.021, 0.018], r: 0.0090 }, // pinky
];
function buildHand() {
  const spec = [['elbow', -1, V(0, 0.004, 0.30)], ['wrist', 0, V(0, 0, 0)]];
  const fb = []; // per finger: [knuckle, middle, distal] bone indices
  for (const f of FINGERS) {
    const k = V(f.x, -0.002, -0.084 - Math.abs(f.x + 0.008) * 0.25);
    const m = k.clone().add(V(0, 0, -f.L[0])), d = m.clone().add(V(0, 0, -f.L[1]));
    const i = spec.length; spec.push(['k', 1, k], ['m', i, m], ['d', i + 1, d]); fb.push([i, i + 1, i + 2]);
  }
  const tDir = V(-0.42, -0.34, -0.84).normalize();
  const t0 = V(-0.03, -0.012, -0.022), t1 = t0.clone().addScaledVector(tDir, 0.038), t2 = t1.clone().addScaledVector(tDir, 0.03);
  const ti = spec.length; spec.push(['t0', 1, t0], ['t1', ti, t1], ['t2', ti + 1, t2]);
  const bones = makeBones(spec);
  const parts = [];
  // forearm: tapered, a little flattened, with the shirt sleeve rolled up past the elbow
  parts.push({ geo: limb(V(0, 0, 0.012), V(0, 0.004, 0.33), 0.029, 0.041, { seg: 18, rings: 10, bulge: 0.14, flat: 0.82 }), bone: 0, color: (p, c) => c.copy(SKIN).multiplyScalar(0.96 + p.z * 0.25) });
  const roll = new THREE.TorusGeometry(0.047, 0.016, 10, 22); roll.scale(1, 0.86, 1); roll.translate(0, 0.004, 0.25); parts.push({ geo: roll, bone: 0, color: SLEEVE });
  parts.push({ geo: limb(V(0, 0.004, 0.25), V(0, 0.006, 0.42), 0.05, 0.058, { seg: 16, rings: 4, bulge: 0.05, flat: 0.86 }), bone: 0, color: SHIRT });
  // wrist and the curved palm (domed back of the hand, a fleshy heel and thumb pad)
  parts.push({ geo: ball(V(0, 0, -0.004), 0.03, 1.12, 0.74, 1.6, 14), bone: 1, color: SKIN });
  parts.push({ geo: ball(V(0, 0.002, -0.045), 0.05, 0.96, 0.36, 0.98, 18), bone: 1, color: SKIN });
  parts.push({ geo: ball(V(0.008, -0.01, -0.03), 0.04, 0.95, 0.38, 0.8, 14), bone: 1, color: (p, c) => c.copy(SKIN).multiplyScalar(0.94) });
  parts.push({ geo: ball(V(-0.03, -0.013, -0.028), 0.022, 1.0, 0.75, 1.3, 12), bone: 1, color: SKIN });
  // fingers: tapered phalanges with round knuckles and little nails
  FINGERS.forEach((f, i) => {
    const [kb, mb, db] = fb[i]; const k = bones[kb].userData.mp, m = bones[mb].userData.mp, d = bones[db].userData.mp, tip = d.clone().add(V(0, 0, -f.L[2]));
    parts.push({ geo: ball(k, f.r * 1.22, 1, 0.9, 1, 10), bone: 1, color: (p, c) => c.copy(SKIN).multiplyScalar(1.03) });
    parts.push({ geo: capsuleAlong(k, m, f.r), bone: kb, color: SKIN });
    parts.push({ geo: capsuleAlong(m, d, f.r * 0.93), bone: mb, color: SKIN });
    parts.push({ geo: capsuleAlong(d, tip, f.r * 0.85), bone: db, color: SKIN });
    parts.push({ geo: ball(tip.clone().add(V(0, f.r * 0.55, f.r * 0.6)), f.r * 0.7, 1, 0.35, 1.2, 8), bone: db, color: NAIL });
  });
  parts.push({ geo: capsuleAlong(t0, t1, 0.0125), bone: ti, color: SKIN });
  parts.push({ geo: capsuleAlong(t1, t2, 0.0115), bone: ti + 1, color: SKIN });
  parts.push({ geo: capsuleAlong(t2, t2.clone().addScaledVector(tDir, 0.024), 0.0105), bone: ti + 2, color: SKIN });
  const mat = toonSkin();
  mat.transparent = true; mat.opacity = 1; // drawn after everything else (see FirstPersonBody)
  const mesh = rigidSkinned(parts, bones, mat);
  return { mesh, bones, fb, ti, mat };
}

// ------------------------------------------------------------------------------------------ the body
// Model space: feet at y = 0, facing -Z (the player's forward at yaw 0); the torso sits a little behind
// the camera so looking down shows the chest, belly, belt, legs and shoes, never the inside of you.
function buildBody() {
  const Z = 0.26, LZ = Z - 0.14; // how far behind the eye the spine sits (the legs stand a little forward of it)
  const spec = [
    ['pelvis', -1, V(0, 0.95, Z)], ['spine', 0, V(0, 1.02, Z)],
    ['hipL', 0, V(-0.1, 0.92, LZ)], ['kneeL', 2, V(-0.105, 0.5, LZ - 0.02)], ['ankleL', 3, V(-0.105, 0.09, LZ)],
    ['hipR', 0, V(0.1, 0.92, LZ)], ['kneeR', 5, V(0.105, 0.5, LZ - 0.02)], ['ankleR', 6, V(0.105, 0.09, LZ)],
    ['shL', 1, V(-0.22, 1.33, Z + 0.03)], ['elL', 8, V(-0.24, 1.07, Z + 0.03)],
    ['shR', 1, V(0.22, 1.33, Z + 0.03)], ['elR', 10, V(0.24, 1.07, Z + 0.03)],
  ];
  const bones = makeBones(spec), P = (i) => bones[i].userData.mp;
  const parts = [];
  // torso: a smooth lathe (belly, chest, round shoulders), the open shirt shows a V of skin at the chest
  const prof = new THREE.SplineCurve([[0.155, 0], [0.165, 0.12], [0.158, 0.26], [0.172, 0.38], [0.18, 0.44], [0.13, 0.5], [0.06, 0.52]].map(([r, y]) => new THREE.Vector2(r, y))).getPoints(22);
  prof.unshift(new THREE.Vector2(0.001, 0)); prof.push(new THREE.Vector2(0.001, 0.52));
  const torso = new THREE.LatheGeometry(prof, 28); torso.scale(1.08, 0.95, 0.72); torso.translate(0, 0.92, Z);
  parts.push({ geo: torso, bone: 1, color: (p, c) => { return c.copy(SHIRT).multiplyScalar(0.9 + 0.12 * Math.min(1, (p.y - 0.92) / 0.5)); } });
  parts.push({ geo: (() => { const g = new THREE.TorusGeometry(0.162, 0.022, 8, 32); g.rotateX(Math.PI / 2); g.scale(1.08, 1, 0.75); g.translate(0, 0.94, Z); return g; })(), bone: 0, color: BELT });
  parts.push({ geo: ball(V(0, 0.9, Z), 0.17, 1.05, 0.62, 0.76, 18), bone: 0, color: PANTS });
  for (const [h, k, a, s] of [[2, 3, 4, -1], [5, 6, 7, 1]]) {
    parts.push({ geo: limb(P(h), P(k), 0.085, 0.062, { seg: 14, rings: 8, bulge: 0.1, flat: 0.92 }), bone: h, color: PANTS });
    parts.push({ geo: ball(P(k), 0.066, 1, 0.95, 1.08, 12), bone: h, color: PANTS });
    parts.push({ geo: limb(P(k), P(a), 0.062, 0.048, { seg: 14, rings: 8, bulge: 0.12, flat: 0.95 }), bone: k, color: PANTS });
    // the shoe: a rounded lozenge, toe forward (-Z), a pale sole line
    const shoe = new THREE.CapsuleGeometry(0.052, 0.17, 6, 14); shoe.rotateX(Math.PI / 2); shoe.scale(1.0, 0.72, 1); shoe.translate(P(a).x + s * 0.004, 0.05, P(a).z - 0.07);
    parts.push({ geo: shoe, bone: a, color: (p, c) => c.copy(p.y < 0.025 ? NAIL : SHOE) });
  }
  for (const [sh, el, s] of [[8, 9, -1], [10, 11, 1]]) {
    parts.push({ geo: ball(P(sh), 0.072, 1, 1, 1, 14), bone: 1, color: SHIRT });
    parts.push({ geo: limb(P(sh), P(el), 0.06, 0.048, { seg: 12, rings: 6, bulge: 0.1 }), bone: sh, color: SHIRT });
    const hand = P(el).clone().add(V(s * 0.005, -0.27, -0.02));
    parts.push({ geo: limb(P(el), hand, 0.045, 0.033, { seg: 12, rings: 6, bulge: 0.12 }), bone: el, color: SKIN });
    parts.push({ geo: ball(hand.clone().add(V(0, -0.05, 0)), 0.045, 0.62, 1.15, 0.95, 12), bone: el, color: SKIN });
  }
  const mat = toonSkin();
  const mesh = rigidSkinned(parts, bones, mat);
  return { mesh, bones, mat };
}

export class FirstPersonBody {
  constructor({ scene, camera, player, quality }) {
    this.camera = camera; this.player = player; this.quality = quality;
    // ---- the hand (camera space)
    const H = this.hand = buildHand();
    this.handRoot = new THREE.Group(); this.handRoot.name = 'fp:hand';
    this.handPivot = new THREE.Group(); this.handRoot.add(this.handPivot); this.handPivot.add(H.mesh);
    H.mesh.renderOrder = 1e6;
    // drawn last (it is in the transparent list with the highest render order): clear depth first so the
    // world never cuts into the hand, and the hand never sinks into a wall you are standing against
    H.mesh.onBeforeRender = (renderer) => renderer.clearDepth();
    camera.add(this.handRoot);
    // ---- the body (world space, follows the feet)
    const B = this.body = buildBody();
    this.bodyRoot = new THREE.Group(); this.bodyRoot.name = 'fp:body'; this.bodyRoot.add(B.mesh);
    scene.add(this.bodyRoot);
    this.bones = Object.fromEntries(B.bones.map((b) => [b.name, b]));
    // state
    this.t = 0; this.vis = 0; this.bodyVis = 0; this.reachT = -1; this.reachKind = '';
    this.lag = new THREE.Vector2(); this.prevYaw = null; this.prevPitch = 0; this.step = 0;
    this.hidden = false; this.realmStyle = '';
  }

  /** reach out (the interact action): 'pull' heaves back, everything else reaches, grabs and lets go */
  reach(kind = '') { this.reachT = 0; this.reachKind = kind; }
  get reaching() { return this.reachT >= 0 && this.reachT < 0.7; }

  /** per-realm look: a touch of warm fill in the dark hub, toon rims in the bright story realm */
  setRealm(r) {
    const story = r === 'story' || r === 'works';
    for (const m of [this.hand.mat, this.body.mat]) {
      const u = m.userData.toon; if (!u) continue;
      u.uRimK.value = story ? 0.42 : 0.18; u.uRim.value.set(story ? (r === 'works' ? 0x30e8ff : 0xff7ad8) : 0xffa070);
      u.uSat.value = story ? 1.25 : 1.05; u.uShadeK.value = story ? 0.35 : 0.2;
      m.emissive.set(story ? 0x000000 : 0x160a04);
    }
  }

  update(dt, { show = true, bodyShow = show } = {}) {
    const P = this.player, cam = this.camera; this.t += dt; const t = this.t;
    const sp = Math.hypot(P.vel.x, P.vel.z), walk = Math.min(1, sp / 3.8), run = THREE.MathUtils.smoothstep(sp, 4.2, 7.0);
    // ---- visibility: slide away (down and out) instead of popping
    const lookDown = THREE.MathUtils.smoothstep(-P.pitch, 0.75, 1.15); // looking at your feet: the body's own arms take over
    const want = show && P.enabled ? 1 - lookDown : 0;
    this.vis += (want - this.vis) * Math.min(1, dt * (want > this.vis ? 5 : 9));
    this.handRoot.visible = this.vis > 0.01;
    this.bodyVis += ((bodyShow && P.enabled ? 1 : 0) - this.bodyVis) * Math.min(1, dt * 10);
    this.bodyRoot.visible = this.bodyVis > 0.5;

    // ---- turn lag: the hand trails a little behind fast turns, then springs back
    let dy = this.prevYaw === null ? 0 : P.yaw - this.prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const dp = P.pitch - this.prevPitch; this.prevYaw = P.yaw; this.prevPitch = P.pitch;
    this.lag.x += THREE.MathUtils.clamp(dy, -0.2, 0.2) * 0.9; this.lag.y += THREE.MathUtils.clamp(dp, -0.2, 0.2) * 0.9;
    this.lag.multiplyScalar(Math.exp(-dt * 7));

    if (this.handRoot.visible) this.updateHand(dt, t, walk, run);
    if (this.bodyRoot.visible) this.updateBody(dt, t, walk, run, sp);
  }

  updateHand(dt, t, walk, run) {
    const P = this.player, cam = this.camera, H = this.hand;
    // screen-space anchor: lower right in landscape; nearer the centre (clear of the ring) in portrait
    const a = cam.aspect, portrait = a < 1, d = portrait ? 0.46 : 0.42, tv = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const touch = !!this.quality?.touch; // touch screens keep the lower-right corner for the interact ring
    const nx = portrait ? 0.12 : touch ? 0.3 : 0.5, ny = portrait ? -0.46 : -0.56; // portrait: the forearm rises from below centre, left of the ring
    // walk bob (figure eight, in step with the camera bob) and a bigger, looser swing when running
    const b = P.bob, amp = walk * 0.012 + run * 0.02;
    const breathe = Math.sin(t * 1.6) * 0.004, sway = Math.sin(t * 0.7) * 0.003;
    const bx = Math.cos(b) * amp + sway, by = -Math.abs(Math.sin(b)) * amp * 1.3 + breathe;
    // the reach (interact): forward, up and in, the fingers open then close round whatever it was
    let rz = 0, ry = 0, rx = 0, open = 0, grab = 0, wristP = 0;
    if (this.reachT >= 0) {
      this.reachT += dt / 0.62; const k = this.reachT;
      if (k >= 1) this.reachT = -1;
      else {
        const out = Math.sin(Math.min(1, k / 0.55) * Math.PI * 0.5) * (1 - THREE.MathUtils.smoothstep(k, 0.62, 1));
        rz = -0.17 * out; ry = 0.07 * out; rx = -0.07 * out; wristP = 0.25 * out;
        open = (1 - THREE.MathUtils.smoothstep(k, 0.25, 0.42)) * Math.min(1, k / 0.12);
        grab = THREE.MathUtils.smoothstep(k, 0.3, 0.48) * (1 - THREE.MathUtils.smoothstep(k, 0.72, 0.95));
        if (this.reachKind === 'pull' && k > 0.45) { rz += 0.09 * Math.sin((k - 0.45) / 0.55 * Math.PI); ry -= 0.05 * Math.sin((k - 0.45) / 0.55 * Math.PI); }
      }
    }
    const tuck = 1 - this.vis; // slides down and out of the frame
    this.handRoot.position.set(nx * d * tv * a + bx + rx + this.lag.x * 0.08 + tuck * 0.05, ny * d * tv + by + ry - this.lag.y * 0.06 - tuck * 0.32, -d + rz);
    // the forearm comes in from the lower right (landscape) or from below (portrait)
    this.handRoot.rotation.set(0, 0, 0);
    this.handPivot.rotation.order = 'YXZ';
    this.handPivot.rotation.set((portrait ? 0.7 : 0.55) - wristP + this.lag.y * 0.5 + Math.sin(b) * amp * 2, (portrait ? -0.06 : touch ? 0.08 : 0.3) + this.lag.x * 0.6, (portrait ? 0.12 : 0.3) + Math.cos(b) * amp * 3);
    // the wrist and the fingers: relaxed curl, a slow idle flex, open/grab for the reach
    const wrist = H.bones[1]; wrist.rotation.set(-0.12 + Math.sin(t * 1.1) * 0.03 - wristP * 0.6, 0.06, 0);
    const relax = 0.42 + Math.sin(t * 0.9) * 0.04;
    H.fb.forEach(([k, m, d2], i) => {
      const c = THREE.MathUtils.lerp(relax + i * 0.06, -0.08, open) + grab * (0.9 - relax);
      H.bones[k].rotation.set(-c, 0, (i - 1.5) * 0.04 * (1 + open)); H.bones[m].rotation.x = -c * 1.15; H.bones[d2].rotation.x = -c * 0.9;
    });
    const tc = 0.25 - open * 0.3 + grab * 0.45; H.bones[H.ti].rotation.set(0, tc * 0.6, -tc * 0.3); H.bones[H.ti + 1].rotation.x = -tc * 0.5; H.bones[H.ti + 2].rotation.x = -tc * 0.6;
  }

  updateBody(dt, t, walk, run, sp) {
    const P = this.player, Bn = this.bones;
    this.bodyRoot.position.copy(P.position); this.bodyRoot.rotation.set(0, P.yaw, 0);
    // stride from the same phase as the camera bob (one step per half cycle)
    const ph = P.bob, sw = walk * 0.42 + run * 0.32, lean = run * 0.12 + walk * 0.03;
    const sL = Math.sin(ph), sR = -sL;
    Bn.hipL.rotation.x = sL * sw; Bn.hipR.rotation.x = sR * sw;
    Bn.kneeL.rotation.x = -Math.max(0, Math.sin(ph + 1.2)) * (walk * 0.7 + run * 0.6);
    Bn.kneeR.rotation.x = -Math.max(0, Math.sin(ph + 1.2 + Math.PI)) * (walk * 0.7 + run * 0.6);
    Bn.ankleL.rotation.x = -Bn.hipL.rotation.x * 0.3; Bn.ankleR.rotation.x = -Bn.hipR.rotation.x * 0.3;
    Bn.spine.rotation.set(-lean + Math.sin(t * 1.6) * 0.01, sL * walk * 0.05, 0);
    Bn.pelvis.position.y = Bn.pelvis.userData.mp.y - Math.abs(Math.sin(ph)) * walk * 0.025;
    // arms swing against the legs; elbows bend more when running
    Bn.shL.rotation.set(-sL * (walk * 0.35 + run * 0.4), 0, -0.08); Bn.shR.rotation.set(-sR * (walk * 0.35 + run * 0.4), 0, 0.08);
    Bn.elL.rotation.x = -(0.15 + run * 0.9); Bn.elR.rotation.x = -(0.15 + run * 0.9);
  }
}
