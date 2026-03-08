const express = require("express");

function createLobbyRouter({ lobbyController }) {
  const router = express.Router();

  router.post("/lobbies", lobbyController.create);
  router.post("/lobbies/join", lobbyController.join);

  return router;
}

module.exports = {
  createLobbyRouter,
};
