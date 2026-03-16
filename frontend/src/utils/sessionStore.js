const STORAGE_KEY = "taboo-session-v1";

function getStorage() {
  // Use sessionStorage so each browser tab has its own isolated session.
  // This prevents multi-tab collisions where all tabs share one player identity.
  const storage = window?.sessionStorage;

  if (!storage) {
    return null;
  }

  if (
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }

  return storage;
}

export function saveSession(session) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  if (!session?.code || !session?.playerName || !session?.resumeToken) {
    return;
  }

  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      code: session.code,
      playerId: session.playerId || null,
      playerName: session.playerName,
      resumeToken: session.resumeToken,
      savedAt: Date.now(),
    }),
  );
}

export function loadSession() {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.code || !parsed?.playerName || !parsed?.resumeToken) {
      return null;
    }

    return parsed;
  } catch (_error) {
    return null;
  }
}

export function clearSession() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(STORAGE_KEY);
}
