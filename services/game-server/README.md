# Game server

Accounts, ratings, matchmaking, live games, leaderboards, reports and the staff API in one Node process with no dependencies. Storage is SQLite through `node:sqlite`, so it needs Node 22.5 or later.

| File | What it does |
| --- | --- |
| `src/server.js` | HTTP API, static pages (`/` website, `/play` game, `/admin` console) and the WebSocket endpoint `/ws`. |
| `src/lobby.js` | Guests and sessions, seek queue with a widening rating window, friend codes, server-side move validation with the shared engine, clocks with increment, first-move abort, 60 s reconnect grace, results and rating updates. |
| `src/glicko.js` | Glicko-2, separate bullet, blitz and rapid pools. |
| `src/admin.js` | Staff login and role-based permissions (support, moderator, admin). |
| `src/audit.js` | Append-only audit log; each row hashes the previous one so edits are detectable. |
| `src/ws.js` | Minimal RFC 6455 WebSocket server. |
| `src/cli.js` | `create-staff <email> <role>` and `verify-audit`. |

## Run

```sh
CHACKLATE_ADMIN_EMAIL=you@example.com CHACKLATE_ADMIN_PASSWORD='a long password' node src/server.js
# http://localhost:8080        marketing site
# http://localhost:8080/play   the game, online play enabled
# http://localhost:8080/admin  staff console
node --test test/*.test.js     # or: npm test
```

The first admin is created from the two environment variables when the staff table is empty; add more staff from the console or with `node src/cli.js create-staff`. `CHACKLATE_DB` sets the database file and `PORT` the port.

## Protocol

Clients send JSON over `/ws`, starting with `{"type":"hello","token":...}`. A missing or unknown token creates a guest. Then: `seek {tc}`, `cancel`, `friend-create {tc}`, `friend-join {code}`, `move {uci, ply}`, `resign`, `draw-offer`, `draw-accept`, `draw-decline`, `claim`, `sync`, `progress {data}`, `report {reason, game}`. The server answers with `welcome`, `seeking`, `start`, `move`, `ack`, `sync`, `status`, `draw-offer`, `end`, `friend-code`, `error` and `banned`. The server is the referee: it checks every move with `packages/chess-core`, runs the clocks and decides results.

HTTP: `POST /api/register` (upgrades the current guest, keeping ratings), `POST /api/login`, `POST /api/logout`, `GET /api/me`, `GET /api/leaderboard?pool=blitz`, `GET /api/players/:name`, `GET /api/games/:id`, and `/api/admin/*` for staff.

## Not production-ready yet

This is a single process with in-memory live games. Before launch it needs: TLS termination and a real domain, horizontal scaling (live games in Redis or sticky sessions), Postgres instead of SQLite, email verification and password reset, anti-cheat signals, backups, monitoring, and a privacy review. See `docs/planning`.
