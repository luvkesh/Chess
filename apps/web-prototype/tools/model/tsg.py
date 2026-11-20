"""True 3D from one picture, with the TripoSG weights: a picture of a piece in, its solid shape
out (a signed volume, > 0 inside), for sculpt.py to turn into the piece's mesh.

What is whose:
  * the weights are VAST-AI-Research's (huggingface.co/VAST-AI/TripoSG, MIT licence);
  * the image encoder is DINOv2 (Apache-2.0), run through the transformers library;
  * the runner below is our own: plain PyTorch layers laid out to fit the weights.
VAST's published code is NOT used or copied here. Two parts of it carry Tencent licences that
do not cover the EU, the UK or South Korea (its transformer file is adapted from HunyuanDiT, its
"flash" decoder from FlashVDM), so nothing of theirs is imported or run, and setup.sh fetches
the weight files only.

Two halves, because Blender's Python has no torch and the picture venv has no Blender:
  * in Blender's Python (build.py): volume(crop, mask) returns the cached volume of a cut-out,
    or queues the picture (CACHE/todo/<key>.png) and raises Missing;
  * in the picture venv:  ~/.cache/chackmate/pv/bin/python tools/model/tsg.py
    works through the queue, about 4 minutes a piece on 4 CPU cores.

Frame of a volume: axes (depth, up, across) like tsr.volume: across = the picture's x to the
right, up = the picture's up, depth = towards the viewer, in units where the picture's padded
square is 2 wide; `box` gives each axis' extent.
"""
import hashlib
import math
import os
import sys
import time

import numpy as np

DIR = os.environ.get('TRIPOSG_DIR', os.path.expanduser('~/.cache/chackmate/triposg'))
CACHE = os.environ.get('TRIPOSG_CACHE', os.path.expanduser('~/.cache/chackmate-tsg'))
PAD = 0.1          # backdrop round the figure, as a share of its larger side (what the model was trained on)
SIDE = 518         # the square handed to the image encoder's own resize
STEPS = int(os.environ.get('TRIPOSG_STEPS', '36'))
GUIDE = float(os.environ.get('TRIPOSG_GUIDE', '7'))
SEED = int(os.environ.get('TRIPOSG_SEED', '42'))
BOUND = 1.005      # the model's cube is [-BOUND, BOUND]^3
FINE = 384         # cells across the cube at the finest level (the volume holds the figure's box only)
VERSION = 2


class Missing(Exception):
    """the volume of a picture is not made yet; it is queued for tsg.py"""


# ------------------------------------------------------------------ the Blender half (numpy, cv2)
def square(crop, mask):
    """the white-backed square the model wants (BGR uint8, SIDE px) and how the cut-out sits in
    it: (cx, cy, side) in crop pixels. Made from the cut-out's own box by whole-pixel copies
    and one resize, so the same cut-out gives the same square (and so the same cache key)
    wherever it sits in its picture."""
    import cv2
    ys, xs = np.nonzero(mask > 127)
    e = 3   # room for the soft edge
    y0, y1 = max(0, ys.min() - e), min(mask.shape[0], ys.max() + 1 + e)
    x0, x1 = max(0, xs.min() - e), min(mask.shape[1], xs.max() + 1 + e)
    h, w = y1 - y0, x1 - x0
    side = int(round((max(h, w) - 2 * e) * (1 + 2 * PAD)))
    a = cv2.GaussianBlur((mask[y0:y1, x0:x1] > 127).astype(np.float32), (0, 0), 0.6)[..., None]
    rgb = crop[y0:y1, x0:x1].astype(np.float32) * a + 255 * (1 - a)
    canvas = np.full((side, side, 3), 255, np.uint8)
    oy, ox = (side - h) // 2, (side - w) // 2
    canvas[oy:oy + h, ox:ox + w] = np.clip(rgb + 0.5, 0, 255).astype(np.uint8)
    img = cv2.resize(canvas, (SIDE, SIDE), interpolation=cv2.INTER_AREA if side > SIDE else cv2.INTER_LANCZOS4)
    return img, (x0 - ox + side / 2, y0 - oy + side / 2, side)


