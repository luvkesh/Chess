# Web prototype

A playable, dependency-free 3D chess game that runs from a single HTML file. No libraries, CDNs or web fonts.

| File | What it is |
| --- | --- |
| `src/engine.js` | Rules (0x88 board, SAN/FEN/PGN, draw rules) and an alpha-beta AI with six levels. Runs in a Web Worker in the browser. |
| `src/render.js` | Raw WebGL1 renderer: lathe/extruded pieces, shadow map, board and piece themes, animations. |
| `src/app.js` | Game UI, controls and wiring between engine and renderer. |
| `src/shell.html` | Page template. The build inlines the three scripts into it. |
| `build.py` | Inlines `src/*` into `dist/chacklate-chess.html`. |
| `test/engine.test.js` | Perft on six standard positions, rules edge cases, 400 random games and search checks. |
| `dist/chacklate-chess.html` | The built game, committed so it can be opened directly. |

## Commands

Needs Node 18+ and Python 3.

```sh
node test/engine.test.js   # or: npm test
python3 build.py           # or: npm run build
```

Open `dist/chacklate-chess.html` in a browser to play. After changing anything in `src/`, rebuild and commit the updated `dist/` file; CI fails if it is stale.

This prototype is a playable reference. The production clients are planned in Unity with an in-house engine (see `docs/`).
