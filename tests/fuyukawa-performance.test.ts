import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const layoutSource = readSource("src/themes/fuyukawa-kagari/layouts/BaseLayout.astro");
const homeSource = readSource("src/themes/fuyukawa-kagari/pages/HomePage.astro");

test("Fuyukawa defers external Live2D work to idle or explicit intent", () => {
  assert.match(layoutSource, /const scheduleLive2dWidget =/);
  assert.match(layoutSource, /canAutoInitLive2d/);
  assert.match(layoutSource, /requestIdleCallback\(start, \{ timeout: 3200 \}\)/);
  assert.match(layoutSource, /scheduleLive2dWidget\(\);/);
  assert.match(layoutSource, /live2dToggle\?\.addEventListener\("click"/);
  assert.match(layoutSource, /initLive2dWidget\(\);/);
  assert.match(layoutSource, /const live2dResources = new Map\(\)/);
});

test("Fuyukawa bounds and defers location and weather requests", () => {
  assert.match(homeSource, /const scheduleHomeWeather =/);
  assert.match(homeSource, /locationCacheTtl = 1000 \* 60 \* 60 \* 12/);
  assert.match(homeSource, /fetchWithTimeout\(weatherUrl, \{\}, 4500, signal\)/);
  assert.match(homeSource, /requestJsonp\([^]*3500, signal/);
  assert.match(homeSource, /performanceProfile === "full" && !constrainedNetwork/);
  assert.match(homeSource, /connection\?\.saveData/);
  assert.doesNotMatch(homeSource, /getPconlineIpLocation|getTencentNewsIpLocation/);
});

test("Fuyukawa pauses the second-by-second clock while hidden", () => {
  assert.match(homeSource, /const scheduleHomeClock =/);
  assert.match(homeSource, /document\.visibilityState !== "visible"/);
  assert.match(homeSource, /document\.addEventListener\("visibilitychange", handleClockVisibility\)/);
  assert.doesNotMatch(homeSource, /setInterval\(updateHomeClock, 1000\)/);
});
