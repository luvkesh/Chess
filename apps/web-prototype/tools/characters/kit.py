"""Blender helpers for the character models: meshes from sculpted fields, painted regions,
groomed fur, living eyes, cloth/gold/gem materials, the studio and the render.

Runs inside Blender's Python (the `bpy` module from PyPI works headless):
    /opt/bv/bin/python tools/characters/render.py horse
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

import sdf


# ----------------------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    sc.render.film_transparent = True
    w = bpy.data.worlds.new('World')
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.06, 0.045, 0.04, 1)
    bg.inputs[1].default_value = 1.0
    return sc


def hexcol(h, a=1.0):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return (*lin, a)


# ----------------------------------------------------------------------------- materials
def _mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    return m, nt, out


def _set(node, **kw):
    for k, v in kw.items():
        node.inputs[k].default_value = v


def principled(name, color, rough=0.5, metal=0.0, sss=0.0, sss_radius=(1.0, 0.4, 0.25), sheen=0.0,
               sheen_tint=(1, 1, 1, 1), coat=0.0, spec=0.5, bump=0.0, bump_scale=60.0, transmission=0.0,
               ior=1.45, emission=None, aniso=0.0):
    m, nt, out = _mat(name)
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    _set(b, **{'Base Color': hexcol(color) if isinstance(color, str) else color, 'Roughness': rough,
               'Metallic': metal, 'Subsurface Weight': sss, 'Sheen Weight': sheen, 'Sheen Tint': sheen_tint,
               'Coat Weight': coat, 'Specular IOR Level': spec, 'Transmission Weight': transmission, 'IOR': ior,
               'Anisotropic': aniso})
    if sss:
        b.inputs['Subsurface Radius'].default_value = sss_radius
        b.inputs['Subsurface Scale'].default_value = 0.03
    if emission:
        b.inputs['Emission Color'].default_value = hexcol(emission[0])
        b.inputs['Emission Strength'].default_value = emission[1]
    if bump:
        tc = nt.nodes.new('ShaderNodeTexCoord')
        nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = bump_scale
        nz.inputs['Detail'].default_value = 6
        bn = nt.nodes.new('ShaderNodeBump')
        bn.inputs['Strength'].default_value = bump
        bn.inputs['Distance'].default_value = 0.02
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        nt.links.new(nz.outputs['Fac'], bn.inputs['Height'])
        nt.links.new(bn.outputs['Normal'], b.inputs['Normal'])
    nt.links.new(b.outputs[0], out.inputs[0])
    return m


def gold(name='Gold', color='#e8b860', rough=0.22):
    return principled(name, color, rough=rough, metal=1.0, bump=0.05, bump_scale=200)


def gem(name, color):
    return principled(name, color, rough=0.02, transmission=1.0, ior=2.1, spec=1.0)


def pearl(name='Pearl'):
    return principled(name, '#f4eee4', rough=0.18, sss=0.3, coat=0.8, sheen=0.3)


def enamel(name, color):
    return principled(name, color, rough=0.12, coat=1.0, spec=0.6)


def velvet(name, color):
    return principled(name, color, rough=0.75, sheen=1.0, sheen_tint=hexcol(color), bump=0.15, bump_scale=900)


def knit(name, color, scale=90.0):
    """Chunky knit: rows of stitches in the bump, soft sheen, a little colour variance."""
    m = principled(name, color, rough=0.85, sheen=0.9, sheen_tint=(1, 1, 1, 1))
    nt = m.node_tree
    b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    tc = nt.nodes.new('ShaderNodeTexCoord')
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = 'Y'
    w.inputs['Scale'].default_value = scale
    w.inputs['Distortion'].default_value = 2.0
    w.inputs['Detail'].default_value = 3
    v = nt.nodes.new('ShaderNodeTexVoronoi')
    v.inputs['Scale'].default_value = scale * 1.6
    mx = nt.nodes.new('ShaderNodeMath')
    mx.operation = 'MULTIPLY'
    bn = nt.nodes.new('ShaderNodeBump')
    bn.inputs['Strength'].default_value = 0.6
    bn.inputs['Distance'].default_value = 0.01
    nt.links.new(tc.outputs['Object'], w.inputs['Vector'])
    nt.links.new(tc.outputs['Object'], v.inputs['Vector'])
    nt.links.new(w.outputs['Fac'], mx.inputs[0])
    nt.links.new(v.outputs['Distance'], mx.inputs[1])
    nt.links.new(mx.outputs[0], bn.inputs['Height'])
    nt.links.new(bn.outputs['Normal'], b.inputs['Normal'])
    return m


def scales(name, color, scale=40.0, rough=0.38, sss=0.25, edge='#000000', strength=0.5, coat=0.25):
    """Reptile skin: rounded scale tiles (voronoi) in the bump, darker grooves between them."""
    m = principled(name, color, rough=rough, sss=sss, coat=coat)
    nt = m.node_tree
    b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    tc = nt.nodes.new('ShaderNodeTexCoord')
    v = nt.nodes.new('ShaderNodeTexVoronoi')
    v.feature = 'DISTANCE_TO_EDGE'
    v.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs['Object'], v.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeMapRange')
    ramp.inputs['From Min'].default_value = 0.0
    ramp.inputs['From Max'].default_value = 0.12
    nt.links.new(v.outputs['Distance'], ramp.inputs['Value'])
    bn = nt.nodes.new('ShaderNodeBump')
    bn.inputs['Strength'].default_value = strength
    bn.inputs['Distance'].default_value = 0.02
    nt.links.new(ramp.outputs['Result'], bn.inputs['Height'])
    nt.links.new(bn.outputs['Normal'], b.inputs['Normal'])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = tuple(x * 0.45 for x in hexcol(color)[:3]) + (1,)
    mix.inputs['B'].default_value = hexcol(color)
    nt.links.new(ramp.outputs['Result'], mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    return m


def stripes(name, a, b_, scale=8.0, axis='Y', knitted=True):
    """Two-colour stripes (a knitted scarf)."""
    m = knit(name, a) if knitted else principled(name, a, rough=0.5)
    nt = m.node_tree
    b = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    tc = nt.nodes.new('ShaderNodeTexCoord')
    w = nt.nodes.new('ShaderNodeTexWave')
    w.wave_type = 'BANDS'
    w.bands_direction = axis
    w.wave_profile = 'SAW'
    w.inputs['Scale'].default_value = scale
    nt.links.new(tc.outputs['Object'], w.inputs['Vector'])
    gt = nt.nodes.new('ShaderNodeMath')
    gt.operation = 'GREATER_THAN'
    gt.inputs[1].default_value = 0.5
    nt.links.new(w.outputs['Fac'], gt.inputs[0])
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type = 'RGBA'
    mix.inputs['A'].default_value = hexcol(a)
    mix.inputs['B'].default_value = hexcol(b_)
    nt.links.new(gt.outputs[0], mix.inputs['Factor'])
    nt.links.new(mix.outputs['Result'], b.inputs['Base Color'])
    return m


def silk(name, color):
    return principled(name, color, rough=0.3, sheen=0.4, aniso=0.6, coat=0.0, bump=0.04, bump_scale=500)


def wool(name, color):
    return principled(name, color, rough=0.9, sheen=0.8, sheen_tint=(1, 1, 1, 1), bump=0.35, bump_scale=400)


def skin(name, color, rough=0.45, sss=0.25):
    return principled(name, color, rough=rough, sss=sss, bump=0.08, bump_scale=160)


def glossy(name, color, rough=0.18):
    return principled(name, color, rough=rough, coat=0.6, sss=0.1)


def hair_mat(name, color, tip=None, rough=0.35, var=0.18):
    """Principled hair coloured directly: root a touch darker, tips lighter, strand-to-strand variance."""
    m, nt, out = _mat(name)
    h = nt.nodes.new('ShaderNodeBsdfHairPrincipled')
    h.parametrization = 'COLOR'
    info = nt.nodes.new('ShaderNodeHairInfo')
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    c = hexcol(color)
    t = hexcol(tip) if tip else tuple(min(1, x * 1.35) for x in c[:3]) + (1,)
    ramp.color_ramp.elements[0].color = tuple(x * 0.55 for x in c[:3]) + (1,)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = t
    mid = ramp.color_ramp.elements.new(0.35)
    mid.color = c
    nt.links.new(info.outputs['Intercept'], ramp.inputs['Fac'])
    # per-strand variance
    hsv = nt.nodes.new('ShaderNodeHueSaturation')
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.inputs['To Min'].default_value = 1 - var
    mr.inputs['To Max'].default_value = 1 + var
    nt.links.new(info.outputs['Random'], mr.inputs['Value'])
    nt.links.new(mr.outputs['Result'], hsv.inputs['Value'])
    nt.links.new(ramp.outputs['Color'], hsv.inputs['Color'])
    nt.links.new(hsv.outputs['Color'], h.inputs['Color'])
    h.inputs['Roughness'].default_value = rough
    h.inputs['Radial Roughness'].default_value = 0.6
    h.inputs['Coat'].default_value = 0.2
    # a little diffuse keeps stylised fur bright and readable (Chiang alone goes dark and saturated)
    d = nt.nodes.new('ShaderNodeBsdfDiffuse')
    nt.links.new(hsv.outputs['Color'], d.inputs['Color'])
    mix = nt.nodes.new('ShaderNodeMixShader')
    mix.inputs[0].default_value = 0.45
    nt.links.new(h.outputs[0], mix.inputs[1])
    nt.links.new(d.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs[0])
    return m


# ----------------------------------------------------------------------------- meshes
def obj_from(name, v, f, mats, smooth_iter=0, subdiv=0):
    me = bpy.data.meshes.new(name)
    me.from_pydata(v.tolist(), [], f.tolist())
    me.validate()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    for m in (mats if isinstance(mats, (list, tuple)) else [mats]):
        o.data.materials.append(m)
    for p in me.polygons:
        p.use_smooth = True
    if smooth_iter:
        sm = o.modifiers.new('smooth', 'SMOOTH')
        sm.iterations = smooth_iter
        sm.factor = 0.5
    if subdiv:
        s = o.modifiers.new('subd', 'SUBSURF')
        s.levels = 0
        s.render_levels = subdiv
    return o


def build(name, field, lo, hi, mats, step=0.008, smooth_iter=0, subdiv=0):
    v, f = sdf.mesh(field, lo, hi, step)
    return obj_from(name, v, f, mats, smooth_iter, subdiv)


def paint(o, regions, default=0):
    """regions: list of (field, material index, softness). Later entries win. Assigns face
    materials by the strongest region, and returns per-vertex weights for each index."""
    me = o.data
    P = np.array([v.co[:] for v in me.vertices])
    nmat = len(me.materials)
    W = np.zeros((len(P), nmat))
    W[:, default] = 1.0
    for field, idx, soft in regions:
        d = field(P)
        w = np.clip(0.5 - d / max(soft, 1e-4) * 0.5, 0, 1)
        w = w * w * (3 - 2 * w)
        W *= (1 - w)[:, None]
        W[:, idx] += w
    best = W.argmax(1)
    tris = np.array([p.vertices[:] for p in me.polygons], dtype=object)
    for p in me.polygons:
        vs = p.vertices
        p.material_index = int(np.bincount(best[list(vs)], minlength=nmat).argmax())
    return W


def vertex_area(o):
    """Area of skin each vertex stands for (a third of its triangles)."""
    me = o.data
    me.calc_loop_triangles()
    V = np.array([v.co[:] for v in me.vertices])
    T = np.array([t.vertices[:] for t in me.loop_triangles])
    a = np.linalg.norm(np.cross(V[T[:, 1]] - V[T[:, 0]], V[T[:, 2]] - V[T[:, 0]]), axis=1) / 6
    out = np.zeros(len(V))
    for j in range(3):
        np.add.at(out, T[:, j], a)
    return out


def vgroup(o, name, weights):
    g = o.vertex_groups.new(name=name)
    for i, w in enumerate(weights):
        if w > 0.01:
            g.add([i], float(w), 'REPLACE')
    return g


def fur(o, group, mat_name, length=0.03, count=40000, children=12, align=(0, -0.5, 0), rough=0.002,
        clump=0.15, root=0.0026, tip=0.0004, kink=None, random=0.15, rough_end=0.0, child_len=1.0, tangent=0.0,
        brownian=0.0, steps=5, seed=0):
    """A groomed fur coat on the vertex group: hair grows out along the normal, is combed toward
    `align`, and children fill in between the guides."""
    mod = o.modifiers.new('fur_' + group, 'PARTICLE_SYSTEM')
    ps = o.particle_systems[-1]
    ps.vertex_group_density = group
    ps.seed = seed
    s = ps.settings
    s.type = 'HAIR'
    s.use_advanced_hair = True
    s.count = count
    s.hair_length = length
    s.emit_from = 'FACE'
    s.distribution = 'JIT'
    s.use_emit_random = True
    # with advanced hair the strand's length is the length of its growth vector
    s.normal_factor = length
    s.object_align_factor = tuple(a * length for a in align)
    s.tangent_factor = tangent * length
    s.factor_random = random * length
    s.brownian_factor = brownian
    s.hair_step = steps
    s.render_step = 3
    s.display_step = 2
    s.child_type = 'INTERPOLATED' if children else 'NONE'
    s.rendered_child_count = children
    s.child_percent = 1
    s.child_length = child_len
    s.clump_factor = clump
    s.clump_shape = 0.2
    s.roughness_1 = rough
    s.roughness_1_size = 1.0
    s.roughness_endpoint = rough_end
    s.roughness_2 = rough * 1.5
    s.roughness_2_size = 1.0
    s.material_slot = mat_name
    s.root_radius = root
    s.tip_radius = tip
    s.radius_scale = 1.0
    s.use_close_tip = True
    if kink:
        s.kink = kink[0]
        s.kink_amplitude = kink[1]
        s.kink_frequency = kink[2]
    # with advanced hair Blender integrates the growth vector, so measure the real length and scale
    # the vector until the strands are as long as asked
    for _ in range(2):
        dg = bpy.context.evaluated_depsgraph_get()
        pe = o.evaluated_get(dg).particle_systems[len(o.particle_systems) - 1]
        ls = []
        for p in list(pe.particles)[:200]:
            ks = [Vector(k.co) for k in p.hair_keys]
            ls.append(sum((ks[i + 1] - ks[i]).length for i in range(len(ks) - 1)))
        got = float(np.median(ls)) if ls else length
        f = length / max(got, 1e-6)
        s.normal_factor *= f
        s.object_align_factor = tuple(a * f for a in s.object_align_factor)
        s.tangent_factor *= f
        s.factor_random *= f
    # the emitter stays visible (its skin shows between the hairs)
    o.show_instancer_for_render = True
    return ps


def eye(name, c, r, look=(0, 0, 1), iris='#6a3a1c', iris_r=0.62, pupil_r=0.27, tilt=0.0, slit=False, sclera='#f4efe8'):
    """A living eye: a sclera ball painted with a streaked iris and big pupil, under a clear,
    wet cornea that catches the lights."""
    m, nt, out = _mat(name + 'Ball')
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])
    # radial distance in the xy plane (the eye looks down +z)
    vx = nt.nodes.new('ShaderNodeVectorMath')
    vx.operation = 'LENGTH'
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(sep.outputs['X'], comb.inputs['X'])
    nt.links.new(sep.outputs['Y'], comb.inputs['Y'])
    nt.links.new(comb.outputs[0], vx.inputs[0])
    ring = nt.nodes.new('ShaderNodeValToRGB')
    cr = ring.color_ramp
    ic = hexcol(iris)
    light = tuple(min(1, x * 2.2 + 0.03) for x in ic[:3]) + (1,)
    dark = tuple(x * 0.25 for x in ic[:3]) + (1,)
    cr.interpolation = 'EASE'
    cr.elements[0].position = 0.0
    cr.elements[0].color = (0.004, 0.003, 0.003, 1)
    cr.elements[1].position = 1.0
    cr.elements[1].color = hexcol(sclera)
    if slit:
        pupil_r = 0.06
    for pos, col in ((pupil_r, (0.006, 0.004, 0.004, 1)), (pupil_r + 0.03, light), (iris_r * 0.78, ic),
                     (iris_r * 0.97, dark), (iris_r + 0.035, hexcol(sclera))):
        e = cr.elements.new(pos)
        e.color = col
    nt.links.new(vx.outputs['Value'], ring.inputs['Fac'])
    # streaks in the iris
    noise = nt.nodes.new('ShaderNodeTexWave')
    noise.wave_type = 'RINGS'
    noise.rings_direction = 'SPHERICAL'
    noise.inputs['Scale'].default_value = 0.0
    streak = nt.nodes.new('ShaderNodeTexNoise')
    streak.inputs['Scale'].default_value = 22.0
    streak.inputs['Detail'].default_value = 4
    # angular coordinate → streaks: stretch noise along radius by using normalised xy
    norm = nt.nodes.new('ShaderNodeVectorMath')
    norm.operation = 'NORMALIZE'
    nt.links.new(comb.outputs[0], norm.inputs[0])
    nt.links.new(norm.outputs[0], streak.inputs['Vector'])
    mixc = nt.nodes.new('ShaderNodeMix')
    mixc.data_type = 'RGBA'
    mixc.blend_type = 'OVERLAY'
    mixc.inputs['Factor'].default_value = 0.55
    nt.links.new(ring.outputs['Color'], mixc.inputs['A'])
    nt.links.new(streak.outputs['Color'], mixc.inputs['B'])
    if slit:
        # a cat's slit pupil: an upright lens shape in the round iris
        c2 = nt.nodes.new('ShaderNodeCombineXYZ')
        mx3 = nt.nodes.new('ShaderNodeMath')
        mx3.operation = 'MULTIPLY'
        mx3.inputs[1].default_value = 4.0
        nt.links.new(sep.outputs['X'], mx3.inputs[0])
        nt.links.new(mx3.outputs[0], c2.inputs['X'])
        nt.links.new(sep.outputs['Y'], c2.inputs['Y'])
        l2 = nt.nodes.new('ShaderNodeVectorMath')
        l2.operation = 'LENGTH'
        nt.links.new(c2.outputs[0], l2.inputs[0])
        lt = nt.nodes.new('ShaderNodeMapRange')
        lt.inputs['From Min'].default_value = 0.62
        lt.inputs['From Max'].default_value = 0.58
        nt.links.new(l2.outputs['Value'], lt.inputs['Value'])
        pm = nt.nodes.new('ShaderNodeMix')
        pm.data_type = 'RGBA'
        pm.inputs['B'].default_value = (0.004, 0.003, 0.003, 1)
        nt.links.new(lt.outputs['Result'], pm.inputs['Factor'])
        nt.links.new(mixc.outputs['Result'], pm.inputs['A'])
        mixc = pm
    # only on the front of the ball
    front = nt.nodes.new('ShaderNodeMath')
    front.operation = 'GREATER_THAN'
    front.inputs[1].default_value = 0.0
    nt.links.new(sep.outputs['Z'], front.inputs[0])
    sel = nt.nodes.new('ShaderNodeMix')
    sel.data_type = 'RGBA'
    sel.inputs['A'].default_value = hexcol(sclera)
    nt.links.new(front.outputs[0], sel.inputs['Factor'])
    nt.links.new(mixc.outputs['Result'], sel.inputs['B'])
    b = nt.nodes.new('ShaderNodeBsdfPrincipled')
    nt.links.new(sel.outputs['Result'], b.inputs['Base Color'])
    b.inputs['Roughness'].default_value = 0.35
    b.inputs['Subsurface Weight'].default_value = 0.05
    nt.links.new(b.outputs[0], out.inputs[0])

    # cornea: reflection only (no refraction darkening), the wet look and the catchlights
    cm, cnt, cout = _mat(name + 'Cornea')
    tr = cnt.nodes.new('ShaderNodeBsdfTransparent')
    gl = cnt.nodes.new('ShaderNodeBsdfGlossy')
    gl.inputs['Roughness'].default_value = 0.02
    fr = cnt.nodes.new('ShaderNodeFresnel')
    fr.inputs['IOR'].default_value = 1.6
    mx = cnt.nodes.new('ShaderNodeMixShader')
    cnt.links.new(fr.outputs[0], mx.inputs[0])
    cnt.links.new(tr.outputs[0], mx.inputs[1])
    cnt.links.new(gl.outputs[0], mx.inputs[2])
    cnt.links.new(mx.outputs[0], cout.inputs[0])

    look = Vector(look).normalized()
    rot = look_rot((0, 0, 0), -look)
    objs = []
    for nm, mat, rr, bulge in ((name, m, 1.0, 1.0), (name + 'C', cm, 1.025, 1.0)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=rr)
        o = bpy.context.active_object
        o.name = nm
        o.data.materials.append(mat)
        bpy.ops.object.shade_smooth()
        if nm.endswith('C'):
            # a gentle bulge over the iris
            for v in o.data.vertices:
                if v.co.z > 0.6:
                    v.co.z += (v.co.z - 0.6) * 0.18
        o.scale = (r, r, r)
        o.rotation_euler = rot
        o.rotation_euler.rotate_axis('Z', tilt)
        o.location = c
        objs.append(o)
    return objs


def fuzz(o, color, length=0.005, count=30000, name=None):
    """A fine nap of fibres over a whole cloth object (knit, felt, velvet)."""
    nm = name or (o.name + 'Fuzz')
    o.data.materials.append(hair_mat(nm, color, var=0.1))
    vgroup(o, 'all', np.ones(len(o.data.vertices)))
    return fur(o, 'all', nm, length=length, count=count, children=3, align=(0, 0, 0), clump=0.0, root=0.0012,
               tip=0.0003, random=0.6)


def add_obj(name, verts_faces, mat, smooth=True):
    v, f = verts_faces
    return obj_from(name, v, f, [mat], smooth_iter=2 if smooth else 0, subdiv=1)


# ----------------------------------------------------------------------------- studio
def look_rot(loc, target, up=(0, 1, 0)):
    """Rotation that points an object's -Z at target with its +Y up (our models are y-up)."""
    f = (Vector(target) - Vector(loc)).normalized()
    r = f.cross(Vector(up))
    if r.length < 1e-6:
        r = Vector((1, 0, 0))
    r.normalize()
    u = r.cross(f)
    return Matrix((r, u, -f)).transposed().to_euler()


