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

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pauses import speak, RATE as SR   # breaths after punctuation, eased into a soft room tone
from say import pipeline, KOKORO


def spoken(pipe, j):
    audio = speak(pipe, j['spoken'], j['engine'], j['speed'])
    return audio if len(audio) else None


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
    # the line's language decides how it is read (a voice can read another language: French Rooky
    # is a Spanish voice); English goes by the voice's accent, a: American, b: British
    lang = KOKORO.get(j.get('lang'), j['engine'][0])
    if lang not in pipes:
        pipes[lang] = pipeline(lang)
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
