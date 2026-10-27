import { createHash } from 'node:crypto';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public/themes/kisara/assets/game-shake-easter.mp4');
const expectedSourceHash = 'a591a983cba28f245686c57bd6cf771fededa76b259807024fe97d67eff674ce';
const sourceTime = 8.5;
const sourceFrame = { index: 204, time: 8.5085 };
const crop = { left: 320, top: 272, width: 1280, height: 544 };
const review = process.argv.includes('--review');
const outputRoot = review
  ? tmpdir()
  : path.join(root, 'public/themes/kisara/assets/blog');
const prefix = review ? `kisara-wordmark-extraction-review-${process.pid}-` : 'engage-kiss-wordmark-';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const clamp = (number) => Math.min(1, Math.max(0, number));

const sourceBytes = await readFile(source);
if (hash(sourceBytes) !== expectedSourceHash) {
  throw new Error('Source video changed; review extraction coordinates before continuing.');
}
const probe = JSON.parse(execFileSync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', source,
], { encoding: 'utf8', windowsHide: true }));
const stream = probe.streams?.[0];
if (stream?.width !== 1920 || stream?.height !== 1080 || stream?.r_frame_rate !== '24000/1001') {
  throw new Error('Unexpected source dimensions or frame rate.');
}
const rgb = execFileSync('ffmpeg', [
  '-hide_banner', '-loglevel', 'error', '-ss', String(sourceTime), '-i', source,
  '-vf', `crop=${crop.width}:${crop.height}:${crop.left}:${crop.top}`,
  '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1',
], { maxBuffer: crop.width * crop.height * 4, windowsHide: true });
const pixelCount = crop.width * crop.height;
if (rgb.length !== pixelCount * 3) throw new Error('Incomplete decoded frame.');

function componentSupport(predicate, minimumArea, radius, close = false) {
  const seeds = new Uint8Array(pixelCount);
  const visited = new Uint8Array(pixelCount);
  const kept = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    seeds[index] = predicate(rgb[index * 3], rgb[index * 3 + 1], rgb[index * 3 + 2]) ? 1 : 0;
  }
  for (let index = 0; index < pixelCount; index += 1) {
    if (!seeds[index] || visited[index]) continue;
    const queue = [index];
    visited[index] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      const x = current % crop.width;
      const y = Math.floor(current / crop.width);
      for (const neighbor of [
        x > 0 ? current - 1 : -1,
        x + 1 < crop.width ? current + 1 : -1,
        y > 0 ? current - crop.width : -1,
        y + 1 < crop.height ? current + crop.width : -1,
      ]) {
        if (neighbor < 0 || !seeds[neighbor] || visited[neighbor]) continue;
        visited[neighbor] = 1;
        queue.push(neighbor);
      }
    }
    if (queue.length >= minimumArea) {
      for (const current of queue) kept[current] = 1;
    }
  }
  const support = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    if (!kept[index]) continue;
    const x = index % crop.width;
    const y = Math.floor(index / crop.width);
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (x + dx < 0 || x + dx >= crop.width || y + dy < 0 || y + dy >= crop.height) continue;
        support[(y + dy) * crop.width + x + dx] = 1;
      }
    }
  }
  if (!close) return support;
  const closed = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    if (!support[index]) continue;
    const x = index % crop.width;
    const y = Math.floor(index / crop.width);
    let complete = true;
    for (let dy = -radius; dy <= radius && complete; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (x + dx < 0 || x + dx >= crop.width || y + dy < 0 || y + dy >= crop.height
          || !support[(y + dy) * crop.width + x + dx]) {
          complete = false;
          break;
        }
      }
    }
    if (complete) closed[index] = 1;
  }
  return closed;
}

// Connected source pixels retain the logo's detached squares while rejecting the star field.
const isWhite = (r, g, b) => Math.min(r, g, b) > 140
  && Math.max(r, g, b) - Math.min(r, g, b) < 45;
