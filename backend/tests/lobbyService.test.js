const test = require("node:test");
const assert = require("node:assert/strict");

const { LobbyService } = require("../src/services/lobbyService");
const {
  InMemoryLobbyRepository,
} = require("../src/repositories/inMemoryLobbyRepository");
const { AppError } = require("../src/utils/appError");

function createService(overrides = {}) {
  const repository = overrides.repository || new InMemoryLobbyRepository();
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  const config = {
    lobbyTtlMs: 120 * 60 * 1000,
    maxActiveLobbies: 100,
    lobbyCodeLength: 4,
    lobbyMaxGenerateAttempts: 100,
    ...overrides.config,
  };

  return new LobbyService({ repository, logger, config });
}

test("createLobby creates lobby with unique code and host member", () => {
  const service = createService();

  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  assert.equal(lobby.code.length, 4);
  assert.deepEqual(lobby.members, ["Alice"]);
  assert.equal(lobby.hostName, "Alice");
});

test("createLobby enforces active lobby capacity", () => {
  const repository = new InMemoryLobbyRepository();
  const service = createService({
    repository,
    config: { maxActiveLobbies: 1 },
  });

  service.createLobby({ playerName: "Alice", requestId: "r1" });

  assert.throws(
    () => service.createLobby({ playerName: "Bob", requestId: "r2" }),
    (error) => error instanceof AppError && error.code === "LOBBY_CAPACITY",
  );
});

test("createLobby generates unique codes across many lobbies", () => {
  const service = createService({
    config: { maxActiveLobbies: 1000 },
  });
  const codes = new Set();

  for (let i = 0; i < 250; i += 1) {
    const lobby = service.createLobby({
      playerName: `Player${i}`,
      requestId: `req-${i}`,
    });
    assert.equal(codes.has(lobby.code), false);
    codes.add(lobby.code);
  }

  assert.equal(codes.size, 250);
});

test("joinLobby adds member to existing lobby", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  const joined = service.joinLobby({
    playerName: "Bob",
    lobbyCode: lobby.code,
    requestId: "r2",
  });

  assert.deepEqual(joined.members, ["Alice", "Bob"]);
});

test("joinLobby is idempotent for same member name ignoring case", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  service.joinLobby({
    playerName: "bob",
    lobbyCode: lobby.code,
    requestId: "r2",
  });
  const joinedAgain = service.joinLobby({
    playerName: "BOB",
    lobbyCode: lobby.code,
    requestId: "r3",
  });

  assert.deepEqual(joinedAgain.members, ["Alice", "bob"]);
});

test("joinLobby throws when lobby code is unknown", () => {
  const service = createService();

  assert.throws(
    () =>
      service.joinLobby({
        playerName: "Bob",
        lobbyCode: "ZZZZ",
        requestId: "r1",
      }),
    (error) => error instanceof AppError && error.code === "LOBBY_NOT_FOUND",
  );
});
