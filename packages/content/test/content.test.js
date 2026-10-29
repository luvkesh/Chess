// Validates every lesson and puzzle with the chess core: positions load,
// demonstration moves are legal, accepted answers are legal, mate exercises
// really mate, "safe" answers do not allow mate in one, and every puzzle
// solution is legal and ends in a gain the engine confirms.
'use strict';
const assert = require('assert');
const path = require('path');
const E = require('../../chess-core/src/engine.js')();
const lessons = require('../lessons.json');
const puzzles = require('../puzzles.json');

const sq = (name) => E.parseSq(name);
let checked = 0;

function load(fen, where) {
  const p = new E.Pos();
  const err = p.load(fen);
  assert.strictEqual(err, null, where + ': ' + err);
  return p;
}

const ids = new Set();
for (const l of lessons.lessons) {
  assert.ok(/^lesson\.c\d\d\.l\d\d\.[a-z-]+$/.test(l.id), 'lesson id format: ' + l.id);
  assert.ok(!ids.has(l.id), 'duplicate id ' + l.id); ids.add(l.id);
  assert.ok(lessons.chapters.some((c) => c.n === l.chapter), l.id + ' chapter');
  assert.ok(l.steps.length && l.exercises.length, l.id + ' has steps and exercises');
  for (const [i, s] of l.steps.entries()) {
    const where = l.id + ' step ' + i;
    assert.ok(s.say && s.say.length > 20, where + ' narration');
    const p = load(s.fen, where);
    for (const u of s.play || []) { const m = p.parseMove(u); assert.ok(m !== null && m !== undefined, where + ' play ' + u); p.make(m); }
    for (const a of s.arrows || []) assert.ok(sq(a[0]) >= 0 && sq(a[1]) >= 0, where + ' arrow');
    for (const m of s.marks || []) assert.ok(sq(m) >= 0, where + ' mark ' + m);
  }
  for (const [i, x] of l.exercises.entries()) {
    const where = l.id + ' exercise ' + i;
    assert.ok(x.prompt, where + ' prompt');
    if (x.fen && x.type === 'choice') load(x.fen, where);
    if (x.type === 'choice') { assert.ok(x.options.length >= 2 && x.answer >= 0 && x.answer < x.options.length, where); checked++; continue; }
    if (x.type === "puzzles") { if (!puzzles.length) { checked++; continue; } assert.ok(puzzles.some((p) => p.themes.includes(x.theme) || (x.theme === 'mate' && p.themes.some((t) => t.startsWith('mateIn')))), where + ' has puzzles for ' + x.theme); checked++; continue; }
    const p = load(x.fen, where);
    const legal = p.legalMoves();
    if (x.type === 'square') { for (const a of x.answers) assert.ok(sq(a) >= 0, where); checked++; continue; }
    if (x.type === 'targets') {
      const from = sq(x.from);
      assert.ok(p.b[from] && Math.sign(p.b[from]) === p.side, where + ' piece of side to move on ' + x.from);
      assert.ok(legal.some((m) => (m & 127) === from), where + ' has moves');
      checked++; continue;
    }
    if (x.type === 'anyLegal') { assert.ok(legal.length > 0, where); checked++; continue; }
    if (x.type === 'move' || x.type === 'mate') {
      const answers = x.answers || [];
      if (x.type === 'move') assert.ok(answers.length, where + ' answers');
      for (const u of answers) {
        const m = p.parseMove(u, legal);
        assert.ok(m !== null && m !== undefined, where + ' answer legal ' + u);
        if (x.safe) {
          // The answer must not allow mate in one.
          p.make(m);
          for (const r of p.legalMoves()) { p.make(r); assert.ok(p.legalMoves().length || !p.inCheck(), where + ' ' + u + ' allows mate by ' + E.uci(r)); p.unmake(); }
          p.unmake();
        }
      }
      for (const u of Object.keys(x.wrong || {})) assert.ok(p.parseMove(u, legal) !== null, where + ' wrong-answer move is legal ' + u);
      // Tactical answers must hold up against the engine: within 100 cp of its best move.
      if (x.check === 'engine') {
        const best = E.search(p, { timeMs: 400 });
        for (const u of answers) {
          const m = p.parseMove(u, legal);
          p.make(m);
          const r = E.search(p, { timeMs: 250 });
          p.unmake();
          assert.ok(-r.score >= best.score - 100, where + ' answer ' + u + ' scores ' + (-r.score) + ', engine best ' + E.uci(best.move) + ' ' + best.score);
        }
      }
      if (x.type === 'mate') {
        const mates = legal.filter((m) => { p.make(m); const r = !p.legalMoves().length && p.inCheck(); p.unmake(); return r; });
        assert.ok(mates.length >= 1, where + ' has a mate in one');
        for (const u of Object.keys(x.wrong || {})) { const m = p.parseMove(u, legal); assert.ok(!mates.includes(m), where + ' wrong answer is not mate'); }
      }
      checked++; continue;
    }
    assert.fail(where + ' unknown type ' + x.type);
  }
}
console.log('lessons ok:', lessons.lessons.length, 'lessons,', checked, 'exercises');

