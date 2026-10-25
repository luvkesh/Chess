# Chacklate Chess

A premium, AI-backed 3D chess game for iOS, Android, PC/Mac and the web.

## Repository layout

```
apps/
  web-prototype/     The browser game (WebGL, offline coach, lessons, puzzles, online client)
  website/           Marketing site
  admin/             Staff console
packages/
  chess-core/        In-house engine (rules + AI), coach and puzzle generator
  content/           Lessons, puzzles and the cosmetics catalogue (JSON)
services/
  game-server/       Accounts, Glicko-2 ratings, matchmaking, live games, leaderboards, admin API
docs/
  planning/          Product and technical plan
.github/workflows/   CI
```

The Unity clients for iOS, Android, Mac and Windows will be added under `apps/` and reuse `packages/` and the server protocol.

## Quick start

Needs Node 22.5+ and Python 3. Nothing to install.

```sh
python3 apps/web-prototype/build.py                  # builds the single-file game
open apps/web-prototype/dist/chacklate-chess.html    # play offline

cd services/game-server
CHACKLATE_ADMIN_EMAIL=you@example.com CHACKLATE_ADMIN_PASSWORD='a long password' node src/server.js
# http://localhost:8080 site, /play game with online play, /admin console
```

Tests: `node packages/chess-core/test/engine.test.js`, `node packages/chess-core/test/coach.test.js`, `node packages/content/test/content.test.js`, `node apps/web-prototype/test/progress.test.js`, `cd services/game-server && npm test`.

## Status

Phase 0 planning and Phase 1 prototypes are approved. The engine is in-house (no Stockfish). The browser game, server, website and admin console here are working references; Unity clients, store listings and production infrastructure are not built yet.

## Licence

No licence is granted. All rights reserved.
