const SESSION_KEY = "canteen.session.v1";

/**
 * The persisted session shape:
 * { accessToken, refreshToken, user }
 * `user` may briefly be null between token issuance and the /auth/me fetch.
 */
export function readSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.accessToken) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    if (!session) {
      window.localStorage.removeItem(SESSION_KEY);
      return;
    }
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage unavailable (private mode etc.) — session lives in memory only.
  }
}

export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore.
  }
}
