#!/usr/bin/env node
// Finds "checkmate in N" puzzles (N = 1..5) in engine self-play between a strong and a weak
// player. A position qualifies when the side to move has a forced mate in exactly N, no
// shorter one, and exactly one first move that mates within N. The line then follows the
// longest defence (STRICT=1: every later attacking move must also be the only one that mates in
// time). Proofs come from src/mates.js, an exact search, not from the engine's score.
// Output is in the puzzles.json shape: fen before the opponent's last move, then the moves.
//   node tools/generate-mates.js <seed> <games> > out.json
'use strict';
const E = require('../src/engine.js')();
const M = require('../src/mates.js')(E);

const seed0 = Number(process.argv[2] || 1);
const games = Number(process.argv[3] || 20);
const BUDGET = Number(process.env.BUDGET || 4e6);
const STRICT = process.env.STRICT === '1';
const MIN_N = Number(process.env.MIN_N || 1);
const MAX_N = Number(process.env.MAX_N || 5);   // MAX_N=1 collects mates in one quickly

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function selfPlay(rand) {
  const strong = E.LEVELS[3 + Math.floor(rand() * 2)], weak = E.LEVELS[Math.floor(rand() * 3)];
  const strongSide = rand() < 0.5 ? E.WHITE : E.BLACK;
  const g = new E.Game();
  while (!g.outcome && g.moves.length < 160) {
    const p = E.positionFrom(g.startFen, g.uciMoves());
    const lv = p.side === strongSide ? strong : weak;
    const r = E.search(p, Object.assign({}, lv, { random: rand, timeMs: Math.min(lv.timeMs, 120) }));
    if (!r.move) break;
    g.playText(E.uci(r.move));
  }
  return { start: g.startFen, moves: g.uciMoves() };
}

// Pieces other than kings and pawns, for both sides: a bare-king finish is not much of a puzzle.
function material(pos) {
  let w = 0, b = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = E.pieceAt(pos, sq);
    if (!p || Math.abs(p) === E.K) continue;
    if (p > 0) w++; else b++;
  }
  return { w, b };
}

function tryLine(pos, n) {
  const line = [];
  for (let k = n; k >= 1; k--) {
    const mates = M.matingMoves(pos, k, BUDGET);
    // The first move must be the only one; later moves may have twins (the game accepts any move
    // that still mates in time, checked by the same prover).
    if (!mates || !mates.length || (k === n && mates.length !== 1) || (STRICT && mates.length !== 1)) return null;
    const m = pos.parseMove(mates[0]);
    pos.make(m);
    line.push(mates[0]);
    if (k === 1) break;
    const d = M.longestDefence(pos, k - 1, BUDGET);
    if (!d || d.need !== k - 1) return null;
    pos.make(pos.parseMove(d.move));
    line.push(d.move);
  }
  return M.isMate(pos) ? line : null;
}

const rand = rng(seed0);
const out = [];
const seen = new Set();
const want = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
for (let gi = 0; gi < games; gi++) {
  const game = selfPlay(rand);
  let floor = 10;
  for (let i = 10; i < game.moves.length; i++) {
    let pos = E.positionFrom(game.start, game.moves.slice(0, i + 1));
    if (!pos.legalMoves().length) continue;
    const quick = E.search(pos, { timeMs: 60, quiesce: true });
    const mi = quick.score > E.MATE - 500 ? Math.ceil((E.MATE - quick.score) / 2) : 0;
    if (mi < 1) continue;
    // Walk back through the attacker's earlier turns while a mate in 5 or less was already there.
    let j = i, n = M.shortest(pos, MAX_N, BUDGET);
    if (!n) continue;
    while (j - 2 >= floor) {
      const back = E.positionFrom(game.start, game.moves.slice(0, j - 1));
      const nb = back.legalMoves().length ? M.shortest(back, MAX_N, BUDGET) : 0;
      if (!nb || nb <= n) break;
      j -= 2; n = nb;
    }
    floor = i + 1;
    if (j !== i) { i = j; pos = E.positionFrom(game.start, game.moves.slice(0, i + 1)); }
    const mat = material(pos);
    const att = pos.side === E.WHITE ? mat.w : mat.b, def = pos.side === E.WHITE ? mat.b : mat.w;
    if (n < MIN_N || att + def < 3 || (n >= 3 && def < 1)) continue;
    const before = E.positionFrom(game.start, game.moves.slice(0, i));
    const key = pos.fen().split(' ').slice(0, 2).join(' ');
    if (seen.has(key)) continue;
    const line = tryLine(E.positionFrom(game.start, game.moves.slice(0, i + 1)), n);
    if (!line) continue;
    seen.add(key);
    out.push({ fen: before.fen(), moves: [game.moves[i]].concat(line), themes: ['mateIn' + n], pieces: att + def });
    if (process.env.OUT_JSONL) require('fs').appendFileSync(process.env.OUT_JSONL, JSON.stringify(out[out.length - 1]) + '\n');
    process.stderr.write('mate in ' + n + ' (game ' + (gi + 1) + ')\n');
    i += 2 * n + 2;
  }
  M.clear();
  process.stderr.write('game ' + (gi + 1) + '/' + games + ': ' + out.length + '\n');
}
process.stdout.write(JSON.stringify(out));
