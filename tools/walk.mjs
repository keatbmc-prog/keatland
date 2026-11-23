// Scripted walkthrough: deterministic frame capture (advance + screenshot), then ffmpeg -> mp4.
//   node tools/walk.mjs [--w=640 --h=360 --fps=20]
import { createRequire } from 'module';
import fs from 'fs';
import { execFileSync } from 'child_process';
const require = createRequire(process.env.PW_PATH || '/workspace/keatland/tests/');
const { chromium } = require('playwright');
const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const W = +(args.w || 640), H = +(args.h || 360), FPS = +(args.fps || 20);
const DIR = '/tmp/kl-walk'; fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.goto('http://localhost:4180/?q=high');
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 240000 });
await page.evaluate(() => { const K = window.__keatland; K.enter(); document.getElementById('enter')?.remove(); K.pause(true); K.setPhase('chant'); K.pencilState('draw', 60); K.advance(10); });
// shots: [seconds, setup, per-frame(u in 0..1)]
const lerp = (a, b, u) => a + (b - a) * u, ease = (u) => u * u * (3 - 2 * u);
const shots = [
  [7, `K.teleport(0,0,25,0,0.1)`, (u) => { u = ease(u); return `K.teleport(${lerp(0, 5, u)},0,${lerp(25, 11, u)},${lerp(0, 0.5, u)},${lerp(0.1, 0.05, u)})`; }],
  [3.5, `K.teleport(12.3,0,14.8,0,0); K.lookAtPoint([16.5,1.4,9.5]); K.swordPull();`, () => ''],
  [8, `K.teleport(0,0,-50,0,0.05); K.advance(0.3); K.swallow();`, () => ''],
];
await page.evaluate(() => { const K = window.__keatland; K.lookAtPoint = (p) => { const c = K.camera.position; const d = { x: p[0] - c.x, y: p[1] - c.y, z: p[2] - c.z }; K.look(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z))); }; });
let f = 0;
for (const [dur, setup, per] of shots) {
  await page.evaluate((c) => { const K = window.__keatland; eval(c); }, setup);
  const n = Math.round(dur * FPS);
  for (let i = 0; i < n; i++) {
    await page.evaluate(([c, dt]) => { const K = window.__keatland; if (c) eval(c); K.advance(dt); K.renderOnce(); }, [per(i / n), 1 / FPS]);
    await page.screenshot({ path: `${DIR}/f${String(f++).padStart(5, '0')}.png` });
  }
  console.log('shot done', f);
}
await browser.close();
execFileSync('/usr/bin/ffmpeg', ['-y', '-framerate', String(FPS), '-i', `${DIR}/f%05d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', 'screenshots/walkthrough.mp4'], { stdio: 'inherit' });
console.log('frames', f);
