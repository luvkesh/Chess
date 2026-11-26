// How hard a puzzle is, and whether two puzzles are really the same one. Used by
// curate-puzzles.js to order the Checkmate in N sets and by the content test to keep them in order
// and free of repeats.
//   features(E, pz)   facts about the position the player solves (after the opponent's set-up move)
//   difficulty(f)     one number: more pieces, more checks to choose from, a quiet or far-off first
//                     move, a less obvious mating piece and more defenders around the king all add
//   twinKeys(E, pz)   keys that match when two puzzles are the same position or the same picture
//                     turned round: colours swapped, the board mirrored left to right (and the
//                     mating idea around the king, which catches a copy with a pawn moved)
'use strict';

const BOARD = (fen) => {
  const b = [];
  for (const row of fen.split(' ')[0].split('/')) {
    const r = [];
    for (const ch of row) if (/\d/.test(ch)) for (let i = 0; i < +ch; i++) r.push('.'); else r.push(ch);
    b.push(r);
  }
  return b;   // b[0] is rank 8
};
const sq = (s) => [s.charCodeAt(0) - 97, +s[1] - 1];   // file, rank

function solvePos(E, pz) { return E.positionFrom(pz.fen, [pz.moves[0]]); }
function mateN(pz) { const t = (pz.themes || []).find((x) => /^mateIn\d$/.test(x)); return t ? +t.slice(6) : 0; }

function features(E, pz) {
  const pos = solvePos(E, pz);
  const fen = pos.fen();
  const b = BOARD(fen);
  const side = fen.split(' ')[1];   // the solver
  const mine = (c) => c !== '.' && (side === 'w' ? c === c.toUpperCase() : c === c.toLowerCase());
  let pieces = 0, myPieces = 0, theirPieces = 0, kf = 0, kr = 0;
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const c = b[r][f];
    if (c === '.') continue;
    pieces++;
    if (c.toLowerCase() === 'k') { if (!mine(c)) { kf = f; kr = 7 - r; } continue; }
    if (mine(c)) myPieces++; else theirPieces++;
  }
  // around the defending king
  let guards = 0;
  for (let dr = -2; dr <= 2; dr++) for (let df = -2; df <= 2; df++) {
    const f = kf + df, r = kr + dr;
    if ((dr || df) && f >= 0 && f < 8 && r >= 0 && r < 8) { const c = b[7 - r][f]; if (c !== '.' && !mine(c)) guards++; }
  }
  const legal = pos.legalMoves();
  let checks = 0, captures = 0;
  for (const m of legal) {
    if (E.mFlags(m) & E.F_CAP) captures++;
    if (pos.make(m)) { if (pos.inCheck()) checks++; pos.unmake(); }
  }
  const first = pz.moves[1];
  const fm = pos.parseMove(first, legal);
  const [ff, fr] = sq(first.slice(0, 2)), [tf, tr] = sq(first.slice(2, 4));
  const mover = b[7 - fr][ff].toLowerCase();
  const capture = !!(E.mFlags(fm) & E.F_CAP);
  pos.make(fm);
  const givesCheck = pos.inCheck();
  pos.unmake();
  const dist = Math.max(Math.abs(tf - kf), Math.abs(tr - kr));
  const travel = Math.max(Math.abs(tf - ff), Math.abs(tr - fr));
  return { n: mateN(pz), pieces, myPieces, theirPieces, guards, legal: legal.length, checks, captures, mover, capture, givesCheck, dist, travel, edge: Math.min(kf, 7 - kf, kr, 7 - kr) };
}

