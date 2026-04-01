export type ThemeMode =
  | "default"
  | "christmas"
  | "sky-pink"
  | "monochrome"
  | "matcha-core"
  | "royal-purple"
  | "summer-beach";

export const isThemeMode = (value: string): value is ThemeMode =>
  value === "default" ||
  value === "christmas" ||
  value === "sky-pink" ||
  value === "monochrome" ||
  value === "matcha-core" ||
  value === "royal-purple" ||
  value === "summer-beach";

export const getStoredTheme = (): ThemeMode => {
  const storedTheme = localStorage.getItem("textodon.theme");
  if (storedTheme && isThemeMode(storedTheme)) {
    return storedTheme;
  }
  return localStorage.getItem("textodon.christmas") === "on" ? "christmas" : "default";
};

export type ColorScheme = "system" | "light" | "dark";

export const isColorScheme = (value: string): value is ColorScheme =>
  value === "system" || value === "light" || value === "dark";

export const getStoredColorScheme = (): ColorScheme => {
  const storedScheme = localStorage.getItem("textodon.colorScheme");
  if (storedScheme && isColorScheme(storedScheme)) {
    return storedScheme;
  }
  return "system";
};
