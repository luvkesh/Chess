#!/usr/bin/env node
// Generates tactics puzzles from engine self-play. A position qualifies when
// the opponent has just made a mistake and exactly one move wins: the best
// move scores at least 2 pawns better than every alternative. Solutions are
// extended while each solver move stays unique. Output is deterministic for a
// given seed: node tools/generate-puzzles.js <seed> <games> > out.json
'use strict';
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E);

const seed0 = Number(process.argv[2] || 1);
const games = Number(process.argv[3] || 20);
const THINK = Number(process.env.THINK || 600);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const cp = (r) => C.toCp(r.score);

function uniqueBest(pos) {
  const a = E.search(pos, { timeMs: THINK, quiesce: true });
  if (!a.move) return null;
  const legal = pos.legalMoves();
  if (legal.length < 2) return null;
  const b = E.search(pos, { timeMs: THINK, quiesce: true, exclude: [E.uci(a.move)] });
  const best = cp(a), second = cp(b);
  return { move: a.move, best, second, mate: C.mateIn(a.score) };
}

// Depth at which the engine first settles on the solution: a rough difficulty signal.
function findDepth(pos, move) {
  for (let d = 1; d <= 8; d++) {
    const r = E.search(pos, { depth: d, timeMs: 5000, quiesce: true });
    if (r.move === move) return d;
  }
  return 9;
}

function themesOf(f, mate) {
  const t = [];
  if (f.mate) t.push('mateIn1');
  else if (mate > 0) t.push('mateIn' + Math.min(mate, 3));
  if (f.forks.length) t.push('fork');
  if (f.pin) t.push('pin');
  if (f.skewer) t.push('skewer');
  if (f.discovered.length) t.push('discoveredAttack');
  if (f.promotion) t.push('promotion');
  if (f.sacrifice) t.push('sacrifice');
  if (!t.length && f.capture && f.capture >= 2) t.push('hangingPiece');
  if (!t.length) t.push('advantage');
  return t;
}

function tryPuzzle(game, i, solverBefore) {
  // Position after the opponent's move i (the blunder), solver to move.
  const before = E.positionFrom(game.start, game.moves.slice(0, i));
  const pos = E.positionFrom(game.start, game.moves.slice(0, i + 1));
  if (!pos.legalMoves().length) return null;
  const u = uniqueBest(pos);
  if (!u) return null;
  // Exactly one move wins: it gains at least 2.5 pawns and every other move gains little.
  const winning = u.mate > 0 || (u.best >= 250 && u.best >= solverBefore + 250);
  if (!winning || u.best - u.second < 200 || u.second > Math.max(150, solverBefore + 120)) return null;
  const solution = [E.uci(u.move)];
  const first = C.facts(pos, u.move);
  const depth = findDepth(pos, u.move);
  // Extend while the line stays forcing and unique (max 3 solver moves).
  pos.make(u.move);
  let realized = first.mate || (first.capture >= 2 && !first.check && !first.forks.length && !first.pin && !first.skewer);
  for (let k = 1; k < 3 && !realized && pos.legalMoves().length; k++) {
    const reply = E.search(pos, { timeMs: THINK, quiesce: true });
    if (!reply.move) break;
    pos.make(reply.move);
    const next = uniqueBest(pos);
    if (!next || next.best - next.second < 200) { pos.unmake(); break; }
    solution.push(E.uci(reply.move), E.uci(next.move));
    const nf = C.facts(pos, next.move);
    pos.make(next.move);
    realized = nf.mate || nf.capture >= 2;
  }
  if (!realized && solution.length === 1 && !(first.forks.length || first.pin || first.skewer || first.discovered.length || u.mate > 0)) return null;
  // A plain recapture after a trade is not a puzzle.
  const blunder = game.moves[i];
  if (solution.length === 1 && !first.mate && blunder.slice(2, 4) === solution[0].slice(2, 4) && !first.forks.length) return null;
  const moves = [blunder].concat(solution);
  const rating = Math.round(Math.min(2400, 500 + depth * 140 + (solution.length - 1) * 120 + (u.mate > 1 ? 120 : 0)) / 10) * 10;
  return { fen: before.fen(), moves, themes: themesOf(first, u.mate), rating };
}

function selfPlay(rand) {
  const levels = [E.LEVELS[0], E.LEVELS[1], E.LEVELS[2], E.LEVELS[3], E.LEVELS[2], E.LEVELS[3]];
  const g = new E.Game();
  // Random but sensible openings: a few noisy moves first.
  const start = g.startFen;
  while (!g.outcome && g.moves.length < 90) {
    const lv = levels[Math.floor(rand() * levels.length)];
    const p = E.positionFrom(start, g.uciMoves());
    const r = E.search(p, Object.assign({}, lv, { random: rand, timeMs: Math.min(lv.timeMs, 250) }));
    if (!r.move) break;
    g.playText(E.uci(r.move));
  }
  if (process.env.DEBUG) process.stderr.write(g.moves.length + " plies\n");
  return { start, moves: g.uciMoves() };
}

const rand = rng(seed0);
const out = [];
const seen = new Set();
for (let n = 0; n < games; n++) {
  const game = selfPlay(rand);
  // Quick evaluation of every position (side to move's view) to find blunders.
  const v = [];
  for (let k = 0; k <= game.moves.length; k++) {
    const p = E.positionFrom(game.start, game.moves.slice(0, k));
    v.push(p.legalMoves().length ? cp(E.search(p, { timeMs: 120, quiesce: true })) : 0);
  }
  for (let i = 8; i < game.moves.length - 1; i++) {
    const solverBefore = -v[i], solverAfter = v[i + 1];
    if (solverBefore > 250 || solverBefore < -400 || solverAfter - solverBefore < 220) continue;
    if (process.env.DEBUG) process.stderr.write("cand " + i + " " + solverBefore + " -> " + solverAfter + "\n");
    const p = tryPuzzle(game, i, solverBefore);
    if (!p) continue;
    const key = p.fen.split(' ').slice(0, 2).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
    i += 3; // avoid near-duplicates from the same sequence
  }
  process.stderr.write('game ' + (n + 1) + '/' + games + ': ' + out.length + ' puzzles\n');
}
process.stdout.write(JSON.stringify(out));