def y_up():
    """Our models are y-up; Blender is z-up. Parent everything to a root turned 90 degrees."""
    root = bpy.data.objects.new('Root', None)
    bpy.context.scene.collection.objects.link(root)
    root.rotation_euler = (math.pi / 2, 0, 0)
    for o in bpy.data.objects:
        if o is not root and o.parent is None:
            o.parent = root
    return root


def area(name, loc, target, size, power, color='#ffffff', shape='DISK'):
    L = bpy.data.lights.new(name, 'AREA')
    L.shape = shape
    L.size = size
    L.energy = power
    L.color = hexcol(color)[:3]
    o = bpy.data.objects.new(name, L)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = look_rot(loc, target)
    return o


def studio(center=(0, 0.05, 0), warm='#ffe2c0', rim='#ffd9a8', rim2='#cfe0ff', k=1.0):
    c = Vector(center)
    area('Key', c + Vector((-2.2, 2.0, 3.0)), c, 2.6, 420 * k, warm)
    area('Fill', c + Vector((2.8, 0.2, 2.4)), c, 3.2, 110 * k, '#fff4ea')
    area('RimL', c + Vector((-2.4, 1.4, -2.2)), c + Vector((0, 0.15, 0)), 1.6, 520 * k, rim)
    area('RimR', c + Vector((2.4, 1.0, -2.2)), c + Vector((0, 0.15, 0)), 1.6, 420 * k, rim2)
    area('Top', c + Vector((0, 3.2, 0.4)), c, 2.0, 160 * k, '#fff2e0')
    area('Bounce', c + Vector((0, -2.6, 1.6)), c, 3.0, 50 * k, '#ffd8b8', 'SQUARE')


