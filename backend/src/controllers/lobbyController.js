function createLobbyController({ lobbyService }) {
  return {
    create(req, res, next) {
      try {
        const lobby = lobbyService.createLobby({
          playerName: req.body?.name,
          roundCount: req.body?.roundCount,
          roundDurationSeconds: req.body?.roundDurationSeconds,
          requestId: req.requestId,
        });
        return res.status(201).json({
          code: lobby.code,
          lobby: lobbyService.toLobbySnapshot(lobby),
        });
      } catch (error) {
        return next(error);
      }
    },

    join(req, res, next) {
      try {
        const lobby = lobbyService.joinLobby({
          playerName: req.body?.name,
          lobbyCode: req.body?.code,
          requestId: req.requestId,
        });
        return res.status(200).json({
          code: lobby.code,
          lobby: lobbyService.toLobbySnapshot(lobby),
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
