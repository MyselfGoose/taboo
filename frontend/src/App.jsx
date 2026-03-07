import { useMemo, useState } from "react";
import "./App.css";

function App() {
  const [mode, setMode] = useState("create");
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const suggestedCode = useMemo(() => {
    return String(Math.floor(1000 + Math.random() * 9000));
  }, []);

  const handleCodeInput = (event) => {
    const digitsOnly = event.target.value.replace(/\D/g, "").slice(0, 4);
    setJoinCode(digitsOnly);
  };

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

              <div className="code-preview" aria-live="polite">
                <p>Suggested Lobby Code</p>
                <strong>{suggestedCode}</strong>
              </div>

              <button type="button" className="cta-btn">
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
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={4}
                placeholder="0000"
                value={joinCode}
                onChange={handleCodeInput}
              />

              <button type="button" className="cta-btn">
                Join Lobby
              </button>
            </section>
          )}
        </div>

        <footer className="tiny-note stagger-4">
          UI only for now. Game actions wire up next.
        </footer>
      </section>
    </main>
  );
}

export default App;
