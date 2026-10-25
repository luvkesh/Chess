# Web game

The playable Chacklate Chess client: a dependency-free 3D chess game that runs from one HTML file. No libraries, CDNs or web fonts. It works fully offline; online play turns on when it can reach the game server.

| File | What it is |
| --- | --- |
| `src/render.js` | Raw WebGL1 renderer: lathe and extruded pieces, stencil reflections, PCF shadow map, studio lighting, procedural marble and wood, captures, particles, camera moves. |
| `src/app.js` | The app: home, game, lessons, puzzles, review, Opening lab, Endgame dojo, season track, store, collection and profile screens; AI and coach run in Web Workers. |
| `src/progress.js` | XP, levels, streaks, achievements, puzzle rating, daily missions, season tiers and cosmetic unlocks. Pure functions, tested in Node. |
| `src/audio.js` | Synthesised sound effects and music (Web Audio) plus spoken narration (speech synthesis). |
| `src/net.js` | Online client: matchmaking, friend codes, account, leaderboards. Talks to `services/game-server`. |
| `src/shell.html` | Page template and styles. |
| `build.py` | Inlines `packages/chess-core` (engine, coach), the files above and `packages/content` JSON into `dist/chacklate-chess.html`. |
| `test/progress.test.js` | Progression rules. |
| `dist/chacklate-chess.html` | The built game, committed so it can be opened directly. |

## Commands

Needs Node 22 and Python 3.

```sh
node test/progress.test.js   # or: npm test
python3 build.py             # or: npm run build
```

Open `dist/chacklate-chess.html` to play offline. Premium comes from the account's entitlements on the server; Profile has a device-only Premium preview switch for testing without one. To try purchases, run the server with `CHACKLATE_PAYMENTS=dev`. For online play, start the server (`services/game-server`) and open `http://localhost:8080/play`, or set the server address under Settings. After changing anything in `src/` or `packages/`, rebuild and commit `dist/`; CI fails if it is stale.

This is the reference client. The production iOS, Android, Mac and Windows clients are planned in Unity and will share the same engine rules, content files and server protocol.
