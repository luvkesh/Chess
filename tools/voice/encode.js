'use strict';
// Turns the recorded WAV files into the MP3 clips the game ships, and writes voice/index.json.
//   node tools/voice/encode.js /tmp/voice/wav
// Clips no longer in tools/voice/lines.js are deleted, so the folder only holds what the game can say.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { jobs } = require('./lines');

const wavDir = process.argv[2];
const out = path.join(__dirname, '..', '..', 'apps', 'web-prototype', 'public', 'voice');
const index = { version: 1, engine: 'Kokoro-82M (Apache-2.0)', voices: {} };
let made = 0, missing = 0;
const want = new Map();
for (const j of jobs()) {
  if (!want.has(j.voice)) want.set(j.voice, new Set());
  want.get(j.voice).add(j.key);
}
for (const [voice, keys] of want) {
  const dir = path.join(out, voice);
  fs.mkdirSync(dir, { recursive: true });
  for (const f of fs.readdirSync(dir)) if (!keys.has(f.replace(/\.mp3$/, ''))) fs.unlinkSync(path.join(dir, f));
  index.voices[voice] = [];
  for (const key of [...keys].sort()) {
    const mp3 = path.join(dir, key + '.mp3');
    const wav = path.join(wavDir, voice, key + '.wav');
    if (!fs.existsSync(mp3)) {
      if (!fs.existsSync(wav)) { missing++; continue; }
      // Trim leading silence, even out loudness, mono 24 kHz at 40 kb/s: clear speech, small files.
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', wav, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7', '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', mp3]);
      made++;
    }
    index.voices[voice].push(key);
  }
}
fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index));
console.log('encoded', made, 'new clips;', missing, 'lines not recorded yet');
