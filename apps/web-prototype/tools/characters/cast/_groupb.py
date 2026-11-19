"""Helpers for group B (raccoon, cat, wolf, lion, bear): painted appeal eyes with two catchlights,
lash lines, small mouths, a small bust and fluffy tufts. Built on common.py and kit.py without
changing them. See ../STYLE.md."""
from common import *
import bpy
from mathutils import Vector


def lin(h):
    return np.array(K.hexcol(h)[:3])


# ----------------------------------------------------------------------------- eyes
def _eye_image(name, iris, glow, deep, pupil_r, iris_r, oval, sclera, size=384, seed=0):
    """The front of the eye as a picture: a dark upper iris falling to a bright lower crescent,
    fine streaks, a soft dark rim, a big pupil."""
    rng = np.random.default_rng(seed)
    u = np.linspace(-1, 1, size)
    X, Y = np.meshgrid(u, u)
    rho = np.sqrt(X * X + Y * Y)
    ang = np.arctan2(Y, X)
    ci, cg, cd, cs = lin(iris), lin(glow), lin(deep), lin(sclera)
    # vertical fall: dark at the top (under the lid), glowing at the bottom
    g = np.clip((-Y / iris_r + 0.35) / 1.2, 0, 1)
    g = g * g * (3 - 2 * g)
    col = cd[None, None] * (1 - g[..., None]) + ci[None, None] * g[..., None]
    # the lower crescent
    cres = np.clip((-Y / iris_r - 0.05) / 0.8, 0, 1) * np.clip((rho / iris_r - 0.35) / 0.4, 0, 1)
    col = col * (1 - 0.5 * cres[..., None]) + cg[None, None] * 0.5 * cres[..., None]
    # streaks
    st = np.zeros_like(rho)
    for k in range(9):
        st += np.sin(ang * rng.integers(9, 40) + rng.uniform(0, 6.28)) / 9
    col *= (1 + 0.22 * st * np.clip((rho - pupil_r) / 0.2, 0, 1))[..., None]
    # dark rim of the iris
    rim = np.clip((rho / iris_r - 0.8) / 0.2, 0, 1)
    col *= (1 - 0.6 * rim * rim)[..., None]
    # pupil (oval > 1 narrows it sideways, like a cat's in soft light)
    rp = np.sqrt((X * oval) ** 2 + Y * Y)
    p = np.clip((rp - pupil_r) / 0.035 + 0.5, 0, 1)
    col = col * p[..., None] + np.array([0.004, 0.003, 0.004])[None, None] * (1 - p[..., None])
    # sclera outside
    s = np.clip((rho - iris_r) / 0.03 + 0.5, 0, 1)
    col = col * (1 - s[..., None]) + cs[None, None] * s[..., None]
    import os, tempfile
    from PIL import Image
    srgb = np.where(col <= 0.0031308, col * 12.92, 1.055 * np.clip(col, 1e-9, 1) ** (1 / 2.4) - 0.055)
    path = os.path.join(tempfile.gettempdir(), 'eye_%s_%d.png' % (name, os.getpid()))
    Image.fromarray((np.clip(srgb[::-1], 0, 1) * 255).astype(np.uint8)).save(path)
    img = bpy.data.images.load(path)
    img.pack()
    return img


