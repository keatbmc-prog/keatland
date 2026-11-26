// Every interactable via the touch ring: walk up, the ring lights with the same word E would use, tap it.
import { createRequire } from 'module';
const require = createRequire('/workspace/keatland/tests/');
const { chromium, devices } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const context = await browser.newContext(iphone); const page = await context.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(process.argv[2] || 'http://localhost:4180/');
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 400000 });
const cdp = await context.newCDPSession(page);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y, id]) => ({ x, y, id })) });
const ev = (f, a) => page.evaluate(f, a);
await page.tap('#enter'); await page.waitForTimeout(200);
await ev(() => { const K = window.__keatland; K.pause(true); K.ensureZones(); });
const ring = () => ev(() => { const a = document.querySelector('#touch-ui .t-act'); const r = a.getBoundingClientRect(); return { on: a.classList.contains('on'), label: a.textContent, x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
const res = [];
const check = async (name, setup, effect) => {
  await ev(setup); await ev(() => window.__keatland.advance(0.4));
  const r = await ring(); const action = await ev(() => window.__keatland.action);
  // tap slightly off-centre (thumbs are imprecise) and hold a little like a real tap
  await touch('touchStart', [[r.x + 20, r.y + 14, 7]]); await page.waitForTimeout(60); await touch('touchEnd', []);
  await ev(() => window.__keatland.advance(0.15));
  const e = await ev(effect);
  res.push({ name, ringOn: r.on, ringLabel: r.label, eAction: action, effect: e });
  await ev(() => { const K = window.__keatland; K.advance(10); });
};
await check('sword', () => { const K = window.__keatland; const b = K.swordBase(); K.setRealm('hub'); K.teleport(b[0] + 1.6, b[1], b[2] + 1.6, Math.atan2(1.6, 1.6), -0.3); }, () => window.__keatland.state.swordAttempts);
await check('photo cube', () => { const K = window.__keatland; K.setRealm('hub'); K.teleport(K.cubeStand.x, K.cubeStand.y, K.cubeStand.z, 0, 0); }, () => window.__keatland.state.transition);
await check('stolen car', () => { const K = window.__keatland; K.portalBack?.(); K.advance(8); K.setRealm('hub'); const d = K.entrance.doorPos; K.teleport(d.x + 1.2, d.y, d.z, 0, 0); }, () => window.__keatland.state.transition);
await check('valet lectern', () => { const K = window.__keatland; K.storyGo(3.4, -9.4, 0, 0); }, () => window.__keatland.state.transition);
const bd = (k) => `const K = window.__keatland; const p = K.story.back.${k}; K.storyGo(p.x, p.z + 0.0, 0, 0);`;
await check('FREEDOMLAND door', new Function(bd('freedomDoor')), () => window.__keatland.story.yk?.state ?? JSON.stringify(Object.keys(window.__keatland.story.yk)));
await check('EXIT door', new Function(bd('exitDoor')), () => window.__keatland.state.transition);
await check('Works door', new Function(bd('worksDoor')), () => window.__keatland.state.transition);
await ev(() => { const K = window.__keatland; for (let i = 0; i < 40 && K.state.transition; i++) K.advance(1); });
await check('Works stair (way out)', () => { const K = window.__keatland; K.worksGo(21.6, -30.8, 0, 0); }, () => window.__keatland.state.transition);
// a tap on the ring while nothing is interactable does nothing (and the ring is hidden)
await ev(() => { const K = window.__keatland; K.setRealm('hub'); K.teleport(0, 5, 0, 0, 0); K.advance(1); });
const idle = await ring(); const tr0 = await ev(() => window.__keatland.state.transition);
await touch('touchStart', [[idle.x, idle.y, 8]]); for (let i = 1; i <= 4; i++) await touch('touchMove', [[idle.x - i * 20, idle.y, 8]]); await touch('touchEnd', []);
res.push({ name: 'idle ring tap = look drag', ringOn: idle.on, transition: [tr0, await ev(() => window.__keatland.state.transition)] });
console.log(JSON.stringify({ res, errors }, null, 1));
await browser.close();
