import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const gamesPagePath = fileURLToPath(new URL("../src/themes/kisara/pages/GamesPage.astro", import.meta.url));
const gamesPageSource = readFileSync(gamesPagePath, "utf8");
const triggerStart = gamesPageSource.indexOf("const triggerGameShakeEaster = () => {");
const triggerEnd = gamesPageSource.indexOf("resetGameShakePressure = () => {", triggerStart);
const triggerSource = gamesPageSource.slice(triggerStart, triggerEnd);

test("Game shake easter uses the corrected single-use tab session", () => {
  assert.ok(triggerStart >= 0 && triggerEnd > triggerStart, "trigger implementation must remain discoverable");
  assert.match(gamesPageSource, /yuimi-kisara-game-shake-easter-v2/);
  assert.doesNotMatch(gamesPageSource, /yuimi-kisara-game-shake-easter-v1/);
  assert.match(gamesPageSource, /let gameShakeEasterArming = false;/);
  assert.match(gamesPageSource, /let gameShakeEasterConsumed = false;/);
  assert.match(gamesPageSource, /window\.matchMedia\("\(min-width: 761px\)"\)/);
});

test("Game shake easter consumes only after video playback starts", () => {
  const playIndex = triggerSource.indexOf("Promise.resolve(shakeEasterVideo.play())");
  const consumedIndex = triggerSource.indexOf("gameShakeEasterConsumed = true;");
  const sessionWriteIndex = triggerSource.indexOf("sessionStorage.setItem(GAME_SHAKE_EASTER_SESSION_KEY");
  const audioGrantIndex = triggerSource.indexOf('new CustomEvent("yuimi:kisara-secret-audio"');

  assert.ok(playIndex >= 0, "video playback must be attempted");
  assert.ok(consumedIndex > playIndex, "visual easter must not be consumed before playback starts");
  assert.ok(sessionWriteIndex > playIndex, "tab-session consumption must not be stored before playback starts");
  assert.ok(audioGrantIndex > playIndex, "secret audio must not be consumed before video playback starts");
  assert.match(triggerSource, /gameShakeEasterArming = true;/);
  assert.match(triggerSource, /gameShakeEasterArming = false;/);
});
