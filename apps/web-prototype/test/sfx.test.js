// Piece sounds follow the material of the set and the board in play (catalog data.sound): every
// material named there has its recording, with four takes for each weight. There are no sound
// packs for a player to pick, buy or equip.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const dir = path.join(__dirname, '..', 'sfx');
const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '..', 'packages', 'content', 'catalog.json'), 'utf8'));
assert(!catalog.items.some((i) => i.category === 'sound') && !catalog.categories.some((c) => c.id === 'sound'), 'no sound packs in the catalog');
const looks = catalog.items.filter((i) => i.category === 'pieces' || i.category === 'board');
for (const i of looks) assert(i.data.sound, i.id + ' needs data.sound, the material it sounds like');
const packs = [...new Set(looks.map((i) => i.data.sound))];
assert(packs.length >= 6, 'materials in use: ' + packs);
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
console.log('sfx ok:', packs.length, 'materials,', Math.round(total / 1024), 'KB');
