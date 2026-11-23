// Verification shots for the Instagram portal (cube in the hub, transitions, gallery).
//   (cd dist && python3 -m http.server 4180) & node tools/shoot-portal.mjs [filter] [--w=1280 --h=720 --q=high]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PW_PATH || '/workspace/keatland/tests/');
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));
const W = +(args.w || 1280), H = +(args.h || 720), Q = args.q || 'high', OUT = args.out || 'screenshots';
fs.mkdirSync(OUT, { recursive: true });
const V = [
  ['p01-cube-in-hub', `K.teleport(K.cubeStand.x, K.cubeStand.y, K.cubeStand.z, 0, 0); K.advance(3); K.lookAtPoint(K.cubeCenter(), 0.02);`],
  ['p02-cube-mid-twist', `let n=0; while(n++<900){ K.advance(1/30, 1/30); const m=K.photoCube.move; if(m && K.photoCube.mode==='burst' && m.t/m.dur>0.45 && m.t/m.dur<0.6) break; } const c=K.cubeCenter(); K.free(c[0]+3.4, c[1]+0.8, c[2]+3.2, c[0], c[1], c[2]);`],
  ['p03-hub-wide-with-cube', `K.advance(1); K.free(-2, 6, 26, -14.5, 3, 11);`],
  ['p04-portal-dive', `K.freeCam=false; K.teleport(K.cubeStand.x, K.cubeStand.y, K.cubeStand.z, 0, 0); K.lookAtPoint(K.cubeCenter(), 0); K.advance(0.2); K.portal(); K.advance(2.7);`],
  ['p05-portal-emerge', `K.advance(1.7);`],
  ['p06-portal-landed', `K.advance(3);`],
  ['p07-gallery-wide', `K.free(${400 + 0}, -400 + 4.2, ${400 + 9}, 400, -400 + 2.2, 400 - 6);`],
  ['p08-gallery-arrival', `K.freeCam=false; const a=K.gallery.arrival; K.teleport(a.pos.x, a.pos.y, a.pos.z, 0, 0.02); K.advance(0.5);`],
  ['p09-photo-closeup', `const f=K.gallery.frames[1]; K.teleport(f.stand.x, f.stand.y, f.stand.z, 0, 0); K.lookAtPoint([f.center.x, f.center.y, f.center.z]); K.advance(0.3);`],
  ['p10-photo-closeup-2', `const f=K.gallery.frames[10 % K.gallery.frames.length]; const s=f.stand.clone().lerp(f.center,0.25); K.teleport(s.x, f.stand.y, s.z, 0, 0); K.lookAtPoint([f.center.x, f.center.y, f.center.z]); K.advance(0.3);`],
  ['p11-exit-cube', `K.teleport(400, -400, 403.4, 0, 0); K.lookAtPoint([400, -400 + 2.35, 400]); K.advance(0.5);`],
  ['p12-return-dive', `K.portalBack(); K.advance(2.6);`],
  ['p13-return-emerge', `K.advance(1.9);`],
  ['p14-back-in-hub', `K.advance(3);`],
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('popup', (p) => errors.push('popup: ' + p.url()));
const t0 = Date.now();
await page.goto(`http://localhost:4180/?q=${Q}`);
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 300000 });
const loadS = (Date.now() - t0) / 1000;
await page.evaluate(() => {
  const K = window.__keatland; K.enter(); document.getElementById('enter')?.remove(); K.pause(true);
  K.free = (x, y, z, tx, ty, tz) => { K.freeCam = true; K.camera.position.set(x, y, z); K.camera.lookAt(tx, ty, tz); };
  K.lookAtPoint = (p, dp = 0) => { const c = K.camera.position; const d = { x: p[0] - c.x, y: p[1] - c.y, z: p[2] - c.z }; K.look(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)) + dp); };
});
const log = [];
for (const [name, code] of V) {
  const st = await page.evaluate(async (code) => { const K = window.__keatland; await eval('(async()=>{' + code + '})()'); K.renderOnce(); return { ...K.state, realm: K.realm, aimed: K.aimed(), hint: document.getElementById('hint').className + ':' + document.getElementById('hint-text').textContent, cube: K.photoCube.mode }; }, code);
  if (!filter || filter.split(',').some((f) => name.startsWith(f))) await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push([name, st.transition, st.realm, st.pos.map((v) => v.toFixed(1)).join(','), JSON.stringify(st.aimed), st.hint, st.cube]);
  console.log(name, st.transition, st.realm, st.pos.map((v) => v.toFixed(1)).join(','), JSON.stringify(st.aimed), st.hint, st.cube);
}
const photos = await page.evaluate(() => window.__keatland.photos);
console.log(JSON.stringify({ loadS, photos: photos.length, placeholders: photos.filter((p) => p.placeholder).length, errors }, null, 1));
await browser.close();
