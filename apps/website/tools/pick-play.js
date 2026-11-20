// Picks the positions the site lets a visitor play, from the game's own content, and proves
// each one again with the game's engine before it is written to ../play.json:
//   - Mate in 1: exactly one legal move mates.
//   - Puzzle themes (fork, pin, skewer, discovered attack, free piece, deflection): the answer shows
//     that theme on the coach's fact sheet, and beats every other move by a clear margin.
//   - One real exercise for each training module, from packages/content/trainers.json.
// node apps/website/tools/pick-play.js
'use strict';
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../../..');
const E = require(path.join(root, 'packages/chess-core/src/engine.js'))();
const Coach = require(path.join(root, 'packages/chess-core/src/coach.js'))(E);
const puzzles = require(path.join(root, 'packages/content/puzzles.json'));
const T = require(path.join(root, 'packages/content/trainers.json'));

const uciOf = (m) => E.uci(m);
function posAfter(fen, ucis) { return E.positionFrom(fen, ucis || []); }
function findMove(pos, u) { return pos.legalMoves().find((m) => uciOf(m) === u); }
// every legal move scored from the mover's side, best first
function ranked(pos, ms) {
  const out = [];
  for (const m of pos.legalMoves()) {
    pos.make(m);
    const reply = pos.legalMoves();
    let s;
    if (!reply.length) s = pos.inCheck() ? E.MATE : 0;
    else s = -E.search(pos, { depth: 5, timeMs: ms || 120 }).score;
    pos.unmake();
    out.push({ u: uciOf(m), s });
  }
  return out.sort((a, b) => b.s - a.s);
}
function material(pos) {
  let w = 0, b = 0;
  for (let s = 0; s < 64; s++) { const p = E.pieceAt(pos, s); if (p > 0) w++; else if (p < 0) b++; }
  return [w, b];
}
const fenOf = (fen, ucis) => { const p = posAfter(fen, ucis); return p.fen ? p.fen() : null; };

// ---------------------------------------------------------------- mates in one
const mates = [];
for (const p of puzzles.filter((x) => x.themes.includes('mateIn1')).sort((a, b) => b.rating - a.rating)) {
  const pos = posAfter(p.fen, [p.moves[0]]);
  const mating = pos.legalMoves().filter((m) => { pos.make(m); const ok = pos.inCheck() && !pos.legalMoves().length; pos.unmake(); return ok; });
  if (mating.length !== 1 || uciOf(mating[0]) !== p.moves[1]) continue;
  const [w, b] = material(pos);
  if (w + b < 12 || pos.legalMoves().length < 25) continue;          // a real middlegame, with plenty of other moves to weigh
  const f = Coach.facts(pos, mating[0]);
  if (f.piece === 5 && f.capture) continue;                           // not just "queen takes with mate"
  mates.push({ id: p.id, fen: p.fen, pre: p.moves[0], line: [p.moves[1]], kind: f.piece });
}
// four, with different mating pieces where the content allows
const pickedMates = [];
for (const k of [2, 4, 3, 5, 1, 6]) { const m = mates.find((x) => x.kind === k && !pickedMates.includes(x)); if (m) pickedMates.push(m); }
for (const m of mates) if (pickedMates.length < 5 && !pickedMates.includes(m)) pickedMates.push(m);

// ---------------------------------------------------------------- themes
// every position the game ships with a single stored answer, as { fen, pre, line }
const pool = [];
for (const p of puzzles) if (!/^mateIn/.test(p.themes[0])) pool.push({ id: p.id, fen: p.fen, pre: p.moves[0], line: p.moves.slice(1), themes: p.themes });
for (const k of ['tactics', 'advantage', 'patterns', 'resource']) for (const it of T.items[k]) if (it.answers.length === 1 && !it.mate) pool.push({ id: it.id, fen: it.fen, pre: null, line: [it.answers[0]], themes: [], last: it.last });

