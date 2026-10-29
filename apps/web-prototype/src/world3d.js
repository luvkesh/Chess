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
    // Murano aventurine: amber glass full of copper sparkles (light squares are mirror glass)
    aventurine: (f, light) => {
      if (light) return TEX.mottle(f.light, { amount: 0.06 }).image;
      const c = canvas(512), g = c.getContext('2d'), R = rng(37);
      g.drawImage(TEX.mottle(f.dark, { amount: 0.24 }).image, 0, 0, 512, 512);
      for (let i = 0; i < 1500; i++) {
        const s = 0.8 + R() * 2.2;
        g.fillStyle = 'rgba(' + ((236 + R() * 19) | 0) + ',' + ((150 + R() * 70) | 0) + ',' + ((70 + R() * 50) | 0) + ',' + (0.35 + R() * 0.65) + ')';
        g.fillRect(R() * 512, R() * 512, s, s);
      }
      return c;
    },
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
      if (!light && f.tintDark) { g.fillStyle = rgba(f.tintDark[0], f.tintDark[1]); g.fillRect(x, y, S, S); }
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
    nile: { name: 'Sandstone & Lapis', field: { type: 'lapis', tintDark: ['#4a74e8', 0.3], light: '#e3c99a', dark: '#1d2f7a', veinLight: '#b08850', marbleLight: { cloud: 0.4, strength: 0.25, freq: 1 } }, frame: { type: 'stone', color: '#8a6a3e', speck: '#c8a46a' }, inlay: '#f0c860', label: '#ffe2a0', rim: 'gold', motif: 'egypt' },
    athens: { name: 'Pentelic & Verde Antico', field: { type: 'marble', light: '#e4d7c0', dark: '#3d6b56', veinLight: '#b0a898', veinDark: '#a8d4bc', marbleDark: { cloud: 0.5, strength: 0.6, freq: 3 } }, frame: { type: 'marble', color: '#ddd0b8', vein: '#a89c86' }, inlay: '#b8863b', label: '#4a3420', rim: 'bronze', motif: 'meander' },
    roma: { name: 'Porphyry & Travertine', field: { type: 'marble', light: '#e2d4b6', dark: '#6a7480', veinLight: '#c4ae88', veinDark: '#c8d2dc', marbleLight: { cloud: 0.4, strength: 0.3 }, marbleDark: { cloud: 0.4, strength: 0.45, freq: 3 } }, frame: { type: 'stone', color: '#3a1416', speck: '#a8686a' }, inlay: '#c8954a', label: '#f0d8b0', rim: 'bronze' },
    mughal: { name: 'Taj Marble & Red Sandstone', field: { type: 'marble', light: '#f4f1ea', dark: '#b85a40', veinLight: '#c8c4bc', veinDark: '#e09a7a', marbleDark: { cloud: 0.5, strength: 0.25 } }, frame: { type: 'stone', color: '#8e3a26', speck: '#c87a5a' }, inlay: '#e8c06a', label: '#ffe8c0', rim: 'gold', motif: 'flowers' },
    ming: { name: 'Cinnabar & Gold', field: { type: 'lacquer', light: '#efe2c4', dark: '#17110f', seamGold: 'rgba(230,190,90,0.7)' }, frame: { type: 'lacquer', color: '#80170f', diaper: true }, inlay: '#e8c06a', label: '#f4d28c', rim: 'gold', gloss: 0.14 },
    venice: { name: 'Murano Mirror Glass', field: { type: 'aventurine', light: '#e6ecf2', dark: '#7a3a12', seamGold: 'rgba(240,210,140,0.7)' }, frame: { type: 'lacquer', color: '#0c1830' }, inlay: '#f0d8a0', label: '#f6e8c4', rim: 'gold', gloss: 0.06, glass: true },
    winter: { name: 'Malachite & Rhodonite', field: { type: 'marble', light: '#efe8dc', dark: '#b86a78', veinLight: '#c8c0b0', veinDark: '#3a2228', marbleDark: { cloud: 0.4, strength: 0.5, freq: 3 } }, frame: { type: 'malachite', color: '#13563a' }, inlay: '#e8c06a', label: '#f2d696', rim: 'gold', gloss: 0.1 },
    deco: { name: 'Macassar & Chrome', field: { type: 'wood', light: '#e6dccb', dark: '#7a5636', woodDark: { lines: 16, contrast: 0.75, warp: 2.4 }, woodLight: { lines: 70, contrast: 0.22 } }, frame: { type: 'lacquer', color: '#0e0e10' }, inlay: '#dfe3e8', label: '#e8ecf0', rim: 'chrome' },
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
    else if (f.type === 'malachite') {
      // book-matched veneer: one slab mirrored into the four quarters, as the Ural craftsmen laid it
      const img = TEX.malachite({ size: 512, bands: 54, light: '#3c9c70', mid: '#11603e', dark: '#082c1c' }).image;
      for (const qx of [1, -1]) for (const qy of [1, -1]) { g.save(); g.translate(N / 2, N / 2); g.scale(qx, qy); g.drawImage(img, 0, 0, N / 2, N / 2); g.restore(); }
    }
    else if (f.type === 'stone') g.drawImage(TEX.stone(f.color, f.speck || shade(f.color, 0.3), { size: 1024, scale: 6 }).image, 0, 0, N, N);
    else { g.fillStyle = f.color; g.fillRect(0, 0, N, N); g.globalAlpha = 0.6; g.drawImage(TEX.mottle(f.color, { amount: 0.1 }).image, 0, 0, N, N); g.globalAlpha = 1; }
    if (f.diaper) {
      // carved lacquer: a fine diaper ground cut into the cinnabar, dark in the cuts and lit on
      // the upper edge, quiet enough that the gold letters stay easy to read
      const s = 44, d = s * 0.3;
      g.lineWidth = 3;
      for (let y = 0, row = 0; y < N + s; y += s / 2, row++) for (let x = (row % 2) * s / 2; x < N + s; x += s) {
        g.beginPath(); g.moveTo(x, y - d); g.lineTo(x + d, y); g.lineTo(x, y + d); g.lineTo(x - d, y); g.closePath();
        g.strokeStyle = shade(f.color, -0.4); g.stroke();
        g.beginPath(); g.moveTo(x - d + 3, y + 1); g.lineTo(x, y - d + 4); g.lineTo(x + d - 3, y + 1);
        g.strokeStyle = shade(f.color, 0.18); g.lineWidth = 1.5; g.stroke(); g.lineWidth = 3;
      }
    }
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
    // coordinates, as the player sees them; where a band or a busy stone runs under them each
    // one sits on a little tablet of its own, so the letters never get lost in the pattern
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 64px ' + FONT_CAPS;
    const black = side === 'black';
    for (let i = 0; i < 8; i++) {
      const write = (t, u, v, rot) => {
        g.save(); g.translate(px(u), px(v)); g.rotate(rot);
        if (b.motif === 'meander' || b.motif === 'egypt' || f.type === 'malachite') {
          roundRect(g, -36, -36, 72, 72, 12); g.fillStyle = f.color; g.fill();
          g.strokeStyle = b.inlay; g.lineWidth = 3; g.stroke();
        }
        g.fillStyle = b.label; g.fillText(t, 0, 0); g.restore();
      };
      // canvas v grows downward = toward White (world +z)
      if (black) { write('abcdefgh'[i], i - 3.5, -4.45, Math.PI); write(String(i + 1), 4.45, 3.5 - i, Math.PI); }
      else { write('abcdefgh'[i], i - 3.5, 4.45, 0); write(String(i + 1), -4.45, 3.5 - i, 0); }
    }
    return c;
  }
  // Gold, bronze or chrome by name.
  const metal = (name) => (name === 'bronze' ? MAT.bronze() : name === 'chrome' ? MAT.chrome() : name === 'brass' ? MAT.brass() : name === 'silver' ? MAT.silver() : MAT.gold());
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
    const frameTop = new THREE.MeshPhysicalMaterial({ map: topTex, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.3, envMapIntensity: 0.9 });
    const frameSide = new THREE.MeshPhysicalMaterial({ color: b.frame.color, roughness: 0.36, clearcoat: 1, clearcoatRoughness: 0.22 });
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
  // A night sky for plain windows; each window gets its own stars, and only one the moon.
  function skyTexture(o, seed, moon) {
    const c = canvas(512, 1024), g = c.getContext('2d'), R = rng(4 + (seed || 0) * 7);
    const grd = g.createLinearGradient(0, 0, 0, 1024);
    o.sky.forEach((col, i) => grd.addColorStop(i / (o.sky.length - 1), col));
    g.fillStyle = grd; g.fillRect(0, 0, 512, 1024);
    for (let i = 0; i < 260; i++) {
      const y = R() * 700, a = (1 - y / 760) * (0.4 + R() * 0.6);
      g.fillStyle = 'rgba(255,248,230,' + a + ')'; const s = R() < 0.06 ? 2.6 : 1.2;
      g.beginPath(); g.arc(R() * 512, y, s, 0, TAU); g.fill();
    }
    if (o.moon && moon) {
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
  function candelabrum(x, y, z, flames, m) {
    const grp = new THREE.Group();
    m = m || MAT.gold();
    const prof = K.profile(0, 0).line(0.34, 0).arc(0.3, 0.06, 0.3).curve([[0.18, 0.12], [0.1, 0.22], [0.07, 0.5], [0.09, 0.8], [0.06, 1.1], [0.1, 1.25]]).line(0.13, 1.3).line(0, 1.32);
    const stem = new THREE.Mesh(K.revolve(prof, { segs: 32 }), m);
    stem.castShadow = true; grp.add(stem);
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(K.tube([[0, 0.95, 0], [s * 0.3, 0.9, 0], [s * 0.55, 1.05, 0], [s * 0.6, 1.25, 0]], 0.035, { segs: 24, radial: 8 }), m);
      grp.add(arm);
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.06, 0.08, 16), m); cup.position.set(s * 0.6, 1.28, 0); grp.add(cup);
      grp.add(candle(s * 0.6, 1.32, 0, 0.55, flames));
    }
    grp.add(candle(0, 1.32, 0, 0.7, flames));
    grp.position.set(x, y, z);
    return grp;
  }
  // A two-tier crystal chandelier with candle lights.
  function chandelier(y, flames, o) {
    o = o || {};
    const grp = new THREE.Group();
    const gold = o.metal || MAT.gold();
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
    if (o.crystal === false) {
      // brass: a turned finial instead of crystal
      grp.add(new THREE.Mesh(K.revolve(K.profile(0, -1.4).curve([[0.12, -1.3], [0.3, -1.0], [0.22, -0.7]]).line(0.1, -0.55).line(0, -0.5), { segs: 32 }), gold));
    } else if (o.tints) {
      // Murano: drops of coloured glass
      o.tints.forEach((tint, t) => {
        const mine = drops.filter((d, k) => k % o.tints.length === t);
        grp.add(new THREE.Mesh(THREE.mergeGeometries(mine), new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0, roughness: 0.04, transmission: 0.7, ior: 1.6, thickness: 0.2, envMapIntensity: 2.2, emissive: tint, emissiveIntensity: 0.4 })));
      });
    } else grp.add(new THREE.Mesh(THREE.mergeGeometries(drops), crystal));
    grp.add(new THREE.Mesh(K.ring(1.55, -0.3, 0.03, { seg: 96 }), gold));
    grp.position.y = y;
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

  // ------------------------------------------------------------------ the view outside
  // Each era room looks out on one wide painting: its sky, a landmark of the age and the
  // ground before it. The windows share the painting, each showing its own slice, so the
  // landmark fills the window straight ahead and the scene runs on into the others.
  // Painters work in a 1536 x 1024 design space with the horizon at HZ.
  const VW = 1536, VH = 1024, HZ = 640, VX = VW / 2;
  function poly(g, pts, fill) {
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
  }
  function vgrad(g, y0, y1, stops) { const grd = g.createLinearGradient(0, y0, 0, y1); stops.forEach((c, i) => grd.addColorStop(i / (stops.length - 1), c)); return grd; }
  function hgrad(g, x0, x1, stops) { const grd = g.createLinearGradient(x0, 0, x1, 0); stops.forEach((c, i) => grd.addColorStop(i / (stops.length - 1), c)); return grd; }
  function glow(g, x, y, r, col, a) {
    const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, rgba(col, a)); grd.addColorStop(1, rgba(col, 0));
    g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function disc(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); }
  // An arch-topped opening (round, or pointed when pointed > 0), drawn from its base.
  function archPath(g, x, y, w, h, pointed) {
    const r = w / 2, spring = y - h + (pointed ? r * 1.6 : r);
    g.beginPath(); g.moveTo(x - r, y); g.lineTo(x - r, spring);
    if (pointed) { g.quadraticCurveTo(x - r, spring - r * 1.2, x, y - h); g.quadraticCurveTo(x + r, spring - r * 1.2, x + r, spring); }
    else g.arc(x, spring, r, Math.PI, 0);
    g.lineTo(x + r, y); g.closePath();
  }
  function palm(g, x, y, h, lean, col) {
    const tx = x + lean, ty = y - h;
    g.fillStyle = col; g.beginPath();
    g.moveTo(x - 7, y); g.quadraticCurveTo(x + lean * 0.2 - 4, y - h * 0.5, tx - 2, ty); g.lineTo(tx + 3, ty); g.quadraticCurveTo(x + lean * 0.2 + 4, y - h * 0.5, x + 7, y); g.fill();
    g.strokeStyle = col; g.lineCap = 'round';
    for (let k = 0; k < 9; k++) {
      const a = -Math.PI / 2 + (k - 4) * 0.42, len = h * (0.36 + 0.06 * Math.cos(k * 1.7));
      const ex = tx + Math.cos(a) * len, ey = ty + Math.sin(a) * len * 0.5 + len * 0.42;
      g.lineWidth = 5; g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.7, ex, ey); g.stroke();
      g.lineWidth = 1.6;
      for (let s = 0.3; s < 1; s += 0.12) {
        const px = tx + (ex - tx) * s, py = ty + (ey - ty) * s - Math.sin(s * Math.PI) * len * 0.18;
        g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a + 1.2) * 10, py + 12); g.moveTo(px, py); g.lineTo(px + Math.cos(a - 1.2) * 10, py + 12); g.stroke();
      }
    }
  }
  function cypress(g, x, y, h, col, lit) {
    const w = h * 0.16;
    g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h);
    g.bezierCurveTo(x + w * 1.1, y - h * 0.6, x + w, y - h * 0.15, x + w * 0.3, y); g.lineTo(x - w * 0.3, y);
    g.bezierCurveTo(x - w, y - h * 0.15, x - w * 1.1, y - h * 0.6, x, y - h); g.fill();
    if (lit) { g.fillStyle = lit; g.beginPath(); g.moveTo(x, y - h); g.bezierCurveTo(x + w * 1.1, y - h * 0.6, x + w, y - h * 0.15, x + w * 0.3, y); g.lineTo(x + w * 0.1, y); g.bezierCurveTo(x + w * 0.5, y - h * 0.3, x + w * 0.4, y - h * 0.7, x, y - h); g.fill(); }
  }
  function blobTree(g, x, y, r, col, R) {
    g.fillStyle = col; g.fillRect(x - 3, y - r * 0.8, 6, r * 0.8);
    for (let k = 0; k < 7; k++) disc(g, x + (R() - 0.5) * r * 1.3, y - r * 1.1 - (R() - 0.3) * r * 0.8, r * (0.45 + R() * 0.3), col);
  }
  function hills(g, y, amp, col, seed, step) {
    const R = rng(seed);
    g.beginPath(); g.moveTo(0, HZ + 4);
    let h = R() * amp;
    for (let x = 0; x <= VW; x += step || 48) { h = Math.max(0, Math.min(amp, h + (R() - 0.5) * amp * 0.7)); g.lineTo(x, y - h); }
    g.lineTo(VW, HZ + 4); g.closePath(); g.fillStyle = col; g.fill();
  }
  function windowsGrid(g, x0, y0, x1, y1, R, lit, dark, chance) {
    for (let y = y0 + 6; y < y1 - 6; y += 11) for (let x = x0 + 5; x < x1 - 5; x += 9) {
      const on = R() < (chance || 0.3);
      g.fillStyle = on ? rgba(lit, 0.55 + R() * 0.45) : dark; g.fillRect(x, y, 4, 5);
    }
  }
  // A town at dusk in three rows, nearest last: walls, roofs (pitched or flat) and lit windows.
  function town(g, x0, x1, y, R, o) {
    for (let row = 0; row < 3; row++) {
      const k = (1 + row * 0.3) * (o.scale || 1), yb = y + row * 30 * (o.scale || 1);
      let x = x0 + R() * 30;
      while (x < x1) {
        const w = (24 + R() * 34) * k, h = (18 + R() * 26) * k;
        g.fillStyle = shade(o.wall, (o.tone || -0.3) - row * 0.12 - R() * 0.1); g.fillRect(x, yb - h, w, h + 40);
        g.fillStyle = rgba(o.lit, 0.16); g.fillRect(x, yb - h, w * 0.18, h + 40);
        g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(x + w * 0.72, yb - h, w * 0.28, h + 40);
        if (o.roof) poly(g, [[x - 4, yb - h], [x + w / 2, yb - h - w * 0.26], [x + w + 4, yb - h]], shade(o.roof, -0.2 - row * 0.14));
        else { g.fillStyle = shade(o.wall, -0.1 - row * 0.12); g.fillRect(x - 2, yb - h - 4, w + 4, 4); }
        for (let wy = yb - h + 6 * k; wy < yb - 5 * k; wy += 12 * k) for (let wx = x + 5 * k; wx < x + w - 7 * k; wx += 11 * k) {
          if (R() < 0.42) { g.fillStyle = rgba(o.lit, 0.72 + R() * 0.28); g.fillRect(wx, wy, 4 * k, 6 * k); if (R() < 0.25) glow(g, wx + 2 * k, wy + 3 * k, 14 * k, o.lit, 0.3); }
          else { g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(wx, wy, 4 * k, 6 * k); }
        }
        x += w + R() * 8;
      }
    }
  }
  function crescent(g, x, y, r, col) {
    const c = canvas(Math.ceil(r * 2 + 4)), cg = c.getContext('2d');
    cg.fillStyle = col; cg.beginPath(); cg.arc(r + 2, r + 2, r, 0, TAU); cg.fill();
    cg.globalCompositeOperation = 'destination-out'; cg.beginPath(); cg.arc(r * 0.62 + 2, r * 0.7 + 2, r * 0.92, 0, TAU); cg.fill();
    g.drawImage(c, x - r - 2, y - r - 2);
  }

  const LAND = {
    // Giza at sunset, the Nile in front with a felucca and palms.
    pyramids: {
      back(g, v) {
        hills(g, HZ, 34, v.far, 3, 64);
        const pyr = (x, half, h, k) => {
          const ax = x + half * 0.1, ay = HZ - h;
          poly(g, [[x - half, HZ], [ax, ay], [x + half * 0.32, HZ]], shade(v.stone, -0.5 - k * 0.04));
          poly(g, [[x + half * 0.32, HZ], [ax, ay], [x + half, HZ]], shade(v.stone, -k * 0.1));
          g.strokeStyle = 'rgba(40,20,10,0.16)'; g.lineWidth = 1.2;
          for (let i = 1; i < 26; i++) {
            const t = i / 26, y = HZ - h * t, xl = (x - half) + (ax - (x - half)) * t, xr = (x + half) + (ax - (x + half)) * t;
            g.beginPath(); g.moveTo(xl, y); g.lineTo(xr, y); g.stroke();
          }
          g.strokeStyle = rgba(v.lit, 0.5); g.lineWidth = 2; g.beginPath(); g.moveTo(ax, ay); g.lineTo(x + half * 0.32, HZ); g.stroke();
        };
        pyr(1090, 130, 140, 2); pyr(520, 175, 205, 1); pyr(790, 250, 300, 0);
      },
      front(g, v, R) {
        // far bank, the river, the near bank with reeds
        g.fillStyle = shade(v.far, -0.2); g.fillRect(0, HZ, VW, 26);
        reflect(g, HZ + 26, HZ + 160, v.water, 0.42);
        g.fillStyle = v.dark; g.beginPath(); g.moveTo(0, VH);
        for (let x = 0; x <= VW; x += 32) g.lineTo(x, HZ + 160 + Math.sin(x * 0.01) * 10 + R() * 8);
        g.lineTo(VW, VH); g.fill();
        g.strokeStyle = v.dark; g.lineWidth = 2;
        for (let i = 0; i < 160; i++) {
          const x = R() * VW, y = HZ + 166 + R() * 20, h = 30 + R() * 60;
          g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 4, y - h * 0.6, x + (R() - 0.5) * 14, y - h); g.stroke();
          if (R() < 0.35) { disc(g, x + (R() - 0.5) * 14, y - h, 5, v.dark); }
        }
        // a felucca under sail
        const bx = 330, by = HZ + 96;
        g.fillStyle = v.dark; g.beginPath(); g.moveTo(bx - 60, by); g.quadraticCurveTo(bx, by + 18, bx + 66, by - 6); g.lineTo(bx + 50, by + 4); g.quadraticCurveTo(bx, by + 10, bx - 60, by); g.fill();
        g.fillStyle = shade(v.lit, -0.05); g.beginPath(); g.moveTo(bx - 4, by - 2); g.lineTo(bx + 6, by - 150); g.quadraticCurveTo(bx + 40, by - 70, bx + 54, by - 6); g.closePath(); g.fill();
        g.strokeStyle = v.dark; g.lineWidth = 2.5; g.beginPath(); g.moveTo(bx - 34, by - 40); g.lineTo(bx + 12, by - 170); g.stroke();
        for (const [x, h, l] of [[90, 220, 30], [190, 260, -24], [262, 180, 18], [1220, 250, -26], [1320, 210, 22], [1440, 270, -20], [610, 120, 10]]) palm(g, x, HZ + 180, h, l, v.dark);
      },
    },
    // The Parthenon on the Acropolis at dusk, cypresses and olives below.
    parthenon: {
      back(g, v) {
        hills(g, HZ, 60, v.far, 11, 56);
        const top = HZ - 118;
        poly(g, [[380, HZ], [440, top + 40], [520, top + 10], [590, top], [950, top], [1030, top + 8], [1110, top + 44], [1170, HZ]], vgrad(g, top, HZ, [shade(v.rock, 0.3), v.rock, shade(v.rock, -0.3)]));
        // the rock's ledges catch the last of the sun
        g.strokeStyle = rgba(v.lit, 0.12); g.lineWidth = 2;
        for (let k = 0; k < 7; k++) { const y = top + 14 + k * 15; g.beginPath(); g.moveTo(460 + k * 9, y); g.lineTo(1090 - k * 6, y + (k % 2 ? 4 : -3)); g.stroke(); }
        g.fillStyle = rgba(v.lit, 0.35); g.fillRect(590, top, 360, 3);
        const L = 604, Rt = 932;
        for (let k = 0; k < 3; k++) { g.fillStyle = shade(v.stone, -0.12 - k * 0.07); g.fillRect(L - 14 + k * 5, top - 7 * (k + 1), Rt - L + 28 - k * 10, 7); }
        const base = top - 21, ch = 128, cw = 22;
        g.fillStyle = v.shadow; g.fillRect(L + 8, base - ch, Rt - L - 16, ch);
        g.fillStyle = rgba(v.glow, 0.5); g.fillRect(L + 40, base - ch * 0.7, Rt - L - 80, ch * 0.7);
        for (let i = 0; i < 8; i++) {
          const x = L + i * (Rt - L - cw) / 7;
          g.fillStyle = hgrad(g, x, x + cw, [v.stone, shade(v.stone, -0.08), shade(v.stone, -0.42)]); g.fillRect(x, base - ch, cw, ch);
          g.fillStyle = 'rgba(60,40,30,0.18)'; for (let f = 1; f < 4; f++) g.fillRect(x + f * cw / 4, base - ch, 1, ch);
          g.fillStyle = v.stone; g.fillRect(x - 4, base - ch - 6, cw + 8, 6);
        }
        const et = base - ch - 6;
        g.fillStyle = shade(v.stone, -0.05); g.fillRect(L - 6, et - 14, Rt - L + 12, 14);
        g.fillStyle = shade(v.stone, -0.12); g.fillRect(L - 6, et - 28, Rt - L + 12, 14);
        g.fillStyle = shade(v.stone, -0.5); for (let x = L; x < Rt; x += 18) g.fillRect(x, et - 26, 6, 10);
        g.fillStyle = v.stone; g.fillRect(L - 10, et - 32, Rt - L + 20, 4);
        poly(g, [[L - 10, et - 32], [(L + Rt) / 2, et - 74], [Rt + 10, et - 32]], shade(v.stone, -0.06));
        poly(g, [[L + 8, et - 36], [(L + Rt) / 2, et - 66], [Rt - 8, et - 36]], shade(v.stone, -0.3));
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ, VH, [shade(v.rock, -0.2), v.dark]); g.fillRect(0, HZ, VW, VH - HZ);
        glow(g, VX, HZ + 40, 520, v.glow, 0.22);
        // the old town under the rock, whitewashed and lighting up for the evening
        town(g, 300, 1240, HZ + 26, R, { wall: '#f8ecda', tone: -0.12, lit: v.lit, scale: 0.7 });
        for (let i = 0; i < 26; i++) blobTree(g, R() * VW, HZ + 120 + R() * 140, 18 + R() * 20, shade(v.dark, 0.08 + R() * 0.1), R);
        for (const [x, h] of [[70, 330], [140, 380], [215, 300], [1300, 360], [1380, 320], [1460, 390], [470, 200], [1080, 210]]) cypress(g, x, HZ + 250, h, v.dark, shade(v.dark, 0.18));
      },
    },
    // The Colosseum at sunset, its south side broken away, umbrella pines around.
    colosseum: {
      back(g, v, R) {
        hills(g, HZ, 40, v.far, 21, 60);
        const x0 = 492, x1 = 1044, cx = (x0 + x1) / 2, half = (x1 - x0) / 2, base = HZ - 2, tiers = [70, 62, 62, 44], total = 238;
        const drop = (x, y) => Math.pow((x - cx) / half, 2) * 30 * (base - y) / total;
        const ruinTop = (x) => x < cx + 70 ? -1 : base - total + Math.min(total * 0.62, (x - cx - 70) * 1.25) + (Math.floor(x / 22) % 2) * 12;
        // the far inner wall, seen where the front has fallen
        g.fillStyle = shade(v.stone, -0.42); g.fillRect(cx - 40, base - total + 30, x1 - cx + 10, total - 30);
        g.fillStyle = shade(v.stone, -0.7);
        for (let t = 0; t < 3; t++) for (let x = cx - 30; x < x1; x += 26) { archPath(g, x, base - 8 - t * 62 - 40, 13, 34); g.fill(); }
        // the facade
        g.beginPath(); g.moveTo(x0, base);
        for (let x = x0; x <= x1; x += 4) { const rt = ruinTop(x), y = Math.max(base - total + drop(x, base - total), rt); g.lineTo(x, y); }
        g.lineTo(x1, base); g.closePath();
        g.fillStyle = hgrad(g, x0, x1, [shade(v.stone, -0.45), v.stone, shade(v.stone, -0.05), shade(v.stone, -0.5)]); g.fill();
        const N = 30;
        let yb = base;
        for (let t = 0; t < 4; t++) {
          const h = tiers[t];
          for (let i = 0; i < N; i++) {
            const a = -1.45 + (i + 0.5) * 2.9 / N, x = cx + Math.sin(a) * half, w = Math.cos(a) * (half * 2.9 / N) * 0.6;
            const y = yb - 5 + drop(x, yb), rt = ruinTop(x);
            if (rt > 0 && y - h + 10 < rt) continue;
            g.fillStyle = v.shadow;
            if (t < 3) { archPath(g, x, y, w, h - 16); g.fill(); g.fillStyle = rgba(v.lit, 0.25); g.fillRect(x - w / 2 - 3, y - h + 6, 2, h - 12); }
            else if (i % 2) g.fillRect(x - w * 0.3, y - h * 0.62, w * 0.6, h * 0.34);
          }
          g.fillStyle = rgba('#000000', 0.18);
          for (let x = x0; x < x1; x += 4) { const rt = ruinTop(x); if (rt < 0 || rt < yb - h) g.fillRect(x, yb - h + drop(x, yb - h), 4, 3); }
          yb -= h;
        }
        void R;
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ, VH, [shade(v.far, -0.25), v.dark]); g.fillRect(0, HZ, VW, VH - HZ);
        glow(g, VX, HZ + 30, 520, v.lit, 0.2);
        // ochre houses and tiled roofs, the city around the arena
        town(g, 300, 1240, HZ + 30, R, { wall: v.stone, roof: '#b0462a', lit: v.lit });
        const pine = (x, y, h) => {
          g.strokeStyle = v.dark; g.lineWidth = 7; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - h * 0.6, x + 4, y - h); g.stroke();
          g.fillStyle = v.dark; g.beginPath(); g.ellipse(x + 4, y - h, h * 0.42, h * 0.12, 0, Math.PI, 0); g.fill();
          for (let k = 0; k < 6; k++) disc(g, x + 4 + (k - 2.5) * h * 0.13, y - h - 4, h * 0.08, v.dark);
        };
        for (const [x, h] of [[120, 260], [300, 220], [1250, 240], [1420, 280]]) pine(x, HZ + 220, h);
        for (const [x, h] of [[40, 340], [210, 300], [380, 260], [1150, 280], [1340, 320], [1500, 300]]) cypress(g, x, HZ + 240, h, v.dark, shade(v.dark, 0.16));
        for (let i = 0; i < 14; i++) blobTree(g, 400 + R() * 740, HZ + 170 + R() * 60, 16 + R() * 12, v.dark, R);
      },
    },
    // The Taj Mahal by moonlight with its long pool and cypress rows.
    taj: {
      back(g, v) {
        hills(g, HZ, 16, v.far, 5, 80);
        const m = v.stone, sh = v.shadow, base = HZ - 40;
        g.fillStyle = shade(m, -0.18); g.fillRect(540, base, 456, 40);
        g.fillStyle = shade(m, -0.32); for (let x = 552; x < 990; x += 24) g.fillRect(x, base + 10, 12, 22);
        const minaret = (x, h) => {
          g.fillStyle = hgrad(g, x - 10, x + 10, [m, shade(m, -0.3)]); poly(g, [[x - 10, base], [x - 7, base - h], [x + 7, base - h], [x + 10, base]]);
          g.fill();
          for (const t of [0.35, 0.68, 1]) { g.fillStyle = shade(m, -0.1); g.fillRect(x - 13, base - h * t, 26, 5); }
          g.fillStyle = m; g.beginPath(); g.ellipse(x, base - h - 4, 11, 13, 0, Math.PI, 0); g.fill();
          g.fillRect(x - 1, base - h - 26, 2, 10);
        };
        minaret(566, 250); minaret(970, 250);
        const bx0 = 646, bx1 = 890, by0 = base - 150;
        poly(g, [[bx0 + 18, by0], [bx1 - 18, by0], [bx1, by0 + 18], [bx1, base], [bx0, base], [bx0, by0 + 18]], m);
        g.fillStyle = hgrad(g, bx0, bx1, ['rgba(0,0,0,0.25)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.3)']); g.fillRect(bx0, by0, bx1 - bx0, 150);
        g.fillStyle = shade(m, -0.1); g.fillRect(724, by0 - 8, 88, 158);
        g.fillStyle = sh; archPath(g, 768, base, 62, 128, true); g.fill();
        g.fillStyle = rgba(v.glow, 0.6); archPath(g, 768, base, 26, 50, true); g.fill();
        for (const x of [672, 864]) for (const y of [base, base - 72]) { g.fillStyle = sh; archPath(g, x, y, 30, 58, true); g.fill(); }
        g.fillStyle = shade(m, -0.06); g.fillRect(708, by0 - 30, 120, 30);
        const dome = (x, y, w, h) => {
          g.beginPath(); g.moveTo(x - w * 0.42, y);
          g.bezierCurveTo(x - w * 0.62, y - h * 0.3, x - w * 0.56, y - h * 0.78, x, y - h);
          g.bezierCurveTo(x + w * 0.56, y - h * 0.78, x + w * 0.62, y - h * 0.3, x + w * 0.42, y); g.closePath();
          const grd = g.createRadialGradient(x + w * 0.2, y - h * 0.65, 4, x, y - h * 0.4, w * 0.8);
          grd.addColorStop(0, shade(m, 0.25)); grd.addColorStop(0.6, m); grd.addColorStop(1, shade(m, -0.35));
          g.fillStyle = grd; g.fill();
        };
        dome(768, by0 - 30, 150, 158);
        g.fillStyle = v.lit; g.fillRect(767, by0 - 214, 2, 30); crescent(g, 768, by0 - 220, 6, v.lit);
        for (const x of [668, 868]) { g.fillStyle = m; g.fillRect(x - 16, by0 - 26, 32, 26); dome(x, by0 - 26, 38, 40); }
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ, VH, [shade(v.far, -0.2), v.dark]); g.fillRect(0, HZ, VW, VH - HZ);
        // the long pool, with the tomb mirrored in it
        g.save(); poly(g, [[740, HZ], [796, HZ], [930, VH], [606, VH]]); g.clip();
        reflect(g, HZ, VH, v.water, 0.55);
        g.restore();
        g.fillStyle = shade(v.stone, -0.3);
        poly(g, [[734, HZ], [740, HZ], [606, VH], [590, VH]]); g.fill(); poly(g, [[796, HZ], [802, HZ], [946, VH], [930, VH]]); g.fill();
        for (let k = 0; k < 9; k++) {
          const t = Math.pow(k / 8, 1.5), y = HZ + 8 + t * 340, h = 30 + t * 240, off = 16 + t * 170;
          cypress(g, 768 - off - 30 * t, y, h, v.dark, shade(v.dark, 0.14)); cypress(g, 768 + off + 30 * t, y, h, v.dark, shade(v.dark, 0.14));
        }
        for (let i = 0; i < 22; i++) blobTree(g, (R() < 0.5 ? R() * 420 : 1116 + R() * 420), HZ + 30 + R() * 100, 20 + R() * 16, v.dark, R);
      },
    },
    // A seven-storey pagoda above misty ink-wash peaks; palace roofs below.
    pagoda: {
      back(g, v, R) {
        const peaks = (y, amp, col, seed) => {
          const r = rng(seed); g.fillStyle = col; g.beginPath(); g.moveTo(0, HZ + 10);
          let x = -40;
          while (x < VW + 60) { const w = 60 + r() * 110, h = amp * (0.4 + r() * 0.6); g.lineTo(x, y); g.bezierCurveTo(x + w * 0.1, y - h, x + w * 0.9, y - h, x + w, y); x += w * (0.7 + r() * 0.2); }
          g.lineTo(VW, HZ + 10); g.closePath(); g.fill();
        };
        peaks(HZ - 30, 260, v.far, 4);
        g.fillStyle = vgrad(g, HZ - 160, HZ, [rgba(v.mist, 0), rgba(v.mist, 0.75)]); g.fillRect(0, HZ - 160, VW, 170);
        peaks(HZ + 10, 170, shade(v.far, -0.3), 9);
        g.fillStyle = vgrad(g, HZ - 70, HZ + 10, [rgba(v.mist, 0), rgba(v.mist, 0.6)]); g.fillRect(0, HZ - 70, VW, 80);
        poly(g, [[560, HZ + 10], [640, HZ - 60], [720, HZ - 92], [820, HZ - 92], [900, HZ - 56], [980, HZ + 10]], shade(v.far, -0.5));
        const cx = 770; let y = HZ - 92;
        for (let k = 0; k < 7; k++) {
          const w = 124 - k * 12, rw = w / 2 + 24 - k;
          g.fillStyle = v.body; g.fillRect(cx - w / 2, y - 30, w, 30);
          g.fillStyle = rgba(v.glow, 0.85); for (let d = -1; d <= 1; d++) g.fillRect(cx + d * w * 0.28 - 4, y - 22, 8, 14);
          g.fillStyle = v.roof; g.beginPath();
          g.moveTo(cx - rw - 14, y - 44); g.quadraticCurveTo(cx - rw + 4, y - 30, cx - rw + 28, y - 32); g.lineTo(cx + rw - 28, y - 32);
          g.quadraticCurveTo(cx + rw - 4, y - 30, cx + rw + 14, y - 44); g.quadraticCurveTo(cx + rw - 18, y - 42, cx + w / 2 - 6, y - 52);
          g.lineTo(cx - w / 2 + 6, y - 52); g.quadraticCurveTo(cx - rw + 18, y - 42, cx - rw - 14, y - 44); g.fill();
          g.strokeStyle = rgba(v.lit, 0.8); g.lineWidth = 2; g.beginPath(); g.moveTo(cx - rw - 14, y - 44); g.quadraticCurveTo(cx - rw + 4, y - 30, cx - rw + 28, y - 32); g.lineTo(cx + rw - 28, y - 32); g.quadraticCurveTo(cx + rw - 4, y - 30, cx + rw + 14, y - 44); g.stroke();
          y -= 46;
        }
        g.fillStyle = v.lit; g.fillRect(cx - 2, y - 46, 4, 46); for (let k = 0; k < 4; k++) disc(g, cx, y - 8 - k * 10, 6 - k, v.lit);
        void R;
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ, VH, [shade(v.far, -0.4), v.dark]); g.fillRect(0, HZ, VW, VH - HZ);
        // a palace hall: red walls under a golden hipped roof
        const y0 = HZ + 150;
        g.fillStyle = v.body; g.fillRect(150, y0, 1236, 140);
        g.fillStyle = rgba(v.glow, 0.7); for (let x = 200; x < 1360; x += 92) g.fillRect(x, y0 + 40, 40, 70);
        g.fillStyle = v.roof; g.beginPath(); g.moveTo(60, y0 + 10); g.quadraticCurveTo(140, y0 - 8, 230, y0 - 70); g.lineTo(1306, y0 - 70); g.quadraticCurveTo(1396, y0 - 8, 1476, y0 + 10); g.lineTo(1476, y0 + 22); g.lineTo(60, y0 + 22); g.closePath(); g.fill();
        g.strokeStyle = rgba(v.lit, 0.5); g.lineWidth = 1.5; for (let x = 120; x < 1420; x += 9) { g.beginPath(); g.moveTo(x, y0 + 18); g.lineTo(x + (x - 768) * 0.05, y0 - 64); g.stroke(); }
        g.fillStyle = v.lit; g.fillRect(230, y0 - 76, 1076, 8);
        for (const x of [60, 1476]) { g.beginPath(); g.arc(x, y0 + 2, 12, 0, TAU); g.fill(); }
        const pine = (x, y, s) => { g.fillStyle = v.dark; g.fillRect(x - 4, y - s * 1.6, 8, s * 1.6); for (let k = 0; k < 4; k++) { g.beginPath(); g.ellipse(x + (k % 2 ? 12 : -12) * s / 40, y - s * (0.7 + k * 0.32), s * (0.9 - k * 0.15), s * 0.16, 0, 0, TAU); g.fill(); } };
        for (const [x, s] of [[60, 120], [200, 90], [1360, 110], [1480, 90]]) pine(x, HZ + 150, s);
        void R;
      },
    },
    // St Mark's campanile, the basilica's domes and the Doge's Palace across the lagoon.
    venice: {
      back(g, v) {
        hills(g, HZ, 10, v.far, 8, 90);
        // Santa Maria della Salute on the left
        g.fillStyle = shade(v.stone, -0.2); g.fillRect(200, HZ - 120, 200, 120);
        g.fillStyle = v.stone; g.beginPath(); g.ellipse(300, HZ - 120, 92, 96, 0, Math.PI, 0); g.fill();
        g.fillStyle = shade(v.stone, -0.25); g.fillRect(290, HZ - 236, 20, 24); g.beginPath(); g.ellipse(300, HZ - 236, 12, 16, 0, Math.PI, 0); g.fill();
        for (const x of [200, 400]) { g.beginPath(); g.arc(x, HZ - 120, 18, Math.PI, 0); g.fill(); }
        // the basilica domes
        g.fillStyle = shade(v.stone, -0.3); g.fillRect(520, HZ - 96, 210, 96);
        for (const [x, r] of [[560, 30], [625, 40], [690, 30]]) { g.fillStyle = shade(v.copper, -0.1); g.beginPath(); g.ellipse(x, HZ - 96, r, r * 1.05, 0, Math.PI, 0); g.fill(); g.fillStyle = v.lit; g.fillRect(x - 1, HZ - 96 - r * 1.05 - 16, 2, 16); }
        g.fillStyle = v.shadow; for (let x = 532; x < 722; x += 38) { archPath(g, x + 14, HZ, 26, 60); g.fill(); }
        // the campanile
        const cx = 790, bw = 50;
        g.fillStyle = hgrad(g, cx - bw / 2, cx + bw / 2, [shade(v.brick, 0.15), v.brick, shade(v.brick, -0.4)]); g.fillRect(cx - bw / 2, HZ - 330, bw, 330);
        g.fillStyle = 'rgba(0,0,0,0.18)'; for (const dx of [-14, 0, 14]) g.fillRect(cx + dx - 2, HZ - 320, 4, 300);
        g.fillStyle = v.stone; g.fillRect(cx - bw / 2 - 4, HZ - 376, bw + 8, 46);
        g.fillStyle = v.shadow; for (let k = 0; k < 4; k++) { archPath(g, cx - 18 + k * 12, HZ - 336, 8, 34); g.fill(); }
        g.fillStyle = shade(v.stone, -0.1); g.fillRect(cx - bw / 2, HZ - 412, bw, 36);
        poly(g, [[cx - bw / 2 - 2, HZ - 412], [cx, HZ - 520], [cx + bw / 2 + 2, HZ - 412]], v.copper);
        poly(g, [[cx, HZ - 520], [cx + bw / 2 + 2, HZ - 412], [cx + 6, HZ - 412]], shade(v.copper, -0.3));
        g.fillStyle = v.lit; g.fillRect(cx - 1.5, HZ - 548, 3, 28); disc(g, cx, HZ - 548, 4, v.lit);
        // the Doge's Palace
        const px0 = 850, px1 = 1240, pt = HZ - 128;
        g.fillStyle = v.pink; g.fillRect(px0, pt, px1 - px0, 74);
        g.strokeStyle = rgba(v.stone, 0.35); g.lineWidth = 1;
        for (let x = px0 - 74; x < px1; x += 14) { g.beginPath(); g.moveTo(x, pt + 74); g.lineTo(x + 74, pt); g.moveTo(x, pt); g.lineTo(x + 74, pt + 74); g.stroke(); }
        g.fillStyle = v.shadow; for (let x = px0 + 30; x < px1 - 20; x += 64) { archPath(g, x, pt + 52, 16, 34, true); g.fill(); }
        g.fillStyle = v.stone; g.fillRect(px0, pt + 74, px1 - px0, 54);
        g.fillStyle = v.shadow;
        for (let x = px0 + 8; x < px1 - 4; x += 14) { archPath(g, x + 5, pt + 100, 9, 20, true); g.fill(); }
        for (let x = px0 + 10; x < px1 - 10; x += 28) { archPath(g, x + 9, HZ, 18, 24); g.fill(); }
        g.fillStyle = v.stone; for (let x = px0; x < px1; x += 18) g.fillRect(x, pt - 8, 8, 8);
      },
      front(g, v, R) {
        reflect(g, HZ, VH, v.water, 0.5);
        const gondola = (x, y, s, dir) => {
          g.fillStyle = v.dark; g.beginPath();
          g.moveTo(x - 90 * s * dir, y - 22 * s); g.quadraticCurveTo(x - 60 * s * dir, y + 6 * s, x, y + 8 * s); g.quadraticCurveTo(x + 70 * s * dir, y + 6 * s, x + 96 * s * dir, y - 30 * s);
          g.lineTo(x + 90 * s * dir, y - 30 * s); g.quadraticCurveTo(x + 60 * s * dir, y - 2 * s, x, y); g.quadraticCurveTo(x - 60 * s * dir, y - 4 * s, x - 86 * s * dir, y - 22 * s); g.fill();
          g.fillRect(x + 88 * s * dir - 3 * s, y - 44 * s, 6 * s, 16 * s);
          g.fillRect(x - 50 * s * dir, y - 70 * s, 7 * s, 64 * s); disc(g, x - 47 * s * dir, y - 74 * s, 7 * s, v.dark);
          g.strokeStyle = v.dark; g.lineWidth = 2.5 * s; g.beginPath(); g.moveTo(x - 46 * s * dir, y - 50 * s); g.lineTo(x - 10 * s * dir, y + 20 * s); g.stroke();
        };
        gondola(420, HZ + 120, 0.9, 1); gondola(1120, HZ + 170, 1.2, -1); gondola(240, HZ + 300, 1.8, -1);
        for (const [x, s] of [[60, 1], [120, 1], [1420, 1.1], [1480, 1.1], [1360, 0.9]]) {
          for (let k = 0; k < 10; k++) { g.fillStyle = k % 2 ? '#e8e2d8' : '#9a1e2a'; g.fillRect(x, HZ + 60 + k * 30 * s, 12 * s, 30 * s); }
          disc(g, x + 6 * s, HZ + 58, 8 * s, v.lit);
        }
        void R;
      },
    },
    // St Basil's onion domes in the snow.
    domes: {
      back(g, v) {
        hills(g, HZ, 22, v.far, 13, 70);
        const base = HZ - 76;
        g.fillStyle = v.brick; g.fillRect(540, base, 456, 76);
        g.fillStyle = rgba(v.glow, 0.8); for (let x = 560; x < 990; x += 34) { archPath(g, x + 8, HZ - 18, 12, 28); g.fill(); }
        g.fillStyle = v.snow; g.fillRect(536, base - 4, 464, 6);
        const tower = (x, w, h) => {
          g.fillStyle = hgrad(g, x - w / 2, x + w / 2, [shade(v.brick, 0.1), v.brick, shade(v.brick, -0.45)]); g.fillRect(x - w / 2, base - h, w, h);
          g.fillStyle = v.trim; for (let k = 1; k < 4; k++) g.fillRect(x - w / 2 - 2, base - h * k / 4, w + 4, 3);
          g.fillStyle = rgba(v.glow, 0.7); archPath(g, x, base - h * 0.55, w * 0.3, h * 0.2); g.fill();
        };
        const onion = (x, y, w, c1, c2) => {
          const h = w * 1.35;
          g.save(); g.beginPath(); g.moveTo(x - w * 0.36, y);
          g.bezierCurveTo(x - w * 0.72, y - h * 0.3, x - w * 0.6, y - h * 0.62, x, y - h);
          g.bezierCurveTo(x + w * 0.6, y - h * 0.62, x + w * 0.72, y - h * 0.3, x + w * 0.36, y); g.closePath();
          g.fillStyle = c1; g.fill(); g.clip();
          g.strokeStyle = c2; g.lineWidth = w * 0.11;
          for (let k = -6; k < 8; k++) { g.beginPath(); g.moveTo(x - w + k * w * 0.24, y + 4); g.quadraticCurveTo(x + k * w * 0.24, y - h * 0.5, x + w * 0.4 + k * w * 0.24, y - h - 4); g.stroke(); }
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x + w * 0.12, y - h, w, h);
          g.fillStyle = v.snow; g.beginPath(); g.moveTo(x - w * 0.6, y - h * 0.5);
          for (let k = 0; k <= 8; k++) g.lineTo(x - w * 0.6 + k * w * 0.15, y - h * 0.5 - Math.sin(k * 1.9) * 7 - (k % 2) * 6);
          g.lineTo(x + w, y - h - 10); g.lineTo(x - w, y - h - 10); g.closePath(); g.fill();
          g.restore();
          g.fillStyle = v.lit; g.fillRect(x - 1.5, y - h - 24, 3, 24); g.fillRect(x - 7, y - h - 18, 14, 2.5);
        };
        tower(768, 56, 230); poly(g, [[738, base - 230], [768, base - 330], [798, base - 230]], v.copper);
        g.fillStyle = v.snow; poly(g, [[752, base - 290], [768, base - 330], [784, base - 290], [768, base - 300]]); g.fill();
        onion(768, base - 330, 26, v.gold, shade(v.gold, -0.3));
        const set = [[600, 40, 120, '#2a4a9a', '#f2f2f2'], [936, 40, 120, '#d89a20', '#2a6a3a'], [660, 48, 170, '#2a6a3a', '#e8c060'], [876, 48, 170, '#c8342a', '#f0e2c8'], [712, 36, 200, '#e8c060', '#a0281e'], [824, 36, 200, '#1e7a6a', '#f0e2c8']];
        set.forEach(([x, w, h, c1, c2]) => { tower(x, w, h); onion(x, base - h, w * 1.25, c1, c2); });
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ, VH, [v.snow, shade(v.snow, -0.4)]); g.fillRect(0, HZ, VW, VH - HZ);
        const fir = (x, y, h) => {
          for (let k = 0; k < 5; k++) {
            const t = k / 5, w = h * (0.42 - t * 0.07), yy = y - h * t * 0.85;
            poly(g, [[x - w, yy], [x, yy - h * 0.34], [x + w, yy]], v.dark);
            poly(g, [[x - w * 0.8, yy - h * 0.04], [x, yy - h * 0.34], [x + w * 0.5, yy - h * 0.1]], rgba(v.snow, 0.85));
          }
        };
        for (const [x, h] of [[60, 300], [170, 240], [280, 320], [1260, 300], [1370, 250], [1480, 330], [470, 150], [1080, 140]]) fir(x, HZ + 250, h);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 700; i++) { const s = R() < 0.1 ? 2.6 : 1.4; g.beginPath(); g.arc(R() * VW, R() * VH, s, 0, TAU); g.fill(); }
      },
    },
    // Manhattan at night: the Chrysler Building, searchlights and the river.
    skyline: {
      back(g, v, R) {
        for (const [x, a] of [[480, -0.5], [1060, 0.42], [1300, -0.2]]) {
          g.save(); g.translate(x, HZ); g.rotate(a);
          const grd = g.createLinearGradient(0, 0, 0, -900); grd.addColorStop(0, rgba(v.beam, 0.2)); grd.addColorStop(1, rgba(v.beam, 0));
          g.fillStyle = grd; poly(g, [[-8, 0], [-70, -900], [70, -900], [8, 0]]); g.fill(); g.restore();
        }
        const row = (col, lit, minH, maxH, seed, chance) => {
          const r = rng(seed); let x = -10;
          while (x < VW) {
            const w = 34 + r() * 60, h = minH + r() * (maxH - minH) * (Math.abs(x - 768) < 140 ? 0.55 : 1);
            g.fillStyle = col; g.fillRect(x, HZ - h, w, h);
            if (r() < 0.4) g.fillRect(x + w * 0.2, HZ - h - 26, w * 0.6, 26);
            if (lit) windowsGrid(g, x, HZ - h, x + w, HZ, r, lit, rgba('#000000', 0), chance);
            x += w + 2;
          }
        };
        row(v.far, null, 120, 300, 3);
        row(v.dark, v.glow, 60, 220, 7, 0.28);
        // the Chrysler Building
        const cx = 768, top = HZ - 380;
        g.fillStyle = hgrad(g, cx - 40, cx + 40, [shade(v.steel, -0.3), v.steel, shade(v.steel, -0.55)]);
        g.fillRect(cx - 40, top, 80, 380); g.fillRect(cx - 52, HZ - 230, 104, 230);
        windowsGrid(g, cx - 38, top + 10, cx + 38, HZ, R, v.glow, rgba(v.dark, 0.6), 0.35);
        let y = top, w = 76;
        for (let k = 0; k < 6; k++) {
          g.fillStyle = hgrad(g, cx - w / 2, cx + w / 2, [shade(v.steel, -0.2), shade(v.steel, 0.3), shade(v.steel, -0.5)]);
          g.beginPath(); g.moveTo(cx - w / 2, y); g.arc(cx, y, w / 2, Math.PI, 0); g.closePath(); g.fill();
          g.fillStyle = rgba(v.glow, 0.95);
          for (let t = 0; t < 5; t++) { const a = Math.PI + (t + 0.5) * Math.PI / 5, rx = cx + Math.cos(a) * w * 0.32, ry = y + Math.sin(a) * w * 0.32; poly(g, [[rx - 3, ry + 4], [rx, ry - 6], [rx + 3, ry + 4]]); g.fill(); }
          y -= w * 0.22; w *= 0.8;
        }
        poly(g, [[cx - 4, y + 4], [cx, y - 120], [cx + 4, y + 4]], shade(v.steel, 0.3));
        // the Empire State Building
        const ex = 1130;
        g.fillStyle = shade(v.dark, 0.12);
        g.fillRect(ex - 56, HZ - 210, 112, 210); g.fillRect(ex - 38, HZ - 300, 76, 90); g.fillRect(ex - 24, HZ - 352, 48, 52); g.fillRect(ex - 10, HZ - 390, 20, 38); g.fillRect(ex - 2, HZ - 450, 4, 60);
        windowsGrid(g, ex - 54, HZ - 208, ex + 54, HZ, R, v.glow, rgba(v.dark, 0), 0.3);
        disc(g, ex, HZ - 452, 4, '#ff5a4a'); glow(g, ex, HZ - 452, 20, '#ff5a4a', 0.5);
      },
      front(g, v, R) {
        reflect(g, HZ, VH, v.water, 0.5);
        for (let i = 0; i < 160; i++) {
          const x = R() * VW, len = 40 + R() * 200;
          const grd = g.createLinearGradient(0, HZ, 0, HZ + len); grd.addColorStop(0, rgba(v.glow, 0.35)); grd.addColorStop(1, rgba(v.glow, 0));
          g.fillStyle = grd; g.fillRect(x, HZ + 2, 2 + R() * 3, len);
        }
      },
    },
    // College towers and spires under a crescent moon.
    spires: {
      back(g, v) {
        hills(g, HZ, 20, v.far, 17, 80);
        const b0 = HZ - 90;
        g.fillStyle = v.dark; g.fillRect(360, b0, 816, 90);
        for (let x = 360; x < 1176; x += 16) g.fillRect(x, b0 - 8, 9, 8);
        g.fillStyle = rgba(v.glow, 0.9); for (let x = 390; x < 1160; x += 42) { archPath(g, x, HZ - 22, 14, 40, true); g.fill(); }
        // a domed reading room
        g.fillStyle = v.dark; g.fillRect(430, b0 - 70, 140, 70); g.beginPath(); g.ellipse(500, b0 - 70, 70, 64, 0, Math.PI, 0); g.fill(); g.fillRect(492, b0 - 160, 16, 30);
        g.fillStyle = rgba(v.glow, 0.7); for (let x = 444; x < 560; x += 22) { archPath(g, x + 6, b0 - 14, 8, 36); g.fill(); }
        // the great tower with pinnacles
        const tx = 790;
        g.fillStyle = v.dark; g.fillRect(tx - 40, HZ - 330, 80, 330);
        for (const dx of [-40, -14, 14, 40]) poly(g, [[tx + dx - 7, HZ - 330], [tx + dx, HZ - 386], [tx + dx + 7, HZ - 330]], v.dark);
        g.fillStyle = rgba(v.glow, 0.85); archPath(g, tx, HZ - 210, 22, 60, true); g.fill(); archPath(g, tx, HZ - 120, 26, 56, true); g.fill();
        g.fillStyle = rgba(v.lit, 0.25); g.fillRect(tx + 30, HZ - 330, 10, 330);
        // spires
        for (const [x, h] of [[1000, 300], [1120, 220], [640, 240]]) { g.fillStyle = v.dark; g.fillRect(x - 18, HZ - h * 0.55, 36, h * 0.55); poly(g, [[x - 18, HZ - h * 0.55], [x, HZ - h], [x + 18, HZ - h * 0.55]], v.dark); }
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ, VH, [shade(v.dark, 0.1), shade(v.dark, -0.3)]); g.fillRect(0, HZ, VW, VH - HZ);
        for (let i = 0; i < 30; i++) blobTree(g, R() * VW, HZ + 30 + R() * 60, 22 + R() * 24, shade(v.dark, -0.15), R);
      },
    },
    // A sunlit formal garden with a round temple, cypress rows and a fountain.
    garden: {
      back(g, v, R) {
        hills(g, HZ - 10, 70, v.far, 31, 70);
        hills(g, HZ, 34, shade(v.far, -0.12), 33, 60);
        const cx = 768, b0 = HZ - 60;
        poly(g, [[560, HZ], [650, b0], [886, b0], [976, HZ]], shade(v.lawn, 0.05));
        g.fillStyle = shade(v.stone, -0.1); g.fillRect(cx - 86, b0 - 10, 172, 10);
        g.fillStyle = shade(v.stone, -0.45); g.fillRect(cx - 64, b0 - 120, 128, 110);
        for (let i = 0; i < 8; i++) { const x = cx - 74 + i * 21; g.fillStyle = hgrad(g, x, x + 12, [v.stone, shade(v.stone, -0.25)]); g.fillRect(x, b0 - 118, 12, 108); }
        g.fillStyle = v.stone; g.fillRect(cx - 82, b0 - 134, 164, 16);
        g.fillStyle = shade(v.stone, -0.05); g.fillRect(cx - 56, b0 - 160, 112, 26);
        const grd = g.createRadialGradient(cx - 20, b0 - 200, 4, cx, b0 - 170, 90); grd.addColorStop(0, shade(v.stone, 0.3)); grd.addColorStop(1, shade(v.stone, -0.3));
        g.fillStyle = grd; g.beginPath(); g.ellipse(cx, b0 - 160, 62, 62, 0, Math.PI, 0); g.fill();
        g.fillStyle = v.stone; g.fillRect(cx - 10, b0 - 240, 20, 20); g.beginPath(); g.ellipse(cx, b0 - 240, 12, 10, 0, Math.PI, 0); g.fill();
        void R;
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ, VH, [v.lawn, shade(v.lawn, -0.35)]); g.fillRect(0, HZ, VW, VH - HZ);
        g.fillStyle = shade(v.lawn, -0.4);
        for (let k = 0; k < 5; k++) { const y = HZ + 30 + k * k * 12; g.fillRect(0, y, VW, 4 + k * 3); }
        g.fillStyle = rgba('#e8dcc4', 0.9); for (let k = 0; k < 6; k++) { const y = HZ + 20 + k * k * 11; g.fillRect(740 - k * k * 6, y, 56 + k * k * 12, 3 + k); }
        const fy = HZ + 210;
        g.fillStyle = shade(v.stone, -0.2); g.beginPath(); g.ellipse(768, fy, 150, 26, 0, 0, TAU); g.fill();
        g.fillStyle = v.water; g.beginPath(); g.ellipse(768, fy - 4, 138, 20, 0, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 3;
        for (let k = -4; k <= 4; k++) { g.beginPath(); g.moveTo(768, fy - 90); g.quadraticCurveTo(768 + k * 18, fy - 140, 768 + k * 30, fy - 10); g.stroke(); }
        g.fillStyle = v.stone; g.fillRect(758, fy - 92, 20, 84); disc(g, 768, fy - 96, 14, v.stone);
        for (let k = 0; k < 7; k++) {
          const t = k / 6, y = HZ + 14 + t * t * 260, h = 70 + t * 250, off = 210 + t * 420;
          cypress(g, 768 - off, y, h, v.dark, shade(v.dark, 0.25)); cypress(g, 768 + off, y, h, v.dark, shade(v.dark, 0.25));
        }
        // a stone balustrade along the terrace
        const by = VH - 120;
        g.fillStyle = v.stone; g.fillRect(0, by - 14, VW, 16); g.fillRect(0, by + 70, VW, 50);
        for (let x = 10; x < VW; x += 34) { g.beginPath(); g.moveTo(x, by + 70); g.bezierCurveTo(x - 10, by + 50, x + 26, by + 40, x + 6, by + 2); g.lineTo(x + 18, by + 2); g.bezierCurveTo(x - 2, by + 40, x + 34, by + 50, x + 24, by + 70); g.fill(); }
        void R;
      },
    },
    // Harvest fields in golden light: a windmill, a red barn and hay bales.
    fields: {
      back(g, v, R) {
        hills(g, HZ - 20, 80, v.far, 41, 80);
        const band = (y0, amp, cols, seed) => {
          const r = rng(seed);
          for (let k = 0; k < cols.length; k++) {
            g.fillStyle = cols[k]; g.beginPath(); g.moveTo(0, VH);
            for (let x = 0; x <= VW; x += 32) g.lineTo(x, y0 + k * 34 - Math.sin(x * 0.004 + seed + k) * amp - r() * 4);
            g.lineTo(VW, VH); g.fill();
          }
        };
        band(HZ - 30, 30, [shade(v.wheat, -0.2), v.green, v.wheat, shade(v.wheat, -0.12)], 2);
        // windmill
        const wx = 700, wy = HZ - 70;
        poly(g, [[wx - 30, wy], [wx - 18, wy - 140], [wx + 18, wy - 140], [wx + 30, wy]], v.dark);
        g.fillStyle = v.dark; g.beginPath(); g.ellipse(wx, wy - 140, 22, 18, 0, Math.PI, 0); g.fill();
        g.strokeStyle = v.dark; g.lineWidth = 5;
        for (let k = 0; k < 4; k++) {
          const a = 0.5 + k * Math.PI / 2, ex = wx + Math.cos(a) * 110, ey = wy - 146 + Math.sin(a) * 110;
          g.beginPath(); g.moveTo(wx, wy - 146); g.lineTo(ex, ey); g.stroke();
          g.save(); g.translate(wx, wy - 146); g.rotate(a); g.fillStyle = rgba(v.dark, 0.85); g.fillRect(20, 0, 88, 18); g.restore();
        }
        // the barn
        const bx = 930, by = HZ - 44;
        g.fillStyle = v.barn; g.fillRect(bx - 70, by - 70, 140, 70);
        poly(g, [[bx - 82, by - 66], [bx - 40, by - 116], [bx + 40, by - 116], [bx + 82, by - 66]], shade(v.barn, -0.35));
        g.strokeStyle = '#f2e6d0'; g.lineWidth = 3; g.strokeRect(bx - 24, by - 50, 48, 50); g.beginPath(); g.moveTo(bx - 24, by - 50); g.lineTo(bx + 24, by); g.moveTo(bx + 24, by - 50); g.lineTo(bx - 24, by); g.stroke();
        for (let i = 0; i < 10; i++) blobTree(g, 380 + R() * 820, HZ - 40 + R() * 30, 16 + R() * 12, shade(v.green, -0.45), R);
      },
      front(g, v, R) {
        g.fillStyle = vgrad(g, HZ + 60, VH, [v.wheat, shade(v.wheat, -0.4)]); g.fillRect(0, HZ + 60, VW, VH);
        g.strokeStyle = rgba(shade(v.wheat, -0.4), 0.5); g.lineWidth = 2;
        for (let k = 0; k < 40; k++) { const x = (k - 20) * 60; g.beginPath(); g.moveTo(768 + x * 0.2, HZ + 60); g.lineTo(768 + x * 2.6, VH); g.stroke(); }
        const bale = (x, y, r) => {
          disc(g, x, y, r, shade(v.wheat, -0.15)); g.strokeStyle = shade(v.wheat, -0.45); g.lineWidth = 2;
          for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(x, y, r * k / 5, 0, TAU); g.stroke(); }
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(x + r * 0.4, y + r * 0.92, r * 1.2, r * 0.2, 0, 0, TAU); g.fill();
        };
        bale(260, HZ + 170, 44); bale(400, HZ + 130, 32); bale(1180, HZ + 150, 40); bale(1330, HZ + 210, 60); bale(560, HZ + 100, 22);
        g.fillStyle = v.dark;
        for (let x = 0; x < VW; x += 90) g.fillRect(x, VH - 170, 10, 120);
        g.fillRect(0, VH - 150, VW, 8); g.fillRect(0, VH - 110, VW, 8);
        void R;
      },
    },
  };

  // Water below the horizon: the sky and landmark mirrored, darkened and rippled.
  function reflect(g, y0, y1, col, alpha) {
    const c = g.canvas, k = c.width / VW, sh = Math.round(Math.min(y1 - y0, HZ) * k);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = col; g.fillRect(0, Math.round(y0 * k), c.width, Math.round((y1 - y0) * k));
    g.translate(0, Math.round(y0 * k) + sh); g.scale(1, -1); g.globalAlpha = alpha;
    g.drawImage(c, 0, Math.round(HZ * k) - sh, c.width, sh, 0, 0, c.width, sh);
    g.restore();
    const grd = g.createLinearGradient(0, y0, 0, y1); grd.addColorStop(0, rgba(col, 0.1)); grd.addColorStop(1, rgba(col, 0.8));
    g.fillStyle = grd; g.fillRect(0, y0, VW, y1 - y0);
    const R = rng(77);
    g.fillStyle = 'rgba(255,240,220,0.08)';
    for (let i = 0; i < 260; i++) { const y = y0 + Math.pow(R(), 1.6) * (y1 - y0); g.fillRect(R() * VW, y, 20 + R() * 80, 1 + (y - y0) / 120); }
  }

  function panorama(def) {
    const v = def.view, o = def.palette, R = rng(v.seed || 7);
    const c = canvas(1200, 800), g = c.getContext('2d');
    g.scale(c.width / VW, c.height / VH);
    g.fillStyle = vgrad(g, 0, HZ, o.sky); g.fillRect(0, 0, VW, HZ + 4);
    if (v.stars) for (let i = 0; i < v.stars; i++) {
      const y = R() * HZ * 0.82, a = (1 - y / (HZ * 0.9)) * (0.3 + R() * 0.7);
      g.fillStyle = 'rgba(255,248,230,' + a.toFixed(3) + ')';
      g.beginPath(); g.arc(R() * VW, y, R() < 0.05 ? 2.4 : 1.1, 0, TAU); g.fill();
    }
    if (v.clouds) for (let i = 0; i < v.clouds; i++) {
      const x = R() * VW, y = 80 + R() * (HZ - 260), w = 120 + R() * 200;
      for (let k = 0; k < 7; k++) { g.fillStyle = rgba(v.cloud, 0.1 + R() * 0.12); g.beginPath(); g.ellipse(x + (R() - 0.5) * w, y + (R() - 0.5) * 24, w * (0.3 + R() * 0.3), 16 + R() * 18, 0, 0, TAU); g.fill(); }
    }
    if (v.sun) { const [x, y, r, col] = v.sun; glow(g, x, y, r * 8, col, 0.5); glow(g, x, y, r * 2.6, col, 0.75); disc(g, x, y, r, rgba(shade(col, 0.5), 0.98)); }
    if (v.moon) { const [x, y, r, cres] = v.moon; glow(g, x, y, r * 5, '#fff0d0', 0.2); if (cres) crescent(g, x, y, r, 'rgba(255,244,214,0.97)'); else disc(g, x, y, r, 'rgba(255,244,214,0.97)'); }
    g.fillStyle = vgrad(g, HZ - 220, HZ, [rgba(v.haze || o.sky[o.sky.length - 1], 0), rgba(v.haze || o.sky[o.sky.length - 1], 0.6)]); g.fillRect(0, HZ - 220, VW, 224);
    const L = LAND[v.landmark];
    if (L) { L.back(g, v, R); L.front(g, v, R); }
    return texFrom(c);
  }

  // ------------------------------------------------------------------ era interiors
  // Wall finishes, each painted as one tile; tile is its size on the wall in metres.
  function bevelPanel(g, x, y, w, h, trim) {
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 8; g.strokeRect(x, y, w, h);
    g.strokeStyle = 'rgba(255,236,200,0.16)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 9, y + h - 9); g.lineTo(x + 9, y + 9); g.lineTo(x + w - 9, y + 9); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.moveTo(x + w - 9, y + 9); g.lineTo(x + w - 9, y + h - 9); g.lineTo(x + 9, y + h - 9); g.stroke();
    if (trim) { g.strokeStyle = trim; g.lineWidth = 2.5; g.strokeRect(x + 26, y + 26, w - 52, h - 52); }
  }
  function glyph(g, k, x, y, s, R) {
    // a small painted hieroglyph from a handful of shapes: ankh, eye, reed, water, bird, sun
    g.save(); g.translate(x, y); g.lineWidth = s * 0.12; g.lineCap = 'round';
    const cols = ['#1e3a8a', '#9a2a1e', '#2a6a4a', '#1a1410', '#c8902a'];
    g.strokeStyle = g.fillStyle = cols[k % cols.length];
    switch (k % 6) {
      case 0: g.beginPath(); g.ellipse(0, -s * 0.3, s * 0.18, s * 0.24, 0, 0, TAU); g.stroke(); g.fillRect(-s * 0.36, -s * 0.06, s * 0.72, s * 0.12); g.fillRect(-s * 0.06, -s * 0.06, s * 0.12, s * 0.6); break;
      case 1: g.beginPath(); g.ellipse(0, 0, s * 0.4, s * 0.18, 0, 0, TAU); g.stroke(); g.beginPath(); g.arc(0, 0, s * 0.1, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-s * 0.1, s * 0.18); g.quadraticCurveTo(-s * 0.2, s * 0.5, -s * 0.36, s * 0.42); g.stroke(); break;
      case 2: g.beginPath(); g.moveTo(0, s * 0.5); g.lineTo(0, -s * 0.2); g.stroke(); g.beginPath(); g.ellipse(s * 0.06, -s * 0.34, s * 0.1, s * 0.2, 0.3, 0, TAU); g.fill(); break;
      case 3: g.beginPath(); for (let i = 0; i <= 8; i++) g.lineTo(-s * 0.45 + i * s * 0.1125, (i % 2 ? -1 : 1) * s * 0.1); g.stroke(); break;
      case 4: g.beginPath(); g.ellipse(0, 0, s * 0.3, s * 0.16, -0.2, 0, TAU); g.fill(); g.beginPath(); g.arc(s * 0.26, -s * 0.18, s * 0.1, 0, TAU); g.fill(); g.fillRect(-s * 0.05, s * 0.12, s * 0.06, s * 0.3); g.fillRect(s * 0.06, s * 0.12, s * 0.06, s * 0.3); break;
      default: g.beginPath(); g.arc(0, 0, s * 0.26, 0, TAU); g.fill();
    }
    g.restore(); void R;
  }
  function wallFinish(def) {
    const o = def.palette, kind = def.wall || 'damask';
    if (kind === 'damask') return { map: damask(o), tile: [3, 3], rough: 0.8 };
    const c = canvas(512), g = c.getContext('2d'), R = rng(23);
    let tile = [2.46, 2.96], rough = 0.4, clear = 0.5;
    if (kind === 'panel') {
      g.drawImage(TEX.wood(shade(o.wood, 0.12), shade(o.wood, -0.45), { lines: 30, seed: 4, contrast: 0.5 }).image, 0, 0, 512, 512);
      bevelPanel(g, 30, 30, 452, 452, o.trim);
    } else if (kind === 'marble' || kind === 'pietra') {
      g.drawImage(TEX.marble(o.paper, o.paperInk, { size: 512, scale: 2, strength: 0.5, strength2: 0.3 }).image, 0, 0);
      g.strokeStyle = rgba(o.trim, 0.85); g.lineWidth = 3; g.strokeRect(1.5, 1.5, 509, 509);
      tile = [2.46, 2.46]; rough = 0.22; clear = 0.8;
      if (kind === 'pietra') {
        // pietra dura: inlaid flowers inside a cusped cartouche
        g.strokeStyle = rgba(o.trim, 0.8); g.lineWidth = 3;
        archPath(g, 256, 440, 260, 360, true); g.stroke();
        g.save(); g.translate(256, 300);
        g.strokeStyle = '#3a6a3a'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 110); g.bezierCurveTo(-10, 40, 10, -20, 0, -70); g.stroke();
        for (const [lx, ly, a] of [[-30, 50, -0.8], [30, 20, 0.8], [-26, -10, -0.7], [24, -40, 0.7]]) { g.fillStyle = '#2f6a40'; g.beginPath(); g.ellipse(lx, ly, 10, 28, a, 0, TAU); g.fill(); }
        for (const [fx, fy, col] of [[0, -84, '#b8303a'], [-44, 26, '#d8902a'], [44, -6, '#b8303a']]) {
          for (let i = 0; i < 6; i++) { g.save(); g.translate(fx, fy); g.rotate(i * TAU / 6); g.fillStyle = col; g.beginPath(); g.ellipse(0, -12, 7, 13, 0, 0, TAU); g.fill(); g.restore(); }
          disc(g, fx, fy, 5, '#e8c060');
        }
        g.restore();
        tile = [2.46, 2.96];
      }
    } else if (kind === 'sectile') {
      // Roman opus sectile: travertine, a porphyry panel with a giallo border and a roundel
      g.drawImage(TEX.stone('#d8c8a8', '#b8a888', { scale: 3, cloud: 0.25 }).image, 0, 0);
      g.drawImage(TEX.stone('#c8a050', '#a87a30', { scale: 4, cloud: 0.4 }).image, 40, 40, 432, 432);
      g.drawImage(TEX.stone('#6a1e26', '#b06a6a', { scale: 6, speckScale: 200, speckCut: 0.3 }).image, 64, 64, 384, 384);
      g.save(); g.beginPath(); g.arc(256, 256, 120, 0, TAU); g.clip(); g.drawImage(TEX.stone('#1f4a34', '#6aa080', { scale: 5, speckScale: 160 }).image, 0, 0); g.restore();
      g.save(); g.beginPath(); g.arc(256, 256, 92, 0, TAU); g.clip(); g.drawImage(TEX.stone('#6a1e26', '#b06a6a', { scale: 6, speckScale: 200, speckCut: 0.3 }).image, 0, 0); g.restore();
      g.strokeStyle = rgba(o.trim, 0.9); g.lineWidth = 3; for (const r of [120, 92]) { g.beginPath(); g.arc(256, 256, r, 0, TAU); g.stroke(); }
      g.strokeRect(64, 64, 384, 384);
      tile = [3.28, 3.28]; rough = 0.25; clear = 0.8;
    } else if (kind === 'stone') {
      g.drawImage(TEX.stone(o.paper, o.paperInk, { scale: 4, cloud: 0.35, speckScale: 180, speckCut: 0.35, speckMix: 0.4 }).image, 0, 0);
      g.strokeStyle = 'rgba(60,40,20,0.35)'; g.lineWidth = 2;
      for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); for (let x = (y / 128) % 2 ? 128 : 0; x < 512; x += 256) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 128); g.stroke(); } }
      // painted columns of hieroglyphs between ruled lines
      g.globalAlpha = 0.85;
      for (const x of [86, 256, 426]) {
        g.fillStyle = 'rgba(30,58,138,0.55)'; g.fillRect(x - 40, 0, 3, 512); g.fillRect(x + 37, 0, 3, 512);
        for (let y = 30, k = Math.floor(x / 9); y < 500; y += 58, k += 5) glyph(g, k, x, y, 48, R);
      }
      g.globalAlpha = 1;
      tile = [3.28, 3.28]; rough = 0.75; clear = 0;
    } else if (kind === 'lacquer') {
      g.drawImage(TEX.mottle(o.paper, { amount: 0.18 }).image, 0, 0, 512, 512);
      g.strokeStyle = o.trim; g.lineWidth = 6; g.strokeRect(24, 24, 464, 464);
      g.lineWidth = 3;
      // thunder fret border
      g.beginPath();
      for (let x = 44; x < 460; x += 32) for (const y of [44, 444]) { g.moveTo(x, y + 24); g.lineTo(x, y); g.lineTo(x + 24, y); g.lineTo(x + 24, y + 16); g.lineTo(x + 8, y + 16); g.lineTo(x + 8, y + 8); g.lineTo(x + 16, y + 8); }
      for (let y = 76; y < 430; y += 32) for (const x of [44, 444]) { g.moveTo(x, y); g.lineTo(x + 24, y); g.lineTo(x + 24, y + 24); g.lineTo(x + 8, y + 24); g.lineTo(x + 8, y + 8); g.lineTo(x + 16, y + 8); }
      g.stroke();
      g.beginPath(); g.arc(256, 256, 110, 0, TAU); g.stroke(); g.beginPath(); g.arc(256, 256, 96, 0, TAU); g.stroke();
      // a round shou medallion
      g.lineWidth = 8; g.beginPath(); g.moveTo(196, 256); g.lineTo(316, 256); g.moveTo(256, 196); g.lineTo(256, 316); g.moveTo(206, 216); g.lineTo(306, 216); g.lineTo(306, 296); g.lineTo(206, 296); g.closePath(); g.stroke();
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + Math.PI / 4; disc(g, 256 + Math.cos(a) * 150, 256 + Math.sin(a) * 150, 12, o.trim); }
      tile = [2.46, 2.46]; rough = 0.3; clear = 1;
    } else if (kind === 'deco') {
      g.drawImage(TEX.mottle('#0e0e10', { amount: 0.1 }).image, 0, 0, 512, 512);
      g.save(); g.translate(256, 512);
      for (let i = 0; i < 17; i++) { const a = Math.PI + (i / 16) * Math.PI; g.strokeStyle = rgba(o.paperInk, i % 2 ? 0.9 : 0.5); g.lineWidth = i % 2 ? 3 : 1.5; g.beginPath(); g.moveTo(Math.cos(a) * 40, Math.sin(a) * 40); g.lineTo(Math.cos(a) * 230, Math.sin(a) * 230); g.stroke(); }
      for (const r of [40, 120, 232]) { g.strokeStyle = rgba(o.paperInk, 0.9); g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r, Math.PI, TAU); g.stroke(); }
      g.restore();
      g.strokeStyle = rgba(o.trim, 0.8); g.lineWidth = 2;
      for (const x of [14, 22, 490, 498]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
      g.strokeStyle = rgba(o.paperInk, 0.85); g.lineWidth = 3;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(60 + k * 20, 120 - k * 30); g.lineTo(256, 20 - k * 30 + 60); g.lineTo(452 - k * 20, 120 - k * 30); g.stroke(); }
      tile = [2.46, 2.46]; rough = 0.2; clear = 1;
    } else if (kind === 'plaster') {
      g.drawImage(TEX.mottle(o.paper, { amount: 0.22 }).image, 0, 0, 512, 512);
      const beam = TEX.wood(shade(o.wood, 0.1), shade(o.wood, -0.5), { lines: 18, seed: 9, contrast: 0.6 }).image;
      g.drawImage(beam, 0, 0, 44, 512); g.save(); g.translate(0, 0); g.rotate(-Math.PI / 2); g.drawImage(beam, -300, 0, 40, 512); g.restore();
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(44, 0, 6, 512); g.fillRect(0, 300, 512, 6);
      for (let i = 0; i < 6; i++) disc(g, 22, 40 + i * 90, 4, shade(o.wood, -0.6));
      tile = [3.28, 2.96]; rough = 0.85; clear = 0;
    }
    return { map: texFrom(c), tile, rough, clear };
  }
  function dadoTexture(def) {
    const o = def.palette;
    if (!o.dado) return wainscot(o);
    const c = canvas(512, 384), g = c.getContext('2d');
    const base = def.wall === 'stone' ? TEX.stone(o.dado, shade(o.dado, -0.3), { scale: 4 }) : def.wall === 'lacquer' || def.wall === 'deco' ? TEX.mottle(o.dado, { amount: 0.12 }) : TEX.marble(o.dado, shade(o.dado, -0.35), { size: 512, scale: 2, strength: 0.6 });
    g.drawImage(base.image, 0, 0, 512, 384);
    bevelPanel(g, 40, 40, 432, 300, o.trim);
    return texFrom(c);
  }
  // A band of ornament under the cornice line: meander, lotus, flowers, fret, chevrons.
  function friezeTexture(kind, o) {
    const c = canvas(1024, 96), g = c.getContext('2d');
    const band = kind === 'chevron' ? '#0e0e10' : kind === 'fret' ? o.paper : kind === 'lotus' ? '#d8b878' : shade(o.paper, -0.04);
    g.fillStyle = band; g.fillRect(0, 0, 1024, 96);
    g.fillStyle = o.trim; g.fillRect(0, 0, 1024, 6); g.fillRect(0, 90, 1024, 6);
    if (kind === 'meander') { g.strokeStyle = o.trim; g.lineWidth = 5; meander(g, 8, 22, 1024, 34, true); }
    else if (kind === 'lotus') {
      g.fillStyle = '#1e3a8a'; g.fillRect(0, 10, 1024, 6); g.fillStyle = '#9a2a1e'; g.fillRect(0, 80, 1024, 6);
      for (let x = 32; x < 1024; x += 64) {
        g.fillStyle = '#2a6a4a'; g.beginPath(); g.moveTo(x, 76); g.lineTo(x - 20, 30); g.quadraticCurveTo(x, 44, x + 20, 30); g.closePath(); g.fill();
        g.fillStyle = '#1e3a8a'; g.beginPath(); g.moveTo(x, 70); g.lineTo(x - 9, 24); g.lineTo(x + 9, 24); g.closePath(); g.fill();
        g.fillStyle = '#9a2a1e'; g.beginPath(); g.ellipse(x + 32, 56, 8, 18, 0, 0, TAU); g.fill();
      }
    } else if (kind === 'floral') {
      g.strokeStyle = '#3a6a3a'; g.lineWidth = 4; g.beginPath(); for (let x = 0; x <= 1024; x += 8) g.lineTo(x, 48 + Math.sin(x / 1024 * TAU * 8) * 20); g.stroke();
      for (let k = 0; k < 16; k++) { const x = 32 + k * 64, y = 48 - Math.sin((x / 1024) * TAU * 8) * 4; for (let i = 0; i < 6; i++) { g.save(); g.translate(x, y); g.rotate(i * TAU / 6); g.fillStyle = k % 2 ? '#b8303a' : '#d8902a'; g.beginPath(); g.ellipse(0, -9, 5, 10, 0, 0, TAU); g.fill(); g.restore(); } disc(g, x, y, 4, '#e8c060'); }
    } else if (kind === 'fret') {
      g.strokeStyle = o.trim; g.lineWidth = 4; g.beginPath();
      for (let x = 10; x < 1024; x += 40) { g.moveTo(x, 78); g.lineTo(x, 18); g.lineTo(x + 30, 18); g.lineTo(x + 30, 66); g.lineTo(x + 10, 66); g.lineTo(x + 10, 34); g.lineTo(x + 20, 34); g.lineTo(x + 20, 50); }
      g.stroke();
    } else if (kind === 'chevron') {
      g.strokeStyle = o.paperInk; g.lineWidth = 4;
      for (const dy of [0, 18, 36]) { g.beginPath(); for (let x = 0; x <= 1024; x += 32) g.lineTo(x, 22 + dy + ((x / 32) % 2 ? 14 : 0)); g.stroke(); }
    } else if (kind === 'eggdart') {
      for (let x = 20; x < 1024; x += 40) { g.fillStyle = o.trim; g.beginPath(); g.ellipse(x, 48, 13, 24, 0, 0, TAU); g.fill(); g.fillStyle = shade(o.trim, -0.4); g.beginPath(); g.ellipse(x, 50, 8, 17, 0, 0, TAU); g.fill(); g.fillStyle = o.trim; g.beginPath(); g.moveTo(x + 20, 24); g.lineTo(x + 24, 48); g.lineTo(x + 20, 76); g.lineTo(x + 16, 48); g.fill(); }
    }
    return texFrom(c, { repeat: [1, 1] });
  }

  // Floors: parquet, marble octagons, stone flags, wide planks. Never a chequer: around the
  // table it would read as a second chessboard.
  function floorTexture(def) {
    const o = def.palette, kind = def.floor || 'parquet';
    if (kind === 'parquet') return parquet(o);
    const N = 1024, c = canvas(N), g = c.getContext('2d');
    if (kind === 'octagon') {
      // marble octagons with small square insets where four meet: a palace floor that never
      // reads as a second chessboard around the table
      const L = TEX.marble(o.floor, shade(o.floor, -0.22), { size: 512, scale: 2, strength: 0.4 }).image, D = TEX.marble(o.floorDark, shade(o.floorDark, 0.3), { size: 512, scale: 2, strength: 0.5 }).image;
      g.drawImage(L, 0, 0, N, N);
      const T = 256, a = T * 0.21;
      const oct = (x, y) => { g.beginPath(); g.moveTo(x + a, y); g.lineTo(x + T - a, y); g.lineTo(x + T, y + a); g.lineTo(x + T, y + T - a); g.lineTo(x + T - a, y + T); g.lineTo(x + a, y + T); g.lineTo(x, y + T - a); g.lineTo(x, y + a); g.closePath(); };
      for (let y = 0; y <= N; y += T) for (let x = 0; x <= N; x += T) {
        g.save(); g.beginPath(); g.moveTo(x, y - a); g.lineTo(x + a, y); g.lineTo(x, y + a); g.lineTo(x - a, y); g.closePath(); g.clip();
        g.drawImage(D, (x % 512) - a, (y % 512) - a, 2 * a, 2 * a, x - a, y - a, 2 * a, 2 * a); g.restore();
      }
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.28)';
      for (let y = 0; y < N; y += T) for (let x = 0; x < N; x += T) { oct(x, y); g.stroke(); }
      if (o.floorLine) { g.lineWidth = 2; g.strokeStyle = o.floorLine; for (let y = 0; y < N; y += T) for (let x = 0; x < N; x += T) { oct(x, y); g.stroke(); } }
      return texFrom(c, { repeat: [10, 10] });
    }
    if (kind === 'stone') {
      g.drawImage(TEX.stone(o.floor, o.floorDark, { scale: 5, cloud: 0.3, speckScale: 260, speckCut: 0.3, speckMix: 0.45 }).image, 0, 0, N, N);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
      for (let y = 0; y <= N; y += 256) { g.beginPath(); g.moveTo(0, y); g.lineTo(N, y); g.stroke(); for (let x = (y / 256) % 2 ? 192 : 0; x < N; x += 384) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 256); g.stroke(); } }
      return texFrom(c, { repeat: [10, 10] });
    }
    // planks
    const wood = TEX.wood(o.floor, o.floorDark, { lines: 34, seed: 6, contrast: 0.5, figure: 0.2 }).image;
    g.save(); g.translate(N, 0); g.rotate(Math.PI / 2); g.drawImage(wood, 0, 0, N, N); g.restore();
    g.fillStyle = 'rgba(0,0,0,0.45)';
    for (let y = 0; y < N; y += 128) { g.fillRect(0, y, N, 3); const off = (y / 128) % 3 * 340; g.fillRect(off, y, 3, 128); g.fillRect((off + 600) % N, y, 3, 128); }
    return texFrom(c, { repeat: [8, 8] });
  }

  // Window openings: rectangular, round-arched, pointed, a round moon gate or an
  // Egyptian portal, as flat outlines grown by `grow` on every side.
  function opening(kind, w, h, grow) {
    const s = new THREE.Shape(), gw = grow || 0, hw = w / 2 + gw, y0 = -h / 2 - gw;
    if (kind === 'moon') { s.absarc(0, 0, w / 2 + gw, 0, TAU, false); return s; }
    s.moveTo(-hw, y0); s.lineTo(hw, y0);
    if (kind === 'portal') { const tw = w * 0.42 + gw; s.lineTo(tw, h / 2 + gw); s.lineTo(-tw, h / 2 + gw); }
    else if (kind === 'arch') { const sy = h / 2 - w / 2; s.lineTo(hw, sy); s.absarc(0, sy, hw, 0, Math.PI, false); }
    else if (kind === 'pointed') { const sy = h / 2 - 0.866 * w, Rr = w + gw, a = Math.acos((w / 2) / Rr); s.lineTo(hw, sy); s.absarc(-w / 2, sy, Rr, 0, a, false); s.absarc(w / 2, sy, Rr, Math.PI - a, Math.PI, false); }
    else { s.lineTo(hw, h / 2 + gw); s.lineTo(-hw, h / 2 + gw); }
    s.closePath();
    return s;
  }
  function ringGeometry(kind, w, h, t, depth) {
    const s = opening(kind, w, h, t);
    s.holes.push(opening(kind, w, h, 0));
    const g = new THREE.ExtrudeGeometry(s, { depth: depth || 0.16, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2, curveSegments: 40 });
    g.translate(0, 0, -(depth || 0.16) / 2);
    return g;
  }
  // Glazing bars to suit each opening.
  function glazing(kind, w, h, style) {
    const parts = [], bar = (bw, bh, x, y, rz) => { const b = new THREE.BoxGeometry(bw, bh, 0.1); if (rz) b.rotateZ(rz); b.translate(x, y, 0); parts.push(b); };
    if (kind === 'moon') {
      const r = w / 2;
      for (let k = -4; k <= 4; k++) { const d = k * r / 4.6, ch = 2 * Math.sqrt(Math.max(0, r * r - d * d)); if (ch > 0.2) { bar(0.07, ch, d, 0); bar(ch, 0.07, 0, d); } }
    } else if (style === 'grid') {
      for (const x of [-w / 3, 0, w / 3]) bar(0.08, h, x, 0);
      for (let y = -h / 2 + h / 6; y < h / 2; y += h / 6) bar(w, 0.08, 0, y);
    } else {
      const sy = kind === 'arch' ? h / 2 - w / 2 : kind === 'pointed' ? h / 2 - 0.866 * w : h / 2;
      bar(0.1, kind === 'pointed' ? h : kind === 'arch' ? h - w / 2 + w / 2 : h, 0, 0);
      for (const y of [-h / 2 + (sy + h / 2) / 3, -h / 2 + 2 * (sy + h / 2) / 3]) bar(w, 0.1, 0, y);
      if (kind === 'arch') { bar(w, 0.1, 0, sy); for (const a of [0.55, 1.05, 2.09, 2.59]) { const L = w / 2; bar(L, 0.08, Math.cos(a) * L / 2, sy + Math.sin(a) * L / 2, a); } }
      if (kind === 'pointed') { bar(w, 0.1, 0, sy); for (const s of [-1, 1]) { const L = w * 0.52; bar(L, 0.08, s * w * 0.18, sy + w * 0.24, s * 0.95); } }
      if (kind === 'rect' && style !== 'none') for (const x of [-w / 4, w / 4]) bar(0.08, h, x, 0);
    }
    return K.merge(parts);
  }

  // Vases for the niches, one shape per era.
  function vaseTexture(style) {
    const c = canvas(512, 256), g = c.getContext('2d');
    if (style === 'porcelain') {
      g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = '#1e3a8a'; g.fillStyle = '#1e3a8a';
      for (const y of [18, 30, 226, 238]) g.fillRect(0, y, 512, 4);
      g.lineWidth = 4;
      for (let k = 0; k < 4; k++) {
        const x = 64 + k * 128;
        g.beginPath(); g.moveTo(x - 50, 180); g.bezierCurveTo(x - 30, 100, x + 30, 160, x + 10, 70); g.stroke();
        for (const [px, py] of [[x - 20, 130], [x + 14, 86], [x - 40, 170]]) { for (let i = 0; i < 5; i++) { g.save(); g.translate(px, py); g.rotate(i * TAU / 5); g.beginPath(); g.ellipse(0, -10, 6, 10, 0, 0, TAU); g.fill(); g.restore(); } }
      }
      g.beginPath(); for (let x = 0; x <= 512; x += 16) g.lineTo(x, 52 + (x / 16 % 2 ? 10 : 0)); g.stroke();
    } else if (style === 'amphora') {
      g.fillStyle = '#c8682e'; g.fillRect(0, 0, 512, 256);
      g.fillStyle = '#16100c'; g.fillRect(0, 0, 512, 40); g.fillRect(0, 214, 512, 42); g.fillRect(0, 96, 512, 70);
      g.strokeStyle = '#c8682e'; g.lineWidth = 4; meander(g, 4, 104, 512, 22, true);
      g.fillStyle = '#16100c';
      for (let x = 16; x < 512; x += 32) { g.beginPath(); g.moveTo(x, 214); g.lineTo(x - 10, 186); g.quadraticCurveTo(x, 176, x + 10, 186); g.closePath(); g.fill(); }
    } else if (style === 'canopic') {
      g.drawImage(TEX.marble('#efe2c4', '#c8b088', { size: 512, scale: 2, strength: 0.4 }).image, 0, 0, 512, 256);
      g.globalAlpha = 0.9; for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) glyph(g, k * 3 + j, 64 + k * 128, 80 + j * 50, 34, null); g.globalAlpha = 1;
      g.fillStyle = '#1e3a8a'; g.fillRect(0, 30, 512, 8); g.fillStyle = '#c8902a'; g.fillRect(0, 40, 512, 5);
    } else return null;
    const t = texFrom(c); t.wrapS = THREE.RepeatWrapping; return t;
  }
  function vase(style, metalName) {
    const grp = new THREE.Group();
    const P = {
      amphora: K.profile(0, 0).line(0.22, 0).line(0.18, 0.12).curve([[0.42, 0.5], [0.56, 0.9], [0.44, 1.4], [0.18, 1.7]]).line(0.15, 2.0).line(0.26, 2.08).line(0.24, 2.12).line(0, 2.1),
      urn: K.profile(0, 0).line(0.4, 0).line(0.4, 0.1).line(0.18, 0.2).line(0.14, 0.5).curve([[0.5, 0.7], [0.62, 1.0], [0.6, 1.3]]).line(0.66, 1.36).line(0.6, 1.42).line(0, 1.4),
      porcelain: K.profile(0, 0).line(0.3, 0).line(0.32, 0.1).curve([[0.42, 0.6], [0.56, 1.2], [0.52, 1.5], [0.22, 1.72]]).line(0.16, 1.8).line(0.2, 1.96).line(0, 1.96),
      canopic: K.profile(0, 0).line(0.34, 0).curve([[0.46, 0.4], [0.48, 0.9], [0.42, 1.2]]).line(0.3, 1.26).curve([[0.34, 1.4], [0.3, 1.66], [0.12, 1.78]]).line(0, 1.8),
      ewer: K.profile(0, 0).line(0.34, 0).line(0.24, 0.12).curve([[0.5, 0.5], [0.52, 0.8], [0.3, 1.1], [0.1, 1.5]]).line(0.1, 1.9).line(0.2, 2.0).line(0, 1.98),
      glass: K.profile(0, 0).line(0.3, 0).line(0.14, 0.14).line(0.12, 0.4).curve([[0.36, 0.7], [0.42, 1.1], [0.26, 1.6], [0.34, 2.1]]).line(0.38, 2.2).line(0, 2.18),
      deco: K.profile(0, 0).line(0.42, 0).line(0.42, 0.14).line(0.3, 0.14).line(0.3, 0.3).line(0.5, 0.36).line(0.38, 1.5).line(0.46, 1.56).line(0.46, 1.64).line(0, 1.64),
      jug: K.profile(0, 0).line(0.36, 0).curve([[0.5, 0.4], [0.5, 0.8], [0.3, 1.1]]).line(0.24, 1.3).line(0.3, 1.38).line(0, 1.36),
    };
    const key = { 'urn-gold': 'urn', 'urn-bronze': 'urn', 'urn-malachite': 'urn' }[style] || style;
    const prof = P[key] || P.urn;
    const tex = vaseTexture(style);
    const mat = style === 'urn-malachite' ? MAT.stone(TEX.malachite({ bands: 30 }), { roughness: 0.15 })
      : style === 'glass' ? MAT.glass('#2aa0b8', { attenuationDistance: 0.3 })
      : style === 'jug' ? MAT.matte('#8a4a26', { roughness: 0.7 })
      : style === 'deco' ? MAT.lacquer('#0e0e10')
      : style === 'ewer' ? MAT.brass()
      : tex ? new THREE.MeshPhysicalMaterial({ map: tex, roughness: style === 'amphora' ? 0.6 : 0.2, clearcoat: style === 'amphora' ? 0 : 1, clearcoatRoughness: 0.1 })
      : metal(metalName);
    if (tex) { const total = prof.rings().slice(-1)[0].len; tex.repeat.set(style === 'porcelain' || style === 'amphora' ? 2 : 1, 1 / total); }
    const body = new THREE.Mesh(K.revolve(prof, { segs: 48 }), mat);
    body.castShadow = true; grp.add(body);
    if (key === 'amphora' || key === 'urn') for (const s of [-1, 1]) grp.add(new THREE.Mesh(K.tube(key === 'amphora' ? [[s * 0.16, 1.9, 0], [s * 0.4, 1.86, 0], [s * 0.42, 1.6, 0], [s * 0.36, 1.42, 0]] : [[s * 0.56, 1.2, 0], [s * 0.82, 1.24, 0], [s * 0.78, 0.96, 0], [s * 0.56, 0.9, 0]], 0.04, { segs: 18, radial: 8 }), style === 'amphora' ? MAT.matte('#16100c') : metal(metalName)));
    if (key === 'urn' && style !== 'urn-bronze') grp.add(new THREE.Mesh(K.merge([K.ring(0.64, 1.38, 0.035), K.ring(0.4, 0.06, 0.035)]), metal(metalName)));
    if (key === 'deco') grp.add(new THREE.Mesh(K.merge([K.ring(0.43, 0.14, 0.03), K.ring(0.46, 1.6, 0.03), K.ring(0.45, 0.4, 0.02)]), MAT.chrome()));
    if (key === 'canopic') { const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 16), MAT.gold()); head.position.y = 1.62; head.scale.set(1, 1.2, 1); grp.add(head); }
    return grp;
  }

  // Ceiling lights: crystal, Murano glass, brass, silk lanterns, a bronze ring of oil
  // lamps, stepped deco glass or a cartwheel of candles.
  function lantern(s, flames) {
    const grp = new THREE.Group();
    const silk = new THREE.MeshPhysicalMaterial({ color: '#c81e1a', roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#ff9a7a'), emissive: '#ff3a14', emissiveIntensity: 0.65 });
    const body = new THREE.Mesh(K.revolve(K.profile(0, -0.7).line(0.45, -0.7).curve([[0.85, -0.3], [0.92, 0.1], [0.75, 0.5]]).line(0.45, 0.7).line(0, 0.7), { segs: 40, mod: K.MOD.flutes(12, 0.04, -0.6, 0.6) }), silk);
    grp.add(body);
    const gold = MAT.gold();
    grp.add(new THREE.Mesh(K.merge([new THREE.CylinderGeometry(0.42, 0.5, 0.18, 24).translate(0, 0.76, 0), new THREE.CylinderGeometry(0.5, 0.42, 0.18, 24).translate(0, -0.76, 0), new THREE.CylinderGeometry(0.02, 0.02, 3, 6).translate(0, 2.3, 0)]), gold));
    grp.add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.9, 16).translate(0, -1.3, 0).rotateX(Math.PI), MAT.matte('#d8282a')));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#ff7a3a').multiplyScalar(0.8), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
    halo.scale.set(4, 4, 1); grp.add(halo);
    grp.scale.setScalar(s);
    void flames;
    return grp;
  }
  function fixture(def, y, flames) {
    const kind = def.light || 'crystal', grp = new THREE.Group();
    if (kind === 'crystal' || kind === 'murano' || kind === 'brass') return chandelier(y, flames, { metal: kind === 'brass' ? MAT.brass() : MAT.gold(), tints: kind === 'murano' ? ['#ff8ab0', '#6fd8e8', '#f6c050', '#c8a0ff'] : null, crystal: kind !== 'brass' });
    if (kind === 'lantern') {
      grp.add(lantern(1.3, flames));
      for (const [x, z, dy] of [[-3.2, 1.4, 1.2], [3.2, -1.4, 1.2], [1.4, 3.2, 1.6], [-1.4, -3.2, 1.6]]) { const l = lantern(0.8, flames); l.position.set(x, dy, z); grp.add(l); }
    } else if (kind === 'bronze') {
      const br = MAT.bronze();
      grp.add(new THREE.Mesh(K.merge([K.ring(2.0, 0, 0.07, { seg: 96 }), K.ring(1.4, -0.1, 0.04, { seg: 96 }),
        ...[0, 1, 2].map((i) => { const a = i * TAU / 3; return new THREE.CylinderGeometry(0.018, 0.018, 4.6, 6).rotateZ(0).translate(0, 0, 0).rotateX(0).translate(Math.cos(a) * 1.0, 2.2, Math.sin(a) * 1.0); }),
        new THREE.ConeGeometry(0.3, 0.9, 16).rotateX(Math.PI).translate(0, -0.5, 0)]), br));
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12, x = Math.cos(a) * 2.0, z = Math.sin(a) * 2.0;
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, TAU, Math.PI / 2, Math.PI / 2), br); bowl.position.set(x, 0.12, z); grp.add(bowl);
        flame(x, 0.14, z, 0.26, flames).forEach((m) => grp.add(m));
      }
      grp.position.y = y; return grp;
    } else if (kind === 'deco') {
      const frost = new THREE.MeshStandardMaterial({ color: '#fff6e8', emissive: '#fff0d8', emissiveIntensity: 1.6, roughness: 0.5 });
      [[2.2, 0], [1.6, 0.34], [1.0, 0.66]].forEach(([r, dy]) => {
        grp.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, 0.16, 64).translate(0, dy, 0), frost));
        grp.add(new THREE.Mesh(K.ring(r, dy + 0.08, 0.035, { seg: 96 }), MAT.chrome()));
        grp.add(new THREE.Mesh(K.ring(r * 0.96, dy - 0.08, 0.03, { seg: 96 }), MAT.chrome()));
      });
      grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4, 12).translate(0, 2.6, 0), MAT.chrome()));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#fff0d0').multiplyScalar(0.7), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
      halo.scale.set(9, 5, 1); halo.position.y = -0.2; grp.add(halo);
    } else if (kind === 'wheel') {
      const wood = new THREE.MeshPhysicalMaterial({ color: '#4a2e16', roughness: 0.6, clearcoat: 0.3 });
      const parts = [K.ring(2.0, 0, 0.1, { seg: 96, tube: 12 }), new THREE.CylinderGeometry(0.28, 0.28, 0.3, 20)];
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8; parts.push(new THREE.BoxGeometry(1.8, 0.08, 0.1).translate(1.0, 0, 0).rotateY(a)); }
      grp.add(new THREE.Mesh(K.merge(parts), wood));
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; grp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 4.4, 6).translate(Math.cos(a) * 1.1, 2.1, Math.sin(a) * 1.1), MAT.bronze())); }
      for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + TAU / 16; grp.add(candle(Math.cos(a) * 2.0, 0.08, Math.sin(a) * 2.0, 0.42, flames)); }
    }
    grp.position.y = y;
    return grp;
  }
  // A column at each corner of the hall: classical, Egyptian papyrus, a lacquered
  // pillar or a chrome-edged deco fin.
  function papyrusTexture() {
    const c = canvas(256, 1024), g = c.getContext('2d');
    g.drawImage(TEX.stone('#d8b880', '#a88a58', { scale: 4, cloud: 0.3 }).image, 0, 0, 256, 1024);
    const bands = [[0.12, '#1e3a8a'], [0.135, '#c8902a'], [0.15, '#9a2a1e'], [0.165, '#2a6a4a'], [0.18, '#c8902a']];
    for (const [t, col] of bands) { g.fillStyle = col; g.fillRect(0, t * 1024, 256, 12); }
    for (let x = 0; x < 256; x += 32) { g.fillStyle = '#2a6a4a'; g.beginPath(); g.moveTo(x, 110); g.lineTo(x + 16, 0); g.lineTo(x + 32, 110); g.fill(); g.fillStyle = '#1e3a8a'; g.beginPath(); g.moveTo(x + 8, 110); g.lineTo(x + 16, 20); g.lineTo(x + 24, 110); g.fill(); }
    for (let y = 230, k = 0; y < 900; y += 64, k++) glyph(g, k, 64, y, 46, null);
    for (let y = 260, k = 3; y < 900; y += 64, k++) glyph(g, k, 192, y, 46, null);
    g.fillStyle = '#9a2a1e'; g.fillRect(0, 960, 256, 14); g.fillStyle = '#1e3a8a'; g.fillRect(0, 980, 256, 10);
    const t = texFrom(c); t.wrapS = THREE.RepeatWrapping; return t;
  }
  function column(def, h) {
    const c = def.column, grp = new THREE.Group();
    if (c.kind === 'fin') {
      const black = MAT.lacquer('#0e0e10'), chrome = MAT.chrome();
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, h, 0.5).translate(0, h / 2, 0), black));
      grp.add(new THREE.Mesh(K.merge([-0.5, 0.5].map((x) => new THREE.BoxGeometry(0.06, h, 0.56).translate(x, h / 2, 0)).concat([0, 1, 2].map((k) => new THREE.BoxGeometry(1.2 - k * 0.1, 0.12, 0.62 - k * 0.04).translate(0, h - 1.4 - k * 0.3, 0)))), chrome));
      return grp;
    }
    let prof, mat;
    if (c.kind === 'papyrus') {
      prof = K.profile(0, 0).line(0.95, 0).line(0.95, 0.36).line(0.72, 0.42).curve([[0.8, 0.9], [0.74, 2.2], [0.64, h * 0.55], [0.6, h - 3.0]]).line(0.62, h - 2.9).line(0.6, h - 2.7)
        .bez(0.76, h - 2.1, 1.12, h - 1.5, 1.2, h - 1.1).line(0.78, h - 1.04).line(0.78, h - 0.6).line(0, h - 0.6);
      const tex = papyrusTexture(); tex.repeat.set(3, 1 / prof.rings().slice(-1)[0].len);
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    } else if (c.kind === 'pillar') {
      prof = K.profile(0, 0).line(1.0, 0).line(1.0, 0.8).arc(0.8, 1.1, 0.3).line(0.62, 1.12).line(0.62, h - 0.8).line(0.8, h - 0.7).line(0.8, h - 0.4).line(0, h - 0.4);
      mat = MAT.lacquer(c.color || '#9e1c16');
    } else {
      prof = K.profile(0, 0).line(0.95, 0).line(0.95, 0.34).line(0.82, 0.36).arc(0.8, 0.7, 0.35).line(0.7, 0.76)
        .curve([[0.7, 1.6], [0.69, h * 0.42], [0.6, h - 1.9]]).line(0.66, h - 1.82).line(0.62, h - 1.72)
        .bez(0.7, h - 1.4, 0.92, h - 1.1, 0.98, h - 0.86).line(1.02, h - 0.84).line(1.02, h - 0.46).line(0, h - 0.46);
      mat = c.mat === 'porphyry' ? MAT.stone(TEX.stone('#6a1e26', '#b06a6a', { scale: 6, speckScale: 220, speckCut: 0.3 }), { roughness: 0.2 })
        : c.mat === 'malachite' ? MAT.stone(TEX.malachite({ bands: 34 }), { roughness: 0.16 })
        : MAT.stone(TEX.marble(c.color || '#f2eee6', c.vein || '#a8a49c', { size: 512, scale: 2, strength: 0.5 }), { roughness: 0.24 });
    }
    // stone shafts wrap their texture four times round, so the grain is as fine across as it is up
    const around = c.kind === 'classic' || !c.kind ? 4 : 1;
    const body = new THREE.Mesh(K.revolve(prof, { segs: 48, uvAround: around, mod: c.flutes ? K.MOD.flutes(c.flutes, 0.05, 0.9, h - 2.0) : null }), mat);
    body.castShadow = true; grp.add(body);
    const m = metal(def.metal);
    if (c.kind === 'papyrus') grp.add(new THREE.Mesh(K.merge([K.ring(0.61, h - 2.8, 0.05)]), m));
    else if (c.kind === 'pillar') grp.add(new THREE.Mesh(K.merge([K.ring(0.64, 1.3, 0.06), K.ring(0.64, h - 1.0, 0.06), K.ring(0.64, h - 1.3, 0.04)]), m));
    else grp.add(new THREE.Mesh(K.merge([K.ring(0.7, 0.78, 0.04), K.ring(0.64, h - 1.8, 0.05), K.ring(1.0, h - 0.66, 0.05)]), m));
    return grp;
  }

  // ------------------------------------------------------------------ rooms
  // Every room is a twelve-sided hall around the same table. Faces carry windows, a
  // fireplace, shelves of books, paintings, niches with vases, mirrors or screens; the
  // palette, wall finish, columns, windows, light and the view outside set the era.
  const ROOMS = {
    salon: {
      name: 'Grand Cocoa Salon', era: 'A Regency drawing room',
      palette: { wall: '#2a1611', paper: '#3a1c18', paperInk: '#4e2a22', wood: '#3a2014', trim: '#c9a35a', floor: '#6a4228', floorDark: '#24140c', table: '#4a2a18', inlay: '#d8b060',
        rugBorder: '#3a0f14', rugField: '#5e1420', rugGold: '#c79a4a', rugAccent: '#1e2c4a', drape: '#5a1420', sky: ['#060914', '#101a36', '#2a2448', '#3a2a40'], skyline: '#07060c', moon: true,
        paintSky: ['#3a4a6a', '#c88a5a', '#e8c890'], paintLand: '#4a5a3a', fog: '#140b08', hemi: ['#ffe2c0', '#1a0d08'] },
      faces: ['window', 'window', 'window', 'painting', 'books', 'fire', 'books', 'painting', 'books', 'painting', 'books', 'painting'],
      env: { wall: '#3b2219', floor: '#2a1810', ceiling: '#2a1a12', key: '#fff0d8', keyI: 6, window: '#c8d4ff', windowI: 2.2, rim: '#ffd8a8', rimI: 4.5, lamp: '#ffb05a', lampI: 10, fill: 0.55 },
    },
    library: {
      name: 'Midnight Library', era: 'A scholar\'s library at midnight',
      palette: { wall: '#1e1410', paper: '#2a1a12', paperInk: '#3a2418', wood: '#2e1c12', trim: '#b8924a', floor: '#5a3a24', floorDark: '#1e120a', table: '#3a2214', inlay: '#c8a050',
        rugBorder: '#14243a', rugField: '#1c3454', rugGold: '#c8a050', rugAccent: '#5a1a20', drape: '#18284a', sky: ['#03060f', '#0a1430', '#1a2450', '#2a3060'],
        paintSky: ['#2a3a5a', '#6a5a7a', '#b89a8a'], paintLand: '#2a3a2a', fog: '#0e0a08', hemi: ['#c8d4ff', '#120a06'], ceiling: '#140c08' },
      faces: ['window', 'books', 'window', 'books', 'painting', 'fire', 'painting', 'books', 'painting', 'books', 'window', 'books'],
      wall: 'panel', window: { kind: 'pointed', w: 4.4, h: 8.8, drape: true }, light: 'brass', metal: 'brass',
      view: { landmark: 'spires', moon: [1180, 170, 46, true], stars: 320, far: '#0c1024', dark: '#06070e', glow: '#ffc870', lit: '#a8b8e8', water: '#0a1020' },
      env: { wall: '#2a1c14', floor: '#1e140c', ceiling: '#1a120c', key: '#ffe8d0', keyI: 5, window: '#a8b8ff', windowI: 2.6, rim: '#ffd0a0', rimI: 4, lamp: '#ffb05a', lampI: 9, fill: 0.5 },
    },
    marble: {
      name: 'Marble Hall', era: 'A hall of white marble on a summer morning',
      palette: { wall: '#e8e2d6', paper: '#efeae0', paperInk: '#b8b0a0', wood: '#d8d0c0', trim: '#d4a84e', floor: '#f0ece4', floorDark: '#3a3a40', table: '#5a3a22', inlay: '#e0b860',
        rugBorder: '#1e2c5a', rugField: '#efe4cc', rugGold: '#d4a84e', rugAccent: '#7a1e2a', drape: '#e8dcc0', sky: ['#4a7ac8', '#7aa8e0', '#cfe0f0', '#f6e8d0'],
        paintSky: ['#8ab4e8', '#f0d8b0', '#f8ecd0'], paintLand: '#6a8a5a', fog: '#c8c0b4', hemi: ['#fff8ee', '#a89880'], ceiling: '#e8e0d0', dado: '#cfc8bc' },
      faces: ['window', 'window', 'painting', 'niche', 'painting', 'fire', 'painting', 'niche', 'painting', 'niche', 'painting', 'window'],
      wall: 'marble', column: { kind: 'classic', mat: 'marble', flutes: 20, color: '#f6f2ea', vein: '#b8b0a2' }, window: { kind: 'arch', w: 4.6, h: 9.0, drape: true }, frieze: 'eggdart',
      light: 'crystal', metal: 'gold', floor: 'octagon', vase: 'urn-gold', lights: { hemi: 1.1, chand: 10, fire: 0.5 },
      view: { landmark: 'garden', sun: [300, 160, 40, '#fff4d8'], clouds: 9, cloud: '#ffffff', far: '#9ab0c8', dark: '#2e4a2a', lawn: '#6a9a4a', stone: '#f0e8da', water: '#8ab8d8', haze: '#f6e8d0' },
      env: { wall: '#e8e0d4', floor: '#d8d0c4', ceiling: '#efe8dc', key: '#fffaf0', keyI: 7, window: '#e8f0ff', windowI: 4, rim: '#fff0d8', rimI: 4, lamp: '#ffe0a8', lampI: 6, fill: 1.4 },
    },
    harvest: {
      name: 'Harvest Loft', era: 'A farmhouse loft at harvest time',
      palette: { wall: '#c8a878', paper: '#e0c89c', paperInk: '#c8a878', wood: '#5a3a1e', trim: '#b8862e', floor: '#9a6a3a', floorDark: '#3a2410', table: '#6a4422', inlay: '#d8a050',
        rugBorder: '#7a3a14', rugField: '#c8862e', rugGold: '#f0c860', rugAccent: '#5a6a2a', drape: '#a8762a', sky: ['#e89848', '#f6c060', '#ffe0a0', '#fff0c8'],
        paintSky: ['#f0b060', '#f8d898', '#fff0c8'], paintLand: '#8a6a2a', fog: '#5a3a1e', hemi: ['#ffe8c0', '#4a2a10'], ceiling: '#4a2e16' },
      faces: ['window', 'window', 'niche', 'painting', 'books', 'fire', 'books', 'painting', 'niche', 'painting', 'niche', 'window'],
      wall: 'plaster', window: { kind: 'rect', w: 4.0, h: 6.6, drape: true, wood: true }, light: 'wheel', metal: 'bronze', floor: 'planks', vase: 'jug', lights: { hemi: 0.85, chand: 14 },
      view: { landmark: 'fields', sun: [1000, 470, 54, '#ffc860'], clouds: 5, cloud: '#fff0d0', far: '#b89060', dark: '#3a2a14', wheat: '#e8b858', green: '#8a9a3a', barn: '#9a2a1e', haze: '#ffe0a0' },
      env: { wall: '#6a4a2a', floor: '#4a3018', ceiling: '#3a2614', key: '#fff0d0', keyI: 7, window: '#ffd890', windowI: 4, rim: '#ffd8a0', rimI: 5, lamp: '#ffb860', lampI: 9, fill: 0.9 },
    },
    nile: {
      name: 'Temple on the Nile', era: 'A painted temple hall in Thebes, about 1330 BC',
      palette: { wall: '#a88454', paper: '#cfae78', paperInk: '#8a6a3e', wood: '#8a6a3e', trim: '#e8c070', floor: '#c8a87a', floorDark: '#6a4a2a', table: '#5a3a1e', inlay: '#e8c070',
        rugBorder: '#1d2f7a', rugField: '#c89a5a', rugGold: '#f0c860', rugAccent: '#a8402a', drape: '#e8dcc0', sky: ['#2a1a4a', '#7a3a5a', '#e07a4a', '#f8c070'],
        paintSky: ['#e07a4a', '#f8c070', '#f8e0a0'], paintLand: '#a87a4a', fog: '#2a1a10', hemi: ['#ffd8a8', '#3a2010'], ceiling: '#1a2a5a', dado: '#8a6a3e' },
      faces: ['window', 'window', 'niche', 'painting', 'niche', 'fire', 'niche', 'painting', 'niche', 'painting', 'niche', 'window'],
      wall: 'stone', column: { kind: 'papyrus' }, window: { kind: 'portal', w: 4.8, h: 8.4 }, frieze: 'lotus', fire: 'brazier', light: 'bronze', metal: 'gold', floor: 'stone', vase: 'canopic', lights: { hemi: 0.65, chand: 14 },
      view: { landmark: 'pyramids', sun: [1180, 470, 44, '#ffb060'], stars: 40, far: '#a86a4a', stone: '#e8a868', lit: '#ffd8a0', dark: '#2a1810', water: '#4a3a5a', haze: '#f8b070' },
      env: { wall: '#6a4a2a', floor: '#5a3e22', ceiling: '#1a2a5a', key: '#ffe8c8', keyI: 6, window: '#ffc890', windowI: 3.5, rim: '#ffc880', rimI: 5, lamp: '#ffb060', lampI: 9, fill: 0.75 },
    },
    athens: {
      name: 'Stoa of Athens', era: 'A marble colonnade below the Parthenon, 440 BC',
      palette: { wall: '#e2d8c6', paper: '#ece4d4', paperInk: '#b8ac96', wood: '#d8ccb6', trim: '#c8963b', floor: '#dccfb8', floorDark: '#9a8a70', table: '#5a3a22', inlay: '#c8963b',
        rugBorder: '#a8401e', rugField: '#e8dcc4', rugGold: '#1a1a1a', rugAccent: '#a8401e', drape: '#c8963b', sky: ['#141c3a', '#3a3a6a', '#c87a5a', '#f2c890'],
        paintSky: ['#3a3a6a', '#c87a5a', '#f2c890'], paintLand: '#6a6a4a', fog: '#3a3028', hemi: ['#ffe8d0', '#4a3a2a'], ceiling: '#3a2a20', dado: '#cfc4b0' },
      faces: ['window', 'window', 'niche', 'painting', 'niche', 'fire', 'niche', 'painting', 'niche', 'painting', 'niche', 'window'],
      wall: 'marble', column: { kind: 'classic', mat: 'marble', flutes: 20, color: '#f2ece0', vein: '#b8b0a0' }, window: { kind: 'rect', w: 6.0, h: 9.2, bars: 'none' }, frieze: 'meander', fire: 'brazier',
      light: 'bronze', metal: 'bronze', floor: 'stone', vase: 'amphora', lights: { hemi: 0.55, chand: 13 },
      view: { landmark: 'parthenon', v0: 0.4, stars: 120, sun: [1260, 520, 30, '#ffb070'], far: '#5a4a6a', rock: '#5a4a50', stone: '#f2d8b0', shadow: '#3a2a3a', glow: '#ffb860', lit: '#ffe0b0', dark: '#1a1a20', haze: '#f0b880' },
      env: { wall: '#8a7a64', floor: '#6a5e4c', ceiling: '#3a2a20', key: '#fff0dc', keyI: 5.5, window: '#ffd8b0', windowI: 3, rim: '#ffd8a8', rimI: 4.5, lamp: '#ffb860', lampI: 8, fill: 0.65 },
    },
    roma: {
      name: 'Palace of the Caesars', era: 'An imperial hall on the Palatine, AD 113',
      palette: { wall: '#5e1f24', paper: '#d8c8a8', paperInk: '#b8a888', wood: '#3a1416', trim: '#d8b060', floor: '#d8c8a8', floorDark: '#5e1f24', table: '#3a1a12', inlay: '#d8b060',
        rugBorder: '#4c1526', rugField: '#7a1e2e', rugGold: '#d8b060', rugAccent: '#1e3a2a', drape: '#4c1526', sky: ['#1a1430', '#5a2a4a', '#d8703a', '#f8b860'],
        paintSky: ['#5a2a4a', '#d8703a', '#f8b860'], paintLand: '#6a5a3a', fog: '#1e0e0c', hemi: ['#ffd8b0', '#2a100c'], ceiling: '#2a1410', dado: '#5e1f24' },
      faces: ['window', 'window', 'niche', 'painting', 'niche', 'fire', 'niche', 'painting', 'niche', 'painting', 'niche', 'window'],
      wall: 'sectile', column: { kind: 'classic', mat: 'porphyry' }, window: { kind: 'arch', w: 4.8, h: 9.0, drape: true }, frieze: 'meander', fire: 'brazier',
      light: 'bronze', metal: 'gold', floor: 'octagon', vase: 'urn-bronze', lights: { hemi: 0.5, chand: 15 },
      view: { landmark: 'colosseum', sun: [330, 480, 46, '#ffa850'], stars: 30, far: '#7a4a4a', stone: '#e8b070', shadow: '#3a1a14', lit: '#ffd8a0', dark: '#1e1410', haze: '#f8a860' },
      env: { wall: '#5a2a24', floor: '#4a2a20', ceiling: '#2a1410', key: '#ffe8d0', keyI: 6, window: '#ffc890', windowI: 3.2, rim: '#ffc890', rimI: 5, lamp: '#ffb060', lampI: 9, fill: 0.65 },
    },
    mughal: {
      name: 'Hall of Mirrors', era: 'A palace hall at Agra, about 1640',
      palette: { wall: '#efe8dc', paper: '#f2ece2', paperInk: '#cfc6b6', wood: '#e2d8c8', trim: '#d8b060', floor: '#f0ebe2', floorDark: '#9a3f2a', floorLine: 'rgba(216,176,96,0.5)', table: '#4a2a18', inlay: '#e8c06a',
        rugBorder: '#0f3322', rugField: '#7a1e1e', rugGold: '#e8c06a', rugAccent: '#1e4a8a', drape: '#0f3322', sky: ['#020612', '#0a1636', '#1a2e5a', '#2a3e6a'],
        paintSky: ['#1a2e5a', '#4a5a8a', '#c8b0a0'], paintLand: '#2a4a3a', fog: '#14100c', hemi: ['#e0e8ff', '#1a120a'], ceiling: '#2a2016', dado: '#e0d8c8' },
      faces: ['window', 'window', 'mirror', 'niche', 'mirror', 'fire', 'mirror', 'niche', 'mirror', 'niche', 'mirror', 'window'],
      wall: 'pietra', column: { kind: 'classic', mat: 'marble', flutes: 16, color: '#f6f2ea', vein: '#c8c0b0' }, window: { kind: 'pointed', w: 4.6, h: 8.8, drape: true, bars: 'none' }, frieze: 'floral',
      light: 'brass', metal: 'gold', floor: 'octagon', vase: 'ewer', mirror: 'sheesh', lights: { hemi: 0.5, chand: 14 },
      view: { landmark: 'taj', moon: [1130, 190, 40, false], stars: 260, far: '#101a34', stone: '#e8eef8', shadow: '#3a4668', glow: '#ffc870', lit: '#fff0d0', dark: '#060a14', water: '#0a1a34', haze: '#2a3e6a' },
      env: { wall: '#5a5248', floor: '#4a4238', ceiling: '#2a2016', key: '#f4f0ff', keyI: 6, window: '#b8c8ff', windowI: 3, rim: '#ffe0b0', rimI: 5, lamp: '#ffb860', lampI: 10, fill: 0.7 },
    },
    ming: {
      name: 'Forbidden City Study', era: 'A scholar\'s study in Beijing, about 1420',
      palette: { wall: '#7a1410', paper: '#8e1a14', paperInk: '#e8c06a', wood: '#5a0e0a', trim: '#e8b850', floor: '#4a4442', floorDark: '#2a2624', table: '#2a120c', inlay: '#e8b850',
        rugBorder: '#1a2a5a', rugField: '#e8c070', rugGold: '#9e1c16', rugAccent: '#1a2a5a', drape: '#e8b850', sky: ['#1a0e2a', '#4a1a2a', '#c8502a', '#f0a050'],
        paintSky: ['#efe6d2', '#e2d6bc', '#d4c6a8'], paintLand: '#4a4a44', fog: '#1a0a08', hemi: ['#ffd0a0', '#2a0a06'], ceiling: '#1a3a3a', dado: '#1a0a08' },
      faces: ['window', 'window', 'screen', 'niche', 'painting', 'fire', 'painting', 'niche', 'painting', 'niche', 'screen', 'window'],
      wall: 'lacquer', column: { kind: 'pillar', color: '#9e1c16' }, window: { kind: 'moon', w: 5.6, h: 5.6, y: 2.4 }, frieze: 'fret', fire: 'brazier',
      light: 'lantern', metal: 'gold', floor: 'stone', vase: 'porcelain', lights: { hemi: 0.5, chand: 14, color: '#ffb080' },
      view: { landmark: 'pagoda', sun: [1090, 330, 56, '#ffb070'], far: '#6a3a4a', mist: '#e8a080', body: '#6a1a12', roof: '#2a1210', glow: '#ffc060', lit: '#f0c060', dark: '#1a0c0a', haze: '#f0a050' },
      env: { wall: '#5a1410', floor: '#2a2220', ceiling: '#1a3a3a', key: '#ffe8d0', keyI: 6, window: '#ffc890', windowI: 3, rim: '#ffc890', rimI: 5, lamp: '#ff9a4a', lampI: 10, fill: 0.6 },
    },
    venice: {
      name: 'Palazzo on the Canal', era: 'A palazzo on the Grand Canal, about 1700',
      palette: { wall: '#4a1424', paper: '#5a1a2c', paperInk: '#7a3040', wood: '#3a1a14', trim: '#e0c070', floor: '#c8b0a0', floorDark: '#6a4a48', table: '#3a1a14', inlay: '#e0c070',
        rugBorder: '#14347c', rugField: '#7a1a2a', rugGold: '#e0c070', rugAccent: '#1e5a6a', drape: '#14347c', sky: ['#0a1030', '#2a2a5a', '#a85a7a', '#f0a888'],
        paintSky: ['#2a3a6a', '#c88a7a', '#f0c8a0'], paintLand: '#3a5a5a', fog: '#140a0c', hemi: ['#ffe0d0', '#1a0a0c'], ceiling: '#2a1a14' },
      faces: ['window', 'window', 'mirror', 'painting', 'books', 'fire', 'books', 'painting', 'mirror', 'painting', 'mirror', 'window'],
      wall: 'damask', window: { kind: 'pointed', w: 4.4, h: 8.8, drape: true }, light: 'murano', metal: 'gold', floor: 'stone', vase: 'glass', mirror: 'venetian', lights: { hemi: 0.45, chand: 15 },
      view: { landmark: 'venice', stars: 90, moon: [1250, 150, 26, true], far: '#3a3050', stone: '#f0e2d0', brick: '#a85a44', copper: '#6a9a8a', pink: '#e8b8a8', shadow: '#2a1a24', lit: '#ffe0b0', dark: '#0a0a14', water: '#1a2a4a', haze: '#f0a888' },
      env: { wall: '#4a1a24', floor: '#3a2a28', ceiling: '#2a1a14', key: '#fff0e0', keyI: 6, window: '#d8c8ff', windowI: 3, rim: '#ffd8b0', rimI: 5, lamp: '#ffb860', lampI: 10, fill: 0.6 },
    },
    winter: {
      name: 'Winter Palace', era: 'A ballroom in St Petersburg, 1780',
      palette: { wall: '#e8e6e0', paper: '#f0eeea', paperInk: '#c8c4bc', wood: '#e0dcd4', trim: '#e0b85a', floor: '#a87a4a', floorDark: '#3a2414', table: '#3a2414', inlay: '#e8c06a',
        rugBorder: '#13563a', rugField: '#7a1a1e', rugGold: '#e8c06a', rugAccent: '#1e2a5a', drape: '#13563a', sky: ['#040814', '#0e1a34', '#2a3a5a', '#4a5a7a'],
        paintSky: ['#4a5a7a', '#a8b0c0', '#e8e0d0'], paintLand: '#4a5a4a', fog: '#1a1816', hemi: ['#e8f0ff', '#2a2420'], ceiling: '#e0dcd4', dado: '#d8d4cc' },
      faces: ['window', 'window', 'painting', 'niche', 'painting', 'fire', 'painting', 'niche', 'painting', 'niche', 'painting', 'window'],
      wall: 'marble', column: { kind: 'classic', mat: 'malachite' }, window: { kind: 'arch', w: 4.6, h: 9.0, drape: true }, frieze: 'eggdart',
      light: 'crystal', metal: 'gold', floor: 'parquet', vase: 'urn-malachite', lights: { hemi: 0.75, chand: 14 },
      view: { landmark: 'domes', moon: [1200, 160, 34, false], stars: 200, far: '#1a2440', brick: '#8a2a20', trim: '#f0e8dc', snow: '#e8eef8', copper: '#3a7a5a', gold: '#e8c060', glow: '#ffc870', lit: '#ffe8b0', dark: '#0a1410', haze: '#4a5a7a' },
      env: { wall: '#8a8680', floor: '#5a4030', ceiling: '#8a8680', key: '#f4f6ff', keyI: 7, window: '#c8d8ff', windowI: 3.5, rim: '#ffe8c8', rimI: 4, lamp: '#ffc070', lampI: 8, fill: 0.95 },
    },
    deco: {
      name: 'Skyline Penthouse', era: 'A penthouse above Manhattan, 1930',
      palette: { wall: '#0e0e10', paper: '#121214', paperInk: '#d8b860', wood: '#141416', trim: '#dfe3e8', floor: '#efede8', floorDark: '#121214', floorLine: 'rgba(214,220,228,0.55)', table: '#1a1210', inlay: '#dfe3e8',
        rugBorder: '#121214', rugField: '#2a2a30', rugGold: '#d8b860', rugAccent: '#5a6a7a', drape: '#3a3a44', sky: ['#04040c', '#0e0c24', '#2a1a40', '#4a2a50'],
        paintSky: ['#1a1a34', '#5a3a5a', '#d8a080'], paintLand: '#2a2a3a', fog: '#0a0a0c', hemi: ['#e8e8ff', '#0a0a0c'], ceiling: '#121214', dado: '#121214' },
      faces: ['window', 'window', 'window', 'mirror', 'painting', 'fire', 'painting', 'mirror', 'painting', 'mirror', 'window', 'window'],
      wall: 'deco', column: { kind: 'fin' }, window: { kind: 'rect', w: 6.6, h: 10.2, bars: 'grid' }, frieze: 'chevron',
      light: 'deco', metal: 'chrome', floor: 'octagon', vase: 'deco', mirror: 'venetian', fire: 'deco', lights: { hemi: 0.4, chand: 14, color: '#fff0dc' },
      view: { landmark: 'skyline', moon: [300, 140, 22, true], stars: 160, far: '#1a1a34', dark: '#0a0a14', steel: '#c8d0dc', glow: '#ffd890', beam: '#d8e4ff', water: '#0a0a1a', haze: '#4a2a50' },
      env: { wall: '#1a1a1e', floor: '#2a2a2e', ceiling: '#121214', key: '#f4f4ff', keyI: 7, window: '#b8b8ff', windowI: 3, rim: '#e8e8ff', rimI: 5, lamp: '#ffd8a0', lampI: 8, fill: 0.5 },
    },
  };
  // A flat outline as a mesh with 0..1 UVs (or the given ranges).
  function shapePlane(kind, w, h, u0, u1, v0, v1) {
    const g = new THREE.ShapeGeometry(opening(kind, w, h, 0), 40);
    const p = g.attributes.position, uv = g.attributes.uv;
    const U0 = u0 === undefined ? 0 : u0, U1 = u1 === undefined ? 1 : u1, V0 = v0 === undefined ? 0 : v0, V1 = v1 === undefined ? 1 : v1;
    for (let i = 0; i < p.count; i++) uv.setXY(i, U0 + ((p.getX(i) + w / 2) / w) * (U1 - U0), V0 + ((p.getY(i) + h / 2) / h) * (V1 - V0));
    return g;
  }
  // Mirror work (sheesh mahal): small silvered and gilt tiles in rosettes, set in plaster.
  function sheeshTexture() {
    const c = canvas(512, 1024), g = c.getContext('2d');
    g.fillStyle = '#2a241e'; g.fillRect(0, 0, 512, 1024);
    const rosette = (cx, cy, r) => {
      for (let ring = 0; ring < 4; ring++) {
        const rr = r * (0.25 + ring * 0.25), n = 6 + ring * 6;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + ring * 0.2, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
          g.fillStyle = ring % 2 ? '#e8c070' : (i % 5 === 0 ? '#5a8ad0' : '#eef0f4');
          g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, r * 0.09, r * 0.05, 0, 0, TAU); g.fill(); g.restore();
        }
      }
      disc(g, cx, cy, r * 0.12, '#f4f6fa');
    };
    for (let y = 80; y < 1024; y += 170) for (let x = (y / 170) % 2 ? 0 : 128; x <= 512; x += 256) rosette(x, y, 92);
    g.fillStyle = '#eef0f4';
    for (let i = 0; i < 900; i++) { const x = (i * 97) % 512, y = (i * 211) % 1024; g.fillRect(x, y, 3, 3); }
    return texFrom(c);
  }
  function brazier(flames) {
    const grp = new THREE.Group(), br = MAT.bronze();
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; grp.add(new THREE.Mesh(K.tube([[Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9], [Math.cos(a) * 0.5, 1.4, Math.sin(a) * 0.5], [Math.cos(a) * 0.7, 2.4, Math.sin(a) * 0.7]], 0.06, { segs: 20, radial: 8 }), br)); }
    grp.add(new THREE.Mesh(K.revolve(K.profile(0, 2.2).line(0.5, 2.2).curve([[0.9, 2.4], [1.1, 2.7]]).line(1.16, 2.76).line(1.0, 2.76).curve([[0.8, 2.5], [0.3, 2.36]]).line(0, 2.36), { segs: 40 }), br));
    for (let k = 0; k < 6; k++) flame((k % 3 - 1) * 0.3, 2.5, (k < 3 ? -0.15 : 0.15), 0.6 + (k % 3) * 0.2, flames).forEach((m) => grp.add(m));
    return grp;
  }
  function room(id) {
    const def = ROOMS[id] || ROOMS.salon, o = def.palette;
    const grp = new THREE.Group();
    const flames = [], owned = [];
    const own = (t) => { owned.push(t); return t; };
    const FLOOR = -4.6, TOP = -0.46, NF = def.faces.length, RAD = 19, H = 21;
    // floor and rug
    const shiny = def.floor === 'octagon';   // polished marble
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshPhysicalMaterial({ map: own(floorTexture(def)), roughness: shiny ? 0.18 : 0.5, clearcoat: shiny ? 0.9 : 0.5, clearcoatRoughness: shiny ? 0.1 : 0.32 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR; floor.receiveShadow = true; grp.add(floor);
    const rug = new THREE.Mesh(new THREE.CircleGeometry(10.5, 96), new THREE.MeshStandardMaterial({ map: own(rugTexture(o)), roughness: 0.95, transparent: true }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = FLOOR + 0.02; rug.receiveShadow = true; grp.add(rug);
    // the table: a round top with a moulded edge on a turned pedestal
    const tableMat = new THREE.MeshPhysicalMaterial({ map: own(tableTexture(o)), roughness: 0.4, clearcoat: 1, clearcoatRoughness: 0.32 });
    const top = new THREE.Mesh(new THREE.CircleGeometry(7.6, 128), tableMat);
    top.rotation.x = -Math.PI / 2; top.position.y = TOP; top.receiveShadow = true; top.userData.role = 'table';
    grp.add(top);
    const edgeP = K.profile(7.6, TOP).arc(7.72, TOP - 0.1, 0.35).line(7.7, TOP - 0.2).arc(7.55, TOP - 0.42, -0.3).line(6.6, TOP - 0.46);
    const edgeMat = new THREE.MeshPhysicalMaterial({ color: o.table, roughness: 0.42, clearcoat: 1, clearcoatRoughness: 0.32 });
    grp.add(new THREE.Mesh(K.revolve(edgeP, { segs: 128 }), edgeMat));
    grp.add(new THREE.Mesh(K.ring(7.6, TOP - 0.004, 0.025, { seg: 160 }), metal(def.metal)));
    const pedP = K.profile(0, FLOOR).line(2.6, FLOOR).arc(2.5, FLOOR + 0.3, 0.3).curve([[1.6, FLOOR + 0.6], [0.9, FLOOR + 1.2], [0.75, FLOOR + 2.4], [0.95, TOP - 1.2], [2.2, TOP - 0.5]]).line(0, TOP - 0.46);
    grp.add(new THREE.Mesh(K.revolve(pedP, { segs: 64, mod: K.MOD.flutes(16, 0.06, FLOOR + 1.3, TOP - 1.4) }), edgeMat));
    // walls
    const fin = wallFinish(def);
    own(fin.map);
    const wallMats = {
      paper: new THREE.MeshPhysicalMaterial({ map: fin.map, roughness: fin.rough, clearcoat: fin.clear || 0, clearcoatRoughness: 0.2 }),
      wains: new THREE.MeshPhysicalMaterial({ map: own(dadoTexture(def)), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      wood: new THREE.MeshPhysicalMaterial({ color: o.wood, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.2 }),
      gold: metal(def.metal),
      dark: new THREE.MeshStandardMaterial({ color: '#0c0705', roughness: 0.9 }),
    };
    const faceW = 2 * RAD * Math.sin(Math.PI / NF), WAIN = 3.2;
    fin.map.wrapS = fin.map.wrapT = THREE.RepeatWrapping;
    fin.map.repeat.set(faceW / fin.tile[0], (H - WAIN) / fin.tile[1]);
    const pano = def.view ? own(panorama(def)) : null;
    if (pano) pano.wrapS = THREE.RepeatWrapping;
    const wd = def.window;
    const frieze = def.frieze ? own(friezeTexture(def.frieze, o)) : null;
    if (frieze) { frieze.wrapS = THREE.RepeatWrapping; frieze.repeat.set(faceW / 4.9, 1); }
    const friezeY = wd ? Math.max(9.6, (wd.y !== undefined ? wd.y + wd.h / 2 : FLOOR + WAIN + 0.5 + wd.h) + 1.0) : 9.6;
    const colProto = def.column ? column(def, H - 1.0) : null;
    const vaseProto = def.faces.includes('niche') ? vase(def.vase || 'urn-gold', def.metal) : null;
    const nicheKind = def.wall === 'deco' ? 'rect' : wd && wd.kind === 'pointed' ? 'pointed' : 'arch';
    const nicheTex = (() => { const c = canvas(32, 256), g = c.getContext('2d'); g.fillStyle = vgrad(g, 0, 256, [shade(o.paper, -0.72), shade(o.paper, -0.45), shade(o.paper, -0.3)]); g.fillRect(0, 0, 32, 256); return own(texFrom(c)); })();
    const stoneMat = def.wall === 'stone' ? new THREE.MeshStandardMaterial({ map: TEX.stone(o.paper, o.paperInk, { scale: 3 }), roughness: 0.8 }) : wallMats.wood;
    // the moon hangs in the window nearest straight ahead
    let moonAt = -1;
    def.faces.forEach((f, k) => { if (f === 'window' && (moonAt < 0 || Math.min(k, NF - k) < Math.min(moonAt, NF - moonAt))) moonAt = k; });
    for (let i = 0; i < NF; i++) {
      const a = (i / NF) * TAU, kind = def.faces[i];
      const face = new THREE.Group();
      // white's camera is at +z; face 0 sits straight ahead (-z) and the rest go round
      face.rotation.y = -a;
      const at = (m, x, y, z) => { m.position.set(x, y, z - RAD * Math.cos(Math.PI / NF)); face.add(m); return m; };
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(faceW, H - WAIN), wallMats.paper); at(paper, 0, FLOOR + WAIN + (H - WAIN) / 2, 0);
      const wains = new THREE.Mesh(new THREE.PlaneGeometry(faceW, WAIN), wallMats.wains); at(wains, 0, FLOOR + WAIN / 2, 0.02);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(faceW, 0.16, 0.16), wallMats.wood); at(rail, 0, FLOOR + WAIN, 0.08);
      const railG = new THREE.Mesh(new THREE.BoxGeometry(faceW, 0.03, 0.03), wallMats.gold); at(railG, 0, FLOOR + WAIN + 0.1, 0.17);
      if (colProto) at(colProto.clone(), faceW / 2, FLOOR, 1.0);
      else {
        const pil = new THREE.Mesh(new THREE.BoxGeometry(0.7, H, 0.3), wallMats.wood); at(pil, faceW / 2, FLOOR + H / 2, 0.15);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.42), wallMats.gold); at(cap, faceW / 2, FLOOR + H - 1.2, 0.2);
      }
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(faceW + 0.4, 0.6, 0.6), wallMats.wood); at(cornice, 0, FLOOR + H - 0.6, 0.3);
      if (frieze) { const fz = new THREE.Mesh(new THREE.PlaneGeometry(faceW, 0.9), new THREE.MeshStandardMaterial({ map: frieze, roughness: 0.5, metalness: 0.1 })); at(fz, 0, friezeY, 0.04); }
      if (kind === 'window' && !def.view) {
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 7.4), new THREE.MeshBasicMaterial({ map: own(skyTexture(o, i, i === moonAt)), toneMapped: true }));
        at(sky, 0, FLOOR + WAIN + 4.4, 0.05);
        const frameM = new THREE.Mesh(K.merge([
          ...[-1.85, 0, 1.85].map((x) => { const b = new THREE.BoxGeometry(0.12, 7.6, 0.16); b.translate(x, 0, 0); return b; }),
          ...[-3.75, -1.2, 1.4, 3.75].map((y) => { const b = new THREE.BoxGeometry(3.8, 0.12, 0.16); b.translate(0, y, 0); return b; })]), wallMats.gold);
        at(frameM, 0, FLOOR + WAIN + 4.4, 0.12);
        for (const s of [-1, 1]) { const d = drape(1.6, 9.2, o.drape); at(d, s * 2.55, FLOOR + WAIN + 4.2, 0.4); }
        const pel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.7, 0.5), wallMats.wood); at(pel, 0, FLOOR + WAIN + 8.9, 0.3);
      } else if (kind === 'window') {
        // this window's slice of the view: straight ahead shows the middle of the painting
        const rel = a > Math.PI ? a - TAU : a, uc = 0.5 + rel / 2.6;
        const wk = wd.kind, w = wd.w, h = wd.h, yc = wd.y !== undefined ? wd.y : FLOOR + WAIN + 0.5 + h / 2;
        // the bottom of a tall window sits a little under the horizon, so the seated view
        // (which sees only the lower part of the far windows) still meets the landmark
        const v0 = wk === 'moon' ? 0.3 : def.view.v0 || 0.36, v1 = wk === 'moon' ? 0.86 : 1;
        const sw = (v1 - v0) * (w / h) * (VH / VW);
        const sky = new THREE.Mesh(shapePlane(wk, w, h, uc - sw / 2, uc + sw / 2, v0, v1), new THREE.MeshBasicMaterial({ map: pano, toneMapped: true }));
        at(sky, 0, yc, 0.05);
        const frameMat = wd.wood ? wallMats.wood : wk === 'portal' ? stoneMat : wallMats.gold;
        at(new THREE.Mesh(ringGeometry(wk, w, h, wk === 'portal' ? 0.55 : 0.24, 0.2), frameMat), 0, yc, 0.12);
        if (wd.bars !== 'none' && wk !== 'portal') at(new THREE.Mesh(glazing(wk, w, h, wd.bars), frameMat), 0, yc, 0.1);
        if (wd.drape) for (const s of [-1, 1]) at(drape(1.6, h + 1.4, o.drape), s * (w / 2 + 0.75), yc + 0.3, 0.4);
        if (wk === 'rect' && wd.drape) at(new THREE.Mesh(new THREE.BoxGeometry(w + 2.6, 0.7, 0.5), wallMats.wood), 0, yc + h / 2 + 0.9, 0.3);
        if (wk === 'portal') {
          const ty = yc + h / 2;
          at(new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 1.0, 0.5), stoneMat), 0, ty + 0.5, 0.3);
          at(new THREE.Mesh(new THREE.BoxGeometry(w + 2.2, 0.36, 0.9), stoneMat), 0, ty + 1.18, 0.4);
          at(new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.1, 40).rotateX(Math.PI / 2), MAT.gold()), 0, ty + 0.5, 0.6);
          for (const s of [-1, 1]) {
            const wing = new THREE.Mesh(K.extrude([[0, 0.16], [1.9 * s, 0.26], [2.1 * s, 0.06], [1.8 * s, -0.14], [0, -0.12]].map(([x, y]) => [x, y]), 0.06, 0.02), MAT.gold());
            at(wing, s * 0.3, ty + 0.5, 0.58);
          }
        }
      } else if (kind === 'books') {
        const shelfW = faceW - 1.2;
        const caseM = new THREE.Mesh(new THREE.BoxGeometry(shelfW + 0.4, 9.6, 0.9), wallMats.wood); at(caseM, 0, FLOOR + 4.8, 0.3);
        for (let k = 0; k < 5; k++) {
          const books = new THREE.Mesh(new THREE.PlaneGeometry(shelfW, 1.55), new THREE.MeshStandardMaterial({ map: own(booksTexture(i * 7 + k)), roughness: 0.7 }));
          at(books, 0, FLOOR + 1.0 + k * 1.82, 0.78);
          const shelf = new THREE.Mesh(new THREE.BoxGeometry(shelfW, 0.1, 0.5), wallMats.wood); at(shelf, 0, FLOOR + 0.18 + k * 1.82, 0.9);
        }
      } else if (kind === 'fire' && def.fire === 'brazier') {
        at(brazier(flames), 0, FLOOR, 2.6);
        const fireLight = new THREE.PointLight('#ff8a3a', 9, 9, 2); at(fireLight, 0, FLOOR + 3.2, 2.6);
        grp.userData.fire = fireLight;
      } else if (kind === 'fire') {
        const deco = def.fire === 'deco';
        const surround = new THREE.Mesh(new THREE.BoxGeometry(4.6, 3.6, 0.9), deco ? MAT.lacquer('#0e0e10') : MAT.stone(TEX.marble('#e8e0d0', '#9a8a78', { size: 512 }), { roughness: 0.25 })); at(surround, 0, FLOOR + 1.8, 0.45);
        const box = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), wallMats.dark); at(box, 0, FLOOR + 1.1, 0.91);
        const mantel = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 1.3), deco ? MAT.chrome() : wallMats.wood); at(mantel, 0, FLOOR + 3.65, 0.6);
        const fireLight = new THREE.PointLight('#ff8a3a', 9, 9, 2); at(fireLight, 0, FLOOR + 1.2, 2.2);
        grp.userData.fire = fireLight;
        for (let k = 0; k < 6; k++) { const f = flame(0, 0, 0, 0.7 + (k % 3) * 0.25, flames); f.forEach((m) => { at(m, (k - 2.5) * 0.32, FLOOR + 0.35 + m.position.y, 1.0); }); }
        const mirror = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 4.2), new THREE.MeshPhysicalMaterial({ color: '#1a1410', metalness: 1, roughness: 0.08 })); at(mirror, 0, FLOOR + 6.4, 0.06);
        const mf = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.12, 8, 48), wallMats.gold); mf.scale.set(0.85, 1.12, 1); at(mf, 0, FLOOR + 6.4, 0.1);
        for (const s of [-1, 1]) at(candelabrum(0, 0, 0, flames, wallMats.gold), s * 2.0, FLOOR + 3.78, 0.6).scale.setScalar(0.8);
      } else if (kind === 'painting') {
        const art = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.7), new THREE.MeshStandardMaterial({ map: own(paintingTexture(i * 13 + 1, o)), roughness: 0.55 })); at(art, 0, FLOOR + WAIN + 4.2, 0.12);
        const shape = W_frame(4.2, 3.3, 0.32);
        const fr = new THREE.Mesh(shape, wallMats.gold); at(fr, 0, FLOOR + WAIN + 4.2, 0.14);
        const sconce = (s) => { const c = candle(0, 0, 0, 0.5, flames); at(c, s * 2.9, FLOOR + WAIN + 2.2, 0.5); };
        sconce(-1); sconce(1);
      } else if (kind === 'niche') {
        const nw = 2.8, nh = 5.6, ny = FLOOR + WAIN + 0.4 + nh / 2;
        at(new THREE.Mesh(shapePlane(nicheKind, nw, nh), new THREE.MeshStandardMaterial({ map: nicheTex, roughness: 0.9 })), 0, ny, 0.06);
        at(new THREE.Mesh(ringGeometry(nicheKind, nw, nh, 0.24, 0.26), wallMats.gold), 0, ny, 0.14);
        at(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.4, 1.1), def.wall === 'deco' ? MAT.chrome() : wallMats.wood), 0, ny - nh / 2 + 0.2, 0.55);
        const v = vaseProto.clone(); v.scale.setScalar(1.35); at(v, 0, ny - nh / 2 + 0.4, 0.6);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: new THREE.Color('#ffc890').multiplyScalar(0.28), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
        halo.scale.set(4.5, 5.5, 1); at(halo, 0, ny + 0.4, 0.3);
      } else if (kind === 'mirror') {
        const sheesh = def.mirror === 'sheesh', mk = sheesh ? 'pointed' : def.wall === 'deco' ? 'rect' : 'arch';
        const mw = sheesh ? 4.2 : 3.4, mh = sheesh ? 8.4 : 7.0, my = FLOOR + WAIN + 0.6 + mh / 2;
        const mat = sheesh ? new THREE.MeshPhysicalMaterial({ map: own(sheeshTexture()), metalness: 1, roughness: 0.16, envMapIntensity: 1.8 })
          : new THREE.MeshPhysicalMaterial({ color: '#d8dce4', metalness: 1, roughness: 0.04, envMapIntensity: 1.3 });
        at(new THREE.Mesh(shapePlane(mk, mw, mh), mat), 0, my, 0.08);
        at(new THREE.Mesh(ringGeometry(mk, mw, mh, 0.3, 0.22), wallMats.gold), 0, my, 0.14);
        if (!sheesh) for (const s of [-1, 1]) at(candle(0, 0, 0, 0.5, flames), s * (mw / 2 + 0.7), my - 1.2, 0.5);
      } else if (kind === 'screen') {
        const pw = 1.6, ph = 4.6, ink = own(paintingTexture(i * 5 + 3, o));
        for (let k = 0; k < 4; k++) {
          const panel = new THREE.Group();
          panel.add(new THREE.Mesh(new THREE.BoxGeometry(pw, ph, 0.12), MAT.lacquer('#2a0806')));
          const pg = new THREE.PlaneGeometry(pw - 0.26, ph - 0.6), uv = pg.attributes.uv;
          for (let q = 0; q < uv.count; q++) uv.setX(q, (k + uv.getX(q)) / 4);
          const art = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ map: ink, roughness: 0.7 })); art.position.z = 0.065; panel.add(art);
          panel.add(new THREE.Mesh(K.merge([new THREE.BoxGeometry(pw, 0.06, 0.14).translate(0, ph / 2 - 0.2, 0), new THREE.BoxGeometry(pw, 0.06, 0.14).translate(0, -ph / 2 + 0.2, 0)]), MAT.gold()));
          panel.rotation.y = (k % 2 ? 1 : -1) * 0.32;
          at(panel, (k - 1.5) * pw * 0.95, FLOOR + ph / 2 + 0.1, 2.2 + (k % 2 ? 0.25 : -0.25));
        }
      }
      grp.add(face);
    }
    // ceiling
    const ceil = new THREE.Mesh(new THREE.CircleGeometry(RAD + 1, 64), new THREE.MeshStandardMaterial({ color: o.ceiling || '#1a0f0a', roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = FLOOR + H; grp.add(ceil);
    // the light over the table and two candelabra on it
    const ch = fixture(def, 7.8, flames); grp.add(ch);
    grp.add(candelabrum(-5.9, TOP, -4.6, flames, wallMats.gold));
    grp.add(candelabrum(5.9, TOP, -4.6, flames, wallMats.gold));
    grp.traverse((m) => { if (m.isMesh && !m.material.transparent) { m.receiveShadow = true; } });
    return {
      group: grp, def, flames, floorY: FLOOR, tableY: TOP, chandelier: ch, chandelierY: 7.8,
      fog: o.fog, hemi: o.hemi, env: def.env, lights: Object.assign({ hemi: 0.35, chand: 14, color: '#ffc480', fire: 1 }, def.lights || {}),
      chandelierLight: new THREE.Vector3(0, 7.2, 0),
      update(t) {
        for (const f of flames) {
          const k = 0.86 + 0.14 * Math.sin(t * 9 + f.seed) * Math.sin(t * 5.3 + f.seed * 2);
          f.m.scale.set(f.s * 0.5 * (0.95 + 0.1 * Math.sin(t * 13 + f.seed)), f.s * k, 1);
          f.halo.material.opacity = 0.75 + 0.25 * k;
        }
        if (grp.userData.fire) grp.userData.fire.intensity = (8 + 2.5 * Math.sin(t * 7) * Math.sin(t * 3.1 + 1)) * (def.lights && def.lights.fire !== undefined ? def.lights.fire : 1);
      },
      // frees what this room made for itself (shared materials and textures stay)
      dispose() {
        owned.forEach((t) => t.dispose());
        grp.traverse((m) => { if (m.geometry) m.geometry.dispose(); });
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
