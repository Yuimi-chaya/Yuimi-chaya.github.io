import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const workspace = fileURLToPath(new URL("../", import.meta.url));
const source = path.join(workspace, "kisara", "engage kiss.png");
const target = path.join(workspace, "public/themes/kisara/assets/blog/engage-kiss-poster-ambient-v2.webp");
const original = await readFile(source);
const metadata = await sharp(original).metadata();
if (metadata.width !== 1920 || metadata.height !== 1300) {
  throw new Error("Unexpected Blog background source geometry");
}
// Bake the blur once so the full viewport does not need a live blur filter.
const output = await sharp(original)
  .resize({ width: 1440, withoutEnlargement: true })
  .blur(22)
  .webp({ quality: 84, effort: 6 })
  .toBuffer();
await mkdir(path.dirname(target), { recursive: true });
try {
  await writeFile(target, output, { flag: "wx" });
} catch (error) {
  if (error.code !== "EEXIST" || !(await readFile(target)).equals(output)) throw error;
}
console.log(JSON.stringify({
  source: path.relative(workspace, source),
  sha256: createHash("sha256").update(original).digest("hex"),
  output: path.relative(workspace, target),
  width: 1440, height: 975, blur: 22, bytes: output.length,
}));
