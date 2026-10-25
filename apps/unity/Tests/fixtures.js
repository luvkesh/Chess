// Writes reference data from the JavaScript rules (packages/chess-core) for the C# port to match:
// node apps/unity/Tests/fixtures.js > apps/unity/Tests/Chacklate.Core.Tests/fixtures.json
'use strict';
const E = require('../../../packages/chess-core/src/engine.js')();

let seed = 20261025;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const START = [
  E.START_FEN,
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',   // Kiwipete
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
  'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
  '4k3/8/8/2pP4/8/8/8/4K3 w - c6 0 2',
];
const games = [];
for (let n = 0; n < 40; n++) {
  const g = new E.Game(START[n % START.length]);
  const plies = [];
  for (let i = 0; i < 160 && !g.outcome; i++) {
    const sans = g.legal.map((m) => g.pos.san(m, g.legal)).sort();
    // Mostly random, sometimes the engine's quick choice, so games reach real endings.
    const m = rnd() < 0.3 ? E.search(g.pos, { depth: 1, timeMs: 1000 }).move : g.legal[Math.floor(rnd() * g.legal.length)];
    plies.push({ fen: g.pos.fen(), sans, uci: E.uci(m), san: g.pos.san(m, g.legal), reps: g.repetitions(), claim: g.claimable() });
    g.play(m);
  }
  games.push({ start: g.startFen, plies, end: { fen: g.pos.fen(), outcome: g.outcome, reps: g.repetitions(), claim: g.claimable(), sans: g.legal.map((m) => g.pos.san(m, g.legal)).sort() } });
}
process.stdout.write(JSON.stringify({ generated: 'packages/chess-core/src/engine.js', games }));
