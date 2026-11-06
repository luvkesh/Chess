// The nine places as small, colourful illustrated badges: each landmark in its own sky,
// drawn by hand in SVG and framed in a gold bezel. render-art.js prints them as 'icon-<era>'.
'use strict';

// gradient helpers; every id is prefixed by the place so nine badges can share one page
function lin(id, stops, x2, y2) {
  return '<linearGradient id="' + id + '" x1="0" y1="0" x2="' + (x2 == null ? 0 : x2) + '" y2="' + (y2 == null ? 1 : y2) + '">' +
    stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</linearGradient>';
}
function rad(id, stops) {
  return '<radialGradient id="' + id + '">' + stops.map((s) => '<stop offset="' + s[0] + '" stop-color="' + s[1] + '"' + (s[2] != null ? ' stop-opacity="' + s[2] + '"' : '') + '/>').join('') + '</radialGradient>';
}
const rect = (x, y, w, h, f, extra) => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + f + '"' + (extra || '') + '/>';
const path = (d, f, extra) => '<path d="' + d + '" fill="' + f + '"' + (extra || '') + '/>';
const circ = (x, y, r, f, extra) => '<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + f + '"' + (extra || '') + '/>';
const onion = (x, base, w, h) => 'M' + (x - w) + ' ' + base + 'C' + (x - w * 1.5) + ' ' + (base - h * 0.45) + ' ' + (x - w * 0.2) + ' ' + (base - h * 0.75) + ' ' + x + ' ' + (base - h) +
  'C' + (x + w * 0.2) + ' ' + (base - h * 0.75) + ' ' + (x + w * 1.5) + ' ' + (base - h * 0.45) + ' ' + (x + w) + ' ' + base + 'Z';

