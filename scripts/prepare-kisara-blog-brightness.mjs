import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Pass kisara-front-blade-v4.webp as the source path.");

const original = await readFile(source);
const sourceSha256 = createHash("sha256").update(original).digest("hex");
if (sourceSha256 !== "81f8a4a2bbacd2ec87d51629f02aa47b4de0700b8c523a738df40754be9a1d2f") {
  throw new Error("Expected the accepted v4 blade artwork.");
}

const metadata = await sharp(original).metadata();
if (metadata.width !== 1440 || metadata.height !== 975 || !metadata.hasAlpha) {
  throw new Error("Expected the shared 1440x975 transparent stage.");
}

const { data, info } = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const smoothstep = (low, high, value) => {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
};

// Lift the whole character gently, then give warm skin a second, softer white lift.
for (let i = 0; i < data.length; i += 4) {
  if (data[i + 3] < 8) continue;
  const [r, g, b] = data.subarray(i, i + 3);
  const luminance = r * 0.2126 + g * 0.7152 + b * 0.0722;
  const skinWeight = smoothstep(104, 180, g)
    * smoothstep(2, 18, g - b)
    * smoothstep(-4, 12, r - g);

  for (let channel = 0; channel < 3; channel++) {
    let value = data[i + channel];
    value += (255 - value) * 0.12;
    value = luminance + (value - luminance) * 1.06;
    value += (255 - value) * 0.2 * skinWeight;
    data[i + channel] = Math.max(0, Math.min(255, Math.round(value)));
  }
}

const output = await sharp(data, { raw: info })
  .webp({ quality: 90, alphaQuality: 100, effort: 6 })
  .toBuffer();
const target = new URL("../public/themes/kisara/assets/blog/kisara-front-blade-v5.webp", import.meta.url);
await writeFile(target, output, { flag: "wx" });
console.log(JSON.stringify({ target: target.pathname, bytes: output.length, sourceSha256 }));
