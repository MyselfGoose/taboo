/* eslint-disable react-hooks/set-state-in-effect -- timer & review UI sync with realtime snapshots */
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const Motion = motion;
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  LogOut,
  MessageCircle,
  Mic,
  Play,
  SkipForward,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { GameFeedbackOverlay } from "../components/game/GameFeedbackOverlay";
import { useGameFeedback } from "../hooks/useGameFeedback";
import { useLobby } from "../hooks/useLobby";
import { cn } from "../lib/cn";
import { feedbackMotion, motionPresets } from "../theme/motion";
import { teamColors } from "../theme/variants";

function buildPlayerRecapRows(players, history) {
  const rows = new Map();
  for (const p of players || []) {
    rows.set(p.id, {
      id: p.id,
      name: p.name,
      team: p.team,
      correct: 0,
      close: 0,
      wrong: 0,
      skips: 0,
      taboos: 0,
    });
  }
  for (const entry of history || []) {
    const id = entry.playerId;
    if (!id || !rows.has(id)) {
      continue;
    }
    const r = rows.get(id);
    if (entry.action === "submit_guess" && entry.matched) {
      r.correct += 1;
    } else if (entry.action === "submit_guess") {
      r.wrong += 1;
    } else if (entry.action === "close_guess") {
      r.close += 1;
    } else if (entry.action === "skip_card") {
      r.skips += 1;
    } else if (entry.action === "taboo_called") {
      r.taboos += 1;
    }
  }
  return [...rows.values()].sort((a, b) => b.correct - a.correct);
}

