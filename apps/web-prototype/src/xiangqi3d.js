// The Xiangqi table: a boxwood board of nine by ten lines with the river and the two palaces,
// and round pieces with their names carved and inked on top (red for Red, black for Black, with a
// lacquer band round the edge so each side reads from any angle). It sits in the room in place of
// the chessboard (scene.js setAlt) and draws the same kinds of marks: the selected piece, the
// points it can go to, the last move and a general in check.
'use strict';
function ChacklateXiangqiTable(THREE) {
  const G = 0.84;                      // spacing between lines
  const TOP = 0;                       // the board's top, level with the chessboard's
  const px = (s) => ((s % 9) - 4) * G;
  const pz = (s) => (4.5 - ((s / 9) | 0)) * G;
  const NAMES = { 1: ['帥', '將'], 2: ['仕', '士'], 3: ['相', '象'], 4: ['傌', '馬'], 5: ['俥', '車'], 6: ['炮', '砲'], 7: ['兵', '卒'] };
  const FONT = 'XQ Han';
  const INK = { red: '#a3201a', black: '#18110c' };
  const group = new THREE.Group();
  const pieceGroup = new THREE.Group(), markGroup = new THREE.Group();
  group.add(pieceGroup, markGroup);
  let gone = false;
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // ---------------------------------------------------------------- textures
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return c; };
  const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return keep(t); };
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // boxwood: warm honey with long soft grain
  function grain(g, w, h, base, dark, lines) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < lines; i++) {
      const y = rnd() * h, amp = 4 + rnd() * 10;
      g.strokeStyle = dark; g.globalAlpha = 0.05 + rnd() * 0.08; g.lineWidth = 1 + rnd() * 3;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += w / 8) g.lineTo(x, y + Math.sin(x / w * 6 + i) * amp);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  const BW = 8.2, BD = 9.1;            // board size in table units
  const PXU = 256;                     // texture pixels per unit
  function boardCanvas(side) {
    const W = Math.round(BW * PXU), H = Math.round(BD * PXU), c = canvas(W, H), g = c.getContext('2d');
    grain(g, W, H, '#d7ad6c', '#7a4a1c', 140);
    const X = (u) => W / 2 + u * PXU, Z = (u) => H / 2 + u * PXU;
    const at = (f, r) => [X((f - 4) * G), Z((4.5 - r) * G)];
    g.strokeStyle = '#3a2412'; g.lineCap = 'square';
    // outer double frame
    g.lineWidth = 12; g.strokeRect(X(-4 * G) - 34, Z(-4.5 * G) - 34, 8 * G * PXU + 68, 9 * G * PXU + 68);
    g.lineWidth = 5;
    for (let r = 0; r < 10; r++) { const [x0, y] = at(0, r), [x1] = at(8, r); g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    for (let f = 0; f < 9; f++) {
      const [x, y0] = at(f, 0), [, y4] = at(f, 4), [, y5] = at(f, 5), [, y9] = at(f, 9);
      g.beginPath();
      if (f === 0 || f === 8) { g.moveTo(x, y0); g.lineTo(x, y9); } else { g.moveTo(x, y0); g.lineTo(x, y4); g.moveTo(x, y5); g.lineTo(x, y9); }
      g.stroke();
    }
    // the palaces' diagonals
    for (const [r0, r1] of [[0, 2], [7, 9]]) {
      const a = at(3, r0), b = at(5, r1), c2 = at(5, r0), d = at(3, r1);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c2[0], c2[1]); g.lineTo(d[0], d[1]); g.stroke();
    }
    // little corner marks where the cannons and soldiers start
    const tick = (f, r) => {
      const [x, y] = at(f, r), o = 14, l = 30;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        if ((f === 0 && sx < 0) || (f === 8 && sx > 0)) continue;
        g.beginPath(); g.moveTo(x + sx * (o + l), y + sy * o); g.lineTo(x + sx * o, y + sy * o); g.lineTo(x + sx * o, y + sy * (o + l)); g.stroke();
      }
    };
    g.lineWidth = 4;
    for (const r of [2, 7]) for (const f of [1, 7]) tick(f, r);
    for (const r of [3, 6]) for (const f of [0, 2, 4, 6, 8]) tick(f, r);
    // the river, with its old names: Chu River and Han Border
    const [, ry4] = at(0, 4), [, ry5] = at(0, 5), my = (ry4 + ry5) / 2;
    g.fillStyle = 'rgba(70, 110, 120, 0.16)'; g.fillRect(X(-4 * G), ry5, 8 * G * PXU, ry4 - ry5);
    g.fillStyle = '#3a2412'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 150px "' + FONT + '", serif';
    const flip = side === 'black';
    const word = (txt, x, rot) => { g.save(); g.translate(x, my); g.rotate(rot); g.fillText(txt, 0, 6); g.restore(); };
    const left = X(-2 * G), right = X(2 * G);
    word('楚 河', flip ? right : left, flip ? Math.PI : 0);
    word('漢 界', flip ? left : right, flip ? 0 : Math.PI);
    // coordinates, in the game's letters and numbers, along the margin nearest the player
    g.font = '600 64px "Cinzel", serif'; g.fillStyle = '#5a3a1c';
    for (let f = 0; f < 9; f++) {
      const [x] = at(f, 0);
      g.save(); g.translate(x, flip ? Z(-4.5 * G) - 84 : Z(4.5 * G) + 84); if (flip) g.rotate(Math.PI); g.fillText('abcdefghi'[f], 0, 0); g.restore();
    }
    for (let r = 0; r < 10; r++) {
      const [, y] = at(0, r);
      g.save(); g.translate(flip ? X(4 * G) + 84 : X(-4 * G) - 84, y); if (flip) g.rotate(Math.PI); g.fillText(String(r), 0, 0); g.restore();
    }
    return c;
  }
  function topCanvas(type, red) {
    const N = 256, c = canvas(N), g = c.getContext('2d');
    grain(g, N, N, red ? '#ecd3a0' : '#e2c48c', '#8a5a26', 26);
    const ink = red ? INK.red : INK.black;
    g.strokeStyle = ink; g.lineWidth = 7; g.beginPath(); g.arc(N / 2, N / 2, N * 0.4, 0, Math.PI * 2); g.stroke();
    g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 150px "' + FONT + '", serif';
    g.fillText(NAMES[type][red ? 0 : 1], N / 2, N / 2 + 8);
    return c;
  }

  // ---------------------------------------------------------------- the board
  const boardTex = tex(boardCanvas('red'));
  const boardMat = keep(new THREE.MeshPhysicalMaterial({ map: boardTex, roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.25 }));
  const sideMat = keep(new THREE.MeshPhysicalMaterial({ color: '#6a3a18', roughness: 0.45, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  const slab = new THREE.Mesh(keep(new THREE.BoxGeometry(BW, 0.34, BD)), [sideMat, sideMat, boardMat, sideMat, sideMat, sideMat]);
  slab.position.y = TOP - 0.17; slab.receiveShadow = true; slab.castShadow = true;
  // the box texture's top face is laid with +z down the picture, so the board reads from Red's side
  group.add(slab);
  const plinth = new THREE.Mesh(keep(new THREE.BoxGeometry(BW + 0.3, 0.14, BD + 0.3)), sideMat);
  plinth.position.y = TOP - 0.41; plinth.receiveShadow = true; plinth.castShadow = true;
  group.add(plinth);
  const brass = keep(new THREE.MeshStandardMaterial({ color: '#c99a4a', metalness: 1, roughness: 0.3 }));
  for (const [w, d, x, z] of [[BW + 0.04, 0.04, 0, BD / 2], [BW + 0.04, 0.04, 0, -BD / 2], [0.04, BD, BW / 2, 0], [0.04, BD, -BW / 2, 0]]) {
    const m = new THREE.Mesh(keep(new THREE.BoxGeometry(w, 0.04, d)), brass); m.position.set(x, TOP - 0.02, z); group.add(m);
  }
  let labelSide = 'red';
  function relabel(side) {
    labelSide = side;
    const t = tex(boardCanvas(side));
    boardMat.map = t; boardMat.needsUpdate = true;
  }

  // ---------------------------------------------------------------- pieces
  const R0 = 0.36, H0 = 0.17;
  const profile = [[0, 0], [R0 - 0.03, 0], [R0, 0.025], [R0 + 0.006, H0 * 0.5], [R0, H0 - 0.025], [R0 - 0.03, H0], [0, H0]].map(([x, y]) => new THREE.Vector2(x, y));
  const bodyGeo = keep(new THREE.LatheGeometry(profile, 48));
  const bandGeo = keep(new THREE.CylinderGeometry(R0 + 0.009, R0 + 0.009, 0.035, 48, 1, true));
  const faceGeo = keep(new THREE.CircleGeometry(R0 - 0.035, 48)); faceGeo.rotateX(-Math.PI / 2);
  const woodMat = keep(new THREE.MeshPhysicalMaterial({ color: '#e1bf86', roughness: 0.42, clearcoat: 0.9, clearcoatRoughness: 0.18 }));
  const bandMat = { red: keep(new THREE.MeshPhysicalMaterial({ color: '#9e1d16', roughness: 0.3, clearcoat: 1 })), black: keep(new THREE.MeshPhysicalMaterial({ color: '#1a1410', roughness: 0.3, clearcoat: 1 })) };
  const faceMats = {};
  const faceMat = (type, red) => {
    const k = type + (red ? 'r' : 'b');
    if (!faceMats[k]) faceMats[k] = keep(new THREE.MeshPhysicalMaterial({ map: tex(topCanvas(type, red)), roughness: 0.4, clearcoat: 0.9, clearcoatRoughness: 0.15 }));
    return faceMats[k];
  };
  function makePiece(p) {
    const red = p > 0, type = Math.abs(p);
    const o = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, woodMat); body.castShadow = true; body.receiveShadow = true;
    const band = new THREE.Mesh(bandGeo, bandMat[red ? 'red' : 'black']); band.position.y = H0 * 0.5;
    const face = new THREE.Mesh(faceGeo, faceMat(type, red)); face.position.y = H0 + 0.001;
    o.add(body, band, face);
    o.userData = { p };
    return o;
  }
  // pieces: { obj, sq, p, x, z, y, anim, dead }
  let pieces = [], capturedRow = { red: 0, black: 0 };
  const place = (s) => { s.obj.position.set(s.x, TOP + s.y, s.z); };
  const facing = () => (labelSide === 'black' ? Math.PI : 0);
  function setPosition(board) {
    for (const s of pieces) pieceGroup.remove(s.obj);
    pieces = []; capturedRow = { red: 0, black: 0 };
    for (let i = 0; i < 90; i++) {
      const p = board[i]; if (!p) continue;
      const s = { obj: makePiece(p), sq: i, p, x: px(i), z: pz(i), y: 0 };
      s.obj.rotation.y = facing();
      place(s); pieceGroup.add(s.obj); pieces.push(s);
    }
    draw();
  }
  // Captured pieces stand in a row beside the board, on the capturer's right.
  function shelf(color) {
    const n = capturedRow[color]++, row = n % 8, col = (n / 8) | 0;
    const x = (color === 'black' ? 1 : -1) * (BW / 2 + 0.55 + col * 0.8);
    const z = (color === 'black' ? -1 : 1) * (BD / 2 - 0.5 - row * 0.78);
    return [x, z];
  }
  const anims = new Set();
  let animOn = true;
  // Moves a piece from info.from to info.to, taking what stands there.
  function move(info, done) {
    const s = pieces.find((x) => x.sq === info.from && !x.dead);
    const v = pieces.find((x) => x.sq === info.to && !x.dead && x !== s);
    if (!s) { if (done) done(); return; }
    if (v) {
      v.dead = true;
      const [gx, gz] = shelf(v.p > 0 ? 'red' : 'black');
      anims.add({ s: v, start: performance.now() + (animOn ? 220 : 0), dur: animOn ? 380 : 0, fx: v.x, fz: v.z, tx: gx, tz: gz, arc: 0.5 });
    }
    s.sq = info.to;
    anims.add({ s, start: performance.now(), dur: animOn ? 320 : 0, fx: s.x, fz: s.z, tx: px(info.to), tz: pz(info.to), arc: 0.35, done });
    requestRender();
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function step(now) {
    let busy = false;
    for (const a of anims) {
      const t = a.dur ? Math.min(1, Math.max(0, (now - a.start) / a.dur)) : 1;
      if (now < a.start) { busy = true; continue; }
      const e = ease(t);
      a.s.x = a.fx + (a.tx - a.fx) * e; a.s.z = a.fz + (a.tz - a.fz) * e; a.s.y = Math.sin(Math.PI * t) * a.arc;
      place(a.s);
      if (t >= 1) { anims.delete(a); if (a.done) a.done(); } else busy = true;
    }
    for (const m of markGroup.children) if (m.userData.pulse && m.visible) { m.material.opacity = 0.55 + 0.3 * Math.sin(now / 170); busy = busy || animOn; }
    return busy;
  }

  // ---------------------------------------------------------------- marks
  const dotGeo = keep(new THREE.CircleGeometry(0.11, 32)); dotGeo.rotateX(-Math.PI / 2);
  const ringGeo = keep(new THREE.RingGeometry(R0 + 0.03, R0 + 0.1, 48)); ringGeo.rotateX(-Math.PI / 2);
  const spotGeo = keep(new THREE.CircleGeometry(R0 + 0.06, 48)); spotGeo.rotateX(-Math.PI / 2);
  const pool = [];
  let used = 0, marks = {};
  function mark(geo, s, color, alpha, y, pulse) {
    let m = pool[used];
    if (!m) { m = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })); m.renderOrder = 3; pool.push(m); markGroup.add(m); }
    used++;
    m.geometry = geo; m.material.color.set(color); m.material.opacity = alpha; m.userData.pulse = !!pulse;
    m.position.set(px(s), TOP + (y || 0.006), pz(s)); m.visible = true;
  }
  function draw() {
    used = 0;
    const h = marks;
    for (const s of h.spots || []) { mark(spotGeo, s.sq, s.color || '#3fd0b0', s.alpha || 0.45, 0.004, s.pulse); mark(ringGeo, s.sq, s.color || '#3fd0b0', 0.9, 0.008, s.pulse); }
    if (h.lastFrom >= 0) mark(spotGeo, h.lastFrom, '#f0c26a', 0.28);
    if (h.lastTo >= 0) mark(ringGeo, h.lastTo, '#f6d58a', 0.75);
    if (h.check >= 0) mark(ringGeo, h.check, '#ff3b30', 0.95, 0.008, true);
    if (h.selected >= 0) { mark(spotGeo, h.selected, '#e9b65c', 0.4); mark(ringGeo, h.selected, '#ffd27a', 0.95, 0.008); }
    for (const s of h.targets || []) mark(dotGeo, s, '#2a1608', 0.55, 0.008);
    for (const s of h.captures || []) mark(ringGeo, s, '#ff6a4a', 0.9, 0.008);
    for (let i = used; i < pool.length; i++) pool[i].visible = false;
    // the selected piece lifts a little
    for (const s of pieces) if (!s.dead && !anims.size) { s.y = s.sq === h.selected ? 0.06 : 0; place(s); }
    requestRender();
  }
  function setMarks(h) { marks = h || {}; draw(); }

  // ---------------------------------------------------------------- taps
  let onPoint = () => {};
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
  function click(raycaster) {
    // a piece first (it stands above the board), then the nearest point under the tap
    const hits = raycaster.intersectObjects(pieces.filter((s) => !s.dead).map((s) => s.obj), true);
    if (hits.length) {
      let o = hits[0].object; while (o && o.parent !== pieceGroup) o = o.parent;
      const s = pieces.find((x) => x.obj === o && !x.dead);
      if (s) { onPoint(s.sq); return; }
    }
    const hit = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return;
    const f = Math.round(hit.x / G + 4), r = Math.round(4.5 - hit.z / G);
    if (f < 0 || f > 8 || r < 0 || r > 9) return;
    if (Math.hypot(hit.x - (f - 4) * G, hit.z - (4.5 - r) * G) > G * 0.55) return;
    onPoint(r * 9 + f);
  }

  // ---------------------------------------------------------------- the font
  // The carved names use a small Noto Serif SC cut of just these characters (SIL Open Font
  // License), inlined by build.py. The board and faces are painted again once it is ready.
  let requestRender = () => {};
  function repaint() {
    if (gone) return;
    for (const k of Object.keys(faceMats)) { const m = faceMats[k]; const red = k.endsWith('r'); m.map = tex(topCanvas(+k[0], red)); m.needsUpdate = true; }
    relabel(labelSide);
    requestRender();
  }
  if (typeof document !== 'undefined' && document.fonts) {
    const ready = typeof CHACKLATE_XQ_FONT !== 'undefined' && !document.fonts.check('900 40px "' + FONT + '"')
      ? new FontFace(FONT, 'url(' + CHACKLATE_XQ_FONT + ')', { weight: '900' }).load().then((f) => { document.fonts.add(f); })
      : document.fonts.load('900 40px "' + FONT + '"');
    Promise.all([ready, document.fonts.load('600 64px "Cinzel"')]).then(repaint, repaint);
  }

  return {
    group,
    click,
    step,
    setPosition,
    move,
    setMarks,
    setSide(side) { if (side !== labelSide) relabel(side); for (const s of pieces) s.obj.rotation.y = facing(); requestRender(); },
    setAnimations(on) { animOn = !!on; },
    onPoint(fn) { onPoint = fn || (() => {}); },
    tap(sq) { onPoint(sq); },   // screenshot tooling
    bindRender(fn) { requestRender = fn || (() => {}); },
    pointXZ: (s) => [px(s), pz(s)],
    dispose() { gone = true; for (const d of disposables) if (d.dispose) d.dispose(); for (const m of pool) m.material.dispose(); },
  };
}
if (typeof module !== 'undefined') module.exports = ChacklateXiangqiTable;
