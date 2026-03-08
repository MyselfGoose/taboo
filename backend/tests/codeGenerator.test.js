const test = require("node:test");
const assert = require("node:assert/strict");

const {
  DEFAULT_ALPHABET,
  generateUniqueCode,
} = require("../src/utils/codeGenerator");

test("generateUniqueCode returns correct length and alphabet characters", () => {
  const code = generateUniqueCode({
    length: 4,
    maxAttempts: 10,
    isTaken: () => false,
  });

  assert.equal(code.length, 4);
  assert.match(code, /^[A-Z0-9]{4}$/);

  for (const char of code) {
    assert.equal(DEFAULT_ALPHABET.includes(char), true);
  }
});

test("generateUniqueCode retries on taken code", () => {
  const seen = new Set();
  const firstAccepted = generateUniqueCode({
    length: 4,
    maxAttempts: 50,
    isTaken: (code) => {
      if (seen.size < 3) {
        seen.add(code);
        return true;
      }
      return false;
    },
    alphabet: "ABCD1234",
  });

  assert.equal(firstAccepted.length, 4);
});

test("generateUniqueCode throws after max attempts", () => {
  assert.throws(
    () =>
      generateUniqueCode({
        length: 4,
        maxAttempts: 3,
        isTaken: () => true,
      }),
    /Unable to generate a unique lobby code/,
  );
});
