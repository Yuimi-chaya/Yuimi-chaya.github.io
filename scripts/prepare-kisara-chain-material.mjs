import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";
import { chainAtlas } from "../src/themes/kisara/lib/titleChainMaterial.ts";
import { rasterChainTile } from "./lib/kisara-chain-raster.mjs";

sharp.concurrency(2);
const output = fileURLToPath(new URL("../public/themes/kisara/assets/title-chain-steel.webp", import.meta.url));
const width = chainAtlas.cellWidth * chainAtlas.steps;
const height = chainAtlas.cellHeight * 4;
const atlas = Buffer.alloc(width * height * 4);
for (let row = 0; row < 4; row++) {
  for (let step = 0; step < chainAtlas.steps; step++) {
    const tile = rasterChainTile(step / (chainAtlas.steps - 1), row >= 2, row % 2 === 1);
    const stride = chainAtlas.cellWidth * 4;
    for (let y = 0; y < chainAtlas.cellHeight; y++) {
      const destination = ((row * chainAtlas.cellHeight + y) * width + step * chainAtlas.cellWidth) * 4;
      tile.copy(atlas, destination, y * stride, (y + 1) * stride);
    }
  }
}
await sharp(atlas, { raw: { width, height, channels: 4 } })
  .webp({ lossless: true, effort: 6 }).toFile(output);
console.log(JSON.stringify({ output, width, height, bytes: (await stat(output)).size, decodedBytes: width * height * 4 }));

const reviewIndex = process.argv.indexOf("--review");
if (reviewIndex >= 0 && process.argv[reviewIndex + 1]) {
  const review = process.argv[reviewIndex + 1];
  const parts = [];
  const states = [0, 0.5, 1];
  const labels = ["COLD STEEL", "MID TRANSITION", "CRIMSON STEEL"];
  const canvasWidth = 1020;
  const canvasHeight = 510;
  const svg = `<svg width="${canvasWidth}" height="${canvasHeight}">
    <rect width="1020" height="510" fill="#bbb5b9"/>
    <rect x="690" width="330" height="510" fill="#242329"/>
    ${states.map((_, row) => `<text x="24" y="${row * 170 + 32}" font-size="14" fill="#343139" font-family="Arial">${labels[row]} / OFFLINE MATERIAL REVIEW</text>`).join("")}
  </svg>`;
  for (let row = 0; row < 3; row++) {
    for (const [near, edgeOn] of [[false, false], [false, true], [true, false], [true, true]]) {
      const part = await sharp(rasterChainTile(states[row], edgeOn, near), {
        raw: { width: chainAtlas.cellWidth, height: chainAtlas.cellHeight, channels: 4 }
      }).resize(72, 48).png().toBuffer();
      for (let index = 0; index < 22; index++) {
        if ((index % 2 === 1) !== edgeOn) continue;
        const phase = index * 0.24;
        const angle = Math.cos(phase) * 9;
        const rotated = await sharp(part).rotate(angle, { background: "#00000000" }).toBuffer({ resolveWithObject: true });
        parts.push({
          input: rotated.data,
          left: Math.round(44 + index * 43 - rotated.info.width / 2),
          top: Math.round(row * 170 + 95 + Math.sin(phase) * 28 - rotated.info.height / 2)
        });
      }
    }
  }
  await sharp(Buffer.from(svg)).composite(parts).jpeg({ quality: 88 }).toFile(review);
  console.log(JSON.stringify({ review, width: canvasWidth, height: canvasHeight, bytes: (await stat(review)).size }));
}
