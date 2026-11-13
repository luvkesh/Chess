"""Manhattan Deco: cream enamel and black onyx with gold. A tycoon with a cane, a dancer in a fur
stole, lamplighters, fan-maned horses, skyscraper rooks and globe-and-sunburst pawns.
References: the user's lineup pictures of 2026-11-12: f389be7d (king, queen, lamplighter,
skyscraper, both rows) and c3f9a4cd (the fan-maned horses and the sunburst pawns)."""
import classic
import kit

FIG = '/mnt/project-files/uploads/hearth/f389be7d-61c2-48bb-ae19-35e703966d12'
BUST = '/mnt/project-files/uploads/hearth/c3f9a4cd-8ecc-41ff-9ba2-330f65b3612c'
BOXES = {
    'w': {'r': (FIG, (56, 38, 204, 324)), 'b': (FIG, (416, 30, 543, 324)), 'q': (FIG, (556, 11, 702, 324)),
          'k': (FIG, (711, 24, 901, 324)), 'n': (BUST, (483, 41, 665, 339)), 'p': (BUST, (103, 141, 241, 339))},
    'b': {'r': (FIG, (46, 375, 201, 673)), 'b': (FIG, (421, 375, 554, 673)), 'q': (FIG, (550, 358, 708, 673)),
          'k': (FIG, (708, 364, 901, 673)), 'n': (BUST, (478, 389, 665, 695)), 'p': (BUST, (98, 494, 239, 695))},
}
# the lamplighters' lamp posts are cut on their own points and added
# the dancers' fur stoles and sunburst halos, and the skyscraper's set-back wings, are cut the same way
ADD = {'w': {'b': [[(454, 70), (454, 170), (454, 270)]],
             'q': [[(570, 150), (580, 190)], [(685, 150), (680, 190)], [(580, 65), (675, 65), (630, 25)]],
             'r': [[(90, 170), (175, 170)], [(90, 260), (175, 260)], [(130, 70), (130, 150)]]},
       'b': {'b': [[(462, 400), (462, 500), (462, 600)]],
             'q': [[(565, 490), (575, 540)], [(695, 490), (690, 540)], [(590, 405), (680, 405), (635, 370)]]}}
# pieces from the second picture are sized against the king
HEIGHT = {'n': 1.4, 'p': 0.98}
HALF = {t: 'full' for t in 'rnbqk'}
SIDED = set('rnbqkp')
GOLD = (60, 160, 232)
LOOK = {
    'w': {'wb': (1.08, 1.0, 0.94), 'body_cool': 0.25, 'body': (0.22, 0.0), 'gold': (0.28, 0.65), 'gem': (0.06, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.48}},
    'b': {'wb': (1.04, 1.0, 0.97), 'body': (0.16, 0.0), 'gold': (0.28, 0.65), 'gem': (0.06, 0.0), 'gold_tone': GOLD,
          'classify': {'gold_sat': 0.6, 'gold_val': 0.5}},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(FIG, BOXES['w']['k'][1], height=1.72, seg='sam')
    for s in ('w', 'b'):
        for t, (pic, box) in BOXES[s].items():
            kw = {'height': HEIGHT[t]} if t in HEIGHT else {'unit': king.unit}
            out[s][t] = kit.Ref(pic, box, seg='sam', sym=(t == 'p'), add=ADD[s].get(t), **kw)
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.height() / max(b.height(), 1e-6)
    return out


SPEC = {
    'k': {'kind': 'figure', 'z0': 0.07, 'thick': 0.42},
    'q': {'kind': 'figure', 'z0': 0.08, 'thick': 0.42},
    'b': {'kind': 'figure', 'z0': 0.09, 'thick': 0.34},
    'n': {'kind': 'knight', 'z0': 0.14, 'thick': 0.34},
    'r': {'kind': 'figure', 'z0': 0.1, 'thick': 0.62, 'power': 0.25},
    'p': {'kind': 'turned'},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
