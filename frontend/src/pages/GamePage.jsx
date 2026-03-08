import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { useLobby } from "../hooks/useLobby";

export default function GamePage() {
  const { code } = useParams();
  const { lobbySession, restoreState, sendLobbyAction, setErrorMessage } =
    useLobby();

  if (restoreState === "restoring") {
    return (
      <div className="min-h-screen bg-[#090f24] p-6 text-center text-slate-100">
        Reconnecting to your game...
      </div>
    );
  }

  if (!lobbySession || lobbySession.code !== code) {
    return <Navigate to="/" replace />;
  }

  const game = lobbySession.lobby?.game;

  const currentPlayer = useMemo(
    () =>
      lobbySession.lobby?.players?.find(
        (player) => player.id === lobbySession.playerId,
      ) || null,
    [lobbySession.lobby?.players, lobbySession.playerId],
  );

  const [secondsRemaining, setSecondsRemaining] = useState(
    game?.secondsRemaining ?? 0,
  );

  useEffect(() => {
    if (!game || game.status !== "in_progress") {
      setSecondsRemaining(0);
      return undefined;
    }

    const tick = () => {
      const ms = (game.roundEndsAt || 0) - Date.now();
      setSecondsRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [game?.status, game?.roundEndsAt]);

  const canControl =
    game?.status === "in_progress" &&
    currentPlayer &&
    currentPlayer.team === game.activeTeam;

  const handleAction = (action) => {
    setErrorMessage("");
    sendLobbyAction({ type: "game_action", action });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090f24] font-body text-white">
      <div className="pointer-events-none absolute left-10 top-10 h-56 w-56 rounded-full bg-fuchsia-500/25 blur-3xl" />
      <div className="pointer-events-none absolute right-10 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl" />

      <main
        className="relative z-10 mx-auto grid min-h-screen w-full max-w-5xl content-center gap-5 px-4 py-8 sm:px-6 lg:px-10"
        data-testid="game-page"
      >
        <header className="rounded-3xl border border-white/15 bg-slate-900/60 p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
            Game In Progress
          </p>
          <h1 className="mt-2 font-display text-5xl uppercase tracking-wide text-amber-300 sm:text-6xl">
            Lobby {lobbySession.code}
          </h1>
          <p className="mt-3 text-base text-slate-200 sm:text-lg">
            Round {game?.roundNumber || 0}/{game?.totalRounds || 0} | Active
            team {game?.activeTeam || "-"}
          </p>
        </header>

        <section className="grid gap-3 rounded-3xl border border-white/15 bg-slate-900/60 p-4 backdrop-blur sm:grid-cols-3">
          <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3">
            <p className="text-xs uppercase tracking-[0.14em] text-cyan-100/80">
              Team A
            </p>
            <p className="mt-1 text-3xl font-extrabold text-cyan-50">
              {game?.scores?.A ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-center">
            <p className="text-xs uppercase tracking-[0.14em] text-amber-100/80">
              Timer
            </p>
            <p className="mt-1 text-3xl font-extrabold text-amber-50">
              {secondsRemaining}s
            </p>
          </div>
          <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-300/10 p-3 text-right">
            <p className="text-xs uppercase tracking-[0.14em] text-fuchsia-100/80">
              Team B
            </p>
            <p className="mt-1 text-3xl font-extrabold text-fuchsia-50">
              {game?.scores?.B ?? 0}
            </p>
          </div>
        </section>

        <section
          className="rounded-3xl border border-white/20 bg-linear-to-br from-indigo-900/80 via-violet-900/80 to-fuchsia-900/80 p-5 shadow-2xl shadow-violet-950/50 backdrop-blur md:p-7"
          aria-label="Current card"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/80">
            Guess Word
          </p>
          <h2 className="mt-2 font-display text-6xl uppercase leading-none tracking-wide text-emerald-200 drop-shadow-[0_4px_0_#1f2937] sm:text-7xl">
            {game?.currentCard?.question || "Waiting"}
          </h2>
          <p className="mt-2 text-sm text-slate-200">
            Category: {game?.currentCard?.category || "-"}
          </p>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-rose-100/80">
            Forbidden Words
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {(game?.currentCard?.taboo || []).map((word) => (
              <li
                key={word}
                className="rounded-full border border-rose-200/40 bg-rose-300/20 px-3 py-1.5 text-sm font-bold text-rose-50"
              >
                {word}
              </li>
            ))}
          </ul>

          <div className="mt-6 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={!canControl}
              onClick={() => handleAction("guess_correct")}
              className="h-11 rounded-xl border border-emerald-300/70 bg-emerald-300/85 px-4 text-sm font-extrabold uppercase tracking-wide text-slate-950 disabled:opacity-50"
            >
              Guessed
            </button>
            <button
              type="button"
              disabled={!canControl}
              onClick={() => handleAction("pass_card")}
              className="h-11 rounded-xl border border-amber-300/70 bg-amber-300/85 px-4 text-sm font-extrabold uppercase tracking-wide text-slate-950 disabled:opacity-50"
            >
              Pass
            </button>
            <button
              type="button"
              disabled={!canControl}
              onClick={() => handleAction("taboo_called")}
              className="h-11 rounded-xl border border-rose-300/70 bg-rose-400/85 px-4 text-sm font-extrabold uppercase tracking-wide text-slate-950 disabled:opacity-50"
            >
              Taboo
            </button>
          </div>

          {game?.status === "finished" ? (
            <p className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-300/20 px-3 py-2 text-sm font-semibold text-emerald-50">
              Game finished. Final score A {game?.scores?.A ?? 0} - B{" "}
              {game?.scores?.B ?? 0}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}
