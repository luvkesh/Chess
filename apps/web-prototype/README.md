# Web game

The playable Chackmate client: a 3D chess game that runs from one HTML file. three.js and the fonts are vendored and inlined, so it makes no requests to CDNs or font services and works fully offline; online play turns on when it can reach the game server.

| File | What it is |
| --- | --- |
| `vendor/three.bundle.js` | three.js r180 with the post-processing and geometry add-ons the scene uses (MIT licence). |
| `vendor/fonts.css` | Cinzel, Cormorant Garamond and Jost, embedded as data (SIL Open Font Licence). |
| `src/kit3d.js` | Modelling kit: lathe profiles, flutes and carving, signed-distance sculpting, procedural marble, wood, malachite and lapis, shared materials. |
| `src/pieces3d.js` | The chess sets: the era sets, each with its own shapes, materials, backstory and a note on every piece, plus the colourways. |
| `src/landmarks3d.js` | The landmark outside each era room, modelled in 3D: the sky, the ground and the monument (the Pyramids, the Parthenon, the Colosseum, the Taj Mahal, the Hall of Supreme Harmony, the Grand Canal, the Savior on Spilled Blood, Times Square and the Eiffel Tower). Static parts are merged per material, lights are one point cloud per colour, and water gets a mirrored copy instead of a reflection pass. |
| `src/world3d.js` | Boards (inlaid fields in carved frames) and rooms. Outdoor rooms (Giza, the Colosseum, the Taj gardens, Times Square, the Champ de Mars) set the table on a terrace in front of the landmark; indoor rooms keep their walls and open three grand windows onto it. |
| `src/scene.js` | The live table: camera framing around the menus, lighting, shadows, reflections, picking and dragging, move animations, the capture scenes (a 3.5 to 4.5 s scene for each capture effect: a bow, a friendly duel, a waltz, a magic trick, a frosty slide, leapfrog, a sparkler send-off; each piece type also moves and reacts in its own way; tap to skip), a castling scene, celebrations, and the renders used on menu cards. |
| `src/art.js` | Menu art: the animal portraits as gold-wire cloisonne enamel medals, crests, era banners and piece icons. Medals and banners use the rendered pictures in `src/art/` when the build has them. |
| `src/art/` | Pictures rendered from the game itself: the gold pieces on the medals (`piece-*.webp`) and each Journey era's painted view (`view-*.webp`). Made by `node tools/shoot-art.js` after a build, then `python3 tools/art-webp.py`; rerun both after changing the medal set or an era's view. |
| `src/app.js` | The app: home, play, the Journey Through Time, lessons, puzzles, training, review, collection, season, store and profile screens; the AI and coach run in Web Workers. |
| `src/minigames.js` | The six mini-games' rules, as pure functions over squares: Knight's Tour (with a Warnsdorff hint), Square Spotter, Pawn Race (pawns only, with its own small bot), Queen's Path (boards with guards and a known shortest way across), Memory Board (positions from the puzzles' real games) and Mate Rush (every mate in one the puzzles and lessons already teach, also with colours swapped). `app.js` plays them on the table. |
| `src/progress.js` | XP, levels, streaks, achievements, puzzle rating, mini-game scores and their daily reward cap, daily missions, season tiers, journey stages and cosmetic unlocks. Pure functions, tested in Node. |
| `src/audio.js` | Synthesised sound effects and music (Web Audio) plus recorded and spoken narration. Each room has its own music mood: a scale, chords and an instrument (harp, lyre, horn, sitar, guzheng, harpsichord, celesta or electric piano). |
| Audio guide | A card in the corner (top right on the home screen, top left in games and lessons, above the bottom panel on phones) where Rooky, or the era's friend on an era page, says what to do next on every screen, with Hear that again, a voice switch and hide. The lines are in `packages/content/guide.json`; `tools/voice/record-guide.py` records them into `public/guide/` with a pause after every comma and full stop. The voice switch also mutes stories and lessons, which have their own replay and voice buttons. |
| `src/rules.js` | The rule book in games (the round book button by Music): check, castling, en passant, promotion and draws, each with a small board picture, a line on how it stands in this game, and its lesson. The rules that apply right now come first. Against a bot the clocks wait while it is open and a lesson opened from it returns to the game; a game against a person is never paused, so its lessons wait until the game ends. |
| Developer mode | Tap the version line at the bottom of Settings seven times (seven more turn it off). Shows tools to play any position from a FEN, grant items (on this device only, `progress.granted`), reset the streak and show the frame rate. |
| `src/net.js` | Online client: matchmaking, friend codes, account. Talks to `services/game-server`. |
| `src/club.js`, `src/places.js` | The Club: rankings by pool with Global, Country, City and Following filters, leagues, friends from codes, AI players (labelled) until the server opens, and the kid-safe place picker (time-zone guess, a pick that sticks, a city and GPS for grown-ups only). |
| `src/relay.js` | Online play with no game server: friend codes and worldwide matchmaking over the published page's live room (the artifact `room` capability, as in Jong Club). Used only while no server is connected, so the backend swaps to the server at launch. Every online game is timed (10 minutes a side at most); players see made-up names and send preset reactions only. |
| `src/shell.html` | Page template and styles. |
| `public/` | Installable-app files the server hosts: `manifest.webmanifest`, the service worker `sw.js` (offline shell, push notifications) and icons drawn by `tools/make-icons.py`. |
| `build.py` | Inlines `packages/chess-core` (engine, coach), the vendored files, the files above and `packages/content` JSON into `dist/chackmate.html`. |
| `test/progress.test.js` | Progression rules. |
| `test/voice.test.js` | Voice lines and recorded clips. |
| `test/guide.test.js` | Every screen and era stage has a guide line, and every clip matches its words and voice. |
| `test/minigames.test.js` | Every mini-game board can be won: tours finish from every corner, the bot wins the breakthrough with b6!, every Queen's Path board has a way across, every Mate Rush position is a mate in one. |
| `test/rules.test.js` | The rule book's lines follow the position: castling allowed or blocked, en passant, promotion, check and draw warnings. |
| `test/looks.test.js` | Every set, board and room the catalog and the Journey hand out exists in the 3D code. |
| `test/online.e2e.js` | Two pages play each other through a stand-in room (`test/fake-room.js`): a friend code game to checkmate with a reaction, worldwide pairing, a resignation and a loss on time. Needs Playwright: `node test/online.e2e.js` after a build. |
| `tools/button-contrast.js` | Every button style, in every panel that restyles buttons, keeps text at 4.5:1 contrast at rest and on hover, focus and press. Needs Playwright: `node tools/button-contrast.js` after a build. |
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
