"""Coral Kingdom: mother-of-pearl and gold against iridescent black pearl. A sea king with a
trident, a mermaid queen, seahorse knights, conch-and-pearl bishops, lighthouse rooks and pearl
pawns, each on coral and waves over a gold drum.
Reference: the user's lineup picture of 2026-11-12 (4de778ec, black pearl above, white below)."""
import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/4de778ec-cab7-4382-bf56-2fb25bf9d829'
BOXES = {
    'b': {'r': (75, 80, 247, 405), 'n': (258, 95, 424, 405), 'b': (445, 88, 600, 405), 'q': (600, 25, 832, 405),
          'k': (835, 12, 1078, 405), 'p': (1612, 238, 1728, 405)},
    'w': {'r': (75, 465, 247, 805), 'n': (255, 485, 427, 805), 'b': (445, 477, 600, 805), 'q': (598, 420, 836, 805),
          'k': (840, 415, 1082, 805), 'p': (1618, 615, 1738, 805)},
}
# the kings hold a trident: it is cut on its own points and added to the figure
ADD = {'b': {'k': [[(1050, 110), (1035, 180), (1015, 260)]]},
       'w': {'k': [[(1046, 514), (1030, 600), (1010, 680)]]}}
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqk')
GOLD = (60, 168, 238)
LOOK = {
    'w': {'wb': (1.06, 1.0, 0.95), 'body_cool': 0.2, 'body': (0.18, 0.0), 'gold': (0.28, 0.65), 'gem': (0.06, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.5}},
    'b': {'wb': (1.03, 1.0, 0.97), 'body': (0.16, 0.0), 'gold': (0.28, 0.65), 'gem': (0.06, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.5}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.75, seg='sam', add=ADD['w']['k'])
    unit = king.unit
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(PIC, box, unit=unit, seg='sam', sym=(t == 'p'), add=ADD[s].get(t))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.1, 'thick': 0.5},
    'q': {'kind': 'figure', 'z0': 0.1, 'thick': 0.48},
    'b': {'kind': 'figure', 'z0': 0.12, 'thick': 0.46},
    'n': {'kind': 'knight', 'z0': 0.12, 'thick': 0.36},
    'r': {'kind': 'figure', 'z0': 0.12, 'thick': 0.6, 'power': 0.4},
    'p': {'kind': 'turned'},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
