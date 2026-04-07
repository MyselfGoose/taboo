# Contributing

Thanks for helping improve Taboo. This document is for **developers** extending or fixing the repo.

## Project norms

- **Match existing style** — formatting, naming, and file layout in nearby code.
- **Keep changes focused** — avoid unrelated refactors in the same PR.
- **Add or update tests** when behavior changes (backend `node --test`, frontend Vitest).

## Local workflow

```bash
./start.sh
# or separate terminals: backend npm run dev, frontend npm run dev
```

```bash
(cd backend && npm test)
(cd frontend && npm test -- --run)
```

```bash
(cd frontend && npm run lint)
```

## Adding a new `game_action`

1. **Server:** Handle the action in `LobbyService.applyGameActionByPlayerId` (and any helpers). Enforce **role and phase** with `AppError` and clear codes.
2. **Snapshot:** Extend `toGameSnapshot` / permissions if the UI needs new toggles.
3. **WebSocket:** No hub change usually—hub forwards `game_action` payloads.
4. **Client:** Call `sendLobbyAction({ type: 'game_action', action: '...', ... })` from the right UI control; gate on `permissions` and `connectionState`.
5. **Docs:** Update [api-reference.md](api-reference.md) and [game-logic.md](game-logic.md).
6. **Tests:** Add a backend unit or integration test; update frontend tests if UI contract changes.

## Documentation

- User-facing rule changes should stay consistent with **`/how-to-play`** in the app.
- Technical truth lives in **`docs/`** and code.

## Commit messages

Use clear, imperative summaries (e.g. “Fix deck reshuffle when discard is empty”). Link issues if applicable.

## See also

- [Architecture](architecture.md)  
- [API reference](api-reference.md)  
