# Getting started

This guide gets you from **zero** to a **running game** on your machine.

## Prerequisites

- **Node.js 20+** (Vite 7 and recent tooling expect a current Node)
- **npm**
- **curl** — used by `./start.sh` to wait for `/health`
- **lsof** — used by `./start.sh` to detect or free ports

On Linux, install `curl` and `lsof` via your package manager if missing.

## Clone and install

```bash
git clone <repository-url>
cd taboo
```

Install dependencies once per package:

```bash
(cd backend && npm install)
(cd frontend && npm install)
```

## Run with `./start.sh` (recommended)

From the **repository root**:

```bash
chmod +x start.sh   # once, if needed
./start.sh
```

What it does:

- Ensures `node_modules` exist (or runs `npm install`)
- Frees the **backend port** if something is already listening (default reclaim; see env below)
- Starts **backend** (`backend/npm run dev`) and **frontend** (`frontend/npm run dev -- --port 5173`)
- Waits until `http://127.0.0.1:<PORT>/health` responds

Open the **frontend URL** printed in the log (typically `http://localhost:5173`).

### `start.sh` options

| Flag | Meaning |
|------|---------|
| `--backend-only` | Start API only |
| `--frontend-only` | Start Vite only |
| `--kill-existing` | Also clear the **frontend** port if busy |
| `--skip-install` | Don’t auto-run `npm install` |
| `--help` | Usage |

### Environment variables for `start.sh`

| Variable | Default | Meaning |
|----------|---------|---------|
| `BACKEND_PORT` | `3000` or `PORT` from `backend/.env` | API port |
| `FRONTEND_PORT` | `5173` | Vite port |
| `TABOO_AUTO_RECLAIM_BACKEND_PORT` | `1` | If `1`, kill listeners on backend port before start; set `0` to disable |

## Run manually (two terminals)

**Terminal 1 — backend**

```bash
cd backend
npm run dev
```

In development the server binds to **127.0.0.1** by default (see `HOST` in [deployment.md](deployment.md)).

**Terminal 2 — frontend**

```bash
cd frontend
npm run dev
```

The Vite dev server proxies **`/api`** and **`/ws`** to `http://127.0.0.1:3000`, so open **`http://localhost:5173`** (not raw `127.0.0.1:3000` in the browser for the UI).

## Environment variables (backend)

The backend reads configuration from **`process.env`**. The canonical list is in [`backend/src/config/env.js`](../backend/src/config/env.js).

Commonly adjusted:

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP port (default `3000`) |
| `HOST` | Bind address; empty string = all interfaces; unset in dev uses `127.0.0.1` |
| `NODE_ENV` | `development` / `production` / `test` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins in production |
| `USE_SQLITE_SESSIONS` | `true`/`false` — persist sessions in SQLite |
| `USE_SQLITE_LOBBIES` | `true`/`false` — persist lobbies in SQLite |
| `DATA_DIR` | Directory for `sessions.db` (default `./data`) |
| `SESSION_DB_FILE` | SQLite filename inside `DATA_DIR` |
| `PLAYER_DISCONNECT_GRACE_MS` | How long to keep a disconnected player in the lobby (`0` = immediate removal) |

See [deployment.md](deployment.md) for production-focused notes.

## Frontend environment

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Override API base (required for typical production static hosting) |

In **development**, the app uses **`window.location.origin`** so requests hit the Vite proxy. See [frontend.md](frontend.md).

## First happy path

1. Open the frontend URL.
2. **Create** a lobby (name, rounds, timer, category).
3. Copy the **4-letter code**.
4. In another browser (or incognito), **Join** with a second name and the code.
5. Move players to **different teams** so both Team Alpha and Team Beta have at least one player.
6. Everyone toggles **Ready**; the game starts when all are ready.
7. The active **clue giver** starts the turn; teammates guess; opponents can call **Taboo** when appropriate.

## Verify the backend

```bash
curl -s http://127.0.0.1:3000/health
```

Expect JSON with a healthy status.

## Run tests

```bash
(cd backend && npm test)
(cd frontend && npm test -- --run)
```

## See also

- [Troubleshooting](troubleshooting.md) — when something fails  
- [Architecture](architecture.md) — mental model  
- [Realtime system](realtime-system.md) — WebSocket details  
