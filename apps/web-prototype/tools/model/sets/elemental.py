"""Fire and Ice: the Ice Court (white) in glacier crystal with frost-wolf knights, the Fire Court
(black) in red-hot stone with horned dragon knights. Kings with staffs, queens with a snowflake or
flowing flame hair, spindle bishops with glowing hearts, block towers and orb pawns.
Reference: the user's lineup picture of 2026-11-12 (c2d5507c, fire above, ice below)."""
import glob

import classic
import kit

PIC = glob.glob('/mnt/project-files/uploads/hearth/c2d5507c*')[0]
BOXES = {
    'b': {'r': (42, 146, 180, 402), 'n': (182, 120, 345, 400), 'b': (356, 113, 478, 400), 'q': (468, 86, 668, 402),
          'k': (676, 28, 900, 402), 'p': (1310, 232, 1408, 400)},
    'w': {'r': (50, 642, 180, 915), 'n': (196, 642, 350, 915), 'b': (356, 610, 470, 915), 'q': (456, 582, 676, 915),
          'k': (668, 544, 912, 915), 'p': (1310, 742, 1408, 914)},
}
ADD = {'b': {'k': [[(862, 60), (858, 150), (850, 300)]]},
       'w': {'k': [[(875, 580), (868, 700), (860, 850)]]}}
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqkp')
GOLD = (60, 150, 230)
LOOK = {
    'w': {'wb': (1.0, 1.0, 1.0), 'body': (0.12, 0.0), 'gold': (0.2, 0.6), 'gem': (0.05, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.9, 'gold_val': 0.9}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': (0.3, 0.2), 'gold': (0.3, 0.3), 'gem': (0.08, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.9, 'gold_val': 0.9}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.75, seg='sam', add=ADD['w']['k'])
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(PIC, box, unit=king.unit, seg='sam', sym=(t in 'rbp'), add=ADD[s].get(t))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.07, 'thick': 0.5},
    'q': {'kind': 'figure', 'z0': 0.07, 'thick': 0.46},
    'b': {'kind': 'turned', 'top': ('relief', 0.3, 0.5, 0.5)},
    'n': {'kind': 'knight', 'z0': 0.12, 'thick': 0.4},
    'r': {'kind': 'rook', 'merlons': 6, 'depth': 0.08, 'notch': 0.6},
    'p': {'kind': 'turned', 'top': ('relief', 0.35, 0.6, 0.5)},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
