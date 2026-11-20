// Coach: fact detection (forks, mates, hanging pieces) and review classifications.
const assert = require('assert');
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E);

const at = (fen) => { const p = new E.Pos(); assert.strictEqual(p.load(fen), null); return p; };
const factsFor = (fen, mv) => { const p = at(fen); return C.facts(p, p.parseMove(mv, p.legalMoves())); };

// Knight fork of king and rook.
let f = factsFor('4k3/8/8/1r6/8/8/8/2N1K3 w - - 0 1', 'c1d3');
assert.deepStrictEqual(f.forks, [], 'Nd3 attacks only the rook');
f = factsFor('r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1', 'b5c7');
assert(f.check);
assert.deepStrictEqual(f.forks.map((t) => t.kind).sort(), [E.R, E.K].sort());
assert(/fork/i.test(C.describe(f)), C.describe(f));

// Back-rank mate.
f = factsFor('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8');
assert(f.mate && f.check);
assert(/checkmate/i.test(C.describe(f)), C.describe(f));

// Hanging piece after the move.
f = factsFor('4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1', 'd1d4');
assert(f.hangs.length === 0 || f.hangs.every((h) => h.kind !== E.Q), 'queen on d4 is not hanging: pawn d5 does not attack d4');
const p = at('4k3/8/8/8/2p5/8/8/3QK3 w - - 0 1');
const hang = C.facts(p, p.parseMove('d1d3', p.legalMoves()));
assert(hang.hangs.some((h) => h.kind === E.Q), 'Qd3 puts the queen en prise to the c4 pawn');

// Win probability is symmetric and monotonic.
assert(Math.abs(C.winProb(0) - 0.5) < 1e-9);
assert(C.winProb(300) > C.winProb(100));
assert(Math.abs(C.winProb(250) + C.winProb(-250) - 1) < 1e-9);
assert.strictEqual(C.mateIn(E.MATE - 3), 2);

// Review of a short game: the move that allows mate in one is a blunder, and the mating move is best.
const r = C.review(E.START_FEN, ['f2f3', 'e7e5', 'g2g4', 'd8h4'], { timeMs: 60 });
assert.strictEqual(r.plies.length, 4);
assert.strictEqual(r.plies[2].cls, 'blunder');
assert(/checkmate/i.test(r.plies[2].text), r.plies[2].text);
assert(['best', 'excellent', 'brilliant'].includes(r.plies[3].cls), r.plies[3].cls);
assert(r.summary.accuracy[E.BLACK] > r.summary.accuracy[E.WHITE]);
assert(r.summary.key.includes(2));

// Hint ladder: a theme first, then the piece, then the move.
const mp = at('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
const ladder = C.hintLadder(mp, mp.parseMove('a1a8', mp.legalMoves()));
assert(/checkmate/i.test(ladder.theme));
assert.strictEqual(ladder.piece, 'rook on a1');
assert.strictEqual(ladder.san, 'Ra8#');

console.log('coach ok');

// Chaturanga: the coach knows the old moves and names. A Mantri (counsellor) on d4 attacks only
// its four diagonal neighbours, a Gaja (elephant) jumps two squares, and nothing slides diagonally.
{
  const p = E.positionFrom('chaturanga:4k3/8/8/8/3q4/8/8/B3K3 w - - 0 1', []);
  assert.deepStrictEqual(C.attacksFrom(p, E.parseSq('d4')).map((s) => E.sqName(s)).sort(), ['c3', 'c5', 'e3', 'e5']);
  assert.deepStrictEqual(C.attacksFrom(p, E.parseSq('a1')).map((s) => E.sqName(s)).sort(), ['c3']);
  assert.deepStrictEqual(C.attackers(p, E.parseSq('e5'), -1).map((a) => a.kind), [E.Q]);
  const h = C.hintLadder(E.positionFrom('chaturanga:4k3/8/8/8/8/8/3r4/K2R4 w - - 0 1', []), E.positionFrom('chaturanga:4k3/8/8/8/8/8/3r4/K2R4 w - - 0 1', []).parseMove('Rxd2'));
  assert.ok(/chariot/.test(h.piece) && /chariot/.test(h.text), h.text);
}
console.log('coach chaturanga ok');

// The coach names only checkmates the exact solver proves. The engine scores Chaturanga's bare-king and
// stalemate wins as "mate" too; those must not be called checkmate (a player once pressed "Show me" on a
// "checkmate in one" and the move did not mate).
{
  const p = E.positionFrom('chaturanga:8/7K/3r1k2/8/8/7q/8/8 b - - 47 100', []);
  const r = E.search(p, { timeMs: 150, quiesce: true });
  assert(C.mateIn(r.score) > 0, 'the engine sees a decisive win');
  p.make(r.move); const mates = p.inCheck() && !p.legalMoves().length; p.unmake();
  assert(!mates, 'this win is by bare king, not checkmate');
  assert.strictEqual(C.mateAfter(p, r.move, r.score), 0, 'a bare-king win is not called checkmate');
  // Plain chess: a real mate in one and a quiet mate in two keep their counts.
  const m1 = at('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
  const r1 = E.search(m1, { timeMs: 150, quiesce: true });
  assert.strictEqual(C.mateAfter(m1, r1.move, r1.score), 1);
  assert.strictEqual(C.mateOf(m1, r1.score), 1);
  const m2 = E.positionFrom('8/2k5/R1N5/6Q1/1P3P2/4P3/2p3PP/2B2RK1 b - f3 0 34', ['c7d6']);
  const r2 = E.search(m2, { timeMs: 400, quiesce: true });
  assert.strictEqual(E.uci(r2.move), 'a6a7');
  assert.strictEqual(C.mateAfter(m2, r2.move, r2.score), 2);
  // A wrong claim is dropped and the board is left as it was, even when the solver stops part-way.
  const fen = m2.fen();
  assert.strictEqual(C.mateAfter(m2, m2.parseMove('g5d8'), 30000 - 1), 0, 'Qd8+ is not mate');
  assert.strictEqual(C.mateOf(m2, -(30000 - 1)), 0, 'White is not getting mated');
  assert.strictEqual(m2.fen(), fen);
}
console.log('coach proven mates ok');
