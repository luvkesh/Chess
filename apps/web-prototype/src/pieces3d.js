// Chackmate piece sets. Every set is modelled here in code: lathe profiles with flutes,
// swirls and lobes, cast ornaments (crosses, leaves, pearls), and sculpted horse heads
// with flowing manes. Sets keep the Staunton cues so a piece is never mistaken: the king
// is tallest and wears a cross, the queen a pointed coronet, the bishop a slit mitre,
// the knight a horse head, the rook battlements, the pawn a round head.
function ChacklatePieces(THREE, K) {
  'use strict';
  const { DETAIL, TAU, clamp, mix, smooth, profile, revolve, MOD, mods, SD, spline, strand, strandField, sdfGeometry, beadRing, ring, extrude, merge, MAT, TEX, alongProfile, rng } = K;
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
  // Every set crowns its king with its own cross, centred where the arms meet like crossPattee.
  //   greek: equal square arms; latin: plain with a long foot; botonny: arms ending in three
  //   lobes; fleury: arms ending in lilies; orthodox: three bars, the lowest slanted;
  //   maltese: eight points; stepped: Art Deco setbacks; beaded: glass beads.
  function crossOf(style, h, depth) {
    const a = h / 2, t = a * 0.2;
    const bar = (x0, y0, x1, y1, w) => { const g = new THREE.BoxGeometry(Math.abs(x1 - x0) || w, Math.abs(y1 - y0) || w, depth); g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0); return g; };
    const lobes = (x, y, r, dirX, dirY) => [sphere(r, x + dirX * r * 0.9, y + dirY * r * 0.9, 0, 14), sphere(r * 0.8, x + dirY * r * 1.2 + dirX * r * 0.1, y + dirX * r * 1.2 + dirY * r * 0.1, 0, 12), sphere(r * 0.8, x - dirY * r * 1.2 + dirX * r * 0.1, y - dirX * r * 1.2 + dirY * r * 0.1, 0, 12)];
    if (style === 'greek') return extrude(K.mirrorOutline([[0, a * 0.95], [t, a * 0.95], [t, t], [a * 0.95, t], [a * 0.95, -t], [t, -t], [t, -a * 0.95], [0, -a * 0.95]]), depth, depth * 0.3, { bevelSegments: 2 });
    if (style === 'latin') {
      const w = t * 0.8;
      return merge([extrude(K.mirrorOutline([[0, a], [w, a], [w, w], [a * 0.72, w], [a * 0.72, -w], [w, -w], [w, -a * 1.5], [0, -a * 1.5]]), depth, depth * 0.3, { bevelSegments: 2 }),
        sphere(w * 1.5, 0, a + w * 0.9, 0, 14), sphere(w * 1.3, a * 0.72 + w, 0, 0, 12), sphere(w * 1.3, -a * 0.72 - w, 0, 0, 12)]);
    }
    if (style === 'botonny') {
      const w = t * 0.75, r = w * 1.25;
      return merge([bar(0, -a * 1.2, 0, a * 0.8, w * 2), bar(-a * 0.75, 0, a * 0.75, 0, w * 2)].concat(lobes(0, a * 0.8, r, 0, 1), lobes(a * 0.75, 0, r, 1, 0), lobes(-a * 0.75, 0, r, -1, 0)));
    }
    if (style === 'fleury') {
      const w = t * 0.7, parts = [bar(0, -a * 1.15, 0, a * 0.62, w * 2), bar(-a * 0.62, 0, a * 0.62, 0, w * 2)];
      [[0, a * 0.62, 0], [a * 0.62, 0, -Math.PI / 2], [-a * 0.62, 0, Math.PI / 2]].forEach(([x, y, rz]) => { const f = fleur(a * 0.7, depth * 0.9); f.translate(0, a * 0.3, 0); f.rotateZ(rz); f.translate(x, y, 0); parts.push(f); });
      return merge(parts);
    }
    if (style === 'orthodox') {
      const w = t * 0.6;
      const slant = bar(-a * 0.5, 0, a * 0.5, 0, w * 1.8); slant.rotateZ(-0.38); slant.translate(0, -a * 0.75, 0);
      return merge([bar(0, -a * 1.3, 0, a * 1.05, w * 2), bar(-a * 0.36, a * 0.72, a * 0.36, a * 0.72, w * 1.6), bar(-a * 0.82, a * 0.1, a * 0.82, a * 0.1, w * 2), slant]);
    }
    if (style === 'maltese') {
      const arm = [[0, a * 0.12], [a * 0.36, a], [a * 0.12, a * 0.84], [0, a * 0.98], [-a * 0.12, a * 0.84], [-a * 0.36, a], [0, a * 0.12]];
      const parts = [];
      for (let i = 0; i < 4; i++) { const g = extrude(arm.slice(0, -1).map(([x, y]) => [x, y]), depth, depth * 0.3, { bevelSegments: 2 }); g.rotateZ((i * Math.PI) / 2); parts.push(g); }
      return merge(parts);
    }
    if (style === 'stepped') {
      const w = t * 0.6;
      return extrude(K.mirrorOutline([[0, a * 1.05], [w, a * 1.05], [w, a * 0.7], [w * 1.8, a * 0.7], [w * 1.8, w * 1.8], [a * 0.7, w * 1.8], [a * 0.7, w], [a * 0.95, w], [a * 0.95, -w], [a * 0.7, -w], [a * 0.7, -w * 1.8],
        [w * 1.8, -w * 1.8], [w * 1.8, -a * 0.9], [w, -a * 0.9], [w, -a * 1.25], [0, -a * 1.25]]), depth, depth * 0.25, { bevelSegments: 2 });
    }
    if (style === 'beaded') {
      const r = a * 0.2, parts = [sphere(r * 1.2, 0, 0, 0, 16)];
      for (const [dx, dy, n] of [[0, 1, 3], [1, 0, 2], [-1, 0, 2], [0, -1, 3]]) for (let i = 1; i <= n; i++) { const k = 1 - i * 0.12; parts.push(sphere(r * k, dx * i * r * 1.9, dy * i * r * 1.9, 0, 14)); }
      return merge(parts);
    }
    if (style === 'plain') { const w = t * 0.5; return merge([bar(0, -a * 1.3, 0, a, w * 2), bar(-a * 0.62, 0, a * 0.62, 0, w * 2)]); }
    if (style === 'crosslet') {
      const w = t * 0.6, parts = [bar(0, -a * 1.2, 0, a, w * 2), bar(-a * 0.8, 0, a * 0.8, 0, w * 2)];
      parts.push(bar(-a * 0.3, a * 0.68, a * 0.3, a * 0.68, w * 1.8), bar(a * 0.55, -a * 0.3, a * 0.55, a * 0.3, w * 1.8), bar(-a * 0.55, -a * 0.3, -a * 0.55, a * 0.3, w * 1.8));
      return merge(parts);
    }
    if (style === 'celtic') {
      const w = t * 0.6, torus = new THREE.TorusGeometry(a * 0.5, w * 0.7, 8, 40);
      return merge([bar(0, -a * 1.3, 0, a, w * 2), bar(-a * 0.85, 0, a * 0.85, 0, w * 2), torus]);
    }
    if (style === 'capsule') {
      const r = t * 0.8, v = new THREE.CapsuleGeometry(r, a * 2.1, 6, 12), hz = new THREE.CapsuleGeometry(r, a * 1.4, 6, 12);
      v.translate(0, -a * 0.15, 0); hz.rotateZ(Math.PI / 2);
      return merge([v, hz]);
    }
    if (style === 'leaf') {
      const parts = [];
      [[0, 1], [Math.PI / 2, 0.85], [-Math.PI / 2, 0.85], [Math.PI, 1.2]].forEach(([rz, k]) => { const g = curl(leaf(a * 0.5 * k, a * k, depth), 1.5); g.rotateZ(rz); parts.push(g); });
      parts.push(sphere(t * 0.9, 0, 0, 0, 12));
      return merge(parts);
    }
    if (style === 'pearled') {
      // a slim Greek cross with a pearl at the end of each arm and one at the crossing
      const w = t * 0.6;
      return merge([bar(0, -a * 1.1, 0, a * 0.8, w * 2), bar(-a * 0.7, 0, a * 0.7, 0, w * 2), sphere(t * 1.05, 0, a * 0.8 + t * 0.7, 0, 14),
        sphere(t * 0.9, a * 0.7 + t * 0.6, 0, 0, 12), sphere(t * 0.9, -a * 0.7 - t * 0.6, 0, 0, 12), sphere(t * 0.95, 0, 0, depth * 0.4, 12)]);
    }
    if (style === 'orbit') {
      // a five-pointed star circled by a tilted orbit, for the space set
      const pts = []; for (let i = 0; i < 10; i++) { const r = i % 2 ? t * 0.85 : a * 0.95, an = (i / 10) * Math.PI * 2; pts.push([Math.sin(an) * r, Math.cos(an) * r]); }
      const orbitRing = new THREE.TorusGeometry(a * 0.95, t * 0.22, 6, 40); orbitRing.rotateX(1.2); orbitRing.rotateZ(0.5);
      return merge([extrude(pts, depth, depth * 0.35, { bevelSegments: 2 }), orbitRing]);
    }
    if (style === 'star4') {
      const pts = [[0, a], [t * 0.7, t * 0.7], [a * 0.8, 0], [t * 0.7, -t * 0.7], [0, -a * 1.2], [-t * 0.7, -t * 0.7], [-a * 0.8, 0], [-t * 0.7, t * 0.7]];
      return merge([extrude(pts, depth, depth * 0.35, { bevelSegments: 2 }), sphere(t * 0.8, 0, 0, 0, 12)]);
    }
    if (style === 'lozenge') {
      const parts = [];
      [[0, a, 1], [a * 0.75, 0, 0.75], [-a * 0.75, 0, 0.75], [0, -a * 1.15, 1.15]].forEach(([x, y, k]) => {
        const l = a * 0.62 * k, g = extrude([[0, l], [t * 0.9, 0], [0, -l * 0.35], [-t * 0.9, 0]], depth, depth * 0.3, { bevelSegments: 1 });
        g.rotateZ(Math.atan2(-x, y)); g.translate(x * 0.45, y * 0.45, 0); parts.push(g);
      });
      return merge(parts);
    }
    if (style === 'rayed') {
      const parts = [crossOf('greek', h * 0.9, depth)];
      for (let i = 0; i < 4; i++) { const g = ray(t * 0.7, a * 0.75, depth * 0.6); g.rotateZ(Math.PI / 4 + (i * Math.PI) / 2); parts.push(g); }
      return merge(parts);
    }
    if (style === 'quatrefoil') {
      const w = t * 0.55, parts = [bar(0, -a * 1.1, 0, a * 0.7, w * 2), bar(-a * 0.7, 0, a * 0.7, 0, w * 2)];
      for (const [x, y] of [[0, a * 0.75], [a * 0.72, 0], [-a * 0.72, 0], [0, -a * 1.05]]) { const d = new THREE.CylinderGeometry(t * 1.1, t * 1.1, depth, 20); d.rotateX(Math.PI / 2); d.translate(x, y, 0); parts.push(d); }
      return merge(parts);
    }
    if (style === 'scroll') {
      const w = t * 0.55, parts = [bar(0, -a * 1.2, 0, a * 0.7, w * 2), bar(-a * 0.7, 0, a * 0.7, 0, w * 2)];
      [[0, a * 0.7, 0], [a * 0.7, 0, -Math.PI / 2], [-a * 0.7, 0, Math.PI / 2]].forEach(([x, y, rz]) => { for (const d of [-1, 1]) { const v = volute(a * 0.22, d); v.translate(d * a * 0.2, a * 0.12, 0); v.rotateZ(rz); v.translate(x, y, 0); parts.push(v); } });
      return merge(parts);
    }
    return crossPattee(h, depth);
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
  //   o.mane: 'flow' (loose gold locks), 'carved' (locks in the body), 'roach' (short upright),
  //   'braid' (a row of knots), 'none'; o.form: the breed and pose (see horseWarp)
  //   o.base: pedestal top; o.round: edge band of the inflation (bigger is softer)
  // Most sets bend the same sculpt (see horseWarp), so the sculpt before bending is kept and
  // only copied and bent for each set; so are the outline fields it is carved from.
  const sculptCache = new Map(), outlineCache = new Map();
  function sculptHorse(o) {
    o = Object.assign({ base: 0.3, mane: 'flow', seed: 3, round: 0.088 }, o || {});
    const facet = (o.form && o.form.facet) || 0;
    const key = JSON.stringify(Object.assign({}, o, { form: facet })) + Q.cell + Q.mane + JSON.stringify(DETAIL);
    if (!sculptCache.has(key)) sculptCache.set(key, sculptPlain(o, facet));
    const plain = sculptCache.get(key);
    if (!o.form) return plain;
    const out = { body: plain.body && plain.body.clone(), mane: plain.mane && plain.mane.clone(), surf: plain.surf, Y: plain.Y };
    const w = horseWarp(o.form, out.Y);
    for (const k of ['body', 'mane']) {
      let g = out[k];
      if (!g) continue;
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) { const q = w(p.getX(i), p.getY(i), p.getZ(i)); p.setXYZ(i, q[0], q[1], q[2]); }
      // a cut-stone horse (Deco, crystal): flat facets instead of a smooth sculpt
      if (facet && k === 'body') g = out[k] = g.toNonIndexed();
      g.computeVertexNormals(); g.computeBoundingSphere();
    }
    out.surf = (c, d, off) => w(...plain.surf(c, d, off));
    return out;
  }
  function sculptPlain(o, facet) {
    const dy = o.base - 0.3, Y = (y) => y + dy;
    const box = [-0.24, Y(0.22), 0.38, Y(1.02)];
    const okey = JSON.stringify([o.base, o.sil || 0, o.widths || 0]);
    if (!outlineCache.has(okey)) {
      const sil = K.closedCurve((o.sil || HORSE_SIL).map(([z, y]) => [z, Y(y)]), 6);
      outlineCache.set(okey, {
        d2: K.field2(sil, box, 0.0025),
        hwF: bake2(K.blendMap((o.widths || HORSE_W).map(([z, y, w]) => [z, Y(y), w]), 0.07), box, 0.005),
      });
    }
    const { d2, hwF } = outlineCache.get(okey);
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
      const flow = o.mane === 'flow', braid = o.mane === 'braid', n = flow ? 13 : braid ? 9 : 12;
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1), [cz, cy] = crest(t), [nz, ny] = crest(Math.min(1, t + 0.08));
        let tz = nz - cz, ty = ny - cy; const tl = Math.hypot(tz, ty) || 1; tz /= tl; ty /= tl;   // down the crest
        const layers = flow ? [[-1, 1], [1, 1], [0, 0.45]] : braid ? [[0, 1]] : [[-1, 1], [1, 1]];
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
          const ctrl = braid
            ? [[...p0, 0.024], [...P(0.5, 0.012, 0), 0.026], [...P(1, 0.016, 0), 0.012]]
            : o.mane === 'roach'
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
    if (o.mane === 'carved' || o.mane === 'roach' || o.mane === 'braid') {
      const fieldM = strandField([].concat(...locks), 0.01, 0.03, 0.016);
      out.body = sdfGeometry((x, y, z) => SD.smin(body(x, y, z), fieldM(x, y, z), 0.008), bounds, facet ? Math.max(Q.cell, facet) : Q.cell);
    } else {
      out.body = sdfGeometry(body, bounds, facet ? Math.max(Q.cell, facet) : Q.cell);
      if (locks.length) {
        const fieldM = strandField([].concat(...locks), 0.02, 0.03, 0.016);
        out.mane = sdfGeometry(fieldM, [-0.16, Y(0.36), -0.36, 0.16, Y(1.02), 0.11], Q.mane, { band: 1.3 });
      }
    }
    return out;
  }
  // Each set has its own horse. The sculpt is shared, then bent into a breed and a pose:
  //   tuck: head bowed (+) or raised (-), in radians; reach: a longer (+) or shorter muzzle;
  //   nose: a Roman (+) or dished (-) profile; neck: a taller (+) or shorter bust;
  //   girth: width across; chest: a deeper chest; lean: the whole bust leaning forward;
  //   ears: longer (+) or shorter (-) ears; jaw: a heavier jowl.
  function horseWarp(f, Y) {
    const tuck = f.tuck || 0, reach = f.reach || 0, nose = f.nose || 0, neck = f.neck || 0, girth = f.girth || 1;
    const chest = f.chest || 0, lean = f.lean || 0, ears = f.ears || 0, jaw = f.jaw || 0, y0 = Y(0.3);
    return (x, y, z) => {
      if (ears && y > Y(0.95) && z < 0.08) y = Y(0.95) + (y - Y(0.95)) * (1 + ears);
      if (nose && z > 0.08) y += nose * Math.exp(-Math.pow((z - 0.2) / 0.075, 2)) * smooth(Y(0.74), Y(0.82), y);
      if (jaw && z > -0.02 && z < 0.2) y -= jaw * Math.exp(-Math.pow((z - 0.06) / 0.07, 2)) * (1 - smooth(Y(0.72), Y(0.8), y)) * smooth(Y(0.62), Y(0.7), y);
      if (reach && z > 0.06) z = 0.06 + (z - 0.06) * (1 + reach * smooth(Y(0.62), Y(0.72), y));
      if (chest && z > 0) z *= 1 + chest * (1 - smooth(Y(0.5), Y(0.7), y)) * smooth(y0 - 0.02, y0 + 0.08, y);
      if (tuck) {
        const a = tuck * smooth(Y(0.6), Y(0.86), y), dz = z + 0.02, dy = y - Y(0.74), c = Math.cos(a), s = Math.sin(a);
        z = -0.02 + dz * c + dy * s; y = Y(0.74) - dz * s + dy * c;
      }
      if (lean) z += lean * Math.max(0, y - y0);
      x *= girth * (1 + (f.headW ? (f.headW - 1) * smooth(Y(0.66), Y(0.8), y) : 0));
      if (neck) y = y0 + Math.max(0, y - y0) * (1 + neck) + Math.min(0, y - y0);
      return [x, y, z];
    };
  }

  // The horse is the slowest part to build, and sets share a few variants: cache by options.
  const horseCache = new Map();
  function horse(o) {
    const key = JSON.stringify(o || {}) + Q.cell + Q.mane + JSON.stringify(DETAIL);
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
  // An oval head (an egg when ry > rx) on a neck of radius rNeck; tip > 0 draws it up into a bud.
  function ovalHead(prof, rNeck, cy, rx, ry, tip) {
    const a0 = Math.asin(clamp(rNeck / rx, -1, 1)), pts = [];
    for (let i = 0; i <= 40; i++) {
      const a = mix(a0, Math.PI, i / 40), c = -Math.cos(a);
      pts.push([Math.sin(a) * rx * (tip ? 1 - tip * 0.35 * Math.max(0, c) ** 2 : 1), cy + c * ry + (tip || 0) * ry * Math.max(0, c) ** 3]);
    }
    prof.line(pts[0][0], pts[0][1], true);
    prof._push(pts.slice(1), true);
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
      const h = horse({ base: 0.31, mane: 'flow', seed: 5, form: { tuck: 0.1, neck: 0.03, chest: 0.06 } });
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
  // Figures from a pharaoh's tomb in alabaster and basalt: the pharaoh with his ankh staff, his
  // queen under the sun disc, a jackal guardian, crystals held up on falcon wings, temple towers
  // with fire burning on top and spearmen with ankh shields. Every piece stands on a gold drum
  // set with lapis and a gem, and wears a collar of gold, lapis and carnelian.
  // Splits a mesh into stripes across y, for the striped nemes headcloth: [even, odd].
  function stripes(g, period, y0) {
    g = g.index ? g.toNonIndexed() : g;
    if (!g.attributes.normal) g.computeVertexNormals();
    const p = g.attributes.position.array, n = g.attributes.normal.array, out = [[[], []], [[], []]];
    for (let i = 0; i < p.length; i += 9) {
      const cy = (p[i + 1] + p[i + 4] + p[i + 7]) / 3, k = Math.floor((cy - y0) / period) & 1;
      for (let j = 0; j < 9; j++) { out[k][0].push(p[i + j]); out[k][1].push(n[i + j]); }
    }
    return out.map(([pp, nn]) => {
      const r = new THREE.BufferGeometry();
      r.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); r.setAttribute('normal', new THREE.Float32BufferAttribute(nn, 3));
      return pp.length ? r : null;
    });
  }
  function templeBase(P, R, h) {
    P.lathe('trim', profile(0, 0).line(R - 0.01, 0).arc(R, 0.012, 0.3).line(R, 0.032).line(R - 0.012, 0.036).line(R - 0.012, h - 0.04).line(R - 0.004, h - 0.036)
      .line(R - 0.004, h - 0.02).line(R - 0.03, h - 0.016).line(R - 0.03, h).line(0, h));
    P.add('accent', new THREE.CylinderGeometry(R - 0.009, R - 0.009, h - 0.09, Math.round(Q.segs * DETAIL.around), 1, true).translate(0, (h - 0.004) / 2 + 0.002, 0));
    P.add('trim', beadRing(R - 0.008, 0.044, Math.round(R * 110), 0.005)); P.add('trim', beadRing(R - 0.008, h - 0.046, Math.round(R * 110), 0.005));
    P.add('gem', around(4, R - 0.006, h / 2 - 0.002, () => { const d = brilliant(0.02); d.rotateZ(Math.PI / 4); return d; }));
    P.add('trim', around(8, R - 0.007, h / 2 - 0.002, () => rbox(0.008, h - 0.1, 0.006, 0.002), { phase: Math.PI / 8 }));
    return h;
  }
  // the broad collar: a flat ring of gold, lapis and carnelian round a neck of radius r at y
  function usekh(P, r, y, w, tilt) {
    w = w || 0.06; tilt = tilt === undefined ? 0.35 : tilt;
    const band = (r0, r1, dy) => revolve(profile(r0, y + dy).line(r1, y + dy - (r1 - r0) * tilt).line(r1, y + dy - (r1 - r0) * tilt - 0.008).line(r0, y + dy - 0.008), { segs: Q.segs });
    P.add('trim', band(r, r + w * 0.34, 0)); P.add('accent', band(r + w * 0.3, r + w * 0.68, -w * 0.3 * tilt)); P.add('trim', band(r + w * 0.64, r + w, -w * 0.64 * tilt));
    P.add('accent2', around(Math.round((r + w) * 160), r + w + 0.004, y - w * tilt - 0.008, () => sphere(0.0062, 0, 0, 0, 8)));
  }
  // the nemes headcloth over a head at c of radius r: a cap that flares behind the cheeks and
  // falls in two lappets on the chest, in gold and lapis stripes, with a cobra at the brow
  function nemes(P, c, r, o) {
    o = o || {};
    const S = new Sculpt(0.014);
    S.ell([c[0], c[1] + r * 0.28, c[2] - r * 0.1], [r * 1.08, r * 0.86, r * 1.06], 0.02);
    S.pair((x) => S.cone([c[0] + x * r * 0.95, c[1] + r * 0.2, c[2] - r * 0.25], [c[0] + x * r * 1.3, c[1] - r * 1.25, c[2] - r * 0.1], r * 0.4, r * 0.5, 0.03));
    S.pair((x) => S.cone([c[0] + x * r * 1.2, c[1] - r * 1.0, c[2] - r * 0.05], [c[0] + x * r * 1.05, c[1] - r * 2.2, c[2] + r * 0.35], r * 0.3, r * 0.32, 0.02));
    S.cone([c[0], c[1] + r * 0.2, c[2] - r * 0.6], [c[0], c[1] - r * 1.4, c[2] - r * 0.9], r * 0.7, r * 0.45, 0.03);
    S._push((x, y, z) => SD.ellipsoid(x, y, z, c[0], c[1] - r * 0.35, c[2] + r * 0.5, r * 0.8, r * 0.88, r * 0.8), c[0], c[1] - r * 0.35, c[2] + r * 0.5, r * 0.9, 0.01, true);   // the face shows through
    const [a, b] = stripes(S.mesh(Q.cell * (o.fine || 0.8)), r * 0.24, c[1]);
    P.add('trim', a); P.add('accent', b);
    P.add('trim', ring(r * 1.04, c[1] + r * 0.4, r * 0.08).translate(0, 0, -r * 0.08));
    // the uraeus: a rearing cobra at the brow
    P.add('trim', K.tube([[c[0], c[1] + r * 0.4, c[2] + r * 0.9], [c[0], c[1] + r * 0.62, c[2] + r * 1.02], [c[0], c[1] + r * 0.82, c[2] + r * 0.98]], r * 0.09, { segs: 12, radial: 6 }));
    P.add('gem', sphere(r * 0.12, c[0], c[1] + r * 0.88, c[2] + r * 1.0, 10));
  }
  function egyptFlame(P, y, r) {
    const parts = [];
    for (let i = 0; i < 7; i++) {
      const th = i * 2.4, rr = i ? r * 0.55 : 0, h = (i ? 0.1 : 0.16) * (r / 0.1);
      const f = new THREE.ConeGeometry(r * (i ? 0.3 : 0.45), h, 8); f.translate(Math.sin(th) * rr, y + h / 2, Math.cos(th) * rr);
      parts.push(f);
    }
    P.add('flame', merge(parts));
    P.add('flame2', sphere(r * 0.6, 0, y + 0.02, 0, 12).scale(1, 0.6, 1));
  }
  const EGYPT = {
    k() {
      // the pharaoh, in the nemes and a pleated kilt, holding a tall staff crowned with an ankh
      const P = new Piece(), y0 = templeBase(P, 0.35, 0.13), s = 1.12, A = at([0, y0, 0], s);
      P.lathe('body', profile(0, y0).line(0.155 * s, y0).curve([[0.15 * s, y0 + 0.1 * s], [0.12 * s, y0 + 0.3 * s], [0.088 * s, y0 + 0.47 * s]]).line(0.085 * s, y0 + 0.5 * s).line(0, y0 + 0.5 * s),
        { mod: MOD.flutes(26, 0.1, y0 + 0.01, y0 + 0.44 * s, { soft: true, end: 0.03 }) });
      const skin = new Sculpt(0.018, 1.1);
      skin.floor = y0 + 0.4 * s;
      skin.ell(A(0, 0.57, 0.004), [0.095 * s, 0.12 * s, 0.07 * s], 0.035);
      skin.pair((x) => skin.ell(A(x * 0.09, 0.67, 0), [0.046 * s, 0.042 * s, 0.046 * s], 0.03));
      skin.cone(A(0, 0.69, 0), A(0, 0.76, 0.004), 0.034 * s, 0.031 * s, 0.01);
      const hd = head(skin, A(0, 0.83, 0.008), 0.062 * s);
      arm(skin, skin, A(-0.1, 0.66, 0), A(-0.16, 0.56, 0.03), A(-0.15, 0.6, 0.1), 0.027 * s);     // staff hand
      arm(skin, skin, A(0.1, 0.66, 0), A(0.12, 0.55, 0.06), A(0.02, 0.6, 0.08), 0.027 * s);       // hand on his heart
      P.add('body', skin.mesh()); eyes(P, hd);
      P.add('trim', ring(0.088 * s, y0 + 0.5 * s, 0.014 * s));                                       // belt
      P.add('trim', rbox(0.07 * s, 0.22 * s, 0.014, 0.006, 0, y0 + 0.38 * s, 0.11 * s).rotateX(-0.12));   // the apron of gold
      P.add('accent', merge([0, 1, 2, 3].map((i) => rbox(0.05 * s, 0.012 * s, 0.006, 0.002, 0, y0 + (0.32 + i * 0.04) * s, 0.121 * s))).rotateX(-0.12));
      usekh(P, 0.04 * s, y0 + 0.725 * s, 0.075 * s);
      nemes(P, A(0, 0.83, 0.008), 0.064 * s);
      P.add('accent', cyl(0.012 * s, 0.009 * s, 0.07 * s, 0, y0 + 0.745 * s, 0.05 * s, 10));        // the royal beard
      const t = A(-0.15, 0.6, 0.1);
      P.add('trim', cyl(0.009 * s, 0.009 * s, 0.86 * s, t[0], y0 + 0.43 * s, t[2], 10));
      P.add('trim', placeAt(ankh(0.26 * s, 0.03), 0, 0, y0 + 0.86 * s).translate(t[0], 0, t[2]));
      P.add('gem', sphere(0.016 * s, t[0], y0 + 0.86 * s + 0.13 * s * 0.5, t[2] + 0.02, 10));
      return turnPiece(P, 0.35);
    },
    q() {
      // the queen in a pleated gown, a lapis wig, and the sun disc between golden horns
      const P = new Piece(), y0 = templeBase(P, 0.335, 0.13), s = 1.08, A = at([0, y0, 0], s);
      P.lathe('body', profile(0, y0).line(0.15 * s, y0).curve([[0.14 * s, y0 + 0.12 * s], [0.095 * s, y0 + 0.32 * s], [0.06 * s, y0 + 0.5 * s]]).line(0, y0 + 0.5 * s),
        { mod: MOD.flutes(22, 0.12, y0 + 0.01, y0 + 0.46 * s, { soft: true, end: 0.03 }) });
      const skin = new Sculpt(0.016, 1.05), wig = new Sculpt(0.016, 1.05);
      skin.floor = y0 + 0.4 * s;
      skin.ell(A(0, 0.55, 0.004), [0.06 * s, 0.1 * s, 0.046 * s], 0.03);
      skin.pair((x) => skin.ell(A(x * 0.066, 0.62, 0), [0.03 * s, 0.028 * s, 0.03 * s], 0.025));
      skin.cone(A(0, 0.63, 0.004), A(0, 0.69, 0.008), 0.024 * s, 0.022 * s, 0.01);
      const c = A(0, 0.745, 0.012), hd = head(skin, c, 0.055 * s);
      arm(skin, skin, A(-0.066, 0.61, 0), A(-0.09, 0.51, 0.03), A(-0.07, 0.43, 0.07), 0.019 * s);
      arm(skin, skin, A(0.066, 0.61, 0), A(0.09, 0.52, 0.04), A(0.02, 0.57, 0.075), 0.019 * s);
      wig.ell([c[0], c[1] + 0.02 * s, c[2] - 0.012 * s], [0.066 * s, 0.062 * s, 0.064 * s], 0.012);
      wig.pair((x) => wig.cone([c[0] + x * 0.05 * s, c[1], c[2] - 0.01 * s], [c[0] + x * 0.058 * s, c[1] - 0.11 * s, c[2] + 0.0], 0.03 * s, 0.032 * s, 0.02));
      wig.cone([c[0], c[1], c[2] - 0.04 * s], [c[0], c[1] - 0.12 * s, c[2] - 0.05 * s], 0.05 * s, 0.05 * s, 0.02);
      wig._push((x, y, z) => SD.ellipsoid(x, y, z, c[0], c[1] - 0.012 * s, c[2] + 0.02 * s, 0.046 * s, 0.058 * s, 0.05 * s), c[0], c[1], c[2] + 0.02 * s, 0.06 * s, 0.01, true);
      P.add('body', skin.mesh()); P.add('hair', wig.mesh()); eyes(P, hd);
      usekh(P, 0.03 * s, y0 + 0.66 * s, 0.06 * s);
      P.add('trim', ring(0.065 * s, y0 + 0.5 * s, 0.01 * s));
      P.add('accent2', placeAt(cabochon(0.014 * s, 0.6), 0, 0.068 * s, y0 + 0.5 * s));
      // the crown: a band with a cobra, a modius, and the sun between two horns
      P.add('trim', ring(0.064 * s, c[1] + 0.035 * s, 0.009 * s).translate(0, 0, -0.012 * s));
      P.add('trim', K.tube([[c[0], c[1] + 0.035 * s, c[2] + 0.05 * s], [c[0], c[1] + 0.06 * s, c[2] + 0.062 * s], [c[0], c[1] + 0.075 * s, c[2] + 0.056 * s]], 0.005 * s, { segs: 10, radial: 6 }));
      const my = c[1] + 0.06 * s;
      P.lathe('trim', profile(0, my).line(0.045 * s, my).line(0.05 * s, my + 0.05 * s).line(0, my + 0.05 * s), { mod: MOD.flutes(12, 0.12, my + 0.005, my + 0.045 * s) });
      for (const x of [-1, 1]) P.add('trim', K.tube([[x * 0.012 * s, my + 0.05 * s, 0], [x * 0.06 * s, my + 0.08 * s, 0], [x * 0.08 * s, my + 0.15 * s, 0], [x * 0.065 * s, my + 0.22 * s, 0], [x * 0.042 * s, my + 0.245 * s, 0]], 0.011 * s, { segs: 30, radial: 8, radiusAt: (t) => mix(1, 0.3, t) }));
      const disc = new THREE.CylinderGeometry(0.055 * s, 0.055 * s, 0.018 * s, 40); disc.rotateX(Math.PI / 2); disc.translate(0, my + 0.15 * s, 0);
      P.add('accent2', disc);
      P.add('trim', ring(0.055 * s, 0, 0.005 * s, { seg: 48 }).rotateX(Math.PI / 2).translate(0, my + 0.15 * s, 0.002));
      return turnPiece(P, -0.35);
    },
    b() {
      // a great crystal held up on a falcon's golden wings, on a slim column with a collar
      const P = new Piece(), y0 = templeBase(P, 0.312, 0.12);
      P.lathe('body', profile(0, y0).line(0.13, y0).curve([[0.11, y0 + 0.05], [0.085, y0 + 0.2], [0.07, y0 + 0.42]]).line(0.068, y0 + 0.5).line(0, y0 + 0.5), { mod: MOD.facets(8, y0 + 0.02, y0 + 0.5, 0.2) });
      for (const y of [y0 + 0.03, y0 + 0.2, y0 + 0.38]) P.add('trim', ring(mix(0.12, 0.072, (y - y0) / 0.42), y, 0.008));
      P.add('trim', placeAt(ankh(0.12, 0.012), 0, 0.094, y0 + 0.24));
      usekh(P, 0.066, y0 + 0.5, 0.05, 0.6);
      const cy = y0 + 0.5;
      P.lathe('trim', profile(0, cy).line(0.06, cy).curve([[0.07, cy + 0.03], [0.1, cy + 0.07]]).line(0.092, cy + 0.08).line(0, cy + 0.05));
      // the wings: feathers fanned up and out on both sides
      for (const x of [-1, 1]) {
        const fs = [];
        for (let i = 0; i < 7; i++) {
          const t = i / 6, len = mix(0.13, 0.26, Math.sin(t * Math.PI * 0.8 + 0.3)), f = petal(0.05, len, 0.01);
          f.rotateZ(-x * mix(0.15, 1.3, t)); f.translate(x * (0.05 + t * 0.03), cy + 0.05 + t * 0.02, -0.01 - t * 0.008); fs.push(f);
        }
        P.add('trim', merge(fs));
      }
      // the crystal: a long eight-sided gem that glows from inside
      const pts = [[0, -0.06], [0.06, 0.04], [0.068, 0.11], [0.04, 0.2], [0, 0.27]].map(([r, y]) => new THREE.Vector2(r, y));
      let gem = new THREE.LatheGeometry(pts, 8); gem = gem.toNonIndexed(); gem.computeVertexNormals(); gem.translate(0, cy + 0.15, 0);
      P.add('crystal', gem);
      P.add('trim', ring(0.06, cy + 0.19, 0.008, { seg: 8 }));
      return P;
    },
    n() {
      // a jackal guardian sitting up, ears high, in a striped headcloth and a broad collar
      const P = new Piece(), y0 = templeBase(P, 0.322, 0.12);
      P.lathe('trim', profile(0, y0).line(0.2, y0).line(0.19, y0 + 0.05).line(0, y0 + 0.05));
      const b = y0 + 0.05, S = new Sculpt(0.02, 1.05);
      S.floor = b - 0.004;
      S.ell([0, b + 0.1, -0.06], [0.1, 0.1, 0.13], 0.04);                                        // haunches
      S.pair((x) => S.ell([x * 0.07, b + 0.06, -0.04], [0.04, 0.07, 0.1], 0.03));              // back legs folded
      S.cone([0, b + 0.13, -0.05], [0, b + 0.36, 0.03], 0.1, 0.075, 0.05);                     // body and chest
      S.pair((x) => S.cone([x * 0.045, b + 0.28, 0.06], [x * 0.045, b + 0.02, 0.1], 0.03, 0.024, 0.02));   // front legs
      S.pair((x) => S.ell([x * 0.045, b + 0.015, 0.13], [0.028, 0.016, 0.04], 0.012));           // paws
      S.cone([0, b + 0.36, 0.03], [0, b + 0.52, 0.04], 0.06, 0.048, 0.03);                     // neck
      S.ell([0, b + 0.56, 0.04], [0.055, 0.055, 0.07], 0.03);                                   // head
      S.cone([0, b + 0.55, 0.08], [0, b + 0.52, 0.2], 0.036, 0.016, 0.02);                      // long snout
      S.pair((x) => S.cone([x * 0.03, b + 0.6, 0.02], [x * 0.045, b + 0.74, -0.0], 0.024, 0.004, 0.012));  // tall ears
      S.chain([[0, b + 0.05, -0.17, 0.026], [0.08, b + 0.02, -0.15, 0.02], [0.14, b + 0.02, -0.04, 0.014], [0.15, b + 0.02, 0.06, 0.008]], 0.02, 3);   // tail curled round
      P.add('body', S.mesh());
      P.add('gem', merge([-1, 1].map((x) => sphere(0.011, x * 0.035, b + 0.575, 0.085, 10))));
      P.add('trim', merge([-1, 1].map((x) => { const e = petal(0.024, 0.09, 0.006); e.rotateX(-0.12); e.translate(x * 0.037, b + 0.63, 0.032); return e; })));   // gold inside the ears
      usekh(P, 0.055, b + 0.42, 0.06, 0.7);
      // striped lappets of the headcloth behind the head
      const lap = new Sculpt(0.012);
      lap.pair((x) => lap.cone([x * 0.05, b + 0.58, -0.01], [x * 0.07, b + 0.42, 0.0], 0.024, 0.03, 0.02));
      lap.cone([0, b + 0.6, -0.03], [0, b + 0.44, -0.07], 0.05, 0.04, 0.02);
      const [la, lb] = stripes(lap.mesh(), 0.018, b);
      P.add('trim', la); P.add('accent', lb);
      return turnPiece(P, 0.5);
    },
    r() {
      // a temple tower: a tapering pylon with a cornice and battlements, a figure in gold relief
      // on the front, and fire burning in a bowl on top
      const P = new Piece(), y0 = templeBase(P, 0.33, 0.12), top = y0 + 0.55, keep = DETAIL.around;
      DETAIL.around = 1;
      const tower = revolve(profile(0, y0).line(0.24, y0).line(0.24, y0 + 0.03).line(0.2, y0 + 0.04).line(0.17, top - 0.06).curve([[0.19, top - 0.03], [0.215, top]]).line(0.215, top + 0.02).line(0, top + 0.02),
        { segs: 4, mod: MOD.flutes(4, 0.02, y0 + 0.06, top - 0.07, { end: 0.01, phase: 0.5 }) });
      DETAIL.around = keep;
      const tw = tower.toNonIndexed(); tw.rotateY(Math.PI / 4); tw.computeVertexNormals(); P.add('body', tw);
      // merlons along the four edges of the roof
      const ml = [];
      for (let side = 0; side < 4; side++) for (let i = 0; i < 3; i++) { const m = rbox(0.06, 0.08, 0.05, 0.008, -0.1 + i * 0.1, top + 0.06, 0.125); m.rotateY(side * Math.PI / 2); ml.push(m); }
      P.add('body', merge(ml));
      P.add('trim', merge([0, 1, 2, 3].map((k) => rbox(0.3, 0.018, 0.012, 0.004, 0, top - 0.004, 0.151).rotateY(k * Math.PI / 2))));
      P.add('accent', merge([0, 1, 2, 3].map((k) => rbox(0.25, 0.012, 0.012, 0.004, 0, top - 0.035, 0.136).rotateY(k * Math.PI / 2))));
      // the relief: a figure with a staff, under a band of gold, on each of the four faces
      const fig = [];
      for (let k = 0; k < 4; k++) {
        const g = extrude([[-0.03, 0], [0.03, 0], [0.026, 0.13], [0.04, 0.18], [0.03, 0.24], [0.018, 0.26], [0.02, 0.3], [0, 0.33], [-0.02, 0.3], [-0.018, 0.26], [-0.03, 0.24], [-0.04, 0.18], [-0.026, 0.13]], 0.008, 0.002, { bevelSegments: 1 });
        const st = rbox(0.008, 0.3, 0.008, 0.003, 0.055, 0.15, 0);
        const f = merge([g, st]); f.rotateX(-0.06); f.translate(0, y0 + 0.11, 0.137); f.rotateY(k * Math.PI / 2); fig.push(f);
      }
      P.add('trim', merge(fig));
      P.add('gem', merge([0, 1, 2, 3].map((k) => { const d = brilliant(0.018); d.rotateZ(Math.PI / 4); d.translate(0, top - 0.06, 0.135); d.rotateY(k * Math.PI / 2); return d; })));
      // the fire bowl
      P.lathe('trim', profile(0, top + 0.02).line(0.04, top + 0.02).line(0.05, top + 0.06).curve([[0.1, top + 0.08], [0.115, top + 0.12]]).line(0.1, top + 0.125).line(0, top + 0.1));
      egyptFlame(P, top + 0.09, 0.08);
      return P;
    },
    p() {
      // a spearman in the striped headcloth, with a round shield marked with an ankh
      const P = new Piece(), y0 = templeBase(P, 0.27, 0.1), s = 0.64, A = at([0, y0, 0], s);
      const body = new Sculpt(0.016, 1.1);
      body.floor = y0 - 0.004;
      body.pair((x) => body.cone(A(x * 0.05, 0, 0), A(x * 0.045, 0.3, 0), 0.04 * s, 0.05 * s, 0.02));
      body.ell(A(0, 0.55, 0.01), [0.1 * s, 0.14 * s, 0.07 * s], 0.04);
      body.cone(A(0, 0.69, 0), A(0, 0.75, 0.004), 0.034 * s, 0.032 * s, 0.01);
      const c = A(0, 0.82, 0.008), hd = head(body, c, 0.064 * s);
      arm(body, body, A(0.1, 0.66, 0), A(0.15, 0.55, 0.04), A(0.13, 0.62, 0.1), 0.026 * s);
      arm(body, body, A(-0.1, 0.66, 0), A(-0.15, 0.55, 0.04), A(-0.14, 0.5, 0.1), 0.026 * s);
      P.add('body', body.mesh()); eyes(P, hd);
      // a pleated kilt and a belt
      P.lathe('body', profile(0, y0 + 0.2 * s).line(0.1 * s, y0 + 0.2 * s).line(0.11 * s, y0 + 0.24 * s).line(0.09 * s, y0 + 0.44 * s).line(0, y0 + 0.44 * s), { mod: MOD.flutes(16, 0.12, y0 + 0.21 * s, y0 + 0.42 * s, { end: 0.01 }) });
      P.add('trim', ring(0.09 * s, y0 + 0.44 * s, 0.012 * s));
      usekh(P, 0.035 * s, y0 + 0.69 * s, 0.065 * s);
      nemes(P, c, 0.064 * s, { fine: 0.7 });
      const sh = shield(0.17 * s, 0.03);
      for (const g of [sh.face, sh.rim, sh.boss]) g.translate(-0.1 * s, y0 + 0.5 * s, 0.14 * s);
      P.add('trim', merge([sh.face, sh.rim]));
      P.add('accent', placeAt(ankh(0.15 * s, 0.01), 0, 0, 0).translate(-0.1 * s, y0 + 0.5 * s - 0.075 * s, 0.14 * s + 0.032));
      const sp = spear(0.9 * s, 0.006);
      for (const g of [sp.shaft, sp.head]) g.translate(0.13 * s, y0 + 0.08 * s, 0.1 * s);
      P.add('trim', merge([sp.shaft, sp.head]));
      return turnPiece(P, 0.3);
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
      P.add('trim', placeAt(crossOf('greek', 0.22, 0.046), 0, 0, 1.368));
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
      P.lathe('body', p, { mod: mods([ionic(0.2, 0.55, 16), MOD.facets(4, 0.633, 0.654, 0.2), MOD.flutes(14, 0.06, 0.72, 1.06, { fillet: 0.3, end: 0.05 }), MOD.slit(Math.PI * 0.25, 0.95, 0.6, 0.017, 0.5)]) });
      P.add('trim', plinthKey(R));
      P.add('trim', keyBand(0.116, 0.668, 0.042, 12, 0.0048, 0.012));
      // an anthemion: a bronze palmette fanning up from the tip
      P.add('trim', around(2, 0.0, 1.11, () => merge([-2, -1, 0, 1, 2].map((k) => { const f = petal(0.03, 0.09 - Math.abs(k) * 0.012, 0.008); f.rotateZ(k * 0.32); return f; })), { phase: Math.PI / 2 }));
      P.add('trim', sphere(0.024, 0, 1.118, 0, 16));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(atticBase(profile(0, 0), R, 0.2), 0.2));
      P.add('trim', plinthKey(R));
      const h = horse({ base: 0.31, mane: 'roach', seed: 5, form: { tuck: 0.48, chest: 0.26, girth: 1.08, neck: -0.06, jaw: 0.016, ears: -0.2 } });
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
      P.add('trim', wreath(0.112, 0.548, 12, 0.042, { tilt: -0.5, band: false }));
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
      P.add('trim', placeAt(crossOf('latin', 0.21, 0.045), 0, 0, 1.396));
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
      P.lathe('body', p, { mod: mods([trajan(0.2, 0.54, 2), MOD.facets(4, 0.608, 0.632, 0.2), MOD.helix(0.09, 1.6, 0.74, 1.04, { width: 0.22 }), MOD.slit(Math.PI * 0.25, 0.94, 0.6, 0.017, 0.5)]) });
      P.add('trim', wreath(R - 0.058, 0.152, 18, 0.032));
      P.add('trim', wreath(0.126, 0.7, 12, 0.042));
      // an eagle-topped finial: a gilt ball under a small spread of wings
      P.add('trim', sphere(0.03, 0, 1.124, 0, 20));
      for (const s of [-1, 1]) P.add('trim', placeAt(curl(petal(0.04, 0.08, 0.007).rotateZ(s * 1.0), 1.5), Math.PI / 2, 0, 1.15, {}).translate(s * 0.03, 0, 0));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(atticBase(profile(0, 0), R, 0.2), 0.2));
      P.add('trim', wreath(R - 0.058, 0.152, 20, 0.034));
      const h = horse({ base: 0.31, mane: 'carved', seed: 5, form: { girth: 1.26, nose: 0.032, chest: 0.2, tuck: 0.16, headW: 1.08, jaw: 0.012 } });
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
      const crest = []; for (let i = 0; i <= 12; i++) { const a = mix(-1.25, 1.25, i / 12); crest.push([0, 0.525 + Math.cos(a) * 0.128, Math.sin(a) * 0.128]); }
      P.add('trim', K.tube(crest, 0.016, { segs: 30, radial: 10, radiusAt: (t) => 0.6 + 0.4 * Math.sin(Math.PI * t) }));
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
      P.add('trim', placeAt(crossOf('fleury', 0.21, 0.045), 0, 0, 1.512));
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
        .curve([[0.14, 0.66], [0.174, 0.71], [0.18, 0.77], [0.164, 0.83], [0.12, 0.862]])
        .curve([[0.104, 0.9], [0.09, 0.97], [0.062, 1.03], [0.032, 1.08]])
        .line(0.024, 1.086).line(0, 1.087);
      P.lathe('body', p, { mod: mods([lotusMod(), MOD.lobes(10, 0.16, 0.16, 0.36, { shape: 0.7 }), MOD.flutes(9, 0.14, 0.645, 0.86, { twist: 9, soft: true, end: 0.03 }), MOD.slit(Math.PI * 0.25, 0.96, 0.6, 0.016, 0.45)]) });
      P.add('trim', beadRing(R - 0.004, 0.04, 40, 0.0055));
      P.add('trim', ring(0.12, 0.66, 0.0085));
      // sarpech: a jewelled turban ornament at the front
      P.add('trim', placeAt(curl(petal(0.05, 0.14, 0.008), -2), 0, 0.176, 0.79, { tilt: -0.08 }));
      P.add('accent', placeAt(cabochon(0.018, 0.6), 0, 0.182, 0.79));
      P.add('accent2', placeAt(sphere(0.012, 0, 0, 0, 12), 0, 0.176, 0.75));
      P.add('trim', sphere(0.032, 0, 1.12, 0, 20));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(lotusBase(profile(0, 0), R, 0.2), 0.2), { mod: lotusMod() });
      P.add('trim', beadRing(R - 0.004, 0.04, 40, 0.0058));
      const h = horse({ base: 0.31, mane: 'carved', seed: 5, form: { nose: -0.03, reach: -0.2, tuck: -0.22, neck: 0.08, headW: 0.86, ears: 0.3 } });
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
      P.lathe('trim', profile(0, 0.636).line(0.03, 0.638).curve([[0.032, 0.66], [0.016, 0.676]]).line(0.006, 0.69).arc(0.0, 0.706, 0.6), { segs: 24 });
      P.add('accent', placeAt(cabochon(0.02, 0.6), 0, 0.118, 0.54));
      return P;
    },
  };

  // ------------------------------------------------------------------ Chaturanga (Maharaja's Jade, the old pieces)
  // Chaturanga games use the Mughal jade set, but two pieces move in the old way, so they get
  // their old shapes: the Mantri (counsellor, Q code) is a courtier in a wide turban with a
  // plume, and the Gaja (war elephant, B code) is an elephant under a little domed canopy.
  // Not sold or shown in the Collection: only Chaturanga games stand these on the table.
  const CHATURANGA = Object.assign({}, MUGHAL, {
    q() {
      const R = 0.32, P = new Piece();
      const p = lotusBase(profile(0, 0), R, 0.136);
      p.curve([[0.156, 0.2], [0.168, 0.27], [0.152, 0.35], [0.118, 0.42], [0.1, 0.5], [0.098, 0.56]])
        .line(0.11, 0.57).arc(0.12, 0.588, 0.35)
        // a robed courtier's shoulders under a lotus collar, then the neck
        .curve([[0.15, 0.62], [0.17, 0.66], [0.168, 0.7]]).curve([[0.15, 0.73], [0.1, 0.75], [0.062, 0.758]]).line(0.05, 0.77)
        .line(0, 0.771);
      P.lathe('body', p, { mod: mods([lotusMod(), MOD.lobes(12, 0.16, 0.16, 0.38, { shape: 0.7 }), MOD.flutes(14, 0.06, 0.6, 0.74, { end: 0.02 })]) });
      P.add('trim', beadRing(R - 0.004, 0.04, 42, 0.0058));
      P.add('trim', around(10, 0.12, 0.6, () => curl(leaf(0.05, 0.08, 0.009), 3), { tilt: 0.42 }));
      P.add('trim', around(18, 0.07, 0.752, () => sphere(0.0085, 0, 0, 0, 8)));                 // a string of pearls
      // the face: a smooth jade head
      P.add('body', sphere(0.088, 0, 0.85, 0, 28).scale(1, 1.06, 0.98));
      // the wide, round turban (pagri), wound in twisted bands
      P.lathe('body', profile(0, 0.876).line(0.09, 0.876).curve([[0.14, 0.884], [0.166, 0.92], [0.164, 0.97], [0.138, 1.012], [0.09, 1.036], [0.03, 1.044]]).line(0, 1.044),
        { mod: MOD.flutes(14, 0.06, 0.886, 1.03, { twist: 7, soft: true, end: 0.01 }) });
      P.add('trim', ring(0.122, 0.888, 0.008));
      // the sarpech at the front, and a tall feather plume (kalgi) rising from it
      P.add('trim', placeAt(curl(petal(0.05, 0.11, 0.009), -2), 0, 0.158, 0.93, { tilt: -0.1 }));
      P.add('accent', placeAt(cabochon(0.02, 0.6), 0, 0.166, 0.95));
      P.add('accent2', placeAt(sphere(0.012, 0, 0, 0, 10), 0, 0.162, 0.912));
      P.add('trim', K.tube([[0, 0.99, 0.14], [0, 1.08, 0.13], [0, 1.18, 0.09], [0, 1.25, 0.04]], 0.016, { segs: 24, radial: 8, radiusAt: (t) => mix(1, 0.25, t) }));
      return P;
    },
    b() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(lotusBase(profile(0, 0), R, 0.2), 0.2), { mod: lotusMod() });
      P.add('trim', beadRing(R - 0.004, 0.04, 40, 0.0058));
      const y0 = 0.31, s = 1.12, A = at([0, y0, 0.02], s);
      const el = new Sculpt(0.03, 1.35);
      el.floor = y0 - 0.004;
      el.ell(A(0, 0.25, -0.03), [0.125 * s, 0.12 * s, 0.185 * s], 0.04);                        // body
      el.pair((x) => {
        el.cone(A(x * 0.07, 0.2, 0.08), A(x * 0.07, 0.0, 0.085), 0.048 * s, 0.046 * s, 0.03);
        el.cone(A(x * 0.072, 0.2, -0.13), A(x * 0.072, 0.0, -0.13), 0.05 * s, 0.046 * s, 0.03);
        el.ell(A(x * 0.098, 0.3, 0.115), [0.02 * s, 0.085 * s, 0.07 * s], 0.016);               // ears
      });
      el.ell(A(0, 0.31, 0.14), [0.082 * s, 0.09 * s, 0.072 * s], 0.04);                          // head
      el.ell(A(0, 0.355, 0.15), [0.068 * s, 0.055 * s, 0.058 * s], 0.03);                        // brow
      el.chain([[0, 0.29, 0.2, 0.038], [0, 0.22, 0.235, 0.031], [0, 0.14, 0.245, 0.025], [0, 0.07, 0.262, 0.02], [0, 0.06, 0.295, 0.017], [0, 0.085, 0.31, 0.014]].map(([x, y, z, r]) => A(x, y, z).concat(r * s)), 0.012, 3);   // trunk
      el.pair((x) => el.ell(A(x * 0.052, 0.33, 0.205), [0.008, 0.008, 0.006], 0.004, true));   // eyes
      el.chain([[0, 0.28, -0.21, 0.012], [0, 0.2, -0.23, 0.009], [0, 0.13, -0.225, 0.008]].map(([x, y, z, r]) => A(x, y, z).concat(r * s)), 0.008);   // tail
      const ef = el.field();
      P.add('body', el.mesh());
      // a gold saddle cloth (jhool) with a ruby border, and gold anklets
      P.add('trim', sdfGeometry(drape(ef, 0.012, (x, y, z) => Math.max(y0 + 0.22 * s - y, Math.abs(z - 0.02 + 0.03 * s) - 0.12 * s)), [-0.18, y0 + 0.18, -0.24, 0.18, y0 + 0.44, 0.2], Q.cell * 1.3));
      el.pair((x) => { for (const z of [0.085, -0.13]) P.add('trim', ring(0.05 * s, y0 + 0.05 * s, 0.007).translate(x * 0.071 * s, 0, 0.02 + z * s)); });
      // tusks capped in gold, and a gold forehead plate with a ruby
      P.add('tusk', merge([-1, 1].map((x) => K.tube([A(x * 0.045, 0.25, 0.19), A(x * 0.06, 0.2, 0.24), A(x * 0.058, 0.21, 0.29), A(x * 0.05, 0.24, 0.31)], 0.012 * s, { segs: 24, radial: 8, radiusAt: (t) => mix(1, 0.25, t) }))));
      const fp = cabochon(0.04 * s, 0.3); fp.scale(0.8, 1.2, 1); fp.rotateX(-0.5); fp.translate(...A(0, 0.345, 0.2)); P.add('trim', fp);
      P.add('accent', placeAt(brilliant(0.013), 0, 0, 0).rotateX(-0.5).translate(...A(0, 0.35, 0.214)));
      // the canopy: four gold posts carry a little onion dome, open on every side
      const hy = y0 + 0.37 * s, hz = 0.02 - 0.03 * s, top = hy + 0.11;
      P.add('trim', revolve(profile(0, hy).line(0.105, hy).line(0.105, hy + 0.022).line(0, hy + 0.022), { segs: 40 }).translate(0, 0, hz));
      P.add('accent', studs(8, 0.106, hy + 0.011, 0.009, { phase: Math.PI / 8 }).translate(0, 0, hz));
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        P.add('trim', new THREE.CylinderGeometry(0.01, 0.01, top - hy, 10).translate(Math.sin(a) * 0.082, (hy + top) / 2, hz + Math.cos(a) * 0.082));
      }
      P.lathe('body', profile(0, top).line(0.126, top).line(0.126, top + 0.016).line(0.104, top + 0.022)
        .curve([[0.13, top + 0.06], [0.122, top + 0.11], [0.07, top + 0.15], [0.02, top + 0.18]]).line(0.006, top + 0.2).line(0, top + 0.2),
        { mod: MOD.lobes(12, 0.06, top + 0.03, top + 0.17, { shape: 2 }) });
      P.add('trim', ring(0.126, top + 0.008, 0.006));
      P.add('trim', sphere(0.018, 0, top + 0.21, 0, 14));
      for (const g of P.parts.body.slice(-1).concat(P.parts.trim.slice(-2))) g.translate(0, 0, hz);
      return P;
    },
  });

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
      P.add('trim', placeAt(crossOf('botonny', 0.22, 0.045), 0, 0, 1.42));
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
      P.lathe('body', p, { mod: mods([MOD.lobes(8, 0.16, 0.7, 1.09, { shape: 1.4, end: 0.08, phase: Math.PI / 8 }), MOD.slit(Math.PI * 0.25, 0.94, 0.6, 0.017, 0.5)]) });
      P.add('trim', ring(R - 0.009, 0.03, 0.006));
      P.add('trim', ring(0.11, 0.668, 0.008));
      P.add('trim', around(8, 0.12, 0.69, () => ruyi(0.05, 0.05, 0.005), { tilt: 0.1 }));
      P.add('trim', ring(0.03, 1.11, 0.006));
      P.lathe('accent', ovalHead(profile(0, 1.106).line(0.012, 1.106), 0.012, 1.15, 0.03, 0.045, 0.6), { segs: 24 });
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(mingBase(profile(0, 0), R, 0.2), 0.2));
      P.add('trim', ring(R - 0.009, 0.03, 0.0065));
      const h = horse({ base: 0.31, mane: 'braid', seed: 5, form: { tuck: 0.52, girth: 1.16, neck: -0.08, chest: 0.16, ears: -0.3, jaw: 0.02 } });
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
      ovalHead(p, 0.068, 0.49, 0.13, 0.098);
      P.lathe('body', p);
      P.add('trim', ring(R - 0.009, 0.026, 0.006));
      P.add('trim', ring(0.11, 0.33, 0.0065));
      P.lathe('trim', profile(0, 0.575).line(0.07, 0.575).arc(0.074, 0.588, 0.4).line(0.03, 0.594).curve([[0.026, 0.61], [0.034, 0.63]]).arc(0, 0.66, 0.5), { segs: 32 });
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
      P.add('trim', placeAt(crossOf('beaded', 0.23, 0.045), 0, 0, 1.405));
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
      P.lathe('body', p, { mod: mods([twist(0.24, 0.395, 1.4), MOD.flutes(7, 0.13, 0.6, 1.06, { twist: 6, soft: true, end: 0.08 }), MOD.slit(Math.PI * 0.25, 0.92, 0.6, 0.018, 0.5)]) });
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
      const h = horse({ base: 0.31, mane: 'flow', seed: 5, form: { reach: 0.32, neck: 0.15, girth: 0.78, lean: 0.1, ears: 0.4 } });
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
      P.lathe('body', p, { mod: mods([twist(0.226, 0.325, 1), MOD.lobes(8, 0.16, 0.39, 0.6, { shape: 0.7, end: 0.05 })]) });
      P.add('trim', sphere(0.018, 0, 0.612, 0, 12));
      P.add('trim', ring(0.094, 0.18, 0.0055));
      P.add('trim', ring(0.098, 0.36, 0.006));
      return P;
    },
  };

  // ------------------------------------------------------------------ Tsarina's Treasure (Imperial Russia)
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
      P.add('trim', placeAt(crossOf('orthodox', 0.2, 0.04), 0, 0, 1.392));
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
        .curve([[0.15, 0.68], [0.178, 0.75], [0.172, 0.82], [0.13, 0.88], [0.072, 0.94], [0.036, 1.0], [0.018, 1.07]])
        .line(0.014, 1.09).line(0, 1.091);
      P.lathe('body', p, { mod: mods([gadroons(), MOD.lobes(8, 0.06, 0.66, 1.0, { shape: 3, end: 0.04 }), MOD.slit(Math.PI * 0.25, 0.8, 0.6, 0.018, 0.5)]) });
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
      const h = horse({ base: 0.31, mane: 'flow', seed: 5, form: { tuck: -0.4, lean: -0.1, neck: 0.05, chest: 0.18 } });
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
      ovalHead(p, 0.062, 0.51, 0.1, 0.135);
      P.lathe('body', p, { mod: gadroons(0.85) });
      P.add('trim', ring(0.101, 0.51, 0.0055));
      for (const a of [0.55, -0.55]) P.add('trim', ring(0.104, 0, 0.0045, { squash: 1.36 }).rotateX(Math.PI / 2).rotateY(Math.PI / 4).rotateZ(a).translate(0, 0.51, 0));
      P.add('accent3', sphere(0.018, 0, 0.66, 0, 12));
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
  // The people of the jazz-age city, on stepped octagonal plinths of gold: a tycoon in a long
  // coat and cape with a skyscraper crown, a dancer under a golden sunburst with a fur stole,
  // a lamplighter in a fedora carrying a street lamp, a horse with a fan-shaped mane, a
  // skyscraper with lit windows, and a pawn like a lamp globe over a sunburst fan.
  function decoPlinth(P, R, h) {
    cutLathe(P, 'trim', profile(0, 0).line(R, 0).line(R, h * 0.3).line(R - 0.02, h * 0.32).line(0, h * 0.32), 8, { mod: null });
    cutLathe(P, 'body', profile(0, h * 0.3).line(R - 0.022, h * 0.3).line(R - 0.022, h * 0.72).line(0, h * 0.72), 8);
    cutLathe(P, 'trim', profile(0, h * 0.7).line(R - 0.035, h * 0.7).line(R - 0.035, h * 0.8).line(R - 0.05, h * 0.82).line(R - 0.05, h).line(0, h), 8);
    const a = TAU / 16;
    P.add('gem', around(4, (R - 0.022) * Math.cos(a / 1) + 0.002, h * 0.51, () => rbox(0.034, 0.03, 0.01, 0.004), { phase: a }));
    P.add('trim', around(8, (R - 0.022) * Math.cos(TAU / 16) + 0.001, h * 0.51, () => rbox(0.006, h * 0.36, 0.006, 0.002)));
    return h;
  }
  // a fan of rays in the plane facing +z, spreading over `spread` either side of straight up
  function sunfan(r0, r1, n, spread, depth) {
    const parts = [];
    for (let i = 0; i < n; i++) {
      const a = mix(-spread, spread, n === 1 ? 0.5 : i / (n - 1)), len = (r1 - r0) * (i % 2 ? 0.72 : 1);
      const g = ray(TAU * r0 / n * 1.6 + 0.012, len, depth); g.translate(0, r0, 0); g.rotateZ(a); parts.push(g);
    }
    return merge(parts);
  }
  const DECO = {
    k() {
      // the tycoon: a long coat and a cape, hands resting on a cane, a skyscraper crown and a cross
      const P = new Piece(), y0 = decoPlinth(P, 0.35, 0.13), s = 1.12, A = at([0, y0, 0], s);
      P.lathe('body', profile(0, y0).line(0.14 * s, y0).curve([[0.13 * s, y0 + 0.2 * s], [0.1 * s, y0 + 0.42 * s], [0.088 * s, y0 + 0.52 * s]]).line(0, y0 + 0.52 * s),
        { mod: MOD.flutes(10, 0.08, y0 + 0.01, y0 + 0.46 * s, { soft: true, end: 0.03 }) });
      const sk = new Sculpt(0.018, 1.1), cape = new Sculpt(0.022, 1.25), hair = new Sculpt(0.012);
      sk.floor = y0 + 0.42 * s; cape.floor = y0 - 0.004;
      sk.ell(A(0, 0.6, 0.004), [0.1 * s, 0.13 * s, 0.072 * s], 0.035);
      sk.pair((x) => sk.ell(A(x * 0.1, 0.705, 0), [0.052 * s, 0.045 * s, 0.05 * s], 0.03));      // broad shoulders
      sk.cone(A(0, 0.72, 0), A(0, 0.79, 0.006), 0.034 * s, 0.031 * s, 0.01);
      const hd = head(sk, A(0, 0.855, 0.01), 0.062 * s);
      arm(sk, sk, A(-0.11, 0.69, 0), A(-0.14, 0.56, 0.05), A(-0.02, 0.48, 0.11), 0.028 * s);
      arm(sk, sk, A(0.11, 0.69, 0), A(0.14, 0.56, 0.05), A(0.02, 0.48, 0.11), 0.028 * s);
      cape.cone(A(0, 0.72, -0.05), A(0, 0.02, -0.08), 0.12 * s, 0.17 * s, 0.03);
      cape.pair((x) => cape.cone(A(x * 0.1, 0.72, -0.01), A(x * 0.15, 0.05, -0.02), 0.03 * s, 0.05 * s, 0.03));
      cape._push((x, y, z) => SD.ellipsoid(x, y, z, 0, y0 + 0.4 * s, 0.06 * s, 0.12 * s, 0.5 * s, 0.1 * s), 0, y0 + 0.4 * s, 0.06 * s, 0.5 * s, 0.02, true);   // open at the front
      hair.ell(A(0, 0.885, -0.008), [0.066 * s, 0.05 * s, 0.064 * s], 0.012);
      P.add('body', sk.mesh()); P.add('cloth', cape.mesh()); P.add('hair', hair.mesh()); eyes(P, hd);
      // lapels, a gem tie pin, a belt, gold edging on the cape, the cane
      P.add('trim', merge([-1, 1].map((x) => rbox(0.012 * s, 0.14 * s, 0.01, 0.004, x * 0.03 * s, y0 + 0.64 * s, 0.07 * s).rotateZ(x * 0.35))));
      P.add('gem', rbox(0.02 * s, 0.1 * s, 0.012, 0.005, 0, y0 + 0.62 * s, 0.072 * s));
      P.add('trim', ring(0.091 * s, y0 + 0.52 * s, 0.012 * s));
      P.add('trim', merge([-1, 1].map((x) => K.tube([[x * 0.1 * s, y0 + 0.72 * s, 0.0], [x * 0.13 * s, y0 + 0.4 * s, 0.01 * s], [x * 0.16 * s, y0 + 0.05 * s, 0.0]], 0.008 * s, { segs: 20, radial: 6 }))));
      P.add('trim', cyl(0.008 * s, 0.008 * s, 0.48 * s, 0, y0 + 0.24 * s, 0.12 * s, 10));
      P.add('trim', sphere(0.022 * s, 0, y0 + 0.48 * s + 0.012, 0.12 * s, 12));
      // the crown: stacked arches like the top of a skyscraper, a spire and a stepped cross
      const c = chryslerCrown(y0 + 0.9 * s, 0.07 * s, 3);
      P.add('trim', c.geom);
      P.add('gem', gemRing(8, 0.071 * s, y0 + 0.93 * s, 0.009, { phase: Math.PI / 8 }));
      P.lathe('trim', profile(0, c.top).line(0.014, c.top).line(0.003, c.top + 0.1).line(0, c.top + 0.102), { segs: 20 });
      P.add('trim', placeAt(crossOf('stepped', 0.15, 0.03), 0, 0, c.top + 0.18));
      return turnPiece(P, 0.3);
    },
    q() {
      // the dancer: a beaded gown, a fur stole, a bobbed head and a sunburst of gold rays
      const P = new Piece(), y0 = decoPlinth(P, 0.335, 0.13), s = 1.1, A = at([0, y0, 0], s);
      P.lathe('body', profile(0, y0).line(0.15 * s, y0).curve([[0.13 * s, y0 + 0.08 * s], [0.08 * s, y0 + 0.2 * s], [0.07 * s, y0 + 0.36 * s], [0.06 * s, y0 + 0.5 * s]]).line(0, y0 + 0.5 * s),
        { mod: MOD.flutes(24, 0.1, y0 + 0.01, y0 + 0.2 * s, { soft: true, end: 0.02 }) });
      for (const y of [0.16, 0.25, 0.34]) P.add('trim', beadRing(mix(0.085, 0.066, (y - 0.16) / 0.2) * s, y0 + y * s, 40, 0.005));
      const sk = new Sculpt(0.016, 1.05), fur = new Sculpt(0.02, 1.2), hair = new Sculpt(0.012);
      sk.floor = y0 + 0.4 * s;
      sk.ell(A(0, 0.55, 0.004), [0.058 * s, 0.1 * s, 0.045 * s], 0.03);
      sk.cone(A(0, 0.63, 0.004), A(0, 0.69, 0.008), 0.024 * s, 0.022 * s, 0.01);
      const c = A(0, 0.745, 0.012), hd = head(sk, c, 0.055 * s);
      arm(sk, sk, A(-0.064, 0.61, 0), A(-0.11, 0.53, 0.02), A(-0.07, 0.47, 0.05), 0.018 * s);   // hand on her hip
      arm(sk, sk, A(0.064, 0.61, 0), A(0.1, 0.66, 0.03), A(0.08, 0.76, 0.05), 0.018 * s);
      for (let i = 0; i < 12; i++) { const th = (i / 12) * TAU, r = 0.07 * s; fur.ell([Math.sin(th) * r, y0 + 0.62 * s + Math.cos(th * 2) * 0.006, Math.cos(th) * r * 0.85], [0.034 * s, 0.03 * s, 0.034 * s], 0.025); }
      fur.pair((x) => fur.chain([[x * 0.07 * s, y0 + 0.6 * s, 0.03 * s, 0.03 * s], [x * 0.1 * s, y0 + 0.45 * s, 0.05 * s, 0.026 * s], [x * 0.1 * s, y0 + 0.32 * s, 0.04 * s, 0.02 * s]], 0.02, 2));
      hair.ell([c[0], c[1] + 0.014 * s, c[2] - 0.01 * s], [0.062 * s, 0.056 * s, 0.062 * s], 0.012);
      hair.pair((x) => hair.ell([c[0] + x * 0.05 * s, c[1] - 0.02 * s, c[2] + 0.005 * s], [0.02 * s, 0.04 * s, 0.03 * s], 0.012));
      P.add('body', sk.mesh()); P.add('fur', fur.mesh()); P.add('hair', hair.mesh()); eyes(P, hd);
      // a beaded headband with a gem, and the sunburst behind her head
      P.add('trim', ring(0.06 * s, c[1] + 0.025 * s, 0.006 * s));
      P.add('gem', placeAt(brilliant(0.012 * s), 0, 0.064 * s, c[1] + 0.03 * s));
      const fan = sunfan(0.07 * s, 0.24 * s, 15, 1.35, 0.012); fan.translate(c[0], c[1] - 0.01 * s, c[2] - 0.05 * s);
      P.add('trim', fan);
      P.add('trim', ring(0.07 * s, 0, 0.007, { seg: 48 }).rotateX(Math.PI / 2).translate(c[0], c[1] - 0.01 * s, c[2] - 0.05 * s));
      P.add('pearl', around(18, 0.04 * s, y0 + 0.655 * s, () => sphere(0.0065 * s, 0, 0, 0, 8)));
      return turnPiece(P, -0.3);
    },
    b() {
      // the lamplighter: a long belted coat, a fedora, and a street lamp on a tall gold post
      const P = new Piece(), y0 = decoPlinth(P, 0.312, 0.12), s = 0.98, A = at([0, y0, 0], s);
      P.lathe('body', profile(0, y0).line(0.13 * s, y0).curve([[0.125 * s, y0 + 0.2 * s], [0.1 * s, y0 + 0.42 * s], [0.09 * s, y0 + 0.55 * s]]).line(0, y0 + 0.55 * s),
        { mod: MOD.flutes(8, 0.07, y0 + 0.01, y0 + 0.5 * s, { soft: true, end: 0.03 }) });
      const sk = new Sculpt(0.018, 1.1);
      sk.floor = y0 + 0.44 * s;
      sk.ell(A(0, 0.6, 0.004), [0.09 * s, 0.12 * s, 0.066 * s], 0.035);
      sk.pair((x) => sk.ell(A(x * 0.09, 0.695, 0), [0.045 * s, 0.04 * s, 0.045 * s], 0.03));
      sk.cone(A(0, 0.71, 0), A(0, 0.79, 0.006), 0.034 * s, 0.031 * s, 0.01);
      const hd = head(sk, A(0, 0.85, 0.01), 0.06 * s);
      arm(sk, sk, A(0.1, 0.68, 0), A(0.15, 0.6, 0.03), A(0.14, 0.7, 0.09), 0.026 * s);     // the lamp hand
      arm(sk, sk, A(-0.1, 0.68, 0), A(-0.13, 0.55, 0.03), A(-0.1, 0.46, 0.06), 0.026 * s);
      sk.pair((x) => sk.cone(A(x * 0.05, 0.69, 0.06), A(x * 0.02, 0.5, 0.075), 0.02 * s, 0.014 * s, 0.01));   // coat lapels
      P.add('body', sk.mesh()); eyes(P, hd);
      P.add('trim', ring(0.098 * s, y0 + 0.47 * s, 0.012 * s));
      P.add('gem', placeAt(rbox(0.026 * s, 0.022 * s, 0.01, 0.004), 0, 0.104 * s, y0 + 0.47 * s));
      P.add('trim', merge([0, 1, 2].map((i) => sphere(0.008 * s, 0, y0 + (0.62 - i * 0.06) * s, 0.072 * s, 8))));
      // the fedora
      const hy = A(0, 0.895, 0)[1];
      P.lathe('hair', profile(0, hy).line(0.11 * s, hy).line(0.112 * s, hy + 0.008).line(0.066 * s, hy + 0.012).curve([[0.07 * s, hy + 0.06 * s], [0.055 * s, hy + 0.09 * s]]).line(0, hy + 0.08 * s), { mod: MOD.slit(0, hy + 0.09 * s, 0, 0.02, 0.3) });
      P.add('trim', ring(0.068 * s, hy + 0.025 * s, 0.008 * s));
      // the street lamp: a gold post with a glowing globe in a crown of rays
      const lp = A(0.14, 0.7, 0.09);
      P.add('trim', cyl(0.008 * s, 0.011 * s, 1.0 * s, lp[0], y0 + 0.5 * s, lp[2], 10));
      P.add('trim', sphere(0.018 * s, lp[0], y0 + 0.02, lp[2], 10));
      const gy = y0 + 1.06 * s;
      P.lathe('trim', profile(0, gy - 0.07 * s).line(0.03 * s, gy - 0.06 * s).line(0.045 * s, gy - 0.04 * s).line(0, gy - 0.04 * s), { segs: 32 });
      P.add('glow', sphere(0.05 * s, lp[0], gy, lp[2], 24));
      P.add('trim', around(8, 0.052 * s, gy, () => rbox(0.005, 0.1 * s, 0.005, 0.002)).translate(lp[0], 0, lp[2]));
      P.add('trim', sphere(0.014 * s, lp[0], gy + 0.06 * s, lp[2], 10));
      return turnPiece(P, -0.4);
    },
    n() {
      const R = 0.322, P = new Piece();
      const y0 = decoPlinth(P, R, 0.13);
      cutLathe(P, 'body', profile(0, y0).line(0.22, y0).line(0.22, 0.29).line(0.2, 0.31).line(0, 0.31), 8);
      P.add('trim', around(8, 0.22 * Math.cos(TAU / 16) + 0.002, 0.21, () => rbox(0.05, 0.012, 0.006, 0.003), { phase: TAU / 16 }));
      const h = horse({ base: 0.31, mane: 'none', seed: 5, form: { facet: 0.018, lean: 0.18, reach: 0.16, girth: 0.86, ears: 0.35 } });
      P.add('body', h.body);
      const br = bridle(h, { stud: 0.014 });
      P.add('trim', br.straps); P.add('gem', br.studs);
      // a fan-shaped mane of stepped gold fins down the crest
      const crest = [[-0.03, 0.97], [-0.07, 0.93], [-0.1, 0.87], [-0.122, 0.79], [-0.136, 0.7], [-0.144, 0.6], [-0.146, 0.5]];
      const fins = [];
      for (let i = 0; i < 12; i++) {
        const t = i / 11, u = t * (crest.length - 1), j = Math.min(crest.length - 2, Math.floor(u)), w = u - j;
        const z = mix(crest[j][0], crest[j + 1][0], w), y = mix(crest[j][1], crest[j + 1][1], w), len = mix(0.085, 0.05, t) * (i % 2 ? 0.8 : 1);
        const f = extrude([[0, 0], [len, 0.012], [len * 1.06, 0.026], [len * 0.82, 0.032], [len * 0.86, 0.042], [0, 0.04]], 0.008, 0.002, { bevelSegments: 1 });
        f.rotateY(Math.PI / 2); f.rotateX(-0.35 - t * 1.0); f.translate(0, h.Y(y) - 0.022, z + 0.012);
        fins.push(f);
      }
      P.add('trim', merge(fins));
      return P;
    },
    r() {
      // a skyscraper: setbacks, gold piers between rows of lit windows, gems up the corners,
      // stepped battlements and a short spire
      const P = new Piece(), y0 = decoPlinth(P, 0.33, 0.12);
      const tiers = [[0.2, y0, y0 + 0.42], [0.168, y0 + 0.42, y0 + 0.62], [0.13, y0 + 0.62, y0 + 0.74]];
      for (const [r, a, b] of tiers) {
        cutLathe(P, 'body', profile(0, a).line(r, a).line(r, b).line(0, b), 4, { mod: null });
        P.add('trim', rbox(r * 1.44, 0.014, r * 1.44, 0.004, 0, b, 0).rotateY(Math.PI / 4));
        const f = r * Math.SQRT1_2, wins = [], piers = [];
        for (let k = 0; k < 4; k++) for (let i = -2; i <= 2; i++) {
          const x = i * f * 0.34;
          piers.push(rbox(0.008, b - a - 0.05, 0.008, 0.003, x + f * 0.17, (a + b) / 2, f + 0.002).rotateY(k * Math.PI / 2 + Math.PI / 4));
          if (i < 2) wins.push(rbox(f * 0.2, b - a - 0.08, 0.006, 0.002, x + f * 0.34 * 0.5 + f * 0.0, (a + b) / 2, f + 0.0).rotateY(k * Math.PI / 2 + Math.PI / 4));
        }
        P.add('trim', merge(piers)); P.add('glow', merge(wins));
      }
      // gems up the corners of the lowest tier
      P.add('gem', merge([0, 1, 2, 3].map((k) => merge([0, 1, 2, 3].map((i) => { const d = brilliant(0.012); d.translate(0, y0 + 0.08 + i * 0.09, 0.198); d.rotateY(k * Math.PI / 2); return d; })))));
      // stepped battlements round the top tier, then the spire
      const tb = y0 + 0.74, tf = 0.13 * Math.SQRT1_2;
      const ml = [];
      for (let k = 0; k < 4; k++) for (let i = -1; i <= 1; i++) { const m = rbox(0.045, i ? 0.07 : 0.1, 0.03, 0.006, i * 0.06, tb + (i ? 0.035 : 0.05), tf - 0.012); m.rotateY(k * Math.PI / 2 + Math.PI / 4); ml.push(m); }
      P.add('body', merge(ml));
      P.lathe('trim', profile(0, tb).line(0.04, tb).line(0.03, tb + 0.06).line(0.012, tb + 0.08).line(0.003, tb + 0.2).line(0, tb + 0.2), { segs: 16 });
      return P;
    },
    p() {
      // a round head like a lamp globe, on a stepped column with a sunburst fan at the front
      const P = new Piece(), y0 = decoPlinth(P, 0.272, 0.1);
      cutLathe(P, 'body', profile(0, y0).line(0.12, y0).line(0.12, y0 + 0.04).line(0.095, y0 + 0.045).line(0.095, y0 + 0.08).line(0.072, y0 + 0.085)
        .line(0.062, y0 + 0.25).line(0.09, y0 + 0.26).line(0.09, y0 + 0.29).line(0, y0 + 0.29), 8);
      P.add('trim', ring(0.09, y0 + 0.275, 0.008, { seg: 8 }).rotateY(Math.PI / 8));
      const fan = sunfan(0.03, 0.15, 9, 1.2, 0.01); fan.translate(0, y0 + 0.07, 0.085); P.add('trim', fan);
      P.add('gem', placeAt(brilliant(0.014), 0, 0.096, y0 + 0.11));
      P.add('body', sphere(0.11, 0, y0 + 0.39, 0, 32));
      P.add('trim', ring(0.11, y0 + 0.39, 0.007, { seg: 48 }));
      P.add('trim', ring(0.11, 0, 0.006, { seg: 48 }).rotateX(Math.PI / 2).translate(0, y0 + 0.39, 0));
      return P;
    },
  };


  // ------------------------------------------------------------------ shared by the newer sets
  // A lathe cut into flat facets like a gemstone: a fixed number of sides at every level of
  // detail, so a crystal piece looks the same on the table and in a close-up.
  function cutLathe(P, slot, prof, sides, o) {
    const keep = DETAIL.around;
    DETAIL.around = 1;
    const g = revolve(prof, Object.assign({ segs: sides }, o || {}));
    DETAIL.around = keep;
    const f = g.toNonIndexed(); f.computeVertexNormals();
    return P.add(slot, f);
  }
  // A thin tendril winding up a stem whose radius at height y is rAt(y).
  function tendril(rAt, y0, y1, turns, phase, thick) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, y = mix(y0, y1, t), th = phase + t * turns * TAU, r = rAt(y) + (thick || 0.007) * 0.6 + 0.012 * Math.sin(t * Math.PI * 3);
      pts.push([Math.sin(th) * r, y, Math.cos(th) * r]);
    }
    return K.tube(pts, thick || 0.007, { segs: 90, radial: 8, radiusAt: (t) => mix(1, 0.35, t) });
  }
  // A drizzle of icing: a closed wavy line round radius r at height y.
  function drizzle(r, y, waves, amp, thick) {
    const pts = [];
    for (let i = 0; i < 96; i++) { const th = (i / 96) * TAU; pts.push([Math.sin(th) * r, y + Math.sin(th * waves) * amp, Math.cos(th) * r]); }
    return K.tube(pts, thick || 0.008, { closed: true, segs: 160, radial: 8 });
  }
  // A pair of trophy handles, ear-shaped loops from yLow to yHigh on a cup of radius r.
  function handles(r, yLow, yHigh, reach, thick) {
    const parts = [];
    for (const s of [-1, 1]) {
      const h = yHigh - yLow, pts = [[r - 0.01, yHigh], [r + reach * 0.7, yHigh + h * 0.12], [r + reach, yHigh - h * 0.25], [r + reach * 0.75, yLow + h * 0.25], [r + reach * 0.2, yLow + h * 0.02], [r - 0.012, yLow]];
      parts.push(K.tube(pts.map(([x, y]) => [s * x, y, 0]), thick || 0.014, { segs: 48, radial: 10 }));
      for (const [x, y] of [pts[1], pts[4]]) parts.push(sphere((thick || 0.014) * 1.3, s * x, y, 0, 10));
    }
    return merge(parts);
  }
  // A five-pointed star facing +z, centred on the origin.
  function star(r, depth, points) {
    const n = points || 5, pts = [];
    for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * TAU, rr = i % 2 ? r * 0.45 : r; pts.push([Math.sin(a) * rr, Math.cos(a) * rr]); }
    return extrude(pts, depth, depth * 0.35, { bevelSegments: 2 });
  }
  // A crescent moon, horns up, facing +z.
  function crescent(r, depth) {
    const out = [], hole = [];
    for (let i = 0; i <= 32; i++) { const a = mix(-2.5, 2.5, i / 32); out.push([Math.sin(a) * r, -Math.cos(a) * r]); }
    for (let i = 32; i >= 0; i--) { const a = mix(-2.2, 2.2, i / 32); hole.push([Math.sin(a) * r * 0.82, -Math.cos(a) * r * 0.78 + r * 0.32]); }
    return extrude(out.concat(hole), depth, depth * 0.3, { bevelSegments: 2 });
  }
  // A small gem set facing outward on a ring: n brilliants round radius r at height y.
  const gemRing = (n, r, y, size, o) => around(n, r, y, () => brilliant(size), o);
  // Lines of gems climbing a shaft whose radius at height y is rAt(y): `lines` spirals of `count`.
  function pave(lines, count, rAt, y0, y1, size, turns) {
    const parts = [];
    for (let l = 0; l < lines; l++) for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count, y = mix(y0, y1, t);
      parts.push(placeAt(brilliant(size), (l / lines) * TAU + t * (turns || 0) * TAU, rAt(y) + size * 0.2, y));
    }
    return merge(parts);
  }

  // ------------------------------------------------------------------ Belle Epoque (Paris, 1889)
  // Art Nouveau: lily cups on whiplash stems, tendrils in gold, Eiffel ironwork on the rook.
  function nouveauBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3)
      .curve([[R - 0.012, 0.032 * k], [R - 0.06, 0.052 * k], [R - 0.13, 0.074 * k], [top + 0.035, 0.1 * k]])
      .curve([[top + 0.008, 0.13 * k], [top, 0.165 * k]]);
  }
  const petalFoot = (k) => MOD.lobes(5, 0.14, 0, 0.09 * (k || 1), { shape: 0.6, end: 0.01 });
  const NOUVEAU = {
    k() {
      const R = 0.35, P = new Piece();
      const p = nouveauBase(profile(0, 0), R, 0.078);
      p.curve([[0.07, 0.3], [0.06, 0.5], [0.064, 0.7], [0.082, 0.8]])
        .curve([[0.13, 0.86], [0.19, 0.95], [0.214, 1.03]]).arc(0.2, 1.04, 0.5)
        .curve([[0.17, 1.0], [0.1, 0.975]]).line(0, 0.97);
      P.lathe('body', p, { mod: petalFoot(), lift: (th, y) => -0.07 * Math.pow(Math.abs(Math.sin((th * 5) / 2)), 0.8) * smooth(0.94, 1.04, y) });
      P.lathe('body', profile(0, 0.96).line(0.1, 0.96).curve([[0.112, 1.03], [0.096, 1.1], [0.055, 1.16], [0.02, 1.18]]).line(0, 1.182), { mod: MOD.lobes(5, 0.12, 0.98, 1.17, { shape: 1.5 }) });
      P.add('trim', tendril((y) => mix(0.07, 0.064, (y - 0.17) / 0.6), 0.17, 0.8, 1.5, 0.3));
      P.add('trim', tendril((y) => mix(0.07, 0.064, (y - 0.17) / 0.6), 0.17, 0.8, 1.5, 0.3 + Math.PI));
      P.add('trim', ring(0.084, 0.8, 0.008));
      P.add('trim', sphere(0.03, 0, 1.205, 0, 16));
      P.add('trim', placeAt(crossOf('scroll', 0.24, 0.04), 0, 0, 1.34));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = nouveauBase(profile(0, 0), R, 0.074);
      p.curve([[0.066, 0.3], [0.056, 0.48], [0.06, 0.64], [0.078, 0.74]])
        .curve([[0.13, 0.8], [0.2, 0.9], [0.236, 1.0]]).arc(0.222, 1.012, 0.5)
        .curve([[0.19, 0.97], [0.12, 0.92]]).line(0, 0.915);
      P.lathe('body', p, { mod: petalFoot(), lift: (th, y) => -0.11 * Math.pow(Math.abs(Math.sin((th * 6) / 2)), 0.6) * smooth(0.86, 1.01, y) });
      P.add('trim', tendril((y) => mix(0.066, 0.06, (y - 0.17) / 0.55), 0.17, 0.74, 1.3, 1.2));
      P.add('trim', tendril((y) => mix(0.066, 0.06, (y - 0.17) / 0.55), 0.17, 0.74, 1.3, 1.2 + Math.PI));
      // the pistil: a gold stalk holding a pearl
      P.lathe('trim', profile(0, 0.91).line(0.03, 0.91).curve([[0.016, 1.0], [0.014, 1.1]]).line(0, 1.1), { segs: 24 });
      P.add('body', sphere(0.05, 0, 1.14, 0, 24));
      for (let i = 0; i < 6; i++) { const th = (i / 6) * TAU; P.add('trim', sphere(0.014, Math.sin(th) * 0.234, 1.014, Math.cos(th) * 0.234, 10)); }
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = nouveauBase(profile(0, 0), R, 0.07);
      p.curve([[0.062, 0.28], [0.054, 0.44], [0.06, 0.56], [0.08, 0.62]])
        .curve([[0.12, 0.68], [0.142, 0.77], [0.138, 0.87], [0.11, 0.97], [0.07, 1.05], [0.024, 1.1]]).line(0, 1.104);
      P.lathe('body', p, { mod: mods([petalFoot(), MOD.lobes(3, 0.16, 0.64, 1.08, { shape: 1.6, end: 0.08 }), MOD.slit(Math.PI * 0.25, 0.9, 0.6, 0.017, 0.5)]) });
      P.add('trim', tendril((y) => mix(0.062, 0.056, (y - 0.17) / 0.45), 0.17, 0.62, 1.2, 0.8));
      P.add('trim', ring(0.082, 0.625, 0.0075));
      P.add('trim', placeAt(curl(leaf(0.06, 0.1, 0.008), 3), Math.PI, 0.1, 0.66, { tilt: 0.5 }));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(nouveauBase(profile(0, 0), R, 0.2), 0.2), { mod: petalFoot() });
      const h = horse({ base: 0.31, mane: 'flow', seed: 8, form: { tuck: 0.22, reach: 0.1, neck: 0.12, girth: 0.84, lean: 0.04 } });
      P.add('body', h.body); P.add('trim', h.mane);
      P.add('trim', ring(0.214, 0.3, 0.008));
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = nouveauBase(profile(0, 0), R, 0.215);
      p.curve([[0.214, 0.25], [0.198, 0.42], [0.208, 0.58], [0.236, 0.65]])
        .line(0.252, 0.66).line(0.252, 0.69).line(0.2, 0.69).line(0.2, 0.67).line(0, 0.67);
      // Eiffel ironwork: tall pointed arches round the tower
      P.lathe('body', p, { mod: mods([petalFoot(), MOD.arcade(9, 0.22, 0.6, 0.66, 0.12, { pointed: true, head: 0.14 })]) });
      P.add('body', battlements(4, 0.2, 0.252, 0.686, 0.82, 0.3, 'round', 0.05));
      P.add('trim', ring(0.253, 0.668, 0.008));
      P.add('trim', ring(0.214, 0.22, 0.007));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = nouveauBase(profile(0, 0), R, 0.062, 0.85);
      p.curve([[0.056, 0.24], [0.05, 0.32], [0.058, 0.37]]);
      ballHead(p, 0.056, 0.48, 0.112);
      P.lathe('body', p, { mod: petalFoot(0.85) });
      P.add('trim', around(3, 0.064, 0.4, () => curl(leaf(0.05, 0.09, 0.007), 4), { tilt: 0.75 }));
      P.add('trim', tendril((y) => 0.054, 0.15, 0.37, 0.8, 0.4, 0.006));
      return P;
    },
  };

  // ------------------------------------------------------------------ Carrara & Nero (today)
  // A modern sculptor's set: clean cones, spheres and discs, cut sharp from marble.
  function modernBase(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).line(R, 0.05 * k).line(R - 0.02, 0.07 * k).line(top + 0.01, 0.075 * k).line(top, 0.085 * k);
  }
  const MODERN = {
    k() {
      const R = 0.34, P = new Piece();
      P.lathe('body', modernBase(profile(0, 0), R, 0.17).line(0.1, 0.98).line(0.15, 0.985).line(0.15, 1.02).line(0.07, 1.025).line(0.07, 1.1).line(0, 1.1));
      P.lathe('body', profile(0, 0.6).line(0.142, 0.6).line(0.142, 0.612).line(0, 0.612));
      P.add('body', placeAt(crossOf('plain', 0.3, 0.05), 0, 0, 1.27));
      return P;
    },
    q() {
      const R = 0.325, P = new Piece();
      P.lathe('body', modernBase(profile(0, 0), R, 0.162).line(0.095, 0.92).line(0, 0.92));
      P.lathe('body', profile(0, 0.92).line(0.19, 0.92).line(0.19, 0.935).line(0, 0.935));
      for (let i = 0; i < 9; i++) { const th = (i / 9) * TAU; P.add('body', sphere(0.022, Math.sin(th) * 0.19, 0.958, Math.cos(th) * 0.19, 14)); }
      P.add('body', sphere(0.1, 0, 1.03, 0, 32));
      P.add('body', sphere(0.032, 0, 1.15, 0, 16));
      return P;
    },
    b() {
      const R = 0.305, P = new Piece();
      const p = modernBase(profile(0, 0), R, 0.15).line(0.075, 0.7);
      ballHead(p, 0.075, 0.84, 0.135);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.9, 0.7, 0.03, 0.75) });
      P.lathe('body', profile(0, 0.97).line(0.012, 0.97).line(0.004, 1.06).line(0, 1.06), { segs: 16 });
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', modernBase(profile(0, 0), R, 0.2).line(0.2, 0.3).line(0, 0.3));
      P.add('body', horse({ base: 0.3, mane: 'none', seed: 5, form: { girth: 0.9, tuck: 0.2, neck: 0.03, reach: -0.04, ears: 0.1 } }).body);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      P.lathe('body', modernBase(profile(0, 0), R, 0.215).line(0.215, 0.62).line(0.17, 0.62).line(0.17, 0.6).line(0, 0.6));
      P.add('body', battlements(4, 0.17, 0.215, 0.615, 0.74, 0.28, 'flat'));
      P.lathe('body', profile(0, 0.36).line(0.222, 0.36).line(0.222, 0.375).line(0, 0.375));
      return P;
    },
    p() {
      const R = 0.265, P = new Piece();
      const p = modernBase(profile(0, 0), R, 0.13, 0.8).line(0.06, 0.36);
      ballHead(p, 0.06, 0.46, 0.108);
      P.lathe('body', p);
      return P;
    },
  };

  // ------------------------------------------------------------------ Cocoa & Gilt (a chocolatier's salon)
  // Every piece is a confection: pleated paper cups, truffles, piped rosettes and gold drizzle.
  function cupBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.024, 0).curve([[R - 0.004, 0.04 * k], [R + 0.006, 0.09 * k]]).line(R - 0.012, 0.096 * k)
      .curve([[R - 0.06, 0.104 * k], [top + 0.02, 0.112 * k]]).line(top, 0.13 * k);
  }
  const pleats = (k) => MOD.flutes(26, 0.07, 0.004, 0.092 * (k || 1), { fillet: 0.1, end: 0.01 });
  const piped = (y0, y1, n) => MOD.flutes(n || 8, 0.16, y0, y1, { twist: 11, soft: true, end: 0.03 });
  const PRALINE = {
    k() {
      const R = 0.35, P = new Piece();
      const p = cupBase(profile(0, 0), R, 0.12);
      p.curve([[0.17, 0.18], [0.182, 0.26], [0.156, 0.33], [0.1, 0.36]])
        .curve([[0.09, 0.42], [0.092, 0.52], [0.1, 0.6]])
        .curve([[0.15, 0.64], [0.168, 0.71], [0.142, 0.77], [0.1, 0.79]])
        .curve([[0.092, 0.82], [0.104, 0.86]])
        .curve([[0.152, 0.9], [0.172, 0.97], [0.152, 1.04], [0.094, 1.1], [0.04, 1.13]]).line(0, 1.135);
      P.lathe('body', p, { mod: mods([pleats(), piped(0.86, 1.13)]) });
      P.add('trim', drizzle(0.17, 0.26, 7, 0.022)); P.add('trim', drizzle(0.162, 0.7, 6, 0.018));
      P.add('trim', ring(0.1, 0.6, 0.008));
      P.add('trim', placeAt(crossOf('crosslet', 0.22, 0.044), 0, 0, 1.27));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = cupBase(profile(0, 0), R, 0.115);
      p.curve([[0.162, 0.18], [0.172, 0.25], [0.148, 0.32], [0.096, 0.35]])
        .curve([[0.086, 0.42], [0.09, 0.52], [0.1, 0.58]])
        .curve([[0.16, 0.66], [0.2, 0.76], [0.21, 0.86]]).arc(0.196, 0.872, 0.5)
        .curve([[0.17, 0.85], [0.12, 0.83]]).line(0, 0.825);
      const N = 8;
      P.lathe('body', p, { mod: mods([pleats(), piped(0.6, 0.86, 16)]), lift: (th, y) => -0.07 * Math.pow(Math.abs(Math.cos((th * N) / 2)), 0.5) * smooth(0.8, 0.87, y) });
      P.add('trim', drizzle(0.16, 0.25, 7, 0.02));
      P.lathe('body', profile(0, 0.82).line(0.11, 0.82).curve([[0.12, 0.9], [0.1, 0.98], [0.05, 1.03]]).line(0, 1.035), { mod: piped(0.82, 1.03, 6) });
      // a gilt cherry on top
      P.add('trim', sphere(0.048, 0, 1.08, 0, 24));
      P.add('trim', K.tube([[0, 1.12, 0], [0.01, 1.16, -0.01], [0.03, 1.19, -0.03]], 0.006, { segs: 12 }));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = cupBase(profile(0, 0), R, 0.11);
      p.curve([[0.152, 0.17], [0.162, 0.24], [0.14, 0.31], [0.09, 0.34]])
        .curve([[0.08, 0.42], [0.084, 0.5], [0.096, 0.56]])
        .curve([[0.13, 0.6], [0.142, 0.68], [0.13, 0.8], [0.09, 0.93], [0.04, 1.03]]).line(0, 1.04);
      P.lathe('body', p, { mod: mods([pleats(), piped(0.58, 1.03, 6), MOD.slit(Math.PI * 0.25, 0.86, 0.6, 0.018, 0.5)]) });
      P.add('trim', drizzle(0.152, 0.24, 6, 0.018));
      P.add('trim', ring(0.098, 0.565, 0.008));
      P.add('trim', sphere(0.028, 0, 1.06, 0, 16));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(cupBase(profile(0, 0), R, 0.2), 0.2), { mod: pleats() });
      P.add('body', horse({ base: 0.31, mane: 'carved', seed: 11, form: { tuck: 0.06, girth: 1.06, nose: -0.012, neck: -0.02, chest: 0.08 } }).body);
      P.add('trim', drizzle(0.21, 0.27, 6, 0.014));
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = cupBase(profile(0, 0), R, 0.226);
      p.line(0.226, 0.3).line(0.236, 0.31).line(0.236, 0.45).line(0.226, 0.46).line(0.226, 0.6).line(0.24, 0.61).line(0.24, 0.66).line(0.2, 0.66).line(0.2, 0.64).line(0, 0.64);
      P.lathe('body', p, { mod: pleats() });
      P.add('body', battlements(8, 0.2, 0.24, 0.655, 0.77, 0.42, 'flat'));
      P.add('trim', drizzle(0.238, 0.38, 8, 0.03)); P.add('trim', drizzle(0.23, 0.54, 8, 0.025));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = cupBase(profile(0, 0), R, 0.09, 0.85);
      p.curve([[0.08, 0.17], [0.07, 0.24], [0.068, 0.3]]);
      ballHead(p, 0.068, 0.41, 0.13);
      P.lathe('body', p, { mod: pleats(0.85) });
      P.add('trim', drizzle(0.12, 0.47, 5, 0.03, 0.007));
      return P;
    },
  };

  // ------------------------------------------------------------------ Jade & Onyx (stones of legend)
  // Square-cut like standing stones and obelisks: every piece is carved four-sided.
  const square = (y0, y1, round) => MOD.facets(4, y0, y1, round === undefined ? 0.3 : round);
  function monoBase(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).line(R, 0.05 * k).curve([[R - 0.03, 0.068 * k], [R - 0.07, 0.088 * k]]).line(top + 0.02, 0.11 * k).line(top, 0.14 * k);
  }
  // Lathed with the square turned to face the front.
  const sqLathe = (P, slot, prof, o) => P.add(slot, revolve(prof, Object.assign({ segs: Q.segs }, o || {})).rotateY(Math.PI / 4));
  const MONOLITH = {
    k() {
      const R = 0.33, P = new Piece();
      const p = monoBase(profile(0, 0), R, 0.15).line(0.118, 0.9).line(0.15, 0.91).line(0.15, 0.96).line(0.1, 0.97).line(0.035, 1.1).line(0, 1.11);
      sqLathe(P, 'body', p, { mod: square(-1, 2, 0.2) });
      sqLathe(P, 'trim', profile(0, 0.5).line(0.136, 0.5).line(0.136, 0.52).line(0, 0.52), { mod: square(-1, 2, 0.2) });
      P.add('trim', placeAt(crossOf('maltese', 0.24, 0.05), 0, 0, 1.25));
      return P;
    },
    q() {
      const R = 0.318, P = new Piece();
      const p = monoBase(profile(0, 0), R, 0.142).line(0.11, 0.8).line(0.15, 0.81).line(0.15, 0.85).line(0.13, 0.86)
        .curve([[0.16, 0.92], [0.17, 0.98]]).line(0.15, 0.99).curve([[0.12, 0.97], [0.08, 0.96]]).line(0, 0.955);
      sqLathe(P, 'body', p, { mod: square(-1, 2, 0.2), lift: (th, y) => -0.06 * Math.pow(Math.abs(Math.sin(th * 2)), 0.7) * smooth(0.9, 0.99, y) });
      sqLathe(P, 'trim', profile(0, 0.46).line(0.13, 0.46).line(0.13, 0.48).line(0, 0.48), { mod: square(-1, 2, 0.2) });
      P.add('body', sphere(0.075, 0, 1.03, 0, 24));
      P.add('trim', sphere(0.025, 0, 1.12, 0, 12));
      return P;
    },
    b() {
      const R = 0.3, P = new Piece();
      const p = monoBase(profile(0, 0), R, 0.13).line(0.1, 0.56).line(0.14, 0.57).line(0.14, 0.61).line(0.09, 0.62)
        .curve([[0.13, 0.68], [0.14, 0.78], [0.12, 0.9], [0.07, 0.99], [0.02, 1.03]]).line(0, 1.032);
      sqLathe(P, 'body', p, { mod: mods([square(-1, 0.63, 0.2), square(0.63, 2, 0.6), MOD.slit(Math.PI / 4, 0.86, 0.6, 0.02, 0.55)]) });
      sqLathe(P, 'trim', profile(0, 0.42).line(0.12, 0.42).line(0.12, 0.44).line(0, 0.44), { mod: square(-1, 2, 0.2) });
      return P;
    },
    n() {
      const R = 0.31, P = new Piece();
      sqLathe(P, 'body', monoBase(profile(0, 0), R, 0.2).line(0.2, 0.3).line(0, 0.3), { mod: square(-1, 2, 0.2) });
      P.add('body', horse({ base: 0.3, mane: 'carved', seed: 13, form: { tuck: 0.24, neck: -0.03, girth: 1.04, nose: 0.012, ears: 0.1, jaw: 0.01 } }).body);
      return P;
    },
    r() {
      const R = 0.31, P = new Piece(), top = 0.66, hw = 0.198 * Math.SQRT1_2;
      sqLathe(P, 'body', monoBase(profile(0, 0), R, 0.2).line(0.198, top).line(0, top), { mod: square(-1, 2, 0.08) });
      // eight square merlons round the edge of a square tower
      for (const [x, z] of [[-1, -1], [-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1]]) {
        const b = new THREE.BoxGeometry(0.056, 0.12, 0.056);
        b.translate(x * (hw - 0.028), top + 0.055, z * (hw - 0.028));
        P.add('body', b);
      }
      sqLathe(P, 'trim', profile(0, 0.5).line(0.2, 0.5).line(0.2, 0.52).line(0, 0.52), { mod: square(-1, 2, 0.08) });
      return P;
    },
    p() {
      const R = 0.255, P = new Piece();
      const p = monoBase(profile(0, 0), R, 0.1, 0.85).line(0.085, 0.32).line(0.11, 0.33).line(0.11, 0.36).line(0.066, 0.37);
      sqLathe(P, 'body', p, { mod: square(-1, 0.365, 0.2) });
      P.add('body', sphere(0.112, 0, 0.47, 0, 32));
      return P;
    },
  };

  // ------------------------------------------------------------------ Gold & Platinum (the trophy cabinet)
  // Every piece is a trophy: stepped socles, knopped stems, cups with handles.
  function socle(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).line(R, 0.03 * k).line(R - 0.025, 0.035 * k).line(R - 0.025, 0.06 * k)
      .curve([[R - 0.05, 0.07 * k], [R - 0.09, 0.1 * k], [R - 0.11, 0.13 * k]]).line(top + 0.02, 0.135 * k).line(top, 0.15 * k);
  }
  const TROPHY = {
    k() {
      const R = 0.34, P = new Piece();
      const p = socle(profile(0, 0), R, 0.07);
      p.line(0.06, 0.26).curve([[0.1, 0.28], [0.1, 0.33], [0.06, 0.35]]).line(0.055, 0.46)
        .curve([[0.13, 0.5], [0.19, 0.58], [0.2, 0.74]]).line(0.212, 0.78).line(0.2, 0.79)
        .curve([[0.19, 0.84], [0.14, 0.9], [0.08, 0.94]]).line(0.05, 0.97).line(0, 0.97);
      P.lathe('body', p, { mod: MOD.flutes(16, 0.06, 0.48, 0.66, { fillet: 0.3, end: 0.04 }) });
      P.add('trim', handles(0.19, 0.55, 0.76, 0.1));
      P.add('trim', ring(0.212, 0.78, 0.009)); P.add('trim', ring(0.1, 0.31, 0.008));
      P.add('trim', sphere(0.045, 0, 1.01, 0, 24));
      P.add('trim', placeAt(crossOf('celtic', 0.24, 0.04), 0, 0, 1.18));
      return P;
    },
    q() {
      const R = 0.33, P = new Piece();
      const p = socle(profile(0, 0), R, 0.066);
      p.line(0.056, 0.25).curve([[0.094, 0.27], [0.094, 0.32], [0.056, 0.34]]).line(0.052, 0.44)
        .curve([[0.13, 0.48], [0.2, 0.58], [0.226, 0.8]]).arc(0.21, 0.81, 0.5)
        .curve([[0.19, 0.74], [0.12, 0.7]]).line(0, 0.69);
      P.lathe('body', p, { mod: MOD.flutes(16, 0.06, 0.46, 0.66, { fillet: 0.3, end: 0.04 }), lift: (th, y) => -0.06 * Math.pow(Math.abs(Math.cos(th * 4)), 0.5) * smooth(0.74, 0.81, y) });
      P.add('trim', handles(0.19, 0.52, 0.72, 0.1));
      P.add('trim', ring(0.1, 0.3, 0.008));
      for (let i = 0; i < 8; i++) { const th = ((i + 0.5) / 8) * TAU; P.add('trim', sphere(0.016, Math.sin(th) * 0.22, 0.818, Math.cos(th) * 0.22, 10)); }
      P.lathe('body', profile(0, 0.69).line(0.09, 0.69).curve([[0.1, 0.78], [0.08, 0.86], [0.04, 0.9]]).line(0, 0.905));
      P.add('trim', sphere(0.05, 0, 0.95, 0, 24));
      return P;
    },
    b() {
      const R = 0.31, P = new Piece();
      const p = socle(profile(0, 0), R, 0.062);
      p.line(0.052, 0.24).curve([[0.09, 0.26], [0.09, 0.31], [0.052, 0.33]]).line(0.05, 0.42)
        .curve([[0.11, 0.45], [0.15, 0.52], [0.15, 0.6]]).line(0.158, 0.62).line(0.14, 0.63)
        .curve([[0.15, 0.7], [0.14, 0.8], [0.11, 0.9], [0.07, 0.97], [0.03, 1.01]]).line(0, 1.012);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.84, 0.6, 0.018, 0.5) });
      P.add('trim', ring(0.158, 0.62, 0.008)); P.add('trim', ring(0.09, 0.29, 0.008));
      P.add('trim', sphere(0.032, 0, 1.04, 0, 16));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(socle(profile(0, 0), R, 0.2), 0.2));
      const h = horse({ base: 0.31, mane: 'flow', seed: 17, form: { neck: 0.05, tuck: -0.08, chest: 0.1, reach: 0.04 } });
      P.add('body', h.body); P.add('trim', h.mane);
      P.add('trim', ring(0.214, 0.3, 0.008));
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = socle(profile(0, 0), R, 0.2);
      p.curve([[0.2, 0.2], [0.21, 0.4], [0.225, 0.6]]).line(0.24, 0.61).line(0.24, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p);
      P.add('body', battlements(6, 0.2, 0.24, 0.635, 0.76, 0.36, 'flat'));
      P.add('trim', handles(0.212, 0.3, 0.54, 0.08, 0.013));
      P.add('trim', ring(0.241, 0.61, 0.008));
      return P;
    },
    p() {
      const R = 0.262, P = new Piece();
      const p = socle(profile(0, 0), R, 0.05, 0.85);
      p.line(0.045, 0.2).curve([[0.08, 0.22], [0.08, 0.27], [0.045, 0.29]]).line(0.05, 0.34);
      ballHead(p, 0.05, 0.44, 0.105);
      P.lathe('body', p);
      P.add('trim', ring(0.08, 0.245, 0.007));
      P.add('trim', ring(0.106, 0.44, 0.006));
      return P;
    },
  };

  // ------------------------------------------------------------------ Ruby Chocolate (2017)
  // Fresh from the mould: soft, rounded pieces built from stacked bubbles.
  function puffBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.05, 0).curve([[R - 0.005, 0.02 * k], [R + 0.005, 0.06 * k], [R - 0.03, 0.1 * k], [R - 0.08, 0.115 * k]]).line(top, 0.125 * k);
  }
  const BUBBLE = {
    k() {
      const R = 0.34, P = new Piece();
      const p = puffBase(profile(0, 0), R, 0.13);
      p.curve([[0.18, 0.2], [0.17, 0.3], [0.11, 0.34]]).curve([[0.16, 0.42], [0.155, 0.53], [0.1, 0.57]])
        .curve([[0.145, 0.65], [0.14, 0.75], [0.095, 0.79]]).curve([[0.175, 0.86], [0.18, 0.98], [0.11, 1.05], [0.04, 1.075]]).line(0, 1.08);
      P.lathe('body', p);
      P.add('body', placeAt(crossOf('capsule', 0.26, 0.06), 0, 0, 1.2));
      return P;
    },
    q() {
      const R = 0.328, P = new Piece();
      const p = puffBase(profile(0, 0), R, 0.125);
      p.curve([[0.172, 0.2], [0.165, 0.29], [0.105, 0.33]]).curve([[0.15, 0.41], [0.145, 0.51], [0.096, 0.55]])
        .curve([[0.17, 0.62], [0.18, 0.74], [0.12, 0.8], [0.05, 0.82]]).line(0, 0.822);
      P.lathe('body', p);
      for (let i = 0; i < 7; i++) { const th = (i / 7) * TAU; P.add('body', sphere(0.04, Math.sin(th) * 0.13, 0.84, Math.cos(th) * 0.13, 16)); }
      P.add('body', sphere(0.09, 0, 0.9, 0, 24));
      P.add('body', sphere(0.04, 0, 1.02, 0, 16));
      return P;
    },
    b() {
      const R = 0.31, P = new Piece();
      const p = puffBase(profile(0, 0), R, 0.12);
      p.curve([[0.165, 0.2], [0.158, 0.29], [0.1, 0.33]]).curve([[0.14, 0.4], [0.135, 0.5], [0.09, 0.54]]);
      ovalHead(p, 0.09, 0.73, 0.15, 0.2);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.8, 0.6, 0.03, 0.6) });
      P.add('body', sphere(0.04, 0, 0.95, 0, 16));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(puffBase(profile(0, 0), R, 0.2), 0.2));
      P.add('body', horse({ base: 0.31, mane: 'none', seed: 5, form: { girth: 1.16, reach: -0.18, ears: -0.25, neck: -0.06, tuck: 0.05, headW: 1.08 } }).body);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = puffBase(profile(0, 0), R, 0.2);
      p.curve([[0.25, 0.22], [0.26, 0.4], [0.24, 0.6]]).line(0.25, 0.62).line(0.25, 0.65).line(0.19, 0.65).line(0.19, 0.63).line(0, 0.63);
      P.lathe('body', p);
      P.add('body', battlements(5, 0.19, 0.25, 0.645, 0.78, 0.3, 'round', 0.06));
      return P;
    },
    p() {
      const R = 0.265, P = new Piece();
      const p = puffBase(profile(0, 0), R, 0.1, 0.85);
      p.curve([[0.13, 0.17], [0.125, 0.24], [0.075, 0.27]]);
      ballHead(p, 0.075, 0.38, 0.13);
      P.lathe('body', p);
      return P;
    },
  };

  // ------------------------------------------------------------------ Milk & Dark (the cocoa harvest)
  // Ribbed cocoa pods on leafy feet: the fruit chocolate comes from.
  function podBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.014 * k, 0.3).line(R - 0.01, 0.04 * k).curve([[R - 0.08, 0.06 * k], [top + 0.02, 0.09 * k]]).line(top, 0.12 * k);
  }
  const ribbed = (y0, y1, n) => MOD.lobes(n || 10, 0.12, y0, y1, { shape: 2.4, end: 0.05 });
  const leafCollar = (n, r, y, w, h, tilt) => around(n, r, y, () => curl(leaf(w, h, 0.01), 2.5), { tilt: tilt || 0.9 });
  const POD = {
    k() {
      const R = 0.34, P = new Piece();
      const p = podBase(profile(0, 0), R, 0.08);
      p.line(0.07, 0.22).curve([[0.13, 0.28], [0.17, 0.42], [0.172, 0.6], [0.15, 0.78], [0.1, 0.9], [0.06, 0.94]]).line(0, 0.945);
      P.lathe('body', p, { mod: ribbed(0.25, 0.94) });
      P.add('body', leafCollar(6, 0.1, 0.15, 0.11, 0.15, 1.0));
      P.add('body', leafCollar(5, 0.05, 0.93, 0.08, 0.11, 0.7));
      P.add('body', placeAt(crossOf('leaf', 0.25, 0.04), 0, 0, 1.15));
      return P;
    },
    q() {
      const R = 0.33, P = new Piece();
      const p = podBase(profile(0, 0), R, 0.076);
      p.line(0.068, 0.2).curve([[0.12, 0.26], [0.16, 0.38], [0.162, 0.54], [0.14, 0.7], [0.1, 0.78]]).line(0, 0.78);
      P.lathe('body', p, { mod: ribbed(0.22, 0.78) });
      P.add('body', leafCollar(6, 0.1, 0.15, 0.1, 0.14, 1.0));
      // the pod opens into a crown of leaves round a cluster of beans
      P.add('body', around(7, 0.09, 0.77, () => curl(leaf(0.09, 0.2, 0.01), -1.5), { tilt: 0.45 }));
      for (let i = 0; i < 5; i++) { const th = (i / 5) * TAU, g = sphere(0.04, 0, 0, 0, 16); g.scale(0.8, 1.3, 0.8); g.translate(Math.sin(th) * 0.045, 0.84, Math.cos(th) * 0.045); P.add('body', g); }
      const g = sphere(0.045, 0, 0, 0, 16); g.scale(0.85, 1.3, 0.85); g.translate(0, 0.92, 0); P.add('body', g);
      return P;
    },
    b() {
      const R = 0.31, P = new Piece();
      const p = podBase(profile(0, 0), R, 0.07);
      p.line(0.065, 0.36).curve([[0.11, 0.42], [0.14, 0.56], [0.138, 0.72], [0.11, 0.86], [0.06, 0.97], [0.02, 1.02]]).line(0, 1.022);
      P.lathe('body', p, { mod: mods([ribbed(0.4, 1.0, 8), MOD.slit(Math.PI * 0.25, 0.8, 0.6, 0.018, 0.5)]) });
      P.add('body', leafCollar(5, 0.07, 0.36, 0.09, 0.12, 0.8));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(podBase(profile(0, 0), R, 0.2), 0.2));
      P.add('body', horse({ base: 0.31, mane: 'carved', seed: 19, form: { tuck: 0.12, reach: 0.06, neck: 0.03, chest: 0.05, ears: 0.15 } }).body);
      P.add('body', leafCollar(7, 0.2, 0.15, 0.1, 0.12, 1.2));
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = podBase(profile(0, 0), R, 0.215);
      p.curve([[0.22, 0.3], [0.212, 0.45], [0.22, 0.6]]).line(0.24, 0.61).line(0.24, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p, { mod: MOD.flutes(13, 0.05, 0.13, 0.6, { twist: 1.5, soft: true, sharp: 2.5 }) });
      P.add('body', battlements(7, 0.2, 0.24, 0.635, 0.76, 0.34, 'flat'));
      P.add('body', leafCollar(7, 0.21, 0.13, 0.1, 0.13, 1.25));
      return P;
    },
    p() {
      const R = 0.262, P = new Piece();
      const p = podBase(profile(0, 0), R, 0.07, 0.85).line(0.062, 0.3);
      ovalHead(p, 0.062, 0.43, 0.1, 0.13);
      P.lathe('body', p, { mod: MOD.lobes(2, 0.1, 0.32, 0.56, { shape: 1, end: 0.04 }) });
      P.add('body', leafCollar(4, 0.06, 0.26, 0.075, 0.1, 0.9));
      return P;
    },
  };

  // ------------------------------------------------------------------ Caramel & Cream (the cocoa harvest)
  // Barley-sugar twists: pulled caramel wound into spirals on every stem and crown.
  function twistFoot(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3).curve([[R - 0.01, 0.05 * k], [R - 0.07, 0.09 * k], [R - 0.13, 0.11 * k]]).line(top + 0.01, 0.13 * k).line(top, 0.15 * k);
  }
  const barley = (y0, y1, turns) => MOD.rope(2, 0.34, y0, y1, turns);
  const swirlFoot = (k) => MOD.flutes(12, 0.08, 0.02, 0.11 * (k || 1), { twist: 22, soft: true, end: 0.02 });
  const BARLEY = {
    k() {
      const R = 0.35, P = new Piece();
      const p = twistFoot(profile(0, 0), R, 0.14);
      p.line(0.13, 0.78).line(0.17, 0.79).line(0.17, 0.83).line(0.12, 0.84)
        .curve([[0.17, 0.9], [0.19, 0.98], [0.15, 1.06], [0.08, 1.12], [0.03, 1.18]]).line(0, 1.185);
      P.lathe('body', p, { mod: mods([swirlFoot(), barley(0.17, 0.77, 3), MOD.flutes(8, 0.12, 0.85, 1.17, { twist: 10, soft: true, end: 0.04 })]) });
      P.add('trim', ring(0.17, 0.81, 0.008));
      P.add('trim', placeAt(crossOf('star4', 0.26, 0.04), 0, 0, 1.32));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = twistFoot(profile(0, 0), R, 0.13);
      p.line(0.12, 0.7).line(0.16, 0.71).line(0.16, 0.75).line(0.11, 0.76)
        .curve([[0.15, 0.82], [0.2, 0.9], [0.214, 0.98]]).arc(0.2, 0.99, 0.5).curve([[0.17, 0.95], [0.1, 0.92]]).line(0, 0.915);
      const N = 7;
      P.lathe('body', p, { mod: mods([swirlFoot(), barley(0.16, 0.69, 2.6)]), lift: (th, y) => -0.08 * Math.pow(Math.abs(Math.cos(((th + (y - 0.8) * 4) * N) / 2)), 0.6) * smooth(0.88, 0.99, y) });
      P.add('trim', ring(0.16, 0.73, 0.008));
      P.lathe('body', profile(0, 0.91).line(0.09, 0.91).curve([[0.1, 0.98], [0.08, 1.05], [0.04, 1.09]]).line(0, 1.095), { mod: MOD.flutes(6, 0.15, 0.91, 1.09, { twist: 14, soft: true }) });
      P.add('trim', sphere(0.036, 0, 1.12, 0, 16));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = twistFoot(profile(0, 0), R, 0.12);
      p.line(0.11, 0.56).line(0.15, 0.57).line(0.15, 0.61).line(0.09, 0.62)
        .curve([[0.12, 0.68], [0.124, 0.78], [0.1, 0.9], [0.06, 1.0], [0.016, 1.07]]).line(0, 1.072);
      P.lathe('body', p, { mod: mods([swirlFoot(), barley(0.16, 0.55, 2.2), MOD.slit(Math.PI * 0.25, 0.86, 0.6, 0.017, 0.5)]) });
      P.add('trim', ring(0.15, 0.59, 0.008));
      P.add('trim', sphere(0.026, 0, 1.08, 0, 14));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(twistFoot(profile(0, 0), R, 0.2), 0.2), { mod: swirlFoot() });
      const h = horse({ base: 0.31, mane: 'flow', seed: 23, form: { tuck: -0.06, neck: 0.08, lean: 0.05, reach: 0.04, chest: 0.06 } });
      P.add('body', h.body); P.add('trim', h.mane);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = twistFoot(profile(0, 0), R, 0.22);
      p.line(0.22, 0.58).line(0.248, 0.59).line(0.248, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p, { mod: mods([swirlFoot(), MOD.rope(6, 0.12, 0.16, 0.58, 1.2)]) });
      P.add('body', battlements(6, 0.2, 0.248, 0.635, 0.76, 0.36, 'flat'));
      P.add('trim', ring(0.249, 0.6, 0.008));
      return P;
    },
    p() {
      const R = 0.272, P = new Piece();
      const p = twistFoot(profile(0, 0), R, 0.09, 0.85).line(0.08, 0.32).line(0.11, 0.33).line(0.11, 0.36).line(0.066, 0.37);
      ballHead(p, 0.066, 0.48, 0.112);
      P.lathe('body', p, { mod: mods([swirlFoot(0.85), barley(0.14, 0.32, 1.4)]) });
      P.add('trim', ring(0.11, 0.345, 0.007));
      return P;
    },
  };

  // ------------------------------------------------------------------ Crystal Jewels (premium)
  // Cut crystal, clear against jet, every piece set with its own coloured gems: sapphires for
  // the king, rubies for the queen, amethysts for the bishop, emeralds for the knight,
  // golden topaz for the rook and aquamarines for the pawn.
  const CUT = 10;
  function crystalBase(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).line(R, 0.03 * k).line(R - 0.03, 0.06 * k).line(R - 0.08, 0.08 * k).line(top + 0.03, 0.1 * k).line(top, 0.14 * k);
  }
  const CRYSTAL = {
    k() {
      const R = 0.34, P = new Piece();
      cutLathe(P, 'body', crystalBase(profile(0, 0), R, 0.15).line(0.11, 0.78).line(0.16, 0.8).line(0.16, 0.84).line(0.11, 0.86)
        .line(0.17, 0.95).line(0.17, 1.0).line(0.1, 1.1).line(0, 1.14), CUT);
      P.add('trim', ring(0.162, 0.82, 0.01).rotateY(Math.PI / CUT));
      P.add('gemk', gemRing(CUT, 0.166, 0.82, 0.024, { phase: Math.PI / CUT }));
      P.add('gemk', gemRing(CUT, 0.172, 0.975, 0.022));
      P.add('gemk', pave(3, 7, (y) => mix(0.15, 0.11, (y - 0.14) / 0.64), 0.18, 0.74, 0.02, 0.5));
      P.add('gemk', gemRing(5, R - 0.03, 0.04, 0.026));
      P.add('body', placeAt(crossOf('lozenge', 0.28, 0.05), 0, 0, 1.29));
      P.add('gemk', placeAt(brilliant(0.034), 0, 0, 1.29).translate(0, 0, 0.026));
      return P;
    },
    q() {
      const R = 0.33, P = new Piece();
      cutLathe(P, 'body', crystalBase(profile(0, 0), R, 0.14).line(0.1, 0.68).line(0.15, 0.7).line(0.15, 0.74).line(0.1, 0.76)
        .line(0.22, 0.98).line(0.205, 1.0).line(0.1, 0.92).line(0, 0.92), CUT, { lift: (th, y) => -0.1 * Math.pow(Math.abs(Math.cos((th * CUT) / 2)), 0.5) * smooth(0.86, 1.0, y) });
      P.add('trim', ring(0.152, 0.72, 0.009).rotateY(Math.PI / CUT));
      P.add('gemq', gemRing(CUT, 0.156, 0.72, 0.023, { phase: Math.PI / CUT }));
      for (let i = 0; i < CUT; i++) { const th = (i / CUT) * TAU; P.add('gemq', placeAt(brilliant(0.024), th, 0.215, 1.0, { tilt: -Math.PI / 2 })); }
      P.add('gemq', pave(3, 6, (y) => mix(0.14, 0.1, (y - 0.14) / 0.54), 0.18, 0.64, 0.019, -0.5));
      P.add('gemq', gemRing(5, R - 0.03, 0.04, 0.025));
      P.add('gemq', placeAt(brilliant(0.06), 0, 0, 1.0, { tilt: -Math.PI / 2 }));
      return P;
    },
    b() {
      const R = 0.31, P = new Piece();
      cutLathe(P, 'body', crystalBase(profile(0, 0), R, 0.13).line(0.1, 0.56).line(0.14, 0.58).line(0.14, 0.62).line(0.1, 0.63)
        .line(0.14, 0.74).line(0.13, 0.86).line(0.08, 0.98).line(0, 1.04), 8, { mod: MOD.slit(Math.PI * 0.25, 0.84, 0.6, 0.02, 0.5) });
      P.add('trim', ring(0.142, 0.6, 0.008).rotateY(Math.PI / 8));
      P.add('gemb', gemRing(8, 0.146, 0.6, 0.022, { phase: Math.PI / 8 }));
      P.add('gemb', pave(2, 6, (y) => mix(0.135, 0.1, (y - 0.14) / 0.42), 0.18, 0.52, 0.019, 0.5));
      P.add('gemb', placeAt(brilliant(0.026), Math.PI, 0.14, 0.76));
      P.add('gemb', gemRing(5, R - 0.03, 0.04, 0.024));
      P.add('gemb', placeAt(brilliant(0.036), 0, 0, 1.065, { tilt: -Math.PI / 2 }));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      cutLathe(P, 'body', knightBase(crystalBase(profile(0, 0), R, 0.2), 0.2), CUT);
      const h = horse({ base: 0.31, mane: 'roach', seed: 29, form: { facet: 0.02, tuck: 0.06, neck: 0.06, lean: 0.04, girth: 0.92, ears: 0.15 } });
      P.add('body', h.body);
      const br = bridle(h, { stud: 0.026, thick: 0.007 });
      P.add('trim', br.straps); P.add('gemn', br.studs);
      P.add('gemn', gemRing(5, R - 0.03, 0.04, 0.025));
      P.add('gemn', gemRing(CUT, 0.214, 0.26, 0.022, { phase: Math.PI / CUT }));
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      cutLathe(P, 'body', crystalBase(profile(0, 0), R, 0.215).line(0.2, 0.58).line(0.24, 0.6).line(0.24, 0.64).line(0.19, 0.64).line(0.19, 0.62).line(0, 0.62), 8);
      P.add('body', battlements(8, 0.19, 0.24, 0.635, 0.77, 0.36, 'flat'));
      for (let i = 0; i < 8; i++) P.add('gemr', placeAt(brilliant(0.024), (i / 8) * TAU, 0.244, 0.7));
      P.add('gemr', gemRing(8, 0.206, 0.48, 0.028, { phase: Math.PI / 8 }));
      P.add('gemr', gemRing(8, 0.212, 0.3, 0.028));
      P.add('gemr', gemRing(5, R - 0.03, 0.04, 0.025));
      return P;
    },
    p() {
      const R = 0.265, P = new Piece();
      const p = crystalBase(profile(0, 0), R, 0.09, 0.85).line(0.075, 0.3).line(0.11, 0.32).line(0.11, 0.34).line(0.07, 0.35);
      cutLathe(P, 'body', ovalHead(p, 0.07, 0.46, 0.115, 0.115), CUT);
      P.add('gemp', gemRing(CUT, 0.112, 0.33, 0.02));
      P.add('gemp', gemRing(4, R - 0.03, 0.035, 0.022, { phase: Math.PI / 4 }));
      P.add('gemp', placeAt(brilliant(0.032), 0, 0, 0.585, { tilt: -Math.PI / 2 }));
      return P;
    },
  };

  // ------------------------------------------------------------------ Celestial Opal (premium)
  // White and black opal under silver stars: moons, comets and little ringed planets.
  function orbitBase(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3).line(R, 0.03 * k).arc(R - 0.012, 0.042 * k, 0.3)
      .curve([[R - 0.05, 0.06 * k], [R - 0.12, 0.09 * k], [top + 0.02, 0.12 * k]]).line(top, 0.15 * k);
  }
  const orbit = (r, y, tilt, thick) => ring(r, 0, thick || 0.008).rotateZ(tilt || 0.35).translate(0, y, 0);
  const CELESTIAL = {
    k() {
      const R = 0.35, P = new Piece();
      const p = orbitBase(profile(0, 0), R, 0.15);
      p.curve([[0.14, 0.3], [0.12, 0.5], [0.112, 0.7]]).line(0.15, 0.71).line(0.15, 0.74).line(0.1, 0.75).line(0.08, 0.8);
      ballHead(p, 0.08, 0.93, 0.14);
      P.lathe('body', p);
      P.add('trim', orbit(0.2, 0.93, 0.4, 0.011));
      P.add('accent', around(8, 0.14, 0.4, () => star(0.026, 0.008)));
      P.add('trim', ring(0.15, 0.725, 0.008));
      P.add('trim', placeAt(crossOf('rayed', 0.24, 0.04), 0, 0, 1.2));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = orbitBase(profile(0, 0), R, 0.142);
      p.curve([[0.13, 0.3], [0.112, 0.48], [0.104, 0.64]]).line(0.14, 0.65).line(0.14, 0.68).line(0.1, 0.69)
        .curve([[0.13, 0.75], [0.15, 0.82], [0.13, 0.88], [0.06, 0.9]]).line(0, 0.9);
      P.lathe('body', p);
      // a crescent moon cradling a star
      P.add('trim', placeAt(crescent(0.17, 0.035), 0, 0, 1.03));
      P.add('accent', placeAt(star(0.06, 0.03), 0, 0, 1.06));
      P.add('accent', around(8, 0.13, 0.4, () => star(0.024, 0.008)));
      P.add('trim', ring(0.14, 0.665, 0.008));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = orbitBase(profile(0, 0), R, 0.13);
      p.curve([[0.12, 0.28], [0.104, 0.44], [0.098, 0.56]]).line(0.135, 0.57).line(0.135, 0.6).line(0.09, 0.61)
        .curve([[0.13, 0.68], [0.14, 0.78], [0.12, 0.88], [0.08, 0.96], [0.03, 1.0]]).line(0, 1.002);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.84, 0.6, 0.018, 0.5) });
      P.add('trim', orbit(0.155, 0.76, -0.45, 0.008));
      P.add('trim', ring(0.135, 0.585, 0.008));
      P.add('accent', placeAt(star(0.045, 0.02), 0, 0, 1.06));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(orbitBase(profile(0, 0), R, 0.2), 0.2));
      const h = horse({ base: 0.31, mane: 'flow', seed: 31, form: { tuck: -0.12, neck: 0.12, reach: 0.05, ears: 0.2, girth: 0.9 } });
      P.add('body', h.body); P.add('trim', h.mane);
      const sp = h.surf([0, h.Y(0.9), 0.08], [0, 0.4, 1], 0.004), s = star(0.03, 0.01); s.rotateX(-0.5); s.translate(sp[0], sp[1], sp[2]); P.add('accent', s);
      P.add('trim', ring(0.214, 0.3, 0.008));
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = orbitBase(profile(0, 0), R, 0.22);
      p.curve([[0.226, 0.3], [0.22, 0.45], [0.224, 0.58]]).line(0.244, 0.59).line(0.244, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p);
      P.add('body', battlements(6, 0.2, 0.244, 0.635, 0.76, 0.38, 'flat'));
      // an observatory dome inside the battlements
      P.lathe('body', profile(0, 0.62).line(0.13, 0.62).curve([[0.13, 0.7], [0.09, 0.77], [0, 0.79]]), { mod: MOD.crenel(1, 0.66, 0.8, 0.12, 0.2) });
      P.add('accent', around(6, 0.226, 0.42, () => star(0.03, 0.01), { phase: Math.PI / 6 }));
      P.add('trim', ring(0.245, 0.6, 0.008));
      return P;
    },
    p() {
      const R = 0.27, P = new Piece();
      const p = orbitBase(profile(0, 0), R, 0.1, 0.85);
      p.curve([[0.094, 0.24], [0.086, 0.3], [0.07, 0.36]]);
      ballHead(p, 0.07, 0.47, 0.105);
      P.lathe('body', p);
      P.add('trim', orbit(0.15, 0.47, 0.42, 0.009));
      return P;
    },
  };

  // ------------------------------------------------------------------ Peacock Court (premium)
  // Ivory and peacock-blue enamel in gold, with fanned tails, feather eyes and crests.
  function vaseFoot(p, R, top, k) {
    k = k || 1;
    return p.line(R - 0.01, 0).arc(R, 0.014 * k, 0.3).line(R - 0.02, 0.04 * k).curve([[R - 0.06, 0.05 * k], [R - 0.1, 0.08 * k], [top + 0.04, 0.1 * k]]).curve([[top + 0.01, 0.13 * k], [top, 0.16 * k]]);
  }
  // A peacock feather: a long gold vane with an enamel eye near the tip, standing up +y.
  function feather(len, w) {
    const vane = petal(w, len, 0.008);
    const eye = cabochon(w * 0.36, 0.5); eye.translate(0, len * 0.72, 0.006);
    return { vane, eye };
  }
  // A peacock's crest: little stalks each ending in a bead.
  function crest(y, n, len, spread) {
    const stalks = [], beads = [];
    for (let i = 0; i < n; i++) {
      const k = n > 1 ? i / (n - 1) - 0.5 : 0, a = k * spread, x = Math.sin(a) * len, yy = y + Math.cos(a) * len;
      stalks.push(K.tube([[0, y, 0], [x * 0.5, y + (yy - y) * 0.55, 0], [x, yy, 0]], 0.005, { segs: 8, radial: 6 }));
      beads.push(sphere(0.016, x, yy + 0.01, 0, 10));
    }
    return { stalks: merge(stalks), beads: merge(beads) };
  }
  const PEACOCK = {
    k() {
      const R = 0.345, P = new Piece();
      const p = vaseFoot(profile(0, 0), R, 0.12);
      p.curve([[0.15, 0.24], [0.17, 0.36], [0.15, 0.5], [0.11, 0.62], [0.1, 0.72]]).line(0.15, 0.73).line(0.15, 0.77).line(0.11, 0.78)
        .curve([[0.15, 0.84], [0.16, 0.92], [0.12, 0.98], [0.05, 1.0]]).line(0, 1.0);
      P.lathe('body', p);
      // three feathers fan up behind the crown
      [-0.5, 0, 0.5].forEach((a) => { const f = feather(0.38, 0.12); for (const g of [f.vane, f.eye]) { g.rotateX(-0.25); g.rotateZ(a); g.translate(0, 0.84, -0.11); } P.add('trim', f.vane); P.add('accent', f.eye); });
      P.add('trim', ring(0.15, 0.75, 0.009));
      P.add('accent', around(6, 0.164, 0.36, () => cabochon(0.02, 0.6)));
      P.add('trim', placeAt(crossOf('quatrefoil', 0.22, 0.04), 0, 0, 1.14));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = vaseFoot(profile(0, 0), R, 0.115);
      p.curve([[0.142, 0.23], [0.16, 0.34], [0.14, 0.47], [0.1, 0.58], [0.094, 0.66]]).line(0.14, 0.67).line(0.14, 0.71).line(0.1, 0.72)
        .curve([[0.13, 0.78], [0.13, 0.84], [0.08, 0.88]]).line(0, 0.88);
      P.lathe('body', p);
      // a full fanned tail all the way round
      P.add('trim', around(11, 0.06, 0.82, () => feather(0.3, 0.1).vane, { tilt: 0.6 }));
      P.add('accent', around(11, 0.06, 0.82, () => feather(0.3, 0.1).eye, { tilt: 0.6 }));
      P.add('trim', ring(0.14, 0.69, 0.009));
      P.add('trim', sphere(0.045, 0, 0.93, 0, 20));
      P.add('accent', around(6, 0.154, 0.34, () => cabochon(0.019, 0.6)));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = vaseFoot(profile(0, 0), R, 0.11);
      p.curve([[0.13, 0.22], [0.146, 0.31], [0.126, 0.42], [0.09, 0.52], [0.086, 0.56]]).line(0.13, 0.57).line(0.13, 0.61).line(0.09, 0.62)
        .curve([[0.13, 0.68], [0.14, 0.78], [0.12, 0.88], [0.08, 0.95], [0.03, 0.99]]).line(0, 0.992);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.83, 0.6, 0.018, 0.5) });
      const c = crest(0.98, 5, 0.12, 0.9);
      P.add('trim', c.stalks); P.add('accent', c.beads);
      P.add('trim', ring(0.13, 0.59, 0.008));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(vaseFoot(profile(0, 0), R, 0.2), 0.2));
      const h = horse({ base: 0.31, mane: 'carved', seed: 37, form: { tuck: 0.16, neck: 0.04, nose: -0.012, ears: 0.12, chest: 0.06 } });
      P.add('body', h.body);
      const pl = plume(h, { count: 3, len: 0.24, w: 0.07, spread: 0.6, lean: 0.3 });
      P.add('trim', pl.feathers); P.add('accent', pl.holder);
      P.add('trim', ring(0.214, 0.3, 0.008));
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      const p = vaseFoot(profile(0, 0), R, 0.22);
      p.curve([[0.226, 0.26], [0.218, 0.45], [0.222, 0.58]]).line(0.244, 0.59).line(0.244, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p);
      P.add('body', battlements(10, 0.2, 0.244, 0.635, 0.75, 0.42, 'flat'));
      P.add('trim', around(8, 0.222, 0.3, () => feather(0.2, 0.06).vane, { phase: Math.PI / 8 }));
      P.add('accent', around(8, 0.226, 0.3, () => feather(0.2, 0.06).eye, { phase: Math.PI / 8 }));
      P.add('trim', ring(0.245, 0.6, 0.008));
      return P;
    },
    p() {
      const R = 0.27, P = new Piece();
      const p = vaseFoot(profile(0, 0), R, 0.09, 0.85);
      p.curve([[0.1, 0.22], [0.11, 0.28], [0.08, 0.34], [0.066, 0.37]]);
      ballHead(p, 0.066, 0.47, 0.105);
      P.lathe('body', p);
      const c = crest(0.57, 3, 0.08, 0.7);
      P.add('trim', c.stalks); P.add('accent', c.beads);
      return P;
    },
  };

  // ------------------------------------------------------------------ figures
  // Figurative pieces (soldiers, riders, elephants, camels) are sculpted from soft parts and
  // meshed like the horse. Every part keeps a bounding sphere, so a sample only pays for the
  // parts near it. Props that must stay crisp at any detail (swords, shields, crowns,
  // howdahs) are ordinary geometry added beside the sculpt.
  // coarse > 1 meshes a big smooth part (a robe, an elephant) on a wider grid.
  function Sculpt(k, coarse) { this.parts = []; this.k = k === undefined ? 0.016 : k; this.floor = null; this.coarse = coarse || 1; }
  Sculpt.prototype._push = function (f, cx, cy, cz, r, k, cut) {
    this.parts.push({ f, cx, cy, cz, r, k: k === undefined ? this.k : k, cut: !!cut });
    return this;
  };
  // an ellipsoid at c with radii rad
  Sculpt.prototype.ell = function (c, rad, k, cut) {
    const [cx, cy, cz] = c, [rx, ry, rz] = rad;
    return this._push((x, y, z) => SD.ellipsoid(x, y, z, cx, cy, cz, rx, ry, rz), cx, cy, cz, Math.max(rx, ry, rz), k, cut);
  };
  // a cone between a sphere of radius r1 at a and one of r2 at b
  Sculpt.prototype.cone = function (a, b, r1, r2, k, cut) {
    const l = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (l < 1e-5) return this.ell(a, [r1, r1, r1], k, cut);
    return this._push((x, y, z) => SD.roundCone(x, y, z, a[0], a[1], a[2], b[0], b[1], b[2], r1, r2),
      (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, l / 2 + Math.max(r1, r2), k, cut);
  };
  // a rounded box centred at c with half sizes h
  Sculpt.prototype.box = function (c, h, round, k, cut) {
    const [cx, cy, cz] = c, [hx, hy, hz] = h;
    return this._push((x, y, z) => SD.box(x, y, z, cx, cy, cz, hx, hy, hz, round || 0), cx, cy, cz, Math.hypot(hx, hy, hz), k, cut);
  };
  // a smooth limb through [[x, y, z, r], ...]
  Sculpt.prototype.chain = function (pts, k, n) {
    const s = n ? spline(pts, n) : pts;
    for (let i = 0; i < s.length - 1; i++) this.cone(s[i], s[i + 1], s[i][3], s[i + 1][3], k);
    return this;
  };
  // the same part on both sides: fn(sign) is called with -1 and +1
  Sculpt.prototype.pair = function (fn) { fn(-1); fn(1); return this; };
  Sculpt.prototype.field = function () {
    const parts = this.parts, floor = this.floor;
    return (x, y, z) => {
      let d = 1;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i], ex = x - p.cx, ey = y - p.cy, ez = z - p.cz, far = Math.sqrt(ex * ex + ey * ey + ez * ez) - p.r;
        if (p.cut) { if (far < p.k) d = SD.smax(d, -p.f(x, y, z), p.k); }
        else if (far < d + p.k) d = SD.smin(d, p.f(x, y, z), p.k);
      }
      return floor === null ? d : Math.max(d, floor - y);
    };
  };
  Sculpt.prototype.bounds = function () {
    const b = [1e9, 1e9, 1e9, -1e9, -1e9, -1e9];
    for (const p of this.parts) {
      if (p.cut) continue;
      b[0] = Math.min(b[0], p.cx - p.r); b[1] = Math.min(b[1], p.cy - p.r); b[2] = Math.min(b[2], p.cz - p.r);
      b[3] = Math.max(b[3], p.cx + p.r); b[4] = Math.max(b[4], p.cy + p.r); b[5] = Math.max(b[5], p.cz + p.r);
    }
    if (this.floor !== null) b[1] = Math.max(b[1], this.floor - 0.01);
    return b.map((v, i) => v + (i < 3 ? -0.012 : 0.012));
  };
  Sculpt.prototype.mesh = function (cell, wrap) {
    if (!this.parts.length) return null;
    const f = this.field();
    return sdfGeometry(wrap ? wrap(f) : f, this.bounds(), cell || Q.cell * this.coarse);
  };
  // A cloth draped over a sculpted body: a shell `thick` outside it, kept where keep(x, y, z) < 0.
  function drape(body, thick, keep) {
    return (x, y, z) => { const d = body(x, y, z); return Math.max(Math.max(d - thick, -d), keep(x, y, z)); };
  }
  // Turn a finished piece about its upright axis, so figures stand three-quarters on to the
  // player instead of showing their backs.
  function turnPiece(P, a) {
    for (const slot of Object.keys(P.parts)) for (const g of P.parts[slot]) g.rotateY(a);
    return P;
  }

  // Simple props, built at the origin and placed by the caller.
  // A sword pointing up +y with its grip at the origin: blade (steel) and hilt (trim).
  function sword(len, w) {
    const blade = extrude([[0, len], [w * 0.5, len - w * 1.2], [w * 0.5, 0.03], [-w * 0.5, 0.03], [-w * 0.5, len - w * 1.2]], w * 0.28, w * 0.1, { bevelSegments: 1 });
    const guard = new THREE.BoxGeometry(w * 3, w * 0.55, w * 0.7); guard.translate(0, 0.03, 0);
    const grip = new THREE.CylinderGeometry(w * 0.3, w * 0.3, 0.06, 8); grip.translate(0, 0, 0);
    const pommel = sphere(w * 0.5, 0, -0.035, 0, 10);
    return { blade, hilt: merge([guard, grip, pommel]) };
  }
  // A round shield facing +z: a shallow dome with a rim and a boss.
  function shield(r, dome) {
    const p = profile(0, dome).curve([[r * 0.5, dome * 0.8], [r * 0.9, dome * 0.25], [r, 0]]).line(r * 0.96, -0.012).line(0, -0.012 + dome * 0.6);
    const face = revolve(p, { segs: 40 }); face.rotateX(Math.PI / 2);
    const rim = ring(r, 0, 0.008, { seg: 40 }); rim.rotateX(Math.PI / 2);
    const boss = sphere(r * 0.24, 0, 0, dome - r * 0.12, 14); boss.scale(1, 1, 0.6);
    return { face, rim, boss };
  }
  // A spear standing up +y: a shaft from 0 to len and a leaf-shaped head.
  function spear(len, r) {
    const shaft = new THREE.CylinderGeometry(r, r, len, 8); shaft.translate(0, len / 2, 0);
    const head = extrude([[0, 0.07], [r * 3, 0.025], [r * 1.2, 0], [-r * 1.2, 0], [-r * 3, 0.025]], r * 1.4, r * 0.4, { bevelSegments: 1 }); head.translate(0, len, 0);
    return { shaft, head };
  }
  // A helmet over a head of radius r centred at c: a dome, a brim and a crest.
  function helmet(c, r, o) {
    o = o || {};
    const dome = new THREE.SphereGeometry(r * 1.1, 24, 12, 0, TAU, 0, Math.PI / 2); dome.scale(1, o.tall || 1.05, 1); dome.translate(c[0], c[1] + r * 0.05, c[2]);
    const brim = ring(r * 1.1, c[1] + r * 0.06, r * 0.13, { seg: 32 }); brim.translate(c[0], 0, c[2]);
    const parts = [dome, brim];
    if (o.spike) { const s = new THREE.ConeGeometry(r * 0.22, r * 0.7, 10); s.translate(c[0], c[1] + r * (1.15 * (o.tall || 1.05)) + r * 0.3, c[2]); parts.push(s); }
    const out = { metal: merge(parts), crest: null };
    if (o.crest) {
      const pts = []; for (let i = 0; i <= 10; i++) { const a = mix(0.3, Math.PI + 0.5, i / 10); pts.push([c[0], c[1] + r * 0.05 + Math.sin(a) * r * 1.2 * (o.tall || 1.05), c[2] + Math.cos(a) * r * 1.15]); }
      out.crest = K.tube(pts, r * 0.22, { segs: 30, radial: 8, radiusAt: (t) => mix(0.5, 1.4, Math.sin(Math.min(1, t * 1.3) * Math.PI * 0.5)) * (1 - smooth(0.85, 1, t) * 0.6) });
    }
    return out;
  }
  // A crown band of radius r at height y with n points of height h.
  function pointedCrown(r, y, n, h, o) {
    o = o || {};
    const band = revolve(profile(r - 0.006, y).line(r + 0.004, y).line(r + 0.006, y + h * 0.35).line(r - 0.004, y + h * 0.35).line(r - 0.006, y), { segs: 48 });
    const pts = around(n, r + 0.001, y + h * 0.3, () => ray(((TAU * r) / n) * (o.w || 0.75), h * 0.75, 0.008), { tilt: o.flare || 0 });
    const tips = beadRing(r + h * 0.75 * Math.sin(o.flare || 0), y + h * 1.04, n, 0.008);
    return merge([band, pts, tips]);
  }

  // Parts of a person, facing +z. All take a scale s and an origin o = [x, y, z].
  const at = (o, s) => (x, y, z) => [o[0] + x * s, o[1] + y * s, o[2] + z * s];
  // head with nose and ears; returns the head centre and radius
  function head(S, c, r, o) {
    o = o || {};
    S.ell(c, [r * 0.92, r, r * 0.95], 0.01);
    S.ell([c[0], c[1] - r * 0.1, c[2] + r * 0.92], [r * 0.16, r * 0.22, r * 0.18], 0.012);                           // nose
    S.pair((s) => S.ell([c[0] + s * r * 0.88, c[1] - r * 0.05, c[2] - r * 0.05], [r * 0.14, r * 0.26, r * 0.16], 0.01)); // ears
    S.ell([c[0], c[1] - r * 0.5, c[2] + r * 0.18], [r * 0.62, r * 0.45, r * 0.6], 0.03);                                // jaw
    if (o.beard) S.cone([c[0], c[1] - r * 0.5, c[2] + r * 0.3], [c[0], c[1] - r * (1.0 + o.beard), c[2] + r * 0.3], r * 0.6, r * 0.3, 0.03);
    if (o.moustache) S.pair((s) => S.cone([c[0] + s * r * 0.08, c[1] - r * 0.36, c[2] + r * 0.9], [c[0] + s * r * 0.48, c[1] - r * 0.5, c[2] + r * 0.7], r * 0.12, r * 0.06, 0.008));
    return { c, r, eyes: [-1, 1].map((s) => [c[0] + s * r * 0.36, c[1] + r * 0.1, c[2] + r * 0.8]) };
  }
  // two eyes, dark on a light face and light on a dark one
  const eyes = (P, h) => P.add('eye', merge(h.eyes.map((e) => sphere(h.r * 0.15, e[0], e[1], e[2], 10))));
  // an arm from shoulder to elbow to hand: sleeve in one sculpt, hand in another
  function arm(sleeve, skin, sh, el, ha, r) {
    sleeve.cone(sh, el, r * 1.15, r, 0.012);
    sleeve.cone(el, [mix(el[0], ha[0], 0.7), mix(el[1], ha[1], 0.7), mix(el[2], ha[2], 0.7)], r, r * 0.95, 0.012);
    skin.cone([mix(el[0], ha[0], 0.6), mix(el[1], ha[1], 0.6), mix(el[2], ha[2], 0.6)], ha, r * 0.8, r * 0.85, 0.01);
    skin.ell(ha, [r * 1.05, r * 1.15, r * 1.05], 0.01);
  }
  // a seated rider's legs, straddling an animal from the hips at h
  function riderLegs(S, h, spread, drop, r) {
    S.pair((s) => S.chain([[h[0] + s * 0.03, h[1], h[2], r * 1.2], [h[0] + s * spread, h[1] - drop * 0.35, h[2] + 0.05, r], [h[0] + s * spread * 0.95, h[1] - drop, h[2] + 0.02, r * 0.85], [h[0] + s * spread * 0.95, h[1] - drop - r * 0.4, h[2] + 0.05, r * 0.95]], 0.014));
  }
  // An animal's leg from hip to knee to foot, with a broader foot.
  function leg(S, hip, knee, foot, r0, r1, fr) {
    S.cone(hip, knee, r0, r1, 0.02);
    S.cone(knee, foot, r1, r1 * 0.95, 0.01);
    S.ell([foot[0], foot[1] + fr * 0.4, foot[2] + fr * 0.15], [fr, fr * 0.7, fr * 1.1], 0.012);
  }

  // ------------------------------------------------------------------ The Royal Army (figures)
  // Chess began in India as chaturanga, the game of the four arms of an army: elephants,
  // cavalry, chariots and foot soldiers. Here the rook is a war elephant with a little fort on
  // its back, the bishop a camel rider, the knight a mounted warrior and every pawn a soldier
  // with sword and shield, led by a proud king and a graceful queen.
  function paradeBase(P, R, h) {
    P.lathe('body', profile(0, 0).line(R - 0.012, 0).arc(R, 0.014, 0.3).line(R, 0.03).arc(R - 0.016, 0.05, 0.35).line(R - 0.028, h - 0.016).arc(R - 0.04, h, 0.35).line(0, h));
    P.add('trim', ring(R - 0.004, 0.032, 0.008));
    return h;
  }
  const ARMY = {
    k() {
      const P = new Piece(), y0 = paradeBase(P, 0.34, 0.11), s = 1.12, A = at([0, y0, 0], s);
      const skin = new Sculpt(), robe = new Sculpt(0.02, 1.35);
      robe.floor = y0 - 0.004;
      robe.cone(A(0, 0, 0), A(0, 0.52, 0), 0.145 * s, 0.082 * s, 0.03);                         // long robe
      robe.ell(A(0, 0.6, 0.012), [0.1 * s, 0.13 * s, 0.08 * s], 0.04);                           // chest, thrown out
      robe.ell(A(0, 0.52, 0.03), [0.088 * s, 0.09 * s, 0.07 * s], 0.04);                          // a royal belly
      robe.pair((x) => robe.ell(A(x * 0.085, 0.71, -0.005), [0.045 * s, 0.04 * s, 0.045 * s], 0.03));   // shoulders
      // a cape falling from the shoulders to the hem
      robe.cone(A(0, 0.72, -0.045), A(0, 0.02, -0.07), 0.1 * s, 0.15 * s, 0.03);
      skin.cone(A(0, 0.74, 0), A(0, 0.8, 0.004), 0.034 * s, 0.032 * s, 0.01);
      const hd = head(skin, A(0, 0.86, 0.008), 0.064 * s, { beard: 0.75, moustache: true });
      arm(robe, skin, A(-0.1, 0.7, 0), A(-0.135, 0.58, 0.04), A(-0.11, 0.55, 0.11), 0.026 * s);   // sceptre hand
      arm(robe, skin, A(0.1, 0.7, 0), A(0.165, 0.58, -0.01), A(0.105, 0.5, 0.035), 0.026 * s);    // hand on hip
      P.add('cloth', robe.mesh()); P.add('body', skin.mesh()); eyes(P, hd);
      // ermine collar, belt, hem and crown
      P.add('accent', around(14, 0.072 * s, y0 + 0.735 * s, () => sphere(0.014 * s, 0, 0, 0, 10)));
      P.add('trim', ring(0.088 * s, y0 + 0.48 * s, 0.01 * s).translate(0, 0, 0.03 * s));
      P.add('trim', ring(0.142 * s, y0 + 0.02 * s, 0.009 * s));
      // a tall crown: a jewelled band, eight points and four arches under an orb and cross
      const cy = y0 + 0.905 * s, cr = 0.066 * s;
      P.add('trim', pointedCrown(cr, cy, 8, 0.09 * s, { flare: 0.16 }));
      P.add('accent', gemRing(8, cr + 0.008, cy + 0.016 * s, 0.01 * s, { phase: Math.PI / 8 }));
      const arches = [];
      for (let i = 0; i < 4; i++) {
        const th = (i / 4) * Math.PI, pts = [];
        for (let j = 0; j <= 12; j++) { const a = (j / 12) * Math.PI, r = Math.cos(a) * (cr + 0.004); pts.push([Math.sin(th) * r, cy + 0.07 * s + Math.sin(a) * 0.075 * s, Math.cos(th) * r]); }
        arches.push(K.tube(pts, 0.0055 * s, { segs: 24, radial: 6 }));
      }
      P.add('trim', merge(arches));
      P.add('cloth', sphere(cr * 0.96, 0, cy + 0.06 * s, 0, 20).scale(1, 0.9, 1));   // the velvet cap inside
      P.add('trim', sphere(0.022 * s, 0, cy + 0.16 * s, 0, 14));
      P.add('trim', new THREE.BoxGeometry(0.013 * s, 0.075 * s, 0.013 * s).translate(0, cy + 0.21 * s, 0));
      P.add('trim', new THREE.BoxGeometry(0.05 * s, 0.013 * s, 0.013 * s).translate(0, cy + 0.215 * s, 0));
      // gold buttons down the front of the robe
      const rf = robe.field();
      for (let i = 0; i < 5; i++) {
        const y = y0 + (0.12 + i * 0.075) * s;
        let z = 0.2; while (z > 0 && rf(0, y, z) > 0) z -= 0.002;
        P.add('trim', sphere(0.011 * s, 0, y, z + 0.004, 10));
      }
      // the sceptre
      const sp = A(-0.11, 0.55, 0.11);
      P.add('trim', new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.34 * s, 10).translate(sp[0], sp[1] + 0.11 * s, sp[2]));
      P.add('trim', sphere(0.022 * s, sp[0], sp[1] + 0.3 * s, sp[2], 14));
      P.add('accent', placeAt(brilliant(0.014 * s), 0, 0, 0).translate(sp[0], sp[1] + 0.3 * s, sp[2] + 0.02 * s));
      return turnPiece(P, 0.45);
    },
    q() {
      const P = new Piece(), y0 = paradeBase(P, 0.33, 0.1), s = 1.08, A = at([0, y0, 0], s);
      const skin = new Sculpt(), gown = new Sculpt(0.025, 1.2);
      gown.floor = y0 - 0.004;
      // a full skirt, turned like a bell
      P.lathe('cloth', profile(0, y0).line(0.158 * s, y0).curve([[0.156 * s, y0 + 0.06 * s], [0.13 * s, y0 + 0.2 * s], [0.085 * s, y0 + 0.34 * s], [0.055 * s, y0 + 0.44 * s]]).line(0, y0 + 0.44 * s));
      gown.ell(A(0, 0.5, 0.004), [0.056 * s, 0.1 * s, 0.045 * s], 0.03);                         // bodice
      gown.ell(A(0, 0.565, 0.018), [0.06 * s, 0.04 * s, 0.04 * s], 0.03);
      gown.pair((x) => gown.ell(A(x * 0.07, 0.6, 0), [0.032 * s, 0.028 * s, 0.032 * s], 0.025));
      skin.cone(A(0, 0.6, 0.004), A(0, 0.665, 0.006), 0.026 * s, 0.024 * s, 0.01);                // a long neck
      const hd = head(skin, A(0, 0.722, 0.01), 0.056 * s);
      // hair gathered behind and falling down her back
      skin.ell(A(0, 0.732, -0.01), [0.058 * s, 0.058 * s, 0.056 * s], 0.012);
      skin.chain([[0, y0 + 0.705 * s, -0.045 * s, 0.036 * s], [0, y0 + 0.64 * s, -0.062 * s, 0.034 * s], [0, y0 + 0.52 * s, -0.062 * s, 0.03 * s], [0, y0 + 0.42 * s, -0.052 * s, 0.018 * s]], 0.016, 4);
      // hands together at the waist, holding a lotus
      arm(gown, skin, A(-0.07, 0.59, 0), A(-0.085, 0.47, 0.03), A(-0.018, 0.43, 0.07), 0.02 * s);
      arm(gown, skin, A(0.07, 0.59, 0), A(0.085, 0.47, 0.03), A(0.018, 0.43, 0.07), 0.02 * s);
      P.add('cloth', gown.mesh()); P.add('body', skin.mesh()); eyes(P, hd);
      P.add('accent', around(10, 0.148 * s, y0 + 0.12 * s, () => cabochon(0.012 * s, 0.6), { tilt: -0.2 }));
      P.add('trim', ring(0.124 * s, y0 + 0.21 * s, 0.006 * s));
      const lo = A(0, 0.47, 0.09);
      P.add('accent', around(6, 0.008 * s, lo[1], () => petal(0.022 * s, 0.05 * s, 0.006), { tilt: 0.5 }).translate(lo[0], 0, lo[2]));
      P.add('trim', sphere(0.01 * s, lo[0], lo[1] + 0.012 * s, lo[2], 10));
      // tall crown, pearl necklace, girdle and hem
      P.add('trim', pointedCrown(0.05 * s, y0 + 0.772 * s, 5, 0.1 * s, { flare: 0.12, w: 0.6 }));
      P.add('accent', gemRing(5, 0.058 * s, y0 + 0.792 * s, 0.008 * s, { phase: Math.PI / 5 }));
      P.add('accent', placeAt(brilliant(0.014 * s), 0, 0.058 * s, y0 + 0.822 * s));
      P.add('trim', around(16, 0.034 * s, y0 + 0.605 * s, () => sphere(0.007 * s, 0, 0, 0, 8), { tilt: 0 }).translate(0, 0, 0.012 * s));
      P.add('trim', ring(0.052 * s, y0 + 0.41 * s, 0.008 * s));
      P.add('trim', ring(0.152 * s, y0 + 0.03 * s, 0.009 * s));
      return turnPiece(P, 0.45);
    },
    b() {
      // a camel rider in a pointed turban, with a crook like a bishop's staff
      const P = new Piece(), y0 = paradeBase(P, 0.31, 0.1), Y = y0 - 0.06;
      const camel = new Sculpt(0.022, 1.25), rider = new Sculpt(), robe = new Sculpt(0.018);
      camel.floor = y0 - 0.004;
      camel.ell([0, Y + 0.43, -0.02], [0.088, 0.09, 0.165], 0.03);                                // body
      camel.ell([0, Y + 0.5, -0.04], [0.07, 0.09, 0.09], 0.04);                                  // hump
      camel.pair((x) => {
        leg(camel, [x * 0.045, Y + 0.4, 0.09], [x * 0.045, Y + 0.2, 0.1], [x * 0.045, y0, 0.1], 0.03, 0.019, 0.024);
        leg(camel, [x * 0.045, Y + 0.4, -0.12], [x * 0.045, Y + 0.2, -0.15], [x * 0.045, y0, -0.12], 0.034, 0.019, 0.024);
      });
      camel.chain([[0, Y + 0.44, 0.12, 0.056], [0, Y + 0.43, 0.2, 0.042], [0, Y + 0.5, 0.25, 0.036], [0, Y + 0.6, 0.255, 0.032]], 0.02, 4);   // the neck dips and rises
      camel.ell([0, Y + 0.635, 0.285], [0.038, 0.04, 0.06], 0.02);                              // head
      camel.ell([0, Y + 0.62, 0.335], [0.03, 0.032, 0.034], 0.015);                              // muzzle
      camel.pair((x) => camel.ell([x * 0.026, Y + 0.665, 0.262], [0.008, 0.016, 0.008], 0.008));  // ears
      camel.chain([[0, Y + 0.46, -0.17, 0.014], [0, Y + 0.38, -0.2, 0.01], [0, Y + 0.3, -0.2, 0.008]], 0.01);   // tail
      const cf = camel.field();
      P.add('body', camel.mesh());
      // a saddle cloth over the hump
      P.add('cloth', sdfGeometry(drape(cf, 0.014, (x, y, z) => Math.max(Y + 0.42 - y, Math.abs(z + 0.03) - 0.12)), [-0.1, Y + 0.38, -0.17, 0.1, Y + 0.62, 0.11], Q.cell * 1.3));
      P.add('trim', K.tube([[0, Y + 0.6, 0.27], [0.03, Y + 0.6, 0.2], [0.035, Y + 0.62, 0.12], [0.03, Y + 0.64, 0.06]], 0.0045, { segs: 20, radial: 6 }));   // rein
      // the rider sits on the hump
      const H = [0, Y + 0.575, -0.03];
      riderLegs(robe, H, 0.072, 0.13, 0.022);
      robe.ell([0, Y + 0.66, -0.035], [0.052, 0.085, 0.042], 0.03);
      robe.ell([0, Y + 0.59, -0.03], [0.06, 0.04, 0.05], 0.03);
      rider.cone([0, Y + 0.73, -0.03], [0, Y + 0.76, -0.028], 0.02, 0.02, 0.01);
      eyes(P, head(rider, [0, Y + 0.795, -0.024], 0.037, { beard: 0.2 }));
      arm(robe, rider, [-0.055, Y + 0.715, -0.03], [-0.075, Y + 0.65, 0.01], [-0.06, Y + 0.66, 0.06], 0.018);
      arm(robe, rider, [0.055, Y + 0.715, -0.03], [0.07, Y + 0.65, 0.01], [0.035, Y + 0.645, 0.06], 0.018);
      // the turban rises to a point, like a mitre
      robe.ell([0, Y + 0.83, -0.026], [0.045, 0.03, 0.045], 0.01);
      robe.cone([0, Y + 0.84, -0.026], [0, Y + 0.93, -0.03], 0.04, 0.01, 0.02);
      P.add('body', rider.mesh()); P.add('cloth', robe.mesh());
      P.add('accent', placeAt(brilliant(0.012), 0, 0.044, Y + 0.845).translate(0, 0, -0.026));
      P.add('trim', ring(0.044, Y + 0.832, 0.006).translate(0, 0, -0.026));
      // the crook
      const c = [-0.06, Y + 0.66, 0.06], crook = [];
      for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 1.25; crook.push([c[0] - Math.sin(a) * 0.03 * (i ? 1 : 0), c[1] + 0.26 + Math.sin(a) * 0.035, c[2] + 0.03 - Math.cos(a) * 0.03]); }
      P.add('trim', K.tube([[c[0], c[1] - 0.12, c[2]], [c[0], c[1] + 0.1, c[2]], [c[0], c[1] + 0.22, c[2] + 0.005]].concat(crook.slice(1)), 0.006, { segs: 40, radial: 6 }));
      
      return P;
    },
    n() {
      // a mounted warrior on a prancing horse, sword raised
      const P = new Piece(), y0 = paradeBase(P, 0.322, 0.1);
      const hs = new Sculpt(0.02, 1.25), rider = new Sculpt(), robe = new Sculpt(0.018), mane = new Sculpt(0.01);
      hs.floor = y0 - 0.004;
      hs.ell([0, y0 + 0.37, -0.01], [0.068, 0.075, 0.14], 0.03);                                  // barrel
      hs.ell([0, y0 + 0.38, 0.09], [0.064, 0.08, 0.07], 0.035);                                   // chest
      hs.ell([0, y0 + 0.39, -0.11], [0.07, 0.075, 0.075], 0.035);                                 // quarters
      hs.pair((x) => leg(hs, [x * 0.04, y0 + 0.33, -0.12], [x * 0.042, y0 + 0.17, -0.165], [x * 0.042, y0, -0.13], 0.032, 0.017, 0.02));
      leg(hs, [0.04, y0 + 0.33, 0.1], [0.042, y0 + 0.16, 0.11], [0.042, y0, 0.11], 0.03, 0.017, 0.02);        // standing foreleg
      leg(hs, [-0.04, y0 + 0.33, 0.1], [-0.042, y0 + 0.25, 0.19], [-0.042, y0 + 0.14, 0.16], 0.03, 0.017, 0.019);  // raised foreleg
      hs.chain([[0, y0 + 0.4, 0.11, 0.05], [0, y0 + 0.5, 0.16, 0.042], [0, y0 + 0.6, 0.19, 0.034]], 0.025, 4);
      hs.cone([0, y0 + 0.625, 0.19], [0, y0 + 0.56, 0.28], 0.038, 0.024, 0.02);                   // head, nose down
      hs.pair((x) => hs.cone([x * 0.018, y0 + 0.65, 0.18], [x * 0.022, y0 + 0.69, 0.17], 0.01, 0.004, 0.006));
      mane.chain([[0, y0 + 0.66, 0.17, 0.016], [0, y0 + 0.6, 0.155, 0.02], [0, y0 + 0.5, 0.125, 0.02], [0, y0 + 0.43, 0.09, 0.016]], 0.01, 4);
      mane.chain([[0, y0 + 0.41, -0.17, 0.02], [0, y0 + 0.36, -0.21, 0.022], [0, y0 + 0.24, -0.215, 0.018], [0, y0 + 0.15, -0.2, 0.01]], 0.01, 4);   // tail
      const hf = hs.field();
      P.add('body', hs.mesh()); P.add('trim', mane.mesh());
      P.add('cloth', sdfGeometry(drape(hf, 0.013, (x, y, z) => Math.max(y0 + 0.35 - y, Math.abs(z + 0.02) - 0.1)), [-0.1, y0 + 0.3, -0.14, 0.1, y0 + 0.47, 0.1], Q.cell * 1.3));
      P.add('trim', K.tube([[0, y0 + 0.575, 0.26], [0.03, y0 + 0.57, 0.2], [0.035, y0 + 0.55, 0.12], [0.03, y0 + 0.53, 0.05]], 0.0045, { segs: 20, radial: 6 }));
      const H = [0, y0 + 0.47, -0.02];
      riderLegs(robe, H, 0.074, 0.12, 0.022);
      robe.ell([0, y0 + 0.56, -0.025], [0.05, 0.08, 0.04], 0.03);
      robe.ell([0, y0 + 0.49, -0.02], [0.058, 0.035, 0.05], 0.03);
      rider.cone([0, y0 + 0.625, -0.022], [0, y0 + 0.655, -0.02], 0.02, 0.02, 0.01);
      eyes(P, head(rider, [0, y0 + 0.69, -0.016], 0.036));
      arm(robe, rider, [-0.055, y0 + 0.61, -0.025], [-0.09, y0 + 0.66, 0.0], [-0.08, y0 + 0.73, 0.03], 0.018);   // sword arm raised
      arm(robe, rider, [0.055, y0 + 0.61, -0.025], [0.08, y0 + 0.55, 0.0], [0.07, y0 + 0.55, 0.05], 0.018);       // shield arm
      P.add('body', rider.mesh()); P.add('cloth', robe.mesh());
      const hm = helmet([0, y0 + 0.69, -0.016], 0.036, { spike: true, tall: 1.15 });
      P.add('trim', hm.metal);
      const sw = sword(0.2, 0.018);
      for (const g of [sw.blade, sw.hilt]) { g.rotateX(0.35); g.translate(-0.08, y0 + 0.73, 0.03); }
      P.add('steel', sw.blade); P.add('trim', sw.hilt);
      const sh = shield(0.06, 0.016);
      for (const g of [sh.face, sh.rim, sh.boss]) { g.rotateY(Math.PI / 2 - 0.3); g.translate(0.095, y0 + 0.55, 0.04); }
      P.add('body', sh.face); P.add('trim', sh.rim); P.add('accent', sh.boss);
      return P;
    },
    r() {
      // a war elephant with a little fort (a howdah) on its back and a spearman inside
      const P = new Piece(), y0 = paradeBase(P, 0.335, 0.1);
      const el = new Sculpt(0.03, 1.35), man = new Sculpt(), robe = new Sculpt(0.016);
      el.floor = y0 - 0.004;
      el.ell([0, y0 + 0.25, -0.03], [0.125, 0.12, 0.185], 0.04);                                  // body
      el.pair((x) => {
        el.cone([x * 0.07, y0 + 0.2, 0.08], [x * 0.07, y0 + 0.01, 0.085], 0.048, 0.046, 0.03);
        el.cone([x * 0.072, y0 + 0.2, -0.13], [x * 0.072, y0 + 0.01, -0.13], 0.05, 0.046, 0.03);
        el.ell([x * 0.098, y0 + 0.3, 0.115], [0.02, 0.085, 0.07], 0.016);                         // ears
      });
      el.ell([0, y0 + 0.31, 0.14], [0.082, 0.09, 0.072], 0.04);                                   // head
      el.ell([0, y0 + 0.355, 0.15], [0.068, 0.055, 0.058], 0.03);                                 // brow
      el.chain([[0, y0 + 0.29, 0.2, 0.038], [0, y0 + 0.22, 0.235, 0.031], [0, y0 + 0.14, 0.245, 0.025], [0, y0 + 0.07, 0.262, 0.02], [0, y0 + 0.06, 0.295, 0.017], [0, y0 + 0.085, 0.31, 0.014]], 0.012, 3);   // trunk
      el.pair((x) => el.ell([x * 0.052, y0 + 0.33, 0.205], [0.008, 0.008, 0.006], 0.004, true));  // eyes
      el.chain([[0, y0 + 0.28, -0.21, 0.012], [0, y0 + 0.2, -0.23, 0.009], [0, y0 + 0.13, -0.225, 0.008]], 0.008);   // tail
      const ef = el.field();
      P.add('body', el.mesh());
      P.add('cloth', sdfGeometry(drape(ef, 0.016, (x, y, z) => Math.max(y0 + 0.2 - y, Math.abs(z + 0.03) - 0.13)), [-0.16, y0 + 0.16, -0.18, 0.16, y0 + 0.4, 0.12], Q.cell * 1.3));
      // tusks
      P.add('tusk', merge([-1, 1].map((x) => K.tube([[x * 0.045, y0 + 0.25, 0.19], [x * 0.06, y0 + 0.2, 0.24], [x * 0.058, y0 + 0.21, 0.29], [x * 0.05, y0 + 0.24, 0.31]], 0.012, { segs: 24, radial: 8, radiusAt: (t) => mix(1, 0.25, t) }))));
      // a gold forehead plate with a gem
      const fp = cabochon(0.04, 0.3); fp.scale(0.8, 1.2, 1); fp.rotateX(-0.5); fp.translate(0, y0 + 0.345, 0.2); P.add('trim', fp);
      P.add('accent', placeAt(brilliant(0.012), 0, 0, 0).rotateX(-0.5).translate(0, y0 + 0.35, 0.214));
      // the howdah: a round fort with battlements, so the rook still reads as a tower
      const hy = y0 + 0.34, hz = -0.03;
      const fort = revolve(profile(0, hy).line(0.1, hy).line(0.1, hy + 0.015).line(0.088, hy + 0.025).line(0.09, hy + 0.11).line(0.108, hy + 0.12).line(0.108, hy + 0.14).line(0.086, hy + 0.14).line(0.086, hy + 0.13).line(0, hy + 0.13), { segs: 48 });
      P.add('trim', merge([fort, battlements(6, 0.086, 0.108, hy + 0.138, hy + 0.2, 0.38, 'round', 0.02)]).translate(0, 0, hz));
      P.add('accent', around(6, 0.092, hy + 0.07, () => cabochon(0.012, 0.6), { phase: Math.PI / 6 }).translate(0, 0, hz));
      // the spearman, standing in the howdah
      robe.ell([0, hy + 0.17, hz], [0.045, 0.06, 0.036], 0.02);
      man.cone([0, hy + 0.22, hz], [0, hy + 0.245, hz + 0.002], 0.018, 0.018, 0.01);
      eyes(P, head(man, [0, hy + 0.28, hz + 0.004], 0.034));
      arm(robe, man, [-0.045, hy + 0.205, hz], [-0.065, hy + 0.16, hz + 0.03], [-0.06, hy + 0.17, hz + 0.065], 0.016);
      P.add('body', man.mesh()); P.add('cloth', robe.mesh());
      P.add('trim', helmet([0, hy + 0.28, hz + 0.004], 0.034, { spike: true }).metal);
      const sp = spear(0.4, 0.006);
      for (const g of [sp.shaft, sp.head]) g.translate(-0.06, hy + 0.0, hz + 0.065);
      P.add('trim', sp.shaft); P.add('steel', sp.head);
      return turnPiece(P, 0.5);
    },
    p() {
      // a foot soldier with sword and shield
      const P = new Piece(), y0 = paradeBase(P, 0.27, 0.085), s = 1, A = at([0, y0, 0], s);
      const skin = new Sculpt(), kit = new Sculpt(0.016);
      kit.floor = y0 - 0.004; skin.floor = y0 - 0.004;
      kit.pair((x) => {
        kit.ell(A(x * 0.034, 0.016, 0.014), [0.024, 0.02, 0.036], 0.01);                         // boots
        kit.cone(A(x * 0.032, 0.02, 0), A(x * 0.03, 0.16, 0), 0.024, 0.027, 0.012);               // legs
      });
      kit.cone(A(0, 0.14, 0), A(0, 0.22, 0), 0.07, 0.058, 0.02);                                  // armoured skirt
      kit.ell(A(0, 0.28, 0), [0.066, 0.08, 0.05], 0.025);                                         // tunic
      kit.pair((x) => kit.ell(A(x * 0.066, 0.325, 0), [0.03, 0.026, 0.03], 0.02));
      skin.cone(A(0, 0.34, 0), A(0, 0.37, 0.002), 0.021, 0.021, 0.01);
      eyes(P, head(skin, A(0, 0.41, 0.006), 0.046));
      arm(kit, skin, A(-0.066, 0.32, 0), A(-0.09, 0.25, 0.03), A(-0.08, 0.245, 0.08), 0.019);   // sword hand
      arm(kit, skin, A(0.066, 0.32, 0), A(0.095, 0.25, 0.01), A(0.085, 0.24, 0.05), 0.019);     // shield hand
      P.add('cloth', kit.mesh()); P.add('body', skin.mesh());
      P.add('trim', ring(0.062, y0 + 0.215, 0.008));                                              // belt
      const hm = helmet(A(0, 0.41, 0.006), 0.046, { crest: true });
      P.add('trim', hm.metal); P.add('cloth', hm.crest);
      const sw = sword(0.2, 0.018);
      for (const g of [sw.blade, sw.hilt]) { g.rotateX(0.15); g.translate(...A(-0.08, 0.245, 0.08)); }
      P.add('steel', sw.blade); P.add('trim', sw.hilt);
      const sh = shield(0.08, 0.02);
      for (const g of [sh.face, sh.rim, sh.boss]) { g.rotateY(0.5); g.translate(...A(0.1, 0.24, 0.07)); }
      P.add('body', sh.face); P.add('trim', sh.rim); P.add('accent', sh.boss);
      return turnPiece(P, 0.5);
    },
  };

  // ------------------------------------------------------------------ Robot Squad (novelty)
  // Friendly toy robots in glossy plastic and chrome, with glowing eyes. Every one still wears
  // its piece's badge: a crown of antennas for the king, a halo of dishes for the queen, a
  // slit visor for the bishop, a horse's head for the knight and battlements for the rook.
  function rbox(w, h, d, r, x, y, z) {
    const g = new THREE.RoundedBoxGeometry(w, h, d, Math.max(1, Math.round(3 * DETAIL.around)), Math.min(r, w / 2, h / 2, d / 2) * 0.999);
    return g.translate(x || 0, y || 0, z || 0);
  }
  const cyl = (r0, r1, h, x, y, z, seg) => new THREE.CylinderGeometry(r0, r1, h, Math.max(8, Math.round((seg || 32) * DETAIL.around))).translate(x || 0, y || 0, z || 0);
  function robotBase(P, R, h) {
    P.lathe('body', profile(0, 0).line(R - 0.02, 0).arc(R, 0.02, 0.3).line(R, h - 0.03).arc(R - 0.03, h, 0.3).line(0, h));
    P.add('accent', ring(R + 0.002, h * 0.5, 0.007));
    P.add('trim', around(8, R - 0.035, h + 0.002, () => sphere(0.012, 0, 0, 0, 8), { phase: Math.PI / 8 }));
    return h;
  }
  // a robot head: a rounded box with a visor strip of light and two eyes
  function robotHead(P, w, h, d, y, o) {
    o = o || {};
    P.add('body', rbox(w, h, d, Math.min(w, h) * 0.3, 0, y, 0));
    P.add('joint', rbox(w * 0.84, h * 0.36, 0.02, 0.008, 0, y + h * 0.06, d / 2));
    P.add('accent', merge([-1, 1].map((s) => sphere(h * 0.1, s * w * 0.2, y + h * 0.06, d / 2 + 0.006, 12).scale(1, 1, 0.5))));
    P.add('trim', merge([-1, 1].map((s) => cyl(h * 0.14, h * 0.14, 0.02, 0, 0, 0, 16).rotateZ(Math.PI / 2).translate(s * (w / 2 + 0.008), y, 0))));
    if (o.mouth) P.add('joint', rbox(w * 0.36, 0.012, 0.014, 0.005, 0, y - h * 0.25, d / 2));
  }
  // an arm hanging from a shoulder: chrome joints, a plastic limb and a claw
  function robotArm(P, sx, sy, len, r, swing) {
    const g = [], j = [];
    j.push(sphere(r * 1.25, 0, 0, 0, 12));
    g.push(cyl(r, r * 0.9, len * 0.5, 0, -len * 0.25, 0));
    j.push(sphere(r * 1.05, 0, -len * 0.5, 0, 10));
    g.push(cyl(r * 0.9, r * 0.8, len * 0.45, 0, -len * 0.73, 0));
    j.push(rbox(r * 2.4, r * 1.4, r * 1.6, r * 0.5, 0, -len, 0));
    const place = (x) => x.rotateX(swing || 0).translate(sx, sy, 0);
    P.add('body', merge(g.map(place))); P.add('trim', merge(j.map(place)));
  }
  const ROBOT = {
    k() {
      const P = new Piece(), y0 = robotBase(P, 0.34, 0.1);
      P.add('joint', merge([-1, 1].map((s) => rbox(0.1, 0.06, 0.16, 0.025, s * 0.07, y0 + 0.03, 0.02))));        // feet
      P.add('trim', merge([-1, 1].map((s) => cyl(0.03, 0.03, 0.2, s * 0.065, y0 + 0.16, 0))));                   // legs
      P.add('body', rbox(0.26, 0.2, 0.18, 0.05, 0, y0 + 0.33, 0));                                                // hips
      P.add('body', rbox(0.3, 0.3, 0.2, 0.06, 0, y0 + 0.58, 0));                                                  // chest
      P.add('joint', rbox(0.16, 0.12, 0.02, 0.01, 0, y0 + 0.6, 0.1));                                             // chest panel
      P.add('accent', merge([0, 1, 2].map((i) => sphere(0.014, -0.045 + i * 0.045, y0 + 0.6, 0.112, 10))));       // lights
      P.add('trim', cyl(0.045, 0.05, 0.06, 0, y0 + 0.76, 0));
      robotHead(P, 0.22, 0.17, 0.18, y0 + 0.87, { mouth: true });
      robotArm(P, -0.17, y0 + 0.68, 0.26, 0.026, -0.15);
      robotArm(P, 0.17, y0 + 0.68, 0.26, 0.026, -0.15);
      // a crown of five antennas, each with a light, round a lit cross
      const cy = y0 + 0.955;
      P.add('trim', cyl(0.1, 0.1, 0.03, 0, cy + 0.01, 0, 40));
      for (let i = 0; i < 5; i++) {
        const x = (i - 2) * 0.045, h = 0.07 + (2 - Math.abs(i - 2)) * 0.02;
        P.add('trim', cyl(0.006, 0.008, h, x, cy + 0.025 + h / 2, 0, 8));
        P.add('accent', sphere(0.016, x, cy + 0.03 + h, 0, 12));
      }
      P.add('accent', rbox(0.024, 0.11, 0.024, 0.008, 0, cy + 0.2, 0));
      P.add('accent', rbox(0.075, 0.024, 0.024, 0.008, 0, cy + 0.21, 0));
      return P;
    },
    q() {
      const P = new Piece(), y0 = robotBase(P, 0.33, 0.1);
      P.lathe('body', profile(0, y0).line(0.2, y0).curve([[0.19, y0 + 0.12], [0.1, y0 + 0.3], [0.07, y0 + 0.4]]).line(0, y0 + 0.4));   // a skirt of plates
      P.add('trim', ring(0.165, y0 + 0.1, 0.008)); P.add('accent', ring(0.12, y0 + 0.25, 0.006));
      P.add('trim', cyl(0.06, 0.07, 0.06, 0, y0 + 0.42, 0));
      P.add('body', rbox(0.2, 0.2, 0.15, 0.06, 0, y0 + 0.55, 0));
      P.add('accent', sphere(0.03, 0, y0 + 0.57, 0.072, 16).scale(1, 1, 0.5));                                   // a heart light
      P.add('trim', cyl(0.035, 0.04, 0.05, 0, y0 + 0.68, 0));
      robotHead(P, 0.17, 0.15, 0.15, y0 + 0.77);
      robotArm(P, -0.125, y0 + 0.62, 0.22, 0.02, -0.25);
      robotArm(P, 0.125, y0 + 0.62, 0.22, 0.02, -0.25);
      // a halo of little dishes on stalks, like a coronet
      const cy = y0 + 0.85;
      P.add('trim', ring(0.085, cy, 0.01));
      for (let i = 0; i < 7; i++) {
        const th = (i / 7) * TAU;
        const st = cyl(0.005, 0.005, 0.12, 0, 0.06, 0, 8); st.rotateX(0.35);
        const dish = new THREE.SphereGeometry(0.03, 16, 6, 0, TAU, 0, Math.PI * 0.4); dish.rotateX(0.35); dish.translate(0, 0.125, 0.045);
        P.add('trim', placeAt(st, th, 0.08, cy));
        P.add('accent', placeAt(sphere(0.01, 0, 0.13, 0.04, 8), th, 0.08, cy));
        P.add('body', placeAt(dish, th, 0.08, cy));
      }
      return P;
    },
    b() {
      const P = new Piece(), y0 = robotBase(P, 0.31, 0.1);
      P.add('joint', cyl(0.13, 0.15, 0.06, 0, y0 + 0.03, 0));                                                    // a hover skirt
      P.add('accent', ring(0.12, y0 + 0.005, 0.008));
      P.lathe('body', profile(0, y0 + 0.06).line(0.12, y0 + 0.06).curve([[0.13, y0 + 0.2], [0.11, y0 + 0.4], [0.09, y0 + 0.5]]).line(0, y0 + 0.5));
      P.add('trim', ring(0.124, y0 + 0.22, 0.008)); P.add('trim', ring(0.106, y0 + 0.4, 0.008));
      P.add('accent', merge([0, 1, 2].map((i) => sphere(0.012, 0, y0 + 0.27 + i * 0.04, 0.122 - i * 0.004, 10))));
      P.add('trim', cyl(0.04, 0.045, 0.05, 0, y0 + 0.52, 0));
      robotArm(P, -0.11, y0 + 0.45, 0.2, 0.018, -0.2);
      robotArm(P, 0.11, y0 + 0.45, 0.2, 0.018, -0.2);
      // a tall dome head with the bishop's slit as a band of light
      const hy = y0 + 0.55;
      P.lathe('body', profile(0, hy).line(0.09, hy).curve([[0.1, hy + 0.1], [0.085, hy + 0.2], [0.04, hy + 0.3], [0, hy + 0.33]]), { mod: MOD.slit(Math.PI * 0.25, 0.8, 0.6, 0.016, 0.5) });
      P.add('joint', ring(0.098, hy + 0.09, 0.016, { squash: 1.6 }));
      P.add('accent', merge([-1, 1].map((s) => sphere(0.014, s * 0.035, hy + 0.09, 0.098, 12).scale(1, 1, 0.5))));
      P.add('trim', cyl(0.004, 0.004, 0.08, 0, hy + 0.37, 0, 8));
      P.add('accent', sphere(0.018, 0, hy + 0.42, 0, 12));
      return P;
    },
    n() {
      const P = new Piece(), y0 = robotBase(P, 0.322, 0.1);
      P.add('trim', cyl(0.13, 0.15, 0.08, 0, y0 + 0.04, 0));
      // a horse's head built from plates: neck, head, muzzle, ears and a fin mane
      const neck = rbox(0.13, 0.42, 0.17, 0.045); neck.rotateX(0.32); neck.translate(0, y0 + 0.3, -0.03); P.add('body', neck);
      const headG = rbox(0.12, 0.13, 0.22, 0.045); headG.rotateX(0.5); headG.translate(0, y0 + 0.56, 0.1); P.add('body', headG);
      const muzzle = rbox(0.1, 0.09, 0.1, 0.035); muzzle.rotateX(0.5); muzzle.translate(0, y0 + 0.49, 0.2); P.add('joint', muzzle);
      P.add('accent', merge([-1, 1].map((s) => rbox(0.012, 0.022, 0.04, 0.006, s * 0.061, y0 + 0.59, 0.1).rotateX(0.2))));   // eyes
      P.add('accent', merge([-1, 1].map((s) => sphere(0.009, s * 0.025, y0 + 0.5, 0.25, 8))));                    // nostril lights
      for (const s of [-1, 1]) { const e = new THREE.ConeGeometry(0.025, 0.08, 4); e.rotateX(-0.3); e.translate(s * 0.035, y0 + 0.67, 0.02); P.add('trim', e); }
      for (let i = 0; i < 6; i++) {
        const fin = rbox(0.02, 0.06, 0.06, 0.008); fin.rotateX(0.32 + 0.6);
        const t = i / 5; fin.translate(0, y0 + mix(0.62, 0.22, t), mix(0.0, -0.17, t) - 0.04);
        P.add('trim', fin);
      }
      P.add('trim', merge([-1, 1].map((s) => cyl(0.03, 0.03, 0.02, 0, 0, 0, 16).rotateZ(Math.PI / 2).translate(s * 0.07, y0 + 0.32, -0.03))));
      return P;
    },
    r() {
      const P = new Piece(), y0 = robotBase(P, 0.322, 0.1);
      // caterpillar tracks
      for (const s of [-1, 1]) {
        P.add('joint', rbox(0.09, 0.11, 0.44, 0.05, s * 0.15, y0 + 0.055, 0));
        P.add('trim', merge([-1, 0, 1].map((k) => cyl(0.035, 0.035, 0.095, 0, 0, 0, 16).rotateZ(Math.PI / 2).translate(s * 0.15, y0 + 0.055, k * 0.13))));
      }
      P.add('body', rbox(0.26, 0.08, 0.36, 0.03, 0, y0 + 0.13, 0));
      // the tower, with lit windows and battlements
      P.lathe('body', profile(0, y0 + 0.16).line(0.16, y0 + 0.16).line(0.15, y0 + 0.5).line(0.18, y0 + 0.52).line(0.18, y0 + 0.56).line(0.14, y0 + 0.56).line(0.14, y0 + 0.54).line(0, y0 + 0.54));
      P.add('body', battlements(6, 0.14, 0.18, y0 + 0.555, y0 + 0.65, 0.4, 'flat'));
      P.add('trim', ring(0.158, y0 + 0.24, 0.008)); P.add('trim', ring(0.152, y0 + 0.44, 0.008));
      P.add('accent', around(4, 0.153, y0 + 0.34, () => rbox(0.04, 0.06, 0.02, 0.008), { phase: Math.PI / 4 }));
      robotHead(P, 0.13, 0.1, 0.1, y0 + 0.6);
      P.add('trim', cyl(0.004, 0.004, 0.1, 0.04, y0 + 0.72, 0, 8)); P.add('accent', sphere(0.012, 0.04, y0 + 0.78, 0, 10));
      return P;
    },
    p() {
      const P = new Piece(), y0 = robotBase(P, 0.27, 0.085);
      P.add('joint', cyl(0.07, 0.08, 0.05, 0, y0 + 0.025, 0));
      P.add('body', sphere(0.105, 0, y0 + 0.15, 0, 32));                                                          // round body
      P.add('joint', ring(0.104, y0 + 0.15, 0.01));
      P.add('accent', sphere(0.018, 0, y0 + 0.17, 0.1, 12).scale(1, 1, 0.5));
      robotArm(P, -0.105, y0 + 0.19, 0.12, 0.014, -0.3);
      robotArm(P, 0.105, y0 + 0.19, 0.12, 0.014, -0.3);
      P.add('trim', cyl(0.03, 0.035, 0.03, 0, y0 + 0.265, 0));
      robotHead(P, 0.13, 0.11, 0.11, y0 + 0.33);
      P.add('trim', cyl(0.004, 0.004, 0.08, 0, y0 + 0.42, 0, 8)); P.add('accent', sphere(0.014, 0, y0 + 0.465, 0, 10));
      return P;
    },
  };

  // ------------------------------------------------------------------ Coral Kingdom (sunken Atlantis)
  // The court of a sunken city in pearl and gold: a sea king with his trident, a mermaid queen,
  // jellyfish bishops that glow from inside, spiny seahorse knights, lighthouse rooks and pearl
  // pawns cupped in open scallop shells. Every piece stands on a gold drum set with sea-blue gems.
  // A surface with two faces: f(u, v) gives a point on the front; the back is the same surface
  // pushed `thick` along -z of its own normal, so thin shells and fins read from both sides.
  function sheet(nu, nv, f, thick) {
    const W = nu + 1, pos = [], idx = [];
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) pos.push(...f(i / nu, j / nv));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; idx.push(a, b, d, a, d, c); }
    const front = new THREE.BufferGeometry();
    front.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); front.setIndex(idx); front.computeVertexNormals();
    const n = front.attributes.normal, back = pos.slice(), bidx = [];
    for (let i = 0; i < n.count; i++) { back[i * 3] -= n.getX(i) * thick; back[i * 3 + 1] -= n.getY(i) * thick; back[i * 3 + 2] -= n.getZ(i) * thick; }
    for (let k = 0; k < idx.length; k += 3) bidx.push(idx[k], idx[k + 2], idx[k + 1]);
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(back, 3)); bg.setIndex(bidx); bg.computeVertexNormals();
    return merge([front, bg]);
  }
  // A scallop shell: a fan of ribs from the hinge at the origin, opening up +y and bulging
  // toward +z, with a frilled edge where the ribs end.
  function scallop(r, open, ribs) {
    const n = ribs || 11, a0 = open || 1.15;
    const g = sheet(Math.round(n * 6 * DETAIL.around) + 6, Math.max(5, Math.round(10 * DETAIL.along)), (u, v) => {
      const a = (u * 2 - 1) * a0, rib = Math.cos(u * n * TAU), rr = r * (0.1 + 0.9 * v) * (1 + 0.035 * rib * v);
      const z = r * 0.3 * Math.sin(v * Math.PI * 0.85) * (1 - 0.45 * Math.pow(u * 2 - 1, 2)) + rib * r * 0.035 * v;
      return [Math.sin(a) * rr, Math.cos(a) * rr, z];
    }, r * 0.05);
    // the two little ears at the hinge
    const ears = extrude([[-r * 0.3, 0], [r * 0.3, 0], [r * 0.22, r * 0.2], [-r * 0.22, r * 0.2]], r * 0.05, r * 0.012, { bevelSegments: 1 });
    return merge([g, ears]);
  }
  // A gold drum: a rolled foot and lip round a band of nacre set with sea-blue gems and pearls.
  function tideBase(P, R, h) {
    P.lathe('trim', profile(0, 0).line(R - 0.012, 0).arc(R, 0.012, 0.3).line(R, 0.03).line(R - 0.014, 0.038).line(R - 0.014, h - 0.036)
      .line(R + 0.002, h - 0.03).arc(R - 0.01, h - 0.004, 0.35).line(R - 0.04, h).line(0, h));
    P.add('body', new THREE.CylinderGeometry(R - 0.008, R - 0.008, h - 0.084, Math.round(Q.segs * DETAIL.around), 1, true).translate(0, h / 2 + 0.001, 0));
    P.add('accent', around(8, R - 0.007, h / 2, () => cabochon(0.019, 0.6)));
    P.add('pearl', around(8, R - 0.008, h / 2, () => sphere(0.0115, 0, 0, 0, 10), { phase: Math.PI / 8 }));
    P.add('trim', beadRing(R - 0.03, h + 0.002, Math.round(R * 90), 0.0075));
    return h;
  }
  // a fish tail from the waist w down to a fluke at f, which spreads and curls up
  function merTail(S, pts, fluke, r) {
    S.chain(pts, 0.03, 4);
    const [fx, fy, fz] = fluke;
    S.pair((s) => S.cone([fx, fy, fz], [fx + s * 0.075, fy + 0.05, fz - 0.03], r * 0.32, r * 0.12, 0.02));
    S.pair((s) => S.ell([fx + s * 0.06, fy + 0.035, fz - 0.02], [0.05, 0.03, 0.012], 0.02));
  }
  // flowing hair: strands from the crown of the head down the back
  function hairFall(S, c, r, len, n, spread) {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1), x = (t * 2 - 1) * r * (spread || 0.8), sway = Math.sin(t * 5.1) * 0.012;
      S.chain([[c[0] + x * 0.6, c[1] + r * 0.5, c[2] - r * 0.3, r * 0.42], [c[0] + x, c[1] - r * 0.4, c[2] - r * 0.85, r * 0.36],
        [c[0] + x * 1.15 + sway, c[1] - len * 0.55, c[2] - r * 1.15, r * 0.3], [c[0] + x * 1.1 - sway, c[1] - len, c[2] - r * 1.0, r * 0.12]], 0.02, 3);
    }
  }
  function trident(t, len, s) {
    const fork = [new THREE.CylinderGeometry(0.0075 * s, 0.0075 * s, len, 10).translate(t[0], t[1] + len * 0.2, t[2])];
    const top = t[1] + len * 0.7;
    fork.push(K.tube([[t[0] - 0.045 * s, top + 0.07 * s, t[2]], [t[0] - 0.045 * s, top + 0.012 * s, t[2]], [t[0], top, t[2]], [t[0] + 0.045 * s, top + 0.012 * s, t[2]], [t[0] + 0.045 * s, top + 0.07 * s, t[2]]], 0.0065 * s, { segs: 24, radial: 6 }));
    for (const dx of [-0.045, 0, 0.045]) {
      const tip = new THREE.ConeGeometry(0.013 * s, 0.05 * s, 6); tip.translate(t[0] + dx * s, top + (dx ? 0.095 : 0.11) * s, t[2]);
      fork.push(tip);
      if (!dx) fork.push(new THREE.CylinderGeometry(0.0065 * s, 0.0065 * s, 0.08 * s, 8).translate(t[0], top + 0.045 * s, t[2]));
    }
    fork.push(sphere(0.014 * s, t[0], top - 0.012 * s, t[2], 10));
    return merge(fork);
  }
  const OCEAN = {
    k() {
      // the sea king rises from a coiled tail over a wave, trident raised, a great scallop at his feet
      const P = new Piece(), y0 = tideBase(P, 0.35, 0.12), s = 1.14, A = at([0, y0, 0], s);
      const skin = new Sculpt(0.018, 1.1), tail = new Sculpt(0.025, 1.25), wave = new Sculpt(0.04, 1.4), hair = new Sculpt(0.02, 1.2);
      tail.floor = y0 - 0.004; wave.floor = y0 - 0.004;
      wave.ell(A(0, 0.03, -0.01), [0.25 * s, 0.07 * s, 0.22 * s]); wave.ell(A(-0.08, 0.08, -0.07), [0.1 * s, 0.09 * s, 0.1 * s]);
      merTail(tail, [[0, y0 + 0.5 * s, 0, 0.085 * s], [0.01, y0 + 0.36 * s, 0.03, 0.082 * s], [0.04, y0 + 0.2 * s, 0.02, 0.07 * s], [0.1, y0 + 0.1 * s, -0.05, 0.05 * s],
        [0.15, y0 + 0.1 * s, -0.12, 0.034 * s], [0.13, y0 + 0.2 * s, -0.18, 0.022 * s]], [0.12, y0 + 0.24 * s, -0.19], 0.08);
      skin.ell(A(0, 0.6, 0.004), [0.1 * s, 0.13 * s, 0.072 * s], 0.035);                                // chest
      skin.pair((x) => skin.ell(A(x * 0.045, 0.64, 0.04), [0.048 * s, 0.04 * s, 0.03 * s], 0.02));     // pectorals
      skin.ell(A(0, 0.5, 0.02), [0.075 * s, 0.07 * s, 0.055 * s], 0.03);                                // belly
      skin.pair((x) => skin.ell(A(x * 0.095, 0.715, 0), [0.05 * s, 0.045 * s, 0.05 * s], 0.03));       // shoulders
      skin.cone(A(0, 0.73, 0), A(0, 0.8, 0.006), 0.036 * s, 0.032 * s, 0.01);
      const hd = head(skin, A(0, 0.865, 0.01), 0.064 * s, { beard: 0.5, moustache: true });
      arm(skin, skin, A(-0.11, 0.7, 0), A(-0.17, 0.62, 0.04), A(-0.15, 0.72, 0.1), 0.03 * s);         // trident hand, raised
      arm(skin, skin, A(0.11, 0.7, 0), A(0.16, 0.58, 0.02), A(0.11, 0.5, 0.07), 0.03 * s);             // hand on his hip
      // hair and a long beard in waves
      hair.ell(A(0, 0.9, -0.012), [0.07 * s, 0.07 * s, 0.066 * s], 0.014);
      hairFall(hair, A(0, 0.88, 0), 0.07 * s, 0.24 * s, 5, 0.9);
      hair.ell(A(0, 0.81, 0.04), [0.062 * s, 0.06 * s, 0.04 * s], 0.02); hair.ell(A(0, 0.755, 0.05), [0.046 * s, 0.05 * s, 0.034 * s], 0.02); hair.pair((x) => hair.ell(A(x * 0.025, 0.71, 0.055), [0.022 * s, 0.035 * s, 0.022 * s], 0.015));
      P.add('cloth', tail.mesh()); P.add('body', skin.mesh()); P.add('body', hair.mesh()); P.add('body', wave.mesh()); eyes(P, hd);
      // gold: a belt of scales where the tail begins, shells on his shoulders, a collar of pearls
      P.add('trim', ring(0.09 * s, y0 + 0.47 * s, 0.014 * s));
      P.add('accent', placeAt(cabochon(0.02 * s, 0.6), 0, 0.1 * s, y0 + 0.47 * s));
      P.add('trim', merge([-1, 1].map((x) => { const sh = scallop(0.05 * s, 1.3, 9); sh.rotateX(-1.2); sh.rotateZ(-x * 0.5); sh.translate(x * 0.105 * s, y0 + 0.74 * s, 0.0); return sh; })));
      P.add('pearl', around(14, 0.07 * s, y0 + 0.755 * s, () => sphere(0.011 * s, 0, 0, 0, 8)));
      // a tall crown of seven points, each tipped with a pearl, and gems round its band
      P.add('trim', pointedCrown(0.064 * s, y0 + 0.91 * s, 7, 0.14 * s, { flare: 0.22, w: 0.5 }));
      P.add('accent', gemRing(7, 0.073 * s, y0 + 0.93 * s, 0.01 * s, { phase: Math.PI / 7 }));
      P.add('trim', trident(A(-0.15, 0.72, 0.1), 0.88 * s, s));
      // a great scallop shell rising at his feet
      const big = scallop(0.15, 1.2, 13); big.rotateX(-0.25); big.translate(0.02, y0 + 0.02, 0.17);
      P.add('trim', big);
      P.add('pearl', sphere(0.028, 0.02, y0 + 0.05, 0.2, 14));
      return turnPiece(P, 0.4);
    },
    q() {
      // the mermaid queen on a coral rock, her tail curling round to the front
      const P = new Piece(), y0 = tideBase(P, 0.335, 0.12), s = 1.2, A = at([0, y0, 0], s);
      const skin = new Sculpt(0.016, 1.05), tail = new Sculpt(0.025, 1.2), rock = new Sculpt(0.04, 1.4), hair = new Sculpt(0.02, 1.15);
      rock.floor = y0 - 0.004; tail.floor = y0 - 0.004;
      rock.ell(A(-0.03, 0.08, -0.04), [0.16 * s, 0.12 * s, 0.13 * s]); rock.ell(A(0.07, 0.15, -0.06), [0.08 * s, 0.1 * s, 0.08 * s]);
      rock.chain([[-0.12, y0 + 0.12, -0.08, 0.02], [-0.16, y0 + 0.26, -0.1, 0.014], [-0.15, y0 + 0.36, -0.06, 0.008]], 0.012, 3);   // coral branches
      rock.chain([[-0.15, y0 + 0.22, -0.09, 0.012], [-0.21, y0 + 0.3, -0.06, 0.007]], 0.01, 2);
      merTail(tail, [[0, y0 + 0.46 * s, 0, 0.068 * s], [0.03, y0 + 0.35 * s, 0.06, 0.07 * s], [0.06, y0 + 0.2 * s, 0.12, 0.058 * s], [0.03, y0 + 0.08 * s, 0.18, 0.042 * s],
        [-0.06, y0 + 0.05 * s, 0.2, 0.03 * s], [-0.13, y0 + 0.08 * s, 0.15, 0.02 * s]], [-0.16, y0 + 0.11 * s, 0.12], 0.07);
      skin.ell(A(0, 0.55, 0), [0.058 * s, 0.09 * s, 0.044 * s], 0.03);
      skin.pair((x) => skin.ell(A(x * 0.064, 0.62, 0), [0.03 * s, 0.028 * s, 0.03 * s], 0.025));
      skin.cone(A(0, 0.63, 0.004), A(0, 0.69, 0.008), 0.024 * s, 0.022 * s, 0.01);
      const hd = head(skin, A(0, 0.745, 0.012), 0.055 * s);
      arm(skin, skin, A(-0.064, 0.61, 0), A(-0.1, 0.52, 0.03), A(-0.03, 0.49, 0.075), 0.019 * s);
      arm(skin, skin, A(0.064, 0.61, 0), A(0.11, 0.66, 0.02), A(0.09, 0.78, 0.04), 0.019 * s);        // hand raised to her hair
      hair.ell(A(0, 0.77, -0.012), [0.062 * s, 0.062 * s, 0.06 * s], 0.012);
      hairFall(hair, A(0, 0.76, 0.0), 0.06 * s, 0.36 * s, 6, 1.05);
      P.add('cloth', tail.mesh()); P.add('body', skin.mesh()); P.add('rock', rock.mesh()); P.add('hair', hair.mesh()); eyes(P, hd);
      // two scallop shells for a top, a pearl in her hand, a belt of pearls where her scales begin
      P.add('trim', merge([-1, 1].map((x) => { const sh = scallop(0.03 * s, 1.1, 7); sh.rotateX(-0.2); sh.translate(x * 0.027 * s, y0 + 0.555 * s, 0.035 * s); return sh; })));
      P.add('pearl', sphere(0.026 * s, -0.025 * s, y0 + 0.5 * s, 0.09 * s, 16));
      P.add('pearl', around(14, 0.064 * s, y0 + 0.465 * s, () => sphere(0.009 * s, 0, 0, 0, 8)));
      // a tall crown: shells and points, a pearl at the front
      P.add('trim', pointedCrown(0.05 * s, y0 + 0.79 * s, 5, 0.16 * s, { flare: 0.26, w: 0.62 }));
      P.add('accent', gemRing(5, 0.056 * s, y0 + 0.805 * s, 0.008 * s, { phase: Math.PI / 5 }));
      P.add('pearl', placeAt(sphere(0.016 * s, 0, 0, 0, 12), 0, 0.064 * s, y0 + 0.845 * s));
      return turnPiece(P, -0.4);
    },
    b() {
      // a jellyfish: its glowing bell makes the mitre, slit and all; frilled arms and long
      // tentacles drift down to a nest of pearls and coral
      const P = new Piece(), y0 = tideBase(P, 0.31, 0.11);
      const bellY = y0 + 0.6, R = 0.185;
      P.lathe('jelly', profile(0, bellY - 0.03).line(R * 0.55, bellY - 0.02).curve([[R * 0.85, bellY - 0.03], [R * 1.02, bellY - 0.01]])
        .curve([[R * 1.05, bellY + 0.07], [R * 0.98, bellY + 0.17], [R * 0.78, bellY + 0.27], [R * 0.42, bellY + 0.34], [0, bellY + 0.36]]),
      { mod: mods([MOD.lobes(12, 0.08, bellY - 0.04, bellY + 0.05, { end: 0.03 }), MOD.slit(Math.PI * 0.25, bellY + 0.22, 0.5, 0.02, 0.4)]) });
      P.add('trim', ring(R * 1.0, bellY + 0.035, 0.009));
      P.add('accent', around(12, R * 1.02, bellY + 0.035, () => cabochon(0.011, 0.6), { phase: Math.PI / 12 }));
      P.add('trim', around(6, R * 0.8, bellY + 0.2, () => K.tube([[0, -0.12, 0], [0, 0, 0.012], [0, 0.11, 0]], 0.005, { segs: 12, radial: 5 }), { tilt: -0.55 }));   // gold veins up the bell
      P.add('pearl', sphere(0.026, 0, bellY + 0.38, 0, 14));
      // tentacles and four frilled arms
      const tent = [];
      for (let i = 0; i < 10; i++) {
        const th = (i / 10) * TAU + 0.2, r0 = R * 0.85, pts = [];
        for (let k = 0; k <= 8; k++) { const t = k / 8, r = r0 * (1 - t * 0.35) + Math.sin(t * 7 + i) * 0.018, y = bellY - 0.02 - t * (bellY - y0 - 0.12); pts.push([Math.sin(th + Math.sin(t * 4 + i) * 0.25) * r, y, Math.cos(th + Math.sin(t * 4 + i) * 0.25) * r]); }
        tent.push(K.tube(pts, 0.01, { segs: 30, radial: 6, radiusAt: (t) => mix(1, 0.45, t) }));
      }
      for (let i = 0; i < 4; i++) {
        const th = (i / 4) * TAU + Math.PI / 4, pts = [];
        for (let k = 0; k <= 10; k++) { const t = k / 10, r = 0.06 + Math.sin(t * 9 + i) * 0.03, y = bellY - 0.02 - t * (bellY - y0 - 0.1); pts.push([Math.sin(th + t * 1.4) * r, y, Math.cos(th + t * 1.4) * r]); }
        tent.push(K.tube(pts, 0.026, { segs: 48, radial: 8, radiusAt: (t) => mix(1, 0.5, t) * (0.75 + 0.4 * Math.sin(t * 46)) }));
      }
      P.add('jelly', merge(tent));
      // the nest: pearls and a little coral where the tentacles end
      P.add('pearl', merge([[0.06, 0.03], [-0.07, 0.02], [0.0, -0.08], [0.09, -0.07], [-0.05, 0.09], [0.03, 0.1]].map(([x, z], i) => sphere(0.026 + (i % 3) * 0.006, x, y0 + 0.025, z, 12))));
      P.add('trim', around(5, 0.15, y0, () => curl(petal(0.05, 0.08, 0.008), 3), { tilt: 0.5, phase: 0.3 }));
      return P;
    },
    n() {
      // a seahorse: an S of ringed segments, a spiny crest and coronet, its tail curled into a spiral
      const P = new Piece(), y0 = tideBase(P, 0.322, 0.11);
      const S = new Sculpt(0.02, 1.0);
      S.floor = y0 - 0.004;
      // the spine: tail spiral on the base, belly swelling forward, neck arching back to the head
      const spine = [];
      for (let i = 0; i <= 14; i++) { const t = i / 14, a = Math.PI * 0.4 + t * TAU * 1.05, rr = mix(0.085, 0.02, t); spine.push([0, y0 + 0.09 + Math.cos(a) * rr * 0.9, -0.04 + Math.sin(a) * rr, mix(0.046, 0.016, t)]); }
      spine.reverse();
      const body = [[0, y0 + 0.16, -0.125, 0.048], [0, y0 + 0.27, -0.075, 0.068], [0, y0 + 0.39, 0.01, 0.092], [0, y0 + 0.5, 0.035, 0.094], [0, y0 + 0.62, 0.005, 0.078], [0, y0 + 0.72, -0.045, 0.064], [0, y0 + 0.8, -0.055, 0.058]];
      S.chain(spine.concat(body), 0.016, 3);
      S.ell([0, y0 + 0.845, -0.015], [0.062, 0.068, 0.088], 0.03);                                  // head
      S.cone([0, y0 + 0.835, 0.04], [0, y0 + 0.795, 0.18], 0.036, 0.02, 0.016);                   // snout
      S.ell([0, y0 + 0.792, 0.188], [0.026, 0.024, 0.014], 0.008);
      S.pair((x) => S.ell([x * 0.052, y0 + 0.862, 0.01], [0.018, 0.022, 0.022], 0.012));            // brow ridges
      P.add('body', S.mesh());
      P.add('eye', merge([-1, 1].map((x) => sphere(0.016, x * 0.056, y0 + 0.862, 0.024, 12))));
      // gold rings along the body, as a seahorse's armour of plates
      const crv = new THREE.CatmullRomCurve3(spine.concat(body).map((p) => new THREE.Vector3(p[0], p[1], p[2])));
      const rings = [], rad = spine.concat(body).map((p) => p[3]);
      for (let i = 2; i < 23; i++) {
        const t = i / 24, p = crv.getPointAt(t), tg = crv.getTangentAt(t), r = rad[Math.min(rad.length - 1, Math.round(t * (rad.length - 1)))] * 1.02;
        const tr = new THREE.TorusGeometry(r, 0.0065, 6, Math.max(12, Math.round(28 * DETAIL.around)));
        tr.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tg)); tr.translate(p.x, p.y, p.z);
        rings.push(tr);
      }
      P.add('trim', merge(rings));
      // the coronet, a crest of spines down the neck and a fan-shaped back fin
      P.add('trim', merge([0, 1, 2, 3, 4].map((i) => { const c = new THREE.ConeGeometry(0.016, 0.08, 6); c.rotateX(-0.35 - i * 0.2); c.translate(0, y0 + 0.92 + Math.sin(i * 0.7) * 0.014, 0.01 - i * 0.026); return c; })));
      P.add('trim', merge([0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const t = i / 7, c = new THREE.ConeGeometry(0.014, 0.085 - t * 0.03, 5); c.rotateX(-1.7 + t * 0.5); c.translate(0, y0 + mix(0.84, 0.44, t), mix(-0.12, -0.06, t) - 0.035); return c; })));
      const fin = sheet(Math.round(16 * DETAIL.around) + 4, 4, (u, v) => { const a = mix(-1.0, 0.7, u), r = 0.04 + v * (0.13 + 0.016 * Math.cos(u * 9 * TAU)); return [0, y0 + 0.56 + Math.cos(a) * r, -0.07 - Math.sin(a + 1.6) * r * 0.9 - 0.03]; }, 0.007);
      P.add('fin', fin);
      // little fins at the cheeks
      P.add('fin', merge([-1, 1].map((x) => { const f = scallop(0.045, 1.0, 5); f.rotateY(x * 1.3); f.rotateZ(x * 0.6); f.translate(x * 0.062, y0 + 0.82, -0.03); return f; })));
      P.add('pearl', sphere(0.022, 0.0, y0 + 0.03, 0.13, 12));
      return P;
    },
    r() {
      // a lighthouse on a rock in the waves: a striped tower, a gallery with battlements and a
      // lantern that glows
      const P = new Piece(), y0 = tideBase(P, 0.33, 0.11);
      const rock = new Sculpt(0.035, 1.35);
      rock.floor = y0 - 0.004;
      rock.ell([0, y0 + 0.02, 0], [0.25, 0.07, 0.24]); rock.ell([0.12, y0 + 0.06, 0.08], [0.09, 0.07, 0.08]); rock.ell([-0.13, y0 + 0.05, -0.06], [0.1, 0.07, 0.09]);
      P.add('body', rock.mesh());
      const top = y0 + 0.5;
      P.lathe('body', profile(0, y0 + 0.04).line(0.175, y0 + 0.04).line(0.17, y0 + 0.08).curve([[0.155, y0 + 0.25], [0.138, top - 0.04]]).line(0.135, top).line(0, top));
      for (const [y, r] of [[y0 + 0.13, 0.166], [y0 + 0.25, 0.155], [y0 + 0.37, 0.146]]) P.add('trim', ring(r, y, 0.012));
      // an arched door with a gold frame and little lit windows
      const door = new THREE.SphereGeometry(0.045, 16, 8, 0, TAU, 0, Math.PI / 2); door.scale(1, 1.4, 0.35); door.rotateX(Math.PI / 2); door.rotateX(-Math.PI / 2);
      P.add('glow', placeAt(rbox(0.06, 0.075, 0.02, 0.008), 0, 0.165, y0 + 0.15));
      P.add('trim', placeAt(K.tube([[-0.036, -0.045, 0], [-0.036, 0.02, 0], [0, 0.05, 0], [0.036, 0.02, 0], [0.036, -0.045, 0]], 0.006, { segs: 20, radial: 6 }), 0, 0.17, y0 + 0.16));
      P.add('glow', around(3, 0.148, y0 + 0.31, () => rbox(0.028, 0.045, 0.02, 0.007), { phase: Math.PI / 3 }));
      // the gallery: a deck with battlements round it, and pearls along its rim
      P.lathe('trim', profile(0, top).line(0.2, top).line(0.21, top + 0.02).line(0.2, top + 0.035).line(0, top + 0.035));
      P.add('body', battlements(8, 0.168, 0.2, top + 0.034, top + 0.12, 0.42, 'round', 0.03));
      P.add('pearl', around(16, 0.212, top + 0.015, () => sphere(0.008, 0, 0, 0, 8)));
      // the lantern: glowing panes between gold mullions, under a dome with a pearl on top
      const ly = top + 0.04;
      P.add('glow', cyl(0.095, 0.095, 0.15, 0, ly + 0.075, 0, 24));
      P.add('trim', around(8, 0.097, ly + 0.075, () => rbox(0.012, 0.16, 0.012, 0.004)));
      P.add('trim', ring(0.1, ly + 0.002, 0.009)); P.add('trim', ring(0.1, ly + 0.15, 0.009));
      P.lathe('body', profile(0, ly + 0.15).line(0.118, ly + 0.15).curve([[0.11, ly + 0.2], [0.075, ly + 0.25], [0.02, ly + 0.275]]).line(0, ly + 0.276), { mod: MOD.flutes(8, 0.05, ly + 0.16, ly + 0.27, { end: 0.01 }) });
      P.add('pearl', sphere(0.022, 0, ly + 0.3, 0, 14));
      // coral and shells at the foot
      const coral = new Sculpt(0.012);
      for (let i = 0; i < 3; i++) {
        const th = 2.2 + i * 1.6, r = 0.2;
        coral.chain([[Math.sin(th) * r, y0 + 0.03, Math.cos(th) * r, 0.016], [Math.sin(th) * r * 1.05, y0 + 0.12, Math.cos(th) * r * 1.05, 0.011], [Math.sin(th + 0.12) * r * 1.1, y0 + 0.19, Math.cos(th + 0.12) * r * 1.1, 0.006]], 0.01, 2);
        coral.chain([[Math.sin(th) * r * 1.03, y0 + 0.09, Math.cos(th) * r * 1.03, 0.009], [Math.sin(th - 0.2) * r * 1.12, y0 + 0.16, Math.cos(th - 0.2) * r * 1.12, 0.005]], 0.008, 2);
      }
      P.add('rock', coral.mesh());
      P.add('trim', placeAt(scallop(0.05, 1.2, 9), 0.6, 0.21, y0 + 0.02, { tilt: -0.5 }));
      P.add('trim', placeAt(star(0.04, 0.012), -0.7, 0.22, y0 + 0.07, { tilt: -0.9 }));
      return P;
    },
    p() {
      // a pearl in an open scallop shell, on a stem of gold coral
      const P = new Piece(), y0 = tideBase(P, 0.27, 0.095);
      P.lathe('trim', profile(0, y0).line(0.1, y0).curve([[0.06, y0 + 0.05], [0.04, y0 + 0.12], [0.05, y0 + 0.17]]).line(0.07, y0 + 0.18).line(0, y0 + 0.18));
      P.add('trim', around(5, 0.05, y0 + 0.1, () => curl(petal(0.04, 0.09, 0.007), 4), { tilt: 0.35 }));
      // the lower shell, a fluted dish, and the upper shell standing open behind
      const dy = y0 + 0.17;
      P.lathe('body', profile(0, dy).line(0.05, dy).curve([[0.12, dy + 0.02], [0.17, dy + 0.06], [0.185, dy + 0.1]]).line(0.175, dy + 0.105).curve([[0.15, dy + 0.065], [0.08, dy + 0.05]]).line(0, dy + 0.05),
        { mod: MOD.lobes(12, 0.1, dy + 0.02, dy + 0.11, { end: 0.01 }) });
      P.add('trim', ring(0.18, dy + 0.1, 0.007));
      const up = scallop(0.2, 1.15, 12); up.rotateX(-0.5); up.translate(0, dy + 0.07, -0.13);
      P.add('body', up);
      P.add('pearl', sphere(0.105, 0, dy + 0.15, 0, 32));
      P.add('accent', placeAt(cabochon(0.016, 0.6), 0, 0.17, dy + 0.075));
      return P;
    },
  };

  // ------------------------------------------------------------------ the raw sets
  // Three sets made the old way, by hand, with stone and clay: no lathe-perfect curves, no
  // polish. A hammer-dressed surface comes from nudging every vertex by a little smooth noise.
  function hewn(g, amt, seed, y0) {
    g = g.index ? g.toNonIndexed() : g;
    const p = g.attributes.position, s = (seed || 1) * 7.31;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y0 !== undefined && y < y0) continue;
      const n = Math.sin(x * 41 + s) * Math.cos(z * 37 - s) + Math.sin(y * 53 + x * 13 + s) * 0.6 + Math.sin(z * 29 + y * 31) * 0.4;
      const r = Math.hypot(x, z) || 1, k = amt * n;
      p.setXYZ(i, x + (x / r) * k, y + k * 0.25, z + (z / r) * k);
    }
    g.computeVertexNormals();
    return g;
  }
  const hewnLathe = (P, slot, prof, o, amt, seed) => P.add(slot, hewn(revolve(prof, Object.assign({ segs: 40 }, o || {})), amt === undefined ? 0.006 : amt, seed));
  // Stonehenge: sarsen and bluestone, standing stones and lintels, cut with stone hammers.
  function stoneBase(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).line(R * 0.97, 0.06 * k).line(R * 0.86, 0.1 * k).line(top, 0.13 * k);
  }
  const blocky = (n, y0, y1) => MOD.facets(n, y0, y1, 0.15);
  const SARSEN = {
    k() {
      const P = new Piece();
      // a tall standing stone, and on top a little trilithon: two uprights and a lintel
      hewnLathe(P, 'body', stoneBase(profile(0, 0), 0.32, 0.17).line(0.15, 0.6).line(0.14, 1.02).line(0.16, 1.05).line(0, 1.06), { mod: blocky(7, -1, 2) }, 0.007, 1);
      for (const x of [-0.07, 0.07]) P.add('body', hewn(new THREE.BoxGeometry(0.06, 0.16, 0.07, 2, 3, 2).translate(x, 1.14, 0), 0.004, 2));
      P.add('body', hewn(new THREE.BoxGeometry(0.24, 0.06, 0.09, 4, 2, 2).translate(0, 1.25, 0), 0.004, 3));
      return P;
    },
    q() {
      const P = new Piece();
      // a stone with a hole worn through it, like the Men-an-Tol
      hewnLathe(P, 'body', stoneBase(profile(0, 0), 0.31, 0.16).line(0.13, 0.62).line(0.12, 0.9).line(0, 0.92), { mod: blocky(8, -1, 2) }, 0.006, 4);
      const ring = new THREE.TorusGeometry(0.12, 0.05, 8, 14).scale(1, 1.05, 0.8).translate(0, 1.06, 0);
      P.add('body', hewn(ring, 0.006, 5));
      return P;
    },
    b() {
      const P = new Piece();
      const prof = stoneBase(profile(0, 0), 0.29, 0.14).line(0.11, 0.5).curve([[0.14, 0.7], [0.12, 0.88], [0.05, 1.0]]).line(0, 1.02);
      hewnLathe(P, 'body', prof, { mod: mods([blocky(6, -1, 2), MOD.slit(0.4, 0.83, 0.6, 0.026, 0.55)]) }, 0.005, 6);
      return P;
    },
    n() {
      const P = new Piece();
      hewnLathe(P, 'body', stoneBase(profile(0, 0), 0.31, 0.2).line(0.2, 0.3).line(0, 0.3), { mod: blocky(7, -1, 2) }, 0.006, 7);
      P.add('body', horse({ base: 0.3, mane: 'none', seed: 41, form: { facet: 0.032, girth: 1.12, tuck: 0.1, neck: -0.04, ears: 0.05, headW: 1.06 } }).body);
      return P;
    },
    r() {
      const P = new Piece(), top = 0.6;
      hewnLathe(P, 'body', stoneBase(profile(0, 0), 0.31, 0.22).line(0.2, top).line(0, top), { mod: blocky(9, -1, 2) }, 0.006, 8);
      // a ring of standing stones for battlements
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; P.add('body', hewn(new THREE.BoxGeometry(0.06, 0.13, 0.05, 2, 2, 2).rotateY(-a).translate(Math.sin(a) * 0.17, top + 0.06, Math.cos(a) * 0.17), 0.003, 9 + i)); }
      return P;
    },
    p() {
      const P = new Piece();
      hewnLathe(P, 'body', stoneBase(profile(0, 0), 0.25, 0.1, 0.85).line(0.08, 0.3).line(0, 0.31), { mod: blocky(6, -1, 2) }, 0.005, 10);
      P.add('body', hewn(new THREE.IcosahedronGeometry(0.11, 1).scale(1, 0.9, 1).translate(0, 0.42, 0), 0.01, 11));
      return P;
    },
  };
  // Mohenjo-daro and Harappa: fired clay, buff and red-slipped, painted in black bands.
  function clayBase(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).curve([[R + 0.005, 0.04 * k], [R - 0.03, 0.08 * k]]).line(top + 0.04, 0.11 * k).line(top, 0.14 * k);
  }
  const bands = (P, list) => list.forEach(([r, y]) => P.add('trim', ring(r, y, 0.008, { seg: 40, tube: 6 })));
  const HARAPPA = {
    k() {
      const P = new Piece();
      // the "priest-king": a robed figure with a headband and a round ornament on his brow
      hewnLathe(P, 'body', clayBase(profile(0, 0), 0.32, 0.17).curve([[0.13, 0.4], [0.15, 0.7], [0.17, 0.86]]).line(0.1, 0.92).line(0.08, 0.96).line(0, 0.97), {}, 0.004, 21);
      P.add('body', hewn(sphere(0.1, 0, 1.06, 0, 18).scale(1, 1.12, 1), 0.004, 22));
      P.add('trim', ring(0.1, 1.08, 0.014, { seg: 32 }));
      P.add('trim', sphere(0.03, 0, 1.08, 0.105, 10));
      P.add('trim', placeAt(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), 0, 0, 1.2));
      bands(P, [[0.165, 0.6], [0.17, 0.8]]);
      return P;
    },
    q() {
      const P = new Piece();
      // the "mother goddess": a fan headdress with a cup on either side
      hewnLathe(P, 'body', clayBase(profile(0, 0), 0.31, 0.16).curve([[0.12, 0.4], [0.14, 0.66], [0.15, 0.78]]).line(0.09, 0.84).line(0, 0.85), {}, 0.004, 23);
      P.add('body', hewn(sphere(0.09, 0, 0.93, 0, 16), 0.004, 24));
      P.add('body', hewn(new THREE.CylinderGeometry(0.17, 0.08, 0.1, 18, 1, false, -1.3, 2.6).translate(0, 1.04, -0.02), 0.004, 25));
      for (const s of [-1, 1]) P.add('trim', new THREE.CylinderGeometry(0.035, 0.025, 0.06, 10).translate(s * 0.13, 1.06, 0.02));
      bands(P, [[0.14, 0.62], [0.15, 0.74]]);
      return P;
    },
    b() {
      const P = new Piece();
      // a square seal-stone pillar with a slanted cut, like the steatite seals of Mohenjo-daro
      const prof = clayBase(profile(0, 0), 0.29, 0.14).line(0.12, 0.5).curve([[0.15, 0.7], [0.13, 0.86], [0.05, 0.98]]).line(0, 1.0);
      hewnLathe(P, 'body', prof, { mod: mods([MOD.facets(4, 0.14, 2, 0.35), MOD.slit(Math.PI / 4, 0.8, 0.6, 0.024, 0.55)]) }, 0.003, 26);
      P.add('trim', new THREE.BoxGeometry(0.1, 0.1, 0.01).translate(0, 0.62, 0.135));
      return P;
    },
    n() {
      const P = new Piece();
      hewnLathe(P, 'body', clayBase(profile(0, 0), 0.31, 0.2).line(0.2, 0.3).line(0, 0.3), {}, 0.004, 27);
      P.add('body', horse({ base: 0.3, mane: 'carved', seed: 43, form: { girth: 1.2, tuck: 0.02, neck: -0.1, reach: -0.06, ears: -0.1, headW: 1.12, nose: 0.02 } }).body);
      return P;
    },
    r() {
      const P = new Piece(), top = 0.66;
      // a granary tower of stacked mud brick, with gaps along the top
      hewnLathe(P, 'body', clayBase(profile(0, 0), 0.31, 0.21).line(0.2, top).line(0.16, top).line(0.16, top - 0.05).line(0, top - 0.05), { mod: mods([MOD.facets(6, 0.14, 2, 0.4), MOD.crenel(6, top - 0.11, top + 0.1, 0.32, 0.9)]) }, 0.003, 28);
      bands(P, [[0.205, 0.3], [0.205, 0.46]]);
      return P;
    },
    p() {
      const P = new Piece();
      // a little jar with a round clay bead for a head
      hewnLathe(P, 'body', clayBase(profile(0, 0), 0.25, 0.1, 0.85).curve([[0.12, 0.2], [0.09, 0.32]]).line(0, 0.33), {}, 0.004, 29);
      P.add('body', hewn(sphere(0.1, 0, 0.42, 0, 16), 0.004, 30));
      bands(P, [[0.11, 0.24]]);
      return P;
    },
  };
  // Machu Picchu: grey andesite dressed into many-sided blocks, with a little hammered gold.
  function incaBase(p, R, top, k) {
    k = k || 1;
    // two steps, as in a terrace wall
    return p.line(R, 0).line(R, 0.05 * k).line(R * 0.84, 0.06 * k).line(R * 0.84, 0.11 * k).line(top, 0.13 * k);
  }
  const INCA = {
    k() {
      const P = new Piece();
      hewnLathe(P, 'body', incaBase(profile(0, 0), 0.33, 0.17).line(0.13, 0.84).line(0.17, 0.86).line(0.17, 0.92).line(0, 0.93), { mod: MOD.facets(4, -1, 2, 0.1) }, 0.004, 31);
      // Inti, the sun: a gold disc with rays, standing on his head
      const sun = merge([new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24).rotateX(Math.PI / 2), ...Array.from({ length: 12 }, (_, i) => { const r = ray(0.05, 0.07, 0.02); r.translate(0, 0.095, 0); r.rotateZ(i / 12 * TAU); return r; })]);
      P.add('trim', sun.translate(0, 1.1, 0));
      return P;
    },
    q() {
      const P = new Piece();
      hewnLathe(P, 'body', incaBase(profile(0, 0), 0.32, 0.16).line(0.12, 0.76).line(0.16, 0.78).line(0.16, 0.84).line(0, 0.85), { mod: MOD.facets(5, -1, 2, 0.15) }, 0.004, 32);
      // Mama Killa, the moon, as a crescent
      P.add('trim', crescent(0.14, 0.03).translate(0, 1.0, 0));
      return P;
    },
    b() {
      const P = new Piece();
      const prof = incaBase(profile(0, 0), 0.3, 0.14).line(0.11, 0.56).line(0.13, 0.6).line(0.04, 0.66).line(0, 0.66);
      hewnLathe(P, 'body', prof, { mod: MOD.facets(4, -1, 2, 0.1) }, 0.004, 33);
      // a tumi: the half-moon blade of a ceremonial knife, with the bishop's notch in its edge
      const half = [];
      for (let i = 0; i <= 20; i++) { const a = Math.PI * i / 20; half.push([Math.cos(a) * 0.15, 0.22 + Math.sin(a) * 0.2 * (Math.abs(a - Math.PI * 0.62) < 0.18 ? 0.7 : 1)]); }
      half.push([-0.04, 0.2], [-0.03, 0], [0.03, 0], [0.04, 0.2]);
      P.add('trim', extrude(half, 0.03, 0.008, { bevelSegments: 2 }).translate(0, 0.62, 0));
      return P;
    },
    n() {
      const P = new Piece();
      hewnLathe(P, 'body', incaBase(profile(0, 0), 0.31, 0.2).line(0.2, 0.3).line(0, 0.3), { mod: MOD.facets(4, -1, 2, 0.1) }, 0.004, 34);
      P.add('body', horse({ base: 0.3, mane: 'none', seed: 47, form: { facet: 0.026, tuck: 0.3, neck: 0.04, girth: 0.96, reach: 0.08, ears: 0.22 } }).body);
      return P;
    },
    r() {
      const P = new Piece(), top = 0.64;
      hewnLathe(P, 'body', incaBase(profile(0, 0), 0.32, 0.22).line(0.19, top).line(0, top), { mod: MOD.facets(4, -1, 2, 0.05) }, 0.003, 35);
      for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) P.add('body', hewn(new THREE.BoxGeometry(0.08, 0.12, 0.08, 2, 2, 2).translate(x * 0.095, top + 0.055, z * 0.095), 0.003, 36));
      // a trapezoid doorway, the Inca builders' signature
      P.add('trim', extrude([[-0.05, 0], [0.05, 0], [0.035, 0.14], [-0.035, 0.14]], 0.01, 0.003).translate(0, 0.3, 0.14));
      return P;
    },
    p() {
      const P = new Piece();
      hewnLathe(P, 'body', incaBase(profile(0, 0), 0.26, 0.1, 0.85).line(0.08, 0.3).line(0.1, 0.31).line(0, 0.32), { mod: MOD.facets(4, -1, 2, 0.1) }, 0.004, 37);
      P.add('body', hewn(new THREE.IcosahedronGeometry(0.105, 1).translate(0, 0.42, 0), 0.006, 38));
      return P;
    },
  };

  // ------------------------------------------------------------------ Norse Carved (wood)
  // Whittled in birch and bog oak by the fire in a Norse hall: stacked, turned shapes with
  // knife-cut rings, a hammer for the king, a dragon-prow knight and toadstool pawns.
  function norseBase(p, R, top, k) {
    k = k || 1;
    return p.line(R, 0).line(R, 0.05 * k).line(R * 0.9, 0.065 * k).line(R * 0.9, 0.1 * k).line(top + 0.03, 0.12 * k).line(top, 0.14 * k);
  }
  const knife = (y0, y1, n) => MOD.rope(n || 6, 0.22, y0, y1, 1.2);
  // tiers turned one on another, like the stacked pieces in old Norse sets
  function tiers(p, r0, y0, n, h, shrink) {
    let r = r0, y = y0;
    for (let i = 0; i < n; i++) { p.line(r * 1.18, y + h * 0.15).line(r * 1.18, y + h * 0.45).line(r * 0.8, y + h * 0.6).line(r * 0.8, y + h); r *= shrink; y += h; }
    return { p, y, r };
  }
  const NORSE = {
    k() {
      const P = new Piece();
      const t = tiers(norseBase(profile(0, 0), 0.34, 0.16).line(0.13, 0.5), 0.13, 0.5, 3, 0.1, 0.86);
      t.p.line(0.07, t.y + 0.04).line(0, t.y + 0.04);
      hewnLathe(P, 'body', t.p, { mod: knife(0.14, 0.48) }, 0.0025, 51);
      // Mjolnir, Thor's hammer, standing on the king's head
      P.add('trim', new THREE.CylinderGeometry(0.024, 0.026, 0.16, 10).translate(0, t.y + 0.12, 0));
      P.add('trim', hewn(new THREE.BoxGeometry(0.2, 0.09, 0.1, 3, 2, 2).translate(0, t.y + 0.24, 0), 0.004, 52));
      P.add('accent', ring(0.12, 0.3, 0.008, { seg: 32 }));
      return P;
    },
    q() {
      const P = new Piece();
      const t = tiers(norseBase(profile(0, 0), 0.33, 0.15).line(0.12, 0.46), 0.12, 0.46, 3, 0.09, 0.84);
      t.p.curve([[0.09, t.y + 0.06], [0.06, t.y + 0.1], [0, t.y + 0.11]]);
      hewnLathe(P, 'body', t.p, { mod: knife(0.14, 0.44) }, 0.0025, 53);
      // a circlet of carved leaves
      P.add('trim', pointedCrown(0.085, t.y - 0.02, 6, 0.08, { flare: 0.2, w: 0.9 }));
      P.add('accent', ring(0.115, 0.28, 0.008, { seg: 32 }));
      return P;
    },
    b() {
      const P = new Piece();
      const t = tiers(norseBase(profile(0, 0), 0.3, 0.13).line(0.1, 0.36), 0.1, 0.36, 2, 0.1, 0.8);
      t.p.curve([[0.09, t.y + 0.08], [0.05, t.y + 0.18], [0, t.y + 0.24]]);
      hewnLathe(P, 'body', t.p, { mod: knife(0.13, 0.34, 5) }, 0.0025, 54);
      // a rune cut into the cap: Tiwaz, the arrow
      P.add('accent', extrude([[0, 0.07], [0.04, 0.03], [0.03, 0.022], [0.007, 0.045], [0.007, -0.03], [-0.007, -0.03], [-0.007, 0.045], [-0.03, 0.022], [-0.04, 0.03]], 0.012, 0.002).translate(0, t.y + 0.07, 0.072));
      return P;
    },
    n() {
      const P = new Piece();
      hewnLathe(P, 'body', norseBase(profile(0, 0), 0.31, 0.2).line(0.2, 0.3).line(0, 0.3), { mod: knife(0.12, 0.3, 8) }, 0.0025, 55);
      P.add('body', horse({ base: 0.3, mane: 'carved', seed: 59, form: { tuck: 0.34, neck: 0.14, girth: 0.88, reach: 0.22, ears: 0.38, headW: 0.94, nose: 0.024 } }).body);
      return P;
    },
    r() {
      const P = new Piece();
      // a stacked tower like a longhouse roof seen end on: four tiers and a little ridge
      const t = tiers(norseBase(profile(0, 0), 0.32, 0.17).line(0.15, 0.24), 0.15, 0.24, 4, 0.1, 0.9);
      t.p.line(0.06, t.y + 0.03).line(0, t.y + 0.03);
      hewnLathe(P, 'body', t.p, { mod: MOD.facets(8, 0.14, t.y, 0.25) }, 0.003, 56);
      return P;
    },
    p() {
      const P = new Piece();
      // a toadstool: a short stem and a round cap
      const p = norseBase(profile(0, 0), 0.26, 0.09, 0.8).line(0.07, 0.24).line(0.08, 0.26)
        .curve([[0.15, 0.27], [0.17, 0.31], [0.14, 0.37], [0.07, 0.4], [0, 0.41]]);
      hewnLathe(P, 'body', p, {}, 0.002, 57);
      return P;
    },
  };

  // ------------------------------------------------------------------ Gods of Sounion (statues)
  // Little statues as at the temple of Poseidon on Cape Sounion: a hoplite with spear and
  // shield, a fluted column, a breaking wave, a rearing horse, a draped goddess and the sea god
  // with his trident. White is Parian marble, black green-bronze.
  function sounionBase(P, R, h) {
    P.lathe('body', profile(0, 0).line(R - 0.012, 0).arc(R, 0.014, 0.3).line(R, 0.03).line(R - 0.02, 0.04).line(R - 0.03, h - 0.012).arc(R - 0.04, h, 0.35).line(0, h));
    P.add('trim', keyBand(R - 0.002, 0.008, 0.02, Math.round(R * 60), 0.004, 0.003));
    return h;
  }
  const SOUNION = {
    k() {
      const P = new Piece(), y0 = sounionBase(P, 0.34, 0.1), s = 1.14, A = at([0, y0, 0], s);
      const body = new Sculpt(0.018, 1.2), robe = new Sculpt(0.02, 1.3);
      robe.floor = y0 - 0.004;
      robe.cone(A(0, 0, 0), A(0, 0.4, 0), 0.15 * s, 0.09 * s, 0.03);                       // a himation round the legs
      robe.cone(A(0.06, 0.42, 0.02), A(-0.09, 0.66, -0.01), 0.04 * s, 0.035 * s, 0.03);       // over one shoulder
      body.ell(A(0, 0.55, 0.01), [0.1 * s, 0.14 * s, 0.075 * s], 0.04);                        // a strong bare chest
      body.pair((x) => body.ell(A(x * 0.1, 0.67, 0), [0.045 * s, 0.04 * s, 0.045 * s], 0.03));
      body.cone(A(0, 0.69, 0), A(0, 0.75, 0.004), 0.034 * s, 0.032 * s, 0.01);
      const hd = head(body, A(0, 0.82, 0.008), 0.064 * s, { beard: 0.9, moustache: true });
      body.ell(A(0, 0.85, -0.012), [0.07 * s, 0.07 * s, 0.066 * s], 0.014);                      // thick curled hair
      arm(body, body, A(-0.11, 0.66, 0), A(-0.17, 0.75, 0.02), A(-0.16, 0.9, 0.04), 0.028 * s);   // arm raised with the trident
      arm(body, body, A(0.11, 0.66, 0), A(0.15, 0.52, 0.03), A(0.12, 0.42, 0.06), 0.028 * s);
      P.add('body', body.mesh()); P.add('cloth', robe.mesh()); eyes(P, hd);
      // the trident
      const tp = A(-0.16, 0.9, 0.04);
      P.add('trim', new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.86 * s, 8).translate(tp[0], y0 + 0.43 * s, tp[2]));
      const fork = [];
      for (const dx of [-0.05, 0, 0.05]) fork.push(new THREE.ConeGeometry(0.011 * s, 0.09 * s, 6).translate(tp[0] + dx * s, y0 + 0.97 * s, tp[2]), new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.06 * s, 6).translate(tp[0] + dx * s, y0 + 0.9 * s, tp[2]));
      fork.push(new THREE.BoxGeometry(0.11 * s, 0.012 * s, 0.012 * s).translate(tp[0], y0 + 0.87 * s, tp[2]));
      P.add('trim', merge(fork));
      return turnPiece(P, 0.4);
    },
    q() {
      const P = new Piece(), y0 = sounionBase(P, 0.33, 0.1), s = 1.08, A = at([0, y0, 0], s);
      const skin = new Sculpt(), gown = new Sculpt(0.025, 1.2);
      gown.floor = y0 - 0.004;
      // a long peplos falling in folds
      P.lathe('cloth', profile(0, y0).line(0.15 * s, y0).curve([[0.148 * s, y0 + 0.08 * s], [0.12 * s, y0 + 0.26 * s], [0.08 * s, y0 + 0.44 * s], [0.06 * s, y0 + 0.5 * s]]).line(0, y0 + 0.5 * s), { mod: MOD.flutes(18, 0.12, y0 + 0.01, y0 + 0.46 * s, { soft: true, end: 0.03 }) });
      gown.ell(A(0, 0.55, 0.004), [0.058 * s, 0.1 * s, 0.046 * s], 0.03);
      gown.pair((x) => gown.ell(A(x * 0.068, 0.62, 0), [0.03 * s, 0.026 * s, 0.03 * s], 0.025));
      skin.cone(A(0, 0.62, 0.004), A(0, 0.685, 0.006), 0.026 * s, 0.024 * s, 0.01);
      const hd = head(skin, A(0, 0.74, 0.01), 0.055 * s);
      // a veil over her hair, falling to her shoulders
      gown.cone(A(0, 0.78, -0.012), A(0, 0.6, -0.05), 0.064 * s, 0.07 * s, 0.02);
      arm(gown, skin, A(-0.07, 0.62, 0), A(-0.09, 0.53, 0.05), A(-0.02, 0.6, 0.07), 0.022 * s);   // hand at her breast
      arm(gown, skin, A(0.07, 0.62, 0), A(0.1, 0.5, 0.02), A(0.09, 0.4, 0.05), 0.022 * s);
      P.add('cloth', gown.mesh()); P.add('body', skin.mesh()); eyes(P, hd);
      P.add('trim', ring(0.052 * s, y0 + 0.8 * s, 0.006 * s));
      return turnPiece(P, -0.35);
    },
    b() {
      const P = new Piece(), y0 = sounionBase(P, 0.3, 0.09);
      // a breaking wave: a curling crest over a hollow, with a fringe of foam
      const pts = [];
      for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * Math.PI * 1.45; pts.push([0, y0 + 0.02 + Math.sin(a) * 0.3 * (0.6 + t * 0.6) + t * 0.32, -0.08 + Math.cos(a) * -0.16 * (0.5 + t * 0.7)]); }
      P.add('body', K.tube(pts, 0.09, { segs: 48, radial: 14, radiusAt: (t) => mix(1.2, 0.35, t) }));
      P.add('body', new THREE.CylinderGeometry(0.12, 0.17, 0.12, 24).translate(0, y0 + 0.06, 0));
      const foam = [];
      for (let i = 0; i < 9; i++) { const t = 0.55 + i * 0.05, a = t * Math.PI * 1.45; foam.push(sphere(0.022 + (i % 3) * 0.006, (i % 2 ? 0.03 : -0.03), y0 + 0.02 + Math.sin(a) * 0.3 * (0.6 + t * 0.6) + t * 0.32 + 0.04, -0.08 + Math.cos(a) * -0.16 * (0.5 + t * 0.7), 10)); }
      P.add('trim', merge(foam));
      return turnPiece(P, Math.PI / 2);
    },
    n() {
      const P = new Piece();
      P.lathe('body', profile(0, 0).line(0.29, 0).arc(0.3, 0.014, 0.3).line(0.3, 0.03).line(0.21, 0.06).line(0.2, 0.3).line(0, 0.3));
      P.add('trim', keyBand(0.298, 0.008, 0.02, 18, 0.004, 0.003));
      P.add('body', horse({ base: 0.3, mane: 'flow', seed: 61, form: { tuck: -0.3, neck: 0.18, lean: 0.16, reach: 0.12, chest: 0.2, ears: 0.26 } }).body);
      return P;
    },
    r() {
      const P = new Piece(), top = 0.92;
      // a Doric column on a square plinth, with its echinus and abacus
      const p = profile(0, 0).line(0.3, 0).line(0.3, 0.08).line(0.2, 0.09).line(0.2, 0.12).line(0.17, 0.13)
        .line(0.15, top - 0.12).line(0.16, top - 0.1).curve([[0.2, top - 0.06], [0.22, top - 0.03]]).line(0.22, top).line(0, top);
      P.lathe('body', p, { mod: mods([MOD.facets(4, 0, 0.085, 0.05), MOD.flutes(20, 0.09, 0.14, top - 0.12, { end: 0.02 }), MOD.facets(4, top - 0.03, top, 0.02)]) });
      return P;
    },
    p() {
      const P = new Piece(), y0 = sounionBase(P, 0.26, 0.07), s = 0.62, A = at([0, y0, 0], s);
      // a hoplite: crested helmet, round shield and spear
      const body = new Sculpt(0.016, 1.1);
      body.floor = y0 - 0.004;
      body.pair((x) => body.cone(A(x * 0.05, 0, 0), A(x * 0.045, 0.3, 0), 0.04 * s, 0.05 * s, 0.02));
      body.cone(A(0, 0.28, 0), A(0, 0.4, 0), 0.11 * s, 0.09 * s, 0.03);
      body.ell(A(0, 0.55, 0.01), [0.1 * s, 0.14 * s, 0.07 * s], 0.04);
      body.cone(A(0, 0.69, 0), A(0, 0.75, 0.004), 0.034 * s, 0.032 * s, 0.01);
      const c = A(0, 0.82, 0.008);
      body.ell(c, [0.064 * s * 0.92, 0.064 * s, 0.064 * s * 0.95], 0.01);
      arm(body, body, A(0.1, 0.66, 0), A(0.15, 0.55, 0.04), A(0.13, 0.62, 0.1), 0.026 * s);
      arm(body, body, A(-0.1, 0.66, 0), A(-0.15, 0.55, 0.04), A(-0.14, 0.5, 0.1), 0.026 * s);
      P.add('body', body.mesh());
      const hm = helmet(c, 0.064 * s, { crest: true, tall: 1.1 });
      P.add('trim', hm.metal); if (hm.crest) P.add('accent', hm.crest);
      const sh = shield(0.17 * s, 0.03);
      for (const g of [sh.face, sh.rim, sh.boss]) g.translate(-0.1 * s, y0 + 0.5 * s, 0.14 * s);
      P.add('trim', merge([sh.face, sh.rim])); P.add('accent', sh.boss);
      const sp = spear(0.9 * s, 0.006);
      for (const g of [sp.shaft, sp.head]) g.translate(0.13 * s, y0 + 0.08 * s, 0.1 * s);
      P.add('trim', merge([sp.shaft, sp.head]));
      return turnPiece(P, 0.3);
    },
  };


  // ------------------------------------------------------------------ Space Explorers (Saturn)
  // Rockets, a space station and astronauts for the table on Saturn's icy moon: gloss white
  // ceramic against deep space blue, with chrome fins and portholes that glow.
  function padBase(p, R, top, k) {
    k = k || 1;
    // a round launch pad: a low drum with a lip, stepping in to the craft
    return p.line(R - 0.01, 0).arc(R, 0.012 * k, 0.3).line(R, 0.05 * k).line(R - 0.025, 0.06 * k).line(R - 0.03, 0.085 * k)
      .line(top + 0.04, 0.1 * k).curve([[top + 0.015, 0.12 * k], [top, 0.15 * k]]);
  }
  // three swept fins round a rocket's foot, standing on radius r from y
  const fins = (n, r, y, h, reach) => around(n, r, y, () => extrude([[0, 0], [0, h], [reach * 0.35, h * 0.62], [reach, 0.0]], 0.014, 0.005, { bevelSegments: 1 }).rotateY(-Math.PI / 2), { phase: Math.PI / 6 });
  const portholes = (n, r, y, size) => around(n, r, y, () => cabochon(size, 0.45));
  const ASTRO = {
    k() {
      const R = 0.35, P = new Piece();
      // the great rocket: a slim body swelling at the waist, a ringed collar, a pointed nose
      const p = padBase(profile(0, 0), R, 0.16);
      p.curve([[0.15, 0.3], [0.14, 0.52], [0.13, 0.7]]).line(0.162, 0.71).line(0.162, 0.75).line(0.12, 0.76)
        .curve([[0.118, 0.84], [0.1, 0.92], [0.06, 0.99], [0.03, 1.02]]).line(0, 1.03);
      P.lathe('body', p);
      P.add('fin', fins(3, 0.15, 0.13, 0.32, 0.12));
      P.add('trim', ring(0.163, 0.73, 0.01));
      P.add('accent', portholes(4, 0.142, 0.5, 0.032));
      P.add('trim', placeAt(crossOf('orbit', 0.22, 0.04), 0, 0, 1.14));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = padBase(profile(0, 0), R, 0.15);
      p.curve([[0.14, 0.3], [0.122, 0.5], [0.112, 0.66]]).line(0.15, 0.67).line(0.15, 0.7).line(0.1, 0.71)
        .curve([[0.13, 0.76], [0.14, 0.82], [0.12, 0.87], [0.05, 0.89]]).line(0, 0.89);
      P.lathe('body', p);
      // a crown of eight beacons, each tipped with a glowing light
      P.add('visor', pointedCrown(0.12, 0.84, 8, 0.12, { flare: 0.22, w: 0.7 }));
      P.add('accent', sphere(0.05, 0, 0.95, 0, 20));
      P.add('accent', portholes(3, 0.13, 0.46, 0.028));
      P.add('fin', fins(3, 0.14, 0.13, 0.26, 0.1));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      // a nose cone with the bishop's slit and a porthole, and a little antenna on the tip
      const p = padBase(profile(0, 0), R, 0.13);
      p.curve([[0.12, 0.28], [0.104, 0.44], [0.098, 0.55]]).line(0.13, 0.56).line(0.13, 0.59).line(0.09, 0.6)
        .curve([[0.13, 0.67], [0.135, 0.77], [0.11, 0.87], [0.06, 0.95], [0.02, 0.985]]).line(0, 0.99);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.82, 0.6, 0.018, 0.5) });
      P.add('trim', ring(0.131, 0.575, 0.008));
      P.add('accent', placeAt(cabochon(0.034, 0.45), 0, 0.128, 0.7));
      P.add('trim', new THREE.CylinderGeometry(0.006, 0.006, 0.08, 8).translate(0, 1.02, 0));
      P.add('accent', sphere(0.016, 0, 1.065, 0, 12));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(padBase(profile(0, 0), R, 0.2), 0.2));
      // a horse ready for space: a short brushed mane and a chrome helmet ring at the neck
      const h = horse({ base: 0.31, mane: 'roach', seed: 73, form: { tuck: 0.06, neck: 0.11, reach: 0.1, ears: 0.3, girth: 0.92, headW: 1.02 } });
      P.add('body', h.body); P.add('trim', h.mane);
      P.add('trim', ring(0.205, 0.33, 0.016));
      const sp = h.surf([0, h.Y(0.9), 0.08], [0, 0.4, 1], 0.004), s = star(0.028, 0.01, 4); s.rotateX(-0.5); s.translate(sp[0], sp[1], sp[2]); P.add('accent', s);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      // a space station: a drum with battlements, a docking wheel round its middle
      const p = padBase(profile(0, 0), R, 0.22);
      p.curve([[0.224, 0.3], [0.218, 0.45], [0.222, 0.58]]).line(0.244, 0.59).line(0.244, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p);
      P.add('body', battlements(5, 0.2, 0.244, 0.635, 0.76, 0.42, 'flat'));
      P.add('trim', ring(0.29, 0.42, 0.022, { seg: 64 }));
      for (let i = 0; i < 4; i++) P.add('trim', new THREE.CylinderGeometry(0.008, 0.008, 0.07, 6).rotateZ(Math.PI / 2).translate(0.255, 0.42, 0).rotateY(i * Math.PI / 2 + Math.PI / 4));
      P.add('accent', portholes(5, 0.222, 0.52, 0.026));
      P.add('trim', new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8).translate(0, 0.7, 0));
      P.add('accent', sphere(0.022, 0, 0.79, 0, 12));
      return P;
    },
    p() {
      const R = 0.27, P = new Piece();
      // a little astronaut's helmet, its dark visor on the front
      const p = padBase(profile(0, 0), R, 0.1, 0.85);
      p.curve([[0.1, 0.22], [0.09, 0.3], [0.072, 0.35]]);
      ballHead(p, 0.072, 0.46, 0.11);
      P.lathe('body', p);
      const v = new THREE.SphereGeometry(0.112, 24, 12, -0.9, 1.8, 0.95, 0.9); v.translate(0, 0.46, 0.001); P.add('visor', v);
      P.add('trim', ring(0.09, 0.355, 0.012));
      return P;
    },
  };

  // ------------------------------------------------------------------ Falcon & Pearl (Burj Khalifa)
  // For the table at the top of the Burj Khalifa: pearl against black pearl, in gold, as the
  // pearl divers of the Gulf once brought up. The king is a stepped tower and its spire, the
  // knight an Arabian horse in a gold bridle and every pawn a pearl.
  function dhowBase(p, R, top, k) {
    k = k || 1;
    // a stepped foot like the tower's base, three setbacks
    return p.line(R, 0).line(R, 0.03 * k).line(R - 0.035, 0.035 * k).line(R - 0.035, 0.065 * k).line(R - 0.07, 0.07 * k)
      .line(R - 0.07, 0.095 * k).line(top + 0.03, 0.1 * k).curve([[top + 0.008, 0.12 * k], [top, 0.15 * k]]);
  }
  const FALCON = {
    k() {
      const R = 0.35, P = new Piece();
      // the tower: setbacks narrowing up to a slender spire
      const p = dhowBase(profile(0, 0), R, 0.16);
      p.line(0.15, 0.36).line(0.13, 0.37).line(0.13, 0.52).line(0.112, 0.53).line(0.112, 0.66).line(0.094, 0.67).line(0.094, 0.78)
        .line(0.07, 0.79).curve([[0.05, 0.86], [0.03, 0.93], [0.014, 1.0]]).line(0, 1.0);
      P.lathe('body', p, { mod: MOD.flutes(3, 0.08, 0.16, 0.78, { fillet: 0.8, end: 0.02 }) });
      P.add('trim', merge([0.365, 0.525, 0.665, 0.785].map((y, i) => ring([0.14, 0.122, 0.104, 0.082][i], y, 0.008))));
      P.add('trim', placeAt(crossOf('pearled', 0.22, 0.035), 0, 0, 1.11));
      return P;
    },
    q() {
      const R = 0.335, P = new Piece();
      const p = dhowBase(profile(0, 0), R, 0.15);
      p.curve([[0.14, 0.3], [0.118, 0.5], [0.108, 0.65]]).line(0.145, 0.66).line(0.145, 0.69).line(0.1, 0.7)
        .curve([[0.13, 0.76], [0.14, 0.82], [0.12, 0.87], [0.05, 0.89]]).line(0, 0.89);
      P.lathe('body', p);
      // a tiara of gold points, each tipped with a pearl, and a great pearl on top
      P.add('trim', pointedCrown(0.12, 0.83, 10, 0.11, { flare: 0.2, w: 0.7 }));
      P.add('pearl', sphere(0.055, 0, 0.96, 0, 24));
      P.add('pearl', beadRing(0.146, 0.675, 22, 0.011));
      return P;
    },
    b() {
      const R = 0.312, P = new Piece();
      const p = dhowBase(profile(0, 0), R, 0.13);
      p.curve([[0.12, 0.28], [0.104, 0.44], [0.098, 0.56]]).line(0.13, 0.57).line(0.13, 0.6).line(0.09, 0.61)
        .curve([[0.125, 0.68], [0.132, 0.78], [0.108, 0.88], [0.05, 0.96], [0.01, 0.99]]).line(0, 0.99);
      P.lathe('body', p, { mod: MOD.slit(Math.PI * 0.25, 0.83, 0.6, 0.018, 0.5) });
      P.add('trim', ring(0.131, 0.585, 0.009));
      P.add('pearl', sphere(0.03, 0, 1.02, 0, 16));
      return P;
    },
    n() {
      const R = 0.322, P = new Piece();
      P.lathe('body', knightBase(dhowBase(profile(0, 0), R, 0.2), 0.2));
      // an Arabian horse: a fine dished face, high neck and a long flowing mane, in a gold bridle
      const h = horse({ base: 0.31, mane: 'flow', seed: 79, form: { tuck: -0.22, neck: 0.16, lean: 0.06, reach: 0.02, ears: 0.34, headW: 0.9, nose: 0.018, girth: 0.86 } });
      P.add('body', h.body); P.add('trim', h.mane);
      const b = bridle(h, { stud: 0.014 }); P.add('trim', b.straps); P.add('pearl', b.studs);
      return P;
    },
    r() {
      const R = 0.322, P = new Piece();
      // a three-winged tower with stepped battlements, like the Burj seen from above
      const p = dhowBase(profile(0, 0), R, 0.22);
      p.curve([[0.226, 0.3], [0.22, 0.45], [0.224, 0.58]]).line(0.246, 0.59).line(0.246, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p, { mod: MOD.flutes(3, 0.07, 0.16, 0.58, { fillet: 0.8, end: 0.02 }) });
      P.add('body', battlements(6, 0.2, 0.246, 0.635, 0.77, 0.4, 'step'));
      P.add('trim', ring(0.247, 0.6, 0.009));
      P.add('pearl', beadRing(0.232, 0.36, 18, 0.012));
      return P;
    },
    p() {
      const R = 0.27, P = new Piece();
      // a pearl resting in a gold cup
      const p = dhowBase(profile(0, 0), R, 0.1, 0.85);
      p.curve([[0.095, 0.24], [0.085, 0.3], [0.07, 0.35]]).line(0, 0.35);
      P.lathe('body', p);
      P.lathe('trim', profile(0, 0.33).line(0.07, 0.33).curve([[0.1, 0.36], [0.104, 0.4]]).line(0.096, 0.4).curve([[0.09, 0.37], [0.06, 0.35]]).line(0, 0.35));
      P.add('pearl', sphere(0.112, 0, 0.47, 0, 32));
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
    // vetro lattimo: Murano's milk-white glass, made to rival Chinese porcelain
    lattimo: () => phys('lattimo', { color: '#f7f4ee', roughness: 0.1, transmission: 0.2, ior: 1.5, thickness: 0.6, attenuationColor: new THREE.Color('#efe6da'), attenuationDistance: 0.25, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.3, sheenColor: new THREE.Color('#ffffff'), specularIntensity: 1 }),
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
    // cut crystal: frosted enough to read on any board, clear at the facets' edges
    crystalLight: () => phys('crystal-light', { color: '#ffffff', metalness: 0, roughness: 0.03, transmission: 0.72, ior: 1.65, dispersion: 4, thickness: 0.6, attenuationColor: new THREE.Color('#e8eef8'), attenuationDistance: 0.5, specularIntensity: 1, envMapIntensity: 2, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.35 }),
    crystalJet: () => phys('crystal-jet', { color: '#3a3644', metalness: 0, roughness: 0.03, transmission: 0.4, ior: 1.65, dispersion: 2, thickness: 0.6, attenuationColor: new THREE.Color('#0d0b14'), attenuationDistance: 0.12, specularIntensity: 1, envMapIntensity: 1.8, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.2 }),
    opalWhite: () => phys('opal-w', { color: '#f4f1ee', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 900], sheen: 0.6, sheenColor: new THREE.Color('#bfe8ff'), sheenRoughness: 0.4 }),
    opalBlack: () => phys('opal-b', { color: '#161c34', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, iridescence: 1, iridescenceIOR: 1.8, iridescenceThicknessRange: [300, 1000], sheen: 0.5, sheenColor: new THREE.Color('#5fc8ff'), sheenRoughness: 0.4 }),
    ivoryEnamel: () => phys('ivory-enamel', { color: '#f3ecdc', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.2, sheenColor: new THREE.Color('#fff8ea') }),
    peacockEnamel: () => phys('peacock-enamel', { color: '#0b5a6a', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.5, sheenColor: new THREE.Color('#3fe0d0'), sheenRoughness: 0.4 }),
    sandalwood: () => phys('sandalwood', { map: TEX.wood('#f6e6c8', '#dcbc8c', { lines: 26, contrast: 0.26, figure: 0.08, seed: 12, pores: 0 }), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.16, sheen: 0.3, sheenColor: new THREE.Color('#fff0d8'), sheenRoughness: 0.5 }),
    rosewood: () => phys('rosewood', { map: TEX.wood('#3a221a', '#100806', { lines: 30, contrast: 0.55, figure: 0.12, seed: 14, pores: 0 }), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    silkSaffron: () => phys('silk-saffron', { color: '#eab95a', roughness: 0.42, sheen: 1, sheenColor: new THREE.Color('#ffe7b8'), sheenRoughness: 0.35, clearcoat: 0.2, clearcoatRoughness: 0.3 }),
    silkIndigo: () => phys('silk-indigo', { color: '#1c2148', roughness: 0.42, sheen: 1, sheenColor: new THREE.Color('#7f8cff'), sheenRoughness: 0.35, clearcoat: 0.2, clearcoatRoughness: 0.3 }),
    nacreDark: () => phys('nacre-dark', { color: '#1b2c3c', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.8, iridescenceIOR: 1.5, sheen: 0.6, sheenColor: new THREE.Color('#7fd8ff'), sheenRoughness: 0.4 }),
    scalesLight: () => phys('scales-light', { color: '#9fe0d2', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [200, 700] }),
    scalesDark: () => phys('scales-dark', { color: '#0b4652', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 800] }),
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
      id: 'regency', name: 'Regency Gilt', era: 'Regency England', year: 'c. 1815', tint: '#5c1428',
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
      id: 'staunton', name: 'Classic Staunton', era: 'Victorian London', year: '1849', tint: '#1d4a32',
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
      id: 'pharaoh', name: "Pharaoh's Treasure", era: 'Ancient Egypt', year: 'c. 1330 BC', tint: '#1d2f7a',
      story: 'Inspired by the treasures of the boy king Tutankhamun: alabaster that glows like moonlight, black basalt from the desert, and collars of gold, blue lapis lazuli and red carnelian. Every piece stands on a drum of gold set with a gem.',
      lore: {
        k: 'The pharaoh wears the striped nemes headcloth with a cobra at his brow, and holds a staff crowned with an ankh, the Egyptian sign of life.',
        q: 'The queen wears a crown of golden horns holding the sun, like the goddess Hathor, over a wig of blue lapis.',
        b: 'A great crystal held up on a falcon\'s golden wings. It glows blue for white and red for black.',
        n: 'A jackal guardian sitting up, ears high, like Anubis, who watched over the tombs.',
        r: 'A temple tower with a figure carved on every side, and a fire burning in a bowl on top.',
        p: 'A spearman in a striped headcloth, with a round shield marked with an ankh.',
      },
      pieces: EGYPT,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.alabaster(), gem: MAT.gem('#2a6af0'), crystal: phys('crystal-blue', { color: '#5a9aff', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#1e5cff', emissiveIntensity: 0.9, envMapIntensity: 2.2, iridescence: 0.3 }), eye: MAT.lacquer('#1a1a24') }
        : { body: MATS.basalt(), gem: MAT.gem('#e01830'), crystal: phys('crystal-red', { color: '#ff4a4a', roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#e01020', emissiveIntensity: 0.9, envMapIntensity: 2.2, iridescence: 0.3 }), eye: MAT.lacquer('#f4ecdc') },
      { trim: MAT.gold('#ebb84f'), accent: MATS.lapis(), accent2: MATS.carnelian(), hair: MATS.lapis(), flame: MAT.emissive('#ff7a1e', 2.2), flame2: MAT.emissive('#ffd060', 2.4) }),
    },

    olympian: {
      id: 'olympian', name: 'Olympian Marble', era: 'Ancient Greece', year: 'c. 440 BC', tint: '#2a5a7a',
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
      id: 'imperial', name: 'Imperial Rome', era: 'Ancient Rome', year: 'AD 113', tint: '#4a1840',
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
      id: 'maharaja', name: "Maharaja's Jade", era: 'Mughal India', year: 'c. 1640', tint: '#0e5a52',
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
    // Chaturanga's table: the jade set with the old Mantri and Gaja (see CHATURANGA). Hidden: not in the catalog.
    chaturanga: {
      id: 'chaturanga', name: "Maharaja's Jade", era: 'Mughal India', year: 'c. 1640', tint: '#0e5a52', hidden: true,
      story: 'The jade set from the age of the Taj Mahal, with two pieces carved the old way for Chaturanga.',
      lore: {
        k: 'The Raja: an onion dome on a drum of pointed arches.',
        q: 'The Mantri, the king\'s counsellor, in a wide turban with a jewelled plume. He steps one square on a slant.',
        b: 'The Gaja, a war elephant under a little golden canopy. It jumps two squares on a slant.',
        n: 'The Ashva, a royal horse with a jewelled bridle.',
        r: 'The Ratha, the chariot, here a fort tower like the Red Fort in Delhi.',
        p: 'A Padati, a foot soldier: a baluster with a lotus collar.',
      },
      pieces: CHATURANGA,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.jadeWhite() } : { body: MATS.jadeBlack() }, { trim: MAT.gold('#f0c35a'), accent: MATS.ruby(), accent2: MATS.emerald(), tusk: MATS.ivoryEnamel() }),
    },
    dynasty: {
      id: 'dynasty', name: 'Ming Porcelain', era: 'Ming China', year: 'c. 1420', tint: '#8a1e16',
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
      id: 'murano', name: 'Murano Glass', era: 'Venice', year: 'c. 1700', tint: '#14506a',
      story: 'Blown by the glassmakers of Murano, an island so secret that its masters were not allowed to leave. Milk-white lattimo glass, made to rival Chinese porcelain, faces deep cobalt blue, with gold leaf and twisted stems that catch the light.',
      lore: {
        k: 'A goblet crown under a glass ball and a golden cross.',
        q: 'A goblet whose rim rises into eight points, each tipped with gold.',
        b: 'A glass mitre on a twisted stem, with the bishop\'s slit.',
        n: 'A glass horse with a mane of gold.',
        r: 'A ribbed glass tower with battlements and a golden band.',
        p: 'A glass bubble on a twisted stem.',
      },
      pieces: MURANO,
      mats: (side) => Object.assign(side === 'w' ? { body: MATS.lattimo() } : { body: MATS.cobalt() }, { trim: MAT.gold('#f0c564') }),
    },
    tsarina: {
      id: 'tsarina', name: "Tsarina's Treasure", era: 'Imperial Russia', year: 'c. 1900', tint: '#13563a',
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
      id: 'manhattan', name: 'Manhattan Deco', era: 'New York', year: '1930', tint: '#2a2a36',
      story: 'Made in the year the Chrysler Building reached for the clouds: cream enamel and black onyx with gold, standing on stepped plinths like skyscrapers. The people of the jazz-age city are the pieces, with emeralds for white and rubies for black.',
      lore: {
        k: 'A tycoon in a long coat and cape, his hands on a cane, wearing a crown of arches like the top of a skyscraper, with a spire and a cross.',
        q: 'A dancer with a fur stole and a beaded gown, under a sunburst of golden rays.',
        b: 'A lamplighter in a fedora, carrying a street lamp that glows on a tall gold post.',
        n: 'A sleek horse with a fan-shaped mane of stepped gold fins.',
        r: 'A skyscraper with lit windows between gold piers, stepping back to battlements and a spire.',
        p: 'A round head like a lamp globe, over a golden sunburst fan.',
      },
      pieces: DECO,
      mats: (side) => (side === 'w'
        ? { body: MATS.cream(), trim: MAT.gold('#e8b75a'), gem: MAT.gem('#0f9a5a'), cloth: MAT.velvet('#e2d4b8'), fur: MAT.velvet('#f4ece0'), hair: MAT.lacquer('#2a1e16'), pearl: MATS.pearl(), eye: MAT.lacquer('#1a1a1e'), glow: MAT.emissive('#ffd890', 1.7) }
        : { body: MATS.onyx(), trim: MAT.gold('#e8b75a'), gem: MAT.gem('#d0142e'), cloth: MAT.velvet('#7a1020'), fur: MAT.velvet('#1c1a1e'), hair: MAT.lacquer('#0a0a0c'), pearl: MATS.pearl(), eye: MAT.lacquer('#f0ece4'), glow: MAT.emissive('#ffc870', 1.7) }),
    },

    crystal: {
      id: 'crystal', name: 'Crystal Jewels', era: 'The jeweller\'s window', year: 'Today', tint: '#3a2a6a',
      story: 'Cut like the crystal ornaments in a jeweller\'s window: clear crystal against jet black, every facet catching the light. Each kind of piece wears its own colour of gem, so you can tell them apart at a glance.',
      lore: {
        k: 'Blue sapphires ring his crown, and a crystal cross set with a sapphire stands on top.',
        q: 'Ten crystal points, each tipped with a red ruby, and a great ruby at the centre.',
        b: 'A cut-crystal mitre with the bishop\'s slit, belted with purple amethysts.',
        n: 'A horse cut from crystal like a gemstone, with emeralds on its bridle.',
        r: 'An eight-sided crystal tower with golden topaz set in every battlement.',
        p: 'A crystal ball over a ring of sea-blue aquamarines.',
      },
      pieces: CRYSTAL,
      mats: (side) => ({ body: side === 'w' ? MATS.crystalLight() : MATS.crystalJet(), trim: MAT.silver(), gemk: MAT.gem('#1f4fe0'), gemq: MAT.gem('#e0123c'), gemb: MAT.gem('#9a3ee8'), gemn: MAT.gem('#10a855'), gemr: MAT.gem('#f2a414'), gemp: MAT.gem('#38d4e8') }),
    },
    celestial: {
      id: 'celestial', name: 'Celestial Opal', era: 'The night sky', year: 'Always', tint: '#1c2450',
      story: 'White opal and black opal, the stones that hold a rainbow inside, set in silver and scattered with golden stars. Look for the ringed planets, the crescent moon and a comet\'s star on the knight\'s brow.',
      lore: {
        k: 'A planet with a silver ring, like Saturn, crowned with a starry cross.',
        q: 'A silver crescent moon holding a golden star.',
        b: 'A mitre circled by a silver orbit, with a star on top.',
        n: 'A horse with a stardust mane and a star on its forehead.',
        r: 'An observatory tower: a dome for watching the stars inside the battlements.',
        p: 'A little planet with its own ring.',
      },
      pieces: CELESTIAL,
      mats: (side) => ({ body: side === 'w' ? MATS.opalWhite() : MATS.opalBlack(), trim: MAT.silver(), accent: MAT.gold('#f0c35a') }),
    },
    peacock: {
      id: 'peacock', name: 'Peacock Court', era: 'A palace garden', year: 'Once upon a time', tint: '#0b5a6a',
      story: 'Peacocks strutted through the gardens of palaces all over the world. Ivory and peacock-blue enamel in gold, with fanned tails, crests and shining feather eyes.',
      lore: {
        k: 'Three peacock feathers fan out behind his crown, under a cross of four round lobes.',
        q: 'A whole peacock\'s tail fans out all the way round her crown.',
        b: 'A mitre with the bishop\'s slit, topped by a peacock\'s crest of little beads.',
        n: 'A horse with a plume of peacock feathers.',
        r: 'A tower with ten battlements and a ring of feather eyes.',
        p: 'A round head with a tiny peacock crest.',
      },
      pieces: PEACOCK,
      mats: (side) => (side === 'w' ? { body: MATS.ivoryEnamel(), trim: MAT.gold('#e8b85a'), accent: MAT.gem('#1d5fd0') } : { body: MATS.peacockEnamel(), trim: MAT.gold('#e8b85a'), accent: MAT.gem('#18b070') }),
    },
    army: {
      id: 'army', name: 'The Royal Army', era: 'Ancient India', year: 'c. 600 AD', tint: '#7a2a1a',
      story: 'Chess began in India as chaturanga, "the four arms": a battle game of elephants, horsemen, chariots and foot soldiers. This set turns the pieces back into an army, carved in sandalwood and ebony with silk robes, gold armour and jewels.',
      lore: {
        k: 'A proud king with a jewelled crown, a royal sceptre and a fine beard. Keep him safe: if he is trapped, the battle is lost.',
        q: 'A graceful queen in a tall crown and a flowing gown, holding a lotus flower. She is the strongest warrior on the field.',
        b: 'A camel rider in a pointed turban, carrying a shepherd\'s crook. Camels cross the desert diagonally, and so does the bishop.',
        n: 'A horseman on a prancing horse, sword raised and shield ready. Horses leap in an L, over anyone in the way.',
        r: 'A war elephant carrying a little fort, with a spearman keeping watch. The elephant was the rook in the very first chess sets.',
        p: 'A foot soldier with a sword and a round shield. March to the far side and you can become a queen.',
      },
      pieces: ARMY,
      mats: (side) => (side === 'w'
        ? { body: MATS.sandalwood(), cloth: MATS.silkSaffron(), trim: MAT.gold('#e2b04e'), accent: MAT.gem('#c0142e'), steel: MAT.silver(), tusk: MATS.ivoryEnamel(), eye: MAT.lacquer('#2a1a12') }
        : { body: MATS.rosewood(), cloth: MATS.silkIndigo(), trim: MAT.gold('#e2b04e'), accent: MAT.gem('#12905a'), steel: MAT.silver(), tusk: MATS.ivoryEnamel(), eye: MAT.lacquer('#f4ecdc') }),
    },
    robots: {
      id: 'robots', name: 'Robot Squad', era: 'The robot workshop', year: 'The future', tint: '#1e6c8c',
      story: 'A squad of friendly toy robots in glossy plastic and chrome, with eyes that glow. Every robot still wears its piece\'s badge, so you always know who is who.',
      lore: {
        k: 'The biggest robot, with a crown of five antennas and a glowing cross on top.',
        q: 'A robot queen with a halo of little radar dishes and a light for a heart.',
        b: 'A tall robot with a dome head and the bishop\'s slit as a slanted band of light.',
        n: 'A robot horse built from metal plates, with a mane of chrome fins.',
        r: 'A robot on caterpillar tracks, carrying a tower with lit windows and battlements.',
        p: 'A little round robot with an antenna. Small, but it can still become a queen.',
      },
      pieces: ROBOT,
      mats: (side) => (side === 'w'
        ? { body: lacquer('robot-w', '#f2f4f7', { roughness: 0.22 }), trim: MAT.chrome(), joint: lacquer('robot-joint-w', '#9aa3b2', { roughness: 0.4 }), accent: MAT.emissive('#3fd8ff', 1.6) }
        : { body: lacquer('robot-b', '#2a2e36', { roughness: 0.24 }), trim: MAT.chrome(), joint: lacquer('robot-joint-b', '#12141a', { roughness: 0.4 }), accent: MAT.emissive('#ff9a2e', 1.6) }),
    },
    ocean: {
      id: 'ocean', name: 'Coral Kingdom', era: 'Under the sea', year: 'Long ago, down deep', tint: '#0e5a6e',
      story: 'The court of a city that sank beneath the waves, carved in mother-of-pearl and gold: a sea king and a mermaid queen, glowing jellyfish, spiny seahorses, lighthouses that still shine, and pearls resting in open shells.',
      lore: {
        k: 'The sea king rises from the waves with a long beard, a tall crown and a golden trident.',
        q: 'The mermaid queen sits on a coral rock, her shining tail curled round to the front, holding a pearl.',
        b: 'A jellyfish that glows from inside. Its bell makes the bishop\'s mitre, slit and all.',
        n: 'A seahorse with a spiny crest, its tail curled into a spiral. Seahorses really do wear a little crown.',
        r: 'A lighthouse on a rock in the waves, with battlements round its gallery and a lantern that glows.',
        p: 'A pearl resting in an open scallop shell. Pawns are small, but they can grow.',
      },
      pieces: OCEAN,
      mats: (side) => (side === 'w'
        ? { body: MATS.pearl(), cloth: phys('scales-pearl', { color: '#c8ece4', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 900], sheen: 0.6, sheenColor: new THREE.Color('#ffd0e8') }), fin: MAT.gold('#f0c878'), rock: lacquer('coral-w', '#f2b6a6', { roughness: 0.45 }), hair: MAT.gold('#e8c27a'), trim: MAT.gold('#e8b85a'), accent: MAT.gem('#22c8c0'), eye: MAT.lacquer('#1c2230'),
          pearl: phys('pearl-bright', { color: '#fbf7f0', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 1, sheenColor: new THREE.Color('#ffe8f0'), sheenRoughness: 0.3, iridescence: 0.6, iridescenceIOR: 1.4 }),
          jelly: phys('jelly-w', { color: '#ffe4ee', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.7, iridescenceIOR: 1.4, emissive: '#ffb0d0', emissiveIntensity: 0.45, sheen: 1, sheenColor: new THREE.Color('#b8f0ff') }),
          glow: MAT.emissive('#ffe2a8', 1.6) }
        : { body: MATS.nacreDark(), cloth: MATS.scalesDark(), fin: MAT.gold('#e8b85a'), rock: lacquer('coral-b', '#6a2236', { roughness: 0.45 }), hair: phys('hair-nacre', { color: '#141c2a', roughness: 0.25, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.5 }), trim: MAT.gold('#e8b85a'), accent: MAT.gem('#22c8c0'), eye: MAT.lacquer('#f0f4f6'),
          pearl: phys('pearl-grey', { color: '#5a5e6a', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.8, iridescenceIOR: 1.5, sheen: 0.8, sheenColor: new THREE.Color('#c8b0ff'), sheenRoughness: 0.3 }),
          jelly: phys('jelly-b', { color: '#3a2a6a', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, iridescence: 0.9, iridescenceIOR: 1.5, emissive: '#7a50ff', emissiveIntensity: 0.55, sheen: 1, sheenColor: new THREE.Color('#ff9ae8') }),
          glow: MAT.emissive('#ffd890', 1.6) }),
    },
  };

  // The raw sets: stone and clay with no polish (rough, matt surfaces) and a little gold.
  const raw = (key, map, o) => phys('raw-' + key, Object.assign({ map, roughness: 0.92, metalness: 0, clearcoat: 0, envMapIntensity: 0.5 }, o || {}));
  Object.assign(SETS, {
    sarsen: {
      id: 'sarsen', name: 'Sarsen Stones', era: 'Stone Age Britain', year: 'c. 2500 BC', tint: '#6a6a5a',
      story: 'Carved the way the builders of Stonehenge shaped their giant stones: with round hammer stones, one chip at a time. Pale sarsen from the downs faces blue-grey bluestone from the hills of Wales, and no two pieces are quite the same.',
      lore: {
        k: 'A tall standing stone wearing a tiny trilithon, two uprights and a lintel, just like the great stones of Stonehenge.',
        q: 'A stone with a hole worn right through it. People once crawled through stones like this for luck.',
        b: 'A pointed stone with a notch cut in its side, the bishop\'s mark.',
        n: 'A horse chipped from a single block. Knights still jump in an L.',
        r: 'A round tower of stone, ringed with little standing stones.',
        p: 'A pebble on a rough base: small, but ready to march.',
      },
      pieces: SARSEN,
      mats: (side) => (side === 'w' ? { body: raw('sarsen', TEX.stone('#d6cfbc', '#9a9280', { scale: 3, cloud: 0.5, speckMix: 0.5 })) } : { body: raw('bluestone', TEX.stone('#4a5058', '#7a8490', { scale: 3, cloud: 0.5, speckMix: 0.5 })) }),
    },
    harappa: {
      id: 'harappa', name: 'Indus Terracotta', era: 'The Indus Valley', year: 'c. 2500 BC', tint: '#8a3a1e',
      story: 'Shaped by hand from river clay and fired in a kiln, like the toys and figures found at Mohenjo-daro and Harappa: one of the very first cities in the world. Pale buff clay faces clay dipped in red slip, both painted with bands of black.',
      lore: {
        k: 'A figure like the famous "priest-king" of Mohenjo-daro, with a headband and a round ornament on his brow.',
        q: 'A figure with a fan-shaped headdress and little cups at each side, like the clay figures found in Indus homes.',
        b: 'A square pillar like the stone seals the Indus traders stamped on their goods, with the bishop\'s slanted cut.',
        n: 'A sturdy clay horse, made by hand like an Indus toy.',
        r: 'A tower of mud brick, like the walls of the great granary.',
        p: 'A little clay jar with a round bead for a head.',
      },
      pieces: HARAPPA,
      mats: (side) => (side === 'w'
        ? { body: raw('buff', TEX.stone('#e2b88c', '#c8946a', { scale: 2, cloud: 0.6, speckMix: 0.25 }), { roughness: 0.85 }), trim: raw('slip-black', null, { color: '#2a140a', roughness: 0.7 }) }
        : { body: raw('redslip', TEX.stone('#9a4024', '#c8643c', { scale: 2, cloud: 0.6, speckMix: 0.25 }), { roughness: 0.6, clearcoat: 0.15, clearcoatRoughness: 0.6 }), trim: raw('slip-black', null, { color: '#2a140a', roughness: 0.7 }) }),
    },
    inca: {
      id: 'inca', name: 'Inca Stone', era: 'The Inca Empire', year: 'c. 1450', tint: '#4a4a52',
      story: 'Dressed by Inca masons at Machu Picchu, who fitted stones so closely that not even a blade of grass fits between them. Pale granite faces dark andesite from the mountain, with the sun, the moon and a tumi knife in hammered gold.',
      lore: {
        k: 'A stepped stone crowned with Inti, the golden sun. The Inca kings said they were his children.',
        q: 'Her crown is a crescent for Mama Killa, the moon, the sun\'s wife in Inca stories.',
        b: 'A tumi, the half-moon blade of a ceremonial knife, with a notch for the bishop\'s cut.',
        n: 'A horse cut in sharp, flat facets, the way the masons dressed their blocks.',
        r: 'A square stone tower with a trapezoid doorway, the Inca builders\' favourite shape.',
        p: 'A square stone with a round head, like a little milestone on the Inca road.',
      },
      pieces: INCA,
      mats: (side) => Object.assign(side === 'w' ? { body: raw('granite', TEX.stone('#cdc8bc', '#8a867c', { scale: 4, cloud: 0.35, speckMix: 0.6 })) } : { body: raw('andesite', TEX.stone('#4c4a48', '#86827a', { scale: 4, cloud: 0.35, speckMix: 0.6 })) }, { trim: MAT.gold('#d8a848') }),
    },
    norse: {
      id: 'norse', name: 'Norse Carved', era: 'The Viking Age', year: 'c. 900',
      tint: '#5a3a22',
      story: 'Whittled by the fire in a Norse longhouse, the way old sets were made through the long northern winters. Pale birch faces smoked bog oak, each piece turned in stacked rings and cut with a knife.',
      lore: {
        k: 'His crown is Mjolnir, the hammer of Thor, who kept the farms and the sailors safe.',
        q: 'A circlet of carved leaves for the lady of the hall, who held its keys.',
        b: 'Its cap carries Tiwaz, the arrow rune, cut with the tip of the knife.',
        n: 'A horse with a carved mane, like the beasts on the prows of the longships.',
        r: 'Four tiers, stacked like the roofs of a longhouse seen end on.',
        p: 'A little toadstool from the forest floor.',
      },
      pieces: NORSE,
      mats: (side) => (side === 'w'
        ? { body: raw('birch', TEX.wood('#e6d2ae', '#b89466', { lines: 26, contrast: 0.42, figure: 0.12, seed: 21 }), { roughness: 0.7 }), trim: raw('birch-dark', TEX.wood('#b8905e', '#7a5a34', { lines: 20, contrast: 0.4, seed: 22 }), { roughness: 0.75 }), accent: MAT.bronze() }
        : { body: raw('bogoak', TEX.wood('#4a3424', '#1e140c', { lines: 26, contrast: 0.5, figure: 0.12, seed: 23 }), { roughness: 0.65 }), trim: raw('bogoak-dark', TEX.wood('#2a1c12', '#0e0906', { lines: 20, contrast: 0.4, seed: 24 }), { roughness: 0.7 }), accent: MAT.bronze() }),
    },
    sounion: {
      id: 'sounion', name: 'Gods of Sounion', era: 'Classical Greece', year: 'c. 440 BC', tint: '#2e6a5a',
      story: 'Little statues for the temple of Poseidon on Cape Sounion, high above the Aegean. White is cut from Parian marble; black is cast in bronze that the sea air has turned green.',
      lore: {
        k: 'Poseidon, god of the sea, raising his trident over the waves.',
        q: 'A goddess in a long peplos, her veil falling to her shoulders.',
        b: 'A breaking wave, curling over in white foam.',
        n: 'A horse rearing up. Poseidon gave the first horse to Athens, the stories say.',
        r: 'A Doric column, like the sixteen still standing on the cape.',
        p: 'A hoplite with his crested helmet, round shield and spear.',
      },
      pieces: SOUNION,
      mats: (side) => (side === 'w'
        ? { body: MAT.stone(TEX.marble('#f4f0e8', '#c8beac', { scale: 2, strength: 0.3 }), { roughness: 0.4, clearcoat: 0.3 }), cloth: MAT.stone(TEX.marble('#ece6da', '#bcb2a0', { scale: 2, strength: 0.3 }), { roughness: 0.45, clearcoat: 0.2 }), trim: MAT.gold('#d8b060'), accent: MAT.gold('#d8b060'), eye: MAT.matte('#8a8478') }
        : { body: phys('verdigris', { map: TEX.stone('#3e7a66', '#8a6a3a', { scale: 5, cloud: 0.5, speckMix: 0.4 }), metalness: 0.55, roughness: 0.5, clearcoat: 0.2 }), cloth: phys('verdigris-2', { map: TEX.stone('#2e6a58', '#6a5a30', { scale: 5, cloud: 0.5, speckMix: 0.4 }), metalness: 0.5, roughness: 0.55 }), trim: MAT.bronze(), accent: MAT.bronze(), eye: MAT.matte('#1a2a24') }),
    },
    astro: {
      id: 'astro', name: 'Space Explorers', era: 'The space age', year: 'Tomorrow', tint: '#1a2a5a',
      story: 'Made for a game on the icy moon of Saturn: rockets, a space station and little astronauts, in gloss white ceramic against deep space blue, with chrome fins and portholes that glow.',
      lore: {
        k: 'The great rocket, ready for lift-off, with a shining star on its nose.',
        q: 'A rocket crowned with eight beacons that light the way home.',
        b: 'A nose cone with a porthole and a little antenna on the tip.',
        n: 'A horse ready for space, with a chrome helmet ring and a star on its brow.',
        r: 'A space station with a docking wheel round its middle.',
        p: 'A little astronaut in a round helmet. Wave hello!',
      },
      pieces: ASTRO,
      mats: (side) => (side === 'w'
        ? { body: phys('astro-white', { color: '#f4f6fa', roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }), trim: MAT.chrome(), accent: phys('astro-glow-c', { color: '#7ae8ff', roughness: 0.1, emissive: '#3ad8ff', emissiveIntensity: 0.9 }), visor: phys('astro-visor', { color: '#d8a040', metalness: 1, roughness: 0.08, envMapIntensity: 1.5 }), fin: phys('astro-fin-r', { color: '#d8343a', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }) }
        : { body: phys('astro-navy', { color: '#16204a', roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.4, sheenColor: new THREE.Color('#5a7aff') }), trim: MAT.chrome(), accent: phys('astro-glow-o', { color: '#ffb060', roughness: 0.1, emissive: '#ff8a2a', emissiveIntensity: 0.9 }), visor: phys('astro-visor', { color: '#d8a040', metalness: 1, roughness: 0.08, envMapIntensity: 1.5 }), fin: phys('astro-fin-o', { color: '#f08a2a', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.05 }) }),
    },
    falcon: {
      id: 'falcon', name: 'Falcon & Pearl', era: 'Dubai today', year: 'Today', tint: '#3a3020',
      story: 'For the table at the very top of the Burj Khalifa. White is pearl and black is black pearl, set in gold, like the pearls the divers of the Gulf once brought up from the sea.',
      lore: {
        k: 'A tower that steps in and in, up to a slender spire, like the Burj itself.',
        q: 'A gold tiara with a pearl on every point.',
        b: 'A mitre topped with a single round pearl.',
        n: 'An Arabian horse with a flowing mane, in a gold bridle.',
        r: 'A three-winged tower, like the Burj seen from above.',
        p: 'A pearl resting in a little gold cup.',
      },
      pieces: FALCON,
      mats: (side) => (side === 'w'
        ? { body: MATS.pearl(), trim: MAT.gold('#e2b860'), pearl: phys('pearl-bright', { color: '#fbf7f0', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, sheen: 1, sheenColor: new THREE.Color('#ffe8f0'), sheenRoughness: 0.3, iridescence: 0.6, iridescenceIOR: 1.4 }) }
        : { body: phys('black-pearl', { color: '#161618', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 0.8, iridescenceIOR: 1.6, iridescenceThicknessRange: [300, 800], sheen: 0.4, sheenColor: new THREE.Color('#d8c0ff'), sheenRoughness: 0.4 }), trim: MAT.gold('#e2b860'), pearl: phys('pearl-grey', { color: '#5a5e6a', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08, iridescence: 0.8, iridescenceIOR: 1.5, sheen: 0.8, sheenColor: new THREE.Color('#c8b0ff'), sheenRoughness: 0.3 }) }),
    },
  });

  // ------------------------------------------------------------------ collection sets
  // Sets earned with levels, achievements, the season track and Premium. Each has its own
  // shapes (no two sets share a piece) and a finish for each side.
  const lacquer = (key, color, o) => phys('lq-' + key, Object.assign({ color, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.05 }, o || {}));
  // Tempered chocolate: a soft gloss with a warm sheen at grazing angles.
  const choc = (key, color, sheen) => phys('choc-' + key, { color, roughness: 0.3, clearcoat: 0.85, clearcoatRoughness: 0.14, sheen: 0.6, sheenColor: new THREE.Color(sheen || '#ffcf9e'), sheenRoughness: 0.45 });
  const COLOURWAYS = {
    'ruby-pearl': { tint: '#6a0c22', name: 'Ruby & Pearl', pieces: NOUVEAU, lore: { k: "A lily cup holding a golden bud, with tendrils winding up his stem and a scrolled cross.", q: "An open lily with six petals and a pearl on a golden stalk.", b: "A closed tulip bud with the bishop's slit and a curling leaf.", n: "A slender horse with a long neck and a golden mane.", r: "A tower of tall pointed arches, like the ironwork of the Eiffel Tower.", p: "A round head cupped in three golden leaves." }, era: 'Belle Epoque Paris', year: '1889',
      story: 'Made for the World\'s Fair in Paris, the year the Eiffel Tower opened. Pearly white faces deep ruby lacquer, and every crown and mane is laid in gold leaf.',
      w: () => ({ body: MATS.pearl(), trim: MAT.goldLeaf() }), b: () => ({ body: lacquer('ruby', '#5e0a1e', { sheen: 0.3, sheenColor: new THREE.Color('#ff8aa4') }), trim: MAT.goldLeaf() }) },
    marble: { tint: '#45454c', name: 'Carrara & Nero', pieces: MODERN, lore: { k: "A tall clean cone under a plain cross: the tallest piece.", q: "A ball resting on a flat disc ringed with nine little beads.", b: "A ball with a deep slanted cut: the bishop's slit.", n: "A smooth horse head with no mane at all, like a modern sculpture.", r: "A plain round tower with four square battlements.", p: "A small ball on a cone." }, era: 'Tuscany and Spain', year: 'Today',
      story: 'White marble from Carrara in Tuscany, the stone Michelangelo used for his statue of David, faces black Nero Marquina from northern Spain.',
      w: () => ({ body: MATS.carrara() }), b: () => ({ body: MATS.nero() }) },
    'cocoa-gilt': { tint: '#4a2410', name: 'Cocoa & Gilt', pieces: PRALINE, lore: { k: "Two truffles and a piped rosette, crowned with a gilt cross.", q: "A crown of piped chocolate with a gilt cherry on top.", b: "A swirl of piped chocolate with the bishop's slit.", n: "A horse on a pleated paper cup, ready for the shop window.", r: "A layered chocolate cake with eight chocolate squares on top.", p: "A truffle in a paper cup, drizzled with gold." }, era: 'A chocolatier\'s salon', year: 'c. 1900',
      story: 'A chocolatier kept this set in the shop window: bright gilt against dark cocoa lacquer, polished until it looked good enough to eat. (Please do not try.)',
      w: () => ({ body: MAT.gold('#e2b45c'), trim: lacquer('cocoa-trim', '#2a140c') }), b: () => ({ body: lacquer('cocoa', '#2a140c', { sheen: 0.4, sheenColor: new THREE.Color('#d89060') }), trim: MAT.goldLeaf() }) },
    'jade-onyx': { tint: '#1e5a46', name: 'Jade & Onyx', pieces: MONOLITH, lore: { k: "A square obelisk with a pointed cap and an eight-pointed cross.", q: "A square tower opening into four rounded points round a stone ball.", b: "A square pillar under a rounded mitre with the bishop's slit.", n: "A horse with a bowed head on a square stone.", r: "A square tower with eight square battlements.", p: "A stone ball on a little square pillar." }, era: 'Stones of legend', year: 'Ancient and modern',
      story: 'Pale green jade, treasured in China for thousands of years, against polished black onyx. Earned by beating Shelly the Tortoise.',
      w: () => ({ body: MATS.jade() }), b: () => ({ body: MATS.onyx() }) },
    'gold-silver': { tint: '#5a4418', name: 'Gold & Platinum', pieces: TROPHY, lore: { k: "A lidded trophy cup with two handles and a ringed cross.", q: "An open trophy cup whose rim rises into eight points.", b: "A small cup with a mitre lid and the bishop's slit.", n: "A proud horse on a trophy stand.", r: "A loving cup with handles and six battlements.", p: "A ball on a stem, like the top of a trophy." }, era: 'The trophy cabinet', year: 'Champions only',
      story: 'Made for a champion\'s trophy cabinet: polished gold against cool platinum, each trimmed with the other.',
      w: () => ({ body: MATS.nickel(), trim: MAT.gold('#f0c35a') }), b: () => ({ body: MAT.gold('#e0b050'), trim: MATS.nickel() }) },
    'ruby-chocolate': { tint: '#8a3a4c', name: 'Ruby Chocolate', pieces: BUBBLE, lore: { k: "A stack of chocolate bubbles under a rounded cross.", q: "Bubbles crowned with a ring of seven little chocolate drops.", b: "A big round mitre with a wide bishop's slit.", n: "A round, cuddly horse with a short nose.", r: "A puffy tower with five round battlements.", p: "One big chocolate bubble." }, era: 'The newest chocolate', year: '2017',
      story: 'Ruby chocolate is real: a pink chocolate made from ruby cocoa beans, first shown to the world in 2017. Here it faces the darkest bittersweet.',
      w: () => ({ body: choc('ruby', '#e7a3ae', '#ffd6de') }), b: () => ({ body: choc('dark', '#2a120a') }) },
    'milk-dark': { tint: '#5a3418', name: 'Milk & Dark', pieces: POD, lore: { k: "A ribbed cocoa pod in a cup of leaves, with a cross of four leaves.", q: "A cocoa pod opening into a crown of leaves round a cluster of beans.", b: "A pointed cocoa pod with the bishop's slit.", n: "A horse rising out of a ring of cocoa leaves.", r: "A cocoa tree trunk with seven battlements.", p: "A cocoa bean among four leaves." }, era: 'Cocoa Harvest', year: 'Season 1',
      story: 'Milk chocolate against dark, as glossy as a freshly tempered bar. The top prize of the Cocoa Harvest season track.',
      w: () => ({ body: choc('milk', '#b9784a') }), b: () => ({ body: choc('dark', '#2a120a') }) },
    'caramel-cream': { tint: '#7a4a1c', name: 'Caramel & Cream', pieces: BARLEY, lore: { k: "A barley-sugar twist under a swirled dome and a four-pointed star cross.", q: "A coronet whose points spiral round like pulled caramel.", b: "A smooth, pointed mitre on a twisted stem.", n: "A horse with a flowing golden mane on a swirled foot.", r: "A rope-twisted tower with six battlements.", p: "A round head on a short barley twist." }, era: 'Cocoa Harvest', year: 'Season 1',
      story: 'Golden caramel and fresh cream, with crowns and manes in gold leaf. A Season Pass reward from the Cocoa Harvest.',
      w: () => ({ body: lacquer('cream', '#f4ead6', { sheen: 0.3, sheenColor: new THREE.Color('#fff6e0') }), trim: MAT.goldLeaf() }), b: () => ({ body: choc('caramel', '#a9601e', '#ffd28a'), trim: MAT.goldLeaf() }) },
  };
  for (const [id, c] of Object.entries(COLOURWAYS)) {
    SETS[id] = { id, name: c.name, era: c.era, year: c.year, story: c.story, tint: c.tint, lore: c.lore, pieces: c.pieces, mats: (side) => (side === 'w' ? c.w() : c.b()) };
  }

  // ------------------------------------------------------------------ building and caching
  // Two levels of detail. 'show' is the full sculpt for close-ups: menu art, the collection
  // and the museum. 'play' is what stands on the table, where a piece is a few hundred
  // pixels tall at most and all 32 are drawn for the view, the shadows and the
  // reflection: about a sixth of the triangles, and quicker to build when a game loads.
  const LOD = {
    show: { around: 1, along: 1, tube: 1, cell: 0.0052, mane: 0.0042 },
    play: { around: 0.4, along: 0.34, tube: 0.45, cell: 0.012, mane: 0.0095 },
  };
  const geomCache = new Map();
  function geometry(setId, type, detail) {
    const set = SETS[setId] || SETS.regency;
    const shape = set.shape || set.id;
    const lod = LOD[detail] ? detail : 'show';
    const key = shape + type + lod;
    if (!geomCache.has(key)) {
      const t0 = performance.now();
      const L = LOD[lod], keep = { around: DETAIL.around, along: DETAIL.along, tube: DETAIL.tube, cell: Q.cell, mane: Q.mane };
      Object.assign(DETAIL, { around: L.around, along: L.along, tube: L.tube }); Q.cell = L.cell; Q.mane = L.mane;
      try { geomCache.set(key, SETS[shape].pieces[type]({ Q }).geoms()); }
      finally { Object.assign(DETAIL, { around: keep.around, along: keep.along, tube: keep.tube }); Q.cell = keep.cell; Q.mane = keep.mane; }
      if (typeof window !== 'undefined' && window.__PIECE_TIMES) window.__PIECE_TIMES.push([shape, type, lod, Math.round(performance.now() - t0)]);
    }
    return geomCache.get(key);
  }
  // A ready-to-place group for one piece: meshes share geometry and materials.
  function make(setId, type, side, detail) {
    const set = SETS[setId] || SETS.regency;
    const g = geometry(set.id, type, detail);
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
  const HEIGHT = { k: 1.62, q: 1.43, b: 1.24, n: 1.06, r: 0.97, p: 0.72 };
  return { SETS, make, geometry, HEIGHT, list: () => Object.keys(SETS).map((k) => SETS[k]) };
}
if (typeof module !== 'undefined') module.exports = ChacklatePieces;
