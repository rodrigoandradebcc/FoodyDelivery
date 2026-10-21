import { afterEach, describe, expect, it, vi } from "vitest";
import { readStoredTheme, writeStoredTheme } from "./themeStorage";

function stubStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  });
  return data;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("themeStorage", () => {
  it("lê um tema válido", () => {
    stubStorage({ "foody.theme": "dark" });
    expect(readStoredTheme()).toBe("dark");
    stubStorage({ "foody.theme": "light" });
    expect(readStoredTheme()).toBe("light");
  });

  it("retorna null quando não há valor", () => {
    stubStorage();
    expect(readStoredTheme()).toBeNull();
  });

  it("ignora valor inválido", () => {
    stubStorage({ "foody.theme": "sepia" });
    expect(readStoredTheme()).toBeNull();
  });

  it("grava o tema escolhido", () => {
    const data = stubStorage();
    writeStoredTheme("dark");
    expect(data.get("foody.theme")).toBe("dark");
  });

  it("tolera storage que lança", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });
    expect(readStoredTheme()).toBeNull();
    expect(() => writeStoredTheme("light")).not.toThrow();
  });
});
