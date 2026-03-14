const crypto = require("node:crypto");

const { AppError } = require("../utils/appError");
const { generateUniqueCode } = require("../utils/codeGenerator");
const {
  normalizeLobbyCode,
  normalizePlayerName,
  normalizeRoundCount,
  normalizeRoundDurationSeconds,
} = require("../utils/validation");
const {
  InMemorySessionRepository,
} = require("../repositories/inMemorySessionRepository");

function nowMs() {
  return Date.now();
}

function allPlayersReady(lobby) {
  return (
    lobby.players.length > 0 && lobby.players.every((player) => player.ready)
  );
}

function nextTeam(activeTeam, lobby) {
  const candidate = activeTeam === "A" ? "B" : "A";
  const hasCandidate = lobby.players.some(
    (player) => player.team === candidate,
  );
  if (hasCandidate) {
    return candidate;
  }

  return activeTeam;
}

class LobbyService {
  constructor({
    repository,
    sessionRepository,
    datasetService,
    logger,
    config,
  }) {
    this.repository = repository;
    this.sessionRepository =
      sessionRepository || new InMemorySessionRepository();
    this.datasetService = datasetService;
    this.logger = logger;
    this.config = config;
  }

  cleanup(now = nowMs()) {
    this.repository.cleanupExpired(now, this.config.lobbyTtlMs);
    this.sessionRepository.cleanupExpired(now);
  }

  createLobby({
    playerName,
    roundCount,
    roundDurationSeconds,
    categoryMode,
    categoryIds,
    requestId,
  }) {
    const now = nowMs();
    this.cleanup(now);

    if (this.repository.count() >= this.config.maxActiveLobbies) {
      throw new AppError(
        "Lobby capacity reached. Try again later.",
        503,
        "LOBBY_CAPACITY",
      );
    }

    const hostName = normalizePlayerName(playerName);
    const normalizedRoundCount = normalizeRoundCount(
      roundCount ?? this.config.defaultRoundCount,
    );
    const normalizedRoundDurationSeconds = normalizeRoundDurationSeconds(
      roundDurationSeconds ?? this.config.defaultRoundDurationSeconds,
    );
    const resolvedCategorySelection =
      this.datasetService.resolveCategorySelection({
        categoryMode,
        categoryIds,
      });

    const code = generateUniqueCode({
      length: this.config.lobbyCodeLength,
      maxAttempts: this.config.lobbyMaxGenerateAttempts,
      isTaken: (candidateCode) => this.repository.hasCode(candidateCode),
    });

    const hostPlayer = {
      id: crypto.randomUUID(),
      name: hostName,
      team: "A",
      ready: false,
      joinedAt: now,
      lastSeenAt: now,
    };

    const lobby = {
      code,
      hostName,
      players: [hostPlayer],
      settings: {
        roundCount: normalizedRoundCount,
        roundDurationSeconds: normalizedRoundDurationSeconds,
        categoryMode: resolvedCategorySelection.categoryMode,
        categoryIds: resolvedCategorySelection.categoryIds,
      },
      game: null,
      createdAt: now,
      updatedAt: now,
    };

    this.repository.create(lobby);

    this.logger.info("Lobby created", {
      requestId,
      event: "lobby_created",
      code: lobby.code,
      hostName: lobby.hostName,
      memberCount: lobby.players.length,
      categoryMode: lobby.settings.categoryMode,
    });

    return lobby;
  }

  createLobbyWithSession({
    playerName,
    roundCount,
    roundDurationSeconds,
    categoryMode,
    categoryIds,
    requestId,
  }) {
    const lobby = this.createLobby({
      playerName,
      roundCount,
      roundDurationSeconds,
      categoryMode,
      categoryIds,
      requestId,
    });

    const player = lobby.players[0];
    const now = nowMs();
    const resumeToken = this.sessionRepository.issueSession({
      lobbyCode: lobby.code,
      playerId: player.id,
      playerName: player.name,
      now,
      ttlMs: this.config.sessionTtlMs,
    });

    return {
      lobby,
      playerId: player.id,
      playerName: player.name,
      resumeToken,
    };
  }

  getLobby({ lobbyCode }) {
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    return lobby;
  }

  findPlayerByName(lobby, playerName) {
    const normalized = normalizePlayerName(playerName);
    return (
      lobby.players.find(
        (player) => player.name.toLowerCase() === normalized.toLowerCase(),
      ) || null
    );
  }

  findPlayerById(lobby, playerId) {
    return lobby.players.find((player) => player.id === playerId) || null;
  }

