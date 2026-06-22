const STORAGE_KEY = "theme";

const listeners = new Set<() => void>();

function notifyThemeListeners(): void {
  listeners.forEach((listener) => listener());
}

export function getIsDark(): boolean {
  if (typeof window === "undefined") return false;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle("dark", isDark);
}

export function setTheme(isDark: boolean): void {
  localStorage.setItem(STORAGE_KEY, isDark ? "dark" : "light");
  applyTheme(isDark);
  notifyThemeListeners();
}

export function subscribeTheme(callback: () => void): () => void {
  listeners.add(callback);

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback();
  };

  mq.addEventListener("change", callback);
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(callback);
    mq.removeEventListener("change", callback);
    window.removeEventListener("storage", onStorage);
  };
}
