// Chacklate piece sets. Every set is modelled here in code: lathe profiles with flutes,
// swirls and lobes, cast ornaments (crosses, leaves, pearls), and sculpted horse heads
// with flowing manes. Sets keep the Staunton cues so a piece is never mistaken: the king
// is tallest and wears a cross, the queen a pointed coronet, the bishop a slit mitre,
// the knight a horse head, the rook battlements, the pawn a round head.
function ChacklatePieces(THREE, K) {
  'use strict';
  const { TAU, clamp, mix, smooth, profile, revolve, MOD, mods, SD, spline, strand, strandField, sdfGeometry, beadRing, ring, extrude, merge, MAT, TEX, alongProfile, rng } = K;
  const Q = { segs: 96, cell: 0.0052, mane: 0.0042 };

  // ------------------------------------------------------------------ assembly
  // A piece under construction: geometry lists per material slot (body, trim, accent, alt).
  function Piece() { this.parts = {}; }
  Piece.prototype.add = function (slot, g) { if (g) (this.parts[slot] = this.parts[slot] || []).push(g); return this; };
  Piece.prototype.lathe = function (slot, prof, o) { return this.add(slot, revolve(prof, Object.assign({ segs: Q.segs }, o || {}))); };
  Piece.prototype.geoms = function () {
    const out = {};
    for (const slot of Object.keys(this.parts)) {
      const g = merge(this.parts[slot]);
      g.computeBoundingSphere(); g.computeBoundingBox();
      out[slot] = g;
    }
    return out;
  };

  // Lean a part (built around the origin, facing +z) outward by tilt, then stand it at
  // angle th on radius r and height y.
  function placeAt(g, th, r, y, o) {
    o = o || {};
    if (o.scale) g.scale(o.scale, o.scale, o.scale);
    if (o.tilt) g.rotateX(o.tilt);
    if (o.spin) g.rotateZ(o.spin);
    g.rotateY(th);
    g.translate(Math.sin(th) * r, y, Math.cos(th) * r);
    return g;
  }
  // Curl a flat part: points move along +z by k * y^2 (leaves curling outward).
  function curl(g, k, k2) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), x = p.getX(i); p.setZ(i, p.getZ(i) + k * y * y + (k2 || 0) * x * x); }
    p.needsUpdate = true; g.computeVertexNormals();
    return g;
  }
  const sphere = (r, x, y, z, seg) => { const g = new THREE.SphereGeometry(r, seg || 16, Math.max(8, (seg || 16) * 0.66 | 0)); g.translate(x || 0, y || 0, z || 0); return g; };

  // Sample frames along a lathe profile at angle th and turn them into pearls.
  function pearlsAlong(prof, o, th, count, v0, v1, size, lift) {
    return alongProfile(prof, th, count, v0, v1, o).map((f, i) => {
      const s = typeof size === 'function' ? size(i, count) : size;
      const off = s * (lift === undefined ? 0.55 : lift);
      return sphere(s, f[0] + f[3] * off, f[1] + f[4] * off, f[2] + f[5] * off, 10);
    });
  }

  // ------------------------------------------------------------------ cast ornaments
  // Outlines are drawn in a unit box and scaled; extrusions are centred on z = 0.
  function outline(half, sx, sy) { return K.mirrorOutline(half.map(([x, y]) => [x * sx, y * sy])); }
  // Cross pattee with rounded ends; h is the full height.
  function crossPattee(h, depth, o) {
    o = o || {};
    const a = h / 2, w0 = a * 0.26, w1 = a * (o.flare || 0.52), up = a * 1.0, dn = a * (o.foot || 1.2);
    const pts = [[0, up - a * 0.06], [w1 * 0.55, up + a * 0.01], [w1, up], [w0, w0], [up, w1], [up + a * 0.01, w1 * 0.55], [up - a * 0.06, 0],
      [up + a * 0.01, -w1 * 0.55], [up, -w1], [w0, -w0], [w1 * 0.9, -dn], [w1 * 0.5, -dn - a * 0.02], [0, -dn + a * 0.05]];
    const g = extrude(K.mirrorOutline(pts), depth, depth * 0.32, { bevelSegments: 3 });
    g.translate(0, (dn - up) / 2 * 0, 0);
    return g;
  }
  // Fleur-de-lis (heraldic lily); h is the full height.
  function fleur(h, depth) {
    const half = [[0, 1], [0.1, 0.86], [0.13, 0.66], [0.1, 0.5], [0.2, 0.52], [0.36, 0.62], [0.5, 0.7], [0.56, 0.6], [0.5, 0.44],
      [0.36, 0.34], [0.22, 0.32], [0.3, 0.26], [0.3, 0.2], [0.16, 0.2], [0.12, 0.08], [0.2, 0.0], [0, 0.04]];
    const g = extrude(outline(half, h * 0.62, h), depth, depth * 0.35, { bevelSegments: 3 });
    g.translate(0, -h / 2, 0);
    return g;
  }
  // Acanthus leaf, tip up, lobed edges; w and h are the full size.
  function leaf(w, h, depth) {
    const half = [[0, 1], [0.16, 0.86], [0.1, 0.78], [0.3, 0.66], [0.2, 0.57], [0.42, 0.44], [0.3, 0.36], [0.46, 0.22], [0.3, 0.1], [0.16, 0], [0, 0.05]];
    const g = extrude(outline(half, w / 0.92, h), depth, depth * 0.45, { bevelSegments: 2, curveSegments: 8 });
    return g;
  }
  // Pointed lotus or palmette petal.
  function petal(w, h, depth) {
    const half = [[0, 1], [0.24, 0.78], [0.42, 0.5], [0.44, 0.25], [0.3, 0.06], [0, 0]];
    return extrude(outline(half, w / 0.88, h), depth, depth * 0.45, { bevelSegments: 2, curveSegments: 10 });
  }
  // Ankh: a loop over a T; h is the full height.
  function ankh(h, depth) {
    const s = h;
    const shape = new THREE.Shape();
    const loopW = 0.2 * s, loopH = 0.3 * s, barY = 0.5 * s, barW = 0.3 * s, barT = 0.08 * s, stemW = 0.07 * s;
    shape.moveTo(-stemW, 0); shape.lineTo(stemW, 0); shape.lineTo(stemW * 0.8, barY - barT);
    shape.lineTo(barW, barY - barT * 1.4); shape.lineTo(barW, barY + barT * 1.4); shape.lineTo(stemW * 0.9, barY + barT);
    shape.bezierCurveTo(loopW * 1.5, barY + loopH * 0.5, loopW, barY + loopH * 1.6, 0, barY + loopH * 1.6);
    shape.bezierCurveTo(-loopW, barY + loopH * 1.6, -loopW * 1.5, barY + loopH * 0.5, -stemW * 0.9, barY + barT);
    shape.lineTo(-barW, barY + barT * 1.4); shape.lineTo(-barW, barY - barT * 1.4); shape.lineTo(-stemW * 0.8, barY - barT); shape.lineTo(-stemW, 0);
    const hole = new THREE.Path();
    hole.moveTo(0, barY + barT * 1.6);
    hole.bezierCurveTo(loopW * 0.75, barY + loopH * 0.55, loopW * 0.45, barY + loopH * 1.25, 0, barY + loopH * 1.25);
    hole.bezierCurveTo(-loopW * 0.45, barY + loopH * 1.25, -loopW * 0.75, barY + loopH * 0.55, 0, barY + barT * 1.6);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: depth * 0.3, bevelSize: depth * 0.25, bevelSegments: 3, curveSegments: 20 });
    g.translate(0, -h * 0.5, -depth / 2); g.computeVertexNormals();
    return g;
  }

  // Revolve a closed cross-section over part of a turn and close the cut ends:
  // battlements, gateways and other solids that do not go all the way round.
  function revolvePart(pts, phi0, phiLen, segs, lift) {
    const prof = profile(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) prof.line(pts[i][0], pts[i][1]);
    prof.line(pts[0][0], pts[0][1]);
    const side = revolve(prof, { segs: Math.max(3, Math.round(segs)), phi0, phiLen, creaseDeg: 30, lift });
    const caps = [phi0, phi0 + phiLen].map((th, e) => {
      const shape = new THREE.Shape(pts.map(([r, y]) => new THREE.Vector2(r, y)));
      const g = new THREE.ShapeGeometry(shape);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const r = p.getX(i), y = p.getY(i); p.setXYZ(i, r * Math.sin(th), y + (lift ? lift(th, y) : 0), r * Math.cos(th)); }
      g.computeVertexNormals();
      // outward = -tangent at the start cut, +tangent at the end cut
      const n = g.attributes.normal, want = e ? 1 : -1, tx = Math.cos(th), tz = -Math.sin(th);
      if ((n.getX(0) * tx + n.getZ(0) * tz) * want < 0) {
        const idx = g.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; }
        for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
      }
      return g;
    });
    return merge([side].concat(caps));
  }

  // ------------------------------------------------------------------ the horse
  // The bust is "inflated" from a side silhouette: inside the outline the half-thickness
  // follows a width map and rounds off over an edge band, so thin parts (lips, muzzle)
  // stay thin instead of vanishing. Eyes, cheeks, nostrils, mouth and ears are sculpted
  // on top, and the mane is a mass of tapered locks cast in a second material.
  // Silhouette in (z, y) for a bust whose pedestal top is at y = 0.30; the head faces +z.
  const HORSE_SIL = [
    [0.152, 0.25], [0.164, 0.33], [0.168, 0.4], [0.158, 0.47], [0.132, 0.535], [0.1, 0.6], [0.08, 0.66], [0.076, 0.712], [0.088, 0.752],
    [0.118, 0.742], [0.165, 0.716], [0.214, 0.69], [0.252, 0.672], [0.284, 0.668], [0.306, 0.68], [0.318, 0.703], [0.316, 0.731],
    [0.298, 0.76], [0.255, 0.807], [0.196, 0.864], [0.14, 0.917], [0.088, 0.957], [0.034, 0.982], [-0.018, 0.985],
    [-0.062, 0.962], [-0.098, 0.91], [-0.124, 0.83], [-0.142, 0.73], [-0.152, 0.62], [-0.154, 0.5], [-0.15, 0.39], [-0.145, 0.25]];
  // Half-thickness anchors [z, y, half width].
  const HORSE_W = [
    [0.0, 0.28, 0.112], [0.0, 0.42, 0.102], [0.13, 0.42, 0.095], [-0.07, 0.56, 0.086], [0.06, 0.56, 0.078], [0.08, 0.66, 0.056], [0.0, 0.68, 0.066],
    [-0.13, 0.7, 0.056], [-0.09, 0.72, 0.062],
    [-0.06, 0.86, 0.06], [0.06, 0.8, 0.074], [0.03, 0.92, 0.07], [0.12, 0.89, 0.066], [0.19, 0.83, 0.05], [0.25, 0.77, 0.044],
    [0.29, 0.715, 0.05], [0.26, 0.678, 0.036], [0.17, 0.725, 0.052]];
  function bake2(fn, box, res) {
    const [u0, v0, u1, v1] = box, nu = Math.ceil((u1 - u0) / res) + 1, nv = Math.ceil((v1 - v0) / res) + 1;
    const grid = new Float32Array(nu * nv);
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) grid[i + nu * j] = fn(u0 + i * res, v0 + j * res);
    return (u, v) => {
      const fu = clamp((u - u0) / res, 0, nu - 1.001), fv = clamp((v - v0) / res, 0, nv - 1.001);
      const i = fu | 0, j = fv | 0, tu = fu - i, tv = fv - j, k = i + nu * j;
      const a = grid[k] + (grid[k + 1] - grid[k]) * tu, b = grid[k + nu] + (grid[k + nu + 1] - grid[k + nu]) * tu;
      return a + (b - a) * tv;
    };
  }
  //   o.mane: 'flow' (loose gold locks), 'carved' (locks in the body), 'roach' (short upright), 'none'
  //   o.base: pedestal top; o.round: edge band of the inflation (bigger is softer)
  function sculptHorse(o) {
    o = Object.assign({ base: 0.3, mane: 'flow', seed: 3, round: 0.088 }, o || {});
    const dy = o.base - 0.3, Y = (y) => y + dy;
    const box = [-0.24, Y(0.22), 0.38, Y(1.02)];
    const sil = K.closedCurve((o.sil || HORSE_SIL).map(([z, y]) => [z, Y(y)]), 6);
    const d2 = K.field2(sil, box, 0.0025);
    const hwF = bake2(K.blendMap((o.widths || HORSE_W).map(([z, y, w]) => [z, Y(y), w]), 0.07), box, 0.005);
    const R = o.round;
    const eyeZ = 0.128, eyeY = Y(0.884), eyeX = hwF(eyeZ, eyeY) - 0.003;
    const ears = [-1, 1].map((s) => strand(spline([[s * 0.026, Y(0.962), -0.01, 0.022], [s * 0.034, Y(1.01), 0.0, 0.017], [s * 0.042, Y(1.065), 0.022, 0.003]], 4)));
    // Cross-sections are quarter ellipses (R deep in the outline plane, hw across) joined to
    // flat sides; the distance uses the usual ellipse estimate, which stays well conditioned.
    const pillow = (ax, y, z) => {
      const a = d2(z, y), hw = hwF(z, y), du = Math.max(R + a, 0);
      const px = du / R, py = ax / hw, k0 = Math.sqrt(px * px + py * py);
      const qx = px / R, qy = py / hw, k1 = Math.sqrt(qx * qx + qy * qy);
      return k1 < 1e-9 ? -Math.min(R, hw) : (k0 * (k0 - 1)) / k1;
    };
    const body = (x, y, z) => {
      if (y < Y(0.2)) return Y(0.2) - y;
      const ax = Math.abs(x);
      let d = pillow(ax, y, z);
      if (y > Y(0.64) && z > -0.08) {
        if (SD.far(ax, y, z, 0.04, Y(0.8), 0.08, 0.08) < d + 0.03) d = SD.smin(d, SD.ellipsoid(ax, y, z, 0.034, Y(0.796), 0.078, 0.042, 0.058, 0.064), 0.03);   // jowls
        if (SD.far(ax, y, z, eyeX, eyeY, eyeZ, 0.05) < d + 0.02) {
          d = SD.smin(d, SD.ellipsoid(ax, y, z, eyeX - 0.004, eyeY + 0.014, eyeZ + 0.004, 0.018, 0.009, 0.024), 0.012);                                      // brow
          d = SD.smax(d, -SD.ellipsoid(ax, y, z, eyeX + 0.004, eyeY - 0.002, eyeZ, 0.012, 0.019, 0.026), 0.01);                                                // socket
          d = SD.smin(d, SD.sphere(ax, y, z, eyeX - 0.008, eyeY - 0.002, eyeZ, 0.017), 0.004);                                                                // eye
        }
        if (z > 0.2) {
          if (SD.far(ax, y, z, 0.032, Y(0.735), 0.3, 0.035) < d + 0.01) {
            d = SD.smin(d, SD.ellipsoid(ax, y, z, 0.03, Y(0.742), 0.29, 0.02, 0.024, 0.026), 0.012);                                                         // nostril flare
            d = SD.smax(d, -SD.ellipsoid(ax, y, z, 0.034, Y(0.732), 0.306, 0.009, 0.015, 0.012), 0.006);                                                     // nostril
          }
          d = SD.smax(d, -SD.capsule(ax, y, z, 0.044, Y(0.686), 0.232, 0.03, Y(0.686), 0.302, 0.0032), 0.004);                                               // mouth
        }
        if (y > Y(0.93)) {
          for (const e of ears) d = SD.smin(d, K.strandsDist(x * 1.0, y, z * 1.25, e, 0.01), 0.014);
          d = SD.smax(d, -SD.ellipsoid(ax, y, z, 0.036, Y(1.02), 0.022, 0.008, 0.032, 0.011), 0.005);                                                        // ear cups
        }
      }
      return d;
    };
    const bounds = [-0.15, Y(0.22), -0.18, 0.15, Y(1.08), 0.34];
    // A point on the sculpted surface: march from c along d until outside, then bisect.
    // Used to fit bridles and plumes to the head.
    const surf = (c, d, off) => {
      const l = Math.hypot(d[0], d[1], d[2]), u = [d[0] / l, d[1] / l, d[2] / l];
      let lo = 0, hi = 0.004;
      while (hi < 0.4 && body(c[0] + u[0] * hi, c[1] + u[1] * hi, c[2] + u[2] * hi) < 0) { lo = hi; hi += 0.006; }
      for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; if (body(c[0] + u[0] * m, c[1] + u[1] * m, c[2] + u[2] * m) < 0) lo = m; else hi = m; }
      const t = hi + (off || 0);
      return [c[0] + u[0] * t, c[1] + u[1] * t, c[2] + u[2] * t];
    };
    const out = { body: null, mane: null, surf, Y };
    // mane: locks rooted along the crest, sweeping back with a wave and curling at the tips
    const crest = (t) => {   // t: 0 at the poll .. 1 at the withers, a point just inside the crest
      const pts = [[-0.012, 0.968], [-0.06, 0.94], [-0.095, 0.88], [-0.118, 0.8], [-0.134, 0.71], [-0.142, 0.6], [-0.144, 0.5], [-0.14, 0.42]];
      const f = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)), u = f - i;
      return [mix(pts[i][0], pts[i + 1][0], u) + 0.018, Y(mix(pts[i][1], pts[i + 1][1], u))];
    };
    const Rn = rng(o.seed);
    const locks = [];
    if (o.mane !== 'none') {
      const flow = o.mane === 'flow', n = flow ? 13 : 12;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), [cz, cy] = crest(t), [nz, ny] = crest(Math.min(1, t + 0.08));
        let tz = nz - cz, ty = ny - cy; const tl = Math.hypot(tz, ty) || 1; tz /= tl; ty /= tl;   // down the crest
        const layers = flow ? [[-1, 1], [1, 1], [0, 0.45]] : [[-1, 1], [1, 1]];
        for (const [side, scale] of layers) {
          const jitter = 0.85 + Rn() * 0.3;
          const len = (flow ? mix(0.25, 0.15, t) * jitter : o.mane === 'roach' ? 0.045 : 0.06) * scale;
          const fl = flow ? 0.45 : 0.8;
          const dir = [side * (flow ? 0.26 : 0.18) + (Rn() - 0.5) * 0.1, ty * fl + (flow ? 0.16 - 0.2 * t : -0.2), tz * fl - 0.9];
          const dl = Math.hypot(dir[0], dir[1], dir[2]), d = dir.map((v) => v / dl);
          const r0 = (flow ? 0.026 : 0.016) * (side ? 0.9 : 1.1);
          const p0 = [side * 0.018, cy + (side ? -0.006 : 0.006), cz];
          const amp = (flow ? 0.022 : 0.005) * (0.7 + Rn() * 0.6) * (side < 0 ? -1 : 1), ph = Rn() * 0.5;
          const P = (f, up, sw) => [p0[0] + d[0] * len * f + side * sw, p0[1] + d[1] * len * f + up, p0[2] + d[2] * len * f];
          const ctrl = o.mane === 'roach'
            ? [[...p0, r0], [...P(0.5, 0.03, 0), r0 * 0.7], [...P(0.95, 0.05, 0), 0.003]]
            : [[...p0, r0], [...P(0.22, amp * (0.6 + ph), 0.004), r0 * 0.94], [...P(0.5, -amp * 0.8, 0.012), r0 * 0.76], [...P(0.76, amp * 0.5, 0.022), r0 * 0.5],
              [...P(0.93, 0.02, 0.03), r0 * 0.26], [...P(1.0, 0.05, 0.036), 0.002]];
          locks.push(strand(spline(ctrl, 3)));
        }
      }
      if (flow) {
        for (const side of [-1, 1]) {
          locks.push(strand(spline([[side * 0.008, Y(0.975), -0.006, 0.016], [side * 0.014, Y(0.985), 0.03, 0.013], [side * 0.022, Y(0.962), 0.066, 0.009], [side * 0.03, Y(0.93), 0.086, 0.004], [side * 0.026, Y(0.915), 0.084, 0.002]], 3)));
        }
      }
    }
    if (o.mane === 'carved' || o.mane === 'roach') {
      const fieldM = strandField([].concat(...locks), 0.01, 0.03, 0.016);
      out.body = sdfGeometry((x, y, z) => SD.smin(body(x, y, z), fieldM(x, y, z), 0.008), bounds, Q.cell);
    } else {
      out.body = sdfGeometry(body, bounds, Q.cell);
      if (locks.length) {
        const fieldM = strandField([].concat(...locks), 0.02, 0.03, 0.016);
        out.mane = sdfGeometry(fieldM, [-0.16, Y(0.36), -0.36, 0.16, Y(1.02), 0.11], Q.mane, { band: 1.3 });
      }
    }
    return out;
  }

  // The horse is the slowest part to build, and sets share a few variants: cache by options.
  const horseCache = new Map();
  function horse(o) {
    const key = JSON.stringify(o || {}) + Q.cell + Q.mane;
    if (!horseCache.has(key)) horseCache.set(key, sculptHorse(o));
    return horseCache.get(key);
  }

  // ------------------------------------------------------------------ era ornaments
  // n copies of a part (built at the origin facing +z) stood round radius r at height y.
  function around(n, r, y, make, o) {
    o = o || {};
    const parts = [];
    for (let i = 0; i < n; i++) parts.push(placeAt(make(i), (i / n) * TAU + (o.phase || 0), r, y, o));
    return merge(parts);
  }
  // A cabochon (a low dome facing +z) and a faceted brilliant (table facing +z).
  function cabochon(size, squash) {
    const g = new THREE.SphereGeometry(size, 16, 8, 0, TAU, 0, Math.PI / 2);
    g.scale(1, squash || 0.55, 1); g.rotateX(Math.PI / 2);
    return g;
  }
  function brilliant(size) {
    const pts = [[0, -0.8], [1, 0.1], [1, 0.22], [0.58, 0.55], [0, 0.55]].map(([r, y]) => new THREE.Vector2(r * size, y * size));
    let g = new THREE.LatheGeometry(pts, 8);
    g.rotateX(Math.PI / 2);
    g = g.toNonIndexed(); g.computeVertexNormals();
    return g;
  }
  // Studs set round a ring: gems (cabochons) or pearls.
  const studs = (n, r, y, size, o) => around(n, r, y, () => cabochon(size, 0.6), o);
  // Laurel or olive wreath: two rows of small leaves running round a ring.
  function wreath(r, y, n, size, o) {
    o = o || {};
    const parts = [];
    for (let i = 0; i < n; i++) {
      for (const s of [-1, 1]) {
        const g = petal(size * 0.4, size, size * 0.13);
        g.rotateZ(-Math.PI / 2 + s * 0.5);
        g.translate(0, s * size * 0.16, 0);
        parts.push(placeAt(g, ((i + (s > 0 ? 0.5 : 0)) / n) * TAU, r, y, { tilt: o.tilt || 0 }));
      }
    }
    if (o.band !== false) parts.push(ring(r - size * 0.05, y, size * 0.09));
    return merge(parts);
  }
  // Greek key: a running meander in raised strips round radius r, from y up to y + h.
  function keyBand(r, y, h, n, t, d) {
    const unit = [[0, 0, 1, 0], [0, 0, 0, 0.84], [0, 0.84, 0.74, 0.84], [0.74, 0.84, 0.74, 0.3], [0.74, 0.3, 0.37, 0.3], [0.37, 0.3, 0.37, 0.58]];
    const cell = (TAU * r) / n, parts = [];
    for (let i = 0; i < n; i++) {
      for (const [s0, v0, s1, v1] of unit) {
        const flat = Math.abs(v1 - v0) < 1e-6;
        const len = flat ? Math.abs(s1 - s0) * cell + t : Math.abs(v1 - v0) * (h - t) + t;
        const g = new THREE.BoxGeometry(flat ? len : t, flat ? t : len, d);
        placeAt(g, ((i + (s0 + s1) / 2) / n) * TAU, r + d * 0.3, y + t / 2 + ((v0 + v1) / 2) * (h - t));
        parts.push(g);
      }
    }
    parts.push(ring(r + d * 0.3, y + h + t * 0.4, t * 0.55), ring(r + d * 0.3, y - t * 0.4, t * 0.55));
    return merge(parts);
  }
  // Battlements: n merlons between radii r0 and r1 from y0 to y1. top: 'flat' | 'round'
  // (arched heads) | 'point' (lotus-bud heads) | 'swallow' (Kremlin swallowtails) | 'step' (ziggurat).
  function battlements(n, r0, r1, y0, y1, gap, top, head) {
    const parts = [], w = (TAU / n) * (1 - gap), hh = head || (y1 - y0) * 0.35;
    const pts = [[r1, y0], [r1, y1 - 0.006], [r1 - 0.006, y1], [r0 + 0.006, y1], [r0, y1 - 0.006], [r0, y0]];
    const shape = (u) => {   // u: -1..1 across a merlon; returns how far the top drops
      const a = Math.abs(u);
      if (top === 'round') return hh * (1 - Math.sqrt(Math.max(0, 1 - a * a)));
      if (top === 'point') return hh * Math.pow(a, 1.3);
      if (top === 'swallow') return hh * Math.max(0, 1 - a / 0.92);
      if (top === 'step') return hh * (a > 0.66 ? 1 : a > 0.33 ? 0.5 : 0);
      return 0;
    };
    for (let i = 0; i < n; i++) {
      const th0 = (i * TAU) / n - w / 2;
      const lift = top && top !== 'flat' ? (th, y) => -shape(((th - th0) / w) * 2 - 1) * smooth(y0 + (y1 - y0) * 0.3, y1, y) : null;
      parts.push(revolvePart(pts, th0, w, top && top !== 'flat' ? 30 : (Q.segs / n) * (1 - gap), lift));
    }
    return merge(parts);
  }
  // Append a true sphere (radius rr, centre cy) to a profile that has reached radius rNeck.
  function ballHead(prof, rNeck, cy, rr) {
    const a0 = Math.asin(clamp(rNeck / rr, -1, 1)), sph = [];
    for (let i = 0; i <= 40; i++) { const a = mix(a0, Math.PI, i / 40); sph.push([Math.sin(a) * rr, cy - Math.cos(a) * rr]); }
    prof.line(sph[0][0], sph[0][1], true);
    prof._push(sph.slice(1), true);
    return prof;
  }
  // A volute scroll (Ionic capital) as a tube in the plane facing +z.
  function volute(size, dir) {
    const pts = K.scroll(0, 0, size, 1.7, dir, 40).map(([u, v]) => [u, v, 0]);
    return K.tube(pts, size * 0.17, { segs: 60, radial: 8 });
  }
  // A thin pointed ray (radiate crowns, sunbursts), pointing +y and facing +z.
  function ray(w, h, depth) {
    return extrude([[0, h], [w * 0.5, h * 0.12], [w * 0.36, 0], [-w * 0.36, 0], [-w * 0.5, h * 0.12]], depth, depth * 0.3, { bevelSegments: 2 });
  }
  // Bridle straps fitted to a sculpted horse, with rosettes where they cross.
  function bridle(h, o) {
    o = o || {};
    const Y = h.Y, t = o.thick || 0.0062, off = t * 0.75, parts = [], rosettes = [];
    const strap = (pts, closed) => parts.push(K.tube(pts, t, { segs: pts.length * 4, radial: 8, closed: !!closed }));
    // noseband: a loop round the muzzle
    const nose = [];
    for (let i = 0; i < 28; i++) { const a = (i / 28) * TAU; nose.push(h.surf([0, Y(0.752), 0.236], [Math.sin(a), Math.cos(a) * 1.05, -Math.cos(a) * 0.35], off)); }
    strap(nose, true);
    // crownpiece: over the poll behind the ears, down both cheeks to the throat
    const crown = [];
    for (let i = 0; i <= 24; i++) { const a = mix(-1.9, 1.9, i / 24); crown.push(h.surf([0, Y(0.88), 0.0], [Math.sin(a), Math.cos(a), 0.12 * Math.cos(a)], off)); }
    strap(crown);
    // cheek straps from the noseband up to the crownpiece
    for (const s of [-1, 1]) {
      const cheek = [];
      for (let i = 0; i <= 10; i++) { const k = i / 10; cheek.push(h.surf([0, Y(mix(0.76, 0.875, k)), mix(0.215, 0.012, k)], [s, 0.05, 0], off)); }
      strap(cheek);
      rosettes.push([h.surf([0, Y(0.915), 0.03], [s, 0.35, 0.25], off * 2), s]);
    }
    // browband across the forehead in front of the ears
    const brow = [];
    for (let i = 0; i <= 16; i++) { const a = mix(-1.25, 1.25, i / 16); brow.push(h.surf([0, Y(0.915), 0.0], [Math.sin(a), 0.5, Math.cos(a)], off)); }
    strap(brow);
    const studsG = rosettes.map(([p, s]) => { const g = cabochon(o.stud || 0.016, 0.5); g.rotateY(s * Math.PI / 2); g.translate(p[0], p[1], p[2]); return g; });
    const front = cabochon((o.stud || 0.016) * 1.15, 0.5);
    const fp = h.surf([0, Y(0.94), 0.0], [0, 0.4, 1], off * 2); front.rotateX(-0.45); front.translate(fp[0], fp[1], fp[2]);
    studsG.push(front);
    return { straps: merge(parts), studs: merge(studsG) };
  }
  // A plume of feathers rising from the poll and sweeping back (Egyptian chariot horses,
  // Mughal kalgi); returns feathers and their holder.
  function plume(h, o) {
    o = o || {};
    const Y = h.Y, base = h.surf([0, Y(0.95), -0.005], [0, 1, -0.15], 0.004), parts = [];
    const n = o.count || 5;
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) - 0.5 : 0, len = (o.len || 0.2) * (1 - Math.abs(k) * 0.3);
      const f = petal(o.w || 0.06, len, 0.008);
      curl(f, -(o.curl || 1.4), 0);
      f.rotateY(Math.PI / 2);
      f.rotateX(-(o.lean || 0.35) + k * (o.spread || 1.0));
      f.translate(base[0], base[1], base[2]);
      parts.push(f);
    }
    const holder = new THREE.CylinderGeometry(0.016, 0.022, 0.05, 16); holder.translate(base[0], base[1] + 0.012, base[2]);
    return { feathers: merge(parts), holder };
  }

  // ------------------------------------------------------------------ shared lathe sections
  // Swirled cushion: twisting shallow grooves across a torus (the Regency base and capitals).
  const swirl = (count, depth, y0, y1, twist) => MOD.flutes(count, depth, y0, y1, { twist: twist === undefined ? 9 : twist, soft: true, end: 0.014, sharp: 1.6 });

  // ------------------------------------------------------------------ Regency Gilt
  // White and black lacquer with gold leaf: fluted columns over swirled cushions.
  function regencyBase(p, R, top) {
    // plinth with a rounded rim, a swirled cushion, a cove and a small ring, into the column
    p.line(R - 0.012, 0).arc(R, 0.012, 0.28).line(R, 0.03).arc(R - 0.016, 0.044, 0.3)
      .curve([[R - 0.02, 0.07], [R - 0.03, 0.105], [R - 0.07, 0.132], [R - 0.11, 0.142]])
      .arc(R - 0.125, 0.16, -0.28)
      .curve([[R - 0.112, 0.172], [R - 0.114, 0.19], [R - 0.14, 0.2]])
      .arc(top, 0.226, -0.3);
    return p;
  }
  const REGENCY = {
    k(B) {
      const R = 0.355, P = new Piece();
      const p = regencyBase(profile(0, 0), R, 0.178);
      p.curve([[0.163, 0.3], [0.15, 0.42], [0.142, 0.55], [0.146, 0.66], [0.158, 0.74]])
        .curve([[0.19, 0.765], [0.196, 0.8], [0.182, 0.83]])                // capital swirl
        .line(0.2, 0.842).arc(0.212, 0.856, 0.3).arc(0.2, 0.87, 0.3)       // collar disc
        .line(0.112, 0.882)
        .curve([[0.104, 0.93], [0.122, 0.975], [0.142, 1.03], [0.13, 1.08], [0.098, 1.112]]) // swirled spool
        .line(0.094, 1.122)
        .curve([[0.13, 1.15], [0.175, 1.19], [0.188, 1.215]])               // cup
        .line(0.192, 1.218).line(0.192, 1.272)                               // crown band
        .line(0.17, 1.278).line(0.0, 1.278);
      const mod = mods([MOD.flutes(16, 0.075, 0.24, 0.745, { fillet: 0.12, end: 0.05 }), swirl(9, 0.06, 0.044, 0.15), swirl(9, 0.08, 0.758, 0.835, -10), swirl(10, 0.09, 0.93, 1.1, 8)]);
      P.lathe('body', p, { mod });
      // crown: a padded cap under eight arches that meet beneath an orb and cross
      const cap = profile(0.176, 1.272).curve([[0.19, 1.31], [0.18, 1.36], [0.14, 1.41], [0.08, 1.442], [0.03, 1.452]]).line(0.0, 1.454);
      P.lathe('body', cap, { mod: MOD.lobes(8, 0.12, 1.27, 1.46, { end: 0.02, shape: 0.8, phase: Math.PI / 2 }) });
      const arch = [[0.186, 1.27], [0.204, 1.31], [0.2, 1.36], [0.168, 1.41], [0.112, 1.452], [0.05, 1.476], [0.0, 1.482]];
      for (let i = 0; i < 8; i++) {
        const th = (i * TAU) / 8, sn = Math.sin(th), cs = Math.cos(th);
        P.add('body', K.tube(arch.map(([r, y]) => [sn * r, y, cs * r]), 0.0165, { segs: 40, radial: 10 }));
        for (const g of pearlsAlong(K.profile(arch[0][0] + 0.016, arch[0][1]).curve(arch.slice(1).map(([r, y]) => [r + 0.016, y])), {}, th, 5, 0.12, 0.8, (n) => 0.0105 - n * 0.0011, 0.2)) P.add('trim', g);
        P.add('trim', placeAt(curl(fleur(0.085, 0.009), 2.5), th, 0.207, 1.302, { tilt: 0.16 }));
      }
      P.add('trim', ring(0.193, 1.22, 0.008));
      P.add('trim', ring(0.193, 1.27, 0.008));
      P.add('trim', beadRing(0.197, 1.245, 28, 0.0085));
      P.add('trim', sphere(0.036, 0, 1.5, 0));
      P.add('trim', ring(0.03, 1.475, 0.007));
      P.add('trim', placeAt(crossPattee(0.11, 0.022), 0, 0, 1.582));
      P.add('trim', ring(0.212, 0.856, 0.0075));
      P.add('trim', ring(R - 0.002, 0.03, 0.007));
      return P;
    },
    q(B) {
      const R = 0.335, P = new Piece();
      const p = regencyBase(profile(0, 0), R, 0.168);
      p.curve([[0.152, 0.28], [0.138, 0.4], [0.13, 0.5], [0.134, 0.6], [0.146, 0.665]])
        .curve([[0.176, 0.69], [0.182, 0.72], [0.168, 0.748]])
        .line(0.186, 0.76).arc(0.198, 0.773, 0.3).arc(0.186, 0.786, 0.3)
        .line(0.102, 0.797)
        .curve([[0.095, 0.84], [0.112, 0.88], [0.128, 0.925], [0.116, 0.968], [0.088, 0.995]])
        .line(0.082, 1.0)
        .curve([[0.11, 1.05], [0.165, 1.13], [0.205, 1.2], [0.214, 1.226]])  // coronet flare
        .arc(0.196, 1.232, 0.5)                                              // lip
        .curve([[0.18, 1.19], [0.14, 1.14], [0.09, 1.11]])                   // inner wall
        .line(0, 1.105);
      const N = 6;
      const lift = (th, y) => {
        const u = ((th * N) / TAU) % 1, w = smooth(1.08, 1.235, y);
        return -0.085 * Math.pow(Math.abs(Math.cos(Math.PI * u)), 0.55) * w;
      };
      const mod = mods([MOD.flutes(14, 0.075, 0.23, 0.66, { fillet: 0.12, end: 0.05 }), swirl(9, 0.06, 0.044, 0.15), swirl(9, 0.08, 0.676, 0.75, -10), swirl(10, 0.09, 0.84, 0.99, 8)]);
      P.lathe('body', p, { mod, lift });
      // central knob and gold finial
      const knob = profile(0, 1.1).line(0.06, 1.1).curve([[0.074, 1.16], [0.06, 1.24], [0.03, 1.29]]).line(0.0, 1.296);
      P.lathe('body', knob);
      const rimY = 1.229, rim = [];
      for (let i = 0; i < 180; i++) { const th = (i / 180) * TAU; rim.push([Math.sin(th) * 0.207, rimY + lift(th, rimY) + 0.004, Math.cos(th) * 0.207]); }
      P.add('trim', K.tube(rim, 0.0062, { closed: true, segs: 240, radial: 8 }));
      for (let i = 0; i < N; i++) {
        const th = ((i + 0.5) * TAU) / N;
        P.add('trim', sphere(0.022, Math.sin(th) * 0.209, 1.252, Math.cos(th) * 0.209));
      }
      P.add('trim', ring(0.088, 1.004, 0.0075));
      P.add('trim', ring(0.198, 0.773, 0.007));
      P.add('trim', ring(R - 0.002, 0.03, 0.007));
      P.add('trim', sphere(0.042, 0, 1.33, 0));
      const tip = profile(0, 1.36).line(0.016, 1.362).curve([[0.012, 1.39], [0.004, 1.425]]).line(0, 1.43);
      P.lathe('trim', tip, { segs: 32 });
      P.add('trim', ring(0.032, 1.293, 0.007));
      return P;
    },
    b(B) {
      const R = 0.312, P = new Piece();
      const p = regencyBase(profile(0, 0), R, 0.155);
      p.curve([[0.14, 0.27], [0.126, 0.36], [0.12, 0.44], [0.124, 0.51], [0.134, 0.56]])
        .curve([[0.16, 0.578], [0.165, 0.6], [0.152, 0.622]])
        .line(0.17, 0.632).arc(0.18, 0.644, 0.3).arc(0.17, 0.656, 0.3)
        .line(0.09, 0.666)
        .curve([[0.084, 0.69], [0.1, 0.715]])
        .curve([[0.13, 0.76], [0.148, 0.83], [0.144, 0.9], [0.12, 0.98], [0.08, 1.05], [0.03, 1.1]])  // mitre
        .line(0.026, 1.106).line(0.045, 1.112).arc(0.045, 1.13, 0.4).line(0.02, 1.136).line(0, 1.137);
      const mod = mods([MOD.flutes(12, 0.075, 0.22, 0.555, { fillet: 0.12, end: 0.05 }), swirl(9, 0.06, 0.044, 0.15), swirl(8, 0.08, 0.565, 0.625, -10),
        MOD.slit(Math.PI * 0.25, 0.955, 0.6, 0.017, 0.58)]);
      P.lathe('body', p, { mod });
      P.add('trim', ring(0.18, 0.644, 0.0068));
      P.add('trim', ring(0.093, 0.708, 0.006));
      P.add('trim', ring(R - 0.002, 0.03, 0.007));
      P.add('trim', sphere(0.034, 0, 1.17, 0));
      const tip = profile(0, 1.196).line(0.012, 1.198).curve([[0.008, 1.215], [0.002, 1.235]]).line(0, 1.238);
      P.lathe('trim', tip, { segs: 24 });
      return P;
    },
    r(B) {
      const R = 0.322, P = new Piece();
      const p = regencyBase(profile(0, 0), R, 0.215);
      p.curve([[0.226, 0.29], [0.214, 0.4], [0.206, 0.52], [0.208, 0.62], [0.22, 0.68]])
        .curve([[0.24, 0.7], [0.258, 0.73], [0.262, 0.76]])
        .line(0.262, 0.84).line(0.205, 0.84).line(0.205, 0.81).line(0, 0.81);
      const mod = mods([MOD.flutes(18, 0.06, 0.23, 0.69, { fillet: 0.14, end: 0.05 }), swirl(10, 0.06, 0.044, 0.15), MOD.lobes(12, 0.08, 0.70, 0.76, { end: 0.012 })]);
      P.lathe('body', p, { mod });
      // battlements: five merlons with rounded tops
      const n = 5, gap = 0.36;
      const merlon = [[0.262, 0.835], [0.262, 0.95], [0.257, 0.962], [0.244, 0.968], [0.218, 0.968], [0.208, 0.962], [0.204, 0.95], [0.204, 0.835]];
      for (let i = 0; i < n; i++) {
        const w = (TAU / n) * (1 - gap), th0 = (i * TAU) / n - w / 2;
        P.add('body', revolvePart(merlon, th0, w, (Q.segs / n) * (1 - gap)));
      }
      P.add('trim', ring(0.262, 0.84, 0.0075));
      P.add('trim', ring(0.236, 0.69, 0.0065));
      P.add('trim', ring(R - 0.002, 0.03, 0.007));
      return P;
    },
    n(B) {
      const R = 0.322, P = new Piece();
      const p = regencyBase(profile(0, 0), R, 0.2);
      p.curve([[0.205, 0.25], [0.218, 0.28], [0.222, 0.3]]).arc(0.205, 0.318, 0.35).line(0, 0.318);
      P.lathe('body', p, { mod: mods([swirl(10, 0.06, 0.044, 0.15)]) });
      P.add('trim', ring(0.214, 0.306, 0.0085));
      P.add('trim', ring(R - 0.002, 0.03, 0.007));
      const h = horse({ base: 0.31, mane: 'flow', seed: 5 });
      P.add('body', h.body);
      P.add('trim', h.mane);
      return P;
    },
    p(B) {
      const R = 0.272, P = new Piece();
      // the head: a true sphere joined to the neck
      const prof = profile(0, 0);
      prof.line(R - 0.01, 0).arc(R, 0.01, 0.28).line(R, 0.026).arc(R - 0.013, 0.038, 0.3)
        .curve([[R - 0.017, 0.06], [R - 0.026, 0.09], [R - 0.06, 0.112], [R - 0.095, 0.12]])
        .arc(0.16, 0.135, -0.3)
        .curve([[0.15, 0.2], [0.128, 0.28], [0.122, 0.34], [0.13, 0.385]])
        .line(0.165, 0.395).arc(0.174, 0.407, 0.3).arc(0.165, 0.419, 0.3)
        .line(0.085, 0.428)
        .curve([[0.076, 0.452], [0.074, 0.47]]);
      // sphere of radius 0.122 centred at y = 0.585, entered from below
      const cy = 0.588, rr = 0.123, a0 = Math.asin(clamp((0.074) / rr, -1, 1));
      const sph = [];
      for (let i = 0; i <= 40; i++) { const a = mix(a0, Math.PI, i / 40); sph.push([Math.sin(a) * rr, cy - Math.cos(a) * rr]); }
      prof.line(sph[0][0], sph[0][1], true);
      prof._push(sph.slice(1), true);
      const mod = mods([MOD.flutes(12, 0.07, 0.15, 0.38, { fillet: 0.12, end: 0.045 }), swirl(9, 0.06, 0.038, 0.122)]);
      P.lathe('body', prof, { mod });
      P.add('trim', ring(0.174, 0.407, 0.0065));
      P.add('trim', ring(0.079, 0.458, 0.0055));
      P.add('trim', ring(R - 0.002, 0.026, 0.0065));
      return P;
    },
  };

  // ------------------------------------------------------------------ Classic Staunton
  // The 1849 London pattern in boxwood and ebony: everything carved, nothing applied.
  function stauntonBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.012, 0).arc(R, 0.013 * k, 0.3).line(R, 0.036 * k).arc(R - 0.014, 0.052 * k, 0.3)
      .curve([[R - 0.03, 0.062 * k], [R - 0.06, 0.078 * k], [R - 0.085, 0.1 * k]])
      .arc(R - 0.09, 0.128 * k, 0.45)
      .line(R - 0.115, 0.134 * k)
      .curve([[R - 0.13, 0.15 * k], [top, 0.18 * k]]);
  }
  function knightBase(p, top) {
    return p.curve([[top + 0.01, 0.22], [top + 0.022, 0.27], [top + 0.024, 0.296]]).arc(top + 0.006, 0.316, 0.35).line(0, 0.318);
  }
  const STAUNTON = {
    k() {
      const R = 0.35, P = new Piece();
      const p = stauntonBase(profile(0, 0), R, 0.17);
      p.curve([[0.155, 0.3], [0.138, 0.45], [0.126, 0.6], [0.124, 0.68]])
        .line(0.17, 0.69).arc(0.182, 0.708, 0.32).arc(0.17, 0.726, 0.32)
        .line(0.13, 0.732).arc(0.14, 0.748, 0.3).line(0.108, 0.754)
        .curve([[0.104, 0.8], [0.118, 0.88], [0.152, 0.98], [0.18, 1.07]])
        .line(0.188, 1.09).arc(0.188, 1.12, 0.25).line(0.152, 1.124)
        .curve([[0.15, 1.16], [0.132, 1.21], [0.092, 1.246], [0.052, 1.262]])
        .line(0.04, 1.266).arc(0.04, 1.29, 0.35).line(0, 1.292);
      P.lathe('body', p, { mod: MOD.lobes(10, 0.1, 0.82, 1.08, { shape: 1.6, end: 0.05 }) });
      P.add('body', placeAt(crossPattee(0.27, 0.06), 0, 0, 1.452));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = stauntonBase(profile(0, 0), R, 0.162);
      p.curve([[0.148, 0.29], [0.132, 0.43], [0.12, 0.56], [0.118, 0.63]])
        .line(0.162, 0.64).arc(0.174, 0.657, 0.32).arc(0.162, 0.674, 0.32)
        .line(0.124, 0.68).arc(0.133, 0.695, 0.3).line(0.1, 0.7)
        .curve([[0.097, 0.75], [0.112, 0.84], [0.15, 0.95], [0.184, 1.04]])
        .line(0.192, 1.07).arc(0.178, 1.075, 0.5)
        .curve([[0.162, 1.05], [0.12, 1.03], [0.07, 1.025]]).line(0, 1.022);
      const N = 8;
      const lift = (th, y) => -0.07 * Math.pow(Math.abs(Math.cos((Math.PI * th * N) / TAU)), 0.6) * smooth(1.0, 1.072, y);
      P.lathe('body', p, { lift });
      P.lathe('body', profile(0, 1.02).line(0.092, 1.02).curve([[0.1, 1.07], [0.086, 1.12], [0.05, 1.15]]).line(0.03, 1.156).line(0.03, 1.17).line(0, 1.171));
      P.add('body', sphere(0.052, 0, 1.214, 0, 24));
      for (let i = 0; i < N; i++) { const th = ((i + 0.5) * TAU) / N; P.add('body', sphere(0.017, Math.sin(th) * 0.19, 1.078, Math.cos(th) * 0.19, 12)); }
      return P;
    },
    b() {
      const R = 0.31, P = new Piece();
      const p = stauntonBase(profile(0, 0), R, 0.148);
      p.curve([[0.135, 0.27], [0.118, 0.39], [0.108, 0.5], [0.106, 0.56]])
        .line(0.15, 0.57).arc(0.161, 0.586, 0.32).arc(0.15, 0.602, 0.32)
        .line(0.088, 0.61)
        .curve([[0.086, 0.64], [0.1, 0.68], [0.128, 0.74], [0.142, 0.81], [0.14, 0.89], [0.12, 0.97], [0.085, 1.04], [0.04, 1.09]])
        .line(0.028, 1.096).line(0.028, 1.11).line(0, 1.111);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.94, 0.6, 0.018, 0.5) });
      P.add('body', sphere(0.042, 0, 1.146, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(stauntonBase(profile(0, 0), R, 0.2), 0.2));
      P.add('body', horse({ base: 0.31, mane: 'carved', seed: 5 }).body);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = stauntonBase(profile(0, 0), R, 0.22);
      p.curve([[0.23, 0.25], [0.222, 0.4], [0.218, 0.55], [0.222, 0.66], [0.236, 0.7]])
        .line(0.252, 0.71).arc(0.258, 0.73, 0.3).line(0.258, 0.775).line(0.2, 0.775).line(0.2, 0.75).line(0, 0.75);
      P.lathe('body', p);
      P.add('body', battlements(6, 0.2, 0.258, 0.77, 0.885, 0.38, 'flat'));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = stauntonBase(profile(0, 0), R, 0.13, 0.85);
      p.curve([[0.12, 0.22], [0.104, 0.3], [0.1, 0.35]])
        .line(0.142, 0.36).arc(0.152, 0.376, 0.32).arc(0.142, 0.392, 0.32)
        .line(0.07, 0.4);
      ballHead(p, 0.066, 0.522, 0.12);
      P.lathe('body', p);
      return P;
    },
  };

  // ------------------------------------------------------------------ Pharaoh's Treasure (Egypt)
  // Alabaster and basalt papyrus columns bound in gold, crowns of lapis lazuli.
  function egyptBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3).line(R, 0.042 * k)
      .line(R - 0.018, 0.046 * k)
      .curve([[R - 0.024, 0.06 * k], [R - 0.05, 0.08 * k], [R - 0.08, 0.088 * k]])
      .line(R - 0.09, 0.092 * k).arc(R - 0.1, 0.122 * k, 0.45)
      .line(top + 0.012, 0.128 * k).line(top, 0.15 * k);
  }
  const papyrus = (y0, y1, n) => MOD.lobes(n || 8, 0.16, y0, y1, { shape: 0.55, end: 0.05 });
  const sepals = (n, r, y, h) => around(n, r, y, () => curl(petal(h * 0.5, h, 0.006), 2.2), { tilt: 0.42 });
  const EGYPT = {
    k() {
      const R = 0.35, P = new Piece();
      const p = egyptBase(profile(0, 0), R, 0.16);
      p.curve([[0.168, 0.2], [0.17, 0.3], [0.158, 0.45], [0.14, 0.6], [0.128, 0.68]])
        .line(0.128, 0.72)
        .curve([[0.14, 0.75], [0.17, 0.8], [0.205, 0.86], [0.222, 0.9]])
        .arc(0.212, 0.914, 0.4).line(0.16, 0.92).line(0.16, 0.95).line(0.12, 0.955).line(0, 0.955);
      P.lathe('body', p, { mod: mods([papyrus(0.16, 0.7), MOD.flutes(24, 0.04, 0.76, 0.905, { end: 0.02 })]) });
      for (const y of [0.69, 0.705, 0.72]) P.add('trim', ring(0.13, y, 0.0062));
      P.add('trim', sepals(12, 0.132, 0.726, 0.1));
      P.add('trim', ring(0.216, 0.908, 0.0075));
      // the blue crown (khepresh) studded with gold, a uraeus at the brow, an ankh above
      P.lathe('accent', profile(0, 0.955).line(0.135, 0.955).curve([[0.152, 1.0], [0.16, 1.08], [0.152, 1.16], [0.126, 1.24], [0.086, 1.29], [0.04, 1.31]]).line(0, 1.312));
      P.add('trim', ring(0.138, 0.962, 0.011));
      const rows = [[1.02, 0.157, 26], [1.07, 0.16, 26], [1.12, 0.157, 26], [1.17, 0.148, 24], [1.22, 0.134, 20], [1.26, 0.112, 16]];
      rows.forEach(([y, r, n], i) => P.add('trim', beadRing(r, y, n, 0.0062, { phase: i % 2 ? Math.PI / n : 0 })));
      P.add('trim', K.tube([[0, 0.975, 0.14], [0, 1.01, 0.158], [0, 1.05, 0.162], [0, 1.08, 0.158]], 0.009, { segs: 20 }));
      P.add('trim', placeAt(petal(0.045, 0.06, 0.009), 0, 0.16, 1.07, { tilt: -0.1 }));
      P.add('trim', placeAt(ankh(0.27, 0.045), 0, 0, 1.44));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = egyptBase(profile(0, 0), R, 0.152);
      p.curve([[0.16, 0.2], [0.162, 0.29], [0.15, 0.42], [0.134, 0.55], [0.122, 0.62]])
        .line(0.122, 0.66)
        .curve([[0.13, 0.69], [0.158, 0.73], [0.19, 0.78], [0.205, 0.82]])
        .arc(0.196, 0.834, 0.4).line(0.15, 0.84).line(0.15, 0.868).line(0.1, 0.872).line(0, 0.872);
      P.lathe('body', p, { mod: mods([papyrus(0.16, 0.64), MOD.flutes(20, 0.04, 0.7, 0.825, { end: 0.02 })]) });
      for (const y of [0.63, 0.645, 0.66]) P.add('trim', ring(0.124, y, 0.006));
      P.add('trim', sepals(12, 0.126, 0.668, 0.09));
      P.add('trim', ring(0.2, 0.828, 0.007));
      // modius of lapis ringed with golden uraei, then Hathor's horns cradling the sun
      P.lathe('accent', profile(0, 0.87).line(0.122, 0.87).line(0.13, 0.98).line(0, 0.98));
      P.add('trim', ring(0.124, 0.874, 0.009)); P.add('trim', ring(0.131, 0.976, 0.009));
      P.add('trim', around(12, 0.122, 0.98, () => petal(0.034, 0.075, 0.009), { tilt: 0.14 }));
      for (const s of [-1, 1]) P.add('trim', K.tube([[s * 0.035, 0.978, 0], [s * 0.1, 1.03, 0], [s * 0.14, 1.12, 0], [s * 0.138, 1.21, 0], [s * 0.112, 1.29, 0], [s * 0.078, 1.33, 0]], 0.02, { segs: 48, radial: 12, radiusAt: (t) => mix(1, 0.2, t) }));
      const disc = new THREE.CylinderGeometry(0.1, 0.1, 0.03, 48); disc.rotateX(Math.PI / 2); disc.translate(0, 1.19, 0);
      P.add('accent2', disc);
      P.add('trim', ring(0.1, 0, 0.008, { seg: 64 }).rotateX(Math.PI / 2).translate(0, 1.19, 0));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = egyptBase(profile(0, 0), R, 0.14);
      p.curve([[0.148, 0.2], [0.15, 0.27], [0.138, 0.38], [0.122, 0.48], [0.112, 0.53]])
        .line(0.112, 0.57)
        .curve([[0.12, 0.6], [0.145, 0.635], [0.168, 0.665]])
        .arc(0.16, 0.676, 0.4).line(0.11, 0.68)
        .curve([[0.12, 0.74], [0.132, 0.82], [0.124, 0.92], [0.1, 1.0], [0.074, 1.06], [0.062, 1.1]])
        .curve([[0.072, 1.13], [0.066, 1.17], [0.045, 1.2], [0.0, 1.21]]);
      P.lathe('body', p, { mod: mods([papyrus(0.16, 0.55, 6), MOD.flutes(16, 0.04, 0.6, 0.67, { end: 0.015 }), MOD.slit(Math.PI * 0.25, 0.92, 0.6, 0.016, 0.45)]) });
      for (const y of [0.55, 0.565]) P.add('trim', ring(0.114, y, 0.0058));
      P.add('trim', ring(0.114, 0.69, 0.0095));
      P.add('accent', beadRing(0.118, 0.708, 22, 0.0068));
      P.add('trim', K.tube([[0, 0.7, 0.122], [0, 0.73, 0.134], [0, 0.77, 0.136]], 0.008, { segs: 16 }));
      P.add('trim', placeAt(petal(0.04, 0.05, 0.008), 0, 0.134, 0.765, { tilt: -0.12 }));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(egyptBase(profile(0, 0), R, 0.2), 0.2));
      P.add('trim', ring(0.214, 0.298, 0.0085));
      const h = horse({ base: 0.31, mane: 'roach', seed: 5 });
      P.add('body', h.body);
      const br = bridle(h, {}), pl = plume(h, { count: 5, len: 0.21 });
      P.add('trim', br.straps); P.add('accent', br.studs);
      P.add('trim', pl.feathers); P.add('accent', pl.holder);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = egyptBase(profile(0, 0), R, 0.24);
      p.curve([[0.248, 0.2], [0.24, 0.35], [0.23, 0.5], [0.222, 0.64]])
        .line(0.222, 0.66).arc(0.232, 0.684, 0.45)
        .curve([[0.238, 0.7], [0.252, 0.73], [0.268, 0.76]])
        .line(0.268, 0.772).line(0.215, 0.772).line(0.215, 0.75).line(0, 0.75);
      P.lathe('body', p, { mod: MOD.flutes(8, 0.035, 0.2, 0.62, { fillet: 0.7, end: 0.02 }) });
      P.add('body', battlements(6, 0.215, 0.262, 0.768, 0.89, 0.36, 'round', 0.04));
      P.add('trim', ring(0.234, 0.672, 0.008));
      P.add('accent', ring(0.27, 0.766, 0.0085));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = egyptBase(profile(0, 0), R, 0.12, 0.85);
      p.curve([[0.124, 0.17], [0.122, 0.25], [0.108, 0.32], [0.098, 0.35]])
        .curve([[0.112, 0.37], [0.14, 0.395]]).arc(0.132, 0.405, 0.4).line(0.07, 0.41);
      ballHead(p, 0.065, 0.53, 0.118);
      P.lathe('body', p, { mod: papyrus(0.13, 0.35, 6) });
      for (const y of [0.33, 0.345]) P.add('trim', ring(0.1, y, 0.0055));
      P.add('trim', beadRing(0.1, 0.428, 16, 0.009));
      P.add('accent', beadRing(0.094, 0.444, 16, 0.0072, { phase: Math.PI / 16 }));
      return P;
    },
  };

  // ------------------------------------------------------------------ Olympian Marble (Greece)
  // Ionic columns on Attic bases, a Greek key round every plinth, bronze laurels and keys.
  function atticBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3).line(R, 0.04 * k)
      .line(R - 0.016, 0.044 * k)
      .arc(R - 0.02, 0.098 * k, 0.48)
      .line(R - 0.05, 0.104 * k)
      .arc(R - 0.054, 0.132 * k, -0.4)
      .line(R - 0.05, 0.136 * k)
      .arc(R - 0.062, 0.168 * k, 0.45)
      .line(top + 0.012, 0.172 * k).line(top, 0.185 * k);
  }
  const ionic = (y0, y1, n) => MOD.flutes(n || 20, 0.07, y0, y1, { fillet: 0.25, end: 0.04 });
  const plinthKey = (R, k) => keyBand(R, 0.006 * (k || 1), 0.03 * (k || 1), Math.round(R * 64), 0.0046, 0.004);
  const GREECE = {
    k() {
      const R = 0.35, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.158);
      p.curve([[0.158, 0.26], [0.156, 0.42], [0.148, 0.6], [0.138, 0.76]])
        .line(0.14, 0.774).arc(0.15, 0.794, 0.35).line(0.146, 0.8)
        .curve([[0.17, 0.822], [0.19, 0.846]])
        .line(0.212, 0.852).line(0.212, 0.878).line(0.15, 0.882)
        .curve([[0.142, 0.92], [0.148, 0.97], [0.17, 1.03], [0.19, 1.08]])
        .line(0.196, 1.1).arc(0.184, 1.106, 0.5)
        .curve([[0.17, 1.09], [0.13, 1.08]])
        .curve([[0.122, 1.12], [0.1, 1.17], [0.06, 1.2]])
        .line(0.04, 1.205).line(0.04, 1.235).line(0, 1.236);
      P.lathe('body', p, { mod: mods([ionic(0.2, 0.765), MOD.lobes(16, 0.22, 0.802, 0.846, { end: 0.012 }), MOD.facets(4, 0.85, 0.88, 0.2)]) });
      for (let i = 0; i < 4; i++) for (const s of [-1, 1]) P.add('body', placeAt(volute(0.03, s), (i * Math.PI) / 2 + s * 0.42, 0.188, 0.828));
      P.add('trim', plinthKey(R));
      P.add('trim', wreath(0.183, 1.05, 18, 0.05));
      P.add('trim', ring(0.196, 1.1, 0.007));
      P.add('trim', placeAt(crossPattee(0.22, 0.046), 0, 0, 1.368));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.15);
      p.curve([[0.15, 0.25], [0.148, 0.4], [0.14, 0.55], [0.13, 0.68]])
        .line(0.132, 0.694).arc(0.142, 0.714, 0.35).line(0.138, 0.72)
        .curve([[0.14, 0.76], [0.15, 0.82], [0.168, 0.87]])
        .line(0.2, 0.88).line(0.2, 0.902).line(0.14, 0.905)
        .curve([[0.15, 0.94], [0.17, 1.0], [0.186, 1.06]])
        .line(0.186, 1.08).arc(0.172, 1.085, 0.5).curve([[0.15, 1.065], [0.1, 1.045]]).line(0, 1.04);
      P.lathe('body', p, { mod: mods([ionic(0.2, 0.685), MOD.facets(4, 0.878, 0.904, 0.2)]) });
      P.lathe('body', profile(0, 1.04).line(0.1, 1.04).curve([[0.105, 1.1], [0.08, 1.16], [0.04, 1.19]]).line(0, 1.192));
      P.add('body', around(8, 0.142, 0.73, () => curl(leaf(0.075, 0.13, 0.012), 3), { tilt: 0.24 }));
      P.add('body', around(8, 0.152, 0.79, () => curl(leaf(0.06, 0.09, 0.01), 4), { tilt: 0.42, phase: Math.PI / 8 }));
      P.add('trim', plinthKey(R));
      P.add('trim', ring(0.186, 1.06, 0.008));
      P.add('trim', around(12, 0.182, 1.065, () => curl(petal(0.042, 0.13, 0.008), 1.2), { tilt: 0.16 }));
      P.add('trim', sphere(0.046, 0, 1.235, 0, 24));
      P.lathe('trim', profile(0, 1.27).line(0.014, 1.272).curve([[0.01, 1.3], [0.003, 1.33]]).line(0, 1.334), { segs: 24 });
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.14);
      p.curve([[0.14, 0.24], [0.138, 0.36], [0.128, 0.47], [0.12, 0.55]])
        .line(0.122, 0.565).arc(0.132, 0.585, 0.35).line(0.128, 0.59)
        .curve([[0.146, 0.61], [0.16, 0.63]]).line(0.168, 0.635).line(0.168, 0.652).line(0.1, 0.656)
        .curve([[0.11, 0.69], [0.13, 0.75], [0.142, 0.83], [0.138, 0.91], [0.118, 0.99], [0.085, 1.06], [0.045, 1.11]])
        .line(0.03, 1.12).line(0, 1.121);
      P.lathe('body', p, { mod: mods([ionic(0.2, 0.55, 16), MOD.facets(4, 0.633, 0.654, 0.2), MOD.slit(Math.PI * 0.25, 0.95, 0.6, 0.017, 0.5)]) });
      P.add('trim', plinthKey(R));
      P.add('trim', keyBand(0.116, 0.668, 0.042, 12, 0.0048, 0.012));
      P.add('trim', sphere(0.036, 0, 1.15, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(atticBase(profile(0, 0), R, 0.2), 0.2));
      P.add('trim', plinthKey(R));
      const h = horse({ base: 0.31, mane: 'roach', seed: 5 });
      P.add('body', h.body);
      const br = bridle(h, { stud: 0.014 });
      P.add('trim', br.straps); P.add('trim', br.studs);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.235);
      p.curve([[0.24, 0.24], [0.236, 0.4], [0.232, 0.56], [0.23, 0.6]])
        .line(0.248, 0.61).line(0.248, 0.66)
        .line(0.262, 0.67).arc(0.262, 0.69, 0.25)
        .line(0.262, 0.7).line(0.21, 0.7).line(0.21, 0.68).line(0, 0.68);
      P.lathe('body', p, { mod: MOD.lobes(12, 0.12, 0.2, 0.6, { shape: 2, end: 0.03 }) });
      P.add('body', battlements(6, 0.21, 0.262, 0.698, 0.83, 0.38, 'flat'));
      P.add('trim', plinthKey(R));
      P.add('trim', keyBand(0.248, 0.616, 0.04, 18, 0.0055, 0.008));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.11, 0.85);
      p.curve([[0.11, 0.2], [0.104, 0.28], [0.098, 0.33]])
        .line(0.1, 0.34).arc(0.108, 0.356, 0.35)
        .curve([[0.13, 0.372], [0.142, 0.385]]).line(0.142, 0.398).line(0.07, 0.402);
      ballHead(p, 0.066, 0.525, 0.12);
      P.lathe('body', p, { mod: mods([ionic(0.17, 0.33, 12), MOD.facets(4, 0.384, 0.4, 0.2)]) });
      P.add('trim', plinthKey(R, 0.85));
      P.add('trim', ring(0.108, 0.348, 0.0058));
      return P;
    },
  };

  // ------------------------------------------------------------------ Imperial Rome
  // Porphyry and Carrara columns wound with Trajan's spiral, gilded laurels and radiate crowns.
  const trajan = (y0, y1, turns) => MOD.helix(0.07, turns, y0, y1, { width: 0.34 });
  const ROME = {
    k() {
      const R = 0.35, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.165);
      p.curve([[0.165, 0.26], [0.16, 0.44], [0.15, 0.62], [0.144, 0.74]])
        .line(0.15, 0.75).arc(0.158, 0.77, 0.35)
        .curve([[0.18, 0.79], [0.2, 0.82]]).line(0.21, 0.825).line(0.21, 0.85).line(0.16, 0.854)
        .curve([[0.15, 0.9], [0.156, 0.96], [0.178, 1.02], [0.198, 1.07]])
        .line(0.202, 1.09).arc(0.19, 1.096, 0.5)
        .curve([[0.176, 1.08], [0.135, 1.07]])
        .curve([[0.125, 1.11], [0.1, 1.15], [0.06, 1.175]])
        .line(0.04, 1.18).line(0, 1.181);
      P.lathe('body', p, { mod: mods([trajan(0.2, 0.74, 3), MOD.facets(4, 0.823, 0.852, 0.2)]) });
      P.add('trim', wreath(R - 0.058, 0.152, 22, 0.034));
      P.add('trim', ring(0.163, 0.875, 0.009));
      P.add('trim', wreath(0.19, 1.04, 18, 0.052));
      P.add('trim', ring(0.202, 1.09, 0.0075));
      P.add('trim', sphere(0.05, 0, 1.222, 0, 24));
      P.add('trim', ring(0.051, 1.222, 0.0065));
      P.add('trim', placeAt(crossPattee(0.21, 0.045), 0, 0, 1.396));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.155);
      p.curve([[0.155, 0.25], [0.15, 0.42], [0.14, 0.57], [0.134, 0.67]])
        .line(0.14, 0.68).arc(0.148, 0.7, 0.35)
        .curve([[0.17, 0.72], [0.19, 0.75]]).line(0.198, 0.755).line(0.198, 0.778).line(0.15, 0.782)
        .curve([[0.152, 0.83], [0.16, 0.89], [0.165, 0.93]])
        .line(0.165, 0.98).line(0.13, 0.985)
        .curve([[0.125, 1.03], [0.1, 1.09], [0.06, 1.13]]).line(0, 1.135);
      P.lathe('body', p, { mod: mods([trajan(0.2, 0.67, 2.6), MOD.facets(4, 0.753, 0.78, 0.2)]) });
      P.add('trim', wreath(R - 0.058, 0.152, 20, 0.034));
      P.add('trim', ring(0.167, 0.94, 0.0095));
      P.add('trim', ring(0.167, 0.975, 0.008));
      P.add('trim', around(14, 0.16, 0.97, () => ray(0.05, 0.21, 0.012), { tilt: 0.24 }));
      P.add('trim', sphere(0.044, 0, 1.18, 0, 24));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.145);
      p.curve([[0.145, 0.24], [0.14, 0.36], [0.13, 0.47], [0.124, 0.54]])
        .line(0.13, 0.55).arc(0.138, 0.57, 0.35)
        .curve([[0.155, 0.588], [0.168, 0.608]]).line(0.172, 0.61).line(0.172, 0.63).line(0.104, 0.634)
        .curve([[0.112, 0.67], [0.132, 0.74], [0.142, 0.82], [0.136, 0.9], [0.114, 0.98], [0.08, 1.05], [0.04, 1.095]])
        .line(0.03, 1.1).line(0, 1.101);
      P.lathe('body', p, { mod: mods([trajan(0.2, 0.54, 2), MOD.facets(4, 0.608, 0.632, 0.2), MOD.slit(Math.PI * 0.25, 0.94, 0.6, 0.017, 0.5)]) });
      P.add('trim', wreath(R - 0.058, 0.152, 18, 0.032));
      P.add('trim', wreath(0.126, 0.7, 12, 0.042));
      P.add('trim', sphere(0.036, 0, 1.13, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(atticBase(profile(0, 0), R, 0.2), 0.2));
      P.add('trim', wreath(R - 0.058, 0.152, 20, 0.034));
      const h = horse({ base: 0.31, mane: 'carved', seed: 5 });
      P.add('body', h.body);
      const br = bridle(h, { stud: 0.02 });
      P.add('trim', br.straps); P.add('trim', br.studs);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.24);
      p.curve([[0.245, 0.24], [0.242, 0.3]])
        .line(0.242, 0.47).line(0.254, 0.476).line(0.254, 0.494).line(0.242, 0.5)
        .line(0.24, 0.66)
        .line(0.258, 0.67).arc(0.258, 0.69, 0.25).line(0.258, 0.7).line(0.21, 0.7).line(0.21, 0.68).line(0, 0.68);
      P.lathe('body', p, { mod: mods([MOD.arcade(10, 0.27, 0.46, 0.6, 0.13, { head: 0.05 }), MOD.arcade(10, 0.51, 0.65, 0.6, 0.13, { head: 0.045, phase: 0.5 })]) });
      P.add('body', battlements(6, 0.21, 0.258, 0.698, 0.82, 0.38, 'flat'));
      P.add('trim', wreath(R - 0.058, 0.152, 20, 0.034));
      P.add('trim', ring(0.255, 0.485, 0.0075));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = atticBase(profile(0, 0), R, 0.115, 0.85);
      p.curve([[0.115, 0.2], [0.108, 0.28], [0.1, 0.33]])
        .line(0.106, 0.34).arc(0.112, 0.356, 0.35)
        .curve([[0.13, 0.37], [0.142, 0.385]]).line(0.142, 0.398).line(0.07, 0.402);
      ballHead(p, 0.066, 0.525, 0.12);
      P.lathe('body', p, { mod: mods([trajan(0.16, 0.33, 1.4), MOD.facets(4, 0.384, 0.4, 0.2)]) });
      P.add('trim', wreath(R - 0.052, 0.13, 16, 0.028));
      return P;
    },
  };

  // ------------------------------------------------------------------ Maharaja's Jade (Mughal India)
  // Jade balusters on lotus cushions, onion domes, gold leaf and cabochon rubies.
  function lotusBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3).line(R, 0.034 * k)
      .arc(R - 0.012, 0.046 * k, 0.3)
      .curve([[R - 0.018, 0.07 * k], [R - 0.04, 0.1 * k], [R - 0.075, 0.12 * k], [R - 0.11, 0.13 * k]])
      .line(top + 0.02, 0.136 * k).arc(top + 0.01, 0.152 * k, 0.35).line(top, 0.16 * k);
  }
  const lotusMod = (k) => MOD.lobes(16, 0.12, 0.048 * (k || 1), 0.128 * (k || 1), { shape: 0.6, end: 0.012 });
  const MUGHAL = {
    k() {
      const R = 0.35, P = new Piece();
      const p = lotusBase(profile(0, 0), R, 0.15);
      p.curve([[0.17, 0.22], [0.185, 0.3], [0.17, 0.38], [0.13, 0.46], [0.11, 0.56], [0.108, 0.64]])
        .line(0.12, 0.65).arc(0.13, 0.668, 0.35)
        .curve([[0.15, 0.7], [0.18, 0.74], [0.2, 0.775]])
        .line(0.206, 0.78).line(0.206, 0.8).line(0.17, 0.805)
        .line(0.17, 0.92).line(0.182, 0.925).line(0.182, 0.942).line(0.15, 0.946)
        .curve([[0.17, 0.98], [0.2, 1.04], [0.2, 1.1], [0.17, 1.16], [0.11, 1.21], [0.055, 1.25], [0.03, 1.28]])
        .line(0.03, 1.29).line(0, 1.291);
      P.lathe('body', p, { mod: mods([lotusMod(), MOD.lobes(12, 0.16, 0.18, 0.42, { shape: 0.7 }), MOD.arcade(8, 0.812, 0.915, 0.62, 0.2, { pointed: true, head: 0.045 }), MOD.lobes(16, 0.05, 0.95, 1.27, { shape: 2, end: 0.03 })]) });
      P.add('trim', beadRing(R - 0.004, 0.04, 44, 0.0058));
      P.add('trim', around(10, 0.152, 0.692, () => curl(leaf(0.062, 0.1, 0.01), 3), { tilt: 0.42 }));
      P.add('accent', studs(8, 0.182, 0.934, 0.011, { phase: Math.PI / 8 }));
      P.add('trim', ring(0.183, 0.926, 0.005)); P.add('trim', ring(0.183, 0.942, 0.005));
      P.add('trim', around(10, 0.05, 1.262, () => petal(0.045, 0.07, 0.006), { tilt: 2.3 }));
      P.add('trim', sphere(0.034, 0, 1.316, 0, 20));
      P.add('trim', sphere(0.024, 0, 1.364, 0, 16));
      P.add('trim', placeAt(crossPattee(0.21, 0.045), 0, 0, 1.512));
      P.add('accent', placeAt(cabochon(0.016, 0.6), 0, 0, 1.512 + 0.02));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = lotusBase(profile(0, 0), R, 0.142);
      p.curve([[0.162, 0.21], [0.176, 0.28], [0.16, 0.36], [0.124, 0.43], [0.104, 0.52], [0.102, 0.59]])
        .line(0.114, 0.6).arc(0.124, 0.618, 0.35)
        .curve([[0.14, 0.65], [0.168, 0.69], [0.188, 0.72]]).line(0.194, 0.725).line(0.194, 0.745).line(0.15, 0.75)
        .curve([[0.152, 0.8], [0.17, 0.87], [0.19, 0.93]]).line(0.19, 0.95)
        .arc(0.176, 0.955, 0.5).curve([[0.15, 0.93], [0.1, 0.91]]).line(0, 0.905);
      P.lathe('body', p, { mod: mods([lotusMod(), MOD.lobes(12, 0.16, 0.17, 0.4, { shape: 0.7 }), MOD.flutes(16, 0.05, 0.76, 0.94, { end: 0.02 })]) });
      P.lathe('body', profile(0, 0.905).line(0.11, 0.905).curve([[0.12, 0.97], [0.1, 1.05], [0.06, 1.1], [0.03, 1.12]]).line(0, 1.122), { mod: MOD.lobes(10, 0.08, 0.92, 1.11, { shape: 2 }) });
      P.add('trim', beadRing(R - 0.004, 0.04, 42, 0.0058));
      P.add('trim', around(10, 0.13, 0.64, () => curl(leaf(0.05, 0.08, 0.009), 3), { tilt: 0.42 }));
      P.add('trim', ring(0.19, 0.946, 0.0075));
      P.add('trim', around(10, 0.18, 0.95, () => curl(petal(0.075, 0.17, 0.009), 2.5), { tilt: 0.26 }));
      P.add('accent', around(10, 0.196, 1.0, () => cabochon(0.012, 0.6), { tilt: 0.26 }));
      P.add('trim', sphere(0.04, 0, 1.16, 0, 20));
      P.add('accent', sphere(0.02, 0, 1.214, 0, 16));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = lotusBase(profile(0, 0), R, 0.134);
      p.curve([[0.152, 0.2], [0.164, 0.26], [0.15, 0.33], [0.118, 0.4], [0.098, 0.48], [0.096, 0.53]])
        .line(0.108, 0.54).arc(0.116, 0.556, 0.35)
        .curve([[0.13, 0.58], [0.152, 0.61]]).line(0.158, 0.614).line(0.158, 0.632).line(0.104, 0.636)
        .curve([[0.118, 0.67], [0.14, 0.74], [0.148, 0.82], [0.14, 0.9], [0.115, 0.98], [0.08, 1.04], [0.04, 1.085]])
        .line(0.03, 1.09).line(0, 1.091);
      P.lathe('body', p, { mod: mods([lotusMod(), MOD.lobes(10, 0.16, 0.16, 0.36, { shape: 0.7 }), MOD.flutes(9, 0.07, 0.65, 0.87, { twist: 7, soft: true, end: 0.04 }), MOD.slit(Math.PI * 0.25, 0.95, 0.6, 0.017, 0.5)]) });
      P.add('trim', beadRing(R - 0.004, 0.04, 40, 0.0055));
      P.add('trim', ring(0.12, 0.66, 0.0085));
      // sarpech: a jewelled turban ornament at the front
      P.add('trim', placeAt(curl(petal(0.05, 0.12, 0.008), -2), 0, 0.146, 0.75, { tilt: -0.08 }));
      P.add('accent', placeAt(cabochon(0.016, 0.6), 0, 0.152, 0.756));
      P.add('accent2', placeAt(sphere(0.011, 0, 0, 0, 12), 0, 0.152, 0.718));
      P.add('trim', sphere(0.032, 0, 1.12, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(lotusBase(profile(0, 0), R, 0.2), 0.2), { mod: lotusMod() });
      P.add('trim', beadRing(R - 0.004, 0.04, 40, 0.0058));
      const h = horse({ base: 0.31, mane: 'carved', seed: 5 });
      P.add('body', h.body);
      const br = bridle(h, { stud: 0.015 }), pl = plume(h, { count: 3, len: 0.17, w: 0.05, spread: 0.7, lean: 0.25 });
      P.add('trim', br.straps); P.add('accent', br.studs);
      P.add('trim', pl.feathers); P.add('trim', pl.holder);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = lotusBase(profile(0, 0), R, 0.23);
      p.curve([[0.236, 0.2], [0.232, 0.35], [0.228, 0.5], [0.228, 0.62]])
        .line(0.25, 0.63).line(0.25, 0.66).arc(0.25, 0.68, 0.25)
        .line(0.25, 0.69).line(0.205, 0.69).line(0.205, 0.67).line(0, 0.67);
      P.lathe('body', p, { mod: mods([lotusMod(), MOD.arcade(8, 0.26, 0.58, 0.6, 0.14, { pointed: true, head: 0.07 })]) });
      P.add('body', battlements(8, 0.205, 0.25, 0.688, 0.84, 0.3, 'point', 0.06));
      P.add('trim', beadRing(R - 0.004, 0.04, 40, 0.0058));
      P.add('trim', ring(0.252, 0.628, 0.0075));
      P.add('accent', studs(8, 0.229, 0.6, 0.0105, { phase: Math.PI / 8 }));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = lotusBase(profile(0, 0), R, 0.11, 0.85);
      p.curve([[0.128, 0.17], [0.138, 0.22], [0.124, 0.27], [0.098, 0.32], [0.09, 0.35]])
        .line(0.1, 0.36).arc(0.108, 0.375, 0.35)
        .curve([[0.12, 0.39], [0.13, 0.4]]).line(0.07, 0.408);
      ballHead(p, 0.066, 0.53, 0.12);
      P.lathe('body', p, { mod: mods([lotusMod(0.85), MOD.lobes(10, 0.16, 0.15, 0.3, { shape: 0.7 })]) });
      P.add('trim', beadRing(R - 0.004, 0.034, 34, 0.005));
      P.add('trim', around(10, 0.104, 0.398, () => petal(0.042, 0.05, 0.005), { tilt: 1.15 }));
      return P;
    },
  };

  // ------------------------------------------------------------------ Ming Porcelain (China)
  // Blue-and-white porcelain against carved cinnabar lacquer: vase bodies, pagoda roofs, cloud collars.
  function mingBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.02, 0).arc(R - 0.01, 0.014 * k, 0.3).line(R - 0.008, 0.03 * k)
      .curve([[R, 0.042 * k], [R - 0.004, 0.066 * k], [R - 0.03, 0.09 * k]])
      .line(R - 0.05, 0.1 * k)
      .curve([[R - 0.08, 0.115 * k], [top + 0.02, 0.135 * k], [top, 0.16 * k]]);
  }
  // A pagoda roof: eight facets with eaves that turn up at the corners.
  function pagoda(r0, r1, y0, y1, o) {
    o = o || {};
    const eave = y0 + (y1 - y0) * 0.28;
    const prof = profile(0, y0).line(r0, y0).curve([[mix(r0, r1, 0.5), y0 + (eave - y0) * 0.6], [r1, eave]]).line(r1, eave + 0.008)
      .curve([[mix(r1, r0, 0.3), eave + 0.012], [mix(r1, r0 * 0.6, 0.7), y0 + (y1 - y0) * 0.7], [r0 * 0.45, y1]]).line(0, y1);
    const up = o.up || 0.035;
    const lift = (th, y) => up * Math.pow(Math.abs(Math.cos(th * 4)), 10) * smooth(y0 + (eave - y0) * 0.4, eave, y) * (1 - smooth(eave + 0.01, eave + 0.05, y));
    return revolve(prof, { segs: 128, mod: MOD.facets(8, y0 - 0.01, y1 + 0.01, 0), lift });
  }
  // Ruyi cloud collar: heart-shaped lappets hanging round a ring.
  const ruyi = (w, h, depth) => extrude(K.mirrorOutline([[0, h], [w * 0.28, h * 0.98], [w * 0.5, h * 0.78], [w * 0.42, h * 0.5], [w * 0.16, h * 0.32], [w * 0.1, 0.0], [0, -h * 0.08]]), depth, depth * 0.3, { bevelSegments: 2 });
  const MING = {
    k() {
      const R = 0.35, P = new Piece();
      const p = mingBase(profile(0, 0), R, 0.15);
      p.curve([[0.142, 0.22], [0.136, 0.34], [0.142, 0.48], [0.162, 0.62], [0.188, 0.72], [0.194, 0.77], [0.176, 0.82], [0.13, 0.86], [0.092, 0.88]])
        .line(0.085, 0.91).arc(0.094, 0.926, 0.4).line(0.07, 0.93).line(0, 0.93);
      P.lathe('body', p);
      P.add('trim', ring(R - 0.009, 0.03, 0.0065));
      P.add('trim', around(8, 0.19, 0.79, () => ruyi(0.07, 0.07, 0.006).rotateZ(Math.PI), { tilt: -0.55 }));
      P.add('trim', pagoda(0.075, 0.23, 0.93, 1.1));
      P.add('trim', pagoda(0.05, 0.155, 1.1, 1.24, { up: 0.025 }));
      P.add('trim', sphere(0.03, 0, 1.262, 0, 16));
      P.add('trim', placeAt(crossPattee(0.22, 0.045), 0, 0, 1.42));
      P.add('accent', sphere(0.018, 0, 1.42, 0.022, 12));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = mingBase(profile(0, 0), R, 0.142);
      p.curve([[0.134, 0.21], [0.128, 0.32], [0.134, 0.44], [0.152, 0.56], [0.176, 0.65], [0.182, 0.7], [0.164, 0.75], [0.12, 0.79], [0.09, 0.81]])
        .line(0.086, 0.83)
        .curve([[0.11, 0.88], [0.16, 0.96], [0.2, 1.04], [0.21, 1.07]])
        .arc(0.194, 1.078, 0.5).curve([[0.17, 1.05], [0.12, 1.02], [0.07, 1.012]]).line(0, 1.01);
      const N = 7;
      const lift = (th, y) => { const u = ((th * N) / TAU) % 1, c = Math.abs(Math.cos(Math.PI * u)); return -0.075 * Math.pow(c, 0.45) * (1 - 0.35 * Math.pow(Math.sin(Math.PI * u * 2), 2)) * smooth(0.98, 1.074, y); };
      P.lathe('body', p, { lift });
      P.add('trim', ring(R - 0.009, 0.03, 0.0065));
      P.add('trim', around(8, 0.18, 0.72, () => ruyi(0.064, 0.064, 0.006).rotateZ(Math.PI), { tilt: -0.55 }));
      for (let i = 0; i < N; i++) { const th = ((i + 0.5) * TAU) / N; P.add('accent', sphere(0.016, Math.sin(th) * 0.205, 1.082, Math.cos(th) * 0.205, 12)); }
      P.lathe('body', profile(0, 1.01).line(0.1, 1.01).curve([[0.11, 1.07], [0.09, 1.13], [0.05, 1.17], [0.03, 1.18]]).line(0, 1.182));
      P.add('trim', sphere(0.042, 0, 1.22, 0, 20));
      P.add('accent', sphere(0.024, 0, 1.28, 0, 16));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = mingBase(profile(0, 0), R, 0.13);
      p.curve([[0.124, 0.21], [0.116, 0.32], [0.122, 0.42], [0.14, 0.5], [0.15, 0.54], [0.136, 0.58], [0.1, 0.61]])
        .line(0.094, 0.63)
        .curve([[0.11, 0.67], [0.132, 0.74], [0.142, 0.82], [0.138, 0.9], [0.116, 0.98], [0.082, 1.05], [0.042, 1.1]])
        .line(0.03, 1.106).line(0, 1.107);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.94, 0.6, 0.017, 0.5) });
      P.add('trim', ring(R - 0.009, 0.03, 0.006));
      P.add('trim', ring(0.11, 0.668, 0.008));
      P.add('trim', around(8, 0.12, 0.69, () => ruyi(0.05, 0.05, 0.005), { tilt: 0.1 }));
      P.add('trim', sphere(0.034, 0, 1.138, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(mingBase(profile(0, 0), R, 0.2), 0.2));
      P.add('trim', ring(R - 0.009, 0.03, 0.0065));
      const h = horse({ base: 0.31, mane: 'flow', seed: 5 });
      P.add('body', h.body); P.add('trim', h.mane);
      const br = bridle(h, { stud: 0.016 });
      P.add('trim', br.straps); P.add('accent', br.studs);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = mingBase(profile(0, 0), R, 0.235);
      p.curve([[0.236, 0.22], [0.23, 0.4], [0.226, 0.56]])
        .line(0.24, 0.57).line(0.24, 0.64).line(0.258, 0.65).arc(0.258, 0.67, 0.25).line(0.258, 0.68)
        .line(0.205, 0.68).line(0.205, 0.66).line(0, 0.66);
      P.lathe('body', p);
      P.add('body', battlements(6, 0.205, 0.258, 0.678, 0.81, 0.38, 'flat'));
      P.add('trim', ring(R - 0.009, 0.03, 0.0065));
      P.add('trim', keyBand(0.24, 0.575, 0.06, 16, 0.006, 0.008));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = mingBase(profile(0, 0), R, 0.11, 0.85);
      p.curve([[0.104, 0.18], [0.1, 0.24], [0.11, 0.3], [0.118, 0.33], [0.1, 0.36], [0.075, 0.38]]);
      ballHead(p, 0.068, 0.5, 0.122);
      P.lathe('body', p);
      P.add('trim', ring(R - 0.009, 0.026, 0.006));
      P.add('trim', ring(0.11, 0.33, 0.0065));
      return P;
    },
  };

  // ------------------------------------------------------------------ Murano Glass (Venice)
  // Blown crystal and cobalt glass: goblet feet, twisted stems, knops and gold-leaf rims.
  function gobletFoot(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.006, 0).arc(R, 0.01 * k, 0.4)
      .curve([[R - 0.02, 0.024 * k], [R - 0.08, 0.046 * k], [R - 0.15, 0.072 * k], [top + 0.025, 0.1 * k]])
      .line(top, 0.12 * k);
  }
  const twist = (y0, y1, turns) => MOD.rope(4, 0.3, y0, y1, turns || 1.6);
  const MURANO = {
    k() {
      const R = 0.35, P = new Piece();
      const p = gobletFoot(profile(0, 0), R, 0.062);
      p.line(0.062, 0.16)
        .curve([[0.09, 0.18], [0.112, 0.215], [0.092, 0.25], [0.064, 0.266]])
        .line(0.06, 0.46)
        .curve([[0.1, 0.48], [0.132, 0.52], [0.104, 0.565], [0.07, 0.585]])
        .line(0.066, 0.63)
        .curve([[0.1, 0.67], [0.16, 0.75], [0.2, 0.86], [0.212, 0.95]])
        .line(0.214, 0.975).arc(0.2, 0.98, 0.5)
        .curve([[0.182, 0.94], [0.14, 0.87], [0.08, 0.84]]).line(0, 0.835);
      P.lathe('body', p, { mod: mods([twist(0.27, 0.455, 1.8), MOD.flutes(16, 0.05, 0.66, 0.95, { soft: true, end: 0.04 })]) });
      P.lathe('body', profile(0, 0.88).line(0.172, 0.88).curve([[0.18, 0.95], [0.156, 1.06], [0.1, 1.14], [0.05, 1.175]]).line(0, 1.178), { mod: MOD.lobes(12, 0.08, 0.9, 1.16, { shape: 2 }) });
      P.add('trim', ring(0.214, 0.976, 0.0075));
      for (const y of [0.215, 0.522]) P.add('trim', ring(y < 0.3 ? 0.112 : 0.132, y, 0.006));
      P.add('trim', ring(0.172, 0.885, 0.006));
      P.add('body', sphere(0.05, 0, 1.22, 0, 24));
      P.add('trim', ring(0.05, 1.22, 0.006));
      P.add('trim', placeAt(crossPattee(0.23, 0.045), 0, 0, 1.405));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = gobletFoot(profile(0, 0), R, 0.06);
      p.line(0.06, 0.15)
        .curve([[0.086, 0.17], [0.106, 0.2], [0.088, 0.235], [0.062, 0.25]])
        .line(0.058, 0.43)
        .curve([[0.094, 0.45], [0.124, 0.49], [0.098, 0.53], [0.068, 0.55]])
        .line(0.064, 0.59)
        .curve([[0.1, 0.64], [0.16, 0.74], [0.2, 0.86], [0.214, 0.95]])
        .line(0.216, 0.99).arc(0.2, 0.995, 0.5)
        .curve([[0.182, 0.95], [0.14, 0.88], [0.08, 0.85]]).line(0, 0.845);
      const N = 8;
      const lift = (th, y) => -0.085 * Math.pow(Math.abs(Math.cos((Math.PI * th * N) / TAU)), 0.55) * smooth(0.9, 0.99, y);
      P.lathe('body', p, { lift, mod: twist(0.255, 0.425, 1.6) });
      P.add('trim', ring(0.106, 0.2, 0.0058)); P.add('trim', ring(0.124, 0.49, 0.006));
      for (let i = 0; i < N; i++) { const th = ((i + 0.5) * TAU) / N; P.add('trim', sphere(0.017, Math.sin(th) * 0.212, 1.0, Math.cos(th) * 0.212, 12)); }
      P.lathe('body', profile(0, 0.86).line(0.11, 0.86).curve([[0.12, 0.95], [0.1, 1.05], [0.06, 1.12], [0.03, 1.14]]).line(0, 1.142));
      P.add('trim', sphere(0.04, 0, 1.18, 0, 20));
      P.add('body', sphere(0.028, 0, 1.24, 0, 16));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = gobletFoot(profile(0, 0), R, 0.056);
      p.line(0.056, 0.14)
        .curve([[0.08, 0.16], [0.1, 0.19], [0.082, 0.222], [0.058, 0.236]])
        .line(0.054, 0.4)
        .curve([[0.086, 0.42], [0.112, 0.455], [0.09, 0.49], [0.062, 0.506]])
        .line(0.06, 0.54)
        .curve([[0.1, 0.6], [0.13, 0.68], [0.142, 0.77], [0.138, 0.86], [0.116, 0.95], [0.082, 1.02], [0.042, 1.07]])
        .line(0.03, 1.076).line(0, 1.077);
      P.lathe('body', p, { mod: mods([twist(0.24, 0.395, 1.4), MOD.slit(Math.PI * 0.25, 0.92, 0.6, 0.018, 0.5)]) });
      P.add('trim', ring(0.1, 0.19, 0.0055)); P.add('trim', ring(0.112, 0.455, 0.0058));
      P.add('trim', ring(0.1, 0.6, 0.0075));
      P.add('trim', sphere(0.034, 0, 1.108, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      const p = gobletFoot(profile(0, 0), R, 0.2);
      P.lathe('body', knightBase(p, 0.2));
      P.add('trim', ring(0.214, 0.298, 0.008));
      const h = horse({ base: 0.31, mane: 'flow', seed: 5 });
      P.add('body', h.body); P.add('trim', h.mane);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = gobletFoot(profile(0, 0), R, 0.226);
      p.curve([[0.232, 0.16], [0.226, 0.4], [0.224, 0.6]])
        .line(0.254, 0.61).arc(0.256, 0.64, 0.3).line(0.256, 0.66).line(0.205, 0.66).line(0.205, 0.64).line(0, 0.64);
      P.lathe('body', p, { mod: MOD.lobes(14, 0.1, 0.14, 0.6, { shape: 1.5, end: 0.04 }) });
      P.add('body', battlements(6, 0.205, 0.256, 0.658, 0.79, 0.38, 'flat'));
      P.add('trim', ring(0.256, 0.612, 0.007));
      P.add('trim', ring(0.226, 0.16, 0.006));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = gobletFoot(profile(0, 0), R, 0.05, 0.85);
      p.line(0.05, 0.13)
        .curve([[0.076, 0.15], [0.094, 0.18], [0.076, 0.21], [0.052, 0.224]])
        .line(0.05, 0.33)
        .curve([[0.08, 0.34], [0.1, 0.36]]).line(0.06, 0.38);
      ballHead(p, 0.056, 0.49, 0.118);
      P.lathe('body', p, { mod: twist(0.226, 0.325, 1) });
      P.add('trim', ring(0.094, 0.18, 0.0055));
      P.add('trim', ring(0.098, 0.36, 0.006));
      return P;
    },
  };

  // ------------------------------------------------------------------ Tsarina's Faberge (Imperial Russia)
  // Guilloche enamel and Ural malachite set in gold, pearls and diamonds, Kremlin battlements.
  function russiaBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3).line(R, 0.03 * k).arc(R - 0.01, 0.042 * k, 0.3)
      .curve([[R - 0.015, 0.06 * k], [R - 0.04, 0.09 * k], [R - 0.08, 0.11 * k], [R - 0.12, 0.12 * k]])
      .line(top + 0.015, 0.128 * k).arc(top + 0.006, 0.145 * k, 0.35).line(top, 0.152 * k);
  }
  const gadroons = (k) => MOD.lobes(22, 0.14, 0.044 * (k || 1), 0.118 * (k || 1), { shape: 0.8, end: 0.012 });
  const pearls = (n, r, y, size, o) => beadRing(r, y, n, size, Object.assign({ seg: 12 }, o || {}));
  const RUSSIA = {
    k() {
      const R = 0.35, P = new Piece();
      const p = russiaBase(profile(0, 0), R, 0.15);
      p.curve([[0.15, 0.22], [0.138, 0.36], [0.124, 0.52], [0.12, 0.66], [0.124, 0.74]])
        .line(0.17, 0.75).arc(0.18, 0.768, 0.3).arc(0.17, 0.786, 0.3)
        .line(0.12, 0.79).curve([[0.13, 0.83], [0.16, 0.87], [0.172, 0.9]]).line(0.172, 0.91).line(0, 0.91);
      P.lathe('body', p, { mod: gadroons() });
      P.add('trim', ring(R - 0.004, 0.03, 0.0072));
      P.add('accent3', pearls(30, R - 0.03, 0.128, 0.0085));
      P.add('trim', ring(0.18, 0.768, 0.008));
      // the Great Imperial Crown: two half-domes parted by an arch of pearls
      P.lathe('body', profile(0, 0.905).line(0.17, 0.905).curve([[0.19, 0.96], [0.192, 1.04], [0.168, 1.12], [0.11, 1.18], [0.05, 1.205]]).line(0, 1.21),
        { mod: MOD.lobes(2, 0.42, 0.93, 1.21, { shape: 0.6, phase: Math.PI / 2, end: 0.05 }) });
      P.add('trim', ring(0.174, 0.912, 0.012));
      P.add('accent', around(22, 0.182, 0.912, () => brilliant(0.009)));
      // the arch runs front to back along the valley between the half-domes
      const half = [[0.93, 0.154], [0.96, 0.162], [1.0, 0.164], [1.04, 0.164], [1.08, 0.157], [1.12, 0.145], [1.15, 0.127], [1.18, 0.099], [1.2, 0.067], [1.215, 0.03]];
      const arch = half.map(([y, z]) => [0, y, z]).concat([[0, 1.222, 0]], half.slice().reverse().map(([y, z]) => [0, y, -z]));
      P.add('trim', K.tube(arch, 0.013, { segs: 72, radial: 10 }));
      half.slice(1, -1).forEach(([y, z]) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add('accent3', sphere(0.0098, sx * 0.016, y + 0.004, sz * (z + 0.002), 10)); });
      P.add('accent2', placeAt(brilliant(0.034), 0, 0, 1.25, { tilt: -Math.PI / 2 }));
      P.add('trim', placeAt(crossPattee(0.2, 0.04), 0, 0, 1.392));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = russiaBase(profile(0, 0), R, 0.142);
      p.curve([[0.142, 0.21], [0.13, 0.34], [0.116, 0.48], [0.112, 0.6], [0.116, 0.68]])
        .line(0.162, 0.69).arc(0.172, 0.708, 0.3).arc(0.162, 0.726, 0.3)
        .line(0.11, 0.73)
        .curve([[0.12, 0.79], [0.16, 0.87], [0.198, 0.96], [0.208, 1.02]])
        .line(0.21, 1.06).arc(0.194, 1.066, 0.5).curve([[0.17, 1.03], [0.12, 1.0], [0.07, 0.99]]).line(0, 0.988);
      const N = 7;
      const lift = (th, y) => { const u = ((th * N) / TAU) % 1; return -0.1 * (1 - Math.pow(Math.abs(Math.sin(Math.PI * u)), 0.5)) * smooth(0.95, 1.06, y); };
      P.lathe('body', p, { mod: gadroons(), lift });
      P.add('trim', ring(R - 0.004, 0.03, 0.007));
      P.add('accent3', pearls(28, R - 0.03, 0.128, 0.0082));
      P.add('trim', ring(0.172, 0.708, 0.0078));
      P.add('trim', ring(0.205, 0.975, 0.0075));
      for (let i = 0; i < N; i++) { const th = ((i + 0.5) * TAU) / N; P.add('accent3', sphere(0.019, Math.sin(th) * 0.205, 1.075, Math.cos(th) * 0.205, 14)); }
      P.add('accent', around(14, 0.206, 0.99, () => brilliant(0.0085)));
      P.lathe('body', profile(0, 0.988).line(0.1, 0.988).curve([[0.11, 1.05], [0.09, 1.12], [0.05, 1.16], [0.03, 1.17]]).line(0, 1.172));
      P.add('trim', sphere(0.034, 0, 1.2, 0, 20));
      P.add('accent3', sphere(0.026, 0, 1.252, 0, 16));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = russiaBase(profile(0, 0), R, 0.13);
      p.curve([[0.13, 0.2], [0.12, 0.32], [0.108, 0.44], [0.104, 0.54], [0.108, 0.6]])
        .line(0.15, 0.61).arc(0.16, 0.626, 0.3).arc(0.15, 0.642, 0.3).line(0.1, 0.646)
        // onion dome mitre
        .curve([[0.13, 0.69], [0.152, 0.76], [0.15, 0.84], [0.126, 0.91], [0.09, 0.97], [0.05, 1.03], [0.026, 1.08]])
        .line(0.02, 1.09).line(0, 1.091);
      P.lathe('body', p, { mod: mods([gadroons(), MOD.slit(Math.PI * 0.25, 0.88, 0.6, 0.018, 0.5)]) });
      P.add('trim', ring(R - 0.004, 0.03, 0.0068));
      P.add('accent3', pearls(26, R - 0.03, 0.128, 0.008));
      P.add('trim', ring(0.16, 0.626, 0.0072));
      P.add('trim', ring(0.11, 0.652, 0.0075));
      P.add('accent3', sphere(0.024, 0, 1.12, 0, 16));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(russiaBase(profile(0, 0), R, 0.2), 0.2), { mod: gadroons() });
      P.add('trim', ring(R - 0.004, 0.03, 0.007));
      P.add('accent3', pearls(28, R - 0.03, 0.128, 0.0082));
      const h = horse({ base: 0.31, mane: 'flow', seed: 5 });
      P.add('body', h.body); P.add('trim', h.mane);
      const br = bridle(h, { stud: 0.014 });
      P.add('trim', br.straps); P.add('accent', br.studs);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = russiaBase(profile(0, 0), R, 0.226);
      p.curve([[0.232, 0.2], [0.226, 0.4], [0.224, 0.6]])
        .line(0.246, 0.61).line(0.246, 0.64).arc(0.25, 0.66, 0.3).line(0.25, 0.67).line(0.2, 0.67).line(0.2, 0.65).line(0, 0.65);
      P.lathe('body', p, { mod: gadroons() });
      P.add('body', battlements(8, 0.2, 0.248, 0.668, 0.83, 0.32, 'swallow', 0.05));
      P.add('trim', ring(R - 0.004, 0.03, 0.007));
      P.add('accent3', pearls(28, R - 0.03, 0.128, 0.0082));
      P.add('trim', ring(0.247, 0.612, 0.0075));
      P.add('accent', around(16, 0.247, 0.628, () => brilliant(0.0085)));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = russiaBase(profile(0, 0), R, 0.11, 0.85);
      p.curve([[0.106, 0.18], [0.096, 0.26], [0.09, 0.32]])
        .line(0.13, 0.33).arc(0.14, 0.346, 0.3).arc(0.13, 0.362, 0.3).line(0.066, 0.368);
      ballHead(p, 0.062, 0.49, 0.118);
      P.lathe('body', p, { mod: gadroons(0.85) });
      P.add('trim', ring(R - 0.004, 0.026, 0.0065));
      P.add('trim', ring(0.14, 0.346, 0.0068));
      P.add('accent3', pearls(18, 0.07, 0.376, 0.0072));
      return P;
    },
  };

  // ------------------------------------------------------------------ Manhattan Deco (New York, 1930)
  // Nickel silver against black onyx and gold: stepped setbacks, sunbursts and spires.
  function decoBase(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).line(R, 0.036 * k).line(R - 0.032, 0.036 * k).line(R - 0.032, 0.07 * k)
      .line(R - 0.064, 0.07 * k).line(R - 0.064, 0.1 * k).line(top + 0.012, 0.1 * k).line(top, 0.13 * k);
  }
  const octo = (y0, y1) => MOD.facets(8, y0, y1, 0.05);
  const ribs = (n, y0, y1) => MOD.flutes(n, 0.06, y0, y1, { fillet: 0.55, end: 0.01 });
  function chryslerCrown(y0, r0, tiers) {
    // stacked tiers, each narrower, with scalloped arched tops and sunburst windows
    const parts = [];
    let y = y0, r = r0;
    for (let i = 0; i < tiers; i++) {
      const h = 0.075 - i * 0.008, n = 8;
      const prof = profile(0, y).line(r, y).line(r, y + h).line(r * 0.7, y + h + 0.005).line(0, y + h + 0.005);
      const lift = (th, yy) => -0.032 * (1 - Math.sqrt(Math.max(0, 1 - Math.pow(2 * (((th * n) / TAU) % 1) - 1, 2)))) * smooth(y + h * 0.5, y + h, yy) * (yy <= y + h + 0.001 ? 1 : 1);
      parts.push(revolve(prof, { segs: 128, lift, mod: MOD.flutes(n * 3, 0.12, y + 0.01, y + h - 0.012, { fillet: 0.6, end: 0.005, phase: 0.5 }) }));
      y += h - 0.012; r *= 0.76;
    }
    return { geom: merge(parts), top: y };
  }
  const DECO = {
    k() {
      const R = 0.35, P = new Piece();
      const p = decoBase(profile(0, 0), R, 0.15);
      p.line(0.142, 0.64).line(0.168, 0.645).line(0.168, 0.69).line(0.128, 0.695)
        .line(0.12, 0.86).line(0.142, 0.865).line(0.142, 0.895).line(0.105, 0.9).line(0.1, 0.94).line(0, 0.94);
      P.lathe('body', p, { mod: mods([octo(0, 0.135), ribs(16, 0.14, 0.635), ribs(12, 0.7, 0.855)]) });
      P.add('trim', ring(0.169, 0.667, 0.007)); P.add('trim', ring(0.143, 0.88, 0.006));
      const c = chryslerCrown(0.94, 0.11, 4);
      P.add('trim', c.geom);
      P.lathe('trim', profile(0, c.top).line(0.02, c.top).line(0.004, c.top + 0.16).line(0, c.top + 0.162), { segs: 24 });
      P.add('trim', placeAt(crossPattee(0.18, 0.036), 0, 0, c.top + 0.27));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = decoBase(profile(0, 0), R, 0.142);
      p.line(0.134, 0.6).line(0.16, 0.605).line(0.16, 0.65).line(0.12, 0.655)
        .line(0.112, 0.8).line(0.14, 0.805).line(0.14, 0.835).line(0.1, 0.84)
        .curve([[0.11, 0.9], [0.1, 0.98], [0.07, 1.04], [0.035, 1.07]]).line(0, 1.072);
      P.lathe('body', p, { mod: mods([octo(0, 0.13), ribs(16, 0.135, 0.595), ribs(12, 0.66, 0.795)]) });
      P.add('trim', ring(0.161, 0.627, 0.0068)); P.add('trim', ring(0.141, 0.82, 0.006));
      // sunburst: rays fanning up and out from the crown
      P.add('trim', around(16, 0.104, 0.842, (i) => ray(0.072, i % 2 ? 0.15 : 0.235, 0.012), { tilt: 0.42 }));
      P.add('trim', ring(0.106, 0.846, 0.012));
      P.add('trim', sphere(0.04, 0, 1.11, 0, 20));
      P.lathe('trim', profile(0, 1.14).line(0.012, 1.142).line(0.003, 1.22).line(0, 1.222), { segs: 20 });
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = decoBase(profile(0, 0), R, 0.13);
      p.line(0.122, 0.54).line(0.148, 0.545).line(0.148, 0.59).line(0.1, 0.596)
        .curve([[0.118, 0.64], [0.136, 0.72], [0.138, 0.81], [0.126, 0.9], [0.1, 0.98], [0.066, 1.04], [0.03, 1.08]])
        .line(0.018, 1.086).line(0, 1.087);
      P.lathe('body', p, { mod: mods([octo(0, 0.125), ribs(12, 0.13, 0.535), MOD.slit(Math.PI * 0.25, 0.9, 0.6, 0.017, 0.5)]) });
      P.add('trim', ring(0.149, 0.567, 0.0066));
      for (const [y, r] of [[0.64, 0.12], [0.665, 0.126], [0.69, 0.131]]) P.add('trim', ring(r, y, 0.0048));
      P.add('trim', sphere(0.03, 0, 1.11, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      const p = decoBase(profile(0, 0), R, 0.2);
      p.line(0.2, 0.2).line(0.222, 0.205).line(0.222, 0.3).line(0.205, 0.318).line(0, 0.318);
      P.lathe('body', p, { mod: octo(0, 0.32) });
      P.add('trim', ring(0.223, 0.25, 0.006));
      const h = horse({ base: 0.31, mane: 'roach', seed: 5 });
      P.add('body', h.body);
      const br = bridle(h, { stud: 0.014 });
      P.add('trim', br.straps); P.add('trim', br.studs);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = decoBase(profile(0, 0), R, 0.228);
      p.line(0.222, 0.56).line(0.25, 0.565).line(0.25, 0.62).line(0.2, 0.625).line(0.2, 0.6).line(0, 0.6);
      P.lathe('body', p, { mod: mods([octo(0, 0.63), ribs(16, 0.14, 0.55)]) });
      P.add('body', battlements(8, 0.2, 0.248, 0.618, 0.76, 0.3, 'step', 0.07));
      P.add('trim', ring(0.252, 0.59, 0.0065));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = decoBase(profile(0, 0), R, 0.1, 0.85);
      p.line(0.094, 0.3).line(0.122, 0.305).line(0.122, 0.345).line(0.064, 0.35);
      ballHead(p, 0.06, 0.47, 0.118);
      P.lathe('body', p, { mod: mods([octo(0, 0.35), ribs(10, 0.115, 0.295)]) });
      P.add('trim', ring(0.123, 0.325, 0.0058));
      return P;
    },
  };

  // ------------------------------------------------------------------ era materials
  const phys = (key, o) => K.material('p:' + key, () => new THREE.MeshPhysicalMaterial(o));
  const MATS = {
    boxwood: () => phys('boxwood', { map: TEX.wood('#ecd2a4', '#c79c66', { lines: 34, contrast: 0.38, figure: 0.1, seed: 4 }), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.18, sheen: 0.3, sheenColor: new THREE.Color('#fff0d6'), sheenRoughness: 0.5 }),
    ebony: () => phys('ebony', { map: TEX.wood('#2e211b', '#090605', { lines: 30, contrast: 0.6, figure: 0.12, seed: 9 }), roughness: 0.32, clearcoat: 0.75, clearcoatRoughness: 0.1 }),
    alabaster: () => phys('alabaster', { map: TEX.marble('#f4ead6', '#d8c19a', { scale: 2, freq: 4, sharp: 3, strength: 0.32, cloud: 0.12 }), roughness: 0.34, clearcoat: 0.4, clearcoatRoughness: 0.15, sheen: 0.35, sheenColor: new THREE.Color('#fff6e6'), sheenRoughness: 0.4 }),
    basalt: () => phys('basalt', { map: TEX.stone('#1d1c1e', '#3c3936', { scale: 6, cloud: 0.25, speckScale: 220, speckCut: 0.32, speckMix: 0.5 }), roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.1 }),
    lapis: () => phys('lapis', { map: TEX.lapis({ size: 512 }), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 }),
    carnelian: () => phys('carnelian', { color: '#c2421f', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, sheenColor: new THREE.Color('#ffb080') }),
    pentelic: () => phys('pentelic', { map: TEX.marble('#f3eee5', '#b6aea0', { scale: 2.5, sharp: 12, strength: 0.5, cloud: 0.12 }), roughness: 0.36, clearcoat: 0.35, clearcoatRoughness: 0.2, sheen: 0.25, sheenColor: new THREE.Color('#fff8ee') }),
    nero: () => phys('nero', { map: TEX.marble('#19191b', '#cfcac0', { sharp: 16, strength: 0.6, cloud: 0.15 }), roughness: 0.24, clearcoat: 0.85, clearcoatRoughness: 0.08 }),
    bronze: () => phys('bronze-antique', { color: '#c0904e', metalness: 1, roughness: 0.3, clearcoat: 0.3, clearcoatRoughness: 0.3, envMapIntensity: 1.15 }),
    carrara: () => phys('carrara', { map: TEX.marble('#f5f3ef', '#a8a6a2', { sharp: 10, strength: 0.45 }), roughness: 0.26, clearcoat: 0.7, clearcoatRoughness: 0.1 }),
    porphyry: () => phys('porphyry', { map: TEX.stone('#4c1526', '#c98c9a', { scale: 8, cloud: 0.18, speckScale: 260, speckCut: 0.3, speckMix: 0.5 }), roughness: 0.22, clearcoat: 0.9, clearcoatRoughness: 0.06 }),
    gilt: () => MAT.gold('#dcaa4c'),
    jadeWhite: () => phys('jade-w', { map: TEX.mottle('#eef0e0', { amount: 0.06 }), roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.6, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.35 }),
    jadeBlack: () => phys('jade-b', { map: TEX.mottle('#0f3322', { amount: 0.3 }), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: new THREE.Color('#4fae7c'), sheenRoughness: 0.4 }),
    ruby: () => MAT.gem('#b3122e'),
    emerald: () => MAT.gem('#0f7a45'),
    porcelain: () => phys('porcelain', { map: blueAndWhite(), roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03 }),
    cinnabar: () => phys('cinnabar', { map: TEX.mottle('#a3221a', { amount: 0.1 }), normalMap: carved(), normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.2 }),
    jade: () => phys('jade-g', { color: '#3f8f5e', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.4, sheenColor: new THREE.Color('#bff0cf') }),
    crystal: () => phys('crystal', { color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 1, ior: 1.52, thickness: 0.45, attenuationColor: new THREE.Color('#fff4e4'), attenuationDistance: 1.6, specularIntensity: 1, envMapIntensity: 1.3 }),
    cobalt: () => phys('cobalt', { color: '#2f58e6', metalness: 0, roughness: 0.04, transmission: 0.62, ior: 1.52, thickness: 0.4, attenuationColor: new THREE.Color('#1d46e0'), attenuationDistance: 0.4, specularIntensity: 1, envMapIntensity: 1.4, clearcoat: 1, clearcoatRoughness: 0.03 }),
    enamel: () => phys('enamel', { color: '#f6f3ef', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.35, iridescenceIOR: 1.35, normalMap: guilloche(), normalScale: new THREE.Vector2(0.35, 0.35) }),
    malachite: () => phys('malachite', { map: TEX.malachite({ size: 512, bands: 30 }), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04 }),
    roseGold: () => MAT.gold('#e9b06c'),
    diamond: () => phys('diamond', { color: '#ffffff', roughness: 0, metalness: 0, clearcoat: 1, clearcoatRoughness: 0, ior: 2.4, specularIntensity: 1, envMapIntensity: 3, emissive: '#ffffff', emissiveIntensity: 0.06, iridescence: 0.4 }),
    spinel: () => MAT.gem('#c0102a'),
    pearl: () => phys('pearl', { color: '#f3eee4', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.12, sheen: 1, sheenColor: new THREE.Color('#ffe6ee'), sheenRoughness: 0.3, iridescence: 0.5, iridescenceIOR: 1.4 }),
    nickel: () => phys('nickel', { color: '#e2e5ea', metalness: 1, roughness: 0.16, envMapIntensity: 1.25 }),
    cream: () => phys('cream-enamel', { color: '#f0e9dc', roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.2, sheenColor: new THREE.Color('#fff8ec') }),
    onyx: () => phys('onyx', { map: TEX.marble('#0b0b0d', '#2e2e34', { strength: 0.3, sharp: 6, cloud: 0.1 }), roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.03 }),
  };
  // Blue-and-white porcelain: a lotus scroll between bands, in cobalt on a cool white glaze.
  function blueAndWhite() {
    return K.canvasTex('blue-and-white', 1024, 1024, (g, w, h) => {
      g.fillStyle = '#f6f8fb'; g.fillRect(0, 0, w, h);
      const ink = (a) => 'rgba(28,52,140,' + a + ')';
      const wrap = (fn) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { g.save(); g.translate(dx, dy); fn(); g.restore(); } };
      for (let row = 0; row < 2; row++) {
        const cy = h * (0.25 + row * 0.5);
        wrap(() => {
          g.strokeStyle = ink(0.85); g.lineWidth = 7; g.beginPath();
          for (let x = 0; x <= w; x += 8) { const y = cy + Math.sin((x / w) * TAU * 3 + row) * 70; if (x) g.lineTo(x, y); else g.moveTo(x, y); }
          g.stroke();
          for (let i = 0; i < 3; i++) {
            const x = ((i + 0.25 + row * 0.5) / 3) * w, y = cy + Math.sin(((x / w) * TAU * 3) + row) * 70;
            // lotus: layered petals
            g.fillStyle = ink(0.9);
            for (let k = -2; k <= 2; k++) { g.save(); g.translate(x, y - 6); g.rotate(k * 0.42); g.beginPath(); g.ellipse(0, -34, 13, 38, 0, 0, TAU); g.fill(); g.restore(); }
            g.fillStyle = ink(0.45); g.beginPath(); g.ellipse(x, y + 4, 40, 14, 0, 0, TAU); g.fill();
            // leaves and tendrils
            for (const s of [-1, 1]) {
              g.fillStyle = ink(0.75); g.save(); g.translate(x + s * 70, y + 30); g.rotate(s * 0.6); g.beginPath(); g.ellipse(0, 0, 34, 15, 0, 0, TAU); g.fill(); g.restore();
              g.strokeStyle = ink(0.8); g.lineWidth = 4; g.beginPath(); g.arc(x + s * 110, y - 30, 18, 0, TAU * 0.8); g.stroke();
            }
          }
        });
        // bands between the scrolls
        g.fillStyle = ink(0.85); g.fillRect(0, cy + h * 0.2, w, 6); g.fillRect(0, cy + h * 0.2 + 14, w, 3);
      }
    }, { repeat: [2, 1.6] });
  }
  // Carved cinnabar lacquer: a raised diaper of small lozenges.
  function carved() {
    return TEX.normal('cinnabar', 256, 256, (u, v) => {
      const a = Math.abs(((u * 16) % 1) - 0.5) + Math.abs(((v * 16) % 1) - 0.5);
      const b = Math.abs(((u * 4 + 0.125) % 1) - 0.5) + Math.abs(((v * 4 + 0.125) % 1) - 0.5);
      return clamp(1.6 - a * 3.2, 0, 1) * 0.6 + smooth(0.32, 0.26, b) * 0.6;
    }, 3);
  }
  // Guilloche: engine-turned waves under clear enamel.
  function guilloche() {
    return TEX.normal('guilloche', 512, 512, (u, v) => 0.5 + 0.5 * Math.sin(TAU * (u * 64 + 0.55 * Math.sin(TAU * v * 4))), 1.6);
  }

  // ------------------------------------------------------------------ sets
  const SETS = {
    regency: {
      id: 'regency', name: 'Regency Gilt', era: 'Regency England', year: 'c. 1815',
      story: 'Made for a royal summer house by the sea, where the Prince Regent played on a lacquered table under painted dragons. White and black lacquer, polished until it mirrors candlelight, with crowns, pearls and manes laid in real-looking gold leaf.',
      lore: {
        k: 'His crown has eight arches, each set with four pearls, and a gold cross to show he is the most important piece on the board.',
        q: 'Her coronet has six golden points. The most powerful piece: she can glide any distance in any straight line.',
        b: 'A tall mitre with a slanted cut. Bishops always travel diagonally and never leave their own colour.',
        n: 'A horse with a golden mane that seems to blow in the wind. Knights jump in an L and can leap over other pieces.',
        r: 'A castle tower with five battlements. Rooks guard the corners and sweep along ranks and files.',
        p: 'Small, round and brave. A pawn that reaches the far side becomes a queen.',
      },
      pieces: REGENCY,
      mats(side) {
        return side === 'w'
          ? { body: MAT.lacquer('#f3eee6', { roughness: 0.26, clearcoatRoughness: 0.05, sheen: 0.25, sheenColor: new THREE.Color('#fff4e2'), sheenRoughness: 0.5 }), trim: MAT.goldLeaf() }
          : { body: MAT.lacquer('#0d0c0e', { roughness: 0.3, clearcoatRoughness: 0.04 }), trim: MAT.goldLeaf() };
      },
    },
    staunton: {
      id: 'staunton', name: 'Classic Staunton', era: 'Victorian London', year: '1849',
      story: 'In 1849 a London games maker launched a design so clear that players anywhere could read it at a glance. Boxwood and ebony, turned on a lathe and carved by hand: almost every chess set since has learned from this one.',
      lore: {
        k: 'A ribbed crown and a carved cross. The tallest piece, and the one you must protect.',
        q: 'Her coronet has eight points. She can move any distance in any straight line.',
        b: 'A mitre with a deep cut. Bishops slide diagonally and stay on one colour all game.',
        n: 'The horse head every chess player knows. It jumps in an L shape over anything in its way.',
        r: 'A castle tower with six battlements. Rooks race along ranks and files.',
        p: 'A round head on a collar. Eight of them march in front of their army.',
      },
      pieces: STAUNTON,
      mats: (side) => (side === 'w' ? { body: MATS.boxwood() } : { body: MATS.ebony() }),
    },
    pharaoh: {
      id: 'pharaoh', name: "Pharaoh's Treasure", era: 'Ancient Egypt', year: 'c. 1330 BC',
      story: 'Inspired by the treasures of the boy king Tutankhamun: alabaster that glows like moonlight, black basalt from the desert, and collars of gold and blue lapis lazuli. Every piece stands on a papyrus column, the plant that gave the world paper.',
      lore: {
        k: 'He wears the Blue Crown and carries an ankh, the Egyptian sign of life, in place of a cross.',
        q: 'Her crown holds the sun between two horns, like the goddess Hathor, above a ring of golden cobras.',
        b: 'He wears the tall White Crown of Upper Egypt, cut with a slit like every bishop.',
        n: 'A royal chariot horse with a feather plume and a golden bridle.',
        r: 'A temple gateway, like the great pylons of Karnak, with rounded battlements.',
        p: 'A little papyrus column with a collar of gold and lapis.',
      },
      pieces: EGYPT,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.alabaster() } : { body: MATS.basalt() }, { trim: MAT.gold('#ebb84f'), accent: MATS.lapis(), accent2: MATS.carnelian() }),
    },
    olympian: {
      id: 'olympian', name: 'Olympian Marble', era: 'Ancient Greece', year: 'c. 440 BC',
      story: 'Carved in the spirit of the Parthenon in Athens: white marble from Mount Pentelicus, dark marble from Eleusis, and bronze that shines like the shields of Olympia. Look for the Greek key that runs round every base like a little maze.',
      lore: {
        k: 'An Ionic column with curling scrolls, a crown of olive leaves and a bronze cross.',
        q: 'A column wrapped in acanthus leaves, crowned with a ring of bronze olive leaves.',
        b: 'A marble mitre with a Greek key band and a deep slit.',
        n: 'A horse with a short upright mane, like the horses on the Parthenon frieze.',
        r: 'A round temple tower of columns, with a Greek key frieze and battlements.',
        p: 'A fluted column with a round marble head.',
      },
      pieces: GREECE,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.pentelic() } : { body: MATS.nero() }, { trim: MATS.bronze() }),
    },
    imperial: {
      id: 'imperial', name: 'Imperial Rome', era: 'Ancient Rome', year: 'AD 113',
      story: 'Fit for an emperor: purple porphyry, a stone so rare that only emperors could use it, set against white Carrara marble and gilded bronze. Every column winds with a spiral band, like Trajan\'s Column, which still stands in Rome today.',
      lore: {
        k: 'A golden laurel crown, an orb and a cross above a spiral column.',
        q: 'A radiate crown of golden sun rays, as worn by Roman emperors on their coins.',
        b: 'A marble mitre wrapped in a golden laurel wreath.',
        n: 'A war horse with a carved mane and a gilded bridle.',
        r: 'Two storeys of arches, like the Colosseum, under the battlements.',
        p: 'A little spiral column with a laurel wreath at its foot.',
      },
      pieces: ROME,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.carrara() } : { body: MATS.porphyry() }, { trim: MATS.gilt() }),
    },
    maharaja: {
      id: 'maharaja', name: "Maharaja's Jade", era: 'Mughal India', year: 'c. 1640',
      story: 'From the age of the Taj Mahal, when Shah Jahan\'s craftsmen carved white and deep green jade as thin as a leaf and set it with rubies and emeralds. Lotus cushions, pointed arches and onion domes: every piece is a little palace.',
      lore: {
        k: 'An onion dome on a drum of pointed arches, set with rubies and crowned with a golden cross.',
        q: 'A golden lotus opens round her crown, every petal tipped with a ruby.',
        b: 'A twisted turban with a jewelled sarpech at the front, and the bishop\'s slit.',
        n: 'A royal horse with a jewelled bridle and a golden plume.',
        r: 'A fort tower with pointed arches and lotus-bud battlements, like the Red Fort in Delhi.',
        p: 'A baluster with a lotus collar under a round jade head.',
      },
      pieces: MUGHAL,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.jadeWhite() } : { body: MATS.jadeBlack() }, { trim: MAT.gold('#f0c35a'), accent: MATS.ruby(), accent2: MATS.emerald() }),
    },
    dynasty: {
      id: 'dynasty', name: 'Ming Porcelain', era: 'Ming China', year: 'c. 1420',
      story: 'Blue-and-white porcelain from the imperial kilns of Jingdezhen faces carved cinnabar lacquer, as red as the walls of the Forbidden City. Lotus scrolls, cloud collars and pagoda roofs with upturned corners decorate every piece.',
      lore: {
        k: 'A vase-shaped body under two golden pagoda roofs and a cross.',
        q: 'A phoenix crown of seven cloud-shaped points, each set with jade.',
        b: 'A tall mitre with a slit, above a golden cloud collar.',
        n: 'A horse with a flowing golden mane and jade studs on its bridle.',
        r: 'A gate tower with a golden key-pattern frieze and battlements.',
        p: 'A small porcelain vase with a round head.',
      },
      pieces: MING,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.porcelain() } : { body: MATS.cinnabar() }, { trim: MAT.gold('#ecbc58'), accent: MATS.jade() }),
    },
    murano: {
      id: 'murano', name: 'Murano Glass', era: 'Venice', year: 'c. 1700',
      story: 'Blown by the glassmakers of Murano, an island so secret that its masters were not allowed to leave. Clear crystal with gold leaf against deep cobalt blue, with twisted stems that catch the light.',
      lore: {
        k: 'A crystal goblet crown under a glass ball and a golden cross.',
        q: 'A goblet whose rim rises into eight points, each tipped with gold.',
        b: 'A glass mitre on a twisted stem, with the bishop\'s slit.',
        n: 'A glass horse with a mane of gold.',
        r: 'A ribbed glass tower with battlements and a golden band.',
        p: 'A glass bubble on a twisted stem.',
      },
      pieces: MURANO,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.crystal() } : { body: MATS.cobalt() }, { trim: MAT.gold('#f0c564') }),
    },
    tsarina: {
      id: 'tsarina', name: "Tsarina's Faberge", era: 'Imperial Russia', year: 'c. 1900',
      story: 'Inspired by the jewellers who made Easter eggs for the Tsars: shimmering white enamel over engraved waves, green malachite from the Ural Mountains, gold, pearls and diamonds. The rooks wear the swallowtail battlements of the Moscow Kremlin.',
      lore: {
        k: 'The Great Imperial Crown: two half-domes, an arch of pearls, a red spinel and a cross.',
        q: 'A kokoshnik crown of seven rounded points, each with a pearl.',
        b: 'An onion dome, like a Russian church, with the bishop\'s slit and a pearl on top.',
        n: 'A horse with a golden mane and a bridle set with diamonds.',
        r: 'A Kremlin tower with swallowtail battlements and a band of diamonds.',
        p: 'A round head over a necklace of pearls.',
      },
      pieces: RUSSIA,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.enamel() } : { body: MATS.malachite() }, { trim: MATS.roseGold(), accent: MATS.diamond(), accent2: MATS.spinel(), accent3: MATS.pearl() }),
    },
    manhattan: {
      id: 'manhattan', name: 'Manhattan Deco', era: 'New York', year: '1930',
      story: 'Made in the year the Chrysler Building reached for the clouds: cream enamel and black onyx, trimmed with polished nickel and gold, stepped like skyscrapers, with a sunburst on the queen and a spire on the king.',
      lore: {
        k: 'A skyscraper with setbacks and a crown of stacked arches, topped by a spire and a cross.',
        q: 'A golden sunburst fans out from her crown.',
        b: 'A streamlined mitre with speed lines and a slit.',
        n: 'A sleek horse on an octagonal base.',
        r: 'An octagonal tower with stepped battlements, like a ziggurat.',
        p: 'A round head on a ribbed column and stepped base.',
      },
      pieces: DECO,
      mats: (side) => (side === 'w' ? { body: MATS.cream(), trim: MATS.nickel() } : { body: MATS.onyx(), trim: MAT.gold('#e8b75a') }),
    },
  };

  // ------------------------------------------------------------------ colourways
  // The Regency and Staunton shapes in other finishes, earned with levels, achievements, the
  // season track and Premium. They share geometry with the set whose shape they borrow.
  const lacquer = (key, color, o) => phys('lq-' + key, Object.assign({ color, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.05 }, o || {}));
  // Tempered chocolate: a soft gloss with a warm sheen at grazing angles.
  const choc = (key, color, sheen) => phys('choc-' + key, { color, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.14, sheen: 0.6, sheenColor: new THREE.Color(sheen || '#ffcf9e'), sheenRoughness: 0.45 });
  const COLOURWAYS = {
    'ruby-pearl': { name: 'Ruby & Pearl', shape: 'regency', era: 'Belle Epoque Paris', year: '1889',
      story: 'Made for the World\'s Fair in Paris, the year the Eiffel Tower opened. Pearly white faces deep ruby lacquer, and every crown and mane is laid in gold leaf.',
      w: () => ({ body: MATS.pearl(), trim: MAT.goldLeaf() }), b: () => ({ body: lacquer('ruby', '#5e0a1e', { sheen: 0.3, sheenColor: new THREE.Color('#ff8aa4') }), trim: MAT.goldLeaf() }) },
    marble: { name: 'Carrara & Nero', shape: 'staunton', era: 'Tuscany and Spain', year: 'Today',
      story: 'White marble from Carrara in Tuscany, the stone Michelangelo used for his statue of David, faces black Nero Marquina from northern Spain.',
      w: () => ({ body: MATS.carrara() }), b: () => ({ body: MATS.nero() }) },
    'cocoa-gilt': { name: 'Cocoa & Gilt', shape: 'regency', era: 'A chocolatier\'s salon', year: 'c. 1900',
      story: 'A chocolatier kept this set in the shop window: bright gilt against dark cocoa lacquer, polished until it looked good enough to eat. (Please do not try.)',
      w: () => ({ body: MAT.gold('#e2b45c'), trim: lacquer('cocoa-trim', '#2a140c') }), b: () => ({ body: lacquer('cocoa', '#2a140c', { sheen: 0.4, sheenColor: new THREE.Color('#d89060') }), trim: MAT.goldLeaf() }) },
    'jade-onyx': { name: 'Jade & Onyx', shape: 'staunton', era: 'Stones of legend', year: 'Ancient and modern',
      story: 'Pale green jade, treasured in China for thousands of years, against polished black onyx. Earned by beating Shelly the Tortoise.',
      w: () => ({ body: MATS.jade() }), b: () => ({ body: MATS.onyx() }) },
    'gold-silver': { name: 'Gold & Platinum', shape: 'regency', era: 'The trophy cabinet', year: 'Champions only',
      story: 'Made for a champion\'s trophy cabinet: polished gold against cool platinum, each trimmed with the other.',
      w: () => ({ body: MATS.nickel(), trim: MAT.gold('#f0c35a') }), b: () => ({ body: MAT.gold('#e0b050'), trim: MATS.nickel() }) },
    'ruby-chocolate': { name: 'Ruby Chocolate', shape: 'staunton', era: 'The newest chocolate', year: '2017',
      story: 'Ruby chocolate is real: a pink chocolate made from ruby cocoa beans, first shown to the world in 2017. Here it faces the darkest bittersweet.',
      w: () => ({ body: choc('ruby', '#e7a3ae', '#ffd6de') }), b: () => ({ body: choc('dark', '#2a120a') }) },
    'milk-dark': { name: 'Milk & Dark', shape: 'staunton', era: 'Cocoa Harvest', year: 'Season 1',
      story: 'Milk chocolate against dark, as glossy as a freshly tempered bar. The top prize of the Cocoa Harvest season track.',
      w: () => ({ body: choc('milk', '#b9784a') }), b: () => ({ body: choc('dark', '#2a120a') }) },
    'caramel-cream': { name: 'Caramel & Cream', shape: 'regency', era: 'Cocoa Harvest', year: 'Season 1',
      story: 'Golden caramel and fresh cream, with crowns and manes in gold leaf. A Season Pass reward from the Cocoa Harvest.',
      w: () => ({ body: lacquer('cream', '#f4ead6', { sheen: 0.3, sheenColor: new THREE.Color('#fff6e0') }), trim: MAT.goldLeaf() }), b: () => ({ body: choc('caramel', '#a9601e', '#ffd28a'), trim: MAT.goldLeaf() }) },
  };
  for (const [id, c] of Object.entries(COLOURWAYS)) {
    const base = SETS[c.shape];
    SETS[id] = { id, name: c.name, era: c.era, year: c.year, story: c.story, lore: base.lore, pieces: base.pieces, shape: c.shape, mats: (side) => (side === 'w' ? c.w() : c.b()) };
  }

  // ------------------------------------------------------------------ building and caching
  const geomCache = new Map();
  function geometry(setId, type) {
    const set = SETS[setId] || SETS.regency;
    const shape = set.shape || set.id;
    const key = shape + type + Q.segs;
    if (!geomCache.has(key)) {
      const t0 = performance.now();
      geomCache.set(key, SETS[shape].pieces[type]({ Q }).geoms());
      if (typeof window !== 'undefined' && window.__PIECE_TIMES) window.__PIECE_TIMES.push([shape, type, Math.round(performance.now() - t0)]);
    }
    return geomCache.get(key);
  }
  // A ready-to-place group for one piece: meshes share geometry and materials.
  function make(setId, type, side) {
    const set = SETS[setId] || SETS.regency;
    const g = geometry(set.id, type);
    const mats = set.mats(side);
    const grp = new THREE.Group();
    for (const slot of Object.keys(g)) {
      const m = new THREE.Mesh(g[slot], mats[slot] || mats.body);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.slot = slot;
      grp.add(m);
    }
    grp.userData = { set: set.id, type, side };
    return grp;
  }
  function setDetail(level) {
    if (level === 'low') { Q.segs = 48; Q.cell = 0.0075; Q.mane = 0.0055; } else { Q.segs = 96; Q.cell = 0.0052; Q.mane = 0.0042; }
  }
  const HEIGHT = { k: 1.62, q: 1.43, b: 1.24, n: 1.06, r: 0.97, p: 0.72 };
  return { SETS, make, geometry, setDetail, HEIGHT, list: () => Object.keys(SETS).map((k) => SETS[k]) };
}
if (typeof module !== 'undefined') module.exports = ChacklatePieces;
