const { AppError } = require("./appError");

const NAME_PATTERN = /^[A-Za-z0-9 _-]{2,24}$/;
const CODE_PATTERN = /^[A-Z0-9]{4}$/;
const MIN_ROUNDS = 1;
const MAX_ROUNDS = 20;
const MIN_ROUND_SECONDS = 30;
const MAX_ROUND_SECONDS = 300;
const ROUND_SECONDS_STEP = 30;

function normalizePlayerName(input) {
  const name =
    typeof input === "string" ? input.trim().replace(/\s+/g, " ") : "";

  if (!NAME_PATTERN.test(name)) {
    throw new AppError(
      "Invalid player name. Use 2-24 chars: letters, numbers, spaces, _ or -.",
      400,
      "INVALID_NAME",
    );
  }

  return name;
}

function normalizeLobbyCode(input) {
  const code = typeof input === "string" ? input.trim().toUpperCase() : "";

  if (!CODE_PATTERN.test(code)) {
    throw new AppError(
      "Invalid lobby code. Provide exactly 4 letters/numbers.",
      400,
      "INVALID_CODE",
    );
  }

  return code;
}

function normalizeRoundCount(input) {
  const roundCount = Number(input);

  if (!Number.isInteger(roundCount)) {
    throw new AppError(
      "Round count must be an integer.",
      400,
      "INVALID_ROUND_COUNT",
    );
  }

  if (roundCount < MIN_ROUNDS || roundCount > MAX_ROUNDS) {
    throw new AppError(
      `Round count must be between ${MIN_ROUNDS} and ${MAX_ROUNDS}.`,
      400,
      "INVALID_ROUND_COUNT",
    );
  }

  return roundCount;
}

function normalizeRoundDurationSeconds(input) {
  const roundDurationSeconds = Number(input);

  if (!Number.isInteger(roundDurationSeconds)) {
    throw new AppError(
      "Round duration must be an integer number of seconds.",
      400,
      "INVALID_ROUND_DURATION",
    );
  }

  if (
    roundDurationSeconds < MIN_ROUND_SECONDS ||
    roundDurationSeconds > MAX_ROUND_SECONDS ||
    roundDurationSeconds % ROUND_SECONDS_STEP !== 0
  ) {
    throw new AppError(
      `Round duration must be ${MIN_ROUND_SECONDS}-${MAX_ROUND_SECONDS} seconds in ${ROUND_SECONDS_STEP}s increments.`,
      400,
      "INVALID_ROUND_DURATION",
    );
  }

  return roundDurationSeconds;
}

function normalizeGuessText(input) {
  if (typeof input !== "string") {
    return "";
  }

  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

module.exports = {
  normalizePlayerName,
  normalizeLobbyCode,
  normalizeRoundCount,
  normalizeRoundDurationSeconds,
  normalizeGuessText,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_ROUND_SECONDS,
  MAX_ROUND_SECONDS,
  ROUND_SECONDS_STEP,
};
