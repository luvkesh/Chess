// Two friends on two "devices" start a table with a code. Only one of them (drawn at random)
// gets paws to tap; the other sees "… is picking a hand" and then the same paw open, with their
// own pawn in the other one. Run after the build: node apps/web-prototype/test/toss.e2e.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const html = fs.readFileSync(path.join(__dirname, '../dist/chackmate.html'));
const fake = fs.readFileSync(path.join(__dirname, 'fake-room.js'), 'utf8');

(async () => {
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(html); }).listen(0);
  const url = 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch({ args: ['--disable-3d-apis'] });
  const shots = process.env.SHOTS;
  for (let round = 0; round < 3; round++) {
    const ctx = await browser.newContext({ viewport: process.env.PHONE ? { width: 390, height: 844 } : { width: 1280, height: 800 } });
    await ctx.addInitScript('window.__SHOT = true; window.__TOSS = true;');
    await ctx.addInitScript(fake);
    const open = async () => {
      const p = await ctx.newPage();
      p.on('pageerror', (e) => console.error('page error:', e.message));
      await p.goto(url);
      await p.waitForFunction(() => window.ChacklateNet && ChacklateNet.available() && ChacklateNet.mode() === 'room', null, { timeout: 20000 });
      await p.evaluate(() => { ChacklateClub.data().cid = Math.random().toString(36).slice(2, 12); ChacklateApp.state.settings.netName = 'Player ' + Math.random().toString(36).slice(2, 6); ChacklateClub.publish(); });
      await p.waitForFunction(() => getComputedStyle(document.getElementById('splash')).visibility === 'hidden');
      // a fresh device first asks about a placement test; answer it the way a player would
      const skip = p.locator('#modals button:has-text("Skip, start")');
      if (await skip.count()) { await skip.first().click(); await p.waitForTimeout(1500); await p.evaluate(() => ChacklateApp.go('home')); }
      return p;
    };
    const a = await open(), b = await open();
    await a.evaluate(() => ChacklateNet.createFriend('5+0'));
    const code = await (await a.waitForSelector('.friend-code')).textContent();
    await b.evaluate((c) => ChacklateNet.joinFriend(c), code);
    for (const p of [a, b]) await p.waitForSelector('.toss', { timeout: 20000 });
    const role = (p) => p.evaluate(() => ChacklateApp.state.game.setup.tossRole);
    const [ra, rb] = [await role(a), await role(b)];
    assert.deepStrictEqual([ra, rb].sort(), ['pick', 'watch'], 'one picks, one watches');
    const [picker, watcher] = ra === 'pick' ? [a, b] : [b, a];
    assert.strictEqual(await picker.locator('.toss-hand:not([disabled])').count(), 2, 'the picker can tap either paw');
    assert.strictEqual(await watcher.locator('.toss-hand:not([disabled])').count(), 0, 'the watcher cannot tap');
    assert.match(await watcher.textContent('#toss-h'), /is picking a hand/);
    if (shots && round === 0) { await watcher.waitForTimeout(1500); await watcher.screenshot({ path: shots + '/watch-waiting.png' }); await picker.screenshot({ path: shots + '/pick.png' }); }
    const hand = round % 2 ? 'right' : 'left';
    await picker.click('.toss-hand.' + hand, { force: true });
    await watcher.waitForSelector('.toss.opened', { timeout: 5000 });
    assert.strictEqual(await watcher.getAttribute('.toss-hand.tapped', 'data-hand'), hand, 'the watcher sees the same paw open');
    assert.match(await watcher.textContent('#toss-p'), new RegExp('picked the ' + hand + ' paw'));
    if (shots && round === 0) { await watcher.waitForTimeout(700); await watcher.screenshot({ path: shots + '/watch-opened.png' }); }
    // each side's own pawn: the picker's in the tapped paw, the watcher's in the other
    const own = (p) => p.evaluate(() => { const y = document.querySelector('.toss-hand.yours'); return y.dataset.hand + ':' + (y.querySelector('.toss-pawn').classList.contains('w') ? 'w' : 'b'); });
    const colour = (p) => p.evaluate(() => (ChacklateApp.state.game.human === 1 ? 'w' : 'b'));
    const [op, ow] = [await own(picker), await own(watcher)];
    assert.strictEqual(op, hand + ':' + await colour(picker));
    assert.strictEqual(ow, (hand === 'left' ? 'right' : 'left') + ':' + await colour(watcher));
    for (const p of [a, b]) await p.waitForSelector('.toss', { state: 'detached', timeout: 8000 });
    await ctx.close();
  }
  console.log('ok only one friend picks a hand; the other watches the same paw open');
  await browser.close(); srv.close();
})().catch((e) => { console.error(e); process.exit(1); });
