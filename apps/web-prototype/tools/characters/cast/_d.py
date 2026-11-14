"""Helpers shared by group D only (tortoise, giraffe, elephant, dragon): soft painted skin,
catchlights, lash lines. Kept here so the shared kit stays untouched. See ../STYLE.md."""
from common import *


def soft_mat(name, base, patches=(), rough=0.5, sss=0.2, bump=0.0, bump_scale=60.0, coat=0.0, sheen=0.25,
             sss_radius=(1.0, 0.45, 0.3)):
    """Skin painted with soft-edged colour patches (blush, pale muzzle, ear lining), in the
    shader, so there are no hard paint borders. patches: (centre, radii, colour, softness 0..1,
    mirror across x, strength)."""
    m = K.principled(name, base, rough=rough, sss=sss, bump=bump, bump_scale=bump_scale, coat=coat, sheen=sheen,
                     sss_radius=sss_radius)
    nt = m.node_tree
    b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    ab = nt.nodes.new('ShaderNodeMath'); ab.operation = 'ABSOLUTE'
    nt.links.new(sep.outputs['X'], ab.inputs[0])
    mir = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(ab.outputs[0], mir.inputs['X'])
    nt.links.new(sep.outputs['Y'], mir.inputs['Y'])
    nt.links.new(sep.outputs['Z'], mir.inputs['Z'])
    prev = None
    for p in patches:
        c, r, col, soft = p[0], p[1], p[2], p[3]
        mirror = p[4] if len(p) > 4 else False
        strength = p[5] if len(p) > 5 else 1.0
        sub = nt.nodes.new('ShaderNodeVectorMath'); sub.operation = 'SUBTRACT'
        nt.links.new((mir if mirror else tc).outputs[0 if mirror else 'Object'], sub.inputs[0])
        sub.inputs[1].default_value = tuple(c)
        div = nt.nodes.new('ShaderNodeVectorMath'); div.operation = 'DIVIDE'
        nt.links.new(sub.outputs[0], div.inputs[0])
        div.inputs[1].default_value = tuple(r) if not np.isscalar(r) else (r, r, r)
        ln = nt.nodes.new('ShaderNodeVectorMath'); ln.operation = 'LENGTH'
        nt.links.new(div.outputs[0], ln.inputs[0])
        mr = nt.nodes.new('ShaderNodeMapRange')
        mr.interpolation_type = 'SMOOTHSTEP'
        mr.inputs['From Min'].default_value = 1 - soft
        mr.inputs['From Max'].default_value = 1 + soft
        mr.inputs['To Min'].default_value = strength
        mr.inputs['To Max'].default_value = 0.0
        nt.links.new(ln.outputs['Value'], mr.inputs['Value'])
        mix = nt.nodes.new('ShaderNodeMix'); mix.data_type = 'RGBA'
        if prev is None:
            mix.inputs['A'].default_value = K.hexcol(base)
        else:
            nt.links.new(prev, mix.inputs['A'])
        mix.inputs['B'].default_value = K.hexcol(col)
        nt.links.new(mr.outputs['Result'], mix.inputs['Factor'])
        prev = mix.outputs['Result']
    if prev is not None:
        nt.links.new(prev, b.inputs['Base Color'])
    return m


def glow(name, col='#ffffff', power=5.0):
    return K.principled(name, col, rough=0.3, emission=(col, power))


