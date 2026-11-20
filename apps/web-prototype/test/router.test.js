// Every screen's link opens that same screen again, links are English, lower case and unique,
// and the game picks the right way to write them (path on its own server, # everywhere else).
const assert = require('assert');
const path = require('path');
const RT = require('../src/router.js');
const content = (f) => require(path.join(__dirname, '../../../packages/content', f));

const LESSONS = content('lessons.json').lessons;
const TRAINERS = content('trainers.json').trainers;
const CAMPAIGN = content('campaign.json');
const VARIANTS = content('variants.json').variants || content('variants.json');
const OPENINGS = content('openings.json').openings;
const PUZZLES = content('puzzles.json').puzzles || content('puzzles.json');
const CATS = ['pieces', 'board', 'room', 'avatar', 'frame', 'capture', 'victory', 'trail', 'clock'];
const SETTINGS = ['play', 'coach', 'sound', 'look', 'lang', 'app'];
const THEMES = [...new Set(['fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece', 'mate'].concat(...PUZZLES.map((p) => p.themes)))];
const E = require('../../../packages/chess-core/src/engine.js');
const MINI = require('../src/minigames.js')(E, { puzzles: PUZZLES, lessons: LESSONS, eras: CAMPAIGN.eras });
const ready = VARIANTS.filter((v) => v.status === 'ready').map((v) => v.id);
const R = RT.routes({
  lessons: LESSONS, trainers: TRAINERS.map((x) => x.id), eras: CAMPAIGN.eras.map((e) => e.id), variants: ready, openings: OPENINGS,
  minis: MINI.GAMES.map((g) => g.id), opponents: CAMPAIGN.opponents.map((o, i) => ({ name: o.name, level: o.level != null ? o.level : i })),
  cats: CATS, themes: THEMES, settings: SETTINGS, profile: ['games', 'account'],
});

let n = 0;
const seen = new Map();
function round(name, arg, want, check) {
  const p = R.toPath(name, arg);
  assert.match(p, /^\/[a-z0-9/-]*$/, name + ' gives a clean lower-case link: ' + p);
  const r = R.fromPath(p);
  assert.ok(r, p + ' opens something');
  assert.strictEqual(r.name, want || name, p + ' opens ' + (want || name) + ', not ' + r.name);
  if (check) check(r, p);
  else assert.deepStrictEqual(r.arg, arg, p + ' keeps its ' + JSON.stringify(arg));
  const key = p, before = seen.get(key);
  if (before) assert.strictEqual(before, JSON.stringify([r.name, r.arg, r.spec]), p + ' is one screen only');
  seen.set(key, JSON.stringify([r.name, r.arg, r.spec]));
  n++;
  return p;
}

// main menus
for (const k of ['home', 'play', 'journey', 'learn', 'trainers', 'puzzles', 'training', 'collection', 'club', 'profile', 'season', 'store'])
  assert.strictEqual(round(k, undefined), '/' + k);
