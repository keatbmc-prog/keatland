// Verification shots for the story portal (hub car, transition, Keatland Reception lot, reception,
// backrooms, Dale, the loop, the FREEDOMLAND door, the way back).
//   (cd dist && python3 -m http.server 4180) & node tools/shoot-story.mjs [filter] [--w=1280 --h=720 --q=high]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PW_PATH || '/workspace/keatland/tests/');
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));
const W = +(args.w || 1280), H = +(args.h || 720), Q = args.q || 'high', OUT = args.out || 'screenshots';
fs.mkdirSync(OUT, { recursive: true });
// K.sg(x, z, yaw, pitch): stand at story-local (x, z). K.lk([x,y,z]): look at a story-local point.
const V = [
  ['s01-hub-stolen-car', `const E=K.entrance; const c=E.group.position; const f=E.forward; K.free(c.x - f.z*8 + f.x*1, c.y+2.6, c.z + f.x*8 + f.z*1, c.x + f.x*3.5, c.y+2.4, c.z + f.z*3.5); K.advance(0.3);`],
  ['s02-transition-into-car', `K.freeCam=false; const E=K.entrance; K.teleport(E.doorPos.x, 0, E.doorPos.z, 0, 0); K.storyIn(); K.advance(2.9);`],
  ['s03-transition-emerge-at-curb', `K.advance(1.6);`],
  ['s04-lectern-arrival', `K.advance(3);`],
  ['s05-lot-wide', `K.freeL(-30, 14, 34, 0, 2, -14); K.advance(0.2);`],
  ['s06-empty-curb-moss', `K.freeCam=false; K.sg(-1.5, 2.5, 0.55, -0.12); K.advance(0.4);`],
  ['s07-reception-counter', `K.sg(0, -16.5, 0.75, -0.08); K.advance(0.4);`],
  ['s08-hr-desk-plaque', `K.sg(5.2, -24.8, 0, -0.18); K.advance(1.5);`],
  ['s09-chair-collapse', `K.advance(1.9); K.sg(8.6, -24.6, 0.9, -0.22); K.lk([5.0, 0.5, -27.4]); K.advance(0.25);`],
  ['s10-backrooms-hall', `K.advance(8); K.sg(12.5, -49.2, 0, 0.02); K.advance(0.3);`],
  ['s11-ceiling-tile-office-above', `K.sg(12.5, -53.0, 0, 0.0); K.advance(2.2); K.sg(12.5, -54.6, 0, 0.9); K.advance(0.2);`],
  ['s12-branches-through-wall', `K.sg(11.5, -61.0, -0.45, 0.12); K.advance(0.4);`],
  ['s13-brochure-desk-keaten', `K.sg(13.5, -86.0, 0.15, -0.2); K.advance(0.4);`],
  ['s14-dale-chasing', `const D=K.story.dale; K.sg(12.5, -63, 0, 0.0); D.p.set(12.5, 0.15, -73); D.mode='wander'; D.cool=0; K.advance(1.4);`],
  ['s15-loop-doors', `K.sg(26, -90.5, -Math.PI/2, 0.0); K.story.dale.p.set(3,0.15,-74); K.story.dale.mode='task'; K.story.dale.cool=99; K.advance(0.4);`],
  ['s16-freedomland-door', `K.story.back.state.loops=2; K.sg(85.5, -90.5, -Math.PI/2, 0.0); K.advance(0.5);`],
  ['s17-yesterkeat-countdown', `K.story.interact({position: K.camera.position.clone().setX(K.story.root.position.x+90.6)}, K.state.t); K.advance(1.2); K.lk([90, 2.0, -90.0]); K.advance(0.3);`],
  ['s18-return-transition', `K.storyOut(); K.advance(1.4);`],
  ['s19-back-in-hub', `K.advance(4); const c=K.entrance.group.position; K.look2([c.x, c.y+2.5, c.z]); K.advance(0.1);`],
];
// --shots=file.json replaces the list with [[name, code], ...] (for quick looks while tuning)
if (args.shots) { V.length = 0; V.push(...JSON.parse(fs.readFileSync(args.shots, 'utf8'))); }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
const t0 = Date.now();
await page.goto(`http://localhost:4180/?q=${Q}`);
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 400000 });
const loadS = (Date.now() - t0) / 1000;
await page.evaluate(() => {
  const K = window.__keatland; K.enter(); document.getElementById('enter')?.remove(); K.pause(true);
  const O = K.story.root.position;
  K.free = (x, y, z, tx, ty, tz) => { K.freeCam = true; K.camera.position.set(x, y, z); K.camera.lookAt(tx, ty, tz); };
  K.freeL = (x, y, z, tx, ty, tz) => K.free(x + O.x, y + O.y, z + O.z, tx + O.x, ty + O.y, tz + O.z);
  K.sg = (x, z, yaw, pitch) => { K.freeCam = false; K.storyGo(x, z, yaw, pitch); };
  K.look2 = (p) => { const c = K.camera.position; const d = { x: p[0] - c.x, y: p[1] - c.y, z: p[2] - c.z }; K.look(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z))); };
  K.lk = (p) => K.look2([p[0] + O.x, p[1] + O.y, p[2] + O.z]);
});
for (const [name, code] of V) {
  const st = await page.evaluate(async (code) => { const K = window.__keatland; try { await eval('(async()=>{' + code + '})()'); } catch (e) { return { err: e.message + ' ' + e.stack }; } K.renderOnce(); const O = K.story.root.position; return { ...K.state, realm: K.realm, hint: document.getElementById('hint').className + ':' + document.getElementById('hint-text').textContent, zone: K.story.state.zone, dale: K.story.dale.mode, local: K.state.pos.map((v, i) => v - [O.x, O.y, O.z][i]) }; }, code);
  if (st.err) { console.log(name, 'ERR', st.err); continue; }
  if (!filter || filter.split(',').some((f) => name.startsWith(f))) await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, st.transition, st.realm, st.zone, st.dale, st.local.map((v) => v.toFixed(1)).join(','), st.hint);
}
const info = await page.evaluate(() => window.__keatland.info());
console.log(JSON.stringify({ loadS, info, errors }, null, 1));
await browser.close();
