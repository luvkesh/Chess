"""Point-prompted cut-outs with Segment Anything (Apache-2.0; ONNX exports by Xenova).

  mask = sam.cut(img_crop, pos=[(x, y), ...], neg=[(x, y), ...])   points in crop pixels

The model files are fetched once into ~/.cache/sam (HF_HUB_DISABLE_XET=1 if the Xet host is blocked).
"""
import hashlib
import os

import cv2
import numpy as np

# ViT-H (Xenova/sam-vit-huge) when present: it keeps a piece apart from same-coloured
# neighbours far better than ViT-B; SAM_REPO picks another
REPO = os.environ.get('SAM_REPO', 'Xenova/sam-vit-huge')
DIR = os.environ.get('SAM_DIR', os.path.expanduser('~/.cache/sam-h' if 'huge' in REPO else '~/.cache/sam'))
_enc = _dec = None
_cache = {}


def _models():
    global _enc, _dec
    if _enc is None:
        import onnxruntime as ort
        need = ['onnx/vision_encoder.onnx', 'onnx/prompt_encoder_mask_decoder.onnx'] + (['onnx/vision_encoder.onnx_data'] if 'huge' in REPO else [])
        if not all(os.path.exists(os.path.join(DIR, f)) for f in need):
            os.environ.setdefault('HF_HUB_DISABLE_XET', '1')
            from huggingface_hub import hf_hub_download
            for f in need:
                hf_hub_download(REPO, f, local_dir=DIR)
        _enc = ort.InferenceSession(os.path.join(DIR, need[0]))
        _dec = ort.InferenceSession(os.path.join(DIR, need[1]))
    return _enc, _dec


def _embed(img):
    key = hashlib.md5(img.tobytes()).hexdigest() + str(img.shape)
    if key in _cache:
        return _cache[key]
    disk = os.path.join(DIR, 'emb', key.split('(')[0] + '.npz')
    if os.path.exists(disk):
        z = np.load(disk)
        _cache[key] = (z['e'], z['p'], float(z['s']), int(z['nh']), int(z['nw']))
        return _cache[key]
    enc, _ = _models()
    h, w = img.shape[:2]
    s = 1024 / max(h, w)
    nh, nw = int(round(h * s)), int(round(w * s))
    rgb = cv2.cvtColor(cv2.resize(img, (nw, nh), interpolation=cv2.INTER_CUBIC), cv2.COLOR_BGR2RGB).astype(np.float32) / 255
    rgb = (rgb - np.array([0.485, 0.456, 0.406], np.float32)) / np.array([0.229, 0.224, 0.225], np.float32)
    px = np.zeros((1024, 1024, 3), np.float32)
    px[:nh, :nw] = rgb
    emb, pos = enc.run(None, {'pixel_values': px.transpose(2, 0, 1)[None]})
    _cache[key] = (emb, pos, s, nh, nw)
    os.makedirs(os.path.dirname(disk), exist_ok=True)
    np.savez(disk, e=emb, p=pos, s=s, nh=nh, nw=nw)
    return _cache[key]


def cut(img, pos, neg=(), pick=None):
    """binary mask (uint8 0/255) of the object at the positive points, away from the negative ones."""
    emb, pe, s, nh, nw = _embed(img)
    _, dec = _models()
    pts = [(x * s, y * s) for x, y in list(pos) + list(neg)]
    lab = [1] * len(pos) + [0] * len(neg)
    iou, m = dec.run(None, {'input_points': np.array(pts, np.float32)[None, None],
                            'input_labels': np.array(lab, np.int64)[None, None],
                            'image_embeddings': emb, 'image_positional_embeddings': pe})
    i = int(np.argmax(iou[0, 0])) if pick is None else pick
    lo = cv2.resize(m[0, 0, i], (1024, 1024), interpolation=cv2.INTER_LINEAR)[:nh, :nw]
    lo = cv2.resize(lo, (img.shape[1], img.shape[0]), interpolation=cv2.INTER_LINEAR)
    mk = np.where(lo > 0, 255, 0).astype(np.uint8)
    n, lab_, st, _ = cv2.connectedComponentsWithStats(mk)
    if n > 1:
        mk = np.where(lab_ == 1 + np.argmax(st[1:, cv2.CC_STAT_AREA]), 255, 0).astype(np.uint8)
    return mk
