const express = require("express");
const helmet = require("helmet");
const compression = require("compression");
const cors = require("cors");
const { rateLimit } = require("express-rate-limit");

const { config } = require("./config/env");
const { logger } = require("./utils/logger");
const {
  InMemoryLobbyRepository,
} = require("./repositories/inMemoryLobbyRepository");
const {
  SqliteLobbyRepository,
} = require("./repositories/sqliteLobbyRepository");
const {
  InMemorySessionRepository,
} = require("./repositories/inMemorySessionRepository");
const {
  SqliteSessionRepository,
} = require("./repositories/sqliteSessionRepository");
const { createSqliteSessionDatabase } = require("./database/sqlite");
const { DatasetService } = require("./services/datasetService");
const { LobbyService } = require("./services/lobbyService");
const { createLobbyController } = require("./controllers/lobbyController");
const { requestIdMiddleware } = require("./middleware/requestId");
const { requestLogger } = require("./middleware/requestLogger");
const { errorHandler } = require("./middleware/errorHandler");
const { notFoundMiddleware } = require("./middleware/notFound");
const { createHealthRouter } = require("./routes/healthRoutes");
const { createLobbyRouter } = require("./routes/lobbyRoutes");

function createCorsOptions() {
  return {
    origin(origin, callback) {
  console.log("Incoming origin:", origin)
  console.log("Allowed origins:", config.allowedOrigins)

  if (!origin) return callback(null, true)

  if (!config.isProduction) return callback(null, true)

  if (
    config.allowedOrigins.includes("*") ||
    config.allowedOrigins.includes(origin) ||
    origin.endsWith(".vercel.app")
  ) {
    return callback(null, true)
  }

  console.log("❌ BLOCKED BY CORS:", origin)
  return callback(null, false)
}
    methods: ["GET", "POST", "OPTIONS"],
    optionsSuccessStatus: 204,
  };
}

function createRepositories() {
  const useSqliteDatabase = config.useSqliteSessions || config.useSqliteLobbies;

  if (!useSqliteDatabase) {
    return {
      lobbyRepository: new InMemoryLobbyRepository(),
      sessionRepository: new InMemorySessionRepository(),
      sqliteDatabase: null,
    };
  }

  const { db } = createSqliteSessionDatabase({ config });

  return {
    lobbyRepository: config.useSqliteLobbies
      ? new SqliteLobbyRepository({ db })
      : new InMemoryLobbyRepository(),
    sessionRepository: config.useSqliteSessions
      ? new SqliteSessionRepository({ db })
      : new InMemorySessionRepository(),
    sqliteDatabase: db,
  };
}

function createApp() {
  const app = express();

  const { lobbyRepository, sessionRepository, sqliteDatabase } =
    createRepositories();
  const datasetService = new DatasetService({ config, logger });
  const lobbyService = new LobbyService({
    repository: lobbyRepository,
    sessionRepository,
    datasetService,
    logger,
    config,
  });

  const lobbyController = createLobbyController({ lobbyService });
  app.locals.lobbyService = lobbyService;
  app.locals.sqliteDatabase = sqliteDatabase;

  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");

  app.use(
    helmet({
      hsts: config.isProduction,
    }),
  );
  app.use(cors(createCorsOptions()));
  app.use(compression());
  app.use(express.json({ limit: "1mb" }));

  app.use(requestIdMiddleware);
  app.use(requestLogger({ logger }));

  app.use(createHealthRouter({ config }));

  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 120,
    standardHeaders: true,
    legacyHeaders: false,
  });

  const lobbyLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use("/api", apiLimiter);
  app.post("/api/lobbies", lobbyLimiter);
  app.post("/api/lobbies/join", lobbyLimiter);
  app.post("/api/sessions/restore", lobbyLimiter);
  app.use("/api", createLobbyRouter({ lobbyController }));

  app.use(notFoundMiddleware);
  app.use(errorHandler({ logger }));

  return app;
}

module.exports = {
  createApp,
  config,
  logger,
};
