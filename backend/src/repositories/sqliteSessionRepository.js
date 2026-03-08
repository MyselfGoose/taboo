const crypto = require("node:crypto");

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class SqliteSessionRepository {
  constructor({ db }) {
    this.db = db;

    this.upsertStmt = db.prepare(`
      INSERT INTO player_sessions (
        lobby_code, player_id, player_name, token_hash, created_at, last_activity_at, expires_at
      ) VALUES (
        @lobbyCode, @playerId, @playerName, @tokenHash, @createdAt, @lastActivityAt, @expiresAt
      )
      ON CONFLICT(lobby_code, player_id) DO UPDATE SET
        player_name = excluded.player_name,
        token_hash = excluded.token_hash,
        last_activity_at = excluded.last_activity_at,
        expires_at = excluded.expires_at
    `);

    this.selectStmt = db.prepare(`
      SELECT lobby_code AS lobbyCode, player_id AS playerId, player_name AS playerName, expires_at AS expiresAt
      FROM player_sessions
      WHERE token_hash = ? AND lobby_code = ?
      LIMIT 1
    `);

    this.touchStmt = db.prepare(`
      UPDATE player_sessions
      SET last_activity_at = ?, expires_at = ?
      WHERE token_hash = ? AND lobby_code = ?
    `);

    this.cleanupStmt = db.prepare(
      `DELETE FROM player_sessions WHERE expires_at <= ?`,
    );
  }

  issueSession({ lobbyCode, playerId, playerName, now, ttlMs }) {
    const token = crypto.randomUUID();
    const tokenHash = hashToken(token);

    this.upsertStmt.run({
      lobbyCode,
      playerId,
      playerName,
      tokenHash,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + ttlMs,
    });

    return token;
  }

  validateSession({ lobbyCode, token, now }) {
    const session = this.selectStmt.get(hashToken(token), lobbyCode);

    if (!session) {
      return null;
    }

    if (session.expiresAt <= now) {
      return null;
    }

    return {
      lobbyCode: session.lobbyCode,
      playerId: session.playerId,
      playerName: session.playerName,
    };
  }

  touchSession({ lobbyCode, token, now, ttlMs }) {
    const result = this.touchStmt.run(
      now,
      now + ttlMs,
      hashToken(token),
      lobbyCode,
    );
    return result.changes > 0;
  }

  cleanupExpired(now) {
    this.cleanupStmt.run(now);
  }
}

module.exports = {
  SqliteSessionRepository,
};
