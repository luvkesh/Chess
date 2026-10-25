// Chacklate Chess 3D view: hand-written WebGL1 (no libraries).
// Draws the room, board, pieces, captured-piece trays and a table clock with
// soft shadows, board reflections, image-based-style lighting and particle
// effects. Turns clicks and drags into board squares.
function ChacklateRenderer(canvas, options) {
  'use strict';
  const opts = Object.assign({ onSquare() {}, canDrag() { return false; }, onDrop() { return false; }, onContextLost() {} }, options);
  const gl = canvas.getContext('webgl', { antialias: true, alpha: false, stencil: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  if (!gl) return null;

  // ------------------------------------------------------------ math helpers
  const V = {
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  };
  function mul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  }
  function perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function ortho(l, r, b, t, n, f) {
    const lr = 1 / (l - r), bt = 1 / (b - t), nf = 1 / (n - f);
    return new Float32Array([-2 * lr, 0, 0, 0, 0, -2 * bt, 0, 0, 0, 0, 2 * nf, 0, (l + r) * lr, (t + b) * bt, (f + n) * nf, 1]);
  }
  function lookAt(eye, center, up) {
    const z = V.norm(V.sub(eye, center)), x = V.norm(V.cross(up, z)), y = V.cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]);
  }
  // Translate · rotateY(yaw) · rotateX(tilt) · scale (sy defaults to s).
  function model(x, y, z, yaw, tilt, s, sy, sz) {
    const cy = Math.cos(yaw), sny = Math.sin(yaw), cx = Math.cos(tilt), sx = Math.sin(tilt);
    const ys = sy === undefined ? s : sy, zs = sz === undefined ? s : sz;
    return new Float32Array([
      cy * s, 0, -sny * s, 0,
      sny * sx * ys, cx * ys, cy * sx * ys, 0,
      sny * cx * zs, -sx * zs, cy * cx * zs, 0,
      x, y, z, 1,
    ]);
  }
  const MIRROR = new Float32Array([1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  const normalMat = (m) => new Float32Array([m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]]);
  const lin = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
  };
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));

  // --------------------------------------------------------------- geometry
  // Vertex layout: position(3) normal(3) uv(2).
  function lathe(profile, segs) {
    const out = [];
    const segN = [];
    for (let i = 0; i < profile.length - 1; i++) {
      const dr = profile[i + 1][0] - profile[i][0], dy = profile[i + 1][1] - profile[i][1];
      const l = Math.hypot(dr, dy) || 1;
      segN.push([dy / l, -dr / l]);
    }
    const smooth = Math.cos((40 * Math.PI) / 180);
    const vn = (seg, other) => {
      const n = segN[seg];
      if (other < 0 || other >= segN.length) return n;
      const o = segN[other];
      if (n[0] * o[0] + n[1] * o[1] < smooth) return n;
      const a = n[0] + o[0], b = n[1] + o[1], l = Math.hypot(a, b);
      return [a / l, b / l];
    };
    for (let s = 0; s < profile.length - 1; s++) {
      const p0 = profile[s], p1 = profile[s + 1];
      if (p0[0] === p1[0] && p0[1] === p1[1]) continue;
      const n0 = vn(s, s - 1), n1 = vn(s, s + 1);
      for (let j = 0; j < segs; j++) {
        const a0 = (j / segs) * Math.PI * 2, a1 = ((j + 1) / segs) * Math.PI * 2;
        const v = (p, n, a, u) => [p[0] * Math.cos(a), p[1], p[0] * Math.sin(a), n[0] * Math.cos(a), n[1], n[0] * Math.sin(a), u, p[1]];
        const u0 = j / segs, u1 = (j + 1) / segs;
        out.push(...v(p0, n0, a0, u0), ...v(p1, n1, a0, u0), ...v(p1, n1, a1, u1), ...v(p0, n0, a0, u0), ...v(p1, n1, a1, u1), ...v(p0, n0, a1, u1));
      }
    }
    return out;
  }
  function arc(r, cx, cy, from, to, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const a = from + ((to - from) * i) / steps;
      pts.push([Math.max(0, cx + r * Math.cos(a)), cy + r * Math.sin(a)]);
    }
    return pts;
  }
  const sphereProfile = (r, cy, from, to, steps) => arc(r, 0, cy, from, to, steps);
  // Box with a small chamfer on the top edges (catches the light like a real tile).
  function box(w, h, d, cx, cy, cz, chamfer) {
    const c = chamfer || 0;
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, z0 = cz - d / 2, z1 = cz + d / 2;
    const out = [];
    const uv = (p) => [(p[0] - x0) / w, (p[2] - z0) / d];
    const quad = (a, b, cc, dd, n) => { for (const p of [a, b, cc, a, cc, dd]) out.push(...p, ...n, ...uv(p)); };
    const yt = y1 - c;
    quad([x0 + c, y1, z1 - c], [x1 - c, y1, z1 - c], [x1 - c, y1, z0 + c], [x0 + c, y1, z0 + c], [0, 1, 0]);
    quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]);
    quad([x0, y0, z1], [x1, y0, z1], [x1, yt, z1], [x0, yt, z1], [0, 0, 1]);
    quad([x1, y0, z0], [x0, y0, z0], [x0, yt, z0], [x1, yt, z0], [0, 0, -1]);
    quad([x1, y0, z1], [x1, y0, z0], [x1, yt, z0], [x1, yt, z1], [1, 0, 0]);
    quad([x0, y0, z0], [x0, y0, z1], [x0, yt, z1], [x0, yt, z0], [-1, 0, 0]);
    if (c > 0) {
      const k = Math.SQRT1_2;
      quad([x0, yt, z1], [x1, yt, z1], [x1 - c, y1, z1 - c], [x0 + c, y1, z1 - c], [0, k, k]);
      quad([x1, yt, z0], [x0, yt, z0], [x0 + c, y1, z0 + c], [x1 - c, y1, z0 + c], [0, k, -k]);
      quad([x1, yt, z1], [x1, yt, z0], [x1 - c, y1, z0 + c], [x1 - c, y1, z1 - c], [k, k, 0]);
      quad([x0, yt, z0], [x0, yt, z1], [x0 + c, y1, z1 - c], [x0 + c, y1, z0 + c], [-k, k, 0]);
    }
    return out;
  }
  function triangulate(pts) {
    const idx = pts.map((_, i) => i), tris = [];
    const cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const inside = (p, a, b, c) => cr(a, b, p) > 0 && cr(b, c, p) > 0 && cr(c, a, p) > 0;
    let guard = 0;
    while (idx.length > 3 && guard++ < 5000) {
      let clipped = false;
      for (let i = 0; i < idx.length; i++) {
        const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
        if (cr(pts[a], pts[b], pts[c]) <= 0) continue;
        if (idx.some((j) => j !== a && j !== b && j !== c && inside(pts[j], pts[a], pts[b], pts[c]))) continue;
        tris.push([a, b, c]); idx.splice(i, 1); clipped = true; break;
      }
      if (!clipped) break;
    }
    if (idx.length === 3) tris.push(idx.slice());
    return tris;
  }
  // Smooth closed curve through control points (Catmull-Rom), counter-clockwise.
  function smoothOutline(ctrl, sub) {
    const out = [], n = ctrl.length;
    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i + n - 1) % n], p1 = ctrl[i], p2 = ctrl[(i + 1) % n], p3 = ctrl[(i + 2) % n];
      const sharp = p1[2];
      for (let k = 0; k < (sharp ? 1 : sub); k++) {
        const t = k / sub, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push(sharp ? [p1[0], p1[1]] : [f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    return out;
  }
  // Extrudes a counter-clockwise outline (x/y plane) to thickness t with rounded
  // edges of radius r. thick(y) can taper the thickness with height.
  function roundedExtrude(pts, t, r, thick) {
    const n = pts.length, out = [];
    const tf = thick || (() => 1);
    // Outward 2D normal per vertex (average of adjacent edge normals).
    const on = pts.map((p, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      const e1 = V.norm([p[0] - a[0], p[1] - a[1], 0]), e2 = V.norm([b[0] - p[0], b[1] - p[1], 0]);
      const n1 = [e1[1], -e1[0]], n2 = [e2[1], -e2[0]];
      let x = n1[0] + n2[0], y = n1[1] + n2[1];
      const l = Math.hypot(x, y) || 1; x /= l; y /= l;
      const cos = Math.max(0.5, x * n1[0] + y * n1[1]);
      return [x, y, 1 / cos];
    });
    const steps = 4, rings = [];
    // Rings from back cap (theta=-90) to front cap (+90).
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i <= steps; i++) {
        const th = side < 0 ? -Math.PI / 2 + (i / steps) * (Math.PI / 2) : (i / steps) * (Math.PI / 2);
        const inset = r * (1 - Math.cos(th));
        rings.push(pts.map((p, k) => {
          const o = on[k], h = (t / 2) * tf(p[1]);
          const z = side * (h - r) + r * Math.sin(th);
          const nz = Math.sin(th), nxy = Math.cos(th);
          return [p[0] - o[0] * inset * o[2], p[1] - o[1] * inset * o[2], z, o[0] * nxy, o[1] * nxy, nz];
        }));
      }
    }
    for (let ri = 0; ri < rings.length - 1; ri++) {
      const A = rings[ri], B = rings[ri + 1];
      for (let k = 0; k < n; k++) {
        const k2 = (k + 1) % n;
        for (const v of [A[k], A[k2], B[k2], A[k], B[k2], B[k]]) out.push(v[0], v[1], v[2], v[3], v[4], v[5], 0, v[1]);
      }
    }
    const cap = rings[0].map((v) => [v[0], v[1]]);
    for (const [a, b, c] of triangulate(cap)) {
      const F = rings[rings.length - 1], Bk = rings[0];
      for (const i of [a, b, c]) out.push(F[i][0], F[i][1], F[i][2], 0, 0, 1, 0, F[i][1]);
      for (const i of [a, c, b]) out.push(Bk[i][0], Bk[i][1], Bk[i][2], 0, 0, -1, 0, Bk[i][1]);
    }
    return out;
  }
  function transform(arr, yaw, dx, dy, dz, s) {
    const c = Math.cos(yaw), sn = Math.sin(yaw), out = arr.slice(), k = s || 1;
    for (let i = 0; i < out.length; i += 8) {
      const x = arr[i] * k, z = arr[i + 2] * k, nx = arr[i + 3], nz = arr[i + 5];
      out[i] = c * x + sn * z + dx; out[i + 1] = arr[i + 1] * k + dy; out[i + 2] = -sn * x + c * z + dz;
      out[i + 3] = c * nx + sn * nz; out[i + 5] = -sn * nx + c * nz;
    }
    return out;
  }
  // Rotates geometry about the x axis (used to stand the knight's head upright in z).
  function rotX(arr, a) {
    const c = Math.cos(a), s = Math.sin(a), out = arr.slice();
    for (let i = 0; i < out.length; i += 8) {
      out[i + 1] = c * arr[i + 1] - s * arr[i + 2]; out[i + 2] = s * arr[i + 1] + c * arr[i + 2];
      out[i + 4] = c * arr[i + 4] - s * arr[i + 5]; out[i + 5] = s * arr[i + 4] + c * arr[i + 5];
    }
    return out;
  }

  const SEG = 56;
  const geo = {};
  // ----- Staunton set (default): classical silhouettes, readable from any angle.
  const BASE = [[0, 0], [0.37, 0], [0.385, 0.012], [0.385, 0.045], [0.37, 0.065], [0.335, 0.08], [0.33, 0.1], [0.345, 0.115], [0.335, 0.135], [0.3, 0.148], [0.27, 0.165]];
  geo.staunton1 = lathe([...BASE, [0.235, 0.2], [0.165, 0.29], [0.12, 0.41], [0.115, 0.43], [0.175, 0.45], [0.18, 0.47], [0.17, 0.485], [0.1, 0.505],
    ...sphereProfile(0.158, 0.64, -1.1, Math.PI / 2, 16)], SEG);
  geo.staunton4 = lathe([...BASE, [0.26, 0.22], [0.225, 0.32], [0.205, 0.64], [0.235, 0.67], [0.265, 0.7], [0.27, 0.73], [0.255, 0.745], [0.26, 0.77],
    [0.265, 0.9], [0.195, 0.9], [0.19, 0.85], [0, 0.85]], SEG)
    .concat(...[0, 1, 2, 3, 4, 5].map((i) => transform(box(0.105, 0.13, 0.13, 0.215, 0.95, 0, 0.012), (i * Math.PI) / 3 + 0.26, 0, 0, 0)));
  geo.staunton3 = lathe([...BASE, [0.23, 0.21], [0.15, 0.33], [0.105, 0.66], [0.2, 0.69], [0.21, 0.71], [0.2, 0.735], [0.12, 0.76], [0.11, 0.78],
    [0.15, 0.83], [0.175, 0.9], [0.17, 0.97], [0.135, 1.04], [0.08, 1.1], [0.03, 1.13], ...sphereProfile(0.06, 1.185, -1.0, Math.PI / 2, 10)], SEG);
  geo.staunton5 = lathe([...BASE, [0.26, 0.22], [0.17, 0.35], [0.115, 0.74], [0.215, 0.79], [0.225, 0.81], [0.215, 0.84], [0.13, 0.87], [0.17, 0.98],
    [0.22, 1.08], [0.205, 1.11], [0.12, 1.13], [0.07, 1.17], ...sphereProfile(0.078, 1.24, -0.9, Math.PI / 2, 12)], SEG)
    .concat(...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => transform(lathe(sphereProfile(0.04, 0, -Math.PI / 2, Math.PI / 2, 8), 14), (i * Math.PI) / 5, 0.21 * Math.cos((i * Math.PI) / 5), 1.115, -0.21 * Math.sin((i * Math.PI) / 5))));
  geo.staunton6 = lathe([...BASE, [0.27, 0.22], [0.175, 0.36], [0.125, 0.84], [0.23, 0.89], [0.24, 0.915], [0.23, 0.945], [0.14, 0.97], [0.19, 1.12], [0.205, 1.18], [0.14, 1.21], [0, 1.22]], SEG)
    .concat(box(0.07, 0.3, 0.07, 0, 1.35, 0, 0.012), box(0.22, 0.07, 0.07, 0, 1.38, 0, 0.012));
  // The knight: a smooth horse-head outline extruded with rounded edges.
  const KNIGHT_CTRL = [[-0.24, 0.19, 1], [0.24, 0.19, 1], [0.235, 0.27], [0.19, 0.36], [0.17, 0.44], [0.22, 0.5], [0.33, 0.55], [0.4, 0.61], [0.415, 0.68],
    [0.37, 0.74], [0.27, 0.77], [0.2, 0.83], [0.17, 0.93], [0.135, 1.02], [0.1, 1.09, 1], [0.05, 1.0], [-0.02, 1.02, 1], [-0.07, 0.99],
    [-0.15, 0.93], [-0.22, 0.83], [-0.27, 0.68], [-0.29, 0.52], [-0.285, 0.36], [-0.26, 0.25]];
  const knightHead = roundedExtrude(smoothOutline(KNIGHT_CTRL, 5), 0.34, 0.075, (y) => 1 - Math.max(0, y - 0.55) * 0.35);
  geo.staunton2 = lathe([...BASE, [0.27, 0.2], [0.24, 0.215], [0, 0.215]], SEG).concat(knightHead,
    // eyes and mane studs keep the head legible from above
    transform(lathe(sphereProfile(0.028, 0, -Math.PI / 2, Math.PI / 2, 6), 10), 0, 0.2, 0.86, 0.13),
    transform(lathe(sphereProfile(0.028, 0, -Math.PI / 2, Math.PI / 2, 6), 10), 0, 0.2, 0.86, -0.13));

  // ----- Modern set: geometric shapes with the same heights and footprints.
  const MB = [[0, 0], [0.35, 0], [0.36, 0.01], [0.36, 0.07], [0.34, 0.08], [0.24, 0.1]];
  geo.modern1 = lathe([...MB, [0.17, 0.12], [0.13, 0.45], [0.16, 0.47], [0.16, 0.5], [0.06, 0.52], ...sphereProfile(0.14, 0.64, -1.2, Math.PI / 2, 14)], SEG);
  geo.modern4 = lathe([...MB, [0.25, 0.12], [0.24, 0.84], [0.28, 0.86], [0.28, 0.92], [0.2, 0.92], [0.2, 0.88], [0, 0.88]], SEG);
  geo.modern3 = lathe([...MB, [0.2, 0.12], [0.08, 0.95], [0.12, 0.98], ...sphereProfile(0.11, 1.08, -1.2, Math.PI / 2, 12)], SEG)
    .concat(transform(box(0.24, 0.035, 0.03, 0, 1.1, 0.0, 0), 0.6, 0, 0, 0));
  geo.modern5 = lathe([...MB, [0.24, 0.12], [0.12, 1.0], [0.24, 1.06], [0.24, 1.1], [0.14, 1.12], ...sphereProfile(0.09, 1.2, -1.0, Math.PI / 2, 12)], SEG);
  geo.modern6 = lathe([...MB, [0.25, 0.12], [0.13, 1.06], [0.25, 1.1], [0.25, 1.16], [0, 1.16]], SEG)
    .concat(box(0.2, 0.2, 0.2, 0, 1.28, 0, 0.03));
  const MK = [[-0.22, 0.1, 1], [0.22, 0.1, 1], [0.2, 0.5, 1], [0.38, 0.62, 1], [0.38, 0.78, 1], [0.12, 0.98, 1], [-0.18, 1.0, 1], [-0.24, 0.7, 1]];
  geo.modern2 = lathe([...MB, [0, 0.1]], SEG).concat(roundedExtrude(MK.map((p) => [p[0], p[1]]), 0.26, 0.04));

  // Board, frame, room.
  geo.tile = box(1, 0.1, 1, 0, -0.05, 0, 0.014);
  geo.frame = box(9.4, 0.26, 9.4, 0, -0.14, 0, 0.06);
  geo.table = box(80, 0.2, 80, 0, -0.37, 0);
  geo.inlayNS = box(8.16, 0.02, 0.05, 0, 0.0, 0);
  geo.inlayEW = box(0.05, 0.02, 8.16, 0, 0.0, 0);
  geo.quad = [-0.5, 0, -0.5, 0, 1, 0, 0, 0, 0.5, 0, -0.5, 0, 1, 0, 1, 0, 0.5, 0, 0.5, 0, 1, 0, 1, 1,
    -0.5, 0, -0.5, 0, 1, 0, 0, 0, 0.5, 0, 0.5, 0, 1, 0, 1, 1, -0.5, 0, 0.5, 0, 1, 0, 0, 1];
  // Table clock: wedge body, two faces, two plungers.
  geo.clockBody = box(2.0, 0.62, 0.7, 0, 0.31, 0, 0.05);
  geo.clockFace = [-0.9, 0.1, 0.352, 0, 0, 1, 0, 1, 0.9, 0.1, 0.352, 0, 0, 1, 1, 1, 0.9, 0.55, 0.352, 0, 0, 1, 1, 0,
    -0.9, 0.1, 0.352, 0, 0, 1, 0, 1, 0.9, 0.55, 0.352, 0, 0, 1, 1, 0, -0.9, 0.55, 0.352, 0, 0, 1, 0, 0];
  geo.plunger = lathe([[0, 0], [0.08, 0], [0.08, 0.12], [0.14, 0.14], [0.14, 0.18], [0, 0.19]], 24);
  const fsTri = new Float32Array([-1, -1, 3, -1, -1, 3]);

  const meshes = {};
  for (const k of Object.keys(geo)) {
    const data = new Float32Array(geo[k]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    meshes[k] = { buf, count: data.length / 8 };
  }
  const fsBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
  gl.bufferData(gl.ARRAY_BUFFER, fsTri, gl.STATIC_DRAW);
  const dynBuf = gl.createBuffer();

  // ---------------------------------------------------------------- shaders
  const VS = `
    attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUV;
    uniform mat4 uModel, uViewProj, uLightVP; uniform mat3 uNormal;
    varying vec3 vWorld; varying vec3 vNrm; varying vec4 vLight; varying vec2 vUV; varying vec3 vLocal;
    void main() {
      vec4 w = uModel * vec4(aPos, 1.0);
      vWorld = w.xyz; vNrm = uNormal * aNrm; vLight = uLightVP * w; vUV = aUV; vLocal = aPos;
      gl_Position = uViewProj * w;
    }`;
  const NOISE = `
    float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float noise(vec3 x) {
      vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
                 mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
    }
    float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }`;
  const FS = `
    precision highp float;
    varying vec3 vWorld; varying vec3 vNrm; varying vec4 vLight; varying vec2 vUV; varying vec3 vLocal;
    uniform vec3 uColor, uEmissive, uEye, uLightDir, uKey, uRim, uSky, uGround, uFog, uVein;
    uniform float uAlpha, uGloss, uSpec, uMetal, uClear, uMarble, uShadowOn, uTexel, uUseTex, uGrain, uGrainDir;
    uniform float uPool, uMirror, uUnlit, uExposure, uSeed, uHigh;
    uniform sampler2D uShadowMap, uTex;
    ${NOISE}
    float unpack(vec4 c) { return dot(c, vec4(1.0, 1.0 / 255.0, 1.0 / 65025.0, 1.0 / 16581375.0)); }
    float shadow() {
      if (uShadowOn < 0.5) return 1.0;
      vec3 p = vLight.xyz / vLight.w * 0.5 + 0.5;
      if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0 || p.z > 1.0) return 1.0;
      float s = 0.0;
      for (int x = -2; x <= 2; x++) for (int y = -2; y <= 2; y++) {
        float d = unpack(texture2D(uShadowMap, p.xy + vec2(float(x), float(y)) * uTexel * 1.25));
        s += (p.z - 0.0018 > d) ? 0.0 : 1.0;
      }
      return mix(0.22, 1.0, s / 25.0);
    }
    vec3 env(vec3 r) {
      float t = clamp(r.y * 0.5 + 0.5, 0.0, 1.0);
      vec3 c = mix(uGround, uSky, smoothstep(0.25, 0.85, t));
      vec3 L = normalize(uLightDir);
      float box = smoothstep(0.9, 0.97, dot(r, L));
      float strip = smoothstep(0.55, 0.62, r.y) * (1.0 - smoothstep(0.08, 0.2, abs(r.x * 0.7 + r.z * 0.7 - 0.25)));
      float rimBox = smoothstep(0.92, 0.98, dot(r, normalize(vec3(0.6, 0.5, -0.6))));
      return c + uKey * (box * 3.0 + strip * 0.9) + uRim * rimBox * 1.6;
    }
    vec3 aces(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
    void main() {
      if (uUnlit > 0.5) { gl_FragColor = vec4(uUseTex > 0.5 ? texture2D(uTex, vUV).rgb : uColor, uAlpha); return; }
      vec3 n = normalize(vNrm);
      vec3 v = normalize(uEye - vWorld);
      if (dot(n, v) < 0.0) n = -n;
      vec3 base = uColor;
      if (uUseTex > 0.5) base = pow(texture2D(uTex, vUV).rgb, vec3(2.2));
      vec3 P = (uMirror > 0.5 ? vec3(vWorld.x, -vWorld.y, vWorld.z) : vWorld) + vec3(uSeed);
      if (uGrain > 0.0 && uHigh > 0.5) {
        float a = uGrainDir > 0.5 ? P.x : P.z, b = uGrainDir > 0.5 ? P.z : P.x;
        float ring = sin(a * 3.0 + fbm(vec3(a * 0.6, b * 9.0, P.y * 3.0)) * 7.0);
        float fleck = fbm(vec3(a * 1.5, b * 40.0, 0.0));
        base *= 1.0 + (ring * 0.06 + (fleck - 0.5) * 0.18) * uGrain;
      }
      if (uMarble > 0.0 && uHigh > 0.5) {
        vec3 q = (uUseTex > 0.5 ? P : (uMirror > 0.5 ? vLocal : vLocal * 2.2 + vec3(uSeed))) * 1.4;
        float m = abs(sin(q.x * 2.0 + q.y * 1.3 + q.z * 1.7 + fbm(q * 2.2) * 6.0));
        float vein = pow(1.0 - m, 9.0);
        base = mix(base, uVein, vein * uMarble);
        base *= 1.0 - (fbm(q * 5.0) - 0.5) * 0.12 * uMarble;
      }
      vec3 L = normalize(uLightDir);
      float sh = shadow();
      float ndl = max(dot(n, L), 0.0);
      float ndv = max(dot(n, v), 0.0);
      vec3 h = normalize(L + v);
      float ndh = max(dot(n, h), 0.0);
      vec3 f0 = mix(vec3(0.04), base, uMetal);
      vec3 fres = f0 + (1.0 - f0) * pow(1.0 - ndv, 5.0);
      vec3 diffuse = base * (1.0 - uMetal);
      vec3 amb = mix(uGround, uSky, n.y * 0.5 + 0.5) * 0.55;
      vec3 key = uKey;
      float rim = pow(1.0 - ndv, 3.0) * max(dot(n, normalize(vec3(0.6, 0.35, -0.7))), 0.0);
      float specN = (uGloss + 8.0) / 25.0;
      vec3 spec = key * pow(ndh, uGloss) * specN * uSpec * sh * fres * 4.0;
      vec3 clear = key * pow(ndh, uGloss * 6.0 + 60.0) * uClear * sh * 2.5;
      vec3 refl = env(reflect(-v, n)) * fres * uSpec * mix(0.35, 1.0, sh);
      vec3 col = diffuse * (amb + key * ndl * sh) + spec + clear + refl * (0.6 + uMetal * 0.8) + uRim * rim * (0.5 + uSpec) + uEmissive;
      col *= mix(1.0, 0.8, uMetal * (1.0 - ndl));
      float r2 = dot(vWorld.xz, vWorld.xz);
      if (uPool > 0.0) col *= mix(0.1, 1.0, exp(-r2 / (uPool * uPool)));
      if (uMirror > 0.5) col *= 0.5 * exp(vWorld.y * 1.8);
      col = aces(col * uExposure);
      col = pow(col, vec3(1.0 / 2.2));
      col = mix(col, uFog, smoothstep(140.0, 900.0, r2));
      gl_FragColor = vec4(col, uAlpha);
    }`;
  const SVS = `
    attribute vec3 aPos; uniform mat4 uModel, uLightVP;
    void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;
  const SFS = `
    precision highp float;
    void main() {
      vec4 e = fract(vec4(1.0, 255.0, 65025.0, 16581375.0) * gl_FragCoord.z);
      e -= e.yzww * vec4(1.0 / 255.0, 1.0 / 255.0, 1.0 / 255.0, 0.0);
      gl_FragColor = e;
    }`;
  // Flat decals on the board: highlights, contact shadows, arrows. Shape is drawn in the shader.
  const DVS = `
    attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUV;
    uniform mat4 uModel, uViewProj; varying vec2 vUV;
    void main() { vUV = aUV; gl_Position = uViewProj * uModel * vec4(aPos, 1.0); }`;
  const DFS = `
    precision mediump float;
    varying vec2 vUV; uniform vec3 uColor; uniform float uAlpha, uShape, uTime;
    void main() {
      vec2 p = vUV * 2.0 - 1.0; float r = length(p); float a = 0.0;
      if (uShape < 0.5) a = 1.0 - smoothstep(0.88, 1.0, max(abs(p.x), abs(p.y))) * 0.6;            // fill
      else if (uShape < 1.5) { float m = max(abs(p.x), abs(p.y)); a = smoothstep(0.78, 0.84, m) * (1.0 - smoothstep(0.95, 0.99, m)); } // frame
      else if (uShape < 2.5) a = 1.0 - smoothstep(0.2, 0.26, r);                                         // dot
      else if (uShape < 3.5) a = smoothstep(0.72, 0.78, r) * (1.0 - smoothstep(0.9, 0.96, r));          // ring
      else if (uShape < 4.5) a = (1.0 - smoothstep(0.0, 1.0, r)) * (0.75 + 0.25 * sin(uTime * 5.0));   // glow
      else if (uShape < 5.5) a = pow(1.0 - smoothstep(0.0, 1.0, r), 1.6);                               // contact shadow
      else a = 1.0 - smoothstep(0.7, 1.0, abs(p.y));                                                     // arrow body
      gl_FragColor = vec4(uColor, a * uAlpha);
    }`;
  // Camera-facing particles (sparks, dust, petals, confetti, motes).
  const PVS = `
    attribute vec3 aPos; attribute vec2 aCorner; attribute vec4 aColor; attribute float aSize;
    uniform mat4 uView, uProj; varying vec2 vC; varying vec4 vCol;
    void main() {
      vec4 c = uView * vec4(aPos, 1.0);
      c.xy += aCorner * aSize;
      vC = aCorner; vCol = aColor; gl_Position = uProj * c;
    }`;
  const PFS = `
    precision mediump float;
    varying vec2 vC; varying vec4 vCol; uniform float uSquare;
    void main() {
      float a = uSquare > 0.5 ? 1.0 - smoothstep(0.75, 1.0, max(abs(vC.x), abs(vC.y) * 1.6)) : pow(1.0 - smoothstep(0.0, 1.0, length(vC)), 1.8);
      gl_FragColor = vec4(vCol.rgb, vCol.a * a);
    }`;
  // Background: gradient behind the table plus soft out-of-focus lights.
  const BVS = `attribute vec2 aPos; varying vec2 vP; void main() { vP = aPos; gl_Position = vec4(aPos, 0.999, 1.0); }`;
  const BFS = `
    precision mediump float;
    varying vec2 vP; uniform vec3 uFog, uTop, uBokeh; uniform float uHorizon, uTime, uAspect, uBokehOn;
    void main() {
      float t = smoothstep(uHorizon - 0.05, uHorizon + 1.2, vP.y);
      vec3 c = mix(uFog, uTop, t);
      if (uBokehOn > 0.5) {
        for (int i = 0; i < 9; i++) {
          float fi = float(i);
          vec2 o = vec2(fract(sin(fi * 12.9898) * 43758.5453) * 2.2 - 1.1, uHorizon + 0.15 + fract(sin(fi * 78.233) * 12543.21) * 0.9);
          o.x += sin(uTime * 0.05 + fi) * 0.04;
          float rad = 0.05 + fract(fi * 0.37) * 0.09;
          float d = length((vP - o) * vec2(uAspect, 1.0));
          c += uBokeh * (1.0 - smoothstep(rad * 0.8, rad, d)) * (0.05 + 0.04 * fract(fi * 0.61));
        }
      }
      float vig = smoothstep(1.7, 0.4, length(vP * vec2(0.85, 1.0)));
      gl_FragColor = vec4(c * mix(0.55, 1.0, vig), 1.0);
    }`;

  function program(vs, fs, attribs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    (attribs || ['aPos', 'aNrm', 'aUV']).forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p, u };
  }
  const main = program(VS, FS);
  const depth = program(SVS, SFS);
  const decal = program(DVS, DFS);
  const part = program(PVS, PFS, ['aPos', 'aCorner', 'aColor', 'aSize']);
  const bg = program(BVS, BFS, ['aPos']);

  // Shadow map (depth packed into RGBA; works on every WebGL1 device).
  const SHADOW = 2048;
  const shadowTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, shadowTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SHADOW, SHADOW, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const shadowFB = gl.createFramebuffer();
  const shadowRB = gl.createRenderbuffer();
  gl.bindRenderbuffer(gl.RENDERBUFFER, shadowRB);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, SHADOW, SHADOW);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowTex, 0);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowRB);
  const shadowOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const hasStencil = (gl.getContextAttributes() || {}).stencil;

  const LIGHT_DIR = V.norm([-0.55, 1.0, 0.5]);
  const lightVP = mul(ortho(-8.2, 8.2, -8.2, 8.2, 2, 44), lookAt(V.scale(LIGHT_DIR, 22), [0, 0, 0], [0, 1, 0]));

  // ------------------------------------------------------------- textures
  function makeTex() {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    return t;
  }
  function upload(tex, c, mip) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    if (mip) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
    else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  // Frame texture with coordinates, redrawn per board theme and orientation.
  const frameTex = makeTex();
  let labelSide = 'white';
  function drawFrameTexture(theme) {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    g.fillStyle = theme.frame; g.fillRect(0, 0, 1024, 1024);
    const px = (x) => (x / 9.4 + 0.5) * 1024;
    g.strokeStyle = theme.frameLine; g.lineWidth = 2;
    g.strokeRect(px(-4.55), px(-4.55), px(4.55) - px(-4.55), px(4.55) - px(-4.55));
    g.globalAlpha = 0.5; g.strokeRect(px(-4.6), px(-4.6), px(4.6) - px(-4.6), px(4.6) - px(-4.6)); g.globalAlpha = 1;
    g.fillStyle = theme.label;
    g.font = '600 30px "Iowan Old Style", Palatino, Georgia, "Times New Roman", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const write = (text, x, z, rot) => { g.save(); g.translate(px(x), px(z)); g.rotate(rot); g.fillText(text, 0, 0); g.restore(); };
    const black = labelSide === 'black';
    for (let i = 0; i < 8; i++) {
      if (black) { write('abcdefgh'[i], i - 3.5, -4.33, Math.PI); write(String(i + 1), 4.33, 3.5 - i, Math.PI); }
      else { write('abcdefgh'[i], i - 3.5, 4.33, 0); write(String(i + 1), -4.33, 3.5 - i, 0); }
    }
    upload(frameTex, c, true);
  }
  // Clock face texture.
  const clockTex = makeTex();
  const clockCanvas = document.createElement('canvas');
  clockCanvas.width = 512; clockCanvas.height = 128;
  let clockKey = '';
  function drawClockTexture() {
    if (!clockState) return;
    const fmt = (ms) => { const s = Math.max(0, ms) / 1000; if (s < 10) return s.toFixed(1); const m = Math.floor(s / 60); return m + ':' + String(Math.floor(s % 60)).padStart(2, '0'); };
    const left = clockState.blackMs, right = clockState.whiteMs;
    const key = fmt(left) + '|' + fmt(right) + '|' + clockState.active + '|' + (clockSkin && clockSkin.id);
    if (key === clockKey) return;
    clockKey = key;
    const g = clockCanvas.getContext('2d');
    const sk = clockSkin || { face: '#111311', ink: '#e8f5d8', glow: '#9fe870', accent: '#d2466f' };
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 2; i++) {
      const x = i * 256 + 10, on = clockState.active === (i === 0 ? 'b' : 'w');
      g.fillStyle = sk.face; g.fillRect(x, 10, 236, 108);
      g.fillStyle = on ? sk.glow : sk.ink; g.globalAlpha = on ? 1 : 0.55;
      g.font = '600 64px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(fmt(i === 0 ? left : right), x + 118, 66);
      g.globalAlpha = 1;
      if (on) { g.fillStyle = sk.accent; g.fillRect(x + 12, 104, 212, 6); }
    }
    upload(clockTex, clockCanvas, false);
  }

  // ------------------------------------------------------------------ state
  const DEFAULT_BOARD = { name: 'Walnut & Maple', light: '#dcb88b', dark: '#6b412c', frame: '#3a2419', frameLine: '#b08a5a', label: '#ead3b2', inlay: '#c9a35a', grain: 1, marble: 0, gloss: 60, spec: 0.35, refl: 0.2 };
  const DEFAULT_PIECES = { name: 'Tempered', shape: 'staunton',
    white: { color: '#f0e3cc', gloss: 60, spec: 0.55, metal: 0, clear: 0.5, marble: 0 },
    black: { color: '#3b2218', gloss: 90, spec: 0.85, metal: 0, clear: 0.9, marble: 0 } };
  const DEFAULT_ROOM = { name: 'Atelier', fog: '#120c0a', top: '#2a1a14', table: '#4a2c1d', tableGrain: 0.8, key: '#ffe6c8', keyI: 1.55, rim: '#d0b4ff', rimI: 0.25,
    sky: '#8a7468', ground: '#2a1c16', exposure: 1.05, bokeh: '#ffb070', dust: true, pool: 9.5 };
  let boardTheme = DEFAULT_BOARD, pieceTheme = DEFAULT_PIECES, room = DEFAULT_ROOM;
  let fx = { capture: { kind: 'dust', colors: ['#c8a27a', '#8a5a3a'] }, victory: { kind: 'confetti', colors: ['#e3b25a', '#d2466f', '#f4ebe3'] }, trail: null };
  let quality = 'high', animations = true, attract = false, captureFxOn = true;
  let sprites = [], graveyard = [], particles = [], arrows = [];
  let highlights = {};
  let clockState = null, clockSkin = null, clockPress = { side: -1, t: 0 };
  let raf = 0, lastFrame = 0, hoverSq = -1, dragging = null;
  const cam = { yaw: 0, pitch: 0.92, dist: 13.4, tYaw: 0, tPitch: 0.92, tDist: 13.4, shift: 0, tShift: 0, shiftY: 0, tShiftY: 0, zoom: 1, tZoom: 1, intro: null };
  const fov = (38 * Math.PI) / 180;
  const tileJitter = Array.from({ length: 64 }, (_, i) => 1 + (((i * 2654435761) >>> 0) % 1000 / 1000 - 0.5) * 0.07);
  const tileSeed = Array.from({ length: 64 }, (_, i) => (((i * 40503) >>> 0) % 97) * 1.37);

  const sqX = (sq) => (sq & 7) - 3.5;
  const sqZ = (sq) => 3.5 - (sq >> 3);
  const kindOf = (p) => Math.abs(p);

  function makeSprite(piece, sq) {
    return { piece, sq, x: sqX(sq), z: sqZ(sq), y: 0, scale: 1, alpha: 1, tilt: 0, yaw: baseYaw(piece, sq), anim: null, lift: 0, seed: (sq * 7.13) % 11 };
  }
  function baseYaw(piece, sq) {
    if (kindOf(piece) === 2) return piece > 0 ? Math.PI / 2 - 0.75 : -Math.PI / 2 - 0.75; // knights look ahead, turned to show their profile
    if (kindOf(piece) === 3) return piece > 0 ? 0 : Math.PI;
    return ((sq * 37) % 11) * 0.12; // slight natural variation, never affects play
  }
  // Trays beside the board for captured pieces: White's captures on the right.
  function gravePos(capturer, i) {
    const col = Math.floor(i / 8), row = i % 8;
    if (capturer > 0) return [5.25 + col * 0.6, 3.55 - row * 0.62];
    return [-5.25 - col * 0.6, -3.55 + row * 0.62];
  }

  // ------------------------------------------------------------------ drawing
  function eyePos() {
    const cp = Math.cos(cam.pitch);
    const d = cam.dist * cam.zoom;
    return [Math.sin(cam.yaw) * cp * d, Math.sin(cam.pitch) * d, Math.cos(cam.yaw) * cp * d];
  }

  function bindMesh(mesh, withNormals) {
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buf);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(0);
    if (withNormals) {
      gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24); gl.enableVertexAttribArray(2);
    } else {
      gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    }
  }

  function pieceMat(white) {
    const m = white ? pieceTheme.white : pieceTheme.black;
    return { color: lin(m.color), gloss: m.gloss, spec: m.spec, metal: m.metal || 0, clear: m.clear || 0, marble: m.marble || 0, vein: lin(m.vein || (white ? '#9a8f88' : '#c9b8a8')) };
  }

  function pieceDraws() {
    const out = [];
    const mw = pieceMat(true), mb = pieceMat(false);
    const shape = pieceTheme.shape || 'staunton';
    const now = performance.now();
    const add = (s, extra) => {
      if (s.alpha <= 0.01) return;
      const m = s.piece > 0 ? mw : mb;
      const bob = s.lift ? Math.sin(now / 260 + s.seed) * 0.02 : 0;
      out.push(Object.assign({ mesh: shape + kindOf(s.piece), m: model(s.x, s.y + s.lift + bob, s.z, s.yaw, s.tilt, s.scale), mat: m, alpha: s.alpha, caster: true,
        seed: s.seed, emissive: s.glow ? [s.glow * 0.3, s.glow * 0.08, s.glow * 0.04] : null, sprite: s }, extra || {}));
    };
    sprites.forEach((s) => add(s));
    graveyard.forEach((s) => add(s));
    return out;
  }

  function sceneDraws() {
    const list = [];
    const tb = lin(room.table);
    list.push({ mesh: 'table', m: model(0, 0, 0, 0, 0, 1), mat: { color: tb, gloss: 30, spec: 0.12, metal: 0, clear: 0.15 }, grain: room.tableGrain, grainDir: 1, caster: false, pool: true });
    list.push({ mesh: 'frame', m: model(0, 0, 0, 0, 0, 1), tex: true, mat: { color: [1, 1, 1], gloss: 80, spec: 0.45, metal: 0, clear: 0.6, marble: boardTheme.marble ? 0.6 : 0, vein: lin('#7a7a80') },
      grain: boardTheme.grain * 0.7, grainDir: 0, caster: true });
    const inlay = { color: lin(boardTheme.inlay || '#c9a35a'), gloss: 120, spec: 1, metal: 1, clear: 0.2 };
    list.push({ mesh: 'inlayNS', m: model(0, 0, 4.1, 0, 0, 1), mat: inlay });
    list.push({ mesh: 'inlayNS', m: model(0, 0, -4.1, 0, 0, 1), mat: inlay });
    list.push({ mesh: 'inlayEW', m: model(4.1, 0, 0, 0, 0, 1), mat: inlay });
    list.push({ mesh: 'inlayEW', m: model(-4.1, 0, 0, 0, 0, 1), mat: inlay });
    if (clockState) {
      // Faces the board from White's right; left display is Black, right is White.
      const cx = 5.7, cz = -2.7, yaw = -Math.PI / 2;
      list.push({ mesh: 'clockBody', m: model(cx, -0.25, cz, yaw, 0, 1), mat: { color: lin(clockSkin && clockSkin.body || '#2a1a12'), gloss: 90, spec: 0.6, metal: 0, clear: 0.8 }, grain: 0.6, grainDir: 1, caster: true });
      list.push({ mesh: 'clockFace', m: model(cx, -0.25, cz, yaw, 0, 1), clockFace: true });
      for (const side of ['w', 'b']) {
        const pressed = clockState.active === side ? 0 : -0.06;
        list.push({ mesh: 'plunger', m: model(cx, 0.37 + pressed - 0.25, cz + (side === 'w' ? 0.55 : -0.55), 0, 0, 1), mat: { color: lin(clockSkin && clockSkin.metal || '#c9a35a'), gloss: 100, spec: 1, metal: 1, clear: 0 }, caster: true });
      }
    }
    return list;
  }

  function tileDraws() {
    const list = [];
    const light = lin(boardTheme.light), dark = lin(boardTheme.dark);
    for (let sq = 0; sq < 64; sq++) {
      const isLight = ((sq >> 3) + (sq & 7)) % 2 === 1;
      const base = isLight ? light : dark;
      const j = tileJitter[sq];
      list.push({ mesh: 'tile', m: model(sqX(sq), 0, sqZ(sq), 0, 0, 1), mat: { color: base.map((c) => c * j), gloss: boardTheme.gloss || 60, spec: boardTheme.spec || 0.35, metal: 0, clear: boardTheme.marble ? 0.7 : 0.35,
        marble: boardTheme.marble || 0, vein: lin(isLight ? (boardTheme.veinLight || '#8d8d95') : (boardTheme.veinDark || '#c8c8d0')) },
        grain: boardTheme.grain, grainDir: (sq + (sq >> 3)) % 2, seed: tileSeed[sq], tile: true });
    }
    return list;
  }

  function overlayList(now) {
    const out = [];
    const h = highlights;
    const sq = (s, color, alpha, shape, scale) => out.push({ m: model(sqX(s), 0.006, sqZ(s), 0, 0, scale || 1), color: lin(color), alpha, shape });
    // Shape plus colour: last move is a frame, selection a fill, check a pulsing glow.
    if (h.lastFrom >= 0) sq(h.lastFrom, '#f0c26a', 0.55, 1);
    if (h.lastTo >= 0) { sq(h.lastTo, '#f0c26a', 0.18, 0); sq(h.lastTo, '#f0c26a', 0.8, 1); }
    if (h.hintFrom >= 0) sq(h.hintFrom, '#3fe0c8', 0.85, 1);
    if (h.hintTo >= 0) { sq(h.hintTo, '#3fe0c8', 0.3, 0); sq(h.hintTo, '#3fe0c8', 0.9, 1); }
    for (const s of h.marks || []) sq(s.sq, s.color || '#3fe0c8', s.alpha || 0.45, s.shape === undefined ? 0 : s.shape);
    if (h.check >= 0) sq(h.check, '#ff3b30', 0.95, 4, 1.25);
    if (h.selected >= 0) sq(h.selected, '#d2466f', 0.42, 0);
    const cursor = dragging && dragging.moved ? dragging.over : hoverSq;
    if (cursor >= 0 && cursor !== h.selected) sq(cursor, '#ffe9d0', 0.5, 1);
    for (const t of h.targets || []) sq(t, '#d2466f', 0.8, 2);
    for (const t of h.captures || []) sq(t, '#d2466f', 0.85, 3);
    void now;
    return out;
  }

  // Arrows: flat ribbons with a head, from square centre to square centre.
  function arrowGeometry(a) {
    const x0 = sqX(a.from), z0 = sqZ(a.from), x1 = sqX(a.to), z1 = sqZ(a.to);
    const pts = [];
    const knight = Math.abs((a.from & 7) - (a.to & 7)) * Math.abs((a.from >> 3) - (a.to >> 3)) === 2;
    if (knight) {
      const longX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
      const mid = longX ? [x1, z0] : [x0, z1];
      pts.push([x0, z0], mid, [x1, z1]);
    } else pts.push([x0, z0], [x1, z1]);
    const w = 0.09 * (a.width || 1), hw = 0.24 * (a.width || 1), hl = 0.36;
    const out = [];
    const push = (x, z, v) => out.push(x, 0.012, z, 0, 1, 0, 0, v);
    for (let i = 0; i < pts.length - 1; i++) {
      let [ax, az] = pts[i]; let [bx, bz] = pts[i + 1];
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l, nx = -uz, nz = ux;
      if (i === 0) { ax += ux * 0.25; az += uz * 0.25; }
      const last = i === pts.length - 2;
      if (last) { bx -= ux * hl; bz -= uz * hl; }
      const ext = !last ? w : 0;
      bx += ux * ext; bz += uz * ext;
      push(ax + nx * w, az + nz * w, 0); push(ax - nx * w, az - nz * w, 1); push(bx - nx * w, bz - nz * w, 1);
      push(ax + nx * w, az + nz * w, 0); push(bx - nx * w, bz - nz * w, 1); push(bx + nx * w, bz + nz * w, 0);
      if (last) {
        const tx = bx + ux * hl, tz = bz + uz * hl;
        push(bx + nx * hw, bz + nz * hw, 0.5); push(bx - nx * hw, bz - nz * hw, 0.5); push(tx, tz, 0.5);
      }
    }
    return out;
  }

  // ---------------------------------------------------------------- particles
  function spawn(kind, x, y, z, colors, count) {
    if (!animations) return;
    const cols = (colors || ['#ffffff']).map(lin).map((c) => c.map((v) => Math.pow(v, 1 / 2.2)));
    const now = performance.now();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, sp = Math.random();
      const c = cols[i % cols.length];
      const p = { x, y, z, vx: Math.cos(a) * sp, vy: 0, vz: Math.sin(a) * sp, born: now, life: 700, size: 0.06, color: c, alpha: 1, kind, square: false, add: true, g: 0, drag: 0.9 };
      if (kind === 'dust') { p.vx *= 1.3; p.vz *= 1.3; p.vy = 0.4 + Math.random() * 0.7; p.g = 2.2; p.life = 650; p.size = 0.05 + Math.random() * 0.05; p.add = false; p.alpha = 0.75; }
      else if (kind === 'sparks') { p.vx *= 3.2; p.vz *= 3.2; p.vy = 1.5 + Math.random() * 2.2; p.g = 6; p.life = 520; p.size = 0.03 + Math.random() * 0.03; }
      else if (kind === 'petals') { p.vx *= 1.2; p.vz *= 1.2; p.vy = 1.2 + Math.random() * 1.2; p.g = 1.4; p.life = 1100; p.size = 0.07; p.square = true; p.add = false; p.drag = 0.6; }
      else if (kind === 'ink') { p.vx *= 0.6; p.vz *= 0.6; p.vy = 0.5 + Math.random() * 0.6; p.g = -0.2; p.life = 900; p.size = 0.12 + Math.random() * 0.1; p.add = false; p.alpha = 0.5; p.grow = 1.8; }
      else if (kind === 'frost') { p.vx *= 1.6; p.vz *= 1.6; p.vy = 0.8 + Math.random(); p.g = 1.0; p.life = 900; p.size = 0.04 + Math.random() * 0.03; }
      else if (kind === 'confetti') { p.vx *= 2.5; p.vz *= 2.5; p.vy = 3.5 + Math.random() * 3; p.g = 4.2; p.life = 2600; p.size = 0.07; p.square = true; p.add = false; p.drag = 0.5; p.flutter = Math.random() * 6; }
      else if (kind === 'firework') { const e = Math.random() * Math.PI - Math.PI / 2; p.vx = Math.cos(a) * Math.cos(e) * 3; p.vz = Math.sin(a) * Math.cos(e) * 3; p.vy = Math.sin(e) * 3 + 0.6; p.g = 1.6; p.life = 1500; p.size = 0.05; }
      else if (kind === 'mote') { p.vx = (Math.random() - 0.5) * 0.05; p.vz = (Math.random() - 0.5) * 0.05; p.vy = 0.02 + Math.random() * 0.04; p.g = 0; p.life = 9000 + Math.random() * 6000; p.size = 0.02 + Math.random() * 0.025; p.alpha = 0.35; p.drag = 1; p.born = now - Math.random() * 4000; }
      else if (kind === 'trail') { p.vx *= 0.15; p.vz *= 0.15; p.vy = 0.15; p.g = 0; p.life = 450; p.size = 0.06; p.alpha = 0.7; }
      particles.push(p);
    }
    requestRender();
  }
  function stepParticles(now, dt) {
    particles = particles.filter((p) => now - p.born < p.life);
    for (const p of particles) {
      if (now < p.born) continue;
      p.vy -= p.g * dt;
      const d = Math.pow(p.drag, dt * 4);
      p.vx *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.flutter) p.x += Math.sin(now / 200 + p.flutter) * dt * 0.4;
      if (p.y < 0.01 && p.kind !== 'mote') { p.y = 0.01; p.vy *= -0.25; p.vx *= 0.6; p.vz *= 0.6; }
    }
    if (room.dust && quality === 'high' && animations && particles.filter((p) => p.kind === 'mote').length < 70) {
      const n = 70 - particles.filter((p) => p.kind === 'mote').length;
      for (let i = 0; i < n; i++) spawn('mote', (Math.random() - 0.5) * 12, 0.3 + Math.random() * 5, (Math.random() - 0.5) * 12, [room.bokeh || '#ffd8a8'], 1);
    }
  }

  // ------------------------------------------------------------------- render
  function setMainUniforms(u, eye, viewProj, mirror) {
    gl.uniformMatrix4fv(u.uViewProj, false, viewProj);
    gl.uniformMatrix4fv(u.uLightVP, false, lightVP);
    gl.uniform3fv(u.uEye, eye);
    gl.uniform3fv(u.uLightDir, LIGHT_DIR);
    gl.uniform3fv(u.uKey, lin(room.key).map((c) => c * room.keyI));
    gl.uniform3fv(u.uRim, lin(room.rim).map((c) => c * (room.rimI || 0.25)));
    gl.uniform3fv(u.uSky, lin(room.sky));
    gl.uniform3fv(u.uGround, lin(room.ground));
    gl.uniform3fv(u.uFog, lin(room.fog).map((c) => Math.pow(c, 1 / 2.2)));
    gl.uniform1f(u.uExposure, room.exposure || 1);
    gl.uniform1f(u.uMirror, mirror ? 1 : 0);
    gl.uniform1f(u.uHigh, quality === 'high' ? 1 : 0);
    gl.uniform1f(u.uTexel, 1 / SHADOW);
    gl.uniform1i(u.uShadowMap, 0);
    gl.uniform1i(u.uTex, 1);
  }

  function drawMain(d, shadowsOn, mirror) {
    const u = main.u;
    bindMesh(meshes[d.mesh], true);
    const m = mirror ? mul(MIRROR, d.m) : d.m;
    gl.uniformMatrix4fv(u.uModel, false, m);
    gl.uniformMatrix3fv(u.uNormal, false, normalMat(m));
    const mat = d.mat || { color: [1, 1, 1], gloss: 40, spec: 0.3 };
    gl.uniform3fv(u.uColor, mat.color);
    gl.uniform3fv(u.uVein, mat.vein || [0.5, 0.5, 0.5]);
    gl.uniform3fv(u.uEmissive, d.emissive || [0, 0, 0]);
    gl.uniform1f(u.uAlpha, d.alpha === undefined ? 1 : d.alpha);
    gl.uniform1f(u.uGloss, mat.gloss || 40);
    gl.uniform1f(u.uSpec, mat.spec === undefined ? 0.3 : mat.spec);
    gl.uniform1f(u.uMetal, mat.metal || 0);
    gl.uniform1f(u.uClear, quality === 'high' ? mat.clear || 0 : 0);
    gl.uniform1f(u.uMarble, mat.marble || 0);
    gl.uniform1f(u.uSeed, d.seed || 0);
    gl.uniform1f(u.uShadowOn, shadowsOn && !mirror ? 1 : 0);
    gl.uniform1f(u.uUseTex, d.tex ? 1 : 0);
    gl.uniform1f(u.uUnlit, d.unlit ? 1 : 0);
    gl.uniform1f(u.uGrain, d.grain || 0);
    gl.uniform1f(u.uGrainDir, d.grainDir || 0);
    gl.uniform1f(u.uPool, d.pool ? room.pool || 9 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, meshes[d.mesh].count);
  }

  function render(now) {
    const w = canvas.width, h = canvas.height;
    const pieces = pieceDraws();
    const scene = sceneDraws();
    const tiles = tileDraws();
    const high = quality === 'high';
    const shadowsOn = high && shadowOk;
    const reflect = high && hasStencil && (boardTheme.refl || 0) > 0;
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    if (shadowsOn) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowFB);
      gl.viewport(0, 0, SHADOW, SHADOW);
      gl.clearColor(1, 1, 1, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depth.p);
      gl.uniformMatrix4fv(depth.u.uLightVP, false, lightVP);
      for (const d of pieces.concat(scene)) {
        if (!d.caster || (d.alpha !== undefined && d.alpha < 0.5)) continue;
        bindMesh(meshes[d.mesh], false);
        gl.uniformMatrix4fv(depth.u.uModel, false, d.m);
        gl.drawArrays(gl.TRIANGLES, 0, meshes[d.mesh].count);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    gl.viewport(0, 0, w, h);
    gl.clearColor(0, 0, 0, 1);
    gl.clearStencil(0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    const eye = eyePos();
    const proj = perspective(fov, w / Math.max(1, h), 0.5, 160);
    proj[8] = -cam.shift; proj[9] = -cam.shiftY; // lens shift: slides the board on screen without changing the angle
    const view = lookAt(eye, [0, cam.lookY || 0, 0], [0, 1, 0]);
    const viewProj = mul(proj, view);

    // Background gradient and bokeh.
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(bg.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, fsBuf);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.enableVertexAttribArray(0);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
    const horizon = (() => { const p = [Math.sin(cam.yaw) * -60, 0, Math.cos(cam.yaw) * -60, 1]; const c = [0, 0, 0, 0]; for (let r = 0; r < 4; r++) c[r] = viewProj[r] * p[0] + viewProj[4 + r] * p[1] + viewProj[8 + r] * p[2] + viewProj[12 + r]; return c[3] > 0 ? c[1] / c[3] : -1; })();
    gl.uniform3fv(bg.u.uFog, lin(room.fog).map((c) => Math.pow(c, 1 / 2.2)));
    gl.uniform3fv(bg.u.uTop, lin(room.top).map((c) => Math.pow(c, 1 / 2.2)));
    gl.uniform3fv(bg.u.uBokeh, lin(room.bokeh || '#ffb070').map((c) => Math.pow(c, 1 / 2.2)));
    gl.uniform1f(bg.u.uHorizon, horizon);
    gl.uniform1f(bg.u.uTime, now / 1000);
    gl.uniform1f(bg.u.uAspect, w / Math.max(1, h));
    gl.uniform1f(bg.u.uBokehOn, high ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);

    gl.useProgram(main.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, shadowTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, frameTex);

    // Board reflection: mark the playing surface in the stencil, paint it black,
    // draw the pieces mirrored below it, then blend the tiles over the top.
    if (reflect) {
      setMainUniforms(main.u, eye, viewProj, false);
      gl.enable(gl.STENCIL_TEST);
      gl.stencilFunc(gl.ALWAYS, 1, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);
      gl.depthMask(false);
      bindMesh(meshes.quad, true);
      gl.uniformMatrix4fv(main.u.uModel, false, model(0, 0.0, 0, 0, 0, 8));
      gl.uniformMatrix3fv(main.u.uNormal, false, normalMat(model(0, 0, 0, 0, 0, 1)));
      gl.uniform1f(main.u.uUnlit, 1); gl.uniform3fv(main.u.uColor, [0, 0, 0]); gl.uniform1f(main.u.uAlpha, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.depthMask(true);
      gl.stencilFunc(gl.EQUAL, 1, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
      setMainUniforms(main.u, eye, viewProj, true);
      for (const d of pieces) if (d.alpha === undefined || d.alpha > 0.5) { if (!d.sprite || !graveyard.includes(d.sprite)) drawMain(d, false, true); }
      gl.disable(gl.STENCIL_TEST);
      gl.clear(gl.DEPTH_BUFFER_BIT);
    }

    setMainUniforms(main.u, eye, viewProj, false);
    const opaque = scene.concat(pieces).filter((d) => !d.clockFace && (d.alpha === undefined || d.alpha >= 0.999));
    opaque.forEach((d) => drawMain(d, shadowsOn, false));
    // Clock face: an unlit display texture.
    const face = scene.find((d) => d.clockFace);
    if (face) {
      drawClockTexture();
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, clockTex);
      drawMain(Object.assign({}, face, { tex: true, unlit: true }), false, false);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, frameTex);
    }
    // Tiles: alpha carries the reflection strength.
    if (reflect) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
    const refl = reflect ? boardTheme.refl : 0;
    tiles.forEach((d) => drawMain(Object.assign(d, { alpha: 1 - refl }), shadowsOn, false));
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // Decals: contact shadows, highlights, arrows.
    gl.depthMask(false);
    gl.useProgram(decal.p);
    gl.uniformMatrix4fv(decal.u.uViewProj, false, viewProj);
    gl.uniform1f(decal.u.uTime, now / 1000);
    bindMesh(meshes.quad, true);
    const dq = (m, color, alpha, shape) => {
      gl.uniformMatrix4fv(decal.u.uModel, false, m);
      gl.uniform3fv(decal.u.uColor, color); gl.uniform1f(decal.u.uAlpha, alpha); gl.uniform1f(decal.u.uShape, shape);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    for (const d of pieces) {
      const s = d.sprite; if (!s || s.alpha < 0.3) continue;
      const lift = s.y + s.lift;
      const k = Math.max(0, 1 - lift * 1.2);
      dq(model(s.x + 0.03, lift > 0.02 ? 0.003 : 0.003, s.z - 0.03, 0, 0, (0.95 + lift * 0.4) * s.scale), [0, 0, 0], (graveyard.includes(s) ? 0.35 : 0.45) * k, 5);
    }
    for (const o of overlayList(now)) dq(o.m, o.color.map((c) => Math.pow(c, 1 / 2.2)), o.alpha, o.shape);
    if (arrows.length) {
      for (const a of arrows) {
        const data = new Float32Array(arrowGeometry(a));
        gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0); gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12); gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24); gl.enableVertexAttribArray(2);
        gl.uniformMatrix4fv(decal.u.uModel, false, model(0, 0, 0, 0, 0, 1));
        gl.uniform3fv(decal.u.uColor, lin(a.color || '#3fe0c8').map((c) => Math.pow(c, 1 / 2.2)));
        gl.uniform1f(decal.u.uAlpha, a.alpha || 0.85); gl.uniform1f(decal.u.uShape, 6);
        gl.drawArrays(gl.TRIANGLES, 0, data.length / 8);
      }
    }
    gl.depthMask(true);

    // Fading pieces (captures in flight).
    gl.useProgram(main.p);
    pieces.filter((d) => d.alpha !== undefined && d.alpha < 0.999).forEach((d) => drawMain(d, shadowsOn, false));

    // Particles.
    if (particles.length) {
      gl.useProgram(part.p);
      gl.uniformMatrix4fv(part.u.uView, false, view);
      gl.uniformMatrix4fv(part.u.uProj, false, proj);
      gl.depthMask(false);
      for (const additive of [false, true]) {
        for (const square of [false, true]) {
          const ps = particles.filter((p) => p.add === additive && p.square === square && now >= p.born);
          if (!ps.length) continue;
          const data = new Float32Array(ps.length * 6 * 10);
          let o = 0;
          for (const p of ps) {
            const t = (now - p.born) / p.life;
            const fade = p.kind === 'mote' ? Math.sin(Math.PI * t) : 1 - t * t;
            const a = p.alpha * fade;
            const sz = p.size * (p.grow ? 1 + t * p.grow : 1) * (p.square ? 0.8 + 0.4 * Math.abs(Math.sin(now / 120 + (p.flutter || 0))) : 1);
            for (const [cx, cy] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) {
              data[o++] = p.x; data[o++] = p.y; data[o++] = p.z; data[o++] = cx; data[o++] = cy;
              data[o++] = p.color[0]; data[o++] = p.color[1]; data[o++] = p.color[2]; data[o++] = a; data[o++] = sz;
            }
          }
          gl.bindBuffer(gl.ARRAY_BUFFER, dynBuf);
          gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
          gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 40, 0); gl.enableVertexAttribArray(0);
          gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 40, 12); gl.enableVertexAttribArray(1);
          gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 40, 20); gl.enableVertexAttribArray(2);
          gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 40, 36); gl.enableVertexAttribArray(3);
          gl.uniform1f(part.u.uSquare, square ? 1 : 0);
          gl.blendFunc(gl.SRC_ALPHA, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA);
          gl.drawArrays(gl.TRIANGLES, 0, ps.length * 6);
        }
      }
      gl.disableVertexAttribArray(3);
      gl.depthMask(true);
    }
    gl.disable(gl.BLEND);
  }

  // --------------------------------------------------------------- animation
  function step(now) {
    const dt = Math.min(0.05, (now - (lastFrame || now)) / 1000);
    lastFrame = now;
    let busy = false;
    if (cam.intro) {
      const t = clamp01((now - cam.intro.start) / cam.intro.dur), e = easeInOut(t);
      cam.yaw = cam.intro.fYaw + (cam.tYaw - cam.intro.fYaw) * e;
      cam.pitch = cam.intro.fPitch + (cam.tPitch - cam.intro.fPitch) * e;
      cam.dist = cam.intro.fDist + (cam.tDist - cam.intro.fDist) * e;
      if (t >= 1) cam.intro = null;
      busy = true;
    } else {
      if (attract) { cam.tYaw += dt * 0.08; }
      for (const k of ['yaw', 'pitch', 'dist', 'shift', 'shiftY', 'zoom']) {
        const t = 't' + k[0].toUpperCase() + k.slice(1);
        const d = cam[t] - cam[k];
        if (Math.abs(d) > 0.0005) { cam[k] += d * Math.min(1, dt * 9); busy = true; } else cam[k] = cam[t];
      }
    }
    for (const s of sprites.concat(graveyard)) {
      const target = s.selected ? 0.16 : s.hover ? 0.06 : 0;
      if (Math.abs(s.lift - target) > 0.002) { s.lift += (target - s.lift) * Math.min(1, dt * 14); busy = true; } else s.lift = target;
      if (s.selected) busy = true;
      const a = s.anim;
      if (!a) continue;
      if (now < a.start) { busy = true; continue; }
      const t = clamp01((now - a.start) / a.dur);
      if (a.type === 'move') {
        const e = easeOut(t);
        s.x = a.fx + (a.tx - a.fx) * e; s.z = a.fz + (a.tz - a.fz) * e;
        s.y = a.fy * (1 - e) + Math.sin(Math.PI * Math.min(1, t * 1.08)) * a.arc;
        if (fx.trail && t < 0.9 && Math.random() < 0.6) spawn('trail', s.x, s.y + 0.1, s.z, fx.trail.colors, 1);
        if (t >= 1 && a.promoteTo) { s.piece = a.promoteTo; spawn('sparks', s.x, 0.6, s.z, ['#ffe28a', '#ffffff'], 40); }
        if (t >= 1 && a.land) a.land();
      } else if (a.type === 'grave') {
        const e = easeInOut(t);
        s.x = a.fx + (a.tx - a.fx) * e; s.z = a.fz + (a.tz - a.fz) * e;
        s.y = Math.sin(Math.PI * t) * 1.1;
        s.scale = 1 - 0.28 * e; s.yaw = a.fyaw + e * Math.PI * 1.5;
      } else if (a.type === 'topple') {
        s.tilt = a.to * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI * 3) * 0.04 * (1 - t);
      } else if (a.type === 'glow') {
        s.glow = Math.sin(Math.PI * Math.min(1, t * 2));
      } else if (a.type === 'hop') {
        s.y = Math.sin(Math.PI * t) * 0.35;
      } else if (a.type === 'back') {
        const e = easeOut(t);
        s.x = a.fx + (a.tx - a.fx) * e; s.z = a.fz + (a.tz - a.fz) * e; s.y = a.fy * (1 - e);
      }
      if (t < 1) busy = true;
      else { s.anim = null; if (a.done) a.done(); }
    }
    if (particles.length) { stepParticles(now, dt); busy = busy || particles.some((p) => p.kind !== 'mote'); }
    else if (room.dust && quality === 'high' && animations) stepParticles(now, dt);
    if (clockState && clockState.running) busy = true;
    return busy;
  }

  const ambient = () => attract || (room.dust && quality === 'high' && animations) || particles.length > 0 || (highlights.check >= 0 && animations);
  let ambientTimer = 0;
  function frame(now) {
    raf = 0;
    const busy = step(now);
    render(now);
    if (busy) requestRender();
    else if (ambient() && !ambientTimer && !document.hidden) {
      // Ambient effects (dust motes, bokeh drift, idle orbit) run at a calm 30 fps.
      ambientTimer = setTimeout(() => { ambientTimer = 0; requestRender(); }, 33);
    }
  }
  function requestRender() {
    if (!raf) raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); });

  // ----------------------------------------------------------------- input
  const pointers = new Map();
  let drag = null, pinch = 0;
  function groundPoint(clientX, clientY, y) {
    const r = canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / r.width) * 2 - 1 - cam.shift, ny = 1 - ((clientY - r.top) / r.height) * 2 - cam.shiftY;
    const eye = eyePos();
    const f = V.norm(V.sub([0, cam.lookY || 0, 0], eye)), right = V.norm(V.cross(f, [0, 1, 0])), up = V.cross(right, f);
    const t = Math.tan(fov / 2);
    const dir = V.add(f, V.add(V.scale(right, nx * t * (r.width / r.height)), V.scale(up, ny * t)));
    if (dir[1] >= 0) return null;
    const k = ((y || 0) - eye[1]) / dir[1];
    return [eye[0] + dir[0] * k, eye[2] + dir[2] * k];
  }
  function pick(clientX, clientY) {
    // Pieces stand up, so test a little above the board first (tall pieces cover the square behind them).
    for (const y of [0.45, 0]) {
      const g = groundPoint(clientX, clientY, y);
      if (!g) continue;
      const file = Math.floor(g[0] + 4), rank = Math.floor(4 - g[1]);
      if (file < 0 || file > 7 || rank < 0 || rank > 7) continue;
      const sq = rank * 8 + file;
      if (y === 0 || sprites.some((s) => s.sq === sq && !s.dead)) return sq;
    }
    return -1;
  }
  function setHover(sq) {
    if (sq === hoverSq) return;
    hoverSq = sq;
    for (const s of sprites) s.hover = s.sq === sq && opts.canDrag(sq);
    requestRender();
  }
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      const sq = pick(e.clientX, e.clientY);
      const sprite = sq >= 0 ? sprites.find((s) => s.sq === sq && !s.dead && !s.anim) : null;
      if (sprite && opts.canDrag(sq)) {
        dragging = { sq, sprite, x: e.clientX, y: e.clientY, moved: false, over: sq };
        opts.onSquare(sq, 'down');
      } else drag = { x: e.clientX, y: e.clientY, moved: false };
    }
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); drag = null; if (dragging) cancelDrag(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') setHover(pick(e.clientX, e.clientY));
      return;
    }
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) cam.tDist = Math.min(24, Math.max(8, cam.tDist * (pinch / d)));
      pinch = d; requestRender();
      return;
    }
    if (dragging) {
      if (!dragging.moved && Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) < 6) return;
      dragging.moved = true;
      const g = groundPoint(e.clientX, e.clientY, 0.3);
      if (g) {
        dragging.sprite.x = Math.max(-4.4, Math.min(4.4, g[0])); dragging.sprite.z = Math.max(-4.4, Math.min(4.4, g[1]));
        dragging.sprite.y = 0.3;
        const file = Math.floor(dragging.sprite.x + 4), rank = Math.floor(4 - dragging.sprite.z);
        dragging.over = file >= 0 && file < 8 && rank >= 0 && rank < 8 ? rank * 8 + file : -1;
      }
      requestRender();
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    cam.intro = null;
    cam.tYaw -= dx * 0.008; cam.tPitch = Math.min(1.54, Math.max(0.36, cam.tPitch + dy * 0.006));
    cam.yaw = cam.tYaw; cam.pitch = cam.tPitch;
    drag.x = e.clientX; drag.y = e.clientY;
    requestRender();
  });
  function cancelDrag() {
    if (!dragging) return;
    const s = dragging.sprite;
    s.anim = { type: 'back', start: performance.now(), dur: 160, fx: s.x, fz: s.z, fy: s.y, tx: sqX(s.sq), tz: sqZ(s.sq) };
    dragging = null;
    requestRender();
  }
  const end = (e) => {
    pointers.delete(e.pointerId);
    if (dragging && pointers.size === 0) {
      const d = dragging;
      if (d.moved) {
        const to = d.over;
        dragging = null;
        if (!(to >= 0 && to !== d.sq && opts.onDrop(d.sq, to))) { dragging = d; cancelDrag(); }
      } else dragging = null;
    } else if (drag && !drag.moved && pointers.size === 0) {
      const sq = pick(e.clientX, e.clientY);
      if (sq >= 0) opts.onSquare(sq, 'click');
    }
    if (pointers.size === 0) { drag = null; pinch = 0; }
    requestRender();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = 0; cancelDrag(); });
  canvas.addEventListener('pointerleave', () => setHover(-1));
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.tDist = Math.min(24, Math.max(8, cam.tDist * (1 + Math.sign(e.deltaY) * 0.08)));
    requestRender();
  }, { passive: false });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); opts.onContextLost(); });

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, quality === 'high' ? 2 : 1);
    const w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    // Keep the whole board (and trays) in view on narrow screens.
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    cam.minDist = aspect < 1 ? 14.5 / Math.max(0.42, aspect) : aspect < 1.25 ? 15.5 : 13.6;
    if (cam.tDist < cam.minDist * 0.94) cam.tDist = cam.minDist;
    requestRender();
  }
  new ResizeObserver(resize).observe(canvas);

  drawFrameTexture(boardTheme);

  function settleGrave(captured) {
    graveyard = [];
    for (const capturer of [1, -1]) {
      const list = (captured && captured[capturer > 0 ? 'byWhite' : 'byBlack']) || [];
      list.forEach((piece, i) => {
        const [x, z] = gravePos(capturer, i);
        const s = makeSprite(piece, -1);
        s.x = x; s.z = z; s.scale = 0.72; s.yaw = capturer > 0 ? -Math.PI / 2 : Math.PI / 2;
        graveyard.push(s);
      });
    }
  }

  // ------------------------------------------------------------------- API
  let selectedSq = -1;
  return {
    setBoard(pieces, captured) {
      sprites = pieces.map(([sq, piece]) => makeSprite(piece, sq));
      for (const s of sprites) s.selected = s.sq === selectedSq;
      settleGrave(captured);
      dragging = null;
      requestRender();
    },
    setHighlights(h) {
      highlights = h;
      selectedSq = h.selected === undefined ? -1 : h.selected;
      for (const s of sprites) s.selected = s.sq === selectedSq && !s.anim;
      requestRender();
    },
    setArrows(list) { arrows = list || []; requestRender(); },
    setTheme(board, pieces) {
      if (board) { boardTheme = board; drawFrameTexture(boardTheme); }
      if (pieces) pieceTheme = pieces;
      requestRender();
    },
    setRoom(r) { if (r) room = r; particles = particles.filter((p) => p.kind !== 'mote'); requestRender(); },
    setFx(f) { fx = Object.assign({}, fx, f); },
    setCaptureEffects(on) { captureFxOn = on; },
    setQuality(q) { quality = q; resize(); },
    setAnimations(on) { animations = on; if (!on) particles = []; },
    setAttract(on) {
      attract = on;
      if (on) { cam.tPitch = 0.62; cam.tDist = (cam.minDist || 13.6) * 1.08; cam.lookY = 0.3; }
      else cam.lookY = 0;
      requestRender();
    },
    // Moves the board in screen space (NDC units, -1..1) to make room for a side or bottom panel.
    // zoom > 1 pulls the camera back to keep the board whole in the smaller free area.
    setShift(x, y, zoom, instant) {
      cam.tShift = x; cam.tShiftY = y || 0; cam.tZoom = zoom || 1;
      if (instant || !animations) { cam.shift = cam.tShift; cam.shiftY = cam.tShiftY; cam.zoom = cam.tZoom; }
      requestRender();
    },
    // side: 'white' | 'black'; preset: 'player' | 'top' | 'low'
    setView(side, preset, instant) {
      if (side !== labelSide) { labelSide = side; drawFrameTexture(boardTheme); }
      const narrow = (cam.minDist || 13.6) > 13.6;
      attract = false; cam.lookY = 0;
      let yaw = side === 'black' ? Math.PI : 0;
      while (yaw - cam.yaw > Math.PI) yaw -= Math.PI * 2;
      while (cam.yaw - yaw > Math.PI) yaw += Math.PI * 2;
      cam.tYaw = yaw;
      cam.tPitch = preset === 'top' ? 1.54 : preset === 'low' ? 0.55 : narrow ? 1.12 : 0.92;
      cam.tDist = preset === 'top' ? Math.max(12.5, (cam.minDist || 13.6) * 0.95) : preset === 'low' ? (cam.minDist || 13.6) * 0.92 : (cam.minDist || 13.6);
      if (instant || !animations) { cam.yaw = cam.tYaw; cam.pitch = cam.tPitch; cam.dist = cam.tDist; cam.intro = null; }
      requestRender();
    },
    // Sweeping camera move into the player's seat at the start of a game.
    intro() {
      if (!animations) return;
      cam.intro = { start: performance.now(), dur: 1500, fYaw: cam.tYaw + 0.9, fPitch: 1.32, fDist: cam.tDist * 1.35 };
      requestRender();
    },
    // info from Game.play(). Calls done() once the move has landed (captures keep animating).
    animateMove(info, done, o) {
      const now = performance.now();
      const quick = o && o.quick;
      const mover = sprites.find((s) => s.sq === info.from && !s.dead);
      const victim = info.capturedSq >= 0 ? sprites.find((s) => s.sq === info.capturedSq && s !== mover && !s.dead) : null;
      const finish = () => { if (done) done(); };
      const capturer = info.mover > 0 ? 1 : -1;
      const graveIdx = graveyard.filter((g) => (capturer > 0 ? g.yaw < 0 : g.yaw > 0)).length;
      if (mover) mover.selected = false;
      if (!animations || !mover) {
        if (victim) {
          sprites = sprites.filter((s) => s !== victim);
          const [gx, gz] = gravePos(capturer, graveIdx);
          victim.x = gx; victim.z = gz; victim.scale = 0.72; victim.yaw = capturer > 0 ? -Math.PI / 2 : Math.PI / 2; victim.sq = -1;
          graveyard.push(victim);
        }
        if (mover) { mover.sq = info.to; mover.x = sqX(info.to); mover.z = sqZ(info.to); mover.y = 0; if (info.promo) mover.piece = info.promo; }
        if (info.rook) { const r = sprites.find((s) => s.sq === info.rook[0] && !s.dead); if (r) { r.sq = info.rook[1]; r.x = sqX(r.sq); r.z = sqZ(r.sq); } }
        requestRender(); finish();
        return;
      }
      const knight = kindOf(info.mover) === 2;
      const dist = Math.hypot(sqX(info.to) - mover.x, sqZ(info.to) - mover.z);
      // 180–260 ms per the art bible; a dropped piece only needs to settle.
      const dur = dist < 0.6 ? 120 : Math.min(260, 180 + dist * 14) + (knight ? 40 : 0);
      const landX = sqX(info.to), landZ = sqZ(info.to);
      mover.anim = { type: 'move', start: now, dur, fx: mover.x, fz: mover.z, fy: mover.y, tx: landX, tz: landZ,
        arc: dist < 0.6 ? 0 : knight ? 0.5 : 0.14, promoteTo: info.promo || 0, done: finish,
        land: () => { if (!victim && !quick) spawn('dust', landX, 0.02, landZ, ['#ffffff'], 6); } };
      mover.sq = info.to;
      if (victim) {
        victim.dead = true;
        const [gx, gz] = gravePos(capturer, graveIdx);
        const vx = victim.x, vz = victim.z;
        const impact = now + dur * 0.8;
        if (!quick && captureFxOn && fx.capture && fx.capture.kind !== 'none') {
          setTimeout(() => spawn(fx.capture.kind, vx, 0.35, vz, fx.capture.colors, fx.capture.kind === 'sparks' ? 46 : 28), Math.max(0, impact - performance.now()));
        }
        victim.anim = { type: 'grave', start: impact, dur: quick ? 200 : 520, fx: vx, fz: vz, tx: gx, tz: gz, fyaw: victim.yaw,
          done: () => { sprites = sprites.filter((s) => s !== victim); victim.dead = false; victim.sq = -1; victim.scale = 0.72; victim.yaw = capturer > 0 ? -Math.PI / 2 : Math.PI / 2; victim.y = 0; graveyard.push(victim); } };
      }
      if (info.rook) {
        const r = sprites.find((s) => s.sq === info.rook[0] && !s.dead);
        if (r) { r.anim = { type: 'move', start: now + 70, dur, fx: r.x, fz: r.z, fy: 0, tx: sqX(info.rook[1]), tz: sqZ(info.rook[1]), arc: 0.32 }; r.sq = info.rook[1]; }
      }
      requestRender();
    },
    // Result effects: the beaten king tips over and the winner's colours burst;
    // a draw makes both kings glow.
    celebrate(kind, loserSq, kingSqs, winnerSq) {
      const now = performance.now();
      if (kind === 'win' && loserSq >= 0) {
        const k = sprites.find((s) => s.sq === loserSq && !s.dead);
        if (k) { k.anim = { type: 'topple', start: now + 150, dur: animations ? 1100 : 1, to: 1.45 }; }
        const w = winnerSq >= 0 ? sprites.find((s) => s.sq === winnerSq && !s.dead) : null;
        if (w && animations) { w.anim = { type: 'hop', start: now + 300, dur: 500 }; }
        if (animations && fx.victory && fx.victory.kind !== 'none') {
          const v = fx.victory;
          const at = w ? [w.x, 1.2, w.z] : [0, 1, 0];
          const burst = (dx, dz, delay) => setTimeout(() => spawn(v.kind === 'fireworks' ? 'firework' : v.kind === 'petals' ? 'petals' : v.kind === 'sparks' ? 'sparks' : 'confetti', at[0] + dx, at[1] + (v.kind === 'fireworks' ? 2 : 0), at[2] + dz, v.colors, v.kind === 'fireworks' ? 70 : 90), delay);
          burst(0, 0, 500);
          if (v.kind === 'fireworks') { burst(-2, -1, 900); burst(2, 1, 1300); }
          if (v.kind === 'confetti') burst(0, 0, 900);
        }
      } else if (kind === 'draw') {
        for (const sq of kingSqs || []) {
          const k = sprites.find((s) => s.sq === sq && !s.dead);
          if (k) k.anim = { type: 'glow', start: now, dur: animations ? 1800 : 1 };
        }
      }
      requestRender();
    },
    // Table clock. state: null to hide, or { whiteMs, blackMs, active: 'w'|'b'|null, running }.
    setClock(state, skin) {
      clockState = state; if (skin) clockSkin = skin;
      requestRender();
    },
    // Small preview spin used by the collection screen.
    showcase(on) { attract = !!on; requestRender(); },
    cancelDrag,
    requestRender,
    resize,
  };
}
