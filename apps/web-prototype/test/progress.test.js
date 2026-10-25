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

// Opening lab: three clean runs master a line; three mastered lines earn Repertoire.
s = PG.fresh();
PG.openingFinished(s, 'opening.a', false, day(1));
for (let i = 0; i < 3; i++) PG.openingFinished(s, 'opening.a', true, day(1));
assert(s.openings['opening.a'].mastered && s.openings['opening.a'].runs === 4);
for (const id of ['opening.b', 'opening.c']) for (let i = 0; i < 3; i++) PG.openingFinished(s, id, true, day(1));
assert(s.achievements.repertoire);

// Endgame dojo: stars against par, best kept, failures recorded without XP.
s = PG.fresh();
const eg = { id: 'endgame.x', goal: 'mate', par: 10 };
assert.strictEqual(PG.dojoFinished(s, eg, false, 30, day(1)).stars, 0);
assert.strictEqual(s.xp, 0);
assert.strictEqual(PG.dojoFinished(s, eg, true, 14, day(1)).stars, 2);
assert.strictEqual(PG.dojoFinished(s, eg, true, 9, day(1)).stars, 3);
assert.strictEqual(PG.dojoFinished(s, eg, true, 25, day(1)).stars, 1);
assert.deepStrictEqual(s.dojo['endgame.x'], { stars: 3, best: 9, tries: 4 });
assert.strictEqual(PG.dojoFinished(s, { id: 'endgame.d', goal: 'draw', par: 20 }, true, 20, day(1)).stars, 3);

// Seasons: XP earned while a season runs fills its track; pass items need the pass (or Premium).
const seasons = require('../../../packages/content/seasons.json');
const missions = require('../../../packages/content/missions.json');
const PS = ChacklateProgress(catalog, { seasons, missions });
const S1 = seasons.seasons[0];
const inSeason = Date.parse(S1.starts + 'T12:00:00') + 86400000;
s = PS.fresh();
assert.strictEqual(PS.setSeason(s, Date.parse('2000-01-01')), null);
assert.strictEqual(s.season, '');
PS.gameFinished(s, Object.assign({}, win, { plies: 60 }), day(1));
assert.deepStrictEqual(s.seasons, {}, 'no season XP between seasons');
assert.strictEqual(PS.setSeason(s, inSeason).id, S1.id);
const freeItem = catalog.items.find((i) => i.unlock.type === 'season' && i.unlock.track === 'free');
const passItem = catalog.items.find((i) => i.unlock.type === 'season' && i.unlock.track === 'pass' && i.unlock.tier >= freeItem.unlock.tier);
assert(freeItem && passItem);
const top = Math.max(freeItem.unlock.tier, passItem.unlock.tier);
let sawTier = 0, sawFree = false, sawPass = false;
while (PS.tierOf(s, S1.id) < top) {
  const out = PS.puzzleFinished(s, { id: 'px', rating: 2000 }, true, null, inSeason);
  if (out.seasonTier) sawTier = out.seasonTier;
  if (out.unlocked.some((u) => u.id === freeItem.id)) sawFree = true;
  if (out.unlocked.some((u) => u.id === passItem.id)) sawPass = true;
}
assert(sawTier >= top && sawFree && !sawPass);
assert(PS.isUnlocked(s, freeItem) && !PS.isUnlocked(s, passItem));
s.passes.push(S1.id);
assert(PS.isUnlocked(s, passItem), 'buying the pass later unlocks earned pass tiers');
s.passes = []; s.premium = true;
assert(PS.isUnlocked(s, passItem), 'Premium includes the pass');
const info = PS.seasonInfo(s, S1.id);
assert(info.tier >= top && info.into >= 0 && info.into <= info.need && info.items.length >= 10);
assert(/tier \d+ · Season Pass/.test(PS.unlockText(passItem)));
s.seasons[S1.id] = 1e9;
assert.strictEqual(PS.tierOf(s, S1.id), S1.tiers, 'tier caps at the last one');

// Daily missions: the same three for a date, different events, online only when available.
s = PS.fresh();
const ml = PS.missionList(s, day(3));
assert.strictEqual(ml.length, missions.perDay);
assert.strictEqual(new Set(ml.map((x) => x.event)).size, ml.length);
assert(ml.every((x) => x.event !== 'online'));
assert.deepStrictEqual(PS.missionList(PS.fresh(), day(3)).map((x) => x.id), ml.map((x) => x.id));
let anyOnline = false;
for (let d = 1; d <= 28; d++) if (PS.missionList(PS.fresh(), day(d), { online: true }).some((x) => x.event === 'online')) anyOnline = true;
assert(anyOnline);
// Complete whatever today's missions are and collect the all-done bonus once.
s = PS.fresh();
const todays = PS.missionList(s, day(4));
const doEvent = (ev) => {
  if (ev === 'game' || ev === 'win') return PS.gameFinished(s, Object.assign({}, win, { plies: 60 }), day(4));
  if (ev === 'puzzle') return PS.puzzleFinished(s, { id: 'q', rating: 900 }, true, null, day(4));
  if (ev === 'daily') return PS.puzzleFinished(s, { id: 'q', rating: 900 }, true, { daily: true }, day(4));
  if (ev === 'lesson') return PS.lessonFinished(s, lessons[0], 3, 3, lessons, day(4));
  if (ev === 'drill') return PS.openingFinished(s, 'opening.a', true, day(4));
  if (ev === 'dojo') return PS.dojoFinished(s, eg, true, 5, day(4));
  if (ev === 'review') return PS.reviewFinished(s, { summary: { accuracy: { 0: 80 } }, plies: [] }, 0, 30, day(4));
};
let bonus = 0, done = [];
for (let k = 0; k < 10 && !s.missions.list.every((x) => x.done); k++) for (const t of todays) { const o = doEvent(t.event); if (o) { done.push(...o.missions.map((x) => x.id)); if (o.missionsAll) bonus++; } }
assert(s.missions.list.every((x) => x.done));
assert.strictEqual(bonus, 1);
assert.deepStrictEqual([...new Set(done)].sort(), todays.map((x) => x.id).sort());
// Short games do not count.
s = PS.fresh();
const shortDay = PS.missionList(s, day(5));
PS.gameFinished(s, Object.assign({}, win, { plies: 2 }), day(5));
assert(s.missions.list.every((x) => x.n === 0 || !['game', 'win'].includes(shortDay.find((d) => d.id === x.id).event)));

// Migration keeps known fields and fills new ones.
const m = PG.migrate({ v: 1, xp: 123, stats: { games: 4 } });
assert.strictEqual(m.xp, 123);
assert.strictEqual(m.stats.games, 4);
assert.strictEqual(m.stats.puzzles.rating, 800);
assert.deepStrictEqual(PG.migrate({ v: 99 }), PG.fresh());

console.log('progress ok');
