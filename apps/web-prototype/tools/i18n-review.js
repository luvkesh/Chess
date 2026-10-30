// Lists the lines still waiting for a native speaker's check, as CSV for a spreadsheet:
//   node tools/i18n-review.js hi > hindi-review.csv
// A reviewer fixes the text in packages/content/i18n/<area>.json and removes the language from
// that line's "check" list.
const fs = require('fs');
const path = require('path');
const lang = process.argv[2] || 'hi';
const dir = path.join(__dirname, '../../../packages/content/i18n');
const cell = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const rows = [['key', 'English', lang]];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
  const area = f.slice(0, -5);
  for (const [k, e] of Object.entries(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))) {
    if ((e.check || []).includes(lang)) rows.push([area + '.' + k, e.en, e[lang]]);
  }
}
process.stdout.write('﻿' + rows.map((r) => r.map(cell).join(',')).join('\n') + '\n');
