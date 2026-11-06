// Draws the four Learn medals (lessons, puzzles, openings, endgames) with the game's art.js and its
// rendered gold pieces, and saves them as small WebP pictures in img/learn-*.webp (Playwright + Pillow).
//   node apps/website/tools/render-learn.js
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '../../..');
const artDir = path.join(root, 'apps/web-prototype/src/art');

// the real gold pieces, so the medals show the 3D set and not the flat drawings
global.CHACKLATE_ART = { piece: {}, view: {} };
for (const f of fs.readdirSync(artDir)) {
  const m = /^piece-(\w)\.webp$/.exec(f);
  if (m) global.CHACKLATE_ART.piece[m[1]] = 'data:image/webp;base64,' + fs.readFileSync(path.join(artDir, f)).toString('base64');
}
const ART = require(path.join(root, 'apps/web-prototype/src/art.js'));
const medals = {
  'learn-lessons': ART.ruleBookUri(),
  'learn-puzzles': ART.miniUri('fork', { from: '#a3294f', to: '#4a0c1e' }),
  'learn-openings': ART.miniUri('opening', { from: '#2a5aa8', to: '#0c1f4a' }),
  'learn-endgames': ART.miniUri('endgame', { from: '#6a3a8e', to: '#24103a' }),
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 240, height: 240 }, deviceScaleFactor: 1 });
  const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'learn-'));
  for (const [name, uri] of Object.entries(medals)) {
    await page.setContent('<body style="margin:0;background:transparent"><img src="' + uri + '" width="240" height="240" style="display:block"></body>');
    await page.waitForFunction(() => document.images[0].complete);
    await page.screenshot({ path: path.join(tmp, name + '.png'), omitBackground: true });
  }
  await browser.close();
  for (const name of Object.keys(medals)) {
    execFileSync('python3', ['-c', 'import sys;from PIL import Image;Image.open(sys.argv[1]).save(sys.argv[2],quality=88,method=6)',
      path.join(tmp, name + '.png'), path.join(__dirname, '..', 'img', name + '.webp')]);
  }
  console.log('wrote', Object.keys(medals).join(', '));
})();
