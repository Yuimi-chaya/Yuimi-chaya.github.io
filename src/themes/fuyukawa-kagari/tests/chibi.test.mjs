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
  assert.equal(manifest.outputs.length, 7);
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
    if (output.protectedMask) assert.equal(hash(await fs.readFile(path.join(root, output.protectedMask))), output.protectedMaskSha256);
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
  assert.ok(total < 350_000, `seven stickers total ${total} bytes`);
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
  assert.match(rail, /route: "\/blog\/"[^]*?sticker: "kagari-schoolbag"/);
  assert.match(rail, /route: "\/projects\/"[^]*?sticker: "haruto-reading"/);
  assert.match(rail, /route: "\/games\/"[^]*?sticker: "kagari-rest"/);
  assert.match(rail, /route: "\/about\/"[^]*?sticker: "kagari-cozy"/);
  assert.match(rail, /title: "课后，放松一下", note: "放下待办，留一点时间玩耍或小憩"/);
  assert.match(await read("pages/HomePage.astro"), /journal-margin-note[^]*?<MangaArt image="kagari-soba"/);
  assert.match(await read("pages/BlogIndexPage.astro"), /image="kagari-tea" class="blog-opening-character"/);
  assert.doesNotMatch(await read("layouts/ArticleLayout.astro"), /article-margin-character/);
  assert.match(await read("pages/GamesPage.astro"), /image="haruto-cat" class="playroom-companions"/);
  assert.match(await read("pages/AboutPage.astro"), /image="kagari-sleeve" class="about-side-character"/);
});

test("matching summer-night and thinking illustrations remain while redundant decorations are removed", async () => {
  const album = await read("components/MemoryAlbum.astro");
  assert.match(album, /image: "festival-cover"[^]*?title: "把夏夜夹进书里"/);
  assert.match(album, /image="festival-pair" class="album-companion"/);
  assert.match(await read("pages/BlogIndexPage.astro"), /image="kagari-thinking" class="archive-companion"/);
  assert.doesNotMatch(await read("pages/GamesPage.astro"), /game-note-character/);
  assert.match(await read("pages/NotFoundPage.astro"), /image="haruto-thinking" class="lost-page-character"/);
});

test("all seven new artworks are used once and the chapter rail does not repeat or group male characters", async () => {
  const files = ["components/ChapterRail.astro", "components/MemoryAlbum.astro", "pages/HomePage.astro", "pages/BlogIndexPage.astro", "pages/GamesPage.astro", "pages/AboutPage.astro", "pages/NotFoundPage.astro", "layouts/ArticleLayout.astro"];
  const source = (await Promise.all(files.map(read))).join("\n");
  const assigned = [...source.matchAll(/(?:image=|sticker: )"((?:kagari-|haruto-|festival-pair)[\w-]*)"/g)].map((match) => match[1]);
  assert.equal(assigned.length, 11);
  assert.equal(new Set(assigned).size, assigned.length, "no chibi artwork repeats between theme positions");
  assert.deepEqual(manifest.outputs.map((output) => output.source.split("/").at(-1)).sort(), (await fs.readdir(path.join(root, "fuyukawa/chibi"))).filter((name) => name.endsWith(".jpg")).sort());
  for (const output of manifest.outputs) {
    const name = output.file.replace(".webp", "");
    assert.equal(assigned.filter((value) => value === name).length, 1, `${name} must be used exactly once`);
  }
  const rail = [...(await read("components/ChapterRail.astro")).matchAll(/sticker: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(rail).size, 4);
  for (let i = 1; i < rail.length; i++) assert.ok(!(rail[i - 1].startsWith("haruto-") && rail[i].startsWith("haruto-")), "no adjacent male-only stickers");
});

test("the rest sticker preserves the white floral blanket without keeping surrounding paper", async () => {
  const selection = selections.find((item) => item.name === "kagari-rest");
  const { data, info } = await sharp(path.join(root, "fuyukawa/chibi", selection.source)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const protectedAlpha = await sharp(path.join(root, selection.protectedMask)).ensureAlpha().extractChannel(3).blur(2).raw().toBuffer();
  const rgba = removePaper(data, info.width, info.height, selection.exclusions, selection.paperThreshold, protectedAlpha);
  for (const [x, y] of [[340, 330], [450, 350], [530, 315]]) {
    assert.equal(rgba[(y * info.width + x) * 4 + 3], 255, `blanket at ${x},${y}`);
    assert.deepEqual(rgba.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 3), data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3));
  }
  for (const [x, y] of [[25, 25], [650, 450], [80, 100]]) assert.equal(rgba[(y * info.width + x) * 4 + 3], 0, `outside paper at ${x},${y}`);
  const css = await read("styles/manga.css");
  assert.match(css, /\.chapter-sticker--wide \{[^}]*grid-area: 2 \/ 1;[^}]*width: 170px;[^}]*transform-origin: right bottom;/);
  assert.match(css, /\.chapter-leaf\[data-sticker-shape="wide"\] \.chapter-caption \{ grid-area: 3 \/ 1; padding-right: 8px; \}/);
  assert.match(css, /@media \(max-width: 480px\) \{[^]*?\.chapter-sticker--wide \{ right: auto; width: 104px; \}/);
});
