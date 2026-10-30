'use strict';
// Chackmate game server: static site, JSON API, WebSocket play and the admin API in one process.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const ChacklateEngine = require('../../../packages/chess-core/src/engine.js');
const store = require('./db');
const auth = require('./auth');
const ws = require('./ws');
const admin = require('./admin');
const commerce = require('./commerce');
const push = require('./push');
const fairplay = require('./fairplay');
const account = require('./account');
const family = require('./family');
const club = require('./club');
const mailer = require('./mailer');
const { Lobby } = require('./lobby');

const ROOT = path.resolve(__dirname, '../../..');
const PUBLIC = path.join(ROOT, 'apps/web-prototype/public');
const STATIC = {
  '/': path.join(ROOT, 'apps/website/index.html'),
  '/play': path.join(ROOT, 'apps/web-prototype/dist/chackmate.html'),
  '/admin': path.join(ROOT, 'apps/admin/index.html'),
  '/parent': path.join(ROOT, 'apps/parent/index.html'),
  '/privacy': path.join(ROOT, 'apps/website/privacy.html'),
  '/terms': path.join(ROOT, 'apps/website/terms.html'),
  // Installable app: manifest, service worker (served from the root so it can control /play) and icons.
  '/manifest.webmanifest': path.join(PUBLIC, 'manifest.webmanifest'),
  '/sw.js': path.join(PUBLIC, 'sw.js'),
  '/apple-touch-icon.png': path.join(PUBLIC, 'apple-touch-icon.png'),
  '/icons/icon-192.png': path.join(PUBLIC, 'icon-192.png'),
  '/icons/icon-512.png': path.join(PUBLIC, 'icon-512.png'),
  '/icons/icon-maskable-512.png': path.join(PUBLIC, 'icon-maskable-512.png'),
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

function createServer(opts) {
  opts = opts || {};
  const db = store.open(opts.dbFile);
  const E = ChacklateEngine();
  const shop = commerce.create(db, opts.payments);
  const notify = push.create(db, Object.assign({ log: opts.log, allowed: (id) => family.policy.reminders(db.get('SELECT * FROM users WHERE id = ?', id) || {}) }, opts.push));
  const pushTimer = setInterval(() => notify.tick(), 60000);
  pushTimer.unref();
  const fair = fairplay.create(db, Object.assign({ log: opts.log }, opts.fairplay));
  // Behind a reverse proxy every request comes from the proxy, so rate limits key on X-Forwarded-For.
  const clientIp = (req) => {
    if (opts.trustProxy) { const f = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim(); if (f) return f; }
    return req.socket.remoteAddress;
  };
  const lobby = new Lobby(Object.assign({ db, E, clientIp, policy: family.policy, entitlements: (id) => shop.entitlements(id), onGameEnd: (g) => fair.enqueue(g) }, opts.lobby || {}));
  const adminApi = admin.routes(db, lobby, shop, fair);
  const mail = opts.mailer || mailer.create(Object.assign({ log: opts.log }, opts.mail));
  const accountApi = account.create(db, lobby, { mailer: mail, publicUrl: opts.publicUrl });
  const familyApi = family.create(db, lobby, { mailer: mail, publicUrl: opts.publicUrl });
  const clubApi = club.create(db, lobby, family.policy);
  const purgeTimer = setInterval(() => { try { familyApi.purgeInactive(); } catch (e) { (opts.log || console.log)('purge failed', e.message); } }, 24 * 3600e3);
  purgeTimer.unref();
  const accountLimit = auth.limiter(20, 60000);

  if (opts.adminEmail && opts.adminPassword && !db.get('SELECT id FROM staff LIMIT 1')) {
    admin.createStaff(db, opts.adminEmail, 'admin', opts.adminPassword);
  }

  const bearer = (req) => { const h = req.headers.authorization || ''; return h.startsWith('Bearer ') ? h.slice(7) : ''; };
  const profile = (u, token) => ({ token, user: lobby.publicUser(u), ratings: lobby.ratings(u.id), entitlements: shop.entitlements(u.id), account: { email: u.email || null, emailVerified: !!u.email_verified }, safety: family.policy.info(u) });

  async function api(req, url, body, ip) {
    const p = url.pathname;
    if (p === '/api/health') {
      try { db.get('SELECT 1'); } catch (e) { return [503, { ok: false, error: 'database unavailable' }]; }
      return [200, { ok: true, version: opts.version || 'dev', uptime: Math.round(process.uptime()), ...lobby.stats() }];
    }
    if (p.startsWith('/api/admin/')) return adminApi(req, p, req.method === 'GET' ? Object.fromEntries(url.searchParams) : body, ip);
    if (p === '/api/leaderboard') {
      const pool = ['bullet', 'blitz', 'rapid'].includes(url.searchParams.get('pool')) ? url.searchParams.get('pool') : 'blitz';
      return [200, { pool, rows: lobby.leaderboard(pool, Number(url.searchParams.get('limit')) || 50) }];
    }
    if (p === '/api/register' && req.method === 'POST') {
      if (!accountLimit(ip)) return [429, { error: 'Too many attempts. Wait a minute.' }];
      // Neutral age question first: under-18s pick a generated name and need a parent's consent.
      const birth = family.validBirth(body.birthYear, body.birthMonth, Date.now());
      if (!birth) return [400, { error: 'Choose your birth month and year.' }];
      const band = family.bandFor(birth.year, birth.month, Date.now());
      const parentEmail = String(body.parentEmail || '').trim();
      if (band !== 'adult' && !family.isGeneratedName(body.name)) return [400, { error: 'Pick one of the suggested player names.', needName: true }];
      if (band !== 'adult' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parentEmail)) return [400, { error: 'Ask a parent for their email address.' }];
      const bad = (band === 'adult' ? family.typedNameProblem(body.name) : null) || auth.validPassword(body.password);
      if (bad) return [400, { error: bad }];
      if (db.get('SELECT id FROM users WHERE name_key = ?', body.name.toLowerCase())) return [409, { error: 'That name is taken.' }];
      // A guest who registers keeps their ratings and game history.
      let u = lobby.userForToken(bearer(req));
      if (u && !u.guest) return [400, { error: 'You are already signed in.' }];
      if (!u) u = lobby.createGuest();
      db.run('UPDATE users SET name = ?, name_key = ?, pass = ?, guest = 0, birth_ym = ?, age_band = ? WHERE id = ?', body.name, body.name.toLowerCase(), auth.hashPassword(body.password),
        birth.year + '-' + String(birth.month).padStart(2, '0'), band, u.id);
      db.run('DELETE FROM sessions WHERE user_id = ?', u.id);
      const token = lobby.newSession(u.id);
      const nu = db.get('SELECT * FROM users WHERE id = ?', u.id);
      if (band !== 'adult') await familyApi.requestConsent(nu, parentEmail);
      return [200, profile(nu, token)];
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
    if (p === '/api/names' || p.startsWith('/api/parent/') || p === '/api/account/age' || p === '/api/account/consent/resend') {
      const out = await familyApi.handle(req, p, body, ip, lobby.userForToken(bearer(req)));
      if (out) return out;
    }
    if (p === '/api/club' || p.startsWith('/api/friends') || p === '/api/account/location') {
      const out = await clubApi.handle(req, p, body, url, lobby.userForToken(bearer(req)));
      if (out) return out;
    }
    if (p.startsWith('/api/account/')) {
      const out = await accountApi(req, p, body, ip, lobby.userForToken(bearer(req)));
      if (out) return out;
    }
    if (p === '/api/push/key') return [200, { publicKey: notify.publicKey }];
    if ((p === '/api/push/subscribe' || p === '/api/push/unsubscribe') && req.method === 'POST') {
      const u = lobby.userForToken(bearer(req));
      if (!u) return [401, { error: 'Not signed in.' }];
      if (p === '/api/push/subscribe' && !family.policy.reminders(u)) return [403, { error: 'A parent needs to turn reminders on first.' }];
      return p === '/api/push/subscribe' ? notify.subscribe(u.id, body.subscription, body.hour, body.tz) : notify.unsubscribe(u.id, body.endpoint);
    }
    if (p === '/api/store') return [200, { mode: shop.mode, perks: shop.perks, products: shop.publicProducts() }];
    if (p === '/api/store/webhook' && req.method === 'POST') return shop.webhook(req.rawBody || '', req.headers['x-chacklate-signature']);
    if (p.startsWith('/api/store/') && req.method === 'POST') {
      const u = lobby.userForToken(bearer(req));
      if (!u) return [401, { error: 'Not signed in.' }];
      if (p === '/api/store/checkout') {
        const no = familyApi.purchaseCheck(u, body.pin);
        if (no) return [403, { error: no, parent: true }];
        return shop.checkout(u, String(body.product || ''));
      }
      if (p === '/api/store/dev/complete') return shop.devComplete(u, body.order);
    }
    let m;
    if ((m = p.match(/^\/api\/players\/([A-Za-z0-9_-]{3,20})$/))) {
      const u = db.get('SELECT * FROM users WHERE name_key = ? AND banned IS NULL', m[1].toLowerCase());
      // Children have no public profile.
      if (!u || !family.policy.publicProfile(u)) return [404, { error: 'No such player.' }];
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
    const ip = clientIp(req);
    if (url.pathname.startsWith('/api/')) {
      // Token auth only (no cookies), so any origin may call the API; the file:// build needs this.
      const head = Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Cache-Control': 'no-store' }, SECURITY_HEADERS);
      if (req.method === 'OPTIONS') { res.writeHead(204, head); return res.end(); }
      let body = {};
      if (req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 100000) { res.writeHead(413, head); return res.end('{}'); } }
        req.rawBody = raw;
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
    if (url.pathname === '/account/verify') {
      res.writeHead(302, Object.assign({ Location: account.verifyPage(db, url.searchParams.get('token')), 'Cache-Control': 'no-store' }, SECURITY_HEADERS));
      return res.end();
    }
    // Recorded voices: one pack per voice plus the index. The game asks for one clip at a time as a
    // byte range. Pack URLs carry a hash of their contents (?v=), so a pack can be cached for good.
    const vm = url.pathname.match(/^\/voice\/(?:index\.json|([a-z]+)\.mp3)$/);
    if (vm && req.method === 'GET') {
      const vf = path.join(PUBLIC, 'voice', vm[1] ? vm[1] + '.mp3' : 'index.json');
      if (fs.existsSync(vf)) {
        const head = Object.assign({ 'Content-Type': vm[1] ? 'audio/mpeg' : 'application/json', 'Cache-Control': vm[1] && url.searchParams.has('v') ? 'public, max-age=31536000, immutable' : 'no-cache' }, SECURITY_HEADERS);
        const size = fs.statSync(vf).size;
        const r = vm[1] && /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
        if (r) {
          const start = +r[1], end = Math.min(r[2] ? +r[2] : size - 1, size - 1);
          if (start > end) { res.writeHead(416, Object.assign(head, { 'Content-Range': 'bytes */' + size })); return res.end(); }
          res.writeHead(206, Object.assign(head, { 'Accept-Ranges': 'bytes', 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': end - start + 1 }));
          return fs.createReadStream(vf, { start, end }).pipe(res);
        }
        res.writeHead(200, Object.assign(head, vm[1] ? { 'Accept-Ranges': 'bytes', 'Content-Length': size } : {}));
        return fs.createReadStream(vf).pipe(res);
      }
    }
    // The audio guide's lines, named by what they are for. A line can be recorded again, so they are checked each time.
    const gm = url.pathname.match(/^\/guide\/([a-z0-9.-]+)\.mp3$/);
    if (gm && req.method === 'GET') {
      const gf = path.join(PUBLIC, 'guide', gm[1] + '.mp3');
      if (fs.existsSync(gf)) {
        res.writeHead(200, Object.assign({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' }, SECURITY_HEADERS));
        return fs.createReadStream(gf).pipe(res);
      }
    }
    // Rooky's word on each Collection item. A chess set from an era uses the website's recording of its pitch.
    const pm = url.pathname.match(/^\/pitch\/(site\/)?([a-z0-9.-]+)\.mp3$/);
    if (pm && req.method === 'GET') {
      const pf = pm[1] ? path.join(ROOT, 'apps/website/audio', pm[2] + '.mp3') : path.join(PUBLIC, 'pitch', pm[2] + '.mp3');
      if (fs.existsSync(pf)) {
        res.writeHead(200, Object.assign({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' }, SECURITY_HEADERS));
        return fs.createReadStream(pf).pipe(res);
      }
    }
    // Lessons with their own speakers: words/<who>/<hash of the text>.mp3, recorded again when a voice changes.
    const wm = url.pathname.match(/^\/words\/([a-z]+)\/([0-9a-f]{8})\.mp3$/);
    if (wm && req.method === 'GET') {
      const wf = path.join(PUBLIC, 'words', wm[1], wm[2] + '.mp3');
      if (fs.existsSync(wf)) {
        res.writeHead(200, Object.assign({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-cache' }, SECURITY_HEADERS));
        return fs.createReadStream(wf).pipe(res);
      }
    }
    const file = STATIC[url.pathname.replace(/\/+$/, '') || '/'];
    if (file && fs.existsSync(file)) {
      const ext = path.extname(file);
      res.writeHead(200, Object.assign({ 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': ext === '.png' ? 'public, max-age=604800' : 'no-cache' }, SECURITY_HEADERS));
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY_HEADERS));
    res.end('Not found');
  });

  const sockets = ws.attach(server, '/ws', (s) => lobby.connect(s));
  return {
    server, db, lobby, push: notify, fairplay: fair, mail, family: familyApi,
    listen(port, host) { return new Promise((r) => server.listen(port, host, () => r(server.address().port))); },
    close() { clearInterval(pushTimer); clearInterval(purgeTimer); fair.stop(); lobby.stop(); sockets.stop(); return new Promise((r) => server.close(() => { db.close(); r(); })); },
  };
}

module.exports = { createServer };

if (require.main === module) {
  const app = createServer({
    dbFile: process.env.CHACKLATE_DB || path.join(__dirname, '..', 'chacklate.db'),
    adminEmail: process.env.CHACKLATE_ADMIN_EMAIL,
    adminPassword: process.env.CHACKLATE_ADMIN_PASSWORD,
    publicUrl: process.env.CHACKLATE_PUBLIC_URL,
    trustProxy: process.env.CHACKLATE_TRUST_PROXY === '1',
    version: process.env.CHACKLATE_VERSION,
    mail: { mode: process.env.CHACKLATE_MAIL || 'log', url: process.env.CHACKLATE_MAIL_URL || 'https://api.resend.com/emails', key: process.env.CHACKLATE_MAIL_KEY, from: process.env.CHACKLATE_MAIL_FROM },
    push: { subject: process.env.CHACKLATE_PUSH_SUBJECT, vapid: { publicKey: process.env.CHACKLATE_VAPID_PUBLIC, privateKey: process.env.CHACKLATE_VAPID_PRIVATE } },
    payments: { mode: process.env.CHACKLATE_PAYMENTS || 'off', secret: process.env.CHACKLATE_PAYMENT_SECRET, checkoutUrl: process.env.CHACKLATE_CHECKOUT_URL },
    log: console.log,
    lobby: { log: (...a) => console.log(new Date().toISOString(), ...a) },
  });
  const port = Number(process.env.PORT) || 8080;
  app.listen(port, process.env.HOST || '0.0.0.0').then((p) => console.log('Chackmate server on http://localhost:' + p));
  const stop = () => app.close().then(() => process.exit(0));
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}
