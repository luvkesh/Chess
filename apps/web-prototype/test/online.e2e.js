// Two players on two "devices" (two pages) play through the page's live room: a friend code
// game to checkmate with a reaction, worldwide matchmaking with a resignation, and a game lost
// on time. Run after the build: node apps/web-prototype/test/online.e2e.js
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
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript('window.__SHOT = true;');
  await ctx.addInitScript(fake);
  const open = async () => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.error('page error:', e.message));
    await p.goto(url);
    await p.waitForFunction(() => window.ChacklateNet && ChacklateNet.available() && ChacklateNet.mode() === 'room', null, { timeout: 20000 });
    return p;
  };
  const inGame = (p) => p.waitForFunction(() => { const G = ChacklateApp.state.game; return G && G.kind === 'online' && G.online; }, null, { timeout: 20000 });
  const color = (p) => p.evaluate(() => (ChacklateApp.state.game.human === 1 ? 'white' : 'black'));
  const moves = (p) => p.evaluate(() => ChacklateApp.state.game.g.uciMoves().join(' '));
  async function play(p, other, uci) {
    const n = (await moves(p)).split(' ').filter(Boolean).length;
    await p.evaluate((u) => { ChacklateApp.tap(u.slice(0, 2)); ChacklateApp.tap(u.slice(2, 4)); }, uci);
    await other.waitForFunction((k) => ChacklateApp.state.game.g.moves.length === k, n + 1, { timeout: 10000 });
  }
  const outcome = (p) => p.waitForFunction(() => { const G = ChacklateApp.state.game; return G && G.g.outcome && G.online.ended && G.g.outcome; }, null, { timeout: 15000 }).then((h) => h.jsonValue());

  // 1. A friend code: one device makes a game, the other joins with the code.
  const a = await open(), b = await open();
  await a.evaluate(() => ChacklateNet.createFriend('3+2'));
  const code = await (await a.waitForSelector('.friend-code')).textContent();
  assert.match(code, /^[A-Z2-9]{6}$/);
  await b.evaluate((c) => ChacklateNet.joinFriend(c), code);
  await inGame(a); await inGame(b);
  const [ca, cb] = [await color(a), await color(b)];
  assert.notStrictEqual(ca, cb, 'one white, one black');
  assert.strictEqual(await a.evaluate(() => ChacklateApp.state.game.online.tc), '3+2');
  const [w, k] = ca === 'white' ? [a, b] : [b, a];
  for (const [p, o, u] of [[w, k, 'e2e4'], [k, w, 'e7e5'], [w, k, 'f1c4'], [k, w, 'b8c6'], [w, k, 'd1h5'], [k, w, 'g8f6']]) await play(p, o, u);
  // a reaction reaches the other device as a bubble on the sender's card
  await k.evaluate(() => ChacklateNet.send({ type: 'emote', id: 'wow' }));
  await w.waitForSelector('.emote-bubble', { timeout: 5000 });
  assert.match(await w.textContent('.emote-bubble'), /Wow!/);
  await play(w, k, 'h5f7');
  const [ow, ok] = [await outcome(w), await outcome(k)];
  assert.deepStrictEqual([ow.result, ow.reason], ['1-0', 'checkmate']);
  assert.deepStrictEqual([ok.result, ok.reason], ['1-0', 'checkmate']);
  console.log('ok friend code game to checkmate, with a reaction');

  // 2. A wrong code tells the player nobody is waiting.
  await b.evaluate(() => { document.querySelectorAll('.modal [data-close]').forEach((x) => x.click()); ChacklateNet.joinFriend('ZZZZZZ'); });
  await b.waitForFunction(() => /No game is waiting/.test(document.body.textContent), null, { timeout: 20000 });
  console.log('ok unknown code');

  // 3. Worldwide: two players seeking the same clock are paired.
  const c = await open(), d = await open();
  await c.evaluate(() => ChacklateNet.quickMatch('5+0'));
  await d.evaluate(() => ChacklateNet.quickMatch('5+0'));
  await inGame(c); await inGame(d);
  assert.notStrictEqual(await color(c), await color(d));
  const cw = (await color(c)) === 'white';
  await play(cw ? c : d, cw ? d : c, 'd2d4');
  await play(cw ? d : c, cw ? c : d, 'd7d5');
  await d.evaluate(() => ChacklateNet.send({ type: 'resign' }));
  const [rc, rd] = [await outcome(c), await outcome(d)];
  assert.strictEqual(rc.reason, 'resignation'); assert.strictEqual(rd.reason, 'resignation');
  assert.strictEqual(rc.result, cw ? '1-0' : '0-1');
  console.log('ok worldwide pairing and resignation');

  // 4. The clock: a player who runs out of time loses on both devices.
  const e = await open(), f = await open();
  await e.evaluate(() => ChacklateNet.createFriend('10+0'));
  const code2 = await (await e.waitForSelector('.friend-code')).textContent();
  await f.evaluate((x) => ChacklateNet.joinFriend(x), code2);
  await inGame(e); await inGame(f);
  const ew = (await color(e)) === 'white';
  const [W, B] = ew ? [e, f] : [f, e];
  await play(W, B, 'g1f3'); await play(B, W, 'g8f6');
  // White thinks for "ten minutes".
  await W.evaluate(() => { ChacklateNet._relay.state().game.clock.w = 300; });
  const [tw, tb] = [await outcome(W), await outcome(B)];
  assert.deepStrictEqual([tw.result, tw.reason], ['0-1', 'timeout']);
  assert.deepStrictEqual([tb.result, tb.reason], ['0-1', 'timeout']);
  console.log('ok time runs out');

  await browser.close(); srv.close();
  console.log('online e2e: all passed');
})().catch((e) => { console.error(e); process.exit(1); });
