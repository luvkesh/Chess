"""Opulent Emerald: green-black marble and ivory, gold leaf and emeralds, lantern rooks.
Reference: the user's board picture of 2026-11-12. Its front row (the dark army) is seen whole;
the ivory army stands behind its own pawns, so the ivory pieces are the dark ones recast in
ivory, as the picture's ivory pieces are the same carving."""
import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/bd922a12-c034-47e4-a50a-3ddd4bb8e4c1'
# points on neighbours that crowd a piece's box, kept out of its cut-out
NEG = {'p': [(1196, 610), (1198, 650)]}
BOXES = {'r': (116, 384, 246, 592), 'n': (244, 368, 382, 618), 'b': (376, 386, 506, 642), 'q': (500, 408, 632, 668), 'k': (626, 348, 772, 692), 'p': (1192, 500, 1286, 690)}
HALF = {'n': 'full'}
SIDED = set()
GOLD = (64, 172, 246)
LOOK = {
    'w': {'wb': (1.05, 0.96, 0.98), 'body': (0.22, 0.0), 'gold': (0.3, 0.6), 'gem': (0.05, 0.0), 'gold_tone': GOLD},
    'b': {'wb': (1.02, 1.0, 0.94), 'body_gain': 0.85, 'body': (0.15, 0.0), 'gold': (0.3, 0.6), 'gem': (0.05, 0.0), 'gold_tone': GOLD},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['k'], height=1.6, seg='sam')
    unit = min(king.unit, 0.36 / (king.width(0.06) or 1) * king.unit)
    for t, box in BOXES.items():
        b = kit.Ref(PIC, box, unit=unit, seg='sam', sym=True, neg=NEG.get(t))
        out['b'][t] = b
        out['w'][t] = kit.recast(b, body=(214, 232, 242), light=True)
    return out


SPEC = {
    'k': {'kind': 'crown', 'zc': 0.64, 'zp': 0.7, 'ztip': 0.83, 'points': 8, 'ball': 0.016, 'sharp': 0.5,
          'top': ('cross', 0.86, 0.12), 'dome': (0.64, 0.87, 0.2, 0)},
    'q': {'kind': 'crown', 'zc': 0.78, 'zp': 0.85, 'ztip': 0.975, 'points': 8, 'ball': 0.016, 'sharp': 0.5,
          'top': ('finial', 0.955, 0.05), 'dome': (0.78, 0.96, 0.15, 0)},
    'r': {'kind': 'rook', 'merlons': 6, 'depth': 0.105, 'notch': 0.62},
    'n': {'kind': 'knight', 'z0': 0.27},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
