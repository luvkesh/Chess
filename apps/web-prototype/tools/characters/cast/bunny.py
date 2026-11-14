"""bunny: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def bunny():
    """Truffle: a cream bunny with long ears (one folding forward), buck teeth, a pink silk bow
    and a rose neckerchief."""
    C = Char('Truffle', '#e8d6cc', '#f4ebe2', '#fffaf4', length=0.03, align=(0, -0.4, 0), clump=0.12, var=0.08)
    head, mu = critter_head((0, 0.22, 0), (0.33, 0.34, 0.32), 0.21, (0.14, 0.1, 0.1), 0.02, 0.27, taper=0.18)
    C.add(head)
    upright = squash(S.tube([(0.13, 0.48, -0.06), (0.17, 0.75, -0.08), (0.19, 1.02, -0.06)], 0.085, 0.075, k=0.02), (0.17, 0.75, -0.07), 1.0, 1.0, 0.45)
    fold = squash(S.tube([(-0.13, 0.48, -0.06), (-0.22, 0.72, -0.02), (-0.33, 0.86, 0.1), (-0.4, 0.8, 0.24)], 0.085, 0.07, k=0.02), (-0.25, 0.75, 0.0), 1.0, 0.7, 0.6)
    C.add(upright, 0.06).add(fold, 0.06)
    inner_u = squash(S.tube([(0.135, 0.56, 0.0), (0.172, 0.76, -0.02), (0.188, 0.97, 0.0)], 0.05, 0.035), (0.17, 0.75, 0.0), 1, 1, 0.5).move(0, 0, 0.012)
    C.sub(inner_u, 0.02)
    body = torso(-0.5, 0.66, 0.3)
    C.add(body, 0.18)
    nose_c = (0, 0.1, S.surf_z(C.shape, 0, 0.1) - 0.012)
    C.add(S.ell(nose_c, (0.042, 0.028, 0.03)), 0.01)
    mc = (0, -0.04, S.surf_z(C.shape, 0, -0.04) - 0.03)
    cav = crease(C.shape, (0, -0.02, 0), 0.07, 0.028)
    C.sub(cav, 0.008)
    C.eye(0.15, 0.28, 0.118, 0.6, '#3f80d8', look=(0.0, 0.1, 1), iris_r=0.84, pupil_r=0.42, open_=0.97)
    C.region(S.ell((0.2, 0.06, 0.2), (0.08, 0.06, 0.06)).mirror(), '#f2b4c0', 0.05, hair='#f6c4cc', tip='#fde4e8', length=0.022)
    C.region(S.ell(mu.fn and (0, 0.0, 0.28), (0.16, 0.13, 0.12)) if False else S.ell((0, 0.0, 0.28), (0.17, 0.13, 0.13)), '#f7f0ea', 0.04, hair='#fffdf9', tip='#ffffff', length=0.02)
    C.region(inner_u.grow(0.014), '#f2a6b4', 0.012)
    C.region(S.ell(nose_c, (0.05, 0.035, 0.04)), K.glossy('TruffleNose', '#e9788f', 0.25), 0.008)
    C.region(cav.grow(0.006), '#b84a5c', 0.006)
    band = S.torus((0, -0.33, -0.05), 0.33, 0.055, rot=(0.25, 0, 0)).bump(0.01, 16, 2)
    point = squash(S.cone((0, -0.36, 0.3), (0.0, -0.6, 0.4), 0.12, 0.02), (0, -0.45, 0.34), 1.0, 1.0, 0.35)
    scarf = S.union(band, point, k=0.04)
    C.region(scarf.grow(0.02), '#222222', 0.01)
    o = C.build(lo=(-0.85, -1.3, -0.85), hi=(0.85, 1.15, 0.85))
    tz = S.surf_z(C.shape, 0, -0.055)
    teeth = S.union(*[S.box((sx * 0.021, -0.058, tz - 0.004), (0.019, 0.03, 0.009), 0.008, rot=(0.35, 0, 0)) for sx in (1, -1)])
    K.build('TruffleTeeth', teeth, (-0.1, -0.15, 0.2), (0.1, 0.05, 0.45), [K.glossy('TruffleTooth', '#fffbf4', 0.12)], step=0.0025)
    # the silk bow on the upright ear
    bow = S.union(S.ell((0.1, 0.62, 0.0), (0.075, 0.045, 0.03), rot=(0, 0, 0.35)), S.ell((0.25, 0.62, 0.0), (0.075, 0.045, 0.03), rot=(0, 0, -0.35)),
                  S.sphere((0.175, 0.62, 0.02), 0.03), k=0.015).rot(0, 0, 0.15, about=(0.175, 0.62, 0))
    K.build('TruffleBow', bow, (-0.05, 0.5, -0.1), (0.4, 0.75, 0.15), [K.silk('TruffleSilk', '#e04a78')], step=0.003)
    # the rose neckerchief: a soft band and a point at the front
    nk = K.build('TruffleScarf', scarf, (-0.5, -1.0, -0.5), (0.5, -0.3, 0.6), [K.silk('TruffleRose', '#c8325c')], step=0.005)
    return (0.55, 0.15, 3.9), (0, 0.0, 0), 76


build = bunny
