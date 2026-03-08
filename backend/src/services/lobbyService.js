const { AppError } = require("../utils/appError");
const { generateUniqueCode } = require("../utils/codeGenerator");
const {
  normalizeLobbyCode,
  normalizePlayerName,
  normalizeRoundCount,
  normalizeRoundDurationSeconds,
} = require("../utils/validation");

class LobbyService {
  constructor({ repository, logger, config }) {
    this.repository = repository;
    this.logger = logger;
    this.config = config;
  }

  createLobby({ playerName, roundCount, roundDurationSeconds, requestId }) {
    const now = Date.now();
    this.repository.cleanupExpired(now, this.config.lobbyTtlMs);

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

  getLobby({ lobbyCode }) {
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    return lobby;
  }

  joinLobby({ playerName, lobbyCode, requestId }) {
    const now = Date.now();
    this.repository.cleanupExpired(now, this.config.lobbyTtlMs);

    const memberName = normalizePlayerName(playerName);
    const code = normalizeLobbyCode(lobbyCode);

    const lobby = this.repository.getByCode(code);
    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const existingPlayer = lobby.players.find(
      (player) => player.name.toLowerCase() === memberName.toLowerCase(),
    );

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
        name: memberName,
        team: nextTeam,
        ready: false,
        joinedAt: now,
        lastSeenAt: now,
      });
      lobby.updatedAt = now;
    } else {
      existingPlayer.lastSeenAt = now;
    }

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

  setPlayerTeam({ playerName, lobbyCode, team, requestId }) {
    const now = Date.now();
    const memberName = normalizePlayerName(playerName);
    const code = normalizeLobbyCode(lobbyCode);
    const normalizedTeam = team === "B" ? "B" : "A";
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const player = lobby.players.find(
      (entry) => entry.name.toLowerCase() === memberName.toLowerCase(),
    );

    if (!player) {
      throw new AppError("Player not found in lobby.", 404, "PLAYER_NOT_FOUND");
    }

    player.team = normalizedTeam;
    player.lastSeenAt = now;
    lobby.updatedAt = now;

    this.logger.info("Lobby team changed", {
      requestId,
      event: "lobby_team_changed",
      code,
      playerName: player.name,
      team: player.team,
    });

    return lobby;
  }

  setPlayerReady({ playerName, lobbyCode, ready, requestId }) {
    const now = Date.now();
    const memberName = normalizePlayerName(playerName);
    const code = normalizeLobbyCode(lobbyCode);
    const lobby = this.repository.getByCode(code);

    if (!lobby) {
      throw new AppError("Lobby not found.", 404, "LOBBY_NOT_FOUND");
    }

    const player = lobby.players.find(
      (entry) => entry.name.toLowerCase() === memberName.toLowerCase(),
    );

    if (!player) {
      throw new AppError("Player not found in lobby.", 404, "PLAYER_NOT_FOUND");
    }

    player.ready = Boolean(ready);
    player.lastSeenAt = now;
    lobby.updatedAt = now;

    this.logger.info("Lobby ready state changed", {
      requestId,
      event: "lobby_ready_changed",
      code,
      playerName: player.name,
      ready: player.ready,
    });

    return lobby;
  }

  toLobbySnapshot(lobby) {
    const players = lobby.players.map((player) => ({
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
