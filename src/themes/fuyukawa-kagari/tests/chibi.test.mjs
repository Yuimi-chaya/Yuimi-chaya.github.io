import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import test from "node:test";
import sharp from "sharp";
import { removePaper, selections } from "../tools/prepare-chibi.mjs";

const root = process.cwd();
const theme = path.join(root, "src/themes/fuyukawa-kagari");
const assets = path.join(root, "public/themes/fuyukawa-kagari/assets/manga");
const read = (file) => fs.readFile(path.join(theme, file), "utf8");
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
const manifest = JSON.parse(await fs.readFile(path.join(assets, "chibi-manifest.json"), "utf8"));

test("chibi derivatives have transparent paper, true intrinsic sizes and traceable unchanged sources", async () => {
  const registry = await read("data/mangaArt.ts");
  assert.equal(manifest.outputs.length, 5);
  let total = 0;
  for (const output of manifest.outputs) {
    const buffer = await fs.readFile(path.join(assets, output.file));
    const metadata = await sharp(buffer).metadata();
    assert.ok(metadata.hasAlpha, output.file);
    assert.equal(metadata.width, output.width);
    assert.equal(metadata.height, output.height);
    assert.equal(buffer.length, output.bytes);
    assert.equal(hash(buffer), output.sha256);
    assert.ok(registry.includes(`"${output.file.replace(".webp", "")}": [${output.width}, ${output.height}]`));
    assert.equal(hash(await fs.readFile(path.join(root, output.source))), output.sourceSha256);
    const alpha = await sharp(buffer).ensureAlpha().extractChannel(3).raw().toBuffer();
    assert.ok(alpha.filter((value) => value === 0).length > alpha.length * .2, output.file);
    for (let x = 0; x < output.width; x++) {
      assert.equal(alpha[x], 0, `${output.file} top paper`);
      assert.equal(alpha[(output.height - 1) * output.width + x], 0, `${output.file} bottom paper`);
    }
    for (let y = 0; y < output.height; y++) {
      assert.equal(alpha[y * output.width], 0, `${output.file} left paper`);
      assert.equal(alpha[y * output.width + output.width - 1], 0, `${output.file} right paper`);
    }
    total += buffer.length;
  }
  assert.ok(total < 250_000, `five stickers total ${total} bytes`);
});

test("paper removal preserves enclosed white artwork instead of globally keying white", () => {
  const width = 9, height = 9;
  const rgb = Buffer.alloc(width * height * 3, 255);
  for (let y = 2; y <= 6; y++) {
    for (let x = 2; x <= 6; x++) {
      if (x !== 2 && x !== 6 && y !== 2 && y !== 6) continue;
      rgb.fill(30, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  }
  const rgba = removePaper(rgb, width, height);
  assert.equal(rgba[3], 0);
  assert.deepEqual([...rgba.subarray((4 * width + 4) * 4, (4 * width + 4) * 4 + 4)], [255, 255, 255, 255]);
});

test("pale hair stays opaque and detached captions are removed on the two light-outline drawings", async () => {
  for (const [name, point] of [["kagari-soba", [300, 130]], ["kagari-sleeve", [420, 130]]]) {
    const selection = selections.find((item) => item.name === name);
    const { data, info } = await sharp(path.join(root, "fuyukawa/chibi", selection.source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const rgba = removePaper(data, info.width, info.height, selection.exclusions, selection.paperThreshold);
    const offset = (point[1] * info.width + point[0]) * 4;
    assert.equal(rgba[offset + 3], 255, `${name} pale hair must not reveal the background`);
    assert.deepEqual(rgba.subarray(offset, offset + 3), data.subarray((point[1] * info.width + point[0]) * 3, (point[1] * info.width + point[0]) * 3 + 3));
    for (const rect of selection.exclusions) {
      for (let y = rect.top; y < rect.top + rect.height; y++) {
        for (let x = rect.left; x < rect.left + rect.width; x++) assert.equal(rgba[(y * info.width + x) * 4 + 3], 0);
      }
    }
  }
});

test("page-specific chibi choices follow reading, leisure, everyday life and welcome contexts", async () => {
  const rail = await read("components/ChapterRail.astro");
  assert.match(rail, /route: "\/blog\/"[^]*?sticker: "haruto-reading"/);
  assert.match(rail, /route: "\/games\/"[^]*?sticker: "haruto-cat"/);
  assert.match(rail, /route: "\/about\/"[^]*?sticker: "kagari-schoolbag"/);
  assert.match(await read("pages/HomePage.astro"), /journal-margin-note[^]*?<MangaArt image="kagari-soba"/);
  assert.match(await read("pages/BlogIndexPage.astro"), /image="haruto-reading" class="blog-opening-character"/);
  assert.match(await read("layouts/ArticleLayout.astro"), /image="haruto-reading" class="article-margin-character"/);
  assert.match(await read("pages/GamesPage.astro"), /image="haruto-cat" class="playroom-companions"/);
  assert.match(await read("pages/AboutPage.astro"), /image="kagari-sleeve" class="about-side-character"/);
});

test("matching summer-night, thinking and work-delivery illustrations remain unchanged", async () => {
  const album = await read("components/MemoryAlbum.astro");
  assert.match(album, /image: "festival-cover"[^]*?title: "把夏夜夹进书里"/);
  assert.match(album, /image="festival-pair" class="album-companion"/);
  assert.match(await read("components/ChapterRail.astro"), /route: "\/projects\/"[^]*?sticker: "haruto-gift"/);
  assert.match(await read("pages/BlogIndexPage.astro"), /image="kagari-thinking" class="archive-companion"/);
  assert.match(await read("pages/GamesPage.astro"), /image="haruto-thinking" class="game-note-character"/);
  assert.match(await read("pages/NotFoundPage.astro"), /image="haruto-thinking" class="lost-page-character"/);
});
