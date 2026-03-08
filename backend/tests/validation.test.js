const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizePlayerName,
  normalizeLobbyCode,
  normalizeRoundCount,
  normalizeRoundDurationSeconds,
} = require("../src/utils/validation");
const { AppError } = require("../src/utils/appError");

test("normalizePlayerName trims and collapses whitespace", () => {
  const result = normalizePlayerName("   Alice    Cooper   ");
  assert.equal(result, "Alice Cooper");
});

test("normalizePlayerName accepts valid boundary lengths", () => {
  assert.equal(normalizePlayerName("Ab"), "Ab");
  assert.equal(normalizePlayerName("A".repeat(24)), "A".repeat(24));
});

test("normalizePlayerName rejects invalid names", () => {
  const invalidInputs = ["", "A", "@alice", "A".repeat(25), null, undefined];

  for (const value of invalidInputs) {
    assert.throws(
      () => normalizePlayerName(value),
      (error) => error instanceof AppError && error.code === "INVALID_NAME",
    );
  }
});

test("normalizeLobbyCode uppercases valid values", () => {
  assert.equal(normalizeLobbyCode("ab12"), "AB12");
  assert.equal(normalizeLobbyCode("  9z9z  "), "9Z9Z");
});

test("normalizeLobbyCode rejects malformed codes", () => {
  const invalidInputs = ["abc", "abcde", "a-12", "12 4", "!!!!", null];

  for (const value of invalidInputs) {
    assert.throws(
      () => normalizeLobbyCode(value),
      (error) => error instanceof AppError && error.code === "INVALID_CODE",
    );
  }
});

test("normalizeRoundCount accepts valid values", () => {
  assert.equal(normalizeRoundCount(1), 1);
  assert.equal(normalizeRoundCount(20), 20);
  assert.equal(normalizeRoundCount("8"), 8);
});

test("normalizeRoundCount rejects invalid values", () => {
  const invalid = [0, 21, 1.5, "abc", null];

  for (const value of invalid) {
    assert.throws(
      () => normalizeRoundCount(value),
      (error) =>
        error instanceof AppError && error.code === "INVALID_ROUND_COUNT",
    );
  }
});

test("normalizeRoundDurationSeconds accepts valid 30-second increments", () => {
  assert.equal(normalizeRoundDurationSeconds(30), 30);
  assert.equal(normalizeRoundDurationSeconds(300), 300);
  assert.equal(normalizeRoundDurationSeconds("120"), 120);
});

test("normalizeRoundDurationSeconds rejects invalid values", () => {
  const invalid = [0, 15, 301, 75, "abc", null];

  for (const value of invalid) {
    assert.throws(
      () => normalizeRoundDurationSeconds(value),
      (error) =>
        error instanceof AppError && error.code === "INVALID_ROUND_DURATION",
    );
  }
});
