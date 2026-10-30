// Chackmate mini-games: six short games that each train one real chess skill. This file holds
// the rules, the boards they are played on and the bot for the pawn race, as pure functions over
// square numbers (0 = a1, 7 = h1, 63 = h8), so they are tested in Node. app.js draws them on the
// 3D table and pays for them through progress.js. They never touch a rating.
function ChacklateMinis(E, content) {
  'use strict';
  content = content || {};
  const file = (sq) => sq & 7, rank = (sq) => sq >> 3, at = (f, r) => (f < 0 || f > 7 || r < 0 || r > 7 ? -1 : r * 8 + f);
  const name = (sq) => 'abcdefgh'[file(sq)] + (rank(sq) + 1);

  // A small seeded random number generator, so a round can be replayed and tested.
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    return { next, int: (n) => Math.floor(next() * n), pick: (list) => list[Math.floor(next() * list.length)],
      shuffle(list) { const o = list.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; } };
  }

  // ------------------------------------------------------------ the games
  // minutes is what a round takes; levels are offered on the start card (the first is the default).
  const GAMES = [
    { id: 'tour', title: "Knight's Tour", art: 'tour', colors: ['#2f6f6a', '#123634'], minutes: '2–3 min', skill: 'Knight moves',
      blurb: 'Hop the knight onto every square once. Plan ahead so you never get stuck.',
      howTo: ['Your knight starts in a corner. Tap a glowing square to jump there.', 'A knight jumps in an L: two squares one way, then one to the side.', 'Each square counts once. Squares you have visited turn gold.', 'Visit every square to finish the tour. Tip: jump to the square with the fewest ways out.'],
      levels: [['5', 'Small · 5×5'], ['6', 'Medium · 6×6'], ['8', 'Full board']] },
    { id: 'spotter', title: 'Square Spotter', art: 'spotter', colors: ['#1f4f8a', '#0c2142'], minutes: '1–2 min', skill: 'Board names',
      blurb: 'A square name appears, like e4. Tap that square before the light runs out.',
      howTo: ['A square name appears, like e4. Find it and tap it.', 'Tap before the gold light around the name runs out.', 'The board turns around every round, so read the letters and numbers carefully.', 'Three misses and the round is over. Quick taps score extra.'],
      levels: [['easy', 'Gentle'], ['fast', 'Speedy']] },
    { id: 'pawns', title: 'Pawn Race', art: 'pawns', colors: ['#8a5a2a', '#3a1e0e'], minutes: '1–3 min', skill: 'Pawn breakthroughs',
      blurb: 'Only pawns are left. Be the first to reach the far side and make a queen.',
      howTo: ['Only pawns are on the board. Pawns move forward and capture diagonally.', 'Get one of your pawns to the far side first and you win.', 'In the Breakthrough, three pawns face three. There is a clever way through. Can you find it?', 'If nobody can move, it is a draw.'],
      levels: [['break', 'Breakthrough'], ['war', 'Pawn war']] },
    { id: 'queen', title: "Queen's Path", art: 'queen', colors: ['#5b4a8a', '#241a44'], minutes: '2–3 min', skill: 'Safe squares',
      blurb: 'Steer the queen to the far side without stopping on a guarded square.',
      howTo: ['Your queen starts on the first row. Move her to any square on the last row.', 'Black guards never move, and cannot be taken.', 'Never stop on a square a guard attacks. The queen can pass over it on the way.', 'Fewer moves score more. Five boards in a round.'],
      levels: [['easy', 'Four guards'], ['medium', 'Six guards'], ['hard', 'Eight guards']] },
    { id: 'memory', title: 'Memory Board', art: 'memory', colors: ['#3a2a6a', '#140c30'], minutes: '2–3 min', skill: 'Seeing the board',
      blurb: 'Look at a position for five seconds. Then put every piece back where it was.',
      howTo: ['Look closely: the position disappears after five seconds.', 'Then pick a piece from the tray and tap the square where it stood.', 'Tap a piece on the board to take it off again.', 'Tap Check when you are done. Five positions, a little bigger each time.'],
      levels: [['easy', 'Starter'], ['medium', 'Sharp'], ['hard', 'Photographic']] },
    { id: 'rush', title: 'Mate Rush', art: 'rush', colors: ['#a3294f', '#3a0616'], minutes: '1 min', skill: 'Checkmate in one',
      blurb: 'Sixty seconds. Find as many checkmates in one move as you can.',
      howTo: ['Each board has a checkmate in one move. Find it!', 'Drag or tap your piece to make the move.', 'Not a mate? The next board comes up anyway, so keep going.', 'You have sixty seconds. Every mate scores.'],
      levels: [] },
  ];
  const game = (id) => GAMES.find((g) => g.id === id) || null;

  // ------------------------------------------------------------ knight's tour
  const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const jumps = (sq) => KNIGHT.map(([df, dr]) => at(file(sq) + df, rank(sq) + dr)).filter((s) => s >= 0);
  // The tour is played on the size × size corner of the board from a1.
  const tourRegion = (size) => { const out = []; for (let r = 0; r < size; r++) for (let f = 0; f < size; f++) out.push(at(f, r)); return out; };
  const inRegion = (sq, size) => file(sq) < size && rank(sq) < size;
  function tourMoves(sq, visited, size) { return jumps(sq).filter((s) => inRegion(s, size) && !visited.includes(s)); }
  // Warnsdorff's rule: go where there are the fewest ways on. It is the hint, and it finishes
  // tours from every corner on these boards.
  function tourHint(sq, visited, size) {
    let best = -1, fewest = 9;
    for (const s of tourMoves(sq, visited, size)) {
      const n = tourMoves(s, visited.concat(s), size).length;
      if (n < fewest || (n === fewest && s < best)) { fewest = n; best = s; }
    }
    return best;
  }
  const tourCorners = (size) => [at(0, 0), at(size - 1, 0), at(0, size - 1), at(size - 1, size - 1)];
  const tourScore = (visited, size, used) => Math.max(0, visited * 4 + (visited === size * size ? 50 : 0) - (used.undos || 0) * 2 - (used.hints || 0) * 3);

  // ------------------------------------------------------------ square spotter
  // Each round names a square nobody asked for in the last few rounds, and the board turns round.
  const SPOT_ROUNDS = 20, SPOT_LIVES = 3;
  function spotterRounds(seed) {
    const r = rng(seed), out = [];
    while (out.length < SPOT_ROUNDS) { const sq = r.int(64); if (!out.slice(-6).includes(sq)) out.push(sq); }
    return out;
  }
  // Seconds to answer: generous at first, a little quicker each round.
  const spotTime = (level, i) => level === 'fast' ? Math.max(1.8, 4 - i * 0.12) : Math.max(3, 6 - i * 0.15);
  const spotPoints = (left, limit) => 10 + Math.round(5 * Math.max(0, Math.min(1, left / limit)));

  // ------------------------------------------------------------ pawn race
  // Pawns only. A position is { w: [squares], b: [squares], side: 1 | -1, ep: square or -1 }.
  // A pawn on the last rank wins; a side with no pawns loses; a side with no move draws.
  const PAWN_START = {
    break: () => ({ w: [at(0, 4), at(1, 4), at(2, 4)], b: [at(0, 6), at(1, 6), at(2, 6)], side: 1, ep: -1 }),
    war: () => ({ w: [0, 1, 2, 3, 4, 5, 6, 7].map((f) => at(f, 1)), b: [0, 1, 2, 3, 4, 5, 6, 7].map((f) => at(f, 6)), side: 1, ep: -1 }),
  };
  function pawnMoves(st) {
    const mine = st.side === 1 ? st.w : st.b, theirs = st.side === 1 ? st.b : st.w, dir = st.side;
    const occ = new Set(st.w.concat(st.b)), out = [];
    for (const s of mine) {
      const f = file(s), r = rank(s), one = at(f, r + dir);
      if (one >= 0 && !occ.has(one)) {
        out.push({ from: s, to: one });
        const two = at(f, r + 2 * dir);
        if ((dir === 1 ? r === 1 : r === 6) && !occ.has(two)) out.push({ from: s, to: two, dbl: true });
      }
      for (const df of [-1, 1]) {
        const t = at(f + df, r + dir);
        if (t < 0) continue;
        if (theirs.includes(t)) out.push({ from: s, to: t, cap: t });
        else if (t === st.ep) out.push({ from: s, to: t, cap: at(f + df, r) });
      }
    }
    return out;
  }
  function pawnPlay(st, m) {
    const w = st.w.slice(), b = st.b.slice();
    const mine = st.side === 1 ? w : b, theirs = st.side === 1 ? b : w;
    mine[mine.indexOf(m.from)] = m.to;
    if (m.cap !== undefined) theirs.splice(theirs.indexOf(m.cap), 1);
    return { w, b, side: -st.side, ep: m.dbl ? (m.from + m.to) / 2 : -1 };
  }
  // 1 white has won, -1 black has, 0 a draw, null still playing
  function pawnResult(st) {
    if (st.w.some((s) => rank(s) === 7) || !st.b.length) return 1;
    if (st.b.some((s) => rank(s) === 0) || !st.w.length) return -1;
    return pawnMoves(st).length ? null : 0;
  }
  // How far each side is from a queen, and whose passed pawn gets there first.
  function pawnEval(st) {
    let score = (st.w.length - st.b.length) * 100;
    const passed = (s, side) => (side === 1 ? st.b : st.w).every((o) => Math.abs(file(o) - file(s)) > 1 || (side === 1 ? rank(o) <= rank(s) : rank(o) >= rank(s)));
    let bestW = 9, bestB = 9;
    for (const s of st.w) { const to = 7 - rank(s); score += (7 - to) * 6; if (passed(s, 1)) { score += 30 + (7 - to) * 14; bestW = Math.min(bestW, to); } }
    for (const s of st.b) { const to = rank(s); score -= (7 - to) * 6; if (passed(s, -1)) { score -= 30 + (7 - to) * 14; bestB = Math.min(bestB, to); } }
    // an unstoppable passed pawn that queens first decides the race
    if (bestW < 9 || bestB < 9) { const w = bestW - (st.side === 1 ? 0.5 : 0), b = bestB - (st.side === -1 ? 0.5 : 0); if (w < b) score += 400; else if (b < w) score -= 400; }
    return score * st.side;
  }
  function pawnSearch(st, depth, alpha, beta, ply) {
    const res = pawnResult(st);
    if (res !== null) return res === 0 ? 0 : res * st.side * (10000 - ply);
    if (depth === 0) return pawnEval(st);
    const moves = pawnMoves(st).sort((a, b) => (b.cap !== undefined) - (a.cap !== undefined) || (st.side === 1 ? rank(b.to) - rank(a.to) : rank(a.to) - rank(b.to)));
    let best = -Infinity;
    for (const m of moves) {
      const v = -pawnSearch(pawnPlay(st, m), depth - 1, -beta, -alpha, ply + 1);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  // The bot (and the hint): the best move at a depth that keeps a phone quick.
  function pawnBest(st, depth) {
    depth = depth || (st.w.length + st.b.length <= 6 ? 10 : 5);
    let best = null, bestV = -Infinity;
    for (const m of pawnMoves(st)) {
      const v = -pawnSearch(pawnPlay(st, m), depth - 1, -Infinity, -bestV, 1);
      if (v > bestV || !best) { bestV = v; best = m; }
    }
    return best;
  }
  const pawnScore = (result, myMoves) => result === 1 ? 100 + Math.max(0, 50 - Math.max(0, myMoves - 4) * 5) : result === 0 ? 30 : 0;

  // ------------------------------------------------------------ queen's path
  // Guards are black pieces that never move: [square, piece] with piece 1 pawn … 6 king.
  const SLIDES = { 3: [[1, 1], [1, -1], [-1, 1], [-1, -1]], 4: [[1, 0], [-1, 0], [0, 1], [0, -1]] };
  SLIDES[5] = SLIDES[3].concat(SLIDES[4]);
  const KING = SLIDES[5];
  // Every square some guard attacks, and which guards attack it. The queen is not in the way:
  // what matters is the square she lands on after she has left her own.
  function guardAttacks(guards) {
    const occ = new Set(guards.map((g) => g[0])), map = new Map();
    const add = (sq, from) => { if (sq < 0) return; if (!map.has(sq)) map.set(sq, []); map.get(sq).push(from); };
    for (const [s, p] of guards) {
      const f = file(s), r = rank(s);
      if (p === 1) { add(at(f - 1, r - 1), s); add(at(f + 1, r - 1), s); }
      else if (p === 2) for (const [df, dr] of KNIGHT) add(at(f + df, r + dr), s);
      else if (p === 6) for (const [df, dr] of KING) add(at(f + df, r + dr), s);
      else for (const [df, dr] of SLIDES[p]) for (let k = 1; k < 8; k++) { const t = at(f + df * k, r + dr * k); if (t < 0) break; add(t, s); if (occ.has(t)) break; }
    }
    return map;
  }
  function queenMoves(q, guards) {
    const occ = new Set(guards.map((g) => g[0])), out = [];
    for (const [df, dr] of SLIDES[5]) for (let k = 1; k < 8; k++) { const t = at(file(q) + df * k, rank(q) + dr * k); if (t < 0 || occ.has(t)) break; out.push(t); }
    return out;
  }
  // Fewest safe moves from q to the last rank (Infinity if there is no way).
  function queenPar(q, guards) {
    const att = guardAttacks(guards), seen = new Set([q]);
    let front = [q];
    for (let d = 1; d <= 8; d++) {
      const nxt = [];
      for (const s of front) for (const t of queenMoves(s, guards)) {
        if (att.has(t) || seen.has(t)) continue;
        if (rank(t) === 7) return d;
        seen.add(t); nxt.push(t);
      }
      front = nxt;
    }
    return Infinity;
  }
  const QUEEN_GUARDS = { easy: 4, medium: 6, hard: 8 };
  // A board with a way through that takes at least two moves (three on the harder levels).
  function queenBoard(seed, level) {
    const r = rng(seed), n = QUEEN_GUARDS[level] || 4, minPar = level === 'easy' ? 2 : 3;
    for (let tries = 0; tries < 4000; tries++) {
      const guards = [], used = new Set();
      while (guards.length < n) {
        const sq = at(r.int(8), 1 + r.int(7));
        if (used.has(sq)) continue;
        const p = r.pick([1, 1, 2, 2, 3, 3, 4, 4, 6]);
        if (p === 1 && rank(sq) < 2) continue;
        used.add(sq); guards.push([sq, p]);
      }
      const att = guardAttacks(guards);
      const starts = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => at(f, 0)).filter((s) => !att.has(s));
      if (!starts.length) continue;
      const q = r.pick(starts), par = queenPar(q, guards);
      if (par >= minPar && par <= 5) return { queen: q, guards, par };
    }
    return { queen: at(3, 0), guards: [[at(3, 5), 4], [at(6, 4), 3]], par: 2 };
  }
  const queenBoardScore = (moves, par, bumps) => Math.max(20, 100 - Math.max(0, moves - par) * 15 - bumps * 10);
  const QUEEN_BOARDS = 5;

  // ------------------------------------------------------------ memory board
  // Positions are taken from the real games behind the puzzles: both kings and a few pieces near them.
  const MEMORY_SIZES = { easy: [3, 3, 4, 4, 5], medium: [4, 5, 6, 7, 8], hard: [6, 7, 8, 9, 10] };
  const MEMORY_SECONDS = 5;
  function memoryPosition(seed, n) {
    const r = rng(seed), list = content.puzzles || [];
    for (let tries = 0; tries < 50; tries++) {
      const pz = list.length ? r.pick(list) : { fen: E.START_FEN };
      const pos = new E.Pos(); pos.load(pz.fen);
      const all = [];
      for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(pos, sq); if (p) all.push([sq, p]); }
      const kings = all.filter(([, p]) => Math.abs(p) === 6), rest = r.shuffle(all.filter(([, p]) => Math.abs(p) !== 6));
      if (kings.length + rest.length < n) continue;
      return kings.concat(rest).slice(0, n).sort((a, b) => a[0] - b[0]);
    }
    return [[4, 6], [60, -6], [3, 5]].slice(0, n);
  }
  function memoryCheck(want, got) {
    const key = (x) => x[0] + ':' + x[1], w = new Set(want.map(key));
    const right = got.filter((x) => w.has(key(x))).length;
    return { right, wrong: got.length - right, missing: want.length - right, perfect: right === want.length && got.length === want.length };
  }
  const memoryPoints = (c) => Math.max(0, c.right * 20 - c.wrong * 10) + (c.perfect ? 20 : 0);

  // ------------------------------------------------------------ mate rush
  // Every checkmate in one the game already teaches: the last move of each puzzle that ends in
  // mate, and the mate exercises of the lessons and the Journey, each also with the colours swapped.
  function mirrorFen(fen) {
    const [board, side, castle, ep] = fen.split(' ');
    const rows = board.split('/').reverse().map((row) => row.replace(/[a-z]/gi, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())));
    const swap = (s) => s === '-' ? '-' : s.replace(/[a-z]/gi, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase())).split('').sort().join('');
    return rows.join('/') + ' ' + (side === 'w' ? 'b' : 'w') + ' ' + (swap(castle) || '-') + ' ' + (ep === '-' ? '-' : ep[0] + (9 - +ep[1])) + ' 0 1';
  }
  function matingMoves(fen) {
    const g = new E.Game(fen), out = [];
    for (const m of g.legal) { const t = new E.Game(fen); t.play(m); if (t.outcome && t.outcome.reason === 'checkmate') out.push(E.uci(m)); }
    return out;
  }
  let pool = null;
  function matePool() {
    if (pool) return pool;
    const fens = [];
    for (const p of content.puzzles || []) {
      if (!p.themes.some((t) => t.startsWith('mateIn'))) continue;
      const g = new E.Game(p.fen);
      for (let i = 0; i < p.moves.length; i++) {
        const before = g.pos.fen();
        g.playText(p.moves[i]);
        if (g.outcome && g.outcome.reason === 'checkmate') { fens.push(before); break; }
      }
    }
    const exercises = (content.lessons || []).flatMap((l) => l.exercises || []);
    for (const e of content.eras || []) for (const s of e.stages || []) for (const x of s.exercises || []) exercises.push(x);
    for (const x of exercises) if (x.type === 'mate' && x.fen) fens.push(x.fen);
    const seen = new Set(), out = [];
    for (const f of fens.concat(fens.map(mirrorFen))) {
      const key = f.split(' ').slice(0, 2).join(' ');
      if (seen.has(key)) continue;
      seen.add(key);
      try { if (matingMoves(f).length) out.push(f); } catch (e) { /* a position the engine cannot read */ }
    }
    pool = out;
    return out;
  }
  const RUSH_SECONDS = 60;

  // ------------------------------------------------------------ rewards
  // What a round pays (Chackmate's points; XP until the points exist) and the daily cap per game.
  const REWARD = { perRound: 10, capPerDay: 50 };

  return {
    GAMES, game, rng, name,
    jumps, tourRegion, tourMoves, tourHint, tourCorners, tourScore,
    SPOT_ROUNDS, SPOT_LIVES, spotterRounds, spotTime, spotPoints,
    PAWN_START, pawnMoves, pawnPlay, pawnResult, pawnBest, pawnScore,
    guardAttacks, queenMoves, queenPar, queenBoard, queenBoardScore, QUEEN_BOARDS,
    MEMORY_SIZES, MEMORY_SECONDS, memoryPosition, memoryCheck, memoryPoints,
    mirrorFen, matingMoves, matePool, RUSH_SECONDS,
    REWARD,
  };
}

if (typeof module !== 'undefined') module.exports = ChacklateMinis;
