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
// other languages' clips sit in a folder named for the language, checked below
const LANG_DIRS = Object.keys(require('../../../tools/voice/langs.json')).filter((k) => k !== 'note');
const shipped = fs.readdirSync(wdir).filter((d) => !d.includes('.') && !LANG_DIRS.includes(d)).flatMap((d) => fs.readdirSync(path.join(wdir, d)).map((f) => d + '/' + f.replace(/\.mp3$/, ''))).sort();
assert.deepStrictEqual(shipped, wlines.map((x) => x.who + '/' + x.key).sort(), 'one words clip per line, nothing extra');
// The coach library: every piece a coach line is cut into is recorded in Rooky's voice and in each
// voice marked "coach", with today's words, and each pack holds exactly those pieces in order.
const clines = lines.coachLines();
const crec = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../tools/voice/coach-recorded.json'), 'utf8'));
const cindex = JSON.parse(fs.readFileSync(path.join(__dirname, '../public/coach/index.json'), 'utf8'));
const coachVoices = [['rooky', G.speakers.rooky.engine, G.speakers.rooky.speed === undefined ? G.speed : G.speakers.rooky.speed]].concat(V.voices.filter((v) => v.coach).map((v) => [v.id, v.engine, v.speed === undefined ? 1 : v.speed]));
assert.deepStrictEqual(cindex.keys, clines.map((x) => x.key), 'the coach packs hold every piece, in order');
assert.deepStrictEqual(Object.keys(cindex.voices).sort(), coachVoices.map((v) => v[0]).sort(), 'one coach pack per coach voice');
for (const [id, engine, speed] of coachVoices) {
  for (const x of clines) {
    const r = crec[id + '/' + x.key];
    assert(r && r.voice === engine && r.speed === speed && r.text === x.text && r.spoken === x.spoken, id + ': coach piece "' + x.text + '" was recorded with other words or another voice: run tools/voice/record-coach.py');
  }
  assert.strictEqual(fs.statSync(path.join(__dirname, '../public/coach/' + id + '.mp3')).size, cindex.voices[id].sizes.reduce((a, b) => a + b, 0), id + ': the coach pack is whole');
}
// Rooky's own voice is the default coach.
assert(/voiceCoach: 'toby'/.test(fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8')), 'Toby is the default coach voice');
console.log('voice tests passed:', V.voices.length, 'voices,', Object.values(want).reduce((a, k) => a + k.length, 0), 'clips');

// Rooky and his friends in other languages (tools/voice/record-lang.py): every translated line the
// game and website say has its clip, recorded with today's words and voice, and nothing extra.
{
  const { execFileSync } = require('child_process');
  const LV = require('../../../tools/voice/langs.json');
  for (const lang of LANG_DIRS) {
    const J = JSON.parse(execFileSync('node', [path.join(__dirname, '../../../tools/voice/lang-lines.js'), lang], { maxBuffer: 1 << 26 }).toString());
    const dirs = { site: path.join(__dirname, '../../website/audio', lang) };
    for (const k of ['guide', 'pitch', 'tale', 'words']) dirs[k] = path.join(__dirname, '../public', k, lang);
    for (const [kind, dir] of Object.entries(dirs)) {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
      const idx = kind === 'site' ? raw.lines : raw;
      for (const j of J[kind]) {
        const voice = LV[lang].speakers[j.who].engine;
        const text = kind === 'site' ? j.cues.join(' ') : j.text;
        const got = idx[j.key] || {};
        assert.strictEqual(got.text, text, lang + ' ' + kind + ' ' + j.key + ' was recorded with other words: run tools/voice/record-lang.py');
        assert.strictEqual(got.voice, voice, lang + ' ' + kind + ' ' + j.key + ' was recorded in another voice: run tools/voice/record-lang.py');
        if (kind === 'site') assert.deepStrictEqual(got.cues.map((c) => c.text), j.cues, lang + ' site ' + j.key + ' captions');
        assert(fs.existsSync(path.join(dir, j.key + '.mp3')), lang + ' ' + kind + ' ' + j.key + '.mp3');
      }
      const walk = (d, pre) => fs.readdirSync(d).flatMap((f) => (fs.statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f), pre + f + '/') : f.endsWith('.mp3') ? [pre + f.slice(0, -4)] : []));
      assert.deepStrictEqual(walk(dir, '').sort(), J[kind].map((j) => j.key).sort(), lang + ' ' + kind + ': one clip per line, nothing extra');
    }
  }
}
