"""Pharaoh's Treasure: ivory and gold with sapphire light against black basalt, gold and rubies.
Every piece is a carved figure on a gold drum plinth: Pharaoh and Anubis kings, queens in court
dress, winged sphinx and jackal knights, crystal lotus bishops, temple-tower rooks, spear pawns.
Reference: the user's lineup picture of 2026-11-12 (e0d8aec1, ivory row above, basalt below)."""
import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/e0d8aec1-671e-46cc-9083-006a39e03e67'
BOXES = {
    'w': {'r': (285, 4, 465, 290), 'n': (494, 43, 657, 290), 'b': (686, 22, 820, 290), 'q': (845, 27, 990, 290),
          'k': (1005, 11, 1189, 290), 'p': (1721, 92, 1852, 290)},
    'b': {'r': (313, 364, 483, 650), 'n': (510, 367, 671, 650), 'b': (706, 380, 845, 650), 'q': (858, 369, 1015, 650),
          'k': (1021, 356, 1222, 650), 'p': (1738, 418, 1863, 650)},
}
# the kings hold a staff: it is cut on its own points and added to the figure
ADD = {'w': {'k': [[(1172, 40), (1176, 120), (1176, 220)]]},
       'b': {'k': [[(1192, 395), (1192, 500), (1192, 590)]]}}
HALF = {t: 'full' for t in 'rnqkp'}
SIDED = set('rnbqkp')
GOLD = (52, 160, 236)
LOOK = {
    'w': {'wb': (1.1, 1.0, 0.93), 'body_cool': 0.3, 'body': 'enamel', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.45}},
    # the basalt picks up warm light: only bright, saturated yellow counts as gold
    'b': {'wb': (1.04, 0.98, 0.96), 'body': 'shiny stone', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.62, 'gold_val': 0.52}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.7, seg='sam')
    unit = king.unit
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(PIC, box, unit=unit, seg='sam', sym=(t == 'b'), add=ADD[s].get(t))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)   # the two armies' carvings differ: match heights
    return out


# the drum plinths are turned; everything above them is carved from the picture
SPEC = {
    'k': {'kind': 'figure', 'z0': 0.13, 'thick': 0.42},
    'q': {'kind': 'figure', 'z0': 0.15, 'thick': 0.4},
    'b': {'kind': 'turned', 'top': ('relief', 0.55, 0.3, 0.5)},
    'n': {'kind': 'knight', 'z0': 0.17, 'thick': 0.34},
    'r': {'kind': 'figure', 'z0': 0.16, 'thick': 0.62, 'power': 0.22},
    'p': {'kind': 'figure', 'z0': 0.2, 'thick': 0.36},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
