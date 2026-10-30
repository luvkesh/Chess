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
const frag = { en: new Set(lines.fragments(V.moves.en)), hi: new Set(lines.fragments(V.moves.hi)) };
for (const san of ['Nf3', 'exd5', 'Qxh7#', 'O-O', 'a8=N+', 'Kxg2', 'Bb5+']) {
  for (const lang of ['en', 'hi']) for (const w of AU.moveWords(san, lang)) assert(frag[lang].has(w), lang + ' ' + san + ': ' + w);
}

// Every voice says every game call, in both languages.
const keys = Object.keys(V.events.en);
assert.deepStrictEqual(Object.keys(V.events.hi).sort(), keys.slice().sort());
for (const v of V.voices) assert(V.events[v.lang] && V.moves[v.lang], v.id);

// Chess notation is read out for the speech engine but the key stays on the shown text.
assert.strictEqual(lines.spokenEn('Play Nf3, then Qxf7#.', V.moves.en), 'Play Knight eff three, then Queen takes eff seven checkmate.');
assert.strictEqual(lines.spokenEn('The e-file and h8.', V.moves.en), 'The ee file and aitch eight.');

// The shipped packs match the script: one pack per voice holding every line it says, nothing missing,
// nothing extra, and the clip sizes add up to the pack.
const dir = path.join(__dirname, '../public/voice');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const want = {};
for (const j of lines.jobs()) (want[j.voice] = want[j.voice] || []).push(j.key);
for (const v of V.voices) {
  const entry = index.voices[v.id];
  assert(entry, v.id + ' has a pack');
  assert.deepStrictEqual(index.keys[v.lang], want[v.id].slice().sort(), v.id + ' index matches the script');
  assert.strictEqual(entry.sizes.length, index.keys[v.lang].length, v.id + ' has a size for every clip');
  assert(entry.sizes.every((n) => n > 0), v.id + ' has no empty clips');
  const size = fs.statSync(path.join(dir, v.id + '.mp3')).size;
  assert.strictEqual(entry.sizes.reduce((a, n) => a + n, 0), size, v.id + ' clip sizes add up to the pack');
}
assert.deepStrictEqual(Object.keys(index.voices).sort(), V.voices.map((v) => v.id).sort(), 'no packs for voices that are gone');
assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['index.json'].concat(V.voices.map((v) => v.id + '.mp3')).sort(), 'nothing else in the voice folder');

// Voices in the settings list carry what the picker groups them by, and mixed voices have names of their own.
const names = new Set();
for (const v of V.voices) {
  assert(!names.has(v.name), 'voice names are unique: ' + v.name);
  names.add(v.name);
  if (v.lang === 'en') assert(['US', 'UK'].includes(v.accent) && ['F', 'M'].includes(v.gender), v.id + ' has an accent and gender');
}
console.log('voice tests passed:', V.voices.length, 'voices,', Object.values(want).reduce((a, k) => a + k.length, 0), 'clips');
