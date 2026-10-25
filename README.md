# Chacklate Chess

A premium, AI-backed 3D chess game for iOS, Android, PC/Mac and the web.

## Repository layout

```
apps/
  web-prototype/     The browser game (WebGL, offline coach, lessons, puzzles, online client)
  website/           Marketing site
  admin/             Staff console
  unity/             Unity starter: C# rules port, server client, sample scripts
packages/
  chess-core/        In-house engine (rules + AI), coach and puzzle generator
  content/           Lessons, puzzles and the cosmetics catalogue (JSON)
services/
  game-server/       Accounts, Glicko-2 ratings, matchmaking, live games, leaderboards, admin API
deploy/              Docker Compose with HTTPS (Caddy), daily backups, configuration
docs/
  planning/          Product and technical plan
.github/workflows/   CI
```

`apps/unity` is the start of the native clients for iOS, Android, Mac and Windows. Its C# rules are checked against `packages/chess-core` in CI; see `apps/unity/README.md` for what is and is not verified.

## Quick start

Needs Node 22.5+ and Python 3. Nothing to install.

```sh
python3 apps/web-prototype/build.py                  # builds the single-file game
open apps/web-prototype/dist/chacklate-chess.html    # play offline

cd services/game-server
CHACKLATE_ADMIN_EMAIL=you@example.com CHACKLATE_ADMIN_PASSWORD='a long password' node src/server.js
# http://localhost:8080 site, /play game with online play, /admin console
```

Deploy with Docker: see `deploy/README.md` (`docker compose up -d --build` with a domain pointed at the host).

Tests: `node packages/chess-core/test/engine.test.js`, `node packages/chess-core/test/coach.test.js`, `node packages/content/test/content.test.js`, `node apps/web-prototype/test/progress.test.js`, `cd services/game-server && npm test`, and the Unity core tests in `apps/unity/README.md`.

## Status

Phase 0 planning and Phase 1 prototypes are approved. The engine is in-house (no Stockfish). The browser game, server (accounts, ratings, store and entitlements, fair play, push reminders), website, admin console and Docker deployment work and are tested. The Unity clients are a starter (rules and online client only, not yet opened in the Unity editor). Store listings, a payment provider, an email provider and production hosting still need accounts that only the owner can create.

## Licence

No licence is granted. All rights reserved.
