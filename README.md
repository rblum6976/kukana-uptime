# Kukana Uptime

Simple uptime monitoring app with:

- **Node.js + TypeScript backend** (Express API + scheduler)
- **React frontend** (built with Vite)
- **Config-driven checks** for `http` and `tcp` targets
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

- Alerts are configured at **group** level (`alerts.channel` + `alerts.destination`).
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

`docker-compose.yml` loads shared variables from `.env`.

Maps:

- Container `3000` -> Host `3333`
- Local `config.json` mounted into container
- With `docker-compose.yml`, Mailpit is included for local email testing:
  - App SMTP points to `mailpit:1025`
  - Mailpit UI is exposed on `http://localhost:8025`