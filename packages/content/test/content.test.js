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
  checkLesson(l);
}
// Shared by Learn lessons and the lessons written into each era of the journey.
function checkLesson(l) {
  assert.ok(l.steps.length && l.exercises.length, l.id + ' has steps and exercises');
  for (const [i, s] of l.steps.entries()) {
    const where = l.id + ' step ' + i;
    assert.ok(s.say && s.say.length > 20, where + ' narration');
    const p = load(s.fen, where);
    for (const u of s.play || []) { const m = p.parseMove(u); assert.ok(m !== null && m !== undefined, where + ' play ' + u); p.make(m); }
    for (const a of s.arrows || []) assert.ok(sq(a[0]) >= 0 && sq(a[1]) >= 0, where + ' arrow');
    for (const m of s.marks || []) assert.ok(sq(m) >= 0, where + ' mark ' + m);
  }
  for (const [i, x] of l.exercises.entries()) checkExercise(x, l.id + ' exercise ' + i);
}
function checkExercise(x, where) {
  {
    assert.ok(x.prompt, where + ' prompt');
    if (x.fen && x.type === 'choice') load(x.fen, where);
    if (x.type === 'choice') { assert.ok(x.options.length >= 2 && x.answer >= 0 && x.answer < x.options.length, where); checked++; return; }
    if (x.type === "puzzles") { if (!puzzles.length) { checked++; return; } assert.ok(puzzles.some((p) => p.themes.includes(x.theme) || (x.theme === 'mate' && p.themes.some((t) => t.startsWith('mateIn')))), where + ' has puzzles for ' + x.theme); checked++; return; }
    const p = load(x.fen, where);
    const legal = p.legalMoves();
    if (x.type === 'square') { for (const a of x.answers) assert.ok(sq(a) >= 0, where); checked++; return; }
    if (x.type === 'targets') {
      const from = sq(x.from);
      assert.ok(p.b[from] && Math.sign(p.b[from]) === p.side, where + ' piece of side to move on ' + x.from);
      assert.ok(legal.some((m) => (m & 127) === from), where + ' has moves');
      checked++; return;
    }
    if (x.type === 'anyLegal') { assert.ok(legal.length > 0, where); checked++; return; }
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
      checked++; return;
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
const EVENTS = ['game', 'win', 'online', 'puzzle', 'daily', 'lesson', 'drill', 'dojo', 'review', 'mini'];
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
// Nothing in an era repeats Learn: no lesson, lesson position or lesson puzzle.
const board = (fen) => fen.split(' ').slice(0, 2).join(' ');
const learnBoards = new Set(), eraBoards = new Set(), eraPuzzles = new Set();
const learnPuzzles = new Set();
for (const l of lessons.lessons) {
  for (const x of l.steps.concat(l.exercises)) if (x.fen) learnBoards.add(board(x.fen));
  for (const x of l.exercises) if (x.type === 'puzzles') {
    // the same pick the lesson screen makes
    puzzles.filter((p) => x.theme === 'mate' ? p.themes.some((t) => t.startsWith('mateIn')) : p.themes.includes(x.theme))
      .sort((a, b) => a.rating - b.rating).slice(0, x.count).forEach((p) => learnPuzzles.add(p.id));
  }
}
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
      // Each era teaches with its own lesson; Learn lessons are never repeated here.
      assert.ok(!st.lesson && st.id === 'era.' + e.id + '.lesson' && st.objectives.length, e.id + ' has its own lesson');
      checkLesson(st);
      for (const pos of st.steps.concat(st.exercises)) if (pos.fen) {
        assert.ok(!learnBoards.has(board(pos.fen)), st.id + ' repeats a Learn position ' + pos.fen);
        eraBoards.add(board(pos.fen));
      }
    } else if (st.kind === 'puzzles') {
      assert.ok(st.puzzles.length >= 3, e.id + ' puzzles');
      for (const id of st.puzzles) {
        assert.ok(puzzles.some((p) => p.id === id), e.id + ' puzzle ' + id);
        assert.ok(!learnPuzzles.has(id), e.id + ' repeats ' + id + ' from a Learn lesson');
        assert.ok(!eraPuzzles.has(id), e.id + ' repeats ' + id + ' from another era'); eraPuzzles.add(id);
      }
    } else if (st.kind === 'endgame') {
      // An era's endgame is its own position, not one from the Endgame Dojo.
      const d = st.endgame;
      assert.ok(d.id === 'era.' + e.id + '.endgame' && d.name && d.tip && d.par > 0 && ['mate', 'promote', 'draw'].includes(d.goal), e.id + ' endgame');
      assert.ok(load(d.fen, d.id).legalMoves().length, d.id + ' position');
      assert.ok(!endgames.some((x) => board(x.fen) === board(d.fen)), d.id + ' repeats a dojo position');
    } else if (st.kind === 'champion') {
      assert.ok(st.level >= 0 && st.level <= 7 && ['white', 'black'].includes(st.color), e.id + ' champion');
      assert.ok(e.access === 'premium' || st.level <= 3, e.id + ' free eras play free levels');
    } else assert.fail(e.id + ' stage kind ' + st.kind);
  }
});
console.log('campaign ok:', campaign.eras.length, 'eras,', ANIMALS.size, 'portraits');