const whiteSupport = componentSupport(isWhite, 100, 2);
// Close only the thin pink interruptions inside an existing source letter.
const whiteUnderPinkSupport = componentSupport(isWhite, 100, 8, true);
const pinkSupport = componentSupport(
  (r, g, b) => r > 120 && r - g > 65 && b - g > 25,
  30, 3,
);
const white = Buffer.alloc(pixelCount * 4);
const script = Buffer.alloc(pixelCount * 4);
for (let index = 0; index < pixelCount; index += 1) {
  const r = rgb[index * 3];
  const g = rgb[index * 3 + 1];
  const b = rgb[index * 3 + 2];
  const offset = index * 4;
  // Chroma survives the pink stroke crossing both the black field and white letters.
  const pinkAlpha = pinkSupport[index] ? clamp((r - g) / 185) : 0;
  const whiteContribution = clamp((g - pinkAlpha * 61) / 255);
  const whiteAlpha = whiteSupport[index] || (pinkSupport[index] && whiteUnderPinkSupport[index])
    ? clamp(whiteContribution / Math.max(1 - pinkAlpha, 1 / 255))
    : 0;
  if (whiteAlpha > 0.025) {
    white[offset] = 255;
    white[offset + 1] = 255;
    white[offset + 2] = 255;
    white[offset + 3] = Math.round(whiteAlpha * 255);
  }
  if (pinkAlpha > 0.025) {
    const underlay = whiteContribution * 255;
    script[offset] = Math.round(Math.max(0, Math.min(255, (r - underlay) / pinkAlpha)));
    script[offset + 1] = Math.round(Math.max(0, Math.min(255, (g - underlay) / pinkAlpha)));
    script[offset + 2] = Math.round(Math.max(0, Math.min(255, (b - underlay) / pinkAlpha)));
    script[offset + 3] = Math.round(pinkAlpha * 255);
  }
}

function alphaBounds(bytes) {
  let left = crop.width;
  let top = crop.height;
  let right = -1;
  let bottom = -1;
  let visiblePixels = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (!bytes[index * 4 + 3]) continue;
    const x = index % crop.width;
    const y = Math.floor(index / crop.width);
    left = Math.min(left, x);
    top = Math.min(top, y);
    right = Math.max(right, x);
    bottom = Math.max(bottom, y);
    visiblePixels += 1;
  }
  return { left, top, right, bottom, visiblePixels };
}

const products = [
  { name: 'white', pixels: white },
  { name: 'script', pixels: script },
];
const results = [];
for (const product of products) {
  const destination = path.join(outputRoot, `${prefix}${product.name}.webp`);
  const encoded = await sharp(product.pixels, {
    raw: { width: crop.width, height: crop.height, channels: 4 },
  }).webp({ lossless: true, effort: 6 }).toBuffer();
  let existing;
  try {
    existing = await readFile(destination);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (existing && !existing.equals(encoded)) {
    throw new Error(`Refusing to overwrite a different existing image: ${destination}`);
  }
  if (!existing) await writeFile(destination, encoded, { flag: 'wx' });
  const metadata = await sharp(encoded).metadata();
  const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer();
  if (!decoded.equals(product.pixels)) throw new Error(`Lossless pixel verification failed: ${product.name}`);
  results.push({
    path: destination,
    bytes: (await stat(destination)).size,
    width: metadata.width,
    height: metadata.height,
    hasAlpha: metadata.hasAlpha,
    bounds: alphaBounds(product.pixels),
    sha256: hash(encoded),
    reused: Boolean(existing),
  });
}
if (review) {
  const destination = path.join(tmpdir(), 'kisara-wordmark-extraction-composite-review.webp');
  const combined = await sharp(white, {
    raw: { width: crop.width, height: crop.height, channels: 4 },
  }).composite([{ input: script, raw: { width: crop.width, height: crop.height, channels: 4 } }])
    .flatten({ background: '#27272b' }).png().toBuffer();
  const composite = await sharp(combined).resize(960).webp({ quality: 86 }).toBuffer();
  await writeFile(destination, composite);
  results.push({ review: destination, bytes: composite.length, width: 960, height: 408 });
}
console.log(JSON.stringify({
  source: path.relative(root, source).replaceAll('\\', '/'),
  sourceSha256: expectedSourceHash,
  sourceDimensions: [1920, 1080],
  sourceTime,
  sourceFrame,
  crop,
  results,
}, null, 2));
