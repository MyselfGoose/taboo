import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createLobby, joinLobby } from "../api/lobbyApi";
import { ROUND_DURATION_OPTIONS } from "../constants/gameConfig";
import { useLobby } from "../hooks/useLobby";

function normalizeCode(code) {
  return String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { setLobbySession, setErrorMessage } = useLobby();

  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roundCount, setRoundCount] = useState(5);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(60);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const roundOptionLabels = useMemo(
    () =>
      ROUND_DURATION_OPTIONS.map((seconds) => ({
        seconds,
        label: `${seconds} sec`,
      })),
    [],
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    setLocalError("");
    setErrorMessage("");

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submittedName = createName.trim();
      const response = await createLobby({
        name: submittedName,
        roundCount,
        roundDurationSeconds,
      });

      setLobbySession({
        code: response.code,
        playerName: submittedName,
        lobby: response.lobby,
      });

      navigate(`/lobby/${response.code}`);
    } catch (error) {
      setLocalError(error.message || "Unable to create a lobby.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    setLocalError("");
    setErrorMessage("");

    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const submittedName = joinName.trim();
      const response = await joinLobby(submittedName, normalizeCode(joinCode));

      setLobbySession({
        code: response.code,
        playerName: submittedName,
        lobby: response.lobby,
      });

      navigate(`/lobby/${response.code}`);
    } catch (error) {
      setLocalError(error.message || "Unable to join lobby.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="shell">
      <main className="landing" data-testid="landing-page">
        <header className="hero-card">
          <p className="kicker">Realtime Party Game</p>
          <h1>Taboo</h1>
          <p>
            Spin up a lobby in seconds, split into teams, and jump into a
            high-energy guessing round.
          </p>
        </header>

        {localError ? (
          <p role="alert" className="banner error">
            {localError}
          </p>
        ) : null}

        <section className="actions-grid" aria-label="Lobby actions">
          <form className="panel" onSubmit={handleCreate}>
            <h2>Create Lobby</h2>

            <label htmlFor="create-name">Your name</label>
            <input
              id="create-name"
              autoComplete="nickname"
              placeholder="Host name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
              maxLength={32}
              required
            />

            <label htmlFor="rounds">Rounds</label>
            <input
              id="rounds"
              type="number"
              min={1}
              max={10}
              value={roundCount}
              onChange={(event) => setRoundCount(Number(event.target.value))}
              required
            />

            <label htmlFor="duration">Round duration</label>
            <select
              id="duration"
              value={roundDurationSeconds}
              onChange={(event) =>
                setRoundDurationSeconds(Number(event.target.value))
              }
            >
              {roundOptionLabels.map((option) => (
                <option key={option.seconds} value={option.seconds}>
                  {option.label}
                </option>
              ))}
            </select>

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Lobby"}
            </button>
          </form>

          <form className="panel" onSubmit={handleJoin}>
            <h2>Join Lobby</h2>

            <label htmlFor="join-name">Your name</label>
            <input
              id="join-name"
              autoComplete="nickname"
              placeholder="Player name"
              value={joinName}
              onChange={(event) => setJoinName(event.target.value)}
              maxLength={32}
              required
            />

            <label htmlFor="join-code">Lobby code</label>
            <input
              id="join-code"
              inputMode="text"
              pattern="[A-Za-z0-9]{4}"
              maxLength={4}
              placeholder="AB12"
              value={joinCode}
              onChange={(event) =>
                setJoinCode(normalizeCode(event.target.value))
              }
              required
            />

            <button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Joining..." : "Join Lobby"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
