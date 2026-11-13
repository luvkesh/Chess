"""TripoSR (MIT, Stability AI x Tripo AI) as a depth oracle: one picture in, a 3D occupancy
volume out. relief() uses it so a carved figure gets its true side and back shape instead of a
swollen outline. Runs the ONNX export jc-builds/triposr-ios on the CPU:
  HF_HUB_DISABLE_XET=1 python -c "from huggingface_hub import hf_hub_download as d;
    [d('jc-builds/triposr-ios', f, local_dir='$TRIPOSR_DIR') for f in
     ('triposr_encoder.onnx', 'triposr_encoder.onnx.data', 'triposr_decoder.onnx', 'triposr_decoder.onnx.data')]"
Volumes are cached by picture hash in $TRIPOSR_CACHE, so a rebuild costs nothing.
Frame: the volume is returned in picture terms, axis order (depth, up, across) with
across = picture x to the right, up = picture up, depth = towards the viewer, all in units of
the picture's bounding square (side 1)."""
import hashlib
import os
import numpy as np
import cv2

DIR = os.environ.get('TRIPOSR_DIR', '/tmp/claude-0/tsr/jc')
CACHE = os.environ.get('TRIPOSR_CACHE', os.path.expanduser('~/.cache/chackmate-tsr'))
R = 0.87                 # TripoSR's scene radius
HALF = 1.9 * np.tan(np.radians(20))  # half the view at the origin plane (distance 1.9, fov 40)
FILL = 0.85
_enc = _dec = None


def available():
    return os.path.exists(os.path.join(DIR, 'triposr_encoder.onnx'))


def _sessions():
    global _enc, _dec
    import onnxruntime as ort
    if _enc is None:
        so = ort.SessionOptions()
        so.intra_op_num_threads = os.cpu_count() or 4
        _enc = ort.InferenceSession(os.path.join(DIR, 'triposr_encoder.onnx'), so, providers=['CPUExecutionProvider'])
        _dec = ort.InferenceSession(os.path.join(DIR, 'triposr_decoder.onnx'), so, providers=['CPUExecutionProvider'])
    return _enc, _dec


def _sample(plane, u, v):
    C, H, W = plane.shape
    fx = ((u + 1) * W - 1) / 2
    fy = ((v + 1) * H - 1) / 2
    x0 = np.floor(fx).astype(int)
    y0 = np.floor(fy).astype(int)
    wx, wy = fx - x0, fy - y0
    out = 0
    for dy in (0, 1):
        for dx in (0, 1):
            xi, yi = x0 + dx, y0 + dy
            ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H)
            val = plane[:, np.clip(yi, 0, H - 1), np.clip(xi, 0, W - 1)] * ok
            out = out + val * ((wx if dx else 1 - wx) * (wy if dy else 1 - wy))
    return out.T


def _query(codes, dec, p, ch=0):
    out = []
    for i in range(0, len(p), 131072):
        q = p[i:i + 131072] / R
        f = np.concatenate([_sample(codes[0], q[:, 0], q[:, 1]), _sample(codes[1], q[:, 0], q[:, 2]),
                            _sample(codes[2], q[:, 1], q[:, 2])], 1).astype(np.float32)
        o = dec.run(None, {'triplane_features': f[None]})[0][0]
        out.append(o[:, 0] if ch == 0 else o[:, 1:4])
    return np.concatenate(out)


def square(crop, mask):
    """the 512px grey-backed square TripoSR wants, and the crop pixel -> square-unit map"""
    ys, xs = np.nonzero(mask > 127)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    h, w = y1 - y0, x1 - x0
    side = max(h, w) / FILL
    cy, cx = (y0 + y1) / 2, (x0 + x1) / 2
    M = np.float32([[512 / side, 0, 256 - cx * 512 / side], [0, 512 / side, 256 - cy * 512 / side]])
    a = (mask > 127).astype(np.float32)
    rgb = crop[..., ::-1].astype(np.float32) / 255 * a[..., None] + 0.5 * (1 - a[..., None])
    img = cv2.warpAffine(rgb, M, (512, 512), flags=cv2.INTER_LANCZOS4, borderValue=(0.5, 0.5, 0.5))
    return np.clip(img, 0, 1), (cx, cy, side)


def volume(crop, mask, res=128):
    """occupancy logits (> 0 inside) on a res^3 grid over the object's own box, axes
    (depth, up, across), and that box as ((d0, d1), (u0, u1), (a0, a1)) in TripoSR units.
    across runs to the picture's right, up to its top, depth towards the viewer. The caller
    maps the box's across/up extent onto the cut-out's own extent."""
    img, _ = square(crop, mask)
    key = hashlib.sha1(np.round(img * 255).astype(np.uint8).tobytes() + bytes([res, 2])).hexdigest()[:20]
    path = os.path.join(CACHE, key + '.npz')
    if os.path.exists(path):
        z = np.load(path)
        return z['v'].astype(np.float32), tuple(map(tuple, z['box']))
    enc, dec = _sessions()
    codes = scene(crop, mask)
    th = 1.0 + np.log(25.0)

    def grid(box, n):
        ax = [np.linspace(b[0], b[1], n, dtype=np.float32) for b in box]
        D, U, A = np.meshgrid(*ax, indexing='ij')
        # TripoSR world: x towards the camera, y to the picture's right, z up
        p = np.stack([D.ravel(), A.ravel(), U.ravel()], 1)
        return (_query(codes, dec, p) - th).reshape(n, n, n)

    full = ((-R, R),) * 3
    c = grid(full, 56) > 0
    step = 2 * R / 55
    box = []
    for ax in range(3):
        idx = np.nonzero(c.any(tuple(a for a in range(3) if a != ax)))[0]
        box.append((max(-R, -R + (idx.min() - 1) * step), min(R, -R + (idx.max() + 1) * step)))
    v = grid(box, res)
    os.makedirs(CACHE, exist_ok=True)
    np.savez_compressed(path, v=v.astype(np.float16), box=np.array(box))
    return v, tuple(box)


def scene(crop, mask):
    """TripoSR's triplane scene codes for the cut-out (cached)"""
    img, _ = square(crop, mask)
    key = hashlib.sha1(np.round(img * 255).astype(np.uint8).tobytes() + b'codes').hexdigest()[:20]
    path = os.path.join(CACHE, key + '.codes.npy')
    if os.path.exists(path):
        return np.load(path).astype(np.float32)
    enc, _ = _sessions()
    c = enc.run(None, {'input_image': img.transpose(2, 0, 1)[None].astype(np.float32)})[0][0]
    os.makedirs(CACHE, exist_ok=True)
    np.save(path, c.astype(np.float16))
    return c


def colour(crop, mask, pts):
    """RGB 0..1 at TripoSR points (x towards the camera, y to the picture's right, z up)"""
    _sessions()
    c = scene(crop, mask)
    o = _query(c, _dec, np.asarray(pts, np.float32), ch=1)
    return 1 / (1 + np.exp(-o))