const SCENES = {
  egypt(p) {
    const defs = lin(p + 's', [[0, '#f6a23c'], [0.55, '#ffd37a'], [1, '#fff0c4']]) + rad(p + 'u', [[0, '#fffbe8'], [0.5, '#fff1b8', 0.9], [1, '#ffd37a', 0]]) +
      lin(p + 'd', [[0, '#f2c46d'], [1, '#d7953f']]) + lin(p + 'r', [[0, '#3fa7d6'], [1, '#1f6ea8']]);
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') + circ(78, 42, 26, 'url(#' + p + 'u)') + circ(78, 42, 10, '#fff7d6') +
      path('M0 82Q30 74 60 80T120 78V120H0Z', 'url(#' + p + 'd)') +
      // the great pyramid: lit face and shadow face
      path('M22 84L52 40L82 84Z', '#f7d48c') + path('M52 40L82 84L64 84Z', '#c9803a') +
      path('M66 84L84 58L102 84Z', '#f2c77a') + path('M84 58L102 84L91 84Z', '#b8702f') +
      // the Nile
      path('M0 96Q40 90 70 95T120 92V104Q80 100 50 104T0 106Z', 'url(#' + p + 'r)') +
      path('M10 99h14M58 99h18', 'none', ' stroke="#bfe6f5" stroke-width="1.4" stroke-linecap="round"') +
      // a palm
      path('M18 92Q20 78 16 66', 'none', ' stroke="#7a4a22" stroke-width="2.6" stroke-linecap="round"') +
      path('M16 66Q6 62 2 70Q8 64 16 66ZM16 66Q26 58 32 66Q24 62 16 66ZM16 66Q12 54 4 56Q12 58 16 66ZM16 66Q22 54 30 56Q22 58 16 66Z', '#2f8f4e');
    return [defs, body];
  },
  greece(p) {
    const defs = lin(p + 's', [[0, '#3b8fd9'], [1, '#bfe3fb']]) + lin(p + 'h', [[0, '#7fb35a'], [1, '#4d7f3a']]) + lin(p + 'm', [[0, '#fffaf0'], [1, '#e6dcc6']]);
    let cols = '';
    for (let i = 0; i < 7; i++) { const x = 30 + i * 9.4; cols += rect(x, 56, 4.4, 22, 'url(#' + p + 'm)') + rect(x + 3.2, 56, 1.2, 22, '#cbbd9f'); }
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') +
      circ(28, 30, 9, '#fff', ' opacity=".55"') + circ(36, 28, 7, '#fff', ' opacity=".55"') + circ(94, 22, 6, '#fff', ' opacity=".45"') +
      rect(0, 92, 120, 28, '#2b74b8') + path('M0 92h120', 'none', ' stroke="#9fd2f2" stroke-width="1.2"') +
      path('M0 96Q36 74 60 80T120 90V120H0Z', 'url(#' + p + 'h)') +
      // the Parthenon on its rock
      path('M22 84h76v4H22Z', '#d9cdb2') + path('M26 78h68v6H26Z', '#efe6d2') + cols +
      path('M26 56h68v-4H26Z', '#f3ead6') + path('M24 52L60 38L96 52Z', '#fbf5e8') + path('M60 38L96 52H60Z', '#e0d3b6') +
      path('M38 50h44', 'none', ' stroke="#c9b893" stroke-width="1"') +
      // olive sprigs
      path('M8 100q8-10 18-12', 'none', ' stroke="#3b5d2a" stroke-width="1.4"') + circ(14, 95, 2.2, '#4f6b2e') + circ(20, 91, 2.2, '#6c8c3a') + circ(104, 98, 2.4, '#4f6b2e') + circ(110, 94, 2, '#6c8c3a');
    return [defs, body];
  },
  rome(p) {
    const defs = lin(p + 's', [[0, '#f08a5d'], [0.6, '#ffc58a'], [1, '#ffe6b8']]) + lin(p + 'c', [[0, '#f0c98e'], [1, '#c98f52']]);
    let arches = '';
    for (const [y, h] of [[50, 10], [64, 10], [78, 9]]) for (let x = 24; x < 92; x += 9) arches += path('M' + x + ' ' + (y + h) + 'v-' + (h - 3) + 'a3 3 0 0 1 6 0v' + (h - 3) + 'Z', '#7a3f22');
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') + circ(30, 40, 12, '#fff2cc', ' opacity=".85"') +
      path('M0 88Q60 82 120 88V120H0Z', '#8a9a4a') + rect(0, 100, 120, 20, '#6f7d3a') +
      // the Colosseum, broken on the right as it is today
      path('M18 90V46Q56 38 92 42L96 48L100 46L104 56L98 60V90Z', 'url(#' + p + 'c)') +
      path('M18 46Q56 38 92 42', 'none', ' stroke="#fff0d0" stroke-width="1.4"') + arches +
      path('M18 60h80M18 74h80', 'none', ' stroke="#b47a42" stroke-width="1"') +
      // cypresses
      path('M8 96C4 80 8 66 11 58C14 66 18 80 14 96Z', '#2f5a2c') + path('M106 98C102 84 106 70 109 62C112 70 116 84 112 98Z', '#2f5a2c') +
      path('M114 98C111 88 113 78 116 72C119 78 121 88 118 98Z', '#3c6e35');
    return [defs, body];
  },
  mughal(p) {
    const defs = lin(p + 's', [[0, '#f59ab0'], [0.55, '#ffd2b0'], [1, '#fff3e0']]) + lin(p + 'm', [[0, '#ffffff'], [1, '#efe4ea']]) + lin(p + 'w', [[0, '#7cc6e8'], [1, '#3b8fc4']]);
    const minaret = (x) => rect(x - 2.2, 46, 4.4, 40, 'url(#' + p + 'm)') + path('M' + (x - 3.4) + ' 46Q' + x + ' 38 ' + (x + 3.4) + ' 46Z', '#fff') + rect(x - 3.4, 56, 6.8, 1.4, '#d9c8d2') + rect(x - 3.4, 68, 6.8, 1.4, '#d9c8d2');
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') + circ(92, 26, 7, '#fff8e8', ' opacity=".9"') +
      minaret(22) + minaret(98) +
      // the Taj: base, iwan, side domes, great dome
      path('M30 86V62H90V86Z', 'url(#' + p + 'm)') + path('M52 86V68Q60 60 68 68V86Z', '#e4c8d4') + path('M54 86V70Q60 64 66 70V86Z', '#b98aa2') +
      path('M36 74Q36 70 40 68Q44 70 44 74V84H36Z', '#e9d8e0') + path('M76 74Q76 70 80 68Q84 70 84 74V84H76Z', '#e9d8e0') +
      path(onion(60, 62, 14, 28), 'url(#' + p + 'm)') + path('M59.3 34V28h1.4v6Z', '#d8a447') + circ(60, 27.5, 1.6, '#d8a447') +
      path(onion(40, 62, 5, 10), '#fff') + path(onion(80, 62, 5, 10), '#fff') +
      // gardens and the long pool
      rect(0, 86, 120, 34, '#4f9a4a') + path('M50 86h20l10 34H40Z', 'url(#' + p + 'w)') +
      path('M60 90v26', 'none', ' stroke="#d6f0fb" stroke-width="1" opacity=".8"') +
      path('M10 96C8 90 10 84 12 82C14 84 16 90 14 96ZM28 102C26 96 28 90 30 88C32 90 34 96 32 102ZM90 102C88 96 90 90 92 88C94 90 96 96 94 102ZM108 96C106 90 108 84 110 82C112 84 114 90 112 96Z', '#2c6b34');
    return [defs, body];
  },
  ming(p) {
    const defs = lin(p + 's', [[0, '#4aa3df'], [1, '#d4eefc']]) + lin(p + 'r', [[0, '#ffd34d'], [1, '#e09b14']]) + lin(p + 'w', [[0, '#d63a2a'], [1, '#a5221a']]);
    let cols = '';
    for (let x = 28; x <= 90; x += 7.75) cols += rect(x, 66, 2.6, 18, '#8e1810');
    const roof = (y, w, h) => path('M' + (60 - w) + ' ' + y + 'Q' + (60 - w * 0.6) + ' ' + (y - h * 0.4) + ' ' + (60 - w * 0.5) + ' ' + (y - h) + 'H' + (60 + w * 0.5) + 'Q' + (60 + w * 0.6) + ' ' + (y - h * 0.4) + ' ' + (60 + w) + ' ' + y + 'Q60 ' + (y - h * 0.3) + ' ' + (60 - w) + ' ' + y + 'Z', 'url(#' + p + 'r)');
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') + circ(24, 26, 5, '#fff', ' opacity=".7"') + circ(30, 25, 6, '#fff', ' opacity=".7"') +
      // white marble terraces
      path('M6 102H114V92H106V88H14V92H6Z', '#f4f1ea') + path('M6 102H114', 'none', ' stroke="#cfc7b6" stroke-width="1"') + rect(0, 102, 120, 18, '#c9b79a') +
      path('M44 102L52 88H68L76 102Z', '#e2dccd') +
      // the hall: red walls, gold double roof
      path('M24 88V64H96V88Z', 'url(#' + p + 'w)') + cols + path('M54 88V70H66V88Z', '#5e0e09') +
      roof(66, 44, 10) + path('M30 56H90V60H30Z', '#a5221a') + roof(56, 34, 14) +
      path('M26 64Q60 60 94 64', 'none', ' stroke="#2f7a6e" stroke-width="1.6"') + path('M38 50h44', 'none', ' stroke="#2f7a6e" stroke-width="1.2"') +
      circ(60, 40, 1.6, '#ffe28a');
    return [defs, body];
  },
  venice(p) {
    const defs = lin(p + 's', [[0, '#2a4f9c'], [0.5, '#f08f6a'], [1, '#ffd29a']]) + lin(p + 'w', [[0, '#2fa3a0'], [1, '#14605f']]);
    const house = (x, w, h, c, roofc) => rect(x, 82 - h, w, h, c) + rect(x - 1, 82 - h - 2, w + 2, 2.4, roofc) +
      (function () { let s = ''; for (let yy = 82 - h + 5; yy < 78; yy += 7) for (let xx = x + 2.5; xx < x + w - 3; xx += 5) s += path('M' + xx + ' ' + (yy + 4) + 'v-2.4a1.2 1.2 0 0 1 2.4 0v2.4Z', '#ffe08a'); return s; })();
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') + circ(86, 52, 9, '#ffe7b0', ' opacity=".9"') +
      house(0, 18, 36, '#d9643c', '#8a3322') + house(18, 16, 28, '#f0b84e', '#9a5a26') + house(86, 16, 30, '#e8836a', '#8a3322') + house(102, 18, 40, '#c7493a', '#7a2a1e') +
      // the Rialto bridge
      path('M30 84Q60 56 90 84H84Q60 64 36 84Z', '#f6ecd8') + path('M40 74h40v-4H40Z', '#eadbbd') + path('M48 70V64h24v6Z', '#f6ecd8') + path('M46 64Q60 56 74 64Z', '#d9643c') +
      path('M52 70v-4M58 70v-4M64 70v-4M70 70v-4', 'none', ' stroke="#b89c70" stroke-width="1.2"') +
      // the canal and a gondola
      rect(0, 82, 120, 38, 'url(#' + p + 'w)') + path('M38 84Q60 70 82 84', 'none', ' stroke="#f6ecd8" stroke-width="1.6" opacity=".35"') +
      path('M6 92h20M74 96h28M30 108h30', 'none', ' stroke="#9be0d8" stroke-width="1.3" stroke-linecap="round" opacity=".7"') +
      path('M24 102Q50 110 84 100Q86 98 88 96Q86 102 80 104Q50 112 26 104Z', '#16120f') + path('M86 96l3 -4', 'none', ' stroke="#d8a447" stroke-width="1.4"') +
      path('M56 101V86', 'none', ' stroke="#3b2a1e" stroke-width="1.2"') + circ(54, 94, 2.2, '#c7493a') + rect(52.4, 95.5, 3.2, 5, '#f6ecd8');
    return [defs, body];
  },
  paris(p) {
    const defs = lin(p + 's', [[0, '#6a5bb8'], [0.55, '#e48fb2'], [1, '#ffd2a8']]) + lin(p + 't', [[0, '#d99a52'], [1, '#8e5428']]);
    let lattice = '';
    for (let y = 44; y < 92; y += 6) { const k = (y - 20) / 72; lattice += path('M' + (60 - 6 - k * 22) + ' ' + y + 'L' + (60 + 6 + k * 22) + ' ' + (y + 6), 'none', ' stroke="#8e5428" stroke-width=".7" opacity=".6"'); }
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') + circ(20, 18, 1.2, '#fff') + circ(100, 14, 1, '#fff') + circ(88, 30, 0.9, '#fff') + circ(30, 36, 0.9, '#fff') +
      // the tower: four legs, two platforms and the spire
      path('M28 94Q42 70 50 48H70Q78 70 92 94H82Q72 78 66 70H54Q48 78 38 94Z', 'url(#' + p + 't)') +
      path('M50 48L56 20H64L70 48Z', 'url(#' + p + 't)') + path('M58.6 20L60 6L61.4 20Z', '#8e5428') + lattice +
      rect(46, 46, 28, 3, '#6e3c1a') + rect(42, 68, 36, 3.4, '#6e3c1a') + rect(55, 30, 10, 2, '#6e3c1a') +
      path('M50 94Q60 80 70 94', 'none', ' stroke="#6e3c1a" stroke-width="2"') +
      circ(60, 30, 1.4, '#ffe28a') + circ(52, 47, 1, '#ffe28a') + circ(68, 47, 1, '#ffe28a') + circ(60, 69.5, 1.1, '#ffe28a') +
      // the Champ de Mars: lawns, a path and trees
      rect(0, 94, 120, 26, '#4f9a4a') + path('M50 94H70L84 120H36Z', '#e9cfa0') +
      circ(10, 92, 8, '#2f7a3e') + circ(22, 94, 7, '#3c8a46') + circ(98, 94, 7, '#3c8a46') + circ(110, 92, 8, '#2f7a3e');
    return [defs, body];
  },
  russia(p) {
    const defs = lin(p + 's', [[0, '#8fc4ef'], [1, '#e8f4ff']]) + lin(p + 'g', [[0, '#ffe08a'], [1, '#d39a28']]);
    // striped onion domes, as on the Savior on Spilled Blood
    const dome = (x, base, w, h, a, b, id) => '<clipPath id="' + p + id + '"><path d="' + onion(x, base, w, h) + '"/></clipPath>' +
      path(onion(x, base, w, h), a) + '<g clip-path="url(#' + p + id + ')">' +
      [-3, -1, 1, 3].map((k) => path('M' + (x + k * w * 0.32) + ' ' + (base + 2) + 'Q' + (x + k * w * 0.42) + ' ' + (base - h * 0.5) + ' ' + x + ' ' + (base - h), 'none', ' stroke="' + b + '" stroke-width="' + (w * 0.22).toFixed(1) + '"')).join('') + '</g>' +
      path('M' + (x - 0.7) + ' ' + (base - h) + 'v-6h1.4v6Z', '#d39a28') + path('M' + (x - 2.4) + ' ' + (base - h - 4) + 'h4.8', 'none', ' stroke="#d39a28" stroke-width="1"');
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') +
      circ(14, 20, 1.4, '#fff') + circ(40, 12, 1.2, '#fff') + circ(84, 16, 1.4, '#fff') + circ(104, 30, 1.2, '#fff') + circ(20, 48, 1, '#fff') +
      // walls in brick red and white
      path('M22 92V66H98V92Z', '#c0473a') + path('M46 66V48H74V66Z', '#d9564a') + path('M56 48V30H64V48Z', '#e8e2d6') +
      path('M22 70H98M22 80H98', 'none', ' stroke="#f3ead8" stroke-width="1.4"') + path('M52 92V80Q60 72 68 80V92Z', '#6a2a22') +
      path('M56 30L60 18L64 30Z', 'url(#' + p + 'g)') +
      dome(34, 66, 8, 18, '#2f9a6a', '#f4f1e6', 'a') + dome(86, 66, 8, 18, '#2a5fb0', '#ffd34d', 'b') +
      dome(60, 48, 9, 20, '#e8c05a', '#c0473a', 'c') + dome(46, 66, 5, 11, '#c0473a', '#f4f1e6', 'd') + dome(74, 66, 5, 11, '#2f9a6a', '#ffd34d', 'e') +
      // snow
      path('M0 92Q30 86 60 90T120 88V120H0Z', '#ffffff') + path('M0 100Q40 96 80 100T120 98V120H0Z', '#e2eef8') +
      circ(10, 66, 1.2, '#fff') + circ(104, 56, 1.3, '#fff') + circ(18, 84, 1, '#fff');
    return [defs, body];
  },
  deco(p) {
    const defs = lin(p + 's', [[0, '#141a46'], [0.6, '#3a2f7a'], [1, '#c4568c']]) + lin(p + 'b', [[0, '#3b3f6e'], [1, '#1a1c34']]);
    let wins = '';
    let seed = 7;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    const tower = (x, top, w, c) => {
      let s = rect(x, top, w, 120 - top, c);
      for (let y = top + 4; y < 96; y += 5) for (let xx = x + 2; xx < x + w - 2; xx += 4) if (rnd() > 0.45) s += rect(xx, y, 2, 2.4, rnd() > 0.3 ? '#ffd56a' : '#9fe0ff');
      return s;
    };
    const body = rect(0, 0, 120, 120, 'url(#' + p + 's)') + circ(92, 22, 6, '#fff4d0') + circ(95, 20, 5, '#2a2a6a', ' opacity=".55"') +
      circ(20, 14, 1, '#fff') + circ(50, 10, 1, '#fff') + circ(70, 24, 0.8, '#fff') + circ(110, 40, 0.8, '#fff') +
      tower(4, 54, 16, '#2b2f5e') + tower(22, 40, 18, 'url(#' + p + 'b)') +
      // the Chrysler-style spire in the middle
      tower(46, 46, 20, '#44497e') + path('M46 46Q56 30 66 46Z', '#c9ced8') + path('M50 46Q56 34 62 46Z', '#9aa1b4') + path('M55.4 34L56 14L56.6 34Z', '#e6e8ee') +
      path('M48 42l3-4M64 42l-3-4', 'none', ' stroke="#ffd56a" stroke-width="1"') +
      tower(72, 36, 16, 'url(#' + p + 'b)') + tower(92, 58, 24, '#2b2f5e') +
      // the billboards of the square: invented signs only
      rect(4, 70, 16, 10, '#ff4f9a') + rect(6, 72, 12, 2, '#ffe0f0') + rect(6, 76, 8, 2, '#ffe0f0') +
      rect(92, 66, 22, 10, '#22c8e8') + rect(95, 69, 16, 1.8, '#e8fbff') + rect(95, 72.5, 10, 1.8, '#e8fbff') +
      rect(72, 78, 16, 8, '#ffcc33') + rect(74, 80, 12, 1.6, '#5a3a00') +
      // the street and a yellow cab
      rect(0, 96, 120, 24, '#242036') + path('M0 104h120', 'none', ' stroke="#fff" stroke-width="1" stroke-dasharray="6 6" opacity=".5"') +
      path('M34 112v-6l4-5h20l5 5h4v6Z', '#ffcf2e') + rect(42, 102.5, 6, 3.2, '#a8d8f0') + rect(50, 102.5, 6, 3.2, '#a8d8f0') +
      circ(40, 113, 2.6, '#1a1a1a') + circ(60, 113, 2.6, '#1a1a1a') + rect(46, 99, 6, 2, '#1a1a1a');
    return [defs, body];
  },
};

// A round badge: the scene, a soft shine and a gold bezel. Sized by the page; drawn on 120 units.
function icon(id) {
  const p = 'pi-' + id + '-';
  const [defs, body] = SCENES[id](p);
  const gold = lin(p + 'gold', [[0, '#fbe6a6'], [0.45, '#d8a447'], [0.7, '#9a6a24'], [1, '#f2cf7a']], 1, 1);
  const shine = lin(p + 'shine', [[0, '#fff', 0.28], [0.45, '#fff', 0], [1, '#000', 0.25]]);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><defs>' + defs + gold + shine +
    '<clipPath id="' + p + 'clip"><circle cx="60" cy="60" r="53"/></clipPath></defs>' +
    '<g clip-path="url(#' + p + 'clip)">' + body + '<rect width="120" height="120" fill="url(#' + p + 'shine)"/></g>' +
    '<circle cx="60" cy="60" r="55.5" fill="none" stroke="url(#' + p + 'gold)" stroke-width="5"/>' +
    '<circle cx="60" cy="60" r="52.6" fill="none" stroke="#3a220f" stroke-width="1" opacity=".55"/>' +
    '<circle cx="60" cy="60" r="58.2" fill="none" stroke="#5a3a14" stroke-width=".8" opacity=".6"/></svg>';
}

module.exports = { icon, ids: Object.keys(SCENES) };
