"""What the four classic1 sets (navy, sapphire, fantasy, opulent) share.

Their hero pictures are studio photographs, lit from the front, and the game lights each piece
again. Painted as they are, the photographs' own highlights and shadows are wrapped round the
turned pieces and show as streaks and bands, and the stone takes whatever tint the photograph's
light had. prep() takes that light out of the stone (the carving, the veins, the gold and the
gems stay as they are), sets the stone's tone, and firms up the fine lines a little."""
import cv2
import numpy as np

import kit

LUM = np.array((0.114, 0.587, 0.299), np.float32)


def delight(ref, cls=None, amount=0.8, tone=None, sharpen=0.4, shine=0.5, scale=0.03):
    """One cut-out, relit flat.
    amount   0..1: how much of the broad light and shade is taken out of the stone
    tone     BGR the stone's middle colour is brought to (None: left as photographed)
    shine    0..1: how much of the thin bright streaks left after that is pressed down
    sharpen  unsharp mask over the whole piece
    scale    size of what counts as broad, as a share of the piece's height"""
    img = ref.crop.astype(np.float32)
    m = ref.mask > 0
    cls = cls or {}
    ids = kit.classify(ref.crop, **cls)
    w = ((1 - kit.gold_weight(ref.crop, **cls)) * (ids != 2) * m).astype(np.float32)   # how surely stone
    body = w > 0.6
    if body.sum() < 200:
        return ref
    h = int(m.any(1).sum())
    lum = img @ LUM
    if amount:
        sig = max(6.0, scale * h)
        low = cv2.GaussianBlur(lum * w, (0, 0), sig) / (cv2.GaussianBlur(w, (0, 0), sig) + 1e-4)
        mid = float(np.median(lum[body]))
        gain = np.clip((mid / np.maximum(low, 1.0)) ** amount, 0.5, 2.0)
        img = img * (1 + w[..., None] * (gain[..., None] - 1))
    if shine:
        lum = img @ LUM
        mid = float(np.median(lum[body]))
        over = np.maximum(lum / max(mid, 1.0), 1.0)
        g = over ** (-shine)                         # only what is brighter than the stone's middle
        img = img * (1 + w[..., None] * (g[..., None] - 1))
    if tone is not None:
        med = np.median(img[body], axis=0)
        g = np.array(tone, np.float32) / np.maximum(med, 1.0)
        img = img * (1 + w[..., None] * (g[None, None, :] - 1))
    if sharpen:
        sig = max(1.0, 0.0022 * h)
        img = img + sharpen * (img - cv2.GaussianBlur(img, (0, 0), sig))
    ref.crop = img.clip(0, 255).astype(np.uint8)
    return ref


def prep(refs, looks, opts):
    """every cut-out of a set relit flat. opts: {side: {...}} for delight(), with an optional
    per-type override under the type's letter ({'w': {'tone': ..., 'n': {'amount': 0.5}}})"""
    for side, d in refs.items():
        lk = looks[side] if side in looks else looks
        o = dict(opts.get(side, {}))
        per = {k: o.pop(k) for k in list(o) if k in kit.TYPES}
        for t, r in d.items():
            kw = dict(o)
            kw.update(per.get(t, {}))
            delight(r, cls=lk.get('classify'), **kw)
    return refs
