import { useTheme } from "../theme/useTheme";
import { MoonIcon } from "./icons/MoonIcon";
import { SunIcon } from "./icons/SunIcon";

interface ThemeToggleProps {
  className?: string;
  labelClassName?: string;
  iconClassName?: string;
}

export function ThemeToggle({ className, labelClassName, iconClassName }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button type="button" className={className} onClick={toggle}>
      {dark ? <SunIcon className={iconClassName} /> : <MoonIcon className={iconClassName} />}
      <span className={labelClassName}>{dark ? "Ativar tema claro" : "Ativar tema escuro"}</span>
    </button>
  );
}
