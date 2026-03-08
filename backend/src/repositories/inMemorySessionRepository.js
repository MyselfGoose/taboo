const crypto = require("node:crypto");

class InMemorySessionRepository {
  constructor() {
    this.sessionsByHash = new Map();
    this.sessionByPlayer = new Map();
  }

  static hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  issueSession({ lobbyCode, playerId, playerName, now, ttlMs }) {
    const token = crypto.randomUUID();
    const tokenHash = InMemorySessionRepository.hashToken(token);
    const playerKey = `${lobbyCode}:${playerId}`;

    const existingHash = this.sessionByPlayer.get(playerKey);
    if (existingHash) {
      this.sessionsByHash.delete(existingHash);
    }

    this.sessionByPlayer.set(playerKey, tokenHash);
    this.sessionsByHash.set(tokenHash, {
      lobbyCode,
      playerId,
      playerName,
      createdAt: now,
      lastActivityAt: now,
      expiresAt: now + ttlMs,
    });

    return token;
  }

  validateSession({ lobbyCode, token, now }) {
    const tokenHash = InMemorySessionRepository.hashToken(token);
    const session = this.sessionsByHash.get(tokenHash);

    if (!session || session.lobbyCode !== lobbyCode) {
      return null;
    }

    if (session.expiresAt <= now) {
      this.sessionsByHash.delete(tokenHash);
      this.sessionByPlayer.delete(`${session.lobbyCode}:${session.playerId}`);
      return null;
    }

    return {
      lobbyCode: session.lobbyCode,
      playerId: session.playerId,
      playerName: session.playerName,
    };
  }

  touchSession({ lobbyCode, token, now, ttlMs }) {
    const tokenHash = InMemorySessionRepository.hashToken(token);
    const session = this.sessionsByHash.get(tokenHash);

    if (!session || session.lobbyCode !== lobbyCode) {
      return false;
    }

    session.lastActivityAt = now;
    session.expiresAt = now + ttlMs;
    return true;
  }

  cleanupExpired(now) {
    for (const [tokenHash, session] of this.sessionsByHash.entries()) {
      if (session.expiresAt <= now) {
        this.sessionsByHash.delete(tokenHash);
        this.sessionByPlayer.delete(`${session.lobbyCode}:${session.playerId}`);
      }
    }
  }
}

module.exports = {
  InMemorySessionRepository,
};
