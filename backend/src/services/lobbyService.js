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

class LobbyService {
  constructor({ repository, sessionRepository, logger, config }) {
    this.repository = repository;
    this.sessionRepository =
      sessionRepository || new InMemorySessionRepository();
    this.logger = logger;
    this.config = config;
  }

  cleanup(now = Date.now()) {
    this.repository.cleanupExpired(now, this.config.lobbyTtlMs);
    this.sessionRepository.cleanupExpired(now);
  }

  createLobby({ playerName, roundCount, roundDurationSeconds, requestId }) {
    const now = Date.now();
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
      },
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
    });

    return lobby;
  }

  createLobbyWithSession({
    playerName,
    roundCount,
    roundDurationSeconds,
    requestId,
  }) {
    const lobby = this.createLobby({
      playerName,
      roundCount,
      roundDurationSeconds,
      requestId,
    });

    const player = lobby.players[0];
    const now = Date.now();
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
    const now = Date.now();
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

      const nextTeam = teamCounts.A <= teamCounts.B ? "A" : "B";
      lobby.players.push({
        id: crypto.randomUUID(),
        name: memberName,
        team: nextTeam,
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
    const now = Date.now();

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
    const now = Date.now();
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
    const now = Date.now();
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
    const now = Date.now();
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
    const now = Date.now();
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
    const now = Date.now();
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

  toLobbySnapshot(lobby) {
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
      },
      memberCount: players.length,
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
    };
  }
}

module.exports = {
  LobbyService,
};
