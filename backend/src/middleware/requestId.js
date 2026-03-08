const crypto = require("node:crypto");

function requestIdMiddleware(req, res, next) {
  const requestId = req.get("x-request-id") || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
}

module.exports = {
  requestIdMiddleware,
};
