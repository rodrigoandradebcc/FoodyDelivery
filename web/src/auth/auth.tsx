import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router";
import { login as apiLogin } from "../api/auth";
import { setOnUnauthorized, setTokenProvider } from "../api/http";

const STORAGE_KEY = "foody.auth";

interface StoredAuth {
  token: string;
  expiresAt: number;
}

function readStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredAuth;
    if (typeof stored.token !== "string" || Date.now() >= stored.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.token;
  } catch {
    return null;
  }
}

setTokenProvider(readStoredToken);

interface AuthContextValue {
  isAuthenticated: boolean;
  sessionExpired: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setOnUnauthorized(() => {
      localStorage.removeItem(STORAGE_KEY);
      setToken(null);
      setSessionExpired(true);
    });
    return () => setOnUnauthorized(() => {});
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiLogin({ email, password });
    const stored: StoredAuth = {
      token: res.accessToken,
      expiresAt: Date.now() + res.expiresIn * 1000,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    setToken(res.accessToken);
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setSessionExpired(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{ isAuthenticated: token !== null, sessionExpired, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
