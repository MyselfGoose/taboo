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

    const lobby = {
      code,
      hostName,
      members: [hostName],
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
      memberCount: lobby.members.length,
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

    const hasMember = lobby.members.some(
      (existingName) => existingName.toLowerCase() === memberName.toLowerCase(),
    );

    if (!hasMember) {
      lobby.members.push(memberName);
      lobby.updatedAt = now;
    }

    this.logger.info("Lobby joined", {
      requestId,
      event: "lobby_joined",
      code: lobby.code,
      joinedName: memberName,
      memberCount: lobby.members.length,
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

    const previousLength = lobby.members.length;
    lobby.members = lobby.members.filter(
      (existingName) => existingName.toLowerCase() !== memberName.toLowerCase(),
    );

    if (lobby.members.length !== previousLength) {
      lobby.updatedAt = now;
      this.logger.info("Lobby member removed", {
        requestId,
        event: "lobby_member_left",
        code,
        leftName: memberName,
        memberCount: lobby.members.length,
      });
    }

    return lobby;
  }

  toLobbySnapshot(lobby) {
    return {
      code: lobby.code,
      hostName: lobby.hostName,
      members: [...lobby.members],
      settings: {
        roundCount: lobby.settings.roundCount,
        roundDurationSeconds: lobby.settings.roundDurationSeconds,
      },
      memberCount: lobby.members.length,
      createdAt: lobby.createdAt,
      updatedAt: lobby.updatedAt,
    };
  }
}

module.exports = {
  LobbyService,
};