const MOVER = { q: 0, r: 25, b: 45, n: 55, p: 50, k: 70 };
function difficulty(f) {
  let d = 0;
  d += Math.min(28, f.pieces) * 9;                       // a fuller board to read
  d += Math.min(14, f.myPieces + f.theirPieces) * 4;
  d += Math.min(8, f.checks) * 16;                       // more checks to choose between
  d += Math.min(45, f.legal) * 1.5;
  d += f.guards * 10;                                    // defenders near the king
  d += MOVER[f.mover] || 0;                              // a queen mate is the first thing anyone tries
  if (!f.givesCheck) d += 140;                           // a quiet first move is much harder to see
  else if (f.checks === 1) d -= 60;                      // the only check on the board
  if (f.capture) d -= 25;                                // captures catch the eye
  d += Math.min(5, f.dist) * 8 + Math.min(7, f.travel) * 5;
  d += f.edge * 18;                                      // a king in the open takes more nets
  d += (f.n - 1) * 260;
  return Math.round(d);
}
// A "two-piece" mate: so few pieces, and one check, that the answer jumps out.
const trivial = (f) => f.n === 1 && (f.pieces <= 8 || (f.myPieces <= 2 && f.checks <= 2));

function canon(fen) {
  const b = BOARD(fen), side = fen.split(' ')[1];
  // colours swapped and ranks flipped, so the side to move is always White
  const turn = (bd) => bd.slice().reverse().map((r) => r.map((c) => (c === '.' ? c : c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())));
  const base = side === 'w' ? b : turn(b);
  const mirror = (bd) => bd.map((r) => r.slice().reverse());
  const s = (bd) => bd.map((r) => r.join('')).join('/');
  return [s(base), s(mirror(base))].sort()[0];
}
// The mating idea: which piece moves, from where to where relative to the king, and what stands
// next to the king, all turned so the solver is White and the king sits on the left half.
function idea(E, pz) {
  const pos = solvePos(E, pz), fen = pos.fen(), side = fen.split(' ')[1];
  const b = BOARD(fen);
  const flipR = side === 'b';
  let kf = 0, kr = 0;
  const theirK = side === 'w' ? 'k' : 'K';
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) if (b[r][f] === theirK) { kf = f; kr = 7 - r; }
  const mir = kf > 3;
  const norm = (f, r) => [mir ? 7 - f : f, flipR ? 7 - r : r];
  const [ff, fr] = sq(pz.moves[1].slice(0, 2)), [tf, tr] = sq(pz.moves[1].slice(2, 4));
  const [nkf, nkr] = norm(kf, kr), [nff, nfr] = norm(ff, fr), [ntf, ntr] = norm(tf, tr);
  const around = [];
  for (let dr = -1; dr <= 1; dr++) for (let df = -1; df <= 1; df++) {
    const f = kf + df, r = kr + dr;
    if (!(dr || df)) continue;
    let c = f < 0 || f > 7 || r < 0 || r > 7 ? '#' : b[7 - r][f];
    if (c !== '.' && c !== '#') c = (c === c.toUpperCase()) === (side === 'w') ? c.toUpperCase() : c.toLowerCase();
    const [a, z] = [mir ? -df : df, flipR ? -dr : dr];
    around.push((a + 1) + '' + (z + 1) + c);
  }
  around.sort();
  return [b[7 - fr][ff].toLowerCase(), nkf + ',' + nkr, (ntf - nkf) + ',' + (ntr - nkr), (nff - ntf) + ',' + (nfr - ntr), around.join('')].join('|');
}
function twinKeys(E, pz) { return { position: canon(solvePos(E, pz).fen()), idea: mateN(pz) + ':' + idea(E, pz) }; }

// Puzzles a lesson, an era or the placement test names: they stay where they are and out of the
// Checkmate in N sets (the game leaves them out the same way), so a set never repeats Learn.
function namedIds(contentDir) {
  const fs = require('fs'), path = require('path'), out = new Set();
  for (const f of ['lessons.json', 'campaign.json', 'placement.json']) for (const m of fs.readFileSync(path.join(contentDir, f), 'utf8').matchAll(/puzzle\.[0-9a-fm][0-9a-f]{9,}/g)) out.add(m[0]);
  return out;
}

module.exports = { features, difficulty, trivial, twinKeys, mateN, namedIds };
