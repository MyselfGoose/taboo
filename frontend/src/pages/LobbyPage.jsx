import { useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { useLobby } from "../hooks/useLobby";

export default function LobbyPage() {
  const { code } = useParams();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (restoreState === "restoring") {
      return;
    }

    if (lobbySession?.lobby?.allReady) {
      navigate(`/game/${lobbySession.code}`);
    }
  }, [
    restoreState,
    lobbySession?.lobby?.allReady,
    lobbySession?.code,
    navigate,
  ]);

  if (restoreState === "restoring") {
    return (
      <div className="min-h-screen bg-[#0b1025] p-6 text-center text-slate-100">
        Reconnecting to your lobby...
      </div>
    );
  }

  if (!lobbySession || !lobbySession.playerName || lobbySession.code !== code) {
    return <Navigate to="/" replace />;
  }

  const lobby = lobbySession.lobby;
  const currentPlayer =
    lobby?.players?.find((player) => {
      if (lobbySession.playerId && player.id) {
        return player.id === lobbySession.playerId;
      }

      return (
        player.name.toLowerCase() === lobbySession.playerName.toLowerCase()
      );
    }) ?? null;
  const currentTeam = currentPlayer?.team ?? null;
  const playerNameLower = lobbySession.playerName.toLowerCase();

  const connectionStyle =
    connectionState === "connected"
      ? "border-emerald-300/50 bg-emerald-300/20 text-emerald-100"
      : connectionState === "connecting" || connectionState === "reconnecting"
        ? "border-amber-300/50 bg-amber-300/20 text-amber-100"
        : "border-rose-300/50 bg-rose-400/20 text-rose-100";

  const baseTeamButtonClass =
    "h-11 rounded-xl border px-4 text-sm font-extrabold uppercase tracking-[0.08em] transition";

  const handleTeamChange = (team) => {
    setErrorMessage("");
    sendLobbyAction({
      type: "change_team",
      team,
    });
  };

  const handleReadyChange = (nextReady) => {
    setErrorMessage("");
    sendLobbyAction({
      type: "set_ready",
      ready: nextReady,
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b1025] font-body text-white">
      <div className="pointer-events-none absolute -top-20 left-16 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
      <div className="pointer-events-none absolute right-8 top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />

      <main
        className="relative z-10 mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-2 lg:gap-5 lg:px-10"
        data-testid="lobby-page"
      >
        <section className="rounded-3xl border border-white/15 bg-slate-900/65 p-5 shadow-2xl shadow-black/40 backdrop-blur md:p-6 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
                Lobby
              </p>
              <h1 className="mt-2 font-display text-5xl uppercase tracking-wide text-amber-300 sm:text-6xl">
                Code {lobbySession.code}
              </h1>
              <p className="mt-2 text-base text-slate-200 sm:text-lg">
                Gather your crew, lock your teams, and get everyone ready.
              </p>
            </div>

            <div className="grid gap-2 text-sm">
              <p className="rounded-xl border border-white/15 bg-white/5 px-3 py-2">
                You:{" "}
                <span className="font-bold text-cyan-200">
                  {lobbySession.playerName}
                </span>{" "}
                ({tabTag})
              </p>
              <p
                className={`rounded-xl border px-3 py-2 font-semibold ${connectionStyle}`}
              >
                Connection: {connectionState}
              </p>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <p
            role="alert"
            className="rounded-2xl border border-rose-300/45 bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-100 lg:col-span-2"
          >
            {errorMessage}
          </p>
        ) : null}

        {restoreError ? (
          <p className="rounded-2xl border border-amber-300/45 bg-amber-400/20 px-4 py-3 text-sm font-semibold text-amber-100 lg:col-span-2">
            {restoreError}
          </p>
        ) : null}

        <section
          className="rounded-3xl border border-white/15 bg-linear-to-br from-slate-900/95 via-indigo-950/85 to-slate-900/95 p-5 shadow-2xl shadow-indigo-950/40 backdrop-blur md:p-6"
          aria-label="Lobby settings"
        >
          <h2 className="font-display text-3xl uppercase tracking-wide text-cyan-200">
            Game Settings
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-cyan-300/35 bg-cyan-300/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-100/85">
                Rounds
              </p>
              <p className="mt-1 text-3xl font-extrabold text-cyan-50">
                {lobby.settings?.roundCount}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-300/35 bg-amber-300/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-100/85">
                Duration
              </p>
              <p className="mt-1 text-3xl font-extrabold text-amber-50">
                {lobby.settings?.roundDurationSeconds}s
              </p>
            </div>
          </div>
        </section>

        <section
          className="rounded-3xl border border-white/15 bg-linear-to-br from-slate-900/95 via-purple-950/85 to-slate-900/95 p-5 shadow-2xl shadow-fuchsia-950/35 backdrop-blur md:p-6"
          aria-label="Team selection"
        >
          <h2 className="font-display text-3xl uppercase tracking-wide text-fuchsia-200">
            Your Team
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              className={`${baseTeamButtonClass} ${
                currentTeam === "A"
                  ? "border-amber-300 bg-amber-300/85 text-slate-900"
                  : "border-white/20 bg-white/10 text-slate-100 hover:border-amber-200"
              }`}
              onClick={() => handleTeamChange("A")}
            >
              Join Team Alpha
            </button>
            <button
              type="button"
              className={`${baseTeamButtonClass} ${
                currentTeam === "B"
                  ? "border-cyan-300 bg-cyan-300/85 text-slate-900"
                  : "border-white/20 bg-white/10 text-slate-100 hover:border-cyan-200"
              }`}
              onClick={() => handleTeamChange("B")}
            >
              Join Team Beta
            </button>
          </div>

          <button
            type="button"
            className={`mt-3 h-11 w-full rounded-xl border px-4 text-sm font-extrabold uppercase tracking-[0.08em] transition ${
              currentPlayer?.ready
                ? "border-rose-300/70 bg-rose-400/80 text-slate-950"
                : "border-emerald-300/70 bg-emerald-300/85 text-slate-950"
            }`}
            onClick={() => handleReadyChange(!currentPlayer?.ready)}
          >
            {currentPlayer?.ready ? "Mark Not Ready" : "I'm Ready"}
          </button>
        </section>

        <section
          className="grid gap-4 lg:col-span-2 lg:grid-cols-2"
          aria-label="Teams"
        >
          <article className="rounded-3xl border border-amber-300/30 bg-amber-200/10 p-5 backdrop-blur">
            <h2 className="font-display text-3xl uppercase tracking-wide text-amber-200">
              Team Alpha
            </h2>
            <ul className="mt-3 grid gap-2">
              {(lobby.teams?.A ?? []).map((name) => {
                const player = lobby.players?.find(
                  (entry) => entry.name === name,
                );
                const isCurrent = name.toLowerCase() === playerNameLower;

                return (
                  <li
                    key={name}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      isCurrent
                        ? "border-cyan-300/80 bg-cyan-300/15"
                        : "border-white/15 bg-slate-900/45"
                    }`}
                  >
                    <span className="font-semibold text-slate-100">{name}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                        player?.ready
                          ? "bg-emerald-300/90 text-emerald-950"
                          : "bg-amber-200/90 text-amber-950"
                      }`}
                    >
                      {player?.ready ? "Ready" : "Waiting"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="rounded-3xl border border-cyan-300/30 bg-cyan-200/10 p-5 backdrop-blur">
            <h2 className="font-display text-3xl uppercase tracking-wide text-cyan-200">
              Team Beta
            </h2>
            <ul className="mt-3 grid gap-2">
              {(lobby.teams?.B ?? []).map((name) => {
                const player = lobby.players?.find(
                  (entry) => entry.name === name,
                );
                const isCurrent = name.toLowerCase() === playerNameLower;

                return (
                  <li
                    key={name}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                      isCurrent
                        ? "border-fuchsia-300/80 bg-fuchsia-300/15"
                        : "border-white/15 bg-slate-900/45"
                    }`}
                  >
                    <span className="font-semibold text-slate-100">{name}</span>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold uppercase tracking-wide ${
                        player?.ready
                          ? "bg-emerald-300/90 text-emerald-950"
                          : "bg-amber-200/90 text-amber-950"
                      }`}
                    >
                      {player?.ready ? "Ready" : "Waiting"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </article>
        </section>
      </main>
    </div>
  );
}
