'use strict';
// Players, matchmaking, friend codes and live games. The server is authoritative: every move is
// checked with the shared engine, and clocks run here, not on the clients.
const crypto = require('node:crypto');
const glicko = require('./glicko');
const auth = require('./auth');

const TIME_CONTROLS = ['1+0', '2+1', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10', '30+0'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function poolFor(tc) {
  const [m, s] = tc.split('+').map(Number);
  const est = m * 60 + 40 * s;
  return est < 180 ? 'bullet' : est < 480 ? 'blitz' : 'rapid';
}

class Lobby {
  // opts: { db, E (engine instance), now?, firstMoveMs?, reconnectMs?, minGamesForBoard?, log?, entitlements? }
  constructor(opts) {
    this.db = opts.db;
    this.E = opts.E;
    this.now = opts.now || Date.now;
    this.firstMoveMs = opts.firstMoveMs || 30000;
    this.reconnectMs = opts.reconnectMs || 60000;
    this.minGames = opts.minGamesForBoard == null ? 5 : opts.minGamesForBoard;
    this.log = opts.log || (() => {});
    this.entitlements = opts.entitlements || (() => null);
    this.players = new Map();   // userId -> { user, sockets: Set, gameId, seek }
    this.games = new Map();     // gameId -> room
    this.seeks = [];            // { userId, tc, since }
    this.codes = new Map();     // code -> { userId, tc, expires }
    this.limit = auth.limiter(40, 10000);
    this.tick = setInterval(() => this.matchmake(), 1000);
    this.tick.unref();
  }

  stop() {
    clearInterval(this.tick);
    for (const r of this.games.values()) this.clearTimers(r);
  }

  // ------------------------------------------------------------------ accounts
  createGuest() {
    const now = this.now();
    const n = crypto.randomInt(1000, 9999);
    const r = this.db.run('INSERT INTO users (name, guest, created, seen) VALUES (?, 1, ?, ?)', 'Guest' + n, now, now);
    return this.db.get('SELECT * FROM users WHERE id = ?', Number(r.lastInsertRowid));
  }

  newSession(userId) {
    const t = auth.token(), now = this.now();
    this.db.run('INSERT INTO sessions (token, user_id, created, seen) VALUES (?, ?, ?, ?)', t, userId, now, now);
    return t;
  }

  userForToken(t) {
    if (typeof t !== 'string' || !t) return null;
    const row = this.db.get('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', t);
    if (row) this.db.run('UPDATE sessions SET seen = ? WHERE token = ?', this.now(), t);
    return row || null;
  }

  rating(userId, pool) {
    const r = this.db.get('SELECT * FROM ratings WHERE user_id = ? AND pool = ?', userId, pool);
    return r ? { rating: r.rating, rd: r.rd, vol: r.vol, games: r.games } : Object.assign(glicko.defaults(), { games: 0 });
  }

  ratings(userId) {
    const out = {};
    for (const p of ['bullet', 'blitz', 'rapid']) { const r = this.rating(userId, p); out[p] = { rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games }; }
    return out;
  }

  publicUser(u) { return { id: u.id, name: u.name, guest: !!u.guest }; }

  // ------------------------------------------------------------------ sockets
  connect(socket) {
    let player = null;
    const ip = socket.req && socket.req.socket ? socket.req.socket.remoteAddress : 'local';
    socket.on('message', (msg) => {
      if (!this.limit(player ? 'u' + player.user.id : ip)) return socket.send({ type: 'error', message: 'Slow down a little.' });
      if (!player) {
        if (msg.type !== 'hello') return socket.send({ type: 'error', message: 'Say hello first.' });
        player = this.hello(socket, msg);
        return;
      }
      try { this.handle(player, socket, msg); } catch (e) { this.log('handler error', e); socket.send({ type: 'error', message: 'Something went wrong.' }); }
    });
    socket.on('close', () => { if (player) this.left(player, socket); });
  }

