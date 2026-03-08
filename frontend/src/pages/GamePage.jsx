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
            Your game arena is ready. Add timers, turn controls, and scoring on
            top of this battle-ready layout.
          </p>
        </header>

        <section
          className="rounded-3xl border border-white/20 bg-linear-to-br from-indigo-900/80 via-violet-900/80 to-fuchsia-900/80 p-5 shadow-2xl shadow-violet-950/50 backdrop-blur md:p-7"
          aria-label="Current card"
        >
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-100/80">
            Guess Word
          </p>
          <h2 className="mt-2 font-display text-6xl uppercase leading-none tracking-wide text-emerald-200 drop-shadow-[0_4px_0_#1f2937] sm:text-7xl">
            {currentCard.guess}
          </h2>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-rose-100/80">
            Forbidden Words
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {currentCard.taboo.map((word) => (
              <li
                key={word}
                className="rounded-full border border-rose-200/40 bg-rose-300/20 px-3 py-1.5 text-sm font-bold text-rose-50"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
