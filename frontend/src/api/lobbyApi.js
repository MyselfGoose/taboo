const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000";

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

export async function createLobby({ name, roundCount, roundDurationSeconds }) {
  const response = await fetch(`${API_BASE_URL}/api/lobbies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, roundCount, roundDurationSeconds }),
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

export function getLobbyWebSocketUrl() {
  return `${toWebSocketBaseUrl(API_BASE_URL)}/ws`;
}
