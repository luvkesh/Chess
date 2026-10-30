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

  // Who the rule book speaks to: the player in a game against a bot or online, the side to move
  // when two players share the device.
  const you = (game, side) => (side === E.WHITE ? 'White' : 'Black');

  function castlingNow(g, side, mine) {
    const pos = g.pos;
    const ks = side === E.WHITE ? 1 : 4, qs = side === E.WHITE ? 2 : 8;
    const who = mine ? 'You' : you(g, side);
    const rights = [(pos.castle & ks) && 'kingside', (pos.castle & qs) && 'queenside'].filter(Boolean);
    if (!rights.length) return { now: false, line: (mine ? 'Your' : you(g, side) + '’s') + ' king or rooks have moved, so castling is gone for this game.' };
    const home = side === E.WHITE ? 4 : 60;
    const legal = g.pos.side === side ? g.legal.filter((m) => E.mFlags(m) & E.F_CASTLE).map((m) => (E.mTo(m) > home ? 'kingside' : 'queenside')) : [];
    if (legal.length) return { now: true, line: who + ' can castle right now: ' + legal.join(' or ') + '. Move the king two squares towards the rook.' };
    // Still allowed later: say what is in the way today.
    const why = [];
    if (pos.inCheck(side)) why.push('the king is in check');
    // files the king crosses, and the files that must be empty, for each side of the board
    const crossed = { kingside: [5, 6], queenside: [3, 2] }, between = { kingside: [5, 6], queenside: [1, 2, 3] };
    const base = home - 4;
    if (rights.some((r) => between[r].some((f) => at88(pos, base + f)))) why.push('pieces are standing in between');
    if (rights.some((r) => crossed[r].some((f) => pos.attacked(E.to88(base + f), -side)))) why.push('an enemy piece watches a square the king must cross');
    const still = rights.length === 2 ? 'on both sides' : 'on the ' + rights[0];
    return { now: false, line: who + ' can still castle ' + still + ' later' + (why.length ? ', but not yet: ' + why.join(', and ') + '.' : ' once it is ' + (mine ? 'your' : 'their') + ' turn.') };
  }

  function enPassantNow(g, side, mine) {
    const caps = g.legal.filter((m) => E.mFlags(m) & E.F_EP);
    if (!caps.length) return { now: false, line: 'No en passant capture is possible right now.' };
    const to = name64(E.mTo(caps[0]));
    const mover = g.pos.side === side;
    return { now: true, line: mover ? (mine ? 'Right now, you' : 'Right now, ' + you(g, side)) + ' can capture en passant on ' + to + '. This is the only move it is allowed on.'
      : 'Your opponent can capture en passant on ' + to + ' this move.' };
  }

  function promotionNow(g, side, mine) {
    const near = (s) => {
      const out = [];
      for (let i = 0; i < 64; i++) if (at88(g.pos, i) === E.P * s && (i >> 3) === (s === E.WHITE ? 6 : 1)) out.push(name64(i));
      return out;
    };
    const ours = near(side), theirs = near(-side);
    if (ours.length) return { now: true, line: (mine ? 'Your' : you(g, side) + '’s') + ' pawn' + (ours.length > 1 ? 's on ' + ours.join(' and ') + ' are' : ' on ' + ours[0] + ' is') + ' one step from promoting!' };
    if (theirs.length) return { now: true, line: 'Watch out: the other side’s pawn on ' + theirs.join(' and ') + ' is one step from promoting.' };
    return { now: false, line: 'No pawn is close to the far side yet.' };
  }

  function drawsNow(g) {
    const pos = g.pos;
    if (g.outcome && g.outcome.result === '1/2-1/2') return { now: true, line: 'This game ended in a draw.' };
    const claim = g.claimable();
    if (claim === 'threefold') return { now: true, line: 'This position has come up three times, so either player can claim a draw right now.' };
    if (claim === 'fifty') return { now: true, line: 'Fifty moves have passed with no capture and no pawn move, so either player can claim a draw right now.' };
    const reps = g.repetitions();
    if (reps === 2) return { now: true, line: 'This position has come up twice. Once more and either player can claim a draw.' };
    const moves = Math.floor(pos.half / 2);
    if (moves >= 30) return { now: true, line: moves + ' moves with no capture and no pawn move. At 50, either player can claim a draw.' };
    return { now: false, line: 'Nothing points to a draw yet.' };
  }

  // The rule book for a game: every rule with its line for this position, the ones that matter
  // right now first. Check is only listed while a king is in check.
  // side: the player the book speaks to; mine: false when two players share the device.
  function forGame(g, side, mine) {
    const status = {
      check: () => {
        const s = g.pos.side;
        if (!g.pos.inCheck()) return null;
        return { now: true, line: (s === side && mine ? 'You are' : you(g, s) + ' is') + ' in check right now.' };
      },
      castling: () => castlingNow(g, side, mine),
      'en-passant': () => enPassantNow(g, side, mine),
      promotion: () => promotionNow(g, side, mine),
      draws: () => drawsNow(g),
    };
    const out = [];
    RULES.forEach((r, i) => {
      const s = status[r.id]();
      if (s) out.push(Object.assign({}, r, s, { order: i }));
    });
    return out.sort((a, b) => (b.now - a.now) || (a.order - b.order));
  }

  return { RULES, forGame, sq };
}
if (typeof module !== 'undefined') module.exports = ChacklateRules;
