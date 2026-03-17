# Free Deployment Guide

## Overview
- Frontend: Cloudflare Pages (static hosting).
- Backend: Render Web Service (Node.js with WebSockets).
- Keep the backend single-instance because game state and timers are process-local.

## Backend (Render)
1. Create a new Web Service from your Git repo.
2. Set the root directory to `backend`.
3. Use the start command `npm start`.
4. Render installs dependencies automatically; no custom build command is required.

Environment variables to set:
- `NODE_ENV=production`
- `ALLOWED_ORIGINS=https://your-frontend-domain`
- `USE_SQLITE_SESSIONS=false` if you want purely in-memory sessions
- `USE_SQLITE_LOBBIES=false` if you want purely in-memory lobbies
- `DATA_DIR=./data` if you keep SQLite enabled

Notes:
- Free-tier instances can spin down when idle, so expect cold starts.
- If the instance restarts, any in-memory lobbies are lost.

## Frontend (Cloudflare Pages)
1. Create a new Pages project from your Git repo.
2. Set the root directory to `frontend`.
3. Build command: `npm run build`.
4. Build output directory: `dist`.

Environment variables to set:
- `VITE_API_BASE_URL=https://your-backend-domain`

SPA routing:
- The file `frontend/public/_redirects` is included to route all paths to `index.html`.
- If your host does not honor `_redirects`, configure an SPA fallback to `index.html` in the host UI.

## Verification
1. Open the frontend in a browser.
2. Create a lobby and join from a second device.
3. Confirm lobby updates stream in real time.
4. Refresh and confirm session restore works while the backend stays up.

## Troubleshooting
- CORS errors: confirm `ALLOWED_ORIGINS` matches the exact frontend origin, with no trailing slash.
- WebSocket errors: if the frontend is on HTTPS, the backend URL should also be HTTPS so the socket uses `wss://`.
