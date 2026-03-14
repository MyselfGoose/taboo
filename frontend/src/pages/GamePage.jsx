import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  Clock,
  LogOut,
  Play,
  SkipForward,
  Trophy,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useLobby } from "../hooks/useLobby";
import { cn } from "../lib/cn";
import { motionPresets } from "../theme/motion";
import { teamColors } from "../theme/variants";

function GameOverScreen({ game, reduceMotion, onLeave }) {
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

        <button
          type="button"
          onClick={onLeave}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] text-sm font-medium text-white transition-all hover:bg-white/[0.1]"
        >
          <LogOut className="h-4 w-4" />
          Leave Game
        </button>
      </motion.div>
    </div>
  );
}

function PhasePanel({ game, canStartTurn, onStartTurn, countdown }) {
  const activeName = game?.activeTurn?.playerName || "Player";
  const activeTeamLabel = game?.activeTeam === "B" ? "Beta" : "Alpha";

  if (game?.status === "waiting_to_start_turn") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
        <p className="mb-1 text-sm text-neutral-400">Next turn</p>
        <h2 className="mb-2 text-xl font-bold text-white">{activeName}</h2>
        <p className="mb-4 text-sm text-neutral-500">Team {activeTeamLabel}</p>
        {canStartTurn ? (
          <button
            type="button"
            onClick={onStartTurn}
            className="mx-auto flex h-11 items-center justify-center gap-2 rounded-xl border border-[#3b6ca8]/40 bg-[#1e3a5f]/30 px-4 text-sm font-semibold text-white transition hover:bg-[#1e3a5f]/45"
          >
            <Play className="h-4 w-4" />
            Start Turn
          </button>
        ) : (
          <p className="text-sm text-neutral-400">
            Waiting for {activeName} to start their turn.
          </p>
        )}
      </div>
    );
  }

  if (game?.status === "between_turns") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
        <p className="mb-2 text-sm text-neutral-400">Turn ended</p>
        <p className="text-base font-semibold text-white">
          Next turn: {activeName} from Team {activeTeamLabel}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          Starting in {countdown}s...
        </p>
      </div>
    );
  }

  if (game?.status === "between_rounds") {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
        <p className="mb-2 text-sm text-neutral-400">
          Round {game.roundNumber} complete
        </p>
        <p className="text-base font-semibold text-white">
          Round {game.nextRoundNumber} starts in {countdown}s
        </p>
      </div>
    );
  }

  if (game) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-center">
        <p className="text-sm text-neutral-400">Synchronizing turn state</p>
      </div>
    );
  }

  return null;
}