def lash_line(C, col='#1a1010', open_=0.9, lid_t=0.012, w=0.007, a0=-1.25, a1=1.35, flick=0.0, lashes=0, lash_len=0.035, name=None, tilt=0.0):
    """A dark line along the upper lid edge, thicker toward the outer corner, with an optional
    outer flick and a few lashes. Call after C.build() with the same open_, lid_t and tilt as C.eye."""
    c, r = C.eyes[0][0], C.eyes[0][1]
    R = r + lid_t + 0.001
    h = min(r * open_, R * 0.93)
    rho = math.sqrt(R * R - h * h)
    ext = r * 1.5 + max(lash_len, flick)
    nm = name or C.name + 'Lash'
    ink = K.principled(nm + 'Ink', col, rough=0.6)
    for s in (1, -1):
        def pt(a, lift=0.0, out=0.0):
            x = (rho + out) * math.sin(a)
            return (s * (c[0] + x), c[1] + h + lift + math.tan(tilt) * x, c[2] + (rho + out) * math.cos(a))
        pts = [pt(a) for a in np.linspace(a0, a1, 7)]
        parts = [S.tube(pts[:4], w * 0.45, w * 0.9, n=9), S.tube(pts[3:], w * 0.9, w, n=9)]
        if flick:
            parts.append(S.tube([pt(a1), pt(a1 + 0.12, flick * 0.5, flick * 0.5), pt(a1 + 0.2, flick, flick)], w, w * 0.2, n=6))
        for a in (np.linspace(a1 - 0.9, a1, lashes) if lashes else []):
            parts.append(S.tube([pt(a), pt(a + 0.05, lash_len * 0.55, lash_len * 0.5), pt(a + 0.12, lash_len, lash_len * 0.8)], w * 0.5, w * 0.12, n=6))
        cx = s * c[0]
        K.build('%s%d' % (nm, s), S.union(*parts), (cx - ext, c[1] - r * 0.2, c[2] - r * 0.3), (cx + ext, c[1] + ext, c[2] + ext), [ink], step=0.003)


def bare(C, mat):
    """A hairless character: one painted skin, no coat."""
    C.mats[0] = mat
    C.furs = []
    return C


import os
# CHAR_PREVIEW=1 sculpts on a coarser grid (about five times faster) while a character is being shaped
PREVIEW = bool(os.environ.get('CHAR_PREVIEW'))
STEP = 0.011 if PREVIEW else 0.006


def near(f, lo, hi, pad=0.12):
    """Evaluate a detail only inside its own box (grown by pad); far from it the field just
    reports 'far away'. Keeps small parts from being computed over the whole sculpting volume.
    pad must be larger than any blend radius used with the part."""
    lo, hi = np.asarray(lo, float) - pad, np.asarray(hi, float) + pad

    def g(P):
        m = np.all((P >= lo) & (P <= hi), axis=1)
        out = np.full(len(P), pad)
        if m.any():
            out[m] = f(P[m])
        return out
    return S.F(g)


def specs(name, ec, er, rim=0.14, col='#f2c050', wire=0.0085, gap=0.035):
    """Big round gold spectacles in front of the eyes (ec is one eye's centre): each part is meshed
    in its own small box, so they build in seconds. No glass: at portrait size a lens only adds
    glare over the eyes."""
    gold = K.gold(name + 'SpecGold', col)
    z = ec[2] + er + gap
    y = ec[1] - 0.004
    for sx in (1, -1):
        c = (sx * ec[0], y, z)
        K.build('%sRim%d' % (name, sx), S.torus(c, rim, wire, rot=(math.pi / 2, 0, 0)), (c[0] - rim - 0.02, y - rim - 0.02, z - 0.02), (c[0] + rim + 0.02, y + rim + 0.02, z + 0.02), [gold], step=0.003)
        arm = S.tube([(sx * (ec[0] + rim), y, z), (sx * (ec[0] + rim + 0.05), y + 0.015, z - 0.14), (sx * (ec[0] + rim + 0.04), y + 0.01, z - 0.34)], wire * 0.75, wire * 0.75, n=8)
        x0, x1 = sorted((sx * (ec[0] + rim - 0.02), sx * (ec[0] + rim + 0.07)))
        K.build('%sArm%d' % (name, sx), arm, (x0, y - 0.03, z - 0.36), (x1, y + 0.04, z + 0.02), [gold], step=0.003)
    b = ec[0] - rim
    bridge = S.tube([(-b, y + 0.02, z), (0, y + 0.045, z + 0.012), (b, y + 0.02, z)], wire * 0.85, wire * 0.85, n=8)
    K.build(name + 'Bridge', bridge, (-b - 0.02, y, z - 0.02), (b + 0.02, y + 0.07, z + 0.03), [gold], step=0.0025)


def arms(w=0.46, d=0.36, top=-0.08, r=0.07, reach=0.45):
    """Two short arms on a chubby() body: from the side of the tummy round to a little paw held
    at the chest, so the paws read as arms and not as two balls."""
    a = S.tube([(w * 0.86, top - 0.2, d * 0.2), (w * 0.8, top - 0.36, d * 0.6), (w * reach, top - 0.43, d * 0.9)], r, r * 1.12, n=12)
    return near(a, (w * reach - r * 1.3, top - 0.55, 0.0), (w + r, top - 0.1, d + r * 1.3), 0.1).mirror()
