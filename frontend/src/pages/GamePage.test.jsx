import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import GamePage from "./GamePage";

const mockUseLobby = vi.fn();

vi.mock("../hooks/useLobby", () => ({
  useLobby: () => mockUseLobby(),
}));

function renderGame(initialEntries = ["/game/AB12"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<div>Home Route</div>} />
        <Route path="/game/:code" element={<GamePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function buildGameState(overrides = {}) {
  const now = Date.now();

  return {
    lobbySession: {
      code: "AB12",
      playerId: "player-1",
      lobby: {
        players: [{ id: "player-1", name: "Alice", team: "A", ready: true }],
        settings: { roundDurationSeconds: 60 },
        game: {
          status: "in_progress",
          roundNumber: 2,
          totalRounds: 5,
          activeTeam: "A",
          roundEndsAt: now + 25000,
          scores: { A: 4, B: 3 },
          currentCard: {
            question: "Sun",
            category: "Nature",
            taboo: ["Star", "Hot", "Sky"],
          },
        },
      },
    },
    restoreState: "restored",
    sendLobbyAction: vi.fn(),
    setErrorMessage: vi.fn(),
    ...overrides,
  };
}

describe("GamePage", () => {
  beforeEach(() => {
    mockUseLobby.mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows reconnecting state while restoring", () => {
    mockUseLobby.mockReturnValue(
      buildGameState({
        restoreState: "restoring",
      }),
    );

    renderGame();

    expect(
      screen.getByText("Reconnecting to your game..."),
    ).toBeInTheDocument();
  });

  it("redirects to home on session and route mismatch", async () => {
    mockUseLobby.mockReturnValue(
      buildGameState({
        lobbySession: {
          code: "ZZ99",
          playerId: "player-1",
          lobby: { players: [], game: null },
        },
      }),
    );

    renderGame();

    await waitFor(() => {
      expect(screen.getByText("Home Route")).toBeInTheDocument();
    });
  });

  it("dispatches game actions when player controls active team", async () => {
    const sendLobbyAction = vi.fn();
    const setErrorMessage = vi.fn();

    mockUseLobby.mockReturnValue(
      buildGameState({
        sendLobbyAction,
        setErrorMessage,
      }),
    );

    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole("button", { name: /Correct/i }));
    expect(setErrorMessage).toHaveBeenCalledWith("");
    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "guess_correct",
    });
  });

  it("dispatches pass action", async () => {
    const sendLobbyAction = vi.fn();
    const setErrorMessage = vi.fn();

    mockUseLobby.mockReturnValue(
      buildGameState({ sendLobbyAction, setErrorMessage }),
    );

    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole("button", { name: /Pass/i }));
    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "pass_card",
    });
  });

  it("dispatches taboo action", async () => {
    const sendLobbyAction = vi.fn();
    const setErrorMessage = vi.fn();

    mockUseLobby.mockReturnValue(
      buildGameState({ sendLobbyAction, setErrorMessage }),
    );

    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole("button", { name: /Taboo/i }));
    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "taboo_called",
    });
  });

  it("disables action buttons when current player cannot control", () => {
    mockUseLobby.mockReturnValue(
      buildGameState({
        lobbySession: {
          code: "AB12",
          playerId: "player-1",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "B", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "in_progress",
              roundNumber: 1,
              totalRounds: 5,
              activeTeam: "A",
              roundEndsAt: Date.now() + 25000,
              scores: { A: 0, B: 0 },
              currentCard: {
                question: "River",
                category: "Nature",
                taboo: ["Water", "Flow"],
              },
            },
          },
        },
      }),
    );

    renderGame();

    expect(screen.getByRole("button", { name: /Correct/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Pass/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Taboo/i })).toBeDisabled();
  });

  it("updates displayed timer while round is in progress", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T12:00:00.000Z"));

    mockUseLobby.mockReturnValue(
      buildGameState({
        lobbySession: {
          code: "AB12",
          playerId: "player-1",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "in_progress",
              roundNumber: 1,
              totalRounds: 5,
              activeTeam: "A",
              roundEndsAt: Date.now() + 4000,
              scores: { A: 1, B: 0 },
              currentCard: {
                question: "Cloud",
                category: "Weather",
                taboo: ["Rain", "Sky"],
              },
            },
          },
        },
      }),
    );

    renderGame();

    expect(screen.getByText("4")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows blurred card when player is not on active team", () => {
    mockUseLobby.mockReturnValue(
      buildGameState({
        lobbySession: {
          code: "AB12",
          playerId: "player-1",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "B", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "in_progress",
              roundNumber: 1,
              totalRounds: 5,
              activeTeam: "A",
              roundEndsAt: Date.now() + 30000,
              scores: { A: 0, B: 0 },
              currentCard: {
                question: "River",
                category: "Nature",
                taboo: ["Water", "Flow"],
              },
            },
          },
        },
      }),
    );

    renderGame();

    const heading = screen.getByText("River");
    expect(heading.className).toMatch(/blur/);

    expect(screen.getByText(/Words hidden/i)).toBeInTheDocument();
  });

  it("shows game over screen when game is finished", () => {
    mockUseLobby.mockReturnValue(
      buildGameState({
        lobbySession: {
          code: "AB12",
          playerId: "player-1",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "finished",
              roundNumber: 5,
              totalRounds: 5,
              activeTeam: "A",
              roundEndsAt: null,
              scores: { A: 7, B: 3 },
              currentCard: null,
            },
          },
        },
      }),
    );

    renderGame();

    expect(screen.getByText("Game Over!")).toBeInTheDocument();
    expect(screen.getByText(/Team Alpha wins/)).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
