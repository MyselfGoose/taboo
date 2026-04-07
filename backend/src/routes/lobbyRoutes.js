const express = require("express");

function createLobbyRouter({ lobbyController }) {
  const router = express.Router();

  router.post("/lobbies", lobbyController.create);
  router.post("/lobbies/join", lobbyController.join);
  router.post("/sessions/restore", lobbyController.restoreSession);
  router.get("/categories", lobbyController.categories);
  router.get("/lobbies/:code", lobbyController.getByCode);
  router.get("/matches/recent", lobbyController.recentMatches);
  router.get("/leaderboard", lobbyController.leaderboard);

  return router;
}

module.exports = {
  createLobbyRouter,
};
