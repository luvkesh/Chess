'use strict';
// Append-only, hash-chained audit log. Each row commits to the previous row's hash, so editing or
// deleting any row breaks verification from that point on.
const crypto = require('node:crypto');

const GENESIS = '0'.repeat(64);
const digest = (r) => crypto.createHash('sha256')
  .update([r.prev, r.at, r.actor, r.action, r.target || '', r.detail || ''].join('|')).digest('hex');

function append(db, actor, action, target, detail) {
  return db.tx(() => {
    const last = db.get('SELECT hash FROM audit ORDER BY id DESC LIMIT 1');
    const row = { at: Date.now(), actor, action, target: target == null ? null : String(target),
      detail: detail == null ? null : (typeof detail === 'string' ? detail : JSON.stringify(detail)), prev: last ? last.hash : GENESIS };
    row.hash = digest(row);
    db.run('INSERT INTO audit (at, actor, action, target, detail, prev, hash) VALUES (?, ?, ?, ?, ?, ?, ?)',
      row.at, row.actor, row.action, row.target, row.detail, row.prev, row.hash);
    return row;
  });
}

function verify(db) {
  let prev = GENESIS, n = 0;
  for (const r of db.all('SELECT * FROM audit ORDER BY id')) {
    if (r.prev !== prev || digest(r) !== r.hash) return { ok: false, brokenAt: r.id, checked: n };
    prev = r.hash; n++;
  }
  return { ok: true, checked: n };
}

module.exports = { append, verify };
