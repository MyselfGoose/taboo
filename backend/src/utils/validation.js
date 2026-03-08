const { AppError } = require("./appError");

const NAME_PATTERN = /^[A-Za-z0-9 _-]{2,24}$/;
const CODE_PATTERN = /^[A-Z0-9]{4}$/;

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

module.exports = {
  normalizePlayerName,
  normalizeLobbyCode,
};
