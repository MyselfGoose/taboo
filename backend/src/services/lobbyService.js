const crypto = require("node:crypto");

const { AppError } = require("../utils/appError");
const { generateUniqueCode } = require("../utils/codeGenerator");
const {
  normalizeLobbyCode,
  normalizePlayerName,
  normalizeRoundCount,
  normalizeRoundDurationSeconds,
  normalizeGuessText,
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

const TURN_READY_DELAY_MS = 3000;
const NEXT_ROUND_DELAY_MS = 10000;

function buildTurnOrder(players, roundNumber = 1) {
  const teamA = players.filter((player) => player.team === "A");
  const teamB = players.filter((player) => player.team === "B");

  if (teamA.length === 0 || teamB.length === 0) {
    return [];
  }

  const roundIdx = Math.max(
    0,
    Number.isFinite(roundNumber) ? Math.floor(roundNumber) - 1 : 0,
  );
  const startA = roundIdx % teamA.length;
  const startB = roundIdx % teamB.length;

  // Rotate the per-team player lists so each round starts with a different
  // (but still deterministic) clue giver for each team.
  const rotatedA = teamA.slice(startA).concat(teamA.slice(0, startA));
  const rotatedB = teamB.slice(startB).concat(teamB.slice(0, startB));

  // Interleave by team: A0, B0, A1, B1, ... until one team runs out,
  // then let the remaining team(s) finish the round.
  const order = [];
  let aIndex = 0;
  let bIndex = 0;
  let step = 0;

  while (aIndex < rotatedA.length || bIndex < rotatedB.length) {
    const expectedTeam = step % 2 === 0 ? "A" : "B";

    if (expectedTeam === "A") {
      if (aIndex < rotatedA.length) {
        const playerA = rotatedA[aIndex];
        order.push({
          playerId: playerA.id,
          playerName: playerA.name,
          team: "A",
        });
        aIndex += 1;
      }
    } else if (bIndex < rotatedB.length) {
      const playerB = rotatedB[bIndex];
      order.push({
        playerId: playerB.id,
        playerName: playerB.name,
        team: "B",
      });
      bIndex += 1;
    }

    step += 1;
  }

  return order;
}

function trimHistory(history, maxEntries = 50) {
  if (!Array.isArray(history)) {
    return [];
  }

  if (history.length <= maxEntries) {
    return history;
  }

  return history.slice(history.length - maxEntries);
}

function cloneCard(card) {
  if (!card) {
    return null;
  }

  return {
    id: card.id,
    question: card.question,
    taboo: Array.isArray(card.taboo) ? [...card.taboo] : [],
    categoryId: card.categoryId,
    category: card.category,
  };
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

    this.ensureGameStateShape(lobby, nowMs());

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
    const turnOrder = buildTurnOrder(lobby.players, 1);

    if (turnOrder.length < 2) {
      throw new AppError(
        "At least two players are required to start the game.",
        400,
        "NOT_ENOUGH_PLAYERS",
      );
    }

    const activeTurn = turnOrder[0];

    lobby.game = {
      status: "waiting_to_start_turn",
      startedAt: now,
      endedAt: null,
      roundNumber: 1,
      totalRounds: lobby.settings.roundCount,
      activeTeam: activeTurn.team,
      activeTurn,
      turnOrder,
      turnIndex: 0,
      roundStartOffset: 0,
      scores: { A: 0, B: 0 },
      turnStartsAt: null,
      turnEndsAt: null,
      phaseEndsAt: null,
      currentCard: activeCard,
      currentCardMeta: {
        tabooUsed: false,
      },
      deck,
      review: null,
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

    if (lobby.game?.status) {
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
    lobby.game.currentCardMeta = {
      tabooUsed: false,
    };
    return lobby.game.currentCard;
  }

  ensureGameStateShape(lobby, now = nowMs()) {
    const game = lobby?.game;
    if (!game || game.status === "finished") {
      return false;
    }

    let changed = false;

    if (game.review && typeof game.review !== "object") {
      game.review = null;
      changed = true;
    }

    if (game.review && !["available", "in_progress", "resolved"].includes(game.review.status)) {
      game.review = null;
      changed = true;
    }

    if (game.review && typeof game.review.votes !== "object") {
      game.review.votes = {};
      changed = true;
    }

    if (game.review && !Array.isArray(game.review.eligiblePlayerIds)) {
      game.review.eligiblePlayerIds = [];
      changed = true;
    }

    if (!Array.isArray(game.deck)) {
      game.deck = this.ensureDeckForLobby(lobby);
      changed = true;
    }

    if (!Array.isArray(game.history)) {
      game.history = [];
      changed = true;
    }

    if (!game.currentCard && game.deck.length > 0) {
      game.currentCard = game.deck.shift() || null;
      changed = true;
    }

    if (!game.currentCardMeta || typeof game.currentCardMeta !== "object") {
      game.currentCardMeta = { tabooUsed: false };
      changed = true;
    }

    if (!Array.isArray(game.turnOrder) || game.turnOrder.length === 0) {
      game.turnOrder = buildTurnOrder(
        lobby.players,
        Number.isFinite(game.roundNumber) ? game.roundNumber : 1,
      );
      changed = true;
    }

    if (typeof game.turnIndex !== "number" || game.turnIndex < 0) {
      game.turnIndex = 0;
      changed = true;
    }

    if (
      game.turnOrder.length > 0 &&
      (game.turnIndex >= game.turnOrder.length ||
        !Number.isFinite(game.turnIndex))
    ) {
      game.turnIndex = 0;
      changed = true;
    }

    if (!game.activeTurn && game.turnOrder.length > 0) {
      let turn = null;
      if (game.activeTeam) {
        turn =
          game.turnOrder.find((entry) => entry.team === game.activeTeam) ||
          null;
      }
      if (!turn) {
        turn = game.turnOrder[game.turnIndex] || game.turnOrder[0];
      }

      if (turn) {
        game.activeTurn = turn;
        game.turnIndex = Math.max(
          0,
          game.turnOrder.findIndex((entry) => entry.playerId === turn.playerId),
        );
        changed = true;
      }
    }

    if (!game.activeTeam && game.activeTurn?.team) {
      game.activeTeam = game.activeTurn.team;
      changed = true;
    }

    if (game.status === "in_progress") {
      game.status = "turn_in_progress";
      changed = true;
    }

    if (game.status === "turn_in_progress") {
      const reviewPaused =
        game.review?.status === "in_progress" ||
        game.review?.status === "resolved";

      if (!reviewPaused) {
        const fallbackTurnEndsAt =
          typeof game.turnEndsAt === "number"
            ? game.turnEndsAt
            : typeof game.roundEndsAt === "number"
              ? game.roundEndsAt
              : now + lobby.settings.roundDurationSeconds * 1000;

        if (game.turnEndsAt !== fallbackTurnEndsAt) {
          game.turnEndsAt = fallbackTurnEndsAt;
          changed = true;
        }
      } else if (game.turnEndsAt !== null) {
        game.turnEndsAt = null;
        changed = true;
      }

      if (typeof game.turnStartsAt !== "number") {
        game.turnStartsAt = now;
        changed = true;
      }

      if (game.phaseEndsAt !== null) {
        game.phaseEndsAt = null;
        changed = true;
      }
    }

    const roundEndsAtValue = game.turnEndsAt ?? null;
    if (game.roundEndsAt !== roundEndsAtValue) {
      game.roundEndsAt = roundEndsAtValue;
      changed = true;
    }

    if (changed) {
      lobby.updatedAt = now;
      this.repository.save(lobby);
    }

    return changed;
  }

  determineViewerRole(lobby, viewerPlayerId) {
    if (!viewerPlayerId || !lobby.game || lobby.game.status === "finished") {
      return "spectator";
    }

    const viewer = this.findPlayerById(lobby, viewerPlayerId);
    if (!viewer) {
      return "spectator";
    }

    const activeTurn = lobby.game.activeTurn;
    if (!activeTurn) {
      return "spectator";
    }

    if (viewer.id === activeTurn.playerId) {
      return "clue_giver";
    }

    if (viewer.team === activeTurn.team) {
      return "teammate_guesser";
    }

    return "opponent_observer";
  }

  reconcileGameAfterRosterChange(lobby, now) {
    const game = lobby.game;
    if (!game || game.status === "finished") {
      return;
    }

    if (game.review && game.review.status === "in_progress") {
      const activeIds = new Set(lobby.players.map((player) => player.id));
      const eligible = (game.review.eligiblePlayerIds || []).filter((id) =>
        activeIds.has(id),
      );
      if (eligible.length !== game.review.eligiblePlayerIds.length) {
        game.review.eligiblePlayerIds = eligible;
        if (game.review.votes) {
          for (const id of Object.keys(game.review.votes)) {
            if (!activeIds.has(id)) {
              delete game.review.votes[id];
            }
          }
        }
      }
      this.resolveReviewIfComplete(lobby, now, "roster_change");
    }

    const schedulingRoundNumber =
      game.status === "between_rounds" ? game.roundNumber + 1 : game.roundNumber;

    game.turnOrder = buildTurnOrder(lobby.players, schedulingRoundNumber);

    if (
      game.turnOrder.length === 0 ||
      !lobby.players.some((player) => player.team === "A") ||
      !lobby.players.some((player) => player.team === "B")
    ) {
      this.finishGame(lobby, now);
      return;
    }

    if (typeof game.turnIndex !== "number" || game.turnIndex < 0) {
      game.turnIndex = 0;
    }
    if (game.turnIndex >= game.turnOrder.length) {
      game.turnIndex = 0;
    }

    const activePlayerId = game.activeTurn?.playerId || null;
    const activeIndex =
      activePlayerId === null
        ? -1
        : game.turnOrder.findIndex((entry) => entry.playerId === activePlayerId);

    if (activeIndex === -1) {
      const fallbackTurn =
        game.turnOrder[game.turnIndex] || game.turnOrder[0];
      game.turnIndex = game.turnOrder.findIndex(
        (entry) => entry.playerId === fallbackTurn.playerId,
      );
      game.activeTurn = fallbackTurn;
      game.activeTeam = fallbackTurn.team;
      game.status = "waiting_to_start_turn";
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      game.phaseEndsAt = null;
      game.lastActionAt = now;
    } else {
      // Preserve the currently active clue giver in the newly rebuilt
      // (uneven-team-safe) round schedule.
      game.turnIndex = activeIndex;
      game.activeTurn = game.turnOrder[activeIndex];
      game.activeTeam = game.activeTurn.team;
    }
  }

  startTurn({ lobby, playerId, requestId, now }) {
    const game = lobby.game;
    if (game.status !== "waiting_to_start_turn") {
      throw new AppError(
        "Turn can only be started from the turn start screen.",
        409,
        "TURN_NOT_READY",
      );
    }

    if (!game.activeTurn || game.activeTurn.playerId !== playerId) {
      throw new AppError(
        "Only the active clue giver can start this turn.",
        403,
        "NOT_CLUE_GIVER",
      );
    }

    game.status = "turn_in_progress";
    game.turnStartsAt = now;
    game.turnEndsAt = now + lobby.settings.roundDurationSeconds * 1000;
    game.phaseEndsAt = null;
    game.lastActionAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Turn started", {
      requestId,
      event: "turn_started",
      code: lobby.code,
      playerId,
      team: game.activeTeam,
      roundNumber: game.roundNumber,
      turnIndex: game.turnIndex,
    });

    return {
      lobby,
      reason: "turn_started",
    };
  }

  recordHistory(game, entry) {
    game.history = trimHistory([...(game.history || []), entry], 60);
  }

  advanceToPostTurnPhase(lobby, now, requestId, reason) {
    const game = lobby.game;

    const turnHistory = (game.history || []).filter(
      (entry) =>
        entry.playerId === game.activeTurn?.playerId ||
        (entry.team === game.activeTeam &&
          entry.at >= (game.turnStartsAt || 0)),
    );
    const correctGuesses = turnHistory.filter(
      (e) => e.action === "submit_guess" && e.matched,
    ).length;
    const skips = turnHistory.filter((e) => e.action === "skip_card").length;
    const taboos = turnHistory.filter(
      (e) => e.action === "taboo_called",
    ).length;

    game.lastTurnSummary = {
      clueGiverName: game.activeTurn?.playerName || "Player",
      team: game.activeTeam,
      correctGuesses,
      skips,
      taboos,
      pointsEarned: correctGuesses - taboos,
    };

    game.review = null;
    this.drawNextCard(lobby);

    const hasMoreTurns = game.turnIndex < game.turnOrder.length - 1;
    if (hasMoreTurns) {
      game.turnIndex += 1;
      game.activeTurn = game.turnOrder[game.turnIndex];
      game.activeTeam = game.activeTurn.team;
      game.status = "between_turns";
      game.phaseEndsAt = now + TURN_READY_DELAY_MS;
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      game.lastActionAt = now;
      lobby.updatedAt = now;
      this.repository.save(lobby);

      this.logger.info("Turn ended", {
        requestId,
        event: "turn_ended",
        code: lobby.code,
        reason,
        nextPlayerId: game.activeTurn.playerId,
        nextTeam: game.activeTeam,
      });

      return {
        lobby,
        reason: "turn_ended",
      };
    }

    if (game.roundNumber >= game.totalRounds) {
      this.finishGame(lobby, now);
      this.logger.info("Game finished", {
        requestId,
        event: "game_finished",
        code: lobby.code,
        roundNumber: game.roundNumber,
      });
      return {
        lobby,
        reason: "game_finished",
      };
    }

    game.status = "between_rounds";
    game.phaseEndsAt = now + NEXT_ROUND_DELAY_MS;
    game.turnStartsAt = null;
    game.turnEndsAt = null;
    game.lastActionAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Round completed", {
      requestId,
      event: "round_completed",
      code: lobby.code,
      roundNumber: game.roundNumber,
      nextRoundNumber: game.roundNumber + 1,
    });

    return {
      lobby,
      reason: "round_completed",
    };
  }

  applyGuessSubmission({ lobby, game, player, guess, requestId, now }) {
    if (game.status !== "turn_in_progress") {
      throw new AppError(
        "Guesses can only be submitted during an active turn.",
        409,
        "TURN_NOT_IN_PROGRESS",
      );
    }

    if (game.review?.status === "in_progress") {
      throw new AppError(
        "Guesses are paused during a review.",
        409,
        "REVIEW_IN_PROGRESS",
      );
    }

    if (!game.activeTurn || player.team !== game.activeTurn.team) {
      throw new AppError(
        "Only the active team can submit guesses.",
        403,
        "NOT_ACTIVE_TEAM",
      );
    }

    if (player.id === game.activeTurn.playerId) {
      throw new AppError(
        "Clue giver cannot submit guesses.",
        403,
        "CLUE_GIVER_CANNOT_GUESS",
      );
    }

    const normalizedGuess = normalizeGuessText(guess);
    if (!normalizedGuess) {
      throw new AppError("Guess cannot be empty.", 400, "INVALID_GUESS");
    }

    const normalizedAnswer = normalizeGuessText(game.currentCard?.question);
    const isCorrect = normalizedGuess === normalizedAnswer;

    this.recordHistory(game, {
      at: now,
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      action: "submit_guess",
      guess: guess,
      normalizedGuess,
      cardId: game.currentCard ? game.currentCard.id : null,
      cardQuestion: game.currentCard ? game.currentCard.question : null,
      matched: isCorrect,
      points: isCorrect ? 1 : 0,
    });

    game.lastActionAt = now;

    if (!isCorrect) {
      lobby.updatedAt = now;
      this.repository.save(lobby);
      return {
        lobby,
        reason: "guess_incorrect",
      };
    }

    game.scores[game.activeTeam] += 1;
    this.drawNextCard(lobby);
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Correct guess", {
      requestId,
      event: "game_action",
      code: lobby.code,
      playerId: player.id,
      action: "submit_guess",
      points: 1,
      activeTeam: game.activeTeam,
      scoreA: game.scores.A,
      scoreB: game.scores.B,
    });

    return {
      lobby,
      reason: "guess_correct",
    };
  }

  applySkipCard({ lobby, game, player, requestId, now }) {
    if (game.status !== "turn_in_progress") {
      throw new AppError(
        "Skip can only be used during an active turn.",
        409,
        "TURN_NOT_IN_PROGRESS",
      );
    }

    if (game.review?.status === "in_progress") {
      throw new AppError(
        "Skipping is paused during a review.",
        409,
        "REVIEW_IN_PROGRESS",
      );
    }

    if (!game.activeTurn || game.activeTurn.playerId !== player.id) {
      throw new AppError(
        "Only the active clue giver can skip the card.",
        403,
        "NOT_CLUE_GIVER",
      );
    }

    this.recordHistory(game, {
      at: now,
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      action: "skip_card",
      points: 0,
      cardId: game.currentCard ? game.currentCard.id : null,
      cardQuestion: game.currentCard ? game.currentCard.question : null,
    });
    game.lastActionAt = now;

    this.drawNextCard(lobby);
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Card skipped", {
      requestId,
      event: "game_action",
      code: lobby.code,
      playerId: player.id,
      action: "skip_card",
      activeTeam: game.activeTeam,
    });

    return {
      lobby,
      reason: "skip_card",
    };
  }

  applyTabooCalled({ lobby, game, player, requestId, now }) {
    if (game.status !== "turn_in_progress") {
      throw new AppError(
        "Taboo can only be called during an active turn.",
        409,
        "TURN_NOT_IN_PROGRESS",
      );
    }

    if (game.review?.status === "in_progress") {
      throw new AppError(
        "Taboo cannot be called during a review.",
        409,
        "REVIEW_IN_PROGRESS",
      );
    }

    if (!game.activeTurn || player.team === game.activeTurn.team) {
      throw new AppError(
        "Only the opposing team can call Taboo.",
        403,
        "TABOO_NOT_ALLOWED",
      );
    }

    if (game.currentCardMeta?.tabooUsed) {
      throw new AppError(
        "Taboo has already been called for this card.",
        409,
        "TABOO_ALREADY_USED",
      );
    }

    const tabooCard = cloneCard(game.currentCard);
    const penalizedTeam = game.activeTurn.team;

    game.currentCardMeta = {
      ...game.currentCardMeta,
      tabooUsed: true,
    };
    game.scores[penalizedTeam] -= 1;

    this.recordHistory(game, {
      at: now,
      playerId: player.id,
      playerName: player.name,
      team: player.team,
      action: "taboo_called",
      points: -1,
      penalizedTeam,
      cardId: game.currentCard ? game.currentCard.id : null,
      cardQuestion: game.currentCard ? game.currentCard.question : null,
    });

    const remainingMs =
      typeof game.turnEndsAt === "number"
        ? Math.max(0, game.turnEndsAt - now)
        : 0;

    game.lastActionAt = now;
    game.review = {
      id: crypto.randomUUID(),
      status: "available",
      tabooCard,
      tabooCalledBy: {
        playerId: player.id,
        playerName: player.name,
        team: player.team,
      },
      penalizedTeam,
      votes: {},
      eligiblePlayerIds: [],
      pausedRemainingMs: remainingMs,
      outcome: null,
    };
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Taboo called", {
      requestId,
      event: "game_action",
      code: lobby.code,
      playerId: player.id,
      action: "taboo_called",
      penalizedTeam,
      scoreA: game.scores.A,
      scoreB: game.scores.B,
    });

    return {
      lobby,
      reason: "taboo_called",
    };
  }

  resolveReviewIfComplete(lobby, now, requestId) {
    const game = lobby.game;
    const review = game?.review;

    if (!review || review.status !== "in_progress") {
      return null;
    }

    const eligible = Array.isArray(review.eligiblePlayerIds)
      ? review.eligiblePlayerIds
      : [];
    if (eligible.length === 0) {
      return null;
    }

    const votes = review.votes || {};
    const eligibleVotes = eligible.filter(
      (playerId) => votes[playerId] === "fair" || votes[playerId] === "not_fair",
    );

    if (eligibleVotes.length < eligible.length) {
      return null;
    }

    const notFairCount = eligibleVotes.filter(
      (playerId) => votes[playerId] === "not_fair",
    ).length;
    const ratio = notFairCount / eligible.length;
    const outcome = ratio >= 0.8 ? "reverted" : "upheld";

    if (outcome === "reverted" && review.penalizedTeam) {
      if (game.scores?.[review.penalizedTeam] === undefined) {
        game.scores = game.scores || { A: 0, B: 0 };
        game.scores[review.penalizedTeam] = 0;
      }
      game.scores[review.penalizedTeam] += 1;
    }

    review.status = "resolved";
    review.outcome = outcome;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Review resolved", {
      requestId,
      event: "review_resolved",
      code: lobby.code,
      penalizedTeam: review.penalizedTeam,
      outcome,
      notFairCount,
      totalVotes: eligible.length,
    });

    return {
      outcome,
      notFairCount,
      totalVotes: eligible.length,
    };
  }

  requestReview({ lobby, game, player, requestId, now }) {
    if (game.status !== "turn_in_progress") {
      throw new AppError(
        "Review can only be requested during an active turn.",
        409,
        "TURN_NOT_IN_PROGRESS",
      );
    }

    if (!game.review || game.review.status !== "available") {
      throw new AppError(
        "No review is available for the current turn.",
        409,
        "REVIEW_NOT_AVAILABLE",
      );
    }

    if (player.team !== game.review.penalizedTeam) {
      throw new AppError(
        "Only the penalized team can request a review.",
        403,
        "REVIEW_NOT_ALLOWED",
      );
    }

    const remainingMs =
      typeof game.turnEndsAt === "number"
        ? Math.max(0, game.turnEndsAt - now)
        : 0;

    game.turnEndsAt = null;
    game.phaseEndsAt = null;
    game.review.status = "in_progress";
    game.review.votes = {};
    game.review.eligiblePlayerIds = lobby.players.map((playerEntry) => playerEntry.id);
    game.review.pausedRemainingMs = remainingMs;
    game.review.outcome = null;
    game.lastActionAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Review requested", {
      requestId,
      event: "review_requested",
      code: lobby.code,
      penalizedTeam: game.review.penalizedTeam,
      remainingMs,
    });

    return {
      lobby,
      reason: "review_started",
    };
  }

  dismissReview({ lobby, game, player, requestId, now }) {
    if (game.status !== "turn_in_progress") {
      throw new AppError(
        "Review can only be dismissed during an active turn.",
        409,
        "TURN_NOT_IN_PROGRESS",
      );
    }

    if (!game.review || game.review.status !== "available") {
      throw new AppError(
        "No review is available for the current turn.",
        409,
        "REVIEW_NOT_AVAILABLE",
      );
    }

    if (player.team !== game.review.penalizedTeam) {
      throw new AppError(
        "Only the penalized team can dismiss this review.",
        403,
        "REVIEW_NOT_ALLOWED",
      );
    }

    game.review = null;
    game.lastActionAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Review dismissed", {
      requestId,
      event: "review_dismissed",
      code: lobby.code,
      playerId: player.id,
      team: player.team,
    });

    return {
      lobby,
      reason: "review_dismissed",
    };
  }

  applyReviewVote({ lobby, game, player, vote, requestId, now }) {
    if (!game.review || game.review.status !== "in_progress") {
      throw new AppError(
        "Review voting is not active.",
        409,
        "REVIEW_NOT_ACTIVE",
      );
    }

    const normalizedVote =
      vote === "not_fair" || vote === "fair" ? vote : null;

    if (!normalizedVote) {
      throw new AppError("Vote must be fair or not_fair.", 400, "INVALID_VOTE");
    }

    const eligible = new Set(game.review.eligiblePlayerIds || []);
    if (!eligible.has(player.id)) {
      throw new AppError(
        "You are not eligible to vote on this review.",
        403,
        "REVIEW_NOT_ELIGIBLE",
      );
    }

    game.review.votes = game.review.votes || {};
    game.review.votes[player.id] = normalizedVote;
    game.lastActionAt = now;

    const resolved = this.resolveReviewIfComplete(lobby, now, requestId);
    if (!resolved) {
      lobby.updatedAt = now;
      this.repository.save(lobby);
    }

    return {
      lobby,
      reason: resolved ? "review_resolved" : "review_vote",
    };
  }

  continueAfterReview({ lobby, game, player, requestId, now }) {
    if (!game.review || game.review.status !== "resolved") {
      throw new AppError(
        "Review has not been resolved yet.",
        409,
        "REVIEW_NOT_RESOLVED",
      );
    }

    if (!game.activeTurn || game.activeTurn.playerId !== player.id) {
      throw new AppError(
        "Only the active clue giver can continue after review.",
        403,
        "REVIEW_CONTINUE_NOT_ALLOWED",
      );
    }

    const remainingMs =
      typeof game.review.pausedRemainingMs === "number"
        ? Math.max(0, game.review.pausedRemainingMs)
        : 0;

    if (game.review.outcome === "upheld") {
      this.drawNextCard(lobby);
    }

    if (game.review.outcome === "reverted") {
      game.currentCardMeta = {
        ...game.currentCardMeta,
        tabooUsed: false,
      };
    }

    game.turnEndsAt = now + remainingMs;
    game.review = null;
    game.lastActionAt = now;
    lobby.updatedAt = now;
    this.repository.save(lobby);

    this.logger.info("Review continued", {
      requestId,
      event: "review_continued",
      code: lobby.code,
      remainingMs,
    });

    return {
      lobby,
      reason: "review_continued",
    };
  }

  applyGameActionByPlayerId({
    lobbyCode,
    playerId,
    action,
    guess,
    vote,
    requestId,
  }) {
    const now = nowMs();
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    this.ensureGameStateShape(lobby, now);

    const game = lobby.game;
    if (!game || game.status === "finished") {
      throw new AppError("Game is not active.", 400, "GAME_NOT_ACTIVE");
    }

    const player = this.findPlayerById(lobby, playerId);
    if (!player) {
      throw new AppError("Player not found in lobby.", 404, "PLAYER_NOT_FOUND");
    }

    if (action === "start_turn") {
      return this.startTurn({ lobby, playerId, requestId, now });
    }

    if (action === "submit_guess") {
      return this.applyGuessSubmission({
        lobby,
        game,
        player,
        guess,
        requestId,
        now,
      });
    }

    if (action === "skip_card") {
      return this.applySkipCard({ lobby, game, player, requestId, now });
    }

    if (action === "taboo_called") {
      return this.applyTabooCalled({ lobby, game, player, requestId, now });
    }

    if (action === "request_review") {
      return this.requestReview({ lobby, game, player, requestId, now });
    }

    if (action === "dismiss_review") {
      return this.dismissReview({ lobby, game, player, requestId, now });
    }

    if (action === "review_vote") {
      return this.applyReviewVote({
        lobby,
        game,
        player,
        vote,
        requestId,
        now,
      });
    }

    if (action === "review_continue") {
      return this.continueAfterReview({ lobby, game, player, requestId, now });
    }

    throw new AppError("Unsupported game action.", 400, "INVALID_GAME_ACTION");
  }

  finishGame(lobby, now) {
    lobby.game.status = "finished";
    lobby.game.endedAt = now;
    lobby.game.turnEndsAt = null;
    lobby.game.phaseEndsAt = null;
    lobby.game.turnStartsAt = null;
    lobby.game.currentCard = null;
    lobby.game.review = null;
    lobby.updatedAt = now;
    this.repository.save(lobby);
  }

  advanceGamePhase(lobby, now) {
    this.ensureGameStateShape(lobby, now);

    const game = lobby.game;
    if (!game || game.status === "finished") {
      return null;
    }

    if (
      game.status === "turn_in_progress" &&
      typeof game.turnEndsAt === "number" &&
      game.turnEndsAt <= now
    ) {
      this.recordHistory(game, {
        at: now,
        action: "turn_timeout",
        team: game.activeTeam,
        playerId: game.activeTurn?.playerId || null,
        playerName: game.activeTurn?.playerName || null,
        points: 0,
      });
      game.lastActionAt = now;
      return this.advanceToPostTurnPhase(lobby, now, "ticker", "turn_timeout")
        .reason;
    }

    if (
      game.status === "between_turns" &&
      typeof game.phaseEndsAt === "number" &&
      game.phaseEndsAt <= now
    ) {
      game.status = "waiting_to_start_turn";
      game.phaseEndsAt = null;
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      game.lastActionAt = now;
      lobby.updatedAt = now;
      this.repository.save(lobby);
      return "next_turn_ready";
    }

    if (
      game.status === "between_rounds" &&
      typeof game.phaseEndsAt === "number" &&
      game.phaseEndsAt <= now
    ) {
      game.roundNumber += 1;
      game.turnOrder = buildTurnOrder(lobby.players, game.roundNumber);
      if (!Array.isArray(game.turnOrder) || game.turnOrder.length === 0) {
        this.finishGame(lobby, now);
        return "game_finished";
      }

      game.turnIndex = 0;
      game.activeTurn = game.turnOrder[0];
      game.activeTeam = game.activeTurn.team;
      game.status = "waiting_to_start_turn";
      game.phaseEndsAt = null;
      game.turnStartsAt = null;
      game.turnEndsAt = null;
      game.lastActionAt = now;
      lobby.updatedAt = now;
      this.repository.save(lobby);
      return "round_started";
    }

    return null;
  }

  advanceExpiredGames(now = nowMs()) {
    const lobbies = this.repository.listAll();
    const updates = [];

    for (const lobby of lobbies) {
      if (!lobby.game || lobby.game.status === "finished") {
        continue;
      }

      const reason = this.advanceGamePhase(lobby, now);
      if (reason) {
        updates.push({ code: lobby.code, reason });
      }
    }

    return updates;
  }

  toGameSnapshot(
    game,
    now = nowMs(),
    viewerRole = "spectator",
    viewer = null,
    playerNameById = new Map(),
  ) {
    if (!game) {
      return null;
    }

    const reviewPaused =
      game.review?.status === "in_progress" ||
      game.review?.status === "resolved";
    const countdownEndsAt = reviewPaused
      ? null
      : typeof game.turnEndsAt === "number"
        ? game.turnEndsAt
        : typeof game.phaseEndsAt === "number"
          ? game.phaseEndsAt
          : null;

    const secondsRemaining = reviewPaused
      ? Math.max(
          0,
          Math.ceil((game.review?.pausedRemainingMs || 0) / 1000),
        )
      : countdownEndsAt
        ? Math.max(0, Math.ceil((countdownEndsAt - now) / 1000))
        : 0;

    const isTurnActive = game.status === "turn_in_progress";
    const shouldHideCard =
      !isTurnActive ||
      viewerRole === "spectator" ||
      viewerRole === "teammate_guesser";
    const viewerTeam = viewer?.team || null;
    const viewerId = viewer?.id || null;

    const review = game.review;
    let reviewSnapshot = null;
    if (review && review.status) {
      const eligibleIds = Array.isArray(review.eligiblePlayerIds)
        ? review.eligiblePlayerIds
        : [];
      const voteMap = review.votes || {};
      const votes = eligibleIds.map((playerId) => ({
        playerId,
        playerName: playerNameById.get(playerId),
        vote: voteMap[playerId] || null,
      }));
      const notFairCount = eligibleIds.filter(
        (playerId) => voteMap[playerId] === "not_fair",
      ).length;
      const fairCount = eligibleIds.filter(
        (playerId) => voteMap[playerId] === "fair",
      ).length;

      reviewSnapshot = {
        id: review.id || null,
        status: review.status,
        tabooCard: review.tabooCard || null,
        tabooCalledBy: review.tabooCalledBy || null,
        penalizedTeam: review.penalizedTeam || null,
        votes,
        eligibleCount: eligibleIds.length,
        fairCount,
        notFairCount,
        outcome: review.outcome || null,
      };
    }

    return {
      status: game.status,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      roundNumber: game.roundNumber,
      totalRounds: game.totalRounds,
      nextRoundNumber:
        game.status === "between_rounds"
          ? Math.min(game.totalRounds, game.roundNumber + 1)
          : game.roundNumber,
      activeTeam: game.activeTeam,
      activeTurn: game.activeTurn
        ? {
            playerId: game.activeTurn.playerId,
            playerName: game.activeTurn.playerName,
            team: game.activeTurn.team,
            turnIndexInRound: game.turnIndex + 1,
            totalTurnsInRound: Array.isArray(game.turnOrder)
              ? game.turnOrder.length
              : 0,
          }
        : null,
      scores: {
        A: game.scores?.A || 0,
        B: game.scores?.B || 0,
      },
      turnStartsAt: game.turnStartsAt,
      turnEndsAt: game.turnEndsAt,
      phaseEndsAt: game.phaseEndsAt,
      roundEndsAt: reviewPaused ? null : game.turnEndsAt,
      secondsRemaining,
      viewerRole,
      roleHint:
        viewerRole === "clue_giver"
          ? "You are giving clues."
          : viewerRole === "teammate_guesser"
            ? "Work with your team to guess the word."
            : viewerRole === "opponent_observer"
              ? "Watch for taboo words."
              : "Waiting for active turn.",
      permissions: {
        canStartTurn:
          viewerRole === "clue_giver" &&
          game.status === "waiting_to_start_turn",
        canSubmitGuess:
          viewerRole === "teammate_guesser" &&
          game.status === "turn_in_progress" &&
          !reviewPaused,
        canSkipCard:
          viewerRole === "clue_giver" &&
          game.status === "turn_in_progress" &&
          !reviewPaused,
        canCallTaboo:
          viewerRole === "opponent_observer" &&
          game.status === "turn_in_progress" &&
          !game.currentCardMeta?.tabooUsed &&
          !reviewPaused,
        canRequestReview:
          review?.status === "available" &&
          Boolean(viewerTeam) &&
          viewerTeam === review.penalizedTeam,
        canDismissReview:
          review?.status === "available" &&
          Boolean(viewerTeam) &&
          viewerTeam === review.penalizedTeam,
        canVoteReview:
          review?.status === "in_progress" &&
          Boolean(viewerId) &&
          (review.eligiblePlayerIds || []).includes(viewerId),
        canContinueAfterReview:
          review?.status === "resolved" &&
          Boolean(viewerId) &&
          viewerId === game.activeTurn?.playerId,
      },
      currentCard: shouldHideCard ? null : game.currentCard,
      cardVisibleToViewer: !shouldHideCard,
      tabooUsedForCard: Boolean(game.currentCardMeta?.tabooUsed),
      lastTurnSummary: game.lastTurnSummary || null,
      history: Array.isArray(game.history) ? game.history.slice(-12) : [],
      review: reviewSnapshot,
    };
  }

  toLobbySnapshot(lobby, { viewerPlayerId = null } = {}) {
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

    const viewerRole = this.determineViewerRole(lobby, viewerPlayerId);
    const viewer = viewerPlayerId
      ? this.findPlayerById(lobby, viewerPlayerId)
      : null;
    const playerNameById = new Map(players.map((player) => [player.id, player.name]));

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
      game: this.toGameSnapshot(
        lobby.game,
        now,
        viewerRole,
        viewer,
        playerNameById,
      ),
      memberCount: players.length,
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
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
      this.reconcileGameAfterRosterChange(lobby, now);
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
      this.reconcileGameAfterRosterChange(lobby, now);
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
}

module.exports = {
  LobbyService,
};
