"""Records the coach's spoken website guide (guide.json) with Kokoro-82M, offline, into audio/.

    HF_HOME=... python3.12 apps/website/tools/record-guide.py [key,key,...]

With keys, only those lines are recorded again and the rest of audio/index.json is kept.

Needs the `kokoro` package, its weights and ffmpeg; see the setup in tools/voice/record.py. Each clip
is saved as audio/<key>.mp3, and audio/index.json keeps the exact words and when each sentence starts, so build.py can tell
when a line or the coach's name changed and the clip must be recorded again.
"""
import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

os.environ['HF_HUB_OFFLINE'] = '1'
import numpy as np
import soundfile as sf
from kokoro import KPipeline

here = pathlib.Path(__file__).parent.parent
guide = json.loads((here / 'guide.json').read_text())
coach = json.loads((here.parent.parent / 'packages' / 'content' / 'campaign.json').read_text())['coach']['name']
out = here / 'audio'
out.mkdir(exist_ok=True)
pipe = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')   # American English
only = set(sys.argv[1].split(',')) if len(sys.argv) > 1 else None
index = {'voice': guide['voice'], 'lines': {}}
if only:
    index['lines'] = json.loads((out / 'index.json').read_text())['lines']
# Words and sounds Kokoro gets wrong are respelled in tools/voice/say.py (the caption keeps the spelling),
# and the breaths after punctuation come from tools/voice/pauses.py, the same as in the game.
sys.path.insert(0, str(here.parent.parent / 'tools' / 'voice'))
from pauses import speak, RATE as SR


def hush(level, seconds=1.0):
    """A soft, breathy "shhh": unvoiced noise shaped like the sh sound (most of its energy around
    2.5 to 5 kHz), fading in and out, at `level` RMS so it sits well under the speaking voice.
    Any voiced "shoo" from Kokoro comes out too loud (user, 2026-11-06: a soft whisper, not a loud shoo)."""
    rng = np.random.default_rng(7)
    n = int(seconds * SR)
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    spec *= np.exp(-((np.log(np.maximum(f, 1) / 3400)) ** 2) / (2 * 0.38 ** 2))   # the sh band
    noise = np.fft.irfft(spec, n)
    t = np.arange(n) / SR
    env = np.minimum(1, t / 0.18) * np.minimum(1, (seconds - t) / 0.45) ** 1.6   # breath in, long fade
    env *= 1 + 0.08 * np.sin(2 * np.pi * 3.1 * t)                                  # a little unsteady, like breath
    out = noise * np.clip(env, 0, None)
    return (out * level / np.sqrt(np.mean(out[int(0.18 * SR):int(0.5 * SR)] ** 2))).astype(np.float32)


def spoken(text):
    """The line as audio, and the second each sentence starts (for the captions)."""
    if text.startswith('Shh, '):
        # the whispered hush, a short breath, then the rest of the line in Rooky's voice
        audio, starts = speak(pipe, text[5:], guide['voice'], guide['speed'], starts=True)
        lead = np.concatenate([hush(0.22 * float(np.sqrt(np.mean(audio ** 2)))), np.zeros(int(0.3 * SR), dtype=np.float32)])
        return np.concatenate([lead, audio.astype(np.float32)]), [0] + [s + len(lead) / SR for s in starts[1:]]
    return speak(pipe, text, guide['voice'], guide['speed'], starts=True)


def cues(text, starts):
    """One caption per sentence, shown a moment before it is spoken."""
    said = re.split(r'(?<=[.!?])\s+', text.strip())
    assert len(said) == len(starts), 'cannot line up the captions for: ' + text
    return [{'t': round(max(0, t - 0.1), 2) if i else 0, 'text': x} for i, (t, x) in enumerate(zip(starts, said))]


for key, line in guide['lines'].items():
    if only and key not in only:
        continue
    text = line.replace('{coach}', coach)
    audio, starts = spoken(text)
    with tempfile.NamedTemporaryFile(suffix='.wav') as wav:
        sf.write(wav.name, audio, SR)
        # the same treatment as the game's clips: even loudness, mono 24 kHz at 40 kb/s
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', wav.name, '-af', 'loudnorm=I=-18:TP=-2:LRA=7',
                        '-ar', '24000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '40k', str(out / (key + '.mp3'))], check=True)
    index['lines'][key] = {'text': text, 'cues': cues(text, starts)}
    print(key, round(len(audio) / SR, 1), 's', len(starts), 'sentences')
(out / 'index.json').write_text(json.dumps(index, indent=2, ensure_ascii=False) + '\n')
