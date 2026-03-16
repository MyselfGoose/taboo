const { createApp, config, logger } = require("./app");
const { createLobbyRealtimeHub } = require("./realtime/lobbyRealtimeHub");

function createNetworkServer(app) {
  const server = app.listen(config.port, () => {
    logger.info("HTTP server listening", {
      event: "server_started",
      protocol: "http",
      port: config.port,
    });
  });

  return server;
}

function configureTimeouts(server) {
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
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

function startServer() {
  const app = createApp();
  const server = createNetworkServer(app);
  const realtimeHub = createLobbyRealtimeHub({
    server,
    lobbyService: app.locals.lobbyService,
    logger,
  });
  configureTimeouts(server);
  setupGracefulShutdown(server, realtimeHub, app.locals.sqliteDatabase);
  return { app, server, realtimeHub };
}

module.exports = {
  startServer,
};
