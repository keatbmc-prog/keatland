// The story realm: Keatland Reception (Parts Two and Three of the Keatland story). Combines the
// sunlit lot, the reception building and the Backrooms annex behind it, Dale, Yesterkeat's PA, the
// world-space speech layer, the zone lighting (sun outside, sun through the windows in Reception,
// no sun and yellow fluorescent haze in the back) and the interactions. main.js toggles it as the
// realm 'story'; transitions.js carries the player in from the stolen car in the hub and back out.
import * as THREE from 'three';
import { S, SL, FLOOR } from './layout.js';
import { V } from './kit.js';
import { storySky, storyEnvironment, SUN_DIR } from './sky.js';
import { buildExterior } from './exterior.js';
import { buildReception } from './reception.js';
import { buildBackrooms } from './backrooms.js';
import { Dale } from './dale.js';
import { Yesterkeat } from './yesterkeat.js';
import { SpeechLayer } from './speech.js';
import { StoryAudio } from '../audio/storyAudio.js';
import { SIGNS } from '../data/storyLines.js';

const lerp = THREE.MathUtils.lerp;

export function buildStory({ scene, renderer, post, mats, quality, collision, audio, voice, lights }) {
  const root = new THREE.Group(); root.name = 'story'; root.position.copy(S); scene.add(root);
  const sky = storySky(); sky.visible = false; scene.add(sky);
  const env = storyEnvironment(renderer);

  const exterior = buildExterior({ root, mats, quality, collision });
  const reception = buildReception({ root, collision, quality });
  const back = buildBackrooms({ root, collision, quality });
  const speech = new SpeechLayer(root);
  const dale = new Dale({ root, collision, speech });
  const sAudio = new StoryAudio(audio);
  const W = (v) => v.clone().add(S);
  const yk = new Yesterkeat({ ticker: back.ticker, audio: sAudio, speakersWorld: back.speakerPos.map(W) });

  // the light pool: a fixed number of point lights that hop to the fixtures nearest the camera
  // (fixed count = no shader recompiles while you walk around)
  const POOL = quality.mobile ? 3 : quality.detail >= 1 ? 6 : 4;
  const pool = []; for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xfff0cc, 0, 7.5, 1.6); root.add(l); pool.push(l); }
  const allFixtures = [...reception.fixtures.map((p) => ({ p, kind: 'rec' })), ...back.fixtures.map((p) => ({ p, kind: 'back', fl: back.flicker.find((f) => f.p === p) }))];
  let poolT = 0, poolAssign = [];

  // sounds that belong to world events
  dale.onLine = (text, pos, mood) => sAudio.babble(text, W(pos), { shout: mood !== 'caught' && mood !== 'giveup' && mood !== 'idle' });
  reception.onCollapse = (pos) => { sAudio.chairCrash(W(pos || SL.hrDesk)); setTimeout(() => { const l = voice.lines.find((x) => x.say === 'growth'); if (l && realmOn) voice.speak(l, cameraRef, W(exterior.treePoint())); }, 1800); };
  back.onTileFall = (pos) => sAudio.tileFall(W(pos).setY(S.y + FLOOR + 2.8), W(pos));
  // the voice in the trees: outside it comes from the cottonwoods; in the back, from the tree
  // pushing through the wall; and Dale hears it too
  voice.placer = (zone) => {
    if (zone !== 'story') return null;
    if (state.zone === 'backrooms') return W(V(16.6, 3.5, SL.branchZ + (Math.random() - 0.5) * 6));
    return W(exterior.treePoint());
  };
  const prevOnSpeak = voice.onSpeak;
  voice.onSpeak = (line, p) => { prevOnSpeak?.(line, p); if (realmOn && state.zone === 'backrooms') dale.heardVoice(state.pl); };

  // ------------------------------------------------------------- zones + lighting
  const state = { zone: 'outdoor', w: { outdoor: 1, inside: 0, backrooms: 0 }, pl: V(), deskAnnounced: false, entered: 0, worksT: 0 };
  const inReception = (p) => p.x > SL.rx0 && p.x < SL.rx1 && p.z > SL.rz0 && p.z < SL.rz1 + 0.2;
  const zoneOf = (p) => (back.inBackrooms(p) ? 'backrooms' : inReception(p) ? 'inside' : 'outdoor');
  let realmOn = false, cameraRef = null;
  const saved = {};
  const L = lights;
  // art direction (High-on-Life-ish): teal sky fill, pink ground bounce, a warm orange sun, candy haze;
  // the Backrooms go acid yellow-green with a violet bounce
  const sky0 = new THREE.Color(0x6fe8ff), gnd0 = new THREE.Color(0xff6aa8), skyIn = new THREE.Color(0xffc8a0), skyB = new THREE.Color(0xe0ff6a), gndB = new THREE.Color(0x8a3aa0);
  const fogOut = new THREE.Color(0xf09ac0), fogIn = new THREE.Color(0xffb890), fogBack = new THREE.Color(0x9ab83a);
  const sunCol = new THREE.Color(0xffc890);

  function setActive(on) {
    const was = realmOn;
    realmOn = on; sky.visible = on; root.visible = on;
    if (on && !was) {
      Object.assign(saved, { env: scene.environment, envI: scene.environmentIntensity, exp: renderer.toneMappingExposure, bs: post.bloom?.strength, bt: post.bloom?.threshold, br: post.bloom?.radius, bg: scene.background, vig: post.uniforms.uVignette.value });
      scene.environment = env; scene.environmentIntensity = 1; scene.background = null;
      if (post.bloom) { post.bloom.strength = 0.42; post.bloom.threshold = 0.82; post.bloom.radius = 0.55; } // glow on the emissive goop
      post.uniforms.uVignette.value = 0.55;
      L.moon.color.copy(sunCol); L.moon.position.copy(S).add(new THREE.Vector3(0, 0, -20)).addScaledVector(SUN_DIR, 160); L.moon.target.position.copy(S).add(new THREE.Vector3(2, 0, -24)); L.moon.target.updateMatrixWorld();
      if (L.moon.castShadow) { Object.assign(L.moon.shadow.camera, { left: -72, right: 72, top: 72, bottom: -72, near: 10, far: 360 }); L.moon.shadow.camera.updateProjectionMatrix(); }
      L.rimLight.intensity = 0;
    } else if (!on && was) {
      scene.environment = saved.env; scene.environmentIntensity = saved.envI; renderer.toneMappingExposure = saved.exp; scene.background = saved.bg; post.uniforms.uVignette.value = saved.vig;
      if (post.bloom) { post.bloom.strength = saved.bs; post.bloom.threshold = saved.bt; post.bloom.radius = saved.br; }
      if (L.moon.castShadow) { Object.assign(L.moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 320 }); L.moon.shadow.camera.updateProjectionMatrix(); }
      sAudio.update(0, { on: false });
    }
  }
  function lighting(dt) {
    const w = state.w, k = Math.min(1, dt * 2.5), z = state.zone;
    for (const key of ['outdoor', 'inside', 'backrooms']) w[key] += ((z === key ? 1 : 0) - w[key]) * k;
    L.moon.intensity = 3.3 * (1 - w.backrooms);
    L.hemi.intensity = 1.0 * w.outdoor + 0.6 * w.inside + 0.55 * w.backrooms;
    L.hemi.color.copy(sky0).lerp(skyIn, w.inside).lerp(skyB, w.backrooms); L.hemi.groundColor.copy(gnd0).lerp(gndB, w.backrooms);
    scene.environmentIntensity = 1.0 * w.outdoor + 0.6 * w.inside + 0.3 * w.backrooms;
    renderer.toneMappingExposure = 0.9 * w.outdoor + 0.95 * w.inside + 1.05 * w.backrooms;
    scene.fog.color.copy(fogOut).lerp(fogIn, w.inside).lerp(fogBack, w.backrooms);
    state.fog = -(0.0007 * w.outdoor + 0.003 * w.inside + 0.011 * w.backrooms);
  }
  function lightPool(dt, camLocal) {
    poolT -= dt;
    if (poolT <= 0) {
      poolT = 0.2;
      const cand = allFixtures.filter((f) => (state.zone === 'outdoor' ? f.kind === 'rec' : true)).map((f) => ({ f, d: f.p.distanceToSquared(camLocal) })).sort((a, b) => a.d - b.d).slice(0, POOL);
      poolAssign = cand.map((c) => c.f);
    }
    pool.forEach((l, i) => {
      const f = poolAssign[i]; if (!f) { l.intensity = 0; return; }
      l.position.copy(f.p); l.position.y -= 0.35;
      const base = f.kind === 'rec' ? 2.2 * (0.35 + 0.65 * state.w.inside) : 3.0;
      l.intensity = f.fl ? (f.fl.on ? base : 0.15) : base;
      l.color.set(f.kind === 'rec' ? 0xf5f0e0 : 0xfff0c0);
    });
  }

  // ------------------------------------------------------------- interactions
  const near = (pl, p, r) => Math.hypot(pl.x - p.x, pl.z - p.z) < r;
  function hintFor(pl) {
    if (near(pl, SL.lectern, 2.2) && !reception.sealed) return 'valet';
    if (near(pl, back.exitDoor, 1.8)) return 'exit';
    if (near(pl, back.freedomDoor, 1.9)) return 'try door';
    if (near(pl, back.worksDoor, 1.8)) return 'enter';
    return '';
  }
  function interact(pl, simTime) {
    const h = hintFor(pl);
    if (h === 'valet' || h === 'exit') return 'out';
    if (h === 'try door') {
      sAudio.rattle(W(back.freedomDoor).setY(S.y + 1.1));
      speech.say(SIGNS.locked, V(SL.freedomDoorX - 0.4, FLOOR + 1.2, (SL.loop.z0 + SL.loop.z1) / 2), { style: { color: '#f2efe6' } });
      yk.countdown(simTime);
      if (dale.p.distanceTo(pl) < 8) setTimeout(() => dale.say(['Some doors only open from Tomorrow.', 'It do that.'], 'idle'), 2500);
      return 'door';
    }
    if (h === 'enter') return 'works'; // the Catecholamine Works: through the steel door (transitions.worksIn)
    return null;
  }

  // ------------------------------------------------------------- api
  const api = {
    root, sky, env, exterior, reception, back, dale, yk, speech, sAudio, state,
    arrival: { pos: W(SL.arrival), yaw: SL.arrivalYaw },
    emptySpot: W(SL.emptySpot), lectern: W(SL.lectern),
    setActive,
    get fogDensity() { return state.fog ?? -0.0016; },
    reset() {
      reception.reset(); back.reset(); dale.reset(); yk.reset(); speech.clear();
      state.deskAnnounced = false; state.zone = 'outdoor'; state.w = { outdoor: 1, inside: 0, backrooms: 0 }; state.entered = 0;
    },
    hint(player) { return realmOn ? hintFor(player.position.clone().sub(S)) : ''; },
    interact(player, simTime) { return interact(player.position.clone().sub(S), simTime); },
    /** per frame while the realm is on */
    update(dt, t, player, camera, { entered = true, busy = false } = {}) {
      cameraRef = camera;
      const pl = player.position.clone().sub(S); state.pl.copy(pl);
      const camLocal = camera.position.clone().sub(S);
      state.zone = zoneOf(pl);
      sky.position.copy(camera.position);
      lighting(dt);
      exterior.update(dt, t, camLocal);
      reception.update(dt, t, pl, camLocal);
      const shift = back.update(dt, t, pl, camLocal, [dale.p]);
      if (shift && !busy) { player.position.x += shift; player.applyCamera(0); dale.shift(shift, pl); }
      dale.update(dt, t, pl, camera.position, entered && back.deep(pl) || (dale.mode === 'chase' && state.zone === 'backrooms'));
      speech.update(dt);
      // the brochure desk: Yesterkeat's small print
      if (!state.deskAnnounced && near(pl, SL.desk, 3.2)) { state.deskAnnounced = true; yk.announce('eligibility'); yk.announce('employed'); }
      const inBack = state.zone === 'backrooms';
      if (inBack) state.entered += dt;
      yk.update(dt, t, { active: entered && inBack && state.entered > 5, nearestSpeakers: () => back.speakerPos.map((p) => ({ p, d: p.distanceToSquared(camLocal) })).sort((a, b) => a.d - b.d).slice(0, 3).map((o) => W(o.p)) });
      lightPool(dt, camLocal);
      // the angle grinder in the cottonwoods: now and then, when you are outside
      state.grindNext = (state.grindNext ?? 8) - dt;
      if (state.grindNext <= 0) { const dur = 1.5 + Math.random() * 3; exterior.grind(dur); sAudio.grind(W(exterior.grinderAt), dur); state.grindNext = 14 + Math.random() * 22; }
      // flickering tube nearby -> stutter in the hum
      let flick = 0; for (const f of back.flicker) { const d = f.p.distanceTo(camLocal); if (d < 5 && !f.on) flick = Math.max(flick, 1 - d / 5); }
      sAudio.update(dt, { on: true, ...state.w, phone: W(reception.phonePos), flicker: flick, camera });
    },
  };
  return api;
}
