// Renders a lineup (white row in front, black behind) for each set named, from the built game.
//   node tools/shoot-sets.js sapphire,navy [outDir] [width] [height]
// Uses the game's own snapshot ('pieces' spec), so the pictures show exactly what players see.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const here = path.resolve(__dirname, '..');
const sets = (process.argv[2] || 'regency').split(',');
const out = process.argv[3] || path.join(__dirname, 'out');
const W = +(process.argv[4] || 1600), H = +(process.argv[5] || 800);
const DETAIL = process.env.DETAIL || 'show';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  page.on('pageerror', (e) => console.error('page error', e.message));
  await page.addInitScript(() => { window.__SHOT = true; });
  await page.goto((process.env.URL || 'file://' + path.join(here, 'dist/chackmate.html')), { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__view && window.__cam, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  for (const set of sets) {
    const t0 = Date.now();
    const url = await page.evaluate(async ([set, w, h, detail]) => {
      if (window.__pieces && window.__pieces.ready) await window.__pieces.ready(set);
      return window.__view.snapshot({ kind: 'pieces', set, detail }, w, h);
    }, [set, W, H, DETAIL]);
    fs.writeFileSync(path.join(out, set + '.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log(set, Date.now() - t0, 'ms');
  }
  await browser.close();
})();