def camera(loc, target, lens=85, ortho=None):
    cd = bpy.data.cameras.new('Cam')
    cd.lens = lens
    cd.sensor_width = 36
    o = bpy.data.objects.new('Cam', cd)
    bpy.context.scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = look_rot(loc, target)
    bpy.context.scene.camera = o
    return o


def render(path, size=1024, samples=96, hair_shape='THICK'):
    sc = bpy.context.scene
    sc.render.resolution_x = size
    sc.render.resolution_y = size
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.use_denoising = True
    try:
        sc.cycles.denoiser = 'OPENIMAGEDENOISE'
    except TypeError:
        pass
    sc.cycles.max_bounces = 8
    sc.cycles.transparent_max_bounces = 16
    sc.render.hair_type = 'STRAND' if hair_shape == 'THICK' else 'STRIP'
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.filepath = path
    sc.render.threads_mode = 'AUTO'
    bpy.ops.render.render(write_still=True)


# ----------------------------------------------------------------------------- groomed strands
def sample_surface(o, weights, n, seed=0, thresh=0.5):
    """n random points (and normals) on the faces of o where the vertex weights are high."""
    me = o.data
    me.calc_loop_triangles()
    V = np.array([v.co[:] for v in me.vertices])
    T = np.array([t.vertices[:] for t in me.loop_triangles])
    w = weights[T].mean(1)
    a, b, c = V[T[:, 0]], V[T[:, 1]], V[T[:, 2]]
    nrm = np.cross(b - a, c - a)
    area = np.linalg.norm(nrm, axis=1) * 0.5 * (w > thresh) * w
    rng = np.random.default_rng(seed)
    idx = rng.choice(len(T), n, p=area / area.sum())
    r1, r2 = rng.random(n), rng.random(n)
    s1 = np.sqrt(r1)
    P = a[idx] * (1 - s1)[:, None] + b[idx] * (s1 * (1 - r2))[:, None] + c[idx] * (s1 * r2)[:, None]
    N = nrm[idx] / np.linalg.norm(nrm[idx], axis=1)[:, None]
    return P, N


