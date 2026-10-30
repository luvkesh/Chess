// Every UI string in every language. The strings live in packages/content/i18n/, one file per
// area, each key holding all languages side by side. This fails when:
// - any language misses a key, or has an empty string;
// - a translation drops or adds a {placeholder} the English has;
// - the code asks t() for a key that no file has.
// It also counts the lines still marked for a native speaker's check ("check": ["hi"]).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../../../packages/content/i18n');
const strings = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) strings[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
global.CHACKLATE_STRINGS = strings;
const I18N = require('../src/i18n.js');
const LANGS = I18N.LANGS.map((l) => l.id);
assert.strictEqual(LANGS[0], 'en', 'English comes first: it is the fallback');

const holes = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const problems = [];
const toCheck = {};
let n = 0;
for (const [area, entries] of Object.entries(strings)) {
  assert.ok(/^[a-z][a-z0-9-]*$/.test(area), 'file name ' + area + ' must be a plain lowercase word');
  for (const [k, e] of Object.entries(entries)) {
    const key = area + '.' + k;
    n++;
    if (!e || typeof e !== 'object') { problems.push(key + ': not an object of languages'); continue; }
    for (const l of LANGS) {
      if (typeof e[l] !== 'string' || !e[l].trim()) problems.push(key + ': no ' + l);
      else if (holes(e[l]) !== holes(e.en)) problems.push(key + ': ' + l + ' has {' + holes(e[l]) + '}, English has {' + holes(e.en) + '}');
    }
    for (const l of Object.keys(e)) if (l !== 'check' && !LANGS.includes(l)) problems.push(key + ': unknown language ' + l);
    for (const l of e.check || []) {
      if (!LANGS.includes(l) || l === 'en') problems.push(key + ': check lists ' + l);
      else (toCheck[l] = toCheck[l] || []).push(key);
    }
  }
}

// Keys the code asks for. A key built at run time is written t('area.' + x); those are listed
// in the file next to it and are checked by the prefix having at least one key.
const code = [
  ...fs.readdirSync(path.join(__dirname, '../src')).filter((f) => f.endsWith('.js')).map((f) => path.join(__dirname, '../src', f)),
  path.join(__dirname, '../src/shell.html'),
  path.join(__dirname, '../../../packages/chess-core/src/coach.js'),
];
let used = 0;
for (const f of code) {
  const text = fs.readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\bt\(\s*'([a-z][\w-]*\.[\w.-]*)'\s*([+,)])/g)) {
    const key = m[1];
    const i = key.indexOf('.');
    const area = strings[key.slice(0, i)];
    used++;
    if (m[2] === '+') { if (!area || !Object.keys(area).some((k) => k.startsWith(key.slice(i + 1)))) problems.push(path.basename(f) + ': no keys start with ' + key); }
    else if (!area || !area[key.slice(i + 1)]) problems.push(path.basename(f) + ': t(\'' + key + '\') has no string');
  }
}
// Content strings: their English must match the content files they translate.
const want = require('./i18n-content.js').expected();
const have = strings.content || {};
for (const [k, en] of Object.entries(want)) {
  if (!have[k]) problems.push('content.' + k + ': missing (English: ' + en + ')');
  else if (have[k].en !== en) problems.push('content.' + k + ': English changed to "' + en + '", update the translations');
}
for (const k of Object.keys(have)) if (!(k in want)) problems.push('content.' + k + ': no longer in the content files');
// The coach's sentences: coach.js keeps the English (it also runs in Node and in workers).
const E = require('../../../packages/chess-core/src/engine.js');
const coachEN = require('../../../packages/chess-core/src/coach.js')(typeof E === 'function' ? E() : E).EN;
for (const [k, en] of Object.entries(coachEN)) {
  if (!(strings.coach || {})[k]) problems.push('coach.' + k + ': missing (English: ' + en + ')');
  else if (strings.coach[k].en !== en) problems.push('coach.' + k + ': English in coach.js changed to "' + en + '", update the translations');
}

assert.ok(problems.length === 0, problems.length + ' string problems:\n  ' + problems.join('\n  '));

// The runtime: fallback, placeholders and the first-run guess.
I18N.set('en');
const [area, entries] = Object.entries(strings)[0] || [];
if (area) { const k = Object.keys(entries)[0]; assert.strictEqual(I18N.t(area + '.' + k), entries[k].en); }
assert.strictEqual(I18N.t('nope.missing'), 'nope.missing');
assert.strictEqual(I18N.guess(['hi-IN', 'en-US']), LANGS.includes('hi') ? 'hi' : 'en');
assert.strictEqual(I18N.guess(['fr-FR']), 'en');

console.log('i18n: ' + n + ' strings in ' + LANGS.join(', ') + ', ' + used + ' t() calls, all present' +
  Object.entries(toCheck).map(([l, ks]) => '; ' + ks.length + ' ' + l + ' lines await a native speaker\'s check').join(''));
