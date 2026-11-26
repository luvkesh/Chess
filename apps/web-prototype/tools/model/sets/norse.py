"""Norse Carved: pale birch against smoked bog oak, turned in stacked rings and cut with a knife.
The king's crown is Mjolnir, the queen wears a circlet of leaves, the bishop's cap carries the
arrow rune, the rook is four tiers like longhouse roofs and the pawn is a little toadstool.
No reference picture: the hero pictures (pics/norse) are the design the owner was shown
(/mnt/project-files/set-remodel/designs/norse.jpg), each live piece redrawn richer."""
from sets import worldkit

GOLD = (70, 150, 214)       # bronze bands and amber, warmer than leaf gold
HALF = {'n': 'full'}
SIDED = set('kqbnrp')
LOOK = {
    'w': {'body': (0.42, 0.0), 'gold': 'bronze', 'gem': 'gem', 'gold_tone': None, 'classify': {'gold_sat': 0.62, 'gold_val': 0.5}, 'wear': 1.3},
    'b': {'body': 'varnished wood', 'gold': 'bronze', 'gem': 'gem', 'gold_tone': None, 'classify': {'gold_sat': 0.7, 'gold_val': 0.55}, 'wear': 1.3},
}
HEIGHTS = {'p': 0.92}
SPEC = {
    'k': {'kind': 'turned', 'top': ('cross', 0.76, 0.16, 0.085)},
    'q': {'kind': 'turned'},
    'b': {'kind': 'turned'},
    'n': {'kind': 'knight', 'z0': 0.1},
    'r': {'kind': 'turned'},
    'p': {'kind': 'turned'},
}


def refs():
    return worldkit.refs('norse', HEIGHTS, flat={'n': 0.1}, slim={'r': 0.68, 'p': 0.9})


def build(t, refs):
    return worldkit.build(t, refs, SPEC)
