# Deployment

This project is typically deployed as:

- **Static frontend** (e.g. Cloudflare Pages, Netlify, Vercel static)
- **Single Node backend** with **WebSocket** support (e.g. Render, Fly.io, Railway)

Game state and timers are **process-local** today—run **one** backend instance per environment (or accept that multiple instances would not share lobbies without further engineering).

## Frontend build

```bash
cd frontend
npm run build
```

Output: **`dist/`**.

Set **`VITE_API_BASE_URL`** at build time to your **public API origin**, e.g. `https://api.example.com` (no trailing slash). The client will call `https://api.example.com/api/...` and `wss://api.example.com/ws`.

## SPA routing

Hosts must serve **`index.html`** for client-side routes (`/lobby/...`, `/game/...`). This repo includes [`frontend/public/_redirects`](../frontend/public/_redirects) for providers that honor it; others need an equivalent fallback rule.

## Backend run

```bash
cd backend
NODE_ENV=production npm start
```

Uses `node index.js` (see [`backend/package.json`](../backend/package.json)).

## Environment variables (production)

| Variable | Notes |
|----------|--------|
| `NODE_ENV` | `production` |
| `PORT` | Listen port (platform often injects this) |
| `HOST` | Set to `0.0.0.0` or empty if the platform requires listening on all interfaces |
| `ALLOWED_ORIGINS` | **Comma-separated** exact frontend origins, **no trailing slash** (e.g. `https://taboo.example.com`) |
| `TRUST_PROXY` | Set appropriately behind a reverse proxy (see [`env.js`](../backend/src/config/env.js)) |
| `USE_SQLITE_SESSIONS` / `USE_SQLITE_LOBBIES` | `true` for persistence across restarts; `false` for ephemeral in-memory (data lost on restart) |
| `DATA_DIR` | Writable path for `sessions.db` when SQLite is on |
| `SESSION_DB_FILE` | Optional custom filename |

Optional tuning (defaults usually fine):

- `LOBBY_TTL_MINUTES`, `SESSION_TTL_MINUTES`, `MAX_ACTIVE_LOBBIES`, `PLAYER_DISCONNECT_GRACE_MS`, etc.

## HTTPS and WebSockets

- Frontend on **HTTPS** must use **`wss://`** to the API—set `VITE_API_BASE_URL` to **`https://...`** so the client derives the correct WebSocket URL.
- Mixed content (HTTPS page → `ws://` API) will be blocked by browsers.

## CORS

In production, **`ALLOWED_ORIGINS`** must include the **exact** browser origin of your SPA. Development mode is permissive; production is not.

## Free-tier caveats

Cold starts and restarts wipe **in-memory** lobbies. Use **SQLite on a persistent disk** if you need lobbies to survive restarts on a single instance.

## Reference deployment write-up

See also the repository’s **[`DEPLOYMENT.md`](../DEPLOYMENT.md)** for a concrete Cloudflare + Render style walkthrough.

## See also

- [Getting started](getting-started.md) — local `HOST` / bind behavior  
- [Troubleshooting](troubleshooting.md) — CORS and WS issues  
- [Database](database.md) — SQLite file location  
