import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import App from "./App";

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routed lobby flow", () => {
  beforeEach(() => {
    global.fetch = vi.fn();

    class MockWebSocket {
      static OPEN = 1;

      constructor() {
        this.listeners = new Map();
        this.readyState = MockWebSocket.OPEN;
        setTimeout(() => {
          this.dispatch("open");
        }, 0);
      }

      addEventListener(type, listener) {
        if (!this.listeners.has(type)) {
          this.listeners.set(type, new Set());
        }
        this.listeners.get(type).add(listener);
      }

      dispatch(type, payload = {}) {
        const listeners = this.listeners.get(type) || [];
        for (const listener of listeners) {
          listener(payload);
        }
      }

      send() {}

      close() {
        this.dispatch("close");
      }
    }

    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it("renders create and join forms on landing page", () => {
    renderApp();

    expect(
      screen.getByRole("heading", { name: "Create Lobby" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Join Lobby" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("landing-page")).toBeInTheDocument();
  });

  it("sanitizes join code input to uppercase alphanumeric and max length 4", async () => {
    const user = userEvent.setup();
    renderApp();

    const codeInput = screen.getByLabelText("Lobby code");
    await user.type(codeInput, "a!b1c2");

    expect(codeInput).toHaveValue("AB1C");
  });

  it("creates lobby and navigates to lobby route", async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        code: "AB12",
        playerName: "Alice",
        lobby: {
          code: "AB12",
          hostName: "Alice",
          members: ["Alice"],
          players: [{ name: "Alice", team: "A", ready: false }],
          teams: { A: ["Alice"], B: [] },
          allReady: false,
          settings: { roundCount: 5, roundDurationSeconds: 60 },
        },
      }),
    });

    renderApp();
    await user.type(
      screen.getByLabelText("Your name", { selector: "#create-name" }),
      "Alice",
    );
    await user.click(screen.getByRole("button", { name: "Create Lobby" }));

    await waitFor(() => {
      expect(screen.getByTestId("lobby-page")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Code AB12" }),
      ).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/lobbies",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Alice",
          roundCount: 5,
          roundDurationSeconds: 60,
        }),
      }),
    );
  });

  it("shows API error when join fails", async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({ error: "Lobby not found." }),
    });

    renderApp();
    await user.type(
      screen.getByLabelText("Your name", { selector: "#join-name" }),
      "Bob",
    );
    await user.type(screen.getByLabelText("Lobby code"), "1234");
    await user.click(screen.getByRole("button", { name: "Join Lobby" }));

    await waitFor(() => {
      expect(screen.getByText(/Lobby not found\./i)).toBeInTheDocument();
    });
  });
});
