// The flat board: used in place of the 3D table when a device cannot start 3D graphics (no WebGL,
// a blocked GPU, a text-only reader). It takes the same calls as the 3D table (src/scene.js) for
// everything a game needs: pieces, highlights, arrows, moves, which side is at the bottom, and the
// room the menus leave; it sends the same taps, drags and drops back. So every game, lesson,
// puzzle and mini-game stays playable, by tapping or dragging pieces, with a mouse or the keyboard.
//
// Squares are numbered as in the game: a1 = 0, h1 = 7, a8 = 56. Pieces are signed numbers:
// 1 pawn, 2 knight, 3 bishop, 4 rook, 5 queen, 6 king; white above zero, black below.
function ChacklateBoard2D(host, options) {
  const opts = Object.assign({ onSquare() {}, canDrag() { return false; }, onDrop() { return false; }, label: 'Chess board', caption: '' }, options);
  const FILES = 'abcdefgh';
  const NAMES = { 1: 'pawn', 2: 'knight', 3: 'bishop', 4: 'rook', 5: 'queen', 6: 'king' };
  // The filled shapes for both sides (coloured by CSS); U+FE0E keeps phones from drawing emoji.
  const GLYPH = { 1: '♟︎', 2: '♞︎', 3: '♝︎', 4: '♜︎', 5: '♛︎', 6: '♚︎' };
  const sqName = (sq) => FILES[sq & 7] + (1 + (sq >> 3));

  const wrap = document.createElement('div');
  wrap.className = 'board2d';
  wrap.innerHTML = '<div class="b2-board" role="grid"></div><svg class="b2-arrows" viewBox="0 0 8 8" aria-hidden="true"></svg>' +
    (opts.caption ? '<p class="b2-cap"></p>' : '');
  host.appendChild(wrap);
  const boardEl = wrap.querySelector('.b2-board'), svg = wrap.querySelector('.b2-arrows');
  boardEl.setAttribute('aria-label', opts.label);
  if (opts.caption) { const cap = wrap.querySelector('.b2-cap'); cap.textContent = opts.caption; if (opts.captionKey) cap.dataset.t = opts.captionKey; }

  let side = 'white', pieces = new Map(), hl = {}, arrows = [], insets = { top: 0, right: 0, bottom: 0, left: 0 }, alt = false, focusSq = 4;
  const cells = [];
  for (let k = 0; k < 64; k++) {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'b2-sq';
    c.setAttribute('role', 'gridcell');
    c.tabIndex = -1;
    boardEl.appendChild(c);
    cells.push(c);
  }
  // The cell drawn at grid position k (top-left first) is square sqAt(k), from the bottom side's view.
  const sqAt = (k) => { const r = k >> 3, f = k & 7; return side === 'white' ? (7 - r) * 8 + f : r * 8 + (7 - f); };
  const cellOf = (sq) => { for (let k = 0; k < 64; k++) if (sqAt(k) === sq) return cells[k]; return null; };

  function draw() {
    const marks = {};
    const add = (sq, cls) => { if (sq >= 0 && sq < 64) (marks[sq] = marks[sq] || []).push(cls); };
    add(hl.lastFrom, 'last'); add(hl.lastTo, 'last');
    add(hl.hintFrom, 'hint'); add(hl.hintTo, 'hint');
    for (const s of hl.marks || []) add(s.sq, 'mark');
    for (const s of hl.spots || []) add(s.sq, 'spot');
    add(hl.check, 'check'); add(hl.selected, 'sel');
    for (const t of hl.targets || []) add(t, 'target');
    for (const t of hl.captures || []) add(t, 'capture');
    const markColor = {};
    for (const s of (hl.marks || []).concat(hl.spots || [])) if (s.color) markColor[s.sq] = s.color;
    for (let k = 0; k < 64; k++) {
      const sq = sqAt(k), c = cells[k], p = pieces.get(sq), r = k >> 3, f = k & 7;
      const light = ((sq >> 3) + (sq & 7)) % 2 === 1;
      c.className = 'b2-sq ' + (light ? 'lt' : 'dk') + (marks[sq] ? ' ' + marks[sq].join(' ') : '');
      c.dataset.sq = sq;
      c.style.setProperty('--mk', markColor[sq] || '');
      c.innerHTML = (p ? '<span class="b2-pc ' + (p > 0 ? 'w' : 'b') + '">' + GLYPH[Math.abs(p)] + '</span>' : '') +
        (f === 0 ? '<i class="b2-rk">' + (1 + (sq >> 3)) + '</i>' : '') + (r === 7 ? '<i class="b2-fl">' + FILES[sq & 7] + '</i>' : '');
      c.setAttribute('aria-label', sqName(sq) + (p ? ', ' + (p > 0 ? 'white ' : 'black ') + NAMES[Math.abs(p)] : '') + (marks[sq] && marks[sq].includes('target') ? ', move here' : ''));
      c.tabIndex = sq === focusSq ? 0 : -1;
    }
    drawArrows();
  }
  function drawArrows() {
    const pt = (sq) => { const f = sq & 7, r = sq >> 3; return side === 'white' ? [f + 0.5, 7 - r + 0.5] : [7 - f + 0.5, r + 0.5]; };
    svg.innerHTML = arrows.map((a, i) => {
      const [x0, y0] = pt(a.from), [x1, y1] = pt(a.to), col = a.color || '#2fd8ff';
      const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
      const ex = x1 - ux * 0.32, ey = y1 - uy * 0.32, w = 0.13 * (a.width || 1);
      return '<g opacity="' + (a.alpha || 0.9) + '"><line x1="' + (x0 + ux * 0.2) + '" y1="' + (y0 + uy * 0.2) + '" x2="' + ex + '" y2="' + ey + '" stroke="' + col + '" stroke-width="' + w + '" stroke-linecap="round"/>' +
        '<polygon points="' + x1 + ',' + y1 + ' ' + (ex - uy * 0.22) + ',' + (ey + ux * 0.22) + ' ' + (ex + uy * 0.22) + ',' + (ey - ux * 0.22) + '" fill="' + col + '"/></g>';
    }).join('');
  }
  // The board sits in the room the menus leave, as big as fits.
  function place() {
    const W = innerWidth, H = innerHeight;
    const cap = opts.caption ? 28 : 0;
    const w = Math.max(120, W - insets.left - insets.right - 24), h = Math.max(120, H - insets.top - insets.bottom - 24 - cap);
    const size = Math.floor(Math.min(w, h, 720) / 8) * 8;
    wrap.style.width = size + 'px';
    wrap.style.setProperty('--b2', size / 8 + 'px');
    wrap.style.left = Math.round(insets.left + (W - insets.left - insets.right - size) / 2) + 'px';
    wrap.style.top = Math.round(insets.top + (H - insets.top - insets.bottom - size - cap) / 2) + 'px';
  }
  addEventListener('resize', place);

  // Taps and drags, as the 3D table sends them: a piece that can move is picked up on press
  // ('down'), any other square is a 'click', and a drag that ends on another square is a drop.
  let press = null, ghost = null;
  const sqFromPoint = (x, y) => { const el = document.elementFromPoint(x, y); const c = el && el.closest && el.closest('.b2-sq'); return c && wrap.contains(c) ? +c.dataset.sq : -1; };
  boardEl.addEventListener('pointerdown', (e) => {
    if (alt || e.button > 0) return;
    const c = e.target.closest('.b2-sq');
    if (!c) return;
    const sq = +c.dataset.sq;
    focusSq = sq;
    if (pieces.has(sq) && opts.canDrag(sq)) {
      press = { sq, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
      try { boardEl.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      opts.onSquare(sq, 'down');
    } else press = { sq, x: e.clientX, y: e.clientY, moved: false, id: e.pointerId, tap: true };
    e.preventDefault();
  });
  boardEl.addEventListener('pointermove', (e) => {
    if (!press || press.tap || press.id !== e.pointerId) return;
    if (!press.moved && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) return;
    if (!press.moved) {
      press.moved = true;
      const from = cellOf(press.sq), pc = from && from.querySelector('.b2-pc');
      if (pc) { ghost = pc.cloneNode(true); ghost.classList.add('b2-ghost'); ghost.style.fontSize = getComputedStyle(pc).fontSize; document.body.appendChild(ghost); pc.style.opacity = '0.35'; }
    }
    if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; }
  });
  const endPress = (e, cancel) => {
    if (!press || press.id !== e.pointerId) return;
    const p = press; press = null;
    if (ghost) { ghost.remove(); ghost = null; }
    if (cancel) { draw(); return; }
    if (p.tap) { const sq = sqFromPoint(e.clientX, e.clientY); if (sq === p.sq) opts.onSquare(sq, 'click'); return; }
    if (p.moved) {
      const to = sqFromPoint(e.clientX, e.clientY);
      if (!(to >= 0 && to !== p.sq && opts.onDrop(p.sq, to))) draw();
    }
  };
  boardEl.addEventListener('pointerup', (e) => endPress(e, false));
  boardEl.addEventListener('pointercancel', (e) => endPress(e, true));
  // Keyboard: arrow keys walk the squares, Enter or Space taps the one in focus.
  boardEl.addEventListener('keydown', (e) => {
    const step = { ArrowUp: 8, ArrowDown: -8, ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (step !== undefined) {
      const s = side === 'white' ? step : -step, f = (focusSq & 7) + (Math.abs(s) === 1 ? s : 0), r = (focusSq >> 3) + (Math.abs(s) === 8 ? s / 8 : 0);
      if (f >= 0 && f < 8 && r >= 0 && r < 8) { focusSq = r * 8 + f; draw(); const c = cellOf(focusSq); if (c) c.focus(); }
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      const sq = +(e.target.closest('.b2-sq') || {}).dataset.sq;
      if (sq >= 0) opts.onSquare(sq, pieces.has(sq) && opts.canDrag(sq) ? 'down' : 'click');
      e.preventDefault();
    }
  });

  place();
  draw();
  return {
    flat: true,
    setBoard(list) { pieces = new Map((list || []).map(([sq, p]) => [sq, p])); draw(); },
    setHighlights(h) { hl = h || {}; draw(); },
    setArrows(list) { arrows = list || []; drawArrows(); },
    setView(s) { if (s === 'white' || s === 'black') { side = s; draw(); } },
    setInsets(ins) { insets = Object.assign({ top: 0, right: 0, bottom: 0, left: 0 }, ins || {}); place(); },
    // The move lands at once (the 3D table animates it); the caller sets the new position after.
    animateMove(info, done) {
      if (info && pieces.has(info.from)) {
        const p = pieces.get(info.from);
        if (info.capturedSq >= 0) pieces.delete(info.capturedSq);
        pieces.delete(info.from);
        if (info.rook) { const r = pieces.get(info.rook[0]); pieces.delete(info.rook[0]); if (r) pieces.set(info.rook[1], r); }
        pieces.set(info.to, info.promo || p);
        draw();
      }
      if (done) done();
    },
    // Another game's 3D table (Xiangqi) has no flat drawing yet: the chessboard steps aside.
    setAlt(a) { alt = !!a; wrap.classList.toggle('away', alt); },
    resize: place,
    el: wrap,
  };
}
if (typeof module !== 'undefined') module.exports = ChacklateBoard2D;
