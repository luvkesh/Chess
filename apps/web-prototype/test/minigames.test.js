// Mini-games: every board can be won, the hints and the bot play well, and the content they draw on
// is sound.
const assert = require('assert');
const E = require('../../../packages/chess-core/src/engine.js')();
const ChacklateMinis = require('../src/minigames.js');
const puzzles = require('../../../packages/content/puzzles.json');
const lessons = require('../../../packages/content/lessons.json').lessons;
const eras = require('../../../packages/content/campaign.json').eras;
const missions = require('../../../packages/content/missions.json');
const M = ChacklateMinis(E, { puzzles, lessons, eras });

// Exactly the six games asked for, each with art, a how-to card and a time.
assert.deepStrictEqual(M.GAMES.map((g) => g.id), ['tour', 'spotter', 'pawns', 'queen', 'memory', 'rush']);
for (const g of M.GAMES) assert(g.title && g.blurb && g.howTo.length >= 3 && g.minutes && g.art && g.colors.length === 2, g.id);
assert(missions.missions.some((m) => m.event === 'mini'));

// Knight's tour: following the hint completes the tour from every corner of every size.
for (const size of [5, 6, 8]) {
  for (const c of M.tourCorners(size)) {
    const v = [c];
    for (let s = c, n; (n = M.tourHint(s, v, size)) >= 0; s = n) v.push(n);
    assert.strictEqual(v.length, size * size, 'tour ' + size + ' from ' + M.name(c));
    assert.strictEqual(new Set(v).size, v.length);
  }
}
assert.deepStrictEqual(M.jumps(0).sort((a, b) => a - b), [10, 17]);

// Square spotter: twenty rounds, no square twice within six rounds, time that never runs too short.
const rounds = M.spotterRounds(5);
assert.strictEqual(rounds.length, M.SPOT_ROUNDS);
rounds.forEach((sq, i) => assert(!rounds.slice(Math.max(0, i - 6), i).includes(sq)));
for (let i = 0; i < M.SPOT_ROUNDS; i++) assert(M.spotTime('fast', i) >= 1.8 && M.spotTime('easy', i) >= 3);

// Pawn race: the breakthrough is won by b6! and the bot finds it; a wrong start only draws.
const br = M.PAWN_START.break();
const best = M.pawnBest(br);
assert.strictEqual(M.name(best.from) + M.name(best.to), 'b5b6');
let st = br;
for (let k = 0; k < 30 && M.pawnResult(st) === null; k++) st = M.pawnPlay(st, M.pawnBest(st));
assert.strictEqual(M.pawnResult(st), 1, 'white wins the breakthrough');
// en passant: a pawn that jumps two squares past an enemy pawn can be taken
const ep = M.pawnPlay({ w: [33], b: [48], side: -1, ep: -1 }, { from: 48, to: 32, dbl: true });
assert(M.pawnMoves(ep).some((m) => m.to === 40 && m.cap === 32));
assert.strictEqual(M.pawnResult({ w: [8], b: [16], side: 1, ep: -1 }), 0, 'blocked pawns draw');
assert.strictEqual(M.pawnResult({ w: [56], b: [16], side: -1, ep: -1 }), 1, 'a pawn on the last rank wins');
// The breakthrough can always be won: only b6 keeps the win, and the take-back check sees that.
assert.strictEqual(M.pawnWins(br), true);
for (const m of M.pawnMoves(br)) assert.strictEqual(M.pawnWins(M.pawnPlay(br, m)), M.name(m.to) === 'b6', 'only b6 keeps the win');
// Against the perfect defence, b6 and then the right follow-up always gets through.
for (const reply of M.pawnMoves(M.pawnPlay(br, best))) {
  let s2 = M.pawnPlay(M.pawnPlay(br, best), reply);
  for (let k = 0; k < 30 && M.pawnResult(s2) === null; k++) s2 = M.pawnPlay(s2, s2.side === 1 ? M.pawnBest(s2) : M.pawnBot(s2, 'break'));
  assert.strictEqual(M.pawnResult(s2), 1, 'b6 wins after ' + M.name(reply.from) + M.name(reply.to));
}
// The pawn war bot is beatable: a player who looks two moves ahead wins nearly every game, and
// even one who just grabs pawns wins some. (Seeded so the test never flickers.)
function war(pick, n, seed) {
  const r = M.rng(seed), rand = () => r.next();
  let wins = 0;
  for (let g = 0; g < n; g++) {
    let s3 = M.PAWN_START.war();
    for (let k = 0; k < 300 && M.pawnResult(s3) === null; k++) s3 = M.pawnPlay(s3, s3.side === 1 ? pick(s3, rand) : M.pawnBot(s3, 'war', rand));
    if (M.pawnResult(s3) === 1) wins++;
  }
  return wins;
}
assert(war((s3) => M.pawnBest(s3, 2), 20, 7) >= 17, 'careful play beats the pawn war bot');
const grab = (s3, rand) => { const ms = M.pawnMoves(s3), c = ms.filter((m) => m.cap !== undefined); const l = c.length ? c : ms; return l[Math.floor(rand() * l.length)]; };
assert(war(grab, 40, 11) >= 6, 'grabbing pawns wins sometimes');

// Queen's path: every board has a safe way through, of the promised length, from a safe start.
for (const level of ['easy', 'medium', 'hard']) {
  for (let seed = 1; seed <= 40; seed++) {
    const b = M.queenBoard(seed, level), att = M.guardAttacks(b.guards);
    assert(!att.has(b.queen) && b.queen < 8, level + ' ' + seed + ' starts safe on the first rank');
    assert(b.par >= 2 && b.par <= 5 && b.par === M.queenPar(b.queen, b.guards), level + ' ' + seed);
    assert(!b.guards.some(([sq]) => sq === b.queen));
  }
}
// a rook guards along its file up to the first piece in the way
const ga = M.guardAttacks([[E.to64(E.parseSq('d8')), 4], [E.to64(E.parseSq('d5')), 1]]);
assert(ga.has(E.to64(E.parseSq('d6'))) && !ga.has(E.to64(E.parseSq('d4'))));

// Memory board: real positions with both kings, of the asked size, and the check counts squares.
for (const n of [3, 6, 10]) {
  const pos = M.memoryPosition(n * 7, n);
  assert.strictEqual(pos.length, n);
  assert.strictEqual(pos.filter(([, p]) => Math.abs(p) === 6).length, 2);
}
const want = [[4, 6], [60, -6], [27, 5]];
assert.deepStrictEqual(M.memoryCheck(want, [[4, 6], [60, -6], [28, 5]]), { right: 2, wrong: 1, missing: 1, perfect: false });
assert(M.memoryCheck(want, want.slice()).perfect);

// Mate rush: every position in the pool is a checkmate in one, and there are plenty of them.
const pool = M.matePool();
assert(pool.length >= 30, 'pool has ' + pool.length);
for (const f of pool) assert(M.matingMoves(f).length > 0, f);
assert.strictEqual(M.mirrorFen(M.mirrorFen(E.START_FEN)).split(' ')[0], E.START_FEN.split(' ')[0]);

console.log('mini-games ok:', pool.length, 'mates in the rush');
