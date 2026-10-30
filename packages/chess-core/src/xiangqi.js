// Xiangqi, Chinese chess: rules, notation and a computer player, in-house like the chess engine.
// The board has 9 files (a-i) and 10 ranks (0-9); pieces stand on the points where lines cross.
// Red sits at ranks 0-4 and moves first, Black at ranks 5-9. Square index = rank * 9 + file.
// FEN is the usual Xiangqi FEN with a "xiangqi:" prefix, ranks from Black's side down:
//   xiangqi:rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1
// Letters: k general, a advisor, b elephant, n horse, r chariot, c cannon, p soldier; capitals
// are Red. Moves are written in coordinates ("h2e2"), files a-i and ranks 0-9 from Red's side.
'use strict';
function ChacklateXiangqi() {
  const RED = 1, BLACK = -1;
  const K = 1, A = 2, B = 3, N = 4, R = 5, C = 6, P = 7;
  const LETTER = ' kabnrcp';
  const START_FEN = 'xiangqi:rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1';
  const fileOf = (s) => s % 9, rankOf = (s) => (s / 9) | 0;
  const sq = (f, r) => r * 9 + f;
  const onBoard = (f, r) => f >= 0 && f < 9 && r >= 0 && r < 10;
  const inPalace = (f, r, side) => f >= 3 && f <= 5 && (side === RED ? r >= 0 && r <= 2 : r >= 7 && r <= 9);
  const ownHalf = (r, side) => (side === RED ? r <= 4 : r >= 5);
  const sqName = (s) => 'abcdefghi'[fileOf(s)] + rankOf(s);
  const parseSq = (t) => { const m = /^([a-i])([0-9])$/.exec(t); return m ? sq(m[1].charCodeAt(0) - 97, +m[2]) : -1; };
  const mv = (from, to) => from | (to << 7);
  const mFrom = (m) => m & 127, mTo = (m) => m >> 7;
  const uci = (m) => sqName(mFrom(m)) + sqName(mTo(m));

  // Zobrist keys from a fixed seed, so the same position always hashes the same.
  let seed = 0x2545f491;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const ZK = []; for (let i = 0; i < 15 * 90; i++) ZK.push(rnd());
  const ZSIDE = rnd();
  const zk = (p, s) => ZK[(p + 7) * 90 + s];

  const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  // horse: [leg file, leg rank, to file, to rank]
  const HORSE = [[0, 1, -1, 2], [0, 1, 1, 2], [0, -1, -1, -2], [0, -1, 1, -2], [1, 0, 2, 1], [1, 0, 2, -1], [-1, 0, -2, 1], [-1, 0, -2, -1]];

  class Pos {
    constructor() { this.b = new Int8Array(90); this.side = RED; this.half = 0; this.full = 1; this.key = 0; this.hist = []; this.kings = [-1, -1]; }
    load(fen) {
      const body = String(fen || START_FEN).replace(/^xiangqi:/, '').trim().split(/\s+/);
      const rows = body[0].split('/');
      if (rows.length !== 10) return 'A Xiangqi board has ten rows';
      this.b.fill(0);
      for (let i = 0; i < 10; i++) {
        let f = 0;
        for (const c of rows[i]) {
          if (/\d/.test(c)) { f += +c; continue; }
          const t = LETTER.indexOf(c.toLowerCase());
          if (t < 1 || f > 8) return 'Unknown piece ' + c;
          this.b[sq(f, 9 - i)] = c === c.toUpperCase() ? t : -t;
          f++;
        }
        if (f !== 9) return 'Row ' + (i + 1) + ' does not have nine points';
      }
      this.side = body[1] === 'b' ? BLACK : RED;
      this.half = +body[4] || 0; this.full = +body[5] || 1;
      this.hist = [];
      this.rekey();
      if (this.kings[0] < 0 || this.kings[1] < 0) return 'Each side needs a general';
      return null;
    }
    rekey() {
      this.key = this.side === BLACK ? ZSIDE : 0; this.kings = [-1, -1];
      for (let s = 0; s < 90; s++) { const p = this.b[s]; if (!p) continue; this.key ^= zk(p, s); if (p === K) this.kings[0] = s; if (p === -K) this.kings[1] = s; }
    }
    fen() {
      const rows = [];
      for (let r = 9; r >= 0; r--) {
        let row = '', gap = 0;
        for (let f = 0; f < 9; f++) {
          const p = this.b[sq(f, r)];
          if (!p) { gap++; continue; }
          if (gap) { row += gap; gap = 0; }
          const l = LETTER[Math.abs(p)]; row += p > 0 ? l.toUpperCase() : l;
        }
        rows.push(row + (gap || ''));
      }
      return 'xiangqi:' + rows.join('/') + ' ' + (this.side === RED ? 'w' : 'b') + ' - - ' + this.half + ' ' + this.full;
    }
    kingSq(side) { return this.kings[side === RED ? 0 : 1]; }
    // Pseudo-legal moves for the side to move (captures only when caps is true).
    gen(caps) {
      const out = [], b = this.b, me = this.side;
      const add = (from, f, r) => { const t = sq(f, r), q = b[t]; if (q * me > 0) return; if (caps && !q) return; out.push(mv(from, t)); };
      for (let s = 0; s < 90; s++) {
        const p = b[s] * me;
        if (p <= 0) continue;
        const f = fileOf(s), r = rankOf(s);
        if (p === K) { for (const [df, dr] of ORTH) if (inPalace(f + df, r + dr, me)) add(s, f + df, r + dr); }
        else if (p === A) { for (const [df, dr] of DIAG) if (inPalace(f + df, r + dr, me)) add(s, f + df, r + dr); }
        else if (p === B) {
          for (const [df, dr] of DIAG) {
            const tf = f + 2 * df, tr = r + 2 * dr;
            if (onBoard(tf, tr) && ownHalf(tr, me) && !b[sq(f + df, r + dr)]) add(s, tf, tr);
          }
        } else if (p === N) {
          for (const [lf, lr, tf, tr] of HORSE) {
            if (!onBoard(f + tf, r + tr) || b[sq(f + lf, r + lr)]) continue;
            add(s, f + tf, r + tr);
          }
        } else if (p === R || p === C) {
          for (const [df, dr] of ORTH) {
            let tf = f + df, tr = r + dr, screen = false;
            while (onBoard(tf, tr)) {
              const q = b[sq(tf, tr)];
              if (p === R) { if (!q) { if (!caps) out.push(mv(s, sq(tf, tr))); } else { if (q * me < 0) out.push(mv(s, sq(tf, tr))); break; } }
              else if (!screen) { if (!q) { if (!caps) out.push(mv(s, sq(tf, tr))); } else screen = true; }
              else if (q) { if (q * me < 0) out.push(mv(s, sq(tf, tr))); break; }
              tf += df; tr += dr;
            }
          }
        } else if (p === P) {
          const fwd = me === RED ? 1 : -1;
          if (onBoard(f, r + fwd)) add(s, f, r + fwd);
          if (!ownHalf(r, me)) { if (f > 0) add(s, f - 1, r); if (f < 8) add(s, f + 1, r); }
        }
      }
      return out;
    }
    // Is the point s attacked by side `by`? (Used for the general: also counts the flying general.)
    attacked(s, by) {
      const b = this.b, f = fileOf(s), r = rankOf(s);
      for (const [df, dr] of ORTH) {
        let tf = f + df, tr = r + dr, seen = 0;
        while (onBoard(tf, tr)) {
          const q = b[sq(tf, tr)];
          if (q) {
            if (seen === 0) { if (q === R * by || (q === K * by && df === 0)) return true; }
            else if (q === C * by) return true;
            if (++seen === 2) break;
          }
          tf += df; tr += dr;
        }
      }
      for (const [lf, lr, tf, tr] of HORSE) {
        // a horse at s - (tf, tr) jumps to s; its leg is next to the horse, not to s
        const hf = f - tf, hr = r - tr;
        if (!onBoard(hf, hr) || b[sq(hf, hr)] !== N * by) continue;
        if (!b[sq(hf + lf, hr + lr)]) return true;
      }
      const back = by === RED ? -1 : 1;   // a soldier attacks forward and, once across, sideways
      if (onBoard(f, r + back) && b[sq(f, r + back)] === P * by) return true;
      for (const df of [-1, 1]) if (onBoard(f + df, r) && b[sq(f + df, r)] === P * by && !ownHalf(r, by)) return true;
      return false;
    }
    inCheck(side) { side = side || this.side; return this.attacked(this.kingSq(side), -side); }
    make(m) {
      const from = mFrom(m), to = mTo(m), p = this.b[from], q = this.b[to];
      this.hist.push({ m, q, half: this.half, key: this.key });
      this.key ^= zk(p, from) ^ zk(p, to) ^ ZSIDE; if (q) this.key ^= zk(q, to);
      this.b[to] = p; this.b[from] = 0;
      if (p === K) this.kings[0] = to; else if (p === -K) this.kings[1] = to;
      this.half = q ? 0 : this.half + 1;
      if (this.side === BLACK) this.full++;
      this.side = -this.side;
      return q;
    }
    unmake() {
      const h = this.hist.pop(), from = mFrom(h.m), to = mTo(h.m), p = this.b[to];
      this.side = -this.side;
      if (this.side === BLACK) this.full--;
      this.b[from] = p; this.b[to] = h.q;
      if (p === K) this.kings[0] = from; else if (p === -K) this.kings[1] = from;
      this.half = h.half; this.key = h.key;
    }
    legal(m) { this.make(m); const ok = !this.attacked(this.kingSq(-this.side), this.side); this.unmake(); return ok; }
    legalMoves(caps) { return this.gen(caps).filter((m) => this.legal(m)); }
    count(side) { let n = 0; for (let s = 0; s < 90; s++) if (this.b[s] * side > 0) n++; return n; }
    // Can this side still force anything? Generals, advisors and elephants alone cannot cross over.
    canAttack(side) { for (let s = 0; s < 90; s++) { const p = this.b[s] * side; if (p === N || p === R || p === C || p === P) return true; } return false; }
    pieceAt(s) { return this.b[s]; }
  }

  function perft(pos, d) {
    if (d === 0) return 1;
    let n = 0;
    for (const m of pos.gen(false)) {
      pos.make(m);
      if (!pos.attacked(pos.kingSq(-pos.side), pos.side)) n += d === 1 ? 1 : perft(pos, d - 1);
      pos.unmake();
    }
    return n;
  }

  // A game: legal moves, the result, move history for undo and the record.
  // The end: a side with no legal move loses (checkmate, and stalemate too); the same position for
  // the third time is a draw, unless one side gave check with every move of it, which loses;
  // 60 moves each without a capture, or neither side able to cross the river, is a draw.
  class Game {
    constructor(fen) {
      this.pos = new Pos();
      const err = this.pos.load(fen || START_FEN);
      if (err) throw new Error(err);
      this.startFen = this.pos.fen();
      this.variant = 'xiangqi';
      this.moves = []; this.captured = []; this.checks = []; this.keys = [this.pos.key];
      this.outcome = null;
      this.legal = this.pos.legalMoves();
      this.judge();
    }
    targets(from) { return this.legal.filter((m) => mFrom(m) === from).map(mTo); }
    find(from, to) { return this.legal.find((m) => mFrom(m) === from && mTo(m) === to) ?? null; }
    play(m) {
      if (this.outcome || !this.legal.includes(m)) return null;
      const side = this.pos.side, from = mFrom(m), to = mTo(m), piece = this.pos.b[from];
      const q = this.pos.make(m);
      this.moves.push(m); this.captured.push(q); this.keys.push(this.pos.key);
      const check = this.pos.inCheck();
      this.checks.push(check);
      this.legal = this.pos.legalMoves();
      this.judge();
      return { move: m, from, to, piece, captured: q, side, check, uci: uci(m) };
    }
    playText(t) { const f = parseSq(String(t).slice(0, 2)), to = parseSq(String(t).slice(2, 4)); const m = this.find(f, to); return m === null ? null : this.play(m); }
    undo() {
      if (!this.moves.length) return null;
      const m = this.moves.pop(); this.captured.pop(); this.checks.pop(); this.keys.pop();
      this.pos.unmake(); this.outcome = null;
      this.legal = this.pos.legalMoves();
      return m;
    }
    judge() {
      const p = this.pos, mover = -p.side;   // who just moved
      if (!this.legal.length) { this.outcome = { result: p.side === RED ? '0-1' : '1-0', reason: p.inCheck() ? 'checkmate' : 'stalemate-loss' }; return; }
      // repetition: the third time this position stands on the board with this side to move
      const key = p.key, seen = [];
      for (let i = this.keys.length - 1; i >= 0; i -= 2) if (this.keys[i] === key) seen.push(i);
      if (seen.length >= 3) {
        // checks given in the cycle by each side, from the first time to now
        const first = seen[seen.length - 1], n = this.checks.length;
        let byMover = true, byOther = true;
        for (let i = first; i < n; i++) {
          // checks[i] belongs to the move that made position keys[i + 1]
          const moverMove = (n - 1 - i) % 2 === 0;
          if (moverMove) byMover = byMover && this.checks[i]; else byOther = byOther && this.checks[i];
        }
        if (byMover && !byOther) { this.outcome = { result: mover === RED ? '0-1' : '1-0', reason: 'perpetual-check' }; return; }
        if (byOther && !byMover) { this.outcome = { result: mover === RED ? '1-0' : '0-1', reason: 'perpetual-check' }; return; }
        this.outcome = { result: '1/2-1/2', reason: 'threefold' }; return;
      }
      if (p.half >= 120) { this.outcome = { result: '1/2-1/2', reason: 'sixty' }; return; }
      if (!p.canAttack(RED) && !p.canAttack(BLACK)) this.outcome = { result: '1/2-1/2', reason: 'insufficient' };
    }
    resign(side) { if (!this.outcome) this.outcome = { result: side === RED ? '0-1' : '1-0', reason: 'resignation' }; }
    timeout(side) { if (!this.outcome) this.outcome = { result: side === RED ? '0-1' : '1-0', reason: 'timeout' }; }
    fen() { return this.pos.fen(); }
  }

  // ---------------------------------------------------------------- the computer player
  const VALUE = [0, 0, 200, 200, 400, 900, 450, 100];
  const MATE = 30000;
  // Soldiers grow stronger across the river and near the palace; horses like the middle.
  function bonus(t, f, r) {   // from Red's side
    if (t === P) return r >= 5 ? 70 + (r <= 8 ? (r - 5) * 15 : 0) - Math.abs(f - 4) * 6 : r === 4 && (f === 2 || f === 4 || f === 6) ? 10 : 0;
    if (t === N) return 14 - Math.abs(f - 4) * 4 - Math.abs(r - 4.5) * 3 + (r >= 5 ? 12 : 0);
    if (t === R) return (r >= 5 ? 20 : 0) + (f === 3 || f === 5 ? 6 : 0);
    if (t === C) return f === 4 ? 18 : r >= 7 ? 10 : 0;
    return 0;
  }
  const PST = [];
  for (let t = 0; t < 8; t++) { const row = new Int16Array(90); for (let s = 0; s < 90; s++) row[s] = bonus(t, fileOf(s), rankOf(s)); PST.push(row); }
  const mirror = (s) => sq(fileOf(s), 9 - rankOf(s));
  function evaluate(pos) {
    let score = 0;
    const b = pos.b;
    for (let s = 0; s < 90; s++) {
      const p = b[s]; if (!p) continue;
      const t = Math.abs(p);
      if (p > 0) score += VALUE[t] + PST[t][s]; else score -= VALUE[t] + PST[t][mirror(s)];
    }
    // a general without its guards is easy to attack
    return pos.side === RED ? score : -score;
  }

  const LEVELS = [
    { depth: 1, noise: 220, timeMs: 200 }, { depth: 2, noise: 100, timeMs: 300 }, { depth: 3, noise: 40, timeMs: 500 },
    { depth: 4, noise: 12, timeMs: 700 }, { depth: 5, noise: 5, timeMs: 900 }, { depth: 64, noise: 0, timeMs: 1300 },
    { depth: 64, noise: 0, timeMs: 2000 }, { depth: 64, noise: 0, timeMs: 3000 },
  ];

  function search(pos, opts) {
    opts = opts || {};
    const maxDepth = opts.depth || 64, timeMs = opts.timeMs || 1000, noise = opts.noise || 0, random = opts.random || Math.random;
    const t0 = Date.now(), tt = new Map(), killers = [];
    let nodes = 0, stop = false;
    const path = [];   // keys on the line being searched, for repetition
    const order = (ms, best, ply) => {
      const k = killers[ply] || [];
      return ms.map((m) => {
        const q = pos.b[mTo(m)];
        let s = m === best ? 1e6 : q ? 1e5 + VALUE[Math.abs(q)] * 10 - VALUE[Math.abs(pos.b[mFrom(m)])] : k.includes(m) ? 5e4 : 0;
        return [s, m];
      }).sort((a, c) => c[0] - a[0]).map((x) => x[1]);
    };
    function quiesce(alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() - t0 > timeMs) stop = true;
      if (stop) return 0;
      const stand = evaluate(pos);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      if (ply > 24) return stand;
      for (const m of order(pos.gen(true), -1, ply)) {
        pos.make(m);
        if (pos.attacked(pos.kingSq(-pos.side), pos.side)) { pos.unmake(); continue; }
        const v = -quiesce(-beta, -alpha, ply + 1);
        pos.unmake();
        if (stop) return 0;
        if (v >= beta) return v;
        if (v > alpha) alpha = v;
      }
      return alpha;
    }
    function negamax(depth, alpha, beta, ply) {
      if ((++nodes & 2047) === 0 && Date.now() - t0 > timeMs) stop = true;
      if (stop) return 0;
      if (ply && path.includes(pos.key)) return 0;
      const inCheck = pos.inCheck();
      if (inCheck) depth++;
      if (depth <= 0) return quiesce(alpha, beta, ply);
      const e = tt.get(pos.key);
      if (e && e.d >= depth && ply) { if (e.f === 0) return e.v; if (e.f === 1 && e.v >= beta) return e.v; if (e.f === -1 && e.v <= alpha) return e.v; }
      let best = -MATE - 1, bestM = e ? e.m : -1, legal = 0;
      const a0 = alpha;
      path.push(pos.key);
      for (const m of order(pos.gen(false), bestM, ply)) {
        pos.make(m);
        if (pos.attacked(pos.kingSq(-pos.side), pos.side)) { pos.unmake(); continue; }
        legal++;
        const v = -negamax(depth - 1, -beta, -alpha, ply + 1);
        pos.unmake();
        if (stop) { path.pop(); return 0; }
        if (v > best) { best = v; bestM = m; }
        if (v > alpha) alpha = v;
        if (alpha >= beta) { if (!pos.b[mTo(m)]) { const k = killers[ply] || (killers[ply] = []); if (!k.includes(m)) { k.unshift(m); k.length = Math.min(k.length, 2); } } break; }
      }
      path.pop();
      if (!legal) return -MATE + ply;   // no move: checkmate or stalemate, both lose
      tt.set(pos.key, { d: depth, v: best, m: bestM, f: best <= a0 ? -1 : best >= beta ? 1 : 0 });
      return best;
    }
    const root = pos.legalMoves();
    if (!root.length) return { move: null, score: -MATE, depth: 0 };
    let result = { move: root[0], score: 0, depth: 0 };
    for (let d = 1; d <= maxDepth; d++) {
      // the root by hand, so weaker levels can pick among near-best moves
      const scored = [];
      let alpha = -MATE - 1;
      const prev = result.move;
      const ms = order(root, prev, 0);
      path.length = 0; path.push(pos.key);
      for (const m of ms) {
        pos.make(m);
        const v = -negamax(d - 1, -MATE - 1, noise ? MATE + 1 : -alpha, 1);
        pos.unmake();
        if (stop) break;
        scored.push([v, m]);
        if (v > alpha) alpha = v;
      }
      if (stop && !scored.length) break;
      scored.sort((x, y) => y[0] - x[0]);
      let pick = scored[0];
      if (noise) {
        const ok = scored.filter((x) => x[0] >= scored[0][0] - noise && Math.abs(x[0]) < MATE - 100);
        if (ok.length) pick = ok[Math.floor(random() * ok.length)];
      }
      result = { move: pick[1], score: pick[0], depth: d };
      if (stop || Date.now() - t0 > timeMs * 0.5 || Math.abs(scored[0][0]) > MATE - 100) break;
    }
    return result;
  }

  function positionFrom(fen, ucis) {
    const g = new Game(fen);
    for (const u of ucis || []) if (!g.playText(u)) throw new Error('Illegal move in history: ' + u);
    return g.pos;
  }

  return {
    RED, BLACK, K, A, B, N, R, C, P, START_FEN, LEVELS, MATE,
    Pos, Game, perft, search, evaluate, positionFrom,
    sq, fileOf, rankOf, sqName, parseSq, uci, mFrom, mTo, onBoard, inPalace,
  };
}
if (typeof module !== 'undefined') module.exports = ChacklateXiangqi;
