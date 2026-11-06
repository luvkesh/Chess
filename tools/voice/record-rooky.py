"""Records everything Rooky says in every English coach voice, so the voice a player picks says it all.

    HF_HOME=... python3.12 tools/voice/record-rooky.py [shard shards] [voice id ...]

Rooky's own clips (guide/, pitch/, words/rooky/) are recorded in his voice, Toby. The player can pick
another coach voice in Settings (packages/content/voice.json), and that voice should then say Rooky's
corner lines, his word on each Collection item and his lesson words too (user, 2026-11-06). Each line is
saved as apps/web-prototype/public/rooky/<voice id>/<key>.mp3, where <key> is the line's voiceKey (the
same hash audio.js uses), and rooky/index.json keeps the words of every key and the engine of every
voice, so test/rooky.test.js can tell when a line changed and must be recorded again.

The era friends' guide lines stay in their own voices: only Rooky's lines are here. Run one process per
core (shard 0..shards-1). Lines already recorded with the same words and engine are skipped.
"""
import json
import os
import pathlib
import subprocess
import sys
import tempfile
import unicodedata

os.environ['HF_HUB_OFFLINE'] = '1'
import soundfile as sf
from kokoro import KPipeline

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from pauses import speak, RATE

root = pathlib.Path(__file__).parent.parent.parent
content = root / 'packages' / 'content'
pub = root / 'apps' / 'web-prototype' / 'public'
out = pub / 'rooky'


def voice_key(text):
    """audio.js voiceKey(): FNV-1a over each character's low, middle and high bytes."""
    h = 0x811c9dc5
    for ch in unicodedata.normalize('NFC', str(text)):
        c = ord(ch)
        for part in ([c & 0xff] + ([(c >> 8) & 0xff] if c > 0xff else []) + ([(c >> 16) & 0xff] if c > 0xffff else [])):
            h = ((h ^ part) * 0x01000193) & 0xffffffff
    return '%08x' % h


def rooky_lines():
    guide = json.loads((content / 'guide.json').read_text())
    pitches = json.loads((content / 'pitches.json').read_text())
    words = json.loads((pub / 'words' / 'index.json').read_text())
    texts = [l['text'] for l in guide['lines'].values() if l['who'] == 'rooky']
    texts += [v for v in pitches['lines'].values() if isinstance(v, str)]
    texts += [v['text'] for k, v in words.items() if k.startswith('rooky/')]
    return {voice_key(t): t for t in texts}


def voices(rooky_engine):
    vs = json.loads((content / 'voice.json').read_text())['voices']
    return {v['id']: {'engine': v['engine'], 'speed': v.get('speed', 1.0)} for v in vs
            if v['lang'] == 'en' and v['engine'] != rooky_engine}


def main():
    args = sys.argv[1:]
    shard, shards = (int(args[0]), int(args[1])) if len(args) >= 2 and args[0].isdigit() else (0, 1)
    only = set(a for a in args if not a.isdigit())
    guide = json.loads((content / 'guide.json').read_text())
    pause = guide['pause']
    lines = rooky_lines()
    vs = voices(guide['speakers']['rooky']['engine'])
    jobs = [(vid, key) for vid in sorted(vs) if not only or vid in only for key in sorted(lines)]
    index_path = out / 'index.json'
    index = json.loads(index_path.read_text()) if index_path.exists() else {'voices': {}, 'lines': {}}
    pipes = {}
    for n, (vid, key) in enumerate(jobs):
        if n % shards != shard:
            continue
        v = vs[vid]
        dest = out / vid / (key + '.mp3')
        if dest.exists() and index['voices'].get(vid, v['engine']) == v['engine'] and index['lines'].get(key, lines[key]) == lines[key]:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        lang = v['engine'][0]   # a: American English, b: British English
        pipe = pipes.get(lang) or pipes.setdefault(lang, KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M'))
        audio = speak(pipe, lines[key], v['engine'], v['speed'] * guide['speed'], pause['comma'], pause['stop'])
        with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
            sf.write(wav.name, audio, RATE)
            # as the guide's clips, at 32 kb/s: there are forty voices of them
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                            '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '32k', '-map_metadata', '-1', str(dest)], check=True)
        print(vid, key, round(len(audio) / RATE, 1), 's', flush=True)
    if shard == 0:
        # the index is written by shard 0 once every shard has finished (run it again with no shards)
        if shards == 1:
            index = {'voices': {vid: vs[vid]['engine'] for vid in sorted(vs)}, 'lines': dict(sorted(lines.items()))}
            index_path.write_text(json.dumps(index, ensure_ascii=False, indent=1) + '\n')
            keep = {(vid, key) for vid in vs for key in lines}
            for f in out.glob('*/*.mp3'):
                if (f.parent.name, f.stem) not in keep:
                    f.unlink()


main()
