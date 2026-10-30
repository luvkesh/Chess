// The era stories: every page, question and answer is read by that era's friend from a recorded clip,
// recorded with today's words and voice, so the story never falls back to the device's voice.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../../../packages/content/guide.json');
const C = require('../../../packages/content/campaign.json');
const { voiceKey } = require('../../../tools/voice/lines.js');

const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const dir = path.join(__dirname, '../public/tale');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

// The story card speaks only through AU.tale, never the coach's voice.
const tale = app.slice(app.indexOf('function taleModal'), app.indexOf('function', app.indexOf('function taleModal') + 20));
assert(tale.includes('AU.tale('), 'the story card is read by the era friend');
assert(!tale.includes('AU.say('), 'the story card does not use the coach voice');

const want = new Set();
for (const e of C.eras) {
  for (const s of e.stages.filter((x) => x.kind === 'tale')) {
    for (const text of s.pages.concat([s.quiz.q, s.quiz.explain])) {
      const k = e.id + '/' + voiceKey(text);
      want.add(k);
      assert(fs.existsSync(path.join(dir, k + '.mp3')), k + ' (' + text.slice(0, 40) + '…) has no clip: run tools/voice/record-tales.py');
      assert.deepStrictEqual(index[k], { who: e.coach.id, voice: G.speakers[e.coach.id].engine, text }, k + ' was recorded with other words or another voice: run tools/voice/record-tales.py');
    }
  }
}
const files = fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory())
  .flatMap((d) => fs.readdirSync(path.join(dir, d)).filter((f) => f.endsWith('.mp3')).map((f) => d + '/' + f.slice(0, -4)));
assert.deepStrictEqual(files.sort(), [...want].sort(), 'one clip per story line, nothing extra');
console.log('tale tests passed:', want.size, 'lines');
