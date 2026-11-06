// Every UI string in every language. The strings live in packages/content/i18n/, one file per
// area, each key holding all languages side by side. This fails when:
// - any language misses a key, or has an empty string;
// - a translation drops or adds a {placeholder} the English has;
// - the code asks t() (or a data-t attribute in shell.html) for a key that no file has.
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
    for (const l of Object.keys(e)) if (l !== 'check' && !I18N.ALL.some((x) => x.id === l)) problems.push(key + ': unknown language ' + l);
    for (const l of e.check || []) {
      if (!I18N.ALL.some((x) => x.id === l) || l === 'en') problems.push(key + ': check lists ' + l);
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
  path.join(__dirname, '../../../packages/chess-core/src/mentor.js'),
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
  for (const m of text.matchAll(/data-t(?:-aria)?="([a-z][\w-]*)\.([\w.-]+)"/g)) {
    used++;
    if (!(strings[m[1]] || {})[m[2]]) problems.push(path.basename(f) + ': data-t="' + m[1] + '.' + m[2] + '" has no string');
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
// Rooky's captions: guide.json keeps the spoken English, i18n/guide.json the captions.
const guideLines = require('../../../packages/content/guide.json').lines;
for (const [k, l] of Object.entries(guideLines)) {
  if (!(strings.guide || {})[k]) problems.push('guide.' + k + ': missing (English: ' + l.text + ')');
  else if (strings.guide[k].en !== l.text) problems.push('guide.' + k + ': English in guide.json changed to "' + l.text + '", update the translations');
}
for (const k of Object.keys(strings.guide || {})) if (!(k in guideLines)) problems.push('guide.' + k + ': no longer in guide.json');
// The coach's sentences: coach.js keeps the English (it also runs in Node and in workers).
const E = require('../../../packages/chess-core/src/engine.js');
const coachEN = require('../../../packages/chess-core/src/coach.js')(typeof E === 'function' ? E() : E).EN;
for (const [k, en] of Object.entries(coachEN)) {
  if (!(strings.coach || {})[k]) problems.push('coach.' + k + ': missing (English: ' + en + ')');
  else if (strings.coach[k].en !== en) problems.push('coach.' + k + ': English in coach.js changed to "' + en + '", update the translations');
}
// The mentor's sentences: mentor.js keeps the English, i18n/mentor.json the translations.
const mentorEN = require('../../../packages/chess-core/src/mentor.js')(typeof E === 'function' ? E() : E, require('../../../packages/chess-core/src/coach.js')(typeof E === 'function' ? E() : E)).EN;
for (const [k, en] of Object.entries(mentorEN)) {
  if (!(strings.mentor || {})[k]) problems.push('mentor.' + k + ': missing (English: ' + en + ')');
  else if (strings.mentor[k].en !== en) problems.push('mentor.' + k + ': English in mentor.js changed to "' + en + '", update the translations');
}
for (const k of Object.keys(strings.mentor || {})) if (!(k in mentorEN)) problems.push('mentor.' + k + ': no longer in mentor.js');

// Longer content (lessons, stories, openings, rules, set stories, pitches): every language's
// text/<lang>.json translates each English string tools/i18n-text.js finds.
const textEN = require('../tools/i18n-text.js').strings();
const textDir = path.join(dir, 'text');
let textN = 0;
for (const l of LANGS.slice(1)) {
  const f = path.join(textDir, l + '.json');
  const tab = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const miss = textEN.filter((en) => typeof tab[en] !== 'string' || !tab[en].trim());
  if (miss.length) problems.push('text/' + l + '.json misses ' + miss.length + ' content strings (node tools/i18n-text.js ' + l + '), e.g. ' + JSON.stringify(miss[0]));
  for (const en of textEN) if (tab[en] && holes(tab[en]) !== holes(en)) problems.push('text/' + l + '.json: ' + JSON.stringify(en.slice(0, 50)) + ' has {' + holes(tab[en]) + '}');
  textN = textEN.length;
}
// Game calls (check, mate, results) and the words for moves, said in every language.
const VOICE = require('../../../packages/content/voice.json');
for (const l of LANGS) {
  const ev = VOICE.events[l] || {};
  for (const k of Object.keys(VOICE.events.en)) if (!ev[k]) problems.push('voice.json events.' + l + '.' + k + ': missing');
  const mv = VOICE.moves[l];
  if (!mv) problems.push('voice.json moves.' + l + ': missing');
  else for (const k of ['piece', 'takes', 'file', 'rank', 'castleK', 'castleQ', 'promote', 'check', 'mate']) if (mv[k] === undefined) problems.push('voice.json moves.' + l + '.' + k + ': missing');
}

// The rule book's sentences: rules.js keeps the English.
const rulesEN = require('../src/rules.js')(typeof E === 'function' ? E() : E).EN;
for (const [k, en] of Object.entries(rulesEN)) {
  if (!(strings.rules || {})[k]) problems.push('rules.' + k + ': missing (English: ' + en + ')');
  else if (strings.rules[k].en !== en) problems.push('rules.' + k + ': English in rules.js changed to "' + en + '", update the translations');
}
for (const k of Object.keys(strings.rules || {})) if (!(k in rulesEN)) problems.push('rules.' + k + ': no longer in rules.js');

assert.ok(problems.length === 0, problems.length + ' string problems:\n  ' + problems.join('\n  '));

// The runtime: fallback, placeholders and the first-run guess.
I18N.set('en');
const [area, entries] = Object.entries(strings)[0] || [];
if (area) { const k = Object.keys(entries)[0]; assert.strictEqual(I18N.t(area + '.' + k), entries[k].en); }
assert.strictEqual(I18N.t('nope.missing'), 'nope.missing');
assert.strictEqual(I18N.guess(['hi-IN', 'en-US']), LANGS.includes('hi') ? 'hi' : 'en');
assert.strictEqual(I18N.guess(['de-DE']), 'en');
assert.strictEqual(I18N.guess(['de-DE', 'fr-FR']), LANGS.includes('fr') ? 'fr' : 'en');

console.log('i18n: ' + n + ' strings and ' + textN + ' content texts in ' + LANGS.join(', ') + ', ' + used + ' t() calls, all present' +
  Object.entries(toCheck).map(([l, ks]) => '; ' + ks.length + ' ' + l + ' lines await a native speaker\'s check').join(''));
