// Chackmate art: hand-drawn SVG for the crest, the animal portraits
// (opponents and Journey coaches), piece silhouettes, emblems and the era
// landmarks. Every picture is a self-contained SVG string, so it can be used
// as an <img> data URI (no id clashes) or drawn into a canvas texture.
const ChacklateArt = (() => {
  'use strict';

  // Pictures rendered from the 3D game (build.py inlines CHACKLATE_ART); drawn art stands in without them.
  const ART_IMG = typeof CHACKLATE_ART !== 'undefined' ? CHACKLATE_ART : { piece: {}, view: {} };

  // ------------------------------------------------------------ colour helpers
  const rgb = (c) => {
    let h = String(c).replace('#', '');
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const hex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t); };
  const lit = (c, t) => mix(c, '#ffffff', t);
  const dim = (c, t) => mix(c, '#000000', t);

  // ------------------------------------------------------------ svg builder
  // One builder per picture: gradients are registered once and referenced by id.
  function pic() {
    const defs = [];
    const ids = new Map();
    const reg = (key, make) => {
      if (!ids.has(key)) { const id = 'g' + ids.size; ids.set(key, id); defs.push(make(id)); }
      return 'url(#' + ids.get(key) + ')';
    };
    const stops = (list) => list.map(([o, c, a]) => '<stop offset="' + o + '" stop-color="' + c + '"' + (a === undefined ? '' : ' stop-opacity="' + a + '"') + '/>').join('');
    return {
      defs,
      // a rounded, lit-from-the-top-left fill for a colour
      sh(c, o) {
        o = o || {};
        const hi = o.hi === undefined ? 0.3 : o.hi, lo = o.lo === undefined ? 0.32 : o.lo;
        return reg('sh' + c + hi + lo + (o.cx || '') + (o.cy || ''), (id) => '<radialGradient id="' + id + '" cx="' + (o.cx || 0.36) + '" cy="' + (o.cy || 0.3) + '" r="' + (o.r || 0.82) + '">' +
          stops([[0, lit(c, hi)], [0.5, c], [1, dim(c, lo)]]) + '</radialGradient>');
      },
      lin(list, x1, y1, x2, y2, user) {
        return reg('l' + JSON.stringify(list) + x1 + y1 + x2 + y2 + !!user, (id) => '<linearGradient id="' + id + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"' + (user ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(list) + '</linearGradient>');
      },
      rad(list, cx, cy, r, fx, fy, user) {
        return reg('r' + JSON.stringify(list) + cx + cy + r + fx + fy + !!user, (id) => '<radialGradient id="' + id + '" cx="' + cx + '" cy="' + cy + '" r="' + r + '"' + (fx === undefined ? '' : ' fx="' + fx + '" fy="' + fy + '"') + (user ? ' gradientUnits="userSpaceOnUse"' : '') + '>' + stops(list) + '</radialGradient>');
      },
      raw(key, markup) { reg(key, () => markup); return key; },
      gold() { return this.lin([[0, '#fff3c4'], [0.28, '#f0cf7e'], [0.55, '#c08a36'], [0.78, '#f5d98e'], [1, '#8a5a1e']], 0, 0, 1, 1); },
    };
  }
  const svg = (p, vb, body, attrs) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '"' + (attrs || '') + '><defs>' + p.defs.join('') + '</defs>' + body + '</svg>';
  const uri = (s) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);

  // shape shorthands
  // the gold wire (cloison) that edges each field of enamel; c is the enamel it holds
  const ol = (c, w) => ' stroke="#d6aa58" stroke-width="' + ((w || 2) * 0.8).toFixed(2) + '" stroke-linejoin="round"';
  const E = (cx, cy, rx, ry, fill, x) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + fill + '"' + (x || '') + '/>';
  const C = (cx, cy, r, fill, x) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '"' + (x || '') + '/>';
  const P = (d, fill, x) => '<path d="' + d + '" fill="' + fill + '"' + (x || '') + '/>';
  const G = (body, x) => '<g' + (x || '') + '>' + body + '</g>';
  const flip = (body) => '<g transform="translate(200 0) scale(-1 1)">' + body + '</g>';
  const sym = (body) => body + flip(body);
  const rot = (a, x, y) => ' transform="rotate(' + a + ' ' + x + ' ' + y + ')"';

  // ------------------------------------------------------------ face parts
  // Eyes painted like a storybook portrait: a coloured iris with a dark limbal ring and fine
  // streaks, a soft shadow from the upper lid and one crisp catchlight. `slit` gives a cat's pupil.
  function eye(p, x, y, r, o) {
    o = o || {};
    const iris = o.iris || '#6a4024';
    let s = '';
    if (o.ring) s += C(x, y, r + 1.6, p.rad([[0.6, o.ring], [1, dim(o.ring, 0.35)]], 0.5, 0.5, 0.5));
    // the eyeball sits in a soft socket
    s += C(x, y + r * 0.04, r * 1.06, dim(iris, 0.82), ' opacity=".7"');
    s += C(x, y, r, p.rad([[0, lit(iris, 0.45)], [0.45, iris], [0.82, dim(iris, 0.35)], [1, dim(iris, 0.75)]], 0.5, 0.62, 0.55));
    let streaks = '';
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      streaks += 'M' + (x + Math.cos(a) * r * 0.42).toFixed(2) + ' ' + (y + Math.sin(a) * r * 0.42).toFixed(2) + 'L' + (x + Math.cos(a) * r * 0.86).toFixed(2) + ' ' + (y + Math.sin(a) * r * 0.86).toFixed(2);
    }
    s += '<path d="' + streaks + '" stroke="' + lit(iris, 0.55) + '" stroke-width="' + (r * 0.07).toFixed(2) + '" stroke-opacity=".35" stroke-linecap="round"/>';
    s += o.slit ? E(x, y, r * 0.22, r * 0.78, '#0a0504') : C(x, y + r * 0.04, r * 0.44, p.rad([[0, '#1a0e08'], [1, '#050302']], 0.5, 0.5, 0.5));
    // upper-lid shadow
    s += P('M' + (x - r) + ' ' + y + ' A' + r + ' ' + r + ' 0 0 1 ' + (x + r) + ' ' + y + ' Q' + x + ' ' + (y - r * 0.45) + ' ' + (x - r) + ' ' + y + 'Z', '#000', ' opacity=".28"');
    s += C(x + r * 0.32, y - r * 0.34, r * 0.2, '#fff', ' opacity=".95"');
    s += E(x - r * 0.28, y + r * 0.42, r * 0.22, r * 0.1, '#fff', ' opacity=".28"');
    return '<g class="eye">' + s + '</g>';
  }
  const eyes = (p, dx, y, r, o) => eye(p, 100 - dx, y, r, o) + eye(p, 100 + dx, y, r, o);
  // cheeks stay in plain enamel: a painted blush is a cartoon touch the medals do without
  const blush = () => '';
  const smile = (y, w, c, sw) => '<path d="M' + (100 - w) + ' ' + y + ' Q' + (100 - w / 2) + ' ' + (y + w * 0.55) + ' 100 ' + (y + 1) + ' Q' + (100 + w / 2) + ' ' + (y + w * 0.55) + ' ' + (100 + w) + ' ' + y + '" fill="none" stroke="' + c + '" stroke-width="' + (sw || 2.6) + '" stroke-linecap="round"/>';
  const nose = (p, y, w, c) => P('M' + (100 - w) + ' ' + y + ' Q100 ' + (y - w * 0.35) + ' ' + (100 + w) + ' ' + y + ' Q' + (100 + w * 0.6) + ' ' + (y + w * 0.9) + ' 100 ' + (y + w * 1.05) + ' Q' + (100 - w * 0.6) + ' ' + (y + w * 0.9) + ' ' + (100 - w) + ' ' + y + 'Z', p.sh(c || '#2a1810', { hi: 0.4 })) +
    E(100 - w * 0.25, y + w * 0.15, w * 0.32, w * 0.16, '#fff', ' opacity=".55"');
  const bust = (p, c, x) => P('M14 214 C18 168 58 148 100 148 C142 148 182 168 186 214 Z', p.sh(c, { cy: 0.15 }), x || ol(c));
  const shadow = (y, rx) => E(100, y, rx, rx * 0.2, 'rgba(20,8,4,.35)', ' filter="url(#soft)"');

  // ------------------------------------------------------------ accessories
  function crown(p, cx, y, w) {
    const h = w * 0.62, g = p.gold();
    const pts = [[-0.5, 0], [-0.5, -0.62], [-0.27, -0.28], [0, -0.82], [0.27, -0.28], [0.5, -0.62], [0.5, 0]];
    const d = 'M' + pts.map(([a, b]) => (cx + a * w).toFixed(1) + ' ' + (y + b * h).toFixed(1)).join(' L') + 'Z';
    return P(d, g, ol('#c08a36', 1.6)) + E(cx, y, w * 0.5, w * 0.08, g, ol('#c08a36', 1.4)) +
      C(cx, y - 0.82 * h, w * 0.07, '#fff3c4') + C(cx - 0.5 * w, y - 0.62 * h, w * 0.06, '#fff3c4') + C(cx + 0.5 * w, y - 0.62 * h, w * 0.06, '#fff3c4') +
      C(cx, y - 0.25 * h, w * 0.085, p.sh('#d0244a', { hi: 0.5 })) + C(cx - 0.3 * w, y - 0.18 * h, w * 0.055, p.sh('#2a8a5a', { hi: 0.5 })) + C(cx + 0.3 * w, y - 0.18 * h, w * 0.055, p.sh('#2a5ad0', { hi: 0.5 }));
  }
  // A wreath across the brow: two branches meet at the front, leaves in pairs.
  function laurel(p, cy, half, leaf, berry) {
    const fill = p.sh(leaf, { hi: 0.38 });
    const band = (x) => cy + 7 * (1 - Math.pow((x - 100) / half, 2));
    let s = '<path d="M' + (100 - half) + ' ' + cy + ' Q100 ' + (cy + 14) + ' ' + (100 + half) + ' ' + cy + '" fill="none" stroke="' + dim(leaf, 0.35) + '" stroke-width="2.2"/>';
    for (const side of [-1, 1]) {
      for (let i = 0; i < 8; i++) {
        const x = +(100 + side * (4 + i * (half - 4) / 7.4)).toFixed(1), y = +band(x).toFixed(1);
        s += E(x, y - 7, 3.3, 8, fill, rot(side * 58, x, y) + ol(leaf, 1));
        s += E(x, y - 7, 3.1, 7.4, fill, rot(side * 122, x, y) + ol(leaf, 1));
        if (berry && i % 2 === 1) s += C(+(x + side * 3).toFixed(1), y + 6, 2.3, p.sh(berry, { hi: 0.5 }));
      }
    }
    return s;
  }

  // A round wreath: two branches rise from the bottom and frame a medal.
  function wreath(p, cx, cy, r, leaf, n) {
    const fill = p.sh(leaf, { hi: 0.4 });
    n = n || 9;
    let s = '';
    for (const side of [-1, 1]) {
      s += '<path d="M' + (cx + side * 6) + ' ' + (cy + r) + ' A' + r + ' ' + r + ' 0 0 ' + (side < 0 ? 1 : 0) + ' ' + (cx + side * r * Math.sin(1.05 * Math.PI * 0.8)).toFixed(1) + ' ' + (cy - r * Math.cos(1.05 * Math.PI * 0.8) * -1 - 0).toFixed(1) + '" fill="none" stroke="' + dim(leaf, 0.3) + '" stroke-width="2"/>';
      for (let i = 0; i < n; i++) {
        const t = 0.1 + (i / (n - 1)) * 0.72;
        const a = Math.PI / 2 + side * t * Math.PI; // from the bottom up the side
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const tang = Math.atan2(Math.cos(a) * side, -Math.sin(a) * side) * 180 / Math.PI; // direction of growth
        const xs = x.toFixed(1), ys = y.toFixed(1);
        s += E(xs, (y - 8).toFixed(1), 3.6, 8.5, fill, rot((tang + 90 - side * 34).toFixed(1), xs, ys) + ol(leaf, 1));
        s += E(xs, (y - 8).toFixed(1), 3.4, 8, fill, rot((tang + 90 + side * 34).toFixed(1), xs, ys) + ol(leaf, 1));
      }
    }
    return s;
  }

  // ------------------------------------------------------------ the animals
  // Each draws into a 200 × 200 box, head centred near (100, 96).
  const ANIMALS = {
    bunny(p) {
      const f = '#f6ede7', pink = '#f4a6b8';
      const ear = (x, a) => G(E(x, 46, 14, 40, p.sh(f), ol(f)) + E(x, 50, 7.5, 30, p.sh(pink, { hi: 0.35 })), rot(a, x, 86));
      return bust(p, f) + P('M70 160 Q100 176 130 160 L126 152 Q100 164 74 152Z', p.sh('#e04f78'), ol('#e04f78', 1.4)) +
        ear(80, -10) + ear(120, 14) +
        // bow on the left ear
        G(P('M64 60 L50 50 Q46 62 52 70Z', p.sh('#e04f78'), ol('#e04f78', 1.4)) + P('M66 62 L82 54 Q86 66 78 72Z', p.sh('#e04f78'), ol('#e04f78', 1.4)) + C(66, 63, 5, p.sh('#c23462', { hi: 0.5 })), rot(-12, 66, 63)) +
        E(100, 104, 52, 45, p.sh(f), ol(f)) +
        E(100 - 8.5, 118, 11, 9, p.sh('#ffffff')) + E(100 + 8.5, 118, 11, 9, p.sh('#ffffff')) +
        P('M94.6 124 h5 v8 q-2.5 2 -5 0Z', '#fffaf2', ol('#d8c8c0', 1)) + P('M100.4 124 h5 v8 q-2.5 2 -5 0Z', '#fffaf2', ol('#d8c8c0', 1)) +
        nose(p, 110, 6.5, '#ec7f9c') + '<path d="M100 116 v3" stroke="#b86a7c" stroke-width="2" stroke-linecap="round"/>' +
        eyes(p, 23, 96, 9) + blush(p, 35, 114, 11);
    },
    beaver(p) {
      const f = '#9a6236', m = '#e2c29c';
      return bust(p, f) + E(100, 176, 30, 26, p.sh(m), '') +
        sym(C(58, 72, 12, p.sh(f), ol(f)) + C(58, 72, 6, p.sh('#5c3418'))) +
        E(100, 102, 54, 48, p.sh(f), ol(f)) +
        E(100, 120, 30, 20, p.sh(m), '') +
        P('M89 126 h10 v14 q-5 3 -10 0Z', '#fffbf0', ol('#d8c8b0', 1.3)) + P('M101 126 h10 v14 q-5 3 -10 0Z', '#fffbf0', ol('#d8c8b0', 1.3)) +
        nose(p, 109, 9, '#3a2014') + '<path d="M100 118v6" stroke="#5c3418" stroke-width="2.4" stroke-linecap="round"/>' +
        sym('<g fill="#5c3418" opacity=".6"><circle cx="82" cy="120" r="1.4"/><circle cx="76" cy="124" r="1.4"/><circle cx="84" cy="126" r="1.4"/></g>') +
        eyes(p, 23, 94, 8.5) + blush(p, 36, 112, 10, '#ff8a6a') +
        // builder's hard hat
        P('M50 76 Q52 30 100 28 Q148 30 150 76Z', p.sh('#f6c22c', { hi: 0.45 }), ol('#f6c22c', 1.6)) +
        P('M93 29 Q100 26 107 29 L109 76 L91 76Z', p.sh('#ffdb5a', { hi: 0.4 })) +
        E(100, 77, 60, 9, p.lin([[0, '#ffd84a'], [1, '#c8920c']], 0, 0, 0, 1), ol('#f6c22c', 1.6));
    },
    squirrel(p) {
      const f = '#d8742c', m = '#f6e0c0';
      const tail = P('M136 214 C200 196 206 112 176 66 C158 38 118 30 108 56 C100 78 128 82 140 92 C160 110 150 168 112 214Z', p.sh('#b8501c', { cx: 0.62, hi: 0.45 }), ol('#8a3410')) +
        '<path d="M164 190 C188 156 192 104 170 72 M150 198 C172 162 174 120 156 94 M128 58 C140 52 156 58 166 70" fill="none" stroke="#ffd8a8" stroke-width="3.4" stroke-linecap="round" opacity=".7"/>';
      return tail + bust(p, f) + E(100, 178, 26, 28, p.sh(m)) +
        sym(G(P('M58 82 L54 30 Q74 40 82 66Z', p.sh(f), ol(f)) + P('M62 74 L59 42 Q71 50 76 66Z', p.sh('#8a3e18')) + '<path d="M54 30 l-4 -8 M55 32 l2 -9 M54 31 l-8 -3" stroke="' + dim(f, 0.2) + '" stroke-width="2.4" stroke-linecap="round"/>')) +
        E(100, 104, 48, 45, p.sh(f), ol(f)) +
        sym(E(80, 122, 15, 11, p.sh(m), '')) + E(100, 126, 15, 11, p.sh(m)) +
        nose(p, 112, 6, '#5a2a1a') + smile(119, 7, '#7a3a1a', 2.2) +
        eyes(p, 21, 96, 9) +
        // sporty headband
        P('M53 80 Q100 60 147 80 L146 90 Q100 71 54 90Z', p.sh('#d62a3a', { hi: 0.4 }), ol('#d62a3a', 1.2)) + P('M54 84 Q100 65 146 84 L146 86 Q100 67 54 86Z', '#fff', ' opacity=".9"');
    },
    tortoise(p) {
      const sk = '#b2c46c', sh = '#9a6428';
      const hexa = (x, y, r, c) => '<path d="' + [0, 1, 2, 3, 4, 5].map((i) => { const a = i * Math.PI / 3; return (i ? 'L' : 'M') + (x + Math.cos(a) * r).toFixed(1) + ' ' + (y + Math.sin(a) * r * 0.86).toFixed(1); }).join('') + 'Z" fill="' + p.sh(c, { hi: 0.42 }) + '" stroke="' + dim(sh, 0.5) + '" stroke-width="2.6" stroke-linejoin="round"/>';
      let scutes = '';
      for (const [x, y, r] of [[100, 62, 22], [58, 84, 22], [142, 84, 22], [28, 124, 22], [172, 124, 22], [62, 128, 18], [138, 128, 18]]) scutes += hexa(x, y, r, '#d8a050');
      return P('M2 214 C2 110 46 40 100 40 C154 40 198 110 198 214Z', p.sh(sh, { cy: 0.2 }), ol(sh)) + scutes +
        P('M78 214 Q74 160 80 136 L120 136 Q126 160 122 214Z', p.sh(sk), ol(sk)) +
        '<path d="M84 170 q16 6 32 0 M84 184 q16 6 32 0" fill="none" stroke="' + dim(sk, 0.3) + '" stroke-width="2" opacity=".6"/>' +
        P('M72 150 Q100 166 128 150 L130 162 Q100 178 70 162Z', p.lin([[0, '#f2e6c4'], [0.25, '#f2e6c4'], [0.25, '#d0463a'], [0.5, '#d0463a'], [0.5, '#f2e6c4'], [0.75, '#f2e6c4'], [0.75, '#d0463a'], [1, '#d0463a']], 0, 0, 1, 0.3), ol('#d0463a', 1.2)) +
        P('M118 160 l14 30 l-14 2 Z', p.sh('#d0463a'), ol('#d0463a', 1.2)) +
        E(100, 112, 44, 38, p.sh(sk), ol(sk)) +
        sym('<g fill="' + lit(sk, 0.45) + '" opacity=".6"><circle cx="78" cy="90" r="3.4"/><circle cx="88" cy="83" r="2.4"/><circle cx="70" cy="101" r="2"/></g>') +
        eyes(p, 19, 110, 8) +
        sym(P('M70 103 Q81 96 92 103 L92 106 Q81 100 70 106Z', p.sh(dim(sk, 0.12)))) +
        smile(127, 13, dim(sk, 0.6), 2.6) + blush(p, 30, 124, 9, '#ff8a7a') +
        sym(C(96, 119, 1.6, dim(sk, 0.55)));
    },
    raccoon(p) {
      const f = '#9a9ca8', w = '#f4f2ee', k = '#26262e';
      return bust(p, '#2a2a34') + P('M60 214 Q64 160 100 156 Q136 160 140 214Z', p.sh('#b8243a', { cy: 0.1 })) +
        sym(G(P('M56 92 L52 40 Q78 46 86 72Z', p.sh(f), ol(f)) + P('M60 82 L58 52 Q74 56 80 72Z', p.sh(k)) + P('M52 40 Q78 46 86 72 L82 72 Q74 50 55 46Z', w, ' opacity=".9"'))) +
        P('M100 54 C134 54 152 76 152 100 L164 112 L148 116 C142 136 124 148 100 148 C76 148 58 136 52 116 L36 112 L48 100 C48 76 66 54 100 54Z', p.sh(f), ol(f)) +
        P('M93 56 Q100 54 107 56 L104 86 L96 86Z', dim(f, 0.4), ' opacity=".7"') +
        // mask
        P('M50 96 Q60 78 80 84 Q92 88 100 96 Q108 88 120 84 Q140 78 150 96 Q146 112 126 112 Q110 110 100 104 Q90 110 74 112 Q54 112 50 96Z', p.sh(k, { hi: 0.25 })) +
        sym(P('M62 80 Q74 70 90 78 Q78 76 66 84Z', w)) +
        E(100, 124, 24, 18, p.sh(w)) +
        nose(p, 112, 7, '#14141a') + smile(124, 7, '#4a4a54', 2.2) +
        eyes(p, 22, 97, 8.5, { ring: '#55565f' }) +
        // magician's top hat with a playing card
        G(E(100, 52, 40, 8, p.sh('#1e1e26'), ol('#1e1e26', 1.4)) +
          P('M70 52 L74 10 Q100 4 126 10 L130 52Z', p.sh('#2a2a36', { hi: 0.3 }), ol('#2a2a36', 1.4)) +
          P('M71 42 L129 42 L130 52 L70 52Z', p.sh('#c8243e')) +
          G(P('M110 18 h16 v22 h-16Z', '#fffdf6', ol('#c8c0b0', 1)) + P('M118 26 c-3 -4 -7 0 0 6 c7 -6 3 -10 0 -6z', '#d0243e'), rot(14, 118, 30)) +
          E(100, 10, 26, 4, '#3a3a48'), rot(-8, 100, 50));
    },
    giraffe(p) {
      const f = '#f0c060', s = '#b0682a', m = '#f8e6c0';
      const spot = (d) => '<path d="' + d + '"/>';
      return P('M24 214 C30 176 64 166 76 152 L76 120 L124 120 L124 152 C136 166 170 176 176 214Z', p.sh(f, { cy: 0.1 }), ol(f)) +
        '<g fill="' + p.sh(s) + '">' + ['M70 170 q10 -8 18 0 q4 10 -6 14 q-12 0 -12 -14z', 'M110 162 q12 -6 20 4 q0 12 -12 12 q-10 -2 -8 -16z', 'M88 196 q10 -6 18 2 q2 12 -10 12 q-10 0 -8 -14z', 'M38 198 q8 -10 18 -2 q4 12 -8 14 q-12 0 -10 -12z', 'M142 192 q10 -8 18 2 q2 12 -10 14 q-12 -2 -8 -16z'].map(spot).join('') + '</g>' +
        sym(G('<path d="M88 54 L82 26" stroke="' + p.lin([[0, dim(f, 0.1)], [1, dim(f, 0.3)]], 0, 0, 1, 0) + '" stroke-width="8.5" stroke-linecap="round"/>' + C(82, 24, 7, p.sh('#7a4418')))) +
        sym(G(E(56, 74, 21, 8.5, p.sh(f), ol(f)) + E(58, 74, 12, 4, p.sh('#eaa4a0')), rot(-24, 56, 74))) +
        P('M100 46 C128 46 142 64 140 88 C139 102 132 108 130 118 C128 136 116 148 100 148 C84 148 72 136 70 118 C68 108 61 102 60 88 C58 64 72 46 100 46Z', p.sh(f), ol(f)) +
        '<g fill="' + p.sh(s) + '">' + ['M70 70 q8 -10 16 -2 q2 8 -6 10 q-10 2 -10 -8z', 'M116 62 q8 -6 14 2 q2 8 -6 10 q-10 0 -8 -12z', 'M95 54 q6 -4 10 2 q0 6 -6 6 q-6 -2 -4 -8z', 'M128 92 q6 -2 8 4 q-2 6 -8 4z', 'M64 94 q6 -4 8 2 q0 6 -6 6z'].map(spot).join('') + '</g>' +
        P('M72 114 C72 104 128 104 128 114 C130 136 116 148 100 148 C84 148 70 136 72 114Z', p.sh(m), ol(m, 1.4)) +
        sym(E(90, 120, 3.4, 4.8, dim(s, 0.45))) + smile(133, 9, dim(s, 0.35), 2.4) +
        eyes(p, 19, 88, 8) +
        sym('<path d="M70 84 l-6 -3 M71 80 l-5 -5" stroke="#3a2010" stroke-width="2" stroke-linecap="round"/>') +
        blush(p, 31, 104, 8, '#ff8a6a') +
        sym(C(81, 88, 13, 'rgba(225,240,255,.14)', ' stroke="' + p.gold() + '" stroke-width="2.6"') + '<path d="M73 81 q4 -4 9 -4" stroke="#fff" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>') +
        '<path d="M94 86 Q100 81 106 86" fill="none" stroke="#c08a36" stroke-width="2.6"/>';
    },
    raven(p) {
      const f = '#2c3046';
      const feathers = (y, n, w, c) => { let s = ''; for (let i = 0; i < n; i++) { const x = 100 + (i - (n - 1) / 2) * w; s += P('M' + (x - w * 0.6) + ' ' + y + ' Q' + x + ' ' + (y + w * 1.2) + ' ' + (x + w * 0.6) + ' ' + y + 'Z', c, ' opacity=".55"'); } return s; };
      return bust(p, f) + feathers(172, 7, 22, lit(f, 0.2)) + feathers(192, 8, 22, lit(f, 0.12)) +
        P('M88 150 L100 160 L112 150 L112 164 L100 158 L88 164Z', p.sh('#6a4a9a', { hi: 0.4 })) +
        sym(P('M84 54 Q80 34 92 30 Q90 44 96 52Z', p.sh(f), ol(f))) + P('M96 52 Q98 24 108 26 Q102 40 104 52Z', p.sh(f), ol(f)) +
        E(100, 98, 48, 48, p.sh(f, { hi: 0.32 }), ol(f)) +
        '<path d="M64 76 Q100 58 136 76" fill="none" stroke="' + lit(f, 0.35) + '" stroke-width="3" opacity=".5" stroke-linecap="round"/>' +
        eyes(p, 22, 92, 10, { ring: '#c8cede', iris: '#20202a' }) +
        P('M84 104 Q100 98 116 104 L104 138 Q100 144 96 138Z', p.lin([[0, '#5a5e6e'], [0.5, '#2a2c36'], [1, '#121318']], 0, 0, 1, 1), ol('#2a2c36', 1.6)) +
        '<path d="M92 108 Q100 105 108 108" stroke="#8a8ea0" stroke-width="2" fill="none" opacity=".7"/>' +
        // monocle and chain
        C(122, 92, 15, 'rgba(220,235,255,.12)', ' stroke="' + p.gold() + '" stroke-width="3.2"') + '<path d="M134 102 Q144 130 128 150" fill="none" stroke="#e0b860" stroke-width="1.8" stroke-dasharray="3 2"/>';
    },
    dragon(p) {
      const f = '#d8432c', b = '#f8c878';
      const horn = P('M70 62 C60 40 56 20 44 10 C66 18 80 38 84 58Z', p.lin([[0, '#fff0c0'], [0.5, '#e8b450'], [1, '#9a6018']], 0, 0, 1, 1), ol('#c08a36', 1.6));
      let belly = '';
      for (let i = 0; i < 4; i++) belly += P('M' + (78 - i * 2) + ' ' + (162 + i * 14) + ' Q100 ' + (170 + i * 14) + ' ' + (122 + i * 2) + ' ' + (162 + i * 14) + ' L' + (124 + i * 2) + ' ' + (174 + i * 14) + ' Q100 ' + (182 + i * 14) + ' ' + (76 - i * 2) + ' ' + (174 + i * 14) + 'Z', p.sh(b, { hi: 0.4 }), ol(b, 1.2));
      return bust(p, f) + belly + sym(horn) +
        sym(P('M52 92 L22 70 L36 98 L24 104 L50 110Z', p.sh('#b83020'), ol(f))) +
        '<g fill="' + p.sh('#f0a040') + '">' + [[84, 52], [100, 46], [116, 52]].map(([x, y]) => '<path d="M' + (x - 7) + ' ' + (y + 8) + ' L' + x + ' ' + (y - 8) + ' L' + (x + 7) + ' ' + (y + 8) + 'Z"/>').join('') + '</g>' +
        E(100, 100, 52, 47, p.sh(f), ol(f)) +
        sym('<path d="M60 116 q6 -4 12 0 M64 126 q6 -4 12 0" fill="none" stroke="' + dim(f, 0.25) + '" stroke-width="2" stroke-linecap="round" opacity=".7"/>') +
        E(100, 122, 28, 19, p.sh('#f2895a'), ol(f, 1.4)) +
        sym(E(90, 116, 3.4, 4.6, '#6a1a10')) + smile(129, 11, '#6a1a10', 2.4) +
        sym(P('M66 82 Q80 72 94 82', 'none', ' stroke="' + dim(f, 0.35) + '" stroke-width="4" stroke-linecap="round"')) +
        eyes(p, 21, 94, 10.5, { iris: '#f4b030', slit: true, ring: '#5a1208' }) +
        // smoke puff
        '<g opacity=".5" fill="#fff"><circle cx="150" cy="112" r="5"/><circle cx="158" cy="104" r="7"/><circle cx="168" cy="96" r="5"/></g>' +
        crown(p, 100, 60, 34);
    },
    redpanda(p) {
      const f = '#c85a28', w = '#fbf3e6', d = '#3a1a10';
      return bust(p, d) + P('M30 214 C34 176 60 160 100 158 C140 160 166 176 170 214Z', p.sh(f, { cy: 0.1 })) +
        // ruby scarf with a gold pin
        P('M64 156 Q100 176 136 156 L138 170 Q100 190 62 170Z', p.sh('#b8325a'), ol('#b8325a', 1.4)) + P('M120 168 l12 26 l-14 2Z', p.sh('#a02a4e'), ol('#b8325a', 1.2)) +
        C(80, 170, 6, p.gold(), ol('#c08a36', 1.2)) +
        sym(G(P('M50 94 Q40 46 70 40 Q90 50 88 70Z', p.sh(f), ol(f)) + P('M56 86 Q50 54 70 50 Q82 58 82 70Z', p.sh(d)) + P('M50 94 Q40 46 70 40 Q66 46 60 50 Q50 64 56 90Z', w, ' opacity=".95"'))) +
        P('M100 56 C134 56 152 78 154 102 L166 116 L150 118 C144 138 124 150 100 150 C76 150 56 138 50 118 L34 116 L46 102 C48 78 66 56 100 56Z', p.sh(f), ol(f)) +
        sym(E(78, 76, 9, 6, w)) +
        P('M58 110 Q62 94 80 102 Q92 108 100 106 Q108 108 120 102 Q138 94 142 110 Q140 140 100 146 Q60 140 58 110Z', p.sh(w), '') +
        sym(P('M74 100 Q70 116 62 126 Q72 122 80 108Z', p.sh('#8a2e14'))) +
        nose(p, 112, 7.5, '#1e100a') + smile(121, 7, '#5a2a1a', 2.2) +
        eyes(p, 21, 94, 8.5) + blush(p, 33, 118, 8);
    },
    cat(p) {
      const f = '#2c2834', gold = p.gold(), lapis = '#2a4aa8', turq = '#3ab0a0', carn = '#c8442e';
      // usekh collar: bands of beads
      let collar = '';
      [[146, '#e8c070'], [155, lapis], [164, '#e8c070'], [173, turq], [182, '#e8c070'], [191, carn], [200, '#e8c070'], [209, lapis]].forEach(([y, c], i) => {
        const d = 'M' + (52 - i * 5) + ' ' + y + ' Q100 ' + (y + 22 + i) + ' ' + (148 + i * 5) + ' ' + y;
        collar += '<path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="' + (c === '#e8c070' ? 4 : 8) + '"/>';
        if (c !== '#e8c070') collar += '<path d="' + d + '" fill="none" stroke="' + lit(c, 0.45) + '" stroke-width="2.4" stroke-dasharray="0.1 6" stroke-linecap="round"/>';
      });
      return bust(p, f) + '<g clip-path="url(#collarclip)">' + collar + '</g>' +
        sym(G(P('M54 92 L56 26 Q80 40 90 64Z', p.sh(f, { hi: 0.35 }), ol(f)) + P('M60 82 L62 40 Q76 50 82 64Z', p.sh('#6a4a5a')))) +
        P('M100 58 C138 58 152 82 150 104 C148 134 126 150 100 150 C74 150 52 134 50 104 C48 82 62 58 100 58Z', p.sh(f, { hi: 0.4 }), ol(f)) +
        // scarab on the brow
        G(E(100, 74, 6, 7.5, gold, ol('#c08a36', 1)) + '<path d="M100 67v15M94 72l-4 -3M106 72l4 -3M94 78l-4 2M106 78l4 2" stroke="#8a5a1e" stroke-width="1.4"/>') +
        // kohl-lined almond eyes, emerald
        sym(P('M66 98 Q80 84 94 96 Q82 108 66 98Z', '#0e0a0c') + P('M64 97 L54 92 L66 100Z', '#0e0a0c')) +
        eye(p, 80, 96, 7.5, { iris: '#3ac07a', slit: true }) + eye(p, 120, 96, 7.5, { iris: '#3ac07a', slit: true }) +
        C(57, 88, 6, 'none', ' stroke="' + gold + '" stroke-width="2.8"') +
        E(100, 124, 20, 14, p.sh(lit(f, 0.12))) +
        P('M95 114 L105 114 L100 120Z', p.sh('#d07a8a', { hi: 0.4 })) + smile(122, 6, '#8a7a8a', 2) +
        sym('<path d="M84 122 L58 116 M84 126 L60 128" stroke="#cfc6d6" stroke-width="1.4" stroke-linecap="round" opacity=".8"/>');
    },
    owl(p) {
      const f = '#9a7450', disc = '#efe2c6';
      let spots = '';
      for (const [x, y] of [[74, 62], [86, 54], [100, 52], [114, 54], [126, 62], [66, 74], [134, 74]]) spots += C(x, y, 2.6, '#fff', ' opacity=".85"');
      let chest = '';
      for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r % 2); i++) { const x = 76 + i * 16 + (r % 2) * 8, y = 166 + r * 13; chest += '<path d="M' + (x - 4) + ' ' + y + ' L' + x + ' ' + (y + 5) + ' L' + (x + 4) + ' ' + y + '" fill="none" stroke="' + dim(f, 0.3) + '" stroke-width="2.2" stroke-linecap="round"/>'; }
      return bust(p, f) + E(100, 186, 40, 34, p.sh('#f2e6cc')) + chest +
        P('M100 48 C146 48 158 82 156 108 C154 138 130 152 100 152 C70 152 46 138 44 108 C42 82 54 48 100 48Z', p.sh(f), ol(f)) + spots +
        sym(C(78, 100, 24, p.sh(disc, { hi: 0.4 }), ol(disc, 1.4))) +
        sym(P('M56 82 Q76 72 98 90', 'none', ' stroke="#fff" stroke-width="4.5" stroke-linecap="round"')) +
        eye(p, 78, 100, 14, { iris: '#ffc83a', ring: dim(disc, 0.25) }) + eye(p, 122, 100, 14, { iris: '#ffc83a', ring: dim(disc, 0.25) }) +
        P('M92 108 Q100 104 108 108 L100 126Z', p.sh('#d8b878', { hi: 0.4 }), ol('#a8884a', 1.4)) +
        laurel(p, 62, 40, '#7a9a5a', '#4a5a7a');
    },
    wolf(p) {
      const f = '#8c909c', w = '#efece6';
      return bust(p, '#a8202e') + P('M40 214 Q50 166 100 160 Q150 166 160 214 L150 214 Q140 176 100 172 Q60 176 50 214Z', p.lin([[0, '#f5d98e'], [1, '#a8742a']], 0, 0, 0, 1)) +
        C(64, 180, 9, p.gold(), ol('#c08a36', 1.4)) + C(64, 180, 4, p.sh('#c8243e', { hi: 0.5 })) +
        sym(G(P('M56 96 L60 28 Q86 46 92 70Z', p.sh(f), ol(f)) + P('M62 86 L64 44 Q80 56 84 70Z', p.sh('#5a4048')))) +
        P('M100 54 C136 54 150 78 152 98 L168 128 L146 126 C138 142 120 152 100 152 C80 152 62 142 54 126 L32 128 L48 98 C50 78 64 54 100 54Z', p.sh(f), ol(f)) +
        P('M100 60 Q108 70 104 90 L96 90 Q92 70 100 60Z', dim(f, 0.3), ' opacity=".6"') +
        P('M54 112 Q70 104 86 110 Q96 116 100 116 Q104 116 114 110 Q130 104 146 112 Q140 140 100 148 Q60 140 54 112Z', p.sh(w), '') +
        E(100, 124, 20, 16, p.sh(w), ol(w, 1.2)) +
        nose(p, 112, 9, '#16141a') + smile(126, 8, '#4a4650', 2.4) +
        eyes(p, 22, 96, 8.5, { iris: '#eab04a' }) +
        sym(P('M68 86 Q80 80 92 88', 'none', ' stroke="' + dim(f, 0.4) + '" stroke-width="3" stroke-linecap="round"')) +
        // golden laurel crown
        laurel(p, 64, 38, '#e0b050');
    },
    elephant(p) {
      const f = '#a4a6b8', pink = '#e8b4b8';
      let saddle = '';
      for (let i = 0; i < 9; i++) saddle += C(36 + i * 16, 168 + Math.abs(i - 4) * -2 + 6, 3, '#f5d98e');
      return bust(p, '#0f5a3e') + P('M20 214 C24 180 56 164 100 164 C144 164 176 180 180 214 L170 214 C166 186 140 176 100 176 C60 176 34 186 30 214Z', p.lin([[0, '#f5d98e'], [1, '#a8742a']], 0, 0, 0, 1)) + saddle +
        sym(G(P('M64 66 C30 50 10 84 18 116 C24 140 50 148 70 132 Z', p.sh(f), ol(f)) + P('M60 76 C38 66 26 90 30 112 C34 128 50 134 64 124Z', p.sh(pink, { hi: 0.3 })))) +
        E(100, 92, 44, 42, p.sh(f), ol(f)) +
        // trunk, curled up for luck, with tusks
        sym(P('M84 122 Q76 134 66 136 Q74 128 78 120Z', p.sh('#fffbee'), ol('#d8d0c0', 1.2))) +
        P('M88 104 C86 130 90 150 104 162 C118 172 134 166 136 150 C137 142 128 140 126 148 C124 156 114 156 110 146 C106 136 112 118 112 104Z', p.sh(f), ol(f)) +
        '<path d="M92 120h18M93 130h17M96 140h15" stroke="' + dim(f, 0.25) + '" stroke-width="1.6" stroke-linecap="round"/>' +
        eyes(p, 21, 92, 7) + sym('<path d="M72 86 l-5 -4 M75 84 l-3 -6" stroke="#2a2030" stroke-width="2" stroke-linecap="round"/>') +
        blush(p, 32, 108, 9) +
        // jewelled headpiece
        P('M66 64 Q100 44 134 64 L126 70 Q100 56 74 70Z', p.gold(), ol('#c08a36', 1.2)) +
        '<path d="M80 66 L84 80 M120 66 L116 80 M90 60 L92 76 M110 60 L108 76" stroke="#f5d98e" stroke-width="1.6" stroke-dasharray="2 2"/>' +
        P('M100 52 Q110 64 100 80 Q90 64 100 52Z', p.sh('#d01a44', { hi: 0.5 }), ol('#c08a36', 1.6)) + C(100, 84, 3.2, '#fffaf0');
    },
    panda(p) {
      const w = '#f7f5f0', k = '#1e1c22';
      return bust(p, k) + P('M40 214 Q50 168 100 164 Q150 168 160 214Z', p.sh('#c8302a', { cy: 0.1 })) +
        P('M76 166 L100 196 L124 166 L118 164 L100 184 L82 164Z', p.lin([[0, '#f5d98e'], [1, '#a8742a']], 0, 0, 0, 1)) +
        sym(C(58, 62, 17, p.sh(k, { hi: 0.25 }), ol(k))) +
        // bamboo sprig behind the right ear
        G('<path d="M150 70 L176 20" stroke="' + p.lin([[0, '#9ad06a'], [1, '#4a8a3a']], 0, 0, 1, 0) + '" stroke-width="6" stroke-linecap="round"/><path d="M158 56 l6 -2 M166 40 l6 -2" stroke="#2a5a2a" stroke-width="2"/>' +
          E(176, 36, 12, 4, p.sh('#6ab04a'), rot(-30, 176, 36)) + E(168, 26, 11, 4, p.sh('#6ab04a'), rot(40, 168, 26))) +
        E(100, 102, 56, 48, p.sh(w), ol('#c8c4bc')) +
        sym(E(78, 98, 13, 18, p.sh(k, { hi: 0.2 }), rot(28, 78, 98))) +
        eyes(p, 21, 96, 6.5, { ring: '#4a4450' }) +
        E(100, 122, 22, 16, p.sh('#ffffff'), '') +
        nose(p, 114, 8, '#141218') + smile(124, 7, '#3a3640', 2.2) +
        blush(p, 36, 120, 9);
    },
    lion(p) {
      const f = '#e8b45c', mane = '#b8662a';
      // wings of the lion of Saint Mark
      const wing = (() => {
        let s = '';
        for (let i = 0; i < 6; i++) { const a = -74 + i * 12, len = 100 - i * 7; s += E(62, 146 - len / 2 - 6, 9.5, len / 2 + 6, p.lin([[0, '#fffaf0'], [0.6, '#f6dfa0'], [1, '#d8a850']], 0, 0, 0, 1), rot(a, 62, 146) + ' stroke="#b8862e" stroke-width="1.6"'); }
        for (let i = 0; i < 4; i++) { const a = -64 + i * 15; s += E(66, 128, 7, 18, p.sh('#fff2d0', { hi: 0.4 }), rot(a, 66, 146) + ' stroke="#b8862e" stroke-width="1.4"'); }
        return s;
      })();
      let lobes = '';
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, x = 100 + Math.cos(a) * 46, y = 96 + Math.sin(a) * 44; lobes += E(x.toFixed(1), y.toFixed(1), 18, 13, p.sh(i % 2 ? mane : '#c87a34'), rot((a * 180 / Math.PI).toFixed(1), x.toFixed(1), y.toFixed(1)) + ol(mane, 1.4)); }
      return C(100, 92, 70, 'none', ' stroke="' + p.gold() + '" stroke-width="4" opacity=".9"') + C(100, 92, 74, 'none', ' stroke="#ffe9a8" stroke-width="1.2" opacity=".6"') +
        sym(wing) + bust(p, '#1a3a8a') + P('M66 160 Q100 178 134 160 L134 170 Q100 188 66 170Z', p.lin([[0, '#f5d98e'], [1, '#a8742a']], 0, 0, 0, 1)) +
        lobes + C(100, 96, 46, p.sh(mane), '') +
        sym(C(68, 64, 9, p.sh(f), ol(f)) + C(68, 64, 4.5, p.sh('#8a4a1a'))) +
        E(100, 100, 40, 38, p.sh(f), ol(f)) +
        sym(E(91, 120, 11, 9, p.sh('#fbe8c0'))) + E(100, 128, 8, 5, p.sh('#fbe8c0')) +
        nose(p, 109, 8, '#7a3a1a') + '<path d="M100 117v4" stroke="#7a3a1a" stroke-width="2"/>' +
        eyes(p, 17, 94, 7.5, { iris: '#c8862a' }) + blush(p, 28, 112, 7);
    },
    bear(p) {
      const f = '#8a5634', m = '#dcb88c';
      return bust(p, '#0f5a3e') + P('M60 158 L66 214 L76 214 L72 160Z M140 158 L134 214 L124 214 L128 160Z', p.lin([[0, '#f5d98e'], [1, '#a8742a']], 0, 0, 0, 1)) +
        '<g stroke="#f5d98e" stroke-width="2.6" stroke-linecap="round"><path d="M84 176h32M84 188h32M84 200h32"/></g>' +
        sym(C(58, 64, 16, p.sh(f), ol(f)) + C(58, 64, 8, p.sh(m))) +
        E(100, 102, 54, 48, p.sh(f), ol(f)) +
        E(100, 122, 25, 19, p.sh(m), '') +
        nose(p, 111, 10, '#24140c') + smile(124, 9, '#4a2a18', 2.6) +
        eyes(p, 22, 96, 8) + blush(p, 36, 114, 9) +
        // small fur hat with a velvet top and a little jewelled egg
        P('M70 64 Q72 40 100 38 Q128 40 130 64Z', p.sh('#0f6a46', { hi: 0.4 }), ol('#0f6a46', 1.4)) +
        '<path d="M78 46 L122 60 M122 46 L78 60" stroke="#f5d98e" stroke-width="2"/>' +
        P('M66 62 Q100 50 134 62 L134 76 Q100 66 66 76Z', p.sh('#5a3a2a', { hi: 0.25 }), ol('#3a2418', 1.4)) +
        '<path d="M70 66 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0 q4 4 8 0" fill="none" stroke="#7a5a48" stroke-width="1.6"/>' +
        E(100, 64, 6, 7.5, p.sh('#d23a6a', { hi: 0.5 }), ol('#c08a36', 1.4)) + '<path d="M94 64h12" stroke="#f5d98e" stroke-width="1.4"/>';
    },
    rooster(p) {
      const w = '#fbf3e4', cb = '#d8283a', bl = '#1f3a8a';
      return bust(p, bl) +
        // blue coat with a red-white-blue rosette and a silk cravat
        P('M74 150 Q100 170 126 150 L130 164 Q100 186 70 164Z', p.sh('#fbfaf6'), ol('#d8d4cc', 1.2)) +
        C(132, 182, 11, p.sh(cb, { hi: 0.4 }), ol(cb, 1.2)) + C(132, 182, 7, '#fbfaf6') + C(132, 182, 3.6, p.sh(bl, { hi: 0.4 })) +
        // tail feathers fanning up behind the head
        sym(P('M150 128 Q186 98 176 54 Q170 92 146 112Z', p.sh('#1d6a4a', { hi: 0.45 }), ol('#1d6a4a', 1.2)) + P('M146 136 Q178 122 186 90 Q170 112 142 122Z', p.sh('#c86a1a', { hi: 0.45 }), ol('#c86a1a', 1.2))) +
        // the comb, then the head
        P('M78 62 Q74 40 88 42 Q88 26 100 32 Q108 18 116 32 Q130 28 124 46 Q136 48 128 64Z', p.sh(cb, { hi: 0.45 }), ol(cb, 1.4)) +
        P('M100 54 C138 54 148 80 148 104 C148 134 126 154 100 154 C74 154 52 134 52 104 C52 80 62 54 100 54Z', p.sh(w), ol('#d8c8a8')) +
        sym(P('M62 128 Q72 148 96 150 Q78 140 74 122Z', p.sh('#e8b060', { hi: 0.3 }), ' opacity=".7"')) +
        eyes(p, 22, 96, 8.5, { iris: '#5a3a1a', ring: '#f0c040' }) + blush(p, 36, 116, 8) +
        // beak and wattles
        P('M88 108 Q100 100 112 108 L100 126Z', p.lin([[0, '#ffe07a'], [0.6, '#f0a820'], [1, '#b87010']], 0, 0, 1, 1), ol('#c08020', 1.4)) +
        '<path d="M89 112 L111 112" stroke="#b87010" stroke-width="1.4"/>' +
        E(94, 136, 6, 9, p.sh(cb, { hi: 0.45 }), ol(cb, 1.2)) + E(106, 136, 6, 9, p.sh(cb, { hi: 0.45 }), ol(cb, 1.2)) +
        // a little painter's beret, tipped to one side
        P('M60 66 Q66 42 100 40 Q140 40 146 60 Q120 70 60 66Z', p.sh('#2a2440', { hi: 0.35 }), ol('#2a2440', 1.4)) + P('M104 40 L108 32 L112 40Z', '#2a2440');
    },
    eagle(p) {
      const w = '#f6f4ef', br = '#5a3820';
      let fe = '';
      for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const x = 28 + i * 24 + (r % 2) * 12, y = 172 + r * 14; fe += P('M' + (x - 13) + ' ' + y + ' Q' + x + ' ' + (y + 16) + ' ' + (x + 13) + ' ' + y + 'Z', lit(br, 0.18), ' opacity=".5"'); }
      return bust(p, br) + fe +
        // white silk scarf
        P('M68 150 Q100 168 132 150 L136 162 Q100 182 64 162Z', p.sh('#fbfaf6'), ol('#d8d4cc', 1.2)) + P('M112 166 Q120 190 106 210 L96 206 Q108 188 100 170Z', p.sh('#fbfaf6'), ol('#d8d4cc', 1.2)) +
        P('M100 50 C138 50 150 76 150 100 L160 112 L146 116 C140 138 122 154 100 154 C78 154 60 138 54 116 L40 112 L50 100 C50 76 62 50 100 50Z', p.sh(w), ol('#c8c4bc')) +
        sym(P('M64 86 Q80 76 96 86', 'none', ' stroke="#b8b0a4" stroke-width="3.5" stroke-linecap="round"')) +
        eyes(p, 21, 96, 8.5, { iris: '#3a2a1a', ring: '#f0c040' }) +
        P('M84 104 Q100 96 116 104 Q118 122 104 134 Q100 138 98 132 Q102 124 96 120 Q84 116 84 104Z', p.lin([[0, '#ffe07a'], [0.6, '#f0a820'], [1, '#b87010']], 0, 0, 1, 1), ol('#c08020', 1.4)) +
        // aviator goggles pushed up
        P('M50 72 Q100 50 150 72 L150 82 Q100 60 50 82Z', p.sh('#7a4a2a'), ol('#5a3420', 1.2)) +
        sym(C(80, 66, 13, p.gold(), ol('#c08a36', 1.4)) + C(80, 66, 9, p.rad([[0, '#bfe4ff'], [0.6, '#3a7ab8'], [1, '#1a3a6a']], 0.35, 0.3, 0.8)) + E(77, 62, 3.5, 2, '#fff', ' opacity=".85"'));
    },
  };

  // ------------------------------------------------------------ medallions
  // The bezel: a polished gold band lit from the top left, with an engraved inner step.
  function ring(p, r) {
    p.raw('bezel', '<filter id="bezel" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">' +
      '<feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="h"/>' +
      '<feSpecularLighting in="h" surfaceScale="5" specularConstant="1.15" specularExponent="22" lighting-color="#fff6dc" result="sp"><feDistantLight azimuth="225" elevation="42"/></feSpecularLighting>' +
      '<feComposite in="sp" in2="SourceAlpha" operator="in" result="spi"/>' +
      '<feComposite in="SourceGraphic" in2="spi" operator="arithmetic" k2="1" k3=".85"/></filter>');
    let ticks = '';
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2, r0 = r - 7.4, r1 = r - (i % 4 ? 5.2 : 3.6);
      ticks += 'M' + (100 + Math.cos(a) * r0).toFixed(2) + ' ' + (100 + Math.sin(a) * r0).toFixed(2) + 'L' + (100 + Math.cos(a) * r1).toFixed(2) + ' ' + (100 + Math.sin(a) * r1).toFixed(2);
    }
    const band = p.lin([[0, '#fff0c0'], [0.22, '#e2b45e'], [0.48, '#8a5a1c'], [0.7, '#e8c278'], [1, '#6a3e10']], 0.15, 0, 0.85, 1);
    return '<g filter="url(#bezel)">' + C(100, 100, r, band) + C(100, 100, r - 9.5, p.lin([[0, '#5a3610'], [1, '#f4d48a']], 0.2, 0, 0.8, 1)) + '</g>' +
      '<path d="' + ticks + '" stroke="#5a3410" stroke-opacity=".55" stroke-width=".9"/>' +
      C(100, 100, r - 0.6, 'none', ' stroke="#2a1404" stroke-opacity=".7" stroke-width="1.2"') +
      C(100, 100, r - 10.2, 'none', ' stroke="#fff4d0" stroke-opacity=".55" stroke-width=".8"');
  }
  // Translucent enamel over an engraved guilloche ground, as on a jeweller's medal.
  function field(p, r, from, to, rays) {
    let s = C(100, 100, r, p.rad([[0, lit(from, 0.22)], [0.5, from], [1, dim(to, 0.2)]], 0.5, 0.4, 0.66));
    if (rays !== false) {
      let d = '';
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        d += 'M100 100';
        for (let k = 1; k <= 12; k++) { const rr = r * k / 12, w = a + Math.sin(k * 0.9) * 0.05; d += 'L' + (100 + Math.cos(w) * rr).toFixed(1) + ' ' + (100 + Math.sin(w) * rr).toFixed(1); }
      }
      s += '<path d="' + d + '" fill="none" stroke="' + lit(from, 0.6) + '" stroke-opacity=".09" stroke-width=".7"/>';
      for (let k = 1; k < 7; k++) s += C(100, 100, (r * k / 7).toFixed(1), 'none', ' stroke="' + dim(to, 0.4) + '" stroke-opacity=".12" stroke-width=".6"');
    }
    // a pool of light behind the subject and a glassy sheen across the top
    s += E(100, 84, r * 0.62, r * 0.56, p.rad([[0, lit(from, 0.5), 0.45], [1, from, 0]], 0.5, 0.5, 0.5));
    s += P('M' + (100 - r * 0.86) + ' 82 Q100 ' + (100 - r * 1.25) + ' ' + (100 + r * 0.86) + ' 82 Q100 ' + (100 - r * 0.7) + ' ' + (100 - r * 0.86) + ' 82Z', '#fff', ' opacity=".07"');
    return s;
  }
  const SOFT = '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>' +
    '<filter id="lift" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="3" stdDeviation="3.2" flood-color="#000" flood-opacity=".38"/></filter>';
  // Glazes a drawn animal like cloisonne enamel: its gold wires (ol) and the glass between them
  // catch the light from the top left as one domed, polished surface.
  const ENAMEL = '<filter id="enamel" x="-6%" y="-6%" width="112%" height="112%" color-interpolation-filters="sRGB">' +
    '<feGaussianBlur in="SourceAlpha" stdDeviation="4" result="dome"/>' +
    '<feSpecularLighting in="dome" surfaceScale="4" specularConstant=".85" specularExponent="26" lighting-color="#ffffff" result="gl"><feDistantLight azimuth="225" elevation="50"/></feSpecularLighting>' +
    '<feComposite in="gl" in2="SourceAlpha" operator="in" result="gli"/>' +
    '<feComposite in="SourceGraphic" in2="gli" operator="arithmetic" k2="1" k3=".5"/></filter>';

  // Every field of colour in a portrait gets its gold wire: shapes drawn without an edge get a
  // fine one, except the eyes, highlights and the smallest beads.
  function cloisons(body) {
    return body.split(/(<g class="eye">[\s\S]*?<\/g>)/).map((part) => part.startsWith('<g class="eye">') ? part :
      part.replace(/<(path|ellipse|circle)\b([^>]*?)\/>/g, (m, tag, attrs) => {
        if (/ stroke=| opacity=|fill="none"|fill="#fff"/.test(attrs)) return m;
        const r = +((attrs.match(/ r(?:x)?="([\d.]+)"/) || [])[1] || 99);
        return r < 4 ? m : '<' + tag + attrs + ' stroke="#d6aa58" stroke-width="1.1" stroke-linejoin="round"/>';
      })).join('');
  }
  // portrait(animal, { from, to, ring: true|false, bare: true for no background })
  function portrait(animal, o) {
    o = o || {};
    const draw = ANIMALS[animal] || ANIMALS.bunny;
    const p = pic();
    p.raw('soft', SOFT);
    p.raw('enamel', ENAMEL);
    const r = o.ring === false ? 100 : 97, inner = o.ring === false ? 100 : 87;
    p.raw('clip', '<clipPath id="inner"><circle cx="100" cy="100" r="' + inner + '"/></clipPath><clipPath id="collarclip"><path d="M14 214 C18 168 58 148 100 148 C142 148 182 168 186 214 Z"/></clipPath>');
    const from = o.from || '#b8325a', to = o.to || '#3a0c1a';
    const bg = o.bare ? '' : field(p, inner, from, to);
    const body = cloisons(draw(p));
    const out = (o.ring === false ? '' : ring(p, r)) + '<g clip-path="url(#inner)">' + bg + '<g filter="url(#lift)"><g filter="url(#enamel)">' + body + '</g></g>' +
      // soft inner shading at the rim
      C(100, 100, inner, p.rad([[0.7, '#000', 0], [1, '#000', 0.35]], 0.5, 0.5, 0.5)) + '</g>';
    return svg(p, '0 0 200 200', out);
  }

  // ------------------------------------------------------------ piece silhouettes
  // Staunton silhouettes in a 100 × 100 box, base on y = 92.
  const PIECE = {
    p: 'M30 92 Q28 85 35 83 L40 81 Q41 72 44 62 L40 61 Q37 57 42 55 L45 54 A13.5 13.5 0 1 1 55 54 L58 55 Q63 57 60 61 L56 62 Q59 72 60 81 L65 83 Q72 85 70 92Z',
    r: 'M26 92 Q24 85 31 83 L36 81 Q37 66 38 46 L34 44 L34 24 L42 24 L42 30 L47 30 L47 24 L53 24 L53 30 L58 30 L58 24 L66 24 L66 44 L62 46 Q63 66 64 81 L69 83 Q76 85 74 92Z',
    b: 'M28 92 Q26 85 33 83 L39 81 Q40 72 43 62 L37 60 Q34 56 40 54 L42 53 Q32 42 38 30 Q43 21 50 16 L52 26 L47 36 L49 38 L56 24 Q66 34 60 46 Q57 51 58 53 L60 54 Q66 56 63 60 L57 62 Q60 72 61 81 L67 83 Q74 85 72 92Z M50 8 A5 5 0 1 1 50 18 A5 5 0 1 1 50 8Z',
    q: 'M26 92 Q24 85 31 83 L37 81 Q39 70 42 58 L36 56 Q33 52 38 50 L40 49 L30 28 L40 36 L42 22 L48 34 L50 18 L52 34 L58 22 L60 36 L70 28 L60 49 L62 50 Q67 52 64 56 L58 58 Q61 70 63 81 L69 83 Q76 85 74 92Z M30 20 A4 4 0 1 1 30 28 A4 4 0 1 1 30 20Z M42 15 A4 4 0 1 1 42 23 A4 4 0 1 1 42 15Z M50 10 A4.5 4.5 0 1 1 50 19 A4.5 4.5 0 1 1 50 10Z M58 15 A4 4 0 1 1 58 23 A4 4 0 1 1 58 15Z M70 20 A4 4 0 1 1 70 28 A4 4 0 1 1 70 20Z',
    k: 'M26 92 Q24 85 31 83 L37 81 Q39 68 42 56 L36 54 Q33 50 38 48 L40 47 Q30 40 32 32 Q36 24 46 28 L47 22 L43 22 L43 17 L47 17 L47 12 L53 12 L53 17 L57 17 L57 22 L53 22 L54 28 Q64 24 68 32 Q70 40 60 47 L62 48 Q67 50 64 54 L58 56 Q61 68 63 81 L69 83 Q76 85 74 92Z',
    n: 'M28 92 Q26 85 33 83 L38 81 Q36 70 40 62 Q46 52 50 46 Q40 50 34 56 Q28 60 24 56 Q20 52 24 46 Q34 36 40 28 Q42 22 46 18 L46 10 L52 16 Q58 14 64 18 Q76 26 78 44 Q80 62 72 81 L67 83 Q74 85 72 92Z',
  };
  const PIECE_EYE = { n: [56, 28, 2.4] };
  function pieceSvg(type, o) {
    o = o || {};
    const p = pic();
    const fill = o.fill || p.lin([[0, '#fff3c4'], [0.35, '#f0cf7e'], [0.7, '#c08a36'], [1, '#7a4a14']], 0.2, 0, 0.8, 1);
    const eyeDot = PIECE_EYE[type] ? C(PIECE_EYE[type][0], PIECE_EYE[type][1], PIECE_EYE[type][2], o.ink || '#5a3410') : '';
    const mitre = type === 'b' ? '' : '';
    return svg(p, '0 0 100 100', P(PIECE[type] || PIECE.p, fill, ' stroke="' + (o.stroke || '#7a4a14') + '" stroke-width="1.6" stroke-linejoin="round" fill-rule="nonzero"') + eyeDot + mitre);
  }

  // ------------------------------------------------------------ emblems
  function emblemBody(p, kind) {
    if (kind === 'crown') return G(crown(p, 100, 132, 96), '');
    if (kind === 'cocoa') {
      return G(E(100, 104, 34, 54, p.sh('#b86a2a', { hi: 0.4 }), ol('#8a4a1a') + rot(-24, 100, 104)) +
        '<g transform="rotate(-24 100 104)" fill="none" stroke="#7a3a12" stroke-width="2.2" opacity=".75"><path d="M100 52 Q86 104 100 156"/><path d="M100 52 Q114 104 100 156"/><path d="M100 52 Q72 104 100 156"/><path d="M100 52 Q128 104 100 156"/></g>' +
        P('M118 48 Q132 30 150 34 Q140 46 124 54Z', p.sh('#5a8a3a'), ol('#3a6a2a', 1.4)));
    }
    if (kind === 'wheat') {
      let s = '';
      for (let k = -2; k <= 2; k++) {
        const a = k * 13, top = 40 + Math.abs(k) * 8;
        let ear = '<path d="M100 150 L100 ' + (top + 30) + '" stroke="#b07a2a" stroke-width="3" fill="none"/>';
        for (let i = 0; i < 5; i++) { const y = top + 6 + i * 6; ear += E(95.5, y, 4, 7, p.sh('#f2c462', { hi: 0.45 }), rot(-24, 95.5, y) + ol('#c08a36', 1)) + E(104.5, y, 4, 7, p.sh('#f2c462', { hi: 0.45 }), rot(24, 104.5, y) + ol('#c08a36', 1)); }
        ear += E(100, top, 3.6, 7, p.sh('#f6d070', { hi: 0.45 }), ol('#c08a36', 1));
        s += G(ear, rot(a, 100, 150));
      }
      return s + P('M84 128 Q100 138 116 128 L118 138 Q100 148 82 138Z', p.sh('#b8325a'), ol('#b8325a', 1.2)) + P('M98 136 L84 160 L92 160 L100 142 L108 160 L116 160 L102 136Z', p.sh('#a02a4e'));
    }
    return '';
  }
  // A round enamel medal: a gold piece, emblem or animal on a coloured field.
  function medal(art, o) {
    o = o || {};
    const [kind, name] = String(art || 'piece:n').split(':');
    if (kind === 'animal') return portrait(name, o);
    const p = pic();
    p.raw('soft', SOFT);
    const r = o.ring === false ? 100 : 97, inner = o.ring === false ? 100 : 87;
    p.raw('clip', '<clipPath id="inner"><circle cx="100" cy="100" r="' + inner + '"/></clipPath>');
    let body;
    if (kind === 'piece' && ART_IMG.piece[name]) {
      // the real gold piece, rendered from the 3D set (tools/shoot-art.js), standing in a pool of light
      body = E(100, 160, 40, 7, 'rgba(0,0,0,.55)', ' filter="url(#soft)"') +
        '<image href="' + ART_IMG.piece[name] + '" x="34" y="26" width="132" height="138" preserveAspectRatio="xMidYMax meet"/>';
    } else if (kind === 'piece') {
      const fill = p.lin([[0, '#fff3c4'], [0.35, '#f0cf7e'], [0.7, '#c08a36'], [1, '#7a4a14']], 0.2, 0, 0.8, 1);
      body = '<g transform="translate(30 26) scale(1.4)">' + P(PIECE[name] || PIECE.n, fill, ' stroke="#6a3e10" stroke-width="1.4" stroke-linejoin="round"') + (PIECE_EYE[name] ? C(PIECE_EYE[name][0], PIECE_EYE[name][1], PIECE_EYE[name][2], '#5a3410') : '') + '</g>';
    } else body = emblemBody(p, name);
    const out = (o.ring === false ? '' : ring(p, r)) + '<g clip-path="url(#inner)">' + field(p, inner, o.from || '#a3294f', o.to || '#4a0c1e') +
      (kind === 'piece' && ART_IMG.piece[name] ? body : '<g filter="url(#lift)">' + body + '</g>') + C(100, 100, inner, p.rad([[0.7, '#000', 0], [1, '#000', 0.35]], 0.5, 0.5, 0.5)) + '</g>';
    return svg(p, '0 0 200 200', out);
  }

  // The Chackmate crest: a gold knight on ruby enamel inside a laurel.
  function crest(o) {
    o = o || {};
    const p = pic();
    // The game's crest: the rendered gold knight (src/crest.webp, the same picture as the website)
    // in the gold ring. The drawn knight below stays for builds without it (Node tests).
    if (typeof CHACKLATE_CREST !== 'undefined') {
      p.raw('clip', '<clipPath id="inner"><circle cx="100" cy="100" r="86"/></clipPath>');
      const out = ring(p, 96) + '<image href="' + CHACKLATE_CREST + '" x="13" y="13" width="174" height="174" clip-path="url(#inner)"/>' +
        C(100, 100, 86, 'none', ' stroke="#3a1a06" stroke-opacity=".6" stroke-width="1.2"');
      return svg(p, '0 0 200 200', out, o.size ? ' width="' + o.size + '" height="' + o.size + '"' : '');
    }
    p.raw('soft', SOFT);
    p.raw('clip', '<clipPath id="inner"><circle cx="100" cy="100" r="80"/></clipPath>');
    const fill = p.lin([[0, '#fff6d0'], [0.3, '#f3d38a'], [0.65, '#c8923e'], [1, '#7a4a14']], 0.2, 0, 0.8, 1);
    const out = ring(p, 96) + '<g clip-path="url(#inner)">' + field(p, 80, '#9a1e40', '#3a0616') +
      '<g filter="url(#lift)">' + wreath(p, 100, 100, 62, '#e8c070', 8) + '<g transform="translate(36 30) scale(1.28)">' + P(PIECE.n, fill, ' stroke="#5a3010" stroke-width="1.4" stroke-linejoin="round"') + C(PIECE_EYE.n[0], PIECE_EYE.n[1], PIECE_EYE.n[2], '#5a2410') + '</g></g>' +
      C(100, 100, 80, p.rad([[0.7, '#000', 0], [1, '#000', 0.4]], 0.5, 0.5, 0.5)) + '</g>';
    return svg(p, '0 0 200 200', out, o.size ? ' width="' + o.size + '" height="' + o.size + '"' : '');
  }

  // ------------------------------------------------------------ era landmarks
  // Silhouettes in a 400 × 160 box, ground on y = 160.
  const arch = (x, top, bot, w) => 'M' + x + ' ' + bot + ' L' + x + ' ' + (top + w / 2) + ' A' + (w / 2) + ' ' + (w / 2) + ' 0 0 1 ' + (x + w) + ' ' + (top + w / 2) + ' L' + (x + w) + ' ' + bot + 'Z';
  const onion = (x, base, w, h) => 'M' + (x - w) + ' ' + base + ' C' + (x - w * 1.55) + ' ' + (base - h * 0.42) + ' ' + (x - w * 0.15) + ' ' + (base - h * 0.72) + ' ' + x + ' ' + (base - h) + ' C' + (x + w * 0.15) + ' ' + (base - h * 0.72) + ' ' + (x + w * 1.55) + ' ' + (base - h * 0.42) + ' ' + (x + w) + ' ' + base + 'Z M' + (x - 1.2) + ' ' + (base - h + 1) + ' L' + x + ' ' + (base - h - 14) + ' L' + (x + 1.2) + ' ' + (base - h + 1) + 'Z';
  const palm = (x, base, h, lean) => {
    const tx = x + lean, ty = base - h;
    let d = 'M' + (x - 2.5) + ' ' + base + ' Q' + (x + lean * 0.2) + ' ' + (base - h * 0.5) + ' ' + (tx - 1.5) + ' ' + ty + ' L' + (tx + 1.5) + ' ' + ty + ' Q' + (x + lean * 0.2 + 3) + ' ' + (base - h * 0.5) + ' ' + (x + 2.5) + ' ' + base + 'Z';
    for (const [dx, dy] of [[-24, 8], [-18, -6], [0, -12], [18, -6], [24, 8]]) d += ' M' + tx + ' ' + ty + ' Q' + (tx + dx * 0.5) + ' ' + (ty + dy - 8) + ' ' + (tx + dx) + ' ' + (ty + dy) + ' Q' + (tx + dx * 0.5) + ' ' + (ty + dy - 3) + ' ' + tx + ' ' + (ty + 2) + 'Z';
    return d;
  };
  const LANDMARKS = {
    pyramids: 'M0 160 L0 152 Q60 146 96 150 L160 66 L238 160Z M196 160 L268 96 L340 160Z M318 160 L352 130 L386 160Z ' + palm(40, 156, 46, -8) + ' ' + palm(66, 158, 34, 6),
    parthenon: (() => {
      let d = 'M70 160 L70 150 L80 150 L80 142 L320 142 L320 150 L330 150 L330 160Z M84 72 L200 40 L316 72Z M82 84 L82 72 L318 72 L318 84Z';
      for (let i = 0; i < 9; i++) { const x = 92 + i * 26; d += ' M' + x + ' 142 L' + (x + 1) + ' 90 L' + (x - 1) + ' 86 L' + (x + 13) + ' 86 L' + (x + 11) + ' 90 L' + (x + 12) + ' 142Z'; }
      return d;
    })(),
    colosseum: (() => {
      let d = 'M20 160 L20 50 Q130 32 248 40 L258 58 L270 52 L282 74 L296 68 L306 92 L380 94 L380 160Z';
      for (const [top, bot, edge] of [[60, 80, 240], [88, 110, 290], [118, 140, 372], [146, 160, 372]]) for (let x = 28; x + 14 < edge; x += 22) d += ' ' + arch(x, top, bot, 14);
      return d;
    })(),
    taj: 'M60 160 L60 112 L340 112 L340 160Z M120 112 L120 76 L280 76 L280 112Z M150 76 Q144 46 200 20 Q256 46 250 76Z M198 20 L200 4 L202 20Z M126 76 Q124 58 138 52 Q152 58 150 76Z M250 76 Q248 58 262 52 Q276 58 274 76Z M40 160 L40 60 L48 50 L56 60 L56 160Z M344 160 L344 60 L352 50 L360 60 L360 160Z ' + arch(184, 86, 112, 32),
    pagoda: 'M150 160 L150 140 L250 140 L250 160Z M116 144 Q200 122 284 144 L270 132 L130 132Z M160 132 L160 110 L240 110 L240 132Z M126 114 Q200 92 274 114 L260 102 L140 102Z M168 102 L168 82 L232 82 L232 102Z M136 86 Q200 64 264 86 L252 74 L148 74Z M176 74 L176 56 L224 56 L224 74Z M146 60 Q200 40 254 60 L242 48 L158 48Z M196 48 L200 18 L204 48Z M20 160 Q40 140 60 150 Q80 136 100 152 L100 160Z M300 160 Q320 142 340 150 Q360 138 390 152 L390 160Z',
    venice: 'M0 160 L0 140 L400 140 L400 160Z M40 140 L40 70 L48 62 L48 40 L54 28 L60 40 L60 62 L68 70 L68 140Z M120 140 L120 100 L240 100 L240 140Z ' + onion(150, 100, 16, 30) + ' ' + onion(190, 100, 14, 26) + ' ' + onion(226, 100, 12, 22) + ' M280 140 L280 110 L360 110 L360 140Z M286 150 Q330 160 372 146 L376 138 L384 148 Q330 168 280 152Z',
    domes: 'M60 160 L60 104 L340 104 L340 160Z M96 104 L96 78 L144 78 L144 104Z ' + onion(120, 80, 22, 40) + ' M176 104 L176 64 L224 64 L224 104Z M182 66 L200 8 L218 66Z M256 104 L256 78 L304 78 L304 104Z ' + onion(280, 80, 22, 40) + ' ' + onion(158, 104, 13, 26) + ' ' + onion(242, 104, 13, 26),
    eiffel: 'M0 160 L0 150 Q100 144 200 146 Q300 144 400 150 L400 160Z M150 152 Q160 120 178 96 L186 96 Q174 124 166 152Z M250 152 Q240 120 222 96 L214 96 Q226 124 234 152Z M168 120 L232 120 L232 126 L168 126Z M176 128 Q200 108 224 128 L224 124 Q200 104 176 124Z M174 96 L226 96 L226 90 L174 90Z M186 90 Q192 60 196 50 L204 50 Q208 60 214 90Z M190 54 L210 54 L210 50 L190 50Z M196 50 L198 20 L202 20 L204 50Z M199 20 L200 6 L201 20Z M20 152 Q30 128 46 140 Q60 124 76 146 L76 152Z M324 152 Q340 126 356 140 Q370 128 384 148 L384 152Z',
    skyline: 'M0 160 L0 110 L30 110 L30 90 L60 90 L60 120 L80 120 L80 70 L100 70 L100 120 L120 120 L120 100 L140 100 L140 80 L156 80 L156 46 L162 46 Q170 22 178 46 L182 46 L184 26 L188 2 L192 26 L194 46 L200 46 Q208 24 216 46 L222 46 L222 80 L240 80 L240 60 L250 46 L260 60 L260 110 L280 110 L280 70 L300 70 L300 120 L330 120 L330 90 L360 90 L360 110 L400 110 L400 160Z',
  };
  const WINDOWS = {
    skyline: [[84, 76, 12, 40], [144, 86, 10, 30], [160, 52, 58, 24], [244, 66, 12, 40], [284, 76, 12, 40], [34, 96, 22, 12]],
    venice: [[124, 108, 110, 28], [284, 116, 70, 20]],
    domes: [[64, 118, 60, 30], [150, 118, 100, 30], [276, 118, 60, 30]],
    eiffel: [[176, 120, 48, 6], [180, 90, 40, 6]], taj: [], colosseum: [], parthenon: [], pyramids: [], pagoda: [[156, 134, 88, 6], [164, 112, 72, 18], [172, 84, 56, 16]],
  };
  // Small warm windows lit in the landmark at dusk.
  function lights(id, a, rnd) {
    let s = '';
    for (const [x, y, w, h] of WINDOWS[id] || []) for (let yy = y + 3; yy < y + h - 2; yy += 6) for (let xx = x + 2; xx < x + w - 2; xx += 5) if (rnd() > 0.55) s += '<rect x="' + xx + '" y="' + yy + '" width="2" height="2.6" fill="' + lit(a, 0.5) + '" opacity="' + (0.5 + rnd() * 0.5).toFixed(2) + '"/>';
    return s;
  }
  // Era banner art: a twilight sky in the era colours with the landmark.
  function banner(id, o) {
    o = o || {};
    const p = pic();
    const a = o.from || '#e8c070', b = o.to || '#1d2f7a';
    const sky = p.lin([[0, dim(b, 0.35)], [0.55, b], [0.86, mix(b, a, 0.55)], [1, lit(a, 0.2)]], 0, 0, 0, 1);
    const sun = p.rad([[0, '#fff6d8', 0.95], [0.25, lit(a, 0.3), 0.6], [1, a, 0]], 0.5, 0.5, 0.5);
    let stars = '';
    let seed = id.length * 9301;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = 0; i < 28; i++) stars += C((rnd() * 400).toFixed(1), (rnd() * 70).toFixed(1), (rnd() * 0.9 + 0.3).toFixed(2), '#fff', ' opacity="' + (rnd() * 0.6 + 0.25).toFixed(2) + '"');
    const ground = dim(mix(b, '#000', 0.5), 0.3);
    const body = '<rect width="400" height="160" fill="' + sky + '"/>' + stars + C(o.sunX || 300, 98, 70, sun) + C(o.sunX || 300, 98, 16, lit(a, 0.55), ' opacity=".9"') +
      P('M0 160 L0 132 Q100 118 200 130 Q300 142 400 124 L400 160Z', mix(ground, b, 0.3), ' opacity=".8"') +
      P(LANDMARKS[id] || LANDMARKS.pyramids, p.lin([[0, dim(b, 0.55)], [1, ground]], 0, 0, 0, 1), ' fill-rule="evenodd"') + lights(id, a, rnd) +
      '<rect y="150" width="400" height="10" fill="' + ground + '"/>' +
      '<rect width="400" height="160" fill="' + p.lin([[0.6, '#000', 0], [1, '#000', 0.45]], 0, 0, 0, 1) + '"/>';
    return svg(p, '0 0 400 160', body, ' preserveAspectRatio="xMidYMid slice"');
  }

  // ------------------------------------------------------------ cosmetics swatches
  // Effects drawn as a burst of their particles on dark velvet.
  function fx(kind, colors) {
    const p = pic();
    const cols = colors && colors.length ? colors : ['#e8c27a', '#f7dea4'];
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const c = (i) => cols[i % cols.length];
    let s = '';
    if (kind === 'confetti') for (let i = 0; i < 46; i++) { const a = rnd() * 6.283, r = 12 + rnd() * 62, x = 100 + Math.cos(a) * r, y = 80 + Math.sin(a) * r * 0.75; s += '<rect x="' + (x - 3).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" width="6" height="10" rx="1" fill="' + c(i) + '"' + rot((rnd() * 180).toFixed(0), x.toFixed(1), y.toFixed(1)) + ' opacity="' + (0.7 + rnd() * 0.3).toFixed(2) + '"/>'; }
    else if (kind === 'sparks') { for (let i = 0; i < 26; i++) { const a = rnd() * 6.283, r0 = 10 + rnd() * 10, r1 = r0 + 14 + rnd() * 40; s += '<path d="M' + (100 + Math.cos(a) * r0).toFixed(1) + ' ' + (80 + Math.sin(a) * r0).toFixed(1) + 'L' + (100 + Math.cos(a) * r1).toFixed(1) + ' ' + (80 + Math.sin(a) * r1).toFixed(1) + '" stroke="' + c(i) + '" stroke-width="2.4" stroke-linecap="round"/>'; } s += C(100, 80, 10, p.rad([[0, '#fff'], [0.4, c(0)], [1, c(0), 0]], 0.5, 0.5, 0.5)); }
    else if (kind === 'fireworks') for (const [cx, cy, r, k] of [[70, 62, 40, 0], [136, 70, 34, 1], [104, 112, 26, 2]]) { for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283; s += '<path d="M' + (cx + Math.cos(a) * r * 0.25).toFixed(1) + ' ' + (cy + Math.sin(a) * r * 0.25).toFixed(1) + 'L' + (cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + Math.sin(a) * r).toFixed(1) + '" stroke="' + c(k) + '" stroke-width="2" stroke-linecap="round"/>' + C((cx + Math.cos(a) * (r + 4)).toFixed(1), (cy + Math.sin(a) * (r + 4)).toFixed(1), 1.8, c(k + 1)); } }
    else if (kind === 'petals') for (let i = 0; i < 22; i++) { const x = 30 + rnd() * 140, y = 20 + rnd() * 120; s += '<path d="M' + x.toFixed(1) + ' ' + y.toFixed(1) + ' q8 -10 16 0 q-8 10 -16 0z" fill="' + c(i) + '"' + rot((rnd() * 360).toFixed(0), x.toFixed(1), y.toFixed(1)) + ' opacity=".9"/>'; }
    else if (kind === 'dust') for (let i = 0; i < 60; i++) { const a = rnd() * 6.283, r = Math.pow(rnd(), 0.6) * 58; s += C((100 + Math.cos(a) * r).toFixed(1), (84 + Math.sin(a) * r * 0.6).toFixed(1), (1.5 + rnd() * 4.5).toFixed(1), c(i), ' opacity="' + (0.35 + rnd() * 0.5).toFixed(2) + '"'); }
    else if (kind === 'ink') for (let i = 0; i < 7; i++) s += '<path d="M' + (60 + i * 12) + ' 130 C' + (40 + i * 18) + ' 90 ' + (120 + i * 6) + ' 80 ' + (90 + i * 8) + ' 40" fill="none" stroke="' + lit(c(i), 0.25) + '" stroke-width="' + (6 - i * 0.6) + '" stroke-linecap="round" opacity=".6"/>';
    else if (kind === 'frost') for (const [x, y, r] of [[100, 78, 34], [52, 60, 16], [150, 104, 18], [62, 118, 12], [148, 44, 12]]) { for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; s += '<path d="M' + x + ' ' + y + 'L' + (x + Math.cos(a) * r).toFixed(1) + ' ' + (y + Math.sin(a) * r).toFixed(1) + 'M' + (x + Math.cos(a) * r * 0.6).toFixed(1) + ' ' + (y + Math.sin(a) * r * 0.6).toFixed(1) + 'l' + (Math.cos(a + 0.7) * r * 0.25).toFixed(1) + ' ' + (Math.sin(a + 0.7) * r * 0.25).toFixed(1) + 'M' + (x + Math.cos(a) * r * 0.6).toFixed(1) + ' ' + (y + Math.sin(a) * r * 0.6).toFixed(1) + 'l' + (Math.cos(a - 0.7) * r * 0.25).toFixed(1) + ' ' + (Math.sin(a - 0.7) * r * 0.25).toFixed(1) + '" stroke="' + c(i) + '" stroke-width="2" stroke-linecap="round"/>'; } }
    else if (kind === 'trail') { s += '<path d="M20 120 C60 120 70 50 110 60 S160 90 180 40" fill="none" stroke="' + c(0) + '" stroke-width="5" stroke-linecap="round" opacity=".85"/>'; for (let i = 0; i < 26; i++) { const t = i / 26; s += C((20 + t * 160 + (rnd() - 0.5) * 10).toFixed(1), (120 - t * 80 + Math.sin(t * 7) * 16 + (rnd() - 0.5) * 12).toFixed(1), (1 + t * 3).toFixed(1), c(i + 1), ' opacity="' + (0.4 + t * 0.6).toFixed(2) + '"'); } s += C(180, 40, 8, p.rad([[0, '#fff'], [0.5, c(0)], [1, c(0), 0]], 0.5, 0.5, 0.5)); }
    else s += C(100, 80, 30, 'none', ' stroke="#8e7865" stroke-width="2" stroke-dasharray="4 6"');
    return svg(p, '0 0 200 160', s);
  }
  // A tournament clock in the skin's colours.
  function clock(d) {
    const p = pic();
    d = d || {};
    const body = d.body || '#2a1a12', face = d.face || '#101410', glow = d.glow || '#9fe870', metal = d.metal || '#c9a35a';
    const s = '<rect x="22" y="44" width="156" height="92" rx="16" fill="' + p.sh(body, { hi: 0.25 }) + '"' + ol(body, 2) + '/>' +
      '<rect x="46" y="32" width="26" height="14" rx="4" fill="' + p.sh(metal, { hi: 0.5 }) + '"/><rect x="128" y="36" width="26" height="10" rx="4" fill="' + p.sh(metal, { hi: 0.5 }) + '"/>' +
      '<rect x="34" y="62" width="62" height="40" rx="7" fill="' + face + '"/><rect x="104" y="62" width="62" height="40" rx="7" fill="' + face + '"/>' +
      '<text x="65" y="90" text-anchor="middle" font-family="monospace" font-size="21" font-weight="700" fill="' + glow + '">5:00</text>' +
      '<text x="135" y="90" text-anchor="middle" font-family="monospace" font-size="21" font-weight="700" fill="' + (d.ink || glow) + '" opacity=".75">3:00</text>' +
      '<rect x="40" y="114" width="120" height="6" rx="3" fill="' + metal + '" opacity=".7"/>';
    return svg(p, '0 0 200 160', s);
  }

  // ------------------------------------------------------------ public API
  const cache = new Map();
  const memo = (key, make) => { if (!cache.has(key)) cache.set(key, uri(make())); return cache.get(key); };
  return {
    ANIMALS: Object.keys(ANIMALS), LANDMARKS, PIECE,
    portrait, medal, crest, banner, pieceSvg, fx, clock, uri,
    // data-URI helpers, cached
    portraitUri: (animal, o) => memo('p' + animal + JSON.stringify(o || {}), () => portrait(animal, o)),
    medalUri: (art, o) => memo('m' + art + JSON.stringify(o || {}), () => medal(art, o)),
    crestUri: () => memo('crest', () => crest()),
    // an era's own painted view (as seen from its room's window) where the build has it
    bannerUri: (id, o) => ART_IMG.view[id] || memo('b' + id + JSON.stringify(o || {}), () => banner(id, o)),
    pieceUri: (type, o) => memo('s' + type + JSON.stringify(o || {}), () => pieceSvg(type, o)),
    fxUri: (kind, colors) => memo('f' + kind + (colors || []).join(), () => fx(kind, colors)),
    clockUri: (d) => memo('c' + JSON.stringify(d || {}), () => clock(d)),
    mix, lit, dim,
  };
})();
if (typeof module !== 'undefined') module.exports = ChacklateArt;
