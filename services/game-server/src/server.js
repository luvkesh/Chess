'use strict';
// Chacklate game server: static site, JSON API, WebSocket play and the admin API in one process.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ChacklateEngine = require('../../../packages/chess-core/src/engine.js');
const store = require('./db');
const auth = require('./auth');
const ws = require('./ws');
const admin = require('./admin');
const { Lobby } = require('./lobby');

const ROOT = path.resolve(__dirname, '../../..');
const STATIC = {
  '/': path.join(ROOT, 'apps/website/index.html'),
  '/play': path.join(ROOT, 'apps/web-prototype/dist/chacklate-chess.html'),
  '/admin': path.join(ROOT, 'apps/admin/index.html'),
};
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function createServer(opts) {
  opts = opts || {};
  const db = store.open(opts.dbFile);
  const E = ChacklateEngine();
  const lobby = new Lobby(Object.assign({ db, E }, opts.lobby || {}));
  const adminApi = admin.routes(db, lobby);
  const accountLimit = auth.limiter(20, 60000);

  if (opts.adminEmail && opts.adminPassword && !db.get('SELECT id FROM staff LIMIT 1')) {
    admin.createStaff(db, opts.adminEmail, 'admin', opts.adminPassword);
  }

  const bearer = (req) => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; };
  const profile = (u, token) => ({ token, user: lobby.publicUser(u), ratings: lobby.ratings(u.id) });

  async function api(req, url, body, ip) {
    const p = url.pathname;
    if (p === '/api/health') return [200, { ok: true, ...lobby.stats() }];
    if (p.startsWith('/api/admin/')) return adminApi(req, p, req.method === 'GET' ? Object.fromEntries(url.searchParams) : body, ip);
    if (p === '/api/leaderboard') {
      const pool = ['bullet', 'blitz', 'rapid'].includes(url.searchParams.get('pool')) ? url.searchParams.get('pool') : 'blitz';
      return [200, { pool, rows: lobby.leaderboard(pool, Number(url.searchParams.get('limit')) || 50) }];
    }
    if (p === '/api/register' && req.method === 'POST') {
      if (!accountLimit(ip)) return [429, { error: 'Too many attempts. Wait a minute.' }];
      const bad = auth.validName(body.name) || auth.validPassword(body.password);
      if (bad) return [400, { error: bad }];
      if (db.get('SELECT id FROM users WHERE name_key = ?', body.name.toLowerCase())) return [409, { error: 'That name is taken.' }];
      // A guest who registers keeps their ratings and game history.
      let u = lobby.userForToken(bearer(req));
      if (u && !u.guest) return [400, { error: 'You are already signed in.' }];
      if (!u) u = lobby.createGuest();
      db.run('UPDATE users SET name = ?, name_key = ?, pass = ?, guest = 0 WHERE id = ?', body.name, body.name.toLowerCase(), auth.hashPassword(body.password), u.id);
      db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
      const token = lobby.newSession(u.id);
      return [200, profile(db.get('SELECT * FROM users WHERE id = ?', u.id), token)];
    }
    if (p === '/api/login' && req.method === 'POST') {
      if (!accountLimit(ip)) return [429, { error: 'Too many attempts. Wait a minute.' }];
      const u = db.get('SELECT * FROM users WHERE name_key = ?', String(body.name || '').toLowerCase());
      if (!u || !auth.checkPassword(body.password, u.pass)) return [401, { error: 'Wrong name or password.' }];
      if (u.banned) return [403, { error: 'This account is suspended: ' + u.banned }];
      return [200, profile(u, lobby.newSession(u.id))];
    }
    if (p === '/api/logout' && req.method === 'POST') {
      db.run('DELETE FROM sessions WHERE token = ?', bearer(req));
      return [200, { ok: true }];
    }
    if (p === '/api/me') {
      const u = lobby.userForToken(bearer(req));
      return u ? [200, profile(u)] : [401, { error: 'Not signed in.' }];
    }
    let m;
    if ((m = p.match(/^\/api\/players\/([A-Za-z0-9_-]{3,20})$/))) {
      const u = db.get('SELECT * FROM users WHERE name_key = ? AND banned IS NULL', m[1].toLowerCase());
      if (!u) return [404, { error: 'No such player.' }];
      const games = db.all('SELECT g.id, g.tc, g.result, g.reason, g.started, w.name white, b.name black FROM games g JOIN users w ON w.id = g.white JOIN users b ON b.id = g.black WHERE (g.white = ? OR g.black = ?) AND g.result IS NOT NULL ORDER BY g.started DESC LIMIT 20', u.id, u.id);
      return [200, { name: u.name, since: u.created, ratings: lobby.ratings(u.id), games }];
    }
    if ((m = p.match(/^\/api\/games\/([A-Za-z0-9_-]{4,16})$/))) {
      const g = db.get('SELECT g.id, g.tc, g.rated, g.moves, g.result, g.reason, g.started, w.name white, b.name black FROM games g JOIN users w ON w.id = g.white JOIN users b ON b.id = g.black WHERE g.id = ?', m[1]);
      return g ? [200, g] : [404, { error: 'No such game.' }];
    }
    return [404, { error: 'Not found.' }];
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const ip = req.socket.remoteAddress;
    if (url.pathname.startsWith('/api/')) {
      // Token auth only (no cookies), so any origin may call the API; the file:// build needs this.
      const head = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Cache-Control': 'no-store' }, SECURITY_HEADERS);
      if (req.method === 'OPTIONS') { res.writeHead(204, head); return res.end(); }
      let body = {};
      if (req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 100000) { res.writeHead(413, head); return res.end('{}'); } }
        try { body = raw ? JSON.parse(raw) : {}; } catch { res.writeHead(400, head); return res.end(JSON.stringify({ error: 'Bad JSON.' })); }
        if (!body || typeof body !== 'object') body = {};
      }
      try {
        const [status, out] = await api(req, url, body, ip);
        res.writeHead(status, head);
        res.end(JSON.stringify(out));
      } catch (e) {
        (opts.log || console.error)('api error', e);
        res.writeHead(500, head);
        res.end(JSON.stringify({ error: 'Server error.' }));
      }
      return;
    }
    const file = STATIC[url.pathname.replace(/\/+$/, '') || '/'];
    if (file && fs.existsSync(file)) {
      res.writeHead(200, Object.assign({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, SECURITY_HEADERS));
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY_HEADERS));
    res.end('Not found');
  });

  const sockets = ws.attach(server, '/ws', (s) => lobby.connect(s));
  return {
    server, db, lobby,
    listen(port, host) { return new Promise((r) => server.listen(port, host, () => r(server.address().port))); },
    close() { lobby.stop(); sockets.stop(); return new Promise((r) => server.close(() => { db.close(); r(); })); },
  };
}

module.exports = { createServer };

if (require.main === module) {
  const app = createServer({
    dbFile: process.env.CHACKLATE_DB || path.join(__dirname, '..', 'chacklate.db'),
    adminEmail: process.env.CHACKLATE_ADMIN_EMAIL,
    adminPassword: process.env.CHACKLATE_ADMIN_PASSWORD,
    log: console.log,
    lobby: { log: (...a) => console.log(new Date().toISOString(), ...a) },
  });
  const port = Number(process.env.PORT) || 8080;
  app.listen(port, process.env.HOST || '0.0.0.0').then((p) => console.log('Chacklate server on http://localhost:' + p));
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
