import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const profileSource = readSource("src/core/PerformanceProfile.astro");
const kisaraThemeSource = readSource("src/themes/kisara/styles/theme.css");
const fuyukawaThemeSource = readSource("src/themes/fuyukawa-kagari/styles/theme.css");
const blankThemeSource = readSource("src/themes/blank/styles/theme.css");
const homeSource = readSource("src/themes/kisara/styles/home.css");
const gamesSource = readSource("src/themes/kisara/styles/games.css");
const packageSource = readSource("package.json");
const budgetSource = readSource("scripts/check-performance-budgets.mjs");

test("shared performance profile publishes document visibility", () => {
  assert.match(profileSource, /root\.dataset\.yuimiVisibility = document\.visibilityState/);
  assert.match(profileSource, /document\.addEventListener\("visibilitychange", applyVisibility/);
});

test("all themes pause CSS animation work while the document is hidden", () => {
  for (const source of [kisaraThemeSource, fuyukawaThemeSource, blankThemeSource]) {
    assert.match(source, /html\[data-yuimi-visibility="hidden"\][^]*animation-play-state: paused !important/);
  }
});

test("lite mode removes only persistent decorative motion", () => {
  assert.match(kisaraThemeSource, /data-yuimi-performance="lite"[^]*\.kisara-footer-wave i[^]*animation: none !important/);
  assert.match(homeSource, /data-yuimi-performance="lite"\] \.kisara-ambient-particles[^]*display: none/);
  assert.match(homeSource, /data-yuimi-performance="lite"\] \.kisara-event-reward-burst::before[^]*animation: none !important/);
  assert.match(gamesSource, /data-yuimi-performance="lite"\] \.kisara-arcade-hex-core i[^]*animation: none !important/);
  assert.match(fuyukawaThemeSource, /data-yuimi-performance="lite"\] \.sakura-rain span[^]*\.console-meter span[^]*animation: none !important/);
});

test("production build enforces route, CSS, bundle, and deferred-media budgets", () => {
  const scripts = JSON.parse(packageSource).scripts;
  assert.equal(scripts.build, "npm run generate:assets && astro build && npm run check:performance");
  assert.equal(scripts["check:performance"], "node scripts/check-performance-budgets.mjs");
  assert.match(budgetSource, /Kisara Home HTML/);
  assert.match(budgetSource, /Kisara Home CSS/);
  assert.match(budgetSource, /Kisara shared layout runtime/);
  assert.match(budgetSource, /data-src=/);
  assert.match(budgetSource, /regressed to an eager source request/);
  assert.match(budgetSource, /Kisara Home 002 video lost its deferred loading contract/);
});
