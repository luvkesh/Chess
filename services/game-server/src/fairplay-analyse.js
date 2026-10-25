'use strict';
// Per-player engine agreement for one game: how often each side played the engine's first choice,
// and the average centipawn loss. Used only as a signal for human review, never to act on its own.
const ChacklateEngine = require('../../../packages/chess-core/src/engine.js');

const MATE_ZONE = 20000;

function analyse(ucis, opts) {
  opts = opts || {};
  const E = opts.E || ChacklateEngine();
  const depth = opts.depth || 6, timeMs = opts.timeMs || 1500;
  const skipPlies = opts.skipPlies == null ? 16 : opts.skipPlies;
  const g = new E.Game();
  // One search per position: score from the side to move, and the move it prefers.
  const evals = [];
  const at = () => { const r = E.search(g.pos, { depth, timeMs, quiesce: true }); return { best: r.move, score: r.score, legal: g.legal.length }; };
  evals.push(at());
  const played = [];
  for (const u of ucis) {
    const m = g.pos.parseMove(u, g.legal);
    if (m === null || m === undefined) break;
    played.push(m);
    g.play(m);
    evals.push(g.outcome ? { best: 0, score: 0, legal: 0, over: true } : at());
  }
  const side = { w: { n: 0, match: 0, loss: 0 }, b: { n: 0, match: 0, loss: 0 } };
  for (let i = 0; i < played.length; i++) {
    const before = evals[i], after = evals[i + 1];
    if (i < skipPlies || before.legal <= 1) continue;               // book moves and forced moves say nothing
    if (Math.abs(before.score) > 600 && Math.abs(before.score) < MATE_ZONE) continue;   // already decided
    if (Math.abs(before.score) >= MATE_ZONE) continue;
    const s = side[i % 2 === 0 ? 'w' : 'b'];
    s.n++;
    if (played[i] === before.best) s.match++;
    const afterScore = after.over ? 0 : after.score;
    s.loss += Math.max(0, Math.min(500, before.score + afterScore));
  }
  const out = {};
  for (const k of ['w', 'b']) out[k] = { moves: side[k].n, match: side[k].n ? side[k].match / side[k].n : 0, acpl: side[k].n ? side[k].loss / side[k].n : 0 };
  return out;
}

module.exports = { analyse };
