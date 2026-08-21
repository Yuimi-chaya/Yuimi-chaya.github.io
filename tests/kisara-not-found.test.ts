import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const pagePath = fileURLToPath(new URL("../src/themes/kisara/pages/NotFoundPage.astro", import.meta.url));
const cssPath = fileURLToPath(new URL("../src/themes/kisara/styles/not-found.css", import.meta.url));
const imagePath = fileURLToPath(new URL("../public/themes/kisara/assets/not-found/lost-route.jpg", import.meta.url));
const pageSource = readFileSync(pagePath, "utf8");
const cssSource = readFileSync(cssPath, "utf8");

test("Kisara 404 uses the supplied lost-route artwork as its eager hero image", () => {
  assert.equal(existsSync(imagePath), true);
  assert.match(pageSource, /\/themes\/kisara\/assets\/not-found\/lost-route\.jpg/);
  assert.match(pageSource, /width="1920"/);
  assert.match(pageSource, /height="1080"/);
  assert.match(pageSource, /loading="eager"/);
  assert.match(pageSource, /fetchpriority="high"/);
});

test("Kisara 404 replays a staged entrance after client-side navigation", () => {
  assert.match(pageSource, /data-kisara-not-found/);
  assert.match(pageSource, /root\.dataset\.entryState = "prepared"/);
  assert.match(pageSource, /root\.dataset\.entryState = "entered"/);
  assert.match(pageSource, /requestAnimationFrame/);
  assert.match(pageSource, /astro:before-swap/);
  assert.match(cssSource, /kisara-not-found-image-reveal/);
  assert.match(cssSource, /kisara-not-found-code-drop/);
  assert.match(cssSource, /kisara-not-found-content-enter/);
});

test("Kisara 404 keeps rounded typography and a reduced-motion fallback", () => {
  assert.match(cssSource, /Arial Rounded MT Bold/);
  assert.match(cssSource, /ui-rounded/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /\.kisara-not-found-rain/);
});
