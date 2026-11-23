// usage: node tools/still.mjs out.png "<js to run before render>" [w h]
import { createRequire } from 'module';
const require = createRequire('/workspace/keatland/tests/');
const { chromium } = require('playwright');
const [out, js = '', w = '960', h = '540', q = 'high'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 300)); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto('http://localhost:4180/?q=' + q);
await page.waitForFunction(() => window.__keatland?.ready, null, { timeout: 180000 });
await page.evaluate(() => { window.__keatland.enter(); document.getElementById('enter').remove(); window.__keatland.pause(true); });
const st = await page.evaluate(new Function('K', '') && (async (code) => { const K = window.__keatland; await eval('(async()=>{' + code + '})()'); K.renderOnce(); return K.state; }), js);
await page.waitForTimeout(300);
await page.screenshot({ path: out });
console.log(JSON.stringify(st));
console.log(logs.filter((l) => !/ReadPixels|Clock/.test(l)).join('\n'));
await browser.close();
