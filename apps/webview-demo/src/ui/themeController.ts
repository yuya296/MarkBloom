export type Theme = "light" | "dark";

export type ThemeController = {
  setTheme: (theme: Theme) => void;
  toggle: () => void;
  current: () => Theme;
};

export type ThemeControllerOptions = {
  toggle: HTMLButtonElement;
  root?: HTMLElement;
  prefersDarkMatcher?: () => boolean;
};

function defaultPrefersDarkMatcher(): boolean {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function createThemeController(options: ThemeControllerOptions): ThemeController {
  const root = options.root ?? document.documentElement;
  const prefersDarkMatcher = options.prefersDarkMatcher ?? defaultPrefersDarkMatcher;

  const setTheme = (theme: Theme) => {
    root.dataset.theme = theme;
    options.toggle.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  };

  const current = (): Theme => (root.dataset.theme === "dark" ? "dark" : "light");

  const toggle = () => {
    setTheme(current() === "dark" ? "light" : "dark");
  };

  setTheme(prefersDarkMatcher() ? "dark" : "light");
  options.toggle.addEventListener("click", toggle);

  return { setTheme, toggle, current };
}
