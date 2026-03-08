function requestLogger({ logger }) {
  return (req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      logger.info("Request completed", {
        event: "http_request",
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - start,
        ip: req.ip,
      });
    });

    next();
  };
}

module.exports = {
  requestLogger,
};
