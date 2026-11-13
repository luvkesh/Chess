// Side by side: each piece of a modelled set as the game draws it, straight on at eye level,
// next to its cut-out from the reference picture (tools/model/build.py --preview writes those).
//   URL=http://localhost:8765/chackmate.html node tools/model/compare.js navy OUTDIR
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const set = process.argv[2], out = process.argv[3];
const types = (process.env.TYPES || 'k,q,b,n,r,p').split(',');
const sides = (process.env.SIDES || 'w,b').split(',');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } });
  page.on('pageerror', (e) => console.error('page error', e.message));
  await page.addInitScript(() => { window.__SHOT = true; });
  await page.goto(process.env.URL, { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__view && window.__cam, null, { timeout: 300000 });
  await page.waitForTimeout(1000);
  for (const side of sides) for (const t of types) {
    // knights turn side on, head to the right, like the pictures
    const turn = t === 'n' ? -Math.PI / 2 : 0;
    const url = await page.evaluate(([set, t, side, turn]) => window.__view.snapshot({ kind: 'piece', set, type: t, side, floor: false, level: true, turn, detail: 'show' }, 600, 800), [set, t, side, turn]);
    fs.writeFileSync(path.join(out, `${set}-${side}-${t}.png`), Buffer.from(url.split(',')[1], 'base64'));
    console.log(side, t);
  }
  await browser.close();
})();
