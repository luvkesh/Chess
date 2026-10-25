"""Records the voice lines with Kokoro-82M (Apache-2.0), offline.

Run inside an image that has the `kokoro` package and the hexgrad/Kokoro-82M weights cached, e.g.
  node tools/voice/lines.js > /tmp/voice/jobs.json
  docker run --rm --network none -v /tmp/voice:/work zacksock/kokoro python /work/record.py /work/jobs.json /work/wav [shard] [shards]
Then tools/voice/encode.sh turns the WAV files into the MP3s the game ships.
"""
import json, os, sys
os.environ['HF_HUB_OFFLINE'] = '1'
import numpy as np
import soundfile as sf
from kokoro import KPipeline

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
    chunks = [np.asarray(r.audio) for r in pipes[lang](j['spoken'], voice=j['engine'], speed=j['speed'], split_pattern=r'\n+')]
    if not chunks:
        print('empty', j['voice'], j['key'], j['text'], flush=True)
        continue
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sf.write(path + '.tmp.wav', np.concatenate(chunks), 24000)
    os.replace(path + '.tmp.wav', path)
    done += 1
    if done % 25 == 0:
        print(shard, done, flush=True)
print('shard', shard, 'finished', done, flush=True)
