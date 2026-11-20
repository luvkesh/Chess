#!/usr/bin/env node
// Every sound move counts. The trainer generator stored the engine's single first choice as the
// answer, so a player who found another equally good move was told "not the move we are looking
// for" and had to guess what the computer had in mind. This tool scores every legal move of every
// trainer position with a longer think and widens `answers` to all moves that give away almost
// nothing (less than 5% winning chance and at most 0.6 pawns against the best move). When the best
// move mates, only moves that still force mate count. Opening positions also accept every move from
// the opening book (openings.json and the mentor's book) that is not a mistake.
// answers[0] stays the stored main move (hints and "the strongest move was" use it), and `played`
// in the mistake pool can never become an answer. Positions where nearly every move wins are dropped
// (see dropped), and a stored answer the longer think finds weaker moves behind the best one.
//   node tools/accept-trainer-moves.js [pool,pool] [part/of]   writes JSON lines to stdout
//   node tools/accept-trainer-moves.js --merge file.jsonl...    updates packages/content/trainers.json
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E);
const M = require('../src/mentor.js')(E, C);

const FILE = path.join(__dirname, '../../content/trainers.json');
const OPENINGS = path.join(__dirname, '../../content/openings.json');
// Pools whose positions ask for "a good / the best move". Mate pools (blind, patterns) already accept
// any checkmate in the app, intuition is a pick-one-of-three, and the 360 trainer's first half asks
// for the opponent's threat (its second half uses the defence pool).
const POOLS = ['opening', 'quick', 'tactics', 'resource', 'advantage', 'endgame', 'safe', 'defence', 'mistake'];
const THINK = Number(process.env.THINK || 450);
const WP = 0.05, CP = 60;

const cp = (r) => C.toCp(r.score);
const key = (fen) => fen.split(' ').slice(0, 4).join(' ');

