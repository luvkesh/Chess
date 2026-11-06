// The piece sound packs: every pack in the catalog has its recording, with four takes for each weight.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..', 'sfx');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'content', 'catalog.json'), 'utf8'));
const packs = catalog.items.filter((i) => i.category === 'sound').map((i) => i.data.pack);
assert(packs.length >= 4, 'sound packs in the catalog');
let total = 0;
for (const p of packs) {
  assert(index[p], 'no recording for the ' + p + ' pack');
  const file = path.join(dir, p + '.mp3');
  const size = fs.statSync(file).size;
  assert(size < 60000, p + '.mp3 is too big: ' + size);
  total += size;
  let end = 0;
  for (const tier of ['L1', 'L2', 'L3']) {
    const takes = index[p][tier];
    assert(takes && takes.length === 4, p + ' ' + tier + ' needs four takes');
    for (const [at, len] of takes) {
      assert(at >= end, p + ' ' + tier + ' takes overlap');
      assert(len >= 80 && len <= 700, p + ' ' + tier + ' take length ' + len);
      end = at + len;
    }
  }
}
assert(fs.readFileSync(path.join(dir, 'SOURCES.md'), 'utf8').includes('CC0'), 'sources must be listed with their licence');
console.log('sfx ok:', packs.length, 'packs,', Math.round(total / 1024), 'KB');
