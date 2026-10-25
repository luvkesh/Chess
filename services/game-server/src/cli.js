'use strict';
// Usage: node src/cli.js create-staff <email> <support|moderator|admin>
//        node src/cli.js verify-audit
//        node src/cli.js backup <dir> [keep=14]
const fs = require('node:fs');
const path = require('node:path');
const store = require('./db');
const admin = require('./admin');
const audit = require('./audit');

process.removeAllListeners('warning'); // node:sqlite prints an experimental warning
const db = store.open(process.env.CHACKLATE_DB || path.join(__dirname, '..', 'chacklate.db'));
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'create-staff') {
  const pw = admin.createStaff(db, a, b);
  audit.append(db, 'cli', 'staff.create', a, { role: b });
  console.log('Created ' + b + ' ' + a + '. One-time password: ' + pw);
} else if (cmd === 'verify-audit') {
  console.log(audit.verify(db));
} else if (cmd === 'backup' && a) {
  // VACUUM INTO writes a consistent copy while the server keeps running.
  fs.mkdirSync(a, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
  const file = path.join(a, 'chacklate-' + stamp + '.db');
  db.raw.exec("VACUUM INTO '" + file.replace(/'/g, "''") + "'");
  const keep = Math.max(1, Number(b) || 14);
  const old = fs.readdirSync(a).filter((f) => /^chacklate-\d{8}-\d{6}\.db$/.test(f)).sort().reverse().slice(keep);
  for (const f of old) fs.unlinkSync(path.join(a, f));
  console.log('Backed up to ' + file + (old.length ? '; removed ' + old.length + ' old backup(s)' : ''));
} else {
  console.log('Usage: node src/cli.js create-staff <email> <support|moderator|admin> | verify-audit | backup <dir> [keep]');
  process.exitCode = 1;
}
db.close();
