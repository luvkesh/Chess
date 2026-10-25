'use strict';
// Web Push without dependencies: VAPID (RFC 8292) and aes128gcm payload encryption (RFC 8291).
// The only reminder today is the daily one: at the hour a player picks, if they have not played
// yet that day, nudge them about their streak or the daily puzzle.
const crypto = require('node:crypto');

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

// Encrypts one push message for a subscription's keys. salt and the server's key pair can be
// passed in for the RFC test vector; normally both are random per message.
function encrypt(plaintext, uaPublic, authSecret, opts) {
  opts = opts || {};
  const ecdh = crypto.createECDH('prime256v1');
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const salt = opts.salt || crypto.randomBytes(16);
  const secret = ecdh.computeSecret(uaPublic);
  const prkKey = hmac(authSecret, secret);
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

function generateVapid() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

// The Authorization header for one push service origin.
function vapidAuth(endpoint, vapid, subject, now) {
  const pub = unb64u(vapid.publicKey);
  const key = crypto.createPrivateKey({ format: 'jwk', key: { kty: 'EC', crv: 'P-256', d: vapid.privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) } });
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor((now || Date.now()) / 1000) + 12 * 3600, sub: subject }));
  const sig = crypto.sign('sha256', Buffer.from(head + '.' + claims), { key, dsaEncoding: 'ieee-p1363' });
  return 'vapid t=' + head + '.' + claims + '.' + b64u(sig) + ', k=' + vapid.publicKey;
}

function validSubscription(s) {
  if (!s || typeof s.endpoint !== 'string' || !s.keys) return false;
  let u; try { u = new URL(s.endpoint); } catch { return false; }
  if (u.protocol !== 'https:' || s.endpoint.length > 1000) return false;
  try { return unb64u(s.keys.p256dh).length === 65 && unb64u(s.keys.auth).length === 16; } catch { return false; }
}

const localDay = (t, tz) => new Date(t + tz * 60000).toISOString().slice(0, 10);
const localHour = (t, tz) => new Date(t + tz * 60000).getUTCHours();

function create(db, opts) {
  opts = opts || {};
  const now = opts.now || Date.now;
  const subject = opts.subject || 'mailto:support@chacklate.example';
  let vapid = opts.vapid && opts.vapid.publicKey ? opts.vapid : null;
  if (!vapid) {
    // Generated once and kept in the database, so subscriptions survive restarts.
    const row = db.get("SELECT value FROM config WHERE key = 'vapid'");
    if (row) vapid = JSON.parse(row.value);
    else { vapid = generateVapid(); db.run("INSERT INTO config (key, value) VALUES ('vapid', ?)", JSON.stringify(vapid)); }
  }

  async function deliver(sub, payload) {
    const body = encrypt(JSON.stringify(payload), unb64u(sub.p256dh), unb64u(sub.auth));
    const res = await fetch(sub.endpoint, { method: 'POST', body, headers: {
      'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '43200', Urgency: 'normal',
      Authorization: vapidAuth(sub.endpoint, vapid, subject, now()),
    } });
    return res.status;
  }
  const send = opts.send || deliver;

  function subscribe(userId, s, hour, tz) {
    if (!validSubscription(s)) return [400, { error: 'That is not a push subscription.' }];
    const h = Math.max(0, Math.min(23, Math.floor(Number(hour))));
    const z = Math.max(-840, Math.min(840, Math.round(Number(tz) || 0)));
    db.run('DELETE FROM push_subs WHERE endpoint = ?', s.endpoint);
    db.run('INSERT INTO push_subs (user_id, endpoint, p256dh, auth, hour, tz, created) VALUES (?, ?, ?, ?, ?, ?, ?)', userId, s.endpoint, s.keys.p256dh, s.keys.auth, Number.isFinite(h) ? h : 19, z, now());
    return [200, { ok: true }];
  }
  function unsubscribe(userId, endpoint) {
    db.run('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?', userId, String(endpoint || ''));
    return [200, { ok: true }];
  }

  // What to say, or null when the player has already played today.
  function reminderFor(user, day) {
    let p = null; try { p = user.progress ? JSON.parse(user.progress) : null; } catch { p = null; }
    const streak = p && p.streak ? p.streak : { count: 0, last: '' };
    if (streak.last === day) return null;
    const yesterday = new Date(Date.parse(day) - 86400e3).toISOString().slice(0, 10);
    if (streak.count >= 2 && streak.last === yesterday) return { title: 'Keep your ' + streak.count + '-day streak', body: 'It ends at midnight. One puzzle keeps it alive.', tag: 'daily', url: '/play' };
    return { title: 'Today\'s puzzle is ready', body: 'Three daily missions and a fresh puzzle are waiting.', tag: 'daily', url: '/play' };
  }

  // Runs once a minute. Each subscription gets at most one reminder per local day.
  let running = false;
  async function tick() {
    if (running) return 0;
    running = true;
    let sent = 0;
    try {
      const t = now();
      for (const s of db.all('SELECT p.*, u.progress, u.banned FROM push_subs p JOIN users u ON u.id = p.user_id')) {
        const day = localDay(t, s.tz);
        if (s.banned || s.last_day === day || localHour(t, s.tz) !== s.hour) continue;
        db.run('UPDATE push_subs SET last_day = ? WHERE id = ?', day, s.id);
        const msg = reminderFor(s, day);
        if (!msg) continue;
        try {
          const status = await send(s, msg);
          if (status === 404 || status === 410) db.run('DELETE FROM push_subs WHERE id = ?', s.id);
          else if (status >= 200 && status < 300) sent++;
        } catch (e) { (opts.log || (() => {}))('push failed', e.message); }
      }
    } finally { running = false; }
    return sent;
  }

  return { publicKey: vapid.publicKey, subscribe, unsubscribe, tick, reminderFor };
}

module.exports = { create, encrypt, vapidAuth, generateVapid, validSubscription };