  hello(socket, msg) {
    let user = this.userForToken(msg.token), token = msg.token;
    if (!user) { user = this.createGuest(); token = this.newSession(user.id); }
    if (user.banned) { socket.send({ type: 'banned', reason: user.banned }); socket.close(4003); return null; }
    this.db.run('UPDATE users SET seen = ? WHERE id = ?', this.now(), user.id);
    let p = this.players.get(user.id);
    if (!p) { p = { user, sockets: new Set(), gameId: null }; this.players.set(user.id, p); }
    p.user = user;
    p.sockets.add(socket);
    socket.send({ type: 'welcome', token, user: this.publicUser(user), ratings: this.ratings(user.id), progress: user.progress ? JSON.parse(user.progress) : null, entitlements: this.entitlements(user.id), timeControls: TIME_CONTROLS });
    // Back into a live game after a reconnect.
    const room = p.gameId && this.games.get(p.gameId);
    if (room) {
      const side = room.white === user.id ? 'w' : 'b';
      if (room.away[side]) { clearTimeout(room.away[side]); room.away[side] = null; this.toSide(room, side === 'w' ? 'b' : 'w', { type: 'status', id: room.id, opponentAway: false }); }
      socket.send(this.startMsg(room, side));
    }
    return p;
  }

  left(p, socket) {
    p.sockets.delete(socket);
    if (p.sockets.size) return;
    this.cancelSeek(p.user.id);
    for (const [c, v] of this.codes) if (v.userId === p.user.id) this.codes.delete(c);
    const room = p.gameId && this.games.get(p.gameId);
    if (room) {
      const side = room.white === p.user.id ? 'w' : 'b';
      this.toSide(room, side === 'w' ? 'b' : 'w', { type: 'status', id: room.id, opponentAway: true });
      room.away[side] = setTimeout(() => {
        const g = room.g;
        if (g.moves.length < 2) this.finish(room, '1/2-1/2', 'aborted');
        else this.finish(room, side === 'w' ? '0-1' : '1-0', 'abandoned');
      }, this.reconnectMs);
    } else this.players.delete(p.user.id);
  }

  send(userId, msg) {
    const p = this.players.get(userId);
    if (p) for (const s of p.sockets) s.send(msg);
  }

  toSide(room, side, msg) { this.send(side === 'w' ? room.white : room.black, msg); }

