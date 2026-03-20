const test = require("node:test");
const assert = require("node:assert/strict");

const { LobbyService } = require("../src/services/lobbyService");
const {
  InMemoryLobbyRepository,
} = require("../src/repositories/inMemoryLobbyRepository");
const { AppError } = require("../src/utils/appError");

function createService(overrides = {}) {
  const repository = overrides.repository || new InMemoryLobbyRepository();
  const datasetService = overrides.datasetService || {
    resolveCategorySelection({ categoryMode, categoryIds }) {
      if (categoryMode === "single") {
        return {
          categoryMode: "single",
          categoryIds: [Number(categoryIds?.[0] || 1)],
        };
      }

      return {
        categoryMode: "all",
        categoryIds: [1, 2],
      };
    },
    buildDeck() {
      return [
        {
          id: "1:alpha",
          question: "Alpha",
          taboo: ["One", "Two", "Three", "Four", "Five"],
          categoryId: 1,
          category: "Classic",
        },
        {
          id: "2:beta",
          question: "Beta",
          taboo: ["Uno", "Dos", "Tres", "Cuatro", "Cinco"],
          categoryId: 2,
          category: "History",
        },
      ];
    },
    getCategoryNames(ids) {
      return ids.map((id) => (id === 1 ? "Classic" : "History"));
    },
    getCategorySummaries() {
      return [];
    },
  };
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

  return new LobbyService({ repository, datasetService, logger, config });
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

test("setPlayerTeam auto-unreadies player when switching teams", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  service.setPlayerReady({
    playerName: "Alice",
    lobbyCode: lobby.code,
    ready: true,
    requestId: "r2",
  });

  const updated = service.setPlayerTeam({
    playerName: "Alice",
    lobbyCode: lobby.code,
    team: "B",
    requestId: "r3",
  });

  const alice = updated.players.find((player) => player.name === "Alice");
  assert.equal(alice.team, "B");
  assert.equal(alice.ready, false);
});

test("setPlayerTeam keeps player not ready when already not ready", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  const updated = service.setPlayerTeam({
    playerName: "Alice",
    lobbyCode: lobby.code,
    team: "B",
    requestId: "r2",
  });

  const alice = updated.players.find((player) => player.name === "Alice");
  assert.equal(alice.team, "B");
  assert.equal(alice.ready, false);
});

test("toLobbySnapshot hides card for teammate guesser", () => {
  const service = createService();
  const lobby = service.createLobby({ playerName: "Alice", requestId: "r1" });

  service.joinLobby({
    playerName: "Bob",
    lobbyCode: lobby.code,
    requestId: "r2",
  });
  service.joinLobby({
    playerName: "Cara",
    lobbyCode: lobby.code,
    requestId: "r3",
  });

  service.setPlayerTeam({
    playerName: "Bob",
    lobbyCode: lobby.code,
    team: "A",
    requestId: "r4",
  });
  service.setPlayerTeam({
    playerName: "Cara",
    lobbyCode: lobby.code,
    team: "B",
    requestId: "r5",
  });

  service.setPlayerReady({
    playerName: "Alice",
    lobbyCode: lobby.code,
    ready: true,
    requestId: "r6",
  });
  service.setPlayerReady({
    playerName: "Bob",
    lobbyCode: lobby.code,
    ready: true,
    requestId: "r7",
  });
  service.setPlayerReady({
    playerName: "Cara",
    lobbyCode: lobby.code,
    ready: true,
    requestId: "r8",
  });

  const started = service.startGameIfAllReady({
    lobbyCode: lobby.code,
    requestId: "r9",
  });
  assert.equal(started, true);

  const readyLobby = service.getLobby({ lobbyCode: lobby.code });
  const clueGiverId = readyLobby.game.activeTurn.playerId;

  service.applyGameActionByPlayerId({
    lobbyCode: lobby.code,
    playerId: clueGiverId,
    action: "start_turn",
    requestId: "r10",
  });

  const activeLobby = service.getLobby({ lobbyCode: lobby.code });
  const activeTurn = activeLobby.game.activeTurn;
  const clueGiver = activeLobby.players.find(
    (player) => player.id === activeTurn.playerId,
  );
  const teammate = activeLobby.players.find(
    (player) => player.team === clueGiver.team && player.id !== clueGiver.id,
  );
  const opponent = activeLobby.players.find(
    (player) => player.team !== clueGiver.team,
  );

  assert.ok(teammate);
  assert.ok(opponent);

  const clueSnapshot = service.toLobbySnapshot(activeLobby, {
    viewerPlayerId: clueGiver.id,
  });
  const teammateSnapshot = service.toLobbySnapshot(activeLobby, {
    viewerPlayerId: teammate.id,
  });
  const opponentSnapshot = service.toLobbySnapshot(activeLobby, {
    viewerPlayerId: opponent.id,
  });

  assert.equal(clueSnapshot.game.cardVisibleToViewer, true);
  assert.ok(clueSnapshot.game.currentCard);

  assert.equal(teammateSnapshot.game.cardVisibleToViewer, false);
  assert.equal(teammateSnapshot.game.currentCard, null);

  assert.equal(opponentSnapshot.game.cardVisibleToViewer, true);
  assert.ok(opponentSnapshot.game.currentCard);
});