def appeal_eye(name, c, r, look=(0, 0, 1), iris='#a060e8', glow=None, deep=None, pupil_r=0.42, iris_r=0.9, oval=1.0,
               sclera='#f6f1ea', hl=(-0.36, 0.4), hl_size=0.2, hl2=(0.3, -0.36), hl2_size=0.09, emit=0.5, seed=0):
    """A large, living eye: painted iris, wet cornea and two catchlights that stay towards the key
    light. hl / hl2: where the catchlights sit on the eye (fractions of r, right and up)."""
    ci = lin(iris)
    glow = glow or '#%02x%02x%02x' % tuple(int(255 * min(1, x ** (1 / 2.2) * 1.35 + 0.12)) for x in ci)
    deep = deep or '#%02x%02x%02x' % tuple(int(255 * (x * 0.2) ** (1 / 2.2)) for x in ci)
    img = _eye_image(name + 'Img', iris, glow, deep, pupil_r, iris_r, oval, sclera, seed=seed)
    m, nt, out = K._mat(name + 'Ball')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    mp = nt.nodes.new('ShaderNodeMapping')
    mp.inputs['Location'].default_value = (0.5, 0.5, 0)
    mp.inputs['Scale'].default_value = (0.5, 0.5, 1)
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.extension = 'EXTEND'
    nt.links.new(tc.outputs['Object'], mp.inputs['Vector'])
    nt.links.new(mp.outputs['Vector'], tex.inputs['Vector'])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    front = nt.nodes.new('ShaderNodeMath')
    front.operation = 'GREATER_THAN'
    front.inputs[1].default_value = 0.0
    nt.links.new(sep.outputs['Z'], front.inputs[0])
    sel = nt.nodes.new('ShaderNodeMix')
    sel.data_type = 'RGBA'
    sel.inputs['A'].default_value = K.hexcol(sclera)
    nt.links.new(front.outputs[0], sel.inputs['Factor'])
    nt.links.new(tex.outputs['Color'], sel.inputs['B'])
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(sel.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.4
    nt.links.new(sel.outputs['Result'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = emit
    nt.links.new(b.outputs[0], out.inputs[0])

    cm, cnt, cout = K._mat(name + 'Cornea')
    tr = cnt.nodes.new('ShaderNodeBsdfTransparent')
    gl = cnt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = 0.03
    fr = cnt.nodes.new('ShaderNodeFresnel')
    fr.inputs['IOR'].default_value = 1.16
    mx = cnt.nodes.new('ShaderNodeMixShader')
    cnt.links.new(fr.outputs[0], mx.inputs[0])
    cnt.links.new(tr.outputs[0], mx.inputs[1])
    cnt.links.new(gl.outputs[0], mx.inputs[2])
    cnt.links.new(mx.outputs[0], cout.inputs[0])

    lk = Vector(look).normalized()
    rot = K.look_rot((0, 0, 0), -lk)
    for nm, mat, rr in ((name, m, 1.0), (name + 'C', cm, 1.02)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=rr)
        o = bpy.context.active_object
        o.name = nm
        o.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
        o.scale = (r, r, r)
        o.rotation_euler = rot
        o.location = c
    wm = bpy.data.materials.get('CatchWhite')
    if wm is None:
        wm, wnt, wout = K._mat('CatchWhite')
        e = wnt.nodes.new('ShaderNodeEmission')
        e.inputs['Strength'].default_value = 5.0
        wnt.links.new(e.outputs[0], wout.inputs[0])
    for j, (h, hs) in enumerate(((hl, hl_size), (hl2, hl2_size))):
        if not hs:
            continue
        z = math.sqrt(max(1 - h[0] ** 2 - h[1] ** 2, 0.05))
        d = Vector((h[0], h[1], z)).normalized()
        loc = Vector(c) + d * r * 1.03
        bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=1.0)
        o = bpy.context.active_object
        o.name = '%sHL%d' % (name, j)
        o.data.materials.append(wm)
        bpy.ops.object.shade_smooth()
        o.scale = (r * hs, r * hs * (0.85 if j == 0 else 1.0), r * hs * 0.18)
        o.rotation_euler = K.look_rot(loc, loc + d)
        o.location = loc


def eye_set(C, x, y, r, out=0.4, open_=0.62, tilt=0.08, low=0.85, lid_t=0.014, lash=0.2, flick=0.0):
    """Carve the sockets and model the lids for a pair of eyes at +-x. open_ may be a pair
    (right eye, left eye) for a wink or a sly squint. Returns the right eye's centre.
    lash: thickness of the dark upper lash line as a fraction of r; flick: an outer wing."""
    c = np.array(place_eye(C.shape, x, y, r, out))
    op = open_ if isinstance(open_, (tuple, list)) else (open_, open_)
    C.sub(S.sphere(c, r + 0.004).mirror(), 0.02)
    lash_f = []
    for sx, o_ in ((1, op[0]), (-1, op[1])):
        cc = c * np.array([sx, 1, 1])
        C.add(lids(cc, r, o_, tilt, lid_t, low), 0.014)
        if lash:
            n = np.array([-math.sin(tilt) * sx, math.cos(tilt), 0.0])
            band = S.sphere(cc, r + lid_t + 0.004).sub(S.sphere(cc, r + 0.0015))
            band = band.inter(half(cc + n * r * o_, n)).inter(half(cc + n * r * (o_ + lash), -n), 0.004)
            band = band.inter(half(cc - np.array([0, 0, r * 0.1]), (0, 0, 1)))
            lash_f.append(band)
            if flick:
                t = np.array([math.cos(tilt) * sx, math.sin(tilt), 0.0])
                e0 = cc + n * r * (o_ + lash * 0.5) + t * r * 0.8
                e0[2] = cc[2] + r * 0.45
                e1 = e0 + (t * 0.8 + n * 0.5) * r * flick + np.array([0, 0, -r * 0.5 * flick])
                lash_f.append(S.cone(e0, e1, r * lash * 0.45, r * 0.02))
    C.lidf.append(S.sphere(c, r * 1.3).mirror())
    C._eye = (c, r, x, y)
    C._lash = S.union(*lash_f) if lash_f else None
    return c


def eyes_after(C, look=(0.0, 0.0, 1.0), glance=0.0, lash_col='#120c0e', lash_mat=None, **kw):
    """After C.build(): the eyeballs and the lash lines."""
    c, r = C._eye[0], C._eye[1]
    for s in (1, -1):
        appeal_eye('%sEye%d' % (C.name, s), (c[0] * s, c[1], c[2]), r, look=(look[0] * s + glance, look[1], look[2]), seed=3, **kw)
    if C._lash is not None:
        lo = (-(c[0] + r * 2.2), c[1] - r * 1.6, c[2] - r * 1.2)
        hi = ((c[0] + r * 2.2), c[1] + r * 1.8, c[2] + r * 1.6)
        K.build(C.name + 'Lash', C._lash, lo, hi, [lash_mat or K.principled(C.name + 'LashM', lash_col, rough=0.5)], step=0.003)


# ----------------------------------------------------------------------------- mouth and nose
def w_mouth(shape, c, w=0.07, drop=0.03, up=0.012, r=0.006, philtrum=0.04, smirk=0.0):
    """A small cat-like mouth: a short line down from the nose, then a soft curve to each side
    that dips and lifts at the corner (smirk lifts the right corner more)."""
    cx, cy, cz = c

    def on(x, y):
        return (x, y, S.surf_z(shape, x, y) - r * 0.25)
    parts = []
    if philtrum:
        parts.append(S.tube([on(cx, cy + philtrum), on(cx, cy)], r * 0.8, r))
    for sx in (1, -1):
        lift = up + (smirk if sx > 0 else 0.0)
        pts = [on(cx + sx * w * t, cy - drop * math.sin(t * math.pi * 0.62) * 1.05 + lift * t ** 3 * 2.2) for t in np.linspace(0, 1, 7)]
        parts.append(S.tube(pts, r, r * 0.5, k=0.004))
    return S.union(*parts, k=0.005)


def small_nose(shape, y, w=0.035, h=0.024, d=0.026, tri=True):
    """A small nose on the surface at height y: a soft triangle (cats) or an oval."""
    z = S.surf_z(shape, 0, y)
    c = (0, y, z - d * 0.35)
    n = S.ell(c, (w, h, d))
    if tri:
        n = n.inter(half((0, y - h * 0.9, z), (0.62, 1, 0)), 0.012).inter(half((0, y - h * 0.9, z), (-0.62, 1, 0)), 0.012)
    return n, c


# ----------------------------------------------------------------------------- body and fluff
def small_bust(w=0.3, y=-0.72, d=0.25, neck=0.17):
    """A small, soft bust under a big head: a short narrow neck and sloping little shoulders."""
    nk = S.cone((0, -0.1, -0.03), (0, y + 0.2, -0.05), neck, neck * 1.25)
    chest = S.ell((0, y, -0.05), (w, 0.36, d))
    return S.union(nk, chest, k=0.14)


def tufts(C, name, field, n, length, comb, col, tip=None, soft=0.03, gravity=0.2, lift=0.7, clumps=30, clump=0.75,
          jitter=0.18, root=0.0045, curl=0.0, mirror=True, seed=0, var=0.15, rough=0.4, thresh=0.5):
    """Groomed locks of longer fur over a zone (cheek ruffs, chest fluff, a mane): they leave the
    skin along `comb` (given for the right side and mirrored), and gather into soft pointed locks."""
    w = C.weight(field, soft)
    P, N = K.sample_surface(C.o, w, n, seed=seed, thresh=thresh)
    out, Ns = [], []
    sides = (1, -1) if mirror else (0,)
    for sx in sides:
        m = (np.sign(P[:, 0]) == sx) if sx else np.ones(len(P), bool)
        if sx == 1:
            m |= P[:, 0] == 0
        if m.sum() < 4:
            continue
        cb = (comb[0] * (sx or 1), comb[1], comb[2])
        out += K.groom(P[m], N[m], length, cb, gravity=gravity, lift=lift, clumps=max(2, clumps // len(sides)), clump=clump,
                       jitter=jitter, seed=seed + (1 if sx > 0 else 2), curl=curl)
        Ns.append(N[m])
    return K.strands(C.name + name, out, K.hair_mat(C.name + name + 'M', col, tip, rough=rough, var=var), root, root * 0.15,
                     normals=np.concatenate(Ns))


def whiskers(C, base, n=3, length=0.26, col='#f4f0e8', spread=0.16, droop=0.05, root=0.0022):
    paths = []
    for sx in (1, -1):
        for j in range(n):
            a = (j - (n - 1) / 2) * spread
            p0 = np.array([sx * base[0], base[1] - j * 0.012, base[2]])
            paths.append(np.array([p0 + np.array([sx * length * t * math.cos(a), length * t * math.sin(a) - droop * t * t, -0.06 * t * t]) for t in np.linspace(0, 1, 8)]))
    K.strands(C.name + 'Whiskers', paths, K.principled(C.name + 'Whisker', col, rough=0.35), root, 0.0005)


def blush(C, x, y, col, r=0.07, soft=0.05, hair=None):
    """A soft warm cheek patch."""
    z = S.surf_z(C.shape, x, y)
    C.region(S.ell((x, y, z), (r, r * 0.7, r)).mirror(), col, soft, hair=hair or col, length=None)


def brows_b(C, *a, **kw):
    """common.brows over this group's eyes."""
    C.eyes = [(tuple(C._eye[0]), C._eye[1])]
    brows(C, *a, **kw)
    C.eyes = []


def clear(C, field):
    """Keep the long coat off a small feature (nose, mouth) so it reads cleanly."""
    C.lidf.append(field)
