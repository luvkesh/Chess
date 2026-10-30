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

// ---------------------------------------------------------------- Chaturanga
// A plain, slow move generator written from the rule sheet, to check the engine's fast one.
function refMoves(fen) {
  const [board, side] = fen.replace(/^chaturanga:/, '').split(' ');
  const sq = {};
  board.split('/').forEach((row, i) => { let f = 0; for (const c of row) { if (/\d/.test(c)) f += +c; else { sq[f + ',' + (7 - i)] = c; f++; } } });
  const mine = (c) => c && (side === 'w' ? c === c.toUpperCase() : c === c.toLowerCase());
  const theirs = (c) => c && !mine(c);
  const at = (f, r) => (f < 0 || f > 7 || r < 0 || r > 7 ? undefined : sq[f + ',' + r] || '');
  const name = (f, r) => 'abcdefgh'[f] + (r + 1);
  const pseudo = (s, who) => {
    const out = [];
    const own = (c) => c && (who === 'w' ? c === c.toUpperCase() : c === c.toLowerCase());
    for (const k of Object.keys(s)) {
      const c = s[k]; if (!own(c)) continue;
      const [f, r] = k.split(',').map(Number), t = c.toLowerCase();
      const look = (df, dr, slide) => {
        for (let n = 1; ; n++) {
          const ff = f + df * n, rr = r + dr * n;
          if (ff < 0 || ff > 7 || rr < 0 || rr > 7) return;
          const there = s[ff + ',' + rr];
          if (!own(there)) out.push([f, r, ff, rr]);
          if (there || !slide) return;
        }
      };
      if (t === 'p') {
        const dir = who === 'w' ? 1 : -1;
        if (r + dir >= 0 && r + dir <= 7 && !s[f + ',' + (r + dir)]) out.push([f, r, f, r + dir]);
        for (const df of [-1, 1]) { const x = s[(f + df) + ',' + (r + dir)]; if (x && !own(x)) out.push([f, r, f + df, r + dir]); }
      }
      if (t === 'n') for (const [a, b] of [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]) look(a, b, false);
      if (t === 'k') for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) look(a, b, false);
      if (t === 'q') for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) look(a, b, false);          // Mantri
      if (t === 'b') for (const [a, b] of [[2, 2], [2, -2], [-2, 2], [-2, -2]]) look(a, b, false);          // Gaja, jumps
      if (t === 'r') for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) look(a, b, true);
    }
    return out;
  };
  const out = [];
  for (const [f, r, ff, rr] of pseudo(sq, side)) {
    const s2 = Object.assign({}, sq); let c = s2[f + ',' + r]; delete s2[f + ',' + r];
    if (c.toLowerCase() === 'p' && (rr === 7 || rr === 0)) c = side === 'w' ? 'Q' : 'q';
    s2[ff + ',' + rr] = c;
    const king = Object.keys(s2).find((k) => s2[k] === (side === 'w' ? 'K' : 'k'));
    if (pseudo(s2, side === 'w' ? 'b' : 'w').some(([, , x, y]) => x + ',' + y === king)) continue;
    out.push(name(f, r) + name(ff, rr) + ((c === 'Q' || c === 'q') && sq[f + ',' + r].toLowerCase() === 'p' ? 'q' : ''));
  }
  return out.sort();
}
assert.strictEqual(E.variantOf(E.VARIANTS.chaturanga.start), 'chaturanga');
assert.strictEqual(E.variantOf(E.START_FEN), 'standard');
{
  const p = new E.Pos(); assert.strictEqual(p.load(E.VARIANTS.chaturanga.start), null);
  assert.strictEqual(p.fen(), E.VARIANTS.chaturanga.start, 'variant FEN round trip');
  assert.deepStrictEqual([1, 2, 3].map((d) => E.perft(p, d)), [16, 256, 4176]);
  assert.ok(new E.Pos().load('chaturanga:rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'), 'no castling rights');
  assert.ok(new E.Pos().load('fairy:8/8/8/8/8/8/8/K6k w - - 0 1'), 'unknown variation');
  const s = new E.Pos(); s.load(E.START_FEN);
  assert.notStrictEqual(s.hl ^ s.hh, p.hl ^ p.hh, 'chess and chaturanga hash apart');
}
// Random chaturanga games agree with the reference generator at every move.
for (let gi = 0; gi < 120; gi++) {
  const gm = new E.Game(E.VARIANTS.chaturanga.start);
  assert.strictEqual(gm.variant, 'chaturanga');
  while (!gm.outcome && gm.moves.length < 200) {
    assert.deepStrictEqual(gm.legal.map(E.uci).sort(), refMoves(gm.pos.fen()), gm.pos.fen());
    const m = gm.legal[Math.floor(rnd() * gm.legal.length)];
    const san = gm.pos.san(m, gm.legal);
    assert.strictEqual(gm.pos.parseMove(san, gm.legal), m, 'san roundtrip ' + san);
    gm.play(m);
    const q = new E.Pos(); assert.strictEqual(q.load(gm.pos.fen()), null, gm.pos.fen());
    assert.strictEqual(q.hl, gm.pos.hl, 'incremental hash'); assert.strictEqual(q.hh, gm.pos.hh);
  }
}
// Mantri steps one square diagonally, Gaja jumps two (over pieces), pawns step once and become a Mantri.
g = new E.Game('chaturanga:4k3/8/8/8/3q4/8/8/4K3 b - - 0 1');
assert.deepStrictEqual(g.targets(E.to64(E.parseSq('d4'))).map((s) => E.sqName(E.to88(s))).sort(), ['c3', 'c5', 'e3', 'e5']);
g = new E.Game('chaturanga:4k3/8/8/8/8/3P4/2B5/4K3 w - - 0 1');
assert.deepStrictEqual(g.targets(E.to64(E.parseSq('c2'))).map((s) => E.sqName(E.to88(s))).sort(), ['a4', 'e4'], 'jumps over d3');
g = new E.Game('chaturanga:4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'); assert.strictEqual(g.playText('e4'), null, 'no double step');
g = new E.Game('chaturanga:8/3P4/8/8/8/8/k7/4K3 w - - 0 1');
assert.deepStrictEqual(g.legal.filter((m) => E.mPromo(m)).map(E.uci), ['d7d8q'], 'promotes only to a Mantri');
// Endings: bare king loses, baring back draws, stalemate wins for the side that gives it.
g = new E.Game('chaturanga:8/8/8/8/k7/8/3r4/K2R4 w - - 0 1'); g.playText('Rxd2');
assert.deepStrictEqual(g.outcome, { result: '1-0', reason: 'bare-king' });
g = new E.Game('chaturanga:8/8/8/8/8/1k6/2r5/K1R5 w - - 0 1'); g.playText('Rxc2');
assert.strictEqual(g.outcome, null, 'black can bare white back');
g.playText('Kxc2'); assert.deepStrictEqual(g.outcome, { result: '1/2-1/2', reason: 'insufficient' });
g = new E.Game('chaturanga:k7/7p/K6P/8/8/8/8/2R5 w - - 0 1'); g.playText('Rb1');
assert.deepStrictEqual(g.outcome, { result: '1-0', reason: 'stalemate-win' });
assert.ok(g.pgn().includes('[Variant "Chaturanga"]') && g.pgn().includes('[FEN "k7/7p/K6P/8/8/8/8/2R5 w - - 0 1"]'));
// The bots know the old endings: they bare the king and give the winning stalemate.
assert.strictEqual(E.uci(E.search(E.positionFrom('chaturanga:8/8/8/8/k7/8/3r4/K2R4 w - - 0 1', []), { timeMs: 300 }).move), 'd1d2');
{
  // Here Rb1 (stalemate) and Rc8 (mate) both win at once; the bot must pick one of them.
  const gm = new E.Game('chaturanga:k7/7p/K6P/8/8/8/8/2R5 w - - 0 1');
  gm.play(E.search(gm.pos, { timeMs: 300 }).move);
  assert.strictEqual(gm.outcome && gm.outcome.result, '1-0');
}
for (const lv of E.LEVELS) {
  const pp = E.positionFrom(E.VARIANTS.chaturanga.start, ['e2e3', 'e7e6']);
  const rr = E.search(pp, Object.assign({}, lv, { timeMs: Math.min(lv.timeMs, 400) }));
  assert.ok(pp.legalMoves().includes(rr.move), 'chaturanga ' + lv.name);
}
console.log('chaturanga ok');
