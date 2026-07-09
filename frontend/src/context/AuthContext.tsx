/**
 * Auth context: holds the current user + token and exposes login/logout.
 *
 * Token lives in React state only (no localStorage) for the skeleton — a
 * deliberate, safe default. Hardening to httpOnly cookies is a later step noted
 * in the security roadmap.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { api, setAuthToken, type User } from "../api/client";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    const { access_token } = await api.login(email, password);
    setAuthToken(access_token);
    setToken(access_token);
    setUser(await api.me());
  }, []);

  const register = useCallback(
    async (email: string, password: string, fullName?: string) => {
      await api.register(email, password, fullName);
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, token, isAuthenticated: user !== null, login, register, logout }),
    [user, token, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
