class SqliteLobbyRepository {
  constructor({ db }) {
    this.db = db;

    this.countStmt = db.prepare(`SELECT COUNT(*) AS total FROM lobbies`);
    this.hasCodeStmt = db.prepare(
      `SELECT 1 AS present FROM lobbies WHERE code = ? LIMIT 1`,
    );
    this.getByCodeStmt = db.prepare(
      `SELECT data_json AS dataJson FROM lobbies WHERE code = ? LIMIT 1`,
    );
    this.listAllStmt = db.prepare(`SELECT data_json AS dataJson FROM lobbies`);
    this.upsertStmt = db.prepare(`
      INSERT INTO lobbies (code, data_json, created_at, updated_at)
      VALUES (@code, @dataJson, @createdAt, @updatedAt)
      ON CONFLICT(code) DO UPDATE SET
        data_json = excluded.data_json,
        updated_at = excluded.updated_at
    `);
    this.deleteByCodeStmt = db.prepare(`DELETE FROM lobbies WHERE code = ?`);
    this.cleanupStmt = db.prepare(`DELETE FROM lobbies WHERE created_at <= ?`);
  }

  count() {
    const row = this.countStmt.get();
    return row ? row.total : 0;
  }

  hasCode(code) {
    return Boolean(this.hasCodeStmt.get(code));
  }

  create(lobby) {
    return this.save(lobby);
  }

  save(lobby) {
    this.upsertStmt.run({
      code: lobby.code,
      dataJson: JSON.stringify(lobby),
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
    });

    return lobby;
  }

  getByCode(code) {
    const row = this.getByCodeStmt.get(code);
    if (!row) {
      return null;
    }

    return JSON.parse(row.dataJson);
  }

  listAll() {
    return this.listAllStmt.all().map((row) => JSON.parse(row.dataJson));
  }

  deleteByCode(code) {
    this.deleteByCodeStmt.run(code);
  }

  cleanupExpired(now, ttlMs) {
    const cutoff = now - ttlMs;
    this.cleanupStmt.run(cutoff);
  }
}

module.exports = {
  SqliteLobbyRepository,
};
