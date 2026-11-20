// The three phases of chess: a Learn lesson in seven parts (packages/content/phases.json). Each part
// is a run of beats on the real 3D board: Rooky explains a position (moves can play out), a famous
// game replays with its evaluation graph and points bar, or a question is asked. In a replay the
// player can pause, try any move of their own (the analysis engine answers), and guess what the
// player actually played: any move our engine rates as good as the real one counts as right
// (the list is worked out ahead by packages/chess-core/tools/generate-phases.js).
//
// app.js passes in the helpers it shares with the other screens; this file only builds the screen.
const ChackmateCourse = function (D) {
  const { E, view, $, esc, t, icon, AU } = D;
  const DATA = D.data;
  const VALUE = { 1: 1, 2: 3, 3: 3, 4: 5, 5: 9, 6: 0 };
  const PHASE = ['opening', 'middlegame', 'endgame'];

  // The position after `ply` moves of a game, and the game's moves as a list a Game can replay.
  function gameAt(g, ply) {
    const game = new E.Game(g.fen);
    let last = null;
    for (const s of g.moves.slice(0, ply)) last = game.playText(s);
    return { pos: game.pos, last };
  }
  const phaseAt = (g, ply) => (g.phases.endgame !== undefined && ply >= g.phases.endgame ? 'endgame' : g.phases.middlegame !== undefined && ply >= g.phases.middlegame ? 'middlegame' : g.phases.endgame === 0 ? 'endgame' : 'opening');
  // Points on the board for each side.
  function points(pos) {
    const out = { w: 0, b: 0 };
    for (let sq = 0; sq < 64; sq++) { const p = E.pieceAt(pos, sq); if (p) out[p > 0 ? 'w' : 'b'] += VALUE[Math.abs(p)] || 0; }
    return out;
  }
  // Words for an evaluation (centipawns from White's side).
  function evalWords(cp) {
    const a = Math.abs(cp), side = t(cp > 0 ? 'play.color.white' : 'play.color.black');
    if (a < 40) return t('learn.ph.level');
    if (a >= 900) return t('learn.ph.winning', { side });
    if (a >= 300) return t('learn.ph.clearly', { side });
    if (a >= 120) return t('learn.ph.better', { side });
    return t('learn.ph.slightly', { side });
  }
  const pointsBar = (pos) => {
    const p = points(pos), d = p.w - p.b;
    return '<div class="ph-points" role="img" aria-label="' + esc(t('learn.ph.pointsAria', { w: p.w, b: p.b })) + '"><span class="ph-lbl">' + esc(t('learn.ph.points')) + '</span>' +
      '<span class="ph-side w"><i></i>' + p.w + '</span><span class="ph-track"><i style="width:' + Math.round(50 + Math.max(-45, Math.min(45, d * 2.5))) + '%"></i></span><span class="ph-side b"><i></i>' + p.b + '</span>' +
      '<b class="ph-diff">' + (d ? esc(t('learn.ph.ahead', { side: t(d > 0 ? 'play.color.white' : 'play.color.black'), n: Math.abs(d) })) : esc(t('learn.ph.even'))) + '</b></div>';
  };
  const phaseChip = (ph) => '<span class="ph-chip ' + ph + '">' + esc(t('learn.ph.' + ph)) + '</span>';

  // The evaluation graph of a whole game: white above the line, black below, the phases as a
  // coloured strip underneath, and a marker on the move shown. Tapping it jumps to that move.
  function graph(g, ply, extra) {
    const n = g.evals.length - 1, W = 300, H = 64, mid = H / 2;
    const x = (i) => (n ? (i / n) * W : 0), y = (cp) => mid - (Math.max(-1000, Math.min(1000, cp)) / 1000) * (mid - 3);
    const pts = g.evals.map((cp, i) => x(i).toFixed(1) + ',' + y(cp).toFixed(1));
    const area = 'M0,' + mid + ' L' + pts.join(' L') + ' L' + W + ',' + mid + ' Z';
    let bands = '';
    for (const ph of PHASE) {
      const from = ph === 'opening' ? 0 : g.phases[ph];
      if (from === undefined) continue;
      const nextPh = PHASE.slice(PHASE.indexOf(ph) + 1).map((p) => g.phases[p]).find((v) => v !== undefined && v > from);
      const to = nextPh === undefined ? n : nextPh;
      if (to <= from && n) continue;
      bands += '<rect class="band ' + ph + '" x="' + x(from).toFixed(1) + '" y="' + (H + 3) + '" width="' + Math.max(2, x(to) - x(from)).toFixed(1) + '" height="5" rx="2"/>';
    }
    const dot = extra !== undefined && extra !== null ? '<circle class="try" cx="' + x(ply).toFixed(1) + '" cy="' + y(extra).toFixed(1) + '" r="4"/>' : '';
    return '<svg class="ph-graph" viewBox="0 0 ' + W + ' ' + (H + 9) + '" preserveAspectRatio="none" role="img" aria-label="' + esc(t('learn.ph.graphAria')) + '">' +
      '<defs><clipPath id="phTop"><rect x="0" y="0" width="' + W + '" height="' + mid + '"/></clipPath><clipPath id="phBot"><rect x="0" y="' + mid + '" width="' + W + '" height="' + mid + '"/></clipPath></defs>' +
      '<rect class="bg" x="0" y="0" width="' + W + '" height="' + H + '" rx="6"/>' +
      '<path class="wa" d="' + area + '" clip-path="url(#phTop)"/><path class="ba" d="' + area + '" clip-path="url(#phBot)"/>' +
      '<line class="mid" x1="0" y1="' + mid + '" x2="' + W + '" y2="' + mid + '"/><polyline class="ln" points="' + pts.join(' ') + '"/>' +
      '<line class="now" x1="' + x(ply).toFixed(1) + '" y1="0" x2="' + x(ply).toFixed(1) + '" y2="' + H + '"/>' + dot + bands + '</svg>';
  }

  return function screen(L, arg) {
    const P = D.state.progress;
    const rec = P.courses[L.id] || (P.courses[L.id] = { parts: {} });
    const parts = DATA.parts;
    const partId = arg && arg.part && parts.some((p) => p.id === arg.part) ? arg.part : null;
    const part = partId ? parts.find((p) => p.id === partId) : null;
    const pIndex = part ? parts.indexOf(part) : -1;
    const practice = part && pIndex === parts.length - 1;
    const S = { i: 0, results: [], answered: false, tries: 0, talk: 0, timers: [], v: null };
    view.setAttract(false);
    D.mount('<div class="hud-top"><button class="backbtn" id="ph-back">' + icon('back') + '<span>' + esc(part ? t('learn.ph.contents') : t('common.nav.learn')) + '</span></button>' +
      '<div class="title"><img class="portrait" src="' + D.face(D.COACH) + '" alt=""><span>' + esc(t('learn.ls.chapter', { n: L.chapter })) + ' · ' + esc(D.text(L.title)) + '</span></div><span class="spacer"></span>' +
      '<button class="round" id="ph-again" aria-label="' + t('common.guide.again') + '" title="' + t('common.guide.again') + '">' + icon('replay') + '</button><button class="round" id="ph-voice" data-voice="' + esc(D.COACH.name) + '"></button>' +
      '<button class="round" id="ph-set" aria-label="' + t('settings.title') + '" title="' + t('settings.title') + '">' + icon('gear') + '</button></div>' +
      '<aside class="lesson glass ph"><header>' + D.faceImg(D.COACH) + '<div><div class="eyebrow" id="ph-eyebrow"></div><h3 id="ph-title"></h3></div></header><div class="content" id="ph-content"></div>' +
      '<footer><div class="dots" id="ph-dots"></div><div class="grow"></div><button class="btn" id="ph-prev" aria-label="' + t('common.back') + '">' + icon('prev') + '</button><button class="btn primary" id="ph-next">' + t('common.next') + '</button></footer></aside>');
    const later = (fn, ms) => { const id = setTimeout(() => { if (D.state.screen === 'lesson') fn(); }, ms); S.timers.push(id); return id; };
    const stopTimers = () => { S.timers.forEach(clearTimeout); S.timers = []; };
    $('ph-back').onclick = () => { AU.play('tap'); D.go(part ? 'lesson' : 'learn', part ? { id: L.id } : undefined); };
    $('ph-set').onclick = () => D.settingsModal();
    D.voiceIcon($('ph-voice'), D.COACH.name);
    $('ph-voice').onclick = () => { AU.unlock(); D.setVoice(!D.state.settings.narration, true); if (D.state.settings.narration) speak(S.said); };
    $('ph-again').onclick = () => { AU.unlock(); if (!D.state.settings.narration) D.setVoice(true, true); speak(S.said); };
    // Rooky reads a line; a newer line cuts the older one short.
    function speak(text) {
      S.said = text;
      if (!text || !D.state.settings.narration) return;
      S.talk++;
      AU.say(text);
    }
    function setBoard(pos, hl) {
      view.setBoard(D.piecesOf(pos), null);
      view.setHighlights(hl || {});
    }
    const camFor = (pos, flip) => view.setView(flip || pos.side === E.BLACK && S.askSide ? 'black' : 'white', D.state.settings.view === 'top' ? 'top' : 'player');
    const arrowsOf = (list, color) => (list || []).map((a) => ({ from: D.sqIndex(a[0]), to: D.sqIndex(a[1]), color: color || '#2fd8ff' }));
    const spotsOf = (list, color) => (list || []).map((m) => ({ sq: D.sqIndex(m), color }));
    const lastHl = (info) => (info ? { lastFrom: info.from, lastTo: info.to } : {});

    // ------------------------------------------------------------ the contents page
    function contents() {
      $('ph-eyebrow').textContent = t('learn.ph.course', { n: parts.length });
      $('ph-title').textContent = D.text(L.title);
      const done = parts.filter((p) => rec.parts[p.id]).length;
      const first = parts.find((p) => !rec.parts[p.id]) || parts[0];
      $('ph-content').innerHTML = '<p class="say">' + esc(t('learn.ph.intro')) + '</p><ol class="ph-parts">' + parts.map((p, k) =>
        '<li><button class="ph-part' + (rec.parts[p.id] ? ' done' : '') + '" data-part="' + p.id + '"><span class="n">' + (rec.parts[p.id] ? icon('check') : k + 1) + '</span><span><b>' + esc(D.text(p.title)) + '</b><small>' + esc(D.text(p.sub)) + '</small></span>' + icon('arrow') + '</button></li>').join('') + '</ol>';
      document.querySelectorAll('[data-part]').forEach((b) => { b.onclick = () => { AU.unlock(); AU.play('tap'); D.go('lesson', { id: L.id, part: b.dataset.part }); }; });
      $('ph-dots').innerHTML = parts.map((p) => '<i class="' + (rec.parts[p.id] ? 'ok' : '') + '"></i>').join('');
      $('ph-prev').hidden = true;
      $('ph-next').textContent = done ? t('learn.ph.continue') : t('learn.ph.start');
      $('ph-next').onclick = () => { AU.unlock(); AU.play('tap'); D.go('lesson', { id: L.id, part: first.id }); };
      setBoard(new E.Game().pos);
      view.setArrows([]);
      camFor(new E.Game().pos);
      D.setHooks({});
      const op = 'lesson.open.' + L.id.split('.').pop();
      if (D.guideLines[op]) D.guideSay(op, { force: true });
    }

    // ------------------------------------------------------------ a part
    const beats = part ? part.beats : [];
    function dots() {
      $('ph-dots').innerHTML = beats.map((b, k) => { const r = S.results[k]; return '<i class="' + (r === true ? 'ok' : r === false ? 'bad' : k <= S.i ? 'on' : '') + '"></i>'; }).join('');
    }
    function render() {
      stopTimers();
      S.answered = false; S.tries = 0; S.v = null; S.askSide = false; S.selected = -1;
      const b = beats[S.i];
      $('ph-eyebrow').textContent = t('learn.ph.partOf', { n: pIndex + 1, of: parts.length });
      $('ph-title').textContent = D.text(part.title);
      $('ph-prev').hidden = false;
      $('ph-prev').disabled = S.i === 0;
      $('ph-prev').onclick = () => { if (S.i > 0) { AU.play('tap'); S.i--; render(); } };
      $('ph-next').onclick = () => next();
      $('ph-next').textContent = b.ask && !practice ? t('learn.ls.skip') : b.ask ? t('learn.ls.skip') : S.i === beats.length - 1 ? (practice ? t('learn.ls.finish') : t('learn.ph.nextPart')) : t('common.next');
      view.setArrows([]);
      D.setHooks({});
      if (b.game) replay(b);
      else if (b.ask) ask(b);
      else show(b);
      dots();
    }
    function next() {
      AU.play('tap');
      const b = beats[S.i];
      if (b.ask && S.results[S.i] === undefined) S.results[S.i] = false;
      if (S.i < beats.length - 1) { S.i++; render(); return; }
      finishPart();
    }

    // A position with Rooky's words; moves may play out on the board first.
    function show(b) {
      let pos, info = null;
      if (b.at) { const r = gameAt(DATA.games[b.at.game], b.at.ply); pos = r.pos; info = r.last; } else { const g = new E.Game(b.fen); pos = g.pos; }
      const tag = b.tag || (b.at ? phaseAt(DATA.games[b.at.game], b.at.ply) : null);
      const from = b.at ? DATA.games[b.at.game] : null;
      const paint = (p, last) => {
        $('ph-board').innerHTML = pointsBar(p) + (b.evalCp !== undefined ? '<div class="ph-eval">' + icon('chart') + '<span><small>' + esc(t('learn.ph.engine')) + '</small><b>' + esc(evalWords(b.evalCp)) + '</b></span></div>' : '') +
          (from ? graph(from, b.at.ply) : '');
        setBoard(p, Object.assign(lastHl(last), { spots: spotsOf(b.marks) }));
      };
      $('ph-content').innerHTML = (tag ? phaseChip(tag) : '') + (from ? '<p class="ph-game">' + esc(D.text(from.title)) + ' · ' + esc(D.text(from.where)) + '</p>' : '') + '<p class="say">' + esc(D.text(b.say)) + '</p><div id="ph-board"></div>';
      camFor(pos);
      paint(pos, info);
      view.setArrows(arrowsOf(b.arrows));
      speak(D.text(b.say));
      if (b.play && b.play.length) {
        const g = new E.Game(pos.fen());
        let k = 0;
        const stepPlay = () => {
          if (k >= b.play.length || beats[S.i] !== b) return;
          const inf = g.playText(b.play[k++]);
          if (!inf) return;
          D.quickMove(inf, () => { if (beats[S.i] !== b) return; AU.play(inf.captured ? 'capture' : 'move', inf); paint(g.pos, inf); later(stepPlay, D.reduced() ? 250 : 700); });
        };
        later(stepPlay, D.reduced() ? 300 : 900);
      }
    }

    // A question: pick an answer, name the phase, or find the move on the board.
    function ask(b) {
      const g = new E.Game(b.fen);
      const pos = g.pos;
      S.askSide = b.ask === 'move';
      camFor(pos);
      setBoard(pos);
      const opts = b.ask === 'phase' ? PHASE.map((ph, k) => ({ k, label: t('learn.ph.' + ph), ok: ph === b.answer })) : b.ask === 'choice' ? D.shuffled(b.options.map((o, k) => ({ k, label: D.text(o), ok: k === b.answer }))) : [];
      $('ph-content').innerHTML = phaseChip(practice ? 'practice' : 'check') + '<p class="prompt">' + esc(D.text(b.say)) + '</p>' +
        (b.ask === 'move' ? '<p class="ph-hint">' + esc(t(pos.side === E.WHITE ? 'learn.ls.whiteToMove' : 'learn.ls.blackToMove')) + '</p>' : '') +
        (opts.length ? '<div class="choices' + (b.ask === 'phase' ? ' ph-three' : '') + '">' + opts.map((o) => '<button class="btn" data-k="' + o.k + '">' + esc(o.label) + '</button>').join('') + '</div>' : '') +
        '<div id="ph-board">' + pointsBar(pos) + '</div><div id="ph-fb"></div>';
      speak(D.text(b.say));
      document.querySelectorAll('#ph-content [data-k]').forEach((btn) => {
        btn.onclick = () => {
          if (S.answered) return;
          const o = opts.find((x) => String(x.k) === btn.dataset.k);
          btn.classList.add(o.ok ? 'right' : 'wrong');
          if (o.ok) right(D.text(b.explain));
          else { S.tries++; AU.play('wrong'); fb('bad', t('learn.ph.notQuite') + ' ' + D.text(b.explain)); if (S.results[S.i] === undefined) S.results[S.i] = false; S.answered = true; document.querySelector('#ph-content [data-k="' + opts.find((x) => x.ok).k + '"]').classList.add('right'); doneAsk(); }
        };
      });
      if (b.ask !== 'move') return;
      const tryMove = (from, to) => {
        const gg = new E.Game(S.pos.fen());
        const go2 = (promo) => {
          const m = gg.find(from, to, promo || 0);
          if (m === null || m === undefined) return;
          const u = E.uci(m);
          if (b.accept.includes(u)) {
            const inf = gg.play(m);
            AU.play(inf.captured ? 'capture' : inf.check ? 'check' : 'move', inf);
            D.quickMove(inf, () => setBoard(gg.pos, lastHl(inf)));
            right((u === b.accept[0] ? '' : t('learn.ph.alsoGood', { san: g.pos.san(g.pos.parseMove(b.accept[0]), g.legal) }) + ' ') + D.text(b.explain));
          } else {
            S.tries++; AU.play('wrong'); setBoard(S.pos);
            fb('bad', t('learn.ph.tryAnother'));
            if (S.tries >= 3) { S.answered = true; if (S.results[S.i] === undefined) S.results[S.i] = false; view.setArrows(arrowsOf([[b.accept[0].slice(0, 2), b.accept[0].slice(2, 4)]], '#3ee07a')); fb('bad', t('learn.ph.itWas', { san: g.pos.san(g.pos.parseMove(b.accept[0]), g.legal) }) + ' ' + D.text(b.explain)); doneAsk(); }
          }
          S.selected = -1;
        };
        if (gg.needsPromotion(from, to)) D.choosePromotion(S.pos.side, (k) => { if (k) go2(k); else setBoard(S.pos); }); else go2(0);
      };
      S.pos = pos;
      boardInput(() => !S.answered, tryMove);
    }
    // Tap a piece then a square, or drag it: the side to move only.
    function boardInput(open, onMove) {
      D.setHooks({
        onSquare: (sq) => {
          if (!open()) return;
          const g = new E.Game(S.pos.fen());
          if (S.selected >= 0 && g.targets(S.selected).includes(sq)) { const f = S.selected; S.selected = -1; onMove(f, sq); return; }
          const p = E.pieceAt(S.pos, sq);
          if (p && Math.sign(p) === S.pos.side) { S.selected = sq; AU.play('select'); view.setHighlights(Object.assign({ selected: sq }, D.splitTargets(S.pos, g.targets(sq)))); }
        },
        canDrag: (sq) => open() && E.pieceAt(S.pos, sq) && Math.sign(E.pieceAt(S.pos, sq)) === S.pos.side,
        onDrop: (from, to) => { const g = new E.Game(S.pos.fen()); if (!g.targets(from).includes(to)) return false; onMove(from, to); return true; },
      });
    }
    function right(msg) {
      S.answered = true;
      if (S.results[S.i] === undefined) S.results[S.i] = S.tries === 0;
      AU.play('correct');
      fb('ok', (S.tries === 0 ? t('learn.ls.correct') : t('learn.ph.gotIt')) + ' ' + msg);
      doneAsk();
    }
    function doneAsk() { $('ph-next').textContent = S.i === beats.length - 1 ? (practice ? t('learn.ls.finish') : t('learn.ph.nextPart')) : t('common.next'); dots(); }
    function fb(kind, text) { const el = $('ph-fb'); if (el) { el.innerHTML = '<div class="feedback ' + kind + '">' + esc(text) + '</div>'; if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); } }

    // ------------------------------------------------------------ a famous game
    function replay(b) {
      const g = DATA.games[b.game];
      const from = b.from || 0, to = b.to === undefined ? g.moves.length : b.to;
      const V = S.v = { g, ply: from, from, to, playing: false, guessed: {}, branch: null, branchEval: null, b };
      const players = g.black ? esc(g.white) + ' – ' + esc(g.black) : esc(g.white);
      $('ph-content').innerHTML = '<p class="ph-game"><b>' + esc(D.text(g.title)) + '</b> · ' + esc(D.text(g.where)) + '</p><p class="ph-players">' + players + '</p>' +
        '<p class="say" id="ph-say">' + esc(D.text(b.say)) + '</p>' +
        '<div class="ph-note" id="ph-note" aria-live="polite"></div><div id="ph-fb"></div>' +
        '<div class="ph-ctl" role="group" aria-label="' + esc(t('learn.ph.controls')) + '">' +
        '<button class="round" id="ph-first" aria-label="' + esc(t('learn.ph.toStart')) + '">' + icon('replay') + '</button>' +
        '<button class="round" id="ph-back1" aria-label="' + esc(t('learn.ph.back1')) + '">' + icon('prev') + '</button>' +
        '<button class="round big" id="ph-play" aria-label="' + esc(t('learn.ph.play')) + '"></button>' +
        '<button class="round" id="ph-fwd1" aria-label="' + esc(t('learn.ph.fwd1')) + '">' + icon('next') + '</button>' +
        '<span class="ph-move" id="ph-move"></span>' +
        '<button class="btn small" id="ph-try">' + icon('hint') + ' ' + esc(t('learn.ph.tryOwn')) + '</button></div>' +
        '<div id="ph-board"></div>';
      $('ph-first').onclick = () => { AU.play('tap'); stop(); goPly(from); };
      $('ph-back1').onclick = () => { AU.play('tap'); stop(); if (V.branch) { leaveBranch(); return; } goPly(Math.max(from, V.ply - 1)); };
      $('ph-fwd1').onclick = () => { AU.play('tap'); stop(); forward(); };
      $('ph-play').onclick = () => { AU.unlock(); AU.play('tap'); if (V.playing) stop(); else { V.playing = true; ctl(); forward(); } };
      $('ph-try').onclick = () => { AU.play('tap'); stop(); if (V.branch) leaveBranch(); else startBranch(); };
      goPly(from, true);
      speak(D.text(b.say));
    }
    function stop() { const V = S.v; if (!V) return; V.playing = false; stopTimers(); ctl(); }
    function ctl() {
      const V = S.v; if (!V) return;
      const pb = $('ph-play'); if (!pb) return;
      pb.innerHTML = icon(V.playing ? 'pause' : 'play');
      pb.setAttribute('aria-label', t(V.playing ? 'learn.ph.pause' : 'learn.ph.play'));
      $('ph-fwd1').disabled = V.ply >= V.to || !!V.waiting;
      $('ph-play').disabled = V.ply >= V.to && !V.branch;
      $('ph-try').innerHTML = V.branch ? icon('back') + ' ' + esc(t('learn.ph.backToGame')) : icon('hint') + ' ' + esc(t('learn.ph.tryOwn'));
      const mv = $('ph-move');
      if (mv) mv.textContent = V.branch ? t('learn.ph.yourLine') : V.ply ? t('learn.ph.moveN', { n: Math.ceil(V.ply / 2), of: Math.ceil(V.g.moves.length / 2) }) : t('learn.ph.startPos');
    }
    // Show the game after `ply` moves: the board, Rooky's note on the move just played, the points and the graph.
    function goPly(ply, first) {
      const V = S.v;
      V.ply = ply; V.waiting = false;
      if (V.anim) { V.anim = false; V.tok = (V.tok || 0) + 1; V.queued = 0; }
      const r = gameAt(V.g, ply);
      S.pos = r.pos;
      setBoard(r.pos, Object.assign(lastHl(r.last), { check: r.pos.inCheck() ? D.kingSquare(r.pos, r.pos.side) : -1 }));
      if (first) camFor(r.pos);
      view.setArrows([]);
      panel();
      const note = V.g.notes[ply];
      $('ph-note').innerHTML = note ? '<span class="who">' + esc(D.COACH.name) + '</span>' + esc(D.text(note)) : '';
      if (note && !first) speak(D.text(note));
      D.setHooks({});
      if (V.g.predict.includes(ply) && ply < V.to && !V.guessed[ply]) predict(ply);
      else if (V.b.explore && ply === V.from && !V.branch) startBranch(true);
      ctl();
    }
    function panel() {
      const V = S.v;
      $('ph-board').innerHTML = phaseChip(phaseAt(V.g, V.ply)) + pointsBar(S.pos) + graph(V.g, V.ply, V.branch ? V.branchEval : null) +
        '<p class="ph-eval-line">' + esc(V.branch && V.branchEval !== null ? t('learn.ph.yourEval', { words: evalWords(V.branchEval) }) : evalWords(V.g.evals[V.ply])) + '</p>';
      const svg = $('ph-board').querySelector('.ph-graph');
      if (svg) svg.onclick = (e) => { if (V.branch || V.waiting) return; const r = svg.getBoundingClientRect(); const n = V.g.evals.length - 1; const k = Math.round(((e.clientX - r.left) / r.width) * n); stop(); goPly(Math.max(V.from, Math.min(V.to, k))); };
    }
    // One move forward, animated. Presses that come while a move is still moving are queued, so
    // quick taps step through the game instead of getting lost.
    function forward() {
      const V = S.v;
      if (!V || V.branch || V.waiting) return;
      if (V.anim) { V.queued = (V.queued || 0) + 1; return; }
      if (V.ply >= V.to) { stop(); return; }
      const r = gameAt(V.g, V.ply);
      const g = new E.Game(r.pos.fen());
      const inf = g.playText(V.g.moves[V.ply]);
      const tok = V.tok = (V.tok || 0) + 1;
      V.anim = true;
      D.quickMove(inf, () => {
        if (S.v !== V || V.tok !== tok) return;
        V.anim = false;
        AU.play(inf.captured ? 'capture' : inf.check ? 'check' : 'move', inf);
        goPly(V.ply + 1);
        if (V.queued && !V.waiting) { V.queued--; forward(); return; }
        V.queued = 0;
        if (V.playing && !V.waiting) later(forward, V.g.notes[V.ply] ? (D.reduced() ? 2600 : 4200) : (D.reduced() ? 700 : 1300));
        else if (V.playing && V.ply >= V.to) stop();
      });
    }
    // "What did they actually play?" Any move as good as the real one is right; then the real move plays.
    function predict(ply) {
      const V = S.v;
      V.waiting = true; V.playing = false; stopTimers();
      // a study has no players: the sides are named instead
      const who0 = S.pos.side === E.WHITE ? V.g.w : V.g.b;
      const who = who0 === 'White' ? t('play.color.white') : who0 === 'Black' ? t('play.color.black') : D.text(who0);
      const q = t('learn.ph.guess', { name: who });
      fb('hint', q);
      speak(q);
      const accept = V.g.accept[ply] || [];
      let tries = 0;
      const realSan = () => { const g = new E.Game(S.pos.fen()); return g.pos.san(g.pos.parseMove(accept[0]), g.legal); };
      const reveal = (msg, kind) => {
        V.guessed[ply] = true; V.waiting = false;
        fb(kind, msg);
        D.setHooks({});
        view.setArrows(arrowsOf([[accept[0].slice(0, 2), accept[0].slice(2, 4)]], '#3ee07a'));
        later(() => { if (S.v === V && V.ply === ply) { view.setArrows([]); forward(); } }, D.reduced() ? 900 : 1600);
        ctl();
      };
      const show = document.createElement('button');
      show.className = 'btn small'; show.id = 'ph-show'; show.textContent = t('learn.ph.showMe');
      $('ph-fb').appendChild(show);
      show.onclick = () => { AU.play('tap'); reveal(t('learn.ph.played', { name: who, san: realSan() }), 'hint'); };
      boardInput(() => V.waiting && S.v === V, (from, to) => {
        const g = new E.Game(S.pos.fen());
        const go2 = (promo) => {
          const m = g.find(from, to, promo || 0);
          if (m === null || m === undefined) return;
          const u = E.uci(m);
          if (u === accept[0]) { AU.play('correct'); reveal(t('learn.ph.exactly', { name: who }), 'ok'); return; }
          if (accept.includes(u)) { AU.play('correct'); reveal(t('learn.ph.asGood', { name: who, san: realSan() }), 'ok'); return; }
          tries++; AU.play('wrong'); setBoard(S.pos);
          if (tries < 2) { fb('bad', t('learn.ph.notThatOne')); $('ph-fb').appendChild(show); }
          else reveal(t('learn.ph.played', { name: who, san: realSan() }), 'bad');
        };
        if (g.needsPromotion(from, to)) D.choosePromotion(S.pos.side, (k) => { if (k) go2(k); else setBoard(S.pos); }); else go2(0);
      });
    }
    // Try your own moves from here, for whichever side is to move; the engine scores each one.
    function startBranch(quiet) {
      const V = S.v;
      if (V.waiting) return;
      V.branch = { fen: S.pos.fen(), moves: [] }; V.branchEval = null;
      fb('hint', t('learn.ph.tryHow'));
      if (!quiet) speak(t('learn.ph.tryHow'));
      boardInput(() => !!V.branch && S.v === V, (from, to) => {
        const g = new E.Game(S.pos.fen());
        const go2 = (promo) => {
          const m = g.find(from, to, promo || 0);
          if (m === null || m === undefined) return;
          const inf = g.play(m);
          V.branch.moves.push(E.uci(m));
          AU.play(inf.captured ? 'capture' : inf.check ? 'check' : 'move', inf);
          D.quickMove(inf, () => {
            S.pos = g.pos;
            setBoard(g.pos, Object.assign(lastHl(inf), { check: g.pos.inCheck() ? D.kingSquare(g.pos, g.pos.side) : -1 }));
            if (g.outcome) { V.branchEval = g.outcome.result === '1-0' ? 1000 : g.outcome.result === '0-1' ? -1000 : 0; panel(); fb('hint', g.outcome.reason === 'checkmate' ? t('learn.ph.youMated') : t('learn.ph.drawn')); return; }
            fb('hint', t('learn.ph.thinking'));
            const side = g.pos.side, n = V.branch.moves.length;
            D.job('analysis', { type: 'analyse', fen: V.branch.fen, moves: V.branch.moves.slice(), timeMs: 600 }, (res) => {
              if (S.v !== V || !V.branch || V.branch.moves.length !== n || !res || res.error) return;
              V.branchEval = Math.max(-1000, Math.min(1000, (res.mate ? (res.mate > 0 ? 1000 : -1000) : res.cp) * side));
              panel();
              fb('hint', t('learn.ph.engineSays', { words: evalWords(V.branchEval) }) + (res.bestSan ? ' ' + t('learn.ph.engineIdea', { san: res.bestSan }) : ''));
            });
          });
        };
        if (g.needsPromotion(from, to)) D.choosePromotion(S.pos.side, (k) => { if (k) go2(k); else setBoard(S.pos); }); else go2(0);
      });
      ctl(); panel();
    }
    function leaveBranch() {
      const V = S.v;
      V.branch = null; V.branchEval = null;
      $('ph-fb').innerHTML = '';
      goPly(V.ply);
    }

    function finishPart() {
      stopTimers();
      rec.parts[part.id] = true;
      if (!practice) { D.save(); D.go('lesson', { id: L.id, part: parts[pIndex + 1].id }); return; }
      const asks = beats.map((b, k) => (b.ask ? k : -1)).filter((k) => k >= 0);
      const first = asks.filter((k) => S.results[k] === true).length;
      const pct = Math.round((first / Math.max(1, asks.length)) * 100);
      D.setHooks({});
      $('ph-eyebrow').textContent = t('learn.ls.yourResult');
      if (!first) {
        $('ph-content').innerHTML = '<div class="done-card"><p class="prompt">' + esc(t('learn.ls.firstTime', { n: 0, of: asks.length, pct: 0 })) + '</p><p class="say">' + esc(t('learn.ls.notYet')) + '</p></div>';
        $('ph-next').textContent = t('learn.ls.again');
        $('ph-next').onclick = () => { AU.play('tap'); D.go('lesson', { id: L.id, part: part.id }); };
        $('ph-prev').hidden = true;
        D.save();
        return;
      }
      const res = D.PG.lessonFinished(P, L, first, asks.length, D.LESSONS.lessons);
      D.save();
      $('ph-content').innerHTML = '<div class="done-card"><p class="big-stars">' + D.stars(res.stars) + '</p><p class="prompt">' + esc(pct >= 80 ? t('learn.ls.mastered') : t('learn.ls.complete')) + '</p>' +
        '<p class="say">' + esc(t('learn.ls.firstTime', { n: first, of: asks.length, pct }) + ' ' + t('learn.ph.journey')) + '</p>' + (res.xp ? '<span class="pill gold">+' + res.xp + ' XP</span>' : '') + '</div>';
      $('ph-next').textContent = t('learn.ls.backLearn');
      $('ph-next').onclick = () => { AU.play('tap'); D.go('learn'); };
      $('ph-prev').hidden = true;
      AU.play('win');
      D.guideSay('lesson.done', { delay: 2200 });
      view.celebrate('win', -1, null, -1);
      D.celebrate(res);
      $('ph-dots').innerHTML = beats.map((b, k) => '<i class="' + (S.results[k] === true ? 'ok' : S.results[k] === false ? 'bad' : 'on') + '"></i>').join('');
    }

    if (part) render(); else contents();
    return {
      leave() { stopTimers(); AU.hush(); if (S.v) S.v.playing = false; },
      key(e) {
        if (e.target && e.target.closest && e.target.closest('button')) return;
        if (S.v && !S.v.branch && !S.v.waiting && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { stop(); if (e.key === 'ArrowRight') forward(); else goPly(Math.max(S.v.from, S.v.ply - 1)); return; }
        if (part && e.key === 'Enter' && (!beats[S.i].ask || S.answered)) next();
      },
    };
  };
};

if (typeof module !== 'undefined') module.exports = ChackmateCourse;
