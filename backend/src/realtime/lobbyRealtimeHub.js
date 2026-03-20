const crypto = require("node:crypto");
const { WebSocketServer } = require("ws");

const {
  normalizeLobbyCode,
  normalizePlayerName,
} = require("../utils/validation");

function safeSend(socket, payload) {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(payload));
}

function createLobbyRealtimeHub({ server, lobbyService, logger, config }) {
  const disconnectGraceMs =
    config?.playerDisconnectGraceMs ?? 30_000;

  const wss = new WebSocketServer({ server, path: "/ws" });

  // code → Set<socket>
  const socketsByLobby = new Map();

  // `${code}:${playerId}` → socket  (the one canonical live socket)
  const socketByPlayer = new Map();

  // `${code}:${playerId}` → TimeoutId  (pending disconnect grace timer)
  const disconnectTimers = new Map();

  // WeakMap so GC can clean up when socket is gone
  const socketContext = new WeakMap();

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function playerKey(code, playerId) {
    return `${code}:${playerId}`;
  }

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

  /**
   * Cancel any pending disconnect grace timer for a player.
   * Call this when the player's new socket subscribes successfully.
   */
  function cancelDisconnectTimer(code, playerId) {
    const key = playerKey(code, playerId);
    const timer = disconnectTimers.get(key);
    if (timer !== undefined) {
      clearTimeout(timer);
      disconnectTimers.delete(key);
      logger.info("Disconnect grace timer cancelled (player reconnected)", {
        event: "ws_reconnect_grace_cancelled",
        code,
        playerId,
      });
    }
  }

  /**
   * Immediately deregister a socket from the lobby structures.
   * Does NOT touch player data in the lobby service (use the grace timer for
   * that so brief blips do not visibly remove a player from others' screens).
   */
  function detachSocket(socket) {
    const ctx = socketContext.get(socket);
    if (!ctx?.code || !ctx?.playerId) {
      return;
    }

    const { code, playerId } = ctx;

    // Remove from the per-lobby socket set.
    const sockets = socketsByLobby.get(code);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        socketsByLobby.delete(code);
      }
    }

    // Only remove the canonical player→socket entry if it is still this socket
    // (it may have already been replaced by a newer socket during reconnect).
    const key = playerKey(code, playerId);
    if (socketByPlayer.get(key) === socket) {
      socketByPlayer.delete(key);
    }
  }

  /**
   * Handle a socket's final departure (called after the grace period).
   * Removes the player from the lobby, then broadcasts so other players see
   * the updated member list.
   */
  function finaliseDisconnect(code, playerId, reason) {
    disconnectTimers.delete(playerKey(code, playerId));

    // Only remove if the player is still in the lobby (i.e., they did not
    // reconnect and voluntarily leave themselves).
    try {
      const lobby = lobbyService.getLobby({ lobbyCode: code });
      if (!lobby) {
        return;
      }

      const player = lobbyService.findPlayerById(lobby, playerId);
      if (player) {
        lobbyService.removeLobbyMember({
          playerName: player.name,
          lobbyCode: code,
          requestId: `ws_disconnect_${playerId}`,
        });
      }

      logger.info("Player removed after disconnect grace", {
        event: "ws_disconnect_grace_expired",
        code,
        playerId,
        reason,
      });
    } catch (error) {
      logger.warn("Error removing player after disconnect", {
        event: "ws_disconnect_remove_error",
        code,
        playerId,
        message: error.message,
      });
      return;
    }

    try {
      broadcastLobbyState(code, reason || "member_disconnected");
    } catch (error) {
      logger.warn("Lobby broadcast skipped after disconnect finalise", {
        event: "ws_broadcast_skip",
        code,
        message: error.message,
      });
    }
  }

  /**
   * Called when a socket closes or errors. Schedules the grace-period timer.
   * If the player reconnects within the window, the timer is cancelled.
   */
  function scheduleDisconnect(socket, closeReason) {
    const ctx = socketContext.get(socket);
    if (!ctx?.code || !ctx?.playerId) {
      return;
    }

    const { code, playerId } = ctx;

    detachSocket(socket);

    const key = playerKey(code, playerId);

    // If another socket for the same player is already live, don't schedule.
    if (socketByPlayer.has(key)) {
      return;
    }

    // If a timer is already running (e.g. from a previous quick drop), leave it.
    if (disconnectTimers.has(key)) {
      return;
    }

    if (disconnectGraceMs <= 0) {
      // No grace period – finalise immediately.
      finaliseDisconnect(code, playerId, closeReason);
      return;
    }

    logger.info("Scheduling disconnect grace timer", {
      event: "ws_disconnect_grace_start",
      code,
      playerId,
      graceMs: disconnectGraceMs,
    });

    const timer = setTimeout(() => {
      finaliseDisconnect(code, playerId, closeReason);
    }, disconnectGraceMs);

    // Allow Node to exit cleanly even if this timer is pending.
    if (typeof timer.unref === "function") {
      timer.unref();
    }

    disconnectTimers.set(key, timer);
  }

  // ─── Connection handler ───────────────────────────────────────────────────

  wss.on("connection", (socket) => {
    const requestId = crypto.randomUUID();
    socket.isAlive = true;
    socket.wsPongsReceived = 0;
    socket.appPongsSent = 0;
    socket.lastAppPongAt = null;

    socket.on("pong", () => {
      socket.isAlive = true;
      socket.wsPongsReceived += 1;
      if (socket.wsPongsReceived % 10 === 0) {
        logger.info("WebSocket pong received", {
          event: "ws_pong",
          requestId,
        });
      }
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
        // ── ping / pong ──────────────────────────────────────────────────
        if (message.type === "ping") {
          socket.lastAppPongAt = Date.now();
          socket.appPongsSent += 1;

          if (socket.appPongsSent % 10 === 0) {
            logger.info("App-level pong sent", {
              event: "ws_app_pong",
              requestId,
              ts: message.ts ?? null,
            });
          }

          safeSend(socket, {
            type: "pong",
            ts: message.ts ?? null,
            at: Date.now(),
          });
          return;
        }

        if (message.type === "pong") {
          return;
        }

        // ── subscribe ────────────────────────────────────────────────────
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

          const pKey = playerKey(code, playerId);

          // ── Ghost-player prevention ──────────────────────────────────
          // If there is already a live socket for this player, terminate it
          // before registering the new one.
          const existingSocket = socketByPlayer.get(pKey);
          if (existingSocket && existingSocket !== socket) {
            logger.info("Terminating stale socket for reconnecting player", {
              event: "ws_stale_socket_terminated",
              code,
              playerId,
              requestId,
            });
            try {
              existingSocket.terminate();
            } catch (_err) {
              // Already gone – ignore.
            }
            // Detach the stale socket from our tracking structures.
            detachSocket(existingSocket);
          }

          // Cancel any pending grace-period disconnect timer.
          cancelDisconnectTimer(code, playerId);

          // Register this socket.
          let lobbySockets = socketsByLobby.get(code);
          if (!lobbySockets) {
            lobbySockets = new Set();
            socketsByLobby.set(code, lobbySockets);
          }
          lobbySockets.add(socket);
          socketByPlayer.set(pKey, socket);
          socketContext.set(socket, { code, playerId, requestId });

          logger.info("WebSocket subscribe resolved", {
            event: "ws_subscribe_resolved",
            code,
            playerId,
            playerName: message.resumeToken ? "(via token)" : message.name,
            method: message.resumeToken ? "resumeToken" : "name",
            lobbyPlayerIds: lobby.players.map((p) => p.id),
          });

          safeSend(socket, {
            type: "subscribed",
            lobby: lobbyService.toLobbySnapshot(lobby, {
              viewerPlayerId: playerId,
            }),
          });

          broadcastLobbyState(code, "member_joined");
          return;
        }

        // ── Authenticated actions ────────────────────────────────────────
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

    // Only `close` fires reliably for every departure; `error` always
    // precedes `close`, so we do all cleanup here to avoid double-handling.
    socket.on("close", () => {
      logger.info("WebSocket connection closed", {
        event: "ws_client_disconnected",
        requestId,
      });
      scheduleDisconnect(socket, "member_left");
    });

    socket.on("error", (error) => {
      logger.warn("WebSocket client error", {
        event: "ws_client_error",
        message: error.message,
        requestId,
      });
      // `close` fires immediately after `error`; cleanup happens there.
    });

    logger.info("WebSocket connection opened", {
      event: "ws_client_connected",
      requestId,
    });
  });

  // ─── Background timers ────────────────────────────────────────────────────

  // WS-level heartbeat: detect zombie connections via TCP-level ping.
  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (socket.isAlive === false) {
        socket.terminate();
        continue;
      }

      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);

  // Game state ticker: advance timers (turn timeouts, between-round delays).
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

      // Cancel all pending grace timers so tests can shut down cleanly.
      for (const timer of disconnectTimers.values()) {
        clearTimeout(timer);
      }
      disconnectTimers.clear();

      wss.close();
    },
  };
}

module.exports = {
  createLobbyRealtimeHub,
};
