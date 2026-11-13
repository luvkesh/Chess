"""Builders for turned (Staunton-like) sets: each piece is traced from its picture and built from
a few kinds of part, with heights given as fractions of the piece's own height in the picture.

spec per piece type:
  {'kind': 'crown', 'zc', 'zp', 'ztip', 'points', 'top': ('cross', z, x_lim) | ('finial', z, r_max) | None,
   'dome': (z0, z1, r, cls) | None, 'ball': r, 'thick': t, 'sharp': p}
      body turned up to zc, an open crown from zc to ztip with `points` points rising from zp.
  {'kind': 'rook', 'merlons': n, 'phase': a, 'depth': d, 'gap': g}
  {'kind': 'knight', 'z0': z, 'thick': t}       turned foot, carved head from the side picture
  {'kind': 'turned'}                             the whole outline turned (bishops, pawns)
  {'kind': 'turned', 'top': ('cross', z, x_lim)} turned, with a flat cross or plume on top
  {'kind': 'turned', 'top': ('relief', z, thick)} turned, with a carved open top (flame loop)
  {'kind': 'figure', 'z0': z, 'thick': t}        turned plinth, carved figure from the front picture
"""
import math

import kit


def crowned(r, sp, others):
    h = r.height()
    zc, zp, ztip = sp['zc'] * h, sp['zp'] * h, sp['ztip'] * h
    points = sp.get('points', 8)
    parts = []
    body = kit.lathe('body', r.profile(0, zc + 0.01))
    kit.set_uv(body, r.t, fold=sp.get('fold', 4))
    parts.append(body)
    prof = [(z, max(w, 0.02)) for z, w in r.profile(zc - 0.01, ztip, step_px=2, tol=0.002)]
    half = math.pi / points
    sharp = sp.get('sharp', 1.1)
    phase = sp.get('phase', 0.0)

    def keep(phi, z):
        if z < zp:
            return True
        # broad petal-shaped points that narrow to a small tip, like the pictures' crowns
        t = min(1.0, max(0.0, (z - zp) / (ztip - zp)))
        return kit.fold_angle(phi - phase, points) < half * (0.92 * (1 - t) ** sharp + 0.07)
    crown = kit.shell('crown', prof, keep, thick=sp.get('thick', 0.026))
    gold = kit.pick([r] + others, 1, (0.1, zc + 0.05))
    kit.set_uv(crown, r.t, fold=2, inner=gold)
    parts.append(crown)
    br = sp.get('ball', 0.022)
    if br:
        tip = ztip - br * 0.6
        rt = r.width(tip - 0.03)
        for i in range(points):
            a = phase + 2 * math.pi * i / points
            b = kit.ball('tip', br, (rt * math.sin(a), -rt * math.cos(a), tip))
            kit.set_uv(b, r.t, mode='point', at=gold)
            parts.append(b)
    if sp.get('dome'):
        z0, z1, rr, cls = sp['dome']
        z0, z1 = max(z0 * h, zp - 0.04), z1 * h
        rr = min(rr, r.width(z0) * 0.8)
        prof = [(z0 + (z1 - z0) * u, rr * max(0.0, 1 - u ** 2.2) ** 0.5) for u in [i / 30 for i in range(31)]]
        d = kit.lathe('dome', prof)
        kit.set_uv(d, r.t, mode='point', at=kit.pick([r] + others, cls, (0.08, 0.6)))
        parts.append(d)
    if sp.get('top'):
        parts.append(topper(r, sp['top']))
    return parts


def topper(r, top):
    h = r.height()
    if top[0] == 'relief':
        # an open carved top (a flame loop round a gem): swollen from its front outline
        f = kit.relief('top', r, top[1] * h - 0.03, thick=top[2], power=top[3] if len(top) > 3 else 0.6)
        kit.set_uv(f, r.t, mode='front', fold=0)
        return f
    if top[0] == 'cross':
        c = kit.slab('cross', r, top[1] * h, depth=top[3] if len(top) > 3 else 0.055, bevel=0.01, x_lim=top[2])
        kit.set_uv(c, r.t, mode='front', fold=0)
        return c
    prof = [(z, min(w, top[2])) for z, w in r.profile(top[1] * h, h, step_px=1)]
    f = kit.lathe('finial', prof)
    kit.set_uv(f, r.t, fold=4)
    return f


def build(t, refs, spec):
    r = refs['w']
    r.t = t
    others = [x for s, x in refs.items() if s != 'w']
    sp = spec.get(t, {'kind': 'turned'})
    kind = sp['kind']
    h = r.height()
    if kind == 'crown':
        parts = crowned(r, sp, others)
    elif kind == 'rook':
        d = sp.get('depth', 0.075)
        body = kit.lathe('body', r.profile(0, h - d), close_top=False)
        kit.set_uv(body, t, fold=sp.get('fold', 4))
        floor = kit.lathe('floor', [(h - d - 0.035, 0.0), (h - d - 0.035, r.width(h - d - 0.045) - 0.04)])
        stone = kit.pick([r] + others, sp.get('lining', 0), (0.1, h * 0.62))
        kit.set_uv(floor, t, mode='point', at=stone)
        prof = r.profile(h - d - 0.015, h, step_px=2, tol=0.002)
        n, ph, gap = sp.get('merlons', 6), sp.get('phase', math.pi / 6), sp.get('gap', 0.58)
        cut = h - d * sp.get('notch', 0.73)

        def keep(phi, z):
            return z < cut or kit.fold_angle(phi - ph, n) < (math.pi / n) * gap
        top = kit.shell('battlement', prof, keep, thick=sp.get('wall', 0.05))
        kit.set_uv(top, t, fold=sp.get('fold', 4), inner=stone, top=stone)
        parts = [body, floor, top]
    elif kind == 'knight':
        z0 = sp.get('z0', 0.28) * h
        base = kit.lathe('base', r.profile(0, z0 + 0.02))
        kit.set_uv(base, t, fold=4)
        head = kit.relief('head', r, z0 - 0.04, thick=sp.get('thick', 0.3), power=sp.get('power', 0.5))
        kit.set_uv(head, t, mode='front', fold=0)
        head.rotation_euler = (0, 0, math.pi / 2)
        parts = [base, head]
    elif kind == 'figure':
        # a carved figure (a robed king or queen) on a turned plinth: the plinth is turned, the
        # figure is swollen from its front outline like the knights' heads
        z0 = sp.get('z0', 0.2) * h
        base = kit.lathe('base', r.profile(0, z0 + 0.02))
        kit.set_uv(base, t, fold=sp.get('fold', 4))
        fig = kit.relief('figure', r, z0 - 0.03, thick=sp.get('thick', 0.5), power=sp.get('power', 0.6))
        kit.set_uv(fig, t, mode='front', fold=0)
        parts = [base, fig]
    else:
        z1 = sp['top'][1] * h if sp.get('top') else h
        body = kit.lathe('body', r.profile(0, z1 + (0.01 if sp.get('top') else 0)))
        kit.set_uv(body, t, fold=sp.get('fold', 4))
        parts = [body]
        if sp.get('top'):
            parts.append(topper(r, sp['top']))
        if sp.get('pearl'):
            # a pearl held in an open carved top: a true ball, painted from the picture's pearl
            zc, rr = sp['pearl'][0] * h, sp['pearl'][1] * h
            b = kit.ball('pearl', rr, (0, 0, zc))
            kit.set_uv(b, t, mode='front', fold=0)
            parts.append(b)
    return kit.join(parts, t)
