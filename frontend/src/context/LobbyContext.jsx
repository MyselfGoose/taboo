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

    const connect = () => {
      if (!isActive) {
        return;
      }

      setConnectionState(
        reconnectAttempts === 0 ? "connecting" : "reconnecting",
      );

      const ws = new WebSocket(getLobbyWebSocketUrl());
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        reconnectAttempts = 0;
        setConnectionState("connected");
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
          setErrorMessage(message.message || "Realtime connection error.");
        }
      });

      ws.addEventListener("close", () => {
        if (!isActive) {
          return;
        }

        setConnectionState("disconnected");
        reconnectAttempts += 1;
        const retryDelayMs = Math.min(1200 * reconnectAttempts, 6000);
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
