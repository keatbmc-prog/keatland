import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire('/workspace/keatland/tests/');
const { chromium, devices } = require('playwright');
const MODE = process.argv[2] || 'desktop', OUT = process.argv[3] || '/tmp/fp', URL = process.argv[4] || 'http://localhost:4180/';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const land = { ...iphone, viewport: { width: iphone.viewport.height, height: iphone.viewport.width }, screen: { width: iphone.screen.height, height: iphone.screen.width } };
const context = await browser.newContext(MODE === 'mobile' ? iphone : MODE === 'land' ? land : { viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL);
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 400000 });
const ev = (f, a) => page.evaluate(f, a);
if (MODE !== 'desktop') { await page.tap('#enter'); await page.waitForTimeout(200); }
await ev(() => { const K = window.__keatland; K.enter(); K.pause(true); }); await ev(() => { const e = document.querySelector('#enter'); if (e) e.style.display = 'none'; });
const shot = async (n) => { await ev(() => window.__keatland.renderOnce()); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const info = async () => ev(() => { const K = window.__keatland; K.renderOnce(); const i = K.renderer.info.render; return { calls: i.calls, tris: i.triangles }; });
const res = {};
const sel = (process.argv[5] || 'hub,story,down,swing,ring').split(',');
// hub, neutral
await ev(() => { const K = window.__keatland; K.teleport(K.cubeStand.x, K.cubeStand.y, K.cubeStand.z, 0, 0); const c = K.cubeCenter(); const p = K.camera.position; K.look(Math.atan2(-(c[0] - p.x), -(c[2] - p.z)) + 0.35, 0.02); K.advance(1.5); });
res.hubWith = await info();
await ev(() => { const K = window.__keatland; K.fp.handRoot.visible = false; K.fp.bodyRoot.visible = false; });
res.hubWithout = await info();
await ev(() => window.__keatland.advance(0.1));
if (sel.includes('hub')) await shot(MODE === 'mobile' ? 'fp05-mobile-hand' : MODE === 'land' ? 'fp06-mobile-landscape' : 'fp01-hub-hand');
if (MODE !== 'desktop') { res.ring = await ev(() => { const a = document.querySelector('#touch-ui .t-act'); return { on: a.classList.contains('on'), label: a.textContent }; }); }
// story
if (sel.includes('story')) { await ev(() => { const K = window.__keatland; K.storyGo(2.2, -6.2, -0.22, 0.02); K.advance(1.5); }); await shot(MODE === 'mobile' ? 'm-fp02-story-hand' : 'fp02-story-hand'); }
// look down while walking
if (sel.includes('down')) {
  await ev(() => { const K = window.__keatland; K.storyGo(-6, 6, 2.6, -1.25); K.advance(0.8); });
  await shot(MODE === 'mobile' ? 'm-fp03-look-down' : 'fp03-look-down');
  await page.keyboard.down('KeyW'); await ev(() => window.__keatland.advance(0.55)); await page.keyboard.up('KeyW');
  await ev(() => { const K = window.__keatland; K.look(K.state.yaw, -1.35); K.fp.update(0); });
  await shot(MODE === 'mobile' ? 'm-fp03c-look-down-walking' : 'fp03c-look-down-walking');
  await ev(() => { const K = window.__keatland; K.look(K.state.yaw, -1.45); K.advance(0.05); });
  await shot(MODE === 'mobile' ? 'm-fp03b-straight-down' : 'fp03b-straight-down');
}
// the reach at the sword
if (sel.includes('swing')) {
  await ev(() => { const K = window.__keatland; K.setRealm('hub'); const b = K.swordBase(); K.teleport(b[0] + 1.5, b[1], b[2] + 1.5, Math.atan2(1.5, 1.5), -0.25); K.advance(1); });
  res.swordAction = await ev(() => window.__keatland.action);
  await page.keyboard.press('KeyE'); await ev(() => window.__keatland.advance(0.26));
  res.reachT = await ev(() => window.__keatland.fp.reachT);
  await shot(MODE === 'mobile' ? 'm-fp04-interact-swing' : 'fp04-interact-swing');
}
res.errors = errors;
console.log(JSON.stringify(res, null, 1));
await browser.close();
