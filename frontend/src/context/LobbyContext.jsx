import { createContext, useEffect, useMemo, useRef, useState } from "react";

import { getLobby, getLobbyWebSocketUrl } from "../api/lobbyApi";
import { getOrCreateTabTag } from "../utils/tabTag";

export const LobbyContext = createContext(null);

export function LobbyProvider({ children }) {
  const [lobbySession, setLobbySession] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [errorMessage, setErrorMessage] = useState("");
  const [tabTag] = useState(() => getOrCreateTabTag());
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

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
          setLobbySession((current) => {
            if (!current) {
              return current;
            }

            return {
              ...current,
              lobby: message.lobby,
            };
          });
          return;
        }

        if (message.type === "error") {
          setErrorMessage(message.message || "Realtime connection error.");

          try {
            const fallback = await getLobby(lobbySession.code);
            setLobbySession((current) => {
              if (!current) {
                return current;
              }

              return {
                ...current,
                lobby: fallback.lobby,
              };
            });
          } catch (_fallbackError) {
            // Keep UI stable even if fallback fetch fails.
          }
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
  }, [lobbySession?.code, lobbySession?.playerName]);

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

    setLobbySession(null);
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
    }),
    [lobbySession, connectionState, errorMessage, tabTag],
  );

  return (
    <LobbyContext.Provider value={value}>{children}</LobbyContext.Provider>
  );
}
