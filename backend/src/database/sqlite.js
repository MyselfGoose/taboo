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
  `);
}

function createSqliteSessionDatabase({ config }) {
  const dataDir = path.resolve(config.dataDir);
  ensureDataDir(dataDir);

  const dbPath = path.join(dataDir, config.sessionDbFileName);
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  runMigrations(db);

  return { db, dbPath };
}

module.exports = {
  createSqliteSessionDatabase,
};