export default function GamePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const {
    lobbySession,
    clearLobbySession,
    restoreState,
    sendLobbyAction,
    setErrorMessage,
  } = useLobby();

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [guessText, setGuessText] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const game = lobbySession?.lobby?.game;

  const handleLeave = useCallback(() => {
    clearLobbySession();
    navigate("/");
  }, [clearLobbySession, navigate]);

  useEffect(() => {
    const targetTime = game?.turnEndsAt || game?.phaseEndsAt || game?.roundEndsAt;
    if (!targetTime) {
      setSecondsRemaining(game?.secondsRemaining ?? 0);
      return undefined;
    }

    const tick = () => {
      const ms = targetTime - Date.now();
      setSecondsRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };

    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [game?.turnEndsAt, game?.phaseEndsAt, game?.roundEndsAt, game?.secondsRemaining]);

  const currentPlayer = useMemo(
    () =>
      lobbySession?.lobby?.players?.find(
        (p) => p.id === lobbySession?.playerId,
      ) || null,
    [lobbySession?.lobby?.players, lobbySession?.playerId],
  );

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

  if (!game) {
    return <Navigate to={`/lobby/${code}`} replace />;
  }

  const colorsA = teamColors("A");
  const colorsB = teamColors("B");
  const normalizedStatus =
    game.status === "in_progress" ? "turn_in_progress" : game.status;
  const activeTeamColors = teamColors(game.activeTeam || "A");
  const isOnActiveTeam =
    currentPlayer && currentPlayer.team === game.activeTeam;

  const fallbackPermissions = {
    canStartTurn: false,
    canSubmitGuess: false,
    canSkipCard: Boolean(isOnActiveTeam),
    canCallTaboo: Boolean(currentPlayer && !isOnActiveTeam),
  };

  const permissions = game.permissions || fallbackPermissions;
  const canStartTurn = Boolean(permissions.canStartTurn);
  const canSubmitGuess = Boolean(permissions.canSubmitGuess);
  const canSkipCard = Boolean(permissions.canSkipCard);
  const canCallTaboo = Boolean(permissions.canCallTaboo);

  const roundDuration =
    lobbySession.lobby?.settings?.roundDurationSeconds ?? 60;
  const timerPercent =
    normalizedStatus === "turn_in_progress" && roundDuration > 0
      ? (secondsRemaining / roundDuration) * 100
      : 0;

  const timerColor =
    secondsRemaining <= 10
      ? "text-red-400"
      : secondsRemaining <= 20
        ? "text-amber-400"
        : "text-white";

  const cardVisibleToViewer =
    typeof game.cardVisibleToViewer === "boolean"
      ? game.cardVisibleToViewer
      : !canSubmitGuess;

  const roleHint =
    game.roleHint ||
    (canStartTurn || canSkipCard
      ? "You are giving clues."
      : canSubmitGuess
        ? "Guess the word."
        : canCallTaboo
          ? "Watch for taboo words."
          : "Waiting for active turn.");

  const handleGameAction = useCallback(
    (action, payload = {}) => {
      setErrorMessage("");
      sendLobbyAction({ type: "game_action", action, ...payload });
    },
    [sendLobbyAction, setErrorMessage],
  );

  const submitGuess = useCallback(() => {
    const trimmed = guessText.trim();
    if (!trimmed || !canSubmitGuess) {
      return;
    }

    handleGameAction("submit_guess", { guess: trimmed });
    setGuessText("");
  }, [guessText, canSubmitGuess, handleGameAction]);

  if (normalizedStatus === "finished") {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white">
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
        <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-[#1e3a5f]/15 blur-[100px]" />
        <div className="pointer-events-none fixed bottom-0 left-1/2 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-[#b73b3b]/10 blur-[100px]" />
        <div className="relative z-10" data-testid="game-page">
          <GameOverScreen
            game={game}
            reduceMotion={reduceMotion}
            onLeave={handleLeave}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0f1a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-[#1e3a5f]/15 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/2 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-[#b73b3b]/10 blur-[100px]" />

      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between border-b border-white/[0.06] px-4 py-3"
      >
        <button
          type="button"
          onClick={() => setShowLeaveConfirm(true)}
          className="flex items-center gap-2 text-neutral-400 transition-colors hover:text-white"
          aria-label="Leave game"
        >
          <LogOut className="h-5 w-5" />
          <span className="hidden text-sm font-medium sm:inline">Leave</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500">Round</span>
          <span className="text-sm font-semibold text-white">
            {game.roundNumber || 0}/{game.totalRounds || 0}
          </span>
        </div>
      </motion.header>

      <main
        className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4"
        data-testid="game-page"
      >
        <motion.section
          {...(reduceMotion ? {} : motionPresets.staggerSection(0))}
          className="mb-4"
        >
          <div className="grid grid-cols-3 gap-2">
            <div
              className={cn(
                "rounded-xl border p-3 transition-all",
                game.activeTeam === "A"
                  ? colorsA.activeScoreBg
                  : colorsA.inactiveScoreBg,
              )}
            >
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Alpha
              </p>
              <p className="text-2xl font-bold text-white" aria-live="polite">
                {game.scores?.A ?? 0}
              </p>
              {currentPlayer?.team === "A" && (
                <p className={cn("text-[10px]", colorsA.youText)}>You</p>
              )}
            </div>

            <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center">
              {normalizedStatus === "turn_in_progress" && (
                <div
                  className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[#1e3a5f] to-[#3b6ca8] transition-all duration-700"
                  style={{
                    width: `${Math.max(0, Math.min(100, timerPercent))}%`,
                  }}
                  data-testid="timer-bar"
                />
              )}
              <Clock className="mx-auto mb-1 h-4 w-4 text-neutral-500" />
              <p className={cn("text-2xl font-mono font-bold", timerColor)}>
                {secondsRemaining}
              </p>
            </div>

            <div
              className={cn(
                "rounded-xl border p-3 transition-all",
                game.activeTeam === "B"
                  ? colorsB.activeScoreBg
                  : colorsB.inactiveScoreBg,
              )}
            >
              <p className="mb-1 text-right text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                Beta
              </p>
              <p
                className="text-right text-2xl font-bold text-white"
                aria-live="polite"
              >
                {game.scores?.B ?? 0}
              </p>
              {currentPlayer?.team === "B" && (
                <p className={cn("text-right text-[10px]", colorsB.youText)}>
                  You
                </p>
              )}
            </div>
          </div>
        </motion.section>

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

        <p className="mb-3 text-center text-sm text-neutral-400">
          {roleHint}
        </p>

        {normalizedStatus !== "turn_in_progress" && (
          <motion.section
            {...(reduceMotion ? {} : motionPresets.staggerSection(0.1))}
            className="mb-4"
          >
            <PhasePanel
              game={{ ...game, status: normalizedStatus }}
              canStartTurn={canStartTurn}
              onStartTurn={() => handleGameAction("start_turn")}
              countdown={secondsRemaining}
            />
          </motion.section>
        )}

        {normalizedStatus === "turn_in_progress" && (
          <>
            <motion.section
              {...(reduceMotion ? {} : motionPresets.staggerSection(0.1))}
              className="mb-4 flex-1"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={game.currentCard?.id || "hidden"}
                  {...(reduceMotion ? {} : motionPresets.cardSwap)}
                  className="flex h-full min-h-[280px] flex-col rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 sm:p-6"
                  aria-label="Current card"
                >
                  {cardVisibleToViewer && game.currentCard ? (
                    <>
                      <div className="mb-4 flex justify-center">
                        <span className="rounded-full bg-white/[0.08] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-400">
                          {game.currentCard.category || "-"}
                        </span>
                      </div>

                      <div className="flex flex-1 items-center justify-center">
                        <h2 className="text-center text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
                          {game.currentCard.question || "Waiting"}
                        </h2>
                      </div>

                      <div className="mt-4 border-t border-white/[0.06] pt-4">
                        <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-wider text-red-400/80">
                          Forbidden Words
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                          {(game.currentCard.taboo || []).map((word, index) => (
                            <motion.span
                              key={word}
                              {...(reduceMotion
                                ? {}
                                : motionPresets.tabooWord(index))}
                              className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300"
                            >
                              {word}
                            </motion.span>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center">
                      <p className="mb-2 text-lg font-semibold text-white">
                        Hidden Card
                      </p>
                      <p className="text-sm text-neutral-400">
                        Guess the word from your clue giver.
                      </p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.section>

            <motion.section
              {...(reduceMotion ? {} : motionPresets.staggerSection(0.2))}
            >
              {canSubmitGuess && (
                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    value={guessText}
                    onChange={(event) => setGuessText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitGuess();
                      }
                    }}
                    placeholder="Type your guess..."
                    className="h-11 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-[#3b6ca8]/60"
                    aria-label="Type guess"
                  />
                  <button
                    type="button"
                    onClick={submitGuess}
                    className="h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30"
                  >
                    Guess
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleGameAction("skip_card")}
                  disabled={!canSkipCard}
                  className={cn(
                    "rounded-xl border-2 p-4 font-semibold transition-all",
                    canSkipCard
                      ? "border-amber-500/30 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                      : "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-neutral-600",
                  )}
                >
                  <SkipForward className="mx-auto mb-1 h-6 w-6" />
                  <span className="block text-xs">Skip</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGameAction("taboo_called")}
                  disabled={!canCallTaboo}
                  className={cn(
                    "rounded-xl border-2 p-4 font-semibold transition-all",
                    canCallTaboo
                      ? "border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "cursor-not-allowed border-white/[0.06] bg-white/[0.03] text-neutral-600",
                  )}
                >
                  <AlertTriangle className="mx-auto mb-1 h-6 w-6" />
                  <span className="block text-xs">Taboo</span>
                </button>
              </div>

              {!canSkipCard && !canCallTaboo && !canSubmitGuess && (
                <p className="mt-3 text-center text-xs text-neutral-500">
                  Waiting for the current turn to resolve...
                </p>
              )}
            </motion.section>
          </>
        )}
      </main>

      <ConfirmDialog
        open={showLeaveConfirm}
        title="Leave Game?"
        description="You'll be removed from the game in progress. This can't be undone."
        confirmLabel="Leave"
        cancelLabel="Stay"
        variant="danger"
        onConfirm={handleLeave}
        onCancel={() => setShowLeaveConfirm(false)}
      />
    </div>
  );
}
