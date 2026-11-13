// The website's feature icons as small 3D objects: a glossy book, a trophy on a cushion, a crown,
// a shield and so on, built from three.js shapes and the game's own sculpted pieces, and lit in a
// studio. tools/shoot-icons.js renders them to img/ic-*.webp (transparent, 360 px).
//
//   ChacklateIcons(THREE, K, P) -> { ICONS, build(name) }   build gives { group, up } to frame
//
// Every builder returns a Group whose base sits on y = 0. Where an icon stands on a plinth, the
// plinth is part of the icon, so the page can show it on any background.
'use strict';
function ChacklateIcons(THREE, K, P) {
  const PI = Math.PI, TAU = PI * 2;
  const V2 = (x, y) => new THREE.Vector2(x, y), V3 = (x, y, z) => new THREE.Vector3(x, y, z);

  // ------------------------------------------------------------------ materials
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const M = {
    gold: (c) => phys({ color: c || '#ffb63a', emissive: '#6a3a04', emissiveIntensity: 0.3, metalness: 1, roughness: 0.22, clearcoat: 0.5, clearcoatRoughness: 0.14, envMapIntensity: 1.6 }),
    goldSoft: () => phys({ color: '#f2c45e', metalness: 1, roughness: 0.32, envMapIntensity: 1.45 }),
    // small gold parts: rougher, so they read bright from every angle instead of mirroring the dark room
    goldBright: () => phys({ color: '#ffcf66', metalness: 0.9, roughness: 0.36, envMapIntensity: 2.1, emissive: '#7a4a08', emissiveIntensity: 0.35 }),
    lacquer: (c, o) => phys(Object.assign({ color: c, roughness: 0.28, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.05 }, o || {})),
    enamel: (c, o) => phys(Object.assign({ color: c, roughness: 0.38, metalness: 0, clearcoat: 0.85, clearcoatRoughness: 0.12, envMapIntensity: 1 }, o || {})),
    velvet: (c) => phys({ color: new THREE.Color(c).multiplyScalar(0.8), roughness: 0.92, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color(c).lerp(new THREE.Color('#ffffff'), 0.4) }),
    paper: (c) => phys({ color: c || '#f6efe2', roughness: 0.8, metalness: 0, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') }),
    glass: (c) => phys({ color: c || '#dff3ff', metalness: 0, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.32, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false }),
    glow: (c, i) => phys({ color: c, emissive: c, emissiveIntensity: i === undefined ? 1.6 : i, roughness: 0.4, metalness: 0 }),
    wood: () => phys({ color: '#5a2e14', roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    dark: () => phys({ color: '#1a1012', roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.1 }),
    white: () => phys({ color: '#f7f2ea', roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.08 }),
  };

  // ------------------------------------------------------------------ shapes
  const mesh = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; if (x !== undefined) m.position.set(x, y, z); return m; };
  const rbox = (w, h, d, r, mat, x, y, z) => mesh(new THREE.RoundedBoxGeometry(w, h, d, 5, Math.min(r, w / 2, h / 2, d / 2)), mat, x, y, z);
  const cyl = (rt, rb, h, mat, x, y, z, seg) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 64), mat, x, y, z);
  const sph = (r, mat, x, y, z) => mesh(new THREE.SphereGeometry(r, 48, 32), mat, x, y, z);
  const torus = (R, r, mat, arc) => mesh(new THREE.TorusGeometry(R, r, 24, 96, arc || TAU), mat);
  const lathe = (pts, mat, seg) => mesh(new THREE.LatheGeometry(pts.map((p) => V2(p[0], p[1])), seg || 72), mat);
  const cone = (r, h, mat, x, y, z, seg) => mesh(new THREE.ConeGeometry(r, h, seg || 48), mat, x, y, z);
  // a flat shape with soft bevelled edges, centred on its depth
  function extrude(shape, depth, bevel, mat, o) {
    const g = new THREE.ExtrudeGeometry(shape, Object.assign({ depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 5, curveSegments: 28 }, o || {}));
    g.translate(0, 0, -depth / 2);
    return mesh(g, mat);
  }
  function roundRect(w, h, r) {
    const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, PI / 2, PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, PI, PI * 1.5, false);
    return s;
  }
  function star(n, R, r) {
    const s = new THREE.Shape();
    for (let i = 0; i < n * 2; i++) { const a = PI / 2 + (i * PI) / n, k = i % 2 ? r : R; if (i) s.lineTo(Math.cos(a) * k, Math.sin(a) * k); else s.moveTo(Math.cos(a) * k, Math.sin(a) * k); }
    s.closePath();
    return s;
  }
  function crownShape(w) {
    const s = new THREE.Shape(), h = w * 0.62;
    s.moveTo(-w / 2, 0); s.lineTo(-w / 2, h * 0.55); s.lineTo(-w * 0.25, h * 0.3); s.lineTo(0, h); s.lineTo(w * 0.25, h * 0.3); s.lineTo(w / 2, h * 0.55); s.lineTo(w / 2, 0); s.closePath();
    return s;
  }
  function shield() {
    const s = new THREE.Shape();
    s.moveTo(-0.95, 0.75); s.quadraticCurveTo(0, 0.98, 0.95, 0.75);
    s.bezierCurveTo(1.0, 0.1, 0.75, -0.6, 0, -1.05);
    s.bezierCurveTo(-0.75, -0.6, -1.0, 0.1, -0.95, 0.75);
    return s;
  }
  // a jigsaw piece: each side is flat (0), has a knob (1) or a socket (-1)
  function jigsaw(size, sides) {
    const h = size / 2, kr = size * 0.19, s = new THREE.Shape();
    const edge = (ax, ay, bx, by, kind) => {
      const mx = (ax + bx) / 2, my = (ay + by) / 2, nx = -(by - ay) / size, ny = (bx - ax) / size;   // outward normal
      const dx = (bx - ax) / size, dy = (by - ay) / size;
      if (!kind) { s.lineTo(bx, by); return; }
      const k = kind, neck = kr * 0.62;
      s.lineTo(mx - dx * neck, my - dy * neck);
      s.bezierCurveTo(mx - dx * neck + nx * k * kr * 0.1, my - dy * neck + ny * k * kr * 0.1, mx - dx * kr * 1.15 + nx * k * kr * 1.1, my - dy * kr * 1.15 + ny * k * kr * 1.1, mx + nx * k * kr * 1.5, my + ny * k * kr * 1.5);
      s.bezierCurveTo(mx + dx * kr * 1.15 + nx * k * kr * 1.1, my + dy * kr * 1.15 + ny * k * kr * 1.1, mx + dx * neck + nx * k * kr * 0.1, my + dy * neck + ny * k * kr * 0.1, mx + dx * neck, my + dy * neck);
      s.lineTo(bx, by);
    };
    s.moveTo(-h, -h);
    edge(-h, -h, h, -h, sides[2]); edge(h, -h, h, h, sides[1]); edge(h, h, -h, h, sides[0]); edge(-h, h, -h, -h, sides[3]);
    s.closePath();
    return s;
  }
  function tube(points, r, mat, closed) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => V3(p[0], p[1], p[2])), !!closed, 'centripetal');
    return mesh(new THREE.TubeGeometry(curve, 160, r, 18, !!closed), mat);
  }
  // a canvas texture painted by fn(ctx, w, h)
  function tex(w, h, fn) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    fn(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
  }

  // ------------------------------------------------------------------ parts shared by icons
  // A round display plinth: dark velvet top in a gold rim, on a gold foot.
  function plinth(R, color) {
    const g = new THREE.Group();
    return g;   // icons stand alone on the dark ground, so the plinths are gone
    const top = cyl(R, R, 0.1, M.velvet(color || '#3a1420'), 0, -0.05, 0);
    const rim = torus(R, 0.045, M.gold()); rim.rotation.x = PI / 2;
    const foot = cyl(R + 0.05, R * 0.9, 0.16, M.gold(), 0, -0.18, 0);
    g.add(top, rim, foot);
    return g;
  }
  function cushion(w, c) {
    const g = new THREE.Group(), mat = M.velvet(c || '#8a1430');
    const body = rbox(w, w * 0.3, w, w * 0.14, mat, 0, w * 0.15, 0);
    body.scale.set(1, 1, 1);
    g.add(body);
    const tassel = (x, z) => { const t = sph(w * 0.07, M.gold(), x, w * 0.1, z); g.add(t); };
    tassel(w / 2, w / 2); tassel(-w / 2, w / 2); tassel(w / 2, -w / 2); tassel(-w / 2, -w / 2);
    // a gold piping line round the middle
    const pipe = torus(w * 0.69, w * 0.014, M.gold()); pipe.rotation.x = PI / 2; pipe.position.y = w * 0.15; pipe.scale.set(1, 1, 1);
    g.add(pipe);
    return g;
  }
  function crown(scale, gems) {
    const g = new THREE.Group(), gold = M.goldBright();
    const band = cyl(0.62, 0.56, 0.3, gold, 0, 0.15, 0);
    g.add(band);
    const n = 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, x = Math.cos(a) * 0.58, z = Math.sin(a) * 0.58;
      const pt = extrude(star(3, 0.3, 0.1), 0.08, 0.015, gold);   // a fleur-like point
      pt.position.set(x, 0.48, z); pt.rotation.y = -a + PI / 2; pt.scale.set(1.1, 1.35, 1);
      g.add(pt);
      const ball = sph(0.06, gold, x * 1.0, 0.86, z * 1.0); g.add(ball);
      const gem = sph(0.075, M.lacquer(gems[i % gems.length], { envMapIntensity: 1.8, emissive: gems[i % gems.length], emissiveIntensity: 0.18 }), x * 1.02, 0.18, z * 1.02); g.add(gem);
    }
    const arch = torus(0.5, 0.045, gold, PI); arch.position.y = 0.42; g.add(arch);
    const arch2 = arch.clone(); arch2.rotation.y = PI / 2; g.add(arch2);
    const cap = cyl(0.17, 0.17, 0.04, gold, 0, 0.92, 0);
    const cross1 = rbox(0.06, 0.26, 0.06, 0.02, gold, 0, 1.08, 0), cross2 = rbox(0.2, 0.06, 0.06, 0.02, gold, 0, 1.08, 0);
    const cush = sph(0.5, M.velvet('#8a1430'), 0, 0.42, 0); cush.scale.set(1, 0.8, 1);
    g.add(cap, cross1, cross2, cush);
    g.scale.setScalar(scale || 1);
    return g;
  }
  function laurel(side, R, mat) {
    // a branch of leaves curving up one side, like a wreath half
    const g = new THREE.Group(), leaf = new THREE.Shape();
    leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.12, 0.08, 0, 0.3); leaf.quadraticCurveTo(-0.12, 0.08, 0, 0);
    const stem = [];
    for (let i = 0; i <= 10; i++) { const a = -PI * 0.1 + (i / 10) * PI * 0.72; stem.push([side * Math.cos(a) * R, Math.sin(a) * R, 0]); }
    g.add(tube(stem, 0.022, mat));
    for (let i = 1; i <= 9; i++) {
      const a = -PI * 0.1 + (i / 10) * PI * 0.72;
      [-1, 1].forEach((d) => {
        const l = extrude(leaf, 0.02, 0.006, mat);
        l.position.set(side * Math.cos(a) * R, Math.sin(a) * R, d * 0.012);
        l.rotation.z = side * (a - PI / 2) + d * 0.55 * side; l.rotation.y = d * 0.25;
        g.add(l);
      });
    }
    return g;
  }
  function trophy(scale) {
    const g = new THREE.Group(), gold = M.gold();
    const cup = lathe([[0, 0.62], [0.2, 0.62], [0.24, 0.66], [0.26, 0.8], [0.44, 1.0], [0.55, 1.25], [0.6, 1.5], [0.58, 1.6], [0.62, 1.64], [0.55, 1.62], [0.5, 1.5], [0.42, 1.2], [0.24, 0.95], [0.2, 0.7], [0, 0.7]], gold);
    const stem = lathe([[0, 0.3], [0.3, 0.3], [0.3, 0.36], [0.14, 0.42], [0.12, 0.58], [0.2, 0.62], [0, 0.62]], gold);
    const base = cyl(0.42, 0.46, 0.18, M.dark(), 0, 0.12, 0), band = cyl(0.47, 0.47, 0.05, gold, 0, 0.04, 0), plate = rbox(0.4, 0.08, 0.04, 0.02, gold, 0, 0.14, 0.45);
    [[1], [-1]].forEach(([s]) => { const h = torus(0.22, 0.05, gold, PI); h.rotation.z = s * -PI / 2; h.rotation.y = 0; h.position.set(s * 0.62, 1.22, 0); h.rotation.set(0, 0, s > 0 ? -PI / 2 : PI / 2); g.add(h); });
    g.add(cup, stem, base, band, plate);
    g.scale.setScalar(scale || 1);
    return g;
  }
  // A real piece from the game's Regency Gilt set, sculpted at full detail, optionally all in gold.
  function piece(type, side, scale, gild) {
    const p = P.make('regency', type, side, 'show');
    if (gild) { const gold = M.gold(gild === true ? undefined : gild); p.traverse((m) => { if (m.isMesh) m.material = gold; }); }
    p.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    p.scale.setScalar(scale || 1);
    return p;
  }
  function book(w, h, d, cover, opts) {
    // a closed book lying flat: lacquered cover, cream page block, gold edge
    const o = opts || {}, g = new THREE.Group();
    const cov = rbox(w, h, d, 0.035, M.lacquer(cover), 0, h / 2, 0);
    const pages = rbox(w - 0.1, h - 0.07, d - 0.06, 0.02, M.paper(o.pages), 0.07, h / 2, 0);
    g.add(cov, pages);
    if (o.spineGold !== false) { const sp = rbox(0.06, h + 0.01, d - 0.16, 0.02, M.gold(), -w / 2 + 0.05, h / 2, 0); g.add(sp); }
    return g;
  }
  function openBook(cover, pagesTint) {
    const g = new THREE.Group(), lac = M.lacquer(cover), pap = M.paper(pagesTint);
    [-1, 1].forEach((s) => {
      const cov = rbox(1.05, 0.06, 1.4, 0.02, lac); cov.position.set(s * 0.53, 0.03 + 0.1 * 0, 0); cov.rotation.z = s * -0.16; cov.position.y += 0.085;
      const pg = rbox(0.98, 0.14, 1.32, 0.02, pap); pg.position.set(s * 0.52, 0.19, 0); pg.rotation.z = s * -0.16;
      g.add(cov, pg);
    });
    const spine = rbox(0.12, 0.1, 1.38, 0.03, lac, 0, 0.06, 0);
    g.add(spine);
    // page lines
    const lines = new THREE.Group();
    for (let i = 0; i < 4; i++) [-1, 1].forEach((s) => { const l = rbox(0.5, 0.012, 0.03, 0.005, M.enamel('#c9b48c'), s * 0.55, 0.27 + Math.abs(s) * 0, -0.45 + i * 0.3); l.rotation.z = s * -0.16; lines.add(l); });
    g.add(lines);
    return g;
  }
  function bubble(w, h, d, mat, tailSide) {
    const g = new THREE.Group();
    const body = rbox(w, h, d, Math.min(h, w) * 0.28, mat, 0, h / 2 + 0.3, 0);
    const tail = new THREE.Shape(); tail.moveTo(-0.25, 0); tail.lineTo(0.25, 0); tail.lineTo(-0.05, -0.45); tail.closePath();
    const t = extrude(tail, d * 0.8, 0.03, mat); t.position.set((tailSide || -1) * w * 0.28, 0.32, 0);
    g.add(body, t);
    return g;
  }
  function noBadge(r) {
    const g = new THREE.Group(), red = M.lacquer('#e3362b');
    const ring = torus(r, r * 0.22, red); const bar = rbox(r * 1.7, r * 0.42, r * 0.4, r * 0.1, red); bar.rotation.z = PI / 4;
    const face = cyl(r * 0.8, r * 0.8, r * 0.12, M.lacquer('#ffe9e3', { opacity: 0.5, transparent: true }), 0, 0, 0); face.rotation.x = PI / 2;
    g.add(ring, bar);
    return g;
  }
  function checkMark(mat, scale) {
    const g = new THREE.Group();
    const a = rbox(0.55, 0.17, 0.12, 0.06, mat); a.rotation.z = -PI / 4; a.position.set(-0.3, 0.02, 0);
    const b = rbox(0.95, 0.17, 0.12, 0.06, mat); b.rotation.z = PI / 4; b.position.set(0.2, 0.14, 0);
    g.add(a, b); g.scale.setScalar(scale || 1);
    return g;
  }
  function rosette(r, color) {
    const g = new THREE.Group(), rib = M.lacquer(color || '#d8142e');
    const disc = extrude(star(16, r, r * 0.84), r * 0.2, r * 0.03, rib); g.add(disc);
    const inner = cyl(r * 0.56, r * 0.56, r * 0.3, M.gold(), 0, 0, 0); inner.rotation.x = PI / 2; g.add(inner);
    [-1, 1].forEach((d) => { const t = rbox(r * 0.42, r * 1.3, r * 0.14, r * 0.04, rib, d * r * 0.3, -r * 1.1, -r * 0.05); t.rotation.z = d * -0.22; g.add(t); });
    return g;
  }
  // a small chequered board of n x m tiles in a gold frame, top at y = 0.12
  function tiles(n, m, s, light, dark) {
    const g = new THREE.Group();
    g.add(rbox(n * s + 0.14, 0.08, m * s + 0.14, 0.03, M.gold(), 0, 0.04, 0));
    for (let r = 0; r < m; r++) for (let c = 0; c < n; c++) g.add(rbox(s * 0.98, 0.05, s * 0.98, 0.015, M.enamel((r + c) % 2 ? dark : light), (c - (n - 1) / 2) * s, 0.095, (r - (m - 1) / 2) * s));
    return g;
  }
  // a thick arrow pointing up its y axis
  function arrowUp(mat, len) {
    const s = new THREE.Shape(), w = 0.12, hw = 0.3, hl = 0.36;
    s.moveTo(-w, 0); s.lineTo(w, 0); s.lineTo(w, len - hl); s.lineTo(hw, len - hl); s.lineTo(0, len); s.lineTo(-hw, len - hl); s.lineTo(-w, len - hl); s.closePath();
    return extrude(s, 0.12, 0.03, mat);
  }
  function sparkle(size, mat) {
    const s = extrude(star(4, size, size * 0.3), size * 0.3, size * 0.06, mat);
    return s;
  }

  // ------------------------------------------------------------------ the icons
  // Each returns a Group standing on y = 0; `up` is a hint for where the camera looks (the
  // icon's centre of interest), as a fraction of its height.
  // a jewel for the top of an icon: a faceted gem in a gold collet between two gold scrolls
  function finial(color) {
    const g = new THREE.Group(), gold = M.goldBright();
    const gem = mesh(new THREE.IcosahedronGeometry(0.15, 1), phys({ color, roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, emissive: color, emissiveIntensity: 0.25, flatShading: true, envMapIntensity: 0.9 }), 0, 0.2, 0);
    gem.scale.set(1, 1.15, 0.8);
    const collet = torus(0.15, 0.035, gold); collet.position.y = 0.2; collet.scale.set(1, 1.15, 1);
    g.add(gem, collet, sph(0.045, gold, 0, 0.42, 0), cyl(0.05, 0.09, 0.08, gold, 0, 0.02, 0));
    [-1, 1].forEach((d) => {
      const curl = torus(0.1, 0.03, gold, PI * 1.5); curl.position.set(d * 0.3, 0.1, 0); curl.rotation.z = d > 0 ? PI * 0.75 : -PI * 0.25; g.add(curl);
      g.add(sph(0.04, gold, d * 0.44, 0.1, 0));
      const arm = rbox(0.2, 0.045, 0.05, 0.02, gold, d * 0.2, 0.03, 0); g.add(arm);
    });
    return g;
  }
  const ICONS = {
    // ---- the hero row
    // ---- the hero row: four jewels, as in the mock-up: deep enamel in heavy gold, a gem set on top of each
    // the coach: a speech bubble of teal enamel in a gold frame, a gold crown between laurels on its face
    coach() {
      const g = new THREE.Group(), gold = M.gold(), teal = M.enamel('#00485a', { clearcoat: 0, specularIntensity: 0.25, roughness: 0.5, envMapIntensity: 0.1 });
      const w = 2.3, h = 1.6;
      const frame = extrude(roundRect(w, h, 0.42), 0.34, 0.07, gold); frame.position.set(0, h / 2 + 0.42, 0); g.add(frame);
      const tail = new THREE.Shape(); tail.moveTo(-0.3, 0.1); tail.lineTo(0.22, 0.1); tail.lineTo(-0.42, -0.5); tail.closePath();
      const t = extrude(tail, 0.3, 0.05, gold); t.position.set(-0.55, 0.42, 0); g.add(t);
      const face = extrude(roundRect(w - 0.26, h - 0.26, 0.32), 0.1, 0.05, teal); face.position.set(0, h / 2 + 0.42, 0.2); g.add(face);
      const inner = extrude(roundRect(w - 0.5, h - 0.5, 0.24), 0.02, 0.012, M.goldBright()); inner.position.set(0, h / 2 + 0.42, 0.262); inner.scale.set(1, 1, 0.3); g.add(inner);
      const face2 = extrude(roundRect(w - 0.56, h - 0.56, 0.21), 0.03, 0.012, teal); face2.position.set(0, h / 2 + 0.42, 0.27); g.add(face2);
      const c = crown(0.62, ['#ffe9a8', '#ffe9a8', '#ffe9a8']); c.traverse((m) => { if (m.isMesh) m.material = M.goldBright(); });
      c.position.set(0, 0.84, 0.46); c.rotation.x = 0.12; c.scale.set(0.74, 0.74, 0.4); g.add(c);
      const l1 = laurel(-1, 0.5, M.goldBright()), l2 = laurel(1, 0.5, M.goldBright()); l1.position.set(-0.5, 0.95, 0.32); l2.position.set(0.5, 0.95, 0.32); l1.scale.setScalar(0.62); l2.scale.setScalar(0.62); l1.rotation.z = 0.5; l2.rotation.z = -0.5; g.add(l1, l2);
      const f = finial('#047a78'); f.position.set(0, h + 0.5, 0.02); g.add(f);
      return { group: g, up: 0.5, yaw: -0.2, pitch: 0.1 };
    },
    // the lessons: an open book in a blue and gold binding, a gold flower on its page, a red ribbon
    lessons() {
      const g = new THREE.Group(), gold = M.gold(), bk = new THREE.Group();
      const blue = M.lacquer('#0a1c8c', { envMapIntensity: 0.1, clearcoat: 0, specularIntensity: 0.25, roughness: 0.5 }), pap = phys({ color: '#cc9e58', roughness: 0.8 });
      [-1, 1].forEach((s2) => {
        const rim = rbox(1.3, 0.05, 1.68, 0.02, gold); rim.position.set(s2 * 0.64, 0.07, 0); rim.rotation.z = s2 * -0.16;
        const cov = rbox(1.22, 0.07, 1.6, 0.02, blue); cov.position.set(s2 * 0.62, 0.1, 0); cov.rotation.z = s2 * -0.16;
        bk.add(rim, cov);
        // the page block: a few leaves, fanned
        for (let i = 0; i < 4; i++) { const pg = rbox(1.02 - i * 0.03, 0.05, 1.36 - i * 0.02, 0.02, pap); pg.position.set(s2 * (0.54 - i * 0.012), 0.17 + i * 0.045, 0); pg.rotation.z = s2 * (-0.16 - i * 0.03); bk.add(pg); }
        const edge = rbox(0.05, 0.2, 1.34, 0.02, M.goldSoft()); edge.position.set(s2 * 1.07, 0.3, 0); edge.rotation.z = s2 * -0.2; bk.add(edge);
      });
      bk.add(rbox(0.16, 0.12, 1.54, 0.04, gold, 0, 0.07, 0));
      const ink = M.enamel('#5a3408');
      for (let i = 0; i < 6; i++) { const l = rbox(i % 3 === 2 ? 0.42 : 0.64, 0.012, 0.045, 0.006, ink, -0.55 - (i % 3 === 2 ? 0.11 : 0), 0.4, -0.45 + i * 0.17); l.rotation.z = 0.28; bk.add(l); }
      // a gold fleur on the right page
      const leaf = new THREE.Shape(); leaf.moveTo(0, 0); leaf.quadraticCurveTo(0.16, 0.14, 0, 0.44); leaf.quadraticCurveTo(-0.16, 0.14, 0, 0);
      const fl = new THREE.Group();
      [-0.75, 0, 0.75].forEach((a2, i) => { const l = extrude(leaf, 0.03, 0.01, M.goldBright()); l.rotation.z = a2; l.scale.setScalar(i === 1 ? 1.15 : 0.85); fl.add(l); });
      fl.add(rbox(0.26, 0.05, 0.05, 0.02, M.goldBright(), 0, 0.02, 0)); const st = rbox(0.045, 0.3, 0.04, 0.015, M.goldBright(), 0, -0.14, 0); fl.add(st);
      fl.rotation.x = -PI / 2; fl.rotation.y = 0; fl.position.set(0.55, 0.42, 0.1); fl.rotation.order = 'ZXY'; fl.rotation.z = -0.28; bk.add(fl);
      // corners
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => { const cn = sph(0.085, gold, x * 1.22, 0.27, z * 0.82); bk.add(cn); });
      bk.rotation.x = 0.92;   // stood up to face the reader
      bk.position.y = 0.72; g.add(bk);
      const rib = rbox(0.2, 0.62, 0.03, 0.01, M.lacquer('#7c0618', { envMapIntensity: 0.15, clearcoat: 0.25, roughness: 0.5 }), 0.0, 0.16, 0.66); g.add(rib);
      const ribTip = new THREE.Shape(); ribTip.moveTo(-0.1, 0); ribTip.lineTo(0.1, 0); ribTip.lineTo(0.1, -0.16); ribTip.lineTo(0, -0.07); ribTip.lineTo(-0.1, -0.16); ribTip.closePath();
      const rt = extrude(ribTip, 0.03, 0.004, M.lacquer('#7c0618', { envMapIntensity: 0.15, clearcoat: 0.25, roughness: 0.5 })); rt.position.set(0, -0.15, 0.66); g.add(rt);
      const f = finial('#0c22a0'); f.position.set(0, 1.5, -0.42); g.add(f);
      return { group: g, up: 0.5, yaw: 0, pitch: 0.2 };
    },
    // playing online: a globe of green enamel under a gold grid, a pawn before it, a gold ring round it
    online() {
      const g = new THREE.Group(), gold = M.gold();
      const map = tex(1024, 512, (c, w, h) => {
        const sea = c.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, '#0d9a58'); sea.addColorStop(0.5, '#087040'); sea.addColorStop(1, '#044a2a');
        c.fillStyle = sea; c.fillRect(0, 0, w, h);
        c.strokeStyle = '#ffd060'; c.lineWidth = 6;
        for (let i = 0; i <= 12; i++) { c.beginPath(); c.moveTo((i / 12) * w, 0); c.lineTo((i / 12) * w, h); c.stroke(); }
        for (let i = 1; i < 7; i++) { c.beginPath(); c.moveTo(0, (i / 7) * h); c.lineTo(w, (i / 7) * h); c.stroke(); }
      });
      const globe = mesh(new THREE.SphereGeometry(0.95, 64, 48), phys({ map, color: '#c4c4c4', roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.35 }), 0, 1.0, 0);
      globe.rotation.set(0.25, -0.3, 0.12); g.add(globe);
      const ring = torus(1.3, 0.055, gold); ring.position.y = 1.0; ring.rotation.set(PI / 2 - 0.34, 0.2, 0); g.add(ring);
      const pawn = piece('p', 'w', 1.05, false); pawn.traverse((m) => { if (m.isMesh) m.material = phys({ color: '#e6bc6c', roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.6 }); }); pawn.position.set(0, 0.46, 1.0); g.add(pawn);
      const f = finial('#066a3a'); f.position.set(0, 1.93, 0); g.add(f);
      return { group: g, up: 0.5, yaw: -0.15, pitch: 0.14 };
    },
    // the boards: ruby and ivory squares in a deep gold frame, seen corner on
    boards() {
      const g = new THREE.Group(), gold = M.gold(), bd = new THREE.Group();
      const n = 6, sq = 0.34, W2 = n * sq;
      bd.add(rbox(W2 + 0.34, 0.26, W2 + 0.34, 0.05, gold, 0, 0.13, 0));
      bd.add(rbox(W2 + 0.1, 0.06, W2 + 0.1, 0.02, M.goldSoft(), 0, 0.27, 0));
      const ruby = M.lacquer('#600016', { envMapIntensity: 0.1, clearcoat: 0, specularIntensity: 0.25, roughness: 0.5 }), ivory = phys({ color: '#d2a868', roughness: 0.45, clearcoat: 0.8, envMapIntensity: 0.4 });
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) bd.add(rbox(sq * 0.96, 0.06, sq * 0.96, 0.02, (r + c) % 2 ? ruby : ivory, (c - (n - 1) / 2) * sq, 0.3, (r - (n - 1) / 2) * sq));
      // beads along the frame
      for (let i = 0; i < 14; i++) { const k = (i + 0.5) / 14 - 0.5, e = W2 / 2 + 0.17; [[k * (W2 + 0.3), e], [k * (W2 + 0.3), -e], [e, k * (W2 + 0.3)], [-e, k * (W2 + 0.3)]].forEach(([x, z]) => bd.add(sph(0.045, M.goldBright(), x, 0.13, z))); }
      bd.rotation.y = PI / 4; g.add(bd);
      const f = finial('#8a0424'); f.position.set(0, 0.3, -(W2 + 0.34) * 0.7071 - 0.05); f.scale.setScalar(1.7); f.rotation.x = -0.5; g.add(f);
      return { group: g, up: 0.5, yaw: 0, pitch: 0.72 };
    },
    explain() {
      const g = new THREE.Group();
      const b = bubble(2.1, 1.4, 0.6, M.lacquer('#7a3ab8'), -1); g.add(b);
      const pawn = piece('p', 'w', 1.05, false); pawn.position.set(-0.6, 0.42, 0.34); g.add(pawn);
      const arrow = new THREE.Shape(); arrow.moveTo(-0.55, -0.1); arrow.lineTo(0.1, -0.1); arrow.lineTo(0.1, -0.3); arrow.lineTo(0.55, 0); arrow.lineTo(0.1, 0.3); arrow.lineTo(0.1, 0.1); arrow.lineTo(-0.55, 0.1); arrow.closePath();
      const a = extrude(arrow, 0.12, 0.025, M.gold()); a.position.set(0.42, 1.02, 0.45); a.scale.setScalar(1.15); g.add(a);
      const sp = sparkle(0.14, M.glow('#ffd97a', 1.2)); sp.position.set(0.72, 1.5, 0.4); g.add(sp);
      return { group: g, up: 0.55 };
    },
    aloud() {
      const g = new THREE.Group(), gold = M.gold();
      const horn = lathe([[0, 0], [0.22, 0], [0.26, 0.2], [0.42, 0.7], [0.62, 1.05], [0.68, 1.12], [0.6, 1.1], [0.4, 0.7], [0.22, 0.3], [0.2, 0.06], [0, 0.06]], gold);
      const mega = new THREE.Group();
      horn.rotation.z = -PI / 2; horn.position.set(0.15, 0, 0);
      const body = rbox(0.5, 0.66, 0.66, 0.1, M.lacquer('#c33a2c'), 0, 0, 0), cap = sph(0.2, M.gold(), -0.3, 0, 0);
      const grip = rbox(0.18, 0.55, 0.22, 0.06, M.dark(), 0.1, -0.5, 0);
      mega.add(horn, body, cap, grip); mega.rotation.z = 0.35; mega.position.set(-1.0, 0.95, 0);
      const stand = rbox(0.9, 0.12, 0.9, 0.04, M.dark(), -0.9, 0.06, 0);
      g.add(mega, stand);
      [0.55, 0.95, 1.35].forEach((R, i) => { const arc = torus(R, 0.07, M.lacquer(['#3fc8ef', '#2a9fe0', '#1f6fd0'][i]), PI * 0.5); arc.rotation.z = -PI * 0.25; arc.position.set(0.0, 0.95, 0); g.add(arc); });
      const note = sph(0.1, gold, 1.15, 1.9, 0), stemN = rbox(0.04, 0.42, 0.04, 0.01, gold, 1.23, 2.08, 0), flag = rbox(0.18, 0.05, 0.04, 0.01, gold, 1.3, 2.26, 0); flag.rotation.z = -0.5;
      g.add(note, stemN, flag);
      return { group: g, up: 0.5 };
    },
    offline() {
      const g = new THREE.Group(), greens = ['#8ae86a', '#4fcf52', '#23a94a'];
      [0.55, 1.0, 1.45].forEach((R, i) => { const arc = torus(R, 0.13, M.lacquer(greens[i]), PI * 0.5); arc.rotation.z = PI * 0.25; arc.position.set(0, 0.22, 0); g.add(arc); });
      const dot = sph(0.16, M.lacquer(greens[0]), 0, 0.22, 0); g.add(dot);
      const slash = rbox(2.5, 0.2, 0.22, 0.08, M.lacquer('#ff4a4a'), 0, 0.9, 0.16); slash.rotation.z = PI / 4; g.add(slash);
      return { group: g, up: 0.5 };
    },
    progress() {
      const g = new THREE.Group();
      const base = rbox(2.2, 0.12, 1.0, 0.04, M.dark(), 0, 0.06, 0); g.add(base);
      [[-0.7, 0.6, '#ff5c8a'], [0, 1.0, '#b84fd8'], [0.7, 1.45, '#ffb43a']].forEach(([x, h, c]) => { g.add(rbox(0.48, h, 0.48, 0.06, M.lacquer(c), x, 0.12 + h / 2, 0)); });
      const st = extrude(star(5, 0.34, 0.15), 0.12, 0.03, M.gold()); st.position.set(0.7, 1.95, 0); st.rotation.z = -0.15; g.add(st);
      return { group: g, up: 0.5 };
    },
    // ---- Learn like never before
    'learn-lessons'() {
      const g = new THREE.Group();
      g.add(plinth(1.2, '#0e3b34'));
      const b = book(1.55, 0.36, 2.0, '#b8142f', { pages: '#f6eedd' }); b.rotation.y = -0.35; b.position.y = 0.0; g.add(b);
      const b2 = book(1.45, 0.3, 1.85, '#3a7a3a', { pages: '#f6eedd' }); b2.rotation.y = -0.2; b2.position.y = 0.36; g.add(b2);
      const em = cyl(0.36, 0.36, 0.03, M.gold(), 0.05, 0.68, 0); g.add(em);
      const kn = piece('n', 'w', 0.42, true); kn.position.set(0.05, 0.69, 0); kn.rotation.y = -0.5; g.add(kn);
      const rib = rbox(0.12, 0.02, 0.9, 0.01, M.lacquer('#f0c46a'), 0.3, 0.37, 0.9); rib.rotation.y = -0.2; g.add(rib);
      return { group: g, up: 0.4 };
    },
    'learn-puzzles'() {
      const g = new THREE.Group();
      g.add(plinth(1.2, '#3a1040'));
      const tilt = -1.05;
      [['#8a3ac8', 0, [1, 1, 0, 0], -0.52, -0.5], ['#f0b640', 0, [1, 0, 0, -1], 0.52, -0.5], ['#e8407a', 0, [0, 0, -1, 0], -0.52, 0.52]].forEach(([c, r, sides, x, z]) => {
        const p = extrude(jigsaw(0.95, sides), 0.14, 0.03, M.lacquer(c)); p.rotation.x = tilt; p.position.set(x, 0.1 + Math.abs(z) * 0.45 + 0.25, z * 0.5 + 0.1); g.add(p);
      });
      const pawn = piece('p', 'b', 0.55, false); pawn.position.set(0.55, 0.16, 0.55); g.add(pawn);
      return { group: g, up: 0.45 };
    },
    'learn-openings'() {
      const g = new THREE.Group();
      g.add(plinth(1.2, '#0f2a4a'));
      const arch = new THREE.Shape(); arch.moveTo(-0.9, 0); arch.lineTo(-0.9, 1.1); arch.absarc(0, 1.1, 0.9, PI, 0, true); arch.lineTo(0.9, 0); arch.closePath();
      const hole = new THREE.Path(); hole.moveTo(-0.68, 0); hole.lineTo(-0.68, 1.1); hole.absarc(0, 1.1, 0.68, PI, 0, true); hole.lineTo(0.68, 0); hole.closePath();
      arch.holes.push(hole);
      const frame = extrude(arch, 0.22, 0.03, M.gold()); frame.position.set(0, 0.02, 0); g.add(frame);
      const sky = tex(256, 512, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1b2f7a'); gr.addColorStop(0.45, '#ff8a4a'); gr.addColorStop(0.7, '#ffd36a'); gr.addColorStop(1, '#2c6fb0'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.arc(w * 0.5, h * 0.42, 26, 0, TAU); c.fill(); });
      const view = mesh(new THREE.PlaneGeometry(1.4, 1.95), phys({ map: sky, emissive: '#ffffff', emissiveMap: sky, emissiveIntensity: 0.9, roughness: 1 }), 0, 1.0, -0.2); g.add(view);
      [-1, 1].forEach((s) => { const door = rbox(0.66, 1.75, 0.08, 0.02, M.lacquer('#d8a63c')); door.position.set(s * 0.68, 0.9, 0); door.geometry.translate(s * -0.33, 0, 0); door.rotation.y = s * -1.15; door.position.z = 0.1; const knob = sph(0.04, M.gold(), s * -0.5, 0, 0.07); door.add(knob); g.add(door); });
      const step = cyl(0.95, 1.0, 0.08, M.gold(), 0, 0.04, 0.35), step2 = cyl(0.7, 0.75, 0.08, M.enamel('#f3e6cf'), 0, 0.12, 0.45); g.add(step, step2);
      return { group: g, up: 0.5 };
    },
    'learn-endgames'() {
      const g = new THREE.Group();
      g.add(plinth(1.2, '#3a1050'));
      const t = trophy(1.0); t.position.y = 0.02; g.add(t);
      const gold = M.goldSoft();
      const l1 = laurel(-1, 0.95, gold), l2 = laurel(1, 0.95, gold); l1.position.set(0.0, 0.5, 0.1); l2.position.set(0, 0.5, 0.1); g.add(l1, l2);
      [-1, 1].forEach((s) => { const rib = rbox(0.16, 0.8, 0.03, 0.01, M.lacquer('#b8142f'), s * 0.55, 0.7, 0.42); rib.rotation.z = s * 0.35; g.add(rib); });
      const em = piece('n', 'w', 0.26, true); em.position.set(0, 1.02, 0.56); em.rotation.y = -0.4; g.add(em);
      return { group: g, up: 0.5 };
    },
    // ---- Play for it
    trophy() {
      const g = new THREE.Group();
      g.add(cushion(2.4, '#8a1430'));
      const t = trophy(1.05); t.position.y = 0.46; g.add(t);
      const gold = M.goldSoft();
      const l1 = laurel(-1, 1.0, gold), l2 = laurel(1, 1.0, gold); l1.position.set(0, 0.95, 0.15); l2.position.set(0, 0.95, 0.15); g.add(l1, l2);
      return { group: g, up: 0.5 };
    },
    pass() {
      const g = new THREE.Group(), gold = M.goldBright();
      // a season ticket leaning back, its crown and stars in gold relief
      const t = new THREE.Group();
      t.add(extrude(roundRect(2.8, 1.55, 0.2), 0.14, 0.03, M.lacquer('#5a2aa8')));
      for (let i = 0; i < 7; i++) { const hole = cyl(0.03, 0.03, 0.3, M.dark(), 0.7, -0.66 + i * 0.22, 0, 12); hole.rotation.x = PI / 2; t.add(hole); }
      const c = extrude(crownShape(0.9), 0.1, 0.02, gold); c.position.set(-0.45, -0.22, 0.1); t.add(c);
      [-1, 1].forEach((d) => { const b = sph(0.07, gold, -0.45 + d * 0.45, 0.33, 0.12); const m = sph(0.08, gold, -0.45, 0.4, 0.12); t.add(b, m); });
      const l1 = laurel(-1, 0.52, gold), l2 = laurel(1, 0.52, gold); l1.position.set(-0.45, -0.5, 0.1); l2.position.set(-0.45, -0.5, 0.1); l1.scale.set(1.3, 1.1, 1); l2.scale.set(1.3, 1.1, 1); t.add(l1, l2);
      [[0.95, 0.2, 0.7], [0.95, -0.05, 0.5], [0.95, -0.3, 0.6]].forEach(([x, y, w]) => t.add(rbox(w, 0.05, 0.04, 0.015, gold, x + 0.1, y, 0.1)));
      [0.65, 0.95, 1.25].forEach((x, i) => { const st = extrude(star(5, 0.11, 0.05), 0.05, 0.01, i < 2 ? gold : M.enamel('#b9a0e8')); st.position.set(x, 0.5, 0.1); t.add(st); });
      t.rotation.x = -0.42; t.position.set(0, 0.78, 0);
      g.add(t);
      return { group: g, up: 0.5 };
    },
    daily() {
      const g = new THREE.Group();
      const pages = rbox(1.7, 1.75, 0.5, 0.04, M.paper('#fbf6ec'), 0, 0.88, 0); g.add(pages);
      const head = rbox(1.7, 0.4, 0.52, 0.04, M.lacquer('#c4182e'), 0, 1.56, 0); g.add(head);
      [-0.5, 0, 0.5].forEach((x) => { const r = torus(0.14, 0.035, M.gold()); r.position.set(x, 1.78, 0); r.rotation.y = PI / 2; g.add(r); });
      [1.15, 0.78, 0.41].forEach((y, i) => { const line = rbox(0.6, 0.05, 0.02, 0.01, M.enamel('#cfc4ae'), 0.35, y, 0.26); g.add(line); const ck = checkMark(M.lacquer('#2fae6a'), 0.3); ck.position.set(-0.3, y, 0.27); g.add(ck); });
      const pawn = piece('p', 'b', 0.6, false); pawn.position.set(-0.55, 0.0, 0.62); g.add(pawn);
      const b1 = book(0.9, 0.22, 1.2, '#8a1430'); b1.position.set(1.25, 0.0, 0.1); b1.rotation.y = -0.25; g.add(b1);
      const b2 = book(0.8, 0.2, 1.1, '#6d2a12'); b2.position.set(1.3, 0.22, 0.12); b2.rotation.y = -0.15; g.add(b2);
      return { group: g, up: 0.45 };
    },
    crown() {
      const g = new THREE.Group();
      g.add(cushion(2.3, '#8a1430'));
      const c = crown(1.2, ['#ff3b5c', '#2fd4ff', '#ffd23b', '#4ee07a']); c.position.y = 0.52; g.add(c);
      return { group: g, up: 0.5 };
    },
    // ---- For families
    nochat() {
      const g = new THREE.Group();
      g.add(plinth(1.2, '#3a1a40'));
      const b = bubble(1.9, 1.25, 0.55, M.lacquer('#3f86e8'), -1); b.position.set(-0.2, 0.05, 0); g.add(b);
      [-0.45, 0, 0.45].forEach((x) => g.add(sph(0.13, M.white(), x - 0.2, 0.97, 0.3)));
      const b2 = bubble(0.9, 0.6, 0.45, M.lacquer('#ff6fb0'), 1); b2.position.set(0.95, 0.25, 0.2); b2.scale.setScalar(0.85); g.add(b2);
      const no = noBadge(0.42); no.position.set(0.85, 0.55, 0.65); g.add(no);
      return { group: g, up: 0.5 };
    },
    noads() {
      const g = new THREE.Group();
      g.add(plinth(1.2, '#3a2a14'));
      const gold = M.gold();
      const horn = lathe([[0, 0], [0.2, 0], [0.24, 0.3], [0.5, 1.1], [0.72, 1.5], [0.78, 1.58], [0.7, 1.56], [0.46, 1.1], [0.2, 0.36], [0.18, 0.06], [0, 0.06]], gold);
      horn.rotation.z = -PI / 2 - 0.35; horn.position.set(-0.75, 0.7, 0);
      const cap = sph(0.22, M.lacquer('#c33a2c'), -0.88, 0.63, 0);
      const grip = rbox(0.22, 0.7, 0.3, 0.08, M.dark(), -0.95, 0.35, 0); grip.rotation.z = -0.35;
      const mouth = cyl(0.78, 0.78, 0.04, M.lacquer('#2a1a14'), 0, 0, 0); mouth.rotation.z = -PI / 2 - 0.35; mouth.position.set(0.66, 1.2, 0);
      g.add(horn, cap, grip);
      const no = noBadge(0.44); no.position.set(0.95, 0.75, 0.55); g.add(no);
      [0.3, 0, -0.3].forEach((a, i) => { const ray = rbox(0.42, 0.07, 0.07, 0.03, gold, 1.25 + Math.cos(a) * 0.1, 1.55 + Math.sin(a) * 0.5, 0); ray.rotation.z = a; g.add(ray); });
      return { group: g, up: 0.5 };
    },
    parents() {
      const g = new THREE.Group();
      g.add(plinth(1.2, '#123a2a'));
      const rim = extrude(shield(), 0.2, 0.04, M.gold()); rim.scale.set(1.12, 1.12, 1); rim.position.set(0, 1.15, -0.04);
      const sh = extrude(shield(), 0.22, 0.04, M.lacquer('#22b35a')); sh.position.set(0, 1.15, 0.04);
      g.add(rim, sh);
      const ck = checkMark(M.white(), 0.9); ck.position.set(0.02, 1.15, 0.22); g.add(ck);
      const gold = M.goldSoft();
      const l1 = laurel(-1, 1.05, gold), l2 = laurel(1, 1.05, gold); l1.position.set(0, 0.35, 0); l2.position.set(0, 0.35, 0); g.add(l1, l2);
      return { group: g, up: 0.5 };
    },
    healthy() {
      const g = new THREE.Group(), gold = M.gold();
      g.add(plinth(1.2, '#2a1a3a'));
      const capB = cyl(0.78, 0.78, 0.12, gold, 0, 0.06, 0), capT = cyl(0.78, 0.78, 0.12, gold, 0, 2.06, 0);
      g.add(capB, capT);
      for (let i = 0; i < 3; i++) { const a = (i / 3) * TAU + 0.5; g.add(cyl(0.05, 0.05, 1.94, gold, Math.cos(a) * 0.68, 1.06, Math.sin(a) * 0.68, 16)); }
      const glass = lathe([[0.58, 0.12], [0.62, 0.3], [0.5, 0.75], [0.12, 1.0], [0.1, 1.06], [0.12, 1.12], [0.5, 1.37], [0.62, 1.82], [0.58, 2.0]], M.glass('#e6f6ff'));
      g.add(glass);
      const sandB = lathe([[0, 0.12], [0.55, 0.12], [0.5, 0.3], [0.2, 0.55], [0, 0.6]], M.enamel('#f2c75c')), sandT = lathe([[0, 1.4], [0.45, 1.4], [0.2, 1.55], [0, 1.6]], M.enamel('#f2c75c'));
      const stream = cyl(0.025, 0.025, 0.5, M.enamel('#f2c75c'), 0, 0.88, 0, 12);
      g.add(sandB, sandT, stream);
      return { group: g, up: 0.5 };
    },
    // ---- Pricing
    free() {
      const g = new THREE.Group();
      g.add(plinth(1.0, '#3a1420'));
      const pawn = piece('p', 'w', 1.7, false); pawn.position.set(0, 0, 0); g.add(pawn);
      const ro = rosette(0.3, '#d8142e'); ro.position.set(0.32, 0.72, 0.5); ro.rotation.y = 0.35; ro.rotation.x = -0.1; g.add(ro);
      return { group: g, up: 0.5 };
    },
    premium() {
      const g = new THREE.Group();
      g.add(cushion(2.3, '#8a1430'));
      const c = crown(1.3, ['#ff3b5c', '#2fd4ff', '#ffd23b', '#4ee07a']); c.position.y = 0.52; g.add(c);
      return { group: g, up: 0.52 };
    },
    lifetime() {
      const g = new THREE.Group();
      g.add(plinth(1.1, '#3a2614'));
      const kn = piece('n', 'w', 1.35, true); kn.position.set(0, 0, 0); kn.rotation.y = -0.55; g.add(kn);
      const pts = [];
      for (let i = 0; i < 120; i++) { const t = (i / 120) * TAU, d = 1 + Math.sin(t) * Math.sin(t); pts.push([1.55 * Math.cos(t) / d, 0.8 + 1.4 * Math.sin(t) * Math.cos(t) / d, 0.4 * Math.sin(t * 2) + 0.25]); }
      const loop = tube(pts, 0.085, M.gold(), true); loop.position.y = 0.1; g.add(loop);
      [[-1.2, 1.5], [1.25, 0.35]].forEach(([x, y]) => { const sp = sparkle(0.12, M.glow('#fff0b0', 1.5)); sp.position.set(x, y, 0.6); g.add(sp); });
      return { group: g, up: 0.5 };
    },
    // ---- Collect
    sets() {
      const g = new THREE.Group();
      g.add(plinth(1.0, '#6a1020'));
      const kn = piece('n', 'w', 1.5, false); kn.rotation.y = -0.55; g.add(kn);
      return { group: g, up: 0.5 };
    },
    'boards-tile'() {
      const g = new THREE.Group();
      const map = tex(1024, 1024, (c, w, h) => {
        c.fillStyle = '#1d3f8a'; c.fillRect(0, 0, w, h);
        const m = 92, s = (w - m * 2) / 8;
        for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) { c.fillStyle = (r + q) % 2 ? '#1b2f66' : '#f2e8d0'; c.fillRect(m + q * s, m + r * s, s, s); }
        c.strokeStyle = '#f0c46a'; c.lineWidth = 10; c.strokeRect(m - 14, m - 14, w - m * 2 + 28, h - m * 2 + 28);
      });
      const top = phys({ map, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 }), side = M.lacquer('#152452');
      const b = mesh(new THREE.BoxGeometry(2.3, 0.2, 2.3), [side, side, top, side, side, side], 0, 0.1, 0);
      const rim = rbox(2.44, 0.1, 2.44, 0.03, M.gold(), 0, 0.03, 0);
      g.add(b, rim);
      const r = piece('r', 'w', 0.5, false); r.position.set(-0.55, 0.2, 0.3); g.add(r);
      const q = piece('q', 'b', 0.5, false); q.position.set(0.45, 0.2, -0.3); g.add(q);
      return { group: g, up: 0.35, yaw: 0.45 };
    },
    places() {
      // the Taj Mahal, small, by its pool
      const g = new THREE.Group(), marble = M.enamel('#f4ede0', { roughness: 0.3 }), cream = M.enamel('#efe4d2');
      const base = rbox(3.0, 0.16, 1.9, 0.03, cream, 0, 0.08, -0.4); g.add(base);
      const main = rbox(1.3, 1.0, 1.3, 0.06, marble, 0, 0.66, -0.4); g.add(main);
      const arch = new THREE.Shape(); arch.moveTo(-0.22, 0); arch.lineTo(-0.22, 0.35); arch.absarc(0, 0.35, 0.22, PI, 0, true); arch.lineTo(0.22, 0); arch.closePath();
      const iwan = extrude(arch, 0.1, 0.0, M.lacquer('#2a1a1a')); iwan.position.set(0, 0.18, 0.26); g.add(iwan);
      const dome = lathe([[0, 1.9], [0.12, 1.88], [0.3, 1.8], [0.47, 1.62], [0.52, 1.4], [0.46, 1.22], [0.42, 1.14], [0, 1.14]], marble); dome.position.z = -0.4; g.add(dome);
      const fin = cone(0.05, 0.3, M.gold(), 0, 2.02, -0.4), finb = sph(0.04, M.gold(), 0, 2.2, -0.4); g.add(fin, finb);
      [[-0.48, -0.88], [0.48, -0.88], [-0.48, 0.08], [0.48, 0.08]].forEach(([x, z]) => { const ch = cyl(0.14, 0.14, 0.2, marble, x, 1.26, z); const d = sph(0.16, marble, x, 1.42, z); d.scale.set(1, 0.9, 1); g.add(ch, d); });
      [[-1.38, -1.25], [1.38, -1.25], [-1.38, 0.45], [1.38, 0.45]].forEach(([x, z]) => { const m = cyl(0.08, 0.1, 1.5, marble, x, 0.91, z); const d = sph(0.12, marble, x, 1.72, z); g.add(m, d); });
      const pool = rbox(0.5, 0.06, 1.4, 0.02, phys({ color: '#1c6f9c', roughness: 0.05, clearcoat: 1, metalness: 0.2 }), 0, 0.03, 1.25); g.add(pool);
      [[-0.5, 0.9], [0.5, 0.9], [-0.5, 1.5], [0.5, 1.5]].forEach(([x, z]) => g.add(cone(0.13, 0.55, M.lacquer('#1f6b3a'), x, 0.28, z, 24)));
      return { group: g, up: 0.42 };
    },
    // ---- About
    'pillar-play'() { const g = new THREE.Group(); const r = piece('r', 'w', 1.5, true); g.add(r); return { group: g, up: 0.5 }; },
    'pillar-learn'() { const g = new THREE.Group(); const b = openBook('#d8a63c', '#fff4dc'); b.traverse((m) => { if (m.isMesh && m.material.color && m.material.color.getHex() !== 0xc9b48c) m.material = M.gold(); }); g.add(b); return { group: g, up: 0.45 }; },
    'pillar-friends'() {
      const g = new THREE.Group();
      [[-0.75, 0.2, 1.0], [0, -0.1, 1.15], [0.75, 0.2, 1.0]].forEach(([x, z, s], i) => { const p = piece('p', 'w', s, true); p.position.set(x, 0, z); g.add(p); });
      return { group: g, up: 0.45 };
    },
    // ---- And the details (round tab medallions)
    'fx-capture'() {
      const g = new THREE.Group(), core = sph(0.36, M.glow('#ff9a3a', 1.6), 0, 1.0, 0); g.add(core); g.add(sph(0.2, M.glow('#fff4c0', 2.4), 0, 1.0, 0.2));
      for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, L = i % 2 ? 0.55 : 0.95; const sp = cone(0.08, L, M.glow(i % 3 ? '#ff9a3a' : '#ffe08a', 1.2), 0, 0, 0, 16); sp.position.set(Math.cos(a) * (0.3 + L / 2), 1.0 + Math.sin(a) * (0.3 + L / 2), 0); sp.rotation.z = a - PI / 2; g.add(sp); }
      [[1.2, 1.9], [-1.3, 0.3], [0.9, 0.0]].forEach(([x, y]) => { const s = sparkle(0.12, M.glow('#fff0b0', 1.5)); s.position.set(x, y, 0.1); g.add(s); });
      return { group: g, up: 0.5, flat: true };
    },
    'fx-victory'() {
      const g = new THREE.Group();
      [[0, 1.15, '#ffd23b', 0.8], [-0.95, 0.55, '#ff5c8a', 0.55], [0.95, 0.65, '#3fc8ef', 0.55]].forEach(([x, y, c, L]) => {
        for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const st = cyl(0.045, 0.045, L, M.glow(c, 1.4), 0, 0, 0, 10); st.position.set(x + Math.cos(a) * L / 2, y + Math.sin(a) * L / 2, 0); st.rotation.z = a + PI / 2; g.add(st); g.add(sph(0.08, M.glow('#ffffff', 1.4), x + Math.cos(a) * L, y + Math.sin(a) * L, 0)); } g.add(sph(0.14, M.glow(c, 2), x, y, 0.05));
      });
      return { group: g, up: 0.5, flat: true };
    },
    'fx-trail'() {
      const g = new THREE.Group();
      const head = sph(0.3, M.glow('#ff6fd0', 1.6), 0.9, 1.4, 0); g.add(head);
      for (let i = 1; i <= 12; i++) { const t = i / 12, x = 0.9 - t * 2.2, y = 1.4 - Math.sin(t * PI * 0.9) * 0.9; g.add(sph(0.26 * (1 - t * 0.85), M.glow(i % 2 ? '#b84fd8' : '#ff8ad8', 1.2), x, y, 0)); }
      [[-0.3, 1.5], [0.2, 0.5], [-1.1, 1.2]].forEach(([x, y]) => { const s = sparkle(0.1, M.glow('#fff0b0', 1.5)); s.position.set(x, y, 0.15); g.add(s); });
      return { group: g, up: 0.5, flat: true };
    },
    'fx-clock'() {
      const g = new THREE.Group(), gold = M.gold();
      const body = rbox(2.4, 1.1, 0.9, 0.12, M.lacquer('#7a1424'), 0, 0.55, 0); g.add(body);
      [-0.62, 0.62].forEach((x, i) => { const face = cyl(0.4, 0.4, 0.06, M.white(), x, 0.56, 0.45); face.rotation.x = PI / 2; const ring = torus(0.4, 0.035, gold); ring.position.set(x, 0.56, 0.48); g.add(face, ring); const h1 = rbox(0.04, 0.28, 0.03, 0.01, M.dark(), x, 0.68, 0.5), h2 = rbox(0.2, 0.04, 0.03, 0.01, M.dark(), x + (i ? -0.08 : 0.08), 0.58, 0.5); g.add(h1, h2); const btn = cyl(0.14, 0.14, 0.18, gold, x, 1.15 + (i ? 0 : 0.08), 0); g.add(btn); });
      g.add(rbox(2.5, 0.12, 1.0, 0.03, gold, 0, 0.06, 0));
      return { group: g, up: 0.5 };
    },
    'fx-sound'() {
      const g = new THREE.Group();
      g.add(rbox(2.3, 0.12, 0.8, 0.04, M.dark(), 0, 0.06, 0));
      const teal = ['#7fe3d6', '#4fcabc', '#2bb3a6', '#179a90', '#2bb3a6', '#4fcabc'];
      [0.5, 1.1, 1.7, 1.3, 0.8, 0.45].forEach((h, i) => { g.add(rbox(0.26, h, 0.26, 0.1, M.lacquer(teal[i]), -0.95 + i * 0.38, 0.12 + h / 2, 0)); });
      const gold = M.gold(), note = sph(0.13, gold, 0.95, 1.75, 0), stemN = rbox(0.05, 0.55, 0.05, 0.012, gold, 1.05, 2.0, 0), flag = rbox(0.24, 0.07, 0.05, 0.012, gold, 1.15, 2.24, 0); flag.rotation.z = -0.5; note.scale.set(1.2, 0.9, 1); note.rotation.z = 0.4;
      g.add(note, stemN, flag);
      return { group: g, up: 0.5 };
    },
    // ---- the Train section: one object per trainer, each in its own colour
    'tr-openings'() {
      // a pawn stepping forward off a little board corner, a gold arrow showing the way
      const g = new THREE.Group();
      g.add(tiles(3, 3, 0.5, '#f3e3c2', '#2f7a5a'));
      const p = piece('p', 'w', 1.2, false); p.position.set(-0.1, 0.12, -0.05); g.add(p);
      const a = arrowUp(M.lacquer('#ffb43a'), 0.9); a.position.set(0.55, 0.14, 0.32); a.rotation.set(-PI / 2, 0, 0); g.add(a);
      const sp = sparkle(0.14, M.glow('#ffe08a', 1.3)); sp.position.set(-0.55, 1.1, 0.2); g.add(sp);
      return { group: g, up: 0.42 };
    },
    'tr-time'() {
      // an hourglass in a gold frame, teal sand running through
      const g = new THREE.Group(), gold = M.gold();
      g.add(cyl(0.72, 0.76, 0.16, gold, 0, 0.08, 0), cyl(0.72, 0.68, 0.16, gold, 0, 2.02, 0));
      [0, 1, 2].forEach((i) => { const a = (i / 3) * TAU + 0.5; g.add(cyl(0.05, 0.05, 1.8, M.lacquer('#7a1424'), Math.cos(a) * 0.58, 1.05, Math.sin(a) * 0.58)); });
      const bulb = lathe([[0.02, 0.18], [0.42, 0.24], [0.5, 0.5], [0.3, 0.86], [0.06, 1.05], [0.3, 1.24], [0.5, 1.6], [0.42, 1.86], [0.02, 1.92]], M.glass('#e8f6ff'));
      g.add(bulb);
      g.add(lathe([[0, 0.2], [0.4, 0.26], [0.44, 0.42], [0.2, 0.46], [0, 0.6]], M.lacquer('#2bc4b0')));
      g.add(lathe([[0, 1.5], [0.36, 1.62], [0.44, 1.78], [0, 1.84]], M.lacquer('#2bc4b0')));
      g.add(cyl(0.02, 0.02, 0.9, M.glow('#7ff0e0', 1.2), 0, 0.98, 0));
      return { group: g, up: 0.5, pitch: 0.2 };
    },
    'tr-resource'() {
      // a glowing bulb with a small gold knight inside: a bright idea when things look hard
      const g = new THREE.Group();
      g.add(cyl(0.34, 0.3, 0.4, M.gold(), 0, 0.2, 0));
      [0.1, 0.22, 0.34].forEach((y) => { const r = torus(0.345, 0.03, M.goldBright()); r.rotation.x = PI / 2; r.position.y = y; g.add(r); });
      const glass = lathe([[0.3, 0.4], [0.36, 0.55], [0.7, 1.0], [0.78, 1.35], [0.64, 1.75], [0.32, 1.95], [0.02, 2.0]], M.glass('#ffe9a8'));
      g.add(glass);
      const n = piece('n', 'w', 1.0, true); n.position.set(0, 0.42, 0); n.rotation.y = -0.6; g.add(n);
      [[-0.95, 1.7], [0.95, 1.6], [-0.75, 2.15], [0.8, 2.1]].forEach(([x, y], i) => { const s = sparkle(i < 2 ? 0.14 : 0.09, M.glow('#ffe08a', 1.4)); s.position.set(x, y, 0.1); g.add(s); });
      return { group: g, up: 0.5 };
    },
    'tr-advantage'() {
      // steps climbing to a gold king: turn a lead into a win
      const g = new THREE.Group();
      const cols = ['#e8407a', '#b84fd8', '#3a7cf0', '#2bc4b0'];
      cols.forEach((c, i) => { const h = 0.3 + i * 0.32; g.add(rbox(0.5, h, 0.8, 0.06, M.lacquer(c), -0.8 + i * 0.52, h / 2, 0)); });
      const k = piece('k', 'w', 0.8, true); k.position.set(0.76, 1.26, 0); g.add(k);
      const p = piece('p', 'b', 0.5, false); p.position.set(-0.8, 0.3, 0.05); g.add(p);
      return { group: g, up: 0.5 };
    },
    'tr-endgame'() {
      // a king walks his last pawn up the board, a little crown waiting above it
      const g = new THREE.Group();
      g.add(tiles(3, 3, 0.56, '#f6e7c8', '#7a3a8a'));
      const k = piece('k', 'w', 1.05, false); k.position.set(-0.5, 0.12, 0.1); g.add(k);
      const p = piece('p', 'w', 1.0, false); p.position.set(0.5, 0.12, -0.25); g.add(p);
      const top = new THREE.Box3().setFromObject(p).max.y;
      const c = crown(0.42, ['#ff3b5c', '#2fd4ff', '#ffd23b']); c.position.set(0.5, top + 0.12, -0.25); g.add(c);
      const sp = sparkle(0.12, M.glow('#ffe08a', 1.3)); sp.position.set(0.95, top + 0.3, 0); g.add(sp);
      return { group: g, up: 0.42 };
    },
    'tr-tactics'() {
      // a gold knight struck by a lacquer lightning bolt
      const g = new THREE.Group();
      g.add(plinth(0.95, '#1d2f7a'));
      const n = piece('n', 'w', 1.5, true); n.position.set(-0.2, 0.02, 0); n.rotation.y = -0.4; g.add(n);
      const s = new THREE.Shape(); s.moveTo(0.1, 1); s.lineTo(-0.35, 0.05); s.lineTo(-0.02, 0.05); s.lineTo(-0.2, -0.9); s.lineTo(0.38, 0.22); s.lineTo(0.04, 0.22); s.lineTo(0.3, 1); s.closePath();
      const bolt = extrude(s, 0.16, 0.04, M.lacquer('#ffc21a', { emissive: '#ff9a00', emissiveIntensity: 0.25 })); bolt.position.set(0.72, 1.35, 0.2); bolt.rotation.z = -0.12; g.add(bolt);
      return { group: g, up: 0.5 };
    },
    'tr-blunder'() {
      // a red lacquer shield with a gold check: look twice before you move
      const g = new THREE.Group();
      const sh = extrude(shield(), 0.22, 0.06, M.lacquer('#c4182e')); sh.position.y = 1.1; g.add(sh);
      const rim = extrude(shield(), 0.12, 0.03, M.gold()); rim.scale.setScalar(1.08); rim.position.set(0, 1.1, -0.08); g.add(rim);
      const ck = checkMark(M.gold(), 0.9); ck.position.set(0, 1.08, 0.2); g.add(ck);
      g.add(rbox(1.4, 0.12, 0.6, 0.05, M.dark(), 0, 0.06, 0));
      return { group: g, up: 0.5, flat: true };
    },
    'tr-intuition'() {
      // a crystal ball on a gold stand, a gold knight inside and a violet glow
      const g = new THREE.Group();
      g.add(lathe([[0, 0], [0.6, 0], [0.62, 0.08], [0.42, 0.2], [0.3, 0.42], [0.46, 0.52], [0, 0.56]], M.gold()));
      g.add(sph(0.78, M.glass('#c8a8ff'), 0, 1.25, 0));
      const n = piece('n', 'w', 0.85, true); n.position.set(0, 0.62, 0); n.rotation.y = -0.4; g.add(n);
      const halo = torus(0.5, 0.025, M.glow('#b890ff', 1.4)); halo.rotation.x = PI / 2 - 0.25; halo.position.y = 1.35; g.add(halo);
      [[-0.95, 1.8], [0.9, 1.6], [0.62, 2.15]].forEach(([x, y], i) => { const s = sparkle(i ? 0.09 : 0.14, M.glow('#e8d8ff', 1.5)); s.position.set(x, y, 0.2); g.add(s); });
      return { group: g, up: 0.5 };
    },
    'tr-360'() {
      // a gold pawn inside two crossing orbit rings: see the board from every side
      const g = new THREE.Group();
      g.add(plinth(1.0, '#0e5a52'));
      const p = piece('p', 'w', 1.35, true); p.position.y = 0.02; g.add(p);
      const r1 = torus(0.92, 0.055, M.lacquer('#2bc4b0')); r1.position.y = 0.72; r1.rotation.set(PI / 2 - 0.42, 0, 0); g.add(r1);
      const r2 = torus(0.92, 0.055, M.lacquer('#ff8a3a')); r2.position.y = 0.72; r2.rotation.set(PI / 2 + 0.42, 0, 0); r2.rotation.order = 'YXZ'; r2.rotation.y = PI / 2; g.add(r2);
      g.add(sph(0.1, M.glow('#fff0b0', 1.4), 0.92, 0.72, 0), sph(0.08, M.glow('#fff0b0', 1.4), -0.3, 1.5, 0.3));
      return { group: g, up: 0.45 };
    },
    'tr-retry'() {
      // a curved arrow going round a pawn: try your mistakes again
      const g = new THREE.Group();
      g.add(plinth(0.9, '#4a1040'));
      const p = piece('p', 'b', 1.3, false); p.position.y = 0.02; g.add(p);
      const arc = torus(0.85, 0.09, M.lacquer('#e8407a'), PI * 1.55); arc.position.y = 0.95; arc.rotation.set(0, 0, 0.5); g.add(arc);
      const head = cone(0.22, 0.4, M.lacquer('#e8407a')); const a = 0.5 + PI * 1.55; head.position.set(Math.cos(a) * 0.85, 0.95 + Math.sin(a) * 0.85, 0); head.rotation.z = a; g.add(head);
      return { group: g, up: 0.5, flat: true, pitch: 0.18 };
    },
    'tr-defences'() {
      // a gold rook behind a low wall of lacquer stones
      const g = new THREE.Group();
      const r = piece('r', 'w', 1.15, true); r.position.set(0, 0, -0.35); g.add(r);
      const cols = ['#3a7cf0', '#2f5ac8', '#4a8af8'];
      for (let i = 0; i < 4; i++) g.add(rbox(0.44, 0.3, 0.32, 0.06, M.lacquer(cols[i % 3]), -0.69 + i * 0.46, 0.15, 0.35));
      for (let i = 0; i < 3; i++) g.add(rbox(0.44, 0.3, 0.32, 0.06, M.lacquer(cols[(i + 1) % 3]), -0.46 + i * 0.46, 0.46, 0.35));
      return { group: g, up: 0.45 };
    },
    'tr-blindfold'() {
      // a gold knight with a red velvet blindfold tied round its head: play it in your head
      const g = new THREE.Group();
      g.add(plinth(0.95, '#2a2a46'));
      const n = piece('n', 'w', 1.45, true); n.rotation.y = -1.1; g.add(n); n.updateMatrixWorld(true);
      // where the head is: the points in the top part of the knight
      const top = new THREE.Box3().setFromObject(n).max.y, v = new THREE.Vector3(), hb = new THREE.Box3();
      n.traverse((o) => { if (!o.isMesh) return; const a = o.geometry.attributes.position; for (let k = 0; k < a.count; k += 3) { v.fromBufferAttribute(a, k).applyMatrix4(o.matrixWorld); if (v.y > top * 0.66 && v.y < top * 0.8) hb.expandByPoint(v); } });
      const c = hb.getCenter(new THREE.Vector3()), sz = hb.getSize(new THREE.Vector3());
      const red = phys({ color: '#c8102e', roughness: 0.75, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#ff9aa8'), side: THREE.DoubleSide });
      const tie = new THREE.Group(); tie.position.set(c.x, top * 0.75, c.z); tie.rotation.z = -0.14; g.add(tie);
      const rx = sz.x * 0.56, rz = sz.z * 0.56;
      const band = mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, true), red); band.scale.set(rx * 0.92, top * 0.09, rz * 0.92); tie.add(band);
      [1, -1].forEach((d) => { const t = torus(1, 0.012, M.goldBright()); t.rotation.x = PI / 2; t.scale.set(rx * 0.92, rz * 0.92, 1); t.position.y = d * top * 0.045; tie.add(t); });
      const bx = rx * 0.92, bz = rz * 0.3;
      tie.add(tube([[bx, 0, bz], [bx + 0.16, -0.2, bz - 0.05], [bx + 0.1, -0.42, bz]], 0.04, red));
      tie.add(tube([[bx, 0, bz], [bx + 0.26, -0.1, bz + 0.08], [bx + 0.32, -0.34, bz + 0.05]], 0.04, red));
      return { group: g, up: 0.55 };
    },
    'tr-patterns'() {
      // a little board whose squares light up in a mating pattern
      const g = new THREE.Group();
      g.add(rbox(1.9, 0.14, 1.9, 0.05, M.gold(), 0, 0.07, 0));
      const lit = new Set([0, 4, 8, 6, 2]);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const i = r * 3 + c, on = lit.has(i);
        g.add(rbox(0.56, on ? 0.2 : 0.12, 0.56, 0.06, on ? M.lacquer(['#e8407a', '#b84fd8', '#2bc4b0', '#ffb43a', '#3a7cf0'][[0, 2, 4, 6, 8].indexOf(i)]) : M.enamel((r + c) % 2 ? '#3a2418' : '#f3e3c2'), -0.6 + c * 0.6, 0.14 + (on ? 0.1 : 0.06), -0.6 + r * 0.6));
      }
      const q = piece('q', 'w', 0.7, true); q.position.set(0, 0.34, 0); g.add(q);
      return { group: g, up: 0.35 };
    },
    'fx-avatar'() { const g = new THREE.Group(); const k = piece('k', 'w', 1.3, true); k.rotation.y = -0.3; g.add(k); return { group: g, up: 0.5 }; },
    'fx-frame'() {
      const g = new THREE.Group();
      const ring = torus(0.95, 0.16, M.gold()); ring.position.y = 1.05; g.add(ring);
      const disc = cyl(0.84, 0.84, 0.08, M.velvet('#4a1030'), 0, 1.05, 0); disc.rotation.x = PI / 2; g.add(disc);
      const p = piece('p', 'w', 1.0, false); p.position.set(0, 0.5, 0.25); g.add(p);
      return { group: g, up: 0.5 };
    },
  };

  function build(name) {
    const r = ICONS[name]();
    r.group.updateMatrixWorld(true);
    if (FIT[name]) r.fit = FIT[name];
    return r;
  }
  // broad icons are framed a little smaller
  const FIT = { 'tr-blunder': 0.7, parents: 0.74, 'fx-frame': 0.76, 'tr-retry': 0.78, 'learn-lessons': 0.8, explain: 0.8, 'fx-clock': 0.84, daily: 0.84, pass: 0.84, 'tr-time': 0.84, healthy: 0.84, 'learn-openings': 0.84 };
  return { ICONS, build };
}
if (typeof module !== 'undefined') module.exports = ChacklateIcons;
