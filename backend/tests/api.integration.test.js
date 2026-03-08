const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp, config } = require("../src/app");

test("GET /health returns service health payload", async () => {
  const app = createApp();

  const response = await request(app).get("/health");

  assert.equal(response.status, 200);
  assert.equal(response.body.ok, true);
  assert.equal(typeof response.body.uptime, "number");
});

test("GET / returns service metadata", async () => {
  const app = createApp();

  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.equal(response.body.service, "taboo-backend");
  assert.equal(response.body.status, "running");
});

test("POST /api/lobbies creates lobby and returns code payload", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/lobbies")
    .send({ name: "Alice" })
    .set("Content-Type", "application/json");

  assert.equal(response.status, 201);
  assert.match(response.body.code, /^[A-Z0-9]{4}$/);
});

test("production mode redirects non-HTTPS requests", async () => {
  const previous = config.isProduction;

  config.isProduction = true;
  try {
    const app = createApp();
    const response = await request(app)
      .get("/api/any-endpoint")
      .set("host", "taboo.example")
      .set("x-forwarded-proto", "http");

    assert.equal(response.status, 308);
    assert.equal(
      response.headers.location,
      "https://taboo.example/api/any-endpoint",
    );
  } finally {
    config.isProduction = previous;
  }
});

test("POST /api/lobbies rejects invalid name", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/lobbies")
    .send({ name: "@" })
    .set("Content-Type", "application/json");

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_NAME");
});

test("POST /api/lobbies/join joins an existing lobby", async () => {
  const app = createApp();

  const createResponse = await request(app)
    .post("/api/lobbies")
    .send({ name: "Host" })
    .set("Content-Type", "application/json");

  assert.equal(createResponse.status, 201);
  assert.match(createResponse.body.code, /^[A-Z0-9]{4}$/);

  const joinResponse = await request(app)
    .post("/api/lobbies/join")
    .send({ name: "Bob", code: createResponse.body.code })
    .set("Content-Type", "application/json");

  assert.equal(joinResponse.status, 204);
  assert.equal(joinResponse.text, "");
});

test("POST /api/lobbies creates unique codes across consecutive calls", async () => {
  const app = createApp();

  const first = await request(app)
    .post("/api/lobbies")
    .send({ name: "Alice" })
    .set("Content-Type", "application/json");
  const second = await request(app)
    .post("/api/lobbies")
    .send({ name: "Bob" })
    .set("Content-Type", "application/json");

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.notEqual(first.body.code, second.body.code);
});

test("POST /api/lobbies/join returns 400 for malformed code", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/lobbies/join")
    .send({ name: "Bob", code: "12" })
    .set("Content-Type", "application/json");

  assert.equal(response.status, 400);
  assert.equal(response.body.code, "INVALID_CODE");
});

test("POST /api/lobbies/join returns 404 for missing lobby", async () => {
  const app = createApp();

  const response = await request(app)
    .post("/api/lobbies/join")
    .send({ name: "Bob", code: "AB12" })
    .set("Content-Type", "application/json");

  assert.equal(response.status, 404);
  assert.equal(response.body.code, "LOBBY_NOT_FOUND");
});

test("request id header is always present", async () => {
  const app = createApp();

  const response = await request(app).get("/health");

  assert.equal(typeof response.headers["x-request-id"], "string");
  assert.equal(response.headers["x-request-id"].length > 0, true);
});
