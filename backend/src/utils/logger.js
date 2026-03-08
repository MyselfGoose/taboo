const process = require("node:process");

function emit(level, message, metadata = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...metadata,
  };

  const line = JSON.stringify(payload);

  if (level === "error" || level === "warn") {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
}

const logger = {
  info(message, metadata) {
    emit("info", message, metadata);
  },
  warn(message, metadata) {
    emit("warn", message, metadata);
  },
  error(message, metadata) {
    emit("error", message, metadata);
  },
};

module.exports = {
  logger,
};
