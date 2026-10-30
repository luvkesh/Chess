// Renders the menu pictures that are drawn from the game's own 3D models and paintings:
// the gold pieces on the medals and the view of each Journey era.
//   node tools/shoot-art.js            (after python3 build.py)
// Writes PNGs to tools/out/ (git-ignored); then run python3 tools/art-webp.py.
// Needs Playwright with Chromium. WebGL runs on SwiftShader, so it takes a minute or two.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const here = path.resolve(__dirname, '..');
const C = require(path.join(here, '../../packages/content/campaign.json'));
const out = path.join(__dirname, 'out');
const only = process.argv[2] ? process.argv[2].split(',') : null;
const want = (k) => !only || only.includes(k);
// The medal pieces: the Regency Gilt set's shapes, cast in polished gold.
const SET = process.env.ART_SET || 'regency', SIDE = process.env.ART_SIDE || 'w', GILD = process.env.ART_GILD === undefined ? '#ffd27a' : process.env.ART_GILD;

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.addInitScript(() => { window.__SHOT = true; });
  await page.goto('file://' + path.join(here, 'dist/chackmate.html'), { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__view && window.__cam, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  const save = (name, url) => fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(url.split(',')[1], 'base64'));
  for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) {
    if (!want('piece') && !want('piece-' + t)) continue;
    const url = await page.evaluate(([set, t, side, gild]) => window.__view.snapshot({ kind: 'piece', set, type: t, side, floor: false, gild: gild || undefined }, 800, 1000), [SET, t, SIDE, GILD]);
    save('piece-' + t, url);
    console.log('piece', t);
  }
  if (want('view')) {
    for (const e of C.eras) {
      const url = await page.evaluate((room) => {
        const W = ChacklateWorld(window.THREE, ChacklateKit(window.THREE));
        const src = W.panoramaCanvas(W.ROOMS[room], 1536, 1024);
        const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
        c.getContext('2d').drawImage(src, 0, 0);
        return c.toDataURL('image/png');
      }, e.room);
      save('view-' + e.id, url);
      console.log('view', e.id);
    }
  }
  await browser.close();
})();
