const fs = require("node:fs");
const https = require("node:https");

const { createApp, config, logger } = require("./app");

function createNetworkServer(app) {
  const certPath = config.sslCertPath;
  const keyPath = config.sslKeyPath;

  if ((certPath && !keyPath) || (!certPath && keyPath)) {
    throw new Error(
      "Both SSL_CERT_PATH and SSL_KEY_PATH must be set together for HTTPS.",
    );
  }

  if (!certPath || !keyPath) {
    const server = app.listen(config.port, () => {
      logger.info("HTTP server listening", {
        event: "server_started",
        protocol: "http",
        port: config.port,
      });
    });

    return server;
  }

  let cert;
  let key;

  try {
    cert = fs.readFileSync(certPath);
    key = fs.readFileSync(keyPath);
  } catch (error) {
    throw new Error(
      `Failed to read SSL certificate/key files: ${error.message}`,
    );
  }

  const server = https.createServer({ cert, key }, app);
  server.listen(config.port, () => {
    logger.info("HTTPS server listening", {
      event: "server_started",
      protocol: "https",
      port: config.port,
    });
  });

  return server;
}

function configureTimeouts(server) {
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

function setupGracefulShutdown(server) {
  const shutdown = (signal) => {
    logger.info("Shutdown signal received", {
      event: "shutdown_signal",
      signal,
    });

    server.close((error) => {
      if (error) {
        logger.error("Error while closing server", {
          event: "shutdown_error",
          signal,
          message: error.message,
        });
        process.exit(1);
        return;
      }

      logger.info("Server closed", { event: "server_closed", signal });
      process.exit(0);
    });

    setTimeout(() => {
      logger.error("Forced shutdown after timeout", {
        event: "shutdown_forced",
        signal,
      });
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

function startServer() {
  const app = createApp();
  const server = createNetworkServer(app);
  configureTimeouts(server);
  setupGracefulShutdown(server);
  return { app, server };
}

module.exports = {
  startServer,
};
