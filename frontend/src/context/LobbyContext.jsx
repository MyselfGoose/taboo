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
  const [lastStateReceivedAt, setLastStateReceivedAt] = useState(null);
  const [tabTag] = useState(() => getOrCreateTabTag());

  // Socket plumbing refs – never trigger re-renders.
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const pingIntervalRef = useRef(null);
  const pongWatchdogRef = useRef(null);
  const lastPongAtRef = useRef(0);
  const socketEpochRef = useRef(0);

  // isSubscribing: true while a `subscribe` message has been sent but the
  // server has not yet acknowledged with `subscribed`.  Actions are gated
  // on this so we never hit the NOT_SUBSCRIBED error.
  const isSubscribingRef = useRef(false);

  // Latest session values readable inside the WS effect without making them
  // dependencies (avoids tearing down the socket on every token refresh).
  const sessionRef = useRef(null);

  // ─── Debug logging ────────────────────────────────────────────────────────

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

  // ─── Session helpers ──────────────────────────────────────────────────────

  const setLobbySession = (nextSession) => {
    sessionRef.current = nextSession;
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

  // ─── Session restore on mount ─────────────────────────────────────────────

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
          sessionRef.current = null;
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

        const nextSession = {
          code: restored.code,
          playerId: restored.playerId,
          playerName: restored.playerName,
          resumeToken: restored.resumeToken,
          lobby: restored.lobby,
        };

        sessionRef.current = nextSession;
        setLobbySessionState(nextSession);
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
        sessionRef.current = null;
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

  // ─── WebSocket lifecycle ──────────────────────────────────────────────────
  //
  // Depends only on `lobbySession.code` and `lobbySession.playerName` –
  // intentionally NOT on `resumeToken` so that the socket is NOT torn down
  // every time the backend refreshes the token.

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

    // ── Teardown helpers ──────────────────────────────────────────────────

    function clearPingTimers() {
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      if (pongWatchdogRef.current) {
        clearInterval(pongWatchdogRef.current);
        pongWatchdogRef.current = null;
      }
    }

    // ── Connect / reconnect ───────────────────────────────────────────────

    const connect = () => {
      if (!isActive) {
        return;
      }

      // Cleanly close the existing socket before opening a new one.
      // This prevents stale sockets from lingering and consuming server
      // resources.
      const existing = socketRef.current;
      if (existing) {
        if (
          existing.readyState === WS_READY.OPEN ||
          existing.readyState === WS_READY.CONNECTING
        ) {
          // Socket is still alive – don't open a parallel connection.
          return;
        }
        // CLOSING or CLOSED – forcibly clean up.
        try {
          existing.close();
        } catch (_err) {
          // Already closed.
        }
        socketRef.current = null;
      }

      socketEpochRef.current += 1;
      const epoch = socketEpochRef.current;

      setConnectionState(
        reconnectAttempts === 0 ? "connecting" : "reconnecting",
      );
      isSubscribingRef.current = false;

      const ws = new WebSocket(getLobbyWebSocketUrl());
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        if (!isActive || socketEpochRef.current !== epoch) {
          ws.close();
          return;
        }

        // Reset backoff on successful connection.
        reconnectAttempts = 0;
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }

        // Keep `connectionState` as "reconnecting" until `subscribed` is
        // received – the subscribe handshake is still in flight.
        isSubscribingRef.current = true;

        lastPongAtRef.current = Date.now();

        // App-level ping sent every ~27 s.
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
            // Reconnect logic will handle this.
          }
        };

        clearPingTimers();

        pingIntervalRef.current = setInterval(sendPing, 27_000);
        pingIntervalRef.current.unref?.();

        // Watchdog: if >60 s pass without a pong, force-close the socket.
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
          if (elapsedMs > 60_000) {
            // eslint-disable-next-line no-console
            console.warn("[taboo ws] Pong watchdog triggered – reconnecting.");
            try {
              ws.close();
            } catch (_err) {
              // Ignore.
            }
          }
        }, 10_000);
        pongWatchdogRef.current.unref?.();

        // Read the latest session values from the ref (not from closure) so
        // we always send the freshest resumeToken without needing it in the
        // dependency array.
        const session = sessionRef.current;
        ws.send(
          JSON.stringify({
            type: "subscribe",
            code: session?.code ?? lobbySession?.code,
            resumeToken: session?.resumeToken ?? lobbySession?.resumeToken,
            name: session?.playerName ?? lobbySession?.playerName,
          }),
        );
      });

      ws.addEventListener("message", (event) => {
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

        if (message.type === "subscribed") {
          // Handshake complete – mark as connected.
          isSubscribingRef.current = false;
          setConnectionState("connected");
          setLastStateReceivedAt(Date.now());
          setLobbySessionState((current) => {
            if (!current) {
              return current;
            }
            const next = { ...current, lobby: message.lobby };
            sessionRef.current = next;
            saveSession(next);
            return next;
          });
          return;
        }

        if (message.type === "lobby_state") {
          setLastStateReceivedAt(Date.now());
          setLobbySessionState((current) => {
            if (!current) {
              return current;
            }
            const next = { ...current, lobby: message.lobby };
            sessionRef.current = next;
            saveSession(next);
            return next;
          });
          return;
        }

        if (message.type === "error") {
          const msg = message.message || "Realtime connection error.";
          const errCode = message.code;

          // Backend restarted and wiped in-memory state; the resume token is
          // no longer valid. Clear the stored session and surface the error.
          if (
            errCode === "INVALID_SESSION" ||
            errCode === "LOBBY_NOT_FOUND" ||
            errCode === "PLAYER_NOT_FOUND"
          ) {
            clearSession();
            sessionRef.current = null;
            setLobbySessionState(null);
            setRestoreState("restore-failed");
            setRestoreError(msg);
            setErrorMessage(msg);
            setConnectionState("disconnected");
            isSubscribingRef.current = false;
            return;
          }

          setErrorMessage(msg);
        }
      });

      ws.addEventListener("close", () => {
        // Guard: if another epoch has already taken over, don't interfere.
        if (!isActive || socketRef.current !== ws) {
          return;
        }

        clearPingTimers();
        setConnectionState("disconnected");
        isSubscribingRef.current = false;

        // Only close fires reliably (error always precedes close).
        // Increment here and here only – no double-counting.
        reconnectAttempts += 1;

        const baseDelayMs = 1_000;
        const maxDelayMs = 15_000;
        // Exponential backoff + jitter to spread out reconnects after a
        // backend restart (prevents thundering-herd).
        const jitterMs = Math.random() * 1_000;
        const retryDelayMs =
          Math.min(
            baseDelayMs * 2 ** Math.max(0, reconnectAttempts - 1),
            maxDelayMs,
          ) + jitterMs;

        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current);
          reconnectTimerRef.current = null;
        }
        reconnectTimerRef.current = setTimeout(connect, retryDelayMs);
      });

      // `error` always fires before `close`. We log it here but do all
      // cleanup in the `close` handler to prevent double-counting.
      ws.addEventListener("error", () => {
        if (!isActive || socketRef.current !== ws) {
          return;
        }
        // eslint-disable-next-line no-console
        console.warn("[taboo ws] WebSocket error – waiting for close event.");
      });
    };

    connect();

    return () => {
      isActive = false;
      isSubscribingRef.current = false;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      clearPingTimers();

      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch (_err) {
          // Ignore.
        }
        socketRef.current = null;
      }

      setConnectionState("disconnected");
    };
    // Intentionally omit `lobbySession.resumeToken` from deps – reading from
    // `sessionRef` inside the effect to avoid reconnect storms on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lobbySession?.code, lobbySession?.playerName]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const sendLobbyAction = (payload) => {
    const socket = socketRef.current;

    // Gate actions while subscribe handshake is in flight.
    if (isSubscribingRef.current) {
      setErrorMessage("Reconnecting… please wait a moment.");
      return false;
    }

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
    isSubscribingRef.current = false;

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (_err) {
        // Ignore.
      }
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

    sessionRef.current = null;
    setLobbySessionState(null);
    clearSession();
    setRestoreState("restored");
    setRestoreError("");
    setConnectionState("disconnected");
    setErrorMessage("");
    setLastStateReceivedAt(null);
  };

  // ─── Context value ────────────────────────────────────────────────────────

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
      lastStateReceivedAt,
    }),
    [
      lobbySession,
      connectionState,
      errorMessage,
      tabTag,
      restoreState,
      restoreError,
      lastStateReceivedAt,
    ],
  );

  return (
    <LobbyContext.Provider value={value}>{children}</LobbyContext.Provider>
  );
}
