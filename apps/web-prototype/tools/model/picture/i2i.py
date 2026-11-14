"""Redraw a small cut-out as a clean, detailed hero picture (sets with a reference picture):
  ~/.cache/chackmate/pv/bin/python tools/model/picture/i2i.py JOBS.tsv OUTDIR
JOBS.tsv, one picture a line:  name <TAB> cut-out png (RGBA) <TAB> strength <TAB> seed <TAB> prompt
Writes OUTDIR/name.png and OUTDIR/name.in.png (what the model was shown). Skips names already
there.

The cut-out is set on flat mid-grey, standing near the bottom of a 768 x 1024 frame, and
redrawn at the given strength: 0.45 keeps the design almost line for line and only sharpens,
0.6 is crisper and cleaner but starts to redesign (faces, hands, ornaments move). Make both,
and a second seed where a piece comes out wrong, then choose per piece: the sharpest one that
is still the same design. Say what the piece is in the prompt, material and colours included."""
import os
import sys
import time

import numpy as np
import torch
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sdxl  # noqa: E402

W, H = sdxl.W, sdxl.H


def prep(path):
    im = Image.open(path).convert('RGBA')
    a = np.asarray(im).astype(np.float32) / 255
    rgb = a[..., :3] * a[..., 3:] + 0.5 * (1 - a[..., 3:])
    h, w = rgb.shape[:2]
    s = min(0.86 * H / h, 0.86 * W / w)
    sm = Image.fromarray((rgb * 255).astype(np.uint8)).resize((max(1, int(w * s)), max(1, int(h * s))), Image.LANCZOS)
    c = Image.new('RGB', (W, H), (128, 128, 128))
    c.paste(sm, ((W - sm.width) // 2, int(H * 0.94) - sm.height))
    return c


jobs, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
p = sdxl.pipe('img')
for line in open(jobs):
    if not line.strip():
        continue
    name, src, st, seed, prompt = line.rstrip('\n').split('\t')
    if os.path.exists(f'{out}/{name}.png'):
        continue
    t = time.time()
    img = prep(src)
    img.save(f'{out}/{name}.in.png')
    g = torch.Generator().manual_seed(int(seed))
    with torch.inference_mode():
        r = p(prompt, image=img, strength=float(st), num_inference_steps=4, guidance_scale=0, generator=g).images[0]
    r.save(f'{out}/{name}.png')
    print(name, round(time.time() - t), 's', flush=True)
