// The English of every longer content text a player reads or hears that is not a UI key:
// lessons, era stories and quizzes, openings, endgames, variant rules, the placement test,
// Collection descriptions and Rooky's pitches, the chess sets' stories and piece notes. Set, board
// and room names stay as they are, like the characters' names. Each language translates them in packages/content/i18n/text/<lang>.json,
// keyed by the English (src/i18n.js tx()). test/i18n.test.js fails when a language misses one.
//   node tools/i18n-text.js            the list, one JSON string per line
//   node tools/i18n-text.js hi         only the ones packages/content/i18n/text/hi.json misses
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../../..');
const content = path.join(root, 'packages/content');
const src = path.join(__dirname, '../src');

// Fields that hold ids, positions, moves and other data, never words for a player.
const SKIP = new Set(['id', 'fen', 'start', 'moves', 'answers', 'answer', 'from', 'to', 'marks', 'arrows', 'dots', 'colors', 'engine',
  'voice', 'theme', 'src', 'key', 'site', 'set', 'board', 'room', 'landmark', 'access', 'kind', 'type', 'category', 'rarity', 'unlock', 'data',
  'skus', 'currency', 'eco', 'side', 'status', 'who', 'lang', 'accent', 'gender', 'period', 'tint', 'version', 'note', 'goal', 'era',
  'say', 'speakers', 'suite', 'piece', 'pieces3d', 'look', 'grants', 'price', 'reward', 'unlocks', 'requires', 'needs', 'events', 'moves', 'voices']);
// Fields that are words even though their name is also used for data elsewhere.
const WORDS = { lessons: ['say'], campaign: ['say'], placement: ['say'], variants: ['moves'] };

const isWords = (s) => typeof s === 'string' && /[A-Za-z]{2}/.test(s) && !/^[a-z0-9._:/-]+$/.test(s) && !/^#[0-9a-f]{3,8}$/i.test(s);

function walk(o, file, out, keyName) {
  if (typeof o === 'string') { if (isWords(o)) out.add(o.trim()); return; }
  if (Array.isArray(o)) { o.forEach((x) => walk(x, file, out, keyName)); return; }
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (SKIP.has(k) && !(WORDS[file] || []).includes(k)) continue;
    walk(v, file, out, k);
  }
}

// String literals under the given property names in a 3D source file (set stories, piece notes,
// board and room names). The files need three.js to run, so they are read as text.
function literals(file, props) {
  const text = fs.readFileSync(path.join(src, file), 'utf8');
  const out = [];
  const re = new RegExp('\\b(?:' + props.join('|') + "):\\s*('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\")", 'g');
  for (const m of text.matchAll(re)) {
    const s = m[1].slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"');
    if (isWords(s) && !/[\n{}=;]|\\n/.test(s)) out.push(s);
  }
  return out;
}

function uiEnglish() {
  const set = new Set();
  const dir = path.join(content, 'i18n');
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    for (const e of Object.values(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))) if (e && e.en) set.add(e.en);
  }
  return set;
}

function strings() {
  const out = new Set();
  for (const f of ['lessons', 'campaign', 'openings', 'endgames', 'variants', 'placement', 'catalog', 'pitches', 'store', 'seasons', 'missions']) {
    const j = JSON.parse(fs.readFileSync(path.join(content, f + '.json'), 'utf8'));
    if (f === 'pitches') { for (const v of Object.values(j.lines)) if (typeof v === 'string') out.add(v); continue; }
    walk(f === 'campaign' ? { coach: { blurb: j.coach.blurb }, opponents: j.opponents, eras: j.eras } : j, f, out);
  }
  for (const s of literals('pieces3d.js', ['story', 'era', 'k', 'q', 'b', 'n', 'r', 'p'])) out.add(s);
  for (const s of literals('suites3d.js', ['blurb', 'story'])) out.add(s);
  // Names stay as they are in every language: the characters, the game, and the sets, boards and
  // rooms (product names, as in the approved Hindi).
  const campaign = JSON.parse(fs.readFileSync(path.join(content, 'campaign.json'), 'utf8'));
  const catalog = JSON.parse(fs.readFileSync(path.join(content, 'catalog.json'), 'utf8'));
  const keep = new Set(['Chackmate', campaign.coach.name, ...campaign.opponents.map((o) => o.name), ...campaign.eras.map((e) => e.coach.name),
    ...catalog.items.map((i) => i.name), ...literals('pieces3d.js', ['name']), ...literals('world3d.js', ['name']), ...literals('suites3d.js', ['name'])]);
  const ui = uiEnglish();
  return [...out].filter((s) => !keep.has(s) && !ui.has(s)).sort();
}

module.exports = { strings, uiEnglish };

if (require.main === module) {
  const lang = process.argv[2];
  let list = strings();
  if (lang) {
    const file = path.join(content, 'i18n/text', lang + '.json');
    const have = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    list = list.filter((s) => !have[s]);
  }
  for (const s of list) console.log(JSON.stringify(s));
}
