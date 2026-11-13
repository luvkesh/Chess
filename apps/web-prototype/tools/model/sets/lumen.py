"""Light and Void: ivory and gold against midnight enamel with blue light. Crenellated towers, swept
horse heads, flame-cut bishops, a crowned queen, a caped and crowned king, pearl pawns.
Reference: the user's board picture of 2026-11-12 (be5ce42b). The dark army's front row is seen
whole; the light army stands behind its pawns, and is the same carving, so its pieces are the
dark ones recast in ivory. The dark pawns are the light front pawn recast."""
import glob

import classic
import kit

PIC = glob.glob('/mnt/project-files/uploads/hearth/be5ce42b*')[0]
BOXES = {'r': (418, 538, 565, 790), 'n': (575, 518, 742, 782), 'b': (758, 478, 882, 757), 'q': (893, 433, 1032, 742),
         'k': (1033, 362, 1172, 727)}
PAWN = (352, 246, 442, 367)
HALF = {'n': 'full', 'k': 'full'}
SIDED = set('rnbqkp')
GOLD = (60, 165, 235)
LOOK = {
    'w': {'wb': (1.02, 1.0, 0.98), 'body': 'enamel', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'lacquer', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.5, 'gold_val': 0.45}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['k'], height=1.75, seg='sam')
    for t, box in BOXES.items():
        b = kit.Ref(PIC, box, unit=king.unit, seg='sam', sym=(t in 'rbq'))
        out['b'][t] = b
        out['w'][t] = kit.recast(b, body=(222, 234, 244), gem=(60, 170, 245), light=True)
    w = kit.Ref(PIC, PAWN, height=0.95, seg='sam', sym=True)
    out['w']['p'] = w
    out['b']['p'] = kit.recast(w, body=(70, 34, 18), whole=True)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.14, 'thick': 0.5},
    'q': {'kind': 'turned', 'top': ('relief', 0.72, 0.4)},
    'b': {'kind': 'turned', 'top': ('relief', 0.45, 0.45, 0.5)},
    'n': {'kind': 'knight', 'z0': 0.2},
    'r': {'kind': 'rook', 'merlons': 6, 'depth': 0.1, 'notch': 0.6},
    'p': {'kind': 'turned'},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
