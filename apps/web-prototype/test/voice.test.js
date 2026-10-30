// Recorded voices: the game must look clips up by the same key the recording tool saved them under,
// read moves as the right words, and every recorded voice must cover every line it is meant to say.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const lines = require('../../../tools/voice/lines.js');
const V = require('../../../packages/content/voice.json');

const sandbox = { window: {}, location: { protocol: 'file:' }, CHACKLATE_VOICE: V, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/audio.js'), 'utf8') + '\nthis.AU = ChacklateAudio();', sandbox);
const AU = sandbox.AU;

// Same key in the game and in the recording tool, including Hindi (Devanagari) text.
for (const t of ['Check.', 'शह और मात! आप जीत गए।', 'Click the e4 square.', '']) assert.strictEqual(AU.voiceKey(t), lines.voiceKey(t), t);
assert.notStrictEqual(lines.voiceKey('Check.'), lines.voiceKey('Check!'));

// Moves are read as recorded fragments.
assert.deepStrictEqual([...AU.moveWords('Nxe5+', 'en')], ['Knight', 'takes', 'ee five', 'check']);
assert.deepStrictEqual([...AU.moveWords('e8=Q#', 'en')], ['Pawn', 'ee eight', 'promotes to a queen', 'checkmate']);
assert.deepStrictEqual([...AU.moveWords('O-O-O', 'en')], ['Castles queenside']);
assert.deepStrictEqual([...AU.moveWords('Rad1', 'hi')], ['हाथी', 'डी एक']);
// Chaturanga keeps the old names: the Q code is the Mantri, the B code the Gaja.
assert.deepStrictEqual([...AU.moveWords('Qxe5+', 'en', true)], ['Mantri', 'takes', 'ee five', 'check']);
assert.deepStrictEqual([...AU.moveWords('e8=Q', 'en', true)], ['Padati', 'ee eight', 'becomes a Mantri']);
assert.deepStrictEqual([...AU.moveWords('Bd4', 'hi', true)], ['गज', 'डी चार']);
const frag = { en: new Set(lines.fragments(V.moves.en)), hi: new Set(lines.fragments(V.moves.hi)) };
for (const san of ['Nf3', 'exd5', 'Qxh7#', 'O-O', 'a8=N+', 'Kxg2', 'Bb5+']) {
  for (const lang of ['en', 'hi']) for (const old of [false, true]) for (const w of AU.moveWords(san, lang, old)) assert(frag[lang].has(w), lang + ' ' + san + ': ' + w);
}

// Every voice says every game call, in both languages.
const keys = Object.keys(V.events.en);
assert.deepStrictEqual(Object.keys(V.events.hi).sort(), keys.slice().sort());
for (const v of V.voices) assert(V.events[v.lang] && V.moves[v.lang], v.id);

// Chess notation is read out for the speech engine but the key stays on the shown text.
assert.strictEqual(lines.spokenEn('Play Nf3, then Qxf7#.', V.moves.en), 'Play Knight eff three, then Queen takes eff seven checkmate.');
assert.strictEqual(lines.spokenEn('The e-file and h8.', V.moves.en), 'The ee file and aitch eight.');

// The shipped clips match the script: one MP3 per line per voice, nothing missing, nothing extra.
const dir = path.join(__dirname, '../public/voice');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const want = {};
for (const j of lines.jobs()) (want[j.voice] = want[j.voice] || []).push(j.key);
for (const v of V.voices) {
  assert.deepStrictEqual(index.voices[v.id].slice().sort(), want[v.id].slice().sort(), v.id + ' index matches the script');
  const files = fs.readdirSync(path.join(dir, v.id)).map((f) => f.replace(/\.mp3$/, '')).sort();
  assert.deepStrictEqual(files, want[v.id].slice().sort(), v.id + ' clips match the script');
}
// Lessons with their own speakers (Words at the table): Rooky says every English line, Priya every
// Hindi word, each recorded with today's words and voice, and nothing extra is shipped.
const G = require('../../../packages/content/guide.json');
const L = require('../../../packages/content/lessons.json');
const engine = { rooky: G.speakers.rooky.engine, priya: V.voices.find((v) => v.id === 'priya').engine };
const wdir = path.join(__dirname, '../public/words');
const windex = JSON.parse(fs.readFileSync(path.join(wdir, 'index.json'), 'utf8'));
const wlines = lines.wordLines();
const own = L.lessons.filter((l) => l.voice);
assert(own.length, 'a lesson has its own speakers');
for (const l of own) {
  assert.strictEqual(l.voice, 'rooky', l.id + ' is said by Rooky');
  const words = l.steps.filter((s) => s.word);
  assert(words.length && l.steps[l.steps.length - 1].glossary, l.id + ' ends with a page listing every word');
  for (const s of words) assert(s.word.en && s.word.hi && s.word.latin && /[\u0900-\u097f]/.test(s.word.hi), l.id + ': ' + s.word.en + ' has its Hindi');
  for (const s of l.steps) assert(wlines.some((x) => x.text === s.say && x.who === 'rooky'), l.id + ': ' + s.say);
}
for (const x of wlines) {
  const name = x.who + '/' + x.key;
  assert.deepStrictEqual(windex[name], { voice: engine[x.who], text: x.text }, name + ' "' + x.text + '" was recorded with other words or another voice: run tools/voice/record-words.py');
  assert(fs.existsSync(path.join(wdir, name + '.mp3')), name + '.mp3');
}
const shipped = fs.readdirSync(wdir).filter((d) => !d.includes('.')).flatMap((d) => fs.readdirSync(path.join(wdir, d)).map((f) => d + '/' + f.replace(/\.mp3$/, ''))).sort();
assert.deepStrictEqual(shipped, wlines.map((x) => x.who + '/' + x.key).sort(), 'one words clip per line, nothing extra');
console.log('voice tests passed:', Object.values(want).reduce((a, k) => a + k.length, 0), 'clips');
