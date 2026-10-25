# Deploying Chacklate Chess

One container runs everything players and staff touch: the website (`/`), the game (`/play`, installable as an app), the admin console (`/admin`), the JSON API and WebSocket play (`/ws`). Caddy in front provides HTTPS with automatic certificates.

## First deploy on one Linux host

You need a machine with Docker, a domain whose DNS `A` record points at it, and ports 80 and 443 open.

```sh
git clone https://github.com/luvkesh/Chess.git && cd Chess/deploy
cp .env.example .env        # set the domain, admin login, and mail settings
docker compose up -d --build
```

Then open `https://<your domain>/admin`, sign in with the admin email and password from `.env`, and change the password. `docker compose logs -f app` shows the server log.

## Configuration

All settings are environment variables in `.env`; `.env.example` lists every one with a comment. The ones that matter on day one:

| Variable | What it does |
| --- | --- |
| `CHACKLATE_DOMAIN`, `CHACKLATE_PUBLIC_URL` | Where players reach you. Email links use the public URL. |
| `CHACKLATE_ADMIN_EMAIL`, `CHACKLATE_ADMIN_PASSWORD` | First staff account, created once when there is no staff yet. |
| `CHACKLATE_MAIL`, `CHACKLATE_MAIL_KEY`, `CHACKLATE_MAIL_FROM` | `log` prints emails; `http` sends through a Resend-compatible API. Password reset needs real email. |
| `CHACKLATE_PAYMENTS` | `off` until a payment provider is connected. `dev` completes purchases for free, so never use it in production. |
| `CHACKLATE_PUSH_SUBJECT` | Contact address push services can reach about notifications. |

## Health, backups and restore

- `GET /api/health` returns 200 with uptime and live counts when the server and database are fine, 503 otherwise. Docker's health check uses it; point your uptime monitor at it too.
- The `backup` service writes a consistent copy of the database to `deploy/backups/` once a day and keeps the newest 14. Copy that folder off the machine (object storage or another host): a backup on the same disk is not a backup.
- Take one by hand at any time: `docker compose exec app node src/cli.js backup /data/backups`.
- Restore: `docker compose stop app`, copy the chosen file over the volume's `chacklate.db` (for example `docker compose cp ./backups/chacklate-YYYYMMDD-HHMMSS.db app:/data/chacklate.db`), delete `chacklate.db-wal` and `chacklate.db-shm` if present, then `docker compose start app`.
- `docker compose exec app node src/cli.js verify-audit` checks the admin audit chain.

## Updating

`git pull && docker compose up -d --build`. Live games are in memory, so a restart ends games in progress; deploy at a quiet hour. Database changes are applied automatically on start.

## Limits of this setup

One process on one machine: fine for launch-scale traffic (thousands of concurrent players), not for more. Scaling out needs shared state for live games (Redis or sticky sessions per game) and Postgres instead of SQLite; the storage layer (`services/game-server/src/db.js`) is the only place that talks SQL directly.
