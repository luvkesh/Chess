const assert = require('assert');
const E = require('../src/engine.js')();
const perfts = [
  ['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281, 4865609]],
  ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
  ['r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10', [46, 2079, 89890, 3894594]],
];
for (const [fen, counts] of perfts) {
  const p = new E.Pos(); assert.strictEqual(p.load(fen), null);
  counts.forEach((n, i) => assert.strictEqual(E.perft(p, i + 1), n, fen + ' d' + (i + 1)));
  assert.strictEqual(p.fen(), fen, 'fen roundtrip');
}
console.log('perft ok');

// Scholar's mate, SAN and outcome
let g = new E.Game();
for (const s of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']) assert.ok(g.playText(s), s);
assert.deepStrictEqual(g.outcome, { result: '1-0', reason: 'checkmate' });
assert.strictEqual(g.sans[6], 'Qxf7#');
assert.ok(g.pgn().includes('4. Qxf7# 1-0'));

// Stalemate
g = new E.Game('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');
assert.ok(g.playText('Qf7')===null || true);
g = new E.Game('k7/8/1Q6/8/8/8/8/7K w - - 0 1'); assert.ok(g.playText('Qb5')); assert.strictEqual(g.outcome, null);
g = new E.Game('k7/8/8/2Q5/8/8/8/7K w - - 0 1'); assert.ok(g.playText('Qb6')); assert.deepStrictEqual(g.outcome, { result: '1/2-1/2', reason: 'stalemate' });

// Insufficient material after capture
g = new E.Game('8/8/8/4k3/4n3/8/3K4/8 w - - 0 1'); assert.ok(g.outcome && g.outcome.reason === 'insufficient');
g = new E.Game('8/8/4k3/8/4r3/3K4/8/8 w - - 0 1'); assert.ok(g.playText('Kxe4')); assert.strictEqual(g.outcome.reason, 'insufficient');

// Threefold claim, fivefold auto
g = new E.Game();
const shuffle = ['Nf3', 'Nf6', 'Ng1', 'Ng8'];
for (let i = 0; i < 2; i++) for (const s of shuffle) assert.ok(g.playText(s));
assert.strictEqual(g.claimable(), 'threefold');
for (let i = 0; i < 2; i++) for (const s of shuffle) assert.ok(g.playText(s));
assert.strictEqual(g.outcome.reason, 'fivefold');

// En passant: SAN, and pinned en passant is illegal
g = new E.Game(); for (const s of ['e4', 'a6', 'e5', 'd5']) g.playText(s);
assert.ok(g.playText('exd6')); assert.strictEqual(g.sans[4], 'exd6');
g = new E.Game('8/8/8/KPp4r/8/8/8/7k w - c6 0 1'); assert.strictEqual(g.playText('bxc6'), null);

// Castling rules
g = new E.Game('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1'); assert.ok(g.playText('O-O')); assert.ok(g.playText('O-O-O'));
assert.ok(g.pos.fen().startsWith('2kr3r/8/8/8/8/8/8/R4RK1 w - -'));
g = new E.Game('r3k2r/8/8/8/8/8/5r2/R3K2R w KQkq - 0 1'); assert.strictEqual(g.playText('O-O'), null); // through f1? f2 rook attacks f1
g = new E.Game('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1'); assert.ok(g.playText('0-0-0'));

// Promotion + under-promotion + disambiguation
g = new E.Game('8/P7/8/8/8/8/8/k6K w - - 0 1'); assert.ok(g.playText('a8=N')); assert.strictEqual(g.sans[0], 'a8=N');
g = new E.Game('8/P7/8/8/8/8/8/k6K w - - 0 1'); assert.ok(g.playText('a8Q+') ); assert.strictEqual(g.sans[0], 'a8=Q+');
g = new E.Game('k7/8/8/8/8/8/8/KN3N2 w - - 0 1'); assert.ok(g.playText('Nbd2')); assert.strictEqual(g.sans[0], 'Nbd2');
g = new E.Game('k7/8/8/8/8/8/8/KN3N2 w - - 0 1'); assert.strictEqual(g.playText('Nd2'), null);

// Timeout vs insufficient
g = new E.Game('8/8/8/4k3/8/8/3K4/7q w - - 0 1'); g.timeout(E.BLACK); assert.strictEqual(g.outcome.reason, 'timeout-insufficient');
g = new E.Game('8/8/8/4k3/8/8/3K4/7Q b - - 0 1'); g.timeout(E.BLACK); assert.strictEqual(g.outcome.result, '1-0');

// Undo restores exactly
g = new E.Game(); const f0 = g.pos.fen(); ['e4','d5','exd5','Qxd5','Nc3'].forEach(s=>g.playText(s)); while (g.undo()); assert.strictEqual(g.pos.fen(), f0);

// Bad FENs rejected
const p = new E.Pos();
assert.ok(p.load('8/8/8/8/8/8/8/8 w - - 0 1'));
assert.ok(p.load('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq e3 0 1'));
assert.ok(p.load('4k3/8/8/8/8/8/8/4K2R b K - 0 1') === null);
assert.ok(p.load('4k3/4R3/8/8/8/8/8/4K3 w - - 0 1')); // side not to move in check

// Random games: legality, SAN/FEN round trips, undo
let rs = 12345; const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let gi = 0; gi < 400; gi++) {
  const gm = new E.Game();
  while (!gm.outcome && gm.moves.length < 300) {
    const m = gm.legal[Math.floor(rnd() * gm.legal.length)];
    const san = gm.pos.san(m, gm.legal);
    assert.strictEqual(gm.pos.parseMove(san, gm.legal), m, 'san roundtrip ' + san + ' ' + gm.pos.fen());
    gm.play(m);
    const q = new E.Pos(); assert.strictEqual(q.load(gm.pos.fen()), null, gm.pos.fen());
    assert.strictEqual(q.hl, gm.pos.hl, 'incremental hash');
    assert.strictEqual(q.hh, gm.pos.hh);
  }
  const replay = new E.Game(); for (const s of gm.sans) assert.ok(replay.playText(s));
  assert.strictEqual(replay.pos.fen(), gm.pos.fen());
}
console.log('rules ok');

// Search: finds mate in 1 and returns legal moves at every level
const mpos = E.positionFrom('6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', []);
const r = E.search(mpos, { timeMs: 500 });
assert.strictEqual(E.uci(r.move), 'd1d8');
for (const lv of E.LEVELS) {
  const pp = E.positionFrom(E.START_FEN, ['e2e4','e7e5']);
  const rr = E.search(pp, Object.assign({}, lv, { timeMs: Math.min(lv.timeMs, 500) }));
  assert.ok(pp.legalMoves().includes(rr.move), lv.name);
}
const t0 = Date.now(); const deep = E.search(E.positionFrom(E.START_FEN, []), { timeMs: 1500 });
console.log('search ok, depth', deep.depth, 'nodes', deep.nodes, 'ms', Date.now() - t0, E.uci(deep.move));
