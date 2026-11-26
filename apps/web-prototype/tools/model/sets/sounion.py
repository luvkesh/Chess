"""Gods of Sounion: little statues for Poseidon's temple on the cape, white Parian marble
against bronze the sea air has turned green. Poseidon with his trident, a goddess in a peplos,
a breaking wave, a rearing horse, a Doric column and hoplites.
No reference picture: the hero pictures (pics/sounion) are the design the owner was shown
(/mnt/project-files/set-remodel/designs/sounion.jpg)."""
from sets import worldkit

GOLD = (62, 170, 238)
HALF = {t: 'full' for t in 'kqbnp'}
SIDED = set('kqbnrp')
LOOK = {
    'w': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
    # weathered bronze: metal under a green patina
    'b': {'body': (0.42, 0.55), 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD, 'classify': {'gold_sat': 0.62, 'gold_val': 0.5}},
}
SPEC = {
    'k': {'kind': 'stone', 'z0': 0.1, 'thick': 0.46, 'power': 0.6},
    'q': {'kind': 'stone', 'z0': 0.1, 'thick': 0.46, 'power': 0.6},
    'b': {'kind': 'stone', 'z0': 0.1, 'thick': 0.4, 'power': 0.5},
    'n': {'kind': 'knight', 'z0': 0.12, 'thick': 0.3},
    'r': {'kind': 'prism', 'round': 0.13},
    'p': {'kind': 'stone', 'z0': 0.12, 'thick': 0.4, 'power': 0.6},
}


def refs():
    return worldkit.refs('sounion', flat={'k': 0.1, 'q': 0.1, 'b': 0.1, 'n': 0.12, 'p': 0.12}, holes='bkp')


def build(t, refs):
    return worldkit.build(t, refs, SPEC)
