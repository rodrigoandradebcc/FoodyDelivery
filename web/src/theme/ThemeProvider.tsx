import type { ReactNode } from "react";
import { ThemeContext } from "./ThemeContext";
import { useThemeController } from "./useThemeController";

export function ThemeProvider({ children }: { children: ReactNode }) {
  const value = useThemeController();
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
