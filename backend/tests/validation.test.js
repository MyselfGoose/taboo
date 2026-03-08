const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizePlayerName,
  normalizeLobbyCode,
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
