"""Sarsen Stones: pale sarsen from the downs against blue-grey Welsh bluestone, shaped with
hammer stones the way Stonehenge was. The king is a standing stone wearing a tiny trilithon,
the queen a holed stone, the bishop a pointed stone with a notch, the rook a tower ringed with
little standing stones, the pawn a pebble on a rough base.
No reference picture: the hero pictures (pics/sarsen) are the design the owner was shown
(/mnt/project-files/set-remodel/designs/sarsen.jpg), each live piece redrawn richer."""
from sets import worldkit

HALF = {t: 'full' for t in 'kqbn'}      # standing stones are not the same on both sides
SIDED = set('kqbnrp')
LOOK = {
    'w': {'body': 'matte stone', 'gold': 'matte stone', 'gem': 'matte stone', 'gold_tone': None, 'wear': 0.6},
    'b': {'body': (0.62, 0.0), 'gold': (0.62, 0.0), 'gem': (0.62, 0.0), 'gold_tone': None, 'wear': 0.6},
}
SPEC = {
    'k': {'kind': 'stone', 'z0': 0.12, 'thick': 0.3, 'power': 0.35},
    'q': {'kind': 'stone', 'z0': 0.1, 'thick': 0.3, 'power': 0.35},
    'b': {'kind': 'stone', 'z0': 0.13, 'thick': 0.32, 'power': 0.35},
    'n': {'kind': 'knight', 'z0': 0.17, 'thick': 0.34},
    'r': {'kind': 'rook', 'merlons': 8, 'phase': 0.0, 'depth': 0.23, 'gap': 0.46, 'wall': 0.075},
    'p': {'kind': 'turned'},
}


def refs():
    return worldkit.refs('sarsen', flat={'k': 0.12, 'q': 0.1, 'b': 0.13, 'n': 0.17}, holes='q', slim={'r': 0.7})


def build(t, refs):
    return worldkit.build(t, refs, SPEC)
