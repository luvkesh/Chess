"""Dino Kingdom: fossil bone with amber and ferns against lava stone with glowing cracks. A crowned
tyrant king in a cape, a crested queen in a gown, amber crystal bishops holding an ammonite,
triceratops and raptor knights, castle and lava-tower rooks, hatchling and amber-egg pawns.
Reference: the user's lineup picture of 2026-11-12 (2297d987, lava stone above, bone below)."""
import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/2297d987-171a-4979-b02f-98f18dd319e9'
BOXES = {
    'b': {'r': (70, 150, 232, 440), 'n': (225, 162, 410, 440), 'b': (400, 126, 530, 440), 'q': (528, 106, 688, 440),
          'k': (676, 68, 866, 440), 'p': (1290, 262, 1412, 440)},
    'w': {'r': (36, 532, 196, 818), 'n': (198, 536, 388, 818), 'b': (383, 498, 518, 818), 'q': (515, 476, 676, 818),
          'k': (676, 443, 852, 818), 'p': (1308, 630, 1432, 816)},
}
ADD = {'w': {}, 'b': {}}
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqkp')
GOLD = (70, 160, 225)
LOOK = {
    'w': {'wb': (1.05, 1.0, 0.96), 'body': (0.32, 0.0), 'gold': (0.32, 0.45), 'gem': (0.08, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.72, 'gold_val': 0.6}},
    'b': {'wb': (1.02, 1.0, 0.98), 'body': (0.58, 0.0), 'gold': (0.3, 0.55), 'gem': (0.08, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.66, 'gold_val': 0.62}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.75, seg='sam')
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(PIC, box, unit=king.unit, seg='sam', sym=(t in 'rb'), add=ADD[s].get(t))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.12, 'thick': 0.55},
    'q': {'kind': 'figure', 'z0': 0.12, 'thick': 0.5},
    'b': {'kind': 'figure', 'z0': 0.14, 'thick': 0.62, 'power': 0.35},
    'n': {'kind': 'knight', 'z0': 0.14, 'thick': 0.4},
    'r': {'kind': 'figure', 'z0': 0.14, 'thick': 0.7, 'power': 0.25},
    'p': {'kind': 'figure', 'z0': 0.16, 'thick': 0.8, 'power': 0.45},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
