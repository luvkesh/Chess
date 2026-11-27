// Puzzle flow in a real browser: plays a Checkmate in N set with solves, a wrong move and a shown
// solution, and fails if Next ever brings back a puzzle already played or the streak, words or
// "Puzzle n of m" are wrong. After a build: node tools/puzzle-flow.js [1280x800]
// (PLAN=ok,miss,sol,... N=1..5 SHOT=1 for screenshots in the current folder).
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [w,h] = (process.argv[2]||'1280x800').split('x').map(Number);
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: w, height: h } });
  pg.on('pageerror', e => console.log('PAGEERR', e.message));
  await pg.addInitScript(() => { window.__SHOT = true; });
  await pg.goto('file://' + path.join(__dirname, '..', 'dist', 'chackmate.html'));
  await pg.waitForTimeout(2000);
  await pg.evaluate(() => document.querySelectorAll('.modal').forEach(m => m.remove()));
  await pg.evaluate((n) => window.__go('puzzle', { mate: n, title: 'Checkmate' }), +(process.env.N||1));
  const plan = (process.env.PLAN || 'ok,ok,ok,miss,ok,sol,ok').split(',');
  const sq = s => (s.charCodeAt(0) - 97) + 8 * (+s[1] - 1);
  const ids = [], fails = [];
  for (const step of plan) {
    await pg.waitForFunction(() => window.__pz && window.__pz.cur && !window.__pz.busy, null, { timeout: 30000 });
    const cur = await pg.evaluate(() => ({ id: window.__pz.cur.id, eb: document.getElementById('pz-eyebrow').textContent }));
    ids.push(cur.id);
    if (step === 'miss') {
      // play any legal non-solution move through the board hooks
      const mv = await pg.evaluate(() => { const S = window.__pz; return S.cur.moves[1]; });
      await pg.evaluate((want) => { const H = window.__hooks; for (let f = 0; f < 64; f++) { if (!H.canDrag(f)) continue; for (let t = 0; t < 64; t++) { const u = String.fromCharCode(97 + f % 8) + (1 + (f >> 3)) + String.fromCharCode(97 + t % 8) + (1 + (t >> 3)); if (u === want.slice(0, 4)) continue; if (H.onDrop(f, t)) return u; } } return null; }, mv);
      await pg.waitForTimeout(1200);
      const st = await pg.evaluate(() => ({ fb: (document.getElementById('pz-fb') || {}).innerText, streak: document.getElementById('pz-streak').innerText, moment: !!document.querySelector('.streak-moment') }));
      console.log('  miss ->', JSON.stringify(st));
      await pg.waitForFunction(() => !window.__pz.busy, null, { timeout: 10000 });
    }
    if (step === 'sol') { await pg.evaluate(() => document.getElementById('pz-sol').click()); await pg.evaluate(() => { const b = document.querySelector('.modal [data-sol-show]'); if (b) b.click(); }); }   // Solution asks first when it costs something
    else {
      const mv = await pg.evaluate(() => window.__pz.cur.moves[1]);
      await pg.evaluate(([f, t]) => window.__hooks.onDrop(f, t), [sq(mv.slice(0, 2)), sq(mv.slice(2, 4))]);
    }
    await pg.waitForFunction(() => !document.getElementById('pz-next').hidden, null, { timeout: 30000 });
    const after = await pg.evaluate(() => ({ fb: (document.getElementById('pz-fb') || {}).innerText, streak: document.getElementById('pz-streak').textContent.replace(/\s+/g, ' '), prog: (document.querySelector('#pz-prog small') || {}).textContent, hint: document.getElementById('pz-hint').hidden }));
    console.log(step, cur.id, cur.eb, JSON.stringify(after));
    if (!/checkmate|mate/i.test(after.fb || '') && step !== 'sol') fails.push(cur.id + ': no checkmate words');
    if (!new RegExp('Puzzle ' + ids.length + ' of').test(cur.eb)) fails.push(cur.id + ': numbered ' + cur.eb);
    if ((step === 'sol' || step === 'miss') && !/Streak 0/.test(after.streak)) fails.push(cur.id + ': streak kept after a ' + step);
    if (process.env.SHOT) await pg.screenshot({ path: 'puzzle-flow-' + w + '-' + ids.length + '.png' });
    await pg.evaluate(() => document.getElementById('pz-next').click());
  }
  await pg.waitForFunction(() => window.__pz && !window.__pz.busy, null, { timeout: 30000 });
  const last = await pg.evaluate(() => window.__pz.cur.id);
  ids.push(last);
  console.log('sequence', ids.join(' '));
  const dupes = ids.filter((x, i) => ids.indexOf(x) !== i);
  console.log(dupes.length ? 'REPEATS ' + dupes : 'no repeats');
  await b.close();
  if (dupes.length || fails.length) { console.log('FAILED', fails); process.exit(1); }
})();
