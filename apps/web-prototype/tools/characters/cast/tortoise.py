"""tortoise: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def tortoise():
    """Shelly: a tortoise leaning out of her domed shell, scaled green skin, a red-and-white knitted scarf."""
    C = Char('Shelly', '#7ea85e', '#7ea85e', length=0.006, clump=0.0)
    C.mats[0] = K.scales('ShellySkin', '#86b064', 55, 0.42, 0.3, strength=0.35)
    C.furs = []
    head = S.union(S.ell((0, 0.22, 0.04), (0.3, 0.28, 0.29)), S.ell((0, 0.06, 0.2), (0.22, 0.16, 0.18)), k=0.1)
    neck = S.cone((0, 0.0, -0.05), (0, -0.55, -0.15), 0.19, 0.24)
    C.add(head).add(neck, 0.1)
    mc = (0, 0.02, S.surf_z(C.shape, 0, 0.02) - 0.04)
    cav = crease(C.shape, (0, 0.03, 0), 0.13, 0.03)
    C.sub(cav, 0.008)
    C._closed = True
    C._mouth = (mc, 0.14, 0.05, 0.08, 1.2, cav)
    C.sub(S.sphere((0.05, 0.14, S.surf_z(C.shape, 0.05, 0.14)), 0.012).mirror(), 0.005)
    C.eye(0.14, 0.27, 0.07, 0.62, '#3a2410', look=(0.06, -0.05, 1), open_=0.2, tilt=-0.15, low=0.5, lid_t=0.018, iris_r=0.8, sclera='#ece2c8')
    C.region(S.ell((0, -0.3, 0.12), (0.2, 0.4, 0.15)), K.scales('ShellyBelly', '#d8d49a', 30, 0.45, 0.3, strength=0.25), 0.04)
    C.region(cav.grow(0.004), '#2a3a1a', 0.006)
    C.build()
    brows(C, '#f6f2ea', '#ffffff', length=0.07, angle=-0.35, lift=0.35, comb=(1.0, 0.1, 0.5), gravity=0.5, n=200)
    spectacles('Shelly', C.eyes[0][0], C.eyes[0][1], 0.085, half_moon=True, drop=0.03)
    shell = S.ell((0, -0.75, -0.35), (0.85, 0.55, 0.6)).sub(S.ell((0, -0.4, 0.15), (0.32, 0.3, 0.4)), 0.06)
    plate = S.ell((0, -1.05, 0.0), (0.72, 0.3, 0.42))
    so = K.build('ShellyShell', shell, (-1.0, -1.5, -1.0), (1.0, 0.0, 0.5), [K.scales('ShellyScutes', '#a8742a', 4.2, 0.3, 0.05, strength=1.2)], step=0.007)
    K.build('ShellyPlastron', plate, (-1.0, -1.5, -0.6), (1.0, -0.6, 0.5), [K.scales('ShellyPlate', '#e0c47a', 3.5, 0.35, 0.05, strength=0.8)], step=0.007)
    scarf = S.union(S.torus((0, -0.36, -0.06), 0.27, 0.07, rot=(0.3, 0, 0)), S.tube([(0.12, -0.4, 0.22), (0.22, -0.55, 0.3), (0.25, -0.75, 0.32)], 0.07, 0.06), k=0.03).bump(0.01, 14, 2)
    sco = K.build('ShellyScarf', scarf, (-0.5, -0.9, -0.5), (0.5, -0.15, 0.6), [K.stripes('ShellyKnit', '#c8202e', '#f6f0e4', 9, 'Y')], step=0.005)
    K.fuzz(sco, '#e8c8c0', 0.004, 15000)
    return (0.55, 0.12, 3.9), (0, -0.04, 0), 76


build = tortoise
