// Chackmate 3D kit: the procedural modelling shared by piece sets, boards and rooms.
// Nothing is loaded from files. Shapes come from revolved profiles (with flutes,
// twists and facets), signed-distance sculpting meshed with surface nets, and a
// few ornament builders; surfaces come from canvas-painted textures (woods,
// marbles, malachite, lapis, porcelain, fabrics) and physically based materials.
function ChacklateKit(THREE) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const mix = (a, b, t) => a + (b - a) * t;
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };

  // ------------------------------------------------------------------ random and noise
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1e6) / 1e6; };
  }
  const PERM = (() => { const r = rng(7), p = Array.from({ length: 256 }, (_, i) => i); for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p.concat(p); })();
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function grad2(h, x, y) { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); }
  // Classic 2D gradient noise, roughly -1..1, tileable with period p when given.
  function noise2(x, y, p) {
    let X = Math.floor(x), Y = Math.floor(y);
    const fx = x - X, fy = y - Y;
    const X1 = p ? (X + 1) % p : X + 1, Y1 = p ? (Y + 1) % p : Y + 1;
    if (p) { X = ((X % p) + p) % p; Y = ((Y % p) + p) % p; }
    const a = PERM[(X & 255) + PERM[Y & 255]], b = PERM[(X1 & 255) + PERM[Y & 255]];
    const c = PERM[(X & 255) + PERM[Y1 & 255]], d = PERM[(X1 & 255) + PERM[Y1 & 255]];
    const u = fade(fx), v = fade(fy);
    return mix(mix(grad2(a, fx, fy), grad2(b, fx - 1, fy), u), mix(grad2(c, fx, fy - 1), grad2(d, fx - 1, fy - 1), u), v) * 0.35;
  }
  function fbm(x, y, oct, p) {
    let s = 0, a = 0.5, f = 1;
    for (let i = 0; i < (oct || 4); i++) { s += a * noise2(x * f, y * f, p ? p * f : 0); a *= 0.5; f *= 2; }
    return s;
  }

  // ------------------------------------------------------------------ profiles
  // A profile is traced in (r, y): r is the distance from the vertical axis.
  // It starts on the axis at the bottom and ends on the axis at the top.
  function Profile(r, y) {
    this.segs = [];
    this.at = [r || 0, y || 0];
  }
  Profile.prototype._push = function (pts, smoothJoin) {
    this.segs.push({ pts, smoothJoin: !!smoothJoin });
    this.at = pts[pts.length - 1];
    return this;
  };
  // How finely shapes are tessellated. 1 is the full detail used for close-ups (menu art
  // and the collection); pieces on the table are built coarser (see ChacklatePieces), since
  // 32 of them are drawn three times a frame (view, shadows, reflections).
  const DETAIL = { around: 1, along: 1, tube: 1 };
  const stepsFor = (len, density) => Math.max(2, Math.round(Math.min(64, Math.ceil(len / (density || 0.006))) * DETAIL.along));
  Profile.prototype.line = function (r, y, smoothJoin) {
    const [r0, y0] = this.at, n = stepsFor(Math.hypot(r - r0, y - y0), 0.05);
    const pts = []; for (let i = 0; i <= n; i++) pts.push([mix(r0, r, i / n), mix(y0, y, i / n)]);
    return this._push(pts, smoothJoin);
  };
  // Circular arc to (r, y). bulge > 0 swells outward (away from the axis on an upward stroke).
  Profile.prototype.arc = function (r, y, bulge, smoothJoin) {
    const [r0, y0] = this.at, dx = r - r0, dy = y - y0, chord = Math.hypot(dx, dy);
    const nx = dy / chord, ny = -dx / chord;   // right-hand normal of travel = away from axis when climbing
    const s = bulge * chord, n = stepsFor(chord * (1 + Math.abs(bulge) * 2));
    const pts = [];
    // Quadratic-like sagitta curve: a true circle through both ends and the bulge point.
    const mx = (r0 + r) / 2 + nx * s, my = (y0 + y) / 2 + ny * s;
    const circle = circleFrom3([r0, y0], [mx, my], [r, y]);
    if (!circle || Math.abs(bulge) < 1e-4) return this.line(r, y, smoothJoin);
    const [cx, cy, R] = circle;
    let a0 = Math.atan2(y0 - cy, r0 - cx), a1 = Math.atan2(y - cy, r - cx), am = Math.atan2(my - cy, mx - cx);
    // choose the sweep direction that passes through the mid point
    const norm = (a) => ((a % TAU) + TAU) % TAU;
    let sweep = norm(a1 - a0);
    if (norm(am - a0) > sweep) sweep = sweep - TAU;
    for (let i = 0; i <= n; i++) { const a = a0 + sweep * (i / n); pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
    pts[n] = [r, y];
    return this._push(pts, smoothJoin);
  };
  Profile.prototype.bez = function (c1r, c1y, c2r, c2y, r, y, smoothJoin) {
    const [r0, y0] = this.at;
    const len = Math.hypot(c1r - r0, c1y - y0) + Math.hypot(c2r - c1r, c2y - c1y) + Math.hypot(r - c2r, y - c2y);
    const n = stepsFor(len), pts = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, u = 1 - t;
      pts.push([u * u * u * r0 + 3 * u * u * t * c1r + 3 * u * t * t * c2r + t * t * t * r, u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y]);
    }
    return this._push(pts, smoothJoin);
  };
  // Smooth curve through points (Catmull-Rom), joined smoothly to whatever comes next.
  Profile.prototype.curve = function (points, smoothJoin) {
    const all = [this.at].concat(points), pts = [];
    for (let i = 0; i < all.length - 1; i++) {
      const p0 = all[Math.max(0, i - 1)], p1 = all[i], p2 = all[i + 1], p3 = all[Math.min(all.length - 1, i + 2)];
      const n = stepsFor(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]));
      for (let k = i ? 1 : 0; k <= n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        pts.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
      }
    }
    return this._push(pts, smoothJoin);
  };
  // A rounded bead (torus-like collar) of height h sticking out by d, from the current point upward.
  Profile.prototype.bead = function (h, d) {
    const [r, y] = this.at;
    return this.arc(r, y + h, d / h);
  };
  // Shorthand: a horizontal step out/in at the current height.
  Profile.prototype.to = function (r, y) { return this.line(r, y); };
  // Flattened list of rings: { r, y, tr, ty, v } with duplicated vertices at creases.
  Profile.prototype.rings = function (creaseDeg) {
    const crease = Math.cos(((creaseDeg === undefined ? 28 : creaseDeg) * Math.PI) / 180);
    const out = [];
    let v = 0, last = null;
    const tangent = (pts, i) => {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
      return [dx / l, dy / l];
    };
    this.segs.forEach((s, si) => {
      const pts = s.pts;
      for (let i = 0; i < pts.length; i++) {
        const t = tangent(pts, i);
        if (i === 0 && last) {
          // join with the previous segment: merge if smooth enough, otherwise keep both
          const dot = last.tr * t[0] + last.ty * t[1];
          if (s.smoothJoin || dot > crease) {
            const tr = last.tr + t[0], ty = last.ty + t[1], l = Math.hypot(tr, ty) || 1;
            last.tr = tr / l; last.ty = ty / l;
            continue;
          }
          out.push({ r: pts[0][0], y: pts[0][1], tr: t[0], ty: t[1], v, seam: true });
          continue;
        }
        if (last) v += Math.hypot(pts[i][0] - last.r, pts[i][1] - last.y);
        last = { r: Math.max(0, pts[i][0]), y: pts[i][1], tr: t[0], ty: t[1], v };
        out.push(last);
      }
    });
    const total = v || 1;
    for (const p of out) { p.len = p.v; p.v /= total; }
    return out;
  };
  const profile = (r, y) => new Profile(r, y);
  function circleFrom3(a, b, c) {
    const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
    if (Math.abs(d) < 1e-9) return null;
    const a2 = a[0] * a[0] + a[1] * a[1], b2 = b[0] * b[0] + b[1] * b[1], c2 = c[0] * c[0] + c[1] * c[1];
    const ux = (a2 * (b[1] - c[1]) + b2 * (c[1] - a[1]) + c2 * (a[1] - b[1])) / d;
    const uy = (a2 * (c[0] - b[0]) + b2 * (a[0] - c[0]) + c2 * (b[0] - a[0])) / d;
    return [ux, uy, Math.hypot(a[0] - ux, a[1] - uy)];
  }

  // ------------------------------------------------------------------ radial modifiers
  // Each returns m(theta, y) multiplying the radius. Compose with mods([...]).
  const MOD = {
    // Vertical flutes: count grooves of relative depth between y0 and y1 (rounded ends).
    flutes(count, depth, y0, y1, o) {
      o = o || {};
      const fillet = o.fillet === undefined ? 0.16 : o.fillet, end = o.end === undefined ? 0.035 : o.end, twist = o.twist || 0, phase = o.phase || 0;
      return (th, y) => {
        if (y < y0 || y > y1) return 1;
        const w = smooth(y0, y0 + end, y) * (1 - smooth(y1 - end, y1, y));
        const a = (th + twist * (y - y0)) * count / TAU + phase;
        const u = a - Math.floor(a);
        // soft: a smooth cosine groove (no edges to alias when twisted)
        const g = o.soft ? 0.5 - 0.5 * Math.cos(TAU * u) : Math.sin(Math.PI * clamp((u - fillet / 2) / (1 - fillet), 0, 1));
        return 1 - depth * w * Math.pow(g, o.sharp || 0.7);
      };
    },
    // Rounded lobes (gadroons, melon crowns): positive depth swells.
    lobes(count, depth, y0, y1, o) {
      o = o || {};
      const end = o.end === undefined ? 0.04 : o.end, phase = o.phase || 0, shape = o.shape || 1;
      return (th, y) => {
        if (y < y0 || y > y1) return 1;
        const w = o.flat ? 1 : smooth(y0, y0 + end, y) * (1 - smooth(y1 - end, y1, y));
        const c = Math.abs(Math.cos((th * count) / 2 + phase));
        return 1 + depth * w * (Math.pow(c, shape) - 0.5);
      };
    },
    // Polygonal cross-section with n sides (optionally rounded corners).
    facets(n, y0, y1, round) {
      const half = Math.PI / n;
      return (th, y) => {
        if (y < y0 || y > y1) return 1;
        const a = ((th % (2 * half)) + 2 * half) % (2 * half) - half;
        const f = Math.cos(half) / Math.cos(a);
        return mix(f, 1, round || 0);
      };
    },
    // A groove cut by a tilted plane (the bishop's mitre slit). axis angle th0, tilt, centre y.
    slit(th0, yc, tilt, width, depth) {
      return (th, y) => {
        const s = Math.sin(th - th0);
        const d = Math.abs((y - yc) - Math.tan(tilt) * s * 0.18);
        if (d > width || Math.cos(th - th0) < -0.2) return 1;
        const k = 1 - d / width;
        return 1 - depth * k * k * smooth(-0.2, 0.25, Math.cos(th - th0));
      };
    },
    // Twisted rope / barley twist.
    rope(count, depth, y0, y1, turns) {
      return (th, y) => {
        if (y < y0 || y > y1) return 1;
        const w = smooth(y0, y0 + 0.02, y) * (1 - smooth(y1 - 0.02, y1, y));
        const a = th * count + ((y - y0) / (y1 - y0)) * turns * TAU;
        return 1 + depth * w * (Math.abs(Math.sin(a / 2)) - 0.6);
      };
    },
    // A raised band winding up the surface (Trajan's Column): turns between y0 and y1.
    helix(depth, turns, y0, y1, o) {
      o = o || {};
      const width = o.width || 0.32, end = o.end === undefined ? 0.03 : o.end;
      return (th, y) => {
        if (y < y0 || y > y1) return 1;
        const w = smooth(y0, y0 + end, y) * (1 - smooth(y1 - end, y1, y));
        const a = th / TAU + ((y - y0) / (y1 - y0)) * turns, u = a - Math.floor(a);
        const b = smooth(0.5 - width / 2, 0.5 - width / 2 + 0.06, u) * (1 - smooth(0.5 + width / 2 - 0.06, 0.5 + width / 2, u));
        return 1 + depth * w * b;
      };
    },
    // Recessed arches round a drum: count bays between y0 and y1, each `width` of a bay wide,
    // with a round or pointed head of height `head`.
    arcade(count, y0, y1, width, depth, o) {
      o = o || {};
      const head = o.head || 0.06, pointed = !!o.pointed, soft = o.soft || 0.08, phase = o.phase || 0;
      return (th, y) => {
        if (y < y0 || y > y1) return 1;
        const a = (th * count) / TAU + phase, u = (a - Math.floor(a) - 0.5) / (width / 2);   // -1..1 across an arch
        const yc = y1 - head;
        let half;   // half width of the opening at this height, in units of the arch width
        if (y <= yc) half = 1;
        else { const t = (y - yc) / head; half = pointed ? Math.pow(Math.max(0, 1 - t), 0.75) : Math.sqrt(Math.max(0, 1 - t * t)); }
        const edge = clamp((half - Math.abs(u)) / soft, 0, 1) * smooth(y0, y0 + 0.008, y);
        return 1 - depth * edge;
      };
    },
    // Battlements: gaps cut down from the top of a tower.
    crenel(count, y0, y1, gap, depth) {
      return (th, y) => {
        if (y < y0) return 1;
        const a = (th * count) / TAU, u = a - Math.floor(a);
        const inGap = Math.abs(u - 0.5) < gap / 2;
        return inGap ? 1 - depth * smooth(y0, y0 + 0.012, y) : 1;
      };
    },
  };
  const mods = (list) => (th, y) => { let m = 1; for (const f of list) m *= f(th, y); return m; };

  // ------------------------------------------------------------------ revolve
  // Position and outward normal of a revolved surface at angle th for profile ring p.
  // mod(th, y) scales the radius; lift(th, y) moves the point up or down (crown points).
  const EPS = 1e-3;
  function frame(p, th, mod, lift, out) {
    const s = Math.sin(th), c = Math.cos(th);
    const m = mod ? mod(th, p.y) : 1, L = lift ? lift(th, p.y) : 0;
    const r = p.r * m;
    let mth = 0, my = 0, lth = 0, ly = 0;
    if (mod) { mth = (mod(th + EPS, p.y) - mod(th - EPS, p.y)) / (2 * EPS); my = (mod(th, p.y + EPS) - mod(th, p.y - EPS)) / (2 * EPS); }
    if (lift) { lth = (lift(th + EPS, p.y) - lift(th - EPS, p.y)) / (2 * EPS); ly = (lift(th, p.y + EPS) - lift(th, p.y - EPS)) / (2 * EPS); }
    const dthx = p.r * (mth * s + m * c), dthy = lth, dthz = p.r * (mth * c - m * s);
    const drt = p.tr * m + p.r * my * p.ty;
    const dtx = drt * s, dty = p.ty * (1 + ly), dtz = drt * c;
    let nx = dthy * dtz - dthz * dty, ny = dthz * dtx - dthx * dtz, nz = dthx * dty - dthy * dtx;
    let l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) { nx = p.ty * s; ny = -p.tr; nz = p.ty * c; l = Math.hypot(nx, ny, nz) || 1; if (p.r < 1e-5) { nx = 0; ny = p.tr > 0 ? -1 : 1; nz = 0; l = 1; } }
    out[0] = r * s; out[1] = p.y + L; out[2] = r * c; out[3] = nx / l; out[4] = ny / l; out[5] = nz / l;
    return out;
  }
  // Revolves a profile around Y into a BufferGeometry with normals and UVs.
  // opts: segs, mod(theta, y), lift(theta, y), phi0, phiLen, creaseDeg, uvAround (u repeats per turn)
  // UV v is the absolute length along the profile, so textures keep their scale across pieces.
  function revolve(prof, opts) {
    const o = opts || {};
    const rings = prof instanceof Profile ? prof.rings(o.creaseDeg) : prof;
    const segs0 = o.segs || 64, segs = Math.max(Math.min(segs0, 8), Math.round(segs0 * DETAIL.around));
    const phi0 = o.phi0 || 0, phiLen = o.phiLen || TAU;
    const mod = o.mod || null, lift = o.lift || null;
    const nR = rings.length, nC = segs + 1;
    const pos = new Float32Array(nR * nC * 3), nor = new Float32Array(nR * nC * 3), uv = new Float32Array(nR * nC * 2);
    const f = new Float32Array(6);
    for (let i = 0; i < nR; i++) {
      const p = rings[i];
      for (let j = 0; j < nC; j++) {
        frame(p, phi0 + (j / segs) * phiLen, mod, lift, f);
        const k = (i * nC + j) * 3;
        pos[k] = f[0]; pos[k + 1] = f[1]; pos[k + 2] = f[2];
        nor[k] = f[3]; nor[k + 1] = f[4]; nor[k + 2] = f[5];
        uv[(i * nC + j) * 2] = (j / segs) * (o.uvAround || 1);
        uv[(i * nC + j) * 2 + 1] = p.len;
      }
    }
    const idx = [];
    for (let i = 0; i < nR - 1; i++) {
      if (rings[i + 1].seam) continue;   // crease: the next ring starts a new strip
      for (let j = 0; j < segs; j++) {
        const a = i * nC + j, b = a + 1, c = a + nC, d = c + 1;
        if (rings[i].r < 1e-6 && rings[i + 1].r < 1e-6) continue;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }
  // Evenly spaced samples (by length) along a profile's rings between v0 and v1 (0..1),
  // returned as surface frames [x, y, z, nx, ny, nz] at angle th.
  function alongProfile(prof, th, count, v0, v1, o) {
    o = o || {};
    const rings = prof instanceof Profile ? prof.rings(o.creaseDeg) : prof;
    const out = [];
    for (let n = 0; n < count; n++) {
      const v = mix(v0, v1, count === 1 ? 0.5 : n / (count - 1));
      let i = 0;
      while (i < rings.length - 2 && rings[i + 1].v < v) i++;
      const a = rings[i], b = rings[i + 1], t = clamp((v - a.v) / ((b.v - a.v) || 1), 0, 1);
      const p = { r: mix(a.r, b.r, t), y: mix(a.y, b.y, t), tr: mix(a.tr, b.tr, t), ty: mix(a.ty, b.ty, t) };
      out.push(Array.from(frame(p, th, o.mod, o.lift, new Float32Array(6))));
    }
    return out;
  }

  // ------------------------------------------------------------------ signed distance sculpting
  // Primitives take scalar coordinates to keep the inner loops allocation-free.
  const sq = Math.sqrt;
  const SD = {
    sphere: (x, y, z, cx, cy, cz, r) => { const dx = x - cx, dy = y - cy, dz = z - cz; return sq(dx * dx + dy * dy + dz * dz) - r; },
    ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz) {
      const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
      const k0 = sq(px * px + py * py + pz * pz);
      const qx = px / rx, qy = py / ry, qz = pz / rz, k1 = sq(qx * qx + qy * qy + qz * qz);
      return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1;
    },
    capsule(x, y, z, ax, ay, az, bx, by, bz, r) {
      const pax = x - ax, pay = y - ay, paz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az;
      const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
      const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
      return sq(dx * dx + dy * dy + dz * dz) - r;
    },
    // Cone between two spheres of radius r1 (at a) and r2 (at b).
    roundCone(x, y, z, ax, ay, az, bx, by, bz, r1, r2) {
      const bax = bx - ax, bay = by - ay, baz = bz - az;
      const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
      const pax = x - ax, pay = y - ay, paz = z - az;
      const yv = pax * bax + pay * bay + paz * baz, zv = yv - l2;
      const qx = pax * l2 - bax * yv, qy = pay * l2 - bay * yv, qz = paz * l2 - baz * yv;
      const x2 = qx * qx + qy * qy + qz * qz, y2 = yv * yv * l2, z2 = zv * zv * l2;
      const k = Math.sign(rr) * rr * rr * x2;
      if (Math.sign(zv) * a2 * z2 > k) return sq(x2 + z2) * il2 - r2;
      if (Math.sign(yv) * a2 * y2 < k) return sq(x2 + y2) * il2 - r1;
      return (sq(x2 * a2 * il2) + yv * rr) * il2 - r1;
    },
    torus(x, y, z, cx, cy, cz, R, r) { const dx = x - cx, dz = z - cz, q = sq(dx * dx + dz * dz) - R, dy = y - cy; return sq(q * q + dy * dy) - r; },
    box(x, y, z, cx, cy, cz, hx, hy, hz, r) {
      const qx = Math.abs(x - cx) - hx + r, qy = Math.abs(y - cy) - hy + r, qz = Math.abs(z - cz) - hz + r;
      const mx = Math.max(qx, 0), my = Math.max(qy, 0), mz = Math.max(qz, 0);
      return sq(mx * mx + my * my + mz * mz) + Math.min(Math.max(qx, qy, qz), 0) - r;
    },
    cylinder(x, y, z, cx, cy, cz, r, h) {
      const ex = x - cx, ez = z - cz, dx = sq(ex * ex + ez * ez) - r, dy = Math.abs(y - cy) - h;
      const mx = Math.max(dx, 0), my = Math.max(dy, 0);
      return Math.min(Math.max(dx, dy), 0) + sq(mx * mx + my * my);
    },
    smin(a, b, k) { if (k <= 0) return a < b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return (a < b ? a : b) - h * h * k * 0.25; },
    smax(a, b, k) { if (k <= 0) return a > b ? a : b; const h = Math.max(k - Math.abs(a - b), 0) / k; return (a > b ? a : b) + h * h * k * 0.25; },
    // distance from a point to a sphere bound (for skipping far-away features)
    far(x, y, z, cx, cy, cz, r) { const dx = x - cx, dy = y - cy, dz = z - cz; return sq(dx * dx + dy * dy + dz * dz) - r; },
  };
  // A smooth "strand" through points [[x,y,z,r], ...] as a chain of round cones.
  function strand(points) {
    const segs = [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, cz = (a[2] + b[2]) / 2;
      const rad = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2 + Math.max(a[3], b[3]);
      segs.push([a[0], a[1], a[2], b[0], b[1], b[2], a[3], b[3], cx, cy, cz, rad]);
    }
    return segs;
  }
  // Distance to a set of strand segments. A first pass finds an upper bound (the nearest
  // end sphere); only segments whose bounding sphere comes within k of it are evaluated.
  function strandsDist(x, y, z, segs, k, best) {
    let d = best === undefined ? 1e9 : best, U = d;
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], ex = x - s[0], ey = y - s[1], ez = z - s[2];
      const u = sq(ex * ex + ey * ey + ez * ez) - s[6];
      if (u < U) U = u;
    }
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i], ex = x - s[8], ey = y - s[9], ez = z - s[10];
      const bd = sq(ex * ex + ey * ey + ez * ez) - s[11];
      if (bd > U + k) continue;
      d = SD.smin(d, SD.roundCone(x, y, z, s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]), k);
    }
    return d;
  }
  // Field for many strands with a uniform-grid index: each query only visits segments
  // whose bounding sphere comes within `margin` of its grid cell. Beyond that it reports
  // `margin` (outside), which is all the narrow-band mesher needs there.
  function strandField(segs, k, margin, cellSize) {
    const G = cellSize || 0.03;
    let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
    for (const s of segs) {
      x0 = Math.min(x0, s[8] - s[11]); y0 = Math.min(y0, s[9] - s[11]); z0 = Math.min(z0, s[10] - s[11]);
      x1 = Math.max(x1, s[8] + s[11]); y1 = Math.max(y1, s[9] + s[11]); z1 = Math.max(z1, s[10] + s[11]);
    }
    const pad = margin + k;
    x0 -= pad; y0 -= pad; z0 -= pad; x1 += pad; y1 += pad; z1 += pad;
    const nx = Math.max(1, Math.ceil((x1 - x0) / G)), ny = Math.max(1, Math.ceil((y1 - y0) / G)), nz = Math.max(1, Math.ceil((z1 - z0) / G));
    const cells = new Array(nx * ny * nz);
    segs.forEach((s) => {
      const r = s[11] + pad + G * 0.87;
      const i0 = Math.max(0, Math.floor((s[8] - r - x0) / G)), i1 = Math.min(nx - 1, Math.floor((s[8] + r - x0) / G));
      const j0 = Math.max(0, Math.floor((s[9] - r - y0) / G)), j1 = Math.min(ny - 1, Math.floor((s[9] + r - y0) / G));
      const k0 = Math.max(0, Math.floor((s[10] - r - z0) / G)), k1 = Math.min(nz - 1, Math.floor((s[10] + r - z0) / G));
      for (let c = k0; c <= k1; c++) for (let b = j0; b <= j1; b++) for (let a = i0; a <= i1; a++) {
        const id = a + nx * (b + ny * c);
        (cells[id] = cells[id] || []).push(s);
      }
    });
    return (x, y, z) => {
      const i = Math.floor((x - x0) / G), j = Math.floor((y - y0) / G), c = Math.floor((z - z0) / G);
      if (i < 0 || j < 0 || c < 0 || i >= nx || j >= ny || c >= nz) return margin;
      const list = cells[i + nx * (j + ny * c)];
      if (!list) return margin;
      return Math.min(margin, strandsDist(x, y, z, list, k));
    };
  }
  // Signed distance to a closed 2D outline [[u, v], ...] (negative inside), baked into a
  // grid over [u0, v0, u1, v1] and read back with bilinear filtering.
  function field2(poly, box, res) {
    const [u0, v0, u1, v1] = box;
    const nu = Math.ceil((u1 - u0) / res) + 1, nv = Math.ceil((v1 - v0) / res) + 1;
    const grid = new Float32Array(nu * nv), N = poly.length;
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const pu = u0 + i * res, pv = v0 + j * res;
      let best = 1e9, inside = false;
      for (let a = 0, b = N - 1; a < N; b = a++) {
        const au = poly[a][0], av = poly[a][1], bu = poly[b][0], bv = poly[b][1];
        const eu = bu - au, ev = bv - av, wu = pu - au, wv = pv - av;
        const h = clamp((wu * eu + wv * ev) / (eu * eu + ev * ev || 1), 0, 1);
        const du = wu - eu * h, dv = wv - ev * h, dd = du * du + dv * dv;
        if (dd < best) best = dd;
        if ((av > pv) !== (bv > pv) && pu < ((bu - au) * (pv - av)) / (bv - av) + au) inside = !inside;
      }
      grid[i + nu * j] = (inside ? -1 : 1) * sq(best);
    }
    return (u, v) => {
      const fu = clamp((u - u0) / res, 0, nu - 1.001), fv = clamp((v - v0) / res, 0, nv - 1.001);
      const i = fu | 0, j = fv | 0, tu = fu - i, tv = fv - j, k = i + nu * j;
      const a = grid[k] + (grid[k + 1] - grid[k]) * tu, b = grid[k + nu] + (grid[k + nu + 1] - grid[k + nu]) * tu;
      let d = a + (b - a) * tv;
      // outside the baked box, keep growing so the field stays positive
      const ou = u < u0 ? u0 - u : u > u1 ? u - u1 : 0, ov = v < v0 ? v0 - v : v > v1 ? v - v1 : 0;
      if (ou || ov) d = Math.max(d, 0) + sq(ou * ou + ov * ov);
      return d;
    };
  }
  // Smoothly blended scalar map from anchors [[u, v, value], ...] (Gaussian weights).
  function blendMap(anchors, sigma) {
    const s2 = 1 / (sigma * sigma);
    return (u, v) => {
      let ws = 0, vs = 0;
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i], du = u - a[0], dv = v - a[1], w = Math.exp(-(du * du + dv * dv) * s2) + 1e-12;
        ws += w; vs += w * a[2];
      }
      return vs / ws;
    };
  }
  // Catmull-Rom sample of control points [[x,y,z,r]] into n points per span.
  function spline(ctrl, n) {
    const out = [];
    for (let i = 0; i < ctrl.length - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
      for (let k = i ? 1 : 0; k <= n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3);
        out.push([f(0), f(1), f(2), Math.max(0.0005, f(3))]);
      }
    }
    return out;
  }

  // Surface nets mesher: f(x,y,z) < 0 inside. Returns an indexed BufferGeometry with
  // gradient normals. bounds = [x0, y0, z0, x1, y1, z1], cell = grid spacing.
  function sdfGeometry(f, bounds, cell, opts) {
    const o = opts || {};
    const [x0, y0, z0, x1, y1, z1] = bounds;
    const nx = Math.ceil((x1 - x0) / cell) + 3, ny = Math.ceil((y1 - y0) / cell) + 3, nz = Math.ceil((z1 - z0) / cell) + 3;
    const ox = x0 - cell, oy = y0 - cell, oz = z0 - cell;
    const field = new Float32Array(nx * ny * nz);
    // Narrow band: sample a coarse grid first and only evaluate the fine grid in coarse
    // cells the surface could pass through; elsewhere interpolate (the sign is all we need).
    const S = 4, cnx = Math.ceil((nx - 1) / S) + 1, cny = Math.ceil((ny - 1) / S) + 1, cnz = Math.ceil((nz - 1) / S) + 1;
    const coarse = new Float32Array(cnx * cny * cnz);
    for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) coarse[i + cnx * (j + cny * k)] = f(ox + i * S * cell, oy + j * S * cell, oz + k * S * cell);
    const band = S * cell * (o.band || 1.25);
    const CI = (i, j, k) => coarse[Math.min(i, cnx - 1) + cnx * (Math.min(j, cny - 1) + cny * Math.min(k, cnz - 1))];
    for (let k = 0; k < nz; k++) {
      const z = oz + k * cell, ck = Math.floor(k / S), tk = (k - ck * S) / S;
      for (let j = 0; j < ny; j++) {
        const y = oy + j * cell, row = nx * (j + ny * k), cj = Math.floor(j / S), tj = (j - cj * S) / S;
        for (let i = 0; i < nx; i++) {
          const ci = Math.floor(i / S), ti = (i - ci * S) / S;
          const c000 = CI(ci, cj, ck), c100 = CI(ci + 1, cj, ck), c010 = CI(ci, cj + 1, ck), c110 = CI(ci + 1, cj + 1, ck);
          const c001 = CI(ci, cj, ck + 1), c101 = CI(ci + 1, cj, ck + 1), c011 = CI(ci, cj + 1, ck + 1), c111 = CI(ci + 1, cj + 1, ck + 1);
          const near = Math.min(Math.abs(c000), Math.abs(c100), Math.abs(c010), Math.abs(c110), Math.abs(c001), Math.abs(c101), Math.abs(c011), Math.abs(c111)) < band;
          if (near) field[row + i] = f(ox + i * cell, y, z);
          else {
            const a = mix(mix(c000, c100, ti), mix(c010, c110, ti), tj), b = mix(mix(c001, c101, ti), mix(c011, c111, ti), tj);
            field[row + i] = mix(a, b, tk);
          }
        }
      }
    }
    const F = (i, j, k) => field[i + nx * (j + ny * k)];
    const cx = nx - 1, cy = ny - 1, cz = nz - 1;
    const cellVert = new Int32Array(cx * cy * cz).fill(-1);
    const pos = [];
    const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
    const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
    const v = new Float32Array(8);
    for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) {
      let mask = 0;
      for (let c = 0; c < 8; c++) { const d = CORNERS[c]; v[c] = F(i + d[0], j + d[1], k + d[2]); if (v[c] < 0) mask |= 1 << c; }
      if (mask === 0 || mask === 255) continue;
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (const [a, b] of EDGES) {
        if ((v[a] < 0) === (v[b] < 0)) continue;
        const t = v[a] / (v[a] - v[b]);
        const A = CORNERS[a], B = CORNERS[b];
        sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; n++;
      }
      cellVert[i + cx * (j + cy * k)] = pos.length / 3;
      pos.push(ox + (i + sx / n) * cell, oy + (j + sy / n) * cell, oz + (k + sz / n) * cell);
    }
    const idx = [];
    const C = (i, j, k) => cellVert[i + cx * (j + cy * k)];
    // The winding follows from the edge's axis and which end is inside: the cells run
    // (y, z) round an x edge, (x, z) round a y edge and (x, y) round a z edge, so their
    // natural normal is +x, -y and +z. (Deciding from the triangle's own normal fails where
    // a thin part folds a quad, which then faces inward and shows as a pinhole.)
    const quad = (a, b, c, d, axis, outward) => {
      if (a < 0 || b < 0 || c < 0 || d < 0) return;
      const flip = (axis === 1 ? -outward : outward) < 0;
      if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
    };
    for (let k = 1; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 0; i < cx; i++) {
      const s0 = F(i, j, k) < 0, s1 = F(i + 1, j, k) < 0;
      if (s0 !== s1) quad(C(i, j - 1, k - 1), C(i, j, k - 1), C(i, j, k), C(i, j - 1, k), 0, s0 ? 1 : -1);
    }
    for (let k = 1; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 1; i < cx; i++) {
      const s0 = F(i, j, k) < 0, s1 = F(i, j + 1, k) < 0;
      if (s0 !== s1) quad(C(i - 1, j, k - 1), C(i, j, k - 1), C(i, j, k), C(i - 1, j, k), 1, s0 ? 1 : -1);
    }
    for (let k = 0; k < cz; k++) for (let j = 1; j < cy; j++) for (let i = 1; i < cx; i++) {
      const s0 = F(i, j, k) < 0, s1 = F(i, j, k + 1) < 0;
      if (s0 !== s1) quad(C(i - 1, j - 1, k), C(i, j - 1, k), C(i, j, k), C(i - 1, j, k), 2, s0 ? 1 : -1);
    }
    // project vertices onto the surface and compute gradient normals (tetrahedral taps)
    const nrm = new Float32Array(pos.length);
    const e = cell * 0.3;
    const tet = (x, y, z, out) => {
      const a = f(x + e, y - e, z - e), b = f(x - e, y - e, z + e), c = f(x - e, y + e, z - e), d = f(x + e, y + e, z + e);
      out[0] = a - b - c + d; out[1] = -a - b + c + d; out[2] = -a + b - c + d; out[3] = (a + b + c + d) / 4;
      return out;
    };
    const T = [0, 0, 0, 0], iters = o.project === undefined ? 1 : o.project;
    for (let q = 0; q < pos.length; q += 3) {
      let x = pos[q], y = pos[q + 1], z = pos[q + 2];
      for (let it = 0; it < iters; it++) {
        tet(x, y, z, T);
        const gl = Math.sqrt(T[0] * T[0] + T[1] * T[1] + T[2] * T[2]) || 1, gs = gl / (4 * e);
        const step = clamp(T[3] / (gs || 1), -cell * 0.6, cell * 0.6);
        x -= (T[0] / gl) * step; y -= (T[1] / gl) * step; z -= (T[2] / gl) * step;
      }
      pos[q] = x; pos[q + 1] = y; pos[q + 2] = z;
      tet(x, y, z, T);
      const l = Math.sqrt(T[0] * T[0] + T[1] * T[1] + T[2] * T[2]) || 1;
      nrm[q] = T[0] / l; nrm[q + 1] = T[1] / l; nrm[q + 2] = T[2] / l;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    // planar UVs from the side (x, y): enough for marble and wood textures on sculpted parts
    const uvs = new Float32Array((pos.length / 3) * 2);
    for (let q = 0, w = 0; q < pos.length; q += 3, w += 2) { uvs[w] = pos[q] * (o.uvScale || 1.4) + pos[q + 2] * 0.35; uvs[w + 1] = pos[q + 1] * (o.uvScale || 1.4); }
    g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    g.setIndex(idx);
    return g;
  }

  // ------------------------------------------------------------------ ornaments
  // A ring of beads (pearls, gold dots) at height y and radius r.
  function beadRing(r, y, count, size, o) {
    o = o || {};
    const seg = Math.max(6, Math.round((o.seg || 10) * Math.sqrt(DETAIL.around)));
    const base = new THREE.SphereGeometry(size, seg, Math.max(4, seg - 2));
    const parts = [];
    for (let i = 0; i < count; i++) {
      const th = (i / count) * TAU + (o.phase || 0);
      const g = base.clone();
      if (o.squash) g.scale(1, o.squash, 1);
      g.translate(Math.sin(th) * r, y, Math.cos(th) * r);
      parts.push(g);
    }
    return THREE.mergeGeometries(parts);
  }
  // A torus-section band lying on a radius (gold rings around collars).
  function ring(r, y, thick, o) {
    o = o || {};
    const g = new THREE.TorusGeometry(r, thick, Math.max(5, Math.round((o.tube || 10) * Math.sqrt(DETAIL.around))), Math.max(16, Math.round((o.seg || 72) * DETAIL.around)));
    g.rotateX(Math.PI / 2);
    if (o.squash) g.scale(1, o.squash, 1);
    g.translate(0, y, 0);
    return g;
  }
  // Extrude a closed 2D outline (array of [x, y]) with a bevel, centred on z.
  function extrude(outline, depth, bevel, o) {
    o = o || {};
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    (o.holes || []).forEach((h) => shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y)))));
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * (o.bevelSize || 0.9), bevelSegments: Math.max(2, Math.round((o.bevelSegments || 4) * DETAIL.along * 1.5)), curveSegments: Math.max(6, Math.round((o.curveSegments || 24) * DETAIL.around)) });
    g.translate(0, 0, -depth / 2);
    g.computeVertexNormals();
    return g;
  }
  // Smooth closed outline through points.
  function closedCurve(points, n) {
    const out = [];
    const N = points.length;
    for (let i = 0; i < N; i++) {
      const p0 = points[(i - 1 + N) % N], p1 = points[i], p2 = points[(i + 1) % N], p3 = points[(i + 2) % N];
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map((j) => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    return out;
  }
  // Mirror a half outline (x >= 0, listed from top centre down to bottom centre) into a symmetric closed outline.
  function mirrorOutline(half) {
    const right = half.slice();
    const left = half.slice(1, -1).reverse().map(([x, y]) => [-x, y]);
    return right.concat(left);
  }
  // A tube along a 3D curve of points.
  function tube(points, radius, o) {
    o = o || {};
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])), !!o.closed, 'centripetal');
    const segs = Math.max(4, Math.round((o.segs || Math.max(8, points.length * 6)) * DETAIL.tube));
    const radialN = Math.max(5, Math.round((o.radial || 8) * Math.sqrt(DETAIL.tube)));
    const g = new THREE.TubeGeometry(curve, segs, radius, radialN, !!o.closed);
    if (o.taper || o.radiusAt) {
      // shrink toward the ends, or follow radiusAt(t) (a multiple of radius, t from 0 to 1)
      const p = g.attributes.position, n = g.attributes.normal;
      const rings = segs + 1, radial = radialN + 1;
      for (let i = 0; i < rings; i++) {
        const t = i / (rings - 1), s = o.radiusAt ? o.radiusAt(t) : Math.max(0.15, Math.sin(Math.PI * Math.min(1, t * (o.taperIn || 1.2))) ** 0.35);
        const c = curve.getPointAt(Math.min(1, t));
        for (let j = 0; j < radial; j++) {
          const q = i * radial + j;
          p.setXYZ(q, c.x + (p.getX(q) - c.x) * s, c.y + (p.getY(q) - c.y) * s, c.z + (p.getZ(q) - c.z) * s);
        }
      }
      p.needsUpdate = true; n.needsUpdate = true;
    }
    return g;
  }
  // A 2D scroll (filigree) curve in the (u, v) plane: a growing spiral, used for gold scrollwork.
  function scroll(u0, v0, size, turns, dir, steps) {
    const pts = [];
    const n = steps || 28;
    for (let i = 0; i <= n; i++) {
      const t = i / n, a = dir * t * turns * TAU, r = size * (1 - t * 0.85);
      pts.push([u0 + Math.cos(a) * r, v0 + Math.sin(a) * r]);
    }
    return pts;
  }
  // Wrap 2D (theta, y) points onto a revolved surface radius function rAt(y), lifted by lift.
  function wrap(points, rAt, lift) {
    return points.map(([th, y]) => { const r = rAt(y) + (lift || 0); return [Math.sin(th) * r, y, Math.cos(th) * r]; });
  }

  // ------------------------------------------------------------------ canvas textures
  const texCache = new Map();
  // Phones get textures of at most 1024 px and less anisotropic filtering (setTextureBudget):
  // four 2048 px room textures alone are ~90 MB of GPU memory with their mipmaps.
  const TEXB = { max: 2048, aniso: 8 };
  function setTextureBudget(max, aniso) { TEXB.max = max; TEXB.aniso = aniso; }
  // The canvas itself if it fits the budget, otherwise a scaled-down copy for the GPU.
  function fitCanvas(c) {
    const k = TEXB.max / Math.max(c.width, c.height);
    if (k >= 1) return c;
    const d = document.createElement('canvas'); d.width = Math.max(1, Math.round(c.width * k)); d.height = Math.max(1, Math.round(c.height * k));
    const dc = d.getContext('2d'); dc.imageSmoothingQuality = 'high'; dc.drawImage(c, 0, 0, d.width, d.height);
    return d;
  }
  const texAniso = () => TEXB.aniso;
  function canvasTex(key, w, h, draw, o) {
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas'); c.width = w; c.height = h || w;
    const ctx = c.getContext('2d');
    draw(ctx, c.width, c.height);
    const t = new THREE.CanvasTexture(fitCanvas(c));
    t.colorSpace = o && o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = TEXB.aniso;
    if (o && o.repeat) t.repeat.set(o.repeat[0], o.repeat[1]);
    texCache.set(key, t);
    return t;
  }
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const lerpC = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
  // Per-pixel painter: fn(u, v) -> [r, g, b] in 0..255 (u, v in 0..1).
  function paint(ctx, w, h, fn) {
    const img = ctx.createImageData(w, h), d = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = fn(x / w, y / h), k = (y * w + x) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = c.length > 3 ? c[3] : 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  const TEX = {
    // Marble: base colour with turbulent veins. Tileable.
    marble(base, vein, o) {
      o = o || {};
      const key = 'marble' + base + vein + JSON.stringify(o);
      return canvasTex(key, o.size || 512, o.size || 512, (ctx, w, h) => {
        const B = hex(base), V = hex(vein), V2 = hex(o.vein2 || vein);
        const sc = o.scale || 3, P = 8;
        paint(ctx, w, h, (u, v) => {
          const n = fbm(u * sc, v * sc, 5, sc);
          const t = Math.abs(Math.sin((u * (o.dirX || 1) + v * (o.dirY || 1.6) + n * (o.turb || 2.2)) * Math.PI * (o.freq || 2)));
          const vein1 = Math.pow(1 - t, o.sharp || 9);
          const n2 = fbm(u * sc * 2 + 7, v * sc * 2 + 3, 4, sc * 2);
          const t2 = Math.abs(Math.sin((u * 2.3 - v * 1.1 + n2 * 3) * Math.PI * 3));
          const vein2 = Math.pow(1 - t2, 18) * 0.5;
          const cloud = fbm(u * 4 + 11, v * 4, 3, 4) * (o.cloud === undefined ? 0.25 : o.cloud);
          let c = B.map((x) => x * (1 + cloud));
          c = lerpC(c, V, Math.min(1, vein1 * (o.strength || 0.85)));
          c = lerpC(c, V2, Math.min(1, vein2 * (o.strength2 || 0.6)));
          return c;
        });
        void P;
      });
    },
    // Malachite: concentric green bands swirled around several centres.
    malachite(o) {
      o = o || {};
      return canvasTex('malachite' + JSON.stringify(o), o.size || 512, o.size || 512, (ctx, w, h) => {
        const dark = hex(o.dark || '#0b3a26'), mid = hex(o.mid || '#13704a'), light = hex(o.light || '#4fbf8a');
        const centres = [[0.2, 0.3], [0.75, 0.2], [0.55, 0.75], [0.1, 0.85], [0.95, 0.6]];
        paint(ctx, w, h, (u, v) => {
          let best = 9, d2 = 9;
          for (const [cx, cy] of centres) {
            for (const ox of [-1, 0, 1]) for (const oy of [-1, 0, 1]) {
              const d = Math.hypot(u - cx - ox, (v - cy - oy) * 1.2);
              if (d < best) { d2 = best; best = d; } else if (d < d2) d2 = d;
            }
          }
          const warp = fbm(u * 3, v * 3, 4, 3) * 0.12;
          const b = (best + warp) * (o.bands || 26);
          const s = Math.sin(b * Math.PI);
          const t = Math.pow(Math.abs(s), 0.6);
          let c = s > 0 ? lerpC(mid, light, Math.pow(t, 1.6)) : lerpC(mid, dark, t);
          const edge = smooth(0.0, 0.03, d2 - best);
          c = lerpC(dark, c, 0.35 + 0.65 * edge);
          return c;
        });
      });
    },
    // Lapis lazuli: ultramarine with gold pyrite flecks and pale calcite clouds.
    lapis(o) {
      o = o || {};
      return canvasTex('lapis' + JSON.stringify(o), o.size || 512, o.size || 512, (ctx, w, h) => {
        const deep = hex('#14246e'), blue = hex('#2a48b8'), calc = hex('#8fa1cf');
        paint(ctx, w, h, (u, v) => {
          const n = fbm(u * 6, v * 6, 5, 6);
          let c = lerpC(deep, blue, clamp(0.5 + n * 1.6, 0, 1));
          const cl = fbm(u * 3 + 5, v * 3, 4, 3);
          c = lerpC(c, calc, smooth(0.12, 0.3, cl) * 0.45);
          return c;
        });
        const r = rng(91);
        for (let i = 0; i < 420; i++) {
          ctx.fillStyle = 'rgba(' + (220 + r() * 35) + ',' + (170 + r() * 40) + ',' + (70 + r() * 30) + ',' + (0.55 + r() * 0.45) + ')';
          const s = 0.6 + r() * 1.8;
          ctx.fillRect(r() * w, r() * h, s, s);
        }
      });
    },
    // Wood veneer: fine straight grain running along v. Each grain line darkens gradually
    // (earlywood to latewood) and resets sharply; lines wander a little, vary in strength,
    // and carry pores. A broad figure adds the tonal drift of a real leaf of veneer.
    wood(light, dark, o) {
      o = o || {};
      return canvasTex('wood' + light + dark + JSON.stringify(o), o.w || 512, o.h || 512, (ctx, w, h) => {
        const L = hex(light), D = hex(dark), seed = o.seed || 0;
        const lines = o.lines || 46, contrast = o.contrast === undefined ? 0.6 : o.contrast;
        const figure = o.figure === undefined ? 0.12 : o.figure, wander = o.warp === undefined ? 1.6 : o.warp;
        const curl = o.curl || 0, pores = o.pores === undefined ? 0.16 : o.pores;
        paint(ctx, w, h, (u, v) => {
          const s = u * lines + fbm(u * 1.4 + seed, v * 0.45 + seed * 0.3, 4) * wander * 2.2 + fbm(u * 5 + 3, v * 1.2 + seed, 3) * 0.6;
          const i = Math.floor(s), f = s - i;
          const late = smooth(0.5, 0.94, f) * (1 - smooth(0.94, 1, f));
          const strength = 0.35 + 0.65 * (0.5 + 0.5 * noise2(i * 0.41 + seed * 7, v * 0.8 + seed));
          const pore = noise2(u * w * 0.45, v * 14 + seed) > 0.42 ? pores : 0;
          const tone = fbm(u * 1.1 + seed * 2, v * 0.7 + 5, 3) * figure * 2.2 + (curl ? Math.sin((v * 9 + fbm(u * 2, v * 2 + seed, 3) * 2) * TAU) * curl : 0);
          let c = L.map((x) => clamp(x * (1 + tone), 0, 255));
          c = lerpC(c, D, clamp(late * strength * contrast + pore, 0, 1));
          return c;
        });
      });
    },
    // Gentle cloud/speckle stone (sandstone, basalt, porphyry, alabaster).
    stone(base, speck, o) {
      o = o || {};
      return canvasTex('stone' + base + speck + JSON.stringify(o), o.size || 512, o.size || 512, (ctx, w, h) => {
        const B = hex(base), S = hex(speck);
        paint(ctx, w, h, (u, v) => {
          const n = fbm(u * (o.scale || 5), v * (o.scale || 5), 5, o.scale || 5);
          let c = B.map((x) => clamp(x * (1 + n * (o.cloud || 0.5)), 0, 255));
          const s = noise2(u * (o.speckScale || 140), v * (o.speckScale || 140), o.speckScale || 140);
          if (s > (o.speckCut || 0.22)) c = lerpC(c, S, o.speckMix || 0.7);
          return c;
        });
      });
    },
    // A tangent-space normal map from a height function h(u, v) in 0..1 (tileable if h is).
    normal(key, w, h, height, strength) {
      return canvasTex('nrm' + key, w, h, (ctx, W, H) => {
        const hs = new Float32Array(W * H);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hs[y * W + x] = height(x / W, y / H);
        const img = ctx.createImageData(W, H), d = img.data, s = strength || 2;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const l = hs[y * W + ((x - 1 + W) % W)], r = hs[y * W + ((x + 1) % W)], u = hs[((y - 1 + H) % H) * W + x], b = hs[((y + 1) % H) * W + x];
          let nx = (l - r) * s, ny = (b - u) * s, nz = 1;
          const n = Math.hypot(nx, ny, nz); nx /= n; ny /= n; nz /= n;
          const k = (y * W + x) * 4;
          d[k] = (nx * 0.5 + 0.5) * 255; d[k + 1] = (ny * 0.5 + 0.5) * 255; d[k + 2] = (nz * 0.5 + 0.5) * 255; d[k + 3] = 255;
        }
        ctx.putImageData(img, 0, 0);
      }, { linear: true });
    },
    // A flat colour with faint mottling (lacquer, glaze, chocolate).
    mottle(base, o) {
      o = o || {};
      return canvasTex('mottle' + base + JSON.stringify(o), 256, 256, (ctx, w, h) => {
        const B = hex(base);
        paint(ctx, w, h, (u, v) => { const n = fbm(u * 4, v * 4, 4, 4) * (o.amount || 0.12); return B.map((x) => clamp(x * (1 + n), 0, 255)); });
      });
    },
  };

  // ------------------------------------------------------------------ materials
  const matCache = new Map();
  function material(key, make) {
    if (matCache.has(key)) return matCache.get(key);
    const m = make();
    matCache.set(key, m);
    return m;
  }
  const MAT = {
    gold: (tone) => material('gold' + (tone || ''), () => new THREE.MeshPhysicalMaterial({ color: tone || '#e8b75a', metalness: 1, roughness: 0.24, clearcoat: 0.4, clearcoatRoughness: 0.18, envMapIntensity: 1.25 })),
    goldLeaf: () => material('goldLeaf', () => new THREE.MeshPhysicalMaterial({ color: '#f0c46a', metalness: 1, roughness: 0.32, envMapIntensity: 1.3 })),
    silver: () => material('silver', () => new THREE.MeshPhysicalMaterial({ color: '#e4e7ec', metalness: 1, roughness: 0.16, envMapIntensity: 1.2 })),
    chrome: () => material('chrome', () => new THREE.MeshPhysicalMaterial({ color: '#f2f4f7', metalness: 1, roughness: 0.06, envMapIntensity: 1.3 })),
    brass: () => material('brass', () => new THREE.MeshPhysicalMaterial({ color: '#d6a748', metalness: 1, roughness: 0.28, envMapIntensity: 1.2 })),
    bronze: () => material('bronze', () => new THREE.MeshPhysicalMaterial({ color: '#a8703c', metalness: 1, roughness: 0.38, envMapIntensity: 1.1 })),
    lacquer: (color, o) => material('lacquer' + color + JSON.stringify(o || {}), () => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1 }, o || {}))),
    stone: (map, o) => material('stone' + map.uuid + JSON.stringify(o || {}), () => new THREE.MeshPhysicalMaterial(Object.assign({ map, roughness: 0.28, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12 }, o || {}))),
    glass: (tint, o) => material('glass' + tint + JSON.stringify(o || {}), () => new THREE.MeshPhysicalMaterial(Object.assign({ color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 1, ior: 1.5, thickness: 0.35, attenuationColor: tint, attenuationDistance: 0.6, envMapIntensity: 1.4, specularIntensity: 1 }, o || {}))),
    gem: (color) => material('gem' + color, () => new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, sheen: 0, envMapIntensity: 2.2, emissive: color, emissiveIntensity: 0.08 })),
    felt: (color) => material('felt' + color, () => new THREE.MeshStandardMaterial({ color: color || '#1d3b2a', roughness: 1, metalness: 0 })),
    matte: (color, o) => material('matte' + color + JSON.stringify(o || {}), () => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85, metalness: 0 }, o || {}))),
    velvet: (color) => material('velvet' + color, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.35) })),
    emissive: (color, i) => material('emi' + color + i, () => new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(i || 1), toneMapped: false })),
  };

  // Merge helper for mixed parts: keeps position, normal and uv, and indexes non-indexed
  // parts (extrusions, flat-faceted gems) so one of them never de-indexes a whole piece.
  function merge(list) {
    const keys = ['position', 'normal', 'uv'];
    const ready = list.filter(Boolean).map((g) => {
      Object.keys(g.attributes).forEach((k) => { if (!keys.includes(k)) g.deleteAttribute(k); });
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      return g.index ? g : THREE.mergeVertices(g, 1e-5);
    });
    return THREE.mergeGeometries(ready);
  }

  // Rooms are built from hundreds of small meshes (mouldings, books, candles, frames), and
  // every one is a draw call. Once a room is built, meshes that never move and look the same
  // (same material, shadow flags, layers and draw order) are merged into one mesh each, in
  // the group's own space. `keep` lists objects that animate or toggle; they and everything
  // under them stay as they are, as do transparent and multi-material meshes.
  function batchStatic(group, keep) {
    const skip = new Set();
    (keep || []).forEach((o) => o && o.traverse((c) => skip.add(c)));
    group.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const bins = new Map();
    group.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || skip.has(m) || !m.visible || Array.isArray(m.material) || m.material.transparent) return;
      for (let p = m.parent; p && p !== group; p = p.parent) if (!p.visible) return;
      const g = m.geometry;
      if (!g || !g.attributes.position || Object.keys(g.morphAttributes).length) return;
      const key = [m.material.uuid, Object.keys(g.attributes).sort().join(), g.index ? 1 : 0, m.castShadow, m.receiveShadow, m.layers.mask, m.renderOrder].join('|');
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(m);
    });
    const mat = new THREE.Matrix4();
    let merged = 0;
    for (const list of bins.values()) {
      if (list.length < 2) continue;
      const geos = list.map((m) => {
        mat.multiplyMatrices(inv, m.matrixWorld);
        const g = m.geometry.clone();
        g.clearGroups();
        g.applyMatrix4(mat);
        // a mirrored part keeps facing out: three flips the winding for it at draw time
        if (mat.determinant() < 0 && g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; } }
        else if (mat.determinant() < 0) return null;
        return g;
      });
      if (geos.some((g) => !g)) continue;
      const one = THREE.mergeGeometries(geos);
      if (!one) continue;
      const first = list[0], mesh = new THREE.Mesh(one, first.material);
      mesh.castShadow = first.castShadow; mesh.receiveShadow = first.receiveShadow;
      mesh.layers.mask = first.layers.mask; mesh.renderOrder = first.renderOrder;
      list.forEach((m) => m.parent.remove(m));
      group.add(mesh);
      merged += list.length - 1;
    }
    return merged;
  }

  return { DETAIL, batchStatic, setTextureBudget, fitCanvas, texAniso, TAU, clamp, mix, smooth, rng, noise2, fbm, profile, Profile, MOD, mods, revolve, frame, alongProfile, SD, strand, strandsDist, strandField, field2, blendMap, spline, sdfGeometry,
    beadRing, ring, extrude, closedCurve, mirrorOutline, tube, scroll, wrap, canvasTex, paint, hex, lerpC, TEX, MAT, material, merge };
}
if (typeof module !== 'undefined') module.exports = ChacklateKit;
