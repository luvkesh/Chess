'use strict';
const crypto = require('node:crypto');

const N = 16384, KEYLEN = 32;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, KEYLEN, { N });
  return 'scrypt$' + salt.toString('base64') + '$' + h.toString('base64');
}

function checkPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const want = Buffer.from(hash, 'base64');
  const got = crypto.scryptSync(String(pw), Buffer.from(salt, 'base64'), want.length, { N });
  return crypto.timingSafeEqual(want, got);
}

const token = () => crypto.randomBytes(24).toString('base64url');

// Display names: 3-20 letters, digits, '_' or '-'. A short block list keeps out the obvious.
const BLOCKED = ['admin', 'moderator', 'support', 'chacklate', 'official', 'staff'];
function validName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_-]{3,20}$/.test(name)) return 'Names are 3 to 20 letters, digits, _ or -.';
  const k = name.toLowerCase();
  if (BLOCKED.some((b) => k.includes(b))) return 'That name is reserved.';
  return null;
}
function validPassword(pw) {
  return typeof pw === 'string' && pw.length >= 8 && pw.length <= 200 ? null : 'Passwords need at least 8 characters.';
}

// Fixed-window rate limiter keyed by string (IP, user id...).
function limiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    let h = hits.get(key);
    if (!h || now - h.start > windowMs) { h = { start: now, n: 0 }; hits.set(key, h); }
    if (hits.size > 50000) hits.clear();
    return ++h.n <= max;
  };
}

module.exports = { hashPassword, checkPassword, token, validName, validPassword, limiter };
