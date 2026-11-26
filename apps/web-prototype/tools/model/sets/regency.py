"""Regency Gilt: ivory-white and jet-black lacquer with gold leaf. Arched gold crown and cross
on the king, a gold coronet on the queen, a pointed mitre dome on the bishop, a horse with a
flowing gold mane, a battlemented tower, a ball-headed pawn. No reference picture: the hero
pictures are the live pieces redrawn richer (tools/model/pics/regency), the black army recast
from the white one so both share one carving."""
import classic
import hero
from sets import _royal

HEIGHTS = {'k': 1.75, 'q': 1.6, 'b': 1.45, 'n': 1.4, 'r': 1.2, 'p': 1.02}
HALF = {'n': 'full'}
GOLD = (44, 146, 236)
LOOK = {
    'w': {'wb': (1.03, 1.0, 0.98), 'body': 'lacquer', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.42, 'gold_val': 0.4}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'lacquer', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.5, 'gold_val': 0.42}},
}


# evenly lit before painting: ivory and black lacquer at one level each, bright gold leaf
EVEN = {'w': {'body': 0.93, 'gold': 0.55, 'detail': 1.25, 'cls': LOOK['w']['classify']},
        'b': {'body': 0.07, 'gold': 0.55, 'detail': 1.2, 'cls': LOOK['b']['classify'], 'hi': 1.6}}


def refs():
    return hero.refs(_royal.pics('regency', EVEN), HEIGHTS)


SPEC = {
    # crowns are carved from the front picture over the turned body, so each arch and the cross
    # sit where the picture has them
    'k': {'kind': 'turned', 'top': ('relief', 0.745, 0.5, 0.45)},
    'q': {'kind': 'turned', 'top': ('relief', 0.745, 0.5, 0.45)},
    'b': {'kind': 'turned'},
    'n': {'kind': 'knight', 'z0': 0.215, 'thick': 0.32},
    'r': {'kind': 'rook', 'merlons': 5, 'depth': 0.15, 'notch': 0.8, 'gap': 0.6, 'wall': 0.06},
    'p': {'kind': 'turned'},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
