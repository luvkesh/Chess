"""Records what Rooky says about each Collection item (packages/content/pitches.json) with Kokoro-82M, offline.

    HF_HOME=... python3.12 tools/voice/record-pitches.py [item id ...]

Needs the `kokoro` package, its weights and ffmpeg; see the setup in record.py. Rooky's voice, speed and
pauses are the audio guide's (guide.json), so he sounds the same everywhere. Each line is saved as
apps/web-prototype/public/pitch/<item id>.mp3, and pitch/index.json keeps the words and voice of every
clip so test/pitch.test.js can tell when a line changed. Chess sets whose pitch is the website's
(site: ...) are not recorded here: the game plays the website's clip. Lines whose clip is up to date are skipped.
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile

os.environ['HF_HUB_OFFLINE'] = '1'
import soundfile as sf
from kokoro import KPipeline

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from pauses import speak, RATE

root = pathlib.Path(__file__).parent.parent.parent
guide = json.loads((root / 'packages' / 'content' / 'guide.json').read_text())
pitches = json.loads((root / 'packages' / 'content' / 'pitches.json').read_text())
voice = guide['speakers'][pitches['who']]['engine']
lines = {k: v for k, v in pitches['lines'].items() if isinstance(v, str)}
out = root / 'apps' / 'web-prototype' / 'public' / 'pitch'
out.mkdir(parents=True, exist_ok=True)
index_path = out / 'index.json'
index = json.loads(index_path.read_text()) if index_path.exists() else {}
only = set(sys.argv[1:])
pipe = KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M')
for key, text in lines.items():
    want = {'voice': voice, 'text': text}
    if (only and key not in only) or (not only and index.get(key) == want and (out / (key + '.mp3')).exists()):
        continue
    audio = speak(pipe, text, voice, guide['speed'], guide['pause']['comma'], guide['pause']['stop'])
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        sf.write(wav.name, audio, RATE)
        # the guide's treatment: leading silence trimmed, even loudness, mono 24 kHz at 40 kb/s
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', str(out / (key + '.mp3'))], check=True)
    index[key] = want
    print(key, round(len(audio) / RATE, 1), 's', flush=True)
    index_path.write_text(json.dumps({k: index[k] for k in lines if k in index}, indent=1, ensure_ascii=False) + '\n')
# clips of lines that are gone are deleted
for f in out.glob('*.mp3'):
    if f.stem not in lines:
        f.unlink()
index_path.write_text(json.dumps({k: index[k] for k in lines if k in index}, indent=1, ensure_ascii=False) + '\n')
