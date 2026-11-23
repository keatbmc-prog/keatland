// One-off helper: collects the PUBLIC, logged-out profile grid of an Instagram account (no login,
// no credentials) with headless Chromium, downloads the grid images into public/gallery/ and writes
// public/gallery/manifest.json. Re-run to refresh:  node tools/fetch-instagram.mjs keaten.blank [max]
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(process.env.PW_PATH || '/workspace/keatland/tests/');
const { chromium } = require('playwright');
const user = process.argv[2] || 'keaten.blank';
const MAX = +(process.argv[3] || 30);
const OUT = new URL('../public/gallery/', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36', viewport: { width: 1280, height: 1600 }, locale: 'en-US' });
const page = await ctx.newPage();
await page.goto(`https://www.instagram.com/${user}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('a[href*="/p/"] img, a[href*="/reel/"] img', { timeout: 45000 }).catch(() => console.log('grid did not appear'));
await page.waitForTimeout(3000);
const seen = new Map();
for (let i = 0; i < 12 && seen.size < MAX; i++) {
  const items = await page.$$eval('a', (as) => as.filter((a) => /\/(p|reel)\//.test(a.href)).map((a) => { const img = a.querySelector('img'); return img ? { href: a.href.split('?')[0], src: img.currentSrc || img.src, alt: img.alt || '' } : null; }).filter(Boolean));
  for (const it of items) if (!seen.has(it.href)) seen.set(it.href, it);
  // dismiss a login nag if one appears, then scroll
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.wheel(0, 2400); await page.waitForTimeout(2500);
}
console.log('grid items', seen.size);
// open each post (still logged out) for the full-resolution image and any carousel slides
const media = [];
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
let page2 = await ctx.newPage();
for (const it of seen.values()) {
  const found = new Map();
  const page = page2;
  try {
    await withTimeout((async () => {
    await page.goto(it.href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
    for (let k = 0; k < 8; k++) {
      const big = await page.$$eval('article img, main img', (a) => a.filter((i) => i.naturalWidth >= 900).map((i) => ({ src: i.currentSrc || i.src, alt: i.alt || '' })));
      for (const b of big) { const key = b.src.split('?')[0]; if (!found.has(key)) found.set(key, b); }
      const next = await page.$('button[aria-label="Next"]');
      if (!next) break;
      await next.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(1200);
    }
    })(), 45000);
  } catch (e) { console.log('post failed', it.href, e.message); await page2.close().catch(() => {}); page2 = await ctx.newPage(); }
  const list = found.size ? [...found.values()] : [{ src: it.src, alt: it.alt }];
  // the post page also shows other posts' thumbnails below; keep only images whose alt shares this post's date
  const date = (it.alt.match(/on ([A-Za-z]+ \d{1,2}, \d{4})/) || [])[1];
  const own = date ? list.filter((x) => x.alt.includes(date)) : list;
  (own.length ? own : [{ src: it.src, alt: it.alt }]).forEach((x, i) => media.push({ ...it, src: x.src, alt: x.alt || it.alt, slide: i }));
  console.log(it.href, own.length);
}
const entries = [];
let n = 0;
for (const it of media.slice(0, MAX)) {
  const res = await ctx.request.get(it.src, { headers: { referer: 'https://www.instagram.com/' } });
  if (!res.ok()) { console.log('skip', res.status(), it.href); continue; }
  const file = `ig-${String(++n).padStart(2, '0')}.jpg`;
  fs.writeFileSync(OUT + file, await res.body());
  const m = it.alt.match(/^(Photo|Video) by .*? on ([A-Za-z]+ \d{1,2}, \d{4})\.?\s*(.*)$/);
  const type = m ? m[1].toLowerCase() : 'photo';
  const caption = m ? `${m[2]}${m[3] ? ' - ' + m[3].replace(/^May be an image of /, '') : ''}` : it.alt;
  entries.push({ file, caption, postUrl: it.href, type, slide: it.slide, alt: it.alt, source: 'instagram:' + user });
}
fs.writeFileSync(OUT + 'manifest.json', JSON.stringify({ account: user, profileUrl: `https://www.instagram.com/${user}/`, fetched: new Date().toISOString(), photos: entries }, null, 2));
console.log('saved', entries.length);
await browser.close();
