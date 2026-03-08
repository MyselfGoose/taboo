const express = require("express");

function createHealthRouter({ config }) {
  const router = express.Router();

  router.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, uptime: process.uptime() });
  });

  router.get("/ready", (_req, res) => {
    res.status(200).json({ ready: true });
  });

  router.get("/", (_req, res) => {
    res.status(200).json({
      service: "taboo-backend",
      status: "running",
      environment: config.nodeEnv,
    });
  });

  return router;
}

module.exports = {
  createHealthRouter,
};
