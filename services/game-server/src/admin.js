'use strict';
// Staff API: role-based access, every write recorded in the hash-chained audit log.
const auth = require('./auth');
const audit = require('./audit');

// Each role includes the permissions of the roles before it.
const ROLES = ['support', 'moderator', 'admin'];
const NEEDS = {
  'stats.read': 'support', 'users.read': 'support', 'games.read': 'support', 'reports.read': 'support', 'audit.read': 'support',
  'users.mute': 'support', 'reports.resolve': 'moderator', 'users.ban': 'moderator',
  'orders.read': 'support', 'ratings.reset': 'admin', 'staff.manage': 'admin', 'entitlements.manage': 'admin',
};
const can = (role, perm) => ROLES.indexOf(role) >= ROLES.indexOf(NEEDS[perm]);

function createStaff(db, email, role, password) {
  if (!ROLES.includes(role)) throw new Error('Unknown role ' + role);
  if (!/^[^@\s]+@[^@\s]+$/.test(email || '')) throw new Error('Invalid email');
  const pw = password || auth.token().slice(0, 16);
  db.run('INSERT INTO staff (email, pass, role, created) VALUES (?, ?, ?, ?)', email.toLowerCase(), auth.hashPassword(pw), role, Date.now());
  return pw;
}

function routes(db, lobby, shop, fair) {
  const loginLimit = auth.limiter(10, 60000);

  function staffFor(req) {
    const h = req.headers.authorization || '';
    const t = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!t) return null;
    return db.get('SELECT st.* FROM staff_sessions s JOIN staff st ON st.id = s.staff_id WHERE s.token = ? AND st.disabled = 0 AND s.created > ?', t, Date.now() - 12 * 3600e3) || null;
  }

  // Returns [status, body] for /api/admin/* or null when the path is not an admin route.
  return async function handle(req, path, body, ip) {
    if (path === '/api/admin/login' && req.method === 'POST') {
      if (!loginLimit(ip)) return [429, { error: 'Too many attempts. Wait a minute.' }];
      const s = db.get('SELECT * FROM staff WHERE email = ? AND disabled = 0', String(body.email || '').toLowerCase());
      if (!s || !auth.checkPassword(body.password, s.pass)) {
        audit.append(db, String(body.email || '?').slice(0, 80), 'login.failed', null, { ip });
        return [401, { error: 'Wrong email or password.' }];
      }
      const token = auth.token();
      db.run('INSERT INTO staff_sessions (token, staff_id, created) VALUES (?, ?, ?)', token, s.id, Date.now());
      audit.append(db, s.email, 'login', null, { ip });
      return [200, { token, email: s.email, role: s.role }];
    }
    const me = staffFor(req);
    if (!me) return [401, { error: 'Sign in again.' }];
    const need = (perm) => { if (!can(me.role, perm)) { const e = new Error('forbidden'); e.status = 403; throw e; } };
    const log = (action, target, detail) => audit.append(db, me.email, action, target, detail);
    let m;
    try {
      if (path === '/api/admin/me') return [200, { email: me.email, role: me.role, permissions: Object.keys(NEEDS).filter((p) => can(me.role, p)) }];
      if (path === '/api/admin/logout' && req.method === 'POST') {
        db.run('DELETE FROM staff_sessions WHERE staff_id = ?', me.id);
        return [200, { ok: true }];
      }
      if (path === '/api/admin/stats') {
        need('stats.read');
        const day = Date.now() - 86400e3;
        return [200, Object.assign(lobby.stats(), {
          users: db.get('SELECT COUNT(*) n FROM users WHERE guest = 0').n,
          guests: db.get('SELECT COUNT(*) n FROM users WHERE guest = 1').n,
          active24h: db.get('SELECT COUNT(*) n FROM users WHERE seen > ?', day).n,
          games24h: db.get('SELECT COUNT(*) n FROM games WHERE started > ?', day).n,
          openReports: db.get("SELECT COUNT(*) n FROM reports WHERE status = 'open'").n,
          banned: db.get('SELECT COUNT(*) n FROM users WHERE banned IS NOT NULL').n,
          premium: db.get('SELECT COUNT(DISTINCT user_id) n FROM entitlements WHERE key = ? AND revoked IS NULL AND (expires IS NULL OR expires > ?)', 'premium', Date.now()).n,
          orders24h: db.get("SELECT COUNT(*) n FROM orders WHERE status = 'paid' AND updated > ?", day).n,
          revenue30d: db.all("SELECT currency, SUM(amount) amount FROM orders WHERE status = 'paid' AND updated > ? GROUP BY currency", Date.now() - 30 * 86400e3),
          storeMode: shop ? shop.mode : 'off',
        })];
      }
      if (path === '/api/admin/users') {
        need('users.read');
        const q = String(body.q || '').trim();
        const rows = q
          ? db.all('SELECT id, name, guest, created, seen, banned, muted, age_band, consent IS NOT NULL consented FROM users WHERE name LIKE ? OR id = ? ORDER BY seen DESC LIMIT 50', '%' + q.replace(/[%_]/g, '') + '%', Number(q) || -1)
          : db.all('SELECT id, name, guest, created, seen, banned, muted, age_band, consent IS NOT NULL consented FROM users ORDER BY seen DESC LIMIT 50');
        return [200, rows.map((r) => Object.assign(r, { ratings: lobby.ratings(r.id) }))];
      }
      if ((m = path.match(/^\/api\/admin\/users\/(\d+)$/))) {
        need('users.read');
        const u = db.get('SELECT id, name, guest, created, seen, banned, muted, email, email_verified, deleted, age_band, consent IS NOT NULL consented FROM users WHERE id = ?', Number(m[1]));
        if (!u) return [404, { error: 'No such user.' }];
        u.ratings = lobby.ratings(u.id);
        u.games = db.all('SELECT * FROM games WHERE white = ? OR black = ? ORDER BY started DESC LIMIT 30', u.id, u.id);
        u.reports = db.all('SELECT * FROM reports WHERE target = ? ORDER BY created DESC LIMIT 30', u.id);
        if (fair) u.fairplay = { summary: fair.summary(u.id), games: db.all('SELECT * FROM fairplay WHERE user_id = ? ORDER BY created DESC LIMIT 20', u.id) };
        if (can(me.role, 'orders.read')) {
          u.orders = db.all('SELECT * FROM orders WHERE user_id = ? ORDER BY created DESC LIMIT 30', u.id);
          u.entitlements = db.all('SELECT * FROM entitlements WHERE user_id = ? ORDER BY granted DESC LIMIT 50', u.id);
          u.owns = shop ? shop.entitlements(u.id) : null;
        }
        return [200, u];
      }
      if ((m = path.match(/^\/api\/admin\/users\/(\d+)\/(ban|unban|mute|unmute|reset-ratings)$/)) && req.method === 'POST') {
        const id = Number(m[1]), act = m[2];
        const u = db.get('SELECT id FROM users WHERE id = ?', id);
        if (!u) return [404, { error: 'No such user.' }];
        const reason = String(body.reason || '').trim().slice(0, 300);
        if (act === 'ban') {
          need('users.ban');
          if (!reason) return [400, { error: 'A reason is required.' }];
          db.run('UPDATE users SET banned = ? WHERE id = ?', reason, id);
          db.run('DELETE FROM sessions WHERE user_id = ?', id);
          lobby.kick(id, reason);
        } else if (act === 'unban') { need('users.ban'); db.run('UPDATE users SET banned = NULL WHERE id = ?', id); }
        else if (act === 'mute' || act === 'unmute') { need('users.mute'); db.run('UPDATE users SET muted = ? WHERE id = ?', act === 'mute' ? 1 : 0, id); }
        else { need('ratings.reset'); if (!reason) return [400, { error: 'A reason is required.' }]; db.run('DELETE FROM ratings WHERE user_id = ?', id); }
        log('user.' + act, id, reason || null);
        return [200, { ok: true }];
      }
      if ((m = path.match(/^\/api\/admin\/users\/(\d+)\/entitlements$/)) && req.method === 'POST') {
        need('entitlements.manage');
        const id = Number(m[1]), key = String(body.key || '');
        if (!db.get('SELECT id FROM users WHERE id = ? AND guest = 0', id)) return [404, { error: 'No such registered player.' }];
        if (!/^(premium|pass:[a-z0-9-]{1,20})$/.test(key)) return [400, { error: 'Unknown entitlement.' }];
        const note = String(body.note || '').trim().slice(0, 300);
        if (!note) return [400, { error: 'A note is required.' }];
        const days = Math.max(0, Math.min(3660, Math.floor(Number(body.days) || 0)));
        const eid = shop.grant(id, key, days, 'staff', null, note);
        log('entitlement.grant', id, { key, days: days || 'forever', note, entitlement: eid });
        return [200, { ok: true, id: eid }];
      }
      if ((m = path.match(/^\/api\/admin\/entitlements\/(\d+)\/revoke$/)) && req.method === 'POST') {
        need('entitlements.manage');
        const note = String(body.note || '').trim().slice(0, 300);
        if (!note) return [400, { error: 'A note is required.' }];
        const r = db.run('UPDATE entitlements SET revoked = ? WHERE id = ? AND revoked IS NULL', Date.now(), Number(m[1]));
        if (!r.changes) return [404, { error: 'Nothing to revoke.' }];
        log('entitlement.revoke', m[1], note);
        return [200, { ok: true }];
      }
      if (path === '/api/admin/orders') {
        need('orders.read');
        return [200, db.all('SELECT o.*, u.name user_name FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.created DESC LIMIT 200')];
      }
      if ((m = path.match(/^\/api\/admin\/orders\/([A-Za-z0-9_-]{4,40})\/refund$/)) && req.method === 'POST') {
        need('entitlements.manage');
        const note = String(body.note || '').trim().slice(0, 300);
        if (!note) return [400, { error: 'A note is required.' }];
        // Marks the order refunded and removes what it bought. Send the money back in the provider's dashboard.
        if (!shop.refund(m[1], me.email, note)) return [409, { error: 'Only paid orders can be refunded.' }];
        return [200, { ok: true }];
      }
      if (path === '/api/admin/games') {
        need('games.read');
        return [200, db.all('SELECT g.*, w.name white_name, b.name black_name FROM games g JOIN users w ON w.id = g.white JOIN users b ON b.id = g.black ORDER BY started DESC LIMIT 100')];
      }
      if (path === '/api/admin/reports') {
        need('reports.read');
        return [200, db.all("SELECT r.*, COALESCE(a.name, 'Fair play system') reporter_name, t.name target_name FROM reports r LEFT JOIN users a ON a.id = r.reporter JOIN users t ON t.id = r.target ORDER BY (r.status = 'open') DESC, r.created DESC LIMIT 100")];
      }
      if (path === '/api/admin/fairplay') {
        need('reports.read');
        const players = db.all('SELECT DISTINCT u.id, u.name, u.banned FROM fairplay f JOIN users u ON u.id = f.user_id WHERE f.created > ?', Date.now() - 30 * 86400e3);
        const rows = players.map((u) => { const s = fair.summary(u.id); return Object.assign({ id: u.id, name: u.name, banned: !!u.banned, suspicious: fair.suspicious(s) }, s); })
          .sort((a, b) => (b.suspicious - a.suspicious) || (b.match - a.match));
        return [200, { thresholds: fair.thresholds, rows: rows.slice(0, 100) }];
      }
      if ((m = path.match(/^\/api\/admin\/reports\/(\d+)$/)) && req.method === 'POST') {
        need('reports.resolve');
        const status = body.status === 'actioned' ? 'actioned' : 'dismissed';
        db.run('UPDATE reports SET status = ? WHERE id = ?', status, Number(m[1]));
        log('report.' + status, m[1], body.note || null);
        return [200, { ok: true }];
      }
      if (path === '/api/admin/audit') {
        need('audit.read');
        return [200, { verify: audit.verify(db), rows: db.all('SELECT * FROM audit ORDER BY id DESC LIMIT 200') }];
      }
      if (path === '/api/admin/staff') {
        need('staff.manage');
        if (req.method === 'POST') {
          const pw = createStaff(db, body.email, body.role);
          log('staff.create', body.email, { role: body.role });
          return [200, { ok: true, password: pw }];
        }
        return [200, db.all('SELECT id, email, role, created, disabled FROM staff ORDER BY id')];
      }
      if ((m = path.match(/^\/api\/admin\/staff\/(\d+)\/(disable|enable)$/)) && req.method === 'POST') {
        need('staff.manage');
        if (Number(m[1]) === me.id) return [400, { error: 'You cannot disable yourself.' }];
        db.run('UPDATE staff SET disabled = ? WHERE id = ?', m[2] === 'disable' ? 1 : 0, Number(m[1]));
        if (m[2] === 'disable') db.run('DELETE FROM staff_sessions WHERE staff_id = ?', Number(m[1]));
        log('staff.' + m[2], m[1]);
        return [200, { ok: true }];
      }
    } catch (e) {
      if (e.status === 403) return [403, { error: 'Your role cannot do that.' }];
      if (/UNIQUE|Invalid|Unknown role/.test(e.message)) return [400, { error: e.message.replace(/^.*UNIQUE.*$/, 'That already exists.') }];
      throw e;
    }
    return [404, { error: 'Not found.' }];
  };
}

module.exports = { routes, createStaff, can, ROLES };
