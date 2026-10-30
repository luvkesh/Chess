const assert = require('assert');
const X = require('../src/xiangqi.js')();
// Move counts from the Xiangqi perft tables (chessprogramming.org).
const perfts = [
  ['rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1', [44, 1920, 79666]],
  ['r1ba1a3/4kn3/2n1b4/pNp1p1p1p/4c4/6P2/P1P2R2P/1CcC5/9/2BAKAB2 w - - 0 1', [38, 1128, 43929]],
  ['1cbak4/9/n2a5/2p1p3p/5cp2/2n2N3/6PCP/3AB4/2C6/3A1K1N1 w - - 0 1', [7, 281, 8620]],
  ['5a3/3k5/3aR4/9/5r3/5n3/9/3A1A3/5K3/2BC2B2 w - - 0 1', [25, 424, 9850]],
  ['CRN1k1b2/3ca4/4ba3/9/2nr5/9/9/4B4/4A4/4KA3 w - - 0 1', [28, 516, 14808]],
];
for (const [fen, counts] of perfts) {
  const p = new X.Pos(); assert.strictEqual(p.load('xiangqi:' + fen), null);
  counts.forEach((n, i) => assert.strictEqual(X.perft(p, i + 1), n, fen + ' d' + (i + 1)));
  assert.strictEqual(p.fen(), 'xiangqi:' + fen, 'fen roundtrip');
}
assert.strictEqual(new X.Pos().load(X.START_FEN), null);

// Checkmate: the chariot checks on the d-file and the Red general guards the e-file.
let g = new X.Game('xiangqi:3k5/9/9/9/9/9/9/9/9/R3K4 w - - 0 1');
assert(g.playText('a0d0'));
assert.deepStrictEqual(g.outcome, { result: '1-0', reason: 'checkmate' });
// No legal move loses, even without check.
g = new X.Game('xiangqi:3k5/R8/9/9/9/9/9/9/9/4K4 b - - 0 1');
assert.deepStrictEqual(g.outcome, { result: '1-0', reason: 'stalemate-loss' });
// Endless check loses for the side giving it.
g = new X.Game('xiangqi:3k5/R8/9/9/9/9/9/9/9/5K3 w - - 0 1');
for (let i = 0; i < 3 && !g.outcome; i++) for (const mv of ['a8a9', 'd9d8', 'a9a8', 'd8d9']) if (!g.outcome) assert(g.playText(mv), mv);
assert.deepStrictEqual(g.outcome, { result: '0-1', reason: 'perpetual-check' });
// Quiet repetition is a draw.
g = new X.Game('xiangqi:3k5/9/9/9/9/9/9/9/R8/5K3 w - - 0 1');
for (let i = 0; i < 3 && !g.outcome; i++) for (const mv of ['a1a2', 'd9d8', 'a2a1', 'd8d9']) if (!g.outcome) assert(g.playText(mv), mv);
assert.deepStrictEqual(g.outcome, { result: '1/2-1/2', reason: 'threefold' });
// Sixty moves each with no capture.
g = new X.Game('xiangqi:3k5/9/9/9/9/9/9/9/R8/5K3 w - - 119 80');
assert(g.playText('a1a2'));
assert.deepStrictEqual(g.outcome, { result: '1/2-1/2', reason: 'sixty' });
// Nobody left who can cross the river.
g = new X.Game('xiangqi:3k5/4a4/9/9/9/9/9/9/4A4/4K4 w - - 0 1');
assert.deepStrictEqual(g.outcome, { result: '1/2-1/2', reason: 'insufficient' });
// The generals may never face each other on an open file.
g = new X.Game('xiangqi:4k4/9/9/9/9/9/9/9/9/3K5 w - - 0 1');
assert.strictEqual(g.find(X.parseSq('d0'), X.parseSq('e0')), null);
// Undo restores the position.
g = new X.Game();
const before = g.fen();
g.playText('h2e2'); g.playText('h9g7'); g.undo(); g.undo();
assert.strictEqual(g.fen(), before);
// The computer finds a mate in one.
const r = X.search(new X.Game('xiangqi:3k5/9/9/9/9/9/9/9/9/R3K4 w - - 0 1').pos, { depth: 4, timeMs: 2000 });
assert.strictEqual(X.uci(r.move), 'a0d0');
console.log('xiangqi tests passed');