  joinLobby({ playerName, lobbyCode, requestId }) {
    const now = nowMs();
    this.cleanup(now);

    const memberName = normalizePlayerName(playerName);
    const code = normalizeLobbyCode(lobbyCode);

    const lobby = this.repository.getByCode(code);
    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const existingPlayer = this.findPlayerByName(lobby, memberName);
    const hasMember = Boolean(existingPlayer);

    if (!hasMember) {
      const teamCounts = lobby.players.reduce(
        (counts, player) => {
          if (player.team === "B") {
            counts.B += 1;
          } else {
            counts.A += 1;
          }
          return counts;
        },
        { A: 0, B: 0 },
      );

      const next = teamCounts.A <= teamCounts.B ? "A" : "B";
      lobby.players.push({
        id: crypto.randomUUID(),
        name: memberName,
        team: next,
        ready: false,
        joinedAt: now,
        lastSeenAt: now,
      });
      lobby.updatedAt = now;
    } else {
      existingPlayer.lastSeenAt = now;
      lobby.updatedAt = now;
    }

    this.repository.save(lobby);

    this.logger.info("Lobby joined", {
      requestId,
      event: "lobby_joined",
      code: lobby.code,
      joinedName: memberName,
      memberCount: lobby.players.length,
      duplicateMember: hasMember,
    });

    return lobby;
  }

  joinLobbyWithSession({ playerName, lobbyCode, requestId }) {
    const lobby = this.joinLobby({ playerName, lobbyCode, requestId });
    const player = this.findPlayerByName(lobby, playerName);
    const now = nowMs();

    const resumeToken = this.sessionRepository.issueSession({
      lobbyCode: lobby.code,
      playerId: player.id,
      playerName: player.name,
      now,
      ttlMs: this.config.sessionTtlMs,
    });

    return {
      lobby,
      playerId: player.id,
      playerName: player.name,
      resumeToken,
    };
  }

  restoreSession({ lobbyCode, resumeToken, requestId }) {
    const now = nowMs();
    this.cleanup(now);

    const code = normalizeLobbyCode(lobbyCode);
    if (!resumeToken || typeof resumeToken !== "string") {
      throw new AppError("Resume token is required.", 400, "INVALID_SESSION");
    }

    const session = this.sessionRepository.validateSession({
      lobbyCode: code,
      token: resumeToken,
      now,
    });

    if (!session) {
      throw new AppError(
        "Session is invalid or expired.",
        401,
        "INVALID_SESSION",
      );
    }

    const lobby = this.repository.getByCode(code);
    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const player = this.findPlayerById(lobby, session.playerId);
    if (!player) {
      throw new AppError("Player not found in lobby.", 404, "PLAYER_NOT_FOUND");
    }

    player.lastSeenAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.sessionRepository.touchSession({
      lobbyCode: code,
      token: resumeToken,
      now,
      ttlMs: this.config.sessionTtlMs,
    });

    this.logger.info("Session restored", {
      requestId,
      event: "session_restored",
      code,
      playerId: session.playerId,
    });

    return {
      lobby,
      playerId: session.playerId,
      playerName: player.name,
      resumeToken,
    };
  }

  removeLobbyMember({ playerName, lobbyCode, requestId }) {
    const now = nowMs();
    const memberName = normalizePlayerName(playerName);
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      return null;
    }

    const previousLength = lobby.players.length;
    lobby.players = lobby.players.filter(
      (player) => player.name.toLowerCase() !== memberName.toLowerCase(),
    );

    if (lobby.players.length !== previousLength) {
      lobby.updatedAt = now;
      this.repository.save(lobby);
      this.logger.info("Lobby member removed", {
        requestId,
        event: "lobby_member_left",
        code,
        leftName: memberName,
        memberCount: lobby.players.length,
      });
    }

