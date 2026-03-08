const test = require("node:test");
const assert = require("node:assert/strict");

const { createLobbyController } = require("../src/controllers/lobbyController");

function createRes() {
  return {
    statusCode: 0,
    sent: false,
    jsonPayload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send() {
      this.sent = true;
      return this;
    },
    json(payload) {
      this.jsonPayload = payload;
      return this;
    },
  };
}

test("controller create delegates to service and responds", () => {
  const calls = [];
  const lobbyController = createLobbyController({
    lobbyService: {
      createLobby(payload) {
        calls.push(payload);
        return {
          code: "AB12",
          hostName: "Alice",
          members: ["Alice"],
          settings: { roundCount: 5, roundDurationSeconds: 60 },
        };
      },
      joinLobby() {},
      toLobbySnapshot(lobby) {
        return lobby;
      },
      getLobby() {
        return {
          code: "AB12",
          hostName: "Alice",
          members: ["Alice"],
          settings: { roundCount: 5, roundDurationSeconds: 60 },
        };
      },
    },
  });

  const req = { body: { name: "Alice" }, requestId: "r1" };
  const res = createRes();
  let nextCalled = false;

  lobbyController.create(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.jsonPayload, {
    code: "AB12",
    lobby: {
      code: "AB12",
      hostName: "Alice",
      members: ["Alice"],
      settings: { roundCount: 5, roundDurationSeconds: 60 },
    },
  });
  assert.deepEqual(calls, [
    {
      playerName: "Alice",
      roundCount: undefined,
      roundDurationSeconds: undefined,
      requestId: "r1",
    },
  ]);
});

test("controller join delegates to service and responds", () => {
  const calls = [];
  const lobbyController = createLobbyController({
    lobbyService: {
      createLobby() {},
      joinLobby(payload) {
        calls.push(payload);
        return {
          code: "AB12",
          hostName: "Alice",
          members: ["Alice", "Bob"],
          settings: { roundCount: 5, roundDurationSeconds: 60 },
        };
      },
      toLobbySnapshot(lobby) {
        return lobby;
      },
      getLobby() {
        return {
          code: "AB12",
          hostName: "Alice",
          members: ["Alice"],
          settings: { roundCount: 5, roundDurationSeconds: 60 },
        };
      },
    },
  });

  const req = { body: { name: "Bob", code: "AB12" }, requestId: "r2" };
  const res = createRes();
  let nextCalled = false;

  lobbyController.join(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonPayload, {
    code: "AB12",
    lobby: {
      code: "AB12",
      hostName: "Alice",
      members: ["Alice", "Bob"],
      settings: { roundCount: 5, roundDurationSeconds: 60 },
    },
  });
  assert.deepEqual(calls, [
    { playerName: "Bob", lobbyCode: "AB12", requestId: "r2" },
  ]);
});

test("controller getByCode returns lobby snapshot", () => {
  const lobbyController = createLobbyController({
    lobbyService: {
      createLobby() {},
      joinLobby() {},
      getLobby() {
        return {
          code: "AB12",
          hostName: "Alice",
          members: ["Alice"],
          settings: { roundCount: 5, roundDurationSeconds: 60 },
        };
      },
      toLobbySnapshot(lobby) {
        return lobby;
      },
    },
  });

  const req = { params: { code: "AB12" } };
  const res = createRes();

  lobbyController.getByCode(req, res, () => {});

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.jsonPayload, {
    code: "AB12",
    lobby: {
      code: "AB12",
      hostName: "Alice",
      members: ["Alice"],
      settings: { roundCount: 5, roundDurationSeconds: 60 },
    },
  });
});

test("controller forwards service errors to next", () => {
  const expected = new Error("boom");
  const lobbyController = createLobbyController({
    lobbyService: {
      createLobby() {
        throw expected;
      },
      joinLobby() {},
    },
  });

  const req = { body: { name: "Alice" }, requestId: "r1" };
  const res = createRes();
  let nextValue;

  lobbyController.create(req, res, (error) => {
    nextValue = error;
  });

  assert.equal(nextValue, expected);
});
