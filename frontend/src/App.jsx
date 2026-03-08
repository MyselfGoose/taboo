import { useState } from "react";
import "./App.css";
import { createLobby, joinLobby } from "./api/lobbyApi";

function App() {
  const [screen, setScreen] = useState("landing");
  const [mode, setMode] = useState("create");
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [lobbyDetails, setLobbyDetails] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const result = await createLobby(name);
      setLobbyDetails({
        role: "host",
        playerName: name,
        code: result.code,
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
      await joinLobby(name, code);
      setLobbyDetails({
        role: "member",
        playerName: name,
        code,
      });
      setScreen("lobby");
    } catch (error) {
      setErrorMessage(error.message || "Unable to join lobby right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLanding = () => {
    setScreen("landing");
    setErrorMessage("");
  };

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

          <section className="teams-grid" aria-label="Teams preview">
            <article className="team-card">
              <h2>Team A</h2>
              <ul>
                <li>{lobbyDetails.playerName}</li>
                <li>Player Slot</li>
              </ul>
            </article>
            <article className="team-card">
              <h2>Team B</h2>
              <ul>
                <li>Player Slot</li>
                <li>Player Slot</li>
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
