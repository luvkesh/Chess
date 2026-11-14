"""squirrel: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *


def squirrel():
    """Zippy: a racing squirrel: tufted ears, a huge plume of a tail, a terry headband and a track jacket."""
    C = Char('Zippy', '#7a3610', '#c8641e', '#ec9a4a', length=0.026, align=(0, -0.5, -0.15), clump=0.14)
    head, mu = critter_head((0, 0.2, 0), (0.31, 0.32, 0.3), 0.22, (0.11, 0.085, 0.1), 0.02, 0.28, taper=0.25, cheek_y=0.5)
    C.add(head)
    for sx in (1, -1):
        e, cut = ear((sx * 0.18, 0.42, -0.04), (sx * 0.25, 0.66, -0.06), 0.085, 0.02, thick=0.04)
        C.add(e, 0.04).sub(cut, 0.015)
    body = torso(-0.5, 0.56, 0.26)
    C.add(body, 0.18)
    tail_path = [(0.35, -0.85, -0.45), (0.62, -0.4, -0.5), (0.66, 0.15, -0.42), (0.5, 0.55, -0.32), (0.3, 0.7, -0.3)]
    tail = S.tube(tail_path, 0.12, 0.09, k=0.03)
    C.add(tail, 0.05)
    face_basics(C, 0.1, -0.02, (0.04, 0.028, 0.034), 0.085, 0.05, 0.07, 1.0, '#2a1410')
    zc = C.eye(0.145, 0.25, 0.1, 0.64, '#1a100a', look=(0.06, 0.05, 1), glance=-0.12, sclera=BEAD, iris_r=0.72, pupil_r=0.45, open_=1.0, low=0.7)
    C.region(S.sphere(zc, 0.15).mirror(), '#f4e4cc', 0.03, hair='#fff2de', tip='#ffffff', length=0.012)
    C.region(S.ell((0, 0.03, 0.26), (0.18, 0.13, 0.14)), '#f0dcc0', 0.04, hair='#f6e6cc', tip='#fff6e6', length=0.018)
    C.region(S.ell((0.21, 0.52, 0.0), (0.05, 0.1, 0.1)).mirror(), '#c8641e', 0.02)
    C.region(tail.grow(0.02), '#a8501a', 0.03, hair='#c4601c', tip='#f4a85a', length=0.12, align=(0, 1.2, 0.2), clump=0.45, dens=0.5)
    face_regions(C)
    jacket = garment(body, -0.36, 0.035, (0.3, 0.12))
    C.region(jacket.grow(0.02), '#222222', 0.01)
    C.build()
    mouth_after(C, top_teeth=False)
    teeth = S.union(*[S.box((sx * 0.018, C._mouth[0][1] + 0.0, C._mouth[0][2] + 0.04), (0.016, 0.03, 0.009), 0.006, rot=(0.3, 0, 0)) for sx in (1, -1)])
    K.build('ZippyTeeth', teeth, (-0.1, -0.12, 0.2), (0.1, 0.06, 0.45), [K.glossy('ZippyTooth', '#fdf6e8', 0.14)], step=0.0025)
    # ear tufts
    for sx in (1, -1):
        P = np.array([[sx * (0.25 + 0.012 * np.cos(a)), 0.65 + 0.01 * np.sin(a), -0.06] for a in np.linspace(0, 6.28, 40)])
        N = np.tile([[sx * 0.2, 1.0, 0.0]], (40, 1)); N /= np.linalg.norm(N, axis=1)[:, None]
        K.strands('ZippyTuft%d' % sx, K.groom(P, N, 0.09, (sx * 0.2, 0.8, 0), gravity=-0.2, clumps=3, clump=0.85, jitter=0.2, seed=5), bpy_mat('ZippyHair0'), 0.004, 0.0006)
    K.build('ZippyJacket', jacket, (-0.8, -1.3, -0.6), (0.8, -0.3, 0.6), [K.stripes('ZippyTrack', '#c8141e', '#f6f2ea', 2.2, 'X', knitted=False)], step=0.006)
    zip_ = S.box((0, -0.62, S.surf_z(jacket, 0, -0.62) - 0.01), (0.012, 0.28, 0.01), 0.004)
    hb = S.torus((0, 0.36, -0.02), 0.335, 0.035, rot=(-0.25, 0, 0))
    hb_o = K.build('ZippyBand', hb, (-0.5, 0.2, -0.5), (0.5, 0.6, 0.5), [K.stripes('ZippyTerry', '#d81e2a', '#ffffff', 22, 'Y')], step=0.004)
    K.fuzz(hb_o, '#e8e0dc', 0.004, 9000)
    return (0.55, 0.12, 3.9), (0, 0.02, 0), 76


build = squirrel
