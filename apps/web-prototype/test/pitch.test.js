// Rooky's word on each Collection item: every item has a line, a chess set from an era uses the
// website's pitch (recorded once, heard in both places), and every clip matches its words.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const P = require('../../../packages/content/pitches.json');
const C = require('../../../packages/content/catalog.json');
const campaign = require('../../../packages/content/campaign.json');
const site = require('../../website/guide.json');
const siteSaid = require('../../website/audio/index.json');
const G = require('../../../packages/content/guide.json');

const dir = path.join(__dirname, '../public/pitch');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const ids = C.items.map((i) => i.id);

// One line per item, and none for items that are gone.
assert.deepStrictEqual(Object.keys(P.lines).sort(), ids.slice().sort(), 'pitches.json has a line for every Collection item, and nothing else');

// An era's chess set uses the website's pitch for that set, so it is recorded once.
for (const e of campaign.eras) {
  const it = C.items.find((i) => i.category === 'pieces' && i.data.set === e.set);
  assert(it, e.id + ' has a set in the catalog');
  assert.deepStrictEqual(P.lines[it.id], { site: 'item-sets-' + e.set }, it.id + ' uses the website pitch item-sets-' + e.set);
}
for (const [k, l] of Object.entries(P.lines)) {
  if (typeof l !== 'string') {
    assert(site.lines[l.site], k + ': the website has no line ' + l.site);
    assert(fs.existsSync(path.join(__dirname, '../../website/audio', l.site + '.mp3')), k + ': the website clip ' + l.site + ' is missing');
    assert.strictEqual(siteSaid.lines[l.site].text, site.lines[l.site].replace('{coach}', campaign.coach.name), k + ': the website clip is out of date');
    continue;
  }
  // warm and short, about the thing itself, never a price
  assert(!/₹|\$|\brupee|\bprice|\bbuy\b|\bcost/i.test(l), k + ' mentions money');
  const sentences = (l.match(/[.!?](\s|$)/g) || []).length;
  assert(sentences >= 1 && sentences <= (k.startsWith('pieces.') ? 3 : 2), k + ' is ' + sentences + ' sentences');
  for (const w of l.split(/[^A-Za-z']+/)) assert(w.length <= 13, k + ': ' + w);
}

// The shipped clips match the lines: one MP3 per own line, recorded with today's words in Rooky's voice.
const own = Object.keys(P.lines).filter((k) => typeof P.lines[k] === 'string').sort();
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4)).sort();
assert.deepStrictEqual(files, own, 'one clip per line, nothing extra (sets from an era use the website clip)');
const voice = G.speakers[P.who].engine;
for (const k of own) assert.deepStrictEqual(index[k], { voice, text: P.lines[k] }, k + ' was recorded with other words or another voice: run tools/voice/record-pitches.py');

// The pop-over asks for these clips by item id.
const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
assert(/AU\.pitch\(/.test(app), 'the Collection pop-over plays the pitches');
console.log('pitch tests passed:', own.length, 'own lines,', ids.length - own.length, 'from the website');
