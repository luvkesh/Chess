"""New design pictures from words (sets with no reference picture):
  ~/.cache/chackmate/pv/bin/python tools/model/picture/gen.py JOBS.tsv OUTDIR
JOBS.tsv, one picture a line:  name <TAB> seed <TAB> prompt
Writes OUTDIR/name.png (768 x 1024; W and H in the environment change that) and skips names
already there, so a stopped run picks up where it left off.

Prompts that work: the piece first ("chess king, ..."), then the material and colours, then
always the same tail for the whole set, e.g.
  ", round gold plinth, front view, centered, studio photo, plain grey background, highly detailed"
The same style words and the same seeds across a set keep its twelve pieces one family."""
import os
import sys
import time

import torch

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sdxl  # noqa: E402

jobs, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
p = sdxl.pipe('txt')
for line in open(jobs):
    if not line.strip():
        continue
    name, seed, prompt = line.rstrip('\n').split('\t')
    if os.path.exists(f'{out}/{name}.png'):
        continue
    t = time.time()
    g = torch.Generator().manual_seed(int(seed))
    with torch.inference_mode():
        im = p(prompt, num_inference_steps=4, guidance_scale=0, width=sdxl.W, height=sdxl.H, generator=g).images[0]
    im.save(f'{out}/{name}.png')
    print(name, round(time.time() - t), 's', flush=True)
