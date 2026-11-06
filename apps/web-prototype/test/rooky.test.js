// Rooky's lines in every English coach voice (tools/voice/record-rooky.py): every voice a player can
// pick other than Rooky's own has a clip for every one of his lines, recorded with today's words.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { voiceKey } = require('../../../tools/voice/lines.js');
const G = require('../../../packages/content/guide.json');
const P = require('../../../packages/content/pitches.json');
const V = require('../../../packages/content/voice.json');

const dir = path.join(__dirname, '../public/rooky');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const words = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/words/index.json'), 'utf8'));

const texts = Object.values(G.lines).filter((l) => l.who === 'rooky').map((l) => l.text)
  .concat(Object.values(P.lines).filter((l) => typeof l === 'string'))
  .concat(Object.entries(words).filter(([k]) => k.startsWith('rooky/')).map(([, v]) => v.text));
const want = {};
for (const t of texts) want[voiceKey(t)] = t;
assert.deepStrictEqual(index.lines, Object.fromEntries(Object.entries(want).sort()), 'rooky/index.json holds every line of Rooky\'s, with today\'s words: run tools/voice/record-rooky.py');

const rookyEngine = G.speakers.rooky.engine;
const voices = V.voices.filter((v) => v.lang === 'en' && v.engine !== rookyEngine);
assert.deepStrictEqual(Object.keys(index.voices).sort(), voices.map((v) => v.id).sort(), 'every English coach voice but Rooky\'s own is recorded');
let n = 0;
for (const v of voices) {
  assert.strictEqual(index.voices[v.id], v.engine, v.id + ' was recorded with another engine');
  for (const k of Object.keys(want)) { assert(fs.existsSync(path.join(dir, v.id, k + '.mp3')), v.id + '/' + k + '.mp3 is missing'); n++; }
}
console.log('rooky ok: ' + Object.keys(want).length + ' lines in ' + voices.length + ' voices, ' + n + ' clips');