// Play's screens and menus
round('minis', undefined); round('variants', undefined); round('game', undefined); round('review', undefined, null, () => {});
for (const id of MINI.GAMES.map((g) => g.id)) round('mini', { id });
for (const id of ready) round('variant', id);
round('xiangqi', undefined); round('xqlesson', undefined);
for (const id of ready.filter((v) => v !== 'xiangqi')) round('lesson', { variant: id });
for (const k of ['friend', 'world', 'custom']) { const r = R.fromPath(R.modalPath(k)); assert.deepStrictEqual([r.name, r.modal.kind], ['play', k]); n++; }
for (const o of CAMPAIGN.opponents) { const p = R.modalPath('opponent', o.level); assert.match(p, /^\/play\/opponents\/[a-z]+$/); assert.strictEqual(R.fromPath(p).modal.arg, o.level); n++; }
assert.deepStrictEqual(R.fromPath('/play/quick'), { action: 'quick' });
// Journey
for (const e of CAMPAIGN.eras) {
  round('era', e.id);
  e.stages.forEach((s, k) => { if (s.kind === 'lesson') round('lesson', { journey: { era: e.id, stage: k } }, 'era', (r) => assert.deepStrictEqual([r.arg, r.spec], [e.id, { stage: k }])); });
}
// Learn, trainers, puzzles, training
for (const l of LESSONS) {
  if (!R.toPath('lesson', l.id).startsWith('/learn/')) throw new Error('lesson ' + l.id + ' has no link');
  round('lesson', l.id);
}
round('lesson', { placement: true, from: 'learn' });
// a lesson in parts: every part has its own page
for (const l of LESSONS.filter((x) => x.parts)) for (const part of l.parts) { if (R.toPath('lesson', { id: l.id, part }) !== '/learn/' + RT.slug(RT.tail(l.id)) + '/' + part) throw new Error(l.id + ' part ' + part + ' has no link'); round('lesson', { id: l.id, part }); }
if (!LESSONS.some((x) => x.parts)) throw new Error('the three phases lesson is missing');
for (const tr of TRAINERS) round('lesson', { trainer: tr.id });
for (const tr of TRAINERS) { const l = LESSONS.find((x) => RT.tail(x.id) === tr.id); if (l) round('lesson', { id: l.id, back: 'trainers' }); }
round('puzzle', { daily: true, list: [], title: 'x' }, null, (r) => assert.deepStrictEqual(r.spec, { daily: true }));
round('puzzle', { rated: true, title: 'x' }, null, (r) => assert.deepStrictEqual(r.spec, { rated: true }));
for (const m of [1, 2, 3, 4, 5]) round('puzzle', { mate: m, title: 'x' }, null, (r) => assert.deepStrictEqual(r.spec, { mate: m }));
for (const th of THEMES) round('puzzle', { theme: th, rated: true, title: 'x' }, null, (r) => assert.deepStrictEqual(r.spec, { theme: th }));
for (const d of [7, 0]) round('progress', d);
assert.strictEqual(R.fromPath('/training/progress').arg, undefined);
round('dojo', undefined);
round('openings', 'black');
assert.deepStrictEqual(R.fromPath(R.toPath('openings', 'white')), { name: 'openings', arg: 'white' });
for (const o of OPENINGS) round('drill', o.id);
// Collection, profile, shop, settings
for (const c of CATS) round('collection', c);
for (const s of ['games', 'account']) round('profile', s);
round('store', 'coins');
round('store', 'pass.season-1');
for (const s of SETTINGS) {
  const p = R.modalPath('settings', s), r = R.fromPath(p);
  assert.ok(r && r.over && r.modal.kind === 'settings' && r.modal.arg === s, p);
  n++;
}
assert.strictEqual(R.modalPath('settings', 'lang'), '/settings/language');

// Unknown or broken links open nothing (the game shows Home), and odd typing still works.
for (const bad of ['/nowhere', '/learn/no-such-lesson', '/journey/atlantis', '/play/variations/nope', '/collection/hats', '/learn/board/extra', '/puzzles/mate-in-9', '/settings/x'])
  assert.strictEqual(R.fromPath(bad), null, bad);
assert.strictEqual(R.fromPath('/Learn/').name, 'learn');
assert.strictEqual(R.fromPath('/learn?x=1').name, 'learn');
assert.strictEqual(R.fromPath('').name, 'home');

// Every top word is one the server sends the game for.
for (const p of seen.keys()) assert.ok(RT.TOP.includes(p.split('/')[1]), p);

// Which way to write links
const win = (href, framed) => { const u = new URL(href); const w = { location: u }; w.self = w; w.top = framed ? {} : w; return w; };
assert.strictEqual(RT.mode(win('https://chackmate.example/learn/forks')), 'path');
assert.strictEqual(RT.mode(win('https://chackmate.example/play')), 'path');
assert.strictEqual(RT.mode(win('https://chackmate.example/learn', true)), 'hash', 'a frame (the claude.ai preview) uses #');
assert.strictEqual(RT.mode(win('file:///tmp/chackmate.html')), 'hash');
assert.strictEqual(RT.mode(win('http://localhost:8000/apps/web-prototype/dist/chackmate.html')), 'hash');
assert.strictEqual(RT.current(win('https://x.example/a.html#/learn/forks'), 'hash'), '/learn/forks');
assert.strictEqual(RT.current(win('https://x.example/a.html#daily'), 'hash'), '');

console.log('router: ' + n + ' screen links open their own screen');
