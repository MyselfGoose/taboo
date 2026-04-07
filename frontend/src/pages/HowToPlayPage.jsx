import { motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Flag,
  Layers,
  MessageCircle,
  Mic,
  Play,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";

import { Card, CardTitle } from "../components/ui/Card";
import { StatusPill } from "../components/ui/StatusPill";
import { DEMO_CARDS } from "../constants/gameConfig";
import { cn } from "../lib/cn";
import { motionPresets } from "../theme/motion";

const QUICK_START_STEPS = [
  {
    title: "Create or join a lobby",
    body: "Pick a name, choose rounds and timer, then share the 4‑letter code with friends.",
  },
  {
    title: "Split into teams",
    body: "Teams balance automatically. Make sure there is at least one player on each team.",
  },
  {
    title: "Everyone taps Ready",
    body: "The game only starts when everyone is ready and both teams have players.",
  },
  {
    title: "Clue giver starts the turn",
    body: "The active player taps Start Turn and gives clues without saying the forbidden words.",
  },
  {
    title: "Guess fast, score points",
    body: "Teammates guess the word. Correct guesses score points and reveal a new card.",
  },
  {
    title: "Opponents enforce Taboo",
    body: "Opponents can call Taboo to penalize and trigger a quick review vote.",
  },
];

const ROLE_BADGES = [
  {
    title: "Clue Giver",
    icon: Mic,
    className: "border-blue-500/30 bg-blue-500/15 text-blue-300",
    body: "Sees the word and taboo list. Gives clues without saying them.",
  },
  {
    title: "Teammate Guesser",
    icon: MessageCircle,
    className: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
    body: "Types guesses while the timer is running.",
  },
  {
    title: "Opponent Observer",
    icon: Eye,
    className: "border-red-500/30 bg-red-500/15 text-red-300",
    body: "Watches for taboo words and can call Taboo.",
  },
];

const TURN_FLOW = [
  {
    title: "Waiting to Start",
    body: "The clue giver taps Start Turn to begin the timer.",
  },
  {
    title: "Turn in Progress",
    body: "Guess quickly. Correct = +1, skip = 0, Taboo = -1.",
  },
  {
    title: "Between Turns (3s)",
    body: "Short pause while the next clue giver gets ready.",
  },
  {
    title: "Between Rounds (10s)",
    body: "Scores show, then the next round starts with a new clue giver.",
  },
  {
    title: "Game Over",
    body: "After the final round, the team with the higher score wins.",
  },
];

const ACTIONS = [
  {
    label: "Correct guess",
    points: "+1 point",
    color: "text-emerald-300",
  },
  {
    label: "Skip card",
    points: "0 points",
    color: "text-amber-300",
  },
  {
    label: "Taboo called",
    points: "-1 point",
    color: "text-red-300",
  },
  {
    label: "Time runs out",
    points: "0 points",
    color: "text-neutral-400",
  },
];

function LobbyMock() {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-500">
            Lobby Preview
          </p>
          <p className="text-lg font-semibold text-white">Code: A7QK</p>
        </div>
        <StatusPill variant="success">Connected</StatusPill>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Player Name
          </p>
          <p className="mt-1 text-sm font-medium text-white">Alex</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Rounds
          </p>
          <p className="mt-1 text-sm font-medium text-white">5 rounds</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Timer
          </p>
          <p className="mt-1 text-sm font-medium text-white">60 seconds</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Category
          </p>
          <p className="mt-1 text-sm font-medium text-white">Technology</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusPill variant="neutral">Team Alpha · 2 players</StatusPill>
        <StatusPill variant="neutral">Team Beta · 2 players</StatusPill>
        <StatusPill variant="warning">Waiting for Ready</StatusPill>
      </div>

      <button
        type="button"
        className="mt-4 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-300"
        disabled
      >
        Ready Up
      </button>
    </Card>
  );
}

