// The beaten king's fall, as real physics.
//
// A piece is a rigid body: the points of its own convex hull (so a tall figure, a wide crown or a
// cross all touch the board where they really would), a mass spread over its height the way a
// turned piece is, with a weighted base, and the inertia that follows from that. It is dropped,
// tipped or spun onto the board and simulated with gravity, bounce and friction until it is still:
// it lands, rocks on the rim of its base, topples with its weight, knocks its crown on the board,
// rolls round in an arc about its head the way a real tipped piece does, rocks and settles.
//
// The whole fall is worked out in advance, in a few milliseconds, as a track of poses (120 a
// second) and a list of the moments it touches the board (for its sounds). The scene tries a few
// directions, keeps the one that stays clear of the other pieces, and then only replays it, so
// a phone pays nothing per frame. Nothing here knows about three.js: vectors are [x, y, z]
// arrays and turns are quaternions [x, y, z, w], with y up and the board at y = 0.
function ChacklateFall() {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.sqrt(dot(a, a));
  const qmul = (a, b) => [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ];
  const qnorm = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]; };
  const qaxis = (axis, ang) => { const l = len(axis) || 1, s = Math.sin(ang / 2) / l; return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(ang / 2)]; };
  const qyaw = (yaw) => [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
  // the 3x3 rotation of a quaternion, row by row
  function mat(q) {
    const [x, y, z, w] = q;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
    ];
  }
  const rot = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const rotT = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
  function slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    const s = d < 0 ? -1 : 1; d *= s;
    if (d > 0.9995) return qnorm([a[0] + (s * b[0] - a[0]) * t, a[1] + (s * b[1] - a[1]) * t, a[2] + (s * b[2] - a[2]) * t, a[3] + (s * b[3] - a[3]) * t]);
    const th = Math.acos(d), k0 = Math.sin((1 - t) * th) / Math.sin(th), k1 = s * Math.sin(t * th) / Math.sin(th);
    return [a[0] * k0 + b[0] * k1, a[1] * k0 + b[1] * k1, a[2] * k0 + b[2] * k1, a[3] * k0 + b[3] * k1];
  }

  // ------------------------------------------------------------------ the piece's body
  // verts: a flat list x, y, z, ... of the piece's mesh in its own frame (base at y = 0).
  // Returns the hull points the board can touch, the centre of mass and the inertia about it.
  function shape(verts) {
    const n = Math.floor(verts.length / 3);
    let h = 0;
    for (let i = 0; i < n; i++) h = Math.max(h, verts[i * 3 + 1]);
    h = h || 1;
    // the hull, as the farthest point in each of ~200 directions spread over the sphere
    const dirs = 200, pick = new Set();
    for (let d = 0; d < dirs; d++) {
      const y = 1 - (2 * (d + 0.5)) / dirs, r = Math.sqrt(1 - y * y), a = d * 2.399963229728653;
      const dx = Math.cos(a) * r, dz = Math.sin(a) * r;
      let best = -1, bv = -Infinity;
      for (let i = 0; i < n; i++) {
        const v = verts[i * 3] * dx + verts[i * 3 + 1] * y + verts[i * 3 + 2] * dz;
        if (v > bv) { bv = v; best = i; }
      }
      pick.add(best);
    }
    // the base's rim, in full: a piece standing or rocking on it needs every point of it
    let low = Infinity;
    for (let i = 0; i < n; i++) low = Math.min(low, verts[i * 3 + 1]);
    for (let a = 0; a < 24; a++) {
      const dx = Math.cos(a / 24 * Math.PI * 2), dz = Math.sin(a / 24 * Math.PI * 2);
      let best = -1, bv = -Infinity;
      for (let i = 0; i < n; i++) {
        if (verts[i * 3 + 1] > low + h * 0.04) continue;
        const v = verts[i * 3] * dx + verts[i * 3 + 2] * dz;
        if (v > bv) { bv = v; best = i; }
      }
      if (best >= 0) pick.add(best);
    }
    const pts = [...pick].map((i) => [verts[i * 3], verts[i * 3 + 1] - low, verts[i * 3 + 2]]);
    // the mass: slices up the height, each a disc as wide as the piece there; the bottom quarter
    // is twice as dense (a turned piece is weighted with lead under its felt)
    const B = 24, rad = new Array(B).fill(0), cx = new Array(B).fill(0), cz = new Array(B).fill(0), cnt = new Array(B).fill(0);
    let mx = 0, mz = 0;
    for (let i = 0; i < n; i++) { mx += verts[i * 3]; mz += verts[i * 3 + 2]; }
    mx /= n || 1; mz /= n || 1;
    for (let i = 0; i < n; i++) {
      const b = Math.min(B - 1, Math.max(0, Math.floor(((verts[i * 3 + 1] - low) / h) * B)));
      rad[b] = Math.max(rad[b], Math.hypot(verts[i * 3] - mx, verts[i * 3 + 2] - mz));
      cx[b] += verts[i * 3]; cz[b] += verts[i * 3 + 2]; cnt[b]++;
    }
    for (let b = 0; b < B; b++) if (!rad[b]) rad[b] = rad[b - 1] || 0.1;
    let m = 0, my = 0, ccx = 0, ccz = 0;
    const slab = [];
    for (let b = 0; b < B; b++) {
      const r = rad[b] * 0.85, y = ((b + 0.5) / B) * h, w = r * r * (b < B / 4 ? 2 : 1);
      slab.push([y, r, w]);
      m += w; my += w * y;
      ccx += w * (cnt[b] ? cx[b] / cnt[b] : mx); ccz += w * (cnt[b] ? cz[b] / cnt[b] : mz);
    }
    const com = [ccx / m, my / m, ccz / m];
    let ixx = 0, iyy = 0;
    const dy = h / B;
    for (const [y, r, w] of slab) { ixx += w * (r * r / 4 + dy * dy / 12 + (y - com[1]) * (y - com[1])); iyy += w * r * r / 2; }
    return { pts, com, I: [ixx / m, iyy / m, ixx / m], h, r: Math.max(...rad) };
  }

  // ------------------------------------------------------------------ the fall
  // init: { p: the piece's origin (base centre) in the world, q: its turn, v: velocity,
  // w: spin (rad/s, world axes) }. o: { g, maxT }. Returns a track for pose() and its events:
  // { t (s), kind: 'land' (its base, heavily) | 'knock' (its crown or head) | 'tap' (a small
  // rattle), v (0..1) } and rolls { t, dur, v } while it rolls or spins against the board.
  const HZ = 240, KEEP = 2;
  function simulate(sh, init, o) {
    o = o || {};
    const g = o.g || 20, dt = 1 / HZ, maxT = o.maxT || 6, rest = 0.42, mu = 0.5;
    const np = sh.pts.length, P = new Float64Array(np * 3), R = new Float64Array(np * 3), H = new Float64Array(np);
    for (let i = 0; i < np; i++) { for (let j = 0; j < 3; j++) P[i * 3 + j] = sh.pts[i][j] - sh.com[j]; H[i] = sh.pts[i][1] / sh.h; }
    const i0 = 1 / sh.I[0], i1 = 1 / sh.I[1], i2 = 1 / sh.I[2];
    let q = qnorm(init.q), M = mat(q);
    const W = new Float64Array(9);   // the inverse inertia in world axes: M diag(1/I) M^T
    const world = () => {
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) W[a * 3 + b] = M[a * 3] * i0 * M[b * 3] + M[a * 3 + 1] * i1 * M[b * 3 + 1] + M[a * 3 + 2] * i2 * M[b * 3 + 2];
    };
    world();
    const c0 = add(init.p, rot(M, sh.com));
    let cx = c0[0], cy = c0[1], cz = c0[2];
    let vx = 0, vy = 0, vz = 0;
    if (init.v) [vx, vy, vz] = init.v;
    // angular momentum, kept between knocks: a spinning body's own wobble comes from that
    const w0 = init.w || [0, 0, 0], b0 = rotT(M, w0), L0 = rot(M, [b0[0] * sh.I[0], b0[1] * sh.I[1], b0[2] * sh.I[2]]);
    let Lx = L0[0], Ly = L0[1], Lz = L0[2], wx = 0, wy = 0, wz = 0;
    const omega = () => { wx = W[0] * Lx + W[1] * Ly + W[2] * Lz; wy = W[3] * Lx + W[4] * Ly + W[5] * Lz; wz = W[6] * Lx + W[7] * Ly + W[8] * Lz; };
    omega();
    const place = () => { for (let i = 0; i < np; i++) { const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; R[i * 3] = M[0] * x + M[1] * y + M[2] * z; R[i * 3 + 1] = M[3] * x + M[4] * y + M[5] * z; R[i * 3 + 2] = M[6] * x + M[7] * y + M[8] * z; } };
    place();
    const frames = [], events = [], spin = [];
    let touching = new Uint8Array(np), now = new Uint8Array(np), still = 0, t = 0, firstHit = -1;
    const lastEv = { land: -1, knock: -1, tap: -1 };
    for (let i = 0; i < np; i++) if (cy + R[i * 3 + 1] < 0.004) touching[i] = 1;
    const keep = () => {
      const r = rot(M, sh.com);
      frames.push(cx - r[0], cy - r[1], cz - r[2], q[0], q[1], q[2], q[3]);
    };
    keep();
    const con = [];
    let step = 0;
    // an impulse (px, py, pz) at r (from the centre of mass)
    const push = (rx, ry, rz, px, py, pz) => {
      vx += px; vy += py; vz += pz;
      Lx += ry * pz - rz * py; Ly += rz * px - rx * pz; Lz += rx * py - ry * px;
      omega();
    };
    // 1 + d . ((W (r x d)) x r): how much a push along d at r moves that point
    const eff = (rx, ry, rz, dx, dy, dz) => {
      const ax = ry * dz - rz * dy, ay = rz * dx - rx * dz, az = rx * dy - ry * dx;
      const bx = W[0] * ax + W[1] * ay + W[2] * az, by = W[3] * ax + W[4] * ay + W[5] * az, bz = W[6] * ax + W[7] * ay + W[8] * az;
      return 1 + dx * (by * rz - bz * ry) + dy * (bz * rx - bx * rz) + dz * (bx * ry - by * rx);
    };
    while (t < maxT) {
      vy -= g * dt;
      // contacts: hull points at or under the board
      con.length = 0; now.fill(0);
      let worst = 0, part = 0, hiC = 0, loC = 1;
      for (let i = 0; i < np; i++) {
        const rx = R[i * 3], ry = R[i * 3 + 1], rz = R[i * 3 + 2];
        if (cy + ry < 0.004) {
          const vn0 = vy + wz * rx - wx * rz;
          con.push({ rx, ry, rz, bias: vn0 < -0.35 ? -rest * vn0 : 0, pn: 0, tx: 0, tz: 0, kn: eff(rx, ry, rz, 0, 1, 0) });
          now[i] = 1;
          hiC = Math.max(hiC, H[i]); loC = Math.min(loC, H[i]);
          if (!touching[i] && -vn0 > worst) { worst = -vn0; part = H[i]; }
        }
      }
      // sequential impulses: push the touching points out of the board, let them grip it
      for (let it = 0; it < 8 && con.length; it++) {
        for (const k of con) {
          const { rx, ry, rz } = k;
          let vn = vy + wz * rx - wx * rz;
          let dp = (k.bias - vn) / k.kn;
          const pn = Math.max(0, k.pn + dp); dp = pn - k.pn; k.pn = pn;
          if (dp) push(rx, ry, rz, 0, dp, 0);
          const tx = vx + wy * rz - wz * ry, tz = vz + wx * ry - wy * rx, sp = Math.hypot(tx, tz);
          if (sp > 1e-7) {
            const ux = tx / sp, uz = tz / sp, kt = eff(rx, ry, rz, ux, 0, uz);
            let nx = k.tx - (sp / kt) * ux, nz = k.tz - (sp / kt) * uz;
            const cap = mu * k.pn, m = Math.hypot(nx, nz);
            if (m > cap) { nx *= cap / m; nz *= cap / m; }
            push(rx, ry, rz, nx - k.tx, 0, nz - k.tz);
            k.tx = nx; k.tz = nz;
          }
        }
      }
      // a knock: the loudest new touch of this step, named by the part of the piece it is
      if (worst > 0.3) {
        const vol = Math.min(1, worst / 3.2);
        const kind = vol < 0.18 ? 'tap' : part < 0.12 ? 'land' : part > 0.55 ? 'knock' : 'tap';
        if (t - lastEv[kind] > 0.06) { events.push({ t, kind, v: vol }); lastEv[kind] = t; }
        if (firstHit < 0 && (part >= 0.12 || worst > 1)) firstHit = t;
      }
      const sw = touching; touching = now; now = sw;
      // lying down (touching near its foot and its head) the board's grip slows a roll, more
      // and more as it slows (the crown catches), so it settles instead of rocking for ever
      const lying = con.length > 1 && hiC - loC > 0.4;
      if (lying) {
        const sp = Math.hypot(wx, wy, wz), k = Math.max(0, 1 - (sp < 0.6 ? 5 : 1.2) * dt);
        Lx *= k; Ly *= k; Lz *= k; vx *= k; vz *= k; omega();
      }
      // move on
      cx += vx * dt; cy += vy * dt; cz += vz * dt;
      q = qnorm([q[0] + (wx * q[3] + wy * q[2] - wz * q[1]) * dt / 2, q[1] + (wy * q[3] + wz * q[0] - wx * q[2]) * dt / 2, q[2] + (wz * q[3] + wx * q[1] - wy * q[0]) * dt / 2, q[3] - (wx * q[0] + wy * q[1] + wz * q[2]) * dt / 2]);
      M = mat(q); world(); omega(); place();
      // never inside the board
      let lowY = Infinity;
      for (let i = 0; i < np; i++) lowY = Math.min(lowY, cy + R[i * 3 + 1]);
      if (lowY < 0) cy -= lowY;
      t += dt; step++;
      const ws = Math.hypot(wx, wy, wz);
      if (step % KEEP === 0) { keep(); spin.push(lying ? Math.min(3, ws) : 0); }
      const calm = Math.hypot(vx, vy, vz) < 0.05 && ws < 0.15 && con.length >= 2;
      still = calm ? still + dt : 0;
      if (still > 0.25) break;
    }
    // stretches of rolling, for a rolling sound
    const rolls = [];
    let from = -1, sum = 0;
    for (let i = 0; i <= spin.length; i++) {
      const on = i < spin.length && spin[i] > 0.7;
      if (on && from < 0) { from = i; sum = 0; }
      if (on) sum += spin[i];
      if (!on && from >= 0) {
        const d = (i - from) * KEEP / HZ;
        if (d > 0.15) rolls.push({ t: from * KEEP / HZ, dur: d, v: Math.min(1, sum / (i - from) / 3) });
        from = -1;
      }
    }
    return { frames: new Float32Array(frames), hz: HZ / KEEP, dur: t, events, rolls, firstHit: firstHit < 0 ? 0 : firstHit };
  }
  const add4 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3]];

  // the pose at time t (s) on a track: { p: origin, q: turn }
  function pose(tr, t) {
    const n = tr.frames.length / 7 - 1;
    const f = Math.max(0, Math.min(n, t * tr.hz)), i = Math.min(n - 1, Math.floor(f)), k = n > 0 ? f - i : 0;
    const a = Math.max(0, i) * 7, b = Math.min(n, i + 1) * 7, F = tr.frames;
    const p = [F[a] + (F[b] - F[a]) * k, F[a + 1] + (F[b + 1] - F[a + 1]) * k, F[a + 2] + (F[b + 2] - F[a + 2]) * k];
    const q = slerp([F[a + 3], F[a + 4], F[a + 5], F[a + 6]], [F[b + 3], F[b + 4], F[b + 5], F[b + 6]], k);
    return { p, q };
  }
  const last = (tr) => pose(tr, tr.dur + 1);

  // How badly a fall gets in the way: hull points inside the other pieces (cylinders of radius r
  // and height h at x, z) or off the board's edge (|x|, |z| over edge). Lower is better.
  function clash(sh, tr, others, edge) {
    let bad = 0;
    const n = tr.frames.length / 7, stride = Math.max(1, Math.floor(tr.hz / 20));
    const some = sh.pts.filter((_, i) => i % 2 === 0);
    for (let f = 0; f < n; f += stride) {
      const F = tr.frames, a = f * 7, M = mat([F[a + 3], F[a + 4], F[a + 5], F[a + 6]]);
      const late = f > n * 0.5 ? 2 : 1;   // where it ends up matters most
      for (const p of some) {
        const r = rot(M, p), x = F[a] + r[0], y = F[a + 1] + r[1], z = F[a + 2] + r[2];
        for (const o of others) {
          if (y > o.h) continue;
          const d = Math.hypot(x - o.x, z - o.z);
          if (d < o.r) bad += (o.r - d) * late;
        }
        const out = Math.max(Math.abs(x), Math.abs(z)) - edge;
        if (out > 0) bad += out * 3 * late;
      }
    }
    return bad;
  }

  // how hard to tip a standing piece so it just goes over (rad/s about its rim), and the angle
  // past which it falls by itself
  function tipping(sh) {
    let rim = 0;
    for (const p of sh.pts) if (p[1] < sh.h * 0.05) rim = Math.max(rim, Math.hypot(p[0] - sh.com[0], p[2] - sh.com[2]));
    rim = rim || sh.r * 0.8;
    const d = Math.hypot(rim, sh.com[1]), Irim = sh.I[0] + d * d;
    return { angle: Math.atan2(rim, sh.com[1]), w: (g) => Math.sqrt((2 * g * (d - sh.com[1])) / Irim), rim };
  }

  // A standing piece at p (its base centre), turned by q, given a push so that it pivots on the
  // edge of its base toward the direction dir ([x, z]): k = 1 is just enough to go over.
  function tip(sh, p, q, dir, k, g) {
    const tp = tipping(sh), d = Math.hypot(dir[0], dir[1]) || 1, ux = dir[0] / d, uz = dir[1] / d;
    const axis = [uz, 0, -ux];   // turning about this tips the top toward dir
    const ws = tp.w(g || 20) * k, w = mul(axis, ws);
    const c = add(p, rot(mat(q), sh.com)), pivot = [p[0] + ux * tp.rim, p[1], p[2] + uz * tp.rim];
    return { p, q, w, v: cross(w, sub(c, pivot)) };
  }
  // the lowest point of the hull for a turn q (to lift a piece clear of the board while it
  // gets up)
  function lowest(sh, q) {
    const M = mat(q);
    let lo = Infinity;
    for (const p of sh.pts) lo = Math.min(lo, rot(M, p)[1]);
    return lo;
  }

  return { shape, simulate, pose, last, clash, tipping, tip, lowest, slerp, qmul, qaxis, qyaw, qnorm, mat, rot };
}
if (typeof module !== 'undefined') module.exports = ChacklateFall;
