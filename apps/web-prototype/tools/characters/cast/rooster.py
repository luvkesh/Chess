"""rooster: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._plumage import *


def rooster():
    """Gaston, the dandy of Paris. Shape: a bell. A neat white head under a tall scarlet comb, a
    cape of long hackles that fans out over the shoulders from cream through gold to russet,
    teal sickle feathers arching behind, chin up, and a French-blue silk bow tie."""
    C = Char('Gaston', '#e2d6c2', '#f4ecdd', '#fffdf8', length=0.045, align=(0, -0.55, 0.1), clump=0.22, var=0.06)
    hc, hr = (0, 0.23, 0), (0.37, 0.37, 0.37)
    shape, body = chick(hc, hr, w=0.44, d=0.37, top=-0.1, wing=False)
    C.add(shape)
    cape = S.cone((0, 0.02, -0.03), (0, -0.5, -0.05), 0.29, 0.44).add(S.ell((0, -0.64, -0.05), (0.52, 0.34, 0.4)), 0.2)
    C.add(cape, 0.07)
    low = S.plane((0, 1, 0), -0.04)
    lat = dict(rows=0.1, cols=0.075, ref=0.45, length=2.5)
    C.shape = shingles(C.shape, low, amp=0.026, soft=0.08, **lat)
    ex, ey, er = 0.165, 0.29, 0.105
    C.eye(ex, ey, er, 0.44, '#c9772a', open_=0.74, tilt=-0.08, low=0.9, look=(0.04, 0.02, 1), glance=0.08, iris_r=0.93, pupil_r=0.52, glint=1.0, lid_t=0.01, sclera='#f6efe6')
    lash(C, '#3a2418')
    bz = S.surf_z(C.shape, 0, 0.17)
    up, lo = smile_beak((0, 0.17, bz - 0.03), 0.19, 0.08, 0.08, drop=0.035, lift=0.025)
    # the cape's colours: cream at the throat, gold, then russet ends
    C.region(S.plane((0, 1, 0), -0.2), '#eeb347', 0.3, hair='#f2b848', tip='#ffd66e')
    C.region(S.plane((0, 1, 0), -0.52), '#cf5f26', 0.24, hair='#d4652a', tip='#f08a3c')
    C.region(S.ell((0, -0.3, 0.25), (0.26, 0.2, 0.2)), '#f0e6d4', 0.1, hair='#f8f0e2', tip='#ffffff', length=0.07, align=(0, -1.0, 0.4), clump=0.45)
    blush(C, 0.27, 0.15, 0.075, '#f08a7c')
    C.build()
    red = K.skin('GastonRed', '#c8141f', 0.34, 0.1)
    lobes = []
    for j, h in enumerate((0.085, 0.13, 0.155, 0.13, 0.09)):
        phi = 0.95 - j * 0.42
        d = np.array([0, math.cos(phi), math.sin(phi)])
        p = np.array(hc) + d * (hr[1] - 0.02 + h * 0.75)
        lobes.append(S.ell(p, (0.05, h, 0.085), rot=(phi, 0, 0)))
    ridge = S.tube([np.array(hc) + np.array([0, math.cos(a), math.sin(a)]) * (hr[1] + 0.0) for a in np.linspace(1.1, -0.95, 7)], 0.05, 0.045)
    K.build('GastonComb', S.union(*lobes, ridge, k=0.035), (-0.15, 0.3, -0.5), (0.15, 0.85, 0.5), [red], step=0.004)
    wz = S.surf_z(C.shape, 0, 0.02)
    wattle = S.ell((0.048, 0.0, wz + 0.035), (0.048, 0.095, 0.04), rot=(0, 0, 0.12)).mirror().add(S.ell((0, 0.075, wz + 0.03), (0.05, 0.03, 0.03)), 0.03)
    K.build('GastonWattle', wattle, (-0.15, -0.15, wz - 0.1), (0.15, 0.15, wz + 0.12), [red], step=0.003)
    K.build('GastonBeak', up, (-0.15, 0.0, 0.2), (0.15, 0.3, 0.7), [K.glossy('GastonHorn', '#f6b93a', 0.22)], step=0.0025)
    K.build('GastonBill', lo, (-0.15, 0.0, 0.2), (0.15, 0.3, 0.7), [bpy_mat('GastonHorn')], step=0.0025)
    # teal sickle feathers arching up behind his shoulder
    tails = S.union(plume((0.3, -0.7, -0.36), (0.6, 0.5, -0.42), 0.1, 0.02, bend=(0.2, 0.0, 0)),
                    plume((0.32, -0.7, -0.34), (0.74, 0.22, -0.4), 0.09, 0.02, bend=(0.14, -0.02, 0)),
                    plume((0.34, -0.72, -0.32), (0.8, -0.1, -0.36), 0.08, 0.02, bend=(0.08, -0.04, 0)), k=0.006)
    K.build('GastonTail', tails, (0.1, -0.9, -0.6), (0.9, 0.75, -0.2), [K.principled('GastonPlume', '#0e7468', rough=0.3, coat=0.4, sheen=0.6)], step=0.004)
    # the bow tie
    ty = -0.16
    tz = S.surf_z(C.shape, 0, ty) + 0.03
    wing = S.ell((0.11, ty, tz), (0.11, 0.07, 0.035), rot=(0, 0, 0.1)).sub(S.ell((0.2, ty, tz + 0.04), (0.07, 0.02, 0.03)), 0.02).mirror()
    bow = S.union(wing, S.ell((0, ty, tz + 0.02), (0.04, 0.05, 0.04)), k=0.012)
    K.build('GastonBow', bow, (-0.3, ty - 0.12, tz - 0.1), (0.3, ty + 0.12, tz + 0.12), [K.silk('GastonBlue', '#2456c8')], step=0.003)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = rooster
