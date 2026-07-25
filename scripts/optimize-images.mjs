import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const jobs = [
  {
    dir: "public",
    files: "all",
    maxWidth: 1920,
    quality: 78
  }
];

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".gif"]);

async function existingImages(job) {
  const absoluteDir = path.join(root, job.dir);
  if (job.files !== "all") {
    return job.files.map((file) => path.join(absoluteDir, file));
  }

  const images = [];
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
      } else if (imageExtensions.has(path.extname(entry.name).toLowerCase())) {
        images.push(absolutePath);
      }
    }
  }

  await walk(absoluteDir);
  return images;
}

async function optimizeImage(input, { maxWidth, quality }) {
  const parsed = path.parse(input);
  const output = path.join(parsed.dir, `${parsed.name}.webp`);
  const isAnimatedSource = parsed.ext.toLowerCase() === ".gif";
  const image = sharp(input, { failOn: "none", animated: isAnimatedSource });
  const metadata = await image.metadata();
  const width = metadata.width && metadata.width > maxWidth ? maxWidth : metadata.width;

  let outputStat;
  try {
    outputStat = await stat(output);
  } catch {
    outputStat = null;
  }

  const sourceStat = await stat(input);
  if (outputStat && outputStat.mtimeMs >= sourceStat.mtimeMs) {
    return;
  }

  const webpOptions = isAnimatedSource
    ? { quality, effort: 6, loop: metadata.loop ?? 0 }
    : metadata.hasAlpha
    ? { lossless: true, effort: 6 }
    : { quality, effort: 6 };

  await image
    .resize(width ? { width, withoutEnlargement: true } : undefined)
    .webp(webpOptions)
    .toFile(output);

  outputStat = await stat(output);
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
