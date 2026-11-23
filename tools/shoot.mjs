// Verification + beauty shots. Serves nothing itself: run a static server on dist/ first, e.g.
//   (cd dist && python3 -m http.server 4180) & node tools/shoot.mjs [filter] [--w=1280 --h=720 --q=high]
// Uses headless Chromium with SwiftShader WebGL. Each view scripts the world via window.__keatland.
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PW_PATH || '/workspace/keatland/tests/');
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));
const W = +(args.w || 1280), H = +(args.h || 720), Q = args.q || 'high', BASE = args.url || 'http://localhost:4180/';
const OUT = args.out || 'screenshots';
fs.mkdirSync(OUT, { recursive: true });

const V = [
  ['01-entrance', `K.teleport(0,0,25,0,0.12); K.advance(6);`],
  ['02-architecture-wide', `K.advance(4); K.free(44,30,86, 0,26,-14);`],
  ['03-architecture-below', `K.advance(2); K.free(-70,-55,70, 0,10,0);`],
  ['04-pencil-tentacle', `K.pencilState('draw', 60); K.advance(14); K.teleport(-10,0,16, 0,0); K.lookAtPoint(K.pencilTip(), -0.1);`],
  ['05-ritual-chant', `K.setPhase('gather'); K.advance(16); K.setPhase('chant'); K.advance(5); K.teleport(7.5,0,7.5, 0,0); K.lookAtPoint([0,1.6,-3]);`],
  ['06-ritual-procession', `K.setPhase('procession'); K.advance(6); K.free(-9,4.5,9, 0,1,-3);`],
  ['07-sword-before', `K.teleport(12.3,0,14.8,0,0); K.advance(2); K.lookAtPoint([16.5,1.4,9.5]);`],
  ['08-sword-during', `K.swordPull(); K.advance(1.52);`],
  ['09-sword-after-burst', `K.advance(0.5);`],
  ['10-bridge-to-maw', `K.teleport(0,0,-29,0,0.08); K.advance(3);`],
  ['11-transition-swallowed', `K.teleport(0,0,-50,0,0.05); K.advance(0.5); K.swallow(); K.advance(1.4);`],
  ['12-transition-gullet', `K.advance(3.4);`],
  ['13-transition-spat-out', `K.advance(4.3);`],
  ['14-post-transition-stairs', `K.advance(2.6);`],
  ['15-below-landing-door', `K.teleport(70,-150,-208.5, 0, 0.18); K.advance(3);`],
  ['16-below-looking-up', `K.teleport(72,-150,-212, 0.5, 0.75); K.advance(1);`],
  ['17-fold-transition', `K.teleport(70,-150,-217, 0, 0.1); K.fold(); K.advance(4.2);`],
  ['18-fold-arrival', `K.advance(5.6);`],
  ['19-sky-eye', `K.eyeWake(); K.advance(5); K.free(-40,45,40, 50,260,-500);`],
];

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
const t0 = Date.now();
await page.goto(BASE + '?q=' + Q);
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 240000 });
const loadS = (Date.now() - t0) / 1000;
// measure real-time fps for a few seconds of the live loop (SwiftShader = CPU rendering)
await page.evaluate(() => { window.__keatland.enter(); document.getElementById('enter')?.remove(); });
await page.waitForTimeout(8000);
const fps = await page.evaluate(() => window.__keatland.fps);
const info = await page.evaluate(() => window.__keatland.info());
await page.evaluate(() => {
  const K = window.__keatland; K.pause(true);
  const THREE_V = K.camera.position.constructor;
  K.free = (x, y, z, tx, ty, tz) => { K.freeCam = true; K.camera.position.set(x, y, z); K.camera.lookAt(tx, ty, tz); };
  K.lookAtPoint = (p, dp = 0) => { const c = K.camera.position; const d = { x: p[0] - c.x, y: p[1] - c.y, z: p[2] - c.z }; const yaw = Math.atan2(-d.x, -d.z); const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)) + dp; K.look(yaw, pitch); };
  K.pencilTip = () => K.tip();
});
const results = [];
for (const [name, code] of V) {
  if (filter && !name.includes(filter) && !filter.split(',').some((f) => name.startsWith(f))) { await page.evaluate(async (code) => { const K = window.__keatland; K.freeCam = false; await eval('(async()=>{' + code + '})()'); }, code); continue; }
  const st = await page.evaluate(async (code) => { const K = window.__keatland; K.freeCam = false; await eval('(async()=>{' + code + '})()'); K.renderOnce(); return K.state; }, code);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  results.push([name, st.transition, st.phase, st.pencil, st.pos.map((v) => v.toFixed(1)).join(',')]);
  console.log(name, JSON.stringify(st));
}
console.log(JSON.stringify({ loadS, fps, info, errors }, null, 1));
fs.writeFileSync(`${OUT}/_verify.json`, JSON.stringify({ loadS, swiftshaderFps: fps, renderInfo: info, consoleErrors: errors, views: results }, null, 1));
await browser.close();
