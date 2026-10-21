import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearStoredToken, readStoredToken, writeStoredToken } from "./authStorage";

const KEY = "foody.auth";

function createLocalStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    has: (key: string) => data.has(key),
    put: (key: string, value: string) => void data.set(key, value),
  };
}

describe("authStorage", () => {
  let storage: ReturnType<typeof createLocalStorage>;

  beforeEach(() => {
    storage = createLocalStorage();
    vi.stubGlobal("localStorage", storage);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reads back a token written with a future expiry", () => {
    writeStoredToken("abc", 3600);
    expect(readStoredToken()).toBe("abc");
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredToken()).toBeNull();
  });

  it("returns null and removes the entry once the token expired", () => {
    writeStoredToken("abc", 60);
    vi.setSystemTime(new Date("2026-10-17T12:01:00Z"));
    expect(readStoredToken()).toBeNull();
    expect(storage.has(KEY)).toBe(false);
  });

  it("returns null for malformed JSON", () => {
    storage.put(KEY, "{not json");
    expect(readStoredToken()).toBeNull();
  });

  it("returns null and removes the entry when the token is not a string", () => {
    storage.put(KEY, JSON.stringify({ token: 1, expiresAt: Date.now() + 60_000 }));
    expect(readStoredToken()).toBeNull();
    expect(storage.has(KEY)).toBe(false);
  });

  it("clears the stored token", () => {
    writeStoredToken("abc", 3600);
    clearStoredToken();
    expect(readStoredToken()).toBeNull();
  });
});
