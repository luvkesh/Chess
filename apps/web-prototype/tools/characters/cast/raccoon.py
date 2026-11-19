"""raccoon: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from cast._groupb import *


def raccoon():
    """Rocco: the sly little magician. A wide wedge of a face with pointed cheek ruffs, a bandit
    mask, violet eyes with one lid lowered, a smirk, and a small silk top hat tipped over one ear."""
    C = Char('Rocco', '#6e665e', '#9a9088', '#ddd4c8', length=0.045, align=(0, -0.55, 0.05), clump=0.22)
    head = S.union(S.ell((0, 0.2, 0), (0.41, 0.37, 0.36)),
                   S.ell((0.27, 0.04, 0.06), (0.21, 0.15, 0.2), rot=(0, 0, -0.35)).mirror(),
                   S.ell((0, 0.02, 0.27), (0.13, 0.095, 0.12)), k=0.1)
    C.add(head)
    ears = []
    for sx in (1, -1):
        e, cut = ear((sx * 0.25, 0.48, -0.04), (sx * 0.36, 0.64, -0.06), 0.12, 0.075, thick=0.05, cup=0.55)
        C.add(e, 0.05).sub(cut, 0.02)
        ears.append(cut)
    body = chubby(0.44, 0.35)
    C.add(body, 0.1)
    nose, nose_c = small_nose(C.shape, 0.065, 0.036, 0.026, 0.028, tri=False)
    C.add(nose, 0.008)
    mouth = w_mouth(C.shape, (0, -0.005, 0), 0.075, 0.022, 0.016, smirk=0.035, philtrum=0.035, r=0.0105)
    C.sub(mouth, 0.006)
    c = eye_set(C, 0.185, 0.17, 0.118, out=0.42, open_=(0.46, 0.6), tilt=0.3, lash=0.22)
    # markings: white muzzle and brows, the mask sweeping out to the ruffs, dark ear rims
    C.region(S.ell((0, 0.0, 0.3), (0.2, 0.13, 0.16)), '#e4dccf', 0.05, hair='#e6dfd2', tip='#f6f1e8', length=0.028)
    C.region(S.ell((0.36, -0.02, 0.05), (0.17, 0.14, 0.2)).mirror(), '#e4dccf', 0.05, hair='#e6dfd2', tip='#f6f1e8', length=0.05, align=(1.0, -0.5, 0.1), clump=0.4)
    mask = S.union(S.ell((0.2, 0.18, 0.2), (0.23, 0.155, 0.26), rot=(0, 0, -0.3)), S.ell((0.36, 0.1, 0.05), (0.12, 0.09, 0.16), rot=(0, 0, -0.5)), k=0.05).mirror()
    C.region(mask, '#241f28', 0.035, hair='#2e2832', tip='#4a4250', length=0.03, align=(0.3, -0.5, 0.1), dens=1.4)
    C.region(S.ell((0, 0.2, 0.3), (0.035, 0.11, 0.12)), '#3a3238', 0.03, hair='#4a4046', tip='#6a5e62', length=0.02)
    C.region(S.ell((0, -0.46, 0.26), (0.24, 0.3, 0.2)), '#e4dccf', 0.06, hair='#e6dfd2', tip='#f6f1e8', length=0.06, align=(0, -0.8, 0.3), clump=0.4)
    C.region(S.union(*ears).grow(0.012), '#3a2c30', 0.02)
    C.region(S.ell(nose_c, (0.04, 0.03, 0.034)), K.glossy('RoccoNose', '#1a1418', 0.2), 0.006)
    C.region(mouth.grow(0.004), '#2a1a1e', 0.004)
    clear(C, S.union(mouth.grow(0.012), S.ell(nose_c, (0.055, 0.045, 0.05))))
    C.build()
    eyes_after(C, look=(0.05, 0.02, 1), glance=0.08, iris='#9a58e6', glow='#e6b8ff', iris_r=0.95, hl=(-0.3, 0.2), hl_size=0.2, hl2=(0.34, -0.3))
    tufts(C, 'Ruff', S.ell((0.42, 0.0, 0.0), (0.14, 0.16, 0.2)).mirror(), 800, 0.09, (1.0, -0.45, 0.15), '#e6dfd2', '#f6f1e8', gravity=0.15, clumps=18, lift=0.5, seed=5)
    whiskers(C, (0.1, 0.01, 0.34), 3, 0.24)
    tie = S.union(S.ell((0.066, -0.25, 0.0), (0.075, 0.046, 0.032), rot=(0, 0, 0.3)), S.ell((-0.066, -0.25, 0.0), (0.075, 0.046, 0.032), rot=(0, 0, -0.3)), S.sphere((0, -0.25, 0.01), 0.028), k=0.012).move(0, 0, S.surf_z(body, 0, -0.25) + 0.045)
    K.build('RoccoTie', tie, (-0.2, -0.36, 0.1), (0.2, -0.14, 0.6), [K.silk('RoccoRed', '#c8143c')], step=0.003)
    piv = (0.2, 0.52, 0)
    hc = (0.2, 0.7, -0.02)
    hat = S.union(S.cyl(hc, 0.125, 0.12, round_=0.02), S.cyl((hc[0], 0.585, hc[2]), 0.2, 0.01, round_=0.008), k=0.02).rot(0.1, 0, -0.42, about=piv)
    band = S.cyl((hc[0], 0.622, hc[2]), 0.13, 0.028).rot(0.1, 0, -0.42, about=piv)
    K.build('RoccoHat', hat, (-0.1, 0.4, -0.4), (0.7, 1.0, 0.35), [K.principled('RoccoSilkHat', '#17141c', rough=0.28, sheen=0.4, aniso=0.5)], step=0.004)
    K.build('RoccoBand', band, (-0.1, 0.4, -0.4), (0.7, 1.0, 0.35), [K.silk('RoccoBandRed', '#c8143c')], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 74


build = raccoon
