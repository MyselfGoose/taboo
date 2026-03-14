import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  SkipForward,
  Trophy,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";

import { useLobby } from "../hooks/useLobby";
import { cn } from "../lib/cn";
import { motionPresets } from "../theme/motion";
import { teamColors } from "../theme/variants";

/* ------------------------------------------------------------------ */
/*  Game Over Screen                                                   */
/* ------------------------------------------------------------------ */

function GameOverScreen({ game, reduceMotion }) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  const winner = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "tie";

  const motionProps = reduceMotion
    ? {}
    : {
        initial: motionPresets.modal.initial,
        animate: motionPresets.modal.animate,
        transition: motionPresets.modal.transition,
      };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <motion.div
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] p-6 text-center"
        {...motionProps}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600">
          <Trophy className="h-7 w-7 text-white" />
        </div>
        <h2 className="mb-1 text-2xl font-bold text-white">Game Over!</h2>
        <p className="mb-5 text-sm text-neutral-400">
          {winner === "tie"
            ? "It's a tie!"
            : `Team ${winner === "A" ? "Alpha" : "Beta"} wins!`}
        </p>

        <div className="mb-6 flex items-center justify-center gap-6">
          <div className="text-center">
            <p className="mb-1 text-xs text-neutral-500">Alpha</p>
            <p
              className={cn(
                "text-3xl font-bold",
                winner === "A" ? "text-emerald-400" : "text-white",
              )}
            >
              {scoreA}
            </p>
          </div>
          <div className="text-lg text-neutral-600">vs</div>
          <div className="text-center">
            <p className="mb-1 text-xs text-neutral-500">Beta</p>
            <p
              className={cn(
                "text-3xl font-bold",
                winner === "B" ? "text-emerald-400" : "text-white",
              )}
            >
              {scoreB}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main GamePage                                                      */
/* ------------------------------------------------------------------ */

