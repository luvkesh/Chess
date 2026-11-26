"""Indus Terracotta: pale buff clay against clay dipped in red slip, both painted in black, like
the figures and toys of Mohenjo-daro and Harappa. The priest-king, a figure with a fan-shaped
headdress, a seal pillar with its unicorn bull, a sturdy toy horse, a mud-brick granary tower
and little jars with bead heads.
No reference picture: the hero pictures (pics/harappa) are the design the owner was shown
(/mnt/project-files/set-remodel/designs/harappa.jpg)."""
from sets import worldkit

HALF = {t: 'full' for t in 'kqbn'}
SIDED = set('kqbnrp')
CLAY = (0.5, 0.0)       # burnished, not glazed
LOOK = {
    'w': {'body': CLAY, 'gold': 'gold', 'gem': 'gem', 'gold_tone': None, 'classify': {'gold_sat': 0.75, 'gold_val': 0.6}, 'wear': 0.8},
    'b': {'body': CLAY, 'gold': 'gold', 'gem': 'gem', 'gold_tone': None, 'classify': {'gold_sat': 0.95, 'gold_val': 0.9, 'gem_sat': 0.98}, 'wear': 0.8},
}
SPEC = {
    'k': {'kind': 'stone', 'z0': 0.08, 'thick': 0.44, 'power': 0.6},
    'q': {'kind': 'stone', 'z0': 0.06, 'thick': 0.44, 'power': 0.6},
    'b': {'kind': 'prism', 'round': 0.82},
    'n': {'kind': 'knight', 'z0': 0.1, 'thick': 0.36},
    'r': {'kind': 'rook', 'merlons': 8, 'phase': 0.0, 'depth': 0.16, 'gap': 0.5, 'wall': 0.07},
    'p': {'kind': 'turned'},
}


def refs():
    return worldkit.refs('harappa', flat={'k': 0.08, 'q': 0.06, 'b': 0, 'n': 0.1}, holes='n', slim={'r': 0.7})


def build(t, refs):
    return worldkit.build(t, refs, SPEC)
