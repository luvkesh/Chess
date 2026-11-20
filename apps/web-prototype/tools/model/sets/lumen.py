"""Light and Void: ivory and gold against midnight enamel with blue light. Crenellated towers, swept
horse heads, flame-cut bishops, a crowned queen, a caped and crowned king, pearl pawns.
Reference: the user's board picture of 2026-11-12 (be5ce42b). The dark army's front row is seen
whole; the light army stands behind its pawns, and is the same carving, so its pieces start as
the dark ones recoloured in ivory, gold and amber light (sets/_recolour.py). The light pawn is
the light army's own front pawn; the dark pawn is the dark army's left pawn, whose right side
the rook hides, so its left half is mirrored."""
import glob

import cv2
import numpy as np

import hero
import kit
from sets import _front, _recolour

PIC = glob.glob('/mnt/project-files/uploads/hearth/be5ce42b*')[0]
BOXES = {'r': (418, 538, 565, 790), 'n': (575, 518, 742, 782), 'b': (758, 478, 882, 757), 'q': (884, 428, 1032, 742),
         'k': (1030, 356, 1200, 730)}
# a pawn stands close behind the queen (on her left) and the king (on his right): points on it, in picture pixels
NEG = {'q': [(905, 575), (898, 592)], 'k': [(1210, 462), (1206, 522), (1188, 558), (1195, 576)]}
# the lower right of the king's plinth melts into the board's reflection and the cut-out loses it: its true rim
FILL = {'k': [(1115, 690), (1190, 655), (1191, 680), (1186, 696), (1175, 705), (1158, 711), (1138, 715), (1115, 716)]}
PAWN = (352, 246, 442, 367)
DARK_PAWN = (350, 492, 472, 694)
DARK_PAWN_AXIS = 411
DARK_PAWN_POS = [(405, 520), (400, 560), (394, 612), (388, 655)]
DARK_PAWN_NEG = [(452, 580), (462, 625), (466, 672)]
HALF = _front.HALF
SIDED = set('rnbqkp')
LOOK = {
    'w': {'wb': (1.02, 1.0, 0.98), 'body': 'enamel', 'gold': 'gold', 'gem': 'gem', 'gold_tone': None, 'emit': 0.3,
          'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'lacquer', 'gold': 'gold', 'gem': 'gem', 'gold_tone': None, 'emit': 0.3,
          'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
}


def _measure(r):
    """top, bottom and axis again, as kit.Ref finds them, after a cut-out was touched up"""
    ys = np.nonzero(r.mask)[0]
    r.top, r.bot = int(ys.min()), int(ys.max())
    rows = (np.nonzero(r.mask[y])[0] for y in range(r.bot - int((r.bot - r.top) * 0.18), r.bot + 1))
    r.axis = float(np.median([(c.min() + c.max()) / 2 for c in rows if len(c)]))


def _cut(t, unit=None):
    """a front-row piece of the dark army; the king (unit None) sets the scale at 1.75 tall"""
    box = BOXES[t]
    r = kit.Ref(PIC, box, unit=unit, height=1.75, seg='sam', foot=0, sym=(t in 'rbq'), neg=NEG.get(t))
    if t in FILL:
        X0, Y0 = max(0, box[0] - 14), max(0, box[1] - 14)
        cv2.fillPoly(r.mask, [np.array([(x - X0, y - Y0) for x, y in FILL[t]], np.int32)], 255)
        _measure(r)
        if unit is None:
            r.unit = 1.75 / (r.bot - r.top)
    return r


def _dark_pawn():
    """the dark pawn behind the rook: what shows of it, its left half mirrored about its axis"""
    r = kit.Ref(PIC, DARK_PAWN, height=0.9, seg='sam', foot=0, pos=DARK_PAWN_POS, neg=DARK_PAWN_NEG)
    a = DARK_PAWN_AXIS - max(0, DARK_PAWN[0] - 14)
    n = min(a, r.mask.shape[1] - 1 - a)
    for im in (r.crop, r.mask):
        im[:, a + 1:a + 1 + n] = im[:, a - n:a][:, ::-1]
    r.mask[:, a + 1 + n:] = 0
    ys = np.nonzero(r.mask)[0]
    r.top, r.bot, r.axis, r.sym = int(ys.min()), int(ys.max()), float(a), True
    r.unit = 0.9 / (r.bot - r.top)
    return r


def source_refs():
    """the cut-outs from the reference picture: what picture/cutouts.py redraws into the hero pictures"""
    out = {'w': {}, 'b': {}}
    king = _cut('k')
    for t in BOXES:
        b = king if t == 'k' else _cut(t, king.unit)
        out['b'][t] = b
        out['w'][t] = _recolour.apply(b, 'lumen-light')
    out['w']['p'] = kit.Ref(PIC, PAWN, height=0.9, seg='sam', foot=0, sym=True)
    out['b']['p'] = _dark_pawn()
    return out


# each piece's size in game units, as cut from the reference (picture/cutouts.py prints them)
HEIGHTS = {'k': 1.750, 'q': 1.499, 'b': 1.339, 'n': 1.234, 'r': 1.239, 'p': 0.900}


def refs():
    """the hero pictures (pics/lumen). Dark king to rook: one step, blended with the cut-out's own colours
    (sets/_front.py). The light army (the recoloured cut-outs) and both pawns: redrawn in two steps."""
    out = hero.refs(hero.pics('lumen'), HEIGHTS)
    for side in out.values():
        for t in 'rbqp':
            side[t].sym = True   # turned: the nearer side of the outline
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.14, 'thick': 0.5},
    'q': {'kind': 'turned', 'top': ('relief', 0.72, 0.4)},
    'b': {'kind': 'turned', 'top': ('relief', 0.45, 0.45, 0.5)},
    'n': {'kind': 'knight', 'z0': 0.2},
    'r': {'kind': 'rook', 'merlons': 6, 'depth': 0.1, 'notch': 0.6},
    'p': {'kind': 'turned'},
}


def build(t, refs):
    return _front.build(t, refs, SPEC)
