// Fills in the engine's numbers for the three-phases lesson (packages/content/phases.json):
//   games[id].evals     the evaluation after every ply, in centipawns from White's side (mates as +-1000),
//                       drawn as the lesson's evaluation graph
//   games[id].accept    for each ply in games[id].predict, every move as good as the one actually
//                       played (that move first), so a guess that is genuinely as strong counts as right
//   beats[].accept      for each "find the move" question, every move as good as the best one
//   beats[].evalCp      for beats with eval: true, the evaluation of the position shown
// Only our own engine (engine.js) is used. Run again after changing a game or a position:
//   node packages/chess-core/tools/generate-phases.js
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E, {});

const file = path.join(__dirname, '../../content/phases.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const MS = +(process.env.MS || 900);
const clamp = (cp) => Math.max(-1000, Math.min(1000, cp));

// The score of `pos` for the side to move (centipawns, mates large).
function score(pos, ms) {
  const legal = pos.legalMoves();
  if (!legal.length) return pos.inCheck() ? -10000 : 0;
  return C.toCp(E.search(pos, { timeMs: ms, quiesce: true }).score);
}
// Every legal move with its score for the mover.
function rank(fen, ms) {
  const p = E.positionFrom(fen, []);
  return p.legalMoves().map((m) => {
    const san = p.san(m, p.legalMoves());
    p.make(m);
    const s = -score(p, ms);
    p.unmake();
    return { uci: E.uci(m), san, s };
  });
}
// As good as `ref`: within half a pawn, or a checkmate just as fast as the one played.
const MATE_CP = 9000;
const asGood = (s, ref) => (ref >= MATE_CP ? s >= ref : s >= ref - 50);

for (const [id, g] of Object.entries(data.games)) {
  const game = new E.Game(g.fen);
  const fens = [game.pos.fen()];
  for (const san of g.moves) { if (!game.playText(san)) throw new Error(id + ': illegal ' + san); fens.push(game.pos.fen()); }
  g.evals = fens.map((f) => { const p = E.positionFrom(f, []); return clamp(score(p, MS) * p.side); });
  g.accept = {};
  for (const ply of g.predict || []) {
    const all = rank(fens[ply], Math.round(MS / 2));
    const ref = all.find((x) => x.san === g.moves[ply]).s;
    g.accept[ply] = [all.find((x) => x.san === g.moves[ply]).uci].concat(all.filter((x) => x.san !== g.moves[ply] && asGood(x.s, ref)).map((x) => x.uci));
    console.log(id, 'ply', ply, g.moves[ply], 'accepts', g.accept[ply].join(' '));
  }
  console.log(id, 'evals', g.evals.join(' '));
}
for (const part of data.parts) for (const b of part.beats) {
  const fen = b.fen || (b.at && (() => { const gg = new E.Game(data.games[b.at.game].fen); for (const s of data.games[b.at.game].moves.slice(0, b.at.ply)) gg.playText(s); return gg.pos.fen(); })());
  if (b.ask === 'move') {
    const all = rank(fen, MS);
    const best = all.find((x) => x.san === b.best);
    if (!best) throw new Error(part.id + ': ' + b.best + ' is not legal');
    const top = Math.max(...all.map((x) => x.s));
    if (!asGood(best.s, top)) throw new Error(part.id + ': ' + b.best + ' is not the best move (' + best.s + ' < ' + top + ')');
    b.accept = [best.uci].concat(all.filter((x) => x !== best && asGood(x.s, best.s)).map((x) => x.uci));
    console.log(part.id, b.best, 'accepts', b.accept.join(' '));
  }
  if (b.eval) { const p = E.positionFrom(fen, []); b.evalCp = clamp(score(p, MS * 2) * p.side); }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
