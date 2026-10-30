'use strict';
// Account self-service: email and verification, password change and reset, data export and
// deletion. Links in emails use the configured public URL, never the request's Host header.
const crypto = require('node:crypto');
const auth = require('./auth');
const audit = require('./audit');

const HOUR = 3600e3;
const sha = (t) => crypto.createHash('sha256').update(t).digest('hex');
const validEmail = (e) => typeof e === 'string' && e.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);

function create(db, lobby, opts) {
  const mail = opts.mailer;
  const publicUrl = (opts.publicUrl || 'http://localhost:8080').replace(/\/+$/, '');
  const now = opts.now || Date.now;
  const limit = auth.limiter(5, 15 * 60000);

  function issue(userId, kind, ttl) {
    const t = crypto.randomBytes(32).toString('base64url');
    db.run('DELETE FROM account_tokens WHERE user_id = ? AND kind = ?', userId, kind);
    db.run('INSERT INTO account_tokens (hash, user_id, kind, expires) VALUES (?, ?, ?, ?)', sha(t), userId, kind, now() + ttl);
    return t;
  }
  function redeem(t, kind) {
    if (typeof t !== 'string' || t.length < 20) return null;
    const row = db.get('SELECT * FROM account_tokens WHERE hash = ? AND kind = ?', sha(t), kind);
    if (!row) return null;
    db.run('DELETE FROM account_tokens WHERE hash = ?', row.hash);
    return row.expires > now() ? row.user_id : null;
  }

  async function sendVerify(u, email) {
    const t = issue(u.id, 'verify', 7 * 24 * HOUR);
    const link = publicUrl + '/account/verify?token=' + t;
    await mail.send({ to: email, subject: 'Confirm your email for Chackmate',
      text: 'Hi ' + u.name + ',\n\nConfirm this address so you can reset your password if you ever forget it:\n' + link + '\n\nThe link works for 7 days. If you did not ask for this, ignore this email.',
      html: '<p>Hi ' + u.name + ',</p><p>Confirm this address so you can reset your password if you ever forget it.</p><p><a href="' + link + '">Confirm my email</a></p><p>The link works for 7 days. If you did not ask for this, ignore this email.</p>' });
  }

  function exportData(u) {
    const games = db.all('SELECT g.id, g.tc, g.rated, g.moves, g.result, g.reason, g.started, g.ended, w.name white, b.name black FROM games g JOIN users w ON w.id = g.white JOIN users b ON b.id = g.black WHERE g.white = ? OR g.black = ?', u.id, u.id);
    return {
      exported: new Date(now()).toISOString(),
      account: { id: u.id, name: u.name, email: u.email, emailVerified: !!u.email_verified, created: new Date(u.created).toISOString(), guest: !!u.guest },
      ratings: lobby.ratings(u.id),
      progress: u.progress ? JSON.parse(u.progress) : null,
      games,
      reportsFiled: db.all('SELECT game_id, reason, created, status FROM reports WHERE reporter = ?', u.id),
      orders: db.all('SELECT id, product, amount, currency, status, created FROM orders WHERE user_id = ?', u.id),
      entitlements: db.all('SELECT key, source, granted, expires, revoked FROM entitlements WHERE user_id = ?', u.id),
      notifications: db.all('SELECT endpoint, hour, tz, created FROM push_subs WHERE user_id = ?', u.id),
      location: { country: u.country || null, city: u.city || null, source: u.loc_src || null },
      friends: db.all('SELECT u.name, f.since FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ?', u.id),
    };
  }

  // Deletion keeps games (opponents' histories and ratings depend on them) and orders (tax law),
  // but nothing that identifies the person: name, email, password, progress and devices go.
  function deleteAccount(u) {
    const label = 'Deleted player ' + u.id;
    db.tx(() => {
      db.run('UPDATE users SET name = ?, name_key = NULL, pass = NULL, email = NULL, email_key = NULL, email_verified = 0, progress = NULL, guest = 1, deleted = ?, parent_id = NULL, birth_ym = NULL, controls = NULL, consent = NULL, country = NULL, city = NULL, loc_src = NULL WHERE id = ?', label, now(), u.id);
      for (const t of ['sessions', 'push_subs', 'account_tokens', 'fairplay']) db.run('DELETE FROM ' + t + ' WHERE user_id = ?', u.id);
      db.run('DELETE FROM ratings WHERE user_id = ?', u.id);
      db.run('DELETE FROM friends WHERE user_id = ? OR friend_id = ?', u.id, u.id);
    });
    lobby.kick(u.id, 'This account was deleted.', 'deleted');
    audit.append(db, 'system', 'account.deleted', u.id, null);
  }

  // Returns [status, body] or null when the path is not an account route.
  return async function handle(req, p, body, ip, user) {
    if (p === '/api/account/forgot' && req.method === 'POST') {
      if (!limit('forgot:' + ip)) return [429, { error: 'Too many attempts. Try again in 15 minutes.' }];
      const q = String(body.who || '').trim().toLowerCase();
      const u = q && db.get('SELECT * FROM users WHERE (name_key = ? OR email_key = ?) AND email_verified = 1 AND banned IS NULL', q, q);
      if (u) {
        const t = issue(u.id, 'reset', HOUR);
        const link = publicUrl + '/play#reset=' + t;
        await mail.send({ to: u.email, subject: 'Reset your Chackmate password',
          text: 'Hi ' + u.name + ',\n\nChoose a new password here:\n' + link + '\n\nThe link works for one hour. If you did not ask for this, ignore this email; your password has not changed.',
          html: '<p>Hi ' + u.name + ',</p><p><a href="' + link + '">Choose a new password</a></p><p>The link works for one hour. If you did not ask for this, ignore this email; your password has not changed.</p>' });
      }
      // Same answer either way, so this cannot be used to find out who has an account.
      return [200, { ok: true, message: 'If that account has a confirmed email, a reset link is on its way.' }];
    }
    if (p === '/api/account/reset' && req.method === 'POST') {
      const bad = auth.validPassword(body.password);
      if (bad) return [400, { error: bad }];
      const uid = redeem(body.token, 'reset');
      if (!uid) return [400, { error: 'This reset link has expired or was already used. Ask for a new one.' }];
      db.run('UPDATE users SET pass = ? WHERE id = ?', auth.hashPassword(body.password), uid);
      db.run('DELETE FROM sessions WHERE user_id = ?', uid);
      const u = db.get('SELECT * FROM users WHERE id = ?', uid);
      return [200, { ok: true, name: u.name }];
    }
    if (!p.startsWith('/api/account/')) return null;
    if (!user) return [401, { error: 'Not signed in.' }];
    if (user.guest) return [403, { error: 'Create an account first.' }];

    if (p === '/api/account/email' && req.method === 'POST') {
      // Under-18 accounts use their parent's email, set through the parent page.
      if (user.age_band !== 'adult') return [403, { error: 'A parent manages the email for this account.' }];
      if (!limit('email:' + user.id)) return [429, { error: 'Too many attempts. Try again in 15 minutes.' }];
      const email = String(body.email || '').trim();
      if (!validEmail(email)) return [400, { error: 'That does not look like an email address.' }];
      const key = email.toLowerCase();
      const taken = db.get('SELECT id FROM users WHERE email_key = ? AND id != ?', key, user.id);
      if (taken) return [409, { error: 'Another account uses that email.' }];
      if (user.email_key !== key) db.run('UPDATE users SET email = ?, email_key = ?, email_verified = 0 WHERE id = ?', email, key, user.id);
      await sendVerify(user, email);
      return [200, { ok: true, email, verified: false }];
    }
    if (p === '/api/account/password' && req.method === 'POST') {
      if (!limit('pw:' + user.id)) return [429, { error: 'Too many attempts. Try again in 15 minutes.' }];
      if (!auth.checkPassword(body.current, user.pass)) return [401, { error: 'Your current password is not right.' }];
      const bad = auth.validPassword(body.password);
      if (bad) return [400, { error: bad }];
      db.run('UPDATE users SET pass = ? WHERE id = ?', auth.hashPassword(body.password), user.id);
      // Sign out every other device.
      const token = (req.headers.authorization || '').slice(7);
      db.run('DELETE FROM sessions WHERE user_id = ? AND token != ?', user.id, token);
      return [200, { ok: true }];
    }
    if (p === '/api/account/export') return [200, exportData(user)];
    if (p === '/api/account/delete' && req.method === 'POST') {
      if (!auth.checkPassword(body.password, user.pass)) return [401, { error: 'Your password is not right.' }];
      deleteAccount(user);
      return [200, { ok: true }];
    }
    return [404, { error: 'Not found.' }];
  };
}

// GET /account/verify?token=... from the email link: confirms and sends the player into the game.
function verifyPage(db, token, now) {
  if (typeof token !== 'string' || token.length < 20) return '/play#email-invalid';
  const row = db.get("SELECT * FROM account_tokens WHERE hash = ? AND kind = 'verify'", sha(token));
  if (!row) return '/play#email-invalid';
  db.run('DELETE FROM account_tokens WHERE hash = ?', row.hash);
  if (row.expires <= (now || Date.now)()) return '/play#email-invalid';
  db.run('UPDATE users SET email_verified = 1 WHERE id = ?', row.user_id);
  return '/play#email-verified';
}

module.exports = { create, verifyPage, validEmail };
