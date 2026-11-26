"""Inca Stone: pale granite against dark andesite, dressed like the walls of Machu Picchu, with
the sun, the moon and a tumi knife in hammered gold and turquoise. Every pillar is squared
masonry: the king carries Inti's sun, the queen Mama Killa's crescent, the bishop a tumi blade
with its notch; the rook is a square tower with a trapezoid doorway, the pawn a milestone.
No reference picture: the hero pictures (pics/inca) are the design the owner was shown
(/mnt/project-files/set-remodel/designs/inca.jpg)."""
from sets import worldkit

GOLD = (58, 166, 236)
HALF = {t: 'full' for t in 'kqbn'}
SIDED = set('kqbnrp')
LOOK = {
    'w': {'body': (0.36, 0.0), 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
    'b': {'body': (0.4, 0.0), 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.55, 'gold_val': 0.45}},
}
SPEC = {
    'k': {'kind': 'prism', 'top': (0.74, 0.3, 0.06)},
    'q': {'kind': 'prism', 'top': (0.74, 0.3, 0.06)},
    'b': {'kind': 'prism', 'top': (0.6, 0.3, 0.05)},
    'n': {'kind': 'knight', 'foot': 'prism', 'z0': 0.2, 'thick': 0.32},
    'r': {'kind': 'prism', 'merlons': (0.84, 0.16)},
    'p': {'kind': 'prism', 'round': 0.62},
}


def refs():
    return worldkit.refs('inca', flat={t: 0 for t in 'kqbnrp'}, slim={'r': 0.7})


def build(t, refs):
    return worldkit.build(t, refs, SPEC)
