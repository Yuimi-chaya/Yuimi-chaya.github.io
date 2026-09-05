import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import path from "node:path";
import sharp from "sharp";

sharp.concurrency(2);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const assets = path.join(here, "assets");
const review = path.join(here, "review");
const report = JSON.parse(await readFile(path.join(assets, "report.json"), "utf8"));
const source = await readFile(path.join(root, report.source));
assert.equal(createHash("sha256").update(source).digest("hex"), report.sourceSha256);
const vector = await readFile(path.join(assets, "subject-vector.svg"));
assert.doesNotMatch(vector.toString(), /<(?:image|foreignObject|script)\b|data:image/i);
assert.match(vector.toString(), /id="light-tone"/);
assert.match(vector.toString(), /id="middle-tone"/);
assert.match(vector.toString(), /id="key-ink"/);
const vectorRaster = await sharp(vector).png().toBuffer();
const hybrid = await readFile(path.join(assets, "subject-hybrid.webp"));
for (const image of [vectorRaster, hybrid]) {
  const metadata = await sharp(image).metadata();
  assert.equal(metadata.width, report.width);
  assert.equal(metadata.height, report.height);
  const pixels = await sharp(image).stats();
  assert.ok(pixels.channels[3].mean > 100 && pixels.channels[3].mean < 245);
  assert.ok(pixels.channels[0].stdev > 20, "Portrait must contain visible linework.");
}
for (const [name, size] of Object.entries(report.files)) {
  assert.equal((await stat(path.join(assets, name))).size, size);
}
const grayscale = (image) => sharp(image)
  .flatten({ background: "white" })
  .extract({ left: 190, top: 200, width: 320, height: 180 })
  .grayscale().raw().toBuffer();
const a = await grayscale(hybrid);
const b = await grayscale(vectorRaster);
let error = 0;
for (let i = 0; i < a.length; i++) error += Math.abs(a[i] - b[i]);
const faceMeanAbsoluteError = error / a.length;
assert.ok(faceMeanAbsoluteError < 35, "Vector face departed too far from the source.");

await mkdir(review, { recursive: true });
const layers = [];
const subjects = [source, hybrid, vectorRaster];
const labels = ["01 / ORIGINAL", "02 / HYBRID", "03 / VECTOR"];
for (let i = 0; i < subjects.length; i++) {
  const frame = await sharp(subjects[i])
    .resize(406, 600, { fit: "contain", background: "#f2f3f2" })
    .flatten({ background: "#f2f3f2" }).png().toBuffer();
  const eyes = await sharp(subjects[i])
    .extract({ left: 190, top: 200, width: 320, height: 180 })
    .resize(406, 228).flatten({ background: "white" }).png().toBuffer();
  layers.push({ input: frame, left: i * 420 + 7, top: 30 });
  layers.push({ input: eyes, left: i * 420 + 7, top: 636 });
  const label = Buffer.from(
    `<svg width="420" height="28"><text x="12" y="20" fill="#111" font-family="Arial" font-size="15">${labels[i]}</text></svg>`,
  );
  layers.push({ input: label, left: i * 420, top: 0 });
}
const comparison = path.join(review, "asset-comparison.jpg");
await sharp({ create: { width: 1260, height: 872, channels: 3, background: "white" } })
  .composite(layers).jpeg({ quality: 85, mozjpeg: true }).toFile(comparison);
const html = await readFile(path.join(here, "index.html"), "utf8").catch(() => null);
if (html) {
  for (const match of html.matchAll(/(?:src|poster|href)="([^"]+)"/g)) {
    const url = match[1];
    if (/^(?:#|https?:|data:)/.test(url)) continue;
    const target = path.resolve(here, url);
    assert.ok((await stat(target)).isFile(), `Missing file: ${url}`);
  }
  new vm.Script(await readFile(path.join(here, "study.js"), "utf8"));
  new vm.Script(await readFile(path.join(assets, "metrics.js"), "utf8"));
  assert.doesNotMatch(html, /<iframe/);
}
const checks = {
  sourceUnchanged: true,
  vectorContainsOnlyShapes: true,
  imagesNonblank: true,
  dimensions: `${report.width}x${report.height}`,
  faceMeanAbsoluteError: Number(faceMeanAbsoluteError.toFixed(3)),
  faceMetricNote: "Grayscale pixel comparison only, not perceptual or browser acceptance.",
  localPreviewReferencesValid: Boolean(html),
  browserValidation: "Not run; human-only visual acceptance requested.",
  comparison: { path: comparison, width: 1260, height: 872, bytes: (await stat(comparison)).size },
};
await writeFile(path.join(review, "checks.json"), JSON.stringify(checks, null, 2) + "\n");
console.log(JSON.stringify(checks, null, 2));
