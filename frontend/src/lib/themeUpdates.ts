import { consultarTema, type InstalledTheme } from "./api";

const keys = ["success", "success-bg", "success-hover", "info", "info-bg", "edit", "warning", "danger", "special"]
  .map((key) => `--ls-sem-${key}`);
let current: InstalledTheme | null = null;

function render() {
  const mode = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  for (const key of keys) {
    const value = current?.themes[mode]?.[key];
    if (value && /^#[0-9a-f]{6}$/i.test(value)) document.documentElement.style.setProperty(key, value);
    else document.documentElement.style.removeProperty(key);
  }
}

export function installTheme(state: InstalledTheme) {
  const changed = current?.revision !== state.revision;
  current = state;
  render();
  if (changed) window.dispatchEvent(new CustomEvent("lsassist-theme-installed", { detail: state }));
}

export function watchThemeUpdates() {
  let stopped = false;
  let busy = false;
  let controller: AbortController | null = null;
  const refresh = async () => {
    if (busy || stopped) return;
    busy = true;
    controller = new AbortController();
    try {
      const state = await consultarTema(controller.signal);
      if (!stopped && (!current || state.revision >= current.revision)) installTheme(state);
    } catch { /* Mantém o último tema válido; o painel informa falhas nas ações. */ }
    finally { busy = false; }
  };
  void refresh();
  const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
  window.addEventListener("focus", refresh);
  window.addEventListener("lsassist-theme-change", render);
  return () => {
    stopped = true;
    controller?.abort();
    window.clearInterval(interval);
    window.removeEventListener("focus", refresh);
    window.removeEventListener("lsassist-theme-change", render);
  };
}