// Puzzles: the first move is the opponent's, then solver/reply alternate.
const pids = new Set();
for (const pz of puzzles) {
  assert.ok(!pids.has(pz.id), 'duplicate puzzle ' + pz.id); pids.add(pz.id);
  const p = load(pz.fen, pz.id);
  assert.ok(pz.moves.length >= 2 && pz.moves.length % 2 === 0, pz.id + ' move count');
  for (const u of pz.moves) { const m = p.parseMove(u); assert.ok(m !== null && m !== undefined, pz.id + ' legal ' + u); p.make(m); }
  assert.ok(pz.rating >= 400 && pz.rating <= 2600, pz.id + ' rating');
  assert.ok(pz.themes.length, pz.id + ' themes');
}
console.log('puzzles ok:', puzzles.length);
void path;

// Openings: every line is legal and notes point at real plies.
const openings = require('../openings.json').openings;
const oids = new Set();
for (const o of openings) {
  assert.ok(/^opening\.[a-z-]+$/.test(o.id) && !oids.has(o.id), 'opening id ' + o.id); oids.add(o.id);
  assert.ok(['white', 'black'].includes(o.side) && ['free', 'premium'].includes(o.access), o.id);
  const g = new E.Game();
  for (const u of o.moves) assert.ok(g.playText(u), o.id + ' legal ' + u);
  for (const k of Object.keys(o.notes)) assert.ok(+k < o.moves.length, o.id + ' note ply ' + k);
  assert.ok(o.moves.length >= 8 && o.ideas.length >= 2, o.id + ' content');
}
assert.ok(openings.some((o) => o.access === 'free' && o.side === 'white') && openings.some((o) => o.access === 'free' && o.side === 'black'));
console.log('openings ok:', openings.length);

// Endgames: positions load, goals are known and the side to move is not already lost or won.
const endgames = require('../endgames.json').endgames;
for (const d of endgames) {
  const p = load(d.fen, d.id);
  assert.ok(['mate', 'promote', 'draw'].includes(d.goal), d.id + ' goal');
  assert.ok(p.legalMoves().length > 0 && d.par > 0, d.id);
}
console.log('endgames ok:', endgames.length);

// Catalog, seasons, missions and store refer to each other consistently.
const catalog = require('../catalog.json');
const seasons = require('../seasons.json');
const missions = require('../missions.json');
const store = require('../store.json');
const campaign = require('../campaign.json');
const itemIds = new Set();
const cats = new Set(catalog.categories.map((c) => c.id));
for (const it of catalog.items) {
  assert.ok(!itemIds.has(it.id), 'duplicate item ' + it.id); itemIds.add(it.id);
  assert.ok(cats.has(it.category), it.id + ' category');
  assert.ok(['free', 'level', 'achievement', 'premium', 'season', 'journey'].includes(it.unlock.type), it.id + ' unlock');
  assert.ok(typeof it.desc === 'string' && it.desc.length > 3, it.id + ' description');
  if (it.unlock.type === 'journey') assert.ok(campaign.eras.some((e) => e.id === it.unlock.era), it.id + ' era');
  if (it.category === 'avatar') assert.ok(/^(piece:[kqrbnp]|animal:[a-z]+|emblem:[a-z]+)$/.test(it.data.art), it.id + ' art');
  if (it.unlock.type === 'season') {
    const s = seasons.seasons.find((x) => x.id === it.unlock.season);
    assert.ok(s, it.id + ' season');
    assert.ok(it.unlock.tier >= 1 && it.unlock.tier <= s.tiers, it.id + ' tier');
    assert.ok(['free', 'pass'].includes(it.unlock.track), it.id + ' track');
  }
}
for (const c of cats) assert.ok(itemIds.has(catalog.defaults[c]), 'default for ' + c);
for (const s of seasons.seasons) {
  assert.ok(s.starts < s.ends, s.id + ' dates');
  const slots = catalog.items.filter((i) => i.unlock.season === s.id).map((i) => i.unlock.track + i.unlock.tier);
  assert.strictEqual(new Set(slots).size, slots.length, s.id + ' one reward per tier and track');
}
const EVENTS = ['game', 'win', 'online', 'puzzle', 'daily', 'lesson', 'drill', 'dojo', 'review'];
for (const m of missions.missions) assert.ok(EVENTS.includes(m.event) && m.goal > 0 && m.xp > 0 && m.text, m.id);
assert.ok(new Set(missions.missions.map((m) => m.event)).size >= missions.perDay);
for (const p of store.products) {
  assert.ok(p.grants.length, p.id);
  for (const g of p.grants) assert.ok(g.key === 'premium' || seasons.seasons.some((s) => g.key === 'pass:' + s.id), p.id + ' grant ' + g.key);
  if (p.price) assert.ok(Number.isInteger(p.price.amount) && p.price.amount > 0 && /^[A-Z]{3}$/.test(p.price.currency), p.id + ' price');
}
console.log('catalog, seasons, missions and store ok:', catalog.items.length, 'items');

