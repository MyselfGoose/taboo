const fs = require("node:fs");
const https = require("node:https");
const process = require("node:process");
const express = require("express");
const helmet = require("helmet");
const compression = require("compression");

const app = express();

const isProduction = process.env.NODE_ENV === "production";
const port = Number(process.env.PORT) || 3000;

// Respect reverse proxy headers (e.g. on Render/Heroku/Fly/nginx) so req.secure is correct.
const trustProxySetting = process.env.TRUST_PROXY;
if (trustProxySetting === "true") {
  app.set("trust proxy", true);
} else if (trustProxySetting === "false") {
  app.set("trust proxy", false);
} else {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");
app.use(
  helmet({
    hsts: isProduction,
  }),
);
app.use(compression());
app.use(express.json({ limit: "1mb" }));

// Enforce HTTPS in production even when TLS is terminated at a proxy.
app.use((req, res, next) => {
  if (!isProduction) {
    return next();
  }

  // Keep health checks reachable if a platform probes over internal HTTP.
  if (req.path === "/health" || req.path === "/ready") {
    return next();
  }

  const forwardedProto = req.get("x-forwarded-proto");
  const firstForwardedProto = forwardedProto
    ? forwardedProto.split(",")[0].trim()
    : undefined;
  const isHttps = req.secure || firstForwardedProto === "https";

  if (isHttps) {
    return next();
  }

  const host = req.get("host");
  if (!host) {
    return res.status(400).json({ error: "Invalid Host header" });
  }

  return res.redirect(308, `https://${host}${req.originalUrl}`);
});

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

app.get("/ready", (_req, res) => {
  res.status(200).json({ ready: true });
});

app.get("/", (_req, res) => {
  res.status(200).json({
    service: "taboo-backend",
    status: "running",
    environment: process.env.NODE_ENV || "development",
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled request error", err);
  res.status(500).json({ error: "Internal server error" });
});

function startServer() {
  const certPath = process.env.SSL_CERT_PATH;
  const keyPath = process.env.SSL_KEY_PATH;

  if ((certPath && !keyPath) || (!certPath && keyPath)) {
    throw new Error(
      "Both SSL_CERT_PATH and SSL_KEY_PATH must be set together for HTTPS.",
    );
  }

  if (certPath && keyPath) {
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

    server.keepAliveTimeout = 65000;
    server.headersTimeout = 66000;

    server.listen(port, () => {
      console.log(`HTTPS server listening on port ${port}`);
    });

    return server;
  }

  const server = app.listen(port, () => {
    console.log(`HTTP server listening on port ${port}`);
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;

  return server;
}

const server = startServer();

function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);

  server.close((err) => {
    if (err) {
      console.error("Error while closing server", err);
      process.exit(1);
      return;
    }

    console.log("Server closed.");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

module.exports = app;
