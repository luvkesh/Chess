// Chackmate coach: engine-grounded move review and explanations.
// Every claim comes from the engine or a deterministic detector here; the
// sentences are templates filled from a verified "fact sheet". Pure functions,
// so the same source runs in Node tests, on the page and inside a Web Worker.
// strings: the coach's sentences in another language (packages/content/i18n/coach.json, one
// language's column); anything missing falls back to the English below.
function ChacklateCoach(E, strings) {
  'use strict';
  const { WHITE, P, N, B, R, Q, K, MATE } = E;
  const EN = {
    'side.w': 'White', 'side.b': 'Black', 'and': 'and', 'on': '{piece} on {sq}',
    'piece.1': 'pawn', 'piece.2': 'knight', 'piece.3': 'bishop', 'piece.4': 'rook', 'piece.5': 'queen', 'piece.6': 'king',
    'd.mate': '{san} is checkmate.', 'd.stalemate': '{san} stalemates: the game is drawn.', 'd.sentence': '{san} {bits}.',
    'd.fork': 'forks the {list}', 'd.pinKing': 'pins the {piece} on {sq} to the king', 'd.pin': 'pins the {piece} on {sq} to the {behind}',
    'd.skewer': 'skewers the {piece} on {sq}, winning the {behind} behind it', 'd.discovered': 'uncovers an attack on the {piece} on {sq}',
    'd.promote': 'promotes to a {piece}', 'd.attacks': 'attacks the {list}', 'd.wins': 'wins a {piece}', 'd.takes': 'takes the {piece}',
    'd.check': 'gives check', 'd.castle': 'tucks the king away',
    'label.brilliant': 'Brilliant', 'label.best': 'Best', 'label.excellent': 'Excellent', 'label.good': 'Good', 'label.inaccuracy': 'Inaccuracy', 'label.mistake': 'Mistake', 'label.blunder': 'Blunder',
    'x.sacrifice': '{san} gives up material for a lasting attack.', 'x.sacrificeOk': 'A strong sacrifice: the engine agrees.',
    'x.top': 'The engine\'s top choice.', 'x.nearly': 'Nearly as good as the best move.', 'x.sound': 'A sound move.',
    'x.allowsMate': 'This allows checkmate: {san}.', 'x.walksIntoMate': 'This walks into a forced mate in {n}, starting with {san}.',
    'x.allowsFork': 'This allows {san}, forking your {list}.', 'x.losesPawn': 'This lets {side} win a pawn with {san}.', 'x.losesPiece': 'This lets {side} win your {piece} with {san}.',
    'x.losesPawnAttack': 'This lets {side} win a pawn with {san}, which also attacks your {target}.', 'x.losesPieceAttack': 'This lets {side} win your {piece} with {san}, which also attacks your {target}.',
    'x.allowsAttack': 'This allows {san}, attacking your {list}.', 'x.leaves': 'This leaves your {piece} on {sq} undefended.', 'x.allows': 'This allows {what}',
    'x.initiative': 'After {san}, {side} takes over the initiative.', 'x.better': 'Better was {san}: {bits}.', 'x.betterPlain': 'Better was {san}.', 'x.betterMate': 'Better was {san}, which is checkmate.', 'x.missedMate': 'There was a forced mate in {n}.',
    't.mate': '{side} threatens checkmate with {san}.', 't.forcedMate': '{side} threatens a forced mate starting with {san}.', 't.which': '{side} threatens {san}, which {bits}.',
    't.none': '{side} has no direct threat. Their best idea is {san}.',
    'h.forcing': 'Look for your most forcing move: checks, captures, then threats.', 'h.mate': 'There is a checkmate in one move.', 'h.fork': 'Look for a fork: one piece attacking two targets.',
    'h.pin': 'Look for a pin along a line.', 'h.skewer': 'Look for a skewer.', 'h.discovered': 'Look for a discovered attack.', 'h.capture': 'Something can be captured safely.',
    'h.promote': 'A pawn is ready to promote.', 'h.castle': 'Think about king safety.', 'h.attacked': 'One of your pieces is under attack. Look at your {piece} on {sq}.',
  };
  const tr = (key, vars) => {
    const s = (strings && strings[key]) || EN[key];
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k])) : s;
  };
  const NAME = ['', 1, 2, 3, 4, 5, 6].map((k) => (k ? tr('piece.' + k) : ''));
  const PTS = [0, 1, 3, 3, 5, 9, 100];
  const SIDE = (s) => tr(s === WHITE ? 'side.w' : 'side.b');
  const sqn = (sq88) => 'abcdefgh'[sq88 & 7] + (1 + (sq88 >> 4));
  const on = (sq) => !(sq & 0x88);

  // Win probability (0..1) for the side the centipawn score belongs to.
  function winProb(cp) { return 1 / (1 + Math.exp(-0.00368208 * Math.max(-2000, Math.min(2000, cp)))); }
  // Engine scores use MATE - ply for forced mates; map them to a large centipawn value.
  function toCp(score) {
    if (score > MATE - 500) return 10000 - (MATE - score);
    if (score < -MATE + 500) return -10000 + (MATE + score);
    return score;
  }
  function mateIn(score) {
    if (score > MATE - 500) return Math.ceil((MATE - score) / 2);
    if (score < -MATE + 500) return -Math.ceil((MATE + score) / 2);
    return 0;
  }

  // Every piece of `side` that attacks square `sq` (0x88), cheapest first.
  function attackers(pos, sq, side) {
    const b = pos.b, out = [];
    const pawnFrom = side === WHITE ? [sq - 15, sq - 17] : [sq + 15, sq + 17];
    for (const s of pawnFrom) if (on(s) && b[s] === P * side) out.push({ sq: s, kind: P });
    for (const d of E.KNIGHT_DIRS) { const s = sq + d; if (on(s) && b[s] === N * side) out.push({ sq: s, kind: N }); }
    for (const d of E.KING_DIRS) { const s = sq + d; if (on(s) && b[s] === K * side) out.push({ sq: s, kind: K }); }
    const slide = (dirs, kinds) => {
      for (const d of dirs) {
        let s = sq + d;
        while (on(s)) {
          const p = b[s];
          if (p) { if (Math.sign(p) === side && kinds.includes(Math.abs(p))) out.push({ sq: s, kind: Math.abs(p) }); break; }
          s += d;
        }
      }
    };
    slide(E.BISHOP_DIRS, [B, Q]);
    slide(E.ROOK_DIRS, [R, Q]);
    return out.sort((a, b2) => PTS[a.kind] - PTS[b2.kind]);
  }

  // Squares attacked by the piece standing on `sq`.
  function attacksFrom(pos, sq) {
    const b = pos.b, p = b[sq], kind = Math.abs(p), side = Math.sign(p), out = [];
    if (!p) return out;
    if (kind === P) { for (const d of side === WHITE ? [15, 17] : [-15, -17]) if (on(sq + d)) out.push(sq + d); return out; }
    if (kind === N || kind === K) { for (const d of kind === N ? E.KNIGHT_DIRS : E.KING_DIRS) if (on(sq + d)) out.push(sq + d); return out; }
    const dirs = kind === B ? E.BISHOP_DIRS : kind === R ? E.ROOK_DIRS : E.BISHOP_DIRS.concat(E.ROOK_DIRS);
    for (const d of dirs) { let s = sq + d; while (on(s)) { out.push(s); if (b[s]) break; s += d; } }
    return out;
  }

  // A piece is hanging if the opponent can win material by taking it.
  function isHanging(pos, sq) {
    const p = pos.b[sq]; if (!p || Math.abs(p) === K) return false;
    const side = Math.sign(p);
    const att = attackers(pos, sq, -side);
    if (!att.length) return false;
    const def = attackers(pos, sq, side);
    if (!def.length) return true;
    return PTS[att[0].kind] < PTS[Math.abs(p)];
  }
  function hangingPieces(pos, side) {
    const out = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = pos.b[sq];
      if (p && Math.sign(p) === side && isHanging(pos, sq)) out.push({ sq, kind: Math.abs(p) });
    }
    return out;
  }

  // Deterministic facts about move m in pos (the position before the move).
  function facts(pos, m) {
    const legal = pos.legalMoves();
    const from = m & 127, to = (m >> 7) & 127, fl = E.mFlags(m), promo = E.mPromo(m);
    const side = pos.side, mover = Math.abs(pos.b[from]);
    const capturedKind = fl & E.F_EP ? P : Math.abs(pos.b[to]);
    const san = pos.san(m, legal);
    const hangBefore = new Set(hangingPieces(pos, side).map((h) => h.sq));
    pos.make(m);
    const f = { san, uci: E.uci(m), side, piece: mover, from: sqn(from), to: sqn(to), capture: fl & E.F_CAP ? capturedKind : 0,
      check: pos.inCheck(), mate: false, stalemate: false, promotion: promo, castle: !!(fl & E.F_CASTLE), forks: [], pin: null, skewer: null,
      discovered: [], hangs: [], attacks: [], sacrifice: false };
    const reply = pos.legalMoves();
    if (!reply.length) { f.mate = f.check; f.stalemate = !f.check; }
    // Fork: the moved piece attacks two or more targets worth more than it, or the king plus something loose.
    const targets = attacksFrom(pos, to).filter((s) => pos.b[s] && Math.sign(pos.b[s]) === -side).map((s) => ({ sq: s, kind: Math.abs(pos.b[s]) }));
    const valuable = targets.filter((t) => t.kind === K || (t.kind !== P && (PTS[t.kind] > PTS[mover] || !attackers(pos, t.sq, -side).length)));
    if (valuable.length >= 2 && !isHanging(pos, to)) f.forks = valuable.map((t) => ({ sq: sqn(t.sq), kind: t.kind }));
    // Pin or skewer along the moved piece's lines.
    if ([B, R, Q].includes(Math.abs(pos.b[to]))) {
      const kind = Math.abs(pos.b[to]);
      const dirs = kind === B ? E.BISHOP_DIRS : kind === R ? E.ROOK_DIRS : E.BISHOP_DIRS.concat(E.ROOK_DIRS);
      for (const d of dirs) {
        let s = to + d, first = null;
        while (on(s)) {
          const p = pos.b[s];
          if (p) {
            if (Math.sign(p) !== -side) break;
            if (!first) first = { sq: s, kind: Math.abs(p) };
            else {
              const second = { sq: s, kind: Math.abs(p) };
              if (first.kind !== K && PTS[second.kind] > PTS[first.kind] && first.kind !== P) f.pin = { piece: first.kind, at: sqn(first.sq), behind: second.kind, absolute: second.kind === K };
              else if (first.kind !== K && PTS[second.kind] > PTS[first.kind] && first.kind === P) { /* pawns are rarely worth calling pinned */ }
              else if (PTS[first.kind] > PTS[second.kind] && PTS[first.kind] > PTS[kind] - 1) f.skewer = { front: first.kind, at: sqn(first.sq), behind: second.kind };
              break;
            }
          }
          s += d;
        }
        if (f.pin || f.skewer) break;
      }
    }
    // Discovered attack: a friendly slider now hits an enemy piece through the vacated square.
    for (let s = 0; s < 128; s++) {
      if (s & 0x88) { s += 7; continue; }
      const p = pos.b[s];
      if (!p || Math.sign(p) !== side || s === to || ![B, R, Q].includes(Math.abs(p))) continue;
      for (const t of attacksFrom(pos, s)) {
        const v = pos.b[t];
        if (!v || Math.sign(v) !== -side || Math.abs(v) < R) continue;
        // Was the line blocked by the moved piece before?
        const dx = Math.sign((t & 7) - (s & 7)), dy = Math.sign((t >> 4) - (s >> 4));
        let k = s + dy * 16 + dx, through = false;
        while (k !== t) { if (k === from) through = true; k += dy * 16 + dx; }
        if (through) f.discovered.push({ by: Math.abs(p), target: Math.abs(v), at: sqn(t) });
      }
    }
    // Pieces of ours that are newly loose after the move, including the mover itself.
    f.hangs = hangingPieces(pos, side).filter((h) => !hangBefore.has(h.sq) || h.sq === to).map((h) => ({ sq: sqn(h.sq), kind: h.kind }));
    // Enemy pieces (not pawns) that are newly loose after the move.
    const theirsBefore = new Set();
    pos.unmake();
    for (const h of hangingPieces(pos, -side)) theirsBefore.add(h.sq);
    pos.make(m);
    f.attacks = hangingPieces(pos, -side).filter((h) => h.kind !== P && !theirsBefore.has(h.sq)).map((h) => ({ sq: sqn(h.sq), kind: h.kind }));
    f.sacrifice = f.hangs.some((h) => h.sq === sqn(to)) && PTS[mover] >= 3 && PTS[f.capture] < PTS[mover];
    pos.unmake();
    return f;
  }

  const list2 = (items) => items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' ' + tr('and') + ' ' + items[items.length - 1];
  const onSq = (kind, sq) => tr('on', { piece: NAME[kind], sq });

  // What a move does, as phrases joined into one ("forks the rook on a8 and gives check").
  function bitsOf(f) {
    const bits = [];
    if (f.forks.length) bits.push(tr('d.fork', { list: list2(f.forks.map((t) => onSq(t.kind, t.sq))) }));
    if (f.pin) bits.push(tr(f.pin.absolute ? 'd.pinKing' : 'd.pin', { piece: NAME[f.pin.piece], sq: f.pin.at, behind: NAME[f.pin.behind] }));
    if (f.skewer) bits.push(tr('d.skewer', { piece: NAME[f.skewer.front], sq: f.skewer.at, behind: NAME[f.skewer.behind] }));
    if (f.discovered.length) bits.push(tr('d.discovered', { piece: NAME[f.discovered[0].target], sq: f.discovered[0].at }));
    if (f.promotion) bits.push(tr('d.promote', { piece: NAME[f.promotion] }));
    if (f.attacks.length && !f.forks.length && !f.pin && !f.skewer) bits.push(tr('d.attacks', { list: list2(f.attacks.map((t) => onSq(t.kind, t.sq))) }));
    if (f.capture && !bits.length) bits.push(tr('d.wins', { piece: NAME[f.capture] }));
    else if (f.capture) bits.unshift(tr('d.takes', { piece: NAME[f.capture] }));
    if (f.check && !f.forks.length) bits.push(tr('d.check'));
    if (f.castle) bits.push(tr('d.castle'));
    return bits.length ? list2(bits) : '';
  }
  // One sentence describing what a move does, from its fact sheet.
  function describe(f) {
    if (f.mate) return tr('d.mate', { san: f.san });
    if (f.stalemate) return tr('d.stalemate', { san: f.san });
    const bits = bitsOf(f);
    return bits ? tr('d.sentence', { san: f.san, bits }) : '';
  }

  // Classify by how much winning chance the move gave away.
  function classify(wpLoss, isBest, f, cpAfter) {
    if (isBest && f && f.sacrifice && cpAfter > -50) return 'brilliant';
    if (isBest) return 'best';
    if (wpLoss < 0.02) return 'excellent';
    if (wpLoss < 0.05) return 'good';
    if (wpLoss < 0.1) return 'inaccuracy';
    if (wpLoss < 0.2) return 'mistake';
    return 'blunder';
  }
  const LABEL = {};
  for (const k of ['brilliant', 'best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']) LABEL[k] = tr('label.' + k);
  const SYMBOL = { brilliant: '!!', best: '★', excellent: '!', good: '', inaccuracy: '?!', mistake: '?', blunder: '??' };

  // Explains a played move using the engine's reply and its preferred move.
  function explain(ply) {
    const out = [];
    const you = ply.side;
    const own = describe(ply.facts);
    if (ply.cls === 'brilliant') out.push(own || tr('x.sacrifice', { san: ply.san }), tr('x.sacrificeOk'));
    else if (ply.cls === 'best' || ply.cls === 'excellent') out.push(own || tr(ply.cls === 'best' ? 'x.top' : 'x.nearly'));
    else if (ply.cls === 'good') out.push(own || tr('x.sound'));
    else {
      const r = ply.refutation;
      const loose = (ply.facts.hangs || []).filter((h) => h.kind !== P);
      if (r && r.mate) out.push(tr('x.allowsMate', { san: r.san }));
      else if (ply.mateAgainst > 0) out.push(tr('x.walksIntoMate', { n: ply.mateAgainst, san: r.san }));
      else if (r && r.forks.length) out.push(tr('x.allowsFork', { san: r.san, list: list2(r.forks.map((t) => NAME[t.kind])) }));
      else if (r && r.capture) {
        const v = { side: SIDE(-you), san: r.san, piece: NAME[r.capture], target: r.attacks.length ? onSq(r.attacks[0].kind, r.attacks[0].sq) : '' };
        out.push(tr((r.capture === P ? 'x.losesPawn' : 'x.losesPiece') + (r.attacks.length ? 'Attack' : ''), v));
      } else if (r && r.attacks.length) out.push(tr('x.allowsAttack', { san: r.san, list: list2(r.attacks.map((t) => onSq(t.kind, t.sq))) }));
      else if (loose.length) out.push(tr('x.leaves', { piece: NAME[loose[0].kind], sq: loose[0].sq }));
      else if (r && (r.pin || r.skewer)) out.push(tr('x.allows', { what: describe(r) }));
      else if (r) out.push(tr('x.initiative', { san: r.san, side: SIDE(-you) }));
      if (ply.bestFacts) {
        const b = ply.bestFacts.mate || ply.bestFacts.stalemate ? '' : bitsOf(ply.bestFacts);
        out.push(tr(ply.bestFacts.mate ? 'x.betterMate' : b ? 'x.better' : 'x.betterPlain', { san: ply.bestSan, bits: b }));
      }
      if (ply.missedMate > 0) out.push(tr('x.missedMate', { n: ply.missedMate }));
    }
    return out.join(' ');
  }

  // Lichess-style per-move accuracy from the win-probability drop (in %).
  function moveAccuracy(wpBefore, wpAfter) {
    const d = Math.max(0, (wpBefore - wpAfter) * 100);
    return Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * d) - 3.1669));
  }

  // analyse(pos) must return { cp, best } where cp is from the side to move and
  // best is a move. The default runs the built-in engine for opts.timeMs.
  function engineAnalyser(opts) {
    const o = Object.assign({ timeMs: 150, depth: 64 }, opts);
    return (pos) => {
      const r = E.search(pos, { timeMs: o.timeMs, depth: o.depth, quiesce: true });
      return { cp: toCp(r.score), mate: mateIn(r.score), best: r.move, depth: r.depth };
    };
  }

  // Full game review. Returns per-ply verdicts plus a summary. onProgress(i, n) is optional.
  function review(startFen, ucis, opts, onProgress) {
    const analyse = (opts && opts.analyse) || engineAnalyser(opts);
    const pos = E.positionFrom(startFen, []);
    const evals = [];
    const plies = [];
    const outcomes = [];
    for (let i = 0; i <= ucis.length; i++) {
      const legal = pos.legalMoves();
      let a;
      if (!legal.length) a = { cp: pos.inCheck() ? -10000 : 0, mate: 0, best: 0, terminal: true };
      else a = analyse(pos);
      evals.push(a);
      if (onProgress) onProgress(i, ucis.length + 1);
      if (i === ucis.length) break;
      const m = pos.parseMove(ucis[i], legal);
      if (m === null || m === undefined) throw new Error('Illegal move in review: ' + ucis[i]);
      const f = facts(pos, m);
      const bestFacts = a.best && a.best !== m ? facts(pos, a.best) : null;
      plies.push({ i, san: f.san, uci: ucis[i], side: pos.side, facts: f, best: a.best ? E.uci(a.best) : null, bestSan: a.best ? pos.san(a.best, legal) : null, bestFacts, isBest: a.best === m, fen: pos.fen() });
      pos.make(m);
      outcomes.push(null);
    }
    // Refutations: the engine's best reply in the position after each move.
    const replay = E.positionFrom(startFen, []);
    for (let i = 0; i < plies.length; i++) {
      const ply = plies[i];
      const m = replay.parseMove(ply.uci);
      replay.make(m);
      const next = evals[i + 1];
      ply.refutation = next.best ? facts(replay, next.best) : null;
      const before = evals[i].cp, after = -next.cp;   // both from the mover's point of view
      ply.cpBefore = before * ply.side; ply.cpAfter = after * ply.side;   // White's point of view, for the graph
      const wpB = winProb(before), wpA = winProb(after);
      ply.wpLoss = ply.isBest ? 0 : Math.max(0, wpB - wpA);
      ply.accuracy = ply.isBest ? 100 : moveAccuracy(wpB, wpA);
      ply.cls = classify(ply.wpLoss, ply.isBest, ply.facts, after);
      // Walking into mate in one is always a blunder, even in a lost position.
      if (ply.refutation && ply.refutation.mate && !(evals[i].mate < 0)) ply.cls = 'blunder';
      ply.mateAgainst = next.mate > 0 && !ply.facts.mate ? next.mate : 0;
      ply.missedMate = evals[i].mate > 0 && !ply.isBest && !(next.mate < 0) ? evals[i].mate : 0;
      ply.text = explain(ply);
    }
    const summary = { accuracy: {}, counts: { [WHITE]: {}, [-WHITE]: {} }, turning: -1, key: [] };
    for (const side of [WHITE, -WHITE]) {
      const mine = plies.filter((p) => p.side === side);
      summary.accuracy[side] = mine.length ? Math.round(mine.reduce((a, p) => a + p.accuracy, 0) / mine.length) : null;
      for (const p of mine) summary.counts[side][p.cls] = (summary.counts[side][p.cls] || 0) + 1;
    }
    // Turning point: the single move that swung the win probability most.
    let worst = 0;
    plies.forEach((p, i) => { if (p.wpLoss > worst) { worst = p.wpLoss; summary.turning = i; } });
    summary.key = plies.map((p, i) => [p.wpLoss, i]).filter(([l]) => l >= 0.1).sort((a, b) => b[0] - a[0]).slice(0, 5).map(([, i]) => i).sort((a, b) => a - b);
    const startSide = E.positionFrom(startFen, []).side;
    return { plies, evals: evals.map((e, i) => ({ cp: e.cp * startSide * (i % 2 === 0 ? 1 : -1), mate: e.mate * startSide * (i % 2 === 0 ? 1 : -1) })), summary };
  }

  // What would the opponent do if it were their move? (null-move threat finder)
  function threat(pos, opts) {
    if (pos.inCheck()) return null;
    const before = E.search(pos, { timeMs: (opts && opts.timeMs) || 200, quiesce: true });
    pos.makeNull();
    const r = E.search(pos, { timeMs: (opts && opts.timeMs) || 200, quiesce: true });
    let f = null;
    if (r.move) f = facts(pos, r.move);
    pos.unmakeNull();
    if (!f) return null;
    const gain = toCp(r.score) + toCp(before.score);
    const serious = f.mate || mateIn(r.score) > 0 || (f.capture && f.capture !== P) || f.forks.length || gain > 150;
    return { facts: f, serious, mate: mateIn(r.score), text: threatText(f, mateIn(r.score)) };
  }
  function threatText(f, mate) {
    const v = { side: SIDE(f.side), san: f.san };
    if (f.mate) return tr('t.mate', v);
    if (mate > 0) return tr('t.forcedMate', v);
    const bits = f.stalemate ? '' : bitsOf(f);
    if (bits) return tr('t.which', Object.assign(v, { bits }));
    return tr('t.none', v);
  }

  // Principal line by repeated shallow searches (used for "show me the plan").
  function line(pos, plies, timeMs) {
    const out = [], made = [];
    for (let i = 0; i < plies; i++) {
      const legal = pos.legalMoves();
      if (!legal.length) break;
      const r = E.search(pos, { timeMs: timeMs || 120, quiesce: true });
      if (!r.move) break;
      out.push(pos.san(r.move, legal));
      pos.make(r.move); made.push(r.move);
    }
    for (let i = 0; i < made.length; i++) pos.unmake();
    return out;
  }

  // Hint ladder for a position: theme first, then the piece, then the move.
  function hintLadder(pos, best) {
    const f = facts(pos, best);
    let theme = tr('h.forcing');
    if (f.mate) theme = tr('h.mate');
    else if (f.forks.length) theme = tr('h.fork');
    else if (f.pin) theme = tr('h.pin');
    else if (f.skewer) theme = tr('h.skewer');
    else if (f.discovered.length) theme = tr('h.discovered');
    else if (f.capture && f.capture !== P) theme = tr('h.capture');
    else if (f.promotion) theme = tr('h.promote');
    else if (f.castle) theme = tr('h.castle');
    else {
      const loose = hangingPieces(pos, pos.side);
      if (loose.length) theme = tr('h.attacked', { piece: NAME[loose[0].kind], sq: sqn(loose[0].sq) });
    }
    return { theme, piece: onSq(f.piece, f.from), from: f.from, to: f.to, san: f.san, text: describe(f) };
  }

  return { winProb, toCp, mateIn, attackers, attacksFrom, isHanging, hangingPieces, facts, describe, classify, explain, review, threat, line, hintLadder,
    moveAccuracy, engineAnalyser, LABEL, SYMBOL, NAME, EN };
}

if (typeof module !== 'undefined') module.exports = ChacklateCoach;
