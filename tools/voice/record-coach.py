"""Records the coach library with Kokoro-82M, offline, and packs it for the game.

    python3.12 tools/voice/record-coach.py [cache-dir]

The lines come from `node tools/voice/lines.js coach`: every fixed piece a coach or mentor line is cut
into, the names and numbers that fill them, and the move words. They are recorded in Rooky's voice
(his guide.json engine and speed) and in every voice.json voice marked "coach": true, so a player can
pick who speaks. The game says a line by playing its pieces back to back, so nothing is ever made up
by a speech engine on the device.

Each piece is kept as an MP3 in the cache (default /tmp/coach-voice/<voice>/) and the packs are
written to apps/web-prototype/public/coach/: <voice>.mp3 (every clip back to back, like the voice
packs) and index.json (the keys, and each voice's clip sizes). tools/voice/coach-recorded.json keeps
the words and voice of every clip, so test/voice.test.js can tell when a piece changed and must be
recorded again; pieces whose clip is up to date are skipped.

Two ways to run Kokoro: the `kokoro` package (see record.py), or, where its weights can't be fetched,
kokoro-onnx with misaki: set KOKORO_ONNX to a folder holding kokoro-v1.0.onnx and voices-v1.0.bin.
"""
import atexit
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from pauses import RATE, trim, FADE

root = pathlib.Path(__file__).parent.parent.parent
guide = json.loads((root / 'packages' / 'content' / 'guide.json').read_text())
V = json.loads((root / 'packages' / 'content' / 'voice.json').read_text())
# (id, name, Kokoro voice, speed): Rooky first, then the extra coach voices
VOICES = [('rooky', 'Rooky', guide['speakers']['rooky']['engine'], guide['speed'])] + [(v['id'], v['name'], v['engine'], v.get('speed', 1)) for v in V['voices'] if v.get('coach')]
comma, stop = guide['pause']['comma'], guide['pause']['stop']
lines = json.loads(subprocess.run(['node', str(root / 'tools' / 'voice' / 'lines.js'), 'coach'], check=True, capture_output=True).stdout)
cache = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/coach-voice')
out = root / 'apps' / 'web-prototype' / 'public' / 'coach'
record_path = root / 'tools' / 'voice' / 'coach-recorded.json'
recorded = json.loads(record_path.read_text()) if record_path.exists() else {}

engine = None
voice, speed = None, 1

# How Kokoro should say names its dictionary doesn't know (misaki's [word](/phonemes/) form): the
# openings, the old game, and the letters of the board's files.
SAY = {
    'ay': 'ˈA', 'ee': 'ˈi', 'jee': 'ʤˈi', 'Alapin': 'ˈæləpɪn', "Alekhine's": 'ˈæləkˌinz', 'Blackburne': 'blˈækbɜɹn',
    'Caro-Kann': 'kˈɑɹO kˈɑn', 'Colle': 'kˈɔli', 'Englund': 'ˈɛŋɡlənd', 'Evans': 'ˈɛvənz', 'Giuoco': 'ʤˈwOkO',
    'Grünfeld': 'ɡɹˈunfɛld', "Larsen's": 'lˈɑɹsənz', 'Lopez': 'lˈOpɛz', 'Middlegame': 'mˈɪdᵊlɡˌAm', 'Morphy': 'mˈɔɹfi',
    'Najdorf': 'nˈIdɔɹf', 'Nimzo-Indian': 'nˈɪmzO ˈɪndiən', 'Nimzowitsch': 'nˈɪmzOvɪʧ', 'Oops': 'ˈups', "Petrov's": 'pˈɛtɹɔfs',
    'Philidor': 'fˈɪlɪdɔɹ', 'Pirc': 'pˈɪɹts', 'Ponziani': 'pˌɔnziˈɑni', 'Ruy': 'ɹˈuˌi', 'Réti': 'ɹˈAti', 'Smith-Morra': 'smˈɪθ mˈɔɹə',
    'Trompowsky': 'tɹɑmpˈɔfski', 'Winawer': 'vˈɪnəvəɹ', 'Zwischenzug': 'tsvˈɪʃəntsˌuk', 'chaturanga': 'ʧˌʌtʊɹˈʌŋɡə',
}


def respell(text):
    import re
    return re.sub(r"[A-Za-züé][A-Za-züé'\-]*", lambda m: '[%s](/%s/)' % (m[0], SAY[m[0]]) if m[0] in SAY else m[0], text)


