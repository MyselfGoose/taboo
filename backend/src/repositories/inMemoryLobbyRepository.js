class InMemoryLobbyRepository {
  constructor() {
    this.lobbies = new Map();
  }

  count() {
    return this.lobbies.size;
  }

  hasCode(code) {
    return this.lobbies.has(code);
  }

  create(lobby) {
    this.lobbies.set(lobby.code, lobby);
    return lobby;
  }

  getByCode(code) {
    return this.lobbies.get(code);
  }

  deleteByCode(code) {
    this.lobbies.delete(code);
  }

  cleanupExpired(now, ttlMs) {
    for (const [code, lobby] of this.lobbies.entries()) {
      if (now - lobby.createdAt > ttlMs) {
        this.lobbies.delete(code);
      }
    }
  }
}

module.exports = {
  InMemoryLobbyRepository,
};
