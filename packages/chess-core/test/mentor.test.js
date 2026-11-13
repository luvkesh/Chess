// Mentor: grades, feedback levels, hints, plans, openings, endgames, mate patterns, the report and the profile.
// Searches are short, so the checks below only use positions with one clear answer.
const assert = require('assert');
const E = require('../src/engine.js')();
const C = require('../src/coach.js')(E);
const M = require('../src/mentor.js')(E, C);
const fs = require('fs');
const path = require('path');

const T = { timeMs: 120 };
const noHoles = (s, what) => assert(!/\{\w+\}|undefined|null|NaN/.test(s), what + ': ' + s);

// Every named opening and trap is a legal line from the start.
for (const o of M.BOOK.concat(M.TRAPS)) {
  const p = E.positionFrom(E.START_FEN, []);
  for (const s of o.sans) { const m = p.parseMove(s); assert(m !== null && m !== undefined, o.name + ': ' + s + ' is not legal'); p.make(m); }
}
// The opening is named, and leaving the book is noticed on the move that leaves it.
assert.strictEqual(M.opening(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']).name, 'Ruy Lopez, Morphy Defence');
assert.strictEqual(M.opening(['e4', 'c5', 'Nf3', 'd6', 'd4']).name, 'Open Sicilian');
let o = M.opening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7']);
assert(o.left && o.name === 'Italian Game', JSON.stringify(o));
o = M.opening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7', 'd3']);
assert(!o.left, 'only the move that leaves the book counts');
assert(M.opening(['d4', 'Nf6', 'c4']).next.includes('g6'));
// A trap is seen by the side walking into it, not by the other side.
assert.strictEqual((M.trapAhead(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4'], E.BLACK) || {}).name, 'Scholar\'s Mate');
assert.strictEqual(M.trapAhead(['e4', 'e5', 'Qh5', 'Nc6', 'Bc4'], E.WHITE), null);

// Five grades.
assert.strictEqual(M.gradeOf('brilliant', null, false), 'excellent');
assert.strictEqual(M.gradeOf('inaccuracy', null, false), 'inaccurate');
assert.strictEqual(M.gradeOf('excellent', null, false), 'good');
const quiet = C.facts(E.positionFrom(E.START_FEN, []), E.positionFrom(E.START_FEN, []).parseMove('g1f3'));
assert.strictEqual(M.gradeOf('best', quiet, false), 'good', 'a plain best move is Good');
assert.strictEqual(M.gradeOf('best', quiet, true), 'excellent', 'the only good move is Excellent');

// A blunder that allows mate: graded, explained at three depths, and never repeating itself.
const scholar = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6'];
const st = M.study(E.START_FEN, scholar, T);
assert.strictEqual(st.cls, 'blunder');
const fb = M.feedback(st, { style: 'friendly', rand: () => 0 });
assert.strictEqual(fb.grade, 'blunder');
assert(/checkmate/i.test(fb.text[0]) && /Qxf7#/.test(fb.text[0]), fb.text[0]);
for (let d = 1; d <= 3; d++) noHoles(M.feedbackText(fb, d), 'feedback ' + d);
const lv3 = M.feedbackText(fb, 3);
assert.strictEqual(lv3.split('Qxf7#').length - 1, 1, 'the refutation is said once: ' + lv3);
assert(M.OPENERS.blunder.f.some((x) => fb.head === x), 'a blunder gets a blunder opener');
// openers rotate: the recent ones are skipped
const seen = [];
for (let i = 0; i < M.OPENERS.good.f.length; i++) { const k = M.openerKey('good', 'friendly', 'middlegame', seen); assert(!seen.includes(k), 'repeated ' + k); seen.push(k); }
// the detailed analysis covers the sections and fills every hole
const det = M.detail(st);
for (const h of ['Why', 'Tactics', 'King safety', 'Material', 'Best reply']) assert(det.sections.some((x) => x.head === h), 'detail has ' + h);
for (const x of det.sections) for (const l of x.lines) noHoles(l, x.head);

// The position after the blunder: the mate radar names the pattern, hints go from direction to the move.
let lk = M.look(E.START_FEN, scholar, T);
const radar = M.mateRadar(lk);
assert(radar.mine && radar.mine.n === 1 && radar.mine.pattern === 'scholar', JSON.stringify(radar));
const h = M.hints(lk);
assert(/check/i.test(h.levels[0].text) && !/f7|Qxf7/.test(h.levels[0].text), 'level 1 gives no move away: ' + h.levels[0].text);
assert(/queen on h5/.test(h.levels[1].text) && !/f7/.test(h.levels[1].text), h.levels[1].text);
assert(/Qxf7#/.test(h.levels[2].text), h.levels[2].text);
assert.strictEqual(M.chances(lk)[0].id, 'mate');
// Before the blunder, Black is warned about the threat.
lk = M.look(E.START_FEN, scholar.slice(0, 5), T);
assert(M.threats(lk).some((x) => /checkmate/i.test(x.text)), 'threat of mate is shown');
assert(M.threats(lk, M.threats(lk).map((x) => x.id)).length === 0, 'a warning already shown is not repeated');
const guide = M.phaseGuide(lk, 'beginner');
assert(guide.lines.some((l) => /Scholar/.test(l)), guide.lines.join(' | '));
// Mistake prevention catches the blunder and lets a good move through.
let ck = M.check(E.START_FEN, scholar.slice(0, 5), 'g8f6', T);
assert(!ck.ok && /checkmate/i.test(M.warning(ck).text), JSON.stringify(ck && ck.grade));
ck = M.check(E.START_FEN, scholar.slice(0, 5), 'd8e7', T);
assert(ck.ok, 'Qe7 is fine');
// Think ahead: up to four legal moves, alternating sides.
const ta = M.thinkAhead(lk);
assert(ta.steps.length >= 2 && ta.steps[0].mine && !ta.steps[1].mine);
{ const p = E.positionFrom(E.START_FEN, scholar.slice(0, 5)); for (const s of ta.steps) { const m = p.parseMove(s.san); assert(m !== null && m !== undefined, 'think-ahead move ' + s.san); p.make(m); } }

// Mating patterns.
const patternAfter = (fen, uci) => { const p = E.positionFrom(fen, []); const m = p.parseMove(uci); p.make(m); assert(!p.legalMoves().length && p.inCheck(), fen + ' ' + uci + ' is mate'); return M.matePattern(p, m); };
assert.strictEqual(patternAfter('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1', 'a1a8'), 'backRank');
assert.strictEqual(patternAfter('6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', 'g5f7'), 'smothered');
assert.strictEqual(patternAfter('k7/7Q/1K6/8/8/8/8/8 w - - 0 1', 'h7b7'), 'kiss');

// Endgames: the rule of the square, the opposition, rooks behind passed pawns, the stalemate trap.
let a = M.assess(E.positionFrom('8/8/8/8/8/k7/6P1/6K1 w - - 0 1', []), E.WHITE);
assert(a.phase === 'endgame' && a.endgame.runs.includes('g2'), 'the g-pawn outruns the king');
a = M.assess(E.positionFrom('8/8/8/8/5k2/8/6P1/6K1 w - - 0 1', []), E.WHITE);
assert(a.endgame.caught.includes('g2'));
a = M.assess(E.positionFrom('8/8/4k3/8/4K3/4P3/8/8 b - - 0 1', []), E.BLACK);
assert.strictEqual(a.endgame.opposition, -1, 'White has the opposition');
a = M.assess(E.positionFrom('8/P7/8/8/8/5k2/8/R5K1 w - - 0 1', []), E.WHITE);
assert(a.endgame.rookBehind, 'Ra1 is behind the a7 pawn');
a = M.assess(E.positionFrom('8/P7/8/8/8/5k2/8/6KR w - - 0 1', []), E.WHITE);
assert(!a.endgame.rookBehind);
a = M.assess(E.positionFrom('k7/8/1Q6/8/8/8/8/6K1 w - - 0 1', []), E.WHITE);
assert(a.endgame.basicMate === 'Q');

// Middlegame facts: pins and overloaded pieces.
a = M.assess(E.positionFrom('4k3/8/8/8/1b6/2N5/8/4K3 w - - 0 1', []), E.WHITE);
assert(a.pins.me.some((p) => p.sq === 'c3' && p.absolute), 'Nc3 is pinned to the king');

// The game report and the profile, from a real review.
const ucis = ['f2f3', 'e7e5', 'g2g4', 'd8h4'];
const rv = C.review(E.START_FEN, ucis, { timeMs: 60 });
const rep = M.report(rv, E.START_FEN, ucis, { side: E.WHITE, result: '0-1' });
assert.strictEqual(rep.result, 'loss');
assert(rep.counts.blunder >= 1 && rep.biggest && rep.biggest.san === 'g4', JSON.stringify(rep.biggest));
assert(rep.recs.length >= 1 && rep.recs.length <= 3 && rep.recs[0].id === 'mate', JSON.stringify(rep.recs));
assert.strictEqual(rep.breakdown.length, 6);
let prof;
for (let i = 0; i < 3; i++) prof = M.profileAdd(prof, rep, { standard: true });
const ins = M.insights(prof);
assert(ins.weak.some((w) => w.id === 'mate'), JSON.stringify(ins.weak));

// Settings: modes fill the settings, and the old one-word setting migrates.
assert.strictEqual(M.modeOf(Object.assign({}, M.DEFAULTS)), 'learning');
assert.strictEqual(M.modeOf(Object.assign({}, M.DEFAULTS, M.MODES.silent)), 'silent');
assert.strictEqual(M.modeOf(Object.assign({}, M.DEFAULTS, { depth: 1 })), 'custom');
assert.strictEqual(M.migrate('off').on, false);
assert.strictEqual(M.migrate('chatty').mode, 'mentor');
assert(!M.shouldComment(Object.assign({}, M.DEFAULTS), 'good'), 'important moves only');
assert(M.shouldComment(Object.assign({}, M.DEFAULTS, { freq: 'every' }), 'good'));
assert(!M.shouldComment(Object.assign({}, M.DEFAULTS, { auto: false }), 'blunder'), 'never more active than asked');

// Words to know.
assert.deepStrictEqual(M.termsIn('This allows Ng5, forking your queen and rook.').sort(), ['fork']);
assert.strictEqual(M.glossary('beginner').length, M.TERMS.length);

// Speech: every coach line is said from recorded pieces, never made up on the device.
for (let d = 1; d <= 3; d++) assert(M.speechParts(M.feedbackText(fb, d)), 'feedback ' + d + ' can be said');
for (const x of det.sections) for (const l of x.lines) assert(M.speechParts(l), 'detail can be said: ' + l);
for (const l of h.levels) assert(M.speechParts(l.text), 'hint can be said: ' + l.text);
for (const x of rep.well.concat(rep.struggle, [rep.focus])) assert(M.speechParts(x), 'report can be said: ' + x);
assert.deepStrictEqual(M.speechParts('This allows Ng5, forking your queen.').filter((x) => !x.pause).map((x) => x.san || x.line), ['This allows', 'Ng5', ', forking your', 'queen']);
assert.strictEqual(M.speechParts('Zebras dance on e4.'), null, 'a piece with no recording is not said');
for (const [k, v] of Object.entries(M.EN)) if (!/\{/.test(v)) assert(M.speechParts(v), 'line ' + k + ' can be said');

// Every English line is used somewhere, and none has a typo'd placeholder.
const src = fs.readFileSync(path.join(__dirname, '../src/mentor.js'), 'utf8');
for (const [k, v] of Object.entries(M.EN)) {
  assert(!/\{\w*$|^\w*\}/.test(v), k);
  if (/^(op|opp|ln|v|trap|ph|k|mr|hi\.idea|rp|eg)\./.test(k)) continue;
  assert(src.split("'" + k + "'").length - 1 >= 2, 'unused line ' + k);
}
// A move that wins a variant game on the spot is hinted as a win, with no reply after it.
for (const [fen, san, word] of [['koth:r3k3/8/8/8/8/3K4/8/R6q w - - 0 1', 'Kd4', 'hill'], ['chaturanga:4k3/8/8/8/8/2n5/8/2R1K3 w - - 0 1', 'Rxc3', 'alone']]) {
  const h = M.hints(M.look(fen, [], { timeMs: 300 }));
  assert.strictEqual(h.san, san, fen);
  assert(!/check/i.test(h.levels[0].text) && h.levels[2].text.includes(word) && !/If they answer/.test(h.levels[2].text), fen + ': ' + h.levels.map((l) => l.text).join(' | '));
}
console.log('mentor tests passed');
