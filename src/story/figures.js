// Stand-in people for the story realm. Simple, readable, rigged-by-groups figures built from
// primitives: proportions, silhouettes, clothes and the one or two things that make each person
// recognisable (Moss's mechanical forearms and curls, Keaten's bald head and beard, the mop-head
// wig, Dale's lawnmower wheel and copper wire). Each is registered as a GLB slot by the caller
// ('character:moss', 'character:keaten', ...), so a real model can replace it with no code changes.
//
// A figure faces +Z with its feet at the origin. Joints are Groups, so poses are just rotations:
// figure.pose = 'stand' | 'sit' | 'walk' | 'powerwalk' | 'hold' | 'floor' | 'pull' | 'swim' | 'ballet' | 'heave' | 'lounge'.
import * as THREE from 'three';
import { canvasTexture } from '../materials/textures.js';
import { mulberry32 } from '../core/noise.js';
import { Eyeball } from './style/goop.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });

function capsule(r, len, mat, segs = 10) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, segs), mat);
  m.position.y = -len / 2 - r * 0.3; m.castShadow = true; m.receiveShadow = true;
  return m;
}
/** limb segment that tapers (r0 at the joint, r1 at the far end), hanging down from the joint */
function taper(r0, r1, len, mat, segs = 12) {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; const r = r0 + (r1 - r0) * t; pts.push(new THREE.Vector2(r * (1 + 0.08 * Math.sin(t * Math.PI)), -t * len)); }
  pts.unshift(new THREE.Vector2(0.001, r0 * 0.4)); pts.push(new THREE.Vector2(0.001, -len - r1 * 0.4));
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, segs), mat); m.castShadow = true; m.receiveShadow = true; return m;
}

