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
  const keys = new Set([...body.matchAll(/^ {4}'?([a-z][\w-]*)'?: \{/gm)].map((m) => m[1]));
  // Later additions: `Object.assign(NAME, { ... });`
  for (let i = text.indexOf('Object.assign(' + name + ', {'); i >= 0; i = text.indexOf('Object.assign(' + name + ', {', i + 1)) {
    const more = text.slice(i, text.indexOf('\n  });', i));
    for (const m of more.matchAll(/^ {4}'?([a-z][\w-]*)'?: \{/gm)) keys.add(m[1]);
  }
  return keys;
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
// Captures play one of five sequences by the piece taken: the queen's (4 s), two for a rook,
// bishop or knight (2 s each) and two for a pawn (1 s each), and every one has its moment of impact.
const scene = src('scene.js'), SCENES = keysOf(scene, 'SCENES');
const durs = Object.fromEntries([...scene.slice(scene.indexOf('const SCENES = {')).matchAll(/^ {4}([a-z]+): \{ dur: (\d+), impact: (\d+)/gm)].map((m) => [m[1], [+m[2], +m[3]]]));
const want = { queen: 4000, clash: 2000, vault: 2000, flick: 1000, pop: 1000 };
assert.deepStrictEqual([...SCENES].sort(), Object.keys(want).sort(), 'the five capture sequences');
for (const [k, ms] of Object.entries(want)) { assert.strictEqual(durs[k][0], ms, k + ' lasts ' + durs[k][0] + ' ms'); assert.ok(durs[k][1] > 0 && durs[k][1] < ms / 2, k + ': the hit comes in the first half'); }
assert.ok(/LEVEL = \{ 1: 3, 2: 2, 3: 2, 4: 2, 5: 1 \}/.test(scene) && /SEQUENCES = \{ 1: \['queen'\], 2: \['clash', 'vault'\], 3: \['flick', 'pop'\] \}/.test(scene), 'queen level 1, rook/bishop/knight level 2, pawn level 3');
// Capture and victory effects with an element name one elements3d.js can play, and every
// element has both a capture effect and a victory effect, so captures and wins match.
const FAMILIES = ['fire', 'lightning', 'petals', 'stone'];
for (const f of FAMILIES) {
  assert.ok(catalog.items.some((i) => i.category === 'capture' && i.data.strike === f), 'no capture effect for ' + f);
  assert.ok(catalog.items.some((i) => i.category === 'victory' && i.data.storm === f), 'no victory effect for ' + f);
}
for (const i of catalog.items) {
  if (i.data && i.data.strike) assert.ok(FAMILIES.includes(i.data.strike), i.id + ': unknown strike');
  if (i.data && i.data.storm) assert.ok(FAMILIES.includes(i.data.storm), i.id + ': unknown storm');
}
// Every trail has its own style, one scene.js draws.
const STYLES = [...scene.slice(scene.indexOf('function trailParticle')).slice(0, 4000).matchAll(/case '([a-z]+)':/g)].map((m) => m[1]).concat('dust');
const styles = catalog.items.filter((i) => i.category === 'trail' && i.data).map((i) => i.data.style);
for (const st of styles) assert.ok(STYLES.includes(st), 'no trail style ' + st);
assert.strictEqual(new Set(styles).size, styles.length, 'two trails share a style');
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
  assert.ok(['fire', 'lightning', 'stone', 'petals'].includes(e.strike), id + ': unknown capture strike ' + e.strike);
  assert.ok(['petals', 'fire', 'lightning'].includes(e.storm), id + ': unknown win storm ' + e.storm);
}
for (const k of Object.keys(EL.ROOMS)) assert.ok(ROOMS.has(k), 'element for a room that does not exist: ' + k);
for (const [name, ms] of [['STRIKES', 3000], ['STORMS', 10000]]) {
  const body = elements.slice(elements.indexOf('const ' + name + ' = {'));
  const durs = [...body.slice(0, body.indexOf('\n  };')).matchAll(/^ {4}([a-z]+): \{ dur: (\d+)/gm), ...elements.matchAll(new RegExp('^  ' + name + '\\.([a-z]+) = \\{ dur: (\\d+)', 'gm'))];
  assert.deepStrictEqual(durs.map((m) => m[1]).sort(), FAMILIES.slice().sort(), name + ' has one effect per family');
  for (const m of durs) assert.strictEqual(+m[2], ms, name + ' ' + m[1] + ' lasts ' + m[2] + ' ms');
}
console.log('looks ok:', n, 'catalog looks,', SETS.size, 'sets,', BOARDS.size, 'boards,', ROOMS.size, 'rooms');
