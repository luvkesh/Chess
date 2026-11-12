// Renders the gold pieces on the menu medals from the game's own 3D set, and the 3D avatars
// (every animal friend's bust and the emblem avatars) for portraits and avatar medals.
//   node tools/shoot-art.js            (after python3 build.py)
// Writes PNGs to tools/out/ (git-ignored); then run python3 tools/art-webp.py.
// Needs Playwright with Chromium. WebGL runs on SwiftShader, so it takes a minute or two.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const here = path.resolve(__dirname, '..');
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
  const A = await page.evaluate(() => { const K = ChacklateKit(THREE), A = ChacklateAvatars(THREE, K); return A.ANIMALS.map((n) => 'animal:' + n).concat(A.EMBLEMS.map((n) => 'emblem:' + n)); });
  for (const art of A) {
    const name = art.split(':')[1];
    if (!want('avatar') && !want('avatar-' + name)) continue;
    const url = await page.evaluate((art) => window.__view.snapshot({ kind: 'avatar', art, floor: false }, 1024, 1024), art);
    save('avatar-' + name, url);
    console.log('avatar', name);
  }
  // the avatar frames: each 3D bezel face on, on transparency (app.js lays it over the avatar)
  const F = await page.evaluate(() => ChacklateAvatars(THREE, ChacklateKit(THREE)).FRAMES);
  for (const name of F) {
    if (!want('frame') && !want('frame-' + name)) continue;
    const url = await page.evaluate((id) => window.__view.snapshot({ kind: 'frame', frame: id }, 640, 640), 'frame.' + name + '.v1');
    save('frame-' + name, url);
    console.log('frame', name);
  }
  await browser.close();
})();
