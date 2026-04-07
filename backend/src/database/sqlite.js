const fs = require("node:fs");
const path = require("node:path");

const Database = require("better-sqlite3");

function ensureDataDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS lobbies (
      code TEXT NOT NULL PRIMARY KEY,
      data_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_lobbies_created_at
      ON lobbies(created_at);

    CREATE TABLE IF NOT EXISTS player_sessions (
      lobby_code TEXT NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      last_activity_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      PRIMARY KEY (lobby_code, player_id)
    );

    CREATE INDEX IF NOT EXISTS idx_player_sessions_expiry
      ON player_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS match_results (
      id TEXT NOT NULL PRIMARY KEY,
      ended_at INTEGER NOT NULL,
      started_at INTEGER,
      duration_ms INTEGER,
      team_a_score INTEGER NOT NULL,
      team_b_score INTEGER NOT NULL,
      total_rounds INTEGER,
      winner TEXT,
      category_mode TEXT,
      category_ids_json TEXT,
      summary_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_match_results_ended_at
      ON match_results(ended_at DESC);

    CREATE TABLE IF NOT EXISTS match_player_stats (
      match_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      team TEXT NOT NULL,
      correct_guesses INTEGER NOT NULL DEFAULT 0,
      close_guesses INTEGER NOT NULL DEFAULT 0,
      wrong_guesses INTEGER NOT NULL DEFAULT 0,
      skips INTEGER NOT NULL DEFAULT 0,
      taboos_called INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (match_id, player_name, team),
      FOREIGN KEY (match_id) REFERENCES match_results(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_match_player_correct
      ON match_player_stats (correct_guesses DESC);
  `);
}

function createSqliteSessionDatabase({ config }) {
  const dataDir = path.resolve(config.dataDir);
  ensureDataDir(dataDir);

  const dbPath = path.join(dataDir, config.sessionDbFileName);
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  runMigrations(db);

  return { db, dbPath };
}

module.exports = {
  createSqliteSessionDatabase,
};
