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
    gold: (c) => phys({ color: c || '#ffd37c', metalness: 1, roughness: 0.18, clearcoat: 0.5, clearcoatRoughness: 0.14, envMapIntensity: 1.6 }),
    goldSoft: () => phys({ color: '#f2c45e', metalness: 1, roughness: 0.32, envMapIntensity: 1.45 }),
    // small gold parts: rougher, so they read bright from every angle instead of mirroring the dark room
    goldBright: () => phys({ color: '#ffd98a', metalness: 0.92, roughness: 0.4, envMapIntensity: 1.9 }),
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
  function sparkle(size, mat) {
    const s = extrude(star(4, size, size * 0.3), size * 0.3, size * 0.06, mat);
    return s;
  }

  // ------------------------------------------------------------------ the icons
  // Each returns a Group standing on y = 0; `up` is a hint for where the camera looks (the
  // icon's centre of interest), as a fraction of its height.
  const ICONS = {
    // ---- the hero row
    coach() {
      const g = new THREE.Group();
      const b = bubble(2.3, 1.5, 0.62, M.lacquer('#1b9c8e'), -1); g.add(b);
      const c = crown(0.6, ['#ff3b5c', '#2fd4ff', '#ffd23b']); c.position.set(0, 0.62, 0.36); c.rotation.x = 0.12; g.add(c);
      const gold = M.gold();
      const l1 = laurel(-1, 0.42, M.goldBright()), l2 = laurel(1, 0.42, M.goldBright()); l1.position.set(-0.42, 0.62, 0.5); l2.position.set(0.42, 0.62, 0.5); l1.scale.setScalar(0.8); l2.scale.setScalar(0.8); g.add(l1, l2);
      return { group: g, up: 0.55 };
    },
    lessons() {
      const g = new THREE.Group();
      const b = openBook('#b8142f', '#f8f1e3'); g.add(b);
      const em = piece('n', 'w', 0.5, true); em.position.set(0.45, 0.3, 0.05); em.rotation.set(0, -0.6, -0.16); g.add(em);
      const rib = rbox(0.14, 0.02, 0.9, 0.01, M.lacquer('#c4182e'), -0.5, 0.29, 0.5); rib.rotation.z = 0.16; rib.rotation.y = 0.1; g.add(rib);
      const sp = sparkle(0.16, M.glow('#ffd97a', 1.2)); sp.position.set(-0.55, 0.9, 0.2); g.add(sp);
      const sp2 = sparkle(0.1, M.glow('#ffd97a', 1.2)); sp2.position.set(-0.8, 0.62, 0.35); g.add(sp2);
      return { group: g, up: 0.45 };
    },
    online() {
      const g = new THREE.Group();
      const map = tex(1024, 512, (c, w, h) => {
        const sea = c.createLinearGradient(0, 0, 0, h); sea.addColorStop(0, '#2bb9a7'); sea.addColorStop(1, '#0d6f7a');
        c.fillStyle = sea; c.fillRect(0, 0, w, h);
        c.fillStyle = '#5ad46c';
        const r = K.rng(11);
        const blob = (x, y, rx, ry, n) => { c.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, k = 0.75 + r() * 0.5; const px = x + Math.cos(a) * rx * k, py = y + Math.sin(a) * ry * k; if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); c.fill(); };
        blob(240, 190, 120, 90, 14); blob(330, 330, 70, 80, 12); blob(600, 170, 150, 70, 16); blob(700, 330, 90, 70, 12); blob(880, 240, 60, 50, 10); blob(60, 300, 60, 40, 10);
        c.fillStyle = 'rgba(255,255,255,0.25)'; c.fillRect(0, 0, w, 40); c.fillRect(0, h - 40, w, 40);
      });
      const globe = mesh(new THREE.SphereGeometry(0.95, 64, 48), phys({ map, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1 }), 0, 1.05, 0);
      globe.rotation.y = -0.6; g.add(globe);
      const stand = cyl(0.26, 0.5, 0.12, M.gold(), 0, 0.06, 0), stem = cyl(0.07, 0.07, 0.2, M.gold(), 0, 0.18, 0);
      const ring = torus(1.28, 0.05, M.gold()); ring.position.y = 1.05; ring.rotation.x = PI / 2 - 0.4; ring.rotation.z = 0.15; g.add(ring, stand, stem);
      const pawn = piece('p', 'w', 0.55, true); pawn.position.set(1.05, 1.0, 0.55); pawn.rotation.x = 0.1; g.add(pawn);
      return { group: g, up: 0.5 };
    },
    boards() {
      const g = new THREE.Group();
      const map = tex(1024, 1024, (c, w, h) => {
        c.fillStyle = '#7a1424'; c.fillRect(0, 0, w, h);
        const m = 92, s = (w - m * 2) / 8;
        for (let r = 0; r < 8; r++) for (let q = 0; q < 8; q++) { c.fillStyle = (r + q) % 2 ? '#8e1d2b' : '#f4e7d1'; c.fillRect(m + q * s, m + r * s, s, s); }
        c.strokeStyle = '#f0c46a'; c.lineWidth = 10; c.strokeRect(m - 14, m - 14, w - m * 2 + 28, h - m * 2 + 28);
        c.lineWidth = 4; c.strokeRect(34, 34, w - 68, h - 68);
        c.fillStyle = '#f0c46a';
        for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; c.beginPath(); c.arc(w / 2 + Math.cos(a) * (w / 2 - 40), h / 2 + Math.sin(a) * (h / 2 - 40), 5, 0, TAU); c.fill(); }
      });
      const top = phys({ map, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
      const side = M.lacquer('#5e0f1c');
      const b = mesh(new THREE.BoxGeometry(2.3, 0.18, 2.3), [side, side, top, side, side, side], 0, 0.09, 0);
      const rim = rbox(2.42, 0.1, 2.42, 0.03, M.gold(), 0, 0.03, 0);
      g.add(b, rim);
      const k = piece('k', 'w', 0.5, false); k.position.set(0.42, 0.18, 0.18); g.add(k);
      const n = piece('n', 'b', 0.5, false); n.position.set(-0.55, 0.18, -0.35); n.rotation.y = 0.9; g.add(n);
      const p = piece('p', 'w', 0.5, false); p.position.set(-0.3, 0.18, 0.55); g.add(p);
      return { group: g, up: 0.35 };
    },
    // ---- Meet Rooky's tiles
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
      [0.55, 1.0, 1.45].forEach((R, i) => { const arc = torus(R, 0.1, M.lacquer(greens[i]), PI * 0.5); arc.rotation.z = PI * 0.25; arc.position.set(0, 0.22, 0); g.add(arc); });
      const dot = sph(0.16, M.lacquer(greens[0]), 0, 0.22, 0); g.add(dot);
      const slash = rbox(2.5, 0.2, 0.22, 0.08, M.gold(), 0, 0.9, 0.12); slash.rotation.z = PI / 4; g.add(slash);
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
    return r;
  }
  return { ICONS, build };
}
if (typeof module !== 'undefined') module.exports = ChacklateIcons;
