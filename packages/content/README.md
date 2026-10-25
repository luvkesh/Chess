# content

Game content as data, so clients and the server can ship new items without code changes.

- `lessons.json`: 74 voice-guided lessons in 10 chapters (1–3 free). Each lesson has narration steps and on-board exercises with checked solutions.
- `puzzles.json`: engine-verified tactics puzzles (`fen`, `moves` starting with the opponent's move, `themes`, `rating`).
- `openings.json`: Opening lab lines (moves in UCI, per-move notes, key ideas, free or premium).
- `endgames.json`: Endgame dojo positions with a goal (mate, promote or draw) and a par.
- `catalog.json`: cosmetics (boards, pieces, rooms, clocks, effects, avatars, frames) with stable ids, rarity and unlock rules.

`node test/content.test.js` replays every lesson solution and puzzle line with the engine, checks tactical answers against an engine search, validates openings and endgames, and checks the catalogue for broken references.
