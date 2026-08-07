# Kukana Uptime

Simple uptime monitoring app with:

- **Node.js + TypeScript backend** (Express API + scheduler)
- **React frontend** (built with Vite)
- **Config-driven checks** for `http`, `tcp`, and ICMP `ping` targets
- **SQLite-backed persistence** for status/history and configuration sets

## Features

- Grouped uptime dashboard
- Per-target status (`UP` / `DOWN`) and latency
- Small latency sparkline history per target
- Built-in config editor in the web UI
- Save config through API and auto-reload monitor config
- Configurable alerts per group/target (email now, SMS-ready)

## Tech Stack

- Backend: `Node.js`, `TypeScript`, `Express`, `chokidar`
- Frontend: `React 18`, `Vite`

## Project Structure

```text
src/            # backend (API, scheduler, checker, state, config store)
web/src/        # React app source
web/dist/       # built frontend assets
data/uptime.db  # sqlite database (status/history + configuration sets)
dist/           # compiled backend output
```

## Requirements

- Node.js 18+ (Node 20+ recommended)
- npm

## Installation

```bash
npm install
```

Create central app environment file:

```bash
cp .env.example .env
```

## Run in Development

Use two terminals:

1. Build backend once (or rebuild when backend code changes), then run server:

```bash
npm run build:server
npm start
```

2. Run frontend dev server:

```bash
npm run dev:web
```

Frontend host/port/proxy are configured via `.env` (`VITE_DEV_HOST`, `VITE_DEV_PORT`, `VITE_API_PROXY_TARGET`).

## Production Build

```bash
npm run build
```

This builds:

- Backend TypeScript to `dist/`
- Frontend bundle to `web/dist/`

Then start the app:

```bash
npm start
```

Server port is configured with `.env` (`PORT`, default in this repo: `3005`).

## Configuration

App runtime settings are centralized in `.env`:

- Backend: `PORT`, `DB_PATH`, `ALERT_FROM_EMAIL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`
- Frontend (Vite): `VITE_DEV_HOST`, `VITE_DEV_PORT`, `VITE_API_PROXY_TARGET`
- Docker/cloudflared: `TUNNEL_TOKEN`

`DB_PATH` defaults to `./data/uptime.db` and stores configuration sets plus monitoring history.
To load exported sets directly into SQLite, use the seed script:

```bash
sqlite3 ./data/uptime.db < ./data/config_sets_seed.sql
```

### Alerting behavior

- Alerts are configured at **group** level and can be disabled, sent by email, sent by SMS, or sent through both channels.
- Each **target** can enable/disable alerts with `target.alerts.enabled` (defaults to `true`).
- A `DOWN` alert is sent only when at least one configured threshold is met:
  - `alerts.downAfterMinutes`: send after target has been continuously down for this duration.
  - `alerts.downAfterChecks`: send after this many consecutive failed checks.
- If both thresholds are set, the alert triggers when either threshold is reached.
- Repeated `DOWN` alerts are rate-limited by `alerts.repeatDownEveryMinutes` (default: `30`).
- `UP` recovery alerts are sent once when the target comes back online after an alerted outage, including total downtime.
- `sms` is available in config/UI as a placeholder channel for future provider integration.

### Alerting environment variables

- `ALERT_FROM_EMAIL` (optional): sender used by email alerts, default is `kukana-uptime@localhost`.
- `SMTP_HOST`: SMTP server host for email delivery (required for real email sending).
- `SMTP_PORT`: SMTP server port (required for real email sending).
- `SMTP_SECURE` (optional): set to `true` for SMTPS/TLS ports.
- `SMTP_USER` / `SMTP_PASS` (optional): SMTP authentication credentials.

## API Endpoints

- `GET /api/status` – current status for all targets
- `GET /api/history` – sparkline history points
- `GET /api/config` – current config
- `POST /api/config` – save updated config JSON

## Docker

Build image:

```bash
npm run build:docker
```

Run container:

```bash
npm run start:docker
```

`docker-compose.yml` (local) loads shared variables from `.env`.

Maps:

- Container `3000` -> Host `3333`
- Local `config.json` mounted into container
- With `docker-compose.yml`, Mailpit is included for local email testing:
  - App SMTP points to `mailpit:1025`
  - Mailpit UI is exposed on `http://localhost:8025`

---

## Production deployment (Docker + Cloudflare Tunnel + Gmail SMTP)

This repository includes everything you need to deploy the app on a Docker host and expose it through a Cloudflare Tunnel. Outgoing alerts use Gmail SMTP (via a Gmail App Password).