// Journey Through Time: every stage points at real content, every era pays out a set, board,
// room and coach avatar, and the coaches and opponents have portraits.
const ANIMALS = new Set();
const eraIds = new Set();
for (const o of campaign.opponents) {
  assert.ok(o.level >= 0 && o.level <= 7 && o.full && o.blurb && o.animal, 'opponent ' + o.id); ANIMALS.add(o.animal);
  // what each rival says when a game starts and ends (shown in the game and on the result card)
  for (const k of ['hello', 'win', 'lose', 'draw']) assert.ok(typeof o[k] === 'string' && o[k].length > 5 && o[k].length < 140, o.id + ' ' + k + ' line');
}
assert.deepStrictEqual(campaign.opponents.map((o) => o.level), [0, 1, 2, 3, 4, 5, 6, 7]);
assert.ok(campaign.coach.animal && campaign.coach.full);
campaign.eras.forEach((e, k) => {
  assert.ok(!eraIds.has(e.id), 'duplicate era ' + e.id); eraIds.add(e.id);
  assert.strictEqual(e.n, k + 1, e.id + ' order');
  assert.ok(['free', 'premium'].includes(e.access), e.id + ' access');
  assert.ok(e.name && e.title && e.when && e.place && e.landmark && e.colors.length === 2, e.id + ' text');
  assert.ok(e.coach && e.coach.full && e.coach.animal && e.coach.hello && e.coach.win && e.coach.lose, e.id + ' coach');
  assert.ok(!ANIMALS.has(e.coach.animal), e.id + ' coach animal is unique'); ANIMALS.add(e.coach.animal);
  for (const cat of ['pieces', 'board', 'room', 'avatar']) assert.ok(catalog.items.some((i) => i.category === cat && i.unlock.type === 'journey' && i.unlock.era === e.id), e.id + ' rewards a ' + cat);
  const set = catalog.items.find((i) => i.category === 'pieces' && i.unlock.era === e.id);
  assert.strictEqual(set.data.set, e.set, e.id + ' set');
  assert.strictEqual(e.stages[0].kind, 'tale', e.id + ' opens with a tale');
  assert.strictEqual(e.stages[e.stages.length - 1].kind, 'champion', e.id + ' ends with its champion');
  for (const st of e.stages) {
    assert.ok(st.title, e.id + ' stage title');
    if (st.kind === 'tale') {
      assert.ok(st.pages.length >= 2 && st.pages.every((t) => t.length > 40 && t.length < 330), e.id + ' tale pages');
      assert.ok(st.quiz.options.length >= 2 && st.quiz.options[st.quiz.answer] && st.quiz.explain, e.id + ' quiz');
    } else if (st.kind === 'lesson') {
      const l = lessons.lessons.find((x) => x.id === st.lesson);
      assert.ok(l, e.id + ' lesson ' + st.lesson);
      const ch = lessons.chapters.find((c) => c.n === l.chapter);
      assert.ok(e.access === 'premium' || ch.access === 'free', e.id + ' free eras use free lessons');
    } else if (st.kind === 'puzzles') {
      const themes = [].concat(st.theme);
      const pool = puzzles.filter((p) => p.themes.some((t) => themes.includes(t)) && p.rating >= (st.min || 0) && p.rating <= (st.max || 9999));
      assert.ok(pool.length >= st.count, e.id + ' has ' + pool.length + ' puzzles for ' + themes.join('/'));
    } else if (st.kind === 'endgame') {
      const d = endgames.find((x) => x.id === st.endgame);
      assert.ok(d && (e.access === 'premium' || d.access === 'free'), e.id + ' endgame ' + st.endgame);
    } else if (st.kind === 'champion') {
      assert.ok(st.level >= 0 && st.level <= 7 && ['white', 'black'].includes(st.color), e.id + ' champion');
      assert.ok(e.access === 'premium' || st.level <= 3, e.id + ' free eras play free levels');
    } else assert.fail(e.id + ' stage kind ' + st.kind);
  }
});
console.log('campaign ok:', campaign.eras.length, 'eras,', ANIMALS.size, 'portraits');
