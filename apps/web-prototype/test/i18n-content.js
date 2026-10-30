// The English of every content string the menus show: the animal friends, the era names and
// their friends' lines, missions, the season, achievements and level titles. The content files
// stay the source of the English; packages/content/i18n/content.json holds the other languages
// under these keys, and test/i18n.test.js checks the two agree. Story pages, lessons, openings
// and endgames are narrated and stay in English for now.
const ChacklateProgress = require('../src/progress.js');
const content = (f) => require('../../../packages/content/' + f);

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function expected() {
  const campaign = content('campaign.json'), missions = content('missions.json'), seasons = content('seasons.json');
  const PG = ChacklateProgress(content('catalog.json'), { seasons, missions, campaign });
  const out = {};
  const put = (k, v) => { if (v) out[k] = v; };
  for (const o of campaign.opponents.concat([campaign.coach])) {
    for (const f of ['full', 'blurb', 'hello', 'win', 'lose', 'draw']) put('opp.' + o.id + '.' + f, o[f]);
    put('opp.' + o.id + '.species', 'the ' + (o.full || '').replace(o.name, '').trim().replace(/^the /, ''));
  }
  for (const e of campaign.eras) {
    for (const f of ['name', 'title', 'when', 'place']) put('era.' + e.id + '.' + f, e[f]);
    e.stages.forEach((s, k) => put('era.' + e.id + '.stage' + k, s.title));
    for (const f of ['full', 'hello', 'win', 'lose']) put('coach.' + e.coach.id + '.' + f, e.coach[f]);
  }
  for (const m of missions.missions) put('mission.' + m.id, m.text);
  for (const s of seasons.seasons) { put('season.' + s.id + '.name', s.name); put('season.' + s.id + '.blurb', s.blurb); }
  for (const a of PG.ACHIEVEMENTS) { put('ach.' + a.id + '.name', a.name); put('ach.' + a.id + '.desc', a.desc); }
  for (let l = 1; l < 100; l++) { const t = PG.levelFor(PG.xpFor(l)).title; put('title.' + slug(t), t); }
  return out;
}
module.exports = { expected, slug };