/** Torso cloth texture: shirt colour, optional open V with skin + tattoo, buttons, grime. */
function torsoTexture({ shirt, skin, open = 0, tattoo = false, seed = 1, stripes = null, knit = false }) {
  return canvasTexture(512, 512, (g, w, h) => {
    const rng = mulberry32(seed);
    g.fillStyle = shirt; g.fillRect(0, 0, w, h);
    if (stripes) { g.fillStyle = stripes; for (let x = 0; x < w; x += 22) g.fillRect(x, 0, 3, h); }
    if (knit) { g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 2; for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 10) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 5, y + 6); g.lineTo(x + 10, y); g.stroke(); } }
    // creases
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(0,0,0,${0.04 + rng() * 0.06})`; g.lineWidth = 2 + rng() * 5; g.beginPath(); const x = rng() * w, y = rng() * h; g.moveTo(x, y); g.quadraticCurveTo(x + (rng() - 0.5) * 60, y + 30, x + (rng() - 0.5) * 80, y + 60 + rng() * 60); g.stroke(); }
    for (let i = 0; i < 2000; i++) { g.fillStyle = `rgba(${rng() < 0.5 ? '0,0,0' : '255,240,220'},${rng() * 0.06})`; g.fillRect(rng() * w, rng() * h, 2, 2); }
    // front is at u = 0 (and wraps to u = 1): paint the opening across both edges
    const paintFront = (fn) => { fn(0); fn(w); };
    if (open > 0) paintFront((cx) => {
      g.fillStyle = skin; g.beginPath(); g.moveTo(cx - open * w * 0.12, h); g.lineTo(cx, h * (1 - open * 0.75)); g.lineTo(cx + open * w * 0.12, h); g.fill();
      g.beginPath(); g.moveTo(cx - open * w * 0.05, h); g.lineTo(cx, h * (1 - open)); g.lineTo(cx + open * w * 0.05, h); g.fill();
      if (tattoo) { g.strokeStyle = 'rgba(40,50,60,0.55)'; g.lineWidth = 3; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(cx + (rng() - 0.5) * 30, h * (0.86 + rng() * 0.1), 6 + rng() * 14, rng() * 3, rng() * 3 + 2); g.stroke(); } }
    });
    else paintFront((cx) => { g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(cx - 2, 0, 4, h); for (let y = 30; y < h; y += 70) { g.fillStyle = '#e8e0d0'; g.beginPath(); g.arc(cx + 8, y, 5, 0, 7); g.fill(); } });
  }, { wrap: true });
}

const SPECS = {
  moss: { height: 1.93, build: 0.86, skin: 0xf2b48c, shirt: '#ffd27a', pants: 0x3a2a6a, shoes: 0x2a1240, iris: 0x2ad0c0, headScale: 1.38, hair: 'curls', hairColor: 0x1b130e, beard: null, mech: true, open: 0.15, tieColor: 0x2b2218 },
  keaten: { height: 1.8, build: 1.08, skin: 0xe8a070, shirt: '#8fb83a', pants: 0x2e3a6a, shoes: 0x3a1428, iris: 0x8a4aff, headScale: 1.5, noseW: 1.3, hair: 'bald', beard: 'goatee', hairColor: 0x3b2618, open: 0.75, tattoo: true, earring: true },
  keatenHR: { height: 1.8, build: 1.08, skin: 0xe8a070, shirt: '#ff8fc0', pants: 0x7a6ad0, shoes: 0xfff0d8, iris: 0x8a4aff, headScale: 1.5, noseW: 1.3, hair: 'mop', beard: 'goatee', hairColor: 0x3b2618, open: 0.45, knit: true, glasses: true, earring: true },
  worker: { height: 1.78, build: 1.15, skin: 0xc98a60, shirt: '#1f8a9a', pants: 0x2a2450, shoes: 0x1a1220, iris: 0xff8a2a, headScale: 1.36, hair: 'bald', beard: 'stubble', hairColor: 0x2a1e14, open: 0.05, jacket: true },
  dale: { height: 1.76, build: 0.95, skin: 0xd99068, shirt: '#e0642a', pants: 0x3a2a5a, shoes: 0x22142a, iris: 0x9dff3a, headScale: 1.55, eyeTall: 1.35, noseW: 1.15, hair: 'messy', beard: 'stubble', hairColor: 0x4a3420, open: 0.1, jacket: true },
};

export class Figure {
  constructor(kind, { seed = 1 } = {}) {
    const S = SPECS[kind]; this.kind = kind; this.spec = S;
    const k = S.height / 1.8, b = S.build;
    this.group = new THREE.Group(); this.group.name = 'figure:' + kind;
    const body = new THREE.Group(); this.body = body; this.group.add(body); // procedural parts (hidden by GLB overrides)
    const skin = std(S.skin, { roughness: 0.6 });
    const pants = std(S.pants, { roughness: 0.9 });
    const shoes = std(S.shoes, { roughness: 0.55 });
    const shirtTex = torsoTexture({ shirt: S.shirt, skin: '#' + new THREE.Color(S.skin).getHexString(), open: S.open, tattoo: S.tattoo, seed, knit: S.knit });
    const shirt = new THREE.MeshStandardMaterial({ map: shirtTex, roughness: 0.92 });
    const sleeve = std(new THREE.Color(S.shirt).getHex(), { roughness: 0.92 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xb8c8d8, metalness: 0.75, roughness: 0.25 });
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x2a6a8a, metalness: 0.6, roughness: 0.35, emissive: 0x19d3c5, emissiveIntensity: S.mech ? 0.6 : 0 }); // Moss's joints glow teal

    // ---- hips / legs
    const hipY = 0.93 * k;
    const pelvis = new THREE.Group(); pelvis.position.y = hipY; body.add(pelvis); this.pelvis = pelvis;
    const hipsMesh = new THREE.Mesh(new THREE.SphereGeometry(0.17 * b, 16, 12), pants); hipsMesh.scale.set(1.05, 0.7, 0.75); hipsMesh.castShadow = true; pelvis.add(hipsMesh);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.165 * b, 0.022, 6, 24), std(0x2a1e14, { roughness: 0.5 })); belt.rotation.x = Math.PI / 2; belt.scale.set(1.05, 0.78, 1); belt.position.y = 0.08; pelvis.add(belt);
    this.legs = [-1, 1].map((s) => {
      const hip = new THREE.Group(); hip.position.set(s * 0.095 * b, -0.02, 0); pelvis.add(hip);
      hip.add(taper(0.085 * b, 0.06 * b, 0.43 * k, pants));
      const knee = new THREE.Group(); knee.position.y = -0.43 * k; hip.add(knee);
      knee.add(taper(0.062 * b, 0.045 * b, 0.43 * k, pants));
      const ankle = new THREE.Group(); ankle.position.y = -0.45 * k; knee.add(ankle);
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), shoes); foot.rotation.x = Math.PI / 2; foot.position.set(0, -0.03, 0.06); foot.scale.set(1.15, 1, 0.75); foot.castShadow = true; ankle.add(foot);
      return { hip, knee, ankle, s };
    });

    // ---- torso (lathe, elliptical), neck, head
    const spine = new THREE.Group(); spine.position.y = 0.06; pelvis.add(spine); this.spine = spine;
    const prof = [];
    const R = [[0.0, 0.15], [0.1, 0.152], [0.22, 0.142], [0.34, 0.16], [0.44, 0.185], [0.5, 0.18], [0.55, 0.12], [0.58, 0.06], [0.585, 0.001]];
    R.forEach(([y, r]) => prof.push(new THREE.Vector2(r * b, y * k)));
    prof.unshift(new THREE.Vector2(0.001, 0));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), shirt); torso.scale.set(1.12, 1, 0.72); torso.castShadow = true; torso.receiveShadow = true; spine.add(torso);
    if (S.jacket) { // open jacket over the shirt, a bit bulkier
      const jprof = R.map(([y, r]) => new THREE.Vector2(r * b * 1.1 + 0.012, y * k)); jprof.unshift(new THREE.Vector2(0.001, -0.06));
      const jacket = new THREE.Mesh(new THREE.LatheGeometry(jprof, 24, 0.35, Math.PI * 2 - 0.7), new THREE.MeshStandardMaterial({ map: torsoTexture({ shirt: S.jacketColor ?? '#5a2e8a', skin: '#000', open: 0, seed: seed + 5 }), roughness: 0.95, side: THREE.DoubleSide }));
      jacket.scale.set(1.12, 1, 0.74); jacket.castShadow = true; spine.add(jacket);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.12 * k, 10), skin); neck.position.y = 0.6 * k; spine.add(neck);
    if (S.mech) { const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.066, 0.05, 14, 1, true), darkMetal); collar.position.y = 0.61 * k; spine.add(collar); for (let i = 0; i < 3; i++) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), metal); rod.position.set(-0.05 + i * 0.012, 0.64 * k, -0.035); rod.rotation.z = 0.3; spine.add(rod); } }
    if (S.tieColor) { const tie = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.36, 0.01), std(S.tieColor, { roughness: 0.6 })); tie.position.set(0, 0.36 * k, 0.118 * b); tie.rotation.x = -0.12; spine.add(tie); }
    const headPivot = new THREE.Group(); headPivot.position.y = 0.67 * k; spine.add(headPivot);
    this.eyes = []; this.brows = [];
    const face = new THREE.Group(); face.scale.setScalar(S.headScale ?? 1.42); headPivot.add(face); // big cartoon head (scaled from the neck)
    this.head = face; face.userData.figure = this; // things worn on the head (hats, the pen) scale with it
    const headParts = face;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin); skull.scale.set(0.92, 1.12, 1.02); skull.position.y = 0.11; skull.castShadow = true; face.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), skin); jaw.scale.set(0.95, 0.8, 1.0); jaw.position.set(0, 0.04, 0.025); face.add(jaw);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), skin); nose.scale.set(S.noseW ?? 1, 0.9, 1.25); nose.position.set(0, 0.1, 0.105); face.add(nose);
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 8), skin); ear.scale.set(0.5, 1, 0.8); ear.position.set(s * 0.098, 0.11, 0); face.add(ear);
      const eye = new Eyeball({ r: 0.03, iris: S.iris ?? 0x3a8a6a, lidColor: S.skin, seed: seed * 3 + (s > 0 ? 1 : 2), lazy: 0.05 }); eye.group.position.set(s * 0.04, 0.128, 0.083); eye.group.scale.set(1, S.eyeTall ?? 1.15, 1); face.add(eye.group); this.eyes.push(eye);
      const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.032, 3, 6), std(S.hairColor)); brow.rotation.z = Math.PI / 2 - s * 0.14; brow.position.set(s * 0.042, 0.168, 0.1); face.add(brow); this.brows.push(brow);
      if (S.earring) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.009, 0.002, 6, 12), metal); ring.position.set(s * 0.1, 0.085, 0.005); face.add(ring); }
      if (S.glasses) { const lens = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 16), darkMetal); lens.position.set(s * 0.036, 0.125, 0.105); face.add(lens); }
    }
    const hairMat = std(S.hairColor, { roughness: 0.95 });
    const rng = mulberry32(seed * 7 + 1);
    if (S.beard) {
      const beard = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.55), S.beard === 'stubble' ? std(S.hairColor, { roughness: 1, transparent: true, opacity: 0.55 }) : hairMat);
      beard.scale.set(1, S.beard === 'goatee' ? 1.25 : 1.05, 0.9); beard.position.set(0, S.beard === 'goatee' ? 0.07 : 0.06, 0.04); face.add(beard);
      if (S.beard === 'goatee') { const mus = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.008, 6, 12, Math.PI), hairMat); mus.position.set(0, 0.07, 0.1); face.add(mus); }
    }
    if (S.hair === 'curls' || S.hair === 'messy') {
      const curls = new THREE.Group(); face.add(curls);
      const n = S.hair === 'curls' ? 120 : 80;
      for (let i = 0; i < n; i++) {
        const th = rng() * Math.PI * 2, ph = rng() * (S.hair === 'curls' ? 1.55 : 1.35);
        const r = 0.108 + rng() * 0.03;
        const p = V(Math.sin(ph) * Math.cos(th) * r * 0.95, 0.13 + Math.cos(ph) * r * 1.1, Math.sin(ph) * Math.sin(th) * r);
        if (p.z > 0.06 && p.y < 0.19) continue; // keep the face clear
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.022 + rng() * 0.018, 7, 6), hairMat); c.position.copy(p); curls.add(c);
      }
    }
    if (S.hair === 'mop') { // a mop head worn as a wig: thick cream strands, a topknot, hanging past the shoulders
      const mop = new THREE.Group(); face.add(mop); this.mop = mop;
      const mopMat = std(0xe2d6b8, { roughness: 1 });
      const strand = new THREE.CylinderGeometry(0.009, 0.007, 1, 5); strand.translate(0, -0.5, 0);
      const n = 140, im = new THREE.InstancedMesh(strand, mopMat, n); im.castShadow = true;
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      for (let i = 0; i < n; i++) {
        const th = rng() * Math.PI * 2; if (Math.cos(th) > 0.75 && rng() < 0.85) { i--; continue; } // fringe off the face (mostly)
        const r = 0.1, p = V(Math.sin(th) * r, 0.2, Math.cos(th) * r);
        const L = 0.18 + rng() * 0.22 + (Math.cos(th) < 0 ? 0.1 : 0);
        q.setFromEuler(new THREE.Euler(Math.cos(th) * 0.5 + (rng() - 0.5) * 0.3, 0, -Math.sin(th) * 0.5 + (rng() - 0.5) * 0.3));
        m4.compose(p, q, V(1, L, 1)); im.setMatrixAt(i, m4);
      }
      mop.add(im);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mopMat); top.position.set(0, 0.27, -0.02); top.scale.set(1, 1.3, 1); mop.add(top);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 12), std(0xb23a3a)); tie.rotation.x = Math.PI / 2; tie.position.set(0, 0.24, -0.02); mop.add(tie);
    }

    // mouth: a dark rounded slot that flaps open while they talk, with a tongue and a lip
    { const mouth = new THREE.Group(); mouth.position.set(0, 0.06, 0.1); face.add(mouth); this.mouth = mouth;
      const inner = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 10), new THREE.MeshStandardMaterial({ color: 0x3a0a18, roughness: 0.6 })); inner.scale.set(1.25, 0.25, 0.45); mouth.add(inner); this.mouthInner = inner;
      const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff5a7a, roughness: 0.4 })); tongue.scale.set(1.3, 0.5, 0.7); tongue.position.set(0, -0.004, 0.004); inner.add(tongue);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0055, 6, 20), std(new THREE.Color(S.skin).multiplyScalar(0.8).getHex(), { roughness: 0.5 })); lip.scale.set(1.25, 0.3, 1); lip.position.z = 0.004; mouth.add(lip); this.lip = lip; }
    this.talkT = 0; this.talkLoud = false; this.squash = 0;

    // ---- arms
    this.arms = [-1, 1].map((s) => {
      const sh = new THREE.Group(); sh.position.set(s * 0.2 * b, 0.5 * k, 0); spine.add(sh);
      const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.07 * b, 12, 10), sleeve); sh.add(shoulderBall);
      sh.add(taper(0.062 * b, 0.05 * b, 0.29 * k, sleeve));
      const el = new THREE.Group(); el.position.y = -0.3 * k; sh.add(el);
      const hand = new THREE.Group(); hand.position.y = -0.27 * k; el.add(hand);
      if (S.mech) {
        const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.05, 12), sleeve); cuff.position.y = -0.01; el.add(cuff);
        const joint = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), darkMetal); el.add(joint);
        for (const [dx, dz, r] of [[0.022, 0, 0.012], [-0.022, 0, 0.012], [0, 0.02, 0.008], [0, -0.02, 0.008]]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 0.26 * k, 6), metal); rod.position.set(dx, -0.13 * k, dz); rod.castShadow = true; el.add(rod); }
        for (let i = 0; i < 4; i++) { const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.036 - i * 0.003, 0.036 - i * 0.003, 0.018, 12), darkMetal); ring.position.y = -0.05 - i * 0.055 * k; el.add(ring); }
        const wrist = new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), darkMetal); hand.add(wrist);
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.025), metal); palm.position.y = -0.05; hand.add(palm);
        for (let f = 0; f < 5; f++) { const fx = f === 4 ? s * -0.045 : -0.027 + f * 0.018; const fl = f === 4 ? 0.05 : 0.08 - Math.abs(f - 1.5) * 0.008; const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.005, fl, 5), metal); fg.position.set(fx, -0.09 - fl / 2 + (f === 4 ? 0.04 : 0), f === 4 ? 0.01 : 0); fg.rotation.z = f === 4 ? s * 0.5 : 0; fg.rotation.x = 0.15; fg.castShadow = true; hand.add(fg); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 6, 5), darkMetal); kn.position.set(fx, -0.09 + (f === 4 ? 0.04 : 0), 0); hand.add(kn); }
      } else {
        el.add(taper(0.048 * b, 0.036 * b, 0.25 * k, S.open > 0.5 || kind === 'keaten' ? skin : sleeve));
        const palm = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), skin); palm.scale.set(0.95, 1.15, 0.65); palm.position.y = -0.05; palm.castShadow = true; hand.add(palm);
        const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03, 3, 6), skin); th.position.set(s * -0.04, -0.035, 0.012); th.rotation.z = s * 0.6; hand.add(th);
      }
      return { sh, el, hand, s };
    });

    this.t = Math.random() * 10; this.pose = 'stand'; this.speed = 0; this.lookAt = null; this.cur = new Map();
    this.k = k;
  }

  /** Attach an object to a hand ('L' or 'R'). */
  hold(obj, side = 'R', offset = V(0, -0.1, 0.05)) { const a = this.arms[side === 'L' ? 0 : 1]; obj.position.copy(offset); a.hand.add(obj); return obj; }

  _set(obj, axis, v, rate) { const key = obj.uuid + axis; const c = this.cur.get(key) ?? obj.rotation[axis]; const n = c + (v - c) * rate; this.cur.set(key, n); obj.rotation[axis] = n; }

  update(dt, cameraPos = null) {
    this.t += dt;
    const t = this.t, r = Math.min(1, dt * 8), P = this.pose;
    const [L, R] = this.legs, [AL, AR] = this.arms;
    let pelvisY = 0.93 * this.k, spineX = 0, bob = 0;
    const set = (o, a, v) => this._set(o, a, v, r);
    if (P === 'walk' || P === 'powerwalk') {
      const pw = P === 'powerwalk';
      const f = (pw ? 2.3 : 1.7) * Math.max(0.6, this.speed / (pw ? 1.6 : 1.3));
      const ph = t * f * Math.PI;
      const swing = pw ? 0.55 : 0.45;
      [L, R].forEach((l, i) => { const p = ph + i * Math.PI; set(l.hip, 'x', -Math.sin(p) * swing); set(l.knee, 'x', Math.max(0, Math.sin(p + 1.4)) * (pw ? 0.9 : 0.7)); set(l.ankle, 'x', -Math.max(0, Math.sin(p + 2.2)) * 0.3); set(l.hip, 'z', 0); });
      [AL, AR].forEach((a, i) => { const p = ph + i * Math.PI + Math.PI; set(a.sh, 'x', -Math.sin(p) * (pw ? 0.85 : 0.35)); set(a.el, 'x', pw ? -1.4 : -0.2 - Math.max(0, Math.sin(p)) * 0.3); set(a.sh, 'z', a.s * 0.08); });
      bob = Math.abs(Math.sin(ph)) * 0.035; spineX = pw ? 0.12 : 0.04;
      this.pelvis.rotation.y = Math.sin(ph) * (pw ? 0.18 : 0.08);
    } else if (P === 'sit' || P === 'floor') {
      const fl = P === 'floor';
      [L, R].forEach((l) => { set(l.hip, 'x', fl ? -1.35 : -1.5); set(l.knee, 'x', fl ? 0.4 : 1.5); set(l.ankle, 'x', 0); set(l.hip, 'z', l.s * (fl ? 0.25 : 0.12)); });
      [AL, AR].forEach((a) => { set(a.sh, 'x', fl ? 0.3 : -0.35); set(a.el, 'x', fl ? 0 : -0.9); set(a.sh, 'z', a.s * (fl ? 0.35 : 0.1)); });
      pelvisY = fl ? 0.12 : 0.5 * this.k; spineX = fl ? -0.25 : -0.05 + Math.sin(t * 0.8) * 0.02;
      this.pelvis.rotation.y = 0;
    } else if (P === 'hold') {
      [L, R].forEach((l) => { set(l.hip, 'x', 0); set(l.knee, 'x', 0.05); set(l.ankle, 'x', 0); set(l.hip, 'z', l.s * 0.04); });
      [AL, AR].forEach((a) => { set(a.sh, 'x', -0.55); set(a.el, 'x', -0.9); set(a.sh, 'z', -a.s * 0.18); });
      spineX = 0.08 + Math.sin(t * 1.1) * 0.01; this.pelvis.rotation.y = 0;
    } else if (P === 'pull') { // pulling a chair out: one arm forward, weight back
      [L, R].forEach((l, i) => { set(l.hip, 'x', i ? -0.25 : 0.15); set(l.knee, 'x', i ? 0.35 : 0.05); set(l.ankle, 'x', 0); set(l.hip, 'z', l.s * 0.05); });
      set(AL.sh, 'x', 0.1); set(AL.el, 'x', -0.1); set(AL.sh, 'z', -0.12);
      set(AR.sh, 'x', -0.9); set(AR.el, 'x', -0.4); set(AR.sh, 'z', 0.1);
      spineX = 0.1; this.pelvis.rotation.y = -0.15;
    } else if (P === 'swim') { // treading through the garbage tide: legs kick, arms sweep
      [L, R].forEach((l, i) => { const p = t * 3.2 + i * Math.PI; set(l.hip, 'x', -0.5 + Math.sin(p) * 0.4); set(l.knee, 'x', 0.6 + Math.sin(p + 1) * 0.3); set(l.ankle, 'x', 0.3); set(l.hip, 'z', l.s * 0.15); });
      [AL, AR].forEach((a, i) => { const p = t * 1.6 + i * Math.PI; set(a.sh, 'x', -0.9 + Math.sin(p) * 0.6); set(a.el, 'x', -0.4); set(a.sh, 'z', a.s * (0.9 + Math.cos(p) * 0.3)); });
      spineX = 0.15; this.pelvis.rotation.y = Math.sin(t * 0.7) * 0.2;
    } else if (P === 'ballet') { // perfect ballerina pose, arms over the head
      [L, R].forEach((l, i) => { set(l.hip, 'x', i ? 0 : -0.15); set(l.knee, 'x', i ? 0 : 0.35); set(l.ankle, 'x', -0.6); set(l.hip, 'z', 0); });
      [AL, AR].forEach((a) => { set(a.sh, 'x', 0); set(a.el, 'x', 0.2); set(a.sh, 'z', -a.s * 2.75); });
      spineX = -0.05; this.pelvis.rotation.y = t * 0.9;
    } else if (P === 'heave') { // hauling a chain hand over hand
      const p = Math.sin(t * 2.6);
      [L, R].forEach((l, i) => { set(l.hip, 'x', i ? -0.5 : 0.2); set(l.knee, 'x', i ? 0.7 : 0.2); set(l.ankle, 'x', 0); set(l.hip, 'z', l.s * 0.1); });
      [AL, AR].forEach((a, i) => { set(a.sh, 'x', -1.1 - p * (i ? 0.5 : -0.5)); set(a.el, 'x', -0.5); set(a.sh, 'z', -a.s * 0.1); });
      spineX = -0.25 + p * 0.1; this.pelvis.rotation.y = 0;
    } else if (P === 'lounge') { // in the executive chair, one ankle over one knee
      set(L.hip, 'x', -1.5); set(L.knee, 'x', 1.45); set(L.ankle, 'x', 0); set(L.hip, 'z', -0.1);
      set(R.hip, 'x', -1.75); set(R.knee, 'x', 0.35); set(R.ankle, 'x', 0); set(R.hip, 'z', -0.55);
      set(AL.sh, 'x', -0.2); set(AL.el, 'x', -0.4); set(AL.sh, 'z', 0.35);
      set(AR.sh, 'x', -0.6); set(AR.el, 'x', -1.6 + Math.max(0, Math.sin(t * 0.5)) * 0.6); set(AR.sh, 'z', -0.2);
      pelvisY = 0.52 * this.k; spineX = -0.22; this.pelvis.rotation.y = 0;
    } else { // stand: weight shift, breathing, idle hands
      const w = Math.sin(t * 0.4) * 0.03;
      [L, R].forEach((l) => { set(l.hip, 'x', 0); set(l.knee, 'x', 0.04); set(l.ankle, 'x', 0); set(l.hip, 'z', l.s * 0.035 + w); });
      [AL, AR].forEach((a) => { set(a.sh, 'x', 0.05 + Math.sin(t * 0.7 + a.s) * 0.02); set(a.el, 'x', -0.15); set(a.sh, 'z', a.s * 0.09); });
      spineX = Math.sin(t * 0.9) * 0.012; this.pelvis.rotation.y = 0;
    }
    this.pelvis.position.y += (pelvisY + bob - this.pelvis.position.y) * r;
    this.spine.rotation.x = spineX;
    // head: look at the camera when it is close and roughly in front
    let hy = Math.sin(t * 0.3) * 0.15, hx = 0;
    if (this.lookAt || cameraPos) {
      const target = this.lookAt || cameraPos;
      const hp = this.head.getWorldPosition(V(0, 0, 0));
      const d = target.clone().sub(hp);
      if (d.length() < 9) {
        const inv = this.group.getWorldQuaternion(new THREE.Quaternion()).invert();
        d.applyQuaternion(inv);
        const yaw = Math.atan2(d.x, d.z), pitch = -Math.atan2(d.y, Math.hypot(d.x, d.z));
        if (Math.abs(yaw) < 1.6) { hy = THREE.MathUtils.clamp(yaw, -1.0, 1.0); hx = THREE.MathUtils.clamp(pitch, -0.5, 0.5); }
      }
    }
    this._set(this.head, 'y', hy, Math.min(1, dt * 3)); this._set(this.head, 'x', hx, Math.min(1, dt * 3));
    // ---- face: blinking eyes that follow you, a mouth that flaps while talking, eyebrows that pop
    this.talkT = Math.max(0, this.talkT - dt);
    const talking = this.talkT > 0;
    const syl = talking ? Math.max(0, Math.sin(t * (this.talkLoud ? 15 : 12.5)) * (0.6 + 0.4 * Math.sin(t * 4.1 + 1.3))) : 0;
    const open = talking ? 0.25 + syl * (this.talkLoud ? 1.0 : 0.75) : 0;
    this._mo = (this._mo ?? 0) + (open - (this._mo ?? 0)) * Math.min(1, dt * 22);
    if (this.mouthInner) { this.mouthInner.scale.y = 0.22 + this._mo * 1.1; this.mouthInner.scale.x = 1.25 - this._mo * 0.25; this.lip.scale.y = 0.3 + this._mo * 0.9; }
    const tgt = this.lookAt || cameraPos;
    for (const e of this.eyes) { e.open = this.pose === 'floor' ? 0.55 : this.talkLoud && talking ? 1.15 : 1; e.update(dt, t, tgt); }
    this.brows.forEach((b, i) => { b.position.y = 0.168 + (talking ? syl * 0.008 + (this.talkLoud ? 0.01 : 0) : 0); b.rotation.z = Math.PI / 2 - (i ? 1 : -1) * (this.talkLoud && talking ? -0.25 : 0.14); });
    // ---- squash and stretch: breathing in idle, a bounce on every syllable, a squish on walking steps
    let sq = Math.sin(t * 2.2) * 0.018 + syl * 0.03;
    if (this.pose === 'walk' || this.pose === 'powerwalk') sq += Math.abs(Math.sin(t * (this.pose === 'powerwalk' ? 2.3 : 1.7) * Math.PI)) * 0.04 - 0.02;
    this.squash += (sq - this.squash) * Math.min(1, dt * 12);
    this.body.scale.set(1 - this.squash * 0.5, 1 + this.squash, 1 - this.squash * 0.5);
  }
  /** start the mouth flapping for `dur` seconds (called by the speech layer when this figure says a line) */
  talk(dur = 2, loud = false) { this.talkT = Math.max(this.talkT, dur); this.talkLoud = loud; }
}

/** Props the people carry. */
export function catalyticConverter() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x9a948c, metalness: 0.85, roughness: 0.45 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.22, 4, 12), m); body.rotation.z = Math.PI / 2; body.scale.set(1, 1, 0.7); g.add(body);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), m); p.rotation.z = Math.PI / 2; p.position.x = s * 0.2; g.add(p); const cut = new THREE.Mesh(new THREE.CircleGeometry(0.025, 8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a })); cut.rotation.y = s * Math.PI / 2; cut.position.x = s * 0.261; g.add(cut); }
  const heat = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.2, 12, 1, true), new THREE.MeshStandardMaterial({ color: 0xb08a5a, metalness: 0.7, roughness: 0.3 })); heat.rotation.z = Math.PI / 2; heat.scale.set(1, 1, 0.72); g.add(heat);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function lawnmowerWheel() {
  const g = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 10, 20), new THREE.MeshStandardMaterial({ color: 0x1a1918, roughness: 0.9 })); g.add(tire);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0xc9a020, roughness: 0.5, metalness: 0.3 })); hub.rotation.x = Math.PI / 2; g.add(hub);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function copperCoil() {
  const pts = []; for (let i = 0; i <= 200; i++) { const t = i / 200 * Math.PI * 2 * 7; pts.push(V(Math.cos(t) * 0.16, (i / 200) * 0.06, Math.sin(t) * 0.16)); }
  const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.006, 5), new THREE.MeshStandardMaterial({ color: 0xc46a32, metalness: 0.9, roughness: 0.3 }));
  m.castShadow = true; return m;
}
export function cigarette() { const g = new THREE.Group(); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0xf2efe8 })); c.rotation.x = Math.PI / 2 - 0.25; g.add(c); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0042, 0.02, 6), new THREE.MeshStandardMaterial({ color: 0xd08a3a })); f.rotation.x = Math.PI / 2 - 0.25; f.position.z = -0.03; f.position.y = 0.008; g.add(f); return g; }
export function badge(tex) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 })); return m; }
export function mug(tex) {
  const g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ color: 0xf0ebe0, roughness: 0.3, map: tex });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.1, 16), mat); g.add(c);
  const h = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 6, 10, Math.PI), mat); h.position.x = 0.045; h.rotation.z = -Math.PI / 2; g.add(h);
  return g;
}
