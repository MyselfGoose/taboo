function createLobbyController({ lobbyService }) {
  return {
    create(req, res, next) {
      try {
        const lobby = lobbyService.createLobby({
          playerName: req.body?.name,
          requestId: req.requestId,
        });
        return res.status(201).json({ code: lobby.code });
      } catch (error) {
        return next(error);
      }
    },

    join(req, res, next) {
      try {
        lobbyService.joinLobby({
          playerName: req.body?.name,
          lobbyCode: req.body?.code,
          requestId: req.requestId,
        });
        return res.status(204).send();
      } catch (error) {
        return next(error);
      }
    },
  };
}

module.exports = {
  createLobbyController,
};
