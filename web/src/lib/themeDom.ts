import type { Theme } from "./themeStorage";

const THEME_COLOR: Record<Theme, string> = {
  light: "#eef1f5",
  dark: "#0c1121",
};

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = THEME_COLOR[theme];
  }
}
