#!/usr/bin/env node
// Opening practice positions for the Openings trainer, from the Opening lab's lines
// (packages/content/openings.json). Each position is a point in a line where it is the line's
// side to move; the book move is right, and so is any move the engine rates within 25
// centipawns of it. The line's note for that move is kept to explain it afterwards.
//   node tools/generate-openings.js > out.json
'use strict';
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E);
const openings = require('../../content/openings.json').openings;
const cp = (r) => C.toCp(r.score);
const out = [];
const seen = new Set();
for (const o of openings) {
  const me = o.side === 'white' ? E.WHITE : E.BLACK;
  for (let k = 2; k < o.moves.length; k++) {
    const pos = E.positionFrom(E.START_FEN, o.moves.slice(0, k));
    if (pos.side !== me) continue;
    const key = pos.fen().split(' ').slice(0, 2).join(' ');
    if (seen.has(key)) continue;
    seen.add(key);
    const book = o.moves[k];
    const score = (u) => { const m = pos.parseMove(u); pos.make(m); const r = E.search(pos, { timeMs: 160, quiesce: true }); pos.unmake(); return -cp(r); };
    const bookScore = score(book);
    const answers = [book];
    for (const m of pos.legalMoves()) {
      const u = E.uci(m);
      if (u === book) continue;
      if (score(u) >= bookScore - 25) answers.push(u);
    }
    // Too many right answers make it a guessing game: keep positions with a clear idea.
    if (answers.length > 4) continue;
    out.push({ pool: 'opening', fen: pos.fen(), answers, last: o.moves[k - 1], note: o.notes[k] || null, opening: o.id });
    process.stderr.write(o.id + ' ' + k + ' ' + answers.join(',') + '\n');
  }
}
process.stdout.write(JSON.stringify(out));
