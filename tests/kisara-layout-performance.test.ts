import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const layoutSource = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
const runtimeSource = readSource("src/themes/kisara/lib/layoutRuntime.js");

test("Kisara layout ships its shared controller as a cacheable module", () => {
  assert.match(layoutSource, /import "\.\.\/lib\/layoutRuntime\.js"/);
  assert.doesNotMatch(layoutSource, /window\.__yuimiKisaraLayoutCleanup\?\.\(\)/);
  assert.doesNotMatch(layoutSource, /const getScrollbarMetrics =/);
  assert.match(runtimeSource, /export const initKisaraLayoutRuntime =/);
  assert.match(runtimeSource, /document\.addEventListener\("astro:page-load", initKisaraLayoutRuntime\)/);
});

test("Kisara layout runtime remains idempotent across Astro swaps", () => {
  assert.match(runtimeSource, /body\.dataset\.kisaraLayoutRuntimeBound === "true"/);
  assert.match(runtimeSource, /window\.__yuimiKisaraLayoutCleanup\?\.\(\)/);
  assert.match(runtimeSource, /document\.addEventListener\("astro:before-swap", cleanup/);
  assert.match(runtimeSource, /delete body\.dataset\.kisaraLayoutRuntimeBound/);
  assert.match(runtimeSource, /scrollbarResizeObserver\?\.disconnect\(\)/);
  assert.match(runtimeSource, /lifecycle\.abort\(\)/);
});

test("Kisara layout runtime preserves scroll rail and context actions", () => {
  assert.match(runtimeSource, /kisara:gate-progress/);
  assert.match(runtimeSource, /--kisara-scroll-progress/);
  assert.match(runtimeSource, /data-kisara-action/);
  assert.match(runtimeSource, /window\.__yuimiTheme\?\.select/);
  assert.match(runtimeSource, /navigator\.clipboard\?\.writeText/);
});
