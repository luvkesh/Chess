// Chacklate world: boards, rooms and their reflection environments, all built in code.
// Boards are inlaid fields (wood, marble, stone, lacquer, glass) set in carved frames with
// gold lines and coordinates. Rooms are lit interiors around a round table: panelled walls,
// windows onto a night sky, a fireplace, shelves of books, a chandelier, candles and a rug.
function ChacklateWorld(THREE, K) {
  'use strict';
  const { TAU, mix, clamp, MAT, TEX, canvasTex, rng, hex, fbm, noise2 } = K;
  const FONT_CAPS = '"Cinzel", "Cormorant Garamond", Georgia, serif';

  // ------------------------------------------------------------------ small helpers
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  function texFrom(c, o) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = o && o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (o && o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
    return t;
  }
  const rgba = (h, a) => { const [r, g, b] = hex(h); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  function shade(h, f) { const c = hex(h).map((v) => clamp(Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)), 0, 255)); return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join(''); }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function roundedSquare(half, r, segs) {
    const s = new THREE.Shape();
    s.moveTo(-half + r, -half);
    s.lineTo(half - r, -half); s.absarc(half - r, -half + r, r, -Math.PI / 2, 0, false);
    s.lineTo(half, half - r); s.absarc(half - r, half - r, r, 0, Math.PI / 2, false);
    s.lineTo(-half + r, half); s.absarc(-half + r, half - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(-half, -half + r); s.absarc(-half + r, -half + r, r, Math.PI, Math.PI * 1.5, false);
    void segs;
    return s;
  }
  // Extrude a flat shape upward (y) between y0 and y1 with a bevel.
  function slab(shape, y0, y1, bevel, curveSegments) {
    const g = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, y1 - y0 - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: curveSegments || 12 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, y0 + bevel, 0);
    return g;
  }

  // ------------------------------------------------------------------ painted materials
  // Tiles of wood or stone, painted once per tone and cropped for every square.
  function woodTile(light, dark, seed, o) {
    return TEX.wood(light, dark, Object.assign({ seed, lines: 44, w: 512, h: 512 }, o || {})).image;
  }
  function marbleTile(base, vein, o) { return TEX.marble(base, vein, Object.assign({ size: 512 }, o || {})).image; }
  const PAINT = {
    wood: (f, light) => (light
      ? woodTile(f.light, shade(f.light, -0.32), 1, Object.assign({ contrast: 0.42, figure: 0.07 }, f.woodLight))
      : woodTile(f.dark, shade(f.dark, -0.55), 7, Object.assign({ contrast: 0.7, figure: 0.16, lines: 38 }, f.woodDark))),
    marble: (f, light) => marbleTile(light ? f.light : f.dark, light ? (f.veinLight || '#8a8a90') : (f.veinDark || '#d8d8dc'), light ? f.marbleLight : f.marbleDark),
    malachite: (f, light) => (light ? marbleTile(f.light, f.veinLight || '#c8c0b0', { cloud: 0.12, strength: 0.4 }) : TEX.malachite({ size: 512, bands: 30 }).image),
    lapis: (f, light) => (light ? marbleTile(f.light, f.veinLight || '#b89a6a', f.marbleLight) : TEX.lapis({ size: 512 }).image),
    stone: (f, light) => TEX.stone(light ? f.light : f.dark, light ? shade(f.light, -0.2) : shade(f.dark, 0.25), { size: 512, scale: 4, cloud: 0.35, speckMix: 0.35 }).image,
    lacquer: (f, light) => TEX.mottle(light ? f.light : f.dark, { amount: 0.06 }).image,
  };
  // The 8x8 field: 256 px per square, a1 bottom-left as White sees it.
  function paintField(f) {
    const S = 256, c = canvas(S * 8), g = c.getContext('2d');
    const R = rng(f.seed || 11);
    const tiles = [PAINT[f.type](f, false), PAINT[f.type](f, true)];
    for (let r = 0; r < 8; r++) for (let fl = 0; fl < 8; fl++) {
      const light = (r + fl) % 2 === 1, img = tiles[light ? 1 : 0];
      const x = fl * S, y = (7 - r) * S;
      g.save(); g.beginPath(); g.rect(x, y, S, S); g.clip();
      const ox = R() * (img.width - S), oy = R() * (img.height - S);
      if (f.type === 'wood' && light !== ((fl + r) % 4 < 2)) { g.translate(x + S / 2, y + S / 2); g.rotate(Math.PI / 2); g.drawImage(img, ox, oy, S, S, -S / 2, -S / 2, S, S); }
      else g.drawImage(img, ox, oy, S, S, x, y, S, S);
      g.restore();
      // a faint tonal difference per square, as with real veneers and slabs
      g.fillStyle = R() > 0.5 ? 'rgba(255,255,255,' + (R() * 0.05) + ')' : 'rgba(0,0,0,' + (R() * 0.06) + ')';
      g.fillRect(x, y, S, S);
      if (f.motif && light) f.motif(g, x, y, S, R);
    }
    // inlay seams
    g.strokeStyle = f.seam || 'rgba(20,10,5,0.55)'; g.lineWidth = 2;
    for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * S, 0); g.lineTo(i * S, S * 8); g.moveTo(0, i * S); g.lineTo(S * 8, i * S); g.stroke(); }
    if (f.seamGold) {
      g.strokeStyle = f.seamGold; g.lineWidth = 3;
      for (let i = 1; i < 8; i++) { g.beginPath(); g.moveTo(i * S, 0); g.lineTo(i * S, S * 8); g.moveTo(0, i * S); g.lineTo(S * 8, i * S); g.stroke(); }
    }
    return c;
  }
  // Pietra dura flowers for the Mughal board's light squares.
  function flowerMotif(g, x, y, S, R) {
    const cx = x + S / 2, cy = y + S / 2;
    g.save(); g.translate(cx, cy);
    g.strokeStyle = 'rgba(70,110,60,0.85)'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, S * 0.32); g.bezierCurveTo(-8, S * 0.1, 8, -S * 0.05, 0, -S * 0.12); g.stroke();
    const petal = (a, col, len) => { g.save(); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, -len * 0.5, len * 0.22, len * 0.5, 0, 0, TAU); g.fill(); g.restore(); };
    for (let i = 0; i < 6; i++) petal((i / 6) * TAU + R() * 0.1, i % 2 ? 'rgba(178,48,58,0.9)' : 'rgba(205,92,70,0.9)', S * 0.16);
    g.fillStyle = 'rgba(232,184,80,0.95)'; g.beginPath(); g.arc(0, 0, S * 0.035, 0, TAU); g.fill();
    for (const s of [-1, 1]) { g.fillStyle = 'rgba(60,120,80,0.85)'; g.beginPath(); g.ellipse(s * S * 0.08, S * 0.16, S * 0.035, S * 0.09, s * 0.7, 0, TAU); g.fill(); }
    g.restore();
  }
  // Meander (Greek key) band painter used on frames.
  function meander(g, x0, y0, len, size, horizontal) {
    g.beginPath();
    const n = Math.floor(len / (size * 2));
    for (let i = 0; i < n; i++) {
      const u = i * size * 2;
      const P = (a, b) => (horizontal ? [x0 + u + a * size, y0 + b * size] : [x0 + b * size, y0 + u + a * size]);
      const pts = [[0, 1], [0, 0], [1.5, 0], [1.5, 0.75], [0.75, 0.75], [0.75, 0.4], [1.1, 0.4], [1.1, 0.55]];
      pts.forEach((p, k) => { const [px, py] = P(p[0], p[1]); if (k) g.lineTo(px, py); else g.moveTo(px, py); });
      const [ex, ey] = P(2, 1); g.moveTo(...P(0, 1)); g.lineTo(ex, ey);
    }
    g.stroke();
  }

  // ------------------------------------------------------------------ boards
  // field: how squares are painted; frame: the border's paint; inlay: line and lettering colour.
  const BOARDS = {
    walnut: { name: 'Walnut & Maple', field: { type: 'wood', light: '#e2c08e', dark: '#5e3824' }, frame: { type: 'wood', color: '#3b2216', grainLight: '#5a3524' }, inlay: '#d9b56a', label: '#f0d9a8', rim: 'gold' },
    regency: { name: 'Gilded Ebony', field: { type: 'lacquer', light: '#eee6d6', dark: '#16110f', seam: 'rgba(0,0,0,0.6)', seamGold: 'rgba(220,180,100,0.55)' }, frame: { type: 'lacquer', color: '#120d0b' }, inlay: '#e8c06a', label: '#f2d08a', rim: 'gold', gloss: 0.18 },
    marble: { name: 'Carrara & Nero', field: { type: 'marble', light: '#efede8', dark: '#232326', veinLight: '#9a9aa0', veinDark: '#d8d6d0' }, frame: { type: 'marble', color: '#2a2a2e', vein: '#9a968c' }, inlay: '#d8b46a', label: '#f0dcae', rim: 'gold', gloss: 0.12 },
    nile: { name: 'Sandstone & Lapis', field: { type: 'lapis', light: '#e3c99a', dark: '#1d2f7a', veinLight: '#b08850', marbleLight: { cloud: 0.4, strength: 0.25, freq: 1 } }, frame: { type: 'stone', color: '#8a6a3e', speck: '#c8a46a' }, inlay: '#f0c860', label: '#ffe2a0', rim: 'gold', motif: 'egypt' },
    athens: { name: 'Pentelic & Verde Antico', field: { type: 'marble', light: '#f1ece2', dark: '#1f3a30', veinLight: '#b0a898', veinDark: '#6fa088', marbleDark: { cloud: 0.5, strength: 0.6, freq: 3 } }, frame: { type: 'marble', color: '#e8e2d6', vein: '#b0a898' }, inlay: '#b8863b', label: '#5a4630', rim: 'bronze', motif: 'meander' },
    roma: { name: 'Porphyry & Travertine', field: { type: 'stone', light: '#e2d4b6', dark: '#5e1f24' }, frame: { type: 'stone', color: '#3a1416', speck: '#a8686a' }, inlay: '#c8954a', label: '#f0d8b0', rim: 'bronze' },
    mughal: { name: 'Taj Marble & Red Sandstone', field: { type: 'marble', light: '#f4f1ea', dark: '#9a3f2a', veinLight: '#c8c4bc', veinDark: '#c87a5a', marbleDark: { cloud: 0.5, strength: 0.25 } }, frame: { type: 'stone', color: '#8e3a26', speck: '#c87a5a' }, inlay: '#e8c06a', label: '#ffe8c0', rim: 'gold', motif: 'flowers' },
    ming: { name: 'Cinnabar & Gold', field: { type: 'lacquer', light: '#efe2c4', dark: '#9e1c16', seamGold: 'rgba(230,190,90,0.7)' }, frame: { type: 'lacquer', color: '#1a0c08' }, inlay: '#e8c06a', label: '#f4d28c', rim: 'gold', gloss: 0.14 },
    venice: { name: 'Murano Mirror Glass', field: { type: 'lacquer', light: '#dfe9f4', dark: '#14347c', seamGold: 'rgba(240,210,140,0.7)' }, frame: { type: 'lacquer', color: '#0c1830' }, inlay: '#f0d8a0', label: '#f6e8c4', rim: 'gold', gloss: 0.06, glass: true },
    winter: { name: 'Malachite & Onyx', field: { type: 'malachite', light: '#efe8dc', dark: '#13563a' }, frame: { type: 'lacquer', color: '#0c1e16' }, inlay: '#e8c06a', label: '#f2d696', rim: 'gold', gloss: 0.1 },
    deco: { name: 'Macassar & Chrome', field: { type: 'wood', light: '#e6dccb', dark: '#2a1a12', woodDark: { lines: 16, contrast: 0.92, warp: 2.4 }, woodLight: { lines: 70, contrast: 0.22 } }, frame: { type: 'lacquer', color: '#0e0e10' }, inlay: '#dfe3e8', label: '#e8ecf0', rim: 'chrome' },
    cocoa: { name: 'Cocoa & Cream', field: { type: 'lacquer', light: '#ecdcc4', dark: '#6a3d2a', seamGold: 'rgba(214,92,124,0.55)' }, frame: { type: 'wood', color: '#2c1a12', grainLight: '#4e3022' }, inlay: '#d9668a', label: '#f2e3cb', rim: 'gold', gloss: 0.16 },
    tournament: { name: 'Tournament Green', field: { type: 'lacquer', light: '#eceed0', dark: '#6f9150' }, frame: { type: 'wood', color: '#2e3a22', grainLight: '#4a5a36' }, inlay: '#d9d2a8', label: '#eeeed2', rim: 'bronze', gloss: 0.42 },
    rosewood: { name: 'Rosewood & Gold Leaf', field: { type: 'wood', light: '#e8c9a4', dark: '#5a2620', woodDark: { lines: 30, contrast: 0.8, warp: 2 } }, frame: { type: 'wood', color: '#2a100c', grainLight: '#5a2a20' }, inlay: '#e8b85a', label: '#f6dcae', rim: 'gold' },
    emerald: { name: 'Emerald & Ivory', field: { type: 'marble', light: '#f2ebda', dark: '#1d5a49', veinLight: '#bcae92', veinDark: '#62a891', marbleDark: { cloud: 0.5, strength: 0.5, freq: 3 } }, frame: { type: 'lacquer', color: '#0f2520' }, inlay: '#d8b46a', label: '#efe6cf', rim: 'gold', gloss: 0.1 },
    obsidian: { name: 'Obsidian Glass', field: { type: 'lacquer', light: '#8c919b', dark: '#121419' }, frame: { type: 'lacquer', color: '#0a0b0e' }, inlay: '#aab2c0', label: '#d5dae2', rim: 'chrome', gloss: 0.04, glass: true },
    sakura: { name: 'Sakura Lacquer', field: { type: 'lacquer', light: '#f6e2e5', dark: '#a03f58', seamGold: 'rgba(240,190,200,0.6)' }, frame: { type: 'lacquer', color: '#36121c' }, inlay: '#f2b8c6', label: '#ffe9ee', rim: 'gold', gloss: 0.1 },
    jaipur: { name: 'Jaipur Sandstone', field: { type: 'stone', light: '#ecd0a8', dark: '#b05e3c' }, frame: { type: 'stone', color: '#5a2c1b', speck: '#a8603c' }, inlay: '#f0c98c', label: '#fbe7c9', rim: 'gold', motif: 'flowers' },
    ruby: { name: 'Ruby Truffle', field: { type: 'lacquer', light: '#f2dcc8', dark: '#74122c', seamGold: 'rgba(232,184,90,0.7)' }, frame: { type: 'lacquer', color: '#22060e' }, inlay: '#e8b85a', label: '#ffd9e4', rim: 'gold', gloss: 0.06 },
    harvest: { name: 'Harvest Oak', field: { type: 'wood', light: '#e6c898', dark: '#7a522e' }, frame: { type: 'wood', color: '#3b2412', grainLight: '#5e3a1e' }, inlay: '#d0a060', label: '#f0dcb8', rim: 'bronze' },
    cacao: { name: 'Cacao Pod', field: { type: 'wood', light: '#f0dab6', dark: '#8a3826', woodDark: { lines: 24, contrast: 0.6 } }, frame: { type: 'lacquer', color: '#2a120c' }, inlay: '#e8b85a', label: '#f6e3c4', rim: 'gold' },
    origin: { name: 'Single Origin', field: { type: 'wood', light: '#f3e3c6', dark: '#3a1d10', woodDark: { lines: 16, contrast: 0.9, warp: 2.4 } }, frame: { type: 'marble', color: '#1a0e08', vein: '#8a6a4a' }, inlay: '#ffd27a', label: '#ffe9c4', rim: 'gold', gloss: 0.12 },
  };
  function frameTexture(b, side) {
    const N = 2048, c = canvas(N), g = c.getContext('2d');
    const half = 4.9, px = (u) => ((u + half) / (half * 2)) * N;
    const f = b.frame;
    // base paint
    if (f.type === 'wood') {
      // mitred rails: the grain runs along each side and meets at the corners
      const img = TEX.wood(f.grainLight || shade(f.color, 0.2), shade(f.color, -0.45), { lines: 60, w: 1024, h: 1024, seed: 3, contrast: 0.65, figure: 0.14 }).image;
      const a = px(-4.0), bb = px(4.0);
      const rail = (poly, rot) => {
        g.save(); g.beginPath(); poly.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
        if (rot) { g.translate(N / 2, N / 2); g.rotate(Math.PI / 2); g.drawImage(img, -N / 2, -N / 2, N, N); } else g.drawImage(img, 0, 0, N, N);
        g.restore();
      };
      rail([[0, 0], [N, 0], [bb, a], [a, a]], true); rail([[0, N], [N, N], [bb, bb], [a, bb]], true);
      rail([[0, 0], [0, N], [a, bb], [a, a]], false); rail([[N, 0], [N, N], [bb, bb], [bb, a]], false);
      g.strokeStyle = 'rgba(10,5,2,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(a, a); g.moveTo(N, 0); g.lineTo(bb, a); g.moveTo(0, N); g.lineTo(a, bb); g.moveTo(N, N); g.lineTo(bb, bb); g.stroke();
    }
    else if (f.type === 'marble') g.drawImage(TEX.marble(f.color, f.vein || '#999', { size: 1024 }).image, 0, 0, N, N);
    else if (f.type === 'stone') g.drawImage(TEX.stone(f.color, f.speck || shade(f.color, 0.3), { size: 1024, scale: 6 }).image, 0, 0, N, N);
    else { g.fillStyle = f.color; g.fillRect(0, 0, N, N); g.globalAlpha = 0.6; g.drawImage(TEX.mottle(f.color, { amount: 0.1 }).image, 0, 0, N, N); g.globalAlpha = 1; }
    // inner and outer gold lines
    g.strokeStyle = b.inlay; g.lineWidth = 5;
    const box = (u, w) => { g.lineWidth = w; g.strokeRect(px(-u), px(-u), px(u) - px(-u), px(u) - px(-u)); };
    box(4.1, 6); box(4.16, 2); box(4.78, 3);
    // corner rosettes
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      const cx = px(sx * 4.45), cy = px(sy * 4.45);
      g.save(); g.translate(cx, cy); g.fillStyle = b.inlay; g.strokeStyle = b.inlay; g.lineWidth = 3;
      for (let i = 0; i < 8; i++) { g.rotate(TAU / 8); g.beginPath(); g.ellipse(0, -18, 7, 16, 0, 0, TAU); g.fill(); }
      g.beginPath(); g.arc(0, 0, 9, 0, TAU); g.fillStyle = shade(b.inlay, -0.2); g.fill();
      g.restore();
    }
    // era bands
    if (b.motif === 'meander') { g.strokeStyle = b.inlay; g.lineWidth = 5; for (const s of [-1, 1]) { meander(g, px(-3.7), px(s * 4.45) - 18, px(3.7) - px(-3.7), 24, true); meander(g, px(s * 4.45) - 18, px(-3.7), px(3.7) - px(-3.7), 24, false); } }
    if (b.motif === 'egypt') {
      g.fillStyle = b.inlay;
      for (let i = 0; i < 26; i++) for (const s of [-1, 1]) {
        const u = -3.6 + i * 0.29;
        const glyph = (x, y) => { g.save(); g.translate(x, y); g.beginPath(); if (i % 3 === 0) { g.arc(0, -6, 7, 0, TAU); g.rect(-2, 0, 4, 14); g.rect(-8, 2, 16, 3); } else if (i % 3 === 1) { g.moveTo(-9, 10); g.lineTo(0, -12); g.lineTo(9, 10); g.closePath(); } else { g.ellipse(0, 0, 10, 6, 0, 0, TAU); } g.fill(); g.restore(); };
        glyph(px(u), px(s * 4.45)); glyph(px(s * 4.45), px(u));
      }
    }
    // coordinates, as the player sees them
    g.fillStyle = b.label; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 64px ' + FONT_CAPS;
    const black = side === 'black';
    for (let i = 0; i < 8; i++) {
      const write = (t, u, v, rot) => { g.save(); g.translate(px(u), px(v)); g.rotate(rot); g.fillText(t, 0, 0); g.restore(); };
      // canvas v grows downward = toward White (world +z)
      if (black) { write('abcdefgh'[i], i - 3.5, -4.45, Math.PI); write(String(i + 1), 4.45, 3.5 - i, Math.PI); }
      else { write('abcdefgh'[i], i - 3.5, 4.45, 0); write(String(i + 1), -4.45, 3.5 - i, 0); }
    }
    return c;
  }
  // Gold, bronze or chrome by name.
  const metal = (name) => (name === 'bronze' ? MAT.bronze() : name === 'chrome' ? MAT.chrome() : MAT.gold());
  function board(id, side) {
    const b = BOARDS[id] || BOARDS.walnut;
    const grp = new THREE.Group();
    grp.userData.boardId = id;
    // field
    const fieldTex = texFrom(paintField(Object.assign({ motif: b.motif === 'flowers' ? flowerMotif : null }, b.field)));
    const fieldMat = new THREE.MeshPhysicalMaterial({ map: fieldTex, roughness: b.gloss === undefined ? 0.44 : b.gloss + 0.26, clearcoat: 1, clearcoatRoughness: b.gloss === undefined ? 0.08 : b.gloss * 0.5, envMapIntensity: 0.85 });
    if (b.glass) { fieldMat.metalness = 0.2; fieldMat.iridescence = 0.25; fieldMat.envMapIntensity = 1.3; }
    const field = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), fieldMat);
    field.rotation.x = -Math.PI / 2; field.receiveShadow = true;
    field.userData.role = 'field';
    grp.add(field);
    // frame: a raised border with a painted top (lines, rosettes, coordinates)
    const outer = roundedSquare(4.9, 0.16);
    const hole = new THREE.Path(); hole.moveTo(-4, -4); hole.lineTo(4, -4); hole.lineTo(4, 4); hole.lineTo(-4, 4); hole.lineTo(-4, -4);
    outer.holes.push(hole);
    const fg = slab(outer, -0.34, 0.06, 0.025, 16);
    const topTex = texFrom(frameTexture(b, side));
    topTex.repeat.set(1 / 9.8, 1 / 9.8); topTex.offset.set(0.5, 0.5); topTex.wrapS = topTex.wrapT = THREE.ClampToEdgeWrapping;
    const frameTop = new THREE.MeshPhysicalMaterial({ map: topTex, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.9 });
    const frameSide = new THREE.MeshPhysicalMaterial({ color: b.frame.color, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
    const frame = new THREE.Mesh(fg, [frameTop, frameSide]);
    frame.receiveShadow = true; frame.castShadow = true;
    frame.userData.role = 'frame';
    grp.add(frame);
    // gold fillet around the field and along the outer edge
    const gold = metal(b.rim);
    const fillet = (half, y, t) => {
      const parts = [];
      for (const s of [-1, 1]) {
        const a = new THREE.BoxGeometry(half * 2 + t * 2, t, t); a.translate(0, y, s * (half + t / 2)); parts.push(a);
        const c = new THREE.BoxGeometry(t, t, half * 2); c.translate(s * (half + t / 2), y, 0); parts.push(c);
      }
      return K.merge(parts);
    };
    const rimMesh = new THREE.Mesh(K.merge([fillet(4.0, 0.03, 0.05), fillet(4.93, -0.06, 0.035)]), gold);
    rimMesh.castShadow = false; rimMesh.receiveShadow = true;
    grp.add(rimMesh);
    // plinth beneath, slightly wider, with a moulded edge
    const plinth = new THREE.Mesh(slab(roundedSquare(5.05, 0.22), -0.46, -0.33, 0.03, 16), frameSide);
    plinth.receiveShadow = true; plinth.castShadow = true;
    grp.add(plinth);
    grp.userData.relabel = (s) => {
      const t = texFrom(frameTexture(b, s)); t.repeat.copy(topTex.repeat); t.offset.copy(topTex.offset); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      frameTop.map.dispose(); frameTop.map = t; frameTop.needsUpdate = true;
    };
    grp.userData.dispose = () => { fieldTex.dispose(); frameTop.map.dispose(); fieldMat.dispose(); frameTop.dispose(); frameSide.dispose(); grp.traverse((m) => { if (m.geometry) m.geometry.dispose(); }); };
    return grp;
  }

  // ------------------------------------------------------------------ room textures
  function parquet(o) {
    const N = 1024, c = canvas(N), g = c.getContext('2d'), R = rng(5);
    o = Object.assign({}, o, { floor: shade(o.floor, -0.25) });
    g.fillStyle = o.floorDark; g.fillRect(0, 0, N, N);
    const W = N / 8, L = W * 3;
    for (let row = -2; row < 12; row++) for (let col = -2; col < 12; col++) {
      for (const dir of [0, 1]) {
        g.save();
        const x = col * W * 2 + (dir ? W : 0), y = row * W * 2 + (dir ? W : 0) - col * W * 0;
        g.translate(x, y); g.rotate(dir ? -Math.PI / 4 : Math.PI / 4);
        const tone = mix(0.9, 1.06, R());
        const base = hex(o.floor).map((v) => clamp(Math.round(v * tone), 0, 255));
        g.fillStyle = 'rgb(' + base.join(',') + ')';
        g.fillRect(0, 0, L, W * 0.98);
        g.globalAlpha = 0.18; g.strokeStyle = o.floorDark; g.lineWidth = 1.2;
        for (let k = 0; k < 6; k++) { g.beginPath(); const yy = R() * W; g.moveTo(0, yy); g.bezierCurveTo(L * 0.3, yy + (R() - 0.5) * 8, L * 0.6, yy + (R() - 0.5) * 8, L, yy + (R() - 0.5) * 6); g.stroke(); }
        g.globalAlpha = 1; g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.strokeRect(0, 0, L, W * 0.98);
        g.restore();
      }
    }
    return texFrom(c, { repeat: [10, 10] });
  }
  function rugTexture(o) {
    const N = 2048, c = canvas(N), g = c.getContext('2d'), C = N / 2;
    const ring = (r0, r1, col) => { g.beginPath(); g.arc(C, C, r1, 0, TAU); g.arc(C, C, r0, 0, TAU, true); g.fillStyle = col; g.fill(); };
    g.clearRect(0, 0, N, N);
    ring(0, C, o.rugBorder);
    ring(C * 0.86, C * 0.97, o.rugField);
    // border motif: repeated palmettes
    for (let i = 0; i < 64; i++) {
      g.save(); g.translate(C, C); g.rotate((i / 64) * TAU); g.translate(0, -C * 0.915);
      g.fillStyle = i % 2 ? o.rugGold : o.rugAccent;
      g.beginPath(); g.moveTo(0, -30); g.bezierCurveTo(22, -10, 18, 20, 0, 30); g.bezierCurveTo(-18, 20, -22, -10, 0, -30); g.fill();
      g.restore();
    }
    ring(C * 0.84, C * 0.86, o.rugGold);
    ring(C * 0.97, C * 0.985, o.rugGold);
    ring(0, C * 0.84, o.rugField);
    // field: scattered rosettes and vines
    const R = rng(9);
    for (let i = 0; i < 220; i++) {
      const a = R() * TAU, r = Math.sqrt(R()) * C * 0.8;
      if (r < C * 0.36) continue;
      g.save(); g.translate(C + Math.cos(a) * r, C + Math.sin(a) * r); g.rotate(R() * TAU);
      g.fillStyle = R() > 0.5 ? o.rugAccent : o.rugGold; g.globalAlpha = 0.8;
      for (let k = 0; k < 5; k++) { g.rotate(TAU / 5); g.beginPath(); g.ellipse(0, -12, 5, 12, 0, 0, TAU); g.fill(); }
      g.restore();
    }
    g.globalAlpha = 1;
    // central medallion
    for (let k = 0; k < 3; k++) {
      const rr = C * (0.34 - k * 0.09);
      g.save(); g.translate(C, C);
      g.fillStyle = [o.rugBorder, o.rugGold, o.rugAccent][k];
      g.beginPath();
      for (let i = 0; i <= 96; i++) { const a = (i / 96) * TAU, w = rr * (1 + 0.12 * Math.cos(a * 16)); g.lineTo(Math.cos(a) * w, Math.sin(a) * w); }
      g.fill(); g.restore();
    }
    ring(0, C * 0.06, o.rugGold);
    // wear and pile
    const img = g.getImageData(0, 0, N, N), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (R() - 0.5) * 18; d[i] = clamp(d[i] + n, 0, 255); d[i + 1] = clamp(d[i + 1] + n, 0, 255); d[i + 2] = clamp(d[i + 2] + n, 0, 255); }
    g.putImageData(img, 0, 0);
    return texFrom(c);
  }
  function damask(o) {
    const N = 512, c = canvas(N), g = c.getContext('2d');
    g.fillStyle = o.paper; g.fillRect(0, 0, N, N);
    const motif = (cx, cy, s) => {
      g.save(); g.translate(cx, cy); g.scale(s, s);
      for (const m of [1, -1]) {
        g.save(); g.scale(m, 1);
        g.beginPath(); g.moveTo(0, -120); g.bezierCurveTo(40, -100, 70, -60, 50, -20); g.bezierCurveTo(30, 10, 80, 30, 90, 60);
        g.bezierCurveTo(60, 50, 40, 70, 30, 100); g.bezierCurveTo(20, 80, 10, 90, 0, 120); g.closePath(); g.fill();
        g.beginPath(); g.arc(46, -70, 10, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(64, 4, 9, 22, -0.5, 0, TAU); g.fill();
        g.restore();
      }
      g.restore();
    };
    g.fillStyle = o.paperInk;
    motif(N / 2, N / 2, 1.3); motif(0, 0, 1.3); motif(N, 0, 1.3); motif(0, N, 1.3); motif(N, N, 1.3);
    g.globalAlpha = 0.5; motif(0, N / 2, 0.5); motif(N, N / 2, 0.5); motif(N / 2, 0, 0.5); motif(N / 2, N, 0.5);
    g.globalAlpha = 1;
    return texFrom(c, { repeat: [1, 1] });
  }
  function wainscot(o) {
    const c = canvas(512, 384), g = c.getContext('2d');
    g.drawImage(TEX.wood(shade(o.wood, 0.15), shade(o.wood, -0.4), { lines: 26, w: 512, h: 512, seed: 2, contrast: 0.55 }).image, 0, 0, 512, 384);
    // a raised panel: dark groove, lit top-left bevel, shadowed bottom-right bevel
    const P = [40, 40, 432, 300];
    g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 10; g.strokeRect(...P);
    g.strokeStyle = 'rgba(255,230,190,0.18)'; g.lineWidth = 4; g.beginPath(); g.moveTo(52, 334); g.lineTo(52, 52); g.lineTo(460, 52); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.beginPath(); g.moveTo(460, 52); g.lineTo(460, 328); g.lineTo(52, 328); g.stroke();
    g.strokeStyle = o.trim; g.lineWidth = 3; g.strokeRect(70, 70, 372, 244);
    return texFrom(c);
  }
  function skyTexture(o) {
    const c = canvas(512, 1024), g = c.getContext('2d'), R = rng(4);
    const grd = g.createLinearGradient(0, 0, 0, 1024);
    o.sky.forEach((col, i) => grd.addColorStop(i / (o.sky.length - 1), col));
    g.fillStyle = grd; g.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 260; i++) {
      const y = R() * 700, a = (1 - y / 760) * (0.4 + R() * 0.6);
      g.fillStyle = 'rgba(255,248,230,' + a + ')'; const s = R() < 0.06 ? 2.6 : 1.2;
      g.beginPath(); g.arc(R() * 512, y, s, 0, TAU); g.fill();
    }
    if (o.moon) {
      g.fillStyle = 'rgba(255,240,205,0.95)'; g.beginPath(); g.arc(360, 210, 46, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,240,205,0.12)'; g.beginPath(); g.arc(360, 210, 100, 0, TAU); g.fill();
      g.fillStyle = o.sky[0]; g.beginPath(); g.arc(342, 196, 40, 0, TAU); g.fill();
    }
    // distant garden and lights
    g.fillStyle = o.skyline || '#0b0a12';
    g.beginPath(); g.moveTo(0, 1024);
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, 800 - Math.abs(Math.sin(x * 0.03)) * 60 - R() * 30);
    g.lineTo(512, 1024); g.fill();
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(255,200,120,' + (0.4 + R() * 0.5) + ')'; g.fillRect(R() * 512, 840 + R() * 160, 3, 3); }
    return texFrom(c);
  }
  function booksTexture(seed) {
    const c = canvas(1024, 256), g = c.getContext('2d'), R = rng(seed || 3);
    g.fillStyle = '#120a06'; g.fillRect(0, 0, 1024, 256);
    const cols = ['#5a1a1e', '#1e3a2a', '#1c2a4a', '#6a4a1e', '#3a1a2a', '#2a2a2a', '#7a2a18', '#1a3a3a', '#4a3a1a'];
    let x = 4;
    while (x < 1020) {
      const w = 18 + R() * 26, h = 170 + R() * 80, col = cols[Math.floor(R() * cols.length)];
      if (R() < 0.06) { x += w; continue; }
      g.fillStyle = col; g.fillRect(x, 256 - h, w - 2, h);
      const sh = g.createLinearGradient(x, 0, x + w, 0); sh.addColorStop(0, 'rgba(0,0,0,0.35)'); sh.addColorStop(0.4, 'rgba(255,255,255,0.08)'); sh.addColorStop(1, 'rgba(0,0,0,0.45)');
      g.fillStyle = sh; g.fillRect(x, 256 - h, w - 2, h);
      g.fillStyle = 'rgba(214,170,90,0.85)';
      g.fillRect(x + 2, 256 - h + 14, w - 6, 3); g.fillRect(x + 2, 256 - h + 22, w - 6, 2); g.fillRect(x + 2, 236, w - 6, 3);
      g.fillRect(x + w * 0.3, 256 - h + 40, w * 0.3, h * 0.3);
      x += w;
    }
    return texFrom(c);
  }
  function paintingTexture(seed, o) {
    const c = canvas(512, 384), g = c.getContext('2d'), R = rng(seed);
    const sky = g.createLinearGradient(0, 0, 0, 384);
    sky.addColorStop(0, o.paintSky[0]); sky.addColorStop(0.6, o.paintSky[1]); sky.addColorStop(1, o.paintSky[2]);
    g.fillStyle = sky; g.fillRect(0, 0, 512, 384);
    g.fillStyle = 'rgba(255,230,180,0.85)'; g.beginPath(); g.arc(120 + R() * 280, 120, 26, 0, TAU); g.fill();
    for (let k = 0; k < 4; k++) {
      g.fillStyle = shade(o.paintLand, -0.12 * k);
      g.beginPath(); g.moveTo(0, 384);
      for (let x = 0; x <= 512; x += 8) g.lineTo(x, 200 + k * 42 + Math.sin(x * 0.012 + k * 2 + seed) * 26 + Math.sin(x * 0.05 + k) * 6);
      g.lineTo(512, 384); g.fill();
    }
    for (let i = 0; i < 9; i++) { const x = R() * 512, y = 250 + R() * 80; g.fillStyle = shade(o.paintLand, -0.45); g.beginPath(); g.ellipse(x, y - 24, 14, 28, 0, 0, TAU); g.fill(); g.fillRect(x - 2, y, 4, 18); }
    // varnish and craquelure
    g.fillStyle = 'rgba(80,50,10,0.22)'; g.fillRect(0, 0, 512, 384);
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 120; i++) { g.beginPath(); const x = R() * 512, y = R() * 384; g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 30, y + (R() - 0.5) * 30); g.stroke(); }
    return texFrom(c);
  }
  function tableTexture(o) {
    const N = 2048, c = canvas(N), g = c.getContext('2d'), C = N / 2;
    g.drawImage(TEX.wood(shade(o.table, 0.14), shade(o.table, -0.45), { lines: 84, w: 1024, h: 1024, seed: 8, contrast: 0.6, figure: 0.18, warp: 2.4 }).image, 0, 0, N, N);
    // marquetry: a band of burr-toned veneer between gold lines, edged with a fine
    // dogtooth of light and dark slips
    const band = (r0, r1, n, a, b) => {
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * TAU, a1 = ((i + 1) / n) * TAU;
        g.beginPath(); g.arc(C, C, r1, a0, a1); g.arc(C, C, r0, a1, a0, true); g.closePath();
        g.fillStyle = i % 2 ? a : b; g.fill();
      }
    };
    g.globalAlpha = 0.9;
    band(C * 0.86, C * 0.905, 1, shade(o.table, -0.28), shade(o.table, -0.28));
    g.globalAlpha = 1;
    band(C * 0.905, C * 0.918, 240, shade(o.table, 0.42), shade(o.table, -0.4));
    band(C * 0.848, C * 0.86, 240, shade(o.table, 0.42), shade(o.table, -0.4));
    g.strokeStyle = o.inlay; g.lineWidth = 4;
    for (const r of [C * 0.845, C * 0.921, C * 0.985]) { g.beginPath(); g.arc(C, C, r, 0, TAU); g.stroke(); }
    return texFrom(c);
  }
  function flameTexture() {
    return canvasTex('flame', 64, 128, (g, w, h) => {
      const grd = g.createRadialGradient(w / 2, h * 0.7, 2, w / 2, h * 0.62, h * 0.5);
      grd.addColorStop(0, 'rgba(255,255,240,1)'); grd.addColorStop(0.25, 'rgba(255,214,120,0.95)'); grd.addColorStop(0.6, 'rgba(255,130,30,0.5)'); grd.addColorStop(1, 'rgba(255,80,0,0)');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(w / 2, 0); g.bezierCurveTo(w * 0.95, h * 0.5, w * 0.9, h * 0.95, w / 2, h); g.bezierCurveTo(w * 0.1, h * 0.95, w * 0.05, h * 0.5, w / 2, 0); g.fill();
    });
  }
  function glowTexture() {
    return canvasTex('glow', 128, 128, (g, w) => {
      const grd = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,0.45)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, w);
    });
  }

  // ------------------------------------------------------------------ room parts
  function flame(x, y, z, s, list) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTexture(), color: new THREE.Color('#ffd9a0').multiplyScalar(4), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    m.scale.set(s * 0.5, s, 1); m.position.set(x, y + s * 0.4, z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#ffb860').multiplyScalar(0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    halo.scale.set(s * 3.2, s * 3.2, 1); halo.position.set(x, y + s * 0.4, z);
    if (list) list.push({ m, halo, s, seed: Math.random() * 100 });
    return [m, halo];
  }
  function candle(x, y, z, h, flames) {
    const grp = new THREE.Group();
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, h, 16), MAT.lacquer('#f4ecdc', { roughness: 0.5, clearcoat: 0.2, sheen: 0.4 }));
    wax.position.set(x, y + h / 2, z); grp.add(wax);
    flame(x, y + h, z, 0.22, flames).forEach((m) => grp.add(m));
    return grp;
  }
  // A gold candelabrum with three candles.
  function candelabrum(x, y, z, flames) {
    const grp = new THREE.Group();
    const prof = K.profile(0, 0).line(0.34, 0).arc(0.3, 0.06, 0.3).curve([[0.18, 0.12], [0.1, 0.22], [0.07, 0.5], [0.09, 0.8], [0.06, 1.1], [0.1, 1.25]]).line(0.13, 1.3).line(0, 1.32);
    const stem = new THREE.Mesh(K.revolve(prof, { segs: 32 }), MAT.gold());
    stem.castShadow = true; grp.add(stem);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(K.tube([[0, 0.95, 0], [s * 0.3, 0.9, 0], [s * 0.55, 1.05, 0], [s * 0.6, 1.25, 0]], 0.035, { segs: 24, radial: 8 }), MAT.gold());
      grp.add(arm);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.08, 16), MAT.gold()); cup.position.set(s * 0.6, 1.28, 0); grp.add(cup);
      grp.add(candle(s * 0.6, 1.32, 0, 0.55, flames));
    }
    grp.add(candle(0, 1.32, 0, 0.7, flames));
    grp.position.set(x, y, z);
    return grp;
  }
  // A two-tier crystal chandelier with candle lights.
  function chandelier(y, flames, o) {
    const grp = new THREE.Group();
    const gold = MAT.gold();
    const stemP = K.profile(0, -0.6).line(0.12, -0.6).curve([[0.25, -0.4], [0.3, -0.1], [0.12, 0.2], [0.06, 0.6], [0.05, 3]]).line(0, 3);
    grp.add(new THREE.Mesh(K.revolve(stemP, { segs: 32 }), gold));
    const crystal = new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 0.9, ior: 1.7, thickness: 0.2, envMapIntensity: 2.5, emissive: '#ffe6c0', emissiveIntensity: 0.25 });
    const drop = new THREE.OctahedronGeometry(0.07, 0); drop.scale(1, 1.8, 1);
    const drops = [];
    const tiers = [[8, 2.1, 0], [6, 1.2, 0.9]];
    for (const [n, r, dy] of tiers) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + dy, cx = Math.cos(a), cz = Math.sin(a);
        grp.add(new THREE.Mesh(K.tube([[0, dy - 0.2, 0], [cx * r * 0.5, dy - 0.45, cz * r * 0.5], [cx * r * 0.95, dy - 0.25, cz * r * 0.95], [cx * r, dy + 0.1, cz * r]], 0.045, { segs: 24, radial: 8 }), gold));
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.07, 0.1, 16), gold); cup.position.set(cx * r, dy + 0.14, cz * r); grp.add(cup);
        grp.add(candle(cx * r, dy + 0.19, cz * r, 0.42, flames));
        for (let k = 0; k < 3; k++) { const d = drop.clone(); d.translate(cx * r * (0.6 + k * 0.17), dy - 0.42 - k * 0.12 + (k === 1 ? 0.12 : 0), cz * r * (0.6 + k * 0.17)); drops.push(d); }
      }
    }
    // a hoop of crystal strands
    for (let i = 0; i < 40; i++) { const a = (i / 40) * TAU; for (let k = 0; k < 4; k++) { const d = drop.clone(); d.scale(0.7, 0.7, 0.7); d.translate(Math.cos(a) * 1.55, -0.35 - k * 0.13 - Math.abs(Math.sin(a * 4)) * 0.1, Math.sin(a) * 1.55); drops.push(d); } }
    grp.add(new THREE.Mesh(THREE.mergeGeometries(drops), crystal));
    grp.add(new THREE.Mesh(K.ring(1.55, -0.3, 0.03, { seg: 96 }), gold));
    grp.position.y = y;
    void o;
    return grp;
  }
  // Velvet drape: a hanging plane folded into soft pleats.
  function drape(w, h, color) {
    const g = new THREE.PlaneGeometry(w, h, 48, 24);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), t = (h / 2 - y) / h;
      const gather = 1 - 0.45 * Math.pow(Math.max(0, 1 - Math.abs(t - 0.62) * 3), 2);
      p.setX(i, x * gather);
      p.setZ(i, Math.sin((x / w) * TAU * 3.2) * 0.12 * (0.5 + t));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.velvet(color));
    m.material.side = THREE.DoubleSide;
    return m;
  }

  // ------------------------------------------------------------------ rooms
  // Every room is a many-sided hall around the same table. Faces carry windows, a
  // fireplace, shelves of books or paintings; the palette and props set the era.
  const ROOMS = {
    salon: {
      name: 'Grand Cocoa Salon', era: 'A Regency drawing room',
      palette: { wall: '#2a1611', paper: '#3a1c18', paperInk: '#4e2a22', wood: '#3a2014', trim: '#c9a35a', floor: '#6a4228', floorDark: '#24140c', table: '#4a2a18', inlay: '#d8b060',
        rugBorder: '#3a0f14', rugField: '#5e1420', rugGold: '#c79a4a', rugAccent: '#1e2c4a', drape: '#5a1420', sky: ['#060914', '#101a36', '#2a2448', '#3a2a40'], skyline: '#07060c', moon: true,
        paintSky: ['#3a4a6a', '#c88a5a', '#e8c890'], paintLand: '#4a5a3a', fog: '#140b08', hemi: ['#ffe2c0', '#1a0d08'] },
      faces: ['window', 'window', 'window', 'painting', 'books', 'fire', 'books', 'painting', 'books', 'painting', 'books', 'painting'],
      env: { wall: '#3b2219', floor: '#2a1810', ceiling: '#2a1a12', key: '#fff0d8', keyI: 6, window: '#c8d4ff', windowI: 2.2, rim: '#ffd8a8', rimI: 4.5, lamp: '#ffb05a', lampI: 10, fill: 0.55 },
    },
  };
  function room(id) {
    const def = ROOMS[id] || ROOMS.salon, o = def.palette;
    const grp = new THREE.Group();
    const flames = [];
    const FLOOR = -4.6, TOP = -0.46, NF = def.faces.length, RAD = 19, H = 21;
    // floor and rug
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshPhysicalMaterial({ map: parquet(o), roughness: 0.5, clearcoat: 0.5, clearcoatRoughness: 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; grp.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(10.5, 96), new THREE.MeshStandardMaterial({ map: rugTexture(o), roughness: 0.95, transparent: true }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = FLOOR + 0.02; rug.receiveShadow = true; grp.add(rug);
    // the table: a round top with a moulded edge on a turned pedestal
    const tableMat = new THREE.MeshPhysicalMaterial({ map: tableTexture(o), roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1 });
    const top = new THREE.Mesh(new THREE.CircleGeometry(7.6, 128), tableMat);
    top.rotation.x = -Math.PI / 2; top.position.y = TOP; top.receiveShadow = true; top.userData.role = 'table';
    // rotate the UVs of a circle so the texture centre is the table centre (CircleGeometry already maps 0..1)
    grp.add(top);
    const edgeP = K.profile(7.6, TOP).arc(7.72, TOP - 0.1, 0.35).line(7.7, TOP - 0.2).arc(7.55, TOP - 0.42, -0.3).line(6.6, TOP - 0.46);
    const edgeMat = new THREE.MeshPhysicalMaterial({ color: o.table, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 });
    grp.add(new THREE.Mesh(K.revolve(edgeP, { segs: 128 }), edgeMat));
    grp.add(new THREE.Mesh(K.ring(7.6, TOP - 0.004, 0.025, { seg: 160 }), MAT.gold()));
    const pedP = K.profile(0, FLOOR).line(2.6, FLOOR).arc(2.5, FLOOR + 0.3, 0.3).curve([[1.6, FLOOR + 0.6], [0.9, FLOOR + 1.2], [0.75, FLOOR + 2.4], [0.95, TOP - 1.2], [2.2, TOP - 0.5]]).line(0, TOP - 0.46);
    grp.add(new THREE.Mesh(K.revolve(pedP, { segs: 64, mod: K.MOD.flutes(16, 0.06, FLOOR + 1.3, TOP - 1.4) }), edgeMat));
    // walls
    const wallMats = {
      paper: new THREE.MeshStandardMaterial({ map: damask(o), roughness: 0.8 }),
      wains: new THREE.MeshPhysicalMaterial({ map: wainscot(o), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      wood: new THREE.MeshPhysicalMaterial({ color: o.wood, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      gold: MAT.gold(),
      dark: new THREE.MeshStandardMaterial({ color: '#0c0705', roughness: 0.9 }),
    };
    const faceW = 2 * RAD * Math.sin(Math.PI / NF), WAIN = 3.2;
    for (let i = 0; i < NF; i++) {
      const a = (i / NF) * TAU, kind = def.faces[i];
      const face = new THREE.Group();
      // white's camera is at +z; face 0 sits straight ahead (-z) and the rest go round
      face.rotation.y = -a; face.position.set(-Math.sin(a) * 0 , 0, 0);
      const at = (m, x, y, z) => { m.position.set(x, y, z - RAD * Math.cos(Math.PI / NF)); face.add(m); return m; };
      const paperT = wallMats.paper.map; paperT.repeat.set(faceW / 3, (H - WAIN) / 3);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(faceW, H - WAIN), wallMats.paper); at(paper, 0, FLOOR + WAIN + (H - WAIN) / 2, 0);
      const wains = new THREE.Mesh(new THREE.PlaneGeometry(faceW, WAIN), wallMats.wains); at(wains, 0, FLOOR + WAIN / 2, 0.02);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(faceW, 0.16, 0.16), wallMats.wood); at(rail, 0, FLOOR + WAIN, 0.08);
      const railG = new THREE.Mesh(new THREE.BoxGeometry(faceW, 0.03, 0.03), wallMats.gold); at(railG, 0, FLOOR + WAIN + 0.1, 0.17);
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.7, H, 0.3), wallMats.wood); at(pil, faceW / 2, FLOOR + H / 2, 0.15);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.42), wallMats.gold); at(cap, faceW / 2, FLOOR + H - 1.2, 0.2);
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.4, 0.6, 0.6), wallMats.wood); at(cornice, 0, FLOOR + H - 0.6, 0.3);
      if (kind === 'window') {
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 7.4), new THREE.MeshBasicMaterial({ map: skyTexture(o), toneMapped: true }));
        at(sky, 0, FLOOR + WAIN + 4.4, 0.05);
        const frameM = new THREE.Mesh(K.merge([
          ...[-1.85, 0, 1.85].map((x) => { const b = new THREE.BoxGeometry(0.12, 7.6, 0.16); b.translate(x, 0, 0); return b; }),
          ...[-3.75, -1.2, 1.4, 3.75].map((y) => { const b = new THREE.BoxGeometry(3.8, 0.12, 0.16); b.translate(0, y, 0); return b; })]), wallMats.gold);
        at(frameM, 0, FLOOR + WAIN + 4.4, 0.12);
        for (const s of [-1, 1]) { const d = drape(1.6, 9.2, o.drape); at(d, s * 2.55, FLOOR + WAIN + 4.2, 0.4); }
        const pel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.7, 0.5), wallMats.wood); at(pel, 0, FLOOR + WAIN + 8.9, 0.3);
      } else if (kind === 'books') {
        const shelfW = faceW - 1.2;
        const caseM = new THREE.Mesh(new THREE.BoxGeometry(shelfW + 0.4, 9.6, 0.9), wallMats.wood); at(caseM, 0, FLOOR + 4.8, 0.3);
        for (let k = 0; k < 5; k++) {
          const books = new THREE.Mesh(new THREE.PlaneGeometry(shelfW, 1.55), new THREE.MeshStandardMaterial({ map: booksTexture(i * 7 + k), roughness: 0.7 }));
          at(books, 0, FLOOR + 1.0 + k * 1.82, 0.78);
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 0.1, 0.5), wallMats.wood); at(shelf, 0, FLOOR + 0.18 + k * 1.82, 0.9);
        }
      } else if (kind === 'fire') {
        const surround = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.6, 0.9), MAT.stone(TEX.marble('#e8e0d0', '#9a8a78', { size: 512 }), { roughness: 0.25 })); at(surround, 0, FLOOR + 1.8, 0.45);
        const box = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), wallMats.dark); at(box, 0, FLOOR + 1.1, 0.91);
        const mantel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 1.3), wallMats.wood); at(mantel, 0, FLOOR + 3.65, 0.6);
        const fireLight = new THREE.PointLight('#ff8a3a', 9, 9, 2); at(fireLight, 0, FLOOR + 1.2, 2.2);
        grp.userData.fire = fireLight;
        for (let k = 0; k < 6; k++) { const f = flame(0, 0, 0, 0.7 + (k % 3) * 0.25, flames); f.forEach((m) => { at(m, (k - 2.5) * 0.32, FLOOR + 0.35 + m.position.y, 1.0); }); }
        const mirror = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), new THREE.MeshPhysicalMaterial({ color: '#1a1410', metalness: 1, roughness: 0.08 })); at(mirror, 0, FLOOR + 6.4, 0.06);
        const mf = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 8, 48), wallMats.gold); mf.scale.set(0.85, 1.12, 1); at(mf, 0, FLOOR + 6.4, 0.1);
        for (const s of [-1, 1]) at(candelabrum(0, 0, 0, flames), s * 2.0, FLOOR + 3.78, 0.6).scale.setScalar(0.8);
      } else if (kind === 'painting') {
        const art = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.7), new THREE.MeshStandardMaterial({ map: paintingTexture(i * 13 + 1, o), roughness: 0.55 })); at(art, 0, FLOOR + WAIN + 4.2, 0.12);
        const shape = W_frame(4.2, 3.3, 0.32);
        const fr = new THREE.Mesh(shape, wallMats.gold); at(fr, 0, FLOOR + WAIN + 4.2, 0.14);
        const sconce = (s) => { const c = candle(0, 0, 0, 0.5, flames); at(c, s * 2.9, FLOOR + WAIN + 2.2, 0.5); };
        sconce(-1); sconce(1);
      }
      grp.add(face);
    }
    // ceiling with a painted medallion glow
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(RAD + 1, 64), new THREE.MeshStandardMaterial({ color: '#1a0f0a', roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = FLOOR + H; grp.add(ceil);
    // chandelier and table candelabra
    const ch = chandelier(7.8, flames); grp.add(ch);
    grp.add(candelabrum(-5.9, TOP, -4.6, flames));
    grp.add(candelabrum(5.9, TOP, -4.6, flames));
    grp.traverse((m) => { if (m.isMesh && !m.material.transparent) { m.receiveShadow = true; } });
    return {
      group: grp, def, flames, floorY: FLOOR, tableY: TOP, chandelier: ch, chandelierY: 7.8,
      fog: o.fog, hemi: o.hemi, env: def.env,
      chandelierLight: new THREE.Vector3(0, 7.2, 0),
      update(t) {
        for (const f of flames) {
          const k = 0.86 + 0.14 * Math.sin(t * 9 + f.seed) * Math.sin(t * 5.3 + f.seed * 2);
          f.m.scale.set(f.s * 0.5 * (0.95 + 0.1 * Math.sin(t * 13 + f.seed)), f.s * k, 1);
          f.halo.material.opacity = 0.75 + 0.25 * k;
        }
        if (grp.userData.fire) grp.userData.fire.intensity = 8 + 2.5 * Math.sin(t * 7) * Math.sin(t * 3.1 + 1);
      },
    };
  }
  // A carved picture frame: a rectangular ring with a rounded profile.
  function W_frame(w, h, t) {
    const s = new THREE.Shape(); s.moveTo(-w / 2, -h / 2); s.lineTo(w / 2, -h / 2); s.lineTo(w / 2, h / 2); s.lineTo(-w / 2, h / 2); s.lineTo(-w / 2, -h / 2);
    const hole = new THREE.Path(); const iw = w / 2 - t, ih = h / 2 - t;
    hole.moveTo(-iw, -ih); hole.lineTo(-iw, ih); hole.lineTo(iw, ih); hole.lineTo(iw, -ih); hole.lineTo(-iw, -ih);
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4 });
    return g;
  }

  // ------------------------------------------------------------------ environments
  // A light-stage version of each room rendered into a prefiltered cube map. Its bright
  // panels are what lacquer, gold and glass reflect: a broad softbox above, tall windows,
  // thin rim strips behind and warm lamps.
  function envScene(o) {
    o = Object.assign({ wall: '#3b2719', floor: '#24160e', ceiling: '#2a1c14', key: '#fff1dc', keyI: 7, window: '#dfe9ff', windowI: 3.2, rim: '#ffe2b8', rimI: 5, lamp: '#ffb760', lampI: 9, fill: 0.7 }, o || {});
    const scene = new THREE.Scene();
    const basic = (c, i) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(i === undefined ? 1 : i), side: THREE.DoubleSide });
    const room = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 24), [
      basic(o.wall, o.fill), basic(o.wall, o.fill * 0.9), basic(o.ceiling, o.fill), basic(o.floor, o.fill), basic(o.wall, o.fill * 1.05), basic(o.wall, o.fill * 0.8)]);
    room.material.forEach((m) => { m.side = THREE.BackSide; });
    room.position.y = 4;
    scene.add(room);
    const panel = (w, h, c, i, x, y, z, rx, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), basic(c, i));
      m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0);
      scene.add(m); return m;
    };
    panel(7, 5, o.key, o.keyI, 0, 9.8, 1.5, Math.PI / 2, 0);
    for (let i = -1; i <= 1; i++) panel(2.2, 6.5, o.window, o.windowI, -11.8, 4.5, i * 3.2, 0, Math.PI / 2);
    panel(0.8, 8, o.rim, o.rimI, -5, 4, -11.8, 0, 0);
    panel(0.8, 8, o.rim, o.rimI, 5, 4, -11.8, 0, 0);
    panel(14, 1.2, o.lamp, o.fill * 1.4, 0, -1.2, 11.8, 0, Math.PI);
    const lamp = new THREE.SphereGeometry(0.45, 12, 8);
    [[8, 3, -6], [-7, 2.5, -8], [9, 2, 6], [-9, 3, 7], [2, 5.5, -10], [-3, 6, 10]].forEach(([x, y, z]) => {
      const m = new THREE.Mesh(lamp, basic(o.lamp, o.lampI)); m.position.set(x, y, z); scene.add(m);
    });
    return scene;
  }
  const envCache = new Map();
  function environment(renderer, style) {
    const key = JSON.stringify(style || {});
    if (envCache.has(key)) return envCache.get(key);
    const pm = new THREE.PMREMGenerator(renderer);
    const scene = envScene(style);
    const rt = pm.fromScene(scene, 0.03);
    scene.traverse((m) => { if (m.geometry) m.geometry.dispose(); if (m.material) [].concat(m.material).forEach((x) => x.dispose()); });
    pm.dispose();
    envCache.set(key, rt.texture);
    return rt.texture;
  }

  return { BOARDS, ROOMS, board, room, environment, envScene, flame, glowTexture, shade, texFrom, canvas, roundRect, roundedSquare, slab, metal };
}
if (typeof module !== 'undefined') module.exports = ChacklateWorld;
