import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const readSource = (relativePath: string) => readFileSync(
  fileURLToPath(new URL(`../${relativePath}`, import.meta.url)),
  "utf8"
);

const layoutSource = readSource("src/themes/kisara/layouts/KisaraLayout.astro");
const openingSource = readSource("src/themes/kisara/components/KisaraOpeningMemoryScene.astro");
const homeCssSource = readSource("src/themes/kisara/styles/home.css");
const chibiSource = readSource("src/themes/kisara/components/KisaraChibiStage.astro");
const homeSource = readSource("src/themes/kisara/pages/HomePage.astro");
const audioSource = readSource("src/themes/kisara/components/KisaraAudioControl.astro");
const gamesSource = readSource("src/themes/kisara/pages/GamesPage.astro");

const hintIds = [
  "chibi-jealousy",
  "chibi-apple",
  "found-self",
  "photo-archive",
  "memory-return",
  "game-shake"
];

test("Kisara opening hints use one versioned tab-session ledger", () => {
  assert.match(layoutSource, /yuimi-kisara-opening-hints-v1/);
  assert.match(layoutSource, /yuimi:kisara-opening-hint-achieved/);
  for (const id of hintIds) {
    assert.match(layoutSource, new RegExp(`"${id}"`), `${id} must be allowlisted`);
    const matches = openingSource.match(new RegExp(`data-kisara-opening-hint="${id}"`, "g")) ?? [];
    assert.equal(matches.length, 1, `${id} must own exactly one opening hint`);
  }
});

test("Each opening hint is marked only from its accepted trigger path", () => {
  assert.match(chibiSource, /mark\("chibi-jealousy"\)/);
  assert.match(chibiSource, /mark\("chibi-apple"\)/);
  assert.match(homeSource, /mark\("found-self"\)/);
  assert.match(homeSource, /mark\("photo-archive"\)/);
  assert.match(audioSource, /mark\("memory-return"\)/);
  assert.match(gamesSource, /mark\("game-shake"\)/);

  const gamePlayIndex = gamesSource.indexOf("Promise.resolve(shakeEasterVideo.play())");
  const gameConsumedIndex = gamesSource.indexOf("gameShakeEasterConsumed = true;", gamePlayIndex);
  const gameHintIndex = gamesSource.indexOf('mark("game-shake")', gameConsumedIndex);
  assert.ok(gamePlayIndex >= 0 && gameConsumedIndex > gamePlayIndex && gameHintIndex > gameConsumedIndex);

  const rewardIndex = homeSource.indexOf("const completeReward = (autoplay: boolean) => {");
  const solvedIndex = homeSource.indexOf('setState("solved")', rewardIndex);
  const photoHintIndex = homeSource.indexOf('mark("photo-archive")', solvedIndex);
  assert.ok(rewardIndex >= 0 && solvedIndex > rewardIndex && photoHintIndex > solvedIndex);
});

test("Opening hint strike keeps the Pulse-style layered motion and reduced-motion fallback", () => {
  assert.match(homeCssSource, /kisara-opening-hint-strike/);
  assert.match(homeCssSource, /clip-path: polygon/);
  assert.match(homeCssSource, /is-hint-achieved/);
  assert.match(homeCssSource, /prefers-reduced-motion: reduce/);
});
