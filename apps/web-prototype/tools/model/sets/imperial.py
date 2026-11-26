"""Imperial Rome: white Carrara marble against purple porphyry, with gilded bronze. Every column
winds with a spiral band like Trajan's Column; the king carries a laurel crown, orb and cross,
the queen a radiate crown of sun rays, the rook two storeys of arches like the Colosseum.
No reference picture: the hero pictures (pics/imperial) are the design the owner was shown
(/mnt/project-files/set-remodel/designs/imperial.jpg), each live piece redrawn richer."""
from sets import worldkit

GOLD = (60, 168, 238)
HALF = {'n': 'full'}
SIDED = set('kqbnrp')
LOOK = {
    'w': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
    'b': {'body': 'shiny stone', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.6, 'gold_val': 0.5}},
}
SPEC = {
    'k': {'kind': 'turned', 'top': ('cross', 0.805, 0.16, 0.05)},
    'q': {'kind': 'crown', 'zc': 0.8, 'zp': 0.81, 'ztip': 0.965, 'points': 12, 'sharp': 1.6, 'top': ('finial', 0.93, 0.035),
          'dome': (0.8, 0.93, 0.085, 0), 'ball': 0},
    'b': {'kind': 'turned'},
    'n': {'kind': 'knight', 'z0': 0.19},
    'r': {'kind': 'rook', 'merlons': 8, 'phase': 0.0, 'depth': 0.18, 'gap': 0.5, 'wall': 0.07},
    'p': {'kind': 'turned'},
}


def refs():
    return worldkit.refs('imperial', flat={'n': 0.19}, slim={'r': 0.68})


def build(t, refs):
    return worldkit.build(t, refs, SPEC)
