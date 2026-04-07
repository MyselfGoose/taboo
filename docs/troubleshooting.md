# Troubleshooting

Quick **symptom → cause → fix** reference for local and deployed setups.

## Backend won’t start: `EADDRINUSE`

**Symptom:** `listen EADDRINUSE` on port 3000 (or your `PORT`).

**Cause:** Another process is already bound to that port (often a leftover Node from a crashed dev server).

**Fix:**

- Run `./start.sh` from the repo root (it **reclaims** the backend port by default).  
- Or: `./start.sh --kill-existing` if the frontend port is stuck too.  
- Or manually: `lsof -i :3000` then stop the listed PID.  
- Or set `PORT=3001` (and point Vite proxy / `VITE_API_BASE_URL` accordingly).

## Frontend: CORS or failed fetch to API

**Symptom:** Browser console shows CORS errors or `net::ERR_FAILED` when calling the API from `http://localhost:5173`.

**Cause (dev):** Hitting **`http://127.0.0.1:3000`** directly from a page served as **`http://localhost:5173`** is a **different origin**; if the backend is down or returns a non-CORS error page, the browser reports CORS.

**Fix (dev):** Open the app at **`http://localhost:5173`** and let **Vite proxy** `/api` and `/ws` to the backend (see [`vite.config.js`](../frontend/vite.config.js)). The frontend in dev uses **`window.location.origin`** for API calls so traffic stays same-origin to Vite.

**Cause (prod):** `ALLOWED_ORIGINS` missing or wrong.

**Fix (prod):** Set `ALLOWED_ORIGINS` to the **exact** frontend origin (scheme + host + port), no trailing slash.

## `./start.sh` times out waiting for backend

**Symptom:** `Backend did not become ready within 40s`.

**Cause:** Backend crashed on startup (see logs with `[backend]` prefix) or listens on a host/port curl doesn’t hit.

**Fix:** Run `cd backend && npm run dev` in the foreground and read the stack trace; verify `curl http://127.0.0.1:3000/health` matches your `PORT` / `HOST`.

## WebSocket disconnects or never connects

**Symptom:** Stuck on “Reconnecting…” or WS errors in the console.

**Checks:**

- Backend is running and `/health` works.  
- In **dev**, WS URL should be `ws://localhost:5173/ws` (proxied), not hard-coded to the wrong host.  
- In **prod**, page is **HTTPS** → API must be **HTTPS** / **WSS**.  
- Corporate proxies / mixed content blocking.

## SQLite errors or empty leaderboard

**Symptom:** Leaderboard always empty; or startup error opening DB.

**Cause:** SQLite disabled (`USE_SQLITE_*`), or **`DATA_DIR`** not writable, or file locked.

**Fix:** Ensure `DATA_DIR` exists and is writable; enable SQLite flags; check server logs.

## Session restore fails after deploy

**Symptom:** `INVALID_SESSION`, `LOBBY_NOT_FOUND`, or forced logout.

**Cause:** Backend restarted with **in-memory** stores; lobby TTL expired; wrong API URL (different backend).

**Fix:** Use persistent SQLite for lobbies/sessions if you need long-lived rooms; ensure `VITE_API_BASE_URL` points to the same backend players use.

## Tests fail locally

```bash
(cd backend && npm test)
(cd frontend && npm test -- --run)
```

**Cause:** Wrong Node version, stale `node_modules`.

**Fix:** Node 20+; delete `node_modules` and reinstall if needed.

## Still stuck?

1. Capture **backend logs** and **browser console** + Network tab for the failing request.  
2. Confirm **one** backend instance owns port **`PORT`**.  
3. Re-read [Getting started](getting-started.md) and [Deployment](deployment.md) for your environment.

## See also

- [Realtime system](realtime-system.md)  
- [Frontend](frontend.md) — proxy and API base URL  
