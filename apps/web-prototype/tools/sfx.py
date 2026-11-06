"""Make the four piece sound packs from real recordings (sfx/sources, all CC0; see sfx/SOURCES.md).

    python3 apps/web-prototype/tools/sfx.py

Needs Python 3 with numpy, and ffmpeg. Writes sfx/<pack>.mp3 (every clip of a pack back to back)
and sfx/index.json (where each clip starts and how long it is, in ms). build.py inlines both.

Each pack has three weight tiers: L1 king and queen, L2 rook, bishop and knight, L3 pawn. A heavier
piece is the same material, pitched lower (a bigger body rings lower), a little longer and louder,
with more of the board's own thump under it. Every tier has four takes made from different
recordings, so two moves in a row never sound the same; audio.js adds a small random pitch and
level on top.
"""
import json
import pathlib
import subprocess

import numpy as np

here = pathlib.Path(__file__).resolve().parent.parent
src = here / 'sfx' / 'sources'
out = here / 'sfx'
SR = 44100


def load(name, chain=None):
    """A recording as mono float, through an optional ffmpeg filter chain."""
    cmd = ['ffmpeg', '-v', 'error', '-i', str(src / name), '-ac', '1', '-ar', str(SR)]
    if chain:
        cmd += ['-af', chain]
    raw = subprocess.run(cmd + ['-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def ff(x, chain):
    """Run a signal through an ffmpeg filter chain."""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f64le', '-ar', str(SR), '-ac', '1', '-i', '-', '-af', chain, '-f', 'f64le', '-'],
                         input=x.astype(np.float64).tobytes(), check=True, capture_output=True).stdout
    return np.frombuffer(raw, np.float64).copy()


def hit(x):
    """From 2 ms before the loudest strike (a scrape before it is cut away)."""
    x = x - x.mean()
    pk = np.abs(x).max()
    at = int(np.argmax(np.abs(x) > pk * 0.3))
    return x[max(0, at - int(0.002 * SR)):]


def pitch(x, k):
    """Play faster (k > 1, smaller and brighter) or slower (k < 1, bigger and deeper), like a tape."""
    if abs(k - 1) < 1e-4:
        return x
    n = int(len(x) / k)
    return np.interp(np.arange(n) * k, np.arange(len(x)), x)


def shape(x, ms):
    """Cut to ms with a natural fade: a 0.3 ms attack and a smooth tail."""
    n = min(len(x), int(ms / 1000 * SR))
    x = x[:n].copy()
    a = int(0.0003 * SR)
    x[:a] *= np.linspace(0, 1, a)
    t = int(n * 0.45)
    x[n - t:] *= np.cos(np.linspace(0, np.pi / 2, t)) ** 2
    return x


def mix(*layers):
    n = max(len(l) for l, _, _ in layers)
    y = np.zeros(n + int(0.03 * SR))
    for l, g, delay in layers:
        l = l.copy()
        f = min(len(l), int(0.006 * SR))
        l[len(l) - f:] *= np.linspace(1, 0, f)  # no layer may stop with a click
        d = int(delay / 1000 * SR)
        y[d:d + len(l)] += l * g
    return y


def norm(x, peak):
    return x * (peak / (np.abs(x).max() + 1e-9))


# --------------------------------------------------------------- the recordings
WOOD = [hit(load('elboss-piece-placement.mp3')), hit(load('j1987-put-item.ogg'))]
ALABASTER = hit(load('mh2o-alabaster.wav'))
K = lambda n, i, chain=None: hit(load('kenney-%s_%03d.ogg' % (n, i), chain))
TAKES = range(4)

# Weight tiers: pitch, length (ms), loudness, and how much board thump sits under the piece.
TIERS = {'L1': (0.82, 260, 0.92, 0.55), 'L2': (0.94, 210, 0.74, 0.32), 'L3': (1.09, 170, 0.56, 0.12)}
# Each take nudges the pitch a little so the four never match.
NUDGE = [1.0, 0.975, 1.022, 0.99]


def thump(k, take):
    """The board under the piece: the wooden landing, low-passed, pitched to the weight."""
    return pitch(ff(WOOD[take % 2], 'lowpass=f=420,lowpass=f=420'), k * 0.8)


def wood(tier, take):
    k, ms, peak, under = TIERS[tier]
    k *= NUDGE[take]
    core = pitch(WOOD[take % 2] if take < 2 else WOOD[(take + 1) % 2], k)
    grain = pitch(ff(K('impactWood_light', take), 'highpass=f=700,lowpass=f=7000'), k * 1.05)
    body = pitch(ff(K('impactWood_medium', take), 'lowpass=f=900'), k)
    x = mix((core, 1.0, 0), (grain, 0.22, 0.4), (body, 0.18 + under * 0.4, 0), (thump(k, take), under * 0.5, 0))
    return norm(shape(ff(x, 'lowpass=f=9500,highpass=f=55'), ms), peak)


def marble(tier, take):
    k, ms, peak, under = TIERS[tier]
    k *= NUDGE[take]
    # The real alabaster piece (recorded at 8 kHz) gives the stone body; a ceramic tap above
    # 3 kHz restores the bright clack the old recording lost.
    stone = pitch(ff(ALABASTER, 'lowpass=f=3600'), k)
    clack = pitch(ff(K('impactPlate_light', take), 'highpass=f=3000,highpass=f=3000,lowpass=f=11000'), k * 1.1)
    x = mix((stone, 1.0, 0), (clack, 0.42, 0.2), (thump(k, take), under * 0.45, 0))
    return norm(shape(ff(x, 'highpass=f=70,equalizer=f=2400:t=q:w=1.2:g=2'), ms * 1.15), peak * 0.95)


def glass(tier, take):
    k, ms, peak, under = TIERS[tier]
    k = k * NUDGE[take] * 1.05
    name = {'L1': 'impactGlass_heavy', 'L2': 'impactGlass_medium', 'L3': 'impactGlass_light'}[tier]
    ring = pitch(ff(K(name, take), 'highpass=f=220,lowpass=f=12000'), k)
    tick = pitch(ff(K('impactGlass_light', (take + 2) % 4), 'highpass=f=1800'), k * 1.15)
    x = mix((ring, 1.0, 0), (tick, 0.4, 0.3), (thump(k, take), under * 0.3, 0))
    return norm(shape(ff(x, 'treble=g=-3:f=7000'), ms * 1.5), peak * 0.78)


def soft(tier, take):
    k, ms, peak, under = TIERS[tier]
    k *= NUDGE[take]
    core = pitch(ff(WOOD[take % 2], 'lowpass=f=1600,lowpass=f=2200'), k)
    felt = pitch(ff(K('impactSoft_medium', take), 'lowpass=f=1200'), k)
    x = mix((core, 1.0, 0), (felt, 0.45, 0), (thump(k, take), under * 0.6, 0))
    return norm(shape(ff(x, 'highpass=f=60'), ms * 0.95), peak * 0.8)


PACKS = {'wood': wood, 'marble': marble, 'glass': glass, 'soft': soft}
GAP = 0.09


def main():
    index = {}
    for pack, make in PACKS.items():
        clips, at, parts = {}, GAP, [np.zeros(int(GAP * SR))]
        for tier in TIERS:
            clips[tier] = []
            for take in TAKES:
                x = make(tier, take)
                clips[tier].append([round(at * 1000, 1), round(len(x) / SR * 1000, 1)])
                parts += [x, np.zeros(int(GAP * SR))]
                at += len(x) / SR + GAP
        y = np.concatenate(parts).astype(np.float32)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                        '-c:a', 'libmp3lame', '-q:a', '4', '-map_metadata', '-1', '-write_xing', '1', str(out / (pack + '.mp3'))],
                       input=y.tobytes(), check=True)
        index[pack] = clips
        print(pack, '%.2f s' % (len(y) / SR), (out / (pack + '.mp3')).stat().st_size, 'bytes')
    (out / 'index.json').write_text(json.dumps(index, indent=1) + '\n')


if __name__ == '__main__':
    main()
