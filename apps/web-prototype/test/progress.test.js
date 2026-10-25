// Progression rules: XP, levels, achievements, streaks, unlocks and puzzle ratings.
const assert = require('assert');
const ChacklateProgress = require('../src/progress.js');
const catalog = require('../../../packages/content/catalog.json');
const lessons = require('../../../packages/content/lessons.json').lessons;

const PG = ChacklateProgress(catalog);
const day = (d) => Date.parse('2026-10-' + String(d).padStart(2, '0') + 'T12:00:00');

// Levels are monotonic and titled.
let prev = 0;
for (let xp = 0; xp < 20000; xp += 137) { const l = PG.levelFor(xp); assert(l.level >= prev); assert(l.title); assert(l.into >= 0 && l.into < l.need); prev = l.level; }
assert.strictEqual(PG.levelFor(0).level, 1);

// A first win against Truffle grants achievements and XP; instant resignations do not farm XP.
let s = PG.fresh();
const win = { mode: 'ai', level: 0, won: true, plies: 30, sans: [], firstIsMine: true, reason: 'checkmate' };
const r = PG.gameFinished(s, win, day(1));
const ids = r.achievements.map((a) => a.id);
for (const id of ['first-game', 'first-win', 'beat-truffle', 'quick-mate']) assert(ids.includes(id), id);
assert(s.xp > 40 && s.stats.wins === 1 && s.stats.byLevel[0].w === 1);
const s2 = PG.fresh();
PG.gameFinished(s2, { mode: 'ai', level: 7, won: true, plies: 2, sans: [], firstIsMine: true, reason: 'resignation' }, day(1));
assert(s2.xp <= 5 + 20, 'short games are capped');
assert(!s2.achievements['beat-gm']);

// Streaks: consecutive days count up, a gap resets.
s = PG.fresh();
for (const d of [1, 2, 3]) PG.gameFinished(s, Object.assign({}, win, { plies: 60 }), day(d));
assert.strictEqual(s.streak.count, 3);
assert(s.achievements['streak-3']);
PG.gameFinished(s, Object.assign({}, win, { plies: 60 }), day(6));
assert.strictEqual(s.streak.count, 1);

// Puzzle rating moves toward the result and never below 100.
s = PG.fresh();
const before = s.stats.puzzles.rating;
assert(PG.puzzleFinished(s, { id: 'p1', rating: 1200 }, true, null, day(1)).ratingDelta > 0);
assert(s.stats.puzzles.rating > before);
for (let i = 0; i < 200; i++) PG.puzzleFinished(s, { id: 'p' + i, rating: 2500 }, false, null, day(1));
assert(s.stats.puzzles.rating >= 100);
assert.strictEqual(s.stats.puzzles.seen.length, 200);

// Lessons: mastery at 80% first-try, chapter achievements, spaced reviews.
s = PG.fresh();
const ch1 = lessons.filter((l) => l.chapter === 1);
for (const l of ch1) PG.lessonFinished(s, l, 4, 5, lessons, day(1));
assert(s.achievements['chapter-1']);
assert(Object.values(s.lessons).every((x) => x.mastered && x.stars === 2 && x.reviews.length === 3));

// Level unlocks: every level-gated cosmetic unlocks once the level is reached.
s = PG.fresh();
const gated = catalog.items.filter((i) => i.unlock.type === 'level');
assert(gated.length > 0);
for (const it of gated) assert(!PG.isUnlocked(s, it) || it.unlock.level <= 1, it.id);
s.xp = 1e6;
for (const it of gated) assert(PG.isUnlocked(s, it), it.id);

// Migration keeps known fields and fills new ones.
const m = PG.migrate({ v: 1, xp: 123, stats: { games: 4 } });
assert.strictEqual(m.xp, 123);
assert.strictEqual(m.stats.games, 4);
assert.strictEqual(m.stats.puzzles.rating, 800);
assert.deepStrictEqual(PG.migrate({ v: 99 }), PG.fresh());

console.log('progress ok');
