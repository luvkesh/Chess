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
