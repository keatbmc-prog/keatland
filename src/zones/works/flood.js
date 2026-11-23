// The norepinephrine project flood: the tide surface (GPU-displaced, see shaders.js), the instanced
// debris riding it (planks, PVC, buckets of sand, scrap tin, boxes, glass, knife blanks), and the
// named pieces the scene needs: the greenhouse hoop with its clothesline, the half-painted sheet of
// corrugated tin, the five-gallon bucket, the whiteboard, the cardboard HR desk Dale rafts on, the
// guitar, and the piece of cardboard that says BUT WHAT IF… All of it rides floodHeight(); when the
// drain opens it spirals in and goes down, and what is left settles on the floor as the level drops.
import * as THREE from 'three';
import { WL } from './layout.js';
import { FLOOD, floodMaterial, floodHeight } from './shaders.js';
import { handText } from './paint.js';
import { mulberry32 } from '../../core/noise.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const clamp = THREE.MathUtils.clamp;

export function buildFlood({ root, quality }) {
  const D = quality.detail, rng = mulberry32(99);
  const g = new THREE.Group(); g.name = 'works:flood'; root.add(g);
  // the surface: from the far end of the intake tunnel to the east wall
  const x0 = -WL.hx - 22, x1 = WL.hx, segX = Math.round(150 * D + 40), segZ = Math.round(150 * D + 40);
  const geo = new THREE.PlaneGeometry(x1 - x0, WL.hz * 2, segX, segZ); geo.rotateX(-Math.PI / 2); geo.translate((x0 + x1) / 2, 0, 0);
  const surface = new THREE.Mesh(geo, floodMaterial()); surface.receiveShadow = true; surface.frustumCulled = false; g.add(surface);
  surface.visible = false;

  // ---- instanced debris
  const TYPES = [
    { n: 70, geo: new THREE.BoxGeometry(2.2, 0.07, 0.22), mat: std({ color: 0x9a7448 }), r: 1.1, colors: [0x9a7448, 0x7a5634, 0xb08a5a] },                   // lumber
    { n: 40, geo: new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8).rotateZ(Math.PI / 2), mat: std({ color: 0xffffff, roughness: 0.45 }), r: 1.2, colors: [0xe8e6e0, 0xdcd8cc] }, // PVC
    { n: 26, geo: new THREE.CylinderGeometry(0.16, 0.14, 0.38, 12), mat: std({ color: 0xffffff, roughness: 0.5 }), r: 0.2, colors: [0xe8641c, 0xf0efe8, 0x2a5aa8], sink: 0.12 }, // buckets of sand
    { n: 22, geo: new THREE.BoxGeometry(1.4, 0.02, 0.8), mat: std({ color: 0xffffff, metalness: 0.7, roughness: 0.35 }), r: 0.8, colors: [0x9aa0a4, 0x7c8286, 0x8a6a4a] }, // scrap metal
    { n: 30, geo: new THREE.BoxGeometry(0.55, 0.42, 0.45), mat: std({ color: 0xffffff }), r: 0.35, colors: [0xa98a5e, 0x9a7a52, 0xb89a6a] },          // boxes, trash
    { n: 34, geo: new THREE.TetrahedronGeometry(0.12), mat: std({ color: 0xbfe0e8, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.7 }), r: 0.1, colors: [0xbfe0e8, 0x9ac8a0] }, // broken glass
    { n: 10, geo: new THREE.BoxGeometry(0.38, 0.012, 0.06), mat: std({ color: 0xffffff, metalness: 0.9, roughness: 0.3 }), r: 0.2, colors: [0x9a9c9e] }, // knife blanks
  ];
  const items = [];
  const dummy = new THREE.Object3D();
  for (const T of TYPES) {
    T.n = Math.max(4, Math.round(T.n * (0.5 + 0.5 * D)));
    T.mesh = new THREE.InstancedMesh(T.geo, T.mat, T.n); T.mesh.castShadow = D >= 0.8; T.mesh.frustumCulled = false; g.add(T.mesh);
    for (let i = 0; i < T.n; i++) {
      T.mesh.setColorAt(i, new THREE.Color(T.colors[i % T.colors.length]));
      items.push({ T, i, p: V(0, -5, 0), v: V(), yaw: rng() * 6.28, spin: (rng() - 0.5) * 0.8, tilt: rng() * 6.28, alive: false, gone: false, rest: false, seed: rng() });
    }
  }

  // ---- named pieces
  const props = {};
  const mk = (name, obj, { r = 0.8, draft = 0.1 } = {}) => { obj.traverse((o) => { if (o.isMesh) o.castShadow = true; }); obj.visible = false; g.add(obj); props[name] = { obj, p: V(), v: V(), yaw: 0, r, draft, mode: 'off', target: null, speed: 2.5, spin: 0 }; return props[name]; };
  { // greenhouse hoop with a clothesline still strung across it, a sock and a shirt
    const o = new THREE.Group(); const m = std({ color: 0xd8dcd8, metalness: 0.7, roughness: 0.35 });
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.035, 8, 40, Math.PI), m); o.add(hoop);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 4.8, 4), std({ color: 0xeeeeee })); line.rotation.z = Math.PI / 2; line.position.y = 1.6; o.add(line);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.7), std({ color: 0x5a7aa8, side: THREE.DoubleSide })); sh.position.set(-0.6, 1.25, 0); o.add(sh);
    const sk = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.4), std({ color: 0xe8e0c8, side: THREE.DoubleSide })); sk.position.set(0.7, 1.4, 0); o.add(sk);
    mk('hoop', o, { r: 2.4, draft: 0.6 });
  }
  { // corrugated tin, half-painted
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    for (let i = 0; i < 256; i++) { const v = 0.7 + 0.3 * Math.sin(i / 256 * Math.PI * 2 * 10); x.fillStyle = i < 140 ? `rgb(${Math.round(60 * v)},${Math.round(110 * v)},${Math.round(150 * v)})` : `rgb(${Math.round(150 * v)},${Math.round(152 * v)},${Math.round(150 * v)})`; x.fillRect(i, 0, 1, 128); }
    x.fillStyle = 'rgba(60,110,150,0.8)'; for (let k = 0; k < 30; k++) x.fillRect(134 + Math.random() * 20, Math.random() * 128, 6, 3);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const o = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.03, 1.0), std({ map: t, metalness: 0.6, roughness: 0.4 })); mk('tin', o, { r: 1.2, draft: 0.02 });
  }
  { const o = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.4, 16, 1, true), std({ color: 0xe8641c, side: THREE.DoubleSide })); o.add(b); const r = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20), std({ color: 0xe8641c })); r.rotation.x = Math.PI / 2; r.position.y = 0.2; o.add(r); mk('bucket', o, { r: 0.2, draft: 0.15 }); }
  { // the whiteboard, blank on both sides
    const o = new THREE.Group(); const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 1.2), std({ color: 0xf4f4f0, roughness: 0.15 })); o.add(b); const f = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.05, 1.26), std({ color: 0x9aa0a4, metalness: 0.8 })); f.scale.y = 0.6; o.add(f); mk('whiteboard', o, { r: 1.0, draft: 0.02 });
  }
  { // the cardboard HR desk (Dale's raft)
    const o = new THREE.Group(); const cm = std({ color: 0xa98a5e, roughness: 0.95 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.8), cm); top.position.y = 0.2; o.add(top);
    const side = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 0.04), cm); side.position.set(0, -0.05, 0.38); o.add(side);
    const hr = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.36), new THREE.MeshStandardMaterial({ map: handText('HUMAN RESOURCES', { w: 1024, h: 256, size: 110, color: '#1a1a1a' }), transparent: true })); hr.position.set(0, -0.02, 0.405); o.add(hr);
    mk('raft', o, { r: 0.9, draft: 0.12 });
  }
  { // a guitar, face up, still in tune enough
    const o = new THREE.Group(); const wm = std({ color: 0xa8662a, roughness: 0.4 });
    const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.1, 24), wm); b1.position.x = -0.15; o.add(b1); const b2 = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.1, 24), wm); b2.position.x = 0.15; o.add(b2);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), std({ color: 0x120a04 })); hole.rotation.x = -Math.PI / 2; hole.position.set(0.05, 0.052, 0); o.add(hole);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.06), std({ color: 0x3a2412 })); neck.position.x = 0.62; o.add(neck);
    mk('guitar', o, { r: 0.6, draft: 0.03 });
  }
  { // BUT WHAT IF…
    const o = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.55), [std({ color: 0xa98a5e }), std({ color: 0xa98a5e }), new THREE.MeshStandardMaterial({ map: handText('BUT WHAT IF…', { w: 512, h: 320, size: 100, color: '#111', bg: '#b4966a' }), roughness: 0.9 }), std({ color: 0xa98a5e }), std({ color: 0xa98a5e }), std({ color: 0xa98a5e })]);
    mk('butWhatIf', o, { r: 0.5, draft: 0.01 });
  }

  // ---- tweens on the uniforms (the director sets targets)
  const tw = {};
  const tween = (key, to, dur) => { tw[key] = { from: FLOOD[key].value, to, t: 0, dur: Math.max(0.001, dur) }; };
  const S = { frontSpeed: 0, running: false, draining: false, drainT: 0, settle: false };

  function release() { // let the debris out of the intake
    surface.visible = true;
    for (const it of items) { it.alive = true; it.gone = false; it.rest = false; it.p.set(-WL.hx - 3 - rng() * 18, 0, (rng() - 0.5) * 14); it.v.set(0, 0, 0); }
  }
  // timers in simulation time (so pausing, or the headless shots stepping time, keep the flood in step)
  const timers = [];
  const later = (dt, fn) => timers.push({ t: dt, fn });
  function reset() {
    for (const k of Object.keys(tw)) delete tw[k]; timers.length = 0;
    FLOOD.uLevel.value = -0.9; FLOOD.uFront.value = -WL.hx - 6; FLOOD.uSurge.value = 0; FLOOD.uVortex.value = 0; FLOOD.uChop.value = 1;
    surface.visible = false; S.running = false; S.draining = false; S.frontSpeed = 0;
    for (const it of items) { it.alive = false; it.gone = false; it.rest = false; it.p.set(0, -50, 0); }
    for (const p of Object.values(props)) { p.mode = 'off'; p.obj.visible = false; p.target = null; }
    writeAll(0);
  }
  function writeAll(t) {
    for (const T of TYPES) T.mesh.count = T.n;
    for (const it of items) {
      if (!it.alive || it.gone) { dummy.position.set(0, -60, 0); dummy.scale.setScalar(0.001); }
      else {
        dummy.position.copy(it.p); dummy.scale.setScalar(it.shrink ?? 1);
        const bob = it.rest ? 0 : 0.25;
        dummy.rotation.set(Math.sin(t * 0.9 + it.tilt) * bob * 0.5, it.yaw, Math.cos(t * 0.7 + it.tilt) * bob * 0.4);
      }
      dummy.updateMatrix(); it.T.mesh.setMatrixAt(it.i, dummy.matrix);
    }
    for (const T of TYPES) { T.mesh.instanceMatrix.needsUpdate = true; if (T.mesh.instanceColor) T.mesh.instanceColor.needsUpdate = true; }
  }

  const hx = WL.hx, hz = WL.hz, DR = WL.drain;
  const vats = WL.vats.map(([x, z, r]) => ({ x, z, r: r + 0.3 })).concat([{ x: WL.pullVat.x, z: WL.pullVat.z, r: WL.pullVatR + 0.2 }, { x: WL.stair.c.x, z: WL.stair.c.z, r: 3.6 }, { x: WL.cjp.x, z: WL.cjp.z, r: 1.5 }]);
  const flowAt = (x, z, t, out) => {
    // general drift away from the intake, eddies, and the drain's pull
    out.set(0.7 + 0.4 * Math.sin(z * 0.15 + t * 0.2), 0, 0.5 * Math.sin(x * 0.11 + t * 0.3) + 0.3 * Math.cos(z * 0.2 - t * 0.17));
    // in the bottling bay the current sweeps toward the line (that is how Moss ends up there)
    const vx = FLOOD.uVortex.value;
    if (vx > 0) {
      const dx = x - DR.x, dz = z - DR.z, r = Math.max(0.6, Math.hypot(dx, dz));
      const tang = 9 * vx / (r * 0.5 + 1), rad = -3.2 * vx * (1 + 6 / (r + 1));
      out.multiplyScalar(1 - vx); out.x += (-dz / r) * tang + (dx / r) * rad; out.z += (dx / r) * tang + (dz / r) * rad;
    }
    return out;
  };
  const tmp = V();

  function moveFloat(it, dt, t, r, draft) {
    const lev = FLOOD.uLevel.value;
    const wet = it.p.x < FLOOD.uFront.value - 1 && lev > 0.05;
    if (wet) {
      flowAt(it.p.x, it.p.z, t, tmp);
      // things near the breaking front get shoved along with it
      const ahead = FLOOD.uFront.value - it.p.x; if (ahead < 6 && S.frontSpeed > 0) tmp.x += S.frontSpeed * (1 - ahead / 6) * 1.1;
      it.v.lerp(tmp, Math.min(1, dt * 1.6));
      it.p.addScaledVector(it.v, dt);
      const h = floodHeight(it.p.x, it.p.z, t);
      it.p.y = Math.max(h - draft, 0.03 + (it.T ? 0.04 : 0));
      it.rest = false;
    } else if (lev <= 0.05 && it.p.y > 0) {
      it.p.y = Math.max(0.04, it.p.y - dt * 0.6); it.rest = true;
    }
    // walls and obstacles
    const inTunnel = it.p.x < -hx && Math.abs(it.p.z) < 7.5;
    if (!inTunnel) { it.p.x = clamp(it.p.x, -hx + r * 0.5 + 0.3, hx - r * 0.5 - 0.3); it.p.z = clamp(it.p.z, -hz + r * 0.5 + 0.3, hz - r * 0.5 - 0.3); }
    else it.p.z = clamp(it.p.z, -7.3, 7.3);
    for (const o of vats) { const dx = it.p.x - o.x, dz = it.p.z - o.z, d = Math.hypot(dx, dz), m = o.r + r * 0.4; if (d < m && d > 1e-4) { it.p.x = o.x + dx / d * m; it.p.z = o.z + dz / d * m; } }
    // the drain takes things
    if (FLOOD.uVortex.value > 0.3) {
      const d = Math.hypot(it.p.x - DR.x, it.p.z - DR.z);
      if (d < 2.2) { it.shrink = Math.max(0, (it.shrink ?? 1) - dt * 1.5); it.p.y -= dt * 2; if (it.shrink <= 0.02) { it.gone = true; return true; } }
    }
    return false;
  }

  return {
    group: g, surface, props, FLOOD, S,
    reset, release, tween,
    get level() { return FLOOD.uLevel.value; },
    heightAt: (x, z, t) => floodHeight(x, z, t),
    /** start the tide: the front runs from the doors to the east wall in `dur` seconds and the level rises */
    surge(dur = 9, level = 1.35) {
      release(); S.running = true;
      FLOOD.uFront.value = -hx - 22; FLOOD.uLevel.value = 0.25;
      tween('uFront', hx + 8, dur); tween('uLevel', level, dur * 1.3); tween('uSurge', 1, 0.6);
      S.frontSpeed = (hx * 2 + 30) / dur;
      later(dur, () => { tween('uSurge', 0.12, 3); S.frontSpeed = 0; });
    },
    /** fill instantly (for jumping into the middle of the scene) */
    full(level = 1.35) {
      release(); surface.visible = true; FLOOD.uFront.value = hx + 8; FLOOD.uLevel.value = level; FLOOD.uSurge.value = 0.12; S.running = true; S.frontSpeed = 0;
      for (const it of items) { it.p.set(-hx + 2 + rng() * (hx * 2 - 4), level, -hz + 2 + rng() * (hz * 2 - 4)); }
    },
    drain(dur = 16) { S.draining = true; tween('uVortex', 1, 2.5); tween('uLevel', -0.9, dur); later(dur - 2.5, () => tween('uVortex', 0, 3)); later(dur + 0.2, () => { surface.visible = false; S.running = false; }); },
    drained() { for (const k of Object.keys(tw)) delete tw[k]; timers.length = 0; FLOOD.uLevel.value = -0.9; FLOOD.uVortex.value = 0; FLOOD.uSurge.value = 0; surface.visible = false; S.running = false; for (const it of items) { if (it.alive && !it.gone) { it.p.y = 0.04; it.rest = true; } if (rng() < 0.4) it.gone = true; } },
    /** a named piece: show it floating at p (local), optionally heading to `target` */
    float(name, p, { target = null, speed = 2.5, spin = 0.3 } = {}) { const P = props[name]; P.obj.visible = true; P.shrink = 1; P.gone = false; P.p.copy(p); P.mode = target ? 'go' : 'drift'; P.target = target; P.speed = speed; P.spin = spin; return P; },
    hide(name) { props[name].obj.visible = false; props[name].mode = 'off'; },
    update(dt, t) {
      for (const tm of [...timers]) { tm.t -= dt; if (tm.t <= 0) { timers.splice(timers.indexOf(tm), 1); tm.fn(); } }
      for (const [k, w] of Object.entries(tw)) { w.t += dt; const u = Math.min(1, w.t / w.dur), e = u * u * (3 - 2 * u); FLOOD[k].value = w.from + (w.to - w.from) * e; if (u >= 1) delete tw[k]; }
      if (S.running || items.some((i) => i.alive && !i.rest && !i.gone)) {
        for (const it of items) if (it.alive && !it.gone) moveFloat(it, dt, t, it.T.r, it.T.sink ?? 0.02);
        writeAll(t);
      }
      for (const P of Object.values(props)) {
        if (P.mode === 'off') continue;
        if (P.mode === 'go' && P.target) {
          const d = P.target.clone().sub(P.p); d.y = 0; const L = d.length();
          if (L < 0.2) { P.mode = 'drift'; } else P.p.addScaledVector(d.normalize(), Math.min(L, P.speed * dt));
          P.p.y = Math.max(floodHeight(P.p.x, P.p.z, t) - P.draft, 0.04);
        } else if (P.mode === 'drift') { const gone = moveFloat(P, dt, t, P.r, P.draft); if (gone) { P.obj.visible = false; P.mode = 'off'; } }
        P.yaw += P.spin * dt;
        P.obj.scale.setScalar(P.shrink ?? 1); P.obj.position.copy(P.p); P.obj.rotation.set(Math.sin(t * 1.1 + P.r) * 0.08, P.yaw, Math.cos(t * 0.9) * 0.06);
      }
    },
  };
}
