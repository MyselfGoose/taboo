import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  Users,
  Copy,
  Check,
  Clock,
  Target,
  Wifi,
  WifiOff,
  ArrowLeft,
  Play,
  ChevronRight,
} from "lucide-react";

import { StatusPill } from "../components/ui/StatusPill";
import { useLobby } from "../hooks/useLobby";
import { cn } from "../lib/cn";
import { motionPresets } from "../theme/motion";
import { connectionVariant, teamColors } from "../theme/variants";

export default function LobbyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const {
    lobbySession,
    sendLobbyAction,
    connectionState,
    errorMessage,
    setErrorMessage,
    tabTag,
    restoreState,
    restoreError,
  } = useLobby();

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (restoreState === "restoring") return;
    if (lobbySession?.lobby?.game?.status === "in_progress") {
      navigate(`/game/${lobbySession.code}`);
    }
  }, [restoreState, lobbySession?.lobby?.game?.status, lobbySession?.code, navigate]);

  if (restoreState === "restoring") {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-white flex items-center justify-center">
        <p className="text-neutral-400 text-sm">Reconnecting to your lobby...</p>
      </div>
    );
  }

  if (!lobbySession || !lobbySession.playerName || lobbySession.code !== code) {
    return <Navigate to="/" replace />;
  }

  const lobby = lobbySession.lobby;
  const currentPlayer =
    lobby?.players?.find((p) => {
      if (lobbySession.playerId && p.id) return p.id === lobbySession.playerId;
      return p.name.toLowerCase() === lobbySession.playerName.toLowerCase();
    }) ?? null;

  const currentTeam = currentPlayer?.team ?? null;
  const playerNameLower = lobbySession.playerName.toLowerCase();

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard may not be available */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTeamChange = (team) => {
    setErrorMessage("");
    sendLobbyAction({ type: "change_team", team });
  };

  const handleReadyChange = () => {
    setErrorMessage("");
    sendLobbyAction({ type: "set_ready", ready: !currentPlayer?.ready });
  };

  const allReady = lobby?.players?.every((p) => p.ready) ?? false;
  const teamACount = lobby?.teams?.A?.length ?? 0;
  const teamBCount = lobby?.teams?.B?.length ?? 0;
  const canStart = allReady && teamACount >= 1 && teamBCount >= 1;
  const anim = !reduceMotion;
  const teamA = teamColors("A");
  const teamB = teamColors("B");

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a] pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[#1e3a5f]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#b73b3b]/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <motion.header
        initial={anim ? { opacity: 0, y: -10 } : false}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Leave</span>
        </button>

        <StatusPill variant={connectionVariant(connectionState)}>
          {connectionState === "connected" ? (
            <Wifi className="w-3 h-3" />
          ) : (
            <WifiOff className="w-3 h-3" />
          )}
          <span className="capitalize hidden sm:inline">{connectionState}</span>
        </StatusPill>
      </motion.header>

      <main className="relative z-10 flex-1 flex flex-col px-4 py-4 sm:py-6 max-w-lg mx-auto w-full" data-testid="lobby-page">
        {/* Error */}
        <AnimatePresence>
          {(errorMessage || restoreError) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-4 p-3 rounded-xl bg-[#b73b3b]/10 border border-[#b73b3b]/20"
            >
              <p className="text-sm text-[#c94d4d]" role="alert">{errorMessage || restoreError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lobby Code Section */}
        <motion.section
          {...(anim ? motionPresets.sectionEnter(0) : {})}
          className="text-center mb-6"
        >
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Lobby Code</p>
          <div className="flex items-center justify-center gap-3">
            <h1 className="text-4xl sm:text-5xl font-bold tracking-wider font-mono">{lobbySession.code}</h1>
            <button
              onClick={copyCode}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08] transition-all"
              aria-label="Copy lobby code"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4 text-neutral-400" />
              )}
            </button>
          </div>
          <p className="text-sm text-neutral-500 mt-2">
            {lobbySession.playerName} ({tabTag}) · Share this code with friends
          </p>
        </motion.section>

        {/* Game Settings Card */}
        <motion.section
          {...(anim ? motionPresets.sectionEnter(0.05) : {})}
          className="mb-4"
        >
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-2 flex-1">
                <Target className="w-4 h-4 text-neutral-500" />
                <span className="text-sm text-neutral-400">Rounds</span>
                <span className="ml-auto text-sm font-semibold text-white">{lobby.settings?.roundCount}</span>
              </div>
              <div className="w-px h-4 bg-white/[0.08]" />
              <div className="flex items-center gap-2 flex-1">
                <Clock className="w-4 h-4 text-neutral-500" />
                <span className="text-sm text-neutral-400">Time</span>
                <span className="ml-auto text-sm font-semibold text-white">{lobby.settings?.roundDurationSeconds}s</span>
              </div>
            </div>
            <div className="pt-3 border-t border-white/[0.06]">
              <p className="text-xs text-neutral-500 mb-1">Categories</p>
              <p className="text-sm text-white">{lobby.settings?.categoryNames?.join(", ") || "Loading"}</p>
            </div>
          </div>
        </motion.section>

        {/* Team Selection */}
        <motion.section
          {...(anim ? motionPresets.sectionEnter(0.1) : {})}
          className="mb-4"
        >
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">Choose Team</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTeamChange("A")}
              className={cn(
                "relative p-3 rounded-xl border-2 transition-all",
                currentTeam === "A"
                  ? cn(teamA.bg, teamA.border)
                  : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]",
              )}
            >
              {currentTeam === "A" && <div className={cn("absolute top-2 right-2 w-2 h-2 rounded-full", teamA.dot)} />}
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", teamA.iconBg)}>
                  <Users className={cn("w-3.5 h-3.5", teamA.iconText)} />
                </div>
                <span className="font-semibold text-white text-sm">Alpha</span>
              </div>
              <p className="text-xs text-neutral-500">{teamACount} players</p>
            </button>
            <button
              type="button"
              onClick={() => handleTeamChange("B")}
              className={cn(
                "relative p-3 rounded-xl border-2 transition-all",
                currentTeam === "B"
                  ? cn(teamB.bg, teamB.border)
                  : "bg-white/[0.02] border-white/[0.08] hover:border-white/[0.15]",
              )}
            >
              {currentTeam === "B" && <div className={cn("absolute top-2 right-2 w-2 h-2 rounded-full", teamB.dot)} />}
              <div className="flex items-center gap-2 mb-1">
                <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center", teamB.iconBg)}>
                  <Users className={cn("w-3.5 h-3.5", teamB.iconText)} />
                </div>
                <span className="font-semibold text-white text-sm">Beta</span>
              </div>
              <p className="text-xs text-neutral-500">{teamBCount} players</p>
            </button>
          </div>
        </motion.section>

        {/* Teams Display */}
        <motion.section
          {...(anim ? motionPresets.sectionEnter(0.15) : {})}
          className="flex-1 mb-4"
        >
          <div className="grid grid-cols-2 gap-3 h-full">
            {/* Team Alpha */}
            <div className={cn("p-3 rounded-2xl bg-gradient-to-b to-transparent border", teamA.gradientFrom, teamA.borderFaint)}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-2 h-2 rounded-full", teamA.dot)} />
                <span className="text-xs font-semibold text-white">Team Alpha</span>
              </div>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {(lobby?.teams?.A ?? []).map((name) => {
                    const player = lobby.players?.find((p) => p.name === name);
                    const isCurrent = name.toLowerCase() === playerNameLower;
                    return (
                      <motion.div
                        key={name}
                        {...(anim ? motionPresets.playerItem : {})}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg",
                          isCurrent ? teamA.highlight : "bg-white/[0.03]",
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                          isCurrent ? cn(teamA.avatarBg, "text-white") : "bg-white/10 text-neutral-400",
                        )}>
                          {name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">
                            {name} {isCurrent && <span className="text-neutral-500">(You)</span>}
                          </p>
                        </div>
                        <div className={cn("w-1.5 h-1.5 rounded-full", player?.ready ? "bg-emerald-400" : "bg-amber-400")} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {(lobby?.teams?.A ?? []).length === 0 && (
                  <p className="text-xs text-neutral-500 text-center py-2">No players</p>
                )}
              </div>
            </div>

            {/* Team Beta */}
            <div className={cn("p-3 rounded-2xl bg-gradient-to-b to-transparent border", teamB.gradientFrom, teamB.borderFaint)}>
              <div className="flex items-center gap-2 mb-3">
                <div className={cn("w-2 h-2 rounded-full", teamB.dot)} />
                <span className="text-xs font-semibold text-white">Team Beta</span>
              </div>
              <div className="space-y-1.5">
                <AnimatePresence>
                  {(lobby?.teams?.B ?? []).map((name) => {
                    const player = lobby.players?.find((p) => p.name === name);
                    const isCurrent = name.toLowerCase() === playerNameLower;
                    return (
                      <motion.div
                        key={name}
                        {...(anim ? motionPresets.playerItem : {})}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg",
                          isCurrent ? teamB.highlight : "bg-white/[0.03]",
                        )}
                      >
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
                          isCurrent ? cn(teamB.avatarBg, "text-white") : "bg-white/10 text-neutral-400",
                        )}>
                          {name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">
                            {name} {isCurrent && <span className="text-neutral-500">(You)</span>}
                          </p>
                        </div>
                        <div className={cn("w-1.5 h-1.5 rounded-full", player?.ready ? "bg-emerald-400" : "bg-amber-400")} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {(lobby?.teams?.B ?? []).length === 0 && (
                  <p className="text-xs text-neutral-500 text-center py-2">No players</p>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Bottom Actions */}
        <motion.section
          {...(anim ? motionPresets.sectionEnter(0.2) : {})}
          className="space-y-3 pt-2"
        >
          <button
            type="button"
            onClick={handleReadyChange}
            className={cn(
              "w-full h-12 rounded-xl font-semibold text-sm transition-all",
              currentPlayer?.ready
                ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-white/[0.04] border border-white/[0.08] text-white hover:bg-white/[0.08]",
            )}
          >
            {currentPlayer?.ready ? "Ready! Tap to unready" : "Mark as Ready"}
          </button>

          <button
            type="button"
            disabled={!canStart}
            onClick={() => canStart && navigate(`/game/${code}`)}
            className={cn(
              "w-full h-13 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
              canStart
                ? "bg-gradient-to-r from-[#1e3a5f] to-[#2a4d7a] text-white hover:from-[#2a4d7a] hover:to-[#3b6ca8] shadow-lg shadow-[#1e3a5f]/20"
                : "bg-white/[0.02] text-neutral-500 cursor-default",
            )}
          >
            <Play className="w-4 h-4" />
            {canStart ? "Start Game" : `Waiting for ${lobby?.players?.filter((p) => !p.ready).length || 0} player(s)...`}
            {canStart && <ChevronRight className="w-4 h-4" />}
          </button>
        </motion.section>
      </main>
    </div>
  );
}
