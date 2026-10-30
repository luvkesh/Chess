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
    const mat = (p) => own(new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.88, metalness: 0 }, p)));
    const glowMat = (color, i) => own(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(i === undefined ? 1 : i), toneMapped: false }));
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
  function lamp(k, P, postM, x, y, z, h, color, group, size) {
    P.add(postM, lathe([[0.32, 0], [0.3, 0.4], [0.12, 0.6], [0.09, h - 0.6], [0.2, h - 0.4], [0.05, h - 0.2]], 8), { x, y, z });
    P.add(k.glowMat(color, 1.6), new THREE.SphereGeometry(0.34, 10, 8), { x, y: y + h, z });
    if (group) {
      const s = new THREE.Sprite(k.own(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color(color).multiplyScalar(0.55), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false })));
      s.position.set(x, y + h, z); s.scale.setScalar(size || 4); group.add(s);
    }
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
    taj: {
      outdoor: true, fog: { color: '#1c2a4a', density: 0.006 },
      sky: { stops: ['#02050f', '#081430', '#14264c', '#24385e'], haze: '#24385e', below: '#1c2a4a', stars: 420, moon: { az: 28, el: 34, size: 7, color: '#fff2d8', glow: '#c8d8ff' },
        far(g, W, HY, U) { g.fillStyle = '#0a1226'; for (let x = 0; x < W; x += 6) { const h = 6 + Math.abs(Math.sin(x * 0.013) * 10 + Math.sin(x * 0.051) * 5); g.fillRect(x, HY - h, 6, h + 2); } } },
      build(k, P, G, group) {
        const B = G.y;
        const lawn = k.tile(512, 512, (g, w, h) => speckle(g, w, h, '#1e3424', '#0c1a10', '#2e4a30', 5000, 2), [1, 1]);
        const lawnM = k.mat({ map: lawn, roughness: 1 });
        const pool = { x0: -4, x1: 4, z0: -15, z1: -88 };
        P.add(lawnM, ground(k, lawnM, 165, B - 0.05, 10, [[pool.x0, pool.z0, pool.x1, pool.z1]]));
        // red sandstone walks beside the pool and across the garden
        const sand = k.mat({ map: k.tile(256, 256, (g, w, h) => courses(g, w, h, '#9a5a44', 'rgba(40,16,10,0.6)', 4, 2, 5), [1, 1]), roughness: 0.85 });
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
        for (const z of [-14, -32, -70]) for (const sx of [-1, 1]) lamp(k, P, post, sx * 6.5, B, z, 3.2, '#ffc070', group, 3.5);
      },
    },
  };

  // Builds the vista for a room. Returns its group (already merged), the meshes or sprites
  // that animate, the scene fog it wants and a dispose().
  function build(id, o) {
    const V = VISTAS[id];
    if (!V) return null;
    const k = Kit(o), P = Parts(), group = new THREE.Group(), G = { y: o.groundY, flames: o.flames };
    sky(k, V.sky, group);
    V.build(k, P, G, group);
    P.build(group);
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
