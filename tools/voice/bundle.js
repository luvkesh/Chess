'use strict';
// Bundles folders of clips for a host that caps how many files a page may serve (the claude.ai
// artifact holds at most 511). Each clip is base64'd on its own and the results are joined into
// text parts of about 1.5 MB of sound each, so a line costs one part's download, not the folder's.
//   node tools/voice/bundle.js <public dir> <out dir> guide/hi pitch/hi tale/hi words/hi
// writes <out>/bundle/<folder>-<n>.js and <out>/bundle/index.json:
//   { parts: ['bundle/guide-hi-0.js', ...], clips: { 'guide/hi/home.mp3': [part, start, end], ... } }
// src/audio.js lineClip() reads a clip from its part when the index lists it. Hosts that serve files
// freely need no bundle: every clip is fetched by its own path.
const fs = require('fs');
const path = require('path');

const [pub, out, ...folders] = process.argv.slice(2);
if (!pub || !out || !folders.length) throw new Error('usage: node tools/voice/bundle.js <public dir> <out dir> <folder> ...');
const PART = 1.5 * 1024 * 1024;
const index = { parts: [], clips: {} };
fs.mkdirSync(path.join(out, 'bundle'), { recursive: true });
const walk = (d) => fs.readdirSync(d).sort().flatMap((f) => (fs.statSync(path.join(d, f)).isDirectory() ? walk(path.join(d, f)) : f.endsWith('.mp3') ? [path.join(d, f)] : []));
for (const folder of folders) {
  let text = '', raw = 0, n = 0;
  const flush = () => {
    if (!text) return;
    const name = 'bundle/' + folder.replace(/\//g, '-') + '-' + n++ + '.js';
    fs.writeFileSync(path.join(out, name), text);
    index.parts.push(name);
    text = ''; raw = 0;
  };
  for (const file of walk(path.join(pub, folder))) {
    const bytes = fs.readFileSync(file);
    if (raw && raw + bytes.length > PART) flush();
    const b64 = bytes.toString('base64');
    index.clips[path.relative(pub, file).split(path.sep).join('/')] = [index.parts.length, text.length, text.length + b64.length];
    text += b64; raw += bytes.length;
  }
  flush();
}
fs.writeFileSync(path.join(out, 'bundle', 'index.json'), JSON.stringify(index));
console.log(Object.keys(index.clips).length, 'clips in', index.parts.length, 'parts');
