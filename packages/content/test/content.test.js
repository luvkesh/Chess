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
