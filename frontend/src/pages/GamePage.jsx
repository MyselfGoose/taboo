import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useLobby } from "../hooks/useLobby";
import { cn } from "../lib/cn";
import { motionPresets } from "../theme/motion";
import { teamToneClasses } from "../theme/variants";

function ScorePill({ team, score, align = "left" }) {
  const tone = teamToneClasses(team);

  return (
    <div
      className={cn(
        "rounded-[var(--radius-md)] border p-3",
        tone.panel,
        align === "right" ? "text-right" : "text-left",
      )}
    >
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        Team {team}
      </p>
      <p className={cn("mt-1 text-3xl font-bold", tone.strong)}>{score}</p>
    </div>
  );
}

export default function GamePage() {
  const { code } = useParams();
  const reduceMotion = useReducedMotion();
  const { lobbySession, restoreState, sendLobbyAction, setErrorMessage } =
    useLobby();

  if (restoreState === "restoring") {
    return (
      <div className="min-h-screen p-6 text-center text-[var(--color-text)]">
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

  const pageMotion = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, transition: { duration: 0 } }
    : motionPresets.pageEnter;

  const timerClass =
    secondsRemaining <= 10
      ? "text-[var(--color-danger)]"
      : secondsRemaining <= 20
        ? "text-[var(--color-warning)]"
        : "text-[var(--color-text)]";

  return (
    <div className="relative min-h-screen overflow-hidden font-body text-[var(--color-text)]">
      <div className="pointer-events-none absolute left-8 top-8 h-60 w-60 rounded-full bg-[var(--color-primary)]/24 blur-3xl" />
      <div className="pointer-events-none absolute right-8 top-16 h-72 w-72 rounded-full bg-[var(--color-secondary)]/24 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[var(--color-primary-soft)]/22 blur-3xl" />

      <motion.main
        className="relative z-10 mx-auto grid min-h-screen w-full max-w-5xl content-center gap-4 px-4 py-7 sm:px-6 lg:px-10"
        data-testid="game-page"
        initial={pageMotion.initial}
        animate={pageMotion.animate}
        transition={pageMotion.transition}
      >
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
            Game In Progress
          </p>
          <h1 className="mt-2 font-display text-4xl uppercase tracking-[0.05em] text-[var(--color-text)] sm:text-5xl">
            Lobby {lobbySession.code}
          </h1>
          <p className="mt-3 text-base text-[var(--color-text-muted)] sm:text-lg">
            Round {game?.roundNumber || 0}/{game?.totalRounds || 0} | Active team {game?.activeTeam || "-"}
          </p>
        </Card>

        <Card className="grid gap-3 sm:grid-cols-3">
          <ScorePill team="A" score={game?.scores?.A ?? 0} />

          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--surface-2)] p-3 text-center">
            <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
              Timer
            </p>
            <p className={cn("mt-1 text-3xl font-bold transition-colors", timerClass)}>
              {secondsRemaining}s
            </p>
          </div>

          <ScorePill team="B" score={game?.scores?.B ?? 0} align="right" />
        </Card>

        <motion.section {...(reduceMotion ? {} : motionPresets.cardEnter)}>
          <Card aria-label="Current card" className="border-[var(--color-border-strong)]/65">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Guess Word
            </p>

            <h2 className="mt-2 font-display text-5xl uppercase leading-none tracking-[0.05em] text-[var(--color-text)] sm:text-6xl">
              {game?.currentCard?.question || "Waiting"}
            </h2>

            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Category: {game?.currentCard?.category || "-"}
            </p>

            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
              Forbidden Words
            </p>

            <ul className="mt-3 flex flex-wrap gap-2">
              {(game?.currentCard?.taboo || []).map((word) => (
                <li
                  key={word}
                  className="rounded-full border border-[var(--color-danger)]/45 bg-[var(--color-danger)]/15 px-3 py-1.5 text-sm font-semibold text-[var(--color-text)]"
                >
                  {word}
                </li>
              ))}
            </ul>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <Button
                variant="success"
                disabled={!canControl}
                onClick={() => handleAction("guess_correct")}
              >
                Guessed
              </Button>
              <Button
                variant="warning"
                disabled={!canControl}
                onClick={() => handleAction("pass_card")}
              >
                Pass
              </Button>
              <Button
                variant="danger"
                disabled={!canControl}
                onClick={() => handleAction("taboo_called")}
              >
                Taboo
              </Button>
            </div>

            {game?.status === "finished" ? (
              <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-success)]/45 bg-[var(--color-success)]/16 px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
                Game finished. Final score A {game?.scores?.A ?? 0} - B {game?.scores?.B ?? 0}
              </p>
            ) : null}
          </Card>
        </motion.section>
      </motion.main>
    </div>
  );
}
