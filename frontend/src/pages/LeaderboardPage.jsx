import { motion, useReducedMotion } from "framer-motion";

const Motion = motion;
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Trophy, Users } from "lucide-react";

import { getLeaderboard, getRecentMatches } from "../api/lobbyApi";
import { Card } from "../components/ui/Card";
import { motionPresets } from "../theme/motion";

function formatTime(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function LeaderboardPage() {
  const reduceMotion = useReducedMotion();
  const [highScores, setHighScores] = useState([]);
  const [topPlayers, setTopPlayers] = useState([]);
  const [recent, setRecent] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [lb, rec] = await Promise.all([
          getLeaderboard({ limit: 15 }),
          getRecentMatches({ limit: 8 }),
        ]);
        if (!active) return;
        setHighScores(lb.highScores);
        setTopPlayers(lb.topPlayers);
        setRecent(rec);
      } catch (e) {
        if (!active) return;
        setError(e.message || "Could not load stats.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1a] px-4 py-8 text-white">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
      <div className="relative z-10 mx-auto max-w-lg">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-neutral-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>

        <Motion.h1
          {...(reduceMotion ? {} : motionPresets.pageEnter)}
          className="mb-2 text-2xl font-bold"
        >
          Stats & history
        </Motion.h1>
        <p className="mb-8 text-sm text-neutral-400">
          Anonymous results from finished games on this server. No accounts
          required.
        </p>

        {loading && (
          <p className="text-sm text-neutral-500">Loading…</p>
        )}
        {error && (
          <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </p>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            <Motion.section {...(reduceMotion ? {} : motionPresets.sectionEnter(0))}>
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                  High-scoring games
                </h2>
              </div>
              <Card className="p-4">
                {highScores.length === 0 ? (
                  <p className="text-sm text-neutral-500">No completed games yet.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {highScores.map((row, i) => (
                      <li
                        key={row.id}
                        className="flex items-center justify-between border-b border-white/[0.06] pb-2 last:border-0"
                      >
                        <span className="text-neutral-400">#{i + 1}</span>
                        <span className="font-mono text-white">
                          {row.teamAScore} – {row.teamBScore}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatTime(row.endedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Motion.section>

            <Motion.section {...(reduceMotion ? {} : motionPresets.sectionEnter(0.05))}>
              <div className="mb-3 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-400" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
                  Top correct guesses (by name)
                </h2>
              </div>
              <Card className="p-4">
                {topPlayers.length === 0 ? (
                  <p className="text-sm text-neutral-500">No player stats yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {topPlayers.map((row, i) => (
                      <li
                        key={`${row.player_name}-${row.team}-${i}`}
                        className="flex justify-between border-b border-white/[0.06] pb-2 last:border-0"
                      >
                        <span className="text-white">{row.player_name}</span>
                        <span className="text-neutral-400">
                          Team {row.team === "B" ? "Beta" : "Alpha"} ·{" "}
                          {row.total_correct} correct
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Motion.section>

            <Motion.section {...(reduceMotion ? {} : motionPresets.sectionEnter(0.1))}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-neutral-400">
                Recent matches
              </h2>
              <Card className="p-4">
                {recent.length === 0 ? (
                  <p className="text-sm text-neutral-500">No recent matches.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-neutral-300">
                    {recent.map((row) => (
                      <li
                        key={row.id}
                        className="flex justify-between border-b border-white/[0.06] pb-2 last:border-0"
                      >
                        <span>
                          {row.teamAScore} – {row.teamBScore}
                          {row.winner && row.winner !== "tie"
                            ? ` · ${row.winner === "A" ? "Alpha" : "Beta"} win`
                            : row.winner === "tie"
                              ? " · Tie"
                              : ""}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {formatTime(row.endedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </Motion.section>
          </div>
        )}
      </div>
    </div>
  );
}
