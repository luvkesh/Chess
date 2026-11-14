#!/usr/bin/env node
// Finds practice positions for the skill trainers in engine self-play. Every position is
// scored by the engine from the side to move's point of view, then sorted into pools:
//   tactics     one move wins material or mates (the puzzle generator's rule)
//   advantage   already winning, and one move keeps the win cleanly
//   resource    worse or losing, and one move saves the game
//   defence     the opponent threatens something big, and one move stops it (also gives the threat)
//   safe        many tempting moves lose: any move near the best is fine (blunder prevention)
//   endgame     few pieces left, one clear best move
//   intuition   one best move and two plausible worse ones, to pick from quickly
//   mistake     a real slip from the game: the move played and the better moves
// Output: { pool: [items] } with fen (side to move solves), answers (UCI), and extras per pool.
//   node tools/generate-trainers.js <seed> <games> > out.json
'use strict';
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E);

const seed0 = Number(process.argv[2] || 1);
const games = Number(process.argv[3] || 10);
const THINK = Number(process.env.THINK || 220);

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const cp = (r) => C.toCp(r.score);

function selfPlay(rand) {
  // Mixed strengths: close games reach endgames, uneven ones give slips and tactics.
  const a = E.LEVELS[Math.floor(rand() * 5)], b = E.LEVELS[Math.floor(rand() * 5)];
  const g = new E.Game();
  while (!g.outcome && g.moves.length < 200) {
    const p = E.positionFrom(g.startFen, g.uciMoves());
    const lv = p.side === E.WHITE ? a : b;
    const r = E.search(p, Object.assign({}, lv, { random: rand, timeMs: Math.min(lv.timeMs, 150) }));
    if (!r.move) break;
    g.playText(E.uci(r.move));
  }
  return { start: g.startFen, moves: g.uciMoves() };
}

function pieces(pos) {
  let n = 0;
  for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(pos, sq); if (p && Math.abs(p) !== E.K) n++; }
  return n;
}
// How far the side to move is behind in material (pawns = 1, minor = 3, rook = 5, queen = 9).
function behind(pos) {
  const v = [0, 1, 3, 3, 5, 9, 0];
  let me = 0, them = 0;
  for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(pos, sq); if (!p) continue; if (Math.sign(p) === pos.side) me += v[Math.abs(p)]; else them += v[Math.abs(p)]; }
  return them - me;
}
// The same position with the other side to move: what would they do if it were their turn?
function passed(pos) {
  if (pos.inCheck()) return null;
  const f = pos.fen().split(' ');
  f[1] = f[1] === 'w' ? 'b' : 'w'; f[3] = '-';
  const p = new E.Pos();
  if (p.load(f.join(' '))) return null;
  if (p.inCheck()) return null; // the side that just "passed" would be capturing a king
  return p;
}
// Every legal move scored (from the mover's view), best first.
function scoreAll(pos, ms) {
  const out = [];
  for (const m of pos.legalMoves()) {
    pos.make(m);
    const r = pos.legalMoves().length ? E.search(pos, { timeMs: ms, quiesce: true }) : { score: pos.inCheck() ? -E.MATE : 0 };
    pos.unmake();
    out.push({ u: E.uci(m), m, cp: -cp(r) });
  }
  return out.sort((x, y) => y.cp - x.cp);
}

