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

  // A walled compound round the garden, so the place goes on all the way round when the camera
  // turns: wall runs with merlons along the top, a domed kiosk on every corner and half way
  // along each side, and gaps for gates. o: { x0, x1, z0, z1 (z1 is behind White), h, t, mat,
  // cap, dome, gold, skip: ['n'|'s'|'e'|'w'], gates: { side: [[from, to]] }, lamps: colour }.
  function enclosure(k, P, G, o) {
    const B = G.y, h = o.h || 7, t = o.t || 1.6, cap = o.cap || o.mat;
    const sides = {
      n: { a: [o.x0, o.z0], b: [o.x1, o.z0] }, s: { a: [o.x0, o.z1], b: [o.x1, o.z1] },
      w: { a: [o.x0, o.z1], b: [o.x0, o.z0] }, e: { a: [o.x1, o.z1], b: [o.x1, o.z0] },
    };
    for (const [key, sd] of Object.entries(sides)) {
      if ((o.skip || []).includes(key)) continue;
      const [ax, az] = sd.a, [bx, bz] = sd.b, len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
      const gaps = ((o.gates || {})[key] || []).map(([f, tt]) => [f, tt]).sort((p, q) => p[0] - q[0]);
      const runs = []; let at = 0;
      for (const [f, tt] of gaps) { if (f > at) runs.push([at, f]); at = Math.max(at, tt); }
      if (at < len) runs.push([at, len]);
      for (const [r0, r1] of runs) {
        const l = r1 - r0, cx = ax + ux * (r0 + l / 2), cz = az + uz * (r0 + l / 2), ry = Math.atan2(ux, uz) + Math.PI / 2;
        P.add(o.mat, new THREE.BoxGeometry(l, h, t).rotateY(ry).translate(cx, B + h / 2, cz));
        P.add(cap, new THREE.BoxGeometry(l + 0.2, 0.5, t + 0.5).rotateY(ry).translate(cx, B + h, cz));
        for (let d = r0 + 1; d < r1 - 0.6; d += 2.2) P.add(cap, new THREE.BoxGeometry(1, 1, t * 0.7).rotateY(ry).translate(ax + ux * d, B + h + 0.5, az + uz * d));
        if (o.lamps) for (let d = r0 + 0.5; d < r1; d += 2) G.glows.push([ax + ux * d, B + h + 0.4, az + uz * d, o.lamps, 2.2]);
      }
      for (const [f, tt] of gaps) for (const d of [f, tt]) kiosk(k, P, G, o, ax + ux * d, az + uz * d, h * 1.5, 1.6);
      if (!gaps.length) kiosk(k, P, G, o, ax + ux * len / 2, az + uz * len / 2, h * 1.35, 1.8);
    }
    for (const [x, z] of [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1]]) kiosk(k, P, G, o, x, z, h * 1.6, 2.4);
  }
  // A tower with a little domed pavilion on top (a chhatri), on the ground at x, z.
  function kiosk(k, P, G, o, x, z, h, r) {
    const B = G.y;
    P.add(o.mat, new THREE.CylinderGeometry(r, r * 1.1, h, 8), { x, y: B + h / 2, z });
    P.add(o.cap || o.mat, new THREE.CylinderGeometry(r * 1.25, r * 1.25, 0.5, 8), { x, y: B + h + 0.25, z });
    for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P.add(o.cap || o.mat, new THREE.CylinderGeometry(0.16, 0.16, r * 1.1, 6), { x: x + Math.cos(a) * r * 0.9, y: B + h + 0.5 + r * 0.55, z: z + Math.sin(a) * r * 0.9 }); }
    P.add(o.dome || o.cap || o.mat, lathe([[r * 1.15, 0], [r * 1.1, r * 0.4], [r * 0.7, r * 0.95], [r * 0.2, r * 1.25], [0, r * 1.35]], 16, 10), { x, y: B + h + 0.5 + r * 1.1, z });
    if (o.gold) P.add(o.gold, new THREE.ConeGeometry(0.12, r * 0.8, 6), { x, y: B + h + 0.5 + r * 2.85, z });
    if (o.lamps) for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; G.glows.push([x + Math.cos(a) * r * 1.2, B + h + 0.6, z + Math.sin(a) * r * 1.2, o.lamps, 2.2]); }
  }
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
        // the plateau goes on all round: dunes behind and beside us, a temple's broken columns
        // on one side, a palm oasis with mud-brick houses on the other, and a camel caravan
        const dune = k.mat({ map: sandT, roughness: 1, flatShading: true, color: '#e8c098' });
        for (let i = 0; i < 14; i++) { const a = Math.PI * 0.35 + i / 13 * Math.PI * 1.3, r = 120 + (i % 3) * 14; mountain(P, dune, Math.sin(a) * r, B - 1, -Math.cos(a) * r, 34 + (i % 4) * 6, 9 + (i % 3) * 4, 40 + i, { sides: 12, rough: 0.2 }); }
        const lime = k.mat({ map: k.tile(128, 128, (g, w, h) => speckle(g, w, h, '#d8b080', '#9a7048', '#ecd0a0', 1200, 4)), roughness: 0.9 });
        const R = rng(19);
        for (let i = 0; i < 12; i++) { const x = -62 - (i % 4) * 6, z = 34 - Math.floor(i / 4) * 12, hh = i % 3 === 1 ? 3 + R() * 3 : 9 + R() * 2;
          P.add(lime, new THREE.CylinderGeometry(1.3, 1.4, hh, 12), { x, y: B + hh / 2, z }); if (hh > 8) P.add(lime, box(3.2, 1, 3.2, x, B + hh, z)); }
        P.add(lime, box(26, 1.4, 6, -71, B + 10.4, 34)); P.add(lime, box(4, 1, 2.2, -60, B, 46));
        for (let i = 0; i < 6; i++) block(P, k.mat({ color: ['#c89a6a', '#b88658', '#d4a676'][i % 3], roughness: 1 }), k.mat({ color: '#9a7048', roughness: 1 }), 62 + (i % 3) * 9, B, 24 - Math.floor(i / 3) * 12, 7, 3.5 + R() * 2, 7, 0);
        [[56, 38, 9], [70, 44, 8], [78, 30, 10], [60, 6, 9], [84, 14, 8]].forEach(([x, z, h], i) => palmTree(k, P, trunk, frond, x, B, z, h, (i % 2 ? 0.1 : -0.1), 30 + i));
        const camel = k.mat({ color: '#a87a4a', roughness: 1 });
        for (let i = 0; i < 5; i++) { const x = -30 + i * 7, z = 78 + i * 1.5;
          P.add(camel, box(3, 1.6, 1.2, x, B + 2.2, z)); P.add(camel, lathe([[0.7, 0], [0.9, 0.5], [0, 1.1]], 8), { x, y: B + 3.6, z });
          P.add(camel, box(0.5, 2, 0.5, x + 1.6, B + 3.4, z)); P.add(camel, box(1.2, 0.6, 0.5, x + 2.1, B + 5.2, z));
          for (const [dx, dz] of [[-1.1, -0.4], [-1.1, 0.4], [1.1, -0.4], [1.1, 0.4]]) P.add(camel, box(0.3, 2.2, 0.3, x + dx, B, z + dz)); }
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
        const roofM = k.mat({ color: '#6a3a2a', roughness: 0.9 }), faces = {};
        const R = rng(13);
        for (const s of [-1, 1]) {
          let z = -30;
          while (z > -150) {
            const w = 10 + R() * 8, h = 12 + R() * 12, d = 14, base = tints[Math.floor(R() * tints.length)];
            const kind = R() < 0.6 ? 'pointed' : 'arch', seed = Math.floor(R() * 99);
            // one facade per colour, shared by every palazzo painted that colour (fewer draw calls)
            const faceM = faces[base] || (faces[base] = k.mat({ map: facadeTex(k, { base, rows: 4, cols: 5, kind, lit: 0.45, frame: '#f4ecdc', balcony: 0.4, seed, win: '#1a1a2a', light: '#ffcf80' }), roughness: 0.9, emissive: '#100810', emissiveIntensity: 0.4 }));
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
        // the garden goes on all round: red sandstone walls with white-domed kiosks, the Great
        // Gate set in the near wall, and lawns, cypresses and lamps on every side
        const redT = k.tile(256, 256, (g, w, h) => { courses(g, w, h, '#9a4632', 'rgba(40,12,6,0.45)', 6, 3, 9); g.strokeStyle = 'rgba(242,232,220,0.75)'; g.lineWidth = 5; g.strokeRect(14, 20, w - 28, h - 40); }, [1, 1]);
        const redM = k.mat({ map: redT, roughness: 0.9, emissive: '#2a1010', emissiveIntensity: 0.35 });
        enclosure(k, P, G, { x0: -64, x1: 64, z0: -112, z1: 92, h: 8, t: 2, mat: redM, cap: white, dome: white, gold: k.mat({ color: '#e8c060', metalness: 0.9, roughness: 0.3 }), skip: ['n'], gates: { s: [[44, 84]], w: [[96, 106]], e: [[96, 106]] }, lamps: '#ffc070' });
        for (const sx of [-1, 1]) {
          walk(5, 190, sx * 46, 0);
          for (let z = 84; z > -104; z -= 7) { cypress(P, cyM, sx * 42, B, z, 6.5 + (Math.abs(z) % 3), 1.2); cypress(P, cyM, sx * 50, B, z + 3.5, 6 + (Math.abs(z) % 2), 1.1); }
          for (const z of [70, 40, 10, -20]) lamp(k, P, post, sx * 46, B, z, 3.2, '#ffc070', G, 3.5);
          // a flower bed in each quarter of the near garden
          for (const z of [30, 60]) { P.add(rimM, box(16, 0.4, 10, sx * 24, B, z)); P.add(k.mat({ color: '#a8304a', roughness: 0.9, emissive: '#3a0a14', emissiveIntensity: 0.3 }), box(15, 0.55, 9, sx * 24, B, z)); }
        }
        walk(100, 5, 0, 45);
      },
    },
  };

  // ------------------------------------------------------------------ more places
  // The newer suites: each place has its own board, set and table (suites3d.js).
  // A craggy mountain: a cone with its sides pushed in and out, drawn faceted.
  function mountain(P, m, x, y, z, r, h, seed, o) {
    const sides = (o && o.sides) || 9, g = new THREE.ConeGeometry(r, h, sides, 4, true), p = g.attributes.position, R = rng(seed || 1);
    const jit = Array.from({ length: sides * 5 + 5 }, () => R());
    for (let i = 0; i < p.count; i++) {
      const yy = p.getY(i) + h / 2, t = yy / h;
      if (t > 0.98) continue;
      const a = Math.atan2(p.getZ(i), p.getX(i)), k = Math.floor(((a / TAU) + 1) * sides) % sides + Math.round(t * 4) * sides;
      const f = 1 + (jit[k] - 0.5) * ((o && o.rough) || 0.35) * (1 - t * 0.4);
      p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); p.setY(i, p.getY(i) + (jit[k + 1] - 0.5) * h * 0.05 * (1 - t));
    }
    const ng = g.toNonIndexed(); ng.computeVertexNormals();
    P.add(m, ng, { x, y: y + h / 2, z, ry: R() * TAU, s: (o && o.s) || 1 });
  }
  // A mountain material: rock below, snow (or grass) above a line, painted by height.
  function peakMat(k, rock, top, line, o) {
    const t = k.tex(64, 256, (g, w, h) => {
      speckle(g, w, h, rock, shade(rock, -0.4), shade(rock, 0.25), 600, 5);
      if (top) { const y = h * (1 - line); g.fillStyle = vgrad(g, 0, y + 40, [top, top, rgba(top, 0.6), rgba(top, 0)]); g.fillRect(0, 0, w, y + 40); }
    });
    return k.mat(Object.assign({ map: t, roughness: 0.95, flatShading: true }, o || {}));
  }
  function pine(P, m, x, y, z, h) {
    P.add(m, new THREE.ConeGeometry(h * 0.26, h * 0.6, 7).translate(0, h * 0.55, 0), { x, y, z });
    P.add(m, new THREE.ConeGeometry(h * 0.2, h * 0.5, 7).translate(0, h * 0.82, 0), { x, y, z });
  }
  // A blossom tree: a short trunk and a few round clouds of flowers.
  function blossomTree(P, bark, bloom, x, y, z, h, seed) {
    const R = rng(seed || 2);
    P.add(bark, K.tube([[x, y, z], [x + (R() - 0.5) * 0.6, y + h * 0.4, z], [x + (R() - 0.5) * 1.2, y + h * 0.62, z + (R() - 0.5)]], h * 0.05, { segs: 8, radial: 6 }));
    for (let i = 0; i < 5; i++) P.add(bloom, new THREE.IcosahedronGeometry(h * (0.2 + R() * 0.1), 1), { x: x + (R() - 0.5) * h * 0.5, y: y + h * (0.62 + R() * 0.24), z: z + (R() - 0.5) * h * 0.5, s: [1.2, 0.85, 1.2] });
  }
  // A house with a pitched roof (a gable along x), optional snow on the roof.
  function gableHouse(P, wallM, roofM, x, y, z, w, h, d, ry, pitch) {
    const c = Math.cos(ry || 0), s = Math.sin(ry || 0);
    P.add(wallM, box(w, h, d, 0, 0, 0), { x, y, z, ry });
    const rh = (pitch || 0.5) * d;
    P.add(roofM, K.extrude([[-d / 2 - 0.4, 0], [d / 2 + 0.4, 0], [0, rh]], w + 0.8, 0), { x, y: y + h, z, ry: (ry || 0) + Math.PI / 2 });
    void c; void s;
  }
  // A crenellated wall top as a texture: merlons against the sky.
  function crenelTex(k, base, line, rep) {
    return k.tile(128, 128, (g, w, h) => {
      courses(g, w, h, base, line, 6, 3, 3);
      g.clearRect(w * 0.5, 0, w * 0.5, h * 0.32);
    }, rep || [1, 1]);
  }

  Object.assign(VISTAS, {
    // Tokyo: a rooftop garden at dusk, cherry trees in bloom, the city lit far below, the
    // red lattice tower to one side and Mount Fuji snow-capped on the horizon.
    tokyo: {
      outdoor: true, fog: { color: '#6a4a6a', density: 0.004 },
      sky: { stops: ['#1a1a3a', '#4a3a6a', '#c87a8a', '#f4c0a0'], haze: '#e8a8a0', below: '#3a2a3a', clouds: 9, cloud: '#ffc8c0', sun: { az: 64, el: 2, size: 11, color: '#ff9a80', glow: '#ff9a90' },
        far(g, W, HY) {
          const R = rng(7); for (let xx = 0; xx < W;) { const w = 8 + R() * 22, h = 3 + R() * 8; g.fillStyle = '#2a2440'; g.fillRect(xx, HY - h, w, h + 2); xx += w + 1; }
        } },
      build(k, P, G) {
        const B = G.y, S = B - 70;
        P.add(k.mat({ color: '#1a1828', roughness: 0.8 }), ground(k, null, 165, S, 10));
        // the garden: raked gravel, stepping stones and a low wooden deck round the terrace
        const gravel = k.mat({ map: k.tile(256, 256, (g, w, h) => { speckle(g, w, h, '#c8c0b4', '#8a8478', '#e8e0d4', 3000, 4); g.strokeStyle = 'rgba(120,110,100,0.35)'; g.lineWidth = 2; for (let y = 0; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }), roughness: 1 });
        P.add(gravel, ground(k, null, 30, B, 6));
        const R = rng(19);
        // the building under us, lit floor by floor down to the street
        const tower = k.mat({ map: facadeTex(k, { base: '#3a3a48', rows: 14, cols: 30, kind: 'rect', lit: 0.55, light: '#ffe0b0', win: '#14141e', w: 512, h: 512 }), roughness: 0.8, emissive: '#ffffff', emissiveIntensity: 0.45 });
        tower.emissiveMap = tower.map; tower.color.set('#4a4a58');
        P.add(tower, new THREE.CylinderGeometry(30, 30, B - S, 48, 1, true), { y: (B + S) / 2 });
        // a parapet of pale stone with lanterns
        const stone = k.mat({ color: '#d8d0c4', roughness: 0.8 });
        P.add(stone, new THREE.CylinderGeometry(30.2, 30.2, 1.2, 64, 1, true), { y: B + 0.6 });
        const bark = k.mat({ color: '#3a2420', roughness: 1 }), bloom = k.mat({ color: '#f4b8c8', roughness: 0.9, emissive: '#3a1a24', emissiveIntensity: 0.3 }), bloom2 = k.mat({ color: '#ffd8e4', roughness: 0.9, emissive: '#3a1a24', emissiveIntensity: 0.3 });
        for (let i = 0; i < 12; i++) { const a = (i + 0.5) / 12 * TAU, r = 17 + R() * 8; if (Math.abs(Math.sin(a)) < 0.25 && Math.cos(a) < 0) continue; blossomTree(P, bark, i % 2 ? bloom : bloom2, Math.sin(a) * r, B, -Math.cos(a) * r, 7 + R() * 3, i + 3); }
        // stone lanterns (toro)
        const toro = (x, z) => {
          P.add(stone, lathe([[0.7, 0], [0.7, 0.3], [0.22, 0.4], [0.22, 1.6], [0.6, 1.7], [0.6, 1.9]], 6), { x, y: B, z });
          P.add(k.glowMat('#ffd890', 1.4), box(0.8, 0.7, 0.8, x, B + 1.9, z));
          P.add(stone, new THREE.ConeGeometry(0.9, 0.7, 6), { x, y: B + 2.95, z });
          G.glows.push([x, B + 2.2, z, '#ffc070', 3]);
        };
        for (const [x, z] of [[-14, -6], [14, -6], [-12, 10], [12, 10], [-20, -20], [20, -20]]) toro(x, z);
        // a red torii behind black's seat
        const red = k.mat({ color: '#c8301e', roughness: 0.6 }), blackM = k.mat({ color: '#1a1414', roughness: 0.6 });
        for (const s of [-1, 1]) P.add(red, new THREE.CylinderGeometry(0.42, 0.5, 9, 12), { x: s * 4.2, y: B + 4.5, z: 22 });
        P.add(blackM, K.extrude([[-6.4, 0], [6.4, 0], [6.8, 0.9], [0, 0.6], [-6.8, 0.9]], 1, 0), { y: B + 8.6, z: 22 });
        P.add(red, box(10.2, 0.6, 0.6, 0, B + 7.2, 22));
        // the city below, and the red-and-white lattice tower
        const fronts = ['#3a3448', '#2e2a3a', '#46405a', '#34303e'], roof = k.mat({ color: '#1a1820', roughness: 0.9 });
        const faces = fronts.map((b, i) => { const m = k.mat({ map: facadeTex(k, { base: b, rows: 24, cols: 10, kind: 'rect', lit: 0.45, seed: i * 7 + 1, light: '#ffe0b0', win: '#12121a', w: 256, h: 1024 }), roughness: 0.9, emissive: '#ffffff', emissiveIntensity: 0.5 }); m.emissiveMap = m.map; m.color.set('#3a3644'); return m; });
        // Mount Fuji on the horizon, its snow cap lit pink by the sunset
        const fuji = k.mat({ map: k.tex(64, 256, (g, w, h) => { g.fillStyle = vgrad(g, 0, h, ['#fff4f8', '#f4e0ec', '#6a5a8a', '#4a4a7a', '#3a3a6a']); g.fillRect(0, 0, w, h); g.fillStyle = '#f4e8f0'; for (let i = 0; i < 16; i++) { const x = i * 4; g.fillRect(x, h * 0.3, 3, 10 + ((i * 37) % 30)); } }), roughness: 1, fog: false });
        P.add(fuji, lathe([[86, 0], [60, 12], [36, 30], [18, 48], [9, 58], [0, 59]], 48), { x: -14, y: S, z: -164, s: [1, 1.62, 1] });
        for (let i = 0; i < 160; i++) {
          const a = R() * TAU, r = 42 + R() * 110, x = Math.sin(a) * r, z = -Math.cos(a) * r, h = Math.min(r < 100 ? 62 : 54, 24 + R() * 60);
          if (Math.abs(a - 5.7) < 0.12 && r > 80) continue;
          block(P, faces[i % 4], roof, x, S, z, 8 + R() * 10, h, 8 + R() * 10, R());
          if (R() < 0.3) G.glows.push([x, S + h + 1, z, '#ff4a4a', 1.6]);
        }
        const lat = k.own(new THREE.MeshStandardMaterial({ map: latticeTex(k, '#d8401e'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, emissive: '#ff5a2a', emissiveIntensity: 0.35 }));
        const latW = k.own(new THREE.MeshStandardMaterial({ map: latticeTex(k, '#f0ece4'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.25 }));
        const TX = -66, TZ = -120, path = [], half = [];
        for (let i = 0; i <= 12; i++) { const t = i / 12; path.push([TX, S + t * 92, TZ]); half.push(mix(9, 1.2, Math.pow(t, 0.6))); }
        for (let i = 0; i < 12; i++) P.add(i % 2 ? latW : lat, loft(path.slice(i, i + 2), half.slice(i, i + 2), 4));
        P.add(k.glowMat('#ffd8a0', 0.9), box(8, 3, 8, TX, S + 46, TZ));
        P.add(lat, new THREE.CylinderGeometry(0.4, 0.6, 18, 6), { x: TX, y: S + 101, z: TZ });
        G.glows.push([TX, S + 110, TZ, '#ff5040', 5], [TX, S + 47, TZ, '#ffd8a0', 9]);
      },
    },

    // The bottom of the sea: a terrace of pearl among coral towers, sea fans and kelp, fish
    // hanging in blue light and a palace of shell and pearl ahead.
    reef: {
      outdoor: true, fog: { color: '#0a3a56', density: 0.011 },
      sky: { stops: ['#02101e', '#06304a', '#0a5a7a', '#2a8aa0'], haze: '#1a6a80', below: '#0a4a62', sun: { az: 0, el: 80, size: 30, color: '#a8f0ff', glow: '#6ad8f0' } },
      build(k, P, G) {
        const B = G.y;
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => { speckle(g, w, h, '#8a9a94', '#5a6a6a', '#b8c4b8', 5000, 9); g.strokeStyle = 'rgba(200,240,255,0.14)'; g.lineWidth = 3; for (let y = 0; y < h; y += 30) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 20) g.lineTo(x, y + Math.sin(x * 0.05 + y) * 6); g.stroke(); } }), roughness: 1, emissive: '#06304a', emissiveIntensity: 0.3 }), ground(k, null, 165, B, 10));
        const R = rng(33);
        const corals = ['#ff7a6a', '#f4a83a', '#c84a8a', '#8a5ac8', '#f4e0a0', '#4ac8a8'].map((c) => k.mat({ color: c, roughness: 0.8, emissive: c, emissiveIntensity: 0.18 }));
        // coral towers: stacked knobbly columns and branching antlers
        const tower = (x, z, h, m) => {
          let y = B, r = 1.4 + R();
          while (y < B + h) { const hh = 1.2 + R() * 1.6; P.add(m, lathe([[r, 0], [r * 1.2, hh * 0.4], [r * 0.9, hh]], 9, 6), { x: x + (R() - 0.5) * 0.6, y, z: z + (R() - 0.5) * 0.6 }); y += hh * 0.9; r *= 0.9; }
        };
        const branch = (x, z, h, m) => { for (let i = 0; i < 6; i++) { const a = R() * TAU, l = h * (0.5 + R() * 0.5); P.add(m, K.tube([[x, B, z], [x + Math.cos(a) * l * 0.2, B + l * 0.5, z + Math.sin(a) * l * 0.2], [x + Math.cos(a) * l * 0.4, B + l, z + Math.sin(a) * l * 0.4]], 0.18, { segs: 6, radial: 5 })); } };
        for (let i = 0; i < 46; i++) {
          const a = R() * TAU, r = 18 + R() * 70, x = Math.sin(a) * r, z = -Math.cos(a) * r;
          if (Math.abs(x) < 16 && z < -40 && z > -110) continue;
          if (R() < 0.5) tower(x, z, 4 + R() * 12, corals[i % 6]); else branch(x, z, 3 + R() * 5, corals[(i + 2) % 6]);
        }
        // sea fans: flat lace in violet and gold
        const fanT = k.tex(128, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 3; for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(w / 2, h); g.quadraticCurveTo(w / 2 + (i - 9) * 4, h * 0.5, w / 2 + (i - 9) * 7, 4); g.stroke(); } g.lineWidth = 1.5; for (let y = 10; y < h; y += 8) { g.beginPath(); g.arc(w / 2, h, h - y, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); } });
        for (const c of ['#b85ad8', '#f0b040']) {
          const fm = k.own(new THREE.MeshStandardMaterial({ map: fanT, color: c, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8, emissive: c, emissiveIntensity: 0.25 }));
          for (let i = 0; i < 9; i++) { const a = R() * TAU, r = 16 + R() * 40; P.add(fm, new THREE.PlaneGeometry(4 + R() * 3, 4 + R() * 3).translate(0, 2.4, 0), { x: Math.sin(a) * r, y: B, z: -Math.cos(a) * r, ry: R() * TAU }); }
        }
        // kelp swaying up into the light
        const kelp = k.mat({ color: '#3a7a3a', roughness: 0.8, emissive: '#0a2a0a', emissiveIntensity: 0.3, side: THREE.DoubleSide });
        for (let i = 0; i < 26; i++) { const a = R() * TAU, r = 24 + R() * 60, x = Math.sin(a) * r, z = -Math.cos(a) * r, h = 10 + R() * 14; P.add(kelp, K.tube([[x, B, z], [x + 1, B + h * 0.3, z], [x - 1, B + h * 0.6, z + 0.6], [x + 0.6, B + h, z]], 0.22, { segs: 10, radial: 4 })); }
        // shoals of fish, still in the water
        const fishG = new THREE.SphereGeometry(0.4, 8, 6).scale(1.6, 0.8, 0.5);
        for (const [c, cx, cy, cz, n] of [['#f4c840', -22, 8, -40, 26], ['#4ad8f0', 26, 11, -56, 30], ['#ff8a6a', -8, 15, -78, 22], ['#f4f4f8', 34, 6, -20, 18]]) {
          const fm = k.mat({ color: c, roughness: 0.4, metalness: 0.3, emissive: c, emissiveIntensity: 0.3 });
          for (let i = 0; i < n; i++) P.add(fm, fishG.clone(), { x: cx + (R() - 0.5) * 10, y: B + cy + (R() - 0.5) * 4, z: cz + (R() - 0.5) * 8, ry: 0.4 + (R() - 0.5) * 0.3, s: 0.7 + R() * 0.5 });
        }
        // the pearl palace: a shell dome on a ring of pillars, spires like unicorn shells
        const pearl = k.own(new THREE.MeshPhysicalMaterial({ color: '#f4eef0', roughness: 0.25, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.6, sheen: 0.5, sheenColor: new THREE.Color('#f8d8e8'), emissive: '#2a4a5a', emissiveIntensity: 0.35 }));
        const Z = -86;
        P.add(pearl, new THREE.CylinderGeometry(20, 22, 3, 40), { y: B + 1.5, z: Z });
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU; P.add(pearl, lathe([[0.8, 0], [0.6, 0.6], [0.6, 11], [1.0, 11.6], [0.4, 12.2]], 10), { x: Math.cos(a) * 15, y: B + 3, z: Z + Math.sin(a) * 15 }); }
        const ribs = []; for (let i = 0; i <= 14; i++) { const t = i / 14; ribs.push([17 * Math.cos(t * Math.PI / 2) + 0.1, t * 14]); }
        P.add(pearl, lathe(ribs, 24), { y: B + 15, z: Z });
        P.add(k.mat({ color: '#f4c8a0', roughness: 0.3, metalness: 0.5, emissive: '#3a2410', emissiveIntensity: 0.4 }), new THREE.SphereGeometry(2.2, 20, 14), { y: B + 30.4, z: Z });
        for (const [dx, dz, h] of [[-26, 6, 26], [26, 6, 26], [-34, -10, 20], [34, -10, 20], [0, -24, 34]]) {
          const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([2.6 * (1 - t) + 0.05, t * h]); }
          P.add(pearl, lathe(pts, 12), { x: dx, y: B, z: Z + dz });
          G.glows.push([dx, B + h + 0.6, Z + dz, '#a8f8ff', 4]);
        }
        // giant clams by the steps, each holding a pearl
        const clam = k.mat({ color: '#8ab8c8', roughness: 0.6, emissive: '#0a2a3a', emissiveIntensity: 0.4 });
        for (const s of [-1, 1]) {
          P.add(clam, new THREE.SphereGeometry(3, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.5, 0.8), { x: s * 9, y: B, z: Z + 26 });
          P.add(clam, new THREE.SphereGeometry(3, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.5, 0.8), { x: s * 9, y: B + 0.2, z: Z + 26 - 1.6, rx: -1.0 });
          P.add(pearl, new THREE.SphereGeometry(1.0, 16, 12), { x: s * 9, y: B + 1.2, z: Z + 26 });
        }
        // little glowing creatures everywhere
        for (let i = 0; i < 60; i++) { const a = R() * TAU, r = 14 + R() * 70; G.glows.push([Math.sin(a) * r, B + 1 + R() * 20, -Math.cos(a) * r, R() < 0.5 ? '#6af0ff' : '#c8a8ff', 1 + R() * 1.5]); }
        // shafts of light from the surface
        const shaft = k.own(new THREE.MeshBasicMaterial({ map: k.tex(64, 256, (g, w, h) => { g.fillStyle = vgrad(g, 0, h, ['rgba(200,250,255,0.35)', 'rgba(200,250,255,0)']); g.fillRect(0, 0, w, h); }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }));
        for (let i = 0; i < 8; i++) P.add(shaft, new THREE.PlaneGeometry(6, 70).translate(0, -35, 0), { x: (R() - 0.5) * 120, y: B + 70, z: -30 - R() * 90, ry: R() * TAU, rz: (R() - 0.5) * 0.3 });
      },
    },

    // Amber Fort: a courtyard of honey-coloured stone, the Ganesh Gate painted in fresco
    // ahead, domed pavilions on the walls and the fort's ramparts running over the hills.
    amber: {
      outdoor: true, fog: { color: '#d8b080', density: 0.0035 },
      sky: { stops: ['#3a5a9a', '#7aa0c8', '#f0c890', '#f8d8a0'], haze: '#f0c890', below: '#d8b080', clouds: 8, cloud: '#fff0d8', sun: { az: -60, el: 14, size: 11, color: '#ffd890', glow: '#ffc070' },
        far(g, W, HY) { g.fillStyle = '#9a7a5a'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 12) g.lineTo(x, HY - 8 - Math.abs(Math.sin(x * 0.005) * 26 + Math.sin(x * 0.02) * 6)); g.lineTo(W, HY + 2); g.fill(); } },
      build(k, P, G) {
        const B = G.y, R = rng(37);
        const pave = k.mat({ map: k.tile(256, 256, (g, w, h) => courses(g, w, h, '#e0bc88', 'rgba(110,70,30,0.5)', 4, 2, 6, 0.1)), roughness: 0.9 });
        P.add(pave, ground(k, null, 60, B, 6));
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#b8905a', '#7a5a34', '#d8b080', 4000, 3)), roughness: 1 }), ground(k, null, 165, B - 12, 12));
        // the courtyard walls: two storeys of arched jharokha windows under a crenellated top
        const wallT = facadeTex(k, { base: '#e0b070', rows: 2, cols: 6, kind: 'arch', frame: '#f4e4c0', win: '#5a2a14', lit: 0.1, w: 512, h: 256, top: 0.2, balcony: 0.7 });
        wallT.wrapS = THREE.RepeatWrapping;
        const wallM = k.mat({ map: wallT, roughness: 0.9, emissive: '#3a1a08', emissiveIntensity: 0.2 });
        const N = 14, RW = 46;
        const ringPts = Array.from({ length: N }, (_, i) => { const a = i / N * TAU; return [Math.cos(a) * RW, Math.sin(a) * RW]; });
        prism(ringPts, B, B + 14).forEach((g, i) => { if (i === Math.round(N * 0.75)) return; P.add(wallM, g); });
        const cren = k.own(new THREE.MeshStandardMaterial({ map: crenelTex(k, '#d8a868', 'rgba(110,70,30,0.5)', [40, 1]), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
        P.add(cren, new THREE.CylinderGeometry(RW * 0.99, RW * 0.99, 2, N, 1, true).rotateY(TAU / N / 2), { y: B + 15 });
        // the Ganesh Gate, straight ahead: a painted face with a big arch, a screened gallery
        // and two domes
        const gate = k.mat({ map: k.tex(512, 512, (g, w, h) => {
          speckle(g, w, h, '#e8c890', '#b88a50', '#f8e0b0', 2000, 4);
          g.fillStyle = '#c84a2a'; g.fillRect(w * 0.08, h * 0.1, w * 0.84, h * 0.04);
          for (let i = 0; i < 9; i++) { g.fillStyle = ['#2a6a4a', '#c84a2a', '#3a5aa8'][i % 3]; for (let y = h * 0.18; y < h * 0.9; y += 40) { g.beginPath(); g.arc(w * 0.12 + i * w * 0.095, y, 7, 0, TAU); g.fill(); } }
          archPath(g, w * 0.3, h, w * 0.4, h * 0.58, true); g.fillStyle = '#4a1e0e'; g.fill(); g.strokeStyle = '#f8ecd0'; g.lineWidth = 10; g.stroke();
          g.fillStyle = '#6a3a1a'; for (let x = w * 0.2; x < w * 0.8; x += 30) { archPath(g, x, h * 0.32, 22, 46, false); g.fill(); }
        }), roughness: 0.9, emissive: '#3a1a08', emissiveIntensity: 0.25 });
        const Z = -RW + 1;
        P.add(gate, wall(30, 26, 0, B, Z + 1.5, 0));
        P.add(k.mat({ color: '#d8a868', roughness: 0.9 }), box(32, 1, 4, 0, B + 26, Z));
        // chhatris: domed kiosks on the walls and on the gate
        const white = k.mat({ color: '#f4ead8', roughness: 0.6 }), sand = k.mat({ color: '#e0b878', roughness: 0.8 });
        const chhatri = (x, y, z, s) => {
          for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; P.add(sand, new THREE.CylinderGeometry(0.2 * s, 0.2 * s, 2.6 * s, 6), { x: x + Math.cos(a) * 1.8 * s, y: y + 1.3 * s, z: z + Math.sin(a) * 1.8 * s }); }
          P.add(sand, new THREE.CylinderGeometry(2.4 * s, 2.2 * s, 0.5 * s, 12), { x, y: y + 2.8 * s, z });
          P.add(white, lathe([[2.1, 0], [2.3, 0.8], [1.8, 2], [0.7, 2.8], [0, 3.1]], 14, 12), { x, y: y + 3.0 * s, z, s });
          P.add(k.mat({ color: '#e8c060', metalness: 0.8, roughness: 0.3 }), new THREE.ConeGeometry(0.16 * s, 1.2 * s, 6), { x, y: y + 6.6 * s, z });
        };
        chhatri(-10, B + 26.5, Z, 1.1); chhatri(10, B + 26.5, Z, 1.1);
        for (let i = 0; i < N; i++) { const a = (i + 0.5) / N * TAU, x = Math.cos(a) * RW * 0.96, z = Math.sin(a) * RW * 0.96; if (z < -RW * 0.8 || z > RW * 0.7) continue; chhatri(x, B + 16, z, 0.9); }
        // the ramparts of the old fort, running up and over the hill behind
        const hill = k.mat({ color: '#8a7050', roughness: 1, flatShading: true });
        mountain(P, hill, -40, B - 12, -150, 60, 60, 3, { sides: 10 }); mountain(P, hill, 70, B - 12, -170, 50, 50, 8); mountain(P, hill, -120, B - 12, -90, 45, 42, 5);
        const ramp = k.mat({ color: '#d8a868', roughness: 0.9 });
        const path = []; for (let i = 0; i <= 30; i++) { const t = i / 30, x = -100 + t * 200, z = -140 - Math.sin(t * Math.PI) * 30; path.push([x, B - 10 + Math.sin(t * Math.PI) * 44 + Math.sin(t * 9) * 3, z]); }
        for (let i = 0; i < 30; i++) { const [x0, y0, z0] = path[i], [x1, y1, z1] = path[i + 1]; const lh = Math.hypot(x1 - x0, z1 - z0); P.add(ramp, new THREE.BoxGeometry(lh + 0.4, 3, 2).rotateZ(Math.atan2(y1 - y0, lh)), { x: (x0 + x1) / 2, y: (y0 + y1) / 2 + 1.5, z: (z0 + z1) / 2, ry: -Math.atan2(z1 - z0, x1 - x0) }); if (i % 6 === 3) P.add(ramp, box(4, 6, 4, x0, y0, z0)); }
        // potted palms and urns round the court
        const trunk = k.mat({ color: '#6a4a2e', roughness: 1 }), frond = k.own(new THREE.MeshStandardMaterial({ map: frondTexture(k, '#4a6a2a'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
        for (const [x, z] of [[-24, -20], [24, -20], [-30, 8], [30, 8]]) { P.add(k.mat({ color: '#a8502a', roughness: 0.8 }), lathe([[1.4, 0], [1.8, 1.2], [1.4, 1.8], [1.6, 2]], 12), { x, y: B, z }); palmTree(k, P, trunk, frond, x, B + 1.8, z, 6, 0.1, R() * 9 | 0); }
      },
    },

    // Mysore Palace on a festival night: its arches, domes and towers outlined in lamps.
    mysore: {
      outdoor: true, fog: { color: '#141020', density: 0.004 },
      sky: { stops: ['#02040e', '#0a0e2a', '#1a1a3e', '#3a2a48'], haze: '#3a2a48', below: '#141020', stars: 260, moon: { az: -40, el: 30, size: 5, crescent: true, color: '#fff2d8' } },
      build(k, P, G) {
        const B = G.y;
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#1e3018', '#0e1a0c', '#2a4020', 5000, 4)), roughness: 1 }), ground(k, null, 165, B, 10));
        const gravel = k.mat({ map: k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#a89a80', '#6a5a48', '#c8b8a0', 3000, 2)), roughness: 1 });
        { const gg = new THREE.PlaneGeometry(14, 80).rotateX(-Math.PI / 2); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3, uv.getY(i) * 16); P.add(gravel, gg.translate(0, B + 0.02, -50)); }
        // the palace: a long front of arches in grey granite and pink, with lamps on every edge
        const front = k.mat({ map: k.tex(1024, 256, (g, w, h) => {
          speckle(g, w, h, '#c8b8a8', '#8a7a6a', '#e8dcd0', 3000, 6);
          for (let r = 0; r < 2; r++) for (let i = 0; i < 16; i++) { const x = i * 64 + 8, y = r ? h : h * 0.5; archPath(g, x, y, 48, h * 0.42, false); g.fillStyle = r ? '#ffcf70' : '#3a2a20'; g.fill(); g.strokeStyle = '#f4ead8'; g.lineWidth = 4; g.stroke(); }
          g.fillStyle = '#ffe8a0'; for (let x = 4; x < w; x += 12) { g.beginPath(); g.arc(x, 4, 2.5, 0, TAU); g.arc(x, h * 0.5 + 2, 2.5, 0, TAU); g.fill(); }
        }), roughness: 0.8, color: '#8a8090', emissive: '#ffffff', emissiveIntensity: 0.0 });
        front.emissiveMap = k.tex(1024, 256, (g, w, h) => {
          g.fillStyle = '#000000'; g.fillRect(0, 0, w, h);
          for (let i = 0; i < 16; i++) { archPath(g, i * 64 + 8, h, 48, h * 0.42, false); g.fillStyle = '#ffb860'; g.fill(); }
          g.fillStyle = '#ffe8a0'; for (let x = 4; x < w; x += 12) { g.beginPath(); g.arc(x, 4, 3, 0, TAU); g.arc(x, h * 0.5 + 2, 3, 0, TAU); g.fill(); }
          for (let i = 0; i < 16; i++) for (let a = 0; a <= 12; a++) { const t = Math.PI + a / 12 * Math.PI, x = i * 64 + 32 + Math.cos(t) * 26, y = h * 0.5 - h * 0.42 + 24 + Math.sin(t) * 26; g.beginPath(); g.arc(x, y + 2, 2.5, 0, TAU); g.fill(); }
        });
        front.emissive.set('#ffffff'); front.emissiveIntensity = 0.9;
        const Z = -96, FW = 90, FH = 16;
        prism([[-FW / 2, Z + 6], [FW / 2, Z + 6], [FW / 2, Z - 10], [-FW / 2, Z - 10]], B, B + FH).forEach((g) => P.add(front, g));
        const stoneM = k.mat({ color: '#8a7e78', roughness: 0.8, emissive: '#2a1a10', emissiveIntensity: 0.3 });
        P.add(stoneM, lid([[-FW / 2, Z + 6], [FW / 2, Z + 6], [FW / 2, Z - 10], [-FW / 2, Z - 10]], B + FH));
        const domeM = k.mat({ color: '#a85a4a', roughness: 0.5, emissive: '#3a1008', emissiveIntensity: 0.25 }), gold = k.mat({ color: '#f0c050', metalness: 0.9, roughness: 0.25, emissive: '#5a3a08', emissiveIntensity: 0.5 });
        const lampDots = (x, y, z, r, n, h) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; G.glows.push([x + Math.cos(a) * r, y + (h || 0), z + Math.sin(a) * r, '#ffd070', 2.2]); } };
        const towerAt = (x, z, w, h, dome) => {
          prism([[-w, w], [w, w], [w, -w], [-w, -w]].map(([a, b]) => [a + x, b + z]), B, B + h).forEach((g) => P.add(front, g));
          P.add(stoneM, lid([[-w, w], [w, w], [w, -w], [-w, -w]].map(([a, b]) => [a + x, b + z]), B + h));
          P.add(domeM, lathe([[w * 0.9, 0], [w * 1.05, w * 0.5], [w * 0.8, w * 1.1], [w * 0.3, w * 1.5], [0, w * 1.6]], 20, 14), { x, y: B + h, z, s: dome || 1 });
          P.add(gold, new THREE.ConeGeometry(0.3, 2.4, 6), { x, y: B + h + w * 1.6 * (dome || 1) + 1, z });
          lampDots(x, B + h, z, w * 0.95, 28); lampDots(x, B + h + w * 0.55, z, w * 1.02, 30); lampDots(x, B + h + w * 1.15, z, w * 0.7, 20);
          for (let y = 2; y < h; y += 2) for (const [dx, dz] of [[-w, w], [w, w]]) G.glows.push([x + dx, B + y, z + dz + 0.1, '#ffd070', 2.2]);
        };
        towerAt(0, Z - 2, 7, 30, 1.3);
        for (const s of [-1, 1]) { towerAt(s * 22, Z, 4, 22); towerAt(s * (FW / 2 - 2), Z, 3.4, 20); }
        // lamps along every edge of the front
        for (let x = -FW / 2; x <= FW / 2; x += 1.4) { G.glows.push([x, B + FH + 0.2, Z + 6.1, '#ffd070', 2.4], [x, B + FH * 0.5, Z + 6.1, '#ffd070', 2]); }
        // the gateway arch on the lawn, and the fountain
        const hole = [[-3, 0.01]]; for (let i = 0; i <= 12; i++) { const a = Math.PI - i / 12 * Math.PI; hole.push([Math.cos(a) * 3, 5 + Math.sin(a) * 3]); } hole.push([3, 0.01]);
        const arch = K.extrude([[-6, 0], [6, 0], [6, 9], [-6, 9]], 1.8, 0, { holes: [hole.reverse()] });
        for (const s of [-1, 1]) { P.add(stoneM, arch.clone(), { x: s * 40, y: B, z: -64, ry: s * 0.5 }); for (let x = -6; x <= 6; x += 0.8) G.glows.push([s * 40 + x * Math.cos(0.5), B + 9.1, -64 - s * x * Math.sin(0.5), '#ffd070', 2]); }
        const water = k.mat({ color: '#1a2a4a', roughness: 0.1, emissive: '#2a3a6a', emissiveIntensity: 0.4 });
        P.add(stoneM, new THREE.CylinderGeometry(6, 6.3, 0.8, 32), { y: B + 0.4, z: -56 }); P.add(water, new THREE.CylinderGeometry(5.6, 5.6, 0.82, 32), { y: B + 0.42, z: -56 });
        P.add(stoneM, lathe([[0.4, 0], [0.3, 2], [1.6, 2.2], [1.6, 2.4], [0.2, 2.6], [0.15, 3.6], [0.6, 3.8], [0, 4]], 16), { y: B, z: -56 });
        lampDots(0, B + 0.9, -56, 6.1, 40);
        // banyan-like trees round the lawn
        const leaves = k.mat({ color: '#1a2a18', roughness: 1, flatShading: true }), bark = k.mat({ color: '#2a201a', roughness: 1 });
        for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const x = s * (28 + (i % 2) * 8), z = 14 - i * 16; P.add(bark, new THREE.CylinderGeometry(0.5, 0.7, 5, 6), { x, y: B + 2.5, z }); P.add(leaves, new THREE.IcosahedronGeometry(4.4, 1), { x, y: B + 7.6, z, s: [1.3, 0.9, 1.3] }); }
        // the palace grounds go on all round: a lit compound wall with kiosks, gateways on the
        // sides, palms and lamp posts along the drives
        const wallM = k.mat({ map: k.tile(256, 128, (g, w, h) => courses(g, w, h, '#b8a898', 'rgba(60,40,30,0.4)', 4, 2, 3), [1, 1]), roughness: 0.85, emissive: '#2a1a10', emissiveIntensity: 0.3 });
        enclosure(k, P, G, { x0: -70, x1: 70, z0: -104, z1: 70, h: 6, t: 1.6, mat: wallM, cap: stoneM, dome: domeM, gold, skip: ['n'], gates: { s: [[60, 80]], w: [[80, 100]], e: [[80, 100]] }, lamps: '#ffd070' });
        const postM = k.mat({ color: '#2a2018', roughness: 0.5, metalness: 0.6 });
        for (const sx of [-1, 1]) {
          { const gg = new THREE.PlaneGeometry(8, 170).rotateX(-Math.PI / 2); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 34); P.add(gravel, gg.translate(sx * 52, B + 0.02, -15)); }
          for (let z = 60; z > -95; z -= 18) lamp(k, P, postM, sx * 47, B, z, 3.4, '#ffd070', G, 3.6);
          for (let z = 52; z > -95; z -= 12) { P.add(bark, new THREE.CylinderGeometry(0.4, 0.55, 4.5, 6), { x: sx * 60, y: B + 2.25, z }); P.add(leaves, new THREE.IcosahedronGeometry(3.4, 1), { x: sx * 60, y: B + 6.2, z, s: [1.2, 0.85, 1.2] }); }
        }
        { const gg = new THREE.PlaneGeometry(130, 8).rotateX(-Math.PI / 2); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 26, uv.getY(i) * 2); P.add(gravel, gg.translate(0, B + 0.02, 48)); }
      },
    },

    // The Great Wall at Mutianyu: our terrace is a watchtower roof; the wall rides the green
    // ridges away into the haze, tower after tower.
    greatwall: {
      outdoor: true, fog: { color: '#b8c8d0', density: 0.0045 },
      sky: { stops: ['#2a4a8a', '#6a90c0', '#c8d8e0', '#e8e4d8'], haze: '#d8e0e0', below: '#9aa8a0', clouds: 12, cloud: '#ffffff', sun: { az: 40, el: 30, size: 9, color: '#fff4d8' },
        far(g, W, HY) { for (const [c, a, f, o] of [['#8aa0a8', 30, 0.004, 0], ['#7a9090', 18, 0.009, 2]]) { g.fillStyle = c; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 10) g.lineTo(x, HY - 6 - o - Math.abs(Math.sin(x * f) * a + Math.sin(x * f * 4.3) * a * 0.3)); g.lineTo(W, HY + 2); g.fill(); } } },
      build(k, P, G) {
        const B = G.y, R = rng(43);
        // the valley far below, the ridges green with forest
        const green = k.mat({ map: k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#4a6a34', '#2a4a20', '#6a8a44', 4000, 7)), roughness: 1, flatShading: true });
        P.add(green, ground(k, null, 165, B - 30, 10));
        for (let i = 0; i < 22; i++) { const a = R() * TAU, r = 80 + R() * 80; mountain(P, green, Math.sin(a) * r, B - 34, -Math.cos(a) * r, 34 + R() * 26, 22 + R() * 26, i + 2, { sides: 14, rough: 0.22 }); }
        // our watchtower, rising from the ridge
        const brick = k.tile(256, 256, (g, w, h) => courses(g, w, h, '#a89a88', 'rgba(60,50,40,0.5)', 10, 4, 3, 0.12));
        const brickM = k.mat({ map: brick, roughness: 0.95 });
        prism(Array.from({ length: 4 }, (_, i) => { const a = i / 4 * TAU + TAU / 8; return [Math.cos(a) * 18, Math.sin(a) * 18]; }), B - 30, B).forEach((g) => P.add(brickM, g));
        const cren = k.own(new THREE.MeshStandardMaterial({ map: crenelTex(k, '#9a8c7a', 'rgba(60,50,40,0.5)', [1, 1]), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.95 }));
        // the wall itself: a walkway lofted along the ridges, battlements on both sides
        const route = [[-14, -10], [-30, -24], [-46, -50], [-58, -84], [-50, -118], [-26, -140], [6, -150], [40, -140], [70, -120], [96, -96], [120, -60]];
        const height = (i) => B - 4 + Math.sin(i * 0.9) * 10 + i * 2.6;
        const pts = route.map(([x, z], i) => [x, height(i), z]);
        for (let i = 0; i < pts.length - 1; i++) {
          const [x0, y0, z0] = pts[i], [x1, y1, z1] = pts[i + 1], len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(z1 - z0, x1 - x0), slope = Math.atan2(y1 - y0, len);
          const mid = { x: (x0 + x1) / 2, z: (z0 + z1) / 2, ry: -ang };
          const body = new THREE.BoxGeometry(len + 0.6, 30, 5).translate(0, -15, 0).rotateZ(slope);
          P.add(brickM, body, Object.assign({ y: (y0 + y1) / 2 }, mid));
          for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(len + 0.6, 1.6, 1, 1).rotateZ(slope); const uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setX(j, uv.getX(j) * len / 1.6); P.add(cren, g.translate(0, 0.8, s * 2.5), Object.assign({ y: (y0 + y1) / 2 }, mid)); }
          if (i % 2 === 1) { P.add(brickM, box(7, 7, 7, 0, 0, 0), { x: x1, y: y1 - 1, z: z1, ry: -ang }); P.add(cren, new THREE.CylinderGeometry(4.9, 4.9, 1.6, 4, 1, true).rotateY(TAU / 8), { x: x1, y: y1 + 6.8, z: z1, ry: -ang }); }
        }
        // red lanterns on poles at the tower's corners
        const red = k.mat({ color: '#c8281e', roughness: 0.6, emissive: '#5a0a04', emissiveIntensity: 0.5 }), wood = k.mat({ color: '#3a2a1a', roughness: 0.9 });
        for (const [x, z] of [[-11, -11], [11, -11], [-11, 11], [11, 11]]) { P.add(wood, new THREE.CylinderGeometry(0.12, 0.12, 4.4, 6), { x, y: B + 2.2, z }); P.add(red, new THREE.SphereGeometry(0.6, 12, 8).scale(1, 1.2, 1), { x: x + 0.6, y: B + 4.2, z }); G.glows.push([x + 0.6, B + 4.2, z, '#ff7040', 2]); }
        // pines on the slopes near the wall
        const pineM = k.mat({ color: '#2a4a2a', roughness: 1, flatShading: true });
        for (let i = 0; i < 60; i++) { const a = R() * TAU, r = 24 + R() * 60; pine(P, pineM, Math.sin(a) * r, B - 30 + R() * 20, -Math.cos(a) * r, 5 + R() * 4); }
      },
    },

    // Zermatt: from the chalet's windows, snowy meadows, dark pines and wooden chalets, and
    // the Matterhorn rising alone into a clear sky.
    matterhorn: {
      drop: 3, fog: { color: '#b8c8dc', density: 0.0028 },
      sky: { stops: ['#2a5aa8', '#6a9ad0', '#c8dcf0', '#f0f0ec'], haze: '#e8eef4', below: '#dce4ec', clouds: 6, cloud: '#ffffff', sun: { az: 50, el: 26, size: 9, color: '#fffaf0' },
        far(g, W, HY) { g.fillStyle = '#a8b8d0'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 8) g.lineTo(x, HY - 14 - Math.abs(Math.sin(x * 0.006) * 34 + Math.sin(x * 0.03) * 8)); g.lineTo(W, HY + 2); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 5; g.beginPath(); for (let x = 0; x <= W; x += 8) g.lineTo(x, HY - 12 - Math.abs(Math.sin(x * 0.006) * 34 + Math.sin(x * 0.03) * 8)); g.stroke(); } },
      build(k, P, G) {
        const B = G.y, R = rng(47);
        const snowT = k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#c8d0dc', '#a0acc0', '#e0e6ee', 1600, 2));
        P.add(k.mat({ map: snowT, roughness: 0.9 }), ground(k, null, 165, B, 10));
        // the Matterhorn: a crooked four-sided horn with snow in its gullies
        const horn = peakMat(k, '#4a4038', '#f4f6fa', 0.5, { envMapIntensity: 0.1 });
        const hg = new THREE.ConeGeometry(36, 92, 4, 6), hp = hg.attributes.position;
        for (let i = 0; i < hp.count; i++) { const t = (hp.getY(i) + 46) / 92; hp.setX(i, hp.getX(i) + t * t * 10); hp.setZ(i, hp.getZ(i) * (1 + (Math.sin(i * 3.1) * 0.08))); }
        const hn = hg.toNonIndexed(); hn.computeVertexNormals();
        P.add(horn, hn, { x: 12, y: B + 30, z: -168, ry: 0.5, s: [0.85, 1, 0.85] });
        const range = peakMat(k, '#5a5450', '#eef2f8', 0.4, { envMapIntensity: 0.1 });
        for (let i = 0; i < 12; i++) { const a = (R() - 0.5) * 3.6 + (i % 2 ? Math.PI : 0), r = 110 + R() * 40; mountain(P, range, Math.sin(a) * r, B - 6, -Math.cos(a) * r, 24 + R() * 22, 30 + R() * 34, i + 9, { sides: 6 }); }
        // dark pines and chalets with snowy roofs down the slope
        const pineM = k.mat({ color: '#1e3a2a', roughness: 1, flatShading: true }), snowy = k.mat({ color: '#f4f6fa', roughness: 0.8 });
        for (let i = 0; i < 90; i++) { const a = R() * TAU, r = 26 + R() * 90, x = Math.sin(a) * r, z = -Math.cos(a) * r; if (Math.abs(x) < 10 && z < -24 && z > -60) continue; pine(P, pineM, x, B, z, 5 + R() * 6); if (R() < 0.4) P.add(snowy, new THREE.ConeGeometry(1, 1, 7), { x, y: B + 5.8 * 0.95, z }); }
        const timber = k.mat({ map: k.tile(128, 128, (g, w, h) => { g.fillStyle = '#6a3a1e'; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.3)'; for (let y = 0; y < h; y += 12) g.fillRect(0, y, w, 2); g.fillStyle = '#ffd890'; g.fillRect(w * 0.2, h * 0.4, w * 0.2, h * 0.2); g.fillRect(w * 0.6, h * 0.4, w * 0.2, h * 0.2); g.fillStyle = '#c83a2a'; g.fillRect(w * 0.15, h * 0.62, w * 0.3, 6); g.fillRect(w * 0.55, h * 0.62, w * 0.3, 6); }), roughness: 0.9, emissive: '#2a1004', emissiveIntensity: 0.2 });
        for (let i = 0; i < 14; i++) { const x = (R() - 0.5) * 130, z = -46 - R() * 70; if (Math.abs(x) < 14) continue; gableHouse(P, timber, snowy, x, B, z, 5 + R() * 2, 4 + R() * 2, 5, R() * 0.6 - 0.3, 0.6); }
        // the village church with its pointed spire
        P.add(k.mat({ color: '#f0ece4', roughness: 0.8 }), box(4, 12, 4, -26, B, -58));
        P.add(k.mat({ color: '#3a3a40', roughness: 0.6 }), new THREE.ConeGeometry(3, 7, 4).rotateY(Math.PI / 4), { x: -26, y: B + 15.5, z: -58 });
        gableHouse(P, k.mat({ color: '#f0ece4', roughness: 0.8 }), snowy, -26, B, -50, 6, 6, 9, 0, 0.6);
      },
    },

    // Dubai at dusk, from high up: the desert going pink, the city's towers lighting up, and
    // the tallest tower in the world straight ahead.
    desert: {
      drop: 3, fog: { color: '#d8907a', density: 0.003 },
      sky: { stops: ['#1a1a3e', '#4a3a6a', '#d8805a', '#f8c088'], haze: '#f0a880', below: '#c88a6a', clouds: 6, cloud: '#ffc8a0', sun: { az: -70, el: 3, size: 13, color: '#ffa060', glow: '#ff9a60' },
        far(g, W, HY) { g.fillStyle = '#c8806a'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 16) g.lineTo(x, HY - 3 - Math.abs(Math.sin(x * 0.01) * 6)); g.lineTo(W, HY + 2); g.fill(); } },
      build(k, P, G) {
        const B = G.y, S = B - 46, R = rng(53);
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => { speckle(g, w, h, '#d8a070', '#a87048', '#f0c090', 5000, 4); g.strokeStyle = 'rgba(140,80,40,0.2)'; g.lineWidth = 4; for (let y = 0; y < h; y += 40) { g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 24) g.lineTo(x, y + Math.sin(x * 0.02 + y) * 12); g.stroke(); } }), roughness: 1 }), ground(k, null, 165, S, 16));
        // city: towers of glass with lit floors, bands of light at the top
        const glass = ['#2a3a5a', '#3a4a6a', '#4a4a5a', '#2a4a5a'].map((b, i) => { const m = k.mat({ map: facadeTex(k, { base: b, rows: 40, cols: 8, kind: 'rect', lit: 0.5, seed: i * 5 + 3, light: '#ffe8c0', win: '#1a2030', w: 128, h: 1024 }), roughness: 0.3, metalness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.5 }); m.emissiveMap = m.map; m.color.set('#5a6a8a'); return m; });
        const roofM = k.mat({ color: '#2a2a34', roughness: 0.5 });
        for (let i = 0; i < 70; i++) {
          const a = (R() - 0.5) * 2.6, r = 50 + R() * 100, x = Math.sin(a) * r, z = -Math.cos(a) * r - 10, h = 20 + R() * 50;
          if (Math.abs(x) < 16 && z < -90 && z > -150) continue;
          const w = 5 + R() * 6;
          if (R() < 0.4) { P.add(glass[i % 4], new THREE.CylinderGeometry(w * 0.55, w * 0.6, h, 12, 1, true), { x, y: S + h / 2, z }); P.add(roofM, new THREE.ConeGeometry(w * 0.55, w * 0.8, 12), { x, y: S + h + w * 0.4, z }); }
          else block(P, glass[i % 4], roofM, x, S, z, w, h, w, R());
          if (R() < 0.5) G.glows.push([x, S + h + 1, z, R() < 0.5 ? '#ff5a4a' : '#ffe0a0', 1.8]);
        }
        // the great tower: setbacks spiralling up in three wings, then the spire
        const burj = k.mat({ map: facadeTex(k, { base: '#8aa0b8', rows: 60, cols: 6, kind: 'rect', lit: 0.55, light: '#fff0d0', win: '#2a3448', w: 128, h: 1024, trim: '#c8d4e0' }), roughness: 0.25, metalness: 0.6, emissive: '#ffffff', emissiveIntensity: 0.35 });
        burj.emissiveMap = burj.map;
        const TZ = -122;
        let y = S, rad = 9;
        for (let i = 0; i < 9; i++) {
          const h = 16 - i * 0.8;
          for (let w = 0; w < 3; w++) { const a = w / 3 * TAU + i * 0.35, wx = Math.cos(a) * rad * 0.5, wz = Math.sin(a) * rad * 0.5; if (i < 8 - w * 2) P.add(burj, new THREE.CylinderGeometry(rad * 0.42, rad * 0.46, h, 10), { x: wx, y: y + h / 2, z: TZ + wz }); }
          P.add(burj, new THREE.CylinderGeometry(rad * 0.48, rad * 0.5, h, 12), { y: y + h / 2, z: TZ });
          y += h; rad *= 0.82;
        }
        P.add(k.mat({ color: '#d8e0e8', metalness: 0.9, roughness: 0.2 }), new THREE.CylinderGeometry(0.3, rad * 0.4, 34, 8), { y: y + 17, z: TZ });
        G.glows.push([0, y + 34, TZ, '#ff5a4a', 4], [0, y + 8, TZ, '#fff0d0', 6]);
        // the lake and its fountain at the foot of the tower
        P.add(k.mat({ color: '#1a2a4a', roughness: 0.05, metalness: 0.2, emissive: '#2a3a6a', emissiveIntensity: 0.5 }), new THREE.CircleGeometry(26, 40).rotateX(-Math.PI / 2), { y: S + 0.1, z: TZ + 30 });
        for (let i = 0; i < 9; i++) G.glows.push([-16 + i * 4, S + 6 + (i % 3) * 3, TZ + 30, '#e8f4ff', 3]);
        // dunes beyond the city, a camel train on the ridge
        const sandM = k.mat({ color: '#d89868', roughness: 1, flatShading: true });
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, r = 150; mountain(P, sandM, Math.sin(a) * r, S, -Math.cos(a) * r, 30 + R() * 20, 8 + R() * 6, i + 30, { sides: 7, rough: 0.2, s: [1.6, 1, 1] }); }
      },
    },

    // The Crystal Palace, 1851: a vaulted hall of glass and iron, elms and palms growing
    // inside, a crystal fountain in the transept and flags of every nation overhead.
    crystal: {
      outdoor: true, fog: { color: '#a8bccc', density: 0.0016 },
      sky: { stops: ['#5a8ac8', '#8ab4e0', '#d8e8f4', '#f4f4f0'], haze: '#e8eef0', below: '#a8b8a8', clouds: 14, cloud: '#ffffff', sun: { az: 30, el: 46, size: 9, color: '#ffffff' } },
      build(k, P, G) {
        const B = G.y, R = rng(59);
        P.add(k.mat({ map: k.tile(256, 256, (g, w, h) => { courses(g, w, h, '#e8e0d0', 'rgba(120,110,90,0.4)', 2, 2, 3, 0.06); }), roughness: 0.6 }), ground(k, null, 165, B, 8));
        // the nave runs away from us; the transept crosses here, under the great arched roof
        const iron = k.mat({ color: '#3a5a7a', roughness: 0.5, metalness: 0.6 });
        const glassM = k.own(new THREE.MeshStandardMaterial({ color: '#9ac0e0', roughness: 0.1, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
        const lat = k.own(new THREE.MeshStandardMaterial({ map: latticeTex(k, '#4a6a8a', [1, 1]), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.5 }));
        const vault = (len, r, y0, along) => {
          // a half cylinder of glass with ribs, along z (nave) or x (transept)
          const g = new THREE.CylinderGeometry(r, r, len, 32, 1, true, Math.PI / 2, Math.PI);
          const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 24, uv.getY(i) * len / 4);
          const o = along === 'z' ? { rx: Math.PI / 2, ry: 0 } : { rx: Math.PI / 2, ry: Math.PI / 2 };
          P.add(glassM, g.clone(), Object.assign({ y: y0 }, o)); P.add(lat, g, Object.assign({ y: y0 }, o));
        };
        const H0 = B + 22, W = 22;
        // side walls of the nave: tiers of glass between iron columns
        for (const s of [-1, 1]) {
          const g = new THREE.PlaneGeometry(320, 22); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 80, uv.getY(i) * 6);
          P.add(lat, g.clone(), { x: s * W, y: B + 11, z: -60, ry: Math.PI / 2 }); P.add(glassM, g, { x: s * W, y: B + 11, z: -60, ry: Math.PI / 2 });
          for (let z = 100; z > -220; z -= 8) { if (Math.abs(z) < 24) continue; P.add(iron, new THREE.CylinderGeometry(0.3, 0.36, 22, 8), { x: s * W, y: B + 11, z }); }
        }
        vault(320, W, H0, 'z');
        // the transept: a taller vault across, with the elm trees kept inside
        for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(48, 30); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 12, uv.getY(i) * 8); P.add(lat, g, { x: s * 80, y: B + 15, ry: Math.PI / 2 }); }
        vault(160, 24, B + 30, 'x');
        for (let x = -78; x <= 78; x += 8) for (const s of [-1, 1]) if (Math.abs(x) > W) P.add(iron, new THREE.CylinderGeometry(0.3, 0.36, 30, 8), { x, y: B + 15, z: s * 24 });
        // galleries along the nave with red cloth
        const cloth = k.mat({ color: '#8a1a2a', roughness: 0.9 });
        for (const s of [-1, 1]) { P.add(cloth, box(3, 1.2, 280, s * (W - 1.6), B + 9, -80)); }
        // the crystal fountain: tiers of cut glass
        const crys = k.own(new THREE.MeshPhysicalMaterial({ color: '#f4fbff', roughness: 0.02, metalness: 0, transmission: 0.6, thickness: 0.5, ior: 1.5, iridescence: 0.4, emissive: '#6a8aa0', emissiveIntensity: 0.25 }));
        const FZ = -44;
        P.add(k.mat({ color: '#9aa8b0', roughness: 0.5 }), new THREE.CylinderGeometry(7, 7.4, 1, 32), { y: B + 0.5, z: FZ });
        P.add(crys, lathe([[0.6, 0], [0.4, 3], [3.6, 3.4], [3.8, 3.8], [0.4, 4.2], [0.3, 7], [2.2, 7.3], [2.4, 7.6], [0.25, 7.9], [0.2, 10], [1.0, 10.2], [0.1, 11.4], [0, 11.6]], 24), { y: B + 1, z: FZ });
        G.glows.push([0, B + 12, FZ, '#e8f8ff', 5], [0, B + 8, FZ, '#e8f8ff', 4]);
        // palms and elms, and marble statues down the nave
        const trunk = k.mat({ color: '#6a4a2e', roughness: 1 }), frond = k.own(new THREE.MeshStandardMaterial({ map: frondTexture(k, '#3a6a2a'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.9 }));
        for (const [x, z] of [[-14, -20], [14, -20], [-14, -70], [14, -70], [-14, 14], [14, 14]]) { P.add(k.mat({ color: '#2a4a5a', roughness: 0.5 }), lathe([[1.4, 0], [1.6, 1.4], [1.8, 1.6]], 12), { x, y: B, z }); palmTree(k, P, trunk, frond, x, B + 1.4, z, 9, 0.05, (R() * 9) | 0); }
        const elm = k.mat({ color: '#3a6a2a', roughness: 1, flatShading: true });
        for (const s of [-1, 1]) { P.add(trunk, new THREE.CylinderGeometry(0.8, 1.1, 14, 8), { x: s * 46, y: B + 7, z: 0 }); P.add(elm, new THREE.IcosahedronGeometry(9, 1), { x: s * 46, y: B + 19, z: 0, s: [1, 1.1, 1] }); }
        const marble = k.mat({ color: '#f4f0ea', roughness: 0.4 });
        for (let z = -90; z > -200; z -= 22) for (const s of [-1, 1]) { P.add(marble, box(1.8, 2, 1.8, s * 10, B, z)); P.add(marble, lathe([[0.5, 0], [0.7, 1], [0.6, 2.4], [0.8, 3.4], [0.4, 3.8], [0.45, 4.3], [0, 4.6]], 10), { x: s * 10, y: B + 2, z }); }
        // flags hung from the vault
        const flagCols = [['#c8202a', '#ffffff'], ['#1a3a8a', '#ffffff'], ['#1a7a3a', '#f4c040'], ['#f4c040', '#c8202a'], ['#ffffff', '#1a3a8a']];
        flagCols.forEach(([a, b], i) => { const fm = k.mat({ map: k.tex(64, 128, (g, w, h) => { g.fillStyle = a; g.fillRect(0, 0, w, h); g.fillStyle = b; g.fillRect(0, h * 0.4, w, h * 0.2); g.fillRect(w * 0.4, 0, w * 0.2, h); }), side: THREE.DoubleSide, roughness: 0.9 }); for (const s of [-1, 1]) P.add(fm, new THREE.PlaneGeometry(3, 6), { x: s * (6 + i * 3), y: B + 26, z: -30 - i * 18, ry: Math.PI / 2 }); });
      },
    },

    // Iceland: a frozen lake under green and violet northern lights, a lone horn-shaped
    // mountain, glass huts glowing warm on the shore.
    aurora: {
      outdoor: true, fog: { color: '#0a1a28', density: 0.004 },
      sky: { stops: ['#02040c', '#061430', '#0a2a3a', '#1a3a4a'], haze: '#1a3a4a', below: '#0a1a28', stars: 520 },
      build(k, P, G, group) {
        const B = G.y, R = rng(61);
        const snowT = k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#8a9ab8', '#5a6a8a', '#b8c8e0', 1800, 2));
        P.add(k.mat({ map: snowT, roughness: 0.9, emissive: '#0a2a2a', emissiveIntensity: 0.4 }), ground(k, null, 165, B, 10, [[-90, -24, 90, -126]]));
        // mountains round the lake, the horn-shaped one ahead
        const rock = peakMat(k, '#1e2430', '#a8bcd8', 0.4, { emissive: '#0a2a2a', emissiveIntensity: 0.25, envMapIntensity: 0.05 });
        const hg = new THREE.ConeGeometry(30, 60, 7, 6), hp = hg.attributes.position;
        for (let i = 0; i < hp.count; i++) { const t = (hp.getY(i) + 30) / 60; hp.setX(i, hp.getX(i) * (1 - 0.3 * Math.sin(t * 3)) + t * t * 8); }
        const hn = hg.toNonIndexed(); hn.computeVertexNormals();
        P.add(rock, hn, { x: 10, y: B + 26, z: -150, s: [1, 0.85, 1] });
        for (let i = 0; i < 14; i++) { const a = R() * TAU, r = 135 + R() * 30; if (Math.abs(Math.sin(a)) < 0.2 && Math.cos(a) > 0) continue; mountain(P, rock, Math.sin(a) * r, B, -Math.cos(a) * r, 30 + R() * 20, 16 + R() * 18, i + 70, { sides: 12, rough: 0.25 }); }
        // glass huts on the shore, each lit from inside
        const hutGlass = k.own(new THREE.MeshPhysicalMaterial({ color: '#c8e8ff', roughness: 0.05, transparent: true, opacity: 0.35, emissive: '#ffc070', emissiveIntensity: 0.5, side: THREE.DoubleSide }));
        for (const [x, z] of [[-30, -16], [-38, 2], [32, -12], [40, 6], [24, 26]]) { P.add(hutGlass, new THREE.SphereGeometry(3, 18, 10, 0, TAU, 0, Math.PI / 2), { x, y: B, z }); P.add(k.glowMat('#ffc070', 1.2), new THREE.CylinderGeometry(1.4, 1.4, 0.8, 12), { x, y: B + 0.4, z }); G.glows.push([x, B + 1.4, z, '#ffb860', 5]); }
        // birch trees, bare in winter
        const birch = k.mat({ color: '#d8dce4', roughness: 0.9 });
        for (let i = 0; i < 30; i++) { const a = R() * TAU, r = 22 + R() * 40, x = Math.sin(a) * r, z = -Math.cos(a) * r; if (z < -26 && Math.abs(x) < 60) continue; P.add(birch, K.tube([[x, B, z], [x + 0.3, B + 3, z], [x - 0.2, B + 6, z + 0.3]], 0.14, { segs: 6, radial: 5 })); }
        // the northern lights: soft curtains of light folded across the sky
        const curtain = (col, col2) => k.tex(512, 256, (g, w, h) => {
          g.clearRect(0, 0, w, h);
          for (let x = 0; x < w; x += 2) { const a = 0.35 + 0.35 * Math.sin(x * 0.05) * Math.sin(x * 0.013 + 1); const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, rgba(col2, 0)); grd.addColorStop(0.5, rgba(col2, a * 0.5)); grd.addColorStop(0.85, rgba(col, a)); grd.addColorStop(1, rgba(col, 0)); g.fillStyle = grd; g.fillRect(x, 0, 2, h); }
        });
        const bands = [['#3affa0', '#8a5aff', -30, 100, 70, 0], ['#40ffc0', '#40a0ff', 40, 110, 60, 1.4], ['#80ff80', '#d05aff', -80, 130, 50, 2.6]];
        for (const [c1, c2, x0, z0, h, ph] of bands) {
          const m = k.own(new THREE.MeshBasicMaterial({ map: curtain(c1, c2), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false }));
          const g = new THREE.PlaneGeometry(220, h, 60, 1), p = g.attributes.position;
          for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(x * 0.03 + ph) * 20 + Math.sin(x * 0.011) * 10); }
          const mesh = new THREE.Mesh(g, m); mesh.position.set(x0 * 0.3, B + 18 + h / 2, -z0); mesh.rotation.x = -0.25; mesh.renderOrder = -7;
          group.add(mesh);
        }
        const ice = k.mat({ map: k.tile(256, 256, (g, w, h) => { g.fillStyle = '#1a3448'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(200,240,255,0.25)'; g.lineWidth = 1.5; const r2 = rng(3); for (let i = 0; i < 14; i++) { g.beginPath(); g.moveTo(r2() * w, r2() * h); for (let j = 0; j < 4; j++) g.lineTo(r2() * w, r2() * h); g.stroke(); } }), roughness: 0.15, metalness: 0.3, emissive: '#0a3a3a', emissiveIntensity: 0.6 });
        { const gg = new THREE.PlaneGeometry(180, 102).rotateX(-Math.PI / 2); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 4); P.add(ice, gg.translate(0, B - 0.2, -75)); }
      },
    },

    // Neuschwanstein: across a wooded gorge, the white castle with blue-grey towers on its
    // crag, the Alps behind and a lake below, in late golden light.
    castle: {
      outdoor: true, fog: { color: '#b8b8c8', density: 0.004 },
      sky: { stops: ['#2a4a8a', '#6a8ac0', '#f0b8a0', '#f8d8b8'], haze: '#f0c8b0', below: '#2e4a34', clouds: 10, cloud: '#fff0e0', sun: { az: -55, el: 10, size: 11, color: '#ffd090', glow: '#ffb880' },
        far(g, W, HY) {
          // the Alps: two blue ranges, the far one capped with snow
          const ridge = (x, amp, f, off) => HY - off - Math.abs(Math.sin(x * f) * amp + Math.sin(x * f * 5.3) * amp * 0.22);
          g.save(); g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 6) g.lineTo(x, ridge(x, 90, 0.0042, 18)); g.lineTo(W, HY + 2); g.closePath();
          g.fillStyle = '#7a88a8'; g.fill(); g.clip(); g.fillStyle = vgrad(g, HY - 120, HY - 50, ['#f4f6fa', '#e0e6f0', 'rgba(224,230,240,0)']); g.fillRect(0, 0, W, HY - 50); g.restore();
          g.fillStyle = '#5a6a84'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 6) g.lineTo(x, ridge(x + 300, 40, 0.007, 6)); g.lineTo(W, HY + 2); g.fill();
          // the dark forest of the valley floor
          g.fillStyle = '#2e4a34'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 6) g.lineTo(x, HY - 3 - Math.abs(Math.sin(x * 0.03)) * 4); g.lineTo(W, HY + 2); g.fill();
        } },
      build(k, P, G) {
        const B = G.y, R = rng(67);
        const meadow = k.mat({ map: k.tile(512, 512, (g, w, h) => { speckle(g, w, h, '#5a8a3a', '#3a6a2a', '#7aa84a', 5000, 5); for (let i = 0; i < 300; i++) { g.fillStyle = ['#ffffff', '#f4d040', '#d06a8a'][i % 3]; g.fillRect((i * 97) % w, (i * 53) % h, 3, 3); } }), roughness: 1 });
        P.add(meadow, ground(k, null, 40, B, 10));
        const forest = k.mat({ map: k.tile(256, 256, (g, w, h) => speckle(g, w, h, '#2a4a2a', '#1a3a1a', '#3a5a2a', 4000, 6)), roughness: 1, flatShading: true });
        P.add(forest, ground(k, null, 165, B - 40, 10));
        // the crag and the castle on it
        const rockM = peakMat(k, '#5a6050', null, 0, { envMapIntensity: 0.1 });
        const crag = new THREE.CylinderGeometry(19, 30, 34, 9, 4), cp = crag.attributes.position;
        for (let i = 0; i < cp.count; i++) { if (cp.getY(i) > 16) continue; const f = 1 + (R() - 0.5) * 0.3; cp.setX(i, cp.getX(i) * f); cp.setZ(i, cp.getZ(i) * f); }
        const cn = crag.toNonIndexed(); cn.computeVertexNormals();
        const CX = 10, CZ = -100, CY = B - 40 + 34;
        P.add(rockM, cn, { x: CX, y: B - 40 + 17, z: CZ });
        const white = k.mat({ map: facadeTex(k, { base: '#f0ece4', rows: 4, cols: 4, kind: 'arch', frame: '#d8d0c4', win: '#4a4a5a', lit: 0.2, light: '#ffd890', w: 256, h: 512 }), roughness: 0.8, emissive: '#2a2010', emissiveIntensity: 0.25 });
        const slate = k.mat({ color: '#5a6a8a', roughness: 0.5, metalness: 0.2 });
        const gold = k.mat({ color: '#e8c060', metalness: 0.9, roughness: 0.3 });
        const tower = (x, z, r, h, cone) => { P.add(white, new THREE.CylinderGeometry(r, r, h, 16), { x: CX + x, y: CY + h / 2, z: CZ + z }); P.add(slate, new THREE.ConeGeometry(r * 1.15, cone || r * 3, 16), { x: CX + x, y: CY + h + (cone || r * 3) / 2, z: CZ + z }); P.add(gold, new THREE.ConeGeometry(0.15, 1.6, 6), { x: CX + x, y: CY + h + (cone || r * 3) + 0.6, z: CZ + z }); };
        // the palace block with its steep roof, the keep, and the cluster of turrets
        // the palace seen from the side, long and tall under a steep slate roof, its keep and
        // gatehouse in front and a crowd of slim turrets with pointed caps
        P.add(white, box(26, 20, 9, CX, CY, CZ - 4));
        P.add(slate, K.extrude([[-5, 0], [5, 0], [0, 8]], 26.4, 0), { x: CX, y: CY + 20, z: CZ - 4, ry: Math.PI / 2 });
        for (let i = 0; i < 4; i++) P.add(white, K.extrude([[-2, 0], [2, 0], [2, 3], [0, 5], [-2, 3]], 0.8, 0), { x: CX - 9 + i * 6, y: CY + 20, z: CZ + 0.6 });
        tower(-14, -4, 2.4, 28, 8); tower(13.5, -5, 3.4, 30, 11); tower(-9, 6, 1.4, 22, 5); tower(16, 4, 1.6, 24, 6); tower(9, 2.5, 1.1, 30, 5); tower(-16, 5, 1.0, 20, 4);
        P.add(white, box(10, 12, 7, CX - 4, CY, CZ + 7)); tower(-9.6, 10, 2.2, 15, 6); tower(1.6, 10, 2.2, 15, 6);
        P.add(k.mat({ color: '#c88a6a', roughness: 0.8 }), box(7, 8, 6, CX - 4, CY, CZ + 13));
        // the Alps behind, the lake below, pines in the gorge
        P.add(k.mat({ color: '#4a6a8a', roughness: 0.1, metalness: 0.2, emissive: '#1a2a3a', emissiveIntensity: 0.4 }), new THREE.CircleGeometry(40, 32).rotateX(-Math.PI / 2), { x: -60, y: B - 39.8, z: -110 });
        const pineM = k.mat({ color: '#1e3a24', roughness: 1, flatShading: true });
        for (let i = 0; i < 120; i++) { const a = R() * TAU, r = 42 + R() * 100, x = Math.sin(a) * r, z = -Math.cos(a) * r; if (Math.hypot(x - CX, z - CZ) < 24) continue; pine(P, pineM, x, B - 40, z, 7 + R() * 6); }
        // the meadow's edge: a wooden fence and wild flowers, pines behind us
        const wood = k.mat({ color: '#6a4a2e', roughness: 0.9 });
        for (let a = -0.9; a <= 0.9; a += 0.08) { const x = Math.sin(a) * 36, z = -Math.cos(a) * 36; P.add(wood, box(0.3, 1.6, 0.3, x, B, z)); }
        for (let i = 0; i < 40; i++) { const a = Math.PI + (R() - 0.5) * 3, r = 24 + R() * 14; pine(P, pineM, Math.sin(a) * r, B, -Math.cos(a) * r, 8 + R() * 5); }
      },
    },

    // Stonehenge at dawn: we sit inside the circle; the great trilithons stand round us and
    // the sun comes up between the stones ahead.
    stonehenge: {
      outdoor: true, fog: { color: '#d8c0b0', density: 0.006 },
      sky: { stops: ['#2a3a5a', '#7a7a9a', '#f0b890', '#f8d8a8'], haze: '#f0c8a0', below: '#a8a088', clouds: 10, cloud: '#ffe0c8', sun: { az: 22, el: 4, size: 13, color: '#ffc070', glow: '#ffb070' },
        far(g, W, HY) { g.fillStyle = '#8a8a7a'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 16) g.lineTo(x, HY - 3 - Math.abs(Math.sin(x * 0.004) * 6)); g.lineTo(W, HY + 2); g.fill(); } },
      build(k, P, G) {
        const B = G.y, R = rng(71);
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#6a7a44', '#4a5a2a', '#8a9a5a', 6000, 3)), roughness: 1 }), ground(k, null, 165, B, 10));
        const sarsenT = k.tile(128, 256, (g, w, h) => { speckle(g, w, h, '#8a867a', '#5a584e', '#b8b4a4', 2400, 4); for (let i = 0; i < 30; i++) { g.fillStyle = rgba(i % 2 ? '#7a8a4a' : '#c8c0a0', 0.25); g.beginPath(); g.ellipse((i * 37) % w, (i * 71) % h, 6 + (i % 5) * 3, 3 + (i % 3) * 2, 0, 0, TAU); g.fill(); } });
        const sarsen = k.mat({ map: sarsenT, roughness: 1, flatShading: true });
        const stone = (x, z, w, h, d, ry, tilt) => {
          const g = new THREE.BoxGeometry(w, h, d, 2, 3, 2), p = g.attributes.position;
          for (let i = 0; i < p.count; i++) { p.setX(i, p.getX(i) * (1 + (R() - 0.5) * 0.18)); p.setZ(i, p.getZ(i) * (1 + (R() - 0.5) * 0.18)); if (p.getY(i) > 0) p.setY(i, p.getY(i) + (R() - 0.5) * 0.4); }
          const ng = g.toNonIndexed(); ng.computeVertexNormals();
          P.add(sarsen, ng, { x, y: B + h / 2 - 0.4, z, ry, rz: tilt || 0 });
        };
        // the outer circle: thirty uprights capped by a ring of lintels, a few fallen
        const RO = 21, N = 30;
        for (let i = 0; i < N; i++) {
          const a = i / N * TAU, x = Math.sin(a) * RO, z = -Math.cos(a) * RO;
          if (i === 9 || i === 22) { P.add(sarsen, box(2.2, 1.2, 4.6, 0, 0, 0), { x: x * 1.08, y: B - 0.2, z: z * 1.08, ry: a + 0.3 }); continue; }
          stone(x, z, 2.2, 5.6, 1.3, -a);
          if (i % 7 !== 3) { const b = (i + 0.5) / N * TAU; P.add(sarsen, new THREE.BoxGeometry(4.8, 1, 1.1).toNonIndexed(), { x: Math.sin(b) * RO, y: B + 5.7, z: -Math.cos(b) * RO, ry: -b }); }
        }
        // the horseshoe of five trilithons, open towards the sunrise
        for (const [a, h] of [[-0.9, 6.4], [-0.45, 7.2], [0, 8.6], [0.45, 7.2], [0.9, 6.4]]) {
          const r = 14, x = Math.sin(a) * r, z = -Math.cos(a) * r, ry = -a, ox = Math.cos(a) * 1.6, oz = Math.sin(a) * 1.6;
          stone(x - ox, z - oz, 2.2, h, 1.6, ry); stone(x + ox, z + oz, 2.2, h, 1.6, ry);
          P.add(sarsen, new THREE.BoxGeometry(5.4, 1.2, 1.6).toNonIndexed(), { x, y: B + h + 0.2, z, ry });
        }
        // the bluestones inside, the heel stone out on the avenue, the bank and ditch
        const blue = k.mat({ color: '#5a6470', roughness: 1, flatShading: true });
        for (let i = 0; i < 24; i++) { const a = i / 24 * TAU, r = 17.4; if (i % 5 === 2) continue; P.add(blue, new THREE.BoxGeometry(0.9, 2.4, 0.7).toNonIndexed(), { x: Math.sin(a) * r, y: B + 0.9, z: -Math.cos(a) * r, ry: -a, rz: (R() - 0.5) * 0.1 }); }
        stone(0, -60, 2.6, 5, 2.2, 0.2, 0.15);
        P.add(k.mat({ color: '#5a6a3a', roughness: 1 }), new THREE.TorusGeometry(52, 1.6, 6, 80).rotateX(Math.PI / 2).scale(1, 0.5, 1), { y: B });
        // the avenue's banks running to the sunrise, round barrows on the downs
        const turf = k.mat({ color: '#5a6a34', roughness: 1, flatShading: true });
        for (const s of [-1, 1]) P.add(turf, box(1.4, 0.6, 120, s * 6, B, -120));
        for (let i = 0; i < 10; i++) { const a = R() * TAU, r = 90 + R() * 50; P.add(turf, new THREE.SphereGeometry(5 + R() * 4, 12, 6, 0, TAU, 0, Math.PI / 2).scale(1, 0.4, 1), { x: Math.sin(a) * r, y: B, z: -Math.cos(a) * r }); }
        // a fire burning low by the stones
        G.glows.push([-9, B + 0.8, 8, '#ff8a3a', 3]);
      },
    },

    // Mohenjo-daro: a courtyard of fired brick by the Great Bath, flat-roofed brick houses
    // in straight streets and the stupa mound of the citadel above.
    indus: {
      outdoor: true, fog: { color: '#d8b890', density: 0.0028 },
      sky: { stops: ['#4a6a9a', '#8aa8c8', '#e8d8b8', '#f4e4c8'], haze: '#f0dcb8', below: '#c8a07a', clouds: 6, cloud: '#ffffff', sun: { az: -40, el: 22, size: 10, color: '#fff0d0' },
        far(g, W, HY) { g.fillStyle = '#a8906a'; g.fillRect(0, HY - 4, W, 6); } },
      build(k, P, G) {
        const B = G.y, R = rng(73);
        const brickT = (base, rep) => k.tile(256, 128, (g, w, h) => courses(g, w, h, base, 'rgba(70,30,14,0.55)', 8, 4, 6, 0.16), rep);
        const brick = k.mat({ map: brickT('#b8703e'), roughness: 0.95, side: THREE.DoubleSide });
        P.add(k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#a87a4e', '#7a5434', '#c49466', 4000, 6)), roughness: 1 }), ground(k, null, 165, B, 10));
        P.add(k.mat({ map: brickT('#c07a48'), roughness: 0.95 }), ground(k, null, 32, B + 0.02, 3, [[-14, -26, 14, -56]]));
        // the Great Bath: a sunken pool with steps down at each end, a brick colonnade round it
        const Z = -41, Lp = 26, Wp = 24;
        P.add(k.mat({ color: '#3a6a8a', roughness: 0.05, metalness: 0.2, emissive: '#1a3a4a', emissiveIntensity: 0.4 }), new THREE.PlaneGeometry(Wp, Lp).rotateX(-Math.PI / 2), { y: B - 2.2, z: Z });
        prism([[-Wp / 2, Z + Lp / 2], [Wp / 2, Z + Lp / 2], [Wp / 2, Z - Lp / 2], [-Wp / 2, Z - Lp / 2]].reverse(), B - 2.4, B).forEach((g) => P.add(brick, g));
        for (let i = 0; i < 5; i++) for (const s of [-1, 1]) P.add(brick, box(6, 0.45, 0.8, 0, B - 2.4 + i * 0.45, Z + s * (Lp / 2 - 0.4 - (4 - i) * 0.8)));
        for (let i = 0; i < 9; i++) for (const [x, z] of [[-Wp / 2 - 2, Z - Lp / 2 + i * Lp / 8], [Wp / 2 + 2, Z - Lp / 2 + i * Lp / 8]]) P.add(brick, box(1.4, 4.4, 1.4, x, B, z));
        for (const s of [-1, 1]) P.add(k.mat({ color: '#6a4a2a', roughness: 0.9 }), box(3, 0.4, Lp + 3, s * (Wp / 2 + 2), B + 4.4, Z));
        // streets of houses: plain brick boxes with small windows and flat roofs
        const house = [brickT('#b06a3c', [2, 1]), brickT('#c48450', [2, 1]), brickT('#a8603a', [2, 1])].map((t) => k.mat({ map: t, roughness: 0.95 }));
        const roof = k.mat({ color: '#8a6a4a', roughness: 1 });
        for (let gx = -6; gx <= 6; gx++) for (let gz = 0; gz < 7; gz++) {
          const x = gx * 14 + (R() - 0.5) * 2, z = -70 - gz * 14;
          if (Math.abs(x) < 20 && z > -80) continue;
          if (R() < 0.15) continue;
          const w = 9 + R() * 3, d = 9 + R() * 3, h = 4 + R() * 4;
          block(P, house[(gx + gz + 9) % 3], roof, x, B, z, w, h, d, 0);
        }
        // the lanes go on all round the courtyard: houses on every side, each with a dark doorway
        const door = k.mat({ color: '#2a1a10', roughness: 1 });
        for (let i = 0; i < 30; i++) {
          const a = i / 30 * TAU + (R() - 0.5) * 0.1, r = 38 + R() * 16, x = Math.sin(a) * r, z = -Math.cos(a) * r;
          if (Math.abs(x) < 16 && z < -26 && z > -58) continue;
          const hh = 3 + R() * 3.5;
          block(P, house[i % 3], roof, x, B, z, 8, hh, 8, -a);
          P.add(door, new THREE.PlaneGeometry(1.4, 2.2).translate(0, 1.1, 4.02).rotateY(-a + Math.PI).translate(x, B, z));
          if (R() < 0.5) P.add(roof, box(8.4, 0.5, 8.4, 0, 0, 0).rotateY(-a).translate(x, B + hh, z));
        }
        // the citadel mound with the brick stupa on top
        const mound = k.mat({ color: '#b08a60', roughness: 1, flatShading: true });
        P.add(mound, new THREE.CylinderGeometry(30, 46, 12, 10), { x: 40, y: B + 6, z: -150 });
        P.add(brick, lathe([[10, 0], [10, 3], [8.6, 3.2], [9.2, 6], [7.8, 9.6], [5, 12], [1.4, 13.2], [0, 13.4]], 20, 18), { x: 40, y: B + 12, z: -150 });
        // wells, a bullock cart, clay jars and a neem tree
        for (const [x, z] of [[-18, 6], [20, -8]]) { P.add(brick, new THREE.CylinderGeometry(1.4, 1.4, 1.1, 14, 1, true), { x, y: B + 0.55, z }); P.add(k.mat({ color: '#1a1a20' }), new THREE.CircleGeometry(1.3, 14).rotateX(-Math.PI / 2), { x, y: B + 0.9, z }); }
        const clay = k.mat({ color: '#c06a3a', roughness: 0.9 });
        for (let i = 0; i < 10; i++) { const a = R() * TAU, r = 14 + R() * 4; P.add(clay, lathe([[0.2, 0], [0.6, 0.3], [0.7, 0.9], [0.3, 1.4], [0.35, 1.6]], 10), { x: Math.sin(a) * r, y: B, z: -Math.cos(a) * r + 6 }); }
        const neem = k.mat({ color: '#4a6a2a', roughness: 1, flatShading: true }), bark = k.mat({ color: '#4a3a2a', roughness: 1 });
        for (const [x, z] of [[-26, -14], [28, 12], [-30, 18]]) { P.add(bark, new THREE.CylinderGeometry(0.5, 0.7, 6, 6), { x, y: B + 3, z }); P.add(neem, new THREE.IcosahedronGeometry(4, 1), { x, y: B + 8, z, s: [1.3, 0.9, 1.3] }); }
      },
    },

    // Machu Picchu: a grassy terrace among granite houses with thatched roofs, the green
    // terraces stepping down the ridge, Huayna Picchu rising straight ahead in the cloud.
    inca: {
      outdoor: true, fog: { color: '#b8c8cc', density: 0.0032 },
      sky: { stops: ['#3a5a8a', '#7a9ac0', '#d8e0e4', '#eef0ec'], haze: '#e8ece8', below: '#a8b8a8', clouds: 18, cloud: '#ffffff', sun: { az: 60, el: 34, size: 9, color: '#fffaf0' } },
      build(k, P, G) {
        const B = G.y, R = rng(79);
        const grass = k.mat({ map: k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#5a8a3a', '#3a6a2a', '#7aa84a', 5000, 7)), roughness: 1 });
        P.add(grass, ground(k, null, 26, B, 8));
        const granite = k.tile(256, 256, (g, w, h) => {
          g.fillStyle = '#7a766c'; g.fillRect(0, 0, w, h);
          const r2 = rng(5); let y = 0; while (y < h) { const rh = 18 + r2() * 20; let x = -r2() * 20; while (x < w) { const cw = 24 + r2() * 30; g.fillStyle = shade('#9a968a', (r2() - 0.5) * 0.3); g.fillRect(x + 1.5, y + 1.5, cw - 3, rh - 3); x += cw; } y += rh; }
        });
        const stoneM = k.mat({ map: granite, roughness: 0.95 });
        // the terraces stepping down in front and to the sides
        let y = B, r = 26;
        for (let i = 0; i < 8; i++) {
          const g = new THREE.CylinderGeometry(r, r, 3, 64, 1, true); const uv = g.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, uv.getX(j) * r / 2, uv.getY(j) * 0.4);
          P.add(stoneM, g, { y: y - 1.5 });
          const ring = new THREE.RingGeometry(r, r + 5, 64, 1).rotateX(-Math.PI / 2);
          y -= 3; r += 5;
          P.add(grass, ring, { y });
        }
        P.add(k.mat({ color: '#3a5a2a', roughness: 1 }), ground(k, null, 165, y - 40, 10));
        // Huayna Picchu, the sugarloaf peak, and the green mountains all round
        const peakG = k.mat({ map: k.tile(128, 256, (g, w, h) => { speckle(g, w, h, '#2e5a24', '#183a14', '#4a7a32', 2000, 3); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(110,110,100,0.7)'; g.fillRect((i * 31) % w, (i * 67) % h, 8, 18); } }), roughness: 1, flatShading: true, envMapIntensity: 0.1 });
        const hp = new THREE.CylinderGeometry(3, 26, 80, 12, 8), pp = hp.attributes.position;
        for (let i = 0; i < pp.count; i++) { const t = (pp.getY(i) + 40) / 80, f = 1 + Math.sin(t * Math.PI) * 0.3 + (R() - 0.5) * 0.3; pp.setX(i, pp.getX(i) * f + Math.sin(t * 5) * 3); pp.setZ(i, pp.getZ(i) * f); }
        const hn = hp.toNonIndexed(); hn.computeVertexNormals();
        P.add(peakG, hn, { x: 14, y: y - 40 + 40 + 20, z: -150 });
        for (let i = 0; i < 16; i++) { const a = R() * TAU, r2 = 110 + R() * 50; mountain(P, peakG, Math.sin(a) * r2, y - 40, -Math.cos(a) * r2, 30 + R() * 20, 60 + R() * 40, i + 90, { sides: 7, rough: 0.3 }); }
        // houses of fitted granite with steep thatched roofs, on the levels round us
        const thatch = k.mat({ map: k.tile(64, 64, (g, w, h) => { g.fillStyle = '#b89a5a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(80,60,30,0.5)'; for (let x = 0; x < w; x += 3) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 2, h); g.stroke(); } }), roughness: 1 });
        const houseAt = (x, yy, z, ry) => {
          const w = 6, d = 4.4, h = 3.4;
          P.add(stoneM, box(w, h, d, 0, 0, 0), { x, y: yy, z, ry });
          P.add(stoneM, K.extrude([[-d / 2, 0], [d / 2, 0], [0, 2.6]], 0.6, 0), { x: x + Math.cos(ry) * w / 2, y: yy + h, z: z - Math.sin(ry) * w / 2, ry: ry + Math.PI / 2 });
          P.add(thatch, K.extrude([[-d / 2 - 0.5, -0.2], [d / 2 + 0.5, -0.2], [0, 3.4]], w + 0.8, 0), { x, y: yy + h, z, ry: ry + Math.PI / 2 });
          P.add(k.mat({ color: '#2a2620' }), K.extrude([[-0.6, 0], [0.6, 0], [0.45, 2], [-0.45, 2]], 0.1, 0), { x: x + Math.sin(ry) * (d / 2 + 0.02), y: yy, z: z + Math.cos(ry) * (d / 2 + 0.02), ry });
        };
        for (const [a, rr] of [[-0.55, 21], [0.6, 22], [-0.35, 33], [0.3, 38], [-0.8, 44], [0.9, 29], [-2.3, 20], [2.4, 20], [-2.75, 29], [2.7, 34], [-1.7, 44], [1.8, 49], [-1.3, 39], [1.25, 54], [-2.95, 19], [3.0, 39], [0.75, 33], [-0.8, 38]]) {
          const lvl = rr < 26 ? 0 : Math.floor((rr - 26) / 5) + 1, yy = B - lvl * 3;
          houseAt(Math.sin(a) * rr, yy, -Math.cos(a) * rr, -a);
        }
        // the Intihuatana stone and a llama or two
        P.add(stoneM, K.extrude([[-1, 0], [1, 0], [1, 1.2], [0.4, 2.4], [-0.2, 2.4], [-1, 1]], 1.2, 0.05), { x: -18, y: B, z: 12 });
        const wool = k.mat({ color: '#f0e8dc', roughness: 1 }), wool2 = k.mat({ color: '#8a5a3a', roughness: 1 });
        for (const [x, z, ry, m] of [[16, 10, 0.6, wool], [20, 14, -0.4, wool2], [-22, -4, 2.2, wool]]) {
          P.add(m, new THREE.CapsuleGeometry(0.5, 1.2, 4, 8).rotateZ(Math.PI / 2), { x, y: B + 1.4, z, ry });
          P.add(m, new THREE.CapsuleGeometry(0.22, 1.1, 4, 8), { x: x + Math.cos(ry) * 0.9, y: B + 2.2, z: z - Math.sin(ry) * 0.9, ry });
          for (const [dx, dz] of [[-0.5, -0.25], [-0.5, 0.25], [0.5, -0.25], [0.5, 0.25]]) P.add(m, new THREE.CylinderGeometry(0.1, 0.1, 1, 5), { x: x + Math.cos(ry) * dx + Math.sin(ry) * dz, y: B + 0.5, z: z - Math.sin(ry) * dx + Math.cos(ry) * dz });
        }
      },
    },

    // Brussels: the chocolate shop's windows face the Grand-Place at evening, the guild
    // houses with their gilded gables round the square and the Town Hall's spire ahead.
    grandplace: {
      drop: 2, fog: { color: '#2a2a48', density: 0.005 },
      sky: { stops: ['#0a1030', '#1e2a5a', '#5a4a7a', '#c88a7a'], haze: '#8a6a7a', below: '#2a2a48', stars: 120, moon: { az: -20, el: 24, size: 5, color: '#fff2d8' } },
      build(k, P, G) {
        const B = G.y, R = rng(83);
        P.add(k.mat({ map: k.tile(256, 256, (g, w, h) => { g.fillStyle = '#6a6460'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 * 8; x < w; x += 16) { g.fillStyle = shade('#7a7470', (R() - 0.5) * 0.3); g.fillRect(x + 1, y + 1, 14, 14); } }), roughness: 0.6 }), ground(k, null, 165, B, 6));
        // the guild houses: tall narrow fronts with stepped and scrolled gables, gilded
        const gold = k.mat({ color: '#e8c060', metalness: 0.9, roughness: 0.25, emissive: '#5a3a08', emissiveIntensity: 0.6 });
        const fronts = ['#d8c8a8', '#a8a4a0', '#c8b088', '#8a7a6a', '#e0d4bc'].map((base, i) => k.mat({ map: facadeTex(k, { base, rows: 5, cols: 3, kind: i % 2 ? 'arch' : 'rect', lit: 0.6, frame: '#e8c060', trim: '#e8c060', light: '#ffd890', win: '#1a1a24', seed: i * 11 + 2, w: 256, h: 512, balcony: 0.4 }), roughness: 0.8, emissive: '#1a1418', emissiveIntensity: 0.45 }));
        const house = (x, z, ry, w, h, i) => {
          P.add(fronts[i % 5], box(w, h, 8, 0, 0, 0), { x, y: B, z, ry });
          const gable = [[-w / 2, 0], [w / 2, 0], [w / 2, 2], [w * 0.32, 2], [w * 0.32, 4], [w * 0.16, 4], [w * 0.16, 6], [0, 7], [-w * 0.16, 6], [-w * 0.16, 4], [-w * 0.32, 4], [-w * 0.32, 2], [-w / 2, 2]];
          const c = Math.cos(ry), s = Math.sin(ry);
          P.add(fronts[i % 5], K.extrude(gable, 0.8, 0), { x: x + s * 3.6, y: B + h, z: z + c * 3.6, ry });
          P.add(gold, new THREE.SphereGeometry(0.5, 10, 8), { x: x + s * 4.1, y: B + h + 7.2, z: z + c * 4.1 });
          P.add(gold, box(w * 0.9, 0.3, 0.3, 0, 0, 0), { x: x + s * 4.05, y: B + h - 0.2, z: z + c * 4.05, ry });
        };
        // round the square: our side is behind us; three sides face us
        const SQ = 34;
        let n = 0;
        for (const [ox, oz, ry, len] of [[-SQ, 0, Math.PI / 2, 70], [SQ, 0, -Math.PI / 2, 70]]) for (let t = -len / 2 + 4; t < len / 2; t += 7.4) house(ox, -40 + t, ry, 7, 14 + R() * 6, n++);
        // the Town Hall straight ahead: a long Gothic front and its lacy tower
        const hall = k.mat({ map: facadeTex(k, { base: '#c8b898', rows: 4, cols: 14, kind: 'pointed', lit: 0.65, frame: '#efe4cc', trim: '#efe4cc', light: '#ffd890', w: 1024, h: 384 }), roughness: 0.8, color: '#9a8c80', emissive: '#2a2014', emissiveIntensity: 0.4 });
        const HZ = -82;
        P.add(hall, box(64, 18, 12, 0, B, HZ));
        P.add(k.mat({ color: '#3a4a5a', roughness: 0.6 }), K.extrude([[-6.4, 0], [6.4, 0], [0, 8]], 64, 0), { y: B + 18, z: HZ, ry: Math.PI / 2 });
        for (let i = 0; i < 14; i++) P.add(gold, new THREE.ConeGeometry(0.4, 2.4, 6), { x: -30 + i * 4.6, y: B + 19.2, z: HZ + 6.4 });
        const towerM = k.mat({ map: facadeTex(k, { base: '#c8b898', rows: 12, cols: 3, kind: 'pointed', lit: 0.5, frame: '#efe4cc', light: '#ffd890', w: 128, h: 512 }), roughness: 0.8, color: '#9a8c80', emissive: '#2a2014', emissiveIntensity: 0.4 });
        P.add(towerM, box(8, 30, 8, 0, B, HZ + 8.2));
        const oct = (r) => Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU + TAU / 16; return [Math.cos(a) * r, HZ + 8.2 + Math.sin(a) * r]; });
        prism(oct(3.6), B + 30, B + 40).forEach((g) => P.add(towerM, g));
        prism(oct(2.6), B + 40, B + 48).forEach((g) => P.add(towerM, g));
        P.add(k.own(new THREE.MeshStandardMaterial({ map: latticeTex(k, '#d8c8a8'), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 })), new THREE.ConeGeometry(2.6, 14, 8, 1, true), { y: B + 55, z: HZ + 8.2 });
        P.add(gold, new THREE.ConeGeometry(0.5, 3, 6), { y: B + 63.6, z: HZ + 8.2 });
        // the flower carpet laid in the square, and lamps
        P.add(k.mat({ map: k.tex(512, 512, (g, w, h) => {
          g.fillStyle = '#3a6a2a'; g.fillRect(0, 0, w, h);
          const cols = ['#c8202a', '#f4c040', '#f4f0e8', '#d06a9a', '#e8783a'];
          for (let r = 0; r < 6; r++) { g.strokeStyle = cols[r % 5]; g.lineWidth = 22; g.beginPath(); g.arc(w / 2, h / 2, 40 + r * 36, 0, TAU); g.stroke(); }
          for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.fillStyle = cols[i % 5]; g.beginPath(); g.ellipse(w / 2 + Math.cos(a) * 100, h / 2 + Math.sin(a) * 100, 30, 14, a, 0, TAU); g.fill(); }
        }), roughness: 1 }), new THREE.PlaneGeometry(40, 30).rotateX(-Math.PI / 2), { y: B + 0.03, z: -48 });
        const post = k.mat({ color: '#1a1a20', roughness: 0.5, metalness: 0.6 });
        for (const [x, z] of [[-24, -18], [24, -18], [-24, -64], [24, -64], [-12, -72], [12, -72]]) lamp(k, P, post, x, B, z, 4.6, '#ffd080', G, 4);
      },
    },
    // A Norse fireside: a clearing in a night pine forest above a fjord, a longhouse with
    // its doors lit, runestones and a fire, a longship on the black water below the fells.
    norse: {
      outdoor: true, fog: { color: '#0e1622', density: 0.0045 },
      sky: { stops: ['#02040a', '#08101e', '#122236', '#1e3044'], haze: '#1e3044', below: '#0e1622', stars: 460, moon: { az: 24, el: 28, size: 6, color: '#fff2d8', glow: '#c8d8ff' },
        far(g, W, HY) {
          g.fillStyle = '#141e2c'; g.beginPath(); g.moveTo(0, HY + 2); for (let x = 0; x <= W; x += 6) g.lineTo(x, HY - 6 - Math.abs(Math.sin(x * 0.006) * 34 + Math.sin(x * 0.031) * 6)); g.lineTo(W, HY + 2); g.fill();
        } },
      build(k, P, G) {
        const B = G.y, R = rng(97);
        const floorT = k.tile(512, 512, (g, w, h) => { speckle(g, w, h, '#26241c', '#16140e', '#3a3624', 6000, 4); for (let i = 0; i < 200; i++) { g.fillStyle = rgba(i % 3 ? '#4a3e28' : '#2e4a2a', 0.6); g.fillRect((i * 97) % w, (i * 61) % h, 4, 2); } });
        P.add(k.mat({ map: floorT, roughness: 1, emissive: '#0a0c10', emissiveIntensity: 0.3 }), ground(k, null, 165, B, 12, [[-80, -48, 80, -140]]));
        // the fjord ahead, still and dark, with the moon's path on it
        const water = k.mat({ map: k.tile(256, 256, (g, w, h) => { g.fillStyle = '#0a1420'; g.fillRect(0, 0, w, h); for (let i = 0; i < 160; i++) { g.fillStyle = rgba('#8aa8d0', 0.08 + (i % 4) * 0.04); g.fillRect((i * 53) % w, (i * 29) % h, 10 + (i % 5) * 6, 1); } }), roughness: 0.3, metalness: 0, envMapIntensity: 0.15, emissive: '#12283e', emissiveIntensity: 0.9 });
        { const gg = new THREE.PlaneGeometry(170, 96).rotateX(-Math.PI / 2); const uv = gg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * 4); P.add(water, gg.translate(0, B - 1.2, -94)); }
        const shore = k.mat({ color: '#2a2a28', roughness: 1, flatShading: true });
        for (let i = 0; i < 26; i++) { const x = -78 + i * 6.2 + R() * 2; P.add(shore, new THREE.DodecahedronGeometry(1.4 + R() * 1.6, 0), { x, y: B - 0.8, z: -47 - R() * 2, s: [1.3, 0.6, 1] }); }
        // the fells round the fjord, dark below with snow on the tops
        const fell = peakMat(k, '#161c26', '#5a6680', 0.22, { emissive: '#06080c', emissiveIntensity: 0.4, envMapIntensity: 0.05 });
        for (let i = 0; i < 9; i++) { const x = -110 + i * 28 + R() * 8; mountain(P, fell, x, B - 2, -150 - R() * 14, 26 + R() * 12, 34 + R() * 26, i + 140, { sides: 9, rough: 0.3 }); }
        for (const s of [-1, 1]) for (let i = 0; i < 4; i++) mountain(P, fell, s * (96 + i * 6), B - 2, -60 - i * 26, 22 + R() * 8, 26 + R() * 18, i + 150 + s, { sides: 9, rough: 0.3 });
        // a longship drawn up on the water, its striped sail furled, a dragon at the prow
        const hullM = k.mat({ color: '#3a2616', roughness: 0.8 });
        const hull = new THREE.CylinderGeometry(2.2, 2.2, 22, 16, 6, true, Math.PI / 2, Math.PI), hp = hull.attributes.position;
        for (let i = 0; i < hp.count; i++) { const t = hp.getY(i) / 11; const f = Math.cos(t * Math.PI / 2) * 0.9 + 0.1; hp.setX(i, hp.getX(i) * f); hp.setZ(i, hp.getZ(i) * f * 0.7); hp.setY(i, hp.getY(i)); }
        hull.rotateZ(Math.PI / 2); hull.computeVertexNormals();
        const LX = 18, LZ = -84;
        P.add(k.own(new THREE.MeshStandardMaterial({ color: '#3a2616', roughness: 0.8, side: THREE.DoubleSide })), hull, { x: LX, y: B + 0.2, z: LZ, ry: 0.35 });
        for (const s of [-1, 1]) P.add(hullM, K.tube([[s * 10.6, B + 0.2, 0], [s * 11.6, B + 2.4, 0], [s * 11, B + 3.6, 0], [s * 10.2, B + 3.2, 0]], 0.22, { segs: 8, radial: 5 }), { x: LX, z: LZ, ry: 0.35 });
        P.add(hullM, new THREE.CylinderGeometry(0.16, 0.2, 9, 6), { x: LX, y: B + 4.6, z: LZ });
        P.add(k.mat({ map: k.tile(64, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = '#b02a24'; g.fillRect(x, 0, 8, h); g.fillStyle = '#e8dcc0'; g.fillRect(x + 8, 0, 8, h); } }), roughness: 1 }), new THREE.CylinderGeometry(0.4, 0.4, 7.4, 10).rotateZ(Math.PI / 2), { x: LX, y: B + 7.6, z: LZ, ry: 0.35 });
        const shieldCols = ['#c8a040', '#b02a24', '#2a4a7a', '#e8dcc0'];
        for (let i = 0; i < 10; i++) { const t = -8 + i * 1.8, c = Math.cos(0.35), s = Math.sin(0.35); for (const side of [-1, 1]) P.add(k.mat({ color: shieldCols[i % 4], roughness: 0.7 }), new THREE.CylinderGeometry(0.55, 0.55, 0.1, 12).rotateX(Math.PI / 2), { x: LX + t * c + side * 1.7 * s, y: B + 1.3, z: LZ - t * s + side * 1.7 * c, ry: 0.35 }); }
        // the longhouse to the left: long turf-roofed hall with curved walls and a glowing door
        const timber = k.mat({ map: k.tile(128, 128, (g, w, h) => { g.fillStyle = '#4a3220'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 10) { g.fillStyle = shade('#5a3e26', (R() - 0.5) * 0.4); g.fillRect(x, 0, 9, h); } }), roughness: 0.9 });
        const turf = k.mat({ map: k.tile(128, 128, (g, w, h) => speckle(g, w, h, '#3a4a26', '#24301a', '#5a6a34', 1600, 4)), roughness: 1, flatShading: true });
        const HX = -32, HZ = -22, HR = 1.1;
        P.add(timber, new THREE.BoxGeometry(24, 3.4, 8), { x: HX, y: B + 1.7, z: HZ, ry: HR });
        { const roof = new THREE.CylinderGeometry(5.6, 5.6, 25, 14, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.62, 1); P.add(turf, roof, { x: HX, y: B + 3.3, z: HZ, ry: HR }); }
        const c = Math.cos(HR), s = Math.sin(HR);
        P.add(k.glowMat('#ffa040', 1.6), new THREE.PlaneGeometry(1.6, 2.4), { x: HX + s * 4.05, y: B + 1.2, z: HZ + c * 4.05, ry: HR });
        G.glows.push([HX + s * 5, B + 1.6, HZ + c * 5, '#ff9a3a', 5]);
        for (const t of [-11, 11]) P.add(timber, K.tube([[0, 0, 0], [0, 1.4, 0.2], [0, 2.2, -0.4]], 0.18, { segs: 6, radial: 5 }), { x: HX + c * t, y: B + 6.6, z: HZ - s * t, ry: HR });
        // two more halls and a storehouse on stilts, behind and to the right
        P.add(timber, new THREE.BoxGeometry(16, 3, 7), { x: 34, y: B + 1.5, z: 28, ry: -0.7 });
        P.add(turf, new THREE.CylinderGeometry(5, 5, 17, 12, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.6, 1), { x: 34, y: B + 3, z: 28, ry: -0.7 });
        G.glows.push([31, B + 1.4, 32, '#ff9a3a', 3]);
        P.add(timber, new THREE.BoxGeometry(14, 2.8, 6), { x: -26, y: B + 1.4, z: 34, ry: 0.5 });
        P.add(turf, new THREE.CylinderGeometry(4.4, 4.4, 15, 12, 1, false, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.6, 1), { x: -26, y: B + 2.8, z: 34, ry: 0.5 });
        for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) P.add(timber, new THREE.CylinderGeometry(0.2, 0.2, 2, 6), { x: 30 + dx, y: B + 1, z: -10 + dz });
        P.add(timber, new THREE.BoxGeometry(4, 2.4, 4), { x: 30, y: B + 3.2, z: -10 });
        P.add(turf, K.extrude([[-2.6, 0], [2.6, 0], [0, 2]], 4.6, 0), { x: 30, y: B + 4.4, z: -10 });
        // runestones by the path, carved with a serpent band, and a ring of standing stones
        const runeT = k.tile(128, 256, (g, w, h) => { speckle(g, w, h, '#6a6a64', '#4a4a44', '#8a8a80', 1600, 3); g.strokeStyle = '#a83a2a'; g.lineWidth = 6; g.beginPath(); for (let y = 30; y < h - 20; y += 4) g.lineTo(w / 2 + Math.sin(y * 0.05) * w * 0.3, y); g.stroke(); g.strokeStyle = '#2a2a28'; g.lineWidth = 2; for (let y = 40; y < h - 30; y += 16) { g.beginPath(); g.moveTo(w / 2 - 8, y); g.lineTo(w / 2 + 6, y + 8); g.stroke(); } });
        const runeM = k.mat({ map: runeT, roughness: 1 });
        for (const [x, z, ry] of [[-16, -8, 0.6], [17, 8, -0.8], [-12, 18, 2.6]]) P.add(runeM, new THREE.CylinderGeometry(0.9, 1.3, 4, 6).scale(1, 1, 0.45), { x, y: B + 2, z, ry });
        const grey = k.mat({ color: '#5a5a56', roughness: 1, flatShading: true });
        for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, x = 44 + Math.sin(a) * 9, z = 4 - Math.cos(a) * 5; P.add(grey, new THREE.BoxGeometry(0.8, 1.6 + R() * 0.8, 0.6).toNonIndexed(), { x, y: B + 0.8, z, ry: a }); }
        // the campfire in front of the hall, with logs and stones round it
        const FX = -16, FZ = 4;
        for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; P.add(grey, new THREE.DodecahedronGeometry(0.42, 0), { x: FX + Math.sin(a) * 1.4, y: B + 0.2, z: FZ + Math.cos(a) * 1.4 }); }
        for (let i = 0; i < 4; i++) P.add(timber, new THREE.CylinderGeometry(0.16, 0.18, 2.2, 6).rotateZ(1.1), { x: FX, y: B + 0.7, z: FZ, ry: i * Math.PI / 2 });
        P.add(k.glowMat('#ff8a2a', 2.2), new THREE.ConeGeometry(0.7, 1.8, 7), { x: FX, y: B + 1, z: FZ });
        P.add(k.glowMat('#ffd060', 2.4), new THREE.ConeGeometry(0.36, 1.2, 6), { x: FX, y: B + 0.9, z: FZ });
        G.glows.push([FX, B + 1.6, FZ, '#ff8a2a', 9]);
        for (const [x, z] of [[-22, -10], [12, -18], [-4, 22]]) { P.add(timber, new THREE.CylinderGeometry(0.12, 0.14, 3, 6), { x, y: B + 1.5, z }); P.add(k.glowMat('#ffa040', 1.8), new THREE.ConeGeometry(0.3, 0.8, 6), { x, y: B + 3.3, z }); G.glows.push([x, B + 3.4, z, '#ff9a3a', 3]); }
        // pines all round the clearing, thick behind us and along the shore
        const pineM = k.mat({ color: '#142a1e', roughness: 1, flatShading: true, emissive: '#04080a', emissiveIntensity: 0.4 });
        for (let i = 0; i < 230; i++) {
          const a = R() * TAU, r = 26 + R() * 110, x = Math.sin(a) * r, z = -Math.cos(a) * r;
          if (z < -42 && z > -150 && Math.abs(x) < 82) continue;
          if (Math.hypot(x - HX, z - HZ) < 15 || Math.hypot(x - 34, z - 28) < 12 || Math.hypot(x + 26, z - 34) < 11 || Math.hypot(x - 44, z - 4) < 12) continue;
          pine(P, pineM, x, B, z, 8 + R() * 9);
        }
        for (let i = 0; i < 40; i++) { const x = (R() - 0.5) * 160, z = -150 - R() * 20; pine(P, pineM, x, B + 4, z, 6 + R() * 6); }
      },
    },

    // Cape Sounion at sunset: a clifftop of dry grass and olive trees high above the Aegean,
    // the white Doric columns of Poseidon's temple ahead, islands out in the golden sea.
    sounion: {
      outdoor: true, fog: { color: '#e8b890', density: 0.0028 },
      sky: { stops: ['#2a3a6a', '#7a7aa8', '#f0a878', '#f8d8a0'], haze: '#f4c8a0', below: '#3a5a7a', clouds: 9, cloud: '#ffe0c0', sun: { az: -38, el: 6, size: 12, color: '#ffc070', glow: '#ffa860' },
        far(g, W, HY) { g.fillStyle = '#6a6a8a'; for (const [x0, w, h] of [[0.08, 0.1, 10], [0.34, 0.06, 6], [0.62, 0.14, 12], [0.86, 0.07, 7]]) { g.beginPath(); g.ellipse(W * x0, HY, W * w / 2, h, 0, Math.PI, TAU); g.fill(); } } },
      build(k, P, G) {
        const B = G.y, R = rng(101);
        // the sea far below on every side but the land behind us
        const sea = k.mat({ map: k.tile(256, 256, (g, w, h) => { g.fillStyle = '#2a5a7a'; g.fillRect(0, 0, w, h); for (let i = 0; i < 220; i++) { g.fillStyle = rgba(i % 3 ? '#f8c890' : '#8ac0d8', 0.1 + (i % 4) * 0.05); g.fillRect((i * 53) % w, (i * 29) % h, 8 + (i % 5) * 6, 1.5); } }), roughness: 0.15, metalness: 0.3, emissive: '#1a3a50', emissiveIntensity: 0.35 });
        P.add(sea, ground(k, null, 170, B - 34, 18));
        // the headland: a flat top of dry grass and rock, with cliffs falling to the sea
        const grass = k.mat({ map: k.tile(512, 512, (g, w, h) => { speckle(g, w, h, '#8a8650', '#6a6234', '#aaa468', 6000, 4); for (let i = 0; i < 90; i++) { g.fillStyle = rgba('#d8d0c0', 0.7); g.fillRect((i * 71) % w, (i * 43) % h, 6, 4); } }), roughness: 1 });
        const cliffM = k.mat({ map: k.tile(128, 256, (g, w, h) => { speckle(g, w, h, '#a8907a', '#6a5a4a', '#d8c0a0', 2400, 5); for (let y = 0; y < h; y += 14) { g.fillStyle = 'rgba(70,50,40,0.25)'; g.fillRect(0, y, w, 2); } }), roughness: 1, flatShading: true });
        const top = new THREE.CircleGeometry(1, 40), tp = top.attributes.position;
        const rad = (a) => 62 + Math.sin(a * 3) * 8 + Math.sin(a * 7 + 1) * 4 + (Math.cos(a) < -0.2 ? 60 : 0);
        for (let i = 1; i < tp.count; i++) { const a = Math.atan2(tp.getY(i), tp.getX(i)); const r = rad(a); tp.setX(i, Math.cos(a) * r); tp.setY(i, Math.sin(a) * r); }
        { const uv = top.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, tp.getX(i) / 14, tp.getY(i) / 14); }
        P.add(grass, top.rotateX(-Math.PI / 2), { y: B, z: -10 });
        { const N = 40, pos = []; for (let i = 0; i < N; i++) { const a0 = i / N * TAU, a1 = (i + 1) / N * TAU, r0 = rad(a0), r1 = rad(a1); const x0 = Math.cos(a0) * r0, z0 = -Math.sin(a0) * r0 - 10, x1 = Math.cos(a1) * r1, z1 = -Math.sin(a1) * r1 - 10; const d = 1.1 + R() * 0.1; pos.push(x0, B, z0, x0 * d, B - 36, (z0 + 10) * d - 10, x1, B, z1, x1, B, z1, x0 * d, B - 36, (z0 + 10) * d - 10, x1 * d, B - 36, (z1 + 10) * d - 10); }
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const uv = []; for (let i = 0; i < pos.length / 3; i++) uv.push((i % 3) * 0.5, pos[i * 3 + 1] > B - 1 ? 1 : 0); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
          P.add(k.own(new THREE.MeshStandardMaterial({ map: cliffM.map, roughness: 1, flatShading: true, side: THREE.DoubleSide })), g); }
        // the temple ahead: a stepped base and the Doric columns still standing, with a lintel
        const marble = k.mat({ map: k.tile(128, 128, (g, w, h) => speckle(g, w, h, '#ece4d4', '#c8bca8', '#fff8ec', 900, 3)), roughness: 0.6, emissive: '#3a2010', emissiveIntensity: 0.25 });
        const TZ = -44, TW = 14, TL = 32;
        for (let i = 0; i < 3; i++) P.add(marble, box(TW + 4 - i * 1.4, 0.6, TL + 4 - i * 1.4, 0, B + i * 0.6, TZ));
        const SY = B + 1.8, colH = 7.4;
        const col = new THREE.CylinderGeometry(0.58, 0.72, colH, 16, 1);
        const capital = new THREE.BoxGeometry(1.7, 0.4, 1.7), echinus = new THREE.CylinderGeometry(0.85, 0.6, 0.4, 16);
        const colAt = (x, z, h) => { P.add(marble, col.clone(), { x, y: SY + h / 2, z, s: [1, h / colH, 1] }); if (h >= colH) { P.add(marble, echinus.clone(), { x, y: SY + colH + 0.2, z }); P.add(marble, capital.clone(), { x, y: SY + colH + 0.6, z }); } };
        const xs = [-6, -3.6, -1.2, 1.2, 3.6, 6], zs = Array.from({ length: 13 }, (_, i) => TZ + TL / 2 - 1.2 - i * (TL - 2.4) / 12);
        // the long south side stands complete; the north side is only partly standing
        for (const z of zs) colAt(6, z, colH);
        zs.forEach((z, i) => { if (i < 4 || i > 9) colAt(-6, z, colH); else if (i === 6) colAt(-6, z, 2.4); });
        for (const x of xs.slice(1, 5)) colAt(x, zs[0], colH);
        colAt(-1.2, zs[12], colH); colAt(3.6, zs[12], colH);
        P.add(marble, box(1.6, 1.4, TL - 1, 6, SY + colH + 0.8, TZ));
        P.add(marble, box(TW - 0.8, 1.4, 1.6, 0, SY + colH + 0.8, zs[0]));
        P.add(marble, box(1.6, 1.4, 9, -6, SY + colH + 0.8, zs[0] - 3.6));
        // fallen drums and blocks round the base
        for (let i = 0; i < 9; i++) P.add(marble, new THREE.CylinderGeometry(0.66, 0.66, 1 + R(), 14).rotateZ(Math.PI / 2), { x: -12 + R() * 4, y: B + 0.6, z: TZ - 12 + i * 3 + R(), ry: R() * 3 });
        // olive trees, silver-green, round the clifftop and behind us; rocks and wild thyme
        const bark = k.mat({ color: '#5a4a3a', roughness: 1 });
        const leaf = k.mat({ color: '#7a8a5a', roughness: 1, flatShading: true });
        const olive = (x, z, h) => { const r2 = rng(Math.floor(x * 13 + z * 7)); P.add(bark, K.tube([[x, B, z], [x + (r2() - 0.5) * 1.4, B + h * 0.35, z + (r2() - 0.5)], [x + (r2() - 0.5) * 2, B + h * 0.6, z + (r2() - 0.5) * 1.6]], h * 0.07, { segs: 8, radial: 6 })); for (let i = 0; i < 6; i++) P.add(leaf, new THREE.IcosahedronGeometry(h * (0.22 + r2() * 0.1), 0), { x: x + (r2() - 0.5) * h * 0.8, y: B + h * (0.6 + r2() * 0.3), z: z + (r2() - 0.5) * h * 0.8, s: [1.3, 0.7, 1.3] }); };
        for (let i = 0; i < 46; i++) { const a = R() * TAU, r = 18 + R() * 50, x = Math.sin(a) * r, z = -Math.cos(a) * r; if (Math.abs(x) < 14 && z < -22 && z > -66) continue; if (Math.hypot(x, z + 10) > rad(Math.atan2(-(z + 10), x)) - 4) continue; olive(x, z, 4 + R() * 3); }
        const rock = k.mat({ color: '#a8987e', roughness: 1, flatShading: true });
        for (let i = 0; i < 40; i++) { const a = R() * TAU, r = 16 + R() * 50, x = Math.sin(a) * r, z = -Math.cos(a) * r; if (Math.hypot(x, z + 10) > rad(Math.atan2(-(z + 10), x)) - 2) continue; P.add(rock, new THREE.DodecahedronGeometry(0.5 + R() * 1.4, 0), { x, y: B + 0.2, z, s: [1.2, 0.6, 1] }); }
        // the hills of Attica behind us, and islands out to sea
        const hill = peakMat(k, '#8a7a5a', '#6a7a4a', 0.5, { envMapIntensity: 0.1 });
        for (let i = 0; i < 9; i++) { const a = Math.PI + (i - 4) * 0.22, r = 140 + R() * 20; mountain(P, hill, Math.sin(a) * r, B - 20, -Math.cos(a) * r, 34 + R() * 14, 30 + R() * 22, i + 160, { sides: 9, rough: 0.3 }); }
        const isle = peakMat(k, '#7a6a5a', null, 0, { envMapIntensity: 0.1 });
        for (const [x, z, r, h] of [[-90, -110, 20, 16], [70, -130, 26, 22], [120, -40, 18, 12], [-130, -20, 22, 14], [20, -160, 14, 9]]) mountain(P, isle, x, B - 35, z, r, h, x + z, { sides: 9, rough: 0.35 });
        // a small white chapel and a sail far below
        P.add(k.mat({ color: '#f4f0e8', roughness: 0.8 }), box(4, 3.4, 5, -40, B, 30));
        P.add(k.mat({ color: '#2a5aa8', roughness: 0.5 }), new THREE.SphereGeometry(1.6, 14, 8, 0, TAU, 0, Math.PI / 2), { x: -40, y: B + 3.4, z: 30 });
        P.add(k.mat({ color: '#fff8ec', roughness: 0.9 }), K.extrude([[0, 0], [3, 0], [0, 5]], 0.05, 0), { x: 50, y: B - 34, z: -90 });
      },
    },
  });

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
