// Draws the site's flat art (crest, animal portraits, era banners, piece icons) with the
// game's own art.js and prints it as JSON data URIs for build.py.
'use strict';
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const ART = require(path.join(root, 'apps/web-prototype/src/art.js'));
const C = require(path.join(root, 'packages/content/campaign.json'));

const out = { crest: ART.crestUri() };
const face = (who) => ART.portraitUri(who.animal, { from: who.colors[0], to: who.colors[1] });
out.coach = face(C.coach);
for (const e of C.eras) {
  out['coach-' + e.id] = face({ animal: e.coach.animal, colors: e.colors });
  out['banner-' + e.id] = ART.bannerUri(e.landmark, { from: e.colors[0], to: e.colors[1] });
}
for (const o of C.opponents) out['opp-' + o.id] = face(o);
for (const t of ['k', 'n']) out['piece-' + t] = ART.pieceUri(t);
// One showpiece per kind of extra, drawn exactly as the game's Collection draws it.
const CAT = require(path.join(root, 'packages/content/catalog.json'));
const item = (id) => CAT.items.find((i) => i.id === id).data;
out['detail-capture'] = ART.fxUri(item('capture.gold-sparks.v1').kind, item('capture.gold-sparks.v1').colors);
out['detail-victory'] = ART.fxUri(item('victory.fireworks.v1').kind, item('victory.fireworks.v1').colors);
out['detail-trail'] = ART.fxUri('trail', item('trail.ruby.v1').colors);
out['detail-clock'] = ART.clockUri(item('clock.gold.v1'));
const king = item('avatar.king.v1');
out['detail-avatar'] = ART.medalUri(king.art, { from: king.from, to: king.to });
const knight = item('avatar.knight.v1');
out['detail-frame'] = ART.medalUri(knight.art, { from: knight.from, to: knight.to });
out['detail-frame-ring'] = item('frame.gold.v1').ring;
// The details showcase's demos: avatars for the player card, a rook medal inside the frames,
// and the game's real gold pieces (rendered from the 3D set) standing on the little board.
for (const id of ['avatar.ember.v1', 'avatar.bao.v1', 'avatar.rook.v1']) {
  const a = item(id);
  out['fx-' + id.split('.')[1]] = ART.medalUri(a.art, { from: a.from, to: a.to });
}
const fs = require('fs');
for (const t of ['k', 'q', 'r', 'b', 'n', 'p']) {
  out['fx-piece-' + t] = 'data:image/webp;base64,' + fs.readFileSync(path.join(root, 'apps/web-prototype/src/art/piece-' + t + '.webp')).toString('base64');
}
// Place badges: each landmark in colour, in its own sky, inside a gold bezel (tools/place-icons.js).
const ICONS = require('./place-icons.js');
for (const e of C.eras) out['icon-' + e.id] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(ICONS.icon(e.id));
process.stdout.write(JSON.stringify(out));
