// Chackmate avatars in 3D: every animal friend (Rooky, the opponents, the era champions) and the
// emblem avatars, sculpted as collectible busts. Heads, muzzles, ears and coats are signed-distance
// sculpts (kit3d sdfGeometry) painted per vertex, so markings blend softly into the fur; eyes are
// glossy glass beads with painted irises; hats, crowns and jewels are real gold, enamel and gems.
// The menus show a picture rendered from these (tools/shoot-art.js); the Collection turns the
// model itself on its stage.
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

  // ------------------------------------------------------------------ shared anatomy
  // The bust: shoulders and chest in a coat (or fur), cut flat at the bottom like a sculpture.
  const BUST_Y = -1.32;
  function bust(c, color, o) {
    o = o || {};
    const s = Sculpt(o.kind || 'velvet');
    s.add(E(0, -0.97, -0.08, o.w || 0.86, 0.46, 0.43), color, 0.1);
    s.add(Cone([0, -0.34, -0.04], [0, -0.74, -0.06], o.neck || 0.32, 0.42), o.neckColor || color, 0.16);
    s.cut(BUST_Y);
    return s;
  }
  // A soft, bunched scarf wrapped round the neck at height y: a ring of overlapping puffs.
  function Wrap(y, R, r, tilt) {
    const parts = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU, rr = r * (0.9 + 0.2 * Math.abs(Math.sin(i * 2.3)));
      parts.push(E(Math.sin(a) * R, y + Math.cos(a) * (tilt || 0.06) + Math.sin(i * 1.7) * 0.012, Math.cos(a) * R - 0.03, rr * 1.15, rr * 0.85, rr));
    }
    const ring = Or(...parts);
    return withBB((a, b, c) => { let d = 1e9; for (const p of parts) d = SD.smin(d, p(a, b, c), r * 1.4); return d; }, ring.bb);
  }
  // The V of a coat's opening, from the neck (wide, yTop) to a point at yBot, on the front.
  const Vee = (yTop, yBot, wTop) => withBB((x, y, z) => Math.max(Math.abs(x) - wTop * Math.max(0, y - yBot) / (yTop - yBot), 0.05 - z, yBot - y), [-wTop, yBot, 0, wTop, yTop + 0.3, 1]);
  // A broad jewelled collar lying on the shoulders: bands [[colour, r0, r1, gold?], ...] by distance from the neck.
  function collar(g, bands) {
    const shell = Shell(E(0, -0.97, -0.08, 0.89, 0.49, 0.46), 0.022);
    const enamel = Sculpt('enamel'), gold = Sculpt('gold');
    for (const [c, r0, r1, isGold] of bands) {
      const band = withBB((x, y, z) => { const d = Math.hypot(x, (y + 0.55) * 1.1, z + 0.06); return Math.max(r0 - d, d - r1); }, [-r1, -0.55 - r1, -0.06 - r1, r1, -0.55 + r1, -0.06 + r1]);
      (isGold ? gold : enamel).add(And(shell, band), c, 0);
    }
    gold.cut(-1.0); enamel.cut(-1.0);
    mesh(g, enamel); mesh(g, gold, MATS.gold());
  }
  // A V-neck lapel or collar: a raised band along the neckline, painted in a second colour.
  function lapels(s, color, depth) {
    s.add(M(Curve([[0.02, -1.24, 0.38], [0.12, -0.98, 0.36], [0.24, -0.72, 0.24], [0.3, -0.62, 0.1]], 10, 0.05, 0.045)), color, 0.04);
    if (depth) s.paint(M(Cone([0, -1.3, 0.42], [0.18, -0.7, 0.3], 0.03, 0.1)), depth, 0.02);
    return s;
  }

  // ------------------------------------------------------------------ the animals
  // Each builds into a group: head centred near the origin (radius about 0.55), facing +z,
  // shoulders below, bust cut at y = -1.32.
  const ANIMALS = {
    // Truffle: a cream bunny with long ears, a pink silk bow and neckerchief.
    bunny(g) {
      const f = '#f4ebe4', pink = '#f2a2b4', rose = '#d8466e';
      const fur = Sculpt('fur');
      fur.add(E(0, -0.02, 0, 0.5, 0.46, 0.46), f);
      fur.add(M(E(0.2, -0.16, 0.2, 0.24, 0.2, 0.24)), f, 0.12);
      fur.add(M(E(0.08, -0.17, 0.38, 0.12, 0.1, 0.1)), '#fffaf6', 0.06);
      // long ears, one upright, one folding forward
      fur.add(T(E(0, 0, 0, 0.13, 0.42, 0.07), [-0.17, 0.38, -0.02], 0.1, 0, 0.12), f, 0.08);
      fur.add(T(E(0, 0, 0, 0.13, 0.42, 0.07), [0.2, 0.36, -0.02], 0.25, 0, -0.35), f, 0.08);
      fur.sub(T(E(0, 0.02, 0.06, 0.075, 0.33, 0.04), [-0.17, 0.4, -0.02], 0.1, 0, 0.12), 0.03, pink);
      fur.sub(T(E(0, 0.02, 0.06, 0.075, 0.33, 0.04), [0.2, 0.38, -0.02], 0.25, 0, -0.35), 0.03, pink);
      fur.sub(M(S(0.19, 0.02, 0.39, 0.1)), 0.03);
      fur.sub(M(Curve([[0, -0.26, 0.46], [0.025, -0.288, 0.45], [0.062, -0.268, 0.428]], 6, 0.012)), 0.008).paint(M(Curve([[0, -0.26, 0.46], [0.025, -0.288, 0.45], [0.062, -0.268, 0.428]], 6, 0.016)), '#9a5a66', 0.006);
      fur.add(Cap([0, -0.2, 0.46], [0, -0.25, 0.465], 0.008), f, 0.01);
      fur.add(bodyFur(), f, 0.12);
      mesh(g, fur);
      const nose = Sculpt('gloss').add(R(E(0, -0.09, 0.47, 0.045, 0.032, 0.03), [0, -0.09, 0.47], -0.2, 0, 0), '#e8708e');
      mesh(g, nose);
      const teeth = Sculpt('enamel').add(M(Box(0.022, -0.3, 0.43, 0.019, 0.035, 0.012, 0.008)), '#fffdf8');
      mesh(g, teeth);
      eyes(g, 0.19, 0.02, 0.36, 0.088, { iris: '#5a3420' });
      // the neckerchief and the bow on the upright ear
      const silk = Sculpt('velvet');
      silk.add(Wrap(-0.53, 0.33, 0.09), rose, 0.04).add(R(Cone([0, -0.5, 0.3], [0, -0.78, 0.36], 0.07, 0.02), [0, -0.5, 0.3], 0, 0, 0.2), rose, 0.05);
      mesh(g, silk);
      const bow = Sculpt('silk');
      bow.add(R(Or(R(E(-0.08, 0, 0, 0.085, 0.05, 0.035), [0, 0, 0], 0, 0, 0.3), R(E(0.08, 0, 0, 0.085, 0.05, 0.035), [0, 0, 0], 0, 0, -0.3)), [0, 0, 0], 0, 0, 0), rose, 0.03);
      bow.add(S(0, 0, 0.01, 0.03), '#b8325a', 0.02);
      const bw = new THREE.Group(); mesh(bw, bow); bw.position.set(-0.24, 0.42, 0.05); bw.rotation.set(0.1, 0, 0.3); g.add(bw);
    },
    // Bramble: a beaver in a yellow builder's hat, with big buck teeth.
    beaver(g) {
      const f = '#93592f', m = '#e2c29c';
      const fur = Sculpt('fur');
      fur.add(E(0, -0.04, 0, 0.54, 0.48, 0.48), f);
      fur.add(M(E(0.22, -0.18, 0.18, 0.26, 0.22, 0.26)), f, 0.12);
      fur.add(E(0, -0.2, 0.36, 0.22, 0.15, 0.16), m, 0.08);
      fur.add(M(S(0.38, 0.3, -0.02, 0.11)), f, 0.05).sub(M(E(0.39, 0.3, 0.06, 0.06, 0.06, 0.04)), 0.02, '#5c3418');
      fur.sub(M(S(0.2, 0.02, 0.4, 0.095)), 0.03);
      fur.sub(Cap([0, -0.14, 0.5], [0, -0.22, 0.5], 0.008), 0.01, '#5c3418');
      fur.paint(M(S(0.12, -0.2, 0.47, 0.012)), '#5c3418', 0.004).paint(M(S(0.16, -0.17, 0.45, 0.012)), '#5c3418', 0.004).paint(M(S(0.15, -0.24, 0.45, 0.012)), '#5c3418', 0.004);
      fur.add(bodyFur(), f, 0.12);
      fur.paint(E(0, -1.0, 0.38, 0.3, 0.34, 0.2), m, 0.03);
      mesh(g, fur);
      mesh(g, Sculpt('gloss').add(E(0, -0.1, 0.5, 0.07, 0.045, 0.04), '#2e1a10'));
      mesh(g, Sculpt('enamel').add(M(Box(0.032, -0.33, 0.44, 0.03, 0.06, 0.016, 0.012)), '#fffbf0'));
      eyes(g, 0.2, 0.02, 0.37, 0.08, { iris: '#4a2a14' });
      // the hard hat: a gloss dome with a ridge and a brim
      const hat = Sculpt('gloss');
      hat.add(And(E(0, 0.28, -0.02, 0.5, 0.36, 0.5), Box(0, 0.5, 0, 1, 0.22, 1)), '#f6c22c', 0.02);
      hat.add(And(E(0, 0.3, -0.02, 0.07, 0.39, 0.52), Box(0, 0.52, 0, 1, 0.22, 1)), '#ffd84a', 0.03);
      hat.add(Cyl(0, 0.3, 0.02, 0.6, 0.016, 0.012), '#e8b018', 0.02);
      const hg = new THREE.Group(); mesh(hg, hat); hg.rotation.set(-0.12, 0, 0.05); hg.position.set(0, 0.02, 0); g.add(hg);
    },
    // Zippy: a squirrel with a big plume of a tail and a sporty headband.
    squirrel(g) {
      const f = '#d2702a', m = '#f6e0c0';
      const fur = Sculpt('fur');
      fur.add(E(0, -0.02, 0, 0.48, 0.45, 0.45), f);
      fur.add(M(E(0.2, -0.16, 0.2, 0.22, 0.2, 0.22)), f, 0.12);
      fur.add(E(0, -0.18, 0.36, 0.17, 0.13, 0.14), m, 0.08);
      fur.paint(M(E(0.17, -0.18, 0.32, 0.12, 0.09, 0.1)), m, 0.03);
      // tall tufted ears
      fur.add(M(T(Cone([0, 0, 0], [0, 0.32, 0], 0.11, 0.025), [0.25, 0.32, -0.02], 0, 0, -0.32)), f, 0.08);
      fur.add(M(T(Cone([0, 0.3, 0], [0, 0.42, 0], 0.03, 0.012), [0.25, 0.32, -0.02], 0, 0, -0.42)), '#8a3e18', 0.03);
      fur.sub(M(T(Cone([0, 0.02, 0.06], [0, 0.28, 0.05], 0.06, 0.012), [0.25, 0.32, -0.02], 0, 0, -0.32)), 0.02, '#8a3e18');
      fur.sub(M(S(0.18, 0.03, 0.39, 0.095)), 0.03);
      fur.sub(M(Curve([[0, -0.22, 0.47], [0.025, -0.248, 0.46], [0.062, -0.228, 0.438]], 6, 0.012)), 0.008).paint(M(Curve([[0, -0.22, 0.47], [0.025, -0.248, 0.46], [0.062, -0.228, 0.438]], 6, 0.016)), '#7a3a1a', 0.006);
      fur.add(bodyFur(), f, 0.12);
      fur.paint(E(0, -1.0, 0.36, 0.28, 0.36, 0.2), m, 0.03);
      // the tail curls up behind the right shoulder
      fur.add(Curve([[0.3, -1.25, -0.4], [0.75, -0.9, -0.5], [0.85, -0.2, -0.45], [0.7, 0.35, -0.35], [0.4, 0.55, -0.3], [0.3, 0.4, -0.2]], 24, (t) => 0.16 + Math.sin(t * Math.PI) * 0.16), '#b8501c', 0.1);
      mesh(g, fur);
      mesh(g, Sculpt('gloss').add(R(E(0, -0.1, 0.49, 0.045, 0.032, 0.03), [0, -0.1, 0.49], -0.2, 0, 0), '#4a2414'));
      eyes(g, 0.18, 0.03, 0.35, 0.088, { iris: '#3a2010' });
      const band = Sculpt('silk');
      band.add(R(Shell(And(E(0, 0.12, 0, 0.5, 0.42, 0.47), Box(0, 0.24, 0, 1, 0.045, 1)), 0.016), [0, 0.12, 0], -0.25, 0, 0), '#d62a3a', 0.01);
      band.paint(R(Box(0, 0.24, 0, 1, 0.012, 1), [0, 0.12, 0], -0.25, 0, 0), '#ffffff', 0.006);
      mesh(g, band);
    },
    // Shelly: a tortoise leaning out of her domed shell, in a striped scarf.
    tortoise(g) {
      const sk = '#a8bc62', sh = '#7a4a1c', sc = '#c8903e';
      const skin = Sculpt('skin');
      skin.add(E(0, -0.02, 0.1, 0.42, 0.36, 0.4), sk);
      skin.add(E(0, -0.14, 0.36, 0.28, 0.2, 0.2), sk, 0.14);
      skin.add(Cone([0, -0.3, 0.0], [0, -0.95, -0.1], 0.27, 0.32), sk, 0.15);
      skin.sub(M(S(0.17, 0.02, 0.43, 0.085)), 0.03);
      skin.sub(Curve([[-0.17, -0.24, 0.48], [0, -0.29, 0.54], [0.17, -0.24, 0.48]], 8, 0.011), 0.012, '#4a5a2a');
      skin.paint(M(S(0.035, -0.1, 0.56, 0.012)), '#4a5a2a', 0.005);
      skin.paint(cells(0.09, 0.06, 2), '#bccc78', 0.01);
      mesh(g, skin);
      // the shell: a great dome behind her, its scutes edged in dark seams; a pale plastron in front
      const shell = Sculpt('horn');
      shell.add(And(E(0, -0.75, -0.62, 1.12, 1.02, 0.62), withBB((x, y, z) => z + 0.32, [-2, -2, -2, 2, 2, 2])), sc, 0.04);
      shell.paint(seams(0.32, 0.05, 4), sh, 0.01);
      shell.add(E(0, -1.24, 0.12, 0.62, 0.3, 0.3), '#e2d6a2', 0.08);
      shell.paint(withBB((x, y, z) => Math.abs(y + 1.12) - 0.008, [-2, -2, -2, 2, 2, 2]), '#b8a874', 0.004);
      shell.cut(BUST_Y);
      mesh(g, shell);
      eyes(g, 0.17, 0.02, 0.39, 0.08, { iris: '#3a2a12' }, 0.38);
      const scarf = Sculpt('velvet');
      scarf.add(Wrap(-0.5, 0.3, 0.09), '#f2e6c4', 0.04).add(R(E(0.2, -0.78, 0.36, 0.09, 0.24, 0.03), [0.2, -0.78, 0.36], -0.2, 0, 0.2), '#f2e6c4', 0.05);
      for (let i = 0; i < 9; i++) scarf.paint(withBB((x, y, z) => Math.abs(Math.sin(Math.atan2(x, z) * 4.5 + y * 6)) - 0.45, [-2, -2, -2, 2, 2, 2]), '#d0463a', 0.04);
      mesh(g, scarf);
    },
    // Rocco: a raccoon magician in a top hat, with a mask, white brows and cheek ruffs.
    raccoon(g) {
      const f = '#9a9ca8', w = '#f4f2ee', k = '#26262e';
      const fur = Sculpt('fur');
      fur.add(E(0, -0.02, 0, 0.5, 0.45, 0.45), f);
      fur.add(M(R(Cone([0.3, -0.12, 0.05], [0.62, -0.2, 0.0], 0.2, 0.03), [0.3, -0.12, 0.05], 0, 0, 0)), f, 0.12);
      fur.add(E(0, -0.18, 0.36, 0.16, 0.12, 0.15), w, 0.08);
      fur.paint(M(R(E(0.2, 0.02, 0.36, 0.22, 0.11, 0.2), [0.2, 0.02, 0.36], 0, 0, 0.18)), k, 0.03);
      fur.paint(M(R(E(0.2, 0.17, 0.36, 0.14, 0.035, 0.2), [0.2, 0.17, 0.36], 0, 0, -0.25)), w, 0.02);
      fur.paint(Cap([0, 0.08, 0.45], [0, 0.4, 0.3], 0.035), '#6c6e78', 0.02);
      fur.add(M(T(Cone([0, 0, 0], [0, 0.26, 0], 0.13, 0.03), [0.28, 0.3, -0.04], 0, 0, -0.38)), f, 0.08);
      fur.sub(M(T(Cone([0, 0.02, 0.06], [0, 0.22, 0.05], 0.08, 0.015), [0.28, 0.3, -0.04], 0, 0, -0.38)), 0.02, k);
      fur.paint(M(T(Cone([0, 0.16, 0.0], [0, 0.27, 0], 0.08, 0.04), [0.28, 0.3, -0.04], 0, 0, -0.38)), w, 0.02);
      fur.sub(M(S(0.19, 0.02, 0.39, 0.09)), 0.03);
      fur.sub(M(Curve([[0, -0.24, 0.49], [0.025, -0.268, 0.48], [0.062, -0.248, 0.458]], 6, 0.012)), 0.008).paint(M(Curve([[0, -0.24, 0.49], [0.025, -0.268, 0.48], [0.062, -0.248, 0.458]], 6, 0.016)), '#4a4a54', 0.006);
      mesh(g, fur);
      mesh(g, Sculpt('gloss').add(E(0, -0.12, 0.5, 0.065, 0.042, 0.04), '#141418'));
      eyes(g, 0.19, 0.02, 0.36, 0.085, { iris: '#6a4a2a' });
      // a dark coat over a scarlet waistcoat
      const coat = bust(null, '#2a2a34');
      coat.paint(Vee(-0.62, -1.24, 0.3), '#b8243a', 0.006);
      lapels(coat, '#1c1c24');
      mesh(g, coat);
      for (const y of [-1.0, -1.16]) ball(g, 0.022, MATS.gold(), [0, y, 0.43]);
      // the top hat with a red band and a playing card tucked in
      const hat = new THREE.Group();
      const silk = once('hatSilk', () => new THREE.MeshPhysicalMaterial({ color: '#22222c', roughness: 0.34, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color('#8a8aa0'), clearcoat: 0.4, clearcoatRoughness: 0.3 }));
      lathe(hat, [[0, 0], [0.5, 0], [0.52, 0.012], [0.5, 0.03], [0.32, 0.04], [0.3, 0.06], [0.31, 0.5], [0.33, 0.56], [0.32, 0.58], [0, 0.58]], silk);
      lathe(hat, [[0.305, 0.06], [0.312, 0.06], [0.318, 0.16], [0.31, 0.16]], MATS.gem('#b8243a'));
      const card = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.18, 0.006), once('card', () => new THREE.MeshPhysicalMaterial({ map: cardTex(), roughness: 0.4, clearcoat: 0.6 })));
      card.position.set(0.17, 0.2, 0.28); card.rotation.set(-0.1, 0.5, -0.2); hat.add(card);
      hat.position.set(0.02, 0.33, -0.04); hat.rotation.set(-0.1, 0, -0.14);
      g.add(hat);
    },
    // Ivy: a giraffe in round gold spectacles.
    giraffe(g) {
      const f = '#eebd5c', s = '#a8602a', m = '#f8e6c0';
      const fur = Sculpt('fur');
      fur.add(E(0, 0.04, -0.02, 0.4, 0.42, 0.4), f);
      fur.add(R(E(0, -0.24, 0.3, 0.27, 0.24, 0.24), [0, -0.24, 0.3], 0.3, 0, 0), m, 0.16);
      fur.paint(R(E(0, -0.3, 0.38, 0.27, 0.2, 0.2), [0, -0.3, 0.38], 0.3, 0, 0), m, 0.06);
      // ossicones with dark knobs, and ears out to the side
      fur.add(M(Cap([0.1, 0.32, -0.06], [0.14, 0.58, -0.1], 0.04)), f, 0.05);
      fur.add(M(S(0.14, 0.6, -0.1, 0.06)), '#6a3814', 0.03);
      fur.add(M(T(E(0, 0, 0, 0.2, 0.065, 0.08), [0.42, 0.12, -0.04], 0, 0.2, -0.35)), f, 0.05);
      fur.sub(M(T(E(0.02, 0, 0.04, 0.14, 0.035, 0.04), [0.42, 0.12, -0.04], 0, 0.2, -0.35)), 0.02, '#e8a4a0');
      // the long neck is the bust
      fur.add(Cone([0, -0.3, -0.12], [0, -1.32, -0.1], 0.3, 0.42), f, 0.15);
      fur.add(E(0, -1.3, -0.1, 0.9, 0.3, 0.45), f, 0.2);
      fur.cut(BUST_Y);
      const patches = cells(0.2, 0.09, 3), face = E(0, -0.1, 0.32, 0.36, 0.4, 0.32);
      fur.paint(withBB((x, y, z) => Math.max(patches(x, y, z), -face(x, y, z) - 0.02, y - 0.5), patches.bb), s, 0.008);
      fur.sub(M(S(0.17, 0.08, 0.34, 0.08)), 0.03);
      fur.sub(M(E(0.07, -0.26, 0.55, 0.025, 0.035, 0.03)), 0.01, '#6a3814');
      fur.sub(Curve([[-0.09, -0.42, 0.5], [0, -0.45, 0.53], [0.09, -0.42, 0.5]], 8, 0.009), 0.01, '#7a4a2a');
      mesh(g, fur);
      eyes(g, 0.17, 0.08, 0.31, 0.075, { iris: '#3a2210' }, 0.42);
      // round gold spectacles with glass
      for (const sx of [-1, 1]) {
        torus(g, 0.11, 0.012, MATS.gold(), [sx * 0.18, 0.07, 0.43], [0, sx * 0.25, 0]);
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.105, 40), MATS.lens('#e8f2ff')); lens.position.set(sx * 0.18, 0.07, 0.43); lens.rotation.y = sx * 0.25; g.add(lens);
      }
      tube(g, [[-0.08, 0.08, 0.46], [0, 0.11, 0.48], [0.08, 0.08, 0.46]], 0.01, MATS.gold());
    },
    // Onyx: a raven with a gold monocle on a chain and a purple cravat.
    raven(g) {
      const f = '#2a2e44';
      const fe = Sculpt('feather');
      fe.add(E(0, 0, 0, 0.47, 0.47, 0.46), f);
      fe.add(M(E(0.2, -0.16, 0.16, 0.22, 0.2, 0.24)), f, 0.12);
      fe.paint(E(0, 0.3, 0.25, 0.35, 0.12, 0.3), '#3c4262', 0.08);
      // a crest of feathers
      for (const [x, a, l] of [[-0.05, 0.25, 0.2], [0.03, 0.05, 0.26], [0.1, -0.2, 0.18]]) fe.add(Curve([[x, 0.38, 0.0], [x + a * 0.1, 0.5, -0.06], [x + a * 0.3, 0.38 + l, -0.26]], 8, (t) => 0.055 * (1 - t) + 0.01), f, 0.06);
      fe.sub(M(S(0.19, 0.03, 0.38, 0.1)), 0.03);
      fe.add(bodyFur(0.84), f, 0.12);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.22 + (r % 2) * 0.11, y = -0.82 - r * 0.15; fe.paint(R(E(x, y, 0, 0.11, 0.06, 1), [x, y, 0], 0, 0, 0), '#3a3f5a', 0.02); }
      mesh(g, fe);
      eyes(g, 0.19, 0.03, 0.35, 0.095, { iris: '#1a1a22', ring: '#c8cede', size: 0.42 });
      const beak = Sculpt('horn');
      beak.add(Cone([0, -0.1, 0.38], [0, -0.28, 0.78], 0.11, 0.015), '#3e4252', 0.02).add(E(0, -0.08, 0.42, 0.12, 0.08, 0.1), '#555a6e', 0.05);
      beak.sub(Box(0, -0.235, 0.6, 0.2, 0.004, 0.2, 0), 0.004, '#121318');
      mesh(g, beak);
      torus(g, 0.13, 0.014, MATS.gold(), [0.2, 0.03, 0.47], [0, 0.3, 0]);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.125, 40), MATS.lens('#dceaff')); lens.position.set(0.2, 0.03, 0.47); lens.rotation.y = 0.3; g.add(lens);
      tube(g, [[0.32, -0.04, 0.42], [0.42, -0.3, 0.38], [0.38, -0.6, 0.36], [0.24, -0.8, 0.4]], 0.007, MATS.gold());
      const crav = Sculpt('silk');
      crav.add(Wrap(-0.52, 0.32, 0.06), '#6a4a9a', 0.04);
      crav.add(Or(R(E(-0.09, -0.6, 0.32, 0.1, 0.06, 0.04), [-0.09, -0.6, 0.32], 0, 0, 0.3), R(E(0.09, -0.6, 0.32, 0.1, 0.06, 0.04), [0.09, -0.6, 0.32], 0, 0, -0.3)), '#6a4a9a', 0.03);
      crav.add(S(0, -0.6, 0.35, 0.035), '#583a86', 0.02);
      mesh(g, crav);
      jewel(g, 0.022, '#c8b0ff', [0, -0.6, 0.39]);
    },
    // Ember: a little red dragon with gold horns and a tiny crown.
    dragon(g) {
      const f = '#d0402a', b = '#f6c070';
      const sk = Sculpt('skin');
      sk.add(E(0, 0, 0, 0.5, 0.45, 0.46), f);
      sk.add(E(0, -0.16, 0.36, 0.26, 0.16, 0.2), '#ec7a50', 0.1);
      sk.sub(M(E(0.07, -0.1, 0.55, 0.02, 0.015, 0.03)), 0.01, '#5a1208');
      sk.add(M(R(E(0.2, 0.12, 0.38, 0.13, 0.04, 0.06), [0.2, 0.13, 0.38], 0, 0, -0.06)), '#a82818', 0.04);
      sk.sub(M(S(0.19, 0.03, 0.39, 0.09)), 0.03);
      sk.sub(Curve([[-0.18, -0.27, 0.46], [0, -0.3, 0.52], [0.18, -0.27, 0.46]], 8, 0.011), 0.012, '#5a1208');
      // ear fins
      sk.add(M(T(Or(Cone([0, 0, 0], [0.3, 0.1, 0], 0.08, 0.015), Cone([0, 0, 0], [0.26, -0.08, 0], 0.07, 0.012)), [0.42, 0.02, -0.06], 0, -0.3, 0)), '#b83020', 0.06);
      sk.add(bodyFur(0.78), f, 0.12);
      for (let i = 0; i < 4; i++) sk.paint(R(E(0, -0.8 - i * 0.13, 0.4, 0.24 + i * 0.01, 0.055, 0.2), [0, -0.8 - i * 0.13, 0.4], 0.1, 0, 0), b, 0.015);
      sk.paint(Cone([0, -1.3, 0.42], [0, -0.7, 0.3], 0.3, 0.2), '#f0a860', 0.06);
      // spines down the back of the head
      for (let i = 0; i < 4; i++) { const a = -0.3 - i * 0.45; sk.add(T(Cone([0, 0, 0], [0, 0.14, 0], 0.06, 0.008), [0, Math.cos(a) * 0.46, Math.sin(a) * 0.46], a + Math.PI / 2 - 0.2, 0, 0), '#f0a040', 0.03); }
      mesh(g, sk);
      eyes(g, 0.19, 0.03, 0.35, 0.1, { iris: '#f4b030', slit: true, ring: '#5a1208', size: 0.44 });
      const horn = Sculpt('gold');
      horn.add(M(Curve([[0.2, 0.32, -0.02], [0.3, 0.52, -0.1], [0.34, 0.7, -0.24], [0.3, 0.78, -0.36]], 14, (t) => 0.07 * (1 - t) + 0.008)), '#e8b450', 0.03);
      mesh(g, horn, MATS.gold());
      crownMesh(g, 0.17, 0.42, 0.04, 0.6);
      // a puff of smoke
      for (const [x, y, r] of [[0.62, -0.1, 0.05], [0.7, -0.02, 0.07], [0.8, 0.06, 0.05]]) ball(g, r, once('smoke', () => new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.9, transparent: true, opacity: 0.55 })), [x, y, 0.3]);
    },
    // Rooky: the coach, a cheerful chestnut horse with a white blaze, a big golden mane and
    // forelock, a wide grin and his ruby scarf.
    horse(g) {
      const f = '#c06a2c', w = '#fbf1e2', mz = '#f2cba2', mane = '#f6d27c', maneD = '#dca444';
      const fur = Sculpt('fur');
      // the round crown of the head, full cheeks, and a soft muzzle reaching forward
      fur.add(E(0, 0.1, -0.04, 0.4, 0.4, 0.4), f);
      fur.add(M(E(0.2, -0.04, 0.1, 0.2, 0.24, 0.24)), f, 0.14);
      fur.add(Cone([0, 0.04, 0.18], [0, -0.2, 0.42], 0.27, 0.25), f, 0.14);
      fur.add(E(0, -0.26, 0.44, 0.27, 0.2, 0.22), mz, 0.1);
      fur.paint(E(0, -0.3, 0.48, 0.28, 0.19, 0.22), mz, 0.05);
      // the white blaze from the brow down the nose, widening onto the muzzle
      fur.paint(Cone([0, 0.34, 0.36], [0, -0.1, 0.62], 0.045, 0.11), w, 0.03);
      // pointed ears, pricked up and a little out, dark inside
      fur.add(M(T(Cone([0, -0.05, 0], [0, 0.21, 0.0], 0.085, 0.02), [0.23, 0.42, -0.08], -0.1, -0.35, -0.42)), f, 0.07);
      fur.sub(M(T(E(0, 0.06, 0.05, 0.045, 0.12, 0.03), [0.23, 0.42, -0.08], -0.1, -0.35, -0.42)), 0.02, '#8a3e1e');
      // eye sockets, round nostrils
      fur.sub(M(S(0.22, 0.13, 0.3, 0.108)), 0.03);
      fur.sub(M(R(E(0.11, -0.22, 0.645, 0.038, 0.05, 0.04), [0.11, -0.22, 0.645], 0, 0, -0.35)), 0.016, '#6a3020');
      // a big open grin: a smiling mouth with a pink tongue, cheeks pushed up at its corners
      const grin = withBB((x, y, z) => Math.max(y - (-0.33 + 1.6 * x * x), (-0.41 + 2.2 * x * x) - y, Math.abs(x) - 0.2, 0.53 - z), [-0.2, -0.42, 0.5, 0.2, -0.26, 0.72]);
      fur.sub(grin, 0.01);
      fur.add(M(S(0.195, -0.265, 0.575, 0.034)), mz, 0.04);
      // a strong neck into the shoulders
      fur.add(Cone([0, -0.18, -0.16], [0, -0.86, -0.12], 0.33, 0.44), f, 0.18);
      fur.add(bodyFur(0.84), f, 0.12);
      mesh(g, fur);
      mesh(g, Sculpt('skin').add(E(0, -0.36, 0.545, 0.2, 0.08, 0.03), '#4a1418', 0));
      const tongue = Sculpt('gloss').add(E(0, -0.395, 0.585, 0.08, 0.03, 0.05), '#e2607a', 0.02);
      mesh(g, tongue);
      const teeth = Sculpt('enamel').add(Curve([[-0.12, -0.31, 0.62], [0, -0.338, 0.645], [0.12, -0.31, 0.62]], 10, 0.017), '#fffdf8', 0.01);
      mesh(g, teeth);
      eyes(g, 0.225, 0.13, 0.3, 0.106, { iris: '#5a3216', size: 0.5 }, 0.46, 0.08);
      // the mane: a big swept forelock over the brow, and a crest of locks down the neck,
      // falling to one side
      const hair = Sculpt('fur');
      // the forelock: a soft, fluffy quiff swept forward from the poll
      [[0.0, 0.6, 0.12, 0.2, 0.36, 0.36, 0.14], [-0.12, 0.58, 0.06, -0.2, 0.38, 0.3, 0.11], [0.12, 0.62, 0.02, 0.3, 0.44, 0.2, 0.11]].forEach(([mx, my, mz2, ex, ey, ez, r]) => {
        hair.add(Curve([[mx * 0.3, 0.42, -0.1], [mx, my, mz2], [(mx + ex) * 0.6, (my + ey) * 0.5 + 0.05, (mz2 + ez) * 0.55], [ex, ey, ez]], 14, (t) => r * (1 - t * 0.65)), mane, 0.09);
      });
      // the mane: a thick, wavy crest along the neck, falling over to one side
      for (let i = 0; i < 10; i++) {
        const y = 0.38 - i * 0.12, zc = -0.16 - (0.32 + (0.38 - y) * 0.1), wv = Math.sin(i * 1.3) * 0.03;
        hair.add(T(E(0, 0, 0, 0.1, 0.17, 0.13), [-0.13 + wv, y - 0.06, zc + 0.05], 0.15, -0.5, 0.55), i % 2 ? mane : maneD, 0.1);
      }
      hair.paint(Box(0, -0.7, -0.3, 1, 0.45, 1, 0), maneD, 0.3);
      hair.cut(-1.05);
      mesh(g, hair);
      // the ruby scarf Rooky always wears
      const scarf = Sculpt('velvet');
      scarf.add(Wrap(-0.7, 0.41, 0.1), '#b8325a', 0.04).add(R(Cone([0.18, -0.72, 0.34], [0.3, -1.1, 0.4], 0.08, 0.035), [0.18, -0.72, 0.34], 0, 0, 0.18), '#a02a4e', 0.05);
      mesh(g, scarf);
      jewel(g, 0.035, '#d0103a', [-0.17, -0.72, 0.38], [-0.3, -0.1, 1]);
      // a long face: the whole bust sits a touch smaller so the ears stay in the medal
      g.scale.setScalar(0.9); g.position.y = -0.05;
    },
    // Miu: the black cat of the Nile, kohl-eyed, with a gold scarab and a usekh collar.
    cat(g) {
      const f = '#2a2632';
      const fur = Sculpt('fur');
      fur.add(E(0, 0, 0, 0.48, 0.43, 0.44), f);
      fur.add(M(E(0.18, -0.16, 0.2, 0.22, 0.18, 0.22)), f, 0.12);
      fur.add(E(0, -0.17, 0.36, 0.15, 0.11, 0.13), '#3a3442', 0.07);
      fur.add(M(T(Cone([0, 0, 0], [0, 0.36, 0], 0.15, 0.02), [0.24, 0.28, -0.04], -0.1, 0, -0.32)), f, 0.08);
      fur.sub(M(T(Cone([0, 0.02, 0.07], [0, 0.3, 0.05], 0.1, 0.012), [0.24, 0.28, -0.04], -0.1, 0, -0.32)), 0.02, '#5a3a4a');
      fur.sub(M(R(E(0.18, 0.03, 0.39, 0.1, 0.07, 0.08), [0.18, 0.03, 0.39], 0, 0, 0.12)), 0.03);
      // kohl wings
      fur.paint(M(R(Cap([0.14, 0.0, 0.43], [0.36, 0.06, 0.3], 0.018), [0.14, 0, 0.43], 0, 0, 0)), '#06040a', 0.006);
      fur.paint(M(R(Shell(E(0.18, 0.03, 0.39, 0.1, 0.07, 0.08), 0.012), [0.18, 0.03, 0.39], 0, 0, 0.12)), '#06040a', 0.008);
      fur.sub(M(Curve([[0, -0.22, 0.47], [0.025, -0.248, 0.46], [0.062, -0.228, 0.438]], 6, 0.012)), 0.008).paint(M(Curve([[0, -0.22, 0.47], [0.025, -0.248, 0.46], [0.062, -0.228, 0.438]], 6, 0.016)), '#8a7a8a', 0.006);
      fur.add(bodyFur(0.76), f, 0.12);
      mesh(g, fur);
      mesh(g, Sculpt('gloss').add(R(Cone([0, -0.1, 0.49], [0, -0.15, 0.49], 0.035, 0.012), [0, -0.12, 0.49], 0, 0, 0), '#c87080'));
      eyes(g, 0.18, 0.03, 0.36, 0.075, { iris: '#38c07a', slit: true, size: 0.46 }, 0.36);
      // whiskers
      for (const sx of [-1, 1]) for (const [dy, a] of [[0, 0.05], [-0.03, -0.1]]) tube(g, [[sx * 0.12, -0.15 + dy, 0.47], [sx * 0.35, -0.13 + dy + a * 0.5, 0.42], [sx * 0.55, -0.12 + dy + a, 0.32]], 0.0035, once('whisker', () => new THREE.MeshStandardMaterial({ color: '#d8d0e0', roughness: 0.4 })));
      // the scarab on the brow and a gold hoop earring
      const scarab = Sculpt('gold').add(E(0, 0.3, 0.38, 0.06, 0.075, 0.035), '#e8b450').add(M(Cap([0.03, 0.31, 0.39], [0.08, 0.33, 0.37], 0.008)), '#e8b450', 0.01);
      scarab.sub(Box(0, 0.3, 0.42, 0.003, 0.06, 0.02, 0), 0.004);
      mesh(g, scarab, MATS.gold());
      torus(g, 0.05, 0.009, MATS.gold(), [-0.36, 0.32, 0.0], [0.2, 0.5, 0.4]);
      // the usekh: rows of lapis, turquoise and carnelian beads between gold bands
      const coat = bust(null, '#1c1a24'); mesh(g, coat);
      collar(g, [['#e8c070', 0.28, 0.34, 1], ['#2a4aa8', 0.34, 0.42], ['#e8c070', 0.42, 0.45, 1], ['#3ab0a0', 0.45, 0.53], ['#e8c070', 0.53, 0.56, 1], ['#c8442e', 0.56, 0.64], ['#e8c070', 0.64, 0.68, 1], ['#2a4aa8', 0.68, 0.74], ['#e8c070', 0.74, 0.78, 1]]);
      const drops = new THREE.Group();
      for (let i = 0; i < 17; i++) { const a = -1.5 + i * (3 / 16); ball(drops, 0.024, MATS.gem(i % 2 ? '#3ab0a0' : '#c8442e'), [Math.sin(a) * 0.8, -0.98 + Math.cos(a) * 0.1, Math.cos(a) * 0.43 - 0.05]); }
      g.add(drops);
    },
    // Sophie: the owl of Athens in a laurel wreath, with great amber eyes.
    owl(g) {
      const f = '#957048', disc = '#efe2c6';
      const fe = Sculpt('feather');
      fe.add(E(0, 0, 0, 0.53, 0.48, 0.46), f);
      fe.add(M(E(0.2, -0.04, 0.26, 0.23, 0.25, 0.2)), disc, 0.1);
      fe.paint(M(Shell(E(0.2, -0.04, 0.26, 0.23, 0.25, 0.2), 0.02)), '#c8b48a', 0.02);
      fe.add(M(T(Cone([0, 0, 0], [0, 0.22, -0.04], 0.09, 0.015), [0.3, 0.32, 0.02], 0, 0, -0.45)), f, 0.06);
      fe.sub(M(S(0.2, -0.02, 0.4, 0.13)), 0.03);
      for (const [x, y] of [[0.22, 0.32], [0.1, 0.38], [0, 0.4], [-0.1, 0.38], [-0.22, 0.32], [0.32, 0.2], [-0.32, 0.2]]) fe.paint(S(x, y, Math.sqrt(Math.max(0, 0.46 * 0.46 - x * x * 0.8 - y * y * 0.9)), 0.022), '#ffffff', 0.006);
      fe.add(bodyFur(0.86), f, 0.12);
      fe.paint(E(0, -1.05, 0.32, 0.36, 0.4, 0.2), '#f2e6cc', 0.06);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r % 2); i++) fe.paint(Curve([[-0.04, 0, 0], [0, -0.03, 0], [0.04, 0]].map((p) => [p[0] + (i - 1.5 + (r % 2) * 0.5) * 0.15, p[1] - 0.8 - r * 0.13, 0.44 - Math.abs(i - 1.5) * 0.02]), 4, 0.008), '#8a6a40', 0.006);
      mesh(g, fe);
      eyes(g, 0.2, -0.02, 0.33, 0.125, { iris: '#ffbe2a', ring: '#3a2a10', size: 0.44, pupil: 0.5 }, 0.2);
      const beak = Sculpt('horn').add(R(Cone([0, -0.08, 0.44], [0, -0.26, 0.5], 0.06, 0.015), [0, -0.08, 0.44], 0, 0, 0), '#d8b878');
      mesh(g, beak);
      laurel(g, 0.47, 0.44, 0.24, once('leafGreen', () => new THREE.MeshPhysicalMaterial({ color: '#6a8e48', roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.4 })), MATS.gem('#3a4a8a'), -0.2);
    },
    // Marcus: the Roman wolf in a gold laurel crown and a scarlet cloak with a gold brooch.
    wolf(g) {
      const f = '#8a8e9a', w = '#efece6';
      const fur = Sculpt('fur');
      fur.add(E(0, 0.02, 0, 0.48, 0.44, 0.44), f);
      fur.add(M(R(Cone([0.28, -0.1, 0.04], [0.6, -0.28, -0.02], 0.2, 0.03), [0.28, -0.1, 0.04], 0, 0, 0)), f, 0.12);
      fur.add(R(Cone([0, -0.05, 0.25], [0, -0.16, 0.56], 0.17, 0.09), [0, -0.05, 0.25], 0, 0, 0), w, 0.1);
      fur.paint(M(R(E(0.22, -0.2, 0.3, 0.22, 0.14, 0.24), [0.22, -0.2, 0.3], 0, 0, -0.2)), w, 0.04);
      fur.paint(Cap([0, 0.1, 0.42], [0, 0.42, 0.25], 0.05), '#5e626e', 0.04);
      fur.add(M(T(Cone([0, 0, 0], [0, 0.32, 0], 0.13, 0.02), [0.24, 0.3, -0.06], -0.1, 0, -0.3)), f, 0.08);
      fur.sub(M(T(Cone([0, 0.02, 0.06], [0, 0.27, 0.05], 0.085, 0.012), [0.24, 0.3, -0.06], -0.1, 0, -0.3)), 0.02, '#5a4048');
      fur.sub(M(R(E(0.17, 0.06, 0.38, 0.09, 0.07, 0.08), [0.17, 0.06, 0.38], 0, 0, 0.15)), 0.03);
      fur.sub(Curve([[-0.1, -0.27, 0.48], [0, -0.3, 0.52], [0.1, -0.27, 0.48]], 8, 0.009), 0.01, '#4a4650');
      fur.add(Cone([0, -0.3, -0.04], [0, -0.7, -0.06], 0.3, 0.36), f, 0.12);
      mesh(g, fur);
      mesh(g, Sculpt('gloss').add(E(0, -0.12, 0.6, 0.075, 0.05, 0.05), '#16141a'));
      eyes(g, 0.17, 0.06, 0.37, 0.075, { iris: '#e8a83a' }, 0.36);
      // the cloak, gathered on one shoulder with a brooch
      const cl = bust(null, '#a01c2a', { kind: 'velvet' });
      cl.add(Wrap(-0.57, 0.37, 0.08, 0.1), '#c02a38', 0.05);
      cl.paint(Vee(-0.66, -1.3, 0.16), '#efe6d2', 0.008);
      mesh(g, cl);
      jewel(g, 0.06, '#c8243e', [-0.36, -0.8, 0.3], [-0.4, 0.4, 1]);
      torus(g, 0.075, 0.018, MATS.gold(), [-0.36, -0.8, 0.3]).lookAt(-0.76, -0.4, 1.3);
      laurel(g, 0.44, 0.42, 0.26, MATS.gold(), null, -0.15);
    },
    // Moti: a Mughal elephant with a jewelled headpiece, curled trunk and a gold-edged saddle cloth.
    elephant(g) {
      const f = '#a2a4b6', pink = '#e8b4b8';
      const sk = Sculpt('skin');
      sk.add(E(0, 0.04, -0.02, 0.48, 0.47, 0.44), f);
      sk.add(Curve([[0, -0.05, 0.36], [0, -0.32, 0.48], [0, -0.55, 0.5], [0.08, -0.7, 0.52], [0.22, -0.68, 0.5], [0.26, -0.56, 0.5]], 26, (t) => 0.15 * (1 - t) + 0.045), f, 0.08);
      for (let i = 0; i < 6; i++) sk.paint(Tor(0, -0.25 - i * 0.07, 0.46, 0.1, 0.006), '#8a8c9e', 0.004);
      // great ears, pink inside
      sk.add(M(T(E(0, 0, 0, 0.36, 0.4, 0.06), [0.55, -0.08, -0.08], 0.05, 0.55, 0.1)), f, 0.08);
      sk.sub(M(T(E(0.02, -0.02, 0.06, 0.28, 0.32, 0.05), [0.55, -0.08, -0.08], 0.05, 0.55, 0.1)), 0.03, pink);
      sk.sub(M(S(0.2, 0.06, 0.37, 0.07)), 0.03);
      mesh(g, sk);
      eyes(g, 0.2, 0.06, 0.34, 0.065, { iris: '#3a2a20' }, 0.4);
      const tusk = Sculpt('enamel').add(M(Curve([[0.12, -0.3, 0.4], [0.2, -0.42, 0.5], [0.24, -0.46, 0.62]], 10, (t) => 0.04 * (1 - t) + 0.008)), '#fffbee');
      mesh(g, tusk);
      // the headpiece: a gold band with a ruby drop down the brow
      const hp = Sculpt('gold');
      hp.add(R(Shell(And(E(0, 0.08, -0.02, 0.49, 0.48, 0.45), Box(0, 0.36, 0, 1, 0.025, 1)), 0.014), [0, 0.08, 0], -0.35, 0, 0), '#e8b450', 0.01);
      mesh(g, hp, MATS.gold());
      jewel(g, 0.06, '#d01a44', [0, 0.32, 0.42], [0, 0.4, 1]);
      ball(g, 0.026, MATS.pearl(), [0, 0.2, 0.46]);
      for (const sx of [-1, 1]) jewel(g, 0.03, '#2a8a5a', [sx * 0.22, 0.38, 0.32], [sx * 0.5, 0.6, 1]);
      // the saddle cloth: green velvet with a gold hem and studs
      const cloth = bust(null, '#0f5a3e', { kind: 'velvet' });
      cloth.paint(Box(0, -0.62, 0, 1, 0.06, 1, 0), '#d8a848', 0.01);
      mesh(g, cloth);
      beads(g, 0.62, 0.42, -0.83, 15, 0.022, MATS.gold(), -1.7, 1.7, 0.18, -0.02);
    },
    // Bao: a panda in a red silk jacket with a gold collar and a sprig of bamboo.
    panda(g) {
      const w = '#f6f3ec', k = '#1e1c22';
      const fur = Sculpt('fur');
      fur.add(E(0, -0.02, 0, 0.55, 0.48, 0.48), w);
      fur.add(M(E(0.22, -0.18, 0.18, 0.25, 0.22, 0.26)), w, 0.12);
      fur.add(E(0, -0.18, 0.37, 0.18, 0.12, 0.14), '#ffffff', 0.08);
      fur.add(M(S(0.36, 0.34, -0.04, 0.14)), k, 0.06);
      fur.paint(M(R(E(0.2, 0.0, 0.38, 0.12, 0.16, 0.2), [0.2, 0.0, 0.38], 0, 0, -0.5)), k, 0.03);
      fur.sub(M(S(0.19, 0.03, 0.4, 0.075)), 0.03);
      fur.sub(M(Curve([[0, -0.25, 0.49], [0.025, -0.278, 0.48], [0.062, -0.258, 0.458]], 6, 0.012)), 0.008).paint(M(Curve([[0, -0.25, 0.49], [0.025, -0.278, 0.48], [0.062, -0.258, 0.458]], 6, 0.016)), '#3a3640', 0.006);
      mesh(g, fur);
      mesh(g, Sculpt('gloss').add(E(0, -0.14, 0.5, 0.07, 0.045, 0.04), '#141218'));
      eyes(g, 0.19, 0.03, 0.37, 0.07, { iris: '#3a2a20', ring: '#141216' });
      const coat = bust(null, '#c02c26', { kind: 'silk' });
      coat.add(Tor(0, -0.58, 0, 0.29, 0.05), '#d8a848', 0.04);
      coat.paint(Cap([0.0, -0.7, 0.43], [0.0, -1.3, 0.45], 0.02), '#d8a848', 0.01);
      for (const y of [-0.9, -1.1]) coat.paint(Cap([-0.12, y, 0.44], [0.12, y, 0.44], 0.014), '#d8a848', 0.008);
      for (let i = 0; i < 6; i++) { const a = -1.1 + i * 0.44; coat.paint(S(Math.sin(a) * 0.7, -0.98 + Math.cos(a * 2) * 0.1, Math.cos(a) * 0.44, 0.05), '#e05a40', 0.02); }
      mesh(g, coat);
      for (const y of [-0.9, -1.1]) ball(g, 0.024, MATS.gold(), [0, y, 0.47]);
      // bamboo behind the right ear
      const bamboo = once('bamboo', () => new THREE.MeshPhysicalMaterial({ color: '#7ab04a', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 }));
      const bg = new THREE.Group();
      lathe(bg, [[0, 0], [0.03, 0], [0.03, 0.18], [0.034, 0.19], [0.03, 0.2], [0.03, 0.38], [0.034, 0.39], [0.03, 0.4], [0.03, 0.58], [0, 0.58]], bamboo, null, null, 20);
      for (const [y, a] of [[0.36, 0.9], [0.5, -0.8], [0.56, 0.5]]) leaf(bg, [Math.sin(a) * 0.08, y + 0.04, 0], [Math.sin(a), 0.7, 0], 0.2, once('leafB', () => new THREE.MeshPhysicalMaterial({ color: '#5a9a3a', roughness: 0.45, clearcoat: 0.5, side: THREE.DoubleSide })), 0.05);
      bg.position.set(-0.42, 0.18, -0.12); bg.rotation.set(-0.2, 0, 0.55);
      g.add(bg);
    },
    // Marco: the winged lion of Saint Mark, maned, in a blue coat with a gold collar and halo.
    lion(g) {
      const f = '#e6b25a', mane = '#a8581f';
      const fur = Sculpt('fur');
      fur.add(E(0, 0, 0.04, 0.42, 0.42, 0.4), f);
      fur.add(M(E(0.1, -0.17, 0.4, 0.13, 0.1, 0.1)), '#fae6bc', 0.06);
      fur.add(E(0, -0.28, 0.34, 0.12, 0.08, 0.1), '#fae6bc', 0.06);
      fur.add(R(Cone([0, 0.12, 0.3], [0, -0.06, 0.44], 0.1, 0.08), [0, 0.12, 0.3], 0, 0, 0), f, 0.08);
      fur.add(M(S(0.3, 0.33, 0.04, 0.09)), f, 0.04);
      fur.sub(M(E(0.3, 0.33, 0.12, 0.05, 0.05, 0.03)), 0.02, '#8a4a1a');
      fur.sub(M(S(0.17, 0.06, 0.38, 0.075)), 0.03);
      fur.sub(Curve([[-0.1, -0.22, 0.5], [0, -0.2, 0.51], [0.1, -0.22, 0.5]], 6, 0.007), 0.008, '#7a3a1a');
      fur.paint(M(S(0.1, -0.15, 0.5, 0.008)), '#7a4a1a', 0.004).paint(M(S(0.15, -0.18, 0.48, 0.008)), '#7a4a1a', 0.004);
      fur.add(Cone([0, -0.3, -0.04], [0, -0.7, -0.06], 0.3, 0.36), f, 0.12);
      mesh(g, fur);
      // the mane: tufts swept back from the face in rings, darker towards the back
      const mn = Sculpt('fur');
      mn.add(E(0, -0.02, -0.16, 0.6, 0.6, 0.34), mane, 0.1);
      for (let ring = 0; ring < 2; ring++) for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + ring * 0.2, rr = 0.42 + ring * 0.14, x = Math.sin(a) * rr, y = Math.cos(a) * rr * 0.98;
        mn.add(Curve([[x * 0.8, y * 0.8, 0.12 - ring * 0.12], [x * 1.05, y * 1.05, 0.0 - ring * 0.12], [x * 1.22 + Math.sin(a + 0.4) * 0.05, y * 1.2 - 0.04, -0.14 - ring * 0.12]], 6, (t) => 0.1 * (1 - t) + 0.035), ring ? mane : '#c47834', 0.07);
      }
      mn.sub(E(0, -0.04, 0.26, 0.38, 0.4, 0.2), 0.08);
      mesh(g, mn);
      mesh(g, Sculpt('gloss').add(R(Cone([0, -0.07, 0.5], [0, -0.13, 0.5], 0.06, 0.025), [0, -0.1, 0.5], 0, 0, 0), '#6a3018'));
      eyes(g, 0.17, 0.06, 0.36, 0.07, { iris: '#c88228' }, 0.36);
      const coat = bust(null, '#1a3a8a', { kind: 'velvet' });
      coat.paint(Vee(-0.66, -1.28, 0.18), '#f6efe0', 0.008);
      mesh(g, coat);
      torus(g, 0.4, 0.04, MATS.gold(), [0, -0.66, 0.0], [Math.PI / 2 + 0.2, 0, 0]);
      jewel(g, 0.045, '#c8243e', [0, -0.74, 0.41], [0, 0.2, 1]);
      // the halo and the wings
      torus(g, 0.66, 0.022, MATS.gold(), [0, 0.06, -0.5]);
      const wingMat = once('wing', () => new THREE.MeshPhysicalMaterial({ color: '#f8ead0', roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.6, sheenColor: new THREE.Color('#ffe8b0') }));
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 7; i++) {
          const a = 0.2 + i * 0.17, len = 0.95 - i * 0.07;
          leaf(g, [sx * (0.62 + Math.sin(a) * len * 0.45), -0.72 + Math.cos(a) * len * 0.45, -0.55 - i * 0.01], [sx * Math.sin(a), Math.cos(a), 0], len, i % 2 ? wingMat : MATS.paleGold(), len * 0.22);
        }
      }
    },
    // Mishka: a Russian bear in a fur hat with a velvet crown and a jewelled egg, in a frogged coat.
    bear(g) {
      const f = '#86522f', m = '#dcb88c';
      const fur = Sculpt('fur');
      fur.add(E(0, -0.02, 0, 0.54, 0.48, 0.48), f);
      fur.add(M(E(0.22, -0.18, 0.18, 0.25, 0.22, 0.26)), f, 0.12);
      fur.add(E(0, -0.18, 0.36, 0.2, 0.15, 0.16), m, 0.08);
      fur.add(M(S(0.38, 0.32, -0.04, 0.13)), f, 0.05).sub(M(E(0.39, 0.32, 0.06, 0.07, 0.07, 0.04)), 0.02, m);
      fur.sub(M(S(0.2, 0.03, 0.4, 0.085)), 0.03);
      fur.sub(Curve([[-0.09, -0.27, 0.48], [0, -0.3, 0.51], [0.09, -0.27, 0.48]], 8, 0.009), 0.01, '#4a2a18');
      mesh(g, fur);
      mesh(g, Sculpt('gloss').add(E(0, -0.1, 0.51, 0.085, 0.055, 0.045), '#24140c'));
      eyes(g, 0.2, 0.03, 0.37, 0.08, { iris: '#4a2a14' });
      const coat = bust(null, '#0f5a3e', { kind: 'velvet' });
      mesh(g, coat);
      for (const y of [-0.82, -0.97, -1.12]) { tube(g, [[-0.16, y, 0.43], [0, y - 0.02, 0.46], [0.16, y, 0.43]], 0.014, MATS.gold()); ball(g, 0.024, MATS.gold(), [0, y - 0.02, 0.47]); }
      // the hat: a fur band, a green velvet crown with gold cross bands, and a little egg
      const hg = new THREE.Group();
      const band = Sculpt('fur').add(Tor(0, 0, 0, 0.36, 0.1), '#5a3a2a', 0.04);
      mesh(hg, band);
      const crown = Sculpt('velvet').add(And(E(0, 0.02, 0, 0.36, 0.28, 0.36), Box(0, 0.2, 0, 1, 0.2, 1)), '#0f6a46', 0.02);
      mesh(hg, crown);
      for (const a of [0, Math.PI / 2]) torus(hg, 0.3, 0.012, MATS.gold(), [0, 0.02, 0], [0, a, 0], Math.PI).rotation.z = 0;
      const egg = new THREE.Group();
      ball(egg, 0.07, MATS.gem('#d23a6a'), [0, 0, 0], [1, 1.3, 1]);
      torus(egg, 0.071, 0.008, MATS.gold(), [0, 0, 0], [Math.PI / 2, 0, 0]);
      torus(egg, 0.07, 0.008, MATS.gold(), [0, 0, 0], [0, 0, 0]);
      egg.position.set(0, 0.06, 0.4); hg.add(egg);
      hg.position.set(0, 0.36, -0.03); hg.rotation.set(-0.18, 0, 0.06);
      g.add(hg);
    },
    // Gaston: a Parisian rooster in a beret and blue coat, with a tricolour rosette.
    rooster(g) {
      const w = '#faf2e2', cb = '#d0283a';
      const fe = Sculpt('feather');
      fe.add(E(0, 0, 0, 0.46, 0.46, 0.44), w);
      fe.add(M(E(0.18, -0.18, 0.18, 0.22, 0.22, 0.24)), w, 0.12);
      fe.paint(M(E(0.3, -0.3, 0.2, 0.16, 0.14, 0.2)), '#e8c080', 0.06);
      fe.sub(M(S(0.19, 0.04, 0.37, 0.088)), 0.03);
      fe.add(bodyFur(0.76), w, 0.12);
      mesh(g, fe);
      eyes(g, 0.19, 0.04, 0.34, 0.085, { iris: '#5a3a1a', ring: '#f0c040', size: 0.36 });
      const comb = Sculpt('skin');
      comb.add(Or(E(0, 0.5, 0.2, 0.05, 0.11, 0.09), E(0, 0.62, 0.06, 0.055, 0.14, 0.1), E(0, 0.6, -0.1, 0.05, 0.13, 0.09), E(0, 0.5, -0.24, 0.045, 0.1, 0.08)), cb, 0.06);
      comb.add(Box(0, 0.42, 0, 0.04, 0.08, 0.3, 0.04), cb, 0.08);
      comb.add(M(E(0.05, -0.38, 0.38, 0.06, 0.1, 0.05)), cb, 0.05);
      mesh(g, comb);
      const beak = Sculpt('horn');
      beak.add(Cone([0, -0.12, 0.38], [0, -0.2, 0.66], 0.1, 0.02), '#f0a820', 0.02);
      beak.sub(Box(0, -0.17, 0.55, 0.2, 0.003, 0.2, 0), 0.004, '#a86010');
      mesh(g, beak);
      // tail feathers fan up behind
      const plume = (c) => once('plume' + c, () => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.8, sheenColor: new THREE.Color(c).lerp(new THREE.Color('#ffffff'), 0.5), iridescence: 0.5, side: THREE.DoubleSide }));
      [['#1d6a4a', 0.5, 1.0], ['#c86a1a', 0.75, 0.9], ['#1d4a8a', 1.0, 0.8], ['#1d6a4a', 1.25, 0.7]].forEach(([c, a, len]) => {
        for (const sx of [-1, 1]) leaf(g, [sx * (0.45 + Math.sin(a) * len * 0.4), -0.55 + Math.cos(a) * len * 0.45, -0.5], [sx * Math.sin(a), Math.cos(a), -0.2], len, plume(c), len * 0.16);
      });
      const coat = bust(null, '#1f3a8a', { kind: 'velvet' });
      lapels(coat, '#152a6a');
      mesh(g, coat);
      const crav = Sculpt('silk').add(Wrap(-0.52, 0.32, 0.07), '#fbfaf6', 0.04).add(Cone([0, -0.56, 0.3], [0, -0.82, 0.38], 0.08, 0.04), '#fbfaf6', 0.05);
      mesh(g, crav);
      // the rosette: blue, white and red rings
      const ros = new THREE.Group();
      [['#d0283a', 0.12], ['#fbfaf6', 0.085], ['#1f3a8a', 0.05]].forEach(([c, r], i) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 40), MATS.gem(c)); d.rotation.x = Math.PI / 2; d.position.z = i * 0.012; ros.add(d); });
      ros.position.set(-0.42, -0.98, 0.42); ros.rotation.y = -0.4; g.add(ros);
      // the beret
      const beret = Sculpt('velvet').add(E(0, 0, 0, 0.42, 0.1, 0.4), '#2a2440', 0.02).add(Cap([0, 0.08, 0], [0, 0.13, 0], 0.02), '#2a2440', 0.02);
      const bg = new THREE.Group(); mesh(bg, beret); bg.position.set(0.08, 0.42, -0.04); bg.rotation.set(-0.15, 0, -0.32); g.add(bg);
    },
    // Skye: a New York eagle, aviator goggles up on the brow and a white silk scarf.
    eagle(g) {
      const w = '#f5f3ee', br = '#5a3820';
      const fe = Sculpt('feather');
      fe.add(E(0, 0.02, 0, 0.46, 0.45, 0.45), w);
      fe.add(M(R(Cone([0.26, -0.12, 0.0], [0.58, -0.3, -0.08], 0.18, 0.03), [0.26, -0.12, 0], 0, 0, 0)), w, 0.12);
      fe.sub(M(S(0.18, 0.04, 0.37, 0.08)), 0.03);
      fe.add(bodyFur(0.84), br, 0.12);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const x = (i - 3) * 0.22 + (r % 2) * 0.11, y = -0.86 - r * 0.15; fe.paint(R(E(x, y, 0, 0.11, 0.06, 1), [x, y, 0], 0, 0, 0), '#6e4a2c', 0.02); }
      mesh(g, fe);
      eyes(g, 0.18, 0.04, 0.34, 0.08, { iris: '#3a2a1a', ring: '#f0c040', size: 0.38 }, 0.4);
      const beak = Sculpt('horn');
      beak.add(Curve([[0, -0.04, 0.38], [0, -0.06, 0.56], [0, -0.16, 0.66], [0, -0.3, 0.6]], 16, (t) => 0.12 * (1 - t) + 0.012), '#f0a820', 0.04);
      beak.sub(Box(0, -0.2, 0.5, 0.2, 0.004, 0.12, 0), 0.004, '#a86010');
      mesh(g, beak);
      // goggles: a leather strap round the brow, gold rims and blue lenses
      const strap = Sculpt('skin').add(R(Shell(And(E(0, 0.08, 0, 0.47, 0.46, 0.46), Box(0, 0.3, 0, 1, 0.04, 1)), 0.016), [0, 0.08, 0], -0.25, 0, 0), '#7a4a2a', 0.01);
      mesh(g, strap);
      for (const sx of [-1, 1]) {
        lathe(g, [[0.0, 0], [0.1, 0], [0.11, 0.02], [0.1, 0.06], [0.085, 0.07], [0, 0.07]], MATS.gold(), [sx * 0.15, 0.32, 0.36], [Math.PI / 2 - 0.45, 0, sx * -0.3]);
        const l = new THREE.Mesh(new THREE.SphereGeometry(0.085, 32, 12, 0, TAU, 0, 0.7), MATS.gem('#3a7ab8')); l.position.set(sx * 0.15, 0.34, 0.42); l.rotation.set(Math.PI / 2 - 0.45, 0, sx * -0.3); l.position.set(sx * 0.15 + sx * 0.0, 0.32 + Math.cos(Math.PI / 2 - 0.45) * 0.07, 0.36 + Math.sin(Math.PI / 2 - 0.45) * 0.07); g.add(l);
      }
      const scarf = Sculpt('velvet');
      scarf.add(Wrap(-0.54, 0.34, 0.09), '#fbfaf6', 0.04).add(R(E(0.16, -0.86, 0.4, 0.1, 0.28, 0.03), [0.16, -0.86, 0.4], -0.25, 0, 0.2), '#fbfaf6', 0.05).add(R(E(0.04, -0.82, 0.42, 0.09, 0.22, 0.03), [0.04, -0.82, 0.42], -0.25, 0, -0.15), '#f2efe8', 0.05);
      mesh(g, scarf);
    },
  };
  // Fur shoulders under the head (for animals that wear no coat), width w.
  function bodyFur(w) {
    return And(Or(E(0, -0.97, -0.08, w || 0.86, 0.46, 0.43), Cone([0, -0.34, -0.04], [0, -0.74, -0.06], 0.32, 0.42)), Box(0, -0.2, 0, 2, 1.12, 2));
  }
  // The playing card in Rocco's hat: a red heart on cream.
  function cardTex() {
    return once('cardTex', () => {
      const c = document.createElement('canvas'); c.width = 128; c.height = 176;
      const g = c.getContext('2d');
      g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 128, 176);
      g.strokeStyle = '#c8b890'; g.lineWidth = 4; g.strokeRect(6, 6, 116, 164);
      g.fillStyle = '#d0243e'; g.beginPath(); g.moveTo(64, 120); g.bezierCurveTo(10, 80, 30, 40, 64, 66); g.bezierCurveTo(98, 40, 118, 80, 64, 120); g.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    });
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
  // make('animal:horse' | 'emblem:crown', { detail: 'show' | 'play' }) -> THREE.Group
  // userData.portrait: true for busts (framed head and shoulders), false for emblems (fit to view).
  function make(art, o) {
    o = o || {};
    const [kind, name] = String(art || 'animal:horse').split(':');
    // pictures: the finest sculpt and full fur; the live stage: lighter, and no fur shells on phones
    CELL = o.detail === 'play' ? 0.02 : o.detail === 'stage' ? 0.015 : 0.009;
    SHELLS = o.detail === 'play' ? 0 : o.detail === 'stage' ? 6 : 16;
    BUILD.head = null; BUILD.eyes = [];
    const g = new THREE.Group();
    if (kind === 'emblem') (EMBLEMS[name] || EMBLEMS.crown)(g);
    else { (ANIMALS[name] || ANIMALS.horse)(g); lids(); }
    g.userData.portrait = kind !== 'emblem';
    g.userData.dispose = () => g.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
    return g;
  }
  return { make, frame, FRAMES: Object.keys(FRAMES), ANIMALS: Object.keys(ANIMALS), EMBLEMS: Object.keys(EMBLEMS), BUST_Y, STUDIO };
}
if (typeof module !== 'undefined') module.exports = ChacklateAvatars;
