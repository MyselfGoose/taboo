const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const WebSocket = require("ws");
const request = require("supertest");

const { createApp } = require("../src/app");
const { createLobbyRealtimeHub } = require("../src/realtime/lobbyRealtimeHub");

function waitForMessage(ws, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Timed out waiting for websocket message"));
    }, timeoutMs);

    const onMessage = (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString("utf8"));
      } catch (_error) {
        return;
      }

      if (!predicate(message)) {
        return;
      }

      cleanup();
      resolve(message);
    };

    const onError = (error) => {
      cleanup();
      reject(error);
    };

    function cleanup() {
      clearTimeout(timer);
      ws.off("message", onMessage);
      ws.off("error", onError);
    }

    ws.on("message", onMessage);
    ws.on("error", onError);
  });
}

test("websocket broadcasts lobby member updates in real time", async () => {
  const app = createApp();
  const server = http.createServer(app);
  const realtimeHub = createLobbyRealtimeHub({
    server,
    lobbyService: app.locals.lobbyService,
    logger: { info() {}, warn() {}, error() {} },
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;

  const httpAgent = request(`http://127.0.0.1:${port}`);

  const created = await httpAgent
    .post("/api/lobbies")
    .send({ name: "Host", roundCount: 5, roundDurationSeconds: 60 })
    .set("Content-Type", "application/json");

  assert.equal(created.status, 201);

  const hostSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((resolve, reject) => {
    hostSocket.once("open", resolve);
    hostSocket.once("error", reject);
  });

  hostSocket.send(
    JSON.stringify({
      type: "subscribe",
      code: created.body.code,
      name: "Host",
    }),
  );

  await waitForMessage(hostSocket, (msg) => msg.type === "subscribed");

  await httpAgent
    .post("/api/lobbies/join")
    .send({ name: "Bob", code: created.body.code })
    .set("Content-Type", "application/json");

  const bobSocket = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  await new Promise((resolve, reject) => {
    bobSocket.once("open", resolve);
    bobSocket.once("error", reject);
  });

  bobSocket.send(
    JSON.stringify({
      type: "subscribe",
      code: created.body.code,
      name: "Bob",
    }),
  );

  const joinedState = await waitForMessage(
    hostSocket,
    (msg) =>
      msg.type === "lobby_state" &&
      msg.lobby &&
      msg.lobby.members.includes("Host") &&
      msg.lobby.members.includes("Bob"),
  );

  assert.equal(joinedState.lobby.memberCount, 2);

  bobSocket.send(JSON.stringify({ type: "change_team", team: "A" }));

  const teamChangedState = await waitForMessage(
    hostSocket,
    (msg) =>
      msg.type === "lobby_state" &&
      msg.reason === "team_changed" &&
      msg.lobby &&
      msg.lobby.players.some(
        (player) => player.name === "Bob" && player.team === "A",
      ),
  );

  assert.equal(
    teamChangedState.lobby.players.some(
      (player) => player.name === "Bob" && player.team === "A",
    ),
    true,
  );

  bobSocket.send(JSON.stringify({ type: "set_ready", ready: true }));

  const readyChangedState = await waitForMessage(
    hostSocket,
    (msg) =>
      msg.type === "lobby_state" &&
      msg.reason === "ready_changed" &&
      msg.lobby &&
      msg.lobby.players.some(
        (player) => player.name === "Bob" && player.ready === true,
      ),
  );

  assert.equal(
    readyChangedState.lobby.players.some(
      (player) => player.name === "Bob" && player.ready === true,
    ),
    true,
  );

  bobSocket.close();

  const leftState = await waitForMessage(
    hostSocket,
    (msg) =>
      msg.type === "lobby_state" &&
      msg.lobby &&
      msg.lobby.members.includes("Host") &&
      !msg.lobby.members.includes("Bob"),
  );

  assert.equal(leftState.lobby.memberCount, 1);

  hostSocket.close();
  realtimeHub.close();
  await new Promise((resolve) => server.close(resolve));
});
