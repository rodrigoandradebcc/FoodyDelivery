const STORAGE_KEY = "foody.auth";

interface StoredAuth {
  token: string;
  expiresAt: number;
}

export function readStoredToken(): string | null {
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

export function writeStoredToken(token: string, expiresInSeconds: number): void {
  const stored: StoredAuth = {
    token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function clearStoredToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}
