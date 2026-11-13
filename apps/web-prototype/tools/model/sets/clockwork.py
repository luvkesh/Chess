"""Clockwork Brass: gunmetal and brass against ivory enamel and gold, with glowing amber glass.
Lighthouse rooks with pennants, geared horses (white's are winged unicorns), armillary-sphere
bishops, a faceted crystal queen in a crown, a crowned king with a clockwork cage, glass-bulb pawns.
Reference: the user's lineup picture of 2026-11-12 (05344cff, gunmetal above, ivory below)."""
import classic
import kit

import glob as _g
PIC = _g.glob('/mnt/project-files/uploads/hearth/05344cff*')[0]
BOXES = {
    'b': {'r': (48, 148, 205, 455), 'n': (210, 166, 390, 455), 'b': (403, 160, 532, 455), 'q': (538, 118, 678, 455),
          'k': (695, 63, 842, 455), 'p': (1318, 278, 1422, 452)},
    'w': {'r': (38, 576, 198, 910), 'n': (178, 614, 385, 910), 'b': (398, 604, 525, 910), 'q': (527, 564, 676, 910),
          'k': (688, 518, 842, 910), 'p': (1320, 728, 1424, 907)},
}
ADD = {'w': {'r': [[(150, 600), (135, 595)]]}, 'b': {}}
HALF = {'n': 'full'}
SIDED = set('rnbqkp')
GOLD = (55, 160, 235)
LOOK = {
    'w': {'wb': (1.04, 1.0, 0.97), 'body': 'enamel', 'gold': 'brass', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.7, 'gold_val': 0.5}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'metal', 'gold': 'brass', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.68, 'gold_val': 0.5}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.75, seg='sam', sym=True)
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(PIC, box, unit=king.unit, seg='sam', sym=(t != 'n'), add=ADD[s].get(t))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'crown', 'zc': 0.7, 'zp': 0.76, 'ztip': 0.84, 'points': 8, 'ball': 0.016, 'sharp': 0.5,
          'top': ('cross', 0.85, 0.12), 'dome': (0.7, 0.86, 0.2, 0)},
    'q': {'kind': 'crown', 'zc': 0.76, 'zp': 0.82, 'ztip': 0.93, 'points': 8, 'ball': 0.016, 'sharp': 0.5,
          'top': ('finial', 0.9, 0.06), 'dome': (0.76, 0.9, 0.15, 0)},
    'b': {'kind': 'turned', 'top': ('relief', 0.5, 0.5, 0.5)},
    'n': {'kind': 'knight', 'z0': 0.2},
    'r': {'kind': 'turned', 'top': ('relief', 0.86, 0.12)},
    'p': {'kind': 'turned'},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
