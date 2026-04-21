# Kukana Uptime

Simple uptime monitoring app with:

- **Node.js + TypeScript backend** (Express API + scheduler)
- **React frontend** (built with Vite)
- **Config-driven checks** for `http` and `tcp` targets
- **Runtime config reload** with file watching

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
src/            # backend (API, scheduler, checker, state)
web/src/        # React app source
web/dist/       # built frontend assets
config.json     # monitor configuration
dist/           # compiled backend output
```

## Requirements

- Node.js 18+ (Node 20+ recommended)
- npm

## Installation

```bash
npm install
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

Frontend runs on `http://127.0.0.1:5175` and proxies `/api` to `http://127.0.0.1:3000`.

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

Server default port is `3000`.

## Configuration

Config path is `./config.json` by default.

You can override with environment variable:

```bash
CONFIG=/path/to/config.json npm start
```

Example config:

```json
{
  "appTitle": "Kukana - Uptime Dashboard",
  "intervalSeconds": 30,
  "groups": [
    {
      "name": "Web",
      "alerts": {
        "channel": "email",
        "destination": "oncall@example.com"
      },
      "targets": [
        {
          "name": "Main Site",
          "type": "http",
          "url": "https://example.com",
          "alerts": {
            "enabled": true
          }
        }
      ]
    },
    {
      "name": "Infra",
      "targets": [
        {
          "name": "Redis",
          "type": "tcp",
          "host": "127.0.0.1",
          "port": 6379
        }
      ]
    }
  ]
}
```

- `appTitle` controls the dashboard heading and browser tab title.
- If `appTitle` is omitted or blank, the app uses `Kukana - Uptime Dashboard`.

### Alerting behavior

- Alerts are configured at **group** level (`alerts.channel` + `alerts.destination`).
- Each **target** can enable/disable alerts with `target.alerts.enabled` (defaults to `true`).
- Alerts are sent on status transitions only (`UP -> DOWN` and `DOWN -> UP`).
- `email` alerts are implemented as a starter logger pipeline (ready for SMTP provider wiring).
- `sms` is available in config/UI as a placeholder channel for future provider integration.

### Alerting environment variables

- `ALERT_FROM_EMAIL` (optional): sender used by email alerts, default is `kukana-uptime@localhost`.

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

Maps:

- Container `3000` -> Host `3333`
- Local `config.json` mounted into container