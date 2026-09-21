import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";

const root = new URL("../public/themes/kisara/assets/blog/", import.meta.url);
const bytes = (name: string) => readFileSync(new URL(name, root));
const decode = (name: string) => sharp(bytes(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

test("replacement cast images retain the shared transparent stage and resource priorities", async () => {
  const page = readFileSync(new URL("../src/themes/kisara/pages/BlogIndexPage.astro", import.meta.url), "utf8");
  for (const [name, priority] of [["ayano-middle-art-v2.webp", "low"], ["kisara-front-blade-v6.webp", "high"]]) {
    const buffer = bytes(name);
    const meta = await sharp(buffer).metadata();
    assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [1440, 975, true]);
    assert.ok(buffer.length < 125_000, name);
    assert.match(page, new RegExp(`${name.replaceAll(".", "\\.")}"[^>]*width="1440" height="975"[^>]*fetchpriority="${priority}"`));
  }
  assert.doesNotMatch(page, /ayano-middle-solo-v1\.webp|kisara-front-blade-v3\.webp/);
});

test("Ayano's replacement stays within the canvas and retains the previous visible height", async () => {
  const bounds = async (name: string) => {
    const { data, info } = await decode(name);
    const box = { left: info.width, top: info.height, right: 0, bottom: 0, pixels: 0 };
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[(y * info.width + x) * 4 + 3] <= 32) continue;
        box.left = Math.min(box.left, x);
        box.top = Math.min(box.top, y);
        box.right = Math.max(box.right, x);
        box.bottom = Math.max(box.bottom, y);
        box.pixels++;
      }
    }
    return box;
  };
  const old = await bounds("ayano-middle-solo-v1.webp");
  const next = await bounds("ayano-middle-art-v2.webp");
  assert.ok(Math.abs(old.top - next.top) <= 2);
  assert.ok(Math.abs(old.bottom - next.bottom) <= 2);
  assert.ok(next.left > 0 && next.right < 1439);
  assert.ok(next.pixels > 70_000 && next.pixels < 150_000);
});

test("Kisara's second skin adjustment brightens warm tones without changing alpha or pose", async () => {
  const old = await decode("kisara-front-blade-v3.webp");
  const next = await decode("kisara-front-blade-v4.webp");
  assert.deepEqual(old.info, next.info);
  let samples = 0;
  const delta = [0, 0, 0];
  for (let i = 0; i < old.data.length; i += 4) {
    assert.equal(next.data[i + 3], old.data[i + 3], `Alpha at pixel ${i / 4}`);
    const [r, g, b, a] = old.data.subarray(i, i + 4);
    if (a <= 240 || g <= 150 || g - b <= 10 || r - g <= 5) continue;
    samples++;
    for (let c = 0; c < 3; c++) delta[c] += next.data[i + c] - old.data[i + c];
  }
  assert.ok(samples > 10_000);
  assert.ok(delta[0] / samples > 0);
  assert.ok(delta[1] / samples > 2 && delta[1] / samples < 10);
  assert.ok(delta[2] / samples > 3 && delta[2] / samples < 15);
});
