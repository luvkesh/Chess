"""Astral Glass: frosted moon-glass with silver against midnight glass with a blue glow. Crenellated
glass towers, star-wheel dragon horses, spindle bishops holding a pearl under a star, a crowned
queen, a tall king ringed by an orbit, swirl-cut pawns topped with a pearl.
References: the user's lineup picture of 2026-11-12 (22d85eab) and, for the pawns, the board
picture 0d79e2bb."""
import glob

import hero
import kit
from sets import _front

PIC = glob.glob('/mnt/project-files/uploads/hearth/22d85eab*')[0]
BOARD = glob.glob('/mnt/project-files/uploads/hearth/0d79e2bb*')[0]
BOXES = {
    'w': {'r': (400, 90, 547, 334), 'n': (562, 60, 747, 332), 'b': (780, 50, 905, 330), 'q': (930, 48, 1072, 330),
          'k': (1095, 0, 1240, 330)},
    'b': {'r': (330, 436, 485, 688), 'n': (512, 402, 700, 688), 'b': (742, 388, 882, 688), 'q': (930, 384, 1075, 688),
          'k': (1100, 322, 1255, 688)},
}
PAWNS = {'w': (BOARD, (788, 593, 882, 762)), 'b': (BOARD, (628, 226, 708, 352))}
HALF = _front.HALF
SIDED = set('rnbqkp')
LOOK = {
    'w': {'wb': (1.0, 1.0, 1.0), 'body': 'glass', 'gold': 'silver', 'gem': 'gem', 'gold_tone': None, 'emit': 0.3,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.5}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'glass', 'gold': 'silver', 'gem': 'gem', 'gold_tone': None, 'emit': 0.3,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.5}},
}


def source_refs():
    """the cut-outs from the reference picture: what picture/cutouts.py redraws into the hero pictures"""
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.75, seg='sam', foot=0, sym=True)
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            pos = [(430, 200), (518, 200), (474, 290), (474, 130), (440, 300), (508, 300)] if (s, t) == ('w', 'r') else None
            out[s][t] = kit.Ref(PIC, box, unit=king.unit, seg='sam', foot=0, sym=(t != 'n'), pos=pos)
        pic, box = PAWNS[s]
        out[s]['p'] = kit.Ref(pic, box, height=0.88, seg='sam', foot=0, sym=True)
    for t in 'rnbqk':
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


# each piece's size in game units, as cut from the reference (picture/cutouts.py prints them)
HEIGHTS = {
    'w': {'k': 1.750, 'q': 1.539, 'b': 1.474, 'n': 1.441, 'r': 1.289, 'p': 0.880},
    'b': {'k': 1.750, 'q': 1.539, 'b': 1.474, 'n': 1.441, 'r': 1.289, 'p': 0.880},
}


def refs():
    """the hero pictures (pics/astral): each cut-out redrawn sharp at 768 x 1024 with SDXL-Lightning
    (one step, blended with the cut-out's own colours: sets/_front.py; the two small pawns two steps)"""
    out = hero.refs(hero.pics('astral'), HEIGHTS)
    for side in out.values():
        for t in 'kqbrp':
            side[t].sym = True   # turned: the nearer side of the outline, so a pennant, ring or staff does not widen it
    return out


SPEC = {
    'k': {'kind': 'turned', 'top': ('relief', 0.7, 0.4)},
    'q': {'kind': 'turned', 'top': ('relief', 0.72, 0.35)},
    'b': {'kind': 'turned', 'top': ('relief', 0.3, 0.45, 0.5)},
    'n': {'kind': 'knight', 'z0': 0.16},
    'r': {'kind': 'turned', 'top': ('relief', 0.78, 0.7, 0.4)},
    'p': {'kind': 'turned'},
}


def build(t, refs):
    return _front.build(t, refs, SPEC)
