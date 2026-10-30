// Renders the site's era pictures from the built game, so they always match it.
//   node apps/website/tools/shoot.js [eras]     e.g. node apps/website/tools/shoot.js egypt,venice
// Writes PNGs to apps/website/tools/out/ (git-ignored); then run python3 apps/website/tools/to-webp.py.
// Needs Playwright with Chromium. WebGL runs on SwiftShader, so the first picture takes a minute.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const C = require(path.join(root, 'packages/content/campaign.json'));
const out = path.join(__dirname, 'out');
const only = process.argv[2] ? process.argv[2].split(',') : null;
// The home-screen camera with the board pushed down, so the room and its window fill the picture.
// The page shows these stills until its live 3D table is ready, or instead of it without WebGL.
const VIEWS = [
  { name: 'hero', attract: true, ins: { top: 560, left: 200, right: 200 } },
];
// Pedestal velvet (the set's tint) and its sheen.
const FELT = { egypt: ['#1d2f7a', '#7f9cff'], greece: ['#2a5a7a', '#9cd2ff'], rome: ['#4a1840', '#ff9cd8'], mughal: ['#0e5a52', '#9fe0cc'],
  ming: ['#8a1e16', '#ffb09c'], venice: ['#14506a', '#9cdcff'], russia: ['#13563a', '#9fe0bc'], deco: ['#2a2a36', '#c8c8e0'] };

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  await page.addInitScript(() => { window.__SHOT = true; });
  await page.goto('file://' + path.join(root, 'apps/web-prototype/dist/chacklate-chess.html'), { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__view && window.__cam, null, { timeout: 300000 });
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }' });
  if (!only || only.includes('crest')) {
    // The logo: the black gold-and-silver knight, alone. Dropping CircleGeometry leaves out the floor disc.
    const url = await page.evaluate(() => {
      const T = window.THREE, Circle = T.CircleGeometry;
      T.CircleGeometry = class extends T.BufferGeometry {};
      try { return window.__view.snapshot({ kind: 'piece', set: 'gold-silver', type: 'n', side: 'b' }, 1000, 1200); } finally { T.CircleGeometry = Circle; }
    });
    fs.writeFileSync(path.join(out, 'knight.png'), Buffer.from(url.split(',')[1], 'base64'));
    console.log('crest done');
  }
  for (const e of C.eras) {
    if (only && !only.includes(e.id)) continue;
    for (const v of VIEWS) {
      await page.evaluate(([e, v]) => {
        const w = window.__view;
        w.setTheme({ board: e.board }, { set: e.set }); w.setRoom({ room: e.room });
        w.setInsets(v.ins, true);
        if (v.attract) w.setAttract(true, true); else w.setView('white', v.view, true);
      }, [e, v]);
      await page.waitForTimeout(2500);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(out, `${e.id}-${v.name}.png`) });
    }
    // The era set on a velvet pedestal, as on the game's collection cards (transparent background).
    const [felt, sheen] = FELT[e.id] || ['#5c1428', '#ff9cb8'];
    const url = await page.evaluate(([set, felt, sheen]) => window.__view.snapshot({ kind: 'vignette', felt, sheen, items: [
      { set, type: 'q', side: 'b', x: -0.66, z: -0.2, rot: 0.45 }, { set, type: 'k', side: 'w', x: 0.02, z: 0.04, rot: 0.1 }, { set, type: 'n', side: 'w', x: 0.68, z: 0.2, rot: -1.25 },
    ] }, 640, 480), [e.set, felt, sheen]);
    fs.writeFileSync(path.join(out, `set-${e.id}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(e.id, 'done');
  }
  await browser.close();
})();
