import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { applyTheme } from "../lib/themeDom";
import { readSystemTheme, subscribeSystemTheme } from "../lib/systemTheme";
import { readStoredTheme, writeStoredTheme, type Theme } from "../lib/themeStorage";
import type { ThemeContextValue } from "./ThemeContext";

export function useThemeController(): ThemeContextValue {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme);
  const system = useSyncExternalStore(subscribeSystemTheme, readSystemTheme, (): Theme => "light");
  const theme = stored ?? system;

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggle = useCallback(() => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    writeStoredTheme(next);
    setStored(next);
  }, [theme]);

  return { theme, toggle };
}
