"""Fantasy Marble: white Calacatta and black Portoro marble inlaid with gold ribbons, petal
crowns, a flame bishop holding a pearl. Reference: the user's picture of 2026-11-12 (its
'light side' and 'dark side' lineups, straight on)."""
import math

import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/e967ebaa-9315-4ba2-86d7-73d9ef18ae19'
BOXES = {
    'w': {'p': (36, 840, 126, 976), 'r': (134, 804, 218, 976), 'n': (228, 780, 352, 976), 'b': (350, 770, 438, 976), 'q': (458, 756, 556, 976), 'k': (566, 722, 668, 976)},
    'b': {'p': (764, 840, 850, 976), 'r': (856, 804, 952, 976), 'n': (956, 780, 1080, 976), 'b': (1070, 770, 1162, 976), 'q': (1176, 756, 1288, 976), 'k': (1288, 722, 1414, 976)},
}
HALF = {'n': 'full'}
GOLD = (90, 170, 226)
LOOK = {
    'w': {'wb': (1.04, 0.98, 0.98), 'body': (0.2, 0.0), 'gold': (0.3, 0.65), 'gem': (0.05, 0.0), 'gold_tone': GOLD, 'gold_mix': 0.3,
          'classify': {'gold_sat': 0.42, 'gem_sat': 0.95}},
    # the black side's bronze-gold ribbons are dim: no lift, and only bright, saturated pixels count
    'b': {'body': (0.16, 0.0), 'gold': (0.3, 0.65), 'gem': (0.05, 0.0), 'wb': (1.12, 1.0, 0.86),
          'classify': {'gold_sat': 0.5, 'gold_val': 0.5, 'gem_sat': 0.95}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.66, seg='sam', sym=True)
    unit = min(king.unit, 0.36 / (king.width(0.05) or 1) * king.unit)
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            # the knights look left in the picture: mirror them to face right like every set's
            out[s][t] = kit.Ref(PIC, box, unit=unit, flip=(t == 'n'), seg='sam', sym=(t != 'n'))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.width(0.04) / max(b.width(0.04), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'crown', 'zc': 0.655, 'zp': 0.69, 'ztip': 0.835, 'points': 8, 'ball': 0, 'sharp': 0.55,
          'top': ('cross', 0.84, 0.14), 'dome': (0.655, 0.87, 0.2, 0)},
    'q': {'kind': 'crown', 'zc': 0.685, 'zp': 0.735, 'ztip': 0.925, 'points': 8, 'ball': 0, 'sharp': 0.55,
          'top': ('finial', 0.9, 0.065), 'dome': (0.685, 0.93, 0.2, 0)},
    'r': {'kind': 'rook', 'merlons': 4, 'phase': 0.0, 'gap': 0.5},
    'b': {'kind': 'turned', 'top': ('relief', 0.47, 0.2, 0.5), 'pearl': (0.715, 0.088)},
    'n': {'kind': 'knight', 'z0': 0.14},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
