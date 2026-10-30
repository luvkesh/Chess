// The Club, in the manner of Jong Club's: rankings in the bullet, blitz and rapid pools with
// Global, Country, City and Following filters, leagues with medal tiers, a friends list made
// from friend-code games, and who is in the club now.
//
// With the Chackmate game server connected, everything comes from it (services/game-server/src/club.js).
// Without it, the club is filled with AI players, always labelled as such, plus the real
// players in the page's live room, and ratings move on this device after world games.
//
// Children's safety: the place starts as a guess from the time zone (nothing is looked up
// online), then a pick that sticks; the location button is used only when tapped. Everyone may
// keep a city (the owner's choice, 2026-10-30). Coordinates are matched to the nearest city here
// and dropped, and only a country is ever shared with other players in the live room.
const ChacklateClub = (function () {
  'use strict';
  const A = () => window.ChacklateApp;
  const NET = () => window.ChacklateNet;
  const PLACES = CHACKMATE_PLACES;
  const POOLS = ['bullet', 'blitz', 'rapid'];
  // Rating where each league starts. Everyone starts at 1500, in Bronze. Same as the server.
  const LEAGUES = [['Master', 2200], ['Diamond', 2050], ['Platinum', 1900], ['Gold', 1750], ['Silver', 1600], ['Bronze', 1400], ['Beginner', 0]];
  const leagueOf = (r) => (LEAGUES.find(([, min]) => r >= min) || LEAGUES[LEAGUES.length - 1])[0];
  const START = 1500;

  // ---------------------------------------------------------------- places
  let names = null;
  function countryName(cc) {
    if (!cc) return '';
    try { names = names || new Intl.DisplayNames(['en'], { type: 'region' }); return names.of(cc) || cc; } catch (e) { return cc; }
  }
  const flag = (cc) => (cc && /^[A-Z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc].map((c) => 127397 + c.charCodeAt(0))) : '');
  const countries = () => [...new Set(PLACES.map((p) => p[1]))].sort((a, b) => countryName(a).localeCompare(countryName(b)));
  const citiesOf = (cc) => PLACES.filter((p) => p[1] === cc).map((p) => p[0]);
  const countryOfCity = (city) => { const p = PLACES.find((x) => x[0] === city); return p ? p[1] : null; };

  // The time zone names a city (Asia/Kolkata is Mumbai), or failing that the browser's language
  // names a country (en-IN). Nothing leaves the device.
  function guess() {
    let tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { tz = ''; }
    const p = tz && PLACES.find((x) => x[4] && x[4].includes(tz));
    if (p) return { country: p[1], city: p[0], source: 'tz' };
    const lang = (navigator.languages && navigator.languages[0]) || navigator.language || '';
    const m = lang.match(/-([A-Z]{2})\b/i);
    const cc = m && m[1].toUpperCase();
    if (cc && citiesOf(cc).length) return { country: cc, city: citiesOf(cc)[0], source: 'tz' };
    return null;
  }
  function nearest(lat, lon) {
    let best = PLACES[0], d = Infinity;
    const r = Math.PI / 180;
    for (const p of PLACES) {
      const x = (p[3] - lon) * r * Math.cos((lat + p[2]) / 2 * r), y = (p[2] - lat) * r;
      const k = Math.hypot(x, y);
      if (k < d) { d = k; best = p; }
    }
    return { country: best[1], city: best[0], source: 'gps' };
  }
  // Only when the player taps the location button. The browser asks them first.
  function gps() {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve(null);
      try { navigator.geolocation.getCurrentPosition((pos) => resolve(nearest(pos.coords.latitude, pos.coords.longitude)), () => resolve(null), { enableHighAccuracy: false, timeout: 10000, maximumAge: 3600e3 }); } catch (e) { resolve(null); }
    });
  }

  // ---------------------------------------------------------------- the player's club data
  function data() {
    const s = A().state.settings;
    if (!s.club || typeof s.club !== 'object') s.club = {};
    const c = s.club;
    if (!c.ratings) c.ratings = {};
    for (const p of POOLS) if (!c.ratings[p]) c.ratings[p] = { r: START, g: 0 };
    if (!Array.isArray(c.friends)) c.friends = [];
    if (!Array.isArray(c.follow)) c.follow = [];
    if (!c.cid) c.cid = Math.random().toString(36).slice(2, 12);
    return c;
  }
  const server = () => !!(NET() && NET().mode && NET().mode() === 'server');
  function place() {
    const c = data();
    return { country: c.country || null, city: c.city || null, source: c.src || null };
  }
  function setPlace(p) {
    const c = data();
    c.country = p.country || null;
    c.city = p.country ? p.city || null : null;
    c.src = c.country ? p.source || 'manual' : null;
    A().save();
    if (server()) NET().api('/api/account/location', { country: c.country, city: c.city, source: c.src }).catch(() => {});
    publish();
    return place();
  }
  // The first visit takes the time-zone guess; a pick by the player sticks after that.
  function autoLocate() {
    const c = data();
    if (c.src) return;
    const g = guess();
    if (g) setPlace(g);
  }
  // The server's copy wins when it has one (a second device), unless this device has a pick.
  function fromServer(loc) {
    if (!loc || !loc.country) { if (data().country && server()) setPlace(place()); return; }
    const c = data();
    if (c.src === 'manual' && loc.source !== 'manual' && c.country) return;
    c.country = loc.country; c.city = loc.city || c.city || null; c.src = loc.source || 'manual';
    A().save();
  }

  // ---------------------------------------------------------------- AI players
  // Made-up members, the same for everyone, so the boards and leagues are never empty before
  // the server opens. Their names are unlike players' made-up names, and they are always
  // shown with an "AI player" tag.
  const AI_ADJ = ['Amber', 'Saffron', 'Cobalt', 'Jade', 'Coral', 'Indigo', 'Ivory', 'Ruby', 'Topaz', 'Pearl', 'Onyx', 'Opal', 'Copper', 'Velvet', 'Marble', 'Cocoa'];
  const AI_NOUN = ['Knight', 'Rook', 'Bishop', 'Castle', 'Gambit', 'Crown', 'Tempo', 'Pawn', 'Queen', 'Fork', 'Mate', 'Tower'];
  const PIECES = ['k', 'q', 'r', 'b', 'n', 'p'];
  const HUES = [['#a3294f', '#4a0c1e'], ['#2f6f6a', '#173b39'], ['#2f4f8a', '#14243e'], ['#8a5a2a', '#3a1e0e'], ['#5b4a8a', '#2c2248'], ['#b8862b', '#5c3d0c']];
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  let aiCache = null;
  function members() {
    if (aiCache) return aiCache;
    const R = rng(20261030), out = [], used = new Set();
    const india = PLACES.filter((p) => p[1] === 'IN');
    for (let i = 0; out.length < 72 && i < 500; i++) {
      const name = AI_ADJ[Math.floor(R() * AI_ADJ.length)] + ' ' + AI_NOUN[Math.floor(R() * AI_NOUN.length)];
      if (used.has(name)) continue;
      used.add(name);
      // Many members near home: Chackmate is made in Mumbai.
      const p = R() < 0.4 ? india[Math.floor(R() * india.length)] : PLACES[Math.floor(R() * PLACES.length)];
      // A bell-ish spread around 1550, from about 900 to 2350.
      const base = Math.round(1550 + (R() + R() + R() - 1.5) * 560);
      const ratings = {};
      for (const pool of POOLS) ratings[pool] = Math.max(850, Math.min(2400, base + Math.round((R() - 0.5) * 160)));
      const hue = HUES[Math.floor(R() * HUES.length)];
      out.push({ id: 'ai' + out.length, ai: true, name, country: p[1], city: p[0], ratings, games: 20 + Math.floor(R() * 400), piece: PIECES[Math.floor(R() * PIECES.length)], from: hue[0], to: hue[1] });
    }
    aiCache = out;
    return out;
  }
  // AI members who drop by change every ten minutes.
  function droppingBy(n) {
    const R = rng(Math.floor(Date.now() / 600000)), list = members().slice();
    const out = [];
    while (out.length < n && list.length) out.push(list.splice(Math.floor(R() * list.length), 1)[0]);
    return out;
  }
  const following = (id) => data().follow.includes(id);
  function toggleFollow(id) {
    const c = data();
    c.follow = c.follow.includes(id) ? c.follow.filter((x) => x !== id) : c.follow.concat(id);
    A().save();
    return c.follow.includes(id);
  }

  // ---------------------------------------------------------------- the live room
  const lobby = () => (NET() && NET()._relay ? NET()._relay.lobbyRef() : null);
  // What other pages in the room see of this player: a made-up name, a country, ratings.
  function card() {
    const c = data(), s = A().state.settings;
    return { cid: c.cid, name: s.netName || null, cc: c.country || null, r: { bullet: c.ratings.bullet.r, blitz: c.ratings.blitz.r, rapid: c.ratings.rapid.r } };
  }
  function publish() {
    const l = lobby();
    if (l && !server()) l.presence({ app: 'chackmate', club: card() }).catch(() => {});
  }
  const cleanName = (s) => String(s == null ? '' : s).replace(/[^\p{L}\p{N} ]/gu, '').trim().slice(0, 24) || 'Player';
  const cleanCc = (cc) => (typeof cc === 'string' && /^[A-Z]{2}$/.test(cc) ? cc : null);
  const cleanR = (r) => (Number.isFinite(r) ? Math.max(400, Math.min(3000, Math.round(r))) : START);
  function livePeers() {
    const l = lobby();
    if (!l) return [];
    let peers = [];
    try { peers = l.peers(); } catch (e) { return []; }
    const out = [], seen = new Set([data().cid]);
    for (const p of peers) {
      const c = p.presence && p.presence.club;
      if (p.isMe || !c || typeof c !== 'object' || typeof c.cid !== 'string' || seen.has(c.cid)) continue;
      seen.add(c.cid);
      const r = c.r && typeof c.r === 'object' ? c.r : {};
      out.push({ id: c.cid.slice(0, 16), name: cleanName(c.name), country: cleanCc(c.cc), ratings: { bullet: cleanR(r.bullet), blitz: cleanR(r.blitz), rapid: cleanR(r.rapid) }, seeking: !!(p.presence.seek) });
    }
    return out;
  }

  // ---------------------------------------------------------------- friends
  // A friend-code game in the live room: each side keeps the other on its list.
  function addFriend(p) {
    if (!p || typeof p.cid !== 'string') return;
    const c = data(), id = p.cid.slice(0, 16);
    const f = c.friends.find((x) => x.id === id);
    const r = p.r && typeof p.r === 'object' ? { bullet: cleanR(p.r.bullet), blitz: cleanR(p.r.blitz), rapid: cleanR(p.r.rapid) } : null;
    if (f) { f.name = cleanName(p.name); f.country = cleanCc(p.cc); if (r) f.ratings = r; f.last = Date.now(); }
    else c.friends.unshift({ id, name: cleanName(p.name), country: cleanCc(p.cc), ratings: r || { bullet: START, blitz: START, rapid: START }, since: Date.now(), last: Date.now() });
    c.friends = c.friends.slice(0, 100);
    A().save();
  }
  async function friends() {
    if (server()) {
      try { return (await NET().api('/api/friends')).friends.map((f) => Object.assign({}, f, { since: f.since })); } catch (e) { return []; }
    }
    const live = new Set(livePeers().map((p) => p.id));
    return data().friends.map((f) => Object.assign({}, f, { online: live.has(f.id), rating: f.ratings.blitz, league: leagueOf(f.ratings.blitz) }));
  }
  async function removeFriend(id) {
    if (server()) { try { await NET().api('/api/friends/remove', { id }); } catch (e) { /* stays on the list */ } return; }
    const c = data();
    c.friends = c.friends.filter((f) => f.id !== id);
    A().save();
  }

  // ---------------------------------------------------------------- ratings without the server
  // World games in the live room move the rating on this device, by Elo against the rating the
  // opponent's page reports. Friend-code games are unrated, as on the server.
  function rated(pool, opp, score) {
    if (!POOLS.includes(pool)) return null;
    const c = data(), me = c.ratings[pool];
    const exp = 1 / (1 + Math.pow(10, (cleanR(opp) - me.r) / 400));
    const k = me.g < 10 ? 40 : 24;
    const before = me.r;
    me.r = Math.max(400, Math.round(me.r + k * (score - exp)));
    me.g++;
    A().save();
    publish();
    return { before, after: me.r };
  }

  // ---------------------------------------------------------------- rankings
  // Resolves { rows, me, needs, now, total }. Rows: { rank, name, country, city, rating, league, me, ai, id }.
  async function board(pool, scope) {
    pool = POOLS.includes(pool) ? pool : 'blitz';
    if (server()) {
      const res = await NET().api('/api/club?pool=' + pool + '&scope=' + scope + '&limit=10');
      if (res.location) fromServer(res.location);
      const rows = res.rows.map((r) => Object.assign({}, r));
      if (res.me && !res.me.listed) rows.push({ rank: res.me.rank, name: A().state.account && A().state.account.name || A().state.settings.name, country: place().country, city: place().city, rating: res.me.rating, league: res.me.league, me: true, provisional: res.me.provisional });
      return { rows, me: res.me, needs: res.needs, now: { online: res.now.online, people: res.now.people.map((p) => Object.assign({ live: true }, p)) }, total: res.total, live: true };
    }
    const here = place(), c = data();
    let needs = null, people = [];
    const live = livePeers();
    const ai = members().map((m) => ({ id: m.id, name: m.name, country: m.country, city: m.city, rating: m.ratings[pool], ai: true, member: m }));
    const real = live.map((p) => ({ id: p.id, name: p.name, country: p.country, city: null, rating: p.ratings[pool] }));
    if (scope === 'country') {
      if (!here.country) needs = 'country';
      else people = ai.concat(real).filter((r) => r.country === here.country);
    } else if (scope === 'city') {
      if (!here.city) needs = 'city';
      else people = ai.filter((r) => r.city === here.city);
    } else if (scope === 'following') {
      const liveIds = new Set(real.map((r) => r.id));
      people = ai.filter((r) => c.follow.includes(r.id))
        .concat(c.friends.filter((f) => !liveIds.has(f.id)).map((f) => ({ id: f.id, name: f.name, country: f.country, city: null, rating: f.ratings[pool], friend: true })))
        .concat(real.filter((r) => c.friends.some((f) => f.id === r.id)).map((r) => Object.assign(r, { friend: true })));
    } else people = ai.concat(real);
    const mine = c.ratings[pool];
    const rows = needs ? [] : people.concat([{ id: 'me', name: A().state.settings.name, country: here.country, city: here.city, rating: mine.r, me: true, provisional: mine.g < 5 }]);
    rows.sort((a, b) => b.rating - a.rating || (a.me ? -1 : 0));
    rows.forEach((r, i) => { r.rank = i + 1; r.league = leagueOf(r.rating); });
    const meRow = rows.find((r) => r.me);
    // The top ten, and the player with a neighbour on each side when they are further down.
    const at = meRow ? meRow.rank - 1 : -1;
    const shown = rows.filter((r, i) => i < 10 || (at >= 10 && Math.abs(i - at) <= 1));
    const nowList = live.map((p) => ({ id: p.id, name: p.name, country: p.country, league: leagueOf(p.ratings.blitz), live: true, friend: c.friends.some((f) => f.id === p.id) }))
      .concat(droppingBy(Math.max(3, 8 - live.length)).map((m) => ({ id: m.id, name: m.name, country: m.country, city: m.city, league: leagueOf(m.ratings.blitz), ai: true, member: m })));
    return { rows: shown, me: meRow ? { rank: meRow.rank, rating: meRow.rating, league: meRow.league, provisional: meRow.provisional } : { rank: 0, rating: mine.r, league: leagueOf(mine.r) }, needs,
      now: { online: live.length + 1, people: nowList }, total: rows.length, live: false };
  }
  // The player's rating in a pool, for the leagues panel. Server ratings come with the board.
  const myRating = (pool) => data().ratings[POOLS.includes(pool) ? pool : 'blitz'].r;

  return {
    POOLS, LEAGUES, leagueOf, START,
    countryName, flag, countries, citiesOf, countryOfCity, guess, nearest, gps,
    data, place, setPlace, autoLocate, fromServer,
    members, droppingBy, following, toggleFollow,
    card, publish, livePeers, addFriend, friends, removeFriend, rated, board, myRating,
    server,
  };
})();
if (typeof window !== 'undefined') window.ChacklateClub = ChacklateClub;
