import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)), "utf8"
);
const opening = readSource("src/themes/kisara/components/KisaraOpeningMemoryScene.astro");
const routes = readSource("src/themes/kisara/data/openingRoutes.ts");
const runtime = readSource("src/themes/kisara/lib/comicOpening.ts");
const css = readSource("src/themes/kisara/styles/home-comic.css");
const home = readSource("src/themes/kisara/pages/HomePage.astro");
const layout = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
const fridge = readSource("src/themes/kisara/components/KisaraFridgeScene.astro");
const hintIds = ["chibi-jealousy", "chibi-apple", "found-self", "photo-archive", "memory-return"];

test("Comic 001 preserves the five hidden-route definitions and versioned ledger", () => {
  assert.match(layout, /yuimi-kisara-opening-hints-v1/);
  for (const id of hintIds) {
    assert.match(layout, new RegExp(`"${id}"`));
    assert.equal((routes.match(new RegExp(`id: "${id}"`, "g")) ?? []).length, 1);
  }
  assert.match(runtime, /yuimi:kisara-opening-hint-achieved/);
  assert.match(runtime, /__yuimiKisaraEasterLedger\?\.has/);
  assert.match(opening, /data-kisara-opening-hint=\{route\.id\}/);
});

test("Each opening hint is still granted only by its accepted scene", () => {
  const chibi = readSource("src/themes/kisara/components/KisaraChibiStage.astro");
  const clue = readSource("src/themes/kisara/components/KisaraGameClueScene.astro");
  const audio = readSource("src/themes/kisara/components/KisaraAudioControl.astro");
  assert.match(chibi, /mark\("chibi-jealousy"\)/);
  assert.match(chibi, /mark\("chibi-apple"\)/);
  assert.match(home, /mark\("found-self"\)/);
  assert.match(clue, /mark\("photo-archive"\)/);
  assert.match(audio, /mark\("memory-return"\)/);
  assert.doesNotMatch(runtime, /EasterLedger\?\.mark/);
});

