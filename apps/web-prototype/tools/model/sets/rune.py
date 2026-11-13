"""Runecarved: hand-whittled pale birch with blue cloaks against dark oak with red. A bearded
king leaning on his sword, a braided queen, hooded rune-staff seers, wolf-dragon heads,
round-roofed watchtowers with banners, and spear-and-shield huscarls, each on a knotwork drum.
Reference: the user's board picture of 2026-11-12 (9183b6fe). Black's back row stands behind
its pawns, so each black figure is cut down to the pawns' helmets and set on a pawn's drum; the
white sentries stand behind white's back row and take the bishop's drum."""
import classic
import kit

PIC = '/mnt/project-files/uploads/hearth/9183b6fe-6609-4537-aca2-39afca1283ff'
WHITE = {'r': (187, 568, 313, 853), 'n': (330, 598, 480, 842), 'b': (498, 545, 625, 845),
         'q': (627, 545, 763, 842), 'k': (760, 511, 937, 839)}
WADD = {'b': [[(530, 572), (522, 620)]]}
BADD = {'b': [[(485, 140), (485, 200)]]}
WPAWN = dict(top=(PIC, (365, 445, 470, 600)), cut_y=598, base=(PIC, (498, 780, 625, 845)), base_w=86)
WPAWN_ADD = [[(440, 470), (440, 520)]]
BCUT = 246
BLACK = {'r': ((285, 136, 364), 80), 'n': ((370, 150, 460), 84), 'b': ((468, 124, 551), 80),
         'q': ((553, 119, 649), 82), 'k': ((645, 95, 764), 96)}
BPAWN = (285, 256, 372, 398)
BBASE = (285, 366, 372, 398)
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqkp')
GOLD = (60, 160, 225)
LOOK = {
    'w': {'wb': (1.03, 1.0, 0.98), 'body': (0.5, 0.0), 'gold': (0.4, 0.3), 'gem': (0.1, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.75, 'gold_val': 0.65}},
    'b': {'wb': (1.0, 1.0, 1.0), 'body': (0.5, 0.0), 'gold': (0.4, 0.3), 'gem': (0.1, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.75, 'gold_val': 0.65}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(PIC, WHITE['k'], height=1.75, seg='sam')
    for t, box in WHITE.items():
        out['w'][t] = kit.Ref(PIC, box, unit=king.unit, seg='sam', sym=(t == 'r'), add=WADD.get(t))
    path, box, m = kit.compose('rune-w-p', WPAWN['top'], WPAWN['cut_y'], WPAWN['base'], WPAWN['base_w'],
                               top_kw={'add': WPAWN_ADD, 'pos': [(413, 507), (410, 547), (430, 577), (405, 590)]})
    out['w']['p'] = kit.Ref(path, box, mask=m, unit=king.unit, foot=0)
    for t, ((x0, y0, x1), bw) in BLACK.items():
        path, box, m = kit.compose('rune-b-' + t, (PIC, (x0, y0, x1, BCUT + 4)), BCUT, (PIC, BBASE), bw,
                                   top_kw={'add': BADD.get(t)})
        out['b'][t] = kit.Ref(path, box, mask=m, unit=1.0, foot=0)
    out['b']['p'] = kit.Ref(PIC, BPAWN, unit=1.0, seg='sam')
    for t in out['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.14, 'thick': 0.55},
    'q': {'kind': 'figure', 'z0': 0.14, 'thick': 0.5},
    'b': {'kind': 'figure', 'z0': 0.14, 'thick': 0.5},
    'n': {'kind': 'knight', 'z0': 0.16, 'thick': 0.42},
    'r': {'kind': 'figure', 'z0': 0.16, 'thick': 0.75, 'power': 0.25},
    'p': {'kind': 'figure', 'z0': 0.16, 'thick': 0.5},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
