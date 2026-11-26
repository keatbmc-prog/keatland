// Keatland 3D - entry point. Wires the engine, world, inhabitants, player, audio and transitions.
import * as THREE from 'three';
import { pickQuality, PRESETS } from './core/quality.js';
import { installFogChunks } from './render/fog.js';
import { createPost } from './render/post.js';
import { makeMaterials, U, getTextures } from './materials/library.js';
import { texturesReady, setMaxAnisotropy } from './materials/textures.js';
import { CollisionWorld } from './player/collision.js';
import { Player } from './player/player.js';
import { buildHub } from './world/hub.js';
import { buildBelow } from './world/below.js';
import { buildDistant } from './world/distant.js';
import { buildWhispers } from './world/whispers.js';
import { createSky } from './world/sky.js';
import { L } from './world/layout.js';
import { Heart } from './entities/heart.js';
import { PencilTentacle } from './entities/pencilTentacle.js';
import { Congregation } from './entities/creatures.js';
import { Sword } from './entities/sword.js';
import { SkyEye } from './entities/skyEye.js';
import { sporeField, distantEyes, playerUniform } from './render/effects.js';
import { AudioEngine } from './audio/audio.js';
import { Transitions } from './transitions/transitions.js';
import { registerSlot, loadManifest, applyOverrides, listSlots } from './assets/modelRegistry.js';
import { mulberry32 } from './core/noise.js';
import { loadPhotos } from './gallery/photos.js';
import { PhotoCube } from './entities/photoCube.js';
import { buildCubeShrine, CUBE_SPOT } from './world/cubeShrine.js';
import { buildGallery, G as GALLERY_CENTER } from './world/gallery.js';
const HUB_PORTAL = { x: 21, z: -10 };
import { hubFloor } from './world/layout.js';
import { buildLeafPortal } from './zones/leafPortal.js';
import { buildJungle } from './zones/jungle.js';
import { FOLIAGE, LeafSwarm } from './zones/foliage.js';
import { Stalker } from './entities/stalker.js';
import { JungleAudio } from './audio/jungleAudio.js';
import { Voice } from './audio/voice.js';
import { buildHubEntrance } from './story/hubEntrance.js';
import { buildStory } from './story/story.js';
import { S as STORY_ORIGIN } from './story/layout.js';
import { buildWorks } from './zones/works/works.js';
import { restyleStory } from './story/style/restyle.js';
import { TouchControls, TOUCH_CSS } from './player/touch.js';
import { WORKS as WORKS_ORIGIN } from './zones/works/layout.js';

const status = document.getElementById('enter-status');
const enterEl = document.getElementById('enter');
const hintEl = document.getElementById('hint');
const hintText = document.getElementById('hint-text');
const voiceText = document.getElementById('voice-text');

