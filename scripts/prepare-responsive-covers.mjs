import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { selectCoverNames } from "./lib/cover-selection.mjs";

const root = new URL("../public/blog-covers/", import.meta.url);
const output = new URL("responsive/", root);
const manifestPath = new URL("../src/core/content/responsive-covers.json", import.meta.url);
const widths = [320, 640, 960];
const settings = { quality: 94, alphaQuality: 100, smartSubsample: true, effort: 6 };
await mkdir(output, { recursive: true });
let previous = {};
try { previous = JSON.parse(await readFile(manifestPath, "utf8")); } catch {}
const manifest = {};
let generated = 0;
let totalBytes = 0;

// Only manifest-listed covers are accepted by default; new sources require --include=cover-N.webp.
const additions = process.argv.slice(2).map(argument => {
  if (!argument.startsWith("--include=")) throw new Error(`Unknown option: ${argument}`);
  return argument.slice("--include=".length);
});
for (const name of selectCoverNames(previous, additions)) {
  const source = await readFile(new URL(name, root));
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) continue;
  const key = `/blog-covers/${name}`;
  const hash = createHash("sha256").update(source).update(JSON.stringify(settings)).digest("hex").slice(0, 8);
  const opaque = (await sharp(source).stats()).isOpaque;
  const record = { width: metadata.width, height: metadata.height, hash, opaque, variants: [] };
  for (const width of widths.filter(width => width < metadata.width)) {
    const filename = `${name.slice(0, -5)}-${width}-${hash}.webp`;
    const url = new URL(filename, output);
    let data;
    try {
      data = await readFile(url);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      data = await sharp(source).resize({ width, withoutEnlargement: true }).webp(settings).toBuffer();
      if (data.length >= source.length) continue;
      await writeFile(url, data, { flag: "wx" });
      generated++;
    }
    if (data.length >= source.length) continue;
    totalBytes += data.length;
    record.variants.push({ width, src: `/blog-covers/responsive/${filename}`, bytes: data.length });
  }
  manifest[key] = record;
}
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (JSON.stringify(previous) !== JSON.stringify(manifest)) await writeFile(manifestPath, serialized);
console.log(`Responsive covers: ${Object.keys(manifest).length} covers, ${generated} new files, ${(totalBytes / 1024).toFixed(1)} KiB total.`);