function GameOverScreen({ game, players, reduceMotion, onLeave }) {
  const scoreA = game?.scores?.A ?? 0;
  const scoreB = game?.scores?.B ?? 0;
  const winner = scoreA > scoreB ? "A" : scoreB > scoreA ? "B" : "tie";
  const recapRows = buildPlayerRecapRows(players, game?.history);
  const history = game?.history || [];
  const totalCorrect = history.filter(
    (e) => e.action === "submit_guess" && e.matched,
  ).length;
  const totalTaboo = history.filter((e) => e.action === "taboo_called").length;
  const totalSkips = history.filter((e) => e.action === "skip_card").length;

  const motionProps = reduceMotion
    ? {}
    : {
        initial: motionPresets.modal.initial,
        animate: motionPresets.modal.animate,
        transition: motionPresets.modal.transition,
      };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <Motion.div
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

        <div className="mb-6 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-left">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Match summary
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-neutral-400">
            <div>
              <p className="text-lg font-semibold text-emerald-300">
                {totalCorrect}
              </p>
              <p>Correct</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-amber-300">{totalSkips}</p>
              <p>Skips</p>
            </div>
            <div>
              <p className="text-lg font-semibold text-red-300">{totalTaboo}</p>
              <p>Taboos</p>
            </div>
          </div>
        </div>

        {recapRows.length > 0 && (
          <div className="mb-6 max-h-40 overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-left">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
              Per player
            </p>
            <ul className="space-y-1.5 text-xs text-neutral-300">
              {recapRows.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-1 border-b border-white/[0.04] pb-1.5 last:border-0"
                >
                  <span className="font-medium text-white">
                    {row.name}
                    <span className="ml-1 text-[10px] text-neutral-500">
                      {row.team === "B" ? "Beta" : "Alpha"}
                    </span>
                  </span>
                  <span className="text-neutral-400">
                    +{row.correct} correct
                    {row.close > 0 ? ` · ${row.close} close` : ""}
                    {row.skips > 0 ? ` · ${row.skips} skip` : ""}
                    {row.taboos > 0 ? ` · ${row.taboos} taboo` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={onLeave}
          className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white/[0.06] text-sm font-medium text-white transition-all hover:bg-white/[0.1]"
        >
          <LogOut className="h-4 w-4" />
          Leave Game
        </button>
      </Motion.div>
    </div>
  );
}

function PhasePanel({
  game,
  canStartTurn,
  onStartTurn,
  countdown,
  startTurnDisabled,
}) {
  const activeName = game?.activeTurn?.playerName || "Player";
  const activeTeamLabel = game?.activeTeam === "B" ? "Beta" : "Alpha";
  const summary = game?.lastTurnSummary;

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
        ) : startTurnDisabled ? (
          <p className="text-sm text-amber-200/90">
            Reconnecting… Start Turn will be available when live.
          </p>
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
        {summary && (
          <div className="mb-3">
            <p className="text-sm font-semibold text-white">
              {summary.clueGiverName} scored{" "}
              <span className="text-emerald-400">{summary.correctGuesses}</span>{" "}
              {summary.correctGuesses === 1 ? "point" : "points"} for Team{" "}
              {summary.team === "B" ? "Beta" : "Alpha"}
            </p>
            {summary.taboos > 0 && (
              <p className="mt-1 text-xs text-red-400">
                {summary.taboos} taboo{" "}
                {summary.taboos === 1 ? "penalty" : "penalties"}
              </p>
            )}
          </div>
        )}
        <p className="mb-2 text-sm text-neutral-400">Up next</p>
        <p className="text-base font-semibold text-white">
          {activeName} from Team {activeTeamLabel}
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
        <div className="mb-3 flex items-center justify-center gap-4">
          <div className="text-center">
            <p className="text-xs text-neutral-500">Alpha</p>
            <p className="text-lg font-bold text-white">
              {game.scores?.A ?? 0}
            </p>
          </div>
          <span className="text-neutral-600">vs</span>
          <div className="text-center">
            <p className="text-xs text-neutral-500">Beta</p>
            <p className="text-lg font-bold text-white">
              {game.scores?.B ?? 0}
            </p>
          </div>
        </div>
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

const ROLE_BADGES = {
  clue_giver: {
    icon: Mic,
    label: "You're the Clue Giver",
    className: "border-blue-500/30 bg-blue-500/15 text-blue-300",
  },
  teammate_guesser: {
    icon: MessageCircle,
    label: "You're Guessing",
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
  },
  opponent_observer: {
    icon: Eye,
    label: "Monitoring for Taboo",
    className: "border-red-500/30 bg-red-500/15 text-red-300",
  },
  spectator: {
    icon: Eye,
    label: "Watching",
    className: "border-white/10 bg-white/5 text-neutral-400",
  },
};

function RoleBadge({ viewerRole }) {
  const badge = ROLE_BADGES[viewerRole] || ROLE_BADGES.spectator;
  const Icon = badge.icon;
  return (
    <div
      className={cn(
        "mx-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        badge.className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {badge.label}
    </div>
  );
}

function ActivityFeed({ history, reduceMotion }) {
  const feedRef = useRef(null);
  const entries = (history || []).slice(-8);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [entries.length]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      ref={feedRef}
      className="mt-3 max-h-[140px] overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2"
    >
      <AnimatePresence initial={false}>
        {entries.map((entry, idx) => {
          const key = `${entry.at}-${entry.action}-${idx}`;
          let icon = null;
          let text = "";
          let color = "text-neutral-500";

          if (entry.action === "submit_guess" && entry.matched) {
            icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />;
            text = `${entry.playerName} guessed correctly!`;
            color = "text-emerald-400";
          } else if (entry.action === "submit_guess") {
            icon = <XCircle className="h-3.5 w-3.5 text-neutral-500" />;
            text = `${entry.playerName}: "${entry.guess}"`;
            color = "text-neutral-500";
          } else if (entry.action === "close_guess") {
            icon = <MessageCircle className="h-3.5 w-3.5 text-amber-400" />;
            text = `${entry.playerName}: close guess "${entry.guess}"`;
            color = "text-amber-400";
          } else if (entry.action === "skip_card") {
            icon = <SkipForward className="h-3.5 w-3.5 text-amber-400" />;
            text = "Card skipped";
            color = "text-amber-400";
          } else if (entry.action === "taboo_called") {
            icon = <AlertTriangle className="h-3.5 w-3.5 text-red-400" />;
            text = `Taboo! −1 for Team ${entry.penalizedTeam === "B" ? "Beta" : "Alpha"}`;
            color = "text-red-400";
          } else if (entry.action === "turn_timeout") {
            icon = <Clock className="h-3.5 w-3.5 text-neutral-400" />;
            text = "Time's up!";
            color = "text-neutral-400";
          } else {
            return null;
          }

          return (
            <Motion.div
              key={key}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn("flex items-center gap-2 py-1 text-xs", color)}
            >
              {icon}
              <span className="truncate">{text}</span>
            </Motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function ReviewPanel({
  review,
  permissions,
  onRequestReview,
  onVote,
  onContinue,
  reduceMotion,
}) {
  if (!review || !review.status) {
    return null;
  }

  const status = review.status;
  const penalizedLabel = review.penalizedTeam === "B" ? "Beta" : "Alpha";
  const calledBy = review.tabooCalledBy?.playerName || "Opponent";
  const notFairCount = review.notFairCount ?? 0;
  const fairCount = review.fairCount ?? 0;
  const eligibleCount = review.eligibleCount ?? 0;
  const outcome = review.outcome;
  const votes = Array.isArray(review.votes) ? review.votes : [];
  const showCard = status === "in_progress" || status === "resolved";

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
      };

  return (
    <Motion.section
      {...motionProps}
      className="mb-4 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400">
            Taboo Review
          </p>
          <p className="text-sm font-semibold text-white">
            {status === "available" && "Review available"}
            {status === "in_progress" && "Review in progress"}
            {status === "resolved" && "Review resolved"}
          </p>
          <p className="text-xs text-neutral-500">
            Called by {calledBy} · Team {penalizedLabel} penalized
          </p>
        </div>
        <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-neutral-300">
          {notFairCount} not fair · {fairCount} fair
        </span>
      </div>

      {status === "available" && permissions?.roleCanRequestReview && (
        <button
          type="button"
          onClick={onRequestReview}
          disabled={!permissions?.isRealtimeConnected}
          className="w-full rounded-xl border border-[#3b6ca8]/40 bg-[#1e3a5f]/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1e3a5f]/45 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Request Review
        </button>
      )}

      {showCard && review.tabooCard && (
        <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-neutral-400">
            Card Under Review
          </p>
          <h3 className="mb-3 text-center text-2xl font-bold text-white">
            {review.tabooCard.question || "Unknown"}
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {(review.tabooCard.taboo || []).map((word) => (
              <span
                key={word}
                className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      )}

      {status === "in_progress" && (
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onVote("fair")}
              disabled={
                !permissions?.roleCanVoteReview ||
                !permissions?.isRealtimeConnected
              }
              className="flex-1 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Vote Fair
            </button>
            <button
              type="button"
              onClick={() => onVote("not_fair")}
              disabled={
                !permissions?.roleCanVoteReview ||
                !permissions?.isRealtimeConnected
              }
              className="flex-1 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Vote Not Fair
            </button>
          </div>
          <p className="text-xs text-neutral-500">
            Team {penalizedLabel} votes · {eligibleCount} player
            {eligibleCount === 1 ? "" : "s"}
          </p>
          <p className="text-[11px] text-neutral-600">
            Majority &quot;not fair&quot; reverses the −1 penalty. Ties keep the
            penalty.
          </p>
        </div>
      )}

      {status === "resolved" && (
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-white">
            {outcome === "reverted"
              ? "Review outcome: Taboo reversed"
              : "Review outcome: Taboo stands"}
          </p>
          <p className="text-xs text-neutral-500">
            {fairCount} fair · {notFairCount} not fair · {eligibleCount} total
          </p>
          {permissions?.roleCanContinueAfterReview && (
            <button
              type="button"
              onClick={onContinue}
              disabled={!permissions?.isRealtimeConnected}
              className="w-full rounded-xl border border-[#3b6ca8]/40 bg-[#1e3a5f]/30 px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#1e3a5f]/45 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continue Turn
            </button>
          )}
        </div>
      )}

      {votes.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <p className="mb-2 text-xs uppercase tracking-wider text-neutral-400">
            Votes
          </p>
          <div className="space-y-1 text-xs text-neutral-300">
            {votes.map((voteEntry) => (
              <div
                key={voteEntry.playerId}
                className="flex items-center justify-between"
              >
                <span>{voteEntry.playerName || "Player"}</span>
                <span className="font-medium capitalize text-neutral-200">
                  {voteEntry.vote ? voteEntry.vote.replace("_", " ") : "pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Motion.section>
  );
}

export default function GamePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const {
    lobbySession,
    clearLobbySession,
    restoreState,
    connectionState = "connected",
    sendLobbyAction,
    setErrorMessage,
    lastStateReceivedAt,
  } = useLobby();

  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [guessText, setGuessText] = useState("");
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [showTabooReviewPrompt, setShowTabooReviewPrompt] = useState(false);
  const lastPromptedReviewIdRef = useRef(null);

  const game = lobbySession?.lobby?.game;

  const handleLeave = useCallback(() => {
    clearLobbySession();
    navigate("/");
  }, [clearLobbySession, navigate]);

  useEffect(() => {
    const targetTime =
      game?.turnEndsAt || game?.phaseEndsAt || game?.roundEndsAt;
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
  }, [
    game?.turnEndsAt,
    game?.phaseEndsAt,
    game?.roundEndsAt,
    game?.secondsRemaining,
  ]);

  const currentPlayer = useMemo(
    () =>
      lobbySession?.lobby?.players?.find(
        (p) => p.id === lobbySession?.playerId,
      ) || null,
    [lobbySession?.lobby?.players, lobbySession?.playerId],
  );

  const isRealtimeConnected = connectionState === "connected";
  const shouldShowReconnectBanner =
    connectionState === "disconnected" || connectionState === "reconnecting";

  const feedbackVariant = useGameFeedback({
    history: game?.history,
    review: game?.review,
    gameStatus: game?.status,
    reduceMotion,
  });

  const fallbackPermissions = {
    canStartTurn: false,
    canSubmitGuess: false,
    canSkipCard: false,
    canCallTaboo: false,
    canRequestReview: false,
    canVoteReview: false,
    canContinueAfterReview: false,
  };

  const permissions = game?.permissions || fallbackPermissions;
  const roleCanStartTurn = Boolean(permissions.canStartTurn);
  const roleCanSubmitGuess = Boolean(permissions.canSubmitGuess);
  const roleCanSkipCard = Boolean(permissions.canSkipCard);
  const roleCanCallTaboo = Boolean(permissions.canCallTaboo);
  const roleCanRequestReview = Boolean(permissions.canRequestReview);
  const roleCanVoteReview = Boolean(permissions.canVoteReview);
  const roleCanContinueAfterReview = Boolean(
    permissions.canContinueAfterReview,
  );

  const canStartTurn = isRealtimeConnected && roleCanStartTurn;
  const canSubmitGuess = isRealtimeConnected && roleCanSubmitGuess;
  const canRequestReview = isRealtimeConnected && roleCanRequestReview;
  const canVoteReview = isRealtimeConnected && roleCanVoteReview;
  const canContinueAfterReview =
    isRealtimeConnected && roleCanContinueAfterReview;

  const review = game?.review;
  const reviewStatus = review?.status;
  const reviewPaused =
    reviewStatus === "in_progress" || reviewStatus === "resolved";
  const reviewId = review?.id || null;

  const handleGameAction = useCallback(
    (action, payload = {}) => {
      if (!isRealtimeConnected) {
        setErrorMessage("Reconnecting…");
        return false;
      }
      setErrorMessage("");
      sendLobbyAction({ type: "game_action", action, ...payload });
      return true;
    },
    [sendLobbyAction, setErrorMessage, isRealtimeConnected],
  );

  const submitGuess = useCallback(() => {
    const trimmed = guessText.trim();
    if (!trimmed || !canSubmitGuess) {
      return;
    }

    handleGameAction("submit_guess", { guess: trimmed });
    setGuessText("");
  }, [guessText, canSubmitGuess, handleGameAction]);

  const handleRequestReview = useCallback(() => {
    if (!roleCanRequestReview) return;
    handleGameAction("request_review");
  }, [roleCanRequestReview, handleGameAction]);

  const handleDismissReview = useCallback(() => {
    if (!roleCanRequestReview) return;
    handleGameAction("dismiss_review");
  }, [roleCanRequestReview, handleGameAction]);

  const handleReviewVote = useCallback(
    (vote) => {
      if (!canVoteReview) return;
      handleGameAction("review_vote", { vote });
    },
    [canVoteReview, handleGameAction],
  );

  const handleReviewContinue = useCallback(() => {
    if (!canContinueAfterReview) return;
    handleGameAction("review_continue");
  }, [canContinueAfterReview, handleGameAction]);

  useEffect(() => {
    if (reviewStatus !== "available") {
      setShowTabooReviewPrompt(false);
      return;
    }

    if (!roleCanRequestReview) {
      return;
    }

    if (!reviewId) {
      return;
    }

    if (lastPromptedReviewIdRef.current === reviewId) {
      return;
    }

    lastPromptedReviewIdRef.current = reviewId;
    setShowTabooReviewPrompt(true);
  }, [roleCanRequestReview, reviewId, reviewStatus]);

  if (restoreState === "restoring") {
    return (
      <div className="min-h-screen p-6 text-center text-white">
        Reconnecting to your game...
      </div>
    );
  }

  if (!lobbySession || lobbySession.code !== code) {
    return <Navigate to={`/?code=${code}`} replace />;
  }

  if (!game) {
    return <Navigate to={`/lobby/${code}`} replace />;
  }

  const colorsA = teamColors("A");
  const colorsB = teamColors("B");
  const normalizedStatus =
    game.status === "in_progress" ? "turn_in_progress" : game.status;
  const activeTeamColors = teamColors(game.activeTeam || "A");

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
      : false;

  if (normalizedStatus === "finished") {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white">
        <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
        <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-[#1e3a5f]/15 blur-[100px]" />
        <div className="pointer-events-none fixed bottom-0 left-1/2 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-[#b73b3b]/10 blur-[100px]" />
        <div className="relative z-10" data-testid="game-page">
          <GameOverScreen
            game={game}
            players={lobbySession?.lobby?.players}
            reduceMotion={reduceMotion}
            onLeave={handleLeave}
          />
        </div>
      </div>
    );
  }

  const syncHint =
    isRealtimeConnected && lastStateReceivedAt
      ? `Live · updated ${new Date(lastStateReceivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-[#0a0f1a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[400px] w-[500px] -translate-x-1/2 rounded-full bg-[#1e3a5f]/15 blur-[100px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/2 h-[300px] w-[400px] -translate-x-1/2 rounded-full bg-[#b73b3b]/10 blur-[100px]" />

      <GameFeedbackOverlay variant={feedbackVariant} reduceMotion={reduceMotion} />

      {shouldShowReconnectBanner && (
        <div
          className={cn(
            "relative z-20 border-b px-4 py-2.5 text-center text-sm",
            connectionState === "reconnecting"
              ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
              : "border-red-500/25 bg-red-500/10 text-red-100",
          )}
          role="status"
        >
          {connectionState === "reconnecting"
            ? "Reconnecting… You can still see the board; actions resume when live."
            : "Connection lost — showing last known state. Actions disabled until reconnected."}
        </div>
      )}

      <Motion.header
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

        <div className="flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Round</span>
            <span className="text-sm font-semibold text-white">
              {game.roundNumber || 0}/{game.totalRounds || 0}
            </span>
          </div>
          {syncHint && (
            <span className="text-[10px] text-neutral-600">{syncHint}</span>
          )}
        </div>
      </Motion.header>

      <main
        className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-4"
        data-testid="game-page"
      >
        <Motion.section
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

            <Motion.div
              className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.03] p-3 text-center"
              animate={
                reduceMotion || normalizedStatus !== "turn_in_progress"
                  ? {}
                  : secondsRemaining <= 10
                    ? feedbackMotion.timerUrgent
                    : { filter: "brightness(1)" }
              }
              transition={{ duration: 0.5, ease: "easeOut" }}
            >
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
            </Motion.div>

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
        </Motion.section>

        <Motion.div
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
        </Motion.div>

        <div className="mb-3 flex justify-center">
          <RoleBadge viewerRole={game.viewerRole || "spectator"} />
        </div>

        {(reviewStatus === "in_progress" || reviewStatus === "resolved") && (
          <ReviewPanel
            review={review}
            permissions={{
              canRequestReview,
              canVoteReview,
              canContinueAfterReview,
              roleCanRequestReview,
              roleCanVoteReview,
              roleCanContinueAfterReview,
              isRealtimeConnected,
            }}
            onRequestReview={handleRequestReview}
            onVote={handleReviewVote}
            onContinue={handleReviewContinue}
            reduceMotion={reduceMotion}
          />
        )}

        {normalizedStatus !== "turn_in_progress" && (
          <Motion.section
            {...(reduceMotion ? {} : motionPresets.staggerSection(0.1))}
            className="mb-4"
          >
            <PhasePanel
              game={{ ...game, status: normalizedStatus }}
              canStartTurn={canStartTurn}
              onStartTurn={() => handleGameAction("start_turn")}
              countdown={secondsRemaining}
              startTurnDisabled={!isRealtimeConnected && roleCanStartTurn}
            />
          </Motion.section>
        )}

        {normalizedStatus === "turn_in_progress" && !reviewPaused && (
          <>
            <Motion.section
              {...(reduceMotion ? {} : motionPresets.staggerSection(0.1))}
              className="mb-4 flex-1"
            >
              <AnimatePresence mode="wait">
                <Motion.div
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
                            <Motion.span
                              key={word}
                              {...(reduceMotion
                                ? {}
                                : motionPresets.tabooWord(index))}
                              className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300"
                            >
                              {word}
                            </Motion.span>
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
                </Motion.div>
              </AnimatePresence>
            </Motion.section>

            <Motion.section
              {...(reduceMotion ? {} : motionPresets.staggerSection(0.2))}
            >
              {roleCanSubmitGuess && (
                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    value={guessText}
                    disabled={!isRealtimeConnected}
                    onChange={(event) => setGuessText(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        submitGuess();
                      }
                    }}
                    placeholder={
                      isRealtimeConnected
                        ? "Type your guess..."
                        : "Reconnecting…"
                    }
                    className="h-11 flex-1 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-sm text-white outline-none placeholder:text-neutral-500 focus:border-[#3b6ca8]/60 disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Type guess"
                  />
                  <button
                    type="button"
                    onClick={submitGuess}
                    disabled={!isRealtimeConnected}
                    className="h-11 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Guess
                  </button>
                </div>
              )}

              {roleCanSkipCard && (
                <button
                  type="button"
                  onClick={() => handleGameAction("skip_card")}
                  disabled={!isRealtimeConnected}
                  className="w-full rounded-xl border-2 border-amber-500/30 bg-amber-500/20 p-4 font-semibold text-amber-400 transition-all hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <SkipForward className="mx-auto mb-1 h-6 w-6" />
                  <span className="block text-xs">Skip Card</span>
                </button>
              )}

              {roleCanCallTaboo && (
                <button
                  type="button"
                  onClick={() => handleGameAction("taboo_called")}
                  disabled={!isRealtimeConnected}
                  className="w-full rounded-xl border-2 border-red-500/30 bg-red-500/20 p-4 font-semibold text-red-400 transition-all hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <AlertTriangle className="mx-auto mb-1 h-6 w-6" />
                  <span className="block text-xs">Call Taboo!</span>
                </button>
              )}

              {!roleCanSkipCard &&
                !roleCanCallTaboo &&
                !roleCanSubmitGuess && (
                <p className="mt-3 text-center text-xs text-neutral-500">
                  Watching the current turn...
                </p>
              )}

              <ActivityFeed
                history={game.history}
                reduceMotion={reduceMotion}
              />
            </Motion.section>
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

      <ConfirmDialog
        open={showTabooReviewPrompt}
        title="Taboo Called"
        description="The opposing team called Taboo. Do you want to request a review, or ignore it and continue?"
        confirmLabel="Request review"
        cancelLabel="Ignore"
        variant="primary"
        onConfirm={() => {
          setShowTabooReviewPrompt(false);
          handleRequestReview();
        }}
        onCancel={() => {
          setShowTabooReviewPrompt(false);
          handleDismissReview();
        }}
      />
    </div>
  );
}
