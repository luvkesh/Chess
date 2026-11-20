"""Galactic Blue and Red: a fleet in white ceramic, royal blue and gold with blue light against
a fleet in black armour and crimson with red light. A commander in a white cloak, an admiral
with her star staff, a beacon of blue crystal in a golden frame, a delta-winged starfighter, a
fluted silver tower ringed with blue light and space cadets; a warlord in a spiked helm, a
commander in a crimson gown, a beacon of jagged red crystal, an interceptor with blade wings
round a red core, a black tower with red spikes and round-helmeted cadets with red lenses.
Original designs drawn for this set (tools/model/pics/galactic), chosen by the owner on
2026-11-20 from the sheet /mnt/project-files/set-remodel/designs/galactic.jpg. The owner's own
picture for this set is a close copy of a franchise and sets the mood only: nothing is matched
to it, and no ship, helmet or weapon of that franchise is used."""
import os

from sets import figs

HERO = True
HALF = {t: 'full' for t in 'kqbnrp'}
SIDED = set('kqbnrp')
HEIGHTS = {
    'w': {'k': 1.75, 'q': 1.68, 'b': 1.56, 'n': 1.4, 'r': 1.46, 'p': 1.14},
    'b': {'k': 1.75, 'q': 1.66, 'b': 1.5, 'n': 1.3, 'r': 1.46, 'p': 1.08},
}
LOOK = {
    # glazed white ceramic; the blue cloth is not a light, the visors, cores and crystals are
    'w': {'wb': (1.02, 1.0, 0.98), 'body': 'ceramic', 'gold': 'gold', 'gem': 'gem', 'gold_tone': None,
          'classify': {'gold_sat': 0.45, 'gold_val': 0.5, 'gem_sat': 0.55, 'gem_val': 0.82}, 'gem_glow': 0.8},
    # black lacquered armour; the crimson plates are not lights, the lenses and cores are
    'b': {'wb': (1.0, 1.0, 1.0), 'body': (0.16, 0.2), 'gold': 'gold', 'gem': 'gem', 'gold_tone': None,
          'classify': {'gold_sat': 0.5, 'gold_val': 0.5, 'gem_sat': 0.62, 'gem_val': 0.86}, 'gem_glow': 0.9},
}
SPEC = {
    'w': {
        'k': {'kind': 'figure', 'z0': 0.165, 'thick': 0.5, 'segs': 6, 'fold': 6},
        'q': {'kind': 'figure', 'z0': 0.16, 'thick': 0.48},
        'b': {'kind': 'turned', 'fold': 6, 'segs': 6},
        'n': {'kind': 'figure', 'z0': 0.24, 'thick': 0.4},
        'r': {'kind': 'turned', 'fold': 6},
        'p': {'kind': 'figure', 'z0': 0.09, 'thick': 0.56},
    },
    'b': {
        'k': {'kind': 'figure', 'z0': 0.175, 'thick': 0.5, 'segs': 6, 'fold': 6},
        'q': {'kind': 'figure', 'z0': 0.15, 'thick': 0.5},
        'b': {'kind': 'turned', 'fold': 6, 'top': 0.5},
        'n': {'kind': 'figure', 'z0': 0.27, 'thick': 0.4},
        'r': {'kind': 'turned', 'fold': 6},
        'p': {'kind': 'figure', 'z0': 0.14, 'thick': 0.58},
    },
}
# CHACK_FIGS=hero builds every carved piece as the stock whole-picture relief, to compare
if os.environ.get('CHACK_FIGS') == 'hero':
    SPEC = {s: {t: (sp if sp['kind'] == 'turned' else {'kind': 'hero'}) for t, sp in d.items()} for s, d in SPEC.items()}


def refs():
    return figs.refs('galactic', HEIGHTS, SPEC)


def build(t, refs):
    return figs.build(t, refs, SPEC)
