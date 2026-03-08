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
    defaultRoundCount: 5,
    defaultRoundDurationSeconds: 60,
    ...overrides.config,
  };

  return new LobbyService({ repository, logger, config });
}

test("createLobby creates lobby with unique code and host member", () => {
  const service = createService();

  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  assert.equal(lobby.code.length, 4);
  assert.equal(lobby.players.length, 1);
  assert.equal(lobby.players[0].name, "Alice");
  assert.equal(lobby.players[0].team, "A");
  assert.equal(lobby.players[0].ready, false);
  assert.equal(lobby.hostName, "Alice");
  assert.equal(lobby.settings.roundCount, 5);
  assert.equal(lobby.settings.roundDurationSeconds, 60);
});

test("createLobby accepts custom rounds and duration settings", () => {
  const service = createService();

  const lobby = service.createLobby({
    playerName: "Alice",
    roundCount: 8,
    roundDurationSeconds: 120,
    requestId: "r1",
  });

  assert.equal(lobby.settings.roundCount, 8);
  assert.equal(lobby.settings.roundDurationSeconds, 120);
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

  assert.deepEqual(
    joined.players.map((player) => player.name),
    ["Alice", "Bob"],
  );
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

  assert.deepEqual(
    joinedAgain.players.map((player) => player.name),
    ["Alice", "bob"],
  );
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

test("removeLobbyMember removes matching member from lobby", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });
  service.joinLobby({
    playerName: "Bob",
    lobbyCode: lobby.code,
    requestId: "r2",
  });

  const updated = service.removeLobbyMember({
    playerName: "Bob",
    lobbyCode: lobby.code,
    requestId: "r3",
  });

  assert.deepEqual(
    updated.players.map((player) => player.name),
    ["Alice"],
  );
});

test("setPlayerTeam moves player between teams", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });
  service.joinLobby({
    playerName: "Bob",
    lobbyCode: lobby.code,
    requestId: "r2",
  });

  const updated = service.setPlayerTeam({
    playerName: "Bob",
    lobbyCode: lobby.code,
    team: "A",
    requestId: "r3",
  });

  const bob = updated.players.find((player) => player.name === "Bob");
  assert.equal(bob.team, "A");
});

test("setPlayerReady toggles player readiness", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  const updated = service.setPlayerReady({
    playerName: "Alice",
    lobbyCode: lobby.code,
    ready: true,
    requestId: "r2",
  });

  const alice = updated.players.find((player) => player.name === "Alice");
  assert.equal(alice.ready, true);
});
