"""Royal Ivory and Sapphire: ivory with gold leaf and sapphire enamel against lapis-blue enamel.
Reference: the user's lineup picture of 2026-11-12 (both rows, pawns included)."""
import classic
import kit

LINEUP = '/mnt/project-files/uploads/hearth/b781657f-2229-4100-a11c-b058f345ae92'
BOXES = {
    'w': {'r': (211, 124, 347, 347), 'n': (356, 108, 503, 347), 'b': (510, 76, 629, 347), 'q': (629, 73, 760, 347), 'k': (760, 23, 903, 347), 'p': (1339, 190, 1433, 347)},
    'b': {'r': (204, 430, 347, 654), 'n': (352, 410, 506, 654), 'b': (510, 418, 629, 654), 'q': (627, 380, 756, 654), 'k': (758, 336, 901, 654), 'p': (1339, 494, 1433, 654)},
}
HALF = {'n': 'full'}
SIDED = {'n', 'k', 'q'}   # each side's crowns carved from its own picture
GOLD = (64, 172, 246)
LOOK = {
    'w': {'body_cool': 0.1, 'wb': (1.05, 0.95, 1.0), 'body': 'porcelain', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
    'b': {'wb': (1.02, 1.0, 0.9), 'body': 'enamel', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(LINEUP, BOXES['w']['k'], height=1.6)
    unit = min(king.unit, 0.36 / (king.width(0.06) or 1) * king.unit)
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(LINEUP, box, unit=unit)
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.width(0.05) / max(b.width(0.05), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'turned', 'top': ('relief', 0.630, 0.5, 0.45)},
    'q': {'kind': 'turned', 'top': ('relief', 0.675, 0.5, 0.45)},
    'r': {'kind': 'rook', 'merlons': 6},
    'n': {'kind': 'knight', 'z0': 0.26},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
