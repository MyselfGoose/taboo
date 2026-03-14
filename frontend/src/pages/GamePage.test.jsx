import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        <Route path="/lobby/:code" element={<div>Lobby Route</div>} />
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
        players: [
          { id: "player-1", name: "Alice", team: "A", ready: true },
          { id: "player-2", name: "Bob", team: "B", ready: true },
        ],
        settings: { roundDurationSeconds: 60 },
        game: {
          status: "waiting_to_start_turn",
          roundNumber: 1,
          totalRounds: 5,
          nextRoundNumber: 1,
          activeTeam: "A",
          activeTurn: {
            playerId: "player-1",
            playerName: "Alice",
            team: "A",
            turnIndexInRound: 1,
            totalTurnsInRound: 2,
          },
          scores: { A: 0, B: 0 },
          turnEndsAt: null,
          phaseEndsAt: now + 3000,
          secondsRemaining: 3,
          currentCard: {
            id: "card-1",
            question: "Sun",
            category: "Nature",
            taboo: ["Star", "Hot", "Sky"],
          },
          cardVisibleToViewer: true,
          roleHint: "You are giving clues.",
          permissions: {
            canStartTurn: true,
            canSubmitGuess: false,
            canSkipCard: false,
            canCallTaboo: false,
          },
        },
      },
    },
    restoreState: "restored",
    sendLobbyAction: vi.fn(),
    setErrorMessage: vi.fn(),
    clearLobbySession: vi.fn(),
    ...overrides,
  };
}