    return lobby;
  }

  removeLobbyMemberById({ playerId, lobbyCode, requestId }) {
    const now = nowMs();
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      return null;
    }

    const previousLength = lobby.players.length;
    const removedPlayer = lobby.players.find(
      (player) => player.id === playerId,
    );
    lobby.players = lobby.players.filter((player) => player.id !== playerId);

    if (lobby.players.length !== previousLength) {
      lobby.updatedAt = now;
      this.repository.save(lobby);
      this.logger.info("Lobby member removed", {
        requestId,
        event: "lobby_member_left",
        code,
        leftName: removedPlayer ? removedPlayer.name : playerId,
        memberCount: lobby.players.length,
      });
    }

    return lobby;
  }

  setPlayerTeam({ playerName, lobbyCode, team, requestId }) {
    const lobby = this.joinLobby({
      playerName,
      lobbyCode,
      requestId,
    });
    const player = this.findPlayerByName(lobby, playerName);

    return this.setPlayerTeamById({
      playerId: player.id,
      lobbyCode,
      team,
      requestId,
    });
  }

  setPlayerTeamById({ playerId, lobbyCode, team, requestId }) {
    const now = nowMs();
    const code = normalizeLobbyCode(lobbyCode);
    const normalizedTeam = team === "B" ? "B" : "A";
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const player = this.findPlayerById(lobby, playerId);
    if (!player) {
      throw new AppError("Player not found in lobby.", 404, "PLAYER_NOT_FOUND");
    }

    // Switching teams invalidates prior readiness confirmation.
    player.ready = false;
    player.team = normalizedTeam;
    player.lastSeenAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Lobby team changed", {
      requestId,
      event: "lobby_team_changed",
      code,
      playerName: player.name,
      playerId: player.id,
      team: player.team,
      ready: player.ready,
    });

    return lobby;
  }

  setPlayerReady({ playerName, lobbyCode, ready, requestId }) {
    const lobby = this.joinLobby({
      playerName,
      lobbyCode,
      requestId,
    });
    const player = this.findPlayerByName(lobby, playerName);

    return this.setPlayerReadyById({
      playerId: player.id,
      lobbyCode,
      ready,
      requestId,
    });
  }

  setPlayerReadyById({ playerId, lobbyCode, ready, requestId }) {
    const now = nowMs();
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const player = this.findPlayerById(lobby, playerId);
    if (!player) {
      throw new AppError("Player not found in lobby.", 404, "PLAYER_NOT_FOUND");
    }

    player.ready = Boolean(ready);
    player.lastSeenAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Lobby ready state changed", {
      requestId,
      event: "lobby_ready_changed",
      code,
      playerName: player.name,
      playerId: player.id,
      ready: player.ready,
    });

    return lobby;
  }

  listCategories() {
    return this.datasetService.getCategorySummaries();
  }

  ensureDeckForLobby(lobby) {
    const deck = this.datasetService.buildDeck(lobby.settings.categoryIds);
    if (deck.length === 0) {
      throw new AppError(
        "Selected categories do not contain playable cards.",
        400,
        "EMPTY_CATEGORY_SELECTION",
      );
    }

    return deck;
  }

  initializeGame(lobby, now) {
    if (lobby.players.length < 2) {
      throw new AppError(
        "At least two players are required to start the game.",
        400,
        "NOT_ENOUGH_PLAYERS",
      );
    }

    if (!lobby.players.some((player) => player.team === "A")) {
      throw new AppError(
        "Team A needs at least one player.",
        400,
        "TEAM_EMPTY",
      );
    }

    if (!lobby.players.some((player) => player.team === "B")) {
      throw new AppError(
        "Team B needs at least one player.",
        400,
        "TEAM_EMPTY",
      );
    }

    const deck = this.ensureDeckForLobby(lobby);
    const activeCard = deck.shift() || null;

    lobby.game = {
      status: "in_progress",
      startedAt: now,
      endedAt: null,
      roundNumber: 1,
      totalRounds: lobby.settings.roundCount,
      activeTeam: "A",
      scores: { A: 0, B: 0 },
      roundEndsAt: now + lobby.settings.roundDurationSeconds * 1000,
      currentCard: activeCard,
      deck,
      history: [],
      lastActionAt: now,
    };

    lobby.updatedAt = now;
    this.repository.save(lobby);
  }

  startGameIfAllReady({ lobbyCode, requestId, now = nowMs() }) {
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);
    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    if (
      lobby.game?.status === "in_progress" ||
      lobby.game?.status === "finished"
    ) {
      return false;
    }

    if (!allPlayersReady(lobby)) {
      return false;
    }

    if (lobby.players.length < 2) {
      return false;
    }

    if (!lobby.players.some((player) => player.team === "A")) {
      return false;
    }

    if (!lobby.players.some((player) => player.team === "B")) {
      return false;
    }

    this.initializeGame(lobby, now);

    this.logger.info("Game started", {
      requestId,
      event: "game_started",
      code,
      roundCount: lobby.settings.roundCount,
      categoryMode: lobby.settings.categoryMode,
    });

    return true;
  }

  drawNextCard(lobby) {
    if (!lobby.game) {
      return null;
    }

    if (!Array.isArray(lobby.game.deck) || lobby.game.deck.length === 0) {
      lobby.game.deck = this.ensureDeckForLobby(lobby);
    }

    lobby.game.currentCard = lobby.game.deck.shift() || null;
    return lobby.game.currentCard;
  }

  applyGameActionByPlayerId({ lobbyCode, playerId, action, requestId }) {
    const now = nowMs();
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const game = lobby.game;
    if (!game || game.status !== "in_progress") {
      throw new AppError("Game is not active.", 400, "GAME_NOT_ACTIVE");
    }

    if (game.roundEndsAt <= now) {
      throw new AppError(
        "Round has ended. Wait for the next round.",
        409,
        "ROUND_ENDED",
      );
    }

    const player = this.findPlayerById(lobby, playerId);
    if (!player) {
      throw new AppError("Player not found in lobby.", 404, "PLAYER_NOT_FOUND");
    }

    if (player.team !== game.activeTeam) {
      throw new AppError(
        "Only players on the active team can trigger controls.",
        403,
        "NOT_YOUR_TURN",
      );
    }

    const pointsByAction = {
      guess_correct: 1,
      taboo_called: -1,
      pass_card: 0,
    };

    if (!(action in pointsByAction)) {
      throw new AppError(
        "Unsupported game action.",
        400,
        "INVALID_GAME_ACTION",
      );
    }

    const points = pointsByAction[action];
    game.scores[game.activeTeam] += points;
    game.history.push({
      at: now,
      playerId,
      playerName: player.name,
      team: player.team,
      action,
      points,
      cardId: game.currentCard ? game.currentCard.id : null,
      cardQuestion: game.currentCard ? game.currentCard.question : null,
    });
    game.lastActionAt = now;

    this.drawNextCard(lobby);
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Game action applied", {
      requestId,
      event: "game_action",
      code,
      playerId,
      action,
      points,
      activeTeam: game.activeTeam,
      scoreA: game.scores.A,
      scoreB: game.scores.B,
    });

    return lobby;
  }

  finishGame(lobby, now) {
    lobby.game.status = "finished";
    lobby.game.endedAt = now;
    lobby.game.roundEndsAt = null;
    lobby.game.currentCard = null;
    lobby.updatedAt = now;
    this.repository.save(lobby);
  }

  advanceRound(lobby, now) {
    if (!lobby.game || lobby.game.status !== "in_progress") {
      return null;
    }

    if (lobby.game.roundNumber >= lobby.game.totalRounds) {
      this.finishGame(lobby, now);
      return "game_finished";
    }

    lobby.game.roundNumber += 1;
    lobby.game.activeTeam = nextTeam(lobby.game.activeTeam, lobby);
    lobby.game.roundEndsAt = now + lobby.settings.roundDurationSeconds * 1000;
    this.drawNextCard(lobby);
    lobby.game.lastActionAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    return "round_started";
  }

  advanceExpiredGames(now = nowMs()) {
    const lobbies = this.repository.listAll();
    const updates = [];

    for (const lobby of lobbies) {
      if (!lobby.game || lobby.game.status !== "in_progress") {
        continue;
      }

      if (
        typeof lobby.game.roundEndsAt !== "number" ||
        lobby.game.roundEndsAt > now
      ) {
        continue;
      }

      const reason = this.advanceRound(lobby, now);
      if (reason) {
        updates.push({ code: lobby.code, reason });
      }
    }

    return updates;
  }

  toGameSnapshot(game, now = nowMs()) {
    if (!game) {
      return null;
    }

    return {
      status: game.status,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      roundNumber: game.roundNumber,
      totalRounds: game.totalRounds,
      activeTeam: game.activeTeam,
      scores: {
        A: game.scores?.A || 0,
        B: game.scores?.B || 0,
      },
      roundEndsAt: game.roundEndsAt,
      secondsRemaining:
        typeof game.roundEndsAt === "number"
          ? Math.max(0, Math.ceil((game.roundEndsAt - now) / 1000))
          : 0,
      currentCard: game.currentCard,
      history: Array.isArray(game.history) ? game.history.slice(-12) : [],
    };
  }

  toLobbySnapshot(lobby) {
    const now = nowMs();
    const players = lobby.players.map((player) => ({
      id: player.id,
      name: player.name,
      team: player.team,
      ready: player.ready,
      joinedAt: player.joinedAt,
      lastSeenAt: player.lastSeenAt,
    }));

    const teams = {
      A: players
        .filter((player) => player.team === "A")
        .map((player) => player.name),
      B: players
        .filter((player) => player.team === "B")
        .map((player) => player.name),
    };

    const allReady =
      players.length > 0 && players.every((player) => player.ready);

    return {
      code: lobby.code,
      hostName: lobby.hostName,
      members: players.map((player) => player.name),
      players,
      teams,
      allReady,
      settings: {
        roundCount: lobby.settings.roundCount,
        roundDurationSeconds: lobby.settings.roundDurationSeconds,
        categoryMode: lobby.settings.categoryMode,
        categoryIds: lobby.settings.categoryIds,
        categoryNames: this.datasetService.getCategoryNames(
          lobby.settings.categoryIds || [],
        ),
      },
      game: this.toGameSnapshot(lobby.game, now),
      memberCount: players.length,
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
    };
  }
}

module.exports = {
  LobbyService,
};