// Book moves by position: every position on a line from the opening book, and the moves played from it.
function bookMoves() {
  const out = new Map();
  const add = (moves) => {
    const g = new E.Game();
    for (const u of moves) {
      const k = key(g.pos.fen());
      if (!out.has(k)) out.set(k, new Set());
      out.get(k).add(u);
      g.playText(u);
    }
  };
  for (const o of JSON.parse(fs.readFileSync(OPENINGS, 'utf8')).openings) {
    add(o.moves);
    for (const v of o.variations || []) if (Array.isArray(v.moves)) add(v.moves);
  }
  for (const o of M.BOOK) {
    const g = new E.Game(), ucis = [];
    try { for (const s of o.sans) { const info = g.playText(s.replace(/[+#!?]+$/, '')); if (!info) break; ucis.push(g.uciMoves()[g.uciMoves().length - 1]); } } catch (e) { /* a line that does not parse adds what it could */ }
    add(ucis);
  }
  return out;
}

// An opening move that follows the usual advice: castle, bring a knight or bishop out from home
// (not to the edge), push a centre pawn (c, d or e file), or take something back.
function principled(pos, u) {
  const sq = (s) => (s.charCodeAt(0) - 97) + 8 * (s.charCodeAt(1) - 49);
  const from = sq(u.slice(0, 2)), to = sq(u.slice(2, 4)), kind = Math.abs(E.pieceAt(pos, from));
  const home = pos.side === E.WHITE ? 0 : 7, ff = from & 7, tf = to & 7, fr = from >> 3;
  if (E.pieceAt(pos, to)) return true;
  if (kind === E.K) return Math.abs(tf - ff) === 2;
  if (kind === E.N || kind === E.B) return fr === home && tf >= 1 && tf <= 6;
  if (kind === E.P) return ff >= 2 && ff <= 4;
  return false;
}

// Every legal move scored from the mover's view, best first. A quick pass first; the moves within
// 2.5 pawns of its best get the full think, the rest keep their quick score (they are out anyway).
function scoreAll(pos) {
  const one = (m, ms) => {
    pos.make(m);
    let s;
    if (!pos.legalMoves().length) s = pos.inCheck() ? E.MATE : 0;
    else s = -E.search(pos, { timeMs: ms, quiesce: true }).score;
    pos.unmake();
    return { u: E.uci(m), m, score: s, cp: C.toCp(s), mate: C.mateIn(s) };
  };
  const quick = pos.legalMoves().map((m) => one(m, 50)).sort((a, b) => b.cp - a.cp);
  const out = quick.map((q) => (q.cp >= quick[0].cp - 250 ? one(q.m, THINK) : q));
  return out.sort((a, b) => b.cp - a.cp);
}

function accept(x, pool, book) {
  const pos = new E.Pos();
  if (pos.load(x.fen)) return null;
  const all = scoreAll(pos);
  const top = all[0];
  const good = (s) => {
    if (x.played && s.u === x.played) return false;
    if (top.mate > 0) return s.mate > 0;           // the best move mates: only moves that still force mate
    return C.winProb(top.cp) - C.winProb(s.cp) < WP && top.cp - s.cp <= CP;
  };
  const ok = new Set(x.answers);
  const bk = pool === 'opening' ? book.get(key(x.fen)) || new Set() : null;
  for (const s of all) {
    if (x.played && s.u === x.played) continue;
    if (bk) {
      // In the opening a short think rates many moves alike, so a move the book does not name must
      // also follow an opening principle (see principled) and be within 0.4 pawns of the best.
      if (bk.has(s.u) && C.winProb(top.cp) - C.winProb(s.cp) < 0.1) ok.add(s.u);
      else if (good(s) && top.cp - s.cp <= 40 && principled(pos, s.u)) ok.add(s.u);
    } else if (good(s)) ok.add(s.u);
  }
  const byU = new Map(all.map((s) => [s.u, s]));
  const rest = Array.from(ok).filter((u) => !x.answers.includes(u)).sort((a, b) => byU.get(b).cp - byU.get(a).cp);
  // a stored answer the longer think finds clearly weaker is reported, not silently kept
  const weak = x.answers.filter((u) => !good(byU.get(u)) && !(bk && bk.has(u)));
  return { pool, id: x.id, answers: x.answers.concat(rest), top: top.u, topCp: top.cp, weak: weak.map((u) => [u, byU.get(u).cp]) };
}

// A position stops being a lesson when almost every move wins: a "tactic" with five or more winning
// moves, or an endgame with more than six, is dropped from its pool. So is a quick position where the
// side to move is already getting mated.
function dropped(r) {
  if (['tactics', 'quick', 'blind'].includes(r.pool) && r.answers.length > 4) return 'too many winning moves';
  if (['endgame', 'advantage'].includes(r.pool) && r.answers.length > 6) return 'too many winning moves';
  if (r.pool === 'quick' && r.topCp < -300) return 'already lost';
  return null;
}
// The file's own layout: one trainer or item per line, ", " and ": " between parts.
function py(v) {
  if (Array.isArray(v)) return '[' + v.map(py).join(', ') + ']';
  if (v && typeof v === 'object') return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + py(x)).join(', ') + '}';
  return JSON.stringify(v);
}

if (process.argv[2] === '--merge') {
  const T = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  let n = 0, widened = 0;
  const gone = new Set();
  for (const f of process.argv.slice(3)) {
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const r = JSON.parse(line);
      const x = (T.items[r.pool] || []).find((y) => y.id === r.id);
      if (!x) continue;
      const why = dropped(r);
      if (why) { gone.add(r.id); process.stderr.write('dropped ' + r.pool + ' ' + r.id + ': ' + why + '\n'); continue; }
      let answers = r.answers;
      // a stored answer the longer think finds weaker than the best: the best goes first (hints and
      // "the strongest move was" use answers[0]); the stored one still counts
      if (r.weak.length) { answers = [r.top].concat(answers.filter((u) => u !== r.top)); process.stderr.write('best move first ' + r.pool + ' ' + r.id + ' ' + JSON.stringify(r.weak) + ' best ' + r.top + ' ' + r.topCp + '\n'); }
      if (answers.length > x.answers.length) widened++;
      x.answers = answers; x.checked = true; n++;
    }
  }
  for (const k of Object.keys(T.items)) T.items[k] = T.items[k].filter((x) => !gone.has(x.id));
  const text = '{\n "version": ' + T.version + ',\n "note": ' + JSON.stringify(T.note) + ',\n "trainers": [\n' + T.trainers.map((t) => '  ' + py(t)).join(',\n') + '\n ],\n "items": {\n' +
    Object.entries(T.items).map(([k, v]) => '  ' + JSON.stringify(k) + ': [\n' + v.map((x) => '   ' + py(x)).join(',\n') + '\n  ]').join(',\n') + '\n }\n}\n';
  fs.writeFileSync(FILE, text);
  process.stderr.write('merged ' + n + ' positions, ' + widened + ' now accept more moves, ' + gone.size + ' dropped\n');
} else {
  const pools = process.argv[2] ? process.argv[2].split(',') : POOLS;
  const [part, of] = (process.argv[3] || '0/1').split('/').map(Number);
  const T = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const book = bookMoves();
  let i = 0;
  for (const pool of pools) {
    for (const x of T.items[pool] || []) {
      if (i++ % of !== part || x.mate) continue;
      const r = accept(x, pool, book);
      if (r) process.stdout.write(JSON.stringify(r) + '\n');
    }
  }
}
