#!/usr/bin/env node
// Rebuilds the Checkmate in 1 to 5 sets of packages/content/puzzles.json from the puzzles already
// there plus new finds from generate-mates.js (JSON lines files), so that every set
//   - holds no repeats: no position twice (colours swapped or board mirrored counts as the same),
//     and no two puzzles with the same mating idea around the king (a copy with a pawn moved);
//   - keeps only a few "two-piece" mates in one, spread through the easy part, not bunched at the start;
//   - runs from easy to hard: each puzzle's rating follows its difficulty (puzzle-quality.js), so the
//     set, played in rating order, climbs smoothly;
//   - leaves every puzzle a lesson, era or the placement test names as it is, and out of the sets.
//   node tools/curate-puzzles.js [--want=1:100,2:100,3:60,4:40,5:30] finds.jsonl...  (rewrites puzzles.json)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const E = require('../src/engine.js')();
const M = require('../src/mates.js')(E);
const Q = require('./puzzle-quality.js');

const root = path.join(__dirname, '..', '..', '..');
const file = path.join(root, 'packages', 'content', 'puzzles.json');
const args = process.argv.slice(2);
const want = Object.fromEntries((args.find((a) => a.startsWith('--want=')) || '--want=1:100,2:100,3:60,4:40,5:30').slice(7).split(',').map((x) => x.split(':').map(Number)));
const finds = args.filter((a) => !a.startsWith('--')).flatMap((f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
const RANGE = { 1: [600, 1400], 2: [900, 1700], 3: [1150, 1900], 4: [1350, 2100], 5: [1500, 2300] };
const TRIVIAL_KEEP = 4;

// ids a lesson, era or the placement test names: kept as they are and left out of the sets
const named = Q.namedIds(path.join(root, 'packages', 'content'));

const all = JSON.parse(fs.readFileSync(file, 'utf8'));
const others = all.filter((p) => !Q.mateN(p) || named.has(p.id));
const pool = all.filter((p) => Q.mateN(p) && !named.has(p.id)).map((p) => ({ p, old: true }));
// a named puzzle's position and idea still count, so no set puzzle copies one
const seenPos = new Map(), seenIdea = new Map();
for (const p of all) if (named.has(p.id)) { const k = Q.twinKeys(E, p); seenPos.set(k.position, p.id); if (Q.mateN(p)) seenIdea.set(k.idea, p.id); }
for (const x of finds) {
  const n = Q.mateN(x);
  if (!n || !RANGE[n]) continue;
  const id = 'puzzle.m' + n + crypto.createHash('sha1').update(x.fen + ' ' + x.moves.join(' ')).digest('hex').slice(0, 10);
  pool.push({ p: { id, fen: x.fen, moves: x.moves, themes: ['mateIn' + n], rating: 0 }, old: false });
}

const sets = {};
// named first, then puzzles players already have, then new ones: the earlier copy of a twin is kept
pool.sort((a, b) => b.old - a.old);
let dropped = { twin: 0, trivial: 0, unproved: 0, cut: 0 };
for (const x of pool) {
  const n = Q.mateN(x.p);
  let f;
  try { f = Q.features(E, x.p); } catch (e) { dropped.unproved++; continue; }
  const k = Q.twinKeys(E, x.p);
  const keep = named.has(x.p.id);
  if (!keep && (seenPos.has(k.position) || seenIdea.has(k.idea))) { dropped.twin++; continue; }
  if (!x.old) {
    // new finds are proved again here: a forced mate in exactly n with one first move
    const pos = E.positionFrom(x.p.fen, [x.p.moves[0]]);
    let ok = false;
    try { const ms = M.matingMoves(pos, n, 4e6); ok = ms && ms.length === 1 && ms[0] === x.p.moves[1] && (n === 1 || !M.attack(pos, n - 1, 4e6)); } catch (e) { ok = false; }
    if (!ok) { dropped.unproved++; continue; }
  }
  seenPos.set(k.position, x.p.id); seenIdea.set(k.idea, x.p.id);
  (sets[n] = sets[n] || []).push({ p: x.p, f, d: Q.difficulty(f), trivial: Q.trivial(f), keep, old: x.old });
}

const out = [];
for (const n of Object.keys(sets).map(Number).sort()) {
  let s = sets[n];
  // a few easy mates stay; the rest of the two-piece mates go (never one a lesson names)
  const triv = s.filter((x) => x.trivial && !x.keep).sort((a, b) => b.d - a.d);
  const drop = new Set(triv.slice(TRIVIAL_KEEP).map((x) => x.p.id));
  dropped.trivial += drop.size;
  s = s.filter((x) => !drop.has(x.p.id));
  // too many: cut the easiest first (old or new), so the set leans harder
  const limit = want[n] || s.length;
  if (s.length > limit) {
    const cuttable = s.filter((x) => !x.keep && !x.trivial).sort((a, b) => a.d - b.d);
    const cut = new Set(cuttable.slice(0, s.length - limit).map((x) => x.p.id));
    dropped.cut += cut.size; s = s.filter((x) => !cut.has(x.p.id));
  }
  // order by difficulty; the easy ones are spread through the first third (places 2, 6, 11, 17)
  const main = s.filter((x) => !x.trivial).sort((a, b) => a.d - b.d);
  const easy = s.filter((x) => x.trivial).sort((a, b) => a.d - b.d);
  const spots = [1, 5, 10, 16];
  easy.forEach((x, i) => main.splice(Math.min(main.length, spots[i] !== undefined ? spots[i] : main.length), 0, x));
  const [lo, hi] = RANGE[n];
  main.forEach((x, i) => { x.p.rating = Math.round((lo + (hi - lo) * (main.length === 1 ? 0 : i / (main.length - 1))) / 5) * 5; out.push(x.p); });
  console.error('mate in ' + n + ': ' + main.length + ' puzzles, ' + main.filter((x) => !x.old).length + ' new, ' + easy.length + ' easy');
}
console.error('dropped', dropped);
fs.writeFileSync(file, JSON.stringify(others.concat(out), null, 1) + '\n');
