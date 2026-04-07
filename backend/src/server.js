const http = require("node:http");

const { createApp, config, logger } = require("./app");
const { createLobbyRealtimeHub } = require("./realtime/lobbyRealtimeHub");

function resolveListenHost() {
  if (process.env.HOST !== undefined) {
    return process.env.HOST === "" ? undefined : process.env.HOST;
  }
  return config.isProduction ? undefined : "127.0.0.1";
}

function startServer() {
  const app = createApp();
  const server = http.createServer(app);
  const listenHost = resolveListenHost();

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      logger.error(
        `Port ${config.port} is already in use. Stop the other process (e.g. lsof -i :${config.port}) or set PORT to a free port.`,
        {
          event: "listen_eaddrinuse",
          port: config.port,
          host: listenHost,
        },
      );
    } else {
      logger.error("HTTP server error", {
        event: "listen_error",
        message: error.message,
        code: error.code,
      });
    }
    process.exit(1);
  });

  const realtimeHub = createLobbyRealtimeHub({
    server,
    lobbyService: app.locals.lobbyService,
    logger,
    config,
  });

  server.listen(config.port, listenHost, () => {
    const addr = server.address();
    logger.info("HTTP server listening", {
      event: "server_started",
      protocol: "http",
      port: typeof addr === "object" && addr ? addr.port : config.port,
      host: typeof addr === "object" && addr ? addr.address : listenHost,
    });
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  setupGracefulShutdown(server, realtimeHub, app.locals.sqliteDatabase);
  return { app, server, realtimeHub };
}

function setupGracefulShutdown(server, realtimeHub, sqliteDatabase) {
  const shutdown = (signal) => {
    logger.info("Shutdown signal received", {
      event: "shutdown_signal",
      signal,
    });

    if (realtimeHub) {
      realtimeHub.close();
    }

    if (sqliteDatabase) {
      sqliteDatabase.close();
    }

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

module.exports = {
  startServer,
};
