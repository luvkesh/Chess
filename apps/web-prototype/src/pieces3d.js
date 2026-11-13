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
    if (style === 'pattee') return crossPattee(h, depth, { flare: 0.62 });
    if (style === 'jewelled') {
      // flared arms round a round boss where a gem sits, the foot a little longer
      const w = t * 0.55, parts = [];
      for (let i = 0; i < 4; i++) { const L = i === 2 ? a * 1.15 : a * 0.85; const g = extrude([[-w, 0], [w, 0], [w * 1.9, L], [-w * 1.9, L]], depth, depth * 0.3, { bevelSegments: 2 }); g.rotateZ((i * Math.PI) / 2); parts.push(g); }
      parts.push(new THREE.CylinderGeometry(t * 1.3, t * 1.3, depth * 1.4, 20).rotateX(Math.PI / 2));
      return merge(parts);
    }
    if (style === 'anchor') {
      // a mariner's cross: the foot ends in the curved arms of an anchor, a ring at the top
      const w = t * 0.5, parts = [bar(0, -a * 1.1, 0, a * 0.7, w * 2), bar(-a * 0.6, a * 0.25, a * 0.6, a * 0.25, w * 2)];
      const arc = new THREE.TorusGeometry(a * 0.55, w, 8, 24, Math.PI); arc.rotateZ(Math.PI); arc.translate(0, -a * 0.6, 0); parts.push(arc);
      for (const s of [-1, 1]) { const tip = new THREE.ConeGeometry(w * 2, w * 4, 4); tip.rotateZ(s * 0.5); tip.translate(s * a * 0.58, -a * 0.52, 0); parts.push(tip); }
      const top = new THREE.TorusGeometry(a * 0.18, w * 0.8, 8, 20); top.translate(0, a * 0.88, 0); parts.push(top);
      return merge(parts);
    }
    if (style === 'pommee') {
      // equal arms, each ending in a ball
      const w = t * 0.7, parts = [bar(0, -a * 0.95, 0, a * 0.8, w * 2), bar(-a * 0.8, 0, a * 0.8, 0, w * 2)];
      for (const [x, y] of [[0, a * 0.8], [a * 0.8, 0], [-a * 0.8, 0], [0, -a * 0.95]]) parts.push(sphere(t * 1.25, x, y, 0, 14));
      return merge(parts);
    }
    if (style === 'cloud') {
      // arms that end in heart-shaped cloud collars (ruyi), as on a jade sceptre
      const w = t * 0.55, parts = [bar(0, -a * 1.1, 0, a * 0.55, w * 2), bar(-a * 0.55, 0, a * 0.55, 0, w * 2)];
      [[0, a * 0.5, 0], [a * 0.5, 0, -Math.PI / 2], [-a * 0.5, 0, Math.PI / 2]].forEach(([x, y, rz]) => { const r = ruyi(a * 0.62, a * 0.52, depth); r.rotateZ(rz); r.translate(x, y, 0); parts.push(r); });
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
      const body = new Sculpt(0.016, 1.45);
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
      nemes(P, c, 0.064 * s, { fine: 1.05 });   // sixteen of them: coarser than the court's
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
      P.add('pearl', sphere(0.105, 0, dy + 0.15, 0, 24));
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

  // ------------------------------------------------------------------ two-army sets (figures)
  // Sets where the two sides are different armies, each with its own figures: white plays the
  // `pieces` module and black its `piecesB` module (see geometry()). Every figure still carries
  // its piece's cue: the king is the tallest and crowned, the queen wears a coronet, the bishop
  // holds a staff or wears a pointed hood, the knight is a beast or a craft, the rook a tower
  // and the pawn the smallest.
  // A figure's plinth: a lathe in the 'base' slot, a metal ring and, for some sets, a lit ring.
  function armyPlinth(P, R, h, o) {
    o = o || {};
    const p = profile(0, 0).line(R - 0.012, 0).arc(R, 0.014, 0.3);
    if (o.rough) p.line(R + 0.004, h * 0.45).line(R - 0.01, h * 0.62).line(R - 0.004, h - 0.02).arc(R - 0.03, h, 0.35);
    else if (o.hex) p.line(R, h - 0.02).arc(R - 0.02, h, 0.3);
    else p.line(R, 0.03).arc(R - 0.016, 0.05, 0.35).line(R - 0.028, h - 0.016).arc(R - 0.04, h, 0.35);
    p.line(0, h);
    P.lathe('base', p, o.hex ? { segs: 6 } : (o.rough ? { mod: MOD.facets(11, 0.01, h, 0.4) } : undefined));
    P.add('trim', ring(R - (o.hex ? 0.03 : 0.004), o.hex ? h * 0.55 : 0.032, 0.008, o.hex ? { seg: 6 } : undefined));
    if (o.glow) P.add('glow', ring(R - 0.05, h + 0.001, 0.006, o.hex ? { seg: 6 } : undefined));
    if (o.studs) P.add('accent', around(o.studs, R - 0.003, h * 0.55, () => cabochon(0.014, 0.6), { phase: Math.PI / o.studs }));
    return h;
  }
  const hexBase = (P, R, h) => armyPlinth(P, R, h, { hex: true, glow: true });
  // A standing figure facing +z with feet at y0, about 0.9 * s tall to the crown of the head.
  // o.kind: 'human', 'orc' (broad, heavy brow, tusks), 'elf' (slender, long ears) or 'chibi'
  // (a big round head on a short body, for the storybook sets). o.dress: 'robe', 'gown' or
  // 'legs' (a tunic over two legs and boots). o.hands: the two hands in figure units.
  function person(P, y0, s, o) {
    o = o || {};
    const kind = o.kind || 'human', chibi = kind === 'chibi', B = o.bulk || (kind === 'orc' ? 1.3 : kind === 'elf' ? 0.88 : 1);
    const A = at([0, y0, 0], s), coarse = o.coarse || (chibi ? 1.4 : s > 1.1 ? 1.15 : 1);
    const skin = new Sculpt(0.016, coarse), cloth = new Sculpt(0.02, 1.25 * coarse);
    cloth.floor = y0 - 0.004; skin.floor = y0 - 0.004;
    const hy = chibi ? 0.6 : 0.8, hr = (chibi ? 0.15 : kind === 'orc' ? 0.068 : 0.06) * s;
    const shY = chibi ? 0.4 : 0.66, shX = (chibi ? 0.085 : 0.082) * B, waist = chibi ? 0.24 : 0.42;
    const chestY = chibi ? 0.33 : 0.56;
    if (o.dress === 'gown') {
      const r0 = (chibi ? 0.17 : 0.16) * s * (o.flare || 1);
      P.lathe(o.gownSlot || 'cloth', profile(0, y0).line(r0, y0).curve([[r0 * 0.98, y0 + waist * 0.15 * s], [r0 * 0.8, y0 + waist * 0.5 * s], [r0 * 0.5, y0 + waist * 0.85 * s], [0.055 * s, y0 + waist * 1.05 * s]]).line(0, y0 + waist * 1.05 * s), { mod: o.frills ? MOD.lobes(o.frills, 0.1, y0, y0 + waist * 0.5 * s, { shape: 0.7, end: 0.02 }) : undefined });
    } else if (o.dress === 'robe') {
      cloth.cone(A(0, 0, 0), A(0, waist + 0.04, 0), 0.13 * B * s, 0.075 * B * s, 0.03);
    } else {
      const legR = (chibi ? 0.034 : 0.028) * B * s, hipY = chibi ? 0.17 : 0.34, sp = (chibi ? 0.045 : 0.042) * B;
      cloth.pair((x) => {
        cloth.chain([[x * sp * s, y0 + hipY * s, 0, legR * 1.2], [x * (sp + 0.006) * s, y0 + hipY * 0.5 * s, 0.01 * s, legR], [x * (sp + 0.01) * s, y0 + 0.05 * s, 0, legR * 0.9]], 0.014);
        cloth.ell(A(x * (sp + 0.012), 0.03, 0.022), [legR * 1.15, 0.032 * s, legR * 1.7], 0.012);      // boots
      });
      cloth.cone(A(0, hipY - 0.06, 0), A(0, waist + 0.05, 0), (chibi ? 0.1 : 0.088) * B * s, 0.07 * B * s, 0.025);   // the tunic's skirt
    }
    cloth.ell(A(0, chestY, 0.006), [(chibi ? 0.085 : 0.078) * B * s, (chibi ? 0.1 : 0.12) * s, (chibi ? 0.075 : 0.06) * B * s], 0.035);   // chest
    if (o.belly) cloth.ell(A(0, waist + 0.06, 0.03), [0.085 * B * s, 0.08 * s, 0.07 * B * s], 0.04);
    cloth.pair((x) => cloth.ell(A(x * shX, shY, -0.004), [0.042 * B * s, 0.038 * s, 0.042 * B * s], 0.03));
    if (o.cape) { const cape = new Sculpt(0.02, 1.3 * coarse); cape.floor = y0 - 0.004; cape.cone(A(0, shY + 0.02, -0.05 * B), A(0, 0.02, -0.08 * B), 0.088 * B * s, 0.145 * B * s, 0.03); cape.ell(A(0, shY + 0.005, -0.02 * B), [0.11 * B * s, 0.035 * s, 0.06 * B * s], 0.03); cape.box(A(0, 0.4, 0.13 * B), [0.3 * s, 0.5 * s, 0.11 * B * s], 0, 0.02, true); P.add(o.capeSlot || 'cloth2', cape.mesh()); }
    // neck and head
    const H = A(0, hy, chibi ? 0.01 : 0.008);
    skin.cone(A(0, shY, 0), [H[0], H[1] - hr * 0.7, H[2] - hr * 0.1], 0.03 * B * s, 0.027 * B * s, 0.01);
    const hd = chibi ? { c: H, r: hr, eyes: [-1, 1].map((x) => [H[0] + x * hr * 0.36, H[1] - hr * 0.02, H[2] + hr * 0.86]) } : head(skin, H, hr, { beard: o.beard, moustache: o.moustache });
    if (chibi) {
      skin.ell(H, [hr, hr * 0.94, hr * 0.94], 0.01);
      skin.ell([H[0], H[1] - hr * 0.22, H[2] + hr * 0.9], [hr * 0.17, hr * 0.13, hr * 0.13], 0.01);     // a button nose
      skin.pair((x) => skin.ell([H[0] + x * hr * 0.55, H[1] - hr * 0.28, H[2] + hr * 0.72], [hr * 0.2, hr * 0.14, hr * 0.1], 0.02));   // round cheeks
      if (o.beard) { const bd = new Sculpt(0.02); bd.ell([H[0], H[1] - hr * 0.62, H[2] + hr * 0.5], [hr * 0.75, hr * 0.5 * (1 + o.beard), hr * 0.5], 0.04); bd.pair((x) => bd.ell([H[0] + x * hr * 0.3, H[1] - hr * 0.3, H[2] + hr * 0.92], [hr * 0.3, hr * 0.12, hr * 0.12], 0.02)); P.add(o.beardSlot || 'hair', bd.mesh()); }
    }
    if (kind === 'orc') {
      skin.ell([H[0], H[1] + hr * 0.32, H[2] + hr * 0.72], [hr * 0.78, hr * 0.2, hr * 0.26], 0.02);      // a heavy brow
      skin.ell([H[0], H[1] - hr * 0.52, H[2] + hr * 0.3], [hr * 0.8, hr * 0.5, hr * 0.66], 0.03);        // a big jaw
      skin.pair((x) => skin.cone([H[0] + x * hr * 0.85, H[1], H[2] - hr * 0.1], [H[0] + x * hr * 1.45, H[1] + hr * 0.25, H[2] - hr * 0.25], hr * 0.2, hr * 0.04, 0.01));   // ears
      P.add('tusk', merge([-1, 1].map((x) => new THREE.ConeGeometry(hr * 0.11, hr * 0.42, 8).rotateX(-0.25).translate(H[0] + x * hr * 0.36, H[1] - hr * 0.42, H[2] + hr * 0.86))));
    }
    if (kind === 'elf') skin.pair((x) => skin.cone([H[0] + x * hr * 0.82, H[1] - hr * 0.05, H[2] - hr * 0.05], [H[0] + x * hr * 1.75, H[1] + hr * 0.75, H[2] - hr * 0.55], hr * 0.18, hr * 0.03, 0.012));
    // arms to the hands
    const hands = (o.hands || [[-0.1, 0.42, 0.06], [0.1, 0.42, 0.06]]).map((h) => A(h[0] * B, h[1], h[2]));
    [-1, 1].forEach((x, i) => {
      const sh = A(x * (shX + 0.012 * B), shY - 0.01, 0), ha = hands[i];
      const el = [mix(sh[0], ha[0], 0.5) + x * 0.03 * B * s, mix(sh[1], ha[1], 0.5) - 0.02 * s, mix(sh[2], ha[2], 0.4) - 0.01 * s];
      arm(cloth, skin, sh, el, ha, (chibi ? 0.03 : 0.022) * B * s);
    });
    // hair: long down the back, a bun, a braid or a topknot
    if (o.hair) {
      const hs = new Sculpt(0.012, coarse);
      hs.ell([H[0], H[1] + hr * 0.18, H[2] - hr * 0.12], [hr * 1.04, hr * 0.92, hr * 1.02], 0.012);
      hs.ell([H[0], H[1] + hr * 0.3, H[2] + hr * 0.5], [hr * 0.9, hr * 0.5, hr * 0.5], 0.012, true);   // the face stays clear
      if (o.hair === 'long') hs.chain([[H[0], H[1], H[2] - hr * 0.7, hr * 0.75], [H[0], H[1] - hr * 1.6, H[2] - hr * 1.05, hr * 0.72], [H[0], H[1] - hr * 3.2, H[2] - hr * 1.2, hr * 0.5]], 0.02, 4);
      if (o.hair === 'bun') hs.ell([H[0], H[1] + hr * 0.7, H[2] - hr * 0.7], [hr * 0.45, hr * 0.42, hr * 0.42], 0.01);
      if (o.hair === 'braid') hs.chain([[H[0], H[1] + hr * 0.6, H[2] - hr * 0.6, hr * 0.3], [H[0], H[1] - hr * 0.6, H[2] - hr * 1.2, hr * 0.28], [H[0], H[1] - hr * 2.6, H[2] - hr * 1.1, hr * 0.2]], 0.01, 4);
      if (o.hair === 'curls') { for (let i = 0; i < 7; i++) { const a = mix(-1.3, 1.3, i / 6); hs.ell([H[0] + Math.sin(a) * hr * 0.95, H[1] - hr * 0.7, H[2] - Math.cos(a) * hr * 0.6], [hr * 0.3, hr * 0.45, hr * 0.3], 0.02); } }
      P.add('hair', hs.mesh());
    }
    if (o.hood) {
      const hood = new Sculpt(0.014, coarse);
      hood.ell([H[0], H[1] + hr * 0.1, H[2] - hr * 0.15], [hr * 1.28, hr * 1.3, hr * 1.25], 0.014);
      hood.cone([H[0], H[1] + hr * 0.9, H[2] - hr * 0.4], [H[0], H[1] + hr * (o.hood === 'tall' ? 2.6 : 1.5), H[2] - hr * 1.1], hr * 0.6, hr * 0.08, 0.03);
      hood.cone([H[0], H[1] - hr * 0.6, H[2] - hr * 0.6], A(0, shY - 0.02, -0.02), hr * 1.1, 0.07 * B * s, 0.03);
      hood.ell([H[0], H[1] - hr * 0.05, H[2] + hr * 1.0], [hr * 0.8, hr * 0.95, hr * 0.9], 0.014, true);
      P.add(o.hoodSlot || 'cloth2', hood.mesh());
    }
    P.add(o.clothSlot || 'cloth', cloth.mesh()); P.add('skin', skin.mesh());
    if (!o.noEyes) P.add(o.eyeSlot || 'eye', merge(hd.eyes.map((e) => sphere(hr * (chibi ? 0.16 : 0.15), 0, 0, 0, 10).scale(1, chibi ? 1.35 : 1, 0.7).translate(e[0], e[1], e[2]))));
    return { A, s, B, H, hr, hands, top: H[1] + hr, shY: A(0, shY, 0)[1], cf: cloth.field() };
  }
  // props, built round the origin standing up +y
  const rod = (x, y0, y1, z, r) => new THREE.CylinderGeometry(r, r, y1 - y0, 8).translate(x, (y0 + y1) / 2, z);
  // a crystal point: a long octahedron
  const shard = (r, h) => new THREE.OctahedronGeometry(1, 0).scale(r, h / 2, r);
  // an axe: a haft and a curved blade on one side
  function axe(len, w) {
    const blade = extrude([[0, 0], [w, -w * 0.55], [w * 1.15, 0], [w, w * 0.55]], 0.012, 0.004, { bevelSegments: 1 }); blade.rotateY(Math.PI / 2).translate(0, len * 0.86, 0);
    return { haft: rod(0, 0, len, 0, 0.008), blade };
  }
  // a kite shield facing +z, point down
  function kite(w, h, d) {
    const face = extrude([[0, -h * 0.5], [w * 0.5, -h * 0.05], [w * 0.5, h * 0.4], [w * 0.36, h * 0.5], [-w * 0.36, h * 0.5], [-w * 0.5, h * 0.4], [-w * 0.5, -h * 0.05]], d, d * 0.4, { bevelSegments: 2 });
    return face;
  }
  // a flag hanging from a crossbar, its foot cut into a swallowtail
  function armyBanner(w, h) {
    return extrude([[-w / 2, 0], [w / 2, 0], [w / 2, -h], [0, -h * 0.82], [-w / 2, -h]], 0.006, 0.002, { bevelSegments: 1 });
  }
  // a leaf, the elves' emblem
  const leafBadge = (s) => extrude(K.mirrorOutline([[0, s], [s * 0.42, s * 0.5], [s * 0.38, -s * 0.1], [0, -s * 0.55]]), s * 0.12, s * 0.05, { bevelSegments: 1 });
  // a boar's tusk crossed with a tusk, the orcs' emblem: two crescents back to back
  function tuskBadge(s) {
    const a = crescent(s * 0.5, s * 0.12); a.rotateZ(0.5).translate(-s * 0.14, 0, 0);
    const b = crescent(s * 0.5, s * 0.12); b.rotateZ(-0.5).translate(s * 0.14, 0, 0);
    return merge([a, b]);
  }

  // ------------------------------------------------------------------ Orcs & Elves
  // White: the elves of the silver forest, in white and gold with blue crystals. Black: the orc
  // clans of the burning hills, green-skinned, in red leather and iron, with wolves for knights.
  const ELVES = {
    k() {
      const P = new Piece(), y0 = armyPlinth(P, 0.34, 0.11, { studs: 6 });
      const f = person(P, y0, 1.22, { kind: 'elf', dress: 'legs', cape: true, hair: 'long', clothSlot: 'cloth', hands: [[-0.035, 0.44, 0.09], [0.035, 0.44, 0.09]] });
      // pauldrons and a breastplate in gold over the blue
      P.add('trim', merge([-1, 1].map((x) => new THREE.SphereGeometry(0.05 * f.s, 18, 10, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.8, 1).translate(...f.A(x * 0.09 * f.B, 0.665, -0.004)))));
      P.add('trim', ring(0.07 * f.s, f.A(0, 0.44, 0)[1], 0.008));
      // a sword point-down before him, both hands on the hilt
      const sw = sword(0.36, 0.024); for (const g of [sw.blade, sw.hilt]) { g.rotateX(Math.PI); g.translate(...f.A(0, 0.46, 0.1)); }
      P.add('steel', sw.blade); P.add('trim', sw.hilt);
      // a tall crown of leaves rising to a crystal
      const cy = f.top - f.hr * 0.45;
      P.add('trim', around(7, f.hr * 0.95, cy, () => leaf(0.03, 0.09, 0.006), { tilt: -0.12 }));
      P.add('trim', ring(f.hr * 0.96, cy + 0.01, 0.007));
      P.add('crystal', shard(0.022, 0.11).translate(0, cy + 0.12, f.H[2] + f.hr * 0.3));
      P.add('crystal', merge([-1, 1].map((x) => shard(0.012, 0.06).translate(x * f.hr * 0.6, cy + 0.08, f.H[2] + f.hr * 0.4))));
      P.add('accent', leafBadge(0.05).translate(...f.A(0, 0.56, 0.072)));
      return turnPiece(P, 0.35);
    },
    q() {
      const P = new Piece(), y0 = armyPlinth(P, 0.33, 0.1, { studs: 6 });
      const f = person(P, y0, 1.12, { kind: 'elf', dress: 'gown', hair: 'long', flare: 1.05, cape: true, hands: [[-0.13, 0.5, 0.05], [0.06, 0.4, 0.08]] });
      P.add('trim', ring(0.06 * f.s, f.A(0, 0.43, 0)[1], 0.007));
      P.add('trim', merge([0.06, 0.2].map((y) => ring(mix(0.16, 0.11, y / 0.3) * f.s, f.A(0, y, 0)[1], 0.006))));
      // a slender tiara of leaves and a crystal at her brow
      const cy = f.top - f.hr * 0.5;
      P.add('trim', around(9, f.hr * 0.98, cy, () => leaf(0.016, 0.06, 0.005), { tilt: -0.2 }));
      P.add('crystal', shard(0.014, 0.05).translate(0, cy + 0.035, f.H[2] + f.hr * 0.95));
      // a flower held up in her left hand
      const h = f.hands[0];
      P.add('accent', around(5, 0.008, h[1] + 0.03, () => petal(0.018, 0.04, 0.005), { tilt: 0.6 }).translate(h[0], 0, h[2]));
      P.add('crystal', sphere(0.01, h[0], h[1] + 0.035, h[2], 8));
      return turnPiece(P, 0.35);
    },
    b() {
      const P = new Piece(), y0 = armyPlinth(P, 0.31, 0.1, { studs: 6 });
      const f = person(P, y0, 1.02, { kind: 'elf', dress: 'robe', hood: 'tall', hands: [[-0.1, 0.5, 0.07], [0.08, 0.4, 0.07]] });
      // a staff topped with a blue crystal in golden prongs
      const h = f.hands[0];
      P.add('trim', rod(h[0], y0, h[1] + 0.34, h[2], 0.008));
      P.add('trim', around(3, 0.018, h[1] + 0.33, () => ray(0.012, 0.06, 0.004), { tilt: -0.3 }).translate(h[0], 0, h[2]));
      P.add('crystal', shard(0.022, 0.1).translate(h[0], h[1] + 0.4, h[2]));
      P.add('trim', ring(0.074 * f.s, f.A(0, 0.4, 0)[1], 0.007));
      P.add('accent', leafBadge(0.04).translate(...f.A(0, 0.3, 0.1)));
      return turnPiece(P, 0.35);
    },
    n() {
      // a white stag with great golden antlers and a blue caparison
      const P = new Piece(), y0 = armyPlinth(P, 0.322, 0.1, { studs: 6 });
      const st = new Sculpt(0.02, 1.2);
      st.floor = y0 - 0.004;
      st.ell([0, y0 + 0.36, -0.01], [0.062, 0.07, 0.13], 0.03);
      st.ell([0, y0 + 0.37, 0.08], [0.06, 0.075, 0.06], 0.035);
      st.ell([0, y0 + 0.38, -0.1], [0.064, 0.07, 0.065], 0.035);
      st.pair((x) => {
        leg(st, [x * 0.036, y0 + 0.33, 0.09], [x * 0.04, y0 + 0.17, 0.1], [x * 0.04, y0, 0.1], 0.026, 0.015, 0.017);
        leg(st, [x * 0.036, y0 + 0.33, -0.11], [x * 0.04, y0 + 0.17, -0.15], [x * 0.04, y0, -0.12], 0.03, 0.015, 0.017);
      });
      st.chain([[0, y0 + 0.4, 0.1, 0.042], [0, y0 + 0.5, 0.14, 0.034], [0, y0 + 0.6, 0.16, 0.028]], 0.02, 4);
      st.cone([0, y0 + 0.63, 0.16], [0, y0 + 0.6, 0.24], 0.034, 0.016, 0.02);       // head and slim muzzle
      st.pair((x) => st.cone([x * 0.02, y0 + 0.65, 0.15], [x * 0.065, y0 + 0.68, 0.13], 0.012, 0.004, 0.006));   // ears
      st.ell([0, y0 + 0.4, -0.16], [0.018, 0.024, 0.014], 0.01);                    // a white scut of a tail
      const sf = st.field();
      P.add('skin', st.mesh());
      P.add('eye', merge([-1, 1].map((x) => sphere(0.007, x * 0.026, y0 + 0.64, 0.19, 8))));
      P.add('cloth', sdfGeometry(drape(sf, 0.012, (x, y, z) => Math.max(y0 + 0.36 - y, Math.abs(z + 0.01) - 0.1)), [-0.09, y0 + 0.3, -0.13, 0.09, y0 + 0.46, 0.11], Q.cell * 1.3));
      P.add('accent', merge([-1, 1].map((x) => leafBadge(0.04).rotateY(x * Math.PI / 2).translate(x * 0.075, y0 + 0.38, -0.01))));
      // antlers: a beam rising and curving back on each side, with tines
      const ant = [];
      for (const x of [-1, 1]) {
        const beam = [[x * 0.016, y0 + 0.665, 0.15], [x * 0.05, y0 + 0.73, 0.14], [x * 0.08, y0 + 0.8, 0.11], [x * 0.09, y0 + 0.88, 0.07], [x * 0.085, y0 + 0.94, 0.03]];
        ant.push(K.tube(beam, 0.007, { segs: 24, radial: 6, radiusAt: (t) => 1 - t * 0.5 }));
        for (const [i, len] of [[1, 0.05], [2, 0.06], [3, 0.05]]) { const b = beam[i]; ant.push(K.tube([b, [b[0] + x * 0.012, b[1] + len * 0.6, b[2] + len * 0.6], [b[0] + x * 0.01, b[1] + len, b[2] + len * 0.5]], 0.005, { segs: 10, radial: 5, radiusAt: (t) => 1 - t * 0.6 })); }
      }
      P.add('trim', merge(ant));
      return turnPiece(P, 0.2);
    },
    r() {
      // a slender white tower with a glowing arched window, gold trim and a crystal spire
      const P = new Piece(), y0 = armyPlinth(P, 0.335, 0.1, { studs: 6 });
      P.lathe('stone', profile(0, y0).line(0.21, y0).curve([[0.2, y0 + 0.16], [0.17, y0 + 0.36], [0.16, y0 + 0.44]]).line(0.2, y0 + 0.46).line(0.2, y0 + 0.5).line(0, y0 + 0.5), { mod: MOD.facets(8, y0, y0 + 0.46, 0.2) });
      P.add('trim', merge([0.02, 0.24, 0.46].map((y, i) => ring([0.21, 0.19, 0.2][i], y0 + y, 0.009, { seg: 8 }))));
      // a pointed arch window on the front, lit from inside
      const win = extrude([[-0.045, 0], [0.045, 0], [0.045, 0.12], [0, 0.19], [-0.045, 0.12]], 0.01, 0.003, { bevelSegments: 1 });
      P.add('glow', win.translate(0, y0 + 0.16, 0.19));
      P.add('trim', merge([-1, 1].map((x) => rod(x * 0.055, y0 + 0.15, y0 + 0.29, 0.188, 0.006))));
      // four little spires round a central spire tipped with a crystal
      P.add('stone', around(4, 0.155, y0 + 0.5, () => new THREE.ConeGeometry(0.035, 0.11, 8).translate(0, 0.055, 0), { phase: Math.PI / 4 }));
      P.add('trim', around(4, 0.155, y0 + 0.615, () => sphere(0.01, 0, 0, 0, 8), { phase: Math.PI / 4 }));
      P.lathe('stone', profile(0, y0 + 0.5).line(0.08, y0 + 0.5).line(0.06, y0 + 0.58).line(0, y0 + 0.68));
      P.add('crystal', shard(0.034, 0.13).translate(0, y0 + 0.72, 0));
      P.add('accent', leafBadge(0.05).translate(0, y0 + 0.37, 0.178));
      // ivy climbing up one side
      const ivy = []; for (let i = 0; i < 14; i++) { const t = i / 13, a = -1.9 + t * 1.2, r = mix(0.215, 0.17, t); ivy.push(placeAt(leaf(0.016, 0.03, 0.004), a, r, y0 + 0.03 + t * 0.4, { tilt: 0.3, spin: (i % 2 ? 0.6 : -0.6) })); }
      P.add('leaf', merge(ivy));
      return P;
    },
    p() {
      // a sentinel with a tall spear and a kite shield carrying the leaf
      const P = new Piece(), y0 = armyPlinth(P, 0.27, 0.08, { studs: 5 });
      const f = person(P, y0, 0.74, { kind: 'elf', dress: 'legs', cape: true, hands: [[-0.1, 0.42, 0.06], [0.09, 0.4, 0.09]] });
      // a winged helmet that covers the hair
      const hm = helmet(f.H, f.hr, { tall: 1.25 }); P.add('trim', hm.metal);
      P.add('trim', merge([-1, 1].map((x) => leaf(0.02, 0.06, 0.004).rotateZ(-x * 0.9).translate(f.H[0] + x * f.hr * 1.05, f.H[1] + f.hr * 0.3, f.H[2]))));
      const sp = spear(0.52, 0.0065); const h = f.hands[0];
      P.add('trim', sp.shaft.translate(h[0], y0, h[2])); P.add('steel', sp.head.translate(h[0], y0, h[2]));
      const sh = kite(0.13, 0.17, 0.012); sh.rotateY(0.25).translate(...f.hands[1]).translate(0.01, 0, 0.02);
      P.add('cloth2', sh);
      P.add('trim', leafBadge(0.06).rotateY(0.25).translate(f.hands[1][0] + 0.013, f.hands[1][1] + 0.01, f.hands[1][2] + 0.036));
      return turnPiece(P, 0.35);
    },
  };
  const ORCS = {
    k() {
      // the warchief: a huge orc in a fur mantle with a war hammer and a crown of tusks
      const P = new Piece(), y0 = armyPlinth(P, 0.35, 0.11, { rough: true });
      const f = person(P, y0, 1.2, { kind: 'orc', dress: 'legs', belly: true, cape: true, bulk: 1.4, hands: [[-0.1, 0.42, 0.1], [0.12, 0.5, 0.06]], hair: 'braid' });
      // a fur mantle over the shoulders and iron pauldrons with spikes
      const fur = new Sculpt(0.02);
      for (let i = 0; i < 11; i++) { const a = mix(-2.2, 2.2, i / 10); fur.ell([Math.sin(a) * 0.11 * f.s * f.B, f.shY + 0.01, -0.01 + Math.cos(a) * 0.05 * f.s * f.B], [0.04 * f.s, 0.035 * f.s, 0.04 * f.s], 0.025); }
      P.add('fur', fur.mesh());
      for (const x of [-1, 1]) {
        const c = f.A(x * 0.12 * f.B, 0.68, -0.005);
        P.add('steel', new THREE.SphereGeometry(0.05 * f.s, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.75, 1).translate(...c));
        P.add('tusk', merge([-0.4, 0.4].map((z) => new THREE.ConeGeometry(0.011, 0.06, 8).rotateZ(-x * 0.5).translate(c[0] + x * 0.02, c[1] + 0.04, c[2] + z * 0.05))));
      }
      P.add('steel', new THREE.SphereGeometry(0.1 * f.s, 20, 12, Math.PI / 2 - 1.1, 2.2, 0.5, 1.4).scale(1.2, 1.1, 0.75).translate(...f.A(0, 0.56, 0.02)));   // an iron breastplate
      P.add('trim', ring(0.098 * f.s, f.A(0, 0.44, 0.02)[1], 0.012).scale(1, 1, 0.9).translate(0, 0, 0.02));
      P.add('accent', tuskBadge(0.06).translate(...f.A(0, 0.44, 0.12)));
      // the war hammer, resting on its head on the ground
      const h = f.hands[1];
      P.add('wood', rod(h[0], y0 + 0.11, h[1] + 0.06, h[2], 0.011));
      P.add('steel', new THREE.BoxGeometry(0.11, 0.08, 0.08).translate(h[0], y0 + 0.07, h[2]));
      P.add('glow', merge([-1, 1].map((x) => new THREE.BoxGeometry(0.004, 0.05, 0.05).translate(h[0] + x * 0.056, y0 + 0.07, h[2]))));
      // a crown of tusks and iron spikes
      const cy = f.top - f.hr * 0.6;
      P.add('steel', ring(f.hr * 1.02, cy, 0.012));
      P.add('tusk', around(7, f.hr * 1.0, cy + 0.01, (i) => new THREE.ConeGeometry(0.014, i % 2 ? 0.08 : 0.13, 8).translate(0, i % 2 ? 0.04 : 0.065, 0), { tilt: -0.12 }));
      P.add('accent', placeAt(brilliant(0.014), 0, f.hr * 1.03, cy).translate(0, 0, f.H[2]));
      return turnPiece(P, 0.35);
    },
    q() {
      // a warrior queen in red leather and iron, a curved blade at her side
      const P = new Piece(), y0 = armyPlinth(P, 0.33, 0.1, { rough: true });
      const f = person(P, y0, 1.04, { kind: 'orc', dress: 'gown', gownSlot: 'cloth2', bulk: 1.05, flare: 0.95, frills: 9, hair: 'long', hands: [[-0.11, 0.42, 0.07], [0.12, 0.44, 0.04]] });
      P.add('trim', ring(0.07 * f.s, f.A(0, 0.43, 0)[1], 0.01));
      P.add('steel', merge([-1, 1].map((x) => new THREE.SphereGeometry(0.036 * f.s, 14, 8, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.7, 1).translate(...f.A(x * 0.085, 0.665, -0.004)))));
      // a curved blade held low
      const h = f.hands[0];
      P.add('steel', extrude([[0, 0], [0.018, 0.02], [0.03, 0.14], [0.0, 0.22], [-0.006, 0.12]], 0.006, 0.002, { bevelSegments: 1 }).rotateY(Math.PI / 2).rotateX(0.3).translate(h[0], h[1], h[2]));
      P.add('wood', rod(h[0], h[1] - 0.05, h[1] + 0.01, h[2], 0.008));
      // a coronet of iron points with red stones
      const cy = f.top - f.hr * 0.6;
      P.add('steel', pointedCrown(f.hr * 1.0, cy, 6, 0.07, { flare: 0.2, w: 0.55 }));
      P.add('accent', gemRing(6, f.hr * 1.06, cy + 0.012, 0.009, { phase: Math.PI / 6 }));
      P.add('tusk', around(10, 0.03 * f.s, f.A(0, 0.71, 0)[1], () => new THREE.ConeGeometry(0.006, 0.024, 6).rotateX(Math.PI), { tilt: 0 }).translate(0, 0, 0.01));
      return turnPiece(P, 0.35);
    },
    b() {
      // a shaman in a red hood with a totem staff topped by horns and a crackling blue orb
      const P = new Piece(), y0 = armyPlinth(P, 0.31, 0.1, { rough: true });
      const f = person(P, y0, 1.0, { kind: 'orc', dress: 'robe', hood: 'tall', bulk: 1.15, hands: [[-0.12, 0.5, 0.07], [0.08, 0.38, 0.07]] });
      const h = f.hands[0];
      P.add('wood', rod(h[0], y0, h[1] + 0.32, h[2], 0.009));
      // a pair of ram's horns curling out from the top of the staff
      for (const x of [-1, 1]) { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * 4.2; pts.push([h[0] + x * (0.012 + Math.sin(a) * 0.03 + i * 0.002), h[1] + 0.33 + (1 - Math.cos(a)) * 0.022, h[2] + Math.cos(a) * 0.012]); } P.add('tusk', K.tube(pts, 0.008, { segs: 24, radial: 6, radiusAt: (t) => 1 - t * 0.6 })); }
      P.add('glow', sphere(0.028, h[0], h[1] + 0.4, h[2], 14));
      P.add('accent', around(8, 0.03 * f.s, f.A(0, 0.64, 0)[1], () => sphere(0.008, 0, 0, 0, 8)).translate(0, 0, 0.012));   // a bead necklace
      P.add('tusk', new THREE.ConeGeometry(0.008, 0.03, 6).rotateX(Math.PI).translate(...f.A(0, 0.6, 0.075)));
      P.add('trim', ring(0.09 * f.s, f.A(0, 0.42, 0)[1], 0.009));
      return turnPiece(P, 0.35);
    },
    n() {
      // a great grey wolf, its front paws up on a rock, snarling, in a spiked iron collar
      const P = new Piece(), y0 = armyPlinth(P, 0.322, 0.1, { rough: true });
      const w = new Sculpt(0.022, 1.15), ruff = new Sculpt(0.014);
      w.floor = y0 - 0.004;
      P.add('stone', new THREE.DodecahedronGeometry(0.1, 1).scale(1.5, 0.9, 1.0).translate(0, y0 + 0.07, 0.11));
      w.ell([0, y0 + 0.3, -0.04], [0.075, 0.085, 0.15], 0.04);                       // body, rising to the front
      w.ell([0, y0 + 0.37, 0.08], [0.085, 0.1, 0.085], 0.05);                         // deep chest
      w.ell([0, y0 + 0.28, -0.14], [0.072, 0.08, 0.07], 0.04);                        // haunches
      w.pair((x) => {
        leg(w, [x * 0.05, y0 + 0.3, 0.1], [x * 0.055, y0 + 0.22, 0.14], [x * 0.055, y0 + 0.155, 0.15], 0.032, 0.02, 0.026);   // front legs on the rock
        w.ell([x * 0.06, y0 + 0.2, -0.15], [0.038, 0.085, 0.07], 0.03);               // thighs
        leg(w, [x * 0.06, y0 + 0.17, -0.18], [x * 0.055, y0 + 0.08, -0.2], [x * 0.055, y0, -0.15], 0.026, 0.017, 0.022);
      });
      w.chain([[0, y0 + 0.42, 0.11, 0.06], [0, y0 + 0.5, 0.16, 0.05]], 0.03, 3);
      w.ell([0, y0 + 0.54, 0.2], [0.06, 0.055, 0.062], 0.03);                         // head
      w.cone([0, y0 + 0.53, 0.22], [0, y0 + 0.5, 0.31], 0.036, 0.022, 0.02);           // muzzle
      w.ell([0, y0 + 0.49, 0.27], [0.024, 0.012, 0.04], 0.006, true);                 // the open mouth
      w.pair((x) => w.cone([x * 0.034, y0 + 0.58, 0.18], [x * 0.05, y0 + 0.66, 0.16], 0.019, 0.004, 0.008));   // ears up
      w.chain([[0, y0 + 0.32, -0.2, 0.03], [0.02, y0 + 0.24, -0.27, 0.034], [0.05, y0 + 0.13, -0.26, 0.022]], 0.02, 4);   // a bushy tail
      // a pale ruff round the neck
      for (let i = 0; i < 11; i++) { const a = mix(-2.5, 2.5, i / 10); ruff.cone([Math.sin(a) * 0.07, y0 + 0.47, 0.13 + Math.cos(a) * 0.045], [Math.sin(a) * 0.1, y0 + 0.4, 0.11 + Math.cos(a) * 0.035], 0.024, 0.006, 0.012); }
      for (let i = 0; i < 6; i++) ruff.cone([0, y0 + 0.4 - i * 0.012, 0.04 - i * 0.04], [0, y0 + 0.44 - i * 0.012, 0.01 - i * 0.04], 0.018, 0.004, 0.01);
      P.add('fur', w.mesh()); P.add('fur2', ruff.mesh());
      P.add('glow', merge([-1, 1].map((x) => sphere(0.009, x * 0.028, y0 + 0.555, 0.245, 8))));
      P.add('tusk', merge([-1, 1].map((x) => new THREE.ConeGeometry(0.005, 0.02, 6).rotateX(Math.PI).translate(x * 0.016, y0 + 0.495, 0.29))));
      const col = merge([ring(0.065, 0, 0.011), around(7, 0.075, 0, () => new THREE.ConeGeometry(0.008, 0.026, 6).rotateX(Math.PI / 2).translate(0, 0, 0.01))]);
      P.add('steel', col.rotateX(0.6).translate(0, y0 + 0.455, 0.125));
      return turnPiece(P, 0.15);
    },
    r() {
      // a watchtower of rough stone and timber, ringed with sharpened stakes, a red banner and a fire inside
      const P = new Piece(), y0 = armyPlinth(P, 0.335, 0.1, { rough: true });
      P.lathe('stone', profile(0, y0).line(0.22, y0).line(0.2, y0 + 0.28).line(0.17, y0 + 0.3).line(0.17, y0 + 0.48).line(0, y0 + 0.48), { mod: MOD.facets(9, y0, y0 + 0.3, 0.5) });
      // a timber top on beams, wider than the stone
      P.lathe('wood', profile(0, y0 + 0.47).line(0.23, y0 + 0.47).line(0.23, y0 + 0.56).line(0.21, y0 + 0.57).line(0, y0 + 0.57), { mod: MOD.flutes(18, 0.08, y0 + 0.47, y0 + 0.56, { fillet: 0.3 }) });
      P.add('wood', around(9, 0.2, y0 + 0.57, () => new THREE.CylinderGeometry(0.012, 0.016, 0.13, 6).translate(0, 0.065, 0), { tilt: -0.25 }));
      P.add('steel', around(9, 0.2, y0 + 0.57, () => new THREE.ConeGeometry(0.014, 0.05, 6).translate(0, 0.15, -0.03), { tilt: -0.25 }));
      P.add('wood', around(4, 0.22, y0 + 0.47, () => new THREE.CylinderGeometry(0.01, 0.01, 0.1, 6).rotateX(0.7).translate(0, -0.03, -0.03)));
      // a roof cone of bound stakes with a big spike, and the banner on the front
      P.add('wood', new THREE.ConeGeometry(0.15, 0.14, 9).translate(0, y0 + 0.64, 0));
      P.add('tusk', merge([-1, 1].map((x) => new THREE.ConeGeometry(0.014, 0.1, 6).rotateZ(-x * 0.7).translate(x * 0.13, y0 + 0.62, 0.0))));
      P.add('steel', new THREE.ConeGeometry(0.02, 0.12, 6).translate(0, y0 + 0.76, 0));
      P.add('banner', armyBanner(0.1, 0.22).translate(0, y0 + 0.44, 0.205));
      P.add('wood', rod(0, -0.06, 0.06, 0, 0.006).rotateZ(Math.PI / 2).translate(0, y0 + 0.445, 0.208));
      P.add('accent', tuskBadge(0.06).translate(0, y0 + 0.36, 0.214));
      // the fire glowing through a doorway
      P.add('glow', extrude([[-0.035, 0], [0.035, 0], [0.035, 0.07], [0, 0.1], [-0.035, 0.07]], 0.01, 0.003, { bevelSegments: 1 }).rotateY(Math.PI * 0.6).translate(Math.sin(Math.PI * 0.6) * 0.2, y0 + 0.02, Math.cos(Math.PI * 0.6) * 0.2));
      return P;
    },
    p() {
      // a grunt with an axe and a round wooden shield
      const P = new Piece(), y0 = armyPlinth(P, 0.27, 0.08, { rough: true });
      const f = person(P, y0, 0.7, { kind: 'orc', dress: 'legs', bulk: 1.4, hands: [[-0.1, 0.36, 0.1], [0.1, 0.38, 0.08]], hair: 'bun' });
      P.add('steel', merge([-1, 1].map((x) => new THREE.SphereGeometry(0.05 * f.s, 14, 8, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.7, 1).translate(...f.A(x * 0.12, 0.665, -0.004)))));
      P.add('trim', ring(0.095 * f.s, f.A(0, 0.44, 0)[1], 0.008));
      const ax = axe(0.24, 0.05); const h = f.hands[0];
      for (const g of [ax.haft, ax.blade]) { g.rotateX(0.5); g.translate(h[0], h[1] - 0.06, h[2]); }
      P.add('wood', ax.haft); P.add('steel', ax.blade);
      const sh = shield(0.075, 0.018);
      for (const g of [sh.face, sh.rim, sh.boss]) { g.rotateY(0.45); g.translate(...f.hands[1]); g.translate(0.012, 0, 0.02); }
      P.add('wood', sh.face); P.add('steel', sh.rim); P.add('banner', sh.boss);
      return turnPiece(P, 0.35);
    },
  };

  // ------------------------------------------------------------------ Sun Kingdom & Shadow Legion
  // A storybook set: round, cheerful figures with big heads. White is the Sun Kingdom, cream,
  // royal blue and gold under a smiling sun; black is the Shadow Legion, in midnight purple
  // with glowing violet magic. Both are our own characters.
  const sunBadge = (r) => merge([sphere(r * 0.5, 0, 0, 0, 14).scale(1, 1, 0.4), around(8, r * 0.62, 0, () => ray(r * 0.3, r * 0.4, r * 0.12).rotateX(-Math.PI / 2), { tilt: 0 }).rotateX(Math.PI / 2)]);
  const SUNKING = {
    k() {
      // the jolly king: a round belly, a red cape lined with ermine, a big crown and a sun sceptre
      const P = new Piece(), y0 = armyPlinth(P, 0.34, 0.11, { studs: 8 });
      const f = person(P, y0, 1.42, { kind: 'chibi', dress: 'legs', belly: true, bulk: 1.25, cape: true, capeSlot: 'cape', beard: 0.5, beardSlot: 'fur', hands: [[-0.1, 0.27, 0.08], [0.12, 0.33, 0.04]] });
      P.add('fur', ring(0.07 * f.s * f.B, f.shY + 0.01, 0.016).translate(0, 0, -0.01));
      P.add('trim', ring(0.11 * f.s, f.A(0, 0.2, 0.02)[1], 0.012).scale(1, 1, 0.95).translate(0, 0, 0.02));
      const cy = f.top - f.hr * 0.42;
      P.add('trim', pointedCrown(f.hr * 0.72, cy, 5, 0.12, { flare: 0.2, w: 0.7 }));
      P.add('accent', gemRing(5, f.hr * 0.78, cy + 0.02, 0.014, { phase: Math.PI / 5 }));
      P.add('cape', sphere(f.hr * 0.66, 0, 0, 0, 18).scale(1, 0.7, 1).translate(0, cy + 0.04, f.H[2]));
      P.add('trim', sphere(0.022, 0, cy + 0.18, f.H[2], 12));
      const h = f.hands[0];
      P.add('trim', rod(h[0], h[1] - 0.06, h[1] + 0.3, h[2], 0.009));
      P.add('trim', sunBadge(0.05).translate(h[0], h[1] + 0.34, h[2] + 0.004));
      return turnPiece(P, 0.3);
    },
    q() {
      // the princess: a golden gown with frills, rosy curls and a crown, waving hello
      const P = new Piece(), y0 = armyPlinth(P, 0.33, 0.1, { studs: 8 });
      const f = person(P, y0, 1.38, { kind: 'chibi', dress: 'gown', gownSlot: 'cloth2', frills: 8, flare: 1.05, hair: 'curls', hands: [[-0.12, 0.47, 0.03], [0.06, 0.25, 0.08]] });
      P.add('hair', sphere(f.hr * 0.98, 0, 0, 0, 20).scale(1, 0.8, 1).translate(f.H[0], f.H[1] + f.hr * 0.25, f.H[2] - f.hr * 0.12));
      const cy = f.top - f.hr * 0.25;
      P.add('trim', pointedCrown(f.hr * 0.5, cy, 5, 0.09, { flare: 0.15, w: 0.6 }));
      P.add('accent', placeAt(brilliant(0.016), 0, f.hr * 0.55, cy + 0.03).translate(0, 0, f.H[2]));
      P.add('trim', ring(0.06 * f.s, f.A(0, 0.25, 0)[1], 0.01));
      P.add('trim', sunBadge(0.035).translate(...f.A(0, 0.33, 0.075)));
      return turnPiece(P, 0.3);
    },
    b() {
      // the old court wizard: a star-spangled pointed hat, a long white beard and a star on his staff
      const P = new Piece(), y0 = armyPlinth(P, 0.31, 0.1, { studs: 8 });
      const f = person(P, y0, 1.1, { kind: 'chibi', dress: 'robe', clothSlot: 'cloth2', beard: 0.9, beardSlot: 'fur', hands: [[-0.11, 0.33, 0.06], [0.08, 0.25, 0.08]] });
      const by = f.top - f.hr * 0.55;
      P.lathe('cloth2', profile(0, by).line(f.hr * 1.35, by).line(f.hr * 1.3, by + 0.015).line(f.hr * 0.8, by + 0.03).curve([[f.hr * 0.6, by + 0.12], [f.hr * 0.3, by + 0.24], [0.006, by + 0.33]]).line(0, by + 0.33), { mod: MOD.slit(Math.PI * 0.25, by + 0.15, 0.6, 0.016, 0.4) });
      P.add('trim', merge([[0.05, 0.1, 0.4], [-0.04, 0.17, 1.6], [0.02, 0.24, 3.0]].map(([x, y, a]) => star(0.018, 0.006, 5).rotateY(a).translate(Math.sin(a) * f.hr * mix(0.8, 0.3, y / 0.3), by + y, f.H[2] + Math.cos(a) * f.hr * mix(0.8, 0.3, y / 0.3)))));
      P.add('trim', ring(f.hr * 0.85, by + 0.03, 0.008));
      const h = f.hands[0];
      P.add('wood', rod(h[0], y0, h[1] + 0.32, h[2], 0.009));
      P.add('glow', star(0.045, 0.016, 5).translate(h[0], h[1] + 0.37, h[2]));
      P.add('trim', ring(0.085 * f.s, f.A(0, 0.27, 0)[1], 0.008));
      return turnPiece(P, 0.3);
    },
    n() {
      // a round, friendly pony with a mane of golden sun rays and a blue saddle
      const P = new Piece(), y0 = armyPlinth(P, 0.322, 0.1, { studs: 8 });
      const h = new Sculpt(0.026, 1.15);
      h.floor = y0 - 0.004;
      h.ell([0, y0 + 0.28, -0.02], [0.1, 0.1, 0.15], 0.04);                          // a round body
      h.pair((x) => {
        h.cone([x * 0.06, y0 + 0.22, 0.08], [x * 0.06, y0 + 0.03, 0.09], 0.036, 0.034, 0.02);
        h.cone([x * 0.06, y0 + 0.22, -0.11], [x * 0.06, y0 + 0.03, -0.11], 0.038, 0.034, 0.02);
      });
      h.chain([[0, y0 + 0.33, 0.08, 0.06], [0, y0 + 0.44, 0.12, 0.05]], 0.03, 3);
      h.ell([0, y0 + 0.53, 0.14], [0.085, 0.09, 0.085], 0.03);                       // a big head
      h.ell([0, y0 + 0.48, 0.22], [0.06, 0.05, 0.05], 0.03);                         // soft muzzle
      h.pair((x) => h.cone([x * 0.05, y0 + 0.6, 0.12], [x * 0.07, y0 + 0.67, 0.1], 0.02, 0.006, 0.01));
      P.add('cloth', h.mesh());
      P.add('hoof', merge([-1, 1].flatMap((x) => [0.09, -0.11].map((z) => new THREE.CylinderGeometry(0.036, 0.04, 0.03, 16).translate(x * 0.06, y0 + 0.015, z)))));
      P.add('eye', merge([-1, 1].map((x) => sphere(0.016, 0, 0, 0, 10).scale(1, 1.3, 0.6).translate(x * 0.042, y0 + 0.55, 0.205))));
      P.add('skin', merge([-1, 1].map((x) => sphere(0.014, 0, 0, 0, 8).scale(1, 0.7, 0.5).translate(x * 0.06, y0 + 0.5, 0.2))));
      // the sun-ray mane, from the forelock down the neck, and a tail
      const rays = [];
      for (let i = 0; i < 9; i++) { const t = i / 8; rays.push(placeAt(ray(0.03, 0.075, 0.012), 0, 0, 0, { tilt: -0.6 - t * 0.5 }).translate(0, y0 + mix(0.64, 0.36, t), mix(0.12, 0.02, t) - 0.02)); }
      rays.push(K.tube([[0, y0 + 0.33, -0.16], [0, y0 + 0.28, -0.22], [0, y0 + 0.17, -0.2]], 0.022, { segs: 14, radial: 8, radiusAt: (t) => 1 - t * 0.5 }));
      P.add('trim', merge(rays));
      P.add('cloth2', sdfGeometry(drape(h.field(), 0.014, (x, y, z) => Math.max(y0 + 0.31 - y, Math.abs(z + 0.02) - 0.09)), [-0.12, y0 + 0.26, -0.13, 0.12, y0 + 0.42, 0.1], Q.cell * 1.3));
      P.add('trim', sunBadge(0.03).rotateY(Math.PI / 2).translate(0.11, y0 + 0.31, -0.02));
      return turnPiece(P, 0.35);
    },
    r() {
      // a round castle turret: cream stone, a blue cone roof, lit windows and the sun banner
      const P = new Piece(), y0 = armyPlinth(P, 0.335, 0.1, { studs: 8 });
      P.lathe('stone', profile(0, y0).line(0.21, y0).line(0.2, y0 + 0.4).line(0.23, y0 + 0.42).line(0.23, y0 + 0.47).line(0, y0 + 0.47), { mod: MOD.lobes(12, 0.03, y0, y0 + 0.4, { shape: 0.5, end: 0.01 }) });
      P.add('stone', battlements(6, 0.19, 0.235, y0 + 0.465, y0 + 0.53, 0.42, 'flat'));
      P.lathe('cloth2', profile(0, y0 + 0.5).line(0.19, y0 + 0.5).curve([[0.12, y0 + 0.58], [0.05, y0 + 0.68], [0.008, y0 + 0.76]]).line(0, y0 + 0.76));
      P.add('trim', rod(0, y0 + 0.74, y0 + 0.86, 0, 0.005));
      P.add('banner', extrude([[0, 0], [0.07, -0.02], [0, -0.045]], 0.004, 0.001).translate(0.004, y0 + 0.86, 0));
      P.add('glow', merge([[0, 0.24], [Math.PI * 0.6, 0.12], [-Math.PI * 0.6, 0.12]].map(([a, y]) => placeAt(extrude([[-0.025, 0], [0.025, 0], [0.025, 0.05], [0, 0.07], [-0.025, 0.05]], 0.008, 0.002, { bevelSegments: 1 }), a, 0.203, y0 + y))));
      P.add('banner', armyBanner(0.11, 0.17).translate(0, y0 + 0.44, 0.215).rotateY(0.9));
      P.add('trim', sunBadge(0.035).rotateY(0.9).translate(Math.sin(0.9) * 0.222, y0 + 0.36, Math.cos(0.9) * 0.222));
      return P;
    },
    p() {
      // a villager in a sunflower hat, smiling
      const P = new Piece(), y0 = armyPlinth(P, 0.27, 0.08, { studs: 6 });
      const f = person(P, y0, 0.78, { kind: 'chibi', dress: 'legs', clothSlot: 'cloth2', hands: [[-0.12, 0.42, 0.04], [0.1, 0.24, 0.08]] });
      P.add('hair', sphere(f.hr * 1.0, 0, 0, 0, 20).scale(1, 0.75, 1).translate(f.H[0], f.H[1] + f.hr * 0.2, f.H[2] - f.hr * 0.12));
      const hy = f.top - f.hr * 0.25;
      P.add('wood', new THREE.CylinderGeometry(f.hr * 0.6, f.hr * 0.75, 0.035, 20).translate(0, hy, f.H[2] - 0.004));
      P.add('trim', around(12, f.hr * 0.7, hy, () => petal(0.045, 0.08, 0.008), { tilt: Math.PI / 2 - 0.3 }).translate(0, 0, f.H[2] - 0.004));
      P.add('cloth', ring(0.07 * f.s, f.A(0, 0.25, 0)[1], 0.012));
      return turnPiece(P, 0.3);
    },
  };
  const SHADOW = {
    k() {
      // the Shadow King: armour, a purple cape, a horned crown and violet fire in his hand
      const P = new Piece(), y0 = armyPlinth(P, 0.35, 0.11, { studs: 8 });
      const f = person(P, y0, 1.48, { kind: 'chibi', dress: 'legs', bulk: 1.35, cape: true, capeSlot: 'cloth2', hands: [[-0.12, 0.38, 0.06], [0.12, 0.25, 0.08]], noEyes: true });
      P.add('glow', merge(f.hands.slice(0, 1).map((h) => new THREE.ConeGeometry(0.035, 0.09, 8).translate(h[0], h[1] + 0.06, h[2]))));
      P.add('glow', merge([-1, 1].map((x) => sphere(f.hr * 0.15, 0, 0, 0, 10).scale(1, 0.8, 0.6).translate(x * f.hr * 0.36, f.H[1] - f.hr * 0.02, f.H[2] + f.hr * 0.86))));
      P.add('steel', merge([-1, 1].map((x) => new THREE.SphereGeometry(0.055 * f.s, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.8, 1).translate(...f.A(x * 0.12, 0.42, -0.004)))));
      P.add('steel', new THREE.SphereGeometry(0.09 * f.s, 20, 12, Math.PI / 2 - 1.1, 2.2, 0.5, 1.5).scale(1.2, 1.0, 0.8).translate(...f.A(0, 0.32, 0.02)));
      // a helm-crown with two great horns
      P.add('steel', new THREE.SphereGeometry(f.hr * 1.06, 24, 12, 0, TAU, 0, Math.PI * 0.42).translate(f.H[0], f.H[1] + f.hr * 0.05, f.H[2]));
      P.add('trim', pointedCrown(f.hr * 0.95, f.H[1] + f.hr * 0.25, 7, 0.1, { flare: 0.15, w: 0.6 }));
      for (const x of [-1, 1]) { const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([f.H[0] + x * f.hr * (0.9 + t * 0.7), f.H[1] + f.hr * (0.3 + Math.sin(t * 2.2) * 0.9), f.H[2] - f.hr * 0.1 + t * 0.03]); } P.add('horn', K.tube(pts, f.hr * 0.18, { segs: 20, radial: 8, radiusAt: (t) => 1 - t * 0.85 })); }
      P.add('accent', gemRing(7, f.hr * 1.0, f.H[1] + f.hr * 0.3, 0.012, { phase: Math.PI / 7 }));
      return turnPiece(P, 0.3);
    },
    q() {
      // the sorceress: a purple gown, long dark hair, a horned tiara and a violet flame in her palm
      const P = new Piece(), y0 = armyPlinth(P, 0.33, 0.1, { studs: 8 });
      const f = person(P, y0, 1.38, { kind: 'chibi', dress: 'gown', gownSlot: 'cloth2', flare: 1.0, frills: 6, hair: 'long', hands: [[-0.12, 0.4, 0.07], [0.07, 0.24, 0.08]] });
      P.add('hair', sphere(f.hr * 1.0, 0, 0, 0, 20).scale(1, 0.85, 1).translate(f.H[0], f.H[1] + f.hr * 0.22, f.H[2] - f.hr * 0.14));
      const h = f.hands[0];
      P.add('glow', new THREE.ConeGeometry(0.03, 0.08, 8).translate(h[0], h[1] + 0.06, h[2]));
      P.add('glow', sphere(0.022, h[0], h[1] + 0.035, h[2], 10));
      const cy = f.top - f.hr * 0.3;
      P.add('trim', pointedCrown(f.hr * 0.6, cy, 5, 0.1, { flare: 0.25, w: 0.55 }));
      P.add('horn', merge([-1, 1].map((x) => new THREE.ConeGeometry(0.014, 0.08, 8).rotateZ(-x * 0.5).translate(x * f.hr * 0.62, cy + 0.06, f.H[2]))));
      P.add('accent', placeAt(brilliant(0.016), 0, f.hr * 0.66, cy + 0.03).translate(0, 0, f.H[2]));
      P.add('trim', ring(0.06 * f.s, f.A(0, 0.25, 0)[1], 0.01));
      return turnPiece(P, 0.3);
    },
    b() {
      // a hooded mage: only two glowing eyes under the hood, and an orb on a crooked staff
      const P = new Piece(), y0 = armyPlinth(P, 0.31, 0.1, { studs: 8 });
      const f = person(P, y0, 1.12, { kind: 'chibi', dress: 'robe', clothSlot: 'cloth2', hood: true, hoodSlot: 'cloth2', noEyes: true, hands: [[-0.11, 0.35, 0.06], [0.08, 0.24, 0.08]] });
      P.add('void', sphere(f.hr * 0.96, f.H[0], f.H[1], f.H[2] + f.hr * 0.06, 20));
      P.add('glow', merge([-1, 1].map((x) => sphere(f.hr * 0.14, 0, 0, 0, 10).scale(1, 0.75, 0.5).translate(x * f.hr * 0.34, f.H[1] + f.hr * 0.05, f.H[2] + f.hr * 0.95))));
      const h = f.hands[0], pts = [];
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([h[0] + Math.sin(t * 9) * 0.006, mix(y0, h[1] + 0.3, t), h[2]]); }
      pts.push([h[0] + 0.03, h[1] + 0.34, h[2]], [h[0] + 0.05, h[1] + 0.31, h[2]]);
      P.add('wood', K.tube(pts, 0.009, { segs: 30, radial: 6 }));
      P.add('glow', sphere(0.034, h[0] + 0.006, h[1] + 0.385, h[2], 14));
      P.add('trim', ring(0.085 * f.s, f.A(0, 0.27, 0)[1], 0.008));
      return turnPiece(P, 0.3);
    },
    n() {
      // a little shadow dragon on its haunches, wings up, two horns and a curling tail
      const P = new Piece(), y0 = armyPlinth(P, 0.322, 0.1, { studs: 8 });
      const d = new Sculpt(0.024, 1.15), belly = new Sculpt(0.02);
      d.floor = y0 - 0.004;
      d.ell([0, y0 + 0.2, -0.03], [0.1, 0.13, 0.11], 0.04);                          // sitting body
      belly.ell([0, y0 + 0.22, 0.03], [0.07, 0.1, 0.06], 0.03);
      d.pair((x) => {
        d.ell([x * 0.075, y0 + 0.12, -0.02], [0.05, 0.07, 0.08], 0.03);              // haunches
        d.ell([x * 0.075, y0 + 0.025, 0.06], [0.03, 0.025, 0.05], 0.015);            // feet
        d.chain([[x * 0.06, y0 + 0.28, 0.05, 0.022], [x * 0.065, y0 + 0.21, 0.1, 0.018], [x * 0.05, y0 + 0.2, 0.13, 0.018]], 0.012);   // little arms
      });
      d.chain([[0, y0 + 0.3, 0.0, 0.06], [0, y0 + 0.4, 0.04, 0.05]], 0.03, 3);
      d.ell([0, y0 + 0.48, 0.07], [0.085, 0.08, 0.085], 0.03);                       // a big head
      d.ell([0, y0 + 0.45, 0.15], [0.055, 0.045, 0.05], 0.03);                       // snout
      d.pair((x) => d.ell([x * 0.022, y0 + 0.47, 0.195], [0.008, 0.006, 0.006], 0.004, true));   // nostrils
      d.chain([[0, y0 + 0.08, -0.12, 0.04], [0.08, y0 + 0.03, -0.16, 0.03], [0.15, y0 + 0.03, -0.08, 0.02], [0.17, y0 + 0.06, 0.0, 0.012]], 0.02, 4);   // tail curled round
      P.add('cloth', d.mesh()); P.add('cloth2', belly.mesh());
      P.add('glow', merge([-1, 1].map((x) => sphere(0.017, 0, 0, 0, 10).scale(1, 1.3, 0.6).translate(x * 0.04, y0 + 0.5, 0.14))));
      P.add('horn', merge([-1, 1].map((x) => new THREE.ConeGeometry(0.016, 0.08, 8).rotateX(-0.7).rotateZ(-x * 0.3).translate(x * 0.045, y0 + 0.56, 0.03))));
      P.add('horn', around(5, 0, 0, (i) => new THREE.ConeGeometry(0.012, 0.03, 6).translate(0, y0 + 0.31 - i * 0.04, -0.05 - i * 0.02 - 0.03 * (i > 2 ? 1 : 0)), { phase: 0 }).rotateY(0));
      const wing = (x) => { const g = extrude([[0, 0], [0.04, 0.16], [0.11, 0.2], [0.09, 0.13], [0.13, 0.1], [0.08, 0.05], [0.1, 0.0]], 0.006, 0.002, { bevelSegments: 1 }); g.rotateY(x > 0 ? 0.6 : Math.PI - 0.6); if (x < 0) g.rotateZ(0); return g.translate(x * 0.04, y0 + 0.28, -0.08); };
      P.add('wing', merge([wing(1), wing(-1)]));
      return turnPiece(P, 0.35);
    },
    r() {
      // a dark spire: black stone, spiked crenels, a violet window and a dark banner
      const P = new Piece(), y0 = armyPlinth(P, 0.335, 0.1, { studs: 8 });
      P.lathe('stone', profile(0, y0).line(0.22, y0).line(0.18, y0 + 0.36).line(0.23, y0 + 0.4).line(0.23, y0 + 0.46).line(0, y0 + 0.46), { mod: MOD.facets(6, y0, y0 + 0.46, 0.15) });
      P.add('horn', around(6, 0.215, y0 + 0.46, () => new THREE.ConeGeometry(0.03, 0.12, 6).translate(0, 0.06, 0), { tilt: -0.2 }));
      P.lathe('stone', profile(0, y0 + 0.46).line(0.11, y0 + 0.46).line(0.07, y0 + 0.62).line(0, y0 + 0.78), { segs: 6 });
      P.add('glow', sphere(0.025, 0, y0 + 0.68, 0.06, 10));
      P.add('glow', extrude([[-0.035, 0], [0.035, 0], [0.035, 0.08], [0, 0.13], [-0.035, 0.08]], 0.01, 0.003, { bevelSegments: 1 }).translate(0, y0 + 0.17, 0.19));
      P.add('banner', armyBanner(0.1, 0.18).translate(0, y0 + 0.39, 0.205).rotateY(-0.9));
      P.add('glow', star(0.022, 0.006, 4).rotateY(-0.9).translate(Math.sin(-0.9) * 0.21, y0 + 0.31, Math.cos(-0.9) * 0.21));
      return P;
    },
    p() {
      // a shadow imp: a round purple puff with two little horns, glowing eyes and bat wings
      const P = new Piece(), y0 = armyPlinth(P, 0.27, 0.08, { studs: 6 });
      const b = new Sculpt(0.03);
      b.floor = y0 - 0.004;
      b.ell([0, y0 + 0.27, 0], [0.13, 0.15, 0.12], 0.04);
      b.cone([0, y0 + 0.16, 0], [0, y0 + 0.02, 0], 0.08, 0.065, 0.04);                   // a wisp of mist to stand on
      b.pair((x) => b.ell([x * 0.12, y0 + 0.23, 0.05], [0.03, 0.035, 0.03], 0.03));      // stubby hands
      b.pair((x) => b.ell([x * 0.045, y0 + 0.32, 0.115], [0.035, 0.012, 0.02], 0.01));   // a grumpy brow
      P.add('cloth', b.mesh());
      P.add('glow', merge([-1, 1].map((x) => sphere(0.024, 0, 0, 0, 12).scale(1, 0.75, 0.5).translate(x * 0.045, y0 + 0.29, 0.105))));
      P.add('horn', merge([-1, 1].map((x) => new THREE.ConeGeometry(0.02, 0.07, 8).rotateZ(-x * 0.35).translate(x * 0.06, y0 + 0.43, 0.0))));
      P.add('wing', merge([-1, 1].map((x) => extrude([[0, 0], [0.04, 0.07], [0.09, 0.08], [0.07, 0.04], [0.1, 0.02], [0.06, -0.01]], 0.005, 0.002, { bevelSegments: 1 }).rotateY(x > 0 ? 0.5 : Math.PI - 0.5).translate(x * 0.07, y0 + 0.29, -0.07))));
      P.add('trim', ring(0.075, y0 + 0.12, 0.009));
      return turnPiece(P, 0.3);
    },
  };

  // ------------------------------------------------------------------ Galactic Blue & Red
  // Two star fleets of our own, out among the planets. White is the Blue Fleet, in white
  // ceramic with blue light; black is the Red Fleet, in black armour with red light. Kings and
  // queens are commanders, knights are starships, bishops are glowing crystal beacons, rooks are
  // towers of light and pawns are space cadets. Every figure stands on a lit hexagonal pad.
  // a starship along +z, built at the origin: a hull, wings, engines and a canopy
  function starship(P, o) {
    const g = { hull: [], wing: [], glow: [], glass: [] };
    const L = o.len, R = o.r;
    const hull = revolve(profile(0, -L * 0.5).line(R * 0.8, -L * 0.48).line(R, -L * 0.3).curve([[R * 0.95, L * 0.1], [R * 0.6, L * 0.35], [R * 0.12, L * 0.5]]).line(0, L * 0.52), { segs: 24 });
    g.hull.push(hull.rotateX(Math.PI / 2).scale(1, 0.7, 1));
    const W = o.wing;
    const wing = extrude(W, 0.012, 0.004, { bevelSegments: 1 }); wing.rotateX(Math.PI / 2);
    g.wing.push(wing);
    for (const x of [-1, 1]) {
      const ex = x * (o.engines || 0.06);
      g.hull.push(new THREE.CylinderGeometry(R * 0.38, R * 0.45, L * 0.32, 14).rotateX(Math.PI / 2).translate(ex, 0, -L * 0.3));
      g.glow.push(new THREE.CylinderGeometry(R * 0.32, R * 0.32, 0.01, 14).rotateX(Math.PI / 2).translate(ex, 0, -L * 0.465));
    }
    g.glass.push(sphere(R * 0.62, 0, 0, 0, 16).scale(0.8, 0.6, 1.5).translate(0, R * 0.45, L * 0.12));
    return g;
  }
  function placeShip(P, g, y, tilt, slots) {
    for (const k of Object.keys(g)) for (const geo of g[k]) P.add(slots[k] || k, geo.rotateX(-tilt).translate(0, y, 0));
  }
  const GALBLUE = {
    k() {
      // the Fleet Commander: a white uniform, a navy cape, gold shoulders and a star circlet
      const P = new Piece(), y0 = hexBase(P, 0.34, 0.11);
      const f = person(P, y0, 1.24, { dress: 'legs', cape: true, hands: [[-0.1, 0.44, 0.08], [0.1, 0.42, 0.04]], hair: 'bun' });
      P.add('trim', merge([-1, 1].map((x) => new THREE.SphereGeometry(0.045 * f.s, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.6, 1).translate(...f.A(x * 0.09, 0.67, -0.004)))));
      P.add('cloth2', new THREE.BoxGeometry(0.03 * f.s, 0.3 * f.s, 0.012).rotateZ(0.5).translate(...f.A(0, 0.55, 0.068)));
      P.add('trim', ring(0.07 * f.s, f.A(0, 0.44, 0)[1], 0.009));
      const cy = f.top - f.hr * 0.55;
      P.add('trim', ring(f.hr * 1.0, cy, 0.008));
      P.add('trim', pointedCrown(f.hr * 0.98, cy, 6, 0.07, { flare: 0.1, w: 0.4 }));
      P.add('glow', star(0.034, 0.01, 5).translate(0, cy + 0.06, f.H[2] + f.hr * 0.95));
      const h = f.hands[0];
      P.add('steel', rod(h[0], h[1] - 0.05, h[1] + 0.22, h[2], 0.008));
      P.add('glow', star(0.03, 0.01, 4).translate(h[0], h[1] + 0.25, h[2]));
      P.add('trim', merge([0.6, 0.53, 0.46].map((y) => sphere(0.008, 0, 0, 0, 8).translate(...f.A(-0.04, y, 0.065)))));
      return turnPiece(P, 0.3);
    },
    q() {
      // the Admiral: a long white coat, a high navy collar and a star staff
      const P = new Piece(), y0 = hexBase(P, 0.33, 0.1);
      const f = person(P, y0, 1.14, { dress: 'gown', flare: 0.9, cape: true, hair: 'long', hands: [[-0.1, 0.48, 0.08], [0.08, 0.4, 0.07]] });
      P.add('cloth2', new THREE.CylinderGeometry(0.06 * f.s, 0.045 * f.s, 0.07 * f.s, 18, 1, true, Math.PI / 2 + 0.7, TAU - 1.4).translate(...f.A(0, 0.72, -0.01)));
      P.add('trim', ring(0.06 * f.s, f.A(0, 0.43, 0)[1], 0.009));
      const cy = f.top - f.hr * 0.5;
      P.add('trim', pointedCrown(f.hr * 0.95, cy, 5, 0.08, { flare: 0.2, w: 0.5 }));
      P.add('glow', gemRing(5, f.hr * 1.0, cy + 0.015, 0.009, { phase: Math.PI / 5 }));
      const h = f.hands[0];
      P.add('trim', rod(h[0], y0, h[1] + 0.32, h[2], 0.008));
      P.add('trim', ring(0.04, 0, 0.006).rotateX(Math.PI / 2).translate(h[0], h[1] + 0.36, h[2]));
      P.add('glow', star(0.032, 0.012, 4).translate(h[0], h[1] + 0.36, h[2]));
      return turnPiece(P, 0.3);
    },
    b() {
      // a beacon: a white pedestal holding up a tall blue crystal with a gold star in its heart
      const P = new Piece(), y0 = hexBase(P, 0.31, 0.1);
      P.lathe('body', profile(0, y0).line(0.16, y0).curve([[0.12, y0 + 0.12], [0.08, y0 + 0.3], [0.1, y0 + 0.4]]).line(0.13, y0 + 0.42).line(0.12, y0 + 0.45).line(0, y0 + 0.45), { segs: 6 });
      P.add('glow', merge([0, 1, 2, 3, 4, 5].map((i) => new THREE.BoxGeometry(0.012, 0.24, 0.006).translate(0, y0 + 0.2, 0.105).rotateY(i * Math.PI / 3 + Math.PI / 6))));
      P.add('crystal', shard(0.1, 0.56).translate(0, y0 + 0.7, 0).rotateY(Math.PI / 4));
      P.add('steel', around(4, 0.08, y0 + 0.47, () => new THREE.BoxGeometry(0.02, 0.14, 0.02).translate(0, 0.05, 0), { tilt: -0.25, phase: Math.PI / 4 }));
      P.add('trim', star(0.04, 0.014, 5).translate(0, y0 + 0.66, 0.072));
      return P;
    },
    n() {
      // a starfighter with swept delta wings and blue engines, climbing off its stand
      const P = new Piece(), y0 = hexBase(P, 0.322, 0.1);
      P.add('steel', rod(0, y0, y0 + 0.46, -0.02, 0.016));
      const g = starship(P, { len: 0.54, r: 0.064, engines: 0.08, wing: [[0, 0.14], [0.27, -0.18], [0.23, -0.23], [0.05, -0.16], [-0.05, -0.16], [-0.23, -0.23], [-0.27, -0.18]] });
      g.wing.push(merge([-1, 1].map((x) => extrude([[0, 0], [0.06, 0], [0.02, 0.1]], 0.01, 0.003).rotateY(Math.PI / 2).translate(x * 0.22, 0, -0.16))));
      g.glow.push(merge([-1, 1].map((x) => new THREE.BoxGeometry(0.12, 0.004, 0.012).translate(x * 0.12, 0.008, -0.1))));
      placeShip(P, g, y0 + 0.52, 0.45, { hull: 'body', wing: 'body', glow: 'glow', glass: 'glass' });
      P.add('trim', star(0.03, 0.008, 5).rotateX(-Math.PI / 2 - 0.45).translate(0.12, y0 + 0.53, -0.04));
      return turnPiece(P, 0.9);
    },
    r() {
      // a tower of light: a white drum with blue light strips, a gold band and a domed top
      const P = new Piece(), y0 = hexBase(P, 0.335, 0.1);
      P.lathe('body', profile(0, y0).line(0.21, y0).line(0.2, y0 + 0.4).line(0.235, y0 + 0.42).line(0.235, y0 + 0.48).line(0.19, y0 + 0.48).curve([[0.17, y0 + 0.55], [0.1, y0 + 0.6], [0, y0 + 0.62]]));
      P.add('body', battlements(6, 0.19, 0.235, y0 + 0.475, y0 + 0.55, 0.42, 'flat'));
      P.add('glow', merge([0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.BoxGeometry(0.018, 0.28, 0.008).translate(0, y0 + 0.2, 0.205).rotateY(i * Math.PI / 4))));
      P.add('trim', ring(0.212, y0 + 0.05, 0.01));
      P.add('trim', ring(0.2, y0 + 0.37, 0.008));
      P.add('steel', rod(0, y0 + 0.6, y0 + 0.72, 0, 0.006));
      P.add('glow', sphere(0.018, 0, y0 + 0.73, 0, 10));
      P.add('trim', star(0.04, 0.012, 5).translate(0, y0 + 0.28, 0.212));
      return P;
    },
    p() {
      // a space cadet in a round white helmet with a blue visor
      const P = new Piece(), y0 = hexBase(P, 0.27, 0.08);
      const f = person(P, y0, 0.72, { dress: 'legs', bulk: 1.15, hands: [[-0.1, 0.4, 0.05], [0.1, 0.4, 0.05]], noEyes: true });
      P.add('body', sphere(f.hr * 1.35, 0, 0, 0, 22).scale(1, 1.02, 1).translate(f.H[0], f.H[1] + f.hr * 0.12, f.H[2] - f.hr * 0.05));
      P.add('glow', new THREE.SphereGeometry(f.hr * 1.38, 22, 8, Math.PI / 2 - 0.85, 1.7, 1.2, 0.5).translate(f.H[0], f.H[1] + f.hr * 0.12, f.H[2] - f.hr * 0.05));
      P.add('steel', merge([-1, 1].map((x) => new THREE.SphereGeometry(0.045 * f.s, 14, 8, 0, TAU, 0, Math.PI / 2).scale(1.1, 0.7, 1).translate(...f.A(x * 0.1, 0.665, -0.004)))));
      P.add('trim', ring(0.085 * f.s, f.A(0, 0.44, 0)[1], 0.009));
      P.add('trim', star(0.022, 0.008, 5).translate(...f.A(0, 0.55, 0.072)));
      return turnPiece(P, 0.3);
    },
  };
  const GALRED = {
    k() {
      // the Red Warlord: black armour, a red cape and a crested helm crowned with spikes
      const P = new Piece(), y0 = hexBase(P, 0.35, 0.11);
      const f = person(P, y0, 1.24, { dress: 'legs', bulk: 1.15, cape: true, hands: [[-0.1, 0.42, 0.08], [0.1, 0.42, 0.06]], noEyes: true });
      P.add('steel', merge([-1, 1].map((x) => new THREE.SphereGeometry(0.052 * f.s, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1.2, 0.8, 1).translate(...f.A(x * 0.1, 0.67, -0.004)))));
      P.add('steel', new THREE.SphereGeometry(0.1 * f.s, 20, 12, Math.PI / 2 - 1.1, 2.2, 0.5, 1.3).scale(1.1, 1.0, 0.75).translate(...f.A(0, 0.56, 0.02)));
      const hm = helmet(f.H, f.hr * 1.08, { crest: true, tall: 1.15 }); P.add('steel', hm.metal); P.add('cloth2', hm.crest);
      P.add('steel', sphere(f.hr * 1.08, 0, 0, 0, 20).scale(1, 0.75, 0.95).translate(f.H[0], f.H[1] - f.hr * 0.2, f.H[2] + f.hr * 0.06));
      P.add('glow', new THREE.BoxGeometry(f.hr * 1.3, f.hr * 0.16, 0.012).translate(f.H[0], f.H[1] + f.hr * 0.05, f.H[2] + f.hr * 1.0));
      const cy = f.H[1] + f.hr * 0.55;
      P.add('trim', around(5, f.hr * 1.12, cy, (i) => new THREE.ConeGeometry(0.012, i === 2 ? 0.11 : 0.07, 6).translate(0, i === 2 ? 0.055 : 0.035, 0), { phase: -Math.PI / 2 + 0.1, tilt: -0.15 }).rotateY(Math.PI));
      const h = f.hands[0];
      P.add('steel', rod(h[0], y0, h[1] + 0.26, h[2], 0.009));
      P.add('glow', shard(0.02, 0.08).translate(h[0], h[1] + 0.3, h[2]));
      return turnPiece(P, 0.3);
    },
    q() {
      // the Red Commander: a crimson gown, a tall fan collar and a crescent headpiece
      const P = new Piece(), y0 = hexBase(P, 0.33, 0.1);
      const f = person(P, y0, 1.14, { dress: 'gown', gownSlot: 'cloth2', flare: 1.0, frills: 7, hair: 'bun', hands: [[-0.07, 0.42, 0.08], [0.07, 0.42, 0.08]] });
      P.add('steel', new THREE.CylinderGeometry(0.075 * f.s, 0.04 * f.s, 0.12 * f.s, 20, 1, true, Math.PI / 2 + 0.8, TAU - 1.6).translate(...f.A(0, 0.75, -0.015)));
      const cy = f.top - f.hr * 0.2;
      P.add('trim', crescent(f.hr * 1.15, 0.012).translate(0, cy + 0.02, f.H[2] - f.hr * 0.2));
      P.add('glow', sphere(0.014, 0, cy + 0.0, f.H[2] + f.hr * 0.7, 10));
      P.add('glow', merge([0.1, 0.2, 0.3].map((y) => ring(mix(0.16, 0.08, y / 0.42) * f.s, f.A(0, y, 0)[1], 0.004))));
      return turnPiece(P, 0.3);
    },
    b() {
      // a beacon: an angular black pillar holding a jagged red crystal
      const P = new Piece(), y0 = hexBase(P, 0.31, 0.1);
      P.lathe('body', profile(0, y0).line(0.15, y0).line(0.08, y0 + 0.36).line(0.13, y0 + 0.4).line(0.12, y0 + 0.44).line(0, y0 + 0.44), { segs: 4 });
      P.add('glow', merge([0, 1, 2, 3].map((i) => new THREE.BoxGeometry(0.01, 0.26, 0.006).translate(0, y0 + 0.18, 0.083).rotateX(-0.19).rotateY(i * Math.PI / 2 + Math.PI / 4))));
      P.add('crystal', shard(0.09, 0.5).translate(0, y0 + 0.68, 0));
      P.add('crystal', merge([-1, 1].map((x) => shard(0.04, 0.2).rotateZ(-x * 0.5).translate(x * 0.07, y0 + 0.55, 0))));
      P.add('steel', around(4, 0.1, y0 + 0.44, () => new THREE.ConeGeometry(0.02, 0.1, 4).translate(0, 0.05, 0), { tilt: -0.4 }));
      return P;
    },
    n() {
      // an interceptor with forward-swept wings like a crescent, red engines glowing
      const P = new Piece(), y0 = hexBase(P, 0.322, 0.1);
      P.add('steel', rod(0, y0, y0 + 0.46, -0.02, 0.016));
      const g = starship(P, { len: 0.48, r: 0.07, engines: 0.06, wing: [[0.03, -0.14], [0.18, -0.09], [0.28, 0.12], [0.24, 0.14], [0.14, 0.0], [0.05, 0.02], [-0.05, 0.02], [-0.14, 0.0], [-0.24, 0.14], [-0.28, 0.12], [-0.18, -0.09], [-0.03, -0.14]] });
      g.wing.push(merge([-1, 1].map((x) => new THREE.ConeGeometry(0.012, 0.09, 6).rotateX(Math.PI / 2).translate(x * 0.23, 0, 0.16))));
      g.glow.push(merge([-1, 1].map((x) => new THREE.BoxGeometry(0.004, 0.006, 0.1).translate(x * 0.2, 0.008, 0.06).rotateY(x * 0.4))));
      placeShip(P, g, y0 + 0.52, 0.45, { hull: 'body', wing: 'cloth2', glow: 'glow', glass: 'glass' });
      return turnPiece(P, 0.9);
    },
    r() {
      // a black hexagonal tower with red light slits and spikes at every corner
      const P = new Piece(), y0 = hexBase(P, 0.335, 0.1);
      P.lathe('body', profile(0, y0).line(0.22, y0).line(0.19, y0 + 0.4).line(0.24, y0 + 0.43).line(0.24, y0 + 0.5).line(0.19, y0 + 0.5).line(0.19, y0 + 0.48).line(0, y0 + 0.48), { segs: 6 });
      P.add('steel', around(6, 0.23, y0 + 0.5, () => new THREE.ConeGeometry(0.028, 0.1, 4).translate(0, 0.05, 0), { tilt: -0.15 }));
      P.add('glow', merge([0, 1, 2, 3, 4, 5].map((i) => new THREE.BoxGeometry(0.06, 0.012, 0.008).translate(0, y0 + 0.3, 0.17).rotateY(i * Math.PI / 3 + Math.PI / 6))));
      P.add('glow', merge([0, 1, 2, 3, 4, 5].map((i) => new THREE.BoxGeometry(0.012, 0.2, 0.008).translate(0, y0 + 0.14, 0.185).rotateY(i * Math.PI / 3 + Math.PI / 6))));
      P.add('steel', new THREE.ConeGeometry(0.1, 0.16, 6).translate(0, y0 + 0.56, 0));
      P.add('glow', sphere(0.02, 0, y0 + 0.66, 0, 10));
      return P;
    },
    p() {
      // a cadet of the Red Fleet: black armour and an angled helmet with a red eye slit
      const P = new Piece(), y0 = hexBase(P, 0.27, 0.08);
      const f = person(P, y0, 0.72, { dress: 'legs', bulk: 1.15, hands: [[-0.1, 0.4, 0.05], [0.1, 0.4, 0.05]], noEyes: true });
      P.add('body', new THREE.CylinderGeometry(f.hr * 1.1, f.hr * 1.3, f.hr * 2.3, 6).translate(f.H[0], f.H[1] + f.hr * 0.1, f.H[2] - f.hr * 0.05));
      P.add('steel', new THREE.ConeGeometry(f.hr * 1.15, f.hr * 0.7, 6).translate(f.H[0], f.H[1] + f.hr * 1.6, f.H[2] - f.hr * 0.05));
      P.add('glow', new THREE.BoxGeometry(f.hr * 1.4, f.hr * 0.22, 0.01).translate(f.H[0], f.H[1] + f.hr * 0.2, f.H[2] + f.hr * 1.18));
      P.add('steel', merge([-1, 1].map((x) => new THREE.BoxGeometry(0.06 * f.s, 0.03 * f.s, 0.07 * f.s).rotateZ(-x * 0.3).translate(...f.A(x * 0.1, 0.68, 0)))));
      P.add('glow', ring(0.085 * f.s, f.A(0, 0.44, 0)[1], 0.006));
      return turnPiece(P, 0.3);
    },
  };

  // ------------------------------------------------------------------ storybook figures
  // Shared by the four storybook sets (Dino Kingdom, Forest Guardians, Jarls of the Fjord and
  // Runecarved). Their two sides are different characters, so each piece is built with the side
  // it is for (ctx.side) and the geometry is cached per side.
  // A round plinth with a carved band; slot 'base' takes the set's own plinth finish.
  function plinth(P, R, h, o) {
    o = o || {};
    P.lathe('base', profile(0, 0).line(R - 0.012, 0).arc(R, 0.014, 0.3).line(R, 0.036).line(R - 0.014, 0.046).line(R - 0.022, h - 0.014).arc(R - 0.034, h, 0.35).line(0, h), o.mod ? { mod: o.mod } : undefined);
    P.add(o.bandSlot || 'trim', ring(R - 0.003, 0.041, 0.0075));
    return h;
  }
  // Everything added after the plinth (mark = Piece.mark()) scaled up by k from the plinth top.
  Piece.prototype.mark = function () { const m = {}; for (const k of Object.keys(this.parts)) m[k] = this.parts[k].length; return m; };
  function grow(P, mark, y0, k) {
    for (const slot of Object.keys(P.parts)) P.parts[slot].forEach((g, i) => { if (i >= (mark[slot] || 0)) g.translate(0, -y0, 0).scale(k, k, k).translate(0, y0, 0); });
    return P;
  }
  // A standing figure in a long robe, facing +z, on a plinth top at y0 and at scale s.
  //   pose: 'sword' (both hands on a sword's pommel, point down), 'staff' (right hand on a tall
  //   staff), 'clasp' (hands together at the waist), 'shield' (a shield on the left arm, a spear
  //   in the right hand). hair: 'long' | 'braids' | 'short' | 'none'. beard: its length (0 for
  //   none). cloak: a cape down the back. fur: a ring of fur round the shoulders. hood: a hood
  //   over the head. skirt: the robe's radius at the hem. armour: a breastplate shell.
  // Returns the sculpts (skin, robe, hair, cape) still open for more parts, the head and the
  // anchor points; call done() to mesh them.
  function figure(P, y0, s, o) {
    o = o || {};
    const A = at([0, y0, 0], s), r = (v) => v * s;
    // o.coarse: a coarser mesh for the small, many pieces (the pawns), to keep a full board light
    const cs = o.coarse || 1, skin = new Sculpt(0.016, 1.1 * cs), robe = new Sculpt(0.022, 1.3 * cs), hair = new Sculpt(0.014, 1.2 * cs), cape = new Sculpt(0.026, 1.4 * cs);
    robe.floor = y0 - 0.004; cape.floor = y0 - 0.004; hair.floor = y0 - 0.004;
    const sk = o.skirt || 0.15;
    P.lathe('cloth', profile(0, y0).line(r(sk), y0).curve([[r(sk * 0.97), y0 + r(0.06)], [r(sk * 0.78), y0 + r(0.22)], [r(0.084), y0 + r(0.4)], [r(0.07), y0 + r(0.47)]]).line(0, y0 + r(0.47)),
      o.robeMod ? { mod: o.robeMod } : undefined);
    robe.ell(A(0, 0.54, 0.002), [r(0.078), r(0.11), r(0.058)], 0.03);                     // chest
    robe.pair((x) => robe.ell(A(x * 0.076, 0.63, 0), [r(0.038), r(0.034), r(0.038)], 0.025));   // shoulders
    if (o.armour) {
      const c = A(0, 0.56, 0.006);
      const f = (x, y, z) => { const d = SD.ellipsoid(x, y, z, c[0], c[1], c[2], r(0.084), r(0.1), r(0.064)); return Math.max(Math.max(d - r(0.008), -d), c[1] - r(0.075) - y, y - (c[1] + r(0.07)), -z); };
      P.add('trim', sdfGeometry(f, [r(-0.1), c[1] - r(0.09), r(-0.02), r(0.1), c[1] + r(0.09), r(0.09)], Q.cell * 1.2));
    }
    skin.cone(A(0, 0.64, 0), A(0, 0.7, 0.004), r(0.027), r(0.025), 0.01);
    const hd = head(skin, A(0, 0.76, 0.008), r(0.058), { beard: o.beard || 0, moustache: !!o.beard });
    if (o.beard) skin.cone(A(0, 0.7, 0.04), A(0, 0.76 - 0.058 * (1.05 + o.beard), 0.045), r(0.042), r(0.02), 0.02);
    // hair
    if (o.hair && o.hair !== 'none') {
      hair.ell(A(0, 0.775, -0.01), [r(0.062), r(0.064), r(0.06)], 0.012);
      hair.ell(A(0, 0.805, 0.02), [r(0.055), r(0.03), r(0.05)], 0.012);
      if (o.hair === 'long') hair.chain([[0, y0 + r(0.75), r(-0.04), r(0.05)], [0, y0 + r(0.66), r(-0.06), r(0.052)], [0, y0 + r(0.55), r(-0.065), r(0.046)], [0, y0 + r(0.44), r(-0.06), r(0.03)]], 0.02, 4);
      if (o.hair === 'braids') hair.pair((x) => hair.chain([[x * r(0.05), y0 + r(0.76), r(0.0), r(0.02)], [x * r(0.06), y0 + r(0.68), r(0.035), r(0.017)], [x * r(0.055), y0 + r(0.58), r(0.05), r(0.014)], [x * r(0.05), y0 + r(0.5), r(0.05), r(0.01)]], 0.008, 4));
    }
    if (o.cloak) { cape.cone(A(0, 0.65, -0.05), A(0, 0.02, -0.1), r(0.072), r(0.13), 0.03); cape.ell(A(0, 0.4, -0.06), [r(0.1), r(0.3), r(0.05)], 0.04); }
    if (o.hood) {
      robe.ell(A(0, 0.775, -0.006), [r(0.072), r(0.078), r(0.074)], 0.016);
      robe.cone(A(0, 0.8, -0.04), A(0, 0.79, -0.1), r(0.05), r(0.012), 0.02);
      robe.ell(A(0, 0.75, 0.062), [r(0.05), r(0.07), r(0.05)], 0.008, true);            // the face shows
      robe.cone(A(0, 0.7, -0.03), A(0, 0.6, -0.06), r(0.07), r(0.085), 0.03);           // falling to the shoulders
    }
    // arms
    let hands;
    const R = 0.022;
    if (o.pose === 'sword') {
      hands = [A(-0.022, 0.475, 0.1), A(0.022, 0.475, 0.1)];
      arm(robe, skin, A(-0.076, 0.62, 0), A(-0.105, 0.52, 0.045), hands[0], r(R));
      arm(robe, skin, A(0.076, 0.62, 0), A(0.105, 0.52, 0.045), hands[1], r(R));
    } else if (o.pose === 'staff') {
      hands = [A(-0.02, 0.45, 0.08), A(0.125, 0.56, 0.075)];
      arm(robe, skin, A(-0.076, 0.62, 0), A(-0.092, 0.5, 0.04), hands[0], r(R));
      arm(robe, skin, A(0.076, 0.62, 0), A(0.13, 0.52, 0.02), hands[1], r(R));
    } else if (o.pose === 'shield') {
      hands = [A(-0.085, 0.44, 0.075), A(0.105, 0.5, 0.07)];
      arm(robe, skin, A(-0.076, 0.62, 0), A(-0.11, 0.5, 0.03), hands[0], r(R));
      arm(robe, skin, A(0.076, 0.62, 0), A(0.12, 0.5, 0.02), hands[1], r(R));
    } else {
      hands = [A(-0.018, 0.45, 0.08), A(0.018, 0.45, 0.08)];
      arm(robe, skin, A(-0.076, 0.62, 0), A(-0.092, 0.5, 0.04), hands[0], r(R));
      arm(robe, skin, A(0.076, 0.62, 0), A(0.092, 0.5, 0.04), hands[1], r(R));
    }
    if (o.fur) P.add('fur', around(14, r(0.074), y0 + r(0.655), (i) => sphere(r(0.02 + (i % 3) * 0.003), 0, 0, 0, 7)));
    const top = y0 + r(0.76 + 0.058);
    return {
      A, r, skin, robe, hair, cape, hd, hands, top, s, y0,
      done() {
        P.add('body', skin.mesh()); P.add('cloth', robe.mesh()); P.add('hair', hair.mesh()); P.add('cape', cape.mesh()); eyes(P, hd);
        return P;
      },
    };
  }
  // A sword standing point down, its pommel held at p (two hands on it).
  function swordDown(P, p, len, w) {
    const sw = sword(len, w);
    for (const g of [sw.blade, sw.hilt]) { g.rotateZ(Math.PI); g.translate(p[0], p[1] + 0.012, p[2]); }
    P.add('steel', sw.blade); P.add('trim', sw.hilt);
  }
  // A tall staff from the plinth top up through the hand at h, with its head at the top.
  function staffAt(P, h, y0, len, rad, slot) {
    P.add(slot || 'trim', new THREE.CylinderGeometry(rad, rad * 1.1, len, 8).translate(h[0], y0 + len / 2, h[2]));
    return [h[0], y0 + len, h[2]];
  }
  // A long thin tapering curve (a horn, a claw, an antler tine) through points.
  const horn = (pts, r0, r1) => K.tube(pts, r0, { segs: 14, radial: 7, radiusAt: (t) => mix(1, r1 / r0, t) });
  // Antlers growing up and out from (x, y, z): a main beam with tines, on both sides.
  function antlers(c, size, o) {
    o = o || {};
    const parts = [];
    for (const sd of [-1, 1]) {
      const b = (u, v, w) => [c[0] + sd * u * size, c[1] + v * size, c[2] + w * size];
      const beam = [b(0.2, 0, 0), b(0.5, 0.35, -0.1), b(0.75, 0.75, -0.15), b(0.85, 1.15, -0.05), b(0.8, 1.45, 0.05)];
      parts.push(horn(beam, size * 0.07, size * 0.025));
      for (const [i, du, dv, dw] of [[1, 0.1, 0.35, 0.25], [2, 0.25, 0.3, 0.2], [2, -0.2, 0.35, 0.1], [3, 0.2, 0.3, 0.1], [3, -0.25, 0.25, -0.05]].slice(0, o.tines || 5)) {
        const p0 = beam[i], p1 = [p0[0] + sd * du * size, p0[1] + dv * size, p0[2] + dw * size];
        parts.push(horn([p0, [mix(p0[0], p1[0], 0.5), mix(p0[1], p1[1], 0.6), mix(p0[2], p1[2], 0.5)], p1], size * 0.045, size * 0.015));
      }
    }
    return merge(parts);
  }
  // A banner on a pole: a cloth hanging from a crossbar, with a swallowtail foot.
  function banner(P, x, y, z, w, h, ry, slot) {
    const flag = extrude([[-w / 2, 0], [w / 2, 0], [w / 2, -h], [0, -h * 0.82], [-w / 2, -h]], 0.006, 0.002, { bevelSegments: 1 });
    flag.rotateY(ry || 0); flag.translate(x, y, z);
    P.add(slot || 'cloth', flag);
    const bar = new THREE.CylinderGeometry(0.005, 0.005, w * 1.2, 6).rotateZ(Math.PI / 2); bar.rotateY(ry || 0); bar.translate(x, y + 0.006, z);
    P.add('trim', bar);
  }

  // ------------------------------------------------------------------ Dino Kingdom
  // From the user's picture of a dinosaur set beside a volcano: white is carved fossil bone
  // with amber, black is dark lava stone with glowing cracks. A crowned T. rex king, a crested
  // queen, amber crystal bishops, a triceratops and a raptor for the knights, castle towers,
  // and eggs for pawns: a baby hatching on the light side, amber eggs held in claws on the dark.
  const fernBand = (r, y, n, size) => around(n, r, y, (i) => { const g = leaf(size * 0.5, size, size * 0.12); g.rotateZ(i % 2 ? 0.25 : -0.25); return g; }, { phase: 0.2 });
  function teeth(n, a, b, size, down) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, p = [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
      for (const sd of [-1, 1]) { const c = new THREE.ConeGeometry(size * 0.45, size, 5); if (down) c.rotateX(Math.PI); c.translate(p[0] + sd * size * 0.0, p[1] - (down ? size / 2 : -size / 2), p[2]); c.translate(sd * (a[3] || 0) * (1 - t * 0.4), 0, 0); out.push(c); }
    }
    return merge(out);
  }
  const DINO = {
    k(ctx) {
      // a crowned tyrant lizard king, standing tall in a cape, roaring
      const P = new Piece(), y0 = plinth(P, 0.34, 0.1), Y = y0, mark = P.mark();
      const S = new Sculpt(0.03, 1.2), cape = new Sculpt(0.03, 1.3);
      S.floor = y0 - 0.004;
      S.cone([0, Y + 0.3, -0.1], [0, Y + 0.55, 0.07], 0.145, 0.09, 0.05);                       // a big body, leaning forward
      S.ell([0, Y + 0.42, 0.03], [0.11, 0.13, 0.11], 0.05);                                     // belly
      S.pair((x) => {
        S.ell([x * 0.1, Y + 0.27, -0.02], [0.07, 0.11, 0.1], 0.03);                              // thighs
        S.cone([x * 0.105, Y + 0.2, -0.06], [x * 0.105, Y + 0.035, 0.0], 0.045, 0.034, 0.02);    // shins
        S.ell([x * 0.105, Y + 0.024, 0.055], [0.048, 0.026, 0.085], 0.015);                      // feet
        S.cone([x * 0.1, Y + 0.52, 0.11], [x * 0.11, Y + 0.46, 0.165], 0.024, 0.016, 0.012);     // little arms
      });
      S.chain([[0, Y + 0.3, -0.16, 0.095], [0.03, Y + 0.24, -0.27, 0.068], [0.1, Y + 0.17, -0.34, 0.045], [0.19, Y + 0.12, -0.35, 0.026], [0.25, Y + 0.1, -0.3, 0.012]], 0.03, 4);   // a long tail sweeping out behind
      S.cone([0, Y + 0.52, 0.05], [0, Y + 0.64, 0.13], 0.1, 0.085, 0.04);                        // a thick neck
      S.ell([0, Y + 0.71, 0.17], [0.1, 0.086, 0.135], 0.03);                                    // a big skull
      S.cone([0, Y + 0.72, 0.21], [0, Y + 0.7, 0.37], 0.078, 0.056, 0.025);                      // a long upper jaw
      S.cone([0, Y + 0.635, 0.16], [0, Y + 0.585, 0.32], 0.064, 0.04, 0.02);                    // lower jaw, wide open
      S.ell([0, Y + 0.655, 0.29], [0.06, 0.04, 0.1], 0.01, true);                               // the open mouth
      S.pair((x) => S.ell([x * 0.066, Y + 0.775, 0.215], [0.026, 0.018, 0.045], 0.012));            // brows
      const sf = S.field();
      P.add('body', S.mesh());
      P.add('eye', merge([-1, 1].map((x) => sphere(0.017, x * 0.08, Y + 0.75, 0.23, 10))));
      P.add('mouth', sdfGeometry((x, y, z) => SD.ellipsoid(x, y, z, 0, Y + 0.655, 0.26, 0.044, 0.03, 0.07), [-0.05, Y + 0.615, 0.18, 0.05, Y + 0.695, 0.34], Q.cell));
      P.add('tooth', merge([teeth(6, [0, Y + 0.683, 0.21, 0.056], [0, Y + 0.678, 0.34], 0.02, true), teeth(5, [0, Y + 0.618, 0.2, 0.046], [0, Y + 0.6, 0.29], 0.016, false)]));
      P.add('tooth', merge([-1, 1].flatMap((x) => [0, 1, 2].map((i) => horn([[x * 0.11, Y + 0.014, 0.12 + i * 0.006], [x * (0.09 + i * 0.016), Y + 0.016, 0.155], [x * (0.085 + i * 0.022), Y + 0.004, 0.172]], 0.009, 0.002)))));   // toe claws
      // a royal cape over his back, with a collar of claws and an amber pendant
      P.add('cape', sdfGeometry(drape(sf, 0.016, (x, y, z) => Math.max(z + 0.01, Y + 0.1 - y, y - (Y + 0.63), Math.abs(x) - 0.17)), [-0.19, Y + 0.08, -0.22, 0.19, Y + 0.67, 0.05], Q.cell * 1.3));
      P.add('tooth', around(11, 0.1, Y + 0.57, () => { const c = new THREE.ConeGeometry(0.011, 0.05, 5); c.rotateX(Math.PI); return c; }, { phase: -Math.PI * 0.45, tilt: 0.4 }).translate(0, 0, 0.03));
      P.add('accent', placeAt(cabochon(0.03, 0.7), 0, 0.17, Y + 0.5));
      P.add('trim', ring(0.12, Y + 0.55, 0.008).translate(0, 0, 0.04));
      // a spiked crown on his head
      const cr = pointedCrown(0.06, Y + 0.77, 7, 0.08, { flare: 0.25, w: 0.6 }); cr.translate(0, 0, 0.15); P.add('trim', cr);
      P.add('accent', gemRing(7, 0.066, Y + 0.79, 0.008).translate(0, 0, 0.15));
      grow(P, mark, y0, 1.22);
      if (ctx.side === 'w') P.add('leaf', fernBand(0.318, 0.072, 12, 0.05));
      else P.add('lava', ring(0.32, 0.075, 0.006));
      return turnPiece(P, 0.6);
    },
    q(ctx) {
      // a crested duck-billed queen in a gown, her crest swept back and a fan of plumes behind it
      const P = new Piece(), y0 = plinth(P, 0.33, 0.1), Y = y0, mark = P.mark();
      const S = new Sculpt(0.022), gown = new Sculpt(0.025, 1.2);
      gown.floor = y0 - 0.004;
      P.lathe('cloth', profile(0, Y).line(0.16, Y).curve([[0.158, Y + 0.06], [0.13, Y + 0.22], [0.088, Y + 0.38], [0.066, Y + 0.45]]).line(0, Y + 0.45), { mod: MOD.flutes(14, 0.1, Y + 0.01, Y + 0.4, { soft: true, end: 0.03 }) });
      gown.ell([0, Y + 0.5, 0.0], [0.07, 0.1, 0.056], 0.03);
      gown.pair((x) => gown.ell([x * 0.065, Y + 0.57, 0], [0.032, 0.03, 0.032], 0.025));
      S.chain([[0, Y + 0.56, 0.005, 0.048], [0, Y + 0.66, 0.02, 0.04], [0, Y + 0.76, 0.03, 0.034], [0, Y + 0.82, 0.035, 0.032]], 0.02, 4);   // a long neck
      S.ell([0, Y + 0.86, 0.06], [0.044, 0.042, 0.068], 0.02);                                    // head
      S.cone([0, Y + 0.85, 0.09], [0, Y + 0.82, 0.16], 0.03, 0.026, 0.015);                     // the duck bill
      S.ell([0, Y + 0.815, 0.165], [0.03, 0.014, 0.026], 0.01);
      S.chain([[0.02, Y + 0.1, -0.13, 0.03], [0.09, Y + 0.04, -0.17, 0.022], [0.16, Y + 0.03, -0.12, 0.012]], 0.02, 3);   // tail from under the gown
      arm(gown, S, [-0.065, Y + 0.56, 0], [-0.085, Y + 0.47, 0.04], [-0.016, Y + 0.44, 0.075], 0.019);
      arm(gown, S, [0.065, Y + 0.56, 0], [0.085, Y + 0.47, 0.04], [0.016, Y + 0.44, 0.075], 0.019);
      P.add('body', S.mesh()); P.add('cloth', gown.mesh());
      P.add('eye', merge([-1, 1].map((x) => sphere(0.01, x * 0.038, Y + 0.875, 0.09, 10))));
      // the long tube crest
      P.add('crest', horn([[0, Y + 0.885, 0.05], [0, Y + 0.93, 0.0], [0, Y + 0.96, -0.07], [0, Y + 0.965, -0.13]], 0.02, 0.012));
      // a fan of plumes behind the crest
      P.add('crest', merge([-3, -2, -1, 0, 1, 2, 3].map((i) => { const f = petal(0.035, 0.13, 0.008); f.rotateZ(i * 0.32); f.translate(0, Y + 0.88, -0.02); return f; })));
      // an amber held at her heart, a necklace and a little coronet
      P.add('accent', sphere(0.024, 0, Y + 0.455, 0.1, 16));
      P.add('trim', around(14, 0.05, Y + 0.585, () => sphere(0.008, 0, 0, 0, 8)).translate(0, 0, 0.008));
      P.add('accent', placeAt(cabochon(0.016, 0.7), 0, 0.058, Y + 0.56));
      const cr = pointedCrown(0.04, Y + 0.895, 6, 0.055, { flare: 0.2, w: 0.6 }); cr.translate(0, 0, 0.055); P.add('trim', cr);
      P.add('trim', ring(0.158, Y + 0.03, 0.008));
      grow(P, mark, y0, 1.25);
      if (ctx.side === 'w') P.add('leaf', fernBand(0.308, 0.072, 12, 0.05));
      else P.add('lava', ring(0.31, 0.075, 0.006));
      return turnPiece(P, 0.4);
    },
    b(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.31, 0.09), Y = y0;
      if (ctx.side === 'w') {
        // a six-sided amber crystal standing in a cup of bone claws, an ammonite inside it
        P.lathe('base', profile(0, Y).line(0.15, Y).curve([[0.12, Y + 0.08], [0.11, Y + 0.16]]).line(0.135, Y + 0.19).line(0.135, Y + 0.21).line(0, Y + 0.21));
        P.lathe('crystal', profile(0, Y + 0.18).line(0.105, Y + 0.18).line(0.1, Y + 0.6).line(0.0, Y + 0.86), { mod: MOD.facets(6, Y + 0.15, Y + 0.9, 1), segs: 48 });
        P.add('tooth', around(6, 0.13, Y + 0.2, () => horn([[0, 0, 0], [0, 0.07, 0.03], [0, 0.13, 0.0]], 0.022, 0.004), { phase: Math.PI / 6 }));
        P.add('trim', placeAt(ammonite(0.1), 0, 0.106, Y + 0.42));
        P.add('leaf', fernBand(0.288, 0.066, 11, 0.046));
      } else {
        // a dark obelisk with an amber window and an ammonite, ringed by claws pointing up
        P.lathe('body', profile(0, Y).line(0.15, Y).line(0.13, Y + 0.08).line(0.12, Y + 0.09).line(0.1, Y + 0.6).line(0, Y + 0.84), { mod: MOD.facets(4, Y + 0.08, Y + 0.9, 1), segs: 48 });
        P.add('tooth', around(8, 0.115, Y + 0.12, () => horn([[0, 0, 0], [0, 0.08, 0.035], [0, 0.16, 0.02]], 0.02, 0.004)));
        P.add('trim', placeAt(ammonite(0.09), Math.PI / 4, 0.09, Y + 0.38));
        P.add('lava', placeAt(new THREE.OctahedronGeometry(0.035, 0).scale(0.8, 1.4, 0.5), Math.PI / 4, 0.06, Y + 0.68));
        P.add('lava', ring(0.288, 0.07, 0.006));
      }
      return P;
    },
    n(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.322, 0.09), Y = y0;
      const rock = new Sculpt(0.04, 1.4), S = new Sculpt(0.024, 1.15);
      rock.floor = y0 - 0.004; S.floor = y0 - 0.004;
      if (ctx.side === 'w') {
        // a triceratops standing on a fern-covered rock
        rock.ell([0, Y + 0.03, 0.0], [0.2, 0.07, 0.22]); rock.ell([0.05, Y + 0.06, -0.06], [0.1, 0.06, 0.1]);
        const B = Y + 0.07;
        S.ell([0, B + 0.2, -0.03], [0.1, 0.095, 0.16], 0.04);                                    // body
        S.ell([0, B + 0.24, -0.1], [0.095, 0.09, 0.09], 0.04);                                   // hips
        S.pair((x) => {
          S.cone([x * 0.07, B + 0.17, 0.07], [x * 0.075, B + 0.0, 0.08], 0.034, 0.03, 0.02);
          S.cone([x * 0.075, B + 0.19, -0.13], [x * 0.08, B + 0.0, -0.13], 0.04, 0.032, 0.02);
        });
        S.chain([[0, B + 0.22, -0.19, 0.045], [0.02, B + 0.15, -0.26, 0.03], [0.05, B + 0.05, -0.28, 0.016]], 0.02, 3);
        S.ell([0, B + 0.26, 0.15], [0.065, 0.065, 0.075], 0.03);                                // head
        S.cone([0, B + 0.25, 0.18], [0, B + 0.2, 0.27], 0.05, 0.022, 0.02);                      // face to the beak
        const sf = S.field();
        P.add('body', S.mesh());
        // the great frill behind the head, scalloped, with knobs round its edge
        const fr = new THREE.CircleGeometry(0.13, 28, 0, Math.PI); fr.rotateX(-0.5); fr.translate(0, B + 0.3, 0.1);
        const back = fr.clone(); { const idx = back.index.array; for (let i = 0; i < idx.length; i += 3) { const t = idx[i]; idx[i] = idx[i + 2]; idx[i + 2] = t; } back.translate(0, 0, -0.006); }
        P.add('body', merge([fr, back]));
        const knobs = []; for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI, p = new THREE.Vector3(Math.cos(a) * 0.13, Math.sin(a) * 0.13, 0); p.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.5); knobs.push(sphere(0.016, p.x, p.y + B + 0.3, p.z + 0.1, 8)); }
        P.add('trim', merge(knobs));
        // three horns: two long brow horns and one on the nose, and a beak
        P.add('tooth', merge([-1, 1].map((x) => horn([[x * 0.035, B + 0.3, 0.17], [x * 0.045, B + 0.36, 0.23], [x * 0.04, B + 0.39, 0.3]], 0.014, 0.003))
          .concat([horn([[0, B + 0.24, 0.23], [0, B + 0.27, 0.26], [0, B + 0.29, 0.27]], 0.01, 0.002), horn([[0, B + 0.21, 0.25], [0, B + 0.19, 0.285], [0, B + 0.165, 0.29]], 0.016, 0.004)])));
        P.add('eye', merge([-1, 1].map((x) => sphere(0.011, x * 0.055, B + 0.28, 0.18, 10))));
        P.add('cloth', sdfGeometry(drape(sf, 0.012, (x, y, z) => Math.max(B + 0.21 - y, Math.abs(z + 0.04) - 0.08)), [-0.13, B + 0.18, -0.14, 0.13, B + 0.32, 0.07], Q.cell * 1.3));
        P.add('accent', placeAt(cabochon(0.014, 0.6), 0, 0.0, 0).rotateX(-Math.PI / 2).translate(0, B + 0.31, -0.04));
        P.add('base', rock.mesh());
        P.add('leaf', merge([[-0.13, 0.12], [0.14, 0.1], [0.1, -0.16]].map(([x, z], i) => { const g = curl(leaf(0.05, 0.11, 0.006), 2); g.rotateY(Math.atan2(x, z)); g.rotateX(0.3); g.translate(x, Y + 0.05, z); return g; })));
        return turnPiece(P, 0.15);
      }
      // a raptor on a rock, one foot up, tail out behind and a crest of red quills
      rock.ell([0, Y + 0.06, 0.0], [0.19, 0.1, 0.2]); rock.ell([0.02, Y + 0.14, 0.08], [0.09, 0.09, 0.08]);
      const B = Y + 0.1;
      S.cone([0, B + 0.3, -0.06], [0, B + 0.4, 0.08], 0.075, 0.055, 0.03);                      // body, leaning forward
      S.pair((x) => S.ell([x * 0.05, B + 0.27, -0.05], [0.04, 0.075, 0.065], 0.025));             // thighs
      S.chain([[0.05, B + 0.24, -0.06, 0.03], [0.055, B + 0.13, -0.1, 0.022], [0.05, B + 0.03, -0.06, 0.017], [0.05, B + 0.0, 0.0, 0.016]], 0.014, 3);   // standing leg
      S.chain([[-0.05, B + 0.24, -0.04, 0.03], [-0.055, B + 0.16, 0.02, 0.022], [-0.05, B + 0.12, 0.06, 0.017], [-0.05, B + 0.105, 0.11, 0.015]], 0.014, 3);   // the foot up on the rock
      S.chain([[0, B + 0.32, -0.12, 0.05], [0, B + 0.34, -0.22, 0.035], [0.02, B + 0.33, -0.31, 0.02], [0.05, B + 0.3, -0.37, 0.01]], 0.02, 4);   // tail
      S.chain([[0, B + 0.4, 0.08, 0.042], [0, B + 0.49, 0.1, 0.034], [0, B + 0.56, 0.11, 0.03]], 0.02, 3);   // neck
      S.ell([0, B + 0.59, 0.14], [0.038, 0.04, 0.06], 0.02);                                       // head
      S.cone([0, B + 0.59, 0.16], [0, B + 0.575, 0.23], 0.03, 0.02, 0.012);                      // snout
      S.cone([0, B + 0.555, 0.15], [0, B + 0.53, 0.21], 0.022, 0.014, 0.01);                     // jaw
      S.ell([0, B + 0.555, 0.215], [0.026, 0.012, 0.05], 0.008, true);
      S.pair((x) => S.chain([[x * 0.05, B + 0.42, 0.08, 0.016], [x * 0.07, B + 0.36, 0.13, 0.013], [x * 0.06, B + 0.35, 0.17, 0.011]], 0.01, 3));   // arms
      P.add('body', S.mesh()); P.add('base', rock.mesh());
      P.add('eye', merge([-1, 1].map((x) => sphere(0.009, x * 0.033, B + 0.605, 0.17, 10))));
      P.add('tooth', merge([teeth(4, [0, B + 0.57, 0.17, 0.022], [0, B + 0.565, 0.225], 0.01, true), ...[-1, 1].map((x) => horn([[x * 0.06, B + 0.35, 0.17], [x * 0.062, B + 0.33, 0.19], [x * 0.06, B + 0.31, 0.19]], 0.006, 0.0015)),
        ...[-1, 1].map((x) => horn([[x * 0.05, B + 0.12, 0.1], [x * 0.05, B + 0.15, 0.13], [x * 0.05, B + 0.13, 0.15]], 0.007, 0.002))]));
      P.add('crest', merge([0, 1, 2, 3, 4, 5, 6].map((i) => { const c = new THREE.ConeGeometry(0.012, 0.075 - i * 0.006, 5); c.rotateX(-1.0 - i * 0.12); c.translate(0, B + 0.62 - i * 0.02, 0.12 - i * 0.03); return c; })));
      P.add('lava', ring(0.3, 0.07, 0.006));
      return turnPiece(P, 0.15);
    },
    r(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.322, 0.09), Y = y0;
      const p = profile(0, Y).line(0.24, Y).curve([[0.215, Y + 0.12], [0.205, Y + 0.32], [0.215, Y + 0.52]]).line(0.25, Y + 0.54).line(0.25, Y + 0.6).line(0.2, Y + 0.6).line(0.2, Y + 0.58).line(0, Y + 0.58);
      if (ctx.side === 'w') {
        // a castle of fossil stone with an arched door, amber windows and a band of ferns
        P.lathe('body', p, { mod: MOD.facets(10, Y + 0.02, Y + 0.6, 0.18) });
        P.add('body', battlements(6, 0.2, 0.25, Y + 0.595, Y + 0.72, 0.4, 'flat'));
        P.add('eye', placeAt(new THREE.CircleGeometry(0.06, 20, 0, Math.PI).translate(0, 0, 0).scale(1, 1.4, 1), 0, 0.212, Y + 0.12).translate(0, 0, 0));
        P.add('eye', placeAt(new THREE.PlaneGeometry(0.12, 0.12), 0, 0.212, Y + 0.06));
        P.add('trim', placeAt(K.tube(Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * 0.066, Math.sin(a) * 0.088 + 0.12, 0]; }), 0.008, { segs: 20, radial: 6 }), 0, 0.214, Y));
        P.add('accent', around(4, 0.212, Y + 0.38, () => new THREE.BoxGeometry(0.03, 0.06, 0.012), { phase: Math.PI / 4 }));
        P.add('leaf', fernBand(0.222, Y + 0.25, 10, 0.06));
        P.add('leaf', fernBand(0.3, 0.066, 11, 0.046));
      } else {
        // a tower of dark lava stone with glowing cracks and a red banner with a footprint
        P.lathe('body', p, { mod: MOD.facets(9, Y + 0.02, Y + 0.6, 0.25) });
        P.add('body', battlements(5, 0.2, 0.25, Y + 0.595, Y + 0.73, 0.38, 'point'));
        const cracks = [];
        for (let i = 0; i < 7; i++) { const th = i * 0.9 + 0.3, y = Y + 0.08 + (i * 0.37 % 1) * 0.42; cracks.push(placeAt(K.tube([[0, 0, 0], [0.02, 0.03, 0], [0.0, 0.06, 0], [0.025, 0.1, 0]], 0.005, { segs: 8, radial: 4 }), th, 0.215, y)); }
        P.add('lava', merge(cracks));
        P.add('lava', ring(0.3, 0.07, 0.006));
        banner(P, 0, Y + 0.48, 0.225, 0.13, 0.26, 0, 'cloth');
        P.add('trim', merge([0, 1, 2].map((i) => { const t = new THREE.ConeGeometry(0.012, 0.06, 5); t.rotateZ((i - 1) * 0.45); t.translate((i - 1) * 0.022, Y + 0.36, 0.232); return t; }).concat([sphere(0.024, 0, Y + 0.32, 0.23, 10).scale(1, 0.8, 0.4)])));
      }
      return P;
    },
    p(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.27, 0.08), Y = y0;
      if (ctx.side === 'w') {
        // a baby dinosaur hatching, its egg cracked open round it
        const p = profile(0, Y).line(0.07, Y).curve([[0.12, Y + 0.04], [0.135, Y + 0.12], [0.13, Y + 0.2]]).line(0.122, Y + 0.2).curve([[0.122, Y + 0.12], [0.11, Y + 0.05], [0, Y + 0.03]]);
        P.lathe('egg', p);
        P.add('egg', around(9, 0.126, Y + 0.2, (i) => { const g = new THREE.ConeGeometry(0.03, 0.05 + (i % 3) * 0.02, 3); g.scale(1, 1, 0.25); g.translate(0, 0.02, 0); return g; }));
        const S = new Sculpt(0.018);
        S.chain([[0, Y + 0.12, 0, 0.07], [0, Y + 0.24, 0.01, 0.05], [0, Y + 0.31, 0.02, 0.04]], 0.03, 3);
        S.ell([0, Y + 0.35, 0.04], [0.06, 0.055, 0.065], 0.02);                                  // a big baby head
        S.cone([0, Y + 0.34, 0.07], [0, Y + 0.32, 0.12], 0.04, 0.03, 0.015);
        S.pair((x) => S.chain([[x * 0.045, Y + 0.23, 0.04, 0.016], [x * 0.08, Y + 0.22, 0.08, 0.012], [x * 0.1, Y + 0.21, 0.1, 0.011]], 0.01, 3));
        P.add('body', S.mesh());
        P.add('eye', merge([-1, 1].map((x) => sphere(0.014, x * 0.04, Y + 0.37, 0.085, 10))));
        P.add('accent', around(5, 0.13, Y + 0.12, () => cabochon(0.012, 0.6), { phase: 0.3 }));
        P.add('leaf', fernBand(0.248, 0.062, 10, 0.04));
        return turnPiece(P, 0.4);
      }
      // an amber egg held in three bone claws
      P.lathe('body', profile(0, Y).line(0.12, Y).curve([[0.1, Y + 0.04], [0.07, Y + 0.07]]).line(0, Y + 0.07));
      P.lathe('egg', ovalHead(profile(0, Y + 0.05).line(0.05, Y + 0.05), 0.05, Y + 0.2, 0.1, 0.14, 0.15));
      P.add('tooth', around(3, 0.095, Y + 0.04, () => horn([[0, 0, 0], [0, 0.1, 0.03], [0, 0.2, -0.0], [0, 0.24, -0.04]], 0.024, 0.005), { phase: Math.PI / 3 }));
      P.add('lava', ring(0.25, 0.062, 0.005));
      return P;
    },
  };
  // An ammonite shell, facing +z: a flat spiral of ribbed coils.
  function ammonite(size) {
    const pts = [];
    for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 2.4, r = size * 0.08 + size * 0.42 * t; pts.push([Math.cos(a) * r, Math.sin(a) * r, 0]); }
    const coil = K.tube(pts, size * 0.06, { segs: 90, radial: 8, radiusAt: (t) => mix(0.6, 2.2, t) });
    const disc = new THREE.CylinderGeometry(size * 0.48, size * 0.48, size * 0.06, 28).rotateX(Math.PI / 2).translate(0, 0, -size * 0.04);
    return merge([coil, disc]);
  }

  // ------------------------------------------------------------------ Forest Guardians
  // From the user's pictures of an enchanted forest set: white are the elves of the glade in
  // ivory and gold with green cloaks and glowing blue gems; black are the forest folk, carved
  // in bark and moss with glowing green eyes: an antlered Oak King, a dryad queen, druids, a
  // friendly moss bear, a hollow tree tower and little moss sprites for pawns.
  function elfEars(f) {
    const { hd, skin } = f, c = hd.c, r = hd.r;
    skin.pair((x) => skin.cone([c[0] + x * r * 0.85, c[1] - r * 0.02, c[2] - r * 0.05], [c[0] + x * r * 1.32, c[1] + r * 0.45, c[2] - r * 0.3], r * 0.13, r * 0.03, 0.008));
  }
  // a little star flower facing +z
  const flower = (size) => merge([0, 1, 2, 3, 4].map((i) => { const g = petal(size * 0.6, size, size * 0.2); g.rotateZ(i * TAU / 5); return g; }));
  function flowersOn(field, box, n, size, seed) {
    // little flowers scattered on the surface of a sculpt, found by stepping in from outside
    const R = rng(seed || 3), out = [];
    for (let i = 0; i < n * 6 && out.length < n; i++) {
      const x = mix(box[0], box[3], R()), y = mix(box[1], box[4], R()), dir = R() < 0.5 ? 1 : -1;
      let z = dir * 0.4; while (Math.abs(z) > 0 && field(x, y, z) > 0) z -= dir * 0.004;
      if (Math.abs(z) < 0.004) continue;
      const g = flower(size); if (dir < 0) g.rotateY(Math.PI); g.translate(x, y, z + dir * 0.004); out.push(g);
    }
    return out.length ? merge(out) : null;
  }
  const FOREST = {
    k(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.34, 0.1);
      if (ctx.side === 'w') {
        // the elf king: armour, a green cloak, a great sword held point down, a crown of leaves
        const f = figure(P, y0, 1.42, { pose: 'sword', hair: 'long', cloak: true, skirt: 0.155 });
        elfEars(f); f.done();
        swordDown(P, [0, f.hands[0][1], f.hands[0][2]], 0.4 * f.s, 0.028 * f.s);
        P.add('trim', merge([f.A(0, 0.615, 0.03)].map((p) => around(2, 0.09 * f.s, p[1], () => cabochon(0.034 * f.s, 0.5), { phase: Math.PI / 2 }))));   // shoulder guards
        const cy = f.top - 0.018;
        P.add('trim', around(9, 0.06 * f.s, cy, () => { const g = leaf(0.032, 0.075, 0.006); return g; }, { tilt: -0.25 }).translate(0, 0, 0.008 * f.s));
        P.add('trim', ring(0.06 * f.s, cy, 0.006).translate(0, 0, 0.008 * f.s));
        P.add('accent', placeAt(brilliant(0.014), 0, 0.068 * f.s, cy + 0.025));
        P.add('accent', placeAt(cabochon(0.02, 0.6), 0, 0.075 * f.s, y0 + 0.57 * f.s));
        return turnPiece(P, 0.3);
      }
      // the Oak King: a bearded tree-giant with great antlers, a mossy cloak and a glowing staff
      const f = figure(P, y0, 1.44, { pose: 'staff', beard: 0.9, hair: 'short', cloak: true, fur: true, skirt: 0.16 });
      f.done();
      const top = staffAt(P, f.hands[1], y0, 0.86 * f.s, 0.012, 'base');
      P.add('base', horn([[top[0], top[1], top[2]], [top[0] - 0.03, top[1] + 0.06, top[2] + 0.02], [top[0] + 0.01, top[1] + 0.12, top[2]]], 0.012, 0.004));
      P.add('base', horn([[top[0], top[1], top[2]], [top[0] + 0.04, top[1] + 0.05, top[2] - 0.01], [top[0] + 0.02, top[1] + 0.11, top[2]]], 0.01, 0.004));
      P.add('accent', new THREE.OctahedronGeometry(0.03, 0).scale(1, 1.5, 1).translate(top[0], top[1] + 0.06, top[2]));
      P.add('base', antlers([0, f.top - 0.03, -0.01], 0.16));
      P.add('accent', placeAt(cabochon(0.022, 0.6), 0, 0.074 * f.s, y0 + 0.57 * f.s));
      return turnPiece(P, 0.35);
    },
    q(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.33, 0.1);
      if (ctx.side === 'w') {
        // the elf queen: long golden hair, a flowing gown and a circlet with a star of light
        const f = figure(P, y0, 1.34, { pose: 'clasp', hair: 'long', skirt: 0.165, robeMod: MOD.flutes(16, 0.12, y0 + 0.01, y0 + 0.45, { soft: true, end: 0.03 }) });
        elfEars(f); f.done();
        const cy = f.top - 0.022;
        P.add('trim', ring(0.062 * f.s, cy, 0.006).translate(0, 0, 0.006));
        P.add('accent', placeAt(new THREE.OctahedronGeometry(0.018, 0).scale(0.8, 1.4, 0.6), 0, 0.072 * f.s, cy + 0.02));
        P.add('accent', placeAt(flower(0.03), 0, 0.09 * f.s, f.hands[0][1] + 0.02));
        P.add('trim', ring(0.165 * f.s, y0 + 0.03, 0.008));
        P.add('trim', around(14, 0.05 * f.s, y0 + 0.64 * f.s, () => sphere(0.007, 0, 0, 0, 8)).translate(0, 0, 0.01));
        return turnPiece(P, 0.4);
      }
      // the dryad queen: leafy hair, a gown of moss, a crown of branches with flowers
      const f = figure(P, y0, 1.34, { pose: 'clasp', hair: 'long', skirt: 0.165, robeMod: MOD.lobes(9, 0.08, y0, y0 + 0.4) });
      f.done();
      P.add('base', antlers([0, f.top - 0.02, -0.005], 0.1, { tines: 3 }));
      P.add('flower', around(7, 0.062 * f.s, f.top - 0.012, () => flower(0.024), { tilt: -0.3 }));
      P.add('accent', placeAt(sphere(0.022, 0, 0, 0, 14), 0, 0.09 * f.s, f.hands[0][1] + 0.015));
      P.add('fur', around(12, 0.16 * f.s, y0 + 0.03, (i) => sphere(0.02 + (i % 3) * 0.004, 0, 0, 0, 8)));
      return turnPiece(P, 0.4);
    },
    b(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.31, 0.09);
      if (ctx.side === 'w') {
        // an elf mage in a white hood, with a staff of gold holding a blue crystal
        const f = figure(P, y0, 1.18, { pose: 'staff', hood: true, cloak: true, skirt: 0.145 });
        f.done();
        const top = staffAt(P, f.hands[1], y0, 0.86 * f.s, 0.01);
        P.add('trim', merge([-1, 1].map((sd) => horn([[top[0], top[1] - 0.02, top[2]], [top[0] + sd * 0.04, top[1] + 0.03, top[2]], [top[0] + sd * 0.02, top[1] + 0.1, top[2]]], 0.008, 0.003))));
        P.add('accent', new THREE.OctahedronGeometry(0.03, 0).scale(1, 1.7, 1).translate(top[0], top[1] + 0.05, top[2]));
        P.add('trim', ring(0.145, y0 + 0.03, 0.007));
        return turnPiece(P, 0.3);
      }
      // a druid in a hood of leaves, with a staff of twisted branches round a green light
      const f = figure(P, y0, 1.18, { pose: 'staff', hood: true, cloak: true, beard: 0.5, skirt: 0.145 });
      f.done();
      const top = staffAt(P, f.hands[1], y0, 0.86 * f.s, 0.011, 'base');
      P.add('base', merge([0, 1, 2].map((i) => { const a = i * TAU / 3; return horn([[top[0], top[1] - 0.03, top[2]], [top[0] + Math.sin(a) * 0.04, top[1] + 0.04, top[2] + Math.cos(a) * 0.04], [top[0] + Math.sin(a + 1) * 0.015, top[1] + 0.1, top[2] + Math.cos(a + 1) * 0.015]], 0.008, 0.003); })));
      P.add('accent', sphere(0.028, top[0], top[1] + 0.045, top[2], 14));
      P.add('fur', around(10, 0.145, y0 + 0.03, (i) => sphere(0.018 + (i % 2) * 0.004, 0, 0, 0, 8)));
      return turnPiece(P, 0.3);
    },
    n(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.322, 0.09), B = y0;
      if (ctx.side === 'w') {
        // a white stag with golden antlers, one forefoot raised, a green cloth on his back
        const S = new Sculpt(0.02, 1.1), moss = new Sculpt(0.03, 1.3);
        S.floor = B - 0.004; moss.floor = B - 0.004;
        moss.ell([0, B + 0.03, 0], [0.18, 0.05, 0.2]);
        S.ell([0, B + 0.34, -0.02], [0.065, 0.07, 0.14], 0.03);
        S.ell([0, B + 0.36, 0.08], [0.06, 0.075, 0.065], 0.035);
        S.ell([0, B + 0.36, -0.11], [0.062, 0.07, 0.065], 0.035);
        S.pair((x) => S.chain([[x * 0.038, B + 0.32, -0.12, 0.03], [x * 0.04, B + 0.2, -0.165, 0.018], [x * 0.04, B + 0.1, -0.13, 0.012], [x * 0.04, B + 0.03, -0.12, 0.012]], 0.012, 3));
        S.chain([[0.036, B + 0.32, 0.09, 0.028], [0.038, B + 0.18, 0.1, 0.014], [0.038, B + 0.03, 0.1, 0.012]], 0.012, 3);
        S.chain([[-0.036, B + 0.32, 0.09, 0.028], [-0.038, B + 0.24, 0.16, 0.014], [-0.038, B + 0.15, 0.14, 0.012]], 0.012, 3);
        S.chain([[0, B + 0.39, 0.1, 0.042], [0, B + 0.48, 0.14, 0.033], [0, B + 0.56, 0.16, 0.028]], 0.02, 3);
        S.ell([0, B + 0.6, 0.18], [0.03, 0.034, 0.05], 0.015);
        S.cone([0, B + 0.595, 0.2], [0, B + 0.565, 0.255], 0.022, 0.013, 0.01);
        S.pair((x) => S.cone([x * 0.025, B + 0.62, 0.17], [x * 0.06, B + 0.64, 0.15], 0.012, 0.005, 0.006));
        S.chain([[0, B + 0.38, -0.17, 0.012], [0, B + 0.37, -0.19, 0.008]], 0.008);
        const sf = S.field();
        P.add('body', S.mesh()); P.add('fur', moss.mesh());
        P.add('trim', antlers([0, B + 0.63, 0.165], 0.13));
        P.add('eye', merge([-1, 1].map((x) => sphere(0.008, x * 0.028, B + 0.61, 0.2, 8))));
        P.add('cloth', sdfGeometry(drape(sf, 0.012, (x, y, z) => Math.max(B + 0.33 - y, Math.abs(z + 0.01) - 0.09)), [-0.1, B + 0.3, -0.12, 0.1, B + 0.44, 0.1], Q.cell * 1.3));
        P.add('trim', K.tube([[0, B + 0.575, 0.24], [0.026, B + 0.58, 0.19], [0.03, B + 0.55, 0.12], [0.028, B + 0.47, 0.08]], 0.004, { segs: 16, radial: 5 }));
        P.add('accent', placeAt(cabochon(0.014, 0.6), 0, 0, 0).rotateX(-Math.PI / 2).translate(0, B + 0.435, 0.0));
        P.add('flower', merge([[-0.12, 0.1], [0.13, -0.06], [0.08, 0.14]].map(([x, z]) => flower(0.025).rotateX(-Math.PI / 2).translate(x, B + 0.075, z))));
        return turnPiece(P, 0.1);
      }
      // a friendly moss bear standing up on his hind legs, flowers growing on his back
      const S = new Sculpt(0.03, 1.2);
      S.floor = B - 0.004;
      S.cone([0, B + 0.2, -0.03], [0, B + 0.46, 0.02], 0.115, 0.09, 0.05);
      S.ell([0, B + 0.3, 0.03], [0.1, 0.12, 0.09], 0.05);
      S.pair((x) => {
        S.ell([x * 0.075, B + 0.12, 0.0], [0.055, 0.09, 0.07], 0.03);
        S.ell([x * 0.08, B + 0.025, 0.04], [0.045, 0.028, 0.065], 0.02);
        S.chain([[x * 0.09, B + 0.45, 0.02, 0.04], [x * 0.12, B + 0.39, 0.09, 0.032], [x * 0.09, B + 0.38, 0.15, 0.03]], 0.02, 3);   // paws held out
      });
      S.ell([0, B + 0.56, 0.05], [0.075, 0.07, 0.07], 0.04);
      S.cone([0, B + 0.55, 0.09], [0, B + 0.53, 0.14], 0.038, 0.026, 0.02);
      S.pair((x) => S.ell([x * 0.055, B + 0.62, 0.03], [0.024, 0.024, 0.014], 0.012));
      const sf = S.field();
      P.add('body', S.mesh());
      P.add('eye', merge([-1, 1].map((x) => sphere(0.011, x * 0.03, B + 0.57, 0.11, 10))));
      P.add('trim', sphere(0.014, 0, B + 0.535, 0.145, 10));
      P.add('fur', sdfGeometry(drape(sf, 0.01, (x, y, z) => Math.max(z + 0.05, B + 0.3 - y, y - (B + 0.62), Math.abs(x) - 0.09)), [-0.15, B + 0.28, -0.16, 0.15, B + 0.66, 0.06], Q.cell * 1.3));
      const fl = flowersOn(sf, [-0.08, B + 0.25, 0, 0.08, B + 0.58, 0], 7, 0.024, 9); if (fl) P.add('flower', fl);
      return turnPiece(P, 0.3);
    },
    r(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.322, 0.09), Y = y0;
      if (ctx.side === 'w') {
        // a slender elven tower of white stone and gold, its windows lit, a crystal on top
        P.lathe('body', profile(0, Y).line(0.22, Y).curve([[0.17, Y + 0.08], [0.155, Y + 0.2], [0.15, Y + 0.44]]).line(0.19, Y + 0.48).line(0.19, Y + 0.52).line(0.15, Y + 0.53).line(0, Y + 0.53));
        P.add('trim', pointedCrown(0.175, Y + 0.52, 8, 0.15, { flare: 0.12, w: 0.55 }));
        P.add('accent', new THREE.OctahedronGeometry(0.06, 0).scale(1, 1.7, 1).translate(0, Y + 0.66, 0));
        P.add('accent', around(4, 0.153, Y + 0.3, () => { const g = new THREE.CapsuleGeometry(0.022, 0.07, 4, 8); g.scale(1, 1, 0.3); return g; }, { phase: Math.PI / 4 }));
        P.add('trim', around(8, 0.158, Y + 0.25, () => new THREE.BoxGeometry(0.008, 0.36, 0.008)));
        P.add('trim', ring(0.19, Y + 0.5, 0.008));
        P.add('leaf', around(10, 0.2, Y + 0.06, (i) => { const g = curl(leaf(0.04, 0.09, 0.005), 3); g.rotateZ(i % 2 ? 0.4 : -0.4); return g; }, { tilt: 0.3 }));
        return P;
      }
      // a hollow tree stump with roots, a glowing door and windows, and toadstools
      P.lathe('body', profile(0, Y).line(0.25, Y).curve([[0.21, Y + 0.08], [0.2, Y + 0.3], [0.21, Y + 0.5]]).line(0.245, Y + 0.53).line(0.245, Y + 0.57).line(0.19, Y + 0.57).line(0.19, Y + 0.55).line(0, Y + 0.55), { mod: MOD.lobes(9, 0.1, Y, Y + 0.57) });
      P.add('body', battlements(5, 0.19, 0.245, Y + 0.565, Y + 0.7, 0.42, 'round', 0.04));
      P.add('fur', around(10, 0.22, Y + 0.57, (i) => sphere(0.03 + (i % 3) * 0.006, 0, 0, 0, 8).scale(1, 0.6, 1)));
      P.add('body', around(6, 0.2, Y + 0.02, () => horn([[0, 0.12, -0.02], [0, 0.04, 0.05], [0, 0.0, 0.1]], 0.04, 0.012), { phase: 0.4 }));
      P.add('accent', placeAt(new THREE.CircleGeometry(0.06, 20, 0, Math.PI).scale(1, 1.4, 1).translate(0, 0.06, 0), 0, 0.212, Y + 0.08));
      P.add('accent', placeAt(new THREE.PlaneGeometry(0.12, 0.07).translate(0, 0.035, 0), 0, 0.212, Y + 0.06));
      P.add('accent', around(2, 0.21, Y + 0.38, () => new THREE.CircleGeometry(0.026, 14), { phase: Math.PI * 0.75 }));
      P.add('trim', placeAt(K.tube(Array.from({ length: 13 }, (_, i) => { const a = (i / 12) * Math.PI; return [Math.cos(a) * 0.066, Math.sin(a) * 0.088 + 0.14, 0]; }), 0.009, { segs: 20, radial: 6 }), 0, 0.216, Y));
      for (const [th, y, sz] of [[1.9, 0.22, 1], [2.3, 0.14, 0.7], [-2.1, 0.3, 0.8]]) {
        P.add('trim', placeAt(new THREE.CylinderGeometry(0.01 * sz, 0.012 * sz, 0.04 * sz, 8).translate(0, 0, 0.03 * sz), th, 0.205, Y + y));
        P.add('flower', placeAt(new THREE.SphereGeometry(0.035 * sz, 14, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.02 * sz, 0.05 * sz), th, 0.205, Y + y));
      }
      return P;
    },
    p(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.27, 0.08);
      if (ctx.side === 'w') {
        // an elf sentinel with a leaf shield and a spear
        const f = figure(P, y0, 0.84, { pose: 'shield', hair: 'short', cloak: true, skirt: 0.135 , coarse: 1.4 });
        elfEars(f); f.done();
        const hc = f.hd.c, hr = f.hd.r;
        P.add('trim', merge([new THREE.SphereGeometry(hr * 1.1, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, 1.25, 1).translate(hc[0], hc[1] + hr * 0.1, hc[2]), new THREE.ConeGeometry(hr * 0.35, hr * 0.9, 10).translate(hc[0], hc[1] + hr * 1.7, hc[2])]));
        const shf = extrude(K.mirrorOutline([[0, 0.1], [0.05, 0.075], [0.065, 0.02], [0.045, -0.05], [0, -0.1]]), 0.012, 0.004, { bevelSegments: 2 });
        shf.rotateY(-0.35); shf.translate(f.hands[0][0] - 0.01, f.hands[0][1], f.hands[0][2] + 0.03); P.add('cloth', shf);
        const tree = merge([new THREE.BoxGeometry(0.008, 0.06, 0.006).translate(0, -0.02, 0), new THREE.CircleGeometry(0.028, 12).translate(0, 0.025, 0)]);
        tree.rotateY(-0.35); tree.translate(f.hands[0][0] - 0.01 + 0.006, f.hands[0][1], f.hands[0][2] + 0.042); P.add('trim', tree);
        const sp = spear(0.78 * f.s, 0.006);
        for (const g of [sp.shaft, sp.head]) g.translate(f.hands[1][0], y0, f.hands[1][2]);
        P.add('trim', sp.shaft); P.add('steel', sp.head);
        return turnPiece(P, 0.4);
      }
      // a little moss sprite: a round body, a big head with leaf ears and glowing eyes
      const S = new Sculpt(0.02), Y = y0;
      S.floor = Y - 0.004;
      S.ell([0, Y + 0.1, 0], [0.085, 0.095, 0.08], 0.03);
      S.pair((x) => {
        S.ell([x * 0.045, Y + 0.02, 0.03], [0.035, 0.022, 0.045], 0.015);
        S.chain([[x * 0.07, Y + 0.15, 0.0, 0.022], [x * 0.1, Y + 0.1, 0.04, 0.018], [x * 0.085, Y + 0.08, 0.075, 0.017]], 0.012, 3);
      });
      S.ell([0, Y + 0.25, 0.01], [0.09, 0.082, 0.082], 0.03);
      S.ell([0, Y + 0.23, 0.08], [0.03, 0.022, 0.02], 0.012);
      const sf = S.field();
      P.add('body', S.mesh());
      P.add('eye', merge([-1, 1].map((x) => sphere(0.019, x * 0.035, Y + 0.27, 0.072, 12))));
      P.add('leaf', merge([-1, 1].map((x) => { const g = curl(leaf(0.05, 0.11, 0.006), 2); g.rotateZ(-x * 1.15); g.translate(x * 0.075, Y + 0.27, 0); return g; })));
      P.add('fur', sdfGeometry(drape(sf, 0.012, (x, y, z) => Math.max(Y + 0.29 - y, -(Y + 0.0))), [-0.1, Y + 0.27, -0.1, 0.1, Y + 0.34, 0.1], Q.cell * 1.2));
      P.add('leaf', around(5, 0.02, Y + 0.33, () => { const g = curl(leaf(0.03, 0.07, 0.005), 2); return g; }, { tilt: -0.5 }));
      P.add('flower', placeAt(flower(0.022), 0.6, 0.07, Y + 0.31, { tilt: -0.6 }));
      return turnPiece(P, 0.35);
    },
  };

  // ------------------------------------------------------------------ Jarls of the Fjord
  // From the user's picture of a Viking set: white is gold and ivory with deep blue cloaks and
  // white fur, black is dark iron and leather with grey fur and red banners, and both carry
  // runestones that glow ice blue. A jarl with a sword for the king, a shieldmaiden queen, a
  // seer with a rune staff, a wolf for the knight, a watchtower with banners and shield
  // warriors for pawns.
  function vikingHelm(P, hd, o) {
    o = o || {};
    const c = hd.c, r = hd.r;
    P.add('steel', merge([
      new THREE.SphereGeometry(r * 1.1, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, o.tall || 1.1, 1).translate(c[0], c[1] + r * 0.08, c[2]),
      ring(r * 1.1, c[1] + r * 0.1, r * 0.1, { seg: 28 }).translate(c[0], 0, c[2]),
      new THREE.BoxGeometry(r * 0.16, r * 0.62, r * 0.12).translate(c[0], c[1] - r * 0.12, c[2] + r * 1.08),   // nose guard
    ]));
    if (o.spike) P.add('trim', new THREE.ConeGeometry(r * 0.22, r * 0.55, 10).translate(c[0], c[1] + r * 1.35, c[2]));
    if (o.horns) P.add('tooth', merge([-1, 1].map((x) => horn([[c[0] + x * r * 0.95, c[1] + r * 0.5, c[2]], [c[0] + x * r * 1.6, c[1] + r * 0.75, c[2] + r * 0.1], [c[0] + x * r * 1.85, c[1] + r * 1.4, c[2] + r * 0.25], [c[0] + x * r * 1.7, c[1] + r * 1.9, c[2] + r * 0.3]], r * 0.24, r * 0.05))));
    if (o.wings) P.add('trim', merge([-1, 1].flatMap((x) => [0, 1, 2].map((i) => { const f = petal(r * 0.42, r * (1.5 - i * 0.25), r * 0.08); f.rotateZ(-x * (0.35 + i * 0.32)); f.rotateY(x * Math.PI / 2); f.translate(c[0] + x * r * 1.05, c[1] + r * 0.45, c[2] - r * 0.1 - i * r * 0.08); return f; }))));
  }
  // A round shield on the left arm, facing out, with a boss and (o.sun) a sun of rays.
  function roundShield(P, at2, rad, o) {
    o = o || {};
    const sh = shield(rad, rad * 0.22), parts = [sh.face];
    for (const g of [sh.face, sh.rim, sh.boss]) { g.rotateY(o.turn || -0.35); g.translate(at2[0], at2[1], at2[2]); }
    P.add(o.slot || 'cloth', sh.face); P.add('trim', sh.rim); P.add('trim', sh.boss);
    if (o.sun) {
      const rays = around(8, 0, 0, () => ray(rad * 0.16, rad * 0.62, rad * 0.04).translate(0, rad * 0.26, 0), { phase: 0 });
      // around() stands parts round y; turn the ring so it lies on the shield's face
      const st = merge([0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const g = ray(rad * 0.16, rad * 0.6, rad * 0.04); g.translate(0, rad * 0.28, 0); g.rotateZ(i * TAU / 8); return g; }));
      st.translate(0, 0, rad * 0.17); st.rotateY(o.turn || -0.35); st.translate(at2[0], at2[1], at2[2]);
      P.add('trim', st); void rays; void parts;
    }
    if (o.spokes) {
      const sp = merge([0, 1, 2, 3].map((i) => new THREE.BoxGeometry(rad * 1.8, rad * 0.07, rad * 0.04).rotateZ(i * Math.PI / 4)));
      sp.translate(0, 0, rad * 0.14); sp.rotateY(o.turn || -0.35); sp.translate(at2[0], at2[1], at2[2]);
      P.add('trim', sp);
    }
  }
  // A wolf sitting up on a rock, head raised, its ruff thick round the neck.
  function wolf(P, B, o) {
    o = o || {};
    const S = new Sculpt(0.024, 1.15), rock = new Sculpt(0.04, 1.4);
    S.floor = B - 0.004; rock.floor = B - 0.004;
    rock.ell([0, B + 0.04, 0], [0.19, 0.07, 0.2]); rock.ell([0.04, B + 0.1, 0.06], [0.1, 0.08, 0.09]);
    S.cone([0, B + 0.18, -0.08], [0, B + 0.4, 0.04], 0.1, 0.085, 0.04);                       // body, sitting up
    S.pair((x) => {
      S.ell([x * 0.075, B + 0.15, -0.06], [0.05, 0.08, 0.09], 0.03);                          // haunches
      S.ell([x * 0.075, B + 0.08, 0.03], [0.03, 0.02, 0.06], 0.015);                          // hind paws
      S.chain([[x * 0.05, B + 0.34, 0.07, 0.03], [x * 0.05, B + 0.24, 0.1, 0.022], [x * 0.05, B + 0.14, 0.12, 0.02]], 0.015, 3);   // forelegs
      S.ell([x * 0.05, B + 0.13, 0.14], [0.024, 0.016, 0.034], 0.01);
    });
    S.ell([0, B + 0.45, 0.04], [0.09, 0.08, 0.08], 0.04);                                       // the ruff
    S.ell([0, B + 0.55, 0.07], [0.058, 0.055, 0.062], 0.03);                                    // head
    S.cone([0, B + 0.535, 0.1], [0, B + 0.51, 0.18], 0.036, 0.02, 0.015);                      // muzzle
    if (o.snarl) { S.cone([0, B + 0.495, 0.08], [0, B + 0.47, 0.15], 0.022, 0.014, 0.01); S.ell([0, B + 0.495, 0.16], [0.02, 0.012, 0.04], 0.006, true); }
    S.pair((x) => S.cone([x * 0.034, B + 0.59, 0.05], [x * 0.045, B + 0.65, 0.03], 0.022, 0.006, 0.01));   // ears
    S.chain([[0, B + 0.12, -0.17, 0.035], [0.07, B + 0.05, -0.2, 0.03], [0.16, B + 0.04, -0.12, 0.02]], 0.02, 3);   // tail round the rock
    const sf = S.field();
    P.add('body', S.mesh()); P.add('rock', rock.mesh());
    P.add('eye', merge([-1, 1].map((x) => sphere(0.011, x * 0.03, B + 0.565, 0.115, 10))));
    P.add('trim', sphere(0.012, 0, B + 0.515, 0.183, 10));
    // tufts of fur standing out round the ruff
    P.add('fur', around(12, 0.085, B + 0.45, (i) => { const c = new THREE.ConeGeometry(0.02, 0.06 + (i % 3) * 0.012, 5); c.rotateX(Math.PI / 2); return c; }, { tilt: 0.4 }).translate(0, 0, 0.03));
    return sf;
  }
  const VIKING = {
    k(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.34, 0.1), w = ctx.side === 'w';
      // a jarl in a fur cloak, both hands on his sword; a gold crown on white, a horned helm on black
      const f = figure(P, y0, 1.42, { pose: 'sword', beard: 1.0, hair: 'long', cloak: true, fur: true, skirt: 0.155 });
      f.done();
      swordDown(P, [0, f.hands[0][1], f.hands[0][2]], 0.4 * f.s, 0.028 * f.s);
      if (w) {
        P.add('trim', pointedCrown(0.062 * f.s, f.top - 0.03, 6, 0.08, { flare: 0.18, w: 0.65 }).translate(0, 0, 0.006));
        P.add('accent', gemRing(6, 0.068 * f.s, f.top - 0.012, 0.009, { phase: Math.PI / 6 }).translate(0, 0, 0.006));
      } else vikingHelm(P, f.hd, { horns: true });
      P.add('accent', placeAt(cabochon(0.022, 0.6), 0, 0.075 * f.s, y0 + 0.57 * f.s));
      P.add('trim', ring(0.155 * f.s, y0 + 0.03, 0.008));
      return turnPiece(P, 0.3);
    },
    q(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.33, 0.1), w = ctx.side === 'w';
      // a shieldmaiden queen with long braids and a fur collar; a winged helm on white, a
      // circlet with curling horns on black
      const f = figure(P, y0, 1.34, { pose: 'clasp', hair: 'braids', cloak: true, fur: true, skirt: 0.16, robeMod: MOD.flutes(14, 0.1, y0 + 0.01, y0 + 0.45, { soft: true, end: 0.03 }) });
      f.done();
      if (w) vikingHelm(P, f.hd, { wings: true, tall: 1.0 });
      else {
        const c = f.hd.c, r = f.hd.r;
        P.add('trim', ring(r * 1.05, c[1] + r * 0.45, r * 0.12, { seg: 28 }).translate(c[0], 0, c[2]));
        P.add('tooth', merge([-1, 1].map((x) => horn([[c[0] + x * r * 0.8, c[1] + r * 0.7, c[2] - r * 0.1], [c[0] + x * r * 1.3, c[1] + r * 1.3, c[2] - r * 0.4], [c[0] + x * r * 1.0, c[1] + r * 1.7, c[2] - r * 0.8], [c[0] + x * r * 0.7, c[1] + r * 1.5, c[2] - r * 1.0]], r * 0.16, r * 0.04))));
      }
      P.add('accent', placeAt(cabochon(0.02, 0.6), 0, 0.072 * f.s, y0 + 0.575 * f.s));
      P.add('trim', merge([-1, 1].map((x) => sphere(0.014, f.hd.c[0] + x * f.hd.r * 0.95, y0 + 0.5 * f.s, 0.05 * f.s, 10))));
      P.add('trim', ring(0.16 * f.s, y0 + 0.03, 0.008));
      return turnPiece(P, 0.4);
    },
    b(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.31, 0.09), w = ctx.side === 'w';
      // a seer with a long beard and a rune staff crowned with a glowing ice-blue stone
      const f = figure(P, y0, 1.18, { pose: 'staff', hood: true, beard: 1.1, cloak: true, fur: !w, skirt: 0.145 });
      f.done();
      const top = staffAt(P, f.hands[1], y0, 0.86 * f.s, 0.011, w ? 'trim' : 'base');
      if (w) {
        P.add('trim', ring(0.04, 0, 0.007, { seg: 24 }).rotateX(Math.PI / 2).translate(top[0], top[1] + 0.04, top[2]));
        P.add('accent', sphere(0.026, top[0], top[1] + 0.04, top[2], 14));
      } else {
        P.add('tooth', merge([-1, 1].map((x) => horn([[top[0], top[1] - 0.01, top[2]], [top[0] + x * 0.05, top[1] + 0.03, top[2]], [top[0] + x * 0.035, top[1] + 0.1, top[2] + 0.01]], 0.01, 0.003))));
        P.add('accent', sphere(0.026, top[0], top[1] + 0.05, top[2], 14));
        const c = f.hd.c, r = f.hd.r;
        P.add('tooth', merge([-1, 1].map((x) => horn([[c[0] + x * r * 0.9, c[1] + r * 0.8, c[2] - r * 0.2], [c[0] + x * r * 1.4, c[1] + r * 1.3, c[2] - r * 0.3], [c[0] + x * r * 1.3, c[1] + r * 1.8, c[2] - r * 0.1]], r * 0.2, r * 0.05))));
      }
      // runes cut down the front of the robe
      P.add('accent', merge([0, 1, 2, 3].map((i) => new THREE.BoxGeometry(0.008, 0.03, 0.006).rotateZ(i % 2 ? 0.5 : -0.5).translate(0, y0 + (0.12 + i * 0.07) * f.s, (0.15 - i * 0.017) * f.s))));
      return turnPiece(P, 0.3);
    },
    n(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.322, 0.09), w = ctx.side === 'w';
      // a great wolf: white with gold armour on white, dark with glowing eyes on black
      const sf = wolf(P, y0, { snarl: !w });
      if (w) {
        P.add('cloth', sdfGeometry(drape(sf, 0.012, (x, y, z) => Math.max(z - 0.0, y0 + 0.26 - y, y - (y0 + 0.5))), [-0.14, y0 + 0.24, -0.16, 0.14, y0 + 0.52, 0.05], Q.cell * 1.3));
        P.add('trim', ring(0.072, y0 + 0.43, 0.009).translate(0, 0, 0.045));
        P.add('accent', placeAt(cabochon(0.016, 0.6), 0, 0.13, y0 + 0.42));
      }
      return turnPiece(P, 0.1);
    },
    r(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.322, 0.09), Y = y0, w = ctx.side === 'w';
      // a watchtower with a round shield on its face and two banners flying from the top
      P.lathe('body', profile(0, Y).line(0.235, Y).curve([[0.21, Y + 0.1], [0.2, Y + 0.3], [0.205, Y + 0.46]]).line(0.245, Y + 0.48).line(0.245, Y + 0.54).line(0.2, Y + 0.54).line(0.2, Y + 0.52).line(0, Y + 0.52),
        { mod: MOD.facets(12, Y + 0.02, Y + 0.54, 0.1) });
      P.add('body', battlements(6, 0.2, 0.245, Y + 0.535, Y + 0.66, 0.42, w ? 'flat' : 'point'));
      P.add('trim', merge([ring(0.212, Y + 0.12, 0.008), ring(0.205, Y + 0.44, 0.008)]));
      roundShield(P, [0, Y + 0.28, 0.21], 0.1, { turn: 0, sun: w, spokes: !w, slot: 'cloth' });
      for (const sd of [-1, 1]) {
        P.add('trim', new THREE.CylinderGeometry(0.006, 0.006, 0.36, 6).translate(sd * 0.13, Y + 0.66, -0.1));
        banner(P, sd * 0.13 + sd * 0.045, Y + 0.82, -0.1, 0.08, 0.15, 0, 'banner');
      }
      P.add('accent', placeAt(new THREE.CircleGeometry(0.024, 12), Math.PI, 0.207, Y + 0.36));
      return P;
    },
    p(ctx) {
      const P = new Piece(), y0 = plinth(P, 0.27, 0.08), w = ctx.side === 'w';
      // a warrior with a round shield and a spear, in a nose-guard helmet
      const f = figure(P, y0, 0.84, { pose: 'shield', beard: w ? 0.3 : 0.6, cloak: true, fur: !w, skirt: 0.135 , coarse: 1.4 });
      f.done();
      vikingHelm(P, f.hd, { spike: w });
      roundShield(P, [f.hands[0][0] - 0.01, f.hands[0][1], f.hands[0][2] + 0.03], 0.085, { sun: w, spokes: !w });
      const sp = spear(0.8 * f.s, 0.006);
      for (const g of [sp.shaft, sp.head]) g.translate(f.hands[1][0], y0, f.hands[1][2]);
      P.add('trim', sp.shaft); P.add('steel', sp.head);
      return turnPiece(P, 0.4);
    },
  };

  // ------------------------------------------------------------------ Runecarved
  // From the user's picture of a carved wooden Viking set on a board of runes: whittled
  // figures standing on drums of knotwork, pale birch with blue cloaks against dark oak with
  // red. A king leaning on his sword, a queen with a drinking horn, a skald with a sun-wheel
  // staff, a wolf's head for the knight, a round watchtower under a shingled roof and spearmen.
  const knot = (y0, y1, n) => MOD.rope(n || 10, 0.1, y0, y1, 1.6);
  function knotDrum(P, R, h) {
    P.lathe('base', profile(0, 0).line(R - 0.01, 0).arc(R, 0.012, 0.3).line(R, h - 0.012).arc(R - 0.012, h, 0.3).line(0, h), { mod: knot(0.02, h - 0.02, Math.round(R * 60)) });
    P.add('trim', merge([ring(R + 0.002, 0.006, 0.005), ring(R + 0.002, h - 0.006, 0.005)]));
    return h;
  }
  // a carved finish: the sculpted parts nudged by a little knife-cut noise
  function carve(P, seed) {
    for (const slot of ['body', 'cloth', 'hair', 'cape']) if (P.parts[slot]) P.parts[slot] = P.parts[slot].map((g, i) => hewn(g, 0.0018, seed + i));
    return P;
  }
  const RUNE = {
    k() {
      const P = new Piece(), y0 = knotDrum(P, 0.33, 0.13);
      const f = figure(P, y0, 1.34, { pose: 'sword', beard: 1.1, hair: 'long', cloak: true, skirt: 0.15, robeMod: MOD.flutes(10, 0.08, y0 + 0.02, y0 + 0.4, { end: 0.03 }) });
      f.done();
      swordDown(P, [0, f.hands[0][1], f.hands[0][2]], 0.4 * f.s, 0.028 * f.s);
      P.add('trim', pointedCrown(0.06 * f.s, f.top - 0.03, 5, 0.07, { flare: 0.1, w: 0.8 }).translate(0, 0, 0.006));
      P.add('trim', placeAt(sphere(0.02, 0, 0, 0, 12), 0, 0.07 * f.s, y0 + 0.57 * f.s));
      return turnPiece(carve(P, 11), 0.3);
    },
    q() {
      const P = new Piece(), y0 = knotDrum(P, 0.32, 0.12);
      const f = figure(P, y0, 1.3, { pose: 'clasp', hair: 'braids', cloak: true, skirt: 0.155, robeMod: MOD.flutes(12, 0.08, y0 + 0.02, y0 + 0.42, { end: 0.03 }) });
      f.done();
      // a drinking horn held in both hands
      const h = f.hands[0];
      P.add('tooth', horn([[h[0] + 0.07, h[1] + 0.08, h[2] + 0.01], [h[0] + 0.02, h[1] + 0.01, h[2] + 0.03], [h[0] - 0.04, h[1] - 0.02, h[2] + 0.01], [h[0] - 0.07, h[1] + 0.02, h[2] - 0.01]], 0.026, 0.006));
      P.add('trim', ring(0.026, 0, 0.005, { seg: 16 }).rotateZ(0.9).translate(h[0] + 0.07, h[1] + 0.08, h[2] + 0.01));
      P.add('trim', ring(0.062 * f.s, f.top - 0.026, 0.008).translate(0, 0, 0.006));
      P.add('trim', placeAt(sphere(0.016, 0, 0, 0, 10), 0, 0.068 * f.s, f.top - 0.02));
      return turnPiece(carve(P, 13), 0.4);
    },
    b() {
      const P = new Piece(), y0 = knotDrum(P, 0.3, 0.11);
      const f = figure(P, y0, 1.16, { pose: 'staff', hood: true, beard: 1.0, skirt: 0.14 });
      f.done();
      const top = staffAt(P, f.hands[1], y0, 0.88 * f.s, 0.011, 'body');
      // a sun wheel on the staff: a ring with four spokes
      P.add('trim', merge([ring(0.045, 0, 0.007, { seg: 24 }).rotateX(Math.PI / 2), new THREE.BoxGeometry(0.09, 0.008, 0.008), new THREE.BoxGeometry(0.008, 0.09, 0.008), sphere(0.014, 0, 0, 0, 10)]).translate(top[0], top[1] + 0.04, top[2]));
      // runes carved down his robe
      P.add('trim', merge([0, 1, 2, 3, 4].map((i) => new THREE.BoxGeometry(0.006, 0.026, 0.005).rotateZ(i % 2 ? 0.6 : 0).translate(0, y0 + (0.1 + i * 0.065) * f.s, (0.147 - i * 0.014) * f.s))));
      return turnPiece(carve(P, 17), 0.3);
    },
    n() {
      const P = new Piece(), y0 = knotDrum(P, 0.312, 0.12), B = y0;
      // a wolf's head on a carved neck, mouth open, with spirals cut into the neck
      const S = new Sculpt(0.026, 1.15);
      S.floor = B - 0.004;
      S.chain([[0, B, -0.02, 0.15], [0, B + 0.16, 0.0, 0.13], [0, B + 0.32, 0.03, 0.105], [0, B + 0.44, 0.06, 0.09]], 0.04, 4);
      S.ell([0, B + 0.5, 0.08], [0.085, 0.08, 0.09], 0.04);
      S.cone([0, B + 0.5, 0.12], [0, B + 0.47, 0.26], 0.055, 0.03, 0.02);                       // muzzle
      S.cone([0, B + 0.43, 0.1], [0, B + 0.4, 0.22], 0.04, 0.022, 0.015);                        // jaw
      S.ell([0, B + 0.435, 0.24], [0.03, 0.02, 0.07], 0.008, true);
      S.pair((x) => S.cone([x * 0.05, B + 0.56, 0.05], [x * 0.065, B + 0.66, 0.0], 0.03, 0.008, 0.012));
      S.ell([0, B + 0.3, -0.07], [0.11, 0.2, 0.06], 0.05);                                       // a mane down the back of the neck
      P.add('body', S.mesh());
      P.add('trim', merge([-1, 1].map((x) => sphere(0.014, x * 0.05, B + 0.525, 0.15, 10))));
      P.add('tooth', merge([teeth(3, [0, B + 0.455, 0.18, 0.03], [0, B + 0.45, 0.25], 0.012, true)]));
      const spirals = [];
      for (const x of [-1, 1]) for (const [y, rr] of [[0.18, 0.05], [0.32, 0.04]]) {
        const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30, a = t * TAU * 1.6; pts.push([x * (0.112 - y * 0.06), B + y + Math.sin(a) * rr * (0.3 + t * 0.7), 0.0 + Math.cos(a) * rr * (0.3 + t * 0.7)]); }
        spirals.push(K.tube(pts, 0.006, { segs: 40, radial: 5 }));
      }
      P.add('trim', merge(spirals));
      return turnPiece(carve(P, 19), 0.1);
    },
    r() {
      const P = new Piece(), y0 = knotDrum(P, 0.315, 0.12), Y = y0;
      // a round watchtower of planks under a shingled cone roof, a banner hanging on its face
      P.lathe('body', profile(0, Y).line(0.2, Y).line(0.19, Y + 0.42).line(0.205, Y + 0.43).line(0.205, Y + 0.46).line(0, Y + 0.46), { mod: MOD.flutes(16, 0.06, Y + 0.01, Y + 0.42, { end: 0.02 }) });
      P.lathe('cloth', profile(0, Y + 0.45).line(0.27, Y + 0.45).line(0.25, Y + 0.48).line(0.02, Y + 0.72).line(0, Y + 0.73), { mod: MOD.rope(24, 0.25, Y + 0.46, Y + 0.7, 0) });
      P.add('trim', merge([new THREE.CylinderGeometry(0.008, 0.008, 0.08, 6).translate(0, Y + 0.76, 0), sphere(0.018, 0, Y + 0.81, 0, 10)]));
      P.add('cloth', around(6, 0.19, Y + 0.38, () => new THREE.BoxGeometry(0.03, 0.05, 0.02), { phase: Math.PI / 6 }));
      banner(P, 0, Y + 0.34, 0.205, 0.12, 0.22, 0, 'cape');
      P.add('trim', merge([0, 1, 2].map((i) => ring(0.022, 0, 0.004, { seg: 16 }).rotateX(Math.PI / 2).translate(Math.sin(i * TAU / 3) * 0.018, Y + 0.24 + Math.cos(i * TAU / 3) * 0.018, 0.214))));
      P.add('trim', merge([ring(0.196, Y + 0.12, 0.008), ring(0.193, Y + 0.3, 0.008)]));
      return carve(P, 23);
    },
    p() {
      const P = new Piece(), y0 = knotDrum(P, 0.26, 0.1);
      const f = figure(P, y0, 0.82, { pose: 'shield', beard: 0.5, cloak: true, skirt: 0.13 , coarse: 1.4 });
      f.done();
      const c = f.hd.c, r = f.hd.r;
      P.add('steel', merge([new THREE.ConeGeometry(r * 1.12, r * 1.4, 16).translate(c[0], c[1] + r * 0.72, c[2]), new THREE.BoxGeometry(r * 0.16, r * 0.6, r * 0.12).translate(c[0], c[1] - r * 0.1, c[2] + r * 1.05)]));
      roundShield(P, [f.hands[0][0] - 0.01, f.hands[0][1], f.hands[0][2] + 0.03], 0.085, { spokes: true });
      const sp = spear(0.8 * f.s, 0.006);
      for (const g of [sp.shaft, sp.head]) g.translate(f.hands[1][0], y0, f.hands[1][2]);
      P.add('body', sp.shaft); P.add('steel', sp.head);
      return turnPiece(carve(P, 29), 0.4);
    },
  };


  // ------------------------------------------------------------------ shared by the jewel sets
  // A lathe profile drawn from a radius function f(y), from the profile's current point up to y1.
  function byFn(p, f, y0, y1, n) {
    n = n || 24;
    p.line(f(y0), y0);
    for (let i = 1; i <= n; i++) { const y = mix(y0, y1, i / n); p.line(f(y), y, true); }
    return p;
  }
  // n gold ribbons winding up a body whose radius at height y is rAt(y).
  function ribbons(n, rAt, y0, y1, turns, thick, phase) {
    const parts = [];
    for (let k = 0; k < n; k++) {
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40, y = mix(y0, y1, t), th = (phase || 0) + (k / n) * TAU + t * turns * TAU, r = rAt(y) + thick * 0.35;
        pts.push([Math.sin(th) * r, y, Math.cos(th) * r]);
      }
      parts.push(K.tube(pts, thick, { segs: 80, radial: 6 }));
    }
    return merge(parts);
  }
  // A flat ribbon wound round a body of radius rAt(y): a curved strip `width` tall, with a fine
  // gold cord along each edge (returned separately as `edges`).
  function strip(rAt, y0, y1, turns, width, phase) {
    const n = Math.max(24, Math.round(72 * DETAIL.along)), pos = [], idx = [], e0 = [], e1 = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n, y = mix(y0, y1, t), th = (phase || 0) + t * turns * TAU, fade = Math.min(1, t * 6, (1 - t) * 6);
      for (const k of [-0.5, 0.5]) {
        const yy = y + k * width * fade, r = rAt(yy) + 0.004;
        pos.push(Math.sin(th) * r, yy, Math.cos(th) * r);
        (k < 0 ? e0 : e1).push([Math.sin(th) * (r + 0.002), yy, Math.cos(th) * (r + 0.002)]);
      }
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    if (turns < 0) { const ix = g.index.array; for (let i = 0; i < ix.length; i += 3) { const tmp = ix[i]; ix[i] = ix[i + 1]; ix[i + 1] = tmp; } g.computeVertexNormals(); }
    return { band: g, edges: merge([K.tube(e0, 0.004, { segs: n, radial: 5 }), K.tube(e1, 0.004, { segs: n, radial: 5 })]) };
  }
  // A long, flat-faced gem (a navette or lozenge) facing +z: a brilliant stretched upright.
  const lozenge = (size, tall) => brilliant(size).scale(1, tall || 1.6, 1);
  // A gem standing at the front of a piece, on radius r at height y.
  const frontGem = (size, r, y, tall) => placeAt(lozenge(size, tall), 0, r, y);
  // A heater shield facing +z, h tall.
  function heater(h, depth) {
    const half = [[0, 0.5], [0.4, 0.5], [0.42, 0.2], [0.36, -0.12], [0.2, -0.36], [0, -0.5]];
    return extrude(outline(half, h, h), depth, depth * 0.3, { bevelSegments: 2 });
  }

  // ------------------------------------------------------------------ Fantasy Marble
  // White and black marble veined and wound with gold. Gold ribbons spiral up every piece and
  // every foot is a drum ringed with a little gold arcade. The king and queen open into crowns of
  // marble petals edged in gold, the bishop holds a pearl in a twisted loop, the rook has tall
  // arched windows and the knight's mane streams back in gold-veined marble.
  function fantasyFoot(P, R, k) {
    k = k || 1;
    const h = 0.1 * k;
    P.lathe('body', profile(0, 0).line(R - 0.01, 0).arc(R, 0.012, 0.3).line(R, h - 0.012).arc(R - 0.012, h, 0.3).line(0, h));
    P.add('trim', ring(R + 0.001, 0.014 * k, 0.011 * k));
    P.add('trim', ring(R - 0.004, h - 0.004, 0.01 * k));
    P.add('trim', around(Math.round(R * 60), R, h * 0.52, () => new THREE.BoxGeometry(0.009, h * 0.5, 0.008)));
    return h;
  }
  // a crown of n marble petals, each backed by a slightly larger gold one so it shows a gold rim
  function petalCrown(P, n, r, y, w, h, tilt, curlK) {
    P.add('body', around(n, r, y, () => curl(petal(w, h, 0.014), curlK), { tilt }));
    P.add('trim', around(n, r - 0.006, y - 0.004, () => curl(petal(w * 1.14, h * 1.06, 0.008), curlK), { tilt }));
  }
  const FANTASY = {
    k() {
      const P = new Piece(), h = fantasyFoot(P, 0.35);
      const f = (y) => mix(0.2, 0.104, smooth(h, 0.52, y)) + 0.074 * smooth(0.52, 0.86, y);
      const p = byFn(profile(0, h), f, h, 0.86, 30);
      p.line(0.14, 0.875).curve([[0.11, 0.95], [0.08, 1.03], [0.045, 1.08]]).line(0, 1.09);
      P.lathe('body', p, { mod: MOD.flutes(14, 0.05, h + 0.02, 0.84, { twist: 6, soft: true, end: 0.04 }) });
      P.add('trim', ribbons(3, f, h + 0.01, 0.84, 0.9, 0.0065));
      P.add('trim', ring(f(0.86) + 0.002, 0.862, 0.013));
      // a tulip crown of eight broad petals
      petalCrown(P, 8, 0.13, 0.86, 0.12, 0.25, 0.16, 2.0);
      P.add('trim', sphere(0.042, 0, 1.12, 0, 18));
      P.add('trim', placeAt(crossOf('pattee', 0.22, 0.04), 0, 0, 1.27));
      return P;
    },
    q() {
      const P = new Piece(), h = fantasyFoot(P, 0.335);
      const f = (y) => mix(0.19, 0.098, smooth(h, 0.5, y)) + 0.068 * smooth(0.5, 0.8, y);
      const p = byFn(profile(0, h), f, h, 0.8, 28);
      p.line(0.13, 0.815).curve([[0.09, 0.88], [0.06, 0.93]]).line(0, 0.94);
      P.lathe('body', p, { mod: MOD.flutes(12, 0.05, h + 0.02, 0.78, { twist: -6, soft: true, end: 0.04 }) });
      P.add('trim', ribbons(3, f, h + 0.01, 0.78, -0.9, 0.006));
      P.add('trim', ring(f(0.8) + 0.002, 0.802, 0.012));
      // nine slim pointed petals round a cut crystal
      petalCrown(P, 9, 0.12, 0.8, 0.074, 0.25, 0.3, 3.0);
      P.add('gem', brilliant(0.05).rotateX(-Math.PI / 2).translate(0, 1.0, 0));
      return P;
    },
    b() {
      const P = new Piece(), h = fantasyFoot(P, 0.312);
      const f = (y) => mix(0.165, 0.07, smooth(h, 0.52, y)) + 0.016 * smooth(0.48, 0.57, y);
      const p = byFn(profile(0, h), f, h, 0.57, 24);
      p.line(0.06, 0.6).line(0, 0.6);
      P.lathe('body', p, { mod: MOD.flutes(10, 0.06, h + 0.02, 0.55, { twist: 7, soft: true, end: 0.04 }) });
      P.add('trim', ribbons(2, f, h + 0.01, 0.55, 0.8, 0.006));
      P.add('trim', ring(0.088, 0.575, 0.011));
      // a pointed loop of two twisted marble ribbons, edged in gold, holding a pearl
      const y0 = 0.58, H = 0.5, W = 0.13;
      for (const s of [-1, 1]) {
        const band = [], edge = [];
        for (let i = 0; i <= 24; i++) {
          const u = (i / 24) * Math.PI, x = s * W * Math.sin(u) * Math.pow(1 - u / Math.PI, 0.55), y = y0 + H * (1 - Math.cos(u)) / 2, z = 0.022 * Math.sin(2 * u) * s;
          band.push([x, y, z]); edge.push([x * 1.12 + s * 0.004, y + 0.004, z]);
        }
        P.add('body', K.tube(band, 0.022, { segs: 48, radial: 10, radiusAt: (t) => mix(1, 0.4, t) }));
        P.add('trim', K.tube(edge, 0.007, { segs: 48, radial: 6, radiusAt: (t) => mix(1, 0.5, t) }));
      }
      P.add('orb', sphere(0.074, 0, 0.77, 0, 28));
      P.add('trim', sphere(0.016, 0, y0 + H + 0.012, 0, 12));
      return P;
    },
    n() {
      const P = new Piece(), h = fantasyFoot(P, 0.322);
      P.lathe('body', knightBase(profile(0, h).line(0.2, h), 0.2), { mod: MOD.flutes(10, 0.05, h + 0.01, 0.29, { twist: 6, soft: true, end: 0.03 }) });
      const hs = horse({ base: 0.31, mane: 'flow', seed: 83, form: { tuck: 0.04, neck: 0.14, lean: 0.08, reach: 0.06, ears: 0.24, chest: 0.12, girth: 0.88 } });
      P.add('body', hs.body); P.add('mane', hs.mane);
      P.add('trim', ring(0.212, 0.302, 0.011));
      P.add('trim', ribbons(2, (y) => (y < 0.22 ? 0.2 : 0.212), 0.12, 0.29, 0.6, 0.0055));
      return P;
    },
    r() {
      const P = new Piece(), h = fantasyFoot(P, 0.322);
      // a round tower with four tall arched windows, gold bands and square battlements
      const p = profile(0, h).line(0.236, h).curve([[0.226, 0.3], [0.222, 0.46], [0.228, 0.6]]).line(0.25, 0.61).line(0.25, 0.66).line(0.205, 0.66).line(0.205, 0.64).line(0, 0.64);
      P.lathe('body', p, { mod: MOD.arcade(4, 0.24, 0.56, 0.42, 0.14, { head: 0.08, pointed: true, phase: 0.5 }) });
      P.add('body', battlements(6, 0.205, 0.25, 0.655, 0.78, 0.36, 'flat'));
      P.add('trim', ring(0.236, h + 0.04, 0.01));
      P.add('trim', ring(0.251, 0.612, 0.011));
      P.add('trim', ribbons(2, (y) => 0.226 + 0.004 * Math.sin(y * 9), 0.15, 0.24, 0.25, 0.005));
      return P;
    },
    p() {
      const P = new Piece(), h = fantasyFoot(P, 0.27, 0.85);
      const f = (y) => mix(0.13, 0.062, smooth(h, 0.36, y));
      const p = byFn(profile(0, h), f, h, 0.36, 18);
      p.line(0.05, 0.37).line(0, 0.37);
      P.lathe('body', p, { mod: MOD.flutes(8, 0.06, h + 0.02, 0.35, { twist: 8, soft: true, end: 0.03 }) });
      P.add('trim', ribbons(2, f, h + 0.01, 0.35, 0.7, 0.0055));
      P.add('trim', ring(0.064, 0.362, 0.01));
      P.add('orb', sphere(0.1, 0, 0.46, 0, 32));
      return P;
    },
  };

  // ------------------------------------------------------------------ Royal Ivory & Sapphire
  // Ivory against royal blue, set with sapphires and laid with gold, for a king's tower above
  // the mountains. Every foot carries an enamel band studded with gold; the rook bears a shield
  // with a gold lily, the bishop a sapphire on its rounded mitre, the king a closed crown.
  function sapphireFoot(P, R, k) {
    k = k || 1;
    P.lathe('body', profile(0, 0).line(R - 0.01, 0).arc(R, 0.012, 0.3).line(R, 0.03 * k).line(R - 0.012, 0.036 * k).line(0, 0.036 * k));
    P.lathe('enamel', profile(0, 0.034 * k).line(R - 0.016, 0.034 * k).line(R - 0.016, 0.084 * k).line(0, 0.084 * k));
    P.add('trim', ring(R - 0.012, 0.036 * k, 0.008 * k));
    P.add('trim', ring(R - 0.018, 0.084 * k, 0.008 * k));
    P.add('trim', around(Math.round(R * 34), R - 0.014, 0.06 * k, () => cabochon(0.011 * k, 0.6)));
    return 0.084 * k;
  }
  const SAPPHIRE = {
    k() {
      const P = new Piece(), h = sapphireFoot(P, 0.35);
      const p = profile(0, h).line(0.19, h).curve([[0.172, 0.18], [0.14, 0.34], [0.122, 0.52], [0.12, 0.66]]).line(0.16, 0.67).arc(0.168, 0.69, 0.3).line(0.13, 0.7)
        .curve([[0.12, 0.74], [0.13, 0.8], [0.15, 0.86]]).line(0.15, 0.87).line(0, 0.87);
      P.lathe('body', p);
      P.add('trim', ring(0.168, 0.69, 0.01));
      // a closed crown: a band of points, two arches meeting over a sapphire orb
      P.add('trim', pointedCrown(0.15, 0.87, 8, 0.09, { flare: 0.1, w: 0.6 }));
      P.add('enamel', revolve(profile(0, 0.87).line(0.142, 0.87).curve([[0.14, 0.94], [0.1, 1.0], [0, 1.02]]), { segs: 48 }));
      for (const a of [0, Math.PI / 2]) P.add('trim', new THREE.TorusGeometry(0.135, 0.011, 8, 40, Math.PI).rotateY(a).translate(0, 0.9, 0));
      P.add('gem', sphere(0.034, 0, 1.06, 0, 18));
      P.add('trim', placeAt(crossOf('jewelled', 0.2, 0.036), 0, 0, 1.2));
      P.add('gem', frontGem(0.024, 0.13, 0.44));
      return P;
    },
    q() {
      const P = new Piece(), h = sapphireFoot(P, 0.335);
      const p = profile(0, h).line(0.182, h).curve([[0.164, 0.17], [0.132, 0.32], [0.112, 0.48], [0.11, 0.62]]).line(0.15, 0.63).arc(0.158, 0.65, 0.3).line(0.12, 0.66)
        .curve([[0.11, 0.7], [0.124, 0.77], [0.15, 0.83]]).line(0.15, 0.84).line(0, 0.84);
      P.lathe('body', p);
      P.add('trim', ring(0.158, 0.65, 0.01));
      // an open coronet of pearl-tipped points round a gold ball
      P.add('trim', pointedCrown(0.15, 0.84, 9, 0.12, { flare: 0.26, w: 0.62 }));
      P.add('enamel', ring(0.152, 0.86, 0.012));
      P.add('trim', sphere(0.05, 0, 0.92, 0, 20));
      P.add('gem', frontGem(0.022, 0.118, 0.42));
      return P;
    },
    b() {
      const P = new Piece(), h = sapphireFoot(P, 0.312);
      const p = profile(0, h).line(0.16, h).curve([[0.146, 0.16], [0.118, 0.3], [0.1, 0.44], [0.098, 0.54]]).line(0.13, 0.55).arc(0.136, 0.57, 0.3).line(0.09, 0.58);
      ovalHead(p, 0.08, 0.72, 0.1, 0.13, 0.5);
      P.lathe('body', p);
      P.add('trim', ring(0.136, 0.57, 0.009));
      // a sapphire set into the front of the mitre, in a gold collet
      P.add('trim', placeAt(lozenge(0.042, 1.45), 0, 0.088, 0.73));
      P.add('gem', placeAt(lozenge(0.034, 1.45), 0, 0.097, 0.73));
      P.add('trim', sphere(0.024, 0, 0.935, 0, 14));
      return P;
    },
    n() {
      const P = new Piece(), h = sapphireFoot(P, 0.322);
      P.lathe('body', knightBase(profile(0, h).line(0.2, h), 0.2));
      const hs = horse({ base: 0.31, mane: 'flow', seed: 89, form: { tuck: 0.14, neck: 0.06, chest: 0.14, reach: 0.02, ears: 0.18, girth: 0.96 } });
      P.add('body', hs.body); P.add('trim', hs.mane);
      P.add('enamel', ring(0.212, 0.3, 0.014));
      return P;
    },
    r() {
      const P = new Piece(), h = sapphireFoot(P, 0.322);
      const p = profile(0, h).line(0.234, h).curve([[0.224, 0.28], [0.22, 0.44], [0.226, 0.58]]).line(0.25, 0.59).line(0.25, 0.65).line(0.206, 0.65).line(0.206, 0.63).line(0, 0.63);
      P.lathe('body', p);
      P.add('body', battlements(5, 0.206, 0.25, 0.645, 0.77, 0.4, 'flat'));
      P.add('trim', ring(0.25, 0.592, 0.009));
      // the king's arms: a blue shield with a gold lily, framed in gold
      P.add('trim', placeAt(heater(0.25, 0.012), 0, 0.226, 0.4));
      P.add('enamel', placeAt(heater(0.218, 0.012), 0, 0.232, 0.4));
      P.add('trim', placeAt(fleur(0.13, 0.012), 0, 0.24, 0.41));
      return P;
    },
    p() {
      const P = new Piece(), h = sapphireFoot(P, 0.27, 0.85);
      const p = profile(0, h).line(0.13, h).curve([[0.11, 0.16], [0.084, 0.26], [0.076, 0.31]]).line(0.1, 0.32).arc(0.104, 0.336, 0.3).line(0.07, 0.345);
      ballHead(p, 0.07, 0.45, 0.1);
      P.lathe('body', p);
      P.add('enamel', ring(0.103, 0.334, 0.011));
      return P;
    },
  };

  // ------------------------------------------------------------------ Royal Navy
  // Ivory with rubies against deep navy with sapphires, all in gold, for an admiral's cabin.
  // The feet are wound with gold rope, a ribbon of the other colour spirals up the king and
  // queen, the bishop's mitre holds a glowing gem, the rook has portholes and the king's cross
  // ends in an anchor.
  function navyFoot(P, R, k) {
    k = k || 1;
    P.lathe('body', profile(0, 0).line(R - 0.01, 0).arc(R, 0.012, 0.3).line(R, 0.026 * k).line(R - 0.02, 0.034 * k)
      .curve([[R - 0.03, 0.06 * k], [R - 0.06, 0.09 * k], [R - 0.1, 0.11 * k]]).line(0, 0.11 * k), { mod: MOD.lobes(16, 0.06, 0.034 * k, 0.1 * k, { shape: 0.7 }) });
    // a gold rope moulding round the plinth
    P.lathe('trim', profile(0, 0.016 * k).line(R + 0.004, 0.016 * k).arc(R + 0.004, 0.04 * k, 0.6).line(0, 0.04 * k), { mod: MOD.rope(18, 0.5, 0.016 * k, 0.04 * k, 1) });
    P.add('gem', around(4, R - 0.03, 0.068 * k, () => lozenge(0.016 * k, 1.3), { tilt: -0.45, phase: Math.PI / 4 }));
    return 0.11 * k;
  }
  const NAVY = {
    k() {
      const P = new Piece(), h = navyFoot(P, 0.35);
      const f = (y) => mix(0.18, 0.112, smooth(h, 0.5, y)) + 0.05 * smooth(0.6, 0.82, y);
      const p = byFn(profile(0, h), f, h, 0.82, 26);
      p.line(0.17, 0.83).line(0.17, 0.85).line(0, 0.85);
      P.lathe('body', p);
      // a broad ribbon of the other colour winding once round the body
      const rb = strip(f, 0.16, 0.8, 0.85, 0.07); P.add('band', rb.band); P.add('trim', rb.edges);
      P.add('trim', ring(0.17, 0.835, 0.011));
      // an open crown of six points, each set with a gem, round a dark orb
      P.add('trim', pointedCrown(0.16, 0.85, 6, 0.13, { flare: 0.2, w: 0.82 }));
      P.add('gem', around(6, 0.168, 0.9, () => lozenge(0.02, 1.3), { tilt: 0.2 }));
      P.add('orb', sphere(0.1, 0, 0.94, 0, 28));
      P.add('trim', ring(0.06, 1.03, 0.01));
      P.add('trim', placeAt(crossOf('anchor', 0.22, 0.036), 0, 0, 1.15));
      return P;
    },
    q() {
      const P = new Piece(), h = navyFoot(P, 0.335);
      const f = (y) => mix(0.172, 0.1, smooth(h, 0.48, y)) + 0.05 * smooth(0.56, 0.78, y);
      const p = byFn(profile(0, h), f, h, 0.78, 24);
      p.line(0.16, 0.79).line(0.16, 0.81).line(0, 0.81);
      P.lathe('body', p);
      const rb = strip(f, 0.15, 0.76, -0.85, 0.06); P.add('band', rb.band); P.add('trim', rb.edges);
      P.add('trim', ring(0.16, 0.795, 0.011));
      // a coronet of ten slim points with a gem at the foot of each, and a dark orb
      P.add('trim', pointedCrown(0.15, 0.81, 10, 0.12, { flare: 0.3, w: 0.6 }));
      P.add('gem', around(10, 0.156, 0.835, () => cabochon(0.013, 0.6)));
      P.add('orb', sphere(0.075, 0, 0.88, 0, 24));
      P.add('trim', sphere(0.022, 0, 0.97, 0, 12));
      return P;
    },
    b() {
      const P = new Piece(), h = navyFoot(P, 0.312);
      const p = profile(0, h).line(0.16, h).curve([[0.13, 0.2], [0.104, 0.36], [0.1, 0.5]]).line(0.136, 0.51).line(0.136, 0.535).line(0.092, 0.545)
        .curve([[0.13, 0.62], [0.138, 0.72], [0.11, 0.84], [0.06, 0.92], [0.02, 0.96]]).line(0, 0.965);
      P.lathe('body', p, { mod: MOD.slit(Math.PI, 0.82, 0.55, 0.02, 0.5) });
      P.add('trim', ring(0.136, 0.523, 0.01));
      // a glowing gem in a gold frame on the front of the mitre
      P.add('trim', placeAt(new THREE.TorusGeometry(0.04, 0.008, 6, 4).rotateZ(Math.PI / 4).scale(0.8, 1.25, 1), 0, 0.134, 0.68));
      P.add('glow', placeAt(lozenge(0.034, 1.5), 0, 0.128, 0.68));
      P.add('trim', sphere(0.02, 0, 0.985, 0, 12));
      return P;
    },
    n() {
      const P = new Piece(), h = navyFoot(P, 0.322);
      P.lathe('body', knightBase(profile(0, h).line(0.2, h), 0.2));
      const hs = horse({ base: 0.31, mane: 'flow', seed: 97, form: { tuck: -0.16, neck: 0.1, lean: 0.12, reach: 0.08, ears: 0.28, chest: 0.16, girth: 0.92, headW: 0.94 } });
      P.add('body', hs.body); P.add('trim', hs.mane);
      // a ribbon sash of the other colour round the neck
      const sash = [];
      for (let i = 0; i <= 20; i++) { const a = mix(-2.6, 2.6, i / 20); sash.push(hs.surf([0, hs.Y(0.5) + Math.cos(a) * 0.03, 0.0], [Math.sin(a), 0.1, Math.cos(a)], 0.006)); }
      P.add('band', K.tube(sash, 0.014, { segs: 40, radial: 8 }));
      P.add('trim', ring(0.212, 0.302, 0.01));
      return P;
    },
    r() {
      const P = new Piece(), h = navyFoot(P, 0.322);
      const p = profile(0, h).line(0.226, h).curve([[0.218, 0.3], [0.214, 0.44], [0.22, 0.56]]).line(0.244, 0.57).line(0.244, 0.64).line(0.2, 0.64).line(0.2, 0.62).line(0, 0.62);
      P.lathe('body', p, { mod: MOD.rope(10, 0.06, 0.3, 0.34, 1) });
      P.add('body', battlements(6, 0.2, 0.244, 0.635, 0.76, 0.34, 'flat'));
      P.add('trim', ring(0.244, 0.572, 0.01));
      P.add('trim', ring(0.222, 0.3, 0.007)); P.add('trim', ring(0.222, 0.34, 0.007));
      // a gem badge in front and gold-rimmed portholes all round
      P.add('trim', placeAt(new THREE.TorusGeometry(0.044, 0.008, 6, 4).rotateZ(Math.PI / 4).scale(0.8, 1.2, 1), 0, 0.222, 0.46));
      P.add('gem', frontGem(0.034, 0.214, 0.46, 1.4));
      P.add('trim', around(5, 0.222, 0.45, () => new THREE.TorusGeometry(0.026, 0.006, 6, 20), { phase: TAU / 5 * 0.5 + TAU / 10 }));
      P.add('orb', around(5, 0.214, 0.45, () => cabochon(0.022, 0.3), { phase: TAU / 5 * 0.5 + TAU / 10 }));
      return P;
    },
    p() {
      const P = new Piece(), h = navyFoot(P, 0.27, 0.85);
      const p = profile(0, h).line(0.13, h).curve([[0.12, 0.15], [0.09, 0.22], [0.08, 0.27]]).line(0.11, 0.28).line(0.11, 0.3).line(0.07, 0.31);
      ballHead(p, 0.07, 0.42, 0.098);
      P.lathe('body', p);
      P.add('trim', ring(0.11, 0.29, 0.009));
      P.add('gem', frontGem(0.018, 0.1, 0.22, 1.3));
      return P;
    },
  };

  // ------------------------------------------------------------------ Opulent Emerald
  // Ivory against deep green-black marble, set with emeralds in gold, for a stargazer's tower.
  // Kings and queens are cut into eight facets, every foot steps up in three tiers studded with
  // emeralds, the bishop is an onion dome and the rook's arched windows glow with lamplight.
  function emeraldFoot(P, R, k) {
    k = k || 1;
    P.lathe('body', profile(0, 0).line(R - 0.01, 0).arc(R, 0.01, 0.3).line(R, 0.026 * k).line(R - 0.03, 0.03 * k).line(R - 0.03, 0.06 * k)
      .line(R - 0.06, 0.064 * k).line(R - 0.06, 0.092 * k).line(R - 0.09, 0.096 * k).line(0, 0.1 * k));
    P.add('trim', ring(R - 0.001, 0.026 * k, 0.006 * k)); P.add('trim', ring(R - 0.031, 0.06 * k, 0.006 * k)); P.add('trim', ring(R - 0.061, 0.092 * k, 0.006 * k));
    P.add('gem', around(8, R - 0.028, 0.046 * k, () => brilliant(0.012 * k), { phase: TAU / 16 }));
    return 0.1 * k;
  }
  const EMERALD = {
    k() {
      const P = new Piece(), h = emeraldFoot(P, 0.35);
      const p = profile(0, h).line(0.17, h).curve([[0.15, 0.24], [0.13, 0.4], [0.124, 0.62]]).line(0.15, 0.68).line(0.162, 0.76).line(0.13, 0.8).line(0, 0.8);
      P.lathe('body', p, { mod: MOD.facets(8, h, 0.8, 0.12) });
      P.add('trim', ring(0.163, 0.762, 0.01));
      // a crown of eight arches, an emerald in each, under a gold ball and a pommee cross
      P.add('trim', pointedCrown(0.14, 0.8, 8, 0.14, { flare: 0.12, w: 0.86 }));
      P.add('gem', around(8, 0.146, 0.84, () => lozenge(0.02, 1.3)));
      P.lathe('body', profile(0, 0.8).line(0.13, 0.8).curve([[0.12, 0.88], [0.08, 0.95], [0, 0.97]]), { segs: 48 });
      P.add('trim', sphere(0.034, 0, 1.0, 0, 16));
      P.add('trim', placeAt(crossOf('pommee', 0.2, 0.036), 0, 0, 1.14));
      P.add('gem', frontGem(0.026, 0.14, 0.42, 1.5));
      return P;
    },
    q() {
      const P = new Piece(), h = emeraldFoot(P, 0.335);
      const p = profile(0, h).line(0.162, h).curve([[0.14, 0.22], [0.12, 0.38], [0.114, 0.58]]).line(0.142, 0.64).line(0.152, 0.72).line(0.12, 0.75).line(0, 0.75);
      P.lathe('body', p, { mod: MOD.facets(8, h, 0.75, 0.12) });
      P.add('trim', ring(0.153, 0.722, 0.01));
      // six tall points, an emerald on each tip, round a great emerald
      P.add('trim', pointedCrown(0.13, 0.75, 6, 0.16, { flare: 0.3, w: 0.7 }));
      P.add('gem', around(6, 0.13 + 0.16 * 0.75 * Math.sin(0.3), 0.92, () => brilliant(0.014), { tilt: -0.6 }));
      P.add('gem', brilliant(0.05).rotateX(-Math.PI / 2).translate(0, 0.86, 0));
      P.add('gem', frontGem(0.024, 0.13, 0.4, 1.5));
      return P;
    },
    b() {
      const P = new Piece(), h = emeraldFoot(P, 0.312);
      const p = profile(0, h).line(0.15, h).curve([[0.13, 0.2], [0.104, 0.36], [0.098, 0.5]]).line(0.13, 0.51).line(0.13, 0.535).line(0.08, 0.545);
      // an onion dome drawn up into a point
      p.curve([[0.13, 0.6], [0.145, 0.68], [0.12, 0.76], [0.06, 0.84], [0.018, 0.9]]).line(0, 0.905);
      P.lathe('body', p);
      P.add('trim', ring(0.13, 0.523, 0.009));
      P.add('trim', placeAt(new THREE.TorusGeometry(0.04, 0.007, 6, 4).rotateZ(Math.PI / 4).scale(0.75, 1.2, 1), 0, 0.136, 0.66));
      P.add('gem', placeAt(lozenge(0.032, 1.5), 0, 0.13, 0.66));
      P.add('trim', new THREE.CylinderGeometry(0.006, 0.008, 0.06, 8).translate(0, 0.93, 0));
      P.add('trim', sphere(0.018, 0, 0.97, 0, 12));
      return P;
    },
    n() {
      const P = new Piece(), h = emeraldFoot(P, 0.322);
      P.lathe('body', knightBase(profile(0, h).line(0.2, h), 0.2));
      const hs = horse({ base: 0.31, mane: 'carved', seed: 101, form: { tuck: 0.2, neck: 0.1, reach: 0.04, ears: 0.26, girth: 0.9, chest: 0.1, nose: -0.01 } });
      P.add('body', hs.body);
      // emerald eyes and an emerald on the brow
      const sp = hs.surf([0, hs.Y(0.9), 0.08], [0, 0.4, 1], 0.003), g = lozenge(0.02, 1.3); g.rotateX(-0.5); g.translate(sp[0], sp[1], sp[2]); P.add('gem', g);
      P.add('trim', ring(0.212, 0.302, 0.01));
      P.add('gem', around(6, 0.214, 0.26, () => brilliant(0.012)));
      return P;
    },
    r() {
      const P = new Piece(), h = emeraldFoot(P, 0.322);
      const p = profile(0, h).line(0.232, h).curve([[0.222, 0.28], [0.218, 0.44], [0.224, 0.56]]).line(0.248, 0.57).line(0.248, 0.64).line(0.204, 0.64).line(0.204, 0.62).line(0, 0.62);
      P.lathe('body', p, { mod: MOD.facets(8, h, 0.6, 0.2) });
      P.add('body', battlements(8, 0.204, 0.248, 0.635, 0.75, 0.42, 'point'));
      P.add('trim', ring(0.248, 0.572, 0.009));
      // tall arched windows, lit from inside, in gold frames
      const win = () => { const s = new THREE.Shape(); s.moveTo(-0.034, 0); s.lineTo(0.034, 0); s.lineTo(0.034, 0.1); s.absarc(0, 0.1, 0.034, 0, Math.PI, false); s.closePath(); return s; };
      const pane = new THREE.ShapeGeometry(win(), 12);
      P.add('window', around(4, 0.212, 0.32, () => pane.clone(), { phase: Math.PI / 4 }));
      P.add('trim', around(4, 0.21, 0.32, () => { const g = new THREE.ShapeGeometry(win(), 12); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) pos.setXY(i, pos.getX(i) * 1.3, pos.getY(i) * 1.12 - 0.008); g.translate(0, 0, -0.003); return g; }, { phase: Math.PI / 4 }));
      P.add('gem', frontGem(0.026, 0.224, 0.5, 1.3));
      return P;
    },
    p() {
      const P = new Piece(), h = emeraldFoot(P, 0.27, 0.85);
      const p = profile(0, h).line(0.12, h).curve([[0.13, 0.13], [0.12, 0.2], [0.085, 0.26], [0.07, 0.3]]).line(0.1, 0.31).line(0.1, 0.33).line(0.068, 0.34);
      ballHead(p, 0.068, 0.44, 0.097);
      P.lathe('body', p, { mod: MOD.facets(8, h, 0.3, 0.3) });
      P.add('trim', ring(0.1, 0.32, 0.008));
      P.add('gem', frontGem(0.016, 0.118, 0.17, 1.3));
      return P;
    },
  };

  // ------------------------------------------------------------------ Dragon & Pagoda
  // Porcelain white with crimson silk against midnight lacquer with glowing blue, all in gold, for
  // a pavilion by a mountain waterfall. The king and queen are an emperor and an empress in long
  // robes, the knights are dragons, the bishops lotus flames holding a glowing pearl, the rooks
  // lantern pagodas with lit windows, and the pawns little courtiers in silk capes.
  function pagodaFoot(P, R, k, plain) {
    k = k || 1;
    P.lathe('body', profile(0, 0).line(R - 0.01, 0).arc(R, 0.012, 0.3).line(R, 0.07 * k).arc(R - 0.012, 0.082 * k, 0.3).line(0, 0.082 * k));
    P.add('trim', ring(R + 0.001, 0.012 * k, 0.01 * k)); P.add('trim', ring(R - 0.006, 0.078 * k, 0.009 * k));
    // little gold cloud badges round the drum
    if (!plain) P.add('trim', around(Math.round(R * 22), R, 0.044 * k, () => merge([sphere(0.012 * k, -0.01 * k, 0, 0, 6), sphere(0.014 * k, 0.006 * k, 0.004 * k, 0, 6), sphere(0.01 * k, 0.02 * k, -0.004 * k, 0, 6)]).scale(1, 1, 0.4)));
    return 0.082 * k;
  }
  // A robed figure for the king and queen: a long flared robe, a silk sash, wide sleeves,
  // hands folded, a head and a crown; s is the figure's scale.
  function robed(P, y0, s, o) {
    const A = at([0, y0, 0], s);
    const skin = new Sculpt(0.014, 1.1), robe = new Sculpt(0.022, 1.25);
    robe.floor = y0 - 0.004;
    P.lathe('cloth', profile(0, y0).line(0.17 * s, y0).curve([[0.16 * s, y0 + 0.12 * s], [0.125 * s, y0 + 0.3 * s], [0.09 * s, y0 + 0.5 * s], [0.07 * s, y0 + 0.58 * s]]).line(0, y0 + 0.58 * s),
      { mod: MOD.flutes(14, 0.1, y0 + 0.01, y0 + 0.5 * s, { soft: true, end: 0.03 }) });
    robe.ell(A(0, 0.6, 0.004), [0.085 * s, 0.12 * s, 0.065 * s], 0.03);
    robe.pair((x) => robe.ell(A(x * 0.088, 0.68, 0), [0.04 * s, 0.034 * s, 0.04 * s], 0.025));
    // wide sleeves meeting in front, the hands hidden inside
    robe.pair((x) => robe.cone(A(x * 0.095, 0.67, 0), A(x * 0.035, 0.54, 0.08), 0.036 * s, 0.062 * s, 0.03));
    skin.cone(A(0, 0.68, 0.004), A(0, 0.74, 0.006), 0.024 * s, 0.022 * s, 0.01);
    const hd = head(skin, A(0, 0.8, 0.01), 0.06 * s, o.beard ? { beard: 0.4, moustache: true } : {});
    skin.ell(A(0, 0.83, -0.014), [0.06 * s, 0.058 * s, 0.056 * s], 0.012);   // hair drawn up under the crown
    P.add('cloth', robe.mesh()); P.add('body', skin.mesh()); eyes(P, hd);
    // a silk sash across the chest and down the robe
    const sash = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; sash.push(A(mix(0.07, -0.08, t), mix(0.7, 0.18, t), 0.06 + 0.035 * Math.sin(t * Math.PI) + (1 - t) * 0.0)); }
    P.add('silk', K.tube(sash, 0.016 * s, { segs: 32, radial: 8 }));
    P.add('trim', ring(0.16 * s, y0 + 0.01, 0.008));
    P.add('trim', ring(0.072 * s, y0 + 0.575 * s, 0.006 * s));
    P.add('trim', ring(0.03 * s, y0 + 0.705 * s, 0.006 * s));
    return { A, top: y0 + 0.86 * s, hd };
  }
  const PAGODA = {
    k() {
      const P = new Piece(), y0 = pagodaFoot(P, 0.35), s = 1.12;
      const f = robed(P, y0, s, { beard: true });
      // a tall gold crown with points and a cross of curling clouds
      P.add('trim', pointedCrown(0.056 * s, f.top - 0.02, 7, 0.1 * s, { flare: 0.22, w: 0.62 }));
      P.add('glow', cabochon(0.016, 0.6).translate(0, f.top + 0.02, 0.064 * s));
      P.add('trim', placeAt(crossOf('cloud', 0.2, 0.034), 0, 0, f.top + 0.2));
      return P;
    },
    q() {
      const P = new Piece(), y0 = pagodaFoot(P, 0.335), s = 1.06;
      const f = robed(P, y0, s, {});
      // a phoenix headdress: a fan of tall gold points round a glowing jewel
      P.add('trim', pointedCrown(0.05 * s, f.top - 0.03, 9, 0.12 * s, { flare: 0.4, w: 0.5 }));
      P.add('glow', sphere(0.022, 0, f.top + 0.03, 0.03, 14));
      for (const x of [-1, 1]) P.add('trim', K.tube([[x * 0.06 * s, f.top - 0.02, 0], [x * 0.1 * s, f.top - 0.08, 0.01], [x * 0.11 * s, f.top - 0.15, 0.0]], 0.005, { segs: 12, radial: 5 }));
      return P;
    },
    b() {
      const P = new Piece(), h = pagodaFoot(P, 0.312);
      const p = profile(0, h).line(0.15, h).curve([[0.12, 0.2], [0.09, 0.36], [0.085, 0.5]]).line(0.13, 0.51).line(0.13, 0.535).line(0.07, 0.545).line(0, 0.55);
      P.lathe('body', p);
      P.add('trim', ring(0.13, 0.523, 0.009));
      P.add('silk', ring(0.095, 0.47, 0.012));
      // a lotus cup holding a flame of porcelain, edged in gold, with a glowing pearl at its heart
      P.add('body', around(8, 0.07, 0.53, () => curl(petal(0.07, 0.12, 0.012), 1.2), { tilt: 0.75 }));
      P.add('trim', around(8, 0.066, 0.528, () => curl(petal(0.08, 0.13, 0.007), 1.2), { tilt: 0.75 }));
      const flame = (k) => { const pts = []; for (let i = 0; i <= 40; i++) { const u = (i / 40) * TAU, c = Math.cos(u), sn = Math.sin(u); const y = (1 - c) / 2; pts.push([sn * 0.13 * k * Math.pow(1 - y, 0.5) * Math.pow(y, 0.35) * 1.9, y * 0.4 * k]); } return pts; };
      const hole = flame(0.62).map(([x, y]) => [x, y + 0.07]);
      const fl = extrude(flame(1), 0.04, 0.008, { holes: [hole.reverse()] }); fl.translate(0, 0.58, 0); P.add('body', fl);
      const rim = extrude(flame(1.08), 0.022, 0.004, { holes: [flame(0.94).map(([x, y]) => [x, y + 0.01]).reverse()] }); rim.translate(0, 0.575, 0); P.add('trim', rim);
      P.add('glow', sphere(0.045, 0, 0.58 + 0.07 + 0.124 * 0.62 * 0.9, 0, 20));
      P.add('trim', sphere(0.014, 0, 0.58 + 0.4 + 0.02, 0, 10));
      return P;
    },
    n() {
      const P = new Piece(), h = pagodaFoot(P, 0.322);
      P.lathe('body', knightBase(profile(0, h).line(0.2, h), 0.2));
      // a dragon: a long snout, swept-back horns, whiskers and a crest of spines down the neck
      const hs = horse({ base: 0.31, mane: 'flow', seed: 103, form: { tuck: -0.06, reach: 0.34, nose: -0.03, neck: 0.12, girth: 0.86, jaw: 0.02, ears: -0.35, headW: 1.06 } });
      P.add('body', hs.body); P.add('silk', hs.mane);
      const Y = hs.Y;
      for (const s of [-1, 1]) {
        const a = hs.surf([s * 0.02, Y(0.95), 0.0], [s * 0.5, 1, -0.3], -0.004);
        P.add('trim', K.tube([a, [a[0] + s * 0.025, a[1] + 0.07, a[2] - 0.05], [a[0] + s * 0.04, a[1] + 0.1, a[2] - 0.16], [a[0] + s * 0.03, a[1] + 0.07, a[2] - 0.27]], 0.016, { segs: 20, radial: 8, radiusAt: (t) => mix(1, 0.15, t) }));
        const w = hs.surf([s * 0.02, Y(0.74), 0.26], [s, 0, 0.2], -0.002);
        P.add('trim', K.tube([w, [w[0] + s * 0.05, w[1] - 0.01, w[2] + 0.02], [w[0] + s * 0.09, w[1] - 0.05, w[2] - 0.0], [w[0] + s * 0.1, w[1] - 0.1, w[2] - 0.03]], 0.005, { segs: 16, radial: 5, radiusAt: (t) => mix(1, 0.3, t) }));
      }
      // spines down the back of the neck
      const spines = [];
      for (let i = 0; i < 6; i++) { const t = i / 5, q = hs.surf([0, Y(mix(0.9, 0.5, t)), 0.0], [0, mix(0.6, 0.1, t), -1], -0.002); const c = new THREE.ConeGeometry(0.018, mix(0.07, 0.045, t), 6); c.rotateX(-mix(0.9, 1.4, t)); c.translate(q[0], q[1], q[2]); spines.push(c); }
      P.add('trim', merge(spines));
      const sp = hs.surf([0, Y(0.9), 0.1], [0, 0.4, 1], 0.003), gem = cabochon(0.016, 0.6); gem.rotateX(-0.6); gem.translate(sp[0], sp[1], sp[2]); P.add('glow', gem);
      P.add('trim', ring(0.212, 0.302, 0.01));
      return P;
    },
    r() {
      const P = new Piece(), h = pagodaFoot(P, 0.322);
      // a lantern pagoda: a six-sided lantern with glowing windows under two upturned roofs
      const p = profile(0, h).line(0.2, h).line(0.17, 0.14).line(0.17, 0.4).line(0, 0.4);
      P.lathe('body', p, { mod: MOD.facets(6, h, 0.41, 0) });
      P.add('window', around(6, 0.151, 0.27, () => new THREE.PlaneGeometry(0.1, 0.17), { phase: TAU / 12 }));
      P.add('trim', around(6, 0.153, 0.27, () => merge([new THREE.BoxGeometry(0.11, 0.008, 0.008).translate(0, 0.088, 0), new THREE.BoxGeometry(0.11, 0.008, 0.008).translate(0, -0.088, 0), new THREE.BoxGeometry(0.006, 0.17, 0.008), new THREE.BoxGeometry(0.1, 0.005, 0.006)]), { phase: TAU / 12 }));
      P.add('trim', pagoda(0.11, 0.27, 0.4, 0.55, { up: 0.04 }));
      P.lathe('body', profile(0, 0.54).line(0.1, 0.54).line(0.1, 0.62).line(0, 0.62), { mod: MOD.facets(6, 0.53, 0.63, 0) });
      P.add('trim', pagoda(0.07, 0.19, 0.62, 0.74, { up: 0.03 }));
      P.add('trim', merge([sphere(0.024, 0, 0.77, 0, 12), new THREE.ConeGeometry(0.012, 0.1, 8).translate(0, 0.83, 0)]));
      return P;
    },
    p() {
      const P = new Piece(), h = pagodaFoot(P, 0.27, 0.85, true);
      // a little courtier: a flared silk cape over a robe, a gold collar and a round head
      const p = profile(0, h).line(0.12, h).curve([[0.11, 0.14], [0.08, 0.24], [0.064, 0.31]]).line(0.06, 0.33);
      ballHead(p, 0.06, 0.43, 0.09);
      P.lathe('body', p);
      P.lathe('silk', profile(0, 0.31).line(0.07, 0.31).curve([[0.1, 0.25], [0.13, 0.17], [0.135, 0.11]]).line(0.125, 0.105).curve([[0.12, 0.16], [0.09, 0.24], [0.064, 0.3]]).line(0, 0.3), { mod: MOD.lobes(8, 0.18, 0.1, 0.28, { shape: 0.6 }) });
      P.add('trim', ring(0.066, 0.318, 0.012));
      P.add('trim', around(4, 0.07, 0.33, () => ray(0.03, 0.04, 0.006), { tilt: -0.9 }));
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
      mesh: 'classic2', meshLook: { b: { clearcoat: 0.5 } },
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
      mesh: 'classic2', meshLook: { b: { clearcoat: 0.55 } },
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
      mesh: 'classic2', meshLook: { b: { clearcoat: 0.6 } },
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
    elves: {
      id: 'elves', name: 'Orcs & Elves', era: 'A fantasy realm', year: 'Once upon a time', tint: '#1e3a6a',
      story: 'Two armies of the old fantasy tales meet across the board. The elves of the silver forest come in white and gold with blue crystals; the orc clans of the burning hills come in green, red leather and iron, riding great grey wolves.',
      lore: {
        k: 'White: the elf king, his sword point down and a crown of golden leaves. Black: the orc warchief in a fur mantle, with a war hammer and a crown of tusks.',
        q: 'White: the elf queen with a flower in her hand. Black: the orc warrior queen with a curved blade.',
        b: 'White: an elf mage with a blue crystal staff. Black: an orc shaman whose staff crackles with blue light.',
        n: 'White: a white stag with golden antlers. Black: a great grey wolf, snarling on its rock.',
        r: 'White: a slender tower with a crystal spire. Black: a watchtower of stone and stakes with a fire inside.',
        p: 'White: an elf guard with spear and leaf shield. Black: an orc grunt with axe and wooden shield.',
      },
      pieces: ELVES, piecesB: ORCS,
      mats: (side) => (side === 'w'
        ? { body: MATS.ivoryEnamel(), base: phys('elf-base', { map: TEX.marble('#f2eee6', '#c8bca0', { scale: 2, strength: 0.3 }), roughness: 0.3, clearcoat: 0.6 }), stone: phys('elf-stone', { map: TEX.marble('#f6f2ea', '#d0c6b0', { scale: 2, strength: 0.25 }), roughness: 0.35, clearcoat: 0.4 }), skin: phys('elf-skin', { color: '#eec4a6', roughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color('#ffe8e0') }), cloth: phys('elf-white', { color: '#f4f0e8', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }), cloth2: lacquer('elf-blue', '#24449a', { sheen: 0.5, sheenColor: new THREE.Color('#8ab0ff') }), hair: phys('elf-hair', { color: '#f0d68a', roughness: 0.4, metalness: 0.2, sheen: 0.8, sheenColor: new THREE.Color('#fff0b0') }), trim: MAT.gold('#e8c060'), steel: MAT.silver(), accent: MAT.gold('#e8c060'), crystal: phys('elf-crystal', { color: '#7ac8ff', roughness: 0.05, emissive: '#2a8aff', emissiveIntensity: 0.9, clearcoat: 1 }), glow: phys('elf-glow', { color: '#9ad8ff', emissive: '#4aa8ff', emissiveIntensity: 1.4, roughness: 0.3 }), leaf: phys('elf-ivy', { color: '#4a8a3a', roughness: 0.6 }), eye: MAT.lacquer('#1e2a4a') }
        : { body: phys('orc-skin-b', { color: '#6a8a3a', roughness: 0.5 }), base: phys('orc-base', { map: TEX.stone('#3a3430', '#5a5048', { scale: 4, cloud: 0.4, speckMix: 0.5 }), roughness: 0.85 }), stone: phys('orc-stone', { map: TEX.stone('#4a4440', '#6a6058', { scale: 4, cloud: 0.4, speckMix: 0.5 }), roughness: 0.9 }), skin: phys('orc-skin', { color: '#6f9a3c', roughness: 0.48, sheen: 0.3, sheenColor: new THREE.Color('#c8f080') }), cloth: phys('orc-leather', { color: '#4e2e1c', roughness: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.35, sheen: 0.3, sheenColor: new THREE.Color('#c08050') }), cloth2: phys('orc-hood', { color: '#a02a1e', roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#ff7050') }), hair: phys('orc-hair', { color: '#1a1410', roughness: 0.6 }), fur: phys('orc-fur', { color: '#5e5c5a', roughness: 0.75, sheen: 0.6, sheenColor: new THREE.Color('#c8c8c8') }), fur2: phys('orc-fur2', { color: '#b8b4ac', roughness: 0.8, sheen: 0.6, sheenColor: new THREE.Color('#ffffff') }), wood: phys('orc-wood', { map: TEX.wood('#6a4428', '#3a2414', { lines: 18, contrast: 0.5, seed: 31 }), roughness: 0.75 }), trim: MAT.bronze(), steel: phys('orc-iron', { color: '#5a5c62', metalness: 0.9, roughness: 0.42 }), tusk: MATS.ivoryEnamel(), banner: phys('orc-banner', { color: '#b0261c', roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color('#ff6040') }), accent: MAT.gem('#d0201a'), glow: phys('orc-glow', { color: '#ffb060', emissive: '#ff6a1a', emissiveIntensity: 1.6, roughness: 0.4 }), eye: MAT.lacquer('#1a0e08') }),
    },
    sunshadow: {
      id: 'sunshadow', name: 'Sun Kingdom & Shadow Legion', era: 'A storybook land in the clouds', year: 'Once upon a time', tint: '#3a2a6a',
      story: 'A storybook set from the floating isles. The Sun Kingdom comes in cream, royal blue and gold: a jolly king, a princess, a wizard and sunny villagers. The Shadow Legion comes in midnight purple, with glowing violet magic and grumpy little imps.',
      lore: {
        k: 'White: the jolly Sun King with his sun sceptre. Black: the Shadow King in a horned crown, violet fire in his hand.',
        q: 'White: the princess in a golden gown, waving hello. Black: the shadow sorceress with a flame in her palm.',
        b: 'White: the court wizard in a hat full of stars. Black: a hooded mage with glowing eyes.',
        n: 'White: a round pony with a mane of sun rays. Black: a little shadow dragon with bat wings.',
        r: 'White: a castle turret with a blue roof. Black: a dark spire with spikes.',
        p: 'White: a villager in a sunflower hat. Black: a grumpy shadow imp.',
      },
      pieces: SUNKING, piecesB: SHADOW,
      mats: (side) => (side === 'w'
        ? { body: MATS.cream(), base: lacquer('sun-base', '#f4ead6'), stone: phys('sun-stone', { map: TEX.stone('#f2e6cc', '#d8c8a4', { scale: 3, cloud: 0.5, speckMix: 0.2 }), roughness: 0.6 }), skin: phys('sun-skin', { color: '#f8c8a0', roughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color('#ffd8c8') }), cloth: lacquer('sun-cream', '#fbf2de'), cloth2: lacquer('sun-blue', '#2a4ab8', { sheen: 0.4, sheenColor: new THREE.Color('#8aa8ff') }), cape: lacquer('sun-red', '#c8202a', { sheen: 0.5, sheenColor: new THREE.Color('#ff8a8a') }), fur: phys('sun-ermine', { color: '#fbfaf6', roughness: 0.7, sheen: 1, sheenColor: new THREE.Color('#ffffff') }), hair: lacquer('sun-hair', '#e8906a'), wood: lacquer('sun-wood', '#a8642a'), hoof: MAT.gold('#e8b850'), trim: MAT.gold('#f0c050'), accent: MAT.gem('#e8304a'), glow: phys('sun-glow', { color: '#ffe070', emissive: '#ffb020', emissiveIntensity: 1.3, roughness: 0.3 }), banner: lacquer('sun-banner', '#2a4ab8'), eye: MAT.lacquer('#2a1a14') }
        : { body: lacquer('shadow-body', '#2a1a40'), base: lacquer('shadow-base', '#1e1428'), stone: phys('shadow-stone', { map: TEX.stone('#2a2232', '#4a3a58', { scale: 4, cloud: 0.4, speckMix: 0.4 }), roughness: 0.55, clearcoat: 0.4 }), skin: phys('shadow-skin', { color: '#b8a8d8', roughness: 0.4, sheen: 0.5, sheenColor: new THREE.Color('#e0d0ff') }), cloth: lacquer('shadow-cloth', '#3a2458', { sheen: 0.5, sheenColor: new THREE.Color('#a070ff') }), cloth2: lacquer('shadow-purple', '#4a1e78', { sheen: 0.6, sheenColor: new THREE.Color('#c890ff') }), hair: lacquer('shadow-hair', '#1a1024'), wood: lacquer('shadow-wood', '#2a1a1a'), horn: lacquer('shadow-horn', '#e8dcc8'), wing: lacquer('shadow-wing', '#5a2a8a', { side: THREE.DoubleSide }), void: MAT.matte('#05030a'), steel: phys('shadow-steel', { color: '#3a3a4a', metalness: 0.9, roughness: 0.3 }), trim: MAT.gold('#c8a0e8'), accent: MAT.gem('#a020f0'), glow: phys('shadow-glow', { color: '#e0a0ff', emissive: '#a030ff', emissiveIntensity: 1.8, roughness: 0.3 }), banner: lacquer('shadow-banner', '#5a1a7a'), eye: MAT.lacquer('#2a1040') }),
    },
    galactic: {
      id: 'galactic', name: 'Galactic Blue & Red', era: 'Far out among the stars', year: 'The far future', tint: '#1a2050',
      story: 'Two star fleets meet on a lit grid above a blue planet. The Blue Fleet comes in white ceramic with blue light; the Red Fleet in black armour with red light. Their starships jump like knights, and their crystal beacons shine down the diagonals.',
      lore: {
        k: 'White: the Fleet Commander with a star circlet. Black: the Red Warlord in a crested helm with a red visor.',
        q: 'White: the Admiral with her star staff. Black: the Red Commander in a crimson gown and a crescent headpiece.',
        b: 'White: a beacon with a blue crystal and a gold star. Black: a beacon of jagged red crystal.',
        n: 'White: a starfighter with swept delta wings. Black: an interceptor with crescent wings.',
        r: 'White: a tower of blue light. Black: a hexagonal tower with spikes.',
        p: 'White: a space cadet with a blue visor. Black: a cadet of the Red Fleet with a red eye slit.',
      },
      pieces: GALBLUE, piecesB: GALRED,
      mats: (side) => (side === 'w'
        ? { body: phys('gal-white', { color: '#f2f4f8', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }), base: phys('gal-base-w', { color: '#b8c0cc', metalness: 0.85, roughness: 0.3 }), skin: phys('gal-skin', { color: '#f2c8a8', roughness: 0.45, sheen: 0.4, sheenColor: new THREE.Color('#ffe0d0') }), cloth: phys('gal-uniform', { color: '#eef0f4', roughness: 0.35, clearcoat: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#ffffff') }), cloth2: lacquer('gal-navy', '#1c2c6a', { sheen: 0.5, sheenColor: new THREE.Color('#6a8aff') }), hair: lacquer('gal-hair', '#4a2c1a'), steel: MAT.chrome(), trim: MAT.gold('#e8c060'), glass: phys('gal-glass', { color: '#5ab8ff', roughness: 0.05, metalness: 0.3, emissive: '#1a5aaa', emissiveIntensity: 0.4, clearcoat: 1 }), crystal: phys('gal-crystal-b', { color: '#2a7aff', roughness: 0.05, emissive: '#0a4aff', emissiveIntensity: 1.1, clearcoat: 1 }), glow: phys('gal-glow-b', { color: '#2a7aff', emissive: '#1a5aff', emissiveIntensity: 1.0, roughness: 0.3 }), eye: MAT.lacquer('#1e2a4a') }
        : { body: phys('gal-black', { color: '#1a1c22', roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, metalness: 0.2 }), base: phys('gal-base-b', { color: '#2a2c34', metalness: 0.85, roughness: 0.32 }), skin: phys('gal-skin-r', { color: '#e8c0a8', roughness: 0.45 }), cloth: phys('gal-armour', { color: '#24262e', roughness: 0.3, clearcoat: 0.8, metalness: 0.3 }), cloth2: lacquer('gal-crimson', '#8a121c', { sheen: 0.5, sheenColor: new THREE.Color('#ff6a6a') }), hair: lacquer('gal-hair-r', '#120c0a'), steel: phys('gal-gunmetal', { color: '#3a3c46', metalness: 0.9, roughness: 0.3 }), trim: MAT.gold('#d8a050'), glass: phys('gal-glass-r', { color: '#ff5a4a', roughness: 0.05, metalness: 0.3, emissive: '#aa1a1a', emissiveIntensity: 0.5, clearcoat: 1 }), crystal: phys('gal-crystal-r', { color: '#e8201a', roughness: 0.05, emissive: '#c80a0a', emissiveIntensity: 1.1, clearcoat: 1 }), glow: phys('gal-glow-r', { color: '#ff2a1a', emissive: '#e8100a', emissiveIntensity: 1.0, roughness: 0.3 }), eye: MAT.lacquer('#1a0e0a') }),
    },
    dino: {
      id: 'dino', name: 'Dino Kingdom', era: 'Long, long ago', year: '66 million years ago', tint: '#6a3a12', sided: true,
      story: 'Made for the table in Dinosaur Valley, under the smoking volcano. White is carved from fossil bone with amber and ferns, and black is dark lava stone with glowing cracks.',
      lore: {
        k: 'A crowned tyrant lizard king in a royal cape, roaring as loud as he can.',
        q: 'A crested queen in a long gown, with a fan of plumes behind her crest.',
        b: 'A tall amber crystal with an ammonite shell inside, held in claws of bone.',
        n: 'A triceratops on a fern rock for white, and a quick raptor on a lava rock for black.',
        r: 'A castle of fossil stone, or a lava tower flying a banner with a dinosaur footprint.',
        p: 'A baby dinosaur hatching from its egg, or an amber egg held safe in three claws.',
      },
      pieces: DINO,
      mats: (side) => (side === 'w'
        ? { body: phys('dino-bone', { map: TEX.stone('#efe2c6', '#cdb894', { scale: 4, cloud: 0.4, speckMix: 0.3 }), roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.2, sheen: 0.3, sheenColor: new THREE.Color('#fff4dc') }),
          base: phys('dino-bone-base', { map: TEX.stone('#e6d6b6', '#bfa680', { scale: 5, cloud: 0.5, speckMix: 0.4 }), roughness: 0.5, clearcoat: 0.25 }),
          cloth: phys('dino-sand', { map: TEX.stone('#e8d4ac', '#c0a070', { scale: 4, cloud: 0.5 }), roughness: 0.5, clearcoat: 0.2, sheen: 0.4, sheenColor: new THREE.Color('#fff0d0') }),
          cape: phys('dino-sand', { map: TEX.stone('#e8d4ac', '#c0a070', { scale: 4, cloud: 0.5 }), roughness: 0.5, clearcoat: 0.2, sheen: 0.4, sheenColor: new THREE.Color('#fff0d0') }),
          trim: MAT.gold('#d9a24c'), accent: phys('amber-glow', { color: '#ffae3a', roughness: 0.12, clearcoat: 1, emissive: '#ff8a10', emissiveIntensity: 0.55 }),
          crystal: phys('amber-crystal', { color: '#ffc46a', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#ff9a20', emissiveIntensity: 0.45, sheen: 0.5, sheenColor: new THREE.Color('#fff0c0') }),
          egg: phys('dino-egg', { map: TEX.stone('#f2e6cc', '#d8c4a0', { scale: 3, cloud: 0.3 }), roughness: 0.35, clearcoat: 0.6 }),
          crest: phys('dino-crest-w', { color: '#d8a868', roughness: 0.4, clearcoat: 0.5 }), tooth: MATS.ivoryEnamel(), leaf: phys('fern', { color: '#7f9a56', roughness: 0.5, clearcoat: 0.3 }), mouth: phys('dino-mouth', { color: '#6a2420', roughness: 0.5, clearcoat: 0.4 }),
          lava: phys('amber-glow', { color: '#ffae3a', roughness: 0.12, clearcoat: 1, emissive: '#ff8a10', emissiveIntensity: 0.55 }), eye: MAT.lacquer('#2a1a10') }
        : { body: phys('dino-lava', { map: TEX.stone('#3a3230', '#1c1816', { scale: 6, cloud: 0.4, speckMix: 0.5 }), roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.2 }),
          base: phys('dino-lava-base', { map: TEX.stone('#2a2422', '#141010', { scale: 7, cloud: 0.4, speckMix: 0.5 }), roughness: 0.55, clearcoat: 0.3 }),
          cloth: phys('dino-red', { color: '#7a1e14', roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color('#ff7a5a'), sheenRoughness: 0.5 }),
          cape: phys('dino-red', { color: '#7a1e14', roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color('#ff7a5a'), sheenRoughness: 0.5 }),
          trim: MAT.gold('#c8903a'), accent: phys('amber-glow', { color: '#ffae3a', roughness: 0.12, clearcoat: 1, emissive: '#ff8a10', emissiveIntensity: 0.55 }),
          crystal: phys('amber-glow', { color: '#ffae3a', roughness: 0.12, clearcoat: 1, emissive: '#ff8a10', emissiveIntensity: 0.55 }),
          egg: phys('amber-egg', { color: '#e8902a', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#c85a08', emissiveIntensity: 0.6 }),
          crest: phys('dino-crest-b', { color: '#a8301e', roughness: 0.45, clearcoat: 0.5 }), tooth: MATS.ivoryEnamel(), leaf: phys('fern', { color: '#7f9a56', roughness: 0.5, clearcoat: 0.3 }), mouth: phys('dino-mouth', { color: '#6a2420', roughness: 0.5, clearcoat: 0.4 }),
          lava: MAT.emissive('#ff6a1a', 1.6), eye: phys('dino-eye-b', { color: '#ffb040', emissive: '#ff8a10', emissiveIntensity: 0.9, roughness: 0.2 }) }),
    },
    forest: {
      id: 'forest', name: 'Forest Guardians', era: 'Once upon a time', year: 'In the enchanted forest', tint: '#2a5a2e', sided: true,
      story: 'Made for the table deep in the Enchanted Forest. White are the elves of the glade in ivory and gold with green cloaks, and black are the forest folk of bark and moss, whose eyes glow green.',
      lore: {
        k: 'The elf king with his great sword, or the antlered Oak King with his glowing staff.',
        q: 'The elf queen with her golden hair, or the dryad queen crowned with branches and flowers.',
        b: 'An elf mage with a blue crystal, or a druid whose staff holds a green light.',
        n: 'A white stag with golden antlers, or a friendly moss bear with flowers on his back.',
        r: 'A slender elven tower with lit windows, or a hollow tree stump with a glowing door.',
        p: 'An elf sentinel with a leaf shield, or a little moss sprite with leafy ears.',
      },
      pieces: FOREST,
      mats: (side) => (side === 'w'
        ? { body: phys('elf-ivory', { color: '#f3eee4', roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.12, sheen: 0.4, sheenColor: new THREE.Color('#fff8ec') }),
          base: phys('elf-base', { map: TEX.marble('#f2ede2', '#c8bca0', { scale: 2, strength: 0.3 }), roughness: 0.3, clearcoat: 0.7 }),
          cloth: phys('elf-green', { color: '#24603c', roughness: 0.55, sheen: 0.9, sheenColor: new THREE.Color('#7ad8a0'), sheenRoughness: 0.45 }),
          cape: phys('elf-green-2', { color: '#1c4a30', roughness: 0.6, sheen: 0.9, sheenColor: new THREE.Color('#6ac890'), sheenRoughness: 0.45 }),
          hair: MAT.gold('#ecc874'), fur: phys('elf-moss', { color: '#6a8a3a', roughness: 0.9 }), trim: MAT.gold('#e6b85c'), steel: MAT.silver(),
          accent: phys('elf-gem', { color: '#8ad8ff', roughness: 0.05, clearcoat: 1, emissive: '#3aa8ff', emissiveIntensity: 0.8 }),
          leaf: phys('elf-leaf', { color: '#4a8a4a', roughness: 0.4, clearcoat: 0.6 }), flower: phys('elf-flower', { color: '#f4f0ff', roughness: 0.4, emissive: '#c8b8ff', emissiveIntensity: 0.2 }), eye: MAT.lacquer('#1e2a24') }
        : { body: phys('bark', { map: TEX.wood('#6a5236', '#3a2a1a', { lines: 18, contrast: 0.6, figure: 0.2, seed: 21 }), roughness: 0.65, clearcoat: 0.2 }),
          base: phys('forest-stone', { map: TEX.stone('#3a3a2e', '#24261c', { scale: 6, cloud: 0.4, speckMix: 0.4 }), roughness: 0.6, clearcoat: 0.2 }),
          cloth: phys('moss-cloth', { color: '#3e5a22', roughness: 0.8, sheen: 1, sheenColor: new THREE.Color('#9ad860'), sheenRoughness: 0.5 }),
          cape: phys('moss-cloth-2', { color: '#2e4618', roughness: 0.85, sheen: 1, sheenColor: new THREE.Color('#8ac850'), sheenRoughness: 0.5 }),
          hair: phys('leaf-hair', { color: '#3a5a1a', roughness: 0.6, clearcoat: 0.3 }), fur: phys('moss', { color: '#5a7e26', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#b8f070') }),
          trim: MAT.gold('#b48a42'), steel: MAT.bronze(),
          accent: phys('green-glow', { color: '#9aff6a', roughness: 0.1, emissive: '#5aff3a', emissiveIntensity: 1.1 }),
          leaf: phys('folk-leaf', { color: '#5a8a2a', roughness: 0.5, clearcoat: 0.4 }), flower: phys('folk-flower', { color: '#b67ae8', roughness: 0.4, emissive: '#8a4ad8', emissiveIntensity: 0.35 }),
          eye: phys('folk-eye', { color: '#b8ff7a', emissive: '#7aff3a', emissiveIntensity: 1.2, roughness: 0.2 }) }),
    },
    jarl: {
      id: 'jarl', name: 'Jarls of the Fjord', era: 'The Viking age', year: 'About 900', tint: '#1e2e5a', sided: true,
      story: 'Made for a table by the fjord where the longships come home. White is gold and ivory with deep blue cloaks and white fur, black is dark iron and leather with grey fur, and on both sides the runestones glow ice blue.',
      lore: {
        k: 'A jarl in a fur cloak with both hands on his sword: a gold crown for white, a horned helm for black.',
        q: 'A shieldmaiden queen with long braids, in a winged helm or a circlet of curling horns.',
        b: 'A wise seer with a long beard and a rune staff that glows ice blue.',
        n: 'A great wolf sitting up on a rock: white with gold armour, or dark with glowing eyes.',
        r: 'A watchtower with a round shield on its face and two banners flying from the top.',
        p: 'A warrior with a round shield and a spear, ready to guard the shore.',
      },
      pieces: VIKING,
      mats: (side) => (side === 'w'
        ? { body: phys('jarl-ivory', { color: '#efe4cc', roughness: 0.35, clearcoat: 0.7, clearcoatRoughness: 0.14, sheen: 0.3, sheenColor: new THREE.Color('#fff4dc') }),
          base: MAT.gold('#d8aa52'), rock: phys('fjord-rock-w', { map: TEX.stone('#c8c4bc', '#8a8680', { scale: 5, cloud: 0.5, speckMix: 0.4 }), roughness: 0.6, clearcoat: 0.2 }), cloth: phys('jarl-navy', { color: '#1e2c58', roughness: 0.55, sheen: 0.9, sheenColor: new THREE.Color('#7a9aff'), sheenRoughness: 0.45 }),
          cape: phys('jarl-navy-2', { color: '#18234a', roughness: 0.6, sheen: 0.9, sheenColor: new THREE.Color('#6a8aee'), sheenRoughness: 0.45 }),
          hair: phys('jarl-hair-w', { color: '#d8b878', roughness: 0.5, clearcoat: 0.4 }), fur: phys('fur-white', { color: '#f2ece2', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#ffffff') }),
          trim: MAT.gold('#e2b458'), steel: MAT.gold('#e8c06a'), tooth: MATS.ivoryEnamel(), banner: phys('jarl-banner-w', { color: '#22346a', roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color('#8aa8ff') }),
          accent: phys('ice-glow', { color: '#9ae0ff', roughness: 0.05, clearcoat: 1, emissive: '#3ab8ff', emissiveIntensity: 0.9 }), eye: MAT.lacquer('#1e2430') }
        : { body: phys('jarl-iron', { color: '#4a3c32', roughness: 0.45, clearcoat: 0.5, clearcoatRoughness: 0.2, sheen: 0.3, sheenColor: new THREE.Color('#c8a888') }),
          base: MAT.bronze(), rock: phys('fjord-rock-b', { map: TEX.stone('#4a4a4e', '#2a2a2e', { scale: 5, cloud: 0.5, speckMix: 0.4 }), roughness: 0.6, clearcoat: 0.2 }), cloth: phys('jarl-teal', { color: '#1c3640', roughness: 0.6, sheen: 0.9, sheenColor: new THREE.Color('#5ac8d8'), sheenRoughness: 0.45 }),
          cape: phys('jarl-leather', { color: '#3a2a20', roughness: 0.65, clearcoat: 0.2, sheen: 0.5, sheenColor: new THREE.Color('#a87a5a') }),
          hair: phys('jarl-hair-b', { color: '#2a201a', roughness: 0.5, clearcoat: 0.3 }), fur: phys('fur-grey', { color: '#8a8478', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#d8d0c0') }),
          trim: MAT.bronze(), steel: phys('dark-iron', { color: '#5a5c62', metalness: 1, roughness: 0.32, envMapIntensity: 1.1 }), tooth: MATS.ivoryEnamel(), banner: phys('jarl-banner-b', { color: '#8a1c16', roughness: 0.6, sheen: 0.8, sheenColor: new THREE.Color('#ff7a5a') }),
          accent: phys('ice-glow', { color: '#9ae0ff', roughness: 0.05, clearcoat: 1, emissive: '#3ab8ff', emissiveIntensity: 0.9 }), eye: phys('wolf-eye', { color: '#aef0ff', emissive: '#5ad8ff', emissiveIntensity: 1.2, roughness: 0.2 }) }),
    },
    rune: {
      id: 'rune', name: 'Runecarved', era: 'The Viking age', year: 'About 950', tint: '#5a3a1e',
      story: 'Whittled by hand for the table at the gate of a great hall, where dragons are carved on the doorposts. White is pale birch with blue cloaks, black is dark oak with red, and every piece stands on a drum of knotwork.',
      lore: {
        k: 'A carved king leaning on his sword, with a long beard and a simple crown.',
        q: 'A queen with long braids, holding a drinking horn in both hands.',
        b: 'A hooded skald, the teller of sagas, with a sun wheel on his staff and runes on his robe.',
        n: 'The head of a wolf with its mouth open and spirals cut into its neck.',
        r: 'A round watchtower of planks under a shingled roof, with a banner on its face.',
        p: 'A spearman in a pointed helmet with a round shield.',
      },
      pieces: RUNE,
      mats: (side) => (side === 'w'
        ? { body: phys('birch', { map: TEX.wood('#ead8b4', '#c8a878', { lines: 30, contrast: 0.32, figure: 0.12, seed: 31 }), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.3 }),
          base: phys('birch-2', { map: TEX.wood('#e2cca4', '#bc9a68', { lines: 24, contrast: 0.4, figure: 0.15, seed: 33 }), roughness: 0.55, clearcoat: 0.25 }),
          cloth: phys('birch-blue', { map: TEX.wood('#3a4c70', '#24324e', { lines: 26, contrast: 0.3, seed: 35 }), roughness: 0.65, clearcoat: 0.15 }),
          cape: phys('birch-blue', { map: TEX.wood('#3a4c70', '#24324e', { lines: 26, contrast: 0.3, seed: 35 }), roughness: 0.65, clearcoat: 0.15 }),
          hair: phys('birch', { map: TEX.wood('#ead8b4', '#c8a878', { lines: 30, contrast: 0.32, figure: 0.12, seed: 31 }), roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.3 }),
          trim: MAT.bronze(), steel: MAT.bronze(), tooth: MATS.ivoryEnamel(), eye: MAT.lacquer('#2a1a10') }
        : { body: phys('oak', { map: TEX.wood('#6e4c2e', '#3a2414', { lines: 22, contrast: 0.5, figure: 0.2, seed: 37 }), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
          base: phys('oak-2', { map: TEX.wood('#5e3e24', '#301c0e', { lines: 20, contrast: 0.55, figure: 0.2, seed: 39 }), roughness: 0.55, clearcoat: 0.3 }),
          cloth: phys('oak-red', { map: TEX.wood('#8a2a1e', '#5a1610', { lines: 24, contrast: 0.3, seed: 41 }), roughness: 0.6, clearcoat: 0.2 }),
          cape: phys('oak-red', { map: TEX.wood('#8a2a1e', '#5a1610', { lines: 24, contrast: 0.3, seed: 41 }), roughness: 0.6, clearcoat: 0.2 }),
          hair: phys('oak', { map: TEX.wood('#6e4c2e', '#3a2414', { lines: 22, contrast: 0.5, figure: 0.2, seed: 37 }), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
          trim: MAT.bronze(), steel: MAT.bronze(), tooth: MATS.ivoryEnamel(), eye: MAT.lacquer('#f0e4cc') }),
    },
  });

  // ------------------------------------------------------------------ the jewel sets (2026-11)
  Object.assign(SETS, {
    fantasy: {
      mesh: 'classic1', meshLook: { b: { clearcoat: 0.5 } },
      id: 'fantasy', name: 'Fantasy Marble', era: 'A sculptor\'s dream', year: 'Today', tint: '#3a3226',
      story: 'Carved from white and black marble, then wound with ribbons of gold. Each piece is a sculpture: tulip crowns, a pearl held in a twisted loop and towers with tall arched windows.',
      lore: {
        k: 'A tulip crown of marble petals edged in gold, under a golden cross.',
        q: 'A crown of slim pointed petals round a sparkling crystal.',
        b: 'A twisted marble loop holding a pearl.',
        n: 'A horse whose mane streams back in gold-veined marble.',
        r: 'A round tower with tall arched windows.',
        p: 'A polished ball on a swirl of marble and gold.',
      },
      pieces: FANTASY,
      mats: (side) => (side === 'w'
        ? { body: phys('fm-white', { map: TEX.marble('#f4efe6', '#c8a868', { scale: 2.4, sharp: 7, strength: 0.6, cloud: 0.12 }), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }), mane: phys('fm-white-mane', { map: TEX.marble('#f2ece2', '#d0a24c', { scale: 3.5, sharp: 4, strength: 0.85, cloud: 0.1 }), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }), trim: MAT.gold('#e2b45a'), orb: MATS.pearl(), gem: MATS.diamond() }
        : { body: phys('fm-black', { map: TEX.marble('#151416', '#a8864a', { scale: 2.4, sharp: 7, strength: 0.55, cloud: 0.1 }), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }), mane: phys('fm-black-mane', { map: TEX.marble('#18171a', '#c09048', { scale: 3.5, sharp: 4, strength: 0.8, cloud: 0.1 }), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }), trim: MAT.gold('#e2b45a'), orb: phys('fm-smoke', { color: '#2c2a2e', metalness: 0.25, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.8 }), gem: MATS.diamond() }),
    },
    sapphire: {
      mesh: 'classic1', meshLook: { b: { clearcoat: 0.45, env: 0.95 } },
      id: 'sapphire', name: 'Royal Ivory & Sapphire', era: 'A king\'s mountain tower', year: 'Once upon a time', tint: '#1d2c6e',
      story: 'Made for a king whose tower looked out over snowy mountains. Ivory faces royal blue, both laid with gold and set with sapphires, and the rooks carry the king\'s shield with a golden lily.',
      lore: {
        k: 'A closed crown of gold arches over a sapphire, under a jewelled cross.',
        q: 'An open crown of golden points round a golden ball.',
        b: 'A rounded mitre with a sapphire set in its front.',
        n: 'A proud horse with a flowing golden mane.',
        r: 'A tower carrying the royal shield with a golden lily.',
        p: 'A round head on a slim stem with a blue enamel collar.',
      },
      pieces: SAPPHIRE,
      mats: (side) => (side === 'w'
        ? { body: phys('sap-ivory', { map: TEX.marble('#f4ebd8', '#d4be96', { scale: 2, sharp: 10, strength: 0.35, cloud: 0.15 }), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.25, sheenColor: new THREE.Color('#fff6e4') }), enamel: phys('sap-enamel', { color: '#1d3496', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.4, sheenColor: new THREE.Color('#7a9aff') }), trim: MAT.gold('#e6b85a'), gem: MAT.gem('#2448d8') }
        : { body: phys('sap-blue', { map: TEX.marble('#1f3290', '#6a82e0', { scale: 2.5, sharp: 9, strength: 0.35, cloud: 0.2 }), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }), enamel: phys('sap-enamel-deep', { color: '#101a52', roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.03, sheen: 0.4, sheenColor: new THREE.Color('#5a7aff') }), trim: MAT.gold('#e6b85a'), gem: MAT.gem('#6a9aff') }),
    },
    navy: {
      mesh: 'classic1', meshLook: { b: { clearcoat: 0.45, env: 0.95 } },
      id: 'navy', name: 'Royal Navy', era: 'An admiral\'s cabin', year: 'The age of sail', tint: '#141c3a',
      story: 'Made for an admiral to play in his cabin at sea. Ivory with rubies faces deep navy with sapphires, all trimmed in gold, with gold rope round every foot and an anchor on the king\'s cross.',
      lore: {
        k: 'An open crown set with gems round a dark orb, and a cross that ends in an anchor.',
        q: 'A coronet of slim golden points, a gem at the foot of each.',
        b: 'A mitre with a glowing gem in a golden frame.',
        n: 'A horse with a silk sash tied round its neck.',
        r: 'A tower with round portholes and a gem badge.',
        p: 'A round head on a little bell with a gem in front.',
      },
      pieces: NAVY,
      mats: (side) => (side === 'w'
        ? { body: phys('nv-ivory', { map: TEX.marble('#f1e6d0', '#cbb48a', { scale: 2.2, sharp: 8, strength: 0.4, cloud: 0.15 }), roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06 }), band: phys('nv-ribbon-navy', { color: '#16204a', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.5, sheenColor: new THREE.Color('#6a7aff') }), trim: MAT.gold('#e4b45a'), gem: MAT.gem('#c0142a'), glow: phys('nv-glow-red', { color: '#ff4a4a', emissive: '#e01020', emissiveIntensity: 1.2, roughness: 0.06, clearcoat: 1 }), orb: phys('nv-orb-navy', { color: '#16204a', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.5 }) }
        : { body: phys('nv-navy', { map: TEX.marble('#121a34', '#4a5c94', { scale: 2.2, sharp: 8, strength: 0.4, cloud: 0.2 }), roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }), band: MAT.gold('#e4b45a'), trim: MAT.gold('#e4b45a'), gem: MAT.gem('#2a5cff'), glow: phys('nv-glow-blue', { color: '#5a9aff', emissive: '#1a5aff', emissiveIntensity: 1.3, roughness: 0.06, clearcoat: 1 }), orb: phys('nv-orb-sapphire', { color: '#1c3ab0', roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 }) }),
    },
    opulent: {
      mesh: 'classic1', meshLook: { b: { clearcoat: 0.5 } },
      id: 'opulent', name: 'Opulent Emerald', era: 'A stargazer\'s tower', year: 'Once upon a time', tint: '#12302a',
      story: 'Made for a stargazer\'s tower, where lamps glow in the windows all night. Ivory faces deep green marble, set with emeralds in gold, and the kings and queens are cut with eight shining sides.',
      lore: {
        k: 'A crown of eight arches, an emerald in each, under a cross with round ends.',
        q: 'Six tall golden points tipped with emeralds, round one great emerald.',
        b: 'An onion dome with an emerald in a golden frame.',
        n: 'A horse with a carved mane and an emerald on its brow.',
        r: 'A tower whose arched windows glow with lamplight.',
        p: 'A round head on an eight-sided stem with a little emerald.',
      },
      pieces: EMERALD,
      mats: (side) => (side === 'w'
        ? { body: phys('em-ivory', { map: TEX.marble('#f2ead8', '#c8b088', { scale: 2.2, sharp: 9, strength: 0.4, cloud: 0.15 }), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }), trim: MAT.gold('#e2b050'), gem: phys('em-gem', { color: '#12b47e', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, emissive: '#0a8a5a', emissiveIntensity: 0.35 }), window: phys('em-window', { color: '#ffd890', emissive: '#ffb040', emissiveIntensity: 1.6, roughness: 0.4 }) }
        : { body: phys('em-green', { map: TEX.marble('#13221c', '#5a8a74', { scale: 2.2, sharp: 8, strength: 0.45, cloud: 0.2 }), roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.05 }), trim: MAT.gold('#e2b050'), gem: phys('em-gem', { color: '#12b47e', roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, emissive: '#0a8a5a', emissiveIntensity: 0.35 }), window: phys('em-window', { color: '#ffd890', emissive: '#ffb040', emissiveIntensity: 1.6, roughness: 0.4 }) }),
    },
    pagoda: {
      mesh: 'classic2', meshLook: { b: { clearcoat: 0.55, env: 1.0 } },
      id: 'pagoda', name: 'Dragon & Pagoda', era: 'A pavilion by a mountain waterfall', year: 'Long ago', tint: '#3a1418',
      story: 'Made for a pavilion high in the mountains, beside a waterfall. Porcelain white with crimson silk faces midnight lacquer with glowing blue, all in gold: an emperor and an empress, dragon knights, lotus-flame bishops and lantern pagodas for rooks.',
      lore: {
        k: 'An emperor in long robes, with a gold crown and a cross of curling clouds.',
        q: 'An empress with a fan of golden points in her hair.',
        b: 'A lotus flame of three petals holding a glowing pearl.',
        n: 'A dragon with swept-back horns, long whiskers and a glowing jewel.',
        r: 'A lantern pagoda with glowing windows under two curling roofs.',
        p: 'A little courtier in a silk cape with a gold collar.',
      },
      pieces: PAGODA,
      mats: (side) => (side === 'w'
        ? { body: phys('pg-porcelain', { color: '#f6f0e4', roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.04, sheen: 0.3, sheenColor: new THREE.Color('#fff8ec') }), cloth: phys('pg-robe-w', { color: '#f2e8d6', roughness: 0.3, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#fff4e0') }), silk: phys('pg-silk-red', { color: '#a8121e', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#ff6a6a'), sheenRoughness: 0.4 }), trim: MAT.gold('#e6b450'), glow: phys('pg-glow-red', { color: '#ff5a3a', emissive: '#ff2a10', emissiveIntensity: 1.5, roughness: 0.1, clearcoat: 1 }), window: phys('pg-window-amber', { color: '#ffe0a0', emissive: '#ffa030', emissiveIntensity: 1.6, roughness: 0.5 }), eye: MAT.matte('#2a1c14') }
        : { body: phys('pg-lacquer', { color: '#1a1f30', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.04 }), cloth: phys('pg-robe-b', { color: '#20263a', roughness: 0.3, clearcoat: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#6a8aff') }), silk: phys('pg-silk-blue', { color: '#1a3a8a', roughness: 0.35, sheen: 1, sheenColor: new THREE.Color('#5aa8ff'), emissive: '#1a5aff', emissiveIntensity: 0.35 }), trim: MAT.gold('#e6b450'), glow: phys('pg-glow-blue', { color: '#6ac0ff', emissive: '#2a8aff', emissiveIntensity: 1.6, roughness: 0.1, clearcoat: 1 }), window: phys('pg-window-blue', { color: '#bfe8ff', emissive: '#3ab0ff', emissiveIntensity: 1.6, roughness: 0.5 }), eye: MAT.matte('#e8ecf4') }),
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

  // ------------------------------------------------------------------ modelled sets
  // Sets modelled in Blender from their reference pictures (tools/model/). Their meshes and
  // painted texture atlases live in a pack, meshes/<pack>.txt beside the page, fetched the first
  // time one of its sets is shown. Until it arrives (or if it cannot), the set's coded pieces
  // stand in. A pack is text: JSON { sets: { id: { bin, w: { albedo, mr, glow }, b: {...} } } },
  // where bin is the base64 of a gzipped buffer (u32 header length, JSON header, then 4-byte
  // aligned arrays) and each side's textures are data URLs (colour; G roughness, B metalness;
  // glow for emissive parts). Both sides share the meshes unless a key names its side.
  const PACKS = new Map(), DONE = new Set();
  const MODELLED = new Map();   // set id -> { geo: { 'w.k.show': { slot: geometry } }, tex }
  const meshPack = (id) => { const s = SETS[id]; return s && s.mesh && typeof DecompressionStream !== 'undefined' && typeof fetch !== 'undefined' ? s.mesh : null; };
  const b64bytes = (b) => { const t = atob(b), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
  async function gunzip(bytes) {
    const st = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(st).arrayBuffer());
  }
  function texture(url, srgb) {
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => {
        const t = new THREE.Texture(img);
        t.flipY = false; t.anisotropy = 4;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        t.needsUpdate = true; res(t);
      };
      img.onerror = () => res(null);
      img.src = url;
    });
  }
  function decodeSet(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const n = dv.getUint32(0, true);
    const head = JSON.parse(new TextDecoder().decode(buf.subarray(4, 4 + n)));
    const ab = buf.slice().buffer, geo = {};
    for (const [key, slots] of Object.entries(head.geoms)) {
      geo[key] = {};
      for (const [slot, d] of Object.entries(slots)) {
        const g = new THREE.BufferGeometry(), b = d.box, q = new Uint16Array(ab, d.o[0], d.n * 3), pos = new Float32Array(d.n * 3);
        for (let i = 0; i < d.n * 3; i++) { const a = i % 3; pos[i] = b[a] + (q[i] / 65535) * (b[a + 3] - b[a]); }
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(ab, d.o[1], d.n * 3), 3, true));
        g.setAttribute('uv', new THREE.BufferAttribute(new Uint16Array(ab, d.o[2], d.n * 2), 2, true));
        g.setIndex(new THREE.BufferAttribute(d.n > 65535 ? new Uint32Array(ab, d.o[3], d.i) : new Uint16Array(ab, d.o[3], d.i), 1));
        g.computeBoundingSphere(); g.computeBoundingBox();
        geo[key][slot] = g;
      }
    }
    return geo;
  }
  function loadPack(pack) {
    if (!PACKS.has(pack)) {
      PACKS.set(pack, fetch('meshes/' + pack + '.txt').then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
        .then((j) => Promise.all(Object.entries(j.sets).map(async ([id, d]) => {
          const side = async (t) => (t ? { albedo: await texture(t.albedo, true), mr: await texture(t.mr), glow: t.glow ? await texture(t.glow, true) : null } : null);
          const [geo, w, b] = await Promise.all([gunzip(b64bytes(d.bin)).then(decodeSet), side(d.w), side(d.b)]);
          if (w && w.albedo && w.mr && b && b.albedo && b.mr) MODELLED.set(id, { geo, tex: { w, b } });
        })))
        .catch((e) => { if (typeof console !== 'undefined') console.warn('pieces: pack', pack, 'not loaded', e && e.message); })
        .then(() => { DONE.add(pack); }));
    }
    return PACKS.get(pack);
  }
  // Resolves once a set's modelled pieces are in (at once for coded sets, and for a pack that fails).
  function ready(id) { const p = meshPack(id); return p ? loadPack(p).then(() => !!MODELLED.get(id)) : Promise.resolve(false); }
  // true while a modelled set's pack is still on its way (or not asked for yet)
  const pending = (id) => !!meshPack(id) && !MODELLED.has(id) && !DONE.has(meshPack(id));
  // The painted skin of a modelled piece: the atlas colour, roughness and metalness from the
  // mr map (gold leaf shines as metal, enamel and stone stay glossy), and glowing gems and windows.
  const SKINS = new Map();
  function skin(id, slot, side) {
    const k = id + ':' + slot + ':' + side;
    if (!SKINS.has(k)) {
      const t = MODELLED.get(id).tex[side === 'b' ? 'b' : 'w'], ml = SETS[id].meshLook || {}, look = Object.assign({ clearcoat: 0.7, clearcoatRoughness: 0.08 }, ml, ml[side === 'b' ? 'b' : 'w'] || {}, ml[slot] || {});
      const o = { map: t.albedo, roughnessMap: t.mr, metalnessMap: t.mr, roughness: 1, metalness: 1, clearcoat: look.clearcoat, clearcoatRoughness: look.clearcoatRoughness, envMapIntensity: look.env || 1.15 };
      if (t.glow) Object.assign(o, { emissiveMap: t.glow, emissive: new THREE.Color('#ffffff'), emissiveIntensity: look.glow || 1.4 });
      if (slot === 'glass') Object.assign(o, { transmission: look.transmission || 0.85, thickness: 0.4, ior: 1.5 });
      SKINS.set(k, new THREE.MeshPhysicalMaterial(o));
    }
    return SKINS.get(k);
  }
  const modelled = (id, type, detail, side) => {
    const m = MODELLED.get(id);
    if (!m) return null;
    const sd = side === 'b' ? 'b.' : 'w.';
    return m.geo[sd + type + '.' + detail] || m.geo[type + '.' + detail] || m.geo[sd + type + '.show'] || m.geo[type + '.show'] || null;
  };
  // A set whose two armies are different figures (Orcs & Elves) gives black its own module, piecesB.
  // Sets whose two sides are different characters (set.sided) build each piece for its side.
  function geometry(setId, type, detail, side) {
    const set = SETS[setId] || SETS.regency;
    const shape = set.shape || set.id;
    const lod = LOD[detail] ? detail : 'show';
    const two = side === 'b' && !!SETS[shape].piecesB;
    const sd = set.sided ? (side === 'b' ? 'b' : 'w') : '';
    const key = shape + (two ? '~b' : '') + type + lod + sd;
    if (!geomCache.has(key)) {
      const t0 = performance.now();
      const L = LOD[lod], keep = { around: DETAIL.around, along: DETAIL.along, tube: DETAIL.tube, cell: Q.cell, mane: Q.mane };
      Object.assign(DETAIL, { around: L.around, along: L.along, tube: L.tube }); Q.cell = L.cell; Q.mane = L.mane;
      try { geomCache.set(key, (two ? SETS[shape].piecesB : SETS[shape].pieces)[type]({ Q, side: sd || 'w' }).geoms()); }
      finally { Object.assign(DETAIL, { around: keep.around, along: keep.along, tube: keep.tube }); Q.cell = keep.cell; Q.mane = keep.mane; }
      if (typeof window !== 'undefined' && window.__PIECE_TIMES) window.__PIECE_TIMES.push([shape, type, lod, Math.round(performance.now() - t0)]);
    }
    return geomCache.get(key);
  }
  // A ready-to-place group for one piece: meshes share geometry and materials.
  // Slots that share a material are drawn as one mesh: a figure with a dozen parts in five
  // materials costs five draw calls, not twelve. The merged geometry is kept with the slot ones.
  const MERGED = new WeakMap();
  function byMaterial(g, mats, side) {
    let per = MERGED.get(g);
    if (!per) MERGED.set(g, (per = {}));
    if (per[side]) return per[side].map(([geo, name]) => [geo, mats[name] || mats.body]);
    const groups = new Map();
    for (const slot of Object.keys(g)) {
      const mat = mats[slot] || mats.body;
      if (!groups.has(mat)) groups.set(mat, { name: mats[slot] ? slot : 'body', geos: [] });
      groups.get(mat).geos.push(g[slot]);
    }
    const out = [];
    for (const { name, geos } of groups.values()) {
      const same = geos.every((x) => !!x.index === !!geos[0].index && Object.keys(x.attributes).sort().join() === Object.keys(geos[0].attributes).sort().join());
      const one = geos.length > 1 && same && THREE.mergeGeometries ? THREE.mergeGeometries(geos) : null;
      if (one) out.push([one, name]); else geos.forEach((x) => out.push([x, name]));
    }
    per[side] = out;
    return out.map(([geo, name]) => [geo, mats[name] || mats.body]);
  }
  function make(setId, type, side, detail) {
    const set = SETS[setId] || SETS.regency;
    const mg = modelled(set.id, type, LOD[detail] ? detail : 'show', side);
    if (mg) {
      const grp = new THREE.Group();
      for (const slot of Object.keys(mg)) {
        const m = new THREE.Mesh(mg[slot], skin(set.id, slot, side));
        m.castShadow = true; m.receiveShadow = true;
        grp.add(m);
      }
      grp.userData = { set: set.id, type, side, modelled: true };
      return grp;
    }
    if (meshPack(set.id)) loadPack(meshPack(set.id));
    const g = geometry(set.id, type, detail, side);
    const mats = set.mats(side);
    const grp = new THREE.Group();
    for (const [geo, mat] of byMaterial(g, mats, side)) {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      grp.add(m);
    }
    grp.userData = { set: set.id, type, side };
    return grp;
  }
  const HEIGHT = { k: 1.62, q: 1.43, b: 1.24, n: 1.06, r: 0.97, p: 0.72 };
  return { SETS, make, geometry, HEIGHT, ready, pending, list: () => Object.keys(SETS).map((k) => SETS[k]) };
}
if (typeof module !== 'undefined') module.exports = ChacklatePieces;
