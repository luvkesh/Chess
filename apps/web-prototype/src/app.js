// Chacklate Chess app: wires the rules engine, the computer opponent (in a
// Web Worker) and the 3D view to the panel controls.
(function () {
  'use strict';
  const E = ChacklateEngine();
  const { WHITE, BLACK, LEVELS } = E;
  const $ = (id) => document.getElementById(id);
  const STORE_KEY = 'chacklate-chess:v1';
  const GLYPH = { 1: '♟', 2: '♞', 3: '♝', 4: '♜', 5: '♛', 6: '♚' };
  const VALUE = [0, 1, 3, 3, 5, 9, 0];
  const REASON_TEXT = {
    checkmate: 'Checkmate',
    resignation: 'Resignation',
    timeout: 'Time ran out',
    'timeout-insufficient': 'Time ran out, but no mate was possible',
    stalemate: 'Stalemate',
    insufficient: 'Not enough material to checkmate',
    threefold: 'Threefold repetition',
    fivefold: 'Fivefold repetition',
    fifty: 'Fifty-move rule',
    seventyfive: 'Seventy-five-move rule',
    agreement: 'Draw agreed',
  };

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    settings: { board: 'walnut', pieces: 'tempered', quality: 'high', animations: !reducedMotion, sound: true, legal: true, turnBoard: true },
    setup: { mode: 'ai', color: 'white', level: 1, tc: 'none', fen: '' },
    game: null,
    human: WHITE,
    clock: null,
    selected: -1,
    hint: null,
    busy: false,
    thinking: false,
    request: 0,
    viewSide: 'white',
    viewPreset: 'player',
    resignArmed: 0,
    resultShown: false,
  };

  // ------------------------------------------------------------ persistence
  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); } catch (e) { return null; }
  }
  function save() {
    try {
      const g = state.game;
      localStorage.setItem(STORE_KEY, JSON.stringify({
        settings: state.settings, setup: state.setup, human: state.human,
        game: g ? { start: g.startFen, moves: g.uciMoves(), ended: g.ended } : null,
        clock: state.clock ? { w: state.clock.w, b: state.clock.b, inc: state.clock.inc } : null,
      }));
    } catch (e) { /* storage unavailable: the game still works, it just isn't remembered */ }
  }

  // ------------------------------------------------------------------ sound
  let audio = null;
  function tone(kind) {
    if (!state.settings.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const t = audio.currentTime;
      if (kind === 'move' || kind === 'capture') {
        const len = kind === 'capture' ? 0.11 : 0.06;
        const buf = audio.createBuffer(1, Math.ceil(audio.sampleRate * len), audio.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3);
        const src = audio.createBufferSource(); src.buffer = buf;
        const f = audio.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = kind === 'capture' ? 650 : 1100; f.Q.value = 1.4;
        const g = audio.createGain(); g.gain.value = kind === 'capture' ? 0.9 : 0.6;
        src.connect(f).connect(g).connect(audio.destination); src.start(t);
      } else {
        const notes = kind === 'check' ? [880, 1175] : kind === 'win' ? [523, 659, 784, 1047] : kind === 'loss' ? [392, 330, 262] : [523, 523];
        notes.forEach((hz, i) => {
          const o = audio.createOscillator(), g = audio.createGain();
          o.type = 'sine'; o.frequency.value = hz;
          g.gain.setValueAtTime(0.0001, t + i * 0.11);
          g.gain.exponentialRampToValueAtTime(0.18, t + i * 0.11 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.11 + 0.35);
          o.connect(g).connect(audio.destination); o.start(t + i * 0.11); o.stop(t + i * 0.11 + 0.4);
        });
      }
    } catch (e) { /* audio unavailable */ }
  }

  // ------------------------------------------------------------ AI worker
  let worker = null;
  const pending = new Map();
  try {
    const src = 'const E=(' + ChacklateEngine.toString() + ')();' +
      'onmessage=function(e){var d=e.data;try{var p=E.positionFrom(d.fen,d.moves);var r=E.search(p,d.opts);' +
      'postMessage({id:d.id,uci:r.move?E.uci(r.move):null,score:r.score,depth:r.depth});}' +
      'catch(err){postMessage({id:d.id,error:String(err)});}};';
    worker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    worker.onmessage = (e) => { const cb = pending.get(e.data.id); pending.delete(e.data.id); if (cb) cb(e.data); };
    worker.onerror = () => { worker = null; };
  } catch (e) { worker = null; }

  function think(opts, cb) {
    const id = ++state.request;
    const g = state.game;
    const msg = { id, fen: g.startFen, moves: g.uciMoves(), opts };
    if (worker) { pending.set(id, cb); worker.postMessage(msg); }
    else {
      // No worker available: think on the page (the view pauses briefly).
      setTimeout(() => {
        const p = E.positionFrom(msg.fen, msg.moves);
        const r = E.search(p, opts);
        cb({ id, uci: r.move ? E.uci(r.move) : null, score: r.score, depth: r.depth });
      }, 30);
    }
    return id;
  }

  // ------------------------------------------------------------------ view
  const canvas = $('board');
  let view = null;
  try {
    view = ChacklateRenderer(canvas, {
      onSquare,
      onContextLost() { $('nogl').hidden = false; },
    });
  } catch (e) { view = null; }
  if (!view) { $('nogl').hidden = false; view = nullView(); }

  function nullView() {
    const noop = () => {};
    return { BOARD_THEMES: {}, PIECE_THEMES: {}, setBoard: noop, setHighlights: noop, setTheme: noop, setQuality: noop, setAnimations: noop,
      setView: noop, celebrate: noop, requestRender: noop, resize: noop, animateMove(info, done) { done(); } };
  }

  function boardPieces() {
    const out = [];
    for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(state.game.pos, sq); if (p) out.push([sq, p]); }
    return out;
  }

  function kingSquare(side) {
    for (let sq = 0; sq < 64; sq++) if (E.pieceAt(state.game.pos, sq) === E.K * side) return sq;
    return -1;
  }

  function applyView(instant) { view.setView(state.viewSide, state.viewPreset, instant); $('view-toggle').textContent = state.viewPreset === 'top' ? '3D view' : 'Top view'; }

  function refreshHighlights() {
    const g = state.game;
    if (!g) return;
    const h = { selected: state.selected, targets: [], captures: [], lastFrom: -1, lastTo: -1, check: -1, hintFrom: -1, hintTo: -1 };
    if (g.moves.length) { const last = g.moves[g.moves.length - 1]; h.lastFrom = E.mFrom(last); h.lastTo = E.mTo(last); }
    if (!g.outcome && g.pos.inCheck()) h.check = kingSquare(g.pos.side);
    if (g.outcome && g.outcome.reason === 'checkmate') h.check = kingSquare(g.pos.side);
    if (state.selected >= 0 && state.settings.legal) {
      for (const t of g.targets(state.selected)) {
        const victim = E.pieceAt(g.pos, t);
        const isEp = !victim && Math.abs(E.pieceAt(g.pos, state.selected)) === E.P && (t & 7) !== (state.selected & 7);
        (victim || isEp ? h.captures : h.targets).push(t);
      }
    }
    if (state.hint) { h.hintFrom = state.hint.from; h.hintTo = state.hint.to; }
    view.setHighlights(h);
  }

  // ----------------------------------------------------------------- clock
  function parseTc(tc) {
    if (tc === 'none') return null;
    const [m, s] = tc.split('+').map(Number);
    return { w: m * 60000, b: m * 60000, inc: s * 1000, since: 0 };
  }
  function clockSide() { return state.game.pos.side === WHITE ? 'w' : 'b'; }
  // The clock starts once White has made the first move.
  function clockRunning() { return state.clock && !state.game.outcome && state.game.moves.length > 0 ; }
  function chargeClock(now) {
    const c = state.clock;
    if (!c || !clockRunning() || !c.since) { if (c) c.since = now; return; }
    const k = clockSide();
    c[k] = Math.max(0, c[k] - (now - c.since));
    c.since = now;
  }
  function pressClock(moverKey) {
    const c = state.clock;
    if (!c) return;
    const now = performance.now();
    if (state.game.moves.length > 1 && c.since) c[moverKey] = Math.max(0, c[moverKey] - (now - c.since));
    if (state.game.moves.length > 1) c[moverKey] += c.inc;
    c.since = now;
  }
  setInterval(() => {
    if (!state.clock || !state.game || state.game.outcome || state.game.moves.length === 0) return;
    chargeClock(performance.now());
    const k = clockSide();
    if (state.clock[k] <= 0) {
      state.request++; // cancel any pending computer move
      state.thinking = false;
      state.game.timeout(state.game.pos.side);
      endGame();
    }
    renderClocks();
  }, 100);

  function fmt(ms) {
    const s = Math.max(0, ms) / 1000;
    if (s < 10) return s.toFixed(1);
    const m = Math.floor(s / 60), r = Math.floor(s % 60);
    return m + ':' + String(r).padStart(2, '0');
  }

  // ------------------------------------------------------------- game flow
  function sideName(side) {
    if (state.setup.mode === 'ai') return side === state.human ? 'You' : LEVELS[state.setup.level].name;
    return side === WHITE ? 'White' : 'Black';
  }

  function startGame(setup, restore) {
    state.setup = Object.assign({}, setup);
    state.request++;
    state.thinking = false; state.busy = false; state.selected = -1; state.hint = null; state.resultShown = false;
    let game;
    try { game = new E.Game(setup.fen || E.START_FEN); } catch (e) { game = new E.Game(); state.setup.fen = ''; }
    state.game = game;
    state.human = setup.color === 'black' ? BLACK : setup.color === 'random' ? (Math.random() < 0.5 ? WHITE : BLACK) : WHITE;
    state.clock = parseTc(setup.tc);
    if (restore) {
      if (restore.human) state.human = restore.human;
      for (const u of restore.moves || []) { if (!game.playText(u)) break; }
      if (restore.ended) game.finish(restore.ended.result, restore.ended.reason);
      if (restore.clock && state.clock) Object.assign(state.clock, restore.clock, { since: 0 });
      state.resultShown = !!game.outcome;
    }
    state.viewSide = setup.mode === 'ai' ? (state.human === WHITE ? 'white' : 'black')
      : (state.settings.turnBoard ? (game.pos.side === WHITE ? 'white' : 'black') : 'white');
    view.setBoard(boardPieces());
    applyView(true);
    refreshHighlights();
    renderAll();
    save();
    if (game.outcome && !restore) endGame();
    maybeComputer();
  }

  function humanTurn() {
    const g = state.game;
    if (!g || g.outcome || state.busy || state.thinking) return false;
    return state.setup.mode === 'local' || g.pos.side === state.human;
  }

  function onSquare(sq) {
    if (!humanTurn()) return;
    const g = state.game;
    const piece = E.pieceAt(g.pos, sq);
    if (state.selected >= 0 && g.targets(state.selected).includes(sq)) { attempt(state.selected, sq); return; }
    if (piece && Math.sign(piece) === g.pos.side && g.targets(sq).length) state.selected = sq;
    else if (piece && Math.sign(piece) === g.pos.side) { state.selected = sq; toast('That piece has no legal moves.'); }
    else state.selected = -1;
    refreshHighlights();
  }

  function attempt(from, to) {
    const g = state.game;
    if (g.needsPromotion(from, to)) {
      choosePromotion(g.pos.side, (kind) => { const m = g.find(from, to, kind); if (m !== null) playMove(m); });
      return;
    }
    const m = g.find(from, to, 0);
    if (m !== null) playMove(m);
  }

  function playMove(m) {
    const g = state.game;
    const moverKey = clockSide();
    const info = g.play(m);
    if (!info) return;
    pressClock(moverKey);
    state.request++; // drop any hint still being computed for the old position
    state.selected = -1; state.hint = null;
    state.busy = true;
    tone(info.captured ? 'capture' : 'move');
    if (info.check && !g.outcome) setTimeout(() => tone('check'), 90);
    renderAll();
    view.animateMove(info, () => {
      state.busy = false;
      view.setBoard(boardPieces());
      if (state.setup.mode === 'local' && state.settings.turnBoard && !g.outcome) {
        state.viewSide = g.pos.side === WHITE ? 'white' : 'black';
        applyView(false);
      }
      refreshHighlights();
      renderAll();
      save();
      if (g.outcome) endGame();
      else maybeComputer();
    });
    refreshHighlights();
  }

  function maybeComputer() {
    const g = state.game;
    if (state.setup.mode !== 'ai' || g.outcome || g.pos.side === state.human || state.busy) return;
    const level = LEVELS[state.setup.level];
    let timeMs = level.timeMs;
    if (state.clock) {
      const left = state.clock[clockSide()];
      timeMs = Math.max(120, Math.min(timeMs, left / 30 + state.clock.inc * 0.6));
    }
    state.thinking = true;
    renderAll();
    const started = performance.now();
    const id = think(Object.assign({}, level, { timeMs }), (r) => {
      if (id !== state.request || state.game !== g) return; // superseded by undo/new game
      state.thinking = false;
      // Short pause so instant replies at low levels still feel like a turn.
      const delay = Math.max(0, 350 - (performance.now() - started));
      setTimeout(() => {
        if (id !== state.request || state.game !== g) return;
        const m = r.uci ? g.pos.parseMove(r.uci, g.legal) : null;
        if (m !== null && m !== undefined) playMove(m);
        else renderAll();
      }, delay);
    });
  }

  function endGame() {
    const g = state.game;
    state.selected = -1; state.hint = null; state.thinking = false;
    refreshHighlights();
    renderAll();
    save();
    if (state.resultShown) return;
    state.resultShown = true;
    const o = g.outcome;
    const winner = o.result === '1-0' ? WHITE : o.result === '0-1' ? BLACK : 0;
    if (winner) view.celebrate('win', kingSquare(-winner));
    else view.celebrate('draw', -1, [kingSquare(WHITE), kingSquare(BLACK)]);
    const ai = state.setup.mode === 'ai';
    const youWon = ai && winner === state.human, youLost = ai && winner === -state.human;
    tone(winner ? (ai && youLost ? 'loss' : 'win') : 'draw');
    const badge = $('result-badge');
    badge.className = 'result-badge' + (youWon ? ' win' : youLost ? ' loss' : '');
    badge.textContent = REASON_TEXT[o.reason] || 'Game over';
    let title;
    if (!winner) title = 'Draw';
    else if (ai) title = youWon ? 'You win' : LEVELS[state.setup.level].name + ' wins';
    else title = (winner === WHITE ? 'White' : 'Black') + ' wins';
    $('result-title').textContent = title;
    const loser = winner ? sideName(-winner) : '';
    const sub = {
      checkmate: (winner ? sideName(winner) + ' delivered checkmate' : '') + ' in ' + Math.ceil(g.moves.length / 2) + ' moves.',
      resignation: loser + (loser === 'You' ? ' resigned.' : ' resigned.'),
      timeout: (loser === 'You' ? 'Your' : loser + "'s") + ' clock ran out.',
      'timeout-insufficient': 'A clock ran out, but the other side had no way to checkmate, so it is a draw.',
      stalemate: 'The side to move has no legal moves and is not in check.',
      insufficient: 'Neither side has enough pieces left to checkmate.',
      threefold: 'The same position appeared three times.',
      fivefold: 'The same position appeared five times.',
      fifty: 'Fifty moves passed with no capture or pawn move.',
      seventyfive: 'Seventy-five moves passed with no capture or pawn move.',
      agreement: 'Both sides agreed to a draw.',
    }[o.reason] || '';
    $('result-sub').textContent = sub.trim();
    setTimeout(() => openModal('m-result'), state.settings.animations ? 1100 : 150);
  }

  function undo() {
    const g = state.game;
    if (!g.moves.length || g.ended || state.busy) return;
    state.request++; state.thinking = false;
    if (state.setup.mode === 'ai') {
      // Take back the computer's reply too, so it is your turn again.
      g.undo();
      if (g.moves.length && g.pos.side !== state.human) g.undo();
    } else g.undo();
    state.selected = -1; state.hint = null; state.resultShown = false;
    view.setBoard(boardPieces());
    if (state.setup.mode === 'local' && state.settings.turnBoard) { state.viewSide = g.pos.side === WHITE ? 'white' : 'black'; applyView(false); }
    refreshHighlights();
    renderAll();
    save();
    maybeComputer();
  }

  function hint() {
    if (!humanTurn()) return;
    const g = state.game;
    $('status').innerHTML = '<span class="hint">Looking for a good move…</span>';
    $('btn-hint').disabled = true;
    const id = think(Object.assign({}, LEVELS[5], { timeMs: 1200 }), (r) => {
      if (id !== state.request || state.game !== g) return;
      const m = r.uci ? g.pos.parseMove(r.uci, g.legal) : null;
      if (m === null || m === undefined) { renderAll(); return; }
      state.hint = { from: E.mFrom(m), to: E.mTo(m), san: g.pos.san(m, g.legal) };
      refreshHighlights();
      renderAll();
    });
  }

  function resign() {
    const g = state.game;
    if (g.outcome) return;
    const btn = $('btn-resign');
    if (Date.now() - state.resignArmed > 3000) {
      state.resignArmed = Date.now();
      btn.textContent = 'Confirm'; btn.classList.add('warn');
      setTimeout(() => { if (Date.now() - state.resignArmed >= 3000) { btn.textContent = 'Resign'; btn.classList.remove('warn'); } }, 3100);
      return;
    }
    state.resignArmed = 0; btn.textContent = 'Resign'; btn.classList.remove('warn');
    state.request++; state.thinking = false;
    g.resign(state.setup.mode === 'ai' ? state.human : g.pos.side);
    endGame();
  }

  // ----------------------------------------------------------------- render
  function capturedLists() {
    // Pieces each side has taken, plus the material difference.
    const g = state.game;
    const taken = { [WHITE]: [], [BLACK]: [] };
    g.captured.forEach((p) => { if (p) taken[-Math.sign(p)].push(Math.abs(p)); });
    const score = (side) => taken[side].reduce((a, k) => a + VALUE[k], 0);
    // Promotions change material too; derive the difference from the board.
    let diff = 0;
    for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(g.pos, sq); if (p) diff += Math.sign(p) * VALUE[Math.abs(p)]; }
    return { taken, diff, score };
  }

  function renderPlayers() {
    const g = state.game;
    const bottomSide = state.viewSide === 'black' ? BLACK : WHITE;
    const { taken, diff } = capturedLists();
    for (const [id, side] of [['p-bottom', bottomSide], ['p-top', -bottomSide]]) {
      const el = $(id);
      el.querySelector('.swatch').className = 'swatch ' + (side === WHITE ? 'white' : 'black');
      el.querySelector('.name').textContent = sideName(side) + (state.setup.mode === 'ai' && side !== state.human ? ' (computer)' : '');
      const list = taken[side].slice().sort((a, b) => VALUE[b] - VALUE[a] || b - a);
      const adv = diff * side;
      el.querySelector('.caps').innerHTML = list.map((k) => GLYPH[k]).join('') + (adv > 0 ? '<span class="adv">+' + adv + '</span>' : '');
      el.classList.toggle('to-move', !g.outcome && g.pos.side === side);
    }
    renderClocks();
  }

  function renderClocks() {
    const g = state.game;
    const bottomSide = state.viewSide === 'black' ? BLACK : WHITE;
    for (const [id, side] of [['p-bottom', bottomSide], ['p-top', -bottomSide]]) {
      const el = $(id).querySelector('.clock');
      if (!state.clock) { el.hidden = true; continue; }
      el.hidden = false;
      const ms = state.clock[side === WHITE ? 'w' : 'b'];
      el.textContent = fmt(ms);
      el.classList.toggle('running', !!clockRunning() && g.pos.side === side);
      el.classList.toggle('low', ms < 20000);
    }
  }

  function renderMoves() {
    const g = state.game;
    const ol = $('moves');
    if (!g.sans.length) { ol.innerHTML = '<li><span class="empty">No moves yet. Click a piece, then a square.</span></li>'; return; }
    const start = new E.Pos(); start.load(g.startFen);
    let num = start.full, white = start.side === WHITE;
    const rows = [];
    let row = null;
    g.sans.forEach((san, i) => {
      const last = i === g.sans.length - 1 ? ' last' : '';
      if (white || !row) { row = { n: num, w: white ? san : '…', b: '', wl: white ? last : '', bl: '' }; rows.push(row); if (!white) { row.b = san; row.bl = last; num++; } }
      else { row.b = san; row.bl = last; num++; }
      white = !white;
    });
    ol.innerHTML = rows.map((r) => '<li><span class="n">' + r.n + '.</span><span class="m' + r.wl + '">' + r.w + '</span><span class="m' + r.bl + '">' + r.b + '</span></li>').join('');
    const wrap = $('moves-wrap'); wrap.scrollTop = wrap.scrollHeight;
  }

  function renderStatus() {
    const g = state.game;
    const chip = $('chip');
    chip.className = 'chip';
    let text;
    if (g.outcome) {
      const o = g.outcome;
      text = (o.result === '1/2-1/2' ? 'Draw' : (o.result === '1-0' ? 'White' : 'Black') + ' wins') + ' · ' + (REASON_TEXT[o.reason] || '');
    } else if (state.thinking) { text = LEVELS[state.setup.level].name + ' is thinking'; chip.classList.add('thinking'); }
    else {
      const who = state.setup.mode === 'ai' ? (g.pos.side === state.human ? 'Your move' : LEVELS[state.setup.level].name + ' to move')
        : (g.pos.side === WHITE ? 'White' : 'Black') + ' to move';
      text = who;
      if (g.pos.inCheck()) { text = 'Check! ' + who; chip.classList.add('check'); }
    }
    chip.textContent = text;
    const status = $('status');
    if (state.hint && !g.outcome) status.innerHTML = '<span class="hint">Hint: ' + state.hint.san + ' is worth a look.</span>';
    else status.textContent = g.outcome ? 'Game over. Start a new game or review the moves.' : (g.claimable() ? 'You can claim a draw.' : '');
    const lv = LEVELS[state.setup.level];
    $('mode-line').textContent = (state.setup.mode === 'ai' ? 'vs ' + lv.name : 'Two players') + ' · ' + (state.setup.tc === 'none' ? 'No clock' : state.setup.tc);
  }

  function renderButtons() {
    const g = state.game;
    $('btn-undo').disabled = !g.moves.length || !!g.ended || state.busy;
    $('btn-hint').disabled = !humanTurn();
    $('btn-resign').disabled = !!g.outcome;
    const claim = g.claimable();
    $('btn-claim').hidden = !claim || !humanTurn();
    $('btn-claim').textContent = claim === 'threefold' ? 'Claim draw by threefold repetition' : 'Claim draw by the fifty-move rule';
    $('move-input').disabled = !humanTurn();
  }

  function renderAll() {
    renderPlayers(); renderMoves(); renderStatus(); renderButtons();
  }

  // ---------------------------------------------------------------- modals
  let promoCallback = null;
  function openModal(id) {
    const m = $(id);
    m.hidden = false;
    const focusable = m.querySelector('input:checked, button.primary, button, input');
    if (focusable) setTimeout(() => focusable.focus(), 0);
  }
  function closeModal(id) { $(id).hidden = true; if (id === 'm-promo') promoCallback = null; }
  document.querySelectorAll('.modal').forEach((m) => {
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) closeModal(m.id); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll('.modal')].find((m) => !m.hidden);
    if (open) closeModal(open.id);
    else if (state.selected >= 0) { state.selected = -1; refreshHighlights(); }
  });

  function choosePromotion(side, cb) {
    promoCallback = cb;
    const names = { 5: 'Queen', 4: 'Rook', 3: 'Bishop', 2: 'Knight' };
    const box = $('promo-choices');
    box.innerHTML = '';
    for (const k of [5, 4, 3, 2]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = (side === WHITE ? '♕♖♗♘'['5432'.indexOf(String(k))] : GLYPH[k]) + '<span>' + names[k] + '</span>';
      b.addEventListener('click', () => { const f = promoCallback; closeModal('m-promo'); if (f) f(k); });
      box.appendChild(b);
    }
    openModal('m-promo');
  }

  function buildLevels() {
    $('levels').innerHTML = LEVELS.map((lv, i) =>
      '<label><input type="radio" name="level" value="' + i + '" id="level-' + i + '"><span class="lv"><i>Level ' + (i + 1) + '</i><b>' + lv.name + '</b><small>' + lv.blurb + '</small></span></label>').join('');
  }

  function openNewGame() {
    const s = state.setup;
    $('mode-' + s.mode).checked = true;
    $('color-' + s.color).checked = true;
    $('level-' + s.level).checked = true;
    $('tc-' + s.tc.replace('+', '-')).checked = true;
    $('fen-in').value = s.fen || '';
    $('fen-err').textContent = '';
    syncNewGameForm();
    openModal('m-new');
  }
  function syncNewGameForm() {
    const ai = $('mode-ai').checked;
    $('f-color').hidden = !ai; $('f-level').hidden = !ai;
  }
  $('new-form').addEventListener('change', syncNewGameForm);
  $('new-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const fen = $('fen-in').value.trim();
    if (fen) {
      const err = new E.Pos().load(fen);
      if (err) { $('fen-err').textContent = err; return; }
    }
    closeModal('m-new');
    startGame({ mode: f.get('mode'), color: f.get('color') || 'white', level: +(f.get('level') || 1), tc: f.get('tc'), fen });
  });

  function buildSettings() {
    const swatch = (group, key, theme, colors) =>
      '<label><input type="radio" name="' + group + '" value="' + key + '" id="' + group + '-' + key + '"><span class="sw"><em style="background:linear-gradient(135deg,' +
      colors[0] + ' 50%,' + colors[1] + ' 50%)"></em>' + theme.name + '</span></label>';
    $('sw-board').innerHTML = Object.entries(view.BOARD_THEMES).map(([k, t]) => swatch('board', k, t, [t.light, t.dark])).join('');
    $('sw-pieces').innerHTML = Object.entries(view.PIECE_THEMES).map(([k, t]) => swatch('pieces', k, t, [t.white, t.black])).join('');
  }
  function openSettings() {
    const s = state.settings;
    const b = $('board-' + s.board); if (b) b.checked = true;
    const p = $('pieces-' + s.pieces); if (p) p.checked = true;
    $('q-' + s.quality).checked = true;
    $('s-anim').checked = s.animations; $('s-sound').checked = s.sound; $('s-legal').checked = s.legal; $('s-turn').checked = s.turnBoard;
    openModal('m-settings');
  }
  $('m-settings').addEventListener('change', (e) => {
    const s = state.settings, t = e.target;
    if (t.name === 'board') s.board = t.value;
    if (t.name === 'pieces') s.pieces = t.value;
    if (t.name === 'quality') s.quality = t.value;
    if (t.id === 's-anim') s.animations = t.checked;
    if (t.id === 's-sound') s.sound = t.checked;
    if (t.id === 's-legal') s.legal = t.checked;
    if (t.id === 's-turn') s.turnBoard = t.checked;
    applySettings();
    save();
  });
  function applySettings() {
    const s = state.settings;
    view.setTheme(s.board, s.pieces);
    view.setQuality(s.quality);
    view.setAnimations(s.animations);
    refreshHighlights();
  }

  // ----------------------------------------------------------------- copy
  function copy(text, label) {
    const fallback = () => { $('share-title').textContent = 'Copy ' + label; $('share-text').value = text; openModal('m-share'); setTimeout(() => $('share-text').select(), 30); };
    try {
      navigator.clipboard.writeText(text).then(() => toast(label + ' copied.'), fallback);
    } catch (e) { fallback(); }
  }
  let toastTimer = 0;
  function toast(msg) {
    const t = $('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
  }
  function pgn() {
    const d = new Date();
    const date = d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
    const name = (side) => (state.setup.mode === 'ai' ? (side === state.human ? 'Player' : 'Chacklate ' + LEVELS[state.setup.level].name) : side === WHITE ? 'White' : 'Black');
    return state.game.pgn({ Date: date, White: name(WHITE), Black: name(BLACK), TimeControl: state.setup.tc === 'none' ? '-' : state.setup.tc.replace('+', '+').split('+').map((x, i) => (i ? x : x * 60)).join('+') });
  }

  // ---------------------------------------------------------------- wiring
  $('btn-new').addEventListener('click', openNewGame);
  $('btn-undo').addEventListener('click', undo);
  $('btn-hint').addEventListener('click', hint);
  $('btn-resign').addEventListener('click', resign);
  $('btn-claim').addEventListener('click', () => { if (state.game.claimDraw()) { state.request++; endGame(); } });
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-pgn').addEventListener('click', () => copy(pgn(), 'PGN'));
  $('btn-result-pgn').addEventListener('click', () => copy(pgn(), 'PGN'));
  $('btn-fen').addEventListener('click', () => copy(state.game.pos.fen(), 'FEN'));
  $('btn-rematch').addEventListener('click', () => {
    closeModal('m-result');
    const s = Object.assign({}, state.setup);
    if (s.mode === 'ai' && s.color !== 'random') s.color = s.color === 'white' ? 'black' : 'white';
    startGame(s);
  });
  $('view-flip').addEventListener('click', () => { state.viewSide = state.viewSide === 'white' ? 'black' : 'white'; applyView(false); renderPlayers(); });
  $('view-toggle').addEventListener('click', () => { state.viewPreset = state.viewPreset === 'top' ? 'player' : 'top'; applyView(false); });
  $('move-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('move-input');
    const text = input.value.trim();
    if (!text || !humanTurn()) return;
    const g = state.game;
    const m = g.pos.parseMove(text, g.legal);
    if (m === null || m === undefined) { $('move-err').textContent = '"' + text + '" is not a legal move here.'; return; }
    $('move-err').textContent = '';
    input.value = '';
    playMove(m);
  });

  // ------------------------------------------------------------------ boot
  buildLevels();
  buildSettings();
  const saved = load();
  if (saved && saved.settings) Object.assign(state.settings, saved.settings);
  applySettings();
  if (saved && saved.setup && saved.game) {
    startGame(Object.assign({}, state.setup, saved.setup, { fen: saved.game.start === E.START_FEN ? '' : saved.game.start }),
      { moves: saved.game.moves, ended: saved.game.ended, human: saved.human, clock: saved.clock });
  } else {
    startGame(state.setup);
  }
  window.addEventListener('pagehide', save);
})();
