# content

Game content as data, so clients and the server can ship new items without code changes.

- `lessons.json`: 75 voice-guided lessons in 10 chapters (1–3 free). Each lesson has narration steps and on-board exercises with checked solutions.
- `puzzles.json`: engine-verified tactics puzzles (`fen`, `moves` starting with the opponent's move, `themes`, `rating`).
- `openings.json`: Opening lab lines (moves in UCI, per-move notes, key ideas, free or premium).
- `endgames.json`: Endgame dojo positions with a goal (mate, promote or draw) and a par.
- `catalog.json`: cosmetics (boards, pieces, rooms, clocks, effects, avatars, frames) with stable ids, rarity and unlock rules (free, level, achievement, premium, or a season tier on the free or pass track).
- `seasons.json`: seasons with dates and tier count; `tierXp` is the XP per tier. Rewards are the catalog items whose unlock names the season.
- `missions.json`: the daily mission pool. Three a day are picked from the date, so everyone gets the same set.
- `variants.json`: the Variations menu. Each playable variation has its start position (rules in the engine), a one-page rule sheet, and a short lesson whose words are Rooky's recorded lines in `guide.json`; `differs` marks a rule that is not like chess. The others are listed as coming soon.
- `store.json`: Premium and season pass products, what each grants, prices (null until set at launch) and empty App Store / Play SKU slots.

`node test/content.test.js` replays every lesson solution and puzzle line with the engine, checks tactical answers against an engine search, validates openings and endgames, and checks the catalogue for broken references.
