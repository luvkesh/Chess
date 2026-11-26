"""Sun Kingdom and Shadow Legion: a storybook kingdom in glazed cream, royal blue and gold
against a legion in black lacquer, violet and amethyst. A jolly bearded king with a sceptre, a
princess in a blue and cream gown, a wizard in a hat full of stars, a round cream pony with a
golden mane, a turret with a blue cone roof and villagers in sunflower hats; a shadow king in
a horned crown, a sorceress with a crystal ball, a hooded mage with glowing eyes, a little
dragon with bat wings, a dark spire with violet windows and grumpy horned imps.
Original designs drawn for this set (tools/model/pics/sunshadow), chosen by the owner on
2026-11-20 from the sheet /mnt/project-files/set-remodel/designs/sunshadow.jpg. The owner's own
picture for this set is a close copy of a franchise and sets the mood only: nothing is matched
to it."""
import os

from sets import figs

HERO = True
HALF = {t: 'full' for t in 'kqbnrp'}
SIDED = set('kqbnrp')
HEIGHTS = {
    'w': {'k': 1.75, 'q': 1.64, 'b': 1.56, 'n': 1.4, 'r': 1.46, 'p': 1.2},
    'b': {'k': 1.75, 'q': 1.64, 'b': 1.5, 'n': 1.4, 'r': 1.46, 'p': 1.16},
}
LOOK = {
    # glazed porcelain: the royal blue is glaze, not a gem
    'w': {'wb': (1.02, 1.0, 0.98), 'body': 'porcelain', 'gold': 'gold', 'gem': 'gem', 'gold_tone': None,
          'classify': {'gold_sat': 0.45, 'gold_val': 0.5, 'gem_sat': 0.5, 'gem_val': 0.9}},
    # black lacquer; the crystal ball, the eyes and the windows glow violet
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'lacquer', 'gold': 'gold', 'gem': 'gem', 'gold_tone': None,
          'classify': {'gold_sat': 0.45, 'gold_val': 0.45, 'gem_sat': 0.45, 'gem_val': 0.78}, 'gem_glow': 0.6},
}
SPEC = {
    'w': {
        'k': {'kind': 'figure', 'z0': 0.19, 'thick': 0.56},
        'q': {'kind': 'figure', 'z0': 0.20, 'thick': 0.52},
        'b': {'kind': 'figure', 'z0': 0.185, 'thick': 0.56},
        'n': {'kind': 'figure', 'z0': 0.105, 'thick': 0.5},
        'r': {'kind': 'turned', 'fold': 4},
        'p': {'kind': 'figure', 'z0': 0.185, 'thick': 0.56},
    },
    'b': {
        'k': {'kind': 'figure', 'z0': 0.175, 'thick': 0.56},
        'q': {'kind': 'figure', 'z0': 0.09, 'thick': 0.54},
        'b': {'kind': 'figure', 'z0': 0.17, 'thick': 0.58},
        'n': {'kind': 'figure', 'z0': 0.185, 'thick': 0.5, 'segs': 6, 'fold': 6},
        'r': {'kind': 'turned', 'fold': 6, 'segs': 6},
        'p': {'kind': 'figure', 'z0': 0.17, 'thick': 0.58, 'segs': 4, 'fold': 4},
    },
}
# CHACK_FIGS=hero builds every carved piece as the stock whole-picture relief, to compare
if os.environ.get('CHACK_FIGS') == 'hero':
    SPEC = {s: {t: (sp if sp['kind'] == 'turned' else {'kind': 'hero'}) for t, sp in d.items()} for s, d in SPEC.items()}


def refs():
    return figs.refs('sunshadow', HEIGHTS, SPEC)


def build(t, refs):
    return figs.build(t, refs, SPEC)
