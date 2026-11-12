# chess-core

The in-house chess engine and coach, shared by the browser game, the game server and the puzzle generator. Plain JavaScript with no dependencies; each file defines one factory function so it can run in Node, on a page or inside a Web Worker.

- `src/engine.js`: `ChacklateEngine()`. 0x88 move generation, FEN, SAN, PGN, all draw rules, and an alpha-beta search (iterative deepening, transposition table, quiescence, killer and history ordering) with eight personality levels.
  Variations ride in the FEN as a prefix (`chaturanga:rnbq... w - - 0 1`), so a game, a worker job or a review keeps its rules wherever the FEN goes. `chaturanga` reuses the codes of the pieces they grew into: the Gaja (B) jumps two squares diagonally, the Mantri (Q) steps one square diagonally, pawns step once and promote to a Mantri, there is no castling, and stalemate or a bare king loses.
- `src/coach.js`: `ChacklateCoach(E)`. Detects forks, pins, skewers, discovered attacks, hanging pieces and mates, classifies moves by win-probability loss, writes the explanations, builds hint ladders and full game reviews.
- `src/mates.js`: `ChacklateMates(E)`. An exact forced-mate search (checks first, every defence tried, with a node budget): `shortest`, `matingMoves`, `longestDefence`, `defends`. It proves the Checkmate in N puzzles and lets the game accept a different move that still mates in time.
- `tools/generate-puzzles.js`: finds puzzles in engine self-play: `node tools/generate-puzzles.js <seed> <games> > out.json`.
- `tools/generate-mates.js`: Checkmate in 1 to 5 from strong-against-weak self-play, each with one first move (`MIN_N`, `MAX_N`, `OUT_JSONL` to append as found).
- `tools/generate-trainers.js`, `generate-endgames.js`, `generate-openings.js`: positions for the skill trainers (tactics, advantage, defence and threats, saving resources, safe moves, intuition, slips; endgames to win or hold; opening moves).

```sh
node test/engine.test.js   # perft, rules edge cases, random games, search, chaturanga against a reference move generator
node test/coach.test.js    # fact detection and review classification
```