def key(img):
    tag = 'v%d-%d-%g-%d-%d' % (VERSION, STEPS, GUIDE, SEED, FINE)
    return hashlib.sha1(img.tobytes() + tag.encode()).hexdigest()[:20]


def volume(crop, mask):
    """(v, box, place) for a cut-out: v = float32 volume (> 0 inside) with axes (depth, up,
    across), box = ((d0, d1), (u0, u1), (a0, a1)) in the model's units, place = (cx, cy, side)
    of the model's input square in crop pixels. The model sets the figure in its own cube, so
    where the volume sits in the picture is for the caller to fit (sculpt.py does).
    Raises Missing when the volume has not been made yet."""
    import cv2
    img, place = square(crop, mask)
    k = key(img)
    path = os.path.join(CACHE, k + '.npz')
    if not os.path.exists(path):
        os.makedirs(os.path.join(CACHE, 'todo'), exist_ok=True)
        cv2.imwrite(os.path.join(CACHE, 'todo', k + '.png'), img)
        raise Missing(k)
    z = np.load(path)
    return z['v'].astype(np.float32), tuple(map(tuple, z['box'])), place


# ------------------------------------------------------------------ the torch half
def _layers():
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class Norm(nn.LayerNorm):
        """layer norm worked in float32 whatever the precision of the layers round it"""
        def forward(self, x):
            return F.layer_norm(x.float(), self.normalized_shape, self.weight.float(), self.bias.float(), self.eps).to(x.dtype)

    class Rms(nn.Module):
        def __init__(self, d):
            super().__init__()
            self.weight = nn.Parameter(torch.ones(d))

        def forward(self, x):
            f = x.float()
            return (f * torch.rsqrt(f.pow(2).mean(-1, keepdim=True) + 1e-6) * self.weight.float()).to(x.dtype)

    class Attn(nn.Module):
        """attention whose q, k and v rows are stored head by head: the three projections are
        laid end to end and cut per head, so a head's q, k and v sit next to each other"""
        def __init__(self, dim, heads, ctx=None, qk=False, norm_ctx=False):
            super().__init__()
            self.h, self.cross = heads, ctx is not None
            self.to_q = nn.Linear(dim, dim, bias=False)
            self.to_k = nn.Linear(ctx or dim, dim, bias=False)
            self.to_v = nn.Linear(ctx or dim, dim, bias=False)
            self.to_out = nn.ModuleList([nn.Linear(dim, dim)])
            self.norm_q = Rms(dim // heads) if qk else None
            self.norm_k = Rms(dim // heads) if qk else None
            self.norm_cross = Norm(ctx) if norm_ctx else None

        def keys(self, ctx):
            """keys and values of a context, to be used for any number of queries"""
            B, M, _ = ctx.shape
            if self.norm_cross is not None:
                ctx = self.norm_cross(ctx)
            hd = self.to_k.out_features // self.h
            k, v = torch.cat((self.to_k(ctx), self.to_v(ctx)), -1).view(B, M, self.h, 2 * hd).split(hd, -1)
            k, v = k.transpose(1, 2), v.transpose(1, 2)
            return (self.norm_k(k) if self.norm_k is not None else k), v

        def forward(self, x, ctx=None, kv=None):
            B, N, D = x.shape
            hd = D // self.h
            if self.cross:
                k, v = kv if kv is not None else self.keys(ctx)
                q = self.to_q(x).view(B, N, self.h, hd).transpose(1, 2)
            else:
                q, k, v = (t.transpose(1, 2) for t in
                           torch.cat((self.to_q(x), self.to_k(x), self.to_v(x)), -1).view(B, N, self.h, 3 * hd).split(hd, -1))
                if self.norm_k is not None:
                    k = self.norm_k(k)
            if self.norm_q is not None:
                q = self.norm_q(q)
            o = F.scaled_dot_product_attention(q, k, v)
            return self.to_out[0](o.transpose(1, 2).reshape(B, N, D))

    class Feed(nn.Module):
        def __init__(self, dim):
            super().__init__()
            first = nn.Module()
            first.proj = nn.Linear(dim, 4 * dim)
            self.net = nn.ModuleList([first, nn.Identity(), nn.Linear(4 * dim, dim)])

        def forward(self, x):
            return self.net[2](F.gelu(self.net[0].proj(x)))

    class Block(nn.Module):
        def __init__(self, dim, heads, own=True, ctx=None, qk=False, norm_ctx=False, skip=False):
            super().__init__()
            if own:
                self.norm1, self.attn1 = Norm(dim), Attn(dim, heads, qk=qk)
            if ctx:
                self.norm2, self.attn2 = Norm(dim), Attn(dim, heads, ctx=ctx, qk=qk, norm_ctx=norm_ctx)
            self.norm3, self.ff = Norm(dim), Feed(dim)
            if skip:
                self.skip_linear, self.skip_norm = nn.Linear(2 * dim, dim), Norm(dim)
            self.own, self.ctx = own, bool(ctx)

        def forward(self, x, ctx=None, skip=None, kv=None):
            if skip is not None:
                x = self.skip_norm(self.skip_linear(torch.cat((skip, x), -1)))
            if self.own:
                x = x + self.attn1(self.norm1(x))
            if self.ctx:
                x = x + self.attn2(self.norm2(x), ctx, kv)
            return x + self.ff(self.norm3(x))

    class Flow(nn.Module):
        """the shape model: noise tokens + the picture's features -> which way the tokens move.
        The time rides along as one extra token; the first half of the blocks hand their
        outputs to the second half, last to first."""
        def __init__(self, width=2048, heads=16, layers=21, chans=64, ctx=1024):
            super().__init__()
            t = nn.Module()
            t.linear_1, t.linear_2 = nn.Linear(width, 4 * width), nn.Linear(4 * width, width)
            self.time_proj = t
            self.proj_in = nn.Linear(chans, width)
            self.blocks = nn.ModuleList([Block(width, heads, ctx=ctx, qk=True, skip=i > layers // 2) for i in range(layers)])
            self.norm_out, self.proj_out = Norm(width), nn.Linear(width, chans)
            self.mid, self.width = layers // 2, width

        def forward(self, x, t, ctx):
            n = x.shape[1]
            half = self.width // 2
            f = torch.exp(-math.log(10000.0) * torch.arange(half, dtype=torch.float32) / half)
            a = t.float()[:, None] * f[None]
            e = torch.cat((a.sin(), a.cos()), -1).to(x.dtype)
            e = self.time_proj.linear_2(F.gelu(self.time_proj.linear_1(e)))
            x = torch.cat((e[:, None], self.proj_in(x)), 1)
            kept = []
            for i, b in enumerate(self.blocks):
                x = b(x, ctx, kept.pop() if i > self.mid else None)
                if i < self.mid:
                    kept.append(x)
            return self.proj_out(self.norm_out(x)[:, -n:])

    class Field(nn.Module):
        """the decoder: shape tokens -> a value at any point in space (> 0 inside)"""
        def __init__(self, dim=1024, heads=8, layers=16, chans=64, freqs=8):
            super().__init__()
            d = nn.Module()
            d.blocks = nn.ModuleList([Block(dim, heads) for _ in range(layers)] + [Block(dim, heads, own=False, ctx=dim, norm_ctx=True)])
            d.proj_query, d.norm_out, d.proj_out = nn.Linear(3 + 6 * freqs, dim), Norm(dim), nn.Linear(dim, 1)
            self.decoder, self.post_quant = d, nn.Linear(chans, dim)
            self.register_buffer('freqs', 2.0 ** torch.arange(freqs, dtype=torch.float32), persistent=False)

        def tokens(self, z):
            x = self.post_quant(z)
            for b in self.decoder.blocks[:-1]:
                x = b(x)
            return self.decoder.blocks[-1].attn2.keys(x)

        def forward(self, pts, kv):
            """pts (n, 3) float32 in the model's cube -> (n,) float32"""
            d = self.decoder
            e = (pts[..., None] * self.freqs).reshape(pts.shape[0], -1)
            q = torch.cat((pts, e.sin(), e.cos()), -1).to(kv[0].dtype)[None]
            x = d.blocks[-1](d.proj_query(q), kv=kv)
            return d.proj_out(d.norm_out(x))[0, :, 0].float()

    return Flow, Field


_M = {}


def _models():
    """(flow, field, encoder, processor, dtype), loaded once"""
    if _M:
        return _M['all']
    import torch
    from safetensors import safe_open
    from transformers import BitImageProcessor, Dinov2Model
    torch.set_grad_enabled(False)
    Flow, Field = _layers()
    # bfloat16 is about 4x faster than float32 on CPUs with AMX or AVX512-BF16; float32 elsewhere
    try:
        flags = open('/proc/cpuinfo').read()
    except OSError:
        flags = ''
    dt = torch.bfloat16 if ('amx_bf16' in flags or 'avx512_bf16' in flags) and os.environ.get('TRIPOSG_F32') != '1' else torch.float32

    def load(net, path, only=None):
        want = dict(net.named_parameters())
        with safe_open(path, 'pt') as f:
            have = set(f.keys())
            lost = [k for k in want if k not in have]
            assert not lost, 'weights missing for %s' % lost[:5]
            extra = [k for k in have if k not in want and not (only and not k.startswith(only))]
            assert not extra, 'weights unused: %s' % extra[:5]
            for k, p in want.items():
                w = f.get_tensor(k)
                assert w.shape == p.shape, (k, w.shape, p.shape)
                p.data = w.to(dt)
        return net.eval()

    t0 = time.time()
    flow = load(Flow(), os.path.join(DIR, 'transformer', 'diffusion_pytorch_model.safetensors'))
    field = load(Field(), os.path.join(DIR, 'vae', 'diffusion_pytorch_model.safetensors'), only=('decoder.', 'post_quant.'))
    enc = Dinov2Model.from_pretrained(os.path.join(DIR, 'image_encoder_dinov2')).eval()
    proc = BitImageProcessor.from_pretrained(os.path.join(DIR, 'feature_extractor_dinov2'))
    print('models loaded in %.0fs (%s)' % (time.time() - t0, str(dt).split('.')[-1]), flush=True)
    _M['all'] = (flow, field, enc, proc, dt)
    return _M['all']


def tokens(img, steps=STEPS, guide=GUIDE, seed=SEED, log=True):
    """the shape tokens of a picture (PIL RGB, the figure on white with PAD round it)"""
    import torch
    flow, field, enc, proc, dt = _models()
    cond = enc(proc(img, return_tensors='pt').pixel_values).last_hidden_state.to(dt)
    ctx = torch.cat((torch.zeros_like(cond), cond))
    x = torch.randn((1, 2048, 64), generator=torch.Generator().manual_seed(seed))
    sig = [1 - i / steps for i in range(steps)] + [0.0]
    t0 = time.time()
    for i in range(steps):
        v = flow(torch.cat((x, x)).to(dt), torch.full((2,), sig[i] * 1000.0), ctx).float()
        v = v[:1] + guide * (v[1:] - v[:1])
        x = x + (sig[i] - sig[i + 1]) * v
        if log and (i % 6 == 5 or i == steps - 1):
            print('  step %d/%d  %.0fs' % (i + 1, steps, time.time() - t0), flush=True)
    return x.to(dt)


def grid(z, fine=FINE, log=True):
    """the volume of shape tokens z: values (> 0 inside) on a grid over the figure's own box,
    at fine cells across the model's cube. The values behave like a clipped distance: about
    90 per unit next to the surface, flat at -12 from about 0.08 outside. Coarse to fine: the
    whole cube at fine/4; at fine/2 wherever the coarse values say a surface is near (so an
    antler thinner than a coarse cell is not lost); at fine only next to the surface.
    Returns (v, box): v's axes are the model's (x, y, z), box = ((x0, x1), (y0, y1), (z0, z1))."""
    import torch
    import torch.nn.functional as F
    flow, field, enc, proc, dt = _models()
    kv = field.tokens(z)

    def ask(pts):
        out = torch.empty(len(pts))
        for i in range(0, len(pts), 12000):
            out[i:i + 12000] = field(pts[i:i + 12000], kv)
        return out

    def spread(g, n):
        return F.interpolate(g[None, None], size=(n, n, n), mode='trilinear', align_corners=True)[0, 0]

    def near(g, k):
        """cells with both inside and outside within k cells"""
        o = (g > 0).float()[None, None]
        return (F.max_pool3d(o, 2 * k + 1, 1, k) != -F.max_pool3d(-o, 2 * k + 1, 1, k))[0, 0]

    def refine(g, known, n, want):
        """g spread to n points a side, with true values wherever want(spread g) asks and
        none is known yet. known marks the points of g that hold true values."""
        v = spread(g, n)
        have = torch.zeros((n, n, n), dtype=torch.bool)
        have[::2, ::2, ::2] = known
        idx = torch.nonzero(want(v) & ~have)
        v[idx[:, 0], idx[:, 1], idx[:, 2]] = ask(-BOUND + idx.float() * (2 * BOUND / (n - 1)))
        have[idx[:, 0], idx[:, 1], idx[:, 2]] = True
        return v, have, len(idx)

    t0 = time.time()
    n0 = fine // 4 + 1
    ax = torch.linspace(-BOUND, BOUND, n0)
    c = ask(torch.stack(torch.meshgrid(ax, ax, ax, indexing='ij'), -1).reshape(-1, 3)).reshape(n0, n0, n0)
    assert (c > 0).any(), 'the model made no solid'
    flat = float(c.min())                      # the value far outside
    # half level: next to the coarse surface, and wherever the coarse values are not flat yet
    # outside or still small inside (a surface the coarse points stepped over)
    h, known, n1 = refine(c, torch.ones_like(c, dtype=torch.bool), fine // 2 + 1,
                          lambda v: near(v, 2) | ((v <= 0) & (v > flat * 0.94)) | ((v > 0) & (v < 4.0)))
    v, known, n2 = refine(h, known, fine + 1, lambda v: near(v, 2))
    occ = v > 0
    lo, hi = [], []
    for a in range(3):
        idx = torch.nonzero(occ.any(tuple(b for b in range(3) if b != a)))[:, 0]
        lo.append(max(0, int(idx.min()) - 3))
        hi.append(min(fine, int(idx.max()) + 3))
    v = v[lo[0]:hi[0] + 1, lo[1]:hi[1] + 1, lo[2]:hi[2] + 1]
    step = 2 * BOUND / fine
    if log:
        print('  volume %s, %d + %d + %d points, %.0fs' % (tuple(v.shape), n0 ** 3, n1, n2, time.time() - t0), flush=True)
    return v.numpy(), tuple((-BOUND + lo[a] * step, -BOUND + hi[a] * step) for a in range(3))


def make(png):
    """the volume of one queued picture, in the cache's frame (depth, up, across)"""
    import torch
    from PIL import Image
    img = Image.open(png).convert('RGB')
    # the tokens are kept beside the queue until the volume is saved: they are the slow part
    kept = png[:-4] + '.z.pt'
    if os.path.exists(kept):
        z = torch.load(kept)
    else:
        z = tokens(img)
        torch.save(z, kept)
    v, box = grid(z)
    # the model's axes: x = across (the picture's right), y = up, z = towards the viewer
    v = np.ascontiguousarray(v.transpose(2, 1, 0))
    box = (box[2], box[1], box[0])
    return v, box


def main():
    todo = os.path.join(CACHE, 'todo')
    only = sys.argv[1:]
    done = 0
    while True:
        jobs = sorted(f for f in os.listdir(todo) if f.endswith('.png')) if os.path.isdir(todo) else []
        jobs = [f for f in jobs if not only or f[:-4] in only]
        if not jobs:
            break
        f = jobs[0]
        t0 = time.time()
        v, box = make(os.path.join(todo, f))
        np.savez_compressed(os.path.join(CACHE, f[:-4] + '.npz'), v=v.astype(np.float16), box=np.array(box))
        os.remove(os.path.join(todo, f))
        if os.path.exists(os.path.join(todo, f[:-4] + '.z.pt')):
            os.remove(os.path.join(todo, f[:-4] + '.z.pt'))
        done += 1
        print('%s done in %.0fs (%d made, %d left)' % (f[:-4], time.time() - t0, done, len(jobs) - 1), flush=True)
    print('queue empty: %d picture(s) made' % done, flush=True)


if __name__ == '__main__':
    main()