def groom(P, N, length, comb, gravity=0.0, lift=1.0, steps=10, clumps=40, clump=0.7, jitter=0.15, seed=0,
          curl=0.0, len_var=0.25, bend=1.6):
    """Locks of hair: guide strands grow off the surface (lift along the normal, then the comb
    direction), bend under `gravity`; every strand follows its nearest guide and gathers to it
    toward the tip (clump), so the hair falls in shaped locks rather than a uniform pelt."""
    rng = np.random.default_rng(seed)
    comb = np.asarray(comb, float)
    G = rng.choice(len(P), min(clumps, len(P)), replace=False)

    def path(p, n, L, cdir):
        v = n * lift + cdir
        v /= np.linalg.norm(v)
        pts = [p]
        seg = L / steps
        for i in range(steps):
            t = (i + 1) / steps
            v = v + np.array([0, -gravity * 0.45 * t, 0])
            if curl:
                v = v + np.cross(v, n) * curl * t
            v /= np.linalg.norm(v)
            pts.append(pts[-1] + v * seg)
        return np.array(pts)

    gl = length * (1 + len_var * rng.uniform(-1, 1, len(G)))
    gp = [path(P[g], N[g], gl[j], comb + rng.normal(0, jitter, 3)) for j, g in enumerate(G)]
    owner = np.argmin(((P[:, None, :] - P[G][None, :, :]) ** 2).sum(-1), 1)
    out = []
    t = np.linspace(0, 1, steps + 1)[:, None]
    for i in range(len(P)):
        g = owner[i]
        own = path(P[i], N[i], gl[g] * (1 + 0.08 * rng.normal()), comb + rng.normal(0, jitter * 0.6, 3))
        follow = gp[g] - gp[g][0] + P[i]
        q = own * (1 - t ** 0.5 * 0.85) + follow * (t ** 0.5 * 0.85)
        q = q * (1 - clump * t ** 1.5) + gp[g] * (clump * t ** 1.5)
        q[0] = P[i]
        out.append(q)
    return out


def strands(name, paths, mat, root=0.004, tip=0.0006, inset=0.004, normals=None):
    """A hair-curves object from a list of point paths (all the same length)."""
    n = len(paths[0])
    c = bpy.data.hair_curves.new(name)
    c.add_curves([n] * len(paths))
    pos = np.concatenate(paths).astype(np.float32)
    if normals is not None:
        # sink the roots a little into the skin
        pos[0::n] -= (np.asarray(normals, np.float32) * inset)
    c.position_data.foreach_set('vector', pos.ravel())
    r = c.attributes.get('radius') or c.attributes.new('radius', 'FLOAT', 'POINT')
    rad = np.tile(np.linspace(root, tip, n) ** 1.0, len(paths)).astype(np.float32)
    r.data.foreach_set('value', rad)
    o = bpy.data.objects.new(name, c)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o
