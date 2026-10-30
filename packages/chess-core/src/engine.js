// Chackmate engine: rules, notation and the computer opponent.
// Self-contained so the same source runs on the page and inside a Web Worker
// (the worker is built from ChacklateEngine.toString()).
function ChacklateEngine() {
  'use strict';

  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const WHITE = 1, BLACK = -1;
  const F_CAP = 1, F_DBL = 2, F_EP = 4, F_CASTLE = 8, F_PROMO = 16;
  const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const VALUE = [0, 100, 320, 330, 500, 900, 20000];
  const PHASE = [0, 0, 1, 1, 2, 4, 0];
  const LETTER = ['', 'P', 'N', 'B', 'R', 'Q', 'K'];
  const KNIGHT_DIRS = [33, 31, 18, 14, -33, -31, -18, -14];
  const KING_DIRS = [1, -1, 16, -16, 15, 17, -15, -17];
  const BISHOP_DIRS = [15, 17, -15, -17];
  const ROOK_DIRS = [1, -1, 16, -16];
  const ALFIL_DIRS = [30, 34, -30, -34];
  const STACK = 2048;

  // Variations. A position's variation travels inside its FEN as a prefix ("chaturanga:rnbq..."),
  // so start positions, saved games, worker jobs and reviews keep their rules without extra plumbing.
  // Plain chess has no prefix. Chaturanga, the ancient Indian game, reuses the piece codes of the
  // pieces they grew into: the Gaja (elephant, B) jumps exactly two squares diagonally, the Mantri
  // (counsellor, Q) steps one square diagonally, pawns step one square and become a Mantri, there is
  // no castling, stalemate wins for the side that gives it, and a bare king loses.
  // Chess960 shuffles the back rank (fr: Fischer random castling, see genCastles960). King of the
  // Hill also wins with the king on d4, e4, d5 or e5 (hill). Three-check also wins with a third
  // check (checks: the count travels as a last FEN field, "+1+0" for one check given by White).
  const VARIANTS = {
    standard: { id: 'standard', name: 'Chess', start: START_FEN },
    chaturanga: { id: 'chaturanga', name: 'Chaturanga', start: 'chaturanga:rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1', old: true },
    chess960: { id: 'chess960', name: 'Chess960', start: 'chess960:rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w HAha - 0 1', fr: true },
    koth: { id: 'koth', name: 'King of the Hill', start: 'koth:' + START_FEN, hill: true },
    threecheck: { id: 'threecheck', name: 'Three-check', start: 'threecheck:' + START_FEN + ' +0+0', checks: true },
  };
  const HILL = new Uint8Array(128); HILL[0x33] = HILL[0x34] = HILL[0x43] = HILL[0x44] = 1;
  const CHECKS_TO_WIN = 3;
  const VARIANT_IDS = Object.keys(VARIANTS);

  // Castling rights bits: 1 = white O-O, 2 = white O-O-O, 4 = black O-O, 8 = black O-O-O.
  // Moving from or to these squares clears the matching rights.
  const CASTLE_MASK = new Uint8Array(128).fill(15);
  CASTLE_MASK[0x00] = 13; CASTLE_MASK[0x07] = 14; CASTLE_MASK[0x04] = 12;
  CASTLE_MASK[0x70] = 7; CASTLE_MASK[0x77] = 11; CASTLE_MASK[0x74] = 3;

  // Deterministic Zobrist keys (two 32-bit halves) so every platform hashes alike.
  let seed = 0x2545f491;
  function rand32() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  }
  const ZPL = new Int32Array(13 * 128), ZPH = new Int32Array(13 * 128);
  for (let i = 0; i < ZPL.length; i++) { ZPL[i] = rand32(); ZPH[i] = rand32(); }
  const ZCL = new Int32Array(16), ZCH = new Int32Array(16);
  for (let i = 0; i < 16; i++) { ZCL[i] = rand32(); ZCH[i] = rand32(); }
  const ZEL = new Int32Array(8), ZEH = new Int32Array(8);
  for (let i = 0; i < 8; i++) { ZEL[i] = rand32(); ZEH[i] = rand32(); }
  const ZSL = rand32(), ZSH = rand32();
  // Each variation hashes differently, so the shared search table never mixes their scores.
  const ZVL = VARIANT_IDS.map((id, i) => (i ? rand32() : 0)), ZVH = VARIANT_IDS.map((id, i) => (i ? rand32() : 0));
  // Three-check: one key per side and number of checks given.
  const ZKL = new Int32Array(8), ZKH = new Int32Array(8);
  for (let i = 0; i < 8; i++) { ZKL[i] = rand32(); ZKH[i] = rand32(); }

  const mv = (from, to, promo, flags) => from | (to << 7) | (promo << 14) | (flags << 17);
  const mFrom = (m) => m & 127;
  const mTo = (m) => (m >> 7) & 127;
  const mPromo = (m) => (m >> 14) & 7;
  const mFlags = (m) => (m >> 17) & 31;

  const to64 = (sq) => (sq >> 4) * 8 + (sq & 7);
  const to88 = (sq) => (sq >> 3) * 16 + (sq & 7);
  const sqName = (sq) => 'abcdefgh'[sq & 7] + (1 + (sq >> 4));
  const parseSq = (s) => {
    if (!/^[a-h][1-8]$/.test(s)) return -1;
    return (s.charCodeAt(1) - 49) * 16 + (s.charCodeAt(0) - 97);
  };

  // ---------------------------------------------------------------- Position

  function Pos() {
    this.v = VARIANTS.standard;
    this.ch = false;   // ancient (chaturanga) piece moves and endings
    this.checks = [0, 0];   // three-check: checks given by White and by Black
    this.crf = [7, 0, 7, 0];   // castling rook files: White O-O, White O-O-O, Black O-O, Black O-O-O
    this.cmask = CASTLE_MASK;
    this.b = new Int8Array(128);
    this.side = WHITE;
    this.castle = 0;
    this.ep = -1;
    this.half = 0;
    this.full = 1;
    this.kings = [0, 0];
    this.hl = 0; this.hh = 0;
    this.sp = 0;
    this.uMove = new Int32Array(STACK); this.uCap = new Int8Array(STACK);
    this.uCastle = new Uint8Array(STACK); this.uEp = new Int16Array(STACK);
    this.uHalf = new Int32Array(STACK); this.uChecks = new Uint8Array(STACK);
    this.uHl = new Int32Array(STACK); this.uHh = new Int32Array(STACK);
  }

  const kIdx = (side) => (side === WHITE ? 0 : 1);

  Pos.prototype.load = function (fen) {
    let text = String(fen).trim(), variant = VARIANTS.standard;
    const pre = text.match(/^([a-z0-9]+):/);
    if (pre) {
      variant = VARIANTS[pre[1]];
      if (!variant || variant.id === 'standard') return 'Unknown variation "' + pre[1] + '".';
      text = text.slice(pre[0].length);
    }
    const old = !!variant.old;
    const f = text.split(/\s+/);
    let checks = [0, 0];
    if (variant.checks && /^\+[0-3]\+[0-3]$/.test(f[f.length - 1])) { const c = f.pop().split('+'); checks = [+c[1], +c[2]]; }
    if (f.length !== 4 && f.length !== 6) return 'A FEN needs 6 fields.';
    const b = new Int8Array(128);
    const ranks = f[0].split('/');
    if (ranks.length !== 8) return 'The board needs 8 ranks.';
    const counts = { 1: [0, 0, 0, 0, 0, 0, 0], '-1': [0, 0, 0, 0, 0, 0, 0] };
    for (let i = 0; i < 8; i++) {
      const rank = 7 - i;
      let file = 0;
      for (const c of ranks[i]) {
        if (/[1-8]/.test(c)) { file += +c; continue; }
        const kind = 'pnbrqk'.indexOf(c.toLowerCase()) + 1;
        if (!kind) return 'Unexpected character "' + c + '" in the board.';
        if (file > 7) return 'Rank ' + (rank + 1) + ' is too long.';
        const color = c === c.toUpperCase() ? WHITE : BLACK;
        if (kind === P && (rank === 0 || rank === 7)) return 'Pawns cannot stand on the first or last rank.';
        b[rank * 16 + file] = kind * color;
        counts[color][kind]++;
        file++;
      }
      if (file !== 8) return 'Rank ' + (rank + 1) + ' does not have 8 squares.';
    }
    for (const color of [WHITE, BLACK]) {
      const c = counts[color];
      if (c[K] !== 1) return 'Each side needs exactly one king.';
      if (c[P] > 8) return 'A side cannot have more than 8 pawns.';
      if (c.reduce((a, x) => a + x, 0) > 16) return 'A side cannot have more than 16 pieces.';
    }
    if (f[1] !== 'w' && f[1] !== 'b') return 'Side to move must be w or b.';
    if (old && f[2] !== '-') return 'There is no castling in ' + variant.name + '.';
    if (old && f[3] !== '-') return 'There is no en passant in ' + variant.name + '.';
    let castle = 0;
    const crf = [7, 0, 7, 0];
    if (variant.fr) {
      // Shredder letters (the castling rook's file, upper case for White) or KQkq for the outermost rooks.
      if (f[2] !== '-') {
        for (const c of f[2]) {
          const white = c === c.toUpperCase(), rank = white ? 0 : 0x70, color = white ? WHITE : BLACK;
          const ksq = (() => { for (let x = 0; x < 8; x++) if (b[rank + x] === K * color) return x; return -1; })();
          if (ksq < 0) return 'Castling needs the king on its first rank.';
          let file = -1, kside;
          const l = c.toLowerCase();
          if (l === 'k' || l === 'q') {
            kside = l === 'k';
            for (let x = kside ? 7 : 0; kside ? x > ksq : x < ksq; x += kside ? -1 : 1) if (b[rank + x] === R * color) { file = x; break; }
          } else if (/^[a-h]$/.test(l)) { file = l.charCodeAt(0) - 97; kside = file > ksq; }
          if (file < 0 || file === ksq || b[rank + file] !== R * color) return 'Castling rights do not match the board.';
          const bit = (kside ? 1 : 2) << (white ? 0 : 2);
          if (castle & bit) return 'Invalid castling field.';
          castle |= bit; crf[(white ? 0 : 2) + (kside ? 0 : 1)] = file;
        }
      }
    } else if (f[2] !== '-') {
      for (const c of f[2]) {
        const bit = { K: 1, Q: 2, k: 4, q: 8 }[c];
        if (!bit || castle & bit) return 'Invalid castling field.';
        castle |= bit;
      }
    }
    if (!variant.fr) {
      if ((castle & 3 && b[4] !== K) || (castle & 1 && b[7] !== R) || (castle & 2 && b[0] !== R)) return 'White castling rights do not match the board.';
      if ((castle & 12 && b[0x74] !== -K) || (castle & 4 && b[0x77] !== -R) || (castle & 8 && b[0x70] !== -R)) return 'Black castling rights do not match the board.';
    }
    let ep = -1;
    if (f[3] !== '-') {
      ep = parseSq(f[3]);
      if (ep < 0) return 'Invalid en passant square.';
      const mover = f[1] === 'w' ? BLACK : WHITE;
      const pawn = ep + 16 * mover;
      if ((ep >> 4) !== (mover === WHITE ? 2 : 5) || b[pawn] !== P * mover || b[ep] || b[ep - 16 * mover]) return 'The en passant square does not match the board.';
    }
    let half = 0, full = 1;
    if (f.length === 6) {
      half = parseInt(f[4], 10); full = parseInt(f[5], 10);
      if (!(half >= 0) || !(full >= 1)) return 'Invalid move counters.';
    }
    this.v = variant; this.ch = old; this.checks = checks; this.crf = crf;
    this.b = b; this.side = f[1] === 'w' ? WHITE : BLACK; this.castle = castle; this.ep = ep;
    this.half = half; this.full = full; this.sp = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (b[sq] === K) this.kings[0] = sq;
      if (b[sq] === -K) this.kings[1] = sq;
    }
    if (this.attacked(this.kings[kIdx(-this.side)], this.side)) return 'The side not to move is in check.';
    if (variant.fr) {
      // Moving the king, or moving or losing a castling rook, ends that castling right.
      const m = new Uint8Array(128).fill(15);
      for (const [ci, rank, k] of [[0, 0, this.kings[0]], [2, 0x70, this.kings[1]]]) {
        if (k >> 4 === rank >> 4) m[k] &= ~(3 << ci);
        m[rank + crf[ci]] &= ~(1 << ci); m[rank + crf[ci + 1]] &= ~(2 << ci);
      }
      this.cmask = m;
    } else this.cmask = CASTLE_MASK;
    this.rehash();
    return null;
  };

  Pos.prototype.rehash = function () {
    let hl = 0, hh = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.b[sq];
      if (p) { hl ^= ZPL[(p + 6) * 128 + sq]; hh ^= ZPH[(p + 6) * 128 + sq]; }
    }
    hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
    if (this.ep >= 0) { hl ^= ZEL[this.ep & 7]; hh ^= ZEH[this.ep & 7]; }
    if (this.side === BLACK) { hl ^= ZSL; hh ^= ZSH; }
    const vi = VARIANT_IDS.indexOf(this.v.id);
    hl ^= ZVL[vi]; hh ^= ZVH[vi];
    if (this.v.checks) { hl ^= ZKL[this.checks[0]] ^ ZKL[4 + this.checks[1]]; hh ^= ZKH[this.checks[0]] ^ ZKH[4 + this.checks[1]]; }
    this.hl = hl; this.hh = hh;
  };

  Pos.prototype.fen = function () {
    let s = '';
    for (let rank = 7; rank >= 0; rank--) {
      let empty = 0;
      for (let file = 0; file < 8; file++) {
        const p = this.b[rank * 16 + file];
        if (!p) { empty++; continue; }
        if (empty) { s += empty; empty = 0; }
        const ch = LETTER[Math.abs(p)];
        s += p > 0 ? ch : ch.toLowerCase();
      }
      if (empty) s += empty;
      if (rank) s += '/';
    }
    let c = '';
    if (this.v.fr) {
      const fl = (i, up) => { const l = 'abcdefgh'[this.crf[i]]; return up ? l.toUpperCase() : l; };
      if (this.castle & 1) c += fl(0, true);
      if (this.castle & 2) c += fl(1, true);
      if (this.castle & 4) c += fl(2, false);
      if (this.castle & 8) c += fl(3, false);
    } else {
      if (this.castle & 1) c += 'K';
      if (this.castle & 2) c += 'Q';
      if (this.castle & 4) c += 'k';
      if (this.castle & 8) c += 'q';
    }
    return (this.v.id === 'standard' ? '' : this.v.id + ':') + s + ' ' + (this.side === WHITE ? 'w' : 'b') + ' ' + (c || '-') + ' ' +
      (this.ep >= 0 ? sqName(this.ep) : '-') + ' ' + this.half + ' ' + this.full + (this.v.checks ? ' +' + this.checks[0] + '+' + this.checks[1] : '');
  };

  // Is `sq` attacked by side `by`?
  Pos.prototype.attacked = function (sq, by) {
    const b = this.b;
    let s;
    if (by === WHITE) {
      s = sq - 15; if (!(s & 0x88) && b[s] === P) return true;
      s = sq - 17; if (!(s & 0x88) && b[s] === P) return true;
    } else {
      s = sq + 15; if (!(s & 0x88) && b[s] === -P) return true;
      s = sq + 17; if (!(s & 0x88) && b[s] === -P) return true;
    }
    const n = N * by, k = K * by, bi = B * by, r = R * by, q = Q * by;
    if (this.ch) {
      for (let i = 0; i < 8; i++) {
        s = sq + KNIGHT_DIRS[i]; if (!(s & 0x88) && b[s] === n) return true;
        s = sq + KING_DIRS[i]; if (!(s & 0x88) && b[s] === k) return true;
      }
      for (let i = 0; i < 4; i++) {
        s = sq + ALFIL_DIRS[i]; if (!(s & 0x88) && b[s] === bi) return true;
        s = sq + BISHOP_DIRS[i]; if (!(s & 0x88) && b[s] === q) return true;
        const d = ROOK_DIRS[i];
        s = sq + d;
        while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === r) return true; break; } s += d; }
      }
      return false;
    }
    for (let i = 0; i < 8; i++) {
      s = sq + KNIGHT_DIRS[i]; if (!(s & 0x88) && b[s] === n) return true;
      s = sq + KING_DIRS[i]; if (!(s & 0x88) && b[s] === k) return true;
    }
    for (let i = 0; i < 4; i++) {
      let d = BISHOP_DIRS[i];
      s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === bi || p === q) return true; break; } s += d; }
      d = ROOK_DIRS[i];
      s = sq + d;
      while (!(s & 0x88)) { const p = b[s]; if (p) { if (p === r || p === q) return true; break; } s += d; }
    }
    return false;
  };

  Pos.prototype.inCheck = function (side) {
    const s = side === undefined ? this.side : side;
    return this.attacked(this.kings[kIdx(s)], -s);
  };

  // Pseudo-legal moves. With capturesOnly, also includes queen promotions.
  Pos.prototype.gen = function (list, capturesOnly) {
    const b = this.b, us = this.side, old = this.ch;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p || (p > 0) !== (us > 0)) continue;
      const kind = p * us;
      if (kind === P) {
        const fwd = 16 * us;
        const promoRank = us === WHITE ? 7 : 0;
        const one = sq + fwd;
        if (!(one & 0x88) && !b[one]) {
          if ((one >> 4) === promoRank) {
            list.push(mv(sq, one, Q, F_PROMO));
            if (!capturesOnly && !old) { list.push(mv(sq, one, R, F_PROMO)); list.push(mv(sq, one, B, F_PROMO)); list.push(mv(sq, one, N, F_PROMO)); }
          } else if (!capturesOnly) {
            list.push(mv(sq, one, 0, 0));
            const two = one + fwd;
            if (!old && (sq >> 4) === (us === WHITE ? 1 : 6) && !b[two]) list.push(mv(sq, two, 0, F_DBL));
          }
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const t = sq + d;
          if (t & 0x88) continue;
          const c = b[t];
          if (c && (c > 0) !== (us > 0)) {
            if ((t >> 4) === promoRank) {
              list.push(mv(sq, t, Q, F_CAP | F_PROMO));
              if (!capturesOnly && !old) { list.push(mv(sq, t, R, F_CAP | F_PROMO)); list.push(mv(sq, t, B, F_CAP | F_PROMO)); list.push(mv(sq, t, N, F_CAP | F_PROMO)); }
            } else list.push(mv(sq, t, 0, F_CAP));
          } else if (t === this.ep) list.push(mv(sq, t, 0, F_CAP | F_EP));
        }
      } else if (kind === N || kind === K || (old && (kind === B || kind === Q))) {
        const dirs = kind === N ? KNIGHT_DIRS : kind === K ? KING_DIRS : kind === B ? ALFIL_DIRS : BISHOP_DIRS;
        for (let i = 0; i < dirs.length; i++) {
          const t = sq + dirs[i];
          if (t & 0x88) continue;
          const c = b[t];
          if (!c) { if (!capturesOnly) list.push(mv(sq, t, 0, 0)); }
          else if ((c > 0) !== (us > 0)) list.push(mv(sq, t, 0, F_CAP));
        }
        if (kind === K && !capturesOnly && !old) { if (this.v.fr) this.genCastles960(sq, list); else this.genCastles(sq, list); }
      } else {
        const dirs = kind === B ? BISHOP_DIRS : kind === R ? ROOK_DIRS : KING_DIRS;
        for (let i = 0; i < dirs.length; i++) {
          const d = dirs[i];
          let t = sq + d;
          while (!(t & 0x88)) {
            const c = b[t];
            if (!c) { if (!capturesOnly) list.push(mv(sq, t, 0, 0)); }
            else { if ((c > 0) !== (us > 0)) list.push(mv(sq, t, 0, F_CAP)); break; }
            t += d;
          }
        }
      }
    }
    return list;
  };

  // The king may not castle out of, through, or into check.
  Pos.prototype.genCastles = function (sq, list) {
    const b = this.b, us = this.side, them = -us;
    const home = us === WHITE ? 0x04 : 0x74;
    if (sq !== home) return;
    const ks = us === WHITE ? 1 : 4, qs = us === WHITE ? 2 : 8;
    if (!(this.castle & (ks | qs)) || this.attacked(home, them)) return;
    if (this.castle & ks && !b[home + 1] && !b[home + 2] && b[home + 3] === R * us &&
        !this.attacked(home + 1, them) && !this.attacked(home + 2, them)) list.push(mv(home, home + 2, 0, F_CASTLE));
    if (this.castle & qs && !b[home - 1] && !b[home - 2] && !b[home - 3] && b[home - 4] === R * us &&
        !this.attacked(home - 1, them) && !this.attacked(home - 2, them)) list.push(mv(home, home - 2, 0, F_CASTLE));
  };

  // Chess960 castling: the king ends on g1 (O-O) or c1 (O-O-O) and the rook on f1 or d1, wherever
  // they started. Every square either piece crosses or lands on must be empty (apart from the two
  // of them), and the king may not start on, cross or land on an attacked square. The move is
  // written king-takes-own-rook (to = the rook's square), as in UCI for Chess960.
  Pos.prototype.genCastles960 = function (sq, list) {
    const b = this.b, us = this.side, them = -us, rank = us === WHITE ? 0 : 0x70, ci = us === WHITE ? 0 : 2;
    if ((sq & 0x70) !== rank || !(this.castle & (3 << ci)) || this.attacked(sq, them)) return;
    for (const kside of [true, false]) {
      if (!(this.castle & ((kside ? 1 : 2) << ci))) continue;
      const rs = rank + this.crf[ci + (kside ? 0 : 1)], kd = rank + (kside ? 6 : 2), rd = rank + (kside ? 5 : 3);
      if (b[rs] !== R * us) continue;
      const lo = Math.min(sq, rs, kd, rd), hi = Math.max(sq, rs, kd, rd);
      let ok = true;
      for (let t = lo; t <= hi && ok; t++) if (t !== sq && t !== rs && b[t]) ok = false;
      for (let t = Math.min(sq, kd); t <= Math.max(sq, kd) && ok; t++) if (t !== sq && this.attacked(t, them)) ok = false;
      if (ok) list.push(mv(sq, rs, 0, F_CASTLE));
    }
  };
  // Where a castling move leaves the king and the rook: [king from, king to, rook from, rook to].
  Pos.prototype.castleSquares = function (m) {
    const from = mFrom(m), to = mTo(m);
    if (this.v.fr) { const rank = from & 0x70, ks = to > from; return [from, rank + (ks ? 6 : 2), to, rank + (ks ? 5 : 3)]; }
    return to > from ? [from, to, from + 3, from + 1] : [from, to, from - 4, from - 1];
  };

  // Plays a pseudo-legal move. Returns false (and undoes it) if it leaves the king in check.
  Pos.prototype.make = function (m) {
    const b = this.b, us = this.side;
    const from = mFrom(m), to = mTo(m), flags = mFlags(m), promo = mPromo(m);
    const fr960 = flags & F_CASTLE && this.v.fr;
    const piece = b[from], cap = fr960 ? 0 : b[to];
    const sp = this.sp++;
    this.uMove[sp] = m; this.uCap[sp] = cap; this.uCastle[sp] = this.castle; this.uEp[sp] = this.ep;
    this.uHalf[sp] = this.half; this.uHl[sp] = this.hl; this.uHh[sp] = this.hh;
    this.uChecks[sp] = this.checks[0] | (this.checks[1] << 2);
    let hl = this.hl, hh = this.hh;
    if (fr960) return this.make960(m, piece, us, hl, hh);

    hl ^= ZPL[(piece + 6) * 128 + from]; hh ^= ZPH[(piece + 6) * 128 + from];
    if (cap) { hl ^= ZPL[(cap + 6) * 128 + to]; hh ^= ZPH[(cap + 6) * 128 + to]; }
    if (flags & F_EP) {
      const cs = to - 16 * us, cp = -P * us;
      b[cs] = 0;
      hl ^= ZPL[(cp + 6) * 128 + cs]; hh ^= ZPH[(cp + 6) * 128 + cs];
    }
    const placed = promo ? promo * us : piece;
    b[to] = placed; b[from] = 0;
    hl ^= ZPL[(placed + 6) * 128 + to]; hh ^= ZPH[(placed + 6) * 128 + to];
    if (flags & F_CASTLE) {
      const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      const rook = b[rf];
      b[rt] = rook; b[rf] = 0;
      hl ^= ZPL[(rook + 6) * 128 + rf] ^ ZPL[(rook + 6) * 128 + rt];
      hh ^= ZPH[(rook + 6) * 128 + rf] ^ ZPH[(rook + 6) * 128 + rt];
    }
    if (piece * us === K) this.kings[kIdx(us)] = to;
    hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
    this.castle &= this.cmask[from] & this.cmask[to];
    hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
    if (this.ep >= 0) { hl ^= ZEL[this.ep & 7]; hh ^= ZEH[this.ep & 7]; }
    this.ep = flags & F_DBL ? from + 16 * us : -1;
    if (this.ep >= 0) { hl ^= ZEL[this.ep & 7]; hh ^= ZEH[this.ep & 7]; }
    this.half = piece * us === P || cap || flags & F_EP ? 0 : this.half + 1;
    if (us === BLACK) this.full++;
    this.side = -us;
    hl ^= ZSL; hh ^= ZSH;
    this.hl = hl; this.hh = hh;
    if (this.attacked(this.kings[kIdx(us)], -us)) { this.unmake(); return false; }
    if (this.v.checks) this.countCheck(us);
    return true;
  };
  // Three-check: a move that gives check adds one to the mover's count.
  Pos.prototype.countCheck = function (us) {
    if (!this.attacked(this.kings[kIdx(-us)], us)) return;
    const i = us === WHITE ? 0 : 4, n = this.checks[kIdx(us)];
    if (n >= CHECKS_TO_WIN) return;
    this.hl ^= ZKL[i + n] ^ ZKL[i + n + 1]; this.hh ^= ZKH[i + n] ^ ZKH[i + n + 1];
    this.checks[kIdx(us)] = n + 1;
  };
  // Chess960 castling (see genCastles960): lift king and rook, then set both down.
  Pos.prototype.make960 = function (m, king, us, hl, hh) {
    const b = this.b, [kf, kt, rf, rt] = this.castleSquares(m), rook = b[rf];
    b[kf] = 0; b[rf] = 0; b[kt] = king; b[rt] = rook;
    hl ^= ZPL[(king + 6) * 128 + kf] ^ ZPL[(king + 6) * 128 + kt] ^ ZPL[(rook + 6) * 128 + rf] ^ ZPL[(rook + 6) * 128 + rt];
    hh ^= ZPH[(king + 6) * 128 + kf] ^ ZPH[(king + 6) * 128 + kt] ^ ZPH[(rook + 6) * 128 + rf] ^ ZPH[(rook + 6) * 128 + rt];
    this.kings[kIdx(us)] = kt;
    hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
    this.castle &= this.cmask[kf] & this.cmask[rf];
    hl ^= ZCL[this.castle]; hh ^= ZCH[this.castle];
    if (this.ep >= 0) { hl ^= ZEL[this.ep & 7]; hh ^= ZEH[this.ep & 7]; }
    this.ep = -1;
    this.half++;
    if (us === BLACK) this.full++;
    this.side = -us;
    hl ^= ZSL; hh ^= ZSH;
    this.hl = hl; this.hh = hh;
    if (this.attacked(kt, -us)) { this.unmake(); return false; }
    if (this.v.checks) this.countCheck(us);
    return true;
  };

  Pos.prototype.unmake = function () {
    const sp = --this.sp;
    const m = this.uMove[sp], b = this.b;
    const us = -this.side;
    const from = mFrom(m), to = mTo(m), flags = mFlags(m), promo = mPromo(m);
    const ck = this.uChecks[sp]; this.checks[0] = ck & 3; this.checks[1] = ck >> 2;
    if (flags & F_CASTLE && this.v.fr) {
      const [kf, kt, rf, rt] = this.castleSquares(m), king = b[kt], rook = b[rt];
      b[kt] = 0; b[rt] = 0; b[kf] = king; b[rf] = rook;
      this.kings[kIdx(us)] = kf;
      this.castle = this.uCastle[sp]; this.ep = this.uEp[sp]; this.half = this.uHalf[sp];
      this.hl = this.uHl[sp]; this.hh = this.uHh[sp];
      if (us === BLACK) this.full--;
      this.side = us;
      return;
    }
    const piece = promo ? P * us : b[to];
    b[from] = piece; b[to] = this.uCap[sp];
    if (flags & F_EP) b[to - 16 * us] = -P * us;
    if (flags & F_CASTLE) {
      const rf = to > from ? from + 3 : from - 4, rt = to > from ? from + 1 : from - 1;
      b[rf] = b[rt]; b[rt] = 0;
    }
    if (piece * us === K) this.kings[kIdx(us)] = from;
    this.castle = this.uCastle[sp]; this.ep = this.uEp[sp]; this.half = this.uHalf[sp];
    this.hl = this.uHl[sp]; this.hh = this.uHh[sp];
    if (us === BLACK) this.full--;
    this.side = us;
  };

  Pos.prototype.makeNull = function () {
    const sp = this.sp++;
    this.uMove[sp] = 0; this.uCastle[sp] = this.castle; this.uEp[sp] = this.ep;
    this.uHalf[sp] = this.half; this.uHl[sp] = this.hl; this.uHh[sp] = this.hh;
    this.uChecks[sp] = this.checks[0] | (this.checks[1] << 2);
    if (this.ep >= 0) { this.hl ^= ZEL[this.ep & 7]; this.hh ^= ZEH[this.ep & 7]; }
    this.ep = -1; this.half++;
    this.side = -this.side; this.hl ^= ZSL; this.hh ^= ZSH;
  };

  Pos.prototype.unmakeNull = function () {
    const sp = --this.sp;
    this.ep = this.uEp[sp]; this.half = this.uHalf[sp];
    this.hl = this.uHl[sp]; this.hh = this.uHh[sp];
    this.side = -this.side;
  };

  Pos.prototype.legalMoves = function () {
    const out = [];
    for (const m of this.gen([], false)) {
      if (this.make(m)) { this.unmake(); out.push(m); }
    }
    return out;
  };

  // Repetition identity (FIDE 9.2): the en passant square counts only if a capture is legal.
  Pos.prototype.repKey = function () {
    let hl = this.hl, hh = this.hh;
    if (this.ep >= 0 && !this.legalMoves().some((m) => mFlags(m) & F_EP)) {
      hl ^= ZEL[this.ep & 7]; hh ^= ZEH[this.ep & 7];
    }
    return (hl >>> 0).toString(16) + ':' + (hh >>> 0).toString(16);
  };

  // Dead positions found automatically: K v K, K+minor v K, and bishops all on one square colour.
  Pos.prototype.insufficient = function () {
    if (this.v.hill) return false;   // a lone king can still walk to the hill
    if (this.v.checks && (this.count(WHITE) || this.count(BLACK))) return false;   // any piece can still give check
    if (this.ch) return this.count(WHITE) === 0 && this.count(BLACK) === 0;
    const others = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const k = Math.abs(this.b[sq]);
      if (!k || k === K) continue;
      if (k === P || k === R || k === Q) return false;
      others.push([k, sq]);
    }
    if (others.length <= 1) return true;
    if (!others.every((o) => o[0] === B)) return false;
    const shade = (sq) => ((sq >> 4) + (sq & 7)) & 1;
    return others.every((o) => shade(o[1]) === shade(others[0][1]));
  };

  // Could `side` still checkmate? Used when the opponent's flag falls (FIDE 6.9).
  // Conservative: a bare king, or a lone minor against a bare king, cannot.
  Pos.prototype.canMate = function (side) {
    if (this.ch || this.v.checks) return this.count(side) > 0;
    if (this.v.hill) return true;
    if (this.insufficient()) return false;
    const own = [];
    let opponentBare = true;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = this.b[sq];
      if (!p || Math.abs(p) === K) continue;
      if ((p > 0) === (side > 0)) own.push(Math.abs(p)); else opponentBare = false;
    }
    if (own.length === 0) return false;
    if (own.length === 1 && (own[0] === N || own[0] === B)) return !opponentBare;
    return true;
  };

  // King of the Hill and Three-check: the side that has just moved may already have won.
  // Returns the winning side, or 0.
  Pos.prototype.variantWinner = function () {
    const v = this.v;
    if (v.hill) { if (HILL[this.kings[0]]) return WHITE; if (HILL[this.kings[1]]) return BLACK; }
    if (v.checks) { if (this.checks[0] >= CHECKS_TO_WIN) return WHITE; if (this.checks[1] >= CHECKS_TO_WIN) return BLACK; }
    return 0;
  };

  // How many pieces other than the king `side` has.
  Pos.prototype.count = function (side) {
    let n = 0;
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const k = this.b[sq] * side;
      if (k > 0 && k !== K) n++;
    }
    return n;
  };

  // Chaturanga's bare king: a side left with only its king loses, unless it can take the
  // other side's last piece at once (then both kings are bare and the game is drawn).
  // Returns the winning side, or 0 while the game goes on.
  Pos.prototype.bareWinner = function () {
    const us = this.side, ours = this.count(us), theirs = this.count(-us);
    if ((ours && theirs) || (!ours && !theirs)) return 0;
    if (ours) return us;   // they were bared on their move and could not bare us back
    if (theirs === 1 && this.legalMoves().some((m) => mFlags(m) & F_CAP)) return 0;
    return -us;
  };

  Pos.prototype.hasNonPawn = function (side) {
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const k = this.b[sq] * side;
      if (k > P && k < K) return true;
    }
    return false;
  };

  // SAN for a legal move in this position.
  Pos.prototype.san = function (m, legal) {
    const from = mFrom(m), to = mTo(m), flags = mFlags(m), promo = mPromo(m);
    const piece = this.b[from], kind = Math.abs(piece);
    let s;
    if (flags & F_CASTLE) s = to > from ? 'O-O' : 'O-O-O';   // in Chess960 too: `to` is the rook's square
    else {
      s = '';
      if (kind === P) {
        if (flags & F_CAP) s += 'abcdefgh'[from & 7] + 'x';
        s += sqName(to);
        if (promo) s += '=' + LETTER[promo];
      } else {
        s += LETTER[kind];
        const rivals = (legal || this.legalMoves()).filter((o) => mTo(o) === to && mFrom(o) !== from && this.b[mFrom(o)] === piece);
        if (rivals.length) {
          const sameFile = rivals.some((o) => (mFrom(o) & 7) === (from & 7));
          const sameRank = rivals.some((o) => (mFrom(o) >> 4) === (from >> 4));
          if (!sameFile) s += 'abcdefgh'[from & 7];
          else if (!sameRank) s += 1 + (from >> 4);
          else s += sqName(from);
        }
        if (flags & F_CAP) s += 'x';
        s += sqName(to);
      }
    }
    this.make(m);
    if (this.inCheck()) s += this.legalMoves().length ? '+' : '#';
    this.unmake();
    return s;
  };

  // Reads SAN (lenient: 0-0, missing =, extra disambiguation, !? marks) or UCI.
  Pos.prototype.parseMove = function (text, legal) {
    legal = legal || this.legalMoves();
    const raw = String(text).trim();
    const uci = raw.toLowerCase().match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (uci) {
      const from = parseSq(uci[1]), to = parseSq(uci[2]), promo = uci[3] ? 'pnbrqk'.indexOf(uci[3]) + 1 : 0;
      const hit = legal.find((m) => mFrom(m) === from && mTo(m) === to && mPromo(m) === promo);
      if (hit !== undefined) return hit;
    }
    let s = raw.replace(/[+#!?]+$/, '');
    if (/^(O-O|0-0)$/.test(s)) return legal.find((m) => mFlags(m) & F_CASTLE && mTo(m) > mFrom(m)) ?? null;
    if (/^(O-O-O|0-0-0)$/.test(s)) return legal.find((m) => mFlags(m) & F_CASTLE && mTo(m) < mFrom(m)) ?? null;
    let kind = P;
    if (/^[KQRBN]/.test(s)) { kind = LETTER.indexOf(s[0]); s = s.slice(1); }
    let promo = 0;
    if (kind === P) {
      const pm = s.match(/^(.*[18])=?([QRBNqrbn])$/);
      if (pm) { promo = 'pnbrqk'.indexOf(pm[2].toLowerCase()) + 1; s = pm[1]; }
    }
    s = s.replace(/[x:\-]/g, '');
    const parts = s.match(/^([a-h])?([1-8])?([a-h][1-8])$/);
    if (!parts) return null;
    const ff = parts[1] ? parts[1].charCodeAt(0) - 97 : -1;
    const fr = parts[2] ? +parts[2] - 1 : -1;
    const to = parseSq(parts[3]);
    const hits = legal.filter((m) => !(mFlags(m) & F_CASTLE) && mTo(m) === to && Math.abs(this.b[mFrom(m)]) === kind &&
      mPromo(m) === promo && (ff < 0 || (mFrom(m) & 7) === ff) && (fr < 0 || (mFrom(m) >> 4) === fr));
    return hits.length === 1 ? hits[0] : null;
  };

  // ------------------------------------------------------------- Evaluation

  // Piece-square tables, written from White's side with rank 8 on the first row.
  const PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
      -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
      -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
      0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  ];
  const KING_MG = [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20];
  const KING_EG = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
  const PASSED = [0, 5, 10, 20, 35, 60, 100, 0];
  // Chaturanga: the Mantri and the Gaja are short-range pieces, worth a little more than a pawn.
  const VALUE_OLD = [0, 100, 300, 140, 500, 180, 20000];
  const PST_OLD = PST.slice();
  PST_OLD[B] = [-10, -10, -10, -10, -10, -10, -10, -10, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 10, 0, 0, 10, 0, -10, -10, 0, 0, 10, 10, 0, 0, -10,
    -10, 0, 0, 10, 10, 0, 0, -10, -10, 0, 10, 0, 0, 10, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -10, -10, -10, -10, -10, -10, -10, -10];
  PST_OLD[Q] = PST[N].map((x) => x >> 1);

  // Static evaluation in centipawns from White's point of view.
  // `style` tilts the personality: aggression rewards pieces near the enemy king,
  // caution rewards pawns sheltering one's own king.
  function evaluate(pos, style) {
    const b = pos.b, old = pos.ch, VAL = old ? VALUE_OLD : VALUE, TAB = old ? PST_OLD : PST;
    let mg = 0, eg = 0, phase = 0;
    const pawnFiles = [new Int8Array(8), new Int8Array(8)];
    const pawns = [];
    const bishops = [0, 0];
    const material = [0, 0];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = b[sq];
      if (!p) continue;
      const kind = p > 0 ? p : -p, color = p > 0 ? 1 : -1, ci = p > 0 ? 0 : 1;
      const f = sq & 7, r = sq >> 4;
      const idx = color === 1 ? (7 - r) * 8 + f : r * 8 + f;
      if (kind === K) { mg += color * KING_MG[idx]; eg += color * KING_EG[idx]; continue; }
      const v = VAL[kind], t = TAB[kind][idx];
      mg += color * (v + t);
      eg += color * (v + (kind === P ? 0 : t));
      phase += PHASE[kind];
      if (kind !== P) material[ci] += v;
      if (kind === P) { pawnFiles[ci][f]++; pawns.push(sq, color); }
      if (kind === B) bishops[ci]++;
      if (style && style.aggression && kind !== P) {
        const ek = pos.kings[color === 1 ? 1 : 0];
        const dist = Math.max(Math.abs((ek & 7) - f), Math.abs((ek >> 4) - r));
        mg += color * (7 - dist) * 3 * style.aggression;
      }
    }
    for (let i = 0; i < pawns.length; i += 2) {
      const sq = pawns[i], color = pawns[i + 1], ci = color === 1 ? 0 : 1, oi = 1 - ci;
      const f = sq & 7, r = sq >> 4;
      if (pawnFiles[ci][f] > 1) { mg -= color * 8; eg -= color * 15; }
      if ((f === 0 || !pawnFiles[ci][f - 1]) && (f === 7 || !pawnFiles[ci][f + 1])) { mg -= color * 10; eg -= color * 12; }
      let passed = true;
      for (let df = -1; df <= 1 && passed; df++) {
        const ff = f + df;
        if (ff < 0 || ff > 7 || !pawnFiles[oi][ff]) continue;
        for (let rr = r + color; rr >= 0 && rr <= 7; rr += color) {
          if (b[rr * 16 + ff] === -P * color) { passed = false; break; }
        }
      }
      if (passed) {
        const adv = color === 1 ? r : 7 - r;
        mg += color * PASSED[adv] / 2;
        eg += color * PASSED[adv];
      }
    }
    if (bishops[0] >= 2 && !old) { mg += 30; eg += 40; }
    if (bishops[1] >= 2 && !old) { mg -= 30; eg -= 40; }
    if (style && style.caution) {
      for (const color of [1, -1]) {
        const k = pos.kings[color === 1 ? 0 : 1];
        let shelter = 0;
        for (let df = -1; df <= 1; df++) {
          const s1 = k + 16 * color + df, s2 = k + 32 * color + df;
          if (!(s1 & 0x88) && b[s1] === P * color) shelter += 12;
          else if (!(s2 & 0x88) && b[s2] === P * color) shelter += 6;
        }
        mg += color * shelter * style.caution;
      }
    }
    if (phase > 24) phase = 24;
    let score = (mg * phase + eg * (24 - phase)) / 24;
    // Mop-up: with a clear material lead and no enemy pawns, drive the enemy king to the edge.
    if (phase <= 8) {
      const lead = material[0] - material[1];
      if (Math.abs(lead) >= (old ? 140 : 300)) {
        const winner = lead > 0 ? 0 : 1, loser = 1 - winner;
        const hasLoserPawns = pawns.some((x, i) => i % 2 === 1 && (x === 1 ? 0 : 1) === loser);
        if (!hasLoserPawns) {
          const lk = pos.kings[loser], wk = pos.kings[winner];
          const lf = lk & 7, lr = lk >> 4;
          const centre = Math.max(3 - lf, lf - 4) + Math.max(3 - lr, lr - 4);
          const kd = Math.abs(lf - (wk & 7)) + Math.abs(lr - (wk >> 4));
          score += (winner === 0 ? 1 : -1) * (centre * 12 + (14 - kd) * 5);
        }
      }
    }
    // King of the Hill: a king near the centre is close to winning. Three-check: each check given
    // counts for more than a piece, the second for nearly a rook more.
    if (pos.v.hill) {
      for (const [k, color] of [[pos.kings[0], 1], [pos.kings[1], -1]]) {
        const f = k & 7, r = k >> 4, d = Math.max(Math.max(0, 3 - f, f - 4), Math.max(0, 3 - r, r - 4));
        score += color * HILL_BONUS[d];
      }
    }
    if (pos.v.checks) score += CHECK_BONUS[pos.checks[0]] - CHECK_BONUS[pos.checks[1]];
    return score | 0;
  }
  const HILL_BONUS = [0, 90, 35, 10];
  const CHECK_BONUS = [0, 160, 420, 0];

  // ------------------------------------------------------------------ Search

  const INF = 32000, MATE = 30000;
  const TT_BITS = 19, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  const EXACT = 1, LOWER = 2, UPPER = 3;
  let ttH = null, ttM, ttS, ttD, ttF;
  function ensureTT() {
    if (ttH) return;
    ttH = new Int32Array(TT_SIZE); ttM = new Int32Array(TT_SIZE); ttS = new Int16Array(TT_SIZE);
    ttD = new Int8Array(TT_SIZE); ttF = new Uint8Array(TT_SIZE);
  }

  // Strength levels. Labels are descriptive only; strength is not rating-calibrated.
  const LEVELS = [
    { name: 'Truffle', blurb: 'Brand-new learner. Leaves pieces hanging.', band: '250–500', depth: 1, noise: 260, quiesce: false, timeMs: 200 },
    { name: 'Builder', blurb: 'Develops calmly and avoids tricks.', band: '500–800', depth: 2, noise: 110, quiesce: true, timeMs: 300 },
    { name: 'Rusher', blurb: 'Attacks early and overreaches.', band: '800–1100', depth: 3, noise: 45, quiesce: true, timeMs: 500, style: { aggression: 1.2 } },
    { name: 'Wall', blurb: 'Solid defender who grinds endgames.', band: '1100–1400', depth: 5, noise: 12, quiesce: true, timeMs: 600, style: { caution: 1.5 } },
    { name: 'Trickster', blurb: 'Sets traps and plays for swindles.', band: '1400–1700', depth: 6, noise: 6, quiesce: true, timeMs: 800, style: { aggression: 1.5 }, premium: true },
    { name: 'Strategist', blurb: 'Patient positional player.', band: '1700–2000', depth: 64, noise: 0, quiesce: true, timeMs: 1300, style: { caution: 1.2 }, premium: true },
    { name: 'Tactician', blurb: 'Sharp and sacrificial. Calculates deeply.', band: '2000–2300', depth: 64, noise: 0, quiesce: true, timeMs: 2000, style: { aggression: 1.3 }, premium: true },
    { name: 'Grandmaster mode', blurb: 'Full strength, thinks longest.', band: 'Strongest', depth: 64, noise: 0, quiesce: true, timeMs: 3000, premium: true },
  ];

  function search(pos, opts) {
    ensureTT();
    const maxDepth = opts.depth || 64;
    const timeMs = opts.timeMs || 1000;
    const quiesce = opts.quiesce !== false;
    const style = opts.style || null;
    const noise = opts.noise || 0;
    const random = opts.random || Math.random;
    const start = Date.now(), stopAt = start + timeMs;
    let nodes = 0, stopped = false;
    const killers = new Int32Array(256);
    const history = new Int32Array(128 * 128);

    const evalSide = () => evaluate(pos, style) * pos.side + 10;
    const toTT = (s, ply) => (s > MATE - 500 ? s + ply : s < -MATE + 500 ? s - ply : s);
    const fromTT = (s, ply) => (s > MATE - 500 ? s - ply : s < -MATE + 500 ? s + ply : s);

    function tick() {
      if ((++nodes & 1023) === 0 && Date.now() > stopAt) stopped = true;
    }

    function isRepetition() {
      const lim = Math.max(0, pos.sp - pos.half);
      for (let i = pos.sp - 2; i >= lim; i -= 2) {
        if (pos.uHl[i] === pos.hl && pos.uHh[i] === pos.hh) return true;
      }
      return false;
    }

    function order(list, ttMove, ply) {
      const scores = new Int32Array(list.length);
      for (let i = 0; i < list.length; i++) {
        const m = list[i], fl = mFlags(m);
        if (m === ttMove) scores[i] = 1e7;
        else if (fl & F_CAP) {
          const victim = fl & F_EP ? P : Math.abs(pos.b[mTo(m)]);
          scores[i] = 1e6 + VALUE[victim] * 10 - VALUE[Math.abs(pos.b[mFrom(m)])] / 10;
        } else if (fl & F_PROMO) scores[i] = 9e5;
        else if (m === killers[ply * 2]) scores[i] = 8e5;
        else if (m === killers[ply * 2 + 1]) scores[i] = 7e5;
        else scores[i] = history[mFrom(m) * 128 + mTo(m)];
      }
      return scores;
    }

    function pick(list, scores, i) {
      let best = i;
      for (let j = i + 1; j < list.length; j++) if (scores[j] > scores[best]) best = j;
      if (best !== i) {
        const m = list[i]; list[i] = list[best]; list[best] = m;
        const s = scores[i]; scores[i] = scores[best]; scores[best] = s;
      }
      return list[i];
    }

    const race = !!(pos.v.hill || pos.v.checks);
    function qsearch(alpha, beta, ply) {
      tick();
      if (stopped) return 0;
      if (race && pos.variantWinner()) return -MATE + ply;   // only the side that just moved can have won
      const stand = evalSide();
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (ply > 60) return stand;
      const list = pos.gen([], true);
      const scores = order(list, 0, ply);
      for (let i = 0; i < list.length; i++) {
        const m = pick(list, scores, i);
        if (!pos.make(m)) continue;
        const s = -qsearch(-beta, -alpha, ply + 1);
        pos.unmake();
        if (stopped) return 0;
        if (s >= beta) return beta;
        if (s > alpha) alpha = s;
      }
      return alpha;
    }

    let rootBest = 0;
    let excluded = null;
    function negamax(depth, alpha, beta, ply, allowNull) {
      if (ply > 0) {
        if (pos.half >= 100 || isRepetition() || pos.insufficient()) return 0;
        if (pos.ch) { const w = pos.bareWinner(); if (w) return w === pos.side ? MATE - ply : -MATE + ply; }
        if (race && pos.variantWinner()) return -MATE + ply;
      }
      const inCheck = pos.inCheck();
      if (inCheck) depth++;
      if (depth <= 0) return quiesce ? qsearch(alpha, beta, ply) : evalSide();
      tick();
      if (stopped) return 0;
      if (ply >= 100) return evalSide();

      const idx = pos.hl & TT_MASK;
      let ttMove = 0;
      if (ttH[idx] === pos.hh && ttF[idx]) {
        ttMove = ttM[idx];
        if (ply > 0 && ttD[idx] >= depth) {
          const s = fromTT(ttS[idx], ply), f = ttF[idx];
          if (f === EXACT || (f === LOWER && s >= beta) || (f === UPPER && s <= alpha)) return s;
        }
      }

      if (allowNull && !inCheck && depth >= 3 && ply > 0 && beta < MATE - 500 && pos.hasNonPawn(pos.side) && evalSide() >= beta) {
        pos.makeNull();
        const s = -negamax(depth - 3, -beta, -beta + 1, ply + 1, false);
        pos.unmakeNull();
        if (stopped) return 0;
        if (s >= beta) return beta;
      }

      const list = pos.gen([], false);
      const scores = order(list, ttMove, ply);
      const origAlpha = alpha;
      let best = -INF, bestMove = 0, legal = 0;
      for (let i = 0; i < list.length; i++) {
        const m = pick(list, scores, i);
        if (ply === 0 && excluded && excluded.has(m)) continue;
        if (!pos.make(m)) continue;
        legal++;
        const quiet = !(mFlags(m) & (F_CAP | F_PROMO));
        let s;
        if (legal === 1) s = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
        else {
          const reduce = depth >= 3 && legal > 4 && quiet && !inCheck && !pos.inCheck() ? 1 : 0;
          s = -negamax(depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
          if (s > alpha && !stopped && (reduce || s < beta)) s = -negamax(depth - 1, -beta, -alpha, ply + 1, true);
        }
        pos.unmake();
        if (stopped) return 0;
        if (s > best) { best = s; bestMove = m; if (ply === 0) rootBest = m; }
        if (s > alpha) {
          alpha = s;
          if (alpha >= beta) {
            if (quiet) {
              if (killers[ply * 2] !== m) { killers[ply * 2 + 1] = killers[ply * 2]; killers[ply * 2] = m; }
              history[mFrom(m) * 128 + mTo(m)] += depth * depth;
            }
            break;
          }
        }
      }
      // In chaturanga the stalemated side loses too.
      if (!legal) return inCheck || pos.ch ? -MATE + ply : 0;
      ttH[idx] = pos.hh; ttM[idx] = bestMove; ttS[idx] = toTT(best, ply); ttD[idx] = depth;
      ttF[idx] = best <= origAlpha ? UPPER : best >= beta ? LOWER : EXACT;
      return best;
    }

    // `exclude` (UCI strings) lets callers find the second-best move, e.g. to check a puzzle has one answer.
    const rootMoves = opts.exclude && opts.exclude.length ? pos.legalMoves().filter((m) => !opts.exclude.includes(uci(m))) : pos.legalMoves();
    if (!rootMoves.length) return { move: 0, score: 0, depth: 0, nodes: 0 };
    if (opts.exclude && opts.exclude.length) excluded = new Set(pos.legalMoves().filter((m) => opts.exclude.includes(uci(m))));

    // Lower levels: score every root move at a fixed depth, then add noise.
    // The level is chosen before the game and never changes during it.
    if (noise > 0) {
      let bestMove = rootMoves[0], bestScore = -INF;
      for (const m of rootMoves) {
        pos.make(m);
        let s;
        if (maxDepth <= 1) s = quiesce ? -qsearch(-INF, INF, 1) : -evalSide();
        else s = -negamax(maxDepth - 1, -INF, INF, 1, true);
        pos.unmake();
        stopped = false;
        const noisy = s + (random() * 2 - 1) * noise;
        if (noisy > bestScore) { bestScore = noisy; bestMove = m; }
      }
      return { move: bestMove, score: bestScore | 0, depth: maxDepth, nodes };
    }

    let bestMove = rootMoves[0], bestScore = 0, depthDone = 0;
    for (let d = 1; d <= maxDepth; d++) {
      rootBest = 0;
      const s = negamax(d, -INF, INF, 0, false);
      if (stopped) { break; }
      if (rootBest) { bestMove = rootBest; bestScore = s; depthDone = d; }
      if (Math.abs(s) > MATE - 500) break;
      if (Date.now() - start > timeMs * 0.55) break;
    }
    return { move: bestMove, score: bestScore, depth: depthDone, nodes };
  }

  // -------------------------------------------------------------------- Game

  function Game(fen) {
    this.pos = new Pos();
    const err = this.pos.load(fen || START_FEN);
    this.variant = this.pos.v.id;
    if (err) throw new Error(err);
    this.startFen = this.pos.fen();
    this.moves = [];
    this.sans = [];
    this.captured = [];
    this.keys = [this.pos.repKey()];
    this.ended = null; // {result, reason} for endings not decided by the board
    this.refresh();
  }

  Game.prototype.refresh = function () {
    this.legal = this.pos.legalMoves();
    this.outcome = this.ended || this.boardOutcome();
  };

  Game.prototype.repetitions = function () {
    const last = this.keys[this.keys.length - 1];
    return this.keys.filter((k) => k === last).length;
  };

  // Automatic endings. Checkmate takes precedence over the 75-move and fivefold rules.
  Game.prototype.boardOutcome = function () {
    const p = this.pos;
    const lost = p.side === WHITE ? '0-1' : '1-0';
    const vw = p.variantWinner();
    if (vw) return { result: vw === WHITE ? '1-0' : '0-1', reason: p.v.hill ? 'hill' : 'three-check' };
    if (!this.legal.length) {
      if (p.inCheck()) return { result: lost, reason: 'checkmate' };
      if (p.ch) return { result: lost, reason: 'stalemate-win' };
      return { result: '1/2-1/2', reason: 'stalemate' };
    }
    if (p.insufficient()) return { result: '1/2-1/2', reason: 'insufficient' };
    if (p.ch) { const w = p.bareWinner(); if (w) return { result: w === WHITE ? '1-0' : '0-1', reason: 'bare-king' }; }
    if (this.repetitions() >= 5) return { result: '1/2-1/2', reason: 'fivefold' };
    if (p.half >= 150) return { result: '1/2-1/2', reason: 'seventyfive' };
    return null;
  };

  Game.prototype.claimable = function () {
    if (this.outcome) return null;
    if (this.repetitions() >= 3) return 'threefold';
    if (this.pos.half >= 100) return 'fifty';
    return null;
  };

  // In Chess960 a castling move can be picked on the rook's square or on the king's landing square
  // (unless an ordinary king move already goes there).
  Game.prototype.find = function (from64, to64, promo) {
    const from = to88(from64), to = to88(to64);
    const hit = this.legal.find((m) => mFrom(m) === from && mTo(m) === to && mPromo(m) === (promo || 0));
    if (hit !== undefined || !this.pos.v.fr) return hit ?? null;
    return this.legal.find((m) => mFlags(m) & F_CASTLE && mFrom(m) === from && this.pos.castleSquares(m)[1] === to) ?? null;
  };

  Game.prototype.targets = function (from64) {
    const from = to88(from64), out = [];
    for (const m of this.legal) {
      if (mFrom(m) !== from) continue;
      out.push(to64(mTo(m)));
      if (this.pos.v.fr && mFlags(m) & F_CASTLE) { const kt = to64(this.pos.castleSquares(m)[1]); if (kt !== from64) out.push(kt); }
    }
    return out.filter((t, i) => out.indexOf(t) === i);
  };

  Game.prototype.needsPromotion = function (from64, to64) {
    const from = to88(from64), to = to88(to64);
    return this.legal.some((m) => mFrom(m) === from && mTo(m) === to && mPromo(m));
  };

  // Plays a legal move (as returned by find/parse). Returns details for animation.
  Game.prototype.play = function (m) {
    if (this.outcome || !this.legal.includes(m)) return null;
    const p = this.pos;
    const from = mFrom(m), to = mTo(m), flags = mFlags(m);
    const san = p.san(m, this.legal);
    const capSq = flags & F_EP ? to - 16 * p.side : to;
    const capturedPiece = flags & F_CAP ? p.b[capSq] : 0;
    const mover = p.b[from];
    p.make(m);
    this.moves.push(m);
    this.sans.push(san);
    this.captured.push(capturedPiece);
    this.keys.push(p.repKey());
    this.refresh();
    let rook = null, kingTo = to;
    if (flags & F_CASTLE) { const c = p.castleSquares(m); rook = [to64(c[2]), to64(c[3])]; kingTo = c[1]; }
    return {
      move: m, san, from: to64(from), to: to64(kingTo), mover, promo: mPromo(m) * (mover > 0 ? 1 : -1),
      captured: capturedPiece, capturedSq: capturedPiece ? to64(capSq) : -1, rook, check: p.inCheck(),
    };
  };

  Game.prototype.playText = function (text) {
    if (this.outcome) return null;
    const m = this.pos.parseMove(text, this.legal);
    return m === null || m === undefined ? null : this.play(m);
  };

  Game.prototype.undo = function () {
    if (!this.moves.length || this.ended) return false;
    this.pos.unmake();
    this.moves.pop(); this.sans.pop(); this.captured.pop(); this.keys.pop();
    this.refresh();
    return true;
  };

  Game.prototype.finish = function (result, reason) {
    if (this.outcome) return false;
    this.ended = { result, reason };
    this.outcome = this.ended;
    return true;
  };

  Game.prototype.resign = function (side) { return this.finish(side === WHITE ? '0-1' : '1-0', 'resignation'); };
  Game.prototype.agreeDraw = function () { return this.finish('1/2-1/2', 'agreement'); };
  Game.prototype.claimDraw = function () { const c = this.claimable(); return c ? this.finish('1/2-1/2', c) : false; };
  Game.prototype.timeout = function (side) {
    return this.pos.canMate(-side) ? this.finish(side === WHITE ? '0-1' : '1-0', 'timeout') : this.finish('1/2-1/2', 'timeout-insufficient');
  };

  Game.prototype.uciMoves = function () {
    return this.moves.map(uci);
  };

  Game.prototype.pgn = function (tags) {
    const result = this.outcome ? this.outcome.result : '*';
    const t = Object.assign({ Event: 'Casual game', Site: 'Chackmate', Date: '????.??.??', Round: '-', White: '?', Black: '?' }, tags || {});
    t.Result = result;
    if (this.variant !== 'standard') t.Variant = VARIANTS[this.variant].name;
    if (this.startFen !== START_FEN && this.startFen !== VARIANTS[this.variant].start) { t.SetUp = '1'; t.FEN = this.startFen.replace(/^[a-z0-9]+:/, ''); }
    const order = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result', 'Variant'].filter((k) => k in t);
    const keys = order.concat(Object.keys(t).filter((k) => !order.includes(k)));
    let out = keys.map((k) => '[' + k + ' "' + String(t[k]).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]').join('\n') + '\n\n';
    const startPos = new Pos(); startPos.load(this.startFen);
    let num = startPos.full, white = startPos.side === WHITE;
    const tokens = [];
    this.sans.forEach((san, i) => {
      if (white) tokens.push(num + '.');
      else if (i === 0) tokens.push(num + '...');
      tokens.push(san);
      if (!white) num++;
      white = !white;
    });
    tokens.push(result);
    let line = '';
    for (const tok of tokens) {
      if (line.length + tok.length + 1 > 79) { out += line + '\n'; line = tok; } else line = line ? line + ' ' + tok : tok;
    }
    return out + line + '\n';
  };

  // Chess960 start position number n (0-959; 518 is the usual chess start), in the standard
  // numbering: bishops, then the queen, then the knights, and the rooks and king in what is left.
  function chess960Fen(n) {
    n = ((n | 0) % 960 + 960) % 960;
    const row = new Array(8).fill(null);
    let k = n;
    row[(k % 4) * 2 + 1] = 'b'; k = (k / 4) | 0;
    row[(k % 4) * 2] = 'b'; k = (k / 4) | 0;
    const free = () => row.map((x, i) => (x ? -1 : i)).filter((i) => i >= 0);
    row[free()[k % 6]] = 'q'; k = (k / 6) | 0;
    const KN = [[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]][k];
    const f1 = free(); row[f1[KN[0]]] = 'n'; row[f1[KN[1]]] = 'n';
    const f2 = free(); row[f2[0]] = 'r'; row[f2[1]] = 'k'; row[f2[2]] = 'r';
    const back = row.join(''), files = 'abcdefgh';
    const c = files[f2[2]].toUpperCase() + files[f2[0]].toUpperCase() + files[f2[2]] + files[f2[0]];
    return 'chess960:' + back + '/pppppppp/8/8/8/8/PPPPPPPP/' + back.toUpperCase() + ' w ' + c + ' - 0 1';
  }

  // Rebuilds a position from a start FEN and UCI moves (used by the worker).
  function positionFrom(fen, ucis) {
    const p = new Pos();
    const err = p.load(fen || START_FEN);
    if (err) throw new Error(err);
    for (const u of ucis || []) {
      const m = p.parseMove(u);
      if (m === null || m === undefined) throw new Error('Illegal move in history: ' + u);
      p.make(m);
    }
    return p;
  }

  function uci(m) {
    const promo = mPromo(m);
    return sqName(mFrom(m)) + sqName(mTo(m)) + (promo ? 'pnbrqk'[promo - 1] : '');
  }

  function perft(pos, depth) {
    if (depth === 0) return 1;
    let n = 0;
    for (const m of pos.gen([], false)) {
      if (!pos.make(m)) continue;
      n += depth === 1 ? 1 : perft(pos, depth - 1);
      pos.unmake();
    }
    return n;
  }

  return {
    START_FEN, WHITE, BLACK, P, N, B, R, Q, K, LEVELS, MATE, VALUE, VARIANTS, chess960Fen, CHECKS_TO_WIN,
    onHill: (sq64) => !!HILL[to88(sq64)],
    F_CAP, F_DBL, F_EP, F_CASTLE, F_PROMO, mFlags, parseSq,
    KNIGHT_DIRS, KING_DIRS, BISHOP_DIRS, ROOK_DIRS, ALFIL_DIRS,
    variantOf(fen) { const m = String(fen || '').match(/^([a-z0-9]+):/); return m && VARIANTS[m[1]] ? m[1] : 'standard'; },
    Pos, Game, search, evaluate, perft, positionFrom, uci,
    to64, to88, sqName, mFrom: (m) => to64(mFrom(m)), mTo: (m) => to64(mTo(m)), mPromo,
    pieceAt(pos, sq64) { return pos.b[to88(sq64)]; },
  };
}

if (typeof module !== 'undefined') module.exports = ChacklateEngine;
