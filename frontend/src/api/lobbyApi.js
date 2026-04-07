const FALLBACK_API_BASE_URL = "http://127.0.0.1:3000";

function resolveApiBaseUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // Dev + browser: same origin so Vite proxies /api and avoids CORS (localhost vs 127.0.0.1).
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  if (
    import.meta.env.PROD &&
    typeof window !== "undefined" &&
    window.location?.origin
  ) {
    return window.location.origin;
  }
  return FALLBACK_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

const CATEGORY_CACHE_TTL_MS = 30 * 1000;
let categoriesCache = null;
let categoriesCacheExpiresAt = 0;
let categoriesInFlight = null;

function toWebSocketBaseUrl(httpBaseUrl) {
  if (httpBaseUrl.startsWith("https://")) {
    return `wss://${httpBaseUrl.slice("https://".length)}`;
  }

  if (httpBaseUrl.startsWith("http://")) {
    return `ws://${httpBaseUrl.slice("http://".length)}`;
  }

  return httpBaseUrl;
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  return null;
}

function toErrorMessage(status, payload, fallback) {
  const message =
    payload && typeof payload.error === "string" ? payload.error : fallback;
  return `${message} (HTTP ${status})`;
}

export async function createLobby({
  name,
  roundCount,
  roundDurationSeconds,
  categoryMode,
  categoryIds,
}) {
  const response = await fetch(`${API_BASE_URL}/api/lobbies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      roundCount,
      roundDurationSeconds,
      categoryMode,
      categoryIds,
    }),
  });

  const payload = await parseApiResponse(response);

  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.status, payload, "Could not create lobby"),
    );
  }

  if (!payload || typeof payload.code !== "string" || !payload.lobby) {
    throw new Error("Create lobby response is missing lobby data");
  }

  return payload;
}

export async function getCategories() {
  const now = Date.now();
  if (categoriesCache && categoriesCacheExpiresAt > now) {
    return categoriesCache;
  }

  if (categoriesInFlight) {
    return categoriesInFlight;
  }

  categoriesInFlight = (async () => {
    const response = await fetch(`${API_BASE_URL}/api/categories`);
    const payload = await parseApiResponse(response);

    if (!response.ok) {
      const retryAfterSeconds = response.headers.get("retry-after");
      const retryHint =
        response.status === 429 && retryAfterSeconds
          ? ` Retry after ${retryAfterSeconds}s.`
          : "";
      throw new Error(
        `${toErrorMessage(response.status, payload, "Could not fetch categories")}${retryHint}`,
      );
    }

    if (!payload || !Array.isArray(payload.categories)) {
      throw new Error("Categories response is missing required data");
    }

    categoriesCache = payload.categories;
    categoriesCacheExpiresAt = Date.now() + CATEGORY_CACHE_TTL_MS;
    return categoriesCache;
  })();

  try {
    return await categoriesInFlight;
  } finally {
    categoriesInFlight = null;
  }
}

export async function joinLobby(name, code) {
  const response = await fetch(`${API_BASE_URL}/api/lobbies/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, code }),
  });

  const payload = await parseApiResponse(response);

  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.status, payload, "Could not join lobby"),
    );
  }

  if (!payload || !payload.lobby) {
    throw new Error("Join lobby response is missing lobby data");
  }

  return payload;
}

export async function getLobby(code) {
  const response = await fetch(`${API_BASE_URL}/api/lobbies/${code}`);
  const payload = await parseApiResponse(response);

  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.status, payload, "Could not fetch lobby"),
    );
  }

  return payload;
}

export async function restoreSession({ code, resumeToken }) {
  const response = await fetch(`${API_BASE_URL}/api/sessions/restore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code, resumeToken }),
  });

  const payload = await parseApiResponse(response);

  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.status, payload, "Could not restore session"),
    );
  }

  if (
    !payload ||
    !payload.lobby ||
    !payload.playerName ||
    !payload.resumeToken
  ) {
    throw new Error("Restore session response is missing required data");
  }

  return payload;
}

export function getLobbyWebSocketUrl() {
  if (import.meta.env.VITE_API_BASE_URL) {
    return `${toWebSocketBaseUrl(import.meta.env.VITE_API_BASE_URL)}/ws`;
  }
  if (import.meta.env.DEV && typeof window !== "undefined") {
    const { protocol, host } = window.location;
    const wsProto = protocol === "https:" ? "wss" : "ws";
    return `${wsProto}://${host}/ws`;
  }
  return `${toWebSocketBaseUrl(API_BASE_URL)}/ws`;
}

export async function getRecentMatches({ limit = 10 } = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/matches/recent?limit=${encodeURIComponent(limit)}`,
  );
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.status, payload, "Could not load recent matches"),
    );
  }
  return payload?.matches ?? [];
}

export async function getLeaderboard({ limit = 20 } = {}) {
  const response = await fetch(
    `${API_BASE_URL}/api/leaderboard?limit=${encodeURIComponent(limit)}`,
  );
  const payload = await parseApiResponse(response);
  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.status, payload, "Could not load leaderboard"),
    );
  }
  return {
    highScores: payload?.highScores ?? [],
    topPlayers: payload?.topPlayers ?? [],
  };
}
