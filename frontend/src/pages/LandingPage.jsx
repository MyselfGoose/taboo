import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Users, Zap } from "lucide-react";

import { createLobby, getCategories, joinLobby } from "../api/lobbyApi";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { ROUND_DURATION_OPTIONS } from "../constants/gameConfig";
import { useLobby } from "../hooks/useLobby";
import { cn } from "../lib/cn";
import { motionPresets } from "../theme/motion";

function normalizeCode(code) {
  return String(code ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 4);
}

export default function LandingPage() {
  const navigate = useNavigate();
  const { lobbySession, restoreState, restoreError, setLobbySession, setErrorMessage } =
    useLobby();
  const reduceMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState("create");
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roundCount, setRoundCount] = useState(5);
  const [roundDurationSeconds, setRoundDurationSeconds] = useState(60);
  const [categoryMode, setCategoryMode] = useState("single");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState("");

  const displayError = localError || restoreError;

  const roundOptionLabels = useMemo(
    () =>
      ROUND_DURATION_OPTIONS.map((seconds) => ({
        seconds,
        label: seconds >= 60 ? `${seconds / 60} min` : `${seconds} sec`,
      })),
    [],
  );

  const selectableCategories = useMemo(
    () => categories.filter((c) => c.selectable !== false),
    [categories],
  );

  useEffect(() => {
    if (restoreState === "restoring") {
      return;
    }

    if (!lobbySession?.code) {
      return;
    }

    if (lobbySession.lobby?.game?.status === "in_progress" || lobbySession.lobby?.game?.status === "turn_in_progress") {
      navigate(`/game/${lobbySession.code}`, { replace: true });
      return;
    }

    navigate(`/lobby/${lobbySession.code}`, { replace: true });
  }, [
    restoreState,
    lobbySession?.code,
    lobbySession?.lobby?.game?.status,
    navigate,
  ]);

  useEffect(() => {
    if (restoreState === "restoring" || lobbySession?.code) {
      return;
    }

    let active = true;
    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const data = await getCategories();
        if (!active) return;
        setCategories(data);
        const first = data.find((c) => c.selectable !== false);
        if (first) setSelectedCategoryId(String(first.categoryId));
      } catch (err) {
        if (!active) return;
        setLocalError(err.message || "Unable to load categories.");
      } finally {
        if (active) setCategoriesLoading(false);
      }
    };
    loadCategories();
    return () => {
      active = false;
    };
  }, [restoreState, lobbySession?.code]);

  const handleCreate = async (event) => {
    event.preventDefault();
    setLocalError("");
    setErrorMessage("");
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const name = createName.trim();
      const response = await createLobby({
        name,
        roundCount,
        roundDurationSeconds,
        categoryMode,
        categoryIds:
          categoryMode === "all"
            ? selectableCategories.map((c) => c.categoryId)
            : [Number(selectedCategoryId)],
      });
      setLobbySession({
        code: response.code,
        playerId: response.playerId,
        playerName: response.playerName || name,
        resumeToken: response.resumeToken,
        lobby: response.lobby,
      });
      navigate(`/lobby/${response.code}`);
    } catch (err) {
      setLocalError(err.message || "Unable to create a lobby.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    setLocalError("");
    setErrorMessage("");
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const name = joinName.trim();
      const response = await joinLobby(name, normalizeCode(joinCode));
      setLobbySession({
        code: response.code,
        playerId: response.playerId,
        playerName: response.playerName || name,
        resumeToken: response.resumeToken,
        lobby: response.lobby,
      });
      navigate(`/lobby/${response.code}`);
    } catch (err) {
      setLocalError(err.message || "Unable to join lobby.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const anim = !reduceMotion;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a] pointer-events-none" />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[#1e3a5f]/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[#b73b3b]/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Main Content */}
      <main
        className="relative z-10 flex-1 flex flex-col px-4 py-6 sm:px-6 sm:py-8 max-w-md mx-auto w-full"
        data-testid="landing-page"
      >
        <div className="flex justify-end mb-3">
          <Link
            to="/how-to-play"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-300 transition hover:bg-white/[0.08] hover:text-white"
          >
            How to Play
          </Link>
        </div>
        {/* Logo / Header */}
        <motion.div
          initial={anim ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 sm:mb-8"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2a4d7a] mb-3 shadow-lg shadow-[#1e3a5f]/20">
            <Sparkles className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight font-[family-name:var(--font-display)]">
            Taboo
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            The ultimate party word game
          </p>
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={anim ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex-1 flex flex-col"
        >
          <div className="bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col">
            {/* Tab Switcher */}
            <div className="flex border-b border-white/[0.06]">
              <button
                type="button"
                onClick={() => setActiveTab("create")}
                className={cn(
                  "flex-1 py-3.5 sm:py-4 text-sm font-medium transition-all relative",
                  activeTab === "create"
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-300",
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  <Zap className="w-4 h-4" />
                  Create Game
                </span>
                {activeTab === "create" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#1e3a5f] to-[#3b6ca8] rounded-full"
                  />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("join")}
                className={cn(
                  "flex-1 py-3.5 sm:py-4 text-sm font-medium transition-all relative",
                  activeTab === "join"
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-300",
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  <Users className="w-4 h-4" />
                  Join Game
                </span>
                {activeTab === "join" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-4 right-4 h-0.5 bg-gradient-to-r from-[#b73b3b] to-[#c94d4d] rounded-full"
                  />
                )}
              </button>
            </div>

            {/* Error Message */}
            <AnimatePresence>
              {displayError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#b73b3b]/10 border-b border-[#b73b3b]/20 px-4 py-2.5"
                >
                  <p className="text-sm text-[#c94d4d]" role="alert">
                    {displayError}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form Content */}
            <div className="p-4 sm:p-5 flex-1">
              <AnimatePresence mode="wait">
                {activeTab === "create" ? (
                  <motion.form
                    key="create"
                    initial={anim ? { opacity: 0, x: -10 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={anim ? { opacity: 0, x: 10 } : undefined}
                    transition={{ duration: 0.15 }}
                    onSubmit={handleCreate}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor="create-name"
                        className="text-xs font-medium text-neutral-400 uppercase tracking-wider"
                      >
                        Your Name
                      </label>
                      <Input
                        id="create-name"
                        type="text"
                        autoComplete="nickname"
                        placeholder="Enter your name"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                        maxLength={32}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="rounds"
                          className="text-xs font-medium text-neutral-400 uppercase tracking-wider"
                        >
                          Rounds
                        </label>
                        <Input
                          id="rounds"
                          type="number"
                          min={1}
                          max={10}
                          value={roundCount}
                          onChange={(e) =>
                            setRoundCount(Number(e.target.value))
                          }
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label
                          htmlFor="duration"
                          className="text-xs font-medium text-neutral-400 uppercase tracking-wider"
                        >
                          Duration
                        </label>
                        <Select
                          id="duration"
                          value={roundDurationSeconds}
                          onChange={(e) =>
                            setRoundDurationSeconds(Number(e.target.value))
                          }
                        >
                          {roundOptionLabels.map((opt) => (
                            <option key={opt.seconds} value={opt.seconds}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-medium text-neutral-400 uppercase tracking-wider">
                        Category
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setCategoryMode("single")}
                          className={cn(
                            "flex-1 h-10 rounded-lg text-sm font-medium transition-all",
                            categoryMode === "single"
                              ? "bg-[#1e3a5f] text-white"
                              : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]",
                          )}
                        >
                          Single
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategoryMode("all")}
                          className={cn(
                            "flex-1 h-10 rounded-lg text-sm font-medium transition-all",
                            categoryMode === "all"
                              ? "bg-[#1e3a5f] text-white"
                              : "bg-white/[0.04] text-neutral-400 hover:bg-white/[0.08]",
                          )}
                        >
                          All
                        </button>
                      </div>
                      {categoryMode === "single" && (
                        <motion.div
                          initial={anim ? { opacity: 0, height: 0 } : false}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={anim ? { opacity: 0, height: 0 } : undefined}
                        >
                          <Select
                            value={selectedCategoryId}
                            onChange={(e) =>
                              setSelectedCategoryId(e.target.value)
                            }
                            disabled={categoriesLoading}
                            className="mt-2"
                          >
                            {selectableCategories.map((cat) => (
                              <option
                                key={cat.categoryId}
                                value={cat.categoryId}
                              >
                                {cat.category} ({cat.wordCount} words)
                              </option>
                            ))}
                          </Select>
                        </motion.div>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={
                        isSubmitting ||
                        categoriesLoading ||
                        selectableCategories.length === 0
                      }
                      className="w-full h-12 sm:h-13 rounded-xl bg-gradient-to-r from-[#1e3a5f] to-[#2a4d7a] text-white font-semibold text-sm hover:from-[#2a4d7a] hover:to-[#3b6ca8] transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#1e3a5f]/20 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting
                        ? "Creating..."
                        : categoriesLoading
                          ? "Loading..."
                          : "Create Lobby"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="join"
                    initial={anim ? { opacity: 0, x: 10 } : false}
                    animate={{ opacity: 1, x: 0 }}
                    exit={anim ? { opacity: 0, x: -10 } : undefined}
                    transition={{ duration: 0.15 }}
                    onSubmit={handleJoin}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label
                        htmlFor="join-name"
                        className="text-xs font-medium text-neutral-400 uppercase tracking-wider"
                      >
                        Your Name
                      </label>
                      <Input
                        id="join-name"
                        type="text"
                        autoComplete="nickname"
                        placeholder="Enter your name"
                        value={joinName}
                        onChange={(e) => setJoinName(e.target.value)}
                        maxLength={32}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="join-code"
                        className="text-xs font-medium text-neutral-400 uppercase tracking-wider"
                      >
                        Lobby Code
                      </label>
                      <Input
                        id="join-code"
                        type="text"
                        placeholder="XXXX"
                        value={joinCode}
                        onChange={(e) =>
                          setJoinCode(normalizeCode(e.target.value))
                        }
                        maxLength={4}
                        required
                        className="h-14 sm:h-16 text-center text-2xl sm:text-3xl font-mono tracking-[0.3em] placeholder:tracking-[0.3em] uppercase"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full h-12 sm:h-13 rounded-xl bg-gradient-to-r from-[#b73b3b] to-[#c94d4d] text-white font-semibold text-sm hover:from-[#c94d4d] hover:to-[#d65d5d] transition-all flex items-center justify-center gap-2 group shadow-lg shadow-[#b73b3b]/20 mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? "Joining..." : "Join Lobby"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
