// Chackmate suites: every place comes with one board and one chess set made for it, and its own
// table. A suite is the three together (1:1:1): the room, the board in the room's stone, wood or
// lacquer, and the set carved for the same time and place. Wherever a place, a board or a set is
// shown (the table, the Collection, the era intro, the website) the other two come with it.
//
// Each table has its own outline (round, octagon, hexagon, square, lotus, quatrefoil, a rough
// slab), its own top (wood, marble, lacquer, stone, glass) and foot, and a few things laid out
// around the board: fruit, a crown on a cushion, a toy car, a teapot, shells, a lantern. They sit
// in four places that are always clear of the board and the pieces, and stay low on White's side
// so they never hide a square.
function ChacklateSuites(THREE, K, H) {
  'use strict';
  const { TAU, MAT, TEX, rng } = K;
  const { canvas, texFrom, shade, rgba, candle, candelabrum, slab, metal } = H;

  // ------------------------------------------------------------------ the suites
  // room id -> { board, set, table, decor }. table: shape, R (outer radius), top (paint), edge,
  // foot, metal; decor: up to four props for the slots far-left, far-right, near-left, near-right.
  const SUITES = {
    salon: { board: 'walnut', set: 'regency', table: { shape: 'round', top: { kind: 'wood', color: '#4a2a18' }, foot: 'pedestal', metal: 'gold' }, decor: ['candelabra', 'bonbons', 'roses', 'urn'] },
    library: { board: 'tournament', set: 'staunton', table: { shape: 'square', top: { kind: 'leather', color: '#1e3a2a', wood: '#3a2214' }, foot: 'legs', metal: 'brass' }, decor: ['lamp', 'inkwell', 'globe', 'books'] },
    marble: { board: 'marble', set: 'marble', table: { shape: 'octagon', top: { kind: 'marble', color: '#2c2c32', vein: '#a8a49c' }, foot: 'column', metal: 'gold' }, decor: ['hourglass', 'grapes', 'bust', 'urn'] },
    harvest: { board: 'harvest', set: 'caramel-cream', table: { shape: 'round', top: { kind: 'planks', color: '#7a5028' }, foot: 'trestle', metal: 'bronze' }, decor: ['pie', 'apples', 'pumpkins', 'wheat'] },
    nile: { board: 'nile', set: 'pharaoh', table: { shape: 'square', top: { kind: 'stone', color: '#c8a46e', inlay: '#1d2f7a' }, foot: 'lion', metal: 'gold' }, decor: ['ankh', 'dates', 'canopic', 'scarab'] },
    athens: { board: 'athens', set: 'olympian', table: { shape: 'round', top: { kind: 'marble', color: '#e8dcc6', vein: '#b0a48c' }, foot: 'column', metal: 'bronze' }, decor: ['scroll', 'olives', 'amphora', 'owl'] },
    roma: { board: 'roma', set: 'imperial', table: { shape: 'octagon', top: { kind: 'stone', color: '#5a1a22', speck: '#b0706a' }, foot: 'lion', metal: 'gold' }, decor: ['coins', 'grapes', 'helmet', 'laurel'] },
    mughal: { board: 'mughal', set: 'maharaja', table: { shape: 'lotus', top: { kind: 'marble', color: '#f4f0e8', vein: '#c8c0b0', inlay: '#2a6a4a' }, foot: 'pedestal', metal: 'gold' }, decor: ['diya', 'pomegranates', 'rosewater', 'jewelbox'] },
    ming: { board: 'ming', set: 'dynasty', table: { shape: 'square', top: { kind: 'lacquer', color: '#7a140e' }, foot: 'ming', metal: 'gold' }, decor: ['teapot', 'peaches', 'vase', 'lantern'] },
    venice: { board: 'venice', set: 'murano', table: { shape: 'quatrefoil', top: { kind: 'marble', color: '#3a1424', vein: '#a86a7a' }, foot: 'pedestal', metal: 'gold' }, decor: ['goblet', 'mask', 'candelabra', 'gondola'] },
    paris: { board: 'belle', set: 'ruby-pearl', table: { shape: 'round', top: { kind: 'marble', color: '#ece6dc', vein: '#b8b0a4' }, foot: 'bistro', metal: 'gold' }, decor: ['perfume', 'croissants', 'macarons', 'roses'] },
    winter: { board: 'winter', set: 'tsarina', table: { shape: 'octagon', top: { kind: 'malachite' }, foot: 'pedestal', metal: 'gold' }, decor: ['candelabra', 'cakes', 'samovar', 'egg'] },
    deco: { board: 'deco', set: 'manhattan', table: { shape: 'hex', top: { kind: 'lacquer', color: '#121214' }, foot: 'deco', metal: 'chrome' }, decor: ['radio', 'skyscraper', 'car', 'car2'] },
    tokyo: { board: 'sakura', set: 'robots', table: { shape: 'square', top: { kind: 'lacquer', color: '#1a1416', inlay: '#f2b8c6' }, foot: 'low', metal: 'chrome' }, decor: ['teapot', 'robot', 'bonsai', 'blossom'] },
    brussels: { board: 'cocoa', set: 'cocoa-gilt', table: { shape: 'round', top: { kind: 'wood', color: '#5a3018' }, foot: 'pedestal', metal: 'gold' }, decor: ['chocpot', 'truffles', 'chocbox', 'waffles'] },
    reef: { board: 'pearl', set: 'ocean', table: { shape: 'scallop', top: { kind: 'nacre', color: '#e8eef0' }, foot: 'coral', metal: 'gold' }, decor: ['starfish', 'shells', 'clam', 'chest'] },
    amber: { board: 'jaipur', set: 'army', table: { shape: 'octagon', top: { kind: 'stone', color: '#d8a878', speck: '#a8603c', inlay: '#f0c98c' }, foot: 'drum', metal: 'brass' }, decor: ['marigolds', 'drum', 'elephant', 'brasspot'] },
    mysore: { board: 'rosewood', set: 'peacock', table: { shape: 'lotus', top: { kind: 'wood', color: '#4a1a12', inlay: '#e8b85a' }, foot: 'pedestal', metal: 'gold' }, decor: ['diya', 'mangoes', 'feathers', 'jewelbox'] },
    greatwall: { board: 'emerald', set: 'jade-onyx', table: { shape: 'square', top: { kind: 'stone', color: '#8a8478', speck: '#5a564e' }, foot: 'ming', metal: 'bronze' }, decor: ['teapot', 'peaches', 'lantern', 'kite'] },
    swiss: { board: 'cacao', set: 'milk-dark', table: { shape: 'round', top: { kind: 'planks', color: '#8a5a30' }, foot: 'trestle', metal: 'brass' }, decor: ['cocoa', 'cheese', 'cuckoo', 'cowbell'] },
    dubai: { board: 'regency', set: 'gold-silver', table: { shape: 'hex', top: { kind: 'marble', color: '#1a1a1e', vein: '#c8a860' }, foot: 'deco', metal: 'gold' }, decor: ['dallah', 'dates', 'falcon', 'lantern2'] },
    crystal: { board: 'obsidian', set: 'crystal', table: { shape: 'round', top: { kind: 'glass', color: '#c8d8e4' }, foot: 'iron', metal: 'silver' }, decor: ['cloche', 'fern', 'train', 'telescope'] },
    aurora: { board: 'lapis', set: 'celestial', table: { shape: 'round', top: { kind: 'stone', color: '#3a4250', speck: '#8a96aa' }, foot: 'drum', metal: 'silver' }, decor: ['lantern3', 'snowglobe', 'telescope', 'astrolabe'] },
    castle: { board: 'ruby', set: 'ruby-chocolate', table: { shape: 'quatrefoil', top: { kind: 'wood', color: '#3a1a14', inlay: '#e8b85a' }, foot: 'legs', metal: 'gold' }, decor: ['goblet', 'cakes', 'crown', 'swan'] },
    stonehenge: { board: 'sarsen', set: 'sarsen', table: { shape: 'slab', top: { kind: 'raw', color: '#a8a290', speck: '#5e5a4c' }, foot: 'stones', raw: true }, decor: ['flint', 'berries', 'clay', 'antler'] },
    indus: { board: 'terracotta', set: 'harappa', table: { shape: 'slab', top: { kind: 'brick', color: '#b0703e' }, foot: 'bricks', raw: true }, decor: ['seal', 'jar', 'cart', 'clay'] },
    inca: { board: 'andesite', set: 'inca', table: { shape: 'polygon', top: { kind: 'raw', color: '#8e8a80', speck: '#4e4a44' }, foot: 'stones', raw: true }, decor: ['corn', 'jar', 'llama', 'basket'] },
    norse: { board: 'runewood', set: 'norse', table: { shape: 'slab', top: { kind: 'planks', color: '#5a3a20' }, foot: 'trestle', metal: 'bronze', raw: true }, decor: ['norsehelm', 'nuts', 'candles', 'horn'] },
    sounion: { board: 'agora', set: 'sounion', table: { shape: 'round', top: { kind: 'marble', color: '#ece6da', vein: '#b8ae9c' }, foot: 'column', metal: 'bronze' }, decor: ['lyre', 'figs', 'amphora', 'trident'] },
    saturn: { board: 'meteor', set: 'astro', table: { shape: 'round', top: { kind: 'marble', color: '#1a1e2e', vein: '#6ac8e8' }, foot: 'drum', metal: 'chrome' }, decor: ['rocket', 'moonrock', 'satellite', 'starjar'] },
    twinrealms: { board: 'moonslate', set: 'elves', table: { shape: 'slab', top: { kind: 'planks', color: '#4a3424' }, foot: 'trestle', metal: 'gold', raw: true }, decor: ['elflamp', 'berries', 'orchelm', 'antler'] },
    skyisles: { board: 'sunbrick', set: 'sunshadow', table: { shape: 'quatrefoil', top: { kind: 'stone', color: '#efe2c6', speck: '#c8b088', inlay: '#2a4ab8' }, foot: 'pedestal', metal: 'gold' }, decor: ['balloon', 'cakes', 'shadoworb', 'crown'] },
    starbridge: { board: 'stargrid', set: 'galactic', table: { shape: 'hex', top: { kind: 'glass', color: '#1a2438' }, foot: 'deco', metal: 'chrome' }, decor: ['hologlobe', 'satellite', 'modelship', 'starjar'] },
    burj: { board: 'mirage', set: 'falcon', table: { shape: 'hex', top: { kind: 'marble', color: '#efe8dc', vein: '#c8a860' }, foot: 'column', metal: 'gold' }, decor: ['oyster', 'binocs', 'burner', 'teaglass'] },
    observatory: { board: 'starglass', set: 'astral', table: { shape: 'round', top: { kind: 'glass', color: '#3a3e66' }, foot: 'drum', metal: 'gold' }, decor: ['orrery', 'crystalorb', 'starchart', 'moonlamp'] },
    rift: { board: 'lavaice', set: 'elemental', table: { shape: 'hex', top: { kind: 'stone', color: '#2a2224', speck: '#c8501a' }, foot: 'drum', metal: 'silver' }, decor: ['icecluster', 'lavastone', 'flamebowl', 'frostgoblet'] },
    clocktower: { board: 'gearwood', set: 'clockwork', table: { shape: 'octagon', top: { kind: 'wood', color: '#5a3018', inlay: '#c8964a' }, foot: 'iron', metal: 'brass' }, decor: ['pocketwatch', 'gearstack', 'oilcan', 'goggles'] },
    neonroof: { board: 'neongrid', set: 'neon', table: { shape: 'square', top: { kind: 'lacquer', color: '#120e18', inlay: '#3ae0ff' }, foot: 'deco', metal: 'chrome' }, decor: ['holocube', 'noodles', 'headphones', 'drone'] },
    citadel: { board: 'voidmarble', set: 'lumen', table: { shape: 'quatrefoil', top: { kind: 'marble', color: '#f2eee6', vein: '#8a7ab8' }, foot: 'column', metal: 'gold' }, decor: ['prism', 'sunorb', 'voidshard', 'chalice'] },
    dinoval: { board: 'fossil', set: 'dino', table: { shape: 'slab', top: { kind: 'raw', color: '#6a5a4a', speck: '#3a2e26' }, foot: 'stones', raw: true }, decor: ['nest', 'fern', 'ammonite', 'amberlamp'] },
    forest: { board: 'glade', set: 'forest', table: { shape: 'round', top: { kind: 'wood', color: '#4a3220' }, foot: 'pedestal', metal: 'gold' }, decor: ['mushrooms', 'berries', 'fairylamp', 'acorns'] },
    fjord: { board: 'fjord', set: 'jarl', table: { shape: 'octagon', top: { kind: 'stone', color: '#4a4e58', speck: '#2a2e36' }, foot: 'drum', metal: 'gold' }, decor: ['longship', 'horn', 'runestone', 'shieldprop'] },
    longhouse: { board: 'runeoak', set: 'rune', table: { shape: 'slab', top: { kind: 'planks', color: '#6a4a2a' }, foot: 'trestle', metal: 'bronze', raw: true }, decor: ['dragonhead', 'bread', 'candles', 'nuts'] },
    // five more, from the user's pictures
    studio: { board: 'nero', set: 'fantasy', table: { shape: 'octagon', top: { kind: 'marble', color: '#18181c', vein: '#c8a050' }, foot: 'column', metal: 'gold' }, decor: ['statuette', 'claymodel', 'mallet', 'lemons'] },
    keep: { board: 'sapphire', set: 'sapphire', table: { shape: 'quatrefoil', top: { kind: 'marble', color: '#f0e8d8', vein: '#c8b898', inlay: '#1e3488' }, foot: 'pedestal', metal: 'gold' }, decor: ['globus', 'casket', 'sceptre', 'plums'] },
    admiral: { board: 'admiralty', set: 'navy', table: { shape: 'round', top: { kind: 'wood', color: '#3a1a10', inlay: '#e2b860' }, foot: 'legs', metal: 'brass' }, decor: ['shipbottle', 'sextant', 'spyglass', 'compass'] },
    emeraldhall: { board: 'verdant', set: 'opulent', table: { shape: 'hex', top: { kind: 'malachite', color: '#13563a' }, foot: 'pedestal', metal: 'gold' }, decor: ['armillary', 'brassscope', 'ivypot', 'starbook'] },
    pavilion: { board: 'scroll', set: 'pagoda', table: { shape: 'round', top: { kind: 'lacquer', color: '#141012' }, foot: 'ming', metal: 'gold' }, decor: ['stonelantern', 'incense', 'fan', 'koibowl'] },
  };
  const byBoard = {}, bySet = {};
  for (const [room, s] of Object.entries(SUITES)) { byBoard[s.board] = room; bySet[s.set] = room; }

  // ------------------------------------------------------------------ table outlines
  // A closed outline (THREE.Shape) of outer radius R. Every outline covers the board (a 10.1
  // square) and the four prop places.
  function outline(kind, R, seed) {
    const s = new THREE.Shape();
    const poly = (pts) => { pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath(); return s; };
    if (kind === 'octagon' || kind === 'hex') {
      const n = kind === 'hex' ? 6 : 8, r = R, cut = 0.16;
      // corners softened with a short chamfer
      const pts = [];
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.PI / n * (kind === 'hex' ? 1 : 1), b = ((i + 1) / n) * TAU + Math.PI / n;
        const ax = Math.cos(a) * r, ay = Math.sin(a) * r, bx = Math.cos(b) * r, by = Math.sin(b) * r;
        pts.push([ax + (bx - ax) * cut, ay + (by - ay) * cut], [bx + (ax - bx) * cut, by + (ay - by) * cut]);
      }
      return poly(pts);
    }
    if (kind === 'square') {
      const h = R * 0.86, r = 0.9;
      s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
      s.lineTo(h, h - r); s.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
      s.lineTo(-h + r, h); s.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
      s.lineTo(-h, -h + r); s.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
      return s;
    }
    if (kind === 'lotus' || kind === 'scallop' || kind === 'quatrefoil') {
      // petals: a round edge that swells into n lobes
      const n = kind === 'lotus' ? 12 : kind === 'scallop' ? 18 : 4, depth = kind === 'quatrefoil' ? 0.09 : kind === 'lotus' ? 0.045 : 0.03, N = 360, pts = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * TAU, w = Math.abs(Math.cos((a * n) / 2 + (kind === 'quatrefoil' ? Math.PI / 2 : 0)));
        const r = R * (1 - depth + depth * Math.pow(w, kind === 'lotus' ? 0.6 : 0.35));
        pts.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      return poly(pts);
    }
    if (kind === 'slab' || kind === 'polygon') {
      // a rough-hewn slab: a squarish outline (or the Inca's many-sided block) with chipped edges
      const R2 = rng(seed || 3), pts = [];
      const corners = kind === 'polygon' ? [[-6.9, -5.6], [-4.8, -7.0], [2.4, -7.2], [6.6, -6.2], [7.1, -1.8], [6.8, 5.4], [4.6, 7.1], [-3.2, 7.0], [-6.8, 6.0], [-7.2, 1.2]]
        : [[-7.0, -6.6], [6.9, -6.9], [7.2, 6.5], [-6.8, 6.9]];
      for (let i = 0; i < corners.length; i++) {
        const [ax, ay] = corners[i], [bx, by] = corners[(i + 1) % corners.length], steps = 9;
        for (let k = 0; k < steps; k++) {
          const t = k / steps, nx = -(by - ay), ny = bx - ax, L = Math.hypot(nx, ny), j = (R2() - 0.5) * 0.28 * (k ? 1 : 0.4);
          pts.push([ax + (bx - ax) * t + (nx / L) * j, ay + (by - ay) * t + (ny / L) * j]);
        }
      }
      return poly(pts);
    }
    s.absarc(0, 0, R, 0, TAU, false);
    return s;
  }
  // The outline's points, for the inlay line and the gold edge.
  const points = (shape, n) => shape.getSpacedPoints(n || 240).map((p) => [p.x, p.y]);

  // ------------------------------------------------------------------ table tops
  // The top's paint, as a canvas in the outline's units (-R..R across).
  function topCanvas(t, shape, R) {
    const N = 2048, c = canvas(N), g = c.getContext('2d'), px = (u) => ((u + R) / (2 * R)) * N, top = t.top, col = top.color || '#4a2a18';
    if (top.kind === 'wood' || top.kind === 'leather') {
      g.drawImage(TEX.wood(shade(top.wood || col, 0.14), shade(top.wood || col, -0.45), { lines: 84, w: 1024, h: 1024, seed: 8, contrast: 0.6, figure: 0.18, warp: 2.4 }).image, 0, 0, N, N);
    } else if (top.kind === 'planks') {
      const img = TEX.wood(shade(col, 0.12), shade(col, -0.5), { lines: 40, w: 1024, h: 1024, seed: 5, contrast: 0.55, figure: 0.25 }).image;
      for (let i = 0; i < 7; i++) { g.drawImage(img, 0, i * 150, 1024, 150, i * (N / 7), 0, N / 7, N); }
      g.fillStyle = 'rgba(20,10,4,0.55)'; for (let i = 1; i < 7; i++) g.fillRect(i * (N / 7) - 3, 0, 6, N);
      g.fillStyle = 'rgba(30,20,10,0.6)'; for (let i = 0; i < 7; i++) for (const y of [N * 0.12, N * 0.88]) { g.beginPath(); g.arc(i * (N / 7) + N / 14, y, 7, 0, TAU); g.fill(); }
    } else if (top.kind === 'marble') {
      g.drawImage(TEX.marble(col, top.vein || '#999999', { size: 1024, scale: 2, strength: 0.45 }).image, 0, 0, N, N);
    } else if (top.kind === 'malachite') {
      const img = TEX.malachite({ size: 512, bands: 54, light: '#3c9c70', mid: '#11603e', dark: '#082c1c' }).image;
      for (const qx of [1, -1]) for (const qy of [1, -1]) { g.save(); g.translate(N / 2, N / 2); g.scale(qx, qy); g.drawImage(img, 0, 0, N / 2, N / 2); g.restore(); }
    } else if (top.kind === 'stone' || top.kind === 'raw') {
      g.drawImage(TEX.stone(col, top.speck || shade(col, 0.25), { size: 1024, scale: top.kind === 'raw' ? 3 : 6, cloud: 0.4, speckMix: 0.4 }).image, 0, 0, N, N);
      if (top.kind === 'raw') {
        // weathering: lichen, pits and the strokes of a stone hammer
        const R2 = rng(21);
        for (let i = 0; i < 70; i++) { g.fillStyle = rgba(R2() < 0.6 ? '#c8c890' : '#e0d8a8', 0.08 + R2() * 0.1); g.beginPath(); g.ellipse(R2() * N, R2() * N, 20 + R2() * 70, 14 + R2() * 50, R2() * 3, 0, TAU); g.fill(); }
        for (let i = 0; i < 1400; i++) { g.fillStyle = rgba('#000000', 0.08 + R2() * 0.16); const r = 1 + R2() * 4; g.beginPath(); g.arc(R2() * N, R2() * N, r, 0, TAU); g.fill(); }
        g.strokeStyle = 'rgba(255,255,240,0.07)'; g.lineWidth = 6;
        for (let i = 0; i < 160; i++) { const x = R2() * N, y = R2() * N, a = R2() * 0.6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 60, y + Math.sin(a) * 60); g.stroke(); }
      }
    } else if (top.kind === 'brick') {
      // sun-baked bricks under a skim of clay, as at Mohenjo-daro
      const R2 = rng(13), bw = N / 8, bh = N / 16;
      g.fillStyle = shade(col, -0.35); g.fillRect(0, 0, N, N);
      for (let r = 0; r < 16; r++) for (let k = -1; k < 9; k++) {
        const x = k * bw + (r % 2) * bw / 2, y = r * bh;
        g.fillStyle = shade(col, (R2() - 0.5) * 0.24); g.fillRect(x + 4, y + 4, bw - 8, bh - 8);
      }
      g.globalAlpha = 0.5; g.drawImage(TEX.stone(col, shade(col, 0.2), { size: 512, scale: 3 }).image, 0, 0, N, N); g.globalAlpha = 1;
    } else if (top.kind === 'nacre') {
      // mother of pearl: soft bands of rose, mint and blue in a pale shell
      const R2 = rng(7);
      g.fillStyle = col; g.fillRect(0, 0, N, N);
      for (let i = 0; i < 90; i++) { g.fillStyle = rgba(['#f8d8e0', '#d8f0e8', '#d8e4f8', '#fff4dc'][i % 4], 0.22); g.beginPath(); g.ellipse(R2() * N, R2() * N, 80 + R2() * 260, 20 + R2() * 60, R2() * 3, 0, TAU); g.fill(); }
    } else if (top.kind === 'glass') {
      g.fillStyle = col; g.fillRect(0, 0, N, N);
    } else {
      g.drawImage(TEX.mottle(col, { amount: 0.08 }).image, 0, 0, N, N);
    }
    if (top.kind === 'leather') {
      // a leather writing surface inside a wooden border
      const h = R * 0.86 - 0.7;
      g.fillStyle = col; g.fillRect(px(-h), px(-h), px(h) - px(-h), px(h) - px(-h));
      g.globalAlpha = 0.35; g.drawImage(TEX.mottle(col, { amount: 0.18 }).image, px(-h), px(-h), px(h) - px(-h), px(h) - px(-h)); g.globalAlpha = 1;
      g.strokeStyle = '#d8b060'; g.lineWidth = 6; g.strokeRect(px(-h) + 14, px(-h) + 14, px(h) - px(-h) - 28, px(h) - px(-h) - 28);
    }
    if (!t.raw) {
      // an inlaid line following the edge, and a second, finer one inside it
      const line = (inset, w, colr) => {
        g.beginPath();
        points(shape, 240).forEach(([x, y], i) => { const k = 1 - inset / R; (i ? g.lineTo : g.moveTo).call(g, px(x * k), px(-y * k)); });
        g.closePath(); g.strokeStyle = colr; g.lineWidth = w; g.stroke();
      };
      const ink = top.inlay || (t.metal === 'chrome' || t.metal === 'silver' ? '#dfe3e8' : '#d8b060');
      line(0.35, 7, ink); line(0.52, 3, rgba(ink, 0.7));
    }
    return c;
  }

  // ------------------------------------------------------------------ the table
  // Builds the table at y = top (the board stands on it) with its foot down to the floor.
  function table(roomId, top, floor, fallback) {
    const s = SUITES[roomId], t = (s && s.table) || { shape: 'round', top: { kind: 'wood', color: fallback || '#4a2a18' }, foot: 'pedestal', metal: 'gold' };
    const grp = new THREE.Group(), owned = [];
    const R = t.shape === 'hex' ? 8.8 : t.shape === 'octagon' ? 8.5 : t.shape === 'square' ? 8.1 : t.shape === 'lotus' || t.shape === 'scallop' ? 8.4 : t.shape === 'quatrefoil' ? 8.7 : t.shape === 'slab' || t.shape === 'polygon' ? 8 : 8.2;
    const shape = outline(t.shape, R, roomId.length);
    const raw = !!t.raw, k = t.top.kind;
    const map = texFrom(topCanvas(t, shape, R)); owned.push(map);
    map.repeat.set(1 / (2 * R), 1 / (2 * R)); map.offset.set(0.5, 0.5);
    const thick = raw ? 0.9 : 0.42;
    const topMat = k === 'glass'
      ? new THREE.MeshPhysicalMaterial({ color: t.top.color, metalness: 0, roughness: 0.04, transmission: 0.55, thickness: 0.4, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.92, envMapIntensity: 1.4 })
      : raw ? new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 })
        : new THREE.MeshPhysicalMaterial({ map, roughness: k === 'marble' || k === 'malachite' ? 0.22 : k === 'stone' || k === 'brick' ? 0.6 : k === 'planks' ? 0.55 : 0.36, clearcoat: k === 'stone' || k === 'planks' ? 0.3 : 1, clearcoatRoughness: k === 'lacquer' ? 0.05 : 0.25, iridescence: k === 'nacre' ? 0.6 : 0, envMapIntensity: k === 'nacre' ? 1.3 : 1 });
    const sideColor = k === 'malachite' ? '#0e4a30' : k === 'glass' ? '#9aaab8' : t.top.wood || t.top.color || '#3a2214';
    const sideMat = raw ? new THREE.MeshStandardMaterial({ map, color: '#d8d8d8', roughness: 1, flatShading: true })
      : new THREE.MeshPhysicalMaterial({ color: k === 'leather' ? t.top.wood : sideColor, roughness: 0.4, clearcoat: k === 'stone' ? 0.2 : 0.9, clearcoatRoughness: 0.3 });
    const body = new THREE.Mesh(slab(shape, top - thick, top, raw ? 0.12 : 0.06, 48), [topMat, sideMat]);
    body.receiveShadow = true; body.castShadow = true; body.userData.role = 'table';
    grp.add(body);
    if (raw) body.geometry = roughen(body.geometry, top, 0.05, roomId.length);
    // a metal fillet round the edge (none on the raw tables)
    if (!raw && t.metal) {
      const pts = points(shape, 260).map(([x, y]) => [x, top - 0.02, -y]);
      grp.add(new THREE.Mesh(K.tube(pts, 0.035, { closed: true, segs: 260, radial: 6 }), metal(t.metal)));
    }
    grp.add(foot(t, top - thick, floor, R));
    grp.userData.dispose = () => owned.forEach((x) => x.dispose());
    grp.userData.R = R;
    return grp;
  }
  // Rough up a geometry's vertices a little (raw stone: no edge is straight).
  function roughen(g, top, amt, seed) {
    g = g.index ? g.toNonIndexed() : g;
    const p = g.attributes.position, R2 = rng(seed || 5), cache = new Map();
    for (let i = 0; i < p.count; i++) {
      const key = Math.round(p.getX(i) * 50) + ',' + Math.round(p.getY(i) * 50) + ',' + Math.round(p.getZ(i) * 50);
      if (!cache.has(key)) cache.set(key, [(R2() - 0.5) * amt * 2, (R2() - 0.5) * amt * (p.getY(i) > top - 0.01 ? 0.6 : 2), (R2() - 0.5) * amt * 2]);
      const d = cache.get(key);
      p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
    }
    g.computeVertexNormals();
    return g;
  }
  // The table's foot: a turned pedestal, four legs, a column, lion's feet, a drum, a trestle...
  function foot(t, y1, y0, R) {
    const grp = new THREE.Group(), m = metal(t.metal || 'gold'), kind = t.foot || 'pedestal';
    const wood = MAT.lacquer(t.top.wood || (t.top.kind === 'marble' || t.top.kind === 'stone' || t.top.kind === 'glass' || t.top.kind === 'nacre' ? '#2a1a12' : t.top.color || '#3a2214'), { roughness: 0.42, clearcoatRoughness: 0.3 });
    const add = (g, mat) => { const mesh = new THREE.Mesh(g, mat); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh); return mesh; };
    const H = y1 - y0;
    if (kind === 'pedestal' || kind === 'column') {
      const stone = kind === 'column' ? MAT.stone(TEX.marble(t.top.color || '#efece6', t.top.vein || '#a8a49c', { size: 512, scale: 2, strength: 0.4 }), { roughness: 0.25 }) : wood;
      // traced with a quarter of the steps along: the foot stands in the table's shadow, and at
      // full steps it was some 30k triangles in every room
      const along = K.DETAIL.along;
      K.DETAIL.along = along * 0.25;
      const prof = kind === 'column'
        ? K.profile(0, y0).line(2.4, y0).line(2.4, y0 + 0.5).arc(2.0, y0 + 0.8, 0.3).line(1.15, y0 + 1.0).line(1.0, y0 + 1.2).line(0.95, y1 - 1.0).line(1.4, y1 - 0.7).line(2.6, y1 - 0.2).line(2.6, y1).line(0, y1)
        : K.profile(0, y0).line(2.6, y0).arc(2.5, y0 + 0.3, 0.3).curve([[1.6, y0 + 0.6], [0.9, y0 + 1.2], [0.75, y0 + 2.4], [0.95, y1 - 0.8], [2.2, y1 - 0.1]]).line(0, y1);
      K.DETAIL.along = along;
      add(K.revolve(prof, { segs: 64, mod: K.MOD.flutes(kind === 'column' ? 20 : 16, 0.06, y0 + 1.3, y1 - 1.0) }), stone);
      add(K.ring(1.0, y0 + 1.15, 0.05), m); add(K.ring(1.02, y1 - 1.0, 0.05), m);
    } else if (kind === 'legs' || kind === 'bistro' || kind === 'iron') {
      const n = kind === 'bistro' ? 3 : 4, r = kind === 'legs' ? R * 0.62 : R * 0.45, mat = kind === 'legs' ? wood : kind === 'iron' ? MAT.matte('#1e2226', { roughness: 0.5, metalness: 0.6 }) : m;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + Math.PI / 4;
        const c = Math.cos(a), s = Math.sin(a);
        // a cabriole curve: out at the knee, in at the ankle, out again at the foot
        const pts = kind === 'legs' ? [[c * r, y1, s * r], [c * (r + 0.4), y1 - H * 0.25, s * (r + 0.4)], [c * (r - 0.3), y1 - H * 0.7, s * (r - 0.3)], [c * (r + 0.15), y0 + 0.1, s * (r + 0.15)]]
          : [[c * 0.6, y1, s * 0.6], [c * r * 0.5, y1 - H * 0.3, s * r * 0.5], [c * r * 0.9, y0 + 0.6, s * r * 0.9], [c * (r + 0.5), y0 + 0.05, s * (r + 0.5)]];
        add(K.tube(pts, kind === 'legs' ? 0.26 : 0.1, { segs: 32, radial: 10 }), mat);
        if (kind === 'legs') add(new THREE.SphereGeometry(0.3, 16, 10).translate(c * (r + 0.15), y0 + 0.2, s * (r + 0.15)), m);
      }
      if (kind === 'legs') add(new THREE.BoxGeometry(R * 1.3, 0.55, R * 1.3).translate(0, y1 - 0.3, 0), wood);
      else add(new THREE.CylinderGeometry(0.22, 0.26, H, 16).translate(0, y0 + H / 2, 0), mat);
      if (kind === 'iron') add(K.ring(R * 0.42, y0 + H * 0.35, 0.06), mat);
    } else if (kind === 'lion' || kind === 'ming') {
      // four square legs on carved feet (lion's paws, or a Ming horse-hoof foot), with an apron
      const mat = kind === 'ming' ? MAT.lacquer(t.top.color === '#8a8478' ? '#3a2a20' : '#5a0e0a', { roughness: 0.3 }) : wood;
      const hx = R * 0.6;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        add(new THREE.BoxGeometry(0.55, H - 0.4, 0.55).translate(sx * hx, y0 + 0.4 + (H - 0.4) / 2, sz * hx), mat);
        if (kind === 'lion') add(new THREE.SphereGeometry(0.45, 16, 10).scale(1, 0.7, 1.3).translate(sx * hx, y0 + 0.3, sz * hx + sz * 0.15), m);
        else add(K.tube([[sx * hx, y0 + 0.6, sz * hx], [sx * (hx + 0.2), y0 + 0.2, sz * (hx + 0.2)], [sx * (hx + 0.35), y0 + 0.08, sz * (hx + 0.35)]], 0.2, { segs: 12 }), mat);
      }
      add(new THREE.BoxGeometry(hx * 2 + 0.6, 0.7, hx * 2 + 0.6).translate(0, y1 - 0.35, 0), mat);
      add(new THREE.BoxGeometry(hx * 2 + 0.7, 0.06, hx * 2 + 0.7).translate(0, y1 - 0.72, 0), m);
    } else if (kind === 'drum') {
      const mat = t.top.kind === 'stone' ? MAT.stone(TEX.stone(t.top.color, t.top.speck || '#888888', { scale: 5 }), { roughness: 0.6, clearcoat: 0.2 }) : wood;
      add(new THREE.CylinderGeometry(R * 0.55, R * 0.62, H, 48).translate(0, y0 + H / 2, 0), mat);
      for (const y of [y0 + 0.3, y1 - 0.3]) add(K.ring(R * (y < y0 + 1 ? 0.62 : 0.555), y, 0.07), m);
    } else if (kind === 'deco') {
      const mat = MAT.lacquer('#121214', { roughness: 0.2 });
      add(new THREE.CylinderGeometry(3.2, 3.2, 0.4, 6).translate(0, y0 + 0.2, 0), mat);
      for (let i = 0; i < 3; i++) add(new THREE.CylinderGeometry(1.6 - i * 0.3, 1.8 - i * 0.3, 0.3, 6).translate(0, y0 + 0.55 + i * 0.3, 0), i % 2 ? m : mat);
      add(new THREE.CylinderGeometry(0.7, 0.9, H - 1.6, 6).translate(0, y0 + 1.3 + (H - 1.6) / 2, 0), mat);
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; add(new THREE.BoxGeometry(0.06, H - 1.4, 0.5).rotateY(-a).translate(Math.cos(a) * 0.85, y0 + 1.2 + (H - 1.4) / 2, Math.sin(a) * 0.85), m); }
    } else if (kind === 'trestle' || kind === 'low') {
      for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(0.5, H, R * 1.1).translate(s * R * 0.55, y0 + H / 2, 0), wood);
        add(new THREE.BoxGeometry(0.9, 0.4, R * 1.3).translate(s * R * 0.55, y0 + 0.2, 0), wood);
      }
      add(new THREE.BoxGeometry(R * 1.1, 0.35, 0.4).translate(0, y0 + H * 0.3, 0), wood);
    } else if (kind === 'coral') {
      // branching coral in pink, holding the shell up
      const coral = MAT.lacquer('#e87a7a', { roughness: 0.6, clearcoat: 0.3 }), R2 = rng(4);
      add(new THREE.CylinderGeometry(1.0, 1.6, H, 24).translate(0, y0 + H / 2, 0), coral);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU, r0 = 0.9, r1 = 2.4 + R2() * 1.2, yA = y0 + 0.4 + R2() * (H * 0.4);
        add(K.tube([[Math.cos(a) * r0, yA, Math.sin(a) * r0], [Math.cos(a) * (r0 + r1) * 0.6, yA + 0.8 + R2(), Math.sin(a) * (r0 + r1) * 0.6], [Math.cos(a + 0.2) * (r0 + r1), y1 - 0.2, Math.sin(a + 0.2) * (r0 + r1)]], 0.18, { segs: 16, radial: 8 }), coral);
      }
    } else if (kind === 'stones' || kind === 'bricks') {
      // two rough uprights, like a little trilithon (or two piers of mud brick)
      const mat = kind === 'bricks' ? MAT.matte('#9a5a30', { roughness: 1 }) : MAT.matte(t.top.color, { roughness: 1, flatShading: true });
      for (const s of [-1, 1]) {
        let g = new THREE.BoxGeometry(2.6, H, R * 1.3, 3, 5, 4).translate(s * R * 0.5, y0 + H / 2, 0);
        g = roughen(g, 1e9, kind === 'bricks' ? 0.04 : 0.18, s > 0 ? 7 : 9);
        add(g, mat);
      }
    }
    return grp;
  }

  // ------------------------------------------------------------------ the props
  // Each builds at the origin, standing on y = 0, about a square or two across.
  const lathe = (pts, segs) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segs || 32);
  const smoothLathe = (pts, segs, n) => new THREE.LatheGeometry(new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y))).getPoints(n || 40), segs || 32);
  const ball = (r, x, y, z, s) => new THREE.SphereGeometry(r, s || 20, Math.max(8, ((s || 20) * 0.6) | 0)).translate(x, y, z);
  const C = (key, color, o) => K.material('decor-' + key, () => new THREE.MeshPhysicalMaterial(Object.assign({ color, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.2 }, o || {})));
  const MATTE = (key, color, o) => K.material('decor-m-' + key, () => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, o || {})));
  const porcelain = () => C('porcelain', '#f4f2ee', { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.04 });
  const glassM = (tint) => MAT.glass(tint || '#e8f0f4', { thickness: 0.3 });
  function group(parts) {
    const g = new THREE.Group();
    for (const [geo, mat] of parts) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; g.add(m); }
    return g;
  }
  function fruit(list, color, r, at, seed, stem) {
    // a heap of round fruit (or sweets) in a bowl: a ring of them and a few on top
    const R2 = rng(seed || 1), out = [];
    const n = at.n || 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + R2() * 0.3, rr = at.r || 0.36;
      out.push([ball(r * (0.9 + R2() * 0.2), Math.cos(a) * rr, at.y + r, Math.sin(a) * rr), color]);
    }
    for (let i = 0; i < (at.top || 3); i++) out.push([ball(r, (R2() - 0.5) * 0.3, at.y + r * 2.3, (R2() - 0.5) * 0.3), color]);
    if (stem) out.push([new THREE.CylinderGeometry(0.015, 0.02, 0.12, 6).translate(0, at.y + r * 3.4, 0), stem]);
    list.push(...out);
    return list;
  }
  const bowl = (m, r, h) => [lathe([[0, 0], [r * 0.45, 0], [r * 0.5, 0.06], [r * 0.4, 0.1], [r * 0.95, h], [r, h + 0.02], [r * 0.92, h], [r * 0.35, 0.14], [0, 0.14]], 40), m];
  // a plain cushion with tassels at the corners
  function cushion(color, w) {
    const v = MAT.velvet(color), g = new THREE.BoxGeometry(w, 0.22, w, 6, 2, 6), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) / (w / 2), z = p.getZ(i) / (w / 2), y = p.getY(i); p.setY(i, y * (1 - 0.5 * Math.max(x * x, z * z)) + 0.11); }
    g.computeVertexNormals();
    const parts = [[g, v]];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push([new THREE.ConeGeometry(0.05, 0.16, 8).translate(sx * w / 2, 0.08, sz * w / 2), MAT.gold()]);
    return parts;
  }
  function wheel(r, x, y, z, rubber, hub) {
    return [[new THREE.TorusGeometry(r * 0.8, r * 0.22, 10, 28).rotateY(Math.PI / 2).translate(x, y, z), rubber], [new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.06, 20).rotateZ(Math.PI / 2).translate(x, y, z), hub]];
  }
  const PROPS = {
    // Sculptor's Studio: a mallet and chisel, a little marble figure, lemons and a clay model
    mallet: () => group([
      [new THREE.CylinderGeometry(0.11, 0.11, 0.3, 16).rotateZ(Math.PI / 2).translate(0.1, 0.11, 0), C('mallethead', '#8a6a44', { roughness: 0.6 })],
      [new THREE.CylinderGeometry(0.03, 0.035, 0.5, 10).rotateZ(Math.PI / 2).translate(-0.28, 0.11, 0), C('malletgrip', '#c89a62', { roughness: 0.55 })],
      [new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8).rotateZ(Math.PI / 2).rotateY(0.6).translate(0.02, 0.02, 0.22), MAT.silver()],
      [new THREE.BoxGeometry(0.34, 0.04, 0.26).translate(0, 0.02, -0.04), C('marblechip', '#efebe2', { roughness: 0.3, clearcoat: 0.6 })],
    ]),
    statuette: () => group([
      [new THREE.BoxGeometry(0.34, 0.12, 0.34).translate(0, 0.06, 0), C('nero', '#1e1e22', { roughness: 0.15, clearcoat: 1 })],
      [smoothLathe([[0, 0.12], [0.1, 0.12], [0.12, 0.3], [0.09, 0.55], [0.12, 0.7], [0.08, 0.8], [0.04, 0.84], [0, 0.85]], 24), C('statuary', '#f2eee6', { roughness: 0.3, clearcoat: 0.6 })],
      [ball(0.07, 0, 0.92, 0, 16), C('statuary', '#f2eee6', { roughness: 0.3, clearcoat: 0.6 })],
      [K.tube([[0.1, 0.72, 0], [0.18, 0.86, 0.02], [0.14, 1.02, 0]], 0.025, { segs: 8 }), C('statuary', '#f2eee6', { roughness: 0.3, clearcoat: 0.6 })],
      [K.ring(0.18, 0.12, 0.012), MAT.gold()],
    ]),
    lemons: () => { const p = [bowl(C('statuary', '#f2eee6', { roughness: 0.3, clearcoat: 0.6 }), 0.5, 0.16)]; fruit(p, C('lemon', '#f0d23a', { roughness: 0.45, clearcoat: 0.4 }), 0.1, { y: 0.15, r: 0.22, n: 6, top: 2 }, 31); p.forEach((q, i) => { if (i) q[0].scale(1, 1, 1); }); return group(p); },
    claymodel: () => group([
      [new THREE.CylinderGeometry(0.24, 0.26, 0.06, 24).translate(0, 0.03, 0), C('turntable', '#5a3a22', { roughness: 0.6 })],
      [new THREE.SphereGeometry(0.17, 20, 14).scale(1, 1.2, 0.9).translate(0, 0.25, 0), MATTE('clay', '#b0603a')],
      [ball(0.08, 0.02, 0.48, 0, 14), MATTE('clay', '#b0603a')],
    ]),
    // Sapphire Throne Room: a sceptre on a cushion, an orb, a dish of plums and a jewelled casket
    sceptre: () => group([
      ...cushion('#1e3488', 0.6),
      [new THREE.CylinderGeometry(0.025, 0.025, 0.8, 10).rotateZ(Math.PI / 2).rotateY(0.5).translate(0, 0.26, 0), MAT.gold()],
      [ball(0.07, 0.34, 0.26, -0.18, 14), MAT.gem('#1e4ac8')],
      [ball(0.035, -0.34, 0.26, 0.18, 10), MAT.gold()],
    ]),
    globus: () => group([
      [lathe([[0, 0], [0.18, 0], [0.12, 0.06], [0.06, 0.14], [0, 0.14]], 24), MAT.gold()],
      [ball(0.2, 0, 0.32, 0, 28), C('orbenamel', '#1e3488', { roughness: 0.12, clearcoat: 1 })],
      [K.ring(0.205, 0.32, 0.016), MAT.gold()],
      [K.ring(0.205, 0, 0.016).rotateX(Math.PI / 2).translate(0, 0.32, 0), MAT.gold()],
      [new THREE.BoxGeometry(0.03, 0.18, 0.03).translate(0, 0.6, 0), MAT.gold()], [new THREE.BoxGeometry(0.12, 0.03, 0.03).translate(0, 0.62, 0), MAT.gold()],
      [ball(0.03, 0, 0.32, 0.205, 10), MAT.gem('#e8f0ff')],
    ]),
    plums: () => { const p = [bowl(porcelain(), 0.5, 0.18)]; fruit(p, C('plum', '#4a1a5a', { roughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#a890c8') }), 0.1, { y: 0.16, r: 0.22, n: 6, top: 2 }, 37); return group(p); },
    casket: () => group([
      [new THREE.BoxGeometry(0.56, 0.26, 0.36).translate(0, 0.13, 0), C('ivorybox', '#f0e8d8', { roughness: 0.3, clearcoat: 0.8 })],
      [new THREE.BoxGeometry(0.6, 0.06, 0.4).translate(0, 0.29, 0), MAT.gold()],
      ...[-0.2, 0, 0.2].map((x) => [ball(0.04, x, 0.15, 0.185, 10), MAT.gem('#1e4ac8')]),
      [ball(0.05, 0, 0.35, 0, 12), MAT.gem('#1e4ac8')],
    ]),
    // Admiral's Cabin: a ship in a bottle, a brass spyglass, a sextant and a compass
    shipbottle: () => group([
      [new THREE.BoxGeometry(0.66, 0.06, 0.24).translate(0, 0.03, 0), C('mahog', '#3a1a10', { roughness: 0.4, clearcoat: 0.6 })],
      [new THREE.CylinderGeometry(0.14, 0.14, 0.56, 20).rotateZ(Math.PI / 2).translate(-0.02, 0.2, 0), glassM('#d8ecf0')],
      [new THREE.CylinderGeometry(0.05, 0.08, 0.14, 12).rotateZ(Math.PI / 2).translate(0.32, 0.2, 0), glassM('#d8ecf0')],
      [new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8).rotateZ(Math.PI / 2).translate(0.41, 0.2, 0), C('cork', '#b08050', { roughness: 0.8 })],
      [new THREE.BoxGeometry(0.3, 0.05, 0.08).translate(-0.02, 0.12, 0), C('hull', '#16224a', { roughness: 0.4 })],
      ...[-0.1, 0.06].map((x) => [new THREE.BoxGeometry(0.008, 0.16, 0.1).translate(x, 0.22, 0), C('sail', '#efe6d2', { roughness: 0.8 })]),
    ]),
    spyglass: () => group([
      [new THREE.CylinderGeometry(0.05, 0.07, 0.7, 16).rotateZ(Math.PI / 2 - 0.1).translate(0, 0.14, 0), MAT.brass()],
      ...[-0.18, 0.08].map((x) => [K.ring(0.07, 0, 0.012).rotateZ(Math.PI / 2).translate(x, 0.13 - x * 0.1, 0), MAT.gold()]),
      ...[-1, 1].map((s) => [new THREE.BoxGeometry(0.06, 0.08, 0.2).translate(s * 0.2, 0.04, 0), C('mahog', '#3a1a10', { roughness: 0.4, clearcoat: 0.6 })]),
    ]),
    sextant: () => group([
      [new THREE.TorusGeometry(0.26, 0.015, 8, 24, Math.PI / 3).rotateZ(-Math.PI / 2 - Math.PI / 6).translate(0, 0.36, 0), MAT.brass()],
      ...[-1, 1].map((s) => [new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8).rotateZ(s * 0.5).translate(s * 0.07, 0.24, 0), MAT.brass()]),
      [new THREE.CylinderGeometry(0.025, 0.025, 0.16, 10).rotateZ(Math.PI / 2).translate(0, 0.3, 0.03), MAT.brass()],
      [new THREE.BoxGeometry(0.5, 0.08, 0.36).translate(0, 0.04, 0), C('mahog', '#3a1a10', { roughness: 0.4, clearcoat: 0.6 })],
      [new THREE.CylinderGeometry(0.02, 0.02, 0.12, 8).translate(0, 0.14, 0), MAT.brass()],
    ]),
    compass: () => group([
      [lathe([[0, 0], [0.26, 0], [0.28, 0.04], [0.28, 0.1], [0.25, 0.1], [0.25, 0.06], [0, 0.06]], 32), MAT.brass()],
      [new THREE.CylinderGeometry(0.25, 0.25, 0.005, 32).translate(0, 0.065, 0), C('dial', '#f2ead8', { roughness: 0.5 })],
      [new THREE.ConeGeometry(0.03, 0.36, 4).rotateZ(Math.PI / 2).rotateY(0.6).translate(0, 0.075, 0), C('needle', '#a82a22', { roughness: 0.3 })],
      [ball(0.022, 0, 0.08, 0, 10), MAT.brass()],
    ]),
    // Emerald Observatory: an armillary sphere, a small telescope, ivy in a pot and an open star book
    armillary: () => group([
      [lathe([[0, 0], [0.2, 0], [0.16, 0.06], [0.04, 0.12], [0.03, 0.3], [0, 0.3]], 24), C('verdewood', '#24160e', { roughness: 0.4, clearcoat: 0.6 })],
      [K.ring(0.28, 0, 0.014).rotateX(Math.PI / 2).translate(0, 0.58, 0), MAT.gold()],
      [K.ring(0.28, 0, 0.014).rotateX(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.58, 0), MAT.gold()],
      [K.ring(0.28, 0, 0.014).rotateZ(0.4).translate(0, 0.58, 0), MAT.gold()],
      [ball(0.07, 0, 0.58, 0, 16), MAT.gem('#18a066')],
      [new THREE.CylinderGeometry(0.008, 0.008, 0.66, 6).rotateZ(0.4).translate(0, 0.58, 0), MAT.gold()],
    ]),
    brassscope: () => group([
      ...[0, 1, 2].map((i) => [new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6).rotateX(0.25).rotateY(i * TAU / 3).translate(Math.cos(i * TAU / 3 + Math.PI / 2) * 0.06, 0.28, Math.sin(i * TAU / 3 + Math.PI / 2) * -0.06), MAT.brass()]),
      [new THREE.CylinderGeometry(0.045, 0.065, 0.62, 16).rotateZ(1.1).translate(0, 0.62, 0), MAT.brass()],
      [K.ring(0.066, 0, 0.012).rotateZ(1.1 - Math.PI / 2).translate(-0.26, 0.75, 0), MAT.gold()],
    ]),
    ivypot: () => {
      const p = [[smoothLathe([[0, 0], [0.16, 0], [0.2, 0.2], [0.22, 0.26], [0, 0.26]], 24), C('verdepot', '#1d5a44', { roughness: 0.2, clearcoat: 1 })], [K.ring(0.22, 0.26, 0.015), MAT.gold()]];
      const R2 = rng(43), leaf = C('ivy', '#2a6a3a', { roughness: 0.5 });
      for (let i = 0; i < 26; i++) { const a = R2() * TAU, r = 0.12 + R2() * 0.2, y = 0.26 + R2() * 0.22 - (r > 0.22 ? (r - 0.22) * 1.6 : 0); p.push([new THREE.SphereGeometry(0.05, 8, 6).scale(1, 0.4, 1.2).rotateY(a).translate(Math.cos(a) * r, y, Math.sin(a) * r), leaf]); }
      return group(p);
    },
    starbook: () => group([
      ...[-1, 1].map((s) => [new THREE.BoxGeometry(0.3, 0.03, 0.42).rotateZ(s * -0.08).translate(s * 0.155, 0.04, 0), C('chartpage', '#1a2a5a', { roughness: 0.6 })]),
      ...[-1, 1].map((s) => [new THREE.BoxGeometry(0.31, 0.02, 0.43).rotateZ(s * -0.08).translate(s * 0.155, 0.015, 0), C('verdeleather', '#1d5a44', { roughness: 0.6 })]),
      ...[[-0.2, 0.1], [-0.1, -0.08], [0.16, 0.06], [0.22, -0.1], [0.08, 0.14]].map(([x, z]) => [ball(0.012, x, 0.065, z, 6), MAT.emissive('#ffe8a0', 1.2)]),
    ]),
    // Waterfall Pavilion: a stone lantern, a folding fan, an incense burner and a koi bowl
    stonelantern: () => group([
      [new THREE.CylinderGeometry(0.16, 0.2, 0.08, 6).translate(0, 0.04, 0), MATTE('granite', '#8a867e')],
      [new THREE.CylinderGeometry(0.05, 0.06, 0.34, 8).translate(0, 0.25, 0), MATTE('granite', '#8a867e')],
      [new THREE.CylinderGeometry(0.16, 0.12, 0.06, 6).translate(0, 0.45, 0), MATTE('granite', '#8a867e')],
      [new THREE.BoxGeometry(0.18, 0.16, 0.18).translate(0, 0.56, 0), MATTE('granite', '#8a867e')],
      [new THREE.BoxGeometry(0.1, 0.1, 0.19).translate(0, 0.56, 0), MAT.emissive('#ffb860', 1.6)],
      [new THREE.ConeGeometry(0.26, 0.16, 6).translate(0, 0.72, 0), MATTE('granite', '#8a867e')],
      [ball(0.04, 0, 0.82, 0, 10), MATTE('granite', '#8a867e')],
    ]),
    fan: () => {
      const p = [];
      for (let i = 0; i < 12; i++) { const a = -0.9 + i * 1.8 / 11; p.push([new THREE.BoxGeometry(0.06, 0.006, 0.42).translate(0, 0, 0.21).rotateY(a).translate(0, 0.02 + i * 0.002, -0.16), C(i % 2 ? 'fanred' : 'fangold', i % 2 ? '#a8241a' : '#e8c068', { roughness: 0.5 })]); }
      p.push([ball(0.025, 0, 0.03, -0.16, 8), MAT.gold()]);
      return group(p);
    },
    incense: (ctx) => {
      const g = group([
        [lathe([[0, 0], [0.18, 0], [0.22, 0.06], [0.2, 0.18], [0.12, 0.2], [0, 0.2]], 24), MAT.bronze()],
        ...[0, 1, 2].map((i) => [new THREE.CylinderGeometry(0.02, 0.025, 0.08, 6).translate(Math.cos(i * TAU / 3) * 0.14, 0.0, Math.sin(i * TAU / 3) * 0.14), MAT.bronze()]),
        ...[-0.05, 0.05].map((x) => [new THREE.CylinderGeometry(0.006, 0.006, 0.4, 5).rotateZ(x).translate(x, 0.38, 0), C('joss', '#7a2a1a', { roughness: 0.8 })]),
        ...[-0.05, 0.05].map((x) => [ball(0.01, x * 1.5, 0.58, 0, 6), MAT.emissive('#ff6a2a', 2)]),
      ]);
      void ctx; return g;
    },
    koibowl: () => {
      const p = [[lathe([[0, 0], [0.2, 0], [0.4, 0.14], [0.42, 0.18], [0.39, 0.16], [0, 0.04]], 36), C('celadonbowl', '#e8eef0', { roughness: 0.15, clearcoat: 1 })]];
      p.push([new THREE.CylinderGeometry(0.38, 0.38, 0.005, 32).translate(0, 0.13, 0), C('pondwater', '#2a5a7a', { roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.8 })]);
      for (const [x, z, a, col] of [[-0.12, 0.05, 0.4, '#e86a2a'], [0.12, -0.06, 2.6, '#f4f0e8']]) p.push([new THREE.SphereGeometry(0.05, 10, 8).scale(2, 0.5, 1).rotateY(a).translate(x, 0.12, z), C('koi' + col, col, { roughness: 0.3, clearcoat: 0.8 })]);
      return group(p);
    },
    candelabra: (ctx) => candelabrum(0, 0, 0, ctx.flames, ctx.metal),
    roses: () => {
      const parts = [[smoothLathe([[0, 0], [0.2, 0.02], [0.24, 0.3], [0.16, 0.6], [0.12, 0.72], [0.16, 0.8], [0, 0.8]], 32), porcelain()]];
      const R2 = rng(3), red = C('rose', '#b0142e', { roughness: 0.5, sheen: 0.6, sheenColor: new THREE.Color('#ff6a7a') }), leaf = MATTE('leaf', '#2f5a2a');
      for (let i = 0; i < 7; i++) { const a = i / 7 * TAU, r = i ? 0.2 : 0, y = 1.25 + R2() * 0.15; parts.push([ball(0.12, Math.cos(a) * r, y, Math.sin(a) * r, 12).scale(1, 0.85, 1), red]); parts.push([new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5).translate(Math.cos(a) * r * 0.6, 0.98, Math.sin(a) * r * 0.6), leaf]); }
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + 0.3; parts.push([ball(0.09, Math.cos(a) * 0.28, 1.05, Math.sin(a) * 0.28, 8).scale(1.6, 0.4, 1), leaf]); }
      return group(parts);
    },
    bonbons: () => {
      const parts = [bowl(MAT.silver(), 0.55, 0.22), [new THREE.CylinderGeometry(0.08, 0.2, 0.25, 24).translate(0, 0.0, 0), MAT.silver()]];
      parts[0][0].translate(0, 0.25, 0);
      ['#5a2a14', '#c8a070', '#3a1a0c', '#e8c8a0'].forEach((c, i) => fruit(parts, C('bonbon' + i, c, { roughness: 0.3, clearcoat: 0.8 }), 0.09, { y: 0.32, r: 0.18 + i * 0.07, n: 6 + i, top: i ? 0 : 3 }, i + 2));
      return group(parts);
    },
    globe: () => {
      const map = H.globeTexture ? H.globeTexture() : null;
      return group([
        [lathe([[0, 0], [0.42, 0], [0.4, 0.06], [0.1, 0.12], [0.07, 0.7], [0, 0.72]], 24), MAT.brass()],
        [new THREE.SphereGeometry(0.46, 32, 20).rotateZ(0.41).translate(0, 1.12, 0), map ? new THREE.MeshPhysicalMaterial({ map, roughness: 0.4, clearcoat: 0.6 }) : C('globe', '#c8b080')],
        [new THREE.TorusGeometry(0.52, 0.025, 6, 48, Math.PI * 1.2).rotateZ(0.41 - 0.3).translate(0, 1.12, 0), MAT.brass()],
      ]);
    },
    lamp: () => group([
      [lathe([[0, 0], [0.3, 0], [0.28, 0.06], [0.06, 0.12], [0.05, 1.1], [0, 1.12]], 24), MAT.brass()],
      [smoothLathe([[0.02, 1.05], [0.36, 1.12], [0.42, 1.2], [0.2, 1.36], [0.02, 1.4]], 32), C('shade', '#1e5a3a', { roughness: 0.2, clearcoat: 1, emissive: '#2a8a5a', emissiveIntensity: 0.25 })],
    ]),
    books: () => {
      const parts = [], R2 = rng(8), cols = ['#5a1a1a', '#1a3a5a', '#2a4a2a', '#6a4a1a', '#3a1a3a'];
      let y = 0;
      for (let i = 0; i < 4; i++) { const h = 0.14 + R2() * 0.06, w = 0.9 - i * 0.08; parts.push([new THREE.BoxGeometry(w, h, 0.62 - i * 0.03).rotateY((R2() - 0.5) * 0.4).translate(0, y + h / 2, 0), C('book' + i, cols[i], { roughness: 0.6, clearcoat: 0.2 })]); parts.push([new THREE.BoxGeometry(w * 0.96, h * 0.8, 0.02).translate(0, y + h / 2, 0.3 - i * 0.015), MAT.goldLeaf()]); y += h; }
      parts.push([new THREE.TorusGeometry(0.12, 0.012, 6, 24).rotateX(Math.PI / 2).translate(0.1, y + 0.01, 0), MAT.gold()]);
      return group(parts);
    },
    inkwell: () => group([
      [new THREE.BoxGeometry(0.7, 0.08, 0.5).translate(0, 0.04, 0), MAT.lacquer('#2a1a12')],
      [smoothLathe([[0, 0.08], [0.16, 0.08], [0.18, 0.2], [0.08, 0.28], [0.09, 0.32], [0, 0.32]], 24), glassM('#2a3a5a')],
      [K.tube([[0.05, 0.3, 0.05], [0.2, 0.7, 0.1], [0.36, 0.95, 0.12]], 0.02, { segs: 12 }), MATTE('quill', '#f4ecd8')],
      [new THREE.PlaneGeometry(0.1, 0.5).rotateZ(-0.5).translate(0.28, 0.82, 0.12), K.material('decor-feather', () => new THREE.MeshStandardMaterial({ color: '#f4ecd8', side: THREE.DoubleSide, roughness: 0.9 }))],
    ]),
    bust: () => group([
      [new THREE.BoxGeometry(0.6, 0.18, 0.6).translate(0, 0.09, 0), MAT.stone(TEX.marble('#3a3a40', '#9a9aa0', { size: 256 }), { roughness: 0.2 })],
      [smoothLathe([[0, 0.18], [0.2, 0.18], [0.12, 0.3], [0.1, 0.45], [0.34, 0.6], [0.36, 0.75], [0.12, 0.85], [0.1, 0.92], [0, 0.92]], 32), C('bust', '#f2eee6', { roughness: 0.3 })],
      [ball(0.18, 0, 1.08, 0.02, 24).scale(0.9, 1.15, 1), C('bust', '#f2eee6', { roughness: 0.3 })],
    ]),
    urn: () => group([[smoothLathe([[0, 0], [0.24, 0], [0.12, 0.12], [0.1, 0.25], [0.32, 0.5], [0.34, 0.75], [0.2, 0.95], [0.24, 1.02], [0, 1.02]], 36), MAT.gold()]]),
    grapes: () => {
      const parts = [bowl(MAT.silver(), 0.55, 0.2)], purple = C('grape', '#4a1a4a', { roughness: 0.3, clearcoat: 0.9 }), green = C('grape2', '#a8c060', { roughness: 0.3, clearcoat: 0.9 });
      const R2 = rng(5);
      for (const [cx, cz, m] of [[-0.15, 0, purple], [0.18, 0.08, green]]) for (let i = 0; i < 22; i++) { const t = i / 22, a = i * 2.4; parts.push([ball(0.06, cx + Math.cos(a) * 0.14 * (1 - t), 0.26 + (1 - t) * 0.3 * 0 + 0.06 + t * 0.02 + (i % 3) * 0.05, cz + Math.sin(a) * 0.14 * (1 - t) + t * 0.3 - 0.15, 10), m]); }
      fruit(parts, C('pear', '#d8b048', { roughness: 0.5 }), 0.1, { y: 0.2, r: 0.36, n: 3, top: 0 }, 9);
      void R2;
      return group(parts);
    },
    hourglass: () => group([
      [new THREE.CylinderGeometry(0.3, 0.3, 0.06, 6).translate(0, 0.03, 0), MAT.lacquer('#3a2214')],
      [new THREE.CylinderGeometry(0.3, 0.3, 0.06, 6).translate(0, 0.91, 0), MAT.lacquer('#3a2214')],
      ...[0, 1, 2].map((i) => [new THREE.CylinderGeometry(0.025, 0.025, 0.82, 8).translate(Math.cos(i / 3 * TAU) * 0.24, 0.47, Math.sin(i / 3 * TAU) * 0.24), MAT.brass()]),
      [smoothLathe([[0, 0.06], [0.18, 0.1], [0.16, 0.3], [0.03, 0.47], [0.16, 0.64], [0.18, 0.84], [0, 0.88]], 24), glassM()],
      [lathe([[0, 0.08], [0.15, 0.1], [0.12, 0.2], [0.02, 0.26], [0, 0.26]], 16), MATTE('sand', '#e0b878')],
    ]),
    pumpkins: () => {
      const parts = [], R2 = rng(6);
      [[0, 0, 0.36], [0.42, 0.2, 0.24], [-0.36, 0.26, 0.2]].forEach(([x, z, r], i) => {
        const g = new THREE.SphereGeometry(r, 32, 16), p = g.attributes.position;
        for (let k = 0; k < p.count; k++) { const a = Math.atan2(p.getZ(k), p.getX(k)), f = 1 + 0.08 * Math.cos(a * 10); p.setXYZ(k, p.getX(k) * f, p.getY(k) * 0.72, p.getZ(k) * f); }
        g.computeVertexNormals(); g.translate(x, r * 0.72, z);
        parts.push([g, C('pumpkin' + (i % 2), i === 2 ? '#e8d8a8' : '#d8701e', { roughness: 0.5 })]);
        parts.push([new THREE.CylinderGeometry(0.03, 0.045, 0.14, 6).rotateZ((R2() - 0.5) * 0.4).translate(x, r * 1.44 + 0.05, z), MATTE('stalk', '#5a4a24')]);
      });
      return group(parts);
    },
    wheat: () => {
      const parts = [], straw = MATTE('straw', '#e0b860'), R2 = rng(12);
      for (let i = 0; i < 26; i++) { const a = R2() * TAU, r = R2() * 0.12, lean = 0.25; const top = [Math.cos(a) * (r + lean * R2()), 1.3 + R2() * 0.2, Math.sin(a) * (r + lean * R2())]; parts.push([K.tube([[Math.cos(a) * r * 0.5, 0, Math.sin(a) * r * 0.5], [Math.cos(a) * r * 0.3, 0.55, Math.sin(a) * r * 0.3], top], 0.012, { segs: 8, radial: 4 }), straw]); parts.push([ball(0.04, top[0], top[1] + 0.08, top[2], 6).scale(1, 3, 1).translate(0, -(top[1] + 0.08) * 2, 0), straw]); }
      parts.push([new THREE.TorusGeometry(0.12, 0.03, 6, 20).rotateX(Math.PI / 2).translate(0, 0.5, 0), C('ribbon', '#8a1a1a')]);
      return group(parts);
    },
    apples: () => fruitBasket('#b8261e', '#d8c040'),
    pie: () => group([
      [lathe([[0, 0], [0.5, 0], [0.56, 0.12], [0.5, 0.14], [0, 0.14]], 40), C('dish', '#e8e0d0', { roughness: 0.2 })],
      [lathe([[0, 0.14], [0.5, 0.14], [0.52, 0.2], [0.4, 0.24], [0, 0.26]], 40), C('crust', '#c88a3a', { roughness: 0.6 })],
    ]),
    canopic: () => group([
      [smoothLathe([[0, 0], [0.2, 0], [0.24, 0.2], [0.22, 0.5], [0.16, 0.62], [0, 0.62]], 28), MAT.stone(TEX.marble('#f0e4cc', '#c8a878', { size: 256 }), { roughness: 0.3 })],
      [ball(0.16, 0, 0.72, 0, 20).scale(1, 1.1, 1), MAT.gold('#e8b84a')],
      [new THREE.BoxGeometry(0.4, 0.22, 0.12).translate(0, 0.66, -0.06), MAT.lacquer('#1d2f7a')],
    ]),
    ankh: () => {
      const s = new THREE.Shape(); s.moveTo(-0.05, 0); s.lineTo(0.05, 0); s.lineTo(0.05, 0.42); s.lineTo(0.2, 0.42); s.lineTo(0.2, 0.5); s.lineTo(0.05, 0.5); s.lineTo(-0.05, 0.5); s.lineTo(-0.2, 0.5); s.lineTo(-0.2, 0.42); s.lineTo(-0.05, 0.42); s.closePath();
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01 });
      return group([[new THREE.BoxGeometry(0.42, 0.08, 0.3).translate(0, 0.04, 0), MAT.lacquer('#1d2f7a')], [g.translate(0, 0.08, -0.03), MAT.gold()], [new THREE.TorusGeometry(0.1, 0.035, 8, 24).scale(1, 1.3, 1).translate(0, 0.72, 0), MAT.gold()]]);
    },
    scarab: () => group([
      [ball(0.22, 0, 0.12, 0, 24).scale(1, 0.55, 1.35), MAT.gem('#1d4aa8')],
      [new THREE.BoxGeometry(0.02, 0.06, 0.5).translate(0, 0.2, 0), MAT.gold()],
      [ball(0.1, 0, 0.1, 0.32, 14).scale(1.2, 0.6, 1), MAT.gold()],
      [new THREE.CylinderGeometry(0.4, 0.42, 0.06, 32).translate(0, 0.0, 0), MAT.gold('#e0b050')],
    ]),
    dates: () => { const p = [bowl(MAT.gold(), 0.5, 0.18)]; fruit(p, C('date', '#5a2a10', { roughness: 0.35, clearcoat: 0.6 }), 0.07, { y: 0.18, r: 0.26, n: 9, top: 5 }, 4); p.forEach((q, i) => { if (i && q[0].type === 'SphereGeometry') q[0].scale(1, 1, 1); }); return group(p); },
    amphora: () => group([[smoothLathe([[0, 0], [0.1, 0], [0.04, 0.1], [0.24, 0.45], [0.26, 0.7], [0.12, 0.98], [0.1, 1.08], [0.14, 1.12], [0, 1.12]], 32), C('terracotta', '#b8582a', { roughness: 0.6, clearcoat: 0.2 })], ...[-1, 1].map((s) => [K.tube([[s * 0.1, 1.04, 0], [s * 0.26, 1.02, 0], [s * 0.2, 0.82, 0]], 0.025, { segs: 10 }), C('terracotta', '#b8582a', { roughness: 0.6, clearcoat: 0.2 })])]),
    owl: () => group([
      [new THREE.CylinderGeometry(0.26, 0.3, 0.12, 24).translate(0, 0.06, 0), MAT.stone(TEX.marble('#e8dcc6', '#b0a48c', { size: 256 }), { roughness: 0.3 })],
      [ball(0.2, 0, 0.36, 0, 24).scale(1, 1.25, 0.9), MAT.bronze()],
      [ball(0.17, 0, 0.66, 0.02, 20), MAT.bronze()],
      [ball(0.055, -0.07, 0.68, 0.16, 10), MAT.gold()], [ball(0.055, 0.07, 0.68, 0.16, 10), MAT.gold()],
      [new THREE.ConeGeometry(0.05, 0.12, 6).translate(-0.12, 0.84, 0), MAT.bronze()], [new THREE.ConeGeometry(0.05, 0.12, 6).translate(0.12, 0.84, 0), MAT.bronze()],
    ]),
    olives: () => { const p = [bowl(C('olivewood', '#a8804a', { roughness: 0.5 }), 0.48, 0.16)]; fruit(p, C('olive', '#3a4a1a', { roughness: 0.25, clearcoat: 0.8 }), 0.06, { y: 0.16, r: 0.22, n: 10, top: 6 }, 7); return group(p); },
    scroll: () => group([[new THREE.CylinderGeometry(0.1, 0.1, 0.7, 20).rotateZ(Math.PI / 2).translate(0, 0.1, 0), MATTE('papyrus', '#e8d8b0')], ...[-0.38, 0.38].map((x) => [new THREE.CylinderGeometry(0.03, 0.03, 0.26, 10).rotateX(Math.PI / 2).translate(x, 0.1, 0), MAT.gold()]), [new THREE.BoxGeometry(0.03, 0.21, 0.21).translate(0.1, 0.1, 0), C('seal', '#8a1a1a')]]),
    // Rings of Saturn: a toy rocket, a glowing moon rock, a little satellite and a jar of stars
    rocket: () => group([
      [smoothLathe([[0, 0], [0.12, 0.02], [0.15, 0.2], [0.15, 0.6], [0.12, 0.8], [0.06, 0.95], [0, 1.0]], 32), C('rocket-w', '#f4f6fa', { roughness: 0.2, clearcoat: 1 })],
      ...[0, 1, 2].map((i) => [new THREE.BoxGeometry(0.02, 0.26, 0.14).translate(0, 0.13, 0.17).rotateY(i * TAU / 3), C('rocket-fin', '#d8343a', { roughness: 0.25, clearcoat: 1 })]),
      [ball(0.05, 0, 0.62, 0.135, 16).scale(1, 1, 0.5), C('rocket-port', '#7ae8ff', { emissive: '#3ad8ff', emissiveIntensity: 0.8, roughness: 0.1 })],
      [new THREE.ConeGeometry(0.08, 0.16, 16).rotateX(Math.PI).translate(0, -0.02, 0), C('rocket-flame', '#ffb040', { emissive: '#ff8a20', emissiveIntensity: 1.2, roughness: 0.4 })],
    ]),
    moonrock: () => {
      const g = new THREE.IcosahedronGeometry(0.26, 2), p = g.attributes.position, R = rng(61);
      for (let i = 0; i < p.count; i++) { const k = 0.85 + R() * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k); }
      g.computeVertexNormals(); g.translate(0, 0.2, 0);
      return group([[new THREE.CylinderGeometry(0.3, 0.34, 0.06, 32).translate(0, 0.03, 0), MAT.chrome()], [g, C('moonrock', '#8a96aa', { roughness: 0.9, clearcoat: 0, emissive: '#2a6a8a', emissiveIntensity: 0.25, flatShading: true })]]);
    },
    satellite: () => group([
      [new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8).translate(0, 0.2, 0), MAT.chrome()],
      [new THREE.BoxGeometry(0.2, 0.2, 0.2).translate(0, 0.5, 0), MAT.gold()],
      ...[-1, 1].map((s2) => [new THREE.BoxGeometry(0.42, 0.18, 0.015).translate(s2 * 0.33, 0.5, 0), C('panel', '#1a3a8a', { roughness: 0.2, metalness: 0.5, clearcoat: 1 })]),
      [new THREE.SphereGeometry(0.14, 20, 8, 0, TAU, 0, Math.PI / 3).rotateX(-Math.PI / 2).translate(0, 0.52, 0.16), MAT.chrome()],
      [new THREE.CylinderGeometry(0.22, 0.24, 0.04, 24).translate(0, 0.02, 0), MAT.lacquer('#14182a')],
    ]),
    starjar: () => {
      const parts = [[lathe([[0, 0], [0.2, 0], [0.22, 0.04], [0.22, 0.5], [0.16, 0.56], [0.16, 0.6], [0, 0.6]], 32), glassM('#e8f4ff')], [new THREE.CylinderGeometry(0.17, 0.17, 0.08, 24).translate(0, 0.64, 0), MAT.chrome()]];
      const R = rng(67), st = C('jarstar', '#fff4b0', { emissive: '#ffe070', emissiveIntensity: 1.4, roughness: 0.3 });
      for (let i = 0; i < 14; i++) { const a = R() * TAU, r = R() * 0.14; parts.push([new THREE.OctahedronGeometry(0.028 + R() * 0.02).translate(Math.cos(a) * r, 0.06 + R() * 0.4, Math.sin(a) * r), st]); }
      return group(parts);
    },
    // Burj Khalifa: an oyster with its pearl, binoculars for the view, an incense burner and tea
    oyster: () => group([
      [new THREE.SphereGeometry(0.3, 28, 10, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1, 0.35, 0.85).translate(0, 0.1, 0), C('shell-in', '#efe6f0', { roughness: 0.2, iridescence: 0.8, sheen: 0.6, sheenColor: new THREE.Color('#ffe0f0') })],
      [new THREE.SphereGeometry(0.3, 28, 10, 0, TAU, Math.PI / 2, Math.PI / 2).scale(1, 0.3, 0.85).rotateX(Math.PI + 1.1).translate(0, 0.22, -0.22), C('shell-out', '#8a8070', { roughness: 0.8 })],
      [ball(0.08, 0, 0.14, 0.02, 24), C('pearl-big', '#fbf7f0', { roughness: 0.15, clearcoat: 1, iridescence: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffe8f0') })],
    ]),
    binocs: () => group([
      ...[-1, 1].map((s2) => [new THREE.CylinderGeometry(0.075, 0.09, 0.34, 20).rotateX(Math.PI / 2).translate(s2 * 0.1, 0.1, 0), MAT.lacquer('#1a1a1e')]),
      ...[-1, 1].map((s2) => [K.ring(0.088, 0, 0.012).rotateX(Math.PI / 2).translate(s2 * 0.1, 0.1, 0.17), MAT.gold()]),
      [new THREE.BoxGeometry(0.08, 0.05, 0.12).translate(0, 0.12, 0), MAT.gold()],
    ]),
    burner: (ctx) => {
      const g = group([
        [smoothLathe([[0, 0], [0.16, 0], [0.12, 0.08], [0.1, 0.2], [0.22, 0.26], [0.24, 0.36], [0.2, 0.4], [0, 0.4]], 32), MAT.gold()],
        ...[0, 1, 2, 3].map((i) => [new THREE.BoxGeometry(0.03, 0.18, 0.03).translate(0.13, 0.48, 0).rotateY(i * Math.PI / 2 + Math.PI / 4), MAT.gold()]),
        [new THREE.ConeGeometry(0.2, 0.2, 4).rotateY(Math.PI / 4).translate(0, 0.66, 0), MAT.gold()],
        [ball(0.08, 0, 0.44, 0, 12), C('ember', '#ff8a3a', { emissive: '#ff5a10', emissiveIntensity: 1.4, roughness: 0.6 })],
      ]);
      return g;
    },
    teaglass: () => group([
      [new THREE.CylinderGeometry(0.34, 0.34, 0.03, 32).translate(0, 0.015, 0), MAT.gold()],
      ...[-1, 1].map((s2) => [smoothLathe([[0, 0], [0.07, 0], [0.06, 0.08], [0.05, 0.12], [0.07, 0.2], [0, 0.2]], 20), glassM('#e8b070')]).map(([g, m], i) => [g.translate(i ? 0.14 : -0.14, 0.03, 0), m]),
      [smoothLathe([[0, 0], [0.09, 0], [0.11, 0.08], [0.07, 0.18], [0.05, 0.24], [0, 0.26]], 24).translate(0, 0.03, -0.16), MAT.gold()],
    ]),
    // Dinosaur Valley: a nest of eggs, an ammonite fossil and a lamp of glowing amber
    nest: () => {
      const p = [[new THREE.TorusGeometry(0.34, 0.1, 10, 28).rotateX(Math.PI / 2).scale(1, 0.6, 1).translate(0, 0.07, 0), MATTE('twigs', '#7a5a34')], [new THREE.CylinderGeometry(0.3, 0.28, 0.06, 24).translate(0, 0.03, 0), MATTE('twigs2', '#6a4a2a')]];
      for (const [x, z, r] of [[-0.1, 0.05, 1], [0.12, -0.04, 0.95], [0.0, -0.14, 0.9]]) p.push([ball(0.12 * r, x, 0.17, z, 20).scale(1, 1.3, 1).translate(0, -0.05, 0), C('eggshell', '#f0e4cc', { roughness: 0.5 })]);
      return group(p);
    },
    ammonite: () => {
      const pts = []; for (let i = 0; i <= 60; i++) { const t = i / 60, a = t * TAU * 2.4, r = 0.03 + 0.24 * t; pts.push([Math.cos(a) * r, Math.sin(a) * r + 0.33, 0]); }
      return group([[new THREE.BoxGeometry(0.62, 0.08, 0.36).translate(0, 0.04, 0), C('ammo-stone', '#8a7a64', { roughness: 0.9 })],
        [K.tube(pts, 0.03, { segs: 90, radial: 8, radiusAt: (t) => K.mix(0.5, 2, t) }).rotateX(-0.25), C('ammo', '#c8a878', { roughness: 0.4, clearcoat: 0.6 })],
        [new THREE.CylinderGeometry(0.2, 0.22, 0.04, 20).translate(0, 0.1, 0), C('ammo-stone', '#8a7a64', { roughness: 0.9 })]]);
    },
    amberlamp: () => group([
      [lathe([[0, 0], [0.2, 0], [0.18, 0.06], [0.08, 0.1], [0, 0.1]], 24), MAT.bronze()],
      [new THREE.OctahedronGeometry(0.16, 1).scale(1, 1.6, 1).translate(0, 0.32, 0), C('amberlamp', '#ffb040', { roughness: 0.1, emissive: '#ff8a10', emissiveIntensity: 1.1 })],
      ...[0, 1, 2].map((i) => [K.tube([[0.16, 0.06, 0], [0.12, 0.3, 0.02], [0.02, 0.52, 0.0]], 0.02, { segs: 10, radial: 6 }).rotateY(i * TAU / 3), MATTE('bonecl', '#efe2c6')]),
    ]),
    // Enchanted Forest: toadstools, a fairy lantern and a little pile of acorns
    mushrooms: () => {
      const p = [[new THREE.CylinderGeometry(0.4, 0.42, 0.06, 20).translate(0, 0.03, 0), MATTE('mossbed', '#4a6a24')]];
      for (const [x, z, h, r, c] of [[-0.14, 0.05, 0.3, 0.17, '#c83a2a'], [0.14, -0.05, 0.22, 0.13, '#a858d8'], [0.04, 0.17, 0.15, 0.09, '#c83a2a']]) {
        p.push([new THREE.CylinderGeometry(r * 0.3, r * 0.4, h, 12).translate(x, h / 2 + 0.05, z), C('stem', '#f2ead8')]);
        p.push([new THREE.SphereGeometry(r, 20, 10, 0, TAU, 0, Math.PI / 2).scale(1, 0.7, 1).translate(x, h + 0.04, z), C('cap' + c, c, { emissive: c, emissiveIntensity: 0.25 })]);
        for (let i = 0; i < 5; i++) p.push([ball(r * 0.13, x + Math.cos(i * 1.3) * r * 0.6, h + 0.04 + r * 0.45, z + Math.sin(i * 1.3) * r * 0.6, 8), C('spot', '#ffffff')]);
      }
      return group(p);
    },
    fairylamp: () => group([
      [lathe([[0, 0], [0.16, 0], [0.12, 0.05], [0.1, 0.06], [0, 0.06]], 20), MAT.gold()],
      [new THREE.CylinderGeometry(0.12, 0.12, 0.34, 6, 1, true).translate(0, 0.23, 0), glassM('#f0fff0')],
      [new THREE.ConeGeometry(0.16, 0.16, 6).translate(0, 0.48, 0), MAT.gold()],
      [K.ring(0.05, 0.6, 0.012).rotateX(Math.PI / 2), MAT.gold()],
      ...[[0, 0.2, 0], [0.04, 0.27, 0.03], [-0.04, 0.16, -0.02]].map(([x, y, z]) => [ball(0.022, x, y, z, 10), C('firefly', '#d8ff8a', { emissive: '#aaff4a', emissiveIntensity: 2 })]),
    ]),
    acorns: () => {
      const p = [[lathe([[0, 0], [0.34, 0], [0.38, 0.06], [0, 0.06]], 24), C('leafdish', '#5a8a2a', { roughness: 0.5 })]];
      const R = rng(29);
      for (let i = 0; i < 6; i++) { const a = i * 1.1, r = 0.06 + (i % 3) * 0.08, x = Math.cos(a) * r, z = Math.sin(a) * r; p.push([ball(0.06, x, 0.12, z, 14).scale(1, 1.25, 1).translate(0, -0.03, 0), C('acorn', '#a8703a', { roughness: 0.45 })]); p.push([new THREE.SphereGeometry(0.065, 14, 6, 0, TAU, 0, Math.PI / 2).translate(x, 0.15 + R() * 0.01, z), MATTE('acorncap', '#6a4a2a')]); }
      return group(p);
    },
    // Fjord of the Longships: a toy longship, a little runestone and a round shield
    longship: () => {
      const hull = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 16, 4, true, Math.PI / 2, Math.PI), hp = hull.attributes.position;
      for (let i = 0; i < hp.count; i++) { const t = hp.getY(i) / 0.45, f = Math.cos(t * Math.PI / 2) * 0.9 + 0.1; hp.setX(i, hp.getX(i) * f); hp.setZ(i, hp.getZ(i) * f); }
      hull.rotateZ(Math.PI / 2); hull.computeVertexNormals(); hull.translate(0, 0.2, 0);
      return group([
        [hull, C('shipwood', '#6a4626', { roughness: 0.6, side: THREE.DoubleSide })],
        ...[-1, 1].map((sd) => [K.tube([[sd * 0.43, 0.2, 0], [sd * 0.5, 0.33, 0], [sd * 0.46, 0.42, 0], [sd * 0.4, 0.4, 0]], 0.02, { segs: 10, radial: 6 }), C('shipwood', '#6a4626', { roughness: 0.6, side: THREE.DoubleSide })]),
        [new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6).translate(0, 0.42, 0), MATTE('mast', '#5a3a1e')],
        [new THREE.PlaneGeometry(0.4, 0.3).translate(0, 0.5, 0.01), C('sail', '#e8dcc0', { side: THREE.DoubleSide, roughness: 0.8, map: TEX.stone('#c83a2a', '#e8dcc0', { scale: 1 }) })],
        ...[-0.24, -0.08, 0.08, 0.24].map((x) => [new THREE.CylinderGeometry(0.045, 0.045, 0.012, 12).rotateX(Math.PI / 2).translate(x, 0.24, 0.12), MAT.gold()]),
      ]);
    },
    runestone: () => group([
      [new THREE.CylinderGeometry(0.16, 0.22, 0.6, 6).scale(1, 1, 0.5).translate(0, 0.3, 0), MATTE('rstone', '#7a7a76')],
      ...[0, 1, 2, 3].map((i) => [new THREE.BoxGeometry(0.02, 0.07, 0.01).rotateZ(i % 2 ? 0.5 : 0).translate(0, 0.14 + i * 0.1, 0.11), C('runeglow', '#9ae0ff', { emissive: '#3ab8ff', emissiveIntensity: 1.4 })]),
    ]),
    shieldprop: () => {
      const g = new THREE.CylinderGeometry(0.34, 0.34, 0.05, 32).translate(0, 0.03, 0);
      return group([[g, C('shieldblue', '#22346a', { roughness: 0.5 })], [K.ring(0.34, 0.055, 0.02), MAT.gold()], [ball(0.08, 0, 0.06, 0, 16).scale(1, 0.5, 1), MAT.gold()],
        ...[0, 1, 2, 3].map((i) => [new THREE.BoxGeometry(0.62, 0.012, 0.03).rotateY(i * Math.PI / 4).translate(0, 0.06, 0), MAT.gold()])]);
    },
    // Longhouse Gate: a carved dragon head from a ship's prow, and a loaf of bread on a board
    dragonhead: () => {
      const neck = []; for (let i = 0; i <= 12; i++) { const t = i / 12; neck.push([0, 0.08 + t * 0.5, Math.sin(t * 2.4) * 0.16]); }
      return group([
        [new THREE.BoxGeometry(0.44, 0.08, 0.3).translate(0, 0.04, 0), C('dwood', '#6a4626', { roughness: 0.6 })],
        [K.tube(neck, 0.09, { segs: 24, radial: 10, radiusAt: (t) => K.mix(1, 0.75, t) }), C('dwood', '#6a4626', { roughness: 0.6 })],
        [ball(0.11, 0, 0.62, 0.22, 16).scale(0.9, 0.9, 1.4).translate(0, 0.06, 0.1), C('dwood', '#6a4626', { roughness: 0.6 })],
        ...[-1, 1].map((sd) => [new THREE.ConeGeometry(0.03, 0.14, 6).rotateX(-0.6).translate(sd * 0.06, 0.76, 0.18), C('dwood', '#6a4626', { roughness: 0.6 })]),
        ...[-1, 1].map((sd) => [ball(0.02, sd * 0.07, 0.7, 0.33, 8), MAT.gold()]),
      ]);
    },
    bread: () => group([
      [new THREE.BoxGeometry(0.62, 0.05, 0.36).translate(0, 0.025, 0), C('breadboard', '#8a5a30', { roughness: 0.7 })],
      [ball(0.2, -0.04, 0.1, 0, 20).scale(1.3, 0.55, 0.9), C('loaf', '#c88a48', { roughness: 0.6 })],
      [ball(0.07, 0.2, 0.08, 0.08, 12).scale(1, 0.6, 1), C('cheesewheel', '#f0d070', { roughness: 0.5 })],
    ]),
    // Norse Fireside: an iron helmet with a nose guard, a drinking horn, nuts in a wooden bowl
    // and fat candles on a plank
    // the Twin Realms: an elven crystal lamp and an orc's horned iron helmet
    elflamp: () => group([
      [smoothLathe([[0, 0], [0.22, 0], [0.18, 0.06], [0.06, 0.14], [0.04, 0.5], [0.08, 0.56], [0, 0.58]], 32), MAT.gold('#e8c060')],
      ...[0, 1, 2].map((i) => [K.tube([[0, 0.5, 0], [0.1, 0.62, 0], [0.06, 0.82, 0]], 0.012, { segs: 10 }).rotateY(i * TAU / 3), MAT.gold('#e8c060')]),
      [new THREE.OctahedronGeometry(1, 0).scale(0.09, 0.2, 0.09).translate(0, 0.76, 0), C('elfcrystal', '#7ac8ff', { emissive: '#2a8aff', emissiveIntensity: 1.2, roughness: 0.05, clearcoat: 1 })],
    ]),
    orchelm: () => group([
      [new THREE.SphereGeometry(0.3, 28, 14, 0, TAU, 0, Math.PI / 2).scale(1, 1.1, 1.05).translate(0, 0.04, 0), C('orciron', '#4a4c52', { metalness: 0.85, roughness: 0.45 })],
      [K.ring(0.31, 0.06, 0.03), MAT.bronze()],
      ...[-1, 1].map((x) => [K.tube([[x * 0.26, 0.2, 0], [x * 0.42, 0.34, 0.02], [x * 0.46, 0.56, -0.04], [x * 0.4, 0.66, -0.08]], 0.05, { segs: 16, radiusAt: (t) => 1 - t * 0.85 }), C('orchorn', '#e8dcc0', { roughness: 0.35, clearcoat: 0.6 })]),
      ...[0, 1, 2].map((i) => [new THREE.ConeGeometry(0.035, 0.12, 6).translate((i - 1) * 0.1, 0.38, 0.0), C('orciron', '#4a4c52', { metalness: 0.85, roughness: 0.45 })]),
    ]),
    // the Floating Isles: a toy hot-air balloon and a shadow orb on a claw stand
    balloon: () => group([
      [new THREE.CylinderGeometry(0.2, 0.24, 0.04, 24).translate(0, 0.02, 0), MAT.gold('#f0c050')],
      [new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8).translate(0, 0.17, 0), MAT.gold('#f0c050')],
      [new THREE.CylinderGeometry(0.1, 0.08, 0.09, 12).translate(0, 0.38, 0), C('basket', '#a8642a', { roughness: 0.7 })],
      ...[0, 1, 2, 3].map((i) => [new THREE.CylinderGeometry(0.005, 0.005, 0.18, 4).translate(0.08, 0.5, 0).rotateY(i * Math.PI / 2), MAT.gold('#f0c050')]),
      [smoothLathe([[0.04, 0.58], [0.16, 0.66], [0.28, 0.84], [0.28, 1.0], [0.18, 1.14], [0, 1.18]], 12), C('balloon', '#2a4ab8', { roughness: 0.3, clearcoat: 1 })],
      [K.ring(0.28, 0.92, 0.02, { seg: 40 }), C('balloonstripe', '#f0c050', { roughness: 0.3, clearcoat: 1 })],
    ]),
    shadoworb: () => group([
      [new THREE.CylinderGeometry(0.2, 0.24, 0.06, 6).translate(0, 0.03, 0), C('shadowstone', '#2a2232', { roughness: 0.5, clearcoat: 0.5 })],
      ...[0, 1, 2].map((i) => [K.tube([[0.16, 0.06, 0], [0.18, 0.24, 0], [0.08, 0.36, 0]], 0.02, { segs: 10, radiusAt: (t) => 1 - t * 0.6 }).rotateY(i * TAU / 3), C('shadowclaw', '#e8dcc8', { roughness: 0.35, clearcoat: 0.6 })]),
      [ball(0.16, 0, 0.36, 0, 24), C('shadoworb', '#c890ff', { emissive: '#8a20ff', emissiveIntensity: 1.1, roughness: 0.1, clearcoat: 1 })],
    ]),
    // the Starship Deck: a glowing globe of a planet and a little model starship on its stand
    hologlobe: () => group([
      [new THREE.CylinderGeometry(0.22, 0.26, 0.08, 6).translate(0, 0.04, 0), MAT.chrome()],
      [K.ring(0.2, 0.085, 0.012), C('holoring', '#5ab8ff', { emissive: '#1a8aff', emissiveIntensity: 1.4, roughness: 0.3 })],
      [ball(0.22, 0, 0.42, 0, 28), C('holoplanet', '#3a8aff', { emissive: '#1a5aff', emissiveIntensity: 0.6, roughness: 0.2, transparent: true, opacity: 0.75 })],
      [K.ring(0.34, 0, 0.012, { seg: 48 }).rotateX(0.4).translate(0, 0.42, 0), C('holoring', '#5ab8ff', { emissive: '#1a8aff', emissiveIntensity: 1.4, roughness: 0.3 })],
    ]),
    modelship: () => group([
      [new THREE.CylinderGeometry(0.2, 0.22, 0.04, 6).translate(0, 0.02, 0), MAT.lacquer('#14182a')],
      [new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8).translate(0, 0.2, 0), MAT.chrome()],
      [new THREE.ConeGeometry(0.07, 0.6, 16).rotateX(Math.PI / 2).rotateY(0.6).translate(0, 0.42, 0), C('shiphull', '#f2f4f8', { roughness: 0.2, clearcoat: 1 })],
      [new THREE.BoxGeometry(0.5, 0.012, 0.18).rotateY(0.6).translate(0, 0.41, 0), C('shipwing', '#1c2c6a', { roughness: 0.25, clearcoat: 1 })],
      [ball(0.045, 0, 0, 0, 12).translate(-Math.sin(0.6) * 0.3, 0.42, -Math.cos(0.6) * 0.3), C('shipglow', '#7ac8ff', { emissive: '#2a8aff', emissiveIntensity: 1.6, roughness: 0.3 })],
    ]),
    norsehelm: () => group([
      [new THREE.SphereGeometry(0.32, 32, 16, 0, TAU, 0, Math.PI / 2).scale(1, 1.15, 1.05).translate(0, 0.06, 0), C('iron', '#5a5a5e', { metalness: 0.85, roughness: 0.45 })],
      [K.ring(0.33, 0.07, 0.03), MAT.bronze()],
      [new THREE.BoxGeometry(0.05, 0.42, 0.04).translate(0, 0.32, 0.33), MAT.bronze()],
      [new THREE.BoxGeometry(0.66, 0.05, 0.04).rotateY(Math.PI / 2).translate(0, 0.38, 0), MAT.bronze()],
      [new THREE.BoxGeometry(0.66, 0.05, 0.04).translate(0, 0.38, 0), MAT.bronze()],
    ]),
    horn: () => {
      const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([Math.sin(t * 1.6) * 0.42 - 0.2, 0.1 + t * 0.32 + Math.sin(t * Math.PI) * 0.08, 0]); }
      return group([
        [K.tube(pts, 0.11, { segs: 32, radial: 16, radiusAt: (t) => K.mix(0.22, 1, t) }), C('horn', '#d8c49a', { roughness: 0.45, clearcoat: 0.5 })],
        [K.ring(0.105, 0, 0.018).rotateZ(-1.0).translate(pts[16][0], pts[16][1], 0), MAT.bronze()],
        [new THREE.BoxGeometry(0.06, 0.1, 0.06).translate(-0.05, 0.05, 0), MAT.bronze()], [new THREE.BoxGeometry(0.06, 0.1, 0.06).translate(0.12, 0.05, 0), MAT.bronze()],
      ]);
    },
    nuts: () => {
      const p = [bowl(C('turned', '#7a4a26', { roughness: 0.6, clearcoat: 0.2 }), 0.5, 0.18)];
      fruit(p, C('hazel', '#8a5428', { roughness: 0.5 }), 0.065, { y: 0.16, r: 0.24, n: 9, top: 5 }, 13);
      fruit(p, C('walnut-shell', '#b8946a', { roughness: 0.8 }), 0.08, { y: 0.22, r: 0.12, n: 3, top: 1 }, 17);
      return group(p);
    },
    candles: (ctx) => {
      const g = group([[new THREE.BoxGeometry(0.9, 0.06, 0.5).translate(0, 0.03, 0), C('plank', '#5a3a20', { roughness: 0.8 })]]);
      for (const [x, z, h] of [[-0.28, 0, 0.5], [0.02, -0.08, 0.72], [0.28, 0.06, 0.4]]) {
        const c = candle(x, 0.06, z, h, ctx.flames); c.children[0].scale.set(1.6, 1, 1.6); g.add(c);
      }
      return g;
    },
    // Temple of Poseidon: a lyre of tortoiseshell and horn, a dish of figs, and a trident
    lyre: () => group([
      [new THREE.SphereGeometry(0.2, 24, 12).scale(1.1, 0.5, 1).translate(0, 0.1, 0), C('tortoise', '#6a4220', { roughness: 0.35, clearcoat: 0.8 })],
      [K.tube([[-0.14, 0.12, 0], [-0.22, 0.4, 0], [-0.16, 0.66, 0]], 0.025, { segs: 16, radial: 8 }), C('lyrehorn', '#e8dcc0', { roughness: 0.4 })],
      [K.tube([[0.14, 0.12, 0], [0.22, 0.4, 0], [0.16, 0.66, 0]], 0.025, { segs: 16, radial: 8 }), C('lyrehorn', '#e8dcc0', { roughness: 0.4 })],
      [new THREE.CylinderGeometry(0.02, 0.02, 0.42, 8).rotateZ(Math.PI / 2).translate(0, 0.66, 0), MAT.bronze()],
      ...[-0.09, -0.03, 0.03, 0.09].map((x) => [new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4).translate(x, 0.4, 0.02), MAT.gold()]),
    ]),
    figs: () => { const p = [bowl(C('redware', '#a84a24', { roughness: 0.6 }), 0.5, 0.15)]; fruit(p, C('fig', '#4a2a4a', { roughness: 0.45, sheen: 0.5, sheenColor: new THREE.Color('#a87ab0') }), 0.08, { y: 0.15, r: 0.22, n: 8, top: 4 }, 23); return group(p); },
    trident: () => group([
      [new THREE.CylinderGeometry(0.15, 0.18, 0.08, 20).translate(0, 0.04, 0), C('marble-foot', '#ece6da', { roughness: 0.4 })],
      [new THREE.CylinderGeometry(0.02, 0.02, 1.2, 8).translate(0, 0.64, 0), MAT.bronze()],
      [new THREE.BoxGeometry(0.34, 0.035, 0.035).translate(0, 1.18, 0), MAT.bronze()],
      ...[-0.15, 0, 0.15].map((x) => [new THREE.ConeGeometry(0.03, 0.22, 6).translate(x, 1.3, 0), MAT.bronze()]),
    ]),
    helmet: () => group([
      [new THREE.CylinderGeometry(0.3, 0.32, 0.08, 24).translate(0, 0.04, 0), MAT.lacquer('#3a1416')],
      [new THREE.SphereGeometry(0.3, 32, 16, 0, TAU, 0, Math.PI / 2).scale(1, 1.1, 1.1).translate(0, 0.08, 0), MAT.bronze()],
      [new THREE.BoxGeometry(0.06, 0.32, 0.62).translate(0, 0.46, 0), C('crest', '#9a1a1a', { roughness: 0.8 })],
      [new THREE.BoxGeometry(0.62, 0.05, 0.05).translate(0, 0.2, 0.3), MAT.gold()],
    ]),
    laurel: () => {
      const parts = [], leaf = MAT.gold('#e8c060');
      for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 1.7 + 0.3, r = 0.32; parts.push([ball(0.05, Math.cos(a) * r, 0.04, Math.sin(a) * r, 8).scale(1, 0.3, 2.2).rotateY(0).translate(0, 0, 0), leaf]); }
      parts.push([new THREE.TorusGeometry(0.32, 0.012, 6, 40, Math.PI * 1.7).rotateX(Math.PI / 2).rotateY(0.3).translate(0, 0.04, 0), leaf]);
      return group([[cushion('#4a1426', 0.8)[0][0], MAT.velvet('#4a1426')], ...parts.map(([g, m]) => [g.translate(0, 0.2, 0), m])]);
    },
    coins: () => { const p = []; const gold = MAT.gold(); for (let i = 0; i < 9; i++) p.push([new THREE.CylinderGeometry(0.1, 0.1, 0.025, 20).translate((i % 3 - 1) * 0.08, (i / 3 | 0) * 0.026 + 0.013 + (i % 3) * 0.026 * 3, ((i / 3) | 0) * 0.16 - 0.16), gold]); p.push([new THREE.CylinderGeometry(0.1, 0.1, 0.025, 20).rotateX(1.2).translate(0.26, 0.1, 0.1), gold]); return group(p); },
    diya: () => {
      const brass = MAT.brass(), parts = [[lathe([[0, 0], [0.24, 0], [0.22, 0.05], [0.07, 0.1], [0.06, 0.5], [0.3, 0.56], [0.32, 0.62], [0, 0.62]], 28), brass]];
      const lamp = new THREE.Group(); group(parts).children.forEach((c) => lamp.add(c));
      return lamp;
    },
    rosewater: () => group([[smoothLathe([[0, 0], [0.18, 0], [0.1, 0.08], [0.24, 0.3], [0.2, 0.45], [0.05, 0.6], [0.035, 1.0], [0.06, 1.04], [0, 1.08]], 28), MAT.silver()]]),
    pomegranates: () => { const p = [bowl(MAT.gold(), 0.5, 0.18)]; fruit(p, C('pom', '#a8142a', { roughness: 0.35, clearcoat: 0.6 }), 0.13, { y: 0.16, r: 0.22, n: 5, top: 1 }, 3); return group(p); },
    jewelbox: () => group([
      [new THREE.BoxGeometry(0.62, 0.32, 0.42).translate(0, 0.16, 0), MAT.stone(TEX.marble('#f4f0e8', '#c8c0b0', { size: 256 }), { roughness: 0.2 })],
      [new THREE.BoxGeometry(0.66, 0.1, 0.46).translate(0, 0.37, 0), MAT.gold()],
      ...[[-0.18, '#c8142e'], [0, '#12905a'], [0.18, '#1d4aa8']].map(([x, c]) => [ball(0.04, x, 0.22, 0.215, 10), MAT.gem(c)]),
    ]),
    lantern: () => {
      const red = C('lantern', '#c8201a', { roughness: 0.5, emissive: '#ff6a2a', emissiveIntensity: 0.6, transparent: true, opacity: 0.95 });
      return group([[new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8).translate(0.0, 0.8, 0), MAT.lacquer('#2a120c')], [ball(0.32, 0, 1.3, 0, 24).scale(1, 0.85, 1), red], [new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16).translate(0, 1.6, 0), MAT.gold()], [new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16).translate(0, 1.0, 0), MAT.gold()], [new THREE.CylinderGeometry(0.22, 0.26, 0.06, 20).translate(0, 0.03, 0), MAT.lacquer('#2a120c')]]);
    },
    vase: () => group([[smoothLathe([[0, 0], [0.18, 0], [0.16, 0.06], [0.3, 0.4], [0.28, 0.66], [0.1, 0.9], [0.1, 1.0], [0.16, 1.06], [0, 1.06]], 36), new THREE.MeshPhysicalMaterial({ map: H.blueAndWhite ? H.blueAndWhite() : null, color: '#f4f4f8', roughness: 0.15, clearcoat: 1 })]]),
    teapot: () => {
      const m = porcelain(), blue = C('glaze', '#2a4a8a', { roughness: 0.15, clearcoat: 1 });
      const parts = [[smoothLathe([[0, 0], [0.22, 0], [0.32, 0.12], [0.34, 0.26], [0.24, 0.42], [0.08, 0.46], [0, 0.46]], 32), m], [ball(0.05, 0, 0.52, 0, 10), blue],
        [K.tube([[0.28, 0.18, 0], [0.46, 0.26, 0], [0.56, 0.42, 0]], 0.05, { segs: 10 }), m], [new THREE.TorusGeometry(0.14, 0.03, 8, 20, Math.PI * 1.3).rotateZ(-0.6).translate(-0.34, 0.26, 0), m],
        [K.ring(0.31, 0.2, 0.012), blue]];
      for (const [x, z] of [[0.45, 0.42], [-0.15, 0.5]]) parts.push([lathe([[0, 0], [0.1, 0], [0.13, 0.12], [0.12, 0.13], [0, 0.04]], 24).translate(x, 0, z), m]);
      return group(parts);
    },
    peaches: () => { const p = [bowl(C('celadon', '#9ac0a8', { roughness: 0.2, clearcoat: 1 }), 0.5, 0.18)]; fruit(p, C('peach', '#f0a080', { roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color('#ffd0c0') }), 0.12, { y: 0.16, r: 0.22, n: 5, top: 1 }, 6); return group(p); },
    mask: () => {
      const g = new THREE.SphereGeometry(0.3, 32, 16, 0, Math.PI, 0.6, 1.4).rotateY(-Math.PI / 2).scale(1, 0.75, 0.6);
      return group([[g.rotateX(-0.9).translate(0, 0.32, 0), C('mask', '#f4ecd8', { roughness: 0.3 })], [new THREE.TorusGeometry(0.3, 0.02, 6, 40, Math.PI).rotateX(-0.9).translate(0, 0.32, 0), MAT.gold()], [K.tube([[0.25, 0.3, 0], [0.5, 0.5, -0.1], [0.62, 0.9, -0.2]], 0.015, { segs: 10 }), MAT.gold()], [ball(0.08, 0.62, 0.95, -0.2, 10).scale(0.5, 2, 0.5), C('plume', '#c81e4a', { roughness: 0.8 })], [new THREE.BoxGeometry(0.62, 0.04, 0.46).translate(0, 0.02, 0), MAT.velvet('#14347c')]]);
    },
    gondola: () => {
      const black = MAT.lacquer('#0c0c10'), hull = new THREE.SphereGeometry(0.2, 24, 12).scale(4.2, 0.6, 1);
      return group([[hull.translate(0, 0.12, 0), black], [K.tube([[0.7, 0.12, 0], [0.85, 0.3, 0], [0.9, 0.5, 0]], 0.03, { segs: 10 }), black], [new THREE.BoxGeometry(0.06, 0.12, 0.14).translate(0.9, 0.55, 0), MAT.silver()], [new THREE.BoxGeometry(0.3, 0.14, 0.24).translate(0.1, 0.24, 0), MAT.velvet('#6a0c22')], [new THREE.BoxGeometry(1.4, 0.04, 0.5).translate(0, 0.02, 0), MAT.lacquer('#14347c')]]);
    },
    goblet: () => group([[lathe([[0, 0], [0.18, 0], [0.16, 0.03], [0.03, 0.08], [0.025, 0.36], [0.16, 0.44], [0.2, 0.62], [0.19, 0.62], [0.15, 0.46], [0, 0.42]], 32), glassM('#a8c8e8')], [K.ring(0.19, 0.6, 0.012), MAT.gold()]]),
    macarons: () => {
      const parts = [[lathe([[0, 0], [0.3, 0], [0.3, 0.03], [0, 0.03]], 32), MAT.silver()], [new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8).translate(0, 0.45, 0), MAT.silver()]];
      const cols = ['#f0a8c0', '#a8d8b0', '#f4d888', '#c8a8e8', '#f8c8a0', '#a8c8f0'];
      for (let t = 0; t < 4; t++) { const r = 0.28 - t * 0.06, y = 0.06 + t * 0.2, n = Math.max(3, 7 - t); for (let i = 0; i < n; i++) { const a = i / n * TAU; parts.push([new THREE.CylinderGeometry(0.07, 0.07, 0.07, 16).translate(Math.cos(a) * r, y, Math.sin(a) * r), C('mac' + ((t + i) % 6), cols[(t + i) % 6], { roughness: 0.6 })]); } }
      return group(parts);
    },
    perfume: () => group([[lathe([[0, 0], [0.2, 0], [0.24, 0.1], [0.2, 0.34], [0.06, 0.4], [0.05, 0.46], [0, 0.46]], 6), glassM('#e8a8c8')], [ball(0.07, 0, 0.53, 0, 12), MAT.gem('#c81e5a')], [K.tube([[0.12, 0.3, 0], [0.3, 0.3, 0.05], [0.4, 0.2, 0.05]], 0.012, { segs: 8 }), MAT.gold()], [ball(0.07, 0.42, 0.18, 0.05, 10), C('bulb', '#c81e5a', { roughness: 0.7 })]]),
    croissants: () => { const p = [[lathe([[0, 0], [0.42, 0], [0.45, 0.04], [0, 0.04]], 32), porcelain()]]; for (let i = 0; i < 3; i++) { const g = new THREE.TorusGeometry(0.15, 0.07, 10, 20, Math.PI * 1.2); p.push([g.rotateX(Math.PI / 2).rotateY(i * 2.1).translate(Math.cos(i * 2.1) * 0.16, 0.1 + (i === 2 ? 0.08 : 0), Math.sin(i * 2.1) * 0.16), C('croissant', '#c8802a', { roughness: 0.5, clearcoat: 0.5 })]); } return group(p); },
    egg: () => group([[lathe([[0, 0], [0.18, 0], [0.04, 0.1], [0.04, 0.24], [0.12, 0.28], [0, 0.28]], 24), MAT.gold()], [smoothLathe([[0, 0.28], [0.18, 0.34], [0.24, 0.5], [0.2, 0.7], [0.1, 0.8], [0, 0.82]], 32), C('enamel', '#1e5a8a', { roughness: 0.1, clearcoat: 1 })], [K.ring(0.235, 0.52, 0.02), MAT.gold()], ...[0, 1, 2, 3, 4, 5].map((i) => [ball(0.03, Math.cos(i) * 0.235, 0.52, Math.sin(i) * 0.235, 8), MAT.gem('#e8f0ff')]), [ball(0.04, 0, 0.84, 0, 10), MAT.gem('#c8142e')]]),
    samovar: () => group([[smoothLathe([[0, 0], [0.24, 0], [0.12, 0.1], [0.12, 0.2], [0.3, 0.3], [0.34, 0.6], [0.26, 0.8], [0.14, 0.86], [0.18, 0.94], [0, 0.98]], 32), MAT.brass()], [K.tube([[0.3, 0.3, 0], [0.45, 0.28, 0], [0.45, 0.22, 0]], 0.025, { segs: 8 }), MAT.brass()], ...[-1, 1].map((s) => [new THREE.TorusGeometry(0.1, 0.02, 6, 16, Math.PI).rotateY(Math.PI / 2).translate(0, 0.7, s * 0.34), MAT.brass()]), [lathe([[0, 0.98], [0.1, 0.98], [0.12, 1.1], [0, 1.12]], 20), porcelain()]]),
    cakes: () => {
      const parts = [], plate = porcelain();
      for (let t = 0; t < 3; t++) { const r = 0.42 - t * 0.1, y = t * 0.36; parts.push([lathe([[0, y], [r, y], [r, y + 0.03], [0, y + 0.03]], 32), plate]); for (let i = 0; i < 5 - t; i++) { const a = i / (5 - t) * TAU; parts.push([new THREE.CylinderGeometry(0.07, 0.07, 0.08, 16).translate(Math.cos(a) * r * 0.62, y + 0.07, Math.sin(a) * r * 0.62), C('cake' + ((t + i) % 3), ['#f0d0d8', '#f4ead6', '#7a3a24'][(t + i) % 3], { roughness: 0.6 })]); } }
      parts.push([new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8).translate(0, 0.4, 0), MAT.gold()]);
      return group(parts);
    },
    car: () => vintageCar('#7a1420'),
    car2: () => vintageCar('#14306a'),
    skyscraper: () => group([[new THREE.BoxGeometry(0.4, 1.0, 0.4).translate(0, 0.5, 0), MAT.chrome()], [new THREE.BoxGeometry(0.3, 0.3, 0.3).translate(0, 1.15, 0), MAT.chrome()], [new THREE.ConeGeometry(0.15, 0.5, 4).rotateY(Math.PI / 4).translate(0, 1.55, 0), MAT.gold()], [new THREE.BoxGeometry(0.62, 0.08, 0.62).translate(0, 0.04, 0), MAT.lacquer('#121214')]]),
    radio: () => {
      const s = new THREE.Shape(); s.moveTo(-0.3, 0); s.lineTo(0.3, 0); s.lineTo(0.3, 0.4); s.absarc(0, 0.4, 0.3, 0, Math.PI, false); s.lineTo(-0.3, 0);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02 }).translate(0, 0, -0.12);
      return group([[g, MAT.lacquer('#5a3418', { roughness: 0.3 })], [new THREE.CircleGeometry(0.2, 24).translate(0, 0.4, 0.15), MATTE('cloth', '#d8c8a0')], [new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12).rotateX(Math.PI / 2).translate(-0.15, 0.1, 0.15), MAT.gold()], [new THREE.CylinderGeometry(0.035, 0.035, 0.03, 12).rotateX(Math.PI / 2).translate(0.15, 0.1, 0.15), MAT.gold()]]);
    },
    bonsai: () => {
      const trunk = MATTE('bark', '#4a3424'), leaf = MATTE('pine', '#3a5a2a');
      return group([[new THREE.BoxGeometry(0.7, 0.16, 0.44).translate(0, 0.08, 0), C('pot', '#3a2a5a', { roughness: 0.3, clearcoat: 0.8 })], [K.tube([[0, 0.16, 0], [0.12, 0.4, 0], [-0.08, 0.62, 0], [0.1, 0.8, 0]], 0.05, { segs: 14 }), trunk], [ball(0.22, 0.18, 0.78, 0, 12).scale(1.5, 0.5, 1.1), leaf], [ball(0.16, -0.16, 0.62, 0.05, 12).scale(1.6, 0.5, 1.1), leaf], [ball(0.14, 0.05, 0.95, 0, 12).scale(1.4, 0.5, 1), leaf]]);
    },
    robot: () => group([[new THREE.BoxGeometry(0.3, 0.32, 0.22).translate(0, 0.28, 0), C('toy', '#e8eef4', { roughness: 0.25, clearcoat: 1 })], [new THREE.BoxGeometry(0.24, 0.2, 0.2).translate(0, 0.56, 0), C('toy', '#e8eef4', { roughness: 0.25, clearcoat: 1 })], [ball(0.03, -0.06, 0.58, 0.1, 8), MAT.emissive('#3fd8ff', 1.4)], [ball(0.03, 0.06, 0.58, 0.1, 8), MAT.emissive('#3fd8ff', 1.4)], [new THREE.CylinderGeometry(0.01, 0.01, 0.14, 6).translate(0, 0.72, 0), MAT.chrome()], [ball(0.025, 0, 0.8, 0, 8), MAT.emissive('#ff5a5a', 1.4)], ...[-1, 1].map((s) => [new THREE.BoxGeometry(0.1, 0.12, 0.16).translate(s * 0.08, 0.06, 0), MAT.chrome()]), ...[-1, 1].map((s) => [new THREE.CylinderGeometry(0.03, 0.03, 0.26, 8).rotateZ(s * 0.4).translate(s * 0.2, 0.28, 0), MAT.chrome()])]),
    blossom: () => {
      const parts = [[smoothLathe([[0, 0], [0.12, 0], [0.18, 0.2], [0.08, 0.5], [0.06, 0.62], [0, 0.62]], 24), C('ewer', '#1a1416', { roughness: 0.15, clearcoat: 1 })]];
      const R2 = rng(4), pink = C('sakura', '#ffc8d8', { roughness: 0.7, emissive: '#ffb0c8', emissiveIntensity: 0.1 }), bark = MATTE('branch', '#3a2a24');
      const branch = [[0, 0.55, 0], [0.12, 0.9, 0.05], [0.35, 1.25, 0.1], [0.6, 1.4, 0.05]];
      parts.push([K.tube(branch, 0.02, { segs: 16 }), bark]);
      for (let i = 0; i < 40; i++) { const t = 0.3 + R2() * 0.7, p = branch[Math.min(3, Math.floor(t * 3) + 1)]; parts.push([ball(0.04, p[0] + (R2() - 0.5) * 0.25, p[1] + (R2() - 0.5) * 0.2, p[2] + (R2() - 0.5) * 0.25, 6), pink]); }
      return group(parts);
    },
    chocbox: () => {
      const parts = [[new THREE.BoxGeometry(0.9, 0.12, 0.7).translate(0, 0.06, 0), C('box', '#6a0c22', { roughness: 0.4 })], [new THREE.BoxGeometry(0.92, 0.02, 0.06).translate(0, 0.12, 0), MAT.gold()]];
      const cols = ['#2a140a', '#5a2e14', '#e8d8b8', '#3a1a0c'];
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) parts.push([ball(0.08, -0.3 + i * 0.2, 0.18, -0.2 + j * 0.2, 12).scale(1, 0.7, 1), C('choc' + ((i + j) % 4), cols[(i + j) % 4], { roughness: 0.3, clearcoat: 0.8 })]);
      return group(parts);
    },
    chocpot: () => group([[smoothLathe([[0, 0], [0.18, 0], [0.24, 0.3], [0.2, 0.6], [0.12, 0.7], [0.14, 0.76], [0, 0.78]], 28), MAT.silver()], [K.tube([[0.2, 0.5, 0], [0.34, 0.6, 0], [0.4, 0.72, 0]], 0.03, { segs: 8 }), MAT.silver()], [new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8).rotateZ(Math.PI / 2).translate(-0.36, 0.42, 0), C('wood', '#3a2214')], [lathe([[0, 0], [0.1, 0], [0.12, 0.14], [0, 0.12]], 20).translate(0.42, 0, 0.3), porcelain()]]),
    truffles: () => { const p = [[lathe([[0, 0], [0.45, 0], [0.48, 0.04], [0, 0.04]], 32), MAT.gold()]]; fruit(p, C('truffle', '#3a1a0c', { roughness: 0.8 }), 0.08, { y: 0.04, r: 0.28, n: 8, top: 3 }, 10); return group(p); },
    waffles: () => { const p = [[lathe([[0, 0], [0.42, 0], [0.45, 0.04], [0, 0.04]], 32), porcelain()]]; for (let i = 0; i < 2; i++) p.push([new THREE.BoxGeometry(0.42, 0.08, 0.3).rotateY(i * 0.5).translate(0, 0.08 + i * 0.08, 0), C('waffle', '#d8a050', { roughness: 0.6 })]); p.push([new THREE.BoxGeometry(0.36, 0.02, 0.24).rotateY(0.5).translate(0, 0.21, 0), C('sugar', '#ffffff', { roughness: 0.9 })]); return group(p); },
    clam: () => group([[new THREE.SphereGeometry(0.34, 32, 12, 0, TAU, 0, Math.PI / 2).scale(1, 0.35, 0.9), C('shell', '#f0e2e0', { roughness: 0.3, clearcoat: 1, iridescence: 0.6 })], [new THREE.SphereGeometry(0.34, 32, 12, 0, TAU, 0, Math.PI / 2).scale(1, 0.35, 0.9).rotateX(-1.9).translate(0, 0.04, -0.28), C('shell', '#f0e2e0', { roughness: 0.3, clearcoat: 1, iridescence: 0.6 })], [ball(0.1, 0, 0.1, 0.02, 20), C('pearl', '#fffaf4', { roughness: 0.1, clearcoat: 1, iridescence: 0.8, sheen: 0.5 })]]),
    chest: () => group([[new THREE.BoxGeometry(0.62, 0.32, 0.42).translate(0, 0.16, 0), C('chest', '#6a4220', { roughness: 0.6 })], [new THREE.CylinderGeometry(0.21, 0.21, 0.62, 16, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-0.6).translate(0, 0.36, -0.08), C('chest', '#6a4220', { roughness: 0.6 })], ...[-0.24, 0.24].map((x) => [new THREE.BoxGeometry(0.05, 0.34, 0.44).translate(x, 0.17, 0), MAT.gold()]), ...[0, 1, 2, 3, 4].map((i) => [new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14).translate(-0.16 + i * 0.08, 0.34, 0.02 + (i % 2) * 0.06), MAT.gold()]), [ball(0.05, 0.1, 0.36, 0.1, 10), MAT.gem('#c8142e')]]),
    starfish: () => {
      const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + Math.PI / 2, r = i % 2 ? 0.12 : 0.36; (i ? s.lineTo : s.moveTo).call(s, Math.cos(a) * r, Math.sin(a) * r); } s.closePath();
      return group([[new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }).rotateX(-Math.PI / 2).translate(0, 0.04, 0), C('star', '#e8743a', { roughness: 0.7 })]]);
    },
    shells: () => { const p = []; const R2 = rng(5); for (let i = 0; i < 5; i++) { const a = i / 5 * TAU, r = 0.22; p.push([new THREE.ConeGeometry(0.08 + R2() * 0.04, 0.26, 12).rotateZ(Math.PI / 2 + (R2() - 0.5)).translate(Math.cos(a) * r, 0.07, Math.sin(a) * r), C('shell' + (i % 3), ['#f4e8d8', '#f0c8b8', '#e8d0f0'][i % 3], { roughness: 0.3, clearcoat: 0.8, iridescence: 0.4 })]); } return group(p); },
    elephant: () => {
      const g = MAT.brass(), parts = [[ball(0.3, 0, 0.42, 0, 24).scale(1.3, 0.9, 0.85), g], [ball(0.2, 0.42, 0.5, 0, 20), g], [K.tube([[0.55, 0.5, 0], [0.66, 0.3, 0], [0.62, 0.12, 0.02]], 0.05, { segs: 10 }), g]];
      for (const x of [-0.22, 0.22]) for (const z of [-0.14, 0.14]) parts.push([new THREE.CylinderGeometry(0.08, 0.09, 0.3, 12).translate(x, 0.15, z), g]);
      for (const z of [-1, 1]) parts.push([ball(0.16, 0.36, 0.52, z * 0.16, 12).scale(0.3, 1, 1), g]);
      parts.push([new THREE.BoxGeometry(0.34, 0.06, 0.5).translate(-0.02, 0.7, 0), C('saddle', '#a8142e', { roughness: 0.6 })]);
      return group(parts);
    },
    brasspot: () => group([[smoothLathe([[0, 0], [0.2, 0], [0.32, 0.2], [0.3, 0.4], [0.16, 0.54], [0.2, 0.6], [0, 0.6]], 32), MAT.brass()]]),
    marigolds: () => { const p = [[lathe([[0, 0], [0.4, 0], [0.42, 0.04], [0, 0.04]], 32), MAT.brass()]]; const o = C('marigold', '#f0901a', { roughness: 0.8 }); const y = C('marigold2', '#f4c01a', { roughness: 0.8 }); for (let i = 0; i < 24; i++) { const a = i * 2.4, r = Math.sqrt(i / 24) * 0.32; p.push([ball(0.07, Math.cos(a) * r, 0.1, Math.sin(a) * r, 10), i % 3 ? o : y]); } return group(p); },
    drum: () => group([[new THREE.CylinderGeometry(0.22, 0.2, 0.62, 24).rotateZ(Math.PI / 2).translate(0, 0.24, 0), C('drumwood', '#7a3a1a', { roughness: 0.5 })], ...[-0.31, 0.31].map((x) => [new THREE.CylinderGeometry(0.23, 0.23, 0.02, 24).rotateZ(Math.PI / 2).translate(x, 0.24, 0), MATTE('hide', '#e8d8b8')]), [K.tube([[-0.3, 0.44, 0], [0, 0.48, 0.22], [0.3, 0.44, 0]], 0.012, { segs: 12 }), C('cord', '#a8142e')]]),
    feathers: () => {
      const parts = [[smoothLathe([[0, 0], [0.14, 0], [0.2, 0.22], [0.1, 0.42], [0.08, 0.5], [0, 0.5]], 24), MAT.brass()]];
      const eye = C('peacock', '#1a6a6a', { roughness: 0.4, iridescence: 0.8 }), eye2 = C('peacock2', '#1d4aa8', { roughness: 0.3 });
      for (let i = 0; i < 5; i++) { const a = (i - 2) * 0.25; const top = [Math.sin(a) * 0.5, 1.5 - Math.abs(i - 2) * 0.08, Math.cos(a) * 0.05]; parts.push([K.tube([[0, 0.45, 0], [top[0] * 0.5, 1.0, 0], top], 0.008, { segs: 10 }), MATTE('quill2', '#d8c8a0')]); parts.push([ball(0.09, top[0], top[1], top[2], 12).scale(0.7, 1.2, 0.2), eye]); parts.push([ball(0.04, top[0], top[1], top[2] + 0.01, 10).scale(0.7, 1.2, 0.4), eye2]); }
      return group(parts);
    },
    mangoes: () => { const p = [bowl(MAT.brass(), 0.5, 0.18)]; fruit(p, C('mango', '#f0b028', { roughness: 0.4, clearcoat: 0.5 }), 0.12, { y: 0.16, r: 0.22, n: 5, top: 1 }, 2); p.forEach((q, i) => { if (i) q[0].scale(1, 1, 1); }); return group(p); },
    kite: () => {
      const s = new THREE.Shape(); s.moveTo(0, 0.5); s.lineTo(0.32, 0.1); s.lineTo(0, -0.5); s.lineTo(-0.32, 0.1); s.closePath();
      return group([[new THREE.ShapeGeometry(s).rotateX(-1.2).translate(0, 0.12, 0), K.material('decor-kite', () => new THREE.MeshStandardMaterial({ color: '#d8201a', side: THREE.DoubleSide, roughness: 0.7 }))], [K.tube([[0, 0.05, 0.45], [0.2, 0.02, 0.6], [0.1, 0.02, 0.8]], 0.008, { segs: 12 }), MAT.gold()], [new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12).translate(-0.4, 0.06, 0.3), C('spool', '#7a4a2a')]]);
    },
    cowbell: () => group([[smoothLathe([[0, 0.5], [0.12, 0.48], [0.16, 0.36], [0.22, 0.1], [0.26, 0.04], [0.24, 0.04], [0, 0.04]], 32), MAT.brass()], [new THREE.TorusGeometry(0.06, 0.015, 6, 16).translate(0, 0.54, 0), MAT.brass()], [new THREE.BoxGeometry(0.14, 0.18, 0.02).translate(0, 0.6, 0), C('strap', '#a8142e')], [new THREE.BoxGeometry(0.5, 0.04, 0.4).translate(0, 0.02, 0), C('wood2', '#8a5a30')]]),
    cuckoo: () => {
      const wood = C('cuckoo', '#5a3418', { roughness: 0.5 }), parts = [[new THREE.BoxGeometry(0.46, 0.5, 0.26).translate(0, 0.25, 0), wood], [new THREE.BoxGeometry(0.56, 0.04, 0.34).rotateZ(0.6).translate(-0.12, 0.6, 0), wood], [new THREE.BoxGeometry(0.56, 0.04, 0.34).rotateZ(-0.6).translate(0.12, 0.6, 0), wood], [new THREE.CircleGeometry(0.13, 24).translate(0, 0.27, 0.131), porcelain()], [new THREE.BoxGeometry(0.01, 0.1, 0.01).translate(0, 0.3, 0.135), MAT.lacquer('#111111')], [ball(0.04, 0, 0.5, 0.14, 10), C('bird', '#e8b84a')]];
      for (const x of [-0.08, 0.08]) parts.push([new THREE.CylinderGeometry(0.035, 0.03, 0.12, 4).translate(x, -0.02, 0.06), MAT.brass()]);
      return group(parts.map(([g, m]) => [g.translate(0, 0.1, 0), m]).concat([[new THREE.BoxGeometry(0.5, 0.06, 0.32).translate(0, 0.03, 0), wood]]));
    },
    cocoa: () => group([[lathe([[0, 0], [0.16, 0], [0.2, 0.3], [0.18, 0.31], [0, 0.04]], 28), C('mug', '#a8142e', { roughness: 0.2, clearcoat: 1 })], [new THREE.CircleGeometry(0.17, 24).rotateX(-Math.PI / 2).translate(0, 0.27, 0), C('cocoa', '#5a2a14', { roughness: 0.3 })], [ball(0.05, 0.05, 0.3, 0.03, 10), C('cream', '#ffffff', { roughness: 0.8 })], [ball(0.04, -0.04, 0.29, -0.03, 10), C('cream', '#ffffff', { roughness: 0.8 })], [new THREE.TorusGeometry(0.08, 0.02, 6, 16, Math.PI).rotateZ(-Math.PI / 2).translate(0.2, 0.16, 0), C('mug', '#a8142e', { roughness: 0.2, clearcoat: 1 })]]),
    cheese: () => group([[new THREE.CylinderGeometry(0.4, 0.4, 0.05, 32).translate(0, 0.025, 0), C('board2', '#c8a070', { roughness: 0.6 })], [new THREE.CylinderGeometry(0.3, 0.3, 0.22, 32, 1, false, 0, Math.PI * 1.6).translate(0, 0.16, 0), C('cheese', '#f0c860', { roughness: 0.7 })]]),
    falcon: () => group([[new THREE.CylinderGeometry(0.22, 0.26, 0.1, 24).translate(0, 0.05, 0), MAT.lacquer('#121214')], [new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8).translate(0, 0.25, 0), MAT.gold()], [ball(0.14, 0, 0.5, 0, 20).scale(0.8, 1.3, 1), MAT.gold()], [ball(0.08, 0, 0.72, 0.04, 16), MAT.gold()], [new THREE.ConeGeometry(0.03, 0.08, 6).rotateX(Math.PI / 2 + 0.6).translate(0, 0.7, 0.12), MAT.gold()], ...[-1, 1].map((s) => [ball(0.12, s * 0.12, 0.5, -0.04, 12).scale(0.3, 1.6, 0.8), MAT.gold()])]),
    dallah: () => group([[smoothLathe([[0, 0], [0.18, 0], [0.22, 0.2], [0.12, 0.42], [0.1, 0.5], [0.16, 0.56], [0.08, 0.68], [0.04, 0.78], [0, 0.8]], 32), MAT.gold()], [K.tube([[0.16, 0.25, 0], [0.32, 0.42, 0], [0.44, 0.62, 0], [0.5, 0.64, 0]], 0.025, { segs: 12 }), MAT.gold()], [new THREE.TorusGeometry(0.16, 0.02, 6, 20, Math.PI).rotateZ(Math.PI / 2).translate(-0.18, 0.4, 0), MAT.gold()]]),
    lantern2: () => group([[new THREE.CylinderGeometry(0.22, 0.26, 0.06, 6).translate(0, 0.03, 0), MAT.gold()], [new THREE.CylinderGeometry(0.2, 0.2, 0.6, 6, 1, true).translate(0, 0.36, 0), K.material('decor-lattice', () => new THREE.MeshStandardMaterial({ color: '#e8c060', metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide, emissive: '#ffb050', emissiveIntensity: 0.4 }))], [new THREE.ConeGeometry(0.24, 0.3, 6).translate(0, 0.81, 0), MAT.gold()], [ball(0.06, 0, 0.36, 0, 10), MAT.emissive('#ffc870', 2.2)]]),
    train: () => {
      const black = MAT.lacquer('#14181c'), red = MAT.lacquer('#8a1a14'), brass = MAT.brass(), parts = [];
      parts.push([new THREE.CylinderGeometry(0.13, 0.13, 0.62, 20).rotateZ(Math.PI / 2).translate(0.05, 0.28, 0), black]);
      parts.push([new THREE.BoxGeometry(0.3, 0.34, 0.3).translate(-0.36, 0.32, 0), red]);
      parts.push([new THREE.CylinderGeometry(0.05, 0.07, 0.2, 12).translate(0.26, 0.5, 0), black]);
      parts.push([K.ring(0.13, 0, 0.012).rotateZ(Math.PI / 2).translate(0.2, 0.28, 0), brass]);
      for (const x of [-0.36, -0.1, 0.18]) for (const z of [-0.16, 0.16]) parts.push(...wheel(0.11, x, 0.11, z, red, brass).map(([g, m]) => [g.rotateY(Math.PI / 2), m]));
      parts.push([new THREE.BoxGeometry(1.2, 0.03, 0.42).translate(0, 0.015, 0), C('track', '#4a3424')]);
      return group(parts);
    },
    cloche: () => group([[lathe([[0, 0], [0.32, 0], [0.34, 0.04], [0, 0.04]], 32), MAT.silver()], [ball(0.12, 0, 0.16, 0, 12).scale(1.6, 0.8, 1.6), MATTE('moss', '#4a6a2a')], [new THREE.SphereGeometry(0.3, 32, 16, 0, TAU, 0, Math.PI / 2).scale(1, 1.5, 1).translate(0, 0.04, 0), glassM()], [ball(0.03, 0, 0.5, 0, 8), MAT.silver()]]),
    telescope: () => group([
      ...[0, 1, 2].map((i) => [new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8).rotateZ((i - 1) * 0.35).rotateX(i === 1 ? 0.35 : 0).translate((i - 1) * 0.15, 0.42, i === 1 ? -0.15 : 0.05), MAT.lacquer('#3a2214')]),
      [new THREE.CylinderGeometry(0.07, 0.09, 0.9, 20).rotateZ(1.1).translate(0.05, 0.95, 0), MAT.brass()],
      [K.ring(0.09, 0, 0.015).rotateZ(1.1 + Math.PI / 2).translate(0.05, 0.95, 0), MAT.lacquer('#1a1a1a')],
    ]),
    fern: () => {
      const parts = [[smoothLathe([[0, 0], [0.2, 0], [0.26, 0.3], [0.28, 0.34], [0, 0.34]], 24), C('pot2', '#b8582a', { roughness: 0.7 })]], leaf = K.material('decor-fern', () => new THREE.MeshStandardMaterial({ color: '#4a7a2a', side: THREE.DoubleSide, roughness: 0.8 }));
      for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; const g = new THREE.PlaneGeometry(0.12, 0.6, 1, 6), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + 0.3) / 0.6; p.setZ(k, -t * t * 0.3); p.setX(k, p.getX(k) * (1 - t * 0.7)); } g.computeVertexNormals(); g.translate(0, 0.3, 0).rotateX(0.7).rotateY(a).translate(0, 0.32, 0); parts.push([g, leaf]); }
      return group(parts);
    },
    snowglobe: () => group([[lathe([[0, 0], [0.24, 0], [0.22, 0.14], [0, 0.14]], 32), MAT.lacquer('#2a1a12')], [ball(0.24, 0, 0.36, 0, 32), glassM('#f0f8ff')], [new THREE.ConeGeometry(0.1, 0.24, 12).translate(0, 0.28, 0), MATTE('fir', '#2a4a3a')], [new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24).translate(0, 0.16, 0), MATTE('snow', '#ffffff')]]),
    lantern3: () => group([[new THREE.BoxGeometry(0.3, 0.06, 0.3).translate(0, 0.03, 0), MAT.lacquer('#1a1a1a')], [new THREE.BoxGeometry(0.26, 0.4, 0.26).translate(0, 0.26, 0), glassM('#fff4d8')], [new THREE.ConeGeometry(0.22, 0.14, 4).rotateY(Math.PI / 4).translate(0, 0.53, 0), MAT.lacquer('#1a1a1a')], [new THREE.TorusGeometry(0.06, 0.012, 6, 16).translate(0, 0.64, 0), MAT.lacquer('#1a1a1a')], [new THREE.CylinderGeometry(0.04, 0.04, 0.14, 10).translate(0, 0.13, 0), MATTE('wax', '#f4ecdc')], [ball(0.035, 0, 0.24, 0, 8), MAT.emissive('#ffc870', 2.4)]]),
    astrolabe: () => group([[new THREE.CylinderGeometry(0.2, 0.24, 0.08, 24).translate(0, 0.04, 0), MAT.lacquer('#1a2a5a')], [new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8).translate(0, 0.22, 0), MAT.brass()], ...[0, 1, 2].map((i) => [new THREE.TorusGeometry(0.28, 0.012, 6, 48).rotateX(Math.PI / 2 * (i === 0 ? 1 : 0)).rotateY(i * 0.8).rotateZ(i === 2 ? 0.41 : 0).translate(0, 0.56, 0), MAT.brass()]), [ball(0.06, 0, 0.56, 0, 16), MAT.gold()]]),
    crown: () => {
      const g = MAT.gold(), parts = cushion('#5a0c22', 0.8);
      parts.push([lathe([[0.24, 0.22], [0.26, 0.3], [0.22, 0.42], [0.23, 0.42], [0.27, 0.3], [0.25, 0.22]], 40), g]);
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; parts.push([new THREE.ConeGeometry(0.04, 0.16, 6).translate(Math.cos(a) * 0.24, 0.48, Math.sin(a) * 0.24), g]); parts.push([ball(0.025, Math.cos(a) * 0.24, 0.57, Math.sin(a) * 0.24, 8), MAT.gem('#f4f4ff')]); parts.push([ball(0.03, Math.cos(a + 0.4) * 0.262, 0.32, Math.sin(a + 0.4) * 0.262, 8), MAT.gem(i % 2 ? '#c8142e' : '#1d4aa8')]); }
      parts.push([ball(0.2, 0, 0.32, 0, 20).scale(1, 0.6, 1), MAT.velvet('#8a0c22')]);
      return group(parts);
    },
    swan: () => group([[ball(0.24, 0, 0.2, 0, 24).scale(1.4, 0.8, 0.9), porcelain()], [K.tube([[0.2, 0.25, 0], [0.32, 0.5, 0], [0.26, 0.72, 0], [0.34, 0.76, 0]], 0.05, { segs: 14 }), porcelain()], [new THREE.ConeGeometry(0.025, 0.1, 6).rotateZ(-Math.PI / 2).translate(0.4, 0.75, 0), C('beak', '#e8801a')], [ball(0.16, -0.18, 0.32, 0, 12).scale(1.2, 0.8, 1.4), porcelain()]]),
    // the raw tables: things a farmer of 2500 BC might have had to hand
    clay: () => group([[smoothLathe([[0, 0], [0.18, 0], [0.3, 0.16], [0.32, 0.3], [0.26, 0.4], [0.28, 0.44], [0.24, 0.44], [0, 0.3]], 20), MATTE('clay', '#a8603a', { flatShading: true })], [new THREE.TorusGeometry(0.28, 0.015, 4, 24).rotateX(Math.PI / 2).translate(0, 0.3, 0), MATTE('clayline', '#3a1a10')]]),
    antler: () => group([[K.tube([[-0.4, 0.05, 0], [-0.1, 0.12, 0.05], [0.2, 0.2, 0], [0.45, 0.35, -0.05]], 0.04, { segs: 14 }), MATTE('bone', '#e0d4b8')], [K.tube([[-0.05, 0.12, 0.04], [0.0, 0.32, 0.1], [0.06, 0.45, 0.12]], 0.025, { segs: 8 }), MATTE('bone', '#e0d4b8')], [K.tube([[0.2, 0.2, 0], [0.26, 0.4, -0.08], [0.24, 0.52, -0.12]], 0.025, { segs: 8 }), MATTE('bone', '#e0d4b8')]]),
    berries: () => { const p = [[smoothLathe([[0, 0], [0.3, 0.02], [0.4, 0.14], [0.38, 0.16], [0, 0.06]], 16), MATTE('wood3', '#6a4a2a', { flatShading: true })]]; fruit(p, C('berry', '#3a1a4a', { roughness: 0.3 }), 0.045, { y: 0.07, r: 0.2, n: 14, top: 8 }, 3); fruit(p, C('berry2', '#a81a2a', { roughness: 0.3 }), 0.045, { y: 0.09, r: 0.1, n: 6, top: 2 }, 5); return group(p); },
    flint: () => { const p = []; const R2 = rng(9); for (let i = 0; i < 4; i++) { const g = new THREE.IcosahedronGeometry(0.1 + R2() * 0.06, 0).scale(1.6, 0.6, 1); p.push([g.translate((i - 1.5) * 0.18, 0.05, (R2() - 0.5) * 0.2), MATTE('flint', i % 2 ? '#3a3a40' : '#8a8478', { flatShading: true, roughness: 0.5 })]); } return group(p); },
    cart: () => {
      // a little terracotta bullock cart, like the toys found at Harappa
      const clay = MATTE('clay2', '#b0683a', { flatShading: true }), parts = [[new THREE.BoxGeometry(0.42, 0.06, 0.3).translate(-0.05, 0.18, 0), clay], [new THREE.BoxGeometry(0.5, 0.03, 0.03).translate(0.3, 0.18, 0), clay]];
      for (const z of [-0.17, 0.17]) parts.push([new THREE.CylinderGeometry(0.14, 0.14, 0.04, 14).rotateX(Math.PI / 2).translate(-0.05, 0.14, z), clay]);
      parts.push([ball(0.12, 0.62, 0.2, 0, 10).scale(1.5, 0.9, 0.8), clay], [ball(0.07, 0.8, 0.26, 0, 8), clay]);
      for (const x of [0.54, 0.7]) for (const z of [-0.05, 0.05]) parts.push([new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6).translate(x, 0.07, z), clay]);
      for (const z of [-1, 1]) parts.push([new THREE.ConeGeometry(0.02, 0.1, 5).rotateX(z * 0.6).translate(0.82, 0.34, z * 0.04), clay]);
      return group(parts);
    },
    jar: () => group([[smoothLathe([[0, 0], [0.14, 0], [0.26, 0.22], [0.28, 0.42], [0.2, 0.6], [0.14, 0.66], [0.17, 0.72], [0, 0.6]], 18), MATTE('clay3', '#9a4a2a', { flatShading: true })], ...[0.3, 0.38, 0.46].map((y) => [K.ring(0.28 - Math.abs(y - 0.38) * 0.4, y, 0.012).translate(0, 0, 0), MATTE('ochre', '#1a100a')])]),
    seal: () => group([[new THREE.BoxGeometry(0.3, 0.08, 0.3).translate(0, 0.04, 0), MATTE('steatite', '#d8cfc0', { roughness: 0.6 })], [new THREE.BoxGeometry(0.26, 0.08, 0.26).translate(0.38, 0.04, 0.1).rotateY(0.3), MATTE('steatite', '#d8cfc0', { roughness: 0.6 })]]),
    basket: () => {
      const weave = MATTE('reed', '#b88a4a'), parts = [[smoothLathe([[0, 0], [0.26, 0], [0.36, 0.26], [0.38, 0.3], [0.34, 0.3], [0, 0.04]], 24), weave]];
      fruit(parts, MATTE('potato', '#8a5a30'), 0.07, { y: 0.14, r: 0.18, n: 7, top: 3 }, 8);
      fruit(parts, MATTE('potato2', '#6a2a4a'), 0.06, { y: 0.2, r: 0.1, n: 4, top: 1 }, 2);
      return group(parts);
    },
    llama: () => {
      const wool = MATTE('wool', '#efe6d8'), parts = [[ball(0.2, 0, 0.42, 0, 14).scale(1.4, 0.8, 0.8), wool], [K.tube([[0.22, 0.45, 0], [0.3, 0.7, 0], [0.32, 0.86, 0]], 0.065, { segs: 10 }), wool], [ball(0.08, 0.36, 0.9, 0, 10).scale(1.4, 0.9, 0.9), wool]];
      for (const x of [-0.18, 0.18]) for (const z of [-0.08, 0.08]) parts.push([new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8).translate(x, 0.17, z), wool]);
      for (const z of [-1, 1]) parts.push([new THREE.ConeGeometry(0.025, 0.1, 6).translate(0.32, 1.0, z * 0.04), wool]);
      parts.push([new THREE.BoxGeometry(0.3, 0.04, 0.3).translate(0, 0.58, 0), C('blanket', '#c8201a', { roughness: 0.9 })]);
      return group(parts);
    },
    // Star Observatory: a little orrery, a crystal ball of stars, a rolled star chart and a moon lamp
    orrery: () => group([
      [new THREE.CylinderGeometry(0.2, 0.26, 0.08, 32).translate(0, 0.04, 0), MAT.lacquer('#14142a')],
      [new THREE.CylinderGeometry(0.02, 0.02, 0.34, 8).translate(0, 0.25, 0), MAT.gold()],
      [ball(0.08, 0, 0.44, 0, 20), C('orrery-sun', '#ffd060', { emissive: '#ffb020', emissiveIntensity: 1.2 })],
      ...[[0.2, 0.3, '#5a8ae8'], [0.32, 2.2, '#e86a4a'], [0.42, 4.1, '#e8d0a0']].flatMap(([r, a, c], i) => [
        [new THREE.BoxGeometry(r, 0.012, 0.012).translate(r / 2, 0.44, 0).rotateY(a), MAT.gold()],
        [ball(0.03 + i * 0.008, Math.cos(a) * r, 0.44, -Math.sin(a) * r, 14), C('orrery-p' + i, c, { roughness: 0.3 })],
      ]),
    ]),
    crystalorb: () => {
      const parts = [[smoothLathe([[0, 0], [0.18, 0], [0.12, 0.06], [0.08, 0.14], [0.14, 0.2], [0, 0.2]], 24), MAT.gold()], [ball(0.2, 0, 0.38, 0, 32), glassM('#d8e0ff')]];
      const R = rng(71), st = C('orbstar', '#e8e8ff', { emissive: '#a8b0ff', emissiveIntensity: 1.6 });
      for (let i = 0; i < 12; i++) { const a = R() * TAU, r = R() * 0.12; parts.push([new THREE.OctahedronGeometry(0.018 + R() * 0.012).translate(Math.cos(a) * r, 0.3 + R() * 0.16, Math.sin(a) * r), st]); }
      return group(parts);
    },
    starchart: () => group([
      [new THREE.CylinderGeometry(0.09, 0.09, 0.66, 24).rotateZ(Math.PI / 2).translate(0, 0.09, 0), C('chart', '#1e2050', { roughness: 0.6, emissive: '#3a3a8a', emissiveIntensity: 0.3 })],
      ...[-0.35, 0.35].map((x) => [new THREE.CylinderGeometry(0.03, 0.03, 0.24, 10).rotateX(Math.PI / 2).translate(x, 0.09, 0), MAT.gold()]),
      [K.ring(0.092, 0, 0.012).rotateZ(Math.PI / 2).translate(0, 0.09, 0), MAT.gold()],
    ]),
    moonlamp: () => group([[new THREE.CylinderGeometry(0.12, 0.16, 0.06, 24).translate(0, 0.03, 0), MAT.gold()], [new THREE.CylinderGeometry(0.015, 0.015, 0.2, 8).translate(0, 0.16, 0), MAT.gold()], [ball(0.17, 0, 0.42, 0, 28), C('moonglow', '#f4f0e0', { roughness: 0.9, clearcoat: 0, emissive: '#e8e0c8', emissiveIntensity: 0.7 })]]),
    // Fire and Ice: ice crystals, a glowing lava stone, a bowl of flame and a frosted goblet
    icecluster: () => {
      const parts = [[new THREE.CylinderGeometry(0.26, 0.3, 0.05, 6).translate(0, 0.025, 0), MAT.silver()]], R = rng(73), ice = C('icecrys', '#b8e4ff', { roughness: 0.05, transmission: 0.2, emissive: '#3a8ac8', emissiveIntensity: 0.35, flatShading: true });
      for (let i = 0; i < 7; i++) { const a = R() * TAU, r = i ? 0.08 + R() * 0.1 : 0, h = i ? 0.2 + R() * 0.2 : 0.5; parts.push([new THREE.CylinderGeometry(0, 0.05 + R() * 0.03, h, 6).translate(0, h / 2, 0).rotateZ(i ? (R() - 0.5) * 0.8 : 0).translate(Math.cos(a) * r, 0.04, Math.sin(a) * r), ice]); }
      return group(parts);
    },
    lavastone: () => {
      const g = new THREE.IcosahedronGeometry(0.22, 1), p = g.attributes.position, R = rng(79);
      for (let i = 0; i < p.count; i++) { const k = 0.8 + R() * 0.35; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.75, p.getZ(i) * k); }
      g.computeVertexNormals(); g.translate(0, 0.17, 0);
      return group([[g, C('lavastone', '#2a1e1c', { roughness: 0.85, clearcoat: 0, emissive: '#ff4a0a', emissiveIntensity: 0.35, flatShading: true })], [new THREE.CylinderGeometry(0.28, 0.3, 0.04, 24).translate(0, 0.02, 0), MAT.bronze()]]);
    },
    flamebowl: () => group([[smoothLathe([[0, 0], [0.1, 0], [0.08, 0.1], [0.24, 0.2], [0.26, 0.24], [0, 0.22]], 32), C('obsid', '#1a1416', { roughness: 0.15, clearcoat: 1 })], [new THREE.ConeGeometry(0.12, 0.3, 16).translate(0, 0.38, 0), MAT.emissive('#ff8a2a', 2)], [new THREE.ConeGeometry(0.06, 0.2, 12).translate(0, 0.36, 0), MAT.emissive('#ffe080', 2.4)]]),
    frostgoblet: () => group([[smoothLathe([[0, 0], [0.14, 0], [0.04, 0.06], [0.03, 0.2], [0.14, 0.28], [0.15, 0.44], [0, 0.44]], 32), glassM('#d8f0ff')], [K.ring(0.15, 0.44, 0.012), MAT.silver()]]),
    // Clockwork Tower: a pocket watch, a stack of gears, an oil can and brass goggles
    pocketwatch: () => group([[new THREE.CylinderGeometry(0.24, 0.24, 0.06, 40).translate(0, 0.03, 0), MAT.brass()], [new THREE.CylinderGeometry(0.21, 0.21, 0.005, 40).translate(0, 0.063, 0), C('watchface', '#f4ead0', { roughness: 0.5 })], [new THREE.BoxGeometry(0.012, 0.004, 0.14).translate(0, 0.068, -0.06), MAT.lacquer('#1a1a1a')], [new THREE.BoxGeometry(0.1, 0.004, 0.012).translate(0.045, 0.068, 0), MAT.lacquer('#1a1a1a')], [K.ring(0.04, 0.03, 0.012).rotateX(Math.PI / 2).translate(0, 0, -0.28), MAT.brass()]]),
    gearstack: () => {
      const parts = [];
      [[0.26, 18, 0, MAT.brass()], [0.18, 12, 0.07, MAT.copper ? MAT.copper() : MAT.bronze()], [0.11, 8, 0.14, MAT.brass()]].forEach(([r, n, y, m]) => {
        const s2 = new THREE.Shape();
        for (let i = 0; i < n * 4; i++) { const a = (i / (n * 4)) * TAU, rr = i % 4 < 2 ? r : r * 0.86; i ? s2.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : s2.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        const h = new THREE.Path(); h.absarc(0, 0, r * 0.25, 0, TAU, true); s2.holes.push(h);
        parts.push([new THREE.ExtrudeGeometry(s2, { depth: 0.05, bevelEnabled: false, curveSegments: 4 }).rotateX(-Math.PI / 2).translate(0, y, 0), m]);
      });
      parts.push([new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10).translate(0, 0.15, 0), MAT.chrome()]);
      return group(parts);
    },
    oilcan: () => group([[smoothLathe([[0, 0], [0.16, 0], [0.17, 0.04], [0.16, 0.16], [0.08, 0.24], [0.03, 0.26], [0, 0.26]], 28), MAT.copper ? MAT.copper() : MAT.bronze()], [new THREE.CylinderGeometry(0.012, 0.025, 0.4, 8).rotateZ(-0.9).translate(0.16, 0.36, 0), MAT.brass()], [new THREE.TorusGeometry(0.08, 0.015, 6, 20, Math.PI).rotateZ(Math.PI / 2).translate(-0.17, 0.12, 0), MAT.brass()]]),
    goggles: () => group([...[-1, 1].flatMap((s2) => [[new THREE.CylinderGeometry(0.09, 0.1, 0.08, 24).rotateX(Math.PI / 2).translate(s2 * 0.12, 0.1, 0), MAT.brass()], [new THREE.CylinderGeometry(0.075, 0.075, 0.01, 24).rotateX(Math.PI / 2).translate(s2 * 0.12, 0.1, 0.045), glassM('#ffd8a0')]]), [new THREE.TorusGeometry(0.26, 0.02, 6, 32, Math.PI).rotateX(Math.PI / 2).translate(0, 0.08, -0.02), C('strap', '#5a3018', { roughness: 0.7 })]]),
    // Neon Rooftop: a glowing cube, a bowl of noodles, headphones and a little drone
    holocube: () => group([[new THREE.CylinderGeometry(0.18, 0.2, 0.06, 6).translate(0, 0.03, 0), MAT.chrome()], [new THREE.BoxGeometry(0.22, 0.22, 0.22).rotateY(0.6).rotateX(0.6).translate(0, 0.3, 0), C('holo', '#ff6ad8', { emissive: '#ff3ab8', emissiveIntensity: 1.2, transparent: true, opacity: 0.75, roughness: 0.1 })], [ball(0.06, 0, 0.3, 0, 12), MAT.emissive('#3ae0ff', 2)]]),
    noodles: () => group([[smoothLathe([[0, 0], [0.1, 0], [0.12, 0.03], [0.24, 0.16], [0.25, 0.2], [0, 0.18]], 32), C('noodlebowl', '#e8eaf2', { roughness: 0.2, clearcoat: 1 })], [new THREE.CylinderGeometry(0.22, 0.22, 0.02, 28).translate(0, 0.17, 0), MATTE('noodle', '#f0d890')], ...[-0.02, 0.02].map((z) => [new THREE.CylinderGeometry(0.008, 0.01, 0.5, 6).rotateZ(1.1).translate(0.08, 0.3, z), MATTE('stick', '#1a1a1a')])]),
    headphones: () => group([[new THREE.TorusGeometry(0.2, 0.025, 8, 32, Math.PI).translate(0, 0.1, 0), C('hp', '#1a1824', { roughness: 0.3 })], ...[-1, 1].flatMap((s2) => [[new THREE.CylinderGeometry(0.09, 0.09, 0.06, 24).rotateZ(Math.PI / 2).translate(s2 * 0.2, 0.08, 0), C('hp', '#1a1824', { roughness: 0.3 })], [K.ring(0.09, 0, 0.01).rotateZ(Math.PI / 2).translate(s2 * 0.235, 0.08, 0), MAT.emissive(s2 < 0 ? '#ff3ab8' : '#3ae0ff', 2)]])]),
    drone: () => group([[new THREE.BoxGeometry(0.16, 0.05, 0.16).translate(0, 0.08, 0), C('dronebody', '#e8eaf2', { roughness: 0.25 })], ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].flatMap(([a, b]) => [[new THREE.BoxGeometry(0.2, 0.015, 0.02).rotateY(Math.atan2(b, a)).translate(a * 0.08, 0.09, b * 0.08), MAT.chrome()], [new THREE.CylinderGeometry(0.07, 0.07, 0.006, 16).translate(a * 0.15, 0.11, b * 0.15), C('prop', '#3ae0ff', { transparent: true, opacity: 0.5, emissive: '#3ae0ff', emissiveIntensity: 0.6 })]]), [ball(0.02, 0, 0.07, 0.085, 8), MAT.emissive('#ff3a3a', 2)], [new THREE.BoxGeometry(0.02, 0.06, 0.12).translate(0.07, 0.03, 0), MAT.chrome()], [new THREE.BoxGeometry(0.02, 0.06, 0.12).translate(-0.07, 0.03, 0), MAT.chrome()]]),
    // Floating Citadel: a glass prism, an orb of light, a shard of the void and a white chalice
    prism: () => group([[new THREE.CylinderGeometry(0.16, 0.16, 0.4, 3).translate(0, 0.24, 0), glassM('#f4f8ff')], [new THREE.CylinderGeometry(0.2, 0.22, 0.04, 24).translate(0, 0.02, 0), MAT.gold()], [new THREE.BoxGeometry(0.3, 0.004, 0.04).translate(0.2, 0.045, 0.05), MAT.emissive('#ff8a8a', 1.6)], [new THREE.BoxGeometry(0.3, 0.004, 0.04).translate(0.2, 0.045, 0.1), MAT.emissive('#8aff9a', 1.6)], [new THREE.BoxGeometry(0.3, 0.004, 0.04).translate(0.2, 0.045, 0.15), MAT.emissive('#8a9aff', 1.6)]]),
    sunorb: () => group([[smoothLathe([[0, 0], [0.14, 0], [0.06, 0.08], [0.1, 0.16], [0, 0.16]], 24), MAT.gold()], [ball(0.14, 0, 0.3, 0, 28), MAT.emissive('#fff0c0', 1.6)], [new THREE.TorusGeometry(0.2, 0.01, 6, 40).rotateX(1.2).translate(0, 0.3, 0), MAT.gold()]]),
    voidshard: () => group([[new THREE.OctahedronGeometry(0.12, 0).scale(1, 2.6, 1).translate(0, 0.36, 0), C('voidshard', '#14101e', { roughness: 0.08, metalness: 0.4, emissive: '#7a3aff', emissiveIntensity: 0.45, flatShading: true })], [new THREE.CylinderGeometry(0.16, 0.2, 0.06, 6).translate(0, 0.03, 0), MAT.lacquer('#14101e')]]),
    chalice: () => group([[smoothLathe([[0, 0], [0.15, 0], [0.12, 0.03], [0.04, 0.08], [0.035, 0.24], [0.16, 0.32], [0.18, 0.46], [0, 0.42]], 36), C('whiteglaze', '#f6f2ea', { roughness: 0.15, clearcoat: 1 })], [K.ring(0.18, 0.46, 0.012), MAT.gold()], [K.ring(0.15, 0.02, 0.012), MAT.gold()]]),
    corn: () => { const p = []; for (let i = 0; i < 3; i++) { p.push([ball(0.07, 0, 0, 0, 12).scale(1, 3.6, 1).rotateZ(Math.PI / 2 - 0.2 + i * 0.2).translate(-0.1 + i * 0.1, 0.08 + (i === 1 ? 0.08 : 0), (i - 1) * 0.15), MATTE('corn' + i, ['#e8c040', '#a8401a', '#5a2a5a'][i])]); } return group(p); },
  };
  function fruitBasket(c1, c2) {
    const parts = [[smoothLathe([[0, 0], [0.3, 0], [0.42, 0.22], [0.44, 0.26], [0.4, 0.26], [0, 0.04]], 24), MATTE('basket', '#a87a3a')], [new THREE.TorusGeometry(0.32, 0.02, 6, 24, Math.PI).translate(0, 0.26, 0), MATTE('basket', '#a87a3a')]];
    fruit(parts, C('apple1', c1, { roughness: 0.35, clearcoat: 0.6 }), 0.11, { y: 0.12, r: 0.22, n: 5, top: 1 }, 3);
    fruit(parts, C('apple2', c2, { roughness: 0.35, clearcoat: 0.6 }), 0.1, { y: 0.24, r: 0.12, n: 3, top: 0 }, 6);
    return group(parts);
  }
  // A toy roadster of about 1930: long bonnet, sweeping wings, spoked wheels and chrome lamps.
  function vintageCar(color) {
    const paint = MAT.lacquer(color, { roughness: 0.18 }), chrome = MAT.chrome(), black = MAT.lacquer('#0e0e10'), parts = [];
    const side = new THREE.Shape(); side.moveTo(-0.5, 0.12); side.lineTo(0.55, 0.12); side.quadraticCurveTo(0.62, 0.14, 0.6, 0.26); side.lineTo(0.05, 0.3); side.lineTo(-0.05, 0.42); side.lineTo(-0.3, 0.42); side.quadraticCurveTo(-0.5, 0.4, -0.52, 0.26); side.closePath();
    parts.push([new THREE.ExtrudeGeometry(side, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 3 }).translate(0, 0, -0.15), paint]);
    for (const z of [-1, 1]) {
      parts.push([K.tube([[0.58, 0.18, z * 0.2], [0.42, 0.26, z * 0.22], [0.2, 0.16, z * 0.22], [-0.2, 0.15, z * 0.22], [-0.42, 0.26, z * 0.22], [-0.56, 0.18, z * 0.2]], 0.035, { segs: 24 }), black]);
      parts.push(...wheel(0.12, 0.38, 0.12, z * 0.21, black, chrome), ...wheel(0.12, -0.36, 0.12, z * 0.21, black, chrome));
      parts.push([ball(0.045, 0.63, 0.3, z * 0.11, 10), chrome]);
    }
    parts.push([new THREE.BoxGeometry(0.04, 0.12, 0.2).translate(0.62, 0.22, 0), chrome]);
    parts.push([new THREE.BoxGeometry(0.03, 0.12, 0.28).rotateZ(-0.3).translate(0.04, 0.38, 0), glassM()]);
    parts.push([new THREE.TorusGeometry(0.06, 0.012, 6, 16).rotateY(Math.PI / 2).rotateX(0.5).translate(-0.02, 0.36, 0.06), black]);
    return group(parts);
  }

  // Where the props go. On the table, the two corners the clock and the capture trays never
  // use (the clock stands at White's right, or Black's); beside the table, two stands at its
  // far side, where they frame the board from the player's seat.
  const SLOTS = [[6.05, -4.8, -0.5, 1.15], [-6.05, 4.8, 0.9, 1.05], [-10.2, -5.0, 0.6, 2.3], [10.2, -5.0, -0.6, 2.3]];
  function stand(t, top, floor) {
    const raw = t && t.raw, wood = MAT.lacquer((t && t.top && (t.top.wood || (t.top.kind === 'wood' || t.top.kind === 'lacquer' || t.top.kind === 'planks' ? t.top.color : null))) || '#2a1a12', { roughness: 0.4 });
    if (raw) {
      let g = new THREE.BoxGeometry(2.2, top - floor, 2.0, 3, 4, 3).translate(0, floor + (top - floor) / 2, 0);
      g = roughen(g, 1e9, 0.16, 11);
      return group([[g, MAT.matte((t.top && t.top.color) || '#8a8478', { roughness: 1, flatShading: true })]]);
    }
    const y0 = floor, y1 = top, m = metal((t && t.metal) || 'gold');
    const prof = K.profile(0, y0).line(1.1, y0).arc(1.0, y0 + 0.2, 0.2).curve([[0.5, y0 + 0.5], [0.32, y0 + 1.2], [0.28, y1 - 1.0], [0.45, y1 - 0.4], [1.2, y1 - 0.18]]).line(1.3, y1).line(0, y1);
    return group([[K.revolve(prof, { segs: 40 }), wood], [K.ring(1.3, y1 - 0.02, 0.03), m], [K.ring(0.32, y0 + 1.25, 0.04), m]]);
  }
  function decor(roomId, top, flames, metalName, floor) {
    const s = SUITES[roomId], grp = new THREE.Group();
    if (!s) {
      grp.add(candelabrum(-5.9, top, -4.6, flames, metal(metalName)));
      grp.add(candelabrum(5.9, top, -4.6, flames, metal(metalName)));
      return grp;
    }
    const ctx = { flames, metal: metal(metalName || (s.table && s.table.metal) || 'gold') };
    s.decor.forEach((name, i) => {
      const make = PROPS[name]; if (!make || !SLOTS[i]) return;
      const [x, z, ry, k] = SLOTS[i];
      if (i >= 2 && floor !== undefined) { const st = stand(s.table, top, floor); st.position.set(x, 0, z); grp.add(st); }
      const p = make(ctx);
      p.scale.setScalar(name === 'candelabra' ? (i >= 2 ? 1.6 : 1) : k);
      p.position.set(x, top, z); p.rotation.y = ry;
      p.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
      grp.add(p);
    });
    return grp;
  }
  return { SUITES, byBoard, bySet, table, decor, PROPS, outline };
}
if (typeof module !== 'undefined') module.exports = ChacklateSuites;
