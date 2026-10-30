// The audio guide: every screen and every era stage has a line, every line has a speaker with a
// voice, and every recorded clip matches the words and voice it was recorded with.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const G = require('../../../packages/content/guide.json');
const C = require('../../../packages/content/campaign.json');
const VR = require('../../../packages/content/variants.json');

const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const dir = path.join(__dirname, '../public/guide');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));

// Rooky and every era's friend have a voice.
assert(G.speakers.rooky, 'Rooky has a voice');
for (const e of C.eras) assert(G.speakers[e.coach.id], e.coach.full + ' has a voice');

// Every era stage, and the finished era, has a line said by that era's friend.
for (const e of C.eras) {
  for (const k of e.stages.map((s) => s.kind).concat('done')) {
    const line = G.lines['era.' + e.id + '.' + k];
    assert(line, 'era.' + e.id + '.' + k);
    assert.strictEqual(line.who, e.coach.id, 'era.' + e.id + '.' + k + ' is said by ' + e.coach.name);
  }
}

// Every lesson step and exercise of a variation is a line said by Rooky.
const variantLines = new Set();
for (const v of VR.variants) for (const x of v.lesson ? v.lesson.steps.concat(v.lesson.exercises) : []) {
  assert(G.lines[x.line], v.id + ' lesson line ' + x.line);
  assert.strictEqual(G.lines[x.line].who, 'rooky', x.line + ' is said by Rooky');
  variantLines.add(x.line);
}

// Every line the game asks for exists, and every line is used.
const asked = new Set([...app.matchAll(/guide(?:Say|Idle|Fresh)\('([a-z.]+)'/g)].map((m) => m[1]));
for (const k of asked) assert(G.lines[k], 'guide.json has ' + k);
// keys chosen in code, such as 'lesson.ex' or 'game.black'
for (const k of Object.keys(G.lines)) if (app.includes("'" + k + "'")) asked.add(k);
// The placement test: Rooky reads every question word for word, and says the result of each band.
const PL = require('../../../packages/content/placement.json');
for (const q of PL.questions) {
  const line = G.lines['placement.' + q.id];
  assert(line && line.who === 'rooky' && line.text === q.prompt, 'placement.' + q.id + ' is Rooky reading the question');
  asked.add('placement.' + q.id);
}
for (const b of PL.bands) { assert(G.lines[b.say] && G.lines[b.say].who === 'rooky', b.say); asked.add(b.say); }
const menus = [...app.matchAll(/SCREENS\.([a-z]+) = function/g)].map((m) => m[1]).filter((n) => !['era', 'lesson', 'puzzle', 'game', 'drill', 'home', 'xiangqi', 'xqlesson'].includes(n));
for (const n of menus) assert(G.lines[n], 'the ' + n + ' screen has a line');
for (const k of Object.keys(G.lines)) {
  const used = asked.has(k) || k.startsWith('era.') || variantLines.has(k) || menus.includes(k) || k === 'home';
  assert(used, k + ' is never said');
}

// Lines stay short and simple for children: at most three sentences, and no word over 13 letters.
for (const [k, l] of Object.entries(G.lines)) {
  assert(G.speakers[l.who], k + ': unknown speaker ' + l.who);
  assert((l.text.match(/[.!?](\s|$)/g) || []).length <= 3, k + ' is too long');
  for (const w of l.text.split(/[^A-Za-z']+/)) assert(w.length <= 13, k + ': ' + w);
}

// The shipped clips match the script: one MP3 per line, recorded with today's words and voice.
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
assert.deepStrictEqual(files, Object.keys(G.lines).sort(), 'one clip per line, nothing extra');
for (const [k, l] of Object.entries(G.lines)) {
  assert.deepStrictEqual(index[k], { who: l.who, voice: G.speakers[l.who].engine, text: l.text }, k + ' was recorded with other words or another voice: run tools/voice/record-guide.py');
}
console.log('guide tests passed:', Object.keys(G.lines).length, 'lines');
