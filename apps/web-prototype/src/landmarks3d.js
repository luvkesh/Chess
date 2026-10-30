// Chackmate landmarks: the world outside each era's table, built in code. A vista is a sky
// dome (gradient, clouds, sun or moon, stars as points), a far horizon painted into the dome,
// the ground, and a modelled landmark with its setting: the pyramids of Giza, the Parthenon,
// the inside of the Colosseum, the Taj Mahal across its long pool, the Hall of Supreme
// Harmony, the Grand Canal, the Church of the Savior on Spilled Blood, Times Square in neon
// and the Eiffel Tower. Some eras play outdoors in front of their landmark; the others see
// it through open windows.
//
// Everything is static, so each vista is merged into one mesh per material; it adds a dozen
// or so draw calls and no lights. Sizes are in table units (the board is 8 wide) and the
// landmarks are scaled down and brought closer than life, so they fill the home screen.
function ChacklateLandmarks(THREE, K, H) {
  'use strict';
  const { TAU, mix, clamp, rng, hex } = K;
  const { canvas, texFrom, shade, rgba, glowTexture, flame } = H;
  const DEG = Math.PI / 180;

  // ------------------------------------------------------------------ small helpers
  // Geometry gathered per material and merged into one mesh each at the end.
  function Parts() {
    const bins = new Map(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const api = {
      add(mat, geo, o) {
        if (o) {
          const sc = o.s === undefined ? [1, 1, 1] : Array.isArray(o.s) ? o.s : [o.s, o.s, o.s];
          m4.compose(p.set(o.x || 0, o.y || 0, o.z || 0), q.setFromEuler(e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), s.set(sc[0], sc[1], sc[2]));
          geo.applyMatrix4(m4);
        }
        if (!bins.has(mat)) bins.set(mat, []);
        bins.get(mat).push(geo);
        return api;
      },
      // a copy of everything added so far, mirrored in the plane y = y0 (a reflection in water)
      mirrored(y0, tint) {
        const out = Parts();
        for (const [mat, list] of bins) {
          const m = tint(mat);
          for (const g of list) out.add(m, mirrorY(g.clone(), y0));
        }
        return out;
      },
      each(fn) { for (const [mat, list] of bins) list.forEach((g) => fn(mat, g)); },
      build(group, o) {
        for (const [mat, list] of bins) {
          const mesh = new THREE.Mesh(K.merge(list), mat);
          if (o && o.order !== undefined) mesh.renderOrder = o.order;
          group.add(mesh);
        }
        return group;
      },
    };
    return api;
  }
  function mirrorY(g, y0) {
    g.applyMatrix4(new THREE.Matrix4().makeScale(1, -1, 1).setPosition(0, 2 * y0, 0));
    if (!g.index) g = THREE.mergeVertices(g, 1e-5);
    const a = g.index.array;
    for (let i = 0; i < a.length; i += 3) { const t = a[i]; a[i] = a[i + 2]; a[i + 2] = t; }
    return g;
  }
  // A lathe from [r, y] points, smoothed through a spline when `smooth` gives a point count.
  function lathe(points, segs, smooth, phi0) {
    let pts = points.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
    if (smooth) pts = new THREE.SplineCurve(pts).getPoints(smooth);
    return new THREE.LatheGeometry(pts, segs || 24, phi0 || 0);
  }
  const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x || 0, (y || 0) + h / 2, z || 0);
  // A plane standing on the ground: centre x, z, bottom y, facing angle ry (0 faces +z).
  const wall = (w, h, x, y, z, ry, u0, u1, v0, v1) => {
    const g = new THREE.PlaneGeometry(w, h);
    if (u0 !== undefined) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, mix(u0, u1, uv.getX(i)), mix(v0, v1, uv.getY(i))); }
    return g.translate(0, h / 2, 0).rotateY(ry || 0).translate(x, y, z);
  };
  // Upright walls round a closed outline ([x, z] points, anticlockwise from above), each
  // mapped 0..1 across (or `tile` units per repeat when given).
  function prism(poly, y0, y1, tile) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
      const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bz - az, -(bx - ax));
      out.push(wall(len, y1 - y0, (ax + bx) / 2, y0, (az + bz) / 2, ry + Math.PI, 0, tile ? len / tile : 1, 0, tile ? (y1 - y0) / tile : 1));
    }
    return out;
  }
  // A polygon lid at height y, facing up.
  function lid(poly, y) {
    const s = new THREE.Shape(poly.map(([x, z]) => new THREE.Vector2(x, -z)));
    return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2).translate(0, y, 0);
  }
  // Direction of a point on the sky: az 0 is straight ahead from white's seat (-z), positive
  // to the right; el above the horizon.
  const dir = (az, el, r) => new THREE.Vector3(Math.sin(az * DEG) * Math.cos(el * DEG) * r, Math.sin(el * DEG) * r, -Math.cos(az * DEG) * Math.cos(el * DEG) * r);
  // where that direction lands on the dome's equirectangular canvas
  const domeU = (az) => { const d = dir(az, 0, 1); return (((Math.atan2(d.z, -d.x) / TAU) % 1) + 1) % 1; };
  function vgrad(g, y0, y1, stops) { const grd = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => grd.addColorStop(i / (stops.length - 1), c)); return grd; }
  function glowAt(g, x, y, r, col, a) {
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, rgba(col, a)); grd.addColorStop(1, rgba(col, 0));
    g.fillStyle = grd; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function poly(g, pts, fill) { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fillStyle = fill; g.fill(); }
  function archPath(g, x, y, w, h, pointed) {
    // an arch standing on (x, y) at its bottom left, w wide and h tall
    const r = w / 2, sy = y - h + (pointed ? w * 0.86 : r);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, sy);
    if (pointed) { g.arcTo(x, y - h + w * 0.25, x + r, y - h, w * 0.9); g.arcTo(x + w, y - h + w * 0.25, x + w, sy, w * 0.9); }
    else g.arc(x + r, sy, r, Math.PI, 0);
    g.lineTo(x + w, y); g.closePath();
  }

  // ------------------------------------------------------------------ the vista's frame
  // The vista owns its textures and materials; dispose() frees them with the room.
  function Kit(o) {
    const owned = [];
    const own = (t) => { owned.push(t); return t; };
    const mat = (p) => own(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.88, metalness: 0, envMapIntensity: 0.3 }, p)));
    const glowCache = new Map();
    const glowMat = (color, i) => { const key = color + (i || 1); if (!glowCache.has(key)) glowCache.set(key, own(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(i === undefined ? 1 : i), toneMapped: false }))); return glowCache.get(key); };
    const tex = (w, h, draw, rep) => {
      const c = canvas(w, h), g = c.getContext('2d');
      draw(g, w, h);
      const t = own(texFrom(c, rep ? { repeat: rep } : null));
      if (!rep) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      return t;
    };
    const tile = (w, h, draw, rep) => { const t = tex(w, h, draw, rep || [1, 1]); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
    return { owned, own, mat, glowMat, tex, tile, o };
  }

  // The sky: a dome with a painted gradient and far horizon, the sun or moon as a sprite and
  // stars as points.
  function sky(k, v, group) {
    const W2 = 2048, H2 = 1024, HY = H2 / 2;
    const elY = (el) => HY - (el / 90) * HY;
    const map = k.tex(W2, H2, (g) => {
      g.fillStyle = vgrad(g, 0, HY, v.stops); g.fillRect(0, 0, W2, HY + 2);
      g.fillStyle = v.below || v.haze; g.fillRect(0, HY, W2, HY);
      // a soft glow round the sun or moon and along the horizon below it
      const lum = v.sun || v.moon;
      if (lum) {
        const x = domeU(lum.az) * W2, y = elY(lum.el);
        for (const dx of [-W2, 0, W2]) { glowAt(g, x + dx, y, (v.sun ? 520 : 260), lum.glow || lum.color, v.sun ? 0.55 : 0.18); glowAt(g, x + dx, HY, v.sun ? 700 : 320, lum.glow || lum.color, v.sun ? 0.35 : 0.08); }
      }
      if (v.clouds) {
        const R = rng(v.seed || 5);
        for (let i = 0; i < v.clouds; i++) {
          const x = R() * W2, y = elY(4 + Math.pow(R(), 1.6) * 34), w = 60 + R() * 160;
          for (let n = 0; n < 9; n++) {
            g.fillStyle = rgba(v.cloud, 0.08 + R() * 0.1);
            g.beginPath(); g.ellipse(x + (R() - 0.5) * w * 1.4, y + (R() - 0.5) * 10, w * (0.25 + R() * 0.35), 5 + R() * 9, 0, 0, TAU); g.fill();
          }
        }
      }
      g.fillStyle = vgrad(g, elY(9), HY, [rgba(v.haze, 0), rgba(v.haze, 0.85)]); g.fillRect(0, elY(9), W2, HY - elY(9) + 1);
      // the far horizon (hills, a city), painted at the dome's equator
      if (v.far) v.far(g, W2, HY, (az) => domeU(az) * W2, elY);
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(170, 64, 32), k.own(new THREE.MeshBasicMaterial({ map, side: THREE.BackSide, fog: false, depthWrite: false })));
    dome.renderOrder = -10;
    group.add(dome);
    if (v.stars) {
      const R = rng(11), pos = [], col = [];
      for (let i = 0; i < v.stars; i++) {
        const el = 6 + Math.acos(1 - R() * 0.92) / (Math.PI / 2) * 84, d = dir(R() * 360, el, 160), b = (0.35 + R() * 0.65) * Math.min(1, el / 25);
        pos.push(d.x, d.y, d.z); col.push(b, b * 0.97, b * 0.9);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const pts = new THREE.Points(geo, k.own(new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, fog: false, depthWrite: false, transparent: true, toneMapped: false })));
      pts.renderOrder = -9;
      group.add(pts);
    }
    const lum = v.sun || v.moon;
    if (lum) {
      const disc = k.tex(128, 128, (g) => {
        const c = lum.color;
        if (v.moon) {
          g.fillStyle = '#fff6e0'; g.beginPath(); g.arc(64, 64, 58, 0, TAU); g.fill();
          const R = rng(3);
          for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(150,150,170,' + (0.08 + R() * 0.12) + ')'; g.beginPath(); g.arc(30 + R() * 68, 30 + R() * 68, 4 + R() * 12, 0, TAU); g.fill(); }
          if (v.moon.crescent) { g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(88, 50, 54, 0, TAU); g.fill(); }
        } else { const grd = g.createRadialGradient(64, 64, 0, 64, 64, 60); grd.addColorStop(0, '#fffaf0'); grd.addColorStop(0.7, shade(c, 0.5)); grd.addColorStop(1, rgba(c, 0)); g.fillStyle = grd; g.fillRect(0, 0, 128, 128); }
      });
      const s = new THREE.Sprite(k.own(new THREE.SpriteMaterial({ map: disc, fog: false, depthWrite: false, toneMapped: false, color: new THREE.Color(v.sun ? '#ffffff' : '#fff8ea').multiplyScalar(v.sun ? 1.6 : 1.25) })));
      s.position.copy(dir(lum.az, lum.el, 150)); s.scale.setScalar(lum.size || 9); s.renderOrder = -8;
      const halo = new THREE.Sprite(k.own(new THREE.SpriteMaterial({ map: glowTexture(), fog: false, depthWrite: false, toneMapped: false, transparent: true, blending: THREE.AdditiveBlending, color: new THREE.Color(lum.glow || lum.color).multiplyScalar(v.sun ? 0.9 : 0.35) })));
      halo.position.copy(s.position); halo.scale.setScalar((lum.size || 9) * (v.sun ? 7 : 5)); halo.renderOrder = -8;
      group.add(s, halo);
    }
  }
  // A round patch of ground with a tiled texture; `hole` cuts out a rectangle [x0, z0, x1, z1].
  function ground(k, map, r, y, rep, holes) {
    const s = new THREE.Shape(); s.absarc(0, 0, r, 0, TAU, false);
    (holes || []).forEach(([x0, z0, x1, z1]) => { const h = new THREE.Path(); h.moveTo(x0, -z0); h.lineTo(x0, -z1); h.lineTo(x1, -z1); h.lineTo(x1, -z0); h.closePath(); s.holes.push(h); });
    const g = new THREE.ShapeGeometry(s, 64).rotateX(-Math.PI / 2).translate(0, y, 0);
    const uv = g.attributes.uv, p = g.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) / rep, p.getZ(i) / rep);
    return g;
  }

  // ------------------------------------------------------------------ shared scenery
  // Painted noise for sand, grass, gravel and paving.
  function speckle(g, w, h, base, dark, light, n, seed) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const R = rng(seed || 3);
    for (let i = 0; i < n; i++) { g.fillStyle = R() < 0.5 ? rgba(dark, 0.05 + R() * 0.12) : rgba(light, 0.05 + R() * 0.12); const s = 1 + R() * 3; g.fillRect(R() * w, R() * h, s, s); }
    for (let i = 0; i < 40; i++) { g.fillStyle = rgba(R() < 0.5 ? dark : light, 0.04); g.beginPath(); g.ellipse(R() * w, R() * h, 20 + R() * 60, 10 + R() * 30, R() * 3, 0, TAU); g.fill(); }
  }
  // Courses of stone or brick, as a tiling texture.
  function courses(g, w, h, base, line, rows, cols, seed, jitter) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const R = rng(seed || 9), rh = h / rows;
    for (let r = 0; r < rows; r++) {
      const cw = w / cols, off = (r % 2) * cw / 2;
      for (let c = -1; c <= cols; c++) { g.fillStyle = rgba(R() < 0.5 ? '#000000' : '#ffffff', R() * (jitter || 0.08)); g.fillRect(off + c * cw, r * rh, cw, rh); }
      g.fillStyle = line; g.fillRect(0, r * rh, w, Math.max(1, rh * 0.08));
      for (let c = 0; c <= cols; c++) g.fillRect(off + c * cw, r * rh, Math.max(1, rh * 0.06), rh);
    }
  }
  function cypress(P, m, x, y, z, h, r) {
    P.add(m, lathe([[0, 0], [r * 0.7, h * 0.08], [r, h * 0.3], [r * 0.82, h * 0.6], [r * 0.4, h * 0.88], [0, h]], 8, 14), { x, y, z });
  }
  function palmTree(k, P, trunkM, frondM, x, y, z, h, lean, seed) {
    const R = rng(seed || 1), top = [x + lean * h * 0.3, y + h, z + lean * h * 0.1];
    P.add(trunkM, K.tube([[x, y, z], [x + lean * h * 0.08, y + h * 0.5, z], top], h * 0.035, { segs: 10, radial: 6 }));
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + R(), len = h * (0.42 + R() * 0.12), droop = 0.5 + R() * 0.4;
      const g = new THREE.PlaneGeometry(len, len * 0.32, 4, 1);
      const p = g.attributes.position;
      for (let j = 0; j < p.count; j++) { const t = (p.getX(j) + len / 2) / len; p.setX(j, t * len); p.setZ(j, -t * t * len * droop); }
      g.computeVertexNormals();
      P.add(frondM, g, { x: top[0], y: top[1], z: top[2], ry: a, rx: -Math.PI / 2 + 0.4 });
    }
  }
  function frondTexture(k, color) {
    const t = k.tex(256, 128, (g, w, h) => {
      g.strokeStyle = color; g.lineWidth = 5;
      g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
      g.lineWidth = 3;
      for (let x = 6; x < w - 6; x += 7) { const l = (1 - x / w) * h * 0.48 + 6; g.beginPath(); g.moveTo(x, h / 2); g.lineTo(x + 16, h / 2 - l); g.moveTo(x, h / 2); g.lineTo(x + 16, h / 2 + l); g.stroke(); }
    });
    return t;
  }
  // A street lamp: a post and a glowing lantern (the glow is a sprite, so it can't be merged).
  function lamp(k, P, postM, x, y, z, h, color, G, size) {
    P.add(postM, lathe([[0.32, 0], [0.3, 0.4], [0.12, 0.6], [0.09, h - 0.6], [0.2, h - 0.4], [0.05, h - 0.2]], 8), { x, y, z });
    P.add(k.glowMat(color, 1.6), new THREE.SphereGeometry(0.34, 10, 8), { x, y: y + h, z });
    G.glows.push([x, y + h, z, color, size || 4]);
  }
  // Soft halos round lamps, torches and beacons: one point cloud per colour and size, so a
  // hundred lights cost a draw call or two.
  function glows(k, list, group) {
    const bins = new Map();
    for (const [x, y, z, c, s] of list) { const key = c + '|' + s; if (!bins.has(key)) bins.set(key, []); bins.get(key).push(x, y, z); }
    for (const [key, pos] of bins) {
      const [c, s] = key.split('|');
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, k.own(new THREE.PointsMaterial({ map: glowTexture(), size: +s, color: new THREE.Color(c).multiplyScalar(0.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
      pts.renderOrder = 2;
      group.add(pts);
    }
  }

  // A square-sectioned lattice member lofted along a path ([x, y, z] points) with half-widths
  // per point; faces are mapped across (u) and along (v, one repeat every `tile`).
  function loft(path, half, tile) {
    const pos = [], uv = [], idx = [], C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const along = [0];
    for (let i = 1; i < path.length; i++) along.push(along[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
    for (let f = 0; f < 4; f++) {
      const a = C[f], b = C[(f + 1) % 4], base = pos.length / 3;
      for (let i = 0; i < path.length; i++) {
        const [x, y, z] = path[i], h = half[i];
        pos.push(x + a[0] * h, y, z + a[1] * h, x + b[0] * h, y, z + b[1] * h);
        uv.push(0, along[i] / tile, 1, along[i] / tile);
        if (i) { const q = base + (i - 1) * 2; idx.push(q, q + 2, q + 1, q + 1, q + 2, q + 3); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  // A Chinese hip roof: eaves ex by ez (half sizes), a ridge 2rx long at height h, concave
  // slopes and corners that sweep up by `lift`.
  function hipRoof(ex, ez, rx, h, lift) {
    const parts = [], N = 10, M = 8;
    const face = (pt) => {
      const g = new THREE.PlaneGeometry(1, 1, N, M), p = g.attributes.position, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) { const u = uv.getX(i) * 2 - 1, t = uv.getY(i), q = pt(u, t); p.setXYZ(i, q[0], q[1], q[2]); uv.setXY(i, uv.getX(i) * 8, t * 3); }
      g.computeVertexNormals(); parts.push(g);
    };
    const y = (u, t) => h * Math.pow(t, 1.55) + lift * Math.pow(1 - t, 2.5) * Math.pow(Math.abs(u), 5);
    face((u, t) => [mix(u * ex, u * rx, t), y(u, t), mix(ez, 0, t)]);
    face((u, t) => [mix(-u * ex, -u * rx, t), y(u, t), mix(-ez, 0, t)]);
    face((u, t) => [mix(ex, rx, t), y(u, t), mix(-u * ez, 0, t)]);
    face((u, t) => [mix(-ex, -rx, t), y(u, t), mix(u * ez, 0, t)]);
    return K.merge(parts);
  }
  // An onion dome of radius r and height h (drum not included), as lathe points.
  const onion = (r, h) => [[r * 0.72, 0], [r * 0.92, h * 0.1], [r, h * 0.26], [r * 0.86, h * 0.5], [r * 0.48, h * 0.74], [r * 0.16, h * 0.9], [r * 0.06, h], [0, h * 1.02]];
  // A building front: wall colour, rows by cols of windows (rect, arch or pointed), some lit.
  function facadeTex(k, o) {
    return k.tex(o.w || 256, o.h || 512, (g, w, h) => {
      speckle(g, w, h, o.base, shade(o.base, -0.4), shade(o.base, 0.3), 900, o.seed || 1);
      const R = rng(o.seed || 1), rows = o.rows, cols = o.cols, cw = w / cols, rh = (h * (1 - (o.top || 0.06))) / rows, y0 = h * (o.top || 0.06);
      if (o.trim) { g.fillStyle = o.trim; g.fillRect(0, 0, w, h * 0.03); for (let r = 1; r < rows; r++) g.fillRect(0, y0 + r * rh - 2, w, 3); }
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = c * cw + cw * 0.22, y = y0 + r * rh + rh * 0.2, ww = cw * 0.56, hh = rh * (r === rows - 1 && o.door ? 0.8 : 0.62);
        const lit = R() < (o.lit || 0);
        g.fillStyle = lit ? (R() < 0.5 ? o.light || '#ffd890' : shade(o.light || '#ffd890', -0.2)) : o.win || '#1a1a24';
        if (o.kind === 'rect' || !o.kind) g.fillRect(x, y, ww, hh);
        else { archPath(g, x, y + hh, ww, hh, o.kind === 'pointed'); g.fill(); }
        if (o.frame) { g.strokeStyle = o.frame; g.lineWidth = 2; if (o.kind === 'rect' || !o.kind) g.strokeRect(x, y, ww, hh); else { archPath(g, x, y + hh, ww, hh, o.kind === 'pointed'); g.stroke(); } }
        if (o.balcony && r > 0 && R() < o.balcony) { g.fillStyle = o.frame || '#eee'; g.fillRect(x - 3, y + hh, ww + 6, 4); }
      }
    });
  }
  // A street block: a box with the front and sides from one facade, and a flat roof.
  function block(P, faceM, roofM, x, y, z, w, h, d, ry) {
    const c = Math.cos(ry || 0), s = Math.sin(ry || 0), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const corners = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]].map(([a, b]) => at(a, b));
    prism(corners, y, y + h).forEach((g) => P.add(faceM, g));
    P.add(roofM, lid(corners, y + h));
  }
  // Glowing neon on a dark board: a word, a border of bulbs and a little picture.
  function neonTex(k, o) {
    return k.tex(512, 256, (g, w, h) => {
      g.fillStyle = o.board || '#0c0a14'; g.fillRect(0, 0, w, h);
      const glowLine = (col, width, draw) => { g.save(); g.shadowColor = col; g.shadowBlur = 18; g.strokeStyle = col; g.fillStyle = col; g.lineWidth = width; draw(); g.restore(); };
      glowLine(o.edge || o.color, 5, () => { g.strokeRect(12, 12, w - 24, h - 24); });
      g.fillStyle = '#fff6d8';
      for (let x = 24; x < w - 12; x += 22) { g.beginPath(); g.arc(x, 24, 4, 0, TAU); g.arc(x, h - 24, 4, 0, TAU); g.fill(); }
      glowLine(o.color, 4, () => {
        g.font = '900 ' + (o.size || 72) + 'px "Jost", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(o.text, w / 2 + (o.icon ? 50 : 0), h / 2 + (o.sub ? -18 : 4));
        if (o.sub) { g.font = '700 34px "Jost", sans-serif'; g.fillStyle = o.edge || o.color; g.fillText(o.sub, w / 2 + (o.icon ? 50 : 0), h / 2 + 46); }
      });
      if (o.icon) glowLine(o.edge || o.color, 6, () => o.icon(g, 90, h / 2));
    });
  }
  // Chess pieces and stars for the signs.
  const SIGN = {
    knight: (g, x, y) => { g.beginPath(); g.moveTo(x - 30, y + 50); g.lineTo(x + 34, y + 50); g.lineTo(x + 24, y + 10); g.quadraticCurveTo(x + 40, y - 20, x + 10, y - 52); g.quadraticCurveTo(x - 40, y - 40, x - 34, y + 4); g.lineTo(x - 12, y - 2); g.lineTo(x - 26, y + 30); g.closePath(); g.stroke(); },
    king: (g, x, y) => { g.beginPath(); g.moveTo(x - 30, y + 50); g.lineTo(x + 30, y + 50); g.lineTo(x + 18, y - 22); g.lineTo(x - 18, y - 22); g.closePath(); g.moveTo(x, y - 22); g.lineTo(x, y - 60); g.moveTo(x - 14, y - 46); g.lineTo(x + 14, y - 46); g.stroke(); },
    star: (g, x, y) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 22 : 54; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.stroke(); },
    cup: (g, x, y) => { g.beginPath(); g.moveTo(x - 34, y - 20); g.lineTo(x + 26, y - 20); g.quadraticCurveTo(x + 24, y + 40, x - 4, y + 44); g.quadraticCurveTo(x - 32, y + 40, x - 34, y - 20); g.moveTo(x + 26, y - 6); g.quadraticCurveTo(x + 48, y + 2, x + 22, y + 22); g.moveTo(x - 14, y - 32); g.quadraticCurveTo(x - 4, y - 46, x - 12, y - 58); g.moveTo(x + 4, y - 32); g.quadraticCurveTo(x + 14, y - 46, x + 6, y - 58); g.stroke(); },
  };
  // A lattice of iron (Eiffel) or a wooden frame: chords, cross bracing and rails, on a clear ground.
  function latticeTex(k, color, rep) {
    const t = k.tile(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h); g.strokeStyle = color; g.lineCap = 'square';
      g.lineWidth = 16; g.beginPath(); g.moveTo(4, 0); g.lineTo(4, h); g.moveTo(w - 4, 0); g.lineTo(w - 4, h); g.stroke();
      g.lineWidth = 9; g.beginPath(); g.moveTo(0, 3); g.lineTo(w, 3); g.stroke();
      g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, h); g.moveTo(w, 0); g.lineTo(0, h); g.stroke();
    }, rep || [1, 1]);
    return t;
  }

  // ------------------------------------------------------------------ the landmarks
  // Each builder takes the kit, a Parts collector and the vista settings, adds its meshes and
  // returns anything extra (reflections, glows) through the group it is given.
  const BUILD = {};

  // The Taj Mahal by moonlight, seen from the far end of its long pool.
  BUILD.taj = (k, P, v, group, G) => {
    const marble = k.tile(512, 512, (g, w, h) => {
      speckle(g, w, h, '#eef1f6', '#b8c0cc', '#ffffff', 2400, 4);
      g.strokeStyle = 'rgba(150,160,180,0.25)'; g.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(Math.random() * w, 0); g.bezierCurveTo(Math.random() * w, h / 3, Math.random() * w, h * 0.66, Math.random() * w, h); g.stroke(); }
    });
    const white = k.mat({ map: marble, color: '#dfe6f2', roughness: 0.55, emissive: '#2a3450', emissiveIntensity: 0.35 });
    // the main face: a tall arched portal (pishtaq) framed by calligraphy, with two storeys of
    // arched alcoves at its sides
    const face = (portal) => k.tex(512, 768, (g, w, h) => {
      g.drawImage(marble.image, 0, 0, w, h);
      const ink = '#2a2a34', inlay = 'rgba(40,40,52,0.55)';
      if (portal) {
        const fx = w * 0.18, fw = w * 0.64, fy = h * 0.05, fh = h * 0.95;
        g.strokeStyle = ink; g.lineWidth = 10; g.strokeRect(fx, fy, fw, fh);
        g.lineWidth = 3; g.strokeRect(fx + 16, fy + 16, fw - 32, fh - 16);
        // the arch: deep shadow inside, a lit lower doorway and a latticed window
        g.save(); archPath(g, fx + 46, h, fw - 92, fh - 70, true);
        g.fillStyle = vgrad(g, fy + 70, h, ['#5a6274', '#3a4254', '#2a3040']); g.fill();
        g.strokeStyle = ink; g.lineWidth = 6; g.stroke(); g.clip();
        archPath(g, w / 2 - 50, h, 100, 210, true); g.fillStyle = '#ffd890'; g.fill();
        archPath(g, w / 2 - 60, h - 260, 120, 190, true); g.fillStyle = '#4a5468'; g.fill();
        g.strokeStyle = 'rgba(220,226,240,0.6)'; g.lineWidth = 2;
        for (let x = w / 2 - 60; x <= w / 2 + 60; x += 14) { g.beginPath(); g.moveTo(x, h - 450); g.lineTo(x, h - 260); g.stroke(); }
        g.restore();
        // pietra dura flowers in the spandrels
        for (const x of [fx + 40, fx + fw - 40]) for (let i = 0; i < 3; i++) { g.fillStyle = ['#9a3a3a', '#3a6a4a', '#c8a050'][i]; g.beginPath(); g.arc(x + (i - 1) * 8, fy + 60 + i * 6, 6, 0, TAU); g.fill(); }
        g.fillStyle = inlay;
        for (let y = fy + 26; y < h; y += 26) { g.fillRect(fx + 3, y, 10, 3); g.fillRect(fx + fw - 13, y, 10, 3); }
      }
      // side alcoves, two storeys
      const cols = portal ? [[w * 0.02, w * 0.14]] : [[w * 0.14, w * 0.72]];
      for (const [x0, aw] of cols) for (const [y0, ah] of [[h * 0.48, h * 0.4], [h * 0.95, h * 0.4]]) {
        const sides = portal ? [x0, w - x0 - aw] : [x0];
        for (const x of sides) {
          archPath(g, x, y0, aw, ah, true); g.fillStyle = vgrad(g, y0 - ah, y0, ['#4a5468', '#2a3242']); g.fill();
          g.strokeStyle = ink; g.lineWidth = 4; g.stroke();
          g.strokeRect(x - 6, y0 - ah - 10, aw + 12, ah + 10);
        }
      }
    });
    const portalM = k.mat({ map: face(true), color: '#dfe6f2', roughness: 0.6, emissive: '#2a3450', emissiveIntensity: 0.35 });
    const bayM = k.mat({ map: face(false), color: '#dfe6f2', roughness: 0.6, emissive: '#2a3450', emissiveIntensity: 0.35 });
    const gold = k.mat({ color: '#e0b860', metalness: 0.9, roughness: 0.3, emissive: '#3a2a10', emissiveIntensity: 0.4 });
    const Z = v.z, B = G.y;
    // the plinth: a terrace of arched niches
    const plinthM = k.mat({ map: k.tile(256, 128, (g, w, h) => { g.drawImage(marble.image, 0, 0, w, h); archPath(g, w * 0.18, h * 0.95, w * 0.64, h * 0.8, true); g.fillStyle = '#3a4254'; g.fill(); g.strokeStyle = '#2a2a34'; g.lineWidth = 4; g.stroke(); }, [12, 1]), color: '#dfe6f2', emissive: '#2a3450', emissiveIntensity: 0.35, roughness: 0.6 });
    const PW = 58, PH = 4.4;
    for (const [x, z, ry] of [[0, PW / 2, 0], [0, -PW / 2, Math.PI], [PW / 2, 0, Math.PI / 2], [-PW / 2, 0, -Math.PI / 2]]) P.add(plinthM, wall(PW, PH, x, B, Z + z, ry));
    P.add(white, new THREE.PlaneGeometry(PW, PW).rotateX(-Math.PI / 2).translate(0, B + PH, Z));
    P.add(k.mat({ color: '#9a4a36', roughness: 0.9 }), box(PW + 8, 0.8, PW + 8, 0, B - 0.4, Z));
    // the tomb: an octagon with long main faces and short corner bays
    const y0 = B + PH, y1 = y0 + 20, A = 17, C = 6.5;
    const oct = [[A, A - C], [A, -(A - C)], [A - C, -A], [-(A - C), -A], [-A, -(A - C)], [-A, A - C], [-(A - C), A], [A - C, A]].map(([x, z]) => [x, z + Z]);
    prism(oct, y0, y1).forEach((g, i) => P.add(i % 2 ? bayM : portalM, g));
    P.add(white, lid(oct, y1));
    // parapet and the portal's raised crown
    P.add(white, box(2 * (A - C) * 0.66, 2.2, 0.6, 0, y1, Z + A));
    P.add(white, box(2 * (A - C) * 0.66, 2.2, 0.6, 0, y1, Z - A));
    // the great dome on its drum, with a gold finial
    P.add(white, lathe([[8.2, 0], [8.2, 3.6], [8.6, 3.8], [8.3, 4.1], [9.8, 7], [10.4, 10], [9.6, 13.4], [7.2, 16.6], [4.2, 19], [1.8, 20.6], [0.5, 21.4], [0, 21.6]], 40, 60), { y: y1, z: Z });
    P.add(gold, lathe([[0.5, 0], [0.9, 0.6], [0.3, 1.1], [0.7, 1.6], [0.25, 2.2], [0.5, 2.7], [0.12, 3.3], [0.06, 5], [0, 5.1]], 12), { y: y1 + 21.4, z: Z });
    // four small domed kiosks (chhatris) on the roof
    const chhatri = (x, y, z, s) => {
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; P.add(white, new THREE.CylinderGeometry(0.16 * s, 0.16 * s, 2.4 * s, 6).translate(Math.cos(a) * 1.9 * s, y + 1.2 * s, Math.sin(a) * 1.9 * s + z).translate(x, 0, 0)); }
      P.add(white, new THREE.CylinderGeometry(2.4 * s, 2.4 * s, 0.4 * s, 16).translate(x, y + 2.6 * s, z));
      P.add(white, lathe([[2.2, 0], [2.5, 1], [2.1, 2.2], [1, 3.1], [0, 3.4]], 16, 14), { x, y: y + 2.8 * s, z, s });
      P.add(gold, new THREE.ConeGeometry(0.18 * s, 1.4 * s, 6).translate(x, y + 6.6 * s, z));
    };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) chhatri(sx * 10.5, y1, Z + sz * 10.5, 1);
    // the minarets at the plinth's corners
    const minaret = lathe([[2.1, 0], [1.9, 8], [2.6, 8.2], [2.6, 8.8], [1.8, 9], [1.65, 16], [2.4, 16.2], [2.4, 16.8], [1.55, 17], [1.45, 23], [2.3, 23.2], [2.3, 23.7], [0, 23.7]], 16);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { P.add(white, minaret.clone(), { x: sx * (PW / 2 - 2.5), y: y0, z: Z + sz * (PW / 2 - 2.5) }); chhatri(sx * (PW / 2 - 2.5), y0 + 23.7, Z + sz * (PW / 2 - 2.5), 0.75); }
    // the red sandstone mosque and its twin on either side, with white domes
    const red = k.mat({ map: k.tile(256, 256, (g, w, h) => { speckle(g, w, h, '#a8503a', '#5a2418', '#d88a6a', 1400, 8); archPath(g, w * 0.2, h, w * 0.6, h * 0.7, true); g.fillStyle = '#3a1810'; g.fill(); g.strokeStyle = '#f0e0d0'; g.lineWidth = 6; g.stroke(); }, [5, 1]), roughness: 0.9, emissive: '#2a1010', emissiveIntensity: 0.3 });
    for (const sx of [-1, 1]) {
      const x = sx * 62, z = Z + 6;
      for (const [px, pz, ry, w] of [[0, 7, 0, 30], [sx * -15, 0, sx * -Math.PI / 2, 14]]) P.add(red, wall(w, 11, x + px, B, z + pz, ry));
      P.add(k.mat({ color: '#7a3424', roughness: 0.9 }), box(30, 0.6, 14, x, B + 11, z));
      for (const dx of [-9, 0, 9]) P.add(white, lathe([[3.2, 0], [3.8, 1.6], [3.2, 3.6], [1.4, 5.2], [0, 5.6]], 20, 18), { x: x + dx, y: B + 11.6, z, s: dx ? 0.7 : 1 });
    }
    // the reflection in the long pool: a darkened mirror image under the water
    G.reflect = { y: G.water, tint: 0.45 };
  };

  // ------------------------------------------------------------------ vistas
  // Gardens, terraces and streets around each landmark. `outdoor` vistas replace the room's
  // walls; the others are seen through its windows.
  const VISTAS = {
    // Egypt: a stone terrace on the Giza plateau at sunset, before the three pyramids and the Sphinx.
    giza: {
      outdoor: true, fog: { color: '#d89a78', density: 0.0026 },
      sky: { stops: ['#1e2250', '#5a3a62', '#c8664a', '#f0a868'], haze: '#e89a68', below: '#d89a78', clouds: 10, cloud: '#ffd8b0', sun: { az: -48, el: 5, size: 13, color: '#ffb060', glow: '#ffa050' },
        far(g, W, HY) { g.fillStyle = '#c88a5a'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 16) g.lineTo(x, HY - 5 - Math.abs(Math.sin(x * 0.006) * 9 + Math.sin(x * 0.021) * 4)); g.lineTo(W, HY + 2); g.fill(); } },
      build(k, P, G) {
        const B = G.y;
        const sandT = k.tile(512, 512, (g, w, h) => { speckle(g, w, h, '#c89058', '#986432', '#e0b47a', 6000, 6); g.strokeStyle = 'rgba(160,110,60,0.18)'; g.lineWidth = 3; for (let y = 0; y < h; y += 26) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.03 + y) * 6); g.stroke(); } });
        P.add(k.mat({ map: sandT, roughness: 1 }), ground(k, null, 165, B, 14));
        // the pyramids: limestone courses, the second still capped in smooth casing
        const courseT = k.tile(256, 256, (g, w, h) => { courses(g, w, h, '#c8945a', 'rgba(90,50,20,0.6)', 12, 6, 4, 0.14); }, [6, 18]);
        const stone = k.mat({ map: courseT, roughness: 0.95, flatShading: true });
        const cap = k.mat({ color: '#efd2a2', roughness: 0.7, flatShading: true });
        const pyramid = (x, z, half, h, m) => { const g = new THREE.ConeGeometry(half * Math.SQRT2, h, 4, 1).rotateY(Math.PI / 4).toNonIndexed(); g.computeVertexNormals(); P.add(m || stone, g, { x, y: B + h / 2, z }); };
        pyramid(-30, -122, 34, 44);
        pyramid(26, -158, 32, 42);
        P.add(cap, new THREE.ConeGeometry(8.2 * Math.SQRT2, 10.8, 4, 1).rotateY(Math.PI / 4).toNonIndexed(), { x: 26, y: B + 42 - 5.4 + 0.05, z: -158 });
        pyramid(66, -176, 16, 21);
        for (let i = 0; i < 3; i++) pyramid(84 + i * 9, -168 + i * 2, 3.6, 4.6);
        // the Sphinx, facing the sunrise (and us)
        const sph = k.mat({ map: k.tile(128, 128, (g, w, h) => courses(g, w, h, '#c8945e', 'rgba(90,56,24,0.5)', 6, 3, 8, 0.15), [2, 2]), roughness: 0.95 });
        const sx = 14, sz = -66;
        P.add(sph, box(4.6, 3.6, 15, sx, B, sz));
        P.add(sph, lathe([[2.6, 0], [2.4, 2.2], [1.4, 3.8], [0, 4.1]], 10), { x: sx, y: B, z: sz - 6, s: [1, 1, 1.4] });
        for (const dx of [-1.4, 1.4]) P.add(sph, box(1.3, 1.1, 6, sx + dx, B, sz + 9));
        P.add(sph, box(3.4, 4.6, 3.2, sx, B + 2.4, sz + 5.6));
        P.add(sph, K.extrude([[-2.4, 0], [2.4, 0], [1.5, 3.4], [-1.5, 3.4]], 2.6, 0.1), { x: sx, y: B + 6.2, z: sz + 5.4 });
        P.add(sph, box(1.9, 2.4, 1.2, sx, B + 6.6, sz + 7.1));
        // obelisks and sphinxes guarding the terrace
        const gold = k.mat({ color: '#f0c060', metalness: 0.9, roughness: 0.25 });
        const granite = k.mat({ map: k.tile(128, 256, (g, w, h) => { speckle(g, w, h, '#b06a52', '#5a2a20', '#e0a080', 1600, 3); g.fillStyle = 'rgba(60,24,16,0.5)'; for (let y = 20; y < h; y += 26) for (let x = 40; x < 90; x += 16) g.fillRect(x, y, 8, 14); }), roughness: 0.6 });
        for (const s of [-1, 1]) {
          P.add(granite, new THREE.CylinderGeometry(0.62, 0.95, 13, 4, 1).rotateY(Math.PI / 4).toNonIndexed(), { x: s * 16, y: B + 0.8 + 6.5, z: -18 });
          P.add(gold, new THREE.ConeGeometry(0.88, 1.4, 4).rotateY(Math.PI / 4), { x: s * 16, y: B + 0.8 + 13.7, z: -18 });
          P.add(granite, box(2.6, 0.8, 2.6, s * 16, B, -18));
        }
        // date palms at the edge of the plateau and down by the river
        const trunk = k.mat({ color: '#6a4a2e', roughness: 1 }), frond = k.own(new THREE.MeshStandardMaterial({ map: frondTexture(k, '#3a5a24'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
        const palms = [[-16, 4, 7, 0.2], [-19, -6, 9, -0.15], [17, 8, 8, -0.2], [20, -2, 6.5, 0.15], [-46, -40, 9, 0.1], [-52, -48, 8, -0.1], [-40, -56, 10, 0.05], [48, -36, 9, -0.1], [56, -44, 8, 0.12], [-70, -20, 9, 0], [72, -16, 10, 0.1]];
        palms.forEach(([x, z, h, l], i) => palmTree(k, P, trunk, frond, x, B, z, h, l, i + 3));
      },
    },
    // Greece: a marble stoa below the Acropolis; the Parthenon stands on its rock beyond the
    // colonnade, above the roofs of Athens.
    acropolis: {
      drop: 3, fog: { color: '#d89a78', density: 0.0045 },
      sky: { stops: ['#141c3a', '#3a3a6a', '#c87a5a', '#f2c890'], haze: '#f0b880', below: '#d89a78', clouds: 8, cloud: '#ffd0b0', sun: { az: 52, el: 4, size: 11, color: '#ffb070' },
        far(g, W, HY) { g.fillStyle = '#7a5a6a'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 16) g.lineTo(x, HY - 10 - Math.abs(Math.sin(x * 0.004) * 22 + Math.sin(x * 0.017) * 6)); g.lineTo(W, HY + 2); g.fill(); } },
      build(k, P, G) {
        const B = G.y;
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#a89060', '#6a5a3a', '#c8b080', 5000, 5)), roughness: 1 }), ground(k, null, 165, B, 12));
        // the rock: a broad cliff-sided mesa
        const rockT = k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#9a7a62', '#5a4434', '#c0a080', 4000, 2), [4, 1]);
        const rock = new THREE.CylinderGeometry(34, 46, 12, 18, 3, false), rp = rock.attributes.position, R = rng(5);
        for (let i = 0; i < rp.count; i++) { const y = rp.getY(i); if (y < 5.9) { const f = 1 + (R() - 0.5) * 0.12; rp.setX(i, rp.getX(i) * f); rp.setZ(i, rp.getZ(i) * f); } }
        rock.computeVertexNormals();
        P.add(k.mat({ map: rockT, roughness: 1, flatShading: true }), rock, { x: 0, y: B + 6, z: -112, s: [1.6, 1, 1] });
        const top = B + 12;
        // the Parthenon, new and painted: 8 by 17 Doric columns, a frieze and a sculpted pediment
        const marbleT = k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#f4e2c4', '#c8a880', '#fff4e0', 1800, 7));
        const marble = k.mat({ map: marbleT, roughness: 0.7, emissive: '#3a2410', emissiveIntensity: 0.25 });
        const flutes = k.mat({ map: k.tile(128, 32, (g, w, h) => { g.drawImage(marbleT.image, 0, 0, w, h); g.fillStyle = 'rgba(120,90,60,0.35)'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 2, h); }, [2, 1]), roughness: 0.7, emissive: '#3a2410', emissiveIntensity: 0.25 });
        const Z = -112, Wd = 30, Dp = 13, cy = top + 1.8;
        for (let i = 0; i < 3; i++) P.add(marble, box(Wd + 3 - i, 0.6, Dp + 3 - i, 0, top + i * 0.6, Z));
        const col = new THREE.CylinderGeometry(0.62, 0.78, 9, 14, 1, true);
        const at = [];
        for (let i = 0; i < 8; i++) { const x = -Wd / 2 + 0.9 + i * (Wd - 1.8) / 7; at.push([x, Z + Dp / 2 - 0.9], [x, Z - Dp / 2 + 0.9]); }
        for (let i = 1; i < 16; i++) { const z = Z - Dp / 2 + 0.9 + i * (Dp - 1.8) / 16; at.push([-Wd / 2 + 0.9, z], [Wd / 2 - 0.9, z]); }
        at.forEach(([x, z]) => { P.add(flutes, col.clone(), { x, y: cy + 4.5, z }); P.add(marble, box(1.8, 0.4, 1.8, x, cy + 9, z)); });
        P.add(marble, box(Wd - 6, 8, Dp - 5, 0, cy, Z));
        // entablature: architrave, a frieze of triglyphs and painted metopes, the cornice
        const frieze = k.mat({ map: k.tile(256, 64, (g, w, h) => {
          g.fillStyle = '#f2dcbc'; g.fillRect(0, 0, w, h);
          for (let x = 0; x < w; x += 64) { g.fillStyle = '#2a3a6a'; g.fillRect(x, 0, 22, h); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + 6, 4, 3, h - 8); g.fillRect(x + 13, 4, 3, h - 8); g.fillStyle = '#a83a2a'; g.fillRect(x + 22, 0, 42, 8); g.fillStyle = '#c8a070'; g.beginPath(); g.arc(x + 43, 36, 12, 0, TAU); g.fill(); }
        }, [Wd / 3, 1]), roughness: 0.7, emissive: '#3a2410', emissiveIntensity: 0.2 });
        P.add(marble, box(Wd, 1.3, Dp, 0, cy + 9.4, Z));
        prism([[-Wd / 2, Dp / 2], [Wd / 2, Dp / 2], [Wd / 2, -Dp / 2], [-Wd / 2, -Dp / 2]].map(([x, z]) => [x, z + Z]), cy + 10.7, cy + 12.1).forEach((g) => P.add(frieze, g));
        P.add(marble, box(Wd + 0.6, 0.5, Dp + 0.6, 0, cy + 12.1, Z));
        const ped = k.mat({ map: k.tex(512, 128, (g, w, h) => {
          g.fillStyle = '#1e3a7a'; g.fillRect(0, 0, w, h);
          g.fillStyle = '#f4e2c4';
          for (let i = 0; i < 13; i++) { const x = 60 + i * 30, hh = (1 - Math.abs(i - 6) / 7) * 70 + 14; g.fillRect(x, h - hh - 4, 16, hh); g.beginPath(); g.arc(x + 8, h - hh - 10, 8, 0, TAU); g.fill(); }
        }), roughness: 0.7, emissive: '#3a2410', emissiveIntensity: 0.2 });
        for (const s of [1, -1]) {
          const tri = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(-Wd / 2, 0), new THREE.Vector2(Wd / 2, 0), new THREE.Vector2(0, 3.4)]));
          const uv = tri.attributes.uv, p = tri.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) + Wd / 2) / Wd, p.getY(i) / 3.4);
          P.add(ped, tri, { x: 0, y: cy + 12.6, z: Z + s * (Dp / 2 + 0.1), ry: s > 0 ? 0 : Math.PI });
        }
        P.add(k.mat({ color: '#b86a4a', roughness: 0.8 }), K.extrude([[-Wd / 2 - 0.3, 0], [Wd / 2 + 0.3, 0], [0, 3.5]], Dp + 0.2, 0), { y: cy + 12.55, z: Z });
        // the Erechtheion beside it, with its porch of maidens
        P.add(marble, box(9, 6, 6, 22, top, -104));
        for (let i = 0; i < 6; i++) P.add(flutes, new THREE.CylinderGeometry(0.35, 0.4, 5.4, 10, 1, true), { x: 18 + i * 1.6, y: top + 2.7, z: -100.4 });
        P.add(marble, box(10, 0.7, 2.2, 22, top + 5.4, -100.6));
        // the city below: white houses with tiled roofs, cypresses and olive trees
        const house = k.mat({ color: '#e8d8c0', roughness: 0.95 }), tiles = k.mat({ color: '#a8583a', roughness: 0.9 });
        const R2 = rng(21);
        for (let i = 0; i < 70; i++) {
          const a = (R2() - 0.5) * 2.2, r = 40 + R2() * 70, x = Math.sin(a) * r * 1.3, z = -Math.cos(a) * r + 10;
          if (Math.abs(x) < 26 && z < -75 && z > -150) continue;
          if (z > -22 || (Math.abs(x) < -z * 0.6 && z > -70)) continue;
          const w = 3 + R2() * 4, d = 3 + R2() * 3, h = 2.4 + R2() * 3, ry = R2() * 0.4;
          P.add(house, box(w, h, d, 0, 0, 0), { x, y: B, z, ry });
          P.add(tiles, new THREE.ConeGeometry(Math.max(w, d) * 0.72, 1.3, 4).rotateY(Math.PI / 4), { x, y: B + h + 0.65, z, ry, s: [w / Math.max(w, d), 1, d / Math.max(w, d)] });
        }
        const cyM = k.mat({ color: '#1e3a22', roughness: 1 }), olive = k.mat({ color: '#5a6a3a', roughness: 1 });
        for (let i = 0; i < 40; i++) {
          const x = (R2() - 0.5) * 180, z = -24 - R2() * 120;
          if (Math.abs(x) < 70 && z < -80 && z > -146) continue;
          if (R2() < 0.5) cypress(P, cyM, x, B, z, 5 + R2() * 4, 0.9);
          else P.add(olive, new THREE.IcosahedronGeometry(1.8 + R2(), 0), { x, y: B + 2, z, s: [1.3, 0.8, 1.3] });
        }
      },
    },
    // Rome: on the sand of the Colosseum's arena at dusk, tiers of seats rising all round,
    // torches along the podium and the emperor's box straight ahead.
    colosseum: {
      outdoor: true, fog: { color: '#a85a4a', density: 0.003 },
      sky: { stops: ['#1a1430', '#4a2a4a', '#c8603a', '#f8a858'], haze: '#f0a060', below: '#c87050', clouds: 12, cloud: '#ffb890', sun: { az: -100, el: 3, size: 12, color: '#ff9a50' } },
      build(k, P, G) {
        const B = G.y, AX = 46, AZ = 34, SX = AX / AZ;
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#d8b080', '#a87a50', '#f0d0a0', 7000, 9)), roughness: 1 }), ground(k, null, 165, B, 10));
        const trav = k.tile(256, 256, (g, w, h) => courses(g, w, h, '#c4a682', 'rgba(90,70,50,0.45)', 6, 3, 2, 0.1));
        const stoneM = k.mat({ map: trav, roughness: 0.9, side: THREE.DoubleSide, emissive: '#3a1a10', emissiveIntensity: 0.25 });
        // seats: stepped bands, drawn as stripes on sloping rings
        const seatT = k.tile(64, 256, (g, w, h) => { for (let y = 0; y < h; y += 16) { g.fillStyle = '#c8aa80'; g.fillRect(0, y, w, 9); g.fillStyle = '#5a3a28'; g.fillRect(0, y + 9, w, 7); } g.fillStyle = 'rgba(60,40,30,0.5)'; g.fillRect(0, 0, 3, h); }, [64, 1]);
        const seats = k.mat({ map: seatT, roughness: 0.95, side: THREE.DoubleSide, emissive: '#3a1a10', emissiveIntensity: 0.25 });
        // walls between the tiers, pierced by arched entrances
        const arcT = k.tile(128, 128, (g, w, h) => { g.drawImage(trav.image, 0, 0, w, h); archPath(g, w * 0.25, h, w * 0.5, h * 0.8, false); g.fillStyle = '#2a1810'; g.fill(); g.strokeStyle = 'rgba(255,230,190,0.5)'; g.lineWidth = 3; g.stroke(); }, [80, 1]);
        const arcM = k.mat({ map: arcT, roughness: 0.9, side: THREE.DoubleSide, emissive: '#3a1a10', emissiveIntensity: 0.25 });
        const ring = (pts, m, segs) => P.add(m, lathe(pts.map(([r, y]) => [r * AZ, y]), segs || 96), { y: B, s: [SX, 1, 1] });
        const podT = k.tile(256, 64, (g, w, h) => { g.fillStyle = '#efe4d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#7a1e22'; g.fillRect(0, h * 0.6, w, h * 0.4); g.fillStyle = '#d8b060'; g.fillRect(0, h * 0.56, w, 4); for (let x = 0; x < w; x += 32) { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, 0, 3, h * 0.56); } }, [60, 1]);
        ring([[1.0, 0], [1.0, 5]], k.mat({ map: podT, roughness: 0.6, side: THREE.DoubleSide }));
        ring([[1.0, 5], [1.05, 5.2]], stoneM);
        ring([[1.05, 5.2], [1.36, 15]], seats); ring([[1.36, 15], [1.37, 19]], arcM);
        ring([[1.37, 19], [1.62, 27]], seats); ring([[1.62, 27], [1.63, 31]], arcM);
        ring([[1.63, 31], [1.8, 36]], seats);
        // the top gallery, its colonnade and the masts for the awning
        ring([[1.8, 36], [1.81, 46], [1.95, 46]], k.mat({ map: k.tile(128, 128, (g, w, h) => { g.drawImage(trav.image, 0, 0, w, h); g.fillStyle = '#2a1810'; for (let x = 10; x < w; x += 32) g.fillRect(x, h * 0.3, 18, h * 0.62); }, [90, 1]), roughness: 0.9, side: THREE.DoubleSide, emissive: '#3a1a10', emissiveIntensity: 0.25 }));
        const mastM = k.mat({ color: '#5a3a24', roughness: 0.8 });
        for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; P.add(mastM, new THREE.CylinderGeometry(0.14, 0.18, 9, 5), { x: Math.cos(a) * 1.88 * AX, y: B + 50, z: Math.sin(a) * 1.88 * AZ }); }
        // the emperor's box: columns, a purple awning, and the magistrate's box opposite
        const porph = k.mat({ color: '#6a1a2a', roughness: 0.5 }), gold = k.mat({ color: '#e0b050', metalness: 0.9, roughness: 0.3 });
        for (const [z, s] of [[-AZ, 1], [AZ, -1]]) {
          P.add(stoneM, box(16, 1, 4, 0, B + 5, z - s * 1.5));
          for (let i = 0; i < 5; i++) P.add(stoneM, new THREE.CylinderGeometry(0.3, 0.34, 5, 10), { x: -6 + i * 3, y: B + 8.5, z: z + s * 0.2 });
          P.add(porph, box(17, 0.4, 5.4, 0, B + 11, z - s * 1.4));
          P.add(gold, new THREE.SphereGeometry(0.5, 12, 8), { x: 0, y: B + 12, z });
        }
        // red banners on the podium wall
        const banner = k.mat({ map: k.tex(64, 256, (g, w, h) => { g.fillStyle = '#9a1a1e'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8b850'; g.fillRect(0, 0, w, 10); g.font = 'bold 18px serif'; g.textAlign = 'center'; ['S', 'P', 'Q', 'R'].forEach((c, i) => g.fillText(c, w / 2, 60 + i * 40)); g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, h - 30); g.lineTo(w, h); g.fill(); }), roughness: 0.9, side: THREE.DoubleSide });
        for (let i = 0; i < 16; i++) {
          const a = (i + 0.5) / 16 * TAU, x = Math.cos(a) * AX * 0.995, z = Math.sin(a) * AZ * 0.995;
          if (Math.abs(x) < 10) continue;
          P.add(banner, new THREE.PlaneGeometry(1.6, 4.4), { x, y: B + 2.6, z, ry: Math.atan2(-x / SX / SX, -z) });
          const tx = Math.cos(a + 0.2) * AX * 0.98, tz = Math.sin(a + 0.2) * AZ * 0.98;
          P.add(gold, lathe([[0.1, 0], [0.1, 1.6], [0.36, 2.0], [0.4, 2.2], [0, 2.2]], 8), { x: tx, y: B + 5.2, z: tz });
          G.glows.push([tx, B + 7.8, tz, '#ff9a40', 4]);
          P.add(k.glowMat('#ffb050', 2.2), new THREE.ConeGeometry(0.3, 0.9, 6), { x: tx, y: B + 7.7, z: tz });
        }
      },
    },
    // Ming China: a scholar's study whose round windows open on the great courtyard and the
    // Hall of Supreme Harmony on its three marble terraces.
    hall: {
      drop: 17, fog: { color: '#d08060', density: 0.0045 },
      sky: { stops: ['#1a0e2a', '#4a1a2a', '#c8502a', '#f0a050'], haze: '#f0a060', below: '#d08060', clouds: 9, cloud: '#ffb080', sun: { az: -30, el: 10, size: 12, color: '#ffb070' } },
      build(k, P, G) {
        const B = G.y;
        P.add(k.mat({ map: k.tile(256, 256, (g, w, h) => courses(g, w, h, '#8a8078', 'rgba(40,36,34,0.6)', 4, 2, 3, 0.12)), roughness: 0.9 }), ground(k, null, 165, B, 6));
        const jade = k.tile(256, 128, (g, w, h) => { g.fillStyle = '#efe8dc'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(120,110,100,0.5)'; g.fillRect(0, 0, w, 6); g.fillRect(0, h * 0.3, w, 4); for (let x = 0; x < w; x += 32) { g.fillRect(x, 0, 6, h * 0.3); g.beginPath(); g.arc(x + 3, -2, 6, 0, TAU); g.fill(); } }, [20, 1]);
        const terraceM = k.mat({ map: jade, roughness: 0.8, emissive: '#3a2010', emissiveIntensity: 0.2 });
        const topM = k.mat({ color: '#e8e0d4', roughness: 0.85 });
        const Z = -112;
        let y = B;
        [[78, 52], [70, 46], [62, 40]].forEach(([w, d]) => {
          const pts = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]].map(([x, z]) => [x, z + Z]);
          prism(pts, y, y + 2.4).forEach((g) => P.add(terraceM, g)); P.add(topM, lid(pts, y + 2.4)); y += 2.4;
        });
        // the carved ramp up the middle
        P.add(k.mat({ color: '#d8d0c4', roughness: 0.8 }), new THREE.BoxGeometry(6, 0.4, 26).rotateX(Math.atan2(7.2, 22)).translate(0, B + 3.6, Z + 37), {});
        // the hall: red columns and gilded lattice doors under a double-eaved yellow roof
        const hallT = k.tex(1024, 256, (g, w, h) => {
          g.fillStyle = '#8a1a14'; g.fillRect(0, 0, w, h);
          const bays = 11, bw = w / bays;
          for (let i = 0; i < bays; i++) {
            g.fillStyle = '#c8a050'; g.fillRect(i * bw + 10, h * 0.16, bw - 20, h * 0.84);
            g.strokeStyle = '#5a1008'; g.lineWidth = 3;
            for (let x = i * bw + 16; x < (i + 1) * bw - 12; x += 10) { g.beginPath(); g.moveTo(x, h * 0.2); g.lineTo(x, h * 0.62); g.stroke(); }
            for (let yy = h * 0.2; yy < h * 0.62; yy += 10) { g.beginPath(); g.moveTo(i * bw + 12, yy); g.lineTo((i + 1) * bw - 12, yy); g.stroke(); }
            g.fillStyle = '#a8241a'; g.fillRect(i * bw - 5, 0, 10, h);
          }
          g.fillStyle = '#1e4a5a'; g.fillRect(0, 0, w, h * 0.14);
          g.fillStyle = '#e8c060'; for (let x = 0; x < w; x += 24) g.fillRect(x + 4, h * 0.03, 14, h * 0.08);
        });
        const hallM = k.mat({ map: hallT, roughness: 0.8, emissive: '#2a0a04', emissiveIntensity: 0.3 });
        const HW = 27, HD = 13, hy = y;
        prism([[-HW, HD], [HW, HD], [HW, -HD], [-HW, -HD]].map(([x, z]) => [x, z + Z]), hy, hy + 11).forEach((g) => P.add(hallM, g));
        const tile = k.mat({ map: k.tile(64, 64, (g, w, h) => { g.fillStyle = '#e8a828'; g.fillRect(0, 0, w, h); g.fillStyle = '#b87a10'; g.fillRect(0, 0, 8, h); g.fillRect(32, 0, 8, h); g.fillStyle = 'rgba(255,240,160,0.5)'; g.fillRect(14, 0, 6, h); g.fillRect(46, 0, 6, h); }), roughness: 0.45, side: THREE.DoubleSide, emissive: '#3a2004', emissiveIntensity: 0.3 });
        P.add(tile, hipRoof(HW + 6, HD + 6, HW - 2, 5, 1.6), { y: hy + 11, z: Z });
        prism([[-HW + 4, HD - 3], [HW - 4, HD - 3], [HW - 4, -HD + 3], [-HW + 4, -HD + 3]].map(([x, z]) => [x, z + Z]), hy + 13, hy + 17).forEach((g) => P.add(hallM, g));
        P.add(tile, hipRoof(HW + 1, HD + 1.5, HW - 8, 7, 1.4), { y: hy + 16.6, z: Z });
        const ridge = k.mat({ color: '#d89818', roughness: 0.4, metalness: 0.2 });
        P.add(ridge, box(2 * (HW - 8) + 1, 1.0, 0.8, 0, hy + 23.4, Z));
        for (const s of [-1, 1]) P.add(ridge, K.extrude([[0, 0], [1.4, 0], [1.6, 2.4], [0.6, 1.6], [0.2, 2.8]], 0.6, 0.05), { x: s * (HW - 7.5), y: hy + 23.4, z: Z, ry: s > 0 ? 0 : Math.PI });
        // bronze cauldrons and the gate halls along the sides of the courtyard
        const bronze = k.mat({ color: '#6a5a3a', metalness: 0.7, roughness: 0.45 });
        for (const s of [-1, 1]) {
          P.add(bronze, lathe([[0, 0], [1.4, 0.2], [1.8, 1.2], [1.6, 2.4], [1.8, 2.6]], 16), { x: s * 22, y: B + 7.2, z: Z + 18 });
          const side = k.mat({ map: facadeTex(k, { base: '#8a1e16', rows: 1, cols: 8, kind: 'rect', win: '#c89848', w: 512, h: 128, top: 0.2 }), roughness: 0.85 });
          prism([[s * 62 - 6, -50], [s * 62 + 6, -50], [s * 62 + 6, -140], [s * 62 - 6, -140]], B, B + 7).forEach((g) => P.add(side, g));
          P.add(tile, hipRoof(8, 47, 41, 3.4, 0.8), { x: s * 62, y: B + 7, z: -95 });
        }
      },
    },
    // Venice: a palazzo window over the Grand Canal at night, palaces down both banks, the
    // Rialto Bridge, and St Mark's domes and bell tower at the end of the water.
    canal: {
      drop: 7, fog: { color: '#2a2a48', density: 0.005 },
      sky: { stops: ['#0a1030', '#1e2250', '#5a3a6a', '#a86a7a'], haze: '#8a5a70', below: '#2a2a48', stars: 220, moon: { az: 20, el: 26, size: 6, crescent: true, color: '#fff2d8', glow: '#ffd8c0' } },
      build(k, P, G) {
        const B = G.y, WL = B - 0.6;
        G.water = WL;
        // palaces down both banks, pink, ochre and white, with Gothic windows lit for the night
        const tints = ['#d89a8a', '#e0b878', '#efe2cc', '#c86a52', '#e8c8b0', '#d8a868'];
        const roofM = k.mat({ color: '#6a3a2a', roughness: 0.9 });
        const R = rng(13);
        for (const s of [-1, 1]) {
          let z = -30;
          while (z > -150) {
            const w = 10 + R() * 8, h = 12 + R() * 12, d = 14, base = tints[Math.floor(R() * tints.length)];
            const faceM = k.mat({ map: facadeTex(k, { base, rows: Math.round(h / 4.5), cols: Math.round(w / 3), kind: R() < 0.6 ? 'pointed' : 'arch', lit: 0.45, frame: '#f4ecdc', balcony: 0.4, seed: Math.floor(R() * 99), win: '#1a1a2a', light: '#ffcf80' }), roughness: 0.9, emissive: '#100810', emissiveIntensity: 0.4 });
            block(P, faceM, roofM, s * (19 + d / 2), WL, z - w / 2, w, h, d, s * Math.PI / 2);
            z -= w + 0.3;
          }
        }
        // quays, mooring posts and gondolas
        const pole = k.mat({ map: k.tile(16, 64, (g, w, h) => { for (let y = 0; y < h; y += 16) { g.fillStyle = '#e8e0d0'; g.fillRect(0, y, w, 8); g.fillStyle = '#2a4a8a'; g.fillRect(0, y + 8, w, 8); } }), roughness: 0.6 });
        for (let i = 0; i < 18; i++) { const s = i % 2 ? 1 : -1, z = -26 - i * 7 - R() * 3; P.add(pole, new THREE.CylinderGeometry(0.2, 0.2, 5, 8), { x: s * 17.6, y: WL + 1.8, z }); }
        const gondola = K.extrude([[-4, 0.6], [-3, 0], [3, 0], [4, 0.9], [4.2, 1.6], [3.4, 0.5], [-3.4, 0.5], [-3.8, 1.2]], 1.0, 0.1);
        const black = k.mat({ color: '#0e0e14', roughness: 0.3 });
        for (const [x, z, r] of [[-11, -34, 0.1], [10.8, -48, -0.05], [-11.5, -62, 0], [-4, -44, 0.4]]) P.add(black, gondola.clone(), { x, y: WL - 0.1, z, ry: Math.PI / 2 + r });
        // the Rialto: one white arch with its covered shops
        const istria = k.mat({ map: k.tile(128, 128, (g, w, h) => courses(g, w, h, '#ece4d4', 'rgba(110,100,90,0.5)', 4, 2, 6)), roughness: 0.8, emissive: '#1a1420', emissiveIntensity: 0.4 });
        const span = 38, rise = 8, bz = -86;
        const arch = []; for (let i = 0; i <= 24; i++) { const t = i / 24, x = -span / 2 + span * t; arch.push([x, rise * (1 - Math.pow(2 * t - 1, 2))]); }
        const outline = [[-span / 2 - 4, rise + 2.2]].concat([[-span / 2 - 4, 0]], arch, [[span / 2 + 4, 0], [span / 2 + 4, rise + 2.2], [0, rise + 3.6]]);
        P.add(istria, K.extrude(outline, 9, 0.1), { y: WL, z: bz });
        const shops = k.mat({ map: facadeTex(k, { base: '#ece4d4', rows: 1, cols: 6, kind: 'arch', lit: 0.8, w: 512, h: 128, top: 0.1, light: '#ffc870' }), roughness: 0.8, emissive: '#1a1420', emissiveIntensity: 0.4 });
        for (const s of [-1, 1]) block(P, shops, roofM, s * 9, WL + rise + 0.6, bz, 11, 3.6, 8.6, 0);
        P.add(istria, box(6, 6, 9, 0, WL + rise + 1.8, bz));
        P.add(roofM, new THREE.ConeGeometry(5.2, 2.4, 4).rotateY(Math.PI / 4), { y: WL + rise + 9, z: bz, s: [1, 1, 1.5] });
        // St Mark's: the campanile and the basilica's five domes, lit gold at the canal's end
        const brick = k.mat({ map: k.tile(64, 256, (g, w, h) => { courses(g, w, h, '#a85a44', 'rgba(60,24,16,0.4)', 40, 3, 8); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(14, 0, 4, h); g.fillRect(46, 0, 4, h); }), roughness: 0.9, emissive: '#2a1008', emissiveIntensity: 0.35 });
        const cx = 16, cz = -168;
        P.add(brick, box(6, 40, 6, cx, WL, cz));
        P.add(istria, box(6.6, 5, 6.6, cx, WL + 40, cz));
        P.add(k.glowMat('#ffd080', 0.9), box(5.4, 3.2, 6.8, cx, WL + 40.9, cz)); P.add(k.glowMat('#ffd080', 0.9), box(6.8, 3.2, 5.4, cx, WL + 40.9, cz));
        P.add(brick, box(5.4, 4, 5.4, cx, WL + 45, cz));
        P.add(k.mat({ color: '#3a7a5a', roughness: 0.5, emissive: '#0a2016', emissiveIntensity: 0.5 }), new THREE.ConeGeometry(4, 10, 4).rotateY(Math.PI / 4), { x: cx, y: WL + 54, z: cz });
        P.add(k.mat({ color: '#f0c860', metalness: 0.9, roughness: 0.2 }), new THREE.SphereGeometry(0.6, 10, 8), { x: cx, y: WL + 59.6, z: cz });
        const mosaic = k.mat({ map: k.tex(512, 256, (g, w, h) => {
          g.fillStyle = '#e8dccb'; g.fillRect(0, 0, w, h);
          for (let i = 0; i < 5; i++) { const x = 20 + i * 96, aw = 80; archPath(g, x, h, aw, h * 0.9, false); g.fillStyle = i === 2 ? '#e0b050' : '#c89840'; g.fill(); archPath(g, x + 14, h, aw - 28, h * 0.6, false); g.fillStyle = '#2a1e18'; g.fill(); g.fillStyle = '#ffd890'; g.fillRect(x + 30, h - 40, aw - 60, 40); }
        }), roughness: 0.6, emissive: '#3a2410', emissiveIntensity: 0.5 });
        const bx = -18, bzz = -172;
        prism([[bx - 22, bzz + 10], [bx + 22, bzz + 10], [bx + 22, bzz - 20], [bx - 22, bzz - 20]], WL, WL + 14).forEach((g, i) => P.add(i ? istria : mosaic, g));
        const domeM = k.mat({ color: '#6a7a8a', roughness: 0.6, metalness: 0.4, emissive: '#101820', emissiveIntensity: 0.5 });
        for (const [dx, dz, r] of [[0, -5, 7], [-14, -5, 5], [14, -5, 5], [0, 5, 5.5], [0, -15, 5.5]]) {
          P.add(istria, new THREE.CylinderGeometry(r, r, 2.4, 20), { x: bx + dx, y: WL + 15.2, z: bzz + dz });
          P.add(domeM, lathe([[r, 0], [r * 1.02, r * 0.5], [r * 0.7, r * 1.0], [0.2, r * 1.3], [0, r * 1.35]], 20, 12), { x: bx + dx, y: WL + 16.4, z: bzz + dz });
          P.add(k.mat({ color: '#f0c860', metalness: 0.9, roughness: 0.2 }), new THREE.ConeGeometry(0.3, 2.4, 6), { x: bx + dx, y: WL + 16.4 + r * 1.35 + 1.1, z: bzz + dz });
        }
        // lanterns along the quays
        for (let i = 0; i < 10; i++) { const s = i % 2 ? 1 : -1; G.glows.push([s * 18.4, WL + 4, -34 - i * 12, '#ffc070', 3]); }
        G.reflect = { y: WL, tint: 0.5 };
      },
    },
    // St Petersburg: the Winter Palace windows look across a frozen canal to the Church of
    // the Savior on Spilled Blood, onion domes striped in enamel and gold, in the snow.
    church: {
      drop: 8, fog: { color: '#3a4a6a', density: 0.005 },
      sky: { stops: ['#040814', '#0e1a34', '#2a3a5a', '#5a6a8a'], haze: '#5a6a8a', below: '#3a4a6a', stars: 260, moon: { az: -30, el: 30, size: 6.5, color: '#fff2d8', glow: '#c8d8ff' },
        far(g, W, HY) { const R = rng(29); g.fillStyle = '#2a3450'; for (let x = 0; x < W;) { const w = 20 + R() * 40, h = 5 + R() * 7; g.fillRect(x, HY - h, w, h + 2); if (R() < 0.15) { g.beginPath(); g.arc(x + w / 2, HY - h, 5, Math.PI, 0); g.fill(); g.fillRect(x + w / 2 - 0.5, HY - h - 14, 1.5, 10); } x += w + 1; } } },
      build(k, P, G) {
        const B = G.y;
        const snow = k.mat({ map: k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#b8c4d8', '#8a98b0', '#dce4f0', 2000, 3)), roughness: 0.9 });
        P.add(snow, ground(k, null, 165, B, 10, [[-6, -20, 6, -200]]));
        P.add(k.mat({ color: '#b8c8e0', roughness: 0.15, emissive: '#1a2440', emissiveIntensity: 0.5 }), new THREE.PlaneGeometry(12, 180).rotateX(-Math.PI / 2).translate(0, B - 1.2, -110));
        // the canal's granite walls and iron railings
        const granite = k.mat({ color: '#5a5258', roughness: 0.8 });
        const rail = k.own(new THREE.MeshStandardMaterial({ map: latticeTex(k, '#1a1a20'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.5 }));
        for (const s of [-1, 1]) {
          P.add(granite, box(0.6, 1.2, 180, s * 6, B - 1.2, -110));
          const g = new THREE.PlaneGeometry(180, 1.2); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 120);
          P.add(rail, g, { x: s * 6.1, y: B + 0.6, z: -110, ry: Math.PI / 2 });
        }
        // classical fronts along the left bank
        const roofM = k.mat({ color: '#d8e0ee', roughness: 0.9 });
        const R = rng(31);
        let z = -64;
        for (const base of ['#e8c868', '#8ab0a0', '#e8d0b0', '#c87a6a', '#e8c868', '#a8b8c8']) {
          const w = 16 + R() * 6, faceM = k.mat({ map: facadeTex(k, { base, rows: 4, cols: Math.round(w / 3), kind: 'rect', lit: 0.4, frame: '#f4f0e8', trim: '#f4f0e8', seed: Math.floor(R() * 99), light: '#ffd890' }), roughness: 0.9, emissive: '#101420', emissiveIntensity: 0.4 });
          block(P, faceM, roofM, -24, B, z - w / 2, w, 14, 16, Math.PI / 2);
          z -= w + 0.4;
        }
        // the church
        const brickT = k.tile(128, 256, (g, w, h) => { courses(g, w, h, '#a8483a', 'rgba(60,20,16,0.4)', 30, 4, 4); g.fillStyle = '#f0e8dc'; g.fillRect(0, 0, w, 10); g.fillRect(0, h * 0.5, w, 8); archPath(g, w * 0.3, h * 0.45, w * 0.4, h * 0.3, false); g.fillStyle = '#ffd890'; g.fill(); g.strokeStyle = '#f0e8dc'; g.lineWidth = 6; g.stroke(); archPath(g, w * 0.3, h * 0.95, w * 0.4, h * 0.3, false); g.fillStyle = '#2a2030'; g.fill(); g.stroke(); });
        const brick = k.mat({ map: brickT, roughness: 0.85, emissive: '#2a0e0a', emissiveIntensity: 0.35 });
        const cx = 0, cz = -118;
        const body = [[-11, 11], [11, 11], [11, -11], [-11, -11]].map(([x, zz]) => [x + cx, zz + cz]);
        prism(body, B, B + 16, 6).forEach((g) => P.add(brick, g));
        P.add(roofM, lid(body, B + 16));
        // kokoshnik gables along the roofline
        const gable = k.mat({ color: '#e8e0d4', roughness: 0.6, side: THREE.DoubleSide, emissive: '#1a1a24', emissiveIntensity: 0.4 });
        for (let i = 0; i < 4; i++) for (const [ry, fx, fz] of [[0, 1, 0], [Math.PI, 1, 0], [Math.PI / 2, 0, 1], [-Math.PI / 2, 0, 1]]) {
          const off = -8.25 + i * 5.5;
          const sx = Math.sin(ry) * 11.05, sz = Math.cos(ry) * 11.05;
          P.add(gable, new THREE.CircleGeometry(2.5, 16, 0, Math.PI), { x: cx + sx + fx * off, y: B + 16, z: cz + sz + fz * off, ry });
        }
        // the tall tent over the crossing, and the onion domes round it
        const oct = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU + TAU / 16; return [cx + Math.cos(a) * 5, cz + Math.sin(a) * 5]; });
        prism(oct, B + 16, B + 26, 6).forEach((g) => P.add(brick, g));
        const tent = k.mat({ map: k.tile(128, 128, (g, w, h) => { g.fillStyle = '#e8e0d0'; g.fillRect(0, 0, w, h); g.fillStyle = '#3a8a6a'; for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 16; x < w; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 16, y + 16); g.lineTo(x, y + 32); g.lineTo(x - 16, y + 16); g.fill(); } g.fillStyle = '#e8c060'; g.fillRect(0, 0, 4, h); }, [8, 6]), roughness: 0.5, emissive: '#102018', emissiveIntensity: 0.4 });
        P.add(tent, new THREE.ConeGeometry(5.6, 18, 8, 1, true).rotateY(TAU / 16), { x: cx, y: B + 35, z: cz });
        const goldM = k.mat({ color: '#f0c050', metalness: 0.9, roughness: 0.25, emissive: '#3a2a08', emissiveIntensity: 0.4 });
        P.add(goldM, lathe(onion(1.3, 2.6), 16, 18), { x: cx, y: B + 44, z: cz });
        P.add(goldM, box(0.16, 2.6, 0.16, cx, B + 46.6, cz)); P.add(goldM, box(1.2, 0.16, 0.16, cx, B + 47.8, cz));
        const stripes = (a, b, c) => k.mat({ map: k.tile(128, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.save(); g.translate(w / 2, h / 2); g.rotate(-0.6); g.fillStyle = b; for (let x = -w; x < w; x += 32) g.fillRect(x, -h, 14, 2 * h); g.restore(); if (c) { g.fillStyle = c; g.fillRect(0, 0, w, 6); } }, [4, 1]), roughness: 0.4, emissive: '#101018', emissiveIntensity: 0.5 });
        const domes = [[[-8, 8], stripes('#2a5ab8', '#f0f0f8')], [[8, 8], stripes('#e8c040', '#2a8a4a')], [[-8, -8], stripes('#2a8a4a', '#f0e8d0')], [[8, -8], stripes('#c83a3a', '#f0e8d0')]];
        domes.forEach(([[dx, dz], m]) => {
          const d = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU; return [cx + dx + Math.cos(a) * 2.2, cz + dz + Math.sin(a) * 2.2]; });
          prism(d, B + 16, B + 20).forEach((g) => P.add(brick, g));
          P.add(m, lathe(onion(3.2, 6), 20, 20), { x: cx + dx, y: B + 20, z: cz + dz });
          P.add(goldM, box(0.12, 2, 0.12, cx + dx, B + 26, cz + dz)); P.add(goldM, box(0.9, 0.12, 0.12, cx + dx, B + 27.2, cz + dz));
        });
        // the bell tower over the place where the Tsar fell, with its golden onion
        const tx = cx, tz = cz + 14;
        prism([[-3.5, 3.5], [3.5, 3.5], [3.5, -3.5], [-3.5, -3.5]].map(([x, zz]) => [x + tx, zz + tz]), B, B + 26, 6).forEach((g) => P.add(brick, g));
        P.add(gable, new THREE.ConeGeometry(4.6, 3, 4).rotateY(Math.PI / 4), { x: tx, y: B + 27.5, z: tz });
        P.add(goldM, lathe(onion(2.4, 4.6), 20, 20), { x: tx, y: B + 29, z: tz });
        P.add(goldM, box(0.14, 2.4, 0.14, tx, B + 33.6, tz)); P.add(goldM, box(1, 0.14, 0.14, tx, B + 34.8, tz));
        // snow on everything, and street lamps along the embankment
        const post = k.mat({ color: '#1a1a20', roughness: 0.5, metalness: 0.6 });
        for (let i = 0; i < 7; i++) for (const s of [-1, 1]) lamp(k, P, post, s * 7.4, B, -26 - i * 16, 4, '#ffd080', G, 4);
      },
    },
    // New York, 1930: a round penthouse terrace high above Times Square, every front around
    // it ablaze with neon and the Times Tower and its news ticker straight ahead.
    times: {
      outdoor: true, fog: { color: '#1a1430', density: 0.005 },
      sky: { stops: ['#04040c', '#0e0c24', '#2a1a40', '#4a2a50'], haze: '#4a2a50', below: '#1a1430', stars: 140,
        far(g, W, HY) {
          const R = rng(17);
          for (let x = 0; x < W;) { const w = 10 + R() * 30, h = 16 + R() * 60; g.fillStyle = '#0c0a18'; g.fillRect(x, HY - h, w, h + 2); g.fillStyle = 'rgba(255,214,140,0.55)'; for (let y = HY - h + 4; y < HY; y += 5) for (let xx = x + 2; xx < x + w - 2; xx += 4) if (R() < 0.3) g.fillRect(xx, y, 2, 2); x += w + 1; }
          // a slender steel-crowned tower far uptown
          const cx = W * 0.62; g.fillStyle = '#0c0a18'; g.fillRect(cx - 8, HY - 120, 16, 120); g.fillStyle = '#c8d0dc'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(cx, HY - 120 - i * 7, 8 - i * 1.4, Math.PI, 0); g.fill(); } g.fillRect(cx - 1, HY - 175, 2, 22);
        } },
      build(k, P, G) {
        const B = G.y, S = B - 34;   // the street, far below
        P.add(k.mat({ color: '#1a1820', roughness: 0.7 }), ground(k, null, 165, S, 10));
        // the street: lines, taxis and a streetcar, their lamps glowing
        P.add(k.glowMat('#f0e8c0', 0.5), new THREE.PlaneGeometry(0.4, 300).rotateX(-Math.PI / 2).translate(0, S + 0.05, -60));
        const taxi = k.mat({ color: '#f0b820', roughness: 0.4 }), car = k.mat({ color: '#2a2a34', roughness: 0.4 }), tram = k.mat({ color: '#8a1a1a', roughness: 0.5 });
        const R = rng(41);
        for (let i = 0; i < 26; i++) { const x = (R() < 0.5 ? -1 : 1) * (2 + R() * 6), z = 30 - R() * 190; P.add(R() < 0.6 ? taxi : car, box(1.8, 1.5, 4, x, S, z)); G.glows.push([x, S + 0.8, z + (x > 0 ? 2.1 : -2.1), x > 0 ? '#ff5040' : '#fff0c0', 1.6]); }
        P.add(tram, box(2.6, 3.2, 12, -1.5, S, -40)); P.add(k.glowMat('#ffd890', 0.8), box(2.7, 1, 11, -1.5, S + 1.6, -40));
        // the buildings: window grids, then signs on every front
        const fronts = ['#3a302e', '#463c34', '#302a36', '#4a4038', '#2a2630'];
        const roofM = k.mat({ color: '#1a1820', roughness: 0.9 });
        const SIGNS = [
          { text: 'CHACKMATE', sub: 'CHESS FOR EVERY AGE', color: '#ffd060', edge: '#ff5a8a', icon: SIGN.knight },
          { text: 'COCOA', sub: "PRALINE'S HOT CHOCOLATE", color: '#ff8a50', edge: '#ffe0a0', icon: SIGN.cup },
          { text: 'THEATRE', sub: 'TONIGHT: THE ROYAL GAME', color: '#ff4a6a', edge: '#ffd060', icon: SIGN.star },
          { text: 'CHESS CLUB', sub: 'ALL WELCOME', color: '#60e0ff', edge: '#ffffff', icon: SIGN.king, size: 60 },
          { text: 'TOYS', sub: "TRUFFLE'S TOY SHOP", color: '#a0ff80', edge: '#ff80c0', icon: SIGN.star },
          { text: 'MOVIES', sub: 'TALKIES IN COLOUR', color: '#ffe060', edge: '#60c0ff', icon: SIGN.star },
          { text: 'BAKERY', sub: 'PRETZELS & PIES', color: '#ffb060', edge: '#ff6060', icon: SIGN.cup },
          { text: 'GRAND HOTEL', color: '#ffffff', edge: '#ffb040', icon: SIGN.king, size: 56 },
        ].map((o) => k.own(new THREE.MeshBasicMaterial({ map: neonTex(k, o), toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.3) })));
        let si = 0;
        const BLADES = [['HOTEL', '#ffd060'], ['CHESS', '#60e0ff'], ['THEATRE', '#ff5a8a'], ['COCOA', '#ffa050'], ['MOVIES', '#a0ff80']].map(([word, c]) => k.own(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.3), map: k.tex(64, 384, (g, w, h) => {
          g.fillStyle = '#0c0a14'; g.fillRect(0, 0, w, h); g.save(); g.shadowColor = c; g.shadowBlur = 12; g.strokeStyle = c; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12);
          g.fillStyle = c; g.font = '900 44px "Jost", "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          [...word].forEach((ch, i) => g.fillText(ch, w / 2, 40 + i * (h - 70) / Math.max(1, word.length - 1)));
          g.restore();
        }) })));
        for (const s of [-1, 1]) {
          let z = 40;
          while (z > -200) {
            const w = 14 + R() * 12, h = 34 + R() * 50, d = 18;
            const faceM = k.mat({ map: facadeTex(k, { base: fronts[Math.floor(R() * fronts.length)], rows: Math.round(h / 1.8), cols: Math.round(w / 1.6), kind: 'rect', lit: 0.4, seed: Math.floor(R() * 999), light: '#ffd890', win: '#14121c', w: 256, h: 1024 }), roughness: 0.9, emissive: '#ffffff', emissiveMap: null });
            faceM.emissiveMap = faceM.map; faceM.emissiveIntensity = 0.5; faceM.color.set('#3a3440');
            const x = s * (13 + d / 2 + (Math.abs(z) < 20 ? 6 : 0));
            block(P, faceM, roofM, x, S, z - w / 2, w, h, d, s * Math.PI / 2);
            // one or two big signs per front, facing the square
            const sw = Math.min(w - 1, 15), sh = sw / 2, fx = x - s * (d / 2 + 0.15);
            for (const sy of [S + 5 + R() * 4, S + 15 + R() * 6, S + 27 + R() * 8]) {
              if (R() < 0.2) continue;
              P.add(SIGNS[si++ % SIGNS.length], new THREE.PlaneGeometry(sw, sh), { x: fx, y: sy, z: z - w / 2, ry: -s * Math.PI / 2 });
            }
            // a tall blade sign standing out from the corner
            if (R() < 0.6) P.add(BLADES[si % BLADES.length], new THREE.PlaneGeometry(2.6, 14), { x: fx - s * 1.4, y: S + 12 + R() * 14, z: z - 0.8, ry: 0 });
            if (R() < 0.5) {   // a water tower on the roof
              P.add(k.mat({ color: '#5a3a24', roughness: 0.9 }), new THREE.CylinderGeometry(1.6, 1.6, 3, 10), { x: x + s * 3, y: S + h + 3.4, z: z - w / 2 });
              P.add(roofM, new THREE.ConeGeometry(1.8, 1.4, 10), { x: x + s * 3, y: S + h + 5.6, z: z - w / 2 });
            }
            z -= w + 0.5;
          }
        }
        // the Times Tower at the top of the square, its news ticker running round the waist
        const tower = k.mat({ map: facadeTex(k, { base: '#c8b8a0', rows: 20, cols: 6, kind: 'arch', lit: 0.5, frame: '#efe4d0', light: '#ffe0a0', w: 256, h: 1024 }), roughness: 0.8, emissive: '#2a2018', emissiveIntensity: 0.4 });
        const TZ = -118;
        prism([[-8, 6], [8, 6], [4, -10], [-4, -10]].map(([x, z]) => [x, z + TZ]), S, S + 76).forEach((g) => P.add(tower, g));
        P.add(roofM, lid([[-8, 6], [8, 6], [4, -10], [-4, -10]].map(([x, z]) => [x, z + TZ]), S + 76));
        P.add(tower, lathe([[3, 0], [3, 4], [2, 6], [0.4, 9], [0.1, 14], [0, 14]], 8), { y: S + 76, z: TZ - 1 });
        G.glows.push([0, S + 90, TZ - 1, '#ff6050', 5]);
        const ticker = k.own(new THREE.MeshBasicMaterial({ map: k.tex(1024, 64, (g, w, h) => { g.fillStyle = '#100808'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe060'; g.shadowColor = '#ffb020'; g.shadowBlur = 8; g.font = '700 40px "Jost", sans-serif'; g.textBaseline = 'middle'; g.fillText('★ CHACKMATE: THE JOURNEY REACHES NEW YORK ★ CHESS CLUB OPENS ON BROADWAY ★', 10, h / 2 + 2); }), toneMapped: false, color: new THREE.Color('#ffffff').multiplyScalar(1.4) }));
        P.add(ticker, new THREE.PlaneGeometry(16.4, 1.4), { y: S + 24, z: TZ + 6.1 });
        P.add(SIGNS[0], new THREE.PlaneGeometry(14, 7), { y: S + 30, z: TZ + 6.15 });
        P.add(SIGNS[2], new THREE.PlaneGeometry(14, 7), { y: S + 12, z: TZ + 6.15 });
        // the round tower the terrace crowns, lit window by window down to the street
        const drum = k.mat({ map: facadeTex(k, { base: '#d8d0c0', rows: 12, cols: 24, kind: 'rect', lit: 0.6, light: '#ffe0a0', win: '#1a1820', w: 512, h: 512, trim: '#b8b0a0' }), roughness: 0.8, emissive: '#2a2418', emissiveIntensity: 0.4 });
        P.add(drum, new THREE.CylinderGeometry(12.9, 13.6, B - S, 64, 1, true), { y: (B + S) / 2 });
        // the rooftop's deco parapet ring and its chrome cap
        const parapet = k.mat({ map: k.tile(128, 64, (g, w, h) => { g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, w, h); g.fillStyle = '#1a1a20'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 16, h * 0.3); g.lineTo(x + 32, h); g.fill(); } }, [40, 1]), roughness: 0.6, side: THREE.DoubleSide });
        P.add(parapet, new THREE.CylinderGeometry(13.4, 13.4, 1.6, 96, 1, true), { y: B + 0.8 + 0.6 });
        P.add(k.mat({ color: '#e8ecf2', metalness: 1, roughness: 0.15 }), K.ring(13.4, B + 2.2 + 0.6, 0.12, { seg: 160 }));
        // searchlights sweep up from the roofs
        for (const [x, z] of [[-40, -60], [44, -90], [-30, -150]]) G.glows.push([x, S + 70, z, '#d8e4ff', 7]);
      },
    },
    // Paris, 1889: a garden on the Champ de Mars at dusk, the new Eiffel Tower in its first
    // coat of red-brown paint, its gas lamps just lit.
    eiffel: {
      outdoor: true, fog: { color: '#8a7a9a', density: 0.0042 },
      sky: { stops: ['#14204a', '#34407a', '#9a7aa0', '#f0b898'], haze: '#d8a8a8', below: '#8a7a9a', clouds: 10, cloud: '#f8c8b8', sun: { az: -70, el: 1, size: 12, color: '#ffa070', glow: '#ff9a70' },
        far(g, W, HY) {
          const R = rng(23);
          for (let x = 0; x < W;) { const w = 18 + R() * 30, h = 8 + R() * 8; g.fillStyle = '#4a4260'; g.fillRect(x, HY - h, w, h + 2); g.fillStyle = '#3a3450'; g.beginPath(); g.moveTo(x, HY - h); g.lineTo(x + 4, HY - h - 5); g.lineTo(x + w - 4, HY - h - 5); g.lineTo(x + w, HY - h); g.fill(); x += w; }
          const ix = W * 0.12; g.fillStyle = '#4a4260'; g.beginPath(); g.arc(ix, HY - 22, 14, Math.PI, 0); g.fill(); g.fillStyle = '#c8a050'; g.fillRect(ix - 1, HY - 46, 3, 12);
        } },
      build(k, P, G) {
        const B = G.y;
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#3a5a34', '#1e3a1e', '#5a7a44', 5000, 4)), roughness: 1 }), ground(k, null, 165, B, 10));
        // the gravel avenue to the tower, flower beds and clipped hedges
        const gravel = k.mat({ map: k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#b8a888', '#8a7a60', '#d0c4a8', 3000, 2)), roughness: 1 });
        const strip = (w, d, x, z) => { const gg = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 6, uv.getY(i) * d / 6); P.add(gravel, gg.translate(x, B + 0.02, z)); };
        strip(14, 120, 0, -70); strip(160, 6, 0, -40); for (const s of [-1, 1]) strip(5, 90, s * 26, -60);
        const hedge = k.mat({ color: '#1e3a1e', roughness: 1 });
        const bloom = [k.mat({ color: '#9a2030', roughness: 1 }), k.mat({ color: '#c8a8b8', roughness: 1 }), k.mat({ color: '#c89830', roughness: 1 })];
        for (const s of [-1, 1]) for (let i = 0; i < 6; i++) {
          const z = -18 - i * 12;
          P.add(hedge, box(0.9, 0.9, 9, s * 8.2, B, z - 4));
          P.add(bloom[i % 3], lathe([[1.4, 0], [1.4, 0.18], [1.1, 0.4], [0, 0.46]], 12), { x: s * 11.5, y: B, z: z - 4, s: [1, 1, 2.6] });
        }
        // the tower: four lattice legs curving in to meet at the second platform, the shaft
        // above, the arches between the legs and the platforms with their galleries
        const TZ = 0, iron = '#7a3428', PT = Parts(), glowsT = [];
        { const P = PT, B = 0, G = { glows: glowsT };
        const lat = k.own(new THREE.MeshStandardMaterial({ map: latticeTex(k, iron), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, metalness: 0.3, emissive: '#2a0a04', emissiveIntensity: 0.3 }));
        const solid = k.mat({ color: '#6a2a20', roughness: 0.7, metalness: 0.3 });
        const N = 14;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const path = [], half = [];
          for (let i = 0; i <= N; i++) {
            const t = i / N, y = t * 40, c = 19 - 12.4 * Math.pow(t, 0.72);
            path.push([sx * c, B + y, TZ + sz * c]); half.push(mix(2.8, 1.1, t));
          }
          P.add(lat, loft(path, half, 4.5));
          P.add(solid, box(6.4, 1.2, 6.4, sx * 19, B, TZ + sz * 19));
        }
        const shaft = [], sh = [];
        for (let i = 0; i <= 14; i++) { const t = i / 14, y = 40 + t * 46; shaft.push([0, B + y, TZ]); sh.push(mix(6.6, 1.0, Math.pow(t, 0.8))); }
        P.add(lat, loft(shaft, sh, 4.5));
        // the arches between the legs under the first platform
        for (const [ry] of [[0], [Math.PI / 2], [Math.PI], [-Math.PI / 2]]) {
          const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16, x = mix(-14.6, 14.6, t); pts.push([x, B + 6 + 9.6 * Math.sin(Math.PI * t) - 0.002, 0]); }
          const g = K.tube(pts, 0.42, { segs: 32, radial: 4 }); g.rotateY(ry); g.translate(0, 0, 0);
          const off = new THREE.Vector3(0, 0, 14.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
          P.add(solid, g, { x: off.x, z: TZ + off.z });
        }
        // platforms: the first with its gallery of arches, the second, and the lantern on top
        const gallery = k.mat({ map: k.tile(128, 64, (g, w, h) => { g.fillStyle = '#6a2a20'; g.fillRect(0, 0, w, h); for (let x = 4; x < w; x += 32) { archPath(g, x, h - 6, 24, h - 18, false); g.fillStyle = '#ffd890'; g.fill(); } g.fillStyle = '#c89a50'; g.fillRect(0, 0, w, 5); }, [12, 1]), roughness: 0.7, emissive: '#ffffff', emissiveIntensity: 0.0 });
        gallery.emissiveMap = gallery.map; gallery.emissive.set('#ffd890'); gallery.emissiveIntensity = 0.35;
        const plat = (half, y, h) => {
          const pts = [[-half, half], [half, half], [half, -half], [-half, -half]].map(([x, z]) => [x, z + TZ]);
          prism(pts, B + y, B + y + h).forEach((g) => P.add(gallery, g));
          P.add(solid, box(2 * half - 0.1, 0.5, 2 * half - 0.1, 0, B + y, TZ)); P.add(solid, box(2 * half + 0.6, 0.4, 2 * half + 0.6, 0, B + y + h, TZ));
        };
        plat(14.5, 15.6, 2.6); plat(8.2, 39, 1.8); plat(2.4, 84, 2.2);
        P.add(solid, lathe([[1.6, 0], [1.6, 2.4], [0.7, 3.4], [0.2, 6], [0, 6.2]], 8), { y: B + 86.2, z: TZ });
        // the tricolour on the flagpole, and the beacon
        const flag = k.mat({ map: k.tex(96, 64, (g) => { g.fillStyle = '#20368a'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#f4f0e8'; g.fillRect(32, 0, 32, 64); g.fillStyle = '#d02838'; g.fillRect(64, 0, 32, 64); }), side: THREE.DoubleSide, roughness: 0.9 });
        P.add(flag, new THREE.PlaneGeometry(3, 2), { x: 1.5, y: B + 91.4, z: TZ });
        G.glows.push([0, B + 89, TZ, '#ffe0a0', 9]);
        // gas lamps round the platforms and down the avenue
        for (const [half, y] of [[14.5, 18.6], [8.2, 41.2]]) for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
          const a = [[s * half, half], [half, s * half], [s * half, -half], [-half, s * half]][i];
          G.glows.push([a[0], B + y, TZ + a[1], '#ffc070', 3]);
        }
        }
        // the tower is drawn at 0.72 of its modelled size, far enough back to show it whole
        const TS = 0.72, at = { x: 0, y: B, z: -118 };
        PT.each((m, g) => P.add(m, g.scale(TS, TS, TS).translate(at.x, at.y, at.z)));
        glowsT.forEach(([x, y, z, c, s]) => G.glows.push([x * TS + at.x, y * TS + at.y, z * TS + at.z, c, s * TS]));
        const post = k.mat({ color: '#1e2a24', roughness: 0.5, metalness: 0.6 });
        for (let i = 0; i < 6; i++) for (const s of [-1, 1]) lamp(k, P, post, s * 7.6, B, -16 - i * 13, 4.2, '#ffd080', G, 3.6);
        // chestnut trees down the long sides of the park
        const leaves = k.mat({ color: '#2a4a2a', roughness: 1, flatShading: true }), bark = k.mat({ color: '#3a2a20', roughness: 1 });
        for (const s of [-1, 1]) for (let i = 0; i < 12; i++) {
          const x = s * (34 + (i % 2) * 6), z = 10 - i * 12;
          P.add(bark, new THREE.CylinderGeometry(0.35, 0.5, 4, 6), { x, y: B + 2, z });
          P.add(leaves, new THREE.IcosahedronGeometry(3.6, 1), { x, y: B + 6.4, z, s: [1, 1.15, 1] });
        }
      },
    },
    taj: {
      outdoor: true, fog: { color: '#1c2a4a', density: 0.006 },
      sky: { stops: ['#02050f', '#081430', '#14264c', '#24385e'], haze: '#24385e', below: '#1c2a4a', stars: 420, moon: { az: 28, el: 34, size: 7, color: '#fff2d8', glow: '#c8d8ff' },
        far(g, W, HY, U) { g.fillStyle = '#0a1226'; for (let x = 0; x < W; x += 6) { const h = 6 + Math.abs(Math.sin(x * 0.013) * 10 + Math.sin(x * 0.051) * 5); g.fillRect(x, HY - h, 6, h + 2); } } },
      build(k, P, G, group) {
        const B = G.y;
        const lawn = k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#16281c', '#08140c', '#24402a', 5000, 2), [1, 1]);
        const lawnM = k.mat({ map: lawn, roughness: 1 });
        const pool = { x0: -4, x1: 4, z0: -15, z1: -88 };
        P.add(lawnM, ground(k, lawnM, 165, B - 0.05, 10, [[pool.x0, pool.z0, pool.x1, pool.z1]]));
        // red sandstone walks beside the pool and across the garden
        const sand = k.mat({ map: k.tile(256, 256, (g, w, h) => courses(g, w, h, '#7a4434', 'rgba(30,12,8,0.6)', 4, 2, 5), [1, 1]), roughness: 0.85 });
        const walk = (w, d, x, z) => { const gg = new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * d / 4); P.add(sand, gg.translate(x, B + 0.02, z)); };
        walk(4, -pool.z1 + pool.z0, -6, (pool.z0 + pool.z1) / 2); walk(4, -pool.z1 + pool.z0, 6, (pool.z0 + pool.z1) / 2);
        walk(120, 5, 0, -51); walk(5, 60, -30, -51); walk(5, 60, 30, -51);
        // the pool's marble rim and the raised lotus tank half way along
        const rimM = k.mat({ color: '#d8dde8', roughness: 0.6, emissive: '#1a2238', emissiveIntensity: 0.4 });
        P.add(rimM, box(0.8, 0.5, -pool.z1 + pool.z0 + 0.8, pool.x0 - 0.4, B - 0.2, (pool.z0 + pool.z1) / 2));
        P.add(rimM, box(0.8, 0.5, -pool.z1 + pool.z0 + 0.8, pool.x1 + 0.4, B - 0.2, (pool.z0 + pool.z1) / 2));
        P.add(rimM, box(9.6, 0.5, 0.8, 0, B - 0.2, pool.z0 + 0.4));
        P.add(rimM, box(9.6, 0.5, 0.8, 0, B - 0.2, pool.z1 - 0.4));
        P.add(rimM, box(12, 0.9, 1, 0, B - 0.2, -45.5)); P.add(rimM, box(12, 0.9, 1, 0, B - 0.2, -56.5));
        for (const sx of [-1, 1]) P.add(rimM, box(1, 0.9, 12, sx * 6, B - 0.2, -51));
        // fountain jets down the middle of the pool
        const jetM = k.mat({ color: '#c8d8f0', emissive: '#6a7aa0', emissiveIntensity: 0.6, roughness: 0.3 });
        for (let z = pool.z0 - 4; z > pool.z1 + 2; z -= 4.5) P.add(jetM, new THREE.ConeGeometry(0.12, 1.2, 5).translate(0, B + 0.4, z));
        // cypress rows along the walks
        const cyM = k.mat({ color: '#0e2416', roughness: 1 });
        for (let z = pool.z0 - 3; z > pool.z1; z -= 6) for (const sx of [-1, 1]) cypress(P, cyM, sx * 9.5, B, z, 7 + (Math.abs(z) % 3), 1.3);
        G.water = B - 0.25;
        BUILD.taj(k, P, { z: -128 }, group, G);
        // the Great Gate behind white's seat, across the garden
        const gate = k.mat({ map: k.tex(512, 384, (g, w, h) => {
          speckle(g, w, h, '#a8503a', '#5a2418', '#d88a6a', 3000, 7);
          g.strokeStyle = '#f2e8dc'; g.lineWidth = 8; g.strokeRect(w * 0.26, h * 0.12, w * 0.48, h * 0.88);
          archPath(g, w * 0.32, h, w * 0.36, h * 0.74, true); g.fillStyle = '#2a120c'; g.fill(); g.strokeStyle = '#f2e8dc'; g.lineWidth = 6; g.stroke();
          archPath(g, w * 0.44, h, w * 0.12, h * 0.3, true); g.fillStyle = '#ffcf80'; g.fill();
          for (const x of [w * 0.06, w * 0.8]) for (const y of [h * 0.5, h]) { archPath(g, x, y, w * 0.14, h * 0.36, true); g.fillStyle = '#3a1810'; g.fill(); g.strokeStyle = '#f2e8dc'; g.lineWidth = 4; g.stroke(); }
        }), roughness: 0.9, emissive: '#2a1010', emissiveIntensity: 0.3 });
        P.add(gate, wall(40, 26, 0, B, 92, Math.PI));
        const white = k.mat({ color: '#e8ecf4', roughness: 0.7, emissive: '#1a2238', emissiveIntensity: 0.4 });
        for (let i = 0; i < 11; i++) P.add(white, lathe([[0.9, 0], [1.05, 0.5], [0.8, 1.2], [0, 1.6]], 10, 8), { x: -15 + i * 3, y: B + 26, z: 92.5 });
        for (const sx of [-1, 1]) { P.add(gate, new THREE.CylinderGeometry(2.2, 2.4, 28, 8).translate(sx * 21, B + 14, 92)); P.add(white, lathe([[2.4, 0], [2.8, 1.4], [2.2, 3], [0, 4]], 12, 10), { x: sx * 21, y: B + 28, z: 92 }); }
        // lanterns along the walk to the table
        const post = k.mat({ color: '#2a2018', roughness: 0.5, metalness: 0.6 });
        for (const z of [-14, -32, -70]) for (const sx of [-1, 1]) lamp(k, P, post, sx * 6.5, B, z, 3.2, '#ffc070', G, 3.5);
      },
    },
  };

  // Builds the vista for a room. Returns its group (already merged), the meshes or sprites
  // that animate, the scene fog it wants and a dispose().
  function build(id, o) {
    const V = VISTAS[id];
    if (!V) return null;
    const k = Kit(o), P = Parts(), group = new THREE.Group(), G = { y: o.groundY, glows: [] };
    sky(k, V.sky, group);
    V.build(k, P, G, group);
    P.build(group);
    glows(k, G.glows, group);
    if (G.reflect) {
      // the reflection is darkened and seen through the water surface
      const cache = new Map();
      const tint = (m) => {
        if (!cache.has(m)) { const c = m.clone(); c.color = m.color.clone().multiplyScalar(G.reflect.tint); if (c.emissive) c.emissive.multiplyScalar(G.reflect.tint); k.own(c); cache.set(m, c); }
        return cache.get(m);
      };
      P.mirrored(G.reflect.y, tint).build(group);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2).translate(0, G.reflect.y, 0),
        k.own(new THREE.MeshPhysicalMaterial({ color: V.fog.color, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.55, depthWrite: false })));
      water.renderOrder = 1;
      group.add(water);
    }
    return {
      group, outdoor: !!V.outdoor, fog: V.fog,
      dispose() { k.owned.forEach((t) => t.dispose()); group.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); },
    };
  }
  return { VISTAS, build };
}
if (typeof module !== 'undefined') module.exports = ChacklateLandmarks;
