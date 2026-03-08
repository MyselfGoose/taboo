const test = require("node:test");
const assert = require("node:assert/strict");

const {
  parseTrustProxy,
  parseAllowedOrigins,
  parsePositiveInt,
} = require("../src/config/env");

test("parseTrustProxy handles booleans and numbers", () => {
  assert.equal(parseTrustProxy("true"), true);
  assert.equal(parseTrustProxy("false"), false);
  assert.equal(parseTrustProxy("2"), 2);
  assert.equal(parseTrustProxy(""), 1);
  assert.equal(parseTrustProxy("invalid"), 1);
});

test("parseAllowedOrigins returns development defaults", () => {
  const result = parseAllowedOrigins("", false);
  assert.equal(Array.isArray(result), true);
  assert.equal(result.length >= 4, true);
});

test("parseAllowedOrigins returns empty list in production by default", () => {
  const result = parseAllowedOrigins("", true);
  assert.deepEqual(result, []);
});

test("parseAllowedOrigins parses comma-separated values", () => {
  const result = parseAllowedOrigins("https://a.com, https://b.com", true);
  assert.deepEqual(result, ["https://a.com", "https://b.com"]);
});

test("parsePositiveInt enforces positive integers", () => {
  assert.equal(parsePositiveInt("10", 5), 10);
  assert.equal(parsePositiveInt("0", 5), 5);
  assert.equal(parsePositiveInt("-1", 5), 5);
  assert.equal(parsePositiveInt("NaN", 5), 5);
});
