// Photographs every live portrait (src/live.js) in three poses: eyes open, eyes shut, talking.
// Use it after changing a face's eye, pivot or mouth marks:  node tools/characters/live-check.js [out-dir]
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..', '..');
const out = process.argv[2] || path.join(__dirname, 'out-live');
fs.mkdirSync(out, { recursive: true });
const live = fs.readFileSync(path.join(root, 'src', 'live.js'), 'utf8').replace(/^if \(typeof module.*$/m, '');
const names = fs.readdirSync(path.join(root, 'src', 'art')).filter((f) => /^avatar-/.test(f)).map((f) => f.slice(7, -5));
const uri = (n) => 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'src', 'art', 'avatar-' + n + '.webp')).toString('base64');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1500, height: 780 } });
  p.on('console', (m) => { if (m.type() === 'error') console.log(m.text()); });
  await p.setContent('<style>body{margin:0;background:#222;display:grid;grid-template-columns:repeat(6,250px);}img,canvas{width:250px;height:250px;display:block}</style>');
  await p.evaluate(() => { window.__liveSoft = true; });
  await p.addScriptTag({ content: live + ';window.L=ChacklateLive;' });
  const shown = await p.evaluate((list) => {
    const map = {}; let k = 0;
    for (const [n, u] of list) { if (!L.FACE[n]) continue; const i = new Image(); i.src = u; i.alt = n; document.body.appendChild(i); map[u] = { animal: n, inner: 1, tex: u }; k++; }
    L.start((src) => map[src] || null); return k;
  }, names.map((n) => [n, uri(n)]));
  for (const [tag, dbg] of [['open', { t: 0.4, blink: 0, talk: 0 }], ['half', { t: 1.9, blink: 0.55, talk: 0 }], ['shut', { t: 1.9, blink: 1, talk: 0 }], ['talk', { t: 0.75, blink: 0, talk: 1 }]]) {
    await p.evaluate((d) => { window.__liveDbg = d; }, dbg);
    await p.waitForTimeout(900);
    await p.screenshot({ path: path.join(out, tag + '.png') });
  }
  console.log('faces', shown, 'live', await p.evaluate(() => L.count()));
  await b.close();
})();
