const { normalizeGuessText } = require("./validation");

const MAX_MATCH_LENGTH = 64;

/**
 * Levenshtein distance with early exit if distance exceeds maxDistance.
 * @returns {number} distance, or maxDistance + 1 if exceeded
 */
function levenshteinBounded(a, b, maxDistance) {
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > maxDistance) {
    return maxDistance + 1;
  }
  if (lenA === 0) {
    return lenB;
  }
  if (lenB === 0) {
    return lenA;
  }

  let previous = new Array(lenB + 1);
  for (let j = 0; j <= lenB; j += 1) {
    previous[j] = j;
  }

  for (let i = 1; i <= lenA; i += 1) {
    let left = i;
    let rowMin = i;
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const above = previous[j] + 1;
      const diag = previous[j - 1] + cost;
      const cell = Math.min(left + 1, above, diag);
      previous[j - 1] = left;
      left = cell;
      if (cell < rowMin) {
        rowMin = cell;
      }
    }
    previous[lenB] = left;
    if (rowMin > maxDistance) {
      return maxDistance + 1;
    }
  }

  return previous[lenB];
}

/** Full distance for short strings (Taboo answers are small). */
function levenshteinShort(a, b) {
  const lenA = a.length;
  const lenB = b.length;
  const row = new Array(lenB + 1);
  for (let j = 0; j <= lenB; j += 1) {
    row[j] = j;
  }
  for (let i = 1; i <= lenA; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= lenB; j += 1) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[lenB];
}

function pluralMatch(guess, answer) {
  if (guess === answer) {
    return true;
  }
  const g = guess.length;
  const an = answer.length;
  if (g < 3 || an < 3) {
    return false;
  }
  const longer = g >= an ? guess : answer;
  const shorter = g >= an ? answer : guess;
  if (longer === `${shorter}s`) {
    return true;
  }
  if (longer === `${shorter}es` && shorter.length >= 2) {
    return true;
  }
  if (
    longer.endsWith("s") &&
    !longer.endsWith("ss") &&
    longer.slice(0, -1) === shorter
  ) {
    return true;
  }
  if (
    longer.endsWith("es") &&
    longer.length >= 3 &&
    longer.slice(0, -2) === shorter
  ) {
    return true;
  }
  return false;
}

function maxDistanceForLength(len) {
  if (len <= 6) {
    return 1;
  }
  if (len <= 12) {
    return 2;
  }
  return 1;
}

function commonPrefixLength(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) {
    i += 1;
  }
  return i;
}

/**
 * @param {string} rawGuess
 * @param {string} rawAnswer
 * @returns {{ kind: 'correct' } | { kind: 'close'; distance: number } | { kind: 'wrong' }}
 */
function evaluateGuessMatch(rawGuess, rawAnswer) {
  const guess = normalizeGuessText(rawGuess);
  const answer = normalizeGuessText(rawAnswer);

  if (!guess || !answer) {
    return { kind: "wrong" };
  }

  if (guess.length > MAX_MATCH_LENGTH || answer.length > MAX_MATCH_LENGTH) {
    return guess === answer ? { kind: "correct" } : { kind: "wrong" };
  }

  if (guess === answer) {
    return { kind: "correct" };
  }

  if (pluralMatch(guess, answer)) {
    return { kind: "correct" };
  }

  const maxDist = maxDistanceForLength(answer.length);
  const quick = levenshteinBounded(guess, answer, maxDist);
  if (quick <= maxDist) {
    return { kind: "correct" };
  }

  const dist =
    guess.length + answer.length > 80
      ? levenshteinBounded(guess, answer, maxDist + 3)
      : levenshteinShort(guess, answer);

  const justMissed = dist === maxDist + 1;
  const prefix = commonPrefixLength(guess, answer);
  const similarStart = prefix >= 3 && dist <= maxDist + 2;

  if (justMissed || similarStart) {
    return { kind: "close", distance: dist };
  }

  return { kind: "wrong" };
}

module.exports = {
  evaluateGuessMatch,
  levenshteinBounded,
  pluralMatch,
  MAX_MATCH_LENGTH,
};
