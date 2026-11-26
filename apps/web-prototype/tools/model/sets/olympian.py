"""Olympian Marble: white Pentelic marble against dark marble from Eleusis, with gilded bronze.
Columns for the king, queen and pawn, a mitre with a Greek key band, a Parthenon horse and a
round temple tower; the Greek key runs round every base.
No reference picture: the hero pictures (pics/olympian) are the design the owner was shown
(/mnt/project-files/set-remodel/designs/olympian.jpg), each live piece redrawn richer."""
from sets import worldkit

GOLD = (64, 172, 240)
HALF = {'n': 'full'}
SIDED = set('kqbnrp')
LOOK = {
    'w': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
    'b': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.55, 'gold_val': 0.45}},
}
SPEC = {
    'k': {'kind': 'turned', 'top': ('cross', 0.825, 0.16, 0.05)},
    'q': {'kind': 'crown', 'zc': 0.795, 'zp': 0.805, 'ztip': 0.895, 'points': 8, 'top': ('finial', 0.9, 0.05),
          'dome': (0.79, 0.9, 0.09, 1), 'ball': 0},
    'b': {'kind': 'turned'},
    'n': {'kind': 'knight', 'z0': 0.17},
    'r': {'kind': 'rook', 'merlons': 8, 'phase': 0.0, 'depth': 0.17, 'gap': 0.5, 'wall': 0.07},
    'p': {'kind': 'turned'},
}


def refs():
    return worldkit.refs('olympian', flat={'n': 0.17}, slim={'r': 0.68})


def build(t, refs):
    return worldkit.build(t, refs, SPEC)
