"""Royal Navy: ivory and gold with ruby lozenges against navy marble with sapphires.
Reference: the user's lineup picture of 2026-11-12 (both rows) and the board picture for the pawn."""
import classic
import kit

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
LOOK = {
    'w': {'body_cool': 0.1, 'wb': (1.06, 0.93, 1.0), 'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
    'b': {'wb': (1.04, 0.95, 1.0), 'body_gain': 0.72, 'body': 'marble', 'gold': 'gold', 'gem': 'gem', 'gold_tone': GOLD},
}


def refs():
    out = {'w': {}, 'b': {}}
    king = kit.Ref(LINEUP, BOXES['w']['k'], height=1.6)
    unit = min(king.unit, 0.372 / (king.width(0.08) or 1) * king.unit)
    for s in ('w', 'b'):
        for t, box in BOXES[s].items():
            out[s][t] = kit.Ref(LINEUP, box, unit=unit)
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
    # the crowns are carved from the front picture (a deep relief over a turned band), so seen from
    # the front each point, gem and curl is where the picture has it
    'k': {'kind': 'turned', 'top': ('relief', 0.66, 0.5, 0.45)},
    'q': {'kind': 'turned', 'top': ('relief', 0.67, 0.5, 0.45)},
    'r': {'kind': 'rook', 'merlons': 6},
    'n': {'kind': 'knight', 'z0': 0.278},
}


def build(t, refs):
    return classic.build(t, refs, SPEC)
