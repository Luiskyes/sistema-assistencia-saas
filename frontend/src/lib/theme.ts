export type Theme = "light" | "dark";

const STORAGE_KEY = "lsassist-theme";

export function getInitialTheme(): Theme {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(STORAGE_KEY, theme);
  window.dispatchEvent(
    new CustomEvent<Theme>("lsassist-theme-change", { detail: theme }),
  );
}

export function initializeTheme() {
  applyTheme(getInitialTheme());
}
