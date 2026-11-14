"""raccoon: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def raccoon():
    """Rocco: a raccoon magician: black mask, white brows and muzzle, cheek ruffs, a silk top hat
    with a red band, a tailcoat and a red bow tie."""
    C = Char('Rocco', '#5a5e68', '#8c909a', '#c8ccd4', length=0.026, align=(0, -0.5, -0.1), clump=0.12)
    head, mu = critter_head((0, 0.22, 0), (0.37, 0.3, 0.3), 0.2, (0.1, 0.08, 0.17), 0.03, 0.33, taper=-0.15)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.22, 0.42, -0.04), (sx * 0.33, 0.66, -0.06), 0.1, 0.03, thick=0.045)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    nose_c = (0, 0.12, S.surf_z(C.shape, 0, 0.12) - 0.02)
    C.add(button_nose(nose_c, 0.05, 0.034, 0.04), 0.01)
    mc = (0, 0.0, S.surf_z(C.shape, 0, 0.0) - 0.035)
    cav = crease(C.shape, (0, 0.01, 0), 0.1, 0.02, smirk=0.06)
    C.sub(cav, 0.008)
    C.eye(0.15, 0.26, 0.095, 0.6, '#e8a818', look=(0.06, 0.02, 1), glance=0.32, open_=0.55, tilt=0.2, low=0.5, iris_r=0.82, pupil_r=0.26)
    mask = S.union(S.ell((0.15, 0.25, 0.22), (0.15, 0.1, 0.16), rot=(0, 0, -0.25)).mirror(), S.ell((0, 0.27, 0.27), (0.06, 0.05, 0.08)), k=0.04)
    C.region(S.ell((0, 0.06, 0.26), (0.19, 0.14, 0.14)), '#e8e6e2', 0.04, hair='#f4f2ee', tip='#ffffff', length=0.02)
    C.region(S.ell((0.22, 0.03, 0.12), (0.12, 0.12, 0.16)).mirror(), '#e8e6e2', 0.04, hair='#f0eeea', tip='#ffffff', length=0.06, align=(0.9, -0.4, 0.2), clump=0.4)
    C.region(mask, '#181a1e', 0.03, hair='#24262c', tip='#3a3c44', length=0.018)
    C.region(S.ell((0.14, 0.4, 0.22), (0.08, 0.03, 0.06), rot=(0, 0, -0.15)).mirror(), '#e8e6e2', 0.02, hair='#f6f4f0', tip='#ffffff', length=0.03)
    C.region(S.ell((0.27, 0.6, 0.0), (0.06, 0.12, 0.09)).mirror(), '#222222', 0.03, hair='#2a2c30', length=0.02)
    C.region(S.ell(nose_c, (0.058, 0.042, 0.05)), K.glossy('RoccoNose', '#141414', 0.22), 0.008)
    C.region(cav.grow(0.004), '#141414', 0.006)
    jacket = garment(body, -0.42, 0.035, (0.36, 0.2))
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    brows(C, '#f6f4f0', '#ffffff', length=0.045, angle=-0.15, lift=0.45, comb=(1.0, 0.5, 0.3), gravity=-0.1)
    K.build('RoccoCoat', jacket, (-0.8, -1.3, -0.6), (0.8, -0.4, 0.6), [K.principled('RoccoWool', '#16161c', rough=0.55, sheen=0.4, bump=0.05, bump_scale=600)], step=0.006)
    shirt = body.grow(0.02).inter(S.plane((0, 1, 0), -0.4)).inter(S.plane((0, 0, -1), -0.05))
    K.build('RoccoShirt', shirt, (-0.4, -1.3, -0.2), (0.4, -0.4, 0.6), [K.principled('RoccoLinen', '#f4f2ec', rough=0.6, bump=0.05)], step=0.006)
    tie = S.union(S.ell((0.07, -0.44, 0.33), (0.075, 0.045, 0.035), rot=(0, 0, 0.25)), S.ell((-0.07, -0.44, 0.33), (0.075, 0.045, 0.035), rot=(0, 0, -0.25)), S.sphere((0, -0.44, 0.34), 0.03), k=0.015)
    K.build('RoccoTie', tie, (-0.2, -0.6, 0.15), (0.2, -0.3, 0.5), [K.silk('RoccoRed', '#c0102a')], step=0.003)
    hat_c = (0.06, 0.66, -0.02)
    hat = S.union(S.cyl(hat_c, 0.21, 0.2, round_=0.02), S.cyl((hat_c[0], 0.47, hat_c[2]), 0.33, 0.012, round_=0.01), k=0.02).rot(0, 0, -0.18, about=(0.06, 0.45, 0))
    band = S.cyl((hat_c[0], 0.52, hat_c[2]), 0.218, 0.04).rot(0, 0, -0.18, about=(0.06, 0.45, 0))
    K.build('RoccoHat', hat, (-0.4, 0.4, -0.4), (0.5, 0.95, 0.4), [K.principled('RoccoSilkHat', '#121216', rough=0.25, sheen=0.3, aniso=0.6)], step=0.004)
    K.build('RoccoBand', band, (-0.4, 0.4, -0.4), (0.5, 0.65, 0.4), [K.silk('RoccoBandRed', '#a8102a')], step=0.004)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 74


build = raccoon
