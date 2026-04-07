# API reference

Base path for REST: **`/api`**. Health checks are at the **server root** (not under `/api`).

Unless noted, requests and responses use **JSON** with `Content-Type: application/json`.

## HTTP — Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness payload for load balancers |
| GET | `/ready` | Readiness (if extended later) |
| GET | `/` | Simple service metadata |

## HTTP — Lobbies and sessions

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/lobbies` | Create lobby; body includes `name`, `roundCount`, `roundDurationSeconds`, `categoryMode`, `categoryIds` |
| POST | `/api/lobbies/join` | Join lobby; body `name`, `code` |
| POST | `/api/sessions/restore` | Restore session; body `code`, `resumeToken` |
| GET | `/api/categories` | List dataset categories |
| GET | `/api/lobbies/:code` | Fetch lobby snapshot (unauthenticated; code in path) |

## HTTP — Match history

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/matches/recent?limit=` | Recent finished games (empty if no DB repo) |
| GET | `/api/leaderboard?limit=` | High scores + top players aggregates |

## Typical response shapes

- **Create / join / restore** return `code`, `playerId`, `playerName`, `resumeToken` (where applicable), and `lobby` — a **public snapshot** from `toLobbySnapshot` without a viewer id (HTTP paths may expose less role-specific detail than WS).

- **Errors** go through the error middleware: JSON body with an `error` message and HTTP status; some include a machine-readable `code`.

Exact field lists change with the service; prefer reading **`toLobbySnapshot`** / **`toGameSnapshot`** in [`lobbyService.js`](../backend/src/services/lobbyService.js) when integrating.

## WebSocket — connection

- **URL:** `/ws` (see [Realtime system](realtime-system.md) for dev vs prod).

## WebSocket — client messages

### `subscribe`

```json
{
  "type": "subscribe",
  "code": "ABCD",
  "name": "Alice",
  "resumeToken": "<optional>"
}
```

### `set_ready`

```json
{ "type": "set_ready", "ready": true }
```

### `change_team`

```json
{ "type": "change_team", "team": "A" }
```

### `game_action`

```json
{
  "type": "game_action",
  "action": "<name>",
  "guess": "<for submit_guess>",
  "vote": "fair | not_fair for review_vote"
}
```

## `game_action` values

| Action | Extra fields | Who (typical) |
|--------|----------------|---------------|
| `start_turn` | — | Active clue giver |
| `submit_guess` | `guess` | Teammate guesser |
| `skip_card` | — | Active clue giver |
| `taboo_called` | — | Opponent observer |
| `request_review` | — | Penalized team (when review available) |
| `dismiss_review` | — | Penalized team |
| `review_vote` | `vote`: `fair` \| `not_fair` | Penalized team members during review |
| `review_continue` | — | Active clue giver after resolved review |

The server returns a **WS error** message if the action is invalid for the current role or phase.

## WebSocket — server messages

### `subscribed`

```json
{
  "type": "subscribed",
  "lobby": { }
}
```

### `lobby_state`

```json
{
  "type": "lobby_state",
  "reason": "turn_started",
  "lobby": { }
}
```

### `error`

```json
{
  "type": "error",
  "code": "INVALID_SESSION",
  "message": "..."
}
```

## Rate limiting

Express **`express-rate-limit`** applies to `/api` and stricter limits on selected POST routes—tune in [`app.js`](../backend/src/app.js).

## See also

- [Realtime system](realtime-system.md)  
- [Game logic](game-logic.md)  
- [Troubleshooting](troubleshooting.md)  
