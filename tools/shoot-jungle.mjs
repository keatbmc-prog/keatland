// Verification shots for the leaf portal + jungle (hub portal, transitions, jungle, stalker, return).
//   (cd dist && python3 -m http.server 4180) & node tools/shoot-jungle.mjs [filter] [--w=1280 --h=720 --q=high]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PW_PATH || '/workspace/keatland/tests/');
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'));
const W = +(args.w || 1280), H = +(args.h || 720), Q = args.q || 'high', OUT = args.out || 'screenshots';
fs.mkdirSync(OUT, { recursive: true });
const V = [
  ['j01-leaf-portal-in-hub', `const P=K.hubPortal; const s=P.center.clone().addScaledVector(P.front, 7.5); K.teleport(s.x, s.y, s.z, 0, 0); K.advance(2); K.lookAtPoint([P.center.x, P.center.y+2.4, P.center.z]);`],
  ['j01b-leaf-portal-close', `const P=K.hubPortal; const s=P.center.clone().addScaledVector(P.front, 2.6); K.teleport(s.x, s.y, s.z, 0, 0); K.lookAtPoint([P.center.x, P.center.y+2.0, P.center.z]); K.advance(0.6);`],
  ['j02-transition-into-leaves', `K.jungleIn(); K.advance(2.5);`],
  ['j03-transition-emerge', `K.advance(1.2);`],
  ['j04-jungle-arrival', `K.advance(3);`],
  ['j05-jungle-wide', `const c=K.jungle.center; K.free(c.x+15, c.y+8.5, c.z+3, c.x-6, c.y+1, c.z-2); K.advance(0.2);`],
  ['j06-leaves-occluding', `K.freeCam=false; const c=K.jungle.center; let best=null; for(let i=0;i<400;i++){ const x=c.x+(Math.random()*2-1)*20, z=c.z+(Math.random()*2-1)*20; if(K.jungle.ground(x,z)===null) continue; const v=K.jungle.coverAt(x,z)-0.05*K.jungle.pathDist(x,z)*0; if(!best||v>best.v) best={x,z,v}; } K.teleport(best.x, 0, best.z, 0.7, 0.05); K.advance(0.4);`],
  ['j07-stalker-peeking', `K.freeCam=false; const J=K.jungle; const p=J.path.getPointAt(0.02); K.teleport(p.x, p.y, p.z, J.arrival.yaw, 0.04); K.advance(0.3); const S=K.stalker; const t=J.path.getPointAt(0.13), tn=J.path.getTangentAt(0.13); S.pos.set(t.x - tn.z*2.6, 0, t.z + tn.x*2.6); S.group.visible=true; S.setState('peek', 30); S._picked=true; S._arrived=true; S.target.copy(S.pos); S.lookedAt=-99; K.advance(1.6);`],
  ['j07b-stalker-peek-closer', `const S=K.stalker; const cam=K.camera; const d={x:S.pos.x-cam.position.x, y:S.pos.y+2.6-cam.position.y, z:S.pos.z-cam.position.z}; K.look(Math.atan2(-d.x,-d.z)+0.25, Math.atan2(d.y, Math.hypot(d.x,d.z))); S.lookedAt=-99; K.advance(0.3);`],
  ['j08-rush-then-vanished', `const S=K.stalker; S.setState('rush', 3); K.advance(0.9); const cam=K.camera; const d={x:S.pos.x-cam.position.x, z:S.pos.z-cam.position.z}; K.look(Math.atan2(-d.x,-d.z), 0.05); K.advance(0.05);`],
  ['j09-jungle-exit-portal', `const P=K.jungle.exitPortal; const s=P.center.clone().addScaledVector(P.front, 6.5); K.teleport(s.x, s.y, s.z, 0, 0); K.lookAtPoint([P.center.x, P.center.y+2.3, P.center.z]); K.advance(0.6);`],
  ['j10-return-transition', `K.jungleOut(); K.advance(2.6);`],
  ['j11-return-emerge', `K.advance(1.5);`],
  ['j12-back-in-hub', `K.advance(3); const P=K.hubPortal; K.look(K.state.yaw+Math.PI*0.85, 0.05); K.advance(0.1);`],
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
  const st = await page.evaluate(async (code) => { const K = window.__keatland; await eval('(async()=>{' + code + '})()'); K.renderOnce(); return { ...K.state, realm: K.realm, aimed: K.aimed(), hint: document.getElementById('hint').className + ':' + document.getElementById('hint-text').textContent, cube: K.stalker.state }; }, code);
  if (!filter || filter.split(',').some((f) => name.startsWith(f))) await page.screenshot({ path: `${OUT}/${name}.png` });
  log.push([name, st.transition, st.realm, st.pos.map((v) => v.toFixed(1)).join(','), JSON.stringify(st.aimed), st.hint, st.cube]);
  console.log(name, st.transition, st.realm, st.pos.map((v) => v.toFixed(1)).join(','), JSON.stringify(st.aimed), st.hint, st.cube);
}
const info = await page.evaluate(() => window.__keatland.info());
console.log(JSON.stringify({ loadS, info, errors }, null, 1));
await browser.close();
