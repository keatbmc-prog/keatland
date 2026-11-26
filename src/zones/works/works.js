// The Catecholamine Works realm: assembles the hall (factory.js), the tide (flood.js), the Jettison
// Hold (hold.js), the cast (cast.js) and the director (director.js) that runs Parts Four to Six of the
// story through them; owns the realm's lighting (sun through the high south windows, a pool of point
// lights that follows you between the hanging lamps, amber haze), its sound (worksAudio.js), its
// collision cages, and the camera rides the scene needs (swept by the tide, onto the vat, a tug on
// the chain). main.js toggles it as the realm 'works'; transitions.js brings you in through the
// steel door in the Backrooms and down the spiral stair, and back up.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { WORKS, WL } from './layout.js';
import { buildFactory } from './factory.js';
import { buildFlood } from './flood.js';
import { buildHold } from './hold.js';
import { buildCast } from './cast.js';
import { Director } from './director.js';
import { FLOOD } from './shaders.js';
import { SpeechLayer } from '../../story/speech.js';
import { WorksAudio } from '../../audio/worksAudio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

export function buildWorks({ scene, renderer, post, quality, collision, audio, voice, lights, transitions, player, camera }) {
  const root = new THREE.Group(); root.name = 'works'; root.position.copy(WORKS); scene.add(root);
  const factory = buildFactory({ root, quality, collision, WORKS });
  const flood = buildFlood({ root, quality });
  const hold = buildHold({ root, quality });
  const cast = buildCast(root);
  const speech = new SpeechLayer(root);
  const W = (v) => v.clone().add(WORKS);
  const wAudio = new WorksAudio(audio, { vats: factory.vats.map((v) => V(v.x, 4, v.z)), conveyor: V(0, 1, WL.conveyor.z), beacons: factory.group ? [V(-WL.hx, 11, 12), V(WL.hx, 11, 0), V(0, 11, -WL.hz)] : [], drain: WL.drain, toWorld: W });
  const pmrem = new THREE.PMREMGenerator(renderer); const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture; pmrem.dispose();

  // collision cages (off unless you are perched somewhere during the flood)
  const cageOf = (cx, cz, pts) => pts.map(([x1, z1, x2, z2]) => collision.addWall({ x1: cx + x1 + WORKS.x, z1: cz + z1 + WORKS.z, x2: cx + x2 + WORKS.x, z2: cz + z2 + WORKS.z, r: 0.05, off: true }));
  const B = WL.bottler, PV = WL.pullVat;
  const cages = {
    perch: cageOf(B.x, B.z, [[-1.45, -1.05, 1.45, -1.05], [1.45, -1.05, 1.45, 1.05], [1.45, 1.05, -1.45, 1.05], [-1.45, 1.05, -1.45, -1.05]]),
    vat: cageOf(PV.x, PV.z, Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2, b = (i + 1) / 10 * Math.PI * 2, r = WL.pullVatR - 0.35; return [Math.cos(a) * r, Math.sin(a) * r, Math.cos(b) * r, Math.sin(b) * r]; })),
  };
  const setCage = (name) => { for (const [k, ws] of Object.entries(cages)) ws.forEach((w) => (w.off = k !== name)); factory.bottlerObs.off = name === 'perch'; factory.pullVatObs.off = name === 'vat'; };

  // camera rides (through transitions.ride so the player controller is paused while they run)
  const P = post.uniforms;
  const lookQ = (pos, yaw, pitch) => new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));
  const rides = {
    shakeK: 0,
    shake(k) { player.shake = Math.max(player.shake || 0, k); this.shakeK = Math.max(this.shakeK, k); },
    /** carry you to `feet` (local) facing yaw/pitch, or facing `face` (local) */
    to(feet, yaw, pitch, dur, { delay = 0, shake = 0, cage, face = null } = {}) {
      const endEye = W(feet).add(V(0, 1.7, 0));
      if (face) { const d = W(face).sub(endEye); yaw = Math.atan2(-d.x, -d.z); pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
      const go = () => {
        if (cage !== undefined) setCage(cage);
        if (!dur) { player.teleport(W(feet), yaw, pitch); player.applyCamera?.(0); return; }
        const s = camera.position.clone(), sq = camera.quaternion.clone(), eq = lookQ(endEye, yaw, pitch);
        transitions.ride({ name: 'works-ride', dur, step: (t) => {
          const k = Math.min(1, t / dur), e = k * k * (3 - 2 * k);
          camera.position.lerpVectors(s, endEye, e); camera.position.y += Math.sin(k * Math.PI) * 0.25;
          if (shake) { camera.position.x += Math.sin(t * 31) * 0.05 * shake * (1 - k); camera.position.z += Math.cos(t * 27) * 0.05 * shake * (1 - k); }
          camera.quaternion.copy(sq).slerp(eq, e);
        }, end: () => { player.teleport(W(feet), yaw, pitch); } });
      };
      if (delay) director.later(delay, go); else go();
    },
    /** a greenhouse hoop clotheslines you */
    knock() { const s = camera.position.clone(), q = camera.quaternion.clone(); const pl = player.position.clone(), yaw = player.yaw ?? 0, pitch = player.pitch ?? 0;
      transitions.ride({ name: 'works-knock', dur: 1.3, step: (t) => { const k = t / 1.3; const a = Math.sin(Math.min(1, k * 3) * Math.PI) * (1 - k); camera.position.copy(s).add(V(0, -0.35 * a, 0)); camera.quaternion.copy(q); camera.rotateX(0.5 * a); camera.rotateZ(0.25 * a); P.uChroma.value = 0.004 * a; }, end: () => { player.teleport(pl, yaw, pitch); } }); this.shake(1.2); },
    /** a heave on the chain */
    tug() { const s = camera.position.clone(), q = camera.quaternion.clone(); const pl = player.position.clone(), yaw = player.yaw ?? 0, pitch = player.pitch ?? 0;
      transitions.ride({ name: 'works-tug', dur: 0.9, step: (t) => { const a = Math.sin(t / 0.9 * Math.PI); camera.position.copy(s).add(V(0, -0.25 * a, 0)); camera.quaternion.copy(q); camera.rotateX(-0.18 * a); }, end: () => { player.teleport(pl, yaw, pitch); } }); },
    /** turn to look at something (local), then hand control back */
    look(target, dur = 0.9) { const s = camera.position.clone(), q = camera.quaternion.clone(); const d = W(target).sub(s); const yaw = Math.atan2(-d.x, -d.z), pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); const eq = lookQ(s, yaw, pitch); const pl = player.position.clone();
      transitions.ride({ name: 'works-look', dur, step: (t) => { const k = Math.min(1, t / dur), e = k * k * (3 - 2 * k); camera.position.copy(s); camera.quaternion.copy(q).slerp(eq, e); }, end: () => { player.teleport(pl, yaw, pitch); } }); },
  };

  const director = new Director({ factory, flood, hold, cast, audio: wAudio, speech, voice, root, collision, rides, getCamera: () => camera });
  director.cages = Object.values(cages);
  rides.director = director;
  // per-frame pieces of the scene the events set up
  director.tick = (dt) => {
    const st = director.state, F = factory;
    if (st.orbit) { const o = st.orbit; o.a += dt * 1.7; o.P.p.set(WL.drain.x + Math.cos(o.a) * o.r, 0, WL.drain.z + Math.sin(o.a) * o.r); o.P.p.y = Math.max(0.05, flood.heightAt(o.P.p.x, o.P.p.z, simT) - 0.01); o.P.yaw = -o.a; }
    if (st.chainTo) {
      const a = F.plugEye().sub(WORKS);
      let b;
      if (st.chainTo === 'keaten') b = cast.keaten.fig.arms[1].hand.getWorldPosition(V()).sub(WORKS);
      else if (st.chainTo === 'player') { const f = V(0, 0, -1).applyQuaternion(camera.quaternion); f.y = 0; f.normalize(); b = camera.position.clone().sub(WORKS).addScaledVector(f, 0.55).add(V(0, -0.55, 0)); }
      else b = V(WL.pullVat.x - 0.3, WL.pullVatH + 1.1, WL.pullVat.z);
      F.setChain(a, b, st.chainTo === 'plug' ? 0.2 : 0.9);
    }
    if (st.keatenChair) { const k = cast.keaten; k.p.copy(cast.office.position).add(V(0, 0, 0).applyAxisAngle(V(0, 1, 0), cast.office.rotation.y)); k.base = cast.office.position.y; k.yaw = cast.office.rotation.y; k.fig.pose = 'lounge'; }
  };

  // ------------------------------------------------------------- lighting
  let realmOn = false, simT = 0;
  const saved = {};
  const L = lights;
  const POOL = quality.mobile ? 3 : quality.detail >= 1 ? 6 : 4;
  const pool = []; for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffd9a0, 0, 26, 1.5); root.add(l); pool.push(l); }
  let poolT = 0, poolAssign = [];
  const sunCol = new THREE.Color(0xffe2b8), hazeCol = new THREE.Color(0x2a3a6a), hazeRed = new THREE.Color(0x7a1440); // violet-teal haze; magenta in the alarm
  const bg = new THREE.Color(0x120d08);
  function setActive(on) {
    const was = realmOn; realmOn = on; root.visible = on;
    if (on && !was) {
      Object.assign(saved, { env: scene.environment, envI: scene.environmentIntensity, exp: renderer.toneMappingExposure, bs: post.bloom?.strength, bt: post.bloom?.threshold, br: post.bloom?.radius, bg: scene.background, vig: post.uniforms.uVignette.value });
      scene.environment = env; scene.environmentIntensity = 0.3; scene.background = bg;
      if (post.bloom) { post.bloom.strength = 0.5; post.bloom.threshold = 0.85; post.bloom.radius = 0.55; }
      post.uniforms.uVignette.value = 0.85;
      L.moon.color.copy(sunCol);
      L.moon.position.copy(WORKS).add(V(0, 0, 8)).addScaledVector(factory.SUN, -120); L.moon.target.position.copy(WORKS).add(V(0, 0, 8)); L.moon.target.updateMatrixWorld();
      if (L.moon.castShadow) { Object.assign(L.moon.shadow.camera, { left: -62, right: 62, top: 62, bottom: -62, near: 10, far: 260 }); L.moon.shadow.camera.updateProjectionMatrix(); }
      L.rimLight.intensity = 0;
    } else if (!on && was) {
      scene.environment = saved.env; scene.environmentIntensity = saved.envI; renderer.toneMappingExposure = saved.exp; scene.background = saved.bg; post.uniforms.uVignette.value = saved.vig;
      if (post.bloom) { post.bloom.strength = saved.bs; post.bloom.threshold = saved.bt; post.bloom.radius = saved.br; }
      if (L.moon.castShadow) { Object.assign(L.moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 320 }); L.moon.shadow.camera.updateProjectionMatrix(); }
      wAudio.update(0, { on: false });
      speech.clear();
    }
  }
  let fog = -0.012;
  function lighting(dt, t, camLocal) {
    const pw = factory.power, al = factory.alarm;
    L.moon.intensity = 3.6; L.hemi.intensity = 0.5 + 0.25 * pw; L.hemi.color.set(0x5ad8ff); L.hemi.groundColor.set(0x8a2a7a);
    renderer.toneMappingExposure = 1.05 + 0.1 * pw;
    scene.environmentIntensity = 0.25 + 0.1 * pw;
    scene.fog.color.copy(hazeCol).lerp(hazeRed, al * (0.4 + 0.3 * Math.sin(t * 5.2)));
    fog = -(0.010 + 0.004 * (1 - pw));
    poolT -= dt;
    if (poolT <= 0) { poolT = 0.25; poolAssign = factory.lampPos.map((p) => ({ p, d: p.distanceToSquared(camLocal) })).sort((a, b) => a.d - b.d).slice(0, POOL).map((o) => o.p); }
    pool.forEach((l, i) => { const p = poolAssign[i]; if (!p) { l.intensity = 0; return; } l.position.copy(p).add(V(0, -0.6, 0)); l.intensity = 90 * pw; });
  }

  // ------------------------------------------------------------- api
  const near = (pl, p, r) => Math.hypot(pl.x - p.x, pl.z - p.z) < r;
  const api = {
    root, factory, flood, hold, cast, director, speech, wAudio, env,
    arrival: { pos: W(WL.arrival), yaw: WL.arrivalYaw },
    door: W(WL.door), stair: WL.stair,
    setActive,
    get fogDensity() { return fog; },
    get on() { return realmOn; },
    reset() { director.reset(); setCage(null); },
    start() { director.start(); setCage(null); },
    hint(player) {
      if (!realmOn) return '';
      const pl = player.position.clone().sub(WORKS);
      if (director.gate === 'pull') return 'pull';
      if (near(pl, WL.stairFoot, 2.4) && pl.y < 1) return 'upstairs';
      return '';
    },
    interact(player) {
      const pl = player.position.clone().sub(WORKS);
      if (director.gate === 'pull') { director.pass(); return 'pull'; }
      if (near(pl, WL.stairFoot, 2.4) && pl.y < 1) return 'out';
      return null;
    },
    jump(label) { setCage(null); return director.jump(label); },
    update(dt, t, playerObj, cam, { busy = false } = {}) {
      simT = t;
      const camLocal = cam.position.clone().sub(WORKS);
      lighting(dt, t, camLocal);
      factory.update(dt, t);
      flood.update(dt, t);
      hold.update(dt, t);
      director.update(dt, t);
      const cw = cam.position;
      for (const a of [cast.keaten, cast.dale, cast.worker]) a.update(dt, t, cw, camLocal);
      // the worker leans over the gantry rail when he shouts
      speech.update(dt);
      // flood front position for the roar
      const fr = FLOOD.uFront.value, running = flood.S.frontSpeed > 0 ? 1 : 0;
      wAudio.update(dt, { on: true, camera: cam, power: factory.power, alarm: factory.alarm, flood: flood.surface.visible ? Math.min(1, FLOOD.uLevel.value + 0.3) : 0, front: W(V(Math.min(WL.hx, fr - 2), 1, THREE.MathUtils.clamp(camLocal.z, -WL.hz, WL.hz))), vortex: FLOOD.uVortex.value, frontRun: running });
      void busy; void playerObj;
    },
  };
  return api;
}
