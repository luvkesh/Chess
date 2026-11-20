"""Orcs and Elves: high elves in white marble, sapphire enamel and gold against orc clans in
green stone, dark iron, red leather and bronze. An elf king with a tall gold staff, a queen
holding blue flowers, a hooded mage with a crystal staff, a rearing white stag in a sapphire
saddlecloth, a slender tower of gold and lapis and guards with shield and standard; an orc
warchief with a war axe, a horned warrior queen, a shaman with a crystal staff, a grey wolf on
its rock, a dark watchtower with a red roof and grunts with mace and red shield.
Original designs drawn for this set (tools/model/pics/elves), chosen by the owner on 2026-11-20
from the sheet /mnt/project-files/set-remodel/designs/elves.jpg. The owner's own pictures for
this set are close copies of a franchise and set the mood only: nothing is matched to them.
Forest Guardians' white army is also elves with a white stag, in ivory, green and gold; these
are high elves in white, sapphire and gold so the two sets stay apart."""
import os

from sets import figs

HERO = True
HALF = {t: 'full' for t in 'kqbnrp'}
SIDED = set('kqbnrp')
HEIGHTS = {
    'w': {'k': 1.75, 'q': 1.68, 'b': 1.6, 'n': 1.45, 'r': 1.4, 'p': 1.18},
    'b': {'k': 1.75, 'q': 1.68, 'b': 1.6, 'n': 1.3, 'r': 1.4, 'p': 1.18},
}
LOOK = {
    # sapphire enamel is saturated and bright all over: only the crystals' own lights are gems
    'w': {'wb': (1.02, 1.0, 0.98), 'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': None,
          'classify': {'gold_sat': 0.45, 'gold_val': 0.5, 'gem_sat': 0.5, 'gem_val': 0.86}},
    # painted stone with bronze fittings; the red leather must not glow
    'b': {'wb': (1.0, 1.0, 1.0), 'body': (0.4, 0.08), 'gold': 'bronze', 'gem': 'gem', 'gold_tone': None,
          'classify': {'gold_sat': 0.42, 'gold_val': 0.42, 'gem_sat': 0.5, 'gem_val': 0.86}},
}
SPEC = {
    'w': {
        'k': {'kind': 'figure', 'thick': 0.5},
        'q': {'kind': 'figure', 'thick': 0.48},
        'b': {'kind': 'figure', 'thick': 0.48},
        'n': {'kind': 'animal', 'face': 'right', 'thick': 0.4},
        'r': {'kind': 'turned', 'fold': 6, 'segs': 6},
        'p': {'kind': 'figure', 'thick': 0.46},
    },
    'b': {
        'k': {'kind': 'figure', 'thick': 0.52},
        'q': {'kind': 'figure', 'thick': 0.48},
        'b': {'kind': 'figure', 'thick': 0.5},
        'n': {'kind': 'animal', 'face': 'right', 'thick': 0.42},
        'r': {'kind': 'turned', 'fold': 6, 'segs': 6, 'top': 0.6},
        'p': {'kind': 'figure', 'thick': 0.5},
    },
}
# CHACK_FIGS=hero builds every carved piece as the stock whole-picture relief, to compare
if os.environ.get('CHACK_FIGS') == 'hero':
    SPEC = {s: {t: (sp if sp['kind'] == 'turned' else {'kind': 'hero'}) for t, sp in d.items()} for s, d in SPEC.items()}


def refs():
    return figs.refs('elves', HEIGHTS, SPEC)


def build(t, refs):
    return figs.build(t, refs, SPEC)