def say(text):
    """24 kHz float audio of `text`, with a breath after each comma and full stop."""
    global engine
    onnx = os.environ.get('KOKORO_ONNX')
    if onnx:
        from misaki import en
        if engine is None:
            from kokoro_onnx import Kokoro
            engine = (Kokoro(os.path.join(onnx, 'kokoro-v1.0.onnx'), os.path.join(onnx, 'voices-v1.0.bin')), {})
        k, g2ps = engine
        names = voice.split(',')
        style = sum(k.get_voice_style(n) for n in names) / len(names)   # a blend is the mean of its voices
        british = voice[0] == 'b'
        g2p = g2ps.get(british) or g2ps.setdefault(british, en.G2P(trf=False, british=british, fallback=None))
        # kokoro-onnx gives no word timings, so the line is said phrase by phrase and the pauses laid between
        import re
        parts = [p.strip() for p in re.findall(r'[^,;:.!?]+[,;:.!?]*', text) if p.strip()]
        audio = []
        for i, p in enumerate(parts):
            ph, _ = g2p(respell(p))
            if '❓' in ph:
                sys.exit('Kokoro does not know a word in "%s" (%s): add it to SAY' % (p, ph))
            a, sr = k.create(ph, voice=style, speed=speed, lang='en-gb' if british else 'en-us', is_phonemes=True)
            a = trim(np.asarray(a, dtype=np.float32)).copy()
            if len(a) > 2 * FADE:
                a[:FADE] *= np.linspace(0, 1, FADE)
                a[-FADE:] *= np.linspace(1, 0, FADE)
            audio.append(a)
            if i < len(parts) - 1:
                audio.append(np.zeros(int((stop if p[-1] in '.!?' else comma) * RATE), dtype=np.float32))
        return np.concatenate(audio) if audio else np.zeros(0, dtype=np.float32)
    if engine is None:
        os.environ['HF_HUB_OFFLINE'] = '1'
        engine = {}
    from kokoro import KPipeline
    from pauses import speak
    pipe = engine.get(voice[0]) or engine.setdefault(voice[0], KPipeline(lang_code=voice[0], repo_id='hexgrad/Kokoro-82M'))
    return speak(pipe, respell(text), voice, speed, comma, stop)


made = 0
names = {vid for vid, _, _, _ in VOICES}


@atexit.register
def save():
    # kept even when a run stops part way, so the clips already made are not recorded again
    record_path.write_text(json.dumps({k: recorded[k] for k in sorted(recorded) if k.split('/')[0] in names and k.split('/')[1] in keys}, indent=1, ensure_ascii=False) + '\n')


keys = [l['key'] for l in lines]
index = {'engine': 'Kokoro-82M (Apache-2.0)', 'keys': keys, 'voices': {}}
out.mkdir(parents=True, exist_ok=True)
for vid, vname, voice, speed in VOICES:
    for line in lines:
        mp3 = cache / vid / (line['key'] + '.mp3')
        want = {'voice': voice, 'speed': speed, 'text': line['text'], 'spoken': line['spoken']}
        if recorded.get(vid + '/' + line['key']) == want and mp3.exists():
            continue
        audio = say(line['spoken'])
        mp3.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
            sf.write(wav.name, audio, RATE)
            # leading silence trimmed, even loudness, mono 24 kHz at 40 kb/s, no tags: the clips join into one file
            subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', wav.name, '-af', 'silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-18:TP=-2:LRA=7',
                            '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', '-map_metadata', '-1', '-write_xing', '0', '-id3v2_version', '0', str(mp3)], check=True, timeout=60)
        recorded[vid + '/' + line['key']] = want
        made += 1
        print(vid, line['key'], round(len(audio) / RATE, 2), 's', line['spoken'], flush=True)
    missing = [k for k in keys if not (cache / vid / (k + '.mp3')).exists()]
    if missing:
        sys.exit('%s: %d pieces not recorded' % (vid, len(missing)))
    clips = [(cache / vid / (k + '.mp3')).read_bytes() for k in keys]
    pack = b''.join(clips)
    (out / (vid + '.mp3')).write_bytes(pack)
    index['voices'][vid] = {'name': vname, 'v': hashlib.sha1(pack).hexdigest()[:10], 'sizes': [len(c) for c in clips]}
    print(vid, len(keys), 'pieces,', round(len(pack) / 1e6, 2), 'MB', flush=True)
# packs of voices no longer recorded are deleted
for f in out.glob('*.mp3'):
    if f.stem not in index['voices']:
        f.unlink()
(out / 'index.json').write_text(json.dumps(index) + '\n')
print('recorded', made, 'new pieces;', len(VOICES), 'voices')
