"""Records the game's audio guide (packages/content/guide.json) with Kokoro-82M, offline.

    HF_HOME=... python3.12 tools/voice/record-guide.py [key ...]

Needs the `kokoro` package, its weights and ffmpeg; see the setup in record.py. Each line is spoken by
its speaker's voice with natural pauses (pauses.py) and saved as apps/web-prototype/public/guide/<key>.mp3.
guide/index.json keeps the exact words and voice of every clip, so test/guide.test.js can tell when a
line changed and must be recorded again. Lines whose clip is up to date are skipped.
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
out = root / 'apps' / 'web-prototype' / 'public' / 'guide'
out.mkdir(parents=True, exist_ok=True)
index_path = out / 'index.json'
index = json.loads(index_path.read_text()) if index_path.exists() else {}
only = set(sys.argv[1:])
pipes = {}
for key, line in guide['lines'].items():
    voice = guide['speakers'][line['who']]['engine']
    want = {'who': line['who'], 'voice': voice, 'text': line['text']}
    if (only and key not in only) or (not only and index.get(key) == want and (out / (key + '.mp3')).exists()):
        continue
    lang = voice[0]   # a: American English, b: British English
    pipe = pipes.get(lang) or pipes.setdefault(lang, KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M'))
    audio = speak(pipe, line['text'], voice, guide['speed'], guide['pause']['comma'], guide['pause']['stop'])
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        sf.write(wav.name, audio, RATE)
        # the same treatment as the game's other clips, keeping the pauses: leading silence trimmed,
        # even loudness, mono 24 kHz at 40 kb/s
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', str(out / (key + '.mp3'))], check=True)
    index[key] = want
    print(key, round(len(audio) / RATE, 1), 's', flush=True)
index = {k: index[k] for k in guide['lines'] if k in index}
index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False) + '\n')