describe("GamePage", () => {
  beforeEach(() => {
    mockUseLobby.mockReset();
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

  it("lets clue giver start the turn", async () => {
    const sendLobbyAction = vi.fn();
    mockUseLobby.mockReturnValue(buildGameState({ sendLobbyAction }));

    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole("button", { name: /Start Turn/i }));

    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "start_turn",
    });
  });

  it("shows waiting message for non-clue-giver during start phase", () => {
    mockUseLobby.mockReturnValue(
      buildGameState({
        lobbySession: {
          code: "AB12",
          playerId: "player-2",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
              { id: "player-2", name: "Bob", team: "B", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "waiting_to_start_turn",
              roundNumber: 1,
              totalRounds: 5,
              nextRoundNumber: 1,
              activeTeam: "A",
              activeTurn: {
                playerId: "player-1",
                playerName: "Alice",
                team: "A",
                turnIndexInRound: 1,
                totalTurnsInRound: 2,
              },
              scores: { A: 0, B: 0 },
              turnEndsAt: null,
              phaseEndsAt: Date.now() + 3000,
              secondsRemaining: 3,
              currentCard: {
                id: "card-1",
                question: "Sun",
                category: "Nature",
                taboo: ["Star", "Hot", "Sky"],
              },
              cardVisibleToViewer: true,
              roleHint: "Watch for taboo words.",
              permissions: {
                canStartTurn: false,
                canSubmitGuess: false,
                canSkipCard: false,
                canCallTaboo: false,
              },
            },
          },
        },
      }),
    );

    renderGame();

    expect(
      screen.getByText("Waiting for Alice to start their turn."),
    ).toBeInTheDocument();
  });

  it("teammate can submit typed guess and card stays hidden", async () => {
    const sendLobbyAction = vi.fn();
    mockUseLobby.mockReturnValue(
      buildGameState({
        sendLobbyAction,
        lobbySession: {
          code: "AB12",
          playerId: "player-3",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
              { id: "player-3", name: "Cara", team: "A", ready: true },
              { id: "player-2", name: "Bob", team: "B", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "turn_in_progress",
              roundNumber: 1,
              totalRounds: 5,
              nextRoundNumber: 1,
              activeTeam: "A",
              activeTurn: {
                playerId: "player-1",
                playerName: "Alice",
                team: "A",
                turnIndexInRound: 1,
                totalTurnsInRound: 3,
              },
              scores: { A: 0, B: 0 },
              turnEndsAt: Date.now() + 30000,
              phaseEndsAt: null,
              secondsRemaining: 30,
              currentCard: null,
              cardVisibleToViewer: false,
              roleHint: "Guess the word.",
              permissions: {
                canStartTurn: false,
                canSubmitGuess: true,
                canSkipCard: false,
                canCallTaboo: false,
              },
            },
          },
        },
      }),
    );

    const user = userEvent.setup();
    renderGame();

    expect(screen.getByText("Hidden Card")).toBeInTheDocument();

    const input = screen.getByRole("textbox", { name: "Type guess" });
    await user.type(input, "  Sun  ");
    await user.click(screen.getByRole("button", { name: "Guess" }));

    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "submit_guess",
      guess: "Sun",
    });
    expect(input).toHaveValue("");
  });

  it("clue giver can skip but not call taboo", async () => {
    const sendLobbyAction = vi.fn();
    mockUseLobby.mockReturnValue(
      buildGameState({
        sendLobbyAction,
        lobbySession: {
          code: "AB12",
          playerId: "player-1",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
              { id: "player-2", name: "Bob", team: "B", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "turn_in_progress",
              roundNumber: 1,
              totalRounds: 5,
              nextRoundNumber: 1,
              activeTeam: "A",
              activeTurn: {
                playerId: "player-1",
                playerName: "Alice",
                team: "A",
                turnIndexInRound: 1,
                totalTurnsInRound: 2,
              },
              scores: { A: 0, B: 0 },
              turnEndsAt: Date.now() + 30000,
              phaseEndsAt: null,
              secondsRemaining: 30,
              currentCard: {
                id: "card-1",
                question: "Sun",
                category: "Nature",
                taboo: ["Star", "Hot", "Sky"],
              },
              cardVisibleToViewer: true,
              roleHint: "You are giving clues.",
              permissions: {
                canStartTurn: false,
                canSubmitGuess: false,
                canSkipCard: true,
                canCallTaboo: false,
              },
            },
          },
        },
      }),
    );

    const user = userEvent.setup();
    renderGame();

    expect(screen.getByRole("button", { name: "Taboo" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Skip" }));

    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "skip_card",
    });
  });

  it("opponent can call taboo", async () => {
    const sendLobbyAction = vi.fn();
    mockUseLobby.mockReturnValue(
      buildGameState({
        sendLobbyAction,
        lobbySession: {
          code: "AB12",
          playerId: "player-2",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
              { id: "player-2", name: "Bob", team: "B", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "turn_in_progress",
              roundNumber: 1,
              totalRounds: 5,
              nextRoundNumber: 1,
              activeTeam: "A",
              activeTurn: {
                playerId: "player-1",
                playerName: "Alice",
                team: "A",
                turnIndexInRound: 1,
                totalTurnsInRound: 2,
              },
              scores: { A: 0, B: 0 },
              turnEndsAt: Date.now() + 30000,
              phaseEndsAt: null,
              secondsRemaining: 30,
              currentCard: {
                id: "card-1",
                question: "Sun",
                category: "Nature",
                taboo: ["Star", "Hot", "Sky"],
              },
              cardVisibleToViewer: true,
              roleHint: "Watch for taboo words.",
              permissions: {
                canStartTurn: false,
                canSubmitGuess: false,
                canSkipCard: false,
                canCallTaboo: true,
              },
            },
          },
        },
      }),
    );

    const user = userEvent.setup();
    renderGame();

    expect(screen.getByRole("button", { name: "Skip" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Taboo" }));

    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "game_action",
      action: "taboo_called",
    });
  });

  it("shows round transition countdown", () => {
    mockUseLobby.mockReturnValue(
      buildGameState({
        lobbySession: {
          code: "AB12",
          playerId: "player-1",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
              { id: "player-2", name: "Bob", team: "B", ready: true },
            ],
            settings: { roundDurationSeconds: 60 },
            game: {
              status: "between_rounds",
              roundNumber: 1,
              totalRounds: 5,
              nextRoundNumber: 2,
              activeTeam: "A",
              activeTurn: {
                playerId: "player-1",
                playerName: "Alice",
                team: "A",
                turnIndexInRound: 1,
                totalTurnsInRound: 2,
              },
              scores: { A: 3, B: 2 },
              turnEndsAt: null,
              phaseEndsAt: Date.now() + 10000,
              secondsRemaining: 10,
              currentCard: {
                id: "card-1",
                question: "Sun",
                category: "Nature",
                taboo: ["Star", "Hot", "Sky"],
              },
              cardVisibleToViewer: true,
              roleHint: "Waiting for active turn.",
              permissions: {
                canStartTurn: false,
                canSubmitGuess: false,
                canSkipCard: false,
                canCallTaboo: false,
              },
            },
          },
        },
      }),
    );

    renderGame();

    expect(screen.getByText(/Round 2 starts in/i)).toBeInTheDocument();
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
              scores: { A: 7, B: 3 },
            },
          },
        },
      }),
    );

    renderGame();

    expect(screen.getByText("Game Over!")).toBeInTheDocument();
    expect(screen.getByText(/Team Alpha wins/)).toBeInTheDocument();
  });

  it("calls clearLobbySession when leave is confirmed", async () => {
    const clearLobbySession = vi.fn();
    mockUseLobby.mockReturnValue(buildGameState({ clearLobbySession }));

    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole("button", { name: "Leave game" }));
    await user.click(screen.getByRole("button", { name: "Leave" }));

    expect(clearLobbySession).toHaveBeenCalled();
  });
});
