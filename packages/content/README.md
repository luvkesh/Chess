# content

Game content as data, so clients and the server can ship new items without code changes.

- `lessons.json`: chapters and voice-guided lessons. Each lesson has narration steps and on-board exercises with checked solutions.
- `puzzles.json`: engine-verified tactics puzzles (`fen`, `moves` starting with the opponent's move, `themes`, `rating`).
- `catalog.json`: cosmetics (boards, pieces, rooms, clocks, effects, avatars, frames) with stable ids, rarity and unlock rules.

`node test/content.test.js` replays every lesson solution and puzzle line with the engine and checks the catalogue for broken references.
