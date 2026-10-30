'use strict';
// Turns the recorded WAV files into the voice packs the game ships, and writes voice/index.json.
//   node tools/voice/encode.js /tmp/voice/wav
// A pack is one MP3 per voice: every clip encoded on its own, then joined in the order of the
// voice's key list. Joined MP3 files still play as one file, and clip i is the byte range
// sizes[0..i-1] .. +sizes[i], so the game fetches (or slices) only the clip it needs.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const { jobs } = require('./lines');
const V = require('../../packages/content/voice.json');

const wavDir = process.argv[2];
const cache = path.join(wavDir, '.mp3');
const out = path.join(__dirname, '..', '..', 'apps', 'web-prototype', 'public', 'voice');
const index = { version: 2, engine: 'Kokoro-82M (Apache-2.0)', keys: {}, voices: {} };

const want = new Map();
for (const j of jobs()) {
  if (!want.has(j.voice)) want.set(j.voice, []);
  want.get(j.voice).push(j.key);
}
// Voices of one language say the same lines, so they share one key list.
for (const v of V.voices) {
  const keys = want.get(v.id).slice().sort();
  if (!index.keys[v.lang]) index.keys[v.lang] = keys;
  else if (index.keys[v.lang].join() !== keys.join()) throw new Error(v.id + ' says different lines from other ' + v.lang + ' voices');
}

fs.mkdirSync(out, { recursive: true });
let made = 0;
const missing = [];
for (const v of V.voices) {
  const parts = [];
  for (const key of index.keys[v.lang]) {
    const wav = path.join(wavDir, v.id, key + '.wav');
    const mp3 = path.join(cache, v.id, key + '.mp3');
    if (!fs.existsSync(mp3)) {
      if (!fs.existsSync(wav)) { missing.push(v.id + '/' + key); continue; }
      fs.mkdirSync(path.dirname(mp3), { recursive: true });
      // Trim leading silence, even out loudness, mono 24 kHz at 40 kb/s: clear speech, small files.
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7', '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', '-write_xing', '0', '-id3v2_version', '0', mp3]);
      made++;
    }
    parts.push(fs.readFileSync(mp3));
  }
  if (parts.length !== index.keys[v.lang].length) continue;
  const pack = Buffer.concat(parts);
  fs.writeFileSync(path.join(out, v.id + '.mp3'), pack);
  // v: a hash of the pack, so its URL changes whenever it is re-recorded and can be cached for good.
  index.voices[v.id] = { lang: v.lang, v: crypto.createHash('sha1').update(pack).digest('hex').slice(0, 10), sizes: parts.map((p) => p.length) };
}
// Packs of voices that are no longer in voice.json are deleted.
for (const f of fs.readdirSync(out)) {
  const p = path.join(out, f);
  if (fs.statSync(p).isDirectory() || (f.endsWith('.mp3') && !index.voices[f.slice(0, -4)])) fs.rmSync(p, { recursive: true });
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index));
console.log('encoded', made, 'new clips;', Object.keys(index.voices).length, 'voice packs;', missing.length, 'lines not recorded yet');
if (missing.length) process.exitCode = 1;
