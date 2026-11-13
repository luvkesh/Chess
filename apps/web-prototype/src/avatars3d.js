// Chackmate avatars in 3D: the emblem avatars (Grandmaster Crown, Cocoa Pod, Harvest Crown) and
// the avatar frames, as real gold, enamel and gems. The animal friends (Rooky, the opponents, the
// era champions) are modelled, furred and rendered in Blender (tools/characters/), and the game
// shows those pictures. The menus show pictures rendered from these (tools/shoot-art.js) and the
// Collection turns an emblem itself on its stage.
function ChacklateAvatars(THREE, K) {
  'use strict';
  const { SD, sdfGeometry, MAT, TAU, clamp, mix, smooth } = K;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  // ------------------------------------------------------------------ shapes
  // Each shape is f(x, y, z) -> signed distance with a bounding box f.bb = [x0, y0, z0, x1, y1, z1].
  const withBB = (f, bb) => { f.bb = bb; return f; };
  const E = (x, y, z, rx, ry, rz) => withBB((a, b, c) => SD.ellipsoid(a, b, c, x, y, z, rx, ry, rz), [x - rx, y - ry, z - rz, x + rx, y + ry, z + rz]);
  const S = (x, y, z, r) => withBB((a, b, c) => SD.sphere(a, b, c, x, y, z, r), [x - r, y - r, z - r, x + r, y + r, z + r]);
  const Cap = (p, q, r) => withBB((a, b, c) => SD.capsule(a, b, c, p[0], p[1], p[2], q[0], q[1], q[2], r),
    [Math.min(p[0], q[0]) - r, Math.min(p[1], q[1]) - r, Math.min(p[2], q[2]) - r, Math.max(p[0], q[0]) + r, Math.max(p[1], q[1]) + r, Math.max(p[2], q[2]) + r]);
  const Cone = (p, q, r1, r2) => { const r = Math.max(r1, r2); return withBB((a, b, c) => SD.roundCone(a, b, c, p[0], p[1], p[2], q[0], q[1], q[2], r1, r2),
    [Math.min(p[0], q[0]) - r, Math.min(p[1], q[1]) - r, Math.min(p[2], q[2]) - r, Math.max(p[0], q[0]) + r, Math.max(p[1], q[1]) + r, Math.max(p[2], q[2]) + r]); };
  const Tor = (x, y, z, R, r) => withBB((a, b, c) => SD.torus(a, b, c, x, y, z, R, r), [x - R - r, y - r, z - R - r, x + R + r, y + r, z + R + r]);
  const Box = (x, y, z, hx, hy, hz, r) => withBB((a, b, c) => SD.box(a, b, c, x, y, z, hx, hy, hz, r || 0), [x - hx, y - hy, z - hz, x + hx, y + hy, z + hz]);
  const Cyl = (x, y, z, r, h, round) => withBB((a, b, c) => SD.cylinder(a, b, c, x, y, z, r - (round || 0), h - (round || 0)) - (round || 0), [x - r, y - h, z - r, x + r, y + h, z + r]);
  // A smooth strand through [[x, y, z, r], ...]: horns, tails, trunks, feathers.
  const Strand = (pts) => {
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) segs.push(Cone(pts[i], pts[i + 1], pts[i][3], pts[i + 1][3]));
    return withBB((a, b, c) => { let d = 1e9; for (const s of segs) { const v = s(a, b, c); if (v < d) d = v; } return d; }, union(segs.map((s) => s.bb)));
  };
  // A Catmull-Rom curve through control points, as a strand of n segments.
  const Curve = (ctrl, n, r0, r1) => {
    const curve = new THREE.CatmullRomCurve3(ctrl.map((p) => V(p[0], p[1], p[2])));
    const pts = [];
    for (let i = 0; i <= n; i++) { const p = curve.getPoint(i / n); pts.push([p.x, p.y, p.z, typeof r0 === 'function' ? r0(i / n) : mix(r0, r1 === undefined ? r0 : r1, i / n)]); }
    return Strand(pts);
  };
  // Mirror in x (a pair of ears, eyes or cheeks from one).
  const M = (f) => { const [x0, y0, z0, x1, y1, z1] = f.bb, m = Math.max(Math.abs(x0), Math.abs(x1)); return withBB((a, b, c) => f(Math.abs(a), b, c), [-m, y0, z0, m, y1, z1]); };
  // Rotate a shape (Euler XYZ, radians) about a point.
  const R = (f, at, rx, ry, rz) => {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)).invert().elements;
    const [x0, y0, z0, x1, y1, z1] = f.bb;
    let rad = 0;
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) rad = Math.max(rad, Math.hypot(x - at[0], y - at[1], z - at[2]));
    return withBB((a, b, c) => {
      const dx = a - at[0], dy = b - at[1], dz = c - at[2];
      return f(at[0] + m[0] * dx + m[4] * dy + m[8] * dz, at[1] + m[1] * dx + m[5] * dy + m[9] * dz, at[2] + m[2] * dx + m[6] * dy + m[10] * dz);
    }, [at[0] - rad, at[1] - rad, at[2] - rad, at[0] + rad, at[1] + rad, at[2] + rad]);
  };
  // Place a shape modelled round the origin at a point, turned (Euler XYZ, radians).
  const T = (f, at, rx, ry, rz) => {
    const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)).invert().elements;
    const [x0, y0, z0, x1, y1, z1] = f.bb;
    let rad = 0;
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) rad = Math.max(rad, Math.hypot(x, y, z));
    return withBB((a, b, c) => {
      const dx = a - at[0], dy = b - at[1], dz = c - at[2];
      return f(m[0] * dx + m[4] * dy + m[8] * dz, m[1] * dx + m[5] * dy + m[9] * dz, m[2] * dx + m[6] * dy + m[10] * dz);
    }, [at[0] - rad, at[1] - rad, at[2] - rad, at[0] + rad, at[1] + rad, at[2] + rad]);
  };
  // Shapes combined (hard union) or shaved (a minus b).
  const Or = (...fs) => withBB((a, b, c) => { let d = 1e9; for (const f of fs) { const v = f(a, b, c); if (v < d) d = v; } return d; }, union(fs.map((f) => f.bb)));
  const Minus = (f, g, k) => withBB((a, b, c) => SD.smax(f(a, b, c), -g(a, b, c), k || 0), f.bb);
  const And = (f, g, k) => withBB((a, b, c) => SD.smax(f(a, b, c), g(a, b, c), k || 0), f.bb);
  const Shell = (f, t) => withBB((a, b, c) => Math.abs(f(a, b, c)) - t, f.bb);
  function union(bbs) {
    const o = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const b of bbs) for (let i = 0; i < 3; i++) { o[i] = Math.min(o[i], b[i]); o[i + 3] = Math.max(o[i + 3], b[i + 3]); }
    return o;
  }

  // Cellular patches (a giraffe's coat, a tortoise's scutes): negative inside a patch, `gap`
  // apart from the next. seams() is the reverse: negative on the lines between patches.
  function cells(size, gap, seed) {
    const h = (i, j, k, n) => { const v = Math.sin(i * 127.1 + j * 311.7 + k * 74.7 + n * 19.3 + (seed || 0) * 7.1) * 43758.5453; return v - Math.floor(v); };
    return withBB((x, y, z) => {
      const X = x / size, Y = y / size, Z = z / size, xi = Math.floor(X), yi = Math.floor(Y), zi = Math.floor(Z);
      let d1 = 9, d2 = 9;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        const a = xi + i, b = yi + j, c = zi + k;
        const dx = a + 0.15 + h(a, b, c, 1) * 0.7 - X, dy = b + 0.15 + h(a, b, c, 2) * 0.7 - Y, dz = c + 0.15 + h(a, b, c, 3) * 0.7 - Z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
      }
      return (gap - (d2 - d1)) * size;
    }, [-9, -9, -9, 9, 9, 9]);
  }
  const seams = (size, gap, seed) => { const c = cells(size, gap, seed); return withBB((x, y, z) => -c(x, y, z), c.bb); };

  // ------------------------------------------------------------------ sculpts
  // An ordered list of operations: add (smooth union, with a colour), sub (smooth carve, with an
  // optional colour for the carved wall) and paint (recolour inside a volume, soft at its edge).
  function Sculpt(kind) {
    const ops = [];
    let floor = null;
    const col = (c) => new THREE.Color(c);
    const api = {
      kind,
      ops,
      add(f, c, k) { ops.push({ t: 0, f, c: col(c), k: k === undefined ? 0.05 : k }); return api; },
      sub(f, k, c) { ops.push({ t: 1, f, k: k === undefined ? 0.012 : k, c: c ? col(c) : null }); return api; },
      paint(f, c, soft) { ops.push({ t: 2, f, c: col(c), k: soft === undefined ? 0.02 : soft }); return api; },
      cut(y) { floor = y; return api; },
      // Each shape's bounding box gives a cheap lower bound on its distance, so shapes too far
      // away to change the result are skipped.
      field(x, y, z) {
        let d = 1e9;
        for (let i = 0; i < ops.length; i++) {
          const o = ops[i];
          if (o.t === 2) continue;
          const b = o.f.bb, bx = Math.max(b[0] - x, 0, x - b[3]), by = Math.max(b[1] - y, 0, y - b[4]), bz = Math.max(b[2] - z, 0, z - b[5]);
          const near = Math.sqrt(bx * bx + by * by + bz * bz);
          if (o.t === 0) { if (near - o.k < d) d = SD.smin(d, o.f(x, y, z), o.k); }
          else if (near < o.k - d) d = SD.smax(d, -o.f(x, y, z), o.k);
        }
        return floor === null ? d : Math.max(d, floor - y);
      },
      bounds() {
        const b = union(ops.filter((o) => o.t === 0).map((o) => o.f.bb));
        if (floor !== null) b[1] = Math.max(b[1], floor);
        return [b[0] - 0.04, b[1] - 0.04, b[2] - 0.04, b[3] + 0.04, b[4] + 0.04, b[5] + 0.04];
      },
      // The colour at a point on the surface: the nearest added shape's (blended with the next
      // nearest where they meet), then carved walls and painted markings on top.
      color(x, y, z, out) {
        let d1 = 1e9, d2 = 1e9, c1 = null, c2 = null;
        for (const o of ops) {
          if (o.t !== 0) continue;
          const d = o.f(x, y, z);
          if (d < d1) { d2 = d1; c2 = c1; d1 = d; c1 = o.c; } else if (d < d2) { d2 = d; c2 = o.c; }
        }
        out.copy(c1);
        if (c2 && c2 !== c1) out.lerp(c2, 0.5 * (1 - smooth(0, 0.03, d2 - d1)));
        for (const o of ops) {
          if (o.t === 1 && o.c) { const d = o.f(x, y, z); if (d < 0.02) out.lerp(o.c, smooth(0.02, 0.002, d)); }
          else if (o.t === 2) { const d = o.f(x, y, z); if (d < o.k) out.lerp(o.c, smooth(o.k, -o.k, d)); }
        }
        return out;
      },
    };
    return api;
  }

  // ------------------------------------------------------------------ materials
  const cache = new Map();
  const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  // A fine, soft pile for fur and feathers: streaks running down the surface, as a normal map.
  const furNormal = () => once('furN', () => {
    const N = 256, h = new Float32Array(N * N), data = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N, v = j / N;
      h[i + N * j] = K.noise2(u * 64, v * 12, 64) * 0.6 + K.noise2(u * 128, v * 24, 128) * 0.4 + K.noise2(u * 16, v * 16, 16) * 0.3;
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const dx = h[((i + 1) % N) + N * j] - h[((i + N - 1) % N) + N * j], dy = h[i + N * ((j + 1) % N)] - h[i + N * ((j + N - 1) % N)];
      const nx = -dx * 6, ny = -dy * 6, l = Math.hypot(nx, ny, 1), k = (i + N * j) * 4;
      data[k] = (nx / l * 0.5 + 0.5) * 255; data[k + 1] = (ny / l * 0.5 + 0.5) * 255; data[k + 2] = (1 / l * 0.5 + 0.5) * 255; data[k + 3] = 255;
    }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 4); t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  });
  const MATS = {
    fur: () => once('fur', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.66, metalness: 0, sheen: 0.9, sheenRoughness: 0.32, sheenColor: new THREE.Color('#ffffff').multiplyScalar(0.32), normalMap: furNormal(), normalScale: new THREE.Vector2(0.22, 0.22), envMapIntensity: 0.9 })),
    feather: () => once('feather', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.48, metalness: 0, sheen: 0.7, sheenRoughness: 0.3, sheenColor: new THREE.Color('#dfe6ff').multiplyScalar(0.3), clearcoat: 0.25, clearcoatRoughness: 0.4, normalMap: furNormal(), normalScale: new THREE.Vector2(0.18, 0.18), envMapIntensity: 1 })),
    skin: () => once('skin', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0, clearcoat: 0.5, clearcoatRoughness: 0.22, sheen: 0.3, sheenColor: new THREE.Color('#ffffff').multiplyScalar(0.2), envMapIntensity: 1 })),
    velvet: () => once('velvet', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.82, metalness: 0, sheen: 1, sheenRoughness: 0.42, sheenColor: new THREE.Color('#ffffff').multiplyScalar(0.42), envMapIntensity: 0.8 })),
    silk: () => once('silk', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, metalness: 0, sheen: 0.6, sheenRoughness: 0.25, sheenColor: new THREE.Color('#ffffff').multiplyScalar(0.3), clearcoat: 0.3, clearcoatRoughness: 0.2, envMapIntensity: 1.1 })),
    gloss: () => once('gloss', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.26, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.1 })),
    enamel: () => once('enamel', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.25 })),
    horn: () => once('horn', () => new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12, sheen: 0.2, envMapIntensity: 1.1 })),
    gold: () => once('goldA', () => new THREE.MeshPhysicalMaterial({ color: '#f2c66e', metalness: 1, roughness: 0.28, clearcoat: 0.4, clearcoatRoughness: 0.15, envMapIntensity: 1.4 })),
    paleGold: () => once('paleGold', () => new THREE.MeshPhysicalMaterial({ color: '#f6d58c', metalness: 0.85, roughness: 0.3, clearcoat: 0.4, envMapIntensity: 1.6 })),
    pearl: () => once('pearl', () => new THREE.MeshPhysicalMaterial({ color: '#fbf4ea', roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.6, iridescenceIOR: 1.4, sheen: 0.5, sheenColor: new THREE.Color('#ffe8f0'), envMapIntensity: 1.2 })),
    lens: (tint) => once('lens' + tint, () => new THREE.MeshPhysicalMaterial({ color: tint, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2, depthWrite: false })),
    gem: (c) => MAT.gem(c),
  };

  // The painted iris of a glass eye, seen face on (u, v across the front of the bead).
  function irisTex(o) {
    const key = 'iris' + JSON.stringify(o);
    return once(key, () => {
      const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d');
      const iris = new THREE.Color(o.iris || '#6a4024'), ring = o.ring ? new THREE.Color(o.ring) : iris.clone().multiplyScalar(0.25);
      const css = (col, k) => '#' + col.clone().multiplyScalar(k === undefined ? 1 : k).getHexString();
      const lit = (col, t) => '#' + col.clone().lerp(new THREE.Color('#ffffff'), t).getHexString();
      g.fillStyle = css(ring); g.fillRect(0, 0, N, N);
      const cx = N / 2, cy = N / 2, R = N * (o.size || 0.4);
      // iris: lighter below the pupil (light comes through the lens), darker at the rim
      const gr = g.createRadialGradient(cx, cy + R * 0.25, R * 0.1, cx, cy, R);
      gr.addColorStop(0, lit(iris, 0.45)); gr.addColorStop(0.5, css(iris)); gr.addColorStop(0.86, css(iris, 0.55)); gr.addColorStop(1, css(iris, 0.18));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
      // radial fibres
      const rnd = K.rng(11);
      for (let i = 0; i < 140; i++) {
        const a = rnd() * TAU, r0 = R * (0.3 + rnd() * 0.15), r1 = R * (0.7 + rnd() * 0.28);
        g.strokeStyle = rnd() < 0.5 ? lit(iris, 0.5) : css(iris, 0.5); g.globalAlpha = 0.18 + rnd() * 0.2; g.lineWidth = 1 + rnd() * 1.5;
        g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
      }
      g.globalAlpha = 1;
      // pupil
      g.fillStyle = '#060304';
      g.beginPath();
      if (o.slit) g.ellipse(cx, cy, R * 0.16, R * 0.78, 0, 0, TAU); else g.arc(cx, cy, R * (o.pupil || 0.46), 0, TAU);
      g.fill();
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
      return t;
    });
  }
  // A glass eye bead of radius r at p, looking along dir (it bulges out of its socket).
  function eye(group, p, dir, r, o) {
    const geo = new THREE.SphereGeometry(r, 40, 28);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / r * 0.5 + 0.5, pos.getY(i) / r * 0.5 + 0.5);
    const mat = once('eye' + JSON.stringify(o), () => new THREE.MeshPhysicalMaterial({ map: irisTex(o), roughness: 0.18, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.7, specularIntensity: 0.8 }));
    const m = new THREE.Mesh(geo, mat);
    m.position.set(p[0], p[1], p[2]);
    m.lookAt(p[0] + dir[0], p[1] + dir[1], p[2] + dir[2]);
    // a crisp window catchlight, up and to the left, like the key light
    const glint = new THREE.Mesh(new THREE.CircleGeometry(r * 0.17, 20), once('glint', () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.92, toneMapped: false })));
    const gx = -0.34, gy = 0.36, gz = Math.sqrt(1 - gx * gx - gy * gy);
    glint.position.set(gx * r * 1.004, gy * r * 1.004, gz * r * 1.004);
    glint.lookAt(gx * 4, gy * 4, gz * 4);
    m.add(glint);
    group.add(m);
    return m;
  }
  // A pair of eyes at (±x, y, z), turned out by `spread` and up by `lift`.
  function eyes(group, x, y, z, r, o, spread, lift) {
    for (const s of [-1, 1]) {
      const dir = [s * (spread === undefined ? 0.32 : spread), lift || 0.06, 1];
      eye(group, [s * x, y, z], dir, r, o);
      BUILD.eyes.push({ group, p: [s * x, y, z], dir, r });
    }
  }

  // ------------------------------------------------------------------ meshing
  // detail: cell size of the sculpt grid. Fine for pictures and the stage on big screens.
  let CELL = 0.014, SHELLS = 0;
  // What the character being built has so far: its head sculpt (the first fur, feather or skin
  // sculpt) and its eyes, for the eyelids added at the end.
  const BUILD = { head: null, eyes: [] };
  // Fur as real pile: shells of the surface pushed out along the normal and combed down a
  // little, each cut by a strand pattern, so the silhouette and the light go soft like plush.
  const strands = () => once('strands', () => {
    const N = 256, data = new Uint8Array(N * N * 4), rnd = K.rng(17);
    for (let i = 0; i < N * N; i++) { const v = Math.pow(rnd(), 0.7) * 255; data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v; data[i * 4 + 3] = 255; }
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(7, 5); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  });
  function shellMat(base, i, n, len) {
    return once('shell' + base.uuid + i + '/' + n, () => {
      const m = base.clone();
      const t = i / n;
      m.alphaMap = strands(); m.alphaTest = 0.15 + t * 0.75; m.transparent = false;
      m.normalMap = null;
      m.color = new THREE.Color(1, 1, 1).multiplyScalar(0.72 + 0.28 * t);
      m.sheen = Math.min(1, (base.sheen || 0) + 0.3 * t);
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += objectNormal * ' + (len * t).toFixed(5) + ' + vec3(0.0, ' + (-len * 0.35 * t * t).toFixed(5) + ', 0.0);');
      };
      m.customProgramCacheKey = () => 'furshell' + i + '/' + n;
      return m;
    });
  }
  function mesh(group, sc, matOverride) {
    if (!sc.ops.length) return null;
    const f = (x, y, z) => sc.field(x, y, z);
    const geo = sdfGeometry(f, sc.bounds(), CELL, { project: 2 });
    const pos = geo.attributes.position, nrm = geo.attributes.normal, n = pos.count;
    const colors = new Float32Array(n * 3), uv = geo.attributes.uv, c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      sc.color(x, y, z, c);
      // ambient occlusion from the sculpt itself: creases (eye sockets, under the ears and chin)
      // are darker, which the eye reads as depth
      const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
      let occ = 0, w = 0.5;
      for (let k = 1; k <= 5; k++) { const h = 0.022 * k; occ += w * Math.max(0, h - f(x + nx * h, y + ny * h, z + nz * h)) / h; w *= 0.5; }
      const ao = clamp(1 - occ * 1.25, 0.35, 1);
      colors[i * 3] = c.r * ao; colors[i * 3 + 1] = c.g * ao; colors[i * 3 + 2] = c.b * ao;
      // fur runs round the head and down the body
      uv.setXY(i, Math.atan2(x, z) / TAU + 0.5, Math.acos(clamp(y / (Math.hypot(x, y, z) || 1), -1, 1)) / Math.PI);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const kind = sc.kind;
    const mat = matOverride || (MATS[kind] ? MATS[kind]() : MATS.fur());
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    if (!BUILD.head && (kind === 'fur' || kind === 'feather' || kind === 'skin')) BUILD.head = sc;
    if (SHELLS && !matOverride && (kind === 'fur' || kind === 'feather' || kind === 'velvet')) {
      const len = kind === 'fur' ? 0.03 : kind === 'feather' ? 0.022 : 0.008;
      for (let i = 1; i <= SHELLS; i++) { const sh = new THREE.Mesh(geo, shellMat(mat, i, SHELLS, len)); sh.castShadow = false; sh.receiveShadow = true; sh.userData.shell = true; group.add(sh); }
    }
    return m;
  }
  // Upper eyelids over each eye, in the colour of the face around it: a soft, half-closed lid
  // makes the look gentle and alive instead of staring.
  function lids(cover) {
    const head = BUILD.head;
    if (!head) return;
    const c = new THREE.Color();
    for (const e of BUILD.eyes) {
      const [x, y, z] = e.p, r = e.r, d = new THREE.Vector3(...e.dir).normalize();
      // the lid's edge is a plane tilted back from the eye's view, a little above its middle
      const up = new THREE.Vector3(0, 1, 0).addScaledVector(d, -d.y).normalize();
      const k = cover === undefined ? 0.74 : cover;
      const lidShape = withBB((a, b, cc) => {
        const dx = a - x, dy = b - y, dz = cc - z;
        const shell = Math.abs(Math.sqrt(dx * dx + dy * dy + dz * dz) - r * 1.05) - r * 0.045;
        const edge = r * k - (dx * up.x + dy * up.y + dz * up.z) + Math.max(0, -(dx * d.x + dy * d.y + dz * d.z)) * 0.0;
        return Math.max(shell, edge);
      }, [x - r * 1.2, y - r * 1.2, z - r * 1.2, x + r * 1.2, y + r * 1.2, z + r * 1.2]);
      head.color(x + up.x * r * 1.15 + d.x * r * 0.3, y + up.y * r * 1.15 + d.y * r * 0.3, z + up.z * r * 1.15 + d.z * r * 0.3, c);
      const lid = Sculpt(head.kind).add(lidShape, '#' + c.getHexString(), 0);
      const cell = CELL; CELL = Math.min(CELL, r * 0.12);
      const m = mesh(e.group, lid, MATS[head.kind]());
      CELL = cell;
      void m;
    }
  }
  // Plain three.js parts: lathe (profile [[r, y], ...]), torus, tube, sphere, all with a material.
  function lathe(group, prof, mat, at, rot, segs) {
    const m = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), segs || 72), mat);
    if (at) m.position.set(at[0], at[1], at[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; group.add(m); return m;
  }
  function torus(group, R, r, mat, at, rot, arc) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(R, r, 20, 96, arc || TAU), mat);
    if (at) m.position.set(at[0], at[1], at[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = true; group.add(m); return m;
  }
  function tube(group, pts, r, mat, closed) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(p[0], p[1], p[2])), !!closed);
    const m = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(24, pts.length * 16), r, 12, !!closed), mat);
    m.castShadow = true; group.add(m); return m;
  }
  function ball(group, r, mat, at, scale) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 22), mat);
    m.position.set(at[0], at[1], at[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    m.castShadow = true; group.add(m); return m;
  }
  // A cut gem in a gold collet, facing along dir.
  function jewel(group, r, color, at, dir) {
    const g = new THREE.Group();
    const stone = new THREE.Mesh(new THREE.SphereGeometry(r, 28, 18, 0, TAU, 0, Math.PI / 2), MATS.gem(color));
    stone.rotation.x = Math.PI / 2; stone.scale.set(1, 0.7, 1); g.add(stone);
    const set = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, r * 0.18, 10, 40), MATS.gold()); g.add(set);
    g.position.set(at[0], at[1], at[2]);
    g.lookAt(at[0] + (dir ? dir[0] : 0), at[1] + (dir ? dir[1] : 0), at[2] + (dir ? dir[2] : 1));
    group.add(g);
    return g;
  }
  // A ring of beads (pearls, studs) around an ellipse in the plane at y, tilted by tilt about x.
  function beads(group, rx, rz, y, n, r, mat, from, to, tilt, cz) {
    const g = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const a = mix(from === undefined ? 0 : from, to === undefined ? TAU : to, (i + 0.5) / n);
      ball(g, r, mat, [Math.sin(a) * rx, 0, Math.cos(a) * rz]);
    }
    g.position.set(0, y, cz || 0); g.rotation.x = tilt || 0;
    group.add(g); return g;
  }
  // A leaf: a flattened, pointed ellipsoid of length len, at p, pointing along dir, its face to nrm.
  function leaf(group, p, dir, len, mat, width) {
    const geo = new THREE.SphereGeometry(1, 18, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); pos.setX(i, pos.getX(i) * (1 - Math.abs(y) * 0.55)); }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(width || len * 0.36, len * 0.5, len * 0.1);
    m.position.set(p[0], p[1], p[2]);
    const d = V(dir[0], dir[1], dir[2]).normalize();
    m.quaternion.setFromUnitVectors(V(0, 1, 0), d);
    m.castShadow = true; group.add(m); return m;
  }
  // A laurel wreath round the head: an arc of paired leaves on an ellipse at height y.
  function laurel(group, rx, rz, y, mat, berryMat, tilt) {
    const g = new THREE.Group();
    for (const side of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const a = side * (0.25 + i * 0.27), x = Math.sin(a) * rx, z = Math.cos(a) * rz;
        const tx = Math.cos(a) * side, tz = -Math.sin(a) * side;   // runs back along the band
        for (const up of [-1, 1]) leaf(g, [x + tx * 0.02, up * 0.035, z + tz * 0.02], [tx * 0.8, up * 0.55, tz * 0.8], 0.13 - i * 0.004, mat);
        if (berryMat && i % 2) ball(g, 0.018, berryMat, [x * 1.04, 0, z * 1.04]);
      }
    }
    tube(g, Array.from({ length: 13 }, (_, i) => { const a = -2.6 + i * (5.2 / 12); return [Math.sin(a) * rx * 0.98, 0, Math.cos(a) * rz * 0.98]; }), 0.008, mat);
    g.position.y = y; g.rotation.x = tilt || 0;
    group.add(g); return g;
  }

  // A small gold crown of radius r at height y (Ember's, and the Grandmaster Crown's).
  function crownMesh(group, r, y, z, h, gems) {
    const g = new THREE.Group();
    // the band: a gold wall whose top edge rises into five points
    const H = h * r, t = r * 0.035;
    const wall = withBB((x, y, z) => {
      const rad = Math.hypot(x, z), a = Math.atan2(x, z), peak = Math.pow(Math.abs(Math.cos(a * 2.5)), 3);
      const top = -H * 0.2 + H * 0.7 * (0.35 + 0.65 * peak);
      return Math.max(Math.abs(rad - r * (1 - (y + H * 0.5) / H * 0.06)) - t, y - top, -H * 0.5 - y) - t * 0.4;
    }, [-r * 1.1, -H * 0.6, -r * 1.1, r * 1.1, H * 0.6, r * 1.1]);
    const cell = CELL; CELL = Math.min(CELL, r * 0.02);
    mesh(g, Sculpt('gold').add(wall, '#efc368', 0), MATS.gold());
    CELL = cell;
    torus(g, r * 0.98, r * 0.06, MATS.gold(), [0, -h * r * 0.5, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ball(g, r * 0.08, MATS.pearl(), [Math.sin(a) * r * 0.97, h * r * 0.52, Math.cos(a) * r * 0.97]); }
    const cols = gems || ['#d0244a', '#2a8a5a', '#2a5ad0', '#2a8a5a', '#2a5ad0'];
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; jewel(g, r * 0.1, cols[i], [Math.sin(a) * r * 1.0, -h * r * 0.15, Math.cos(a) * r * 1.0], [Math.sin(a), 0, Math.cos(a)]); }
    g.position.set(0, y, z);
    group.add(g);
    return g;
  }

  // ------------------------------------------------------------------ emblems
  const EMBLEMS = {
    // The Grandmaster Crown: a gold royal crown with pearl points, gems and a velvet cap.
    crown(g) {
      const c = crownMesh(g, 0.62, 0, 0, 0.9, ['#d0244a', '#2a8a5a', '#2a5ad0', '#d0244a', '#2a8a5a']);
      const cap = Sculpt('velvet').add(And(E(0, -0.05, 0, 0.57, 0.5, 0.57), Box(0, 0.25, 0, 1, 0.5, 1)), '#8a1430', 0.02);
      mesh(c, cap);
      // arches meeting under an orb and cross
      for (const a of [0, Math.PI / 2]) torus(c, 0.5, 0.03, MATS.gold(), [0, -0.02, 0], [0, a, 0], Math.PI).rotation.set(0, a, 0);
      ball(c, 0.09, MATS.gold(), [0, 0.56, 0]);
      const cross = Sculpt('gold').add(Box(0, 0.74, 0, 0.025, 0.11, 0.025, 0.01), '#e8b450').add(Box(0, 0.76, 0, 0.08, 0.025, 0.025, 0.01), '#e8b450');
      mesh(c, cross, MATS.gold());
      c.rotation.x = 0.18;
    },
    // Cocoa Pod: a ribbed cacao pod in deep amber gloss, a gold stem and a green leaf.
    cocoa(g) {
      const pod = Sculpt('gloss');
      const rib = (x, y, z) => {
        const a = Math.atan2(x, z);
        return SD.ellipsoid(x, y, z, 0, 0, 0, 0.34, 0.62, 0.34) - 0.018 * Math.abs(Math.cos(a * 5));
      };
      pod.add(withBB(rib, [-0.36, -0.64, -0.36, 0.36, 0.64, 0.36]), '#b8682a', 0);
      pod.paint(E(0, 0.45, 0, 0.3, 0.3, 0.3), '#d8963a', 0.15);
      pod.paint(E(0, -0.5, 0, 0.3, 0.25, 0.3), '#7a3a12', 0.15);
      const pg = new THREE.Group(); mesh(pg, pod);
      lathe(pg, [[0, 0.58], [0.06, 0.58], [0.045, 0.68], [0.035, 0.8], [0, 0.82]], MATS.gold());
      leaf(pg, [0.22, 0.78, 0], [1, 0.4, 0.2], 0.55, once('leafC', () => new THREE.MeshPhysicalMaterial({ color: '#4a8a3a', roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.15, side: THREE.DoubleSide })), 0.2);
      pg.rotation.z = -0.4;
      g.add(pg);
    },
    // Harvest Crown: a sheaf of golden wheat bound with a ruby ribbon.
    wheat(g) {
      const ear = (group, a) => {
        const e = new THREE.Group();
        tube(e, [[0, -0.7, 0], [0, -0.2, 0], [0, 0.25, 0]], 0.012, MATS.gold());
        for (let i = 0; i < 8; i++) for (const s of [-1, 1]) for (const z of [-1, 1]) { const grain = leaf(e, [s * 0.03, 0.26 + i * 0.058, z * 0.018], [s * 0.4, 1, z * 0.3], 0.12, MATS.paleGold(), 0.05); grain.scale.z = 0.025; }
        leaf(e, [0, 0.76, 0], [0, 1, 0], 0.12, MATS.paleGold(), 0.05);
        tube(e, [[0, 0.74, 0], [0.02, 0.95, 0.01], [0.03, 1.08, 0.02]], 0.004, MATS.paleGold());
        e.rotation.z = a; group.add(e);
      };
      for (let k = -3; k <= 3; k++) ear(g, k * 0.17);
      const rib = Sculpt('silk').add(Tor(0, -0.25, 0, 0.09, 0.035), '#b8325a', 0.02);
      mesh(g, rib);
      const bow = new THREE.Group();
      for (const s of [-1, 1]) {
        const lp = Sculpt('silk').add(R(Tor(0, 0, 0, 0.09, 0.025), [0, 0, 0], Math.PI / 2, 0, 0), '#b8325a', 0.02);
        const lg = new THREE.Group(); mesh(lg, lp); lg.position.set(s * 0.1, 0, 0); lg.rotation.y = s * 0.3; bow.add(lg);
        const tail = Sculpt('silk').add(Cone([0, 0, 0], [s * 0.1, -0.28, 0.02], 0.025, 0.035), '#a02a4e', 0.02);
        mesh(bow, tail);
      }
      bow.position.set(0, -0.25, 0.1); g.add(bow);
    },
  };

  // The studio the busts are lit in: a warm room bright enough that gold reads as gold.
  const STUDIO = { wall: '#6a4a32', floor: '#3a2618', ceiling: '#4a3424', key: '#fff4e4', keyI: 7, window: '#e8eeff', windowI: 3.5, rim: '#ffe2b8', rimI: 5, lamp: '#ffd8a0', lampI: 9, fill: 1.1 };

  // ------------------------------------------------------------------ frames
  // The rings round a player's avatar, seen face on (radius 1, facing +z): real metal, enamel
  // and jewels. Each builds into the group; the avatar sits inside, drawn by the menus.
  function band(g, mat, rIn, rOut, lift) {
    const m = new THREE.Mesh(new THREE.TorusGeometry((rIn + rOut) / 2, (rOut - rIn) / 2, 28, 200), mat);
    m.scale.z = (lift || (rOut - rIn) * 0.45) / ((rOut - rIn) / 2);
    m.castShadow = true; g.add(m); return m;
  }
  function edges(g, mat, r0, r1, t) { torus(g, r0, t, mat); torus(g, r1, t, mat); }
  function ringOf(g, n, r, z, fn) { for (let i = 0; i < n; i++) { const a = (i / n) * TAU; fn([Math.sin(a) * r, Math.cos(a) * r, z], a); } }
  const enamel = (c) => once('frameEnamel' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 }));
  const FRAMES = {
    bronze(g) {
      band(g, MAT.bronze(), 0.86, 1.0);
      ringOf(g, 48, 0.93, 0.055, (p) => ball(g, 0.012, MAT.bronze(), p));
    },
    silver(g) {
      band(g, MAT.silver(), 0.86, 1.0);
      edges(g, MAT.silver(), 0.865, 0.995, 0.012);
      ringOf(g, 36, 0.93, 0.05, (p) => ball(g, 0.026, MATS.pearl(), p));
    },
    gold(g) {
      band(g, MATS.gold(), 0.86, 1.0);
      edges(g, MATS.gold(), 0.862, 0.998, 0.014);
      ringOf(g, 72, 0.93, 0.056, (p) => ball(g, 0.009, MATS.paleGold(), p));
    },
    ruby(g) {
      band(g, MATS.gold(), 0.86, 1.0);
      edges(g, MATS.gold(), 0.862, 0.998, 0.014);
      ringOf(g, 8, 0.93, 0.05, (p) => jewel(g, 0.05, '#c8103a', p));
      for (let i = 0; i < 8; i++) { const a = ((i + 0.5) / 8) * TAU; ball(g, 0.018, MATS.pearl(), [Math.sin(a) * 0.93, Math.cos(a) * 0.93, 0.05]); }
    },
    harvest(g) {
      band(g, MATS.gold(), 0.88, 0.98, 0.03);
      for (let i = 0; i < 44; i++) {
        const a = (i / 44) * TAU, side = i % 2 ? 1 : -1, r = 0.93 + side * 0.035;
        const tx = Math.cos(a), ty = -Math.sin(a);
        leaf(g, [Math.sin(a) * r, Math.cos(a) * r, 0.05], [tx + Math.sin(a) * side * 0.6, ty + Math.cos(a) * side * 0.6, 0.15], 0.11, MATS.paleGold(), 0.045).scale.z = 0.02;
      }
      ringOf(g, 6, 0.93, 0.07, (p) => ball(g, 0.024, MATS.gem('#b8325a'), p));
    },
    'cocoa-gold'(g) {
      band(g, MATS.gold(), 0.85, 1.0);
      band(g, enamel('#5a3220'), 0.88, 0.97, 0.08);
      ringOf(g, 12, 0.925, 0.085, (p) => ball(g, 0.016, MATS.gold(), p));
    },
    ember(g) {
      band(g, MATS.gold(), 0.85, 1.0);
      band(g, enamel('#9a1834'), 0.88, 0.97, 0.08);
      ringOf(g, 16, 0.925, 0.085, (p, a) => { const f = leaf(g, p, [Math.sin(a), Math.cos(a), 0.4], 0.07, MATS.gem('#ffb040'), 0.03); f.scale.z = 0.012; });
      ringOf(g, 4, 0.925, 0.09, (p) => jewel(g, 0.04, '#ffd27a', p));
    },
  };
  function frame(id) {
    CELL = 0.01; SHELLS = 0;
    const g = new THREE.Group();
    const name = String(id || '').replace(/^frame\./, '').replace(/\.v\d+$/, '');
    if (FRAMES[name]) FRAMES[name](g);
    g.userData.dispose = () => g.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    return g;
  }

  // ------------------------------------------------------------------ public
  // make('emblem:crown', { detail: 'show' | 'play' }) -> THREE.Group, fitted to the view.
  function make(art, o) {
    o = o || {};
    const name = String(art || 'emblem:crown').split(':')[1];
    CELL = o.detail === 'play' ? 0.02 : o.detail === 'stage' ? 0.015 : 0.009;
    SHELLS = o.detail === 'play' ? 0 : o.detail === 'stage' ? 6 : 16;
    BUILD.head = null; BUILD.eyes = [];
    const g = new THREE.Group();
    (EMBLEMS[name] || EMBLEMS.crown)(g);
    g.userData.portrait = false;
    g.userData.dispose = () => g.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    return g;
  }
  return { make, frame, FRAMES: Object.keys(FRAMES), EMBLEMS: Object.keys(EMBLEMS), STUDIO };
}
if (typeof module !== 'undefined') module.exports = ChacklateAvatars;
