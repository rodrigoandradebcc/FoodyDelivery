import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "matchMedia",
    (query: string) => ({
      matches: query.includes("min-width"),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
