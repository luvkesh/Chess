"""Writes a pack of modelled sets for the game (pieces3d.js loadPack):
meshes/<pack>.txt = JSON { sets: { id: { bin, albedo, mr, glow } } }.

bin is base64(gzip(u32 header length + JSON header + 4-byte aligned arrays)). Each geometry is
quantised: positions as uint16 inside its box, normals as int8, uvs as uint16 (0..1), indices
as uint16 (uint32 past 65535 vertices). Pure numpy, so it runs inside Blender's Python too."""
import base64
import gzip
import io
import json

import numpy as np


def encode_set(geoms):
    """geoms: { 'w.k.show': { slot: (pos Nx3, nrm Nx3, uv Nx2, idx M) } } in game units (y up)."""
    head, blobs, off = {'geoms': {}}, [], [0]

    def put(a):
        b = np.ascontiguousarray(a).tobytes()
        b += b'\0' * ((-len(b)) % 4)
        at = off[0]
        blobs.append(b)
        off[0] += len(b)
        return at

    for key, slots in geoms.items():
        head['geoms'][key] = {}
        for slot, (pos, nrm, uv, idx) in slots.items():
            pos = np.asarray(pos, np.float64)
            lo, hi = pos.min(0), pos.max(0)
            span = np.where(hi - lo > 1e-9, hi - lo, 1)
            q = np.round((pos - lo) / span * 65535).astype(np.uint16)
            n = np.asarray(nrm, np.float64)
            n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-9)
            n8 = np.round(n * 127).astype(np.int8)
            u16 = np.round(np.clip(np.asarray(uv, np.float64), 0, 1) * 65535).astype(np.uint16)
            nv = len(pos)
            ix = np.asarray(idx).astype(np.uint32 if nv > 65535 else np.uint16)
            o = [put(q), put(n8), put(u16), put(ix)]
            head['geoms'][key][slot] = {'n': int(nv), 'i': int(len(ix)), 'box': [float(x) for x in list(lo) + list(hi)], 'o': o}
    body = b''.join(blobs)
    rel = {k: {sl: list(d['o']) for sl, d in v.items()} for k, v in head['geoms'].items()}
    shift = 0
    for _ in range(8):   # offsets count from the buffer start, so the header's own length is in them
        for k, v in head['geoms'].items():
            for sl, d in v.items():
                d['o'] = [x + shift for x in rel[k][sl]]
        hj = json.dumps(head, separators=(',', ':')).encode()
        hj += b' ' * ((-(4 + len(hj))) % 4)
        if 4 + len(hj) == shift:
            break
        shift = 4 + len(hj)
    assert 4 + len(hj) == shift
    raw = np.uint32(len(hj)).tobytes() + hj + body
    return base64.b64encode(gzip.compress(raw, 9)).decode()


def data_url(img_bytes, mime='image/webp'):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(img_bytes).decode())


def write_pack(path, sets):
    """sets: { id: { 'geoms': {...}, 'w': {'albedo': webp, 'mr': webp, 'glow'?: webp}, 'b': {...} } }
    Geometry keys are '<type>.<lod>' (shared by both sides) or '<side>.<type>.<lod>'."""
    out = {'v': 1, 'sets': {}}
    for sid, d in sets.items():
        o = out['sets'][sid] = {'bin': encode_set(d['geoms'])}
        for side in ('w', 'b'):
            if side in d:
                o[side] = {k: data_url(v) for k, v in d[side].items() if v is not None}
    with open(path, 'w') as f:
        json.dump(out, f, separators=(',', ':'))
