// Photos check: every cube sticker and every gallery frame shows a distinct photo; taps/clicks open the right post.
//   node tools/test-photos.mjs [desktop|mobile] [outDir] [url]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/workspace/keatland/tests/');
const { chromium, devices } = require('playwright');
const MODE = process.argv[2] || 'desktop', OUT = process.argv[3] || '/tmp/gt', URL = process.argv[4] || 'http://localhost:4180/';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const context = await browser.newContext(MODE === 'mobile' ? iphone : { viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.addInitScript(() => { window.__opened = []; window.open = (u) => { window.__opened.push(u); return null; }; });
await page.goto(URL);
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 400000 });
const ev = (f, a) => page.evaluate(f, a);
const cdp = MODE === 'mobile' ? await context.newCDPSession(page) : null;
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
if (MODE === 'mobile') { await page.tap('#enter'); await page.waitForTimeout(200); }
await ev(() => { const K = window.__keatland; K.enter(); K.pause(true); const e = document.getElementById('enter'); if (e) e.style.display = 'none'; });
const shot = async (n) => { await ev(() => window.__keatland.renderOnce()); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const info = () => ev(() => { const K = window.__keatland; K.renderOnce(); const i = K.renderer.info.render; return { calls: i.calls, tris: i.triangles }; });
const R = {};
R.photos = await ev(() => { const P = window.__keatland.photos; return { n: P.length, uniquePosts: new Set(P.map((p) => p.postUrl)).size, placeholders: P.filter((p) => p.placeholder).length }; });
// the cube: all 54 stickers distinct, now and after a long run of twists and photo wipes (checked every 0.5 s)
const cubeCheck = () => ev(() => { const K = window.__keatland, C = K.photoCube; const ids = C.stickers.map((s) => s.userData.photo); const pending = C.wipes.map((w) => w.idx);
  return { stickers: ids.length, unique: new Set(ids).size, uniqueWithIncoming: new Set([...ids.filter((id, i) => !C.wipes.some((w) => w.s === C.stickers[i])), ...pending]).size + C.wipes.filter((w) => w.from !== undefined).length - C.wipes.length }; });
R.cubeStart = await cubeCheck();
await ev(() => { const K = window.__keatland; K.teleport(K.cubeStand.x, K.cubeStand.y, K.cubeStand.z, 0, 0); const c = K.cubeCenter(); const p = K.camera.position; K.look(Math.atan2(-(c[0] - p.x), -(c[2] - p.z)), 0.05); K.advance(1); });
let worst = 54, seen = new Set();
for (let k = 0; k < 60; k++) { const c = await ev(() => { const K = window.__keatland, C = K.photoCube; K.advance(0.5); const ids = C.stickers.map((s) => s.userData.photo); return { u: new Set(ids).size, ids }; }); worst = Math.min(worst, c.u); c.ids.forEach((i) => seen.add(i)); }
R.cubeAfter30s = { minUniqueStickers: worst, photosSeenOnCube: seen.size };
R.hub = await info();
if (MODE === 'desktop') await shot('g01-hub-cube'); else await shot('g01m-hub-cube');
// the gallery
await ev(() => { const K = window.__keatland; K.portal(); K.advance(9); });
R.gallery = await ev(() => { const K = window.__keatland, G = K.gallery; const urls = G.frames.map((f) => f.postUrl); return { realm: K.realm, frames: G.frames.length, uniqueFramePosts: new Set(urls).size, uniqueTextures: new Set(G.frames.map((f) => f.photo.material.uniforms.uMap.value.uuid)).size, radius: +G.radius.toFixed(1), exitCubeUnique: new Set(G.exitCube.stickers.map((s) => s.userData.photo)).size }; });
R.galleryArrival = await info();
// wide view from the plinth side, looking across at both tiers
await ev(() => { const K = window.__keatland, G = K.gallery; const f = G.frames[5], c = f.center; const p0 = K.state.pos; const q = c.clone().addScaledVector(f.normal, 11); K.teleport(q.x, p0[1], q.z, 0, 0); const p = K.camera.position; K.look(Math.atan2(-(c.x - p.x), -(c.z - p.z)), 0.12); K.advance(0.4); });
R.galleryWide = await info();
await shot(MODE === 'desktop' ? 'g02-gallery-wide' : 'g03-mobile-gallery');
// click / tap a lower-tier and an upper-tier piece -> opens that piece's own post
R.open = [];
for (const idx of [7, 7 + Math.ceil(R.gallery.frames / 2)]) {
  const exp = await ev((idx) => { const K = window.__keatland, f = K.gallery.frames[idx]; K.teleport(f.stand.x, f.stand.y, f.stand.z, 0, 0); const p = K.camera.position; K.look(Math.atan2(-(f.center.x - p.x), -(f.center.z - p.z)), Math.atan2(f.center.y - p.y, Math.hypot(f.center.x - p.x, f.center.z - p.z))); K.advance(0.3); K.renderOnce(); return f.postUrl; }, idx);
  const before = await ev(() => window.__opened.length);
  if (MODE === 'mobile') {
    const pt = await ev((idx) => { const K = window.__keatland; const f = K.gallery.frames[idx]; const v = f.center.clone().project(K.camera); return [(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]; }, idx);
    const tx = Math.max(pt[0] + 20, 230), ty = pt[1]; // tap the right half of the screen (the left half is the joystick)
    R['tap' + idx] = await ev(([x, y]) => { const K = window.__keatland; return K.gallery.pickAt(K.camera, { x: (x / innerWidth) * 2 - 1, y: -(y / innerHeight) * 2 + 1 })?.index ?? null; }, [tx, ty]);
    await touch('touchStart', [[tx, ty, 4]]); await touch('touchEnd', []);
  } else { await ev(() => { const K = window.__keatland; const f = K.gallery.pick(K.camera); if (f) window.open(f.postUrl, '_blank'); }); }
  const got = await ev((b) => window.__opened.slice(b), before);
  R.open.push({ idx, ok: got.length === 1 && got[0] === exp, got: got[0]?.slice(-16), exp: exp.slice(-16) });
  if (idx === 7 + Math.ceil(R.gallery.frames / 2)) await shot(MODE === 'desktop' ? 'g04-gallery-upper-piece' : 'g05-mobile-upper-piece');
}
R.errors = errors;
console.log(JSON.stringify(R, null, 1));
await browser.close();