  handle(p, socket, msg) {
    const uid = p.user.id;
    const room = p.gameId ? this.games.get(p.gameId) : null;
    switch (msg.type) {
      case 'seek': {
        if (room) return socket.send(this.startMsg(room, room.white === uid ? 'w' : 'b'));
        const tc = TIME_CONTROLS.includes(msg.tc) ? msg.tc : '5+3';
        this.cancelSeek(uid);
        this.seeks.push({ userId: uid, tc, since: this.now() });
        this.send(uid, { type: 'seeking', tc });
        this.matchmake();
        return;
      }
      case 'cancel': this.cancelSeek(uid); return this.send(uid, { type: 'idle' });
      case 'friend-create': {
        if (room) return;
        const tc = TIME_CONTROLS.includes(msg.tc) ? msg.tc : '10+0';
        let code;
        do { code = Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join(''); } while (this.codes.has(code));
        this.codes.set(code, { userId: uid, tc, expires: this.now() + 10 * 60000 });
        return this.send(uid, { type: 'friend-code', code, tc });
      }
      case 'friend-join': {
        const code = String(msg.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const c = this.codes.get(code);
        if (!c || c.expires < this.now()) { this.codes.delete(code); return socket.send({ type: 'error', message: 'That code has expired or does not exist.' }); }
        if (c.userId === uid) return socket.send({ type: 'error', message: 'Share the code with a friend; you cannot join your own game.' });
        if (room) return;
        this.codes.delete(code);
        const flip = crypto.randomInt(2) === 0;
        return this.createGame(flip ? c.userId : uid, flip ? uid : c.userId, c.tc, false);
      }
      case 'progress': {
        const json = JSON.stringify(msg.data || null);
        if (json.length < 200000) this.db.run('UPDATE users SET progress = ? WHERE id = ?', json, uid);
        return;
      }
      case 'report': {
        // The live game, or a finished game this player took part in.
        const past = !room && msg.game ? this.db.get('SELECT white, black FROM games WHERE id = ? AND (white = ? OR black = ?)', String(msg.game), uid, uid) : null;
        const ref = room || past;
        if (!ref) return socket.send({ type: 'error', message: 'Reports are made from a game you played.' });
        const target = ref.white === uid ? ref.black : ref.white;
        this.db.run('INSERT INTO reports (reporter, target, game_id, reason, created) VALUES (?, ?, ?, ?, ?)', uid, target, room ? room.id : String(msg.game), String(msg.reason || 'unspecified').slice(0, 300), this.now());
        return socket.send({ type: 'reported' });
      }
    }
    if (!room) return;
    const side = room.white === uid ? 'w' : 'b';
    switch (msg.type) {
      case 'move': return this.move(room, side, msg);
      case 'resign': return this.finish(room, side === 'w' ? '0-1' : '1-0', room.g.moves.length < 2 ? 'aborted' : 'resignation');
      case 'draw-offer':
        if (room.drawOffer === (side === 'w' ? 'b' : 'w')) return this.finish(room, '1/2-1/2', 'agreement');
        room.drawOffer = side;
        return this.toSide(room, side === 'w' ? 'b' : 'w', { type: 'draw-offer', id: room.id });
      case 'draw-accept':
        if (room.drawOffer && room.drawOffer !== side) return this.finish(room, '1/2-1/2', 'agreement');
        return;
      case 'draw-decline': room.drawOffer = null; return;
      case 'claim': {
        const c = room.g.claimable();
        if (c) return this.finish(room, '1/2-1/2', c);
        return socket.send({ type: 'error', message: 'There is no draw to claim.' });
      }
      case 'sync': return socket.send({ type: 'sync', id: room.id, moves: room.g.uciMoves(), clock: this.clockNow(room) });
    }
  }

  cancelSeek(uid) { this.seeks = this.seeks.filter((s) => s.userId !== uid); }

  // Pairs seekers with the same time control, nearest rating first; the window widens while they wait.
  matchmake() {
    const now = this.now();
    for (const [c, v] of this.codes) if (v.expires < now) this.codes.delete(c);
    const taken = new Set();
    const list = this.seeks.slice().sort((a, b) => a.since - b.since);
    for (const a of list) {
      if (taken.has(a.userId)) continue;
      const ra = this.rating(a.userId, poolFor(a.tc)).rating;
      const window = 150 + 50 * Math.floor((now - a.since) / 5000);
      let best = null, bestGap = Infinity;
      for (const b of list) {
        if (b === a || taken.has(b.userId) || b.tc !== a.tc) continue;
        const gap = Math.abs(this.rating(b.userId, poolFor(b.tc)).rating - ra);
        const bw = 150 + 50 * Math.floor((now - b.since) / 5000);
        if (gap <= Math.max(window, bw) && gap < bestGap) { best = b; bestGap = gap; }
      }
      if (!best) continue;
      taken.add(a.userId); taken.add(best.userId);
      const flip = crypto.randomInt(2) === 0;
      this.createGame(flip ? a.userId : best.userId, flip ? best.userId : a.userId, a.tc, true);
    }
    if (taken.size) this.seeks = this.seeks.filter((s) => !taken.has(s.userId));
  }

  // ------------------------------------------------------------------ games
  createGame(white, black, tc, rated) {
    const [m, s] = tc.split('+').map(Number);
    const id = crypto.randomBytes(6).toString('base64url');
    const room = {
      id, white, black, tc, rated, pool: poolFor(tc), g: new this.E.Game(),
      clock: { w: m * 60000, b: m * 60000, inc: s * 1000, at: this.now() },
      drawOffer: null, away: { w: null, b: null }, timer: null, started: this.now(),
    };
    this.games.set(id, room);
    for (const uid of [white, black]) { const p = this.players.get(uid); if (p) p.gameId = id; this.cancelSeek(uid); }
    this.db.run('INSERT INTO games (id, white, black, tc, rated, started) VALUES (?, ?, ?, ?, ?, ?)', id, white, black, tc, rated ? 1 : 0, room.started);
    this.schedule(room);
    this.toSide(room, 'w', this.startMsg(room, 'w'));
    this.toSide(room, 'b', this.startMsg(room, 'b'));
    this.log('game', id, tc, rated ? 'rated' : 'casual');
    return room;
  }

  startMsg(room, side) {
    const opp = side === 'w' ? room.black : room.white;
    const u = this.db.get('SELECT id, name, guest FROM users WHERE id = ?', opp);
    const mine = this.rating(side === 'w' ? room.white : room.black, room.pool);
    return {
      type: 'start', id: room.id, color: side === 'w' ? 'white' : 'black', tc: room.tc, rated: room.rated,
      opponent: { name: u.name, guest: !!u.guest, rating: Math.round(this.rating(opp, room.pool).rating) },
      rating: Math.round(mine.rating), moves: room.g.uciMoves(), clock: this.clockNow(room), away: !!room.away[side === 'w' ? 'b' : 'w'],
    };
  }

  // Clocks start once both sides have moved; until then each side has `firstMoveMs` to start.
  running(room) { return room.g.moves.length >= 2 && !room.g.outcome; }

  clockNow(room) {
    const c = { w: room.clock.w, b: room.clock.b };
    if (this.running(room)) { const k = room.g.pos.side === this.E.WHITE ? 'w' : 'b'; c[k] = Math.max(0, c[k] - (this.now() - room.clock.at)); }
    return c;
  }

  schedule(room) {
    clearTimeout(room.timer);
    if (room.g.outcome) return;
    const k = room.g.pos.side === this.E.WHITE ? 'w' : 'b';
    if (!this.running(room)) {
      room.timer = setTimeout(() => this.finish(room, '1/2-1/2', 'aborted'), this.firstMoveMs);
      return;
    }
    room.timer = setTimeout(() => this.flag(room), Math.max(0, room.clock[k] - (this.now() - room.clock.at)) + 20);
  }

  flag(room) {
    const c = this.clockNow(room), k = room.g.pos.side === this.E.WHITE ? 'w' : 'b';
    if (c[k] > 0) return this.schedule(room);
    room.clock[k] = 0;
    room.g.timeout(room.g.pos.side);
    this.finish(room, room.g.outcome.result, room.g.outcome.reason);
  }

  move(room, side, msg) {
    const g = room.g;
    const k = g.pos.side === this.E.WHITE ? 'w' : 'b';
    const resync = () => this.toSide(room, side, { type: 'sync', id: room.id, moves: g.uciMoves(), clock: this.clockNow(room) });
    if (k !== side || g.outcome || (msg.ply != null && msg.ply !== g.moves.length)) return resync();
    const now = this.now();
    if (this.running(room)) {
      const left = room.clock[k] - (now - room.clock.at);
      if (left <= 0) return this.flag(room);
      room.clock[k] = left + room.clock.inc;
    }
    const info = g.playText(String(msg.uci || ''));
    if (!info) return resync();
    room.clock.at = now;
    if (room.drawOffer === (side === 'w' ? 'b' : 'w')) room.drawOffer = null;
    const ply = g.moves.length - 1;
    const out = { type: 'move', id: room.id, uci: this.E.uci(info.move), san: info.san, ply, clock: this.clockNow(room) };
    this.toSide(room, side === 'w' ? 'b' : 'w', out);
    this.toSide(room, side, Object.assign({}, out, { type: 'ack' }));
    if (g.outcome) return this.finish(room, g.outcome.result, g.outcome.reason);
    this.schedule(room);
  }

  finish(room, result, reason) {
    if (!this.games.has(room.id)) return;
    this.clearTimers(room);
    this.games.delete(room.id);
    if (!room.g.outcome) room.g.finish(result, reason);
    const rated = room.rated && reason !== 'aborted';
    const ratingOut = { w: null, b: null };
    if (rated) {
      const now = this.now();
      const W = this.rating(room.white, room.pool), B = this.rating(room.black, room.pool);
      const sw = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
      const nw = glicko.update(W, B, sw), nb = glicko.update(B, W, 1 - sw);
      this.db.tx(() => {
        const up = 'INSERT INTO ratings (user_id, pool, rating, rd, vol, games, updated) VALUES (?, ?, ?, ?, ?, 1, ?) ' +
          'ON CONFLICT(user_id, pool) DO UPDATE SET rating = excluded.rating, rd = excluded.rd, vol = excluded.vol, games = games + 1, updated = excluded.updated';
        this.db.run(up, room.white, room.pool, nw.rating, nw.rd, nw.vol, now);
        this.db.run(up, room.black, room.pool, nb.rating, nb.rd, nb.vol, now);
      });
      ratingOut.w = { before: Math.round(W.rating), after: Math.round(nw.rating) };
      ratingOut.b = { before: Math.round(B.rating), after: Math.round(nb.rating) };
    }
    this.db.run('UPDATE games SET moves = ?, result = ?, reason = ?, ended = ?, white_before = ?, white_after = ?, black_before = ?, black_after = ? WHERE id = ?',
      room.g.uciMoves().join(' '), result, reason, this.now(),
      ratingOut.w && ratingOut.w.before, ratingOut.w && ratingOut.w.after, ratingOut.b && ratingOut.b.before, ratingOut.b && ratingOut.b.after, room.id);
    for (const side of ['w', 'b']) {
      const uid = side === 'w' ? room.white : room.black;
      this.send(uid, { type: 'end', id: room.id, result, reason, rating: ratingOut[side], clock: this.clockNow(room) });
      const p = this.players.get(uid);
      if (p && p.gameId === room.id) { p.gameId = null; if (!p.sockets.size) this.players.delete(uid); }
    }
  }

  clearTimers(room) {
    clearTimeout(room.timer);
    clearTimeout(room.away.w); clearTimeout(room.away.b);
  }

  // ------------------------------------------------------------------ queries
  leaderboard(pool, limit) {
    return this.db.all(
      'SELECT u.name, r.rating, r.rd, r.games FROM ratings r JOIN users u ON u.id = r.user_id ' +
      'WHERE r.pool = ? AND u.guest = 0 AND u.banned IS NULL AND r.games >= ? ORDER BY r.rating DESC LIMIT ?',
      pool, this.minGames, Math.min(100, limit || 50),
    ).map((r, i) => ({ rank: i + 1, name: r.name, rating: Math.round(r.rating), rd: Math.round(r.rd), games: r.games }));
  }

  stats() {
    let online = 0;
    for (const p of this.players.values()) if (p.sockets.size) online++;
    return { online, games: this.games.size, seeking: this.seeks.length };
  }

  // Ends live games and closes sockets for a banned user.
  kick(userId, reason) {
    const p = this.players.get(userId);
    if (!p) return;
    const room = p.gameId && this.games.get(p.gameId);
    if (room) this.finish(room, room.white === userId ? '0-1' : '1-0', room.g.moves.length < 2 ? 'aborted' : 'abandoned');
    for (const s of p.sockets) { s.send({ type: 'banned', reason }); s.close(4003); }
    this.players.delete(userId);
  }
}

module.exports = { Lobby, poolFor, TIME_CONTROLS };
