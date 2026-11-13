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
SIDED = {'n', 'k', 'q'}   # each side's crowns carved from its own picture
GOLD = (90, 170, 226)
LOOK = {
    'w': {'wb': (1.04, 0.98, 0.98), 'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'gold_mix': 0.3,
          'classify': {'gold_sat': 0.42, 'gem_sat': 0.95}},
    # the black side's bronze-gold ribbons are dim: no lift, and only bright, saturated pixels count
    'b': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'wb': (1.12, 1.0, 0.86),
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
    'k': {'kind': 'turned', 'top': ('relief', 0.665, 0.5, 0.45)},
    'q': {'kind': 'turned', 'top': ('relief', 0.695, 0.5, 0.45)},
    'r': {'kind': 'rook', 'merlons': 4, 'phase': 0.0, 'gap': 0.5},
    'b': {'kind': 'turned', 'top': ('relief', 0.47, 0.2, 0.5), 'pearl': (0.715, 0.088)},
    'n': {'kind': 'knight', 'z0': 0.14},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
