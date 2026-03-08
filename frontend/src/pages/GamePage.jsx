import { Navigate, useParams } from "react-router-dom";

import { DEMO_CARDS } from "../constants/gameConfig";
import { useLobby } from "../hooks/useLobby";

export default function GamePage() {
  const { code } = useParams();
  const { lobbySession } = useLobby();

  if (!lobbySession || lobbySession.code !== code) {
    return <Navigate to="/" replace />;
  }

  const [currentCard] = DEMO_CARDS;

  return (
    <div className="shell">
      <main className="game" data-testid="game-page">
        <header className="hero-card">
          <p className="kicker">Game In Progress</p>
          <h1>Lobby {lobbySession.code}</h1>
          <p>
            This is a frontend game shell. Core turn logic and scoring can now
            be built on top of this routed page.
          </p>
        </header>

        <section className="panel game-card" aria-label="Current card">
          <p className="meta-label">Guess Word</p>
          <h2>{currentCard.guess}</h2>
          <p className="meta-label">Forbidden Words</p>
          <ul className="taboo-list">
            {currentCard.taboo.map((word) => (
              <li key={word}>{word}</li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
