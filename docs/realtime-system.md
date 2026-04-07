# Realtime system

The multiplayer experience is built on a **single WebSocket endpoint** attached to the same HTTP server as Express.

## Endpoint

- **Path:** `/ws`
- **Development:** Browser connects to **`ws://localhost:<vite-port>/ws`** so Vite can **proxy** to the backend (see [`vite.config.js`](../frontend/vite.config.js)).
- **Production:** Typically **`wss://<api-host>/ws`** derived from `VITE_API_BASE_URL`.

## Connection lifecycle

1. Client opens WebSocket.
2. Client sends **`subscribe`** with:
   - `code` — lobby code  
   - `name` — player display name (must match an existing lobby member for that connection flow)  
   - `resumeToken` — optional; from HTTP create/join/restore  
3. Server validates the session, attaches the socket to the lobby, and replies **`subscribed`** with an initial lobby snapshot.
4. Further updates arrive as **`lobby_state`** messages.

## Server → client messages

| Type | Purpose |
|------|---------|
| `subscribed` | Handshake complete; includes `lobby` snapshot |
| `lobby_state` | Full lobby/game snapshot after any change; includes `reason` (e.g. `game_started`, `turn_started`, `guess_correct`) |
| `pong` | Response to app-level ping (used for liveness) |
| `error` | Structured failure; may include `code` such as `INVALID_SESSION`, `LOBBY_NOT_FOUND`, `PLAYER_NOT_FOUND` |

## Client → server messages

| Type | Fields | Purpose |
|------|--------|---------|
| `subscribe` | `code`, `name`, `resumeToken?` | Join the realtime room as a player |
| `set_ready` | `ready` boolean | Toggle ready; may start the game if everyone ready |
| `change_team` | `team` (`A` / `B`) | Move teams (rules may auto-unready) |
| `game_action` | `action`, plus action-specific fields | In-game commands (see [API reference](api-reference.md)) |

The hub implementation lives in [`lobbyRealtimeHub.js`](../backend/src/realtime/lobbyRealtimeHub.js).

## Broadcast model

When an action mutates state, the hub loads the lobby and calls **`toLobbySnapshot(lobby, { viewerPlayerId })`** **per socket** so each player receives the correct **card visibility** and **permissions**.

## Reconnection and disconnect grace

- Brief disconnects use a **grace period** (`PLAYER_DISCONNECT_GRACE_MS`, default 30s) so players don’t vanish from others’ screens instantly.
- On reconnect, the client sends **`subscribe`** again with the stored **`resumeToken`** when available.
- The React app tracks **`connectionState`** (`connected`, `reconnecting`, `disconnected`) and keeps the last snapshot visible while offline where possible.

## Server ticker

A **1-second interval** in the WebSocket hub calls **`lobbyService.advanceExpiredGames(now)`** and broadcasts any lobbies that changed—so timers expire without a client ping.

## Heartbeat

The server periodically **pings** WebSocket clients (TCP-level) to drop dead connections; the client also uses application-level ping/pong in [`LobbyContext`](../frontend/src/context/LobbyContext.jsx).

## Security notes (high level)

- Game actions are accepted **only** for sockets that completed **`subscribe`** with a valid session.
- There is **no end-user authentication**; possession of the resume token and name effectively identifies the seat—fine for a party game, not for high-assurance identity.

## See also

- [API reference](api-reference.md) — full `game_action` list  
- [Frontend](frontend.md) — `LobbyContext` and `sendLobbyAction`  
- [Architecture](architecture.md) — authority model  
