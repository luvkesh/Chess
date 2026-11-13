"""Jarls of the Fjord: gold and ivory with deep blue cloaks and white fur, against dark iron and
leather with grey fur. A crowned jarl with his sword, a winged-helm shieldmaiden queen, staff-
bearing seers, rearing wolves, banner towers and spear-and-shield huscarls.
Reference: the user's lineup picture of 2026-11-12 (46f45cce, white above, black below)."""
import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/46f45cce-e827-41b6-99a6-1d9f4aed856c'
BOXES = {
    'w': {'r': (71, 38, 209, 320), 'n': (212, 65, 400, 320), 'b': (402, 16, 545, 320), 'q': (554, 16, 706, 320),
          'k': (695, 11, 901, 320), 'p': (1412, 125, 1515, 320)},
    'b': {'r': (60, 380, 223, 686), 'n': (212, 418, 402, 686), 'b': (396, 364, 545, 686), 'q': (543, 369, 706, 686),
          'k': (700, 364, 901, 686), 'p': (1412, 483, 1515, 686)},
}
# staffs, spears and banners are cut on their own points and added
ADD = {'w': {'b': [[(427, 60), (428, 150), (430, 240)]], 'p': [[(1431, 150), (1432, 220), (1433, 270)], [(1478, 215), (1490, 200)]],
             'r': [[(114, 54)], [(185, 60)]]},
       'b': {'b': [[(427, 380), (428, 480), (430, 600)], [(450, 660), (490, 660)]], 'r': [[(85, 430)], [(200, 420)]]}}
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqkp')
GOLD = (60, 165, 232)
LOOK = {
    'w': {'wb': (1.04, 1.0, 0.97), 'body': 'ceramic', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.5}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'iron', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.62, 'gold_val': 0.52}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.75, seg='sam')
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(PIC, box, unit=king.unit, seg='sam', add=ADD[s].get(t))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.12, 'thick': 0.5},
    'q': {'kind': 'figure', 'z0': 0.12, 'thick': 0.46},
    'b': {'kind': 'figure', 'z0': 0.12, 'thick': 0.44},
    'n': {'kind': 'knight', 'z0': 0.14, 'thick': 0.4},
    'r': {'kind': 'figure', 'z0': 0.12, 'thick': 0.7, 'power': 0.25},
    'p': {'kind': 'figure', 'z0': 0.16, 'thick': 0.46},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
