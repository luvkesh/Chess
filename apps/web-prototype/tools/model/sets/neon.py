"""Neon City: cyan-lit glass and chrome against magenta-lit smoked glass. Skyline towers, chrome
horse heads, hooded bishops, a haloed queen, a crowned king over a glowing city, robot pawns.
Reference: the user's board picture of 2026-11-12 (2aaea82c). The cyan army's front row is seen
whole; the magenta army is the same carving, so its pieces start as the cyan ones recoloured
(sets/_recolour.py). The robot pawn comes from the magenta front row and is recoloured for cyan."""
import glob

import cv2
import numpy as np

import hero
import kit
from sets import _front, _recolour

PIC = glob.glob('/mnt/project-files/uploads/hearth/2aaea82c*')[0]
BOXES = {'r': (336, 583, 464, 857), 'n': (460, 566, 602, 822), 'b': (594, 533, 732, 797), 'q': (733, 483, 860, 772),
         'k': (856, 443, 1012, 747)}
NEG = {'n': [(595, 580), (596, 615)], 'k': [(866, 500), (862, 520)]}
PAWN = (473, 266, 549, 394)
# a pawn's helmet shows behind the king's shoulder: cut it away (picture pixels)
ERASE = {'k': [(858, 488), (899, 488), (899, 501), (868, 522), (858, 524)]}
HALF = _front.HALF
SIDED = set('rnbqkp')
LOOK = {
    'w': {'wb': (1.0, 1.0, 1.0), 'body': 'glass', 'gold': 'chrome', 'gem': 'gem', 'emit': 0.3, 'gold_tone': None,
          'classify': {'gold_sat': 0.9, 'gold_val': 0.9}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'glass', 'gold': 'chrome', 'gem': 'gem', 'emit': 0.3, 'gold_tone': None,
          'classify': {'gold_sat': 0.9, 'gold_val': 0.9}},
}


def source_refs():
    """the cut-outs from the reference picture: what picture/cutouts.py redraws into the hero pictures"""
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['k'], height=1.75, seg='sam', foot=0)
    for t, box in BOXES.items():
        w = kit.Ref(PIC, box, unit=king.unit, seg='sam', foot=0, sym=(t == 'r'), neg=NEG.get(t))
        if t in ERASE:
            cv2.fillPoly(w.mask, [np.array([(x - (box[0] - 14), y - (box[1] - 14)) for x, y in ERASE[t]], np.int32)], 0)
        out['w'][t] = w
        out['b'][t] = _recolour.apply(w, 'neon-dark')
    b = kit.Ref(PIC, PAWN, height=0.9, seg='sam', foot=0, sym=True)
    out['b']['p'] = b
    out['w']['p'] = _recolour.apply(b, 'neon-light')
    return out


# each piece's size in game units, as cut from the reference (picture/cutouts.py prints them)
HEIGHTS = {'k': 1.750, 'q': 1.650, 'b': 1.434, 'n': 1.373, 'r': 1.528, 'p': 0.900}


def refs():
    """the hero pictures (pics/neon). Cyan king to rook: one step, blended with the cut-out's own colours
    (sets/_front.py). Magenta king to rook: the recoloured cut-outs redrawn in two steps. The magenta pawn
    was sharpened twice (one step each); the cyan pawn is that finished pawn recoloured (neon-light) and
    sharpened once, so both pawns are the same carving."""
    out = hero.refs(hero.pics('neon'), HEIGHTS)
    for side in out.values():
        side['r'].sym = True   # the tower is turned: the nearer side of the outline
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.12, 'thick': 0.5},
    'q': {'kind': 'figure', 'z0': 0.12, 'thick': 0.46},
    'b': {'kind': 'figure', 'z0': 0.12, 'thick': 0.5, 'power': 0.4},
    'n': {'kind': 'knight', 'z0': 0.2},
    'r': {'kind': 'figure', 'z0': 0.14, 'thick': 0.75, 'power': 0.25},
    'p': {'kind': 'figure', 'z0': 0.16, 'thick': 0.55, 'power': 0.4},
}


def build(t, refs):
    return _front.build(t, refs, SPEC)
