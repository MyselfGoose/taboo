const { AppError } = require("../utils/appError");
const { generateUniqueCode } = require("../utils/codeGenerator");
const {
  normalizeLobbyCode,
  normalizePlayerName,
} = require("../utils/validation");

class LobbyService {
  constructor({ repository, logger, config }) {
    this.repository = repository;
    this.logger = logger;
    this.config = config;
  }

  createLobby({ playerName, requestId }) {
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

    const code = generateUniqueCode({
      length: this.config.lobbyCodeLength,
      maxAttempts: this.config.lobbyMaxGenerateAttempts,
      isTaken: (candidateCode) => this.repository.hasCode(candidateCode),
    });

    const lobby = {
      code,
      hostName,
      members: [hostName],
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
}

module.exports = {
  LobbyService,
};