export default function GamePage() {
  const { code } = useParams();
  const reduceMotion = useReducedMotion();
  const { lobbySession, restoreState, sendLobbyAction, setErrorMessage } =
    useLobby();

  const [lastAction, setLastAction] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const animTimeoutRef = useRef(null);
  const prevCardRef = useRef(null);

  /* ------ early returns ------------------------------------------------ */
  if (restoreState === "restoring") {
    return (
      <div className="min-h-screen p-6 text-center text-white">
        Reconnecting to your game...
      </div>
    );
  }

  if (!lobbySession || lobbySession.code !== code) {
    return <Navigate to="/" replace />;
  }

  const game = lobbySession.lobby?.game;

  /* clear animation when a new card arrives via WebSocket */
  const currentQuestion = game?.currentCard?.question ?? null;
  if (prevCardRef.current !== null && prevCardRef.current !== currentQuestion) {
    if (isAnimating) {
      setIsAnimating(false);
      setLastAction(null);
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
    }
  }
  prevCardRef.current = currentQuestion;

  const currentPlayer = useMemo(
    () =>
      lobbySession.lobby?.players?.find(
        (p) => p.id === lobbySession.playerId,
      ) || null,
    [lobbySession.lobby?.players, lobbySession.playerId],
  );

  const roundDuration =
    lobbySession.lobby?.settings?.roundDurationSeconds ?? 60;

  /* ------ timer -------------------------------------------------------- */
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

  /* ------ cleanup timeout on unmount ----------------------------------- */
  useEffect(() => {
    return () => {
      if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    };
  }, []);

  /* ------ derived ------------------------------------------------------ */
  const canControl =
    game?.status === "in_progress" &&
    currentPlayer &&
    currentPlayer.team === game.activeTeam &&
    !isAnimating;

  const handleAction = useCallback(
    (action) => {
      if (!canControl) return;
      setErrorMessage("");
      setIsAnimating(true);
      setLastAction(
        action === "guess_correct"
          ? "correct"
          : action === "pass_card"
            ? "pass"
            : "taboo",
      );
      sendLobbyAction({ type: "game_action", action });

      /* safety timeout — clear animation even if WebSocket doesn't respond */
      animTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        setLastAction(null);
      }, 1500);
    },
    [canControl, sendLobbyAction, setErrorMessage],
  );

  const timerColor =
    secondsRemaining <= 10
      ? "text-red-400"
      : secondsRemaining <= 20
        ? "text-amber-400"
        : "text-white";

  const timerPercent = roundDuration
    ? (secondsRemaining / roundDuration) * 100
    : 0;

  const colorsA = teamColors("A");
  const colorsB = teamColors("B");
  const activeTeamColors = teamColors(game?.activeTeam ?? "A");

  const isPlayerOnActiveTeam =
    currentPlayer && currentPlayer.team === game?.activeTeam;

  /* ------ game over ---------------------------------------------------- */
  if (game?.status === "finished") {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white">
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
        <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-[#1e3a5f]/15 blur-[100px]" />
        <div className="pointer-events-none fixed bottom-0 left-1/2 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-[#b73b3b]/10 blur-[100px]" />
        <div className="relative z-10" data-testid="game-page">
          <GameOverScreen game={game} reduceMotion={reduceMotion} />
        </div>
      </div>
    );
  }

  /* ------ in-progress layout ------------------------------------------- */
  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-[#1e3a5f]/15 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/2 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-[#b73b3b]/10 blur-[100px]" />

      {/* Flash overlay */}
      <AnimatePresence>
        {lastAction && !reduceMotion && (
          <motion.div
            key="flash"
            {...motionPresets.flashOverlay}
            className={cn(
              "pointer-events-none fixed inset-0 z-40",
              lastAction === "correct" && "bg-emerald-500/10",
              lastAction === "pass" && "bg-amber-500/10",
              lastAction === "taboo" && "bg-red-500/10",
            )}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between border-b border-white/[0.06] px-4 py-3"
      >
        <Link
          to={`/lobby/${code}`}
          className="flex items-center gap-2 text-neutral-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="hidden text-sm font-medium sm:inline">Lobby</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Round</span>
          <span className="text-sm font-semibold text-white">
            {game?.roundNumber || 0}/{game?.totalRounds || 0}
          </span>
        </div>
      </motion.header>

      {/* Main */}
      <main
        className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4"
        data-testid="game-page"
      >
        {/* Score / Timer row */}
        <motion.section
          {...(reduceMotion ? {} : motionPresets.staggerSection(0))}
          className="mb-4"
        >
          <div className="grid grid-cols-3 gap-2">
            {/* Team A */}
            <div
              className={cn(
                "rounded-xl border p-3 transition-all",
                game?.activeTeam === "A"
                  ? colorsA.activeScoreBg
                  : colorsA.inactiveScoreBg,
              )}
            >
              <div className="mb-1 flex items-center gap-1.5">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    game?.activeTeam === "A"
                      ? colorsA.dotPulse
                      : "bg-neutral-600",
                  )}
                />
                <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  Alpha
                </p>
              </div>
              <p className="text-2xl font-bold text-white" aria-live="polite">
                {game?.scores?.A ?? 0}
              </p>
              {currentPlayer?.team === "A" && (
                <p className={cn("text-[10px]", colorsA.youText)}>You</p>
              )}
            </div>

            {/* Timer */}
            <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
              <div
                className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#1e3a5f] to-[#3b6ca8] transition-all duration-1000"
                style={{ width: `${timerPercent}%` }}
                data-testid="timer-bar"
              />
              <Clock className="mx-auto mb-1 h-4 w-4 text-neutral-500" />
              <p
                className={cn(
                  "text-2xl font-bold font-mono transition-colors",
                  timerColor,
                )}
                aria-live="polite"
              >
                {secondsRemaining}
              </p>
            </div>

            {/* Team B */}
            <div
              className={cn(
                "rounded-xl border p-3 transition-all",
                game?.activeTeam === "B"
                  ? colorsB.activeScoreBg
                  : colorsB.inactiveScoreBg,
              )}
            >
              <div className="mb-1 flex items-center justify-end gap-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                  Beta
                </p>
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    game?.activeTeam === "B"
                      ? colorsB.dotPulse
                      : "bg-neutral-600",
                  )}
                />
              </div>
              <p
                className="text-right text-2xl font-bold text-white"
                aria-live="polite"
              >
                {game?.scores?.B ?? 0}
              </p>
              {currentPlayer?.team === "B" && (
                <p className={cn("text-right text-[10px]", colorsB.youText)}>
                  You
                </p>
              )}
            </div>
          </div>
        </motion.section>

        {/* Active Team pill */}
        <motion.div
          {...(reduceMotion ? {} : motionPresets.staggerSection(0.05))}
          className="mb-4 flex justify-center"
        >
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium",
              activeTeamColors.pillBg,
              activeTeamColors.pillBorder,
              activeTeamColors.pillText,
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Team {activeTeamColors.label}&apos;s Turn
          </div>
        </motion.div>

        {/* Word Card */}
        <motion.section
          {...(reduceMotion ? {} : motionPresets.staggerSection(0.1))}
          className="mb-4 flex-1"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={game?.currentCard?.question || "empty"}
              {...(reduceMotion ? {} : motionPresets.cardSwap)}
              className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 sm:p-6"
              aria-label="Current card"
            >
              {/* Category badge */}
              <div className="mb-4 flex justify-center">
                <span
                  className={cn(
                    "rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400",
                    !isPlayerOnActiveTeam && "blur-sm select-none",
                  )}
                >
                  {game?.currentCard?.category || "-"}
                </span>
              </div>

              {/* Main word */}
              <div className="flex flex-1 items-center justify-center">
                <h2
                  className={cn(
                    "text-center text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl",
                    !isPlayerOnActiveTeam && "blur-md select-none",
                  )}
                >
                  {game?.currentCard?.question || "Waiting"}
                </h2>
              </div>

              {/* Non-active overlay hint */}
              {!isPlayerOnActiveTeam && game?.currentCard && (
                <p className="mb-2 text-center text-xs text-neutral-500">
                  Words hidden — it&apos;s the other team&apos;s turn
                </p>
              )}

              {/* Taboo words */}
              <div className="mt-4 border-t border-white/[0.06] pt-4">
                <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-red-400/80">
                  Forbidden Words
                </p>
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  {(game?.currentCard?.taboo || []).map((word, index) => (
                    <motion.span
                      key={word}
                      {...(reduceMotion ? {} : motionPresets.tabooWord(index))}
                      className={cn(
                        "rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300",
                        !isPlayerOnActiveTeam && "blur-sm select-none",
                      )}
                    >
                      {word}
                    </motion.span>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.section>

        {/* Action Buttons */}
        <motion.section
          {...(reduceMotion ? {} : motionPresets.staggerSection(0.2))}
        >
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleAction("guess_correct")}
              disabled={!canControl}
              className={cn(
                "rounded-xl border-2 p-4 font-semibold transition-all",
                canControl
                  ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 active:scale-95"
                  : "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-neutral-600",
              )}
            >
              <Check className="mx-auto mb-1 h-6 w-6" />
              <span className="block text-xs">Correct</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction("pass_card")}
              disabled={!canControl}
              className={cn(
                "rounded-xl border-2 p-4 font-semibold transition-all",
                canControl
                  ? "border-amber-500/30 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 active:scale-95"
                  : "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-neutral-600",
              )}
            >
              <SkipForward className="mx-auto mb-1 h-6 w-6" />
              <span className="block text-xs">Pass</span>
            </button>

            <button
              type="button"
              onClick={() => handleAction("taboo_called")}
              disabled={!canControl}
              className={cn(
                "rounded-xl border-2 p-4 font-semibold transition-all",
                canControl
                  ? "border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30 active:scale-95"
                  : "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-neutral-600",
              )}
            >
              <AlertTriangle className="mx-auto mb-1 h-6 w-6" />
              <span className="block text-xs">Taboo</span>
            </button>
          </div>

          {!isPlayerOnActiveTeam && (
            <p className="mt-3 text-center text-xs text-neutral-500">
              Waiting for Team {activeTeamColors.label}...
            </p>
          )}
        </motion.section>
      </main>
    </div>
  );
}
