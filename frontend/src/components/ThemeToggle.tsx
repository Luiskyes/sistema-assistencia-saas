import { useEffect, useState } from "react";

import { applyTheme, getInitialTheme, type Theme } from "../lib/theme";

type ThemeToggleProps = {
  compact?: boolean;
};

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());

  useEffect(() => {
    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<Theme>;
      setTheme(customEvent.detail);
    };

    window.addEventListener("lsassist-theme-change", handleThemeChange);
    return () =>
      window.removeEventListener("lsassist-theme-change", handleThemeChange);
  }, []);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const label =
    nextTheme === "dark" ? "Ativar modo escuro" : "Ativar modo claro";

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? "theme-toggle-compact" : ""}`}
      onClick={() => applyTheme(nextTheme)}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {theme === "dark" ? (
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24">
            <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.7 6.7 0 0 0 21 12.8Z" />
          </svg>
        )}
      </span>
      {!compact ? (
        <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
      ) : null}
    </button>
  );
}
