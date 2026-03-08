import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createLobby, getCategories, joinLobby } from "../api/lobbyApi";
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
  const [categoryMode, setCategoryMode] = useState("single");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
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

  const selectableCategories = useMemo(
    () => categories.filter((category) => category.selectable !== false),
    [categories],
  );

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      setCategoriesLoading(true);
      try {
        const nextCategories = await getCategories();
        if (!active) {
          return;
        }

        setCategories(nextCategories);
        const firstSelectable = nextCategories.find(
          (category) => category.selectable !== false,
        );
        if (firstSelectable) {
          setSelectedCategoryId(String(firstSelectable.categoryId));
        }
      } catch (error) {
        if (!active) {
          return;
        }
        setLocalError(error.message || "Unable to load categories.");
      } finally {
        if (active) {
          setCategoriesLoading(false);
        }
      }
    };

    loadCategories();

    return () => {
      active = false;
    };
  }, []);

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
        categoryMode,
        categoryIds:
          categoryMode === "all"
            ? selectableCategories.map((category) => category.categoryId)
            : [Number(selectedCategoryId)],
      });

      setLobbySession({
        code: response.code,
        playerId: response.playerId,
        playerName: response.playerName || submittedName,
        resumeToken: response.resumeToken,
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
        playerId: response.playerId,
        playerName: response.playerName || submittedName,
        resumeToken: response.resumeToken,
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
    <div className="relative min-h-screen overflow-hidden bg-[#0f1229] font-body text-white">
      <div className="pointer-events-none absolute -left-16 top-20 h-64 w-64 rounded-full bg-fuchsia-500/35 blur-3xl" />
      <div className="pointer-events-none absolute -right-10 top-10 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-amber-400/20 blur-3xl" />

      <main
        className="relative z-10 mx-auto grid min-h-screen w-full max-w-6xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-6 lg:px-10"
        data-testid="landing-page"
      >
        <section className="flex flex-col justify-center rounded-3xl border border-white/15 bg-slate-900/60 p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            Realtime Party Game
          </p>
          <h1 className="mt-4 font-display text-6xl uppercase leading-none tracking-wide text-amber-300 drop-shadow-[0_4px_0_#8a2be2] sm:text-7xl">
            Taboo
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-slate-200/95 sm:text-xl">
            Build your room, split squads, then race through wild word rounds.
            Quick to launch, chaotic to play.
          </p>

          <div className="mt-6 grid gap-3 text-sm text-cyan-100 sm:grid-cols-3">
            <div className="rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.15em] text-cyan-100/80">
                Fast Setup
              </p>
              <p className="mt-1 text-base font-semibold text-cyan-50">
                10 sec to lobby
              </p>
            </div>
            <div className="rounded-2xl border border-fuchsia-300/30 bg-fuchsia-300/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.15em] text-fuchsia-100/80">
                Live Sync
              </p>
              <p className="mt-1 text-base font-semibold text-fuchsia-50">
                Realtime teams
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-3">
              <p className="text-[11px] uppercase tracking-[0.15em] text-amber-100/80">
                Party Energy
              </p>
              <p className="mt-1 text-base font-semibold text-amber-50">
                Ready to shout
              </p>
            </div>
          </div>
        </section>

        <section
          className="flex flex-col justify-center gap-4 lg:gap-5"
          aria-label="Lobby actions"
        >
          {localError ? (
            <p
              role="alert"
              className="rounded-2xl border border-rose-300/40 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-100"
            >
              {localError}
            </p>
          ) : null}

          <form
            className="rounded-3xl border border-white/15 bg-linear-to-br from-indigo-950/90 via-slate-900/95 to-violet-950/90 p-5 shadow-2xl shadow-violet-900/40 backdrop-blur md:p-6"
            onSubmit={handleCreate}
          >
            <h2 className="font-display text-3xl uppercase tracking-wide text-amber-300">
              Create Lobby
            </h2>
            <div className="mt-4 grid gap-3">
              <label
                htmlFor="create-name"
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300"
              >
                Your name
              </label>
              <input
                id="create-name"
                autoComplete="nickname"
                placeholder="Host name"
                value={createName}
                onChange={(event) => setCreateName(event.target.value)}
                maxLength={32}
                className="h-11 rounded-xl border border-white/20 bg-slate-800/80 px-3 text-base text-white outline-none ring-0 transition placeholder:text-slate-400 focus:border-cyan-300 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.2)]"
                required
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label
                    htmlFor="rounds"
                    className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300"
                  >
                    Rounds
                  </label>
                  <input
                    id="rounds"
                    type="number"
                    min={1}
                    max={10}
                    value={roundCount}
                    onChange={(event) =>
                      setRoundCount(Number(event.target.value))
                    }
                    className="h-11 rounded-xl border border-white/20 bg-slate-800/80 px-3 text-base text-white outline-none transition focus:border-cyan-300 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.2)]"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <label
                    htmlFor="duration"
                    className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300"
                  >
                    Round duration
                  </label>
                  <select
                    id="duration"
                    value={roundDurationSeconds}
                    onChange={(event) =>
                      setRoundDurationSeconds(Number(event.target.value))
                    }
                    className="h-11 rounded-xl border border-white/20 bg-slate-800/80 px-3 text-base text-white outline-none transition focus:border-cyan-300 focus:shadow-[0_0_0_3px_rgba(103,232,249,0.2)]"
                  >
                    {roundOptionLabels.map((option) => (
                      <option key={option.seconds} value={option.seconds}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-2 rounded-xl border border-white/15 bg-slate-900/50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300">
                  Category scope
                </p>
                <div className="flex flex-wrap gap-2 text-sm">
                  <label className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5">
                    <input
                      type="radio"
                      name="category-mode"
                      value="single"
                      checked={categoryMode === "single"}
                      onChange={() => setCategoryMode("single")}
                    />
                    Single category
                  </label>
                  <label className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-1.5">
                    <input
                      type="radio"
                      name="category-mode"
                      value="all"
                      checked={categoryMode === "all"}
                      onChange={() => setCategoryMode("all")}
                    />
                    All categories
                  </label>
                </div>
                <select
                  id="category"
                  disabled={categoryMode === "all" || categoriesLoading}
                  value={selectedCategoryId}
                  onChange={(event) =>
                    setSelectedCategoryId(event.target.value)
                  }
                  className="h-11 rounded-xl border border-white/20 bg-slate-800/80 px-3 text-base text-white outline-none transition disabled:cursor-not-allowed disabled:opacity-60"
                  required={categoryMode === "single"}
                >
                  {selectableCategories.map((category) => (
                    <option
                      key={category.categoryId}
                      value={category.categoryId}
                    >
                      {category.category} ({category.wordCount})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  categoriesLoading ||
                  selectableCategories.length === 0
                }
                className="mt-1 h-12 rounded-xl bg-linear-to-r from-cyan-300 via-sky-300 to-emerald-300 px-4 text-base font-extrabold uppercase tracking-wide text-slate-900 transition hover:scale-[1.01] hover:from-cyan-200 hover:to-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting
                  ? "Creating..."
                  : categoriesLoading
                    ? "Loading categories..."
                    : "Create Lobby"}
              </button>
            </div>
          </form>

          <form
            className="rounded-3xl border border-white/15 bg-linear-to-br from-purple-950/95 via-slate-900/95 to-indigo-950/95 p-5 shadow-2xl shadow-fuchsia-900/35 backdrop-blur md:p-6"
            onSubmit={handleJoin}
          >
            <h2 className="font-display text-3xl uppercase tracking-wide text-fuchsia-300">
              Join Lobby
            </h2>
            <div className="mt-4 grid gap-3">
              <label
                htmlFor="join-name"
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300"
              >
                Your name
              </label>
              <input
                id="join-name"
                autoComplete="nickname"
                placeholder="Player name"
                value={joinName}
                onChange={(event) => setJoinName(event.target.value)}
                maxLength={32}
                className="h-11 rounded-xl border border-white/20 bg-slate-800/80 px-3 text-base text-white outline-none ring-0 transition placeholder:text-slate-400 focus:border-fuchsia-300 focus:shadow-[0_0_0_3px_rgba(217,70,239,0.2)]"
                required
              />

              <label
                htmlFor="join-code"
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-300"
              >
                Lobby code
              </label>
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
                className="h-11 rounded-xl border border-white/20 bg-slate-800/80 px-3 text-base uppercase tracking-[0.2em] text-white outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-fuchsia-300 focus:shadow-[0_0_0_3px_rgba(217,70,239,0.2)]"
                required
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-12 rounded-xl bg-linear-to-r from-fuchsia-300 via-rose-300 to-amber-200 px-4 text-base font-extrabold uppercase tracking-wide text-slate-900 transition hover:scale-[1.01] hover:from-fuchsia-200 hover:to-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubmitting ? "Joining..." : "Join Lobby"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
