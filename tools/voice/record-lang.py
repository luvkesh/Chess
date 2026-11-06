"""Records Rooky and his friends in another language with Kokoro-82M, offline.

    node tools/voice/lang-lines.js hi > /tmp/voice/hi.json
    HF_HOME=... python3.12 tools/voice/record-lang.py /tmp/voice/hi.json [guide|pitch|tale|words|site ...]

Needs the `kokoro` package, its weights and ffmpeg (see record.py). The lines come translated from
lang-lines.js; who says them in which voice is in langs.json. Clips go where the game and website look:
apps/web-prototype/public/{guide,pitch,tale,words}/<lang>/... and apps/website/audio/<lang>/, each folder
with an index.json of the words and voice of every clip. Clips already up to date are skipped, and clips of
lines that are gone are deleted. The game's lesson voices in that language are voice packs made by
record.py and encode.js like the English ones.
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile

os.environ['HF_HUB_OFFLINE'] = '1'
import numpy as np
import soundfile as sf
from kokoro import KPipeline

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from pauses import speak, _breath, RATE

root = pathlib.Path(__file__).parent.parent.parent
jobs = json.loads(pathlib.Path(sys.argv[1]).read_text())
lang = jobs['lang']
cfg = json.loads((pathlib.Path(__file__).parent / 'langs.json').read_text())[lang]
pause = json.loads((root / 'packages' / 'content' / 'guide.json').read_text())['pause']
only = set(sys.argv[2:])
public = root / 'apps' / 'web-prototype' / 'public'
dirs = {k: public / k / lang for k in ('guide', 'pitch', 'tale', 'words')}
dirs['site'] = root / 'apps' / 'website' / 'audio' / lang
LANG_CODE = {'hi': 'h', 'es': 'e', 'fr': 'f', 'it': 'i', 'pt': 'p', 'ja': 'j', 'zh': 'z'}[lang]
pipe = None


def voice_of(who):
    s = cfg['speakers'][who]
    return s['engine'], s.get('speed', cfg['speed'])


def encode(audio, mp3):
    mp3.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        sf.write(wav.name, audio, RATE)
        # as the English clips: leading silence trimmed, even loudness, mono 24 kHz at 40 kb/s
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', str(mp3)], check=True)


def say(text, who):
    global pipe
    pipe = pipe or KPipeline(lang_code=LANG_CODE, repo_id='hexgrad/Kokoro-82M')
    voice, speed = voice_of(who)
    return speak(pipe, text, voice, speed, pause['comma'], pause['stop'])


def cued(cues, who):
    """One clip from a caption per sentence, with a full breath between, and when each starts."""
    rng = np.random.default_rng(7)
    out, marks, n = [], [], 0
    for c in cues:
        a = say(c, who)
        if out:
            prev = _breath(out.pop(), pause['stop'], rng)
            n += len(prev)
            out.append(prev)
        marks.append(round(n / RATE, 2))
        out.append(a)
    return np.concatenate(out), [{'t': t, 'text': c} for t, c in zip(marks, cues)]


for kind in ('guide', 'pitch', 'tale', 'words', 'site'):
    if only and kind not in only:
        continue
    out = dirs[kind]
    index_path = out / 'index.json'
    old = json.loads(index_path.read_text()) if index_path.exists() else {}
    if kind == 'site':
        old = old.get('lines', {})
    index = {}
    for job in jobs[kind]:
        key, who = job['key'], job['who']
        voice = voice_of(who)[0]
        mp3 = out / (key + '.mp3')
        if kind == 'site':
            text = ' '.join(job['cues'])
            if old.get(key, {}).get('text') == text and old[key].get('voice') == voice and mp3.exists():
                index[key] = old[key]
                continue
            audio, cues = cued(job['cues'], who)
            index[key] = {'text': text, 'voice': voice, 'cues': cues}
        else:
            want = {'who': who, 'voice': voice, 'text': job['text']}
            if old.get(key) == want and mp3.exists():
                index[key] = want
                continue
            audio = say(job['text'], who)
            index[key] = want
        encode(audio, mp3)
        print(kind, key, round(len(audio) / RATE, 1), 's', flush=True)
    # clips of lines that are gone are deleted
    for f in out.rglob('*.mp3'):
        if f.relative_to(out).with_suffix('').as_posix() not in index:
            f.unlink()
    out.mkdir(parents=True, exist_ok=True)
    body = {'lang': lang, 'lines': index} if kind == 'site' else index
    index_path.write_text(json.dumps(body, indent=1, ensure_ascii=False) + '\n')
    print(kind, len(index), 'clips', flush=True)
