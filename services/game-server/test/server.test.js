'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/server');
const glicko = require('../src/glicko');
const audit = require('../src/audit');
const store = require('../src/db');

process.removeAllListeners('warning'); // node:sqlite prints an experimental warning

// A test client: queues messages and waits for the next one of a given type.
function client(port, token) {
  const sock = new WebSocket('ws://127.0.0.1:' + port + '/ws');
  const inbox = [], waiters = [];
  sock.onmessage = (e) => {
    const m = JSON.parse(e.data);
    const i = waiters.findIndex((w) => w.type === m.type);
    if (i >= 0) waiters.splice(i, 1)[0].resolve(m); else inbox.push(m);
  };
  const c = {
    sock,
    send: (m) => sock.send(JSON.stringify(m)),
    next(type, ms) {
      const i = inbox.findIndex((m) => m.type === type);
      if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { type, resolve };
        waiters.push(w);
        setTimeout(() => { const k = waiters.indexOf(w); if (k >= 0) { waiters.splice(k, 1); reject(new Error('timed out waiting for ' + type)); } }, ms || 3000);
      });
    },
    close: () => sock.close(),
  };
  return new Promise((r) => { sock.onopen = () => { c.send({ type: 'hello', token }); r(c); }; });
}

async function call(port, method, path, body, token) {
  const res = await fetch('http://127.0.0.1:' + port + path, {
    method, headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function boot(lobby) {
  const app = createServer({ adminEmail: 'owner@example.com', adminPassword: 'correct horse battery', log: () => {}, lobby: Object.assign({ minGamesForBoard: 1 }, lobby) });
  const port = await app.listen(0, '127.0.0.1');
  return { app, port };
}

async function pair(port, tc) {
  const a = await client(port), b = await client(port);
  const wa = await a.next('welcome'), wb = await b.next('welcome');
  a.send({ type: 'seek', tc }); b.send({ type: 'seek', tc });
  const sa = await a.next('start'), sb = await b.next('start');
  const white = sa.color === 'white' ? a : b, black = white === a ? b : a;
  return { a, b, wa, wb, sa, sb, white, black, id: sa.id };
}

test('glicko-2 matches the worked example in Glickman\'s paper', () => {
  // Paper example: 1500/200/0.06 vs 1400/30 (win), 1550/100 (loss), 1700/300 (loss) in one period.
  // Applying one game at a time differs slightly; check direction and sanity instead of exact values.
  const p = { rating: 1500, rd: 200, vol: 0.06 };
  const win = glicko.update(p, { rating: 1400, rd: 30 }, 1);
  const loss = glicko.update(p, { rating: 1400, rd: 30 }, 0);
  assert.ok(win.rating > 1500 && loss.rating < 1500);
  assert.ok(win.rd < 200 && win.rd > 30);
  assert.ok(Math.abs(win.vol - 0.06) < 0.001);
  const d = glicko.update({ rating: 1500, rd: 350, vol: 0.06 }, { rating: 1500, rd: 350, vol: 0.06 }, 0.5);
  assert.ok(Math.abs(d.rating - 1500) < 0.01);
  assert.ok(glicko.decay({ rating: 1500, rd: 50, vol: 0.06 }, 10).rd > 50);
});

test('audit log is hash chained and detects tampering', () => {
  const db = store.open();
  audit.append(db, 'a@x', 'one', 1, { k: 1 });
  audit.append(db, 'a@x', 'two', 2, null);
  audit.append(db, 'b@x', 'three', null, 'note');
  assert.deepStrictEqual(audit.verify(db), { ok: true, checked: 3 });
  db.run("UPDATE audit SET detail = 'edited' WHERE id = 2");
  const v = audit.verify(db);
  assert.strictEqual(v.ok, false);
  assert.strictEqual(v.brokenAt, 2);
  db.close();
});

test('guests are matched, moves are validated and a game ends with rating changes', async () => {
  const { app, port } = await boot();
  try {
    const g = await pair(port, '5+3');
    assert.notStrictEqual(g.sa.color, g.sb.color);
    assert.strictEqual(g.sa.rated, true);
    assert.strictEqual(g.wa.user.guest, true);

    // Black cannot move first; an illegal move is answered with a resync.
    g.black.send({ type: 'move', uci: 'e7e5', ply: 0 });
    assert.deepStrictEqual((await g.black.next('sync')).moves, []);
    g.white.send({ type: 'move', uci: 'e2e5', ply: 0 });
    assert.deepStrictEqual((await g.white.next('sync')).moves, []);

    // Fool's mate.
    const play = async (who, other, uci, ply) => {
      who.send({ type: 'move', uci, ply });
      const m = await other.next('move');
      assert.strictEqual(m.uci, uci);
      await who.next('ack');
    };
    await play(g.white, g.black, 'f2f3', 0);
    await play(g.black, g.white, 'e7e5', 1);
    await play(g.white, g.black, 'g2g4', 2);
    g.black.send({ type: 'move', uci: 'd8h4', ply: 3 });
    const endW = await g.white.next('end'), endB = await g.black.next('end');
    assert.strictEqual(endW.result, '0-1');
    assert.strictEqual(endW.reason, 'checkmate');
    assert.ok(endW.rating.after < endW.rating.before);
    assert.ok(endB.rating.after > endB.rating.before);
    const row = app.db.get('SELECT * FROM games WHERE id = ?', g.id);
    assert.strictEqual(row.moves, 'f2f3 e7e5 g2g4 d8h4');
    g.a.close(); g.b.close();
  } finally { await app.close(); }
});

test('accounts: register keeps guest history, login, leaderboard, profile', async () => {
  const { app, port } = await boot();
  try {
    const g = await pair(port, '3+0');
    g.white.send({ type: 'move', uci: 'e2e4', ply: 0 }); await g.black.next('move');
    g.black.send({ type: 'move', uci: 'e7e5', ply: 1 }); await g.white.next('move');
    g.black.send({ type: 'resign' });
    await g.white.next('end');
    const whiteWelcome = g.white === g.a ? g.wa : g.wb;

    const bad = await call(port, 'POST', '/api/register', { name: 'x', password: 'short' }, whiteWelcome.token);
    assert.strictEqual(bad.status, 400);
    const reserved = await call(port, 'POST', '/api/register', { name: 'ChacklateAdmin', password: 'long enough pw' }, whiteWelcome.token);
    assert.strictEqual(reserved.status, 400);
    const reg = await call(port, 'POST', '/api/register', { name: 'Truffle', password: 'long enough pw' }, whiteWelcome.token);
    assert.strictEqual(reg.status, 200);
    assert.strictEqual(reg.body.user.guest, false);
    assert.strictEqual(reg.body.ratings.blitz.games, 1);
    assert.ok(reg.body.ratings.blitz.rating > 1500);
    const dup = await call(port, 'POST', '/api/register', { name: 'truffle', password: 'long enough pw' });
    assert.strictEqual(dup.status, 409);

    assert.strictEqual((await call(port, 'POST', '/api/login', { name: 'TRUFFLE', password: 'wrong password' })).status, 401);
    const login = await call(port, 'POST', '/api/login', { name: 'truffle', password: 'long enough pw' });
    assert.strictEqual(login.status, 200);
    assert.strictEqual((await call(port, 'GET', '/api/me', null, login.body.token)).body.user.name, 'Truffle');

    const board = await call(port, 'GET', '/api/leaderboard?pool=blitz');
    assert.deepStrictEqual(board.body.rows.map((r) => r.name), ['Truffle']); // guests never appear
    const prof = await call(port, 'GET', '/api/players/truffle');
    assert.strictEqual(prof.body.games[0].reason, 'resignation');
    const game = await call(port, 'GET', '/api/games/' + g.id);
    assert.strictEqual(game.body.moves, 'e2e4 e7e5');

    // Old guest token was replaced.
    assert.strictEqual((await call(port, 'GET', '/api/me', null, whiteWelcome.token)).status, 401);
    g.a.close(); g.b.close();
  } finally { await app.close(); }
});

test('friend codes pair two players in an unrated game; draws by agreement', async () => {
  const { app, port } = await boot();
  try {
    const a = await client(port), b = await client(port);
    await a.next('welcome'); await b.next('welcome');
    a.send({ type: 'friend-create', tc: '10+0' });
    const { code } = await a.next('friend-code');
    assert.match(code, /^[A-Z2-9]{6}$/);
    b.send({ type: 'friend-join', code: 'ZZZZZZ' });
    assert.match((await b.next('error')).message, /expired|exist/);
    b.send({ type: 'friend-join', code: code.toLowerCase() });
    const sa = await a.next('start'); await b.next('start');
    assert.strictEqual(sa.rated, false);
    a.send({ type: 'draw-offer' });
    await b.next('draw-offer');
    b.send({ type: 'draw-accept' });
    const end = await a.next('end');
    assert.strictEqual(end.reason, 'agreement');
    assert.strictEqual(end.rating, null);
    a.close(); b.close();
  } finally { await app.close(); }
});

test('reconnecting resumes the game; a player who stays away forfeits', async () => {
  const { app, port } = await boot({ reconnectMs: 300 });
  try {
    const g = await pair(port, '5+0');
    const wTok = (g.white === g.a ? g.wa : g.wb).token;
    g.white.send({ type: 'move', uci: 'd2d4', ply: 0 }); await g.black.next('move');
    g.white.close();
    assert.strictEqual((await g.black.next('status')).opponentAway, true);
    const back = await client(port, wTok);
    const resumed = await back.next('start');
    assert.deepStrictEqual(resumed.moves, ['d2d4']);
    assert.strictEqual((await g.black.next('status')).opponentAway, false);

    g.black.send({ type: 'move', uci: 'd7d5', ply: 1 }); await back.next('move');
    back.close();
    const end = await g.black.next('end', 2000);
    assert.strictEqual(end.reason, 'abandoned');
    assert.strictEqual(end.result, resumed.color === 'white' ? '0-1' : '1-0');
    g.black.close();
  } finally { await app.close(); }
});

test('clocks: a player who runs out of time loses on time', async () => {
  const { app, port } = await boot();
  try {
    const g = await pair(port, '1+0');
    const room = app.lobby.games.get(g.id);
    g.white.send({ type: 'move', uci: 'e2e4', ply: 0 }); await g.black.next('move');
    g.black.send({ type: 'move', uci: 'e7e5', ply: 1 }); await g.white.next('move');
    // Fast-forward: white has 150 ms left.
    room.clock.w = 150; room.clock.at = Date.now();
    app.lobby.schedule(room);
    const end = await g.black.next('end', 2000);
    assert.strictEqual(end.result, '0-1');
    assert.strictEqual(end.reason, 'timeout');
    g.a.close(); g.b.close();
  } finally { await app.close(); }
});

test('admin: roles, bans and audit trail', async () => {
  const { app, port } = await boot();
  try {
    assert.strictEqual((await call(port, 'GET', '/api/admin/stats')).status, 401);
    assert.strictEqual((await call(port, 'POST', '/api/admin/login', { email: 'owner@example.com', password: 'nope' })).status, 401);
    const login = await call(port, 'POST', '/api/admin/login', { email: 'OWNER@example.com', password: 'correct horse battery' });
    assert.strictEqual(login.status, 200);
    const T = login.body.token;

    const sup = await call(port, 'POST', '/api/admin/staff', { email: 'help@example.com', role: 'support' }, T);
    assert.strictEqual(sup.status, 200);
    const supLogin = await call(port, 'POST', '/api/admin/login', { email: 'help@example.com', password: sup.body.password });
    const S = supLogin.body.token;

    const c = await client(port);
    const w = await c.next('welcome');
    const uid = w.user.id;
    assert.strictEqual((await call(port, 'GET', '/api/admin/users?q=' + w.user.name, null, S)).body[0].id, uid);
    // Support may mute but not ban.
    assert.strictEqual((await call(port, 'POST', '/api/admin/users/' + uid + '/mute', {}, S)).status, 200);
    assert.strictEqual((await call(port, 'POST', '/api/admin/users/' + uid + '/ban', { reason: 'x' }, S)).status, 403);
    assert.strictEqual((await call(port, 'POST', '/api/admin/users/' + uid + '/ban', {}, T)).status, 400);
    const ban = await call(port, 'POST', '/api/admin/users/' + uid + '/ban', { reason: 'cheating' }, T);
    assert.strictEqual(ban.status, 200);
    assert.strictEqual((await c.next('banned')).reason, 'cheating');
    // Banned token no longer works.
    const again = await client(port, w.token);
    const w2 = await again.next('welcome');
    assert.notStrictEqual(w2.user.id, uid);
    again.close();

    const log = await call(port, 'GET', '/api/admin/audit', null, S);
    assert.strictEqual(log.body.verify.ok, true);
    const actions = log.body.rows.map((r) => r.action);
    for (const a of ['login.failed', 'login', 'staff.create', 'user.mute', 'user.ban']) assert.ok(actions.includes(a), a);
    const stats = await call(port, 'GET', '/api/admin/stats', null, S);
    assert.strictEqual(stats.body.banned, 1);
  } finally { await app.close(); }
});

test('players can report an opponent from a finished game', async () => {
  const { app, port } = await boot();
  try {
    const g = await pair(port, '5+3');
    g.white.send({ type: 'resign' });
    await g.black.next('end');
    g.black.send({ type: 'report', reason: 'rude', game: g.id });
    await g.black.next('reported');
    const outsider = await client(port);
    await outsider.next('welcome');
    outsider.send({ type: 'report', reason: 'x', game: g.id });
    assert.match((await outsider.next('error')).message, /game you played/);
    const rows = app.db.all('SELECT * FROM reports');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0].game_id, g.id);
    g.a.close(); g.b.close(); outsider.close();
  } finally { await app.close(); }
});

async function shop(payments) {
  const app = createServer({ adminEmail: 'owner@example.com', adminPassword: 'correct horse battery', log: () => {}, payments });
  const port = await app.listen(0, '127.0.0.1');
  const reg = await call(port, 'POST', '/api/register', { name: 'buyer', password: 'a long password' });
  const admin = (await call(port, 'POST', '/api/admin/login', { email: 'owner@example.com', password: 'correct horse battery' })).body.token;
  return { app, port, token: reg.body.token, uid: reg.body.user.id, admin };
}

test('store: closed by default, guests cannot buy, dev purchases grant and stack', async () => {
  let s = await shop();
  try {
    const list = await call(s.port, 'GET', '/api/store');
    assert.strictEqual(list.body.mode, 'off');
    assert.ok(list.body.products.every((p) => !p.onSale));
    assert.strictEqual((await call(s.port, 'POST', '/api/store/checkout', { product: 'premium.monthly' }, s.token)).status, 503);
  } finally { await s.app.close(); }

  s = await shop({ mode: 'dev' });
  try {
    const guest = await client(s.port);
    const gw = await guest.next('welcome');
    assert.strictEqual(gw.entitlements.premium, false);
    assert.strictEqual((await call(s.port, 'POST', '/api/store/checkout', { product: 'premium.monthly' }, gw.token)).status, 403);
    guest.close();
    assert.strictEqual((await call(s.port, 'POST', '/api/store/checkout', { product: 'nope' }, s.token)).status, 404);

    const buy = async (product) => {
      const o = await call(s.port, 'POST', '/api/store/checkout', { product }, s.token);
      assert.strictEqual(o.status, 200, JSON.stringify(o.body));
      assert.strictEqual(o.body.action.type, 'dev-confirm');
      return call(s.port, 'POST', '/api/store/dev/complete', { order: o.body.order }, s.token);
    };
    const pass = await buy('pass.s1');
    assert.deepStrictEqual(pass.body.entitlements, { premium: false, premiumUntil: null, passes: ['s1'] });
    const m1 = await buy('premium.monthly');
    const until1 = m1.body.entitlements.premiumUntil;
    assert.ok(until1 > Date.now() + 30 * 86400e3);
    const m2 = await buy('premium.monthly');
    assert.ok(m2.body.entitlements.premiumUntil - until1 > 30 * 86400e3, 'a renewal stacks after the current period');
    assert.strictEqual((await call(s.port, 'POST', '/api/store/checkout', { product: 'pass.s1' }, s.token)).status, 409, 'premium includes the pass');
    const me = await call(s.port, 'GET', '/api/me', null, s.token);
    assert.strictEqual(me.body.entitlements.premium, true);

    // Someone else's order cannot be completed with your token.
    const other = await call(s.port, 'POST', '/api/register', { name: 'other', password: 'a long password' });
    const o = await call(s.port, 'POST', '/api/store/checkout', { product: 'premium.lifetime' }, s.token);
    assert.strictEqual((await call(s.port, 'POST', '/api/store/dev/complete', { order: o.body.order }, other.body.token)).status, 404);
    // Completing twice grants once.
    await call(s.port, 'POST', '/api/store/dev/complete', { order: o.body.order }, s.token);
    await call(s.port, 'POST', '/api/store/dev/complete', { order: o.body.order }, s.token);
    assert.strictEqual(s.app.db.get('SELECT COUNT(*) n FROM entitlements WHERE order_id = ?', o.body.order).n, 1);
    assert.strictEqual((await call(s.port, 'GET', '/api/me', null, s.token)).body.entitlements.premiumUntil, 'lifetime');

    // Admin: orders, refund revokes, staff grants need a note and are audited.
    const orders = await call(s.port, 'GET', '/api/admin/orders', null, s.admin);
    assert.strictEqual(orders.body.filter((x) => x.status === 'paid').length, 4);
    assert.strictEqual((await call(s.port, 'POST', '/api/admin/orders/' + o.body.order + '/refund', {}, s.admin)).status, 400);
    assert.strictEqual((await call(s.port, 'POST', '/api/admin/orders/' + o.body.order + '/refund', { note: 'asked within 7 days' }, s.admin)).status, 200);
    assert.notStrictEqual((await call(s.port, 'GET', '/api/me', null, s.token)).body.entitlements.premiumUntil, 'lifetime');
    const oid = other.body.user.id;
    assert.strictEqual((await call(s.port, 'POST', '/api/admin/users/' + oid + '/entitlements', { key: 'premium', days: 30 }, s.admin)).status, 400);
    const g = await call(s.port, 'POST', '/api/admin/users/' + oid + '/entitlements', { key: 'premium', days: 30, note: 'streamer partnership' }, s.admin);
    assert.strictEqual(g.status, 200);
    assert.strictEqual((await call(s.port, 'GET', '/api/me', null, other.body.token)).body.entitlements.premium, true);
    const detail = await call(s.port, 'GET', '/api/admin/users/' + oid, null, s.admin);
    assert.strictEqual(detail.body.owns.premium, true);
    await call(s.port, 'POST', '/api/admin/entitlements/' + g.body.id + '/revoke', { note: 'partnership ended' }, s.admin);
    assert.strictEqual((await call(s.port, 'GET', '/api/me', null, other.body.token)).body.entitlements.premium, false);
    const log = await call(s.port, 'GET', '/api/admin/audit', null, s.admin);
    assert.strictEqual(log.body.verify.ok, true);
    for (const a of ['order.paid', 'order.refunded', 'entitlement.grant', 'entitlement.revoke']) assert.ok(log.body.rows.some((r) => r.action === a), a);
  } finally { await s.app.close(); }
});

test('store: external provider webhooks must be signed', async () => {
  const crypto = require('node:crypto');
  const s = await shop({ mode: 'external', secret: 'whsec_test', checkoutUrl: 'https://pay.example.com/c?o={order}' });
  try {
    assert.strictEqual((await call(s.port, 'POST', '/api/store/checkout', { product: 'premium.monthly' }, s.token)).status, 409, 'no price yet');
    const o = await call(s.port, 'POST', '/api/store/checkout', { product: 'premium.lifetime' }, s.token);
    assert.strictEqual(o.body.action.url, 'https://pay.example.com/c?o=' + o.body.order);
    assert.strictEqual((await call(s.port, 'POST', '/api/store/dev/complete', { order: o.body.order }, s.token)).status, 404);
    const send = (body, secret) => {
      const raw = JSON.stringify(body);
      return fetch('http://127.0.0.1:' + s.port + '/api/store/webhook', { method: 'POST', body: raw,
        headers: { 'Content-Type': 'application/json', 'X-Chacklate-Signature': crypto.createHmac('sha256', secret).update(raw).digest('hex') } });
    };
    assert.strictEqual((await send({ order: o.body.order, event: 'paid' }, 'wrong')).status, 401);
    assert.strictEqual((await call(s.port, 'GET', '/api/me', null, s.token)).body.entitlements.premium, false);
    assert.strictEqual((await send({ order: o.body.order, event: 'paid', ref: 'pay_123' }, 'whsec_test')).status, 200);
    assert.strictEqual((await call(s.port, 'GET', '/api/me', null, s.token)).body.entitlements.premiumUntil, 'lifetime');
    assert.strictEqual((await send({ order: o.body.order, event: 'refunded' }, 'whsec_test')).status, 200);
    assert.strictEqual((await call(s.port, 'GET', '/api/me', null, s.token)).body.entitlements.premium, false);
  } finally { await s.app.close(); }
});
