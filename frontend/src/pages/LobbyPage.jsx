import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { useLobby } from "../hooks/useLobby";

export default function LobbyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const {
    lobbySession,
    sendLobbyAction,
    connectionState,
    errorMessage,
    setErrorMessage,
    tabTag,
  } = useLobby();

  useEffect(() => {
    if (lobbySession?.lobby?.allReady) {
      navigate(`/game/${lobbySession.code}`);
    }
  }, [lobbySession?.lobby?.allReady, lobbySession?.code, navigate]);

  if (!lobbySession || !lobbySession.playerName || lobbySession.code !== code) {
    return <Navigate to="/" replace />;
  }

  const lobby = lobbySession.lobby;
  const currentPlayer =
    lobby?.players?.find(
      (player) =>
        player.name.toLowerCase() === lobbySession.playerName.toLowerCase(),
    ) ?? null;
  const currentTeam = currentPlayer?.team ?? null;

  const handleTeamChange = (team) => {
    setErrorMessage("");
    sendLobbyAction({
      type: "change_team",
      team,
    });
  };

  const handleReadyChange = (nextReady) => {
    setErrorMessage("");
    sendLobbyAction({
      type: "set_ready",
      ready: nextReady,
    });
  };

  return (
    <div className="shell">
      <main className="lobby" data-testid="lobby-page">
        <header className="hero-card">
          <p className="kicker">Lobby</p>
          <h1>Code {lobbySession.code}</h1>
          <p>
            Share this code with teammates. Everyone must be ready before the
            game can start.
          </p>
          <p className="meta-inline">
            You are <strong>{lobbySession.playerName}</strong> ({tabTag})
          </p>
          <p className="meta-inline">Connection: {connectionState}</p>
        </header>

        {errorMessage ? (
          <p role="alert" className="banner error">
            {errorMessage}
          </p>
        ) : null}

        <section className="panel" aria-label="Lobby settings">
          <h2>Game Settings</h2>
          <div className="settings-grid">
            <div>
              <p className="meta-label">Rounds</p>
              <p>{lobby.settings?.roundCount}</p>
            </div>
            <div>
              <p className="meta-label">Round duration</p>
              <p>{lobby.settings?.roundDurationSeconds} sec</p>
            </div>
          </div>
        </section>

        <section className="panel" aria-label="Team selection">
          <h2>Your Team</h2>
          <div className="team-switch">
            <button
              type="button"
              className={currentTeam === "A" ? "selected" : ""}
              onClick={() => handleTeamChange("A")}
            >
              Join Team Alpha
            </button>
            <button
              type="button"
              className={currentTeam === "B" ? "selected" : ""}
              onClick={() => handleTeamChange("B")}
            >
              Join Team Beta
            </button>
          </div>
          <div className="ready-toggle">
            <button
              type="button"
              className={currentPlayer?.ready ? "selected" : ""}
              onClick={() => handleReadyChange(!currentPlayer?.ready)}
            >
              {currentPlayer?.ready ? "Mark Not Ready" : "I'm Ready"}
            </button>
          </div>
        </section>

        <section className="teams-grid" aria-label="Teams">
          <article className="panel">
            <h2>Team Alpha</h2>
            <ul>
              {(lobby.teams?.A ?? []).map((name) => {
                const player = lobby.players?.find(
                  (entry) => entry.name === name,
                );
                return (
                  <li
                    key={name}
                    className={name === lobbySession.playerName ? "me" : ""}
                  >
                    <span>{name}</span>
                    <span
                      className={`status ${player?.ready ? "ready" : "waiting"}`}
                    >
                      {player?.ready ? "Ready" : "Waiting"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="panel">
            <h2>Team Beta</h2>
            <ul>
              {(lobby.teams?.B ?? []).map((name) => {
                const player = lobby.players?.find(
                  (entry) => entry.name === name,
                );
                return (
                  <li
                    key={name}
                    className={name === lobbySession.playerName ? "me" : ""}
                  >
                    <span>{name}</span>
                    <span
                      className={`status ${player?.ready ? "ready" : "waiting"}`}
                    >
                      {player?.ready ? "Ready" : "Waiting"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}