test("Completed hints keep one whole-label strike and keyboard-readable clues", () => {
  assert.equal((opening.match(/class="kisara-opening-easter-hint-copy"/g) ?? []).length, 1);
  assert.equal((opening.match(/class="kisara-opening-easter-hint-fragment"/g) ?? []).length, 1);
  assert.match(opening, /tabindex="0" title=\{route\.detail\}/);
  assert.match(css, /kisara-opening-hint-strike/);
  assert.match(css, /is-hint-achieved/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("Five page branches, four chapters, and page/chapter visit state survive replacement", () => {
  for (const id of ["home", "blog", "games", "projects", "about"]) {
    assert.match(routes, new RegExp(`id: "${id}"`));
  }
  assert.equal((routes.match(/kind: "chapter"/g) ?? []).length, 4);
  assert.match(opening, /routeBranches\.map/);
  assert.match(opening, /branch\.routes\.map/);
  assert.match(runtime, /yuimi-kisara-opening-route-chapters-v1/);
  assert.match(runtime, /__yuimiKisaraLovebrainProgress\?\.snapshot/);
  assert.match(runtime, /yuimi:kisara-lovebrain-progress/);
  assert.match(runtime, /data-kisara-home-stop/);
  assert.match(runtime, /routeTapReady/);
  assert.match(runtime, /focusin/);
  assert.match(runtime, /event\.metaKey \|\| event\.ctrlKey/);
});

test("001 is opaque and viewport-filling with no old transparent bridge markup", () => {
  assert.match(home, /class="kisara-opening kisara-comic-section"/);
  assert.match(css, /\.kisara-opening\.kisara-comic-section\s*\{[^}]*height: 100svh;[^}]*background: #fff;/);
  assert.match(css, /\.kisara-comic-section::before, \.kisara-comic-section::after \{ content: none; \}/);
  assert.doesNotMatch(home, /class="kisara-opening-edge"|class="kisara-opening-inner"/);
  assert.doesNotMatch(readSource("src/themes/kisara/styles/home.css"), /\.kisara-opening/);
  assert.doesNotMatch(readSource("src/themes/kisara/styles/theme.css"), /\.kisara-opening/);
});

test("Comic assets are deferred; 001 no longer downloads or drives its former footage", () => {
  for (const id of ["quiet", "action", "smile", "candle"]) assert.match(opening, new RegExp(`id: "${id}"`));
  assert.match(opening, /hero-hybrid\.webp/);
  assert.match(opening, /hero-structure\.svg/);
  assert.match(opening, /data-comic-src/);
  assert.match(runtime, /await image\.decode\(\)/);
  assert.match(runtime, /Promise\.allSettled/);
  assert.doesNotMatch(opening, /<video|<iframe|opening-memory-001/);
  assert.doesNotMatch(runtime, /requestAnimationFrame|setInterval/);
  assert.match(runtime, /observer\.disconnect\(\)/);
  assert.match(runtime, /serial !== generation/);
});

test("Comic entrance and return commit behind the curtain instead of scrolling the page up", () => {
  const entry = home.slice(home.indexOf("const enterNextPage ="), home.indexOf("const finalizeLovebrainExit ="));
  const back = home.slice(home.indexOf("const returnToGate ="), home.indexOf("const clearHomeGateReturnArm ="));
  assert.match(entry, /runComicHandoff\("opening"/);
  assert.match(back, /runComicHandoff\("gate"/);
  assert.match(back, /setScrollPosition\(0, true\);\s*requestHomeSectionReplayReset\(\);\s*completeGateReturn\(\)/);
  assert.doesNotMatch(entry + back, /smoothScrollTo\(/);
  assert.match(home, /if \(comicTransition\.active\) \{ event\.preventDefault\(\); return; \}/);
  assert.match(home, /a\[data-comic-next\]/);
  assert.match(css, /kisara-comic-character-in/);
});

test("Fridge handoff checks a fresh decoded frame and has bounded failure cleanup", () => {
  assert.match(fridge, /playCoveredEntry\(\)/);
  assert.match(fridge, /armOpening\(false\)/);
  assert.match(fridge, /!video\.seeking && metadata\.mediaTime < \.3/);
  assert.match(fridge, /cancelVideoFrameCallback/);
  assert.match(fridge, /signal\.removeEventListener\("abort", finish\)/);
  assert.match(fridge, /1800/);
});

test("All five supplied images have hybrid derivatives and real vector masters", () => {
  const manifest = JSON.parse(readSource("design/kisara-comic-001/collection/manifest.json"));
  assert.equal(manifest.assets.length, 5);
  assert.ok(manifest.runtimeBytes < 400_000);
  for (const asset of manifest.assets) {
    const vector = readSource(`design/kisara-comic-001/collection/${asset.id}.svg`);
    assert.match(vector, /<path/);
    assert.doesNotMatch(vector, /<(?:image|foreignObject|script)\b/);
    const sourcePath = new URL(`../kisara/comic/${asset.source}`, import.meta.url);
    // Original source materials intentionally stay outside Git.
    try {
      const original = readFileSync(sourcePath);
      assert.equal(createHash("sha256").update(original).digest("hex"), asset.sourceSha256);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    const filename = asset.id === "hero" ? "hero-hybrid.webp" : `${asset.id}.webp`;
    assert.equal(statSync(new URL(`../public/themes/kisara/assets/home-comic/${filename}`, import.meta.url)).size, asset.runtimeBytes);
  }
});

test("Comic vector masters and published derivatives rasterize with visible linework", async () => {
  const { default: sharp } = await import("sharp");
  sharp.concurrency(2);
  const manifest = JSON.parse(readSource("design/kisara-comic-001/collection/manifest.json"));
  for (const asset of manifest.assets) {
    const filename = asset.id === "hero" ? "hero-hybrid.webp" : `${asset.id}.webp`;
    for (const relative of [
      `design/kisara-comic-001/collection/${asset.id}.svg`,
      `public/themes/kisara/assets/home-comic/${filename}`,
    ]) {
      const image = sharp(readFileSync(new URL(`../${relative}`, import.meta.url)));
      const metadata = await image.metadata();
      assert.deepEqual([metadata.width, metadata.height], asset.runtimeSize);
      const pixels = await image.resize({ width: 256 }).flatten({ background: "#fff" }).stats();
      assert.ok(pixels.channels[0].stdev > 20, `${relative} must retain visible linework`);
    }
  }
});
