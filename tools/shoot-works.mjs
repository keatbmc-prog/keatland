// Verification shots for the Catecholamine Works (the door in the Backrooms, the way in, the hall,
// the valve, the flood, the drain, the CJP, the plates, the Jettison Hold, the chair, the way out).
//   (cd dist && python3 -m http.server 4180) & node tools/shoot-works.mjs [filter] [--w=1280 --h=720 --q=high]
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
  ['f01-works-door-backrooms', `K.sg(84, -91.2, Math.PI, 0.05); K.story.dale.p.set(3,0.15,-74); K.story.dale.mode='task'; K.story.dale.cool=99; K.advance(0.4);`],
  ['f02-doors-open-into-light', `K.freeCam=false; K.worksIn(); K.advance(2.6);`],
  ['f03-doorway-over-the-hall', `K.advance(2.6);`],
  ['f04-spiral-stair-behind-keaten', `K.advance(5.2);`],
  ['f05-arrival-floor', `K.advance(7.5);`],
  ['f06-hall-wide', `K.freeL(26, 16, -40, -4, 2, 10); K.advance(0.2);`],
  ['f07-vats-catwalk', `K.freeL(-8, 3.5, -30, -22, 8, -14); K.advance(0.2);`],
  ['f08-bottling-line', `K.freeCam=false; K.wg(4, 17.5, Math.PI - 0.2, -0.05, 'valve'); K.advance(3);`],
  ['f09-valve-gauge-alarm', `K.wg(15.6, 15.5, Math.PI - 0.45, 0.02, 'alarm'); K.advance(9); K.wl([18.2, 1.9, 19.4]); K.advance(0.1);`],
  ['f10-the-doors-burst', `K.wg(0, 12, Math.PI/2 - 0.1, 0.08, 'flood'); K.advance(3.4); K.freeL(14, 8.5, -16, -32, 4, 2);`],
  ['f11-tide-front', `K.advance(2.2); K.freeL(16, 6.5, -20, -16, 1, 8);`],
  ['f12-hoop-and-railing', `K.freeCam=false; K.jump('hoop'); K.advance(2.4); K.wl([-8, 1.2, 21]); K.advance(0.05);`],
  ['f13-dale-raft', `K.jump('raft'); K.advance(5.5); K.wa(K.works.cast.dale); K.advance(0.05);`],
  ['f14-keaten-ballet', `K.jump('ballet'); K.advance(3.5); K.wa(K.works.cast.keaten); K.advance(0.05);`],
  ['f15-chain-pull', `K.jump('chain'); K.advance(16); K.wl([0, 0.4, 2]); K.advance(0.05);`],
  ['f16-drain-vortex', `K.jump('drain'); K.advance(6); K.wl([0, 0, 2]); K.advance(0.05);`],
  ['f17-floor-visible-freedomland', `K.jump('drained'); K.advance(8); K.wg(14, -2, -1.75, 0.0); K.advance(0.3);`],
  ['f18-cjp-panel', `K.jump('cjp'); K.advance(8); K.wg(-5.6, 9.2, 2.05 - Math.PI + 0.0, -0.18); K.wl([-8.6, 1.2, 6.2]); K.advance(0.1);`],
  ['f19-plates-retract', `K.jump('plates'); K.wg(9.5, 9.5, 0, 0); K.advance(5.5); K.wl([0, -1, 2]); K.advance(0.05);`],
  ['f20-jettison-hold', `K.wg(0, 11.5, 0, -0.9, 'hold'); K.advance(4); K.freeL(1.5, 7, 8.5, 0, -60, 2);`],
  ['f21-chair-through-ceiling', `K.jump('chair'); K.freeCam=false; K.wg(0, 11.5, 0, -0.3); K.advance(3.6); const o = K.works.cast.office.position; K.wl([o.x, 0.9, o.z]);`],
  ['f22-onboarding-monitors', `K.freeCam=false; K.jump('onboarding'); K.advance(2); K.wg(0, 14, Math.PI, 0.25); K.wl([0, 10.2, 31]); K.advance(0.1);`],
  ['f23-procedural-error', `K.jump('end'); K.advance(1); K.wg(3, 15, Math.PI, 0.1); K.wl([0, 10.2, 31]); K.advance(0.1);`],
  ['f24-way-out', `K.wg(21.6, -30.8, 0, 0); K.worksOut(); K.advance(3.6);`],
  ['f25-back-in-backrooms', `K.advance(4.5);`],
];
// --shots=file.json replaces the list with [[name, code], ...] (for quick looks while tuning)
if (args.shots) { V.length = 0; V.push(...JSON.parse(fs.readFileSync(args.shots, 'utf8'))); }
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
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
  const WO = K.works.root.position;
  K.wg = (x, z, yaw, pitch, label) => { K.freeCam = false; K.worksGo(x, z, yaw, pitch, label); };
  K.jump = (l) => K.works.jump(l);
  K.wa = (a) => K.wl([a.p.x, a.p.y + (a.base || 0) + 1.2, a.p.z]);
  K.wl = (p) => K.look2([p[0] + WO.x, p[1] + WO.y, p[2] + WO.z]);
  K.freeL = (x, y, z, tx, ty, tz) => K.free(x + WO.x, y + WO.y, z + WO.z, tx + WO.x, ty + WO.y, tz + WO.z);
});
for (const [name, code] of V) {
  const st = await page.evaluate(async (code) => { const K = window.__keatland; try { await eval('(async()=>{' + code + '})()'); } catch (e) { return { err: e.message + ' ' + e.stack }; } K.renderOnce(); const O = K.realm === 'works' ? K.works.root.position : K.story.root.position; const d = K.works.director; return { ...K.state, realm: K.realm, hint: document.getElementById('hint').className + ':' + document.getElementById('hint-text').textContent, zone: d.i + '/' + (d.gate || '') , dale: K.works.flood.level.toFixed(2), local: K.state.pos.map((v, i) => v - [O.x, O.y, O.z][i]) }; }, code);
  if (st.err) { console.log(name, 'ERR', st.err); continue; }
  if (!filter || filter.split(',').some((f) => name.startsWith(f))) await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name, st.transition, st.realm, st.zone, st.dale, st.local.map((v) => v.toFixed(1)).join(','), st.hint);
}
const info = await page.evaluate(() => window.__keatland.info());
console.log(JSON.stringify({ loadS, info, errors }, null, 1));
await browser.close();
