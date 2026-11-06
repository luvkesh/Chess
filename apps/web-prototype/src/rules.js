// The in-game rule book: the special rules a child meets mid-game (check, castling, en passant,
// promotion and draws), each with a small board picture, a link to its lesson and a line on
// how it stands in the game being played. Pure functions over the engine, tested in Node.
function ChacklateRules(E) {
  'use strict';

  const sq = (name) => (name.charCodeAt(1) - 49) * 8 + (name.charCodeAt(0) - 97);
  const name64 = (s) => 'abcdefgh'[s & 7] + (1 + (s >> 3));
  const at88 = (pos, s64) => pos.b[E.to88(s64)];

  // The pictures: a FEN, the part of the board to show (files and ranks, 0 to 7) and the
  // arrows and glowing squares that tell the story.
  const RULES = [
    {
      id: 'check', title: 'Check', lesson: 'lesson.c02.l01.check',
      text: 'When a king is attacked, it is in check. You must get out of check straight away, in one of three ways: move the king, block the attack, or capture the attacker.',
      pic: { fen: '4k3/8/8/8/4R3/8/8/8 b - - 0 1', files: [2, 6], ranks: [3, 7], arrows: [['e4', 'e8']], marks: ['e8'] },
    },
    {
      id: 'castling', title: 'Castling', lesson: 'lesson.c02.l03.castling',
      text: 'Once a game, your king can step two squares towards a rook, and the rook jumps over to stand beside it. You may castle only if the king and that rook have never moved, the squares between them are empty, and the king is not in check and does not cross or land on a square an enemy piece attacks.',
      pic: { fen: '8/8/8/8/8/8/8/4K2R w K - 0 1', files: [3, 7], ranks: [0, 1], arrows: [['e1', 'g1'], ['h1', 'f1', 0.55]] },
    },
    {
      id: 'en-passant', title: 'En passant', lesson: 'lesson.c02.l04.en-passant',
      text: 'When an enemy pawn jumps two squares and lands right beside your pawn, your pawn may capture it as if it had moved only one square. It is French for “in passing”. You must do it on your very next move, or the chance is gone.',
      pic: { fen: '8/8/8/3pP3/8/8/8/8 w - d6 0 1', files: [2, 5], ranks: [4, 6], arrows: [['e5', 'd6']], marks: ['d5'] },
    },
    {
      id: 'promotion', title: 'Promotion', lesson: 'lesson.c01.l06.pawns',
      text: 'A pawn that reaches the far side of the board becomes a queen, a rook, a bishop or a knight, whichever you choose. Most players pick a queen, the strongest piece.',
      pic: { fen: '8/4P3/8/8/8/8/8/8 w - - 0 1', files: [2, 6], ranks: [5, 7], arrows: [['e7', 'e8']], marks: ['e8'] },
    },
    {
      id: 'draws', title: 'Draws', lesson: 'lesson.c02.l06.draws', also: { id: 'lesson.c02.l05.stalemate', title: 'Stalemate' },
      text: 'A game can end in a draw, a tie with no winner: when the player to move has no legal move but is not in check (stalemate), when the same position comes up three times, when fifty moves pass with no capture and no pawn move, when neither side has enough pieces left to checkmate, or when both players agree.',
      pic: { fen: '7k/8/6Q1/8/8/8/8/K7 b - - 0 1', files: [4, 7], ranks: [5, 7], marks: ['h8'] },
    },
  ];

  // Every line the rule book says, as whole sentences so each language can order its words its own
  // way. say(key, vars) gives the player's language (packages/content/i18n/rules.json, which the
  // i18n test keeps in step with EN); without it, English.
  const EN = {
    white: 'White', black: 'Black', and: ' and ', andAlso: ', and ',
    kingside: 'kingside', queenside: 'queenside', both: 'kingside or queenside',
    onBoth: 'on both sides', onKingside: 'on the kingside', onQueenside: 'on the queenside',
    'castle.gone.you': 'Your king or rooks have moved, so castling is gone for this game.',
    'castle.gone.side': '{side}’s king or rooks have moved, so castling is gone for this game.',
    'castle.now.you': 'You can castle right now: {ways}. Move the king two squares towards the rook.',
    'castle.now.side': '{side} can castle right now: {ways}. Move the king two squares towards the rook.',
    'castle.notYet.you': 'You can still castle {where} later, but not yet: {why}.',
    'castle.notYet.side': '{side} can still castle {where} later, but not yet: {why}.',
    'castle.later.you': 'You can still castle {where} later once it is your turn.',
    'castle.later.side': '{side} can still castle {where} later once it is their turn.',
    'castle.why.check': 'the king is in check',
    'castle.why.between': 'pieces are standing in between',
    'castle.why.watched': 'an enemy piece watches a square the king must cross',
    'ep.none': 'No en passant capture is possible right now.',
    'ep.you': 'Right now, you can capture en passant on {sq}. This is the only move it is allowed on.',
    'ep.side': 'Right now, {side} can capture en passant on {sq}. This is the only move it is allowed on.',
    'ep.opponent': 'Your opponent can capture en passant on {sq} this move.',
    'promo.you': 'Your pawn on {sq} is one step from promoting!',
    'promo.youMany': 'Your pawns on {sq} are one step from promoting!',
    'promo.side': '{side}’s pawn on {sq} is one step from promoting!',
    'promo.sideMany': '{side}’s pawns on {sq} are one step from promoting!',
    'promo.theirs': 'Watch out: the other side’s pawn on {sq} is one step from promoting.',
    'promo.none': 'No pawn is close to the far side yet.',
    'draw.ended': 'This game ended in a draw.',
    'draw.threefold': 'This position has come up three times, so either player can claim a draw right now.',
    'draw.fifty': 'Fifty moves have passed with no capture and no pawn move, so either player can claim a draw right now.',
    'draw.twice': 'This position has come up twice. Once more and either player can claim a draw.',
    'draw.count': '{n} moves with no capture and no pawn move. At 50, either player can claim a draw.',
    'draw.none': 'Nothing points to a draw yet.',
    'check.you': 'You are in check right now.',
    'check.side': '{side} is in check right now.',
    'title.check': 'Check', 'title.castling': 'Castling', 'title.en-passant': 'En passant', 'title.promotion': 'Promotion', 'title.draws': 'Draws',
    'text.check': RULES[0].text, 'text.castling': RULES[1].text, 'text.en-passant': RULES[2].text, 'text.promotion': RULES[3].text, 'text.draws': RULES[4].text,
  };
  const fill = (str, v) => (v ? str.replace(/\{(\w+)\}/g, (m, k) => (v[k] === undefined ? m : v[k])) : str);
  let say = null;
  const L = (k, v) => { const x = say && say(k, v); return x || fill(EN[k], v); };

  // Who the rule book speaks to: the player in a game against a bot or online, the side to move
  // when two players share the device.
  const you = (game, side) => L(side === E.WHITE ? 'white' : 'black');

  function castlingNow(g, side, mine) {
    const pos = g.pos;
    const ks = side === E.WHITE ? 1 : 4, qs = side === E.WHITE ? 2 : 8;
    const who = mine ? 'you' : 'side', sv = { side: you(g, side) };
    const rights = [(pos.castle & ks) && 'kingside', (pos.castle & qs) && 'queenside'].filter(Boolean);
    if (!rights.length) return { now: false, line: L('castle.gone.' + who, sv) };
    const home = side === E.WHITE ? 4 : 60;
    const legal = g.pos.side === side ? g.legal.filter((m) => E.mFlags(m) & E.F_CASTLE).map((m) => (E.mTo(m) > home ? 'kingside' : 'queenside')) : [];
    if (legal.length) return { now: true, line: L('castle.now.' + who, Object.assign({ ways: legal.length > 1 ? L('both') : L(legal[0]) }, sv)) };
    // Still allowed later: say what is in the way today.
    const why = [];
    if (pos.inCheck(side)) why.push(L('castle.why.check'));
    // files the king crosses, and the files that must be empty, for each side of the board
    const crossed = { kingside: [5, 6], queenside: [3, 2] }, between = { kingside: [5, 6], queenside: [1, 2, 3] };
    const base = home - 4;
    if (rights.some((r) => between[r].some((f) => at88(pos, base + f)))) why.push(L('castle.why.between'));
    if (rights.some((r) => crossed[r].some((f) => pos.attacked(E.to88(base + f), -side)))) why.push(L('castle.why.watched'));
    const where = L(rights.length === 2 ? 'onBoth' : rights[0] === 'kingside' ? 'onKingside' : 'onQueenside');
    return { now: false, line: why.length ? L('castle.notYet.' + who, Object.assign({ where, why: why.join(L('andAlso')) }, sv)) : L('castle.later.' + who, Object.assign({ where }, sv)) };
  }

  function enPassantNow(g, side, mine) {
    const caps = g.legal.filter((m) => E.mFlags(m) & E.F_EP);
    if (!caps.length) return { now: false, line: L('ep.none') };
    const sqName = name64(E.mTo(caps[0]));
    const mover = g.pos.side === side;
    return { now: true, line: mover ? L(mine ? 'ep.you' : 'ep.side', { sq: sqName, side: you(g, side) }) : L('ep.opponent', { sq: sqName }) };
  }

  function promotionNow(g, side, mine) {
    const near = (s) => {
      const out = [];
      for (let i = 0; i < 64; i++) if (at88(g.pos, i) === E.P * s && (i >> 3) === (s === E.WHITE ? 6 : 1)) out.push(name64(i));
      return out;
    };
    const ours = near(side), theirs = near(-side);
    if (ours.length) return { now: true, line: L((mine ? 'promo.you' : 'promo.side') + (ours.length > 1 ? 'Many' : ''), { sq: ours.join(L('and')), side: you(g, side) }) };
    if (theirs.length) return { now: true, line: L('promo.theirs', { sq: theirs.join(L('and')) }) };
    return { now: false, line: L('promo.none') };
  }

  function drawsNow(g) {
    const pos = g.pos;
    if (g.outcome && g.outcome.result === '1/2-1/2') return { now: true, line: L('draw.ended') };
    const claim = g.claimable();
    if (claim === 'threefold') return { now: true, line: L('draw.threefold') };
    if (claim === 'fifty') return { now: true, line: L('draw.fifty') };
    const reps = g.repetitions();
    if (reps === 2) return { now: true, line: L('draw.twice') };
    const moves = Math.floor(pos.half / 2);
    if (moves >= 30) return { now: true, line: L('draw.count', { n: moves }) };
    return { now: false, line: L('draw.none') };
  }

  // The rule book for a game: every rule with its line for this position, the ones that matter
  // right now first. Check is only listed while a king is in check.
  // side: the player the book speaks to; mine: false when two players share the device.
  function forGame(g, side, mine) {
    const status = {
      check: () => {
        const s = g.pos.side;
        if (!g.pos.inCheck()) return null;
        return { now: true, line: s === side && mine ? L('check.you') : L('check.side', { side: you(g, s) }) };
      },
      castling: () => castlingNow(g, side, mine),
      'en-passant': () => enPassantNow(g, side, mine),
      promotion: () => promotionNow(g, side, mine),
      draws: () => drawsNow(g),
    };
    const out = [];
    RULES.forEach((r, i) => {
      const s = status[r.id]();
      if (s) out.push(Object.assign({}, r, s, { order: i, title: L('title.' + r.id), text: L('text.' + r.id) }));
    });
    return out.sort((a, b) => (b.now - a.now) || (a.order - b.order));
  }

  return { RULES, forGame, sq, EN, setSay(f) { say = f; } };
}
if (typeof module !== 'undefined') module.exports = ChacklateRules;
