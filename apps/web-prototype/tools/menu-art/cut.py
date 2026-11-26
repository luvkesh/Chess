"""Cuts the menu icons out of the user's mock-up pictures (crops.py) onto a transparent ground.

    python3 cut.py <folder with the reference pictures> [name ...]

The ground behind each icon is a smooth dark gradient: fit it from the crop's border, keep what
differs from it (with a soft edge, so the mock-up's warm glow stays as a halo), fill enclosed
holes (the black knight is nearly ground-coloured) and keep the big pieces. Each icon is enlarged
2x with Lanczos and a light unsharp mask, and saved as masters/<name>.png; art-webp makes the
game's src/art/ui-<name>.webp from them."""
import sys, os
import numpy as np, cv2
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from crops import CROPS

def ground(img, ring=6):
    h, w = img.shape[:2]
    m = np.zeros((h, w), bool); m[:ring] = m[-ring:] = True; m[:, :ring] = m[:, -ring:] = True
    ys, xs = np.nonzero(m)
    X = np.stack([np.ones_like(xs), xs / w, ys / h, (xs / w) ** 2, (ys / h) ** 2, xs * ys / (w * h)], 1).astype(float)
    yy, xx = np.mgrid[0:h, 0:w]
    A = np.stack([np.ones_like(xx), xx / w, yy / h, (xx / w) ** 2, (yy / h) ** 2, xx * yy / (w * h)], -1).astype(float)
    out = np.zeros_like(img, float)
    for c in range(3):
        v = img[..., c][m].astype(float)
        # robust: refit without the brightest border pixels (an object touching the edge)
        coef = np.linalg.lstsq(X, v, rcond=None)[0]
        keep = np.abs(X @ coef - v) < 2.0 * np.std(X @ coef - v) + 4
        coef = np.linalg.lstsq(X[keep], v[keep], rcond=None)[0]
        out[..., c] = A @ coef
    return out

def cut(img, lo=14, hi=46, scale=2):
    img = img.astype(float)
    g = ground(img)
    d = np.sqrt(((img - g) ** 2).sum(-1))
    a = np.clip((d - lo) / (hi - lo), 0, 1)
    solid = (a > 0.5).astype(np.uint8)
    # fill holes: anything not reachable from the border through non-solid pixels
    h, w = solid.shape
    ff = (1 - solid).copy(); mask = np.zeros((h + 2, w + 2), np.uint8)
    for x in range(w):
        for y in (0, h - 1):
            if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
    for y in range(h):
        for x in (0, w - 1):
            if ff[y, x] == 1: cv2.floodFill(ff, mask, (x, y), 2)
    holes = ff == 1
    a[holes] = 1
    # keep pieces of real size (stray specks of the ground go)
    n, lab, st, _ = cv2.connectedComponentsWithStats((a > 0.35).astype(np.uint8), 8)
    big = np.zeros_like(a, bool)
    if n > 1:
        top = st[1:, cv2.CC_STAT_AREA].max()
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] >= max(30, top * 0.02): big |= lab == i
    near = cv2.dilate(big.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
    a = np.where(near, a, 0)
    a = cv2.GaussianBlur(a, (0, 0), 0.6)
    # un-mix the ground from the edge colour so no dark fringe shows on a new ground
    aa = np.clip(a, 0.05, 1)[..., None]
    rgb = np.clip((img - g * (1 - aa)) / aa, 0, 255)
    rgb = np.where(a[..., None] > 0.95, img, rgb)
    out = np.dstack([rgb, a * 255]).astype(np.float32)
    out = cv2.resize(out, (w * scale, h * scale), interpolation=cv2.INTER_LANCZOS4)
    blur = cv2.GaussianBlur(out[..., :3], (0, 0), 1.2)
    out[..., :3] = out[..., :3] * 1.35 - blur * 0.35
    out = np.clip(out, 0, 255).astype(np.uint8)
    # trim to the icon
    ys, xs = np.nonzero(out[..., 3] > 8)
    if len(xs): out = out[max(0, ys.min() - 4):ys.max() + 5, max(0, xs.min() - 4):xs.max() + 5]
    return out

def plain(ref, out_dir):
    from crops import PLAIN
    for n, (f, b) in PLAIN.items():
        bgr = cv2.imread(os.path.join(ref, f))[b[1]:b[3], b[0]:b[2]]
        h, w = bgr.shape[:2]
        bgr = cv2.resize(bgr, (w * 2, h * 2), interpolation=cv2.INTER_LANCZOS4)
        cv2.imwrite(os.path.join(out_dir, n + '.png'), bgr)
        print(n, bgr.shape)


if __name__ == '__main__':
    ref = sys.argv[1]
    names = sys.argv[2:] or list(CROPS)
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'masters'), exist_ok=True)
    from crops import PLAIN
    if not sys.argv[2:] or any(n in PLAIN for n in names):
        plain(ref, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'masters'))   # pictures kept whole
    for n in names:
        if n in PLAIN: continue
        f, b = CROPS[n]
        bgr = cv2.imread(os.path.join(ref, f))[b[1]:b[3], b[0]:b[2]]
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        o = cut(rgb, *CROPS_OPTS.get(n, ())) if 'CROPS_OPTS' in globals() else cut(rgb)
        cv2.imwrite(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'masters', n + '.png'), cv2.cvtColor(o, cv2.COLOR_RGBA2BGRA))
        print(n, o.shape)
