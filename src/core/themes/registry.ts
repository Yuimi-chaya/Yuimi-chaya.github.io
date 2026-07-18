export const THEME_STORAGE_KEY = "yuimi-theme-id-v1";
export const DEFAULT_THEME_ID = "fuyukawa-kagari";

export const themes = [
  {
    id: "fuyukawa-kagari",
    label: "Fuyukawa Kagari",
    description: "现有的 Fuyukawa Kagari 二次元手账主题",
    routePrefix: ""
  },
  {
    id: "blank",
    label: "Blank",
    description: "独立、轻量的空白主题骨架",
    routePrefix: "/themes/blank"
  }
] as const;

export type ThemeId = (typeof themes)[number]["id"];

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && themes.some((theme) => theme.id === value);
}

export function getTheme(themeId: ThemeId) {
  return themes.find((theme) => theme.id === themeId) ?? themes[0];
}

function withLeadingSlash(pathname: string) {
  if (!pathname) return "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

export function getCanonicalPath(pathname: string) {
  const normalized = withLeadingSlash(pathname);
  const prefixedThemes = [...themes]
    .filter((theme) => theme.routePrefix)
    .sort((a, b) => b.routePrefix.length - a.routePrefix.length);

  for (const theme of prefixedThemes) {
    if (normalized === theme.routePrefix || normalized === `${theme.routePrefix}/`) return "/";
    if (normalized.startsWith(`${theme.routePrefix}/`)) {
      return normalized.slice(theme.routePrefix.length) || "/";
    }
  }

  return normalized;
}

export function getThemePath(themeId: ThemeId, pathname: string) {
  const canonicalPath = getCanonicalPath(pathname);
  const theme = getTheme(themeId);

  if (!theme.routePrefix) return canonicalPath;
  if (canonicalPath === "/") return `${theme.routePrefix}/`;
  return `${theme.routePrefix}${canonicalPath}`;
}
