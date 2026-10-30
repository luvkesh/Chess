// The Club's data on the device (src/club.js): places, leagues, AI players, the place picker,
// and what is shared with the live room. Run: node apps/web-prototype/test/club.test.js
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const settings = {};
const safety = null, mode = 'offline';
const ctx = {
  window: {}, navigator: { language: 'en-GB', languages: ['en-GB'] }, Intl, Math, Date, Promise, String, Number, JSON, Array, Set, Object,
};
ctx.window.ChacklateApp = { state: { settings }, save() {} };
ctx.window.ChacklateNet = { mode: () => mode, safety: () => safety, api: async () => ({}) };
vm.createContext(ctx);
for (const f of ['places.js', 'club.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', f), 'utf8').replace(/^const (\w+) =/m, 'var $1 ='), ctx);
const C = ctx.ChacklateClub;

// Leagues match the server's.
const server = require('../../../services/game-server/src/club.js');
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.LEAGUES)), server.LEAGUES);
for (const r of [0, 1399, 1400, 1500, 1600, 1999, 2200, 2600]) assert.strictEqual(C.leagueOf(r), server.leagueOf(r));
assert.strictEqual(C.leagueOf(C.START), 'Bronze');

// Places: the nearest city, a country name and a flag.
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.nearest(19.1, 72.9))), { country: 'IN', city: 'Mumbai', source: 'gps' });
assert.strictEqual(C.countryName('IN'), 'India');
assert.strictEqual(C.flag('IN'), '🇮🇳');
assert.ok(C.citiesOf('IN').includes('Bengaluru'));

// AI players: the same for everyone, never named like players, spread over the leagues.
const ai = C.members();
assert.strictEqual(ai.length, 72);
assert.ok(ai.every((m) => m.ai && /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(m.name)));
assert.ok(ai.filter((m) => m.country === 'IN').length > 15);
assert.ok(new Set(ai.map((m) => C.leagueOf(m.ratings.blitz))).size >= 5);

// Anyone may keep a city; a pick sticks.
C.setPlace({ country: 'IN', city: 'Pune', source: 'manual' });
assert.deepStrictEqual(JSON.parse(JSON.stringify(C.place())), { country: 'IN', city: 'Pune', source: 'manual' });
C.autoLocate();
assert.strictEqual(C.place().source, 'manual');
// Only a country goes into the live room.
assert.deepStrictEqual(Object.keys(C.card()).sort(), ['cc', 'cid', 'name', 'r']);

// Ratings without the server: Elo, and friends from codes keep cleaned names.
const before = C.data().ratings.blitz.r;
const out = C.rated('blitz', 1500, 1);
assert.ok(out.after > before);
C.addFriend({ cid: 'abc', name: '<b>Swift Fox</b>', cc: 'xx', r: { blitz: 99999 } });
const f = C.data().friends[0];
assert.deepStrictEqual([f.name, f.country, f.ratings.blitz], ['bSwift Foxb', null, 3000]);

C.board('blitz', 'country').then((res) => {
  assert.ok(res.rows.every((r) => r.country === 'IN'));
  assert.ok(res.rows.some((r) => r.me));
  assert.ok(res.rows.length <= 13, String(res.rows.length));
  console.log('club: all passed');
});
