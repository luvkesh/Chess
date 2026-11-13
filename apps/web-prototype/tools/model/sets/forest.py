"""Forest Guardians: white elves in ivory, green and gold against the black forest's treants,
dryads and goblins in bark, moss and bronze. An elf king with a great sword, a long-haired queen,
crystal-staff mages, white stags, crystal-lantern towers and shield-and-spear sentries; a horned
treant king, a dryad queen, hooded druids, wolf-stags, bark towers and goblin pawns.
References: the user's board pictures of 2026-11-12 (1c104eea for white, front row; 38e1c660 for
black, back row). Black's back row stands behind its pawns, so each black figure is cut down to
the pawns' heads and set on a plinth cut from a black pawn's."""
import classic
import kit

W = '/mnt/project-files/uploads/hearth/1c104eea-3bde-42c4-91b9-50980c599633'
B = '/mnt/project-files/uploads/hearth/38e1c660-2672-4550-81ea-2dfd19355f6a'
WHITE = {'r': (112, 522, 254, 799), 'n': (281, 538, 446, 803), 'b': (481, 545, 623, 803),
         'q': (665, 557, 838, 803), 'k': (838, 545, 1050, 807)}
# the sentries' plinths behind the figures' heads
WNEG = {'b': [(566, 600), (652, 604)], 'q': [(724, 600), (806, 600)], 'k': [(896, 600), (982, 600), (908, 560)],
        'n': [(398, 600), (480, 600)]}
WADD = {'b': [[(510, 575), (513, 640), (510, 720)]]}
# white sentry pawn: its feet are behind the mage's hood, so it takes the queen's plinth
WPAWN = dict(top=(W, (556, 440, 660, 600)), cut_y=578, base=(W, (665, 766, 838, 806)), base_w=86)
BCUT = 222
BLACK = {'r': ((268, 88, 392), 122), 'n': ((398, 57, 548), 136), 'b': ((538, 50, 698), 118),
         'q': ((698, 60, 808), 112), 'k': ((818, 8, 1000), 150)}
BADD = {'b': [[(575, 70), (572, 140), (570, 200)]]}
BPAWN = (272, 218, 394, 352)
BBASE = (272, 334, 394, 354)
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqkp')
GOLD = (60, 165, 230)
LOOK = {
    'w': {'wb': (1.04, 1.0, 0.97), 'body': 'ceramic', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.55}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': 'wood', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.72, 'gold_val': 0.62}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(W, WHITE['k'], height=1.75, seg='sam')
    for t, box in WHITE.items():
        out['w'][t] = kit.Ref(W, box, unit=king.unit, seg='sam', sym=(t == 'r'), add=WADD.get(t), neg=WNEG.get(t))
    path, box, m = kit.compose('forest-w-p', WPAWN['top'], WPAWN['cut_y'], WPAWN['base'], WPAWN['base_w'])
    out['w']['p'] = kit.Ref(path, box, mask=m, unit=king.unit, foot=0)
    for t, ((x0, y0, x1), bw) in BLACK.items():
        path, box, m = kit.compose('forest-b-' + t, (B, (x0, y0, x1, BCUT + 4)), BCUT, (B, BBASE), bw,
                                   top_kw={'add': BADD.get(t)})
        out['b'][t] = kit.Ref(path, box, mask=m, unit=1.0, foot=0)
    out['b']['p'] = kit.Ref(B, BPAWN, unit=1.0, seg='sam', neg=[(300, 212), (360, 212)])
    for t in out['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.1, 'thick': 0.5},
    'q': {'kind': 'figure', 'z0': 0.1, 'thick': 0.46},
    'b': {'kind': 'figure', 'z0': 0.1, 'thick': 0.42},
    'n': {'kind': 'knight', 'z0': 0.12, 'thick': 0.4},
    'r': {'kind': 'figure', 'z0': 0.12, 'thick': 0.7, 'power': 0.25},
    'p': {'kind': 'figure', 'z0': 0.14, 'thick': 0.5},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
