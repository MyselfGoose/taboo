import { createContext, useEffect, useMemo, useRef, useState } from "react";

import { getLobbyWebSocketUrl, restoreSession } from "../api/lobbyApi";
import { getOrCreateTabTag } from "../utils/tabTag";
import { clearSession, loadSession, saveSession } from "../utils/sessionStore";

export const LobbyContext = createContext(null);

export function LobbyProvider({ children }) {
  const [lobbySession, setLobbySessionState] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [errorMessage, setErrorMessage] = useState("");
  const [restoreState, setRestoreState] = useState("restoring");
  const [restoreError, setRestoreError] = useState("");
  const [tabTag] = useState(() => getOrCreateTabTag());
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongWatchdogRef = useRef(null);
  const lastPongAtRef = useRef(0);
  const socketEpochRef = useRef(0);

  useEffect(() => {
    if (!lobbySession?.code) return;
    // eslint-disable-next-line no-console
    console.info("[taboo ws]", {
      event: "connection_state_changed",
      connectionState,
      code: lobbySession.code,
      playerName: lobbySession.playerName,
      tabTag,
    });
  }, [connectionState, lobbySession?.code, lobbySession?.playerName, tabTag]);

  const setLobbySession = (nextSession) => {
    setLobbySessionState(nextSession);
    if (nextSession) {
      setRestoreState("restored");
      setRestoreError("");
    }

    if (nextSession) {
      saveSession(nextSession);
    } else {
      clearSession();
    }
  };

  useEffect(() => {
    let isMounted = true;

    const restore = async () => {
      const saved = loadSession();
      if (!saved) {
        if (isMounted) {
          setRestoreState("restored");
          setRestoreError("");
        }
        return;
      }

      if (!saved.code || !saved.playerName || !saved.resumeToken) {
        clearSession();
        if (isMounted) {
          setLobbySessionState(null);
          setRestoreState("restored");
          setRestoreError("");
        }
        return;
      }

      try {
        const restored = await restoreSession({
          code: saved.code,
          resumeToken: saved.resumeToken,
        });

        if (!isMounted) {
          return;
        }

        setLobbySessionState({
          code: restored.code,
          playerId: restored.playerId,
          playerName: restored.playerName,
          resumeToken: restored.resumeToken,
          lobby: restored.lobby,
        });
        saveSession({
          code: restored.code,
          playerId: restored.playerId,
          playerName: restored.playerName,
          resumeToken: restored.resumeToken,
        });
        setRestoreState("restored");
        setRestoreError("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        clearSession();
        setLobbySessionState(null);
        setRestoreState("restore-failed");
        setRestoreError(error.message || "Session restore failed.");
      }
    };

    restore();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!lobbySession?.code || !lobbySession?.playerName) {
      return undefined;
    }

    let isActive = true;
    let reconnectAttempts = 0;
    const WS_READY = {
      CONNECTING: 0,
      OPEN: 1,
      CLOSING: 2,
      CLOSED: 3,
    };

    const connect = () => {
      if (!isActive) {
        return;
      }

      // Prevent accidental parallel connections.
      const existing = socketRef.current;
      if (
        existing &&
        (existing.readyState === WS_READY.OPEN ||
          existing.readyState === WS_READY.CONNECTING ||
          existing.readyState === WS_READY.CLOSING)
      ) {
        return;
      }

      socketEpochRef.current += 1;
      const epoch = socketEpochRef.current;

      setConnectionState(
        reconnectAttempts === 0 ? "connecting" : "reconnecting",
      );

      const ws = new WebSocket(getLobbyWebSocketUrl());
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        if (!isActive || socketEpochRef.current !== epoch) {
          return;
        }

        reconnectAttempts = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        setConnectionState("connected");

        lastPongAtRef.current = Date.now();

        const sendPing = () => {
          const socket = socketRef.current;
          if (
            !isActive ||
            socketEpochRef.current !== epoch ||
            socket !== ws ||
            socket.readyState !== WS_READY.OPEN
          ) {
            return;
          }

          try {
            ws.send(JSON.stringify({ type: "ping", ts: Date.now() }));
          } catch (_err) {
            // Reconnect logic will handle failures.
          }
        };

        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }
        if (pongWatchdogRef.current) {
          clearInterval(pongWatchdogRef.current);
          pongWatchdogRef.current = null;
        }

        // 25–30 seconds.
        pingIntervalRef.current = setInterval(sendPing, 27000);
        pingIntervalRef.current.unref?.();

        // If we don't get pong responses, proactively close.
        pongWatchdogRef.current = setInterval(() => {
          const socket = socketRef.current;
          if (
            !isActive ||
            socketEpochRef.current !== epoch ||
            socket !== ws
          ) {
            return;
          }

          const elapsedMs = Date.now() - lastPongAtRef.current;
          if (elapsedMs > 60000) {
            try {
              ws.close();
            } catch (_err) {
              // Ignore.
            }
          }
        }, 10000);
        pongWatchdogRef.current.unref?.();

        ws.send(
          JSON.stringify({
            type: "subscribe",
            code: lobbySession.code,
            resumeToken: lobbySession.resumeToken,
            name: lobbySession.playerName,
          }),
        );
      });

      ws.addEventListener("message", async (event) => {
        let message;
        try {
          message = JSON.parse(event.data);
        } catch (_error) {
          return;
        }

        if (!isActive || socketEpochRef.current !== epoch) {
          return;
        }

        if (message.type === "pong") {
          lastPongAtRef.current = Date.now();
          return;
        }

        if (message.type === "lobby_state" || message.type === "subscribed") {
          setLobbySessionState((current) => {
            if (!current) {
              return current;
            }

            const next = {
              ...current,
              lobby: message.lobby,
            };
            saveSession(next);
            return next;
          });
          return;
        }

        if (message.type === "error") {
          const msg = message.message || "Realtime connection error.";
          const errCode = message.code;

          // If the backend restarted and wiped state, our resume token may
          // no longer be valid. Clear the stored session so the user can
          // re-enter the lobby.
          if (
            errCode === "INVALID_SESSION" ||
            errCode === "LOBBY_NOT_FOUND" ||
            errCode === "PLAYER_NOT_FOUND"
          ) {
            clearSession();
            setLobbySessionState(null);
            setRestoreState("restore-failed");
            setRestoreError(msg);
            setErrorMessage(msg);
            setConnectionState("disconnected");
            return;
          }

          setErrorMessage(msg);
        }
      });

      ws.addEventListener("close", () => {
        if (!isActive || socketRef.current !== ws) {
          return;
        }

        setConnectionState("disconnected");
        reconnectAttempts += 1;

        const baseDelayMs = 1000;
        const maxDelayMs = 10000;
        const retryDelayMs = Math.min(
          baseDelayMs * 2 ** Math.max(0, reconnectAttempts - 1),
          maxDelayMs,
        );
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        reconnectTimerRef.current = setTimeout(connect, retryDelayMs);
      });

      ws.addEventListener("error", () => {
        if (!isActive || socketRef.current !== ws) {
          return;
        }
        setConnectionState("disconnected");
        reconnectAttempts += 1;

        const baseDelayMs = 1000;
        const maxDelayMs = 10000;
        const retryDelayMs = Math.min(
          baseDelayMs * 2 ** Math.max(0, reconnectAttempts - 1),
          maxDelayMs,
        );

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        reconnectTimerRef.current = setTimeout(connect, retryDelayMs);
      });
    };

    connect();

    return () => {
      isActive = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (pongWatchdogRef.current) {
        clearInterval(pongWatchdogRef.current);
        pongWatchdogRef.current = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setConnectionState("disconnected");
    };
  }, [lobbySession?.code, lobbySession?.playerName, lobbySession?.resumeToken]);

  const sendLobbyAction = (payload) => {
    const socket = socketRef.current;

    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorMessage(
        "Realtime connection is not ready. Please wait a moment.",
      );
      return false;
    }

    socket.send(JSON.stringify(payload));
    return true;
  };

  const clearLobbySession = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongWatchdogRef.current) {
      clearInterval(pongWatchdogRef.current);
      pongWatchdogRef.current = null;
    }

    setLobbySessionState(null);
    clearSession();
    setRestoreState("restored");
    setRestoreError("");
    setConnectionState("disconnected");
    setErrorMessage("");
  };

  const value = useMemo(
    () => ({
      lobbySession,
      setLobbySession,
      clearLobbySession,
      sendLobbyAction,
      connectionState,
      errorMessage,
      setErrorMessage,
      tabTag,
      restoreState,
      restoreError,
      setRestoreError,
    }),
    [
      lobbySession,
      connectionState,
      errorMessage,
      tabTag,
      restoreState,
      restoreError,
    ],
  );

  return (
    <LobbyContext.Provider value={value}>{children}</LobbyContext.Provider>
  );
}