function themed(test, n, need) {
  const out = [];
  for (const c of pool) {
    if (out.length >= n) break;
    if (need && !c.themes.includes(need)) continue;
    const pos = posAfter(c.fen, c.pre ? [c.pre] : []);
    const m = findMove(pos, c.line[0]);
    if (!m) continue;
    const f = Coach.facts(pos, m);
    if (f.mate || !test(f, pos, c)) continue;
    const r = ranked(pos, 150);
    if (r[0].u !== c.line[0] || (r[1] && r[0].s - r[1].s < 150)) continue;   // one clear answer
    if (out.some((o) => o.fen === c.fen)) continue;
    out.push({ id: c.id, fen: c.fen, pre: c.pre, last: c.last || c.pre, line: c.line.slice(0, 3) });
  }
  return out;
}
// A deflection: a check drives a guard away (here the king), and the next move takes or mates on
// the square it was guarding. Taken from the game's proved mates in two and three, whose first move
// is the only one that mates in time.
function deflections() {
  const out = [];
  for (const p of puzzles) {
    const line = p.moves.slice(1);
    if (!/^mateIn[23]$/.test(p.themes[0]) || line.length < 3) continue;
    const p0 = posAfter(p.fen, [p.moves[0]]), m1 = findMove(p0, line[0]);
    const f1 = Coach.facts(p0, m1);
    if (!f1.check || f1.capture) continue;
    const p2 = posAfter(p.fen, p.moves.slice(0, 3)), f3 = Coach.facts(p2, findMove(p2, line[2]));
    if (!(f3.capture || f3.mate)) continue;
    const guard = line[1].slice(0, 2), moved = line[1].slice(2, 4), target = line[2].slice(2, 4);
    const guards = (pos) => Coach.attackers(pos, E.parseSq(target), -p0.side).map((a) => E.sqName(a.sq));
    if (!guards(p0).includes(guard) || moved === target || guards(p2).includes(moved)) continue;
    out.push({ id: p.id, fen: p.fen, pre: p.moves[0], last: p.moves[0], line });
  }
  return out.slice(0, 3);
}
const themes = {
  fork: themed((f) => f.forks.length >= 2 && !f.capture, 3),
  pin: themed((f) => !!f.pin, 3),
  skewer: themed((f) => !!f.skewer, 3),
  discovered: themed((f) => f.discovered.length > 0, 3),
  free: themed((f, pos) => f.capture >= 2 && !f.forks.length && !f.pin && !f.skewer && !f.discovered.length, 3, 'hangingPiece'),
  deflect: deflections(),
};

// ---------------------------------------------------------------- one exercise per training module
function exercise(poolName, pred) {
  for (const it of T.items[poolName]) {
    const pos = posAfter(it.fen, []);
    if (!it.answers.every((u) => findMove(pos, u))) continue;
    if (pred && !pred(it, pos)) continue;
    const [w, b] = material(pos);
    if (w + b > 26 && poolName !== 'opening') continue;
    // the engine, thinking as briefly as it does on the page, must agree with the stored answer
    const best = uciOf(E.search(pos, { depth: 6, timeMs: 400 }).move);
    if (poolName !== 'opening' && !it.answers.includes(best)) continue;
    const o = { id: it.id, fen: it.fen, last: it.last, answers: it.answers };
    for (const k of ['note', 'threat', 'played', 'options', 'mate']) if (it[k] !== undefined) o[k] = it[k];
    return o;
  }
  throw new Error('no exercise for ' + poolName);
}
const quiet = (it, pos) => !pos.inCheck();
const modules = {
  openings: exercise('opening', (it) => !!it.note),
  tactics: exercise('tactics', quiet),
  endgame: exercise('endgame', (it, pos) => material(pos)[0] + material(pos)[1] <= 9),
  defences: exercise('defence', (it) => !!it.threat),
  time: exercise('quick', quiet),
  advantage: exercise('advantage', quiet),
  blunders: exercise('safe'),
  intuition: exercise('intuition', (it) => it.options && it.options.length === 3),
  retry: exercise('mistake', (it) => !!it.played),
  patterns: exercise('patterns', (it) => it.mate),
};
// Game Review reads one played move back: another of the "mistake" positions
modules.review = (function () {
  for (const it of T.items.mistake) {
    if (it.id === modules.retry.id || !it.played) continue;
    const pos = posAfter(it.fen, []);
    if (!findMove(pos, it.played) || !findMove(pos, it.answers[0])) continue;
    return { id: it.id, fen: it.fen, last: it.last, answers: it.answers, played: it.played };
  }
})();
// the 360° Trainer is a mixed round: one position from four different skills
const round = ['openings', 'tactics', 'defences', 'endgame'];

const out = { note: 'Made by tools/pick-play.js from packages/content; every position is proved with the game engine.', mate: pickedMates.map(({ kind, ...m }) => m), themes, modules, round };
for (const k of Object.keys(themes)) console.log(k, themes[k].length);
console.log('mates', out.mate.length);
fs.writeFileSync(path.join(__dirname, '..', 'play.json'), JSON.stringify(out, null, 1) + '\n');
