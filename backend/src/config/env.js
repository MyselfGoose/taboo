const process = require("node:process");

function parseTrustProxy(value) {
  if (value === undefined || value === null || value === "") {
    return 1;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  const asNumber = Number(value);
  if (Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }

  return 1;
}

function parseAllowedOrigins(value, isProduction) {
  if (!value) {
    if (isProduction) {
      return [];
    }

    return [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function parsePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";

const config = {
  nodeEnv,
  isProduction,
  port: parsePositiveInt(process.env.PORT, 3000),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  sslCertPath: process.env.SSL_CERT_PATH,
  sslKeyPath: process.env.SSL_KEY_PATH,
  allowedOrigins: parseAllowedOrigins(
    process.env.ALLOWED_ORIGINS,
    isProduction,
  ),
  lobbyCodeLength: parsePositiveInt(process.env.LOBBY_CODE_LENGTH, 4),
  lobbyMaxGenerateAttempts: parsePositiveInt(
    process.env.LOBBY_CODE_MAX_ATTEMPTS,
    50,
  ),
  lobbyTtlMs: parsePositiveInt(process.env.LOBBY_TTL_MINUTES, 120) * 60 * 1000,
  maxActiveLobbies: parsePositiveInt(process.env.MAX_ACTIVE_LOBBIES, 20000),
};

module.exports = {
  config,
  parseTrustProxy,
  parseAllowedOrigins,
  parsePositiveInt,
};
