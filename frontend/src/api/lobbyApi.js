const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:3000";

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

export async function createLobby(name) {
  const response = await fetch(`${API_BASE_URL}/api/lobbies`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  const payload = await parseApiResponse(response);

  if (!response.ok) {
    throw new Error(
      toErrorMessage(response.status, payload, "Could not create lobby"),
    );
  }

  if (!payload || typeof payload.code !== "string") {
    throw new Error("Create lobby response is missing code");
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
}
