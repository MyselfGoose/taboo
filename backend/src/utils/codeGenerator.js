const crypto = require("node:crypto");

const DEFAULT_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateRandomCode(length, alphabet = DEFAULT_ALPHABET) {
  let value = "";
  for (let i = 0; i < length; i += 1) {
    const index = crypto.randomInt(0, alphabet.length);
    value += alphabet[index];
  }
  return value;
}

function generateUniqueCode({
  length,
  maxAttempts,
  isTaken,
  alphabet = DEFAULT_ALPHABET,
}) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = generateRandomCode(length, alphabet);
    if (!isTaken(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to generate a unique lobby code after max attempts.");
}

module.exports = {
  DEFAULT_ALPHABET,
  generateUniqueCode,
};
