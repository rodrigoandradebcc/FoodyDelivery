import type { Theme } from "./themeStorage";

const QUERY = "(prefers-color-scheme: dark)";

function query(): MediaQueryList | null {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY)
    : null;
}

export function readSystemTheme(): Theme {
  return query()?.matches ? "dark" : "light";
}

export function subscribeSystemTheme(onChange: () => void): () => void {
  const mql = query();
  if (!mql) return () => {};
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}
