function createLobbyController({ lobbyService }) {
  return {
    create(req, res, next) {
      try {
        const payload = {
          playerName: req.body?.name,
          roundCount: req.body?.roundCount,
          roundDurationSeconds: req.body?.roundDurationSeconds,
          categoryMode: req.body?.categoryMode,
          categoryIds: req.body?.categoryIds,
          requestId: req.requestId,
        };

        const result = lobbyService.createLobbyWithSession
          ? lobbyService.createLobbyWithSession(payload)
          : { lobby: lobbyService.createLobby(payload) };

        return res.status(201).json({
          code: result.lobby.code,
          ...(result.playerId ? { playerId: result.playerId } : {}),
          ...(result.playerName ? { playerName: result.playerName } : {}),
          ...(result.resumeToken ? { resumeToken: result.resumeToken } : {}),
          lobby: lobbyService.toLobbySnapshot(result.lobby),
        });
      } catch (error) {
        return next(error);
      }
    },

    categories(req, res, next) {
      try {
        const categories = lobbyService.listCategories();
        return res.status(200).json({ categories });
      } catch (error) {
        return next(error);
      }
    },

    join(req, res, next) {
      try {
        const payload = {
          playerName: req.body?.name,
          lobbyCode: req.body?.code,
          requestId: req.requestId,
        };

        const result = lobbyService.joinLobbyWithSession
          ? lobbyService.joinLobbyWithSession(payload)
          : { lobby: lobbyService.joinLobby(payload) };

        return res.status(200).json({
          code: result.lobby.code,
          ...(result.playerId ? { playerId: result.playerId } : {}),
          ...(result.playerName ? { playerName: result.playerName } : {}),
          ...(result.resumeToken ? { resumeToken: result.resumeToken } : {}),
          lobby: lobbyService.toLobbySnapshot(result.lobby),
        });
      } catch (error) {
        return next(error);
      }
    },

    restoreSession(req, res, next) {
      try {
        const result = lobbyService.restoreSession({
          lobbyCode: req.body?.code,
          resumeToken: req.body?.resumeToken,
          requestId: req.requestId,
        });

        return res.status(200).json({
          code: result.lobby.code,
          playerId: result.playerId,
          playerName: result.playerName,
          resumeToken: result.resumeToken,
          lobby: lobbyService.toLobbySnapshot(result.lobby),
        });
      } catch (error) {
        return next(error);
      }
    },

    getByCode(req, res, next) {
      try {
        const lobby = lobbyService.getLobby({
          lobbyCode: req.params.code,
        });
        return res.status(200).json({
          code: lobby.code,
          lobby: lobbyService.toLobbySnapshot(lobby),
        });
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createLobbyController,
};
