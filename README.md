# Chacklate Chess

A premium, AI-backed 3D chess game for iOS, Android, PC/Mac and the web.

## Repository layout

```
apps/
  web-prototype/     Playable dependency-free browser game (JS engine + WebGL)
docs/
  planning/          Product and technical plan
.github/workflows/   CI
```

More apps and services (Unity clients, game service, platform/admin APIs) will be added under `apps/` and `services/` as each phase is approved.

## Quick start

```sh
cd apps/web-prototype
node test/engine.test.js
python3 build.py
# then open dist/chacklate-chess.html
```

## Status

Phase 0 planning and Phase 1 prototypes are approved. Production engine, rendering and backend work has not started yet.

## Licence

Licensing is not final. It depends on a pending legal review of using Stockfish (GPL-3) on iOS.
