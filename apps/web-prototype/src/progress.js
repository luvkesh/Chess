// Chackmate progression: XP, levels, achievements, streaks, stats and
// cosmetic unlocks, daily missions, the season track and the Journey Through Time
// campaign. Pure functions over a plain state object, so the page can save it
// locally and the platform API can store the same shape per account.
function ChacklateProgress(catalog, extras) {
  'use strict';
  const SEASONS = (extras && extras.seasons) || { tierXp: 300, seasons: [] };
  const MISSIONS = (extras && extras.missions) || { perDay: 3, allDoneXp: 0, missions: [] };
  const CAMPAIGN = (extras && extras.campaign) || { eras: [] };
  const PLACEMENT = (extras && extras.placement) || null;
  // Choco Coins: the soft currency. Earned only by playing, never bought with money, and only
  // spent on looks, so nothing bought changes gameplay or rating.
  const COIN_NAME = 'Choco Coins', COIN_ONE = 'Choco Coin';
  const COINS = {
    daily: { amount: 20, times: 1 },          // first visit of the day
    game: { amount: 10, win: 20, times: 10 }, // a finished game of 6+ plies
    lesson: { amount: 25 },                   // a lesson passed for the first time
    'daily-puzzle': { amount: 30, times: 1 },
    mission: { amount: 15, all: 25 },
    mini: { amount: 10, cap: 50 },            // per mini-game per day (see earn)
  };
  // Level items can be bought with coins once the player is within this many levels of them.
  const COIN_REACH = 2;
  const COIN_PRICE = { common: 200, rare: 400, epic: 900, legendary: 1500 };
  // Suites: each room comes with its own board and piece set (1:1:1). They unlock, are
  // bought and are equipped together, so a room is never shown with another room's board.
  const SUITES = catalog.suites || [];
  const SUITE_OF = {};
  for (const su of SUITES) for (const k of ['room', 'board', 'pieces']) SUITE_OF[su[k]] = su;
  const suiteOf = (it) => SUITE_OF[typeof it === 'string' ? it : it && it.id] || null;
  const suiteIds = (it) => { const su = suiteOf(it); return su ? [su.room, su.board, su.pieces] : [typeof it === 'string' ? it : it.id]; };
  const TITLES = [[1, 'Cocoa Bean'], [5, 'Apprentice'], [10, 'Chocolatier'], [15, 'Maître'], [20, 'Grand Maître']];
  const ACHIEVEMENTS = [
    { id: 'first-game', name: 'First move', desc: 'Finish your first game.', xp: 20 },
    { id: 'first-win', name: 'First win', desc: 'Beat a computer opponent.', xp: 40 },
    { id: 'beat-truffle', name: 'Sweet start', desc: 'Beat Truffle the Bunny.', xp: 20 },
    { id: 'beat-builder', name: 'Foundations', desc: 'Beat Bramble the Beaver.', xp: 30 },
    { id: 'beat-rusher', name: 'Hold the line', desc: 'Beat Zippy the Squirrel.', xp: 40 },
    { id: 'beat-wall', name: 'Shell breaker', desc: 'Beat Shelly the Tortoise.', xp: 60 },
    { id: 'beat-trickster', name: 'No tricks on me', desc: 'Beat Rocco the Raccoon.', xp: 80 },
    { id: 'beat-strategist', name: 'Master plan', desc: 'Beat Ivy the Giraffe.', xp: 100 },
    { id: 'beat-tactician', name: 'Sharper still', desc: 'Beat Onyx the Raven.', xp: 150 },
    { id: 'beat-gm', name: 'Dragon tamer', desc: 'Beat Ember the Dragon at full strength.', xp: 300 },
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
    { id: 'era-1', name: 'Time traveller', desc: 'Complete an era of the Journey Through Time.', xp: 50 },
    { id: 'era-4', name: 'Ancient wonders', desc: 'Complete four eras of the Journey.', xp: 120 },
    { id: 'era-all', name: 'Through the ages', desc: 'Complete every era of the Journey.', xp: 400 },
  ];
  // One badge for each placement result (packages/content/placement.json).
  if (PLACEMENT) for (const b of PLACEMENT.bands) ACHIEVEMENTS.push(Object.assign({ xp: 20 }, b.badge));
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
      v: 1, lessonsV: 2, xp: 0, premium: false, passes: [], season: '', seasons: {}, missions: { date: '', list: [], bonus: false },
      stats: { games: 0, wins: 0, draws: 0, losses: 0, byLevel: {}, variants: {}, puzzles: { solved: 0, failed: 0, rating: 800, seen: [] }, accuracy: [] },
      lessons: {}, openings: {}, dojo: {}, achievements: {}, streak: { count: 0, last: '' }, daily: { date: '', done: false },
      equipped: Object.assign({}, catalog.defaults), history: [], seen: {}, journey: {}, placement: null, variantLessons: {},
      coins: 0, earned: { date: '', by: {}, n: {}, xp: {} }, bought: [],
      granted: {},   // items handed out by developer mode, on this device only
      mini: { best: {}, plays: {}, day: { date: '', best: {} }, seen: [] },
      trainers: {},   // skill trainers: { id: { best, rounds, log: [{ d, s }] } }
      mates: {},      // checkmate in N puzzles: { N: { solved: [ids], log: [{ d, n, ok }] } }
      mistakes: [],   // moments from the player's own reviewed games, for Retry mistakes
      perf: { r: 0, n: 0, games: [] },   // performance over time (see perfGame)
    };
  }
  function migrate(s) {
    const f = fresh();
    if (!s || typeof s !== 'object' || s.v !== 1) return f;
    // Defaults come from a separate fresh copy (d): out shares f's objects once s is merged in.
    // Every field gets the type it should have, so a damaged save can never stop the game starting.
    const d = fresh();
    const obj = (v) => v && typeof v === 'object' && !Array.isArray(v);
    const o = (v, def) => Object.assign({}, def, obj(v) ? v : {});
    const arr = (v) => (Array.isArray(v) ? v.slice() : []);
    const num = (v, def, min) => (Number.isFinite(+v) && v !== null && v !== '' ? Math.max(min === undefined ? -Infinity : min, +v) : def);
    const out = Object.assign(f, s);
    for (const k of Object.keys(d)) if (obj(d[k]) && !obj(out[k])) out[k] = d[k];
    for (const k of ['passes', 'history', 'bought', 'mistakes']) if (!Array.isArray(out[k])) out[k] = d[k];
    out.xp = Math.floor(num(s.xp, 0, 0));
    out.premium = !!s.premium;
    out.lessonsV = s.lessonsV || 1;   // saved before Learn was regrouped
    const st = obj(s.stats) ? s.stats : {};
    out.stats = o(st, d.stats);
    for (const k of ['games', 'wins', 'draws', 'losses']) out.stats[k] = Math.floor(num(st[k], 0, 0));
    out.stats.byLevel = o(st.byLevel);
    out.stats.variants = o(st.variants);
    out.stats.accuracy = arr(st.accuracy);
    out.stats.puzzles = o(st.puzzles, d.stats.puzzles);
    out.stats.puzzles.seen = arr(out.stats.puzzles.seen);
    out.stats.puzzles.rating = num(out.stats.puzzles.rating, 800, 100);
    for (const k of ['solved', 'failed']) out.stats.puzzles[k] = Math.floor(num(out.stats.puzzles[k], 0, 0));
    out.streak = o(s.streak, d.streak); out.streak.count = Math.floor(num(out.streak.count, 0, 0));
    out.daily = o(s.daily, d.daily);
    out.equipped = Object.assign({}, catalog.defaults, obj(s.equipped) ? s.equipped : {});
    out.missions = o(s.missions, d.missions); out.missions.list = arr(out.missions.list);
    out.journey = o(s.journey);
    out.variantLessons = o(s.variantLessons);
    out.granted = o(s.granted);
    out.coins = Math.max(0, Math.floor(+s.coins || 0));
    out.earned = o(s.earned, d.earned); out.earned.by = o(out.earned.by); out.earned.n = o(out.earned.n); out.earned.xp = o(out.earned.xp);
    out.bought = arr(s.bought);
    // Older saves could mix a room with another room's board or set: line them up with the room.
    const su = suiteOf(out.equipped.room) || suiteOf(catalog.defaults.room);
    if (su) Object.assign(out.equipped, { room: su.room, board: su.board, pieces: su.pieces });
    out.mini = o(s.mini, d.mini);
    for (const k of ['best', 'plays']) out.mini[k] = o(out.mini[k]);
    out.mini.day = o(out.mini.day, d.mini.day); out.mini.day.best = o(out.mini.day.best);
    out.mini.seen = arr(out.mini.seen);
    out.trainers = o(s.trainers);
    out.mates = o(s.mates);
    out.mistakes = arr(s.mistakes).slice(0, MISTAKES_KEPT);
    out.perf = o(s.perf, d.perf);
    out.perf.games = arr(out.perf.games).slice(-PERF_KEEP);
    return out;
  }

  const today = (d) => { const x = d || new Date(); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const dayDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

  // XP from things that can be repeated quickly (instant resignations, trainer rounds, opening
  // runs) has a daily limit per source, so the season track and level looks cannot be farmed.
  function cappedXp(state, source, xp, cap, now) {
    earn(state, '_', 0, { now });   // rolls the day over the same way coins do
    const e = state.earned, x = e.xp || (e.xp = {});
    const give = Math.max(0, Math.min(xp, cap - (x[source] || 0)));
    x[source] = (x[source] || 0) + give;
    return give;
  }

  // Everything that grants XP goes through here; returns what changed for the UI.
  // XP earned while a season runs also moves the player up that season's track.
  function grant(state, xp, out) {
    const before = levelFor(state.xp).level;
    state.xp += xp;
    out.xp += xp;
    const after = levelFor(state.xp).level;
    if (after > before) { out.levelUp = after; out.unlocked.push(...unlocksBetween(state, before, after)); }
    const sid = state.season;
    if (sid && seasonById(sid)) {
      const t0 = tierOf(state, sid);
      state.seasons[sid] = (state.seasons[sid] || 0) + xp;
      const t1 = tierOf(state, sid);
      if (t1 > t0) {
        out.seasonTier = t1;
        out.unlocked.push(...seasonItems(sid).filter((i) => i.unlock.tier > t0 && i.unlock.tier <= t1 && (i.unlock.track === 'free' || hasPass(state, sid))));
      }
    }
  }

  // ------------------------------------------------------------ choco coins
  // The one way coins are earned. source names what paid (e.g. 'game', 'mini:knight-tour');
  // opts.cap limits the coins from that source per local day, opts.times the number of grants.
  // Returns the coins actually granted, which is 0 once a limit is reached.
  function earn(state, source, amount, opts, out) {
    opts = opts || {};
    // A clock turned back cannot reopen a day already paid: it counts against the latest day seen,
    // so its limits still hold, and a new day starts only going forward.
    let d = today(opts.now ? new Date(opts.now) : undefined);
    if (state.earned.date && d < state.earned.date) d = state.earned.date;
    if (state.earned.date !== d) state.earned = { date: d, by: {}, n: {}, xp: {} };
    const e = state.earned, had = e.by[source] || 0, n = e.n[source] || 0;
    let give = Math.max(0, Math.floor(amount));
    if (opts.times && n >= opts.times) give = 0;
    if (opts.cap) give = Math.max(0, Math.min(give, opts.cap - had));
    if (!give) return 0;
    e.by[source] = had + give; e.n[source] = n + 1;
    state.coins = (state.coins || 0) + give;
    if (out) out.coins = (out.coins || 0) + give;
    return give;
  }
  // Daily bonus on the first visit of the day.
  function dailyBonus(state, now) {
    const out = result();
    earn(state, 'daily', COINS.daily.amount, { times: 1, now }, out);
    return out;
  }
  const coinPrice = (item) => item && item.unlock.type === 'level' ? (COIN_PRICE[item.rarity] || COIN_PRICE.rare) : null;
  // Whether an item can be bought with coins now: { ok, price, reason }.
  function coinOffer(state, item) {
    const price = coinPrice(item);
    if (price === null || isUnlocked(state, item)) return { ok: false, price, reason: price === null ? 'not-for-coins' : 'owned' };
    if (levelFor(state.xp).level < item.unlock.level - COIN_REACH) return { ok: false, price, reason: 'too-far' };
    if ((state.coins || 0) < price) return { ok: false, price, reason: 'short', short: price - (state.coins || 0) };
    return { ok: true, price };
  }
  function buyWithCoins(state, item) {
    const o = coinOffer(state, item);
    if (!o.ok) return false;
    state.coins -= o.price;
    for (const id of suiteIds(item)) if (!state.bought.includes(id)) state.bought.push(id);
    return true;
  }

  // ------------------------------------------------------------ seasons
  const seasonById = (id) => SEASONS.seasons.find((x) => x.id === id) || null;
  const seasonItems = (id) => catalog.items.filter((i) => i.unlock.type === 'season' && i.unlock.season === id).sort((a, b) => a.unlock.tier - b.unlock.tier);
  function tierOf(state, id) {
    const s = seasonById(id); if (!s) return 0;
    return Math.min(s.tiers, Math.floor((state.seasons[id] || 0) / SEASONS.tierXp));
  }
  // Premium includes every season pass; a pass can also be bought on its own.
  const hasPass = (state, id) => !!state.premium || (state.passes || []).includes(id);
  function activeSeason(now) {
    const d = today(now ? new Date(now) : undefined);
    return SEASONS.seasons.find((x) => x.starts <= d && d < x.ends) || null;
  }
  // Called on start-up: points XP at the running season (or none between seasons).
  function setSeason(state, now) {
    const s = activeSeason(now);
    state.season = s ? s.id : '';
    return s;
  }
  function seasonInfo(state, id) {
    const s = seasonById(id); if (!s) return null;
    const xp = state.seasons[id] || 0, tier = tierOf(state, id);
    const daysLeft = Math.max(0, dayDiff(today(), s.ends));
    return { season: s, xp, tier, into: tier >= s.tiers ? SEASONS.tierXp : xp - tier * SEASONS.tierXp, need: SEASONS.tierXp, pass: hasPass(state, id), items: seasonItems(id), daysLeft };
  }

  // ------------------------------------------------------------ daily missions
  // Three missions a day, the same for everyone on that date. Online missions only when online play exists.
  function ensureMissions(state, now, opts) {
    const d = today(now ? new Date(now) : undefined);
    if (state.missions.date === d && state.missions.list.length) return state.missions;
    let h = 7; for (const ch of d) h = (h * 131 + ch.charCodeAt(0)) >>> 0;
    const pool = MISSIONS.missions.filter((m) => m.needs !== 'online' || (opts && opts.online));
    const list = [];
    const events = new Set();
    for (let k = 0; list.length < Math.min(MISSIONS.perDay, pool.length) && k < pool.length * 4; k++) {
      h = (h * 1103515245 + 12345) >>> 0;
      const m = pool[(h >>> 16) % pool.length];
      if (events.has(m.event)) continue;
      events.add(m.event);
      list.push({ id: m.id, n: 0, done: false });
    }
    state.missions = { date: d, list, bonus: false };
    return state.missions;
  }
  const missionDef = (id) => MISSIONS.missions.find((m) => m.id === id);
  function track(state, event, n, now, out) {
    if (!MISSIONS.missions.length) return;
    const ms = ensureMissions(state, now);
    for (const rec of ms.list) {
      const def = missionDef(rec.id);
      if (!def || rec.done || def.event !== event) continue;
      rec.n = Math.min(def.goal, rec.n + n);
      if (rec.n >= def.goal) { rec.done = true; out.missions.push(def); grant(state, def.xp, out); earn(state, 'mission', COINS.mission.amount, { now }, out); }
    }
    if (!ms.bonus && ms.list.length && ms.list.every((r) => r.done)) { ms.bonus = true; out.missionsAll = true; grant(state, MISSIONS.allDoneXp, out); earn(state, 'missions-all', COINS.mission.all, { times: 1, now }, out); }
  }
  function missionList(state, now, opts) {
    return ensureMissions(state, now, opts).list.map((r) => Object.assign({}, missionDef(r.id), r));
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
    // One missed day a week is forgiven, so a busy day (or a parent's screen-free day) never
    // wipes out a run.
    const shieldFree = !state.streak.shield || dayDiff(state.streak.shield, d) >= 7;
    if (gap === 2 && shieldFree && state.streak.count > 0) { state.streak.shield = d; out.shieldUsed = true; }
    state.streak.count = gap === 1 || out.shieldUsed ? state.streak.count + 1 : 1;
    state.streak.last = d;
    if (state.streak.count >= 3) achieve(state, 'streak-3', out);
    if (state.streak.count >= 7) achieve(state, 'streak-7', out);
  }
  function unlocksBetween(state, from, to) {
    return catalog.items.filter((i) => i.unlock.type === 'level' && i.unlock.level > from && i.unlock.level <= to);
  }
  const result = () => ({ xp: 0, coins: 0, levelUp: 0, achievements: [], unlocked: [], missions: [], seasonTier: 0 });

  // A finished game. g = { mode, level, won, drawn, lost, reason, moves (plies), sans, startFen, accuracy, online }
  function gameFinished(state, g, now) {
    const out = result();
    state.stats.games++;
    if (g.won) state.stats.wins++; else if (g.drawn) state.stats.draws++; else if (g.lost) state.stats.losses++;
    // A variation (chaturanga, say) keeps its own record; the records against each friend, the
    // friend achievements and the chess-move achievements are for chess.
    const variant = g.variant && g.variant !== 'standard' ? g.variant : null;
    if (variant) {
      const v = state.stats.variants[variant] || (state.stats.variants[variant] = { w: 0, d: 0, l: 0 });
      if (g.won) v.w++; else if (g.drawn) v.d++; else if (g.lost) v.l++;
    }
    // an era champion is not the animal friend of the same level: no friend record, no friend medal
    if (g.mode === 'ai' && !variant && !g.champion) {
      const b = state.stats.byLevel[g.level] || (state.stats.byLevel[g.level] = { w: 0, d: 0, l: 0 });
      if (g.won) b.w++; else if (g.drawn) b.d++; else if (g.lost) b.l++;
    }
    const lv = g.level || 0;
    let xp = g.mode === 'ai' ? (g.won ? 40 + 15 * lv : g.drawn ? 20 + 6 * lv : 10) : g.online ? (g.won ? 60 : g.drawn ? 30 : 15) : 10;
    if (g.plies < 6) xp = cappedXp(state, 'short-game', Math.min(xp, 5), 15, now);   // no farming XP from instant resignations
    grant(state, xp, out);
    achieve(state, 'first-game', out);
    if (g.mode === 'ai' && g.won && g.plies >= 6) { achieve(state, 'first-win', out); if (!variant && !g.champion) achieve(state, LEVEL_ACH[lv], out); }
    if (g.online) achieve(state, 'online-first', out);
    if (g.plies >= 6) {
      earn(state, 'game', g.won ? COINS.game.win : COINS.game.amount, { times: COINS.game.times, now }, out);
      track(state, 'game', 1, now, out);
      if (g.won) track(state, 'win', 1, now, out);
      if (g.online) track(state, 'online', 1, now, out);
    }
    const mine = variant ? [] : (g.sans || []).filter((_, i) => (i % 2 === 0) === g.firstIsMine);
    if (mine.includes('O-O-O') || mine.some((s) => s.startsWith('O-O-O'))) achieve(state, 'long-castle', out);
    if (mine.some((s) => s.includes('='))) achieve(state, 'promote', out);
    if (g.enPassant) achieve(state, 'en-passant', out);
    if (g.won && g.reason === 'checkmate' && !variant) {
      const last = (g.sans || [])[g.sans.length - 1] || '';
      if (last.startsWith('N')) achieve(state, 'knight-mate', out);
      if (g.plies < 50) achieve(state, 'quick-mate', out);
    }
    state.history.unshift({ date: new Date(now || Date.now()).toISOString(), mode: g.mode, level: g.level, result: g.won ? 'win' : g.drawn ? 'draw' : g.lost ? 'loss' : '-', reason: g.reason, plies: g.plies, pgn: g.pgn || '', start: g.startFen, ucis: g.ucis || [], color: g.color, variant: variant || undefined });
    state.history = state.history.slice(0, 30);
    out.perf = variant ? null : perfGame(state, g, now);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  // ------------------------------------------------------------ performance over time
  // Kept on the device only, like the rest of progress: one small entry per finished chess game
  // against an animal friend or online. { t: time, res: 'w'|'d'|'l', r: practice rating after it,
  // s: { skill: 0-100 } once Rooky's review of the game is in }. Nothing here is compared with
  // other players.
  const PERF_KEEP = 400;
  // The eight skills, each scored 0-100 from the review of one game (skillScores).
  const SKILLS = ['opening', 'tactics', 'endgame', 'advantage', 'resourcefulness', 'defence', 'blunders', 'time'];
  // Where Practice goes for each skill: its trainer when the game has trainers, else a lesson or page.
  const PRACTICE_FOR = {
    opening: { trainer: 'openings', screen: 'openings' },
    tactics: { trainer: 'tactics', lesson: 'lesson.c04.l01.forks' },
    endgame: { trainer: 'endgame', screen: 'dojo' },
    advantage: { trainer: 'advantage', lesson: 'lesson.c07.l01.when-to-trade' },
    resourcefulness: { trainer: 'resourcefulness', lesson: 'lesson.c05.l04.counter' },
    defence: { trainer: 'defences', lesson: 'lesson.c05.l01.scan' },
    blunders: { trainer: 'blunders', lesson: 'lesson.c09.l05.blunder-check' },
    time: { trainer: 'time', lesson: 'lesson.c10.l01.clock' },
  };
  // The practice rating: Elo on this device against the middle of each friend's strength band
  // (engine LEVELS: Truffle 250-500 ... Tactician 2000-2300, Grandmaster mode above).
  const FRIEND_RATING = [375, 650, 950, 1250, 1550, 1850, 2150, 2450];
  // The two skill lines drawn on every chart: Rooky's own grade bars (mentor.report rate()).
  const SKILL_LINES = { strong: 85, solid: 65 };
  const clamp100 = (x) => Math.max(0, Math.min(100, Math.round(x)));
  function perfOf(state) {
    if (!state.perf) state.perf = { r: 0, n: 0, games: [] };
    if (!state.perf.r) state.perf.r = FRIEND_RATING[state.placement && state.placement.level >= 0 ? state.placement.level : 0];
    return state.perf;
  }
  // Called from gameFinished for chess games. Local games (two players at one table) and
  // resignations before move 3 leave no entry. Returns the entry, or null.
  function perfGame(state, g, now) {
    if (g.mode !== 'ai' && !g.online) return null;
    if ((g.plies || 0) < 6) return null;
    const pf = perfOf(state);
    const score = g.won ? 1 : g.drawn ? 0.5 : g.lost ? 0 : null;
    if (score === null) return null;
    const opp = g.online ? (+g.oppRating || null) : FRIEND_RATING[Math.max(0, Math.min(FRIEND_RATING.length - 1, g.level || 0))];
    const r0 = pf.r;   // the rating before this game, so a period's change counts its first game too
    if (opp) {
      const exp = 1 / (1 + Math.pow(10, (opp - pf.r) / 400));
      const k = pf.n < 10 ? 48 : 24;
      pf.r = Math.max(100, Math.round(pf.r + k * (score - exp)));
      pf.n++;
    }
    const e = { t: now || Date.now(), res: g.won ? 'w' : g.drawn ? 'd' : 'l', r: pf.r, r0, m: g.online ? 'o' : 'a', lv: g.online ? undefined : g.level, s: null };
    pf.games.push(e);
    if (pf.games.length > PERF_KEEP) pf.games.splice(0, pf.games.length - PERF_KEEP);
    return e;
  }
  // Scores the eight skills from coach.review() and mentor.report() for the player's side.
  // time: { trouble, rushed, slowEasy } for a timed game, else null. A skill the game did not
  // test (no endgame, never ahead, no clock...) is left out rather than guessed.
  function skillScores(rv, rep, side, time) {
    const s = {};
    const mine = rv.plies.filter((p) => p.side === side);
    if (!mine.length) return s;
    const avgAcc = (list) => list.reduce((a, p) => a + p.accuracy, 0) / list.length;
    const st = rep.stats || {}, op = st.op || {}, kinds = st.kinds || {}, counts = rep.counts || {};
    if (rep.phaseAcc.opening !== null && rep.phaseAcc.opening !== undefined) s.opening = clamp100(rep.phaseAcc.opening - (op.lateCastle ? 10 : 0) - (op.queenEarly ? 10 : 0) - (op.slow ? 10 : 0));
    if ((st.tacticsFound || 0) + (st.tacticsMissed || 0) > 0) s.tactics = clamp100(100 * st.tacticsFound / (st.tacticsFound + st.tacticsMissed));
    if (rep.phaseAcc.endgame !== null && rep.phaseAcc.endgame !== undefined) s.endgame = clamp100(rep.phaseAcc.endgame);
    // ahead by a piece and a half or more: did the player keep it and finish the job?
    const ahead = mine.filter((p) => p.cpBefore * side >= 150), behind = mine.filter((p) => p.cpBefore * side <= -150);
    if (ahead.length >= 3) s.advantage = clamp100(avgAcc(ahead));
    if (behind.length >= 3) s.resourcefulness = clamp100(avgAcc(behind));
    s.defence = clamp100(100 - 25 * ((kinds.hanging || 0) + (kinds.forks || 0) + 2 * (kinds.mate || 0)));
    s.blunders = clamp100(100 * (1 - (2 * (counts.blunder || 0) + (counts.mistake || 0)) / mine.length));
    if (time) s.time = clamp100(100 - (time.trouble ? 35 : 0) - 10 * (time.rushed || 0) - 8 * (time.slowEasy || 0));
    return s;
  }
  // Adds the skill scores to the game entry made at time t (once only).
  function perfSkills(state, t, scores) {
    const e = perfOf(state).games.find((x) => x.t === t);
    if (!e || e.s) return false;
    e.s = scores;
    return true;
  }
  // Everything the Progress page draws, for the last `days` days (0 = all time).
  function perfView(state, days, now) {
    const pf = perfOf(state);
    const end = now || Date.now(), from = days ? end - days * 86400000 : 0;
    const games = pf.games.filter((e) => e.t >= from && e.t <= end);
    const before = pf.games.filter((e) => e.t < from).pop();
    const mean = (l) => (l.length ? l.reduce((a, b) => a + b, 0) / l.length : null);
    const change = (vals) => {
      if (vals.length < 2) return null;
      const h = Math.floor(vals.length / 2);
      return Math.round(mean(vals.slice(vals.length - h)) - mean(vals.slice(0, h)));
    };
    const rating = games.map((e) => ({ t: e.t, v: e.r }));
    const startR = before ? before.r : games.length ? (typeof games[0].r0 === 'number' ? games[0].r0 : null) : pf.r;
    const wdl = { w: 0, d: 0, l: 0 };
    for (const e of games) wdl[e.res]++;
    const skills = {};
    for (const id of SKILLS) {
      const pts = games.filter((e) => e.s && typeof e.s[id] === 'number').map((e) => ({ t: e.t, v: e.s[id] }));
      const vals = pts.map((p) => p.v);
      skills[id] = { id, pts, avg: vals.length ? Math.round(mean(vals)) : null, last: vals.length ? vals[vals.length - 1] : null, best: vals.length ? Math.max(...vals) : null, change: change(vals), practice: PRACTICE_FOR[id] };
    }
    const ratingChange = rating.length ? rating[rating.length - 1].v - (startR !== null && startR !== undefined ? startR : rating[0].v) : 0;
    // the friends whose strength sits just below and just above the rating, for the rating chart
    const below = FRIEND_RATING.map((r, i) => [r, i]).filter(([r]) => r <= pf.r).pop() || null;
    const above = FRIEND_RATING.map((r, i) => [r, i]).find(([r]) => r > pf.r) || null;
    // weakest skill with at least two scores first: what to practise next
    const focus = SKILLS.map((id) => skills[id]).filter((k) => k.pts.length >= 2 && k.avg < SKILL_LINES.strong).sort((a, b) => a.avg - b.avg)[0] || null;
    return { games, rating, rating0: startR, ratingNow: pf.r, ratingChange, wdl, skills, below: below && { r: below[0], level: below[1] }, above: above && { r: above[0], level: above[1] }, focus: focus && focus.id, reviewed: games.filter((e) => e.s).length };
  }

  // Puzzle ratings use a simple Elo update against the puzzle's rating.
  function puzzleFinished(state, puzzle, solved, opts, now) {
    const out = result();
    const p = state.stats.puzzles;
    // A puzzle already solved once moves neither XP nor the rating when it is played again.
    const again = (p.done || (p.done = [])).includes(puzzle.id);
    if (solved && !again) p.done.push(puzzle.id);
    const exp = 1 / (1 + Math.pow(10, (puzzle.rating - p.rating) / 400));
    const k = p.solved + p.failed < 20 ? 40 : 20;
    const before = p.rating;
    if (!again) p.rating = Math.max(100, Math.round(p.rating + k * ((solved ? 1 : 0) - exp)));
    out.ratingDelta = p.rating - before;
    if (solved) p.solved++; else p.failed++;
    if (!p.seen.includes(puzzle.id)) p.seen.push(puzzle.id);
    const mt = (puzzle.themes || []).find((x) => /^mateIn[1-5]$/.test(x));
    if (mt) mateLogged(state, +mt.slice(6), puzzle.id, solved, now);
    if (solved && !again) grant(state, 8 + Math.max(0, Math.round((puzzle.rating - 800) / 100)), out);
    if (p.solved >= 10) achieve(state, 'puzzles-10', out);
    if (p.solved >= 50) achieve(state, 'puzzles-50', out);
    const dDay = today(now ? new Date(now) : undefined);
    if (opts && opts.daily && solved && !(state.daily.done && state.daily.date >= dDay)) { state.daily = { date: dDay, done: true }; grant(state, 25, out); earn(state, 'daily-puzzle', COINS['daily-puzzle'].amount, { times: 1, now }, out); achieve(state, 'daily-puzzle', out); track(state, 'daily', 1, now, out); }
    if (solved) track(state, 'puzzle', 1, now, out);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  // Checkmate in N: which puzzles of each set are solved, and a day-by-day log for the progress charts.
  const LOG_DAYS = 120;
  function dayLog(log, d, fn) {
    let e = log.length && log[log.length - 1].d === d ? log[log.length - 1] : null;
    if (!e) { e = { d }; log.push(e); }
    fn(e);
    while (log.length > LOG_DAYS) log.shift();
  }
  function mateLogged(state, n, id, solved, now) {
    const m = state.mates || (state.mates = {});
    const r = m[n] || (m[n] = { solved: [], log: [] });
    if (solved && !r.solved.includes(id)) r.solved.push(id);
    dayLog(r.log, PG_today(now), (e) => { e.n = (e.n || 0) + 1; e.ok = (e.ok || 0) + (solved ? 1 : 0); });
  }
  // A finished trainer round, scored 0 to 100. Keeps the best, the number of rounds and each
  // day's average score (s) and rounds (n), the data the progress charts draw.
  function trainerFinished(state, id, score, now) {
    const out = result();
    const tr = state.trainers || (state.trainers = {});
    const r = tr[id] || (tr[id] = { best: 0, rounds: 0, log: [] });
    out.newBest = r.rounds > 0 && score > r.best;
    r.best = Math.max(r.best, score);
    r.rounds++;
    dayLog(r.log, PG_today(now), (e) => { e.s = Math.round(((e.s || 0) * (e.n || 0) + score) / ((e.n || 0) + 1)); e.n = (e.n || 0) + 1; });
    // a round with nothing solved earns nothing (no XP, mission or streak for skipping through)
    if (score <= 0) return out;
    grant(state, cappedXp(state, 'trainer', 6 + Math.round(score / 10), 150, now), out);
    track(state, 'lesson', 1, now, out);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }
  // Moments from the player's own reviewed games where a better move was there (Retry mistakes).
  // Newest first; one per position; a moment solved twice in a row is retired.
  const MISTAKES_KEPT = 40;
  function mistakesFound(state, list, now) {
    const m = state.mistakes || (state.mistakes = []);
    const d = PG_today(now);
    for (const x of list.slice().reverse()) {
      const key = x.fen.split(' ').slice(0, 2).join(' ');
      if (m.some((y) => y.fen.split(' ').slice(0, 2).join(' ') === key)) continue;
      m.unshift({ fen: x.fen, played: x.played, best: x.best, cls: x.cls, d, ok: 0 });
    }
    m.length = Math.min(m.length, MISTAKES_KEPT);
  }
  function mistakeRetried(state, fen, solved) {
    const m = state.mistakes || [];
    const i = m.findIndex((y) => y.fen === fen);
    if (i < 0) return;
    m[i].ok = solved ? (m[i].ok || 0) + 1 : 0;
    if (m[i].ok >= 2) m.splice(i, 1);
  }
  // A trainer's record: best round score (0-100), rounds played and the day-by-day log for the charts.
  const trainerLog = (state, id) => { const t = (state.trainers || {})[id] || {}; return { best: t.best || 0, rounds: t.rounds || 0, log: (t.log || []).slice() }; };
  // A checkmate-in-N set: puzzles solved and the day-by-day log.

  const mateLog = (state, n) => { const m = (state.mates || {})[n] || {}; return { solved: (m.solved || []).slice(), log: (m.log || []).slice() }; };

  // Learn was regrouped into longer lessons: each one names the lessons it grew from ("replaces").
  // A regrouped lesson counts as done only when every part of it was done (lowest stars, earliest
  // reviews); otherwise it waits to be played. Records of lessons that no longer exist are dropped,
  // so no review points at a missing lesson. XP, coins and badges already earned stay.
  function mergeLessons(state, allLessons) {
    if (state.lessonsV >= 2) return state;   // runs once, on the first start after the regrouping
    state.lessonsV = 2;
    const known = new Set(allLessons.map((l) => l.id));
    for (const l of allLessons) {
      if (!l.replaces || !l.replaces.length) continue;
      const parts = [l.id].concat(l.replaces).map((id) => state.lessons[id]);
      if (!parts.some(Boolean)) continue;
      if (parts.every(Boolean)) {
        state.lessons[l.id] = Object.assign({}, state.lessons[l.id], { stars: Math.min(...parts.map((r) => r.stars || 1)), mastered: parts.every((r) => r.mastered) });
      } else delete state.lessons[l.id];
    }
    for (const id of Object.keys(state.lessons)) if (!known.has(id)) delete state.lessons[id];
    return state;
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
    if (!prev) { grant(state, 30, out); earn(state, 'lesson', COINS.lesson.amount, { now: t }, out); }
    if (rec.mastered && !(prev && prev.mastered)) grant(state, 40, out);
    if (!prev && stars === 3) grant(state, 10, out);
    out.stars = stars;
    achieve(state, 'lesson-1', out);
    for (const ch of [1, 2, 3]) {
      const ids = allLessons.filter((l) => l.chapter === ch).map((l) => l.id);
      if (ids.length && ids.every((id) => state.lessons[id])) achieve(state, 'chapter-' + ch, out);
    }
    if (allLessons.every((l) => state.lessons[l.id])) achieve(state, 'graduate', out);
    track(state, 'lesson', 1, t, out);
    touchStreak(state, new Date(t), out);
    return out;
  }

  // A variation's lesson: stars and XP like a lesson, but no spaced reviews and no chapter.
  function variantLessonFinished(state, id, firstTry, total, now) {
    const out = result();
    const pct = total ? firstTry / total : 1;
    const stars = pct >= 0.999 ? 3 : pct >= 0.8 ? 2 : 1;
    const prev = state.variantLessons[id];
    state.variantLessons[id] = { stars: Math.max(stars, prev ? prev.stars : 0), attempts: (prev ? prev.attempts : 0) + 1 };
    if (!prev) grant(state, 30, out);
    out.stars = stars;
    track(state, 'lesson', 1, now || Date.now(), out);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  // The placement test: the score (one try per question) picks a band, which sets the chapter the
  // learning path starts at and a badge; the score and speed suggest an animal friend. Free players
  // are offered free friends only. Earlier chapters always stay open; a retake replaces the result.
  function placementResult(score, seconds, maxLevel) {
    const bands = PLACEMENT.bands, f = PLACEMENT.friends;
    const band = bands.filter((b) => score >= b.min).pop();
    let level = f.byScore[Math.min(score, f.byScore.length - 1)];
    if (score >= PLACEMENT.questions.length) for (const [s, lv] of f.perfect) if (seconds <= s) { level = Math.max(level, lv); break; }
    const capped = level > maxLevel;
    return { band, chapter: band.chapter, level: Math.min(level, maxLevel), wanted: level, capped };
  }
  function placementFinished(state, score, seconds, maxLevel, now) {
    const out = result();
    const r = placementResult(score, seconds, maxLevel);
    const first = !state.placement;
    state.placement = { date: today(now ? new Date(now) : undefined), score, total: PLACEMENT.questions.length, seconds: Math.round(seconds), chapter: r.chapter, level: r.level };
    if (first) grant(state, 30, out);
    achieve(state, r.band.badge.id, out);
    touchStreak(state, now ? new Date(now) : new Date(), out);
    return Object.assign(out, r);
  }

  // Opening drill: a clean run has no wrong moves; three clean runs master the line.
  function openingFinished(state, id, clean, now) {
    const out = result();
    const rec = state.openings[id] || (state.openings[id] = { runs: 0, clean: 0, mastered: false });
    rec.runs++;
    if (clean) rec.clean++;
    grant(state, cappedXp(state, 'opening', clean ? 12 : 4, 120, now), out);
    if (!rec.mastered && rec.clean >= 3) { rec.mastered = true; grant(state, 40, out); out.mastered = true; }
    if (Object.values(state.openings).filter((r) => r.mastered).length >= 3) achieve(state, 'repertoire', out);
    track(state, 'drill', 1, now, out);
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
    if (stars > 0) track(state, 'dojo', 1, now, out);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }

  function reviewFinished(state, review, side, plies, now) {
    const out = result();
    const acc = review.summary.accuracy[side];
    if (acc !== null && acc !== undefined) { state.stats.accuracy.unshift(acc); state.stats.accuracy = state.stats.accuracy.slice(0, 20); }
    if (acc >= 90 && plies >= 40) achieve(state, 'accuracy-90', out);
    if (review.plies.some((p) => p.side === side && p.cls === 'brilliant')) achieve(state, 'brilliant', out);
    if (plies >= 10) track(state, 'review', 1, now, out);
    return out;
  }

  // ------------------------------------------------------------ journey through time
  // Nine eras, each a short run of stages (a tale, a lesson, a trial and a champion game).
  // Eras open in order; the last five need Premium. An era already started stays open, so
  // adding a new era in the middle never locks a player out of one they reached. Finishing an era unlocks its piece set,
  // board, room and coach avatar.
  const eraById = (id) => CAMPAIGN.eras.find((e) => e.id === id) || null;
  const eraRec = (state, id) => (state.journey && state.journey[id]) || { stages: [], done: false };
  function eraOpen(state, id) {
    const e = eraById(id); if (!e) return false;
    if (e.access === 'premium' && !state.premium) return false;
    const prev = CAMPAIGN.eras[CAMPAIGN.eras.indexOf(e) - 1];
    const own = eraRec(state, id);
    return !prev || eraRec(state, prev.id).done || own.done || own.stages.some(Boolean);
  }
  function journeyInfo(state, id) {
    const e = eraById(id); if (!e) return null;
    const r = eraRec(state, id);
    const stages = e.stages.map((_, i) => !!r.stages[i]);
    const next = stages.findIndex((d) => !d);
    return { era: e, stages, done: !!r.done, open: eraOpen(state, id), next: next < 0 ? null : next, count: stages.filter(Boolean).length, premium: e.access === 'premium' };
  }
  const STAGE_XP = { tale: 20, lesson: 10, puzzles: 30, endgame: 30, champion: 100 };
  // A stage can be done in any order once the era is open; the champion waits for the rest.
  function journeyStage(state, id, index, now) {
    const out = result();
    const e = eraById(id);
    if (!e || !e.stages[index] || !eraOpen(state, id)) return out;
    if (!state.journey) state.journey = {};
    const r = state.journey[id] || (state.journey[id] = { stages: [], done: false });
    if (!r.stages[index]) { r.stages[index] = PG_today(now); grant(state, STAGE_XP[e.stages[index].kind] || 20, out); }
    if (!r.done && e.stages.every((_, i) => r.stages[i])) {
      r.done = PG_today(now);
      out.eraDone = e;
      out.unlocked.push(...catalog.items.filter((i) => i.unlock.type === 'journey' && i.unlock.era === id));
      grant(state, 150, out);
      const n = CAMPAIGN.eras.filter((x) => eraRec(state, x.id).done).length;
      if (n >= 1) achieve(state, 'era-1', out);
      if (n >= 4) achieve(state, 'era-4', out);
      if (n >= CAMPAIGN.eras.length) achieve(state, 'era-all', out);
    }
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }
  const PG_today = (now) => today(now ? new Date(now) : undefined);

  // ------------------------------------------------------------ mini-games
  // A finished round of a mini-game: its best score, today's best and its coins (COINS.mini:
  // a round that scores pays, up to a cap a day from each game). Mini-games never change a rating,
  // and count toward the mini-game missions.
  function miniFinished(state, id, score, now) {
    const out = result();
    const m = state.mini, d = PG_today(now);
    if (m.day.date !== d) m.day = { date: d, best: {} };
    out.newBest = score > (m.best[id] || 0) && (m.plays[id] || 0) > 0;
    out.newDailyBest = score > (m.day.best[id] || 0) && m.day.best[id] !== undefined;
    m.best[id] = Math.max(m.best[id] || 0, score);
    m.day.best[id] = Math.max(m.day.best[id] || 0, score);
    m.plays[id] = (m.plays[id] || 0) + 1;
    out.paid = score > 0 ? earn(state, 'mini:' + id, COINS.mini.amount, { cap: COINS.mini.cap, now }, out) : 0;
    out.capped = score > 0 && !out.paid;
    track(state, 'mini', 1, now, out);
    touchStreak(state, now ? new Date(now) : undefined, out);
    return out;
  }
  // Today's best and the coins a game has paid today.
  function miniToday(state, id, now) {
    const d = PG_today(now), day = state.mini.day, e = state.earned || {};
    return { best: day.date === d ? day.best[id] : undefined, earned: e.date === d ? (e.by || {})['mini:' + id] || 0 : 0 };
  }

  function isUnlocked(state, item) {
    const u = item.unlock;
    const ids = suiteIds(item);
    if (u.type === 'free' || (state.granted && ids.some((id) => state.granted[id]))) return true;
    if (u.type === 'level') return levelFor(state.xp).level >= u.level || ids.some((id) => (state.bought || []).includes(id));
    if (u.type === 'achievement') return !!state.achievements[u.achievement];
    if (u.type === 'premium') return !!state.premium;
    if (u.type === 'season') return tierOf(state, u.season) >= u.tier && (u.track === 'free' || hasPass(state, u.season));
    if (u.type === 'journey') return !!eraRec(state, u.era).done;
    return false;
  }
  function unlockText(item) {
    const u = item.unlock;
    if (u.type === 'level') return 'Reach level ' + u.level;
    if (u.type === 'achievement') return 'Achievement: ' + (BY_ID[u.achievement] ? BY_ID[u.achievement].name : u.achievement);
    if (u.type === 'premium') return 'Premium';
    if (u.type === 'season') { const s = seasonById(u.season); return (s ? s.name : 'Season') + ' tier ' + u.tier + (u.track === 'pass' ? ' · Season Pass' : ''); }
    if (u.type === 'journey') { const e = eraById(u.era); return 'Journey: ' + (e ? e.name : u.era) + (e && e.access === 'premium' ? ' · Premium' : ''); }
    return 'Free';
  }
  function equip(state, item) {
    if (!isUnlocked(state, item)) return false;
    const su = suiteOf(item);
    if (su) Object.assign(state.equipped, { room: su.room, board: su.board, pieces: su.pieces });
    else state.equipped[item.category] = item.id;
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
    // Before any game, the placement test's suggestion is the best guess.
    if (!Object.keys(state.stats.byLevel).length && state.placement) return Math.min(state.placement.level, maxLevel);
    let best = 0;
    for (let lv = 0; lv <= maxLevel; lv++) {
      const b = state.stats.byLevel[lv];
      if (!b) break;
      const n = b.w + b.d + b.l;
      if (n >= 2 && (b.w + b.d * 0.5) / n >= 0.55) best = lv + 1; else break;
    }
    return Math.min(best, maxLevel);
  }

  return { SUITES, suiteOf, COIN_NAME, COIN_ONE, COINS, COIN_REACH, COIN_PRICE, earn, dailyBonus, coinPrice, coinOffer, buyWithCoins,
    ACHIEVEMENTS, SEASONS, CAMPAIGN, levelFor, xpFor, fresh, migrate, gameFinished, puzzleFinished, lessonFinished, mergeLessons, variantLessonFinished, openingFinished, dojoFinished, reviewFinished, isUnlocked, unlockText, equip, equipped, item, dueReviews, reviewDone, personalLevel, today, placementResult, placementFinished, trainerFinished, trainerLog, mateLog, mistakesFound, mistakeRetried,
    setSeason, activeSeason, seasonInfo, SKILLS, SKILL_LINES, PRACTICE_FOR, FRIEND_RATING, perfGame, perfSkills, perfView, skillScores, perfOf, tierOf, hasPass, missionList, ensureMissions, eraOpen, journeyInfo, journeyStage, miniFinished, miniToday };
}

if (typeof module !== 'undefined') module.exports = ChacklateProgress;
