#!/usr/bin/env node
// Endgame practice positions for the End Game trainer: kings and a few pieces placed at random
// (legal, nobody in check), kept when one move is clearly best: it scores at least 1.5 pawns
// better than any other and leaves the side to move better off. Some material sets are draws to
// hold (the best move is the only one that does not lose).
//   node tools/generate-endgames.js <seed> <count> > out.json
'use strict';
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E);

const seed0 = Number(process.argv[2] || 1);
const want = Number(process.argv[3] || 40);
const THINK = Number(process.env.THINK || 400);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const rand = rng(seed0);
// White's pieces / Black's pieces besides the kings.
const SETS = [['P', ''], ['PP', 'P'], ['RP', 'R'], ['R', 'P'], ['RPP', 'RP'], ['BP', ''], ['NP', 'P'], ['QP', 'Q'], ['Q', 'R'], ['PPP', 'PP'], ['BPP', 'B'], ['RP', 'B'], ['NPP', 'N']];
function place() {
  const set = SETS[Math.floor(rand() * SETS.length)];
  const flip = rand() < 0.5;
  const [w, b] = flip ? [set[1], set[0]] : set;
  const board = Array(64).fill('');
  const free = () => { for (;;) { const s = Math.floor(rand() * 64); if (!board[s]) return s; } };
  board[free()] = 'K'; board[free()] = 'k';
  for (const [pcs, lower] of [[w, false], [b, true]]) for (const ch of pcs) {
    let s;
    do { s = free(); } while (ch === 'P' && (s < 8 || s >= 56));
    board[s] = lower ? ch.toLowerCase() : ch;
  }
  let fen = '';
  for (let r = 0; r < 8; r++) {
    let e = 0;
    for (let f = 0; f < 8; f++) { const c = board[r * 8 + f]; if (!c) e++; else { if (e) fen += e; e = 0; fen += c; } }
    if (e) fen += e;
    if (r < 7) fen += '/';
  }
  return fen + ' ' + (rand() < 0.5 ? 'w' : 'b') + ' - - 0 1';
}
const cp = (r) => C.toCp(r.score);
const out = [];
const seen = new Set();
let tries = 0;
while (out.length < want && tries < want * 400) {
  tries++;
  const fen = place();
  const pos = new E.Pos();
  if (pos.load(fen)) continue;
  // the side not to move must not be in check
  const f2 = fen.split(' '); f2[1] = f2[1] === 'w' ? 'b' : 'w';
  const q = new E.Pos(); if (q.load(f2.join(' ')) || q.inCheck()) continue;
  if (pos.inCheck() || pos.legalMoves().length < 3) continue;
  const quick = E.search(pos, { timeMs: 40, quiesce: true });
  if (Math.abs(cp(quick)) > 1500) continue;   // already decided (a free queen and so on)
  const a = E.search(pos, { timeMs: THINK, quiesce: true });
  const b = E.search(pos, { timeMs: THINK, quiesce: true, exclude: [E.uci(a.move)] });
  const best = cp(a), second = cp(b);
  const win = best >= 150 && best < 3000 && best - second >= 150;
  const hold = best >= -40 && second <= -200;
  if (!win && !hold) continue;
  // a capture of a loose piece is not much of an endgame lesson
  if (E.mFlags(a.move) & E.F_CAP) continue;
  const key = fen.split(' ').slice(0, 2).join(' ');
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({ pool: 'endgame', fen, answers: [E.uci(a.move)], goal: win ? 'win' : 'hold', best, second });
  process.stderr.write(out.length + ' ' + fen + ' ' + E.uci(a.move) + '\n');
}
process.stdout.write(JSON.stringify(out));
