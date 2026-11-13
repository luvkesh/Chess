"""Dragon & Pagoda: ivory, gold and lacquer red against blue-black lacquer with glowing sapphire
light; pagoda rooks, dragon knights, flame bishops, a robed empress and emperor.
Reference: the user's lineup picture of 2026-11-12 (383455ca, both armies side by side)."""
import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/383455ca-1a66-42a7-a85a-10cd101ac589'
BOXES = {
    'w': {'r': (41, 175, 170, 440), 'n': (172, 196, 303, 440), 'b': (306, 196, 421, 440), 'q': (424, 152, 542, 440),
          'k': (546, 124, 666, 440), 'p': (64, 468, 172, 642)},
    'b': {'r': (1104, 175, 1230, 440), 'n': (1230, 196, 1369, 440), 'b': (1373, 196, 1488, 440), 'q': (1491, 152, 1611, 440),
          'k': (1611, 124, 1731, 440), 'p': (1122, 468, 1230, 642)},
}
HALF = {'n': 'full', 'q': 'full', 'k': 'full'}
SIDED = {'n', 'q', 'k'}
GOLD = (60, 168, 242)
LOOK = {
    # the ivory is warm in the picture: only strong, saturated yellow is gold, and the stone is
    # cooled toward porcelain white
    'w': {'wb': (1.12, 1.0, 0.92), 'body_cool': 0.35, 'body': (0.2, 0.0), 'gold': (0.3, 0.6), 'gem': (0.12, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.66, 'gold_val': 0.5}},
    'b': {'wb': (1.02, 0.98, 0.98), 'body': (0.18, 0.0), 'gold': (0.3, 0.6), 'gem': (0.05, 0.0), 'gold_tone': GOLD},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, BOXES['w']['k'], height=1.66, seg='sam')
    unit = king.unit
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            # the navy dragon looks left: mirror it to face right like the ivory one
            out[s][t] = kit.Ref(PIC, box, unit=unit, seg='sam', sym=t not in ('n', 'q', 'k'), flip=(s == 'b' and t == 'n'))
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.width(0.05) / max(b.width(0.05), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.2, 'thick': 0.42},
    'q': {'kind': 'figure', 'z0': 0.22, 'thick': 0.4},
    'b': {'kind': 'turned', 'top': ('relief', 0.6, 0.14)},
    'r': {'kind': 'turned', 'fold': 8},
    'n': {'kind': 'knight', 'z0': 0.25},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
