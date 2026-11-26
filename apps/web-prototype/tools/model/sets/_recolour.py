"""Recolouring for sets whose reference picture shows only one army whole (Neon City, Light and
Void): the other army starts as the visible one recoloured in HSV, glow and trim kept apart
from the body, so the redrawn hero picture has the right materials to settle on.
  apply(ref, mode) -> a copy of the kit.Ref with its picture recoloured
  neon-dark    cyan-lit chrome and clear glass -> black chrome and smoked glass lit magenta
  neon-light   magenta-lit dark robot -> polished chrome lit cyan
  lumen-light  black enamel lit blue, gold trim -> pearl white marble, gold trim, lit amber
  lumen-dark   ivory and gold -> black enamel, gold trim kept"""
import copy

import cv2
import numpy as np


def _hsv(bgr):
    h = cv2.cvtColor(bgr.astype(np.float32) / 255, cv2.COLOR_BGR2HSV)
    return h[..., 0], h[..., 1], h[..., 2]


def _from_hsv(h, s, v):
    return cv2.cvtColor(np.dstack([h % 360, np.clip(s, 0, 1), np.clip(v, 0, 1)]).astype(np.float32), cv2.COLOR_HSV2BGR) * 255


def _step(x, a, b):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def _band(h, lo, hi, soft=12):
    """1 inside the hue band [lo, hi] degrees, fading over `soft` degrees outside it"""
    return 1 - _step(np.maximum(lo - h, h - hi), 0, soft)


def _tint(v, rgb):
    return v[..., None] * np.array(rgb[::-1], np.float32)[None, None] * 255


def neon_dark(bgr):
    h, s, v = _hsv(bgr)
    glow = (_band(h, 150, 235) * _step(s, 0.18, 0.42) * _step(v, 0.3, 0.6))[..., None]
    lit = _from_hsv(np.full_like(h, 312), s * 1.05, v)
    body = _tint(0.06 + 0.9 * (v * (1 - 0.5 * s)) ** 2.6, (0.86, 0.72, 0.95))   # mid tones drop, highlights stay
    return body * (1 - glow) + lit * glow


def neon_light(bgr):
    h, s, v = _hsv(bgr)
    glow = (_band(h, 270, 345) * _step(s, 0.3, 0.55) * _step(v, 0.35, 0.65))[..., None]
    lit = _from_hsv(np.full_like(h, 187), s, v * 1.05)
    # black chrome -> polished chrome: the reflections keep their contrast, lifted into the light
    body = _tint(0.2 + 0.8 * (v * (1 - 0.4 * s)) ** 0.6, (0.88, 0.94, 1.0))
    return body * (1 - glow) + lit * glow


def lumen_light(bgr):
    h, s, v = _hsv(bgr)
    gold = (_band(h, 14, 62) * _step(s, 0.3, 0.55) * _step(v, 0.25, 0.5))[..., None]
    glow = (_band(h, 185, 265) * _step(s, 0.3, 0.55) * _step(v, 0.55, 0.85))[..., None]
    lit = _from_hsv(np.full_like(h, 36), s * 0.95, v * 1.05)
    body = _tint(0.5 + 0.5 * (v * (1 - 0.35 * s * (1 - gold[..., 0]))) ** 0.55, (1.0, 0.965, 0.9))
    out = body * (1 - glow) + lit * glow
    return out * (1 - gold) + bgr.astype(np.float32) * gold


def lumen_dark(bgr):
    h, s, v = _hsv(bgr)
    gold = (_band(h, 14, 62) * _step(s, 0.42, 0.65) * _step(v, 0.3, 0.55))[..., None]
    body = _tint(0.03 + 0.85 * v ** 3.2, (0.72, 0.8, 1.0))
    return body * (1 - gold) + bgr.astype(np.float32) * gold


MODES = {'neon-dark': neon_dark, 'neon-light': neon_light, 'lumen-light': lumen_light, 'lumen-dark': lumen_dark}


def apply(ref, mode):
    out = copy.copy(ref)
    out.crop = MODES[mode](ref.crop).clip(0, 255).astype(np.uint8)
    return out
