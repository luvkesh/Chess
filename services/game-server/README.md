# Game server

Accounts, ratings, matchmaking, live games, leaderboards, reports and the staff API in one Node process with no dependencies. Storage is SQLite through `node:sqlite`, so it needs Node 22.5 or later.

| File | What it does |
| --- | --- |
| `src/server.js` | HTTP API, static pages (`/` website, `/play` game, `/admin` console) and the WebSocket endpoint `/ws`. |
| `src/lobby.js` | Guests and sessions, seek queue with a widening rating window, friend codes, server-side move validation with the shared engine, clocks with increment, first-move abort, 60 s reconnect grace, results and rating updates. |
| `src/glicko.js` | Glicko-2, separate bullet, blitz and rapid pools. |
| `src/admin.js` | Staff login and role-based permissions (support, moderator, admin). |
| `src/fairplay.js`, `src/fairplay-analyse.js`, `src/fairplay-worker.js` | Fair play signals: each finished rated game is analysed in a worker thread (engine agreement and average centipawn loss per side, skipping book, forced and decided moves). Players whose recent games look engine-like are put in the report queue for a moderator. Thresholds are starting points to tune on real games. |
| `src/push.js` | Web Push with no dependencies: VAPID signing and RFC 8291 payload encryption, plus the daily reminder (at the player's chosen local hour, only if they have not played that day). |
| `src/commerce.js` | Store products, orders and entitlements (Premium with stacking renewals, lifetime, season passes), refunds and the payment provider webhook. |
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

Payments: `CHACKLATE_PAYMENTS` is `off` (default: the store lists products, checkout is closed), `dev` (purchases complete on a confirm tap and no money moves, for testing) or `external`. In `external` mode checkout redirects to `CHACKLATE_CHECKOUT_URL` (with `{order}` replaced by the order id) and the provider calls `POST /api/store/webhook` with `{"order","event":"paid"|"refunded"|"failed","ref"}`, signed as hex HMAC-SHA256 of the raw body with `CHACKLATE_PAYMENT_SECRET` in the `X-Chacklate-Signature` header. A thin adapter turns Razorpay, Stripe or App Store / Play server notifications into that call.

Reminders: VAPID keys come from `CHACKLATE_VAPID_PUBLIC` / `CHACKLATE_VAPID_PRIVATE`, or are generated once and kept in the database. Set `CHACKLATE_PUSH_SUBJECT` to a real `mailto:` or `https:` contact before launch; push services use it to reach you.

The first admin is created from the two environment variables when the staff table is empty; add more staff from the console or with `node src/cli.js create-staff`. `CHACKLATE_DB` sets the database file and `PORT` the port.

## Protocol

Clients send JSON over `/ws`, starting with `{"type":"hello","token":...}`. A missing or unknown token creates a guest. Then: `seek {tc}`, `cancel`, `friend-create {tc}`, `friend-join {code}`, `move {uci, ply}`, `resign`, `draw-offer`, `draw-accept`, `draw-decline`, `claim`, `sync`, `progress {data}`, `report {reason, game}`. The server answers with `welcome`, `seeking`, `start`, `move`, `ack`, `sync`, `status`, `draw-offer`, `end`, `friend-code`, `error` and `banned`. The server is the referee: it checks every move with `packages/chess-core`, runs the clocks and decides results.

HTTP: `POST /api/register` (upgrades the current guest, keeping ratings), `POST /api/login`, `POST /api/logout`, `GET /api/me`, `GET /api/leaderboard?pool=blitz`, `GET /api/players/:name`, `GET /api/games/:id`, `GET /api/push/key`, `POST /api/push/subscribe {subscription, hour, tz}`, `POST /api/push/unsubscribe {endpoint}`, `GET /api/store`, `POST /api/store/checkout {product}`, `POST /api/store/dev/complete {order}` (dev mode), `POST /api/store/webhook`, and `/api/admin/*` for staff. `/api/me` and the `welcome` message carry the player's entitlements; clients never send them.

## Not production-ready yet

This is a single process with in-memory live games. Before launch it needs: TLS termination and a real domain, horizontal scaling (live games in Redis or sticky sessions), Postgres instead of SQLite, email verification and password reset, anti-cheat calibration on real games, backups, monitoring, and a privacy review. See `docs/planning`.
