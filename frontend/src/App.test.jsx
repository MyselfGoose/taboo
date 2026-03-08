import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import App from "./App";

describe("App lobby flow", () => {
  beforeEach(() => {
    global.fetch = vi.fn();

    class MockWebSocket {
      static instances = [];

      constructor() {
        this.listeners = new Map();
        MockWebSocket.instances.push(this);
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

      removeEventListener(type, listener) {
        this.listeners.get(type)?.delete(listener);
      }

      dispatch(type, event = {}) {
        const handlers = this.listeners.get(type) || [];
        for (const handler of handlers) {
          handler(event);
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

  it("renders landing options and hides code preview on create panel", () => {
    render(<App />);

    expect(
      screen.getByRole("tab", { name: "Create Game" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Join Game" })).toBeInTheDocument();
    expect(screen.queryByText("Suggested Lobby Code")).not.toBeInTheDocument();
  });

  it("sanitizes join code input to uppercase alphanumeric and max length 4", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("tab", { name: "Join Game" }));

    const codeInput = screen.getByLabelText("4-Digit Lobby Code");
    await user.type(codeInput, "a!b1c2");

    expect(codeInput).toHaveValue("AB1C");
  });

  it("creates lobby and navigates to lobby screen with generated code", async () => {
    const user = userEvent.setup();
    global.fetch.mockResolvedValueOnce({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => ({
        code: "AB12",
        lobby: {
          code: "AB12",
          members: ["Alice"],
          memberCount: 1,
          settings: { roundCount: 5, roundDurationSeconds: 60 },
        },
      }),
    });

    render(<App />);
    await user.type(screen.getByLabelText("Your Name"), "Alice");
    await user.click(screen.getByRole("button", { name: "Create New Lobby" }));

    await waitFor(() => {
      expect(screen.getByText("Joining Code")).toBeInTheDocument();
      expect(screen.getByText("AB12")).toBeInTheDocument();
      expect(screen.getByText("Team A")).toBeInTheDocument();
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

    render(<App />);
    await user.click(screen.getByRole("tab", { name: "Join Game" }));
    await user.type(screen.getByLabelText("Your Name"), "Bob");
    await user.type(screen.getByLabelText("4-Digit Lobby Code"), "ZZZZ");
    await user.click(screen.getByRole("button", { name: "Join Lobby" }));

    await waitFor(() => {
      expect(screen.getByText(/Lobby not found/)).toBeInTheDocument();
    });
  });

  it("shows rounds and round-time options on create panel", () => {
    render(<App />);

    expect(screen.getByLabelText("Rounds")).toBeInTheDocument();
    expect(screen.getByLabelText("Round Time")).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "30 seconds" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "300 seconds" }),
    ).toBeInTheDocument();
  });
});
