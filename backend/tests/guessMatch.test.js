const test = require("node:test");
const assert = require("node:assert/strict");

const { evaluateGuessMatch } = require("../src/utils/guessMatch");

test("evaluateGuessMatch: exact case-insensitive", () => {
  assert.equal(evaluateGuessMatch("Volcano", "volcano").kind, "correct");
});

test("evaluateGuessMatch: plural s", () => {
  assert.equal(evaluateGuessMatch("cars", "car").kind, "correct");
  assert.equal(evaluateGuessMatch("car", "cars").kind, "correct");
});

test("evaluateGuessMatch: typo within distance", () => {
  assert.equal(evaluateGuessMatch("volcno", "volcano").kind, "correct");
});

test("evaluateGuessMatch: close feedback", () => {
  const r = evaluateGuessMatch("volcan", "volcano");
  assert.ok(r.kind === "close" || r.kind === "correct");
});

test("evaluateGuessMatch: wrong", () => {
  assert.equal(evaluateGuessMatch("completely", "volcano").kind, "wrong");
});
