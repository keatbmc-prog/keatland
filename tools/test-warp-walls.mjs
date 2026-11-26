import { createRequire } from 'module';
const require = createRequire('/workspace/keatland/tests/');
const { chromium } = require('playwright');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4180/?q=high');
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 400000 });
await page.evaluate(() => { const K = window.__keatland; K.enter(); document.getElementById('enter')?.remove(); K.pause(true); });
const res = [];
// walk sideways into Backrooms walls at several spots, with and without the warp-aware collision
for (const [x, z, yaw] of [[12.5, -63, 0], [12.5, -57, 0], [26, -90.5, -Math.PI / 2], [12.5, -70, 0]]) {
  for (const on of [true, false]) {
    for (const key of ['KeyA', 'KeyD']) {
      await page.evaluate(([x, z, yaw, on]) => { const K = window.__keatland; K.storyGo(x, z, yaw, 0); K.advance(0.2); window.__ws = window.__ws || K.collisionShift; }, [x, z, yaw, on]);
      const shiftOn = await page.evaluate((on) => { const K = window.__keatland; const c = K.collision; if (!c) return 'nocol'; if (!window.__savedShift) window.__savedShift = c.wallShift; c.wallShift = on ? window.__savedShift : null; return !!c.wallShift; }, on);
      await page.keyboard.down(key); await page.evaluate(() => window.__keatland.advance(2.0)); await page.keyboard.up(key);
      const st = await page.evaluate(() => { const K = window.__keatland; const O = K.story.root.position; const p = K.state.pos; return [p[0] - O.x, p[2] - O.z].map((v) => +v.toFixed(3)); });
      res.push({ at: [x, z], key, shift: shiftOn, end: st });
    }
  }
}
// walk the loop corridor end to end through its doors (with the warp-aware collision)
await page.evaluate(() => { const K = window.__keatland; K.collision.wallShift = window.__savedShift; K.storyGo(12.5, -49.2, 0, 0); K.advance(0.2); });
await page.keyboard.down('KeyW'); await page.evaluate(() => window.__keatland.advance(6)); await page.keyboard.up('KeyW');
const walked = await page.evaluate(() => { const K = window.__keatland; const O = K.story.root.position; const p = K.state.pos; return [p[0] - O.x, p[2] - O.z].map((v) => +v.toFixed(2)); });
console.log(JSON.stringify({ res, walked, errors }));
await browser.close();
