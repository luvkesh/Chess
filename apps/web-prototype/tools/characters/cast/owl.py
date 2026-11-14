"""owl: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._plumage import *


def owl():
    """Sophie, the owl of Athens. Shape: a wide heart. A broad, low head with a cream heart-shaped
    face, two great honey eyes with calm lids, a tiny beak, soft ear tufts and Athena's olive
    sprig across the brow. Caramel feathers, cream chest with caramel flecks."""
    C = Char('Sophie', '#7a4c26', '#a06a36', '#cf9455', length=0.045, align=(0, -0.55, 0.1), clump=0.22, var=0.14)
    hc, hr = (0, 0.25, 0), (0.57, 0.43, 0.43)
    shape, body = chick(hc, hr, chest_w=0.42, chest_y=-0.7, chest_d=0.33, neck=0.1, wing=(0.17, 0.0))
    C.add(shape)
    # ear tufts: two soft plumes each, leaning out
    tuft = S.union(plume((0.33, 0.56, -0.02), (0.6, 0.8, -0.05), 0.085, 0.036, bend=(-0.03, 0.03, 0)),
                   plume((0.4, 0.5, -0.04), (0.67, 0.66, -0.07), 0.07, 0.03, bend=(-0.02, 0.03, 0)), k=0.03).mirror()
    C.add(tuft, 0.05)
    # the facial disc: two shallow dishes that meet in a soft ridge down to the beak (the heart)
    ex, ey, er = 0.215, 0.27, 0.15
    zc = S.surf_z(C.shape, ex, ey)
    C.sub(S.ell((ex, ey - 0.01, zc + 0.075), (0.255, 0.26, 0.11)).mirror(), 0.05)
    # feathers pressed into chest and wings
    low = S.plane((0, 1, 0), -0.2)
    C.shape = shingles(C.shape, low, amp=0.02, rows=0.085, cols=0.11, ref=0.45, soft=0.1)
    C.eye(ex, ey, er, 0.44, '#f2a41e', open_=0.74, tilt=-0.12, low=0.92, look=(0.0, -0.04, 1), iris_r=0.93, pupil_r=0.52, glint=1.0, lid_t=0.01, sclera='#2c1608')
    lash(C, '#4a2a12')
    disc = S.ell((ex, ey - 0.01, zc), (0.25, 0.255, 0.2)).mirror()
    heart = disc.add(S.ell((0, 0.1, zc + 0.02), (0.1, 0.12, 0.2)), 0.05)
    C.region(heart.grow(0.035), '#5a3418', 0.02, hair='#633a1a', tip='#7f4e26')
    C.region(heart, '#f1dfc0', 0.03, hair='#f6e8cf', tip='#fff7e8', length=0.026, align=(0, -0.2, 0.5), clump=0.15)
    chest = S.ell((0, -0.64, 0.2), (0.3, 0.5, 0.24))
    C.region(chest, '#efdcbc', 0.08, hair='#f3e3c6', tip='#fff6e6', length=0.065, align=(0, -0.9, 0.35), clump=0.4)
    C.region(tips(chest.grow(-0.03), rows=0.085, cols=0.11, ref=0.45, start=0.7), '#a06a36', 0.012, hair='#a06a36', tip='#c98f52')
    wings = S.ell((0.43, -0.72, -0.08), (0.22, 0.5, 0.32)).mirror()
    C.region(wings.inter(S.plane((0, 0, 1), 0.16)), '#5e3a1c', 0.06, hair='#6e4220', tip='#96602f')
    C.region(tuft.grow(0.005).inter(S.plane((0, -1, 0), -0.66)), '#6e4220', 0.05, hair='#7a4a24', tip='#9a6534')
    blush(C, 0.33, 0.1, 0.07, '#f0b49a')
    bz = S.surf_z(C.shape, 0, 0.13)
    C.build()
    beak = S.ell((0, 0.125, bz + 0.012), (0.05, 0.085, 0.06), rot=(0.55, 0, 0)).add(S.sphere((0, 0.06, bz + 0.035), 0.022), 0.03)
    K.build('SophieBeak', beak, (-0.12, -0.05, bz - 0.1), (0.12, 0.25, bz + 0.15), [K.glossy('SophieHorn', '#f0c070', 0.28)], step=0.0025)
    # Athena's olive: a sprig laid across the brow, silver-green leaves and three gold olives
    ring = []
    for a in np.linspace(-1.05, 1.05, 11):
        x, y = 0.46 * math.sin(a), 0.56 + 0.03 * math.cos(a)
        ring.append((x, y, S.surf_z(C.shape, x, y) + 0.012))
    K.build('SophieOlive', leaves(ring, 18, 0.055, 0.75, 2), (-0.7, 0.4, -0.3), (0.7, 0.8, 0.6), [K.principled('SophieLeaf', '#7f9a4a', rough=0.4, sss=0.15, coat=0.2)], step=0.003)
    K.build('SophieTwig', S.tube(ring, 0.009, 0.009), (-0.7, 0.4, -0.3), (0.7, 0.8, 0.6), [K.gold('SophieGold')], step=0.003)
    olives = S.union(*[S.ell((ring[i][0], ring[i][1] - 0.03, ring[i][2] + 0.012), (0.02, 0.026, 0.02)) for i in (3, 5, 7)])
    K.build('SophieOlives', olives, (-0.5, 0.4, 0.0), (0.5, 0.8, 0.6), [bpy_mat('SophieGold')], step=0.002)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = owl
