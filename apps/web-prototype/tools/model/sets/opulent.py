"""Opulent Emerald: green-black marble and ivory, gold leaf and emeralds, lantern rooks.
Reference: the user's board picture of 2026-11-12. Its front row (the dark army) is seen whole;
the ivory army stands behind its own pawns, so the ivory pieces are the dark ones recast in
ivory, as the picture's ivory pieces are the same carving."""
import classic
import hero
import kit
from sets import classic1_common as common

PIC = '/mnt/project-files/uploads/hearth/bd922a12-c034-47e4-a50a-3ddd4bb8e4c1'
# points on neighbours that crowd a piece's box, kept out of its cut-out
NEG = {'p': [(1196, 610), (1198, 650)]}
BOXES = {'r': (116, 384, 246, 592), 'n': (244, 368, 382, 618), 'b': (376, 386, 506, 642), 'q': (500, 408, 632, 668), 'k': (626, 348, 772, 692), 'p': (1192, 500, 1286, 690)}
HALF = {'n': 'full'}
SIDED = set()
GOLD = (64, 172, 246)
IVORY = (214, 230, 240)   # BGR: the ivory side's stone
# the photographs' own light is taken out of the stone before it is painted (classic1_common)
PREP = {
    'w': {'tone': IVORY, 'amount': 0.8, 'sharpen': 0.5, 'n': {'amount': 0.55, 'scale': 0.06}},
    'b': {'amount': 0.8, 'sharpen': 0.5, 'n': {'amount': 0.55, 'scale': 0.06}},
}
LOOK = {
    'w': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
    'b': {'wb': (1.02, 1.0, 0.94), 'body_gain': 0.85, 'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
}


# heights in game units, as cutouts.py measured the ivory army in the reference; both armies
# take them, because they share their meshes and the two kings stand equally tall
HEIGHTS = {'k': 1.600, 'q': 1.285, 'b': 1.195, 'n': 1.176, 'r': 1.002, 'p': 0.885}


def refs():
    """the hero pictures (pics/opulent): each piece redrawn sharper from its reference cut-out"""
    return common.prep(hero.refs(hero.pics('opulent'), HEIGHTS), LOOK, PREP)


def source_refs():
    """the pieces as cut from the reference picture: what the hero pictures were redrawn from"""
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['k'], height=1.6, seg='sam')
    unit = min(king.unit, 0.36 / (king.width(0.06) or 1) * king.unit)
    for t, box in BOXES.items():
        b = kit.Ref(PIC, box, unit=unit, seg='sam', sym=True, neg=NEG.get(t))
        out['b'][t] = b
        out['w'][t] = kit.recast(b, body=(214, 232, 242), light=True)
    return out


SPEC = {
    'k': {'kind': 'turned', 'top': ('relief', 0.65, 0.5, 0.45)},
    'q': {'kind': 'turned', 'top': ('relief', 0.705, 0.5, 0.45)},
    'r': {'kind': 'rook', 'merlons': 6, 'depth': 0.105, 'notch': 0.62},
    'n': {'kind': 'knight', 'z0': 0.27, 'thick': 0.38},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