let rand = Math.random;
function classify(pos, last, played) {
  const legal = pos.legalMoves();
  if (legal.length < 3) return [];
  const a = E.search(pos, { timeMs: THINK, quiesce: true });
  const b = E.search(pos, { timeMs: THINK, quiesce: true, exclude: [E.uci(a.move)] });
  const best = cp(a), second = cp(b), bu = E.uci(a.move);
  const before = -cp(E.search(passed(pos) || pos, { timeMs: 120, quiesce: true })); // rough "if I pass"
  const out = [];
  const base = { fen: pos.fen(), last };
  const facts = C.facts(pos, a.move);
  const n = pieces(pos);
  if (C.mateIn(a.score) > 0 || Math.abs(best) > 3000) {
    if (best - second >= 300) out.push(Object.assign({ pool: 'tactics', answers: [bu] }, base));
    return out;
  }
  if (best >= 250 && best - second >= 200 && second < 200 && (facts.forks.length || facts.pin || facts.skewer || facts.discovered.length || facts.capture >= 2)) out.push(Object.assign({ pool: 'tactics', answers: [bu] }, base));
  if (second >= 150 && best >= 400 && best - second >= 180) out.push(Object.assign({ pool: 'advantage', answers: [bu] }, base));
  const p2 = passed(pos);
  const threat = p2 && E.search(p2, { timeMs: THINK, quiesce: true });
  const tgain = threat && threat.move ? cp(threat) : -99999;
  if (tgain >= 250 && -tgain <= best - 250 && best >= -150 && best - second >= 150) out.push(Object.assign({ pool: 'defence', answers: [bu], threat: E.uci(threat.move), threatGain: tgain }, base));
  else if ((best >= -100 && second <= -300) || (best >= -220 && best - second >= 250 && behind(pos) >= 2)) out.push(Object.assign({ pool: 'resource', answers: [bu] }, base));
  // the side to move must not be losing: a lost endgame has no move worth learning
  if (n <= 8 && best >= -150 && best - second >= 100 && Math.abs(best) < 2000) out.push(Object.assign({ pool: 'endgame', answers: [bu] }, base));
  // Safe moves and intuition need every move scored: only for promising positions.
  if (legal.length <= 40 && Math.abs(best) < 400 && (rand() < 0.35 || out.length)) {
    const all = scoreAll(pos, 35);
    const top = all[0].cp;
    const ok = all.filter((x) => x.cp >= top - 60);
    const traps = all.filter((x) => x.cp <= top - 250 && (E.mFlags(x.m) & E.F_CAP || (() => { pos.make(x.m); const c = pos.inCheck(); pos.unmake(); return c; })()));
    const losing = all.filter((x) => x.cp <= top - 250).length;
    if (Math.abs(top) < 300 && ok.length >= 1 && ok.length <= 4 && traps.length >= 2 && losing >= all.length * 0.5) out.push(Object.assign({ pool: 'safe', answers: ok.map((x) => x.u), traps: traps.slice(0, 3).map((x) => x.u) }, base));
    const worse = all.filter((x) => x.cp <= top - 150 && x.cp >= top - 700 && (E.mFlags(x.m) & E.F_CAP || (() => { pos.make(x.m); const c = pos.inCheck(); pos.unmake(); return c; })()));
    if (ok.length === 1 && worse.length >= 2 && top - (all[1] ? all[1].cp : -9999) >= 150) out.push(Object.assign({ pool: 'intuition', answers: [ok[0].u], options: [ok[0].u, worse[0].u, worse[1].u] }, base));
    if (played && played !== ok[0].u && !ok.some((x) => x.u === played)) {
      const pl = all.find((x) => x.u === played);
      if (pl && pl.cp <= top - 220 && ok.length <= 3) out.push(Object.assign({ pool: 'mistake', answers: ok.map((x) => x.u), played }, base));
    }
  }
  void before;
  return out;
}

rand = rng(seed0);
const out = [];
const seen = new Set();
for (let gi = 0; gi < games; gi++) {
  const game = selfPlay(rand);
  for (let i = 8; i < game.moves.length - 1; i++) {
    const pos = E.positionFrom(game.start, game.moves.slice(0, i + 1));
    const key = pos.fen().split(' ').slice(0, 2).join(' ');
    if (seen.has(key)) continue;
    let items;
    try { items = classify(pos, game.moves[i], game.moves[i + 1]); } catch (e) { continue; }
    if (!items.length) continue;
    seen.add(key);
    for (const it of items) { out.push(it); if (process.env.OUT_JSONL) require('fs').appendFileSync(process.env.OUT_JSONL, JSON.stringify(it) + '\n'); }
  }
  const c = {};
  for (const it of out) c[it.pool] = (c[it.pool] || 0) + 1;
  process.stderr.write('game ' + (gi + 1) + '/' + games + ' ' + JSON.stringify(c) + '\n');
}
process.stdout.write(JSON.stringify(out));