async function boot() {
  const quality = pickQuality();
  installFogChunks({ cheap: !!quality.cheapShaders });
  const touchMode = !!quality.touch, lazy = !!quality.lazyZones;
  if (touchMode) { const st = document.createElement('style'); st.textContent = TOUCH_CSS + '#enter { z-index: 5; }'; document.head.appendChild(st); document.body.classList.add('touch');
    const k = document.querySelector('#enter .k'); if (k) k.innerHTML = 'left thumb to walk &middot; push to the edge to run &middot; right thumb to look<br/>the ring at the bottom right touches things &middot; headphones help'; }
  await Promise.all(['92px "Permanent Marker"', '20px "Special Elite"', '40px "Rubik Wet Paint"', '40px "Rye"', '600 40px "Oswald"', '40px "VT323"', '700 40px "Caveat"'].map((f) => document.fonts.load(f).catch(() => {})));

  // --- renderer
  const canvas = document.getElementById('world');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance', stencil: false });
  const prMax = Math.min(devicePixelRatio, quality.pixelRatio); let pr = prMax; // (phones: adaptive, see frame())
  renderer.setPixelRatio(pr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.info.autoReset = false; // reset once per frame (in frame()) so info covers every pass of the frame
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 2.1;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = quality.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  setMaxAnisotropy(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x06070b, 0.015, 0); // near = density, far = time (see render/fog.js)
  const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.08, quality.farClip ?? 3200);

  // image-based lighting for metals: a tiny dark room with warm and cold panels
  {
    const pm = new THREE.PMREMGenerator(renderer);
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x020203);
    const panel = (c, i, pos, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s[0], s[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m); };
    panel(0xffa060, 3, [0, 8, 0], [6, 6]); panel(0x7fd6c8, 1.4, [-8, 2, -4], [3, 8]); panel(0xff6a8a, 0.8, [8, 0, 3], [3, 6]); panel(0x9fb8ff, 0.6, [0, -6, 8], [12, 2]);
    scene.environment = pm.fromScene(env, 0.04).texture;
    scene.environmentIntensity = 0.5;
    pm.dispose();
  }

  status.textContent = 'it is growing';
  await new Promise((r) => setTimeout(r, 30));

  const mats = makeMaterials();
  const collision = new CollisionWorld();
  const ctx = { player: null, swordShock: 0, audio: null };

  // --- lights: dim cold hemisphere, a cold "eye-light" from above, the heart's warmth
  const hemi = new THREE.HemisphereLight(0x3a4a5e, 0x1c0c12, 0.3); scene.add(hemi);
  const moon = new THREE.DirectionalLight(0xa8c4ff, 0.55);
  moon.position.set(40, 120, -90); moon.target.position.set(0, 0, 0);
  if (quality.shadows) {
    moon.castShadow = true; moon.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    Object.assign(moon.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 20, far: 320 });
    moon.shadow.bias = -0.0005; moon.shadow.normalBias = 0.08;
  }
  scene.add(moon, moon.target);
  const rimLight = new THREE.DirectionalLight(0xff8aa0, 0.35); rimLight.position.set(-60, -20, 60); scene.add(rimLight);

  // --- world
  const sky = createSky(); scene.add(sky);
  const hub = buildHub({ scene, mats, quality, collision });
  status.textContent = 'it is breathing';
  await new Promise((r) => setTimeout(r, 0));
  const below = buildBelow({ scene, mats, quality, collision });
  const distant = buildDistant({ scene, mats, quality });
  const heart = new Heart(scene, quality);
  const pencil = new PencilTentacle(scene, { quality, mats, ctx });
  const flock = new Congregation(scene, quality);
  const sword = new Sword(scene, { mats, ctx, collision });
  const eye = new SkyEye(scene, sky);
  const whispers = buildWhispers(scene, (x, z) => collision.groundAt(x, z, 50, 100));
  const rng = mulberry32(5);
  const spores = sporeField(quality.particles, { radius: 70, height: 110, yMin: -50, rng }); scene.add(spores);
  const spores2 = sporeField(Math.round(quality.particles * 0.3), { center: new THREE.Vector3(70, 0, -190), radius: 40, height: 80, yMin: -175, rng }); scene.add(spores2);
  const eyes = distantEyes(70, { radius: 520, rng }); scene.add(eyes);
  collision.addDynamic(() => flock.obstacles);

  // --- the Instagram portal: a self-twisting photo cube in the hub, a gallery inside it
  status.textContent = 'it is remembering';
  const photos = await loadPhotos('./gallery/');
  const photoCube = new PhotoCube(photos, { size: 0.9, gap: 0.05, seed: 7 });
  const shrine = buildCubeShrine({ scene, mats, collision, cube: photoCube });
  // --- the leaf portal: a ribbed arch on the hub's east rim with a living curtain of leaves
  const LEAF_SPOT = new THREE.Vector3(HUB_PORTAL.x, 0, HUB_PORTAL.z); LEAF_SPOT.y = hubFloor(LEAF_SPOT.x, LEAF_SPOT.z) ?? 0;
  const hubPortal = buildLeafPortal({ parent: scene, mats, collision, base: LEAF_SPOT, facing: Math.atan2(-LEAF_SPOT.x, -LEAF_SPOT.z), ground: hubFloor, glow: 0x3aff9a, seed: 3, detail: quality.detail, leaves: 230 });
  // --- the story portal: the stolen maroon sedan under a KEATLAND MOTORS sign
  const entrance = buildHubEntrance({ scene, collision, ground: hubFloor });
  const hubRealm = scene.children.filter((o) => !o.isLight && o !== sky);
  // the gallery, the jungle and the story realm + Works are built up front on desktop; phones build
  // each one only when you approach its portal (see ensureGallery / ensureJungle / ensureStory)
  let gallery = null, jungle = null, swarm = null, stalker = null, jAudio = null;
  const ensureGallery = () => { if (gallery) return gallery; gallery = buildGallery({ scene, mats, quality, collision, photos }); gallery.root.visible = realm === 'gallery'; return gallery; };
  const ensureJungle = () => {
    if (jungle) return jungle;
    jungle = buildJungle({ scene, mats, quality, collision }); jungle.root.visible = realm === 'jungle';
    swarm = new LeafSwarm(scene, Math.round(260 * quality.detail));
    stalker = new Stalker(scene, jungle);
    if (jAudio) { stalker.sounds = jAudio; stalker.onRush = () => { player.shake = 0.5; }; }
    return jungle;
  };
  let realm = 'hub';
  if (!lazy) { ensureGallery(); status.textContent = 'it is overgrowing'; await new Promise((r) => setTimeout(r, 0)); ensureJungle(); }
  const hubBg = scene.background, hubFog = scene.fog.color.clone();
  const jungleBg = new THREE.Color(0x020503), jungleFog = new THREE.Color(0x0a160c);
  const moonHome = moon.position.clone();
  const setRealm = (r) => {
    realm = r; const h = r === 'hub', jg = r === 'jungle', st = r === 'story', wk = r === 'works';
    hubRealm.forEach((o) => (o.visible = h)); if (gallery) gallery.root.visible = r === 'gallery'; if (jungle) jungle.root.visible = jg;
    sky.visible = !jg && !st && !wk; scene.background = jg ? jungleBg : hubBg; scene.fog.color.copy(jg ? jungleFog : hubFog);
    // in the jungle the "moon" is a green-gold sun far above the canopy; the canopy cuts it into dapples
    if (jg) { moon.position.copy(jungle.center).add(new THREE.Vector3(18, 70, -22)); moon.target.position.copy(jungle.center); moon.color.set(0xd8ffb0); }
    else { moon.position.copy(moonHome); moon.target.position.set(0, 0, 0); moon.color.set(0xa8c4ff); }
    moon.target.updateMatrixWorld();
    moon.intensity = h ? 0.55 : jg ? 1.25 : 0; rimLight.intensity = h ? 0.35 : jg ? 0.0 : 0.05; hemi.intensity = h ? 0.3 : jg ? 0.22 : 0.16;
    hemi.color.set(jg ? 0x4a7a4a : 0x3a4a5e); hemi.groundColor.set(jg ? 0x0a1206 : 0x1c0c12);
    if (!jg) FOLIAGE.uRustle.value.forEach((v) => (v.w = 0));
    // deactivate first, then activate (each realm saves and restores the shared renderer settings)
    if (!st) story?.setActive(false); if (!wk) works?.setActive(false);
    if (st) story?.setActive(true); if (wk) works?.setActive(true);
  };
  let story = null, works = null;
  const cubeStand = (() => {
    const b = shrine.group.position, d = new THREE.Vector3(L.spawn.x - b.x, 0, L.spawn.z - b.z).normalize();
    const p = b.clone().addScaledVector(d, 5.6); p.y = hubFloor(p.x, p.z) ?? 0; return p;
  })();

  // model registry slots (GLB overrides)
  registerSlot('sword', sword.swordG);
  registerSlot('heart', heart.group, [heart.body, heart.vessels]);
  flock.creatures.forEach((c) => registerSlot('creature:' + c.name, c.body));
  
  // --- player, audio, post, transitions
  const player = new Player(camera, collision, canvas);
  ctx.player = player;
  player.teleport(L.spawn.clone(), L.spawnYaw, 0.1);
  const audio = new AudioEngine({ voices: quality.voices }); ctx.audio = audio;
  jAudio = new JungleAudio(audio);
  if (stalker) { stalker.sounds = jAudio; stalker.onRush = () => { player.shake = 0.5; }; }
  const voice = new Voice(audio, { textEl: voiceText });
  const post = createPost(renderer, scene, camera, quality);
  post.setSize(innerWidth, innerHeight, pr);
  const transitions = new Transitions({ camera, player, post, audio, sky, below, heart, hub });
  // --- the story realm: Keatland Reception (Parts Two and Three), far away in the same scene
  let storyStyle = null;
  const ensureStory = () => {
    if (story) return story;
    story = buildStory({ scene, renderer, post, mats, quality, collision, audio, voice, lights: { moon, hemi, rimLight } });
    story.setActive(false); story.root.visible = false;
    registerSlot('character:moss', story.exterior.moss.group, [story.exterior.moss.body]);
    registerSlot('character:keatenHR', story.reception.keaten.group, [story.reception.keaten.body]);
    registerSlot('character:keatenBackrooms', story.back.keaten.group, [story.back.keaten.body]);
    registerSlot('character:dale', story.dale.fig.group, [story.dale.fig.body]);
    // --- the Catecholamine Works: through the steel door in the Backrooms (story Parts Four to Six)
    works = buildWorks({ scene, renderer, post, quality, collision, audio, voice, lights: { moon, hemi, rimLight }, transitions, player, camera });
    works.setActive(false); works.root.visible = false;
    // the story realm's art direction (toon shading, rims, alive props, eyes, speaker critters)
    storyStyle = restyleStory({ scene, story, works, collision, quality, keep: lazy ? Object.values(mats).filter((m) => m?.isMaterial) : [] });
    registerSlot('character:keatenWorks', works.cast.keaten.fig.group, [works.cast.keaten.fig.body]);
    registerSlot('character:daleWorks', works.cast.dale.fig.group, [works.cast.dale.fig.body]);
    registerSlot('character:worker', works.cast.worker.fig.group, [works.cast.worker.fig.body]);
    registerSlot('prop:drainStopper', works.factory.plug);
    registerSlot('prop:execChair', works.cast.office);
    registerSlot('prop:cjpPanel', works.factory.cjp);
    if (lazy) applyOverrides('./');
    return story;
  };
  registerSlot('story:car', entrance.car);
  if (!lazy) { status.textContent = 'it is parking'; await new Promise((r) => setTimeout(r, 0)); ensureStory(); }
  loadManifest('./').then(() => applyOverrides('./'));

  heart.onBeat = () => audio.heartbeat(0.7 + heart.excite);
  ctx.onSwordBurst = (attempts) => {
    audio.swordBurst(); player.shake = 0.9; heart.excite = 1; eye.wake(1); ctx.swordShock = 2.5;
    flock.startle(sword.base.clone().setY(2)); post.uniforms.uFlash.value = 0.12;
  };
  const cubeDist = () => { const c = shrine.center(); return Math.hypot(player.position.x - c.x, player.position.z - c.z); };
  const portalIn = () => { ensureGallery(); transitions.portalIn({ cube: photoCube, gallery, setRealm }); };
  const portalOut = () => transitions.portalOut({ exitCube: gallery.exitCube, cube: photoCube, gallery, standAt: cubeStand, setRealm });
  const jungleIn = () => { ensureJungle(); transitions.jungleIn({ portal: hubPortal, jungle, swarm, setRealm }); };
  const jungleOut = () => transitions.jungleOut({ jungle, portal: hubPortal, swarm, setRealm });
  const storyIn = () => { ensureStory(); transitions.storyIn({ entrance, story, setRealm }); };
  const storyOut = () => transitions.storyOut({ entrance, setRealm });
  const worksIn = () => transitions.worksIn({ story, works, setRealm });
  const worksOut = () => transitions.worksOut({ story, works, setRealm });
  const nearPortal = (P, d) => { const l = P.local(player.position); return Math.abs(l.side) < 3 && l.along > -1 && l.along < d; };
  const throughPortal = (P) => { const l = P.local(player.position); return Math.abs(l.side) < 1.6 && l.along < 0.9 && l.along > -0.6; };
  let aimed = null;
  const openPost = (f) => {
    if (document.pointerLockElement) document.exitPointerLock();
    window.open(f.postUrl, '_blank', 'noopener,noreferrer');
  };
  photoCube.onTwist = (dur) => {
    if (realm !== 'hub') return;
    const c = shrine.center(), d = camera.position.distanceTo(c);
    audio.cubeTwist(c, dur, Math.min(1, 6 / Math.max(1, d)));
  };
  // One source of truth for "what would E do here": the hint text, the E key and the touch ring all use
  // it, so the word on screen always matches the action that runs.
  const currentAction = () => {
    if (transitions.busy || !player.enabled) return null;
    const p = player.position;
    if (realm === 'gallery') { if (aimed) { const f = aimed; return { label: 'open', run: () => openPost(f) }; } return gallery.nearExit(p) ? { label: 'return', run: portalOut } : null; }
    if (realm === 'jungle') return nearPortal(jungle.exitPortal, 5) ? { label: 'return', run: jungleOut } : null;
    if (realm === 'story') { const h = story.hint(player); return h ? { label: h, run: () => { const r = story.interact(player, simTime); if (r === 'out') storyOut(); else if (r === 'works') worksIn(); } } : null; }
    if (realm === 'works') { const h = works.hint(player); return h ? { label: h, run: () => { if (works.interact(player) === 'out') worksOut(); } } : null; }
    if (sword.near) return { label: 'pull', run: () => sword.interact() };
    if (entrance.near(p)) return { label: 'get in', run: storyIn };
    if (cubeDist() < 6.5) return { label: 'enter', run: portalIn };
    if (nearPortal(hubPortal, 5)) return { label: 'enter', run: jungleIn };
    return null;
  };
  let lastAction = null, lastActionT = -9;
  player.onInteract = () => {
    if (transitions.busy) return;
    let a = currentAction();
    // touch: the ring stays lit for a short grace after the action goes out of range; honour a tap in it
    if (!a && lastAction && simTime - lastActionT < 0.45) a = lastAction;
    a?.run();
  };
  canvas.addEventListener('mousedown', () => { if (player.locked && aimed && !transitions.busy) openPost(aimed); });

  // --- enter
  let entered = false;
  const touchUI = touchMode ? new TouchControls({
    player,
    onInteract: () => player.onInteract(),
    onTap: (x, y) => { // tap a gallery photo to open it
      if (realm !== 'gallery' || transitions.busy || !entered) return;
      const f = gallery.pickAt(camera, new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1));
      if (f) openPost(f);
    },
  }) : null;
  const enter = () => {
    audio.start(); // inside the gesture: unlocks audio on iOS
    if (!entered) { entered = true; enterEl.classList.add('gone'); player.enabled = true; }
    if (touchMode) {
      if (touchUI) touchUI.enabled = true;
      const de = document.documentElement; (de.requestFullscreen || de.webkitRequestFullscreen)?.call(de, { navigationUI: 'hide' })?.catch?.(() => {});
    } else canvas.requestPointerLock?.();
  };
  enterEl.addEventListener('click', enter);
  if (touchMode) document.addEventListener('touchend', () => audio.started && audio.start(), { passive: true }); // re-resume after iOS interruptions
  canvas.addEventListener('click', () => { if (!touchMode && entered && !player.locked) canvas.requestPointerLock?.(); });

  const onResize = () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight); post.setSize(innerWidth, innerHeight, pr);
    touchUI?.reset();
  };
  addEventListener('resize', onResize);
  addEventListener('orientationchange', () => setTimeout(onResize, 120));
  window.visualViewport?.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { touchUI?.reset(); player.keys.clear(); } });

  await texturesReady();
  // compile shaders up front (for both realms) to avoid hitches when looking around or crossing over
  if (gallery) { setRealm('gallery'); renderer.compile(scene, camera); }
  if (jungle) { setRealm('jungle'); swarm.mesh.visible = true; renderer.compile(scene, camera); swarm.mesh.visible = false; }
  if (story) { setRealm('story'); renderer.compile(scene, camera); }
  if (works) { setRealm('works'); works.hold.group.visible = true; works.flood.surface.visible = true; renderer.compile(scene, camera); works.hold.group.visible = false; works.flood.surface.visible = false; }
  setRealm('hub'); renderer.compile(scene, camera);
  enterEl.classList.remove('loading');
  status.textContent = touchMode ? 'tap to enter' : 'click to enter';

  // --- simulation
  let simTime = 0;
  const fpsS = { frames: 0, acc: 0, fps: 0 };
  const inBelow = () => player.position.y < -60;
  function simulate(dt) {
    simTime += dt;
    const t = simTime;
    U.time.value = t;
    scene.fog.far = t;
    // thinner, darker air in the depths below the hub (camera-height driven)
    if (realm === 'jungle') scene.fog.near = 0.034;
    else if (realm === 'story') scene.fog.near = story.fogDensity;
    else if (realm === 'works') scene.fog.near = works.fogDensity;
    else { const b = THREE.MathUtils.smoothstep(-camera.position.y, 50, 110); scene.fog.near = THREE.MathUtils.lerp(0.015, 0.006, b); }
    if (quality.fogMul !== 1) scene.fog.near *= quality.fogMul; // phones: thicker air hides the shorter detail
    if (lazy && realm === 'hub' && entered && !transitions.busy) prebuild();
    playerUniform.value.copy(player.position);
    FOLIAGE.uPlayer.value.copy(player.position);
    if (!transitions.update(dt) && !window.__keatland?.freeCam) player.update(dt);
    heart.update(dt, t);
    hub.update(dt, t); below.update(dt, t); distant.update(dt, t);
    photoCube.update(dt, t); shrine.update(dt, t); gallery?.update(dt, t);
    hubPortal.update(dt, t);
    entrance.update(dt, t);
    if (realm === 'story') story.update(dt, t, player, camera, { entered, busy: transitions.busy });
    if (realm === 'works') works.update(dt, t, player, camera, { busy: transitions.busy });
    storyStyle?.update(dt, t, camera, realm);
    cullStory(dt);
    let snap = null;
    if (realm === 'jungle') { jungle.update(dt, t, player.position); if (entered) snap = stalker.update(dt, t, player, camera); }
    { const v = player.vel ? Math.hypot(player.vel.x, player.vel.z) : 0; const inLeaves = realm === 'jungle' ? Math.min(1, jungle.coverAt(player.position.x, player.position.z)) : 0; jAudio.update(camera, { inJungle: realm === 'jungle', s: snap, playerRustle: Math.min(1, v / 4) * (0.3 + 0.7 * inLeaves) }); }
    if (entered && !transitions.busy) voice.update(t, realm, camera);
    flock.update(dt, t, ctx);
    pencil.update(dt, t, camera);
    sword.update(dt, t, player.position);
    eye.update(dt, t, camera);
    whispers.update(dt, transitions.busy ? null : player.position);
    ctx.swordShock = Math.max(0, ctx.swordShock - dt);
    post.uniforms.uFlash.value = transitions.busy ? post.uniforms.uFlash.value : Math.max(0, post.uniforms.uFlash.value - dt * 0.3);
    sky.position.copy(camera.position);
    // triggers
    if (!transitions.busy && player.enabled) {
      const p = player.position;
      if (realm === 'gallery') { if (gallery.touchingExit(p)) portalOut(); }
      else if (realm === 'jungle') { if (throughPortal(jungle.exitPortal)) jungleOut(); }
      else if (realm === 'story') { /* the way out is the lectern or the EXIT door (interact) */ }
      else if (realm === 'works') { /* the way out is the foot of the spiral stair (interact) */ }
      else if (throughPortal(hubPortal)) jungleIn();
      else if (entrance.near(p, 0.8)) storyIn();
      else if (p.z < L.mawTrigger && Math.abs(p.x) < 3.6 && p.y > -10) transitions.swallow();
      else if (below.doorTrigger(p)) transitions.fold();
      else if (cubeDist() < 1.9) portalIn();
    }
    aimed = realm === 'gallery' && !transitions.busy ? gallery.pick(camera) : null;
    const act = entered ? currentAction() : null;
    if (act) { lastAction = act; lastActionT = simTime; }
    const hint = act?.label ?? '';
    if (hint) hintText.textContent = hint;
    hintEl.classList.toggle('on', !!hint);
    touchUI?.setAction(hint, dt);
    const inStory = realm === 'story' || realm === 'works';
    audio.update(camera, { ritual: inStory ? 0 : U.ritual.value, pencilTip: pencil.tip, pencilDraw: inStory ? 0 : pencil.drawingIntensity, below: inBelow() || realm === 'gallery', quiet: inStory });
    if (realm !== 'story') story?.sAudio.update(dt, { on: false });
    if (realm !== 'works') works?.wAudio.update(dt, { on: false });
  }

  // phones: build a zone when you walk towards its portal (deferred out of the frame; transitions also
  // build on demand if you get there first)
  let building = false;
  function prebuild() {
    if (building) return;
    const p = player.position;
    const job = !gallery && cubeDist() < 24 ? ensureGallery
      : !jungle && Math.hypot(p.x - LEAF_SPOT.x, p.z - LEAF_SPOT.z) < 26 ? ensureJungle
      : !story && entrance.near(p, 26) ? ensureStory : null;
    if (!job) return;
    building = true; setTimeout(() => { try { job(); } finally { building = false; } }, 0);
  }

  // phones: distance culling in the story realm (the whole Reception / Backrooms / lot dressing is
  // otherwise drawn at once; fog hides the cut). Culled meshes move to layer 1, which the camera does
  // not render, so story code that toggles .visible is never fought.
  const cull = { list: null, t: 0, refresh: 0, v: new THREE.Vector3() };
  function cullStory(dt) {
    if (!quality.mobile || realm !== 'story' || !story) return;
    cull.t -= dt; cull.refresh -= dt; if (cull.t > 0) return; cull.t = 0.25;
    if (!cull.list || cull.refresh <= 0) {
      cull.refresh = 5; cull.list = [];
      story.root.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry) { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); cull.list.push(o); } });
    }
    const c = camera.position, D2 = story.state?.zone === 'backrooms' ? 30 : 48;
    for (const o of cull.list) {
      const bs = o.geometry.boundingSphere; if (!bs) continue;
      cull.v.copy(bs.center).applyMatrix4(o.matrixWorld);
      const far = cull.v.distanceTo(c) - bs.radius * o.matrixWorld.getMaxScaleOnAxis() > D2;
      if (far) o.layers.set(1); else o.layers.set(0);
    }
  }

  // adaptive resolution (phones): step the render scale down while frames stay slower than ~33 ms,
  // and back up when there is headroom
  const ad = { acc: 0, n: 0, good: 0 };
  function adapt(rawDt) {
    if (!quality.adaptive || document.hidden || rawDt > 0.25) return;
    ad.acc += rawDt; ad.n++;
    if (ad.acc < 1.5) return;
    const avg = ad.acc / ad.n; ad.acc = 0; ad.n = 0;
    let next = pr;
    if (avg > 0.034) { next = Math.max(quality.minPixelRatio ?? 0.6, pr - 0.15); ad.good = 0; }
    else if (avg < 0.022) { if (++ad.good >= 3) { next = Math.min(prMax, pr + 0.1); ad.good = 0; } }
    else ad.good = 0;
    if (Math.abs(next - pr) > 1e-3) { pr = next; renderer.setPixelRatio(pr); post.setSize(innerWidth, innerHeight, pr); }
  }

  const clock = new THREE.Timer();
  let paused = false;
  function frame() {
    requestAnimationFrame(frame);
    clock.update(); const raw = clock.getDelta(), dt = Math.min(0.05, raw);
    if (paused) return;
    simulate(dt);
    renderer.info.reset();
    post.render(simTime);
    adapt(raw);
    fpsS.frames++; const now = performance.now(); if (!fpsS.t0) fpsS.t0 = now; if (now - fpsS.t0 > 1000) { fpsS.fps = fpsS.frames * 1000 / (now - fpsS.t0); fpsS.frames = 0; fpsS.t0 = now; }
  }
  frame();

  // --- debug / automation hook (used by tools/shoot.mjs)
  window.__keatland = {
    get storyStyle() { return storyStyle; },
    ready: true, quality, slots: listSlots(),
    get fps() { return fpsS.fps; },
    get state() { return { pos: player.position.toArray(), yaw: player.yaw, pitch: player.pitch, phase: flock.phase, pencil: pencil.state, eye: eye.state, swordAttempts: sword.attempts, transition: transitions.active?.name ?? null, t: simTime }; },
    enter() { if (!entered) { entered = true; enterEl.classList.add('gone'); player.enabled = true; } },
    teleport(x, y, z, yaw = player.yaw, pitch = 0) { player.teleport(new THREE.Vector3(x, y, z), yaw, pitch); },
    look(yaw, pitch) { player.yaw = yaw; player.pitch = pitch; player.applyCamera(0); },
    advance(seconds, step = 1 / 30) { for (let s = 0; s < seconds; s += step) simulate(step); },
    setPhase(p) { flock.setPhase(p); },
    pencilState(s, dur = 20) { pencil.state = s; pencil.stateT = 0; pencil.stateDur = dur; },
    swordPull() { return sword.interact(); },
    swallow() { transitions.swallow(); }, fold() { transitions.fold(); },
    eyeWake() { eye.wake(1); },
    portal() { portalIn(); }, portalBack() { portalOut(); },
    get story() { return story; }, entrance, storyIn() { storyIn(); }, storyOut() { storyOut(); },
    ensureZones() { ensureGallery(); ensureJungle(); ensureStory(); }, get built() { return { gallery: !!gallery, jungle: !!jungle, story: !!story, works: !!works }; },
    get pixelRatio() { return pr; }, touchUI, get action() { return currentAction()?.label ?? ''; },
    /** teleport inside the story realm, in its local coordinates (see src/story/layout.js) */
    get works() { return works; }, worksIn() { worksIn(); }, worksOut() { worksOut(); },
    /** teleport inside the Works, local coords (src/zones/works/layout.js); `label` jumps the scene there */
    worksGo(x, z, yaw = 0, pitch = 0, label = null) { ensureStory(); if (realm !== 'works') { setRealm('works'); works.reset(); } if (label) works.jump(label); player.teleport(new THREE.Vector3(x, 0, z).add(WORKS_ORIGIN).setY(WORKS_ORIGIN.y + 4), yaw, pitch); },
    storyGo(x, z, yaw = 0, pitch = 0) { ensureStory(); if (realm !== 'story') { setRealm('story'); story.reset(); } player.teleport(new THREE.Vector3(x, 0, z).add(STORY_ORIGIN).setY(STORY_ORIGIN.y + 5), yaw, pitch); },
    get jungle() { return ensureJungle(); }, get stalker() { ensureJungle(); return stalker; }, voice, hubPortal, jungleIn() { jungleIn(); }, jungleOut() { jungleOut(); },
    voiceSay(say) { const l = say ? voice.lines.find((x) => x.say === say) : voice._pick(realm); voice.speak(l, camera); return l?.text; },
    stalkerState(s, dur) { stalker.setState(s, dur); },
    get realm() { return realm; }, setRealm, photoCube, get gallery() { return ensureGallery(); }, cubeStand, photos: photos.map((p) => ({ caption: p.caption, postUrl: p.postUrl, placeholder: p.placeholder })),
    cubeCenter() { return shrine.center().toArray(); },
    aimed() { return aimed ? { index: aimed.index, postUrl: aimed.postUrl } : null; },
    pause(v = true) { paused = v; clock.update(); },
    renderOnce() { renderer.info.reset(); post.render(simTime); },
    setQuality(q) { if (PRESETS[q]) { const u = new URL(location.href); u.searchParams.set('q', q); location.href = u.toString(); } },
    info() { return renderer.info.render; },
    revealWhispers() { whispers.revealAll(); },
    tip() { return pencil.tip.toArray(); },
    swordBase() { return sword.base.toArray(); },
    post,
    scene, camera, renderer,
  };
}

boot().catch((e) => { console.error(e); status.textContent = 'something in the dark went wrong'; });
