# Database

The app uses **SQLite** via **`better-sqlite3`** when persistence flags are enabled. A **single database file** can hold sessions, lobbies, and match history tables.

## Location

- Directory: **`DATA_DIR`** (default `./data`, resolved relative to the backend process cwd)  
- Filename: **`SESSION_DB_FILE`** (default `sessions.db`)  
- Opened in [`backend/src/database/sqlite.js`](../backend/src/database/sqlite.js)

## Pragmas

- `journal_mode = WAL` — better concurrent read/write behavior  
- `synchronous = NORMAL` — balance durability and speed  
- `foreign_keys = ON` — enforce referential integrity for match tables  

## Tables

### `lobbies`

| Column | Purpose |
|--------|---------|
| `code` | Primary key — lobby room code |
| `data_json` | Serialized lobby document (players, settings, game state) |
| `created_at`, `updated_at` | Unix ms timestamps |

Used when **`USE_SQLITE_LOBBIES`** is true (default in non-test environments).

### `player_sessions`

| Column | Purpose |
|--------|---------|
| `lobby_code`, `player_id` | Composite primary key |
| `player_name` | Display name |
| `token_hash` | Hashed resume token (unique) |
| `created_at`, `last_activity_at`, `expires_at` | TTL / activity |

Used when **`USE_SQLITE_SESSIONS`** is true. Supports **session restore** after refresh.

### `match_results`

Written when a game ends and `MatchHistoryRepository` is active (same DB file as sessions when SQLite is used).

| Column | Purpose |
|--------|---------|
| `id` | UUID primary key |
| `ended_at`, `started_at`, `duration_ms` | Timing |
| `team_a_score`, `team_b_score`, `winner` | Outcome |
| `total_rounds`, `category_mode`, `category_ids_json` | Context |
| `summary_json` | Denormalized recap payload |

### `match_player_stats`

Per-player aggregates for leaderboard queries; **`match_id`** FK to `match_results` with **`ON DELETE CASCADE`**.

## Migrations

Schema is applied with **`CREATE TABLE IF NOT EXISTS`** (and indexes) inside `runMigrations` on startup. There is **no** separate migration version table—schema changes are additive and idempotent.

## In-memory mode

When SQLite is disabled for lobbies and/or sessions, the corresponding **in-memory repositories** are used; data is **lost on restart**. Match history inserts are skipped if no DB is attached.

## See also

- [Backend](backend.md) — repository wiring  
- [API reference](api-reference.md) — leaderboard endpoints  
- [Getting started](getting-started.md) — `DATA_DIR` / env  
