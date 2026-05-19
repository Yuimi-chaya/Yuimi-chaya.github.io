import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const jobs = [
  {
    dir: "public/assets",
    files: ["hero-wallpaper.jpg", "fuyukawa-kagari-bg.png"],
    maxWidth: 1920,
    quality: 76
  },
  {
    dir: "public/blog-covers",
    files: "all",
    maxWidth: 1400,
    quality: 74
  },
  {
    dir: "public/blog-assets/astrbot-napcat-baota",
    files: "all",
    maxWidth: 1440,
    quality: 78
  }
];

const imageExtensions = new Set([".jpg", ".jpeg", ".png"]);

async function existingImages(job) {
  const absoluteDir = path.join(root, job.dir);
  const entries =
    job.files === "all"
      ? await readdir(absoluteDir)
      : job.files;

  return entries
    .filter((file) => imageExtensions.has(path.extname(file).toLowerCase()))
    .map((file) => path.join(absoluteDir, file));
}

async function optimizeImage(input, { maxWidth, quality }) {
  const parsed = path.parse(input);
  const output = path.join(parsed.dir, `${parsed.name}.webp`);
  const image = sharp(input, { failOn: "none" });
  const metadata = await image.metadata();
  const width = metadata.width && metadata.width > maxWidth ? maxWidth : metadata.width;

  await image
    .resize(width ? { width, withoutEnlargement: true } : undefined)
    .webp({ quality, effort: 6 })
    .toFile(output);

  const [sourceStat, outputStat] = await Promise.all([stat(input), stat(output)]);
  const saved = sourceStat.size ? 1 - outputStat.size / sourceStat.size : 0;
  console.log(
    `${path.relative(root, input)} -> ${path.relative(root, output)} ` +
      `(${Math.round(sourceStat.size / 1024)}KB -> ${Math.round(outputStat.size / 1024)}KB, ` +
      `${Math.round(saved * 100)}% smaller)`
  );
}

for (const job of jobs) {
  const images = await existingImages(job);
  for (const image of images) {
    await optimizeImage(image, job);
  }
}
