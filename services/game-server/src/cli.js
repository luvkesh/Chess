'use strict';
// Usage: node src/cli.js create-staff <email> <support|moderator|admin>
//        node src/cli.js verify-audit
const path = require('node:path');
const store = require('./db');
const admin = require('./admin');
const audit = require('./audit');

const db = store.open(process.env.CHACKLATE_DB || path.join(__dirname, '..', 'chacklate.db'));
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'create-staff') {
  const pw = admin.createStaff(db, a, b);
  audit.append(db, 'cli', 'staff.create', a, { role: b });
  console.log('Created ' + b + ' ' + a + '. One-time password: ' + pw);
} else if (cmd === 'verify-audit') {
  console.log(audit.verify(db));
} else {
  console.log('Usage: node src/cli.js create-staff <email> <support|moderator|admin> | verify-audit');
  process.exitCode = 1;
}
db.close();
