const { AppError } = require("../utils/appError");

function errorHandler({ logger }) {
  return (err, req, res, _next) => {
    const isAppError = err instanceof AppError;
    const statusCode = isAppError ? err.statusCode : 500;

    logger.error("Request failed", {
      event: "http_error",
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode,
      code: isAppError ? err.code : "UNHANDLED_ERROR",
      message: err.message,
    });

    if (res.headersSent) {
      return;
    }

    const payload = {
      error: statusCode >= 500 ? "Internal server error" : err.message,
      code: isAppError ? err.code : "INTERNAL_ERROR",
    };

    res.status(statusCode).json(payload);
  };
}

module.exports = {
  errorHandler,
};
