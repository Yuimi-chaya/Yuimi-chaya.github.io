import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const blog = read("src/themes/kisara/lib/blogPage.js");
const between = (source: string, from: string, to: string) => {
  const start = source.indexOf(from), end = source.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Missing source boundary: ${from}`);
  return source.slice(start, end);
};

test("Blog uses stable hit geometry, guarded replay and deferred archive covers", () => {
  const hit = between(blog, "const findCharacterAtPoint =", "const resolveCastHit =");
  assert.doesNotMatch(hit, /getBoundingClientRect/);
  assert.match(blog, /generation !== introGeneration/);
  assert.match(blog, /lastIntroTime = performance\.now/);
  assert.match(blog, /window\.cancelAnimationFrame\(introFrame\)/);
  assert.match(blog, /pointerenter", prepareCastHitMasks/);
  assert.match(blog, /event\.key !== "Escape"/);
  const page = read("src/themes/kisara/pages/BlogIndexPage.astro");
  assert.doesNotMatch(page, /loading=\{index === 0/);
});

test("The Game switches two scenes directly without a scrolling bridge", () => {
  const page = read("src/themes/kisara/pages/GamesPage.astro");
  assert.match(page, /<KisaraGameClueScene \/>/);
  assert.doesNotMatch(page, /kisara-game-scene-bridge|scene\.offsetTop/);
  const runtime = read("src/themes/kisara/lib/gamesPage.js");
  assert.match(runtime, /scene\.inert = position !== target/);
  assert.doesNotMatch(runtime, /addEventListener\("wheel"|velocity|smoothScroll/);
  assert.match(page, /data-game-scene-jump="0"/);
  assert.match(page, /data-game-scene-jump="1"/);
});

test("Page runtime loading ignores detached routes and leaves a readable fallback on failure", () => {
  const loader = read("src/themes/kisara/components/KisaraPageRuntime.astro");
  assert.match(loader, /if \(root\.isConnected\) module\[entry\]\(\)/);
  assert.match(loader, /root\.dataset\.introState = "complete"/);
  assert.match(loader, /data-astro-rerun/);
});
