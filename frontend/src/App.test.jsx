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
    if (typeof window?.localStorage?.removeItem === "function") {
      window.localStorage.removeItem("taboo-session-v1");
    }
    global.fetch = vi.fn();
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/categories")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            categories: [
              {
                categoryId: 1,
                category: "Classic",
                wordCount: 100,
                selectable: true,
              },
            ],
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
      });
    });

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

  it("renders create and join tabs on landing page", async () => {
    renderApp();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Create Game/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Join Game/i }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });
  });

  it("sanitizes join code input to uppercase alphanumeric and max length 4", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /Join Game/i }));
    await waitFor(() => {
      expect(
        screen.getByLabelText(/Lobby Code/i, { selector: "#join-code" }),
      ).toBeInTheDocument();
    });
    const codeInput = screen.getByLabelText(/Lobby Code/i);
    await user.type(codeInput, "a!b1c2");

    expect(codeInput).toHaveValue("AB1C");
  });

  it("creates lobby and navigates to lobby route", async () => {
    const user = userEvent.setup();
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/categories")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            categories: [
              {
                categoryId: 1,
                category: "Classic",
                wordCount: 100,
                selectable: true,
              },
            ],
          }),
        });
      }

      if (String(url).includes("/api/lobbies")) {
        return Promise.resolve({
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
              settings: {
                roundCount: 5,
                roundDurationSeconds: 60,
                categoryMode: "single",
                categoryIds: [1],
                categoryNames: ["Classic"],
              },
              game: null,
            },
          }),
        });
      }

      return Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
      });
    });

    renderApp();
    await user.type(
      screen.getByLabelText(/Your Name/i, { selector: "#create-name" }),
      "Alice",
    );
    await user.click(screen.getByRole("button", { name: "Create Lobby" }));

    await waitFor(() => {
      expect(screen.getByTestId("lobby-page")).toBeInTheDocument();
      expect(screen.getByText("AB12")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:3000/api/lobbies",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Alice",
          roundCount: 5,
          roundDurationSeconds: 60,
          categoryMode: "single",
          categoryIds: [1],
        }),
      }),
    );
  });

  it("shows API error when join fails", async () => {
    const user = userEvent.setup();
    global.fetch.mockImplementation((url) => {
      if (String(url).includes("/api/categories")) {
        return Promise.resolve({
          ok: true,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({
            categories: [
              {
                categoryId: 1,
                category: "Classic",
                wordCount: 100,
                selectable: true,
              },
            ],
          }),
        });
      }

      if (String(url).includes("/api/lobbies/join")) {
        return Promise.resolve({
          ok: false,
          status: 404,
          headers: new Headers({ "content-type": "application/json" }),
          json: async () => ({ error: "Lobby not found." }),
        });
      }

      return Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
      });
    });

    renderApp();
    await user.click(screen.getByRole("button", { name: /Join Game/i }));
    await waitFor(() => {
      expect(
        screen.getByLabelText(/Your Name/i, { selector: "#join-name" }),
      ).toBeInTheDocument();
    });
    await user.type(
      screen.getByLabelText(/Your Name/i, { selector: "#join-name" }),
      "Bob",
    );
    await user.type(screen.getByLabelText(/Lobby Code/i), "1234");
    await user.click(screen.getByRole("button", { name: "Join Lobby" }));

    await waitFor(() => {
      expect(screen.getByText(/Lobby not found\./i)).toBeInTheDocument();
    });
  });
});
