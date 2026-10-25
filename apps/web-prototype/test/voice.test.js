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
console.log('voice tests passed:', Object.values(want).reduce((a, k) => a + k.length, 0), 'clips');
