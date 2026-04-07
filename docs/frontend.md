# Frontend

**React 19** single-page app built with **Vite**, **React Router**, **Tailwind CSS**, and **Framer Motion**.

## Entry and shell

| File | Role |
|------|------|
| [`frontend/src/main.jsx`](../frontend/src/main.jsx) | Mount root, `BrowserRouter`, `LobbyProvider` |
| [`frontend/src/App.jsx`](../frontend/src/App.jsx) | Renders `AppRouter` |
| [`frontend/src/router/AppRouter.jsx`](../frontend/src/router/AppRouter.jsx) | Route table |

## Routes

| Path | Page | Purpose |
|------|------|---------|
| `/` | `LandingPage` | Create or join lobby |
| `/how-to-play` | `HowToPlayPage` | Player-facing rules |
| `/leaderboard` | `LeaderboardPage` | Stats / recent matches (HTTP) |
| `/lobby/:code` | `LobbyPage` | Teams, ready, pre-game |
| `/game/:code` | `GamePage` | Active match UI |

Unknown paths redirect to `/`.

## State and realtime

### `LobbyContext`

[`frontend/src/context/LobbyContext.jsx`](../frontend/src/context/LobbyContext.jsx) holds:

- **`lobbySession`** — code, player id/name, `resumeToken`, latest `lobby` snapshot  
- **WebSocket** lifecycle — connect when `code` + `playerName` exist, reconnect with backoff  
- **`sendLobbyAction`** — sends JSON messages (`set_ready`, `change_team`, `game_action`, …)  
- **`connectionState`**, **`lastStateReceivedAt`** — UX for reconnect banner / sync hint  
- **Session restore** on load via `POST /api/sessions/restore`  

### Session storage

[`frontend/src/utils/sessionStore.js`](../frontend/src/utils/sessionStore.js) persists session fields in **sessionStorage** so refresh can resume.

### API helpers

[`frontend/src/api/lobbyApi.js`](../frontend/src/api/lobbyApi.js):

- **`VITE_API_BASE_URL`** overrides the base when set.  
- In **development**, base URL is **`window.location.origin`** so fetches go to **Vite** and are **proxied** to the backend (`/api`, `/ws` in `vite.config.js`).  
- **`getLobbyWebSocketUrl()`** in dev uses **`ws(s)://<current-host>/ws`** for the same reason.

## Key pages (behavioral)

- **Landing** — loads categories, create/join forms, navigates to lobby or game based on restored session.  
- **Lobby** — team switches, ready toggles (WS).  
- **Game** — phase panels, card area, guess input, taboo button, review UI, activity feed, overlays; uses snapshot `permissions` + `connectionState` to disable actions when offline.  
- **Leaderboard** — `GET /api/leaderboard` and `GET /api/matches/recent`.  

## UI components

- [`frontend/src/components/ui/`](../frontend/src/components/ui/) — Button, Card, Input, Select, dialogs, etc.  
- [`frontend/src/components/game/GameFeedbackOverlay.jsx`](../frontend/src/components/game/GameFeedbackOverlay.jsx) — full-screen feedback pulses  
- Theme/motion presets in [`frontend/src/theme/`](../frontend/src/theme/)

## Styling

Tailwind v4 via `@tailwindcss/vite`; global styles in [`frontend/src/`](../frontend/src/) as imported by `main.jsx`.

## Build and preview

```bash
cd frontend
npm run build    # output: dist/
npm run preview  # optional local preview of dist
```

Production hosting must set **`VITE_API_BASE_URL`** to the real API origin and support **SPA fallback** to `index.html` (see [`public/_redirects`](../frontend/public/_redirects) for hosts that honor it).

## Testing

```bash
cd frontend && npm test -- --run
```

Vitest + Testing Library; WebSocket and `fetch` are mocked in tests.

## See also

- [Realtime system](realtime-system.md)  
- [Getting started](getting-started.md) — proxy and dev URLs  
- [API reference](api-reference.md)  