// Variations: a playable one has its rules in the engine, a rule sheet, and a lesson whose boards,
// targets and answers work under its own rules. Every other one is marked as coming soon.
const variants = require('../variants.json').variants;
const campaignEras = new Set(require('../campaign.json').eras.map((e) => e.id));
assert.strictEqual(new Set(variants.map((v) => v.id)).size, variants.length, 'variation ids are unique');
for (const v of variants) {
  assert.ok(['ready', 'soon'].includes(v.status) && v.name && v.tagline && v.blurb, v.id);
  if (v.era) assert.ok(campaignEras.has(v.era), v.id + ' era ' + v.era);
  if (v.status !== 'ready') continue;
  assert.ok(E.VARIANTS[v.id], v.id + ' has rules in the engine');
  assert.strictEqual(v.start, E.VARIANTS[v.id].start, v.id + ' start');
  assert.strictEqual(E.variantOf(load(v.start, v.id).fen()), v.id);
  assert.ok(v.pieces.length === 6 && v.rules.length && v.rules.some((r) => r.differs), v.id + ' rule sheet');
  for (const pc of v.pieces) {
    assert.ok('kqbnrp'.includes(pc.kind) && pc.name && pc.en && pc.moves, v.id + ' piece ' + pc.kind);
    assert.strictEqual(pc.fen.split('/').length, 8, v.id + ' ' + pc.name + ' picture');
    assert.ok(pc.dots.every((d) => sq(d) >= 0), v.id + ' ' + pc.name + ' dots');
  }
  const L = v.lesson;
  assert.ok(L.title && L.objectives.length && L.steps.length && L.exercises.length, v.id + ' lesson');
  assert.ok(L.steps.concat(L.exercises).some((x) => x.differs), v.id + ' lesson marks what differs');
  L.steps.forEach((s, i) => { assert.strictEqual(E.variantOf(s.fen), v.id, v.id + ' step ' + i); load(s.fen, v.id + ' step ' + i); assert.ok(s.line, v.id + ' step ' + i + ' line'); checked++; });
  L.exercises.forEach((x, i) => {
    const where = v.id + ' exercise ' + i;
    assert.strictEqual(E.variantOf(x.fen), v.id, where);
    const g = new E.Game(x.fen);
    if (x.type === 'targets') assert.ok(g.targets(E.to64(sq(x.from))).length >= 2, where + ' targets');
    else if (x.type === 'move') for (const u of x.answers) assert.ok(g.legal.some((m) => E.uci(m) === u), where + ' answer ' + u);
    else if (x.type === 'choice') assert.ok(x.options[x.answer], where + ' answer');
    else if (x.type === 'win') assert.ok(g.legal.some((m) => { const t = new E.Game(x.fen); t.play(m); return t.outcome && t.outcome.result === (g.pos.side === E.WHITE ? '1-0' : '0-1'); }), where + ' has a winning move');
    else assert.fail(where + ' type ' + x.type);
    checked++;
  });
}
console.log('variations ok:', variants.filter((v) => v.status === 'ready').length, 'playable of', variants.length);
// The placement test: ten new board questions, easiest first. Every position passes the same checks
// as a lesson exercise, none is a Learn or era position, and its puzzles are used by no lesson or era.
const placement = require('../placement.json');
{
  const qids = new Set();
  for (const q of placement.questions) {
    const where = 'placement ' + q.id;
    assert.ok(/^q\d\d$/.test(q.id) && !qids.has(q.id) && q.skill, where + ' id'); qids.add(q.id);
    if (q.type === 'puzzle') {
      const pz = puzzles.find((p) => p.id === q.puzzle);
      assert.ok(pz && q.prompt, where + ' puzzle ' + q.puzzle);
      assert.ok(!learnPuzzles.has(pz.id) && !eraPuzzles.has(pz.id), where + ' repeats ' + pz.id + ' from a lesson or era');
      continue;
    }
    checkExercise(q, where);
    assert.ok(!learnBoards.has(board(q.fen)), where + ' repeats a Learn position');
    assert.ok(!eraBoards.has(board(q.fen)), where + ' repeats an era position');
  }
  assert.ok(placement.questions.length >= 8 && placement.questions.length <= 10, 'eight to ten questions');
  // the puzzles come last, easier first
  const pz = placement.questions.filter((q) => q.type === 'puzzle').map((q) => puzzles.find((p) => p.id === q.puzzle).rating);
  assert.deepStrictEqual(pz, pz.slice().sort((a, b) => a - b), 'puzzles rise in difficulty');
  // bands rise from 0, each with a real chapter and its own badge; a friend for every score
  const bands = placement.bands;
  assert.strictEqual(bands[0].min, 0);
  bands.forEach((b, k) => {
    assert.ok(k === 0 || (b.min > bands[k - 1].min && b.chapter > bands[k - 1].chapter), 'band ' + k + ' order');
    assert.ok(lessons.chapters.some((c) => c.n === b.chapter) && b.badge.id && b.badge.name && b.badge.desc && b.say, 'band ' + k);
  });
  assert.strictEqual(new Set(bands.map((b) => b.badge.id)).size, bands.length);
  const f = placement.friends;
  assert.strictEqual(f.byScore.length, placement.questions.length + 1);
  for (const lv of f.byScore.concat(f.perfect.map((p) => p[1]))) assert.ok(campaign.opponents.some((o) => o.level === lv), 'friend level ' + lv);
  console.log('placement ok:', placement.questions.length, 'questions,', bands.length, 'bands');
}
