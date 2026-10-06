import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { getMe } from "../api/authApi.js";
import { clearSession, readSession, writeSession } from "../api/session.js";

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => readSession());
  // Set when a revalidation attempt settled without producing a profile. Kept
  // separate from `session` so a network failure is distinguishable from an
  // expired token — the first is retryable, the second is not.
  const [sessionError, setSessionError] = useState(null);
  const [isRevalidating, setIsRevalidating] = useState(false);

  const revalidate = useCallback(async () => {
    if (!readSession()?.accessToken) return;
    setIsRevalidating(true);
    setSessionError(null);
    try {
      const user = await getMe();
      if (!user) return;
      setSession((prev) => {
        if (!prev) return prev;
        const next = { ...prev, user };
        writeSession(next);
        return next;
      });
      setSessionError(null);
    } catch (err) {
      // Network hiccup: keep serving the cached session. The interceptor clears
      // it and redirects on its own if the server actually rejects the token, so
      // reaching here means we simply don't know yet — stay put and offer a
      // retry rather than bouncing the user to the login screen.
      setSessionError(err);
    } finally {
      setIsRevalidating(false);
    }
  }, []);

  // Revalidate the stored profile once on load. A 401 anywhere (including this
  // call) is handled by the axios interceptor, which clears the session.
  useEffect(() => {
    if (!readSession()?.accessToken) return;
    revalidate();
  }, [revalidate]);

  /**
   * Persist fresh tokens immediately (so the interceptor can attach them),
   * then fetch the profile with the new token and merge it into the session.
   * Resolves with the UserOut so callers can route by role.
   */
  const login = useCallback(async (tokens) => {
    const draft = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      user: null,
    };
    writeSession(draft);
    setSession(draft);
    setSessionError(null);
    const user = await getMe();
    setSession((prev) => {
      const next = { ...(prev ?? draft), user };
      writeSession(next);
      return next;
    });
    return user;
  }, []);

  const setUser = useCallback((user) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user };
      writeSession(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setSession(null);
    setSessionError(null);
  }, []);

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated: Boolean(session?.accessToken),
      // False only while restoring/revalidating an existing session. Settling
      // without a profile counts as ready — otherwise an offline load with a
      // token but no cached user would spin here forever.
      isSessionReady: !session || Boolean(session.user) || Boolean(sessionError),
      sessionError,
      isRevalidating,
      retrySession: revalidate,
      login,
      logout,
      setUser,
    }),
    [session, sessionError, isRevalidating, revalidate, login, logout, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
