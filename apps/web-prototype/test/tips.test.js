// Every tooltip comes from packages/content/i18n/tips.json: each key the game asks for exists,
// and every settings tip is one short sentence (under 20 words) for children and parents.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tips = require('../../../packages/content/i18n/tips.json');
const app = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
const voices = require('../../../packages/content/voice.json').voices;

for (const [k, v] of Object.entries(tips)) assert(v.en && v.en.trim(), k + ' has no English text');

const used = new Set();
for (const m of app.matchAll(/data-tk="([\w.]+)"/g)) used.add(m[1]);
for (const m of app.matchAll(/tip\('([\w.]+)'[,)]/g)) used.add(m[1]);
for (const k of used) assert(tips[k], 'missing tip ' + k);
// Tips for buttons are keyed by the button's id, which must still exist.
for (const k of Object.keys(tips).filter((x) => x.startsWith('control.'))) assert(app.includes('id="' + k.slice(8) + '"'), 'no button ' + k);

// Every option inside a settings menu has its own tip.
for (const v of ['off', 'quiet', 'normal', 'chatty']) assert(tips['settings.coach.' + v], 'coaching level ' + v);
for (const v of voices.map((x) => x.id).concat(['device', 'off'])) assert(tips['voice.' + v], 'voice ' + v);
for (const v of ['high', 'low']) assert(tips['settings.quality.' + v], 'graphics ' + v);

for (const [k, v] of Object.entries(tips)) {
  if (!/^(settings|voice)\./.test(k)) continue;
  const words = v.en.split('|').pop().trim().split(/\s+/).length;
  assert(words < 20, k + ' has ' + words + ' words');
}
console.log('tips ok: ' + Object.keys(tips).length + ' strings, ' + used.size + ' used by name');
