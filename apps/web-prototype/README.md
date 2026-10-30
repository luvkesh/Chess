# Web game

The playable Chackmate client: a 3D chess game that runs from one HTML file. three.js and the fonts are vendored and inlined, so it makes no requests to CDNs or font services and works fully offline; online play turns on when it can reach the game server.

| File | What it is |
| --- | --- |
| `vendor/three.bundle.js` | three.js r180 with the post-processing and geometry add-ons the scene uses (MIT licence). |
| `vendor/fonts.css` | Cinzel, Cormorant Garamond and Jost, embedded as data (SIL Open Font Licence). |
| `src/kit3d.js` | Modelling kit: lathe profiles, flutes and carving, signed-distance sculpting, procedural marble, wood, malachite and lapis, shared materials. |
| `src/pieces3d.js` | The chess sets: the era sets, each with its own shapes, materials, backstory and a note on every piece, plus the colourways. |
| `src/world3d.js` | Boards (inlaid fields in carved frames) and rooms. Each era room has its own walls, columns, windows, lights and furniture, and a painted landmark outside the windows. |
| `src/scene.js` | The live table: camera framing around the menus, lighting, shadows, reflections, picking and dragging, move animations, the capture scenes (a 3.5 to 4.5 s scene for each capture effect: a bow, a friendly duel, a waltz, a magic trick, a frosty slide, leapfrog, a sparkler send-off; each piece type also moves and reacts in its own way; tap to skip), a castling scene, celebrations, and the renders used on menu cards. |
| `src/art.js` | Flat art for the menus: animal portraits, crests, era banners and piece icons. |
| `src/app.js` | The app: home, play, the Journey Through Time, lessons, puzzles, training, review, collection, season, store and profile screens; the AI and coach run in Web Workers. |
| `src/progress.js` | XP, levels, streaks, achievements, puzzle rating, daily missions, season tiers, journey stages and cosmetic unlocks. Pure functions, tested in Node. |
| `src/audio.js` | Synthesised sound effects and music (Web Audio) plus recorded and spoken narration. Each room has its own music mood: a scale, chords and an instrument (harp, lyre, horn, sitar, guzheng, harpsichord, celesta or electric piano). |
| `src/net.js` | Online client: matchmaking, friend codes, account, leaderboards. Talks to `services/game-server`. |
| `src/relay.js` | Online play with no game server: friend codes and worldwide matchmaking over the published page's live room (the artifact `room` capability, as in Jong Club). Used only while no server is connected, so the backend swaps to the server at launch. Every online game is timed (10 minutes a side at most); players see made-up names and send preset reactions only. |
| `src/shell.html` | Page template and styles. |
| `public/` | Installable-app files the server hosts: `manifest.webmanifest`, the service worker `sw.js` (offline shell, push notifications) and icons drawn by `tools/make-icons.py`. |
| `build.py` | Inlines `packages/chess-core` (engine, coach), the vendored files, the files above and `packages/content` JSON into `dist/chackmate.html`. |
| `test/progress.test.js` | Progression rules. |
| `test/voice.test.js` | Voice lines and recorded clips. |
| `test/looks.test.js` | Every set, board and room the catalog and the Journey hand out exists in the 3D code. |
| `test/online.e2e.js` | Two pages play each other through a stand-in room (`test/fake-room.js`): a friend code game to checkmate with a reaction, worldwide pairing, a resignation and a loss on time. Needs Playwright: `node test/online.e2e.js` after a build. |
| `dist/chackmate.html` | The built game, committed so it can be opened directly. |

## Commands

Needs Node 22 and Python 3.

```sh
node test/progress.test.js   # or: npm test (runs all three tests)
python3 build.py             # or: npm run build
```

Open `dist/chackmate.html` to play offline. Served from the game server, the game is also an installable app (Settings → App) that opens without a connection and can send a daily reminder. Premium comes from the account's entitlements on the server; Profile has a device-only Premium preview switch for testing without one. To try purchases, run the server with `CHACKLATE_PAYMENTS=dev`. For online play, start the server (`services/game-server`) and open `http://localhost:8080/play`, or set the server address under Settings. After changing anything in `src/` or `packages/`, rebuild and commit `dist/`; CI fails if it is stale.

This is the reference client. The production iOS, Android, Mac and Windows clients are planned in Unity and will share the same engine rules, content files and server protocol.

## Rules for new looks

Children must be able to read the board at a glance, whatever the era:

- Every chess set keeps the standard outline for each piece type, however it is decorated.
- A board's dark squares must differ in colour from both sides of the set it comes with: no red pieces on red squares, blue on blue or green on green.
- Rooms never get chequered floors, because they read as a second chessboard around the table. `test/looks.test.js` checks this.
- Where a border pattern or a busy stone such as malachite runs under the coordinates, each letter sits on its own small tablet.
