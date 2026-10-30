"""Records the voice lines with Kokoro-82M (Apache-2.0), offline.

Needs Python 3.10-3.12 with `pip install kokoro==0.9.4 soundfile`, the spaCy model en_core_web_sm, and
the hexgrad/Kokoro-82M weights in the Hugging Face cache (HF_HOME). Then:
  node tools/voice/lines.js > /tmp/voice/jobs.json
  for k in 0 1 2 3; do OMP_NUM_THREADS=1 python tools/voice/record.py /tmp/voice/jobs.json /tmp/voice/wav $k 4 & done; wait
One single-threaded process per core is several times faster than one process using every core.
Lines already recorded are skipped, so a stopped run picks up where it left off.
An engine of 'a,b' (e.g. 'bf_emma,af_heart') records an even blend of the two Kokoro voices.
Then tools/voice/encode.js turns the WAV files into the voice packs the game ships.
"""
import json, os, sys
os.environ['HF_HUB_OFFLINE'] = '1'
import numpy as np
import soundfile as sf
from kokoro import KPipeline

SR = 24000
# Kokoro reads straight through commas and full stops, so the pauses are put in by hand: each line is
# spoken whole (for a natural tone), then cut at the punctuation's timestamps and silence added there.
PAUSE = {',': 0.3, ';': 0.35, ':': 0.35, '—': 0.35, '.': 0.4, '!': 0.4, '?': 0.4, '।': 0.4}


def quietest(audio, at, reach=0.06):
    """The quietest 10 ms near `at` seconds, so a cut never clips a word."""
    lo, hi = max(0, int((at - reach) * SR)), min(len(audio), int((at + reach) * SR))
    step = SR // 100
    frames = [(float(np.sqrt(np.mean(audio[i:i + step] ** 2))), i + step // 2) for i in range(lo, max(lo + 1, hi - step), step // 4)]
    return min(frames)[1] if frames else int(at * SR)


def spoken(pipe, j):
    parts = []
    for r in pipe(j['spoken'], voice=j['engine'], speed=j['speed'], split_pattern=r'\n+'):
        audio, start = np.asarray(r.audio), 0
        stops = [(t.end_ts, PAUSE[t.text]) for t in (r.tokens or []) if t.text in PAUSE and t.end_ts is not None]
        if stops and stops[-1][0] >= len(audio) / SR - 0.3:
            stops = stops[:-1]   # the line's own last full stop needs no pause after it
        for at, gap in stops:
            cut = quietest(audio, at)
            parts += [audio[start:cut], np.zeros(int(gap * SR), dtype=audio.dtype)]
            start = cut
        parts += [audio[start:], np.zeros(int(PAUSE['.'] * SR), dtype=audio.dtype)]   # between Kokoro's chunks too
    return np.concatenate(parts[:-1]) if parts else None


jobs = json.load(open(sys.argv[1]))
out = sys.argv[2]
shard = int(sys.argv[3]) if len(sys.argv) > 3 else 0
shards = int(sys.argv[4]) if len(sys.argv) > 4 else 1
pipes = {}
done = 0
for i, j in enumerate(jobs):
    if i % shards != shard:
        continue
    path = os.path.join(out, j['voice'], j['key'] + '.wav')
    if os.path.exists(path):
        continue
    lang = j['engine'][0]  # a: American English, b: British English, h: Hindi
    if lang not in pipes:
        pipes[lang] = KPipeline(lang_code=lang, repo_id='hexgrad/Kokoro-82M')
    audio = spoken(pipes[lang], j)
    if audio is None:
        print('empty', j['voice'], j['key'], j['text'], flush=True)
        continue
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path + '.tmp.wav', audio, SR)
    os.replace(path + '.tmp.wav', path)
    done += 1
    if done % 25 == 0:
        print(shard, done, flush=True)
print('shard', shard, 'finished', done, flush=True)
