const themeRoot = "/themes/fuyukawa-kagari";

export function kagariAsset(path: string) {
  return `${themeRoot}/assets/${path.replace(/^\/+/, "")}`;
}

export const kagariAssets = {
  favicon: kagariAsset("pig-favicon.png"),
  appleTouchIcon: kagariAsset("pig-apple-touch.png"),
  brand: kagariAsset("pig-brand.png"),
  scrollPig: kagariAsset("mini-pig-scroll.png"),
  profile: kagariAsset("profile.jpg"),
  heroWallpaper: kagariAsset("hero-wallpaper.webp"),
  pageBackground: kagariAsset("fuyukawa-kagari-bg.webp"),
  notFound: kagariAsset("legacy/404.jpg"),
  musicManifest: `${themeRoot}/music/manifest.json`
} as const;

