// Chacklate progression: XP, levels, achievements, streaks, stats and
// cosmetic unlocks. Pure functions over a plain state object, so the page can
// save it locally and the platform API can store the same shape per account.
function ChacklateProgress(catalog) {
  'use strict';
  const TITLES = [[1, 'Cocoa Bean'], [5, 'Apprentice'], [10, 'Chocolatier'], [15, 'Maître'], [20, 'Grand Maître']];
  const ACHIEVEMENTS = [
    { id: 'first-game', name: 'First move', desc: 'Finish your first game.', xp: 20 },
    { id: 'first-win', name: 'First win', desc: 'Beat a computer opponent.', xp: 40 },
    { id: 'beat-truffle', name: 'Sweet start', desc: 'Beat Truffle.', xp: 20 },
    { id: 'beat-builder', name: 'Foundations', desc: 'Beat Builder.', xp: 30 },
    { id: 'beat-rusher', name: 'Hold the line', desc: 'Beat Rusher.', xp: 40 },
    { id: 'beat-wall', name: 'Wall breaker', desc: 'Beat Wall.', xp: 60 },
    { id: 'beat-trickster', name: 'No tricks on me', desc: 'Beat Trickster.', xp: 80 },
    { id: 'beat-strategist', name: 'Master plan', desc: 'Beat Strategist.', xp: 100 },
    { id: 'beat-tactician', name: 'Sharper still', desc: 'Beat Tactician.', xp: 150 },
    { id: 'beat-gm', name: 'Grandmaster slayer', desc: 'Beat Grandmaster mode.', xp: 300 },
    { id: 'long-castle', name: 'The long way round', desc: 'Castle queenside in a game.', xp: 15 },
    { id: 'promote', name: 'Promotion party', desc: 'Promote a pawn in a game.', xp: 15 },
    { id: 'en-passant', name: 'In passing', desc: 'Capture en passant in a game.', xp: 25 },
    { id: 'knight-mate', name: "Knight's finish", desc: 'Deliver checkmate with a knight.', xp: 50 },
    { id: 'quick-mate', name: 'Swift and sweet', desc: 'Win by checkmate in under 25 moves.', xp: 40 },
    { id: 'streak-3', name: 'Habit forming', desc: 'Play on three days in a row.', xp: 30 },
    { id: 'streak-7', name: 'Week of chess', desc: 'Play on seven days in a row.', xp: 70 },
    { id: 'puzzles-10', name: 'Puzzle solver', desc: 'Solve 10 puzzles.', xp: 30 },
    { id: 'puzzles-50', name: 'Puzzle addict', desc: 'Solve 50 puzzles.', xp: 80 },
    { id: 'daily-puzzle', name: 'Daily treat', desc: 'Solve a daily puzzle.', xp: 15 },
    { id: 'lesson-1', name: 'Student', desc: 'Complete your first lesson.', xp: 20 },
    { id: 'chapter-1', name: 'Knows the pieces', desc: 'Complete chapter 1.', xp: 60 },
    { id: 'chapter-2', name: 'Knows the rules', desc: 'Complete chapter 2.', xp: 60 },
    { id: 'chapter-3', name: 'Opening apprentice', desc: 'Complete chapter 3.', xp: 60 },
    { id: 'graduate', name: 'Graduate', desc: 'Complete every lesson in the campaign.', xp: 300 },
    { id: 'repertoire', name: 'Repertoire', desc: 'Master three openings in the Opening lab.', xp: 80 },
    { id: 'dojo-3', name: 'Technique', desc: 'Earn three stars on three dojo endgames.', xp: 80 },
    { id: 'accuracy-90', name: 'Precision', desc: 'Score 90% accuracy in a reviewed game of 20+ moves.', xp: 60 },
    { id: 'brilliant', name: 'Brilliant!', desc: 'Play a move the coach rates brilliant.', xp: 60 },
    { id: 'online-first', name: 'Out into the world', desc: 'Finish an online game.', xp: 30 },
  ];
  const BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
  const LEVEL_ACH = ['beat-truffle', 'beat-builder', 'beat-rusher', 'beat-wall', 'beat-trickster', 'beat-strategist', 'beat-tactician', 'beat-gm'];

  // Cumulative XP needed to reach a level: gentle at first, steeper later.
  const xpFor = (level) => Math.round(60 * Math.pow(level - 1, 1.6));
  function levelFor(xp) {
    let level = 1;
    while (xpFor(level + 1) <= xp && level < 99) level++;
    const title = TITLES.filter(([l]) => level >= l).pop()[1];
    return { level, title, into: xp - xpFor(level), need: xpFor(level + 1) - xpFor(level), next: xpFor(level + 1) };
  }

  function fresh() {
    return {
      v: 1, xp: 0, premium: false,
      stats: { games: 0, wins: 0, draws: 0, losses: 0, byLevel: {}, puzzles: { solved: 0, failed: 0, rating: 800, seen: [] }, accuracy: [] },
      lessons: {}, openings: {}, dojo: {}, achievements: {}, streak: { count: 0, last: '' }, daily: { date: '', done: false },
      equipped: Object.assign({}, catalog.defaults), history: [], seen: {},
    };
  }
  function migrate(s) {
    const f = fresh();
    if (!s || s.v !== 1) return f;
    const out = Object.assign(f, s);
    out.stats = Object.assign(f.stats, s.stats || {});
    out.stats.puzzles = Object.assign(fresh().stats.puzzles, (s.stats || {}).puzzles || {});
    out.equipped = Object.assign({}, catalog.defaults, s.equipped || {});
    return out;
  }

  const today = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

  // Everything that grants XP goes through here; returns what changed for the UI.
  function grant(state, xp, out) {
    const before = levelFor(state.xp).level;
    state.xp += xp;
    out.xp += xp;
    const after = levelFor(state.xp).level;
    if (after > before) { out.levelUp = after; out.unlocked.push(...unlocksBetween(state, before, after)); }
  }
  function achieve(state, id, out) {
    if (state.achievements[id] || !BY_ID[id]) return;
    state.achievements[id] = today();
    out.achievements.push(BY_ID[id]);
    out.unlocked.push(...catalog.items.filter((i) => i.unlock.type === 'achievement' && i.unlock.achievement === id));
    grant(state, BY_ID[id].xp, out);
  }
  function touchStreak(state, now, out) {
    const d = today(now);
    if (state.streak.last === d) return;
    const gap = state.streak.last ? dayDiff(state.streak.last, d) : 99;
    state.streak.count = gap === 1 ? state.streak.count + 1 : 1;
    state.streak.last = d;
    if (state.streak.count >= 3) achieve(state, 'streak-3', out);
    if (state.streak.count >= 7) achieve(state, 'streak-7', out);
  }
  function unlocksBetween(state, from, to) {
    return catalog.items.filter((i) => i.unlock.type === 'level' && i.unlock.level > from && i.unlock.level <= to);
  }
  const result = () => ({ xp: 0, levelUp: 0, achievements: [], unlocked: [] });

  // A finished game. g = { mode, level, won, drawn, lost, reason, moves (plies), sans, startFen, accuracy, online }
  function gameFinished(state, g, now) {
    const out = result();
    state.stats.games++;
    if (g.won) state.stats.wins++; else if (g.drawn) state.stats.draws++; else if (g.lost) state.stats.losses++;
    if (g.mode === 'ai') {
      const b = state.stats.byLevel[g.level] || (state.stats.byLevel[g.level] = { w: 0, d: 0, l: 0 });
      if (g.won) b.w++; else if (g.drawn) b.d++; else if (g.lost) b.l++;
    }
    const lv = g.level || 0;
    let xp = g.mode === 'ai' ? (g.won ? 40 + 15 * lv : g.drawn ? 20 + 6 * lv : 10) : g.online ? (g.won ? 60 : g.drawn ? 30 : 15) : 10;
    if (g.plies < 6) xp = Math.min(xp, 5);   // no farming XP from instant resignations
    grant(state, xp, out);
    achieve(state, 'first-game', out);
    if (g.mode === 'ai' && g.won && g.plies >= 6) { achieve(state, 'first-win', out); achieve(state, LEVEL_ACH[lv], out); }
    if (g.online) achieve(state, 'online-first', out);
    const mine = (g.sans || []).filter((_, i) => (i % 2 === 0) === g.firstIsMine);
    if (mine.includes('O-O-O') || mine.some((s) => s.startsWith('O-O-O'))) achieve(state, 'long-castle', out);
    if (mine.some((s) => s.includes('='))) achieve(state, 'promote', out);
    if (g.enPassant) achieve(state, 'en-passant', out);
    if (g.won && g.reason === 'checkmate') {
      const last = (g.sans || [])[g.sans.length - 1] || '';
      if (last.startsWith('N')) achieve(state, 'knight-mate', out);
      if (g.plies < 50) achieve(state, 'quick-mate', out);
    }
    state.history.unshift({ date: new Date(now || Date.now()).toISOString(), mode: g.mode, level: g.level, result: g.won ? 'win' : g.drawn ? 'draw' : g.lost ? 'loss' : '-', reason: g.reason, plies: g.plies, pgn: g.pgn || '', start: g.startFen, ucis: g.ucis || [], color: g.color });
    state.history = state.history.slice(0, 30);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  // Puzzle ratings use a simple Elo update against the puzzle's rating.
  function puzzleFinished(state, puzzle, solved, opts, now) {
    const out = result();
    const p = state.stats.puzzles;
    const exp = 1 / (1 + Math.pow(10, (puzzle.rating - p.rating) / 400));
    const k = p.solved + p.failed < 20 ? 40 : 20;
    const before = p.rating;
    p.rating = Math.max(100, Math.round(p.rating + k * ((solved ? 1 : 0) - exp)));
    out.ratingDelta = p.rating - before;
    if (solved) p.solved++; else p.failed++;
    if (!p.seen.includes(puzzle.id)) p.seen.push(puzzle.id);
    if (solved) grant(state, 8 + Math.max(0, Math.round((puzzle.rating - 800) / 100)), out);
    if (p.solved >= 10) achieve(state, 'puzzles-10', out);
    if (p.solved >= 50) achieve(state, 'puzzles-50', out);
    if (opts && opts.daily && solved && !state.daily.done) { state.daily = { date: today(now ? new Date(now) : undefined), done: true }; grant(state, 25, out); achieve(state, 'daily-puzzle', out); }
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  // Lesson results: stars by first-try accuracy; mastery at 80%, with spaced reviews at 1, 7 and 30 days.
  function lessonFinished(state, lesson, firstTry, total, allLessons, now) {
    const out = result();
    const pct = total ? firstTry / total : 1;
    const stars = pct >= 0.999 ? 3 : pct >= 0.8 ? 2 : 1;
    const prev = state.lessons[lesson.id];
    const t = now || Date.now();
    const rec = { stars: Math.max(stars, prev ? prev.stars : 0), attempts: (prev ? prev.attempts : 0) + 1, mastered: pct >= 0.8 || !!(prev && prev.mastered),
      completed: today(new Date(t)), reviews: prev && prev.reviews ? prev.reviews : [1, 7, 30].map((d) => today(new Date(t + d * 86400000))) };
    state.lessons[lesson.id] = rec;
    if (!prev) grant(state, 30, out);
    if (rec.mastered && !(prev && prev.mastered)) grant(state, 40, out);
    if (!prev && stars === 3) grant(state, 10, out);
    out.stars = stars;
    achieve(state, 'lesson-1', out);
    for (const ch of [1, 2, 3]) {
      const ids = allLessons.filter((l) => l.chapter === ch).map((l) => l.id);
      if (ids.length && ids.every((id) => state.lessons[id])) achieve(state, 'chapter-' + ch, out);
    }
    if (allLessons.every((l) => state.lessons[l.id])) achieve(state, 'graduate', out);
    touchStreak(state, new Date(t), out);
    return out;
  }

  // Opening drill: a clean run has no wrong moves; three clean runs master the line.
  function openingFinished(state, id, clean, now) {
    const out = result();
    const rec = state.openings[id] || (state.openings[id] = { runs: 0, clean: 0, mastered: false });
    rec.runs++;
    if (clean) rec.clean++;
    grant(state, clean ? 12 : 4, out);
    if (!rec.mastered && rec.clean >= 3) { rec.mastered = true; grant(state, 40, out); out.mastered = true; }
    if (Object.values(state.openings).filter((r) => r.mastered).length >= 3) achieve(state, 'repertoire', out);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  // Endgame dojo: stars by moves used against the par.
  function dojoFinished(state, endgame, success, moves, now) {
    const out = result();
    const stars = !success ? 0 : endgame.goal === 'draw' || moves <= endgame.par ? 3 : moves <= Math.ceil(endgame.par * 1.5) ? 2 : 1;
    const prev = state.dojo[endgame.id] || { stars: 0, best: 0, tries: 0 };
    const rec = { stars: Math.max(prev.stars, stars), best: success ? (prev.best ? Math.min(prev.best, moves) : moves) : prev.best, tries: prev.tries + 1 };
    state.dojo[endgame.id] = rec;
    if (stars > prev.stars) grant(state, 15 * (stars - prev.stars), out);
    if (Object.values(state.dojo).filter((r) => r.stars === 3).length >= 3) achieve(state, 'dojo-3', out);
    out.stars = stars;
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  function reviewFinished(state, review, side, plies) {
    const out = result();
    const acc = review.summary.accuracy[side];
    if (acc !== null && acc !== undefined) { state.stats.accuracy.unshift(acc); state.stats.accuracy = state.stats.accuracy.slice(0, 20); }
    if (acc >= 90 && plies >= 40) achieve(state, 'accuracy-90', out);
    if (review.plies.some((p) => p.side === side && p.cls === 'brilliant')) achieve(state, 'brilliant', out);
    return out;
  }

  function isUnlocked(state, item) {
    const u = item.unlock;
    if (u.type === 'free') return true;
    if (u.type === 'level') return levelFor(state.xp).level >= u.level;
    if (u.type === 'achievement') return !!state.achievements[u.achievement];
    if (u.type === 'premium') return !!state.premium;
    return false;
  }
  function unlockText(item) {
    const u = item.unlock;
    if (u.type === 'level') return 'Reach level ' + u.level;
    if (u.type === 'achievement') return 'Achievement: ' + (BY_ID[u.achievement] ? BY_ID[u.achievement].name : u.achievement);
    if (u.type === 'premium') return 'Premium';
    return 'Free';
  }
  function equip(state, item) {
    if (!isUnlocked(state, item)) return false;
    state.equipped[item.category] = item.id;
    return true;
  }
  function item(id) { return catalog.items.find((i) => i.id === id); }
  function equipped(state, category) {
    const it = item(state.equipped[category]);
    return it && isUnlocked(state, it) ? it : item(catalog.defaults[category]);
  }
  // Lessons whose spaced review is due today or earlier.
  function dueReviews(state, now) {
    const d = today(now ? new Date(now) : undefined);
    return Object.entries(state.lessons).filter(([, r]) => (r.reviews || []).some((x) => x <= d)).map(([id]) => id);
  }
  function reviewDone(state, id, now) {
    const r = state.lessons[id]; if (!r) return;
    const d = today(now ? new Date(now) : undefined);
    r.reviews = (r.reviews || []).filter((x) => x > d);
  }
  // "Personal" opponent: picks a level from your recent results against the computer.
  function personalLevel(state, maxLevel) {
    let best = 0;
    for (let lv = 0; lv <= maxLevel; lv++) {
      const b = state.stats.byLevel[lv];
      if (!b) break;
      const n = b.w + b.d + b.l;
      if (n >= 2 && (b.w + b.d * 0.5) / n >= 0.55) best = lv + 1; else break;
    }
    return Math.min(best, maxLevel);
  }

  return { ACHIEVEMENTS, levelFor, xpFor, fresh, migrate, gameFinished, puzzleFinished, lessonFinished, openingFinished, dojoFinished, reviewFinished, isUnlocked, unlockText, equip, equipped, item, dueReviews, reviewDone, personalLevel, today };
}

if (typeof module !== 'undefined') module.exports = ChacklateProgress;
