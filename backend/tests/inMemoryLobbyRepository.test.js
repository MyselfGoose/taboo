const test = require("node:test");
const assert = require("node:assert/strict");

const {
  InMemoryLobbyRepository,
} = require("../src/repositories/inMemoryLobbyRepository");

function createLobby(code, createdAt) {
  return {
    code,
    hostName: "Alice",
    members: ["Alice"],
    createdAt,
    updatedAt: createdAt,
  };
}

test("repository creates and fetches lobby by code", () => {
  const repo = new InMemoryLobbyRepository();
  const lobby = createLobby("AB12", Date.now());

  repo.create(lobby);

  assert.equal(repo.count(), 1);
  assert.equal(repo.hasCode("AB12"), true);
  assert.deepEqual(repo.getByCode("AB12"), lobby);
});

test("repository deletes lobby by code", () => {
  const repo = new InMemoryLobbyRepository();
  repo.create(createLobby("AB12", Date.now()));

  repo.deleteByCode("AB12");

  assert.equal(repo.count(), 0);
  assert.equal(repo.getByCode("AB12"), undefined);
});

test("repository cleans up expired lobbies", () => {
  const now = Date.now();
  const ttlMs = 60_000;
  const repo = new InMemoryLobbyRepository();

  repo.create(createLobby("OLD1", now - ttlMs - 1));
  repo.create(createLobby("NEW1", now - ttlMs + 1));

  repo.cleanupExpired(now, ttlMs);

  assert.equal(repo.hasCode("OLD1"), false);
  assert.equal(repo.hasCode("NEW1"), true);
});
