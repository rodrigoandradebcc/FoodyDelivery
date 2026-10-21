import { useCallback, useEffect, useState, type ReactNode } from "react";
import { login as apiLogin } from "../api/auth";
import { setOnUnauthorized, setTokenProvider } from "../api/http";
import { AuthContext } from "./AuthContext";
import { clearStoredToken, readStoredToken, writeStoredToken } from "./authStorage";

setTokenProvider(readStoredToken);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(readStoredToken);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setOnUnauthorized(() => {
      clearStoredToken();
      setToken(null);
      setSessionExpired(true);
    });
    return () => setOnUnauthorized(() => {});
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const res = await apiLogin({ email, password });
    writeStoredToken(res.accessToken, res.expiresIn);
    setToken(res.accessToken);
    setSessionExpired(false);
  }, []);

  const signOut = useCallback(() => {
    clearStoredToken();
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
