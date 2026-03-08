const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");

const {
  normalizeLobbyCode,
  normalizePlayerName,
} = require("../utils/validation");

function keyForMember(code, name) {
  return `${code}:${name.toLowerCase()}`;
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
    const snapshot = lobbyService.toLobbySnapshot(lobby);
    const sockets = socketsByLobby.get(code);

    if (!sockets || sockets.size === 0) {
      return;
    }

    for (const socket of sockets) {
      safeSend(socket, {
        type: "lobby_state",
        reason,
        lobby: snapshot,
      });
    }
  }

  function removeSocketFromLobby(socket, reason) {
    const ctx = socketContext.get(socket);
    if (!ctx || !ctx.code || !ctx.name) {
      return;
    }

    const sockets = socketsByLobby.get(ctx.code);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        socketsByLobby.delete(ctx.code);
      }
    }

    const memberKey = keyForMember(ctx.code, ctx.name);
    const nextCount = (memberConnectionCount.get(memberKey) || 1) - 1;

    if (nextCount <= 0) {
      memberConnectionCount.delete(memberKey);
      const lobby = lobbyService.removeLobbyMember({
        playerName: ctx.name,
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
          const code = normalizeLobbyCode(message.code);
          const name = normalizePlayerName(message.name);

          const lobby = lobbyService.joinLobby({
            playerName: name,
            lobbyCode: code,
            requestId,
          });

          let lobbySockets = socketsByLobby.get(code);
          if (!lobbySockets) {
            lobbySockets = new Set();
            socketsByLobby.set(code, lobbySockets);
          }

          const previousCtx = socketContext.get(socket);
          if (previousCtx && previousCtx.code && previousCtx.name) {
            removeSocketFromLobby(socket, "member_moved");
          }

          lobbySockets.add(socket);
          socketContext.set(socket, { code, name, requestId });

          const memberKey = keyForMember(code, name);
          memberConnectionCount.set(
            memberKey,
            (memberConnectionCount.get(memberKey) || 0) + 1,
          );

          safeSend(socket, {
            type: "subscribed",
            lobby: lobbyService.toLobbySnapshot(lobby),
          });

          broadcastLobbyState(code, "member_joined");
          return;
        }

        const ctx = socketContext.get(socket);
        if (!ctx?.code || !ctx?.name) {
          safeSend(socket, {
            type: "error",
            code: "NOT_SUBSCRIBED",
            message: "Subscribe to a lobby before sending actions.",
          });
          return;
        }

        if (message.type === "change_team") {
          const lobby = lobbyService.setPlayerTeam({
            playerName: ctx.name,
            lobbyCode: ctx.code,
            team: message.team,
            requestId: ctx.requestId,
          });

          broadcastLobbyState(lobby.code, "team_changed");
          return;
        }

        if (message.type === "set_ready") {
          const lobby = lobbyService.setPlayerReady({
            playerName: ctx.name,
            lobbyCode: ctx.code,
            ready: message.ready,
            requestId: ctx.requestId,
          });

          broadcastLobbyState(lobby.code, "ready_changed");
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

  heartbeat.unref();

  return {
    close() {
      clearInterval(heartbeat);
      wss.close();
    },
  };
}

module.exports = {
  createLobbyRealtimeHub,
};
