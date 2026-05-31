import { ref, watch } from "vue";

// Shared dark-theme state for every demo page (the neutral landing and the
// per-framework landings). Persists the choice to localStorage and falls back
// to the OS preference on first visit.
const THEME_STORAGE_KEY = "dxf-vuer-demo:dark-theme";

const readSavedTheme = (): boolean | null => {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "1") return true;
    if (v === "0") return false;
  } catch {
    /* localStorage may be unavailable (private mode, sandboxed iframe) */
  }
  return null;
};

export function useDarkTheme() {
  const isDark = ref(
    readSavedTheme() ?? window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  watch(
    isDark,
    (dark) => {
      document.documentElement.style.backgroundColor = dark ? "#121212" : "";
      document.body.style.backgroundColor = "";
      try {
        localStorage.setItem(THEME_STORAGE_KEY, dark ? "1" : "0");
      } catch {
        /* ignore */
      }
    },
    { immediate: true },
  );

  return { isDark };
}
