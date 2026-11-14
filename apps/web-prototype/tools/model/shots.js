// Pictures of one set as the game draws it, for judging a rebuild against the live set and the
// reference. Serves apps/web-prototype/dist itself (run `python3 build.py` there first).
//   node tools/model/shots.js <set> OUTDIR
// Writes into OUTDIR:
//   <side>-<type>.png        each piece alone, turned a little (the Collection view)
//   <side>-<type>-front.png  each piece straight on, to lay beside its reference picture
//   low-white.png, low-black.png   the back rows from a low, close camera, as a player leaning
//                            in sees them. This is the view that shows smears, flat sides and
//                            streaky bases: judge here, not from the high default view.
//   board-white.png, board-black.png   the default playing view
//   lineup.png               all six pieces of both sides in a row
// VIEWS=pieces,low,board,lineup picks a subset; TYPES and SIDES narrow the piece pictures.
// Software GL in a headless browser is slow: the full run takes about four minutes.
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { chromium } = require('playwright');
const [set, out] = process.argv.slice(2);
if (!set || !out) { console.error('usage: node shots.js <set> OUTDIR'); process.exit(1); }
const dist = process.env.DIST || path.join(__dirname, '..', '..', 'dist');
const views = (process.env.VIEWS || 'pieces,low,board,lineup').split(',');
const types = (process.env.TYPES || 'k,q,b,n,r,p').split(',');
const sides = (process.env.SIDES || 'w,b').split(',');
const save = (name, url) => fs.writeFileSync(path.join(out, name), Buffer.from(url.split(',')[1], 'base64'));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = http.createServer((q, r) => {
    const f = path.join(dist, decodeURIComponent(q.url.split('?')[0]));
    if (!f.startsWith(dist) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'text/plain' }); fs.createReadStream(f).pipe(r);
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1800, height: 800 } });
  page.on('pageerror', (e) => console.error('page error', e.message));
  await page.addInitScript(() => { window.__SHOT = true; });
  await page.goto('http://127.0.0.1:' + server.address().port + '/chackmate.html', { waitUntil: 'commit', timeout: 0 });
  await page.waitForFunction(() => window.__view && window.__cam, null, { timeout: 300000 });
  await page.waitForTimeout(1500);
  const piece = (t, side, turn, w, h) => page.evaluate(([set, t, side, turn, w, h]) => window.__view.snapshot({ kind: 'piece', set, type: t, side, floor: false, level: turn === 0, turn, detail: 'show' }, w, h), [set, t, side, turn, w, h]);
  // the first snapshot of a modelled set waits for its mesh pack; ask once and let it settle
  await piece('p', 'w', 0.5, 64, 64); await page.waitForTimeout(1500);
  if (views.includes('pieces')) {
    for (const side of sides) for (const t of types) {
      save(`${side}-${t}.png`, await piece(t, side, 0.5, 600, 800));
      save(`${side}-${t}-front.png`, await piece(t, side, 0, 600, 800));
    }
  }
  if (views.includes('lineup')) save('lineup.png', await page.evaluate((set) => window.__view.snapshot({ kind: 'pieces', set }, 1400, 800), set));
  if (views.includes('low') || views.includes('board')) {
    await page.addStyleTag({ content: 'body > *:not(canvas) { visibility: hidden !important; } canvas { visibility: visible !important; }' });
    for (const side of ['white', 'black']) {
      await page.evaluate(([set, side]) => { const w = window.__view; w.setTheme({}, { set }); w.setView(side, undefined, true); }, [set, side]);
      await page.waitForTimeout(3500);
      if (views.includes('board')) await page.screenshot({ path: path.join(out, `board-${side}.png`) });
      if (views.includes('low')) {
        await page.evaluate(() => window.__view.setFocus({ pitch: 0.42, zoom: 0.42, lookY: 0.55, lookZ: 2.9 }, true));
        await page.waitForTimeout(3500);
        await page.screenshot({ path: path.join(out, `low-${side}.png`) });
      }
    }
  }
  await browser.close(); server.close();
})();
