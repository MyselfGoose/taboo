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

    await user.click(screen.getByRole("button", { name: "Guessed" }));
    await user.click(screen.getByRole("button", { name: "Pass" }));
    await user.click(screen.getByRole("button", { name: "Taboo" }));

    expect(setErrorMessage).toHaveBeenCalledWith("");
    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "guess_correct",
    });
    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "pass_card",
    });
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

    expect(screen.getByRole("button", { name: "Guessed" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Pass" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Taboo" })).toBeDisabled();
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

    expect(screen.getByText("4s")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(screen.getByText("2s")).toBeInTheDocument();
  });
});
