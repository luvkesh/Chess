"""Records the coach's spoken website guide (guide.json) with Kokoro-82M, offline, into audio/.

    HF_HOME=... python3.12 apps/website/tools/record-guide.py

Needs the `kokoro` package, its weights and ffmpeg; see the setup in tools/voice/record.py. Each clip
is saved as audio/<key>.mp3, and audio/index.json keeps the exact words and when each sentence starts, so build.py can tell
when a line or the coach's name changed and the clip must be recorded again.
"""
import json
import os
import pathlib
import re
import subprocess
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
index = {'voice': guide['voice'], 'lines': {}}
# Kokoro reads straight through commas and full stops, so the pauses are put in by hand: each line is
# spoken whole (for natural tone), then cut at the punctuation's timestamps and silence added there.
PAUSE = {',': 0.3, ';': 0.35, ':': 0.35, '—': 0.35, '.': 0.4, '!': 0.4, '?': 0.4}
SR = 24000


def quietest(audio, at, reach=0.06):
    """The quietest 10 ms near `at` seconds, so a cut never clips a word."""
    lo, hi = max(0, int((at - reach) * SR)), min(len(audio), int((at + reach) * SR))
    step = SR // 100
    frames = [(float(np.sqrt(np.mean(audio[i:i + step] ** 2))), i + step // 2) for i in range(lo, max(lo + 1, hi - step), step // 4)]
    return min(frames)[1] if frames else int(at * SR)


def spoken(text):
    """The line as audio, and the second each sentence starts (for the captions)."""
    parts, starts, n = [], [0], 0
    for r in pipe(text, voice=guide['voice'], speed=guide['speed']):
        audio, start = np.asarray(r.audio), 0
        stops = [(t.end_ts, PAUSE[t.text], t.text in '.!?') for t in r.tokens if t.text in PAUSE and t.end_ts is not None]
        trailing = bool(stops) and stops[-1][0] >= len(audio) / SR - 0.3
        for at, gap, end in stops[:-1] if trailing else stops:
            cut = quietest(audio, at)
            parts += [audio[start:cut], np.zeros(int(gap * SR), dtype=audio.dtype)]
            n += cut - start + int(gap * SR)
            start = cut
            if end:
                starts.append(n)
        gap = int(PAUSE['.'] * SR)   # between Kokoro's chunks too
        parts += [audio[start:], np.zeros(gap, dtype=audio.dtype)]
        n += len(audio) - start + gap
        if trailing and stops[-1][2]:
            starts.append(n)
    audio = np.concatenate(parts[:-1])
    if len(starts) > 1 and starts[-1] >= len(audio):
        starts.pop()
    # trim the silence before the first word here rather than in ffmpeg, so the times stay true
    lead = int(np.argmax(np.abs(audio) > 10 ** (-50 / 20)))
    return audio[lead:], [max(0, s - lead) / SR for s in starts]


def cues(text, starts):
    """One caption per sentence, shown a moment before it is spoken."""
    said = re.split(r'(?<=[.!?])\s+', text.strip())
    assert len(said) == len(starts), 'cannot line up the captions for: ' + text
    return [{'t': round(max(0, t - 0.1), 2) if i else 0, 'text': x} for i, (t, x) in enumerate(zip(starts, said))]


for key, line in guide['lines'].items():
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
