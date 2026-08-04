import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const gamesPagePath = fileURLToPath(new URL("../src/themes/kisara/pages/GamesPage.astro", import.meta.url));
const gamesCssPath = fileURLToPath(new URL("../src/themes/kisara/styles/games.css", import.meta.url));
const gamesPageSource = readFileSync(gamesPagePath, "utf8");
const gamesCssSource = readFileSync(gamesCssPath, "utf8");
const triggerStart = gamesPageSource.indexOf("const triggerGameShakeEaster = () => {");
const triggerEnd = gamesPageSource.indexOf("resetGameShakePressure = () => {", triggerStart);
const triggerSource = gamesPageSource.slice(triggerStart, triggerEnd);

test("Game shake easter eligibility follows live playback instead of a permanent tab lock", () => {
  assert.ok(triggerStart >= 0 && triggerEnd > triggerStart, "trigger implementation must remain discoverable");
  assert.match(gamesPageSource, /let gameShakeEasterArming = false;/);
  assert.match(gamesPageSource, /const isDarekareScramblePlaying = \(\) =>/);
  assert.match(gamesPageSource, /audioPlayer\.dataset\.secretVariant === "scramble"/);
  assert.match(gamesPageSource, /!themeAudio\.paused/);
  assert.match(gamesPageSource, /const canChargeGameShakeEaster = \(\) =>/);
  assert.match(gamesPageSource, /&& !gameShakeAfterglow/);
  assert.match(gamesPageSource, /isDarekareScramblePlaying\(\) && !isGameShakeSequenceActive\(\)/);
  assert.match(gamesPageSource, /window\.matchMedia\("\(min-width: 761px\)"\)/);
  assert.doesNotMatch(gamesPageSource, /gameShakeEasterConsumed/);
  assert.doesNotMatch(gamesPageSource, /GAME_SHAKE_EASTER_SESSION_KEY/);
});

test("Game shake easter starts video and grants the track without permanently consuming eligibility", () => {
  const playIndex = triggerSource.indexOf("Promise.resolve(shakeEasterVideo.play())");
  const audioGrantIndex = triggerSource.indexOf('new CustomEvent("yuimi:kisara-secret-audio"');
  const hintIndex = triggerSource.indexOf('mark("game-shake")');

  assert.ok(playIndex >= 0, "video playback must be attempted");
  assert.ok(audioGrantIndex > playIndex, "secret audio must not be consumed before video playback starts");
  assert.ok(hintIndex > playIndex, "opening hint must only be marked after video playback starts");
  assert.match(triggerSource, /gameShakeEasterArming = true;/);
  assert.match(triggerSource, /gameShakeEasterArming = false;/);
  assert.doesNotMatch(triggerSource, /grantId:/);
});

test("Game shake grows through the hold and keeps a page-local afterglow after the video ends", () => {
  const videoEndedIndex = gamesPageSource.indexOf('shakeEasterVideo.addEventListener("ended"');
  const afterglowIndex = gamesPageSource.indexOf("gameShakeAfterglow = true;", videoEndedIndex);
  const releaseIndex = gamesPageSource.indexOf("releaseGameShakeEaster()", afterglowIndex);

  assert.match(gamesPageSource, /const visualShake = heroShakeLatched/);
  assert.match(gamesPageSource, /Math\.pow\(holdProgress, 1\.12\) \* 0\.92/);
  assert.ok(videoEndedIndex >= 0 && afterglowIndex > videoEndedIndex && releaseIndex > afterglowIndex);
  assert.match(gamesPageSource, /easterPressure = keepAfterglow \? "afterglow" : "0"/);
  assert.match(gamesCssSource, /--game-easter-shake: 0/);
  assert.match(gamesCssSource, /data-easter-pressure="afterglow"/);
  assert.match(gamesCssSource, /@keyframes kisara-game-overdrive-type/);
  assert.match(gamesCssSource, /calc\(var\(--game-easter-shake\) \* 6px\)/);
});