function GameMock({ card }) {
  return (
    <Card className="p-5">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Alpha
          </p>
          <p className="text-2xl font-bold text-white">4</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-center">
          <Clock className="mx-auto mb-1 h-4 w-4 text-neutral-500" />
          <p className="text-2xl font-mono font-bold text-white">42</p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 text-right">
          <p className="text-[10px] uppercase tracking-wider text-neutral-500">
            Beta
          </p>
          <p className="text-2xl font-bold text-white">3</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-5 text-center">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
          Clue Giver Sees
        </p>
        <h3 className="mt-2 text-3xl font-bold text-white">{card.guess}</h3>
        <p className="mt-4 text-[10px] uppercase tracking-wider text-red-400/80">
          Forbidden Words
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
          {card.taboo.map((word) => (
            <span
              key={word}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300"
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-300"
          disabled
        >
          Guess
        </button>
        <button
          type="button"
          className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-300"
          disabled
        >
          Skip
        </button>
        <button
          type="button"
          className="rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-3 text-sm font-semibold text-red-300"
          disabled
        >
          Call Taboo
        </button>
      </div>
    </Card>
  );
}

function ReviewMock({ card }) {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-neutral-400">
            Taboo Review
          </p>
          <p className="text-sm font-semibold text-white">
            Opponent called Taboo
          </p>
          <p className="text-xs text-neutral-500">
            Only the penalized team votes; majority not fair reverses −1
          </p>
        </div>
        <StatusPill variant="warning">Voting</StatusPill>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-center">
        <p className="text-[10px] uppercase tracking-wider text-neutral-500">
          Card Under Review
        </p>
        <h3 className="mt-2 text-2xl font-bold text-white">{card.guess}</h3>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {card.taboo.map((word) => (
            <span
              key={word}
              className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300"
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-300"
          disabled
        >
          Vote Fair
        </button>
        <button
          type="button"
          className="rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-300"
          disabled
        >
          Vote Not Fair
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-neutral-300">
        <div className="flex items-center justify-between">
          <span>Alex (penalized team)</span>
          <span className="text-emerald-300">fair</span>
        </div>
        <div className="flex items-center justify-between">
          <span>Sam (penalized team)</span>
          <span className="text-red-300">not fair</span>
        </div>
      </div>
    </Card>
  );
}

export default function HowToPlayPage() {
  const reduceMotion = useReducedMotion();
  const anim = !reduceMotion;
  const demoCard = DEMO_CARDS[0] || {
    guess: "Volcano",
    taboo: ["Lava", "Erupt", "Mountain", "Ash", "Magma"],
  };
  const reviewCard = DEMO_CARDS[1] || demoCard;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#0a0f1a] via-[#0d1220] to-[#0a0f1a]" />
      <div className="pointer-events-none fixed left-1/2 top-0 h-[420px] w-[520px] -translate-x-1/2 rounded-full bg-[#1e3a5f]/15 blur-[120px]" />
      <div className="pointer-events-none fixed bottom-0 left-1/2 h-[320px] w-[420px] -translate-x-1/2 rounded-full bg-[#b73b3b]/10 blur-[120px]" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:py-10">
        <motion.header
          {...(anim ? motionPresets.pageEnter : {})}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Create/Join
          </Link>
          <StatusPill variant="neutral">Beginner Friendly</StatusPill>
        </motion.header>

        <motion.section {...(anim ? motionPresets.sectionEnter(0) : {})}>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl font-[family-name:var(--font-display)]">
            How to Play Taboo
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-400">
            Learn the rules in minutes. This guide shows the exact flow, buttons,
            and roles you will see during a real match.
          </p>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.05) : {})}>
          <Card className="p-5 sm:p-6">
            <CardTitle>Quick Start</CardTitle>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {QUICK_START_STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {step.title}
                    </p>
                  </div>
                  <p className="text-xs text-neutral-400">{step.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.1) : {})}>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <CardTitle>Lobby Setup</CardTitle>
              <p className="mt-2 text-sm text-neutral-400">
                Create a lobby, choose settings, and share the code with friends.
                Teams auto-balance, and everyone taps Ready before the game begins.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center gap-3 text-sm text-neutral-300">
                  <Users className="h-4 w-4 text-neutral-400" />
                  Minimum 2 players, with at least 1 player per team.
                </div>
                <div className="flex items-center gap-3 text-sm text-neutral-300">
                  <Layers className="h-4 w-4 text-neutral-400" />
                  Choose single or all categories to build the deck.
                </div>
                <div className="flex items-center gap-3 text-sm text-neutral-300">
                  <Play className="h-4 w-4 text-neutral-400" />
                  The game starts only when everyone is ready.
                </div>
              </div>
            </div>
            <LobbyMock />
          </div>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.15) : {})}>
          <Card className="p-5 sm:p-6">
            <CardTitle>Teams & Roles</CardTitle>
            <p className="mt-2 text-sm text-neutral-400">
              Each turn has one clue giver, their teammate guesses, and the
              opposing team watches for taboo words.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {ROLE_BADGES.map((role) => {
                const Icon = role.icon;
                return (
                  <div
                    key={role.title}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
                  >
                    <div
                      className={cn(
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                        role.className,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {role.title}
                    </div>
                    <p className="mt-2 text-xs text-neutral-400">{role.body}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.2) : {})}>
          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <CardTitle>Turn Flow</CardTitle>
              <p className="mt-2 text-sm text-neutral-400">
                Turns alternate between teams. Short pauses keep the pace moving.
              </p>
              <div className="mt-4 space-y-3">
                {TURN_FLOW.map((step, index) => (
                  <div
                    key={step.title}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white">
                        {index + 1}.
                      </span>
                      <p className="text-sm font-semibold text-white">
                        {step.title}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-neutral-400">
                      {step.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <GameMock card={demoCard} />
          </div>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.25) : {})}>
          <Card className="p-5 sm:p-6">
            <CardTitle>Actions & Scoring</CardTitle>
            <p className="mt-2 text-sm text-neutral-400">
              Points are awarded instantly and the next card appears right away.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {ACTIONS.map((action) => (
                <div
                  key={action.label}
                  className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] p-4"
                >
                  <span className="text-sm text-white">{action.label}</span>
                  <span className={cn("text-sm font-semibold", action.color)}>
                    {action.points}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.3) : {})}>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <CardTitle>Taboo Review</CardTitle>
              <p className="mt-2 text-sm text-neutral-400">
                Opponents can call Taboo once per card. The timer pauses while
                the penalized team votes. If more teammates vote “Not Fair” than
                “Fair,” the penalty is reversed and the turn continues with the
                remaining time. Ties keep the penalty.
              </p>
              <div className="mt-4 grid gap-3">
                <div className="flex items-center gap-3 text-sm text-neutral-300">
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                  Taboo call: -1 point to the active team.
                </div>
                <div className="flex items-center gap-3 text-sm text-neutral-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  Majority “Not Fair” on the penalized team reverses the penalty.
                </div>
                <div className="flex items-center gap-3 text-sm text-neutral-300">
                  <Play className="h-4 w-4 text-neutral-400" />
                  Clue giver taps Continue to resume the turn.
                </div>
              </div>
            </div>
            <ReviewMock card={reviewCard} />
          </div>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.35) : {})}>
          <Card className="p-5 sm:p-6">
            <CardTitle>Rounds & Winning</CardTitle>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-wider text-neutral-500">
                  Rounds
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  You choose the number of rounds at lobby creation.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-wider text-neutral-500">
                  Rotation
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  Clue givers rotate so everyone gets turns each round.
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                <p className="text-xs uppercase tracking-wider text-neutral-500">
                  Winning
                </p>
                <p className="mt-2 text-sm text-neutral-300">
                  Highest score wins. Ties are possible.
                </p>
              </div>
            </div>
          </Card>
        </motion.section>

        <motion.section {...(anim ? motionPresets.sectionEnter(0.4) : {})}>
          <Card className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Flag className="h-5 w-5 text-neutral-400" />
              <CardTitle>Minimum Players</CardTitle>
            </div>
            <p className="mt-3 text-sm text-neutral-400">
              You need at least <span className="text-white">2 players</span> to
              start, and both teams must have at least one player. The game is
              most fun with 4 or more.
            </p>
          </Card>
        </motion.section>
      </main>
    </div>
  );
}
