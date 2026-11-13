// Chackmate mentor: the coach's teaching layer on top of the engine and coach.js.
// Three parts, as the coaching spec asks:
//   The Analyst: study() and look() run engine searches and return plain facts (worker side).
//   The Coach:   grade(), feedback(), detail(), hints() turn those facts into sentences.
//   The Mentor:  plans(), thinkAhead(), opening and endgame guidance, the game report,
//                the player profile and practice picks.
// Every sentence is a template filled from a fact the engine or a detector here proved on the
// actual board. Nothing is made up: if a detector finds nothing, nothing is said.
// Pure functions, no DOM: the same file runs in Node tests, on the page and inside a Web Worker.
// strings: the mentor's sentences in another language (packages/content/i18n/mentor.json, one
// language's column); anything missing falls back to the English below.
function ChacklateMentor(E, C, strings, nameOf) {
  // nameOf: the opening and trap names in the player's language (the app passes its text lookup)
  const nm = (n) => (nameOf && n ? nameOf(n) || n : n);
  'use strict';
  const { WHITE, BLACK, P, N, B, R, Q, K, MATE } = E;
  const EN = {
    // the five grades
    'g.excellent': 'Excellent', 'g.good': 'Good', 'g.inaccurate': 'Inaccurate', 'g.mistake': 'Mistake', 'g.blunder': 'Blunder',
    // how the game stands, from the player's side
    'ev.winning': 'You are winning.', 'ev.better': 'You are clearly better.', 'ev.edge': 'You are a little better.', 'ev.equal': 'It is about equal.',
    'ev.worse': 'Your opponent is a little better.', 'ev.clearlyWorse': 'Your opponent is clearly better.', 'ev.losing': 'Your opponent is winning.',
    'ev.mateFor': 'There is a forced checkmate for you.', 'ev.mateAgainst': 'Your opponent has a forced checkmate.',
    'sw.same': 'The position stays about the same.', 'sw.up': 'This makes your position better.', 'sw.down': 'This makes your position worse.', 'sw.drop': 'This changes the game: you lose a lot of your chances.',
    // short reasons (level 1)
    'r.top': 'That was the best move on the board.', 'r.develops': '{san} brings a new piece into the game.', 'r.centre': '{san} fights for the centre.',
    'r.castles': '{san} keeps your king safe.', 'r.improves': '{san} puts your {piece} on a better square.', 'r.passer': '{san} pushes your passed pawn closer to promotion.',
    'r.kingUp': '{san} brings your king into the game.', 'r.trade': '{san} trades pieces while you are ahead.', 'r.defends': '{san} keeps your {piece} safe.',
    'r.rookOpen': '{san} puts your rook on an open file.', 'r.quiet': '{san} is a sound, steady move.', 'r.notBest': 'Fine, but {san} was a bit stronger.',
    // level 2: what happens next
    'n.theyThreat': 'Now your opponent may play {san}, which {bits}.', 'n.theyBest': 'Your opponent\'s best answer is {san}.',
    'n.noThreat': 'Your opponent has no direct threat now.',         // level 3: deeper
    'd.alt': '{san} was also good: {bits}.', 'd.altPlain': '{san} was another good choice.', 'd.bestWas': 'The engine\'s first choice was {san}.',
    'd.bestWhy': 'The engine\'s first choice was {san}, because it {bits}.', 'd.practical': 'Your move is practical and safe, even if {san} scores a little higher.',
    'd.line': 'A likely way the next moves go: {line}.', 'd.after': 'After that line: {eval}', 'd.missed': 'You missed {san}, which {bits}.',
    'd.missedMate': 'You missed a checkmate in {n}, starting with {san}.', 'd.theyReply': 'Their strongest reply is {san}, which {bits}.', 'd.theyReplyPlain': 'Their strongest reply is {san}.',
    // detailed move analysis headings
    'h.why': 'Why', 'h.tactics': 'Tactics', 'h.strategy': 'Plan', 'h.threats': 'Threats', 'h.material': 'Material', 'h.king': 'King safety',
    'h.activity': 'Piece activity', 'h.weak': 'Weaknesses', 'h.alts': 'Other moves', 'h.reply': 'Best reply', 'h.instead': 'If you had played the best move',
    'h.position': 'How the position changed',
    'k.safeBoth': 'Both kings are safe for now.', 'k.yoursExposed': 'Your king is open: {why}.', 'k.theirsExposed': 'Their king is open: {why}.',
    'k.shield': 'few pawns in front of it', 'k.openFile': 'open lines near it', 'k.attackers': 'enemy pieces aim at it', 'k.middle': 'it is still in the middle',
    'k.castledNow': 'Your king is now tucked away safely.', 'k.lostCastle': 'Your king can no longer castle.',
    'a.mobilityUp': 'Your {piece} now controls {n} squares, up from {m}.', 'a.mobilityDown': 'Your {piece} now controls only {n} squares, down from {m}.',
    'a.rim': 'A knight on the edge controls fewer squares.', 'a.badBishop': 'Your bishop on {sq} is blocked by your own pawns.', 'a.passive': 'Your {piece} on {sq} has little room. Find it a better square.',
    'a.open': 'Your rook on {sq} uses the open {file}-file.', 'a.rookIdle': 'The {file}-file is open: a rook there would be strong.',
    'w.isolated': 'Your pawn on {sq} has no pawn friends next to it (an isolated pawn).', 'w.doubled': 'You now have two pawns on the {file}-file (doubled pawns).',
    'w.theirIsolated': 'Their pawn on {sq} is isolated: it is a target.',
    'w.outpost': '{sq} is a great square for a knight: no enemy pawn can chase it away.', 'w.none': 'No new weaknesses.',
    't.created': 'You now attack the {list}.', 't.ignored': 'Their threat is still there: {threat}', 't.answered': 'You dealt with their threat.',
    't.none': 'No tactics on this move.', 'm.even': 'Material is even.', 'm.won': 'You won material: {piece}.', 'm.lost': 'You can lose material here: {what}',
    'm.up': 'You are ahead by {n} points.', 'm.down': 'You are behind by {n} points.',
    // phases and the mentor
    'ph.opening': 'Opening', 'ph.middlegame': 'Middlegame', 'ph.endgame': 'Endgame',
    'o.name': 'This is the {name}.', 'o.left': 'You have left the usual {name} moves. That is fine if your move follows the opening rules.',
    'o.next': 'Usual moves here: {list}.', 'o.trap': 'Careful: this is the road to {name}. {idea}', 'o.recWhite': 'A good opening for you as White: the {name}.', 'o.recBlack': 'A good answer for you as Black: the {name}.',
    'o.developLeft': 'You still have {n} pieces at home: {list}.', 'o.centre': 'Put a pawn in the centre (d4, e4, d5 or e5).',
    'o.castle': 'Castle soon to keep your king safe.', 'o.castled': 'Your king is safe. Now connect your rooks.', 'o.queenEarly': 'Your queen came out early. Watch out: their pieces can chase it and win time.',
    'o.good': 'Your opening is going well: centre, pieces out, king safe.',
    'mg.attack': 'Their king is open. Bring more pieces toward it before you strike.', 'mg.defend': 'Your king is under fire. Bring a defender back or trade their attackers.',
    'mg.openFile': 'Put a rook on the open {file}-file.', 'mg.outpost': 'Plant a knight on {sq}: no pawn can chase it away.', 'mg.passive': 'Your {piece} on {sq} is not doing much. Find it a better square.',
    'mg.pinned': 'Your {piece} on {sq} is pinned to your {behind}.', 'mg.pinThem': 'Their {piece} on {sq} is pinned to their {behind}. Pile up on it.',
    'mg.overloaded': 'Their {piece} on {sq} guards two things at once. Attack one of them.', 'mg.myOverload': 'Your {piece} on {sq} is guarding two pieces at once. Be careful.',
    'mg.isolated': 'Their pawn on {sq} is isolated. Pile up on it.', 'mg.trade': 'You are ahead. Trade pieces, not pawns, to make the win easier.', 'mg.behind': 'You are behind. Keep pieces on and look for chances.',
    'mg.passer': 'Your passed pawn on {sq} is a strength. Support it and push it.', 'mg.theirPasser': 'Their passed pawn on {sq} is dangerous. Block it with a piece.',
    'mg.space': 'Fight for the centre and give your pieces room.', 'mg.balanced': 'A calm position. Improve your worst piece.',
    'eg.enter': 'We are in the endgame now. Kings become fighters!', 'eg.king': 'Bring your king toward the middle. In the endgame it is a strong piece.',
    'eg.pawnRuns': 'Your pawn on {sq} cannot be caught: push it!', 'eg.inSquare': 'Their king can catch your pawn on {sq}. Bring your king to help it.',
    'eg.theirRuns': 'Their pawn on {sq} cannot be caught by your king. Use a piece to stop it.', 'eg.catch': 'Your king can catch their pawn on {sq}: head for it.',
    'eg.oppositionYou': 'You have the opposition: the kings face each other and they must give way.', 'eg.oppositionThem': 'They have the opposition. Try to take it back.',
    'eg.rookBehind': 'Put your rook behind the passed pawn.', 'eg.oppBishops': 'Bishops on opposite colours often lead to a draw.',
    'eg.wrongBishop': 'With a rook pawn and the wrong bishop, this is a known draw.', 'eg.stalemate': 'Careful! Their king has almost no squares. Leave it room, or it is stalemate.',
    'eg.mateQ': 'Use your queen to box in their king, a knight\'s move away, then bring your king to help.', 'eg.mateR': 'Use your rook to push their king to the edge, one row at a time, with your king helping.',
    'eg.promote': 'Push your passed pawn. Every step forward makes it stronger.', 'eg.zugzwang': 'Zugzwang! Any move makes things worse for the side to move.',
    'eg.fortress': 'Even with less material, the defender can hold here: a fortress.', 'eg.convert': 'You are winning. Trade pieces, push your pawns, use your king.',
    'eg.rook': 'In rook endgames, keep your rook active.', 'eg.queen': 'In queen endgames, keep your king safe from checks.',
    'eg.minor': 'Knights like closed positions; bishops like open ones.', 'eg.pawn': 'In pawn endgames, every king move counts.',
    // threats, chances, mate radar
    'th.queen': 'Your queen is under attack!', 'th.piece': 'Your {piece} on {sq} is under attack.', 'th.mate': 'Your opponent threatens checkmate with {san}!',
    'th.forced': 'Your opponent has a checkmate coming. Look for checks and defenders.', 'th.fork': 'Watch out: {san} would fork your {list}.',
    'th.pinned': 'Your {piece} on {sq} is pinned.', 'th.king': 'Your king is exposed. Keep it covered.', 'th.overload': 'Your {piece} on {sq} is overloaded.',
    'th.pawn': 'Your pawn on {sq} can be taken.', 'th.discovered': 'Watch out: they can uncover an attack with {san}.',
    'op.mate': 'There is a checkmate in {n} for you!', 'op.mate1': 'There is a checkmate in one move!', 'op.fork': 'There is a fork for you!', 'op.pin': 'You can pin a piece.',
    'op.skewer': 'There is a skewer for you.', 'op.discovered': 'You can uncover an attack.', 'op.free': 'Their {piece} on {sq} is not protected. Can you take it?',
    'op.win': 'You can win material here.', 'op.promote': 'Your pawn can promote!', 'op.simplify': 'You can trade into an easy, winning endgame.',
    'op.risky': 'There is a bold idea here, but it is risky.', 'op.none': 'No big chance right now. Improve your pieces.',
    'mr.pattern': 'This is called a {name}.', 'mr.line': 'The mating line: {line}.', 'mr.none': 'No checkmates in sight, for either side.',
    'mr.backRank': 'back-rank mate', 'mr.smothered': 'smothered mate', 'mr.scholar': 'Scholar\'s mate', 'mr.kiss': 'queen kiss mate', 'mr.ladder': 'ladder mate',
    'mr.backRankWhy': 'The king is stuck behind its own pawns on the back row.', 'mr.smotheredWhy': 'The king is boxed in by its own pieces and a knight gives check.',
    'mr.scholarWhy': 'The queen hits the weak f-pawn square next to the king.', 'mr.kissWhy': 'The queen sits right next to the king, with a friend guarding her.',
    'mr.ladderWhy': 'Two big pieces walk the king to the edge, one row at a time.',
    // mistake prevention
    'pv.sure': 'Are you sure?', 'pv.play': 'Play it anyway', 'pv.think': 'Think again',
    // hints
    'hi.dirMate': 'Their king is in danger. Look for checks!', 'hi.dirTactic': 'There is a trick here. Look at checks, captures and attacks.',
    'hi.dirWin': 'Something can be won. Look for loose pieces.', 'hi.dirDefend': 'Something of yours is in danger. Keep it safe first.',
    'hi.dirDevelop': 'Bring another piece into the game.', 'hi.dirCastle': 'Think about keeping your king safe.', 'hi.dirCentre': 'Fight for the centre.',
    'hi.dirPasser': 'Your passed pawn wants to run.', 'hi.dirKing': 'Your king can help in this endgame.', 'hi.dirRook': 'Your rook wants an open line.',
    'hi.dirImprove': 'Find a better square for one of your pieces.', 'hi.dirTrade': 'Trading pieces would help you here.',
    'hi.guided': 'Look at your {piece}.', 'hi.guidedIdea': 'Look at your {piece}. {idea}', 'hi.toward': 'It wants to go toward {sq}.',
    'hi.idea.mate': 'It can give checkmate.', 'hi.idea.fork': 'It can make a fork.', 'hi.idea.pin': 'It can pin something.', 'hi.idea.skewer': 'It can make a skewer.',
    'hi.idea.discovered': 'Moving it uncovers an attack.', 'hi.idea.capture': 'It can take something safely.', 'hi.idea.promote': 'It can become a queen.',
    'hi.idea.check': 'It can give check.', 'hi.idea.safety': 'It needs a safer square.', 'hi.idea.develop': 'It is still at home.', 'hi.idea.centre': 'It can help in the centre.',
    'hi.dirGoal': 'You can win the game with one move. Look closely!', 'hi.dirForce': 'You have a winning plan here. Think it through!',
    'hi.idea.goal': 'It can win the game.', 'hi.wins.hill': 'Your king reaches the hill in the middle and wins the game.',
    'hi.wins.checks': 'That is your third check, so you win the game.', 'hi.wins.bare': 'Their king is left all alone, so you win the game.',
    'hi.exactFrom': 'Move your {piece} from {from} to {to} ({san}).', 'hi.reply': 'If they answer {san}, you are ready.',
    // think ahead
    'ta.intro': 'Let\'s think a few moves ahead.', 'ta.you': 'You play {san}.', 'ta.them': 'They likely answer {san}.', 'ta.youThen': 'Then you play {san}.',
    'ta.does': '{san} {bits}.', 'ta.safe': 'This plan looks safe.', 'ta.unsafe': 'Careful: this plan runs into trouble at {san}.',
    'ta.counter': 'Watch for their counter-attack: {san}.', 'ta.combo': 'There is a combination here!', 'ta.ask': 'Before you move, ask: what does my opponent want?',
    'ta.yourTurn': 'Try your own moves on the practice board. The real game stays as it is.',
    // the game report
    'rp.win': 'You won!', 'rp.loss': 'You lost this one.', 'rp.draw': 'A draw.', 'rp.accuracy': 'Accuracy: {n}%',
    'rp.strong': 'Strong', 'rp.solid': 'Solid', 'rp.work': 'Needs work', 'rp.na': 'Not reached',
    'rp.cat.opening': 'Opening', 'rp.cat.middlegame': 'Middlegame', 'rp.cat.endgame': 'Endgame', 'rp.cat.tactics': 'Tactics', 'rp.cat.defence': 'Defence', 'rp.cat.decisions': 'Decisions',
    'rp.best': 'Best move: {san}.', 'rp.worst': 'Biggest mistake: {san}.', 'rp.missed': 'Biggest missed chance: {san} instead of {played}.',
    'rp.well.tactics': 'You spotted tactics well.', 'rp.well.opening': 'Your opening was strong: pieces out, king safe.', 'rp.well.clean': 'You played without big mistakes.',
    'rp.well.end': 'You handled the endgame well.', 'rp.well.fight': 'You kept fighting in a hard game.',
    'rp.struggle.hanging': 'Pieces were left unprotected.', 'rp.struggle.forks': 'Forks caught you out.', 'rp.struggle.mate': 'Your king got caught in a mating net.',
    'rp.struggle.missed': 'Some winning chances were missed.', 'rp.struggle.opening': 'The opening was slow: pieces stayed at home.', 'rp.struggle.end': 'The endgame slipped away.',
    'rp.struggle.king': 'Your king was not safe enough.',
    'rp.changed': 'The game turned on move {n}: {san}.', 'rp.instead': 'There, {best} was better.', 'rp.focus': 'Next game, focus on this: {what}',
    'rp.cat.opening.text': 'Development and opening rules.', 'rp.cat.middlegame.text': 'Plans and tactics in the middle.', 'rp.cat.endgame.text': 'Converting and defending.',
    'rp.cat.tactics.text': 'Forks, pins, attacks and combinations.', 'rp.cat.defence.text': 'Seeing threats and king safety.', 'rp.cat.decisions.text': 'Move choice and missed chances.',
    // performance profile and practice
    'pf.hanging': 'You often leave pieces unprotected.', 'pf.forks': 'Forks often catch you.', 'pf.mate': 'Checkmate threats sometimes slip past you.',
    'pf.missedTactics': 'You miss tactics that are there for you.', 'pf.queenEarly': 'You often move your queen too early in the opening.',
    'pf.develop': 'Your knights and bishops come out slowly.', 'pf.castle': 'You often castle late, or not at all.', 'pf.endgame': 'Endgames cost you points.',
    'pf.opening': 'Your openings are a strength.', 'pf.tactics': 'Your tactics are a strength.', 'pf.time': 'You often run short of time.',
    'pf.fast': 'You sometimes move too fast when pieces are attacked.', 'pf.better': 'Your accuracy is going up. Great work!', 'pf.steady': 'Your play is steady. Keep going!',
    'pf.none': 'Play a few games and I will learn how you play.',
    'pr.forks': 'Practise knight forks.', 'pr.hanging': 'Practise spotting loose pieces.', 'pr.mate': 'Practise checkmate patterns.', 'pr.mate2': 'Practise checkmate in two moves.',
    'pr.develop': 'Improve your opening development.', 'pr.queen': 'Develop your knights and bishops before your queen.', 'pr.castle': 'Practise king safety and castling.',
    'pr.rookEnd': 'Learn basic rook endgames.', 'pr.pawnEnd': 'Learn king and pawn endgames.', 'pr.pins': 'Practise pins.', 'pr.skewers': 'Practise skewers.',
    'pr.blunder': 'Use the blunder check before every move.', 'pr.time': 'Practise using your clock well.', 'pr.convert': 'Practise converting an advantage.',
    // time coach
    'tm.slow': 'That was a simple move. You can play moves like that faster.', 'tm.rush': 'You moved fast in a sharp spot. Take your time when pieces are attacked.',
    'tm.low': 'Your clock is getting low. Play simple, safe moves.', 'tm.think': 'This is an important moment. It is worth taking your time.',
    'tm.behind': 'You have used much more time than your opponent. Speed up a little on easy moves.',     // words to know (simple, then more)
    'v.pin': 'Pin', 'v.pin.s': 'A piece that can\'t move, or something more valuable behind it gets taken.', 'v.pin.m': 'An attack along a line on a piece that shields a more valuable piece. If the piece behind is the king, the pin is absolute.',
    'v.fork': 'Fork', 'v.fork.s': 'One piece attacking two things at once.', 'v.fork.m': 'A double attack by one piece. Knights fork well because they jump.',
    'v.skewer': 'Skewer', 'v.skewer.s': 'Like a pin, but the more valuable piece is in front.', 'v.skewer.m': 'An attack along a line that forces a big piece to move and wins the piece behind it.',
    'v.discovered': 'Discovered attack', 'v.discovered.s': 'Moving one piece uncovers an attack by another.', 'v.discovered.m': 'A piece steps out of a line, so the piece behind it attacks. The moving piece can make its own threat too.',
    'v.zugzwang': 'Zugzwang', 'v.zugzwang.s': 'Having to move when every move makes things worse.', 'v.zugzwang.m': 'A German word: the side to move would rather pass. Common in king and pawn endgames.',
    'v.opposition': 'Opposition', 'v.opposition.s': 'Kings facing each other with one square between. The one who doesn\'t have to move wins the face-off.', 'v.opposition.m': 'When kings stand two squares apart on a line, the side not to move has the opposition and can push the other king back.',
    'v.zwischenzug': 'In-between move', 'v.zwischenzug.s': 'A surprise move you play first, before the expected one.', 'v.zwischenzug.m': 'Zwischenzug: instead of recapturing at once, you play a stronger threat first.',
    'v.gambit': 'Gambit', 'v.gambit.s': 'Giving a pawn early to get a quick start.', 'v.gambit.m': 'An opening sacrifice of material for development, the centre or an attack.',
    'v.tempo': 'Tempo', 'v.tempo.s': 'One move of time.', 'v.tempo.m': 'Gaining a tempo means making progress while your opponent spends a move answering you.',
    'v.initiative': 'Initiative', 'v.initiative.s': 'Being the one making threats.', 'v.initiative.m': 'The side with the initiative makes threats that the other side must keep answering.',
    'v.passed': 'Passed pawn', 'v.passed.s': 'A pawn with no enemy pawns in its way.', 'v.passed.m': 'No enemy pawn can block or capture it on the way to promotion. Push it with support.',
    'v.isolated': 'Isolated pawn', 'v.isolated.s': 'A pawn with no pawn friends next to it.', 'v.isolated.m': 'No pawns of its side on the files beside it, so only pieces can defend it.',
    'v.outpost': 'Outpost', 'v.outpost.s': 'A safe square for a piece that no enemy pawn can attack.', 'v.outpost.m': 'A square in the enemy half, guarded by your pawn, that enemy pawns can never attack. Perfect for a knight.',
    'v.openFile': 'Open file', 'v.openFile.s': 'A column with no pawns on it.', 'v.openFile.m': 'Rooks and queens love open files: they can travel all the way down.',
    'v.backRank': 'Back rank', 'v.backRank.s': 'The first row, where the king starts.', 'v.backRank.m': 'A king stuck behind its own pawns can be mated by a rook or queen on the back rank.',
    'v.overloaded': 'Overloaded piece', 'v.overloaded.s': 'A piece with too many jobs.', 'v.overloaded.m': 'A defender guarding two things at once: attack one and the other falls.',
    'v.sacrifice': 'Sacrifice', 'v.sacrifice.s': 'Giving away material on purpose.', 'v.sacrifice.m': 'Giving material for something bigger: an attack, a checkmate or a better position.',
    'v.development': 'Development', 'v.development.s': 'Bringing your pieces out from home.', 'v.development.m': 'Moving knights and bishops off the back rank early, so they can join the fight.',
    'v.castling': 'Castling', 'v.castling.s': 'A special move that tucks the king away and brings a rook out.', 'v.castling.m': 'King two squares toward a rook, rook jumps over. Only if neither has moved and the king is not in check.',
    'v.stalemate': 'Stalemate', 'v.stalemate.s': 'No legal move and not in check: a draw.', 'v.stalemate.m': 'When you are far ahead, leave the enemy king a square, or the game ends as a draw.',
    'v.fortress': 'Fortress', 'v.fortress.s': 'A setup the stronger side can\'t break.', 'v.fortress.m': 'A defensive position that holds a draw even with less material.',
    'v.promotion': 'Promotion', 'v.promotion.s': 'A pawn reaching the last row becomes a new piece.', 'v.promotion.m': 'Usually a queen, but sometimes a knight is better.',
    'v.exchange': 'Trade', 'v.exchange.s': 'Swapping pieces of the same value.', 'v.exchange.m': 'Trade when you are ahead, or to remove a strong enemy piece. Avoid trades when you are behind.',
    'v.hanging': 'Loose piece', 'v.hanging.s': 'A piece that can be taken for free.', 'v.hanging.m': 'An unprotected piece, or one attacked by something cheaper. Loose pieces drop off.',
    'v.checkmate': 'Checkmate', 'v.checkmate.s': 'The king is attacked and can\'t escape. Game over.', 'v.checkmate.m': 'Check with no way to move, block or capture. The goal of chess.',
    // openers: the first words of a comment, many ways each, by grade and style (f: friendly, p: professional, e: encouraging)
  };
  // Many ways to say each thing, so the coach never sounds the same twice. Added to EN below.
  const OPENERS = {
    excellent: {
      f: ['Brilliantly played!', 'Ooh, that\'s a very strong move!', 'Excellent calculation!', 'You spotted a great chance!', 'Beautifully done!', 'That\'s exactly the kind of move to find!', 'Wow, top move!', 'Now that\'s chess!'],
      p: ['Excellent move.', 'A very strong move.', 'Precise.', 'Well calculated.', 'That is the strongest choice.', 'Accurate play.'],
      e: ['Amazing, you found it!', 'Yes! Super move!', 'You are getting so good at this!', 'Look at you go!', 'Fantastic thinking!', 'Superstar move!'],
    },
    good: {
      f: ['Good move!', 'Nice one.', 'Solid choice.', 'That works well.', 'Sensible move.', 'Nicely played.', 'Good thinking.', 'That\'s a fine move.'],
      p: ['Good move.', 'A sound move.', 'Reasonable.', 'Solid.', 'A sensible choice.', 'That keeps things in order.'],
      e: ['Good job!', 'Well done!', 'Nice work, keep it up!', 'You\'re playing well!', 'That\'s the spirit!', 'Good going!'],
    },
    inaccurate: {
      f: ['Hmm, not quite the best.', 'That\'s okay, but there was better.', 'Close, but not the best.', 'Playable, but let\'s look again.', 'A small slip.', 'Not bad, but not the strongest.'],
      p: ['Slightly inaccurate.', 'Playable, but not the best.', 'An inaccuracy.', 'There was a stronger option.', 'A little loose.'],
      e: ['Almost! There was a better idea.', 'Not bad! You can find better.', 'Good try, there was a stronger move.', 'Nearly there!', 'Close one! Let\'s learn from it.'],
    },
    mistake: {
      f: ['Hmm, that one hurts a bit.', 'Uh oh, that\'s a mistake.', 'Let\'s look at that again.', 'That gives them a chance.', 'Careful there.', 'Oops, a mistake.'],
      p: ['A mistake.', 'That move worsens your position.', 'This gives your opponent an advantage.', 'Not a good move.', 'An error.'],
      e: ['Oops! Everyone makes mistakes.', 'That\'s a mistake, but you can fix things.', 'No worries, let\'s learn from this one.', 'Don\'t worry, you\'ll get it next time.', 'A mistake, but the game goes on!'],
    },
    blunder: {
      f: ['Oh no, careful!', 'Wait, that\'s a big mistake.', 'Uh oh, that\'s a blunder.', 'Ouch, that one costs a lot.', 'Hold on, look at this.', 'Careful! That\'s a serious slip.'],
      p: ['A blunder.', 'That is a serious error.', 'This move loses a lot.', 'A big mistake.', 'That changes the game.'],
      e: ['Oh no! It happens to everyone.', 'A big slip, but you can learn from it.', 'Careful! Let\'s see what went wrong.', 'Big mistake, but don\'t give up!', 'Ouch! Take a deep breath, and look again.'],
    },
  };
  // Openers for one phase (shared by all styles): they make a good move feel like part of the plan.
  const PHASE_OPENERS = {
    'excellent.opening': ['A great start!', 'Textbook opening play!'],
    'good.opening': ['Nice developing move!', 'Good opening play.', 'Getting your pieces out, good.'],
    'excellent.endgame': ['Great endgame technique!', 'That\'s how to play the endgame!'],
    'good.endgame': ['Good endgame thinking.', 'Steady in the endgame.'],
  };
  // Lines that open other kinds of comments.
  const LINES = {
    threat: ['Watch out!', 'Careful!', 'Look out!', 'Be careful here.', 'Heads up!', 'Danger!'],
    chance: ['Ooh, look closely!', 'There\'s a chance here!', 'Psst, look at this!', 'Something good is waiting!', 'Look carefully at the board!'],
    hint: ['Here\'s a clue.', 'Let me help.', 'Here\'s an idea.', 'Try this thought.', 'A little clue for you.'],
    mentor: ['Let\'s think together.', 'Here\'s what I see.', 'Let\'s make a plan.', 'Here\'s my advice.', 'Let me show you something.'],
    cheer: ['Keep going, you\'re doing great!', 'Every game makes you stronger.', 'Mistakes help us learn.', 'Take a breath, and look at the whole board.', 'You can do this!', 'Don\'t give up, chess is full of surprises!'],
    win: ['You won! What a game!', 'Victory! Well played!', 'You did it! Great game!', 'A win! Let\'s see how you did it.'],
    loss: ['Good fight! Let\'s see what we can learn.', 'Not this time, but you played some good moves.', 'Every loss teaches something. Let\'s look.', 'Tough game! Let\'s find the key moments.'],
    draw: ['A draw! A hard-fought game.', 'Nobody won this time. Let\'s look at it.', 'A draw: both sides held on.'],
    mate: ['Checkmate radar!', 'I see a checkmate!', 'Mate alert!'],
  };
  for (const g in OPENERS) for (const s in OPENERS[g]) OPENERS[g][s].forEach((t, i) => { EN['op.' + g + '.' + s + '.' + (i + 1)] = t; });
  for (const k in PHASE_OPENERS) PHASE_OPENERS[k].forEach((t, i) => { EN['opp.' + k + '.' + (i + 1)] = t; });
  for (const k in LINES) LINES[k].forEach((t, i) => { EN['ln.' + k + '.' + (i + 1)] = t; });

  const tr = (key, vars) => {
    const s = (strings && strings[key]) || EN[key];
    if (s === undefined) throw new Error('mentor: no string ' + key);
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined ? m : vars[k])) : s;
  };
  const NAME = [''].concat([1, 2, 3, 4, 5, 6].map((k) => C.NAME[k]));
  const PTS = [0, 1, 3, 3, 5, 9, 0];
  const sqn = (sq88) => 'abcdefgh'[sq88 & 7] + (1 + (sq88 >> 4));
  const sq88 = (name) => (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
  const on = (sq) => !(sq & 0x88);
  const fileOf = (sq) => sq & 7, rankOf = (sq) => sq >> 4;

  // ------------------------------------------------------------------ the Analyst: board facts
  function pieces(pos) {
    const out = [];
    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      const p = pos.b[sq];
      if (p) out.push({ sq, kind: Math.abs(p), side: Math.sign(p) });
    }
    return out;
  }
  const material = (ps, side) => ps.filter((p) => p.side === side).reduce((a, p) => a + PTS[p.kind], 0);
  const nonPawn = (ps, side) => ps.filter((p) => p.side === side && p.kind !== P && p.kind !== K).reduce((a, p) => a + PTS[p.kind], 0);
  const standard = (pos) => !pos.ch && !(pos.v && (pos.v.hill || pos.v.checks)) && !(pos.v && pos.v.c960);

  function phaseOf(pos, ps) {
    ps = ps || pieces(pos);
    const np = nonPawn(ps, WHITE) + nonPawn(ps, BLACK);
    if (np <= 26) return 'endgame';
    const home = (side) => {
      const r = side === WHITE ? 0 : 7;
      return [[1, N], [6, N], [2, B], [5, B]].filter(([f, k]) => pos.b[r * 16 + f] === k * side).length;
    };
    if (pos.full <= 12 && home(WHITE) + home(BLACK) >= 3) return 'opening';
    if (pos.full <= 8) return 'opening';
    return 'middlegame';
  }

  // Pawn structure for one side: isolated, doubled and passed pawns.
  function pawnInfo(pos, ps, side) {
    const mine = ps.filter((p) => p.side === side && p.kind === P), theirs = ps.filter((p) => p.side === -side && p.kind === P);
    const files = [0, 0, 0, 0, 0, 0, 0, 0];
    for (const p of mine) files[fileOf(p.sq)]++;
    const out = { isolated: [], doubled: [], passed: [], files };
    for (const p of mine) {
      const f = fileOf(p.sq), r = rankOf(p.sq);
      if (!(f > 0 && files[f - 1]) && !(f < 7 && files[f + 1])) out.isolated.push(p.sq);
      const ahead = theirs.some((t) => Math.abs(fileOf(t.sq) - f) <= 1 && (side === WHITE ? rankOf(t.sq) > r : rankOf(t.sq) < r));
      if (!ahead) out.passed.push(p.sq);
    }
    for (let f = 0; f < 8; f++) if (files[f] > 1) out.doubled.push(f);
    return out;
  }
  // Squares in the enemy half that our pawn guards and no enemy pawn can ever attack.
  function outposts(pos, ps, side) {
    const theirs = ps.filter((p) => p.side === -side && p.kind === P);
    const out = [];
    for (let f = 1; f <= 6; f++) {
      for (const r of side === WHITE ? [4, 5] : [3, 2]) {
        const sq = r * 16 + f;
        if (pos.b[sq] && Math.abs(pos.b[sq]) === P) continue;
        const guarded = C.attackers(pos, sq, side).some((a) => a.kind === P);
        if (!guarded) continue;
        const chased = theirs.some((t) => Math.abs(fileOf(t.sq) - f) === 1 && (side === WHITE ? rankOf(t.sq) > r : rankOf(t.sq) < r));
        if (!chased) out.push(sq);
      }
    }
    return out.sort((a, b) => Math.abs(fileOf(a) - 3.5) - Math.abs(fileOf(b) - 3.5));
  }
  function mobility(pos, sq) {
    const side = Math.sign(pos.b[sq]);
    return C.attacksFrom(pos, sq).filter((s) => (!pos.b[s] || Math.sign(pos.b[s]) !== side) && !C.attackers(pos, s, -side).some((a) => a.kind === P)).length;
  }
  function kingSafety(pos, ps, side, phase) {
    const k = pos.kings[side === WHITE ? 0 : 1], f = fileOf(k), r = rankOf(k), dir = side === WHITE ? 1 : -1;
    let shield = 0, open = 0;
    const files = pawnInfo(pos, ps, side).files;
    for (let df = -1; df <= 1; df++) {
      const ff = f + df; if (ff < 0 || ff > 7) continue;
      for (const dr of [1, 2]) { const s = (r + dr * dir) * 16 + ff; if (on(s) && pos.b[s] === P * side) { shield++; break; } }
      if (!files[ff]) open++;
    }
    const zone = [k].concat(E.KING_DIRS.map((d) => k + d).filter(on));
    const att = new Set();
    for (const s of zone) for (const a of C.attackers(pos, s, -side)) if (a.kind !== K) att.add(a.sq);
    const queens = ps.some((p) => p.side === -side && p.kind === Q);
    const home = r === (side === WHITE ? 0 : 7);
    const castled = home && (f >= 6 || f <= 2);
    const middle = phase !== 'endgame' && pos.full >= 10 && (f === 3 || f === 4) && home && queens;
    const why = [];
    if (phase !== 'endgame' && queens) {
      if (shield <= 1 && (castled || middle)) why.push('shield');
      if (open >= 2) why.push('openFile');
      if (att.size >= 3) why.push('attackers');
      if (middle) why.push('middle');
    }
    const rights = side === WHITE ? pos.castle & 3 : pos.castle & 12;
    return { sq: sqn(k), shield, open, attackers: att.size, castled, canCastle: !!rights, middle, exposed: why.length >= 2 || why.includes('attackers') || (why.includes('middle') && why.length >= 1), why };
  }
  // Pieces of `side` pinned by an enemy line piece.
  function pinsAgainst(pos, ps, side) {
    const out = [];
    if (pos.ch) return out;
    for (const e of ps.filter((p) => p.side === -side && (p.kind === B || p.kind === R || p.kind === Q))) {
      const dirs = e.kind === B ? E.BISHOP_DIRS : e.kind === R ? E.ROOK_DIRS : E.BISHOP_DIRS.concat(E.ROOK_DIRS);
      for (const d of dirs) {
        let s = e.sq + d, first = null;
        while (on(s)) {
          const p = pos.b[s];
          if (p) {
            if (Math.sign(p) !== side) break;
            if (!first) first = { sq: s, kind: Math.abs(p) };
            else {
              const k2 = Math.abs(p);
              if (first.kind !== K && first.kind !== P && (k2 === K || PTS[k2] > PTS[first.kind])) out.push({ sq: sqn(first.sq), kind: first.kind, behind: k2, by: sqn(e.sq), absolute: k2 === K });
              break;
            }
          }
          s += d;
        }
      }
    }
    return out;
  }
  // A piece of `side` that is the only guard of two attacked pieces.
  function overloaded(pos, ps, side) {
    const guards = new Map();
    for (const p of ps.filter((q) => q.side === side && q.kind !== K)) {
      if (!C.attackers(pos, p.sq, -side).length) continue;
      const def = C.attackers(pos, p.sq, side);
      if (def.length !== 1) continue;
      const g = def[0].sq;
      if (!guards.has(g)) guards.set(g, []);
      guards.get(g).push(p.sq);
    }
    const out = [];
    for (const [g, list] of guards) if (list.length >= 2) out.push({ sq: sqn(g), kind: Math.abs(pos.b[g]), guards: list.map(sqn) });
    return out;
  }
  // Everything a coach looks at in a position, for one side (the player).
  function assess(pos, side) {
    const ps = pieces(pos), phase = phaseOf(pos, ps), std = standard(pos);
    const me = side, you = -side;
    const mat = { me: material(ps, me), them: material(ps, you) };
    const pawns = { me: pawnInfo(pos, ps, me), them: pawnInfo(pos, ps, you) };
    const homeRank = me === WHITE ? 0 : 7;
    const undeveloped = std ? [[1, N], [6, N], [2, B], [5, B]].filter(([f, k]) => pos.b[homeRank * 16 + f] === k * me).map(([f, k]) => ({ sq: sqn(homeRank * 16 + f), kind: k })) : [];
    const queenSq = ps.find((p) => p.side === me && p.kind === Q);
    const queenEarly = std && phase === 'opening' && queenSq && queenSq.sq !== homeRank * 16 + 3 && undeveloped.length >= 2;
    const centre = ['d4', 'e4', 'd5', 'e5'].filter((s) => pos.b[sq88(s)] === P * me);
    const control = ['d4', 'e4', 'd5', 'e5'].reduce((a, s) => a + C.attackers(pos, sq88(s), me).length, 0);
    const pieceInfo = ps.filter((p) => p.side === me && (p.kind === N || p.kind === B || p.kind === R)).map((p) => ({ sq: sqn(p.sq), kind: p.kind, mob: mobility(pos, p.sq) }));
    const atHome = new Set(undeveloped.map((u) => u.sq));
    const passive = pieceInfo.filter((p) => !atHome.has(p.sq) && (p.kind === R ? p.mob <= 2 && phase !== 'opening' : p.mob <= 2)).sort((a, b) => a.mob - b.mob);
    const rim = pieceInfo.filter((p) => p.kind === N && (p.sq[0] === 'a' || p.sq[0] === 'h'));
    const allFiles = [0, 1, 2, 3, 4, 5, 6, 7];
    const openFiles = allFiles.filter((f) => !pawns.me.files[f] && !pawns.them.files[f]);
    const rooks = ps.filter((p) => p.side === me && p.kind === R);
    const rookOpen = rooks.filter((r) => openFiles.includes(fileOf(r.sq)) || !pawns.me.files[fileOf(r.sq)]).map((r) => sqn(r.sq));
    const badBishop = std ? ps.filter((p) => p.side === me && p.kind === B).filter((b) => {
      const colour = (fileOf(b.sq) + rankOf(b.sq)) & 1;
      const same = ps.filter((q) => q.side === me && q.kind === P && ((fileOf(q.sq) + rankOf(q.sq)) & 1) === colour).length;
      return same >= 4 && mobility(pos, b.sq) <= 3;
    }).map((b) => sqn(b.sq)) : [];
    return {
      side: me, phase, standard: std, full: pos.full,
      material: mat, diff: mat.me - mat.them, queens: ps.some((p) => p.kind === Q),
      bishopPair: { me: ps.filter((p) => p.side === me && p.kind === B).length >= 2, them: ps.filter((p) => p.side === you && p.kind === B).length >= 2 },
      undeveloped, queenEarly: !!queenEarly, centre, control,
      king: { me: kingSafety(pos, ps, me, phase), them: kingSafety(pos, ps, you, phase) },
      pieces: pieceInfo, passive, rim: rim.map((r) => r.sq), badBishop,
      openFiles: openFiles.map((f) => 'abcdefgh'[f]), rookOpen,
      pawns: { me: { isolated: pawns.me.isolated.map(sqn), doubled: pawns.me.doubled.map((f) => 'abcdefgh'[f]), passed: pawns.me.passed.map(sqn) },
        them: { isolated: pawns.them.isolated.map(sqn), doubled: pawns.them.doubled.map((f) => 'abcdefgh'[f]), passed: pawns.them.passed.map(sqn) } },
      outposts: phase === 'endgame' || !std ? [] : outposts(pos, ps, me).map(sqn),
      pins: { me: pinsAgainst(pos, ps, me), them: pinsAgainst(pos, ps, you) },
      overloaded: { me: overloaded(pos, ps, me), them: overloaded(pos, ps, you) },
      hanging: { me: C.hangingPieces(pos, me).map((h) => ({ sq: sqn(h.sq), kind: h.kind })), them: C.hangingPieces(pos, you).map((h) => ({ sq: sqn(h.sq), kind: h.kind })) },
      endgame: phase === 'endgame' && !pos.ch ? endgameFacts(pos, ps, me) : null,
    };
  }

  // Endgame knowledge: the type of ending and the rules of thumb that apply on this board.
  function endgameFacts(pos, ps, me) {
    const kinds = (side) => ps.filter((p) => p.side === side && p.kind !== K && p.kind !== P).map((p) => p.kind);
    const all = kinds(WHITE).concat(kinds(BLACK));
    const type = !all.length ? 'pawn' : all.every((k) => k === R) ? 'rook' : all.every((k) => k === Q) ? 'queen' : all.every((k) => k === B || k === N) ? 'minor' : 'mixed';
    const kingOf = (s) => pos.kings[s === WHITE ? 0 : 1];
    const dist = (a, b) => Math.max(Math.abs(fileOf(a) - fileOf(b)), Math.abs(rankOf(a) - rankOf(b)));
    const centreDist = (s) => Math.max(Math.abs(fileOf(s) - 3.5), Math.abs(rankOf(s) - 3.5));
    const out = { type, runs: [], caught: [], theirRuns: [], canCatch: [], opposition: 0, kingFar: false, rookBehind: true, oppBishops: false, wrongBishop: false, stalemateRisk: false, basicMate: null };
    // The rule of the square: can the defending king catch a passed pawn with only kings and pawns left?
    const square = (side) => {
      if (kinds(-side).length || kinds(side).length) return;
      for (const sq of pawnInfo(pos, ps, side).passed) {
        const r = rankOf(sq), f = fileOf(sq);
        let steps = side === WHITE ? 7 - r : r;
        if ((side === WHITE && r === 1) || (side === BLACK && r === 6)) steps--;   // the first double step
        const promo = (side === WHITE ? 7 : 0) * 16 + f;
        let kd = dist(kingOf(-side), promo);
        if (pos.side === -side) kd--;   // the defender moves first
        const blocked = ps.some((p) => fileOf(p.sq) === f && (side === WHITE ? rankOf(p.sq) > r : rankOf(p.sq) < r));
        if (blocked) continue;
        const ownKingAhead = ps.some((p) => p.kind === K && p.side === side && fileOf(p.sq) === f && (side === WHITE ? rankOf(p.sq) > r : rankOf(p.sq) < r));
        if (ownKingAhead) continue;
        (kd > steps ? (side === me ? out.runs : out.theirRuns) : (side === me ? out.caught : out.canCatch)).push(sqn(sq));
      }
    };
    square(me); square(-me);
    // The opposition: kings on one line with one square between; the side not to move has it.
    if (type === 'pawn') {
      const a = kingOf(WHITE), b = kingOf(BLACK);
      const df = Math.abs(fileOf(a) - fileOf(b)), dr = Math.abs(rankOf(a) - rankOf(b));
      if ((df === 0 && dr === 2) || (dr === 0 && df === 2)) out.opposition = pos.side === me ? -1 : 1;
    }
    out.kingFar = centreDist(kingOf(me)) >= 2.5 && centreDist(kingOf(-me)) < centreDist(kingOf(me)) && !(kinds(-me).includes(Q));
    // Rooks behind passed pawns.
    if (type === 'rook') {
      const rook = ps.find((p) => p.side === me && p.kind === R);
      const passers = pawnInfo(pos, ps, me).passed;
      if (rook && passers.length) out.rookBehind = passers.some((s) => fileOf(s) === fileOf(rook.sq) && (me === WHITE ? rankOf(rook.sq) < rankOf(s) : rankOf(rook.sq) > rankOf(s)));
    }
    // Opposite-coloured bishops.
    const bish = (side) => ps.filter((p) => p.side === side && p.kind === B);
    if (type === 'minor' && kinds(WHITE).length === 1 && kinds(BLACK).length === 1 && bish(WHITE).length === 1 && bish(BLACK).length === 1) {
      const c = (p) => (fileOf(p.sq) + rankOf(p.sq)) & 1;
      out.oppBishops = c(bish(WHITE)[0]) !== c(bish(BLACK)[0]);
    }
    // The wrong rook pawn: bishop and a- or h-pawn(s) against a king in the corner.
    for (const side of [WHITE, BLACK]) {
      const ks = kinds(side), pawns = ps.filter((p) => p.side === side && p.kind === P);
      if (ks.length === 1 && ks[0] === B && pawns.length && !kinds(-side).length && pawns.every((p) => fileOf(p.sq) === fileOf(pawns[0].sq) && (fileOf(p.sq) === 0 || fileOf(p.sq) === 7))) {
        const corner = (side === WHITE ? 7 : 0) * 16 + fileOf(pawns[0].sq);
        const bc = (fileOf(bish(side)[0].sq) + rankOf(bish(side)[0].sq)) & 1, cc = (fileOf(corner) + rankOf(corner)) & 1;
        if (bc !== cc && dist(kingOf(-side), corner) <= 1) out.wrongBishop = true;
      }
    }
    // Basic mates and the stalemate trap: the defender has only a king.
    const defender = ps.filter((p) => p.side === -me && p.kind !== K);
    if (!defender.length) {
      const mine = kinds(me);
      if (mine.includes(Q)) out.basicMate = 'Q'; else if (mine.includes(R)) out.basicMate = 'R';
      if (pos.side === -me && !pos.inCheck()) out.stalemateRisk = pos.legalMoves().length <= 1;
      else if (pos.side === me) {
        // after any of our quiet moves, could the bare king be left without a move? Flag when its room is tiny.
        const k = kingOf(-me);
        const free = E.KING_DIRS.map((d) => k + d).filter((s) => on(s) && !pos.b[s] && !pos.attacked(s, me)).length;
        out.stalemateRisk = free <= 1;
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ openings
  // Named opening lines (SAN from the start). The longest match names the opening.
  const BOOK = [
    ['King\'s Pawn Opening', 'e4'], ['Queen\'s Pawn Opening', 'd4'], ['English Opening', 'c4'], ['Réti Opening', 'Nf3'], ['Bird\'s Opening', 'f4'], ['Larsen\'s Opening', 'b3'], ['Polish Opening', 'b4'],
    ['Open Game', 'e4 e5'], ['King\'s Knight Opening', 'e4 e5 Nf3'], ['Italian Game', 'e4 e5 Nf3 Nc6 Bc4'], ['Giuoco Piano', 'e4 e5 Nf3 Nc6 Bc4 Bc5'],
    ['Evans Gambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4'], ['Two Knights Defence', 'e4 e5 Nf3 Nc6 Bc4 Nf6'], ['Fried Liver Attack', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7'],
    ['Ruy Lopez', 'e4 e5 Nf3 Nc6 Bb5'], ['Ruy Lopez, Morphy Defence', 'e4 e5 Nf3 Nc6 Bb5 a6'], ['Ruy Lopez, Berlin Defence', 'e4 e5 Nf3 Nc6 Bb5 Nf6'],
    ['Scotch Game', 'e4 e5 Nf3 Nc6 d4'], ['Four Knights Game', 'e4 e5 Nf3 Nc6 Nc3 Nf6'], ['Ponziani Opening', 'e4 e5 Nf3 Nc6 c3'], ['Petrov\'s Defence', 'e4 e5 Nf3 Nf6'],
    ['Philidor Defence', 'e4 e5 Nf3 d6'], ['Latvian Gambit', 'e4 e5 Nf3 f5'], ['Elephant Gambit', 'e4 e5 Nf3 d5'], ['King\'s Gambit', 'e4 e5 f4'], ['Vienna Game', 'e4 e5 Nc3'],
    ['Centre Game', 'e4 e5 d4 exd4 Qxd4'], ['Danish Gambit', 'e4 e5 d4 exd4 c3'], ['Bishop\'s Opening', 'e4 e5 Bc4'], ['Wayward Queen Attack', 'e4 e5 Qh5'],
    ['Sicilian Defence', 'e4 c5'], ['Open Sicilian', 'e4 c5 Nf3 d6 d4'], ['Sicilian Defence, Najdorf', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6'],
    ['Sicilian Defence, Dragon', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6'], ['Sicilian Defence, Alapin', 'e4 c5 c3'], ['Closed Sicilian', 'e4 c5 Nc3'], ['Smith-Morra Gambit', 'e4 c5 d4 cxd4 c3'],
    ['French Defence', 'e4 e6'], ['French Defence, Advance', 'e4 e6 d4 d5 e5'], ['French Defence, Exchange', 'e4 e6 d4 d5 exd5'], ['French Defence, Winawer', 'e4 e6 d4 d5 Nc3 Bb4'],
    ['Caro-Kann Defence', 'e4 c6'], ['Caro-Kann Defence, Advance', 'e4 c6 d4 d5 e5'], ['Scandinavian Defence', 'e4 d5'], ['Pirc Defence', 'e4 d6 d4 Nf6 Nc3 g6'],
    ['Modern Defence', 'e4 g6'], ['Alekhine\'s Defence', 'e4 Nf6'], ['Owen\'s Defence', 'e4 b6'], ['Nimzowitsch Defence', 'e4 Nc6'],
    ['Queen\'s Gambit', 'd4 d5 c4'], ['Queen\'s Gambit Declined', 'd4 d5 c4 e6'], ['Queen\'s Gambit Accepted', 'd4 d5 c4 dxc4'], ['Slav Defence', 'd4 d5 c4 c6'],
    ['London System', 'd4 d5 Bf4'], ['London System', 'd4 Nf6 Bf4'], ['London System', 'd4 d5 Nf3 Nf6 Bf4'], ['Colle System', 'd4 d5 Nf3 Nf6 e3'],
    ['Indian Defence', 'd4 Nf6'], ['King\'s Indian Defence', 'd4 Nf6 c4 g6 Nc3 Bg7'], ['Grünfeld Defence', 'd4 Nf6 c4 g6 Nc3 d5'], ['Nimzo-Indian Defence', 'd4 Nf6 c4 e6 Nc3 Bb4'],
    ['Queen\'s Indian Defence', 'd4 Nf6 c4 e6 Nf3 b6'], ['Bogo-Indian Defence', 'd4 Nf6 c4 e6 Nf3 Bb4+'], ['Catalan Opening', 'd4 Nf6 c4 e6 g3'], ['Benoni Defence', 'd4 Nf6 c4 c5'],
    ['Budapest Gambit', 'd4 Nf6 c4 e5'], ['Trompowsky Attack', 'd4 Nf6 Bg5'], ['Dutch Defence', 'd4 f5'], ['Englund Gambit', 'd4 e5'],
    ['English Opening, Symmetrical', 'c4 c5'], ['English Opening, Reversed Sicilian', 'c4 e5'],
  ].map(([name, line]) => ({ name, sans: line.split(' ') }));
  // Traps: the line, the side that falls into it, the move (ply) it is sprung on, and what to watch.
  const TRAPS = [
    { name: 'Fool\'s Mate', line: 'f3 e5 g4 Qh4#', victim: WHITE, idea: 'trap.fool' },
    { name: 'Fool\'s Mate', line: 'f4 e5 g4 Qh4#', victim: WHITE, idea: 'trap.fool' },
    { name: 'Scholar\'s Mate', line: 'e4 e5 Qh5 Nc6 Bc4 Nf6 Qxf7#', victim: BLACK, idea: 'trap.scholar' },
    { name: 'Scholar\'s Mate', line: 'e4 e5 Bc4 Nc6 Qh5 Nf6 Qxf7#', victim: BLACK, idea: 'trap.scholar' },
    { name: 'Legal\'s Mate', line: 'e4 e5 Nf3 d6 Bc4 Bg4 Nc3 g6 Nxe5 Bxd1 Bxf7+ Ke7 Nd5#', victim: BLACK, idea: 'trap.legal' },
    { name: 'the Fried Liver Attack', line: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7', victim: BLACK, idea: 'trap.fried' },
    { name: 'the Blackburne Shilling Trap', line: 'e4 e5 Nf3 Nc6 Bc4 Nd4 Nxe5 Qg5 Nxf7 Qxg2 Rf1 Qxe4+ Be2 Nf3#', victim: WHITE, idea: 'trap.shilling' },
    { name: 'the Englund Gambit Trap', line: 'd4 e5 dxe5 Nc6 Nf3 Qe7 Bf4 Qb4+ Bd2 Qxb2 Bc3 Bb4 Qd2 Bxc3 Qxc3 Qc1#', victim: WHITE, idea: 'trap.englund' },
    { name: 'the Elephant Trap', line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Nbd7 cxd5 exd5 Nxd5 Nxd5 Bxd8 Bb4+ Qd2 Bxd2+ Kxd2 Kxd8', victim: WHITE, idea: 'trap.elephant' },
    { name: 'Noah\'s Ark Trap', line: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 d6 d4 b5 Bb3 Nxd4 Nxd4 exd4 Qxd4 c5 Qd5 Be6 Qc6+ Bd7 Qd5 c4', victim: WHITE, idea: 'trap.noah' },
  ].map((t) => Object.assign(t, { sans: t.line.split(' ') }));
  Object.assign(EN, {
    'trap.fool': 'Moving the f- and g-pawns early opens a line straight to your king.',
    'trap.scholar': 'Their queen and bishop both aim at f7. Guard it, or block the queen.',
    'trap.legal': 'Taking the queen there walks into a knight and bishop mate.',
    'trap.fried': 'The knight on g5 and bishop on c4 both hit f7. Keep it covered.',
    'trap.shilling': 'Taking the e5 pawn lets their queen in. Watch g2 and f2.',
    'trap.englund': 'Their queen is going after your b2 pawn and back row.',
    'trap.elephant': 'Taking on d5 looks free, but the bishop check wins the piece back.',
    'trap.noah': 'Your bishop can get trapped by a wall of pawns on a6, b5 and c4.',
  });
  const stripSan = (s) => String(s).replace(/[+#!?]+$/, '');
  // The opening on the board: its name, whether the player left the book, and the usual next moves.
  function opening(sans) {
    const played = sans.map(stripSan);
    const follows = (o, n) => o.sans.length >= n && played.slice(0, n).every((x, i) => stripSan(o.sans[i]) === x);
    let best = null;
    for (const o of BOOK) if (o.sans.length <= played.length && follows(o, o.sans.length) && (!best || o.sans.length > best.sans.length)) best = o;
    const next = new Set();
    for (const o of BOOK) if (o.sans.length > played.length && follows(o, played.length)) next.add(o.sans[played.length]);
    const inBook = BOOK.some((o) => follows(o, played.length));
    // the last move left the book: the position before it still had book moves to choose from
    const left = !inBook && played.length > 0 && BOOK.some((o) => o.sans.length >= played.length && follows(o, played.length - 1));
    return { name: best ? best.name : null, depth: best ? best.sans.length : 0, inBook, left, next: Array.from(next).slice(0, 3) };
  }
  // A trap the given side is walking into: the game follows the trap line and the victim still has a move to make in it.
  function trapAhead(sans, side) {
    const played = sans.map(stripSan);
    for (const t of TRAPS) {
      if (t.victim !== side || played.length < 3 || played.length >= t.sans.length) continue;
      if (!played.every((s, i) => stripSan(t.sans[i]) === s)) continue;
      // the victim's next move in the line must still be ahead of us
      const victimMovesLeft = t.sans.slice(played.length).some((s, i) => ((played.length + i) % 2 === 0 ? WHITE : BLACK) === side);
      if (victimMovesLeft) return { name: t.name, idea: t.idea };
    }
    return null;
  }
  const RECOMMEND = {
    beginner: { w: 'Italian Game', b4: 'Open Game', b5: 'Queen\'s Gambit Declined' },
    intermediate: { w: 'Ruy Lopez', b4: 'Caro-Kann Defence', b5: 'Slav Defence' },
    advanced: { w: 'Catalan Opening', b4: 'Sicilian Defence, Najdorf', b5: 'King\'s Indian Defence' },
  };

  // ------------------------------------------------------------------ the Analyst: engine work (worker side)
  // Up to n best moves, each from its own search with the earlier ones left out.
  // Does this move win a variant game on the spot: king on the hill, third check, or their king bared?
  function goalOf(pos, m) {
    const side = pos.side;
    if (!pos.v.hill && !pos.v.checks && !pos.ch) return null;
    pos.make(m);
    let g = null;
    if (pos.legalMoves().length || !pos.inCheck()) {
      const vw = pos.variantWinner();
      if (vw === side) g = pos.v.hill ? 'hill' : 'checks';
      else if (pos.ch && pos.count(-side) === 0 && pos.bareWinner() === side) g = 'bare';
    }
    pos.unmake();
    return g;
  }
  function topMoves(pos, n, timeMs) {
    const out = [], exclude = [];
    const legal = pos.legalMoves();
    for (let i = 0; i < n && i < legal.length; i++) {
      const r = E.search(pos, { timeMs, quiesce: true, exclude: exclude.slice() });
      if (!r.move) break;
      exclude.push(E.uci(r.move));
      out.push({ uci: E.uci(r.move), san: pos.san(r.move, legal), cp: C.toCp(r.score), mate: C.mateIn(r.score), facts: C.facts(pos, r.move), goal: goalOf(pos, r.move) });
    }
    return out;
  }
  function pvLine(pos, plies, timeMs) {
    const out = [], made = [];
    for (let i = 0; i < plies; i++) {
      const legal = pos.legalMoves();
      if (!legal.length) break;
      const r = E.search(pos, { timeMs, quiesce: true });
      if (!r.move) break;
      out.push({ san: pos.san(r.move, legal), uci: E.uci(r.move), facts: C.facts(pos, r.move) });
      pos.make(r.move); made.push(r.move);
    }
    const end = { cp: 0, mate: 0, side: pos.side };
    if (pos.legalMoves().length) { const r = E.search(pos, { timeMs, quiesce: true }); end.cp = C.toCp(r.score); end.mate = C.mateIn(r.score); } else end.cp = pos.inCheck() ? -10000 : 0;
    for (let i = 0; i < made.length; i++) pos.unmake();
    return { moves: out, end };
  }
  // Is the side to move in zugzwang? It would rather pass: moving scores clearly below passing.
  function zugzwang(pos, timeMs) {
    if (pos.inCheck()) return false;
    const move = E.search(pos, { timeMs, quiesce: true });
    pos.makeNull();
    const pass = E.search(pos, { timeMs, quiesce: true });
    pos.unmakeNull();
    return C.toCp(move.score) < -C.toCp(pass.score) - 150 && Math.abs(C.toCp(move.score)) < 5000;
  }

  // Everything the coach needs about the move just played (the last of ucis). Runs in the worker.
  // o: { timeMs, alts (how many other moves), plies (how far ahead, 0 for none), pre (a look() at the
  // position before the move, made while the player was thinking, so only the new position is searched) }
  function study(startFen, ucis, o) {
    o = Object.assign({ timeMs: 220, alts: 3, plies: 4 }, o);
    const pos = E.positionFrom(startFen, ucis.slice(0, -1));
    const legal = pos.legalMoves();
    const m = pos.parseMove(ucis[ucis.length - 1], legal);
    if (m === null || m === undefined) throw new Error('study: illegal move');
    const side = pos.side;
    const sans = sanList(startFen, ucis);
    const pre = o.pre && o.pre.alts && o.pre.alts.length ? o.pre : null;
    const before = pre ? pre.assess : assess(pos, side);
    const threatBefore = pre ? pre.threat : C.threat(pos, { timeMs: Math.round(o.timeMs * 0.7) });
    const alts = pre ? pre.alts : topMoves(pos, o.alts, o.timeMs);
    const facts = C.facts(pos, m);
    const best = alts[0] || null;
    const isBest = !!best && best.uci === E.uci(m);
    const bestLine = best && !isBest && o.plies > 0 ? (() => { pos.make(pos.parseMove(best.uci)); const l = pvLine(pos, o.plies - 1, Math.round(o.timeMs * 0.6)); pos.unmake(); return l; })() : null;
    pos.make(m);
    const after = assess(pos, side);
    const replyLegal = pos.legalMoves();
    let post = { cp: replyLegal.length ? 0 : (pos.inCheck() ? -10000 : 0), mate: 0, best: null };
    if (replyLegal.length) { const r = E.search(pos, { timeMs: o.timeMs, quiesce: true }); post = { cp: C.toCp(r.score), mate: C.mateIn(r.score), best: r.move ? E.uci(r.move) : null, bestSan: r.move ? pos.san(r.move, replyLegal) : null }; }
    const refutation = post.best ? C.facts(pos, pos.parseMove(post.best, replyLegal)) : null;
    const line = o.plies > 0 ? pvLine(pos, o.plies, Math.round(o.timeMs * 0.6)) : null;
    pos.unmake();
    const cpBefore = best ? best.cp : 0, cpAfter = -post.cp;   // the mover's point of view
    const wpLoss = isBest ? 0 : Math.max(0, C.winProb(cpBefore) - C.winProb(cpAfter));
    let cls = C.classify(wpLoss, isBest, facts, cpAfter);
    // win chances can't tell a lost position from one that is mated now: a move that lets a mate in when
    // there was none (or a slower one) is a mistake at least, and a blunder when the mate is next move
    if (!isBest && post.mate > 0 && (!best || best.mate >= 0 || post.mate < -best.mate) && cls !== 'blunder') cls = post.mate === 1 ? 'blunder' : 'mistake';
    const onlyMove = isBest && alts.length > 1 && C.winProb(alts[0].cp) - C.winProb(alts[1].cp) >= 0.15;
    // a threat they had before the move, that is still there after it
    const ignored = threatBefore && threatBefore.serious && refutation && refutation.uci === threatBefore.facts.uci ? threatBefore.facts : null;
    return {
      ply: ucis.length - 1, side, san: facts.san, uci: E.uci(m), facts, phase: before.phase, before, after,
      alts, best, isBest, onlyMove, bestLine, line, refutation, threatBefore: threatBefore && threatBefore.serious ? threatBefore.facts : null, ignored,
      cpBefore, cpAfter, mateBefore: best ? best.mate : 0, mateAfter: -post.mate, wpLoss, cls,
      opening: standard(pos) && startFen === E.START_FEN ? opening(sans) : null,
    };
  }
  // A look at the position now, for hints, the mentor, threats, chances and the mate radar. Runs in the worker.
  function look(startFen, ucis, o) {
    o = Object.assign({ timeMs: 260, alts: 3, plies: 4 }, o);
    const pos = E.positionFrom(startFen, ucis);
    const side = pos.side;
    const legal = pos.legalMoves();
    if (!legal.length) return { over: true };
    const sans = sanList(startFen, ucis);
    const a = assess(pos, side);
    const alts = topMoves(pos, o.alts, o.timeMs);
    const threat = C.threat(pos, { timeMs: o.timeMs });
    let line = null;
    if (alts[0]) { pos.make(pos.parseMove(alts[0].uci)); line = pvLine(pos, o.plies - 1, Math.round(o.timeMs * 0.6)); pos.unmake(); }
    const zz = a.phase === 'endgame' ? zugzwang(pos, Math.round(o.timeMs * 0.6)) : false;
    const std = standard(pos) && startFen === E.START_FEN;
    return {
      side, phase: a.phase, assess: a, alts, threat: threat ? { facts: threat.facts, serious: threat.serious, mate: threat.mate } : null, line, zugzwang: zz,
      inCheck: pos.inCheck(), legalCount: legal.length, captures: legal.filter((m) => E.mFlags(m) & E.F_CAP).length,
      opening: std ? opening(sans) : null, trap: std ? trapAhead(sans, side) : null, full: pos.full,
      variantGoal: !!(pos.v.hill || pos.v.checks || pos.ch),
      mate: alts[0] && alts[0].mate > 0 && !(pos.v.hill || pos.v.checks) ? { n: alts[0].mate, line: [alts[0].san].concat(line ? line.moves.map((x) => x.san) : []).slice(0, alts[0].mate * 2 - 1), pattern: mateAlts(pos, alts[0], line) } : null,
      fen: pos.fen(),
    };
  }
  // Quick check of a move the player is about to make (mistake prevention). Runs in the worker.
  function check(startFen, ucis, uci, o) {
    o = Object.assign({ timeMs: 200 }, o);
    const pos = E.positionFrom(startFen, ucis);
    const legal = pos.legalMoves();
    const m = pos.parseMove(uci, legal);
    if (m === null || m === undefined) return null;
    const r0 = E.search(pos, { timeMs: o.timeMs, quiesce: true });
    const best = r0.move ? E.uci(r0.move) : null;
    if (best === uci) return { grade: 'excellent', ok: true };
    const facts = C.facts(pos, m);
    pos.make(m);
    const rl = pos.legalMoves();
    let post = { cp: rl.length ? 0 : (pos.inCheck() ? -10000 : 0), mate: 0 }, refutation = null;
    if (rl.length) { const r = E.search(pos, { timeMs: o.timeMs, quiesce: true }); post = { cp: C.toCp(r.score), mate: C.mateIn(r.score) }; if (r.move) refutation = C.facts(pos, r.move); }
    pos.unmake();
    const loss = Math.max(0, C.winProb(C.toCp(r0.score)) - C.winProb(-post.cp));
    const cls = C.classify(loss, false, facts, -post.cp);
    const g = gradeOf(cls, facts, false);
    return { grade: g, ok: g !== 'mistake' && g !== 'blunder', facts, refutation, mateAgainst: post.mate > 0 ? post.mate : 0, wpLoss: loss };
  }
  function sanList(startFen, ucis) {
    const p = E.positionFrom(startFen, []), out = [];
    for (const u of ucis) { const legal = p.legalMoves(); const m = p.parseMove(u, legal); out.push(p.san(m, legal)); p.make(m); }
    return out;
  }
  // Names the mating pattern at the end of a forced mate, by playing the line out.
  function mateAlts(pos, first, line) {
    const moves = [first.uci].concat(line ? line.moves.map((x) => x.uci) : []);
    let made = 0, pattern = null;
    for (const u of moves) {
      const m = pos.parseMove(u); if (m === null || m === undefined) break;
      pos.make(m); made++;
      if (!pos.legalMoves().length && pos.inCheck()) { pattern = matePattern(pos, m); break; }
    }
    for (let i = 0; i < made; i++) pos.unmake();
    return pattern;
  }
  // The position is checkmate; m was the mating move.
  function matePattern(pos, m) {
    const loser = pos.side, k = pos.kings[loser === WHITE ? 0 : 1];
    const to = (m >> 7) & 127, kind = Math.abs(pos.b[to]);
    const ring = E.KING_DIRS.map((d) => k + d).filter(on);
    const ownAround = ring.filter((s) => pos.b[s] && Math.sign(pos.b[s]) === loser).length;
    const back = rankOf(k) === (loser === WHITE ? 0 : 7);
    if (kind === N && ownAround >= ring.length - 1) return 'smothered';
    if ((kind === R || kind === Q) && back && rankOf(to) === rankOf(k)) {
      const fwd = loser === WHITE ? 16 : -16;
      const front = [-1, 0, 1].map((df) => k + fwd + df).filter(on);
      const own = front.filter((s) => pos.b[s] && Math.sign(pos.b[s]) === loser).length;
      if (own >= 2 && front.every((s) => (pos.b[s] && Math.sign(pos.b[s]) === loser) || pos.attacked(s, -loser))) return 'backRank';
    }
    if (kind === Q && (sqn(to) === 'f7' || sqn(to) === 'f2') && Math.max(Math.abs(fileOf(to) - fileOf(k)), Math.abs(rankOf(to) - rankOf(k))) === 1) return 'scholar';
    if (kind === Q && Math.max(Math.abs(fileOf(to) - fileOf(k)), Math.abs(rankOf(to) - rankOf(k))) === 1) return 'kiss';
    const heavy = pieces(pos).filter((p) => p.side === -loser && (p.kind === R || p.kind === Q));
    const edge = rankOf(k) === 0 || rankOf(k) === 7 || fileOf(k) === 0 || fileOf(k) === 7;
    if (edge && heavy.length >= 2) return 'ladder';
    return null;
  }

  // ------------------------------------------------------------------ the Coach: grades and words
  // Five grades, as the spec asks. A best move is Excellent only when it does something special
  // (a tactic, a win of material, the only good move); a plain best move is Good.
  function notable(f) {
    return !!(f && (f.mate || f.forks.length || f.pin || f.skewer || f.discovered.length || f.promotion || (f.capture && f.capture !== P && !f.hangs.some((h) => h.sq === f.to)) || f.attacks.length));
  }
  function gradeOf(cls, f, onlyMove) {
    if (cls === 'brilliant') return 'excellent';
    if (cls === 'best') return notable(f) || onlyMove ? 'excellent' : 'good';
    if (cls === 'excellent' || cls === 'good') return 'good';
    if (cls === 'inaccuracy') return 'inaccurate';
    return cls;   // mistake, blunder
  }
  const IMPORTANT = new Set(['excellent', 'inaccurate', 'mistake', 'blunder']);
  // Win chances in words, for the player.
  function evalWords(cp, mate) {
    if (mate > 0) return tr('ev.mateFor');
    if (mate < 0) return tr('ev.mateAgainst');
    const w = C.winProb(cp);
    return tr(w >= 0.9 ? 'ev.winning' : w >= 0.72 ? 'ev.better' : w >= 0.58 ? 'ev.edge' : w > 0.42 ? 'ev.equal' : w > 0.28 ? 'ev.worse' : w > 0.1 ? 'ev.clearlyWorse' : 'ev.losing');
  }
  function swingWords(before, after) {
    const d = C.winProb(after) - C.winProb(before);
    return tr(d <= -0.2 ? 'sw.drop' : d <= -0.05 ? 'sw.down' : d >= 0.05 ? 'sw.up' : 'sw.same');
  }
  // What kind of move it was, in plain chess ideas (used for reasons and hint directions).
  function idea(f, before, after) {
    if (!f) return 'quiet';
    if (f.mate) return 'mate';
    if (f.forks.length || f.pin || f.skewer || f.discovered.length) return 'tactic';
    if (f.capture && f.capture !== P) return 'win';
    if (f.promotion) return 'promote';
    if (f.castle) return 'castle';
    const was = before && before.hanging.me.find((h) => h.sq === f.from);
    if (was) return 'defend';
    if (before && before.standard && before.undeveloped.some((u) => u.sq === f.from)) return 'develop';
    if (f.piece === P && ['d4', 'e4', 'd5', 'e5', 'c4', 'c5'].includes(f.to) && before && before.phase === 'opening') return 'centre';
    if (f.piece === P && before && before.pawns.me.passed.includes(f.from)) return 'passer';
    if (f.piece === K && before && before.phase === 'endgame') return 'king';
    if (f.piece === R && after && after.rookOpen.includes(f.to) && !before.rookOpen.includes(f.from)) return 'rook';
    if (f.capture && before && before.diff >= 2) return 'trade';
    const mb = before && before.pieces.find((p) => p.sq === f.from), ma = after && after.pieces.find((p) => p.sq === f.to);
    if (mb && ma && ma.mob > mb.mob + 1) return 'improve';
    return 'quiet';
  }
  function reason(f, before, after) {
    const v = { san: f.san, piece: NAME[f.piece] };
    switch (idea(f, before, after)) {
      case 'develop': return tr('r.develops', v);
      case 'centre': return tr('r.centre', v);
      case 'castle': return tr('r.castles', v);
      case 'passer': return tr('r.passer', v);
      case 'king': return tr('r.kingUp', v);
      case 'trade': return tr('r.trade', v);
      case 'defend': return tr('r.defends', v);
      case 'rook': return tr('r.rookOpen', v);
      case 'improve': return tr('r.improves', v);
      default: return tr('r.quiet', v);
    }
  }
  const bitsOrNull = (f) => (f && !f.mate && !f.stalemate ? bits(f) : '');
  function bits(f) {
    // what a move does, without the move's name ("forks the rook and gives check")
    const d = C.describe(f);
    if (!d) return '';
    return d.slice(f.san.length).replace(/^[\s:\u2014-]+/, '').replace(/[.\u3002\u0964\u06d4]$/u, '');
  }
  // Picks one line from a group, avoiding the ones said lately. seen: an array of recent keys (kept by the caller).
  function pick(keys, seen, rand) {
    rand = rand || Math.random;
    const recent = new Set(seen || []);
    const fresh = keys.filter((k) => !recent.has(k));
    const pool = fresh.length ? fresh : keys;
    return pool[Math.floor(rand() * pool.length)];
  }
  function openerKey(grade, style, phase, seen, rand) {
    const s = style === 'professional' ? 'p' : style === 'encouraging' ? 'e' : 'f';
    let keys = OPENERS[grade][s].map((_, i) => 'op.' + grade + '.' + s + '.' + (i + 1));
    const ph = PHASE_OPENERS[grade + '.' + phase];
    if (ph && s !== 'p') keys = keys.concat(ph.map((_, i) => 'opp.' + grade + '.' + phase + '.' + (i + 1)));
    return pick(keys, seen, rand);
  }
  const lineKey = (group, seen, rand) => pick(LINES[group].map((_, i) => 'ln.' + group + '.' + (i + 1)), seen, rand);
  // The main sentence about a move, grounded in its facts (level 1).
  function shortWhy(st, grade) {
    const f = st.facts;
    if (grade === 'excellent' || grade === 'good') {
      const d = C.describe(f);
      if (d) return d;
      if (st.isBest && grade === 'excellent' && st.onlyMove) return tr('r.top');
      return reason(f, st.before, st.after);
    }
    // inaccurate, mistake, blunder: say what goes wrong, from the coach's explanation.
    const ply = { cls: st.cls === 'inaccuracy' && grade === 'inaccurate' ? 'inaccuracy' : st.cls, side: st.side, san: st.san, facts: f, refutation: st.refutation,
      bestSan: st.best ? st.best.san : null, bestFacts: st.best ? st.best.facts : null, mateAgainst: st.mateAfter < 0 ? -st.mateAfter : 0, missedMate: st.mateBefore > 0 && !st.isBest ? st.mateBefore : 0 };
    if (grade === 'inaccurate') return st.best ? (st.best.facts && bits(st.best.facts) ? tr('d.bestWhy', { san: st.best.san, bits: bits(st.best.facts) }) : tr('r.notBest', { san: st.best.san })) : tr('r.quiet', { san: st.san });
    return C.explain(ply);
  }
  // Feedback on a move, at depth 1, 2 or 3. Returns { grade, opener, text (level 1), more (level 2 adds), deep (level 3 adds), marks, arrows }.
  // ctx: { style, seen (recent line keys), rand }
  function feedback(st, ctx) {
    ctx = ctx || {};
    const grade = gradeOf(st.cls, st.facts, st.onlyMove);
    const opener = openerKey(grade, ctx.style, st.phase, ctx.seen, ctx.rand);
    const out = { grade, important: IMPORTANT.has(grade), opener, head: tr(opener), label: tr('g.' + grade), text: [shortWhy(st, grade)], more: [], deep: [], marks: [], arrows: [] };
    const f = st.facts;
    out.marks.push({ sq: f.to, color: grade === 'blunder' || grade === 'mistake' ? 'bad' : grade === 'inaccurate' ? 'warn' : 'good' });
    for (const t of f.forks) out.marks.push({ sq: t.sq, color: 'target' });
    if (f.pin) out.marks.push({ sq: f.pin.at, color: 'target' });
    // Level 2: the consequence and the opponent's next move.
    const r = st.refutation, bad = grade === 'mistake' || grade === 'blunder';
    if (r) {
      // a mistake's explanation already names the refutation; the others say what the opponent will do next
      const b = bitsOrNull(r);
      if (!bad) {
        if (r.mate) out.more.push(tr('th.mate', { san: r.san }));
        else if (b && (r.capture || r.forks.length || r.check || r.attacks.length || r.pin || r.skewer)) out.more.push(tr('n.theyThreat', { san: r.san, bits: b }));
        else out.more.push(tr('n.theyBest', { san: r.san }));
      }
      out.arrows.push({ from: r.from, to: r.to, color: 'them' });
    } else out.more.push(tr('n.noThreat'));
    if (st.ignored && grade !== 'blunder' && grade !== 'mistake') out.more.push(tr('t.ignored', { threat: C.describe(st.ignored) || st.ignored.san }));
    out.more.push(swingWords(st.cpBefore, st.cpAfter) + ' ' + evalWords(st.cpAfter, st.mateAfter));
    // Level 3: alternatives, what was missed, the likely line ahead.
    if (st.best && !st.isBest) {
      const bb = bitsOrNull(st.best.facts);
      if (st.mateBefore > 0 && !bad) out.deep.push(tr('d.missedMate', { n: st.mateBefore, san: st.best.san }));
      else if (grade === 'good') out.deep.push(tr('d.practical', { san: st.best.san }));
      void bb;
      out.arrows.push({ from: st.best.facts.from, to: st.best.facts.to, color: 'best' });
      if (grade !== 'good' && st.bestLine && st.bestLine.moves.length) out.deep.push(tr('d.line', { line: [st.best.san].concat(st.bestLine.moves.map((m) => m.san)).join(', ') }));
      if (bad && r && !r.mate) { const b2 = bitsOrNull(r); out.deep.push(b2 ? tr('d.theyReply', { san: r.san, bits: b2 }) : tr('d.theyReplyPlain', { san: r.san })); }
    }
    const others = (st.alts || []).filter((a) => a.uci !== st.uci && (!st.best || a.uci !== st.best.uci) && C.winProb(a.cp) >= C.winProb(st.best ? st.best.cp : 0) - 0.05);
    if (others.length) { const a = others[0], b = bitsOrNull(a.facts); out.deep.push(b ? tr('d.alt', { san: a.san, bits: b }) : tr('d.altPlain', { san: a.san })); }
    if (st.line && st.line.moves.length && (st.isBest || grade === 'good')) {
      out.deep.push(tr('d.line', { line: st.line.moves.map((m) => m.san).join(', ') }));
      const endCp = st.line.moves.length % 2 === 0 ? st.line.end.cp : -st.line.end.cp, endMate = st.line.moves.length % 2 === 0 ? st.line.end.mate : -st.line.end.mate;
      out.deep.push(tr('d.after', { eval: evalWords(endCp, endMate) }));
    }
    return out;
  }
  function feedbackText(fb, depth) {
    return [fb.head].concat(fb.text, depth >= 2 ? fb.more : [], depth >= 3 ? fb.deep : []).join(' ');
  }

  // Detailed analysis of one move: the chess logic behind it, section by section.
  function detail(st) {
    const f = st.facts, b = st.before, a = st.after, grade = gradeOf(st.cls, f, st.onlyMove);
    const S = [];
    const add = (h, lines) => { lines = lines.filter(Boolean); if (lines.length) S.push({ head: tr(h), lines }); };
    add('h.why', [shortWhy(st, grade)]);
    // tactics
    const tac = [];
    const d = C.describe(f); if (d && (f.forks.length || f.pin || f.skewer || f.discovered.length || f.mate || f.capture || f.check || f.attacks.length || f.promotion)) tac.push(d);
    if (st.mateBefore > 0 && !st.isBest && st.best) tac.push(tr('d.missedMate', { n: st.mateBefore, san: st.best.san }));
    else if (st.best && !st.isBest && notable(st.best.facts) && grade !== 'good') tac.push(tr('d.missed', { san: st.best.san, bits: bits(st.best.facts) || tr('op.win') }));
    if (!tac.length) tac.push(tr('t.none'));
    add('h.tactics', tac);
    // plan
    { const why = shortWhy(st, grade), r = reason(f, b, a); add('h.strategy', [r === why ? '' : r, st.phase ? tr('ph.' + st.phase) + ': ' + mentorLine(a, st.side) : '']); }
    // threats created or missed
    const thr = [];
    const newAttacks = f.attacks.filter((t) => !b.hanging.them.some((h) => h.sq === t.sq));
    if (newAttacks.length) thr.push(tr('t.created', { list: list(newAttacks.map((t) => onSq(t.kind, t.sq))) }));
    if (st.threatBefore) thr.push(st.ignored ? tr('t.ignored', { threat: C.describe(st.ignored) || st.ignored.san }) : tr('t.answered'));
    add('h.threats', thr);
    // material
    const mat = [];
    if (f.capture) mat.push(tr('m.won', { piece: NAME[f.capture] }));
    const r = st.refutation;
    if (r && r.capture && !r.mate && (grade === 'mistake' || grade === 'blunder' || grade === 'inaccurate')) mat.push(tr('m.lost', { what: C.describe(r) || r.san }));
    const diff = a.diff;
    mat.push(diff === 0 ? tr('m.even') : diff > 0 ? tr('m.up', { n: diff }) : tr('m.down', { n: -diff }));
    add('h.material', mat);
    // king safety
    const ks = [];
    if (!b.king.me.castled && a.king.me.castled) ks.push(tr('k.castledNow'));
    else if (b.king.me.canCastle && !a.king.me.canCastle && !a.king.me.castled) ks.push(tr('k.lostCastle'));
    if (a.king.me.exposed) ks.push(tr('k.yoursExposed', { why: list(a.king.me.why.map((w) => tr('k.' + w))) }));
    if (a.king.them.exposed) ks.push(tr('k.theirsExposed', { why: list(a.king.them.why.map((w) => tr('k.' + w))) }));
    if (!ks.length) ks.push(tr('k.safeBoth'));
    add('h.king', ks);
    // piece activity
    const act = [];
    const mb = b.pieces.find((p) => p.sq === f.from), ma = a.pieces.find((p) => p.sq === f.to);
    if (mb && ma && ma.mob !== mb.mob) act.push(tr(ma.mob > mb.mob ? 'a.mobilityUp' : 'a.mobilityDown', { piece: NAME[f.piece], n: ma.mob, m: mb.mob }));
    if (f.piece === N && a.rim.includes(f.to)) act.push(tr('a.rim'));
    if (a.badBishop.length && !b.badBishop.length) act.push(tr('a.badBishop', { sq: a.badBishop[0] }));
    if (f.piece === R && a.rookOpen.includes(f.to)) act.push(tr('a.open', { sq: f.to, file: f.to[0] }));
    else if (a.openFiles.length && !a.rookOpen.length && a.phase !== 'opening' && a.pieces.some((p) => p.kind === R)) act.push(tr('a.rookIdle', { file: a.openFiles[0] }));
    if (a.passive.length && a.phase !== 'opening') act.push(tr('a.passive', { piece: NAME[a.passive[0].kind], sq: a.passive[0].sq }));
    add('h.activity', act);
    // weaknesses
    const wk = [];
    for (const s of a.pawns.me.isolated) if (!b.pawns.me.isolated.includes(s) && !(f.piece === P && s !== f.to && !b.pawns.me.isolated.length)) wk.push(tr('w.isolated', { sq: s }));
    for (const fl of a.pawns.me.doubled) if (!b.pawns.me.doubled.includes(fl)) wk.push(tr('w.doubled', { file: fl }));
    for (const s of a.pawns.them.isolated) if (!b.pawns.them.isolated.includes(s)) wk.push(tr('w.theirIsolated', { sq: s }));
    for (const s of a.outposts) if (!b.outposts.includes(s)) { wk.push(tr('w.outpost', { sq: s })); break; }
    if (!wk.length) wk.push(tr('w.none'));
    add('h.weak', wk);
    // alternatives
    const alts = (st.alts || []).filter((x) => x.uci !== st.uci).slice(0, 2).map((x) => {
      const bb = bitsOrNull(x.facts), first = st.best && x.uci === st.best.uci;
      return (first ? (bb ? tr('d.bestWhy', { san: x.san, bits: bb }) : tr('d.bestWas', { san: x.san })) : bb ? tr('d.alt', { san: x.san, bits: bb }) : tr('d.altPlain', { san: x.san })) + ' ' + evalWords(x.cp, x.mate);
    });
    if (st.isBest) alts.unshift(tr('r.top'));
    add('h.alts', alts);
    // the opponent's best reply
    if (r) { const bb = bitsOrNull(r); add('h.reply', [r.mate ? tr('th.mate', { san: r.san }) : bb ? tr('d.theyReply', { san: r.san, bits: bb }) : tr('d.theyReplyPlain', { san: r.san })]); }
    // what the best move would have led to
    if (st.best && !st.isBest && st.bestLine) add('h.instead', [tr('d.line', { line: [st.best.san].concat(st.bestLine.moves.map((m) => m.san)).join(', ') }),
      tr('d.after', { eval: evalWords(st.bestLine.moves.length % 2 === 0 ? -st.bestLine.end.cp : st.bestLine.end.cp, st.bestLine.moves.length % 2 === 0 ? -st.bestLine.end.mate : st.bestLine.end.mate) })]);
    add('h.position', [swingWords(st.cpBefore, st.cpAfter), evalWords(st.cpAfter, st.mateAfter)]);
    return { grade, label: tr('g.' + grade), sections: S };
  }
  const onSq = (kind, sq) => C.tr('on', { piece: C.NAME[kind], sq });
  const list = (items) => items.length <= 1 ? items.join('') : items.slice(0, -1).join(', ') + ' ' + C.tr('and') + ' ' + items[items.length - 1];

  // ------------------------------------------------------------------ the Mentor
  // One sentence of advice for the phase the game is in, from the assessment.
  function mentorLine(a, side) {
    const tips = plans({ assess: a, side, phase: a.phase, opening: null, threat: null, alts: [] });
    return tips.length ? tips[0].text : tr('mg.balanced');
  }
  // The mentor's advice for the position now: a ranked list of { kind, text, marks }.
  // lk: the result of look() (or an object with assess and phase).
  function plans(lk) {
    const a = lk.assess, out = [];
    const add = (kind, text, marks, w) => out.push({ kind, text, marks: marks || [], w: w || 1 });
    // danger first: the attack and defence mentor
    if (lk.threat && lk.threat.serious) {
      const t = lk.threat.facts;
      if (lk.threat.mate > 0 || t.mate) add('defend', t.mate ? tr('th.mate', { san: t.san }) : tr('th.forced'), [{ sq: t.to, color: 'bad' }], 10);
      else if (t.forks.length) add('defend', tr('th.fork', { san: t.san, list: list(t.forks.map((x) => C.NAME[x.kind])) }), [{ sq: t.to, color: 'bad' }], 8);
      else if (t.discovered.length) add('defend', tr('th.discovered', { san: t.san }), [{ sq: t.from, color: 'bad' }], 7);
      else add('defend', C.describe(t) ? tr('n.theyThreat', { san: t.san, bits: bits(t) }) : tr('n.theyBest', { san: t.san }), [{ sq: t.to, color: 'bad' }], 6);
    }
    const threatTo = lk.threat && lk.threat.serious ? lk.threat.facts.to : null;
    for (const h of a.hanging.me.filter((x) => x.kind !== P && x.sq !== threatTo)) add('defend', h.kind === Q ? tr('th.queen') : tr('th.piece', { piece: NAME[h.kind], sq: h.sq }), [{ sq: h.sq, color: 'bad' }], h.kind === Q ? 9 : 5);
    for (const p of a.pins.me.slice(0, 1)) add('defend', tr('mg.pinned', { piece: NAME[p.kind], sq: p.sq, behind: NAME[p.behind] }), [{ sq: p.sq, color: 'warn' }], 4);
    for (const o of a.overloaded.me.slice(0, 1)) add('defend', tr('mg.myOverload', { piece: NAME[o.kind], sq: o.sq }), [{ sq: o.sq, color: 'warn' }], 3);
    if (a.king.me.exposed && a.phase !== 'endgame') add('defend', tr('mg.defend'), [{ sq: a.king.me.sq, color: 'warn' }], 4);
    // the phase
    if (a.phase === 'opening' && a.standard) {
      if (lk.trap) add('opening', tr('o.trap', { name: nm(lk.trap.name), idea: tr(lk.trap.idea) }), [], 7);
      if (a.queenEarly) add('opening', tr('o.queenEarly'), [], 3);
      if (a.undeveloped.length >= 2) add('opening', tr('o.developLeft', { n: a.undeveloped.length, list: list(a.undeveloped.map((u) => onSq(u.kind, u.sq))) }), a.undeveloped.map((u) => ({ sq: u.sq, color: 'idea' })), 3);
      if (!a.centre.length && a.full <= 6) add('opening', tr('o.centre'), ['d4', 'e4', 'd5', 'e5'].map((s) => ({ sq: s, color: 'idea' })), 2);
      if (!a.king.me.castled && a.king.me.canCastle && a.undeveloped.length <= 2) add('opening', tr('o.castle'), [{ sq: a.king.me.sq, color: 'idea' }], 3);
      if (a.king.me.castled && !a.undeveloped.length) add('opening', tr('o.castled'), [], 1);
      if (!out.some((o) => o.kind === 'opening')) add('opening', tr('o.good'), [], 1);
    } else if (a.phase === 'middlegame' || (a.phase === 'opening' && !a.standard)) {
      if (a.king.them.exposed) add('attack', tr('mg.attack'), [{ sq: a.king.them.sq, color: 'target' }], 4);
      for (const p of a.pins.them.slice(0, 1)) add('attack', tr('mg.pinThem', { piece: NAME[p.kind], sq: p.sq, behind: NAME[p.behind] }), [{ sq: p.sq, color: 'target' }], 4);
      for (const o of a.overloaded.them.slice(0, 1)) add('attack', tr('mg.overloaded', { piece: NAME[o.kind], sq: o.sq }), [{ sq: o.sq, color: 'target' }].concat(o.guards.map((g) => ({ sq: g, color: 'target' }))), 4);
      for (const s of a.pawns.me.passed.slice(0, 1)) add('plan', tr('mg.passer', { sq: s }), [{ sq: s, color: 'idea' }], 3);
      for (const s of a.pawns.them.passed.slice(0, 1)) add('defend', tr('mg.theirPasser', { sq: s }), [{ sq: s, color: 'warn' }], 3);
      if (a.diff >= 3) add('plan', tr('mg.trade'), [], 3); else if (a.diff <= -3) add('plan', tr('mg.behind'), [], 2);
      if (a.openFiles.length && !a.rookOpen.length && a.pieces.some((p) => p.kind === R)) add('plan', tr('mg.openFile', { file: a.openFiles[0] }), [], 2);
      if (a.outposts.length && a.pieces.some((p) => p.kind === N)) add('plan', tr('mg.outpost', { sq: a.outposts[0] }), [{ sq: a.outposts[0], color: 'idea' }], 2);
      for (const p of a.passive.slice(0, 1)) add('plan', tr('mg.passive', { piece: NAME[p.kind], sq: p.sq }), [{ sq: p.sq, color: 'idea' }], 2);
      for (const s of a.pawns.them.isolated.slice(0, 1)) add('plan', tr('mg.isolated', { sq: s }), [{ sq: s, color: 'target' }], 1);
      if (!out.length) add('plan', tr(a.centre.length ? 'mg.balanced' : 'mg.space'), [], 1);
    } else if (a.phase === 'endgame' && a.endgame) {
      const e = a.endgame;
      if (e.stalemateRisk && !lk.mate) add('endgame', tr('eg.stalemate'), [], 8);
      if (e.basicMate) add('endgame', tr(e.basicMate === 'Q' ? 'eg.mateQ' : 'eg.mateR'), [], 5);
      for (const s of e.runs) add('endgame', tr('eg.pawnRuns', { sq: s }), [{ sq: s, color: 'idea' }], 6);
      for (const s of e.theirRuns) add('defend', tr('eg.theirRuns', { sq: s }), [{ sq: s, color: 'bad' }], 6);
      for (const s of e.caught.slice(0, 1)) add('endgame', tr('eg.inSquare', { sq: s }), [{ sq: s, color: 'idea' }], 3);
      for (const s of e.canCatch.slice(0, 1)) add('endgame', tr('eg.catch', { sq: s }), [{ sq: s, color: 'target' }], 4);
      if (e.opposition) add('endgame', tr(e.opposition > 0 ? 'eg.oppositionYou' : 'eg.oppositionThem'), [], 3);
      if (lk.zugzwang) add('endgame', tr('eg.zugzwang'), [], 4);
      if (e.kingFar) add('endgame', tr('eg.king'), [{ sq: a.king.me.sq, color: 'idea' }], 3);
      if (!e.rookBehind) add('endgame', tr('eg.rookBehind'), [], 3);
      if (e.oppBishops) add('endgame', tr('eg.oppBishops'), [], 2);
      if (e.wrongBishop) add('endgame', tr('eg.wrongBishop'), [], 3);
      const best = lk.alts && lk.alts[0];
      if (best && Math.abs(best.cp) < 60 && !best.mate && Math.abs(a.diff) >= 3 && lk.depthOk !== false) add('endgame', tr('eg.fortress'), [], 2);
      if (best && best.cp >= 300 && !e.basicMate) add('endgame', tr('eg.convert'), [], 2);
      if (a.pawns.me.passed.length && !e.runs.length) add('endgame', tr('eg.promote'), [{ sq: a.pawns.me.passed[0], color: 'idea' }], 2);
      if (!out.some((o) => o.kind === 'endgame')) add('endgame', tr('eg.' + (e.type === 'mixed' ? 'king' : e.type)), [], 1);
    }
    return out.sort((x, y) => y.w - x.w);
  }
  // Guidance for the phase: the opening's name and next moves, or the endgame's type, plus the mentor's plans.
  function phaseGuide(lk, level) {
    const out = { phase: lk.phase, title: tr('ph.' + lk.phase), lines: [], marks: [] };
    if (lk.opening && lk.phase === 'opening') {
      const o = lk.opening;
      if (o.name) out.lines.push(tr('o.name', { name: nm(o.name) }));
      if (o.left && o.name) out.lines.push(tr('o.left', { name: nm(o.name) }));
      if (o.next.length && level !== 'beginner') out.lines.push(tr('o.next', { list: list(o.next) }));
      if (o.next.length && level === 'beginner' && o.inBook) out.lines.push(tr('o.next', { list: o.next[0] }));
    }
    if (lk.phase === 'endgame' && lk.enteredEndgame) out.lines.push(tr('eg.enter'));
    for (const p of plans(lk).slice(0, level === 'beginner' ? 2 : 3)) { out.lines.push(p.text); out.marks.push(...p.marks); }
    return out;
  }
  function recommendOpening(level, side) {
    const r = RECOMMEND[level] || RECOMMEND.beginner;
    return side === WHITE ? [tr('o.recWhite', { name: nm(r.w) })] : [tr('o.recBlack', { name: nm(r.b4) }) + ' (1.e4)', tr('o.recBlack', { name: nm(r.b5) }) + ' (1.d4)'];
  }
  // Threat detector: warnings only when they are real (the engine's threat search or a loose big piece).
  // seen: recent warning ids, so the same warning is not repeated move after move.
  function threats(lk, seen) {
    const a = lk.assess, out = [];
    const recent = new Set(seen || []);
    const add = (id, text, marks, w) => { if (!recent.has(id)) out.push({ id, text, marks, w }); };
    if (lk.threat && lk.threat.serious) {
      const t = lk.threat.facts;
      // the forced-mate warning has no one move to name, so it keeps one id (else it repeats every turn)
      if (lk.threat.mate > 0 || t.mate) add(t.mate ? 'mate:' + t.uci : 'mate:forced', t.mate ? tr('th.mate', { san: t.san }) : tr('th.forced'), [{ sq: t.to, color: 'bad' }], 10);
      else if (t.forks.length) add('fork:' + t.uci, tr('th.fork', { san: t.san, list: list(t.forks.map((x) => C.NAME[x.kind])) }), [{ sq: t.to, color: 'bad' }].concat(t.forks.map((x) => ({ sq: x.sq, color: 'warn' }))), 8);
      else if (t.discovered.length) add('disc:' + t.uci, tr('th.discovered', { san: t.san }), [{ sq: t.from, color: 'bad' }], 7);
      else if (t.capture === Q) add('queen:' + t.to, tr('th.queen'), [{ sq: t.to, color: 'bad' }], 9);
      else if (t.capture && t.capture !== P) add('piece:' + t.to, tr('th.piece', { piece: NAME[t.capture], sq: t.to }), [{ sq: t.to, color: 'bad' }], 6);
      else if (t.capture === P) add('pawn:' + t.to, tr('th.pawn', { sq: t.to }), [{ sq: t.to, color: 'warn' }], 2);
    }
    for (const p of a.pins.me.filter((x) => x.absolute || x.behind === Q)) add('pin:' + p.sq + p.by, tr('th.pinned', { piece: NAME[p.kind], sq: p.sq }), [{ sq: p.sq, color: 'warn' }, { sq: p.by, color: 'bad' }], 4);
    for (const o of a.overloaded.me) if (lk.threat && lk.threat.serious) add('over:' + o.sq, tr('th.overload', { piece: NAME[o.kind], sq: o.sq }), [{ sq: o.sq, color: 'warn' }], 3);
    if (a.king.me.exposed && a.phase !== 'endgame' && a.king.me.attackers >= 3) add('king:' + a.full, tr('th.king'), [{ sq: a.king.me.sq, color: 'warn' }], 3);
    return out.sort((x, y) => y.w - x.w);
  }
  // Opportunity detector: chances the engine confirms. A tactic whose score does not hold up is "risky".
  function chances(lk) {
    const out = [];
    const best = lk.alts && lk.alts[0];
    if (!best) return out;
    const second = lk.alts[1];
    const f = best.facts;
    const gain = second ? C.winProb(best.cp) - C.winProb(second.cp) : 0;
    const real = best.mate > 0 || best.cp >= 150 || gain >= 0.1;
    const add = (id, text, marks) => out.push({ id, text, marks, real });
    if (best.mate > 0) { add('mate', best.mate === 1 ? tr('op.mate1') : tr('op.mate', { n: best.mate }), [{ sq: f.to, color: 'idea' }]); return out; }
    if (!real) {
      if (f.sacrifice || ((f.forks.length || f.pin || f.skewer) && f.hangs.length)) out.push({ id: 'risky', text: tr('op.risky'), marks: [], real: false });
      return out;
    }
    if (f.forks.length) add('fork', tr('op.fork'), f.forks.map((t) => ({ sq: t.sq, color: 'target' })));
    else if (f.pin) add('pin', tr('op.pin'), [{ sq: f.pin.at, color: 'target' }]);
    else if (f.skewer) add('skewer', tr('op.skewer'), [{ sq: f.skewer.at, color: 'target' }]);
    else if (f.discovered.length) add('discovered', tr('op.discovered'), [{ sq: f.discovered[0].at, color: 'target' }]);
    else if (f.promotion) add('promote', tr('op.promote'), [{ sq: f.to, color: 'idea' }]);
    else if (f.capture && f.capture !== P && lk.assess.hanging.them.some((h) => h.sq === f.to)) add('free', tr('op.free', { piece: NAME[f.capture], sq: f.to }), [{ sq: f.to, color: 'target' }]);
    else if (f.capture && lk.assess.diff >= 3 && lk.assess.phase !== 'opening' && best.cp >= 300) add('simplify', tr('op.simplify'), []);
    else if (f.capture || f.attacks.length) add('win', tr('op.win'), []);
    return out;
  }
  // Checkmate radar: mates for the player, and mates the opponent threatens.
  function mateRadar(lk) {
    const out = { mine: null, theirs: null };
    if (lk.mate) out.mine = { n: lk.mate.n, line: lk.mate.line, pattern: lk.mate.pattern, text: (lk.mate.n === 1 ? tr('op.mate1') : tr('op.mate', { n: lk.mate.n })) + ' ' + tr('mr.line', { line: lk.mate.line.join(', ') }) + (lk.mate.pattern ? ' ' + tr('mr.pattern', { name: tr('mr.' + lk.mate.pattern) }) + ' ' + tr('mr.' + lk.mate.pattern + 'Why') : '') };
    if (lk.threat && (lk.threat.mate > 0 || lk.threat.facts.mate)) out.theirs = { san: lk.threat.facts.san, text: lk.threat.facts.mate ? tr('th.mate', { san: lk.threat.facts.san }) : tr('th.forced') };
    out.text = out.mine ? out.mine.text : out.theirs ? out.theirs.text : tr('mr.none');
    return out;
  }
  // Mistake prevention: the warning shown before a move the engine says is a mistake or blunder.
  function warning(ck) {
    if (!ck || ck.ok) return null;
    const r = ck.refutation;
    let why;
    if (r && r.mate) why = tr('th.mate', { san: r.san });
    else if (ck.mateAgainst) why = tr('th.forced');
    else {
      const ply = { cls: ck.grade, side: ck.facts.side, san: ck.facts.san, facts: ck.facts, refutation: r, bestSan: null, bestFacts: null, mateAgainst: ck.mateAgainst, missedMate: 0 };
      why = C.explain(ply);
    }
    return { title: tr('pv.sure'), text: why, play: tr('pv.play'), think: tr('pv.think'), marks: r ? [{ sq: r.to, color: 'bad' }] : [], arrows: r ? [{ from: r.from, to: r.to, color: 'them' }] : [] };
  }
  // Hints in three levels. Level 1 points a direction, level 2 names the piece and idea, level 3 gives the move and why.
  function hints(lk) {
    const best = lk.alts && lk.alts[0];
    if (!best) return null;
    const f = best.facts, a = lk.assess;
    const kind = idea(f, a, null);
    let dir;
    if (best.goal) dir = tr('hi.dirGoal');
    else if (f.mate || (best.mate > 0 && !lk.variantGoal)) dir = tr('hi.dirMate');
    else if (best.mate > 0) dir = tr('hi.dirForce');
    else if (kind === 'tactic') dir = tr('hi.dirTactic');
    else if (kind === 'win') dir = tr('hi.dirWin');
    else if (kind === 'defend' || (a.hanging.me.length && a.hanging.me.some((h) => h.sq === f.from))) dir = tr('hi.dirDefend');
    else dir = tr({ develop: 'hi.dirDevelop', castle: 'hi.dirCastle', centre: 'hi.dirCentre', passer: 'hi.dirPasser', promote: 'hi.dirPasser', king: 'hi.dirKing', rook: 'hi.dirRook', trade: 'hi.dirTrade' }[kind] || 'hi.dirImprove');
    const ideaKey = best.goal ? 'goal' : f.mate ? 'mate' : f.forks.length ? 'fork' : f.pin ? 'pin' : f.skewer ? 'skewer' : f.discovered.length ? 'discovered' : f.promotion ? 'promote' : f.capture && f.capture !== P ? 'capture' : f.check ? 'check'
      : kind === 'defend' ? 'safety' : kind === 'develop' ? 'develop' : kind === 'centre' ? 'centre' : null;
    const piece = onSq(f.piece, f.from);
    const guided = (ideaKey ? tr('hi.guidedIdea', { piece, idea: tr('hi.idea.' + ideaKey) }) : tr('hi.guided', { piece })) + (ideaKey === 'develop' || ideaKey === 'centre' || !ideaKey ? ' ' + tr('hi.toward', { sq: regionOf(f.to) }) : '');
    const d = C.describe(f);
    const exact = tr('hi.exactFrom', { piece: C.NAME[f.piece], from: f.from, to: f.to, san: best.san }) + ' ' + (best.goal ? tr({ hill: 'hi.wins.hill', checks: 'hi.wins.checks', bare: 'hi.wins.bare' }[best.goal]) : (d || reason(f, a, null)) + (lk.line && lk.line.moves[0] && !/#$/.test(lk.line.moves[0].san) && !(best.mate < 0) ? ' ' + tr('hi.reply', { san: lk.line.moves[0].san }) : ''));
    return {
      levels: [
        { text: dir, marks: [] },
        { text: guided, marks: [{ sq: f.from, color: 'idea' }] },
        { text: exact, marks: [{ sq: f.from, color: 'idea' }, { sq: f.to, color: 'idea' }], arrows: [{ from: f.from, to: f.to, color: 'best' }] },
      ],
      san: best.san, from: f.from, to: f.to,
    };
  }
  // A square's area, for a level-2 hint that does not give the square away ("toward the centre" style).
  function regionOf(sq) {
    const f = sq.charCodeAt(0) - 97, r = +sq[1] - 1;
    const file = f <= 2 ? 'a-c' : f >= 5 ? 'f-h' : 'd-e';
    void r;
    return { 'a-c': tr('rg.queenside'), 'f-h': tr('rg.kingside'), 'd-e': tr('rg.centre') }[file];
  }
  Object.assign(EN, { 'rg.queenside': 'the queenside', 'rg.kingside': 'the kingside', 'rg.centre': 'the centre' });
  // Think 2 to 4 moves ahead: the likely line, move by move, with what each move does, and whether it is safe.
  function thinkAhead(lk) {
    const best = lk.alts && lk.alts[0];
    if (!best) return null;
    const steps = [];
    const moves = [{ san: best.san, facts: best.facts }].concat(lk.line ? lk.line.moves : []);
    moves.slice(0, 4).forEach((m, i) => {
      const who = i % 2 === 0 ? (i === 0 ? 'ta.you' : 'ta.youThen') : 'ta.them';
      const b = bitsOrNull(m.facts);
      steps.push({ san: m.san, mine: i % 2 === 0, text: tr(who, { san: m.san }) + (b ? ' ' + tr('ta.does', { san: m.san, bits: b }) : ''), from: m.facts.from, to: m.facts.to });
    });
    const out = { intro: tr('ta.intro'), steps, notes: [] };
    if (lk.alts[1] && C.winProb(best.cp) - C.winProb(lk.alts[1].cp) >= 0.15 && notable(best.facts)) out.notes.push(tr('ta.combo'));
    // safety: does the line end in a worse spot than now?
    if (lk.line && lk.line.end) {
      const n = moves.length - 1;
      const endCp = n % 2 === 0 ? -lk.line.end.cp : lk.line.end.cp;
      out.notes.push(C.winProb(endCp) >= C.winProb(best.cp) - 0.08 ? tr('ta.safe') : tr('ta.unsafe', { san: moves[Math.min(n, 3)].san }));
    }
    if (lk.threat && lk.threat.serious) out.notes.push(tr('ta.counter', { san: lk.threat.facts.san }));
    out.notes.push(tr('ta.ask'));
    out.notes.push(tr('ta.yourTurn'));
    return out;
  }
  // A line the player tried on the practice board: each step's verdict, so they see where it goes wrong.
  function checkLine(startFen, ucis, line, o) {
    o = Object.assign({ timeMs: 160 }, o);
    const pos = E.positionFrom(startFen, ucis);
    const me = pos.side, out = [];
    let made = 0;
    let prev = E.search(pos, { timeMs: o.timeMs, quiesce: true });
    for (const u of line) {
      const legal = pos.legalMoves();
      const m = pos.parseMove(u, legal);
      if (m === null || m === undefined) break;
      const f = C.facts(pos, m), mover = pos.side, best = prev.move ? E.uci(prev.move) : null;
      pos.make(m); made++;
      const rl = pos.legalMoves();
      const r = rl.length ? E.search(pos, { timeMs: o.timeMs, quiesce: true }) : { score: pos.inCheck() ? -MATE : 0, move: 0 };
      const before = C.toCp(prev.score), after = -C.toCp(r.score);
      const loss = best === u ? 0 : Math.max(0, C.winProb(before) - C.winProb(after));
      const cls = C.classify(loss, best === u, f, after);
      out.push({ san: f.san, mine: mover === me, grade: gradeOf(cls, f, false), cp: mover === me ? after : -after, text: C.describe(f) });
      prev = r;
    }
    for (let i = 0; i < made; i++) pos.unmake();
    return out;
  }

  // ------------------------------------------------------------------ after the game
  // Phase of each ply of a reviewed game, from its positions.
  function phases(startFen, ucis) {
    const p = E.positionFrom(startFen, []), out = [];
    for (const u of ucis) { out.push(phaseOf(p)); p.make(p.parseMove(u)); }
    return out;
  }
  // The post-game report for one side, from coach.review(): summary, breakdown, the coach's words, practice.
  // meta: { result: '1-0' | '0-1' | '1/2-1/2', side, times (ms per own move, optional), level }
  function report(rv, startFen, ucis, meta) {
    const side = meta.side, ph = phases(startFen, ucis);
    const mine = rv.plies.map((p, i) => Object.assign({ i, phase: ph[i] }, p)).filter((p) => p.side === side);
    const graded = mine.map((p) => Object.assign(p, { grade: gradeOf(p.cls, p.facts, false) }));
    const counts = { excellent: 0, good: 0, inaccurate: 0, mistake: 0, blunder: 0 };
    for (const p of graded) counts[p.grade]++;
    const acc = (list) => (list.length ? Math.round(list.reduce((s, p) => s + p.accuracy, 0) / list.length) : null);
    const resultKey = meta.result === '1/2-1/2' ? 'draw' : (meta.result === '1-0') === (side === WHITE) ? 'win' : 'loss';
    const strongest = graded.filter((p) => p.grade === 'excellent').sort((x, y) => (notable(y.facts) ? 1 : 0) - (notable(x.facts) ? 1 : 0))[0] || null;
    const worst = graded.slice().sort((x, y) => y.wpLoss - x.wpLoss)[0];
    const biggest = worst && worst.wpLoss >= 0.05 ? worst : null;
    const missed = graded.filter((p) => !p.isBest && p.bestFacts && notable(p.bestFacts) && p.wpLoss >= 0.05).sort((x, y) => y.wpLoss - x.wpLoss)[0] || null;
    // what went wrong, by kind, from the refutations of the player's mistakes and blunders
    const bad = graded.filter((p) => p.grade === 'mistake' || p.grade === 'blunder');
    const kinds = { hanging: 0, forks: 0, mate: 0, missed: 0 };
    for (const p of bad) {
      const r = p.refutation;
      if (r && r.mate || p.mateAgainst) kinds.mate++;
      else if (r && r.forks.length) kinds.forks++;
      else if (r && r.capture) kinds.hanging++;
      if (p.missedMate || (p.bestFacts && notable(p.bestFacts))) kinds.missed++;
    }
    // opening facts from the actual positions
    const op = openingHabits(startFen, ucis, side);
    const phaseAcc = { opening: acc(graded.filter((p) => p.phase === 'opening')), middlegame: acc(graded.filter((p) => p.phase === 'middlegame')), endgame: acc(graded.filter((p) => p.phase === 'endgame')) };
    const tacticsFound = graded.filter((p) => p.isBest && notable(p.facts)).length, tacticsMissed = graded.filter((p) => !p.isBest && p.bestFacts && notable(p.bestFacts) && p.wpLoss >= 0.05).length;
    const rate = (score) => (score === null ? 'na' : score >= 85 ? 'strong' : score >= 65 ? 'solid' : 'work');
    const cat = (id, r, extra) => ({ id, name: tr('rp.cat.' + id), what: tr('rp.cat.' + id + '.text'), rating: r, ratingText: tr('rp.' + r), note: extra || '' });
    const breakdown = [
      cat('opening', rate(phaseAcc.opening === null ? null : phaseAcc.opening - (op.lateCastle ? 10 : 0) - (op.queenEarly ? 10 : 0) - (op.slow ? 10 : 0))),
      cat('middlegame', rate(phaseAcc.middlegame)),
      cat('endgame', rate(phaseAcc.endgame)),
      cat('tactics', tacticsFound + tacticsMissed === 0 ? 'na' : rate(Math.round(100 * tacticsFound / (tacticsFound + tacticsMissed)))),
      cat('defence', rate(bad.length ? Math.max(0, 100 - 25 * (kinds.hanging + kinds.forks + 2 * kinds.mate)) : 95)),
      cat('decisions', rate(Math.max(0, (acc(graded) || 0) - 5 * counts.inaccurate))),
    ];
    // the coach's words
    const well = [];
    if (tacticsFound >= 2) well.push(tr('rp.well.tactics'));
    if (!op.queenEarly && !op.slow && !op.lateCastle && phaseAcc.opening !== null && phaseAcc.opening >= 80) well.push(tr('rp.well.opening'));
    if (!counts.blunder && !counts.mistake && graded.length >= 5) well.push(tr('rp.well.clean'));
    if (phaseAcc.endgame !== null && phaseAcc.endgame >= 85) well.push(tr('rp.well.end'));
    if (!well.length) well.push(tr('rp.well.fight'));
    const struggle = [];
    if (kinds.hanging) struggle.push(tr('rp.struggle.hanging'));
    if (kinds.forks) struggle.push(tr('rp.struggle.forks'));
    if (kinds.mate) struggle.push(tr('rp.struggle.mate'));
    if (kinds.missed) struggle.push(tr('rp.struggle.missed'));
    if (op.slow || op.queenEarly) struggle.push(tr('rp.struggle.opening'));
    if (op.lateCastle) struggle.push(tr('rp.struggle.king'));
    if (phaseAcc.endgame !== null && phaseAcc.endgame < 65) struggle.push(tr('rp.struggle.end'));
    const startBlack = E.positionFrom(startFen, []).side === BLACK;
    const moveNo = (p) => Math.floor((p.i + (startBlack ? 1 : 0)) / 2) + E.positionFrom(startFen, []).full;
    const changed = biggest ? [tr('rp.changed', { n: moveNo(biggest), san: biggest.san }), biggest.bestSan ? tr('rp.instead', { best: biggest.bestSan }) : ''].filter(Boolean) : [];
    const wasWinning = graded.some((p) => p.cpAfter * side >= 300) && resultKey !== 'win';
    const recs = practice({ kinds, op, phaseAcc, counts, mine: graded, timeTrouble: !!meta.timeTrouble, wasWinning });
    const focus = recs.length ? tr('rp.focus', { what: recs[0].text }) : '';
    return {
      result: resultKey, resultText: tr('rp.' + resultKey), accuracy: acc(graded), accuracyText: acc(graded) === null ? '' : tr('rp.accuracy', { n: acc(graded) }),
      counts, phaseAcc, labels: { excellent: tr('g.excellent'), good: tr('g.good'), inaccurate: tr('g.inaccurate'), mistake: tr('g.mistake'), blunder: tr('g.blunder') },
      strongest: strongest ? { i: strongest.i, san: strongest.san, text: tr('rp.best', { san: strongest.san }) } : null,
      biggest: biggest ? { i: biggest.i, san: biggest.san, best: biggest.bestSan, text: tr('rp.worst', { san: biggest.san }) } : null,
      missed: missed ? { i: missed.i, san: missed.bestSan, played: missed.san, text: tr('rp.missed', { san: missed.bestSan, played: missed.san }) } : null,
      breakdown, well, struggle, changed, focus, recs,
      stats: { kinds, op, tacticsFound, tacticsMissed, moves: graded.length },
    };
  }
  // Opening habits from a game: early queen, slow development, late or no castling.
  function openingHabits(startFen, ucis, side) {
    const out = { queenEarly: false, slow: false, lateCastle: false, castledAt: 0, developedAt: 0 };
    if (startFen !== E.START_FEN) return out;
    const p = E.positionFrom(startFen, []);
    let myMoves = 0, minorsOut = 0;
    for (const u of ucis) {
      const m = p.parseMove(u);
      const mover = p.side, kind = Math.abs(p.b[m & 127]);
      p.make(m);
      if (mover !== side) continue;
      myMoves++;
      const a = assess(p, side);
      if (kind === Q && myMoves <= 6 && a.undeveloped.length >= 3) out.queenEarly = true;
      if (!out.developedAt && a.undeveloped.length === 0) out.developedAt = myMoves;
      if (!out.castledAt && a.king.me.castled) out.castledAt = myMoves;
      minorsOut = 4 - a.undeveloped.length;
      if (myMoves >= 16) break;
    }
    out.slow = myMoves >= 10 && (!out.developedAt || out.developedAt > 10) && minorsOut < 3;
    out.lateCastle = myMoves >= 12 && (!out.castledAt || out.castledAt > 12);
    return out;
  }
  // Practice picks for this game: 2 or 3, from what actually happened. Each points at a lesson or puzzle theme.
  function practice(g) {
    const out = [];
    const add = (id, text, lesson, theme) => { if (!out.some((o) => o.id === id)) out.push({ id, text: tr(text), lesson: lesson || null, theme: theme || null }); };
    const k = g.kinds || {};
    if (k.mate) add('mate', 'pr.mate', 'lesson.c04.l06.mates', 'mateIn1');
    if (k.forks) add('forks', 'pr.forks', 'lesson.c05.l06.forks-defence', 'fork');
    if (k.hanging) add('hanging', 'pr.hanging', 'lesson.c04.l05.hanging', 'hangingPiece');
    if (k.missed) {
      const kinds = (g.mine || []).filter((p) => !p.isBest && p.bestFacts && notable(p.bestFacts) && p.wpLoss >= 0.05).map((p) => p.bestFacts);
      if (kinds.some((f) => f.mate)) add('mate2', 'pr.mate2', 'lesson.c04.l06.mates', 'mateIn2');
      else if (kinds.some((f) => f.forks.length)) add('forks', 'pr.forks', 'lesson.c04.l01.forks', 'fork');
      else if (kinds.some((f) => f.pin)) add('pins', 'pr.pins', 'lesson.c04.l02.pins', 'pin');
      else if (kinds.some((f) => f.skewer)) add('skewers', 'pr.skewers', 'lesson.c04.l03.skewers', 'skewer');
      else add('hanging', 'pr.hanging', 'lesson.c04.l05.hanging', 'hangingPiece');
    }
    if (g.op && g.op.queenEarly) add('queen', 'pr.queen', 'lesson.c03.l05.queen-early');
    if (g.op && g.op.slow) add('develop', 'pr.develop', 'lesson.c03.l02.develop');
    if (g.op && g.op.lateCastle) add('castle', 'pr.castle', 'lesson.c03.l03.king-safety');
    if (g.phaseAcc && g.phaseAcc.endgame !== null && g.phaseAcc.endgame < 70) {
      const rookEnd = (g.mine || []).some((p) => p.phase === 'endgame' && p.facts && p.facts.piece === R);
      add(rookEnd ? 'rookEnd' : 'pawnEnd', rookEnd ? 'pr.rookEnd' : 'pr.pawnEnd', rookEnd ? 'lesson.c08.l05.rook-behind' : 'lesson.c08.l04.kp-vs-k');
    }
    if (g.counts && g.counts.blunder >= 2) add('blunder', 'pr.blunder', 'lesson.c09.l05.blunder-check');
    if (g.wasWinning) add('convert', 'pr.convert', 'lesson.c07.l06.converting');
    if (g.timeTrouble) add('time', 'pr.time', 'lesson.c10.l02.time-trouble');
    return out.slice(0, 3);
  }

  // ------------------------------------------------------------------ the player's profile, across games
  // profile: the stored object (or undefined); returns the updated one. Kept small: counts and the last 20 accuracies.
  function profileAdd(profile, rep, meta) {
    const p = profile ? JSON.parse(JSON.stringify(profile)) : { games: 0, acc: [], kinds: { hanging: 0, forks: 0, mate: 0, missed: 0 }, op: { queenEarly: 0, slow: 0, lateCastle: 0, games: 0 },
      phase: { opening: [0, 0], middlegame: [0, 0], endgame: [0, 0] }, tactics: [0, 0], grades: { excellent: 0, good: 0, inaccurate: 0, mistake: 0, blunder: 0 }, time: { games: 0, trouble: 0, rushed: 0, slowEasy: 0 }, results: { win: 0, loss: 0, draw: 0 } };
    p.games++;
    if (rep.accuracy !== null) { p.acc.push(rep.accuracy); if (p.acc.length > 20) p.acc.shift(); }
    for (const k in rep.stats.kinds) p.kinds[k] = (p.kinds[k] || 0) + rep.stats.kinds[k];
    if (meta && meta.standard) { p.op.games++; for (const k of ['queenEarly', 'slow', 'lateCastle']) if (rep.stats.op[k]) p.op[k]++; }
    for (const ph of ['opening', 'middlegame', 'endgame']) if (rep.phaseAcc[ph] !== null) { p.phase[ph][0] += rep.phaseAcc[ph]; p.phase[ph][1]++; }
    p.tactics[0] += rep.stats.tacticsFound; p.tactics[1] += rep.stats.tacticsMissed;
    for (const g in rep.counts) p.grades[g] += rep.counts[g];
    p.results[rep.result]++;
    if (meta && meta.time) { p.time.games++; if (meta.time.trouble) p.time.trouble++; p.time.rushed += meta.time.rushed || 0; p.time.slowEasy += meta.time.slowEasy || 0; }
    return p;
  }
  // What the profile says: strengths, weaknesses and the next things to practise.
  function insights(p) {
    if (!p || p.games < 2) return { lines: [tr('pf.none')], weak: [], strong: [], recs: [], trend: null };
    const per = (n) => n / p.games;
    const weak = [], strong = [];
    if (per(p.kinds.hanging) >= 0.5) weak.push({ id: 'hanging', text: tr('pf.hanging'), w: per(p.kinds.hanging) });
    if (per(p.kinds.forks) >= 0.3) weak.push({ id: 'forks', text: tr('pf.forks'), w: per(p.kinds.forks) });
    if (per(p.kinds.mate) >= 0.25) weak.push({ id: 'mate', text: tr('pf.mate'), w: per(p.kinds.mate) * 1.5 });
    if (per(p.kinds.missed) >= 0.6) weak.push({ id: 'missed', text: tr('pf.missedTactics'), w: per(p.kinds.missed) });
    if (p.op.games >= 2 && p.op.queenEarly / p.op.games >= 0.4) weak.push({ id: 'queen', text: tr('pf.queenEarly'), w: p.op.queenEarly / p.op.games });
    if (p.op.games >= 2 && p.op.slow / p.op.games >= 0.4) weak.push({ id: 'develop', text: tr('pf.develop'), w: p.op.slow / p.op.games });
    if (p.op.games >= 2 && p.op.lateCastle / p.op.games >= 0.5) weak.push({ id: 'castle', text: tr('pf.castle'), w: p.op.lateCastle / p.op.games });
    const avg = (ph) => (p.phase[ph][1] ? p.phase[ph][0] / p.phase[ph][1] : null);
    if (avg('endgame') !== null && avg('endgame') < 65 && p.phase.endgame[1] >= 2) weak.push({ id: 'endgame', text: tr('pf.endgame'), w: 0.6 });
    if (p.time.games >= 2 && p.time.trouble / p.time.games >= 0.4) weak.push({ id: 'time', text: tr('pf.time'), w: 0.5 });
    if (p.time.games >= 2 && p.time.rushed / p.time.games >= 1) weak.push({ id: 'fast', text: tr('pf.fast'), w: 0.5 });
    if (avg('opening') !== null && avg('opening') >= 85 && p.op.slow === 0) strong.push({ id: 'opening', text: tr('pf.opening') });
    if (p.tactics[0] + p.tactics[1] >= 4 && p.tactics[0] / (p.tactics[0] + p.tactics[1]) >= 0.65) strong.push({ id: 'tactics', text: tr('pf.tactics') });
    let trend = null;
    if (p.acc.length >= 6) {
      const h = Math.floor(p.acc.length / 2), first = p.acc.slice(0, h), last = p.acc.slice(h);
      const m = (l) => l.reduce((a, b) => a + b, 0) / l.length;
      trend = m(last) - m(first);
    }
    weak.sort((a, b) => b.w - a.w);
    const map = { hanging: ['pr.hanging', 'lesson.c04.l05.hanging', 'hangingPiece'], forks: ['pr.forks', 'lesson.c05.l06.forks-defence', 'fork'], mate: ['pr.mate', 'lesson.c04.l06.mates', 'mateIn1'],
      missed: ['pr.blunder', 'lesson.c09.l02.forcing-first', null], queen: ['pr.queen', 'lesson.c03.l05.queen-early', null], develop: ['pr.develop', 'lesson.c03.l02.develop', null],
      castle: ['pr.castle', 'lesson.c03.l03.king-safety', null], endgame: ['pr.pawnEnd', 'lesson.c08.l01.king-activity', null], time: ['pr.time', 'lesson.c10.l01.clock', null], fast: ['pr.blunder', 'lesson.c09.l05.blunder-check', null] };
    const recs = weak.slice(0, 3).map((w) => ({ id: w.id, text: tr(map[w.id][0]), lesson: map[w.id][1], theme: map[w.id][2] }));
    const lines = weak.slice(0, 3).map((w) => w.text).concat(strong.map((s) => s.text));
    if (trend !== null) lines.push(tr(trend >= 3 ? 'pf.better' : 'pf.steady'));
    return { lines: lines.length ? lines : [tr('pf.steady')], weak, strong, recs, trend, avg: { opening: avg('opening'), middlegame: avg('middlegame'), endgame: avg('endgame') } };
  }

  // ------------------------------------------------------------------ the time coach
  // After the player's move in a timed game. t: { spent, left, oppLeft, base, inc, grade, easy (one obvious move), sharp (captures or threats on the board) }
  // Returns a line key or null; the caller says it only when the time coach is on, and not every move.
  function timeAdvice(t) {
    if (!t || !t.base) return null;
    const frac = t.spent / Math.max(1, t.left + t.spent);
    if (t.left < Math.max(15000, t.base * 0.1) && !t.saidLow) return { id: 'low', text: tr('tm.low') };
    if (t.easy && t.spent > 20000 && frac > 0.08) return { id: 'slow', text: tr('tm.slow') };
    if (t.sharp && t.spent < 2500 && (t.grade === 'mistake' || t.grade === 'blunder')) return { id: 'rush', text: tr('tm.rush') };
    if (t.oppLeft && t.left < t.oppLeft * 0.5 && t.left < t.base * 0.4) return { id: 'behind', text: tr('tm.behind') };
    return null;
  }
  // Before the player's move: an important moment worth slowing down for.
  function timeThink(lk, t) {
    if (!t || !t.base || !lk) return null;
    const sharp = (lk.threat && lk.threat.serious) || (lk.alts[1] && C.winProb(lk.alts[0].cp) - C.winProb(lk.alts[1].cp) >= 0.2);
    return sharp && t.left > t.base * 0.25 ? { id: 'think', text: tr('tm.think') } : null;
  }

  // ------------------------------------------------------------------ words to know
  const TERMS = ['pin', 'fork', 'skewer', 'discovered', 'zugzwang', 'opposition', 'zwischenzug', 'gambit', 'tempo', 'initiative', 'passed', 'isolated', 'outpost', 'openFile', 'backRank',
    'overloaded', 'sacrifice', 'development', 'castling', 'stalemate', 'fortress', 'promotion', 'exchange', 'hanging', 'checkmate'];
  // English stems that show a term is used in a sentence (any language: the term's own word is checked too).
  const STEMS = { pin: /\bpin(s|ned)?\b/i, fork: /\bfork(s|ed|ing)?\b/i, skewer: /\bskewer/i, discovered: /\b(uncover|discovered)/i, zugzwang: /zugzwang/i, opposition: /\bopposition\b/i,
    zwischenzug: /(zwischenzug|in-between)/i, gambit: /\bgambit\b/i, tempo: /\btempo\b/i, initiative: /\binitiative\b/i, passed: /\bpassed pawn/i, isolated: /\bisolated\b/i, outpost: /(outpost|no pawn can chase)/i,
    openFile: /\bopen( [a-h])?-?file|\bopen line/i, backRank: /\bback(-| )(rank|row)\b/i, overloaded: /\boverload/i, sacrifice: /\bsacrific/i, development: /\b(develop|at home)/i, castling: /\bcastl/i,
    stalemate: /\bstalemate/i, fortress: /\bfortress\b/i, promotion: /\bpromot/i, exchange: /\btrad(e|es|ing)\b/i, hanging: /\b(unprotected|loose|undefended|not protected)\b/i, checkmate: /\bcheckmate\b|\bmate\b/i };
  function glossary(level) {
    return TERMS.map((id) => ({ id, word: tr('v.' + id), text: tr('v.' + id + (level === 'advanced' || level === 'intermediate' ? '.m' : '.s')) }));
  }
  // Terms a sentence uses. enText: the English version of the sentence (stems are English); text: the shown one.
  function termsIn(enText, text) {
    const out = [];
    for (const id of TERMS) {
      const word = tr('v.' + id);
      // the English stems decide; the shown words are only searched when there is no English (a substring
      // there misfires: Hindi पहल, initiative, sits inside पहली, first)
      if (STEMS[id].test(enText || '') || (!enText && text && word && text.toLowerCase().includes(word.toLowerCase()))) out.push(id);
    }
    return out;
  }
  function term(id, level) { return { id, word: tr('v.' + id), text: tr('v.' + id + (level === 'advanced' || level === 'intermediate' ? '.m' : '.s')) }; }

  // ------------------------------------------------------------------ settings and modes
  const MODES = {
    silent: { on: true, auto: false, freq: 'important', depth: 1, audio: false, text: true, mentor: false, think: false, post: true, prevent: false, time: false },
    learning: { on: true, auto: true, freq: 'important', depth: 2, audio: true, text: true, mentor: false, think: true, post: true, prevent: false, time: false },
    mentor: { on: true, auto: true, freq: 'every', depth: 3, audio: true, text: true, mentor: true, think: true, post: true, prevent: true, time: true },
  };
  const DEFAULTS = Object.assign({ mode: 'learning', style: 'friendly', level: 'auto', voice: 'rooky' }, MODES.learning);
  // The mode whose settings match, or 'custom'.
  function modeOf(cfg) {
    for (const id in MODES) if (Object.keys(MODES[id]).every((k) => cfg[k] === MODES[id][k])) return id;
    return 'custom';
  }
  // Old one-word coach setting (off, quiet, normal, chatty) to the full settings.
  function migrate(old, cfg) {
    if (cfg && typeof cfg === 'object') return Object.assign({}, DEFAULTS, cfg);
    const base = old === 'quiet' ? MODES.silent : old === 'chatty' ? MODES.mentor : MODES.learning;
    const out = Object.assign({}, DEFAULTS, base, { mode: old === 'quiet' ? 'silent' : old === 'chatty' ? 'mentor' : 'learning' });
    if (old === 'off') out.on = false;
    return out;
  }
  // Should a graded move get a comment? Respects the frequency setting and never raises activity on its own.
  function shouldComment(cfg, grade) {
    if (!cfg.on || !cfg.auto) return false;
    return cfg.freq === 'every' || IMPORTANT.has(grade);
  }
  // Explanation level: the player's choice, or (auto) their strength.
  function levelFor(cfg, strength) {
    if (cfg.level && cfg.level !== 'auto') return cfg.level;
    return strength >= 1500 ? 'advanced' : strength >= 1000 ? 'intermediate' : 'beginner';
  }

  // Speech. Rooky's lines are recorded, never made up by a device voice: a line is cut into recorded
  // pieces, the fixed words of each template, the names and numbers that fill them, and the moves and
  // squares (said word by word from the move recordings). speechVocab() is what gets recorded
  // (tools/voice/record-coach.py); speechParts(text) cuts a finished English line, or gives null
  // when some piece of it has no recording.
  const SAN_RE = /^(?:O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8](?:=[QRBN])?|[a-h][1-8](?:=[QRBN])?)[+#]?(?![A-Za-z0-9])/;
  let vocab = null, byFirst = null;
  function speechVocab() {
    if (vocab) return vocab;
    const set = new Set();
    const add = (x) => { x = String(x).trim(); if (/[A-Za-z]/.test(x) || /^\d+$/.test(x)) set.add(x); };
    for (const v of Object.values(EN).concat(Object.values(C.EN))) for (const piece of v.split(/\{\w+\}/)) add(piece);
    for (const k of Object.keys(C.NAME)) { add(C.NAME[k]); }
    for (const b of BOOK) add(b.name);
    for (const x of TRAPS) add(x.name);
    for (let n = 0; n <= 100; n++) add(String(n));
    add('percent');
    vocab = [...set].sort((a, b) => b.length - a.length);
    byFirst = new Map();
    for (const v of vocab) { const c = v[0].toLowerCase(); if (!byFirst.has(c)) byFirst.set(c, []); byFirst.get(c).push(v); }
    return vocab;
  }
  const PUNCT = /[.,;:!?()"'\u2018\u2019\u201c\u201d\u2013\u2014\u2026-]/;
  function speechParts(text) {
    speechVocab();
    const s = String(text).replace(/\s+/g, ' ').trim(), low = s.toLowerCase(), memo = new Map();
    const alnum = (c) => !!c && /[A-Za-z0-9]/.test(c);
    const go = (i) => {
      while (i < s.length && s[i] === ' ') i++;
      if (i >= s.length) return [];
      if (memo.has(i)) return memo.get(i);
      memo.set(i, null);
      let out = null;
      const m = alnum(s[i - 1]) ? null : s.slice(i).match(SAN_RE);
      if (m) {
        const rest = go(i + m[0].length);
        if (rest) out = [/^[a-h][1-8]$/.test(m[0]) ? { sq: m[0] } : { san: m[0] }].concat(rest);
      }
      if (!out && /^[a-h]-file/.test(s.slice(i)) && !alnum(s[i - 1])) {
        const rest = go(i + 1);
        if (rest) out = [{ file: s[i] }].concat(rest);
      }
      if (!out && s[i] === '%') {
        const rest = go(i + 1);
        if (rest) out = [{ line: 'percent' }].concat(rest);
      }
      if (!out) {
        for (const f of byFirst.get(low[i]) || []) {
          const j = i + f.length;
          if (low.slice(i, j) !== f.toLowerCase()) continue;
          if (alnum(f[f.length - 1]) && alnum(s[j])) continue;
          if (alnum(f[0]) && alnum(s[i - 1])) continue;
          const rest = go(j);
          if (rest) { out = [{ line: f }].concat(rest); break; }
        }
      }
      if (!out && PUNCT.test(s[i])) {
        const rest = go(i + 1);
        if (rest) out = [{ pause: /[.!?]/.test(s[i]) ? 'stop' : 'comma' }].concat(rest);
      }
      memo.set(i, out);
      return out;
    };
    return go(0);
  }

  // Every fixed English line the mentor and coach can say, for recording (tools/voice/lines.js).
  function allLines() {
    return { EN: Object.assign({}, EN), openers: OPENERS, phaseOpeners: PHASE_OPENERS, lines: LINES, book: BOOK.map((b) => b.name), traps: TRAPS.map((t) => t.name) };
  }

  return {
    EN, OPENERS, LINES, MODES, DEFAULTS, TERMS, BOOK, TRAPS,
    tr, assess, phaseOf, opening, trapAhead, endgameFacts, topMoves, pvLine, zugzwang, matePattern,
    study, look, check, checkLine, sanList, gradeOf, notable, evalWords, swingWords, idea, reason, openerKey, lineKey, pick,
    feedback, feedbackText, detail, plans, phaseGuide, recommendOpening, threats, chances, mateRadar, warning, hints, thinkAhead,
    phases, report, openingHabits, practice, profileAdd, insights, timeAdvice, timeThink, glossary, termsIn, term,
    modeOf, migrate, shouldComment, levelFor, allLines, IMPORTANT, speechVocab, speechParts,
  };
}

if (typeof module !== 'undefined') module.exports = ChacklateMentor;
