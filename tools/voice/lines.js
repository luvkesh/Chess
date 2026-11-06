'use strict';
// Every line the recorded voices speak, keyed the same way the game looks them up (voiceKey of the
// text shown on screen). The spoken text can differ from the shown text: chess notation is read out.
const fs = require('fs');
const path = require('path');

const content = path.join(__dirname, '..', '..', 'packages', 'content');
const load = (f) => JSON.parse(fs.readFileSync(path.join(content, f), 'utf8'));

// FNV-1a, 32-bit, as hex. Kept identical to voiceKey() in apps/web-prototype/src/audio.js.
function voiceKey(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text).normalize('NFC')) {
    const c = ch.codePointAt(0);
    h ^= c & 0xff; h = Math.imul(h, 0x01000193);
    if (c > 0xff) { h ^= (c >>> 8) & 0xff; h = Math.imul(h, 0x01000193); }
    if (c > 0xffff) { h ^= (c >>> 16) & 0xff; h = Math.imul(h, 0x01000193); }
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// Reads chess notation inside English sentences the way a coach would say it.
function spokenEn(text, M) {
  const sq = (f, r) => M.file[f] + ' ' + M.rank[r];
  return String(text)
    .replace(/\bO-O-O\b/g, M.castleQ.toLowerCase())
    .replace(/\bO-O\b/g, M.castleK.toLowerCase())
    .replace(/\b([KQRBN])([a-h1-8]?)(x?)([a-h])([1-8])(?:=([QRBN]))?([+#]?)/g, (m, p, d, x, f, r, promo, c) =>
      M.piece[p] + (x ? ' ' + M.takes : '') + ' ' + sq(f, r) + (promo ? ' ' + M.promote[promo] : '') + (c === '#' ? ' ' + M.mate : c ? ' ' + M.check : ''))
    .replace(/\b([a-h])x([a-h])([1-8])(?:=([QRBN]))?([+#]?)/g, (m, from, f, r, promo, c) =>
      M.file[from] + ' ' + M.takes + ' ' + sq(f, r) + (promo ? ' ' + M.promote[promo] : '') + (c === '#' ? ' ' + M.mate : c ? ' ' + M.check : ''))
    .replace(/\b([a-h])([1-8])\b/g, (m, f, r) => sq(f, r))
    .replace(/\b([a-h])-(file|pawn)s?\b/g, (m, f, w) => M.file[f] + ' ' + w + (m.endsWith('s') ? 's' : ''))
    .replace(/\b([a-h])-and-([a-h])-/g, (m, a, b) => M.file[a] + ' and ' + M.file[b] + ' ');
}

// The fixed pieces a move announcement is put together from, e.g. "Knight", "takes", "ee five", "check".
function fragments(M) {
  const out = Object.values(M.piece).concat([M.takes, M.castleK, M.castleQ, M.check, M.mate], Object.values(M.promote));
  if (M.old) out.push(...Object.values(M.old.piece), ...Object.values(M.old.promote));   // Chaturanga's pieces
  for (const f of Object.keys(M.file)) for (const r of Object.keys(M.rank)) out.push(M.file[f] + ' ' + M.rank[r]);
  return out;
}

function lessonLines() {
  const out = [];
  for (const l of load('lessons.json').lessons) {
    if (l.voice) continue;   // said by its own speakers, see wordLines()
    for (const s of l.steps) if (s.say) out.push(s.say);
    for (const e of l.exercises) {
      if (e.prompt) out.push(e.prompt);
      for (const h of e.hints || []) out.push(h);
    }
  }
  for (const o of load('openings.json').openings) {
    out.push(o.summary);
    for (const i of o.ideas || []) out.push(i);
    for (const n of Object.values(o.notes || {})) out.push(n);
  }
  for (const e of load('endgames.json').endgames) if (e.tip) out.push(e.tip);
  // The Journey: each era's lesson and its puzzle introduction (its story is read by the era's friend,
  // see record-tales.py).
  for (const era of load('campaign.json').eras) {
    for (const s of era.stages) {
      if (s.kind === 'lesson') {
        for (const st of s.steps) if (st.say) out.push(st.say);
        for (const e of s.exercises) {
          if (e.prompt) out.push(e.prompt);
          for (const h of e.hints || []) out.push(h);
        }
      }
      if (s.kind === 'puzzles' && s.intro) out.push(s.intro);
    }
  }
  return out;
}

// Lessons with their own speakers ("voice": "rooky", such as Words at the table): Rooky says every
// English line and word, and Priya says each word in Hindi. Recorded by tools/voice/record-words.py.
function wordLines() {
  const M = load('voice.json').moves.en, out = [];
  // read out the way a child should hear it: notation as words, j'adoube as the French says it
  const spoken = (who, text) => (who === 'priya' ? text.replace(/-/g, ' ') : spokenEn(text, M).replace(/j'adoube/gi, (w) => (w[0] === 'J' ? 'Zha' : 'zha') + ' doob').replace(/Shah-maat/g, 'Shah maat'));
  const add = (who, text) => { if (text && !out.some((o) => o.who === who && o.text === text)) out.push({ who, text, key: voiceKey(text), spoken: spoken(who, text) }); };
  for (const l of load('lessons.json').lessons) {
    if (!l.voice) continue;
    for (const s of l.steps) { add(l.voice, s.say); if (s.word) { add(l.voice, s.word.en); add('priya', s.word.hi); } }
    for (const e of l.exercises) { add(l.voice, e.prompt); for (const h of e.hints || []) add(l.voice, h); }
  }
  return out;
}

// Translates content text the way the game does on screen (src/i18n.js text()), or null when the
// language has no translation for it.
const translators = {};
function translator(lang) {
  if (translators[lang]) return translators[lang];
  const dir = path.join(__dirname, '..', '..', 'packages', 'content', 'i18n');
  const strings = {}, text = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) strings[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const f of fs.readdirSync(path.join(dir, 'text')).filter((f) => f.endsWith('.json'))) {
    text[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, 'text', f), 'utf8'));
    delete text[f.slice(0, -5)]._meta;
  }
  const keep = [global.CHACKLATE_STRINGS, global.CHACKLATE_TEXT];
  global.CHACKLATE_STRINGS = strings; global.CHACKLATE_TEXT = text;
  const file = require.resolve(path.join(__dirname, '..', '..', 'apps', 'web-prototype', 'src', 'i18n.js'));
  const cached = require.cache[file];
  delete require.cache[file];
  const I18N = require(file);
  if (cached) require.cache[file] = cached; else delete require.cache[file];
  [global.CHACKLATE_STRINGS, global.CHACKLATE_TEXT] = keep;
  I18N.set(lang);
  if (I18N.lang !== lang) throw new Error('the game has no ' + lang);
  const tr = (en) => { const s = I18N.text(en); return s && s !== en && /[^\x00-\x7f]/.test(s) ? s : null; };
  tr.I18N = I18N;
  return (translators[lang] = tr);
}

// [{ voice, key, text, spoken }] for every voice. Duplicates are dropped.
function jobs() {
  const V = load('voice.json');
  const out = [];
  for (const v of V.voices) {
    const M = V.moves[v.lang];
    const seen = new Set();
    const add = (text, spoken) => {
      const key = voiceKey(text);
      if (!text || seen.has(key)) return;
      seen.add(key);
      out.push({ voice: v.id, engine: v.engine, lang: v.lang, speed: v.speed, key, text, spoken: spoken || text });
    };
    for (const t of Object.values(V.events[v.lang])) add(t);
    for (const t of fragments(M)) add(t, M.old && M.old.say && M.old.say[t]);   // say: how the speech engine should hear an old name
    // In another language a lesson line is said (and keyed) as the player reads it, translated.
    if (v.lessons) for (const t of lessonLines()) {
      if (v.lang === 'en') add(t, spokenEn(t, M));
      else { const s = translator(v.lang)(t); if (s) add(s, spokenEn(s, M)); }
    }
  }
  return out;
}

// Rooky's coach and mentor lines (packages/chess-core/src/mentor.js): the fixed pieces every coach
// line is cut into (speechVocab), plus the move words, all in Rooky's voice. The game says a line by
// playing its pieces back to back (speakCoach in audio.js). Recorded by tools/voice/record-coach.py.
function coachLines() {
  const core = path.join(__dirname, '..', '..', 'packages', 'chess-core', 'src');
  const E = require(path.join(core, 'engine.js'))();
  const C = require(path.join(core, 'coach.js'))(E);
  const ME = require(path.join(core, 'mentor.js'))(E, C);
  const M = load('voice.json').moves.en, out = [], seen = new Set();
  const add = (text, spoken) => {
    const key = voiceKey(text);
    if (seen.has(key)) return;
    seen.add(key);
    // a piece that starts with a comma or ends mid-sentence is said without the stray mark
    out.push({ key, text, spoken: (spoken || spokenEn(text, M)).replace(/^[\s,;:.\-]+/, '').trim() });
  };
  for (const t of ME.speechVocab()) add(t);
  for (const f of Object.keys(M.file)) add(M.file[f]);
  for (const t of fragments(M).filter((x) => !M.old || !Object.values(M.old.piece).concat(Object.values(M.old.promote)).includes(x))) add(t);
  return out.sort((a, b) => (a.key < b.key ? -1 : 1));
}

if (require.main === module) {
  const job = process.argv[2];
  process.stdout.write(JSON.stringify(job === 'words' ? wordLines() : job === 'coach' ? coachLines() : jobs()));
}
module.exports = { voiceKey, spokenEn, fragments, jobs, wordLines, coachLines, translator };
