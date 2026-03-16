const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");

const {
  normalizeLobbyCode,
  normalizePlayerName,
} = require("../utils/validation");

function keyForMember(code, playerId) {
  return `${code}:${playerId}`;
}

function safeSend(socket, payload) {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function createLobbyRealtimeHub({ server, lobbyService, logger }) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const socketsByLobby = new Map();
  const memberConnectionCount = new Map();
  const socketContext = new WeakMap();

  function broadcastLobbyState(code, reason) {
    const lobby = lobbyService.getLobby({ lobbyCode: code });
    const sockets = socketsByLobby.get(code);

    if (!sockets || sockets.size === 0) {
      return;
    }

    for (const socket of sockets) {
      const ctx = socketContext.get(socket);
      const viewerPlayerId = ctx?.playerId || null;
      const snapshot = lobbyService.toLobbySnapshot(lobby, {
        viewerPlayerId,
      });
      safeSend(socket, {
        type: "lobby_state",
        reason,
        lobby: snapshot,
      });
    }
  }

  function removeSocketFromLobby(socket, reason) {
    const ctx = socketContext.get(socket);
    if (!ctx || !ctx.code || !ctx.playerId) {
      return;
    }

    const sockets = socketsByLobby.get(ctx.code);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        socketsByLobby.delete(ctx.code);
      }
    }

    const memberKey = keyForMember(ctx.code, ctx.playerId);
    const nextCount = (memberConnectionCount.get(memberKey) || 1) - 1;

    if (nextCount <= 0) {
      memberConnectionCount.delete(memberKey);
      const lobby = lobbyService.removeLobbyMemberById({
        playerId: ctx.playerId,
        lobbyCode: ctx.code,
        requestId: ctx.requestId,
      });

      if (lobby) {
        try {
          broadcastLobbyState(ctx.code, reason || "member_left");
        } catch (error) {
          logger.warn("Lobby broadcast skipped after disconnect", {
            event: "ws_broadcast_skip",
            code: ctx.code,
            message: error.message,
          });
        }
      }
    } else {
      memberConnectionCount.set(memberKey, nextCount);
    }
  }

  wss.on("connection", (socket) => {
    const requestId = crypto.randomUUID();
    socket.isAlive = true;

    socket.on("pong", () => {
      socket.isAlive = true;
    });

    socket.on("message", (rawMessage) => {
      let message;
      try {
        message = JSON.parse(rawMessage.toString("utf8"));
      } catch (_error) {
        safeSend(socket, {
          type: "error",
          code: "INVALID_WS_MESSAGE",
          message: "Message must be valid JSON.",
        });
        return;
      }

      try {
        if (message.type === "subscribe") {
          let code;
          let playerId;
          let lobby;

          if (message.resumeToken) {
            const restored = lobbyService.restoreSession({
              lobbyCode: message.code,
              resumeToken: message.resumeToken,
              requestId,
            });
            code = restored.lobby.code;
            playerId = restored.playerId;
            lobby = restored.lobby;
          } else {
            code = normalizeLobbyCode(message.code);
            const name = normalizePlayerName(message.name);
            lobby = lobbyService.joinLobby({
              playerName: name,
              lobbyCode: code,
              requestId,
            });
            playerId = lobbyService.findPlayerByName(lobby, name)?.id;
          }

          if (!playerId) {
            throw new Error("Unable to identify player for subscription.");
          }

          logger.info("WebSocket subscribe resolved", {
            event: "ws_subscribe_resolved",
            code,
            playerId,
            playerName: message.resumeToken ? "(via token)" : message.name,
            method: message.resumeToken ? "resumeToken" : "name",
            lobbyPlayerIds: lobby.players.map((p) => p.id),
          });

          let lobbySockets = socketsByLobby.get(code);
          if (!lobbySockets) {
            lobbySockets = new Set();
            socketsByLobby.set(code, lobbySockets);
          }

          const previousCtx = socketContext.get(socket);
          if (previousCtx && previousCtx.code && previousCtx.playerId) {
            removeSocketFromLobby(socket, "member_moved");
          }

          lobbySockets.add(socket);
          socketContext.set(socket, { code, playerId, requestId });

          const memberKey = keyForMember(code, playerId);
          memberConnectionCount.set(
            memberKey,
            (memberConnectionCount.get(memberKey) || 0) + 1,
          );

          safeSend(socket, {
            type: "subscribed",
            lobby: lobbyService.toLobbySnapshot(lobby, {
              viewerPlayerId: playerId,
            }),
          });

          broadcastLobbyState(code, "member_joined");
          return;
        }

        const ctx = socketContext.get(socket);
        if (!ctx?.code || !ctx?.playerId) {
          safeSend(socket, {
            type: "error",
            code: "NOT_SUBSCRIBED",
            message: "Subscribe to a lobby before sending actions.",
          });
          return;
        }

        if (message.type === "change_team") {
          const lobby = lobbyService.setPlayerTeamById({
            playerId: ctx.playerId,
            lobbyCode: ctx.code,
            team: message.team,
            requestId: ctx.requestId,
          });

          broadcastLobbyState(lobby.code, "team_changed");
          return;
        }

        if (message.type === "set_ready") {
          const lobby = lobbyService.setPlayerReadyById({
            playerId: ctx.playerId,
            lobbyCode: ctx.code,
            ready: message.ready,
            requestId: ctx.requestId,
          });

          const started = lobbyService.startGameIfAllReady({
            lobbyCode: lobby.code,
            requestId: ctx.requestId,
          });
          broadcastLobbyState(
            lobby.code,
            started ? "game_started" : "ready_changed",
          );
          return;
        }

        if (message.type === "game_action") {
          const result = lobbyService.applyGameActionByPlayerId({
            playerId: ctx.playerId,
            lobbyCode: ctx.code,
            action: message.action,
            guess: message.guess,
            vote: message.vote,
            requestId: ctx.requestId,
          });

          broadcastLobbyState(
            result.lobby.code,
            result.reason || `game_action_${message.action}`,
          );
          return;
        }

        safeSend(socket, {
          type: "error",
          code: "INVALID_WS_EVENT",
          message: "Unsupported websocket event.",
        });
      } catch (error) {
        safeSend(socket, {
          type: "error",
          code: error.code || "WS_ACTION_FAILED",
          message: error.message || "Could not process websocket action.",
        });
      }
    });

    socket.on("close", () => {
      removeSocketFromLobby(socket, "member_left");
    });

    socket.on("error", (error) => {
      logger.warn("Websocket client error", {
        event: "ws_client_error",
        message: error.message,
      });
    });
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }

      socket.isAlive = false;
      socket.ping();
    }
  }, 30000);

  const gameTicker = setInterval(() => {
    const updates = lobbyService.advanceExpiredGames(Date.now());
    for (const update of updates) {
      try {
        broadcastLobbyState(update.code, update.reason);
      } catch (error) {
        logger.warn("Lobby broadcast skipped during game ticker", {
          event: "ws_game_ticker_skip",
          code: update.code,
          message: error.message,
        });
      }
    }
  }, 1000);

  heartbeat.unref();
  gameTicker.unref();

  return {
    close() {
      clearInterval(heartbeat);
      clearInterval(gameTicker);
      wss.close();
    },
  };
}

module.exports = {
  createLobbyRealtimeHub,
};
