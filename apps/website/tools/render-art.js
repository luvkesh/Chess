// Draws the site's flat art (crest, animal portraits, era banners, piece icons) with the
// game's own art.js and prints it as JSON data URIs for build.py.
'use strict';
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const ART = require(path.join(root, 'apps/web-prototype/src/art.js'));
const C = require(path.join(root, 'packages/content/campaign.json'));

const out = { crest: ART.crestUri() };
const face = (who) => ART.portraitUri(who.animal, { from: who.colors[0], to: who.colors[1] });
out.praline = face(C.coach);
for (const e of C.eras) {
  out['coach-' + e.id] = face({ animal: e.coach.animal, colors: e.colors });
  out['banner-' + e.id] = ART.bannerUri(e.landmark, { from: e.colors[0], to: e.colors[1] });
}
for (const o of C.opponents) out['opp-' + o.id] = face(o);
for (const t of ['k', 'n']) out['piece-' + t] = ART.pieceUri(t);
process.stdout.write(JSON.stringify(out));
