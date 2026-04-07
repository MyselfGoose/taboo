# Backend

Node.js **Express** application with a **WebSocket** hub and a large **domain service** for all game rules.

## Entry points

| File | Role |
|------|------|
| [`backend/index.js`](../backend/index.js) | Calls `startServer()` |
| [`backend/src/server.js`](../backend/src/server.js) | `http.createServer(app)`, attach realtime hub, `listen`, graceful shutdown |
| [`backend/src/app.js`](../backend/src/app.js) | `createApp()` — middleware, routes, `app.locals` |

## Folder structure

| Path | Contents |
|------|----------|
| `src/config/env.js` | Environment → `config` object |
| `src/controllers/lobbyController.js` | HTTP handlers for lobbies, sessions, categories |
| `src/routes/lobbyRoutes.js` | `/api/lobbies`, `/api/sessions`, `/api/categories`, etc. |
| `src/routes/healthRoutes.js` | `/health`, `/ready`, `/` metadata |
| `src/services/lobbyService.js` | **Core game + lobby logic** (large file) |
| `src/services/datasetService.js` | Load `Dataset/taboo.json`, build shuffled decks |
| `src/repositories/*` | `sqlite*` and `inMemory*` persistence |
| `src/realtime/lobbyRealtimeHub.js` | WebSocket server, broadcast, ticker |
| `src/middleware/` | Request ID, logging, CORS, errors, 404 |
| `src/database/sqlite.js` | Open DB, `runMigrations`, pragmas |
| `src/utils/` | Validation, errors, logging, guess matching, codes |

## LobbyService (conceptual map)

`LobbyService` is the **authoritative** place for:

- Creating / joining lobbies, teams, ready flags  
- Starting the game when rules allow  
- **Turns**, **timers**, **deck/discard**, **scoring**  
- **Guesses**, **skips**, **taboo**, **review** workflow  
- **`toLobbySnapshot`** / **`toGameSnapshot`** for API + WS  
- **Match persistence** on `finishGame` when `MatchHistoryRepository` is configured  

Key methods to search for when reading code:

- `createLobby`, `joinLobby`, `restoreSession`  
- `setPlayerTeam`, `setPlayerReady`, `startGameIfAllReady`  
- `applyGameActionByPlayerId` — dispatches `game_action` strings  
- `advanceExpiredGames` — ticker entry point  
- `finishGame` — terminal state + optional SQLite match insert  

## Dataset

- File: [`Dataset/taboo.json`](../Dataset/taboo.json)  
- Loaded at startup by `DatasetService`; categories contain `question` (word to guess) and `options` (taboo words).

## Persistence modes

Controlled by env (see [`env.js`](../backend/src/config/env.js)):

- **SQLite** — default for sessions and (non-test) lobbies; single file under `DATA_DIR`.
- **In-memory** — used in tests or when SQLite flags are off; data lost on restart.

## HTTP middleware stack (typical)

- Helmet, CORS, compression, JSON body parser  
- Request ID + request logging  
- Rate limits on `/api` and sensitive POSTs  
- Error handler + 404  

## Development listen behavior

In **non-production**, the HTTP server binds to **127.0.0.1** by default unless `HOST` is set—this pairs with Vite’s proxy to `127.0.0.1:3000`. In production, bind all interfaces unless you set `HOST` explicitly.

## Testing

```bash
cd backend && npm test
```

Uses `NODE_ENV=test` and in-memory repositories by default for isolation.

## See also

- [API reference](api-reference.md)  
- [Database](database.md)  
- [Realtime system](realtime-system.md)  