function expectedInterleavedTurnOrderForRound(players, roundNumber) {
  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");
  if (teamA.length === 0 || teamB.length === 0) return [];

  const roundIdx = Math.max(0, Math.floor(roundNumber) - 1);
  const startA = roundIdx % teamA.length;
  const startB = roundIdx % teamB.length;
  const rotatedA = teamA.slice(startA).concat(teamA.slice(0, startA));
  const rotatedB = teamB.slice(startB).concat(teamB.slice(0, startB));

  const order = [];
  let aIndex = 0;
  let bIndex = 0;
  let step = 0;

  while (aIndex < rotatedA.length || bIndex < rotatedB.length) {
    const expectedTeam = step % 2 === 0 ? "A" : "B";

    if (expectedTeam === "A") {
      if (aIndex < rotatedA.length) {
        order.push(rotatedA[aIndex].id);
        aIndex += 1;
      }
    } else if (bIndex < rotatedB.length) {
      order.push(rotatedB[bIndex].id);
      bIndex += 1;
    }

    step += 1;
  }

  return order;
}

test("uneven teams: each round includes every player once", () => {
  const service = createService();

  const lobby = service.createLobby({
    playerName: "A1",
    requestId: "r0",
  });

  service.joinLobby({
    playerName: "A2",
    lobbyCode: lobby.code,
    requestId: "r1",
  });
  service.joinLobby({
    playerName: "B1",
    lobbyCode: lobby.code,
    requestId: "r2",
  });
  service.joinLobby({
    playerName: "B2",
    lobbyCode: lobby.code,
    requestId: "r3",
  });
  service.joinLobby({
    playerName: "B3",
    lobbyCode: lobby.code,
    requestId: "r4",
  });

  // Force uneven teams: Team A = 2 players, Team B = 3 players.
  service.setPlayerTeam({
    playerName: "A2",
    lobbyCode: lobby.code,
    team: "A",
    requestId: "r5",
  });
  service.setPlayerTeam({
    playerName: "B1",
    lobbyCode: lobby.code,
    team: "B",
    requestId: "r6",
  });
  service.setPlayerTeam({
    playerName: "B2",
    lobbyCode: lobby.code,
    team: "B",
    requestId: "r7",
  });
  service.setPlayerTeam({
    playerName: "B3",
    lobbyCode: lobby.code,
    team: "B",
    requestId: "r8",
  });

  // Mark everyone ready (setPlayerTeam invalidates readiness).
  for (const [idx, name] of ["A1", "A2", "B1", "B2", "B3"].entries()) {
    service.setPlayerReady({
      playerName: name,
      lobbyCode: lobby.code,
      ready: true,
      requestId: `r-ready-${idx}`,
    });
  }

  const started = service.startGameIfAllReady({
    lobbyCode: lobby.code,
    requestId: "r-start",
  });
  assert.equal(started, true);

  let activeLobby = service.getLobby({ lobbyCode: lobby.code });
  const totalPlayers = activeLobby.players.length;
  assert.equal(totalPlayers, 5);

  for (let roundNumber = 1; roundNumber <= 2; roundNumber += 1) {
    assert.equal(activeLobby.game.status, "waiting_to_start_turn");
    assert.equal(activeLobby.game.roundNumber, roundNumber);

    const expectedOrder = expectedInterleavedTurnOrderForRound(
      activeLobby.players,
      roundNumber,
    );
    assert.equal(expectedOrder.length, totalPlayers);

    const actualOrder = [];
    const historyStartLen = activeLobby.game.history.length;

    for (let i = 0; i < totalPlayers; i += 1) {
      const turn = activeLobby.game.activeTurn;
      assert.ok(turn);
      actualOrder.push(turn.playerId);

      service.applyGameActionByPlayerId({
        lobbyCode: activeLobby.code,
        playerId: turn.playerId,
        action: "start_turn",
        requestId: `r-start-turn-${roundNumber}-${i}`,
      });

      activeLobby = service.getLobby({ lobbyCode: activeLobby.code });
      const turnEndsAt = activeLobby.game.turnEndsAt;
      assert.equal(activeLobby.game.status, "turn_in_progress");

      service.advanceGamePhase(activeLobby, turnEndsAt + 1);
      activeLobby = service.getLobby({ lobbyCode: activeLobby.code });

      if (i < totalPlayers - 1) {
        assert.equal(activeLobby.game.status, "between_turns");
        service.advanceGamePhase(activeLobby, activeLobby.game.phaseEndsAt + 1);
        activeLobby = service.getLobby({ lobbyCode: activeLobby.code });
        assert.equal(activeLobby.game.status, "waiting_to_start_turn");
      } else {
        assert.equal(activeLobby.game.status, "between_rounds");
      }
    }

    assert.deepEqual(actualOrder, expectedOrder);

    const newHistory = activeLobby.game.history.slice(historyStartLen);
    const turnTimeoutEntries = newHistory.filter(
      (e) => e.action === "turn_timeout",
    );
    assert.equal(turnTimeoutEntries.length, totalPlayers);
    assert.deepEqual(
      turnTimeoutEntries.map((e) => e.playerId),
      actualOrder,
    );

    // Start next round.
    if (roundNumber < 2) {
      service.advanceGamePhase(activeLobby, activeLobby.game.phaseEndsAt + 1);
      activeLobby = service.getLobby({ lobbyCode: activeLobby.code });
      assert.equal(activeLobby.game.status, "waiting_to_start_turn");
    }
  }
});