### What’s included

- `.env.prod` – production environment variables preset for Gmail and Cloudflare Tunnel
- `docker-compose.prod.yml` – production compose stack (app + persistent volume + cloudflared sidecar)
- `scripts/deploy.sh` – one‑command build and deploy
- `scripts/publish.sh` – build and publish to local Docker registry
- `scripts/update.sh` – rebuild and recreate containers with minimal downtime
- `scripts/logs.sh` – follow logs
- `scripts/status.sh` – show service status
- `scripts/down.sh` – stop the stack
- `scripts/backup.sh` – copy a timestamped backup of the SQLite DB from the container

### Prerequisites

- A Linux/macOS host with Docker Engine and Docker Compose plugin installed
- A Cloudflare account and a configured Tunnel (you’ll need a Tunnel token)
- A Gmail account with 2‑step verification enabled and a generated Gmail App Password

### 1) Configure Gmail SMTP

Gmail requires an App Password when using SMTP:

1. Enable 2‑step verification for your Gmail account.
2. Create a new App Password (choose “Mail” as the app, any device).
3. In `.env.prod`, set:

```
ALERT_FROM_EMAIL=your_gmail_address@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_gmail_address@gmail.com
SMTP_PASS=the_16_character_app_password
```

### 2) Configure Cloudflare Tunnel

1. Create a Tunnel in Cloudflare Zero Trust (if you don’t have one).
2. Copy the `TUNNEL_TOKEN` for the tunnel instance you will run on the host.
3. Paste it into `.env.prod` as `TUNNEL_TOKEN=...`.

The `cloudflared` service in `docker-compose.prod.yml` will start with this token and expose the app.

### 3) Adjust optional settings

- `PORT=3000` is the internal app port used in production (mapped to `3333` on the host by default).
- `DB_PATH=./data/uptime.db` controls SQLite location inside the container; a Docker volume `uptime-data` persists it.

### 4) Deploy

On the target host:

```bash
cd /path/to/Kukana-Uptime
cp .env.prod .env.prod.backup-$(date +%Y%m%d-%H%M%S)   # optional backup before edits
# Edit .env.prod and set the values described above

./scripts/deploy.sh
```

What happens:

- Builds the `kukana-uptime` image (if needed)
- Starts the app and `cloudflared` defined in `docker-compose.prod.yml`
- Creates/uses a persistent volume `uptime-data` for the database

Access:

- Via Cloudflare public hostname associated with your tunnel (e.g., `https://uptime.example.com`)
- Locally on the host at `http://localhost:3333`

### 5) Build and Publish to Registry

If you have a local Docker registry (e.g., `Kukana-Registry` on `tnum-services:5000`), you can streamline updates by building and pushing from your development machine.

1. Ensure `REGISTRY_URL` is set in `.env.prod`.
2. Run the publish script:

```bash
npm run publish
```

This will build the production image, tag it for your registry, and push both the versioned tag and `latest`.

### 6) Operations

- Update and redeploy (rebuild + recreate containers):

```bash
./scripts/update.sh
```

- View logs (all services or a specific one like `kukana-uptime` or `cloudflared-uptime`):

```bash
./scripts/logs.sh              # all
./scripts/logs.sh kukana-uptime
./scripts/logs.sh cloudflared-uptime
```

- Show status:

```bash
./scripts/status.sh
```

- Stop the stack:

```bash
./scripts/down.sh
```

- Backup the SQLite database from the running container:

```bash
./scripts/backup.sh                 # saves to ./backups/uptime-YYYYmmdd-HHMMSS.db
./scripts/backup.sh /mnt/backupdir  # custom directory
```

### Production environment variables

The production presets live in `.env.prod` and include:

- `NODE_ENV=production`
- `APP_VERSION=1.1.0`
- `PORT=3000`
- `CONFIG=./config.json`
- `DB_PATH=./data/uptime.db`
- `ALERT_FROM_EMAIL` – sender address for alerts (set to your Gmail)
- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=465`
- `SMTP_SECURE=true`
- `SMTP_USER` – your full Gmail address
- `SMTP_PASS` – your Gmail App Password (16 chars)
- `TUNNEL_TOKEN` – Cloudflare Tunnel token used by `cloudflared`
- `REGISTRY_URL` – local Docker registry URL (e.g., `tnum-services:5000`)

Note: For development, the backend default port in code is `3005`. The production compose maps container `3000` to host `3333`.
