import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { deleteToken, getToken, setToken } from "./tokenStore";
import type { AuthResponse, UserDto } from "@paizeis/shared";
import { auth as authApi } from "../api/endpoints";
import { registerForPush } from "../notifications";
import { configureAuth } from "../api/client";

/**
 * Session state for the app. Token storage is delegated to tokenStore, which
 * uses the Keychain on device and localStorage in the browser preview.
 */
const ACCESS_KEY = "paizeis.accessToken";
const REFRESH_KEY = "paizeis.refreshToken";

interface AuthState {
  user: UserDto | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  // Kept in refs as well as storage: the API client reads them on every
  // request, and awaiting the keychain each time would be needless latency.
  const accessToken = useRef<string | null>(null);
  const refreshToken = useRef<string | null>(null);

  const persist = useCallback(async (session: AuthResponse) => {
    accessToken.current = session.accessToken;
    refreshToken.current = session.refreshToken;
    await setToken(ACCESS_KEY, session.accessToken);
    await setToken(REFRESH_KEY, session.refreshToken);
    setUser(session.user);

    // Register for push now that there is an account to attach the token to.
    // Fire and forget, and never surface a rejection: push is a nicety, and
    // failing to get a token must not interrupt signing in.
    registerForPush().catch(() => {});
  }, []);

  const clear = useCallback(async () => {
    accessToken.current = null;
    refreshToken.current = null;
    await deleteToken(ACCESS_KEY);
    await deleteToken(REFRESH_KEY);
    setUser(null);
  }, []);

  /**
   * Called by the API client when a request comes back 401. Exchanges the
   * refresh token and hands back a new access token so the request can be
   * retried without the person noticing.
   */
  const renew = useCallback(async (): Promise<string | null> => {
    const token = refreshToken.current;
    if (!token) return null;
    try {
      const session = await authApi.refresh(token);
      await persist(session);
      return session.accessToken;
    } catch {
      await clear();
      return null;
    }
  }, [persist, clear]);

  useEffect(() => {
    configureAuth(async () => accessToken.current, renew);
  }, [renew]);

  // Restore a session on launch, so returning users skip the sign-in screen.
  useEffect(() => {
    (async () => {
      try {
        const [stored, storedRefresh] = await Promise.all([
          getToken(ACCESS_KEY),
          getToken(REFRESH_KEY),
        ]);
        accessToken.current = stored;
        refreshToken.current = storedRefresh;

        if (storedRefresh) {
          // Refresh rather than trusting the stored access token, which has
          // almost certainly expired since the app was last open.
          const session = await authApi.refresh(storedRefresh);
          await persist(session);
        }
      } catch {
        await clear();
      } finally {
        setLoading(false);
      }
    })();
  }, [persist, clear]);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => persist(await authApi.signIn({ email, password })),
      register: async (email, password, fullName) =>
        persist(await authApi.register({ email, password, fullName })),
      signOut: async () => {
        const token = refreshToken.current;
        await clear();
        if (token) await authApi.signOut(token).catch(() => {});
      },
    }),
    [user, loading, persist, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
