'use strict';
// Packs the recorded voices into a few files per voice, for hosts that limit how many files a page can
// carry (the live game artifact). Each clip stays a whole MP3, stored as a byte range of its pack; the
// game reads voice/packs.json first and falls back to the single clips when it is not served.
//   node tools/voice/pack.js <out>      writes <out>/voice/packs.json and <out>/voice/packs/<voice>-<0-f>.mp3
// Publish both under voice/ next to the page.
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', '..', 'apps', 'web-prototype', 'public', 'voice');
const out = path.join(process.argv[2] || '.', 'voice');
fs.mkdirSync(path.join(out, 'packs'), { recursive: true });
const index = JSON.parse(fs.readFileSync(path.join(src, 'index.json'), 'utf8'));
const packs = { version: 1, voices: {} };
let files = 0, bytes = 0;
for (const [voice, keys] of Object.entries(index.voices)) {
  packs.voices[voice] = {};
  // one pack per first hex digit of the key: 16 packs per voice, a lesson line loads one of them
  const groups = {};
  for (const key of keys) (groups[key[0]] = groups[key[0]] || []).push(key);
  for (const [g, list] of Object.entries(groups)) {
    const name = 'packs/' + voice + '-' + g + '.mp3';
    const parts = [];
    let at = 0;
    for (const key of list.sort()) {
      const b = fs.readFileSync(path.join(src, voice, key + '.mp3'));
      packs.voices[voice][key] = [name, at, b.length];
      parts.push(b);
      at += b.length;
    }
    fs.writeFileSync(path.join(out, name), Buffer.concat(parts));
    files++; bytes += at;
  }
}
fs.writeFileSync(path.join(out, 'packs.json'), JSON.stringify(packs));
console.log('packed', Object.keys(packs.voices).length, 'voices into', files, 'files,', (bytes / 1048576).toFixed(1), 'MB');
