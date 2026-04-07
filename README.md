# Taboo — Real-Time Party Word Game

A **browser-based Taboo-style party game** for two teams. Players join a shared lobby, split into **Team Alpha** and **Team Beta**, and take turns giving clues and guessing words while opponents watch for **forbidden (taboo) words**. Game rules, scoring, timers, and turn flow are enforced **on the server**; every client stays in sync through **WebSockets**.

**Live rules for players** are also available in-app at **How to Play** (`/how-to-play`). Technical documentation lives in [`docs/`](docs/README.md).

---

## Why this project stands out

- **Authoritative server design** — Clients cannot “cheat” the score or turn order; all actions go through validated APIs and WebSocket messages.
- **Real-time collaboration** — Lobby roster, ready states, and in-game updates broadcast as **role-aware snapshots** (e.g. teammates don’t see the card the same way the clue giver does).
- **Production-minded backend** — Structured logging, request IDs, rate limiting, Helmet, graceful shutdown, SQLite with WAL, optional in-memory mode for tests.
- **Resilient UX** — Session **resume tokens**, reconnect handling, and a dev workflow that proxies API/WebSocket through Vite to avoid CORS friction.

Good interview talking points: *Why snapshots instead of client-side game state? How do you handle disconnects and timer expiry? Where would you shard or scale this next?*

---

## Features

- Create/join lobbies with a short **room code**
- **Team assignment**, **ready gate**, configurable **rounds** and **turn length**
- **Category** selection (single category or all categories from the dataset)
- **Timed turns** with server-driven phase transitions (between turns / between rounds)
- **Role-based UI**: clue giver, teammate guessers, opponent observers
- **Taboo calls** with optional **review vote** (penalized team majority)
- **Smarter guess matching** (normalization, plurals, bounded fuzzy match, “close guess” hint)
- **Deck without immediate repeats** until the draw pile is exhausted
- **Post-game recap** and optional **SQLite-backed** leaderboard / recent matches (when persistence is enabled)

---

## Tech stack

| Layer | Technologies |
|--------|----------------|
| Frontend | React 19, React Router, Vite, Tailwind CSS, Framer Motion |
| Backend | Node.js, Express 5, `ws` |
| Data | SQLite (`better-sqlite3`), JSON lobby documents; in-memory repositories in test |
| Tooling | ESLint, Vitest (frontend), Node test runner (backend) |

---

## Screenshots

> Add your own images under `docs/images/` and link them here for GitHub README polish.

| Screen | Placeholder |
|--------|-------------|
| Landing (create/join) | `![Landing](docs/images/landing.png)` |
| Lobby (teams & ready) | `![Lobby](docs/images/lobby.png)` |
| Game (clue / guess) | `![Game](docs/images/game.png)` |
| Game over / recap | `![Game over](docs/images/game-over.png)` |

---

## Quick start

**Requirements:** Node.js **20+** (recommended), npm, `curl` and `lsof` (used by `./start.sh`).

```bash
git clone <your-repo-url>
cd taboo
./start.sh
```

Then open the **frontend URL** printed in the log (usually `http://localhost:5173`). The script starts the API on port **3000** and proxies `/api` and `/ws` through Vite in development.

**Manual alternative** (two terminals):

```bash
# Terminal 1 — backend (listens on 127.0.0.1:3000 in development)
cd backend && npm install && npm run dev

# Terminal 2 — frontend (proxies to backend)
cd frontend && npm install && npm run dev
```

**Health check:** `curl http://127.0.0.1:3000/health`

Full setup, environment variables, and troubleshooting: **[`docs/getting-started.md`](docs/getting-started.md)** and **[`docs/troubleshooting.md`](docs/troubleshooting.md)**.

---

## Documentation

| Doc | Description |
|-----|-------------|
| [Docs hub](docs/README.md) | Suggested reading order and overview |
| [Getting started](docs/getting-started.md) | Install, run, env vars, first run |
| [Architecture](docs/architecture.md) | System design and data flow |
| [Game logic](docs/game-logic.md) | Turns, scoring, Taboo, reviews, phases |
| [Realtime](docs/realtime-system.md) | WebSocket protocol and reconnection |
| [Backend](docs/backend.md) | Server layout and services |
| [Frontend](docs/frontend.md) | Routes, state, API usage |
| [Database](docs/database.md) | SQLite tables and purpose |
| [API reference](docs/api-reference.md) | HTTP and WS message reference |
| [Deployment](docs/deployment.md) | Production notes (see also root `DEPLOYMENT.md`) |
| [Troubleshooting](docs/troubleshooting.md) | Common errors and fixes |
| [Contributing](docs/contributing.md) | How to extend and test |
| [Glossary](docs/glossary.md) | Terms and enums |

---

## Scripts

| Command | Where | Purpose |
|---------|--------|---------|
| `./start.sh` | repo root | Start backend + frontend with checks |
| `npm run dev` | `backend/`, `frontend/` | Development servers |
| `npm test` | `backend/`, `frontend/` | Test suites |
| `npm run build` | `frontend/` | Production static build |
| `npm start` | `backend/` | Production server (`node index.js`) |

---

## License

Specify your license in a `LICENSE` file (e.g. MIT) if you open-source the repo.
