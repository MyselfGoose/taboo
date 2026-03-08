import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import {
  createLobby,
  getLobby,
  getLobbyWebSocketUrl,
  joinLobby,
} from "./api/lobbyApi";

const ROUND_DURATION_OPTIONS = Array.from(
  { length: 10 },
  (_, index) => (index + 1) * 30,
);

function splitIntoTeams(members) {
  const teamA = [];
  const teamB = [];

  members.forEach((member, index) => {
    if (index % 2 === 0) {
      teamA.push(member);
    } else {
      teamB.push(member);
    }
  });

  return { teamA, teamB };
}

function buildTabTag() {
  const existing = window.sessionStorage.getItem("taboo-tab-tag");
  if (existing) {
    return existing;
  }

  const generated = `TAB-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  window.sessionStorage.setItem("taboo-tab-tag", generated);
  return generated;
}

function App() {
  const [screen, setScreen] = useState("landing");
  const [mode, setMode] = useState("create");
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roundCount, setRoundCount] = useState(5);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(60);
  const [lobbyDetails, setLobbyDetails] = useState(null);
  const [connectionState, setConnectionState] = useState("disconnected");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tabTag] = useState(() => buildTabTag());
  const socketRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const teams = useMemo(() => {
    if (!lobbyDetails?.lobby) {
      return { teamA: [], teamB: [] };
    }

    if (lobbyDetails.lobby.teams?.A && lobbyDetails.lobby.teams?.B) {
      return {
        teamA: lobbyDetails.lobby.teams.A,
        teamB: lobbyDetails.lobby.teams.B,
      };
    }

    return splitIntoTeams(lobbyDetails.lobby.members || []);
  }, [lobbyDetails]);

  const players = useMemo(
    () => lobbyDetails?.lobby?.players || [],
    [lobbyDetails],
  );

  const currentPlayer = useMemo(
    () =>
      players.find(
        (player) =>
          player.name.toLowerCase() ===
          String(lobbyDetails?.playerName || "").toLowerCase(),
      ),
    [players, lobbyDetails?.playerName],
  );

  const handleCodeInput = (event) => {
    const code = event.target.value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4);
    setJoinCode(code);
  };

  const handleCreateLobby = async () => {
    const name = createName.trim();
    if (!name) {
      setErrorMessage("Please enter your name before creating a lobby.");
      return;
    }

    if (!Number.isInteger(Number(roundCount)) || Number(roundCount) < 1) {
      setErrorMessage("Round count must be a number greater than 0.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await createLobby({
        name,
        roundCount: Number(roundCount),
        roundDurationSeconds: Number(roundDurationSeconds),
      });
      setLobbyDetails({
        role: "host",
        playerName: name,
        code: result.code,
        lobby: result.lobby,
      });
      setScreen("lobby");
    } catch (error) {
      setErrorMessage(error.message || "Unable to create lobby right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinLobby = async () => {
    const name = joinName.trim();
    const code = joinCode.trim().toUpperCase();

    if (!name || code.length !== 4) {
      setErrorMessage("Enter your name and a valid 4-character code.");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await joinLobby(name, code);
      setLobbyDetails({
        role: "member",
        playerName: name,
        code,
        lobby: result.lobby,
      });
      setScreen("lobby");
    } catch (error) {
      setErrorMessage(error.message || "Unable to join lobby right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLanding = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    setScreen("landing");
    setErrorMessage("");
    setConnectionState("disconnected");
  };

  const sendLobbyAction = (payload) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      setErrorMessage(
        "Realtime connection is not ready. Please wait a moment.",
      );
      return;
    }

    socket.send(JSON.stringify(payload));
  };

  const handleSwitchTeam = () => {
    const nextTeam = currentPlayer?.team === "A" ? "B" : "A";
    sendLobbyAction({ type: "change_team", team: nextTeam });
  };

  const handleToggleReady = () => {
    sendLobbyAction({ type: "set_ready", ready: !currentPlayer?.ready });
  };

  useEffect(() => {
    if (
      screen !== "lobby" ||
      !lobbyDetails?.code ||
      !lobbyDetails?.playerName
    ) {
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
            code: lobbyDetails.code,
            name: lobbyDetails.playerName,
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
          setLobbyDetails((current) => {
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
            const fallback = await getLobby(lobbyDetails.code);
            setLobbyDetails((current) => {
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
    };
  }, [screen, lobbyDetails?.code, lobbyDetails?.playerName]);

  const connectionLabel =
    connectionState === "connected"
      ? "Realtime connected"
      : connectionState === "connecting"
        ? "Connecting realtime"
        : connectionState === "reconnecting"
          ? "Reconnecting"
          : "Offline";

  const lobbySettings = lobbyDetails?.lobby?.settings || {
    roundCount: roundCount,
    roundDurationSeconds,
  };

  const unreadyCount = players.filter((player) => !player.ready).length;

  const getPlayersForTeam = (teamName) =>
    players.filter((player) => player.team === teamName);

  if (screen === "lobby" && lobbyDetails) {
    return (
      <main className="page-shell">
        <div className="bg-layer bg-layer-one" aria-hidden="true" />
        <div className="bg-layer bg-layer-two" aria-hidden="true" />

        <section
          className="landing-card lobby-card"
          aria-label="Taboo lobby page"
        >
          <header className="hero-block">
            <p className="eyebrow">Lobby Ready</p>
            <h1>
              <span>TABOO</span>
            </h1>
            <p className="subhead">
              {lobbyDetails.role === "host"
                ? "Share this code so players can join your room."
                : "You are in. Waiting for host to start the game."}
            </p>
          </header>

          <section className="code-showcase" aria-live="polite">
            <p>Joining Code</p>
            <strong>{lobbyDetails.code}</strong>
          </section>

          <section className="settings-strip" aria-label="Lobby settings">
            <p>Rounds: {lobbySettings.roundCount}</p>
            <p>Round Time: {lobbySettings.roundDurationSeconds}s</p>
            <p className={`connection-pill ${connectionState}`}>
              {connectionLabel}
            </p>
          </section>

          <section className="identity-strip" aria-label="Current user context">
            <p>
              You are <strong>{lobbyDetails.playerName}</strong>
            </p>
            <p>
              Tab ID: <strong>{tabTag}</strong>
            </p>
          </section>

          <section className="ready-banner" aria-live="polite">
            {lobbyDetails.lobby?.allReady
              ? "Everyone is ready. Game can start."
              : `Waiting for ${unreadyCount} player${unreadyCount === 1 ? "" : "s"} to be ready.`}
          </section>

          <section className="lobby-actions" aria-label="Lobby controls">
            <button
              type="button"
              className="ghost-btn"
              onClick={handleSwitchTeam}
            >
              Switch To Team {currentPlayer?.team === "A" ? "B" : "A"}
            </button>
            <button
              type="button"
              className="cta-btn"
              onClick={handleToggleReady}
            >
              {currentPlayer?.ready ? "I'm Not Ready" : "I'm Ready"}
            </button>
          </section>

          <section className="teams-grid" aria-label="Teams preview">
            <article className="team-card">
              <h2>Team A</h2>
              <ul>
                {teams.teamA.length ? (
                  getPlayersForTeam("A").map((player) => (
                    <li
                      key={`a-${player.name}`}
                      className={
                        player.name.toLowerCase() ===
                        String(lobbyDetails.playerName).toLowerCase()
                          ? "current-player"
                          : ""
                      }
                    >
                      <span>{player.name}</span>
                      <span
                        className={
                          player.ready ? "ready-tag ready" : "ready-tag waiting"
                        }
                      >
                        {player.ready ? "Ready" : "Not ready"}
                      </span>
                      {player.name.toLowerCase() ===
                      String(lobbyDetails.playerName).toLowerCase() ? (
                        <span className="you-tag">You</span>
                      ) : null}
                    </li>
                  ))
                ) : (
                  <li>Waiting for players...</li>
                )}
              </ul>
            </article>
            <article className="team-card">
              <h2>Team B</h2>
              <ul>
                {teams.teamB.length ? (
                  getPlayersForTeam("B").map((player) => (
                    <li
                      key={`b-${player.name}`}
                      className={
                        player.name.toLowerCase() ===
                        String(lobbyDetails.playerName).toLowerCase()
                          ? "current-player"
                          : ""
                      }
                    >
                      <span>{player.name}</span>
                      <span
                        className={
                          player.ready ? "ready-tag ready" : "ready-tag waiting"
                        }
                      >
                        {player.ready ? "Ready" : "Not ready"}
                      </span>
                      {player.name.toLowerCase() ===
                      String(lobbyDetails.playerName).toLowerCase() ? (
                        <span className="you-tag">You</span>
                      ) : null}
                    </li>
                  ))
                ) : (
                  <li>Waiting for players...</li>
                )}
              </ul>
            </article>
          </section>

          <button
            type="button"
            className="ghost-btn"
            onClick={handleBackToLanding}
          >
            Back To Home
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="bg-layer bg-layer-one" aria-hidden="true" />
      <div className="bg-layer bg-layer-two" aria-hidden="true" />

      <section className="landing-card" aria-label="Taboo game lobby entry">
        <header className="hero-block stagger-1">
          <p className="eyebrow">Party Word Game</p>
          <h1>
            <span>TABOO</span>
          </h1>
          <p className="subhead">
            Jump in fast. Create a lobby or join one with a 4-digit code.
          </p>
        </header>

        <div
          className="mode-switch stagger-2"
          role="tablist"
          aria-label="Choose lobby action"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === "create"}
            className={`switch-btn ${mode === "create" ? "active" : ""}`}
            onClick={() => setMode("create")}
          >
            Create Game
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "join"}
            className={`switch-btn ${mode === "join" ? "active" : ""}`}
            onClick={() => setMode("join")}
          >
            Join Game
          </button>
        </div>

        <div className="panel-wrap stagger-3">
          {mode === "create" ? (
            <section
              className="mode-panel"
              role="tabpanel"
              aria-label="Create game panel"
            >
              <label htmlFor="create-name">Your Name</label>
              <input
                id="create-name"
                type="text"
                maxLength={24}
                placeholder="Enter your player name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
              />

              <label htmlFor="round-count">Rounds</label>
              <input
                id="round-count"
                type="number"
                min={1}
                max={20}
                value={roundCount}
                onChange={(event) => setRoundCount(event.target.value)}
              />

              <label htmlFor="round-duration">Round Time</label>
              <select
                id="round-duration"
                value={roundDurationSeconds}
                onChange={(event) =>
                  setRoundDurationSeconds(Number(event.target.value))
                }
              >
                {ROUND_DURATION_OPTIONS.map((seconds) => (
                  <option key={seconds} value={seconds}>
                    {seconds} seconds
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="cta-btn"
                onClick={handleCreateLobby}
                disabled={isSubmitting}
              >
                Create New Lobby
              </button>
            </section>
          ) : (
            <section
              className="mode-panel"
              role="tabpanel"
              aria-label="Join game panel"
            >
              <label htmlFor="join-name">Your Name</label>
              <input
                id="join-name"
                type="text"
                maxLength={24}
                placeholder="Enter your player name"
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
              />

              <label htmlFor="join-code">4-Digit Lobby Code</label>
              <input
                id="join-code"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                maxLength={4}
                placeholder="A1B2"
                value={joinCode}
                onChange={handleCodeInput}
              />

              <button
                type="button"
                className="cta-btn"
                onClick={handleJoinLobby}
                disabled={isSubmitting}
              >
                Join Lobby
              </button>
            </section>
          )}
        </div>

        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}

        <footer className="tiny-note stagger-4">
          Fast setup now. Gameplay details come next.
        </footer>
      </section>
    </main>
  );
}

export default App;
