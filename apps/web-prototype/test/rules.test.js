// The in-game rule book: each rule's line follows the position on the board.
const assert = require('assert');
const E = require('../../../packages/chess-core/src/engine.js')();
const R = require('../src/rules.js')(E);
const lessons = require('../../../packages/content/lessons.json').lessons;

const book = (fen, ucis, side, mine) => {
  const g = new E.Game(fen || E.START_FEN);
  for (const u of ucis || []) assert(g.playText(u), u);
  return R.forGame(g, side === undefined ? E.WHITE : side, mine !== false);
};
const rule = (list, id) => list.find((r) => r.id === id);

// Every rule links to a real lesson and has a well-formed picture.
for (const r of R.RULES) {
  assert(lessons.some((l) => l.id === r.lesson), r.lesson);
  if (r.also) assert(lessons.some((l) => l.id === r.also.id), r.also.id);
  const rows = r.pic.fen.split(' ')[0].split('/');
  assert(rows.length === 8 && rows.every((row) => row.replace(/\d/g, (n) => 'x'.repeat(+n)).length === 8), r.id + ' picture FEN');
}

// The start: no check, castling still ahead, nothing happening right now.
let b = book();
assert(!rule(b, 'check'));
assert.deepStrictEqual(b.map((r) => r.id), ['castling', 'en-passant', 'promotion', 'draws']);
assert(!b.some((r) => r.now));
assert(/later/.test(rule(b, 'castling').line) && /in between/.test(rule(b, 'castling').line));

// Castling ready: listed first, both ways named.
b = book('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
assert.strictEqual(b[0].id, 'castling');
assert(/right now: kingside or queenside/.test(b[0].line), b[0].line);
// A watched square blocks it.
b = book('r3k2r/8/8/8/8/8/6r1/R3K2R w KQ - 0 1');
assert(/right now: queenside\./.test(rule(b, 'castling').line), rule(b, 'castling').line);
b = book('4k3/8/8/8/8/8/5r2/4K2R w K - 0 1');
assert(!rule(b, 'castling').now && /watches/.test(rule(b, 'castling').line), rule(b, 'castling').line);
// The king has moved: gone for good.
b = book(null, ['e2e4', 'e7e5', 'e1e2', 'e8e7']);
assert(/gone/.test(rule(b, 'castling').line));

// En passant: offered on the one move it is allowed.
b = book(null, ['e2e4', 'a7a6', 'e4e5', 'd7d5']);
assert.strictEqual(b[0].id, 'en-passant');
assert(/d6/.test(b[0].line));
b = book(null, ['e2e4', 'a7a6', 'e4e5', 'd7d5', 'a2a3', 'a6a5']);
assert(!rule(b, 'en-passant').now);

// Promotion: a pawn on the seventh rank.
b = book('4k3/1P6/8/8/8/8/8/4K3 w - - 0 1');
assert(rule(b, 'promotion').now && /b7/.test(rule(b, 'promotion').line));
b = book('4k3/8/8/8/8/8/2p5/4K3 w - - 0 1');
assert(/Watch out/.test(rule(b, 'promotion').line));

// Check comes first while a king is attacked.
b = book('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1', [], E.BLACK);
assert.strictEqual(b[0].id, 'check');
assert(/You are in check/.test(b[0].line));

// Draws: the second repetition warns, the third can be claimed.
const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
b = book(null, shuffle);
assert(rule(b, 'draws').now && /twice/.test(rule(b, 'draws').line));
b = book(null, shuffle.concat(shuffle));
assert(/claim a draw right now/.test(rule(b, 'draws').line));
b = book('4k3/8/8/8/8/8/8/R3K3 w - - 70 80');
assert(/35 moves/.test(rule(b, 'draws').line));

// Two players sharing the device: the book names the side, not "you".
b = book('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', [], E.BLACK, false);
assert(/^Black can castle right now/.test(rule(b, 'castling').line));

console.log('rules ok');
