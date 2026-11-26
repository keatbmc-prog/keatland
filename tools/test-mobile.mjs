// Mobile (and desktop) verification: zones load, renderer.info per zone, touch move/look/interact.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/workspace/keatland/tests/');
const { chromium, devices } = require('playwright');
const MODE = process.argv[2] || 'mobile', OUT = process.argv[3] || '/tmp/mt', URL = process.argv[4] || 'http://localhost:4180/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const context = await browser.newContext(MODE === 'mobile' ? iphone : { viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
const t0 = Date.now();
await page.goto(URL);
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 400000 });
const out = { mode: MODE, loadS: (Date.now() - t0) / 1000 };
out.boot = await page.evaluate(() => { const K = window.__keatland; return { q: K.quality.name, touch: K.quality.touch, built: K.built, pr: K.pixelRatio, status: document.getElementById('enter-status').textContent }; });
const cdp = MODE === 'mobile' ? await context.newCDPSession(page) : null;
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
const ev = (f, a) => page.evaluate(f, a);
const T = {};
if (MODE === 'mobile') {
  await page.tap('#enter'); await page.waitForTimeout(300);
  T.entered = await ev(() => { const K = window.__keatland; return { gone: document.getElementById('enter').classList.contains('gone'), ui: !!K.touchUI?.enabled }; });
  await ev(() => { const K = window.__keatland; K.pause(true); K.teleport(...K.state.pos, 0, 0); });
  // joystick: thumb lands at (80, 520), pushes up 50 px; then run
  const p0 = await ev(() => window.__keatland.state.pos);
  await touch('touchStart', [[80, 520, 1]]); for (let i = 1; i <= 5; i++) await touch('touchMove', [[80, 520 - i * 10, 1]]);
  T.mv = await ev(() => { const K = window.__keatland; return [K.player?.touch?.mv?.y ?? null]; });
  await ev(() => window.__keatland.advance(1));
  const p1 = await ev(() => window.__keatland.state.pos);
  for (let i = 1; i <= 4; i++) await touch('touchMove', [[80, 470 - i * 12, 1]]);
  await ev(() => window.__keatland.advance(1));
  const p2 = await ev(() => window.__keatland.state.pos);
  T.walk = Math.hypot(p1[0] - p0[0], p1[2] - p0[2]).toFixed(2); T.run = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]).toFixed(2);
  // second finger looks while the first still holds the joystick (multi-touch)
  const y0 = await ev(() => window.__keatland.state.yaw);
  await touch('touchMove', [[80, 422, 1], [300, 300, 2]]).catch(() => {});
  await touch('touchStart', [[80, 422, 1], [300, 300, 2]]); for (let i = 1; i <= 6; i++) await touch('touchMove', [[80, 422, 1], [300 - i * 10, 300 + i * 4, 2]]);
  await ev(() => window.__keatland.advance(0.5));
  const y1 = await ev(() => window.__keatland.state);
  T.look = { dyaw: (y1.yaw - y0).toFixed(3), pitch: y1.pitch.toFixed(3) };
  await touch('touchEnd', []);
  await ev(() => window.__keatland.advance(0.3));
  T.released = await ev(() => { const K = window.__keatland; return { mv: K.touchUI ? [K.touchUI.player.touch.mv.x, K.touchUI.player.touch.mv.y] : null }; });
  // pitch never flips: drag far down
  await touch('touchStart', [[300, 100, 3]]); for (let i = 1; i <= 10; i++) await touch('touchMove', [[300, 100 + i * 60, 3]]); await touch('touchEnd', []);
  await ev(() => window.__keatland.advance(0.5)); T.pitchClamp = (await ev(() => window.__keatland.state.pitch)).toFixed(3);
}
// interact ring taps: returns {label, visible, rect} then taps its centre
const ring = async () => ev(() => { const a = document.querySelector('#touch-ui .t-act'); const r = a.getBoundingClientRect(); return { on: a.classList.contains('on'), label: a.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2, op: getComputedStyle(a).opacity }; });
const tapRing = async () => { const r = await ring(); await touch('touchStart', [[r.x, r.y, 9]]); await touch('touchEnd', []); return r; };
const info = async () => ev(() => { const K = window.__keatland; K.renderOnce(); const i = K.renderer.info; return { calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, progs: i.programs.length }; });
const zones = {};
const shot = async (n) => { await ev(() => window.__keatland.renderOnce()); if (MODE === 'mobile') await page.screenshot({ path: `${OUT}/${n}.png` }); else await page.screenshot({ path: `${OUT}/d-${n}.png` }); };
await ev(() => { const K = window.__keatland; K.enter(); K.pause(true); K.ensureZones(); });
// hub
await ev(() => { const K = window.__keatland; K.setRealm('hub'); K.teleport(K.cubeStand.x, K.cubeStand.y, K.cubeStand.z, 0, 0); const c = K.cubeCenter(); const p = K.camera.position; K.look(Math.atan2(-(c[0] - p.x), -(c[2] - p.z)), 0.05); K.advance(1); });
zones.hub = await info(); await shot('m01-hub-cube');
if (MODE === 'mobile') { const r = await ring(); T.hubRing = r; const before = await ev(() => window.__keatland.state.transition); await tapRing(); await ev(() => window.__keatland.advance(0.1)); T.hubTap = { before, after: await ev(() => window.__keatland.state.transition) }; await ev(() => window.__keatland.advance(9)); T.afterPortal = await ev(() => window.__keatland.realm); }
// gallery
await ev(() => { const K = window.__keatland; if (K.realm !== 'gallery') { K.portal(); K.advance(9); } const f = K.gallery.frames[1]; K.teleport(f.stand.x, f.stand.y, f.stand.z, 0, 0); const p = K.camera.position; K.look(Math.atan2(-(f.center.x - p.x), -(f.center.z - p.z)), Math.atan2(f.center.y - p.y, Math.hypot(f.center.x - p.x, f.center.z - p.z))); K.advance(0.3); });
zones.gallery = await info(); T.galleryRealm = await ev(() => window.__keatland.realm);
if (MODE === 'mobile') {
  await shot('m02-gallery-photo');
  // tap the photo itself (right half, off-centre) -> opens its post
  const pt = await ev(() => { const K = window.__keatland; const f = K.gallery.frames[1]; const v = f.center.clone().project(K.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; });
  await touch('touchStart', [[Math.max(pt[0], 230), pt[1], 4]]); await touch('touchEnd', []);
  T.photoTap = await ev(() => window.__opened.slice());
  T.galleryRing = await ring(); await tapRing(); T.ringOpen = await ev(() => window.__opened.length);
}
// jungle
await ev(() => { const K = window.__keatland; K.portalBack(); K.advance(8); K.jungleIn(); K.advance(8); });
zones.jungle = await info(); T.jungleRealm = await ev(() => window.__keatland.realm); if (MODE === 'mobile') await shot('m03-jungle');
// story
const story = [['lot', [2.2, -6.2, -0.22, 0]], ['reception', [0, -18, 0, 0]], ['backrooms', [12.5, -49.2, 0, 0]]];
for (const [n, a] of story) { await ev((a) => { const K = window.__keatland; K.storyGo(...a); K.advance(1); }, a); zones['story-' + n] = await info(); }
await ev(() => { const K = window.__keatland; K.storyGo(2.2, -6.2, -0.22, 0); K.advance(1); });
if (MODE === 'mobile') await shot('m04-story-lot');
// valet lectern: walk up, the ring lights 'valet', tap it -> the story-out ride starts
await ev(() => { const K = window.__keatland; K.storyGo(3.4, -9.4, 0, 0); K.advance(0.5); });
if (MODE === 'mobile') { await shot('m05-lectern-ring'); T.lecternRing = await ring(); await tapRing(); await ev(() => window.__keatland.advance(0.1)); T.lecternTap = await ev(() => window.__keatland.state.transition); await ev(() => window.__keatland.advance(8)); T.afterLectern = await ev(() => window.__keatland.realm); }
// works
await ev(() => { const K = window.__keatland; K.worksGo(23, -28.6, Math.atan2(23, -28.6), -0.05); K.advance(1); });
zones.works = await info(); if (MODE === 'mobile') await shot('m06-works');
out.zones = zones; out.touch = T; out.errors = errors; out.pr = await ev(() => window.__keatland.pixelRatio);
fs.writeFileSync(`${OUT}/${MODE}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await browser.close();
