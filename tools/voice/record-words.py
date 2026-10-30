"""Records the lessons that have their own speakers, such as Words at the table, with Kokoro-82M, offline.

    HF_HOME=... python3.12 tools/voice/record-words.py

Needs the `kokoro` package, its weights and ffmpeg; see the setup in record.py. The lines come from
`node tools/voice/lines.js words`: Rooky (his guide.json voice) says every English line and word, and
Priya (her voice.json voice) says each word in Hindi. Natural pauses come from pauses.py. Clips are saved
as apps/web-prototype/public/words/<who>/<key>.mp3, keyed like every other line (voiceKey of the shown
text). words/index.json keeps the exact words and voice of every clip, so test/voice.test.js can tell
when a line changed and must be recorded again. Lines whose clip is up to date are skipped.
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
content = root / 'packages' / 'content'
guide = json.loads((content / 'guide.json').read_text())
voices = {v['id']: v for v in json.loads((content / 'voice.json').read_text())['voices']}
engines = {'rooky': (guide['speakers']['rooky']['engine'], guide['speed']), 'priya': (voices['priya']['engine'], 0.9)}
lines = json.loads(subprocess.run(['node', str(root / 'tools' / 'voice' / 'lines.js'), 'words'], check=True, capture_output=True).stdout)
out = root / 'apps' / 'web-prototype' / 'public' / 'words'
index_path = out / 'index.json'
index = json.loads(index_path.read_text()) if index_path.exists() else {}
pipes = {}
keep = set()
for line in lines:
    voice, speed = engines[line['who']]
    name = line['who'] + '/' + line['key']
    want = {'voice': voice, 'text': line['text']}
    keep.add(name)
    path = out / (name + '.mp3')
    if index.get(name) == want and path.exists():
        continue
    lang = voice[0]   # a: American English, b: British English, h: Hindi
    pipe = pipes.get(lang) or pipes.setdefault(lang, KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M'))
    audio = speak(pipe, line['spoken'], voice, speed, guide['pause']['comma'], guide['pause']['stop'])
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        sf.write(wav.name, audio, RATE)
        # the same treatment as the guide's clips: leading silence trimmed, even loudness, mono 24 kHz at 40 kb/s
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', str(path)], check=True)
    index[name] = want
    print(name, round(len(audio) / RATE, 1), 's', line['text'], flush=True)
# clips of lines that are no longer said are deleted
for f in out.glob('*/*.mp3'):
    if f.parent.name + '/' + f.stem not in keep:
        f.unlink()
index = {k: index[k] for k in sorted(keep)}
index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False) + '\n')
