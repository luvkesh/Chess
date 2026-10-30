'use strict';
// The Club: rankings by pool with Global, Country, City and Following filters, leagues, a friends
// list made from friend-code games, and who is in the club now.
//
// Children's safety (src/family.js):
//   - public rankings (Global, Country, City) and "In the club now" list adults only, as the
//     privacy policy promises; an under-18 sees their own place but is never shown to others;
//   - under-18s keep a country only, never a city; nobody's coordinates are ever sent or kept;
//   - friends come only from games started with a code, which friends share in person.

// Rating where each league starts. Everyone starts at 1500, in Bronze.
const LEAGUES = [['Master', 2200], ['Diamond', 2050], ['Platinum', 1900], ['Gold', 1750], ['Silver', 1600], ['Bronze', 1400], ['Beginner', 0]];
const leagueOf = (r) => (LEAGUES.find(([, min]) => r >= min) || LEAGUES[LEAGUES.length - 1])[0];
const POOLS = ['bullet', 'blitz', 'rapid'];
const SCOPES = ['global', 'country', 'city', 'following'];
const SOURCES = ['tz', 'manual', 'gps'];

const validCountry = (c) => typeof c === 'string' && /^[A-Z]{2}$/.test(c);
const validCity = (c) => typeof c === 'string' && c.length <= 40 && /^[\p{L}][\p{L} .'-]*$/u.test(c);

function create(db, lobby, policy) {
  const adult = (u) => policy.publicProfile(u);

  // The player's place, as the player sees it. City only for adults.
  function location(u) { return { country: u.country || null, city: adult(u) ? u.city || null : null, source: u.loc_src || null }; }

  function setLocation(u, body) {
    const country = body.country === null || body.country === '' ? null : String(body.country || '').toUpperCase();
    if (country !== null && !validCountry(country)) return [400, { error: 'Choose a country from the list.' }];
    let city = body.city == null || body.city === '' ? null : String(body.city).trim();
    if (city !== null && !validCity(city)) return [400, { error: 'Choose a city from the list.' }];
    // No city for under-18s, ever: the country is as close as the Club gets.
    if (!adult(u) || !country) city = null;
    const source = SOURCES.includes(body.source) ? body.source : 'manual';
    db.run('UPDATE users SET country = ?, city = ?, loc_src = ? WHERE id = ?', country, city, country ? source : null, u.id);
    return [200, location(Object.assign({}, u, { country, city, loc_src: country ? source : null }))];
  }

  function row(r, i, viewer) {
    const isAdult = r.age_band === 'adult' && !r.guest;
    return { rank: i + 1, name: r.name, country: r.country || null, city: isAdult ? r.city || null : null, rating: Math.round(r.rating), games: r.games, league: leagueOf(r.rating), me: !!viewer && r.id === viewer.id };
  }

  // Rankings for one pool and filter. `viewer` may be null (signed out).
  function rankings(viewer, pool, scope, limit) {
    pool = POOLS.includes(pool) ? pool : 'blitz';
    scope = SCOPES.includes(scope) ? scope : 'global';
    limit = Math.min(100, limit || 50);
    const out = { pool, scope, rows: [], me: null, needs: null };
    const base = 'SELECT u.id, u.name, u.country, u.city, u.age_band, u.guest, r.rating, r.games FROM ratings r JOIN users u ON u.id = r.user_id ' +
      'WHERE r.pool = ? AND u.banned IS NULL AND u.deleted IS NULL ';
    let where = "AND u.guest = 0 AND u.age_band = 'adult' AND r.games >= ? ", args = [pool, lobby.minGames];
    if (scope === 'country') {
      if (!viewer || !viewer.country) { out.needs = 'country'; return out; }
      where += 'AND u.country = ? '; args.push(viewer.country);
    } else if (scope === 'city') {
      if (!viewer || !adult(viewer)) { out.needs = 'adult'; return out; }
      if (!viewer.city) { out.needs = 'city'; return out; }
      where += 'AND u.country = ? AND u.city = ? '; args.push(viewer.country, viewer.city);
    } else if (scope === 'following') {
      if (!viewer) { out.needs = 'account'; return out; }
      // Friends, whatever their age: this list is private to the two of them.
      where = 'AND u.id IN (SELECT friend_id FROM friends WHERE user_id = ?) '; args = [pool, viewer.id];
    }
    const all = db.all(base + where + 'ORDER BY r.rating DESC', ...args);
    out.total = all.length;
    out.rows = all.slice(0, limit).map((r, i) => row(r, i, viewer));
    if (viewer) {
      const mine = lobby.rating(viewer.id, pool), rating = Math.round(mine.rating);
      const listed = out.rows.find((r) => r.me);
      const rank = listed ? listed.rank : all.filter((r) => r.id !== viewer.id && Math.round(r.rating) > rating).length + 1;
      out.me = { rank, rating, games: mine.games, league: leagueOf(rating), provisional: mine.games < lobby.minGames, listed: !!listed };
    }
    return out;
  }

  // Everyone online is counted; only adults are named.
  function now(viewer) {
    let online = 0;
    const people = [];
    for (const p of lobby.players.values()) {
      if (!p.sockets.size) continue;
      online++;
      if ((viewer && p.user.id === viewer.id) || !adult(p.user) || people.length >= 8) continue;
      people.push({ name: p.user.name, country: p.user.country || null, league: leagueOf(lobby.rating(p.user.id, 'blitz').rating), playing: !!p.gameId });
    }
    return { online, people };
  }

  function friends(u) {
    return db.all('SELECT u.id, u.name, u.country, u.city, u.age_band, u.guest, f.since FROM friends f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND u.banned IS NULL AND u.deleted IS NULL ORDER BY f.since DESC', u.id)
      .map((r) => {
        const p = lobby.players.get(r.id);
        const blitz = lobby.rating(r.id, 'blitz');
        return { id: r.id, name: r.name, country: r.country || null, since: r.since, online: !!(p && p.sockets.size), rating: Math.round(blitz.rating), league: leagueOf(blitz.rating) };
      });
  }

  async function handle(req, p, body, url, user) {
    if (p === '/api/club') {
      const out = rankings(user, url.searchParams.get('pool'), url.searchParams.get('scope'), Number(url.searchParams.get('limit')) || 50);
      return [200, Object.assign(out, { now: now(user), location: user ? location(user) : null, leagues: LEAGUES })];
    }
    if (!user) return [401, { error: 'Not signed in.' }];
    if (p === '/api/friends') return [200, { friends: friends(user) }];
    if (p === '/api/friends/remove' && req.method === 'POST') {
      const id = Number(body.id);
      db.run('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', user.id, id, id, user.id);
      return [200, { ok: true }];
    }
    if (p === '/api/account/location' && req.method === 'POST') return setLocation(user, body);
    return null;
  }

  return { handle, location, rankings, friends, now };
}

module.exports = { create, LEAGUES, leagueOf };
