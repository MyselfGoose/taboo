import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LobbyPage from "./LobbyPage";

const mockUseLobby = vi.fn();

vi.mock("../hooks/useLobby", () => ({
  useLobby: () => mockUseLobby(),
}));

function renderLobby(initialEntries = ["/lobby/AB12"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<div>Home Route</div>} />
        <Route path="/game/:code" element={<div>Game Route</div>} />
        <Route path="/lobby/:code" element={<LobbyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function buildLobbyState(overrides = {}) {
  return {
    lobbySession: {
      code: "AB12",
      playerId: "player-1",
      playerName: "Alice",
      lobby: {
        players: [
          { id: "player-1", name: "Alice", team: "A", ready: false },
          { id: "player-2", name: "Bob", team: "B", ready: true },
        ],
        teams: {
          A: ["Alice"],
          B: ["Bob"],
        },
        settings: {
          roundCount: 5,
          roundDurationSeconds: 60,
          categoryNames: ["Classic"],
        },
        game: null,
      },
    },
    sendLobbyAction: vi.fn(),
    connectionState: "connected",
    errorMessage: "",
    setErrorMessage: vi.fn(),
    tabTag: "tab-a",
    restoreState: "restored",
    restoreError: "",
    ...overrides,
  };
}

describe("LobbyPage", () => {
  beforeEach(() => {
    mockUseLobby.mockReset();
  });

  it("shows reconnecting state while restoring", () => {
    mockUseLobby.mockReturnValue(
      buildLobbyState({
        restoreState: "restoring",
      }),
    );

    renderLobby();

    expect(
      screen.getByText("Reconnecting to your lobby..."),
    ).toBeInTheDocument();
  });

  it("redirects to home when session code does not match route", async () => {
    mockUseLobby.mockReturnValue(
      buildLobbyState({
        lobbySession: {
          code: "ZZ99",
          playerId: "player-1",
          playerName: "Alice",
          lobby: {
            players: [],
            teams: { A: [], B: [] },
            settings: {},
            game: null,
          },
        },
      }),
    );

    renderLobby();

    await waitFor(() => {
      expect(screen.getByText("Home Route")).toBeInTheDocument();
    });
  });

  it("dispatches team change and ready actions", async () => {
    const sendLobbyAction = vi.fn();
    const setErrorMessage = vi.fn();

    mockUseLobby.mockReturnValue(
      buildLobbyState({
        sendLobbyAction,
        setErrorMessage,
      }),
    );

    const user = userEvent.setup();
    renderLobby();

    await user.click(screen.getByRole("button", { name: "Join Team Beta" }));
    expect(setErrorMessage).toHaveBeenCalledWith("");
    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "change_team",
      team: "B",
    });

    await user.click(screen.getByRole("button", { name: "Mark as Ready" }));
    expect(sendLobbyAction).toHaveBeenCalledWith({
      type: "set_ready",
      ready: true,
    });
  });

  it("renders readiness tags for each player", () => {
    mockUseLobby.mockReturnValue(buildLobbyState());

    renderLobby();

    expect(screen.getByText("Not Ready")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("navigates to game when game status becomes in progress", async () => {
    mockUseLobby.mockReturnValue(
      buildLobbyState({
        lobbySession: {
          code: "AB12",
          playerId: "player-1",
          playerName: "Alice",
          lobby: {
            players: [
              { id: "player-1", name: "Alice", team: "A", ready: true },
            ],
            teams: { A: ["Alice"], B: [] },
            settings: {
              roundCount: 5,
              roundDurationSeconds: 60,
              categoryNames: ["Classic"],
            },
            game: { status: "in_progress" },
          },
        },
      }),
    );

    renderLobby();

    await waitFor(() => {
      expect(screen.getByText("Game Route")).toBeInTheDocument();
    });
  });
});
