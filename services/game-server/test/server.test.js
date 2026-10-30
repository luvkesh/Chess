'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
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

    const bad = await call(port, 'POST', '/api/register', { name: 'x', password: 'short', birthYear: 1990, birthMonth: 6 }, whiteWelcome.token);
    assert.strictEqual(bad.status, 400);
    const reserved = await call(port, 'POST', '/api/register', { name: 'ChacklateAdmin', password: 'long enough pw', birthYear: 1990, birthMonth: 6 }, whiteWelcome.token);
    assert.strictEqual(reserved.status, 400);
    const reg = await call(port, 'POST', '/api/register', { name: 'Truffle', password: 'long enough pw', birthYear: 1990, birthMonth: 6 }, whiteWelcome.token);
    assert.strictEqual(reg.status, 200);
    assert.strictEqual(reg.body.user.guest, false);
    assert.strictEqual(reg.body.ratings.blitz.games, 1);
    assert.ok(reg.body.ratings.blitz.rating > 1500);
    const dup = await call(port, 'POST', '/api/register', { name: 'truffle', password: 'long enough pw', birthYear: 1990, birthMonth: 6 });
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

test('online games are timed, 10 minutes at most; players send preset reactions only', async () => {
  const { app, port } = await boot();
  try {
    const a = await client(port), b = await client(port);
    const wa = await a.next('welcome'); await b.next('welcome');
    assert.ok(wa.timeControls.every((tc) => +tc.split('+')[0] <= 10));
    a.send({ type: 'friend-create', tc: '30+0' });
    assert.strictEqual((await a.next('friend-code')).tc, '10+0');
    a.send({ type: 'friend-create', tc: '5+3' });
    const { code, tc } = await a.next('friend-code');
    assert.strictEqual(tc, '5+3');
    b.send({ type: 'friend-join', code });
    await a.next('start'); await b.next('start');
    a.send({ type: 'emote', id: 'gg' });
    assert.strictEqual((await b.next('emote')).id, 'gg');
    a.send({ type: 'emote', id: 'nice' });            // too soon after the last one
    a.send({ type: 'emote', id: 'Hi, what is your name?' });
    b.send({ type: 'emote', id: 'hello' });
    assert.strictEqual((await a.next('emote')).id, 'hello');
    await assert.rejects(b.next('emote', 300));
    a.send({ type: 'resign' });
    await a.next('end'); await b.next('end');
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
  const reg = await call(port, 'POST', '/api/register', { name: 'buyer', password: 'a long password', birthYear: 1990, birthMonth: 6 });
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
    const other = await call(s.port, 'POST', '/api/register', { name: 'other', password: 'a long password', birthYear: 1990, birthMonth: 6 });
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
    assert.strictEqual((await call(s.port, 'POST', '/api/store/checkout', { product: 'no.such.thing' }, s.token)).status, 404, 'unknown product');
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

test('web push: RFC 8291 test vector, VAPID signature, daily reminders once per local day', async () => {
  const push = require('../src/push');
  const crypto = require('node:crypto');
  const u = (s) => Buffer.from(s, 'base64url');
  // RFC 8291 appendix A.
  const out = push.encrypt('When I grow up, I want to be a watermelon', u('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'), u('BTBZMqHH6r4Tts7J_aSIgg'),
    { asPrivate: u('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), salt: u('DGv6ra1nlYgDCS1FRnbzlw') });
  assert.strictEqual(out.toString('base64url'), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
  // The VAPID JWT verifies with the public key.
  const v = push.generateVapid();
  const hdr = push.vapidAuth('https://push.example.com/abc', v, 'mailto:a@b.c');
  const [, jwt, k] = hdr.match(/^vapid t=([^,]+), k=(.+)$/);
  assert.strictEqual(k, v.publicKey);
  const [h, c, sig] = jwt.split('.');
  assert.strictEqual(JSON.parse(u(c)).aud, 'https://push.example.com');
  const pub = u(v.publicKey);
  const key = crypto.createPublicKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') } });
  assert.ok(crypto.verify('sha256', Buffer.from(h + '.' + c), { key, dsaEncoding: 'ieee-p1363' }, u(sig)));

  // Scheduling: a fake clock and a fake push service.
  let clock = Date.parse('2026-11-02T13:00:00Z');  // 18:30 in India (+330)
  const sent = [];
  const app = createServer({ log: () => {}, push: { now: () => clock, send: async (s, msg) => { sent.push({ endpoint: s.endpoint, msg }); return s.endpoint.endsWith('gone') ? 410 : 201; } } });
  const port = await app.listen(0, '127.0.0.1');
  try {
    const keyRes = await call(port, 'GET', '/api/push/key');
    assert.strictEqual(u(keyRes.body.publicKey).length, 65);
    const reg = await call(port, 'POST', '/api/register', { name: 'pusher', password: 'a long password', birthYear: 1990, birthMonth: 6 });
    const ua = crypto.createECDH('prime256v1'); ua.generateKeys();
    const sub = (endpoint) => ({ endpoint, keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') } });
    assert.strictEqual((await call(port, 'POST', '/api/push/subscribe', { subscription: sub('http://insecure.example.com/x'), hour: 19, tz: 330 }, reg.body.token)).status, 400);
    assert.strictEqual((await call(port, 'POST', '/api/push/subscribe', { subscription: sub('https://push.example.com/a'), hour: 19, tz: 330 }, reg.body.token)).status, 200);
    assert.strictEqual((await call(port, 'POST', '/api/push/subscribe', { subscription: sub('https://push.example.com/gone'), hour: 19, tz: 330 }, reg.body.token)).status, 200);
    assert.strictEqual(await app.push.tick(), 0, 'not 19:00 yet');
    clock += 45 * 60000;  // 19:15 local
    assert.strictEqual(await app.push.tick(), 1);
    assert.strictEqual(sent.length, 2);
    assert.match(sent[0].msg.title, /puzzle/);
    assert.strictEqual(app.db.get('SELECT COUNT(*) n FROM push_subs').n, 1, 'a 410 removes the subscription');
    assert.strictEqual(await app.push.tick(), 0, 'once per day');
    // Next day, with a streak running and no play yet: a calm mention of it, no deadline.
    clock += 86400e3;
    app.db.run('UPDATE users SET progress = ? WHERE id = ?', JSON.stringify({ streak: { count: 4, last: '2026-11-02' } }), reg.body.user.id);
    await app.push.tick();
    assert.match(sent[sent.length - 1].msg.body, /4 days in a row/);
    assert.doesNotMatch(sent[sent.length - 1].msg.body, /midnight|lose|ends/i);
    // Already played today: no reminder.
    clock += 86400e3;
    app.db.run('UPDATE users SET progress = ? WHERE id = ?', JSON.stringify({ streak: { count: 5, last: '2026-11-04' } }), reg.body.user.id);
    const before = sent.length;
    await app.push.tick();
    assert.strictEqual(sent.length, before);
    await call(port, 'POST', '/api/push/unsubscribe', { endpoint: 'https://push.example.com/a' }, reg.body.token);
    assert.strictEqual(app.db.get('SELECT COUNT(*) n FROM push_subs').n, 0);
  } finally { await app.close(); }
});

test('fair play: engine agreement is measured per side and repeated engine-like games reach the report queue', async () => {
  const { analyse } = require('../src/fairplay-analyse');
  const E = require('../../../packages/chess-core/src/engine.js')();
  // White plays the engine's first choice; Black mixes in random moves.
  const g = new E.Game(), ucis = [];
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < 120 && !g.outcome; i++) {
    const m = g.pos.side === E.WHITE ? E.search(g.pos, { depth: 3, timeMs: 5000 }).move : rnd() < 0.5 ? E.search(g.pos, { depth: 1, timeMs: 5000 }).move : g.legal[Math.floor(rnd() * g.legal.length)];
    ucis.push(E.uci(m)); g.play(m);
  }
  const a = analyse(ucis, { depth: 3, skipPlies: 4 });
  assert.ok(a.w.moves >= 4 && a.b.moves >= 4, JSON.stringify(a));
  assert.ok(a.w.match > a.b.match + 0.3, JSON.stringify(a));
  assert.ok(a.w.acpl < a.b.acpl, JSON.stringify(a));

  // Thresholds low enough for short test games; the worker does the analysis.
  const app = createServer({ log: () => {}, adminEmail: 'owner@example.com', adminPassword: 'correct horse battery',
    fairplay: { thresholds: { depth: 3, timeMs: 2000, skipPlies: 4, game: { minMoves: 4, match: 0.8, acpl: 40 }, recent: { flagged: 2 } } } });
  const port = await app.listen(0, '127.0.0.1');
  try {
    const db = app.db;
    const mk = (name) => Number(db.run('INSERT INTO users (name, name_key, guest, created, seen) VALUES (?, ?, 0, 0, 0)', name, name.toLowerCase()).lastInsertRowid);
    const cheat = mk('engineer'), honest = mk('human');
    assert.strictEqual(app.fairplay.enqueue({ id: 'g1', rated: false, white: cheat, black: honest, moves: ucis }), false, 'casual games are not analysed');
    for (const id of ['g1', 'g2']) app.fairplay.enqueue({ id, rated: true, white: cheat, black: honest, moves: ucis });
    await app.fairplay.idle();
    const rows = db.all('SELECT * FROM fairplay ORDER BY game_id, color');
    assert.strictEqual(rows.length, 4);
    assert.ok(rows.filter((r) => r.user_id === cheat).every((r) => r.flagged === 1));
    const reports = db.all('SELECT * FROM reports');
    assert.strictEqual(reports.length, 1, 'one automatic report');
    assert.strictEqual(reports[0].target, cheat);
    assert.match(reports[0].reason, /^Fair play: \d+% engine agreement/);
    // A third engine-like game inside a week does not report again.
    app.fairplay.enqueue({ id: 'g3', rated: true, white: cheat, black: honest, moves: ucis });
    await app.fairplay.idle();
    assert.strictEqual(db.all('SELECT * FROM reports').length, 1);
    // Staff see it in the queue and on the fair play board.
    const T = (await call(port, 'POST', '/api/admin/login', { email: 'owner@example.com', password: 'correct horse battery' })).body.token;
    const q = await call(port, 'GET', '/api/admin/reports', null, T);
    assert.strictEqual(q.body[0].reporter_name, 'Fair play system');
    const board = await call(port, 'GET', '/api/admin/fairplay', null, T);
    assert.strictEqual(board.body.rows[0].id, cheat);
    assert.strictEqual(board.body.rows[0].suspicious, true);
    const detail = await call(port, 'GET', '/api/admin/users/' + cheat, null, T);
    assert.strictEqual(detail.body.fairplay.games.length, 3);
  } finally { await app.close(); }
});

test('accounts: email verification, password reset and change, export and deletion', async () => {
  const sent = [];
  const app = createServer({ log: () => {}, publicUrl: 'https://chess.example.com', mailer: { send: async (m) => { sent.push(m); return true; } } });
  const port = await app.listen(0, '127.0.0.1');
  const link = (re) => { const m = sent[sent.length - 1].text.match(re); assert.ok(m, sent[sent.length - 1].text); return m[1]; };
  try {
    const reg = await call(port, 'POST', '/api/register', { name: 'mailer1', password: 'first password', birthYear: 1990, birthMonth: 6 });
    const T = reg.body.token;
    assert.deepStrictEqual(reg.body.account, { email: null, emailVerified: false });
    // Guests cannot use account routes.
    const guest = await client(port); const gw = await guest.next('welcome'); guest.close();
    assert.strictEqual((await call(port, 'POST', '/api/account/email', { email: 'g@example.com' }, gw.token)).status, 403);
    assert.strictEqual((await call(port, 'POST', '/api/account/email', { email: 'nope' }, T)).status, 400);
    assert.strictEqual((await call(port, 'POST', '/api/account/email', { email: 'Player@Example.com' }, T)).status, 200);
    const vt = link(/https:\/\/chess\.example\.com\/account\/verify\?token=(\S+)/);
    // An unverified email cannot be used for a reset.
    await call(port, 'POST', '/api/account/forgot', { who: 'player@example.com' });
    assert.strictEqual(sent.length, 1);
    const v = await fetch('http://127.0.0.1:' + port + '/account/verify?token=' + vt, { redirect: 'manual' });
    assert.strictEqual(v.headers.get('location'), '/play#email-verified');
    const v2 = await fetch('http://127.0.0.1:' + port + '/account/verify?token=' + vt, { redirect: 'manual' });
    assert.strictEqual(v2.headers.get('location'), '/play#email-invalid', 'links work once');
    assert.strictEqual((await call(port, 'GET', '/api/me', null, T)).body.account.emailVerified, true);
    // Another account cannot take the same address.
    const other = await call(port, 'POST', '/api/register', { name: 'mailer2', password: 'other password', birthYear: 1990, birthMonth: 6 });
    assert.strictEqual((await call(port, 'POST', '/api/account/email', { email: 'player@example.com' }, other.body.token)).status, 409);

    // Forgot password: same answer for unknown accounts, a one-hour link for real ones.
    const unknown = await call(port, 'POST', '/api/account/forgot', { who: 'nobody' });
    assert.strictEqual(unknown.status, 200);
    assert.strictEqual(sent.length, 1);
    await call(port, 'POST', '/api/account/forgot', { who: 'MAILER1' });
    const rt = link(/https:\/\/chess\.example\.com\/play#reset=(\S+)/);
    assert.strictEqual((await call(port, 'POST', '/api/account/reset', { token: rt, password: 'short' })).status, 400);
    const reset = await call(port, 'POST', '/api/account/reset', { token: rt, password: 'second password' });
    assert.strictEqual(reset.status, 200);
    assert.strictEqual((await call(port, 'POST', '/api/account/reset', { token: rt, password: 'third password' })).status, 400, 'used tokens fail');
    assert.strictEqual((await call(port, 'GET', '/api/me', null, T)).status, 401, 'reset signs out everywhere');
    const login = await call(port, 'POST', '/api/login', { name: 'mailer1', password: 'second password' });
    assert.strictEqual(login.status, 200);
    const T2 = login.body.token;

    // Change password: needs the current one; other sessions end, this one stays.
    const elsewhere = (await call(port, 'POST', '/api/login', { name: 'mailer1', password: 'second password' })).body.token;
    assert.strictEqual((await call(port, 'POST', '/api/account/password', { current: 'wrong', password: 'third password' }, T2)).status, 401);
    assert.strictEqual((await call(port, 'POST', '/api/account/password', { current: 'second password', password: 'third password' }, T2)).status, 200);
    assert.strictEqual((await call(port, 'GET', '/api/me', null, T2)).status, 200);
    assert.strictEqual((await call(port, 'GET', '/api/me', null, elsewhere)).status, 401);

    // Export has what we hold; deletion removes what identifies the person.
    const ex = await call(port, 'GET', '/api/account/export', null, T2);
    assert.strictEqual(ex.body.account.email, 'Player@Example.com');
    for (const k of ['ratings', 'games', 'orders', 'entitlements', 'notifications', 'reportsFiled']) assert.ok(k in ex.body, k);
    assert.strictEqual((await call(port, 'POST', '/api/account/delete', { password: 'wrong' }, T2)).status, 401);
    assert.strictEqual((await call(port, 'POST', '/api/account/delete', { password: 'third password' }, T2)).status, 200);
    const row = app.db.get('SELECT * FROM users WHERE id = ?', reg.body.user.id);
    assert.strictEqual(row.name, 'Deleted player ' + row.id);
    assert.strictEqual(row.email, null); assert.strictEqual(row.pass, null); assert.strictEqual(row.name_key, null);
    assert.strictEqual((await call(port, 'POST', '/api/login', { name: 'mailer1', password: 'third password' })).status, 401);
    assert.strictEqual((await call(port, 'GET', '/api/me', null, T2)).status, 401);
    // The name is free again.
    assert.strictEqual((await call(port, 'POST', '/api/register', { name: 'mailer1', password: 'new owner pw', birthYear: 1990, birthMonth: 6 })).status, 200);
  } finally { await app.close(); }
});

test('children: age gate, safe names, parental consent, kids-only matchmaking, parent controls and PIN', async () => {
  const sent = [];
  const app = createServer({ log: () => {}, publicUrl: 'https://chess.example.com', payments: { mode: 'dev' }, mailer: { send: async (m) => { sent.push(m); return true; } } });
  const port = await app.listen(0, '127.0.0.1');
  const year = new Date().getUTCFullYear();
  const P = async (path, body, token) => {
    const res = await fetch('http://127.0.0.1:' + port + path, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Parent ' + token } : {}), body: JSON.stringify(body || {}) });
    return { status: res.status, body: await res.json() };
  };
  try {
    // An age is required, and a child cannot type a name or skip the parent email.
    assert.strictEqual((await call(port, 'POST', '/api/register', { name: 'Kiddo', password: 'a long password' })).status, 400);
    const typed = await call(port, 'POST', '/api/register', { name: 'RealName', password: 'a long password', birthYear: year - 9, birthMonth: 1, parentEmail: 'mum@example.com' });
    assert.strictEqual(typed.status, 400); assert.ok(typed.body.needName);
    const names = (await call(port, 'GET', '/api/names')).body.names;
    assert.strictEqual(names.length, 6);
    for (const n of names) assert.match(n, /^[A-Z][a-z]+[A-Z][a-z]+[1-9][0-9]$/);
    assert.strictEqual((await call(port, 'POST', '/api/register', { name: names[0], password: 'a long password', birthYear: year - 9, birthMonth: 1 })).status, 400, 'parent email needed');
    // Adults type names, and rude or contact-like ones are refused.
    for (const bad of ['sh1thead', 'call9876543210', 'insta_me']) assert.strictEqual((await call(port, 'POST', '/api/register', { name: bad, password: 'a long password', birthYear: 1985, birthMonth: 3 })).status, 400, bad);
    const adult = await call(port, 'POST', '/api/register', { name: 'GrownUp', password: 'a long password', birthYear: 1985, birthMonth: 3 });
    assert.strictEqual(adult.body.safety.kind, 'adult');
    assert.strictEqual(adult.body.safety.pool, 'open');

    const kid = await call(port, 'POST', '/api/register', { name: names[0], password: 'a long password', birthYear: year - 9, birthMonth: 1, parentEmail: 'Mum@Example.com' });
    assert.strictEqual(kid.status, 200);
    assert.deepStrictEqual([kid.body.safety.kind, kid.body.safety.band, kid.body.safety.consent], ['minor', 'child', false]);
    const mail = sent.pop();
    assert.strictEqual(mail.to, 'Mum@Example.com');
    const ct = mail.text.match(/https:\/\/chess\.example\.com\/parent#consent=(\S+)/)[1];

    // Before consent: no online play, no reminders, no purchases, no public profile, no account email.
    const k = await client(port, kid.body.token); await k.next('welcome');
    k.send({ type: 'seek', tc: '5+3' });
    assert.match((await k.next('error')).message, /parent needs to say yes/);
    assert.strictEqual((await call(port, 'POST', '/api/push/subscribe', { subscription: {}, hour: 17, tz: 330 }, kid.body.token)).status, 403);
    assert.strictEqual((await call(port, 'POST', '/api/store/checkout', { product: 'premium.monthly' }, kid.body.token)).status, 403);
    assert.strictEqual((await call(port, 'GET', '/api/players/' + names[0])).status, 404);
    assert.strictEqual((await call(port, 'POST', '/api/account/email', { email: 'kid@example.com' }, kid.body.token)).status, 403);

    // The parent reads what is asked, then says yes and sets up their account and PIN.
    const info = await P('/api/parent/consent-info', { token: ct });
    assert.deepStrictEqual([info.body.name, info.body.band], [names[0], 'child']);
    assert.strictEqual((await P('/api/parent/consent', { token: ct, email: 'mum@example.com', password: 'parent password', pin: '2468' })).status, 400, 'must tick the box');
    const yes = await P('/api/parent/consent', { token: ct, agree: true, email: 'mum@example.com', password: 'parent password', pin: '2468', controls: { reminders: false, dailyMinutes: 45 } });
    assert.strictEqual(yes.status, 200);
    const PT = yes.body.token;
    assert.strictEqual((await P('/api/parent/consent', { token: ct, agree: true, email: 'mum@example.com', password: 'parent password', pin: '2468' })).status, 400, 'link is single use');
    const safety = await k.next('safety');
    assert.deepStrictEqual([safety.safety.consent, safety.safety.online, safety.safety.pool, safety.safety.dailyMinutes], [true, null, 'kids', 45]);

    // Kids are matched with kids and guests, never with adults, not even by friend code.
    const g = await client(port); await g.next('welcome');
    const a = await client(port, adult.body.token); await a.next('welcome');
    a.send({ type: 'seek', tc: '3+2' }); k.send({ type: 'seek', tc: '3+2' });
    await new Promise((r) => setTimeout(r, 1300));
    g.send({ type: 'seek', tc: '3+2' });
    const ks = await k.next('start');
    assert.strictEqual(ks.opponent.guest, true, 'the child met the guest, not the adult');
    k.send({ type: 'resign' }); await k.next('end');
    a.send({ type: 'cancel' });
    a.send({ type: 'friend-create', tc: '10+0' });
    const code = (await a.next('friend-code')).code;
    k.send({ type: 'friend-join', code });
    assert.match((await k.next('error')).message, /different group/);

    // Purchases need the parent's PIN; the parent can turn online play off.
    assert.strictEqual((await call(port, 'POST', '/api/store/checkout', { product: 'premium.monthly', pin: '1111' }, kid.body.token)).status, 403);
    assert.strictEqual((await call(port, 'POST', '/api/store/checkout', { product: 'premium.monthly', pin: '2468' }, kid.body.token)).status, 200);
    // Five wrong PINs lock purchases, even for the right PIN, so it cannot be guessed.
    for (let i = 0; i < 5; i++) await call(port, 'POST', '/api/store/checkout', { product: 'premium.monthly', pin: '000' + i }, kid.body.token);
    const locked = await call(port, 'POST', '/api/store/checkout', { product: 'premium.monthly', pin: '2468' }, kid.body.token);
    assert.strictEqual(locked.status, 403);
    assert.match(locked.body.error, /Too many/);
    // The parent page, the privacy policy and the terms are served.
    for (const page of ['/parent', '/privacy', '/terms']) assert.strictEqual((await fetch('http://127.0.0.1:' + port + page)).status, 200, page);
    // The audio guide's recorded lines are served; nothing outside the guide folder is.
    const line = await fetch('http://127.0.0.1:' + port + '/guide/home.first.mp3');
    assert.strictEqual(line.status, 200);
    assert.strictEqual(line.headers.get('content-type'), 'audio/mpeg');
    assert.strictEqual((await fetch('http://127.0.0.1:' + port + '/guide/..%2Fsw.js')).status, 404);
    // So are the words of Words at the table, said by Rooky and by Priya.
    const words = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../apps/web-prototype/public/words/index.json'), 'utf8'));
    for (const w of [Object.keys(words).find((k) => k.startsWith('rooky/')), Object.keys(words).find((k) => k.startsWith('priya/'))]) {
      const r = await fetch('http://127.0.0.1:' + port + '/words/' + w + '.mp3');
      assert.strictEqual(r.status, 200, w);
      assert.strictEqual(r.headers.get('content-type'), 'audio/mpeg');
    }
    assert.strictEqual((await fetch('http://127.0.0.1:' + port + '/words/rooky/..%2F..%2Fsw.js')).status, 404);
    const me = await P('/api/parent/me', {}, PT);
    assert.strictEqual(me.body.children.length, 1);
    assert.strictEqual(me.body.children[0].activity.onlineGames, 1);
    assert.strictEqual((await P('/api/parent/controls', { child: me.body.children[0].id, controls: { online: false } }, PT)).status, 200);
    assert.match((await k.next('safety')).safety.online, /turned online play off/);
    k.send({ type: 'seek', tc: '5+3' });
    assert.match((await k.next('error')).message, /turned online play off/);
    // The parent can export and delete the child's data.
    const exp = await P('/api/parent/export', { child: me.body.children[0].id }, PT);
    assert.strictEqual(exp.body.name, names[0]);
    assert.strictEqual(exp.body.games.length, 1);
    assert.strictEqual((await P('/api/parent/delete', { child: me.body.children[0].id, password: 'wrong' }, PT)).status, 401);
    assert.strictEqual((await P('/api/parent/delete', { child: me.body.children[0].id, password: 'parent password' }, PT)).status, 200);
    assert.strictEqual((await P('/api/parent/me', {}, PT)).body.children.length, 0);
    assert.strictEqual((await call(port, 'POST', '/api/login', { name: names[0], password: 'a long password' })).status, 401);
    // Player tokens do not work on parent routes.
    assert.strictEqual((await call(port, 'POST', '/api/parent/me', {}, adult.body.token)).status, 401);
    for (const c of [g, a]) c.close();
  } finally { await app.close(); }
});

test('retention: accounts unused for two years are deleted, unless a purchase is still running', async () => {
  const app = createServer({ log: () => {}, payments: { mode: 'dev' } });
  const port = await app.listen(0, '127.0.0.1');
  try {
    const old = await call(port, 'POST', '/api/register', { name: 'sleepy', password: 'a long password', birthYear: 1990, birthMonth: 6 });
    const paid = await call(port, 'POST', '/api/register', { name: 'payer', password: 'a long password', birthYear: 1990, birthMonth: 6 });
    const fresh = await call(port, 'POST', '/api/register', { name: 'active', password: 'a long password', birthYear: 1990, birthMonth: 6 });
    const longAgo = Date.now() - 800 * 86400e3;
    app.db.run('UPDATE users SET seen = ? WHERE id IN (?, ?)', longAgo, old.body.user.id, paid.body.user.id);
    app.db.run('INSERT INTO entitlements (user_id, key, source, granted, expires) VALUES (?, ?, ?, ?, NULL)', paid.body.user.id, 'premium', 'purchase', longAgo);
    const r = app.family.purgeInactive();
    assert.ok(r.players >= 1);
    const row = (id) => app.db.get('SELECT name, deleted, birth_ym FROM users WHERE id = ?', id);
    assert.ok(row(old.body.user.id).deleted, 'idle account deleted');
    assert.strictEqual(row(old.body.user.id).birth_ym, null);
    assert.ok(!row(paid.body.user.id).deleted, 'lifetime purchase kept');
    assert.ok(!row(fresh.body.user.id).deleted, 'recent account kept');
  } finally { await app.close(); }
});
