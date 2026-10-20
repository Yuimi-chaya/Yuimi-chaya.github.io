import { kagariAsset } from "../assets";

const images = {
  "festival-cover": [750, 1050],
  "afternoon-cover": [800, 1130],
  "together-cover": [800, 1130],
  "notebook-page": [700, 1013],
  "workshop-page": [625, 850],
  "playroom-page": [700, 1013],
  "letter-page": [625, 850],
  "fireworks-page": [625, 850],
  "reading-strip": [653, 430],
  "workshop-strip": [580, 305],
  "playroom-strip": [644, 480],
  "hand-note": [570, 252],
  "kagari-tea": [280, 510],
  "haruto-gift": [280, 540],
  "festival-pair": [490, 569],
  "kagari-thinking": [328, 512],
  "haruto-thinking": [263, 596],
  "haruto-reading": [284, 588],
  "haruto-cat": [369, 503],
  "kagari-schoolbag": [288, 519],
  "kagari-soba": [361, 429],
  "kagari-sleeve": [477, 449],
  "kagari-cozy": [269, 460],
  "kagari-rest": [533, 377],
  "hero-character": [1920, 1080],
  "hero-manga": [1920, 1080]
} as const;

export type MangaImage = keyof typeof images;
export const mangaArt = (name: MangaImage) => ({
  src: kagariAsset(`manga/${name}.webp`),
  width: images[name][0],
  height: images[name][1]
});
