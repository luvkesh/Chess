"""Records the era stories (the tale stage in packages/content/campaign.json) with Kokoro-82M, offline.

    HF_HOME=... python3.12 tools/voice/record-tales.py

Needs the `kokoro` package, its weights and ffmpeg; see the setup in record.py. Each era's friend reads
its own story in the voice it has in guide.json: every page, the question and the explanation of the
answer, with natural pauses (pauses.py). Clips are saved as apps/web-prototype/public/tale/<era>/<key>.mp3,
where key is the voiceKey of the words on screen. tale/index.json keeps the words and voice of every
clip, so test/tale.test.js can tell when a page changed and must be recorded again. Up-to-date clips are skipped.
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
campaign = json.loads((content / 'campaign.json').read_text())
out = root / 'apps' / 'web-prototype' / 'public' / 'tale'
out.mkdir(parents=True, exist_ok=True)
index_path = out / 'index.json'
index = json.loads(index_path.read_text()) if index_path.exists() else {}


def voice_key(text):
    """FNV-1a, 32-bit, as hex. Kept identical to voiceKey() in apps/web-prototype/src/audio.js."""
    import unicodedata
    h = 0x811c9dc5
    for ch in unicodedata.normalize('NFC', text):
        c = ord(ch)
        for part in ([c & 0xff] + ([(c >> 8) & 0xff] if c > 0xff else []) + ([(c >> 16) & 0xff] if c > 0xffff else [])):
            h ^= part
            h = (h * 0x01000193) & 0xffffffff
    return '%08x' % h


lines = {}
for era in campaign['eras']:
    who = era['coach']['id']
    for stage in era['stages']:
        if stage['kind'] != 'tale':
            continue
        for text in stage['pages'] + [stage['quiz']['q'], stage['quiz']['explain']]:
            lines[era['id'] + '/' + voice_key(text)] = {'who': who, 'voice': guide['speakers'][who]['engine'], 'text': text}

pipes = {}
for key, want in lines.items():
    mp3 = out / (key + '.mp3')
    if index.get(key) == want and mp3.exists():
        continue
    voice = want['voice']
    lang = voice[0]   # a: American English, b: British English
    pipe = pipes.get(lang) or pipes.setdefault(lang, KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M'))
    audio = speak(pipe, want['text'], voice, guide['speed'], guide['pause']['comma'], guide['pause']['stop'])
    mp3.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        sf.write(wav.name, audio, RATE)
        # the same treatment as the guide's clips
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', str(mp3)], check=True)
    index[key] = want
    print(key, round(len(audio) / RATE, 1), 's', flush=True)
# clips of pages that are no longer in the stories are deleted
for f in out.glob('*/*.mp3'):
    if f.parent.name + '/' + f.stem not in lines:
        f.unlink()
index = {k: index[k] for k in lines if k in index}
index_path.write_text(json.dumps(index, indent=1, ensure_ascii=False) + '\n')
