"""tortoise: one character, one file. build() makes the model in the open Blender scene and returns
its framing (camera location, look-at point, lens). See ../STYLE.md."""
from common import *
from cast._d import *


def tortoise():
    """Shelly: the patient elder. Low, wide silhouette: a broad soft head on a short neck in
    a plump honey-brown shell with a cream tummy plate. Fresh green satin skin with a pale chin and rosy cheeks,
    sleepy kind blue eyes under heavy lids, a long gentle smile, and a chunky coral knitted scarf."""
    C = Char('Shelly', '#86c462', '#86c462')
    bare(C, soft_mat('ShellySkin', '#58ac36', [
        ((0, 0.6, -0.05), (0.5, 0.22, 0.5), '#3c9230', 0.6, False, 0.7),
        ((0.13, 0.52, 0.16), (0.05, 0.04, 0.06), '#35862a', 0.6, True, 0.75),          # freckles on the crown
        ((0.0, 0.56, 0.13), (0.045, 0.035, 0.06), '#35862a', 0.6, False, 0.75),
        ((0.27, 0.47, 0.08), (0.04, 0.035, 0.06), '#35862a', 0.6, True, 0.7),
        ((0, -0.02, 0.24), (0.2, 0.11, 0.2), '#c4e886', 0.55, False, 0.9),            # pale chin and throat
        ((0, -0.3, 0.12), (0.18, 0.3, 0.18), '#c4e886', 0.5, False, 0.8),
        ((0.285, 0.085, 0.2), (0.085, 0.055, 0.08), '#f79aa6', 0.8, True, 0.6),       # cheeks
    ], rough=0.45, sss=0.16, bump=0.05, bump_scale=90, coat=0.08, sheen=0.05))

    cran = S.ell((0, 0.28, 0), (0.385, 0.295, 0.335))
    cheeks = S.ell((0.21, 0.13, 0.08), (0.205, 0.165, 0.2)).mirror()
    muz = S.ell((0, 0.11, 0.26), (0.21, 0.115, 0.125))
    head = S.union(cran, cheeks, muz, k=0.11)
    C.add(head)
    # a short chubby neck into the shell, and two little paws held at the chest
    neck = S.cone((0, 0.05, -0.04), (0, -0.32, -0.05), 0.25, 0.3)
    paws = arms(0.45, 0.35, r=0.072, reach=0.52)
    C.add(neck, 0.1).add(paws)
    my = 0.055
    smile_f = near(crease(C.shape, (0, my, 0), 0.16, 0.05, r=0.012, depth=0.12), (-0.19, 0.02, 0.1), (0.19, 0.13, 0.45), 0.04)
    C.sub(smile_f, 0.007)
    nost = S.union(*[S.sphere((sx * 0.036, 0.16, S.surf_z(C.shape, sx * 0.036, 0.16)), 0.009) for sx in (1, -1)])
    nost = near(nost, (-0.05, 0.14, 0.3), (0.05, 0.18, 0.45), 0.04)
    C.sub(nost, 0.006)
    OPEN, LT, TILT = 0.7, 0.016, 0.0
    C.eye(0.2, 0.235, 0.112, 0.44, '#3f8ed6', look=(0.02, -0.02, 1), open_=OPEN, tilt=TILT, low=0.74, iris_r=0.93, pupil_r=0.52, lid_t=LT,
          sclera='#f8f4e6', glint=0.9)
    C.region(S.union(smile_f, nost).grow(0.004), '#3c6e30', 0.005)
    C.build(step=STEP, lo=(-0.6, -0.8, -0.45), hi=(0.6, 0.62, 0.45), bump=0.0015)
    lash_line(C, '#2c4a26', OPEN, LT, w=0.008, tilt=TILT, lashes=2, lash_len=0.03)
    brows(C, '#fbf8ee', '#ffffff', length=0.045, angle=0.0, lift=0.5, n=120, comb=(1.0, 0.25, 0.5), gravity=0.4, thick=0.016, clump=0.5)

    # the shell: a dome behind the shoulders with pillowed scutes, and a pale rim round the opening
    dc, dr = np.array([0, -0.62, -0.2]), np.array([0.68, 0.66, 0.5])
    dome = S.ell(dc, dr)
    belly = chubby(0.45, 0.35, paws=False)
    n = 26
    k = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * k / n); th = math.pi * (1 + 5 ** 0.5) * k
    seeds = dc + dr * np.column_stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)])

    def groove(P):
        d1 = np.full(len(P), 9.0); d2 = np.full(len(P), 9.0)
        for q in seeds:
            d = np.linalg.norm(P - q, axis=1)
            d2 = np.minimum(d2, np.maximum(d1, d)); d1 = np.minimum(d1, d)
        return (d2 - d1) * 0.5
    gf = S.F(groove)
    plate = S.ell((0, -0.72, 0.3), (0.345, 0.56, 0.3))
    lines = [S.tube([(x, y - 0.03 * (x / 0.3) ** 2, S.surf_z(belly, x, y) - 0.002) for x in np.linspace(-0.3, 0.3, 7)], 0.006, 0.006, n=12) for y in (-0.56, -0.74)]
    lines.append(S.tube([(0, y, S.surf_z(belly, 0, y) - 0.002) for y in np.linspace(-0.3, -0.85, 6)], 0.006, 0.006, n=12))
    lines = near(S.union(*lines), (-0.32, -0.88, 0.1), (0.32, -0.28, 0.4), 0.05)
    shell = S.union(dome.sub(gf.grow(0.013).inter(dome.shell(0.03)), 0.035), belly.sub(lines, 0.012), k=0.04)
    shell_m = soft_mat('ShellyShell', '#b4691e', [((0, 0.2, -0.3), (0.9, 0.7, 0.9), '#e09a3c', 0.8, False, 0.85)], rough=0.3, sss=0.1, coat=0.5,
                       bump=0.04, bump_scale=25, sheen=0.0)
    seam = K.principled('ShellySeam', '#8a4c18', rough=0.45, coat=0.3)
    line_m = K.principled('ShellyLine', '#d8b070', rough=0.45, coat=0.2)
    lip = K.principled('ShellyPlate', '#f6dc9c', rough=0.42, sss=0.15, coat=0.2)
    so = K.build('ShellyShell', shell, (-0.75, -1.3, -0.75), (0.75, 0.1, 0.42), [shell_m, seam, lip, line_m], step=0.008 if PREVIEW else 0.005)
    K.paint(so, [(gf.grow(0.012).inter(dome.shell(0.05)), 1, 0.012), (plate, 2, 0.012), (lines.grow(0.003), 3, 0.006)])
    # the scarf: chunky coral knit, once round the neck, one end hanging at the front
    band = S.torus((0, -0.12, -0.03), 0.26, 0.095, rot=(0.16, 0, 0.06))
    tail = squash(S.tube([(0.1, -0.17, 0.26), (0.13, -0.3, 0.35), (0.12, -0.44, 0.4)], 0.09, 0.08, n=12), (0.12, -0.3, 0.34), 1.0, 1.0, 0.55)
    knot = S.ell((0.1, -0.16, 0.27), (0.1, 0.08, 0.07))
    scarf = S.union(band, tail, knot, k=0.03).bump(0.006, 16, 2)
    knit = K.knit('ShellyKnit', '#d0220e', 75)
    [n for n in knit.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0].inputs['Sheen Weight'].default_value = 0.2
    sco = K.build('ShellyScarf', scarf, (-0.4, -0.66, -0.4), (0.4, 0.02, 0.5), [knit], step=0.005)
    K.fuzz(sco, '#b81c0c', 0.004, 6000 if PREVIEW else 16000)
    return (0.5, 0.16, 3.9), (0, -0.03, 0), 76


build = tortoise
