"""Royal Navy: ivory and gold with ruby lozenges against navy marble with sapphires.
Reference: the user's lineup picture of 2026-11-12 (both rows) and the board picture for the pawn."""
import classic
import hero
import kit
from sets import classic1_common as common

LINEUP = '/mnt/project-files/uploads/hearth/1d2e35ab-36f4-462b-be97-4e9d9532a0a7'
BOARD = '/mnt/project-files/uploads/hearth/9e5327a2-2729-4dd5-b54f-a492a76d920b'
BOXES = {
    'w': {'k': (910, 5, 1100, 402), 'q': (702, 72, 888, 402), 'b': (512, 92, 682, 402), 'n': (272, 90, 490, 402), 'r': (68, 128, 264, 402)},
    'b': {'k': (910, 425, 1100, 808), 'q': (702, 478, 888, 808), 'b': (512, 494, 682, 808), 'n': (272, 488, 492, 808), 'r': (68, 528, 264, 808)},
}
PAWN = (240, 244, 329, 358)   # the board picture's front ivory pawn (for its pearl)
GOLD = (64, 172, 246)   # BGR tone the gold leaf is lifted toward
HALF = {'n': 'full'}
SIDED = {'n', 'k', 'q'}   # each side's crowns carved from its own picture
IVORY = (214, 230, 240)   # BGR: the ivory side's stone
NAVY = (78, 40, 26)       # BGR: the navy side's marble, a midnight blue
# the photographs' own light is taken out of the stone before it is painted (classic1_common)
PREP = {
    'w': {'tone': IVORY, 'amount': 0.8, 'sharpen': 0.35, 'n': {'amount': 0.55, 'scale': 0.06}, 'k': {'gild': (0.84, GOLD)}},
    'b': {'tone': NAVY, 'amount': 0.8, 'sharpen': 0.35, 'n': {'amount': 0.55, 'scale': 0.06}, 'k': {'gild': (0.86, GOLD)}},
}
LOOK = {
    'w': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
    'b': {'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
}


# heights in game units, as cutouts.py measured the ivory army in the reference; both armies
# take them, because they share their meshes and the two kings stand equally tall
HEIGHTS = {'k': 1.580, 'q': 1.304, 'b': 1.232, 'n': 1.232, 'r': 1.088, 'p': 0.772}


_OWN = {}


def refs():
    """the hero pictures (pics/navy): each piece redrawn sharper from its reference cut-out"""
    out = common.prep(hero.refs(hero.pics('navy'), HEIGHTS), LOOK, PREP)
    _OWN.clear()
    _OWN.update(out)
    return out


def source_refs():
    """the pieces as cut from the reference pictures: what the hero pictures were redrawn from"""
    out = {'w': {}, 'b': {}}
    king = kit.Ref(LINEUP, BOXES['w']['k'], height=1.6)
    unit = min(king.unit, 0.372 / (king.width(0.08) or 1) * king.unit)
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            # the navy king's dark gold cross melts into the dark hall behind it: Segment Anything
            # keeps it (GrabCut dropped it), with a stroke of points down the cross to be sure
            kw = dict(seg='sam', add=[[(1004, 436), (1004, 452), (1004, 468), (992, 450), (1016, 450)]]) if (s, t) == ('b', 'k') else {}
            out[s][t] = kit.Ref(LINEUP, box, unit=unit, **kw)
    # the navy row stands a little further back: scale each navy cut-out so its foot matches
    # the ivory one's, which registers its painting on the shared meshes
    for t in BOXES['b']:
        w, b = out['w'][t], out['b'][t]
        b.unit *= w.width(0.06) / max(b.width(0.06), 1e-6)
    # The pawn: the board picture shows it only from above, so it is put together from the
    # set's own parts seen straight on (the bishop's foot and stem, its collar) and the pearl
    # from the board picture, in each side's colours.
    pearl = kit.Ref(BOARD, PAWN, unit=1.0)
    pz = kit.ball_slice(pearl)
    pearl.unit = 0.27 / (pz[1] - pz[0])          # a pearl 0.27 across
    pz = kit.ball_slice(pearl)
    pearls = {'w': pearl, 'b': kit.recast(pearl, body=(70, 34, 22), whole=True)}
    for s in ('w', 'b'):
        b = out[s]['b']
        out[s]['p'] = kit.stack([(b, 0, 0.30), (b, 0.48, 0.62), (b, 0.635, 0.715), (pearls[s], pz[0] + 0.012, pz[1])], unit)
    return out


SPEC = {
    # a true crown (classic1_common.crown): a flared ring that parts into eight leaves round a
    # slim gold cap. Eight, because the pictures' points stand at the middle, at 0.7 of the
    # half width and at the outline, which is where eight leaves round a ring are seen from
    # the front, so each leaf is painted with its own gem
    'k': {'kind': 'leaves', 'zc': 0.645, 'zp': 0.70, 'ztip': 0.825, 'points': 8, 'sharp': 0.6,
          'dome': (0.69, 0.845, 0.07, 1), 'top': ('cross', 0.84, 0.14)},
    'q': {'kind': 'leaves', 'zc': 0.665, 'zp': 0.72, 'ztip': 0.84, 'points': 8, 'sharp': 0.6,
          'dome': (0.71, 0.895, 0.075, 1), 'top': ('finial', 0.89, 0.07)},
    'r': {'kind': 'rook', 'merlons': 6},
    'n': {'kind': 'knight', 'z0': 0.278, 'thick': 0.38},
}
# the navy army's crowns sit a little higher in their own pictures
SPEC_B = {
    'k': dict(SPEC['k'], zc=0.66, zp=0.715, ztip=0.845, dome=(0.705, 0.865, 0.07, 1), top=('cross', 0.86, 0.14)),
    'q': dict(SPEC['q'], zc=0.69, zp=0.74, ztip=0.865, dome=(0.73, 0.92, 0.075, 1), top=('finial', 0.915, 0.07)),
}


def build(t, refs):
    navy = bool(_OWN) and refs['w'] is _OWN['b'][t]   # build.py hands the shape's source as 'w'
    spec = dict(SPEC, **SPEC_B) if navy else SPEC
    if spec.get(t, {}).get('kind') == 'leaves':
        return common.crown(t, refs, spec[t])
    return classic.build(t, refs, spec)
