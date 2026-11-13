"""Neon City: cyan-lit glass and chrome against magenta-lit smoked glass. Skyline towers, chrome
horse heads, hooded bishops, a haloed queen, a crowned king over a glowing city, robot pawns.
Reference: the user's board picture of 2026-11-12 (2aaea82c). The cyan army's front row is seen
whole; the magenta army is the same carving, so its pieces are the cyan ones recast. The robot
pawn comes from the magenta front row and is recast for cyan."""
import glob

import classic
import kit

PIC = glob.glob('/mnt/project-files/uploads/hearth/2aaea82c*')[0]
BOXES = {'r': (336, 583, 464, 857), 'n': (460, 566, 602, 822), 'b': (594, 533, 732, 797), 'q': (733, 483, 860, 772),
         'k': (856, 443, 1012, 747)}
NEG = {'n': [(595, 580), (596, 615)], 'k': [(866, 500), (862, 520)]}
PAWN = (473, 266, 549, 394)
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqkp')
GOLD = (60, 165, 235)
LOOK = {
    'w': {'wb': (1.0, 1.0, 1.0), 'body': (0.14, 0.5), 'gold': (0.24, 0.8), 'gem': (0.06, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.9, 'gold_val': 0.9}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': (0.14, 0.4), 'gold': (0.24, 0.8), 'gem': (0.06, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.9, 'gold_val': 0.9}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['k'], height=1.75, seg='sam')
    for t, box in BOXES.items():
        w = kit.Ref(PIC, box, unit=king.unit, seg='sam', sym=(t == 'r'), neg=NEG.get(t))
        out['w'][t] = w
        out['b'][t] = kit.recast(w, body=(80, 22, 90), gem=(220, 60, 255))
    b = kit.Ref(PIC, PAWN, height=0.9, seg='sam', sym=True)
    out['b']['p'] = b
    out['w']['p'] = kit.recast(b, body=(236, 232, 220), gem=(255, 230, 80), light=True)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.12, 'thick': 0.5},
    'q': {'kind': 'figure', 'z0': 0.12, 'thick': 0.46},
    'b': {'kind': 'figure', 'z0': 0.12, 'thick': 0.5, 'power': 0.4},
    'n': {'kind': 'knight', 'z0': 0.2},
    'r': {'kind': 'figure', 'z0': 0.14, 'thick': 0.75, 'power': 0.25},
    'p': {'kind': 'figure', 'z0': 0.16, 'thick': 0.55, 'power': 0.4},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
