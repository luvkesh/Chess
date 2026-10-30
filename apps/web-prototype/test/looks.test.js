// Every look the catalog and the Journey hand out must exist in the 3D code: piece sets in
// pieces3d.js, boards and rooms in world3d.js. A missing id would quietly fall back to the
// default, so a prize would look like something the player already has.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const catalog = require('../../../packages/content/catalog.json');
const campaign = require('../../../packages/content/campaign.json');

const src = (f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
// The keys of an object literal `const NAME = { ... };`, at its first level of nesting.
function keysOf(text, name) {
  const start = text.indexOf('const ' + name + ' = {');
  assert.ok(start >= 0, name + ' not found');
  const end = text.indexOf('\n  };', start);
  const body = text.slice(start, end);
  return new Set([...body.matchAll(/^ {4}'?([a-z][\w-]*)'?: \{/gm)].map((m) => m[1]));
}
const pieces = src('pieces3d.js'), world = src('world3d.js');
const SETS = new Set([...keysOf(pieces, 'SETS'), ...keysOf(pieces, 'COLOURWAYS')]);
const BOARDS = keysOf(world, 'BOARDS'), ROOMS = keysOf(world, 'ROOMS');
assert.ok(SETS.has('regency') && BOARDS.has('walnut') && ROOMS.has('salon'), 'defaults present');

const field = { pieces: ['set', SETS], board: ['board', BOARDS], room: ['room', ROOMS] };
let n = 0;
for (const it of catalog.items) {
  const f = field[it.category];
  if (!f) continue;
  assert.ok(f[1].has(it.data[f[0]]), it.id + ': no ' + it.category + ' called ' + it.data[f[0]]);
  n++;
}
// Every capture effect but None plays its own capture scene, 3 to 5 seconds long.
const scene = src('scene.js'), SCENES = keysOf(scene, 'SCENES'), used = new Set();
for (const it of catalog.items.filter((x) => x.category === 'capture' && x.data.kind !== 'none')) {
  assert.ok(SCENES.has(it.data.scene), it.id + ': no capture scene called ' + it.data.scene);
  assert.ok(!used.has(it.data.scene), it.id + ': scene ' + it.data.scene + ' is already used');
  used.add(it.data.scene);
}
for (const m of scene.slice(scene.indexOf('const SCENES = {')).matchAll(/^ {4}([a-z]+): \{ dur: (\d+)/gm)) {
  assert.ok(+m[2] >= 3000 && +m[2] <= 5000, 'scene ' + m[1] + ' lasts ' + m[2] + ' ms');
}
for (const e of campaign.eras) {
  assert.ok(SETS.has(e.set), e.id + ' set ' + e.set);
  assert.ok(BOARDS.has(e.board), e.id + ' board ' + e.board);
  assert.ok(ROOMS.has(e.room), e.id + ' room ' + e.room);
}
// No two sets share models: every set names its own pieces module, its knight its own horse,
// and its king its own cross.
const uniq = (list, what) => { const seen = new Set(); for (const x of list) { assert.ok(!seen.has(x), what + ' used twice: ' + x); seen.add(x); } return list.length; };
uniq([...pieces.matchAll(/\bpieces: ([A-Z]+),/g)].map((m) => m[1]), 'pieces module');
uniq([...pieces.matchAll(/horse\(\{ base: [\d.]+, (mane: '\w+', seed: \d+(?:, form: \{[^}]*\})?)/g)].map((m) => m[1].replace(/seed: \d+, /, '')), 'horse');
uniq([...pieces.matchAll(/crossOf\('(\w+)', [\d.]+, [\d.]+\), 0, 0,/g)].map((m) => m[1]), 'king cross');
// Era rooms paint their landmark outside the windows.
const painters = new Set([...world.slice(world.indexOf('const LAND = {'), world.indexOf('\n  };', world.indexOf('const LAND = {'))).matchAll(/^ {4}([a-z]+): \{/gm)].map((m) => m[1]));
for (const m of world.matchAll(/landmark: '([a-z]+)'/g)) assert.ok(painters.has(m[1]), 'no painter for ' + m[1]);
// Room floors are parquet (the default), marble octagons, stone flags or planks. A chequered
// floor around the table would read as a second chessboard.
for (const m of world.matchAll(/\bfloor: '([a-z]+)'/g)) assert.ok(['parquet', 'octagon', 'stone', 'planks'].includes(m[1]), 'unknown or chequered floor: ' + m[1]);
// Every room has its element: a capture strike and a win storm that elements3d.js can play,
// a strike of about 3 s and a storm of about 10 s.
const EL = require('../src/elements3d.js'), elements = src('elements3d.js');
for (const id of ROOMS) {
  const e = EL.ROOMS[id];
  assert.ok(e, 'room ' + id + ' has no element');
  assert.ok(['fire', 'lightning', 'stone'].includes(e.strike), id + ': unknown capture strike ' + e.strike);
  assert.ok(['petals', 'fire', 'lightning'].includes(e.storm), id + ': unknown win storm ' + e.storm);
}
for (const k of Object.keys(EL.ROOMS)) assert.ok(ROOMS.has(k), 'element for a room that does not exist: ' + k);
for (const [name, ms] of [['STRIKES', 3000], ['STORMS', 10000]]) {
  const body = elements.slice(elements.indexOf('const ' + name + ' = {'));
  const durs = [...body.slice(0, body.indexOf('\n  };')).matchAll(/^ {4}([a-z]+): \{ dur: (\d+)/gm)];
  assert.strictEqual(durs.length, 3, name + ' has three effects');
  for (const m of durs) assert.strictEqual(+m[2], ms, name + ' ' + m[1] + ' lasts ' + m[2] + ' ms');
}
console.log('looks ok:', n, 'catalog looks,', SETS.size, 'sets,', BOARDS.size, 'boards,', ROOMS.size, 'rooms');
